"""
Release API Routes for Auto-Labeling Tool
Integrates new release generation system with existing functionality
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime
import os
import json
import uuid
import shutil
import random
import logging

# Import our new release system
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from core.release_controller import ReleaseController, ReleaseConfig, create_release_controller
from core.transformation_schema import generate_release_configurations

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

from database.database import get_db
from database.models import Project, Dataset, Image, Annotation, Release, ImageTransformation
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

RELEASE_ROOT_DIR = "backend/releases"

# New enhanced release generation models
class EnhancedReleaseCreate(BaseModel):
    release_name: str
    description: str
    project_id: int
    dataset_ids: List[str]
    release_version: str  # Version identifier for transformations
    export_format: str = "yolo"  # yolo, coco, pascal_voc
    task_type: str = "object_detection"  # object_detection, segmentation
    images_per_original: int = 4
    sampling_strategy: str = "intelligent"
    output_format: str = "jpg"
    include_original: bool = True

class ReleaseProgressResponse(BaseModel):
    release_id: str
    status: str
    progress_percentage: float
    current_step: str
    total_images: int
    processed_images: int
    generated_images: int
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

# Original release creation model (for backward compatibility)
class ReleaseCreate(BaseModel):
    version_name: str
    dataset_id: str
    description: Optional[str] = ""
    transformations: List[dict] = []
    multiplier: int = 1
    preserve_annotations: bool = True
    export_format: str = "YOLO"
    task_type: Optional[str] = "object_detection"
    include_images: bool = True
    include_annotations: bool = True
    verified_only: bool = False

class DatasetRebalanceRequest(BaseModel):
    train_count: int
    val_count: int
    test_count: int

# NEW ENHANCED RELEASE GENERATION ENDPOINTS

@router.post("/releases/generate")
async def generate_enhanced_release(
    payload: EnhancedReleaseCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Generate a release using the new enhanced release system
    """
    try:
        # Validate project exists
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate datasets exist
        for dataset_id in payload.dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
        
        # Create release configuration
        config = ReleaseConfig(
            release_name=payload.release_name,
            description=payload.description,
            project_id=payload.project_id,
            dataset_ids=payload.dataset_ids,
            export_format=payload.export_format,
            task_type=payload.task_type,
            images_per_original=payload.images_per_original,
            output_format=payload.output_format,
            include_original=payload.include_original
        )
        
        # Create release controller
        controller = create_release_controller(db)
        
        # Start release generation in background
        def generate_release_task():
            try:
                release_id = controller.generate_release(config, payload.release_version)
                logger.info(f"Successfully generated release: {release_id}")
            except Exception as e:
                logger.error(f"Failed to generate release: {str(e)}")
        
        background_tasks.add_task(generate_release_task)
        
        # Return immediate response
        return {
            "message": "Release generation started",
            "status": "processing",
            "release_version": payload.release_version
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start release generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/releases/{release_id}/progress")
async def get_release_progress(release_id: str, db: Session = Depends(get_db)):
    """
    Get progress of release generation
    """
    try:
        controller = create_release_controller(db)
        progress = controller.get_release_progress(release_id)
        
        if not progress:
            # Check if release exists in database
            release = db.query(Release).filter(Release.id == release_id).first()
            if not release:
                raise HTTPException(status_code=404, detail="Release not found")
            
            # Return completed status if release exists but no progress tracking
            return ReleaseProgressResponse(
                release_id=release_id,
                status="completed",
                progress_percentage=100.0,
                current_step="completed",
                total_images=release.total_original_images or 0,
                processed_images=release.total_original_images or 0,
                generated_images=release.total_augmented_images or 0,
                completed_at=release.created_at.isoformat() if release.created_at else None
            )
        
        return ReleaseProgressResponse(
            release_id=progress.release_id,
            status=progress.status,
            progress_percentage=progress.progress_percentage,
            current_step=progress.current_step,
            total_images=progress.total_images,
            processed_images=progress.processed_images,
            generated_images=progress.generated_images,
            error_message=progress.error_message,
            started_at=progress.started_at.isoformat() if progress.started_at else None,
            completed_at=progress.completed_at.isoformat() if progress.completed_at else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get release progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/releases/history")
async def get_project_release_history(project_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get release history for a project
    """
    try:
        controller = create_release_controller(db)
        history = controller.get_release_history(project_id, limit)
        return {"releases": history}
        
    except Exception as e:
        logger.error(f"Failed to get release history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ORIGINAL ENDPOINTS (for backward compatibility)

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
            "task_type": payload.task_type,
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
            name=payload.version_name,
            description=payload.description,
            export_format=payload.export_format,
            task_type=payload.task_type,
            datasets_used=[payload.dataset_id],
            config=config_data,
            total_original_images=total_original,
            total_augmented_images=total_augmented,
            final_image_count=final_image_count,
            model_path=dummy_export_path,
            created_at=datetime.now(),
        )
        db.add(release)
        db.commit()
        
        # Update transformations status to COMPLETED and link to release
        pending_transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == payload.version_name,
            ImageTransformation.status == "PENDING"
        ).all()
        
        for transformation in pending_transformations:
            transformation.status = "COMPLETED"
            transformation.release_id = release_id
        
        db.commit()

        return {"message": "Release created", "release_id": release_id}

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/releases/{dataset_id}/history")
def get_release_history(dataset_id: str, db: Session = Depends(get_db)):
    # Find releases that include this dataset
    releases = db.query(Release).filter(
        Release.datasets_used.contains([dataset_id])
    ).order_by(Release.created_at.desc()).all()
    
    return [
        {
            "id": r.id,
            "version_name": r.name,
            "export_format": r.export_format,
            "task_type": r.task_type,
            "original_image_count": r.total_original_images,
            "augmented_image_count": r.total_augmented_images,
            "created_at": r.created_at,
        }
        for r in releases
    ]

@router.put("/releases/{release_id}/rename")
def rename_release(release_id: str, new_name: dict, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    release.name = new_name.get("name", release.name)
    db.commit()
    return {"message": "Release renamed successfully"}

@router.get("/releases/{release_id}/download")
def download_release(release_id: str, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    # Get file size if available
    file_size = 0
    if release.model_path and os.path.exists(release.model_path):
        file_size = os.path.getsize(release.model_path)

    return {
        "download_url": release.model_path,
        "size": file_size,
        "format": release.export_format,
        "task_type": release.task_type,
        "version": release.name
    }

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

@router.get("/versions")
async def get_release_versions(status: str = "PENDING", db: Session = Depends(get_db)):
    """Get all release versions by status with combination counts"""
    try:
        # Query using SQLAlchemy ORM
        results = db.query(
            ImageTransformation.release_version,
            ImageTransformation.transformation_combination_count
        ).filter(
            ImageTransformation.status == status
        ).distinct().order_by(ImageTransformation.created_at.desc()).all()
        
        versions = []
        
        for row in results:
            release_version = row[0]
            combination_count = row[1] if row[1] is not None else 1
            
            versions.append({
                "version": release_version,
                "max_combinations": combination_count
            })
        
        return {
            "success": True,
            "versions": versions,
            "count": len(versions)
        }
        
    except Exception as e:
        logger.error(f"Failed to get release versions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get release versions: {str(e)}")

@router.put("/versions/{old_version}")
async def update_release_version(old_version: str, new_version_data: dict):
    """Update release version name and recalculate combination count"""
    try:
        new_version = new_version_data.get("new_version")
        if not new_version:
            raise HTTPException(status_code=400, detail="new_version is required")
        
        db = get_db()
        cursor = db.cursor()
        
        # Get transformations for this version to recalculate combination count
        cursor.execute("""
            SELECT COUNT(*) FROM image_transformations 
            WHERE release_version = ? AND is_enabled = 1
        """, (old_version,))
        
        enabled_count = cursor.fetchone()[0]
        combination_count = max(1, (2 ** enabled_count)) if enabled_count > 0 else 1
        
        # Update release version and combination count
        cursor.execute("""
            UPDATE image_transformations 
            SET release_version = ?, transformation_combination_count = ?
            WHERE release_version = ?
        """, (new_version, combination_count, old_version))
        
        db.commit()
        db.close()
        return {
            "success": True,
            "message": f"Release version updated from '{old_version}' to '{new_version}'",
            "new_version": new_version,
            "max_combinations": combination_count
        }
        
    except Exception as e:
        logger.error(f"Failed to update release version: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update release version: {str(e)}")
