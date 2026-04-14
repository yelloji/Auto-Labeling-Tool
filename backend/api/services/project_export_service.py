"""
Full project export service.

Creates a portable project package containing:
- manifest.json
- database_snapshot.json
- files/<project folder>/
"""

from __future__ import annotations

import json
import tempfile
import uuid
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List

from sqlalchemy import cast, String
from sqlalchemy.orm import Session

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


EXPORT_FORMAT_VERSION = "1.0"


class ProjectExportError(Exception):
    """Raised when a project export cannot be created safely."""


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _row_to_dict(row: Any) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        if isinstance(value, (datetime, date)):
            value = value.isoformat()
        data[column.name] = value
    return data


def _rows_to_dicts(rows: Iterable[Any]) -> List[Dict[str, Any]]:
    return [_row_to_dict(row) for row in rows]


def _safe_export_name(project_name: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in project_name.strip())
    return safe.strip("_") or "project"


def _project_folder(project_name: str) -> Path:
    return Path(settings.PROJECTS_DIR) / project_name


def _collect_snapshot(db: Session, project: Project) -> Dict[str, Any]:
    datasets = db.query(Dataset).filter(Dataset.project_id == project.id).order_by(Dataset.name).all()
    dataset_ids = [dataset.id for dataset in datasets]

    images = (
        db.query(Image)
        .filter(Image.dataset_id.in_(dataset_ids))
        .order_by(Image.filename)
        .all()
        if dataset_ids
        else []
    )
    image_ids = [image.id for image in images]

    annotations = (
        db.query(Annotation)
        .filter(Annotation.image_id.in_(image_ids))
        .order_by(Annotation.image_id, Annotation.id)
        .all()
        if image_ids
        else []
    )

    labels = db.query(Label).filter(Label.project_id == project.id).order_by(Label.id).all()

    dataset_splits = (
        db.query(DatasetSplit)
        .filter(DatasetSplit.dataset_id.in_(dataset_ids))
        .order_by(DatasetSplit.dataset_id)
        .all()
        if dataset_ids
        else []
    )

    label_analytics = (
        db.query(LabelAnalytics)
        .filter(LabelAnalytics.dataset_id.in_(dataset_ids))
        .order_by(LabelAnalytics.dataset_id)
        .all()
        if dataset_ids
        else []
    )

    releases = db.query(Release).filter(Release.project_id == project.id).order_by(Release.created_at).all()
    release_ids = [release.id for release in releases]
    release_names = [release.name for release in releases]

    image_transformations = []
    if release_ids or release_names:
        image_transformations = (
            db.query(ImageTransformation)
            .filter(
                (ImageTransformation.release_id.in_(release_ids) if release_ids else False)
                | (ImageTransformation.release_version.in_(release_names) if release_names else False)
            )
            .order_by(ImageTransformation.release_version, ImageTransformation.order_index)
            .all()
        )

    training_sessions = (
        db.query(TrainingSession)
        .filter(TrainingSession.project_id == project.id)
        .order_by(TrainingSession.created_at)
        .all()
    )
    training_ids = [session.id for session in training_sessions]

    model_experiments = (
        db.query(ModelExperiment)
        .filter(ModelExperiment.project_id == project.id)
        .order_by(ModelExperiment.created_at)
        .all()
    )
    experiment_ids = [experiment.id for experiment in model_experiments]

    human_verifications_query = db.query(HumanVerification).filter(HumanVerification.project_id == project.id)
    if experiment_ids:
        human_verifications_query = human_verifications_query.union(
            db.query(HumanVerification).filter(HumanVerification.experiment_id.in_(experiment_ids))
        )
    human_verifications = human_verifications_query.order_by(HumanVerification.created_at).all()

    auto_label_jobs = (
        db.query(AutoLabelJob)
        .filter(AutoLabelJob.dataset_id.in_(dataset_ids))
        .order_by(AutoLabelJob.created_at)
        .all()
        if dataset_ids
        else []
    )

    image_variants = (
        db.query(ImageVariant)
        .filter(cast(ImageVariant.parent_image_id, String).in_([str(image_id) for image_id in image_ids]))
        .order_by(ImageVariant.id)
        .all()
        if image_ids
        else []
    )

    project_model_ids = {annotation.model_id for annotation in annotations if annotation.model_id}
    project_model_ids.update(job.model_id for job in auto_label_jobs if job.model_id)
    project_model_ids.update(session.base_model_id for session in training_sessions if session.base_model_id)

    ai_models_query = db.query(AiModel).filter(
        (AiModel.project_id == project.id)
        | (AiModel.training_session_id.in_([str(tid) for tid in training_ids]) if training_ids else False)
    )
    if project_model_ids:
        ai_models_query = ai_models_query.union(db.query(AiModel).filter(AiModel.id.in_(project_model_ids)))
    ai_models = ai_models_query.order_by(AiModel.name).all()

    exportable_ai_models = []
    global_ai_model_references = []
    project_root = str(Path(settings.PROJECTS_DIR).resolve()).replace("\\", "/").lower()
    selected_project_path = str(_project_folder(project.name).resolve()).replace("\\", "/").lower()
    for model in ai_models:
        file_path = str(model.file_path or "").replace("\\", "/").lower()
        is_project_owned = model.project_id == project.id or str(model.training_session_id or "") in {
            str(tid) for tid in training_ids
        }
        is_inside_project = selected_project_path in file_path or f"projects/{project.name.lower()}" in file_path
        is_global_default = model.project_id is None and str(model.source_type or "").lower() == "default"
        is_app_global_path = file_path and project_root not in file_path and not is_inside_project

        if is_global_default or (model.project_id is None and is_app_global_path):
            global_ai_model_references.append(_row_to_dict(model))
        elif is_project_owned or is_inside_project:
            exportable_ai_models.append(model)
        else:
            global_ai_model_references.append(_row_to_dict(model))

    tables = {
        "projects": [_row_to_dict(project)],
        "datasets": _rows_to_dicts(datasets),
        "labels": _rows_to_dicts(labels),
        "ai_models": _rows_to_dicts(exportable_ai_models),
        "images": _rows_to_dicts(images),
        "annotations": _rows_to_dicts(annotations),
        "dataset_splits": _rows_to_dicts(dataset_splits),
        "label_analytics": _rows_to_dicts(label_analytics),
        "releases": _rows_to_dicts(releases),
        "image_transformations": _rows_to_dicts(image_transformations),
        "training_sessions": _rows_to_dicts(training_sessions),
        "model_experiments": _rows_to_dicts(model_experiments),
        "human_verifications": _rows_to_dicts(human_verifications),
        "auto_label_jobs": _rows_to_dicts(auto_label_jobs),
        "image_variants": _rows_to_dicts(image_variants),
    }

    return {
        "format_version": EXPORT_FORMAT_VERSION,
        "exported_at": datetime.utcnow().isoformat(),
        "project": {
            "id": project.id,
            "name": project.name,
            "project_type": project.project_type,
        },
        "tables": tables,
        "global_ai_model_references": global_ai_model_references,
        "counts": {table_name: len(rows) for table_name, rows in tables.items()},
    }


