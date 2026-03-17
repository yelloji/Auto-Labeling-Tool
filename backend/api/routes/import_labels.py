"""
Import Images with Labels
=========================
Accepts a folder of images + label files (YOLO or COCO format) and:
  1. Saves images to disk under projects/{name}/unassigned/{batch}/
  2. Creates Image records with image_hash_md5
  3. Parses label files → creates Annotation records
  4. Creates new Label (class) records for any unknown classes

Supported formats:
  - YOLO  : .txt per image  +  data.yaml  (detection or segmentation)
  - COCO  : single annotations.json       (detection or segmentation)

See docs/FEATURE_IMPORT_IMAGES_WITH_LABELS.md for full specification.
"""

import hashlib
import io
import json
import os
import random
import uuid
from pathlib import Path
from typing import List, Optional

import yaml
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image as PILImage
from sqlalchemy.orm import Session

from core.config import settings
from database.database import get_db
from database.models import Annotation, Dataset, Image, Label, Project
from database.operations import DatasetOperations, ImageOperations
from logging_system.professional_logger import get_professional_logger
from utils.path_utils import path_manager

logger = get_professional_logger()
router = APIRouter()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def _random_color() -> str:
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))


def _get_or_create_label(db: Session, project_id: int, class_name: str) -> tuple[int, bool]:
    """Return (label.id, created). Creates label if it doesn't exist."""
    existing = db.query(Label).filter(
        Label.project_id == project_id,
        Label.name == class_name
    ).first()
    if existing:
        return existing.id, False
    label = Label(name=class_name, color=_random_color(), project_id=project_id)
    db.add(label)
    db.flush()
    return label.id, True


def _bbox_from_polygon(pairs: list) -> tuple:
    """Compute x_min,y_min,x_max,y_max from list of [x,y] pairs (normalized)."""
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    return min(xs), min(ys), max(xs), max(ys)


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


# ── Format Detection ──────────────────────────────────────────────────────────

def _detect_format(filenames: list) -> str:
    """
    Returns 'yolo', 'coco', 'yolo_missing_yaml', or 'no_labels'.
    """
    lower = [f.lower() for f in filenames]
    has_json = any(f.endswith(".json") for f in lower)
    has_txt  = any(f.endswith(".txt") and f != "data.yaml" for f in lower)
    has_yaml = "data.yaml" in lower

    if has_json:
        return "coco"
    if has_txt and has_yaml:
        return "yolo"
    if has_txt and not has_yaml:
        return "yolo_missing_yaml"
    return "no_labels"


# ── YOLO Parser ───────────────────────────────────────────────────────────────

def _parse_yolo(
    image_files: dict,      # {stem: (filename, bytes)}
    label_files: dict,      # {stem: bytes}
    yaml_bytes: bytes,
    img_dims: dict,         # {stem: (width, height)}
) -> tuple[dict, list]:
    """
    Returns:
      annotations_map : {stem: [ {class_name, x_min, y_min, x_max, y_max, segmentation} ]}
      warnings        : [str]
    """
    yaml_data = yaml.safe_load(yaml_bytes.decode("utf-8"))
    names = yaml_data.get("names", [])
    # names may be a list or a dict {0: 'cat', 1: 'dog'}
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names.keys())]

    warnings = []
    annotations_map = {}

    for stem, txt_bytes in label_files.items():
        if stem not in image_files:
            warnings.append(f"{stem}.txt has no matching image — skipped")
            continue

        lines = txt_bytes.decode("utf-8").strip().splitlines()
        anns = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            class_idx = int(parts[0])
            if class_idx >= len(names):
                warnings.append(f"{stem}.txt: class index {class_idx} not in data.yaml — skipped")
                continue
            class_name = names[class_idx]
            values = [float(v) for v in parts[1:]]

            if len(values) == 4:
                # Detection: cx cy w h
                cx, cy, w, h = values
                x_min = _clamp(cx - w / 2)
                y_min = _clamp(cy - h / 2)
                x_max = _clamp(cx + w / 2)
                y_max = _clamp(cy + h / 2)
                segmentation = None
            else:
                # Segmentation: flat x1 y1 x2 y2 ...
                pairs = [[_clamp(values[i]), _clamp(values[i + 1])]
                         for i in range(0, len(values) - 1, 2)]
                segmentation = pairs
                x_min, y_min, x_max, y_max = _bbox_from_polygon(pairs)

            anns.append({
                "class_name":   class_name,
                "x_min":        x_min,
                "y_min":        y_min,
                "x_max":        x_max,
                "y_max":        y_max,
                "segmentation": segmentation,
            })
        annotations_map[stem] = anns

    return annotations_map, warnings


