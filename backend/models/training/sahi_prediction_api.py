from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import ModelExperiment, Project, TrainingSession
from logging_system.professional_logger import get_professional_logger
from models.training.sahi_image_resolver import resolve_sahi_input_images


logger = get_professional_logger()
router = APIRouter()

SAHI_EXPERIMENT_TYPE = "sahi_prediction"
SAHI_DATASET_SOURCES = {"dataset_images", "upload"}
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
}


class SahiPredictionRequest(BaseModel):
    """Request model for SAHI prediction experiments on full original images."""
    name: str
    dataset_source: str = "dataset_images"  # 'dataset_images' or 'upload'
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
    custom_params: Optional[Dict[str, Any]] = None
    uploaded_images: Optional[List[str]] = None


class SahiPredictionUpdate(BaseModel):
    """Update model for queued SAHI prediction experiments."""
    name: Optional[str] = None
    dataset_source: Optional[str] = None
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


def _apply_sahi_update(exp: ModelExperiment, payload: BaseModel) -> None:
    update_data = payload.dict(exclude_unset=True)
    if "dataset_source" in update_data:
        _validate_sahi_dataset_source(update_data["dataset_source"])

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
    if "custom_params" in update_data and update_data["custom_params"]:
        sahi_updates.update(update_data["custom_params"])
    if sahi_updates:
        exp.custom_params = {**existing_params, **sahi_updates}


def _resolve_and_apply_sahi_input_summary(db: Session, exp: ModelExperiment) -> Dict[str, Any]:
    resolved = resolve_sahi_input_images(
        db=db,
        project_id=exp.project_id,
        dataset_source=exp.dataset_source,
        uploaded_images=exp.input_images if exp.dataset_source == "upload" else None,
    )

    exp.image_count = resolved["count"]
    params = exp.custom_params if isinstance(exp.custom_params, dict) else {}
    exp.custom_params = {
        **params,
        "input_source": resolved["source"],
        "input_split_counts": resolved["split_counts"],
        "input_skipped_count": len(resolved["skipped"]),
    }
    return resolved


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
