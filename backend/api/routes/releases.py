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
import yaml

# Import our new release system
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from core.release_controller import ReleaseController, ReleaseConfig, create_release_controller
from core.transformation_schema import generate_release_configurations

# Import professional logging system
from logging_system.professional_logger import get_professional_logger, log_info, log_error, log_warning, log_critical

# Initialize professional logger
logger = get_professional_logger()


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

from database.database import get_db
from database.models import Project, Dataset, Image, Annotation, Release, ImageTransformation
from pydantic import BaseModel

router = APIRouter()
# Old logger replaced with professional logger
# logger = logging.getLogger(__name__)

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
    output_format: str = "original"  # Image format: original, jpg, png, webp, bmp, tiff

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
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Starting enhanced release generation", "enhanced_release_generation_start", {
        "release_name": payload.release_name,
        "project_id": payload.project_id,
        "dataset_count": len(payload.dataset_ids),
        "export_format": payload.export_format,
        "task_type": payload.task_type,
        "images_per_original": payload.images_per_original,
        "endpoint": "/releases/generate"
    })
    
    try:
        # Validate project exists
        logger.debug("app.database", f"Validating project existence", "project_validation_start", {
            "project_id": payload.project_id
        })
        
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        if not project:
            logger.warning("errors.validation", f"Project not found", "project_not_found", {
                "project_id": payload.project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info("operations.operations", f"Project validation successful", "project_validation_success", {
            "project_id": payload.project_id,
            "project_name": project.name
        })
        
        # Validate datasets exist
        logger.debug("operations.datasets", f"Validating dataset existence", "dataset_validation_start", {
            "dataset_ids": payload.dataset_ids,
            "dataset_count": len(payload.dataset_ids)
        })
        
        for dataset_id in payload.dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                logger.warning("errors.validation", f"Dataset not found", "dataset_not_found", {
                    "dataset_id": dataset_id,
                    "project_id": payload.project_id
                })
                raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
        
        logger.info("operations.datasets", f"All datasets validated successfully", "dataset_validation_success", {
            "dataset_ids": payload.dataset_ids,
            "dataset_count": len(payload.dataset_ids),
            "project_id": payload.project_id
        })
        
        # Create release configuration
        logger.debug("operations.releases", f"Creating release configuration", "release_config_creation", {
            "release_name": payload.release_name,
            "project_id": payload.project_id,
            "export_format": payload.export_format,
            "task_type": payload.task_type
        })
        
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
        
        logger.info("operations.releases", f"Release configuration created successfully", "release_config_created", {
            "release_name": payload.release_name,
            "project_id": payload.project_id,
            "export_format": payload.export_format,
            "task_type": payload.task_type
        })
        
        # Create release controller
        logger.debug("operations.releases", f"Creating release controller", "release_controller_creation", {
            "project_id": payload.project_id
        })
        
        controller = create_release_controller(db)
        
        logger.info("operations.releases", f"Release controller created successfully", "release_controller_created", {
            "project_id": payload.project_id
        })
        
        # Start release generation in background
        logger.info("operations.releases", f"Starting background release generation task", "background_task_start", {
            "release_name": payload.release_name,
            "project_id": payload.project_id,
            "release_version": payload.release_version
        })
        
        def generate_release_task():
            try:
                release_id = controller.generate_release(config, payload.release_version)
                logger.info("operations.releases", f"Successfully generated release", "release_generated", {
                    'release_id': release_id,
                    'project_id': payload.project_id,
                    'dataset_count': len(payload.dataset_ids),
                    'release_name': payload.release_name,
                    'release_version': payload.release_version
                })
            except Exception as e:
                logger.error("errors.system", f"Failed to generate release in background task", "release_generation_error", {
                    'release_id': release_id if 'release_id' in locals() else None,
                    'project_id': payload.project_id,
                    'release_name': payload.release_name,
                    'error': str(e)
                })
        
        background_tasks.add_task(generate_release_task)
        
        logger.info("operations.releases", f"Background task added successfully", "background_task_added", {
            "release_name": payload.release_name,
            "project_id": payload.project_id,
            "release_version": payload.release_version
        })
        
        # Return immediate response
        logger.info("operations.releases", f"Enhanced release generation started successfully", "enhanced_release_started", {
            "release_name": payload.release_name,
            "project_id": payload.project_id,
            "release_version": payload.release_version,
            "status": "processing"
        })
        
        return {
            "message": "Release generation started",
            "status": "processing",
            "release_version": payload.release_version
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to start enhanced release generation", "release_start_error", {
            'project_id': payload.project_id,
            'release_name': payload.release_name,
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/releases/{release_id}/progress")
async def get_release_progress(release_id: str, db: Session = Depends(get_db)):
    """
    Get progress of release generation
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting release progress", "release_progress_request", {
        "release_id": release_id,
        "endpoint": f"/releases/{release_id}/progress"
    })
    
    try:
        logger.debug("operations.releases", f"Creating release controller for progress check", "release_controller_creation", {
            "release_id": release_id
        })
        
        controller = create_release_controller(db)
        
        logger.debug("operations.releases", f"Fetching release progress from controller", "progress_fetch_start", {
            "release_id": release_id
        })
        
        progress = controller.get_release_progress(release_id)
        
        if not progress:
            logger.debug("operations.releases", f"No progress tracking found, checking database", "database_progress_check", {
                "release_id": release_id
            })
            
            # Check if release exists in database
            release = db.query(Release).filter(Release.id == release_id).first()
            if not release:
                logger.warning("errors.validation", f"Release not found in database", "release_not_found", {
                    "release_id": release_id
                })
                raise HTTPException(status_code=404, detail="Release not found")
            
            logger.info("operations.releases", f"Release found in database, returning completed status", "release_completed_status", {
                "release_id": release_id,
                "total_images": release.total_original_images or 0,
                "generated_images": release.total_augmented_images or 0
            })
            
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
        
        logger.info("operations.releases", f"Release progress retrieved successfully", "release_progress_success", {
            "release_id": release_id,
            "status": progress.status,
            "progress_percentage": progress.progress_percentage,
            "current_step": progress.current_step,
            "total_images": progress.total_images,
            "processed_images": progress.processed_images,
            "generated_images": progress.generated_images
        })
        
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
        logger.error("errors.system", f"Failed to get release progress", "release_progress_error", {
            'release_id': release_id,
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/releases/history")
async def get_project_release_history(project_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get release history for a project
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting project release history", "project_release_history_request", {
        "project_id": project_id,
        "limit": limit,
        "endpoint": f"/projects/{project_id}/releases/history"
    })
    
    try:
        logger.debug("operations.releases", f"Creating release controller for history", "release_controller_creation", {
            "project_id": project_id
        })
        
        controller = create_release_controller(db)
        
        logger.debug("operations.releases", f"Fetching release history from controller", "history_fetch_start", {
            "project_id": project_id,
            "limit": limit
        })
        
        history = controller.get_release_history(project_id, limit)
        
        logger.info("operations.releases", f"Project release history retrieved successfully", "release_history_success", {
            "project_id": project_id,
            "history_count": len(history) if history else 0,
            "limit": limit
        })
        
        return {"releases": history}
        
    except Exception as e:
        logger.error("errors.system", f"Failed to get project release history", "release_history_error", {
            'project_id': project_id,
            'limit': limit,
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

# ORIGINAL ENDPOINTS (for backward compatibility)

@router.post("/releases/create")
def create_release(payload: ReleaseCreate, db: Session = Depends(get_db)):
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Creating new release", "release_creation_start", {
        "version_name": payload.version_name,
        "dataset_count": len(payload.dataset_ids),
        "export_format": payload.export_format,
        "task_type": payload.task_type,
        "multiplier": payload.multiplier,
        "endpoint": "/releases/create"
    })
    
    try:
        # Validate all datasets exist and get project_id
        logger.debug("operations.datasets", f"Validating datasets existence", "dataset_validation_start", {
            "dataset_ids": payload.dataset_ids,
            "dataset_count": len(payload.dataset_ids)
        })
        
        datasets = []
        project_id = None
        
        for dataset_id in payload.dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                logger.warning("errors.validation", f"Dataset not found", "dataset_not_found", {
                    "dataset_id": dataset_id
                })
                raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
            datasets.append(dataset)
            
            # Ensure all datasets belong to the same project
            if project_id is None:
                project_id = dataset.project_id
            elif project_id != dataset.project_id:
                logger.warning("errors.validation", f"Datasets belong to different projects", "project_mismatch", {
                    "dataset_id": dataset_id,
                    "expected_project_id": project_id,
                    "actual_project_id": dataset.project_id
                })
                raise HTTPException(status_code=400, detail="All datasets must belong to the same project")

        logger.info("operations.datasets", f"All datasets validated successfully", "dataset_validation_success", {
            "dataset_ids": payload.dataset_ids,
            "project_id": project_id
        })

        # Get project info
        logger.debug("app.database", f"Fetching project information", "project_fetch", {
            "project_id": project_id
        })
        
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning("errors.validation", f"Project not found", "project_not_found", {
                "project_id": project_id
            })
            raise HTTPException(status_code=404, detail="Project not found")

        logger.info("operations.operations", f"Project information retrieved", "project_fetch_success", {
            "project_id": project_id,
            "project_name": project.name
        })

        # Generate release ID
        release_id = str(uuid.uuid4())
        
        logger.debug("operations.releases", f"Generated release ID", "release_id_generated", {
            "release_id": release_id,
            "project_id": project_id
        })
        
        # Normalize transformations from various UI shapes to [{type, params}]
        def _normalize_single_transform(item: dict):
            if not isinstance(item, dict):
                return None
            if item.get("type") and isinstance(item.get("params"), dict):
                return {"type": item["type"], "params": dict(item["params"]) }
            if isinstance(item.get("config"), dict):
                keys = list(item["config"].keys())
                if len(keys) == 1:
                    t = keys[0]
                    params = dict(item["config"][t])
                    params.pop("enabled", None)
                    return {"type": t, "params": params}
            if isinstance(item.get("transformations"), dict):
                keys = list(item["transformations"].keys())
                if len(keys) == 1:
                    t = keys[0]
                    params = dict(item["transformations"][t])
                    params.pop("enabled", None)
                    return {"type": t, "params": params}
            return None

        # Normalize transformations from various UI shapes to [{type, params}]
        logger.debug("operations.transformations", f"Normalizing transformation parameters", "transformation_normalization_start", {
            "transformation_count": len(payload.transformations) if payload.transformations else 0,
            "project_id": project_id
        })
        
        normalized_transformations = []
        try:
            for itm in (payload.transformations or []):
                norm = _normalize_single_transform(itm)
                if norm:
                    normalized_transformations.append(norm)
        except Exception as _e:
            logger.warning("errors.validation", f"Failed to normalize transformations", "transformation_normalization_warning", {
                'error': str(_e),
                'project_id': project_id
            })
            normalized_transformations = payload.transformations or []
        
        logger.info("operations.transformations", f"Transformations normalized successfully", "transformation_normalization_success", {
            "original_count": len(payload.transformations) if payload.transformations else 0,
            "normalized_count": len(normalized_transformations),
            "project_id": project_id
        })
        
        # Create release configuration
        logger.debug("operations.releases", f"Creating release configuration", "release_config_creation", {
            "project_id": project_id,
            "release_name": payload.version_name,
            "export_format": payload.export_format,
            "task_type": payload.task_type,
            "multiplier": payload.multiplier
        })
        
        config = ReleaseConfig(
            project_id=project_id,
            dataset_ids=payload.dataset_ids,
            release_name=payload.version_name,
            description=payload.description,
            export_format=payload.export_format.lower(),
            task_type=payload.task_type,
            images_per_original=payload.multiplier,
            sampling_strategy="intelligent",
            output_format=payload.output_format,
            include_original=True,
            split_sections=["train", "val", "test"],
            preserve_original_splits=True  # Always preserve original splits
        )
        
        # Calculate image counts BEFORE creating release
        logger.debug("operations.operations", f"Calculating image counts", "image_count_calculation", {
            "dataset_count": len(payload.dataset_ids),
            "multiplier": payload.multiplier,
            "project_id": project_id
        })
        
        total_original, split_counts = calculate_total_image_counts(db, payload.dataset_ids)
        total_augmented = total_original * (payload.multiplier - 1) if payload.multiplier > 1 else 0
        final_image_count = total_original * payload.multiplier
        
        logger.info("operations.operations", f"Image counts calculated", "image_count_calculation_success", {
            "total_original": total_original,
            "total_augmented": total_augmented,
            "final_image_count": final_image_count,
            "split_counts": split_counts,
            "project_id": project_id
        })
        
        # Create proper export path - go up 4 levels from backend/api/routes/releases.py to app-2 root
        logger.debug("operations.exports", f"Creating export directory structure", "export_directory_creation", {
            "project_name": project.name,
            "project_id": project_id
        })
        
        projects_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "projects")
        releases_dir = os.path.join(projects_root, project.name, "releases")
        os.makedirs(releases_dir, exist_ok=True)
        
        zip_filename = f"{payload.version_name.replace(' ', '_')}_{payload.export_format.lower()}.zip"
        model_path = os.path.join(releases_dir, zip_filename)
        
        logger.info("operations.exports", f"Export path created", "export_path_created", {
            "releases_dir": releases_dir,
            "zip_filename": zip_filename,
            "model_path": model_path,
            "project_id": project_id
        })
        
        # Prepare config data for DB
        logger.debug("operations.releases", f"Preparing database configuration data", "db_config_preparation", {
            "project_id": project_id,
            "release_id": release_id
        })
        
        config_data = {
            "version_name": payload.version_name,
            "export_format": payload.export_format,
            "task_type": payload.task_type,
            "transformations": normalized_transformations,
            "multiplier": payload.multiplier,
            "preserve_annotations": payload.preserve_annotations,
            "include_images": payload.include_images,
            "include_annotations": payload.include_annotations,
            "verified_only": payload.verified_only,
            "dataset_ids": payload.dataset_ids,
            "split_counts": split_counts
        }
        
        # Create release record in database
        logger.debug("app.database", f"Creating release record in database", "release_db_creation", {
            "release_id": release_id,
            "project_id": project_id
        })
        
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
        
        logger.info("app.database", f"Release record created in database", "release_db_created", {
            "release_id": release_id,
            "project_id": project_id,
            "total_original": total_original,
            "total_augmented": total_augmented
        })
        
        # NOW CREATE THE ACTUAL RELEASE ZIP FILE
        logger.info("operations.releases", f"Starting release ZIP creation", "release_zip_creation_start", {
            'dataset_count': len(payload.dataset_ids),
            'multiplier': payload.multiplier,
            'export_format': payload.export_format,
            'task_type': payload.task_type,
            'release_id': release_id,
            'project_id': project_id
        })
        
        try:
            # Create the complete release ZIP with proper dataset aggregation
            create_complete_release_zip(
                db=db,
                release_id=release_id,
                dataset_ids=payload.dataset_ids,
                project_name=project.name,
                config=config,
                transformations=normalized_transformations,
                multiplier=payload.multiplier,
                zip_path=model_path
            )
            
            logger.info("operations.releases", f"Release ZIP created successfully", "release_zip_created", {
                'model_path': str(model_path),
                'release_id': release_id,
                'project_id': project_id
            })
            
        except Exception as e:
            logger.error("errors.system", f"Failed to create release ZIP", "release_zip_creation_error", {
                'release_id': release_id,
                'error': str(e)
            })
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create release: {str(e)}")
        
        # Update transformations status
        logger.debug("operations.transformations", f"Updating transformation status to completed", "transformation_status_update", {
            "release_id": release_id,
            "release_version": payload.version_name,
            "project_id": project_id
        })
        
        pending_transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == payload.version_name,
            ImageTransformation.status == "PENDING"
        ).all()
        
        for transformation in pending_transformations:
            transformation.status = "COMPLETED"
            transformation.release_id = release_id
        
        logger.info("operations.transformations", f"Transformations updated to completed", "transformation_status_updated", {
            "release_id": release_id,
            "transformation_count": len(pending_transformations),
            "project_id": project_id
        })
        
        # Commit all changes
        logger.debug("app.database", f"Committing all database changes", "database_commit", {
            "release_id": release_id,
            "project_id": project_id
        })
        
        db.commit()
        
        logger.info("operations.releases", f"Release created successfully", "release_creation_complete", {
            'release_id': release_id,
            'final_image_count': final_image_count,
            'dataset_count': len(payload.dataset_ids),
            'project_id': project_id,
            'export_format': payload.export_format,
            'task_type': payload.task_type
        })
        
        # Get the created release with all fields for frontend
        logger.debug("app.database", f"Fetching created release for response", "release_fetch_response", {
            "release_id": release_id,
            "project_id": project_id
        })
        
        created_release = db.query(Release).filter(Release.id == release_id).first()
        
        logger.info("operations.releases", f"Preparing successful response", "response_preparation", {
            "release_id": release_id,
            "project_id": project_id,
            "final_image_count": final_image_count
        })
        
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
        logger.error("errors.system", f"Database error in create_release", "release_database_error", {
            'error': str(e),
            'operation': 'create_release',
            'project_id': project_id,
            'release_id': release_id if 'release_id' in locals() else None
        })
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error("errors.system", f"Unexpected error in create_release", "release_unexpected_error", {
            'error': str(e),
            'operation': 'create_release',
            'project_id': project_id,
            'release_id': release_id if 'release_id' in locals() else None
        })
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/releases/{dataset_id}/history")
def get_release_history(dataset_id: str, db: Session = Depends(get_db)):
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting release history for dataset", "dataset_release_history_request", {
        "dataset_id": dataset_id,
        "endpoint": f"/releases/{dataset_id}/history"
    })
    
    try:
        logger.debug("operations.releases", f"Querying releases containing dataset", "release_query_start", {
            "dataset_id": dataset_id
        })
        
        # Find releases that include this dataset (handle both single and multiple dataset releases)
        releases = db.query(Release).filter(
            Release.datasets_used.contains([dataset_id])
        ).order_by(Release.created_at.desc()).all()
        
        logger.debug("operations.releases", f"Found {len(releases)} releases with new format", "release_query_new_format", {
            "dataset_id": dataset_id,
            "release_count": len(releases)
        })
        
        # If no releases found with new format, try old format (backward compatibility)
        if not releases:
            logger.debug("operations.releases", f"Trying old format for backward compatibility", "release_query_old_format", {
                "dataset_id": dataset_id
            })
            
            releases = db.query(Release).filter(
                Release.datasets_used.like(f'%{dataset_id}%')
            ).order_by(Release.created_at.desc()).all()
            
            logger.debug("operations.releases", f"Found {len(releases)} releases with old format", "release_query_old_format_result", {
                "dataset_id": dataset_id,
                "release_count": len(releases)
            })
        
        logger.info("operations.releases", f"Release history retrieved successfully", "release_history_success", {
            "dataset_id": dataset_id,
            "total_releases": len(releases)
        })
        
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
        
    except Exception as e:
        logger.error("errors.system", f"Failed to get release history for dataset", "dataset_release_history_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get release history: {str(e)}")

@router.get("/projects/{project_id}/releases")
def get_project_releases(project_id: str, db: Session = Depends(get_db)):
    """Get all releases for a project (better for multi-dataset releases)"""
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting all releases for project", "project_releases_request", {
        "project_id": project_id,
        "endpoint": f"/projects/{project_id}/releases"
    })
    
    try:
        logger.debug("operations.releases", f"Querying releases for project", "project_releases_query", {
            "project_id": project_id
        })
        
        releases = db.query(Release).filter(
            Release.project_id == project_id
        ).order_by(Release.created_at.desc()).all()
        
        logger.info("operations.releases", f"Project releases retrieved successfully", "project_releases_success", {
            "project_id": project_id,
            "total_releases": len(releases)
        })
        
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
        
    except Exception as e:
        logger.error("errors.system", f"Failed to get project releases", "project_releases_error", {
            "project_id": project_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get project releases: {str(e)}")

@router.put("/releases/{release_id}/rename")
def rename_release(release_id: str, new_name: dict, db: Session = Depends(get_db)):
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Renaming release", "release_rename_request", {
        "release_id": release_id,
        "new_name": new_name.get("name", "unknown"),
        "endpoint": f"/releases/{release_id}/rename"
    })
    
    try:
        logger.debug("app.database", f"Fetching release for rename", "release_fetch_rename", {
            "release_id": release_id
        })
        
        release = db.query(Release).filter(Release.id == release_id).first()
        if not release:
            logger.warning("errors.validation", f"Release not found for rename", "release_not_found_rename", {
                "release_id": release_id
            })
            raise HTTPException(status_code=404, detail="Release not found")

        old_name = release.name
        new_name_value = new_name.get("name", release.name)
        
        logger.debug("operations.releases", f"Updating release name", "release_name_update", {
            "release_id": release_id,
            "old_name": old_name,
            "new_name": new_name_value
        })

        # ✅ ENHANCED: Also rename the ZIP file if it exists
        old_zip_path = None
        new_zip_path = None
        
        if release.model_path and os.path.exists(release.model_path):
            old_zip_path = release.model_path
            zip_dir = os.path.dirname(old_zip_path)
            zip_extension = os.path.splitext(old_zip_path)[1]  # .zip
            
            # Generate new ZIP filename: {new_name}_{export_format}.zip
            new_zip_filename = f"{new_name_value}_{release.export_format.lower()}{zip_extension}"
            new_zip_path = os.path.join(zip_dir, new_zip_filename)
            
            logger.info("operations.releases", f"Renaming ZIP file", "zip_file_rename", {
                "release_id": release_id,
                "old_zip_path": old_zip_path,
                "new_zip_path": new_zip_path,
                "old_name": old_name,
                "new_name": new_name_value
            })
            
            try:
                # Rename the ZIP file
                os.rename(old_zip_path, new_zip_path)
                
                # Update the model_path in database
                release.model_path = new_zip_path
                
                logger.info("operations.releases", f"ZIP file renamed successfully", "zip_rename_success", {
                    "release_id": release_id,
                    "old_zip_path": old_zip_path,
                    "new_zip_path": new_zip_path
                })
                
            except OSError as zip_error:
                logger.warning("operations.releases", f"Failed to rename ZIP file, continuing with database update", "zip_rename_warning", {
                    "release_id": release_id,
                    "old_zip_path": old_zip_path,
                    "new_zip_path": new_zip_path,
                    "error": str(zip_error)
                })
                # Continue with database update even if ZIP rename fails

        # Update release name in database
        release.name = new_name_value
        
        # ✅ ENHANCED: Update transformation records' Release Version
        logger.info("operations.releases", f"Updating transformation records Release Version", "transformation_version_update", {
            "release_id": release_id,
            "old_name": old_name,
            "new_name": new_name_value
        })
        
        # Update all transformation records for this release
        updated_transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_id == release_id
        ).update({"release_version": new_name_value})
        
        logger.info("operations.releases", f"Transformation records updated successfully", "transformation_update_success", {
            "release_id": release_id,
            "old_name": old_name,
            "new_name": new_name_value,
            "updated_count": updated_transformations
        })
        
        db.commit()
        
        logger.info("operations.releases", f"Release renamed successfully", "release_rename_success", {
            "release_id": release_id,
            "old_name": old_name,
            "new_name": new_name_value,
            "zip_renamed": old_zip_path is not None,
            "old_zip_path": old_zip_path,
            "new_zip_path": new_zip_path
        })
        
        return {
            "message": "Release renamed successfully",
            "zip_renamed": old_zip_path is not None,
            "old_zip_path": old_zip_path,
            "new_zip_path": new_zip_path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to rename release", "release_rename_error", {
            "release_id": release_id,
            "new_name": new_name.get("name", "unknown"),
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to rename release: {str(e)}")

@router.delete("/releases/{release_id}")
def delete_release(release_id: str, db: Session = Depends(get_db)):
    """
    Delete a release completely
    
    Removes the release from database and cleans up related data
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Deleting release", "release_delete_request", {
        "release_id": release_id,
        "endpoint": f"/releases/{release_id}"
    })
    
    try:
        logger.debug("app.database", f"Fetching release for deletion", "release_fetch_delete", {
            "release_id": release_id
        })
        
        release = db.query(Release).filter(Release.id == release_id).first()
        if not release:
            logger.warning("errors.validation", f"Release not found for deletion", "release_not_found_delete", {
                "release_id": release_id
            })
            raise HTTPException(status_code=404, detail="Release not found")

        release_name = release.name
        release_id_value = release.id
        zip_file_path = release.model_path
        
        logger.info("operations.releases", f"Release found, proceeding with deletion", "release_delete_proceed", {
            "release_id": release_id,
            "release_name": release_name,
            "zip_file_path": zip_file_path
        })
        
        # ✅ STEP 1: Delete ZIP file from file system
        zip_deleted = False
        if zip_file_path and os.path.exists(zip_file_path):
            try:
                os.remove(zip_file_path)
                zip_deleted = True
                logger.info("operations.releases", f"ZIP file deleted successfully", "zip_file_delete_success", {
                    "release_id": release_id,
                    "zip_file_path": zip_file_path
                })
            except OSError as zip_error:
                logger.warning("operations.releases", f"Failed to delete ZIP file, continuing with database deletion", "zip_file_delete_warning", {
                    "release_id": release_id,
                    "zip_file_path": zip_file_path,
                    "error": str(zip_error)
                })
        
        # ✅ STEP 2: Clean up related transformations
        transformations_deleted = 0
        try:
            # Delete ALL transformations for this release (matching release_id)
            transformations = db.query(ImageTransformation).filter(
                ImageTransformation.release_id == release_id
            ).all()
            
            for transformation in transformations:
                db.delete(transformation)
                transformations_deleted += 1
            
            logger.info("operations.releases", f"Transformations cleaned up", "transformations_cleanup", {
                "release_id": release_id,
                "transformations_deleted": transformations_deleted
            })
        except Exception as transform_error:
            logger.warning("operations.releases", f"Failed to clean up transformations, continuing", "transformations_cleanup_warning", {
                "release_id": release_id,
                "error": str(transform_error)
            })
        
        # ✅ STEP 3: Delete from database
        db.delete(release)
        db.commit()
        
        logger.info("operations.releases", f"Release deleted from database successfully", "release_database_delete_success", {
            "release_id": release_id_value,
            "release_name": release_name
        })
        
        return {
            "message": "Release deleted successfully",
            "release_id": release_id_value,
            "release_name": release_name,
            "zip_deleted": zip_deleted,
            "transformations_deleted": transformations_deleted
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to delete release", "release_delete_error", {
            "release_id": release_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete release: {str(e)}")

@router.put("/releases/{release_id}/complete-transformations")
def complete_transformations(release_id: str, db: Session = Depends(get_db)):
    """
    Update transformation status from 'pending' to 'completed' for a release
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Completing transformations for release", "transformations_complete_request", {
        "release_id": release_id,
        "endpoint": f"/releases/{release_id}/complete-transformations"
    })
    
    try:
        # Check if release exists
        release = db.query(Release).filter(Release.id == release_id).first()
        if not release:
            logger.warning("errors.validation", f"Release not found for transformation completion", "release_not_found_complete", {
                "release_id": release_id
            })
            raise HTTPException(status_code=404, detail="Release not found")
        
        # Update transformation status from 'pending' to 'completed'
        updated_count = db.query(ImageTransformation).filter(
            ImageTransformation.release_id == release_id,
            ImageTransformation.status == 'pending'
        ).update({"status": "completed"})
        
        db.commit()
        
        logger.info("operations.releases", f"Transformations completed successfully", "transformations_complete_success", {
            "release_id": release_id,
            "updated_count": updated_count
        })
        
        return {
            "message": "Transformations completed successfully",
            "release_id": release_id,
            "updated_count": updated_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to complete transformations", "transformations_complete_error", {
            "release_id": release_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to complete transformations: {str(e)}")

@router.get("/releases/{release_id}/download")
def download_release(release_id: str, db: Session = Depends(get_db)):
    """
    Get download information for a release
    
    Returns download URL and metadata for the release ZIP package
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Downloading release", "release_download_request", {
        "release_id": release_id,
        "endpoint": f"/releases/{release_id}/download"
    })
    
    try:
        from fastapi.responses import FileResponse
        
        logger.debug("app.database", f"Fetching release for download", "release_fetch_download", {
            "release_id": release_id
        })
        
        release = db.query(Release).filter(Release.id == release_id).first()
        if not release:
            logger.warning("errors.validation", f"Release not found for download", "release_not_found_download", {
                "release_id": release_id
            })
            raise HTTPException(status_code=404, detail="Release not found")

        logger.info("operations.releases", f"Release found, checking file availability", "release_file_check", {
            "release_id": release_id,
            "model_path": release.model_path
        })

        # Get file size if available
        file_size = 0
        if release.model_path and os.path.exists(release.model_path):
            file_size = os.path.getsize(release.model_path)
            
            logger.debug("operations.releases", f"File exists, size: {file_size} bytes", "file_exists_download", {
                "release_id": release_id,
                "file_size": file_size,
                "model_path": release.model_path
            })
            
            # Check if it's a ZIP file
            if release.model_path.endswith('.zip'):
                # Return direct download response for ZIP files
                filename = os.path.basename(release.model_path)
                
                logger.info("operations.releases", f"Returning existing ZIP file for download", "existing_file_download", {
                    "release_id": release_id,
                    "filename": filename,
                    "file_size": file_size
                })
                
                return FileResponse(
                    path=release.model_path,
                    filename=filename,
                    media_type='application/zip'
                )
        else:
            # If model_path doesn't exist, create a minimal ZIP file
            logger.warning("operations.releases", f"Model path not found, creating minimal ZIP file", "release_model_path_missing", {
                'release_id': release_id,
                'model_path': release.model_path
            })
            
            # Create a release controller to create a minimal ZIP file
            logger.debug("operations.releases", f"Creating release controller for minimal ZIP", "controller_creation_minimal", {
                "release_id": release_id
            })
            
            controller = create_release_controller(db)
            
            # Get project name for folder structure
            logger.debug("app.database", f"Fetching project for directory structure", "project_fetch_directory", {
                "release_id": release_id,
                "project_id": release.project_id
            })
            
            project = db.query(Project).filter(Project.id == release.project_id).first()
            project_name = project.name if project else f"project_{release.project_id}"
            
            # Create project-specific releases directory using the correct path structure
            # First, get the application root directory (3 levels up from this file)
            app_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            
            # Create the path: [root_folder]/projects/gevis/releases/
            projects_root = os.path.join(app_root, "projects")
            releases_dir = os.path.join(projects_root, "gevis", "releases")
            
            logger.debug("operations.exports", f"Creating releases directory", "releases_directory_creation", {
                "releases_dir": releases_dir,
                "project_name": project_name
            })
            
            os.makedirs(releases_dir, exist_ok=True)
            
            logger.info("operations.exports", f"Using releases directory", "release_directory_setup", {
                'releases_dir': str(releases_dir)
            })
            
            # Create ZIP filename
            zip_filename = f"{release.name.replace(' ', '_')}_{release.export_format}.zip"
            zip_path = os.path.join(releases_dir, zip_filename)
            
            logger.debug("operations.exports", f"Creating minimal ZIP file", "minimal_zip_creation", {
                "zip_path": zip_path,
                "release_id": release_id
            })
            
            # Create a minimal ZIP file
            controller._create_minimal_zip_file(zip_path)
            
            # Update the release record with the new model_path
            logger.debug("app.database", f"Updating release with new model path", "release_model_path_update", {
                "release_id": release_id,
                "old_path": release.model_path,
                "new_path": zip_path
            })
            
            release.model_path = zip_path
            db.commit()
            
            logger.info("operations.releases", f"Minimal ZIP created and release updated", "minimal_zip_created", {
                "release_id": release_id,
                "zip_path": zip_path,
                "zip_filename": zip_filename
            })
            
            # Return the file response
            return FileResponse(
                path=zip_path,
                filename=zip_filename,
                media_type='application/zip'
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to download release", "release_download_error", {
            "release_id": release_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to download release: {str(e)}")

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
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting release package info", "release_package_info_request", {
        "release_id": release_id,
        "endpoint": f"/releases/{release_id}/package-info"
    })
    
    try:
        import zipfile
        import tempfile
        import json
        
        logger.debug("app.database", f"Fetching release for package info", "release_fetch_package_info", {
            "release_id": release_id
        })
        
        release = db.query(Release).filter(Release.id == release_id).first()
        if not release:
            logger.warning("errors.validation", f"Release not found for package info", "release_not_found_package_info", {
                "release_id": release_id
            })
            raise HTTPException(status_code=404, detail="Release not found")
        
        logger.debug("operations.releases", f"Release found, checking ZIP package", "zip_package_check", {
            "release_id": release_id,
            "model_path": release.model_path
        })
        
        # Check if release has a ZIP package
        if not release.model_path or not os.path.exists(release.model_path) or not release.model_path.endswith('.zip'):
            logger.warning("errors.validation", f"Release ZIP package not found", "zip_package_not_found", {
                "release_id": release_id,
                "model_path": release.model_path,
                "exists": os.path.exists(release.model_path) if release.model_path else False
            })
            raise HTTPException(status_code=404, detail="Release ZIP package not found")
        
        logger.info("operations.releases", f"ZIP package found, extracting metadata", "zip_metadata_extraction_start", {
            "release_id": release_id,
            "zip_path": release.model_path,
            "zip_size": os.path.getsize(release.model_path)
        })
        
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
                
                logger.debug("operations.releases", f"Counting files in ZIP package", "zip_file_counting", {
                    "release_id": release_id,
                    "total_files": len(zipf.namelist())
                })
                
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
                
                logger.debug("operations.releases", f"File counting completed", "file_counting_complete", {
                    "release_id": release_id,
                    "file_counts": file_counts
                })
                
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
                
                logger.info("operations.releases", f"Package info extracted successfully", "package_info_extraction_success", {
                    "release_id": release_id,
                    "total_files": file_counts["total_files"],
                    "image_count": file_counts["images"]["total"],
                    "label_count": file_counts["labels"]["total"],
                    "metadata_count": file_counts["metadata"]
                })
                
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
            logger.error("errors.system", f"Failed to extract package info from ZIP", "zip_extraction_error", {
                "release_id": release_id,
                "zip_path": release.model_path,
                "error": str(e)
            })
            raise HTTPException(status_code=500, detail=f"Failed to read ZIP package: {str(e)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to get release package info", "package_info_error", {
            "release_id": release_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get package info: {str(e)}")

@router.post("/datasets/{dataset_id}/rebalance")
def rebalance_dataset(dataset_id: str, payload: DatasetRebalanceRequest, db: Session = Depends(get_db)):
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Rebalancing dataset", "dataset_rebalance_request", {
        "dataset_id": dataset_id,
        "train_count": payload.train_count,
        "val_count": payload.val_count,
        "test_count": payload.test_count,
        "endpoint": f"/datasets/{dataset_id}/rebalance"
    })
    
    try:
        logger.debug("app.database", f"Fetching dataset for rebalance", "dataset_fetch_rebalance", {
            "dataset_id": dataset_id
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            logger.warning("errors.validation", f"Dataset not found for rebalance", "dataset_not_found_rebalance", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")

        logger.debug("operations.datasets", f"Fetching labeled images for rebalance", "labeled_images_fetch", {
            "dataset_id": dataset_id
        })

        labeled_images = db.query(Image).filter(Image.dataset_id == dataset_id, Image.is_labeled == True).all()
        total_labeled = len(labeled_images)
        total_requested = payload.train_count + payload.val_count + payload.test_count

        logger.info("operations.datasets", f"Labeled images count verified", "labeled_images_count_verified", {
            "dataset_id": dataset_id,
            "total_labeled": total_labeled,
            "total_requested": total_requested
        })

        if total_labeled != total_requested:
            logger.warning("errors.validation", f"Image count mismatch for rebalance", "image_count_mismatch", {
                "dataset_id": dataset_id,
                "total_labeled": total_labeled,
                "total_requested": total_requested
            })
            raise HTTPException(status_code=400, detail=f"Mismatch: {total_labeled} labeled vs {total_requested} requested")

        logger.debug("operations.datasets", f"Shuffling images for random distribution", "images_shuffling", {
            "dataset_id": dataset_id,
            "total_images": total_labeled
        })

        random.shuffle(labeled_images)

        splits = [
            ('train', labeled_images[:payload.train_count]),
            ('val', labeled_images[payload.train_count:payload.train_count + payload.val_count]),
            ('test', labeled_images[payload.train_count + payload.val_count:])
        ]

        logger.info("operations.datasets", f"Split configuration created", "split_configuration_created", {
            "dataset_id": dataset_id,
            "train_count": len(splits[0][1]),
            "val_count": len(splits[1][1]),
            "test_count": len(splits[2][1])
        })

        moved_files = []

        for split_name, images in splits:
            logger.debug("operations.datasets", f"Processing {split_name} split", "split_processing", {
                "dataset_id": dataset_id,
                "split_name": split_name,
                "image_count": len(images)
            })
            
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
                        logger.debug("operations.images", f"Image moved successfully", "image_moved", {
                            "dataset_id": dataset_id,
                            "image_id": image.id,
                            "old_path": str(abs_old),
                            "new_path": str(abs_new),
                            "split": split_name
                        })
                    else:
                        logger.warning("operations.images", f"Image file not found, skipping", "image_file_not_found", {
                            "dataset_id": dataset_id,
                            "image_id": image.id,
                            "file_path": str(abs_old)
                        })

                    moved_files.append({
                        "image_id": image.id,
                        "new_path": new_rel_path,
                        "new_split": split_name
                    })

                except Exception as e:
                    logger.error("errors.system", f"Failed to move image during rebalance", "image_move_error", {
                        "dataset_id": dataset_id,
                        "image_id": image.id,
                        "old_path": old_rel_path,
                        "error": str(e)
                    })
                    raise HTTPException(status_code=500, detail=f"Move failed: {e}")

        logger.info("operations.datasets", f"File moving completed", "file_moving_completed", {
            "dataset_id": dataset_id,
            "moved_files_count": len(moved_files)
        })

        # Update DB
        logger.debug("app.database", f"Updating database with new file paths", "database_path_update", {
            "dataset_id": dataset_id,
            "update_count": len(moved_files)
        })
        
        try:
            for move in moved_files:
                img = db.query(Image).filter(Image.id == move["image_id"]).first()
                if img:
                    img.file_path = move["new_path"]
                    img.split_type = "dataset"
                    img.split_section = move["new_split"]
            db.commit()
            
            logger.info("app.database", f"Database updated successfully", "database_update_success", {
                "dataset_id": dataset_id,
                "updated_images": len(moved_files)
            })
            
        except Exception as e:
            logger.error("errors.system", f"Database update failed during rebalance", "database_update_error", {
                "dataset_id": dataset_id,
                "error": str(e)
            })
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database update failed: {e}")

        logger.info("operations.datasets", f"Dataset rebalance completed successfully", "dataset_rebalance_success", {
            "dataset_id": dataset_id,
            "moved_files": len(moved_files),
            "train_count": payload.train_count,
            "val_count": payload.val_count,
            "test_count": payload.test_count
        })

        return {
            "message": f"{len(moved_files)} images reassigned successfully",
            "train": payload.train_count,
            "val": payload.val_count,
            "test": payload.test_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Unexpected error during dataset rebalance", "dataset_rebalance_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Dataset rebalance failed: {str(e)}")

@router.get("/datasets/{dataset_id}/stats")
def get_dataset_stats(dataset_id: str, db: Session = Depends(get_db)):
    """
    Get current dataset statistics including split counts
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting dataset statistics", "dataset_stats_request", {
        "dataset_id": dataset_id,
        "endpoint": f"/datasets/{dataset_id}/stats"
    })
    
    try:
        # Validate dataset exists
        logger.debug("app.database", f"Validating dataset existence", "dataset_validation_stats", {
            "dataset_id": dataset_id
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            logger.warning("errors.validation", f"Dataset not found for stats", "dataset_not_found_stats", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")

        logger.info("operations.datasets", f"Dataset found, calculating statistics", "dataset_stats_calculation", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        })

        # Get split counts
        logger.debug("operations.datasets", f"Counting train split images", "train_count_query", {
            "dataset_id": dataset_id
        })
        
        train_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_type == 'train',
            Image.is_labeled == True
        ).count()
        
        logger.debug("operations.datasets", f"Counting validation split images", "val_count_query", {
            "dataset_id": dataset_id
        })
        
        val_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_type == 'val',
            Image.is_labeled == True
        ).count()
        
        logger.debug("operations.datasets", f"Counting test split images", "test_count_query", {
            "dataset_id": dataset_id
        })
        
        test_count = db.query(Image).filter(
            Image.dataset_id == dataset_id,
            Image.split_type == 'test',
            Image.is_labeled == True
        ).count()
        
        total_labeled = train_count + val_count + test_count
        
        logger.debug("operations.datasets", f"Counting total images", "total_images_query", {
            "dataset_id": dataset_id
        })
        
        # Get total images (including unlabeled)
        total_images = db.query(Image).filter(Image.dataset_id == dataset_id).count()
        unlabeled_count = total_images - total_labeled

        logger.info("operations.datasets", f"Dataset statistics calculated successfully", "dataset_stats_success", {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "total_images": total_images,
            "total_labeled": total_labeled,
            "unlabeled_count": unlabeled_count,
            "train_count": train_count,
            "val_count": val_count,
            "test_count": test_count
        })

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
        logger.error("errors.system", f"Failed to get dataset statistics", "dataset_stats_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to get dataset stats: {str(e)}")

@router.get("/versions")
async def get_release_versions(status: str = "PENDING", db: Session = Depends(get_db)):
    """Get all release versions by status with combination counts"""
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Getting release versions", "release_versions_request", {
        "status": status,
        "endpoint": "/versions"
    })
    
    try:
        logger.debug("operations.releases", f"Querying release versions by status", "release_versions_query", {
            "status": status
        })
        
        # Query using SQLAlchemy ORM
        results = db.query(
            ImageTransformation.release_version,
            ImageTransformation.transformation_combination_count
        ).filter(
            ImageTransformation.status == status
        ).distinct().order_by(ImageTransformation.created_at.desc()).all()
        
        logger.debug("operations.releases", f"Query results received", "query_results_received", {
            "status": status,
            "result_count": len(results)
        })
        
        versions = []
        
        for row in results:
            release_version = row[0]
            combination_count = row[1] if row[1] is not None else 1
            
            versions.append({
                "version": release_version,
                "max_combinations": combination_count
            })
        
        logger.info("operations.releases", f"Release versions retrieved successfully", "release_versions_success", {
            "status": status,
            "version_count": len(versions)
        })
        
        return {
            "success": True,
            "versions": versions,
            "count": len(versions)
        }
        
    except Exception as e:
        logger.error("errors.system", f"Failed to get release versions", "release_versions_error", {
            'error': str(e),
            'status': status
        })
        raise HTTPException(status_code=500, detail=f"Failed to get release versions: {str(e)}")

@router.put("/versions/{old_version}")
async def update_release_version(old_version: str, new_version_data: dict):
    """Update release version name and recalculate combination count"""
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Updating release version", "release_version_update_request", {
        "old_version": old_version,
        "new_version_data": new_version_data,
        "endpoint": f"/versions/{old_version}"
    })
    
    try:
        new_version = new_version_data.get("new_version")
        if not new_version:
            logger.warning("errors.validation", f"New version not provided", "new_version_missing", {
                "old_version": old_version,
                "new_version_data": new_version_data
            })
            raise HTTPException(status_code=400, detail="new_version is required")
        
        logger.debug("operations.releases", f"New version validated", "new_version_validated", {
            "old_version": old_version,
            "new_version": new_version
        })
        
        db = get_db()
        cursor = db.cursor()
        
        logger.debug("operations.releases", f"Querying enabled transformations for version", "enabled_transformations_query", {
            "old_version": old_version
        })
        
        # Get transformations for this version to recalculate combination count
        cursor.execute("""
            SELECT COUNT(*) FROM image_transformations 
            WHERE release_version = ? AND is_enabled = 1
        """, (old_version,))
        
        enabled_count = cursor.fetchone()[0]
        combination_count = max(1, (2 ** enabled_count)) if enabled_count > 0 else 1
        
        logger.info("operations.releases", f"Combination count calculated", "combination_count_calculated", {
            "old_version": old_version,
            "enabled_count": enabled_count,
            "combination_count": combination_count
        })
        
        logger.debug("operations.releases", f"Updating database with new version", "database_version_update", {
            "old_version": old_version,
            "new_version": new_version,
            "combination_count": combination_count
        })
        
        # Update release version and combination count
        cursor.execute("""
            UPDATE image_transformations 
            SET release_version = ?, transformation_combination_count = ?
            WHERE release_version = ?
        """, (new_version, combination_count, old_version))
        
        db.commit()
        db.close()
        
        logger.info("operations.releases", f"Release version updated successfully", "release_version_update_success", {
            "old_version": old_version,
            "new_version": new_version,
            "combination_count": combination_count
        })
        
        return {
            "success": True,
            "message": f"Release version updated from '{old_version}' to '{new_version}'",
            "new_version": new_version,
            "max_combinations": combination_count
        }
        
    except Exception as e:
        logger.error("errors.system", f"Failed to update release version", "release_version_update_error", {
            'error': str(e),
            'old_version': old_version,
            'new_version': new_version if 'new_version' in locals() else None
        })
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
        
        logger.info("operations.datasets", f"Dataset split counts calculated", "dataset_split_info", {
            'dataset_id': dataset_id,
            'train_count': train_count,
            'val_count': val_count,
            'test_count': test_count
        })
    
    logger.info("operations.datasets", f"Total image counts across all datasets", "total_datasets_summary", {
        'total_original': total_original,
        'split_counts': split_counts,
        'dataset_count': len(dataset_ids)
    })
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
    
    logger.info("operations.releases", f"Creating complete release ZIP", "release_zip_creation_start", {
        'dataset_count': len(dataset_ids),
        'multiplier': multiplier
    })
    
    # Prefer a project-local staging dir (same drive as final ZIP) to avoid Windows temp issues
    # Use a hidden staging directory (prefixed with a dot) so it isn't visible to users
    staging_root = os.path.join(os.path.dirname(zip_path), f".staging_{release_id}")
    if os.path.exists(staging_root):
        try:
            shutil.rmtree(staging_root, ignore_errors=True)
            logger.debug("operations.releases", f"Cleaned up existing staging directory", "staging_cleanup_success", {
                'staging_root': staging_root
            })
        except Exception as _e:
            logger.warning("errors.system", f"Failed to clean up staging directory", "staging_cleanup_failure", {
                'staging_root': staging_root,
                'error': str(_e)
            })
    os.makedirs(staging_root, exist_ok=True)
    # On Windows, also mark the folder as hidden
    try:
        if os.name == 'nt':
            import ctypes
            FILE_ATTRIBUTE_HIDDEN = 0x02
            ctypes.windll.kernel32.SetFileAttributesW(staging_root, FILE_ATTRIBUTE_HIDDEN)
            logger.debug("operations.releases", f"Set Windows hidden attribute", "windows_hidden_attribute_set", {
                'staging_root': staging_root
            })
    except Exception as _e:
        logger.debug("errors.system", f"Failed to set Windows hidden attribute", "windows_hidden_attribute_failure", {
            'staging_root': staging_root,
            'error': str(_e)
        })
    staging_dir = os.path.join(staging_root, "staging")
    os.makedirs(staging_dir, exist_ok=True)
    # Initialize centralized image format engine once per ZIP build
    try:
        from core.image_generator import create_augmentation_engine
        image_format_engine = create_augmentation_engine(staging_dir)
        logger.debug("operations.images", f"Image format engine initialized", "image_format_engine_success", {
            'staging_dir': staging_dir
        })
    except Exception as _e:
        logger.warning("errors.system", f"Failed to initialize image format engine, using fallback", "image_format_engine_fallback", {
            'staging_dir': staging_dir,
            'error': str(_e)
        })
        image_format_engine = None
    try:
        
        # Create split directories
        for split in ["train", "val", "test"]:
            os.makedirs(os.path.join(staging_dir, "images", split), exist_ok=True)
            os.makedirs(os.path.join(staging_dir, "labels", split), exist_ok=True)
        
        # Step 0: Build dual-value map from DB if available for this release version
        db_dual_value_map = {}
        try:
            release_version = getattr(config, 'release_name', None) or getattr(config, 'project_id', None)  # attempt to get version name
            # Prefer config.release_name which is payload.version_name in create_release
            release_version = getattr(config, 'release_name', None)
            if release_version:
                db_transforms = db.query(ImageTransformation).filter(
                    ImageTransformation.release_version == release_version
                ).all()
                for t in db_transforms:
                    # Expect dual_value_parameters like {"angle": {"user_value": x, "auto_value": y}}
                    if getattr(t, 'dual_value_enabled', False) and getattr(t, 'dual_value_parameters', None):
                        db_dual_value_map.setdefault(t.transformation_type, {}).update(t.dual_value_parameters)
        except Exception as _e:
            logger.warning("errors.system", f"Failed building DB dual-value map", "dual_value_map_error", {
                'error': str(_e)
            })
        
        # Step 1: Aggregate images by split across all datasets
        all_images_by_split = {"train": [], "val": [], "test": []}
        class_names = set()
        class_id_to_name = {}
        
        for dataset_id in dataset_ids:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if not dataset:
                continue
                
            logger.info("operations.datasets", f"Processing dataset", "dataset_processing", {
                'dataset_name': dataset.name,
                'dataset_id': dataset_id
            })
            
            # Get dataset path - go up one more level to get to app-2 root
            dataset_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                "projects", project_name, "dataset", dataset.name
            )
            
            if not os.path.exists(dataset_path):
                logger.warning("operations.datasets", f"Dataset path not found", "dataset_path_missing", {
                    'dataset_path': dataset_path,
                    'dataset_name': dataset.name
                })
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
                            Image.split_section == split  # Use split_section instead of split_type
                        ).first()
                        
                        # Include all images, whether they have annotations or not
                        annotations = []
                        if db_image:
                            annotations = db.query(Annotation).filter(
                                Annotation.image_id == db_image.id
                            ).all()
                            
                            # Collect class names and build class_id_to_name mapping
                            for ann in annotations:
                                cid = getattr(ann, 'class_id', None)
                                cname = getattr(ann, 'class_name', None)
                                if cid is not None:
                                    if not cname or not isinstance(cname, str) or not cname.strip():
                                        cname = f"class_{cid}"
                                    class_id_to_name[int(cid)] = cname
                                if cname:
                                    class_names.add(cname)
                        
                        # Add image to processing list regardless of annotation status
                        all_images_by_split[split].append({
                            "image_path": image_path,
                            "filename": image_file,
                            "annotations": annotations,
                            "db_image": db_image,
                            "dataset_name": dataset.name
                        })
        
        logger.info("operations.images", f"Images aggregated by split", "images_aggregated", {
            'train_count': len(all_images_by_split['train']),
            'val_count': len(all_images_by_split['val']),
            'test_count': len(all_images_by_split['test'])
        })

        # Build consistent class index mapping for YOLO labels based on unique class names
        # Collect all unique class names from annotations across all datasets for the project
        all_unique_class_names = set()
        try:
            for split_name in ['train', 'val', 'test']:
                for image_data in all_images_by_split[split_name]:
                    for ann in image_data.get('annotations', []):
                        cname = ann.class_name
                        if cname and isinstance(cname, str) and cname.strip():
                            all_unique_class_names.add(cname.strip())
        except Exception as e:
            logger.error("errors.system", f"Error collecting unique class names: {str(e)}", "class_name_collection_error", {
                'release_id': release_id,
                'error': str(e)
            })
            raise

        # Ensure a stable order for class names and assign YOLO IDs
        sorted_unique_class_names = sorted(list(all_unique_class_names))
        if not sorted_unique_class_names:
            sorted_unique_class_names = ["class_0"] # Default if no classes found

        class_name_to_yolo_id = {name: idx for idx, name in enumerate(sorted_unique_class_names)}
        yolo_id_to_class_name = {idx: name for name, idx in class_name_to_yolo_id.items()}
        class_list_for_yaml = sorted_unique_class_names

        # The original class_id_to_name and related mappings are no longer directly used for YOLO indexing
        # but might be needed for other internal logic. We will keep it populated from the initial loop.
        # However, for YOLO labels and data.yaml, we will use the new class_name_to_yolo_id mapping.
        def resolve_class_index(ann) -> int:
             try:
                 cname = getattr(ann, 'class_name', None)
                 if cname and cname in class_name_to_yolo_id:
                     return class_name_to_yolo_id[cname]
             except Exception:
                 pass
             return 0

        # Prepare central schema once for priority-order generation
        schema = None
        try:
            from core.transformation_schema import TransformationSchema
            schema = TransformationSchema()
            schema.load_from_database_records([
                {
                    'transformation_type': t.get('type'),
                    'parameters': t.get('params', {}),
                    'is_enabled': True,
                    'order_index': idx
                } for idx, t in enumerate(transformations or [])
            ])
            # images_per_original means augmented images per original (exclude original)
            schema.set_sampling_config(images_per_original=max(0, multiplier - 1), strategy="intelligent")
            logger.debug("operations.transformations", f"Transformation schema initialized successfully", "schema_init_success", {
                'transformation_count': len(transformations or []),
                'multiplier': multiplier
            })
        except Exception as _e:
            logger.warning("errors.system", f"Schema initialization failed, will use fallback generation", "schema_init_fallback", {
                'error': str(_e)
            })

        # Baseline resize params if present (applied to all outputs)
        resize_baseline_params = None
        try:
            for bt in (transformations or []):
                if bt.get("type") == "resize":
                    rp = dict(bt.get("params", {}))
                    rp["enabled"] = True
                    resize_baseline_params = rp
                    logger.debug("operations.transformations", f"Found baseline resize parameters", "baseline_resize_found", {
                        'resize_params': rp
                    })
                    break
        except Exception as _e:
            logger.warning("errors.system", f"Failed to process baseline resize parameters", "baseline_resize_failure", {
                'error': str(_e)
            })
            resize_baseline_params = None
        
        # Step 2: Apply augmentation to each split
        final_image_count = 0
        
        for split, images in all_images_by_split.items():
            if not images:
                continue
                
            logger.info("operations.images", f"Processing split with images", "split_processing", {
                'split': split,
                'image_count': len(images),
                'multiplier': multiplier
            })

            # Compute a cap on unique variants per original using central schema rules
            try:
                from core.transformation_schema import TransformationSchema
                schema = TransformationSchema()
                schema.load_from_database_records([
                    {
                        'transformation_type': t.get('type'),
                        'parameters': t.get('params', {}),
                        'is_enabled': True,
                        'order_index': idx
                    } for idx, t in enumerate(transformations or [])
                ])
                # Set proper sampling configuration to enable Priority 3 combinations
                from core.transformation_config import calculate_max_images_per_original
                transformation_list = [
                    {
                        'transformation_type': t.get('type'),
                        'enabled': True,
                        'parameters': t.get('params', {})
                    } for t in (transformations or [])
                ]
                max_images_result = calculate_max_images_per_original(transformation_list)
                max_images = max_images_result.get('max', 6)  # Default to 6 for brightness+flip
                schema.set_sampling_config(
                    images_per_original=max_images,
                    strategy="intelligent",
                    fixed_combinations=0
                )
                total_with_original = schema.get_combination_count_estimate()
                variant_cap = max(0, int(total_with_original) - 1)
            except Exception:
                variant_cap = max(0, (len(transformations or []) > 0) and 1 or 0)
            effective_multiplier = 1 + max(0, min((multiplier - 1), variant_cap))
            # Extra safety: ensure split directories exist
            try:
                safe_split = split if split in ["train", "val", "test"] else "train"
                os.makedirs(os.path.join(staging_dir, "images", safe_split), exist_ok=True)
                os.makedirs(os.path.join(staging_dir, "labels", safe_split), exist_ok=True)
            except Exception as _e:
                logger.warning("errors.system", f"Failed to ensure split directories", "split_directory_error", {
                    'split': split,
                    'error': str(_e)
                })
            
            for img_data in images:
                # Copy original image
                original_filename = img_data["filename"]
                original_path = img_data["image_path"]
                
                if os.path.exists(original_path):
                    # Destination path for original image in staging
                    safe_split = split if split in ["train", "val", "test"] else "train"
                    # Decide target extension based on selected output_format
                    try:
                        _fmt = (getattr(config, 'output_format', 'original') or 'original').lower()
                        if _fmt == 'jpeg':
                            _fmt = 'jpg'
                        _base_name, _orig_ext_with_dot = os.path.splitext(original_filename)
                        _orig_ext = _orig_ext_with_dot.lstrip('.').lower()
                        _target_ext = _orig_ext if _fmt == 'original' else _fmt
                        output_filename = f"{_base_name}.{_target_ext}"
                    except Exception:
                        # Fallback to original filename
                        _base_name, _ = os.path.splitext(original_filename)
                        output_filename = original_filename
                        _fmt = getattr(config, 'output_format', 'original')
                    dest_path = os.path.join(staging_dir, "images", safe_split, output_filename)
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

                    # If a resize transformation is present, apply it to originals too
                    resize_only_config = None
                    try:
                        for t in (transformations or []):
                            if t.get("type") == "resize":
                                params = dict(t.get("params", {}))
                                params["enabled"] = True
                                resize_only_config = {"resize": params}
                                break
                    except Exception:
                        resize_only_config = None

                    if resize_only_config:
                        try:
                            from ..services.image_transformer import ImageTransformer as FullTransformer
                            transformer = FullTransformer()
                            from PIL import Image as PILImage
                            pil_img = PILImage.open(original_path).convert('RGB')
                            resized_img = transformer.apply_transformations(pil_img, resize_only_config)
                            # Use centralized format conversion
                            if image_format_engine is not None:
                                image_format_engine._save_image_with_format(resized_img, dest_path, config.output_format)
                            else:
                                resized_img.save(dest_path)
                            # Explicitly close PIL images
                            pil_img.close()
                            resized_img.close()
                        except Exception as _e:
                            logger.warning("errors.system", f"Failed to apply resize to original, copying instead", "resize_fallback_copy", {
                                'original_path': original_path,
                                'error': str(_e)
                            })
                            try:
                                shutil.copy2(original_path, dest_path)
                            except Exception as _e2:
                                logger.warning("errors.system", f"copy2 failed, falling back to manual copy", "copy2_fallback", {
                                    'source': original_path,
                                    'destination': dest_path,
                                    'error': str(_e2)
                                })
                                try:
                                    with open(original_path, 'rb') as src, open(dest_path, 'wb') as dst:
                                        dst.write(src.read())
                                except Exception as _e3:
                                    logger.error("errors.system", f"Manual copy failed", "manual_copy_error", {
                                        'source': original_path,
                                        'destination': dest_path,
                                        'error': str(_e3)
                                    })
                                    raise
                    else:
                        # No resize requested → copy original with format conversion
                        try:
                            from PIL import Image as PILImage
                            pil_img = PILImage.open(original_path).convert('RGB')
                            # Use centralized format conversion
                            if image_format_engine is not None:
                                image_format_engine._save_image_with_format(pil_img, dest_path, config.output_format)
                            else:
                                pil_img.save(dest_path)
                            # Explicitly close PIL image
                            pil_img.close()
                        except Exception as _e2:
                            logger.warning("errors.system", f"Format conversion failed, falling back to copy", "format_conversion_fallback", {
                                'original_path': original_path,
                                'target_format': getattr(config, 'output_format', 'original'),
                                'error': str(_e2)
                            })
                            try:
                                shutil.copy2(original_path, dest_path)
                            except Exception as _e3:
                                logger.warning("errors.system", f"copy2 failed, falling back to manual copy", "copy2_fallback_format", {
                                    'source': original_path,
                                    'destination': dest_path,
                                    'error': str(_e3)
                                })
                                try:
                                    with open(original_path, 'rb') as src, open(dest_path, 'wb') as dst:
                                        dst.write(src.read())
                                except Exception as _e4:
                                    logger.error("errors.system", f"Manual copy failed", "manual_copy_format_error", {
                                        'source': original_path,
                                        'destination': dest_path,
                                        'error': str(_e4)
                                    })
                                    raise
                    
                    # Create label file (choose detection vs segmentation)
                    try:
                        if config and getattr(config, 'task_type', None) == 'segmentation' and getattr(config, 'export_format', '').lower() in ["yolo", "yolo_segmentation"]:
                            label_mode = "yolo_segmentation"
                        else:
                            label_mode = "yolo_detection"
                    except Exception:
                        label_mode = "yolo_detection"

                    # Write labels for original: if resize is applied, transform labels accordingly
                    # Ensure label matches the output image base name
                    label_filename = os.path.splitext(output_filename)[0] + ".txt"
                    label_path = os.path.join(staging_dir, "labels", safe_split, label_filename)
                    os.makedirs(os.path.dirname(label_path), exist_ok=True)
                    # Initialize label_content to avoid reference before assignment
                    label_content = None
                    try:
                        if resize_only_config and label_mode == "yolo_detection":
                            from core.annotation_transformer import transform_detection_annotations_to_yolo
                            # If resize applied, use resulting size; otherwise db image size
                            try:
                                from PIL import Image as PILImage
                                _tmp_img = PILImage.open(dest_path)
                                img_w, img_h = _tmp_img.size
                                _tmp_img.close()  # Close the temporary image
                            except Exception:
                                img_w = int(getattr(img_data["db_image"], 'width', 640))
                                img_h = int(getattr(img_data["db_image"], 'height', 480))
                            yolo_lines = transform_detection_annotations_to_yolo(
                                annotations=img_data["annotations"],
                                img_w=img_w,
                                img_h=img_h,
                                transform_config=resize_only_config,
                                class_index_resolver=resolve_class_index,
                            )
                            label_content = "\n".join(yolo_lines)
                            with open(label_path, 'w') as f:
                                f.write(label_content)
                        elif resize_only_config and label_mode == "yolo_segmentation":
                            from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                            try:
                                from PIL import Image as PILImage
                                _tmp_img = PILImage.open(dest_path)
                                img_w, img_h = _tmp_img.size
                                _tmp_img.close()  # Close the temporary image
                            except Exception:
                                img_w = int(getattr(img_data["db_image"], 'width', 640))
                                img_h = int(getattr(img_data["db_image"], 'height', 480))
                            seg_lines = transform_segmentation_annotations_to_yolo(
                                annotations=img_data["annotations"],
                                img_w=img_w,
                                img_h=img_h,
                                transform_config=resize_only_config,
                                class_index_resolver=resolve_class_index,
                            )
                            label_content = "\n".join(seg_lines)
                            with open(label_path, 'w') as f:
                                f.write(label_content)
                        else:
                            # No resize: use original content
                            label_content = create_yolo_label_content(img_data["annotations"], img_data["db_image"], mode=label_mode, class_index_resolver=resolve_class_index)
                            with open(label_path, 'w') as f:
                                f.write(label_content)
                    except Exception as _e:
                        logger.warning("errors.system", f"Failed to write original labels (resize-aware)", "original_labels_write_error", {
                            'original_filename': original_filename,
                            'error': str(_e)
                        })
                        label_content = create_yolo_label_content(img_data["annotations"], img_data["db_image"], mode=label_mode)
                        with open(label_path, 'w') as f:
                            f.write(label_content)
                    
                    final_image_count += 1
                    
                    # Generate augmented versions (schema-driven priority order)
                    # Use schema's combination count - centralized function already includes original
                    schema_combination_count = schema.get_combination_count_estimate() if schema else 1
                    num_aug_to_generate = max(0, schema_combination_count - 1)  # Subtract 1 for original
                    aug_plan = []
                    if schema:
                        try:
                            image_id_local = os.path.splitext(original_filename)[0]
                            aug_plan = schema.generate_transformation_configs_for_image(image_id_local)[:num_aug_to_generate]
                        except Exception as _e:
                            logger.warning("errors.system", f"Schema plan failed", "schema_plan_error", {
                                'original_filename': original_filename,
                                'error': str(_e)
                            })
                            aug_plan = []
                    if not aug_plan and num_aug_to_generate > 0:
                        # Fallback: replicate payload transformations as a single plan
                        base_transforms_dict = {}
                        for t in (transformations or []):
                            t_type = t.get('type')
                            if t_type:
                                base_transforms_dict[t_type] = t.get('params', {})
                        aug_plan = [{"transformations": base_transforms_dict} for _ in range(num_aug_to_generate)]

                    for aug_idx, plan in enumerate(aug_plan, start=1):
                        # Generate descriptive suffix based on transformations
                        transformations_dict = plan.get('transformations', {})
                        descriptive_suffix = generate_descriptive_suffix(transformations_dict)
                        # Build augmented filename honoring output_format
                        try:
                            _fmt = (getattr(config, 'output_format', 'original') or 'original').lower()
                            if _fmt == 'jpeg':
                                _fmt = 'jpg'
                            _base_name, _orig_ext_with_dot = os.path.splitext(original_filename)
                            _orig_ext = _orig_ext_with_dot.lstrip('.').lower()
                            _target_ext = _orig_ext if _fmt == 'original' else _fmt
                            aug_filename = f"{_base_name}_{descriptive_suffix}.{_target_ext}"
                        except Exception:
                            aug_filename = f"{os.path.splitext(original_filename)[0]}_{descriptive_suffix}{os.path.splitext(original_filename)[1]}"
                        aug_dest_path = os.path.join(staging_dir, "images", safe_split, aug_filename)
                        os.makedirs(os.path.dirname(aug_dest_path), exist_ok=True)
                        
                        # Use centralized ImageTransformer for all tool types
                        try:
                            from ..services.image_transformer import ImageTransformer as FullTransformer
                            transformer = FullTransformer()
                            # Build config dict from schema plan
                            config_dict = {}
                            try:
                                for k, v in (plan.get('transformations') or {}).items():
                                    cfg = dict(v)
                                    cfg["enabled"] = True
                                    config_dict[k] = cfg
                            except Exception:
                                pass
                            # Append baseline resize last
                            resize_params_for_aug = resize_baseline_params
                            if resize_params_for_aug:
                                config_dict["resize"] = resize_params_for_aug
                            # Load PIL image and apply
                            from PIL import Image as PILImage
                            pil_img = PILImage.open(original_path).convert('RGB')
                            augmented_image = transformer.apply_transformations(pil_img, config_dict)
                            # Close the original PIL image
                            pil_img.close()
                        except Exception as _e:
                            logger.warning("errors.system", f"Falling back to simple apply", "simple_apply_fallback", {
                                'original_path': original_path,
                                'error': str(_e)
                            })
                            augmented_image = None
                        if augmented_image:
                                # Safety: if resize target specified, enforce final size
                                try:
                                    if resize_params_for_aug:
                                        target_w = int(resize_params_for_aug.get("width") or 0)
                                        target_h = int(resize_params_for_aug.get("height") or 0)
                                        if target_w > 0 and target_h > 0:
                                            if augmented_image.size != (target_w, target_h):
                                                augmented_image = augmented_image.resize((target_w, target_h))
                                except Exception:
                                    pass
                                # Use centralized format conversion for augmented images
                                if image_format_engine is not None:
                                    image_format_engine._save_image_with_format(augmented_image, aug_dest_path, config.output_format)
                                else:
                                    augmented_image.save(aug_dest_path)
                                
                                # Create corresponding label updated for transforms (use same descriptive naming)
                                aug_label_filename = os.path.splitext(aug_filename)[0] + ".txt"
                                aug_label_path = os.path.join(staging_dir, "labels", safe_split, aug_label_filename)
                                os.makedirs(os.path.dirname(aug_label_path), exist_ok=True)
                                try:
                                    if label_mode == "yolo_detection":
                                        from core.annotation_transformer import transform_detection_annotations_to_yolo
                                        img_w, img_h = augmented_image.size
                                        yolo_lines = transform_detection_annotations_to_yolo(
                                            annotations=img_data["annotations"],
                                            img_w=img_w,
                                            img_h=img_h,
                                            transform_config=config_dict,
                                            class_index_resolver=resolve_class_index,
                                        )
                                        with open(aug_label_path, 'w') as f:
                                            f.write("\n".join(yolo_lines))
                                    elif label_mode == "yolo_segmentation":
                                        from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                                        img_w, img_h = augmented_image.size
                                        seg_lines = transform_segmentation_annotations_to_yolo(
                                            annotations=img_data["annotations"],
                                            img_w=img_w,
                                            img_h=img_h,
                                            transform_config=config_dict,
                                            class_index_resolver=resolve_class_index,
                                        )
                                        with open(aug_label_path, 'w') as f:
                                            f.write("\n".join(seg_lines))
                                    else:
                                        with open(aug_label_path, 'w') as f:
                                            f.write("")
                                except Exception as _e:
                                    logger.warning("errors.system", f"Failed to create transformed aug labels", "aug_labels_creation_error", {
                                        'aug_filename': aug_filename,
                                        'error': str(_e)
                                    })
                                    with open(aug_label_path, 'w') as f:
                                        f.write(create_yolo_label_content(img_data["annotations"], img_data["db_image"], mode=label_mode))
                                
                                final_image_count += 1
        
        # Step 3: Create data.yaml
        # Use the exact ordered class list used by the resolver
        class_list = class_list_for_yaml
        data_yaml = {
            "path": ".",
            "train": "images/train" if all_images_by_split["train"] else None,
            "val": "images/val" if all_images_by_split["val"] else None,
            "test": "images/test" if all_images_by_split["test"] else None,
            "nc": len(class_list_for_yaml),
            "names": class_list_for_yaml
        }
        
        # Remove None values
        data_yaml = {k: v for k, v in data_yaml.items() if v is not None}
        
        data_yaml_path = os.path.join(staging_dir, "data.yaml")
        with open(data_yaml_path, 'w') as f:
            yaml.dump(data_yaml, f, default_flow_style=False)
        
        # Step 4: Create ZIP file
        logger.info("operations.releases", f"Creating ZIP file with {final_image_count} total images", "zip_creation_start", {
            'final_image_count': final_image_count,
            'zip_path': str(zip_path)
        })
        
        # Force close any open file handles before ZIP creation
        import gc
        gc.collect()
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(staging_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arc_path = os.path.relpath(file_path, staging_dir)
                    try:
                        zipf.write(file_path, arc_path)
                    except Exception as e:
                        logger.error("errors.system", f"Error writing file to zip: {file_path} - {str(e)}", "zip_file_write_error", {
                            'release_id': release_id,
                            'file_path': file_path,
                            'error': str(e)
                        })
                        raise
        
        logger.info("operations.releases", f"Successfully created ZIP file", "zip_creation_complete", {
            'zip_path': str(zip_path),
            'final_image_count': final_image_count
        })
    finally:
        # Force cleanup staging directory with proper file handle management
        try:
            if os.path.exists(staging_root):
                # Force garbage collection to close any open file handles
                import gc
                gc.collect()
                
                # Wait a moment for any file operations to complete
                import time
                time.sleep(2)  # Increased wait time
                
                # Try to remove with force
                import shutil
                import stat
                
                def force_remove_readonly(func, path, _):
                    """Remove read-only attribute and retry"""
                    try:
                        os.chmod(path, stat.S_IWRITE)
                        func(path)
                    except:
                        pass
                
                # Try multiple cleanup strategies
                try:
                    shutil.rmtree(staging_root, onerror=force_remove_readonly)
                    logger.info("operations.releases", f"Staging directory cleaned up successfully", "staging_cleanup_force_success", {
                        'staging_root': staging_root
                    })
                except Exception as cleanup_error:
                    logger.warning("errors.system", f"First cleanup attempt failed, trying alternative method", "staging_cleanup_retry", {
                        'staging_root': staging_root,
                        'error': str(cleanup_error)
                    })
                    
                    # Alternative: Use Windows command if available
                    if os.name == 'nt':
                        try:
                            import subprocess
                            result = subprocess.run(['cmd', '/c', 'rmdir', '/s', '/q', staging_root], 
                                                  capture_output=True, text=True, timeout=10)
                            if result.returncode == 0:
                                logger.info("operations.releases", f"Staging directory cleaned up with Windows command", "staging_cleanup_windows_success", {
                                    'staging_root': staging_root
                                })
                            else:
                                raise Exception(f"Windows command failed: {result.stderr}")
                        except Exception as win_error:
                            logger.error("errors.system", f"Windows cleanup also failed", "staging_cleanup_windows_failed", {
                                'staging_root': staging_root,
                                'error': str(win_error)
                            })
                    else:
                        raise cleanup_error
                        
        except Exception as e:
            logger.error("errors.system", f"Staging cleanup failed completely", "staging_cleanup_force_failed", {
                'staging_root': staging_root,
                'error': str(e)
            })


def create_yolo_label_content(annotations, db_image, mode: str = "yolo_detection", class_index_resolver=None) -> str:
    """
    Create YOLO format label content from database annotations.
    mode:
      - "yolo_detection": one line per bbox → "class cx cy w h" (normalized)
      - "yolo_segmentation": one line per polygon → "class x1 y1 x2 y2 ..." (normalized)
    """
    logger.debug("operations.images", f"Creating YOLO label content", "yolo_label_creation_start", {
        'annotation_count': len(annotations),
        'mode': mode,
        'has_class_resolver': bool(class_index_resolver)
    })
    
    if not annotations:
        logger.debug("operations.images", f"No annotations provided, returning empty content", "no_annotations_empty_return", {})
        return ""
    
    lines = []
    image_width = getattr(db_image, 'width', 640)  # Default width if not available
    image_height = getattr(db_image, 'height', 480)  # Default height if not available
    
    logger.debug("operations.images", f"Image dimensions for normalization", "image_dimensions_set", {
        'width': image_width,
        'height': image_height,
        'is_default_width': image_width == 640,
        'is_default_height': image_height == 480
    })
    
    for ann in annotations:
        # Get class index using resolver if provided
        if callable(class_index_resolver):
            try:
                class_id = int(class_index_resolver(ann))
                logger.debug("operations.images", f"Class ID resolved using resolver", "class_id_resolver_success", {
                    'class_id': class_id
                })
            except Exception as _e:
                logger.warning("errors.validation", f"Class resolver failed, using fallback", "class_resolver_fallback", {
                    'error': str(_e)
                })
                class_id = int(getattr(ann, 'class_id', 0))
        else:
            class_id = int(getattr(ann, 'class_id', 0))
            logger.debug("operations.images", f"Class ID from annotation attribute", "class_id_attribute", {
                'class_id': class_id
            })
        
        # YOLO Segmentation: prefer polygons if requested
        if mode == "yolo_segmentation":
            logger.debug("operations.images", f"Processing segmentation annotation", "segmentation_processing_start", {
                'class_id': class_id
            })
            
            seg = getattr(ann, 'segmentation', None)
            # Parse JSON string if needed
            if isinstance(seg, str):
                try:
                    seg = json.loads(seg)
                    logger.debug("operations.images", f"Segmentation JSON parsed successfully", "segmentation_json_parse_success", {
                        'segmentation_type': type(seg).__name__
                    })
                except Exception as _e:
                    logger.debug("errors.validation", f"Failed to parse segmentation JSON", "segmentation_json_parse_error", {
                        'segmentation': seg,
                        'error': str(_e)
                    })
                    seg = None
            
            points = []
            if isinstance(seg, list) and len(seg) > 0:
                # 1) list of {x,y}
                if isinstance(seg[0], dict) and 'x' in seg[0] and 'y' in seg[0]:
                    points = [(float(p['x']), float(p['y'])) for p in seg]
                    logger.debug("operations.images", f"Segmentation points from dict format", "segmentation_points_dict_format", {
                        'point_count': len(points)
                    })
                # 2) [[x1,y1,x2,y2,...]]
                elif isinstance(seg[0], list):
                    flat = seg[0]
                    for i in range(0, len(flat) - 1, 2):
                        points.append((float(flat[i]), float(flat[i+1])))
                    logger.debug("operations.images", f"Segmentation points from nested list format", "segmentation_points_nested_list", {
                        'point_count': len(points)
                    })
                # 3) [x1,y1,x2,y2,...]
            else:
                flat = seg
                for i in range(0, len(flat) - 1, 2):
                    points.append((float(flat[i]), float(flat[i+1])))
                logger.debug("operations.images", f"Segmentation points from flat list format", "segmentation_points_flat_list", {
                    'point_count': len(points)
                })

            if points:
                # Detect normalized vs pixel
                max_val = max([max(px, py) for px, py in points]) if points else 0
                is_norm = max_val <= 1.0
                norm_vals = []
                for px, py in points:
                    nx = px if is_norm else (px / max(1, image_width))
                    ny = py if is_norm else (py / max(1, image_height))
                    nx = max(0.0, min(1.0, nx))
                    ny = max(0.0, min(1.0, ny))
                    norm_vals.extend([f"{nx:.6f}", f"{ny:.6f}"])
                if len(norm_vals) >= 6:  # at least 3 points
                    lines.append(f"{class_id} " + " ".join(norm_vals))
                    continue  # done for this annotation

        # Detection path: prefer explicit x_min/x_max if present
        if all(hasattr(ann, f) for f in ("x_min", "y_min", "x_max", "y_max")):
            logger.debug("operations.images", f"Processing detection annotation with explicit bounds", "detection_explicit_bounds", {
                'class_id': class_id
            })
            
            x_min = float(getattr(ann, 'x_min', 0.0))
            y_min = float(getattr(ann, 'y_min', 0.0))
            x_max = float(getattr(ann, 'x_max', 0.0))
            y_max = float(getattr(ann, 'y_max', 0.0))

            is_norm = max(x_min, y_min, x_max, y_max) <= 1.0
            if is_norm:
                cx = (x_min + x_max) / 2.0
                cy = (y_min + y_max) / 2.0
                w = (x_max - x_min)
                h = (y_max - y_min)
                logger.debug("operations.images", f"Using normalized coordinates", "detection_normalized_coords", {
                    'cx': cx, 'cy': cy, 'w': w, 'h': h
                })
            else:
                cx = ((x_min + x_max) / 2.0) / max(1, image_width)
                cy = ((y_min + y_max) / 2.0) / max(1, image_height)
                w = (x_max - x_min) / max(1, image_width)
                h = (y_max - y_min) / max(1, image_height)
                logger.debug("operations.images", f"Converted pixel coordinates to normalized", "detection_pixel_to_normalized", {
                    'original': {'x_min': x_min, 'y_min': y_min, 'x_max': x_max, 'y_max': y_max},
                    'normalized': {'cx': cx, 'cy': cy, 'w': w, 'h': h}
                })

            cx = max(0.0, min(1.0, cx))
            cy = max(0.0, min(1.0, cy))
            w = max(0.0, min(1.0, w))
            h = max(0.0, min(1.0, h))
            lines.append(f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
            logger.debug("operations.images", f"Detection annotation processed successfully", "detection_annotation_success", {
                'class_id': class_id,
                'final_coords': {'cx': cx, 'cy': cy, 'w': w, 'h': h}
            })
            continue

        # Legacy bbox fallback
        if hasattr(ann, 'bbox') and ann.bbox:
            bbox_raw = ann.bbox
            if isinstance(bbox_raw, str):
                try:
                    bbox = json.loads(bbox_raw)
                except Exception as _e:
                    logger.debug("errors.validation", f"Failed to parse bbox JSON", "bbox_json_parse_error", {
                        'bbox_raw': bbox_raw,
                        'error': str(_e)
                    })
                    bbox = None
        else:
            bbox = bbox_raw

            if bbox and len(bbox) >= 4:
                x_min, y_min, x_max, y_max = bbox[:4]
                is_norm = max(x_min, y_min, x_max, y_max) <= 1.0
                if is_norm:
                    cx = (x_min + x_max) / 2.0
                    cy = (y_min + y_max) / 2.0
                    w = (x_max - x_min)
                    h = (y_max - y_min)
                else:
                    cx = ((x_min + x_max) / 2.0) / max(1, image_width)
                    cy = ((y_min + y_max) / 2.0) / max(1, image_height)
                    w = (x_max - x_min) / max(1, image_width)
                    h = (y_max - y_min) / max(1, image_height)

                cx = max(0.0, min(1.0, cx))
                cy = max(0.0, min(1.0, cy))
                w = max(0.0, min(1.0, w))
                h = max(0.0, min(1.0, h))
                lines.append(f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                continue

        # No usable annotation → skip (do not write dummy)
        logger.debug("operations.images", f"Skipping unusable annotation", "annotation_skipped", {
            'class_id': class_id
        })
        continue
    
    logger.info("operations.images", f"YOLO label content creation completed", "yolo_label_creation_complete", {
        'total_annotations': len(annotations),
        'successful_lines': len(lines),
        'mode': mode
    })
    
    return "\n".join(lines)


def generate_augmented_transformations(base_transformations: List[dict], aug_idx: int, db_dual_value_map: Dict[str, Dict[str, Dict[str, float]]] = None) -> List[dict]:
    """
    Generate different transformation parameters for each augmented image
    
    For rotation 90°:
    - aug_idx=1 → -90° rotation  
    - aug_idx=2 → +90° rotation
    - aug_idx=3 → 180° rotation
    - etc.
    """
    logger.debug("operations.transformations", f"Generating augmented transformations", "augmented_transformations_start", {
        'base_transformations_count': len(base_transformations),
        'augmentation_index': aug_idx,
        'has_dual_value_map': bool(db_dual_value_map)
    })
    
    augmented_transformations = []
    # Import dual-value helpers lazily to avoid circular deps
    try:
        from core.transformation_config import (
            is_dual_value_transformation,
            generate_auto_value,
        )
    except Exception as _e:
        logger.debug("errors.system", f"Failed to import transformation config, using fallback", "transformation_config_import_fallback", {
            'error': str(_e)
        })
        def is_dual_value_transformation(_t):
            return _t in {"rotate", "brightness", "contrast", "shear", "hue"}
        def generate_auto_value(_t, val):
            try:
                return -val
            except Exception as _e:
                logger.debug("errors.system", f"Failed to generate auto value, using fallback", "auto_value_generation_fallback", {
                    'transformation_type': _t,
                    'value': val,
                    'error': str(_e)
                })
                return val
    
    for transform in base_transformations:
        t_type = transform.get("type")
        t_params = dict(transform.get("params", {}))
        
        logger.debug("operations.transformations", f"Processing transformation", "transformation_processing_start", {
            'transformation_type': t_type,
            'augmentation_index': aug_idx,
            'has_params': bool(t_params)
        })

        # Handle rotate specially for angle parameter
        if t_type == "rotate":
            base_angle = t_params.get("angle", 0)
            logger.debug("operations.transformations", f"Processing rotation transformation", "rotation_transformation_processing", {
                'base_angle': base_angle,
                'augmentation_index': aug_idx,
                'has_db_dual_value': bool(db_dual_value_map and db_dual_value_map.get("rotate", {}).get("angle"))
            })
            
            # If DB provides auto value, prefer it
            if db_dual_value_map and db_dual_value_map.get("rotate", {}).get("angle"):
                dv = db_dual_value_map["rotate"]["angle"]
                user_val = dv.get("user_value", base_angle)
                auto_val = dv.get("auto_value", -user_val)
                logger.debug("operations.transformations", f"Using DB dual-value for rotation", "rotation_db_dual_value", {
                    'user_value': user_val,
                    'auto_value': auto_val
                })
                if aug_idx == 1:
                    new_angle = auto_val
                elif aug_idx == 2:
                    new_angle = user_val
                else:
                    new_angle = user_val if (aug_idx % 2 == 0) else auto_val
                logger.debug("operations.transformations", f"Rotation angle calculated from DB dual-value", "rotation_angle_calculated", {
                    'new_angle': new_angle,
                    'augmentation_index': aug_idx
                })
            else:
                logger.debug("operations.transformations", f"Using fallback rotation calculation", "rotation_fallback_calculation", {
                    'base_angle': base_angle,
                    'augmentation_index': aug_idx
                })
                if aug_idx == 1:
                    new_angle = generate_auto_value("rotate", base_angle)
                elif aug_idx == 2:
                    new_angle = base_angle
                else:
                    # scale but clamp to reasonable range
                    new_angle = max(-180, min(180, base_angle * (1 if aug_idx % 2 == 0 else -1)))
                logger.debug("operations.transformations", f"Rotation angle calculated from fallback", "rotation_angle_fallback_calculated", {
                    'new_angle': new_angle,
                    'augmentation_index': aug_idx
                })
        else:
            # Alternate angle across aug_idx: odd → auto opposite, even → user value, >2 → multiples
            if aug_idx == 1:
                new_angle = generate_auto_value("rotate", base_angle)
            elif aug_idx == 2:
                new_angle = base_angle
            else:
                # scale but clamp to reasonable range
                new_angle = max(-180, min(180, base_angle * (1 if aug_idx % 2 == 0 else -1)))
            t_params["angle"] = new_angle
            augmented_transformations.append({"type": t_type, "params": t_params})
            continue

        # Dual-value transformations: brightness, contrast, shear, hue
        if is_dual_value_transformation(t_type):
            logger.debug("operations.transformations", f"Processing dual-value transformation", "dual_value_transformation_processing", {
                'transformation_type': t_type,
                'augmentation_index': aug_idx
            })
            
            # Pick a primary numeric parameter to invert
            key_order = [
                ("brightness", ["percentage", "factor"]),
                ("contrast", ["percentage", "factor"]),
                ("shear", ["shear_angle", "angle"]),
                ("hue", ["hue_shift", "hue"]),
            ]
            # Find the actual param name present for this transform
            active_key = None
            for _, candidates in key_order:
                for c in candidates:
                    if c in t_params:
                        active_key = c
                        break
                if active_key:
                    break

            if active_key is not None and isinstance(t_params.get(active_key), (int, float)):
                base_val = t_params[active_key]
                logger.debug("operations.transformations", f"Processing dual-value parameter", "dual_value_parameter_processing", {
                    'transformation_type': t_type,
                    'active_key': active_key,
                    'base_value': base_val,
                    'augmentation_index': aug_idx
                })
                
                # Prefer DB dual-value if available
                if db_dual_value_map and db_dual_value_map.get(t_type, {}).get(active_key):
                    dv = db_dual_value_map[t_type][active_key]
                    user_val = dv.get("user_value", base_val)
                    auto_val = dv.get("auto_value", generate_auto_value(t_type, user_val))
                    logger.debug("operations.transformations", f"Using DB dual-value", "db_dual_value_usage", {
                        'user_value': user_val,
                        'auto_value': auto_val
                    })
                    if aug_idx == 1:
                        new_val = auto_val
                    elif aug_idx == 2:
                        new_val = user_val
                    else:
                        new_val = user_val if (aug_idx % 2 == 0) else auto_val
                else:
                    logger.debug("operations.transformations", f"Using fallback dual-value generation", "fallback_dual_value_generation", {
                        'transformation_type': t_type,
                        'base_value': base_val
                    })
                    if aug_idx == 1:
                        new_val = generate_auto_value(t_type, base_val)
                    elif aug_idx == 2:
                        new_val = base_val
                    else:
                        # alternate sign for subsequent augs
                        new_val = base_val if (aug_idx % 2 == 0) else generate_auto_value(t_type, base_val)
                t_params[active_key] = new_val
            else:
                logger.debug("operations.transformations", f"No valid dual-value parameter found", "no_dual_value_parameter", {
                    'transformation_type': t_type,
                    'available_params': list(t_params.keys())
                })

        # Default: keep other params as-is
        augmented_transformations.append({"type": t_type, "params": t_params})
        logger.debug("operations.transformations", f"Transformation added to output", "transformation_added", {
            'transformation_type': t_type,
            'augmentation_index': aug_idx,
            'output_count': len(augmented_transformations)
        })
    
    logger.info("operations.transformations", f"Generated augmented transformations successfully", "augmented_transformations_complete", {
        'input_count': len(base_transformations),
        'output_count': len(augmented_transformations),
        'augmentation_index': aug_idx
    })
    
    return augmented_transformations


def apply_transformations_to_image(image_path: str, transformations: List[dict]):
    """Apply transformations to an image"""
    logger.debug("operations.images", f"Starting image transformation application", "transformation_application_start", {
        'image_path': image_path,
        'transformation_count': len(transformations)
    })
    
    try:
        from PIL import Image as PILImage
        
        logger.debug("operations.images", f"Opening image for transformation", "image_open_start", {
            'image_path': image_path
        })
        
        image = PILImage.open(image_path)
        original_size = image.size
        logger.debug("operations.images", f"Image opened successfully", "image_open_success", {
            'image_path': image_path,
            'original_size': original_size,
            'mode': image.mode
        })
        
        for idx, transform in enumerate(transformations):
            transform_type = transform.get("type")
            transform_params = transform.get("params", {})
            
            logger.debug("operations.images", f"Applying transformation", "transformation_apply_start", {
                'transformation_index': idx,
                'transformation_type': transform_type,
                'transformation_params': transform_params
            })
            
            if transform_type == "rotate":
                angle = transform_params.get("angle", 0)
                if angle != 0:
                    logger.debug("operations.images", f"Applying rotation transformation", "rotation_application", {
                        'angle': angle,
                        'expand': False,
                        'fillcolor': 'white'
                    })
                    # ✅ DATA AUGMENTATION: Keep same dimensions, white background fill
                    image = image.rotate(angle, expand=False, fillcolor='white')
                    logger.debug("operations.images", f"Rotation applied successfully", "rotation_success", {
                        'angle': angle,
                        'new_size': image.size
                    })
                else:
                    logger.debug("operations.images", f"Skipping rotation (angle is 0)", "rotation_skipped", {
                        'angle': angle
                    })
            elif transform_type == "brightness":
                percentage = transform_params.get("percentage", transform_params.get("factor", 0))
                logger.debug("operations.images", f"Brightness transformation not implemented yet", "brightness_not_implemented", {
                    'percentage': percentage
                })
                # TODO: Implement brightness transformation
            elif transform_type == "contrast":
                percentage = transform_params.get("percentage", transform_params.get("factor", 0))
                logger.debug("operations.images", f"Contrast transformation not implemented yet", "contrast_not_implemented", {
                    'percentage': percentage
                })
                # TODO: Implement contrast transformation
            elif transform_type == "flip":
                horizontal = transform_params.get("horizontal", False)
                vertical = transform_params.get("vertical", False)
                logger.debug("operations.images", f"Flip transformation not implemented yet", "flip_not_implemented", {
                    'horizontal': horizontal,
                    'vertical': vertical
                })
                # TODO: Implement flip transformation
            else:
                logger.debug("operations.images", f"Unknown transformation type", "unknown_transformation_type", {
                    'transformation_type': transform_type,
                    'transformation_params': transform_params
                })
        
        final_size = image.size
        logger.info("operations.images", f"Image transformations completed successfully", "transformation_application_complete", {
            'image_path': image_path,
            'transformation_count': len(transformations),
            'original_size': original_size,
            'final_size': final_size,
            'size_changed': original_size != final_size
        })
        
        return image
        
    except Exception as e:
        logger.error("errors.system", f"Failed to apply transformations to image", "transformation_application_error", {
            'image_path': image_path,
            'transformation_count': len(transformations),
            'error': str(e),
            'error_type': type(e).__name__
        })
        return None

def generate_descriptive_suffix(transformations: dict) -> str:
    """
    Generate descriptive suffix for augmented images based on transformations applied.
    Example: brightness+50_flip_vertical
    """
    logger.debug("operations.operations", f"Generating descriptive suffix for file naming", "descriptive_suffix_start", {
        'transformation_count': len(transformations),
        'transformation_types': list(transformations.keys()),
        'purpose': 'file_naming_and_tracking'
    })
    
    parts = []
    
    for tool_type, params in transformations.items():
        logger.debug("operations.operations", f"Processing transformation for file suffix", "suffix_transformation_processing", {
            'tool_type': tool_type,
            'params': params,
            'operation': 'file_suffix_generation'
        })
        if tool_type == 'brightness':
            percentage = params.get('percentage', params.get('adjustment', 0))
            logger.debug("operations.operations", f"Processing brightness transformation for file suffix", "brightness_suffix_processing", {
                'percentage': percentage,
                'source_param': 'percentage' if 'percentage' in params else 'adjustment',
                'operation': 'file_suffix_generation'
            })
            if percentage > 0:
                suffix = f"brightness+{int(percentage)}"
                parts.append(suffix)
                logger.debug("operations.operations", f"Brightness suffix added to file naming", "brightness_suffix_added", {
                    'suffix': suffix,
                    'percentage': percentage,
                    'operation': 'file_suffix_generation'
                })
            else:
                suffix = f"brightness{int(percentage)}"
                parts.append(suffix)
                logger.debug("operations.operations", f"Brightness suffix added to file naming", "brightness_suffix_added", {
                    'suffix': suffix,
                    'percentage': percentage,
                    'operation': 'file_suffix_generation'
                })
        elif tool_type == 'contrast':
            percentage = params.get('percentage', params.get('adjustment', 0))
            logger.debug("operations.operations", f"Processing contrast transformation for file suffix", "contrast_suffix_processing", {
                'percentage': percentage,
                'source_param': 'percentage' if 'percentage' in params else 'adjustment',
                'operation': 'file_suffix_generation'
            })
            if percentage > 0:
                suffix = f"contrast+{int(percentage)}"
                parts.append(suffix)
                logger.debug("operations.operations", f"Contrast suffix added to file naming", "contrast_suffix_added", {
                    'suffix': suffix,
                    'percentage': percentage,
                    'operation': 'file_suffix_generation'
                })
            else:
                suffix = f"contrast{int(percentage)}"
                parts.append(suffix)
                logger.debug("operations.operations", f"Contrast suffix added to file naming", "contrast_suffix_added", {
                    'suffix': suffix,
                    'percentage': percentage,
                    'operation': 'file_suffix_generation'
                })
        elif tool_type == 'rotate':
            angle = params.get('angle', 0)
            suffix = f"rotate{int(angle)}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Rotation suffix added to file naming", "rotation_suffix_added", {
                'suffix': suffix,
                'angle': angle,
                'operation': 'file_suffix_generation'
            })
        elif tool_type == 'shear':
            angle = params.get('shear_angle', params.get('angle', 0))
            try:
                sval = float(angle)
            except Exception as _e:
                logger.debug("errors.validation", f"Failed to parse shear angle, using fallback", "shear_angle_parse_fallback", {
                    'angle': angle,
                    'error': str(_e)
                })
                sval = 0.0
            sign = '+' if sval > 0 else ''
            # Keep one decimal if not integer
            sval_str = f"{sval:.1f}" if abs(sval - int(sval)) > 1e-6 else f"{int(sval)}"
            suffix = f"shear{sign}{sval_str}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Shear suffix added to file naming", "shear_suffix_added", {
                'suffix': suffix,
                'angle': sval,
                'formatted_value': sval_str,
                'operation': 'file_suffix_generation'
            })
        elif tool_type == 'hue':
            hue_shift = params.get('hue_shift', params.get('hue', 0))
            try:
                hval = float(hue_shift)
            except Exception as _e:
                logger.debug("errors.validation", f"Failed to parse hue shift, using fallback", "hue_shift_parse_fallback", {
                    'hue_shift': hue_shift,
                    'error': str(_e)
                })
                hval = 0.0
            sign = '+' if hval > 0 else ''
            hval_str = f"{hval:.1f}" if abs(hval - int(hval)) > 1e-6 else f"{int(hval)}"
            suffix = f"hue{sign}{hval_str}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Hue suffix added to file naming", "hue_suffix_added", {
                'suffix': suffix,
                'hue_shift': hval,
                'formatted_value': hval_str,
                'operation': 'file_suffix_generation'
            })
        elif tool_type == 'flip':
            horizontal = params.get('horizontal', False)
            vertical = params.get('vertical', False)
            logger.debug("operations.operations", f"Processing flip transformation for file suffix", "flip_suffix_processing", {
                'horizontal': horizontal,
                'vertical': vertical,
                'operation': 'file_suffix_generation'
            })
            if horizontal and vertical:
                suffix = "flip_both"
                parts.append(suffix)
                logger.debug("operations.operations", f"Flip suffix added to file naming", "flip_suffix_added", {
                    'suffix': suffix,
                    'direction': 'both',
                    'operation': 'file_suffix_generation'
                })
            elif horizontal:
                suffix = "flip_horizontal"
                parts.append(suffix)
                logger.debug("operations.operations", f"Flip suffix added to file naming", "flip_suffix_added", {
                    'suffix': suffix,
                    'direction': 'horizontal',
                    'operation': 'file_suffix_generation'
                })
            elif vertical:
                suffix = "flip_vertical"
                parts.append(suffix)
                logger.debug("operations.operations", f"Flip suffix added to file naming", "flip_suffix_added", {
                    'suffix': suffix,
                    'direction': 'vertical',
                    'operation': 'file_suffix_generation'
                })
        elif tool_type == 'resize':
            width = params.get('width', 0)
            height = params.get('height', 0)
            logger.debug("operations.operations", f"Processing resize transformation for file suffix", "resize_suffix_processing", {
                'width': width,
                'height': height,
                'operation': 'file_suffix_generation'
            })
            suffix = f"resize{width}x{height}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Resize suffix added to file naming", "resize_suffix_added", {
                'suffix': suffix,
                'width': width,
                'height': height,
                'operation': 'file_suffix_generation'
            })
        elif tool_type == 'blur':
            radius = params.get('radius', 0)
            logger.debug("operations.operations", f"Processing blur transformation for file suffix", "blur_suffix_processing", {
                'radius': radius,
                'operation': 'file_suffix_generation'
            })
            suffix = f"blur{radius}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Blur suffix added to file naming", "blur_suffix_added", {
                'suffix': suffix,
                'radius': radius,
                'operation': 'file_suffix_generation'
            })
        elif tool_type == 'noise':
            intensity = params.get('intensity', 0)
            logger.debug("operations.operations", f"Processing noise transformation for file suffix", "noise_suffix_processing", {
                'intensity': intensity,
                'operation': 'file_suffix_generation'
            })
            suffix = f"noise{intensity}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Noise suffix added to file naming", "noise_suffix_added", {
                'suffix': suffix,
                'intensity': intensity,
                'operation': 'file_suffix_generation'
            })
        else:
            # Generic fallback
            logger.debug("operations.operations", f"Using generic fallback for unknown tool type in file suffix", "generic_tool_type_fallback", {
                'tool_type': tool_type,
                'operation': 'file_suffix_generation'
            })
            parts.append(tool_type)
    
    final_suffix = "_".join(parts) if parts else "aug"
    logger.info("operations.operations", f"File suffix generation completed successfully", "descriptive_suffix_complete", {
        'transformation_count': len(transformations),
        'parts_count': len(parts),
        'final_suffix': final_suffix,
        'purpose': 'file_naming_and_tracking',
        'usage': 'augmented_image_identification'
    })
    
    return final_suffix


def cleanup_staging_directory_with_retry(staging_root: str, logger) -> None:
    """
    Enhanced cleanup function for staging directories with retry mechanism and better error handling.
    
    This function attempts to clean up staging directories with multiple strategies:
    1. Immediate cleanup with shutil.rmtree
    2. Force cleanup with chmod if needed
    3. Retry with delay for file locks
    4. Log detailed information about cleanup attempts
    """
    import time
    import stat
    
    if not os.path.exists(staging_root):
        logger.debug("operations.releases", f"Staging directory does not exist, skipping cleanup", "staging_cleanup_skip", {
            'staging_root': staging_root
        })
        return
    
    logger.info("operations.releases", f"Starting enhanced staging directory cleanup", "staging_cleanup_start", {
        'staging_root': staging_root
    })
    
    # Strategy 1: Try immediate cleanup
    try:
        shutil.rmtree(staging_root, ignore_errors=True)
        logger.info("operations.releases", f"Staging directory cleanup completed successfully", "staging_cleanup_success", {
            'staging_root': staging_root,
            'strategy': 'immediate_cleanup'
        })
        return
    except Exception as e:
        logger.warning("errors.system", f"Immediate cleanup failed, trying enhanced cleanup", "staging_cleanup_immediate_failed", {
            'staging_root': staging_root,
            'error': str(e),
            'strategy': 'immediate_cleanup'
        })
    
    # Strategy 2: Force cleanup with chmod (for read-only files)
    try:
        def force_remove_readonly(func, path, _):
            """Remove read-only attribute and retry"""
            os.chmod(path, stat.S_IWRITE)
            func(path)
        
        shutil.rmtree(staging_root, onerror=force_remove_readonly)
        logger.info("operations.releases", f"Staging directory cleanup completed with force removal", "staging_cleanup_force_success", {
            'staging_root': staging_root,
            'strategy': 'force_cleanup'
        })
        return
    except Exception as e:
        logger.warning("errors.system", f"Force cleanup failed, trying retry mechanism", "staging_cleanup_force_failed", {
            'staging_root': staging_root,
            'error': str(e),
            'strategy': 'force_cleanup'
        })
    
    # Strategy 3: Retry mechanism with delays (for file locks)
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            time.sleep(retry_delay)
            shutil.rmtree(staging_root, ignore_errors=True)
            logger.info("operations.releases", f"Staging directory cleanup completed on retry", "staging_cleanup_retry_success", {
                'staging_root': staging_root,
                'attempt': attempt + 1,
                'strategy': 'retry_cleanup'
            })
            return
        except Exception as e:
            logger.warning("errors.system", f"Retry cleanup attempt failed", "staging_cleanup_retry_failed", {
                'staging_root': staging_root,
                'attempt': attempt + 1,
                'error': str(e),
                'strategy': 'retry_cleanup'
            })
    
    # Strategy 4: Manual cleanup of individual files (last resort)
    try:
        logger.warning("errors.system", f"All cleanup strategies failed, attempting manual file removal", "staging_cleanup_manual_attempt", {
            'staging_root': staging_root,
            'strategy': 'manual_cleanup'
        })
        
        for root, dirs, files in os.walk(staging_root, topdown=False):
            # Remove files first
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    os.chmod(file_path, stat.S_IWRITE)
                    os.remove(file_path)
                except Exception as e:
                    logger.warning("errors.system", f"Failed to remove file during manual cleanup", "manual_cleanup_file_failed", {
                        'file_path': file_path,
                        'error': str(e)
                    })
            
            # Remove directories
            for dir_name in dirs:
                dir_path = os.path.join(root, dir_name)
                try:
                    os.chmod(dir_path, stat.S_IWRITE)
                    os.rmdir(dir_path)
                except Exception as e:
                    logger.warning("errors.system", f"Failed to remove directory during manual cleanup", "manual_cleanup_dir_failed", {
                        'dir_path': dir_path,
                        'error': str(e)
                    })
        
        # Try to remove the root staging directory
        try:
            os.chmod(staging_root, stat.S_IWRITE)
            os.rmdir(staging_root)
            logger.info("operations.releases", f"Manual cleanup completed successfully", "staging_cleanup_manual_success", {
                'staging_root': staging_root,
                'strategy': 'manual_cleanup'
            })
            return
        except Exception as e:
            logger.error("errors.system", f"Failed to remove staging root directory", "staging_cleanup_root_failed", {
                'staging_root': staging_root,
                'error': str(e)
            })
    
    except Exception as e:
        logger.error("errors.system", f"Manual cleanup failed completely", "staging_cleanup_manual_failed", {
            'staging_root': staging_root,
            'error': str(e)
        })
    
    # Final warning if all strategies failed
    logger.error("errors.system", f"All staging cleanup strategies failed - manual intervention required", "staging_cleanup_all_failed", {
        'staging_root': staging_root,
        'note': 'This staging directory needs manual cleanup'
    })
