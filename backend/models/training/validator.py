import os
# VERSION: 20251222_1512 (Safe Serialization Fix Verified)
import yaml
import json
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pathlib import Path
from ultralytics import YOLO
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

class BaseValidator(ABC):
    """Abstract base class for all model validators"""
    @abstractmethod
    def validate(self, model_path: str, dataset_yaml: str, output_folder: str, params: Dict[str, Any]) -> Dict[str, Any]:
        pass

class UltralyticsValidator(BaseValidator):
    """Official Ultralytics YOLO Validator implementation"""
    
    def validate(self, model_path: str, dataset_yaml: str, output_folder: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run validation using the official Ultralytics API
        """
        try:
            # 1. Prepare temporary data.yaml for custom split
            dataset_source = params.get('dataset_source', 'val')
            
            with open(dataset_yaml, 'r') as f:
                data_config = yaml.safe_load(f)
            
            dataset_base = os.path.dirname(dataset_yaml)
            
            # Resolve 'path' from data.yaml. 
            # YOLO often uses paths relative to repo root. We must prevent doubling.
            raw_data_path = data_config.get('path', '.')
            
            # Convert to Path object for easier manipulation
            raw_p = Path(raw_data_path)
            yaml_p = Path(dataset_yaml).parent
            
            if raw_p.is_absolute():
                dataset_path = raw_p
            else:
                # Check if it exists relative to current work dir
                if raw_p.exists():
                    dataset_path = raw_p.absolute()
                else:
                    # It's likely relative to the YAML file
                    # BUT wait: if the raw_path is already "projects/..." and the YAML 
                    # is also inside "projects/...", joining them causes doubling.
                    
                    # Check if 'projects' (or common root) is in both
                    candidate = (yaml_p / raw_p).resolve()
                    
                    # If the candidate doesn't exist but the raw_p looks like a repo-relative path
                    # (starting with 'projects'), we might need to look 'up' from the yaml_p
                    if not candidate.exists() and str(raw_p).startswith('projects'):
                        # Try to find the repo root by walking up from yaml_p
                        root_finder = yaml_p
                        found_root_path = None
                        for _ in range(10): # Max 10 levels up
                            if (root_finder / raw_p).exists():
                                found_root_path = (root_finder / raw_p).absolute()
                                break
                            if root_finder.parent == root_finder: break
                            root_finder = root_finder.parent
                        
                        dataset_path = found_root_path or candidate
                    else:
                        dataset_path = candidate

            # Force forward slashes and string format for YAML
            final_dataset_path = dataset_path.as_posix()
            
            # Map selected split to "val" for YOLO validation
            temp_data_config = {
                'path': final_dataset_path,
                'nc': data_config['nc'],
                'names': data_config['names'],
                'val': f'images/{dataset_source}', 
                'train': data_config.get('train', 'train/images')
            }
            
            os.makedirs(output_folder, exist_ok=True)
            temp_yaml_path = Path(output_folder) / 'temp_data.yaml'
            with open(temp_yaml_path, 'w') as f:
                yaml.dump(temp_data_config, f)
            
            # 2. Load and run model
            logger.info("operations.training", f"Running Ultralytics validation on {dataset_source}", "validation_start", {
                "model": model_path,
                "split": dataset_source
            })
            
            model = YOLO(model_path)
            
            # Run the actual validation
            # name='' ensures results are saved DIRECTLY in output_folder, no /validation/ subfolder.
            try:
                results = model.val(
                    data=temp_yaml_path.as_posix(),
                    task=params.get('task', 'detect'),
                    imgsz=params.get('imgsz', 640),
                    batch=params.get('batch', 16),
                    conf=params.get('confidence', 0.25),
                    iou=params.get('iou_threshold', 0.45),
                    max_det=params.get('max_detections', 300),
                    device=params.get('device', '0'),
                    project=output_folder,
                    name='', 
                    save=True,
                    save_json=True,
                    plots=True
                )
            finally:
                # Clean up temporary YAML file
                if temp_yaml_path.exists():
                    try:
                        os.remove(temp_yaml_path)
                    except Exception as e:
                        logger.warning("operations.training", f"Failed to delete temp yaml: {e}", "temp_cleanup_error")
            
            # 3. Robust Results Extraction
            metrics = {}
            per_class_list = []
            labeled_matrix = []
            
            try:
                # Helper to safely convert numpy/tensor to float
                def to_f(v):
                    if v is None: return 0.0
                    try: return float(v)
                    except: return 0.0

                res_dict = results.results_dict
                is_seg = params.get('task') == 'segmentation' or 'mask' in str(results.task).lower()
                
                # A. Main KPIs (Map to spec keys)
                metrics = {
                    'map50': to_f(res_dict.get('metrics/mAP50(B)', 0)),
                    'map50_95': to_f(res_dict.get('metrics/mAP50-95(B)', 0)),
                    'precision': to_f(res_dict.get('metrics/precision(B)', 0)),
                    'recall': to_f(res_dict.get('metrics/recall(B)', 0)),
                }
                # F1 Score calculation
                p, r = metrics['precision'], metrics['recall']
                metrics['f1'] = (2 * p * r) / (p + r + 1e-6)

                if is_seg:
                    metrics.update({
                        'mask_map50': to_f(res_dict.get('metrics/mAP50(M)', 0)),
                        'mask_map50_95': to_f(res_dict.get('metrics/mAP50-95(M)', 0)),
                        'mask_precision': to_f(res_dict.get('metrics/precision(M)', 0)),
                        'mask_recall': to_f(res_dict.get('metrics/recall(M)', 0)),
                    })
                    mp, mr = metrics['mask_precision'], metrics['mask_recall']
                    metrics['mask_f1'] = (2 * mp * mr) / (mp + mr + 1e-6)

                # B. Per-class metrics (Array of objects for frontend Table)
                if results.names:
                    # Sort class IDs to ensure consistent ordering
                    sorted_ids = sorted(results.names.keys())
                    for class_id in sorted_ids:
                        class_name = results.names[class_id]
                        
                        # Boxes
                        b_prec = to_f(results.box.p[class_id]) if hasattr(results, 'box') and results.box.p is not None else 0.0
                        b_rec = to_f(results.box.r[class_id]) if hasattr(results, 'box') and results.box.r is not None else 0.0
                        b_map50 = to_f(results.box.ap50[class_id]) if hasattr(results, 'box') and results.box.ap50 is not None else 0.0
                        b_map = to_f(results.box.ap[class_id]) if hasattr(results, 'box') and results.box.ap is not None else 0.0
                        
                        item = {
                            'name': str(class_name),
                            'precision': b_prec,
                            'recall': b_rec,
                            'map50': b_map50,
                            'map50_95': b_map,
                            'f1': (2 * b_prec * b_rec) / (b_prec + b_rec + 1e-6)
                        }
                        
                        if is_seg and hasattr(results, 'seg') and results.seg is not None:
                            # Masks
                            item.update({
                                'mask_precision': to_f(results.seg.p[class_id]) if results.seg.p is not None else 0.0,
                                'mask_recall': to_f(results.seg.r[class_id]) if results.seg.r is not None else 0.0,
                                'mask_map50': to_f(results.seg.ap50[class_id]) if results.seg.ap50 is not None else 0.0,
                                'mask_map50_95': to_f(results.seg.ap[class_id]) if results.seg.ap is not None else 0.0,
                            })
                            mp, mr = item.get('mask_precision', 0), item.get('mask_recall', 0)
                            item['mask_f1'] = (2 * mp * mr) / (mp + mr + 1e-6)
                            
                        per_class_list.append(item)

                # C. Confusion Matrix (Labeled List for frontend Heatmap)
                # Ensure we check for existence properly (some versions might evaluate to False if empty)
                cm_obj = getattr(results, 'confusion_matrix', None)
                if cm_obj is not None and hasattr(cm_obj, 'matrix'):
                    cm_array = cm_obj.matrix
                    # Get class names including 'background'
                    # Ultralytics puts background at index nc
                    sorted_names = [results.names[idx] for idx in sorted_ids] + ['background']
                    
                    for i, actual_name in enumerate(sorted_names):
                        for j, pred_name in enumerate(sorted_names):
                            try:
                                count = int(cm_array[i, j])
                                labeled_matrix.append({
                                    'actual': str(actual_name),
                                    'predicted': str(pred_name),
                                    'count': count
                                })
                            except:
                                continue
            except Exception as parsing_error:
                logger.warning("errors.validation", f"Minor error parsing validation results: {str(parsing_error)}", "result_parsing_warning")

            # Prepare a safe JSON string for results_json
            safe_res_json = "{}"
            try:
                serializable_res = {str(k): to_f(v) for k, v in res_dict.items()}
                safe_res_json = json.dumps(serializable_res)
            except:
                pass

            return {
                'metrics': metrics,
                'per_class_metrics': per_class_list,
                'confusion_matrix': labeled_matrix,
                'results_json': safe_res_json,
                'output_folder': Path(output_folder).as_posix()
            }
            
        except Exception as e:
            logger.error("errors.validation", f"Ultralytics validation task hit a critical error: {str(e)}", "validation_critical_error")
            raise

class ValidatorRegistry:
    """Registry to manage different framework validators"""
    _validators = {
        'ultralytics': UltralyticsValidator
    }
    
    @classmethod
    def get_validator(cls, framework: str) -> BaseValidator:
        validator_class = cls._validators.get(framework.lower())
        if not validator_class:
            raise ValueError(f"Unsupported framework: {framework}")
        return validator_class()
