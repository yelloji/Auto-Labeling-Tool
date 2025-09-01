"""
API routes for project management
Organize datasets and models into projects with full database integration
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
import json
import uuid
from PIL import Image
import io
from pathlib import Path

from database.database import get_db
from database.operations import ProjectOperations, DatasetOperations, ImageOperations, AnnotationOperations
from models.model_manager import model_manager
from core.config import settings
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

# Helper function to get standard project paths
def get_project_path(project_name):
    """Get the standard path to a project folder using settings.PROJECTS_DIR"""
    return Path(settings.PROJECTS_DIR) / project_name

def get_dataset_path(project_name, workflow_stage, dataset_name):
    """Get the standard path to a dataset folder"""
    return get_project_path(project_name) / workflow_stage / dataset_name
from utils.path_utils import path_manager

router = APIRouter()


class ProjectCreateRequest(BaseModel):
    """Request model for creating a new project"""
    name: str
    description: str = ""
    project_type: str = "Object Detection"
    default_model_id: Optional[str] = None
    confidence_threshold: float = 0.5
    iou_threshold: float = 0.45


class ProjectUpdateRequest(BaseModel):
    """Request model for updating a project"""
    name: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    default_model_id: Optional[str] = None
    confidence_threshold: Optional[float] = None
    iou_threshold: Optional[float] = None


class ProjectResponse(BaseModel):
    """Response model for project data"""
    id: int
    name: str
    description: str
    project_type: str
    default_model_id: Optional[str]
    confidence_threshold: float
    iou_threshold: float
    created_at: datetime
    updated_at: datetime
    total_datasets: int = 0
    total_images: int = 0
    labeled_images: int = 0


@router.get("/", response_model=List[ProjectResponse])
async def get_projects(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """Get all projects with statistics"""
    logger.info("app.backend", f"Starting get projects operation", "get_projects_start", {
        "skip": skip,
        "limit": limit,
        "endpoint": "/projects"
    })
    
    try:
        logger.debug("app.database", f"Fetching projects from database", "projects_fetch", {
            "skip": skip,
            "limit": limit
        })
        
        projects = ProjectOperations.get_projects(db, skip=skip, limit=limit)
        
        logger.debug("operations.operations", f"Processing projects and calculating statistics", "projects_processing", {
            "projects_count": len(projects)
        })
        
        project_responses = []
        for project in projects:
            # Get datasets for this project
            datasets = DatasetOperations.get_datasets_by_project(db, project.id)
            
            # Calculate statistics
            total_datasets = len(datasets)
            total_images = sum(dataset.total_images or 0 for dataset in datasets)
            labeled_images = sum(dataset.labeled_images or 0 for dataset in datasets)
            
            project_response = ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                project_type=project.project_type,
                default_model_id=project.default_model_id,
                confidence_threshold=project.confidence_threshold,
                iou_threshold=project.iou_threshold,
                created_at=project.created_at,
                updated_at=project.updated_at,
                total_datasets=total_datasets,
                total_images=total_images,
                labeled_images=labeled_images
            )
            project_responses.append(project_response)
        
        logger.info("operations.operations", f"Projects retrieved successfully", "get_projects_success", {
            "projects_count": len(project_responses),
            "total_datasets": sum(p.total_datasets for p in project_responses),
            "total_images": sum(p.total_images for p in project_responses),
            "labeled_images": sum(p.labeled_images for p in project_responses)
        })
        
        return project_responses
        
    except Exception as e:
        logger.error("errors.system", f"Get projects operation failed", "get_projects_failure", {
            "skip": skip,
            "limit": limit,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get projects: {str(e)}")


@router.post("/", response_model=ProjectResponse)
async def create_project(
    request: ProjectCreateRequest, 
    db: Session = Depends(get_db)
):
    """Create a new project"""
    logger.info("app.backend", f"Starting create project operation", "create_project_start", {
        "project_name": request.name,
        "project_type": request.project_type,
        "default_model_id": request.default_model_id,
        "confidence_threshold": request.confidence_threshold,
        "iou_threshold": request.iou_threshold,
        "endpoint": "/projects"
    })
    
    try:
        # Validate model_id if provided
        if request.default_model_id:
            logger.debug("operations.operations", f"Validating model ID", "model_validation", {
                "model_id": request.default_model_id
            })
            
            model_info = model_manager.get_model_info(request.default_model_id)
            if not model_info:
                logger.warning("errors.validation", f"Invalid model ID provided", "invalid_model_id", {
                    "model_id": request.default_model_id
                })
                raise HTTPException(status_code=400, detail="Invalid model ID")
        
        logger.info("app.database", f"Creating project in database", "project_creation", {
            "project_name": request.name,
            "project_type": request.project_type
        })
        
        # Create project
        project = ProjectOperations.create_project(
            db=db,
            name=request.name,
            description=request.description,
            project_type=request.project_type,
            default_model_id=request.default_model_id,
            confidence_threshold=request.confidence_threshold,
            iou_threshold=request.iou_threshold
        )

        # Create project folder structure
        logger.info("operations.operations", f"Creating project folder structure", "folder_structure_creation", {
            "project_name": project.name,
            "projects_dir": settings.PROJECTS_DIR
        })
        
        try:
            from core.config import settings
            from pathlib import Path
            
            # Use the PROJECTS_DIR from settings
            project_folder = Path(settings.PROJECTS_DIR) / project.name
            project_folder.mkdir(exist_ok=True)
            
            # Create workflow folders
            workflow_folders = ["unassigned", "annotating", "dataset"]
            for folder in workflow_folders:
                folder_path = project_folder / folder
                folder_path.mkdir(exist_ok=True)
                
            logger.info("operations.operations", f"Project folder structure created successfully", "folder_creation_success", {
                "project_folder": str(project_folder),
                "workflow_folders": workflow_folders
            })
        except Exception as folder_error:
            logger.warning("errors.system", f"Failed to create project folder structure", "folder_creation_failure", {
                "project_name": project.name,
                "error": str(folder_error),
                "error_type": type(folder_error).__name__
            })
            # Don't fail the entire operation if folder creation fails
        
        logger.info("operations.operations", f"Project created successfully", "create_project_success", {
            "project_id": project.id,
            "project_name": project.name,
            "project_type": project.project_type
        })
        
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            project_type=project.project_type,
            default_model_id=project.default_model_id,
            confidence_threshold=project.confidence_threshold,
            iou_threshold=project.iou_threshold,
            created_at=project.created_at,
            updated_at=project.updated_at,
            total_datasets=0,
            total_images=0,
            labeled_images=0
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Create project operation failed", "create_project_failure", {
            "project_name": request.name,
            "project_type": request.project_type,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: Session = Depends(get_db)):
    """Get a specific project with detailed statistics"""
    logger.info("app.backend", f"Starting get project operation", "get_project_start", {
        "project_id": project_id,
        "endpoint": "/projects/{project_id}"
    })
    
    try:
        logger.debug("app.database", f"Fetching project from database", "project_fetch", {
            "project_id": project_id
        })
        
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.debug("operations.operations", f"Fetching datasets and calculating statistics", "datasets_fetch", {
            "project_id": project_id
        })
        
        # Get datasets and statistics
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        total_datasets = len(datasets)
        total_images = sum(dataset.total_images for dataset in datasets)
        labeled_images = sum(dataset.labeled_images for dataset in datasets)
        
        logger.info("operations.operations", f"Project retrieved successfully", "get_project_success", {
            "project_id": project_id,
            "project_name": project.name,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "labeled_images": labeled_images
        })
        
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            project_type=project.project_type,
            default_model_id=project.default_model_id,
            confidence_threshold=project.confidence_threshold,
            iou_threshold=project.iou_threshold,
            created_at=project.created_at,
            updated_at=project.updated_at,
            total_datasets=total_datasets,
            total_images=total_images,
            labeled_images=labeled_images
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Get project operation failed", "get_project_failure", {
            "project_id": project_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, 
    request: ProjectUpdateRequest, 
    db: Session = Depends(get_db)
):
    """Update a project"""
    logger.info("app.backend", f"Starting update project operation", "update_project_start", {
        "project_id": project_id,
        "update_data": {
            "name": request.name,
            "description": request.description,
            "project_type": request.project_type,
            "default_model_id": request.default_model_id,
            "confidence_threshold": request.confidence_threshold,
            "iou_threshold": request.iou_threshold
        },
        "endpoint": "/projects/{project_id}"
    })
    
    try:
        logger.debug("app.database", f"Checking if project exists", "project_existence_check", {
            "project_id": project_id
        })
        
        # Check if project exists
        existing_project = ProjectOperations.get_project(db, project_id)
        if not existing_project:
            logger.warning("errors.validation", f"Project not found for update", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate model_id if provided
        if request.default_model_id:
            logger.debug("operations.operations", f"Validating model ID", "model_validation", {
                "model_id": request.default_model_id
            })
            
            model_info = model_manager.get_model_info(request.default_model_id)
            if not model_info:
                logger.warning("errors.validation", f"Invalid model ID provided", "invalid_model_id", {
                    "model_id": request.default_model_id
                })
                raise HTTPException(status_code=400, detail="Invalid model ID")
        
        # Handle folder renaming if project name is being changed
        old_project_name = existing_project.name
        new_project_name = request.name if request.name is not None else old_project_name
        
        logger.debug("operations.operations", f"Preparing project update data", "update_data_preparation", {
            "old_project_name": old_project_name,
            "new_project_name": new_project_name,
            "update_fields": list(filter(None, [
                request.name, request.description, request.project_type,
                request.default_model_id, request.confidence_threshold, request.iou_threshold
            ]))
        })
        
        # Prepare update data
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.description is not None:
            update_data['description'] = request.description
        if request.project_type is not None:
            update_data['project_type'] = request.project_type
        if request.default_model_id is not None:
            update_data['default_model_id'] = request.default_model_id
        if request.confidence_threshold is not None:
            update_data['confidence_threshold'] = request.confidence_threshold
        if request.iou_threshold is not None:
            update_data['iou_threshold'] = request.iou_threshold
        
        logger.info("app.database", f"Updating project in database", "project_database_update", {
            "project_id": project_id,
            "update_data": update_data
        })
        
        # Update project in database first
        updated_project = ProjectOperations.update_project(db, project_id, **update_data)
        if not updated_project:
            logger.error("errors.system", f"Project database update failed", "database_update_failure", {
                "project_id": project_id,
                "update_data": update_data
            })
            raise HTTPException(status_code=500, detail="Failed to update project")
        
        # Handle folder renaming if project name changed
        if request.name is not None and old_project_name != new_project_name:
            logger.info("operations.operations", f"Handling project folder rename", "folder_rename_start", {
                "old_project_name": old_project_name,
                "new_project_name": new_project_name
            })
            
            try:
                old_folder_path = get_project_path(old_project_name)
                new_folder_path = get_project_path(new_project_name)
                
                logger.debug("operations.operations", f"Checking folder paths for rename", "folder_path_check", {
                    "old_folder_path": str(old_folder_path),
                    "new_folder_path": str(new_folder_path),
                    "old_exists": old_folder_path.exists(),
                    "new_exists": new_folder_path.exists()
                })
                
                # Only rename if old folder exists and new folder doesn't exist
                if old_folder_path.exists() and not new_folder_path.exists():
                    shutil.move(str(str(old_folder_path)), str(new_folder_path))
                    logger.info("operations.operations", f"Project folder renamed successfully", "folder_rename_success", {
                        "old_folder_path": str(old_folder_path),
                        "new_folder_path": str(new_folder_path)
                    })
                elif old_folder_path.exists() and new_folder_path.exists():
                    logger.warning("errors.validation", f"Both old and new project folders exist", "folder_conflict", {
                        "old_folder_path": str(old_folder_path),
                        "new_folder_path": str(new_folder_path)
                    })
                else:
                    logger.debug("operations.operations", f"Folder rename skipped", "folder_rename_skipped", {
                        "old_exists": old_folder_path.exists(),
                        "new_exists": new_folder_path.exists()
                    })
                    
            except Exception as folder_error:
                logger.warning("errors.system", f"Failed to rename project folder", "folder_rename_failure", {
                    "old_project_name": old_project_name,
                    "new_project_name": new_project_name,
                    "error": str(folder_error),
                    "error_type": type(folder_error).__name__
                })
                # Don't fail the entire operation if folder rename fails
        else:
            logger.debug("operations.operations", f"Folder rename not needed", "folder_rename_not_needed", {
                "name_changed": request.name is not None and old_project_name != new_project_name
            })
        
        logger.debug("operations.operations", f"Fetching updated project statistics", "statistics_fetch", {
            "project_id": project_id
        })
        
        # Get statistics
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        total_datasets = len(datasets)
        total_images = sum(dataset.total_images for dataset in datasets)
        labeled_images = sum(dataset.labeled_images for dataset in datasets)
        
        logger.info("operations.operations", f"Project updated successfully", "update_project_success", {
            "project_id": project_id,
            "project_name": updated_project.name,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "labeled_images": labeled_images
        })
        
        return ProjectResponse(
            id=updated_project.id,
            name=updated_project.name,
            description=updated_project.description,
            project_type=updated_project.project_type,
            default_model_id=updated_project.default_model_id,
            confidence_threshold=updated_project.confidence_threshold,
            iou_threshold=updated_project.iou_threshold,
            created_at=updated_project.created_at,
            updated_at=updated_project.updated_at,
            total_datasets=total_datasets,
            total_images=total_images,
            labeled_images=labeled_images
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Update project operation failed", "update_project_failure", {
            "project_id": project_id,
            "update_data": {
                "name": request.name,
                "description": request.description,
                "project_type": request.project_type,
                "default_model_id": request.default_model_id,
                "confidence_threshold": request.confidence_threshold,
                "iou_threshold": request.iou_threshold
            },
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project and all its datasets"""
    logger.info("app.backend", f"Starting delete project operation", "delete_project_start", {
        "project_id": project_id,
        "endpoint": "/projects/{project_id}"
    })
    
    try:
        logger.debug("app.database", f"Checking if project exists", "project_existence_check", {
            "project_id": project_id
        })
        
        # Check if project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project not found for deletion", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Store project name for folder cleanup
        project_name = project.name
        
        logger.info("app.database", f"Deleting project from database", "project_database_deletion", {
            "project_id": project_id,
            "project_name": project_name
        })
        
        # Delete project from database (cascades to datasets and images)
        success = ProjectOperations.delete_project(db, project_id)
        if not success:
            logger.error("errors.system", f"Project database deletion failed", "database_deletion_failure", {
                "project_id": project_id,
                "project_name": project_name
            })
            raise HTTPException(status_code=500, detail="Failed to delete project from database")
        
        # Delete project folder
        logger.info("operations.operations", f"Deleting project folder", "folder_deletion_start", {
            "project_name": project_name
        })
        
        try:
            project_folder_path = get_project_path(project_name)
            
            logger.debug("operations.operations", f"Checking project folder existence", "folder_existence_check", {
                "project_folder_path": str(project_folder_path),
                "folder_exists": project_folder_path.exists()
            })
            
            if project_folder_path.exists():
                shutil.rmtree(str(str(project_folder_path)))
                logger.info("operations.operations", f"Project folder deleted successfully", "folder_deletion_success", {
                    "project_folder_path": str(project_folder_path)
                })
            else:
                logger.debug("operations.operations", f"Project folder not found", "folder_not_found", {
                    "project_folder_path": str(project_folder_path)
                })
        except Exception as folder_error:
            logger.warning("errors.system", f"Failed to delete project folder", "folder_deletion_failure", {
                "project_name": project_name,
                "project_folder_path": str(project_folder_path) if 'project_folder_path' in locals() else "unknown",
                "error": str(folder_error),
                "error_type": type(folder_error).__name__
            })
            # Don't fail the entire operation if folder deletion fails
        
        logger.info("operations.operations", f"Project deleted successfully", "delete_project_success", {
            "project_id": project_id,
            "project_name": project_name
        })
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Delete project operation failed", "delete_project_failure", {
            "project_id": project_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@router.get("/{project_id}/datasets")
