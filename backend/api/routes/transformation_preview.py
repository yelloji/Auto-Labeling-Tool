"""
Transformation Preview API Routes
Handles real-time image transformation preview generation
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import json
import tempfile
import os
import numpy as np
import logging
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

from ..services.image_transformer import ImageTransformer
from utils.image_utils import encode_image_to_base64, resize_image_for_preview

router = APIRouter(prefix="/api/transformation", tags=["transformation"])

# Initialize logger and image transformer
logger = logging.getLogger(__name__)
transformer = ImageTransformer()

@router.post("/preview")
async def generate_transformation_preview(
    image: UploadFile = File(...),
    transformations: str = Form(...)
):
    """
    Generate real-time preview of image transformations
    """
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # Validate image file
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            content = await image.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Load and process image
            original_image = transformer.load_image(temp_path)
            if original_image is None:
                raise HTTPException(status_code=400, detail="Failed to load image")
            
            # Apply transformations
            transformed_image = transformer.apply_transformations(original_image, transform_config)
            
            # Convert PIL Image to numpy array for preview processing
            transformed_array = np.array(transformed_image)
            
            # Resize for preview
            preview_image = resize_image_for_preview(transformed_array, max_size=400)
            
            # Convert to base64
            preview_base64 = encode_image_to_base64(preview_image)
            
            return JSONResponse({
                "success": True,
                "data": {
                    "preview_image": preview_base64,
                    "applied_transformations": list(transform_config.keys()),
                    "image_dimensions": {
                        "width": transformed_image.width,
                        "height": transformed_image.height
                    }
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.post("/batch-preview")
async def generate_batch_transformation_preview(
    image: UploadFile = File(...),
    transformations: str = Form(...)
):
    """
    Generate multiple transformation previews for comparison
    """
    try:
        # Parse transformations list
        try:
            transform_list = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        if not isinstance(transform_list, list):
            raise HTTPException(status_code=400, detail="Transformations must be a list")
        
        # Validate image file
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            content = await image.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Load original image
            original_image = transformer.load_image(temp_path)
            if original_image is None:
                raise HTTPException(status_code=400, detail="Failed to load image")
            
            # Generate previews for each transformation set
            previews = []
            for i, transform_config in enumerate(transform_list):
                try:
                    transformed_image = transformer.apply_transformations(original_image, transform_config)
                    preview_image = resize_image_for_preview(transformed_image, max_size=300)
                    preview_base64 = encode_image_to_base64(preview_image)
                    
                    previews.append({
                        "index": i,
                        "preview_image": preview_base64,
                        "transformations": list(transform_config.keys()),
                        "config": transform_config
                    })
                except Exception as e:
                    previews.append({
                        "index": i,
                        "error": str(e),
                        "transformations": list(transform_config.keys()) if isinstance(transform_config, dict) else [],
                        "config": transform_config
                    })
            
            return JSONResponse({
                "success": True,
                "data": {
                    "previews": previews,
                    "total_count": len(previews)
                }
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch preview: {str(e)}")

@router.get("/available-transformations")
async def get_available_transformations():
    """
    Get list of available transformations with their parameters
    """
    try:
        transformations = transformer.get_available_transformations()
        
        return JSONResponse({
            "success": True,
            "data": {
                "transformations": transformations,
                "categories": {
                    "basic": ["resize", "rotate", "flip", "crop", "brightness", "contrast", "blur", "noise"],
                    "advanced": ["color_jitter", "cutout", "random_zoom", "affine_transform", "perspective_warp", "grayscale", "shear", "gamma_correction", "equalize", "clahe"]
                }
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available transformations: {str(e)}")

@router.post("/validate-config")
async def validate_transformation_config(config: Dict[str, Any]):
    """
    Validate transformation configuration
    """
    try:
        is_valid, errors = transformer.validate_config(config)
        
        return JSONResponse({
            "success": True,
            "data": {
                "is_valid": is_valid,
                "errors": errors,
                "warnings": transformer.get_config_warnings(config)
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate config: {str(e)}")

@router.get("/transformation-presets")
async def get_transformation_presets():
    """
    Get predefined transformation presets
    """
    try:
        presets = transformer.get_transformation_presets()
        
        return JSONResponse({
            "success": True,
            "data": {
                "presets": presets
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get transformation presets: {str(e)}")

# ==================== NEW UI ENHANCEMENT ENDPOINTS ====================

@router.post("/preview-with-image-id")
async def generate_preview_with_image_id(
    image_id: str = Form(...),
    transformations: str = Form(...)
):
    """
    Generate transformation preview using image ID from database
    Enhanced for the new UI with better integration
    """
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # Get image from database using image_id
        from core.file_handler import file_handler
        import cv2
        import time
        
        start_time = time.time()
        
        # Get the actual file path using the database
        from database.database import SessionLocal
        from database.operations import ImageOperations
        from utils.path_utils import path_manager
        
        image_file = None
        db = SessionLocal()
        try:
            image = ImageOperations.get_image(db, image_id)
            if image and image.file_path:
                # Check if file exists using path manager
                if path_manager.file_exists(image.file_path):
                    image_file = image.file_path
                else:
                    # Try to migrate old path format
                    migrated_path = path_manager.migrate_old_path(image.file_path)
                    if migrated_path and path_manager.file_exists(migrated_path):
                        # Update database with new path
                        ImageOperations.update_image_path(db, image_id, migrated_path)
                        image_file = migrated_path
        finally:
            db.close()
        
        if not image_file:
            raise HTTPException(status_code=404, detail=f"Image file not found for ID {image_id}")
        
        # Load the actual image (fix path separators and make absolute path)
        # Convert Windows-style backslashes to forward slashes for Linux compatibility
        image_file_normalized = image_file.replace('\\', '/')
        
        # Make sure we have an absolute path relative to project root
        if not os.path.isabs(image_file_normalized):
            # All paths in database are relative to project root
            # Get project root dynamically (cross-platform compatible)
            import sys
            current_dir = os.getcwd()
            if 'backend' in current_dir:
                project_root = os.path.dirname(current_dir)  # Go up one level from backend to project root
            else:
                project_root = current_dir
            
            # Join with forward slashes for Linux
            image_file_normalized = os.path.join(project_root, image_file_normalized).replace('\\', '/')
        
        logger.info(f"Attempting to load image from: {image_file_normalized}")
        sample_image = cv2.imread(image_file_normalized)
        if sample_image is None:
            raise HTTPException(status_code=400, detail=f"Failed to load image file: {image_file_normalized}")
        
        # Convert to PIL Image for transformations
        from PIL import Image
        if len(sample_image.shape) == 3:
            sample_image_rgb = cv2.cvtColor(sample_image, cv2.COLOR_BGR2RGB)
        else:
            sample_image_rgb = sample_image
        
        pil_image = Image.fromarray(sample_image_rgb)
        
        # Apply transformations using the ImageTransformer class
        transformed_image = transformer.apply_transformations(pil_image, transform_config)
        
        # Resize for preview (max 400px)
        original_size = transformed_image.size
        max_size = 400
        if max(original_size) > max_size:
            ratio = max_size / max(original_size)
            new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))
            transformed_image = transformed_image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Convert to base64
        from utils.image_utils import encode_image_to_base64
        
        # Convert PIL to numpy array
        preview_array = np.array(transformed_image)
        if len(preview_array.shape) == 3:
            preview_array = cv2.cvtColor(preview_array, cv2.COLOR_RGB2BGR)
        
        preview_base64 = encode_image_to_base64(preview_array)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return JSONResponse({
            "success": True,
            "data": {
                "preview_image": preview_base64,
                "original_image_id": image_id,
                "applied_transformations": list(transform_config.keys()),
                "transformation_count": len(transform_config),
                "processing_time_ms": processing_time,
                "image_dimensions": {
                    "width": original_size[0],
                    "height": original_size[1]
                },
                "preview_dimensions": {
                    "width": transformed_image.size[0],
                    "height": transformed_image.size[1]
                }
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Transformation preview error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.post("/batch-preview")
async def generate_batch_preview_enhanced(
    image_ids: str = Form(...),
    transformations: str = Form(...)
):
    """
    Generate multiple transformation previews for comparison
    Enhanced version for the new UI
    """
    try:
        # Parse image IDs and transformations
        try:
            image_id_list = json.loads(image_ids)
            transform_config = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format")
        
        if not isinstance(image_id_list, list):
            raise HTTPException(status_code=400, detail="Image IDs must be a list")
        
        # Generate previews for each image
        previews = []
        for i, image_id in enumerate(image_id_list):
            try:
                # TODO: Process actual images from database
                previews.append({
                    "index": i,
                    "image_id": image_id,
                    "preview_image": f"data:image/jpeg;base64,mock_preview_{i}",
                    "transformations": list(transform_config.keys()),
                    "processing_time_ms": len(transform_config) * 100,
                    "success": True
                })
            except Exception as e:
                previews.append({
                    "index": i,
                    "image_id": image_id,
                    "error": str(e),
                    "success": False
                })
        
        return JSONResponse({
            "success": True,
            "data": {
                "previews": previews,
                "total_count": len(previews),
                "successful_count": len([p for p in previews if p.get("success", False)]),
                "failed_count": len([p for p in previews if not p.get("success", False)])
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch preview: {str(e)}")

@router.post("/apply-to-dataset")
async def apply_transformations_to_dataset_images(
    dataset_id: str = Form(...),
    transformations: str = Form(...),
    output_count: int = Form(5),
    apply_to_split: str = Form("train"),
    preserve_originals: bool = Form(True)
):
    """
    Apply transformations to all images in a dataset
    Enhanced for the new UI with better job management
    """
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # Validate transformation configuration
        is_valid, errors = transformer.validate_config(transform_config)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid configuration: {', '.join(errors)}")
        
        # TODO: Validate dataset exists and get image count
        # For now, return mock job response
        
        job_id = f"transform_{dataset_id}_{int(time.time())}"
        
        return JSONResponse({
            "success": True,
            "data": {
                "job_id": job_id,
                "status": "queued",
                "dataset_id": dataset_id,
                "transformation_config": transform_config,
                "estimated_output_images": output_count * 100,  # Mock: 100 images in dataset
                "apply_to_split": apply_to_split,
                "preserve_originals": preserve_originals,
                "estimated_completion_time": "5-10 minutes",
                "created_at": time.time(),
                "message": "Transformation job created successfully"
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create transformation job: {str(e)}")

@router.get("/job-status/{job_id}")
async def get_transformation_job_status(job_id: str):
    """
    Get status of a transformation job
    Enhanced for the new UI with detailed progress information
    """
    try:
        # TODO: Get actual job status from database
        # For now, return mock status
        
        # Simulate different job states based on job_id
        if "error" in job_id:
            status = "failed"
            progress = 0
            error_message = "Sample error for testing"
        elif "complete" in job_id:
            status = "completed"
            progress = 100
            error_message = None
        else:
            status = "processing"
            progress = 45
            error_message = None
        
        return JSONResponse({
            "success": True,
            "data": {
                "job_id": job_id,
                "status": status,
                "progress": progress,
                "total_images": 100,
                "processed_images": int(progress),
                "successful_transformations": int(progress * 0.95),
                "failed_transformations": int(progress * 0.05),
                "estimated_completion_time": "3-5 minutes" if status == "processing" else None,
                "error_message": error_message,
                "started_at": time.time() - 300,  # 5 minutes ago
                "completed_at": time.time() if status == "completed" else None,
                "output_images_created": int(progress * 5) if status != "failed" else 0
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@router.delete("/job/{job_id}")
async def cancel_transformation_job(job_id: str):
    """
    Cancel a running transformation job
    Enhanced for the new UI
    """
    try:
        # TODO: Implement actual job cancellation
        # For now, return mock response
        
        return JSONResponse({
            "success": True,
            "data": {
                "job_id": job_id,
                "status": "cancelled",
                "message": "Transformation job cancelled successfully"
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")

@router.get("/supported-formats")
async def get_supported_image_formats():
    """
    Get list of supported image formats for transformations
    """
    try:
        return JSONResponse({
            "success": True,
            "data": {
                "input_formats": [
                    {"extension": "jpg", "mime_type": "image/jpeg", "description": "JPEG Image"},
                    {"extension": "jpeg", "mime_type": "image/jpeg", "description": "JPEG Image"},
                    {"extension": "png", "mime_type": "image/png", "description": "PNG Image"},
                    {"extension": "bmp", "mime_type": "image/bmp", "description": "Bitmap Image"},
                    {"extension": "tiff", "mime_type": "image/tiff", "description": "TIFF Image"},
                    {"extension": "webp", "mime_type": "image/webp", "description": "WebP Image"}
                ],
                "output_formats": [
                    {"extension": "jpg", "mime_type": "image/jpeg", "description": "JPEG Image", "quality_adjustable": True},
                    {"extension": "png", "mime_type": "image/png", "description": "PNG Image", "quality_adjustable": False}
                ],
                "max_file_size_mb": 50,
                "max_dimensions": {"width": 4096, "height": 4096},
                "recommended_dimensions": {"width": 640, "height": 640}
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get supported formats: {str(e)}")

# Import time for timestamps
import time

