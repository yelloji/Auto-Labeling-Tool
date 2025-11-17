import os
import zipfile
from pathlib import Path
from typing import Optional, Tuple

from logging_system.professional_logger import get_professional_logger
from core.config import settings

logger = get_professional_logger()

try:
    from utils.path_utils import path_manager
except Exception:
    path_manager = None  # type: ignore


def _safe_slug(filename: str) -> str:
    base = Path(filename).stem
    return base.replace(" ", "_")


def compute_target_relative_path(zip_relative_path: str, project_name_hint: Optional[str] = None) -> Tuple[str, str]:
    ps = zip_relative_path.replace("\\", "/")
    parts = ps.split("/")
    project_name = project_name_hint
    try:
        if project_name is None:
            idx = parts.index("projects") if "projects" in parts else -1
            if idx >= 0 and len(parts) >= idx + 3 and parts[idx + 2] == "releases":
                project_name = parts[idx + 1]
    except Exception:
        pass
    if not project_name:
        raise ValueError("Unable to determine project name from zip path")
    slug = _safe_slug(parts[-1])
    rel_dir = f"projects/{project_name}/training_data/{slug}"
    return project_name, rel_dir


def get_absolute_paths(zip_relative_path: str, target_relative_dir: str) -> Tuple[Path, Path]:
    if path_manager:
        zip_abs = Path(path_manager.get_absolute_path(zip_relative_path))
        target_abs = Path(path_manager.get_absolute_path(target_relative_dir))
    else:
        base = Path(settings.BASE_DIR)
        zip_abs = (base / zip_relative_path).resolve()
        target_abs = (base / target_relative_dir).resolve()
    return zip_abs, target_abs


def is_extracted(zip_relative_path: str, project_name_hint: Optional[str] = None) -> Tuple[bool, str]:
    project_name, rel_dir = compute_target_relative_path(zip_relative_path, project_name_hint)
    _, target_abs = get_absolute_paths(zip_relative_path, rel_dir)
    exists = target_abs.exists() and any(target_abs.iterdir())
    logger.debug("operations.training", "Checked extraction status", "training_check_extracted", {
        "zip_path": zip_relative_path,
        "project_name": project_name,
        "target_dir": rel_dir,
        "exists": exists
    })
    return exists, rel_dir


def extract_release_zip(zip_relative_path: str, project_name_hint: Optional[str] = None) -> str:
    project_name, rel_dir = compute_target_relative_path(zip_relative_path, project_name_hint)
    zip_abs, target_abs = get_absolute_paths(zip_relative_path, rel_dir)

    if not zip_abs.exists():
        raise FileNotFoundError(f"ZIP not found: {zip_abs}")

    # Idempotent: if already extracted and not empty, skip
    if target_abs.exists() and any(target_abs.iterdir()):
        logger.info("operations.training", "Zip already extracted; skipping", "training_extract_skip", {
            "zip_path": zip_relative_path,
            "target_dir": rel_dir
        })
        return rel_dir

    target_abs.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(str(zip_abs), 'r') as zf:
        zf.extractall(str(target_abs))

    logger.info("operations.training", "Zip extracted successfully", "training_extract_success", {
        "zip_path": zip_relative_path,
        "target_dir": rel_dir,
        "project_name": project_name
    })
    return rel_dir