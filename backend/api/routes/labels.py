from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.models import Label
from database.database import get_db

router = APIRouter(prefix="/projects", tags=["labels"])

@router.get("/{project_id}/labels")
def get_labels(project_id: int, db: Session = Depends(get_db)):
    return db.query(Label).filter(Label.project_id == project_id).all()

@router.post("/{project_id}/labels")
def create_label(project_id: int, label: dict, db: Session = Depends(get_db)):
    name = label.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Label name is required")

    new_label = Label(name=name, project_id=project_id)
    db.add(new_label)
    db.commit()
    db.refresh(new_label)
    return new_label
