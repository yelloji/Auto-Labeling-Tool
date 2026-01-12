import os
import json
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pathlib import Path
from ultralytics import YOLO
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

class BasePredictor(ABC):
    """Abstract base class for all model predictors"""
    
    @abstractmethod
    def predict(self, model_path: str, images: List[str], output_folder: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run prediction on images
        
        Args:
            model_path: Path to model weights
            images: List of image paths or folder path to predict on
            output_folder: Where to save results
            params: Prediction parameters (confidence, iou_threshold, imgsz, etc.)
            
        Returns:
            Dict containing:
            - predictions: JSON with all detections {image_name: [{class, conf, bbox}]}
            - analytics_summary: Pre-computed statistics
            - output_folder: Path to results
            - image_count: Number of images processed
        """
        pass


class UltralyticsPredictor(BasePredictor):
    """Official Ultralytics YOLO Predictor implementation"""
    
    def predict(self, model_path: str, images: List[str], output_folder: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run prediction using the official Ultralytics API
        
        Args:
            model_path: Path to YOLO model file (best.pt, last.pt)
            images: List of image paths or single folder path
            output_folder: Custom output directory
            params: Dict with confidence, iou_threshold, imgsz, task, device, etc.
            
        Returns:
            Dict with predictions JSON and analytics summary
        """
        try:
            # 1. Prepare output folder
            os.makedirs(output_folder, exist_ok=True)
            
            # 2. Log prediction start
            logger.info("operations.training", f"Running Ultralytics prediction on {len(images) if isinstance(images, list) else 'folder'} images", "prediction_start", {
                "model": model_path,
                "image_count": len(images) if isinstance(images, list) else "unknown"
            })
            
            # 3. Load model
            model = YOLO(model_path)
            
            # 4. Run prediction
            # Map frontend task names to YOLO task names
            task_name = params.get('task', 'detect')
            if task_name == 'detection':
                task_name = 'detect'
            elif task_name == 'segmentation':
                task_name = 'segment'
            
            # Note: name='' ensures results are saved DIRECTLY in output_folder, no /predict/ subfolder
            results = model.predict(
                source=images,  # Can be list of paths, folder path, or single image
                task=task_name,  # 'detect' or 'segment' (YOLO format)
                imgsz=params.get('imgsz', 640),
                conf=params.get('confidence', 0.25),
                iou=params.get('iou_threshold', 0.45),
                max_det=params.get('max_det', 300),
                device=params.get('device', '0'),  # '0' for GPU, 'cpu' for CPU
                project=output_folder,
                name='',  # Save directly in output_folder
                save=True,  # Save annotated images
                save_txt=True,  # Save labels as .txt files
                save_conf=True,  # Save confidence in labels
                show_labels=True,  # Show labels on images
                show_conf=True  # Show confidence on images
            )
            
            # 5. Extract predictions per image
            predictions = {}
            total_detections = 0
            classes_detected = {}
            images_with_detections = 0
            images_without_detections = 0
            confidence_sum = 0.0
            confidence_count = 0
            confidence_distribution = {
                "0.0-0.2": 0,
                "0.2-0.5": 0,
                "0.5-0.8": 0,
                "0.8-1.0": 0
            }
            
            for result in results:
                # IMPORTANT: Use the SAVED OUTPUT filename, not the input filename
                # YOLO may convert formats (e.g., .png input → .jpg output)
                # result.path = input image path
                # result.save_dir = output folder where YOLO saved the annotated image
                
                # Get input filename for reference
                input_name = Path(result.path).name
                
                # Find the actual saved output file
                # YOLO saves to: output_folder/predict/{image_name}.jpg (in a subfolder!)
                # Use recursive glob to search in main folder and subfolders
                saved_files = list(Path(output_folder).glob(f"**/{Path(input_name).stem}.*"))
                
                # Use the saved filename if found, otherwise fall back to input name
                if saved_files:
                    # Filter out .txt files (labels), only get image files
                    image_files = [f for f in saved_files if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']]
                    if image_files:
                        image_name = image_files[0].name
                    else:
                        image_name = input_name
                else:
                    image_name = input_name
                
                boxes = result.boxes
                
                image_predictions = []
                for i in range(len(boxes)):
                    class_id = int(boxes.cls[i])
                    class_name = result.names[class_id]
                    confidence = float(boxes.conf[i])
                    bbox = boxes.xyxy[i].tolist()  # [x1, y1, x2, y2]
                    
                    image_predictions.append({
                        'class': class_name,
                        'confidence': confidence,
                        'bbox': bbox
                    })
                    
                    # Update analytics
                    total_detections += 1
                    classes_detected[class_name] = classes_detected.get(class_name, 0) + 1
                    confidence_sum += confidence
                    confidence_count += 1
                    
                    # Confidence distribution
                    if confidence < 0.2:
                        confidence_distribution["0.0-0.2"] += 1
                    elif confidence < 0.5:
                        confidence_distribution["0.2-0.5"] += 1
                    elif confidence < 0.8:
                        confidence_distribution["0.5-0.8"] += 1
                    else:
                        confidence_distribution["0.8-1.0"] += 1
                
                predictions[image_name] = image_predictions
                
                # Track images with/without detections
                if len(image_predictions) > 0:
                    images_with_detections += 1
                else:
                    images_without_detections += 1
            
            # 6. Compute analytics summary
            image_count = len(results)
            avg_confidence = confidence_sum / confidence_count if confidence_count > 0 else 0.0
            avg_detections_per_image = total_detections / image_count if image_count > 0 else 0.0
            
            analytics_summary = {
                'total_detections': total_detections,
                'avg_detections_per_image': round(avg_detections_per_image, 2),
                'avg_confidence': round(avg_confidence, 4),
                'classes_detected': classes_detected,
                'images_with_detections': images_with_detections,
                'images_without_detections': images_without_detections,
                'confidence_distribution': confidence_distribution
            }
            
            logger.info("operations.training", f"Prediction completed: {image_count} images, {total_detections} detections", "prediction_complete", {
                "image_count": image_count,
                "total_detections": total_detections
            })
            
            return {
                'predictions': predictions,
                'analytics_summary': analytics_summary,
                'output_folder': Path(output_folder).as_posix(),
                'image_count': image_count
            }
            
        except Exception as e:
            logger.error("errors.prediction", f"Ultralytics prediction task hit a critical error: {str(e)}", "prediction_critical_error")
            raise


class PredictorRegistry:
    """Registry to manage different framework predictors"""
    
    _predictors = {
        'ultralytics': UltralyticsPredictor
        # Future frameworks can be added here:
        # 'mmdetection': MMDetectionPredictor,
        # 'tensorflow': TensorFlowPredictor,
        # 'pytorch': PyTorchPredictor,
    }
    
    @classmethod
    def get_predictor(cls, framework: str) -> BasePredictor:
        """
        Get predictor instance for specified framework
        
        Args:
            framework: Framework name ('ultralytics', 'mmdetection', etc.)
            
        Returns:
            Instance of BasePredictor subclass
            
        Raises:
            ValueError: If framework is not supported
        """
        predictor_class = cls._predictors.get(framework.lower())
        if not predictor_class:
            raise ValueError(f"Unsupported framework: {framework}")
        return predictor_class()
