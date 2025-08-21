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
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

from ..services.image_transformer import ImageTransformer
from utils.image_utils import encode_image_to_base64, resize_image_for_preview

# Import professional logging system
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

router = APIRouter(prefix="/api/transformation", tags=["transformation"])

# Old logger replaced with professional logger
# logger = logging.getLogger(__name__)
transformer = ImageTransformer()

@router.post("/preview")
async def generate_transformation_preview(
    image: UploadFile = File(...),
    transformations: str = Form(...)
):
    """
    Generate real-time preview of image transformations
    """
    logger.info("app.backend", "Transformation preview endpoint called", "preview_endpoint_start", {
        "endpoint": "/api/transformation/preview",
        "image_filename": image.filename,
        "image_content_type": image.content_type,
        "image_size": image.size if hasattr(image, 'size') else "unknown"
    })
    
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
            logger.debug("operations.transformations", "Transformations JSON parsed successfully", "transformations_parsed", {
                "transformation_count": len(transform_config),
                "transformation_types": list(transform_config.keys())
            })
        except json.JSONDecodeError as e:
            logger.error("errors.validation", "Invalid transformations JSON format", "json_parse_error", {
                "error": str(e),
                "raw_transformations": transformations[:100] + "..." if len(transformations) > 100 else transformations
            })
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # Validate image file
        if not image.content_type.startswith('image/'):
            logger.error("errors.validation", "Invalid file type for transformation preview", "invalid_file_type", {
                "content_type": image.content_type,
                "filename": image.filename
            })
            raise HTTPException(status_code=400, detail="File must be an image")
        
        logger.debug("operations.images", "Image validation passed, processing upload", "image_validation_success", {
            "filename": image.filename,
            "content_type": image.content_type
        })
        
        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            content = await image.read()
            temp_file.write(content)
            temp_path = temp_file.name
            logger.debug("operations.images", "Temporary image file created", "temp_file_created", {
                "temp_path": temp_path,
                "content_size_bytes": len(content)
            })
        
        try:
            # Load and process image
            logger.debug("operations.images", "Loading image for transformation", "image_loading_start", {
                "temp_path": temp_path
            })
            original_image = transformer.load_image(temp_path)
            if original_image is None:
                logger.error("errors.system", "Failed to load image from temporary file", "image_load_failure", {
                    "temp_path": temp_path
                })
                raise HTTPException(status_code=400, detail="Failed to load image")
            
            logger.info("operations.images", "Image loaded successfully", "image_loaded", {
                "original_dimensions": f"{original_image.width}x{original_image.height}",
                "image_mode": original_image.mode
            })
            
            # Apply transformations
            logger.debug("operations.transformations", "Applying transformations to image", "transformations_start", {
                "transformation_count": len(transform_config),
                "transformation_types": list(transform_config.keys())
            })
            transformed_image = transformer.apply_transformations(original_image, transform_config)
            
            logger.info("operations.transformations", "Transformations applied successfully", "transformations_complete", {
                "transformation_count": len(transform_config),
                "final_dimensions": f"{transformed_image.width}x{transformed_image.height}"
            })
            
            # Convert PIL Image to numpy array for preview processing
            transformed_array = np.array(transformed_image)
            
            # Resize for preview
            preview_image = resize_image_for_preview(transformed_array, max_size=400)
            
            # Convert to base64
            preview_base64 = encode_image_to_base64(preview_image)
            
            logger.info("operations.images", "Preview generation completed successfully", "preview_generation_complete", {
                "preview_dimensions": f"{preview_image.shape[1]}x{preview_image.shape[0]}",
                "base64_length": len(preview_base64)
            })
            
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
                logger.debug("operations.images", "Temporary file cleaned up", "temp_file_cleanup", {
                    "temp_path": temp_path
                })
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", "Unexpected error in transformation preview", "preview_generation_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/preview"
        })
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.post("/batch-preview")
async def generate_batch_transformation_preview(
    image: UploadFile = File(...),
    transformations: str = Form(...)
):
    """
    Generate multiple transformation previews for comparison
    """
    logger.info("app.backend", "Batch transformation preview endpoint called", "batch_preview_endpoint_start", {
        "endpoint": "/api/transformation/batch-preview",
        "image_filename": image.filename,
        "image_content_type": image.content_type
    })
    
    try:
        # Parse transformations list
        try:
            transform_list = json.loads(transformations)
            logger.debug("operations.transformations", "Batch transformations JSON parsed successfully", "batch_transformations_parsed", {
                "transformation_sets_count": len(transform_list),
                "transformation_types": [list(t.keys()) if isinstance(t, dict) else [] for t in transform_list]
            })
        except json.JSONDecodeError as e:
            logger.error("errors.validation", "Invalid batch transformations JSON format", "batch_json_parse_error", {
                "error": str(e),
                "raw_transformations": transformations[:100] + "..." if len(transformations) > 100 else transformations
            })
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        if not isinstance(transform_list, list):
            logger.error("errors.validation", "Transformations must be a list", "invalid_transformations_format", {
                "received_type": type(transform_list).__name__,
                "expected_type": "list"
            })
            raise HTTPException(status_code=400, detail="Transformations must be a list")
        
        # Validate image file
        if not image.content_type.startswith('image/'):
            logger.error("errors.validation", "Invalid file type for batch transformation preview", "batch_invalid_file_type", {
                "content_type": image.content_type,
                "filename": image.filename
            })
            raise HTTPException(status_code=400, detail="File must be an image")
        
        logger.debug("operations.images", "Batch image validation passed, processing upload", "batch_image_validation_success", {
            "filename": image.filename,
            "content_type": image.content_type
        })
        
        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            content = await image.read()
            temp_file.write(content)
            temp_path = temp_file.name
            logger.debug("operations.images", "Temporary image file created for batch processing", "batch_temp_file_created", {
                "temp_path": temp_path,
                "content_size_bytes": len(content)
            })
        
        try:
            # Load original image
            logger.debug("operations.images", "Loading image for batch transformations", "batch_image_loading_start", {
                "temp_path": temp_path
            })
            original_image = transformer.load_image(temp_path)
            if original_image is None:
                logger.error("errors.system", "Failed to load image for batch transformations", "batch_image_load_failure", {
                    "temp_path": temp_path
                })
                raise HTTPException(status_code=400, detail="Failed to load image")
            
            logger.info("operations.images", "Image loaded successfully for batch processing", "batch_image_loaded", {
                "original_dimensions": f"{original_image.width}x{original_image.height}",
                "image_mode": original_image.mode
            })
            
            # Generate previews for each transformation set
            logger.debug("operations.transformations", "Starting batch transformation processing", "batch_transformations_start", {
                "total_transformation_sets": len(transform_list)
            })
            
            previews = []
            successful_count = 0
            failed_count = 0
            
            for i, transform_config in enumerate(transform_list):
                try:
                    logger.debug("operations.transformations", f"Processing transformation set {i+1}/{len(transform_list)}", "batch_transformation_set_start", {
                        "set_index": i,
                        "transformation_types": list(transform_config.keys()) if isinstance(transform_config, dict) else []
                    })
                    
                    transformed_image = transformer.apply_transformations(original_image, transform_config)
                    preview_image = resize_image_for_preview(transformed_image, max_size=300)
                    preview_base64 = encode_image_to_base64(preview_image)
                    
                    previews.append({
                        "index": i,
                        "preview_image": preview_base64,
                        "transformations": list(transform_config.keys()),
                        "config": transform_config
                    })
                    
                    successful_count += 1
                    logger.debug("operations.transformations", f"Transformation set {i+1} completed successfully", "batch_transformation_set_success", {
                        "set_index": i,
                        "final_dimensions": f"{transformed_image.width}x{transformed_image.height}"
                    })
                    
                except Exception as e:
                    failed_count += 1
                    logger.warning("errors.system", f"Transformation set {i+1} failed", "batch_transformation_set_failure", {
                        "set_index": i,
                        "error": str(e),
                        "error_type": type(e).__name__
                    })
                    
                    previews.append({
                        "index": i,
                        "error": str(e),
                        "transformations": list(transform_config.keys()) if isinstance(transform_config, dict) else [],
                        "config": transform_config
                    })
            
            logger.info("operations.transformations", "Batch transformation processing completed", "batch_transformations_complete", {
                "total_sets": len(transform_list),
                "successful_count": successful_count,
                "failed_count": failed_count,
                "success_rate": f"{(successful_count/len(transform_list)*100):.1f}%"
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
                logger.debug("operations.images", "Temporary file cleaned up after batch processing", "batch_temp_file_cleanup", {
                    "temp_path": temp_path
                })
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", "Unexpected error in batch transformation preview", "batch_preview_generation_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/batch-preview"
        })
        raise HTTPException(status_code=500, detail=f"Failed to generate batch preview: {str(e)}")

