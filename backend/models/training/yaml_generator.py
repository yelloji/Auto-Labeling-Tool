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
    
    # Write to YAML
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        yaml.safe_dump(flattened, f, default_flow_style=False, sort_keys=False)
    
    logger.info("operations.training", "Generated training YAML", "yaml_generator", {"path": str(output_file)})
    return str(output_file)
