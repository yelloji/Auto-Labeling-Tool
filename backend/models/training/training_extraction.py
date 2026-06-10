import os
import shutil
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


def _winlong(path_str: str) -> str:
    """
    Return a Windows extended-length path (\\\\?\\ prefix) to bypass the 260-char
    MAX_PATH limit. On non-Windows, returns the path unchanged.
    """
    if os.name != "nt":
        return path_str
    abs_path = os.path.abspath(path_str)
    if abs_path.startswith("\\\\?\\"):
        return abs_path
    if abs_path.startswith("\\\\"):  # UNC share \\server\share
        return "\\\\?\\UNC\\" + abs_path[2:]
    return "\\\\?\\" + abs_path


def _extract_zip_no_path_limit(zf: zipfile.ZipFile, target_abs: Path) -> None:
    """
    Extract every file in the zip, writing through long-path-safe targets so a
    single over-260-char filename cannot abort the whole extraction (Windows).
    Includes a zip-slip guard so entries can't escape target_abs.
    """
    base = os.path.abspath(str(target_abs))
    for member in zf.infolist():
        name = member.filename
        if not name or name.endswith("/"):
            continue  # directory entry
        rel = name.replace("/", os.sep).replace("\\", os.sep)
        dest = os.path.normpath(os.path.join(base, rel))
        # zip-slip guard: dest must stay inside base
        if not (dest == base or dest.startswith(base + os.sep)):
            logger.warning("operations.training", f"Skipping unsafe zip entry: {name}", "training_extract_unsafe_entry", {"entry": name})
            continue
        os.makedirs(_winlong(os.path.dirname(dest)), exist_ok=True)
        with zf.open(member) as src, open(_winlong(dest), "wb") as dst:
            shutil.copyfileobj(src, dst)


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

    # Number of real files in the ZIP (exclude directory entries)
    with zipfile.ZipFile(str(zip_abs), 'r') as zf:
        zip_file_count = sum(1 for n in zf.namelist() if not n.endswith('/'))

    # Idempotent ONLY when the existing extraction is COMPLETE.
    # A release that was deleted and recreated with the SAME name can leave a
    # stale/incomplete folder behind. Blindly skipping would train on the old
    # data (e.g. missing val/labels). So we compare file counts and re-extract
    # if the folder doesn't fully match the ZIP.
    if target_abs.exists() and any(target_abs.iterdir()):
        extracted_count = sum(1 for fp in target_abs.rglob("*") if fp.is_file())
        # Complete when no files are missing. Extra files are fine (e.g. YOLO
        # writes labels/*.cache after training), so use >= not ==.
        if extracted_count >= zip_file_count:
            logger.info("operations.training", "Zip already extracted (complete); skipping", "training_extract_skip", {
                "zip_path": zip_relative_path,
                "target_dir": rel_dir,
                "file_count": extracted_count,
            })
            return rel_dir
        logger.warning("operations.training", "Existing extraction is stale/incomplete; re-extracting", "training_extract_stale", {
            "zip_path": zip_relative_path,
            "target_dir": rel_dir,
            "extracted_count": extracted_count,
            "zip_file_count": zip_file_count,
        })
        shutil.rmtree(_winlong(str(target_abs)), ignore_errors=True)

    target_abs.mkdir(parents=True, exist_ok=True)

    # Long-path-safe extraction: a single >260-char filename must not abort the
    # whole extraction on Windows (that left releases with missing val/labels).
    with zipfile.ZipFile(str(zip_abs), 'r') as zf:
        _extract_zip_no_path_limit(zf, target_abs)

    # Auto-fix data.yaml path to be project-relative
    # This ensures YOLO can find the dataset regardless of where the command is run from
    try:
        data_yaml_path = target_abs / "data.yaml"
        if data_yaml_path.exists():
            import yaml
            
            # Read existing YAML
            with open(data_yaml_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
            
            # Update 'path' to be the project-relative directory
            # rel_dir is like "projects/gevis/training_data/slug"
            # This matches what we want because executor runs with cwd=project_root
            old_path = data.get('path')
            data['path'] = rel_dir
            
            # Write back
            with open(data_yaml_path, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, sort_keys=False, default_flow_style=None)
                
            logger.info("operations.training", "Auto-updated data.yaml path", "data_yaml_update", {
                "file": str(data_yaml_path),
                "old_path": old_path,
                "new_path": rel_dir
            })
    except Exception as e:
        logger.error("operations.training", "Failed to auto-update data.yaml path", "data_yaml_update_error", {
            "error": str(e),
            "target_dir": str(target_abs)
        })

    logger.info("operations.training", "Zip extracted successfully", "training_extract_success", {
        "zip_path": zip_relative_path,
        "target_dir": rel_dir,
        "project_name": project_name
    })
    return rel_dir