@router.get("/available-transformations")
async def get_available_transformations():
    """
    Get list of available transformations with their parameters
    """
    logger.info("app.backend", "Available transformations endpoint called", "available_transformations_endpoint_start", {
        "endpoint": "/api/transformation/available-transformations"
    })
    
    try:
        logger.debug("operations.transformations", "Retrieving available transformations", "transformations_retrieval_start", {})
        transformations = transformer.get_available_transformations()
        
        logger.info("operations.transformations", "Available transformations retrieved successfully", "transformations_retrieval_complete", {
            "total_transformations": len(transformations) if transformations else 0,
            "has_basic_categories": "basic" in ["resize", "rotate", "flip", "crop", "brightness", "contrast", "blur", "noise"],
            "has_advanced_categories": "advanced" in ["color_jitter", "cutout", "random_zoom", "affine_transform", "perspective_warp", "grayscale", "shear", "gamma_correction", "equalize", "clahe"]
        })
        
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
        logger.error("errors.system", "Failed to get available transformations", "transformations_retrieval_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/available-transformations"
        })
        raise HTTPException(status_code=500, detail=f"Failed to get available transformations: {str(e)}")

@router.post("/validate-config")
async def validate_transformation_config(config: Dict[str, Any]):
    """
    Validate transformation configuration
    """
    logger.info("app.backend", "Transformation config validation endpoint called", "config_validation_endpoint_start", {
        "endpoint": "/api/transformation/validate-config",
        "config_keys": list(config.keys()) if config else [],
        "config_type": type(config).__name__
    })
    
    try:
        logger.debug("operations.transformations", "Starting transformation config validation", "config_validation_start", {
            "config_size": len(config) if config else 0
        })
        
        is_valid, errors = transformer.validate_config(config)
        
        logger.info("operations.transformations", "Transformation config validation completed", "config_validation_complete", {
            "is_valid": is_valid,
            "error_count": len(errors) if errors else 0,
            "has_errors": bool(errors)
        })
        
        if errors:
            logger.warning("errors.validation", "Transformation config validation found errors", "config_validation_errors", {
                "error_count": len(errors),
                "errors": errors[:5] if len(errors) > 5 else errors  # Log first 5 errors to avoid spam
            })
        
        warnings = transformer.get_config_warnings(config)
        if warnings:
            logger.debug("errors.validation", "Transformation config validation warnings", "config_validation_warnings", {
                "warning_count": len(warnings),
                "warnings": warnings[:3] if len(warnings) > 3 else warnings  # Log first 3 warnings
            })
        
        return JSONResponse({
            "success": True,
            "data": {
                "is_valid": is_valid,
                "errors": errors,
                "warnings": warnings
            }
        })
        
    except Exception as e:
        logger.error("errors.system", "Failed to validate transformation config", "config_validation_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/validate-config"
        })
        raise HTTPException(status_code=500, detail=f"Failed to validate config: {str(e)}")

