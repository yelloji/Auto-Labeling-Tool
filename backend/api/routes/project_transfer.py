"""
Project transfer routes.

Phase 1 exposes export-only support for full project backup packages.
"""

from pathlib import Path
import shutil
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from api.services.project_export_service import ProjectExportError, create_project_export_package
from api.services.project_import_service import (
    ProjectImportError,
    import_project_package,
    validate_project_import_package,
)
from core.config import settings
from database.database import get_db
from database.models import Project
from logging_system.professional_logger import get_professional_logger


logger = get_professional_logger()
router = APIRouter()


def _download_filename(project_name: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in project_name.strip())
    safe = safe.strip("_") or "project"
    return f"{safe}_project_export.zip"


async def _save_upload_to_temp(upload: UploadFile) -> Path:
    suffix = Path(upload.filename or "project_import.zip").suffix or ".zip"
    temp_root = Path(settings.TEMP_DIR)
    temp_root.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="project_import_upload_", dir=temp_root))
    temp_path = temp_dir / f"upload{suffix}"
    try:
        with temp_path.open("wb") as output:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
        return temp_path
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise


def _cleanup_temp_upload(temp_path: Path) -> None:
    shutil.rmtree(temp_path.parent, ignore_errors=True)


@router.post("/projects/{project_id}/export")
async def export_project(project_id: int, db: Session = Depends(get_db)):
    """Create and download a full project export package."""
    logger.info("operations.exports", "Starting project export", "project_export_start", {
        "project_id": project_id,
    })

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        logger.warning("errors.validation", "Project not found for export", "project_export_not_found", {
            "project_id": project_id,
        })
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        package_path = create_project_export_package(db, project_id)
    except ProjectExportError as exc:
        logger.warning("errors.validation", "Project export validation failed", "project_export_validation_failed", {
            "project_id": project_id,
            "error": str(exc),
        })
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("errors.system", "Project export failed", "project_export_failed", {
            "project_id": project_id,
            "error": str(exc),
            "error_type": type(exc).__name__,
        })
        raise HTTPException(status_code=500, detail=f"Failed to export project: {exc}")

    logger.info("operations.exports", "Project export package ready", "project_export_ready", {
        "project_id": project_id,
        "package_path": str(package_path),
    })

    return FileResponse(
        path=str(package_path),
        filename=_download_filename(project.name),
        media_type="application/zip",
        background=BackgroundTask(lambda: Path(package_path).unlink(missing_ok=True)),
    )


@router.post("/projects/import/validate")
async def validate_project_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Validate a project export ZIP before importing it."""
    temp_path = await _save_upload_to_temp(file)
    try:
        summary = validate_project_import_package(temp_path, db)
        logger.info("operations.exports", "Project import package validated", "project_import_validate", {
            "filename": file.filename,
            "project_name": summary.get("project_name"),
            "name_conflict": summary.get("name_conflict"),
        })
        return summary
    except ProjectImportError as exc:
        logger.warning("errors.validation", "Project import validation failed", "project_import_validation_failed", {
            "filename": file.filename,
            "error": str(exc),
        })
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("errors.system", "Project import validation crashed", "project_import_validation_crashed", {
            "filename": file.filename,
            "error": str(exc),
            "error_type": type(exc).__name__,
        })
        raise HTTPException(status_code=500, detail=f"Failed to validate project import: {exc}")
    finally:
        _cleanup_temp_upload(temp_path)


@router.post("/projects/import")
async def import_project(
    file: UploadFile = File(...),
    new_project_name: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Import a full project export ZIP into the current installation."""
    temp_path = await _save_upload_to_temp(file)
    try:
        result = import_project_package(db, temp_path, new_project_name=new_project_name)
        logger.info("operations.exports", "Project import completed", "project_import_completed", {
            "filename": file.filename,
            "project_id": result.get("project_id"),
            "project_name": result.get("project_name"),
        })
        return result
    except ProjectImportError as exc:
        logger.warning("errors.validation", "Project import failed validation", "project_import_failed_validation", {
            "filename": file.filename,
            "new_project_name": new_project_name,
            "error": str(exc),
        })
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("errors.system", "Project import failed", "project_import_failed", {
            "filename": file.filename,
            "new_project_name": new_project_name,
            "error": str(exc),
            "error_type": type(exc).__name__,
        })
        raise HTTPException(status_code=500, detail=f"Failed to import project: {exc}")
    finally:
        _cleanup_temp_upload(temp_path)
