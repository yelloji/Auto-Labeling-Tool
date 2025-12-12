from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.models import TrainingSession
from database.database import get_db, SessionLocal
from api.services.model_serialization import serialize_ai_model
from models.training.model_selector import get_trainable_models
from models.training.training_extraction import is_extracted, extract_release_zip
from models.training.config import load_base_config, resolve_config, build_args_preview
from models.training.dataset_summary import summarize_dataset, find_and_summarize
from models.training.yaml_generator import generate_ultralytics_training_yaml
from models.training.executor import start_ultralytics_training
import json
from pathlib import Path
from sqlalchemy import and_
from database.models import Release
from database.models import Project
from database.models import DevModeSetting
from datetime import datetime, timedelta
import uuid
import asyncio
import os
import hashlib
import yaml
import shutil
from core.config import settings

router = APIRouter()

# ... (existing routes)

# NEW: Training completion notification endpoints

@router.get("/training/completion-check")
async def check_training_completions(db: Session = Depends(get_db)):
    """
    Check for recently completed trainings that haven't been acknowledged.
    Returns list of completed trainings from last 10 minutes.
    """
    cutoff_time = datetime.now() - timedelta(minutes=10)
    
    recent_completions = db.query(TrainingSession).filter(
        TrainingSession.status == "completed",
        TrainingSession.completed_at >= cutoff_time,
        TrainingSession.acknowledged == False
    ).all()
    
    results = []
    for session in recent_completions:
        duration = None
        if session.started_at and session.completed_at:
            delta = session.completed_at - session.started_at
            hours, remainder = divmod(int(delta.total_seconds()), 3600)
            minutes, seconds = divmod(remainder, 60)
            if hours > 0:
                duration = f"{hours}h {minutes}m"
            else:
                duration = f"{minutes}m {seconds}s"
        
        results.append({
            "id": session.id,
            "name": session.name,
            "project_id": session.project_id,
            "project_name": session.project_name,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "duration": duration
        })
    
    return results


@router.post("/training/session/{session_id}/acknowledge")
async def acknowledge_training_completion(
    session_id: int,
    db: Session = Depends(get_db)
):
    """Mark a training session as acknowledged (notification dismissed)."""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    session.acknowledged = True
    db.commit()
    
    return {"success": True, "session_id": session_id}