# ── COCO Parser ───────────────────────────────────────────────────────────────

def _parse_coco(
    json_bytes: bytes,
    image_files: dict,   # {filename_no_ext: (filename, bytes)}  — keyed by full filename too
) -> tuple[dict, list]:
    """
    Returns:
      annotations_map : {image_filename_stem: [ {class_name, x_min, y_min, x_max, y_max, segmentation} ]}
      warnings        : [str]
    """
    data = json.loads(json_bytes.decode("utf-8"))
    warnings = []

    # Build lookup maps
    id_to_image = {img["id"]: img for img in data.get("images", [])}
    id_to_cat   = {cat["id"]: cat["name"] for cat in data.get("categories", [])}

    # Map COCO image filename → stem for our annotations_map key
    annotations_map: dict[str, list] = {}

    for ann in data.get("annotations", []):
        img_info = id_to_image.get(ann.get("image_id"))
        if not img_info:
            warnings.append(f"annotation id={ann.get('id')}: image_id not found — skipped")
            continue

        file_name = img_info["file_name"]
        stem = Path(file_name).stem
        img_w = img_info.get("width", 1)
        img_h = img_info.get("height", 1)

        # Check image exists in upload
        if file_name not in image_files and stem not in image_files:
            warnings.append(f"{file_name} referenced in JSON but not uploaded — annotations skipped")
            continue

        class_name = id_to_cat.get(ann.get("category_id"), "unknown")

        # Segmentation
        seg_raw = ann.get("segmentation")
        segmentation = None
        if seg_raw and isinstance(seg_raw, list) and len(seg_raw) > 0 and isinstance(seg_raw[0], list):
            flat = seg_raw[0]
            pairs = [[_clamp(flat[i] / img_w), _clamp(flat[i + 1] / img_h)]
                     for i in range(0, len(flat) - 1, 2)]
            segmentation = pairs

        # BBox
        bbox = ann.get("bbox")
        if segmentation:
            x_min, y_min, x_max, y_max = _bbox_from_polygon(segmentation)
        elif bbox and len(bbox) == 4:
            x, y, w, h = bbox
            x_min = _clamp(x / img_w)
            y_min = _clamp(y / img_h)
            x_max = _clamp((x + w) / img_w)
            y_max = _clamp((y + h) / img_h)
        else:
            warnings.append(f"annotation id={ann.get('id')}: no bbox or segmentation — skipped")
            continue

        if stem not in annotations_map:
            annotations_map[stem] = []
        annotations_map[stem].append({
            "class_name":   class_name,
            "x_min":        x_min,
            "y_min":        y_min,
            "x_max":        x_max,
            "y_max":        y_max,
            "segmentation": segmentation,
        })

    return annotations_map, warnings


# ── Main Endpoint ─────────────────────────────────────────────────────────────

