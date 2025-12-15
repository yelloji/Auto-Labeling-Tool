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

# Startup verification
print("=" * 60)
print("🚀 MODEL LAB ROUTER LOADED - Using training_id (integer)")
print("=" * 60)


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
    
    # Build source path using session name from database
    project_dir = settings.PROJECTS_DIR / project.name / "model" / "training" / session.name
    source_file = project_dir / "weights" / f"{request.model_type}.pt"
    args_yaml_path = project_dir / "args.yaml"
    
    if not source_file.exists():
        raise HTTPException(status_code=404, detail=f"{request.model_type}.pt not found")
    
    # Create models directory if it doesn't exist (same level as training folder)
    models_dir = settings.PROJECTS_DIR / project.name / "model"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy model file
    dest_file = models_dir / f"{request.model_name.replace(' ', '_')}.pt"
    shutil.copy2(source_file, dest_file)
    
    # Extract metadata from TrainingSession database record (more reliable than args.yaml)
    nc = 0
    classes = []
    training_input_size = [640, 640]
    model_type = "object_detection"  # default
    
    # Get model type from session
    if session.task:
        if session.task == "segmentation" or session.task == "segment":
            model_type = "instance_segmentation"
        elif session.task == "detection" or session.task == "detect":
            model_type = "object_detection"
        else:
            model_type = session.task
    
    # Get classes from dataset_summary_json
    if session.dataset_summary_json:
        try:
            dataset_summary = json.loads(session.dataset_summary_json) if isinstance(session.dataset_summary_json, str) else session.dataset_summary_json
            if dataset_summary:
                # Extract classes
                if 'classes' in dataset_summary:
                    classes = dataset_summary['classes']
                # Extract nc - use num_classes field (not nc)
                if 'num_classes' in dataset_summary:
                    nc = dataset_summary['num_classes']
                elif classes:
                    nc = len(classes)
        except Exception as e:
            logger.error("app.backend", f"Failed to parse dataset_summary_json", "parse_dataset_summary_error", {"error": str(e)})
    
    # Try to get input size from resolved_config_json
    if session.resolved_config_json:
        try:
            config = json.loads(session.resolved_config_json) if isinstance(session.resolved_config_json, str) else session.resolved_config_json
            if config and 'imgsz' in config:
                imgsz = config['imgsz']
                if isinstance(imgsz, list):
                    training_input_size = imgsz
                else:
                    training_input_size = [imgsz, imgsz]
        except:
            pass
    
    # Use relative path for portability - match existing model import pattern
    # Store path relative to BASE_DIR with forward slashes (e.g., "projects/gevis/model/rok_best.pt")
    relative_path = str(dest_file.relative_to(settings.BASE_DIR)).replace('\\', '/')
    
    # Use existing AiModelOperations method (same as uploaded models)
    from database.operations import AiModelOperations
    
    new_model = AiModelOperations.upsert_ai_model(
        db=db,
        name=request.model_name,
        project_id=project_id,
        model_type=model_type,
        model_format="pytorch",
        file_path=relative_path,
        classes=classes,
        input_size_default=[640, 640],
        training_input_size=training_input_size
    )
    
    # Update training-specific fields that upsert_ai_model doesn't handle
    new_model.source_type = "training"
    new_model.training_session_id = session.id
    new_model.notes = request.description or ""
    new_model.is_best = (request.model_type == "best")
    db.commit()
    db.refresh(new_model)
    
    # Set project_name using raw SQL (same as uploaded models do)
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
    
    # Register model in model_manager so it works with /api/v1/models/* endpoints
    try:
        from models.model_manager import model_manager, ModelType, ModelFormat, ModelInfo
        from datetime import datetime
        
        # Convert model_type string to ModelType enum
        if model_type == "instance_segmentation":
            mt = ModelType.INSTANCE_SEGMENTATION
        elif model_type == "object_detection":
            mt = ModelType.OBJECT_DETECTION
        else:
            mt = ModelType.OBJECT_DETECTION  # default
        
        # Generate model ID (same pattern as import_custom_model)
        slug = new_model.name.lower().strip().replace(' ', '_')
        slug = ''.join(ch for ch in slug if ch.isalnum() or ch in ['_', '-'])
        model_id = f"custom_{project.name}_{slug}"
        
        # Manually create ModelInfo (file is already in place, don't copy again!)
        model_info = ModelInfo(
            id=model_id,
            name=new_model.name,
            type=mt,
            format=ModelFormat.PYTORCH,
            path=str(dest_file),  # File already copied to final location
            classes=classes,
            input_size=tuple(training_input_size) if isinstance(training_input_size, list) else (640, 640),
            confidence_threshold=0.5,
            iou_threshold=0.45,
            description=request.description or "",
            created_at=datetime.now().isoformat(),
            is_custom=True,
            # Training-specific fields
            source_type="training",
            training_session_id=session.id,
            notes=request.description or "",
            is_best=(request.model_type == "best")
        )
        
        # Refresh metadata (file_size, is_ready)
        model_manager._refresh_model_metadata(model_info)
        
        # Register and save
        model_manager.models_info[model_id] = model_info
        model_manager._save_models_config()
        
        logger.info("app.backend", "Model registered in model_manager", "model_registration_success", {
            "model_id": model_id,
            "model_name": new_model.name
        })
    except Exception as e:
        # Log but don't fail deployment if registration fails
        print(f"❌ MODEL REGISTRATION FAILED: {str(e)}")  # Console output for debugging
        import traceback
        traceback.print_exc()  # Print full error trace
        logger.error("app.backend", f"Failed to register model in model_manager: {str(e)}", "model_registration_error", {
            "model_id": new_model.id,
            "error": str(e)
        })
    
    logger.info("app.backend", f"Model deployed successfully", "deploy_model_success", {
        "project_id": project_id,
        "training_id": training_id,
        "model_type": request.model_type,
        "model_id": new_model.id,
        "model_name": request.model_name
    })
    
    return {
        "success": True,
        "model_id": new_model.id,
        "model_name": new_model.name,
        "file_path": str(dest_file)
    }
