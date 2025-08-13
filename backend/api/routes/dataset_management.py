"""
Dataset Management API endpoints for splitting, filtering, and image management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import random

from database.database import get_db
from database import operations as crud
from database.models import Dataset, Image, DatasetSplit
from utils.augmentation_utils import DatasetSplitter
from core.config import settings
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

router = APIRouter(prefix="/api/dataset-management", tags=["dataset-management"])


class SplitConfigRequest(BaseModel):
    dataset_id: str
    train_percentage: float = 70.0
    val_percentage: float = 20.0
    test_percentage: float = 10.0
    split_method: str = "random"  # random, stratified, manual
    stratify_by_class: bool = True
    random_seed: int = 42


class ImageSplitAssignment(BaseModel):
    image_id: str
    split_type: str  # train, val, test, unassigned


class BulkImageAssignment(BaseModel):
    image_ids: List[str]
    split_type: str


class ImageFilterRequest(BaseModel):
    dataset_id: str
    split_type: Optional[str] = None
    is_labeled: Optional[bool] = None
    is_verified: Optional[bool] = None
    class_names: Optional[List[str]] = None
    filename_pattern: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = 0


@router.post("/split")
async def create_dataset_split(
    request: SplitConfigRequest,
    db: Session = Depends(get_db)
):
    """Create or update dataset split configuration"""
    logger.info("app.backend", f"Creating dataset split configuration", "dataset_split_creation", {
        "dataset_id": request.dataset_id,
        "train_percentage": request.train_percentage,
        "val_percentage": request.val_percentage,
        "test_percentage": request.test_percentage,
        "split_method": request.split_method,
        "stratify_by_class": request.stratify_by_class,
        "endpoint": "/api/dataset-management/split"
    })
    
    try:
        # Validate dataset exists
        logger.debug("app.database", f"Validating dataset {request.dataset_id} exists", "database_query")
        dataset = crud.get_dataset(db, request.dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {request.dataset_id} not found", "dataset_not_found", {
                "dataset_id": request.dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Validate percentages sum to 100
        total_percentage = request.train_percentage + request.val_percentage + request.test_percentage
        if abs(total_percentage - 100.0) > 0.1:
            logger.warning("errors.validation", f"Invalid split percentages", "invalid_percentages", {
                "dataset_id": request.dataset_id,
                "total_percentage": total_percentage
            })
            raise HTTPException(status_code=400, detail="Split percentages must sum to 100%")
        
        # Get all images and annotations
        logger.debug("app.database", f"Fetching images and annotations for dataset {request.dataset_id}", "database_query")
        images = crud.get_images_by_dataset(db, request.dataset_id)
        annotations = crud.get_annotations_by_dataset(db, request.dataset_id)
        
        if not images:
            logger.warning("errors.validation", f"No images found in dataset {request.dataset_id}", "no_images_found", {
                "dataset_id": request.dataset_id
            })
            raise HTTPException(status_code=400, detail="No images found in dataset")
        
        # Convert to format expected by splitter
        image_dicts = [{"id": img.id} for img in images]
        annotation_dicts = [
            {
                "image_id": ann.image_id,
                "class_name": ann.class_name
            }
            for ann in annotations
        ]
        
        # Perform split
        logger.info("operations.operations", f"Performing dataset split operation", "split_operation", {
            "dataset_id": request.dataset_id,
            "image_count": len(image_dicts),
            "annotation_count": len(annotation_dicts),
            "split_method": request.split_method
        })
        splitter = DatasetSplitter()
        split_assignments = splitter.split_dataset(
            image_dicts,
            annotation_dicts,
            train_ratio=request.train_percentage / 100.0,
            val_ratio=request.val_percentage / 100.0,
            test_ratio=request.test_percentage / 100.0,
            stratify=request.stratify_by_class and request.split_method == "stratified",
            random_seed=request.random_seed
        )
        
        # Update image split assignments in database
        logger.info("app.database", f"Updating image split assignments in database", "split_assignments_update", {
            "dataset_id": request.dataset_id,
            "split_assignments": {split: len(img_ids) for split, img_ids in split_assignments.items()}
        })
        for split_type, image_ids in split_assignments.items():
            for image_id in image_ids:
                crud.update_image_split(db, image_id, split_type)
        
        # Create or update dataset split record
        logger.debug("app.database", f"Creating/updating dataset split record", "split_record_operation")
        existing_split = crud.get_dataset_split_by_dataset(db, request.dataset_id)
        split_data = {
            "dataset_id": request.dataset_id,
            "train_percentage": request.train_percentage,
            "val_percentage": request.val_percentage,
            "test_percentage": request.test_percentage,
            "split_method": request.split_method,
            "random_seed": request.random_seed,
            "stratify_by_class": request.stratify_by_class,
            "train_count": len(split_assignments["train"]),
            "val_count": len(split_assignments["val"]),
            "test_count": len(split_assignments["test"]),
            "unassigned_count": len(split_assignments.get("unassigned", []))
        }
        
        if existing_split:
            crud.update_dataset_split(db, existing_split.id, split_data)
            logger.info("operations.operations", f"Updated existing dataset split record", "split_record_updated", {
                "dataset_id": request.dataset_id,
                "split_id": existing_split.id
            })
        else:
            crud.create_dataset_split(db, split_data)
            logger.info("operations.operations", f"Created new dataset split record", "split_record_created", {
                "dataset_id": request.dataset_id
            })
        
        logger.info("operations.operations", f"Dataset split created successfully", "split_creation_success", {
            "dataset_id": request.dataset_id,
            "split_assignments": {split: len(img_ids) for split, img_ids in split_assignments.items()},
            "total_images": len(images)
        })
        
        return {
            "message": "Dataset split created successfully",
            "split_assignments": {
                split: len(img_ids) for split, img_ids in split_assignments.items()
            },
            "total_images": len(images)
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error creating dataset split", "split_creation_error", {
            "dataset_id": request.dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error creating dataset split: {str(e)}")


@router.get("/split/{dataset_id}")
async def get_dataset_split(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get current dataset split configuration and statistics"""
    logger.info("app.backend", f"Getting dataset split configuration", "dataset_split_retrieval", {
        "dataset_id": dataset_id,
        "endpoint": "/api/dataset-management/split/{dataset_id}"
    })
    
    try:
        # Get dataset
        logger.debug("app.database", f"Fetching dataset {dataset_id}", "database_query")
        dataset = crud.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get split configuration
        logger.debug("app.database", f"Fetching split configuration for dataset {dataset_id}", "database_query")
        split_config = crud.get_dataset_split_by_dataset(db, dataset_id)
        
        # Get current image counts by split
        logger.debug("app.database", f"Fetching images for dataset {dataset_id}", "database_query")
        images = crud.get_images_by_dataset(db, dataset_id)
        split_counts = {
            "train": len([img for img in images if img.split_type == "train"]),
            "val": len([img for img in images if img.split_type == "val"]),
            "test": len([img for img in images if img.split_type == "test"]),
            "unassigned": len([img for img in images if img.split_type == "unassigned"])
        }
        
        # Calculate actual percentages
        total_images = sum(split_counts.values())
        actual_percentages = {
            split: (count / total_images * 100) if total_images > 0 else 0
            for split, count in split_counts.items()
        }
        
        result = {
            "dataset_id": dataset_id,
            "total_images": total_images,
            "split_counts": split_counts,
            "actual_percentages": actual_percentages
        }
        
        if split_config:
            result.update({
                "configured_percentages": {
                    "train": split_config.train_percentage,
                    "val": split_config.val_percentage,
                    "test": split_config.test_percentage
                },
                "split_method": split_config.split_method,
                "stratify_by_class": split_config.stratify_by_class,
                "random_seed": split_config.random_seed,
                "last_split_at": split_config.last_split_at.isoformat() if split_config.last_split_at else None
            })
        
        logger.info("operations.operations", f"Dataset split configuration retrieved successfully", "split_retrieval_success", {
            "dataset_id": dataset_id,
            "total_images": total_images,
            "split_counts": split_counts
        })
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error getting dataset split", "split_retrieval_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error getting dataset split: {str(e)}")


