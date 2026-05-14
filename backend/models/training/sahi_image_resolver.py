from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.config import settings
from database.models import Dataset, Image


VALID_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
DATASET_SPLITS = {"train", "val", "test"}
EXCLUDED_GENERATED_PATH_MARKERS = (
    "/releases/",
    "/model/",
    "/prediction_temp/",
    "/training_data/",
)


def _normalize_app_relative_path(path_value: str) -> str:
    normalized = str(path_value or "").replace("\\", "/").strip()
    while normalized.startswith("../") or normalized.startswith("./"):
        normalized = normalized[3:] if normalized.startswith("../") else normalized[2:]
    return normalized.lstrip("/")


def _to_absolute_path(path_value: str) -> Path:
    raw_path = Path(str(path_value or ""))
    if raw_path.is_absolute():
        return raw_path
    return settings.BASE_DIR / _normalize_app_relative_path(path_value)


def _to_relative_path(abs_path: Path, original_value: str) -> str:
    try:
        return abs_path.resolve().relative_to(settings.BASE_DIR.resolve()).as_posix()
    except Exception:
        return _normalize_app_relative_path(original_value)


def _is_supported_image_path(path_value: str) -> bool:
    return Path(path_value).suffix.lower() in VALID_IMAGE_EXTENSIONS


def _is_generated_or_non_dataset_path(path_value: str) -> bool:
    normalized = f"/{_normalize_app_relative_path(path_value).lower()}"
    return any(marker in normalized for marker in EXCLUDED_GENERATED_PATH_MARKERS)


def resolve_dataset_stage_images(db: Session, project_id: int) -> Dict[str, Any]:
    """
    Resolve full original images that are ready for release/training.

    SAHI must not use loose project uploads or tiled release outputs. The source of
    truth is the images table after split assignment: split_type='dataset' with a
    train/val/test split_section.
    """
    rows = (
        db.query(Image, Dataset)
        .join(Dataset, Image.dataset_id == Dataset.id)
        .filter(
            Dataset.project_id == project_id,
            Image.split_type == "dataset",
            Image.split_section.in_(DATASET_SPLITS),
        )
        .order_by(Image.split_section, Dataset.name, Image.filename)
        .all()
    )

    images: List[str] = []
    items: List[Dict[str, Any]] = []
    skipped: List[Dict[str, str]] = []
    split_counts = {"train": 0, "val": 0, "test": 0}
    seen_paths = set()

    for image, dataset in rows:
        source_path = image.file_path or ""
        split_section = image.split_section or "train"

        if split_section not in DATASET_SPLITS:
            skipped.append({"image_id": image.id, "reason": "invalid_split_section", "path": source_path})
            continue
        if not _is_supported_image_path(source_path):
            skipped.append({"image_id": image.id, "reason": "unsupported_extension", "path": source_path})
            continue
        if _is_generated_or_non_dataset_path(source_path):
            skipped.append({"image_id": image.id, "reason": "generated_or_non_dataset_path", "path": source_path})
            continue

        abs_path = _to_absolute_path(source_path)
        if not abs_path.exists() or not abs_path.is_file():
            skipped.append({"image_id": image.id, "reason": "missing_file", "path": source_path})
            continue

        dedupe_key = abs_path.resolve().as_posix().lower()
        if dedupe_key in seen_paths:
            skipped.append({"image_id": image.id, "reason": "duplicate_path", "path": source_path})
            continue
        seen_paths.add(dedupe_key)

        absolute_path = abs_path.resolve().as_posix()
        relative_path = _to_relative_path(abs_path, source_path)
        images.append(absolute_path)
        split_counts[split_section] += 1
        items.append({
            "image_id": image.id,
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "filename": image.filename,
            "original_filename": image.original_filename,
            "split_section": split_section,
            "relative_path": relative_path,
            "absolute_path": absolute_path,
            "width": image.width,
            "height": image.height,
        })

    return {
        "source": "dataset_images",
        "images": images,
        "items": items,
        "count": len(images),
        "split_counts": split_counts,
        "skipped": skipped,
    }


def resolve_uploaded_images(uploaded_images: Optional[List[str]]) -> Dict[str, Any]:
    images: List[str] = []
    items: List[Dict[str, Any]] = []
    skipped: List[Dict[str, str]] = []
    seen_paths = set()

    for source_path in uploaded_images or []:
        if not _is_supported_image_path(source_path):
            skipped.append({"reason": "unsupported_extension", "path": source_path})
            continue

        abs_path = _to_absolute_path(source_path)
        if not abs_path.exists() or not abs_path.is_file():
            skipped.append({"reason": "missing_file", "path": source_path})
            continue

        dedupe_key = abs_path.resolve().as_posix().lower()
        if dedupe_key in seen_paths:
            skipped.append({"reason": "duplicate_path", "path": source_path})
            continue
        seen_paths.add(dedupe_key)

        absolute_path = abs_path.resolve().as_posix()
        relative_path = _to_relative_path(abs_path, source_path)
        images.append(absolute_path)
        items.append({
            "filename": abs_path.name,
            "split_section": "upload",
            "relative_path": relative_path,
            "absolute_path": absolute_path,
        })

    return {
        "source": "upload",
        "images": images,
        "items": items,
        "count": len(images),
        "split_counts": {"upload": len(images)},
        "skipped": skipped,
    }


def resolve_sahi_input_images(
    db: Session,
    project_id: int,
    dataset_source: str,
    uploaded_images: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if dataset_source == "dataset_images":
        return resolve_dataset_stage_images(db, project_id)
    if dataset_source == "upload":
        return resolve_uploaded_images(uploaded_images)
    raise ValueError("SAHI prediction source must be 'dataset_images' or 'upload'")
