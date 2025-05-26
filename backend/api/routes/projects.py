"""
API routes for project management
Organize datasets and models into projects with full database integration
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from database.database import get_db
from database.operations import ProjectOperations, DatasetOperations
from models.model_manager import model_manager

router = APIRouter()


class ProjectCreateRequest(BaseModel):
    """Request model for creating a new project"""
    name: str
    description: str = ""
    default_model_id: Optional[str] = None
    confidence_threshold: float = 0.5
    iou_threshold: float = 0.45


class ProjectUpdateRequest(BaseModel):
    """Request model for updating a project"""
    name: Optional[str] = None
    description: Optional[str] = None
    default_model_id: Optional[str] = None
    confidence_threshold: Optional[float] = None
    iou_threshold: Optional[float] = None


class ProjectResponse(BaseModel):
    """Response model for project data"""
    id: str
    name: str
    description: str
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
    try:
        projects = ProjectOperations.get_projects(db, skip=skip, limit=limit)
        
        project_responses = []
        for project in projects:
            # Get datasets for this project
            datasets = DatasetOperations.get_datasets_by_project(db, project.id)
            
            # Calculate statistics
            total_datasets = len(datasets)
            total_images = sum(dataset.total_images for dataset in datasets)
            labeled_images = sum(dataset.labeled_images for dataset in datasets)
            
            project_response = ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
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
        
        return project_responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get projects: {str(e)}")


@router.post("/", response_model=ProjectResponse)
async def create_project(
    request: ProjectCreateRequest, 
    db: Session = Depends(get_db)
):
    """Create a new project"""
    try:
        # Validate model_id if provided
        if request.default_model_id:
            model_info = model_manager.get_model_info(request.default_model_id)
            if not model_info:
                raise HTTPException(status_code=400, detail="Invalid model ID")
        
        # Create project
        project = ProjectOperations.create_project(
            db=db,
            name=request.name,
            description=request.description,
            default_model_id=request.default_model_id,
            confidence_threshold=request.confidence_threshold,
            iou_threshold=request.iou_threshold
        )
        
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
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
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: Session = Depends(get_db)):
    """Get a specific project with detailed statistics"""
    try:
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get datasets and statistics
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        total_datasets = len(datasets)
        total_images = sum(dataset.total_images for dataset in datasets)
        labeled_images = sum(dataset.labeled_images for dataset in datasets)
        
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
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
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, 
    request: ProjectUpdateRequest, 
    db: Session = Depends(get_db)
):
    """Update a project"""
    try:
        # Check if project exists
        existing_project = ProjectOperations.get_project(db, project_id)
        if not existing_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate model_id if provided
        if request.default_model_id:
            model_info = model_manager.get_model_info(request.default_model_id)
            if not model_info:
                raise HTTPException(status_code=400, detail="Invalid model ID")
        
        # Prepare update data
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.description is not None:
            update_data['description'] = request.description
        if request.default_model_id is not None:
            update_data['default_model_id'] = request.default_model_id
        if request.confidence_threshold is not None:
            update_data['confidence_threshold'] = request.confidence_threshold
        if request.iou_threshold is not None:
            update_data['iou_threshold'] = request.iou_threshold
        
        # Update project
        updated_project = ProjectOperations.update_project(db, project_id, **update_data)
        if not updated_project:
            raise HTTPException(status_code=500, detail="Failed to update project")
        
        # Get statistics
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        total_datasets = len(datasets)
        total_images = sum(dataset.total_images for dataset in datasets)
        labeled_images = sum(dataset.labeled_images for dataset in datasets)
        
        return ProjectResponse(
            id=updated_project.id,
            name=updated_project.name,
            description=updated_project.description,
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
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project and all its datasets"""
    try:
        # Check if project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete project (cascades to datasets and images)
        success = ProjectOperations.delete_project(db, project_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete project")
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@router.get("/{project_id}/datasets")
async def get_project_datasets(project_id: str, db: Session = Depends(get_db)):
    """Get all datasets for a project"""
    try:
        # Check if project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get datasets
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        dataset_responses = []
        for dataset in datasets:
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
        
        return {
            "project_id": project_id,
            "datasets": dataset_responses,
            "total_datasets": len(dataset_responses)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project datasets: {str(e)}")


@router.get("/{project_id}/stats")
async def get_project_stats(project_id: str, db: Session = Depends(get_db)):
    """Get detailed statistics for a project"""
    try:
        # Check if project exists
        project = ProjectOperations.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get datasets
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        
        # Calculate detailed statistics
        total_datasets = len(datasets)
        total_images = sum(dataset.total_images for dataset in datasets)
        labeled_images = sum(dataset.labeled_images for dataset in datasets)
        unlabeled_images = sum(dataset.unlabeled_images for dataset in datasets)
        
        # Calculate progress percentage
        progress_percentage = (labeled_images / total_images * 100) if total_images > 0 else 0
        
        # Dataset breakdown
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
        raise HTTPException(status_code=500, detail=f"Failed to get project stats: {str(e)}")