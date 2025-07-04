### NEW release.py (fully using DB + filesystem + no memory storage)
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime
import os
import json
import uuid
import shutil
import random

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

from database.database import get_db
from database.models import Project, Dataset, Image, Annotation, Release
from pydantic import BaseModel

router = APIRouter()

RELEASE_ROOT_DIR = "releases"

class ReleaseCreate(BaseModel):
    version_name: str
    dataset_id: str
    description: Optional[str] = ""
    transformations: List[dict] = []
    multiplier: int = 1
    preserve_annotations: bool = True
    export_format: str = "YOLO"
    include_images: bool = True
    include_annotations: bool = True
    verified_only: bool = False

class DatasetRebalanceRequest(BaseModel):
    train_count: int
    val_count: int
    test_count: int

@router.post("/releases/create")
def create_release(payload: ReleaseCreate, db: Session = Depends(get_db)):
    try:
        # Validate dataset
        dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Gather original + augmented image count
        total_original = db.query(Image).filter(Image.dataset_id == dataset.id).count()
        total_augmented = total_original * (payload.multiplier - 1)
        final_image_count = total_original + total_augmented

        # Create release folder
        release_id = str(uuid.uuid4())
        release_path = os.path.join(RELEASE_ROOT_DIR, release_id)
        os.makedirs(release_path, exist_ok=True)

        # Save config.json
        config_data = {
            "version_name": payload.version_name,
            "dataset_id": payload.dataset_id,
            "description": payload.description,
            "transformations": payload.transformations,
            "multiplier": payload.multiplier,
            "preserve_annotations": payload.preserve_annotations,
            "export_format": payload.export_format,
            "include_images": payload.include_images,
            "include_annotations": payload.include_annotations,
            "verified_only": payload.verified_only,
        }
        config_path = os.path.join(release_path, "config.json")
        with open(config_path, 'w') as f:
            json.dump(config_data, f, indent=4)

        # Simulate export file (placeholder)
        dummy_export_path = os.path.join(release_path, f"{payload.version_name}.{payload.export_format.lower()}.zip")
        with open(dummy_export_path, "w") as f:
            f.write("dummy content")

        # Save release to DB
        release = Release(
            id=release_id,
            project_id=dataset.project_id,
            dataset_id=payload.dataset_id,
            version_name=payload.version_name,
            description=payload.description,
            is_public=False,
            original_image_count=total_original,
            augmented_image_count=total_augmented,
            transformations_applied=payload.transformations,
            export_format=payload.export_format,
            include_images=payload.include_images,
            include_annotations=payload.include_annotations,
            verified_only=payload.verified_only,
            output_path=dummy_export_path,
            output_file_size=os.path.getsize(dummy_export_path),
            status="completed",
            progress=100.0,
            created_at=datetime.now(),
            started_at=datetime.now(),
            completed_at=datetime.now(),
        )
        db.add(release)
        db.commit()

        return {"message": "Release created", "release_id": release_id}

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/releases/{dataset_id}/history")
def get_release_history(dataset_id: str, db: Session = Depends(get_db)):
    releases = db.query(Release).filter(Release.dataset_id == dataset_id).order_by(Release.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "version_name": r.version_name,
            "status": r.status,
            "export_format": r.export_format,
            "original_image_count": r.original_image_count,
            "augmented_image_count": r.augmented_image_count,
            "created_at": r.created_at,
        }
        for r in releases
    ]

@router.put("/releases/{release_id}/rename")
def rename_release(release_id: str, new_name: dict, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    release.version_name = new_name.get("name", release.version_name)
    db.commit()
    return {"message": "Release renamed successfully"}

@router.get("/releases/{release_id}/download")
def download_release(release_id: str, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    return {
        "download_url": release.output_path,
        "size": release.output_file_size,
        "format": release.export_format,
        "version": release.version_name
    }

#new_rebalancer = router
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

@router.post("/datasets/{dataset_id}/rebalance")
def rebalance_dataset(dataset_id: str, payload: DatasetRebalanceRequest, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    labeled_images = db.query(Image).filter(Image.dataset_id == dataset_id, Image.is_labeled == True).all()
    total_labeled = len(labeled_images)
    total_requested = payload.train_count + payload.val_count + payload.test_count

    if total_labeled != total_requested:
        raise HTTPException(status_code=400, detail=f"Mismatch: {total_labeled} labeled vs {total_requested} requested")

    random.shuffle(labeled_images)

    splits = [
        ('train', labeled_images[:payload.train_count]),
        ('val', labeled_images[payload.train_count:payload.train_count + payload.val_count]),
        ('test', labeled_images[payload.train_count + payload.val_count:])
    ]

    moved_files = []

    for split_name, images in splits:
        for image in images:
            old_rel_path = image.file_path  # e.g., projects/gevis/dataset/animal/train/cat.jpg
            filename = os.path.basename(old_rel_path)

            try:
                parts = Path(old_rel_path).parts
                idx = parts.index("dataset")
                dataset_dir = Path(*parts[:idx + 2])  # e.g., projects/gevis/dataset/animal

                new_rel_path = str(dataset_dir / split_name / filename)

                abs_old = PROJECT_ROOT / old_rel_path
                abs_new = PROJECT_ROOT / new_rel_path

                # Ensure destination folder exists
                os.makedirs(abs_new.parent, exist_ok=True)

                # Move file only if it exists
                if abs_old.exists():
                    shutil.move(str(abs_old), str(abs_new))
                    print(f"✅ Moved: {abs_old} → {abs_new}")
                else:
                    print(f"❌ File not found (SKIPPED): {abs_old}")

                moved_files.append({
                    "image_id": image.id,
                    "new_path": new_rel_path,
                    "new_split": split_name
                })

            except Exception as e:
                print("❌ ERROR during move:", str(e))
                raise HTTPException(status_code=500, detail=f"Move failed: {e}")

    # Update DB
    try:
        for move in moved_files:
            img = db.query(Image).filter(Image.id == move["image_id"]).first()
            if img:
                img.file_path = move["new_path"]
                img.split_type = "dataset"
                img.split_section = move["new_split"]
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database update failed: {e}")

    return {
        "message": f"{len(moved_files)} images reassigned successfully",
        "train": payload.train_count,
        "val": payload.val_count,
        "test": payload.test_count
    }




@router.get("/datasets/{dataset_id}/stats")
def get_dataset_stats(dataset_id: str, db: Session = Depends(get_db)):
    """
    Get current dataset statistics including split counts
    """
    try:
        # Validate dataset exists
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Get split counts
        train_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_type == 'train',
            Image.is_labeled == True
        ).count()
        
        val_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_type == 'val',
            Image.is_labeled == True
        ).count()
        
        test_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_type == 'test',
            Image.is_labeled == True
        ).count()
        
        total_labeled = train_count + val_count + test_count
        
        # Get total images (including unlabeled)
        total_images = db.query(Image).filter(Image.dataset_id == dataset_id).count()
        unlabeled_count = total_images - total_labeled

        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "total_images": total_images,
            "total_labeled": total_labeled,
            "unlabeled_count": unlabeled_count,
            "splits": {
                "train": train_count,
                "val": val_count,
                "test": test_count
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dataset stats: {str(e)}")