@router.post("/datasets/import-with-labels")
async def import_with_labels(
    project_id: int = Form(...),
    name: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Import images with pre-existing label files (YOLO or COCO format).

    - Creates a new dataset batch under the project
    - Saves images to disk, creates Image records with MD5 hash
    - Parses label files and creates Annotation records
    - Creates new Label (class) records for unknown classes
    """
    try:
        # ── 1. Verify project ──────────────────────────────────────────────
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_name = project.name

        # ── 2. Read all uploaded files into memory ─────────────────────────
        image_files: dict[str, tuple[str, bytes]] = {}   # stem → (filename, bytes)
        label_txt:   dict[str, bytes] = {}               # stem → bytes
        yaml_bytes:  Optional[bytes]  = None
        json_bytes:  Optional[bytes]  = None

        all_filenames = []
        file_data: dict[str, tuple[str, bytes]] = {}     # filename → (filename, bytes)

        for upload in files:
            raw = await upload.read()
            fname = Path(upload.filename).name
            stem  = Path(fname).stem
            ext   = Path(fname).suffix.lower()
            all_filenames.append(fname.lower())
            file_data[fname] = (fname, raw)

            if ext in IMAGE_EXTENSIONS:
                image_files[stem] = (fname, raw)
            elif ext == ".txt" and fname.lower() != "data.yaml":
                label_txt[stem] = raw
            elif fname.lower() == "data.yaml" or (ext in (".yaml", ".yml") and "data" in fname.lower()):
                yaml_bytes = raw
            elif ext == ".json":
                json_bytes = raw

        # ── 3. Detect format ───────────────────────────────────────────────
        fmt = _detect_format(all_filenames)

        if fmt == "yolo_missing_yaml":
            raise HTTPException(
                status_code=400,
                detail="data.yaml is required for YOLO format but was not found. "
                       "Please include data.yaml with your class names."
            )
        if fmt == "no_labels":
            raise HTTPException(
                status_code=400,
                detail="No label files found. Include .txt + data.yaml (YOLO) or annotations.json (COCO)."
            )

        # ── 4. Create Dataset record ───────────────────────────────────────
        dataset = DatasetOperations.create_dataset(
            db=db,
            name=name,
            project_id=project_id,
            description=f"Imported with labels ({fmt.upper()})",
            auto_label_enabled=False,
        )

        # ── 5. Save images to disk + create Image records ──────────────────
        storage_dir = path_manager.get_image_storage_path(project_name, name, "unassigned")
        path_manager.ensure_directory_exists(storage_dir)

        saved_images: dict[str, str] = {}   # stem → image_id
        classes_created: list[str] = []
        classes_reused:  list[str] = []
        total_annotations = 0
        warnings: list[str] = []

        for stem, (fname, raw) in image_files.items():
            # Save file
            dest = storage_dir / fname
            # Avoid overwrite
            counter = 1
            while dest.exists():
                dest = storage_dir / f"{stem}_{counter}{Path(fname).suffix}"
                counter += 1
            dest.write_bytes(raw)

            # Get image dimensions
            try:
                with PILImage.open(io.BytesIO(raw)) as pil_img:
                    width, height = pil_img.size
                    fmt_name = (pil_img.format or "jpeg").lower()
            except Exception:
                width, height, fmt_name = None, None, "jpeg"

            rel_path = path_manager.get_relative_image_path(
                project_name, name, dest.name, "unassigned"
            )
            md5 = _md5(raw)

            image_rec = Image(
                filename=dest.name,
                original_filename=fname,
                file_path=rel_path,
                dataset_id=dataset.id,
                width=width,
                height=height,
                file_size=len(raw),
                format=fmt_name,
                split_type="unassigned",
                split_section="train",
                image_hash_md5=md5,
                is_labeled=False,
            )
            db.add(image_rec)
            db.flush()
            saved_images[stem] = image_rec.id

        db.commit()

        # ── 6. Parse labels ────────────────────────────────────────────────
        if fmt == "yolo":
            annotations_map, parse_warnings = _parse_yolo(
                image_files, label_txt, yaml_bytes,
                img_dims={}   # not needed — coords already normalized
            )
        else:  # coco
            annotations_map, parse_warnings = _parse_coco(json_bytes, image_files)

        warnings.extend(parse_warnings)

        # ── 7. Write Annotation records ────────────────────────────────────
        for stem, anns in annotations_map.items():
            image_id = saved_images.get(stem)
            if not image_id:
                warnings.append(f"Labels for '{stem}' found but image was not uploaded — skipped")
                continue

            for ann in anns:
                class_name = ann["class_name"]
                label_id, created = _get_or_create_label(db, project_id, class_name)
                if created:
                    if class_name not in classes_created:
                        classes_created.append(class_name)
                else:
                    if class_name not in classes_reused:
                        classes_reused.append(class_name)

                annotation = Annotation(
                    image_id=image_id,
                    class_name=class_name,
                    class_id=label_id,
                    x_min=ann["x_min"],
                    y_min=ann["y_min"],
                    x_max=ann["x_max"],
                    y_max=ann["y_max"],
                    confidence=1.0,
                    segmentation=ann["segmentation"],
                    is_auto_generated=False,
                )
                db.add(annotation)
                total_annotations += 1

            # Mark image as labeled
            img_rec = db.query(Image).filter(Image.id == image_id).first()
            if img_rec and anns:
                img_rec.is_labeled = True

        db.commit()

        logger.info("api.import_labels", f"Import complete: {len(saved_images)} images, {total_annotations} annotations", "import_complete", {
            "project_id": project_id,
            "dataset_id": dataset.id,
            "format": fmt,
            "images": len(saved_images),
            "annotations": total_annotations,
        })

        return {
            "dataset_id":       dataset.id,
            "format_detected":  fmt,
            "total_images":     len(saved_images),
            "total_annotations": total_annotations,
            "classes_created":  classes_created,
            "classes_reused":   classes_reused,
            "warnings":         warnings,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("api.import_labels", f"Import failed: {str(e)}", "import_error", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
