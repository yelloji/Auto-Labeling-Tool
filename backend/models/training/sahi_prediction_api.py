from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import os
import re
import subprocess
import sys
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from database.database import get_db
from database.models import ModelExperiment, Project, TrainingSession
from logging_system.professional_logger import get_professional_logger
from models.training.sahi_image_resolver import resolve_sahi_input_images, resolve_dataset_stage_images


logger = get_professional_logger()
router = APIRouter()

SAHI_EXPERIMENT_TYPE = "sahi_prediction"
SAHI_DATASET_SOURCES = {"dataset_images", "upload"}
# Optional split filter for the 'dataset_images' source. 'all' = every dataset image
# (original behavior); train/val/test restricts to that split's full images.
SAHI_SPLITS = {"all", "train", "val", "test"}
SAHI_PARAM_FIELDS = {
    "slice_height",
    "slice_width",
    "overlap_height_ratio",
    "overlap_width_ratio",
    "postprocess_match_threshold",
    "postprocess_class_agnostic",
    "no_standard_prediction",
    "no_sliced_prediction",
    "visual_hide_labels",
    "visual_hide_conf",
    "batch_size",
    "remove_duplicates",
    "duplicate_overlap_fraction",
}


class SahiPredictionRequest(BaseModel):
    """Request model for SAHI prediction experiments on full original images."""
    name: str
    dataset_source: str = "dataset_images"  # 'dataset_images' or 'upload'
    split: str = "all"  # 'all' | 'train' | 'val' | 'test' (only for dataset_images)
    weights_type: str = "best"  # 'best' or 'last'
    task: Optional[str] = None  # 'detect' or 'segment'; defaults to the training task
    confidence: float = 0.5
    slice_height: int = 896
    slice_width: int = 896
    overlap_height_ratio: float = 0.25
    overlap_width_ratio: float = 0.25
    postprocess_match_threshold: float = 0.3
    postprocess_class_agnostic: bool = True
    no_standard_prediction: bool = True
    no_sliced_prediction: bool = False
    visual_hide_labels: bool = False
    visual_hide_conf: bool = False
    device: str = "auto"
    batch_size: int = 1
    # Independent post-processing step: combines same-class detections whose
    # boxes overlap by at least duplicate_overlap_fraction into one real
    # pixel-union shape, so duplicate detections aren't scored as false
    # positives against ground truth. Off by default here (unlike Auto
    # Labeling) — real, untouched SAHI output is the default in Prediction,
    # this is opt-in for comparing real vs. duplicate counts.
    remove_duplicates: bool = False
    duplicate_overlap_fraction: float = 0.1
    custom_params: Optional[Dict[str, Any]] = None
    uploaded_images: Optional[List[str]] = None


class SahiPredictionUpdate(BaseModel):
    """Update model for queued SAHI prediction experiments."""
    name: Optional[str] = None
    dataset_source: Optional[str] = None
    split: Optional[str] = None
    weights_type: Optional[str] = None
    task: Optional[str] = None
    confidence: Optional[float] = None
    slice_height: Optional[int] = None
    slice_width: Optional[int] = None
    overlap_height_ratio: Optional[float] = None
    overlap_width_ratio: Optional[float] = None
    postprocess_match_threshold: Optional[float] = None
    postprocess_class_agnostic: Optional[bool] = None
    no_standard_prediction: Optional[bool] = None
    no_sliced_prediction: Optional[bool] = None
    visual_hide_labels: Optional[bool] = None
    visual_hide_conf: Optional[bool] = None
    device: Optional[str] = None
    batch_size: Optional[int] = None
    remove_duplicates: Optional[bool] = None
    duplicate_overlap_fraction: Optional[float] = None
    custom_params: Optional[Dict[str, Any]] = None
    uploaded_images: Optional[List[str]] = None


def _sahi_params_from_payload(payload: BaseModel) -> Dict[str, Any]:
    """Collect SAHI-only parameters into ModelExperiment.custom_params."""
    payload_data = payload.dict(exclude_unset=False)
    sahi_params = {
        key: payload_data[key]
        for key in SAHI_PARAM_FIELDS
        if key in payload_data and payload_data[key] is not None
    }

    # Persist the dataset-image split choice (used only for image resolution,
    # NOT a SAHI executor param, so it stays out of SAHI_PARAM_FIELDS).
    split_value = payload_data.get("split")
    sahi_params["split"] = (str(split_value).strip().lower() if split_value else "all")

    extra_params = payload_data.get("custom_params")
    if extra_params:
        sahi_params.update(extra_params)

    return sahi_params


