"""
API routes for annotation management
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from database.database import get_db
from database.operations import AnnotationOperations, ImageOperations
from database.models import Annotation

router = APIRouter()

class AnnotationCreate(BaseModel):
    class_name: str
    class_id: int
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    confidence: float = 1.0
    segmentation: Optional[List] = None
    is_auto_generated: bool = False
    model_id: Optional[str] = None

class AnnotationUpdate(BaseModel):
    class_name: Optional[str] = None
    class_id: Optional[int] = None
    x_min: Optional[float] = None
    y_min: Optional[float] = None
    x_max: Optional[float] = None
    y_max: Optional[float] = None
    confidence: Optional[float] = None
    segmentation: Optional[List] = None

# Removed duplicate route - using the one below that returns direct array

# Removed duplicate POST route - using the bulk save route below

@router.get("/{annotation_id}")
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    # TODO: Implement annotation retrieval
    return {"annotation_id": annotation_id}

@router.put("/{annotation_id}")
async def update_annotation(annotation_id: str, annotation: AnnotationCreate):
    """Update annotation"""
    # TODO: Implement annotation update
    return {"message": "Annotation updated", "annotation_id": annotation_id}

@router.delete("/{annotation_id}")
async def delete_annotation(annotation_id: str):
    """Delete annotation"""
    # TODO: Implement annotation deletion
    return {"message": "Annotation deleted", "annotation_id": annotation_id}

# ==================== IMAGE-SPECIFIC ANNOTATION ENDPOINTS ====================

class AnnotationData(BaseModel):
    annotations: List[Dict[str, Any]]

@router.get("/{image_id}/annotations")
async def get_image_annotations(image_id: str, db: Session = Depends(get_db)):
    """Get all annotations for a specific image"""
    try:
        annotations = AnnotationOperations.get_annotations_by_image(db, image_id)
        
        # Convert to frontend format (x, y, width, height)
        annotation_list = []
        for ann in annotations:
            annotation_list.append({
                "id": ann.id,
                "class_name": ann.class_name,
                "class_id": ann.class_id,
                "confidence": ann.confidence,
                "x": ann.x_min,
                "y": ann.y_min,
                "width": ann.x_max - ann.x_min,
                "height": ann.y_max - ann.y_min,
                "segmentation": ann.segmentation
            })
        
        return annotation_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving annotations: {str(e)}")

@router.post("/{image_id}/annotations")
async def save_image_annotations(image_id: str, data: AnnotationData, db: Session = Depends(get_db)):
    """Save annotations for a specific image"""
    try:
        annotations = data.annotations
        
        # First, delete existing annotations for this image
        AnnotationOperations.delete_annotations_by_image(db, image_id)
        
        # Create new annotations
        saved_annotations = []
        for ann in annotations:
            # Convert from x, y, width, height to x_min, y_min, x_max, y_max
            x = float(ann.get("x", 0))
            y = float(ann.get("y", 0))
            width = float(ann.get("width", 0))
            height = float(ann.get("height", 0))
            
            x_min = x
            y_min = y
            x_max = x + width
            y_max = y + height
            
            # Create annotation in database
            new_annotation = AnnotationOperations.create_annotation(
                db=db,
                image_id=image_id,
                class_name=ann.get("class_name", "unknown"),
                class_id=ann.get("class_id", 0),
                x_min=x_min,
                y_min=y_min,
                x_max=x_max,
                y_max=y_max,
                confidence=float(ann.get("confidence", 1.0)),
                segmentation=ann.get("segmentation")
            )
            
            if new_annotation:
                saved_annotations.append(new_annotation)
        
        # Update image status to labeled if annotations exist
        if saved_annotations:
            ImageOperations.update_image_status(db, image_id, is_labeled=True)
        else:
            # If no annotations, mark as unlabeled
            ImageOperations.update_image_status(db, image_id, is_labeled=False)
        
        return {
            "message": "Annotations saved successfully",
            "image_id": image_id,
            "count": len(saved_annotations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving annotations: {str(e)}")

@router.put("/{image_id}/annotations/{annotation_id}")
async def update_image_annotation(image_id: str, annotation_id: str, annotation: AnnotationCreate):
    """Update a specific annotation for an image"""
    # TODO: Implement annotation update
    return {
        "message": "Annotation updated",
        "image_id": image_id,
        "annotation_id": annotation_id
    }

@router.delete("/{image_id}/annotations/{annotation_id}")
async def delete_image_annotation(image_id: str, annotation_id: str):
    """Delete a specific annotation for an image"""
    # TODO: Implement annotation deletion
    return {
        "message": "Annotation deleted",
        "image_id": image_id,
        "annotation_id": annotation_id
    }