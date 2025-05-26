"""
Database models for the Auto-Labeling Tool
Defines all database tables and relationships
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional
import uuid

Base = declarative_base()


class Project(Base):
    """Project model for organizing datasets and annotations"""
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Project settings
    default_model_id = Column(String, nullable=True)
    confidence_threshold = Column(Float, default=0.5)
    iou_threshold = Column(Float, default=0.45)
    
    # Relationships
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id='{self.id}', name='{self.name}')>"


class Dataset(Base):
    """Dataset model for managing image collections"""
    __tablename__ = "datasets"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Dataset statistics
    total_images = Column(Integer, default=0)
    labeled_images = Column(Integer, default=0)
    unlabeled_images = Column(Integer, default=0)
    
    # Dataset settings
    auto_label_enabled = Column(Boolean, default=True)
    model_id = Column(String, nullable=True)  # Override project default
    
    # Relationships
    project = relationship("Project", back_populates="datasets")
    images = relationship("Image", back_populates="dataset", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Dataset(id='{self.id}', name='{self.name}', project='{self.project_id}')>"


class Image(Base):
    """Image model for individual images in datasets"""
    __tablename__ = "images"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)  # in bytes
    
    # Image properties
    width = Column(Integer)
    height = Column(Integer)
    format = Column(String(10))  # jpg, png, etc.
    
    # Dataset relationship
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    dataset = relationship("Dataset", back_populates="images")
    
    # Status tracking
    is_labeled = Column(Boolean, default=False)
    is_auto_labeled = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    annotations = relationship("Annotation", back_populates="image", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Image(id='{self.id}', filename='{self.filename}')>"


class Annotation(Base):
    """Annotation model for object detection/segmentation labels"""
    __tablename__ = "annotations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    image_id = Column(String, ForeignKey("images.id"), nullable=False)
    
    # Annotation data
    class_name = Column(String(100), nullable=False)
    class_id = Column(Integer, nullable=False)
    confidence = Column(Float, default=1.0)
    
    # Bounding box (normalized coordinates 0-1)
    x_min = Column(Float, nullable=False)
    y_min = Column(Float, nullable=False)
    x_max = Column(Float, nullable=False)
    y_max = Column(Float, nullable=False)
    
    # Segmentation mask (optional, for instance segmentation)
    segmentation = Column(JSON, nullable=True)  # List of polygon points
    
    # Annotation metadata
    is_auto_generated = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    model_id = Column(String, nullable=True)  # Which model generated this
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    image = relationship("Image", back_populates="annotations")
    
    def __repr__(self):
        return f"<Annotation(id='{self.id}', class='{self.class_name}', confidence={self.confidence})>"


class ModelUsage(Base):
    """Track model usage and performance"""
    __tablename__ = "model_usage"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String, nullable=False)
    model_name = Column(String(255), nullable=False)
    
    # Usage statistics
    total_inferences = Column(Integer, default=0)
    total_images_processed = Column(Integer, default=0)
    average_confidence = Column(Float, default=0.0)
    average_processing_time = Column(Float, default=0.0)  # seconds
    
    # Performance tracking
    last_used = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<ModelUsage(model_id='{self.model_id}', inferences={self.total_inferences})>"


class ExportJob(Base):
    """Track export jobs and their status"""
    __tablename__ = "export_jobs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    
    # Export configuration
    export_format = Column(String(50), nullable=False)  # YOLO, COCO, Pascal VOC, etc.
    include_images = Column(Boolean, default=True)
    include_annotations = Column(Boolean, default=True)
    verified_only = Column(Boolean, default=False)
    
    # Job status
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    progress = Column(Float, default=0.0)  # 0-100
    file_path = Column(String(500), nullable=True)  # Path to exported file
    file_size = Column(Integer, nullable=True)  # Size in bytes
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<ExportJob(id='{self.id}', format='{self.export_format}', status='{self.status}')>"


class AutoLabelJob(Base):
    """Track auto-labeling jobs and their progress"""
    __tablename__ = "auto_label_jobs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    model_id = Column(String, nullable=False)
    
    # Job configuration
    confidence_threshold = Column(Float, default=0.5)
    iou_threshold = Column(Float, default=0.45)
    overwrite_existing = Column(Boolean, default=False)
    
    # Job status
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    progress = Column(Float, default=0.0)  # 0-100
    
    # Statistics
    total_images = Column(Integer, default=0)
    processed_images = Column(Integer, default=0)
    successful_images = Column(Integer, default=0)
    failed_images = Column(Integer, default=0)
    total_annotations_created = Column(Integer, default=0)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<AutoLabelJob(id='{self.id}', dataset='{self.dataset_id}', status='{self.status}')>"