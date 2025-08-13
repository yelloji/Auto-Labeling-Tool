from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database.models import Label
from database.database import get_db
from typing import List, Optional
from pydantic import BaseModel
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

router = APIRouter(tags=["labels"])

class LabelCreate(BaseModel):
    name: str
    color: Optional[str] = None
    project_id: int

class LabelResponse(BaseModel):
    id: int
    name: str
    color: str
    project_id: int

@router.get("/{project_id}/labels")
def get_labels(
    project_id: int, 
    force_refresh: bool = False,
    db: Session = Depends(get_db)
):
    """Get all labels for a project"""
    logger.info("app.backend", f"Starting get labels operation", "get_labels_start", {
        "project_id": project_id,
        "force_refresh": force_refresh,
        "endpoint": "/{project_id}/labels"
    })
    
    try:
        # First verify the project exists
        logger.debug("app.database", f"Verifying project exists", "project_verification", {
            "project_id": project_id
        })
        
        from database.models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning("errors.validation", f"Project not found", "project_not_found", {
                "project_id": project_id,
                "endpoint": "/{project_id}/labels"
            })
            raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
    
        # Remove orphaned labels if force_refresh is True
        if force_refresh:
            logger.info("operations.operations", f"Force refreshing labels for project", "force_refresh_start", {
                "project_id": project_id
            })
            
            # 1. Clean up any orphaned labels
            logger.debug("app.database", f"Cleaning up orphaned labels", "orphaned_cleanup", {
                "project_id": project_id
            })
            
            from database.models import Project
            existing_project_ids = [p.id for p in db.query(Project).all()]
            orphaned_count = db.query(Label).filter(
                (Label.project_id.is_(None)) | 
                (~Label.project_id.in_(existing_project_ids))
            ).delete(synchronize_session=False)
            
            if orphaned_count > 0:
                logger.info("operations.operations", f"Deleted orphaned labels", "orphaned_deletion", {
                    "project_id": project_id,
                    "orphaned_count": orphaned_count
                })
                db.commit()
    
        # Get all labels for this project
        logger.debug("app.database", f"Fetching labels for project", "labels_fetch", {
            "project_id": project_id
        })
        
        labels = db.query(Label).filter(Label.project_id == project_id).all()
        
        logger.info("operations.operations", f"Labels retrieved successfully", "labels_retrieved", {
            "project_id": project_id,
            "label_count": len(labels),
            "force_refresh": force_refresh
        })
    
        # Get all annotation labels used in this project (across all datasets)
        # This ensures we show labels from all datasets in the project
        logger.debug("app.database", f"Fetching annotation classes for project", "annotation_classes_fetch", {
            "project_id": project_id
        })
        
        from database.models import Annotation, Image, Dataset
        
        # Get annotations with labels used in this project
        annotations_query = db.query(Annotation.class_name).distinct().join(
            Image, Annotation.image_id == Image.id
        ).join(
            Dataset, Image.dataset_id == Dataset.id
        ).filter(
            Dataset.project_id == project_id
        ).all()
        
        annotation_classes = set(ann[0] for ann in annotations_query if ann[0])
        
        logger.debug("operations.operations", f"Annotation classes analysis", "annotation_analysis", {
            "project_id": project_id,
            "annotation_class_count": len(annotation_classes),
            "annotation_classes": list(annotation_classes)
        })
        
        # Check if there are any class names not in the labels table
        existing_label_names = set(label.name for label in labels)
        missing_labels = annotation_classes - existing_label_names
    
        # If we found labels used in annotations but not in the labels table,
        # generate and add them
        if missing_labels:
            logger.info("operations.operations", f"Creating missing labels for project", "missing_labels_creation", {
                "project_id": project_id,
                "missing_labels": list(missing_labels),
                "missing_count": len(missing_labels)
            })
            
            import random
            for class_name in missing_labels:
                # Generate a random color
                r = random.randint(0, 255)
                g = random.randint(0, 255)
                b = random.randint(0, 255)
                color = f"#{r:02x}{g:02x}{b:02x}"
                
                logger.debug("operations.operations", f"Creating new label", "new_label_creation", {
                    "project_id": project_id,
                    "class_name": class_name,
                    "color": color
                })
                
                # Create the new label
                new_label = Label(
                    name=class_name,
                    color=color,
                    project_id=project_id
                )
                db.add(new_label)
            
            # Commit changes and refresh the labels list
            logger.debug("app.database", f"Committing new labels to database", "labels_commit", {
                "project_id": project_id,
                "new_labels_count": len(missing_labels)
            })
            
            db.commit()
            labels = db.query(Label).filter(Label.project_id == project_id).all()
            
            logger.info("operations.operations", f"Missing labels created successfully", "missing_labels_success", {
                "project_id": project_id,
                "final_label_count": len(labels),
                "new_labels_created": len(missing_labels)
            })
        
        logger.info("operations.operations", f"Get labels operation completed successfully", "get_labels_success", {
            "project_id": project_id,
            "total_labels": len(labels),
            "force_refresh": force_refresh
        })
        
        return labels
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Get labels operation failed", "get_labels_failure", {
            "project_id": project_id,
            "force_refresh": force_refresh,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get labels: {str(e)}")

