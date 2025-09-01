"""
API routes for dataset management with full database integration
Handle image datasets, uploads, and auto-labeling
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from database.database import get_db
from database.operations import (
    DatasetOperations, ProjectOperations, ImageOperations, 
    AutoLabelJobOperations
)
from database.models import Annotation
from core.file_handler import file_handler
from core.auto_labeler import auto_labeler
from models.model_manager import model_manager
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

router = APIRouter()

# Create a separate router for image operations
images_router = APIRouter()

# Add a new endpoint for deleting images
@images_router.delete("/images/{image_id}", tags=["images"])
async def delete_image(image_id: str, db: Session = Depends(get_db)):
    """Delete an image by ID"""
    logger.info("app.backend", f"Deleting image", "image_deletion", {
        "image_id": image_id,
        "endpoint": f"/api/v1/images/{image_id}"
    })
    
    try:
        # Use the existing, working delete_image method from ImageOperations
        success = ImageOperations.delete_image(db, image_id)
        if not success:
            logger.warning("errors.validation", f"Image {image_id} not found or failed to delete", "image_deletion_failed", {
                "image_id": image_id
            })
            raise HTTPException(status_code=404, detail="Image not found or failed to delete")
        
        logger.info("operations.images", f"Image deleted successfully", "image_deleted", {
            "image_id": image_id
        })
        return {"status": "success", "message": f"Image {image_id} deleted successfully"}
    
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise http_ex
    except Exception as e:
        # Log the error
        logger.error("errors.system", f"Error deleting image: {str(e)}", "delete_image_error", {
            "image_id": image_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error deleting image: {str(e)}")



class DatasetCreateRequest(BaseModel):
    """Request model for creating a new dataset"""
    name: str
    description: str = ""
    project_id: str
    auto_label_enabled: bool = True
    model_id: Optional[str] = None


class DatasetUpdateRequest(BaseModel):
    """Request model for updating a dataset"""
    name: Optional[str] = None
    description: Optional[str] = None
    auto_label_enabled: Optional[bool] = None
    model_id: Optional[str] = None


class AutoLabelRequest(BaseModel):
    """Request model for auto-labeling"""
    model_id: str
    confidence_threshold: float = 0.5
    iou_threshold: float = 0.45
    overwrite_existing: bool = False


@router.get("/", response_model=List[Dict[str, Any]])
async def get_datasets(
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all datasets, optionally filtered by project"""
    logger.info("app.backend", f"Getting datasets", "datasets_retrieval", {
        "project_id": project_id,
        "skip": skip,
        "limit": limit,
        "endpoint": "/api/datasets/"
    })
    
    try:
        if project_id:
            logger.debug("app.database", f"Verifying project {project_id} exists", "database_query")
            # Verify project exists
            project = ProjectOperations.get_project(db, project_id)
            if not project:
                logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                    "project_id": project_id
                })
                raise HTTPException(status_code=404, detail="Project not found")
            
            logger.info("operations.datasets", f"Getting datasets for project {project_id}", "project_datasets_retrieval", {
                "project_id": project_id
            })
            datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        else:
            logger.info("operations.datasets", f"Getting all datasets", "all_datasets_retrieval", {
                "skip": skip,
                "limit": limit
            })
            # Get all datasets
            datasets = DatasetOperations.get_all_datasets(db, skip=skip, limit=limit)
        
        dataset_responses = []
        for dataset in datasets:
            dataset_response = {
                "id": dataset.id,
                "name": dataset.name,
                "description": dataset.description,
                "project_id": dataset.project_id,
                "total_images": dataset.total_images,
                "labeled_images": dataset.labeled_images,
                "unlabeled_images": dataset.unlabeled_images,
                "auto_label_enabled": dataset.auto_label_enabled,
                "model_id": dataset.model_id,
                "created_at": dataset.created_at,
                "updated_at": dataset.updated_at
            }
            dataset_responses.append(dataset_response)
        
        logger.info("operations.datasets", f"Successfully retrieved {len(dataset_responses)} datasets", "datasets_retrieved", {
            "dataset_count": len(dataset_responses),
            "project_id": project_id
        })
        
        return dataset_responses
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error retrieving datasets", "datasets_retrieval_error", {
            "project_id": project_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get datasets: {str(e)}")


