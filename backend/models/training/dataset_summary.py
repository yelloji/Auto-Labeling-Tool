from pathlib import Path
from typing import Dict, Any, Optional

import yaml

from logging_system.professional_logger import get_professional_logger
from core.config import settings

logger = get_professional_logger()


def _read_yaml(p: Path) -> Dict[str, Any]:
    with open(p, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _count_images(path: Path) -> int:
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    if path.is_dir():
        return sum(1 for fp in path.rglob("*") if fp.is_file() and fp.suffix.lower() in exts)
    if path.is_file():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return sum(1 for line in f if line.strip())
        except Exception:
            return 0
    return 0


def _resolve_path(base: Path, value: Optional[str]) -> Optional[Path]:
    if not value:
        return None
    p = Path(value)
    if not p.is_absolute():
        p = base / p
    return p


def summarize_dataset(data_yaml_path: Path) -> Dict[str, Any]:
    data_yaml = _read_yaml(data_yaml_path)
    base = data_yaml_path.parent
    train_p = _resolve_path(base, data_yaml.get("train"))
    val_p = _resolve_path(base, data_yaml.get("val"))
    test_p = _resolve_path(base, data_yaml.get("test"))
    names = data_yaml.get("names") or []
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names.keys(), key=lambda x: int(x) if str(x).isdigit() else x)]
    classes = list(names) if isinstance(names, list) else []
    nc = data_yaml.get("nc") or data_yaml.get("num_classes") or (len(classes) if classes else None)
    result = {
        "data_yaml_path": str(data_yaml_path),
        "classes": classes,
        "num_classes": nc,
        "splits": {
            "train": _count_images(train_p) if train_p else 0,
            "val": _count_images(val_p) if val_p else 0,
            "test": _count_images(test_p) if test_p else 0,
        },
    }
    logger.info("operations.training", "Summarized dataset", "training_dataset_summary", result)
    return result


def find_and_summarize(release_dir: Path) -> Dict[str, Any]:
    if not release_dir.is_absolute():
        release_dir = Path(settings.BASE_DIR) / release_dir
    matches = list(release_dir.rglob("data.yaml"))
    if not matches:
        raise FileNotFoundError("data.yaml not found in release directory")
    return summarize_dataset(matches[0])