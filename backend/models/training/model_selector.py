from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from database.operations import AiModelOperations

def get_trainable_models(db: Session, project_id: Optional[int], framework: str, task: str) -> List[Dict]:
    models = AiModelOperations.list_models_by_project(db, project_id, include_global=True)
    task_map = {
        "detection": {"types": {"object_detection"}},
        "segmentation": {"types": {"instance_segmentation", "semantic_segmentation"}},
    }
    cfg = task_map.get(task, {"types": set()})
    out: List[Dict] = []
    for m in models:
        t = str(getattr(m, "type", "")).lower()
        f = str(getattr(m, "format", "")).lower()
        p = str(getattr(m, "file_path", ""))
        if framework == "ultralytics":
            if not p.lower().endswith(".pt") and "pytorch" not in f:
                continue
        if cfg["types"] and t not in cfg["types"]:
            continue
        out.append({
            "id": m.id,
            "name": m.name,
            "type": t,
            "format": f,
            "file_path": p,
            "project_id": m.project_id,
            "project_name": getattr(m, "project_name", None),
            "scope": "project" if m.project_id is not None else "global",
            "training_input_size": getattr(m, "training_input_size", None),  # For Resume validation
        })
    return out
