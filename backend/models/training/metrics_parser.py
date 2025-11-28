"""
Training Metrics Parser
Extracts live training metrics from training.log for the dashboard.
"""
import re
import json
from pathlib import Path
from typing import Dict, List, Optional


def parse_training_log(log_file_path: Path, framework: str = None, task: str = None) -> Dict:
    """
    Parse training.log to extract live metrics with framework/task awareness.
    
    Args:
        log_file_path: Path to training.log
        framework: Training framework (e.g., 'ultralytics')
        task: Task type (e.g., 'object_detection', 'segmentation')
        
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
        
        # Determine if this is segmentation or detection task
        is_segmentation = task == 'segmentation' if task else None
        
        # Auto-detect task type if not provided by checking for seg_loss in log
        if is_segmentation is None:
            for line in recent_lines:
                if 'Seg Loss' in line or re.search(r'\d+/\d+\s+[0-9.]+[A-Z]?\s+(?:[0-9.]+\s+){4}', line):
                    is_segmentation = True
                    break
            if is_segmentation is None:
                is_segmentation = False  # Default to detection
        
        # Regex patterns based on task type
        if is_segmentation:
            # Segmentation: 4 losses (box, seg, cls, dfl)
            # "13/20  0.98G  0.7529  1.071  1.328  1.895  2  640:  10%|#"
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
        else:
            # Object Detection: 3 losses (box, cls, dfl) - NO seg_loss
            # "18/20  0.387G  1.262  0.8437  1.591  7  640:  71%|#"
            progress_pattern = re.compile(
                r'\s*(\d+)/(\d+)\s+'  # Epoch (1/2)
                r'([0-9.]+[A-Z]?)\s+'  # GPU (3)
                r'([0-9.]+)\s+'  # Box Loss (4)
                r'([0-9.]+)\s+'  # Cls Loss (5)
                r'([0-9.]+)\s+'  # DFL Loss (6)
                r'(\d+)\s+'  # Instances (7)
                r'(\d+):\s+'  # Size (8)
                r'(\d+)%'  # Progress % (9)
            )
        
        # Batch progress: Must have "it/s" to distinguish from epoch "1/20"
        # Examples: "4/29 2.70it/s" or "1/29 1.6it/s 1.8s<17.6s"
        # Captures: batch(1), total(2), speed(3), eta(4)
    
        batch_pattern = re.compile(r'(\d+)/(\d+)\s+(?:\[.*?|)([\d.]+)it/s(?:.*?<([\d.]+)s)?')
        
        # Validation results patterns based on task type
        if is_segmentation:
            # Segmentation: Box + Mask metrics
            # "all  19  19  0.0118  1  0.866  0.282  0.00186  0.158  0.00114  0.000406"
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
        else:
            # Object Detection: Box metrics only
            # "all  70  70  0.913  0.602  0.921  0.421"
            val_pattern = re.compile(
                r'\s*(\S+)\s+'  # Class name (1)
                r'(\d+)\s+'  # Images (2)
                r'(\d+)\s+'  # Instances (3)
                r'([0-9.]+)\s+'  # Box P (4)
                r'([0-9.]+)\s+'  # Box R (5)
                r'([0-9.]+)\s+'  # Box mAP50 (6)
                r'([0-9.]+)'  # Box mAP50-95 (7)
            )
        
        # Parse lines
        for line in recent_lines:
            # Check for training progress
            prog_match = progress_pattern.search(line)
            if prog_match:
                if is_segmentation:
                    # Segmentation: has seg_loss
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
                else:
                    # Object Detection: no seg_loss
                    metrics["training"] = {
                        "epoch": int(prog_match.group(1)),
                        "total_epochs": int(prog_match.group(2)),
                        "gpu_mem": prog_match.group(3),
                        "box_loss": float(prog_match.group(4)),
                        "cls_loss": float(prog_match.group(5)),
                        "dfl_loss": float(prog_match.group(6)),
                        "instances": int(prog_match.group(7)),
                        "img_size": int(prog_match.group(8)),
                        "progress_pct": int(prog_match.group(9))
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
                if is_segmentation:
                    # Segmentation: Box + Mask metrics
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
                else:
                    # Object Detection: Box metrics only
                    class_metrics = {
                        "class": class_name,
                        "images": int(val_match.group(2)),
                        "instances": int(val_match.group(3)),
                        "box_p": float(val_match.group(4)),
                        "box_r": float(val_match.group(5)),
                        "box_map50": float(val_match.group(6)),
                        "box_map50_95": float(val_match.group(7))
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
