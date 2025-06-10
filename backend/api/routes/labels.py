from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database.models import Label
from database.database import get_db
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/projects", tags=["labels"])

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
def get_labels(project_id: int, db: Session = Depends(get_db)):
    """Get all labels for a project"""
    labels = db.query(Label).filter(Label.project_id == project_id).all()
    return labels

@router.post("/{project_id}/labels")
def create_label(project_id: int, label: dict = Body(...), db: Session = Depends(get_db)):
    """Create a new label for a project"""
    name = label.get("name")
    color = label.get("color")
    
    if not name:
        raise HTTPException(status_code=400, detail="Label name is required")
    
    # Check if label already exists
    existing_label = db.query(Label).filter(
        Label.name == name,
        Label.project_id == project_id
    ).first()
    
    if existing_label:
        # Update color if provided
        if color and color != existing_label.color:
            existing_label.color = color
            db.commit()
            db.refresh(existing_label)
        return existing_label
    
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
    
    # Update fields
    if "name" in label:
        db_label.name = label["name"]
    
    if "color" in label:
        db_label.color = label["color"]
    
    db.commit()
    db.refresh(db_label)
    return db_label

@router.delete("/{project_id}/labels/{label_id}")
def delete_label(project_id: int, label_id: int, db: Session = Depends(get_db)):
    """Delete a label"""
    db_label = db.query(Label).filter(
        Label.id == label_id,
        Label.project_id == project_id
    ).first()
    
    if not db_label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    db.delete(db_label)
    db.commit()
    return {"message": "Label deleted successfully"}
