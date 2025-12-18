import os
import yaml
import json
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
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
            
            # Convert relative 'path' to absolute if needed
            dataset_path = data_config.get('path', dataset_base)
            if not os.path.isabs(dataset_path):
                # Path is relative to the original data.yaml location
                dataset_path = os.path.abspath(os.path.join(dataset_base, dataset_path))
            
            # Map selected split to "val" for YOLO validation
            temp_data_config = {
                'path': dataset_path,  # Now always absolute!
                'nc': data_config['nc'],
                'names': data_config['names'],
                'val': f'{dataset_source}/images', 
                'train': data_config.get('train', 'train/images')
            }
            
            os.makedirs(output_folder, exist_ok=True)
            temp_yaml_path = os.path.join(output_folder, 'temp_data.yaml')
            with open(temp_yaml_path, 'w') as f:
                yaml.dump(temp_data_config, f)
            
            # 2. Load and run model
            logger.info("app.validator", f"Running Ultralytics validation on {dataset_source}", "validation_start", {
                "model": model_path,
                "split": dataset_source
            })
            
            model = YOLO(model_path)
            
            results = model.val(
                data=temp_yaml_path,
                task=params.get('task', 'detect'),
                imgsz=params.get('imgsz', 640),
                batch=params.get('batch', 16),
                conf=params.get('confidence', 0.25),
                iou=params.get('iou_threshold', 0.45),
                max_det=params.get('max_detections', 300),
                device=params.get('device', '0'),
                project=output_folder,
                name='validation',
                save=True,
                save_json=True,
                plots=True
            )
            
            # 3. Extract metrics and confusion matrix
            metrics_summary = results.results_dict
            
            # Standard metrics
            metrics = {
                'mAP@0.5': metrics_summary.get('metrics/mAP50(B)', 0),
                'mAP@0.5:0.95': metrics_summary.get('metrics/mAP50-95(B)', 0),
                'precision': metrics_summary.get('metrics/precision(B)', 0),
                'recall': metrics_summary.get('metrics/recall(B)', 0),
            }
            # Calculate F1 manually as in spec
            p = metrics['precision']
            r = metrics['recall']
            metrics['f1'] = (2 * p * r) / (p + r + 1e-6)
            
            # Per-class metrics
            per_class = {}
            if results.names:
                for class_id, class_name in results.names.items():
                    per_class[class_name] = {
                        'mAP50': results.box.maps[class_id] if hasattr(results, 'box') else 0,
                        'precision': results.box.p[class_id] if hasattr(results, 'box') else 0,
                        'recall': results.box.r[class_id] if hasattr(results, 'box') else 0
                    }
            
            confusion_matrix = results.confusion_matrix.matrix.tolist() if results.confusion_matrix else None
            
            return {
                'metrics': metrics,
                'per_class_metrics': per_class,
                'confusion_matrix': confusion_matrix,
                'results_json': results.to_json(),
                'output_folder': os.path.join(output_folder, 'validation')
            }
            
        except Exception as e:
            logger.error("errors.validator", f"Ultralytics validation failed: {str(e)}", "validation_error")
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