def _ensure_tile_project_for_sahi(ts: TrainingSession, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == ts.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.tile_enabled:
        raise HTTPException(status_code=400, detail="SAHI prediction is available only for tile-enabled projects")
    return project


def _validate_sahi_dataset_source(dataset_source: str) -> None:
    if dataset_source not in SAHI_DATASET_SOURCES:
        raise HTTPException(
            status_code=400,
            detail="SAHI prediction source must be 'dataset_images' or 'upload'"
        )


def _validate_sahi_split(split: Optional[str]) -> None:
    if split is None:
        return
    if str(split).strip().lower() not in SAHI_SPLITS:
        raise HTTPException(
            status_code=400,
            detail="SAHI split must be 'all', 'train', 'val', or 'test'"
        )


def _apply_sahi_update(exp: ModelExperiment, payload: BaseModel) -> None:
    update_data = payload.dict(exclude_unset=True)
    if "dataset_source" in update_data:
        _validate_sahi_dataset_source(update_data["dataset_source"])
    if "split" in update_data:
        _validate_sahi_split(update_data["split"])

    direct_fields = {
        "name",
        "dataset_source",
        "weights_type",
        "task",
        "confidence",
        "device",
        "uploaded_images",
    }

    for key in direct_fields:
        if key not in update_data:
            continue
        if key == "uploaded_images":
            exp.input_images = update_data[key]
            exp.image_count = len(update_data[key]) if update_data[key] else None
        else:
            setattr(exp, key, update_data[key])

    existing_params = exp.custom_params if isinstance(exp.custom_params, dict) else {}
    if not isinstance(existing_params, dict):
        existing_params = {}

    if "dataset_source" in update_data and update_data["dataset_source"] == "dataset_images":
        exp.dataset_path = None
    if "postprocess_match_threshold" in update_data:
        exp.iou_threshold = update_data["postprocess_match_threshold"]
    if "slice_height" in update_data or "slice_width" in update_data:
        current_height = update_data.get("slice_height") or existing_params.get("slice_height") or exp.imgsz or 896
        current_width = update_data.get("slice_width") or existing_params.get("slice_width") or exp.imgsz or 896
        exp.imgsz = max(current_height, current_width)

    sahi_updates = {
        key: update_data[key]
        for key in SAHI_PARAM_FIELDS
        if key in update_data and update_data[key] is not None
    }
    # Split is stored in custom_params (not a SAHI executor param)
    if "split" in update_data and update_data["split"] is not None:
        sahi_updates["split"] = str(update_data["split"]).strip().lower()
    if "custom_params" in update_data and update_data["custom_params"]:
        sahi_updates.update(update_data["custom_params"])
    if sahi_updates:
        exp.custom_params = {**existing_params, **sahi_updates}


def _resolve_and_apply_sahi_input_summary(db: Session, exp: ModelExperiment) -> Dict[str, Any]:
    params = exp.custom_params if isinstance(exp.custom_params, dict) else {}
    split = params.get("split", "all")

    resolved = resolve_sahi_input_images(
        db=db,
        project_id=exp.project_id,
        dataset_source=exp.dataset_source,
        uploaded_images=exp.input_images if exp.dataset_source == "upload" else None,
        split=split,
    )

    exp.image_count = resolved["count"]
    exp.custom_params = {
        **params,
        "split": split,
        "input_source": resolved["source"],
        "input_split_counts": resolved["split_counts"],
        "input_skipped_count": len(resolved["skipped"]),
    }
    return resolved


def _resolve_sahi_weights_path(ts: TrainingSession, weights_type: str) -> str:
    weights_filename = "best.pt" if weights_type == "best" else "last.pt"
    project_root = settings.BASE_DIR
    candidates = []

    if ts.weights_dir:
        candidates.append(project_root / ts.weights_dir / weights_filename)
    if ts.run_dir:
        candidates.append(project_root / ts.run_dir / "weights" / weights_filename)

    for candidate in candidates:
        if candidate.exists():
            return candidate.as_posix()

    raise FileNotFoundError(f"Weights {weights_filename} not found in {candidates}")


def _build_sahi_params(exp: ModelExperiment, ts: TrainingSession) -> Dict[str, Any]:
    custom_params = exp.custom_params if isinstance(exp.custom_params, dict) else {}
    params = {
        "confidence": exp.confidence,
        "iou_threshold": exp.iou_threshold,
        "imgsz": exp.imgsz,
        "task": exp.task or ts.task or "detect",
        "device": exp.device or "auto",
    }
    for key in SAHI_PARAM_FIELDS:
        if key in custom_params:
            params[key] = custom_params[key]
    return params


def _finalize_sahi_experiment_from_payload(exp: ModelExperiment, ts: TrainingSession, payload: SahiPredictionRequest) -> None:
    exp.name = payload.name
    exp.dataset_source = payload.dataset_source
    exp.weights_type = payload.weights_type
    exp.task = payload.task or ts.task
    exp.confidence = payload.confidence
    exp.iou_threshold = payload.postprocess_match_threshold
    exp.imgsz = max(payload.slice_height, payload.slice_width)
    exp.device = payload.device
    exp.custom_params = _sahi_params_from_payload(payload)
    # For upload source: preserve the dataset_path set by the upload endpoint (prediction_temp/ folder).
    # For dataset_images: clear it so the executor does not try to treat it as an upload folder.
    if payload.dataset_source != "upload":
        exp.input_images = payload.uploaded_images
        exp.dataset_path = None


@router.get("/training/{training_id}/sahi-prediction/available-images")
async def get_sahi_available_images(training_id: int, db: Session = Depends(get_db)):
    """
    Return per-split counts of the FULL original images SAHI can run on.
    These are the dataset-stage images (full, not tiles) — different from the
    release/tile counts shown in normal prediction.
    """
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")

    resolved = resolve_dataset_stage_images(db, ts.project_id)
    counts = resolved["split_counts"]
    return {
        "split_counts": counts,
        "total": resolved["count"],
        "available_splits": [s for s in ("test", "val", "train") if counts.get(s, 0) > 0],
    }


@router.get("/training/{training_id}/sahi-prediction/queued")
async def get_queued_sahi_prediction(training_id: int, db: Session = Depends(get_db)):
    """Find existing queued SAHI prediction experiment for a model."""
    exp = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == SAHI_EXPERIMENT_TYPE,
            ModelExperiment.status == "queued"
        )
        .first()
    )
    return exp


