"""
Service utilities for serializing AiModel rows with authoritative UI flags

This module produces a consistent dict representation of models that includes:
- scope: 'project' or 'global'
- source: 'pretrained' or 'custom'
- is_pretrained: bool
- is_ready: bool (based on file existence)
- is_training: bool (based on AutoLabelJob status)

Intended to be used by API routes (e.g., /projects/{id}/models).
"""

from typing import Any, Dict, Optional
from pathlib import Path

from sqlalchemy.orm import Session

from database.models import AiModel, AutoLabelJob
from utils.path_utils import path_manager
from models.model_manager import model_manager


def file_is_ready(path_str: Optional[str]) -> bool:
    """Determine readiness from file existence on disk.

    Handles both absolute paths and app-relative paths (e.g., 'projects/...').
    On Windows, relative paths may resolve against the backend working dir;
    we normalize them to absolute via path_manager to avoid false negatives.
    """
    try:
        if not path_str:
            return False
        path_s = str(path_str)
        # If the DB stored a projects-relative path, resolve to absolute first
        try:
            # path_manager.is_relative_project_path is robust and safe
            if path_manager.is_relative_project_path(path_s):
                abs_path = path_manager.get_absolute_path(path_s)
                return Path(abs_path).exists()
        except Exception:
            # Fall back to direct Path check
            pass
        return Path(path_s).exists()
    except Exception:
        return False


def is_pretrained_model(m: AiModel) -> bool:
    """Classify model as pretrained.

    Rules:
    - Global models (project_id is None) synced from ModelManager are considered pretrained.
    - Project-linked entries that reference a global/pretrained storage path are also considered pretrained.
    """
    try:
        if m.project_id is None:
            return True
        path_norm = str(getattr(m, "file_path", "") or "").lower().replace("\\", "/")
        # Heuristic based on known storage dirs. This does NOT rely on model name.
        return "/models/yolo/" in path_norm or "/models/pretrained/" in path_norm
    except Exception:
        return False


def is_model_training(db: Session, m: AiModel) -> bool:
    """Infer training state from AutoLabelJob status when available."""
    try:
        jobs = (
            db.query(AutoLabelJob)
            .filter(AutoLabelJob.model_id == m.id)
            .filter(AutoLabelJob.status.in_(["pending", "processing"]))
            .all()
        )
        return len(jobs) > 0
    except Exception:
        return False


def serialize_ai_model(db: Session, m: AiModel) -> Dict[str, Any]:
    """Serialize AiModel into a dict including authoritative flags used by the frontend UI."""
    scope = "project" if m.project_id is not None else "global"
    is_pretrained = is_pretrained_model(m)
    is_ready = file_is_ready(m.file_path)
    is_training = is_model_training(db, m)
    source = "pretrained" if is_pretrained else "custom"
    is_custom = not is_pretrained

    classes = m.classes or []
    num_classes = m.nc or (len(classes) if classes else 0)

    # Compute absolute path (for size calc) while remaining robust to both absolute
    # and app-relative project paths (e.g., 'projects/...').
    abs_path: Optional[str] = None
    try:
        if m.file_path:
            path_s = str(m.file_path)
            if path_manager.is_relative_project_path(path_s):
                abs_path = path_manager.get_absolute_path(path_s)
            else:
                abs_path = path_s
    except Exception:
        abs_path = str(m.file_path or "") or None

    # Compute file size in bytes when the file exists; used by frontend to format MB
    file_size: Optional[int] = None
    try:
        if abs_path and Path(abs_path).exists():
            file_size = int(Path(abs_path).stat().st_size)
    except Exception:
        file_size = None

    # Provide a user-friendly description for pretrained models when none exists
    # AiModel does not have a description field; we synthesize one for UI parity
    synthesized_description: Optional[str] = None
    try:
        if source == "pretrained":
            synthesized_description = f"Pre-trained {m.name} model"
    except Exception:
        synthesized_description = None

    # Map DB model to runtime ModelManager id so frontend actions (delete/download)
    # can call the correct endpoints. Prefer exact file path match, fall back to name.
    manager_id: Optional[str] = None
    try:
        normalized_name = (m.name or "").strip().lower()
        abs_runtime_path = None
        try:
            abs_runtime_path = str(Path(abs_path).resolve()) if abs_path else None
        except Exception:
            abs_runtime_path = abs_path

        for mid, info in model_manager.models_info.items():
            # Fast name check first
            info_name = (getattr(info, "name", "") or "").strip().lower()
            if normalized_name and info_name == normalized_name:
                manager_id = mid
                # If path also matches, it's a definitive mapping; break immediately
                try:
                    info_path = str(Path(getattr(info, "path", "")).resolve()) if getattr(info, "path", None) else None
                except Exception:
                    info_path = getattr(info, "path", None)
                if abs_runtime_path and info_path and abs_runtime_path == info_path:
                    break
        # Secondary path-only match (in case names have changed)
        if not manager_id and abs_runtime_path:
            for mid, info in model_manager.models_info.items():
                try:
                    info_path = str(Path(getattr(info, "path", "")).resolve()) if getattr(info, "path", None) else None
                except Exception:
                    info_path = getattr(info, "path", None)
                if info_path and info_path == abs_runtime_path:
                    manager_id = mid
                    break
    except Exception:
        manager_id = None

    return {
        "id": m.id,
        # Runtime ModelManager id for actions (delete/download)
        "manager_id": manager_id,
        "name": m.name,
        "type": m.type,
        "format": m.format,
        "classes": classes,
        "num_classes": num_classes,
        "input_size": m.input_size_default,
        "training_input_size": m.training_input_size,
        "file_path": m.file_path,
        "file_size": file_size,
        "project_id": m.project_id,
        "scope": scope,
        # Authoritative flags for UI
        "source": source,
        "is_custom": is_custom,
        "is_pretrained": is_pretrained,
        "is_ready": is_ready,
        "is_training": is_training,
        # UI-friendly extras to align project-scoped view with global model view
        "description": synthesized_description,
        "created_at": m.created_at.isoformat() if getattr(m, "created_at", None) else None,
    }