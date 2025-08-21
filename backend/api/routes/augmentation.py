"""
Data Augmentation API endpoints
"""
# Import time for job ID generation
import time
from fastapi import Form
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json

from database.database import get_db
from database import operations as crud
from database.models import Dataset
from utils.augmentation_utils import AdvancedDataAugmentation
from core.config import settings
from core.transformation_config import (
    get_shear_parameters, get_rotation_parameters,
    get_brightness_parameters, get_contrast_parameters,
    get_blur_parameters, get_hue_parameters,
    get_saturation_parameters, get_gamma_parameters,
    get_resize_parameters, get_noise_parameters,
    get_clahe_clip_limit_parameters, get_clahe_grid_size_parameters,
    get_cutout_num_holes_parameters, get_cutout_hole_size_parameters,
    get_crop_parameters, get_color_jitter_parameters,
    get_random_zoom_parameters, get_affine_transform_parameters,
    get_perspective_warp_parameters
)
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

router = APIRouter(prefix="/api/augmentation", tags=["augmentation"])


class AugmentationConfigRequest(BaseModel):
    dataset_id: str
    name: str
    description: Optional[str] = ""
    augmentation_config: Dict[str, Any]
    images_per_original: int = 5
    apply_to_split: str = "train"
    preserve_annotations: bool = True


class AugmentationPresetRequest(BaseModel):
    preset_name: str  # light, medium, heavy, geometric_only, color_only, noise_blur