@router.post("/training/{training_id}/sahi-prediction/init")
async def init_sahi_prediction(training_id: int, payload: SahiPredictionRequest, db: Session = Depends(get_db)):
    """Initialize a new SAHI prediction record or return existing queued one."""
    existing = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == SAHI_EXPERIMENT_TYPE,
            ModelExperiment.status == "queued"
        )
        .first()
    )
    if existing:
        return existing

    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")

    project = _ensure_tile_project_for_sahi(ts, db)
    _validate_sahi_dataset_source(payload.dataset_source)
    _validate_sahi_split(payload.split)

    exp = ModelExperiment(
        id=str(uuid.uuid4()),
        training_id=ts.id,
        project_id=ts.project_id,
        project_name=project.name,
        training_name=ts.name,
        name=payload.name or "",
        experiment_type=SAHI_EXPERIMENT_TYPE,
        framework=ts.framework or "ultralytics",
        task=payload.task or ts.task,
        dataset_source=payload.dataset_source,
        dataset_path=None,
        image_count=None,
        confidence=payload.confidence,
        iou_threshold=payload.postprocess_match_threshold,
        imgsz=max(payload.slice_height, payload.slice_width),
        batch=1,
        half=False,
        weights_type=payload.weights_type,
        device=payload.device,
        custom_params=_sahi_params_from_payload(payload),
        input_images=payload.uploaded_images,
        status="queued"
    )
    _resolve_and_apply_sahi_input_summary(db, exp)

    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.post("/training/{training_id}/sahi-predict")
