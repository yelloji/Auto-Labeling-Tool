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
    label: Optional[str] = None  # Added for frontend compatibility
    image_id: Optional[str] = None  # Added for frontend compatibility

# Removed duplicate route - using the one below that returns direct array

# Removed duplicate POST route - using the bulk save route below

@router.get("/{annotation_id}")
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    # TODO: Implement annotation retrieval
    return {"annotation_id": annotation_id}

@router.put("/{annotation_id}")
async def update_annotation(annotation_id: str, annotation: AnnotationUpdate, db: Session = Depends(get_db)):
    """Update annotation"""
    try:
        # Check if annotation exists
        existing = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Annotation with ID {annotation_id} not found")
        
        # Get image and dataset info to find project
        from database.models import Image, Dataset, Label
        image = db.query(Image).filter(Image.id == existing.image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail=f"Image with ID {existing.image_id} not found")
            
        dataset = db.query(Dataset).filter(Dataset.id == image.dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Dataset with ID {image.dataset_id} not found")
            
        project_id = dataset.project_id
        print(f"Annotation {annotation_id} is on image {existing.image_id} in dataset {image.dataset_id}, project {project_id}")
        
        # Prepare the update data
        update_data = {}
        
        # Get the new class name/label (if provided)
        new_class_name = None
        if annotation.class_name is not None:
            new_class_name = annotation.class_name
            update_data["class_name"] = annotation.class_name
        
        # Support for 'label' field (same as class_name)
        if annotation.label is not None:
            new_class_name = annotation.label
            update_data["class_name"] = annotation.label
            
        # If we have a new class name, ensure it exists in the labels table
        if new_class_name:
            # Check if label already exists for this project
            existing_label = db.query(Label).filter(
                Label.name == new_class_name,
                Label.project_id == project_id
            ).first()
            
            if not existing_label:
                # Label doesn't exist, create it
                import random
                
                # Generate a random color
                r = random.randint(0, 255)
                g = random.randint(0, 255)
                b = random.randint(0, 255)
                color = f"#{r:02x}{g:02x}{b:02x}"
                
                print(f"Creating new label '{new_class_name}' with color {color} for project {project_id}")
                new_label = Label(
                    name=new_class_name,
                    color=color,
                    project_id=project_id
                )
                
                db.add(new_label)
                db.commit()
                print(f"Created new label with ID {new_label.id}")
        
        # Add other fields to update_data
        if annotation.class_id is not None:
            update_data["class_id"] = annotation.class_id
            
        if annotation.x_min is not None:
            update_data["x_min"] = annotation.x_min
            
        if annotation.y_min is not None:
            update_data["y_min"] = annotation.y_min
            
        if annotation.x_max is not None:
            update_data["x_max"] = annotation.x_max
            
        if annotation.y_max is not None:
            update_data["y_max"] = annotation.y_max
            
        if annotation.confidence is not None:
            update_data["confidence"] = annotation.confidence
            
        if annotation.segmentation is not None:
            update_data["segmentation"] = annotation.segmentation
            
        # Update the annotation
        updated = AnnotationOperations.update_annotation(
            db, 
            annotation_id,
            **update_data
        )
        
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update annotation")
            
        return {"message": "Annotation updated", "annotation": updated}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update annotation: {str(e)}")

@router.delete("/{annotation_id}")
async def delete_annotation(annotation_id: str, db: Session = Depends(get_db)):
    """Delete annotation"""
    try:
        # Get the annotation first to make sure it exists
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not annotation:
            raise HTTPException(status_code=404, detail=f"Annotation with ID {annotation_id} not found")
        
        # Delete the annotation
        db.query(Annotation).filter(Annotation.id == annotation_id).delete()
        db.commit()
        
        # Check if the image has other annotations
        image_id = annotation.image_id
        remaining_annotations = db.query(Annotation).filter(Annotation.image_id == image_id).count()
        
        # Update image status if needed
        if remaining_annotations == 0:
            ImageOperations.update_image_status(db, image_id, is_labeled=False)
            
        return {"message": "Annotation deleted successfully", "annotation_id": annotation_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete annotation: {str(e)}")

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
            # Determine the annotation type based on segmentation
            annotation_type = "box"
            if ann.segmentation:
                annotation_type = "polygon"
                
            annotation_list.append({
                "id": ann.id,
                "class_name": ann.class_name,
                "class_id": ann.class_id,
                "confidence": ann.confidence,
                "type": annotation_type,  # CRITICAL: Add the type field
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
        
        # CRITICAL FIX: Do NOT delete existing annotations
        # We want to append new annotations, not replace them
        # AnnotationOperations.delete_annotations_by_image(db, image_id)
        
        # First, get the project_id for this image
        from database.models import Image, Dataset
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail=f"Image with ID {image_id} not found")
            
        dataset = db.query(Dataset).filter(Dataset.id == image.dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Dataset with ID {image.dataset_id} not found")
            
        project_id = dataset.project_id
        print(f"Image {image_id} is in dataset {image.dataset_id}, project {project_id}")
        
        # Create new annotations
        saved_annotations = []
        for ann in annotations:
            # Get the class name for this annotation
            class_name = ann.get("class_name", "unknown")
            
            # CRITICAL: Ensure this label exists in the labels table for this project
            from database.models import Label
            
            # First check if the label already exists
            existing_label = db.query(Label).filter(
                Label.name == class_name,
                Label.project_id == project_id
            ).first()
            
            if not existing_label:
                # Label doesn't exist, create it
                import random
                
                # Generate a random color if not provided
                color = ann.get("color")
                if not color:
                    r = random.randint(0, 255)
                    g = random.randint(0, 255)
                    b = random.randint(0, 255)
                    color = f"#{r:02x}{g:02x}{b:02x}"
                
                print(f"Creating new label '{class_name}' with color {color} for project {project_id}")
                new_label = Label(
                    name=class_name,
                    color=color,
                    project_id=project_id
                )
                
                db.add(new_label)
                db.commit()
                print(f"Created new label with ID {new_label.id}")
            
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
                class_name=class_name,
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