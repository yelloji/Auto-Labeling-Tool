from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from starlette.background import BackgroundTask
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session
from database.models import TrainingSession
from database.database import get_db, SessionLocal
from api.services.model_serialization import serialize_ai_model
from models.training.model_selector import get_trainable_models
from models.training.training_extraction import is_extracted, extract_release_zip
from models.training.config import load_base_config, resolve_config, build_args_preview
from models.training.remote_dispatcher import is_remote_device, parse_remote_device, dispatch_remote_training
from models.training.dataset_summary import summarize_dataset, find_and_summarize
from models.training.yaml_generator import generate_ultralytics_training_yaml
from models.training.executor import start_ultralytics_training
import json
from pathlib import Path
from database.models import Release, Project, DevModeSetting, HumanVerification, Annotation, Dataset, Image as DBImage
from datetime import datetime, timedelta
import uuid
import asyncio
import os
import hashlib
import yaml
import shutil
import subprocess
import sys
import stat
import io
from core.config import settings
from database.models import ModelExperiment, Project
from models.training.validator import ValidatorRegistry
from models.training.predictor import PredictorRegistry
from utils.analytics_engine import calculate_experiment_quality
import re
import psutil
import signal
from PIL import Image
from logging_system.professional_logger import get_professional_logger
from models.training.sahi_prediction_api import router as sahi_prediction_router

logger = get_professional_logger()

router = APIRouter()
router.include_router(sahi_prediction_router)