@router.post("/{project_id}/labels")
def create_label(project_id: int, label: dict = Body(...), db: Session = Depends(get_db)):
    """Create a new label for a project"""
    logger.info("app.backend", f"Starting create label operation", "create_label_start", {
        "project_id": project_id,
        "label_name": label.get("name"),
        "label_color": label.get("color"),
        "endpoint": "/{project_id}/labels"
    })
    
    try:
        name = label.get("name")
        color = label.get("color")
        
        # Validate required fields
        if not name:
            logger.warning("errors.validation", f"Label name is missing", "missing_label_name", {
                "project_id": project_id,
                "provided_data": label
            })
            raise HTTPException(status_code=400, detail="Label name is required")
        
        if not color:
            logger.warning("errors.validation", f"Label color is missing", "missing_label_color", {
                "project_id": project_id,
                "label_name": name
            })
            raise HTTPException(status_code=400, detail="Label color is required")
        
        # Check if label already exists (case-insensitive)
        logger.debug("app.database", f"Checking for existing label", "existing_label_check", {
            "project_id": project_id,
            "label_name": name
        })
        
        existing_label = db.query(Label).filter(
            Label.name.ilike(name),  # Case-insensitive comparison
            Label.project_id == project_id
        ).first()
        
        if existing_label:
            logger.warning("errors.validation", f"Label already exists", "duplicate_label", {
                "project_id": project_id,
                "label_name": name,
                "existing_label_id": existing_label.id
            })
            raise HTTPException(
                status_code=400, 
                detail=f"Label '{name}' already exists in this project"
            )
        
        # Create new label
        logger.info("operations.operations", f"Creating new label", "label_creation", {
            "project_id": project_id,
            "label_name": name,
            "label_color": color
        })
        
        new_label = Label(
            name=name,
            color=color,
            project_id=project_id
        )
        
        db.add(new_label)
        db.commit()
        db.refresh(new_label)
        
        logger.info("operations.operations", f"Label created successfully", "label_creation_success", {
            "project_id": project_id,
            "label_id": new_label.id,
            "label_name": name,
            "label_color": color
        })
        
        return new_label
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Create label operation failed", "create_label_failure", {
            "project_id": project_id,
            "label_data": label,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to create label: {str(e)}")

