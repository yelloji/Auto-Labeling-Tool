from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database.models import Label
from database.database import get_db
from typing import List, Optional
from pydantic import BaseModel

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
    # First verify the project exists
    from database.models import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
    
    # Remove orphaned labels if force_refresh is True
    if force_refresh:
        print(f"Force refreshing labels for project {project_id}")
        
        # 1. Clean up any orphaned labels
        from database.models import Project
        existing_project_ids = [p.id for p in db.query(Project).all()]
        orphaned_count = db.query(Label).filter(
            (Label.project_id.is_(None)) | 
            (~Label.project_id.in_(existing_project_ids))
        ).delete(synchronize_session=False)
        
        if orphaned_count > 0:
            print(f"Deleted {orphaned_count} orphaned labels")
            db.commit()
    
    # Get all labels for this project
    labels = db.query(Label).filter(Label.project_id == project_id).all()
    
    # Log for debugging
    print(f"GET /projects/{project_id}/labels with force_refresh={force_refresh}")
    print(f"Found {len(labels)} labels for project {project_id}")
    print(f"Found {len(labels)} labels in database")
    
    # Get all annotation labels used in this project (across all datasets)
    # This ensures we show labels from all datasets in the project
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
    
    # Check if there are any class names not in the labels table
    existing_label_names = set(label.name for label in labels)
    missing_labels = annotation_classes - existing_label_names
    
    # If we found labels used in annotations but not in the labels table,
    # generate and add them
    if missing_labels:
        import random
        for class_name in missing_labels:
            # Generate a random color
            r = random.randint(0, 255)
            g = random.randint(0, 255)
            b = random.randint(0, 255)
            color = f"#{r:02x}{g:02x}{b:02x}"
            
            # Create the new label
            new_label = Label(
                name=class_name,
                color=color,
                project_id=project_id
            )
            db.add(new_label)
        
        # Commit changes and refresh the labels list
        db.commit()
        labels = db.query(Label).filter(Label.project_id == project_id).all()
    
    return labels

@router.post("/{project_id}/labels")
def create_label(project_id: int, label: dict = Body(...), db: Session = Depends(get_db)):
    """Create a new label for a project"""
    name = label.get("name")
    color = label.get("color")
    
    if not name:
        raise HTTPException(status_code=400, detail="Label name is required")
    
    if not color:
        raise HTTPException(status_code=400, detail="Label color is required")
    
    # Check if label already exists (case-insensitive)
    existing_label = db.query(Label).filter(
        Label.name.ilike(name),  # Case-insensitive comparison
        Label.project_id == project_id
    ).first()
    
    if existing_label:
        raise HTTPException(
            status_code=400, 
            detail=f"Label '{name}' already exists in this project"
        )
    
    # Create new label
    new_label = Label(
        name=name,
        color=color,
        project_id=project_id
    )
    
    db.add(new_label)
    db.commit()
    db.refresh(new_label)
    return new_label