def _annotation_to_yolo_bbox(annotation: Annotation) -> List[float]:
    """Return normalized YOLO bbox for either normalized or pixel DB annotation coordinates."""
    coords = [annotation.x_min, annotation.y_min, annotation.x_max, annotation.y_max]
    if all(coord is not None and 0 <= float(coord) <= 1 for coord in coords):
        x_min, y_min, x_max, y_max = [float(coord) for coord in coords]
        return [
            ((x_min + x_max) / 2.0),
            ((y_min + y_max) / 2.0),
            (x_max - x_min),
            (y_max - y_min),
        ]

    image = annotation.image
    img_width = float(image.width or 1)
    img_height = float(image.height or 1)
    x_min, y_min, x_max, y_max = [float(coord or 0) for coord in coords]
    return [
        ((x_min + x_max) / 2.0) / img_width,
        ((y_min + y_max) / 2.0) / img_height,
        (x_max - x_min) / img_width,
        (y_max - y_min) / img_height,
    ]

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
        
        project_root = settings.BASE_DIR
        
        # Define relative path for portability (DB storage & YOLO config)
        # projects/gevis/model/training/SESSION_NAME
        # User requested to use 'model' folder (singular) which already exists
        rel_base_dir = Path("projects") / project_name / "model" / "training" / ts.name
        
        # Define absolute path for directory creation
        abs_base_dir = project_root / rel_base_dir
        
        # Create only our custom folders - YOLO will create weights/ when training
        # runs/ is only created by YOLO for inference/prediction
        logs_dir = abs_base_dir / "logs"
        artifacts_dir = abs_base_dir / "artifacts"
        
        for d in [logs_dir, artifacts_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        # Set paths in DB as RELATIVE paths for portability
        # YOLO will create weights/ folder, we just set the path for tracking
        ts.run_dir = str(rel_base_dir)  # Root training dir
        ts.weights_dir = str(rel_base_dir / "weights")  # YOLO creates this
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

        # ── Remote GPU branch ─────────────────────────────────────────────────
        # Detect remote device (e.g. "remote:1:0") before local YAML generation.
        # Local training path below is completely untouched.
        device_val = resolved_config.get('train', {}).get('device', '0')
        if is_remote_device(str(device_val)):
            try:
                node_id, gpu_index = parse_remote_device(str(device_val))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            # Generate full YAML locally using same yaml_generator as local training
            # This ensures all base config defaults + user overrides are included
            # Agent will replace only the path-specific fields (data, model, project)
            import tempfile as _tempfile, os as _os
            remote_resolved = dict(resolved_config)
            if 'train' not in remote_resolved:
                remote_resolved['train'] = {}
            remote_resolved['train']['project'] = str(abs_base_dir.parent)
            remote_resolved['train']['name'] = ts.name
            _tmp = _tempfile.NamedTemporaryFile(suffix='.yaml', delete=False)
            _tmp.close()
            try:
                generate_ultralytics_training_yaml(remote_resolved, _tmp.name, ts.framework, ts.task)
                with open(_tmp.name, 'r', encoding='utf-8') as _f:
                    remote_yaml_content = _f.read()
            finally:
                _os.unlink(_tmp.name)

            # Save config snapshot to DB — same as local training, so Model Lab's
            # Config View can display it for remote trainings too.
            ts.training_config_snapshot = remote_yaml_content

            # Set up local dirs so log WebSocket can find training.log
            ts.status = "running"
            ts.progress_pct = 0
            ts.started_at = datetime.utcnow()
            ts.last_update_at = ts.started_at
            db.add(ts)
            db.commit()

            # Dispatch to remote agent in a background thread
            import threading as _threading
            _threading.Thread(
                target=dispatch_remote_training,
                args=(ts.id, node_id, gpu_index, resolved_config, ts.logs_dir, remote_yaml_content),
                daemon=True,
            ).start()

            return {
                "ok": True,
                "paths": {
                    "run_dir": ts.run_dir,
                    "weights_dir": ts.weights_dir,
                    "logs_dir": ts.logs_dir,
                    "artifacts_dir": ts.artifacts_dir,
                },
                "status": "running",
                "process_started": True,
                "remote": True,
            }
        # ── End remote GPU branch ─────────────────────────────────────────────

        # Use ABSOLUTE path for YOLO project dir (ultralytics 8.4.x breaking change:
        # relative paths get prepended with runs/{task}/ internally, breaking our output dir)
        # DB paths (ts.run_dir, ts.weights_dir etc.) remain relative for portability.
        resolved_config['train']['project'] = str(abs_base_dir.parent)
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

def get_image_md5(file_path: Path) -> Optional[str]:
    """Calculate MD5 hash of a file."""
    if not file_path.exists():
        return None
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def _extract_image_md5_from_metadata(value: Any) -> Optional[str]:
    """Support both legacy md5 strings and newer image metadata objects."""
    if not value:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("md5", "hash", "image_hash_md5"):
            md5_value = value.get(key)
            if isinstance(md5_value, str) and md5_value:
                return md5_value
    return None


class VerificationRequest(BaseModel):
    project_id: int
    image_name: str
    class_name: str
    bbox: List[float] # [x1, y1, x2, y2]
    status: str
    notes: Optional[str] = None
    experiment_id: Optional[str] = None
    is_manual: bool = False

class ManualVerificationRequest(BaseModel):
    project_id: int
    image_name: str
    class_name: str
    bbox: List[float] # [x1, y1, x2, y2]
    experiment_id: Optional[str] = None
    notes: Optional[str] = None

@router.post("/experiments/verify-detection")
async def verify_detection(payload: VerificationRequest, db: Session = Depends(get_db)):
    """Upsert a human verification for a specific detection area."""
    try:
        x_min, y_min, x_max, y_max = payload.bbox
        
        # 1. Resolve Image Hash (MD5)
        image_md5 = None
        if payload.experiment_id:
            exp = db.query(ModelExperiment).get(payload.experiment_id)
            if exp:
                # FIRST: Check if hash is already stored in experiment metadata
                if exp.input_images:
                    try:
                        # input_images can be JSON string or dict: {"filename.png": "md5hash", ...}
                        img_metadata = json.loads(exp.input_images) if isinstance(exp.input_images, str) else exp.input_images
                        if isinstance(img_metadata, dict):
                            metadata_entry = img_metadata.get(payload.image_name)
                            if metadata_entry is None:
                                metadata_entry = img_metadata.get(Path(payload.image_name).name)
                            image_md5 = _extract_image_md5_from_metadata(metadata_entry)
                    except:
                        pass  # If parsing fails, continue to disk fallback
                
                # FALLBACK: Calculate from disk if not found in metadata
                if not image_md5 and exp.output_folder:
                    # First check input_images folder (Stage 1/2 persistence)
                    input_path = Path(exp.output_folder).parent / "input_images" / payload.image_name
                    if input_path.exists():
                        image_md5 = get_image_md5(input_path)
                    else:
                        # Fallback to scanning dataset path if upload persistence wasn't used
                        if exp.dataset_path:
                            ds_path = Path(exp.dataset_path)
                            # Scan recursively for the file
                            matches = list(ds_path.rglob(payload.image_name))
                            if matches:
                                image_md5 = get_image_md5(matches[0])

        # 2. Try to find existing verification in the CURRENT experiment only
        eps = 0.0001
        query = db.query(HumanVerification).filter(
            HumanVerification.project_id == payload.project_id,
            HumanVerification.experiment_id == payload.experiment_id, # Strict Isolation
            HumanVerification.class_name == payload.class_name,
            HumanVerification.x_min >= x_min - eps,
            HumanVerification.x_min <= x_min + eps,
            HumanVerification.y_min >= y_min - eps,
            HumanVerification.y_min <= y_min + eps,
            HumanVerification.x_max >= x_max - eps,
            HumanVerification.x_max <= x_max + eps,
            HumanVerification.y_max >= y_max - eps,
            HumanVerification.y_max <= y_max + eps
        )
        
        # Identity match logic within that experiment
        existing = None
        if image_md5:
            existing = query.filter(HumanVerification.image_hash_md5 == image_md5).first()
        
        if not existing:
            existing = query.filter(HumanVerification.image_name == payload.image_name).first()
        
        # 3. Upsert or Delete
        if payload.status == 'unverified':
            if existing:
                db.delete(existing)
                db.commit()
            return {"status": "unverified", "action": "deleted", "image_hash": image_md5}

        if existing:
            existing.status = payload.status
            existing.notes = payload.notes
            existing.experiment_id = payload.experiment_id
            # If specifically provided as manual, or if it's a 'missing' defect, set is_manual
            if payload.is_manual or payload.status == 'missing':
                existing.is_manual = True
            existing.updated_at = datetime.utcnow()
            # Backfill hash if missing
            if image_md5 and not existing.image_hash_md5:
                existing.image_hash_md5 = image_md5
        else:
            new_v = HumanVerification(
                project_id=payload.project_id,
                image_name=payload.image_name,
                image_hash_md5=image_md5,
                class_name=payload.class_name,
                x_min=x_min,
                y_min=y_min,
                x_max=x_max,
                y_max=y_max,
                status=payload.status,
                notes=payload.notes,
                experiment_id=payload.experiment_id,
                is_manual=payload.is_manual or (payload.status == 'missing')
            )
            db.add(new_v)
            
        db.commit()
        return {"status": "success", "image_hash": image_md5}
    except Exception as e:
        logger.error("errors.system", f"Failed to save verification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/verifications")
async def get_project_verifications(project_id: int, image_name: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieve all human verifications for a project or specific image."""
    query = db.query(
        HumanVerification,
        ModelExperiment.name.label("experiment_name"),
        TrainingSession.name.label("training_name")
    ).outerjoin(
        ModelExperiment, HumanVerification.experiment_id == ModelExperiment.id
    ).outerjoin(
        TrainingSession, ModelExperiment.training_id == TrainingSession.id
    ).filter(
        HumanVerification.project_id == project_id
    ).order_by(
        HumanVerification.updated_at.desc()
    )

    if image_name:
        query = query.filter(HumanVerification.image_name == image_name)
    
    results = query.all()
    
    return [{
        "id": row.HumanVerification.id,
        "image_name": row.HumanVerification.image_name,
        "class_name": row.HumanVerification.class_name,
        "bbox": [row.HumanVerification.x_min, row.HumanVerification.y_min, row.HumanVerification.x_max, row.HumanVerification.y_max],
        "status": row.HumanVerification.status,
        "notes": row.HumanVerification.notes,
        "image_hash_md5": row.HumanVerification.image_hash_md5,
        "experiment_id": row.HumanVerification.experiment_id,
        "experiment_name": row.experiment_name,
        "training_name": row.training_name,
        "is_manual": row.HumanVerification.is_manual,
        "updated_at": row.HumanVerification.updated_at
    } for row in results]

@router.post("/experiments/manual-verification")
async def save_manual_verification(payload: ManualVerificationRequest, db: Session = Depends(get_db)):
    """Save a manually drawn box as a 'Missing Defect' verification."""
    try:
        x_min, y_min, x_max, y_max = payload.bbox
        
        # 1. Resolve Image Hash (MD5)
        image_md5 = None
        if payload.experiment_id:
            exp = db.query(ModelExperiment).get(payload.experiment_id)
            if exp:
                if exp.input_images:
                    try:
                        img_metadata = json.loads(exp.input_images) if isinstance(exp.input_images, str) else exp.input_images
                        if isinstance(img_metadata, dict):
                            image_md5 = img_metadata.get(payload.image_name)
                    except: pass
                
                if not image_md5 and exp.output_folder:
                    input_path = Path(exp.output_folder).parent / "input_images" / payload.image_name
                    if input_path.exists():
                        image_md5 = get_image_md5(input_path)
                    elif exp.dataset_path:
                        ds_path = Path(exp.dataset_path)
                        matches = list(ds_path.rglob(payload.image_name))
                        if matches:
                            image_md5 = get_image_md5(matches[0])

        # 2. Manual boxes are status='missing' (AI missed it) + is_manual=True
        new_v = HumanVerification(
            project_id=payload.project_id,
            image_name=payload.image_name,
            image_hash_md5=image_md5,
            class_name=payload.class_name,
            x_min=x_min,
            y_min=y_min,
            x_max=x_max,
            y_max=y_max,
            status='missing', 
            is_manual=True,
            notes=payload.notes,
            experiment_id=payload.experiment_id
        )
        db.add(new_v)
        db.commit()
        return {"status": "success", "id": new_v.id, "image_hash": image_md5}
    except Exception as e:
        logger.error("errors.system", f"Failed to save manual verification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/manual-verifications")
async def get_manual_verifications(project_id: int, image_name: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieve only manually drawn verifications."""
    query = db.query(HumanVerification).filter(
        HumanVerification.project_id == project_id,
        HumanVerification.is_manual == True
    )
    if image_name:
        query = query.filter(HumanVerification.image_name == image_name)
    
    results = query.all()
    return [{
        "id": v.id,
        "image_name": v.image_name,
        "class_name": v.class_name,
        "bbox": [v.x_min, v.y_min, v.x_max, v.y_max],
        "status": v.status,
        "notes": v.notes,
        "image_hash_md5": v.image_hash_md5,
        "experiment_id": v.experiment_id,
        "updated_at": v.updated_at
    } for v in results]

@router.delete("/experiments/manual-verification/{verification_id}")
async def delete_manual_verification(verification_id: str, db: Session = Depends(get_db)):
    """Delete a manual verification."""
    try:
        v = db.query(HumanVerification).get(verification_id)
        if not v:
            raise HTTPException(status_code=404, detail="Manual verification not found")
        db.delete(v)
        db.commit()
        return {"status": "success", "action": "deleted"}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utils.comparison_engine import calculate_model_delta, calculate_three_way_delta, calculate_split_comparison, calculate_upload_comparison

@router.get("/experiments/compare")
async def compare_experiments(
    project_id: int,
    baseline_id: str,
    challenger_id: str,
    challenger_c_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Compare two or three prediction experiments.

    Auto-detects mode:
    - SPLIT: both experiments used a dataset split (real GT) → returns side-by-side metrics.
    - UPLOAD: experiments used uploaded images → uses human verifications as pseudo-GT.
    """
    try:
        baseline_exp   = db.query(ModelExperiment).filter(ModelExperiment.id == baseline_id).first()
        challenger_exp = db.query(ModelExperiment).filter(ModelExperiment.id == challenger_id).first()

        if not baseline_exp or not challenger_exp:
            raise HTTPException(status_code=404, detail="One or both experiments not found.")

        both_are_split  = (
            baseline_exp.dataset_source not in (None, 'upload') and
            challenger_exp.dataset_source not in (None, 'upload')
        )
        both_are_upload = (
            baseline_exp.dataset_source in (None, 'upload') and
            challenger_exp.dataset_source in (None, 'upload')
        )

        if both_are_split:
            result = calculate_split_comparison(db, baseline_id, challenger_id, challenger_c_id)
        elif both_are_upload:
            result = calculate_upload_comparison(db, project_id, baseline_id, challenger_id, challenger_c_id)
        else:
            result = {"error": "Mixed mode (split + upload) is not supported. Please compare two split experiments or two upload experiments."}

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error("api.compare", f"Failed to compare experiments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/experiments/compare-sahi-pixel")
async def compare_experiments_sahi_pixel(
    baseline_id: str,
    challenger_id: str,
    coverage_mode: str = "length",
    full_coverage_threshold: float = 0.85,
    db: Session = Depends(get_db)
):
    """
    SAHI-aware comparison: uses real pixel-coverage GT matching (groups all
    predictions belonging to one real crack, measures actual pixel/length/width
    overlap) instead of the standard 1-GT-to-1-prediction matcher, which wrongly
    flags real crack fragments (from SAHI tile splitting) as false positives.

    coverage_mode: 'length' (default, gaps only, width-blind), 'width'
    (thickness of what IS detected), or 'total' (raw pixel area, both combined).
    full_coverage_threshold: coverage fraction (0-1) at/above which a GT crack
    counts as TP rather than Partial Missing. Default 0.85 (85%).
    """
    from utils.sahi_comparison_engine import calculate_sahi_pixel_comparison
    try:
        result = calculate_sahi_pixel_comparison(
            db, baseline_id, challenger_id, coverage_mode=coverage_mode,
            full_coverage_threshold=full_coverage_threshold
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error("api.compare_sahi_pixel", f"Failed to compute SAHI pixel comparison: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/experiments/{experiment_id}/sahi-gt-overlay")
async def get_experiment_sahi_gt_overlay(
    experiment_id: str,
    image_name: str,
    coverage_mode: str = "length",
    full_coverage_threshold: float = 0.85,
    db: Session = Depends(get_db)
):
    """
    Real GT polygons + pixel-coverage match result for one image in one
    experiment — powers the live SAHI Prediction image viewer overlay: real
    crack shapes (not boxes), which predictions belong to which GT, coverage
    %, and genuine FP flags (a prediction that overlaps no GT at all).
    """
    from utils.sahi_gt_overlay import get_gt_overlay_for_image
    try:
        result = get_gt_overlay_for_image(
            db, experiment_id, image_name, coverage_mode=coverage_mode,
            full_coverage_threshold=full_coverage_threshold
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error("api.sahi_gt_overlay", f"Failed to compute SAHI GT overlay: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
            "metrics_json": ts.metrics_json,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/training/queued")
async def get_queued_training(project_id: int, db: Session = Depends(get_db)):
    """
    Get queued training session for a project (if exists).
    Used by Advanced Editor to check if there's a training to apply config to.
    """
    try:
        queued = (
            db.query(TrainingSession)
            .filter(TrainingSession.project_id == project_id)
            .filter(TrainingSession.status == "queued")
            .order_by(TrainingSession.created_at.desc())
            .first()
        )
        
        if not queued:
            raise HTTPException(status_code=404, detail="No queued training found")
        
        return {
            "id": queued.id,
            "name": queued.name,
            "status": queued.status,
            "created_at": queued.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/projects/{project_id}/training/{training_id}/apply-config")
async def apply_config_to_training(
    project_id: int,
    training_id: int,
    config: dict,
    db: Session = Depends(get_db)
):
    """
    Apply edited config to a queued training.
    Updates resolved_config_json in the database.
    """
    try:
        # Find the training
        training = (
            db.query(TrainingSession)
            .filter(TrainingSession.id == training_id)
            .filter(TrainingSession.project_id == project_id)
            .filter(TrainingSession.status == "queued")
            .first()
        )
        
        if not training:
            raise HTTPException(
                status_code=404,
                detail="Queued training not found"
            )
        
        # Update resolved_config_json
        training.resolved_config_json = json.dumps(config)
        db.commit()
        
        return {
            "success": True,
            "message": f"Config applied to training '{training.name}'"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
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
            "metrics_json": ts.metrics_json,
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
        project_root = settings.BASE_DIR

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

@router.get("/projects/{project_id}/training/last-completed")
async def get_last_completed_session(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Get the most recent completed training session for a project"""
    try:
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get last completed session
        session = db.query(TrainingSession).filter(
            TrainingSession.project_id == project_id,
            TrainingSession.status == "completed"
        ).order_by(TrainingSession.last_update_at.desc()).first()
        
        if not session:
            return None
        
        return {
            "id": session.id,
            "name": session.name,
            "status": session.status,
            "metrics_json": session.metrics_json,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "last_update_at": session.last_update_at.isoformat() if session.last_update_at else None
        }
    except Exception as e:
        print(f"Error in get_last_completed_session: {str(e)}")  # Log error to console
        raise HTTPException(status_code=500, detail=str(e))    
    
@router.get("/projects/{project_id}/training/sessions")
async def get_project_training_sessions(project_id: int, db: Session = Depends(get_db)):
    """
    Get all training sessions for a project.
    Combines DB records and file system folders.
    """
    try:
        # 1. Get Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # 2. Get DB Sessions
        db_sessions = db.query(TrainingSession).filter(TrainingSession.project_id == project_id).all()
        sessions_map = {s.name: s for s in db_sessions}

        # 3. Scan File System
        # Path: projects/{project_name}/model/training/
        training_dir = settings.PROJECTS_DIR / project.name / "model" / "training"
        
        found_sessions = []
        
        if training_dir.exists():
            for item in training_dir.iterdir():
                if item.is_dir():
                    session_name = item.name
                    
                    # If in DB, use DB record
                    if session_name in sessions_map:
                        s = sessions_map[session_name]
                        
                        # Parse and normalize metrics
                        metrics_data = {}
                        if s.metrics_json:
                            try:
                                metrics_data = json.loads(s.metrics_json)
                            except:
                                pass
                        
                        # Ensure epochs is present
                        if 'epochs' not in metrics_data:
                            if 'training' in metrics_data and 'total_epochs' in metrics_data['training']:
                                metrics_data['epochs'] = metrics_data['training']['total_epochs']
                            elif 'training' in metrics_data and 'epoch' in metrics_data['training']:
                                metrics_data['epochs'] = metrics_data['training']['epoch']

                        found_sessions.append({
                            "id": s.id,
                            "name": s.name,
                            "training_uid": s.training_uid,
                            "task": s.task,
                            "status": s.status,
                            "created_at": s.created_at,
                            "is_managed": True,
                            "description": s.description,
                            "dataset_release_id": s.dataset_release_id,
                            "metrics": json.dumps(metrics_data),
                            "training_config_snapshot": s.training_config_snapshot,
                            "resolved_config_json": s.resolved_config_json,
                            "dataset_summary_json": s.dataset_summary_json
                        })
                    else:
                        # Unmanaged session
                        # Check for best.pt to guess status
                        has_weights = (item / "weights" / "best.pt").exists()
                        status = "completed" if has_weights else "unknown"
                        
                        # Try to get task and epochs from args.yaml
                        task = "unknown"
                        epochs = 0
                        args_path = item / "args.yaml"
                        if args_path.exists():
                            try:
                                with open(args_path, 'r') as f:
                                    args = yaml.safe_load(f)
                                    task = args.get('task', 'unknown')
                                    epochs = args.get('epochs', 0)
                            except:
                                pass
                        
                        # Map YOLO task names to UI names if needed
                        if task == 'detect':
                            task = 'detection'
                        elif task == 'segment':
                            task = 'segmentation'
                        
                        # Try to get creation time from folder
                        try:
                            ctime = item.stat().st_ctime
                            created_at = datetime.fromtimestamp(ctime)
                        except:
                            created_at = datetime.utcnow()

                        # Create metrics dict
                        metrics = {"epochs": epochs}

                        found_sessions.append({
                            "id": f"unmanaged_{session_name}",
                            "name": session_name,
                            "task": task,
                            "status": status,
                            "created_at": created_at,
                            "is_managed": False,
                            "metrics": json.dumps(metrics)
                        })
        
        # Add any DB sessions that weren't found on disk (e.g. queued but not started, or deleted manually)
        for s in db_sessions:
            if not any(fs['name'] == s.name for fs in found_sessions):
                # Parse and normalize metrics
                metrics_data = {}
                if s.metrics_json:
                    try:
                        metrics_data = json.loads(s.metrics_json)
                    except:
                        pass
                
                # Ensure epochs is present
                if 'epochs' not in metrics_data:
                    if 'training' in metrics_data and 'total_epochs' in metrics_data['training']:
                        metrics_data['epochs'] = metrics_data['training']['total_epochs']
                    elif 'training' in metrics_data and 'epoch' in metrics_data['training']:
                        metrics_data['epochs'] = metrics_data['training']['epoch']

                found_sessions.append({
                    "id": s.id,
                    "name": s.name,
                    "task": s.task,
                    "status": s.status,
                    "created_at": s.created_at,
                    "is_managed": True,
                    "description": s.description,
                    "dataset_release_id": s.dataset_release_id,
                    "metrics": json.dumps(metrics_data),
                    "training_config_snapshot": s.training_config_snapshot,
                    "resolved_config_json": s.resolved_config_json,
                    "dataset_summary_json": s.dataset_summary_json
                })

        # Sort by created_at desc
        found_sessions.sort(key=lambda x: x['created_at'] or datetime.min, reverse=True)
        
        return found_sessions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training/session/active")
async def get_active_session(
    project_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get active (queued/running) training session for a project.
    Returns 404 if no active session exists.
    """
    session = db.query(TrainingSession).filter(
        and_(
            TrainingSession.project_id == project_id,
            TrainingSession.status.in_(['queued', 'running'])
        )
    ).order_by(TrainingSession.created_at.desc()).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    
    return {
        "id": session.id,
        "name": session.name,
        "status": session.status,
        "created_at": session.created_at.isoformat() if session.created_at else None
    }


@router.delete("/projects/{project_id}/training/sessions/{session_id}")
async def delete_training_session(
    project_id: int,
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a training session (DB record + file system folder)
    
    Args:
        project_id: Project ID
        session_id: Can be numeric (managed) or string like 'unmanaged_xxx'
    """
    try:
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if session_id is numeric (managed) or unmanaged
        is_managed = session_id.isdigit()
        
        if is_managed:
            # Managed session - delete from DB + FS
            session = db.query(TrainingSession).filter(
                TrainingSession.id == int(session_id),
                TrainingSession.project_id == project_id
            ).first()
            
            if not session:
                raise HTTPException(status_code=404, detail="Training session not found")
            
            # Get folder path
            training_dir = settings.PROJECTS_DIR / project.name / "model" / "training" / session.name
            
            # Delete folder if exists
            if training_dir.exists():
                shutil.rmtree(training_dir)
            
            # Delete DB record
            db.delete(session)
            db.commit()
            
            return {"message": f"Training session '{session.name}' deleted successfully"}
        else:
            # Unmanaged session - delete from FS only
            if not session_id.startswith("unmanaged_"):
                raise HTTPException(status_code=400, detail="Invalid session ID format")
            
            # Extract name
            session_name = session_id.replace("unmanaged_", "")
            
            # Get folder path
            training_dir = settings.PROJECTS_DIR / project.name / "model" / "training" / session_name
            
            # Delete folder if exists
            if not training_dir.exists():
                raise HTTPException(status_code=404, detail="Training folder not found")
            
            shutil.rmtree(training_dir)
            
            return {"message": f"Training session '{session_name}' deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/training/sessions/{session_id}/stop")
async def stop_training_session(
    project_id: int,
    session_id: str,
    db: Session = Depends(get_db)
):
    """Stop a running training session by terminating its subprocess."""
    exp = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Training session not found")

    if exp.status != "running":
        raise HTTPException(status_code=400, detail="Training session is not currently running")

    # Remote training — stop via agent HTTP call
    if exp.remote_job_id and exp.remote_node_id:
        try:
            from database.models import RemoteTrainingNode
            node = db.query(RemoteTrainingNode).filter(RemoteTrainingNode.id == exp.remote_node_id).first()
            if node:
                import requests as _requests
                _requests.post(
                    f"http://{node.host}:{node.port}/agent/stop/{exp.remote_job_id}",
                    timeout=10,
                )
        except Exception as _e:
            logger.warning("operations.training", f"Failed to stop remote job: {_e}", "remote_stop_failed", {"error": str(_e)})
        exp.status = "stopped"
        exp.error_msg = "Stopped by user"
        db.commit()
        return {"message": "Remote training stopped"}

    if not exp.process_pid:
        raise HTTPException(status_code=400, detail="No process PID found for this session")

    try:
        process = psutil.Process(exp.process_pid)
        # Kill entire process tree (parent + all children)
        # This is critical on Windows where YOLO spawns worker subprocesses
        children = process.children(recursive=True)
        for child in children:
            try:
                child.kill()
            except psutil.NoSuchProcess:
                pass
        try:
            process.kill()
        except psutil.NoSuchProcess:
            pass
        # Wait for all to die
        psutil.wait_procs([process] + children, timeout=5)
    except psutil.NoSuchProcess:
        pass
    except Exception:
        # Last resort: Windows taskkill to force-kill process tree
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(exp.process_pid)],
                capture_output=True, timeout=5
            )
        except Exception:
            pass

    exp.status = "stopped"
    exp.process_pid = None
    db.commit()

    logger.info("operations.training", f"Training session {session_id} stopped by user", "training_stop", {
        "session_id": session_id,
        "project_id": project_id,
    })

    return {"message": "Training stopped successfully"}


@router.post("/projects/{project_id}/training/sessions/{session_id}/resume-remote")
async def resume_remote_training_session(
    project_id: int,
    session_id: str,
    db: Session = Depends(get_db)
):
    """Resume polling a remote training job that was marked failed due to connection loss."""
    exp = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Training session not found")
    if not exp.remote_job_id or not exp.remote_node_id:
        raise HTTPException(status_code=400, detail="This session has no remote job to resume")
    if exp.status == "completed":
        raise HTTPException(status_code=400, detail="Training already completed")

    from database.models import RemoteTrainingNode
    from models.training.remote_dispatcher import _poll_remote_training
    node = db.query(RemoteTrainingNode).filter(RemoteTrainingNode.id == exp.remote_node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Remote node not found")

    # Verify the agent is reachable before resuming
    try:
        import requests as _requests
        ping = _requests.get(f"http://{node.host}:{node.port}/agent/status/{exp.remote_job_id}", timeout=10)
        if ping.status_code != 200:
            raise HTTPException(status_code=502, detail="Remote agent not reachable — check your connection and try again")
        remote_status = ping.json().get("status", "unknown")
        if remote_status == "failed":
            raise HTTPException(status_code=400, detail="Remote job also failed on the agent — cannot resume")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach remote agent: {str(e)}")

    # Reset session to running and restart the poller
    exp.status = "running"
    exp.error_msg = None
    db.commit()

    import threading
    poller = threading.Thread(
        target=_poll_remote_training,
        args=(exp.id, exp.remote_node_id, exp.remote_job_id, exp.logs_dir),
        daemon=True,
        name=f"remote-poller-resume-{session_id}",
    )
    poller.start()

    logger.info("operations.training", f"Resumed remote poller for session {session_id}", "remote_poller_resumed", {
        "session_id": session_id,
        "remote_job_id": exp.remote_job_id,
    })
    return {"message": "Remote training poller resumed", "remote_job_id": exp.remote_job_id}


@router.get("/projects/{project_id}/training/{training_id}/confusion_matrix.png")
async def get_confusion_matrix(
    project_id: int,
    training_id: str,
    db: Session = Depends(get_db)
):
    """
    Serve the confusion matrix PNG file for a specific training session.
    training_id can be either the database ID or the session name.
    """
    from fastapi.responses import FileResponse
    
    try:
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Try to get session name
        session_name = training_id
        
        # If training_id is numeric, it's a database ID - look up the name
        if training_id.isdigit():
            session = db.query(TrainingSession).filter(
                TrainingSession.id == int(training_id),
                TrainingSession.project_id == project_id
            ).first()
            if session:
                session_name = session.name
            else:
                # If not in DB, training_id might be the folder name directly
                session_name = training_id
        
        # Build path to confusion matrix
        confusion_matrix_path = (
            settings.PROJECTS_DIR / 
            project.name / 
            "model" / 
            "training" / 
            session_name / 
            "confusion_matrix.png"
        )
        
        # Check if file exists
        if not confusion_matrix_path.exists():
            raise HTTPException(status_code=404, detail="Confusion matrix not found")
        
        # Return the PNG file
        return FileResponse(
            path=str(confusion_matrix_path),
            media_type="image/png",
            filename="confusion_matrix.png"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/training/{training_id}/analytics")
async def get_training_analytics(
    project_id: int,
    training_id: str,
    db: Session = Depends(get_db)
):
    """
    Parse results.csv and return chart data for Analytics view.
    Returns epoch-wise training/validation losses and metrics.
    """
    import csv
    
    try:
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get session name from DB if training_id is numeric
        session_name = training_id
        if training_id.isdigit():
            session = db.query(TrainingSession).filter(
                TrainingSession.id == int(training_id),
                TrainingSession.project_id == project_id
            ).first()
            if session:
                session_name = session.name
        
        # Build path to results.csv
        results_csv_path = (
            settings.PROJECTS_DIR /
            project.name /
            "model" /
            "training" /
            session_name /
            "results.csv"
        )
        
        if not results_csv_path.exists():
            raise HTTPException(status_code=404, detail="Training results not found")
        
        # Parse CSV
        epochs = []
        train_losses = {"box": [], "seg": [], "cls": []}
        val_losses = {"box": [], "seg": [], "cls": []}
        metrics = {
            "box_map50": [], "box_map50_95": [],
            "box_precision": [], "box_recall": [],
            "mask_map50": [], "mask_map50_95": [],
            "mask_precision": [], "mask_recall": []
        }
        
        with open(results_csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Skip empty rows or rows with empty epoch
                if not row.get('epoch') or not row.get('epoch').strip():
                    continue
                
                try:
                    epochs.append(int(float(row['epoch'].strip())))
                except (ValueError, KeyError):
                    continue
                
                # Helper function to safely get float value
                def safe_float(key, default=0.0):
                    try:
                        val = row.get(key, '').strip()
                        return float(val) if val else default
                    except (ValueError, AttributeError):
                        return default
                
                # Training losses
                train_losses["box"].append(safe_float('train/box_loss'))
                train_losses["cls"].append(safe_float('train/cls_loss'))
                if 'train/seg_loss' in row and row.get('train/seg_loss', '').strip():
                    train_losses["seg"].append(safe_float('train/seg_loss'))
                
                # Validation losses
                val_losses["box"].append(safe_float('val/box_loss'))
                val_losses["cls"].append(safe_float('val/cls_loss'))
                if 'val/seg_loss' in row and row.get('val/seg_loss', '').strip():
                    val_losses["seg"].append(safe_float('val/seg_loss'))
                
                # Metrics
                metrics["box_precision"].append(safe_float('metrics/precision(B)'))
                metrics["box_recall"].append(safe_float('metrics/recall(B)'))
                metrics["box_map50"].append(safe_float('metrics/mAP50(B)'))
                metrics["box_map50_95"].append(safe_float('metrics/mAP50-95(B)'))
                
                # Mask metrics (if segmentation)
                if 'metrics/precision(M)' in row and row.get('metrics/precision(M)', '').strip():
                    metrics["mask_precision"].append(safe_float('metrics/precision(M)'))
                    metrics["mask_recall"].append(safe_float('metrics/recall(M)'))
                    metrics["mask_map50"].append(safe_float('metrics/mAP50(M)'))
                    metrics["mask_map50_95"].append(safe_float('metrics/mAP50-95(M)'))
        
        # Determine if segmentation
        is_segmentation = len(train_losses["seg"]) > 0
        
        # Clean up empty arrays for detection tasks
        if not is_segmentation:
            train_losses.pop("seg", None)
            val_losses.pop("seg", None)
            metrics = {k: v for k, v in metrics.items() if not k.startswith("mask")}
        
        return {
            "epochs": epochs,
            "train_losses": train_losses,
            "val_losses": val_losses,
            "metrics": metrics,
            "is_segmentation": is_segmentation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Training completion notification endpoints

@router.get("/training/completion-check")
async def check_training_completions(db: Session = Depends(get_db)):
    """
    Check for completed or failed trainings that haven't been acknowledged.
    Returns all unacknowledged completed/failed trainings.
    """
    recent_completions = db.query(TrainingSession).filter(
        TrainingSession.status.in_(["completed", "failed"]),  # Both success AND failure!
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
            "status": session.status,
            "description": session.description,
            "dataset_release_id": session.dataset_release_id,
            "resolved_config_json": session.resolved_config_json,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "duration": duration,
            "error_msg": session.error_msg if session.status == "failed" else None
        })
    
    # Check for any active trainings (only RUNNING)
    # Queued = Draft mode, so we don't need fast polling yet
    active_count = db.query(TrainingSession).filter(
        TrainingSession.status == "running"
    ).count()
    
    return {
        "completions": results,
        "has_active_trainings": active_count > 0,
        "active_count": active_count
    }


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

# --- Validation  API ---

class ValidationRequest(BaseModel):
    name: Optional[str] = None
    dataset_source: str = "val"  # 'val' or 'test'
    confidence: float = 0.25
    iou_threshold: float = 0.45
    imgsz: int = 640
    batch: int = 16
    device: str = "0"
    max_detections: int = 300
    weights_type: str = "best"
    task: str = "detection"
    custom_params: Optional[Dict[str, Any]] = None

class ValidationUpdate(BaseModel):
    name: Optional[str] = None
    dataset_source: Optional[str] = None
    confidence: Optional[float] = None
    iou_threshold: Optional[float] = None
    imgsz: Optional[int] = None
    weights_type: Optional[str] = None
    task: Optional[str] = None
    max_detections: Optional[int] = None
    custom_params: Optional[Dict[str, Any]] = None

@router.get("/training/{training_id}/validation/queued")
async def get_queued_validation(training_id: int, db: Session = Depends(get_db)):
    """Find existing queued validation experiment for a model."""
    exp = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.status == "queued",
            ModelExperiment.experiment_type == "validation"  # Only return validation experiments
        )
        .first()
    )
    return exp

@router.patch("/experiments/{experiment_id}")
async def update_experiment(experiment_id: str, payload: ValidationUpdate, db: Session = Depends(get_db)):
    """Update specific fields of an experiment (real-time sync)."""
    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    update_data = payload.dict(exclude_unset=True)
    
    # If dataset_source changed, recalculate image_count
    if 'dataset_source' in update_data:
        ts = db.query(TrainingSession).filter(TrainingSession.id == exp.training_id).first()
        if ts and ts.dataset_summary_json:
            try:
                summary = json.loads(ts.dataset_summary_json) if isinstance(ts.dataset_summary_json, str) else ts.dataset_summary_json
                splits = summary.get('splits', {})
                new_count = splits.get(update_data['dataset_source'], None)
                if new_count is not None:
                    exp.image_count = new_count
            except Exception as e:
                logger.warning("errors.system", f"Failed to recalculate image_count: {e}", "update_experiment_image_count_failed")
    
    for key, value in update_data.items():
        setattr(exp, key, value)
        
    db.commit()
    db.refresh(exp)
    return exp

# Removed run_validation_task (Legacy Thread-based logic)
# This has been replaced by models.training.validation_executor and subprocess calls.

@router.post("/training/{training_id}/validation/init")
async def init_validation(training_id: int, payload: ValidationRequest, db: Session = Depends(get_db)):
    """Initialize a new validation record or return existing queued one."""
    existing = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == "validation",  # Only check for validation experiments
            ModelExperiment.status == "queued"
        )
        .first()
    )
    if existing:
        return existing
        
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Get project for denormalized name
    project = db.query(Project).filter(Project.id == ts.project_id).first()
    
    # Calculate image_count from dataset_summary_json
    image_count = None
    if ts.dataset_summary_json:
        try:
            summary = json.loads(ts.dataset_summary_json) if isinstance(ts.dataset_summary_json, str) else ts.dataset_summary_json
            splits = summary.get('splits', {})
            image_count = splits.get(payload.dataset_source, None)
        except Exception as e:
            logger.warning("errors.system", f"Failed to parse dataset_summary_json: {e}", "init_validation_summary_parse_failed")
        
    exp = ModelExperiment(
        id=str(uuid.uuid4()),
        training_id=ts.id,
        project_id=ts.project_id,
        project_name=project.name if project else None,
        training_name=ts.name,
        name=payload.name or "",
        experiment_type="validation",
        framework=ts.framework or "ultralytics",
        task=ts.task,
        dataset_source=payload.dataset_source,
        dataset_path=ts.dataset_release_dir,
        image_count=image_count,
        confidence=payload.confidence,
        iou_threshold=payload.iou_threshold,
        imgsz=payload.imgsz,
        weights_type=payload.weights_type,
        status="queued"
    )
    
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp

@router.post("/training/{training_id}/validate")
async def trigger_validation(
    training_id: int, 
    payload: ValidationRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")

    # Resume existing draft if available
    experiment = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.status == "queued"
        )
        .first()
    )
    
    if experiment:
        # Finalize settings from UI
        experiment.name = payload.name
        experiment.dataset_source = payload.dataset_source
        experiment.confidence = payload.confidence
        experiment.iou_threshold = payload.iou_threshold
        experiment.imgsz = payload.imgsz
        experiment.weights_type = payload.weights_type
        experiment.custom_params = payload.custom_params
    else:
        # Fallback if UI somehow triggered without init
        # Get project for denormalized name
        project = db.query(Project).filter(Project.id == ts.project_id).first()
        
        experiment = ModelExperiment(
            id=str(uuid.uuid4()),
            training_id=ts.id,
            project_id=ts.project_id,
            project_name=project.name if project else None,
            training_name=ts.name,
            name=payload.name,
            experiment_type="validation",
            framework=ts.framework or "ultralytics",
            task=ts.task,
            dataset_source=payload.dataset_source,
            dataset_path=ts.dataset_release_dir,
            confidence=payload.confidence,
            iou_threshold=payload.iou_threshold,
            imgsz=payload.imgsz,
            weights_type=payload.weights_type,
            status="queued"
        )
        db.add(experiment)
    
    db.commit()
    db.refresh(experiment)

    # --- Start Validation Subprocess ---
    try:
        # Resolve paths (Moved from run_validation_task)
        project_root = settings.BASE_DIR
        
        # 1. Weights Path
        weights_filename = "best.pt"
        if payload.weights_type == 'last':
            weights_filename = "last.pt"

        weights_path = None
        candidates = []
        if ts.weights_dir:
            candidates.append(project_root / ts.weights_dir / weights_filename)
        if ts.run_dir:
            candidates.append(project_root / ts.run_dir / "weights" / weights_filename)
            
        for c in candidates:
            if c.exists():
                weights_path = c.as_posix()
                break
        
        if not weights_path:
            raise FileNotFoundError(f"Weights {weights_filename} not found in {candidates}")

        # 2. Dataset YAML Path
        dataset_yaml = None
        if ts.dataset_release_dir:
            y_path = project_root / ts.dataset_release_dir / "data.yaml"
            if y_path.exists():
                dataset_yaml = y_path.as_posix()
        
        if not dataset_yaml:
            raise FileNotFoundError(f"data.yaml not found for training {ts.name}")

        # 3. Output Folder Path
        safe_name = re.sub(r'[^\w\-_]', '_', experiment.name or 'unnamed')
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        folder_name = f"{safe_name}_{timestamp}"
        
        rel_output_dir = Path(ts.run_dir) / "experiments" / folder_name
        abs_output_dir = project_root / rel_output_dir
        
        # Ensure directory exists for logger/PID files
        os.makedirs(abs_output_dir, exist_ok=True)

        # 4. Launch Subprocess
        executor_path = (Path(__file__).parent / "validation_executor.py").as_posix()
        params_json = json.dumps(payload.dict())
        
        log_file_path = abs_output_dir / "validation.log"
        log_file = open(log_file_path, "w", encoding="utf-8")
        
        # Set environment for unbuffered logging and UTF-8 encoding
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        # Ensure exe mode flag is explicitly set so multiprocessing worker processes
        # spawned by Ultralytics also use AppData paths for logging (not Program Files)
        if os.environ.get("GEVIS_EXE_MODE") == "1":
            env["GEVIS_EXE_MODE"] = "1"

        command = [
            sys.executable,
            executor_path,
            "--experiment_id", str(experiment.id),
            "--weights_path", weights_path,
            "--dataset_yaml", dataset_yaml,
            "--output_folder", abs_output_dir.as_posix(),
            "--params_json", params_json
        ]

        # Use CREATE_NEW_PROCESS_GROUP on Windows to avoid orphan processes if server dies
        creation_flags = 0
        if os.name == 'nt':
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

        process = subprocess.Popen(
            command,
            cwd=project_root.as_posix(),
            creationflags=creation_flags,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            env=env
        )
        
        # Record the PID immediately
        experiment.process_pid = process.pid
        experiment.status = "running"
        db.commit()
        
        logger.info("operations.training", f"Started validation subprocess PID {process.pid}", "validation_subprocess_started")

    except Exception as e:
        logger.error("errors.system", f"Failed to launch validation subprocess: {str(e)}", "validation_launch_failure")
        experiment.status = "failed"
        experiment.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to start validation: {str(e)}")

    return {"experiment_id": experiment.id, "status": "running"}

