"""
Retraining Mode API Routes

Provides a simplified pipeline for operators to retrain existing models.
All data (releases, training sessions) is stored in the same tables as Full Mode.
The retraining_references table is just a pointer to the production reference.

Does NOT modify any existing route or service — new pipeline only.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import json

from database.database import get_db
from database.models import (
    Project, RetrainingReference, TrainingSession, Release
)
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()
router = APIRouter()


# ---------------------------------------------------------------------------
# GET /api/v1/retraining/projects
# Returns only projects that have a retraining reference assigned.
# ---------------------------------------------------------------------------
@router.get("/retraining/projects")
def get_retraining_projects(db: Session = Depends(get_db)):
    """
    Returns all projects with their retraining reference status.
    Projects without a reference are included but marked as locked.
    """
    try:
        projects = db.query(Project).order_by(Project.updated_at.desc()).all()
        result = []
        for proj in projects:
            ref = db.query(RetrainingReference).filter(
                RetrainingReference.project_id == proj.id
            ).first()

            result.append({
                "id": proj.id,
                "name": proj.name,
                "description": proj.description,
                "project_type": proj.project_type,
                "created_at": proj.created_at.isoformat() if proj.created_at else None,
                "updated_at": proj.updated_at.isoformat() if proj.updated_at else None,
                "has_reference": ref is not None,
                "reference": {
                    "training_session_id": ref.training_session_id,
                    "release_id": ref.release_id,
                    "assigned_at": ref.assigned_at.isoformat() if ref.assigned_at else None,
                    "notes": ref.notes,
                } if ref else None
            })

        return {"projects": result}

    except Exception as e:
        logger.warning("errors.system", f"Failed to fetch retraining projects: {e}",
                       "retraining_projects_error", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/v1/retraining/{project_id}/reference
# Returns the full reference params for auto-filling retraining.
# ---------------------------------------------------------------------------
@router.get("/retraining/{project_id}/reference")
def get_retraining_reference(project_id: int, db: Session = Depends(get_db)):
    """
    Returns the production reference for a project:
    - training session params (model, epochs, optimizer, task, etc.)
    - release config (transformations, format, task type, split ratios)
    """
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref:
        raise HTTPException(
            status_code=404,
            detail="No production reference set for this project. Please contact your developer."
        )

    # Load training session params
    training_params = {}
    training_info = {}
    if ref.training_session_id:
        ts = db.query(TrainingSession).filter(
            TrainingSession.id == ref.training_session_id
        ).first()
        if ts:
            training_info = {
                "id": ts.id,
                "name": ts.name,
                "framework": ts.framework,
                "task": ts.task,
                "model_name": ts.model_name,
                "base_model_id": ts.base_model_id,
                "best_weights_path": ts.best_weights_path,
            }
            if ts.resolved_config_json:
                try:
                    training_params = json.loads(ts.resolved_config_json)
                except Exception:
                    training_params = {}

    # Load release config (transformation settings + split ratios)
    release_info = {}
    if ref.release_id:
        rel = db.query(Release).filter(Release.id == ref.release_id).first()
        if rel:
            release_config = {}
            if rel.config:
                try:
                    release_config = json.loads(rel.config) if isinstance(rel.config, str) else rel.config
                except Exception:
                    release_config = {}

            release_info = {
                "id": rel.id,
                "name": rel.name,
                "task_type": rel.task_type,
                "export_format": release_config.get("export_format"),
                "output_format": release_config.get("output_format"),
                "transformations": release_config.get("transformations", []),
                "images_per_original": release_config.get("images_per_original", 1),
                "train_ratio": rel.train_ratio,
                "val_ratio": rel.val_ratio,
                "test_ratio": rel.test_ratio,
            }

    return {
        "project_id": project_id,
        "reference_id": ref.id,
        "training_info": training_info,
        "training_params": training_params,
        "release_info": release_info,
        "assigned_at": ref.assigned_at.isoformat() if ref.assigned_at else None,
        "notes": ref.notes,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/assign-production
# Sets a training session as the production reference for a project.
# Called from Retraining Mode results page AND Full Mode Model Lab.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/assign-production")
def assign_production(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Assigns a training session as the production reference for this project.
    Creates or updates the retraining_references row.
    Body: { training_session_id, notes (optional) }
    """
    training_session_id = body.get("training_session_id")
    notes = body.get("notes", "")

    if not training_session_id:
        raise HTTPException(status_code=400, detail="training_session_id is required")

    # Verify training session exists and belongs to this project
    ts = db.query(TrainingSession).filter(
        TrainingSession.id == training_session_id,
        TrainingSession.project_id == project_id
    ).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found for this project")

    # Find the release used by this training session
    release_id = ts.dataset_release_id

    # Upsert retraining reference
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if ref:
        ref.training_session_id = training_session_id
        ref.release_id = release_id
        ref.assigned_at = datetime.utcnow()
        ref.notes = notes
    else:
        ref = RetrainingReference(
            project_id=project_id,
            training_session_id=training_session_id,
            release_id=release_id,
            notes=notes,
        )
        db.add(ref)

    db.commit()
    db.refresh(ref)

    logger.info("app.retraining", f"Assigned training {training_session_id} as production reference",
                "assign_production", {"project_id": project_id, "training_session_id": training_session_id})

    return {
        "success": True,
        "project_id": project_id,
        "training_session_id": training_session_id,
        "release_id": release_id,
        "assigned_at": ref.assigned_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# DELETE /api/v1/retraining/{project_id}/unassign-production
# Removes the production reference — project becomes locked in Retraining Mode.
# ---------------------------------------------------------------------------
@router.delete("/retraining/{project_id}/unassign-production")
def unassign_production(project_id: int, db: Session = Depends(get_db)):
    """
    Removes the retraining reference for this project.
    Project will appear locked in User Retraining Mode until reassigned.
    """
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref:
        raise HTTPException(status_code=404, detail="No production reference found for this project.")

    db.delete(ref)
    db.commit()

    logger.info("app.retraining", f"Removed production reference for project {project_id}",
                "unassign_production", {"project_id": project_id})

    return {"success": True, "project_id": project_id}


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/create-release
# Creates a new release using the reference release config automatically.
# Operator does not see or configure anything.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/create-release")
def create_retraining_release(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Creates a new release by copying config from the production reference release.
    Body: { name (optional) }
    The frontend then triggers the normal release generation pipeline.
    Returns the new release config ready for the frontend to submit.
    """
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref or not ref.release_id:
        raise HTTPException(
            status_code=404,
            detail="No production reference release found. Please contact your developer."
        )

    ref_release = db.query(Release).filter(Release.id == ref.release_id).first()
    if not ref_release:
        raise HTTPException(status_code=404, detail="Reference release no longer exists.")

    # Extract config from reference release
    release_config = {}
    if ref_release.config:
        try:
            release_config = json.loads(ref_release.config) if isinstance(ref_release.config, str) else ref_release.config
        except Exception:
            release_config = {}

    # Return the config for the frontend to use when creating the release
    # The actual release creation uses the existing release pipeline
    return {
        "project_id": project_id,
        "reference_release_id": ref_release.id,
        "release_config": {
            "task_type": ref_release.task_type,
            "export_format": release_config.get("export_format", "yolo"),
            "output_format": release_config.get("output_format", "original"),
            "transformations": release_config.get("transformations", []),
            "images_per_original": release_config.get("images_per_original", 1),
            "train_ratio": ref_release.train_ratio,
            "val_ratio": ref_release.val_ratio,
            "test_ratio": ref_release.test_ratio,
        }
    }


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/start-training
# Starts a new training session by copying all params from the reference.
# Operator provides only the name.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/start-training")
def start_retraining(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Returns the full training config copied from the production reference,
    ready for the frontend to submit to the existing training start endpoint.
    Body: { name, base_model_id (optional override), release_id }
    """
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Training name is required")

    release_id = body.get("release_id")
    base_model_override = body.get("base_model_id")

    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref or not ref.training_session_id:
        raise HTTPException(
            status_code=404,
            detail="No production reference found. Please contact your developer."
        )

    # Load reference training session
    ts = db.query(TrainingSession).filter(
        TrainingSession.id == ref.training_session_id
    ).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Reference training session no longer exists.")

    # Copy all params from reference
    resolved_config = {}
    if ts.resolved_config_json:
        try:
            resolved_config = json.loads(ts.resolved_config_json)
        except Exception:
            resolved_config = {}

    # Remove old dataset/output paths — they belong to the old run
    for key in ("project", "data", "name", "save_dir"):
        resolved_config.pop(key, None)

    return {
        "project_id": project_id,
        "training_payload": {
            "name": name,
            "framework": ts.framework,
            "task": ts.task,
            "base_model_id": base_model_override or ts.base_model_id,
            "dataset_release_id": release_id or ts.dataset_release_id,
            "resolved_config": resolved_config,
        }
    }
