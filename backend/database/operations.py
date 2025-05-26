"""
Database operations for the Auto-Labeling Tool
CRUD operations for all models
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from .models import (
    Project, Dataset, Image, Annotation, 
    ModelUsage, ExportJob, AutoLabelJob
)


class ProjectOperations:
    """CRUD operations for Project model"""
    
    @staticmethod
    def create_project(
        db: Session,
        name: str,
        description: str = "",
        default_model_id: str = None,
        confidence_threshold: float = 0.5,
        iou_threshold: float = 0.45
    ) -> Project:
        """Create a new project"""
        project = Project(
            name=name,
            description=description,
            default_model_id=default_model_id,
            confidence_threshold=confidence_threshold,
            iou_threshold=iou_threshold
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project
    
    @staticmethod
    def get_project(db: Session, project_id: str) -> Optional[Project]:
        """Get project by ID"""
        return db.query(Project).filter(Project.id == project_id).first()
    
    @staticmethod
    def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
        """Get all projects with pagination"""
        return db.query(Project).offset(skip).limit(limit).all()
    
    @staticmethod
    def update_project(db: Session, project_id: str, **kwargs) -> Optional[Project]:
        """Update project"""
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            for key, value in kwargs.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            project.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(project)
        return project
    
    @staticmethod
    def delete_project(db: Session, project_id: str) -> bool:
        """Delete project and all related data"""
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            db.delete(project)
            db.commit()
            return True
        return False


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
        return dataset
    
    @staticmethod
    def get_dataset(db: Session, dataset_id: str) -> Optional[Dataset]:
        """Get dataset by ID"""
        return db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    @staticmethod
    def get_datasets_by_project(db: Session, project_id: str) -> List[Dataset]:
        """Get all datasets for a project"""
        return db.query(Dataset).filter(Dataset.project_id == project_id).all()
    
    @staticmethod
    def update_dataset_stats(db: Session, dataset_id: str):
        """Update dataset statistics"""
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
        return dataset
    
    @staticmethod
    def delete_dataset(db: Session, dataset_id: str) -> bool:
        """Delete dataset and all related data"""
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            db.delete(dataset)
            db.commit()
            return True
        return False


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
        format: str = None
    ) -> Image:
        """Create a new image record"""
        image = Image(
            filename=filename,
            original_filename=original_filename,
            file_path=file_path,
            dataset_id=dataset_id,
            width=width,
            height=height,
            file_size=file_size,
            format=format
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        
        # Update dataset stats
        DatasetOperations.update_dataset_stats(db, dataset_id)
        return image
    
    @staticmethod
    def get_image(db: Session, image_id: str) -> Optional[Image]:
        """Get image by ID"""
        return db.query(Image).filter(Image.id == image_id).first()
    
    @staticmethod
    def get_images_by_dataset(
        db: Session, 
        dataset_id: str, 
        skip: int = 0, 
        limit: int = 100,
        labeled_only: bool = None
    ) -> List[Image]:
        """Get images for a dataset with optional filtering"""
        query = db.query(Image).filter(Image.dataset_id == dataset_id)
        
        if labeled_only is not None:
            query = query.filter(Image.is_labeled == labeled_only)
        
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def update_image_status(
        db: Session, 
        image_id: str, 
        is_labeled: bool = None,
        is_auto_labeled: bool = None,
        is_verified: bool = None
    ) -> Optional[Image]:
        """Update image labeling status"""
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
            
            # Update dataset stats
            DatasetOperations.update_dataset_stats(db, image.dataset_id)
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
        
        # Update image status
        ImageOperations.update_image_status(db, image_id, is_labeled=True)
        return annotation
    
    @staticmethod
    def get_annotations_by_image(db: Session, image_id: str) -> List[Annotation]:
        """Get all annotations for an image"""
        return db.query(Annotation).filter(Annotation.image_id == image_id).all()
    
    @staticmethod
    def delete_annotations_by_image(db: Session, image_id: str) -> int:
        """Delete all annotations for an image"""
        count = db.query(Annotation).filter(Annotation.image_id == image_id).count()
        db.query(Annotation).filter(Annotation.image_id == image_id).delete()
        db.commit()
        
        # Update image status
        ImageOperations.update_image_status(db, image_id, is_labeled=False)
        return count
    
    @staticmethod
    def update_annotation(db: Session, annotation_id: str, **kwargs) -> Optional[Annotation]:
        """Update annotation"""
        annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if annotation:
            for key, value in kwargs.items():
                if hasattr(annotation, key):
                    setattr(annotation, key, value)
            annotation.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(annotation)
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
        return job
    
    @staticmethod
    def get_job(db: Session, job_id: str) -> Optional[AutoLabelJob]:
        """Get job by ID"""
        return db.query(AutoLabelJob).filter(AutoLabelJob.id == job_id).first()
    
    @staticmethod
    def update_job_progress(
        db: Session, 
        job_id: str, 
        status: str = None,
        progress: float = None,
        **kwargs
    ) -> Optional[AutoLabelJob]:
        """Update job progress and status"""
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
        return usage
    
    @staticmethod
    def get_model_usage_stats(db: Session) -> List[ModelUsage]:
        """Get usage statistics for all models"""
        return db.query(ModelUsage).order_by(desc(ModelUsage.last_used)).all()