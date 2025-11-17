import os
from pathlib import Path
from typing import Dict, Any

import yaml

from core.config import settings
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


def _load_yaml_file(p: Path) -> Dict[str, Any]:
    with open(p, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_base_config(framework: str, task: str) -> Dict[str, Any]:
    base_dir = Path(settings.BASE_DIR)
    if framework.lower() == "ultralytics":
        task_norm = (task or "segmentation").lower()
        cfg_rel = Path("backend/models/training/configs/ultralytics") / task_norm / "default.yaml"
        cfg_path = base_dir / cfg_rel
        if cfg_path.exists():
            logger.info("operations.training", "Loaded base Ultralytics config", "training_load_base_config", {"framework": framework, "task": task_norm, "path": str(cfg_path)})
            return _load_yaml_file(cfg_path)
        # Fallback to repository root default if present
        fallback = base_dir / "default_yolo11.yaml"
        if fallback.exists():
            logger.info("operations.training", "Loaded fallback base config", "training_load_base_config_fallback", {"framework": framework, "task": task_norm, "path": str(fallback)})
            return _load_yaml_file(fallback)
    logger.warning("operations.training", "Base config file not found, returning empty config", "training_base_config_missing", {"framework": framework, "task": task})
    return {}


def _deep_merge(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(a)
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def resolve_config(framework: str, task: str, overrides: Dict[str, Any]) -> Dict[str, Any]:
    base = load_base_config(framework, task)
    resolved = _deep_merge(base, overrides or {})
    # Auto-bind data.yaml into train.data if provided
    try:
        ds = resolved.get("dataset", {})
        dy = ds.get("data_yaml_path")
        if dy:
            tr = resolved.get("train", {})
            tr["data"] = dy
            resolved["train"] = tr
    except Exception:
        pass
    logger.info("operations.training", "Resolved training config", "training_resolve_config", {"framework": framework, "task": task})
    return resolved


def build_args_preview(framework: str, task: str, config: Dict[str, Any]) -> Dict[str, Any]:
    args = []
    if framework.lower() == "ultralytics":
        train = config.get("train", {})
        dataset = config.get("dataset", {})
        model_name = train.get("model")
        if model_name:
            args += ["model=" + str(model_name)]
        zip_path = dataset.get("zip_path")
        if zip_path:
            args += ["data=" + str(zip_path)]
        epochs = train.get("epochs")
        if epochs is not None:
            args += ["epochs=" + str(epochs)]
        imgsz = train.get("imgsz")
        if imgsz is not None:
            args += ["imgsz=" + str(imgsz)]
        batch = train.get("batch")
        if batch:
            args += ["batch=" + str(batch)]
        amp = train.get("amp")
        if amp is not None:
            args += ["amp=" + ("True" if bool(amp) else "False")]
        device = train.get("device")
        if device:
            args += ["device=" + str(device)]
        early_stop = train.get("early_stop")
        if early_stop is not None:
            args += ["early_stop=" + ("True" if bool(early_stop) else "False")]
        save_best = train.get("save_best")
        if save_best is not None:
            args += ["save_best=" + ("True" if bool(save_best) else "False")]
    return {"framework": framework, "task": task, "args": args}