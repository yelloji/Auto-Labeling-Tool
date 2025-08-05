"""
Database models for the Auto-Labeling Tool
Defines all database tables and relationships
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional
import uuid
from .base import Base


class Project(Base):
    """Project model for organizing datasets and annotations"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    project_type = Column(String(50), default="Object Detection")  # Object Detection, Image Classification, Instance Segmentation, etc.
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Project settings
    default_model_id = Column(String, nullable=True)
    confidence_threshold = Column(Float, default=0.5)
    iou_threshold = Column(Float, default=0.45)
    
    # Relationships - Add CASCADE delete for labels
    labels = relationship("Label", back_populates="project", cascade="all, delete-orphan")
    
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
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
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
    
    # Dataset section (workflow stage)
    split_type = Column(String(10), default="unassigned")  # unassigned, annotating, dataset
    
    # Train/Val/Test split section
    # Use nullable=True to handle cases where the column doesn't exist yet
    split_section = Column(String(10), default="train", nullable=True)  # train, val, test
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    annotations = relationship("Annotation", back_populates="image", cascade="all, delete-orphan")
    
    @property
    def normalized_file_path(self):
        """
        Return normalized file path for web serving
        Automatically handles any legacy path formats
        """
        if not self.file_path:
            return self.file_path
        
        # Normalize path: convert backslashes, remove leading ../, ensure proper format
        path = str(self.file_path).replace('\\', '/')
        
        # Remove leading ../ or ./
        while path.startswith('../') or path.startswith('./'):
            if path.startswith('../'):
                path = path[3:]
            elif path.startswith('./'):
                path = path[2:]
        
        # Ensure it starts with projects/ (without leading slash for web serving)
        if not path.startswith('projects/'):
            if 'uploads' in path:
                # Extract the part after uploads/
                uploads_index = path.find('uploads')
                after_uploads = path[uploads_index + len('uploads/'):]
                # Check if it contains projects/
                if 'projects/' in after_uploads:
                    projects_index = after_uploads.find('projects/')
                    path = 'projects/' + after_uploads[projects_index + len('projects/'):]
                else:
                    path = 'projects/' + after_uploads
            elif not path.startswith('projects/'):
                path = 'projects/' + path
        
        # Return with leading slash for web serving
        return '/' + path if not path.startswith('/') else path
    
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

class Release(Base):
    __tablename__ = "releases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    name = Column(String(100), nullable=False)
    description = Column(Text)
    export_format = Column(String(50))  # YOLO, COCO, etc.
    task_type = Column(String(50))       # object_detection, image_classification, etc.

    datasets_used = Column(JSON)  # list of dataset IDs used
    config = Column(JSON)         # merged config: augmentation + export

    total_original_images = Column(Integer)
    total_augmented_images = Column(Integer)
    final_image_count = Column(Integer)  # total exported images

    model_path = Column(String(500))  # path to ZIP or export folder

    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to transformations
    transformations = relationship("ImageTransformation", back_populates="release")


class ImageTransformation(Base):
    """Global image transformation configurations with dual-value support"""
    __tablename__ = "image_transformations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    transformation_type = Column(String(50), nullable=False)  # 'resize', 'rotate', etc.
    parameters = Column(JSON, nullable=False)                 # {"angle": 45, "fill_color": "white"}
    is_enabled = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    release_version = Column(String(100), nullable=False)     # "version_auto_2025_07_02_15_42"
    category = Column(String(20), default="basic")            # 'basic' or 'advanced'
    created_at = Column(DateTime, default=func.now())
    status = Column(String(20), default="PENDING")            # 'PENDING' or 'COMPLETED'
    release_id = Column(String, ForeignKey("releases.id", ondelete="SET NULL"), nullable=True)
    
    # NEW: Parameter ranges support for two-point sliders
    parameter_ranges = Column(JSON, nullable=True)            # {"angle": [10, 45], "brightness": [-20, 20]}
    range_enabled_params = Column(JSON, nullable=True)        # ["angle", "brightness"] - list of params using ranges
    
    # NEW: Maximum possible transformation combinations for this release version
    transformation_combination_count = Column(Integer, nullable=True)  # 2^n - 1 where n = enabled transformations
    
    # NEW: User-selected images per original (for Release Configuration UI)
    user_selected_images_per_original = Column(Integer, nullable=True)  # User's choice (must be <= transformation_combination_count)
    
    # NEW: Dual-value system support
    is_dual_value = Column(Boolean, default=False)            # True for dual-value transformations
    dual_value_parameters = Column(JSON, nullable=True)       # {"angle": {"user_value": 45, "auto_value": -45}}
    dual_value_enabled = Column(Boolean, default=False)       # Whether dual-value mode is active
    
    # Relationship to Release
    release = relationship("Release", back_populates="transformations")
    
    def __repr__(self):
        return f"<ImageTransformation(id='{self.id}', type='{self.transformation_type}', version='{self.release_version}', status='{self.status}', dual_value='{self.is_dual_value}')>"





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





class DatasetSplit(Base):
    """Dataset split configuration and statistics"""
    __tablename__ = "dataset_splits"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False, unique=True)
    
    # Split configuration
    train_percentage = Column(Float, default=70.0)  # 70%
    val_percentage = Column(Float, default=20.0)    # 20%
    test_percentage = Column(Float, default=10.0)   # 10%
    
    # Split method
    split_method = Column(String(20), default="random")  # random, stratified, manual
    random_seed = Column(Integer, default=42)
    stratify_by_class = Column(Boolean, default=True)
    
    # Current statistics
    train_count = Column(Integer, default=0)
    val_count = Column(Integer, default=0)
    test_count = Column(Integer, default=0)
    unassigned_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_split_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<DatasetSplit(dataset='{self.dataset_id}', train={self.train_percentage}%, val={self.val_percentage}%, test={self.test_percentage}%)>"


class LabelAnalytics(Base):
    """Label analytics and class distribution statistics"""
    __tablename__ = "label_analytics"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    
    # Class distribution (JSON)
    class_distribution = Column(JSON, nullable=False)
    # Example: {"person": 150, "car": 89, "bicycle": 23}
    
    # Imbalance metrics
    total_annotations = Column(Integer, default=0)
    num_classes = Column(Integer, default=0)
    most_common_class = Column(String(100))
    most_common_count = Column(Integer, default=0)
    least_common_class = Column(String(100))
    least_common_count = Column(Integer, default=0)
    
    # Statistical measures
    gini_coefficient = Column(Float, default=0.0)  # Measure of inequality (0 = perfect balance, 1 = maximum imbalance)
    entropy = Column(Float, default=0.0)  # Information entropy
    imbalance_ratio = Column(Float, default=0.0)  # Ratio of most common to least common class
    
    # Per-split statistics (JSON)
    train_distribution = Column(JSON, nullable=True)
    val_distribution = Column(JSON, nullable=True)
    test_distribution = Column(JSON, nullable=True)
    
    # Recommendations
    is_balanced = Column(Boolean, default=True)
    needs_augmentation = Column(Boolean, default=False)
    recommended_techniques = Column(JSON, nullable=True)  # List of recommended augmentation techniques
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<LabelAnalytics(dataset='{self.dataset_id}', classes={self.num_classes}, balanced={self.is_balanced})>"
    
    
    
class Label(Base):
    """Global project label definition"""
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    color = Column(String(20), default="#ff0000")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    # Relationship back to project
    project = relationship("Project", back_populates="labels")