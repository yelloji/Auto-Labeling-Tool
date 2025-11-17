from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from api.services.model_serialization import serialize_ai_model
from models.training.model_selector import get_trainable_models
from models.training.training_extraction import is_extracted, extract_release_zip
from models.training.config import load_base_config, resolve_config, build_args_preview
from models.training.dataset_summary import summarize_dataset, find_and_summarize
from pathlib import Path

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