@router.post("/", response_model=Dict[str, Any])
async def create_dataset(
    request: DatasetCreateRequest,
    db: Session = Depends(get_db)
):
    """Create a new dataset"""
    logger.info("app.backend", f"Creating new dataset", "dataset_creation", {
        "dataset_name": request.name,
        "project_id": request.project_id,
        "auto_label_enabled": request.auto_label_enabled,
        "model_id": request.model_id,
        "endpoint": "/api/datasets/"
    })
    
    try:
        # Verify project exists
        logger.debug("app.database", f"Verifying project {request.project_id} exists", "database_query")
        project = ProjectOperations.get_project(db, request.project_id)
        if not project:
            logger.warning("errors.validation", f"Project {request.project_id} not found", "project_not_found", {
                "project_id": request.project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate model_id if provided
        if request.model_id:
            logger.debug("operations.operations", f"Validating model ID {request.model_id}", "model_validation")
            model_info = model_manager.get_model_info(request.model_id)
            if not model_info:
                logger.warning("errors.validation", f"Invalid model ID {request.model_id}", "invalid_model_id", {
                    "model_id": request.model_id
                })
                raise HTTPException(status_code=400, detail="Invalid model ID")
        
        # Create dataset
        logger.info("operations.datasets", f"Creating dataset in database", "dataset_creation_operation", {
            "dataset_name": request.name,
            "project_id": request.project_id
        })
        dataset = DatasetOperations.create_dataset(
            db=db,
            name=request.name,
            project_id=request.project_id,
            description=request.description,
            auto_label_enabled=request.auto_label_enabled,
            model_id=request.model_id
        )
        
        logger.info("operations.datasets", f"Dataset created successfully", "dataset_created", {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "project_id": dataset.project_id
        })
        
        return {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "project_id": dataset.project_id,
            "total_images": dataset.total_images,
            "labeled_images": dataset.labeled_images,
            "unlabeled_images": dataset.unlabeled_images,
            "auto_label_enabled": dataset.auto_label_enabled,
            "model_id": dataset.model_id,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error creating dataset", "dataset_creation_error", {
            "dataset_name": request.name,
            "project_id": request.project_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to create dataset: {str(e)}")


@router.post("/upload", response_model=Dict[str, Any])
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(""),
    project_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    auto_label: bool = Form(True),
    db: Session = Depends(get_db)
):
    """Create a new dataset and upload files to it"""
    logger.info("app.backend", f"Uploading dataset with files", "dataset_upload", {
        "dataset_name": name,
        "project_id": project_id,
        "file_count": len(files),
        "auto_label": auto_label,
        "endpoint": "/api/datasets/upload"
    })
    
    try:
        # If no project_id provided, create a new project with next number
        if not project_id:
            logger.info("operations.operations", f"Creating new auto-project for dataset upload", "auto_project_creation", {
                "dataset_name": name
            })
            # Get existing projects to determine next project number
            existing_projects = ProjectOperations.get_projects(db)
            
            # Find the highest project number
            max_project_num = 0
            for project in existing_projects:
                if project.name.startswith("Project "):
                    try:
                        num = int(project.name.split("Project ")[1])
                        max_project_num = max(max_project_num, num)
                    except (ValueError, IndexError):
                        continue
            
            # Create new project with next number
            next_project_num = max_project_num + 1
            new_project = ProjectOperations.create_project(
                db=db,
                name=f"Project {next_project_num}",
                description=f"Auto-created project {next_project_num}"
            )
            project_id = new_project.id
            project_name = new_project.name
            logger.info("operations.operations", f"Auto-project created successfully", "auto_project_created", {
                "project_id": project_id,
                "project_name": project_name
            })
        else:
            # Verify project exists
            logger.debug("app.database", f"Verifying project {project_id} exists", "database_query")
            project = ProjectOperations.get_project(db, project_id)
            if not project:
                logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                    "project_id": project_id
                })
                raise HTTPException(status_code=404, detail="Project not found")
            project_name = project.name
        
        # Create dataset
        logger.info("operations.datasets", f"Creating dataset for file upload", "dataset_creation_for_upload", {
            "dataset_name": name,
            "project_id": project_id,
            "file_count": len(files)
        })
        dataset = DatasetOperations.create_dataset(
            db=db,
            name=name,
            project_id=project_id,
            description=description,
            auto_label_enabled=auto_label,
            model_id=None  # Will be set during auto-labeling if enabled
        )
        
        # Upload files to the dataset
        logger.info("operations.operations", f"Starting file upload to dataset", "file_upload_start", {
            "dataset_id": dataset.id,
            "file_count": len(files),
            "auto_label": auto_label
        })
        upload_results = await file_handler.upload_images_to_dataset(
            files, dataset.id, auto_label=auto_label, project_name=project_name, dataset_name=dataset.name
        )
        
        logger.info("operations.datasets", f"Dataset upload completed successfully", "dataset_upload_success", {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "file_count": len(files),
            "upload_results": upload_results
        })
        
        return {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "project_id": dataset.project_id,
            "total_images": len(files),
            "upload_results": upload_results,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error uploading dataset", "dataset_upload_error", {
            "dataset_name": name,
            "project_id": project_id,
            "file_count": len(files),
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to upload dataset: {str(e)}")


@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Get a specific dataset with detailed information"""
    logger.info("app.backend", f"Getting dataset details", "dataset_details_retrieval", {
        "dataset_id": dataset_id,
        "endpoint": "/api/datasets/{dataset_id}"
    })
    
    try:
        logger.debug("app.database", f"Fetching dataset {dataset_id}", "database_query")
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get recent images
        logger.debug("app.database", f"Fetching recent images for dataset {dataset_id}", "database_query")
        recent_images = ImageOperations.get_images_by_dataset(
            db, dataset_id, skip=0, limit=10
        )
        
        image_list = []
        for image in recent_images:
            image_data = {
                "id": image.id,
                "filename": image.filename,
                "original_filename": image.original_filename,
                "width": image.width,
                "height": image.height,
                "file_size": image.file_size,
                "is_labeled": image.is_labeled,
                "is_auto_labeled": image.is_auto_labeled,
                "is_verified": image.is_verified,
                "created_at": image.created_at
            }
            image_list.append(image_data)
        
        logger.info("operations.datasets", f"Dataset details retrieved successfully", "dataset_details_retrieved", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "image_count": len(image_list)
        })
        
        return {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "project_id": dataset.project_id,
            "total_images": dataset.total_images,
            "labeled_images": dataset.labeled_images,
            "unlabeled_images": dataset.unlabeled_images,
            "auto_label_enabled": dataset.auto_label_enabled,
            "model_id": dataset.model_id,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at,
            "recent_images": image_list
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error retrieving dataset details", "dataset_details_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get dataset: {str(e)}")


@router.post("/{dataset_id}/upload")
async def upload_images(
    dataset_id: str,
    files: List[UploadFile] = File(...),
    auto_label: bool = Form(True),
    db: Session = Depends(get_db)
):
    """Upload images to a dataset"""
    logger.info("app.backend", f"Uploading images to dataset", "images_upload", {
        "dataset_id": dataset_id,
        "file_count": len(files),
        "auto_label": auto_label,
        "endpoint": "/api/datasets/{dataset_id}/upload"
    })
    
    try:
        # Verify dataset exists
        logger.debug("app.database", f"Verifying dataset {dataset_id} exists", "database_query")
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Upload images
        logger.info("operations.operations", f"Starting image upload to dataset", "image_upload_start", {
            "dataset_id": dataset_id,
            "file_count": len(files),
            "auto_label": auto_label
        })
        upload_results = await file_handler.upload_images_to_dataset(
            files, dataset_id, auto_label=auto_label
        )
        
        logger.info("operations.operations", f"Image upload completed successfully", "image_upload_success", {
            "dataset_id": dataset_id,
            "file_count": len(files),
            "upload_results": upload_results
        })
        
        return upload_results
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error uploading images to dataset", "image_upload_error", {
            "dataset_id": dataset_id,
            "file_count": len(files),
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to upload images: {str(e)}")


@router.post("/{dataset_id}/auto-label")
async def start_auto_labeling(
    dataset_id: str,
    request: AutoLabelRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start auto-labeling job for a dataset"""
    logger.info("app.backend", f"Starting auto-labeling job", "auto_labeling_start", {
        "dataset_id": dataset_id,
        "model_id": request.model_id,
        "confidence_threshold": request.confidence_threshold,
        "iou_threshold": request.iou_threshold,
        "overwrite_existing": request.overwrite_existing,
        "endpoint": "/api/datasets/{dataset_id}/auto-label"
    })
    
    try:
        # Verify dataset exists
        logger.debug("app.database", f"Verifying dataset {dataset_id} exists", "database_query")
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Verify model exists
        logger.debug("operations.operations", f"Verifying model {request.model_id} exists", "model_validation")
        model_info = model_manager.get_model_info(request.model_id)
        if not model_info:
            logger.warning("errors.validation", f"Invalid model ID {request.model_id}", "invalid_model_id", {
                "model_id": request.model_id
            })
            raise HTTPException(status_code=400, detail="Invalid model ID")
        
        # Create auto-label job
        logger.info("operations.operations", f"Creating auto-label job", "auto_label_job_creation", {
            "dataset_id": dataset_id,
            "model_id": request.model_id
        })
        job = AutoLabelJobOperations.create_auto_label_job(
            db=db,
            dataset_id=dataset_id,
            model_id=request.model_id,
            confidence_threshold=request.confidence_threshold,
            iou_threshold=request.iou_threshold,
            overwrite_existing=request.overwrite_existing
        )
        
        # Start auto-labeling in background
        logger.info("operations.operations", f"Adding auto-labeling task to background", "background_task_added", {
            "job_id": job.id,
            "dataset_id": dataset_id
        })
        background_tasks.add_task(
            auto_labeler.auto_label_dataset,
            dataset_id=dataset_id,
            model_id=request.model_id,
            confidence_threshold=request.confidence_threshold,
            iou_threshold=request.iou_threshold,
            overwrite_existing=request.overwrite_existing,
            job_id=job.id
        )
        
        logger.info("operations.operations", f"Auto-labeling job started successfully", "auto_labeling_job_started", {
            "job_id": job.id,
            "dataset_id": dataset_id,
            "model_id": request.model_id
        })
        
        return {
            "job_id": job.id,
            "message": "Auto-labeling job started",
            "dataset_id": dataset_id,
            "model_id": request.model_id,
            "status": "pending"
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error starting auto-labeling job", "auto_labeling_error", {
            "dataset_id": dataset_id,
            "model_id": request.model_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to start auto-labeling: {str(e)}")


@router.get("/{dataset_id}/images")
async def get_dataset_images(
    dataset_id: str,
    skip: int = 0,
    limit: int = 50,
    labeled_only: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get images in a dataset"""
    logger.info("app.backend", f"Getting dataset images", "dataset_images_retrieval", {
        "dataset_id": dataset_id,
        "skip": skip,
        "limit": limit,
        "labeled_only": labeled_only,
        "endpoint": "/api/datasets/{dataset_id}/images"
    })
    
    try:
        # Verify dataset exists
        logger.debug("app.database", f"Verifying dataset {dataset_id} exists", "database_query")
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get images
        logger.debug("app.database", f"Fetching images for dataset {dataset_id}", "database_query")
        images = ImageOperations.get_images_by_dataset(
            db, dataset_id, skip=skip, limit=limit, labeled_only=labeled_only
        )
        
        image_list = []
        for image in images:
            image_data = {
                "id": image.id,
                "filename": image.filename,
                "original_filename": image.original_filename,
                "width": image.width,
                "height": image.height,
                "file_size": image.file_size,
                "split_type": image.split_type,
                "split_section": getattr(image, "split_section", None),  # Add split_section field
                "is_labeled": image.is_labeled,
                "is_auto_labeled": image.is_auto_labeled,
                "is_verified": image.is_verified,
                "created_at": image.created_at,
                "url": file_handler.get_image_url(image.id)
            }
            image_list.append(image_data)
        
        logger.info("operations.datasets", f"Dataset images retrieved successfully", "dataset_images_retrieved", {
            "dataset_id": dataset_id,
            "image_count": len(image_list),
            "skip": skip,
            "limit": limit
        })
        
        return {
            "dataset_id": dataset_id,
            "images": image_list,
            "total_returned": len(image_list),
            "skip": skip,
            "limit": limit
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error retrieving dataset images", "dataset_images_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get dataset images: {str(e)}")


# Add individual image endpoint for the annotation interface
@router.get("/images/{image_id}")
async def get_image_by_id(
    image_id: str,
    db: Session = Depends(get_db)
):
    """Get individual image information by ID"""
    logger.info("app.backend", f"Getting image by ID", "image_retrieval", {
        "image_id": image_id,
        "endpoint": "/api/datasets/images/{image_id}"
    })
    
    try:
        # Get image
        logger.debug("app.database", f"Fetching image {image_id}", "database_query")
        image = ImageOperations.get_image(db, image_id)
        if not image:
            logger.warning("errors.validation", f"Image {image_id} not found", "image_not_found", {
                "image_id": image_id
            })
            raise HTTPException(status_code=404, detail="Image not found")
        
        logger.info("operations.images", f"Image retrieved successfully", "image_retrieved", {
            "image_id": image_id,
            "filename": image.filename
        })
        
        # Return image data with normalized file path for the annotation interface
        return {
            "id": image.id,
            "filename": image.filename,
            "original_filename": image.original_filename,
            "width": image.width,
            "height": image.height,
            "file_size": image.file_size,
            "is_labeled": image.is_labeled,
            "is_auto_labeled": image.is_auto_labeled,
            "is_verified": image.is_verified,
            "created_at": image.created_at,
            "file_path": image.normalized_file_path,  # Use automatic path normalization
            "dataset_id": image.dataset_id,
            "split_type": image.split_type,
            # Handle case where split_section column doesn't exist yet
            "split_section": getattr(image, "split_section", "train")
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error retrieving image", "image_retrieval_error", {
            "image_id": image_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get image: {str(e)}")


@router.delete("/images/{image_id}")
async def delete_image_by_id(
    image_id: str,
    db: Session = Depends(get_db)
):
    """Delete an image, its annotations, and its file from disk."""
    logger.info("app.backend", f"Deleting image by ID", "image_deletion", {
        "image_id": image_id,
        "endpoint": "/api/datasets/images/{image_id}"
    })
    try:
        success = ImageOperations.delete_image(db, image_id)
        if not success:
            logger.warning("errors.validation", f"Image {image_id} not found or failed to delete", "image_deletion_failed", {
                "image_id": image_id
            })
            raise HTTPException(status_code=404, detail="Image not found or failed to delete")
        logger.info("operations.images", f"Image deleted successfully", "image_deleted", {
            "image_id": image_id
        })
        return {"message": f"Image {image_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Error deleting image", "image_deletion_error", {
            "image_id": image_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")


class SplitSectionUpdate(BaseModel):
    split_section: str

@router.put("/images/{image_id}/split-section")
async def update_image_split_section(
    image_id: str,
    request: SplitSectionUpdate,
    db: Session = Depends(get_db)
):
    """
    Update the split section (train/val/test) for an image
    
    This endpoint is used in the annotation interface to change the split section
    """
    logger.info("app.backend", f"Updating image split section", "image_split_update", {
        "image_id": image_id,
        "split_section": request.split_section,
        "endpoint": "/api/datasets/images/{image_id}/split-section"
    })
    
    try:
        # Validate split section
        if request.split_section not in ["train", "val", "test"]:
            logger.warning("errors.validation", f"Invalid split section {request.split_section}", "invalid_split_section", {
                "image_id": image_id,
                "split_section": request.split_section
            })
            raise HTTPException(status_code=400, detail="Invalid split section. Must be train, val, or test")
        
        # Get the image
        logger.debug("app.database", f"Fetching image {image_id} for split update", "database_query")
        image = ImageOperations.get_image(db, image_id)
        if not image:
            logger.warning("errors.validation", f"Image {image_id} not found for split update", "image_not_found", {
                "image_id": image_id
            })
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Check if the image has the split_section attribute
        has_split_section = hasattr(image, "split_section")
        
        if has_split_section:
            # Update the split section
            logger.info("operations.images", f"Updating image split section in database", "split_section_update_operation", {
                "image_id": image_id,
                "split_section": request.split_section
            })
            success = ImageOperations.update_image_split_section(db, image_id, request.split_section)
            if not success:
                logger.error("errors.system", f"Failed to update image split section", "split_section_update_failed", {
                    "image_id": image_id,
                    "split_section": request.split_section
                })
                raise HTTPException(status_code=500, detail="Failed to update image split section")
            
            logger.info("operations.images", f"Image split section updated successfully", "split_section_updated", {
                "image_id": image_id,
                "split_section": request.split_section
            })
        else:
            # If the column doesn't exist yet, inform the user
            logger.warning("errors.validation", f"Split section feature not available", "split_section_not_available", {
                "image_id": image_id
            })
            raise HTTPException(
                status_code=503, 
                detail="The split_section feature is not available yet. Please run database migrations first."
            )
        
        # Return success response
        return {
            "message": f"Image split section updated to {request.split_section}",
            "image_id": image_id,
            "split_section": request.split_section
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error updating image split section", "split_section_update_error", {
            "image_id": image_id,
            "split_section": request.split_section,
            "error": str(e)
        })
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update image split section: {str(e)}")


@router.put("/{dataset_id}", response_model=Dict[str, Any])
async def update_dataset(
    dataset_id: str,
    request: DatasetUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update a dataset"""
    logger.info("app.backend", f"Updating dataset", "dataset_update", {
        "dataset_id": dataset_id,
        "update_data": request.dict(exclude_none=True),
        "endpoint": "/api/datasets/{dataset_id}"
    })
    
    try:
        # Check if dataset exists
        logger.debug("app.database", f"Verifying dataset {dataset_id} exists", "database_query")
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get project info for folder renaming
        logger.debug("app.database", f"Fetching project info for dataset {dataset_id}", "database_query")
        project = ProjectOperations.get_project(db, dataset.project_id)
        if not project:
            logger.warning("errors.validation", f"Project {dataset.project_id} not found", "project_not_found", {
                "project_id": dataset.project_id,
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Store old name for folder renaming
        old_dataset_name = dataset.name
        
        # Validate model_id if provided
        if request.model_id:
            logger.debug("operations.operations", f"Validating model ID {request.model_id}", "model_validation")
            model_info = model_manager.get_model_info(request.model_id)
            if not model_info:
                logger.warning("errors.validation", f"Invalid model ID {request.model_id}", "invalid_model_id", {
                    "model_id": request.model_id
                })
                raise HTTPException(status_code=400, detail="Invalid model ID")
        
        # Update dataset
        logger.info("operations.datasets", f"Updating dataset in database", "dataset_update_operation", {
            "dataset_id": dataset_id,
            "old_name": old_dataset_name,
            "new_name": request.name
        })
        updated_dataset = DatasetOperations.update_dataset(
            db=db,
            dataset_id=dataset_id,
            name=request.name,
            description=request.description,
            auto_label_enabled=request.auto_label_enabled,
            model_id=request.model_id
        )
        
        if not updated_dataset:
            logger.error("errors.system", f"Failed to update dataset {dataset_id}", "dataset_update_failed", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=500, detail="Failed to update dataset")
        
        # Rename folder if dataset name changed
        if request.name and request.name != old_dataset_name:
            logger.info("operations.operations", f"Renaming dataset folder", "folder_rename", {
                "old_name": old_dataset_name,
                "new_name": request.name,
                "project_name": project.name
            })
            folder_renamed = file_handler.rename_dataset_folder(
                project_name=project.name,
                old_dataset_name=old_dataset_name,
                new_dataset_name=request.name
            )
            if not folder_renamed:
                logger.warning("operations.operations", f"Failed to rename dataset folder", "folder_rename_failed", {
                    "old_name": old_dataset_name,
                    "new_name": request.name
                })
                # Log warning but don't fail the request
                print(f"Warning: Failed to rename dataset folder from {old_dataset_name} to {request.name}")
        
        logger.info("operations.datasets", f"Dataset updated successfully", "dataset_update_success", {
            "dataset_id": dataset_id,
            "dataset_name": updated_dataset.name
        })
        
        return {
            "id": updated_dataset.id,
            "name": updated_dataset.name,
            "description": updated_dataset.description,
            "project_id": updated_dataset.project_id,
            "total_images": updated_dataset.total_images,
            "labeled_images": updated_dataset.labeled_images,
            "unlabeled_images": updated_dataset.unlabeled_images,
            "auto_label_enabled": updated_dataset.auto_label_enabled,
            "model_id": updated_dataset.model_id,
            "created_at": updated_dataset.created_at,
            "updated_at": updated_dataset.updated_at
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error updating dataset", "dataset_update_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to update dataset: {str(e)}")


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Delete a dataset and all its images"""
    logger.info("app.backend", f"Deleting dataset", "dataset_deletion", {
        "dataset_id": dataset_id,
        "endpoint": "/api/datasets/{dataset_id}"
    })
    
    try:
        # Check if dataset exists
        logger.debug("app.database", f"Verifying dataset {dataset_id} exists", "database_query")
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get project info for folder cleanup
        logger.debug("app.database", f"Fetching project info for cleanup", "database_query")
        project = ProjectOperations.get_project(db, str(dataset.project_id))
        
        # Clean up files using project and dataset names
        if project:
            logger.info("operations.operations", f"Cleaning up dataset files by path", "file_cleanup", {
                "project_name": project.name,
                "dataset_name": dataset.name
            })
            file_handler.cleanup_dataset_files_by_path(project.name, dataset.name)
        else:
            # Fallback to old method
            logger.info("operations.operations", f"Cleaning up dataset files by ID", "file_cleanup", {
                "dataset_id": dataset_id
            })
            file_handler.cleanup_dataset_files(dataset_id)
        
        # Delete dataset from database
        logger.info("operations.datasets", f"Deleting dataset from database", "dataset_delete_operation", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })
        success = DatasetOperations.delete_dataset(db, dataset_id)
        if not success:
            logger.error("errors.system", f"Failed to delete dataset {dataset_id}", "dataset_delete_failed", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=500, detail="Failed to delete dataset")
        
        logger.info("operations.datasets", f"Dataset deleted successfully", "dataset_deleted", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })
        
        return {"message": "Dataset deleted successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error deleting dataset", "dataset_delete_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete dataset: {str(e)}")


@router.post("/upload")
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(""),
    project_id: str = Form(...),
    auto_label_enabled: bool = Form(True),
    model_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Create a new dataset and upload images to it"""
    try:
        # Verify project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create dataset
        dataset_data = DatasetCreateRequest(
            name=name,
            description=description,
            project_id=project_id,
            auto_label_enabled=auto_label_enabled,
            model_id=model_id
        )
        
        dataset = DatasetOperations.create_dataset(db, dataset_data.dict())
        
        # Upload images to the new dataset
        upload_results = await file_handler.upload_images_to_dataset(
            dataset_id=dataset.id,
            files=files,
            auto_label=auto_label_enabled
        )
        
        return {
            "dataset": {
                "id": dataset.id,
                "name": dataset.name,
                "description": dataset.description,
                "project_id": dataset.project_id,
                "auto_label_enabled": dataset.auto_label_enabled,
                "model_id": dataset.model_id,
                "created_at": dataset.created_at
            },
            "upload_results": upload_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload dataset: {str(e)}")