def _write_json_to_zip(zip_file: zipfile.ZipFile, arcname: str, payload: Dict[str, Any]) -> None:
    zip_file.writestr(
        arcname,
        json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default),
    )


def _is_release_staging_path(relative_path: Path) -> bool:
    """Release .staging_* folders are temporary build folders, not project data."""
    return any(part.startswith(".staging_") for part in relative_path.parts)


def _write_project_files(zip_file: zipfile.ZipFile, project_dir: Path, project_name: str) -> int:
    file_count = 0
    base_arc = Path("files") / project_name
    for file_path in project_dir.rglob("*"):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(project_dir)
        if _is_release_staging_path(relative):
            continue
        zip_file.write(file_path, (base_arc / relative).as_posix())
        file_count += 1
    return file_count


def create_project_export_package(db: Session, project_id: int) -> Path:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ProjectExportError(f"Project {project_id} not found")

    project_dir = _project_folder(project.name)
    if not project_dir.exists() or not project_dir.is_dir():
        raise ProjectExportError(f"Project folder not found: {project_dir}")

    snapshot = _collect_snapshot(db, project)
    safe_name = _safe_export_name(project.name)
    export_id = str(uuid.uuid4())

    export_dir = Path(settings.TEMP_DIR) / "project_exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    temp_path = Path(tempfile.mkstemp(prefix=f"{safe_name}_", suffix=".zip", dir=export_dir)[1])

    try:
        with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            file_count = _write_project_files(zip_file, project_dir, project.name)

            manifest = {
                "format_version": EXPORT_FORMAT_VERSION,
                "export_id": export_id,
                "exported_at": datetime.utcnow().isoformat(),
                "app_name": settings.APP_NAME,
                "app_version": settings.VERSION,
                "project": {
                    "id": project.id,
                    "name": project.name,
                    "project_type": project.project_type,
                    "folder_name": project.name,
                },
                "package": {
                    "contains_full_project_folder": True,
                    "project_files_root": f"files/{project.name}",
                    "project_file_count": file_count,
                    "database_snapshot": "database_snapshot.json",
                    "global_app_model_folders_included": False,
                },
                "database_counts": snapshot["counts"],
            }

            _write_json_to_zip(zip_file, "manifest.json", manifest)
            _write_json_to_zip(zip_file, "database_snapshot.json", snapshot)

        return temp_path
    except Exception:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise
