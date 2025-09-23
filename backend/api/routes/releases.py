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
from utils.path_utils import PathManager  # absolute import
import random
import yaml
import zipfile
from io import BytesIO
from PIL import Image as PILImage
from fastapi.responses import StreamingResponse

# Import our new release system
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from core.release_controller import ReleaseController, ReleaseConfig, create_release_controller
from core.transformation_schema import generate_release_configurations

# Import professional logging system
from logging_system.professional_logger import get_professional_logger, log_info, log_error, log_warning, log_critical

# Import transformation debugger
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))
from TRANSFORMATION_DEBUG import TransformationDebugger

# Initialize professional logger
logger = get_professional_logger()

# Initialize transformation debugger
debug_logger = TransformationDebugger()


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
    preview_data: Optional[dict] = None  # Preview data with calculated split counts

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
        
        # Use preview data if available (frontend already calculated correctly)
        if payload.preview_data and payload.preview_data.get('splitBreakdown'):
            # Use frontend-calculated split counts (includes augmentation)
            split_breakdown = payload.preview_data['splitBreakdown']
            split_counts = {
                "train": split_breakdown.get('train', 0),
                "val": split_breakdown.get('val', 0), 
                "test": split_breakdown.get('test', 0)
            }
            total_original = payload.preview_data.get('baseImages', 0)
            final_image_count = payload.preview_data.get('totalImages', 0)
            total_augmented = final_image_count - total_original
            class_count = payload.preview_data.get('totalClasses', 0)  # nc - number of classes
            
            # Debug logging to see what we're getting
            logger.info("operations.preview_data", f"Using preview data for release counts", "preview_data_usage", {
                "split_breakdown": split_breakdown,
                "total_original": total_original,
                "final_image_count": final_image_count,
                "total_augmented": total_augmented,
                "class_count": class_count,
                "split_counts": split_counts
            })
        else:
            # Fallback to old calculation method
            total_original, split_counts = calculate_total_image_counts(db, payload.dataset_ids)
            total_augmented = total_original * (payload.multiplier - 1) if payload.multiplier > 1 else 0
            final_image_count = total_original * payload.multiplier
            class_count = 0  # Will be calculated later if needed
        
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
        # Store relative path in database for portability
        relative_model_path = PathManager.get_project_relative_path(model_path)
        
        logger.info("operations.exports", f"Export path created", "export_path_created", {
            "releases_dir": releases_dir,
            "zip_filename": zip_filename,
            "model_path": relative_model_path,
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
            train_image_count=split_counts.get("train", 0),
            val_image_count=split_counts.get("val", 0),
            test_image_count=split_counts.get("test", 0),
            class_count=class_count,  # ✅ FIXED: Set nc (number of classes) from preview data
            model_path=relative_model_path,
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

        # Now that the release row is committed, schedule stats extraction worker
        try:
            from backend.api.services.release_stats_worker import schedule_zip_stats_update
            schedule_zip_stats_update(release_id)
        except Exception as _e:
            logger.warning("operations.releases", f"Failed to schedule ZIP stats update post-commit: {_e}", "zip_stats_worker_schedule_failed", {
                'release_id': release_id
            })
        
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
            "split_counts": split_counts,
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
                "class_count": created_release.class_count or 0,
                "total_original_images": created_release.total_original_images,
                "total_augmented_images": created_release.total_augmented_images,
                "original_image_count": created_release.total_original_images,  # For backward compatibility
                "augmented_image_count": created_release.total_augmented_images,  # For backward compatibility
                "created_at": created_release.created_at,
                "model_path": created_release.model_path,
                "datasets_used": created_release.datasets_used,
                "train_image_count": created_release.train_image_count,
                "val_image_count": created_release.val_image_count,
                "test_image_count": created_release.test_image_count,
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
                "class_count": r.class_count or 0,
                "total_original_images": r.total_original_images,  # Add this field for frontend
                "total_augmented_images": r.total_augmented_images,
                "total_classes": r.class_count or 0,
                "created_at": r.created_at,
                "model_path": r.model_path,  # Add this for download modal
                "description": r.description,
                "train_image_count": r.train_image_count,
                "val_image_count": r.val_image_count,
                "test_image_count": r.test_image_count,
                "datasets_used": r.datasets_used,
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
                "class_count": r.class_count or 0,
                "total_classes": r.class_count or 0,
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
        # Resolve absolute path from stored (possibly relative) model_path
        abs_old_zip_path = PathManager.get_absolute_path(release.model_path) if release.model_path else None
        old_zip_path = None
        new_zip_path = None
        
        if abs_old_zip_path and os.path.exists(abs_old_zip_path):
            old_zip_path = abs_old_zip_path
            zip_dir = os.path.dirname(old_zip_path)
            zip_extension = os.path.splitext(old_zip_path)[1]  # .zip
            
            # Generate new ZIP filename: {new_name}_{export_format}.zip
            new_zip_filename = f"{new_name_value}_{release.export_format.lower()}{zip_extension}"
            new_zip_path = os.path.join(zip_dir, new_zip_filename)  # absolute path
            
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
                release.model_path = PathManager.get_project_relative_path(new_zip_path)
                
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
        if zip_file_path:
            # Convert relative path to absolute path
            from utils.path_utils import PathManager
            abs_zip_path = PathManager.get_absolute_path(zip_file_path)
            
            logger.debug("operations.releases", f"Checking ZIP file for deletion", "zip_file_check", {
                "release_id": release_id,
                "relative_path": zip_file_path,
                "absolute_path": abs_zip_path,
                "exists": os.path.exists(abs_zip_path) if abs_zip_path else False
            })
            
            if abs_zip_path and os.path.exists(abs_zip_path):
                try:
                    os.remove(abs_zip_path)
                    zip_deleted = True
                    logger.info("operations.releases", f"ZIP file deleted successfully", "zip_file_delete_success", {
                        "release_id": release_id,
                        "zip_file_path": abs_zip_path
                    })
                except OSError as zip_error:
                    logger.warning("operations.releases", f"Failed to delete ZIP file, continuing with database deletion", "zip_file_delete_warning", {
                        "release_id": release_id,
                        "zip_file_path": abs_zip_path,
                        "error": str(zip_error)
                    })
            else:
                logger.warning("operations.releases", f"ZIP file not found for deletion", "zip_file_not_found", {
                    "release_id": release_id,
                    "relative_path": zip_file_path,
                    "absolute_path": abs_zip_path
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

        # Resolve absolute path using PathManager (handles both absolute & project-relative)
        abs_model_path = PathManager.get_absolute_path(release.model_path) if release.model_path else None

        # Get file size if available
        file_size = 0
        if abs_model_path and os.path.exists(abs_model_path):
            file_size = os.path.getsize(abs_model_path)
            
            logger.debug("operations.releases", f"File exists, size: {file_size} bytes", "file_exists_download", {
                "release_id": release_id,
                "file_size": file_size,
                "model_path": abs_model_path
            })
            
            # Check if it's a ZIP file
            if str(abs_model_path).endswith('.zip'):
                # Return direct download response for ZIP files
                filename = os.path.basename(abs_model_path)
                
                logger.info("operations.releases", f"Returning existing ZIP file for download", "existing_file_download", {
                    "release_id": release_id,
                    "filename": filename,
                    "file_size": file_size
                })
                
                return FileResponse(
                    path=abs_model_path,
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
            
            relative_zip_path = PathManager.get_project_relative_path(zip_path)
            release.model_path = relative_zip_path
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

@router.get("/releases/{release_id}/file/{filename:path}")
def serve_release_file(release_id: str, filename: str, thumbnail: bool = False, db: Session = Depends(get_db)):
    """
    Serve individual files from release ZIP archives
    
    Args:
        release_id: The release identifier
        filename: Path to the file within the ZIP (e.g., "images/train/car_1.jpg")
        thumbnail: If True, resize image to thumbnail size for faster loading
    
    Returns:
        StreamingResponse with the file content
    """
    logger = get_professional_logger()
    
    logger.info("app.backend", f"Serving file from release ZIP", "release_file_serve_request", {
        "release_id": release_id,
        "filename": filename,
        "thumbnail": thumbnail
    })
    
    try:
        # Get release from database
        release = db.query(Release).filter(Release.id == release_id).first()
        if not release:
            logger.warning("errors.validation", f"Release not found for file serving", "release_not_found_file_serve", {
                "release_id": release_id
            })
            raise HTTPException(status_code=404, detail="Release not found")
        
        # Get ZIP file path
        abs_model_path = PathManager.get_absolute_path(release.model_path) if release.model_path else None
        
        if not abs_model_path or not os.path.exists(abs_model_path):
            logger.warning("errors.validation", f"Release ZIP file not found", "release_zip_not_found", {
                "release_id": release_id,
                "model_path": release.model_path
            })
            raise HTTPException(status_code=404, detail="Release ZIP file not found")
        
        # Open ZIP file and extract the requested file
        try:
            with zipfile.ZipFile(abs_model_path, 'r') as zip_file:
                # Check if file exists in ZIP
                if filename not in zip_file.namelist():
                    logger.warning("errors.validation", f"File not found in ZIP", "file_not_found_in_zip", {
                        "release_id": release_id,
                        "filename": filename,
                        "available_files": zip_file.namelist()[:10]  # Log first 10 files
                    })
                    raise HTTPException(status_code=404, detail=f"File '{filename}' not found in release")
                
                # Extract file content
                file_content = zip_file.read(filename)
                
                # Determine content type
                content_type = "application/octet-stream"
                if filename.lower().endswith(('.jpg', '.jpeg')):
                    content_type = "image/jpeg"
                elif filename.lower().endswith('.png'):
                    content_type = "image/png"
                elif filename.lower().endswith('.webp'):
                    content_type = "image/webp"
                elif filename.lower().endswith('.bmp'):
                    content_type = "image/bmp"
                elif filename.lower().endswith(('.tiff', '.tif')):
                    content_type = "image/tiff"
                elif filename.lower().endswith('.gif'):
                    content_type = "image/gif"
                elif filename.lower().endswith('.svg'):
                    content_type = "image/svg+xml"
                elif filename.lower().endswith('.txt'):
                    content_type = "text/plain"
                elif filename.lower().endswith('.json'):
                    content_type = "application/json"
                elif filename.lower().endswith('.yaml', '.yml'):
                    content_type = "text/yaml"
                
                # If it's an image and thumbnail is requested, resize it
                if thumbnail and content_type.startswith('image/'):
                    try:
                        # Open image with PIL
                        image = PILImage.open(BytesIO(file_content))
                        
                        # Resize to thumbnail (max 200x200, maintain aspect ratio)
                        image.thumbnail((200, 200), PILImage.Resampling.LANCZOS)
                        
                        # Save resized image to bytes
                        output = BytesIO()
                        # Preserve original format
                        format_name = 'JPEG' if content_type == 'image/jpeg' else 'PNG'
                        image.save(output, format=format_name, quality=85 if format_name == 'JPEG' else None)
                        file_content = output.getvalue()
                        
                        logger.debug("operations.images", f"Generated thumbnail for image", "thumbnail_generated", {
                            "release_id": release_id,
                            "filename": filename,
                            "original_size": len(zip_file.read(filename)),
                            "thumbnail_size": len(file_content)
                        })
                        
                    except Exception as e:
                        logger.warning("errors.image_processing", f"Failed to generate thumbnail, serving original", "thumbnail_generation_failed", {
                            "release_id": release_id,
                            "filename": filename,
                            "error": str(e)
                        })
                        # If thumbnail generation fails, serve original
                        pass
                
                logger.info("operations.releases", f"Successfully served file from ZIP", "file_served_from_zip", {
                    "release_id": release_id,
                    "filename": filename,
                    "content_type": content_type,
                    "file_size": len(file_content),
                    "thumbnail": thumbnail
                })
                
                # Return file as streaming response
                return StreamingResponse(
                    BytesIO(file_content),
                    media_type=content_type,
                    headers={"Content-Disposition": f"inline; filename={os.path.basename(filename)}"}
                )
                
        except zipfile.BadZipFile:
            logger.error("errors.system", f"Invalid ZIP file", "invalid_zip_file", {
                "release_id": release_id,
                "model_path": abs_model_path
            })
            raise HTTPException(status_code=500, detail="Invalid ZIP file")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to serve file from release", "release_file_serve_error", {
            "release_id": release_id,
            "filename": filename,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Failed to serve file: {str(e)}")

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
        abs_model_path = PathManager.get_absolute_path(release.model_path) if release.model_path else None
        if not abs_model_path or not os.path.exists(abs_model_path) or not str(abs_model_path).endswith('.zip'):
            logger.warning("errors.validation", f"Release ZIP package not found", "zip_package_not_found", {
                "release_id": release_id,
                "model_path": release.model_path,
                "exists": os.path.exists(abs_model_path) if abs_model_path else False
            })
            raise HTTPException(status_code=404, detail="Release ZIP package not found")
        
        logger.info("operations.releases", f"ZIP package found, extracting metadata", "zip_metadata_extraction_start", {
            "release_id": release_id,
            "zip_path": release.model_path,
            "zip_size": os.path.getsize(abs_model_path)
        })
        
        try:
            # Extract metadata from ZIP package
            with zipfile.ZipFile(abs_model_path, 'r') as zipf:
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
                
                # Count files by directory and collect actual filenames
                image_files = {"train": [], "val": [], "test": []}
                
                for filename in zipf.namelist():
                    if filename.startswith('images/'):
                        file_counts["images"]["total"] += 1
                        if 'images/train/' in filename and not filename.endswith('/'):
                            file_counts["images"]["train"] += 1
                            image_files["train"].append(filename)
                        elif 'images/val/' in filename and not filename.endswith('/'):
                            file_counts["images"]["val"] += 1
                            image_files["val"].append(filename)
                        elif 'images/test/' in filename and not filename.endswith('/'):
                            file_counts["images"]["test"] += 1
                            image_files["test"].append(filename)
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

                # ------------------------------------------------------------------
                # Ensure split_counts are present and accurate by falling back to
                # directory-based counts when metadata is missing or incomplete.
                # ------------------------------------------------------------------
                try:
                    split_counts_meta = dataset_stats.get("split_counts", {}) if isinstance(dataset_stats, dict) else {}
                except Exception:
                    split_counts_meta = {}

                # Build fallback from counted files
                split_counts_fallback = {
                    "train": file_counts["images"]["train"],
                    "val": file_counts["images"]["val"],
                    "test": file_counts["images"]["test"]
                }

                # Merge: use metadata values if they are non-zero, otherwise fallback
                merged_split_counts = {
                    "train": split_counts_meta.get("train", 0) or split_counts_fallback["train"],
                    "val": split_counts_meta.get("val", 0) or split_counts_fallback["val"],
                    "test": split_counts_meta.get("test", 0) or split_counts_fallback["test"]
                }

                # Persist back to dataset_stats for response consistency
                if isinstance(dataset_stats, dict):
                    dataset_stats["split_counts"] = merged_split_counts
                    # Also ensure total_images key is populated
                    dataset_stats.setdefault("total_images", file_counts["images"]["total"])
                else:
                    dataset_stats = {
                        "total_images": file_counts["images"]["total"],
                        "split_counts": merged_split_counts
                    }
                
                # Get README content if available
                readme_content = ""
                if 'README.md' in zipf.namelist():
                    with zipf.open('README.md') as f:
                        readme_content = f.read().decode('utf-8')
                
                # Read annotations.json from metadata folder
                annotations_data = {}
                class_mapping = {}
                
                # Look for annotations.json in metadata folder or root
                annotation_files_found = []
                for file_path in zipf.namelist():
                    if file_path.endswith('annotations.json') or file_path.endswith('metadata/annotations.json'):
                        annotation_files_found.append(file_path)
                        try:
                            with zipf.open(file_path) as f:
                                annotations_content = f.read().decode('utf-8')
                                parsed_annotations = json.loads(annotations_content)
                                
                                # Log detailed structure for debugging
                                sample_keys = list(parsed_annotations.keys())[:3] if parsed_annotations else []
                                sample_annotation = None
                                if sample_keys:
                                    sample_annotation = parsed_annotations[sample_keys[0]]
                                
                                logger.info("operations.releases", f"Annotations data loaded", "annotations_loaded", {
                                    "release_id": release_id,
                                    "annotation_count": len(parsed_annotations),
                                    "file_path": file_path,
                                    "sample_keys": sample_keys,
                                    "sample_annotation_structure": type(sample_annotation).__name__ if sample_annotation else None,
                                    "sample_annotation_keys": list(sample_annotation.keys()) if isinstance(sample_annotation, dict) else None
                                })
                                
                                # Merge annotations (in case multiple files exist)
                                annotations_data.update(parsed_annotations)
                                
                        except Exception as e:
                            logger.warning("operations.releases", f"Failed to parse annotations.json", "annotations_parse_error", {
                                "release_id": release_id,
                                "file_path": file_path,
                                "error": str(e)
                            })
                
                logger.info("operations.releases", f"Annotation files search completed", "annotation_files_search", {
                    "release_id": release_id,
                    "annotation_files_found": annotation_files_found,
                    "total_annotations": len(annotations_data)
                })
                
                # Look for data.yaml or classes.txt for class mapping
                for file_path in zipf.namelist():
                    if file_path.endswith('data.yaml') or file_path.endswith('data.yml'):
                        try:
                            with zipf.open(file_path) as f:
                                yaml_content = f.read().decode('utf-8')
                                import yaml
                                yaml_data = yaml.safe_load(yaml_content)
                                if 'names' in yaml_data:
                                    # YOLO format: names can be dict or list
                                    if isinstance(yaml_data['names'], dict):
                                        class_mapping = yaml_data['names']
                                    elif isinstance(yaml_data['names'], list):
                                        class_mapping = {i: name for i, name in enumerate(yaml_data['names'])}
                                logger.info("operations.releases", f"Class mapping loaded from data.yaml", "class_mapping_loaded", {
                                    "release_id": release_id,
                                    "class_count": len(class_mapping),
                                    "file_path": file_path
                                })
                                break
                        except Exception as e:
                            logger.warning("operations.releases", f"Failed to parse data.yaml", "yaml_parse_error", {
                                "release_id": release_id,
                                "file_path": file_path,
                                "error": str(e)
                            })
                    elif file_path.endswith('classes.txt'):
                        try:
                            with zipf.open(file_path) as f:
                                classes_content = f.read().decode('utf-8')
                                class_names = [line.strip() for line in classes_content.split('\n') if line.strip()]
                                class_mapping = {i: name for i, name in enumerate(class_names)}
                                logger.info("operations.releases", f"Class mapping loaded from classes.txt", "class_mapping_loaded", {
                                    "release_id": release_id,
                                    "class_count": len(class_mapping),
                                    "file_path": file_path
                                })
                                break
                        except Exception as e:
                            logger.warning("operations.releases", f"Failed to parse classes.txt", "classes_parse_error", {
                                "release_id": release_id,
                                "file_path": file_path,
                                "error": str(e)
                            })
                
                logger.info("operations.releases", f"Package info extracted successfully", "package_info_extraction_success", {
                    "release_id": release_id,
                    "total_files": file_counts["total_files"],
                    "image_count": file_counts["images"]["total"],
                    "label_count": file_counts["labels"]["total"],
                    "metadata_count": file_counts["metadata"],
                    "annotations_count": len(annotations_data),
                    "class_mapping_count": len(class_mapping)
                })
                
                return {
                    "release_id": release_id,
                    "release_name": release.name,
                    "file_counts": file_counts,
                    "image_files": image_files,
                    "annotations": annotations_data,
                    "class_mapping": class_mapping,
                    "dataset_stats": dataset_stats,
                    "release_config": release_config,
                    "readme": readme_content,
                    "zip_size": os.path.getsize(abs_model_path),
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
    """
    🎯 MAIN RELEASE ZIP CREATION FUNCTION - COMPLETE WORKFLOW
    
    This function creates a complete YOLO dataset ZIP with:
    1. Dataset aggregation across multiple sources
    2. Image transformations and augmentation
    3. YOLO format conversion using new annotation transformer
    4. Metadata and configuration files
    5. Final ZIP packaging
    
    Workflow: Images → Transform → Track → Convert to YOLO → Package
    """
    import tempfile
    import zipfile
    from PIL import Image as PILImage
    import io
    import yaml
    import json
    
    # 🎯 START: Log the beginning of ZIP creation process
    logger.info("operations.releases", f"Creating complete release ZIP", "release_zip_creation_start", {
        'dataset_count': len(dataset_ids),
        'multiplier': multiplier
    })
    
    # 🎯 STEP 0: Setup staging directory structure
    images_per_original = max(0, multiplier - 1)  # Calculate augmented images count
    
    # 📁 Create hidden staging directory (avoids Windows temp issues)
    staging_root = os.path.join(os.path.dirname(zip_path), f".staging_{release_id}")
    if os.path.exists(staging_root):
        try:
            shutil.rmtree(staging_root, ignore_errors=True)  # Clean existing directory
            logger.debug("operations.releases", f"Cleaned up existing staging directory", "staging_cleanup_success", {
                'staging_root': staging_root
            })
        except Exception as _e:
            logger.warning("errors.system", f"Failed to clean up staging directory", "staging_cleanup_failure", {
                'staging_root': staging_root,
                'error': str(_e)
            })
    os.makedirs(staging_root, exist_ok=True)
    
    # 🪟 Windows-specific: Mark staging directory as hidden
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
    
    # 📂 Create main staging directory structure
    staging_dir = os.path.join(staging_root, "staging")
    os.makedirs(staging_dir, exist_ok=True)
    
    # 🖼️ Initialize image format engine for consistent output formatting
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
        
        # 📁 STEP 1: Create YOLO directory structure (images/train, labels/train, etc.)
        for split in ["train", "val", "test"]:
            os.makedirs(os.path.join(staging_dir, "images", split), exist_ok=True)
            os.makedirs(os.path.join(staging_dir, "labels", split), exist_ok=True)
        
        # 🔄 STEP 2: Build dual-value transformation mapping from database
        db_dual_value_map = {}
        try:
            release_version = getattr(config, 'release_name', None) or getattr(config, 'project_id', None)
            release_version = getattr(config, 'release_name', None)  # Get release version name
            if release_version:
                db_transforms = db.query(ImageTransformation).filter(
                    ImageTransformation.release_version == release_version
                ).all()
                for t in db_transforms:
                    # Extract dual-value parameters like {"angle": {"user_value": x, "auto_value": y}}
                    if getattr(t, 'dual_value_enabled', False) and getattr(t, 'dual_value_parameters', None):
                        db_dual_value_map.setdefault(t.transformation_type, {}).update(t.dual_value_parameters)
        except Exception as _e:
            logger.warning("errors.system", f"Failed building DB dual-value map", "dual_value_map_error", {
                'error': str(_e)
            })
        
        # 📊 STEP 3: Aggregate images by split across all datasets
        # This collects images from multiple datasets and organizes them by train/val/test splits
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
                            # Filter annotations based on task type and export format
                            if config.task_type == 'segmentation':
                                # For segmentation tasks: only read annotations that have polygon data
                                annotations = db.query(Annotation).filter(
                                    Annotation.image_id == db_image.id,
                                    Annotation.segmentation.isnot(None)
                                ).all()
                            else:
                                # For detection tasks: read ALL annotations (use bounding box coordinates)
                                annotations = db.query(Annotation).filter(
                                    Annotation.image_id == db_image.id
                                ).all()
                            
                            # 🔍 DEBUG: Print IMMEDIATE database read coordinates
                            print(f"\n🔍🔍🔍 IMMEDIATE DATABASE READ for {image_file} 🔍🔍🔍")
                            print(f"   Image dimensions from DB: {db_image.width}x{db_image.height}")
                            print(f"   Task type: {config.task_type}")
                            print(f"   Found {len(annotations)} annotations")
                            for i, ann in enumerate(annotations):
                                if config.task_type == 'segmentation':
                                    # For segmentation: show polygon data
                                    if ann.segmentation:
                                        import json
                                        try:
                                            polygon_data = json.loads(ann.segmentation) if isinstance(ann.segmentation, str) else ann.segmentation
                                            if isinstance(polygon_data, list) and len(polygon_data) > 0:
                                                points = polygon_data[0] if isinstance(polygon_data[0], list) else polygon_data
                                                print(f"   {i+1}. {ann.class_name}: POLYGON with {len(points)//2} points")
                                                print(f"      First 3 points: {points[:6] if len(points) >= 6 else points}")
                                                print(f"      Bounding box (auto-calculated): x_min={ann.x_min}, y_min={ann.y_min}, x_max={ann.x_max}, y_max={ann.y_max}")
                                            else:
                                                print(f"   {i+1}. {ann.class_name}: POLYGON data format error")
                                        except Exception as e:
                                            print(f"   {i+1}. {ann.class_name}: POLYGON parse error: {e}")
                                    else:
                                        print(f"   {i+1}. {ann.class_name}: NO POLYGON DATA (should not happen for segmentation task)")
                                else:
                                    # For detection: show bounding box data
                                    print(f"   {i+1}. {ann.class_name}: BOUNDING BOX x_min={ann.x_min}, y_min={ann.y_min}, x_max={ann.x_max}, y_max={ann.y_max}")
                                    print(f"      width={ann.x_max - ann.x_min}, height={ann.y_max - ann.y_min}")
                                print(f"      annotation object type: {type(ann)}")
                                print(f"      annotation object id: {id(ann)}")
                            print(f"🔍🔍🔍 END IMMEDIATE DATABASE READ 🔍🔍🔍")
                            
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
                        
                        # 🔍 DEBUG: Print coordinates before storing in img_data
                        print(f"\n🔍🔍🔍 BEFORE STORING IN IMG_DATA for {image_file} 🔍🔍🔍")
                        for i, ann in enumerate(annotations[:3]):  # Show first 3
                            print(f"   {i+1}. {ann.class_name}: x_min={ann.x_min}, y_min={ann.y_min}, x_max={ann.x_max}, y_max={ann.y_max}")
                            print(f"      annotation object id: {id(ann)}")
                        print(f"🔍🔍🔍 END BEFORE STORING 🔍🔍🔍")
                        
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

        # 🏷️ STEP 4: Build YOLO class mapping - creates consistent numeric IDs for class names
        # 📊 Collect all unique class names from annotations across all datasets
        # This ensures consistent class ID assignment across multiple datasets and splits
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

        # 📋 STEP 4a: Ensure stable alphabetical order for consistent YOLO ID assignment
        # Alphabetical sorting guarantees identical class ID assignment across multiple runs
        sorted_unique_class_names = sorted(list(all_unique_class_names))
        if not sorted_unique_class_names:
            sorted_unique_class_names = ["class_0"] # Default class if none found

        # 🔄 STEP 4b: Create bidirectional mapping between class names and YOLO IDs
        # class_name_to_yolo_id: Maps human-readable names to YOLO numeric IDs (0, 1, 2...)
        # yolo_id_to_class_name: Reverse mapping for metadata and debugging
        class_name_to_yolo_id = {name: idx for idx, name in enumerate(sorted_unique_class_names)}
        yolo_id_to_class_name = {idx: name for name, idx in class_name_to_yolo_id.items()}
        class_list_for_yaml = sorted_unique_class_names  # Preserve for data.yaml generation

        # 🔍 STEP 5: Class index resolution function - converts annotations to YOLO class IDs
        # 🎯 This function handles both class_name and class_id based annotations with comprehensive fallback logic
        # Priority: class_name → class_id → fallback to class 0 with detailed error logging
        def resolve_class_index(ann) -> int:
             try:
                 # 🎯 Priority 1: Resolve by class_name (preferred method - most reliable)
                 cname = getattr(ann, 'class_name', None)
                 if cname and cname in class_name_to_yolo_id:
                     return class_name_to_yolo_id[cname]
                 
                 # 🎯 Priority 2: Fallback to class_id if class_name is missing or invalid
                 class_id = getattr(ann, 'class_id', None)
                 if class_id is not None and class_id in class_id_to_name:
                     fallback_name = class_id_to_name[class_id]
                     if fallback_name in class_name_to_yolo_id:
                         return class_name_to_yolo_id[fallback_name]
             except Exception as e:
                 logger.warning("errors.system", f"Failed to resolve class index for annotation", "class_index_resolution_error", {
                     'class_name': getattr(ann, 'class_name', None),
                     'class_id': getattr(ann, 'class_id', None),
                     'error': str(e)
                 })
             # 🎯 Priority 3: Ultimate fallback - default to class 0 with comprehensive error handling
             return 0  # Default to class 0 if all resolution methods fail

        # 🎛️ STEP 6: Initialize transformation schema for intelligent augmentation
        # 🎯 This schema manages the order, combination, and intelligent sampling of image transformations
        # Features: intelligent combination generation, priority-based sampling, and fallback handling
        schema = None
        try:
            from core.transformation_schema import TransformationSchema
            schema = TransformationSchema()
            # 📊 Load transformation configuration from database records
            schema.load_from_database_records([
                {
                    'transformation_type': t.get('type'),
                    'parameters': t.get('params', {}),
                    'is_enabled': True,
                    'order_index': idx
                } for idx, t in enumerate(transformations or [])
            ])
            # 🎯 Configure intelligent sampling: images_per_original = augmented images per original (excludes original)
            schema.set_sampling_config(images_per_original=max(0, multiplier - 1), strategy="intelligent", fixed_combinations=2)
            logger.debug("operations.transformations", f"Transformation schema initialized successfully", "schema_init_success", {
                'transformation_count': len(transformations or []),
                'multiplier': multiplier
            })
        except Exception as _e:
            logger.warning("errors.system", f"Schema initialization failed, will use fallback generation", "schema_init_fallback", {
                'error': str(_e)
            })

        # 📏 STEP 7: Extract baseline resize parameters (applied to all output images)
        # 🎯 This identifies resize transformations that serve as baseline for all output images
        # Baseline resize ensures consistent output dimensions across the entire dataset
        resize_baseline_params = None
        try:
            # 🚨 DEBUG: Log all transformations to see what we're working with
            logger.debug("operations.transformations", f"Processing transformations for resize detection", "transformation_debug", {
                'transformation_count': len(transformations or []),
                'transformations': transformations
            })
            
            # 🔍 Scan transformations to find the first resize operation
            for bt in (transformations or []):
                if bt.get("type") == "resize":
                    rp = dict(bt.get("params", {}))
                    rp["enabled"] = True
                    resize_baseline_params = rp
                    logger.debug("operations.transformations", f"Found baseline resize parameters", "baseline_resize_found", {
                        'resize_params': rp,
                        'has_resize_mode': 'resize_mode' in rp,
                        'resize_mode_value': rp.get('resize_mode', 'NOT_FOUND')
                    })
                    break
        except Exception as _e:
            logger.warning("errors.system", f"Failed to process baseline resize parameters", "baseline_resize_failure", {
                'error': str(_e)
            })
            resize_baseline_params = None
        
        # 🖼️ STEP 8: Process each split (train/val/test) with augmentation
        # 🎯 Main processing loop: Iterates through train/val/test splits for comprehensive dataset generation
        # Each split is processed independently with its own augmentation strategy and image count tracking
        final_image_count = 0
        
        for split, images in all_images_by_split.items():
            if not images:
                continue
                
            logger.info("operations.images", f"Processing split with images", "split_processing", {
                'split': split,
                'image_count': len(images),
                'multiplier': multiplier
            })

            # 🎯 STEP 9: Calculate variant cap - limits augmented images per original
            # 📊 Purpose: Determines the maximum number of augmented variants per original image
            # 🎯 Key functions:
            #   - Prevents combinatorial explosion from multiple transformations
            #   - Ensures dataset size remains manageable
            #   - Uses intelligent sampling to prioritize diverse transformations
            #   - Falls back to safe defaults when complex calculation fails
            try:
                from core.transformation_schema import TransformationSchema
                schema = TransformationSchema()
                # 🔄 Convert transformation config to schema format
                schema.load_from_database_records([
                    {
                        'transformation_type': t.get('type'),
                        'parameters': t.get('params', {}),
                        'is_enabled': True,
                        'order_index': idx
                    } for idx, t in enumerate(transformations or [])
                ])
                # 📈 Set proper sampling configuration to enable Priority 3 combinations
                from core.transformation_config import calculate_max_images_per_original
                transformation_list = [
                    {
                        'transformation_type': t.get('type'),
                        'enabled': True,
                        'parameters': t.get('params', {})
                    } for t in (transformations or [])
                ]
                # 🧮 Calculate maximum possible images from transformation combinations
                max_images_result = calculate_max_images_per_original(transformation_list)
                total_with_original = max_images_result.get('max', 6)  # Default to 6 for brightness+flip
                # ⚙️ Configure intelligent sampling strategy
                schema.set_sampling_config(
                    images_per_original=images_per_original,
                    strategy="intelligent",
                    fixed_combinations=2
                )
                # 📊 Get estimated combination count from schema
                total_with_original = schema.get_combination_count_estimate()
                # 🎯 Calculate variant cap (excluding original image)
                variant_cap = max(0, int(total_with_original) - 1)
            except Exception:
                # 🛡️ Fallback: Simple calculation when complex logic fails
                variant_cap = max(0, (len(transformations or []) > 0) and 1 or 0)
            # 🎯 Calculate effective multiplier (original + variants)
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
            
            # 🖼️ STEP 10: Process each image in the current split
            # 📊 Purpose: Main loop for processing individual images in the dataset split
            # 🎯 Key functions:
            #   - Handles both original and augmented image processing
            #   - Manages file naming and format conversion
            #   - Coordinates with transformation system for augmented variants
            #   - Maintains proper directory structure for YOLO format
            for img_data in images:
                # 📁 Copy original image
                # 🎯 Extract image metadata for processing
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

                    # 🔄 STEP 11: Transformation tracking system (for annotation coordinate conversion)
                    # 📊 Purpose: Tracks geometric transformations to properly convert annotation coordinates
                    # 🎯 Key functions:
                    #   - Maintains transformation metadata for coordinate conversion
                    #   - Handles both simple (resize-only) and complex transformations
                    #   - Provides fallback mechanisms for transformation failures
                    #   - Ensures annotation coordinates match transformed image geometry
                    transformation_tracking_data = None
                    
                    # 🔍 DEBUG: Check transformations variable
                    print(f"\n=== 🔍 TRANSFORMATIONS DEBUG :: {img_data.get('filename', 'unknown')} ===")
                    print(f"transformations variable: {transformations}")
                    print(f"transformations type: {type(transformations)}")
                    print(f"transformations bool: {bool(transformations)}")
                    
                    # Check if we have any transformations to apply
                    if transformations:
                        # Check if this is resize-only transformation
                        # Resize-only uses simple coordinate math, complex uses ImageTransformer
                        is_resize_only = (
                            len(transformations) == 1 and 
                            transformations[0].get('type') == 'resize'
                        )
                        
                        if is_resize_only:
                            print(f"🎯 RESIZE-ONLY DETECTED for {img_data.get('filename', 'unknown')}")
                            # Use simple resize (the original working method)
                            resize_config = transformations[0]['params']
                            target_width = resize_config.get('width')
                            target_height = resize_config.get('height')
                            
                            from PIL import Image as PILImage
                            pil_img = PILImage.open(original_path).convert('RGB')
                            original_dims = pil_img.size
                            print(f"🖼️ Original image dims: {original_dims}")
                            
                            # Use proper resize logic that respects resize_mode (same as complex path)
                            from ..services.image_transformer import ImageTransformer
                            transformer = ImageTransformer()
                            augmented_image = transformer._apply_resize(pil_img, resize_config)
                            final_dims = augmented_image.size
                            print(f"🖼️ Resized to: {final_dims} using mode: {resize_config.get('resize_mode', 'stretch_to')}")
                            
                            # Track transformations for annotation coordinate transformation
                            # Creates transformation matrix for coordinate conversion
                            transformation_tracking_data = track_transformations_for_annotations(
                                transformations=transformations,
                                original_dims=original_dims,
                                final_dims=final_dims,
                                transformer=transformer
                            )
                            print(f"🎯 RESIZE-ONLY: Using tracking system for annotations!")
                            
                        else:
                            print(f"🎯 COMPLEX TRANSFORMATIONS for {img_data.get('filename', 'unknown')}")
                            # FIXED: For original image in complex path, apply only resize (baseline behavior)
                            try:
                                from PIL import Image as PILImage
                                pil_img = PILImage.open(original_path).convert('RGB')
                                original_dims = pil_img.size
                                print(f"🖼️ Original image dims: {original_dims}")
                                
                                # CRITICAL FIX: For original image, apply ONLY resize transformation (baseline)
                                # Find resize transformation in the list
                                resize_transform = None
                                for transform in transformations:
                                    if transform.get('type') == 'resize':
                                        resize_transform = transform
                                        break
                                
                                if resize_transform:
                                    print(f"🎯 ORIGINAL IMAGE: Applying ONLY resize (baseline behavior)")
                                    # Apply only resize to original image using proper resize logic
                                    resize_params = resize_transform.get('params', {})
                                    target_width = resize_params.get('width')
                                    target_height = resize_params.get('height')
                                    
                                    if target_width and target_height:
                                        # 🎯 FIXED: Use proper resize logic that respects resize_mode
                                        from ..services.image_transformer import ImageTransformer
                                        transformer = ImageTransformer()
                                        
                                        # Apply resize transformation with proper mode handling
                                        augmented_image = transformer._apply_resize(pil_img, resize_params)
                                        print(f"🖼️ Resized to: {augmented_image.size} using mode: {resize_params.get('resize_mode', 'stretch_to')}")
                                        
                                        # Track only resize transformation for original image
                                        transformation_list = [resize_transform]
                                        final_dims = augmented_image.size
                                    else:
                                        print(f"⚠️ No resize dimensions found, keeping original")
                                        augmented_image = pil_img.copy()
                                        transformation_list = []
                                        final_dims = original_dims
                                else:
                                    print(f"🎯 ORIGINAL IMAGE: No resize found, applying all transformations")
                                    # No resize found, apply all transformations using ImageTransformer
                                    from ..services.image_transformer import ImageTransformer
                                    transformer = ImageTransformer()
                                    
                                    # Convert transformations list to config dict
                                    config_dict = {}
                                    for transform in transformations:
                                        transform_type = transform.get('type')
                                        transform_params = transform.get('params', {})
                                        # Add enabled flag
                                        transform_params['enabled'] = True
                                        config_dict[transform_type] = transform_params
                                    
                                    augmented_image = transformer.apply_transformations(pil_img, config_dict)
                                    transformation_list = transformations
                                    final_dims = augmented_image.size if augmented_image else original_dims
                                
                                # Track transformations for annotation coordinate transformation
                                transformation_tracking_data = track_transformations_for_annotations(
                                    transformations=transformation_list,
                                    original_dims=original_dims,
                                    final_dims=final_dims,
                                    transformer=transformer
                                )
                                print(f"🎯 ORIGINAL IMAGE BASELINE: Applied resize-only, augmented images will get full combinations!")
                                
                            except Exception as complex_e:
                                print(f"🚨 COMPLEX TRANSFORMATION ERROR: {complex_e}")
                                # Fallback to simple processing
                                augmented_image = None
                                transformation_tracking_data = None
                        
                        # Save the transformed image (common for both resize-only and complex)
                        # Uses centralized format engine or falls back to direct PIL save
                        try:
                            if augmented_image:
                                if image_format_engine is not None:
                                    image_format_engine._save_image_with_format(augmented_image, dest_path, config.output_format)
                                else:
                                    augmented_image.save(dest_path)
                                augmented_image.close()
                            else:
                                # Fallback: copy original when transformation fails
                                shutil.copy2(original_path, dest_path)
                            
                            pil_img.close()
                        except Exception as _e:
                            print(f"🚨 EXCEPTION in tracking system: {str(_e)}")
                            print(f"🚨 Exception type: {type(_e)}")
                            import traceback
                            print(f"🚨 Traceback: {traceback.format_exc()}")
                            logger.warning("errors.system", f"Failed to apply transformations to original, copying instead", "transformation_fallback_copy", {
                                'original_path': original_path,
                                'error': str(_e)
                            })
                            transformation_tracking_data = None
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
                        # No transformations → copy original with format conversion
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
                    # Determines YOLO format based on task type and export configuration
                    try:
                        print(f"🔍 LABEL MODE DETECTION:")
                        print(f"   Config exists: {config is not None}")
                        if config:
                            print(f"   Task type: {getattr(config, 'task_type', None)}")
                            print(f"   Export format: {getattr(config, 'export_format', None)}")
                        
                        if config and getattr(config, 'task_type', None) == 'segmentation' and getattr(config, 'export_format', '').lower() in ["yolo", "yolo_segmentation"]:
                            label_mode = "yolo_segmentation"
                            print(f"   ✅ Using SEGMENTATION mode: {label_mode}")
                        else:
                            label_mode = "yolo_detection"
                            print(f"   ✅ Using DETECTION mode: {label_mode}")
                    except Exception as e:
                        label_mode = "yolo_detection"
                        print(f"   ⚠️  Exception in label mode detection: {e}")
                        print(f"   ✅ Fallback to DETECTION mode: {label_mode}")

                    # ✅ USE TRACKING SYSTEM FOR ALL LABEL GENERATION
                    # 📝 STEP 12: YOLO label file creation with transformation-aware coordinate conversion
                    # Purpose: Generate YOLO format label files that match transformed image coordinates
                    # Key Features:
                    # - Transformation-aware coordinate conversion for geometric transforms (resize, crop, etc.)
                    # - Support for both detection and segmentation task types
                    # - Fallback paths for images without geometric transformations
                    # - Comprehensive debug logging for troubleshooting
                    # - Uses new annotation_transformer.py functions for consistent coordinate handling
                    # Ensure label matches the output image base name
                    label_filename = os.path.splitext(output_filename)[0] + ".txt"
                    label_path = os.path.join(staging_dir, "labels", safe_split, label_filename)
                    os.makedirs(os.path.dirname(label_path), exist_ok=True)
                    # Initialize label_content to avoid reference before assignment
                    label_content = None
                    try:
                        # Get final image dimensions
                        try:
                            from PIL import Image as PILImage
                            _tmp_img = PILImage.open(dest_path)
                            img_w, img_h = _tmp_img.size
                            _tmp_img.close()  # Close the temporary image
                        except Exception:
                            img_w = int(getattr(img_data["db_image"], 'width', 640))
                            img_h = int(getattr(img_data["db_image"], 'height', 480))
                        
                        # ✅ USE NEW TRANSFORMATION SYSTEM FOR ANNOTATIONS
                        # 🔄 STEP 12a: Transformation-aware annotation conversion (with geometric transforms)
                        if transformation_tracking_data and transformation_tracking_data.get("has_geometric_transforms", False):
                            print(f"🎯 RELEASES.PY: Using NEW FUNCTIONS with internal transformation!")
                            print(f"   📊 Tracking data: {transformation_tracking_data}")
                            
                            # Get original dimensions from tracking data
                            original_dims = transformation_tracking_data.get("original_dims")
                            transform_config = transformation_tracking_data.get("transformation_config")
                            
                            # Use NEW functions that transform internally
                            # 📊 Uses advanced coordinate transformation from annotation_transformer.py
                            if label_mode == "yolo_detection":
                                from core.annotation_transformer import transform_detection_annotations_to_yolo
                                yolo_lines = transform_detection_annotations_to_yolo(
                                    annotations=img_data["annotations"],
                                    img_w=img_w,
                                    img_h=img_h,
                                    transform_config=transform_config,
                                    original_dims=original_dims,
                                    class_index_resolver=resolve_class_index,
                                    label_mode=label_mode
                                )
                                label_content = "\n".join(yolo_lines)
                                print(f"✅ NEW DETECTION FUNCTION RESULT: {len(yolo_lines)} lines")
                            elif label_mode == "yolo_segmentation":
                                from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                                yolo_lines = transform_segmentation_annotations_to_yolo(
                                    annotations=img_data["annotations"],
                                    img_w=img_w,
                                    img_h=img_h,
                                    transform_config=transform_config,
                                    original_dims=original_dims,
                                    class_index_resolver=resolve_class_index,
                                    label_mode=label_mode
                                )
                                label_content = "\n".join(yolo_lines)
                                print(f"✅ NEW SEGMENTATION FUNCTION RESULT: {len(yolo_lines)} lines")
                            
                            # Write the label file
                            with open(label_path, 'w') as f:
                                f.write(label_content)
                        else:
                            # 🔄 STEP 12b: Fallback path - no geometric transformations applied
                            # No resize: use new YOLO functions with original dimensions
                            img_w = int(getattr(img_data["db_image"], 'width', 640))
                            img_h = int(getattr(img_data["db_image"], 'height', 480))
                            
                            # 🔍 DEBUG: Show input annotations
                            # 🔍 STEP 13: Comprehensive debug logging for annotation processing
                            # Purpose: Provide detailed debugging information for YOLO label generation
                            # Key Features:
                            # - Shows input annotation details (count, class names, bounding boxes)
                            # - Logs function selection and transformation status
                            # - Displays YOLO conversion results with line counts and sample content
                            # - Helps troubleshoot empty or incorrect label generation
                            # - Provides visual feedback during development and testing
                            print(f"\n=== 📥 INPUT ANNOTATIONS :: {img_data.get('filename', 'unknown')} ===")
                            print(f"Image dimensions: {img_w}x{img_h}")
                            print(f"Annotations count: {len(img_data['annotations'])}")
                            print(f"🔍 COORDINATES BEFORE ANNOTATION TRANSFORMER:")
                            for i, ann in enumerate(img_data["annotations"][:3]):  # Show first 3
                                print(f"   Ann {i+1}: class={getattr(ann, 'class_name', 'unknown')}, "
                                      f"bbox=({getattr(ann, 'x_min', 'N/A')}, {getattr(ann, 'y_min', 'N/A')}, "
                                      f"{getattr(ann, 'x_max', 'N/A')}, {getattr(ann, 'y_max', 'N/A')})")
                                if hasattr(ann, 'x_min') and hasattr(ann, 'x_max'):
                                    print(f"      width={getattr(ann, 'x_max', 0) - getattr(ann, 'x_min', 0)}, height={getattr(ann, 'y_max', 0) - getattr(ann, 'y_min', 0)}")
                            if len(img_data["annotations"]) > 3:
                                print(f"   ... and {len(img_data['annotations']) - 3} more")
                            
                            # 🔍 DEBUG: USING NEW YOLO FUNCTIONS FROM annotation_transformer.py WITH TRANSFORMATIONS
                            print(f"\n=== ✅ USING NEW YOLO FUNCTIONS :: {img_data.get('filename', 'unknown')} ===")
                            print(f"Label mode: {label_mode}")
                            print(f"Using NEW functions from annotation_transformer.py with proper transformations")
                            
                            # Use NEW functions from annotation_transformer.py with proper transformation config
                            if label_mode == "yolo_segmentation":
                                from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                                yolo_lines = transform_segmentation_annotations_to_yolo(
                                    annotations=img_data["annotations"],
                                    img_w=img_w,
                                    img_h=img_h,
                                    transform_config=transformation_tracking_data.get("transformation_config") if transformation_tracking_data else None,
                                    class_index_resolver=resolve_class_index,
                                    label_mode=label_mode
                                )
                                label_content = "\n".join(yolo_lines)
                                print(f"✅ NEW SEGMENTATION FUNCTION RESULT: {len(yolo_lines)} lines")
                            else:
                                from core.annotation_transformer import transform_detection_annotations_to_yolo
                                yolo_lines = transform_detection_annotations_to_yolo(
                                    annotations=img_data["annotations"],
                                    img_w=img_w,
                                    img_h=img_h,
                                    transform_config=transformation_tracking_data.get("transformation_config") if transformation_tracking_data else None,
                                    class_index_resolver=resolve_class_index,
                                    label_mode=label_mode
                                )
                                label_content = "\n".join(yolo_lines)
                                print(f"✅ NEW DETECTION FUNCTION RESULT: {len(yolo_lines)} lines")
                            
                            # 🔍 STEP 13c: Comprehensive debug output for label file generation
                            print(f"📝 WRITING TO LABEL FILE: {label_path}")
                            print(f"   Content length: {len(label_content)} chars")
                            if label_content.strip():
                                lines = label_content.strip().split('\n')
                                print(f"   Lines: {len(lines)}")
                                print(f"   First line: {lines[0]}")
                                if len(lines) > 1:
                                    print(f"   Last line: {lines[-1]}")
                            else:
                                print(f"   ❌ EMPTY CONTENT!")
                            
                            with open(label_path, 'w') as f:
                                f.write(label_content)
                    except Exception as _e:
                        # 🛡️ STEP 14: Robust error handling with comprehensive fallback system
                        # PURPOSE: Provides multi-layer error recovery for YOLO label generation failures
                        # KEY FEATURES:
                        # • Primary error detection and logging for label write failures
                        # • Secondary fallback using new annotation transformer functions
                        # • Proper error handling with detailed error context
                        # • Graceful degradation to empty labels if all recovery fails
                        # • Maintains data integrity while providing diagnostic information
                        logger.warning("errors.system", f"Failed to write original labels (resize-aware)", "original_labels_write_error", {
                            'original_filename': original_filename,
                            'error': str(_e)
                        })
                        # Fallback: use new annotation transformer functions with proper error handling
                        try:
                            img_w, img_h = img_data["db_image"].width, img_data["db_image"].height
                            if label_mode == "yolo_detection":
                                from core.annotation_transformer import transform_detection_annotations_to_yolo
                                yolo_lines = transform_detection_annotations_to_yolo(
                                    annotations=img_data["annotations"],
                                    img_w=img_w,
                                    img_h=img_h,
                                    transform_config=None,
                                    class_index_resolver=resolve_class_index,
                                    label_mode=label_mode
                                )
                                label_content = "\n".join(yolo_lines)
                            elif label_mode == "yolo_segmentation":
                                from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                                yolo_lines = transform_segmentation_annotations_to_yolo(
                                    annotations=img_data["annotations"],
                                    img_w=img_w,
                                    img_h=img_h,
                                    transform_config=None,
                                    class_index_resolver=resolve_class_index,
                                    label_mode=label_mode
                                )
                                label_content = "\n".join(yolo_lines)
                            else:
                                label_content = ""
                        except Exception as fallback_e:
                            logger.error("errors.system", f"Fallback YOLO conversion also failed", "fallback_yolo_error", {
                                'original_filename': original_filename,
                                'original_error': str(_e),
                                'fallback_error': str(fallback_e)
                            })
                            label_content = ""
                        
                        with open(label_path, 'w') as f:
                            f.write(label_content)
                    
                    final_image_count += 1
                    
                    # 🎯 STEP 15: Augmented image generation with schema-driven priority order
                    # PURPOSE: Generates augmented image variants using schema-driven transformations
                    # KEY FEATURES:
                    # • Schema-based augmentation plan generation with priority ordering
                    # • Fallback mechanism for schema failures with replication-based augmentation
                    # • Descriptive filename generation honoring output format preferences
                    # • Centralized ImageTransformer usage for consistent transformation application
                    # • Comprehensive transformation tracking for annotation coordinate mapping
                    # • Safety mechanisms for resize enforcement and format conversion
                    # • Advanced annotation transformation system with geometric awareness
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
                            original_dims = pil_img.size  # Track original dimensions
                            augmented_image = transformer.apply_transformations(pil_img, config_dict)
                            final_dims = augmented_image.size if augmented_image else original_dims  # Track final dimensions
                            
                            # ✅ TRACK TRANSFORMATIONS FOR ANNOTATION PROCESSING
                            # Convert config_dict to transformation list format for tracking
                            transformation_list = []
                            for transform_type, params in config_dict.items():
                                if params.get("enabled", True):
                                    transformation_list.append({
                                        "type": transform_type,
                                        "params": {k: v for k, v in params.items() if k != "enabled"}
                                    })
                            
                            # 🚨 DEBUG: Log transformation_list to see what we're passing to tracking
                            logger.debug("operations.transformations", f"Built transformation_list for tracking", "transformation_list_debug", {
                                'transformation_list': transformation_list,
                                'config_dict': config_dict,
                                'original_dims': original_dims,
                                'final_dims': final_dims
                            })
                            
                            # Track transformations for annotation coordinate transformation
                            transformation_tracking_data = track_transformations_for_annotations(
                                transformations=transformation_list,
                                original_dims=original_dims,
                                final_dims=final_dims,
                                transformer=transformer
                            )
                            
                            # Close the original PIL image
                            pil_img.close()
                        except Exception as _e:
                            logger.warning("errors.system", f"Falling back to simple apply", "simple_apply_fallback", {
                                'original_path': original_path,
                                'error': str(_e)
                            })
                            augmented_image = None
                            transformation_tracking_data = None
                        if augmented_image:
                                # Safety: if resize target specified, enforce final size (except for fit_within mode)
                                try:
                                    if resize_params_for_aug:
                                        resize_mode = resize_params_for_aug.get("resize_mode", "stretch_to")
                                        target_w = int(resize_params_for_aug.get("width") or 0)
                                        target_h = int(resize_params_for_aug.get("height") or 0)
                                        if target_w > 0 and target_h > 0:
                                            # Only enforce exact size for stretch_to mode, not fit_within
                                            if resize_mode == "stretch_to" and augmented_image.size != (target_w, target_h):
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
                                    # ✅ USE NEW TRANSFORMATION SYSTEM FOR ANNOTATIONS
                                    if transformation_tracking_data and transformation_tracking_data.get("has_geometric_transforms", False):
                                        print(f"🎯 RELEASES.PY: Using ADVANCED transformation system for annotations!")
                                        print(f"   📊 Tracking data: {transformation_tracking_data}")
                                        # Apply same transformations to annotations that were applied to image
                                        print(f"🔍 DEBUG: About to transform {len(img_data['annotations'])} annotations")
                                        print(f"   First annotation type: {type(img_data['annotations'][0]) if img_data['annotations'] else 'None'}")
                                        if img_data['annotations']:
                                            ann = img_data['annotations'][0]
                                            print(f"   First annotation attrs: {[attr for attr in dir(ann) if not attr.startswith('_')]}")
                                            if hasattr(ann, 'x_min'):
                                                print(f"   First annotation coords: ({ann.x_min}, {ann.y_min}, {ann.x_max}, {ann.y_max})")
                                        
                                        transformed_annotations = apply_transformations_to_annotations(
                                            annotations=img_data["annotations"],
                                            tracking_data=transformation_tracking_data
                                        )
                                        
                                        print(f"🔍 DEBUG: Transformation result: {len(transformed_annotations)} annotations")
                                        if transformed_annotations:
                                            ann = transformed_annotations[0]
                                            print(f"   First transformed annotation: ({ann.x_min}, {ann.y_min}, {ann.x_max}, {ann.y_max})")
                                        logger.debug("operations.transformations", f"Using transformed annotations for augmented labels", "transformed_annotations_used", {
                                            'original_count': len(img_data["annotations"]),
                                            'transformed_count': len(transformed_annotations),
                                            'aug_filename': aug_filename
                                        })
                                    else:
                                        print(f"⚪ RELEASES.PY: No geometric transformations detected, using original annotations")
                                        print(f"   📊 Tracking data: {transformation_tracking_data}")
                                        # No geometric transformations, use original annotations
                                        transformed_annotations = img_data["annotations"]
                                        logger.debug("operations.transformations", f"Using original annotations (no geometric transforms)", "original_annotations_used", {
                                            'annotation_count': len(transformed_annotations),
                                            'aug_filename': aug_filename
                                        })
                                    
                                    # Create YOLO labels using transformed annotations
                                    if label_mode in ["yolo_detection", "yolo_segmentation"]:
                                        # Use new YOLO conversion functions with transformed annotations
                                        img_w, img_h = augmented_image.size[0], augmented_image.size[1]
                                        
                                        if label_mode == "yolo_detection":
                                            from core.annotation_transformer import transform_detection_annotations_to_yolo, _debug_yolo_dump
                                            
                                            print(f"🔍 DEBUG: About to call _debug_yolo_dump")
                                            print(f"   aug_filename: {aug_filename}")
                                            print(f"   transformed_annotations count: {len(transformed_annotations)}")
                                            print(f"   img_w, img_h: {img_w}, {img_h}")
                                            if transformed_annotations:
                                                ann = transformed_annotations[0]
                                                print(f"   First annotation: {type(ann)} - {getattr(ann, 'x_min', 'NO_X_MIN')}")
                                            
                                            # 🔍 DEBUG: Call debug function before YOLO conversion
                                            det_lines, seg_lines = _debug_yolo_dump(aug_filename, transformed_annotations, img_w, img_h, class_index_resolver=resolve_class_index)
                                            
                                            print(f"🔍 DEBUG: _debug_yolo_dump returned:")
                                            print(f"   det_lines count: {len(det_lines)}")
                                            print(f"   seg_lines count: {len(seg_lines)}")
                                            if det_lines:
                                                print(f"   First det_line: {det_lines[0]}")
                                            
                                            label_content = "\n".join(det_lines)
                                            
                                        else:  # yolo_segmentation
                                            from core.annotation_transformer import transform_segmentation_annotations_to_yolo, _debug_yolo_dump
                                            
                                            # 🔍 DEBUG: Call debug function before YOLO conversion
                                            det_lines, seg_lines = _debug_yolo_dump(aug_filename, transformed_annotations, img_w, img_h, class_index_resolver=resolve_class_index)
                                            label_content = "\n".join(seg_lines)
                                        with open(aug_label_path, 'w') as f:
                                            f.write(label_content)
                                        
                                        logger.debug("operations.transformations", f"Created YOLO labels with transformed annotations", "yolo_labels_created", {
                                            'label_mode': label_mode,
                                            'annotation_count': len(transformed_annotations),
                                            'image_dims': augmented_image.size,
                                            'aug_filename': aug_filename
                                        })
                                        
                                        # 🎯 SAVE DEBUG TRACKING JSON FOR THIS AUGMENTED IMAGE
                                        if transformation_tracking_data and transformation_tracking_data.get('debug_info'):
                                            try:
                                                # Add image-specific info to debug data
                                                debug_info = transformation_tracking_data['debug_info'].copy()
                                                debug_info['augmented_image_name'] = aug_filename
                                                debug_info['augmented_image_size'] = list(augmented_image.size)
                                                debug_info['label_file'] = aug_label_filename
                                                debug_info['split'] = safe_split
                                                
                                                # Save debug JSON in metadata folder
                                                save_debug_tracking_json(
                                                    debug_info=debug_info,
                                                    metadata_dir=metadata_dir,
                                                    image_name=aug_filename
                                                )
                                                
                                                logger.info("operations.debug", f"Debug tracking saved for augmented image", "debug_tracking_saved", {
                                                    'aug_filename': aug_filename,
                                                    'annotation_count': len(transformed_annotations),
                                                    'transformations': list(debug_info.get('transformation_config', {}).keys())
                                                })
                                            except Exception as debug_e:
                                                logger.warning("errors.debug", f"Failed to save debug tracking for augmented image", "debug_save_warning", {
                                                    'aug_filename': aug_filename,
                                                    'error': str(debug_e)
                                                })
                                    else:
                                        with open(aug_label_path, 'w') as f:
                                            f.write("")
                                except Exception as _e:
                                    logger.warning("errors.system", f"Failed to create transformed aug labels", "aug_labels_creation_error", {
                                        'aug_filename': aug_filename,
                                        'error': str(_e)
                                    })
                                    # ✅ FALLBACK: Use transformed annotations if available, otherwise original
                                    try:
                                        if transformation_tracking_data and transformation_tracking_data.get("has_geometric_transforms", False):
                                            fallback_annotations = apply_transformations_to_annotations(
                                                annotations=img_data["annotations"],
                                                tracking_data=transformation_tracking_data
                                            )
                                        else:
                                            fallback_annotations = img_data["annotations"]
                                        
                                        # Update image dimensions for fallback
                                        fallback_db_image = type('FallbackImage', (), {
                                            'width': augmented_image.size[0],
                                            'height': augmented_image.size[1]
                                        })()
                                        
                                        # Use new YOLO functions for fallback too
                                        img_w, img_h = augmented_image.size[0], augmented_image.size[1]
                                        
                                        if label_mode == "yolo_detection":
                                            from core.annotation_transformer import transform_detection_annotations_to_yolo
                                            yolo_lines = transform_detection_annotations_to_yolo(
                                                annotations=fallback_annotations,
                                                img_w=img_w,
                                                img_h=img_h,
                                                transform_config=None,
                                                class_index_resolver=resolve_class_index,
                                                label_mode=label_mode
                                            )
                                            fallback_content = "\n".join(yolo_lines)
                                        elif label_mode == "yolo_segmentation":
                                            from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                                            yolo_lines = transform_segmentation_annotations_to_yolo(
                                                annotations=fallback_annotations,
                                                img_w=img_w,
                                                img_h=img_h,
                                                transform_config=None,
                                                class_index_resolver=resolve_class_index,
                                                label_mode=label_mode
                                            )
                                            fallback_content = "\n".join(yolo_lines)
                                        else:
                                            # Ultimate fallback: use new annotation transformer functions
                                            try:
                                                img_w, img_h = fallback_db_image.width, fallback_db_image.height
                                                if label_mode == "yolo_detection":
                                                    from core.annotation_transformer import transform_detection_annotations_to_yolo
                                                    yolo_lines = transform_detection_annotations_to_yolo(
                                                        annotations=fallback_annotations,
                                                        img_w=img_w,
                                                        img_h=img_h,
                                                        transform_config=None,
                                                        class_index_resolver=resolve_class_index,
                                                        label_mode=label_mode
                                                    )
                                                    fallback_content = "\n".join(yolo_lines)
                                                elif label_mode == "yolo_segmentation":
                                                    from core.annotation_transformer import transform_segmentation_annotations_to_yolo
                                                    yolo_lines = transform_segmentation_annotations_to_yolo(
                                                        annotations=fallback_annotations,
                                                        img_w=img_w,
                                                        img_h=img_h,
                                                        transform_config=None,
                                                        class_index_resolver=resolve_class_index,
                                                        label_mode=label_mode
                                                    )
                                                    fallback_content = "\n".join(yolo_lines)
                                                else:
                                                    fallback_content = ""
                                            except Exception as fallback_e:
                                                logger.error("errors.system", f"Ultimate fallback YOLO conversion failed", "ultimate_fallback_error", {
                                                    'aug_filename': aug_filename,
                                                    'error': str(fallback_e)
                                                })
                                                fallback_content = ""
                                        
                                        with open(aug_label_path, 'w') as f:
                                            f.write(fallback_content)
                                    except Exception as fallback_e:
                                        logger.error("errors.system", f"Fallback annotation transformation also failed", "fallback_transformation_error", {
                                            'aug_filename': aug_filename,
                                            'original_error': str(_e),
                                            'fallback_error': str(fallback_e)
                                        })
                                        # Last resort: empty label file
                                        with open(aug_label_path, 'w') as f:
                                            f.write("")
                                
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

        # Step 3b: Write new metadata files (release_config.json & annotations.json) AFTER augmentation
        metadata_dir = os.path.join(staging_dir, "metadata")
        os.makedirs(metadata_dir, exist_ok=True)

        # Build annotations mapping and gather split counts
        split_counts_meta = {}
        for _spl in ["train", "val", "test"]:
            img_dir = os.path.join(staging_dir, "images", _spl)
            split_counts_meta[_spl] = len([f for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f))]) if os.path.exists(img_dir) else 0

        # Extract unique class indices from YOLO label files
        unique_class_ids = set()
        labels_root = os.path.join(staging_dir, "labels")
        if os.path.exists(labels_root):
            for root_lbl, _dirs_lbl, files_lbl in os.walk(labels_root):
                for _lf in files_lbl:
                    if _lf.lower().endswith(".txt"):
                        try:
                            with open(os.path.join(root_lbl, _lf), "r") as lf:
                                for _ln in lf:
                                    parts = _ln.strip().split()
                                    if parts:
                                        unique_class_ids.add(int(float(parts[0])))
                        except Exception:
                            pass
        classes_sorted = sorted(unique_class_ids)

        # Build annotations.json by parsing YOLO label files
        annotations_data = {}
        for split in ["train", "val", "test"]:
            lbl_dir = os.path.join(labels_root, split)
            img_dir_rel = os.path.join("images", split)
            if not os.path.exists(lbl_dir):
                continue
            for lbl_file in os.listdir(lbl_dir):
                if not lbl_file.lower().endswith(".txt"):
                    continue
                lbl_path = os.path.join(lbl_dir, lbl_file)
                img_name = os.path.splitext(lbl_file)[0]
                # Assume image has the selected output format extension
                possible_exts = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]
                rel_img_path = None
                for ext in possible_exts:
                    _candidate = os.path.join(img_dir_rel, img_name + ext)
                    if os.path.exists(os.path.join(staging_dir, _candidate)):
                        rel_img_path = _candidate
                        break
                if rel_img_path is None:
                    rel_img_path = os.path.join(img_dir_rel, img_name + possible_exts[0])
                shapes = []
                try:
                    with open(lbl_path, "r") as lf:
                        for _ln in lf:
                            parts = _ln.strip().split()
                            if len(parts) < 5:
                                continue
                            cid = int(float(parts[0]))
                            if len(parts) == 5:
                                # YOLO detection format
                                cx, cy, w, h = map(float, parts[1:5])
                                shapes.append({"class_id": cid, "bbox": [cx, cy, w, h]})
                            else:
                                # YOLO segmentation format: full polygon coordinates
                                coords = list(map(float, parts[1:]))
                                shapes.append({"class_id": cid, "polygon": coords})
                except Exception:
                    pass
                annotations_data[rel_img_path] = shapes

        # 🔍 DEBUG: Show annotations.json content
        print(f"\n=== 📋 WRITING ANNOTATIONS.JSON ===")
        print(f"Total images with annotations: {len(annotations_data)}")
        for img_path, shapes in annotations_data.items():
            print(f"   {img_path}: {len(shapes)} annotations")
            if shapes:
                print(f"      First annotation: {shapes[0]}")
        
        with open(os.path.join(metadata_dir, "annotations.json"), "w") as f:
            json.dump(annotations_data, f, indent=2)

        # Serialize release config to JSON and include classes
        try:
            config_data_json = config.dict() if hasattr(config, "dict") else dict(config.__dict__)
        except Exception:
            config_data_json = {}
        # Prefer readable class names when available
        if class_list_for_yaml:
            config_data_json["classes"] = class_list_for_yaml
        else:
            config_data_json["classes"] = classes_sorted
        config_data_json["split_counts"] = split_counts_meta
        config_data_json["total_images"] = final_image_count
        # Embed transformation info for transparency
        try:
            if transformations:
                config_data_json["transformations"] = transformations
        except NameError:
            pass
        with open(os.path.join(metadata_dir, "release_config.json"), "w") as f:
            json.dump(config_data_json, f, indent=2)
        
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
                fill_color = transform_params.get("fill_color", "white")
                if angle != 0:
                    # Convert fill_color to RGB tuple if it's a string
                    if isinstance(fill_color, str):
                        if fill_color.lower() == 'white':
                            fill_color_rgb = 'white'
                        elif fill_color.lower() == 'black':
                            fill_color_rgb = 'black'
                        else:
                            fill_color_rgb = 'white'  # default to white
                    else:
                        fill_color_rgb = fill_color
                    
                    logger.debug("operations.images", f"Applying rotation transformation", "rotation_application", {
                        'angle': angle,
                        'expand': False,
                        'fill_color': fill_color_rgb
                    })
                    # ✅ DATA AUGMENTATION: Keep same dimensions, configurable background fill
                    image = image.rotate(angle, expand=False, fillcolor=fill_color_rgb)
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


def track_transformations_for_annotations(transformations: List[dict], original_dims: tuple, final_dims: tuple, transformer=None) -> dict:
    """
    Track EXACT transformations applied to images for annotation coordinate transformation.
    
    This function captures all transformation details needed to apply the same transformations
    to annotation coordinates using the enhanced annotation_transformer.py.
    
    Args:
        transformations: List of transformation dicts [{"type": "rotate", "params": {"angle": -26}}, ...]
        original_dims: (width, height) of original image
        final_dims: (width, height) of final transformed image
        transformer: ImageTransformer instance to collect actual geometry parameters
        
    Returns:
        dict: Complete transformation tracking data for annotation processing
        {
            "transformation_sequence": [...],  # Sequential transformations applied
            "transformation_config": {...},   # Config format for annotation_transformer.py
            "original_dims": (width, height),
            "final_dims": (width, height),
            "has_geometric_transforms": bool,
            "geometric_transforms": [...],     # Only geometric transforms that affect coordinates
            "photometric_transforms": [...],   # Only photometric transforms (for reference)
            "actual_geometry_params": {...}    # Actual calculated parameters for crop, rotation, affine_transform
        }
    """
    # 🚨 DEBUG: Log INPUT to tracking function
    print(f"\n🔍 TRACKING FUNCTION INPUT:")
    print(f"   Transformations: {transformations}")
    print(f"   Original dims: {original_dims}")
    print(f"   Final dims: {final_dims}")
    
    logger.debug("operations.transformations", f"Starting transformation tracking for annotations", "transformation_tracking_start", {
        'transformation_count': len(transformations),
        'transformations': transformations,
        'original_dims': original_dims,
        'final_dims': final_dims,
        'purpose': 'annotation_coordinate_transformation'
    })
    
    # Define geometric vs photometric transformations
    geometric_transform_types = {
        'resize', 'rotate', 'rotation', 'flip', 'crop', 'random_zoom', 
        'affine_transform', 'perspective_warp', 'shear'
    }
    photometric_transform_types = {
        'brightness', 'contrast', 'blur', 'hue', 'saturation', 
        'gamma', 'noise', 'color_jitter'
    }
    
    transformation_sequence = []
    transformation_config = {}
    geometric_transforms = []
    photometric_transforms = []
    
    # Process each transformation in sequence
    for idx, transform in enumerate(transformations):
        transform_type = transform.get("type")
        transform_params = transform.get("params", {})
        
        logger.debug("operations.transformations", f"Tracking transformation", "transformation_track_item", {
            'index': idx,
            'type': transform_type,
            'params': transform_params,
            'is_geometric': transform_type in geometric_transform_types,
            'geometric_types': list(geometric_transform_types),
            'transform_type_exact': repr(transform_type)
        })
        
        # Add to sequence (preserves order)
        transformation_sequence.append({
            "index": idx,
            "type": transform_type,
            "params": dict(transform_params),
            "is_geometric": transform_type in geometric_transform_types,
            "is_photometric": transform_type in photometric_transform_types
        })
        
        # Add to config format (for annotation_transformer.py compatibility)
        config_params = dict(transform_params)
        
        # 🎯 CRITICAL FIX: Ensure resize has both width and height
        if transform_type == "resize":
            if "width" not in config_params:
                config_params["width"] = final_dims[0]
            if "height" not in config_params:
                config_params["height"] = final_dims[1]
        
        transformation_config[transform_type] = {
            "enabled": True,
            **config_params
        }
        
        # Categorize transforms
        if transform_type in geometric_transform_types:
            geometric_transforms.append({
                "type": transform_type,
                "params": dict(transform_params),
                "index": idx
            })
        elif transform_type in photometric_transform_types:
            photometric_transforms.append({
                "type": transform_type,
                "params": dict(transform_params),
                "index": idx
            })
    
    # Add baseline resize transformation (ALL images get resized)
    # This is the critical insight from the user - even photometric images get geometric transformations
    if original_dims != final_dims:
        # 🚨 CRITICAL FIX: Find actual resize_mode from existing transformations
        actual_resize_mode = "stretch_to"  # Default fallback
        
        # Check if there's already a resize transformation with resize_mode
        for transform in transformations:
            if transform.get("type") == "resize":
                transform_params = transform.get("params", {})
                if "resize_mode" in transform_params:
                    actual_resize_mode = transform_params["resize_mode"]
                    logger.debug("operations.transformations", f"Found existing resize_mode", "existing_resize_mode_detected", {
                        'resize_mode': actual_resize_mode,
                        'transform_params': transform_params
                    })
                    break
        
        logger.debug("operations.transformations", f"Adding baseline resize transformation", "baseline_resize_detected", {
            'original_dims': original_dims,
            'final_dims': final_dims,
            'actual_resize_mode': actual_resize_mode,
            'reason': 'all_images_get_geometric_transformation'
        })
        
        # Add resize to beginning of geometric transforms (it happens first)
        baseline_resize = {
            "type": "resize",
            "params": {
                "width": final_dims[0],
                "height": final_dims[1],
                "resize_mode": actual_resize_mode  # 🎯 USE ACTUAL RESIZE_MODE!
            },
            "index": -1,  # Indicates baseline transformation
            "is_baseline": True
        }
        
        # 🎯 FIXED: Only add resize if not already present to avoid duplicates
        # 🚨 CRITICAL FIX: Insert at BEGINNING, not append to end!
        if not any(t["type"] == "resize" for t in geometric_transforms):
            geometric_transforms.insert(0, baseline_resize)  # INSERT AT BEGINNING!
        
        # 🎯 FIXED: Only add resize to config if not already present
        if "resize" not in transformation_config:
            baseline_resize_config = {
                "enabled": True,
                "width": final_dims[0],
                "height": final_dims[1],
                "resize_mode": actual_resize_mode  # 🎯 USE ACTUAL RESIZE_MODE!
            }
            transformation_config["resize"] = baseline_resize_config
            
            # 🔍 DEBUG: Show what resize config we're adding
            print(f"🎯 ADDING RESIZE CONFIG: {baseline_resize_config}")
        else:
            print(f"🎯 RESIZE CONFIG ALREADY EXISTS: {transformation_config['resize']}")
    
    # 🔍 DEBUG: Show annotation tracking order
    annotation_order = list(transformation_config.keys())
    geometric_order = [t["type"] for t in geometric_transforms]
    
    print(f"\n📍 ANNOTATION TRACKING ORDER: {annotation_order}")
    print(f"🔧 GEOMETRIC TRANSFORMS ORDER: {geometric_order}")
    print(f"🔍 TRANSFORMATION CONFIG DETAILS: {transformation_config}")
    
    tracking_data = {
        "transformation_sequence": transformation_sequence,
        "transformation_config": transformation_config,
        "original_dims": original_dims,
        "final_dims": final_dims,
        # 🔍 DEBUG: Add transformation order info for debug.json
        "debug_transformation_order": {
            "annotation_config_order": annotation_order,
            "geometric_transforms_order": geometric_order,
            "orders_match": annotation_order == geometric_order,
            "duplicate_resize_detected": len(geometric_order) != len(set(geometric_order))
        },
        "has_geometric_transforms": len(geometric_transforms) > 0,
        "geometric_transforms": geometric_transforms,
        "photometric_transforms": photometric_transforms,
        "total_transforms": len(transformations),
        "geometric_count": len(geometric_transforms),
        "photometric_count": len(photometric_transforms)
    }
    
    # Collect actual geometry parameters for crop, rotation, and affine_transform tools
    actual_geometry_params = {}
    if transformer and hasattr(transformer, 'get_actual_geometry_parameters'):
        try:
            actual_geometry_params = transformer.get_actual_geometry_parameters()
            print(f"\n🎯 COLLECTED ACTUAL GEOMETRY PARAMETERS:")
            for tool_name, params in actual_geometry_params.items():
                print(f"   {tool_name}: {params}")
        except Exception as e:
            print(f"\n⚠️ Failed to collect actual geometry parameters: {e}")
            actual_geometry_params = {}
    
    # Add actual geometry parameters to tracking data
    tracking_data["actual_geometry_params"] = actual_geometry_params
    
    # Add actual geometry parameters to transformation_config for annotation transformer
    if actual_geometry_params:
        for tool_name, actual_params in actual_geometry_params.items():
            # Handle rotation tool name mismatch: ImageTransformer uses 'rotation', config uses 'rotate'
            config_tool_name = tool_name
            if tool_name == 'rotation' and 'rotate' in transformation_config:
                config_tool_name = 'rotate'
                print(f"🔄 Mapping rotation tool: '{tool_name}' -> '{config_tool_name}'")
            
            if config_tool_name in transformation_config:
                # Add actual parameters to the existing config
                transformation_config[config_tool_name]["actual_params"] = actual_params
                print(f"🎯 Added actual params for {config_tool_name}: {actual_params}")
            else:
                print(f"⚠️ Tool {tool_name} not found in transformation_config")
    
    # 🚨 DEBUG: Log OUTPUT from tracking function
    print(f"\n🎯 TRACKING FUNCTION OUTPUT:")
    print(f"   transformation_config: {transformation_config}")
    print(f"   Has geometric transforms: {tracking_data['has_geometric_transforms']}")
    print(f"   Geometric transforms: {geometric_transforms}")
    print(f"   Actual geometry params: {actual_geometry_params}")
    
    logger.debug("operations.transformations", f"Transformation tracking completed", "transformation_tracking_complete", {
        'total_transforms': tracking_data["total_transforms"],
        'geometric_count': tracking_data["geometric_count"],
        'photometric_count': tracking_data["photometric_count"],
        'has_geometric_transforms': tracking_data["has_geometric_transforms"],
        'baseline_resize_added': original_dims != final_dims,
        'geometric_transforms': geometric_transforms,
        'photometric_transforms': photometric_transforms,
        'all_transform_types': [t.get("type") for t in transformations]
    })
    
    return tracking_data


def apply_transformations_to_annotations(annotations: List, tracking_data: dict) -> List:
    """
    Apply the same transformations to annotations that were applied to images.
    
    Uses the enhanced annotation_transformer.py with complete geometric transformation support.
    
    Args:
        annotations: List of annotation objects (BoundingBox/Polygon from DB)
        tracking_data: Output from track_transformations_for_annotations()
        
    Returns:
        List of transformed annotations (invalid ones are dropped)
    """

    print(f"\n🚀🚀🚀 NEW VERSION LOADED - FUNCTION CALLED! 🚀🚀🚀")
    print(f"   annotations count: {len(annotations)}")
    print(f"   tracking_data keys: {list(tracking_data.keys()) if tracking_data else 'None'}")
    print(f"🔥 IMMEDIATE CHECK: has_geometric_transforms = {tracking_data.get('has_geometric_transforms', 'KEY_NOT_FOUND')}")
    
    logger.debug("operations.transformations", f"Starting annotation transformation", "annotation_transformation_start", {
            'annotation_count': len(annotations),
            'has_geometric_transforms': tracking_data.get("has_geometric_transforms", False),
            'geometric_count': tracking_data.get("geometric_count", 0),
            'original_dims': tracking_data.get("original_dims"),
            'final_dims': tracking_data.get("final_dims")
        })
        
    print(f"🔧 SKIPPING debug_logger.start_annotation_transformation (method doesn't exist)")
    # 🎯 DEBUGGER: Start annotation transformation tracking (REMOVED - method doesn't exist)

    if not annotations:
        print(f"❌ NO ANNOTATIONS TO TRANSFORM - returning empty list")
        logger.debug("operations.transformations", f"No annotations to transform", "annotation_transformation_empty", {})
        return []
    
    print(f"🔍 CHECKING has_geometric_transforms:")
    print(f"   tracking_data.get('has_geometric_transforms'): {tracking_data.get('has_geometric_transforms')}")
    print(f"   tracking_data.get('has_geometric_transforms', False): {tracking_data.get('has_geometric_transforms', False)}")
    print(f"   not tracking_data.get('has_geometric_transforms', False): {not tracking_data.get('has_geometric_transforms', False)}")
    
    if not tracking_data.get("has_geometric_transforms", False):
        print(f"❌ NO GEOMETRIC TRANSFORMS - returning original annotations")
        logger.debug("operations.transformations", f"No geometric transformations, returning original annotations", "annotation_transformation_no_geometric", {
            'photometric_count': tracking_data.get("photometric_count", 0)
        })
        return annotations
    
    print(f"✅ HAS GEOMETRIC TRANSFORMS - proceeding with transformation")
    
    try:
        print(f"🔧 ABOUT TO IMPORT annotation_transformer...")
        # Import the enhanced annotation transformer
        from backend.core.annotation_transformer import update_annotations_for_transformations, BoundingBox, Polygon
        print(f"✅ IMPORT SUCCESSFUL!")
        
        # Convert DB annotations to BoundingBox/Polygon objects if needed
        # Use same conversion logic as create_yolo_label_content()
        converted_annotations = []
        for ann in annotations:
            if hasattr(ann, 'points') or (hasattr(ann, 'x_min') and hasattr(ann, 'class_name') and not hasattr(ann, 'image_id')):  # Already a BoundingBox/Polygon object
                converted_annotations.append(ann)
            else:
                # Convert from DB annotation format (using actual DB fields)
                
                # Handle bounding box annotations (DB has x_min, y_min, x_max, y_max fields)
                if hasattr(ann, 'x_min') and ann.x_min is not None:
                    # DB coordinates are ALREADY in pixels (like 200.5, 100.6666)
                    # NO conversion needed - use directly!
                    bbox = BoundingBox(
                        x_min=float(ann.x_min),
                        y_min=float(ann.y_min),
                        x_max=float(ann.x_max),
                        y_max=float(ann.y_max),
                        class_name=getattr(ann, 'class_name', 'unknown'),
                        class_id=int(getattr(ann, 'class_id', 0))
                    )
                    converted_annotations.append(bbox)
                    logger.debug("operations.transformations", f"Converted DB bbox to BoundingBox object", "bbox_conversion_success", {
                        'pixel_coords': f"({ann.x_min}, {ann.y_min}, {ann.x_max}, {ann.y_max})",
                        'note': 'DB coordinates already in pixels - no conversion needed'
                    })
                
                # Handle polygon/segmentation annotations (DB has segmentation JSON field)
                seg_data = getattr(ann, 'segmentation', None)
                if seg_data:
                    # Parse JSON string if needed
                    if isinstance(seg_data, str):
                        try:
                            seg_data = json.loads(seg_data)
                        except:
                            continue
                    
                    # Extract points from segmentation data (same logic as create_yolo_label_content)
                    points = []
                    if isinstance(seg_data, list) and len(seg_data) > 0:
                        # 1) list of {x,y}
                        if isinstance(seg_data[0], dict) and 'x' in seg_data[0] and 'y' in seg_data[0]:
                            points = [(float(p['x']), float(p['y'])) for p in seg_data]
                        # 2) [[x1,y1,x2,y2,...]]
                        elif isinstance(seg_data[0], list):
                            flat = seg_data[0]
                            for i in range(0, len(flat) - 1, 2):
                                points.append((float(flat[i]), float(flat[i + 1])))
                        # 3) [x1,y1,x2,y2,...]
                        elif isinstance(seg_data[0], (int, float)):
                            for i in range(0, len(seg_data) - 1, 2):
                                points.append((float(seg_data[i]), float(seg_data[i + 1])))
                    
                    # DB segmentation coordinates are ALREADY in pixels (like 200.5, 100.6666)
                    # NO conversion needed - use directly!
                    if points:
                        polygon = Polygon(
                            points=points,
                            class_name=getattr(ann, 'class_name', 'unknown'),
                            class_id=int(getattr(ann, 'class_id', 0))
                        )
                        converted_annotations.append(polygon)
                        logger.debug("operations.transformations", f"Converted DB segmentation to Polygon object", "polygon_conversion_success", {
                            'point_count': len(points),
                            'first_point': points[0] if points else None,
                            'note': 'DB coordinates already in pixels - no conversion needed'
                        })
        
        logger.debug("operations.transformations", f"Converted annotations for transformation", "annotation_conversion_complete", {
            'original_count': len(annotations),
            'converted_count': len(converted_annotations),
            'bbox_count': sum(1 for a in converted_annotations if isinstance(a, BoundingBox)),
            'polygon_count': sum(1 for a in converted_annotations if isinstance(a, Polygon))
        })
        
        if not converted_annotations:
            logger.warning("errors.validation", f"No valid annotations to transform", "annotation_transformation_no_valid", {
                'original_count': len(annotations)
            })
            return []
        
        # Initialize debug tracking for this image
        debug_tracking = {
            'image_name': tracking_data.get('image_name', 'unknown'),
            'original_dimensions': tracking_data.get('original_dims', [640, 480]),
            'final_dimensions': tracking_data.get('final_dims', [640, 480]),
            'transformation_config': tracking_data.get('transformation_config', {}),
            'annotation_transformations': []
        }
        
        # Record original coordinates for debug tracking
        for ann_idx, ann in enumerate(converted_annotations):
            ann_debug = {
                'annotation_id': ann_idx,
                'class_name': getattr(ann, 'class_name', 'unknown'),
                'class_id': getattr(ann, 'class_id', 0),
                'original_coordinates': None,
                'final_coordinates': None
            }
            
            # Record original coordinates
            if hasattr(ann, 'x_min'):  # BoundingBox
                ann_debug['original_coordinates'] = {
                    'type': 'bbox',
                    'x_min': float(ann.x_min),
                    'y_min': float(ann.y_min), 
                    'x_max': float(ann.x_max),
                    'y_max': float(ann.y_max)
                }
                
                # 🎯 DEBUGGER: Record original bbox annotation (REMOVED - method doesn't exist)
                
            elif hasattr(ann, 'points'):  # Polygon
                ann_debug['original_coordinates'] = {
                    'type': 'polygon',
                    'points': [(float(x), float(y)) for x, y in ann.points]
                }
                
                # 🎯 DEBUGGER: Record original polygon annotation (REMOVED - method doesn't exist)
            
            debug_tracking['annotation_transformations'].append(ann_debug)
        
        # 🚨 DEBUG: Log INPUT to annotation transformer
        print(f"\n🎯 ANNOTATION TRANSFORMER INPUT:")
        print(f"   transformation_config: {tracking_data['transformation_config']}")
        print(f"   original_dims: {tracking_data['original_dims']}")
        print(f"   new_dims: {tracking_data['final_dims']}")
        print(f"   annotation_count: {len(converted_annotations)}")
        
        # 🎯 DEBUGGER: Log transformation configuration (REMOVED - method doesn't exist)
        
        # Apply transformations using enhanced annotation_transformer.py WITH DEBUG TRACKING
        print(f"\n🔧 ABOUT TO CALL update_annotations_for_transformations:")
        print(f"   annotations count: {len(converted_annotations)}")
        print(f"   transformation_config: {tracking_data['transformation_config']}")
        print(f"   original_dims: {tracking_data['original_dims']}")
        print(f"   new_dims: {tracking_data['final_dims']}")
        print(f"   affine_matrix: None")
        print(f"   debug_tracking: False")
        
        # Call transformation function - returns only annotations when debug_tracking=False
        transformed_annotations = update_annotations_for_transformations(
            annotations=converted_annotations,
            transformation_config=tracking_data["transformation_config"],
            original_dims=tracking_data["original_dims"],
            new_dims=tracking_data["final_dims"],
            affine_matrix=None,  # Use legacy sequential path for now
            debug_tracking=False  # Disable debug tracking to use working path
        )
        transformer_debug = None  # No debug info when debug_tracking=False
        
        print(f"🔧 update_annotations_for_transformations RETURNED:")
        print(f"   transformed_annotations count: {len(transformed_annotations)}")
        print(f"   transformer_debug keys: {list(transformer_debug.keys()) if transformer_debug else 'None'}")
        
        # 🔍 DEBUG: Print transformation results
        print(f"\n=== ANNOTATION TRANSFORMATION RESULTS ===")
        print(f"Original annotations: {len(converted_annotations)}")
        print(f"Transformed annotations: {len(transformed_annotations)}")
        print(f"Original dims: {tracking_data['original_dims']}")
        print(f"Final dims: {tracking_data['final_dims']}")
        print(f"Transformation config: {list(tracking_data['transformation_config'].keys())}")
        
        # Show resize mode specifically
        resize_config = tracking_data['transformation_config'].get('resize', {})
        if resize_config.get('enabled', False):
            resize_mode = resize_config.get('resize_mode', 'stretch_to')
            target_w = resize_config.get('width', 640)
            target_h = resize_config.get('height', 640)
            print(f"Resize mode: {resize_mode} -> {target_w}x{target_h}")
        
        if transformer_debug and transformer_debug.get('actual_final_canvas_dims'):
            print(f"Actual final canvas: {transformer_debug['actual_final_canvas_dims']}")
        
        # Integrate transformer debug data with our debug tracking
        debug_tracking['transformer_debug'] = transformer_debug
        
        # Record final coordinates and merge with transformer debug data
        for ann_idx, ann in enumerate(transformed_annotations):
            if ann_idx < len(debug_tracking['annotation_transformations']):
                ann_debug = debug_tracking['annotation_transformations'][ann_idx]
                
                # Add transformer step-by-step debug data if available
                if transformer_debug and ann_idx < len(transformer_debug.get('annotation_steps', [])):
                    transformer_ann_debug = transformer_debug['annotation_steps'][ann_idx]
                    ann_debug['transformation_steps'] = transformer_ann_debug.get('transformation_steps', [])
                    ann_debug['transformation_method'] = transformer_ann_debug.get('transformation_method', 'sequential')
                
                # Record final coordinates
                if hasattr(ann, 'x_min'):  # BoundingBox
                    ann_debug['final_coordinates'] = {
                        'type': 'bbox',
                        'x_min': float(ann.x_min),
                        'y_min': float(ann.y_min),
                        'x_max': float(ann.x_max),
                        'y_max': float(ann.y_max)
                    }
                    
                    # 🎯 DEBUGGER: Record transformed bbox annotation (REMOVED - method doesn't exist)
                    
                    # Calculate coordinate changes
                    if ann_debug['original_coordinates'] and ann_debug['original_coordinates']['type'] == 'bbox':
                        orig = ann_debug['original_coordinates']
                        final = ann_debug['final_coordinates']
                        ann_debug['coordinate_changes'] = {
                            'x_min_change': final['x_min'] - orig['x_min'],
                            'y_min_change': final['y_min'] - orig['y_min'],
                            'x_max_change': final['x_max'] - orig['x_max'],
                            'y_max_change': final['y_max'] - orig['y_max'],
                            'center_x_change': ((final['x_min'] + final['x_max'])/2) - ((orig['x_min'] + orig['x_max'])/2),
                            'center_y_change': ((final['y_min'] + final['y_max'])/2) - ((orig['y_min'] + orig['y_max'])/2),
                            'width_change': (final['x_max'] - final['x_min']) - (orig['x_max'] - orig['x_min']),
                            'height_change': (final['y_max'] - final['y_min']) - (orig['y_max'] - orig['y_min'])
                        }
                        
                        # 🎯 DEBUGGER: Record coordinate changes for bbox (REMOVED - method doesn't exist)
                        
                elif hasattr(ann, 'points'):  # Polygon
                    ann_debug['final_coordinates'] = {
                        'type': 'polygon',
                        'points': [(float(x), float(y)) for x, y in ann.points]
                    }
                    
                    # 🎯 DEBUGGER: Record transformed polygon annotation (REMOVED - method doesn't exist)
                    
                    # Calculate coordinate changes for polygons
                    if ann_debug['original_coordinates'] and ann_debug['original_coordinates']['type'] == 'polygon':
                        orig_points = ann_debug['original_coordinates']['points']
                        final_points = ann_debug['final_coordinates']['points']
                        
                        if len(orig_points) == len(final_points):
                            point_changes = []
                            for i, (orig_pt, final_pt) in enumerate(zip(orig_points, final_points)):
                                point_changes.append({
                                    'point_index': i,
                                    'x_change': final_pt[0] - orig_pt[0],
                                    'y_change': final_pt[1] - orig_pt[1]
                                })
                            ann_debug['coordinate_changes'] = {
                                'point_changes': point_changes,
                                'total_points': len(point_changes)
                            }
                            
                            # 🎯 DEBUGGER: Record coordinate changes for polygon (REMOVED - method doesn't exist)
        
        # Store debug tracking data for later saving
        tracking_data['debug_info'] = debug_tracking
        
        logger.debug("operations.transformations", f"Annotation transformation completed", "annotation_transformation_complete", {
            'input_count': len(converted_annotations),
            'output_count': len(transformed_annotations),
            'dropped_count': len(converted_annotations) - len(transformed_annotations),
            'transformation_config': list(tracking_data["transformation_config"].keys())
        })
        
        # 🎯 DEBUGGER: Complete annotation transformation tracking (REMOVED - method doesn't exist)
        
        return transformed_annotations
        
    except Exception as e:
        print(f"\n🚨 EXCEPTION IN apply_transformations_to_annotations!")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")
        print(f"   Annotation count: {len(annotations)}")
        print(f"   Tracking data keys: {list(tracking_data.keys()) if tracking_data else []}")
        import traceback
        print(f"   Full traceback:")
        traceback.print_exc()
        print(f"🚨 RETURNING ORIGINAL ANNOTATIONS AS FALLBACK")
        
        logger.error("errors.system", f"Failed to transform annotations", "annotation_transformation_error", {
            'annotation_count': len(annotations),
            'tracking_data_keys': list(tracking_data.keys()) if tracking_data else [],
            'error': str(e),
            'error_type': type(e).__name__
        })
        # Return original annotations as fallback
        return annotations


def save_debug_tracking_json(debug_info: dict, metadata_dir: str, image_name: str) -> str:
    """
    Save debug tracking information to JSON file in metadata folder.
    
    Args:
        debug_info: Debug tracking data from transformation process
        metadata_dir: Path to metadata directory
        image_name: Name of the image (for filename)
        
    Returns:
        Path to saved debug file
    """
    try:
        # Create debug filename
        base_name = os.path.splitext(image_name)[0]
        debug_filename = f"{base_name}_debug_tracking.json"
        debug_path = os.path.join(metadata_dir, debug_filename)
        
        # Add timestamp and summary info
        debug_data = {
            'timestamp': datetime.now().isoformat(),
            'image_name': image_name,
            'summary': {
                'total_annotations': len(debug_info.get('annotation_transformations', [])),
                'transformations_applied': list(debug_info.get('transformation_config', {}).keys()),
                'dimension_change': f"{debug_info.get('original_dimensions', [])} → {debug_info.get('final_dimensions', [])}",
                'coordinate_changes_detected': sum(1 for ann in debug_info.get('annotation_transformations', []) if ann.get('coordinate_changes')),
                # 🔍 DEBUG: Add transformation order comparison to summary
                'transformation_order_debug': debug_info.get('debug_transformation_order', {})
            },
            'detailed_tracking': debug_info
        }
        
        # Save to JSON file
        with open(debug_path, 'w', encoding='utf-8') as f:
            json.dump(debug_data, f, indent=2, ensure_ascii=False)
        
        logger.info("operations.exports", f"Debug tracking JSON saved", "debug_json_saved", {
            'debug_file': debug_filename,
            'annotation_count': debug_data['summary']['total_annotations'],
            'transformations': debug_data['summary']['transformations_applied']
        })
        
        return debug_path
        
    except Exception as e:
        logger.error("errors.system", f"Failed to save debug tracking JSON", "debug_json_save_error", {
            'error': str(e),
            'image_name': image_name,
            'metadata_dir': metadata_dir
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
        elif tool_type == 'crop':
            crop_percentage = params.get('crop_percentage', params.get('percentage', 100))
            logger.debug("operations.operations", f"Processing crop transformation for file suffix", "crop_suffix_processing", {
                'crop_percentage': crop_percentage,
                'operation': 'file_suffix_generation'
            })
            suffix = f"crop{int(crop_percentage)}"
            parts.append(suffix)
            logger.debug("operations.operations", f"Crop suffix added to file naming", "crop_suffix_added", {
                'suffix': suffix,
                'crop_percentage': crop_percentage,
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