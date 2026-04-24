"""
Model Manager API Routes
Handles downloading, deploying, and managing trained models from training sessions
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pathlib import Path
from typing import Optional, Dict, Any
import os
import shutil
import yaml
import json

from database.database import get_db
from database.models import TrainingSession, AiModel, Project
from logging_system.professional_logger import get_professional_logger
from core.config import settings

router = APIRouter()
logger = get_professional_logger()


def deploy_training_model_record(
    db: Session,
    project: Project,
    session: TrainingSession,
    model_type: str,
    model_name: str,
    description: Optional[str] = None,
):
    """Deploy one training artifact into the project's local model registry.

    Duplicate-safe by project + training session + best/last flag, so an auto-add
    after a manual add will skip cleanly without creating a second model row.
    """
    existing_model = db.query(AiModel).filter(
        AiModel.project_id == project.id,
        AiModel.training_session_id == str(session.id),
        AiModel.is_best == (model_type == "best"),
    ).first()
    if existing_model:
        return existing_model, False

    project_dir = settings.PROJECTS_DIR / project.name / "model" / "training" / session.name
    source_file = project_dir / "weights" / f"{model_type}.pt"

    if not source_file.exists():
        raise HTTPException(status_code=404, detail=f"{model_type}.pt not found")

    models_dir = settings.PROJECTS_DIR / project.name / "model"
    models_dir.mkdir(parents=True, exist_ok=True)

    dest_file = models_dir / f"{model_name.replace(' ', '_')}.pt"
    shutil.copy2(source_file, dest_file)

    classes = []
    training_input_size = [640, 640]
    normalized_model_type = "object_detection"

    if session.task:
        if session.task in ("segmentation", "segment"):
            normalized_model_type = "instance_segmentation"
        elif session.task in ("detection", "detect"):
            normalized_model_type = "object_detection"
        else:
            normalized_model_type = session.task

    if session.dataset_summary_json:
        try:
            dataset_summary = json.loads(session.dataset_summary_json) if isinstance(session.dataset_summary_json, str) else session.dataset_summary_json
            if dataset_summary and 'classes' in dataset_summary:
                classes = dataset_summary['classes']
        except Exception as e:
            logger.error("app.backend", f"Failed to parse dataset_summary_json", "parse_dataset_summary_error", {"error": str(e)})

    if session.resolved_config_json:
        try:
            config = json.loads(session.resolved_config_json) if isinstance(session.resolved_config_json, str) else session.resolved_config_json
            imgsz = config.get('imgsz') if isinstance(config, dict) else None
            if imgsz is None and isinstance(config, dict):
                imgsz = (config.get('train') or {}).get('imgsz')
            if isinstance(imgsz, list):
                training_input_size = imgsz
            elif imgsz:
                training_input_size = [imgsz, imgsz]
        except Exception:
            pass

    relative_path = str(dest_file.relative_to(settings.BASE_DIR)).replace('\\', '/')

    from database.operations import AiModelOperations

    new_model = AiModelOperations.upsert_ai_model(
        db=db,
        name=model_name,
        project_id=project.id,
        model_type=normalized_model_type,
        model_format="pytorch",
        file_path=relative_path,
        classes=classes,
        input_size_default=[640, 640],
        training_input_size=training_input_size,
        description=description or "",
    )

    new_model.source_type = "training"
    new_model.training_session_id = str(session.id)
    new_model.description = description or ""
    new_model.is_best = (model_type == "best")
    db.commit()
    db.refresh(new_model)

    try:
        from sqlalchemy import text as sql_text
        db.execute(
            sql_text("UPDATE ai_models SET project_name=:pname WHERE id=:model_id"),
            {"pname": project.name, "model_id": new_model.id}
        )
        db.commit()
    except Exception as e:
        logger.error("app.backend", f"Failed to set project_name: {str(e)}", "set_project_name_error", {
            "model_id": new_model.id,
            "error": str(e)
        })

    try:
        from models.model_manager import model_manager, ModelType, ModelFormat, ModelInfo
        from datetime import datetime

        if normalized_model_type == "instance_segmentation":
            mt = ModelType.INSTANCE_SEGMENTATION
        elif normalized_model_type == "object_detection":
            mt = ModelType.OBJECT_DETECTION
        else:
            mt = ModelType.OBJECT_DETECTION

        slug = new_model.name.lower().strip().replace(' ', '_')
        slug = ''.join(ch for ch in slug if ch.isalnum() or ch in ['_', '-'])
        model_id = f"trained_{project.name}_{slug}"

        model_info = ModelInfo(
            id=model_id,
            name=new_model.name,
            type=mt,
            format=ModelFormat.PYTORCH,
            path=str(dest_file),
            classes=classes,
            input_size=tuple(training_input_size) if isinstance(training_input_size, list) else (640, 640),
            confidence_threshold=0.5,
            iou_threshold=0.45,
            description=description or "",
            created_at=datetime.now().isoformat(),
            is_custom=True,
            source_type="training",
            training_session_id=session.id,
            is_best=(model_type == "best")
        )

        model_manager._refresh_model_metadata(model_info)
        model_manager.models_info[model_id] = model_info
        model_manager._save_models_config()

        logger.info("app.backend", "Model registered in model_manager", "model_registration_success", {
            "model_id": model_id,
            "model_name": new_model.name
        })
    except Exception as e:
        logger.error("app.backend", f"Failed to register model in model_manager: {str(e)}", "model_registration_error", {
            "model_id": new_model.id,
            "error": str(e)
        })

    return new_model, True


class UpdateNotesRequest(BaseModel):
    notes: str


class RenameModelRequest(BaseModel):
    new_name: str


class DeployModelRequest(BaseModel):
    model_type: str  # 'best' or 'last'
    model_name: str
    description: Optional[str] = None


@router.get("/projects/{project_id}/training/{training_id}/models")
async def get_training_models(
    project_id: int,
    training_id: int,
    db: Session = Depends(get_db)
):
    """Get available models (best.pt, last.pt) and additional files from a training session."""
    logger.info("app.backend", f"Getting training models", "get_training_models", {
        "project_id": project_id,
        "training_id": training_id
    })
    
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get training session by ID
    session = db.query(TrainingSession).filter(
        TrainingSession.project_id == project_id,
        TrainingSession.id == training_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail=f"Training session not found")
    
    # Build paths using session name from database
    project_dir = settings.PROJECTS_DIR / project.name / "model" / "training" / session.name
    weights_dir = project_dir / "weights"
    
    if not weights_dir.exists():
        raise HTTPException(status_code=404, detail="Training weights directory not found")
    
    # Get model files
    best_pt = weights_dir / "best.pt"
    last_pt = weights_dir / "last.pt"
    args_yaml = project_dir / "args.yaml"
    metrics_json = project_dir / "results.json"
    
    result = {
        "best_model": None,
        "last_model": None,
        "additional_files": []
    }
    
    # Best model
    if best_pt.exists():
        result["best_model"] = {
            "file_path": str(best_pt),
            "size": best_pt.stat().st_size,
            "created_at": best_pt.stat().st_mtime,
            "notes": ""  # TODO: Load from database if model is deployed
        }
    
    # Last model
    if last_pt.exists():
        result["last_model"] = {
            "file_path": str(last_pt),
            "size": last_pt.stat().st_size,
            "created_at": last_pt.stat().st_mtime,
            "notes": ""  # TODO: Load from database if model is deployed
        }
    
    # Additional files
    if args_yaml.exists():
        result["additional_files"].append({
            "name": "args.yaml",
            "size": args_yaml.stat().st_size,
            "file_path": str(args_yaml)
        })
    
    if metrics_json.exists():
        result["additional_files"].append({
            "name": "results.json",
            "size": metrics_json.stat().st_size,
            "file_path": str(metrics_json)
        })
    
    logger.info("app.backend", f"Training models retrieved", "get_training_models_success", {
        "project_id": project_id,
        "training_id": training_id,
        "has_best": result["best_model"] is not None,
        "has_last": result["last_model"] is not None,
        "additional_files_count": len(result["additional_files"])
    })
    
    return result


@router.get("/projects/{project_id}/training/{training_id}/download/{file_name}")
async def download_training_file(
    project_id: int,
    training_id: int,
    file_name: str,
    db: Session = Depends(get_db)
):
    """Download a file from the training session (best.pt, last.pt, args.yaml, etc.)."""
    logger.info("app.backend", f"Downloading training file", "download_training_file", {
        "project_id": project_id,
        "training_id": training_id,
        "file_name": file_name
    })
    
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get training session
    session = db.query(TrainingSession).filter(
        TrainingSession.project_id == project_id,
        TrainingSession.id == training_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Build file path
    project_dir = settings.PROJECTS_DIR / project.name / "model" / "training" / session.name
    
    # Determine file location
    if file_name in ["best.pt", "last.pt"]:
        file_path = project_dir / "weights" / file_name
    else:
        file_path = project_dir / file_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {file_name} not found")
    
    logger.info("app.backend", f"File download started", "download_training_file_success", {
        "project_id": project_id,
        "training_id": training_id,
        "file_name": file_name,
        "file_size": file_path.stat().st_size
    })
    
    return FileResponse(
        path=str(file_path),
        filename=file_name,
        media_type="application/octet-stream"
    )


@router.patch("/projects/{project_id}/training/{training_id}/models/{model_type}/notes")
async def update_model_notes(
    project_id: int,
    training_id: int,
    model_type: str,  # 'best' or 'last'
    request: UpdateNotesRequest,
    db: Session = Depends(get_db)
):
    """Update notes for a training model."""
    logger.info("app.backend", f"Updating model notes", "update_model_notes", {
        "project_id": project_id,
        "training_id": training_id,
        "model_type": model_type
    })
    
    # Get training session
    session = db.query(TrainingSession).filter(
        TrainingSession.project_id == project_id,
        TrainingSession.training_uid == training_uid
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Check if model is already deployed
    is_best = model_type == "best"
    deployed_model = db.query(AiModel).filter(
        AiModel.training_session_id == session.id,
        AiModel.is_best == is_best
    ).first()
    
    if deployed_model:
        # Update existing deployed model
        deployed_model.notes = request.notes
        db.commit()
    else:
        # Store notes in session metadata for now
        # Will be used when model is deployed
        if not session.metadata:
            session.metadata = {}
        
        notes_key = f"{model_type}_notes"
        session.metadata[notes_key] = request.notes
        db.commit()
    
    logger.info("app.backend", f"Model notes updated", "update_model_notes_success", {
        "project_id": project_id,
        "training_id": training_id,
        "model_type": model_type
    })
    
    return {"success": True, "notes": request.notes}


@router.post("/projects/{project_id}/training/{training_id}/deploy")
async def deploy_model_to_project(
    project_id: int,
    training_id: int,
    request: DeployModelRequest,
    db: Session = Depends(get_db)
):
    """Deploy a trained model (best.pt or last.pt) to the project's models."""
    logger.info("app.backend", f"Deploying model to project", "deploy_model", {
        "project_id": project_id,
        "training_id": training_id,
        "model_type": request.model_type,
        "model_name": request.model_name
    })
    
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get training session
    session = db.query(TrainingSession).filter(
        TrainingSession.project_id == project_id,
        TrainingSession.id == training_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    new_model, created_now = deploy_training_model_record(
        db=db,
        project=project,
        session=session,
        model_type=request.model_type,
        model_name=request.model_name,
        description=request.description,
    )
    
    logger.info("app.backend", f"Model deployed successfully", "deploy_model_success", {
        "project_id": project_id,
        "training_id": training_id,
        "model_type": request.model_type,
        "model_id": new_model.id,
        "model_name": request.model_name,
        "created_now": created_now,
    })
    
    return {
        "success": True,
        "model_id": new_model.id,
        "model_name": new_model.name,
        "created_now": created_now,
        "file_path": new_model.file_path,
    }
