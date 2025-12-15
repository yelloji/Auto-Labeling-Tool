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

from database.database import get_db
from database.models import TrainingSession, AiModel, Project
from logging_system.professional_logger import get_professional_logger

router = APIRouter()
logger = get_professional_logger()


class UpdateNotesRequest(BaseModel):
    notes: str


class RenameModelRequest(BaseModel):
    new_name: str


class DeployModelRequest(BaseModel):
    model_type: str  # 'best' or 'last'
    model_name: str
    description: Optional[str] = None


@router.get("/projects/{project_id}/training/{session_name}/models")
async def get_training_models(
    project_id: int,
    session_name: str,
    db: Session = Depends(get_db)
):
    """Get available models (best.pt, last.pt) and additional files from a training session."""
    logger.info("app.backend", f"Getting training models", "get_training_models", {
        "project_id": project_id,
        "session_name": session_name
    })
    
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get training session
    session = db.query(TrainingSession).filter(
        TrainingSession.project_id == project_id,
        TrainingSession.name == session_name
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Build paths
    project_dir = Path("projects") / project.name / "training" / session_name
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
        "session_name": session_name,
        "has_best": result["best_model"] is not None,
        "has_last": result["last_model"] is not None,
        "additional_files_count": len(result["additional_files"])
    })
    
    return result


@router.get("/projects/{project_id}/training/{session_name}/download/{file_name}")
async def download_training_file(
    project_id: int,
    session_name: str,
    file_name: str,
    db: Session = Depends(get_db)
):
    """Download a file from the training session (best.pt, last.pt, args.yaml, etc.)."""
    logger.info("app.backend", f"Downloading training file", "download_training_file", {
        "project_id": project_id,
        "session_name": session_name,
        "file_name": file_name
    })
    
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Build file path
    project_dir = Path("projects") / project.name / "training" / session_name
    
    # Determine file location
    if file_name in ["best.pt", "last.pt"]:
        file_path = project_dir / "weights" / file_name
    else:
        file_path = project_dir / file_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {file_name} not found")
    
    logger.info("app.backend", f"File download started", "download_training_file_success", {
        "project_id": project_id,
        "session_name": session_name,
        "file_name": file_name,
        "file_size": file_path.stat().st_size
    })
    
    return FileResponse(
        path=str(file_path),
        filename=file_name,
        media_type="application/octet-stream"
    )


@router.patch("/projects/{project_id}/training/{session_name}/models/{model_type}/notes")
async def update_model_notes(
    project_id: int,
    session_name: str,
    model_type: str,  # 'best' or 'last'
    request: UpdateNotesRequest,
    db: Session = Depends(get_db)
):
    """Update notes for a training model."""
    logger.info("app.backend", f"Updating model notes", "update_model_notes", {
        "project_id": project_id,
        "session_name": session_name,
        "model_type": model_type
    })
    
    # Get training session
    session = db.query(TrainingSession).filter(
        TrainingSession.project_id == project_id,
        TrainingSession.name == session_name
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
        "session_name": session_name,
        "model_type": model_type
    })
    
    return {"success": True, "notes": request.notes}


@router.post("/projects/{project_id}/training/{session_name}/deploy")
async def deploy_model_to_project(
    project_id: int,
    session_name: str,
    request: DeployModelRequest,
    db: Session = Depends(get_db)
):
    """Deploy a trained model (best.pt or last.pt) to the project's models."""
    logger.info("app.backend", f"Deploying model to project", "deploy_model", {
        "project_id": project_id,
        "session_name": session_name,
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
        TrainingSession.name == session_name
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Build source path
    project_dir = Path("projects") / project.name / "training" / session_name
    source_file = project_dir / "weights" / f"{request.model_type}.pt"
    args_yaml_path = project_dir / "args.yaml"
    
    if not source_file.exists():
        raise HTTPException(status_code=404, detail=f"{request.model_type}.pt not found")
    
    # Create models directory if it doesn't exist
    models_dir = Path("projects") / project.name / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy model file
    dest_file = models_dir / f"{request.model_name.replace(' ', '_')}.pt"
    shutil.copy2(source_file, dest_file)
    
    # Extract metadata from args.yaml
    nc = 0
    classes = []
    training_input_size = [640, 640]
    
    if args_yaml_path.exists():
        with open(args_yaml_path, 'r') as f:
            args_data = yaml.safe_load(f)
            if args_data:
                nc = args_data.get('nc', 0)
                classes = args_data.get('names', [])
                imgsz = args_data.get('imgsz', 640)
                if isinstance(imgsz, list):
                    training_input_size = imgsz
                else:
                    training_input_size = [imgsz, imgsz]
    
    # Create AiModel entry
    new_model = AiModel(
        name=request.model_name,
        project_id=project_id,
        type="object_detection",  # TODO: Get from session config
        format="pytorch",
        file_path=str(dest_file),
        nc=nc,
        classes=classes,
        training_input_size=training_input_size,
        input_size_default=[640, 640],
        source_type="training",
        training_session_id=session.id,
        notes=request.description or "",
        is_best=(request.model_type == "best")
    )
    
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    
    logger.info("app.backend", f"Model deployed successfully", "deploy_model_success", {
        "project_id": project_id,
        "session_name": session_name,
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
