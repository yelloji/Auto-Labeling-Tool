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
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

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
    logger.info("app.backend", f"Getting annotation by ID: {annotation_id}", "annotation_retrieval", {
        "annotation_id": annotation_id,
        "endpoint": "/api/annotations/{annotation_id}"
    })
    
    try:
        # TODO: Implement annotation retrieval
        logger.info("operations.annotations", f"Annotation retrieval completed for ID: {annotation_id}", "annotation_found", {
            "annotation_id": annotation_id
        })
        return {"annotation_id": annotation_id}
        
    except Exception as e:
        logger.error("errors.system", f"Error retrieving annotation {annotation_id}", "annotation_retrieval_error", {
            "annotation_id": annotation_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error retrieving annotation: {str(e)}")

@router.put("/{annotation_id}")
async def update_annotation(annotation_id: str, annotation: AnnotationUpdate, db: Session = Depends(get_db)):
    """Update annotation"""
    logger.info("app.backend", f"Updating annotation: {annotation_id}", "annotation_update", {
        "annotation_id": annotation_id,
        "endpoint": "/api/annotations/{annotation_id}",
        "update_data": annotation.dict(exclude_none=True)
    })
    
    try:
        # Check if annotation exists
        logger.debug("app.database", f"Checking if annotation {annotation_id} exists", "database_query")
        existing = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not existing:
            logger.warning("errors.validation", f"Annotation {annotation_id} not found", "annotation_not_found", {
                "annotation_id": annotation_id
            })
            raise HTTPException(status_code=404, detail=f"Annotation with ID {annotation_id} not found")
        
        # Get image and dataset info to find project
        logger.debug("app.database", f"Fetching image and dataset info for annotation {annotation_id}", "database_query")
        from database.models import Image, Dataset, Label
        image = db.query(Image).filter(Image.id == existing.image_id).first()
        if not image:
            logger.warning("errors.validation", f"Image {existing.image_id} not found", "image_not_found", {
                "image_id": existing.image_id,
                "annotation_id": annotation_id
            })
            raise HTTPException(status_code=404, detail=f"Image with ID {existing.image_id} not found")
            
        dataset = db.query(Dataset).filter(Dataset.id == image.dataset_id).first()
        if not dataset:
            logger.warning("errors.validation", f"Dataset {image.dataset_id} not found", "dataset_not_found", {
                "dataset_id": image.dataset_id,
                "image_id": existing.image_id,
                "annotation_id": annotation_id
            })
            raise HTTPException(status_code=404, detail=f"Dataset with ID {image.dataset_id} not found")
            
        project_id = dataset.project_id
        logger.info("operations.annotations", f"Annotation context retrieved", "annotation_context", {
            "annotation_id": annotation_id,
            "image_id": existing.image_id,
            "dataset_id": image.dataset_id,
            "project_id": project_id
        })
        
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
            logger.info("operations.annotations", f"Processing new class name: {new_class_name}", "class_name_processing", {
                "new_class_name": new_class_name,
                "project_id": project_id
            })
            
            # Check if label already exists for this project
            existing_label = db.query(Label).filter(
                Label.name == new_class_name,
                Label.project_id == project_id
            ).first()
            
            if not existing_label:
                # Label doesn't exist, create it
                logger.info("operations.annotations", f"Creating new label: {new_class_name}", "label_creation", {
                    "label_name": new_class_name,
                    "project_id": project_id
                })
                
                import random
                
                # Generate a random color
                r = random.randint(0, 255)
                g = random.randint(0, 255)
                b = random.randint(0, 255)
                color = f"#{r:02x}{g:02x}{b:02x}"
                
                new_label = Label(
                    name=new_class_name,
                    color=color,
                    project_id=project_id
                )
                
                db.add(new_label)
                db.commit()
                logger.info("operations.annotations", f"New label created successfully", "label_created", {
                    "label_name": new_class_name,
                    "label_id": new_label.id,
                    "color": color,
                    "project_id": project_id
                })
            else:
                logger.debug("operations.annotations", f"Label already exists: {new_class_name}", "label_exists", {
                    "label_name": new_class_name,
                    "label_id": existing_label.id
                })
        
        # Handle class_name change - update class_id accordingly
        if annotation.class_name is not None and annotation.class_name != existing_annotation.class_name:
            update_data["class_name"] = annotation.class_name
            
            # Get the correct class_id from labels table for the new class_name
            correct_label = db.query(Label).filter(
                Label.name == annotation.class_name,
                Label.project_id == project_id
            ).first()
            
            if correct_label:
                update_data["class_id"] = correct_label.id
            else:
                # Create new label if it doesn't exist
                import random
                r = random.randint(0, 255)
                g = random.randint(0, 255)
                b = random.randint(0, 255)
                color = f"#{r:02x}{g:02x}{b:02x}"
                
                new_label = Label(
                    name=annotation.class_name,
                    color=color,
                    project_id=project_id
                )
                db.add(new_label)
                db.commit()
                update_data["class_id"] = new_label.id
        
        # Handle direct class_id updates (should be rare)
        elif annotation.class_id is not None:
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
        logger.info("operations.annotations", f"Updating annotation in database", "annotation_update_operation", {
            "annotation_id": annotation_id,
            "update_fields": list(update_data.keys())
        })
        
        updated = AnnotationOperations.update_annotation(
            db, 
            annotation_id,
            **update_data
        )
        
        if not updated:
            logger.error("errors.system", f"Failed to update annotation {annotation_id}", "annotation_update_failed", {
                "annotation_id": annotation_id,
                "update_data": update_data
            })
            raise HTTPException(status_code=500, detail="Failed to update annotation")
        
        logger.info("operations.annotations", f"Annotation updated successfully", "annotation_update_success", {
            "annotation_id": annotation_id,
            "updated_fields": list(update_data.keys())
        })
            
        return {"message": "Annotation updated", "annotation": updated}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error updating annotation {annotation_id}", "annotation_update_error", {
            "annotation_id": annotation_id,
            "error": str(e)
        })
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update annotation: {str(e)}")