@router.get("/transformation-presets")
async def get_transformation_presets():
    """
    Get predefined transformation presets
    """
    logger.info("app.backend", "Transformation presets endpoint called", "presets_endpoint_start", {
        "endpoint": "/api/transformation/transformation-presets"
    })
    
    try:
        logger.debug("operations.transformations", "Retrieving transformation presets", "presets_retrieval_start", {})
        presets = transformer.get_transformation_presets()
        
        logger.info("operations.transformations", "Transformation presets retrieved successfully", "presets_retrieval_complete", {
            "total_presets": len(presets) if presets else 0,
            "preset_types": list(presets.keys()) if presets else []
        })
        
        return JSONResponse({
            "success": True,
            "data": {
                "presets": presets
            }
        })
        
    except Exception as e:
        logger.error("errors.system", "Failed to get transformation presets", "presets_retrieval_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/transformation-presets"
        })
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
    logger.info("app.backend", "Transformation preview with image ID endpoint called", "preview_with_id_endpoint_start", {
        "endpoint": "/api/transformation/preview-with-image-id",
        "image_id": image_id
    })
    
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
            logger.debug("operations.transformations", "Transformations JSON parsed for image ID preview", "transformations_parsed_with_id", {
                "transformation_count": len(transform_config),
                "transformation_types": list(transform_config.keys())
            })
        except json.JSONDecodeError as e:
            logger.error("errors.validation", "Invalid transformations JSON for image ID preview", "json_parse_error_with_id", {
                "error": str(e),
                "image_id": image_id,
                "raw_transformations": transformations[:100] + "..." if len(transformations) > 100 else transformations
            })
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
        
        logger.debug("app.database", "Retrieving image from database", "database_image_retrieval_start", {
            "image_id": image_id
        })
        
        image_file = None
        db = SessionLocal()
        try:
            image = ImageOperations.get_image(db, image_id)
            if image and image.file_path:
                logger.debug("app.database", "Image found in database", "database_image_found", {
                    "image_id": image_id,
                    "file_path": image.file_path
                })
                
                # Check if file exists using path manager
                if path_manager.file_exists(image.file_path):
                    image_file = image.file_path
                    logger.debug("operations.images", "Image file exists at original path", "image_path_valid", {
                        "file_path": image.file_path
                    })
                else:
                    logger.debug("operations.images", "Image file not found at original path, attempting migration", "image_path_migration_attempt", {
                        "original_path": image.file_path
                    })
                    # Try to migrate old path format
                    migrated_path = path_manager.migrate_old_path(image.file_path)
                    if migrated_path and path_manager.file_exists(migrated_path):
                        # Update database with new path
                        ImageOperations.update_image_path(db, image_id, migrated_path)
                        image_file = migrated_path
                        logger.info("operations.images", "Image path migrated successfully", "image_path_migrated", {
                            "old_path": image.file_path,
                            "new_path": migrated_path
                        })
                    else:
                        logger.warning("operations.images", "Image path migration failed", "image_path_migration_failed", {
                            "original_path": image.file_path,
                            "migrated_path": migrated_path
                        })
            else:
                logger.warning("app.database", "Image not found in database", "database_image_not_found", {
                    "image_id": image_id
                })
        finally:
            db.close()
        
        if not image_file:
            logger.error("errors.validation", "Image file not found for ID", "image_file_not_found", {
                "image_id": image_id
            })
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
        
        logger.info("operations.images", f"Attempting to load image from: {image_file_normalized}", "image_load_attempt", {
            'image_path': image_file_normalized,
            'endpoint': '/api/transformation/preview-with-image-id'
        })
        
        sample_image = cv2.imread(image_file_normalized)
        if sample_image is None:
            logger.error("errors.system", "Failed to load image file with OpenCV", "opencv_image_load_failure", {
                "image_path": image_file_normalized
            })
            raise HTTPException(status_code=400, detail=f"Failed to load image file: {image_file_normalized}")
        
        logger.info("operations.images", "Image loaded successfully with OpenCV", "opencv_image_loaded", {
            "image_path": image_file_normalized,
            "image_shape": sample_image.shape,
            "image_dtype": str(sample_image.dtype)
        })
        
        # Convert to PIL Image for transformations
        from PIL import Image
        if len(sample_image.shape) == 3:
            sample_image_rgb = cv2.cvtColor(sample_image, cv2.COLOR_BGR2RGB)
        else:
            sample_image_rgb = sample_image
        
        pil_image = Image.fromarray(sample_image_rgb)
        
        # Apply transformations using the ImageTransformer class
        logger.debug("operations.transformations", "Applying transformations to image from database", "database_image_transformations_start", {
            "transformation_count": len(transform_config),
            "transformation_types": list(transform_config.keys())
        })
        
        transformed_image = transformer.apply_transformations(pil_image, transform_config)
        
        logger.info("operations.transformations", "Transformations applied successfully to database image", "database_image_transformations_complete", {
            "transformation_count": len(transform_config),
            "original_dimensions": f"{pil_image.width}x{pil_image.height}",
            "final_dimensions": f"{transformed_image.width}x{transformed_image.height}"
        })
        
        # Resize for preview (max 400px)
        original_size = transformed_image.size
        max_size = 400
        if max(original_size) > max_size:
            ratio = max_size / max(original_size)
            new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))
            transformed_image = transformed_image.resize(new_size, Image.Resampling.LANCZOS)
            logger.debug("operations.images", "Image resized for preview", "preview_resize_complete", {
                "original_size": original_size,
                "new_size": new_size,
                "max_size": max_size
            })
        
        # Convert to base64
        from utils.image_utils import encode_image_to_base64
        
        # Convert PIL to numpy array
        preview_array = np.array(transformed_image)
        if len(preview_array.shape) == 3:
            preview_array = cv2.cvtColor(preview_array, cv2.COLOR_RGB2BGR)
        
        preview_base64 = encode_image_to_base64(preview_array)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info("operations.images", "Preview generation with image ID completed successfully", "preview_with_id_generation_complete", {
            "image_id": image_id,
            "processing_time_ms": processing_time,
            "preview_dimensions": f"{transformed_image.size[0]}x{transformed_image.size[1]}",
            "base64_length": len(preview_base64)
        })
        
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
        logger.error("errors.system", f"Transformation preview error: {str(e)}", "transformation_preview_error", {
            'error': str(e),
            'traceback': traceback.format_exc(),
            'endpoint': '/api/transformation/preview-with-image-id'
        })
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
    logger.info("app.backend", "Enhanced batch preview endpoint called", "enhanced_batch_preview_endpoint_start", {
        "endpoint": "/api/transformation/batch-preview"
    })
    
    try:
        # Parse image IDs and transformations
        try:
            image_id_list = json.loads(image_ids)
            transform_config = json.loads(transformations)
            logger.debug("operations.transformations", "Enhanced batch preview JSON parsed successfully", "enhanced_batch_json_parsed", {
                "image_ids_count": len(image_id_list),
                "transformation_count": len(transform_config),
                "transformation_types": list(transform_config.keys())
            })
        except json.JSONDecodeError as e:
            logger.error("errors.validation", "Invalid JSON format for enhanced batch preview", "enhanced_batch_json_parse_error", {
                "error": str(e),
                "image_ids_sample": image_ids[:50] + "..." if len(image_ids) > 50 else image_ids,
                "transformations_sample": transformations[:50] + "..." if len(transformations) > 50 else transformations
            })
            raise HTTPException(status_code=400, detail="Invalid JSON format")
        
        if not isinstance(image_id_list, list):
            logger.error("errors.validation", "Image IDs must be a list for enhanced batch preview", "enhanced_batch_invalid_format", {
                "received_type": type(image_id_list).__name__,
                "expected_type": "list"
            })
            raise HTTPException(status_code=400, detail="Image IDs must be a list")
        
        logger.debug("operations.images", "Starting enhanced batch preview generation", "enhanced_batch_generation_start", {
            "total_images": len(image_id_list)
        })
        
        # Generate previews for each image
        previews = []
        successful_count = 0
        failed_count = 0
        
        for i, image_id in enumerate(image_id_list):
            try:
                logger.debug("operations.images", f"Processing image {i+1}/{len(image_id_list)} for enhanced batch preview", "enhanced_batch_image_processing", {
                    "image_index": i,
                    "image_id": image_id
                })
                
                # TODO: Process actual images from database
                previews.append({
                    "index": i,
                    "image_id": image_id,
                    "preview_image": f"data:image/jpeg;base64,mock_preview_{i}",
                    "transformations": list(transform_config.keys()),
                    "processing_time_ms": len(transform_config) * 100,
                    "success": True
                })
                
                successful_count += 1
                logger.debug("operations.images", f"Image {i+1} processed successfully for enhanced batch preview", "enhanced_batch_image_success", {
                    "image_index": i,
                    "image_id": image_id
                })
                
            except Exception as e:
                failed_count += 1
                logger.warning("errors.system", f"Image {i+1} failed in enhanced batch preview", "enhanced_batch_image_failure", {
                    "image_index": i,
                    "image_id": image_id,
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                
                previews.append({
                    "index": i,
                    "image_id": image_id,
                    "error": str(e),
                    "success": False
                })
        
        logger.info("operations.images", "Enhanced batch preview generation completed", "enhanced_batch_generation_complete", {
            "total_images": len(image_id_list),
            "successful_count": successful_count,
            "failed_count": failed_count,
            "success_rate": f"{(successful_count/len(image_id_list)*100):.1f}%"
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
        logger.error("errors.system", "Unexpected error in enhanced batch preview", "enhanced_batch_preview_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/batch-preview"
        })
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
    logger.info("app.backend", "Dataset transformation endpoint called", "dataset_transformation_endpoint_start", {
        "endpoint": "/api/transformation/apply-to-dataset",
        "dataset_id": dataset_id,
        "output_count": output_count,
        "apply_to_split": apply_to_split,
        "preserve_originals": preserve_originals
    })
    
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
            logger.debug("operations.transformations", "Dataset transformation JSON parsed successfully", "dataset_transformations_parsed", {
                "transformation_count": len(transform_config),
                "transformation_types": list(transform_config.keys())
            })
        except json.JSONDecodeError as e:
            logger.error("errors.validation", "Invalid transformations JSON for dataset transformation", "dataset_json_parse_error", {
                "error": str(e),
                "dataset_id": dataset_id,
                "raw_transformations": transformations[:100] + "..." if len(transformations) > 100 else transformations
            })
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # Validate transformation configuration
        logger.debug("operations.transformations", "Validating transformation configuration for dataset", "dataset_config_validation_start", {
            "dataset_id": dataset_id
        })
        
        is_valid, errors = transformer.validate_config(transform_config)
        if not is_valid:
            logger.error("errors.validation", "Invalid transformation configuration for dataset", "dataset_config_validation_failed", {
                "dataset_id": dataset_id,
                "error_count": len(errors),
                "errors": errors[:5] if len(errors) > 5 else errors
            })
            raise HTTPException(status_code=400, detail=f"Invalid configuration: {', '.join(errors)}")
        
        logger.info("operations.transformations", "Transformation configuration validated successfully for dataset", "dataset_config_validation_success", {
            "dataset_id": dataset_id,
            "transformation_count": len(transform_config)
        })
        
        # TODO: Validate dataset exists and get image count
        # For now, return mock job response
        
        job_id = f"transform_{dataset_id}_{int(time.time())}"
        
        logger.info("operations.operations", "Dataset transformation job created successfully", "dataset_transformation_job_created", {
            "job_id": job_id,
            "dataset_id": dataset_id,
            "estimated_output_images": output_count * 100,  # Mock: 100 images in dataset
            "apply_to_split": apply_to_split,
            "preserve_originals": preserve_originals
        })
        
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
        logger.error("errors.system", "Failed to create dataset transformation job", "dataset_transformation_job_creation_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "dataset_id": dataset_id,
            "endpoint": "/api/transformation/apply-to-dataset"
        })
        raise HTTPException(status_code=500, detail=f"Failed to create transformation job: {str(e)}")

@router.get("/job-status/{job_id}")
async def get_transformation_job_status(job_id: str):
    """
    Get status of a transformation job
    Enhanced for the new UI with detailed progress information
    """
    logger.info("app.backend", "Job status endpoint called", "job_status_endpoint_start", {
        "endpoint": "/api/transformation/job-status/{job_id}",
        "job_id": job_id
    })
    
    try:
        logger.debug("operations.operations", "Retrieving transformation job status", "job_status_retrieval_start", {
            "job_id": job_id
        })
        
        # TODO: Get actual job status from database
        # For now, return mock status
        
        # Simulate different job states based on job_id
        if "error" in job_id:
            status = "failed"
            progress = 0
            error_message = "Sample error for testing"
            logger.debug("operations.operations", "Mock job status: failed", "mock_job_status_failed", {
                "job_id": job_id
            })
        elif "complete" in job_id:
            status = "completed"
            progress = 100
            error_message = None
            logger.debug("operations.operations", "Mock job status: completed", "mock_job_status_completed", {
                "job_id": job_id
            })
        else:
            status = "processing"
            progress = 45
            error_message = None
            logger.debug("operations.operations", "Mock job status: processing", "mock_job_status_processing", {
                "job_id": job_id,
                "progress": progress
            })
        
        logger.info("operations.operations", "Job status retrieved successfully", "job_status_retrieval_complete", {
            "job_id": job_id,
            "status": status,
            "progress": progress,
            "has_error": bool(error_message)
        })
        
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
        logger.error("errors.system", "Failed to get transformation job status", "job_status_retrieval_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "job_id": job_id,
            "endpoint": "/api/transformation/job-status/{job_id}"
        })
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@router.delete("/job/{job_id}")
async def cancel_transformation_job(job_id: str):
    """
    Cancel a running transformation job
    Enhanced for the new UI
    """
    logger.info("app.backend", "Job cancellation endpoint called", "job_cancellation_endpoint_start", {
        "endpoint": "/api/transformation/job/{job_id}",
        "job_id": job_id,
        "method": "DELETE"
    })
    
    try:
        logger.debug("operations.operations", "Attempting to cancel transformation job", "job_cancellation_attempt", {
            "job_id": job_id
        })
        
        # TODO: Implement actual job cancellation
        # For now, return mock response
        
        logger.info("operations.operations", "Transformation job cancelled successfully", "job_cancellation_success", {
            "job_id": job_id,
            "status": "cancelled"
        })
        
        return JSONResponse({
            "success": True,
            "data": {
                "job_id": job_id,
                "status": "cancelled",
                "message": "Transformation job cancelled successfully"
            }
        })
        
    except Exception as e:
        logger.error("errors.system", "Failed to cancel transformation job", "job_cancellation_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "job_id": job_id,
            "endpoint": "/api/transformation/job/{job_id}"
        })
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")

@router.get("/supported-formats")
async def get_supported_image_formats():
    """
    Get list of supported image formats for transformations
    """
    logger.info("app.backend", "Supported formats endpoint called", "supported_formats_endpoint_start", {
        "endpoint": "/api/transformation/supported-formats"
    })
    
    try:
        logger.debug("operations.operations", "Retrieving supported image formats", "supported_formats_retrieval_start", {})
        
        supported_formats = {
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
        
        logger.info("operations.operations", "Supported image formats retrieved successfully", "supported_formats_retrieval_complete", {
            "input_formats_count": len(supported_formats["input_formats"]),
            "output_formats_count": len(supported_formats["output_formats"]),
            "max_file_size_mb": supported_formats["max_file_size_mb"],
            "max_dimensions": supported_formats["max_dimensions"]
        })
        
        return JSONResponse({
            "success": True,
            "data": supported_formats
        })
        
    except Exception as e:
        logger.error("errors.system", "Failed to get supported image formats", "supported_formats_retrieval_error", {
            "error": str(e),
            "error_type": type(e).__name__,
            "endpoint": "/api/transformation/supported-formats"
        })
        raise HTTPException(status_code=500, detail=f"Failed to get supported formats: {str(e)}")

# Import time for timestamps
import time