async def trigger_sahi_prediction(
    training_id: int,
    payload: SahiPredictionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a SAHI prediction experiment in a subprocess."""
    ts = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")

    project = _ensure_tile_project_for_sahi(ts, db)
    _validate_sahi_dataset_source(payload.dataset_source)
    _validate_sahi_split(payload.split)

    experiment = (
        db.query(ModelExperiment)
        .filter(
            ModelExperiment.training_id == training_id,
            ModelExperiment.experiment_type == SAHI_EXPERIMENT_TYPE,
            ModelExperiment.status == "queued"
        )
        .first()
    )

    if experiment:
        _finalize_sahi_experiment_from_payload(experiment, ts, payload)
    else:
        experiment = ModelExperiment(
            id=str(uuid.uuid4()),
            training_id=ts.id,
            project_id=ts.project_id,
            project_name=project.name,
            training_name=ts.name,
            name=payload.name,
            experiment_type=SAHI_EXPERIMENT_TYPE,
            framework=ts.framework or "ultralytics",
            task=payload.task or ts.task,
            dataset_source=payload.dataset_source,
            dataset_path=None,
            confidence=payload.confidence,
            iou_threshold=payload.postprocess_match_threshold,
            imgsz=max(payload.slice_height, payload.slice_width),
            batch=1,
            half=False,
            weights_type=payload.weights_type,
            device=payload.device,
            custom_params=_sahi_params_from_payload(payload),
            input_images=payload.uploaded_images,
            status="queued"
        )
        db.add(experiment)

    resolved_inputs = _resolve_and_apply_sahi_input_summary(db, experiment)
    if not resolved_inputs["images"]:
        raise HTTPException(status_code=400, detail="No dataset-stage images found for SAHI prediction")

    db.commit()
    db.refresh(experiment)

    try:
        project_root = settings.BASE_DIR
        if not ts.run_dir:
            raise ValueError(f"Training session {ts.name} has no run_dir")

        weights_path = _resolve_sahi_weights_path(ts, experiment.weights_type or "best")

        safe_name = re.sub(r"[^\w\-_]", "_", experiment.name or "sahi_prediction")
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        folder_name = f"{safe_name}_{timestamp}"
        rel_output_dir = Path(ts.run_dir) / "experiments" / "sahi_prediction" / folder_name
        abs_output_dir = project_root / rel_output_dir
        abs_output_dir.mkdir(parents=True, exist_ok=True)

        images_manifest_path = abs_output_dir / "sahi_prediction_inputs.json"
        with open(images_manifest_path, "w", encoding="utf-8") as manifest_file:
            json.dump(resolved_inputs["images"], manifest_file, ensure_ascii=False)

        params = _build_sahi_params(experiment, ts)
        params_path = abs_output_dir / "sahi_prediction_params.json"
        with open(params_path, "w", encoding="utf-8") as params_file:
            json.dump(params, params_file, ensure_ascii=False, indent=2)

        log_file_path = abs_output_dir / "sahi_prediction.log"
        log_file = open(log_file_path, "w", encoding="utf-8")

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        if env.get("DEBUG") == "release":
            env["DEBUG"] = "false"
        if os.environ.get("GEVIS_EXE_MODE") == "1":
            env["GEVIS_EXE_MODE"] = "1"

        executor_path = (Path(__file__).parent / "sahi_prediction_executor.py").as_posix()
        command = [
            sys.executable,
            executor_path,
            "--experiment_id", str(experiment.id),
            "--weights_path", weights_path,
            "--images_manifest", images_manifest_path.as_posix(),
            "--output_folder", abs_output_dir.as_posix(),
            "--params_json", json.dumps(params),
        ]

        creation_flags = 0
        if os.name == "nt":
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

        process = subprocess.Popen(
            command,
            cwd=project_root.as_posix(),
            creationflags=creation_flags,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            env=env,
        )

        experiment.process_pid = process.pid
        experiment.status = "running"
        experiment.output_folder = rel_output_dir.as_posix()
        db.commit()

        logger.info("operations.training", f"Started SAHI prediction subprocess PID {process.pid}", "sahi_prediction_subprocess_started")

    except Exception as exc:
        logger.error("errors.system", f"Failed to launch SAHI prediction subprocess: {str(exc)}", "sahi_prediction_launch_failure")
        experiment.status = "failed"
        experiment.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to start SAHI prediction: {str(exc)}")

    return {"experiment_id": experiment.id, "status": "running"}


@router.patch("/experiments/{experiment_id}/sahi-prediction")
async def update_sahi_prediction(experiment_id: str, payload: SahiPredictionUpdate, db: Session = Depends(get_db)):
    """Update specific fields of a queued SAHI prediction experiment."""
    exp = db.query(ModelExperiment).filter(
        ModelExperiment.id == experiment_id,
        ModelExperiment.experiment_type == SAHI_EXPERIMENT_TYPE
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="SAHI prediction experiment not found")

    if exp.status != "queued":
        raise HTTPException(status_code=400, detail="Only queued SAHI prediction experiments can be updated")

    ts = db.query(TrainingSession).filter(TrainingSession.id == exp.training_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found")
    _ensure_tile_project_for_sahi(ts, db)

    _apply_sahi_update(exp, payload)
    _resolve_and_apply_sahi_input_summary(db, exp)
    db.commit()
    db.refresh(exp)
    return exp