@router.get("/experiments/{experiment_id}")
async def get_experiment_details(experiment_id: str, db: Session = Depends(get_db)):
    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp

@router.get("/training/{training_id}/experiments")
async def list_training_experiments(training_id: int, db: Session = Depends(get_db)):
    exps = db.query(ModelExperiment).filter(ModelExperiment.training_id == training_id).order_by(ModelExperiment.created_at.desc()).all()
    return exps


@router.get("/experiments/{experiment_id}/images")
async def list_experiment_images(experiment_id: str, db: Session = Depends(get_db)):
    """List result images (filenames) in an experiment."""
    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # NEW ELITE STRATEGY: Use the Database as the source of truth
    # This restores images in the UI even if the output_folder is empty (zero-copy mode)
    image_files = []
    if exp.predictions:
        try:
            # predictions is stored as a JSON dict {filename: detections}
            preds = json.loads(exp.predictions) if isinstance(exp.predictions, str) else exp.predictions
            if preds and isinstance(preds, dict):
                image_files = sorted(list(preds.keys()))
                if image_files:
                    return image_files
        except Exception as e:
            logger.warning("errors.system", f"Failed to parse predictions for {experiment_id}: {e}", "list_experiment_images_db_failed")
    
    # FALLBACK: Traditional folder scan (for legacy experiments or local uploads)
    if not exp.output_folder:
        return []
    
    project_root = settings.BASE_DIR

    full_path = (project_root / exp.output_folder).resolve()
    if not full_path.exists() or not full_path.is_dir():
        return []
    
    valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
    for f in full_path.rglob('*'):
        if f.is_file() and f.suffix.lower() in valid_exts:
            rel_path = f.relative_to(full_path)
            image_files.append(rel_path.as_posix())
            
    image_files.sort()
    return image_files


