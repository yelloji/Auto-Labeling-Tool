"""
Training Metrics Parser
Extracts live training metrics from training.log for the dashboard.
"""
import re
import json
from pathlib import Path
from typing import Dict, List, Optional


def parse_training_log(log_file_path: Path) -> Dict:
    """
    Parse training.log to extract live metrics.
    
    Args:
        log_file_path: Path to training.log
        
    Returns:
        Dictionary containing parsed metrics
    """
    metrics = {
        "training": {},
        "validation": {},
        "classes": []
    }
    
    if not log_file_path.exists():
        return metrics
    
    try:
        # Read last 50 lines for context
        with open(log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            recent_lines = lines[-50:] if len(lines) > 50 else lines
        
        # Regex patterns
        # Training progress: "13/20     0.98G      0.7529      1.071      1.328      1.895          2        640:  10%|#"
        progress_pattern = re.compile(
            r'\s*(\d+)/(\d+)\s+'  # Epoch (1/2)
            r'([0-9.]+[A-Z]?)\s+'  # GPU (3)
            r'([0-9.]+)\s+'  # Box Loss (4)
            r'([0-9.]+)\s+'  # Seg Loss (5)
            r'([0-9.]+)\s+'  # Cls Loss (6)
            r'([0-9.]+)\s+'  # DFL Loss (7)
            r'(\d+)\s+'  # Instances (8)
            r'(\d+):\s+'  # Size (9)
            r'(\d+)%'  # Progress % (10)
        )
        
        # Batch progress: "1/29 1.6it/s 1.8s<17.6s" -> batch, total, speed, remaining_time
        # Made speed and time optional to be safe
        batch_pattern = re.compile(r'(\d+)/(\d+)(?:\s+([\d.]+)it/s)?(?:\s+[\d.]+s<([\d.]+)s)?')
        
        # Validation results: "all         19         19     0.0118          1      0.866      0.282    0.00186      0.158    0.00114   0.000406"
        val_pattern = re.compile(
            r'\s*(\S+)\s+'  # Class name (1)
            r'(\d+)\s+'  # Images (2)
            r'(\d+)\s+'  # Instances (3)
            r'([0-9.]+)\s+'  # Box P (4)
            r'([0-9.]+)\s+'  # Box R (5)
            r'([0-9.]+)\s+'  # Box mAP50 (6)
            r'([0-9.]+)\s+'  # Box mAP50-95 (7)
            r'([0-9.]+)\s+'  # Mask P (8)
            r'([0-9.]+)\s+'  # Mask R (9)
            r'([0-9.]+)\s+'  # Mask mAP50 (10)
            r'([0-9.]+)'  # Mask mAP50-95 (11)
        )
        
        # Parse lines
        for line in recent_lines:
            # Check for training progress
            prog_match = progress_pattern.search(line)
            if prog_match:
                metrics["training"] = {
                    "epoch": int(prog_match.group(1)),
                    "total_epochs": int(prog_match.group(2)),
                    "gpu_mem": prog_match.group(3),
                    "box_loss": float(prog_match.group(4)),
                    "seg_loss": float(prog_match.group(5)),
                    "cls_loss": float(prog_match.group(6)),
                    "dfl_loss": float(prog_match.group(7)),
                    "instances": int(prog_match.group(8)),
                    "img_size": int(prog_match.group(9)),
                    "progress_pct": int(prog_match.group(10))
                }
            
            # Check for batch progress (independent of training progress)
            batch_match = batch_pattern.search(line)
            if batch_match and "training" in metrics:
                metrics["training"]["batch"] = int(batch_match.group(1))
                metrics["training"]["total_batches"] = int(batch_match.group(2))
                # Safely handle optional speed and ETA (can be None)
                if batch_match.group(3):
                    metrics["training"]["batch_speed"] = float(batch_match.group(3))
                if batch_match.group(4):
                    metrics["training"]["batch_eta"] = float(batch_match.group(4))
            
            # Check for validation results
            val_match = val_pattern.search(line)
            if val_match:
                class_name = val_match.group(1)
                class_metrics = {
                    "class": class_name,
                    "images": int(val_match.group(2)),
                    "instances": int(val_match.group(3)),
                    "box_p": float(val_match.group(4)),
                    "box_r": float(val_match.group(5)),
                    "box_map50": float(val_match.group(6)),
                    "box_map50_95": float(val_match.group(7)),
                    "mask_p": float(val_match.group(8)),
                    "mask_r": float(val_match.group(9)),
                    "mask_map50": float(val_match.group(10)),
                    "mask_map50_95": float(val_match.group(11))
                }
                
                if class_name == "all":
                    # Store aggregate metrics
                    metrics["validation"] = class_metrics
                else:
                    # Store per-class metrics
                    metrics["classes"].append(class_metrics)
        
        return metrics
        
    except Exception as e:
        # Return empty metrics on error
        return {
            "training": {},
            "validation": {},
            "classes": [],
            "error": str(e)
        }