@router.get("/presets")
async def get_augmentation_presets():
    """Get available augmentation presets"""
    logger.info("app.backend", "Getting augmentation presets", "augmentation_presets_retrieval", {
        "endpoint": "/api/augmentation/presets"
    })
    
    try:
        augmenter = AdvancedDataAugmentation()
        presets = augmenter.get_preset_configs()
        
        logger.info("operations.transformations", "Augmentation presets retrieved successfully", "presets_retrieved", {
            "preset_count": len(presets)
        })
        
        return {
            "presets": {
                name: {
                    "name": name.replace("_", " ").title(),
                    "description": get_preset_description(name),
                    "config": config
                }
                for name, config in presets.items()
            }
        }
    except Exception as e:
        logger.error("errors.system", f"Error retrieving augmentation presets: {str(e)}", "presets_retrieval_error", {
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error retrieving augmentation presets: {str(e)}")


@router.get("/default-config")
async def get_default_augmentation_config():
    """Get default augmentation configuration"""
    logger.info("app.backend", "Getting default augmentation configuration", "default_config_retrieval", {
        "endpoint": "/api/augmentation/default-config"
    })
    
    try:
        augmenter = AdvancedDataAugmentation()
        config = augmenter.get_default_config()
        
        logger.info("operations.transformations", "Default augmentation configuration retrieved successfully", "default_config_retrieved", {
            "config_keys": list(config.keys()) if config else []
        })
        
        return {
            "config": config,
            "categories": {
                "geometric": [
                    "rotation", "flip", "shear", "perspective", "elastic_transform",
                    "crop", "zoom"
                ],
                "color": [
                    "brightness", "contrast", "saturation", "hue", "gamma",
                    "channel_shuffle", "color_jitter"
                ],
                "noise_blur": [
                    "gaussian_blur", "motion_blur", "median_blur", "gaussian_noise",
                    "iso_noise", "multiplicative_noise"
                ],
                "weather": [
                    "rain", "snow", "fog", "sun_flare", "shadow"
                ],
                "cutout": [
                    "cutout", "grid_dropout", "channel_dropout"
                ],
                "distortion": [
                    "optical_distortion", "grid_distortion", "piecewise_affine"
                ],
                "quality": [
                    "jpeg_compression", "downscale"
                ]
            }
        }
    except Exception as e:
        logger.error("errors.system", f"Error retrieving default augmentation configuration: {str(e)}", "default_config_retrieval_error", {
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error retrieving default augmentation configuration: {str(e)}")


@router.post("/create")
async def create_augmentation_job(
    request: AugmentationConfigRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """LEGACY: Create a new data augmentation job - Use ImageTransformation API instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint is deprecated. Use /api/image-transformations/ instead"
    )


@router.get("/jobs/{dataset_id}")
async def get_augmentation_jobs(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """LEGACY: Get all augmentation jobs for a dataset - Use ImageTransformation API instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint is deprecated. Use /api/image-transformations/ instead"
    )


@router.get("/job/{job_id}/status")
async def get_augmentation_job_status(
    job_id: str,
    db: Session = Depends(get_db)
):
    """LEGACY: Get status of a specific augmentation job - Use ImageTransformation API instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint is deprecated. Use /api/image-transformations/ instead"
    )


@router.delete("/job/{job_id}")
async def delete_augmentation_job(
    job_id: str,
    db: Session = Depends(get_db)
):
    """LEGACY: Delete an augmentation job - Use ImageTransformation API instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint is deprecated. Use /api/image-transformations/ instead"
    )


@router.post("/preview")
async def preview_augmentation(
    request: AugmentationConfigRequest,
    db: Session = Depends(get_db)
):
    """Preview augmentation effects on sample images"""
    logger.info("app.backend", "Previewing augmentation effects", "augmentation_preview_request", {
        "endpoint": "/api/augmentation/preview",
        "dataset_id": request.dataset_id,
        "images_per_original": request.images_per_original,
        "apply_to_split": request.apply_to_split
    })
    
    try:
        # Get a few sample images from the dataset
        logger.debug("app.database", f"Fetching sample images from dataset {request.dataset_id}", "database_query", {
            "dataset_id": request.dataset_id,
            "limit": 3
        })
        
        images = crud.get_images_by_dataset(db, request.dataset_id, limit=3)
        if not images:
            logger.warning("errors.validation", f"No images found in dataset {request.dataset_id}", "no_images_found", {
                "dataset_id": request.dataset_id
            })
            raise HTTPException(status_code=404, detail="No images found in dataset")
        
        # Create augmentation pipeline
        logger.debug("operations.transformations", "Creating augmentation pipeline", "pipeline_creation", {
            "config_keys": list(request.augmentation_config.keys())
        })
        
        augmenter = AdvancedDataAugmentation()
        pipeline = augmenter.create_augmentation_pipeline(request.augmentation_config)
        
        # Generate preview (this would need actual image processing)
        # For now, return configuration summary
        enabled_augmentations = [
            name for name, config in request.augmentation_config.items()
            if isinstance(config, dict) and config.get("enabled", False)
        ]
        
        logger.info("operations.transformations", "Augmentation preview generated successfully", "preview_generated", {
            "sample_images_count": len(images),
            "enabled_augmentations_count": len(enabled_augmentations),
            "estimated_output_images": len(images) * request.images_per_original
        })
        
        return {
            "sample_images": [
                {
                    "image_id": img.id,
                    "filename": img.filename,
                    "file_path": img.file_path
                }
                for img in images
            ],
            "enabled_augmentations": enabled_augmentations,
            "estimated_output_images": len(images) * request.images_per_original,
            "config_summary": get_config_summary(request.augmentation_config)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Error generating augmentation preview: {str(e)}", "preview_generation_error", {
            "dataset_id": request.dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error generating preview: {str(e)}")


async def run_augmentation_job(job_id: str, config: Dict[str, Any]):
    """Background task to run augmentation job"""
    logger.info("operations.transformations", f"Starting augmentation job {job_id}", "augmentation_job_started", {
        "job_id": job_id,
        "config_keys": list(config.keys()) if config else []
    })
    
    try:
        # This would be implemented to actually process images
        # For now, it's a placeholder
        logger.debug("operations.transformations", f"Augmentation job {job_id} processing", "job_processing", {
            "job_id": job_id
        })
        
        # Placeholder for actual processing
        pass
        
        logger.info("operations.transformations", f"Augmentation job {job_id} completed", "augmentation_job_completed", {
            "job_id": job_id
        })
        
    except Exception as e:
        logger.error("errors.system", f"Error in augmentation job {job_id}: {str(e)}", "augmentation_job_error", {
            "job_id": job_id,
            "error": str(e)
        })
        raise


def get_preset_description(preset_name: str) -> str:
    """Get description for augmentation preset"""
    descriptions = {
        "light": "Minimal augmentations for subtle variations. Good for high-quality datasets.",
        "medium": "Balanced augmentations for most use cases. Recommended starting point.",
        "heavy": "Aggressive augmentations for maximum data diversity. Use with small datasets.",
        "geometric_only": "Only geometric transformations (rotation, flip, crop, etc.).",
        "color_only": "Only color/brightness adjustments. Preserves object shapes.",
        "noise_blur": "Noise and blur effects to simulate real-world conditions."
    }
    return descriptions.get(preset_name, "Custom augmentation preset")


def get_config_summary(config: Dict[str, Any]) -> Dict[str, Any]:
    """Generate summary of augmentation configuration"""
    enabled_count = 0
    categories = {
        "geometric": 0,
        "color": 0,
        "noise_blur": 0,
        "weather": 0,
        "advanced": 0
    }
    
    geometric_augs = ["rotation", "flip", "shear", "perspective", "crop", "zoom"]
    color_augs = ["brightness", "contrast", "saturation", "hue", "gamma"]
    noise_blur_augs = ["gaussian_blur", "motion_blur", "gaussian_noise"]
    weather_augs = ["rain", "snow", "fog", "sun_flare", "shadow"]
    
    for name, aug_config in config.items():
        if isinstance(aug_config, dict) and aug_config.get("enabled", False):
            enabled_count += 1
            
            if name in geometric_augs:
                categories["geometric"] += 1
            elif name in color_augs:
                categories["color"] += 1
            elif name in noise_blur_augs:
                categories["noise_blur"] += 1
            elif name in weather_augs:
                categories["weather"] += 1
            else:
                categories["advanced"] += 1
    
    return {
        "total_enabled": enabled_count,
        "categories": categories,
        "intensity": "light" if enabled_count < 5 else "medium" if enabled_count < 10 else "heavy"
    }

# Import transformation preview functionality
from .transformation_preview import router as transformation_router

# Add transformation preview routes to this router
router.include_router(transformation_router, prefix="", tags=["transformation"])

@router.post("/transformation-config")
async def save_transformation_config(
    config_request: AugmentationConfigRequest,
    db: Session = Depends(get_db)
):
    """
    Save transformation configuration to database
    Enhanced version that supports new transformation types
    """
    logger.info("app.backend", "Saving transformation configuration", "transformation_config_save", {
        "endpoint": "/api/augmentation/transformation-config",
        "dataset_id": config_request.dataset_id,
        "name": config_request.name,
        "images_per_original": config_request.images_per_original
    })
    
    try:
        # Validate dataset exists
        logger.debug("app.database", f"Validating dataset {config_request.dataset_id} exists", "database_query", {
            "dataset_id": config_request.dataset_id
        })
        
        dataset = crud.get_dataset(db, config_request.dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {config_request.dataset_id} not found", "dataset_not_found", {
                "dataset_id": config_request.dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Create augmentation record with new transformation config
        augmentation_data = {
            "dataset_id": config_request.dataset_id,
            "name": config_request.name,
            "description": config_request.description,
            "config": config_request.augmentation_config,
            "images_per_original": config_request.images_per_original,
            "apply_to_split": config_request.apply_to_split,
            "preserve_annotations": config_request.preserve_annotations,
            "status": "pending"
        }
        
        logger.info("operations.transformations", "Transformation configuration validation successful", "config_validated", {
            "dataset_id": config_request.dataset_id,
            "config_name": config_request.name
        })
        
        # This function is deprecated - use ImageTransformation API instead
        logger.warning("app.backend", "Deprecated endpoint called - redirecting to ImageTransformation API", "deprecated_endpoint", {
            "endpoint": "/api/augmentation/transformation-config",
            "redirect_to": "/api/image-transformations/"
        })
        
        raise HTTPException(status_code=410, detail="Use /api/image-transformations/ instead")
        
        return {
            "success": True,
            "augmentation_id": augmentation.id,
            "message": "Transformation configuration saved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to save transformation configuration: {str(e)}", "config_save_error", {
            "dataset_id": config_request.dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {str(e)}")

@router.get("/transformation-config/{augmentation_id}")
async def get_transformation_config(
    augmentation_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve saved transformation configuration
    """
    logger.info("app.backend", f"Retrieving transformation configuration {augmentation_id}", "transformation_config_retrieval", {
        "endpoint": f"/api/augmentation/transformation-config/{augmentation_id}",
        "augmentation_id": augmentation_id
    })
    
    try:
        logger.warning("app.backend", "Deprecated endpoint called - redirecting to ImageTransformation API", "deprecated_endpoint", {
            "endpoint": f"/api/augmentation/transformation-config/{augmentation_id}",
            "redirect_to": "/api/image-transformations/"
        })
        
        # This function is deprecated - use ImageTransformation API instead
        raise HTTPException(status_code=410, detail="Use /api/image-transformations/ instead")
        
        augmentation = crud.get_augmentation_config_by_id(db, augmentation_id)
        
        if not augmentation:
            logger.warning("errors.validation", f"Augmentation configuration {augmentation_id} not found", "config_not_found", {
                "augmentation_id": augmentation_id
            })
            raise HTTPException(status_code=404, detail="Augmentation configuration not found")
        
        logger.info("operations.transformations", f"Transformation configuration {augmentation_id} retrieved successfully", "config_retrieved", {
            "augmentation_id": augmentation_id
        })
        
        return {
            "success": True,
            "config": {
                "id": augmentation.id,
                "name": augmentation.name,
                "description": augmentation.description,
                "transformations": augmentation.config,
                "images_per_original": augmentation.images_per_original,
                "apply_to_split": augmentation.apply_to_split,
                "preserve_annotations": augmentation.preserve_annotations,
                "status": augmentation.status,
                "created_at": augmentation.created_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve transformation configuration {augmentation_id}: {str(e)}", "config_retrieval_error", {
            "augmentation_id": augmentation_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to retrieve configuration: {str(e)}")



# ==================== NEW TRANSFORMATION SECTION ENDPOINTS ====================

@router.get("/available-transformations")
async def get_available_transformations():
    """
    Get available transformations with their parameters for the new UI
    Enhanced version for the redesigned transformation section
    """
    logger.info("app.backend", "Getting available transformations", "available_transformations_retrieval", {
        "endpoint": "/api/augmentation/available-transformations"
    })
    
    try:
        logger.debug("operations.transformations", "Creating AdvancedDataAugmentation instance", "augmenter_creation")
        
        augmenter = AdvancedDataAugmentation()
        default_config = augmenter.get_default_config()
        
        logger.debug("operations.transformations", "Retrieved default augmentation configuration", "default_config_retrieved", {
            "config_keys": list(default_config.keys()) if default_config else []
        })
        
        # Organize transformations by category for the new UI
        transformations = {
            "basic": {
                "resize": {
                    "name": "Resize",
                    "description": "Resize images to different dimensions",
                    "icon": "expand-arrows-alt",
                    "parameters": {
                        "width": {
                            "type": "number", 
                            "min": get_resize_parameters()['width_min'], 
                            "max": get_resize_parameters()['width_max'], 
                            "default": get_resize_parameters()['width_default']
                        },
                        "height": {
                            "type": "number", 
                            "min": get_resize_parameters()['height_min'], 
                            "max": get_resize_parameters()['height_max'], 
                            "default": get_resize_parameters()['height_default']
                        },
                        "maintain_aspect": {"type": "boolean", "default": True}
                    }
                },
                "rotation": {
                    "name": "Rotation",
                    "description": "Rotate images by specified angles",
                    "icon": "redo",
                    "parameters": {
                        "angle_min": {
                            "type": "number", 
                            "min": get_rotation_parameters()['min'], 
                            "max": get_rotation_parameters()['max'], 
                            "default": get_rotation_parameters()['min'] / 12
                        },
                        "angle_max": {
                            "type": "number", 
                            "min": get_rotation_parameters()['min'], 
                            "max": get_rotation_parameters()['max'], 
                            "default": get_rotation_parameters()['max'] / 12
                        },
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.5, "step": 0.1}
                    }
                },
                "flip": {
                    "name": "Flip",
                    "description": "Flip images horizontally or vertically",
                    "icon": "arrows-alt-h",
                    "parameters": {
                        "horizontal": {"type": "boolean", "default": True},
                        "vertical": {"type": "boolean", "default": False},
                        "h_probability": {"type": "number", "min": 0, "max": 1, "default": 0.5, "step": 0.1},
                        "v_probability": {"type": "number", "min": 0, "max": 1, "default": 0.2, "step": 0.1}
                    }
                },
                "crop": {
                    "name": "Random Crop",
                    "description": "Randomly crop portions of images",
                    "icon": "crop",
                    "parameters": {
                        "scale_min": {"type": "number", "min": 0.1, "max": 1, "default": 0.8, "step": 0.1},
                        "scale_max": {"type": "number", "min": 0.1, "max": 1, "default": 1.0, "step": 0.1},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.5, "step": 0.1}
                    }
                },
                "brightness": {
                    "name": "Brightness",
                    "description": "Adjust image brightness",
                    "icon": "sun",
                    "parameters": {
                        "min_factor": {
                            "type": "number", 
                            "min": get_brightness_parameters()['min'], 
                            "max": get_brightness_parameters()['max'], 
                            "default": get_brightness_parameters()['min'] / 2 + 0.5
                        },
                        "max_factor": {
                            "type": "number", 
                            "min": get_brightness_parameters()['min'], 
                            "max": get_brightness_parameters()['max'], 
                            "default": get_brightness_parameters()['max'] / 2 + 0.5
                        },
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.5, "step": 0.1}
                    }
                },
                "contrast": {
                    "name": "Contrast",
                    "description": "Adjust image contrast",
                    "icon": "adjust",
                    "parameters": {
                        "min_factor": {
                            "type": "number", 
                            "min": get_contrast_parameters()['min'], 
                            "max": get_contrast_parameters()['max'], 
                            "default": get_contrast_parameters()['min'] / 2 + 0.5
                        },
                        "max_factor": {
                            "type": "number", 
                            "min": get_contrast_parameters()['min'], 
                            "max": get_contrast_parameters()['max'], 
                            "default": get_contrast_parameters()['max'] / 2 + 0.5
                        },
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.5, "step": 0.1}
                    }
                },
                "blur": {
                    "name": "Gaussian Blur",
                    "description": "Apply gaussian blur to images",
                    "icon": "circle",
                    "parameters": {
                        "kernel_min": {
                            "type": "number", 
                            "min": get_blur_parameters()['min'], 
                            "max": get_blur_parameters()['max'], 
                            "default": get_blur_parameters()['min'] + 2,
                            "step": 2
                        },
                        "kernel_max": {
                            "type": "number", 
                            "min": get_blur_parameters()['min'], 
                            "max": get_blur_parameters()['max'], 
                            "default": get_blur_parameters()['max'] / 2,
                            "step": 2
                        },
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "noise": {
                    "name": "Gaussian Noise",
                    "description": "Add gaussian noise to images",
                    "icon": "random",
                    "parameters": {
                        "std_min": {"type": "number", "min": 0, "max": 0.1, "default": 0.01, "step": 0.01},
                        "std_max": {"type": "number", "min": 0, "max": 0.1, "default": 0.05, "step": 0.01},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                }
            },
            "advanced": {
                "color_jitter": {
                    "name": "Color Jitter",
                    "description": "Randomly change brightness, contrast, saturation and hue",
                    "icon": "palette",
                    "parameters": {
                        "brightness": {
                            "type": "number", 
                            "min": 0, 
                            "max": get_brightness_parameters()['max'] / 2, 
                            "default": get_brightness_parameters()['max'] / 5, 
                            "step": 0.1
                        },
                        "contrast": {
                            "type": "number", 
                            "min": 0, 
                            "max": get_contrast_parameters()['max'] / 2, 
                            "default": get_contrast_parameters()['max'] / 5, 
                            "step": 0.1
                        },
                        "saturation": {
                            "type": "number", 
                            "min": 0, 
                            "max": get_saturation_parameters()['max'] / 2, 
                            "default": get_saturation_parameters()['max'] / 5, 
                            "step": 0.1
                        },
                        "hue": {
                            "type": "number", 
                            "min": 0, 
                            "max": get_hue_parameters()['max'] / 2, 
                            "default": get_hue_parameters()['max'] / 4, 
                            "step": 0.05
                        },
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "cutout": {
                    "name": "Cutout",
                    "description": "Randomly mask out square regions",
                    "icon": "square",
                    "parameters": {
                        "num_holes_min": {"type": "number", "min": 1, "max": 10, "default": 1},
                        "num_holes_max": {"type": "number", "min": 1, "max": 10, "default": 3},
                        "hole_size_min": {"type": "number", "min": 0.05, "max": 0.5, "default": 0.1, "step": 0.05},
                        "hole_size_max": {"type": "number", "min": 0.05, "max": 0.5, "default": 0.3, "step": 0.05},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "random_zoom": {
                    "name": "Random Zoom",
                    "description": "Randomly zoom in or out",
                    "icon": "search-plus",
                    "parameters": {
                        "zoom_min": {"type": "number", "min": 0.5, "max": 1.5, "default": 0.9, "step": 0.1},
                        "zoom_max": {"type": "number", "min": 0.5, "max": 1.5, "default": 1.1, "step": 0.1},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "affine_transform": {
                    "name": "Affine Transform",
                    "description": "Apply affine transformations",
                    "icon": "vector-square",
                    "parameters": {
                        "scale_min": {"type": "number", "min": 0.8, "max": 1.2, "default": 0.9, "step": 0.1},
                        "scale_max": {"type": "number", "min": 0.8, "max": 1.2, "default": 1.1, "step": 0.1},
                        "shear_min": {"type": "number", "min": -10, "max": 10, "default": -5},
                        "shear_max": {"type": "number", "min": -10, "max": 10, "default": 5},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "perspective_warp": {
                    "name": "Perspective Warp",
                    "description": "Apply perspective transformation",
                    "icon": "cube",
                    "parameters": {
                        "distortion": {"type": "number", "min": 0.05, "max": 0.3, "default": 0.1, "step": 0.05},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "grayscale": {
                    "name": "Grayscale",
                    "description": "Convert to grayscale",
                    "icon": "circle-notch",
                    "parameters": {
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.1, "step": 0.1}
                    }
                },
                "shear": {
                    "name": "Shear",
                    "description": "Apply shear transformation",
                    "icon": "italic",
                    "parameters": {
                        "shear_min": {
                            "type": "number", 
                            "min": get_shear_parameters()['min'], 
                            "max": get_shear_parameters()['max'], 
                            "default": get_shear_parameters()['min'] / 3
                        },
                        "shear_max": {
                            "type": "number", 
                            "min": get_shear_parameters()['min'], 
                            "max": get_shear_parameters()['max'], 
                            "default": get_shear_parameters()['max'] / 3
                        },
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "gamma_correction": {
                    "name": "Gamma Correction",
                    "description": "Apply gamma correction",
                    "icon": "chart-line",
                    "parameters": {
                        "gamma_min": {"type": "number", "min": 0.5, "max": 2, "default": 0.8, "step": 0.1},
                        "gamma_max": {"type": "number", "min": 0.5, "max": 2, "default": 1.2, "step": 0.1},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
                    }
                },
                "equalize": {
                    "name": "Histogram Equalization",
                    "description": "Apply histogram equalization",
                    "icon": "chart-bar",
                    "parameters": {
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.2, "step": 0.1}
                    }
                },
                "clahe": {
                    "name": "CLAHE",
                    "description": "Contrast Limited Adaptive Histogram Equalization",
                    "icon": "chart-area",
                    "parameters": {
                        "clip_limit": {"type": "number", "min": 1, "max": 10, "default": 4, "step": 1},
                        "tile_grid_size": {"type": "number", "min": 4, "max": 16, "default": 8, "step": 2},
                        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.2, "step": 0.1}
                    }
                }
            }
        }
        
        logger.info("operations.transformations", "Available transformations retrieved successfully", "transformations_retrieved", {
            "total_count": len(transformations["basic"]) + len(transformations["advanced"])
        })
        
        return {
            "success": True,
            "data": {
                "transformations": transformations,
                "total_count": len(transformations["basic"]) + len(transformations["advanced"])
            }
        }
        
    except Exception as e:
        logger.error("errors.system", f"Failed to get available transformations: {str(e)}", "transformations_retrieval_error", {
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get available transformations: {str(e)}")

@router.post("/generate-preview")
async def generate_transformation_preview_new(
    image_id: str = Form(...),
    transformations: str = Form(...)
):
    """
    Generate transformation preview for the new UI
    Enhanced version with better error handling and response format
    """
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # This would integrate with the image_transformer service
        # For now, return a mock response that matches the expected format
        return {
            "success": True,
            "data": {
                "preview_url": f"/api/images/{image_id}/preview",
                "applied_transformations": list(transform_config.keys()),
                "transformation_count": len(transform_config),
                "estimated_processing_time": len(transform_config) * 0.5  # seconds
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.get("/transformation-presets")
async def get_transformation_presets_new():
    """
    Get predefined transformation presets for the new UI
    """
    try:
        presets = {
            "light_augmentation": {
                "name": "Light Augmentation",
                "description": "Minimal transformations for high-quality datasets",
                "icon": "feather",
                "transformations": {
                    "rotation": {"enabled": True, "angle_min": -10, "angle_max": 10, "probability": 0.3},
                    "flip": {"horizontal": True, "vertical": False, "h_probability": 0.5, "v_probability": 0},
                    "brightness": {"enabled": True, "min_factor": 0.9, "max_factor": 1.1, "probability": 0.3},
                    "contrast": {"enabled": True, "min_factor": 0.9, "max_factor": 1.1, "probability": 0.3}
                }
            },
            "medium_augmentation": {
                "name": "Medium Augmentation",
                "description": "Balanced transformations for most use cases",
                "icon": "balance-scale",
                "transformations": {
                    "rotation": {
                        "enabled": True, 
                        "angle_min": get_rotation_parameters()['min'] / 12, 
                        "angle_max": get_rotation_parameters()['max'] / 12, 
                        "probability": 0.5
                    },
                    "flip": {"horizontal": True, "vertical": False, "h_probability": 0.5, "v_probability": 0.2},
                    "brightness": {
                        "enabled": True, 
                        "min_factor": get_brightness_parameters()['min'] / 2 + 0.5, 
                        "max_factor": get_brightness_parameters()['max'] / 2 + 0.5, 
                        "probability": 0.5
                    },
                    "contrast": {
                        "enabled": True, 
                        "min_factor": get_contrast_parameters()['min'] / 2 + 0.5, 
                        "max_factor": get_contrast_parameters()['max'] / 2 + 0.5, 
                        "probability": 0.5
                    },
                    "blur": {
                        "enabled": True, 
                        "kernel_min": get_blur_parameters()['min'] + 2, 
                        "kernel_max": get_blur_parameters()['max'] / 2, 
                        "probability": 0.3
                    },
                    "noise": {"enabled": True, "std_min": 0.01, "std_max": 0.03, "probability": 0.3},
                    "crop": {"enabled": True, "scale_min": 0.8, "scale_max": 1.0, "probability": 0.4}
                }
            },
            "heavy_augmentation": {
                "name": "Heavy Augmentation",
                "description": "Aggressive transformations for maximum diversity",
                "icon": "weight-hanging",
                "transformations": {
                    "rotation": {"enabled": True, "angle_min": -30, "angle_max": 30, "probability": 0.7},
                    "flip": {"horizontal": True, "vertical": True, "h_probability": 0.5, "v_probability": 0.3},
                    "brightness": {"enabled": True, "min_factor": 0.6, "max_factor": 1.4, "probability": 0.7},
                    "contrast": {"enabled": True, "min_factor": 0.6, "max_factor": 1.4, "probability": 0.7},
                    "blur": {"enabled": True, "kernel_min": 3, "kernel_max": 11, "probability": 0.5},
                    "noise": {"enabled": True, "std_min": 0.01, "std_max": 0.05, "probability": 0.5},
                    "crop": {"enabled": True, "scale_min": 0.7, "scale_max": 1.0, "probability": 0.6},
                    "color_jitter": {"enabled": True, "brightness": 0.3, "contrast": 0.3, "saturation": 0.3, "hue": 0.1, "probability": 0.5},
                    "cutout": {"enabled": True, "num_holes_min": 1, "num_holes_max": 3, "hole_size_min": 0.1, "hole_size_max": 0.2, "probability": 0.4}
                }
            },
            "geometric_only": {
                "name": "Geometric Only",
                "description": "Only geometric transformations, preserves colors",
                "icon": "shapes",
                "transformations": {
                    "rotation": {"enabled": True, "angle_min": -20, "angle_max": 20, "probability": 0.6},
                    "flip": {"horizontal": True, "vertical": False, "h_probability": 0.5, "v_probability": 0},
                    "crop": {"enabled": True, "scale_min": 0.8, "scale_max": 1.0, "probability": 0.5},
                    "random_zoom": {"enabled": True, "zoom_min": 0.9, "zoom_max": 1.1, "probability": 0.4},
                    "shear": {"enabled": True, "shear_min": -5, "shear_max": 5, "probability": 0.3},
                    "perspective_warp": {"enabled": True, "distortion": 0.1, "probability": 0.3}
                }
            },
            "color_only": {
                "name": "Color Only",
                "description": "Only color adjustments, preserves shapes",
                "icon": "palette",
                "transformations": {
                    "brightness": {"enabled": True, "min_factor": 0.7, "max_factor": 1.3, "probability": 0.6},
                    "contrast": {"enabled": True, "min_factor": 0.7, "max_factor": 1.3, "probability": 0.6},
                    "color_jitter": {"enabled": True, "brightness": 0.2, "contrast": 0.2, "saturation": 0.3, "hue": 0.1, "probability": 0.5},
                    "gamma_correction": {"enabled": True, "gamma_min": 0.8, "gamma_max": 1.2, "probability": 0.4},
                    "equalize": {"enabled": True, "probability": 0.2},
                    "clahe": {"enabled": True, "clip_limit": 4, "tile_grid_size": 8, "probability": 0.3}
                }
            }
        }
        
        return {
            "success": True,
            "data": {
                "presets": presets,
                "total_count": len(presets)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get transformation presets: {str(e)}")

@router.post("/validate-transformation-config")
async def validate_transformation_config_new(config: Dict[str, Any]):
    """
    Validate transformation configuration for the new UI
    """
    try:
        errors = []
        warnings = []
        
        # Basic validation
        if not isinstance(config, dict):
            errors.append("Configuration must be a dictionary")
            return {"success": False, "errors": errors, "warnings": warnings}
        
        # Check for conflicting transformations
        if config.get("grayscale", {}).get("enabled") and config.get("color_jitter", {}).get("enabled"):
            warnings.append("Grayscale and color jitter are both enabled - color jitter will have no effect")
        
        # Check probability values
        for transform_name, transform_config in config.items():
            if isinstance(transform_config, dict) and "probability" in transform_config:
                prob = transform_config["probability"]
                if not 0 <= prob <= 1:
                    errors.append(f"{transform_name}: probability must be between 0 and 1")
        
        # Check parameter ranges
        if "rotation" in config:
            rot_config = config["rotation"]
            if "angle_min" in rot_config and "angle_max" in rot_config:
                if rot_config["angle_min"] > rot_config["angle_max"]:
                    errors.append("Rotation: minimum angle cannot be greater than maximum angle")
        
        is_valid = len(errors) == 0
        
        return {
            "success": True,
            "data": {
                "is_valid": is_valid,
                "errors": errors,
                "warnings": warnings,
                "transformation_count": len([k for k, v in config.items() if isinstance(v, dict) and v.get("enabled", False)])
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate configuration: {str(e)}")

@router.post("/apply-transformations")
async def apply_transformations_to_dataset(
    dataset_id: str = Form(...),
    transformations: str = Form(...),
    output_count: int = Form(5),
    apply_to_split: str = Form("train")
):
    """
    Apply transformations to a dataset for the new UI
    """
    try:
        # Parse transformations JSON
        try:
            transform_config = json.loads(transformations)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid transformations JSON")
        
        # Validate dataset exists (this would use actual database operations)
        # For now, return a mock response
        
        # Create a background job for applying transformations
        job_id = f"transform_{dataset_id}_{int(time.time())}"
        
        return {
            "success": True,
            "data": {
                "job_id": job_id,
                "status": "started",
                "dataset_id": dataset_id,
                "estimated_images": output_count,
                "apply_to_split": apply_to_split,
                "message": "Transformation job started successfully"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply transformations: {str(e)}")