@router.get("/gpu-status")
async def get_gpu_status():
    """Return current GPU utilization and memory for live display during inference."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,name",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            parts = [p.strip() for p in result.stdout.strip().split(',')]
            return {
                "available": True,
                "utilization": int(parts[0]),
                "memory_used_mb": int(parts[1]),
                "memory_total_mb": int(parts[2]),
                "device_name": parts[3] if len(parts) > 3 else "GPU"
            }
    except Exception:
        pass
    return {"available": False, "utilization": 0, "memory_used_mb": 0, "memory_total_mb": 0, "device_name": "CPU"}


def _project_image_cache_path(db, exp, original_path, kind: str, size: int = 0):
    """Where a resized copy of one source image lives, keyed by the image's md5.

    The md5 comes from the image row when it is known, and is otherwise computed
    from the file, so images that were never registered still get a stable key.
    Falls back to the file stem only if both fail, which merely loses sharing
    between experiments rather than breaking the cache.
    """
    import hashlib
    from utils import project_cache
    from utils.experiment_image_resolver import resolve_experiment_image

    md5 = None
    try:
        row = resolve_experiment_image(db, exp, original_path.name)
        md5 = getattr(row, "image_hash_md5", None) if row else None
    except Exception:
        md5 = None
    if not md5:
        try:
            h = hashlib.md5()
            with open(original_path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            md5 = h.hexdigest()
        except OSError:
            md5 = original_path.stem

    project = project_cache.resolve_project_name(exp) or "_unknown"
    if kind == "preview":
        return project_cache.preview_path(project, md5)
    return project_cache.thumb_path(project, md5, size)


@router.get("/experiments/{experiment_id}/original-image/{filename:path}")
async def get_experiment_original_image(
    experiment_id: str, 
    filename: str, 
    download: bool = False,
    thumbnail: bool = False,
    preview: bool = False,
    size: int = 256,
    db: Session = Depends(get_db)
):
    """
    Serve the clean, un-annotated original image for a prediction result.
    If download=True, force a 'Save As' dialog.

    Three tiers, because these originals are ~17MB PNGs at 6560x4948:
      thumbnail=True  small JPEG for the gallery grid (<=1024px)
      preview=True    display-resolution JPEG for the viewer to paint
                      immediately while the original is still arriving
      neither         the untouched original, which is what the viewer
                      ultimately shows and what zooming inspects
    """
    # Serving a picture needs this experiment's paths, never its predictions -
    # and that column holds several megabytes of JSON. Loading it cost ~257ms of
    # blocking work per request rather than ~17ms, on an async endpoint, so it
    # stalled the whole server while the viewer asked for a preview, its two
    # neighbours and the original. Deferred: it loads only if something reads it.
    from sqlalchemy.orm import defer as _defer
    exp = (
        db.query(ModelExperiment)
        .options(_defer(ModelExperiment.predictions))
        .filter(ModelExperiment.id == experiment_id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    project_root = settings.BASE_DIR

    original_path = None

    # SAHI prediction runs on full dataset-stage originals. Those paths are
    # recorded in the per-run manifest because dataset_source is not train/val/test.
    if exp.experiment_type == "sahi_prediction" and exp.output_folder:
        try:
            output_dir = (project_root / exp.output_folder).resolve()
            manifest_path = output_dir / "sahi_prediction_inputs.json"
            requested_name = Path(filename).name
            if manifest_path.exists():
                with open(manifest_path, "r", encoding="utf-8") as manifest_file:
                    manifest_images = json.load(manifest_file)
                for image_path_str in manifest_images:
                    raw = Path(image_path_str)
                    # Manifest may store relative paths (portable) or legacy absolute paths
                    candidate = raw if raw.is_absolute() else (project_root / raw)
                    candidate = candidate.resolve()
                    if candidate.name == requested_name and candidate.exists():
                        original_path = candidate
                        break
        except Exception as e:
            logger.warning(
                "errors.system",
                f"Failed to resolve SAHI original image for {filename}: {e}",
                "sahi_original_image_resolve_failed",
                {"experiment_id": experiment_id}
            )
    
    # 1. Handle dataset sources (train/val/test)
    if not original_path and exp.dataset_source in ['train', 'val', 'test']:
        if not exp.dataset_path:
            raise HTTPException(status_code=400, detail="Experiment has no dataset path")
            
        # SMART PATH RESOLUTION:
        # Check if dataset_path already includes the split (Phase 2.3 granularity)
        base_path = project_root / exp.dataset_path
        if f"images/{exp.dataset_source}" in exp.dataset_path.replace('\\', '/'):
            # Already granular!
            potential_path = base_path / filename
        else:
            # Standard root path logic
            potential_path = base_path / "images" / exp.dataset_source / filename
            
        if potential_path.exists():
            original_path = potential_path
        else:
            # Fallback search
            stem = Path(filename).stem
            search_dir = potential_path.parent
            for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']:
                p = search_dir / f"{stem}{ext}"
                if p.exists():
                    original_path = p
                    break
                    
    # 2. Handle uploaded source
    elif not original_path and exp.dataset_source == 'upload':
        if not exp.dataset_path:
            raise HTTPException(status_code=400, detail="Experiment has no upload path")
            
        potential_path = project_root / exp.dataset_path / filename
        if potential_path.exists():
            original_path = potential_path
        else:
            # Fallback search
            stem = Path(filename).stem
            for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']:
                p = project_root / exp.dataset_path / f"{stem}{ext}"
                if p.exists():
                    original_path = p
                    break
    
    # Fallback for SAHI experiments: manifest path is stale (old absolute path, moved files).
    # Search the project's current dataset images in the DB by filename.
    if not original_path and exp.experiment_type == "sahi_prediction" and exp.project_id:
        try:
            from utils.experiment_image_resolver import resolve_experiment_image
            # Resolved by the md5 the experiment recorded. The same filename can
            # belong to a different photograph from another shoot, and serving
            # that one would draw this image's cracks over the wrong picture.
            db_image = resolve_experiment_image(db, exp, filename)
            if db_image and db_image.file_path:
                raw = Path(db_image.file_path)
                candidate = raw if raw.is_absolute() else (project_root / raw).resolve()
                if candidate.exists():
                    original_path = candidate
        except Exception as e:
            logger.warning("errors.system", f"SAHI DB fallback failed for {filename}: {e}", "sahi_db_fallback_failed")

    if not original_path or not original_path.exists():
        logger.warning("errors.system", f"Original source image not found for {filename} in {exp.dataset_source}", "original_image_not_found")
        raise HTTPException(status_code=404, detail="Original image not found on disk")
        
    if download:
        return FileResponse(
            str(original_path), 
            media_type='application/octet-stream',
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    if preview:
        # Painted first so the viewer is never blank. The original follows and
        # replaces it, so this only ever affects what is on screen during the
        # seconds the real file is still downloading - never what is inspected.
        try:
            PREVIEW_SIZE = 2560
            # Keyed by the image's own md5 inside the project's cache folder: a
            # resized copy depends on the photograph alone, so every experiment
            # that uses this image shares one file instead of writing its own.
            cached_preview = _project_image_cache_path(db, exp, original_path, "preview")
            cached_preview.parent.mkdir(parents=True, exist_ok=True)

            if not cached_preview.exists():
                with Image.open(original_path) as img:
                    if img.mode == "RGBA":
                        bg = Image.new("RGB", img.size, (255, 255, 255))
                        bg.paste(img, mask=img.split()[3])
                        img = bg
                    elif img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")
                    img.thumbnail((PREVIEW_SIZE, PREVIEW_SIZE), Image.Resampling.LANCZOS)
                    img.save(cached_preview, format="JPEG", quality=88, optimize=True)

            return FileResponse(str(cached_preview), media_type="image/jpeg")
        except Exception as e:
            logger.warning(
                "errors.system",
                f"Failed to generate preview for {filename}: {e}",
                "prediction_preview_generation_failed",
                {"experiment_id": experiment_id, "filename": filename}
            )
            # Fall through and serve the original: a missing preview should cost
            # speed, never the image itself.

    if thumbnail:
        try:
            thumb_size = max(32, min(size, 1024))
            # Keyed by md5 inside the project's cache folder, same reasoning as
            # the preview: keying by experiment stored the same picture once per
            # experiment, which had already duplicated most of this cache.
            cached = _project_image_cache_path(db, exp, original_path, "thumb", thumb_size)
            cached.parent.mkdir(parents=True, exist_ok=True)

            if not cached.exists():
                with Image.open(original_path) as img:
                    if img.mode not in ("RGB", "RGBA", "L"):
                        img = img.convert("RGB")
                    if img.mode == "RGBA":
                        bg = Image.new("RGB", img.size, (255, 255, 255))
                        bg.paste(img, mask=img.split()[3])
                        img = bg
                    img.thumbnail((thumb_size, thumb_size), Image.Resampling.LANCZOS)
                    img.save(cached, format="JPEG", quality=85, optimize=True)

            return FileResponse(str(cached), media_type="image/jpeg")
        except Exception as e:
            logger.warning(
                "errors.system",
                f"Failed to generate prediction thumbnail for {filename}: {e}",
                "prediction_thumbnail_generation_failed",
                {"experiment_id": experiment_id, "filename": filename, "size": size}
            )

    return FileResponse(str(original_path))


@router.delete("/experiments/{experiment_id}")
async def delete_experiment(experiment_id: str, db: Session = Depends(get_db)):
    """Delete an experiment record (DB only for now, filesystem cleanup TODO)."""
    def force_remove_readonly(func, path, _):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            raise

    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # 1. Handle active processes safely
    if exp.status == "running" and exp.process_pid:
        try:
            process = psutil.Process(exp.process_pid)
            if process.is_running():
                logger.info("operations.training", f"Terminating active process {exp.process_pid} before deletion", "experiment_process_termination")
                process.terminate()
                process.wait(timeout=3)
        except (Exception):
            # Fallback to os.kill if psutil fails
            try:
                os.kill(exp.process_pid, signal.SIGTERM)
            except Exception:
                pass

    # 2. Resolve project root for safe path calculation
    project_root = settings.BASE_DIR

    # 3. Safe Filesystem Cleanup
    if exp.output_folder:
        # Convert to Path object for validation
        output_rel_path = Path(exp.output_folder)
        
        # SAFETY CHECK 1: Ensure it's not an absolute path pointing to system folders
        if output_rel_path.is_absolute():
            logger.warning("errors.validation", f"Blocked absolute path deletion: {exp.output_folder}", "unsafe_deletion_blocked")
        else:
            # SAFETY CHECK 2: Ensure it is inside a 'projects' and 'experiments' hierarchy
            # This prevents someone from putting '../../' in the DB to delete the whole repo
            full_path = (project_root / output_rel_path).resolve()
            
            # Must be inside project_root/projects
            is_inside_projects = str(full_path.as_posix()).startswith((project_root / "projects").as_posix())
            is_in_experiments = "experiments" in str(full_path.as_posix())
            
            if is_inside_projects and is_in_experiments and full_path.exists() and full_path.is_dir():
                try:
                    logger.info("operations.training", f"Deleting experiment folder: {full_path}", "experiment_folder_deleted")
                    shutil.rmtree(full_path, onerror=force_remove_readonly)
                except Exception as e:
                    logger.error("errors.system", f"Failed to delete experiment folder: {str(e)}", "experiment_folder_delete_failure")
            else:
                logger.warning("errors.validation", f"Blocked unsafe/non-existent path deletion: {full_path}", "unsafe_deletion_blocked")

    # 4. NEW: Cleanup Temporary Dataset Path (if it's an upload)
    if exp.dataset_path and "prediction_temp" in str(exp.dataset_path):
        temp_rel_path = Path(exp.dataset_path)
        if not temp_rel_path.is_absolute():
            full_temp_path = (project_root / temp_rel_path).resolve()
            # Safety check: must be inside prediction_temp
            if "prediction_temp" in str(full_temp_path.as_posix()) and full_temp_path.exists() and full_temp_path.is_dir():
                try:
                    logger.info("operations.training", f"Deleting temporary source folder: {full_temp_path}", "temp_source_deleted")
                    shutil.rmtree(full_temp_path, onerror=force_remove_readonly)
                except Exception as e:
                    logger.error("errors.system", f"Failed to delete temp source: {str(e)}", "temp_source_delete_failure")

    # 4. Delete associated Human Verifications (cleanup matching records)
    db.query(HumanVerification).filter(HumanVerification.experiment_id == experiment_id).delete()

    # Drop this experiment's cached GT overlays. Previews and thumbnails are
    # deliberately kept: they are keyed by the image's md5 and describe the
    # photograph, not the experiment, so other experiments on the same images
    # still need them.
    from utils.overlay_cache import clear_experiment as clear_overlay_cache
    clear_overlay_cache(experiment_id, getattr(exp, "project_name", None))

    # Legacy per-experiment cache folders at the app root, from before these
    # moved inside the project. Removed here so they drain away over time.
    for legacy in ("thumb_cache", "preview_cache", "overlay_cache"):
        old = settings.BASE_DIR / legacy / experiment_id
        if old.exists():
            try:
                shutil.rmtree(old)
            except Exception:
                pass

    # 5. Delete the database record
    db.delete(exp)
    db.commit()
    
    logger.info("operations.training", f"Deleted experiment {experiment_id}", "experiment_deleted", {
        "experiment_id": experiment_id,
        "training_id": exp.training_id,
        "status": exp.status
    })
    
    return {"success": True, "message": "Experiment deleted successfully"}


@router.get("/experiments/{experiment_id}/download")
async def download_experiment_results(experiment_id: str, db: Session = Depends(get_db)):
    """Zip and download the annotated images and predictions.json."""
    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if not exp.output_folder:
        raise HTTPException(status_code=400, detail="Experiment has no output files")

    # Resolve project root
    project_root = settings.BASE_DIR
    
    abs_output_dir = (project_root / exp.output_folder).resolve()
    if not abs_output_dir.exists():
        raise HTTPException(status_code=404, detail="Result folder not found on disk")

    # Create a temporary ZIP file path
    zip_filename = f"prediction_{exp.name or exp.id}.zip"
    temp_zip_path = Path(abs_output_dir).parent / f"{exp.id}_download.zip"
    
    # Use shutil to create the archive
    # base_name is the archive name without .zip
    try:
        shutil.make_archive(str(temp_zip_path.with_suffix('')), 'zip', abs_output_dir)
    except Exception as e:
        logger.error("errors.system", f"Failed to create ZIP archive: {e}", "zip_creation_failed")
        raise HTTPException(status_code=500, detail="Failed to create result archive")

    def cleanup_temp_file():
        if temp_zip_path.exists():
            try:
                os.remove(temp_zip_path)
            except Exception:
                pass

    return FileResponse(
        path=str(temp_zip_path), 
        filename=zip_filename, 
        media_type="application/zip",
        background=BackgroundTask(cleanup_temp_file)
    )


@router.get("/experiments/{experiment_id}/quality-stats")
async def get_experiment_quality_stats(experiment_id: str, db: Session = Depends(get_db)):
    """
    Calculate and return real-time quality metrics for an experiment.
    Compares predictions with ground truth from annotations.json.
    """
    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    # Resolve project root (portable logic)
    project_root = settings.BASE_DIR
    
    stats = calculate_experiment_quality(exp, project_root)
    return stats


# =============================================================================
# PREDICTION API ENDPOINTS
# =============================================================================

class PredictionRequest(BaseModel):
    """Request model for prediction experiments"""
    name: str
    dataset_source: str = "test"  # 'test', 'val', 'train', 'upload'
    confidence: float = 0.25
    iou_threshold: float = 0.45
    imgsz: int = 640
    batch: int = 1  # Standard default for best accuracy
    half: bool = False # Standard default for compatibility
    weights_type: str = "best"  # 'best' or 'last'
    task: str = "detect"  # 'detect' or 'segment'
    max_det: int = 300
    device: str = "0"
    custom_params: Optional[Dict[str, Any]] = None
    # For upload source
    uploaded_images: Optional[List[str]] = None  # List of image paths for upload source


class PredictionUpdate(BaseModel):
    """Update model for prediction experiments"""
    name: Optional[str] = None
    dataset_source: Optional[str] = None
    confidence: Optional[float] = None
    iou_threshold: Optional[float] = None
    imgsz: Optional[int] = None
    batch: Optional[int] = None
    half: Optional[bool] = None
    weights_type: Optional[str] = None
    task: Optional[str] = None
    max_det: Optional[int] = None
    device: Optional[str] = None
    custom_params: Optional[Dict[str, Any]] = None
    uploaded_images: Optional[List[str]] = None


@router.get("/training/{training_id}/prediction/queued")
async def get_queued_prediction(training_id: int, db: Session = Depends(get_db)):
    """Find existing queued prediction experiment for a model."""
    exp = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == "prediction",
            ModelExperiment.status == "queued"
        )
        .first()
    )
    return exp


@router.post("/training/{training_id}/prediction/init")
async def init_prediction(training_id: int, payload: PredictionRequest, db: Session = Depends(get_db)):
    """Initialize a new prediction record or return existing queued one."""
    # Check for existing queued prediction
    existing = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == "prediction",
            ModelExperiment.status == "queued"
        )
        .first()
    )
    if existing:
        return existing
        
    # Get training session
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")
    
    # Get project for denormalized name
    project = db.query(Project).filter(Project.id == ts.project_id).first()
    
    # Calculate image_count from dataset_summary_json for dataset sources
    image_count = None
    if payload.dataset_source in ['test', 'val', 'train']:
        if ts.dataset_summary_json:
            try:
                summary = json.loads(ts.dataset_summary_json) if isinstance(ts.dataset_summary_json, str) else ts.dataset_summary_json
                splits = summary.get('splits', {})
                image_count = splits.get(payload.dataset_source, None)
            except Exception as e:
                logger.warning("errors.system", f"Failed to parse dataset_summary_json: {e}", "init_prediction_summary_parse_failed")
    elif payload.dataset_source == 'upload' and payload.uploaded_images:
        image_count = len(payload.uploaded_images)
        
    # Create prediction experiment
    exp = ModelExperiment(
        id=str(uuid.uuid4()),
        training_id=ts.id,
        project_id=ts.project_id,
        project_name=project.name if project else None,
        training_name=ts.name,
        name=payload.name or "",
        experiment_type="prediction",
        framework=ts.framework or "ultralytics",
        task=payload.task or ts.task,
        dataset_source=payload.dataset_source,
        dataset_path=ts.dataset_release_dir if payload.dataset_source in ['test', 'val', 'train'] else None,
        image_count=image_count,
        confidence=payload.confidence,
        iou_threshold=payload.iou_threshold,
        imgsz=payload.imgsz,
        batch=payload.batch,
        half=payload.half,
        weights_type=payload.weights_type,
        input_images=payload.uploaded_images,  # Store uploaded image paths
        status="queued"
    )
    
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/training/{training_id}/prediction/upload-images")
async def upload_prediction_images(
    training_id: int,
    experiment_id: str = Query(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload multiple images for a specific prediction experiment.
    Images are saved to a temporary 'prediction_temp' folder in the project.
    """
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")
        
    exp = db.query(ModelExperiment).filter(
        ModelExperiment.id == experiment_id,
        ModelExperiment.training_id == training_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    project = db.query(Project).filter(Project.id == ts.project_id).first()
    project_name = project.name if project else "unknown"
    
    # Resolve Project Root (portable logic)
    project_root = settings.BASE_DIR

    # Define and create temp storage directory
    # Standard: projects/{project_name}/model/prediction_temp/{experiment_id}/
    rel_temp_dir = Path("projects") / project_name / "model" / "prediction_temp" / experiment_id
    abs_temp_dir = project_root / rel_temp_dir
    abs_temp_dir.mkdir(parents=True, exist_ok=True)
    
    saved_files = []
    
    for file in files:
        # Avoid directory traversal by using only the filename
        safe_filename = Path(file.filename).name
        target_path = abs_temp_dir / safe_filename
        
        try:
            with target_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append((rel_temp_dir / safe_filename).as_posix())
        except Exception as e:
            logger.error("errors.system", f"Failed to save uploaded file {safe_filename}: {e}", "upload_prediction_save_failed")
            
    # Update Experiment Record
    exp.input_images = saved_files
    exp.image_count = len(saved_files)
    # Point dataset_path to the folder so prediction_executor knows where to look
    exp.dataset_path = rel_temp_dir.as_posix()
    
    db.commit()
    db.refresh(exp)
    
    return {
        "ok": True, 
        "experiment_id": experiment_id, 
        "count": len(saved_files), 
        "path": rel_temp_dir.as_posix()
    }




@router.patch("/experiments/{experiment_id}/prediction")
async def update_prediction(experiment_id: str, payload: PredictionUpdate, db: Session = Depends(get_db)):
    """Update specific fields of a prediction experiment (real-time sync)."""
    exp = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    update_data = payload.dict(exclude_unset=True)
    
    # If dataset_source changed, recalculate image_count
    if 'dataset_source' in update_data:
        new_source = update_data['dataset_source']
        if new_source in ['test', 'val', 'train']:
            ts = db.query(TrainingSession).filter(TrainingSession.id == exp.training_id).first()
            if ts and ts.dataset_summary_json:
                try:
                    summary = json.loads(ts.dataset_summary_json) if isinstance(ts.dataset_summary_json, str) else ts.dataset_summary_json
                    splits = summary.get('splits', {})
                    new_count = splits.get(new_source, None)
                    if new_count is not None:
                        exp.image_count = new_count
                except Exception as e:
                    logger.warning("errors.system", f"Failed to recalculate image_count: {e}", "update_prediction_image_count_failed")
        elif new_source == 'upload' and 'uploaded_images' in update_data:
            exp.image_count = len(update_data['uploaded_images']) if update_data['uploaded_images'] else None
    
    for key, value in update_data.items():
        setattr(exp, key, value)
        
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/training/{training_id}/predict")
async def trigger_prediction(
    training_id: int, 
    payload: PredictionRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a prediction experiment in a subprocess."""
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")

    # Resume existing draft if available
    experiment = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == "prediction",
            ModelExperiment.status == "queued"
        )
        .first()
    )
    
    if experiment:
        # Finalize settings from UI
        experiment.name = payload.name
        experiment.dataset_source = payload.dataset_source
        experiment.confidence = payload.confidence
        experiment.iou_threshold = payload.iou_threshold
        experiment.imgsz = payload.imgsz
        experiment.batch = payload.batch
        experiment.half = payload.half
        experiment.weights_type = payload.weights_type
        experiment.task = payload.task
        experiment.max_detections = payload.max_det
        experiment.device = payload.device
        experiment.custom_params = payload.custom_params
        
        # Ensure path is granular even if resumed from draft
        if payload.dataset_source in ['test', 'val', 'train']:
            experiment.dataset_path = (Path(ts.dataset_release_dir) / "images" / payload.dataset_source).as_posix()
        # For upload source, preserve the existing dataset_path (set during upload)
        
        # SAFE MERGE: Only overwrite if payload explicitly provides images
        if payload.uploaded_images:
            experiment.input_images = payload.uploaded_images
            experiment.image_count = len(payload.uploaded_images)
        elif experiment.input_images:
            # If no new images in payload, but we have staged ones, ensure count is correct
            experiment.image_count = len(experiment.input_images)
    else:
        # Fallback if UI somehow triggered without init
        project = db.query(Project).filter(Project.id == ts.project_id).first()
        
        # Calculate image_count
        image_count = None
        if payload.dataset_source in ['test', 'val', 'train']:
            if ts.dataset_summary_json:
                try:
                    summary = json.loads(ts.dataset_summary_json) if isinstance(ts.dataset_summary_json, str) else ts.dataset_summary_json
                    splits = summary.get('splits', {})
                    image_count = splits.get(payload.dataset_source, None)
                except Exception:
                    pass
        elif payload.dataset_source == 'upload' and payload.uploaded_images:
            image_count = len(payload.uploaded_images)
        
        experiment = ModelExperiment(
            id=str(uuid.uuid4()),
            training_id=ts.id,
            project_id=ts.project_id,
            project_name=project.name if project else None,
            training_name=ts.name,
            name=payload.name,
            experiment_type="prediction",
            framework=ts.framework or "ultralytics",
            task=payload.task or ts.task,
            dataset_source=payload.dataset_source,
            dataset_path=(Path(ts.dataset_release_dir) / "images" / payload.dataset_source).as_posix() if payload.dataset_source in ['test', 'val', 'train'] else None,
            image_count=image_count,
            confidence=payload.confidence,
            iou_threshold=payload.iou_threshold,
            imgsz=payload.imgsz,
            weights_type=payload.weights_type,
            max_detections=payload.max_det,
            device=payload.device,
            input_images=payload.uploaded_images,
            status="queued"
        )
        db.add(experiment)
    
    db.commit()
    db.refresh(experiment)

    # --- Start Prediction Subprocess ---
    try:
        # Resolve paths
        project_root = settings.BASE_DIR
        
        # 1. Weights Path
        weights_filename = "best.pt" if payload.weights_type == 'best' else "last.pt"

        weights_path = None
        candidates = []
        if ts.weights_dir:
            candidates.append(project_root / ts.weights_dir / weights_filename)
        if ts.run_dir:
            candidates.append(project_root / ts.run_dir / "weights" / weights_filename)
            
        for c in candidates:
            if c.exists():
                weights_path = c.as_posix()
                break
        
        if not weights_path:
            raise FileNotFoundError(f"Weights {weights_filename} not found in {candidates}")

        # 2. Resolve image sources
        images_list = []
        if payload.dataset_source in ['test', 'val', 'train']:
            # Use dataset images
            if not ts.dataset_release_dir:
                raise ValueError(f"No dataset found for training {ts.name}")
            
            images_dir = project_root / ts.dataset_release_dir / "images" / payload.dataset_source
            if not images_dir.exists():
                raise FileNotFoundError(f"Images folder not found: {images_dir}")
            
            # Collect unique image files (deduplicate for Windows case-insensitivity)
            images_set = set()
            for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif']:
                # On Windows, glob is case-insensitive, so we deduplicate using a set
                images_set.update([str(p).replace('\\', '/') for p in images_dir.glob(f'*{ext}')])
                images_set.update([str(p).replace('\\', '/') for p in images_dir.glob(f'*{ext.upper()}')])
            
            images_list = sorted(list(images_set))
            
            if not images_list:
                raise FileNotFoundError(f"No images found in {images_dir}")
                
        elif payload.dataset_source == 'upload':
            # Use uploaded images: Priority given to experiment.input_images (the staged files)
            images_list = payload.uploaded_images or experiment.input_images
            
            if not images_list:
                raise ValueError("No uploaded images staged for this experiment. Please upload images first.")
        
            # Verify all uploaded images exist
            for img_path in images_list:
                full_path = project_root / img_path if not Path(img_path).is_absolute() else Path(img_path)
                if not full_path.exists():
                    raise FileNotFoundError(f"Uploaded image not found: {img_path}")
        
        # Update experiment with actual image count
        experiment.image_count = len(images_list)

        # 3. Output Folder Path
        safe_name = re.sub(r'[^\w\-_]', '_', experiment.name or 'unnamed')
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        folder_name = f"{safe_name}_{timestamp}"
        
        rel_output_dir = Path(ts.run_dir) / "experiments" / "prediction" / folder_name
        abs_output_dir = project_root / rel_output_dir
        
        # Ensure directory exists
        os.makedirs(abs_output_dir, exist_ok=True)

        # 4. Launch Subprocess
        executor_path = (Path(__file__).parent / "prediction_executor.py").as_posix()
        
        # Build params dict
        # device is intentionally excluded — predictor.py auto-detects GPU vs CPU
        # batch comes from the UI slider and must be forwarded so predictor respects it
        params = {
            'confidence': payload.confidence,
            'iou_threshold': payload.iou_threshold,
            'imgsz': payload.imgsz,
            'task': payload.task or ts.task or 'detect',
            'batch': payload.batch,
        }
        if payload.custom_params:
            params.update(payload.custom_params)
        
        params_json = json.dumps(params)
        images_manifest_path = abs_output_dir / "prediction_inputs.json"
        with open(images_manifest_path, "w", encoding="utf-8") as manifest_file:
            json.dump(images_list, manifest_file, ensure_ascii=False)
        
        log_file_path = abs_output_dir / "prediction.log"
        log_file = open(log_file_path, "w", encoding="utf-8")
        
        # Set environment for unbuffered logging and UTF-8 encoding
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        if os.environ.get("GEVIS_EXE_MODE") == "1":
            env["GEVIS_EXE_MODE"] = "1"

        command = [
            sys.executable,
            executor_path,
            "--experiment_id", str(experiment.id),
            "--weights_path", weights_path,
            "--images_manifest", images_manifest_path.as_posix(),
            "--output_folder", abs_output_dir.as_posix(),
            "--params_json", params_json
        ]

        # Use CREATE_NEW_PROCESS_GROUP on Windows to avoid orphan processes
        creation_flags = 0
        if os.name == 'nt':
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

        process = subprocess.Popen(
            command,
            cwd=project_root.as_posix(),
            creationflags=creation_flags,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            env=env
        )
        
        # Record the PID immediately
        experiment.process_pid = process.pid
        experiment.status = "running"
        db.commit()
        
        logger.info("operations.training", f"Started prediction subprocess PID {process.pid}", "prediction_subprocess_started")

    except Exception as e:
        logger.error("errors.system", f"Failed to launch prediction subprocess: {str(e)}", "prediction_launch_failure")
        experiment.status = "failed"
        experiment.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to start prediction: {str(e)}")

    return {"experiment_id": experiment.id, "status": "running"}


# Phase 7.1: Get missed ground truth detections
@router.get("/experiments/{experiment_id}/missed-detections/{image_name}")
async def get_missed_ground_truth(
    experiment_id: str,
    image_name: str,
    iou_threshold: float = Query(0.3, ge=0.01, le=0.9),
    db: Session = Depends(get_db)
):
    """Get ground truth objects that the model failed to detect."""
    from utils.ground_truth_loader import load_split_annotations, get_missed_detections
    from sqlalchemy.orm import defer
    from utils import overlay_cache
    from utils.experiment_image_resolver import resolve_experiment_image

    # `predictions` is several megabytes and a cache hit never reads it, so it
    # is deferred and loads lazily only when the answer has to be recomputed.
    experiment = (
        db.query(ModelExperiment)
        .options(defer(ModelExperiment.predictions))
        .filter(ModelExperiment.id == experiment_id)
        .first()
    )
    if not experiment:
        raise HTTPException(404, "Experiment not found")

    # Same disk cache as the GT overlay: this answer is equally frozen once the
    # experiment is complete, and equally expensive to recompute each time.
    _missed_cache_at = None
    if experiment.status == "completed":
        try:
            _row = resolve_experiment_image(db, experiment, image_name)
            if _row is not None:
                _missed_cache_at = overlay_cache.cache_path(
                    experiment_id, image_name,
                    overlay_cache.label_fingerprint(db, _row),
                    f"missed:{iou_threshold}",
                    getattr(experiment, "project_name", None))
                _hit = overlay_cache.read(_missed_cache_at)
                if _hit is not None:
                    return _hit
        except Exception:
            _missed_cache_at = None   # never let caching break the endpoint

    if experiment.experiment_type == "sahi_prediction":
        try:
            from utils.ground_truth_loader import get_missed_detections
            image_name_only = Path(image_name).name

            predictions = json.loads(experiment.predictions) if isinstance(experiment.predictions, str) else (experiment.predictions or {})
            image_predictions = predictions.get(image_name_only, [])
            if not image_predictions:
                for key, value in predictions.items():
                    if Path(str(key)).name == image_name_only:
                        image_predictions = value or []
                        break

            input_images = json.loads(experiment.input_images) if isinstance(experiment.input_images, str) else (experiment.input_images or {})
            image_metadata = input_images.get(image_name_only, {}) if isinstance(input_images, dict) else {}
            if isinstance(image_metadata, str):
                try:
                    image_metadata = json.loads(image_metadata)
                except (json.JSONDecodeError, ValueError):
                    image_metadata = {}

            from utils.experiment_image_resolver import resolve_experiment_image
            # md5 decides which photograph this is. Matching on the filename as
            # well would let a same-named image from another shoot answer, and
            # the two have separately drawn labels.
            image_record = resolve_experiment_image(db, experiment, image_name_only)
            if not image_record:
                return {"missed": [], "fp_indices": list(range(len(image_predictions))), "matched_ious": []}

            img_width = image_record.width or (image_metadata.get("width") if isinstance(image_metadata, dict) else None) or 640
            img_height = image_record.height or (image_metadata.get("height") if isinstance(image_metadata, dict) else None) or 640

            annotations = (
                db.query(Annotation)
                .filter(Annotation.image_id == image_record.id)
                .order_by(Annotation.id)
                .all()
            )
            image_key = f"original/{image_name_only}"
            annotations_dict = {
                image_key: [
                    {
                        "class_id": ann.class_id,
                        "bbox": _annotation_to_yolo_bbox(ann),
                    }
                    for ann in annotations
                ]
            }
            label_mapping = {ann.class_id: ann.class_name for ann in annotations}

            _result = get_missed_detections(
                annotations_dict,
                image_key,
                image_predictions,
                img_width,
                img_height,
                label_mapping,
                iou_threshold,
            )
            if _missed_cache_at is not None:
                overlay_cache.write(_missed_cache_at, _result)
            return _result
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error("errors.system", f"Error loading SAHI missed detections: {e}\n{error_details}", "sahi_missed_detections_error")
            raise HTTPException(status_code=500, detail=str(e))
    
    if not experiment.dataset_path or not experiment.dataset_source:
        return []
    
    try:
        # Resolve absolute path to dataset base
        # dataset_path is like "projects/.../<release>/images/train"
        # We need "projects/.../<release>"
        # IMPORTANT: split only at the real "/images/" FOLDER, not at the word
        # "images" inside the release folder name (e.g. "...comp-images-1-balanced...").
        rel_path = experiment.dataset_path
        _base_parts = re.split(r'[/\\]images[/\\]', rel_path, maxsplit=1)
        base_rel_path = _base_parts[0] if len(_base_parts) > 1 else rel_path
            
        project_root = settings.BASE_DIR
        abs_dataset_path = (project_root / base_rel_path).resolve()
        
        # Load annotations for this split
        annotations = load_split_annotations(str(abs_dataset_path), experiment.dataset_source)
        
        # Get predictions for this image
        if isinstance(experiment.predictions, str):
            predictions = json.loads(experiment.predictions)
        else:
            predictions = experiment.predictions or {}
        
        image_name = Path(image_name).name # Ensure we have just the filename
        image_predictions = predictions.get(image_name, [])
        
        # Get image dimensions
        if isinstance(experiment.input_images, str):
            input_images = json.loads(experiment.input_images)
        else:
            input_images = experiment.input_images or {}
        
        img_metadata = input_images.get(image_name, {})
        
        # Handle case where metadata might be a JSON string
        if isinstance(img_metadata, str):
            try:
                img_metadata = json.loads(img_metadata)
            except (json.JSONDecodeError, ValueError):
                # If parsing fails, treat as empty metadata
                img_metadata = {}
        
        # Safely extract dimensions with fallback
        if isinstance(img_metadata, dict):
            img_width = img_metadata.get('width', 640)
            img_height = img_metadata.get('height', 640)
        else:
            img_width = 640
            img_height = 640
        
        # Build label mapping
        label_mapping = {}
        data_yaml_path = abs_dataset_path / "data.yaml"
        if data_yaml_path.exists():
            try:
                import yaml
                with open(data_yaml_path, 'r') as f:
                    data_yaml = yaml.safe_load(f)
                    if 'names' in data_yaml:
                        names = data_yaml['names']
                        if isinstance(names, list):
                            # index is class_id
                            label_mapping = {i: name for i, name in enumerate(names)}
                        elif isinstance(names, dict):
                            label_mapping = {int(k): v for k, v in names.items()}
            except Exception as e:
                logger.error("errors.system", f"Error loading data.yaml for labels: {e}", "data_yaml_error")

        if not label_mapping:
            # Fallback to project labels - Use alphabetical order as YOLO usually does this if not specified
            project = db.get(Project, experiment.project_id)
            if project and project.labels:
                sorted_labels = sorted(project.labels, key=lambda l: l.name)
                label_mapping = {i: label.name for i, label in enumerate(sorted_labels)}
        
        # Construct image key using forward slashes (normalized)
        image_key = f"images/{experiment.dataset_source}/{image_name}"
        
        # Find missed detections and false positives
        result = get_missed_detections(
            annotations,
            image_key,
            image_predictions,
            img_width,
            img_height,
            label_mapping,
            iou_threshold
        )
        
        return result
    
    except FileNotFoundError:
        # No annotations.json file
        return []
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error("errors.system", f"Error loading missed detections: {e}\n{error_details}", "missed_detections_error")
        raise HTTPException(status_code=500, detail=str(e))


# ── Analytics Report (PDF): dataset composition + per-image TP/FP/Doubt/Missing ──

class AddExperimentToReportRequest(BaseModel):
    experiment_id: str


@router.get("/projects/{project_id}/training/{training_id}/report/status")
def get_training_report_status(project_id: int, training_id: int, db: Session = Depends(get_db)):
    from api.services.experiment_report_service import get_report_status
    try:
        return get_report_status(training_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/training/{training_id}/report/data")
def get_training_report_data(project_id: int, training_id: int, db: Session = Depends(get_db)):
    from api.services.experiment_report_service import get_report_data
    try:
        return get_report_data(training_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/training/{training_id}/report/addable-experiments")
def get_addable_experiments(project_id: int, training_id: int, db: Session = Depends(get_db)):
    from api.services.experiment_report_service import list_addable_experiments
    try:
        return list_addable_experiments(training_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/training/{training_id}/report/can-add/{experiment_id}")
def get_can_add_experiment_to_report(project_id: int, training_id: int, experiment_id: str, db: Session = Depends(get_db)):
    from api.services.experiment_report_service import can_add_experiment
    experiment = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    try:
        return {"can_add": can_add_experiment(experiment, db)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/training/{training_id}/report/add-experiment")
def add_experiment_to_training_report(project_id: int, training_id: int, payload: AddExperimentToReportRequest, db: Session = Depends(get_db)):
    from api.services.experiment_report_service import add_experiment_to_report
    try:
        pdf_path = add_experiment_to_report(training_id, payload.experiment_id, db)
        return {"status": "success", "pdf_path": str(pdf_path)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("errors.system", f"Failed to add experiment to report: {str(e)}", "add_experiment_report_error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/training/{training_id}/report/remove-experiment")
def remove_experiment_from_training_report(project_id: int, training_id: int, payload: AddExperimentToReportRequest, db: Session = Depends(get_db)):
    from api.services.experiment_report_service import remove_experiment_from_report
    try:
        remove_experiment_from_report(training_id, payload.experiment_id, db)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("errors.system", f"Failed to remove experiment from report: {str(e)}", "remove_experiment_report_error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/training/{training_id}/report/download")
def download_training_report(project_id: int, training_id: int, db: Session = Depends(get_db)):
    training = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not training or not training.run_dir:
        raise HTTPException(status_code=404, detail="Training session not found")

    pdf_path = settings.BASE_DIR / training.run_dir / "report" / "report.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Report not generated yet")

    return FileResponse(str(pdf_path), media_type="application/pdf", filename=f"{training.name}_report.pdf")

