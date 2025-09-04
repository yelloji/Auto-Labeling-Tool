"""Release ZIP statistics worker
Parses a release ZIP package once, derives cached statistics and updates the `releases` table.
This file is imported *lazily* by release_controller so it has **zero runtime cost** unless a ZIP was just built.
"""
from __future__ import annotations

import json
import logging
import threading
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple

import yaml  # new dependency for reading data.yaml
from sqlalchemy.orm import Session

# Local imports are placed here (runtime-safe):
from database.database import get_db
from database.models import Release

logger = logging.getLogger("release_stats_worker")

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def _scan_zip(path: Path) -> Tuple[int, int, int, List[str]]:
    """Return (train, val, test, classes) from the given ZIP file."""
    train = val = test = 0
    classes: List[str] = []

    try:
        with zipfile.ZipFile(path, "r") as zf:
            names = zf.namelist()

            # Fast path – if metadata/dataset_stats.json exists we trust it
            if "metadata/dataset_stats.json" in names:
                with zf.open("metadata/dataset_stats.json") as f:
                    meta = json.load(f)
                    sc = meta.get("split_counts", {})
                    train = sc.get("train", 0)
                    val = sc.get("val", 0)
                    test = sc.get("test", 0)
                    cd = meta.get("class_distribution", {})
                    classes = list(cd.keys())
                    return train, val, test, classes

            # Check for YOLO data.yaml at the root (same level as images/ labels/)
            if "data.yaml" in names:
                try:
                    with zf.open("data.yaml") as f:
                        data_cfg = yaml.safe_load(f)
                        yolo_names = data_cfg.get("names")
                        if isinstance(yolo_names, dict):
                            # {0:"person",1:"car",...} → order by key
                            yolo_names = [yolo_names[k] for k in sorted(yolo_names, key=lambda x: int(x))]
                        if isinstance(yolo_names, list):
                            classes = list(map(str, yolo_names))
                            return train, val, test, classes
                except Exception as e:
                    logger.warning("Failed to parse data.yaml in %s: %s", path, e)

            # Otherwise iterate over members
            for n in names:
                p = Path(n)
                parts = p.parts
                # --- image split counting (robust to extra root folder) ---
                if "images" in parts and p.suffix.lower() in _IMAGE_EXTS:
                    try:
                        img_idx = parts.index("images")
                        if len(parts) > img_idx + 2:  # images/<split>/<file>
                            split = parts[img_idx + 1]
                            if split == "train":
                                train += 1
                            elif split == "val":
                                val += 1
                            elif split == "test":
                                test += 1
                    except ValueError:
                        pass  # "images" not found – shouldn't happen

                # --- YOLO class extraction (robust to extra root folder) ---
                if "labels" in parts and p.suffix == ".txt":
                    try:
                        lbl_idx = parts.index("labels")
                        # labels/<split>/<file>.txt or labels/<file>.txt – both fine
                    except ValueError:
                        lbl_idx = None
                    with zf.open(n) as f:
                        for line in f:
                            try:
                                cls_idx = int(line.decode().strip().split()[0])
                                classes.append(str(cls_idx))
                            except Exception:
                                continue
            classes = sorted(set(classes))
    except Exception as e:
        logger.error("Failed to scan zip %s: %s", path, e)
    return train, val, test, classes


def scan_zip_and_update_stats(release_id: str):
    """Worker body – safe to call from any thread."""
    try:
        db: Session = next(get_db())
        rel: Release | None = db.query(Release).filter(Release.id == release_id).first()
        if not rel or not rel.model_path:
            logger.warning("Release %s not found or has no model_path", release_id)
            return
        path = Path(rel.model_path)
        if not path.exists():
            logger.warning("Model path %s does not exist for release %s", path, release_id)
            return

        train, val, test, classes = _scan_zip(path)
        rel.train_image_count = train
        rel.val_image_count = val
        rel.test_image_count = test
        rel.class_count = len(classes)
        rel.classes_json = classes
        # shapes_json left empty for now – future improvement
        db.commit()
        logger.info("Updated stats for release %s – train:%d val:%d test:%d classes:%d", release_id, train, val, test, len(classes))
    except Exception as e:
        logger.exception("Zip stats worker failed for %s: %s", release_id, e)


def schedule_zip_stats_update(release_id: str):
    """Fire-and-forget helper – spawns a daemon thread."""
    t = threading.Thread(target=scan_zip_and_update_stats, args=(release_id,), daemon=True)
    t.start()