@router.put("/{project_id}/labels/{label_id}")
def update_label(
    project_id: int,
    label_id: int,
    label: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Update an existing label"""
    logger.info("app.backend", f"Starting update label operation", "update_label_start", {
        "project_id": project_id,
        "label_id": label_id,
        "update_data": label,
        "endpoint": "/{project_id}/labels/{label_id}"
    })
    
    try:
        # Find the label to update
        logger.debug("app.database", f"Finding label to update", "label_lookup", {
            "project_id": project_id,
            "label_id": label_id
        })
        
        db_label = db.query(Label).filter(
            Label.id == label_id,
            Label.project_id == project_id
        ).first()
        
        if not db_label:
            logger.warning("errors.validation", f"Label not found for update", "label_not_found", {
                "project_id": project_id,
                "label_id": label_id
            })
            raise HTTPException(status_code=404, detail="Label not found")
        
        # Store original name for annotation updates
        original_name = db_label.name
        
        logger.info("operations.operations", f"Updating label", "label_update", {
            "project_id": project_id,
            "label_id": label_id,
            "original_name": original_name,
            "update_data": label
        })
        
        # Update fields
        if "name" in label:
            new_name = label["name"]
            
            # Check if the new name conflicts with existing labels (excluding current label)
            logger.debug("app.database", f"Checking for name conflicts", "name_conflict_check", {
                "project_id": project_id,
                "new_name": new_name,
                "current_label_id": label_id
            })
            
            existing_label = db.query(Label).filter(
                Label.name.ilike(new_name),  # Case-insensitive comparison
                Label.project_id == project_id,
                Label.id != label_id  # Exclude current label
            ).first()
            
            if existing_label:
                logger.warning("errors.validation", f"Label name conflict", "name_conflict", {
                    "project_id": project_id,
                    "new_name": new_name,
                    "existing_label_id": existing_label.id
                })
                raise HTTPException(
                    status_code=400, 
                    detail=f"Label '{new_name}' already exists in this project"
                )
            
            # Update the label name
            db_label.name = new_name
            
            # Update all annotations with the old name to use the new name
            if original_name != new_name:
                logger.info("operations.operations", f"Updating annotations with new label name", "annotation_update", {
                    "project_id": project_id,
                    "old_name": original_name,
                    "new_name": new_name
                })
                
                from database.models import Annotation, Image, Dataset
                annotations_to_update = db.query(Annotation).join(
                    Image, Annotation.image_id == Image.id
                ).join(
                    Dataset, Image.dataset_id == Dataset.id
                ).filter(
                    Dataset.project_id == project_id,
                    Annotation.class_name == original_name
                ).all()
                
                logger.info("operations.operations", f"Found annotations to update", "annotations_found", {
                    "project_id": project_id,
                    "annotation_count": len(annotations_to_update),
                    "old_name": original_name,
                    "new_name": new_name
                })
                
                for annotation in annotations_to_update:
                    annotation.class_name = new_name
        
        if "color" in label:
            logger.debug("operations.operations", f"Updating label color", "color_update", {
                "project_id": project_id,
                "label_id": label_id,
                "new_color": label["color"]
            })
            db_label.color = label["color"]
        
        db.commit()
        db.refresh(db_label)
        
        logger.info("operations.operations", f"Label updated successfully", "label_update_success", {
            "project_id": project_id,
            "label_id": label_id,
            "final_name": db_label.name,
            "final_color": db_label.color
        })
        
        return db_label
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Update label operation failed", "update_label_failure", {
            "project_id": project_id,
            "label_id": label_id,
            "update_data": label,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to update label: {str(e)}")

@router.delete("/{project_id}/labels/{label_id}")
def delete_label(project_id: int, label_id: int, db: Session = Depends(get_db)):
    """Delete a label and all associated annotations"""
    logger.info("app.backend", f"Starting delete label operation", "delete_label_start", {
        "project_id": project_id,
        "label_id": label_id,
        "endpoint": "/{project_id}/labels/{label_id}"
    })
    
    try:
        # Find the label to delete
        logger.debug("app.database", f"Finding label to delete", "label_lookup", {
            "project_id": project_id,
            "label_id": label_id
        })
        
        db_label = db.query(Label).filter(
            Label.id == label_id,
            Label.project_id == project_id
        ).first()
        
        if not db_label:
            logger.warning("errors.validation", f"Label not found for deletion", "label_not_found", {
                "project_id": project_id,
                "label_id": label_id
            })
            raise HTTPException(status_code=404, detail="Label not found")
        
        logger.info("operations.operations", f"Deleting label and associated data", "label_deletion", {
            "project_id": project_id,
            "label_id": label_id,
            "label_name": db_label.name
        })
        
        # Count annotations that will be affected
        logger.debug("app.database", f"Counting affected annotations", "annotation_count", {
            "project_id": project_id,
            "label_name": db_label.name
        })
        
        from database.models import Annotation, Image, Dataset
        annotations_count = db.query(Annotation).join(
            Image, Annotation.image_id == Image.id
        ).join(
            Dataset, Image.dataset_id == Dataset.id
        ).filter(
            Dataset.project_id == project_id,
            Annotation.class_name == db_label.name
        ).count()
        
        logger.info("operations.operations", f"Found annotations to delete", "annotations_found", {
            "project_id": project_id,
            "label_name": db_label.name,
            "annotation_count": annotations_count
        })
        
        # Delete all annotations with this label name in this project
        if annotations_count > 0:
            logger.info("operations.operations", f"Deleting affected annotations", "annotation_deletion", {
                "project_id": project_id,
                "label_name": db_label.name,
                "annotation_count": annotations_count
            })
            
            # Get all annotation IDs to delete
            annotation_ids = db.query(Annotation.id).join(
                Image, Annotation.image_id == Image.id
            ).join(
                Dataset, Image.dataset_id == Dataset.id
            ).filter(
                Dataset.project_id == project_id,
                Annotation.class_name == db_label.name
            ).all()
            
            # Delete annotations
            for (annotation_id,) in annotation_ids:
                annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
                if annotation:
                    db.delete(annotation)
            
            # Update image labeling status for affected images
            logger.debug("operations.operations", f"Updating image labeling status", "image_status_update", {
                "project_id": project_id,
                "label_name": db_label.name
            })
            
            affected_images = db.query(Image).join(
                Dataset, Image.dataset_id == Dataset.id
            ).join(
                Annotation, Annotation.image_id == Image.id
            ).filter(
                Dataset.project_id == project_id,
                Annotation.class_name == db_label.name
            ).distinct().all()
            
            for image in affected_images:
                # Check if image still has other annotations
                remaining_annotations = db.query(Annotation).filter(
                    Annotation.image_id == image.id,
                    Annotation.class_name != db_label.name
                ).count()
                
                if remaining_annotations == 0:
                    image.is_labeled = False
                    image.is_verified = False
        
        # Delete the label
        logger.debug("operations.operations", f"Deleting label from database", "label_database_deletion", {
            "project_id": project_id,
            "label_id": label_id,
            "label_name": db_label.name
        })
        
        db.delete(db_label)
        db.commit()
        
        logger.info("operations.operations", f"Label deleted successfully", "label_deletion_success", {
            "project_id": project_id,
            "label_id": label_id,
            "label_name": db_label.name,
            "annotations_deleted": annotations_count
        })
        
        return {
            "message": "Label deleted successfully",
            "annotations_deleted": annotations_count
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Delete label operation failed", "delete_label_failure", {
            "project_id": project_id,
            "label_id": label_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete label: {str(e)}")

@router.delete("/{project_id}/labels/unused")
def delete_unused_labels(project_id: int, db: Session = Depends(get_db)):
    """Delete all unused labels for a project"""
    logger.info("app.backend", f"Starting delete unused labels operation", "delete_unused_labels_start", {
        "project_id": project_id,
        "endpoint": "/{project_id}/labels/unused"
    })
    
    try:
        # First verify the project exists
        logger.debug("app.database", f"Verifying project exists", "project_verification", {
            "project_id": project_id
        })
        
        from database.models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning("errors.validation", f"Project not found for unused labels cleanup", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
        
        logger.info("operations.operations", f"Starting unused labels cleanup", "cleanup_start", {
            "project_id": project_id
        })
        
        # Get all labels for this project
        logger.debug("app.database", f"Fetching all project labels", "all_labels_fetch", {
            "project_id": project_id
        })
        
        all_labels = db.query(Label).filter(Label.project_id == project_id).all()
        
        # Get all class names used in annotations for this project
        logger.debug("app.database", f"Fetching used labels from annotations", "used_labels_fetch", {
            "project_id": project_id
        })
        
        from database.models import Annotation, Image, Dataset
        used_labels_query = db.query(Annotation.class_name).distinct().join(
            Image, Annotation.image_id == Image.id
        ).join(
            Dataset, Image.dataset_id == Dataset.id
        ).filter(
            Dataset.project_id == project_id
        ).all()
        
        used_labels = set(label[0] for label in used_labels_query if label[0])
        
        logger.info("operations.operations", f"Analyzing label usage", "label_usage_analysis", {
            "project_id": project_id,
            "total_labels": len(all_labels),
            "used_labels": len(used_labels)
        })
        
        # Delete unused labels
        deleted_count = 0
        for label in all_labels:
            if label.name not in used_labels:
                logger.info("operations.operations", f"Deleting unused label", "unused_label_deletion", {
                    "project_id": project_id,
                    "label_name": label.name,
                    "label_id": label.id
                })
                db.delete(label)
                deleted_count += 1
        
        db.commit()
        
        logger.info("operations.operations", f"Unused labels cleanup completed", "cleanup_success", {
            "project_id": project_id,
            "deleted_count": deleted_count,
            "remaining_labels": len(all_labels) - deleted_count
        })
        
        return {"message": f"Deleted {deleted_count} unused labels from project {project_id}"}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Delete unused labels operation failed", "delete_unused_labels_failure", {
            "project_id": project_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete unused labels: {str(e)}")

@router.delete("/labels/cleanup")
def cleanup_all_labels(db: Session = Depends(get_db)):
    """Cleanup orphaned and unused labels"""
    logger.info("app.backend", f"Starting global labels cleanup operation", "global_cleanup_start", {
        "endpoint": "/labels/cleanup"
    })
    
    try:
        from database.models import Project, Annotation, Image, Dataset
        
        logger.info("operations.operations", f"Starting orphaned labels cleanup", "orphaned_cleanup_start", {})
        
        # 1. Delete labels with non-existent project IDs
        logger.debug("app.database", f"Fetching existing project IDs", "project_ids_fetch", {})
        
        existing_project_ids = [p.id for p in db.query(Project).all()]
        orphaned_labels = db.query(Label).filter(
            (Label.project_id.is_(None)) | 
            (~Label.project_id.in_(existing_project_ids))
        ).all()
        
        orphaned_count = len(orphaned_labels)
        logger.info("operations.operations", f"Found orphaned labels", "orphaned_labels_found", {
            "orphaned_count": orphaned_count
        })
        
        for label in orphaned_labels:
            logger.info("operations.operations", f"Deleting orphaned label", "orphaned_label_deletion", {
                "label_name": label.name,
                "project_id": label.project_id,
                "label_id": label.id
            })
            db.delete(label)
        
        # 2. Also delete unused labels while we're at it
        logger.info("operations.operations", f"Starting unused labels cleanup", "unused_cleanup_start", {})
        
        # Get all annotations with labels
        logger.debug("app.database", f"Fetching annotation data for cleanup", "annotation_data_fetch", {})
        
        annotations_query = db.query(
            Annotation.class_name, 
            Image.dataset_id
        ).join(
            Image, Annotation.image_id == Image.id
        ).all()
        
        # Create mapping of dataset_id to project_id
        dataset_to_project = {
            d.id: d.project_id for d in db.query(Dataset).all()
        }
        
        # Create a set of (project_id, label_name) tuples for labels that are used
        used_label_tuples = set()
        for label_name, dataset_id in annotations_query:
            if label_name and dataset_id in dataset_to_project:
                project_id = dataset_to_project[dataset_id]
                used_label_tuples.add((project_id, label_name))
        
        logger.debug("operations.operations", f"Analyzed label usage", "label_usage_analysis", {
            "used_label_tuples_count": len(used_label_tuples)
        })
        
        # Get all remaining labels after deleting orphaned ones
        all_remaining_labels = db.query(Label).all()
        
        # Delete labels that aren't used in their project
        unused_count = 0
        for label in all_remaining_labels:
            if (label.project_id, label.name) not in used_label_tuples:
                logger.info("operations.operations", f"Deleting unused label", "unused_label_deletion", {
                    "label_name": label.name,
                    "project_id": label.project_id,
                    "label_id": label.id
                })
                db.delete(label)
                unused_count += 1
        
        db.commit()
        
        logger.info("operations.operations", f"Global labels cleanup completed", "global_cleanup_success", {
            "orphaned_deleted": orphaned_count,
            "unused_deleted": unused_count,
            "total_deleted": orphaned_count + unused_count
        })
        
        return {"message": f"Deleted {orphaned_count} orphaned labels and {unused_count} unused labels"}
        
    except Exception as e:
        logger.error("errors.system", f"Global labels cleanup operation failed", "global_cleanup_failure", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to cleanup labels: {str(e)}")
    
@router.get("/{project_id}/labels/debug")
def debug_labels(project_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to show what's happening with labels"""
    logger.info("app.backend", f"Starting debug labels operation", "debug_labels_start", {
        "project_id": project_id,
        "endpoint": "/{project_id}/labels/debug"
    })
    
    try:
        # 1. Get all labels in the labels table for this project
        logger.debug("app.database", f"Fetching labels from table", "labels_table_fetch", {
            "project_id": project_id
        })
        
        labels_from_table = db.query(Label).filter(Label.project_id == project_id).all()
        label_names_in_table = [label.name for label in labels_from_table]
        
        # 2. Get all datasets in this project
        logger.debug("app.database", f"Fetching project datasets", "datasets_fetch", {
            "project_id": project_id
        })
        
        from database.models import Dataset
        datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
        dataset_info = [{"id": d.id, "name": d.name} for d in datasets]
        
        # 3. For each dataset, get the labels used in annotations
        logger.debug("app.database", f"Analyzing dataset labels", "dataset_labels_analysis", {
            "project_id": project_id,
            "dataset_count": len(datasets)
        })
        
        from database.models import Annotation, Image
        dataset_labels = {}
        
        for dataset in datasets:
            # Find all annotations in this dataset
            annotations = db.query(Annotation).join(
                Image, Annotation.image_id == Image.id
            ).filter(
                Image.dataset_id == dataset.id
            ).all()
            
            # Extract unique class names
            unique_labels = list(set(a.class_name for a in annotations if a.class_name))
            dataset_labels[dataset.id] = {
                "name": dataset.name,
                "labels_used": unique_labels
            }
        
        logger.info("operations.operations", f"Debug labels operation completed", "debug_labels_success", {
            "project_id": project_id,
            "labels_in_table_count": len(label_names_in_table),
            "datasets_count": len(datasets),
            "total_annotations_analyzed": sum(len(dataset_labels[d.id]["labels_used"]) for d in datasets)
        })
        
        return {
            "labels_in_table": label_names_in_table,
            "datasets_in_project": dataset_info,
            "labels_by_dataset": dataset_labels
        }
        
    except Exception as e:
        logger.error("errors.system", f"Debug labels operation failed", "debug_labels_failure", {
            "project_id": project_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to debug labels: {str(e)}")
