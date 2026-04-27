"""
ONNX Export Routes

Universal endpoint for converting a training session's best.pt to ONNX format.
Used by both Retraining Mode (Results step) and Full Mode (Model Lab → Model Manager).
"""

import os
import shutil
import threading

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import TrainingSession
from utils.path_utils import path_manager
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()
router = APIRouter()

# In-memory status store: { training_id: "pending" | "converting" | "done" | "failed" }
_onnx_status: dict = {}
_onnx_lock = threading.Lock()


def _onnx_path_for(best_pt: str) -> str:
    """Derive the .onnx path from the best.pt path."""
    return os.path.splitext(best_pt)[0] + ".onnx"


def _resolve_best_pt(session) -> str | None:
    """Return the absolute best.pt path for a training session."""
    if session.best_weights_path:
        abs_path = str(path_manager.get_absolute_path(session.best_weights_path))
        if os.path.exists(abs_path):
            return abs_path
    if session.weights_dir:
        abs_weights = str(path_manager.get_absolute_path(session.weights_dir))
        candidate = os.path.join(abs_weights, "best.pt")
        if os.path.exists(candidate):
            return candidate
    return None


def _run_conversion(training_id: str, best_pt: str, onnx_path: str):
    """Background thread: convert best.pt → .onnx using ultralytics."""
    try:
        from ultralytics import YOLO
        model = YOLO(best_pt)
        model.export(format="onnx")
        # ultralytics saves the .onnx next to the .pt with the same stem
        exported = _onnx_path_for(best_pt)
        if exported != onnx_path and os.path.exists(exported):
            shutil.move(exported, onnx_path)
        success = os.path.exists(onnx_path)
        with _onnx_lock:
            _onnx_status[training_id] = "done" if success else "failed"
        logger.info("system.info", f"ONNX conversion {'succeeded' if success else 'failed'}",
                    "onnx_conversion_result", {"training_id": training_id, "success": success})
    except Exception as e:
        logger.error("errors.system", f"ONNX conversion error: {e}",
                     "onnx_conversion_error", {"training_id": training_id, "error": str(e)})
        with _onnx_lock:
            _onnx_status[training_id] = "failed"


@router.post("/onnx/training/{training_id}/convert")
def start_onnx_conversion(training_id: str, db: Session = Depends(get_db)):
    """
    Start ONNX conversion for a training session's best.pt.
    Returns immediately — poll GET /onnx/training/{id}/status for progress.
    """
    session = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    best_pt = _resolve_best_pt(session)
    if not best_pt:
        raise HTTPException(status_code=404, detail="best.pt not found for this training session")

    onnx_path = _onnx_path_for(best_pt)

    with _onnx_lock:
        current = _onnx_status.get(training_id)

    # Already converting
    if current == "converting":
        return {"status": "converting", "onnx_ready": False}

    # Already done and file exists
    if current == "done" and os.path.exists(onnx_path):
        return {"status": "done", "onnx_ready": True}

    # Start background conversion
    with _onnx_lock:
        _onnx_status[training_id] = "converting"

    t = threading.Thread(
        target=_run_conversion,
        args=(training_id, best_pt, onnx_path),
        daemon=True,
    )
    t.start()

    logger.info("system.info", "ONNX conversion started",
                "onnx_conversion_start", {"training_id": training_id, "best_pt": best_pt})

    return {"status": "converting", "onnx_ready": False}


@router.get("/onnx/training/{training_id}/status")
def get_onnx_status(training_id: str, db: Session = Depends(get_db)):
    """Poll the ONNX conversion status for a training session."""
    session = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    best_pt = _resolve_best_pt(session)
    onnx_path = _onnx_path_for(best_pt) if best_pt else None
    onnx_exists = bool(onnx_path and os.path.exists(onnx_path))

    with _onnx_lock:
        status = _onnx_status.get(training_id)

    # File already exists from a previous session/restart
    if onnx_exists and status not in ("converting",):
        with _onnx_lock:
            _onnx_status[training_id] = "done"
        return {"status": "done", "onnx_ready": True}

    return {"status": status or "pending", "onnx_ready": False}


@router.get("/onnx/training/{training_id}/download")
def download_onnx(training_id: str, db: Session = Depends(get_db)):
    """Download the converted ONNX file."""
    session = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    best_pt = _resolve_best_pt(session)
    if not best_pt:
        raise HTTPException(status_code=404, detail="best.pt not found for this training session")

    onnx_path = _onnx_path_for(best_pt)
    if not os.path.exists(onnx_path):
        raise HTTPException(status_code=404, detail="ONNX file not found — please convert first")

    filename = f"{session.name or training_id}_best.onnx"
    return FileResponse(
        path=onnx_path,
        media_type="application/octet-stream",
        filename=filename,
    )