@router.post("/assign-images")
async def assign_images_to_split(
    request: BulkImageAssignment,
    db: Session = Depends(get_db)
):
    """Assign multiple images to a specific split"""
    logger.info("app.backend", f"Assigning images to split", "bulk_image_assignment", {
        "image_count": len(request.image_ids),
        "split_type": request.split_type,
        "endpoint": "/api/dataset-management/assign-images"
    })
    
    try:
        # Validate split type
        valid_splits = ["train", "val", "test", "unassigned"]
        if request.split_type not in valid_splits:
            logger.warning("errors.validation", f"Invalid split type {request.split_type}", "invalid_split_type", {
                "split_type": request.split_type,
                "valid_splits": valid_splits
            })
            raise HTTPException(status_code=400, detail=f"Invalid split type. Must be one of: {valid_splits}")
        
        # Update images
        logger.info("operations.operations", f"Updating image split assignments", "image_split_update", {
            "image_count": len(request.image_ids),
            "split_type": request.split_type
        })
        updated_count = 0
        for image_id in request.image_ids:
            success = crud.update_image_split(db, image_id, request.split_type)
            if success:
                updated_count += 1
        
        logger.info("operations.operations", f"Image split assignments completed successfully", "image_assignment_success", {
            "updated_count": updated_count,
            "total_requested": len(request.image_ids),
            "split_type": request.split_type
        })
        
        return {
            "message": f"Successfully assigned {updated_count} images to {request.split_type} split",
            "updated_count": updated_count,
            "total_requested": len(request.image_ids)
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error assigning images to split", "image_assignment_error", {
            "image_count": len(request.image_ids),
            "split_type": request.split_type,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error assigning images: {str(e)}")


@router.post("/filter-images")
async def filter_images(
    request: ImageFilterRequest,
    db: Session = Depends(get_db)
):
    """Filter images based on various criteria"""
    logger.info("app.backend", f"Filtering images", "image_filtering", {
        "dataset_id": request.dataset_id,
        "split_type": request.split_type,
        "is_labeled": request.is_labeled,
        "is_verified": request.is_verified,
        "class_names": request.class_names,
        "filename_pattern": request.filename_pattern,
        "limit": request.limit,
        "endpoint": "/api/dataset-management/filter-images"
    })
    
    try:
        # Get base query for dataset images
        logger.debug("app.database", f"Fetching images for dataset {request.dataset_id}", "database_query")
        images = crud.get_images_by_dataset(db, request.dataset_id)
        
        # Apply filters
        filtered_images = images
        
        # Filter by split type
        if request.split_type:
            filtered_images = [img for img in filtered_images if img.split_type == request.split_type]
        
        # Filter by labeled status
        if request.is_labeled is not None:
            filtered_images = [img for img in filtered_images if img.is_labeled == request.is_labeled]
        
        # Filter by verified status
        if request.is_verified is not None:
            filtered_images = [img for img in filtered_images if img.is_verified == request.is_verified]
        
        # Filter by filename pattern
        if request.filename_pattern:
            pattern = request.filename_pattern.lower()
            filtered_images = [
                img for img in filtered_images 
                if pattern in img.filename.lower() or pattern in img.original_filename.lower()
            ]
        
        # Filter by class names (images that have annotations with these classes)
        if request.class_names:
            # Get annotations for these images
            image_ids = [img.id for img in filtered_images]
            annotations = crud.get_annotations_by_images(db, image_ids)
            
            # Find images with the specified classes
            images_with_classes = set()
            for ann in annotations:
                if ann.class_name in request.class_names:
                    images_with_classes.add(ann.image_id)
            
            filtered_images = [img for img in filtered_images if img.id in images_with_classes]
        
        # Apply pagination
        total_count = len(filtered_images)
        if request.offset:
            filtered_images = filtered_images[request.offset:]
        if request.limit:
            filtered_images = filtered_images[:request.limit]
        
        logger.info("operations.operations", f"Image filtering completed", "image_filtering_complete", {
            "dataset_id": request.dataset_id,
            "total_count": total_count,
            "filtered_count": len(filtered_images),
            "offset": request.offset,
            "limit": request.limit
        })
        
        # Get annotation counts for each image
        image_data = []
        for img in filtered_images:
            annotations = crud.get_annotations_by_image(db, img.id)
            annotation_count = len(annotations)
            class_names = list(set(ann.class_name for ann in annotations))
            
            image_data.append({
                "id": img.id,
                "filename": img.filename,
                "original_filename": img.original_filename,
                "file_path": img.file_path,
                "file_size": img.file_size,
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "split_type": img.split_type,
                "is_labeled": img.is_labeled,
                "is_auto_labeled": img.is_auto_labeled,
                "is_verified": img.is_verified,
                "annotation_count": annotation_count,
                "class_names": class_names,
                "created_at": img.created_at.isoformat(),
                "updated_at": img.updated_at.isoformat()
            })
        
        return {
            "images": image_data,
            "total_count": total_count,
            "filtered_count": len(image_data),
            "offset": request.offset,
            "limit": request.limit
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error filtering images", "image_filtering_error", {
            "dataset_id": request.dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error filtering images: {str(e)}")


@router.post("/move-images")
async def move_images_to_reserved(
    image_ids: List[str],
    target_location: str = "reserved",
    db: Session = Depends(get_db)
):
    """Move images to a reserved space or different location"""
    logger.info("app.backend", f"Moving images to reserved location", "image_movement", {
        "image_count": len(image_ids),
        "target_location": target_location,
        "endpoint": "/api/dataset-management/move-images"
    })
    
    try:
        # For now, we'll implement this as changing the split_type to a special "reserved" type
        # In a full implementation, this could involve actual file system operations
        
        logger.info("operations.operations", f"Updating image split types for movement", "image_split_update", {
            "image_count": len(image_ids),
            "target_location": target_location
        })
        updated_count = 0
        for image_id in image_ids:
            # Update the image's split type to indicate it's in reserved space
            success = crud.update_image_split(db, image_id, target_location)
            if success:
                updated_count += 1
        
        logger.info("operations.operations", f"Image movement completed successfully", "image_movement_success", {
            "moved_count": updated_count,
            "total_requested": len(image_ids),
            "target_location": target_location
        })
        
        return {
            "message": f"Successfully moved {updated_count} images to {target_location}",
            "moved_count": updated_count,
            "total_requested": len(image_ids),
            "target_location": target_location
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error moving images", "image_movement_error", {
            "image_count": len(image_ids),
            "target_location": target_location,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error moving images: {str(e)}")


@router.get("/image-details/{image_id}")
async def get_image_details(
    image_id: str,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific image"""
    logger.info("app.backend", f"Getting image details", "image_details_retrieval", {
        "image_id": image_id,
        "endpoint": "/api/dataset-management/image-details/{image_id}"
    })
    
    try:
        # Get image
        logger.debug("app.database", f"Fetching image {image_id}", "database_query")
        image = crud.get_image(db, image_id)
        if not image:
            logger.warning("errors.validation", f"Image {image_id} not found", "image_not_found", {
                "image_id": image_id
            })
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Get annotations
        logger.debug("app.database", f"Fetching annotations for image {image_id}", "database_query")
        annotations = crud.get_annotations_by_image(db, image_id)
        
        # Format annotations
        annotation_data = [
            {
                "id": ann.id,
                "class_name": ann.class_name,
                "class_id": ann.class_id,
                "confidence": ann.confidence,
                "bbox": {
                    "x_min": ann.x_min,
                    "y_min": ann.y_min,
                    "x_max": ann.x_max,
                    "y_max": ann.y_max
                },
                "segmentation": ann.segmentation,
                "is_auto_generated": ann.is_auto_generated,
                "is_verified": ann.is_verified,
                "model_id": ann.model_id,
                "created_at": ann.created_at.isoformat(),
                "updated_at": ann.updated_at.isoformat()
            }
            for ann in annotations
        ]
        
        logger.info("operations.operations", f"Image details retrieved successfully", "image_details_success", {
            "image_id": image_id,
            "annotation_count": len(annotation_data),
            "class_names": list(set(ann.class_name for ann in annotations))
        })
        
        return {
            "image": {
                "id": image.id,
                "filename": image.filename,
                "original_filename": image.original_filename,
                "file_path": image.file_path,
                "file_size": image.file_size,
                "width": image.width,
                "height": image.height,
                "format": image.format,
                "dataset_id": image.dataset_id,
                "split_type": image.split_type,
                "is_labeled": image.is_labeled,
                "is_auto_labeled": image.is_auto_labeled,
                "is_verified": image.is_verified,
                "created_at": image.created_at.isoformat(),
                "updated_at": image.updated_at.isoformat()
            },
            "annotations": annotation_data,
            "annotation_count": len(annotation_data),
            "class_names": list(set(ann.class_name for ann in annotations))
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error getting image details", "image_details_error", {
            "image_id": image_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error getting image details: {str(e)}")


@router.get("/dataset-summary/{dataset_id}")
async def get_dataset_summary(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive dataset summary with all statistics"""
    logger.info("app.backend", f"Getting dataset summary", "dataset_summary_retrieval", {
        "dataset_id": dataset_id,
        "endpoint": "/api/dataset-management/dataset-summary/{dataset_id}"
    })
    
    try:
        # Get dataset
        logger.debug("app.database", f"Fetching dataset {dataset_id}", "database_query")
        dataset = crud.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get all images and annotations
        logger.debug("app.database", f"Fetching images and annotations for dataset {dataset_id}", "database_query")
        images = crud.get_images_by_dataset(db, dataset_id)
        annotations = crud.get_annotations_by_dataset(db, dataset_id)
        
        # Calculate statistics
        total_images = len(images)
        labeled_images = len([img for img in images if img.is_labeled])
        verified_images = len([img for img in images if img.is_verified])
        auto_labeled_images = len([img for img in images if img.is_auto_labeled])
        
        # Split statistics
        split_stats = {}
        for split_type in ["train", "val", "test", "unassigned", "reserved"]:
            split_images = [img for img in images if img.split_type == split_type]
            split_labeled = len([img for img in split_images if img.is_labeled])
            split_stats[split_type] = {
                "total": len(split_images),
                "labeled": split_labeled,
                "unlabeled": len(split_images) - split_labeled,
                "percentage": (len(split_images) / total_images * 100) if total_images > 0 else 0
            }
        
        # Class statistics
        class_counts = {}
        for ann in annotations:
            class_counts[ann.class_name] = class_counts.get(ann.class_name, 0) + 1
        
        # File format statistics
        format_counts = {}
        for img in images:
            format_counts[img.format] = format_counts.get(img.format, 0) + 1
        
        # Size statistics
        total_size = sum(img.file_size for img in images if img.file_size)
        avg_size = total_size / total_images if total_images > 0 else 0
        
        logger.info("operations.operations", f"Dataset summary retrieved successfully", "dataset_summary_success", {
            "dataset_id": dataset_id,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "total_annotations": len(annotations),
            "labeling_progress": (labeled_images / total_images * 100) if total_images > 0 else 0
        })
        
        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "unlabeled_images": total_images - labeled_images,
            "verified_images": verified_images,
            "auto_labeled_images": auto_labeled_images,
            "total_annotations": len(annotations),
            "labeling_progress": (labeled_images / total_images * 100) if total_images > 0 else 0,
            "split_statistics": split_stats,
            "class_distribution": class_counts,
            "format_distribution": format_counts,
            "total_size_bytes": total_size,
            "average_size_bytes": avg_size,
            "created_at": dataset.created_at.isoformat(),
            "updated_at": dataset.updated_at.isoformat()
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error getting dataset summary", "dataset_summary_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error getting dataset summary: {str(e)}")