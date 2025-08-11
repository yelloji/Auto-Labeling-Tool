"""
Release API Routes for Auto-Labeling Tool
Integrates new release generation system with existing functionality
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Tuple, Dict
from datetime import datetime
import os
import json
import uuid
import shutil
import random
import logging
import yaml

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

# Note: Release paths are now project-specific: /projects/{project_name}/releases/

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
    dataset_ids: List[str]  # Changed from single dataset_id to multiple dataset_ids
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
        # Validate all datasets exist and get project_id
        datasets = []
        project_id = None
        
        for dataset_id in payload.dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
            datasets.append(dataset)
            
            # Ensure all datasets belong to the same project
            if project_id is None:
                project_id = dataset.project_id
            elif project_id != dataset.project_id:
                raise HTTPException(status_code=400, detail="All datasets must belong to the same project")

        # Get project info
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Generate release ID
        release_id = str(uuid.uuid4())
        
        # Create release configuration
        config = ReleaseConfig(
            project_id=project_id,
            dataset_ids=payload.dataset_ids,
            release_name=payload.version_name,
            description=payload.description,
            export_format=payload.export_format.lower(),
            task_type=payload.task_type,
            images_per_original=payload.multiplier,
            sampling_strategy="intelligent",
            output_format="original",
            include_original=True,
            split_sections=["train", "val", "test"],
            preserve_original_splits=True  # Always preserve original splits
        )
        
        # Calculate image counts BEFORE creating release
        total_original, split_counts = calculate_total_image_counts(db, payload.dataset_ids)
        total_augmented = total_original * (payload.multiplier - 1) if payload.multiplier > 1 else 0
        final_image_count = total_original * payload.multiplier
        
        # Create proper export path - go up 4 levels from backend/api/routes/releases.py to app-2 root
        projects_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "projects")
        releases_dir = os.path.join(projects_root, project.name, "releases")
        os.makedirs(releases_dir, exist_ok=True)
        
        zip_filename = f"{payload.version_name.replace(' ', '_')}_{payload.export_format.lower()}.zip"
        model_path = os.path.join(releases_dir, zip_filename)
        
        # Prepare config data for DB
        config_data = {
            "version_name": payload.version_name,
            "export_format": payload.export_format,
            "task_type": payload.task_type,
            "transformations": payload.transformations,
            "multiplier": payload.multiplier,
            "preserve_annotations": payload.preserve_annotations,
            "include_images": payload.include_images,
            "include_annotations": payload.include_annotations,
            "verified_only": payload.verified_only,
            "dataset_ids": payload.dataset_ids,
            "split_counts": split_counts
        }
        
        # Create release record in database
        release = Release(
            id=release_id,
            project_id=project_id,
            name=payload.version_name,
            description=payload.description,
            export_format=payload.export_format,
            task_type=payload.task_type,
            datasets_used=payload.dataset_ids,  # Store all dataset IDs
            config=config_data,
            total_original_images=total_original,
            total_augmented_images=total_augmented,
            final_image_count=final_image_count,
            model_path=model_path,
            created_at=datetime.now(),
        )
        db.add(release)
        db.flush()  # Get the ID without committing
        
        # NOW CREATE THE ACTUAL RELEASE ZIP FILE
        try:
            logger.info(f"Creating release ZIP for {len(payload.dataset_ids)} datasets with {payload.multiplier}x multiplier")
            
            # Create the complete release ZIP with proper dataset aggregation
            create_complete_release_zip(
                db=db,
                release_id=release_id,
                dataset_ids=payload.dataset_ids,
                project_name=project.name,
                config=config,
                transformations=payload.transformations,
                multiplier=payload.multiplier,
                zip_path=model_path
            )
            
            logger.info(f"Successfully created release ZIP at: {model_path}")
            
        except Exception as e:
            logger.error(f"Failed to create release ZIP: {str(e)}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create release: {str(e)}")
        
        # Update transformations status
        pending_transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == payload.version_name,
            ImageTransformation.status == "PENDING"
        ).all()
        
        for transformation in pending_transformations:
            transformation.status = "COMPLETED"
            transformation.release_id = release_id
        
        # Commit all changes
        db.commit()
        
        logger.info(f"Release created successfully: {release_id} with {final_image_count} total images")
        
        # Get the created release with all fields for frontend
        created_release = db.query(Release).filter(Release.id == release_id).first()
        
        return {
            "message": "Release created successfully", 
            "release_id": release_id,
            "model_path": model_path,
            "image_counts": {
                "original": total_original,
                "augmented": total_augmented,
                "final": final_image_count
            },
            "datasets_processed": len(payload.dataset_ids),
            # Add release object with all fields that DownloadModal expects
            "release": {
                "id": created_release.id,
                "name": created_release.name,
                "version_name": created_release.name,
                "description": created_release.description,
                "export_format": created_release.export_format,
                "task_type": created_release.task_type,
                "final_image_count": created_release.final_image_count,
                "total_original_images": created_release.total_original_images,
                "total_augmented_images": created_release.total_augmented_images,
                "original_image_count": created_release.total_original_images,  # For backward compatibility
                "augmented_image_count": created_release.total_augmented_images,  # For backward compatibility
                "created_at": created_release.created_at,
                "model_path": created_release.model_path,
                "datasets_used": created_release.datasets_used,
                "project_id": created_release.project_id
            }
        }

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error in create_release: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error in create_release: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/releases/{dataset_id}/history")
def get_release_history(dataset_id: str, db: Session = Depends(get_db)):
    # Find releases that include this dataset (handle both single and multiple dataset releases)
    releases = db.query(Release).filter(
        Release.datasets_used.contains([dataset_id])
    ).order_by(Release.created_at.desc()).all()
    
    # If no releases found with new format, try old format (backward compatibility)
    if not releases:
        releases = db.query(Release).filter(
            Release.datasets_used.like(f'%{dataset_id}%')
        ).order_by(Release.created_at.desc()).all()
    
    return [
        {
            "id": r.id,
            "version_name": r.name,
            "export_format": r.export_format,
            "task_type": r.task_type,
            "original_image_count": r.total_original_images,
            "augmented_image_count": r.total_augmented_images,
            "final_image_count": r.final_image_count,  # Add this field for frontend
            "total_original_images": r.total_original_images,  # Add this field for frontend
            "total_augmented_images": r.total_augmented_images,  # Add this field for frontend
            "created_at": r.created_at,
            "model_path": r.model_path,  # Add this for download modal
            "description": r.description,  # Add this for download modal
            "datasets_used": r.datasets_used,  # Add this to show which datasets were used
        }
        for r in releases
    ]

@router.get("/projects/{project_id}/releases")
def get_project_releases(project_id: str, db: Session = Depends(get_db)):
    """Get all releases for a project (better for multi-dataset releases)"""
    releases = db.query(Release).filter(
        Release.project_id == project_id
    ).order_by(Release.created_at.desc()).all()
    
    return [
        {
            "id": r.id,
            "name": r.name,
            "version_name": r.name,  # For backward compatibility
            "export_format": r.export_format,
            "task_type": r.task_type,
            "original_image_count": r.total_original_images,
            "augmented_image_count": r.total_augmented_images,
            "final_image_count": r.final_image_count,
            "total_original_images": r.total_original_images,
            "total_augmented_images": r.total_augmented_images,
            "created_at": r.created_at,
            "model_path": r.model_path,
            "description": r.description,
            "datasets_used": r.datasets_used,
            "project_id": r.project_id,
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
    """
    Get download information for a release
    
    Returns download URL and metadata for the release ZIP package
    """
    from fastapi.responses import FileResponse
    
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    # Get file size if available
    file_size = 0
    if release.model_path and os.path.exists(release.model_path):
        file_size = os.path.getsize(release.model_path)
        
        # Check if it's a ZIP file
        if release.model_path.endswith('.zip'):
            # Return direct download response for ZIP files
            filename = os.path.basename(release.model_path)
            return FileResponse(
                path=release.model_path,
                filename=filename,
                media_type='application/zip'
            )
    else:
        # If model_path doesn't exist, create a minimal ZIP file
        logger.warning(f"Model path {release.model_path} not found for release {release_id}. Creating a minimal ZIP file.")
        
        # Create a release controller to create a minimal ZIP file
        controller = create_release_controller(db)
        
        # Get project name for folder structure
        project = db.query(Project).filter(Project.id == release.project_id).first()
        project_name = project.name if project else f"project_{release.project_id}"
        
        # Create project-specific releases directory using the correct path structure
        # First, get the application root directory (3 levels up from this file)
        app_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        
        # Create the path: [root_folder]/projects/gevis/releases/
        projects_root = os.path.join(app_root, "projects")
        releases_dir = os.path.join(projects_root, "gevis", "releases")
        os.makedirs(releases_dir, exist_ok=True)
        
        logger.info(f"Using releases directory: {releases_dir}")
        
        # Create ZIP filename
        zip_filename = f"{release.name.replace(' ', '_')}_{release.export_format}.zip"
        zip_path = os.path.join(releases_dir, zip_filename)
        
        # Create a minimal ZIP file
        controller._create_minimal_zip_file(zip_path)
        
        # Update the release record with the new model_path
        release.model_path = zip_path
        db.commit()
        
        # Return the file response
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type='application/zip'
        )

    # For non-ZIP files or directories, return metadata
    return {
        "download_url": release.model_path,
        "size": file_size,
        "format": release.export_format,
        "task_type": release.task_type,
        "version": release.name
    }

@router.get("/releases/{release_id}/package-info")
def get_release_package_info(release_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information about the release package contents
    
    Returns metadata about the ZIP package structure, file counts, and dataset statistics
    """
    import zipfile
    import tempfile
    import json
    
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    
    # Check if release has a ZIP package
    if not release.model_path or not os.path.exists(release.model_path) or not release.model_path.endswith('.zip'):
        raise HTTPException(status_code=404, detail="Release ZIP package not found")
    
    try:
        # Extract metadata from ZIP package
        with zipfile.ZipFile(release.model_path, 'r') as zipf:
            # Get file list and count by directory
            file_counts = {
                "images": {"total": 0, "train": 0, "val": 0, "test": 0},
                "labels": {"total": 0, "train": 0, "val": 0, "test": 0},
                "metadata": 0,
                "total_files": len(zipf.namelist())
            }
            
            # Count files by directory
            for filename in zipf.namelist():
                if filename.startswith('images/'):
                    file_counts["images"]["total"] += 1
                    if 'images/train/' in filename:
                        file_counts["images"]["train"] += 1
                    elif 'images/val/' in filename:
                        file_counts["images"]["val"] += 1
                    elif 'images/test/' in filename:
                        file_counts["images"]["test"] += 1
                elif filename.startswith('labels/'):
                    file_counts["labels"]["total"] += 1
                    if 'labels/train/' in filename:
                        file_counts["labels"]["train"] += 1
                    elif 'labels/val/' in filename:
                        file_counts["labels"]["val"] += 1
                    elif 'labels/test/' in filename:
                        file_counts["labels"]["test"] += 1
                elif filename.startswith('metadata/'):
                    file_counts["metadata"] += 1
            
            # Extract metadata files
            dataset_stats = {}
            release_config = {}
            
            if 'metadata/dataset_stats.json' in zipf.namelist():
                with zipf.open('metadata/dataset_stats.json') as f:
                    dataset_stats = json.load(f)
            
            if 'metadata/release_config.json' in zipf.namelist():
                with zipf.open('metadata/release_config.json') as f:
                    release_config = json.load(f)
            
            # Get README content if available
            readme_content = ""
            if 'README.md' in zipf.namelist():
                with zipf.open('README.md') as f:
                    readme_content = f.read().decode('utf-8')
            
            return {
                "release_id": release_id,
                "release_name": release.name,
                "file_counts": file_counts,
                "dataset_stats": dataset_stats,
                "release_config": release_config,
                "readme": readme_content,
                "zip_size": os.path.getsize(release.model_path),
                "created_at": release.created_at.isoformat() if release.created_at else None
            }
    
    except Exception as e:
        logger.error(f"Failed to get package info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read ZIP package: {str(e)}")

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