async def get_project_datasets(project_id: str, db: Session = Depends(get_db)):
    """Get all datasets for a project"""
    logger.info("app.backend", f"Starting get project datasets operation", "get_project_datasets_start", {
        "project_id": project_id,
        "endpoint": "/projects/{project_id}/datasets"
    })
    
    try:
        logger.debug("app.database", f"Checking if project exists", "project_existence_check", {
            "project_id": project_id
        })
        
        # Check if project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.debug("app.database", f"Fetching datasets for project", "datasets_fetch", {
            "project_id": project_id
        })
        
        # Get datasets
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        logger.debug("operations.operations", f"Processing dataset responses", "datasets_processing", {
            "project_id": project_id,
            "datasets_count": len(datasets)
        })
        
        dataset_responses = []
        for dataset in datasets:
            # Skip datasets with zero images to prevent empty folders in frontend
            if dataset.total_images == 0 or dataset.total_images is None:
                logger.debug("operations.datasets", f"Skipping empty dataset from dropdown", "empty_dataset_skipped", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "total_images": dataset.total_images,
                    "reason": "zero_images"
                })
                continue
                
            dataset_response = {
                "id": dataset.id,
                "name": dataset.name,
                "description": dataset.description,
                "total_images": dataset.total_images,
                "labeled_images": dataset.labeled_images,
                "unlabeled_images": dataset.unlabeled_images,
                "auto_label_enabled": dataset.auto_label_enabled,
                "model_id": dataset.model_id,
                "created_at": dataset.created_at,
                "updated_at": dataset.updated_at
            }
            dataset_responses.append(dataset_response)
        
        logger.info("operations.operations", f"Project datasets retrieved successfully", "get_project_datasets_success", {
            "project_id": project_id,
            "total_datasets": len(dataset_responses),
            "total_images": sum(d["total_images"] or 0 for d in dataset_responses),
            "labeled_images": sum(d["labeled_images"] or 0 for d in dataset_responses)
        })
        
        return {
            "project_id": project_id,
            "datasets": dataset_responses,
            "total_datasets": len(dataset_responses)
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Get project datasets operation failed", "get_project_datasets_failure", {
            "project_id": project_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get project datasets: {str(e)}")


@router.get("/{project_id}/management")
async def get_project_management_data(project_id: str, db: Session = Depends(get_db)):
    """Get datasets organized by management status (Unassigned, Annotating, Dataset)"""
    logger.info("app.backend", f"Starting get project management data operation", "get_project_management_start", {
        "project_id": project_id,
        "endpoint": "/projects/{project_id}/management"
    })
    
    try:
        logger.debug("app.database", f"Checking if project exists", "project_existence_check", {
            "project_id": project_id
        })
        
        # Check if project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.debug("app.database", f"Fetching datasets for project", "datasets_fetch", {
            "project_id": project_id
        })
        
        # Get datasets
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        logger.debug("operations.operations", f"Processing datasets for management status", "datasets_management_processing", {
            "project_id": project_id,
            "datasets_count": len(datasets)
        })
        
        unassigned = []
        annotating = []
        completed = []
        
        for dataset in datasets:
            # Skip datasets with zero images to prevent empty folders in management view
            if dataset.total_images == 0 or dataset.total_images is None:
                logger.debug("operations.datasets", f"Skipping empty dataset from management view", "empty_dataset_skipped_management", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "total_images": dataset.total_images,
                    "reason": "zero_images_management"
                })
                continue
                
            dataset_info = {
                "id": dataset.id,
                "name": dataset.name,
                "description": dataset.description,
                "total_images": dataset.total_images,
                "labeled_images": dataset.labeled_images,
                "unlabeled_images": dataset.unlabeled_images,
                "created_at": dataset.created_at,
                "updated_at": dataset.updated_at
            }
            
            # Check physical location to determine status
            project_folder = get_project_path(project.name)
            
            # First check by exact dataset name
            unassigned_folder = project_folder / "unassigned" / dataset.name
            annotating_folder = project_folder / "annotating" / dataset.name
            dataset_folder = project_folder / "dataset" / dataset.name
            
            logger.debug("operations.operations", f"Checking dataset folder locations", "folder_location_check", {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "project_name": project.name,
                "unassigned_exists": unassigned_folder.exists(),
                "annotating_exists": annotating_folder.exists(),
                "dataset_exists": dataset_folder.exists()
            })
            
            # If exact name match not found, check by image paths (more reliable)
            actual_location = None
            if not (unassigned_folder.exists() or annotating_folder.exists() or dataset_folder.exists()):
                logger.debug("operations.operations", f"Checking image paths for dataset location", "image_path_check", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                
                # Check image paths to determine actual location
                images = ImageOperations.get_images_by_dataset(db, dataset.id, skip=0, limit=1)
                if images:
                    image_path = images[0].file_path
                    logger.debug("operations.operations", f"Found image path for location check", "image_path_found", {
                        "dataset_id": dataset.id,
                        "image_path": image_path
                    })
                    
                    if "/unassigned/" in image_path:
                        actual_location = "unassigned"
                        logger.debug("operations.operations", f"Dataset located in UNASSIGNED via image path", "location_unassigned", {
                            "dataset_id": dataset.id,
                            "image_path": image_path
                        })
                    elif "/annotating/" in image_path:
                        actual_location = "annotating"
                        logger.debug("operations.operations", f"Dataset located in ANNOTATING via image path", "location_annotating", {
                            "dataset_id": dataset.id,
                            "image_path": image_path
                        })
                    elif "/dataset/" in image_path:
                        actual_location = "dataset"
                        logger.debug("operations.operations", f"Dataset located in DATASET via image path", "location_dataset", {
                            "dataset_id": dataset.id,
                            "image_path": image_path
                        })
            
            # Determine status based on folder existence or image path
            if unassigned_folder.exists() or actual_location == "unassigned":
                logger.debug("operations.operations", f"Adding dataset to UNASSIGNED", "dataset_unassigned", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                unassigned.append(dataset_info)
            elif annotating_folder.exists() or actual_location == "annotating":
                logger.debug("operations.operations", f"Adding dataset to ANNOTATING", "dataset_annotating", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                annotating.append(dataset_info)
            elif dataset_folder.exists() or actual_location == "dataset" or (dataset.labeled_images == dataset.total_images and dataset.total_images > 0):
                logger.debug("operations.operations", f"Adding dataset to COMPLETED", "dataset_completed", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                completed.append(dataset_info)
            else:
                # Default to unassigned if no folder found
                logger.warning("errors.validation", f"No folder found for dataset", "dataset_folder_not_found", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "project_name": project.name
                })
                logger.debug("operations.operations", f"Defaulting dataset to UNASSIGNED", "dataset_default_unassigned", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                unassigned.append(dataset_info)
        
        logger.info("operations.operations", f"Project management data retrieved successfully", "get_project_management_success", {
            "project_id": project_id,
            "unassigned_count": len(unassigned),
            "annotating_count": len(annotating),
            "completed_count": len(completed),
            "total_datasets": len(datasets)
        })
        
        return {
            "project_id": project_id,
            "unassigned": {
                "count": len(unassigned),
                "datasets": unassigned
            },
            "annotating": {
                "count": len(annotating),
                "datasets": annotating
            },
            "dataset": {
                "count": len(completed),
                "datasets": completed
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Get project management data operation failed", "get_project_management_failure", {
            "project_id": project_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get project management data: {str(e)}")


@router.put("/{project_id}/datasets/{dataset_id}/assign")
async def assign_dataset_to_annotating(project_id: str, dataset_id: str, db: Session = Depends(get_db)):
    """Assign a dataset to annotating status"""
    logger.info("app.backend", f"Starting dataset assignment to annotating", "dataset_assignment_start", {
        "project_id": project_id,
        "dataset_id": dataset_id,
        "endpoint": f"/projects/{project_id}/datasets/{dataset_id}/assign"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if dataset exists and belongs to project
        logger.debug("app.database", f"Checking if dataset {dataset_id} exists and belongs to project", "dataset_validation", {
            "dataset_id": dataset_id,
            "project_id": project_id
        })
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset or dataset.project_id != int(project_id):
            logger.warning("errors.validation", f"Dataset {dataset_id} not found or doesn't belong to project", "dataset_not_found", {
                "dataset_id": dataset_id,
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        logger.info("operations.datasets", f"Dataset assignment validation successful", "dataset_assignment_validated", {
            "project_name": project.name,
            "dataset_name": dataset.name,
            "project_id": project_id,
            "dataset_id": dataset_id
        })
        
        # Use proper folder structure: projects/{project}/{workflow}/{dataset}/
        project_folder = get_project_path(project.name)
        unassigned_folder = project_folder / "unassigned" / dataset.name
        annotating_folder = project_folder / "annotating" / dataset.name
        dataset_folder = project_folder / "dataset" / dataset.name
        
        # Check if dataset is in unassigned folder
        if unassigned_folder.exists():
            logger.info("operations.datasets", f"Moving dataset from unassigned to annotating", "dataset_move_unassigned_to_annotating", {
                "dataset_name": dataset.name,
                "source_folder": str(unassigned_folder),
                "target_folder": str(annotating_folder)
            })
            
            # Create annotating directory if it doesn't exist
            (project_folder / "annotating").mkdir(exist_ok=True, parents=True)
            
            # Move the entire dataset folder
            shutil.move(str(unassigned_folder), annotating_folder)
            logger.debug("operations.operations", f"Dataset folder moved successfully", "folder_move_success", {
                "source": str(unassigned_folder),
                "destination": str(annotating_folder)
            })
            
            # Update file paths in database
            logger.debug("app.database", f"Fetching images for dataset {dataset_id} to update paths", "images_fetch_for_path_update", {
                "dataset_id": dataset_id
            })
            images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=10000)
            
            logger.info("operations.datasets", f"Updating {len(images)} image paths and split types", "image_paths_update_start", {
                "dataset_id": dataset_id,
                "image_count": len(images),
                "split_type_change": "unassigned -> annotating"
            })
            
            for image in images:
                old_path = image.file_path
                # Generate correct relative path: projects/{project}/annotating/{dataset}/{filename}
                new_path = f"projects/{project.name}/annotating/{dataset.name}/{image.filename}"
                # Update image properties directly without individual commits
                image.file_path = new_path
                image.split_type = "annotating"
                # Set default split_section to "train" if the column exists
                try:
                    if hasattr(image, "split_section"):
                        if not image.split_section:
                            image.split_section = "train"
                        logger.debug("operations.datasets", f"Ensured split_section is set to train", "split_section_set", {
                            "image_id": image.id,
                            "split_section": image.split_section
                        })
                except Exception as e:
                    logger.debug("operations.datasets", f"split_section column may not exist yet", "split_section_column_note", {
                        "image_id": image.id,
                        "note": str(e)
                    })
                image.updated_at = datetime.utcnow()
            
            # Commit all image updates at once
            db.commit()
            logger.info("operations.datasets", f"Successfully updated {len(images)} image paths and split types", "image_paths_update_success", {
                "dataset_id": dataset_id,
                "updated_count": len(images),
                "split_type": "annotating"
            })
        
        # Check if dataset is in dataset folder (completed datasets)
        elif dataset_folder.exists():
            logger.info("operations.datasets", f"Moving dataset from completed to annotating", "dataset_move_completed_to_annotating", {
                "dataset_name": dataset.name,
                "source_folder": str(dataset_folder),
                "target_folder": str(annotating_folder)
            })
            
            # Create annotating directory if it doesn't exist
            (project_folder / "annotating").mkdir(exist_ok=True, parents=True)
            annotating_folder.mkdir(exist_ok=True, parents=True)
            
            # Get all images for this dataset
            logger.debug("app.database", f"Fetching images for completed dataset {dataset_id}", "completed_dataset_images_fetch", {
                "dataset_id": dataset_id
            })
            images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=10000)
            
            logger.info("operations.datasets", f"Copying {len(images)} images from completed to annotating folder", "images_copy_start", {
                "dataset_id": dataset_id,
                "image_count": len(images),
                "source": str(dataset_folder),
                "target": str(annotating_folder)
            })
            
            # Move images from train/val/test folders to flat annotating folder
            for image in images:
                old_path = image.file_path
                # Find the source file path from train/val/test subfolder
                source_path = Path("..") / image.file_path
                # Create target path in flat annotating folder
                target_path = annotating_folder / image.filename
                
                # Copy the file if it exists
                if source_path.exists():
                    try:
                        shutil.copy2(source_path, target_path)
                        logger.debug("operations.images", f"Image copied successfully", "image_copy_success", {
                            "source": str(source_path),
                            "target": str(target_path)
                        })
                    except Exception as e:
                        logger.error("errors.system", f"Error copying image {source_path}", "image_copy_error", {
                            "source": str(source_path),
                            "target": str(target_path),
                            "error": str(e)
                        })
                
                # Generate correct relative path: projects/{project}/annotating/{dataset}/{filename}
                new_path = f"projects/{project.name}/annotating/{dataset.name}/{image.filename}"
                # Update image properties directly without individual commits
                image.file_path = new_path
                image.split_type = "annotating"
                image.updated_at = datetime.utcnow()
            
            # Now remove the original dataset folder with all its subfolders
            try:
                shutil.rmtree(str(dataset_folder))
                logger.info("operations.operations", f"Original dataset folder removed successfully", "dataset_folder_removed", {
                    "folder_path": str(dataset_folder)
                })
            except Exception as e:
                logger.error("errors.system", f"Error removing dataset folder {dataset_folder}", "dataset_folder_removal_error", {
                    "folder_path": str(dataset_folder),
                    "error": str(e)
                })
            
            # Commit all image updates at once
            db.commit()
            logger.info("operations.datasets", f"Successfully updated {len(images)} image paths and split types", "image_paths_update_success", {
                "dataset_id": dataset_id,
                "updated_count": len(images),
                "split_type": "annotating"
            })
        
        # Update dataset to show it's being annotated
        # Always recalculate dataset stats to ensure accuracy
        logger.debug("operations.datasets", f"Recalculating dataset stats for {dataset_id}", "dataset_stats_recalculation", {
            "dataset_id": dataset_id
        })
        DatasetOperations.update_dataset_stats(db, dataset_id)
        
        # Refresh dataset to get updated stats
        db.refresh(dataset)
        logger.info("operations.datasets", f"Dataset stats updated successfully", "dataset_stats_updated", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "labeled_images": dataset.labeled_images,
            "total_images": dataset.total_images
        })
        
        # Recalculate stats normally (no forced "-1" hack)
        DatasetOperations.update_dataset_stats(db, dataset_id)
        db.refresh(dataset)

        logger.info("operations.datasets", f"Dataset assignment to annotating completed successfully", "dataset_assignment_completed", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "project_name": project.name
        })

        return {
            "success": True,
            "message": f"Dataset '{dataset.name}' assigned to annotating",
            "dataset_id": dataset_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Dataset assignment operation failed", "dataset_assignment_failure", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to assign dataset: {str(e)}")


@router.put("/{project_id}/datasets/{dataset_id}/rename")
async def rename_dataset(project_id: str, dataset_id: str, new_name: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Rename a dataset"""
    logger.info("app.backend", f"Starting dataset rename operation", "dataset_rename_start", {
        "project_id": project_id,
        "dataset_id": dataset_id,
        "new_name": new_name,
        "endpoint": f"/projects/{project_id}/datasets/{dataset_id}/rename"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if dataset exists and belongs to project
        logger.debug("app.database", f"Checking if dataset {dataset_id} exists and belongs to project", "dataset_validation", {
            "dataset_id": dataset_id,
            "project_id": project_id
        })
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset or dataset.project_id != int(project_id):
            logger.warning("errors.validation", f"Dataset {dataset_id} not found or doesn't belong to project", "dataset_not_found", {
                "dataset_id": dataset_id,
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Store old name for folder renaming
        old_dataset_name = dataset.name
        
        logger.info("operations.datasets", f"Dataset rename validation successful", "dataset_rename_validated", {
            "project_name": project.name,
            "old_dataset_name": old_dataset_name,
            "new_dataset_name": new_name,
            "project_id": project_id,
            "dataset_id": dataset_id
        })
        
        # Update dataset name in database
        logger.debug("app.database", f"Updating dataset name in database", "dataset_name_update", {
            "dataset_id": dataset_id,
            "old_name": old_dataset_name,
            "new_name": new_name
        })
        updated_dataset = DatasetOperations.update_dataset(db, dataset_id, name=new_name)
        if not updated_dataset:
            logger.error("errors.system", f"Failed to update dataset name in database", "dataset_name_update_failure", {
                "dataset_id": dataset_id,
                "old_name": old_dataset_name,
                "new_name": new_name
            })
            raise HTTPException(status_code=500, detail="Failed to update dataset name")
        
        logger.info("operations.datasets", f"Dataset name updated successfully in database", "dataset_name_updated", {
            "dataset_id": dataset_id,
            "old_name": old_dataset_name,
            "new_name": new_name
        })
        
        # Handle folder renaming - check all workflow folders
        try:
            logger.debug("operations.operations", f"Starting folder rename process", "folder_rename_start", {
                "project_name": project.name,
                "old_dataset_name": old_dataset_name,
                "new_dataset_name": new_name
            })
            
            project_folder = get_project_path(project.name)
            workflow_folders = ["unassigned", "annotating", "dataset"]
            
            old_folder_path = None
            new_folder_path = None
            workflow_type = None
            actual_folder_name = None
            
            # Find which workflow folder contains the dataset
            # First try with the old_dataset_name from database
            for workflow in workflow_folders:
                potential_old_path = Path(os.path.join(project_folder, workflow, old_dataset_name))
                if potential_old_path.exists():
                    old_folder_path = potential_old_path
                    new_folder_path = Path(os.path.join(project_folder, workflow, new_name))
                    workflow_type = workflow
                    actual_folder_name = old_dataset_name
                    logger.debug("operations.operations", f"Found dataset folder in workflow directory", "dataset_folder_found", {
                        "workflow": workflow,
                        "folder_path": str(potential_old_path)
                    })
                    break
            
            # If not found, search for any folder that might belong to this dataset
            # This handles cases where database and folder names are out of sync
            if not old_folder_path:
                logger.debug("operations.operations", f"Searching for dataset folder by image path", "dataset_folder_search", {
                    "dataset_id": dataset_id,
                    "old_dataset_name": old_dataset_name
                })
                for workflow in workflow_folders:
                    workflow_path = os.path.join(project_folder, workflow)
                    if workflow_path.exists():
                        for folder_name in os.listdir(workflow_path):
                            folder_path = Path(os.path.join(workflow_path, folder_name))
                            if folder_path.is_dir():
                                # Check if this folder contains images from our dataset
                                images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=1)
                                if images:
                                    # Check if the image path contains this folder name
                                    if f"/{folder_name}/" in images[0].file_path:
                                        old_folder_path = folder_path
                                        new_folder_path = Path(os.path.join(project_folder, workflow, new_name))
                                        workflow_type = workflow
                                        actual_folder_name = folder_name
                                        logger.debug("operations.operations", f"Found dataset folder by image path", "dataset_folder_found_by_image", {
                                            "folder_path": str(folder_path),
                                            "workflow": workflow
                                        })
                                        break
                    if old_folder_path:
                        break
            
            logger.info("operations.operations", f"Folder rename analysis completed", "folder_rename_analysis", {
                "old_folder_path": str(old_folder_path) if old_folder_path else "None",
                "new_folder_path": str(new_folder_path) if new_folder_path else "None",
                "workflow_type": workflow_type,
                "actual_folder_name": actual_folder_name
            })
            
            # Only rename if old folder exists and new folder doesn't exist
            if old_folder_path and old_folder_path.exists() and not new_folder_path.exists():
                try:
                    logger.info("operations.operations", f"Starting folder rename operation", "folder_rename_operation_start", {
                        "source": str(old_folder_path),
                        "destination": str(new_folder_path)
                    })
                    
                    # Ensure parent directory exists
                    new_folder_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Move the folder
                    shutil.move(str(old_folder_path), str(new_folder_path))
                    logger.info("operations.operations", f"Dataset folder renamed successfully", "dataset_folder_renamed", {
                        "source": str(old_folder_path),
                        "destination": str(new_folder_path)
                    })
                    
                    # Update file paths in database using the actual folder name
                    logger.debug("app.database", f"Fetching images to update paths after folder rename", "images_fetch_for_path_update", {
                        "dataset_id": dataset_id
                    })
                    images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=10000)
                    updated_count = 0
                    for image in images:
                        old_path = image.file_path
                        # Use actual_folder_name instead of old_dataset_name for replacement
                        new_path = old_path.replace(f"/{actual_folder_name}/", f"/{new_name}/")
                        if old_path != new_path:
                            ImageOperations.update_image_path(db, image.id, new_path)
                            updated_count += 1
                            logger.debug("operations.images", f"Image path updated", "image_path_updated", {
                                "image_id": image.id,
                                "old_path": old_path,
                                "new_path": new_path
                            })
                    
                    logger.info("operations.datasets", f"Image paths updated successfully after folder rename", "image_paths_update_success", {
                        "dataset_id": dataset_id,
                        "updated_count": updated_count,
                        "total_images": len(images)
                    })
                    
                except Exception as move_error:
                    logger.error("errors.system", f"Error during folder move operation", "folder_move_error", {
                        "source": str(old_folder_path),
                        "destination": str(new_folder_path),
                        "error": str(move_error)
                    })
                    # Try to rollback database changes if folder move failed
                    try:
                        DatasetOperations.update_dataset(db, dataset_id, name=old_dataset_name)
                        logger.warning("errors.system", f"Rolled back dataset name due to folder move failure", "dataset_name_rollback", {
                            "dataset_id": dataset_id,
                            "rolled_back_to": old_dataset_name
                        })
                    except:
                        logger.error("errors.system", f"Failed to rollback dataset name change", "dataset_name_rollback_failure", {
                            "dataset_id": dataset_id,
                            "old_name": old_dataset_name
                        })
                    raise HTTPException(status_code=500, detail=f"Failed to rename dataset folder: {str(move_error)}")
                    
            elif old_folder_path and old_folder_path.exists() and new_folder_path.exists():
                logger.warning("errors.validation", f"Both old and new dataset folders exist", "folder_conflict", {
                    "old_folder": str(old_folder_path),
                    "new_folder": str(new_folder_path)
                })
                raise HTTPException(status_code=409, detail=f"A dataset folder with name '{new_name}' already exists")
            else:
                logger.debug("operations.operations", f"Dataset folder rename skipped", "folder_rename_skipped", {
                    "old_exists": old_folder_path.exists() if old_folder_path else False,
                    "new_exists": new_folder_path.exists() if new_folder_path else False
                })
                if not old_folder_path:
                    logger.warning("operations.operations", f"Could not find dataset folder", "dataset_folder_not_found", {
                        "old_dataset_name": old_dataset_name
                    })
                
        except Exception as folder_error:
            logger.warning("errors.system", f"Failed to rename dataset folder", "folder_rename_failure", {
                "dataset_id": dataset_id,
                "error": str(folder_error)
            })
            # Don't fail the entire operation if folder rename fails
        
        logger.info("operations.datasets", f"Dataset rename operation completed successfully", "dataset_rename_completed", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "old_name": old_dataset_name,
            "new_name": new_name,
            "project_name": project.name
        })
        
        return {
            "success": True,
            "message": f"Dataset renamed to '{new_name}'",
            "dataset": {
                "id": updated_dataset.id,
                "name": updated_dataset.name,
                "description": updated_dataset.description,
                "total_images": updated_dataset.total_images,
                "labeled_images": updated_dataset.labeled_images,
                "unlabeled_images": updated_dataset.unlabeled_images,
                "created_at": updated_dataset.created_at,
                "updated_at": updated_dataset.updated_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Dataset rename operation failed", "dataset_rename_failure", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "new_name": new_name,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to rename dataset: {str(e)}")


@router.delete("/{project_id}/datasets/{dataset_id}")
async def delete_dataset(project_id: str, dataset_id: str, db: Session = Depends(get_db)):
    """Delete a dataset and all its images"""
    logger.info("app.backend", f"Starting dataset deletion operation", "dataset_deletion_start", {
        "project_id": project_id,
        "dataset_id": dataset_id,
        "endpoint": f"/projects/{project_id}/datasets/{dataset_id}"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if dataset exists and belongs to project
        logger.debug("app.database", f"Checking if dataset {dataset_id} exists and belongs to project", "dataset_validation", {
            "dataset_id": dataset_id,
            "project_id": project_id
        })
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset or dataset.project_id != int(project_id):
            logger.warning("errors.validation", f"Dataset {dataset_id} not found or doesn't belong to project", "dataset_not_found", {
                "dataset_id": dataset_id,
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        dataset_name = dataset.name
        
        logger.info("operations.datasets", f"Dataset deletion validation successful", "dataset_deletion_validated", {
            "project_name": project.name,
            "dataset_name": dataset_name,
            "project_id": project_id,
            "dataset_id": dataset_id
        })
        
        # Delete dataset from database first (this should cascade to delete images)
        logger.debug("app.database", f"Deleting dataset {dataset_id} from database", "dataset_database_deletion", {
            "dataset_id": dataset_id,
            "dataset_name": dataset_name
        })
        success = DatasetOperations.delete_dataset(db, dataset_id)
        if not success:
            logger.error("errors.system", f"Failed to delete dataset {dataset_id} from database", "dataset_database_deletion_failure", {
                "dataset_id": dataset_id,
                "dataset_name": dataset_name
            })
            raise HTTPException(status_code=500, detail="Failed to delete dataset")
        
        logger.info("operations.datasets", f"Dataset {dataset_id} deleted successfully from database", "dataset_database_deletion_success", {
            "dataset_id": dataset_id,
            "dataset_name": dataset_name
        })
        
        # Delete dataset folder from all possible locations
        try:
            logger.debug("operations.operations", f"Starting dataset folder deletion process", "dataset_folder_deletion_start", {
                "project_name": project.name,
                "dataset_name": dataset_name
            })
            
            project_folder = get_project_path(project.name)
            possible_locations = ["unassigned", "annotating", "dataset"]
            
            for location in possible_locations:
                dataset_folder_path = project_folder / location / dataset_name
                logger.debug("operations.operations", f"Checking dataset folder location", "dataset_folder_location_check", {
                    "location": location,
                    "folder_path": str(dataset_folder_path)
                })
                
                if dataset_folder_path.exists():
                    logger.info("operations.operations", f"Found dataset folder, proceeding with deletion", "dataset_folder_found_for_deletion", {
                        "location": location,
                        "folder_path": str(dataset_folder_path)
                    })
                    
                    shutil.rmtree(str(dataset_folder_path))
                    logger.info("operations.operations", f"Dataset folder deleted successfully", "dataset_folder_deleted", {
                        "location": location,
                        "folder_path": str(dataset_folder_path)
                    })
                    break
            else:
                logger.debug("operations.operations", f"Dataset folder not found in any location", "dataset_folder_not_found", {
                    "dataset_name": dataset_name,
                    "locations_checked": possible_locations
                })
                
        except Exception as folder_error:
            logger.warning("errors.system", f"Failed to delete dataset folder", "dataset_folder_deletion_failure", {
                "dataset_name": dataset_name,
                "error": str(folder_error)
            })
            # Don't fail the entire operation if folder deletion fails
        
        logger.info("operations.datasets", f"Dataset deletion operation completed successfully", "dataset_deletion_completed", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "project_name": project.name
        })
        
        return {
            "success": True,
            "message": f"Dataset '{dataset_name}' deleted successfully",
            "dataset_id": dataset_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Dataset deletion operation failed", "dataset_deletion_failure", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete dataset: {str(e)}")


@router.delete("/{project_id}/clear-data")
async def clear_project_data(project_id: str, db: Session = Depends(get_db)):
    """Clear all data (datasets and images) from a project"""
    logger.info("app.backend", f"Starting project data clearing operation", "project_data_clear_start", {
        "project_id": project_id,
        "endpoint": f"/projects/{project_id}/clear-data"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project data clearing validation successful", "project_data_clear_validated", {
            "project_name": project.name,
            "project_id": project_id
        })
        
        # Get all datasets for this project
        logger.debug("app.database", f"Fetching all datasets for project {project_id}", "datasets_fetch", {
            "project_id": project_id
        })
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        logger.info("operations.datasets", f"Found {len(datasets)} datasets to delete", "datasets_count_for_deletion", {
            "project_id": project_id,
            "project_name": project.name,
            "dataset_count": len(datasets)
        })
        
        # Delete all datasets and their images
        deleted_count = 0
        failed_count = 0
        for dataset in datasets:
            try:
                logger.debug("operations.datasets", f"Deleting dataset {dataset.id}", "individual_dataset_deletion", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "project_id": project_id
                })
                
                # Delete dataset from database (this should cascade to delete images)
                DatasetOperations.delete_dataset(db, str(dataset.id))
                
                # Delete dataset folder
                dataset_folder_path = get_project_path(project.name) / dataset.name
                if dataset_folder_path.exists():
                    logger.debug("operations.operations", f"Deleting dataset folder", "dataset_folder_deletion", {
                        "folder_path": str(dataset_folder_path),
                        "dataset_name": dataset.name
                    })
                    shutil.rmtree(str(dataset_folder_path))
                    logger.info("operations.operations", f"Dataset folder deleted successfully", "dataset_folder_deleted", {
                        "folder_path": str(dataset_folder_path),
                        "dataset_name": dataset.name
                    })
                
                deleted_count += 1
                logger.debug("operations.datasets", f"Dataset {dataset.id} deleted successfully", "individual_dataset_deletion_success", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                    
            except Exception as dataset_error:
                failed_count += 1
                logger.warning("errors.system", f"Failed to delete dataset {dataset.name}", "individual_dataset_deletion_failure", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "error": str(dataset_error)
                })
                # Continue with other datasets
        
        logger.info("operations.datasets", f"Dataset deletion summary", "dataset_deletion_summary", {
            "project_id": project_id,
            "total_datasets": len(datasets),
            "deleted_count": deleted_count,
            "failed_count": failed_count
        })
        
        # Also delete any loose images in the project folder
        try:
            logger.debug("operations.operations", f"Starting project folder clearing", "project_folder_clear_start", {
                "project_name": project.name
            })
            
            project_folder_path = get_project_path(project.name)
            if project_folder_path.exists():
                # Remove all files and subdirectories, then recreate the empty folder
                shutil.rmtree(str(project_folder_path))
                project_folder_path.mkdir(parents=True, exist_ok=True)
                logger.info("operations.operations", f"Project folder cleared and recreated successfully", "project_folder_cleared", {
                    "folder_path": str(project_folder_path),
                    "project_name": project.name
                })
        except Exception as folder_error:
            logger.warning("errors.system", f"Failed to clear project folder", "project_folder_clear_failure", {
                "project_name": project.name,
                "error": str(folder_error)
            })
        
        logger.info("operations.operations", f"Project data clearing operation completed successfully", "project_data_clear_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "datasets_deleted": deleted_count,
            "datasets_failed": failed_count
        })
        
        return {
            "success": True,
            "message": f"All data cleared from project '{project.name}'",
            "project_id": project_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Project data clearing operation failed", "project_data_clear_failure", {
            "project_id": project_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to clear project data: {str(e)}")


@router.post("/{project_id}/duplicate", response_model=ProjectResponse)
async def duplicate_project(project_id: str, db: Session = Depends(get_db)):
    """Duplicate a project with all its datasets, images, and annotations"""
    logger.info("app.backend", f"Starting project duplication operation", "project_duplication_start", {
        "source_project_id": project_id,
        "endpoint": f"/projects/{project_id}/duplicate"
    })
    
    try:
        # Check if source project exists
        logger.debug("app.database", f"Checking if source project {project_id} exists", "source_project_existence_check", {
            "project_id": project_id
        })
        source_project = ProjectOperations.get_project(db, project_id)
        if not source_project:
            logger.warning("errors.validation", f"Source project {project_id} not found", "source_project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project duplication validation successful", "project_duplication_validated", {
            "source_project_name": source_project.name,
            "source_project_id": project_id
        })
        
        # Create new project with copied metadata
        new_project_name = f"{source_project.name} (Copy)"
        logger.debug("operations.operations", f"Creating new project with copied metadata", "new_project_creation_start", {
            "new_project_name": new_project_name,
            "source_project_name": source_project.name
        })
        
        new_project = ProjectOperations.create_project(
            db=db,
            name=new_project_name,
            description=source_project.description,
            project_type=source_project.project_type,
            default_model_id=source_project.default_model_id,
            confidence_threshold=source_project.confidence_threshold,
            iou_threshold=source_project.iou_threshold
        )
        
        logger.info("operations.operations", f"New project created successfully in database", "new_project_created", {
            "new_project_id": new_project.id,
            "new_project_name": new_project_name,
            "source_project_id": project_id
        })
        
        # Create new project folder
        source_project_folder = get_project_path(source_project.name)
        new_project_folder = get_project_path(new_project_name)
        new_project_folder.mkdir(parents=True, exist_ok=True)
        
        logger.debug("operations.operations", f"New project folder created", "new_project_folder_created", {
            "folder_path": str(new_project_folder),
            "new_project_name": new_project_name
        })
        
        # Copy all files from source project folder to new project folder
        try:
            logger.info("operations.operations", f"Starting project folder content copying", "project_folder_copy_start", {
                "source_folder": str(source_project_folder),
                "destination_folder": str(new_project_folder)
            })
            
            if source_project_folder.exists():
                copied_files = 0
                copied_folders = 0
                
                # Copy all files directly in the project folder (like Medical Image project)
                for item in os.listdir(source_project_folder):
                    source_item_path = os.path.join(source_project_folder, item)
                    new_item_path = os.path.join(new_project_folder, item)
                    
                    if os.path.isfile(source_item_path):
                        # Copy individual files (images)
                        shutil.copy2(source_item_path, new_item_path)
                        copied_files += 1
                        logger.debug("operations.images", f"File copied successfully", "file_copy_success", {
                            "source": source_item_path,
                            "destination": new_item_path
                        })
                    elif os.path.isdir(source_item_path):
                        # Copy dataset folders (like Project 1, Project 2)
                        shutil.copytree(source_item_path, new_item_path)
                        copied_folders += 1
                        logger.debug("operations.operations", f"Folder copied successfully", "folder_copy_success", {
                            "source": source_item_path,
                            "destination": new_item_path
                        })
                        
                logger.info("operations.operations", f"Project folder content copied successfully", "project_folder_copy_completed", {
                    "source_folder": str(source_project_folder),
                    "destination_folder": str(new_project_folder),
                    "files_copied": copied_files,
                    "folders_copied": copied_folders
                })
        except Exception as folder_error:
            logger.warning("errors.system", f"Failed to copy project folder content", "project_folder_copy_failure", {
                "source_folder": str(source_project_folder),
                "destination_folder": str(new_project_folder),
                "error": str(folder_error)
            })
        
        # Get all datasets from source project
        logger.debug("app.database", f"Fetching datasets from source project", "source_datasets_fetch", {
            "source_project_id": project_id
        })
        source_datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        logger.info("operations.datasets", f"Found {len(source_datasets)} datasets to duplicate", "datasets_count_for_duplication", {
            "source_project_id": project_id,
            "dataset_count": len(source_datasets)
        })
        
        # Copy each dataset with its images and annotations
        for source_dataset in source_datasets:
            logger.debug("operations.datasets", f"Duplicating dataset {source_dataset.id}", "individual_dataset_duplication_start", {
                "source_dataset_id": source_dataset.id,
                "source_dataset_name": source_dataset.name,
                "new_project_id": new_project.id
            })
            
            # Create new dataset
            new_dataset = DatasetOperations.create_dataset(
                db=db,
                name=f"{source_dataset.name} (Copy)",
                description=source_dataset.description,
                project_id=new_project.id,
                auto_label_enabled=source_dataset.auto_label_enabled,
                model_id=source_dataset.model_id
            )
            
            logger.debug("operations.datasets", f"New dataset created successfully", "new_dataset_created", {
                "new_dataset_id": new_dataset.id,
                "new_dataset_name": new_dataset.name,
                "source_dataset_id": source_dataset.id
            })
            
            # Copy all images and their annotations from source dataset
            logger.debug("app.database", f"Fetching images for dataset {source_dataset.id}", "source_images_fetch", {
                "source_dataset_id": source_dataset.id
            })
            source_images = ImageOperations.get_images_by_dataset(db, source_dataset.id, skip=0, limit=10000)
            
            logger.info("operations.images", f"Copying {len(source_images)} images from source dataset", "images_copy_start", {
                "source_dataset_id": source_dataset.id,
                "source_dataset_name": source_dataset.name,
                "image_count": len(source_images)
            })
            
            for source_image in source_images:
                # Update file path for the new project
                new_file_path = source_image.file_path.replace(source_project.name, new_project_name)
                if source_dataset.name in source_image.file_path:
                    new_file_path = new_file_path.replace(source_dataset.name, new_dataset.name)
                
                # Create new image record
                new_image = ImageOperations.create_image(
                    db=db,
                    filename=source_image.filename,
                    original_filename=source_image.original_filename,
                    file_path=new_file_path,
                    dataset_id=new_dataset.id,
                    width=source_image.width,
                    height=source_image.height,
                    file_size=source_image.file_size,
                    format=source_image.format
                )
                
                logger.debug("operations.images", f"New image record created", "new_image_created", {
                    "new_image_id": new_image.id,
                    "new_file_path": new_file_path,
                    "source_image_id": source_image.id
                })
                
                # Copy annotations if they exist
                logger.debug("app.database", f"Fetching annotations for image {source_image.id}", "source_annotations_fetch", {
                    "source_image_id": source_image.id
                })
                source_annotations = AnnotationOperations.get_annotations_by_image(db, source_image.id)
                
                if source_annotations:
                    logger.debug("operations.annotations", f"Copying {len(source_annotations)} annotations", "annotations_copy_start", {
                        "source_image_id": source_image.id,
                        "annotation_count": len(source_annotations)
                    })
                    
                    for source_annotation in source_annotations:
                        AnnotationOperations.create_annotation(
                            db=db,
                            image_id=new_image.id,
                            class_name=source_annotation.class_name,
                            class_id=source_annotation.class_id,
                            x_min=source_annotation.x_min,
                            y_min=source_annotation.y_min,
                            x_max=source_annotation.x_max,
                            y_max=source_annotation.y_max,
                            confidence=source_annotation.confidence,
                            segmentation=source_annotation.segmentation,
                            is_auto_generated=source_annotation.is_auto_generated,
                            model_id=source_annotation.model_id
                        )
                    
                    logger.debug("operations.annotations", f"Annotations copied successfully", "annotations_copy_success", {
                        "source_image_id": source_image.id,
                        "new_image_id": new_image.id,
                        "annotation_count": len(source_annotations)
                    })
        
        # Get final statistics for the new project
        logger.debug("app.database", f"Fetching final statistics for new project", "new_project_stats_fetch", {
            "new_project_id": new_project.id
        })
        new_datasets = DatasetOperations.get_datasets_by_project(db, new_project.id)
        total_datasets = len(new_datasets)
        total_images = sum(dataset.total_images for dataset in new_datasets)
        labeled_images = sum(dataset.labeled_images for dataset in new_datasets)
        
        logger.info("operations.operations", f"Project duplication completed successfully", "project_duplication_completed", {
            "source_project_id": project_id,
            "source_project_name": source_project.name,
            "new_project_id": new_project.id,
            "new_project_name": new_project_name,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "labeled_images": labeled_images
        })
        
        return ProjectResponse(
            id=new_project.id,
            name=new_project.name,
            description=new_project.description,
            project_type=new_project.project_type,
            default_model_id=new_project.default_model_id,
            confidence_threshold=new_project.confidence_threshold,
            iou_threshold=new_project.iou_threshold,
            created_at=new_project.created_at,
            updated_at=new_project.updated_at,
            total_datasets=total_datasets,
            total_images=total_images,
            labeled_images=labeled_images
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Project duplication operation failed", "project_duplication_failure", {
            "source_project_id": project_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to duplicate project: {str(e)}")


class ProjectMergeRequest(BaseModel):
    """Request model for merging projects"""
    target_project_id: str
    merged_project_name: str


@router.post("/{source_project_id}/merge", response_model=ProjectResponse)
async def merge_projects(
    source_project_id: str, 
    request: ProjectMergeRequest, 
    db: Session = Depends(get_db)
):
    """Merge two projects into a new project with all datasets, images, and annotations"""
    logger.info("app.backend", f"Starting project merge operation", "project_merge_start", {
        "source_project_id": source_project_id,
        "target_project_id": request.target_project_id,
        "merged_project_name": request.merged_project_name,
        "endpoint": f"/projects/{source_project_id}/merge"
    })
    
    try:
        # Check if both source projects exist
        logger.debug("app.database", f"Checking if source project {source_project_id} exists", "source_project_existence_check", {
            "project_id": source_project_id
        })
        source_project = ProjectOperations.get_project(db, source_project_id)
        if not source_project:
            logger.warning("errors.validation", f"Source project {source_project_id} not found", "source_project_not_found", {
                "project_id": source_project_id
            })
            raise HTTPException(status_code=404, detail="Source project not found")
        
        logger.debug("app.database", f"Checking if target project {request.target_project_id} exists", "target_project_existence_check", {
            "project_id": request.target_project_id
        })
        target_project = ProjectOperations.get_project(db, request.target_project_id)
        if not target_project:
            logger.warning("errors.validation", f"Target project {request.target_project_id} not found", "target_project_not_found", {
                "project_id": request.target_project_id
            })
            raise HTTPException(status_code=404, detail="Target project not found")
        
        logger.info("operations.operations", f"Project merge validation successful", "project_merge_validated", {
            "source_project_name": source_project.name,
            "source_project_id": source_project_id,
            "target_project_name": target_project.name,
            "target_project_id": request.target_project_id,
            "merged_project_name": request.merged_project_name
        })
        
        # Create new merged project
        logger.debug("operations.operations", f"Creating merged project", "merged_project_creation_start", {
            "merged_project_name": request.merged_project_name,
            "source_project_name": source_project.name,
            "target_project_name": target_project.name
        })
        
        merged_project = ProjectOperations.create_project(
            db=db,
            name=request.merged_project_name,
            description=f"Merged project from '{source_project.name}' and '{target_project.name}'",
            project_type=source_project.project_type,  # Use source project type
            default_model_id=source_project.default_model_id,
            confidence_threshold=source_project.confidence_threshold,
            iou_threshold=source_project.iou_threshold
        )
        
        logger.info("operations.operations", f"Merged project created successfully in database", "merged_project_created", {
            "merged_project_id": merged_project.id,
            "merged_project_name": request.merged_project_name
        })
        
        # Create merged project folder
        merged_project_folder = get_project_path(merged_project.name)
        merged_project_folder.mkdir(parents=True, exist_ok=True)
        
        logger.debug("operations.operations", f"Merged project folder created", "merged_project_folder_created", {
            "folder_path": str(merged_project_folder),
            "merged_project_name": request.merged_project_name
        })
        
        # Function to copy project content
        def copy_project_content(project, prefix=""):
            project_folder = get_project_path(project.name)
            
            logger.debug("operations.operations", f"Starting content copy for project {project.name}", "project_content_copy_start", {
                "project_name": project.name,
                "prefix": prefix,
                "source_folder": str(project_folder),
                "destination_folder": str(merged_project_folder)
            })
            
            # Copy all files and folders from project
            try:
                if project_folder.exists():
                    copied_files = 0
                    copied_folders = 0
                    
                    for item in os.listdir(project_folder):
                        source_item_path = os.path.join(project_folder, item)
                        # Add prefix to avoid naming conflicts
                        new_item_name = f"{prefix}{item}" if prefix else item
                        merged_item_path = os.path.join(merged_project_folder, new_item_name)
                        
                        if os.path.isfile(source_item_path):
                            # Copy individual files (images)
                            shutil.copy2(source_item_path, merged_item_path)
                            copied_files += 1
                            logger.debug("operations.images", f"File copied successfully", "file_copy_success", {
                                "source": source_item_path,
                                "destination": merged_item_path,
                                "project_name": project.name
                            })
                        elif os.path.isdir(source_item_path):
                            # Copy dataset folders
                            shutil.copytree(source_item_path, merged_item_path)
                            copied_folders += 1
                            logger.debug("operations.operations", f"Folder copied successfully", "folder_copy_success", {
                                "source": source_item_path,
                                "destination": merged_item_path,
                                "project_name": project.name
                            })
                    
                    logger.info("operations.operations", f"Project content copied successfully", "project_content_copy_completed", {
                        "project_name": project.name,
                        "prefix": prefix,
                        "files_copied": copied_files,
                        "folders_copied": copied_folders,
                        "source_folder": str(project_folder),
                        "destination_folder": str(merged_project_folder)
                    })
            except Exception as folder_error:
                logger.warning("errors.system", f"Failed to merge project folder content", "project_content_copy_failure", {
                    "project_name": project.name,
                    "prefix": prefix,
                    "error": str(folder_error)
                })
        
        # Copy content from both projects
        logger.info("operations.operations", f"Starting content copy from both projects", "both_projects_content_copy_start", {
            "source_project_name": source_project.name,
            "target_project_name": target_project.name
        })
        
        copy_project_content(source_project, "")  # No prefix for source
        copy_project_content(target_project, f"{target_project.name}_")  # Prefix for target to avoid conflicts
        
        # Merge datasets from both projects
        logger.info("operations.datasets", f"Starting dataset merge process", "dataset_merge_start", {
            "source_project_id": source_project_id,
            "target_project_id": request.target_project_id,
            "merged_project_id": merged_project.id
        })
        
        projects_to_merge = [
            (source_project, source_project_id, ""),
            (target_project, request.target_project_id, f"{target_project.name}_")
        ]
        
        total_datasets_merged = 0
        total_images_merged = 0
        total_annotations_merged = 0
        
        for project, project_id, prefix in projects_to_merge:
            logger.debug("operations.datasets", f"Processing project {project.name} for dataset merge", "project_dataset_merge_start", {
                "project_id": project_id,
                "project_name": project.name,
                "prefix": prefix
            })
            
            # Get all datasets from project
            datasets = DatasetOperations.get_datasets_by_project(db, project_id)
            
            logger.debug("operations.datasets", f"Found {len(datasets)} datasets in project {project.name}", "datasets_count_found", {
                "project_id": project_id,
                "project_name": project.name,
                "dataset_count": len(datasets)
            })
            
            for dataset in datasets:
                logger.debug("operations.datasets", f"Creating merged dataset {dataset.name}", "merged_dataset_creation_start", {
                    "source_dataset_id": dataset.id,
                    "source_dataset_name": dataset.name,
                    "project_name": project.name,
                    "prefix": prefix
                })
                
                # Create new dataset in merged project
                merged_dataset_name = f"{prefix}{dataset.name}" if prefix else dataset.name
                new_dataset = DatasetOperations.create_dataset(
                    db=db,
                    name=merged_dataset_name,
                    description=f"From {project.name}: {dataset.description}",
                    project_id=merged_project.id,
                    auto_label_enabled=dataset.auto_label_enabled,
                    model_id=dataset.model_id
                )
                
                logger.debug("operations.datasets", f"Merged dataset created successfully", "merged_dataset_created", {
                    "new_dataset_id": new_dataset.id,
                    "merged_dataset_name": merged_dataset_name,
                    "source_dataset_id": dataset.id
                })
                
                # Copy all images and annotations from dataset
                logger.debug("app.database", f"Fetching images for dataset {dataset.id}", "dataset_images_fetch", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name
                })
                
                images = ImageOperations.get_images_by_dataset(db, dataset.id, skip=0, limit=10000)
                
                logger.info("operations.images", f"Copying {len(images)} images from dataset {dataset.name}", "images_copy_start", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "image_count": len(images),
                    "project_name": project.name
                })
                
                for image in images:
                    # Update file path for the merged project
                    new_file_path = image.file_path.replace(project.name, merged_project.name)
                    if prefix and dataset.name in image.file_path:
                        new_file_path = new_file_path.replace(dataset.name, merged_dataset_name)
                    
                    # Create new image record
                    new_image = ImageOperations.create_image(
                        db=db,
                        filename=image.filename,
                        original_filename=image.original_filename,
                        file_path=new_file_path,
                        dataset_id=new_dataset.id,
                        width=image.width,
                        height=image.height,
                        file_size=image.file_size,
                        format=image.format
                    )
                    
                    total_images_merged += 1
                    logger.debug("operations.images", f"New image record created", "new_image_created", {
                        "new_image_id": new_image.id,
                        "new_file_path": new_file_path,
                        "source_image_id": image.id
                    })
                    
                    # Copy annotations if they exist
                    logger.debug("app.database", f"Fetching annotations for image {image.id}", "image_annotations_fetch", {
                        "image_id": image.id
                    })
                    
                    annotations = AnnotationOperations.get_annotations_by_image(db, image.id)
                    
                    if annotations:
                        logger.debug("operations.annotations", f"Copying {len(annotations)} annotations", "annotations_copy_start", {
                            "image_id": image.id,
                            "annotation_count": len(annotations)
                        })
                        
                        for annotation in annotations:
                            AnnotationOperations.create_annotation(
                                db=db,
                                image_id=new_image.id,
                                class_name=annotation.class_name,
                                class_id=annotation.class_id,
                                x_min=annotation.x_min,
                                y_min=annotation.y_min,
                                x_max=annotation.x_max,
                                y_max=annotation.y_max,
                                confidence=annotation.confidence,
                                segmentation=annotation.segmentation,
                                is_auto_generated=annotation.is_auto_generated,
                                model_id=annotation.model_id
                            )
                        
                        total_annotations_merged += len(annotations)
                        logger.debug("operations.annotations", f"Annotations copied successfully", "annotations_copy_success", {
                            "image_id": image.id,
                            "annotation_count": len(annotations)
                        })
                
                total_datasets_merged += 1
        
        # Get final statistics for the merged project
        logger.debug("app.database", f"Fetching final statistics for merged project", "merged_project_stats_fetch", {
            "merged_project_id": merged_project.id
        })
        
        merged_datasets = DatasetOperations.get_datasets_by_project(db, merged_project.id)
        total_datasets = len(merged_datasets)
        total_images = sum(dataset.total_images for dataset in merged_datasets)
        labeled_images = sum(dataset.labeled_images for dataset in merged_datasets)
        
        logger.info("operations.operations", f"Project merge completed successfully", "project_merge_completed", {
            "source_project_id": source_project_id,
            "source_project_name": source_project.name,
            "target_project_id": request.target_project_id,
            "target_project_name": target_project.name,
            "merged_project_id": merged_project.id,
            "merged_project_name": request.merged_project_name,
            "total_datasets_merged": total_datasets_merged,
            "total_images_merged": total_images_merged,
            "total_annotations_merged": total_annotations_merged,
            "final_total_datasets": total_datasets,
            "final_total_images": total_images,
            "final_labeled_images": labeled_images
        })
        
        return ProjectResponse(
            id=merged_project.id,
            name=merged_project.name,
            description=merged_project.description,
            project_type=merged_project.project_type,
            default_model_id=merged_project.default_model_id,
            confidence_threshold=merged_project.confidence_threshold,
            iou_threshold=merged_project.iou_threshold,
            created_at=merged_project.created_at,
            updated_at=merged_project.updated_at,
            total_datasets=total_datasets,
            total_images=total_images,
            labeled_images=labeled_images
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Project merge operation failed", "project_merge_failure", {
            "source_project_id": source_project_id,
            "target_project_id": request.target_project_id,
            "merged_project_name": request.merged_project_name,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to merge projects: {str(e)}")


@router.get("/{project_id}/stats")
async def get_project_stats(project_id: str, db: Session = Depends(get_db)):
    """Get detailed statistics for a project"""
    logger.info("app.backend", f"Starting project statistics retrieval", "project_stats_start", {
        "project_id": project_id,
        "endpoint": f"/projects/{project_id}/stats"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project statistics validation successful", "project_stats_validated", {
            "project_name": project.name,
            "project_id": project_id
        })
        
        # Get datasets
        logger.debug("app.database", f"Fetching datasets for project {project_id}", "datasets_fetch", {
            "project_id": project_id
        })
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        logger.debug("operations.operations", f"Found {len(datasets)} datasets for statistics calculation", "datasets_count_found", {
            "project_id": project_id,
            "dataset_count": len(datasets)
        })
        
        # Calculate detailed statistics
        total_datasets = len(datasets)
        total_images = sum(dataset.total_images for dataset in datasets)
        labeled_images = sum(dataset.labeled_images for dataset in datasets)
        unlabeled_images = sum(dataset.unlabeled_images for dataset in datasets)
        
        # Calculate progress percentage
        progress_percentage = (labeled_images / total_images * 100) if total_images > 0 else 0
        
        logger.debug("operations.operations", f"Calculated project statistics", "project_stats_calculated", {
            "project_id": project_id,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "unlabeled_images": unlabeled_images,
            "progress_percentage": progress_percentage
        })
        
        # Dataset breakdown
        logger.debug("operations.operations", f"Processing dataset breakdown statistics", "dataset_breakdown_start", {
            "project_id": project_id,
            "dataset_count": len(datasets)
        })
        
        dataset_stats = []
        for dataset in datasets:
            dataset_progress = (dataset.labeled_images / dataset.total_images * 100) if dataset.total_images > 0 else 0
            dataset_stats.append({
                "id": dataset.id,
                "name": dataset.name,
                "total_images": dataset.total_images,
                "labeled_images": dataset.labeled_images,
                "progress_percentage": round(dataset_progress, 1)
            })
        
        logger.info("operations.operations", f"Project statistics retrieved successfully", "project_stats_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "unlabeled_images": unlabeled_images,
            "progress_percentage": round(progress_percentage, 1),
            "dataset_breakdown_count": len(dataset_stats)
        })
        
        return {
            "project_id": project_id,
            "project_name": project.name,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "unlabeled_images": unlabeled_images,
            "progress_percentage": round(progress_percentage, 1),
            "dataset_breakdown": dataset_stats,
            "default_model_id": project.default_model_id,
            "confidence_threshold": project.confidence_threshold,
            "iou_threshold": project.iou_threshold
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Project statistics retrieval failed", "project_stats_failure", {
            "project_id": project_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get project stats: {str(e)}")


@router.post("/{project_id}/upload")
async def upload_images_to_project(
    project_id: str,
    file: UploadFile = File(...),
    batch_name: str = Form(None),
    tags: str = Form("[]"),
    db: Session = Depends(get_db)
):
    """Upload images directly to a project"""
    logger.info("app.backend", f"Starting single image upload to project", "image_upload_start", {
        "project_id": project_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "batch_name": batch_name,
        "tags": tags,
        "endpoint": f"/projects/{project_id}/upload"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project validation successful for image upload", "project_upload_validation", {
            "project_name": project.name,
            "project_id": project_id
        })
        
        # Validate file type
        logger.debug("operations.images", f"Validating file type", "file_type_validation", {
            "filename": file.filename,
            "content_type": file.content_type
        })
        
        if not file.content_type or not file.content_type.startswith('image/'):
            logger.warning("errors.validation", f"Invalid file type for upload", "invalid_file_type", {
                "filename": file.filename,
                "content_type": file.content_type
            })
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Parse tags
        logger.debug("operations.operations", f"Parsing tags for dataset selection", "tags_parsing", {
            "tags": tags
        })
        
        try:
            tags_list = json.loads(tags) if tags else []
        except json.JSONDecodeError:
            logger.warning("errors.validation", f"Failed to parse tags JSON", "tags_json_parse_error", {
                "tags": tags
            })
            tags_list = []
        
        # Determine dataset name: use selected tag (existing dataset) or batch_name (new dataset)
        if tags_list and len(tags_list) > 0:
            # User selected existing dataset from tags dropdown
            default_dataset_name = tags_list[0]  # Use first selected tag as dataset name
            logger.debug("operations.datasets", f"Using existing dataset from tags", "existing_dataset_selected", {
                "dataset_name": default_dataset_name,
                "tags_list": tags_list
            })
        else:
            # User entered new batch name - require it to be provided
            if not batch_name or not batch_name.strip():
                logger.warning("errors.validation", f"Batch name required but not provided", "batch_name_missing", {
                    "batch_name": batch_name,
                    "tags_list": tags_list
                })
                raise HTTPException(status_code=400, detail="Batch name is required when not using existing dataset")
            default_dataset_name = batch_name.strip()
            logger.debug("operations.datasets", f"Using new batch name for dataset", "new_batch_name_used", {
                "dataset_name": default_dataset_name,
                "batch_name": batch_name
            })
        
        logger.info("operations.datasets", f"Dataset name determined for upload", "dataset_name_determined", {
            "dataset_name": default_dataset_name,
            "source": "tags" if tags_list else "batch_name"
        })
        
        # Use path_manager for consistent path handling
        from utils.path_utils import path_manager
        
        # Use original filename (sanitized) - extract just the basename without path
        import re
        from pathlib import Path
        
        # Extract just the filename without any path components
        base_filename = Path(file.filename).name
        safe_filename = re.sub(r'[^\w\-_\.]', '_', base_filename)
        
        logger.debug("operations.images", f"Filename processed for upload", "filename_processing", {
            "original_filename": file.filename,
            "base_filename": base_filename,
            "safe_filename": safe_filename
        })
        
        # Get proper storage path: projects/{project}/{dataset}/unassigned/
        storage_path = path_manager.get_image_storage_path(project.name, default_dataset_name, "unassigned")
        path_manager.ensure_directory_exists(storage_path)
        
        logger.debug("operations.operations", f"Storage path prepared", "storage_path_prepared", {
            "storage_path": str(storage_path),
            "project_name": project.name,
            "dataset_name": default_dataset_name
        })
        
        # Full file path for saving
        file_path = storage_path / safe_filename
        
        # Relative path for database (for static serving)
        relative_path = path_manager.get_relative_image_path(project.name, default_dataset_name, safe_filename, "unassigned")
        
        logger.debug("operations.images", f"File paths prepared", "file_paths_prepared", {
            "full_file_path": str(file_path),
            "relative_path": relative_path
        })
        
        # Read and validate image
        logger.debug("operations.images", f"Reading and validating image file", "image_validation_start", {
            "filename": file.filename,
            "file_size": file.size if hasattr(file, 'size') else "unknown"
        })
        
        contents = await file.read()
        try:
            image = Image.open(io.BytesIO(contents))
            width, height = image.size
            image_format = image.format
            
            logger.debug("operations.images", f"Image validation successful", "image_validation_success", {
                "width": width,
                "height": height,
                "format": image_format,
                "file_size": len(contents)
            })
        except Exception as e:
            logger.error("errors.validation", f"Image validation failed", "image_validation_failure", {
                "filename": file.filename,
                "error": str(e)
            })
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Save file
        logger.debug("operations.images", f"Saving image file to storage", "image_save_start", {
            "file_path": str(file_path),
            "file_size": len(contents)
        })
        
        with open(str(file_path), "wb") as f:
            f.write(contents)
        
        logger.info("operations.images", f"Image file saved successfully", "image_save_success", {
            "file_path": str(file_path),
            "file_size": len(contents)
        })
        
        # Check if dataset with this name already exists
        logger.debug("app.database", f"Checking for existing dataset", "existing_dataset_check", {
            "project_id": project_id,
            "dataset_name": default_dataset_name
        })
        
        existing_datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        target_dataset = None
        for dataset in existing_datasets:
            if dataset.name == default_dataset_name:
                target_dataset = dataset
                break
        
        # Create new dataset if not found
        if not target_dataset:
            logger.info("operations.datasets", f"Creating new dataset for upload", "new_dataset_creation", {
                "dataset_name": default_dataset_name,
                "project_id": project_id,
                "project_name": project.name
            })
            
            target_dataset = DatasetOperations.create_dataset(
                db=db,
                name=default_dataset_name,
                description=f"Images uploaded to {project.name}",
                project_id=project_id
            )
            
            logger.info("operations.datasets", f"New dataset created successfully", "new_dataset_created", {
                "dataset_id": target_dataset.id,
                "dataset_name": target_dataset.name,
                "project_id": project_id
            })
        else:
            logger.debug("operations.datasets", f"Using existing dataset for upload", "existing_dataset_used", {
                "dataset_id": target_dataset.id,
                "dataset_name": target_dataset.name
            })
        
        # Create image record in database with RELATIVE path for static serving
        logger.debug("app.database", f"Creating image record in database", "image_record_creation", {
            "filename": safe_filename,
            "dataset_id": target_dataset.id,
            "file_path": relative_path
        })
        
        image_record = ImageOperations.create_image(
            db=db,
            filename=safe_filename,
            original_filename=base_filename,
            file_path=relative_path,  # Use relative path for database
            dataset_id=target_dataset.id,
            width=width,
            height=height,
            file_size=len(contents),
            format=image_format
        )
        
        logger.info("operations.images", f"Image record created successfully in database", "image_record_created", {
            "image_id": image_record.id,
            "filename": safe_filename,
            "dataset_id": target_dataset.id,
            "width": width,
            "height": height,
            "format": image_format
        })
        
        # Update dataset statistics
        logger.debug("operations.datasets", f"Updating dataset statistics", "dataset_stats_update", {
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name
        })
        
        DatasetOperations.update_dataset_stats(db, target_dataset.id)
        
        logger.info("operations.operations", f"Image upload completed successfully", "image_upload_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "image_id": image_record.id,
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name,
            "filename": file.filename,
            "file_size": len(contents),
            "width": width,
            "height": height,
            "format": image_format
        })
        
        return {
            "success": True,
            "message": f"Successfully uploaded {file.filename}",
            "image_id": image_record.id,
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name,
            "file_path": file_path,
            "tags": tags_list,
            "batch_name": default_dataset_name,
            "image_info": {
                "width": width,
                "height": height,
                "format": image_format,
                "size": len(contents)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Image upload operation failed", "image_upload_failure", {
            "project_id": project_id,
            "filename": file.filename if file else "unknown",
            "error": str(e)
        })
        
        # Clean up file if it was created
        if 'file_path' in locals() and file_path.exists():
            try:
                os.remove(file_path)
                logger.debug("operations.images", f"Cleaned up failed upload file", "failed_upload_cleanup", {
                    "file_path": str(file_path)
                })
            except:
                logger.warning("errors.system", f"Failed to clean up failed upload file", "cleanup_failure", {
                    "file_path": str(file_path)
                })
        
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@router.post("/{project_id}/upload-bulk")
async def upload_multiple_images_to_project(
    project_id: str,
    files: List[UploadFile] = File(...),
    batch_name: str = Form(None),
    tags: str = Form("[]"),
    db: Session = Depends(get_db)
):
    """Upload multiple images to a project"""
    logger.info("app.backend", f"Starting bulk image upload to project", "bulk_image_upload_start", {
        "project_id": project_id,
        "file_count": len(files),
        "batch_name": batch_name,
        "tags": tags,
        "endpoint": f"/projects/{project_id}/upload-bulk"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project validation successful for bulk upload", "project_bulk_upload_validation", {
            "project_name": project.name,
            "project_id": project_id,
            "file_count": len(files)
        })
        
        # Parse tags
        logger.debug("operations.operations", f"Parsing tags for dataset selection", "tags_parsing", {
            "tags": tags
        })
        
        try:
            tags_list = json.loads(tags) if tags else []
        except json.JSONDecodeError:
            logger.warning("errors.validation", f"Failed to parse tags JSON", "tags_json_parse_error", {
                "tags": tags
            })
            tags_list = []
        
        # Determine dataset name: use selected tag (existing dataset) or batch_name (new dataset)
        if tags_list and len(tags_list) > 0:
            # User selected existing dataset from tags dropdown
            default_dataset_name = tags_list[0]  # Use first selected tag as dataset name
            logger.debug("operations.datasets", f"Using existing dataset from tags", "existing_dataset_selected", {
                "dataset_name": default_dataset_name,
                "tags_list": tags_list
            })
        else:
            # User entered new batch name - require it to be provided
            if not batch_name or not batch_name.strip():
                logger.warning("errors.validation", f"Batch name required but not provided", "batch_name_missing", {
                    "batch_name": batch_name,
                    "tags_list": tags_list
                })
                raise HTTPException(status_code=400, detail="Batch name is required when not using existing dataset")
            default_dataset_name = batch_name.strip()
            logger.debug("operations.datasets", f"Using new batch name for dataset", "new_batch_name_used", {
                "dataset_name": default_dataset_name,
                "batch_name": batch_name
            })
        
        logger.info("operations.datasets", f"Dataset name determined for bulk upload", "dataset_name_determined", {
            "dataset_name": default_dataset_name,
            "source": "tags" if tags_list else "batch_name"
        })
        
        # Create project and dataset upload directories
        logger.debug("operations.operations", f"Creating upload directories", "upload_directories_creation", {
            "project_name": project.name,
            "dataset_name": default_dataset_name
        })
        
        project_upload_dir = get_project_path(project.name)
        dataset_upload_dir = project_upload_dir / "unassigned" / default_dataset_name
        dataset_upload_dir.mkdir(parents=True, exist_ok=True)
        
        logger.debug("operations.operations", f"Upload directories created successfully", "upload_directories_created", {
            "project_upload_dir": str(project_upload_dir),
            "dataset_upload_dir": str(dataset_upload_dir)
        })
        
        # Check if dataset with this name already exists
        logger.debug("app.database", f"Checking for existing dataset", "existing_dataset_check", {
            "project_id": project_id,
            "dataset_name": default_dataset_name
        })
        
        existing_datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        target_dataset = None
        for dataset in existing_datasets:
            if dataset.name == default_dataset_name:
                target_dataset = dataset
                break
        
        # Create new dataset if not found
        if not target_dataset:
            logger.info("operations.datasets", f"Creating new dataset for bulk upload", "new_dataset_creation", {
                "dataset_name": default_dataset_name,
                "project_id": project_id,
                "project_name": project.name
            })
            
            target_dataset = DatasetOperations.create_dataset(
                db=db,
                name=default_dataset_name,
                description=f"Images uploaded to {project.name}",
                project_id=project_id
            )
            
            logger.info("operations.datasets", f"New dataset created successfully for bulk upload", "new_dataset_created", {
                "dataset_id": target_dataset.id,
                "dataset_name": target_dataset.name,
                "project_id": project_id
            })
        else:
            logger.debug("operations.datasets", f"Using existing dataset for bulk upload", "existing_dataset_used", {
                "dataset_id": target_dataset.id,
                "dataset_name": target_dataset.name
            })
        
        # Process all files
        logger.info("operations.images", f"Starting bulk image processing", "bulk_image_processing_start", {
            "total_files": len(files),
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name
        })
        
        results = {
            'total_files': len(files),
            'successful_uploads': 0,
            'failed_uploads': 0,
            'uploaded_images': [],
            'errors': []
        }
        
        for index, file in enumerate(files):
            logger.debug("operations.images", f"Processing file {index + 1}/{len(files)}", "individual_file_processing", {
                "file_index": index + 1,
                "total_files": len(files),
                "filename": file.filename,
                "content_type": file.content_type
            })
            
            try:
                # Validate file type
                logger.debug("operations.images", f"Validating file type", "file_type_validation", {
                    "filename": file.filename,
                    "content_type": file.content_type
                })
                
                if not file.content_type or not file.content_type.startswith('image/'):
                    error_msg = f"File {file.filename} is not an image"
                    results['errors'].append(error_msg)
                    results['failed_uploads'] += 1
                    
                    logger.warning("errors.validation", f"Invalid file type for bulk upload", "invalid_file_type", {
                        "filename": file.filename,
                        "content_type": file.content_type,
                        "file_index": index + 1
                    })
                    continue
                
                # Use original filename (sanitized) - extract just the basename without path
                import re
                from pathlib import Path
                
                # Extract just the filename without any path components
                base_filename = Path(file.filename).name
                safe_filename = re.sub(r'[^\w\-_\.]', '_', base_filename)
                file_path = os.path.join(dataset_upload_dir, safe_filename)
                
                logger.debug("operations.images", f"Filename processed for bulk upload", "filename_processing", {
                    "original_filename": file.filename,
                    "base_filename": base_filename,
                    "safe_filename": safe_filename,
                    "file_path": file_path
                })
                
                # Read and validate image
                logger.debug("operations.images", f"Reading and validating image file", "image_validation_start", {
                    "filename": file.filename,
                    "file_index": index + 1
                })
                
                contents = await file.read()
                try:
                    image = Image.open(io.BytesIO(contents))
                    width, height = image.size
                    image_format = image.format
                    
                    logger.debug("operations.images", f"Image validation successful", "image_validation_success", {
                        "filename": file.filename,
                        "width": width,
                        "height": height,
                        "format": image_format,
                        "file_size": len(contents),
                        "file_index": index + 1
                    })
                except Exception as e:
                    error_msg = f"Invalid image file {file.filename}: {str(e)}"
                    results['errors'].append(error_msg)
                    results['failed_uploads'] += 1
                    
                    logger.error("errors.validation", f"Image validation failed for bulk upload", "image_validation_failure", {
                        "filename": file.filename,
                        "error": str(e),
                        "file_index": index + 1
                    })
                    continue
                
                # Save file
                logger.debug("operations.images", f"Saving image file to storage", "image_save_start", {
                    "file_path": file_path,
                    "file_size": len(contents),
                    "file_index": index + 1
                })
                
                with open(file_path, "wb") as f:
                    f.write(contents)
                
                logger.debug("operations.images", f"Image file saved successfully", "image_save_success", {
                    "file_path": file_path,
                    "file_size": len(contents),
                    "file_index": index + 1
                })
                
                # Create image record in database
                logger.debug("app.database", f"Creating image record in database", "image_record_creation", {
                    "filename": safe_filename,
                    "dataset_id": target_dataset.id,
                    "file_path": file_path,
                    "file_index": index + 1
                })
                
                image_record = ImageOperations.create_image(
                    db=db,
                    filename=safe_filename,
                    original_filename=base_filename,
                    file_path=file_path,
                    dataset_id=target_dataset.id,
                    width=width,
                    height=height,
                    file_size=len(contents),
                    format=image_format
                )
                
                logger.debug("operations.images", f"Image record created successfully", "image_record_created", {
                    "image_id": image_record.id,
                    "filename": safe_filename,
                    "dataset_id": target_dataset.id,
                    "file_index": index + 1
                })
                
                results['uploaded_images'].append({
                    'id': image_record.id,
                    'filename': image_record.filename,
                    'original_filename': image_record.original_filename,
                    'width': image_record.width,
                    'height': image_record.height,
                    'file_size': image_record.file_size
                })
                
                results['successful_uploads'] += 1
                
                logger.debug("operations.images", f"File processed successfully", "file_processing_success", {
                    "filename": file.filename,
                    "image_id": image_record.id,
                    "file_index": index + 1,
                    "successful_uploads": results['successful_uploads']
                })
                
            except Exception as e:
                error_msg = f"Failed to upload {file.filename}: {str(e)}"
                results['errors'].append(error_msg)
                results['failed_uploads'] += 1
                
                logger.error("errors.system", f"File processing failed for bulk upload", "file_processing_failure", {
                    "filename": file.filename,
                    "error": str(e),
                    "file_index": index + 1
                })
        
        # Update dataset statistics
        logger.debug("operations.datasets", f"Updating dataset statistics after bulk upload", "dataset_stats_update", {
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name,
            "successful_uploads": results['successful_uploads']
        })
        
        DatasetOperations.update_dataset_stats(db, target_dataset.id)
        
        logger.info("operations.operations", f"Bulk image upload completed successfully", "bulk_image_upload_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name,
            "total_files": results['total_files'],
            "successful_uploads": results['successful_uploads'],
            "failed_uploads": results['failed_uploads'],
            "error_count": len(results['errors'])
        })
        
        return {
            "success": True,
            "message": f"Successfully uploaded {results['successful_uploads']} of {results['total_files']} files",
            "dataset_id": target_dataset.id,
            "dataset_name": target_dataset.name,
            "tags": tags_list,
            "batch_name": default_dataset_name,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Bulk image upload operation failed", "bulk_image_upload_failure", {
            "project_id": project_id,
            "file_count": len(files) if files else 0,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to upload images: {str(e)}")


@router.get("/{project_id}/images")
async def get_project_images(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    split_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get images for a project with pagination and optional split_type filtering"""
    logger.info("app.backend", f"Starting project images retrieval", "project_images_retrieval_start", {
        "project_id": project_id,
        "limit": limit,
        "offset": offset,
        "split_type": split_type,
        "endpoint": f"/projects/{project_id}/images"
    })
    
    try:
        # Check if project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project validation successful for images retrieval", "project_images_validation", {
            "project_name": project.name,
            "project_id": project_id
        })
        
        # Get all datasets for this project
        logger.debug("app.database", f"Fetching datasets for project", "datasets_fetch_start", {
            "project_id": project_id
        })
        
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        logger.debug("operations.datasets", f"Datasets fetched successfully", "datasets_fetch_success", {
            "project_id": project_id,
            "dataset_count": len(datasets)
        })
        
        # Get images from all datasets, but only process datasets that have images
        logger.debug("operations.images", f"Starting image collection from datasets", "image_collection_start", {
            "project_id": project_id,
            "dataset_count": len(datasets)
        })
        
        all_images = []
        total_annotations = 0
        datasets_with_images = 0
        
        for dataset_index, dataset in enumerate(datasets):
            logger.debug("operations.datasets", f"Processing dataset {dataset_index + 1}/{len(datasets)}", "dataset_processing", {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "dataset_index": dataset_index + 1,
                "total_datasets": len(datasets)
            })
            
            images = ImageOperations.get_images_by_dataset(db, dataset.id)
            
            # Skip datasets with no images to prevent empty folders in frontend
            if len(images) == 0:
                logger.debug("operations.datasets", f"Skipping empty dataset", "empty_dataset_skipped", {
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.name,
                    "reason": "no_images_found"
                })
                continue
                
            datasets_with_images += 1
            logger.debug("operations.images", f"Images fetched for dataset", "dataset_images_fetched", {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "image_count": len(images)
            })
            
            for image_index, image in enumerate(images):
                # Filter by split_type if specified
                if split_type and hasattr(image, 'split_type') and image.split_type != split_type:
                    logger.debug("operations.images", f"Image filtered out by split_type", "image_split_type_filtered", {
                        "image_id": image.id,
                        "filename": image.filename,
                        "image_split_type": getattr(image, 'split_type', None),
                        "requested_split_type": split_type,
                        "dataset_name": dataset.name
                    })
                    continue
                    
                # Get annotations for this image to extract class names
                logger.debug("operations.annotations", f"Fetching annotations for image", "image_annotations_fetch", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "dataset_name": dataset.name
                })
                
                annotations = AnnotationOperations.get_annotations_by_image(db, image.id)
                annotation_data = []
                class_names = []
                
                for annotation in annotations:
                    annotation_info = {
                        "id": annotation.id,
                        "class_name": annotation.class_name,
                        "class_id": annotation.class_id,
                        "x_min": annotation.x_min,
                        "y_min": annotation.y_min,
                        "x_max": annotation.x_max,
                        "y_max": annotation.y_max,
                        "confidence": annotation.confidence,
                        "is_auto_generated": annotation.is_auto_generated
                    }
                    annotation_data.append(annotation_info)
                    if annotation.class_name and annotation.class_name not in class_names:
                        class_names.append(annotation.class_name)

                total_annotations += len(annotations)
                
                logger.debug("operations.images", f"Image data prepared", "image_data_prepared", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "annotation_count": len(annotations),
                    "class_names": class_names,
                    "dataset_name": dataset.name
                })

                all_images.append({
                    "id": image.id,
                    "filename": image.filename,
                    "original_filename": image.original_filename,
                    "file_path": image.file_path,
                    "dataset_id": image.dataset_id,
                    "dataset_name": dataset.name,
                    "width": image.width,
                    "height": image.height,
                    "file_size": image.file_size,
                    "format": image.format,
                    "split_type": getattr(image, 'split_type', None),
                    "split_section": getattr(image, 'split_section', None),
                    "is_labeled": getattr(image, 'is_labeled', False),
                    "has_annotation": getattr(image, 'is_labeled', False),
                    "annotation_status": "labeled" if getattr(image, 'is_labeled', False) else "unlabeled",
                    "annotations": annotation_data,
                    "class_names": class_names,
                    "created_at": image.created_at,
                    "updated_at": image.updated_at
                })
        
        logger.info("operations.images", f"Image collection completed", "image_collection_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "total_images": len(all_images),
            "total_annotations": total_annotations,
            "total_datasets": len(datasets),
            "datasets_with_images": datasets_with_images,
            "empty_datasets_skipped": len(datasets) - datasets_with_images
        })
        
        # Apply pagination
        logger.debug("operations.operations", f"Applying pagination to results", "pagination_application", {
            "total_images": len(all_images),
            "limit": limit,
            "offset": offset
        })
        
        total_images = len(all_images)
        paginated_images = all_images[offset:offset + limit]
        
        logger.info("operations.operations", f"Project images retrieval completed successfully", "project_images_retrieval_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "total_images": total_images,
            "returned_images": len(paginated_images),
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total_images,
            "split_type_filter": split_type,
            "datasets_with_images": datasets_with_images,
            "empty_datasets_filtered": len(datasets) - datasets_with_images
        })
        
        return {
            "images": paginated_images,
            "total": total_images,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total_images
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Project images retrieval operation failed", "project_images_retrieval_failure", {
            "project_id": project_id,
            "limit": limit,
            "offset": offset,
            "split_type": split_type,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get project images: {str(e)}")


@router.put("/{project_id}/datasets/{dataset_id}/move-to-unassigned")
async def move_dataset_to_unassigned(
    project_id: str,
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Move a dataset from any workflow folder to unassigned status"""
    logger.info("app.backend", f"Starting dataset move to unassigned operation", "dataset_move_to_unassigned_start", {
        "project_id": project_id,
        "dataset_id": dataset_id,
        "endpoint": f"/projects/{project_id}/datasets/{dataset_id}/move-to-unassigned"
    })
    
    try:
        # Verify project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Verify dataset exists and belongs to project
        logger.debug("app.database", f"Checking if dataset {dataset_id} exists and belongs to project", "dataset_existence_check", {
            "project_id": project_id,
            "dataset_id": dataset_id
        })
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset or dataset.project_id != int(project_id):
            logger.warning("errors.validation", f"Dataset {dataset_id} not found or doesn't belong to project", "dataset_not_found_or_mismatch", {
                "project_id": project_id,
                "dataset_id": dataset_id,
                "dataset_project_id": dataset.project_id if dataset else None
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        logger.info("operations.operations", f"Project and dataset validation successful", "project_dataset_validation", {
            "project_name": project.name,
            "project_id": project_id,
            "dataset_name": dataset.name,
            "dataset_id": dataset_id
        })
        
        # Find the current location of the dataset folder
        logger.debug("operations.operations", f"Determining current dataset location", "dataset_location_determination", {
            "project_name": project.name,
            "dataset_name": dataset.name
        })
        
        project_folder = get_project_path(project.name)
        unassigned_folder = project_folder / "unassigned" / dataset.name
        
        # Check all possible workflow folders for the dataset
        workflow_folders = ["annotating", "dataset", "unassigned"]
        current_folder = None
        current_workflow = None
        
        for workflow in workflow_folders:
            potential_folder = Path(os.path.join(project_folder, workflow, dataset.name))
            if potential_folder.exists():
                current_folder = potential_folder
                current_workflow = workflow
                break
        
        logger.debug("operations.operations", f"Current dataset location identified", "current_location_identified", {
            "current_folder": str(current_folder) if current_folder else None,
            "current_workflow": current_workflow,
            "workflow_folders_checked": workflow_folders
        })
        
        # If dataset is not found in any workflow folder, try to find it by checking image paths
        if not current_folder:
            logger.debug("operations.operations", f"Dataset folder not found in workflow folders, checking image paths", "image_path_location_check", {
                "project_name": project.name,
                "dataset_name": dataset.name
            })
            
            images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=1)
            if images:
                image_path = images[0].file_path
                logger.debug("operations.images", f"Using image path to determine location", "image_path_location_analysis", {
                    "image_path": image_path,
                    "dataset_name": dataset.name
                })
                
                # Extract the actual folder name from the image path
                for workflow in workflow_folders:
                    if f"/{workflow}/" in image_path:
                        # Extract the actual folder name from the path
                        path_parts = image_path.split(f"/{workflow}/")
                        if len(path_parts) > 1:
                            folder_name = path_parts[1].split('/')[0]
                            potential_folder = Path(os.path.join(project_folder, workflow, folder_name))
                            if potential_folder.exists():
                                current_folder = potential_folder
                                current_workflow = workflow
                                logger.debug("operations.operations", f"Dataset location found via image path", "image_path_location_found", {
                                    "workflow": workflow,
                                    "folder_name": folder_name,
                                    "current_folder": str(current_folder)
                                })
                                break
        
        if not current_folder:
            logger.error("errors.validation", f"Dataset folder not found in any location", "dataset_folder_not_found", {
                "project_name": project.name,
                "dataset_name": dataset.name,
                "workflow_folders_checked": workflow_folders
            })
            raise HTTPException(status_code=404, detail=f"Dataset folder not found for '{dataset.name}'")
        
        # If already in unassigned, no need to move
        if current_workflow == "unassigned":
            logger.info("operations.operations", f"Dataset already in unassigned, no move needed", "dataset_already_unassigned", {
                "dataset_name": dataset.name,
                "dataset_id": dataset_id,
                "current_workflow": current_workflow
            })
            return {"message": f"Dataset '{dataset.name}' is already in unassigned", "dataset": dataset}
        
        logger.info("operations.operations", f"Dataset move operation confirmed", "dataset_move_confirmed", {
            "dataset_name": dataset.name,
            "dataset_id": dataset_id,
            "from_workflow": current_workflow,
            "to_workflow": "unassigned"
        })
        
        # Create unassigned directory if it doesn't exist
        logger.debug("operations.operations", f"Creating unassigned directory", "unassigned_directory_creation", {
            "unassigned_folder": str(unassigned_folder)
        })
        
        unassigned_folder.mkdir(parents=True, exist_ok=True)
        
        # Get all images for this dataset
        logger.debug("operations.images", f"Fetching all images for dataset", "dataset_images_fetch", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })
        
        images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=10000)
        
        logger.info("operations.images", f"Images fetched for dataset move operation", "images_fetched_for_move", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "image_count": len(images)
        })
        
        # Handle different source folder structures
        if current_workflow == "dataset":
            logger.info("operations.operations", f"Processing dataset workflow move (train/val/test subfolders)", "dataset_workflow_move_start", {
                "current_workflow": current_workflow,
                "image_count": len(images)
            })
            
            # For dataset, we need to handle train/val/test subfolders
            for image_index, image in enumerate(images):
                logger.debug("operations.images", f"Processing image {image_index + 1}/{len(images)} for dataset workflow move", "individual_image_dataset_move", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "image_index": image_index + 1,
                    "total_images": len(images)
                })
                
                # Get the current image file path
                source_path = Path("..") / image.file_path
                
                # Create the target path in unassigned
                target_path = unassigned_folder / image.filename
                
                # Copy the file if it exists
                if source_path.exists():
                    try:
                        shutil.copy2(source_path, target_path)
                        logger.debug("operations.images", f"Image copied successfully for dataset workflow move", "image_copy_success", {
                            "source_path": str(source_path),
                            "target_path": str(target_path),
                            "image_filename": image.filename
                        })
                    except Exception as e:
                        logger.error("errors.system", f"Error copying file for dataset workflow move", "image_copy_failure", {
                            "source_path": str(source_path),
                            "target_path": str(target_path),
                            "image_filename": image.filename,
                            "error": str(e)
                        })
                else:
                    logger.warning("errors.validation", f"Source file not found for dataset workflow move", "source_file_not_found", {
                        "source_path": str(source_path),
                        "image_filename": image.filename
                    })
                
                # Update the database path but KEEP the original split_section
                old_path = image.file_path
                split_section = image.split_section  # Save the original split_section
                new_path = f"projects/{project.name}/unassigned/{dataset.name}/{image.filename}"
                
                logger.debug("operations.images", f"Updating image database record for dataset workflow move", "image_database_update", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "old_path": old_path,
                    "new_path": new_path,
                    "split_section": split_section
                })
                
                # Update image properties directly without individual commits
                image.file_path = new_path
                image.split_type = "unassigned"  # Update split_type to unassigned
                # Don't change the split_section, keep it as train/val/test
                image.updated_at = datetime.utcnow()
            
            # Now remove the original dataset folder with all its subfolders
            logger.info("operations.operations", f"Removing original dataset folder after copying", "original_folder_removal", {
                "current_folder": str(current_folder),
                "workflow": current_workflow
            })
            
            try:
                shutil.rmtree(str(current_folder))
                logger.info("operations.operations", f"Original dataset folder removed successfully", "original_folder_removed", {
                    "removed_folder": str(current_folder)
                })
            except Exception as e:
                logger.error("errors.system", f"Error removing original dataset folder", "original_folder_removal_failure", {
                    "folder_path": str(current_folder),
                    "error": str(e)
                })
        else:
            logger.info("operations.operations", f"Processing {current_workflow} workflow move", "other_workflow_move_start", {
                "current_workflow": current_workflow,
                "image_count": len(images)
            })
            
            # For annotating or other workflows, move the entire folder
            try:
                # If unassigned folder already exists, we need to move files individually
                if unassigned_folder.exists():
                    logger.debug("operations.operations", f"Unassigned folder exists, copying files individually", "individual_file_copy_start", {
                        "source_folder": str(current_folder),
                        "target_folder": str(unassigned_folder)
                    })
                    
                    # Copy all files from current folder to unassigned
                    for filename in os.listdir(current_folder):
                        source_path = Path(os.path.join(current_folder, filename))
                        target_path = Path(os.path.join(unassigned_folder, filename))
                        
                        if os.path.isfile(source_path):
                            try:
                                shutil.copy2(source_path, target_path)
                                logger.debug("operations.images", f"File copied successfully", "file_copy_success", {
                                    "source_path": str(source_path),
                                    "target_path": str(target_path),
                                    "filename": filename
                                })
                            except Exception as e:
                                logger.error("errors.system", f"Error copying file", "file_copy_failure", {
                                    "source_path": str(source_path),
                                    "target_path": str(target_path),
                                    "filename": filename,
                                    "error": str(e)
                                })
                    
                    # Remove the original folder
                    logger.debug("operations.operations", f"Removing original folder after copying files", "original_folder_removal_after_copy", {
                        "folder_path": str(current_folder)
                    })
                    
                    shutil.rmtree(str(current_folder))
                    logger.info("operations.operations", f"Original folder removed after copying files", "original_folder_removed_after_copy", {
                        "removed_folder": str(current_folder)
                    })
                else:
                    # Move the entire folder if unassigned doesn't exist yet
                    logger.debug("operations.operations", f"Moving entire dataset folder", "entire_folder_move", {
                        "source_folder": str(current_folder),
                        "target_folder": str(unassigned_folder)
                    })
                    
                    shutil.move(str(current_folder), unassigned_folder)
                    logger.info("operations.operations", f"Dataset folder moved successfully", "folder_move_success", {
                        "source_folder": str(current_folder),
                        "target_folder": str(unassigned_folder)
                    })
            except Exception as e:
                logger.error("errors.system", f"Error moving folder", "folder_move_failure", {
                    "source_folder": str(current_folder),
                    "target_folder": str(unassigned_folder),
                    "error": str(e)
                })
            
            # Update file paths in database but preserve split_section
            logger.debug("operations.images", f"Updating image database records for {current_workflow} workflow move", "image_database_update_workflow", {
                "workflow": current_workflow,
                "image_count": len(images)
            })
            
            for image in images:
                old_path = image.file_path
                split_section = image.split_section  # Save the original split_section
                
                # Use path_manager to generate correct relative path
                new_path = path_manager.get_relative_image_path(
                    project.name, dataset.name, image.filename, "unassigned"
                )
                
                logger.debug("operations.images", f"Updating individual image record", "individual_image_update", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "old_path": old_path,
                    "new_path": new_path,
                    "split_section": split_section
                })
                
                # Update image properties directly without individual commits
                image.file_path = new_path
                image.split_type = "unassigned"  # Update split_type to unassigned
                # Don't change the split_section, keep it as is
                image.updated_at = datetime.utcnow()
        
        # Commit all image updates at once
        logger.info("app.database", f"Committing all image updates to database", "database_commit_start", {
            "image_count": len(images),
            "dataset_id": dataset_id
        })
        
        db.commit()
        
        logger.info("app.database", f"Database commit completed successfully", "database_commit_success", {
            "committed_updates": len(images),
            "dataset_id": dataset_id
        })
        
        # Update the is_labeled flag in the database to match reality
        logger.debug("operations.images", f"Updating image labeled status flags", "image_status_update_start", {
            "image_count": len(images),
            "dataset_id": dataset_id
        })
        
        for image in images:
            if image.is_labeled:
                # Ensure the database flag matches the actual state
                ImageOperations.update_image_status(db, image.id, is_labeled=True)
        
        # Update dataset statistics based on actual database state
        logger.debug("operations.datasets", f"Updating dataset statistics after move operation", "dataset_stats_update", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })
        
        updated_dataset = DatasetOperations.update_dataset_stats(db, dataset_id)
        
        logger.info("operations.operations", f"Dataset move to unassigned completed successfully", "dataset_move_to_unassigned_completed", {
            "project_id": project_id,
            "project_name": project.name,
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "from_workflow": current_workflow,
            "to_workflow": "unassigned",
            "image_count": len(images),
            "unassigned_folder": str(unassigned_folder)
        })
        
        return {"message": f"Dataset '{dataset.name}' moved to unassigned", "dataset": updated_dataset}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Dataset move to unassigned operation failed", "dataset_move_to_unassigned_failure", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to move dataset to unassigned: {str(e)}")


@router.put("/{project_id}/datasets/{dataset_id}/move-to-completed")
async def move_dataset_to_completed(
    project_id: str,
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Move a dataset from annotating to completed/dataset status"""
    logger.info("app.backend", f"Starting dataset move to completed operation", "dataset_move_to_completed_start", {
        "project_id": project_id,
        "dataset_id": dataset_id,
        "endpoint": f"/projects/{project_id}/datasets/{dataset_id}/move-to-completed"
    })
    
    try:
        # Verify project exists
        logger.debug("app.database", f"Checking if project {project_id} exists", "project_existence_check", {
            "project_id": project_id
        })
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            logger.warning("errors.validation", f"Project {project_id} not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Verify dataset exists and belongs to project
        logger.debug("app.database", f"Checking if dataset {dataset_id} exists and belongs to project", "dataset_existence_check", {
            "project_id": project_id,
            "dataset_id": dataset_id
        })
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset or dataset.project_id != int(project_id):
            logger.warning("errors.validation", f"Dataset {dataset_id} not found or doesn't belong to project", "dataset_not_found_or_mismatch", {
                "project_id": project_id,
                "dataset_id": dataset_id,
                "dataset_project_id": dataset.project_id if dataset else None
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        logger.info("operations.operations", f"Project and dataset validation successful", "project_dataset_validation", {
            "project_name": project.name,
            "project_id": project_id,
            "dataset_name": dataset.name,
            "dataset_id": dataset_id
        })
        
        # CRITICAL: Check if ALL images are labeled before allowing move to dataset
        # Get the actual count of labeled images directly from the database
        logger.debug("operations.images", f"Checking labeling status for all images", "image_labeling_status_check", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })
        
        images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=10000)
        labeled_count = sum(1 for img in images if img.is_labeled)
        
        logger.info("operations.images", f"Image labeling status verified", "image_labeling_status_verified", {
            "dataset_id": dataset_id,
            "total_images": len(images),
            "labeled_count": labeled_count,
            "unlabeled_count": len(images) - labeled_count
        })
        
        # Check if dataset has any images at all
        if len(images) == 0:
            logger.warning("errors.validation", f"Cannot move empty dataset to completed", "empty_dataset_blocking_move", {
                "dataset_id": dataset_id,
                "dataset_name": dataset.name,
                "total_images": 0
            })
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot move empty dataset to completed. Please add and label images first."
            )
        
        # Check if all images are labeled
        if labeled_count < len(images):
            unlabeled_count = len(images) - labeled_count
            logger.warning("errors.validation", f"Cannot move dataset to completed - images still need labeling", "incomplete_labeling_blocking_move", {
                "dataset_id": dataset_id,
                "dataset_name": dataset.name,
                "total_images": len(images),
                "labeled_count": labeled_count,
                "unlabeled_count": unlabeled_count
            })
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot move to dataset: {unlabeled_count} images still need labeling. Please label all {len(images)} images first."
            )
        
        logger.info("operations.operations", f"Dataset move to completed operation confirmed", "dataset_move_to_completed_confirmed", {
            "dataset_name": dataset.name,
            "dataset_id": dataset_id,
            "total_images": len(images),
            "labeled_count": labeled_count
        })
        
        # Move physical files from annotating to dataset with train/val/test folders
        logger.debug("operations.operations", f"Preparing folder structure for dataset move", "folder_structure_preparation", {
            "project_name": project.name,
            "dataset_name": dataset.name
        })
        
        project_folder = get_project_path(project.name)
        annotating_folder = project_folder / "annotating" / dataset.name
        dataset_folder = project_folder / "dataset" / dataset.name
        
        if annotating_folder.exists():
            logger.info("operations.operations", f"Annotating folder exists, proceeding with move operation", "annotating_folder_move_start", {
                "annotating_folder": str(annotating_folder),
                "dataset_folder": str(dataset_folder)
            })
            
            # IMPORTANT: Only create the dataset folder after we've decided it's safe to proceed
            # This prevents partial/incomplete moves
            
            # Create train/val/test folders inside the dataset folder
            # We'll create the actual dataset folder first, then the split folders inside it
            logger.debug("operations.operations", f"Creating dataset folder structure", "dataset_folder_creation", {
                "dataset_folder": str(dataset_folder)
            })
            
            dataset_folder.mkdir(parents=True, exist_ok=True)
            
            train_folder = dataset_folder / "train"
            val_folder = dataset_folder / "val"
            test_folder = dataset_folder / "test"
            
            train_folder.mkdir(parents=True, exist_ok=True)
            val_folder.mkdir(parents=True, exist_ok=True)
            test_folder.mkdir(parents=True, exist_ok=True)
            
            logger.info("operations.operations", f"Split folders created successfully", "split_folders_created", {
                "train_folder": str(train_folder),
                "val_folder": str(val_folder),
                "test_folder": str(test_folder)
            })
            
            # Get all images for this dataset
            logger.debug("operations.images", f"Fetching all images for dataset move operation", "dataset_images_fetch", {
                "dataset_id": dataset_id,
                "dataset_name": dataset.name
            })
            
            images = ImageOperations.get_images_by_dataset(db, dataset_id, skip=0, limit=10000)
            
            logger.info("operations.images", f"Images fetched for dataset move to completed", "images_fetched_for_completed_move", {
                "dataset_id": dataset_id,
                "dataset_name": dataset.name,
                "image_count": len(images)
            })
            
            # Move each image to the appropriate split folder
            logger.info("operations.images", f"Starting image move to split folders", "image_move_to_splits_start", {
                "image_count": len(images),
                "dataset_name": dataset.name
            })
            
            for image_index, image in enumerate(images):
                logger.debug("operations.images", f"Processing image {image_index + 1}/{len(images)} for completed move", "individual_image_completed_move", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "image_index": image_index + 1,
                    "total_images": len(images)
                })
                
                # Get the current image file path
                source_path = Path("..") / image.file_path
                
                # Determine the target split folder based on database split_section
                split_section = image.split_section
                if split_section not in ["train", "val", "test"]:
                    # Default to train if no split is assigned
                    logger.debug("operations.images", f"Using default split section for image", "default_split_section_used", {
                        "image_id": image.id,
                        "filename": image.filename,
                        "original_split_section": split_section,
                        "defaulted_to": "train"
                    })
                    split_section = "train"
                
                # Create the target folder path
                target_folder = dataset_folder / split_section
                target_path = target_folder / image.filename
                
                # Ensure the target folder exists
                target_folder.mkdir(parents=True, exist_ok=True)
                
                logger.debug("operations.images", f"Target path prepared for image move", "target_path_prepared", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "split_section": split_section,
                    "target_path": str(target_path)
                })
                
                # Move the file if it exists
                if source_path.exists():
                    try:
                        shutil.copy2(source_path, target_path)
                        logger.debug("operations.images", f"Image copied successfully to completed dataset", "image_copy_to_completed_success", {
                            "source_path": str(source_path),
                            "target_path": str(target_path),
                            "image_filename": image.filename,
                            "split_section": split_section
                        })
                    except Exception as e:
                        logger.error("errors.system", f"Error copying file to completed dataset", "image_copy_to_completed_failure", {
                            "source_path": str(source_path),
                            "target_path": str(target_path),
                            "image_filename": image.filename,
                            "split_section": split_section,
                            "error": str(e)
                        })
                else:
                    logger.warning("errors.validation", f"Source file not found for completed move", "source_file_not_found_completed", {
                        "source_path": str(source_path),
                        "image_filename": image.filename
                    })
                
                # Update the database path
                old_path = image.file_path
                # Make sure the path includes the split_section folder
                new_path = f"projects/{project.name}/dataset/{dataset.name}/{split_section}/{image.filename}"
                
                logger.debug("operations.images", f"Updating image database record for completed move", "image_database_update_completed", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "old_path": old_path,
                    "new_path": new_path,
                    "split_section": split_section
                })
                
                # CRITICAL: First update the split type to dataset, this will preserve the split_section
                ImageOperations.update_image_split(db, image.id, "dataset")
                
                # THEN override the file path which might have been set incorrectly
                ImageOperations.update_image_path(db, image.id, new_path)
                
                logger.debug("operations.images", f"Image database record updated successfully", "image_database_update_completed_success", {
                    "image_id": image.id,
                    "filename": image.filename,
                    "split_type_updated": "dataset",
                    "path_updated": new_path,
                    "split_section_preserved": split_section
                })
            
            logger.info("operations.images", f"All images moved to completed dataset successfully", "all_images_moved_to_completed", {
                "dataset_id": dataset_id,
                "dataset_name": dataset.name,
                "image_count": len(images)
            })
            
            # Now that all files are copied, we can remove the original annotating folder
            logger.info("operations.operations", f"Removing original annotating folder", "annotating_folder_removal", {
                "annotating_folder": str(annotating_folder)
            })
            
            try:
                shutil.rmtree(str(annotating_folder))
                logger.info("operations.operations", f"Original annotating folder removed successfully", "annotating_folder_removed", {
                    "removed_folder": str(annotating_folder)
                })
            except Exception as e:
                logger.error("errors.system", f"Error removing original annotating folder", "annotating_folder_removal_failure", {
                    "folder_path": str(annotating_folder),
                    "error": str(e)
                })
                
            # IMPORTANT: Remove any direct files in the dataset folder
            # They should only be in the train/val/test subfolders
            logger.debug("operations.operations", f"Cleaning up duplicate files in dataset root", "duplicate_files_cleanup", {
                "dataset_folder": str(dataset_folder)
            })
            
            for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.gif"):
                for item in dataset_folder.glob(ext):
                    if item.is_file():
                        try:
                            item.unlink()
                            logger.debug("operations.images", f"Removed duplicate file from dataset root", "duplicate_file_removed", {
                                "file_path": str(item),
                                "extension": ext
                            })
                        except Exception as e:
                            logger.error("errors.system", f"Error removing duplicate file from dataset root", "duplicate_file_removal_failure", {
                                "file_path": str(item),
                                "error": str(e)
                            })
        
        # Update the is_labeled flag in the database to match reality
        logger.debug("operations.images", f"Updating image labeled status flags", "image_status_update_start", {
            "image_count": len(images),
            "dataset_id": dataset_id
        })
        
        for image in images:
            if image.is_labeled:
                # Ensure the database flag matches the actual state
                ImageOperations.update_image_status(db, image.id, is_labeled=True)
        
        # Update dataset statistics based on actual database state
        logger.debug("operations.datasets", f"Updating dataset statistics after completed move", "dataset_stats_update_completed", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })
        
        updated_dataset = DatasetOperations.update_dataset_stats(db, dataset_id)
        
        logger.info("operations.operations", f"Dataset move to completed completed successfully", "dataset_move_to_completed_success", {
            "project_id": project_id,
            "project_name": project.name,
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "total_images": len(images),
            "labeled_count": labeled_count,
            "dataset_folder": str(dataset_folder),
            "split_folders_created": ["train", "val", "test"]
        })
        
        return {"message": f"Dataset '{dataset.name}' moved to completed", "dataset": updated_dataset}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Dataset move to completed operation failed", "dataset_move_to_completed_failure", {
            "project_id": project_id,
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to move dataset to completed: {str(e)}")


