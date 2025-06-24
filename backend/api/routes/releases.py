"""
Release Management API Routes
Handles CRUD operations for dataset releases
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import json

from database.database import get_db
from database.models import Project, Dataset, Image, Annotation
from pydantic import BaseModel

router = APIRouter()

# Pydantic models for request/response
class ReleaseCreate(BaseModel):
    name: str
    dataset_ids: List[str]
    transformations: List[dict] = []
    multiplier: int = 1
    target_split: dict = {"train": 70, "val": 20, "test": 10}
    preserve_annotations: bool = True
    task_type: str = "object_detection"  # classification, object_detection, segmentation
    export_format: str = "yolo"  # yolo, coco, pascal_voc, tfrecord, csv

class ReleaseUpdate(BaseModel):
    name: Optional[str] = None

class ReleaseResponse(BaseModel):
    id: str
    name: str
    dataset_ids: List[str]
    transformations: List[dict]
    multiplier: int
    target_split: dict
    preserve_annotations: bool
    task_type: str
    export_format: str
    total_images: int
    total_classes: int
    created_at: datetime
    status: str  # pending, processing, completed, failed
    download_url: Optional[str] = None

# In-memory storage for releases (in production, this would be in database)
releases_storage = {}

@router.post("/releases/create", response_model=ReleaseResponse)
async def create_release(release_data: ReleaseCreate, db: Session = Depends(get_db)):
    """Create a new dataset release"""
    try:
        # Generate unique release ID
        release_id = str(uuid.uuid4())
        
        # Calculate total images and classes from selected datasets
        total_images = 0
        all_classes = set()
        
        for dataset_id in release_data.dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
            
            # Count images in this dataset
            image_count = db.query(Image).filter(Image.dataset_id == dataset_id).count()
            total_images += image_count
            
            # Get unique classes from annotations
            annotations = db.query(Annotation).join(Image).filter(Image.dataset_id == dataset_id).all()
            for annotation in annotations:
                all_classes.add(annotation.class_name)
        
        # Apply multiplier for augmentation
        total_images *= release_data.multiplier
        
        # Create release object
        release = ReleaseResponse(
            id=release_id,
            name=release_data.name,
            dataset_ids=release_data.dataset_ids,
            transformations=release_data.transformations,
            multiplier=release_data.multiplier,
            target_split=release_data.target_split,
            preserve_annotations=release_data.preserve_annotations,
            task_type=release_data.task_type,
            export_format=release_data.export_format,
            total_images=total_images,
            total_classes=len(all_classes),
            created_at=datetime.now(),
            status="completed",  # For demo purposes, mark as completed immediately
            download_url=f"/api/releases/{release_id}/download"
        )
        
        # Store in memory (in production, save to database)
        releases_storage[release_id] = release.dict()
        
        return release
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create release: {str(e)}")

@router.get("/releases/{dataset_id}/history", response_model=List[ReleaseResponse])
async def get_release_history(dataset_id: str, db: Session = Depends(get_db)):
    """Get release history for a dataset"""
    try:
        # Filter releases that contain this dataset_id
        dataset_releases = []
        for release_id, release_data in releases_storage.items():
            if dataset_id in release_data.get('dataset_ids', []):
                dataset_releases.append(ReleaseResponse(**release_data))
        
        # Sort by creation date (newest first)
        dataset_releases.sort(key=lambda x: x.created_at, reverse=True)
        
        return dataset_releases
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get release history: {str(e)}")

@router.get("/releases/{release_id}", response_model=ReleaseResponse)
async def get_release(release_id: str):
    """Get a specific release by ID"""
    if release_id not in releases_storage:
        raise HTTPException(status_code=404, detail="Release not found")
    
    return ReleaseResponse(**releases_storage[release_id])

@router.put("/releases/{release_id}", response_model=ReleaseResponse)
async def update_release(release_id: str, update_data: ReleaseUpdate):
    """Update a release (currently only supports name changes)"""
    if release_id not in releases_storage:
        raise HTTPException(status_code=404, detail="Release not found")
    
    release_data = releases_storage[release_id]
    
    if update_data.name:
        release_data['name'] = update_data.name
    
    releases_storage[release_id] = release_data
    
    return ReleaseResponse(**release_data)

@router.delete("/releases/{release_id}")
async def delete_release(release_id: str):
    """Delete a release"""
    if release_id not in releases_storage:
        raise HTTPException(status_code=404, detail="Release not found")
    
    del releases_storage[release_id]
    
    return {"message": "Release deleted successfully"}

@router.get("/releases/{release_id}/download")
async def download_release(release_id: str):
    """Download a release (placeholder implementation)"""
    if release_id not in releases_storage:
        raise HTTPException(status_code=404, detail="Release not found")
    
    release_data = releases_storage[release_id]
    
    # In a real implementation, this would:
    # 1. Generate the export file based on the release configuration
    # 2. Return a FileResponse with the actual file
    # For now, return a JSON response with download info
    
    return {
        "message": "Download ready",
        "release_id": release_id,
        "release_name": release_data['name'],
        "format": release_data['export_format'],
        "total_images": release_data['total_images'],
        "download_url": f"/api/releases/{release_id}/download",
        "note": "This is a placeholder. In production, this would return the actual export file."
    }

@router.post("/releases/{release_id}/rename")
async def rename_release(release_id: str, new_name: dict):
    """Rename a release"""
    if release_id not in releases_storage:
        raise HTTPException(status_code=404, detail="Release not found")
    
    if 'name' not in new_name:
        raise HTTPException(status_code=400, detail="New name is required")
    
    release_data = releases_storage[release_id]
    release_data['name'] = new_name['name']
    releases_storage[release_id] = release_data
    
    return {"message": "Release renamed successfully", "new_name": new_name['name']}

