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


def generate_ultralytics_training_yaml(resolved_config: Dict[str, Any], output_path: str) -> str:
    """
    Generate YAML config file for Ultralytics YOLO training from resolved config.
    
    **FRAMEWORK: Ultralytics YOLO ONLY**
    
    Args:
        resolved_config: Dict with train, hyperparameters, augmentation, val sections
        output_path: Path to write YAML file
        
    Returns:
        str: Path to generated YAML file
    """
    # Flatten nested structure for YOLO
    # Current DB structure: flat defaults at root + nested user overrides
    # Strategy: Start with root params, then override with nested sections
    
    # Step 1: Get all root-level parameters (exclude nested sections)
    flattened = {k: v for k, v in resolved_config.items() 
                 if k not in ['train', 'hyperparameters', 'augmentation', 'val', 'dataset', 'predict', 'visualize', 'export', 'outputs']}
    
    # Step 2: Override with nested sections (these are user overrides that should win)
    for section in ['train', 'hyperparameters', 'augmentation', 'val']:
        if section in resolved_config and isinstance(resolved_config[section], dict):
            flattened.update(resolved_config[section])
    
    # Write to YAML
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        yaml.safe_dump(flattened, f, default_flow_style=False, sort_keys=False)
    
    logger.info("operations.training", "Generated training YAML", "yaml_generator", {"path": str(output_file)})
    return str(output_file)
