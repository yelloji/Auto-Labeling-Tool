from typing import Optional, Dict, Any
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
from datetime import datetime
import uuid
import asyncio
import os
import hashlib

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


# Start training: create session directories and flip status to running
class SessionStart(BaseModel):
    project_id: int
    name: str


@router.post("/training/session/start")
async def start_training_session(payload: SessionStart, db: Session = Depends(get_db)):
    try:
        ts = (
            db.query(TrainingSession)
            .filter(and_(TrainingSession.project_id == payload.project_id, TrainingSession.name == payload.name))
            .first()
        )
        if not ts:
            raise HTTPException(status_code=404, detail="Training session not found")
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_name = project.name
        
        # Find project root (up one level from backend)
        # We assume backend is at {root}/backend
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent
        while backend_dir.name != "backend" and backend_dir.parent != backend_dir:
            backend_dir = backend_dir.parent
        project_root = backend_dir.parent
        
        # Define relative path for portability (DB storage & YOLO config)
        # projects/gevis/model/training/SESSION_NAME
        # User requested to use 'model' folder (singular) which already exists
        rel_base_dir = Path("projects") / project_name / "model" / "training" / ts.name
        
        # Define absolute path for directory creation
        abs_base_dir = project_root / rel_base_dir
        
        runs_dir = abs_base_dir / "runs"
        weights_dir = abs_base_dir / "weights"
        logs_dir = abs_base_dir / "logs"
        artifacts_dir = abs_base_dir / "artifacts"
        
        for d in [runs_dir, weights_dir, logs_dir, artifacts_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        # Set paths in DB as RELATIVE paths for portability
        ts.run_dir = str(rel_base_dir / "runs")
        ts.weights_dir = str(rel_base_dir / "weights")
        ts.logs_dir = str(rel_base_dir / "logs")
        ts.artifacts_dir = str(rel_base_dir / "artifacts")
        ts.best_weights_path = None
        
        # Load resolved config
        resolved_config = {}
        if ts.resolved_config_json:
            try:
                resolved_config = json.loads(ts.resolved_config_json)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid resolved config JSON: {str(e)}")
        
        # Inject project and name for YOLO output directory control
        if 'train' not in resolved_config:
            resolved_config['train'] = {}
            
        # Use RELATIVE path for YOLO project dir
        # Since executor runs with cwd=project_root, this works and keeps config portable
        resolved_config['train']['project'] = str(rel_base_dir.parent)
        resolved_config['train']['name'] = ts.name
        
        # Generate temporary YAML config
        temp_yaml_path = artifacts_dir / "temp_training_config.yaml"
        try:
            generate_ultralytics_training_yaml(resolved_config, str(temp_yaml_path), ts.framework, ts.task)
            
            # Save snapshot to DB
            with open(temp_yaml_path, 'r', encoding='utf-8') as f:
                ts.training_config_snapshot = f.read()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate training config: {str(e)}")
        
        # Start training process
        process = start_ultralytics_training(str(temp_yaml_path), ts, db)
        
        # Clean up temp file - REMOVED to prevent race condition
        # We keep the file in artifacts_dir for debugging and ensuring YOLO can read it
        # try:
        #     temp_yaml_path.unlink()
        # except Exception:
        #     pass
        
        if process is None:
            raise HTTPException(status_code=500, detail="Failed to start training process (check server logs)")

        # Update status
        ts.status = "running"
        ts.progress_pct = 0
        ts.started_at = datetime.utcnow()
        ts.last_update_at = ts.started_at
        
        # Commit to DB
        db.add(ts)
        db.commit()
        return {
            "ok": True,
            "paths": {
                "run_dir": ts.run_dir,
                "weights_dir": ts.weights_dir,
                "logs_dir": ts.logs_dir,
                "artifacts_dir": ts.artifacts_dir,
            },
            "status": ts.status,
            "process_started": process is not None,
        }
    except HTTPException:
        raise
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
            if not existing.training_uid:
                existing.training_uid = uuid.uuid4().hex
            try:
                project = db.query(Project).filter(Project.id == payload.project_id).first()
                if project:
                    existing.project_name = project.name
            except Exception:
                pass
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
        active = (
            db.query(TrainingSession)
            .filter(TrainingSession.project_id == payload.project_id)
            .filter(TrainingSession.status.in_(["queued", "running"]))
            .order_by(TrainingSession.created_at.desc())
            .first()
        )
        if active:
            conflict = (
                db.query(TrainingSession)
                .filter(TrainingSession.project_id == payload.project_id)
                .filter(TrainingSession.name == payload.name)
                .first()
            )
            if conflict:
                if payload.description is not None:
                    conflict.description = payload.description
                if not conflict.status:
                    conflict.status = "queued"
                if not conflict.training_uid:
                    conflict.training_uid = uuid.uuid4().hex
                try:
                    project = db.query(Project).filter(Project.id == payload.project_id).first()
                    if project:
                        conflict.project_name = project.name
                except Exception:
                    pass
                db.add(conflict)
                db.commit()
                db.refresh(conflict)
                return {
                    "id": conflict.id,
                    "project_id": conflict.project_id,
                    "name": conflict.name,
                    "description": conflict.description,
                    "status": conflict.status,
                }
            active.name = payload.name
            if payload.description is not None:
                active.description = payload.description
            if not active.status:
                active.status = "queued"
            if not active.training_uid:
                active.training_uid = uuid.uuid4().hex
            try:
                project = db.query(Project).filter(Project.id == payload.project_id).first()
                if project:
                    active.project_name = project.name
            except Exception:
                pass
            db.add(active)
            db.commit()
            db.refresh(active)
            return {
                "id": active.id,
                "project_id": active.project_id,
                "name": active.name,
                "description": active.description,
                "status": active.status,
            }
        ts = TrainingSession(
            project_id=payload.project_id,
            name=payload.name,
            description=payload.description or "",
            status="queued",
            base_model_id="unassigned",
            framework="ultralytics",
            task="segmentation",
            training_uid=uuid.uuid4().hex,
        )
        try:
            import json as _json
            base_cfg = load_base_config(ts.framework or "ultralytics", ts.task or "segmentation")
            ts.resolved_config_json = _json.dumps(base_cfg)
        except Exception:
            pass
        try:
            project = db.query(Project).filter(Project.id == payload.project_id).first()
            if project:
                ts.project_name = project.name
        except Exception:
            pass
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


@router.get("/training/session/active")
async def get_active_training_session(project_id: int = Query(...), db: Session = Depends(get_db)):
    try:
        ts = (
            db.query(TrainingSession)
            .filter(TrainingSession.project_id == project_id)
            .filter(TrainingSession.status.in_(["queued", "running"]))
            .order_by(TrainingSession.last_update_at.desc(), TrainingSession.created_at.desc())
            .first()
        )
        if not ts:
            raise HTTPException(status_code=404, detail="No active training session")
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
        
        # CLEAN CONFIG: Only save nested user overrides (train, hyperparameters, augmentation, val)
        # Strip out flat default config to keep DB clean and maintainable
        cfg = payload.resolved_config_json
        clean_config = {}
        
        # Enforce key order and only include nested sections
        ordered_keys = ["train", "hyperparameters", "augmentation", "val"]
        for key in ordered_keys:
            if key in cfg and isinstance(cfg[key], dict):
                clean_config[key] = cfg[key]
                
        ts.resolved_config_json = _json.dumps(clean_config)
        db.add(ts)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _hash_pw(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


@router.websocket("/training/session/terminal/logs")
async def training_terminal_logs(websocket: WebSocket, project_id: int, name: str, password: str):
    await websocket.accept()
    db = SessionLocal()
    try:
        row = db.query(DevModeSetting).order_by(DevModeSetting.id.asc()).first()
        ok = False
        if row and row.master_password_hash and row.master_password_hash == _hash_pw(password):
            ok = True
        if row and row.password_hash and row.password_hash == _hash_pw(password):
            ok = True
        if not ok:
            await websocket.send_text("unauthorized")
            await websocket.close()
            return
        ts = (
            db.query(TrainingSession)
            .filter(and_(TrainingSession.project_id == project_id, TrainingSession.name == name))
            .first()
        )
        if not ts:
            await websocket.send_text("session_not_found")
            await websocket.close()
            return

        # Resolve project root dynamically (same logic as start_session)
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent
        while backend_dir.name != "backend" and backend_dir.parent != backend_dir:
            backend_dir = backend_dir.parent
        project_root = backend_dir.parent

        log_path = None
        if ts.logs_dir:
            # ts.logs_dir is relative (projects/...), so resolve against project_root
            log_path = project_root / ts.logs_dir / "training.log"  # Changed from train.log to training.log
            
        if not log_path:
            await websocket.send_text("no_logs_dir")
            await websocket.close()
            return
            
        # Ensure directory exists (should already exist from start_session)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        if not log_path.exists():
            with open(log_path, "a", encoding="utf-8", errors="ignore") as f:
                f.write("")
        pos = 0
        try:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                while True:
                    f.seek(pos)
                    chunk = f.read()
                    if chunk:
                        pos = f.tell()
                        await websocket.send_text(chunk)
                    await asyncio.sleep(0.5)
        except WebSocketDisconnect:
            return
        except Exception:
            try:
                await websocket.close()
            except Exception:
                pass
    finally:
        try:
            db.close()
        except Exception:
            pass


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
