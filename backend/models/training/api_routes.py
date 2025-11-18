from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.models import TrainingSession
from database.database import get_db
from api.services.model_serialization import serialize_ai_model
from models.training.model_selector import get_trainable_models
from models.training.training_extraction import is_extracted, extract_release_zip
from models.training.config import load_base_config, resolve_config, build_args_preview
from models.training.dataset_summary import summarize_dataset, find_and_summarize
from pathlib import Path
from sqlalchemy import and_
from database.models import Release

router = APIRouter()

@router.get("/training/models")
async def get_trainable_models_route(
    project_id: Optional[int] = Query(None),
    framework: str = Query("ultralytics"),
    task: str = Query("detection"),
    db: Session = Depends(get_db),
):
    items = get_trainable_models(db, project_id, framework, task)
    return items


class ExtractRequest(BaseModel):
    project_id: Optional[int] = None
    zip_path: str


@router.get("/training/check-extracted")
async def check_extracted(project_id: Optional[int] = Query(None), zip_path: str = Query(...)):
    try:
        exists, rel_dir = is_extracted(zip_path)
        return {"extracted": exists, "target_dir": rel_dir}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/training/extract-release")
async def extract_release(payload: ExtractRequest):
    try:
        rel_dir = extract_release_zip(payload.zip_path)
        return {"target_dir": rel_dir}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Training session upsert/get (identity fields)
class SessionUpsert(BaseModel):
    project_id: int
    name: str
    description: Optional[str] = None


@router.post("/training/session/upsert")
async def upsert_training_session(payload: SessionUpsert, db: Session = Depends(get_db)):
    try:
        existing = (
            db.query(TrainingSession)
            .filter(TrainingSession.project_id == payload.project_id)
            .filter(TrainingSession.name == payload.name)
            .first()
        )
        if existing:
            if payload.description is not None:
                existing.description = payload.description
            if not existing.status:
                existing.status = "queued"
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return {
                "id": existing.id,
                "project_id": existing.project_id,
                "name": existing.name,
                "description": existing.description,
                "status": existing.status,
            }
        ts = TrainingSession(
            project_id=payload.project_id,
            name=payload.name,
            description=payload.description or "",
            status="queued",
        )
        db.add(ts)
        db.commit()
        db.refresh(ts)
        return {
            "id": ts.id,
            "project_id": ts.project_id,
            "name": ts.name,
            "description": ts.description,
            "status": ts.status,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/training/session/get")
async def get_training_session(project_id: int = Query(...), name: str = Query(...), db: Session = Depends(get_db)):
    try:
        ts = (
            db.query(TrainingSession)
            .filter(TrainingSession.project_id == project_id)
            .filter(TrainingSession.name == name)
            .first()
        )
        if not ts:
            raise HTTPException(status_code=404, detail="Training session not found")
        return {
            "id": ts.id,
            "project_id": ts.project_id,
            "name": ts.name,
            "description": ts.description,
            "status": ts.status,
            "framework": ts.framework,
            "task": ts.task,
            "model_name": ts.model_name,
            "dataset_release_id": ts.dataset_release_id,
            "dataset_release_dir": ts.dataset_release_dir,
            "dataset_summary_json": ts.dataset_summary_json,
            "resolved_config_json": ts.resolved_config_json,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Update selected model/framework/task for session
class SessionModelUpdate(BaseModel):
    project_id: int
    name: str
    base_model_id: Optional[str] = None
    framework: Optional[str] = None
    task: Optional[str] = None
    model_name: Optional[str] = None


@router.post("/training/session/update-model")
async def update_training_model(payload: SessionModelUpdate, db: Session = Depends(get_db)):
    try:
        ts = (
            db.query(TrainingSession)
            .filter(and_(TrainingSession.project_id == payload.project_id, TrainingSession.name == payload.name))
            .first()
        )
        if not ts:
            raise HTTPException(status_code=404, detail="Training session not found")
        if payload.base_model_id is not None:
            ts.base_model_id = payload.base_model_id
        if payload.framework is not None:
            ts.framework = payload.framework
        if payload.task is not None:
            ts.task = payload.task
        if payload.model_name is not None:
            ts.model_name = payload.model_name
        db.add(ts)
        db.commit()
        db.refresh(ts)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Update dataset info for session based on zip path
class SessionDatasetUpdate(BaseModel):
    project_id: int
    name: str
    zip_path: str


@router.post("/training/session/update-dataset-from-zip")
async def update_training_dataset_from_zip(payload: SessionDatasetUpdate, db: Session = Depends(get_db)):
    try:
        ts = (
            db.query(TrainingSession)
            .filter(and_(TrainingSession.project_id == payload.project_id, TrainingSession.name == payload.name))
            .first()
        )
        if not ts:
            raise HTTPException(status_code=404, detail="Training session not found")
        # Ensure extracted dir
        exists, rel_dir = is_extracted(payload.zip_path)
        if not exists:
            rel_dir = extract_release_zip(payload.zip_path)
        # Compute summary
        summary = find_and_summarize(Path(rel_dir))
        # Try link to release by zip path
        release = (
            db.query(Release)
            .filter(Release.model_path == payload.zip_path)
            .first()
        )
        ts.dataset_release_id = release.id if release else None
        ts.dataset_release_dir = rel_dir
        ts.dataset_summary_json = summary and (summary if isinstance(summary, str) else None)
        if not isinstance(summary, str):
            # ensure JSON string
            import json as _json
            ts.dataset_summary_json = _json.dumps(summary)
        db.add(ts)
        db.commit()
        return {"ok": True, "dataset_release_id": ts.dataset_release_id, "dataset_release_dir": ts.dataset_release_dir}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Save resolved config
class SessionConfigSave(BaseModel):
    project_id: int
    name: str
    resolved_config_json: Dict[str, Any]


@router.post("/training/session/save-config")
async def save_training_config(payload: SessionConfigSave, db: Session = Depends(get_db)):
    try:
        ts = (
            db.query(TrainingSession)
            .filter(and_(TrainingSession.project_id == payload.project_id, TrainingSession.name == payload.name))
            .first()
        )
        if not ts:
            raise HTTPException(status_code=404, detail="Training session not found")
        import json as _json
        ts.resolved_config_json = _json.dumps(payload.resolved_config_json)
        db.add(ts)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/training/config/default")
async def get_default_config(framework: str = "ultralytics", task: str = "segmentation"):
    try:
        cfg = load_base_config(framework, task)
        return {"framework": framework, "task": task, "config": cfg}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ResolveRequest(BaseModel):
    framework: str = "ultralytics"
    task: str = "segmentation"
    overrides: Dict[str, Any]


@router.post("/training/config/resolve")
async def resolve_training_config(payload: ResolveRequest):
    try:
        resolved = resolve_config(payload.framework, payload.task, payload.overrides or {})
        preview = build_args_preview(payload.framework, payload.task, resolved)
        return {"framework": payload.framework, "task": payload.task, "resolved": resolved, "preview": preview}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/training/dataset/summary")
async def dataset_summary(release_dir: Optional[str] = None, data_yaml_path: Optional[str] = None):
    try:
        if data_yaml_path:
            return summarize_dataset(Path(data_yaml_path))
        if release_dir:
            return find_and_summarize(Path(release_dir))
        raise HTTPException(status_code=400, detail="release_dir or data_yaml_path required")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