# HELPER FUNCTIONS FOR PROPER RELEASE CREATION

def calculate_total_image_counts(db: Session, dataset_ids: List[str]) -> Tuple[int, Dict[str, int]]:
    """Calculate total image counts across all datasets with split breakdown"""
    total_original = 0
    split_counts = {"train": 0, "val": 0, "test": 0}
    
    for dataset_id in dataset_ids:
        # Count images by split for this dataset (use split_section instead of split_type)
        train_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_section == 'train',
            Image.is_labeled == True
        ).count()
        
        val_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_section == 'val',
            Image.is_labeled == True
        ).count()
        
        test_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_section == 'test',
            Image.is_labeled == True
        ).count()
        
        # Add to totals
        split_counts["train"] += train_count
        split_counts["val"] += val_count
        split_counts["test"] += test_count
        total_original += train_count + val_count + test_count
        
        logger.info(f"Dataset {dataset_id}: train={train_count}, val={val_count}, test={test_count}")
    
    logger.info(f"Total across all datasets: {total_original} images, splits: {split_counts}")
    return total_original, split_counts


def create_complete_release_zip(
    db: Session,
    release_id: str,
    dataset_ids: List[str],
    project_name: str,
    config: ReleaseConfig,
    transformations: List[dict],
    multiplier: int,
    zip_path: str
):
    """Create complete release ZIP with proper dataset aggregation and augmentation"""
    import tempfile
    import zipfile
    from PIL import Image as PILImage
    import io
    import yaml
    
    logger.info(f"Creating complete release ZIP for {len(dataset_ids)} datasets")
    
    # Create temporary directory for staging
    with tempfile.TemporaryDirectory() as temp_dir:
        staging_dir = os.path.join(temp_dir, "staging")
        os.makedirs(staging_dir, exist_ok=True)
        
        # Create split directories
        for split in ["train", "val", "test"]:
            os.makedirs(os.path.join(staging_dir, "images", split), exist_ok=True)
            os.makedirs(os.path.join(staging_dir, "labels", split), exist_ok=True)
        
        # Step 1: Aggregate images by split across all datasets
        all_images_by_split = {"train": [], "val": [], "test": []}
        class_names = set()
        
        for dataset_id in dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                continue
                
            logger.info(f"Processing dataset: {dataset.name}")
            
            # Get dataset path - go up one more level to get to app-2 root
            dataset_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                "projects", project_name, "dataset", dataset.name
            )
            
            if not os.path.exists(dataset_path):
                logger.warning(f"Dataset path not found: {dataset_path}")
                continue
            
            # Process each split
            for split in ["train", "val", "test"]:
                split_path = os.path.join(dataset_path, split)
                if not os.path.exists(split_path):
                    continue
                
                # Get all images in this split
                for image_file in os.listdir(split_path):
                    if image_file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                        image_path = os.path.join(split_path, image_file)
                        
                        # Get corresponding annotations from database
                        db_image = db.query(Image).filter(
                            Image.dataset_id == dataset_id,
                            Image.filename == image_file,
                            Image.split_section == split,  # Use split_section instead of split_type
                            Image.is_labeled == True
                        ).first()
                        
                        if db_image:
                            annotations = db.query(Annotation).filter(
                                Annotation.image_id == db_image.id
                            ).all()
                            
                            # Collect class names
                            for ann in annotations:
                                if hasattr(ann, 'class_name') and ann.class_name:
                                    class_names.add(ann.class_name)
                                elif hasattr(ann, 'class_id'):
                                    class_names.add(f"class_{ann.class_id}")
                            
                            all_images_by_split[split].append({
                                "image_path": image_path,
                                "filename": image_file,
                                "annotations": annotations,
                                "db_image": db_image,
                                "dataset_name": dataset.name
                            })
        
        logger.info(f"Aggregated images: train={len(all_images_by_split['train'])}, val={len(all_images_by_split['val'])}, test={len(all_images_by_split['test'])}")
        
        # Step 2: Apply augmentation to each split
        final_image_count = 0
        
        for split, images in all_images_by_split.items():
            if not images:
                continue
                
            logger.info(f"Processing {split} split with {len(images)} images, {multiplier}x multiplier")
            
            for img_data in images:
                # Copy original image
                original_filename = img_data["filename"]
                original_path = img_data["image_path"]
                
                if os.path.exists(original_path):
                    # Copy original image
                    dest_path = os.path.join(staging_dir, "images", split, original_filename)
                    shutil.copy2(original_path, dest_path)
                    
                    # Create label file
                    label_content = create_yolo_label_content(img_data["annotations"], img_data["db_image"])
                    label_filename = os.path.splitext(original_filename)[0] + ".txt"
                    label_path = os.path.join(staging_dir, "labels", split, label_filename)
                    
                    with open(label_path, 'w') as f:
                        f.write(label_content)
                    
                    final_image_count += 1
                    
                    # Generate augmented versions
                    if multiplier > 1:
                        for aug_idx in range(1, multiplier):
                            aug_filename = f"{os.path.splitext(original_filename)[0]}_aug_{aug_idx}{os.path.splitext(original_filename)[1]}"
                            aug_dest_path = os.path.join(staging_dir, "images", split, aug_filename)
                            
                            # ✅ Generate different transformations for each augmented image
                            aug_transformations = generate_augmented_transformations(transformations, aug_idx)
                            
                            # Apply transformations
                            augmented_image = apply_transformations_to_image(original_path, aug_transformations)
                            if augmented_image:
                                augmented_image.save(aug_dest_path)
                                
                                # Create corresponding label (same as original for now)
                                aug_label_filename = os.path.splitext(aug_filename)[0] + ".txt"
                                aug_label_path = os.path.join(staging_dir, "labels", split, aug_label_filename)
                                
                                with open(aug_label_path, 'w') as f:
                                    f.write(label_content)
                                
                                final_image_count += 1
        
        # Step 3: Create data.yaml
        class_list = sorted(list(class_names)) if class_names else ["class_0"]
        data_yaml = {
            "path": ".",
            "train": "images/train" if all_images_by_split["train"] else None,
            "val": "images/val" if all_images_by_split["val"] else None,
            "test": "images/test" if all_images_by_split["test"] else None,
            "nc": len(class_list),
            "names": class_list
        }
        
        # Remove None values
        data_yaml = {k: v for k, v in data_yaml.items() if v is not None}
        
        data_yaml_path = os.path.join(staging_dir, "data.yaml")
        with open(data_yaml_path, 'w') as f:
            yaml.dump(data_yaml, f, default_flow_style=False)
        
        # Step 4: Create ZIP file
        logger.info(f"Creating ZIP file with {final_image_count} total images")
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(staging_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arc_path = os.path.relpath(file_path, staging_dir)
                    zipf.write(file_path, arc_path)
        
        logger.info(f"Successfully created ZIP file: {zip_path}")


def create_yolo_label_content(annotations, db_image) -> str:
    """Create YOLO format label content from database annotations"""
    if not annotations:
        return ""
    
    lines = []
    image_width = getattr(db_image, 'width', 640)  # Default width if not available
    image_height = getattr(db_image, 'height', 480)  # Default height if not available
    
    for ann in annotations:
        # Get class ID (default to 0 if not available)
        class_id = getattr(ann, 'class_id', 0)
        
        # Get bounding box coordinates
        if hasattr(ann, 'bbox') and ann.bbox:
            # Parse bbox if it's a string
            if isinstance(ann.bbox, str):
                try:
                    bbox = json.loads(ann.bbox)
                except:
                    bbox = [0.25, 0.25, 0.75, 0.75]  # Default bbox
            else:
                bbox = ann.bbox
            
            # Convert to YOLO format (normalized center coordinates)
            x_min, y_min, x_max, y_max = bbox[:4]
            
            center_x = (x_min + x_max) / 2.0 / image_width
            center_y = (y_min + y_max) / 2.0 / image_height
            width = (x_max - x_min) / image_width
            height = (y_max - y_min) / image_height
            
            # Ensure values are within [0, 1]
            center_x = max(0, min(1, center_x))
            center_y = max(0, min(1, center_y))
            width = max(0, min(1, width))
            height = max(0, min(1, height))
            
            lines.append(f"{class_id} {center_x:.6f} {center_y:.6f} {width:.6f} {height:.6f}")
        else:
            # Default annotation if no bbox available
            lines.append(f"{class_id} 0.5 0.5 0.3 0.3")
    
    return "\n".join(lines)


def generate_augmented_transformations(base_transformations: List[dict], aug_idx: int) -> List[dict]:
    """
    Generate different transformation parameters for each augmented image
    
    For rotation 90°:
    - aug_idx=1 → -90° rotation  
    - aug_idx=2 → +90° rotation
    - aug_idx=3 → 180° rotation
    - etc.
    """
    augmented_transformations = []
    
    for transform in base_transformations:
        if transform.get("type") == "rotate":
            base_angle = transform.get("params", {}).get("angle", 0)
            
            # Generate different angles for each augmentation
            if aug_idx == 1:
                # First augmentation: negative angle
                new_angle = -base_angle
            elif aug_idx == 2:
                # Second augmentation: positive angle  
                new_angle = base_angle
            else:
                # Additional augmentations: multiples
                new_angle = base_angle * aug_idx
                
            augmented_transform = {
                "type": "rotate",
                "params": {"angle": new_angle}
            }
            augmented_transformations.append(augmented_transform)
            
        else:
            # For other transformations, keep the same for now
            augmented_transformations.append(transform.copy())
    
    return augmented_transformations


def apply_transformations_to_image(image_path: str, transformations: List[dict]):
    """Apply transformations to an image"""
    try:
        from PIL import Image as PILImage
        
        image = PILImage.open(image_path)
        
        for transform in transformations:
            if transform.get("type") == "rotate":
                angle = transform.get("params", {}).get("angle", 0)
                if angle != 0:
                    # ✅ DATA AUGMENTATION: Keep same dimensions, white background fill
                    image = image.rotate(angle, expand=False, fillcolor='white')
            # Add more transformations as needed
        
        return image
        
    except Exception as e:
        logger.error(f"Failed to apply transformations to {image_path}: {str(e)}")
        return None
