"""
Auto-labeling pipeline for object detection and segmentation
Core functionality for automatic annotation generation
"""

import os
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import cv2
import numpy as np
from PIL import Image
import torch
from ultralytics import YOLO

# Import professional logging system - CORRECT UNIFORM PATTERN
from logging_system.professional_logger import get_professional_logger

from models.model_manager import ModelManager, ModelInfo
from database.operations import (
    AnnotationOperations, ImageOperations, AutoLabelJobOperations,
    ModelUsageOperations, DatasetOperations
)
from database.database import SessionLocal
from core.config import settings

# Initialize professional logger
logger = get_professional_logger()


class AutoLabeler:
    """Main auto-labeling pipeline"""
    
    def __init__(self):
        self.model_manager = ModelManager()
        self.loaded_models = {}  # Cache for loaded models
        
    def load_model(self, model_id: str) -> Optional[YOLO]:
        """Load and cache a YOLO model"""
        if model_id in self.loaded_models:
            logger.info("operations.operations", f"Model {model_id} already loaded from cache", "model_cache_hit", {
                'model_id': model_id,
                'cached_models': list(self.loaded_models.keys())
            })
            return self.loaded_models[model_id]
        
        model_info = self.model_manager.get_model_info(model_id)
        if not model_info:
            logger.error("errors.validation", f"Model {model_id} not found in model manager", "model_not_found", {
                'model_id': model_id
            })
            return None
        
        try:
            # Load YOLO model
            model = YOLO(model_info.path)
            self.loaded_models[model_id] = model
            logger.info("operations.operations", f"Successfully loaded model: {model_info.name}", "model_loaded", {
                'model_id': model_id,
                'model_name': model_info.name,
                'model_path': model_info.path,
                'cached_models_count': len(self.loaded_models)
            })
            return model
        except Exception as e:
            logger.error("errors.system", f"Failed to load model {model_id}: {e}", "model_load_failed", {
                'model_id': model_id,
                'model_path': model_info.path if model_info else None,
                'error': str(e)
            })
            return None
    
    def predict_image(
        self, 
        image_path: str, 
        model: YOLO,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45
    ) -> Tuple[List[Dict], float]:
        """
        Run inference on a single image
        Returns: (annotations, processing_time)
        """
        start_time = time.time()
        
        logger.info("operations.images", f"Starting inference on image: {os.path.basename(image_path)}", "inference_start", {
            'image_path': image_path,
            'confidence_threshold': confidence_threshold,
            'iou_threshold': iou_threshold
        })
        
        try:
            # Run inference
            results = model.predict(
                image_path,
                conf=confidence_threshold,
                iou=iou_threshold,
                verbose=False
            )
            
            processing_time = time.time() - start_time
            
            if not results or len(results) == 0:
                logger.warning("errors.validation", f"No results returned for image: {os.path.basename(image_path)}", "inference_no_results", {
                    'image_path': image_path,
                    'processing_time': processing_time
                })
                return [], processing_time
            
            result = results[0]  # Get first result
            annotations = []
            
            # Get image dimensions
            img = cv2.imread(image_path)
            if img is None:
                logger.error("errors.system", f"Failed to read image: {image_path}", "image_read_failed", {
                    'image_path': image_path,
                    'processing_time': processing_time
                })
                return [], processing_time
            
            img_height, img_width = img.shape[:2]
            
            # Process detections
            if result.boxes is not None:
                boxes = result.boxes
                detection_count = len(boxes)
                
                logger.info("operations.images", f"Processing {detection_count} detections for image: {os.path.basename(image_path)}", "detections_processing", {
                    'image_path': image_path,
                    'detection_count': detection_count,
                    'image_dimensions': f"{img_width}x{img_height}"
                })
                
                for i in range(len(boxes)):
                    # Get bounding box (xyxy format)
                    box = boxes.xyxy[i].cpu().numpy()
                    confidence = float(boxes.conf[i].cpu().numpy())
                    class_id = int(boxes.cls[i].cpu().numpy())
                    
                    # Convert to normalized coordinates
                    x_min = float(box[0] / img_width)
                    y_min = float(box[1] / img_height)
                    x_max = float(box[2] / img_width)
                    y_max = float(box[3] / img_height)
                    
                    # Get class name
                    class_name = model.names[class_id] if class_id in model.names else f"class_{class_id}"
                    
                    # Handle segmentation if available
                    segmentation = None
                    if result.masks is not None and i < len(result.masks):
                        mask = result.masks.xy[i]  # Get polygon points
                        if len(mask) > 0:
                            # Normalize polygon points
                            segmentation = []
                            for point in mask:
                                segmentation.extend([
                                    float(point[0] / img_width),
                                    float(point[1] / img_height)
                                ])
                    
                    annotation = {
                        'class_name': class_name,
                        'class_id': class_id,
                        'confidence': confidence,
                        'x_min': x_min,
                        'y_min': y_min,
                        'x_max': x_max,
                        'y_max': y_max,
                        'segmentation': segmentation
                    }
                    annotations.append(annotation)
            else:
                logger.info("operations.images", f"No detections found for image: {os.path.basename(image_path)}", "no_detections", {
                    'image_path': image_path,
                    'processing_time': processing_time
                })
            
            logger.info("operations.images", f"Inference completed for image: {os.path.basename(image_path)}", "inference_completed", {
                'image_path': image_path,
                'annotations_count': len(annotations),
                'processing_time': processing_time
            })
            
            return annotations, processing_time
            
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error("errors.system", f"Error processing image {image_path}: {e}", "inference_error", {
                'image_path': image_path,
                'error': str(e),
                'processing_time': processing_time
            })
            return [], processing_time
    
    async def auto_label_dataset(
        self,
        dataset_id: str,
        model_id: str,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        overwrite_existing: bool = False,
        job_id: str = None
    ) -> Dict[str, Any]:
        """
        Auto-label all images in a dataset
        Returns job results and statistics
        """
        db = SessionLocal()
        
        logger.info("operations.operations", f"Starting auto-labeling job for dataset: {dataset_id}", "auto_label_job_start", {
            'dataset_id': dataset_id,
            'model_id': model_id,
            'confidence_threshold': confidence_threshold,
            'iou_threshold': iou_threshold,
            'overwrite_existing': overwrite_existing,
            'job_id': job_id
        })
        
        try:
            # Create or get job
            if not job_id:
                job = AutoLabelJobOperations.create_auto_label_job(
                    db, dataset_id, model_id, confidence_threshold, 
                    iou_threshold, overwrite_existing
                )
                job_id = job.id
                logger.info("operations.operations", f"Created new auto-labeling job: {job_id}", "job_created", {
                    'job_id': job_id,
                    'dataset_id': dataset_id,
                    'model_id': model_id
                })
            else:
                job = AutoLabelJobOperations.get_job(db, job_id)
                logger.info("operations.operations", f"Retrieved existing auto-labeling job: {job_id}", "job_retrieved", {
                    'job_id': job_id,
                    'dataset_id': dataset_id
                })
            
            if not job:
                logger.error("errors.validation", f"Auto-labeling job not found: {job_id}", "job_not_found", {
                    'job_id': job_id
                })
                return {"error": "Job not found"}
            
            # Update job status
            AutoLabelJobOperations.update_job_progress(
                db, job_id, status="processing", progress=0.0
            )
            logger.info("operations.operations", f"Updated job status to processing: {job_id}", "job_status_updated", {
                'job_id': job_id,
                'status': 'processing',
                'progress': 0.0
            })
            
            # Load model
            model = self.load_model(model_id)
            if not model:
                AutoLabelJobOperations.update_job_progress(
                    db, job_id, status="failed", 
                    error_message=f"Failed to load model {model_id}"
                )
                logger.error("errors.system", f"Auto-labeling job failed - model load failed: {model_id}", "job_model_load_failed", {
                    'job_id': job_id,
                    'model_id': model_id
                })
                return {"error": f"Failed to load model {model_id}"}
            
            # Get model info
            model_info = self.model_manager.get_model_info(model_id)
            logger.info("operations.operations", f"Model info retrieved for auto-labeling: {model_info.name}", "model_info_retrieved", {
                'job_id': job_id,
                'model_id': model_id,
                'model_name': model_info.name if model_info else None
            })
            
            # Get images to process
            images = ImageOperations.get_images_by_dataset(
                db, dataset_id, 
                labeled_only=False if overwrite_existing else None
            )
            
            if not overwrite_existing:
                # Filter out already labeled images
                images = [img for img in images if not img.is_labeled]
            
            total_images = len(images)
            logger.info("operations.images", f"Retrieved {total_images} images for auto-labeling from dataset: {dataset_id}", "images_retrieved", {
                'job_id': job_id,
                'dataset_id': dataset_id,
                'total_images': total_images,
                'overwrite_existing': overwrite_existing
            })
            
            if total_images == 0:
                AutoLabelJobOperations.update_job_progress(
                    db, job_id, status="completed", progress=100.0,
                    total_images=0, processed_images=0, successful_images=0
                )
                logger.info("operations.operations", f"Auto-labeling job completed - no images to process: {job_id}", "job_no_images", {
                    'job_id': job_id,
                    'dataset_id': dataset_id
                })
                return {"message": "No images to process", "job_id": job_id}
            
            # Update job with total count
            AutoLabelJobOperations.update_job_progress(
                db, job_id, total_images=total_images
            )
            logger.info("operations.operations", f"Updated job with total image count: {job_id}", "job_total_count_updated", {
                'job_id': job_id,
                'total_images': total_images
            })
            
            # Process images
            processed_count = 0
            successful_count = 0
            failed_count = 0
            total_annotations = 0
            total_processing_time = 0.0
            confidence_sum = 0.0
            confidence_count = 0
            
            logger.info("operations.operations", f"Starting image processing for auto-labeling job: {job_id}", "image_processing_start", {
                'job_id': job_id,
                'total_images': total_images
            })
            
            for i, image in enumerate(images):
                try:
                    logger.info("operations.images", f"Processing image {i+1}/{total_images}: {image.filename}", "image_processing", {
                        'job_id': job_id,
                        'image_id': image.id,
                        'image_filename': image.filename,
                        'image_path': image.file_path,
                        'progress': f"{i+1}/{total_images}"
                    })
                    
                    # Check if image file exists
                    if not os.path.exists(image.file_path):
                        logger.error("errors.validation", f"Image file not found: {image.file_path}", "image_file_missing", {
                            'job_id': job_id,
                            'image_id': image.id,
                            'image_filename': image.filename,
                            'image_path': image.file_path
                        })
                        failed_count += 1
                        continue
                    
                    # Clear existing annotations if overwriting
                    if overwrite_existing:
                        deleted_count = AnnotationOperations.delete_annotations_by_image(db, image.id)
                        logger.info("operations.annotations", f"Cleared {deleted_count} existing annotations for image: {image.filename}", "annotations_cleared", {
                            'job_id': job_id,
                            'image_id': image.id,
                            'deleted_annotations': deleted_count
                        })
                    
                    # Run inference
                    annotations, processing_time = self.predict_image(
                        image.file_path, model, confidence_threshold, iou_threshold
                    )
                    
                    total_processing_time += processing_time
                    
                    # Save annotations
                    for ann_data in annotations:
                        annotation = AnnotationOperations.create_annotation(
                            db=db,
                            image_id=image.id,
                            class_name=ann_data['class_name'],
                            class_id=ann_data['class_id'],
                            x_min=ann_data['x_min'],
                            y_min=ann_data['y_min'],
                            x_max=ann_data['x_max'],
                            y_max=ann_data['y_max'],
                            confidence=ann_data['confidence'],
                            segmentation=ann_data['segmentation'],
                            is_auto_generated=True,
                            model_id=model_id
                        )
                        total_annotations += 1
                        confidence_sum += ann_data['confidence']
                        confidence_count += 1
                    
                    logger.info("operations.annotations", f"Created {len(annotations)} annotations for image: {image.filename}", "annotations_created", {
                        'job_id': job_id,
                        'image_id': image.id,
                        'annotations_count': len(annotations),
                        'total_annotations': total_annotations
                    })
                    
                    # Update image status
                    ImageOperations.update_image_status(
                        db, image.id, 
                        is_labeled=len(annotations) > 0,
                        is_auto_labeled=True
                    )
                    
                    successful_count += 1
                    
                except Exception as e:
                    logger.error("errors.system", f"Failed to process image {image.filename}: {e}", "image_processing_failed", {
                        'job_id': job_id,
                        'image_id': image.id,
                        'image_filename': image.filename,
                        'error': str(e)
                    })
                    failed_count += 1
                
                processed_count += 1
                
                # Update progress
                progress = (processed_count / total_images) * 100
                AutoLabelJobOperations.update_job_progress(
                    db, job_id,
                    progress=progress,
                    processed_images=processed_count,
                    successful_images=successful_count,
                    failed_images=failed_count,
                    total_annotations_created=total_annotations
                )
                
                if processed_count % 10 == 0 or processed_count == total_images:
                    logger.info("operations.operations", f"Auto-labeling progress update: {progress:.1f}% ({processed_count}/{total_images})", "job_progress_update", {
                        'job_id': job_id,
                        'progress': progress,
                        'processed_count': processed_count,
                        'successful_count': successful_count,
                        'failed_count': failed_count,
                        'total_annotations': total_annotations
                    })
                
                # Small delay to prevent overwhelming the system
                if i % 10 == 0:
                    await asyncio.sleep(0.1)
            
            # Calculate average confidence
            avg_confidence = confidence_sum / confidence_count if confidence_count > 0 else 0.0
            avg_processing_time = total_processing_time / processed_count if processed_count > 0 else 0.0
            
            logger.info("operations.operations", f"Auto-labeling job statistics calculated: {job_id}", "job_statistics_calculated", {
                'job_id': job_id,
                'avg_confidence': avg_confidence,
                'avg_processing_time': avg_processing_time,
                'total_processing_time': total_processing_time,
                'confidence_count': confidence_count
            })
            
            # Update model usage statistics
            ModelUsageOperations.update_model_usage(
                db, model_id, model_info.name,
                images_processed=successful_count,
                processing_time=avg_processing_time,
                average_confidence=avg_confidence
            )
            logger.info("operations.operations", f"Updated model usage statistics: {model_id}", "model_usage_updated", {
                'job_id': job_id,
                'model_id': model_id,
                'model_name': model_info.name,
                'images_processed': successful_count,
                'avg_processing_time': avg_processing_time,
                'avg_confidence': avg_confidence
            })
            
            # Update dataset statistics
            DatasetOperations.update_dataset_stats(db, dataset_id)
            logger.info("operations.datasets", f"Updated dataset statistics: {dataset_id}", "dataset_stats_updated", {
                'job_id': job_id,
                'dataset_id': dataset_id
            })
            
            # Complete job
            AutoLabelJobOperations.update_job_progress(
                db, job_id, status="completed", progress=100.0
            )
            logger.info("operations.operations", f"Auto-labeling job completed successfully: {job_id}", "job_completed", {
                'job_id': job_id,
                'dataset_id': dataset_id,
                'total_images': total_images,
                'successful_images': successful_count,
                'failed_images': failed_count,
                'total_annotations': total_annotations
            })
            
            return {
                "job_id": job_id,
                "status": "completed",
                "total_images": total_images,
                "processed_images": processed_count,
                "successful_images": successful_count,
                "failed_images": failed_count,
                "total_annotations_created": total_annotations,
                "average_confidence": avg_confidence,
                "average_processing_time": avg_processing_time
            }
            
        except Exception as e:
            # Handle job failure
            logger.error("errors.system", f"Auto-labeling job failed: {job_id}", "job_failed", {
                'job_id': job_id,
                'dataset_id': dataset_id,
                'model_id': model_id,
                'error': str(e)
            })
            
            if job_id:
                AutoLabelJobOperations.update_job_progress(
                    db, job_id, status="failed", 
                    error_message=str(e)
                )
            
            return {"error": str(e), "job_id": job_id}
        
        finally:
            db.close()
    
    async def auto_label_single_image(
        self,
        image_id: str,
        model_id: str,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        overwrite_existing: bool = False
    ) -> Dict[str, Any]:
        """Auto-label a single image"""
        db = SessionLocal()
        
        logger.info("operations.operations", f"Starting single image auto-labeling: {image_id}", "single_image_auto_label_start", {
            'image_id': image_id,
            'model_id': model_id,
            'confidence_threshold': confidence_threshold,
            'iou_threshold': iou_threshold,
            'overwrite_existing': overwrite_existing
        })
        
        try:
            # Get image
            image = ImageOperations.get_image(db, image_id)
            if not image:
                logger.error("errors.validation", f"Image not found for auto-labeling: {image_id}", "image_not_found", {
                    'image_id': image_id
                })
                return {"error": "Image not found"}
            
            # Check if already labeled
            if image.is_labeled and not overwrite_existing:
                logger.warning("errors.validation", f"Image already labeled, skipping: {image_id}", "image_already_labeled", {
                    'image_id': image_id,
                    'image_filename': image.filename
                })
                return {"error": "Image already labeled. Use overwrite_existing=True to replace."}
            
            # Load model
            model = self.load_model(model_id)
            if not model:
                logger.error("errors.system", f"Failed to load model for single image auto-labeling: {model_id}", "single_image_model_load_failed", {
                    'image_id': image_id,
                    'model_id': model_id
                })
                return {"error": f"Failed to load model {model_id}"}
            
            # Clear existing annotations if overwriting
            if overwrite_existing:
                deleted_count = AnnotationOperations.delete_annotations_by_image(db, image_id)
                logger.info("operations.annotations", f"Cleared {deleted_count} existing annotations for single image: {image.filename}", "single_image_annotations_cleared", {
                    'image_id': image_id,
                    'deleted_annotations': deleted_count
                })
            
            # Run inference
            annotations, processing_time = self.predict_image(
                image.file_path, model, confidence_threshold, iou_threshold
            )
            
            # Save annotations
            created_annotations = []
            for ann_data in annotations:
                annotation = AnnotationOperations.create_annotation(
                    db=db,
                    image_id=image_id,
                    class_name=ann_data['class_name'],
                    class_id=ann_data['class_id'],
                    x_min=ann_data['x_min'],
                    y_min=ann_data['y_min'],
                    x_max=ann_data['x_max'],
                    y_max=ann_data['y_max'],
                    confidence=ann_data['confidence'],
                    segmentation=ann_data['segmentation'],
                    is_auto_generated=True,
                    model_id=model_id
                )
                created_annotations.append({
                    "id": annotation.id,
                    "class_name": annotation.class_name,
                    "confidence": annotation.confidence,
                    "bbox": [annotation.x_min, annotation.y_min, annotation.x_max, annotation.y_max]
                })
            
            logger.info("operations.annotations", f"Created {len(created_annotations)} annotations for single image: {image.filename}", "single_image_annotations_created", {
                'image_id': image_id,
                'annotations_count': len(created_annotations),
                'processing_time': processing_time
            })
            
            # Update image status
            ImageOperations.update_image_status(
                db, image_id, 
                is_labeled=len(annotations) > 0,
                is_auto_labeled=True
            )
            logger.info("operations.images", f"Updated image status for auto-labeling: {image.filename}", "single_image_status_updated", {
                'image_id': image_id,
                'is_labeled': len(annotations) > 0,
                'is_auto_labeled': True
            })
            
            # Update dataset statistics
            DatasetOperations.update_dataset_stats(db, image.dataset_id)
            logger.info("operations.datasets", f"Updated dataset statistics for single image auto-labeling: {image.dataset_id}", "single_image_dataset_stats_updated", {
                'image_id': image_id,
                'dataset_id': image.dataset_id
            })
            
            logger.info("operations.operations", f"Single image auto-labeling completed successfully: {image.filename}", "single_image_auto_label_completed", {
                'image_id': image_id,
                'annotations_created': len(created_annotations),
                'processing_time': processing_time
            })
            
            return {
                "image_id": image_id,
                "annotations_created": len(created_annotations),
                "annotations": created_annotations,
                "processing_time": processing_time
            }
            
        except Exception as e:
            logger.error("errors.system", f"Single image auto-labeling failed: {image_id}", "single_image_auto_label_failed", {
                'image_id': image_id,
                'model_id': model_id,
                'error': str(e)
            })
            return {"error": str(e)}
        
        finally:
            db.close()


# Global auto-labeler instance
auto_labeler = AutoLabeler()