@router.put("/{project_id}/labels/{label_id}")
def update_label(
    project_id: int,
    label_id: int,
    label: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Update an existing label"""
    db_label = db.query(Label).filter(
        Label.id == label_id,
        Label.project_id == project_id
    ).first()
    
    if not db_label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    # Store original name for annotation updates
    original_name = db_label.name
    
    # Update fields
    if "name" in label:
        new_name = label["name"]
        
        # Check if the new name conflicts with existing labels (excluding current label)
        existing_label = db.query(Label).filter(
            Label.name.ilike(new_name),  # Case-insensitive comparison
            Label.project_id == project_id,
            Label.id != label_id  # Exclude current label
        ).first()
        
        if existing_label:
            raise HTTPException(
                status_code=400, 
                detail=f"Label '{new_name}' already exists in this project"
            )
        
        # Update the label name
        db_label.name = new_name
        
        # Update all annotations with the old name to use the new name
        if original_name != new_name:
            from database.models import Annotation, Image, Dataset
            annotations_to_update = db.query(Annotation).join(
                Image, Annotation.image_id == Image.id
            ).join(
                Dataset, Image.dataset_id == Dataset.id
            ).filter(
                Dataset.project_id == project_id,
                Annotation.class_name == original_name
            ).all()
            
            print(f"Updating {len(annotations_to_update)} annotations from '{original_name}' to '{new_name}'")
            
            for annotation in annotations_to_update:
                annotation.class_name = new_name
    
    if "color" in label:
        db_label.color = label["color"]
    
    db.commit()
    db.refresh(db_label)
    return db_label

@router.delete("/{project_id}/labels/{label_id}")
def delete_label(project_id: int, label_id: int, db: Session = Depends(get_db)):
    """Delete a label and all associated annotations"""
    db_label = db.query(Label).filter(
        Label.id == label_id,
        Label.project_id == project_id
    ).first()
    
    if not db_label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    # Count annotations that will be affected
    from database.models import Annotation, Image, Dataset
    annotations_count = db.query(Annotation).join(
        Image, Annotation.image_id == Image.id
    ).join(
        Dataset, Image.dataset_id == Dataset.id
    ).filter(
        Dataset.project_id == project_id,
        Annotation.class_name == db_label.name
    ).count()
    
    # Delete all annotations with this label name in this project
    if annotations_count > 0:
        print(f"Deleting {annotations_count} annotations with label '{db_label.name}' from project {project_id}")
        
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
    db.delete(db_label)
    db.commit()
    
    return {
        "message": "Label deleted successfully",
        "annotations_deleted": annotations_count
    }

@router.delete("/{project_id}/labels/unused")
def delete_unused_labels(project_id: int, db: Session = Depends(get_db)):
    """Delete all unused labels for a project"""
    # First verify the project exists
    from database.models import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
        
    print(f"CLEANING UP UNUSED LABELS FOR PROJECT {project_id}")
        
    # Get all labels for this project
    all_labels = db.query(Label).filter(Label.project_id == project_id).all()
    
    # Get all class names used in annotations for this project
    from database.models import Annotation, Image, Dataset
    used_labels_query = db.query(Annotation.class_name).distinct().join(
        Image, Annotation.image_id == Image.id
    ).join(
        Dataset, Image.dataset_id == Dataset.id
    ).filter(
        Dataset.project_id == project_id
    ).all()
    
    used_labels = set(label[0] for label in used_labels_query if label[0])
    
    # Delete unused labels
    deleted_count = 0
    for label in all_labels:
        if label.name not in used_labels:
            print(f"Deleting unused label '{label.name}' from project {project_id}")
            db.delete(label)
            deleted_count += 1
    
    db.commit()
    return {"message": f"Deleted {deleted_count} unused labels from project {project_id}"}

@router.delete("/labels/cleanup")
def cleanup_all_labels(db: Session = Depends(get_db)):
    """Cleanup orphaned and unused labels"""
    from database.models import Project, Annotation, Image, Dataset
    
    print("CLEANING UP ORPHANED LABELS")
    
    # 1. Delete labels with non-existent project IDs
    existing_project_ids = [p.id for p in db.query(Project).all()]
    orphaned_labels = db.query(Label).filter(
        (Label.project_id.is_(None)) | 
        (~Label.project_id.in_(existing_project_ids))
    ).all()
    
    orphaned_count = len(orphaned_labels)
    for label in orphaned_labels:
        print(f"Deleting orphaned label: {label.name} (Project ID: {label.project_id})")
        db.delete(label)
    
    # 2. Also delete unused labels while we're at it
    # Get all annotations with labels
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
    
    # Get all remaining labels after deleting orphaned ones
    all_remaining_labels = db.query(Label).all()
    
    # Delete labels that aren't used in their project
    unused_count = 0
    for label in all_remaining_labels:
        if (label.project_id, label.name) not in used_label_tuples:
            print(f"Deleting unused label: {label.name} from project {label.project_id}")
            db.delete(label)
            unused_count += 1
    
    db.commit()
    return {"message": f"Deleted {orphaned_count} orphaned labels and {unused_count} unused labels"}
    
@router.get("/{project_id}/labels/debug")
def debug_labels(project_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to show what's happening with labels"""
    
    # 1. Get all labels in the labels table for this project
    labels_from_table = db.query(Label).filter(Label.project_id == project_id).all()
    label_names_in_table = [label.name for label in labels_from_table]
    
    # 2. Get all datasets in this project
    from database.models import Dataset
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    dataset_info = [{"id": d.id, "name": d.name} for d in datasets]
    
    # 3. For each dataset, get the labels used in annotations
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
    
    return {
        "labels_in_table": label_names_in_table,
        "datasets_in_project": dataset_info,
        "labels_by_dataset": dataset_labels
    }
