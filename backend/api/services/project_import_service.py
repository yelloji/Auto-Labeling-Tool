"""
Full project import service.

Restores project export packages created by project_export_service.py.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple, Type

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.sql.sqltypes import DateTime as SQLAlchemyDateTime

from core.config import settings
from database.models import (
    AiModel,
    Annotation,
    AutoLabelJob,
    Dataset,
    DatasetSplit,
    HumanVerification,
    Image,
    ImageTransformation,
    ImageVariant,
    Label,
    LabelAnalytics,
    ModelExperiment,
    Project,
    Release,
    TrainingSession,
)
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


SUPPORTED_FORMAT_VERSION = "1.0"


class ProjectImportError(Exception):
    """Raised when a project import package is invalid or cannot be restored."""


def _load_json_from_zip(zip_file: zipfile.ZipFile, name: str) -> Dict[str, Any]:
    try:
        with zip_file.open(name) as handle:
            return json.loads(handle.read().decode("utf-8"))
    except KeyError as exc:
        raise ProjectImportError(f"Missing required file in export package: {name}") from exc
    except json.JSONDecodeError as exc:
        raise ProjectImportError(f"Invalid JSON in export package: {name}") from exc


def _safe_folder_name(name: str) -> str:
    cleaned = "".join(ch if ch not in '<>:"/\\|?*' else "_" for ch in name.strip())
    return cleaned.strip(" .") or "Imported Project"


def _project_folder(name: str) -> Path:
    return Path(settings.PROJECTS_DIR) / name


def _next_safe_project_id(db: Session) -> int:
    """
    Avoid reusing a deleted project id that is still referenced by legacy rows.

    Some older tables do not have a strict project FK, so deleting a project can
    leave rows like training_sessions.project_id behind. SQLite may then reuse
    that project id unless we assign a safe id ourselves.
    """
    max_ids = [db.query(func.max(Project.id)).scalar() or 0]
    for model in (Dataset, Label, Release, TrainingSession, ModelExperiment, HumanVerification):
        if "project_id" not in model.__table__.columns:
            continue
        max_ids.append(db.query(func.max(model.__table__.c.project_id)).scalar() or 0)
    return int(max(max_ids)) + 1


def _snapshot_tables(snapshot: Dict[str, Any]) -> Dict[str, list]:
    tables = snapshot.get("tables")
    if not isinstance(tables, dict):
        raise ProjectImportError("database_snapshot.json does not contain a valid tables object")
    return tables


def validate_project_import_package(package_path: Path, db: Optional[Session] = None) -> Dict[str, Any]:
    """Validate the export package and return a summary safe for UI display."""
    if not package_path.exists():
        raise ProjectImportError("Import package file does not exist")

    if not zipfile.is_zipfile(package_path):
        raise ProjectImportError("Import package must be a valid ZIP file")

    with zipfile.ZipFile(package_path, "r") as zip_file:
        manifest = _load_json_from_zip(zip_file, "manifest.json")
        snapshot = _load_json_from_zip(zip_file, "database_snapshot.json")

        format_version = manifest.get("format_version") or snapshot.get("format_version")
        if format_version != SUPPORTED_FORMAT_VERSION:
            raise ProjectImportError(
                f"Unsupported project export format: {format_version}. Expected {SUPPORTED_FORMAT_VERSION}"
            )

        project_info = manifest.get("project") or snapshot.get("project") or {}
        project_name = project_info.get("name")
        project_files_root = manifest.get("package", {}).get("project_files_root")
        if not project_name or not project_files_root:
            raise ProjectImportError("Export package is missing project metadata")

        files_prefix = project_files_root.rstrip("/") + "/"
        project_file_count = sum(1 for name in zip_file.namelist() if name.startswith(files_prefix) and not name.endswith("/"))
        if project_file_count == 0:
            raise ProjectImportError(f"Export package does not contain project files under {project_files_root}")

        counts = snapshot.get("counts") or {
            table_name: len(rows) for table_name, rows in _snapshot_tables(snapshot).items()
        }
        name_exists = False
        if db is not None:
            name_exists = db.query(Project).filter(Project.name == project_name).first() is not None

        return {
            "valid": True,
            "format_version": format_version,
            "project": project_info,
            "project_name": project_name,
            "project_file_count": project_file_count,
            "database_counts": counts,
            "name_conflict": name_exists,
        }


def _parse_datetime(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value


def _coerce_row_for_model(model: Type[Any], row: Dict[str, Any]) -> Dict[str, Any]:
    columns = {column.name: column for column in model.__table__.columns}
    cleaned: Dict[str, Any] = {}
    for key, value in row.items():
        column = columns.get(key)
        if column is None:
            continue
        if isinstance(column.type, SQLAlchemyDateTime):
            value = _parse_datetime(value)
        cleaned[key] = value
    return cleaned


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _rewrite_path(value: str, old_project_name: str, new_project_name: str) -> str:
    if old_project_name == new_project_name:
        return value
    return (
        value
        .replace(f"projects/{old_project_name}/", f"projects/{new_project_name}/")
        .replace(f"projects\\{old_project_name}\\", f"projects\\{new_project_name}\\")
        .replace(f"/{old_project_name}/", f"/{new_project_name}/")
        .replace(f"\\{old_project_name}\\", f"\\{new_project_name}\\")
    )


def _rewrite_value(value: Any, old_project_name: str, new_project_name: str, id_maps: Dict[str, Dict[Any, Any]]) -> Any:
    if isinstance(value, dict):
        return {
            key: _rewrite_value(item, old_project_name, new_project_name, id_maps)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_rewrite_value(item, old_project_name, new_project_name, id_maps) for item in value]
    if isinstance(value, str):
        for id_map in id_maps.values():
            if value in id_map:
                return id_map[value]
        return _rewrite_path(value, old_project_name, new_project_name)
    return value


def _json_safe_id_maps(id_maps: Dict[str, Dict[Any, Any]]) -> Dict[str, Dict[Any, Any]]:
    """Keep recursive remapping away from normal numeric fields like class counts."""
    return {
        name: id_map
        for name, id_map in id_maps.items()
        if name in {"datasets", "images", "ai_models", "releases", "model_experiments"}
    }


def _copy_project_files(
    package_path: Path,
    manifest: Dict[str, Any],
    target_project_name: str,
    staging_dir: Path,
) -> Tuple[Path, Path]:
    project_files_root = manifest["package"]["project_files_root"].rstrip("/")
    staged_project_dir = staging_dir / target_project_name
    staged_project_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(package_path, "r") as zip_file:
        prefix = project_files_root + "/"
        for member in zip_file.infolist():
            if member.is_dir() or not member.filename.startswith(prefix):
                continue
            relative_name = member.filename[len(prefix):]
            if not relative_name:
                continue
            target_path = staged_project_dir / Path(relative_name)
            if any(part.startswith(".staging_") for part in target_path.relative_to(staged_project_dir).parts):
                continue
            os.makedirs(_windows_long_path(target_path.parent), exist_ok=True)
            with zip_file.open(member) as source, open(_windows_long_path(target_path), "wb") as destination:
                shutil.copyfileobj(source, destination)

    final_project_dir = _project_folder(target_project_name)
    if final_project_dir.exists():
        raise ProjectImportError(f"Project folder already exists: {final_project_dir}")
    shutil.move(str(staged_project_dir), str(final_project_dir))
    return final_project_dir, staged_project_dir


def _windows_long_path(path: Path) -> str:
    """Allow extraction of deep project model/prediction folders on Windows."""
    resolved = str(path.resolve())
    if os.name == "nt" and not resolved.startswith("\\\\?\\"):
        return "\\\\?\\" + resolved
    return resolved


def _make_instance(model: Type[Any], row: Dict[str, Any]) -> Any:
    return model(**_coerce_row_for_model(model, row))


def _rows(rows: Iterable[Dict[str, Any]]) -> list:
    return list(rows or [])


def _apply_project_tables_with_new_ids(
    db: Session,
    tables: Dict[str, list],
    target_project_name: str,
) -> Dict[str, Any]:
    """
    Create every database row for one imported or duplicated project, giving
    each row a brand new id and rewriting every reference to the old ids and
    the old project name to match. Commits as one transaction and returns the
    new Project plus the full id_maps; raises on any failure and leaves the
    transaction uncommitted, so the caller decides how to roll back and what
    copied files to remove - this function never touches the filesystem.

    Shared by import (fed rows parsed from an export's JSON snapshot) and
    duplicate (fed rows read live from this database): one tested
    implementation of the remapping, used by both, instead of two.
    """
    project_rows = _rows(tables.get("projects"))
    if len(project_rows) != 1:
        raise ProjectImportError("Expected exactly one project row to apply")

    old_project_row = project_rows[0]
    old_project_id = old_project_row["id"]
    old_project_name = old_project_row["name"]

    id_maps: Dict[str, Dict[Any, Any]] = {
        "projects": {},
        "datasets": {},
        "images": {},
        "labels": {},
        "ai_models": {},
        "releases": {},
        "training_sessions": {},
        "model_experiments": {},
    }
    safe_id_maps = _json_safe_id_maps(id_maps)

    try:
        project_data = dict(old_project_row)
        project_data["id"] = _next_safe_project_id(db)
        project_data["name"] = target_project_name
        project = _make_instance(Project, project_data)
        db.add(project)
        db.flush()
        id_maps["projects"][old_project_id] = project.id
        id_maps["projects"][str(old_project_id)] = project.id

        for row in _rows(tables.get("datasets")):
            old_id = row["id"]
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["project_id"] = project.id
            db.add(_make_instance(Dataset, data))
            id_maps["datasets"][old_id] = data["id"]
            id_maps["datasets"][str(old_id)] = data["id"]

        for row in _rows(tables.get("labels")):
            old_id = row["id"]
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data.pop("id", None)
            data["project_id"] = project.id
            label = _make_instance(Label, data)
            db.add(label)
            db.flush()
            id_maps["labels"][old_id] = label.id
            id_maps["labels"][str(old_id)] = label.id

        for row in _rows(tables.get("releases")):
            old_id = row["id"]
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["project_id"] = project.id
            db.add(_make_instance(Release, data))
            id_maps["releases"][old_id] = data["id"]
            id_maps["releases"][str(old_id)] = data["id"]

        for row in _rows(tables.get("training_sessions")):
            old_id = row["id"]
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data.pop("id", None)
            if data.get("training_uid"):
                data["training_uid"] = f"{data['training_uid']}_import_{uuid.uuid4().hex[:8]}"
            data["project_id"] = project.id
            data["project_name"] = target_project_name
            session = _make_instance(TrainingSession, data)
            db.add(session)
            db.flush()
            id_maps["training_sessions"][old_id] = session.id
            id_maps["training_sessions"][str(old_id)] = session.id

        for row in _rows(tables.get("ai_models")):
            old_id = row["id"]
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            if data.get("project_id") is not None:
                data["project_id"] = project.id
            db.add(_make_instance(AiModel, data))
            id_maps["ai_models"][old_id] = data["id"]
            id_maps["ai_models"][str(old_id)] = data["id"]

        db.flush()
        for session in db.query(TrainingSession).filter(TrainingSession.project_id == project.id).all():
            if session.base_model_id in id_maps["ai_models"]:
                session.base_model_id = id_maps["ai_models"][session.base_model_id]

        for row in _rows(tables.get("images")):
            old_id = row["id"]
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["dataset_id"] = id_maps["datasets"][row["dataset_id"]]
            db.add(_make_instance(Image, data))
            id_maps["images"][old_id] = data["id"]
            id_maps["images"][str(old_id)] = data["id"]

        for row in _rows(tables.get("annotations")):
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["image_id"] = id_maps["images"][row["image_id"]]
            if row.get("class_id") in id_maps["labels"]:
                data["class_id"] = id_maps["labels"][row["class_id"]]
            if row.get("model_id") in id_maps["ai_models"]:
                data["model_id"] = id_maps["ai_models"][row["model_id"]]
            db.add(_make_instance(Annotation, data))

        for row in _rows(tables.get("dataset_splits")):
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["dataset_id"] = id_maps["datasets"][row["dataset_id"]]
            db.add(_make_instance(DatasetSplit, data))

        for row in _rows(tables.get("label_analytics")):
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["dataset_id"] = id_maps["datasets"][row["dataset_id"]]
            db.add(_make_instance(LabelAnalytics, data))

        for row in _rows(tables.get("image_transformations")):
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            if row.get("release_id") in id_maps["releases"]:
                data["release_id"] = id_maps["releases"][row["release_id"]]
            db.add(_make_instance(ImageTransformation, data))

        for row in _rows(tables.get("model_experiments")):
            old_id = row["id"]
            old_training_id = row["training_id"]
            new_training_id = id_maps["training_sessions"].get(old_training_id)
            if new_training_id is None:
                # training_id is NOT NULL, so an experiment whose training
                # session no longer exists (deleted earlier, without its
                # experiments being cleaned up alongside it) has nothing valid
                # to point at. Rather than fail the whole import/duplicate over
                # data that was already broken before this ran, the experiment
                # itself - already meaningless without a training to explain it
                # - is left out, and everything else proceeds normally.
                logger.warning(
                    "errors.system",
                    f"Skipping experiment {old_id!r}: its training session "
                    f"{old_training_id!r} no longer exists in the source project",
                    "project_apply_orphaned_experiment_skipped",
                    {"experiment_id": old_id, "missing_training_id": old_training_id},
                )
                continue
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["project_id"] = project.id
            data["project_name"] = target_project_name
            data["training_id"] = new_training_id
            db.add(_make_instance(ModelExperiment, data))
            id_maps["model_experiments"][old_id] = data["id"]
            id_maps["model_experiments"][str(old_id)] = data["id"]

        for row in _rows(tables.get("human_verifications")):
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["project_id"] = project.id
            if row.get("experiment_id") in id_maps["model_experiments"]:
                data["experiment_id"] = id_maps["model_experiments"][row["experiment_id"]]
            db.add(_make_instance(HumanVerification, data))

        for row in _rows(tables.get("auto_label_jobs")):
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data["id"] = _new_uuid()
            data["dataset_id"] = id_maps["datasets"][row["dataset_id"]]
            if row.get("model_id") in id_maps["ai_models"]:
                data["model_id"] = id_maps["ai_models"][row["model_id"]]
            db.add(_make_instance(AutoLabelJob, data))

        for row in _rows(tables.get("image_variants")):
            old_parent = row.get("parent_image_id")
            data = _rewrite_value(dict(row), old_project_name, target_project_name, safe_id_maps)
            data.pop("id", None)
            if old_parent in id_maps["images"]:
                data["parent_image_id"] = id_maps["images"][old_parent]
            elif str(old_parent) in id_maps["images"]:
                data["parent_image_id"] = id_maps["images"][str(old_parent)]
            db.add(_make_instance(ImageVariant, data))

        db.commit()
        return {"project": project, "id_maps": id_maps}
    except Exception:
        db.rollback()
        raise


def _relink_cache_after_apply(target_project_name: str, id_maps: Dict[str, Dict[Any, Any]]) -> None:
    """Point cached overlay folders at the new experiment ids. Never allowed to
    affect the caller's result: the database rows have already committed by
    the time this runs, and any experiment left unrelinked simply rebuilds its
    cache on first open, same as it always could."""
    try:
        from utils.project_cache import relink_overlay_cache_ids
        relink_overlay_cache_ids(target_project_name, id_maps["model_experiments"])
    except Exception:
        pass


def import_project_package(db: Session, package_path: Path, new_project_name: Optional[str] = None) -> Dict[str, Any]:
    """Import a project package into the current app installation."""
    with zipfile.ZipFile(package_path, "r") as zip_file:
        manifest = _load_json_from_zip(zip_file, "manifest.json")
        snapshot = _load_json_from_zip(zip_file, "database_snapshot.json")

    validate_project_import_package(package_path, db)

    tables = _snapshot_tables(snapshot)
    project_rows = _rows(tables.get("projects"))
    if len(project_rows) != 1:
        raise ProjectImportError("Export package must contain exactly one project row")

    old_project_name = project_rows[0]["name"]
    target_project_name = _safe_folder_name(new_project_name or old_project_name)

    if db.query(Project).filter(Project.name == target_project_name).first():
        raise ProjectImportError(f'Project name already exists: "{target_project_name}". Please choose a new name.')
    if _project_folder(target_project_name).exists():
        raise ProjectImportError(f'Project folder already exists for "{target_project_name}". Please choose a new name.')

    staging_dir = Path(tempfile.mkdtemp(prefix="project_import_", dir=Path(settings.TEMP_DIR)))
    final_project_dir: Optional[Path] = None

    try:
        final_project_dir, _ = _copy_project_files(package_path, manifest, target_project_name, staging_dir)

        result = _apply_project_tables_with_new_ids(db, tables, target_project_name)
        project, id_maps = result["project"], result["id_maps"]

        _relink_cache_after_apply(target_project_name, id_maps)

        return {
            "success": True,
            "project_id": project.id,
            "project_name": project.name,
            "project_folder": str(final_project_dir),
            "counts": snapshot.get("counts", {}),
        }
    except Exception:
        if final_project_dir and final_project_dir.exists():
            shutil.rmtree(final_project_dir, ignore_errors=True)
        raise
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)