@router.post("/migrate-paths")
async def migrate_paths_endpoint():
    """
    Manual path migration endpoint
    Fixes any problematic file paths in the database
    """
    logger.info("app.backend", f"Starting manual path migration operation", "path_migration_start", {
        "endpoint": "/migrate-paths",
        "operation": "manual_path_migration"
    })
    
    try:
        logger.debug("operations.operations", f"Importing migrate_paths module", "migrate_paths_import", {
            "module": "migrate_paths"
        })
        
        from migrate_paths import migrate_paths_if_needed
        
        logger.info("operations.operations", f"Path migration module imported successfully", "migrate_paths_import_success", {
            "module": "migrate_paths",
            "function": "migrate_paths_if_needed"
        })
        
        # Run migration
        logger.info("operations.operations", f"Executing path migration function", "path_migration_execution", {
            "function": "migrate_paths_if_needed"
        })
        
        migrate_paths_if_needed()
        
        logger.info("operations.operations", f"Path migration completed successfully", "path_migration_success", {
            "operation": "manual_path_migration",
            "status": "completed"
        })
        
        return {
            "message": "Path migration completed successfully",
            "status": "success"
        }
        
    except ImportError as e:
        logger.error("errors.system", f"Failed to import migrate_paths module", "migrate_paths_import_failure", {
            "module": "migrate_paths",
            "error": str(e),
            "error_type": "ImportError"
        })
        raise HTTPException(status_code=500, detail=f"Path migration failed: Module import error - {str(e)}")
        
    except Exception as e:
        logger.error("errors.system", f"Path migration operation failed", "path_migration_failure", {
            "operation": "manual_path_migration",
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Path migration failed: {str(e)}")


@router.get("/path-status")
async def check_path_status(db: Session = Depends(get_db)):
    """
    Check the status of file paths in the database
    Returns count of problematic paths
    """
    logger.info("app.backend", f"Starting path status check operation", "path_status_check_start", {
        "endpoint": "/path-status",
        "operation": "database_path_validation"
    })
    
    try:
        # Check for problematic paths
        logger.debug("app.database", f"Executing SQL query to count problematic paths", "problematic_paths_query", {
            "query_type": "problematic_paths_count",
            "criteria": [
                "file_path LIKE '..%'",
                "file_path LIKE '%\\%'", 
                "file_path NOT LIKE 'uploads/%'"
            ]
        })
        
        result = db.execute("""
            SELECT COUNT(*) as problematic_count FROM images 
            WHERE file_path LIKE '..%' 
               OR file_path LIKE '%\\%'
               OR (file_path IS NOT NULL AND file_path NOT LIKE 'uploads/%')
        """).fetchone()
        
        problematic_count = result[0] if result else 0
        
        logger.debug("app.database", f"Problematic paths count query completed", "problematic_paths_count_result", {
            "problematic_count": problematic_count,
            "query_result": result
        })
        
        # Get total image count
        logger.debug("app.database", f"Executing SQL query to count total images", "total_images_query", {
            "query_type": "total_images_count"
        })
        
        total_result = db.execute("SELECT COUNT(*) as total FROM images").fetchone()
        total_count = total_result[0] if total_result else 0
        
        logger.debug("app.database", f"Total images count query completed", "total_images_count_result", {
            "total_count": total_count,
            "query_result": total_result
        })
        
        # Calculate healthy paths
        healthy_count = total_count - problematic_count
        
        logger.info("operations.operations", f"Path status check completed successfully", "path_status_check_success", {
            "total_images": total_count,
            "problematic_paths": problematic_count,
            "healthy_paths": healthy_count,
            "needs_migration": problematic_count > 0,
            "health_percentage": round((healthy_count / total_count * 100), 2) if total_count > 0 else 0
        })
        
        return {
            "total_images": total_count,
            "problematic_paths": problematic_count,
            "healthy_paths": healthy_count,
            "needs_migration": problematic_count > 0
        }
        
    except Exception as e:
        logger.error("errors.system", f"Path status check operation failed", "path_status_check_failure", {
            "operation": "database_path_validation",
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to check path status: {str(e)}")