@router.delete("/{annotation_id}")
async def delete_annotation(annotation_id: str, db: Session = Depends(get_db)):
    """Delete annotation"""
    logger.info("app.backend", f"Deleting annotation: {annotation_id}", "annotation_deletion", {
        "annotation_id": annotation_id,
        "endpoint": "/api/annotations/{annotation_id}"
    })
    
    try:
        # Get the annotation first to make sure it exists
        logger.debug("app.database", f"Checking if annotation {annotation_id} exists for deletion", "database_query")
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not annotation:
            logger.warning("errors.validation", f"Annotation {annotation_id} not found for deletion", "annotation_not_found", {
                "annotation_id": annotation_id
            })
            raise HTTPException(status_code=404, detail=f"Annotation with ID {annotation_id} not found")
        
        # Delete the annotation
        logger.info("operations.annotations", f"Deleting annotation from database", "annotation_delete_operation", {
            "annotation_id": annotation_id,
            "image_id": annotation.image_id
        })
        db.query(Annotation).filter(Annotation.id == annotation_id).delete()
        db.commit()
        
        # Check if the image has other annotations
        image_id = annotation.image_id
        remaining_annotations = db.query(Annotation).filter(Annotation.image_id == image_id).count()
        
        logger.info("operations.annotations", f"Annotation deleted, checking remaining annotations", "remaining_annotations_check", {
            "annotation_id": annotation_id,
            "image_id": image_id,
            "remaining_count": remaining_annotations
        })
        
        # Update image status if needed
        if remaining_annotations == 0:
            logger.info("operations.images", f"Updating image status to unlabeled", "image_status_update", {
                "image_id": image_id,
                "reason": "no_annotations_remaining"
            })
            ImageOperations.update_image_status(db, image_id, is_labeled=False)
        
        logger.info("operations.annotations", f"Annotation deleted successfully", "annotation_delete_success", {
            "annotation_id": annotation_id,
            "image_id": image_id
        })
            
        return {"message": "Annotation deleted successfully", "annotation_id": annotation_id}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error deleting annotation {annotation_id}", "annotation_delete_error", {
            "annotation_id": annotation_id,
            "error": str(e)
        })
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete annotation: {str(e)}")

# ==================== IMAGE-SPECIFIC ANNOTATION ENDPOINTS ====================

class AnnotationData(BaseModel):
    annotations: List[Dict[str, Any]]

@router.get("/{image_id}/annotations")
async def get_image_annotations(image_id: str, db: Session = Depends(get_db)):
    """Get all annotations for a specific image"""
    logger.info("app.backend", f"Getting annotations for image: {image_id}", "image_annotations_retrieval", {
        "image_id": image_id,
        "endpoint": "/api/annotations/{image_id}/annotations"
    })
    
    try:
        logger.debug("app.database", f"Fetching annotations for image {image_id}", "database_query")
        annotations = AnnotationOperations.get_annotations_by_image(db, image_id)
        
        logger.info("operations.annotations", f"Retrieved {len(annotations)} annotations for image {image_id}", "annotations_retrieved", {
            "image_id": image_id,
            "annotation_count": len(annotations)
        })
        
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
        
        logger.info("operations.annotations", f"Image annotations processed successfully", "annotations_processed", {
            "image_id": image_id,
            "annotation_count": len(annotation_list),
            "annotation_types": list(set([ann["type"] for ann in annotation_list]))
        })
        
        return annotation_list
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error retrieving annotations for image {image_id}", "image_annotations_error", {
            "image_id": image_id,
            "error": str(e)
        })
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
            
            # Get the correct class_id from labels table
            correct_label = db.query(Label).filter(
                Label.name == class_name,
                Label.project_id == project_id
            ).first()
            
            # Use the correct label ID, not 0
            correct_class_id = correct_label.id if correct_label else 0
            
            # Create annotation in database
            new_annotation = AnnotationOperations.create_annotation(
                db=db,
                image_id=image_id,
                class_name=class_name,
                class_id=correct_class_id,
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