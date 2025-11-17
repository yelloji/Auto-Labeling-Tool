from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from api.services.model_serialization import serialize_ai_model
from models.training.model_selector import get_trainable_models
from models.training.training_extraction import is_extracted, extract_release_zip

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
