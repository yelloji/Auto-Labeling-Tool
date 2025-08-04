"""
Central Release Controller for Auto-Labeling Tool Release Pipeline
Orchestrates the complete release generation process
"""

import os
import json
import logging
import uuid
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Import our components
from schema import TransformationSchema, create_schema_from_database, generate_release_configurations
from image_generator import ImageAugmentationEngine, create_augmentation_engine, process_release_images
from database.database import get_db
from database.models import ImageTransformation, Release, Image, Dataset, Project
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

@dataclass
class ReleaseConfig:
    """Configuration for release generation"""
    release_name: str
    description: str
    project_id: int
    dataset_ids: List[str]
    export_format: str = "yolo"  # yolo, coco, pascal_voc
    task_type: str = "object_detection"  # object_detection, segmentation
    images_per_original: int = 4
    sampling_strategy: str = "intelligent"
    output_format: str = "jpg"
    include_original: bool = True

@dataclass
class ReleaseProgress:
    """Progress tracking for release generation"""
    release_id: str
    status: str  # pending, processing, completed, failed
    progress_percentage: float
    current_step: str
    total_images: int
    processed_images: int
    generated_images: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class ReleaseController:
    """
    Central controller for release generation pipeline
    Orchestrates schema generation, image processing, and export
    """
    
    def __init__(self, db_session: Optional[Session] = None):
        self.db = db_session or next(get_db())
        self.augmentation_engine = None
        self.release_progress: Dict[str, ReleaseProgress] = {}
        
    def create_release_record(self, config: ReleaseConfig) -> str:
        """Create a new release record in database"""
        try:
            release_id = str(uuid.uuid4())
            
            # Create release record
            release = Release(
                id=release_id,
                project_id=config.project_id,
                name=config.release_name,
                description=config.description,
                export_format=config.export_format,
                task_type=config.task_type,
                datasets_used=config.dataset_ids,
                config={
                    "images_per_original": config.images_per_original,
                    "sampling_strategy": config.sampling_strategy,
                    "output_format": config.output_format,
                    "include_original": config.include_original
                },
                created_at=datetime.utcnow()
            )
            
            self.db.add(release)
            self.db.commit()
            
            logger.info(f"Created release record: {release_id}")
            return release_id
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create release record: {str(e)}")
            raise
    
    def load_pending_transformations(self, release_version: str) -> List[Dict[str, Any]]:
        """Load pending transformations from database"""
        try:
            transformations = self.db.query(ImageTransformation).filter(
                ImageTransformation.release_version == release_version,
                ImageTransformation.status == "PENDING",
                ImageTransformation.is_enabled == True
            ).order_by(ImageTransformation.order_index).all()
            
            # Convert to dictionary format
            transformation_records = []
            for transform in transformations:
                record = {
                    "id": transform.id,
                    "transformation_type": transform.transformation_type,
                    "parameters": transform.parameters if isinstance(transform.parameters, dict) else json.loads(transform.parameters),
                    "is_enabled": transform.is_enabled,
                    "order_index": transform.order_index,
                    "release_version": transform.release_version
                }
                transformation_records.append(record)
            
            logger.info(f"Loaded {len(transformation_records)} pending transformations for version {release_version}")
            return transformation_records
            
        except Exception as e:
            logger.error(f"Failed to load pending transformations: {str(e)}")
            return []
    
    def get_dataset_images(self, dataset_ids: List[str]) -> List[Dict[str, Any]]:
        """Get all images from specified datasets"""
        try:
            images = self.db.query(Image).filter(
                Image.dataset_id.in_(dataset_ids),
                Image.split_type == "dataset"  # Only get images in dataset section
            ).all()
            
            image_records = []
            for image in images:
                record = {
                    "id": image.id,
                    "filename": image.filename,
                    "file_path": image.file_path,
                    "dataset_id": image.dataset_id,
                    "split_section": image.split_section or "train",
                    "width": image.width,
                    "height": image.height
                }
                image_records.append(record)
            
            logger.info(f"Found {len(image_records)} images in datasets: {dataset_ids}")
            return image_records
            
        except Exception as e:
            logger.error(f"Failed to get dataset images: {str(e)}")
            return []
    
    def update_release_progress(self, release_id: str, **kwargs) -> None:
        """Update release progress"""
        if release_id not in self.release_progress:
            self.release_progress[release_id] = ReleaseProgress(
                release_id=release_id,
                status="pending",
                progress_percentage=0.0,
                current_step="initializing",
                total_images=0,
                processed_images=0,
                generated_images=0
            )
        
        progress = self.release_progress[release_id]
        
        # Update provided fields
        for key, value in kwargs.items():
            if hasattr(progress, key):
                setattr(progress, key, value)
        
        # Calculate progress percentage
        if progress.total_images > 0:
            progress.progress_percentage = (progress.processed_images / progress.total_images) * 100
        
        logger.debug(f"Updated progress for release {release_id}: {progress.progress_percentage:.1f}%")
    
    def mark_transformations_completed(self, transformation_ids: List[str], release_id: str) -> None:
        """Mark transformations as completed and link to release"""
        try:
            transformations = self.db.query(ImageTransformation).filter(
                ImageTransformation.id.in_(transformation_ids)
            ).all()
            
            for transform in transformations:
                transform.status = "COMPLETED"
                transform.release_id = release_id
            
            self.db.commit()
            logger.info(f"Marked {len(transformations)} transformations as completed")
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to mark transformations as completed: {str(e)}")
    
    def generate_release(self, config: ReleaseConfig, release_version: str) -> str:
        """
        Generate a complete release with transformations and export
        
        Args:
            config: Release configuration
            release_version: Version identifier for transformations
            
        Returns:
            Release ID
        """
        release_id = None
        
        try:
            # Create release record
            release_id = self.create_release_record(config)
            
            # Initialize progress tracking
            self.update_release_progress(
                release_id,
                status="processing",
                current_step="loading_data",
                started_at=datetime.utcnow()
            )
            
            # Load pending transformations
            transformation_records = self.load_pending_transformations(release_version)
            if not transformation_records:
                raise ValueError(f"No pending transformations found for version {release_version}")
            
            # Get dataset images
            image_records = self.get_dataset_images(config.dataset_ids)
            if not image_records:
                raise ValueError(f"No images found in datasets: {config.dataset_ids}")
            
            # Update progress
            self.update_release_progress(
                release_id,
                total_images=len(image_records),
                current_step="generating_configurations"
            )
            
            # Generate transformation configurations
            image_ids = [img["id"] for img in image_records]
            transformation_configs = generate_release_configurations(
                transformation_records,
                image_ids,
                config.images_per_original
            )
            
            # Update progress
            self.update_release_progress(
                release_id,
                current_step="processing_images"
            )
            
            # Initialize augmentation engine
            output_dir = f"backend/releases/{release_id}"
            self.augmentation_engine = create_augmentation_engine(output_dir)
            
            # Prepare image paths and dataset splits
            image_paths = []
            dataset_splits = {}
            
            for img_record in image_records:
                # Convert relative path to absolute path
                image_path = self._resolve_image_path(img_record["file_path"])
                if os.path.exists(image_path):
                    image_paths.append(image_path)
                    dataset_splits[image_path] = img_record["split_section"]
                else:
                    logger.warning(f"Image not found: {image_path}")
            
            # Process all images
            all_results = process_release_images(
                image_paths=image_paths,
                transformation_configs=transformation_configs,
                dataset_splits=dataset_splits,
                output_dir=output_dir,
                output_format=config.output_format
            )
            
            # Count generated images
            total_generated = sum(len(results) for results in all_results.values())
            
            # Update progress
            self.update_release_progress(
                release_id,
                processed_images=len(image_paths),
                generated_images=total_generated,
                current_step="finalizing"
            )
            
            # Update release record with results
            release = self.db.query(Release).filter(Release.id == release_id).first()
            if release:
                release.total_original_images = len(image_paths)
                release.total_augmented_images = total_generated
                release.final_image_count = total_generated + (len(image_paths) if config.include_original else 0)
                release.model_path = output_dir
                self.db.commit()
            
            # Mark transformations as completed
            transformation_ids = [t["id"] for t in transformation_records]
            self.mark_transformations_completed(transformation_ids, release_id)
            
            # Update final progress
            self.update_release_progress(
                release_id,
                status="completed",
                progress_percentage=100.0,
                current_step="completed",
                completed_at=datetime.utcnow()
            )
            
            logger.info(f"Successfully generated release {release_id}")
            return release_id
            
        except Exception as e:
            error_msg = f"Failed to generate release: {str(e)}"
            logger.error(error_msg)
            
            if release_id:
                self.update_release_progress(
                    release_id,
                    status="failed",
                    error_message=error_msg,
                    completed_at=datetime.utcnow()
                )
            
            raise
    
    def _resolve_image_path(self, relative_path: str) -> str:
        """Resolve relative image path to absolute path"""
        # Handle different path formats
        if os.path.isabs(relative_path):
            return relative_path
        
        # Try different base paths
        base_paths = [
            ".",  # Current directory
            "projects",  # Projects directory
            "uploads",  # Uploads directory
        ]
        
        for base_path in base_paths:
            full_path = os.path.join(base_path, relative_path)
            if os.path.exists(full_path):
                return full_path
        
        # Return original path if not found
        return relative_path
    
    def get_release_progress(self, release_id: str) -> Optional[ReleaseProgress]:
        """Get current progress for a release"""
        return self.release_progress.get(release_id)
    
    def get_release_history(self, project_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get release history for a project"""
        try:
            releases = self.db.query(Release).filter(
                Release.project_id == project_id
            ).order_by(Release.created_at.desc()).limit(limit).all()
            
            history = []
            for release in releases:
                record = {
                    "id": release.id,
                    "name": release.name,
                    "description": release.description,
                    "export_format": release.export_format,
                    "task_type": release.task_type,
                    "total_original_images": release.total_original_images,
                    "total_augmented_images": release.total_augmented_images,
                    "final_image_count": release.final_image_count,
                    "created_at": release.created_at.isoformat() if release.created_at else None,
                    "model_path": release.model_path
                }
                history.append(record)
            
            return history
            
        except Exception as e:
            logger.error(f"Failed to get release history: {str(e)}")
            return []
    
    def cleanup_failed_release(self, release_id: str) -> None:
        """Clean up resources for a failed release"""
        try:
            # Remove output directory if it exists
            output_dir = Path(f"backend/releases/{release_id}")
            if output_dir.exists():
                import shutil
                shutil.rmtree(output_dir)
                logger.info(f"Cleaned up output directory for failed release: {release_id}")
            
            # Remove from progress tracking
            if release_id in self.release_progress:
                del self.release_progress[release_id]
            
        except Exception as e:
            logger.error(f"Failed to cleanup failed release {release_id}: {str(e)}")


# Utility functions for easy usage
def create_release_controller(db_session: Optional[Session] = None) -> ReleaseController:
    """Create and configure release controller"""
    return ReleaseController(db_session)


def quick_release_generation(project_id: int, dataset_ids: List[str], 
                           release_name: str, release_version: str,
                           images_per_original: int = 4) -> str:
    """
    Quick release generation with default settings
    
    Args:
        project_id: Project ID
        dataset_ids: List of dataset IDs
        release_name: Name for the release
        release_version: Version identifier for transformations
        images_per_original: Number of augmented images per original
        
    Returns:
        Release ID
    """
    controller = create_release_controller()
    
    config = ReleaseConfig(
        release_name=release_name,
        description=f"Auto-generated release with {images_per_original} images per original",
        project_id=project_id,
        dataset_ids=dataset_ids,
        images_per_original=images_per_original
    )
    
    return controller.generate_release(config, release_version)


if __name__ == "__main__":
    # Example usage and testing
    logging.basicConfig(level=logging.INFO)
    
    # Test release controller
    controller = create_release_controller()
    
    # Example configuration
    test_config = ReleaseConfig(
        release_name="Test Release v1",
        description="Test release for development",
        project_id=1,
        dataset_ids=["dataset_001"],
        images_per_original=3
    )
    
    print("Release Controller initialized successfully!")
    print(f"Test configuration: {test_config}")
    print("Ready for release generation!")
