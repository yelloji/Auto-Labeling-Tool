"""
Central Release Controller for Auto-Labeling Tool Release Pipeline
Orchestrates the complete release generation process
"""

import os
import json
import logging
import uuid
import shutil
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Import our components
from core.transformation_schema import TransformationSchema, create_schema_from_database, generate_release_configurations
from core.image_generator import ImageAugmentationEngine, create_augmentation_engine, process_release_images
from database.database import get_db
from database.models import ImageTransformation, Release, Image, Dataset, Project
from sqlalchemy.orm import Session

# Import export system
from api.routes.enhanced_export import ExportFormats, ExportRequest

logger = logging.getLogger(__name__)

@dataclass
class ReleaseConfig:
    """Configuration for release generation"""
    release_name: str
    description: str
    project_id: int
    dataset_ids: List[str]
    export_format: str = "yolo_detection"  # yolo_detection, yolo_segmentation, coco, pascal_voc, csv
    task_type: str = "object_detection"  # object_detection, segmentation
    images_per_original: int = 4
    sampling_strategy: str = "intelligent"
    output_format: str = "original"  # original, jpg, png, webp, bmp, tiff
    include_original: bool = True
    split_sections: List[str] = None  # train, val, test - if None, includes all
    preserve_original_splits: bool = True  # Always preserve original train/val/test assignments

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
    
    def get_dataset_images(self, dataset_ids: List[str], split_sections: List[str] = None) -> List[Dict[str, Any]]:
        """
        Get all images from specified datasets with enhanced multi-dataset support
        
        Handles multiple dataset paths like:
        - projects/gevis/dataset/animal/train/
        - projects/gevis/dataset/car_dataset/val/
        - projects/gevis/dataset/RAKESH/test/
        
        Args:
            dataset_ids: List of dataset IDs to include
            split_sections: List of split sections to include (train, val, test). If None, includes all.
        """
        try:
            # Build query for images from specified datasets
            query = self.db.query(Image).filter(
                Image.dataset_id.in_(dataset_ids),
                Image.split_type == "dataset"  # Only get images in dataset section
            )
            
            # Filter by split sections if specified
            if split_sections:
                query = query.filter(Image.split_section.in_(split_sections))
            
            images = query.all()
            
            # Also get dataset information for path handling
            datasets = self.db.query(Dataset).filter(Dataset.id.in_(dataset_ids)).all()
            dataset_info = {ds.id: ds for ds in datasets}
            
            image_records = []
            dataset_stats = {}
            split_stats = {}
            
            for image in images:
                # Get dataset info
                dataset = dataset_info.get(image.dataset_id)
                dataset_name = dataset.name if dataset else f"dataset_{image.dataset_id}"
                split_section = image.split_section or "train"
                
                # Track dataset statistics
                if dataset_name not in dataset_stats:
                    dataset_stats[dataset_name] = 0
                dataset_stats[dataset_name] += 1
                
                # Track split section statistics
                if split_section not in split_stats:
                    split_stats[split_section] = 0
                split_stats[split_section] += 1
                
                record = {
                    "id": image.id,
                    "filename": image.filename,
                    "file_path": image.file_path,
                    "dataset_id": image.dataset_id,
                    "dataset_name": dataset_name,
                    "split_section": split_section,
                    "width": image.width,
                    "height": image.height,
                    "source_path": self._get_source_dataset_path(image.file_path, dataset_name)
                }
                image_records.append(record)
            
            logger.info(f"📊 MULTI-DATASET LOADING COMPLETE:")
            logger.info(f"   Total images: {len(image_records)}")
            logger.info(f"   📁 Dataset breakdown:")
            for dataset_name, count in dataset_stats.items():
                logger.info(f"      {dataset_name}: {count} images")
            logger.info(f"   🎯 Split breakdown:")
            for split_name, count in split_stats.items():
                logger.info(f"      {split_name}: {count} images")
            if split_sections:
                logger.info(f"   🔍 Filtered by splits: {split_sections}")
            else:
                logger.info(f"   🔍 Including all splits: train, val, test")
            
            return image_records
            
        except Exception as e:
            logger.error(f"Failed to get dataset images: {str(e)}")
            return []
    
    def _get_source_dataset_path(self, file_path: str, dataset_name: str) -> str:
        """
        Extract source dataset path from file path
        
        Examples:
        - projects/gevis/dataset/animal/train/image.jpg → projects/gevis/dataset/animal/
        - projects/gevis/dataset/car_dataset/val/image.jpg → projects/gevis/dataset/car_dataset/
        - projects/gevis/dataset/RAKESH/test/image.jpg → projects/gevis/dataset/RAKESH/
        """
        try:
            path_parts = Path(file_path).parts
            
            # Find the dataset part in the path
            if 'dataset' in path_parts:
                dataset_idx = path_parts.index('dataset')
                if dataset_idx + 1 < len(path_parts):
                    # Return path up to and including the dataset folder
                    source_parts = path_parts[:dataset_idx + 2]  # Include dataset/dataset_name
                    return str(Path(*source_parts))
            
            # Fallback: use the directory containing the file
            return str(Path(file_path).parent)
            
        except Exception as e:
            logger.warning(f"Could not extract source path from {file_path}: {e}")
            return str(Path(file_path).parent)
    
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
            
            # Get dataset images with split section filtering
            image_records = self.get_dataset_images(config.dataset_ids, config.split_sections)
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
            
            # Prepare image paths and dataset splits with multi-dataset support
            image_paths = []
            dataset_splits = {}
            dataset_sources = {}  # Track source dataset for each image
            
            # Create staging directory for copied images
            staging_dir = f"{output_dir}/staging"
            os.makedirs(staging_dir, exist_ok=True)
            
            logger.info(f"🔄 COPYING IMAGES FROM MULTIPLE DATASETS:")
            
            for img_record in image_records:
                # Get source image path
                source_path = self._resolve_image_path(img_record["file_path"])
                
                if not os.path.exists(source_path):
                    logger.warning(f"Source image not found: {source_path}")
                    continue
                
                # Create unique filename to avoid conflicts between datasets
                dataset_name = img_record["dataset_name"]
                original_filename = img_record["filename"]
                unique_filename = f"{dataset_name}_{original_filename}"
                
                # Copy image to staging directory (not move!)
                staging_path = os.path.join(staging_dir, unique_filename)
                try:
                    shutil.copy2(source_path, staging_path)
                    logger.debug(f"   Copied: {source_path} → {staging_path}")
                    
                    # Add to processing lists
                    image_paths.append(staging_path)
                    dataset_splits[staging_path] = img_record["split_section"]
                    dataset_sources[staging_path] = {
                        "dataset_name": dataset_name,
                        "dataset_id": img_record["dataset_id"],
                        "source_path": img_record["source_path"],
                        "original_filename": original_filename
                    }
                    
                except Exception as e:
                    logger.error(f"Failed to copy {source_path}: {e}")
                    continue
            
            logger.info(f"✅ Successfully copied {len(image_paths)} images from {len(set(img['dataset_name'] for img in image_records))} datasets")
            
            # Process all images with multi-dataset support
            all_results = process_release_images(
                image_paths=image_paths,
                transformation_configs=transformation_configs,
                dataset_splits=dataset_splits,
                output_dir=output_dir,
                output_format=config.output_format,
                dataset_sources=dataset_sources  # Pass dataset source information
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
            
            # Intelligently select export format based on task type and annotations
            optimal_export_format = self._select_optimal_export_format(
                all_results, 
                config.export_format, 
                config.task_type if hasattr(config, 'task_type') else 'object_detection'
            )
            
            # Generate export files with transformed annotations
            export_path = self._generate_export_files(
                release_id, 
                all_results, 
                optimal_export_format,
                config.task_type if hasattr(config, 'task_type') else 'object_detection'
            )
            
            # Update release with export path and format
            if release and export_path:
                release.model_path = export_path
                release.export_format = optimal_export_format
                release.task_type = config.task_type if hasattr(config, 'task_type') else 'object_detection'
                self.db.commit()
            
            # Cleanup staging directory (images were copied, not moved)
            self._cleanup_staging_directory(staging_dir)
            
            # Update final progress
            self.update_release_progress(
                release_id,
                status="completed",
                progress_percentage=100.0,
                current_step="completed",
                completed_at=datetime.utcnow()
            )
            
            # Log multi-dataset statistics
            dataset_counts = {}
            for img_record in image_records:
                dataset_name = img_record["dataset_name"]
                dataset_counts[dataset_name] = dataset_counts.get(dataset_name, 0) + 1
            
            logger.info(f"✅ MULTI-DATASET RELEASE GENERATION COMPLETED: {release_id}")
            logger.info(f"   📊 Dataset breakdown:")
            for dataset_name, count in dataset_counts.items():
                logger.info(f"      {dataset_name}: {count} images")
            logger.info(f"   📈 Total original images: {len(image_paths)}")
            logger.info(f"   🎨 Total generated images: {total_generated}")
            logger.info(f"   📁 Export path: {export_path}")
            
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
    
    def _cleanup_staging_directory(self, staging_dir: str) -> None:
        """
        Clean up staging directory after processing
        
        This removes the temporary copied images since we copied (not moved) them
        """
        try:
            if os.path.exists(staging_dir):
                shutil.rmtree(staging_dir)
                logger.info(f"🧹 Cleaned up staging directory: {staging_dir}")
        except Exception as e:
            logger.warning(f"Failed to cleanup staging directory {staging_dir}: {e}")
    
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
    
    def _select_optimal_export_format(self, generation_results: Dict[str, List[Dict]], 
                                     user_format: str, task_type: str) -> str:
        """
        Intelligently select the optimal export format based on:
        - Task type (object_detection vs segmentation)
        - Available annotation types (bbox vs polygons)
        - User preference
        - Project requirements
        """
        # If user explicitly chose a format, respect it
        if user_format and user_format != "auto":
            logger.info(f"Using user-selected export format: {user_format}")
            return user_format
        
        # Analyze available annotations to determine best format
        has_polygons = False
        has_bboxes = False
        
        for original_image, results in generation_results.items():
            for result in results:
                if 'annotations' in result:
                    for ann in result['annotations']:
                        if ann.get('type') == 'polygon' and 'points' in ann:
                            has_polygons = True
                        elif ann.get('type') == 'bbox' or 'bbox' in ann:
                            has_bboxes = True
        
        # Smart format selection logic
        if task_type == "segmentation":
            if has_polygons:
                optimal_format = "yolo_segmentation"
                reason = "Task requires segmentation and polygons are available"
            else:
                optimal_format = "coco"
                reason = "Task requires segmentation but only bboxes available - COCO supports both"
        
        elif task_type == "object_detection":
            if has_bboxes and not has_polygons:
                optimal_format = "yolo_detection"
                reason = "Task is detection and bboxes are available"
            elif has_polygons:
                optimal_format = "coco"
                reason = "Task is detection but polygons available - COCO supports both"
            else:
                optimal_format = "yolo_detection"
                reason = "Task is detection - defaulting to YOLO Detection"
        
        else:
            # Unknown task type - use COCO as it's most flexible
            optimal_format = "coco"
            reason = "Unknown task type - using flexible COCO format"
        
        logger.info(f"Intelligently selected export format: {optimal_format} ({reason})")
        return optimal_format
    
    def _generate_export_files(self, release_id: int, generation_results: Dict[str, List[Dict]], 
                              export_format: str, task_type: str) -> Optional[str]:
        """
        Generate export files with transformed annotations
        
        Args:
            release_id: Release ID
            generation_results: Results from image generation with annotations
            export_format: Export format (yolo_detection, yolo_segmentation, coco, etc.)
            task_type: Task type (object_detection, segmentation)
        
        Returns:
            Path to generated export files
        """
        try:
            logger.info(f"Generating export files for release {release_id} in format {export_format}")
            
            # Prepare export data from generation results
            export_data = self._prepare_export_data(generation_results, task_type)
            
            # Create export request with task type and project type
            export_request = ExportRequest(
                annotations=export_data['annotations'],
                images=export_data['images'],
                classes=export_data['classes'],
                format=export_format,
                include_images=True,
                dataset_name=f"release_{release_id}",
                export_settings={},
                task_type=task_type,
                project_type="Object Detection"  # Could be enhanced to get from project settings
            )
            
            # Generate export files based on format
            export_path = self._create_export_files(export_request, release_id)
            
            logger.info(f"Successfully generated export files at {export_path}")
            return export_path
            
        except Exception as e:
            logger.error(f"Failed to generate export files for release {release_id}: {str(e)}")
            return None
    
    def _prepare_export_data(self, generation_results: Dict[str, List[Dict]], task_type: str) -> Dict[str, Any]:
        """
        Prepare export data from generation results with transformed annotations
        """
        images = []
        annotations = []
        classes_set = set()
        annotation_id = 1
        
        for original_image, results in generation_results.items():
            for result in results:
                # Extract image info
                image_info = {
                    'id': len(images),
                    'name': result.get('output_filename', f"image_{len(images)}.jpg"),
                    'width': result.get('image_width', 640),
                    'height': result.get('image_height', 480),
                    'file_path': result.get('output_path', '')
                }
                images.append(image_info)
                
                # Extract transformed annotations
                if 'annotations' in result:
                    for ann in result['annotations']:
                        # Add class to set
                        class_name = ann.get('class_name', 'unknown')
                        classes_set.add(class_name)
                        
                        # Create annotation entry
                        annotation = {
                            'id': annotation_id,
                            'image_id': image_info['id'],
                            'class_id': ann.get('class_id', 0),
                            'class_name': class_name,
                            'type': ann.get('type', 'bbox'),
                            'confidence': ann.get('confidence', 1.0)
                        }
                        
                        # Add geometry based on type
                        if ann.get('type') == 'polygon' and 'points' in ann:
                            annotation['points'] = ann['points']
                        elif 'bbox' in ann:
                            annotation['bbox'] = ann['bbox']
                        
                        annotations.append(annotation)
                        annotation_id += 1
        
        # Create classes list with unified IDs
        classes = []
        for i, class_name in enumerate(sorted(classes_set)):
            classes.append({
                'id': i,
                'name': class_name,
                'supercategory': 'object'
            })
        
        # Update class IDs in annotations to match unified classes
        class_name_to_id = {cls['name']: cls['id'] for cls in classes}
        for ann in annotations:
            ann['class_id'] = class_name_to_id.get(ann['class_name'], 0)
        
        return {
            'images': images,
            'annotations': annotations,
            'classes': classes
        }
    
    def _create_export_files(self, export_request: ExportRequest, release_id: int) -> str:
        """
        Create export files using the export system
        """
        import tempfile
        import zipfile
        import shutil
        
        # Create temporary directory for export
        temp_dir = tempfile.mkdtemp(prefix=f"release_{release_id}_")
        export_dir = os.path.join(temp_dir, f"release_{release_id}_export")
        os.makedirs(export_dir, exist_ok=True)
        
        try:
            # Generate export files based on format
            if export_request.format in ['yolo_detection', 'yolo_segmentation']:
                files = ExportFormats.export_yolo_detection(export_request) if export_request.format == 'yolo_detection' else ExportFormats.export_yolo_segmentation(export_request)
                
                # Write YOLO files
                for filename, content in files.items():
                    file_path = os.path.join(export_dir, filename)
                    with open(file_path, 'w') as f:
                        f.write(content)
                        
            elif export_request.format == 'coco':
                coco_data = ExportFormats.export_coco(export_request)
                
                # Write COCO JSON
                coco_path = os.path.join(export_dir, 'annotations.json')
                with open(coco_path, 'w') as f:
                    json.dump(coco_data, f, indent=2)
                    
            elif export_request.format == 'pascal_voc':
                xml_files = ExportFormats.export_pascal_voc(export_request)
                
                # Write Pascal VOC XML files
                for filename, xml_content in xml_files.items():
                    file_path = os.path.join(export_dir, filename)
                    with open(file_path, 'w') as f:
                        f.write(xml_content)
                        
            elif export_request.format == 'csv':
                csv_content = ExportFormats.export_csv(export_request)
                
                # Write CSV file
                csv_path = os.path.join(export_dir, 'annotations.csv')
                with open(csv_path, 'w') as f:
                    f.write(csv_content)
            
            # Copy images if requested
            if export_request.include_images:
                images_dir = os.path.join(export_dir, 'images')
                os.makedirs(images_dir, exist_ok=True)
                
                for img in export_request.images:
                    src_path = img.get('file_path', '')
                    if src_path and os.path.exists(src_path):
                        dst_path = os.path.join(images_dir, img['name'])
                        shutil.copy2(src_path, dst_path)
            
            # Create final export directory in releases
            final_export_dir = os.path.join("releases", f"release_{release_id}", "export")
            os.makedirs(final_export_dir, exist_ok=True)
            
            # Move export files to final location
            for item in os.listdir(export_dir):
                src = os.path.join(export_dir, item)
                dst = os.path.join(final_export_dir, item)
                if os.path.isdir(src):
                    shutil.copytree(src, dst, dirs_exist_ok=True)
                else:
                    shutil.copy2(src, dst)
            
            # Clean up temp directory
            shutil.rmtree(temp_dir)
            
            return final_export_dir
            
        except Exception as e:
            # Clean up on error
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            raise e
    
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
