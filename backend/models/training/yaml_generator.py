"""
YAML Generator for Ultralytics YOLO Training

This module generates YAML configuration files specifically for Ultralytics YOLO framework.
For other frameworks (e.g., MMDetection, Detectron2), create separate generator modules.
"""

import yaml
from pathlib import Path
from typing import Dict, Any
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


def generate_ultralytics_training_yaml(resolved_config: Dict[str, Any], output_path: str, framework: str = "ultralytics", task: str = "segmentation") -> str:
    """
    Generate YAML config file for Ultralytics YOLO training from resolved config.
    
    **FRAMEWORK: Ultralytics YOLO ONLY**
    
    Args:
        resolved_config: Dict with train, hyperparameters, augmentation, val sections (user overrides only)
        output_path: Path to write YAML file
        framework: Framework name (default: "ultralytics")
        task: Task type (default: "segmentation")
        
    Returns:
        str: Path to generated YAML file
    """
    from .config import load_base_config
    
    # Load base config from YAML file (flat structure with ALL defaults)
    base_config = load_base_config(framework, task)
    
    # Flatten base config (it's already flat in the YAML, but may have nested sections)
    flattened = {}
    if isinstance(base_config, dict):
        # Get all root-level parameters from base (exclude nested sections)
        for k, v in base_config.items():
            if k not in ['train', 'hyperparameters', 'augmentation', 'val', 'dataset', 'predict', 'visualize', 'export', 'outputs']:
                flattened[k] = v
        
        # Also flatten any nested sections in base config
        for section in ['train', 'hyperparameters', 'augmentation', 'val']:
            if section in base_config and isinstance(base_config[section], dict):
                flattened.update(base_config[section])
    
    # Override with user's nested config (these are user overrides that should win!)
    for section in ['train', 'hyperparameters', 'augmentation', 'val']:
        if section in resolved_config and isinstance(resolved_config[section], dict):
            flattened.update(resolved_config[section])
    
    # Add required YOLO parameters (must match official YOLO format)
    # Map our DB task names to YOLO's official task names
    task_mapping = {
        "detection": "detect",
        "segmentation": "segment"
    }
    flattened['task'] = task_mapping.get(task, "segment")
    flattened['mode'] = 'train'  # Always train mode for this config generator
    
    # Find Project Root (dynamically)
    # .../backend/models/training/yaml_generator.py -> resolve -> parents[3] = ROOT
    current_file = Path(__file__).resolve()
    project_root = current_file.parents[3]

    # Fix 'data' path: Resolve to absolute path
    # This fixes "Dataset images not found" because YOLO needs absolute path to data.yaml
    # to correctly resolve relative image paths inside it.
    if 'data' in flattened and isinstance(flattened['data'], str):
        data_path = flattened['data']
        # Try resolving against project root
        abs_data_path = project_root / data_path
        if abs_data_path.exists():
            flattened['data'] = str(abs_data_path)
    
    # Fix Model Path: Resolve to absolute path
    # Handles both:
    # 1. Retraining: 'projects/gevis/.../best.pt'
    # 2. Base Model: 'yolo11n.pt' (in models/yolo)
    for key in ['model', 'pretrained']:
        if key in flattened and isinstance(flattened[key], str):
            model_path_str = flattened[key]
            # 1. Check if it exists relative to project root (e.g. projects/gevis/model/...)
            abs_model_path = project_root / model_path_str
            if abs_model_path.exists():
                flattened[key] = str(abs_model_path)
            else:
                # 2. Check if it's in models/yolo (Base models - Global)
                # User confirmed global models are in 'models/yolo'
                local_model = project_root / "models" / "yolo" / model_path_str
                if local_model.exists():
                    flattened[key] = str(local_model)
    
    # Convert device format: "cuda:0" → 0, "cpu" → "cpu"
    
    # Convert device format: "cuda:0" → 0, "cpu" → "cpu"
    if 'device' in flattened:
        device = flattened['device']
        if isinstance(device, str):
            if device.startswith('cuda:'):
                # Extract GPU index: "cuda:0" → 0
                try:
                    flattened['device'] = int(device.replace('cuda:', ''))
                except ValueError:
                    flattened['device'] = 0  # Default to first GPU if parse fails
            elif device == 'cpu':
                flattened['device'] = 'cpu'  # Keep as string

    # Handle early_stop -> patience mapping
    # YOLO uses 'patience' (int), our UI uses 'early_stop' (bool)
    if 'early_stop' in flattened:
        early_stop = flattened.pop('early_stop')  # Remove invalid key
        if early_stop:
            # If enabled, ensure patience is > 0 (default to 30 if not set or 0)
            if 'patience' not in flattened or flattened['patience'] == 0:
                flattened['patience'] = 30
        else:
            # If disabled, set patience to 0
            flattened['patience'] = 0

    # Remove internal UI keys that aren't valid YOLO args
    if 'enabled' in flattened:
        flattened.pop('enabled')
    
    # Write to YAML
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        yaml.safe_dump(flattened, f, default_flow_style=False, sort_keys=False)
    
    logger.info("operations.training", "Generated training YAML", "yaml_generator", {"path": str(output_file)})
    return str(output_file)
