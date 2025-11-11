"""
Database operations for the Auto-Labeling Tool
CRUD operations for all models
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import os
from pathlib import Path
import json

from .models import (
    Project, Dataset, Image, Annotation, 
    ModelUsage, AutoLabelJob,
    DatasetSplit, LabelAnalytics,
    AiModel
)
from core.config import settings
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()


class ProjectOperations:
    """CRUD operations for Project model"""
    
    @staticmethod
    def create_project(
        db: Session,
        name: str,
        description: str = "",
        project_type: str = "Object Detection",
        default_model_id: str = None,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45
    ) -> Project:
        """Create a new project"""
        logger.info("app.database", "Creating new project", "project_creation_start", {
            "project_name": name,
            "project_type": project_type,
            "description_length": len(description),
            "default_model_id": default_model_id,
            "confidence_threshold": confidence_threshold,
            "iou_threshold": iou_threshold
        })
        
        try:
            project = Project(
                name=name,
                description=description,
                project_type=project_type,
                default_model_id=default_model_id,
                confidence_threshold=confidence_threshold,
                iou_threshold=iou_threshold
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            
            logger.info("app.database", "Project created successfully", "project_creation_complete", {
                "project_id": project.id,
                "project_name": project.name
            })
            
            # Create project folder structure
            logger.info("app.database", "Creating project folder structure", "project_folders_creation", {
                "project_name": name,
                "folders": ["unassigned", "annotating", "dataset"]
            })
            
            project_dir = settings.PROJECTS_DIR / name
            for folder in ["unassigned", "annotating", "dataset"]:
                folder_path = project_dir / folder
                folder_path.mkdir(parents=True, exist_ok=True)
            
            logger.info("app.database", "Project folder structure created successfully", "project_folders_complete", {
                "project_dir": str(project_dir)
            })
            
            return project
            
        except Exception as e:
            logger.error("errors.system", f"Project creation failed: {str(e)}", "project_creation_error", {
                "project_name": name,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_project(db: Session, project_id: str) -> Optional[Project]:
        """Get project by ID"""
        logger.info("app.database", "Retrieving project by ID", "project_retrieval", {
            "project_id": project_id
        })
        
        project = db.query(Project).filter(Project.id == project_id).first()
        
        if project:
            logger.info("app.database", "Project retrieved successfully", "project_retrieved", {
                "project_id": project.id,
                "project_name": project.name
            })
        else:
            logger.warning("app.database", "Project not found", "project_not_found", {
                "project_id": project_id
            })
        
        return project
    
    @staticmethod
    def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
        """Get all projects with pagination"""
        logger.info("app.database", "Retrieving projects with pagination", "projects_retrieval", {
            "skip": skip,
            "limit": limit
        })
        
        projects = db.query(Project).offset(skip).limit(limit).all()
        
        logger.info("app.database", "Projects retrieved successfully", "projects_retrieved", {
            "projects_count": len(projects),
            "skip": skip,
            "limit": limit
        })
        
        return projects
    
    @staticmethod
    def update_project(db: Session, project_id: str, **kwargs) -> Optional[Project]:
        """Update project"""
        logger.info("app.database", "Updating project", "project_update_start", {
            "project_id": project_id,
            "update_fields": list(kwargs.keys())
        })
        
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            for key, value in kwargs.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            project.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(project)
            
            logger.info("app.database", "Project updated successfully", "project_update_complete", {
                "project_id": project.id,
                "project_name": project.name,
                "updated_fields": list(kwargs.keys())
            })
        else:
            logger.warning("app.database", "Project not found for update", "project_update_not_found", {
                "project_id": project_id
            })
        
        return project
    
    @staticmethod
    def delete_project(db: Session, project_id: str) -> bool:
        """Delete project and all related data"""
        logger.info("app.database", "Starting project deletion", "project_deletion_start", {
            "project_id": project_id
        })
        
        try:
            # First, explicitly delete all labels associated with this project
            from database.models import Label
            logger.info("app.database", "Deleting project labels", "project_labels_deletion", {
                "project_id": project_id
            })
            
            # Find all labels to delete (for logging)
            labels_to_delete = db.query(Label).filter(Label.project_id == project_id).all()
            logger.info("app.database", f"Found {len(labels_to_delete)} labels to delete", "labels_count", {
                "project_id": project_id,
                "labels_count": len(labels_to_delete)
            })
            
            # Delete the labels
            db.query(Label).filter(Label.project_id == project_id).delete(synchronize_session=False)
            
            # Then delete the project itself
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                logger.info("app.database", "Deleting project", "project_deletion", {
                    "project_id": project.id,
                    "project_name": project.name
                })
                
                db.delete(project)
                db.commit()
                
                logger.info("app.database", "Project deleted successfully", "project_deletion_complete", {
                    "project_id": project_id
                })
                return True
            else:
                logger.warning("app.database", "Project not found for deletion", "project_deletion_not_found", {
                    "project_id": project_id
                })
                return False
                
        except Exception as e:
            logger.error("errors.system", f"Project deletion failed: {str(e)}", "project_deletion_error", {
                "project_id": project_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise


class DatasetOperations:
    """CRUD operations for Dataset model"""
    
    @staticmethod
    def create_dataset(
        db: Session,
        name: str,
        project_id: str,
        description: str = "",
        auto_label_enabled: bool = True,
        model_id: str = None
    ) -> Dataset:
        """Create a new dataset"""
        logger.info("app.database", "Creating new dataset", "dataset_creation_start", {
            "dataset_name": name,
            "project_id": project_id,
            "description_length": len(description),
            "auto_label_enabled": auto_label_enabled,
            "model_id": model_id
        })
        
        try:
            dataset = Dataset(
                name=name,
                project_id=project_id,
                description=description,
                auto_label_enabled=auto_label_enabled,
                model_id=model_id
            )
            db.add(dataset)
            db.commit()
            db.refresh(dataset)
            
            logger.info("app.database", "Dataset created successfully", "dataset_creation_complete", {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name
            })
            return dataset
        except Exception as e:
            logger.error("errors.system", f"Dataset creation failed: {str(e)}", "dataset_creation_error", {
                "dataset_name": name,
                "project_id": project_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_dataset(db: Session, dataset_id: str) -> Optional[Dataset]:
        """Get dataset by ID"""
        logger.info("app.database", "Retrieving dataset by ID", "dataset_retrieval", {
            "dataset_id": dataset_id
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        
        if dataset:
            logger.info("app.database", "Dataset retrieved successfully", "dataset_retrieved", {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name
            })
        else:
            logger.warning("app.database", "Dataset not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
        
        return dataset
    
    @staticmethod
    def get_datasets_by_project(db: Session, project_id: str) -> List[Dataset]:
        """Get all datasets for a project"""
        logger.info("app.database", "Retrieving datasets by project ID", "datasets_retrieval_by_project", {
            "project_id": project_id
        })
        
        datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
        
        logger.info("app.database", "Datasets retrieved successfully", "datasets_retrieved_by_project", {
            "project_id": project_id,
            "datasets_count": len(datasets)
        })
        
        return datasets
    
    @staticmethod
    def get_all_datasets(db: Session, skip: int = 0, limit: int = 100) -> List[Dataset]:
        """Get all datasets with pagination"""
        logger.info("app.database", "Retrieving all datasets with pagination", "all_datasets_retrieval", {
            "skip": skip,
            "limit": limit
        })
        
        datasets = db.query(Dataset).offset(skip).limit(limit).all()
        
        logger.info("app.database", "All datasets retrieved successfully", "all_datasets_retrieved", {
            "datasets_count": len(datasets),
            "skip": skip,
            "limit": limit
        })
        
        return datasets
    
    @staticmethod
    def update_dataset_stats(db: Session, dataset_id: str):
        """Update dataset statistics"""
        logger.info("app.database", "Updating dataset statistics", "dataset_stats_update", {
            "dataset_id": dataset_id
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            total_images = db.query(func.count(Image.id)).filter(Image.dataset_id == dataset_id).scalar()
            labeled_images = db.query(func.count(Image.id)).filter(
                and_(Image.dataset_id == dataset_id, Image.is_labeled == True)
            ).scalar()
            
            dataset.total_images = total_images
            dataset.labeled_images = labeled_images
            dataset.unlabeled_images = total_images - labeled_images
            dataset.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(dataset)
            
            logger.info("app.database", "Dataset statistics updated successfully", "dataset_stats_update_complete", {
                "dataset_id": dataset.id,
                "total_images": total_images,
                "labeled_images": labeled_images,
                "unlabeled_images": dataset.unlabeled_images
            })
        else:
            logger.warning("app.database", "Dataset not found for stats update", "dataset_stats_update_not_found", {
                "dataset_id": dataset_id
            })
        return dataset
    
    @staticmethod
    def update_dataset(
        db: Session,
        dataset_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        auto_label_enabled: Optional[bool] = None,
        model_id: Optional[str] = None,
        labeled_images: Optional[int] = None,
        unlabeled_images: Optional[int] = None,
        total_images: Optional[int] = None
    ) -> Optional[Dataset]:
        """Update dataset"""
        logger.info("app.database", "Updating dataset", "dataset_update_start", {
            "dataset_id": dataset_id,
            "update_fields": [f for f in [name, description, auto_label_enabled, model_id, labeled_images, unlabeled_images, total_images] if f is not None]
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            if name is not None:
                dataset.name = name
            if description is not None:
                dataset.description = description
            if auto_label_enabled is not None:
                dataset.auto_label_enabled = auto_label_enabled
            if model_id is not None:
                dataset.model_id = model_id
            if labeled_images is not None:
                dataset.labeled_images = labeled_images
            if unlabeled_images is not None:
                dataset.unlabeled_images = unlabeled_images
            if total_images is not None:
                dataset.total_images = total_images
            
            dataset.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(dataset)
            
            logger.info("app.database", "Dataset updated successfully", "dataset_update_complete", {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "updated_fields": [f for f in [name, description, auto_label_enabled, model_id, labeled_images, unlabeled_images, total_images] if f is not None]
            })
        else:
            logger.warning("app.database", "Dataset not found for update", "dataset_update_not_found", {
                "dataset_id": dataset_id
            })
        return dataset
    
    @staticmethod
    def delete_dataset(db: Session, dataset_id: str) -> bool:
        """Delete dataset and all related data"""
        logger.info("app.database", "Starting dataset deletion", "dataset_deletion_start", {
            "dataset_id": dataset_id
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            db.delete(dataset)
            db.commit()
            logger.info("app.database", "Dataset deleted successfully", "dataset_deletion_complete", {
                "dataset_id": dataset_id
            })
            return True
        else:
            logger.warning("app.database", "Dataset not found for deletion", "dataset_deletion_not_found", {
                "dataset_id": dataset_id
            })
            return False
    
    @staticmethod
    def get_project_by_dataset(db: Session, dataset_id: str) -> Optional[Project]:
        """Get project that contains the given dataset"""
        logger.info("app.database", "Retrieving project by dataset ID", "project_retrieval_by_dataset", {
            "dataset_id": dataset_id
        })
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            project = db.query(Project).filter(Project.id == dataset.project_id).first()
            if project:
                logger.info("app.database", "Project retrieved by dataset", "project_retrieved_by_dataset", {
                    "dataset_id": dataset_id,
                    "project_id": project.id,
                    "project_name": project.name
                })
                return project
            else:
                logger.warning("app.database", "Project not found for dataset", "project_not_found_by_dataset", {
                    "dataset_id": dataset_id
                })
        else:
            logger.warning("app.database", "Dataset not found for project retrieval", "dataset_not_found_by_dataset", {
                "dataset_id": dataset_id
            })
        return None


class ImageOperations:
    """CRUD operations for Image model"""
    
    @staticmethod
    def create_image(
        db: Session,
        filename: str,
        original_filename: str,
        file_path: str,
        dataset_id: str,
        width: int = None,
        height: int = None,
        file_size: int = None,
        format: str = None,
        split_type: str = "unassigned",
        split_section: str = "train"
    ) -> Image:
        """Create a new image record"""
        logger.info("app.database", "Creating new image record", "image_creation_start", {
            "filename": filename,
            "original_filename": original_filename,
            "file_path": file_path,
            "dataset_id": dataset_id,
            "width": width,
            "height": height,
            "file_size": file_size,
            "format": format,
            "split_type": split_type,
            "split_section": split_section
        })
        
        try:
            image = Image(
                filename=filename,
                original_filename=original_filename,
                file_path=file_path,
                dataset_id=dataset_id,
                width=width,
                height=height,
                file_size=file_size,
                format=format,
                split_type=split_type,
                split_section=split_section
            )
            db.add(image)
            db.commit()
            db.refresh(image)
            
            logger.info("app.database", "Image created successfully", "image_creation_complete", {
                "image_id": image.id,
                "image_filename": image.filename
            })
            
            # Update dataset stats
            DatasetOperations.update_dataset_stats(db, dataset_id)
            return image
        except Exception as e:
            logger.error("errors.system", f"Image creation failed: {str(e)}", "image_creation_error", {
                "filename": filename,
                "dataset_id": dataset_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_image(db: Session, image_id: str) -> Optional[Image]:
        """Get image by ID"""
        logger.info("app.database", "Retrieving image by ID", "image_retrieval", {
            "image_id": image_id
        })
        
        image = db.query(Image).filter(Image.id == image_id).first()
        
        if image:
            logger.info("app.database", "Image retrieved successfully", "image_retrieved", {
                "image_id": image.id,
                "image_filename": image.filename
            })
        else:
            logger.warning("app.database", "Image not found", "image_not_found", {
                "image_id": image_id
            })
        
        return image
    
    @staticmethod
    def get_images_by_dataset(
        db: Session, 
        dataset_id: str, 
        skip: int = 0, 
        limit: int = 100,
        labeled_only: bool = None
    ) -> List[Image]:
        """Get images for a dataset with optional filtering"""
        logger.info("app.database", "Retrieving images by dataset ID with optional filtering", "images_retrieval_by_dataset", {
            "dataset_id": dataset_id,
            "skip": skip,
            "limit": limit,
            "labeled_only": labeled_only
        })
        
        query = db.query(Image).filter(Image.dataset_id == dataset_id)
        
        if labeled_only is not None:
            query = query.filter(Image.is_labeled == labeled_only)
        
        images = query.offset(skip).limit(limit).all()
        
        logger.info("app.database", "Images retrieved successfully", "images_retrieved_by_dataset", {
            "dataset_id": dataset_id,
            "images_count": len(images),
            "skip": skip,
            "limit": limit,
            "labeled_only": labeled_only
        })
        
        return images
    
    @staticmethod
    def update_image_status(
        db: Session, 
        image_id: str, 
        is_labeled: bool = None,
        is_auto_labeled: bool = None,
        is_verified: bool = None
    ) -> Optional[Image]:
        """Update image labeling status"""
        logger.info("app.database", "Updating image labeling status", "image_status_update", {
            "image_id": image_id,
            "update_fields": [f for f in [is_labeled, is_auto_labeled, is_verified] if f is not None]
        })
        
        image = db.query(Image).filter(Image.id == image_id).first()
        if image:
            if is_labeled is not None:
                image.is_labeled = is_labeled
            if is_auto_labeled is not None:
                image.is_auto_labeled = is_auto_labeled
            if is_verified is not None:
                image.is_verified = is_verified
            
            image.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(image)
            
            logger.info("app.database", "Image status updated successfully", "image_status_update_complete", {
                "image_id": image.id,
                "image_filename": image.filename,
                "updated_fields": [f for f in [is_labeled, is_auto_labeled, is_verified] if f is not None]
            })
            
            # Update dataset stats
            DatasetOperations.update_dataset_stats(db, image.dataset_id)
        else:
            logger.warning("app.database", "Image not found for status update", "image_status_update_not_found", {
                "image_id": image_id
            })
        return image
    

    @staticmethod
    def update_image_split_section(db: Session, image_id: str, split_section: str) -> bool:
        """Update image train/val/test split section and move the file."""
        logger.info("app.database", "Updating image train/val/test split section", "image_split_section_update", {
            "image_id": image_id,
            "split_section": split_section
        })
        
        try:
            image = db.query(Image).filter(Image.id == image_id).first()
            if not image:
                logger.warning("app.database", "Image not found for split section update", "image_split_section_update_not_found", {
                    "image_id": image_id
                })
                return False

            # 1) Update the split_section field
            image.split_section = split_section
            image.updated_at = datetime.utcnow()
            """
            2) Move the file on disk
            from utils.path_utils import path_manager
            import shutil

            dataset = DatasetOperations.get_dataset(db, image.dataset_id)
            project = ProjectOperations.get_project_by_dataset(db, image.dataset_id)

            if dataset and project:
                expected_rel = (
                    f"projects/{project.name}/dataset/{dataset.name}/"
                    f"{split_section}/{image.filename}"
                )
                current_abs = path_manager.get_absolute_path(image.file_path)
                new_abs     = path_manager.get_absolute_path(expected_rel)
                # Ensure target dir
                path_manager.ensure_directory_exists(new_abs.parent)
                # Move the one tracked file
                if current_abs.exists():
                    shutil.move(str(current_abs), str(new_abs))
                    
                # 3) Clean up any stray copy in the dataset root
                stray_rel = f"projects/{project.name}/dataset/{dataset.name}/{image.filename}"
                stray_abs = path_manager.get_absolute_path(stray_rel)
                if stray_abs.exists() and stray_abs != new_abs:
                    stray_abs.unlink()  # delete it
                image.file_path = expected_rel s
            """
            db.commit()
            logger.info("app.database", "Image split section updated successfully", "image_split_section_update_complete", {
                "image_id": image.id,
                "image_filename": image.filename,
                "split_section": split_section
            })
            return True

        except Exception as e:
            logger.error("errors.system", f"Error in update_image_split_section: {str(e)}", "image_split_section_error", {
                "image_id": image_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            db.rollback()
            return False


    @staticmethod
    def update_image_split(db: Session, image_id: str, split_type: str) -> bool:
        """Update image workflow split assignment with automatic file movement and path updates"""
        from utils.path_utils import path_manager
        import shutil
        logger.info("app.database", "Updating image workflow split assignment", "image_workflow_split_update", {
            "image_id": image_id,
            "split_type": split_type
        })
        
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            logger.warning("app.database", "Image not found for workflow split update", "image_workflow_split_update_not_found", {
                "image_id": image_id
            })
            return False
        
        # Get dataset and project information
        dataset = DatasetOperations.get_dataset(db, image.dataset_id)
        if not dataset:
            logger.warning("app.database", "Dataset not found for workflow split update", "dataset_not_found_for_workflow_split", {
                "image_id": image_id
            })
            return False
            
        project = DatasetOperations.get_project_by_dataset(db, image.dataset_id)
        if not project:
            logger.warning("app.database", "Project not found for workflow split update", "project_not_found_for_workflow_split", {
                "image_id": image_id
            })
            return False
        
        # Skip if already in the correct split
        if image.split_type == split_type:
            logger.info("app.database", "Image already in correct workflow split, skipping update", "image_workflow_split_already_correct", {
                "image_id": image_id,
                "current_split": image.split_type,
                "target_split": split_type
            })
            return True
        
        try:
            # Get current file path (absolute)
            current_absolute_path = path_manager.get_absolute_path(image.file_path)
            
            # Generate new path for the target split
            new_relative_path = path_manager.get_relative_image_path(
                project.name, dataset.name, image.filename, split_type
            )
            new_absolute_path = path_manager.get_absolute_path(new_relative_path)
            
            # Ensure target directory exists
            path_manager.ensure_directory_exists(new_absolute_path.parent)
            
            # Move the physical file if it exists
            if current_absolute_path.exists():
                # Move file to new location
                shutil.move(str(current_absolute_path), str(new_absolute_path))
                logger.info("app.database", f"Moved file from {current_absolute_path} to {new_absolute_path}", "file_moved_workflow_split", {
                    "source_path": str(current_absolute_path),
                    "target_path": str(new_absolute_path)
                })
            else:
                logger.warning("app.database", f"Warning: Source file not found at {current_absolute_path}", "source_file_not_found_workflow_split", {
                    "source_path": str(current_absolute_path)
                })
            
            # Update database record - IMPORTANT: preserve split_section when changing split_type
            current_split_section = None
            if hasattr(image, "split_section"):
                current_split_section = image.split_section
                
            image.split_type = split_type
            image.file_path = new_relative_path
            
            # Restore split_section if it existed (crucial fix!)
            if current_split_section and hasattr(image, "split_section"):
                image.split_section = current_split_section
                
            image.updated_at = datetime.utcnow()
            db.commit()
            
            logger.info("app.database", f"Updated image {image_id} split to {split_type} with path {new_relative_path}", "image_workflow_split_update_complete", {
                "image_id": image_id,
                "split_type": split_type,
                "new_path": new_relative_path
            })
            return True
            
        except Exception as e:
            logger.error("errors.system", f"Error updating image split for {image_id}: {str(e)}", "image_workflow_split_error", {
                "image_id": image_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            db.rollback()
            return False
    
    @staticmethod
    def get_annotations_by_images(db: Session, image_ids: List[str]) -> List[Annotation]:
        """Get annotations for multiple images"""
        logger.info("app.database", "Retrieving annotations by image IDs", "annotations_retrieval_by_images", {
            "image_ids": image_ids
        })
        
        annotations = db.query(Annotation).filter(Annotation.image_id.in_(image_ids)).all()
        
        logger.info("app.database", "Annotations retrieved successfully", "annotations_retrieved_by_images", {
            "image_ids": image_ids,
            "annotations_count": len(annotations)
        })
        
        return annotations
    
    @staticmethod
    def get_annotations_by_dataset(db: Session, dataset_id: str) -> List[Annotation]:
        """Get all annotations for a dataset"""
        logger.info("app.database", "Retrieving all annotations by dataset ID", "annotations_retrieval_by_dataset", {
            "dataset_id": dataset_id
        })
        
        annotations = db.query(Annotation).join(Image).filter(Image.dataset_id == dataset_id).all()
        
        logger.info("app.database", "Annotations retrieved successfully", "annotations_retrieved_by_dataset", {
            "dataset_id": dataset_id,
            "annotations_count": len(annotations)
        })
        
        return annotations
    
    @staticmethod
    def delete_image(db: Session, image_id: str) -> bool:
        """Delete image, its annotations, and the file from disk."""
        logger.info("app.database", "Deleting image", "image_deletion_start", {
            "image_id": image_id
        })
        try:
            image = db.query(Image).filter(Image.id == image_id).first()
            if not image:
                logger.warning("app.database", "Image not found for deletion", "image_deletion_not_found", {
                    "image_id": image_id
                })
                return False

            # Store dataset_id before deleting the image
            dataset_id = image.dataset_id

            # Delete all annotations for this image
            annotation_count = db.query(Annotation).filter(Annotation.image_id == image_id).delete(synchronize_session=False)
            logger.info("app.database", f"Deleted {annotation_count} annotations for image", "annotations_deleted_for_image", {
                "image_id": image_id,
                "annotations_deleted": annotation_count
            })

            # Delete the image file from disk
            from utils.path_utils import path_manager
            file_path = image.file_path
            abs_path = path_manager.get_absolute_path(file_path)
            if abs_path.exists():
                abs_path.unlink()
                logger.info("app.database", f"Deleted image file from disk: {abs_path}", "image_file_deleted", {
                    "image_id": image_id,
                    "file_path": str(abs_path)
                })
            else:
                logger.warning("app.database", f"Image file not found on disk: {abs_path}", "image_file_not_found_on_disk", {
                    "image_id": image_id,
                    "file_path": str(abs_path)
                })

            # Delete the image record
            db.delete(image)
            db.commit()
            
            # Update dataset statistics after successful deletion
            DatasetOperations.update_dataset_stats(db, dataset_id)
            
            # Check if dataset folder is empty and remove it if so
            try:
                dataset = DatasetOperations.get_dataset(db, dataset_id)
                if dataset:
                    # Get remaining images count for this dataset
                    remaining_images = db.query(Image).filter(Image.dataset_id == dataset_id).count()
                    
                    if remaining_images == 0:
                        # No images left, remove empty dataset folder
                        from database.operations import ProjectOperations
                        project = ProjectOperations.get_project(db, str(dataset.project_id))
                        
                        if project:
                            from pathlib import Path
                            import os
                            from core.config import settings
                            
                            # Check all possible workflow locations for the dataset folder
                            project_folder = Path(settings.PROJECTS_DIR) / project.name
                            possible_locations = ["unassigned", "annotating", "dataset"]
                            
                            for location in possible_locations:
                                dataset_folder_path = project_folder / location / dataset.name
                                if dataset_folder_path.exists():
                                    # Check if folder is empty or only contains empty subdirectories
                                    is_empty = True
                                    for root, dirs, files in os.walk(dataset_folder_path):
                                        if files:  # Found files, not empty
                                            is_empty = False
                                            break
                                    
                                    if is_empty:
                                        import shutil
                                        shutil.rmtree(str(dataset_folder_path))
                                        logger.info("operations.operations", f"Removed empty dataset folder: {dataset_folder_path}", "empty_folder_cleanup", {
                                            "dataset_id": dataset_id,
                                            "dataset_name": dataset.name,
                                            "project_name": project.name,
                                            "location": location,
                                            "folder_path": str(dataset_folder_path)
                                        })
                                    break
            except Exception as cleanup_error:
                logger.warning("errors.system", f"Failed to cleanup empty dataset folder: {cleanup_error}", "folder_cleanup_failed", {
                    "dataset_id": dataset_id,
                    "error": str(cleanup_error)
                })
                # Don't fail the entire operation if folder cleanup fails
            
            logger.info("app.database", "Image deleted successfully", "image_deletion_complete", {
                "image_id": image_id
            })
            return True
        except Exception as e:
            logger.error("errors.system", f"Error deleting image: {str(e)}", "image_deletion_error", {
                "image_id": image_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            db.rollback()
            return False

    @staticmethod
    def update_image_path(db: Session, image_id: str, new_path: str) -> Optional[Image]:
        """Update image file path"""
        logger.info("app.database", "Updating image file path", "image_path_update", {
            "image_id": image_id,
            "new_path": new_path
        })
        
        image = db.query(Image).filter(Image.id == image_id).first()
        if image:
            image.file_path = new_path
            image.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(image)
            
            logger.info("app.database", "Image path updated successfully", "image_path_update_complete", {
                "image_id": image.id,
                "image_filename": image.filename
            })
        else:
            logger.warning("app.database", "Image not found for path update", "image_path_update_not_found", {
                "image_id": image_id
            })
        return image


class AnnotationOperations:
    """CRUD operations for Annotation model"""
    
    @staticmethod
    def create_annotation(
        db: Session,
        image_id: str,
        class_name: str,
        class_id: int,
        x_min: float,
        y_min: float,
        x_max: float,
        y_max: float,
        confidence: float = 1.0,
        segmentation: List = None,
        is_auto_generated: bool = False,
        model_id: str = None
    ) -> Annotation:
        """Create a new annotation"""
        logger.info("app.database", "Creating new annotation", "annotation_creation_start", {
            "image_id": image_id,
            "class_name": class_name,
            "class_id": class_id,
            "x_min": x_min,
            "y_min": y_min,
            "x_max": x_max,
            "y_max": y_max,
            "confidence": confidence,
            "segmentation": segmentation,
            "is_auto_generated": is_auto_generated,
            "model_id": model_id
        })
        
        try:
            annotation = Annotation(
                image_id=image_id,
                class_name=class_name,
                class_id=class_id,
                x_min=x_min,
                y_min=y_min,
                x_max=x_max,
                y_max=y_max,
                confidence=confidence,
                segmentation=segmentation,
                is_auto_generated=is_auto_generated,
                model_id=model_id
            )
            db.add(annotation)
            db.commit()
            db.refresh(annotation)
            
            logger.info("app.database", "Annotation created successfully", "annotation_creation_complete", {
                "annotation_id": annotation.id,
                "image_id": image_id
            })
            
            # Update image status
            ImageOperations.update_image_status(db, image_id, is_labeled=True)
            return annotation
        except Exception as e:
            logger.error("errors.system", f"Annotation creation failed: {str(e)}", "annotation_creation_error", {
                "image_id": image_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_annotations_by_image(db: Session, image_id: str) -> List[Annotation]:
        """Get all annotations for an image"""
        logger.info("app.database", "Retrieving annotations by image ID", "annotations_retrieval_by_image", {
            "image_id": image_id
        })
        
        annotations = db.query(Annotation).filter(Annotation.image_id == image_id).all()
        
        logger.info("app.database", "Annotations retrieved successfully", "annotations_retrieved_by_image", {
            "image_id": image_id,
            "annotations_count": len(annotations)
        })
        
        return annotations
    
    @staticmethod
    def delete_annotations_by_image(db: Session, image_id: str) -> int:
        """Delete all annotations for an image"""
        logger.info("app.database", "Deleting all annotations by image ID", "annotations_deletion_by_image", {
            "image_id": image_id
        })
        
        count = db.query(Annotation).filter(Annotation.image_id == image_id).count()
        db.query(Annotation).filter(Annotation.image_id == image_id).delete()
        db.commit()
        
        # Update image status
        ImageOperations.update_image_status(db, image_id, is_labeled=False)
        
        logger.info("app.database", "Annotations deleted successfully", "annotations_deletion_complete", {
            "image_id": image_id,
            "deleted_count": count
        })
        return count
    
    @staticmethod
    def update_annotation(db: Session, annotation_id: str, **kwargs) -> Optional[Annotation]:
        """Update annotation"""
        logger.info("app.database", "Updating annotation", "annotation_update_start", {
            "annotation_id": annotation_id,
            "update_fields": list(kwargs.keys())
        })
        
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if annotation:
            for key, value in kwargs.items():
                if hasattr(annotation, key):
                    setattr(annotation, key, value)
            annotation.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(annotation)
            
            logger.info("app.database", "Annotation updated successfully", "annotation_update_complete", {
                "annotation_id": annotation.id,
                "updated_fields": list(kwargs.keys())
            })
        else:
            logger.warning("app.database", "Annotation not found for update", "annotation_update_not_found", {
                "annotation_id": annotation_id
            })
        return annotation


class AutoLabelJobOperations:
    """CRUD operations for AutoLabelJob model"""
    
    @staticmethod
    def create_auto_label_job(
        db: Session,
        dataset_id: str,
        model_id: str,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        overwrite_existing: bool = False
    ) -> AutoLabelJob:
        """Create a new auto-labeling job"""
        logger.info("app.database", "Creating new auto-labeling job", "auto_label_job_creation_start", {
            "dataset_id": dataset_id,
            "model_id": model_id,
            "confidence_threshold": confidence_threshold,
            "iou_threshold": iou_threshold,
            "overwrite_existing": overwrite_existing
        })
        
        try:
            job = AutoLabelJob(
                dataset_id=dataset_id,
                model_id=model_id,
                confidence_threshold=confidence_threshold,
                iou_threshold=iou_threshold,
                overwrite_existing=overwrite_existing
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            logger.info("app.database", "Auto-labeling job created successfully", "auto_label_job_creation_complete", {
                "job_id": job.id,
                "dataset_id": dataset_id
            })
            return job
        except Exception as e:
            logger.error("errors.system", f"Auto-labeling job creation failed: {str(e)}", "auto_label_job_creation_error", {
                "dataset_id": dataset_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_job(db: Session, job_id: str) -> Optional[AutoLabelJob]:
        """Get job by ID"""
        logger.info("app.database", "Retrieving auto-labeling job by ID", "auto_label_job_retrieval", {
            "job_id": job_id
        })
        
        job = db.query(AutoLabelJob).filter(AutoLabelJob.id == job_id).first()
        
        if job:
            logger.info("app.database", "Auto-labeling job retrieved successfully", "auto_label_job_retrieved", {
                "job_id": job.id,
                "dataset_id": job.dataset_id
            })
        else:
            logger.warning("app.database", "Auto-labeling job not found", "auto_label_job_not_found", {
                "job_id": job_id
            })
        
        return job
    
    @staticmethod
    def update_job_progress(
        db: Session, 
        job_id: str, 
        status: str = None,
        progress: float = None,
        **kwargs
    ) -> Optional[AutoLabelJob]:
        """Update job progress and status"""
        logger.info("app.database", "Updating auto-labeling job progress and status", "auto_label_job_status_update", {
            "job_id": job_id,
            "update_fields": [f for f in [status, progress] + list(kwargs.keys()) if f is not None]
        })
        
        job = db.query(AutoLabelJob).filter(AutoLabelJob.id == job_id).first()
        if job:
            if status:
                job.status = status
                if status == "processing" and not job.started_at:
                    job.started_at = datetime.utcnow()
                elif status in ["completed", "failed"]:
                    job.completed_at = datetime.utcnow()
            
            if progress is not None:
                job.progress = progress
            
            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            
            db.commit()
            db.refresh(job)
            
            logger.info("app.database", "Auto-labeling job status updated successfully", "auto_label_job_status_update_complete", {
                "job_id": job.id,
                "status": job.status,
                "progress": job.progress
            })
        else:
            logger.warning("app.database", "Auto-labeling job not found for status update", "auto_label_job_status_update_not_found", {
                "job_id": job_id
            })
        return job


class ModelUsageOperations:
    """CRUD operations for ModelUsage model"""
    
    @staticmethod
    def update_model_usage(
        db: Session,
        model_id: str,
        model_name: str,
        images_processed: int = 1,
        processing_time: float = 0.0,
        average_confidence: float = 0.0
    ):
        """Update or create model usage statistics"""
        logger.info("app.database", "Updating or creating model usage statistics", "model_usage_update", {
            "model_id": model_id,
            "model_name": model_name,
            "images_processed": images_processed,
            "processing_time": processing_time,
            "average_confidence": average_confidence
        })
        
        usage = db.query(ModelUsage).filter(ModelUsage.model_id == model_id).first()
        
        if not usage:
            usage = ModelUsage(
                model_id=model_id,
                model_name=model_name,
                total_inferences=1,
                total_images_processed=images_processed,
                average_confidence=average_confidence,
                average_processing_time=processing_time
            )
            db.add(usage)
        else:
            # Update running averages
            total_inferences = usage.total_inferences + 1
            total_images = usage.total_images_processed + images_processed
            
            # Update averages
            usage.average_confidence = (
                (usage.average_confidence * usage.total_inferences + average_confidence) / 
                total_inferences
            )
            usage.average_processing_time = (
                (usage.average_processing_time * usage.total_inferences + processing_time) / 
                total_inferences
            )
            
            usage.total_inferences = total_inferences
            usage.total_images_processed = total_images
            usage.last_used = datetime.utcnow()
        
        db.commit()
        db.refresh(usage)
        
        logger.info("app.database", "Model usage statistics updated successfully", "model_usage_update_complete", {
            "model_id": model_id,
            "model_name": model_name,
            "total_inferences": usage.total_inferences,
            "total_images_processed": usage.total_images_processed,
            "average_confidence": usage.average_confidence,
            "average_processing_time": usage.average_processing_time
        })
        return usage
    
    @staticmethod
    def get_model_usage_stats(db: Session) -> List[ModelUsage]:
        """Get usage statistics for all models"""
        logger.info("app.database", "Retrieving all model usage statistics", "model_usage_stats_retrieval", {
            "all_models": True
        })
        
        model_usages = db.query(ModelUsage).order_by(desc(ModelUsage.last_used)).all()
        
        logger.info("app.database", "Model usage statistics retrieved successfully", "model_usage_stats_retrieved", {
            "model_usages_count": len(model_usages)
        })
        
        return model_usages





class DatasetSplitOperations:
    """CRUD operations for DatasetSplit model"""
    
    @staticmethod
    def create_dataset_split(db: Session, data: Dict[str, Any]) -> DatasetSplit:
        """Create a new dataset split configuration"""
        logger.info("app.database", "Creating new dataset split configuration", "dataset_split_creation_start", {
            "data": data
        })
        
        try:
            split = DatasetSplit(**data)
            db.add(split)
            db.commit()
            db.refresh(split)
            
            logger.info("app.database", "Dataset split configuration created successfully", "dataset_split_creation_complete", {
                "split_id": split.id,
                "dataset_id": split.dataset_id
            })
            return split
        except Exception as e:
            logger.error("errors.system", f"Dataset split creation failed: {str(e)}", "dataset_split_creation_error", {
                "data": data,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_dataset_split_by_dataset(db: Session, dataset_id: str) -> Optional[DatasetSplit]:
        """Get dataset split configuration by dataset ID"""
        logger.info("app.database", "Retrieving dataset split configuration by dataset ID", "dataset_split_retrieval_by_dataset", {
            "dataset_id": dataset_id
        })
        
        split = db.query(DatasetSplit).filter(DatasetSplit.dataset_id == dataset_id).first()
        
        if split:
            logger.info("app.database", "Dataset split configuration retrieved successfully", "dataset_split_retrieved_by_dataset", {
                "split_id": split.id,
                "dataset_id": dataset_id
            })
        else:
            logger.warning("app.database", "Dataset split configuration not found", "dataset_split_not_found_by_dataset", {
                "dataset_id": dataset_id
            })
        
        return split
    
    @staticmethod
    def update_dataset_split(db: Session, split_id: str, data: Dict[str, Any]) -> Optional[DatasetSplit]:
        """Update dataset split configuration"""
        logger.info("app.database", "Updating dataset split configuration", "dataset_split_update_start", {
            "split_id": split_id,
            "update_fields": list(data.keys())
        })
        
        split = db.query(DatasetSplit).filter(DatasetSplit.id == split_id).first()
        if split:
            for key, value in data.items():
                setattr(split, key, value)
            split.updated_at = datetime.utcnow()
            split.last_split_at = datetime.utcnow()
            db.commit()
            db.refresh(split)
            
            logger.info("app.database", "Dataset split configuration updated successfully", "dataset_split_update_complete", {
                "split_id": split.id,
                "dataset_id": split.dataset_id,
                "updated_fields": list(data.keys())
            })
        else:
            logger.warning("app.database", "Dataset split configuration not found for update", "dataset_split_update_not_found", {
                "split_id": split_id
            })
        return split
    
    @staticmethod
    def delete_dataset_split(db: Session, split_id: str) -> bool:
        """Delete dataset split configuration"""
        logger.info("app.database", "Deleting dataset split configuration", "dataset_split_deletion_start", {
            "split_id": split_id
        })
        
        split = db.query(DatasetSplit).filter(DatasetSplit.id == split_id).first()
        if split:
            db.delete(split)
            db.commit()
            logger.info("app.database", "Dataset split configuration deleted successfully", "dataset_split_deletion_complete", {
                "split_id": split_id
            })
            return True
        else:
            logger.warning("app.database", "Dataset split configuration not found for deletion", "dataset_split_deletion_not_found", {
                "split_id": split_id
            })
            return False


class LabelAnalyticsOperations:
    """CRUD operations for LabelAnalytics model"""
    
    @staticmethod
    def create_label_analytics(db: Session, dataset_id: str, analytics_data: Dict[str, Any]) -> LabelAnalytics:
        """Create new label analytics"""
        logger.info("app.database", "Creating new label analytics", "label_analytics_creation_start", {
            "dataset_id": dataset_id,
            "analytics_data": analytics_data
        })
        
        try:
            analytics = LabelAnalytics(
                dataset_id=dataset_id,
                class_distribution=analytics_data.get('class_distribution', {}),
                total_annotations=analytics_data.get('total_annotations', 0),
                num_classes=analytics_data.get('num_classes', 0),
                most_common_class=analytics_data.get('most_common_class'),
                most_common_count=analytics_data.get('most_common_count', 0),
                least_common_class=analytics_data.get('least_common_class'),
                least_common_count=analytics_data.get('least_common_count', 0),
                gini_coefficient=analytics_data.get('gini_coefficient', 0.0),
                entropy=analytics_data.get('entropy', 0.0),
                imbalance_ratio=analytics_data.get('imbalance_ratio', 0.0),
                is_balanced=analytics_data.get('is_balanced', True),
                needs_augmentation=analytics_data.get('needs_augmentation', False),
                recommended_techniques=analytics_data.get('recommendations', [])
            )
            db.add(analytics)
            db.commit()
            db.refresh(analytics)
            
            logger.info("app.database", "Label analytics created successfully", "label_analytics_creation_complete", {
                "analytics_id": analytics.id,
                "dataset_id": dataset_id
            })
            return analytics
        except Exception as e:
            logger.error("errors.system", f"Label analytics creation failed: {str(e)}", "label_analytics_creation_error", {
                "dataset_id": dataset_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise
    
    @staticmethod
    def get_label_analytics_by_dataset(db: Session, dataset_id: str) -> Optional[LabelAnalytics]:
        """Get label analytics by dataset ID"""
        logger.info("app.database", "Retrieving label analytics by dataset ID", "label_analytics_retrieval_by_dataset", {
            "dataset_id": dataset_id
        })
        
        analytics = db.query(LabelAnalytics).filter(LabelAnalytics.dataset_id == dataset_id).first()
        
        if analytics:
            logger.info("app.database", "Label analytics retrieved successfully", "label_analytics_retrieved_by_dataset", {
                "analytics_id": analytics.id,
                "dataset_id": dataset_id
            })
        else:
            logger.warning("app.database", "Label analytics not found", "label_analytics_not_found_by_dataset", {
                "dataset_id": dataset_id
            })
        
        return analytics
    
    @staticmethod
    def update_label_analytics(db: Session, analytics_id: str, analytics_data: Dict[str, Any]) -> Optional[LabelAnalytics]:
        """Update label analytics"""
        logger.info("app.database", "Updating label analytics", "label_analytics_update_start", {
            "analytics_id": analytics_id,
            "update_fields": list(analytics_data.keys())
        })
        
        analytics = db.query(LabelAnalytics).filter(LabelAnalytics.id == analytics_id).first()
        if analytics:
            analytics.class_distribution = analytics_data.get('class_distribution', analytics.class_distribution)
            analytics.total_annotations = analytics_data.get('total_annotations', analytics.total_annotations)
            analytics.num_classes = analytics_data.get('num_classes', analytics.num_classes)
            analytics.most_common_class = analytics_data.get('most_common_class', analytics.most_common_class)
            analytics.most_common_count = analytics_data.get('most_common_count', analytics.most_common_count)
            analytics.least_common_class = analytics_data.get('least_common_class', analytics.least_common_class)
            analytics.least_common_count = analytics_data.get('least_common_count', analytics.least_common_count)
            analytics.gini_coefficient = analytics_data.get('gini_coefficient', analytics.gini_coefficient)
            analytics.entropy = analytics_data.get('entropy', analytics.entropy)
            analytics.imbalance_ratio = analytics_data.get('imbalance_ratio', analytics.imbalance_ratio)
            analytics.is_balanced = analytics_data.get('is_balanced', analytics.is_balanced)
            analytics.needs_augmentation = analytics_data.get('needs_augmentation', analytics.needs_augmentation)
            analytics.recommended_techniques = analytics_data.get('recommendations', analytics.recommended_techniques)
            analytics.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(analytics)
            
            logger.info("app.database", "Label analytics updated successfully", "label_analytics_update_complete", {
                "analytics_id": analytics.id,
                "updated_fields": list(analytics_data.keys())
            })
        else:
            logger.warning("app.database", "Label analytics not found for update", "label_analytics_update_not_found", {
                "analytics_id": analytics_id
            })
        return analytics


class AiModelOperations:
    """Operations to manage AiModel entries and sync from config."""

    @staticmethod
    def upsert_ai_model(
        db: Session,
        name: str,
        model_type: str,
        model_format: str,
        file_path: str,
        classes: Optional[List[str]] = None,
        input_size_default: Optional[List[int]] = None,
        training_input_size: Optional[List[int]] = None,
    ) -> AiModel:
        """Create or update an AiModel by name.

        - Ensures unique name constraint is respected.
        - Updates existing record if found; otherwise creates a new one.
        """
        try:
            existing = db.query(AiModel).filter(AiModel.name == name).first()

            nc = len(classes) if classes else 0
            # Normalize sizes to [w, h]
            def _to_size_list(sz: Optional[Any]) -> Optional[List[int]]:
                if sz is None:
                    return None
                if isinstance(sz, (list, tuple)) and len(sz) >= 2:
                    return [int(sz[0]), int(sz[1])]
                if isinstance(sz, dict):
                    # Support {"width":640,"height":640}
                    w = sz.get("width") or sz.get("w")
                    h = sz.get("height") or sz.get("h")
                    if w and h:
                        return [int(w), int(h)]
                return None

            input_size_default = _to_size_list(input_size_default) or [640, 640]
            training_input_size = _to_size_list(training_input_size)

            if existing:
                existing.type = model_type
                existing.format = model_format
                existing.file_path = str(file_path)
                existing.nc = nc
                existing.classes = classes or []
                existing.input_size_default = input_size_default
                existing.training_input_size = training_input_size
                existing.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(existing)
                logger.info("app.database", "AiModel updated", "ai_model_upsert_update", {
                    "name": name,
                    "id": existing.id,
                    "format": existing.format,
                    "type": existing.type,
                    "nc": existing.nc
                })
                return existing
            else:
                ai = AiModel(
                    name=name,
                    type=model_type,
                    format=model_format,
                    file_path=str(file_path),
                    nc=nc,
                    classes=classes or [],
                    input_size_default=input_size_default,
                    training_input_size=training_input_size,
                    created_at=datetime.utcnow(),
                )
                db.add(ai)
                db.commit()
                db.refresh(ai)
                logger.info("app.database", "AiModel created", "ai_model_upsert_create", {
                    "name": name,
                    "id": ai.id,
                    "format": ai.format,
                    "type": ai.type,
                    "nc": ai.nc
                })
                return ai
        except Exception as e:
            logger.error("errors.system", f"AiModel upsert failed: {str(e)}", "ai_model_upsert_error", {
                "name": name,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise

    @staticmethod
    def sync_from_config(db: Session) -> Dict[str, Any]:
        """Sync AiModel table from models/models_config.json.

        Reads the JSON produced by ModelManager and ensures each model is reflected
        in the ai_models table. Returns a summary dict with counts.
        """
        summary = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}
        try:
            config_path = Path(settings.MODELS_DIR) / "models_config.json"
            if not config_path.exists():
                logger.warning("app.database", "models_config.json not found; skipping AiModel sync", "ai_model_sync_missing_config", {
                    "path": str(config_path)
                })
                return summary

            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)

            # cfg is a dict of {model_id: model_data}
            for model_id, data in cfg.items():
                try:
                    name = data.get("name") or model_id
                    path = data.get("path") or ""
                    classes = data.get("classes") or []
                    input_size = data.get("input_size")
                    model_type = str(data.get("type") or "object_detection")
                    # Prefer explicit format, otherwise infer from file extension
                    fmt = str(data.get("format") or "")
                    if not fmt:
                        ext = Path(path).suffix.lower()
                        if ext == ".pt":
                            fmt = "pytorch"
                        elif ext == ".onnx":
                            fmt = "onnx"
                        elif ext in (".engine", ".trt"):
                            fmt = "tensorrt"
                        else:
                            fmt = "pytorch"

                    before = db.query(AiModel).filter(AiModel.name == name).first()
                    AiModelOperations.upsert_ai_model(
                        db=db,
                        name=name,
                        model_type=model_type,
                        model_format=fmt,
                        file_path=path,
                        classes=classes,
                        input_size_default=input_size,
                        training_input_size=None,
                    )
                    after = db.query(AiModel).filter(AiModel.name == name).first()
                    if before is None and after is not None:
                        summary["created"] += 1
                    else:
                        summary["updated"] += 1
                except Exception as ie:
                    summary["errors"] += 1
                    logger.error("errors.system", f"AiModel sync entry failed: {str(ie)}", "ai_model_sync_entry_error", {
                        "model_id": model_id,
                        "name": data.get("name"),
                        "error": str(ie),
                        "error_type": type(ie).__name__
                    })

            logger.info("app.database", "AiModel sync completed", "ai_model_sync_complete", summary)
            return summary
        except Exception as e:
            logger.error("errors.system", f"AiModel sync failed: {str(e)}", "ai_model_sync_error", {
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise

    @staticmethod
    def delete_ai_model_by_name(db: Session, name: str) -> bool:
        """Delete an AiModel row by its unique name.

        Returns True if a row was deleted, False if not found.
        """
        try:
            model = db.query(AiModel).filter(AiModel.name == name).first()
            if not model:
                logger.warning("app.database", "AiModel not found for deletion by name", "ai_model_delete_not_found_by_name", {
                    "name": name
                })
                return False

            model_id = model.id
            db.delete(model)
            db.commit()
            logger.info("app.database", "AiModel deleted by name", "ai_model_delete_by_name", {
                "name": name,
                "id": model_id
            })
            return True
        except Exception as e:
            logger.error("errors.system", f"AiModel deletion by name failed: {str(e)}", "ai_model_delete_by_name_error", {
                "name": name,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise

    @staticmethod
    def delete_ai_model_by_id(db: Session, model_id: str) -> bool:
        """Delete an AiModel row by its ID.

        Returns True if a row was deleted, False if not found.
        """
        try:
            model = db.query(AiModel).filter(AiModel.id == model_id).first()
            if not model:
                logger.warning("app.database", "AiModel not found for deletion by id", "ai_model_delete_not_found_by_id", {
                    "id": model_id
                })
                return False

            name = model.name
            db.delete(model)
            db.commit()
            logger.info("app.database", "AiModel deleted by id", "ai_model_delete_by_id", {
                "name": name,
                "id": model_id
            })
            return True
        except Exception as e:
            logger.error("errors.system", f"AiModel deletion by id failed: {str(e)}", "ai_model_delete_by_id_error", {
                "id": model_id,
                "error": str(e),
                "error_type": type(e).__name__
            })
            raise


# Additional helper functions for image operations


# Create convenience functions that match the API expectations


def create_dataset_split(db: Session, data: Dict[str, Any]) -> DatasetSplit:
    logger.info("app.database", "Convenience function: Creating dataset split", "convenience_dataset_split_creation", {
        "data": data
    })
    return DatasetSplitOperations.create_dataset_split(db, data)

def get_dataset_split_by_dataset(db: Session, dataset_id: str) -> Optional[DatasetSplit]:
    logger.info("app.database", "Convenience function: Getting dataset split by dataset", "convenience_dataset_split_retrieval", {
        "dataset_id": dataset_id
    })
    return DatasetSplitOperations.get_dataset_split_by_dataset(db, dataset_id)

def update_dataset_split(db: Session, split_id: str, data: Dict[str, Any]) -> Optional[DatasetSplit]:
    logger.info("app.database", "Convenience function: Updating dataset split", "convenience_dataset_split_update", {
        "split_id": split_id,
        "data": data
    })
    return DatasetSplitOperations.update_dataset_split(db, split_id, data)

def create_label_analytics(db: Session, dataset_id: str, analytics_data: Dict[str, Any]) -> LabelAnalytics:
    logger.info("app.database", "Convenience function: Creating label analytics", "convenience_label_analytics_creation", {
        "dataset_id": dataset_id,
        "analytics_data": analytics_data
    })
    return LabelAnalyticsOperations.create_label_analytics(db, dataset_id, analytics_data)

def get_label_analytics_by_dataset(db: Session, dataset_id: str) -> Optional[LabelAnalytics]:
    logger.info("app.database", "Convenience function: Getting label analytics by dataset", "convenience_label_analytics_retrieval", {
        "dataset_id": dataset_id
    })
    return LabelAnalyticsOperations.get_label_analytics_by_dataset(db, dataset_id)

def update_label_analytics(db: Session, analytics_id: str, analytics_data: Dict[str, Any]) -> Optional[LabelAnalytics]:
    logger.info("app.database", "Convenience function: Updating label analytics", "convenience_label_analytics_update", {
        "analytics_id": analytics_id,
        "analytics_data": analytics_data
    })
    return LabelAnalyticsOperations.update_label_analytics(db, analytics_id, analytics_data)

def update_image_split(db: Session, image_id: str, split_type: str) -> bool:
    logger.info("app.database", "Convenience function: Updating image split", "convenience_image_split_update", {
        "image_id": image_id,
        "split_type": split_type
    })
    return ImageOperations.update_image_split(db, image_id, split_type)

def get_annotations_by_images(db: Session, image_ids: List[str]) -> List[Annotation]:
    logger.info("app.database", "Convenience function: Getting annotations by images", "convenience_annotations_by_images", {
        "image_ids": image_ids
    })
    return ImageOperations.get_annotations_by_images(db, image_ids)

def get_annotations_by_dataset(db: Session, dataset_id: str) -> List[Annotation]:
    logger.info("app.database", "Convenience function: Getting annotations by dataset", "convenience_annotations_by_dataset", {
        "dataset_id": dataset_id
    })
    return ImageOperations.get_annotations_by_dataset(db, dataset_id)

# Convenience functions for existing operations (avoiding circular imports)
def get_dataset(db: Session, dataset_id: str):
    logger.info("app.database", "Convenience function: Getting dataset", "convenience_dataset_retrieval", {
        "dataset_id": dataset_id
    })
    return DatasetOperations.get_dataset(db, dataset_id)

def get_images_by_dataset(db: Session, dataset_id: str, limit: Optional[int] = None):
    logger.info("app.database", "Convenience function: Getting images by dataset", "convenience_images_by_dataset", {
        "dataset_id": dataset_id,
        "limit": limit
    })
    if limit:
        return db.query(Image).filter(Image.dataset_id == dataset_id).limit(limit).all()
    return db.query(Image).filter(Image.dataset_id == dataset_id).all()

def get_image(db: Session, image_id: str):
    logger.info("app.database", "Convenience function: Getting image", "convenience_image_retrieval", {
        "image_id": image_id
    })
    return db.query(Image).filter(Image.id == image_id).first()

def get_annotations_by_image(db: Session, image_id: str):
    logger.info("app.database", "Convenience function: Getting annotations by image", "convenience_annotations_by_image", {
        "image_id": image_id
    })
    return db.query(Annotation).filter(Annotation.image_id == image_id).all()