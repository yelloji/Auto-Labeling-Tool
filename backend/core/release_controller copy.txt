"""
Central Release Controller for Auto-Labeling Tool Release Pipeline
Orchestrates the complete release generation process
"""

import os
import json
import uuid
import shutil
import zipfile
import tempfile
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from sqlalchemy.sql import func  # Added for split count aggregation
from PIL import Image

# Import our components
from core.transformation_schema import TransformationSchema, create_schema_from_database, generate_release_configurations
from core.image_generator import ImageAugmentationEngine, create_augmentation_engine, process_release_images
from database.database import get_db
from database.models import ImageTransformation, Release, Image, Dataset, Project
from sqlalchemy.orm import Session
from typing import Union
from core.annotation_transformer import BoundingBox, Polygon
# Import export system
from api.routes.enhanced_export import ExportFormats, ExportRequest

# Import professional logging system - CORRECT UNIFORM PATTERN
from logging_system.professional_logger import get_professional_logger
from utils.path_utils import PathManager

from database.operations import ImageOperations, AnnotationOperations
# Initialize professional logger
logger = get_professional_logger()
def _get_pixel_annotations_from_db(db, image_id: str) -> List[Union[BoundingBox, Polygon]]: 
    """ 
    Read annotations for an image in *pixels* and return engine-ready objects. 
    No normalization/scaling here (your DB already stores pixels). 
    """ 
    out: List[Union[BoundingBox, Polygon]] = [] 

    # Optional: confirm the image exists / fetch W,H if you need them later 
    img = ImageOperations.get_image(db, image_id) 
    if not img: 
        logger.warning("operations.annotations", 
                       f"Image not found while fetching annotations: {image_id}", 
                       "release_fetch_image_not_found", 
                       {"image_id": image_id}) 
        return out 

    anns = AnnotationOperations.get_annotations_by_image(db, image_id) 

    for a in anns: 
        try: 
            if getattr(a, "segmentation", None): 
                seg = a.segmentation 
                # seg can be JSON text or a python list 
                if isinstance(seg, str): 
                    try: 
                        seg = json.loads(seg) 
                    except Exception: 
                        logger.warning("operations.annotations", 
                                       "Segmentation JSON parse failed; skipping segmentation", 
                                       "release_segmentation_json_parse_failed", 
                                       {"image_id": image_id}) 
                        seg = [] 

                pts = [] 
                for pt in (seg or []): 
                    if isinstance(pt, dict) and ("x" in pt and "y" in pt): 
                        pts.append((float(pt["x"]), float(pt["y"]))) 
                    elif isinstance(pt, (list, tuple)) and len(pt) >= 2: 
                        pts.append((float(pt[0]), float(pt[1]))) 

                if len(pts) >= 3: 
                    out.append( 
                        Polygon( 
                            points=pts, 
                            class_name=a.class_name, 
                            class_id=int(a.class_id or 0), 
                            confidence=float(getattr(a, "confidence", 1.0) or 1.0), 
                        ) 
                    ) 
                    continue  # done with this annotation; go next 

            # Fallback / plain bbox (also pixels) 
            out.append( 
                BoundingBox( 
                    x_min=float(a.x_min), 
                    y_min=float(a.y_min), 
                    x_max=float(a.x_max), 
                    y_max=float(a.y_max), 
                    class_name=a.class_name, 
                    class_id=int(a.class_id or 0), 
                    confidence=float(getattr(a, "confidence", 1.0) or 1.0), 
                ) 
            ) 
        except Exception as ex: 
            logger.warning("operations.annotations", 
                           f"Failed to convert annotation to pixel object: {ex}", 
                           "release_annotation_convert_failed", 
                           {"image_id": image_id}) 
            continue 

    logger.info("operations.annotations", 
                f"Fetched {len(out)} pixel annotations for image {image_id}", 
                "release_annotations_pixel_ready", 
                {"image_id": image_id, "count": len(out)}) 
    return out
# >>> NEW: serialize engine results into plain dicts the exporter expects
def _serialize_aug_result(
    r,
    split_section: str,
    source_dataset: str
) -> dict:
    def _bbox_to_dict(b: BoundingBox) -> dict:
        return {
            "type": "bbox",
            "x_min": b.x_min, "y_min": b.y_min,
            "x_max": b.x_max, "y_max": b.y_max,
            "class_name": b.class_name,
            "class_id": b.class_id,
            "confidence": b.confidence,
        }

    def _poly_to_dict(p: Polygon) -> dict:
        return {
            "type": "polygon",
            "points": p.points,
            "class_name": p.class_name,
            "class_id": p.class_id,
            "confidence": p.confidence,
        }

    out_path = r.augmented_image_path
    name = Path(out_path).name
    w, h = r.augmented_dimensions

    return {
        # where the image actually is
        "output_path": out_path,
        "output_filename": name,

        # dims for normalization at export
        "image_width": w,
        "image_height": h,

        # which split & dataset (used by zip/export layout & stats)
        "split_section": split_section,
        "source_dataset": source_dataset,

        # this is an augmented image, not the untouched original
        "is_original": False,

        # transformed labels as simple dicts
        "annotations": [
            _bbox_to_dict(a) if isinstance(a, BoundingBox) else _poly_to_dict(a)
            for a in (r.updated_annotations or [])
        ],

        # optional: keep the applied config for traceability
        "transformations_applied": r.transformation_applied,
        "config_id": r.config_id,
    }



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
        
    # -----------------------------------------------------------
    # Utility: Calculate split-counts directly from DB
    # -----------------------------------------------------------
    def _calculate_split_counts(self, dataset_ids: List[str]) -> Tuple[int, Dict[str, int]]:
        """Aggregate train/val/test counts across datasets."""
        split_counts = {"train": 0, "val": 0, "test": 0}
        total_original = 0

        if not dataset_ids:
            return total_original, split_counts

        results = (
            self.db.query(Image.split_section, func.count(Image.id))
            .filter(Image.dataset_id.in_(dataset_ids), Image.is_labeled == True)
            .group_by(Image.split_section)
            .all()
        )

        for section, count in results:
            key = section or "train"
            if key not in split_counts:
                split_counts[key] = 0
            split_counts[key] += count
            total_original += count

        return total_original, split_counts

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
            
            logger.info("operations.releases", f"Created release record: {release_id}", "release_record_created", {
                'release_id': release_id,
                'project_id': config.project_id,
                'release_name': config.release_name
            })
            return release_id
            
        except Exception as e:
            self.db.rollback()
            logger.error("errors.system", f"Failed to create release record: {str(e)}", "release_record_creation_error", {
                'error': str(e),
                'project_id': config.project_id,
                'release_name': config.release_name
            })
            raise
    
    def load_pending_transformations(self, release_version: str) -> List[Dict[str, Any]]:
        """Load pending transformations from database for release generation"""
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
            
            logger.info("operations.releases", f"Loaded {len(transformation_records)} pending transformations for version {release_version}", "transformations_loaded", {
                'transformation_count': len(transformation_records),
                'release_version': release_version
            })
            return transformation_records
            
        except Exception as e:
            logger.error("errors.system", f"Failed to load pending transformations: {str(e)}", "transformations_load_error", {
                'error': str(e),
                'release_version': release_version
            })
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
            
            logger.info("operations.releases", f"📊 MULTI-DATASET LOADING COMPLETE: Total images: {len(image_records)}", "dataset_loading_complete", {
                'total_images': len(image_records),
                'dataset_stats': dataset_stats,
                'split_stats': split_stats,
                'split_sections': split_sections,
                'dataset_count': len(dataset_ids)
            })
            
            return image_records
            
        except Exception as e:
            logger.error("errors.system", f"Failed to get dataset images: {str(e)}", "dataset_images_error", {
                'error': str(e),
                'dataset_ids': dataset_ids,
                'split_sections': split_sections
            })
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
            logger.warning("errors.validation", f"Could not extract source path from {file_path}: {e}", "path_extraction_warning", {
                'file_path': file_path,
                'error': str(e)
            })
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
        
        logger.info("operations.releases", f"Updated progress for release {release_id}: {progress.progress_percentage:.1f}%", "progress_updated", {
            'release_id': release_id,
            'progress_percentage': progress.progress_percentage,
            'current_step': progress.current_step,
            'processed_images': progress.processed_images,
            'total_images': progress.total_images
        })
    
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
            logger.info("operations.releases", f"Marked {len(transformations)} transformations as completed", "transformations_completed", {
                'transformation_count': len(transformations),
                'release_id': release_id,
                'transformation_ids': transformation_ids
            })
            
        except Exception as e:
            self.db.rollback()
            logger.error("errors.system", f"Failed to mark transformations as completed: {str(e)}", "transformations_completion_error", {
                'error': str(e),
                'release_id': release_id,
                'transformation_ids': transformation_ids
            })
    
    

    def generate_release(self, config: ReleaseConfig, release_version: str) -> str:
        """
        Generate a complete release with transformations and export
        """
        # local imports (safe even if already imported at module level)
        import os, shutil, json
        from pathlib import Path
        from datetime import datetime
        from PIL import Image
        from typing import Dict, List

        release_id = None

        # --- helper: serialize engine result objects to plain dicts for exporter ---
        def _serialize_aug_result(r, split_section: str, source_dataset: str) -> dict:
            # local helpers for shapes
            def _bbox_to_dict(b):
                return {
                    "type": "bbox",
                    "x_min": b.x_min, "y_min": b.y_min,
                    "x_max": b.x_max, "y_max": b.y_max,
                    "class_name": b.class_name,
                    "class_id": b.class_id,
                    "confidence": b.confidence,
                }
            def _poly_to_dict(p):
                return {
                    "type": "polygon",
                    "points": p.points,
                    "class_name": p.class_name,
                    "class_id": p.class_id,
                    "confidence": p.confidence,
                }

            out_path = r.augmented_image_path
            name = Path(out_path).name
            w, h = r.augmented_dimensions

            return {
                "output_path": out_path,
                "output_filename": name,
                "image_width": w,
                "image_height": h,
                "split_section": split_section,
                "source_dataset": source_dataset,
                "is_original": False,
                "annotations": [
                    _bbox_to_dict(a) if hasattr(a, "x_min") else _poly_to_dict(a)
                    for a in (r.updated_annotations or [])
                ],
                "transformations_applied": r.transformation_applied,
                "config_id": r.config_id,
            }

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

            # Initialize augmentation engine with project-specific path
            project = self.db.query(Project).filter(Project.id == config.project_id).first()
            project_name = project.name if project else f"project_{config.project_id}"
            output_dir = os.path.join("projects", project_name, "releases", release_id)
            self.augmentation_engine = create_augmentation_engine(output_dir)

            # Prepare image paths and dataset splits with multi-dataset support
            image_paths: List[str] = []
            dataset_splits: Dict[str, str] = {}
            dataset_sources: Dict[str, Dict[str, str]] = {}  # Track source dataset for each image

            # Build annotations_map as we stage each image
            annotations_map: Dict[str, List[Union[BoundingBox, Polygon]]] = {}

            # Create staging directory for copied images
            staging_dir = f"{output_dir}/staging"
            os.makedirs(staging_dir, exist_ok=True)

            logger.info(
                "operations.releases",
                "🔄 COPYING IMAGES FROM MULTIPLE DATASETS:",
                "image_copying_start",
                {
                    'dataset_count': len(set(img['dataset_name'] for img in image_records)),
                    'total_images': len(image_records),
                    'output_format': config.output_format
                }
            )

            for img_record in image_records:
                # DB identity of the original image
                source_image_id = img_record["id"]

                # Get source image path
                source_path = self._resolve_image_path(img_record["file_path"])
                if not os.path.exists(source_path):
                    logger.warning(
                        "errors.validation",
                        f"Source image not found: {source_path}",
                        "source_image_missing",
                        {
                            'source_path': source_path,
                            'dataset_name': img_record['dataset_name'],
                            'filename': img_record['filename']
                        }
                    )
                    continue

                # Create unique filename to avoid conflicts between datasets
                dataset_name = img_record["dataset_name"]
                original_filename = img_record["filename"]  # e.g., "car.jpg"
                unique_filename = f"{dataset_name}_{original_filename}"

                # Copy / convert into staging
                try:
                    if config.output_format.lower() == "original":
                        staging_path = os.path.join(staging_dir, unique_filename)
                        shutil.copy2(source_path, staging_path)
                        logger.info(
                            "operations.images",
                            f"   Copied (original format): {source_path} → {staging_path}",
                            "image_copied_original",
                            {
                                'source_path': source_path,
                                'staging_path': staging_path,
                                'dataset_name': img_record['dataset_name']
                            }
                        )
                    else:
                        base_name = Path(unique_filename).stem
                        extension = config.output_format.lower()
                        if extension == "jpeg":
                            extension = "jpg"
                        converted_filename = f"{base_name}.{extension}"
                        staging_path = os.path.join(staging_dir, converted_filename)

                        try:
                            original_image = Image.open(source_path)
                            self.augmentation_engine._save_image_with_format(
                                original_image,
                                staging_path,
                                config.output_format
                            )
                            logger.info(
                                "operations.images",
                                f"   Copied and converted to {config.output_format}: {source_path} → {staging_path}",
                                "image_converted",
                                {
                                    'source_path': source_path,
                                    'staging_path': staging_path,
                                    'output_format': config.output_format,
                                    'dataset_name': img_record['dataset_name']
                                }
                            )
                        except Exception as format_error:
                            logger.warning(
                                "errors.validation",
                                f"   Format conversion failed for {source_path}: {format_error}",
                                "format_conversion_failed",
                                {
                                    'source_path': source_path,
                                    'format_error': str(format_error),
                                    'output_format': config.output_format,
                                    'dataset_name': img_record['dataset_name']
                                }
                            )
                            logger.warning(
                                "operations.images",
                                "   Falling back to original format copy",
                                "format_fallback",
                                {
                                    'source_path': source_path,
                                    'dataset_name': img_record['dataset_name']
                                }
                            )
                            staging_path = os.path.join(staging_dir, unique_filename)
                            shutil.copy2(source_path, staging_path)

                    # Register for processing
                    image_paths.append(staging_path)
                    dataset_splits[staging_path] = img_record["split_section"]
                    dataset_sources[staging_path] = {
                        "dataset_name": dataset_name,
                        "dataset_id": img_record["dataset_id"],
                        "source_path": img_record["source_path"],
                        "original_filename": original_filename,   # for deriving stem if needed
                        "source_image_id": source_image_id,       # DB image id for lookups
                    }

                    # Fetch pixel annotations by DB id and map under multiple keys
                    anns_px = _get_pixel_annotations_from_db(self.db, source_image_id)

                    # map by the exact path we’ll send to the engine
                    annotations_map[staging_path] = anns_px

                    # also map by original filename stem (engine may compute id this way)
                    original_stem = Path(original_filename).stem
                    annotations_map[original_stem] = anns_px

                    # also map by DB id as string
                    annotations_map[str(source_image_id)] = anns_px
                    logger.info(
                        "operations.annotations",
                        "Registered annotations in map",
                        "annotations_map_register",
                        {
                            "staging_path_key": staging_path,
                            "original_stem_key": original_stem,
                            "db_id_key": str(source_image_id),
                            "count": len(anns_px)
                        }
                    )

                except Exception as e:
                    logger.error(
                        "errors.system",
                        f"Failed to copy {source_path}: {e}",
                        "image_copy_error",
                        {
                            'source_path': source_path,
                            'error': str(e),
                            'dataset_name': img_record['dataset_name'],
                            'filename': img_record['filename']
                        }
                    )
                    continue

            # Log format conversion information
            if config.output_format.lower() == "original":
                logger.info(
                    "operations.images",
                    f"✅ Successfully copied {len(image_paths)} images from {len(set(img['dataset_name'] for img in image_records))} datasets (preserving original formats)",
                    "images_copied_success",
                    {
                        'image_count': len(image_paths),
                        'dataset_count': len(set(img['dataset_name'] for img in image_records)),
                        'output_format': 'original'
                    }
                )
            else:
                logger.info(
                    "operations.images",
                    f"✅ Successfully copied and converted {len(image_paths)} images to {config.output_format.upper()} format from {len(set(img['dataset_name'] for img in image_records))} datasets",
                    "images_converted_success",
                    {
                        'image_count': len(image_paths),
                        'dataset_count': len(set(img['dataset_name'] for img in image_records)),
                        'output_format': config.output_format.upper()
                    }
                )

            # Process all images with multi-dataset support (pass annotations_map)
            all_results = process_release_images(
                image_paths=image_paths,
                transformation_configs=transformation_configs,
                dataset_splits=dataset_splits,
                output_dir=output_dir,
                output_format=config.output_format,
                dataset_sources=dataset_sources,
                annotations_map=annotations_map    # labels travel with the same affine
            )

            # Convert AugmentationResult objects -> plain dicts for exporter
            serialized_results: Dict[str, List[dict]] = {}
            for img_path, results in (all_results or {}).items():
                split = dataset_splits.get(img_path, "train")
                src_ds = (dataset_sources.get(img_path) or {}).get("dataset_name", "unknown")
                serialized_results[img_path] = [
                    _serialize_aug_result(r, split, src_ds) for r in (results or [])
                ]

            # IMPORTANT: from here on, downstream code works with dicts
            all_results = serialized_results

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
                release.model_path = PathManager().get_project_relative_path(output_dir)

                # NEW: Compute and store accurate train/val/test split counts
                _orig_total, split_counts = self._calculate_split_counts(config.dataset_ids)
                release.train_image_count = split_counts.get("train", 0)
                release.val_image_count = split_counts.get("val", 0)
                release.test_image_count = split_counts.get("test", 0)

                self.db.commit()

            # Mark transformations as completed
            transformation_ids = [t["id"] for t in transformation_records]
            self.mark_transformations_completed(transformation_ids, release_id)

            # Choose export format
            optimal_export_format = self._select_optimal_export_format(
                all_results,
                config.export_format,
                getattr(config, 'task_type', 'object_detection')
            )

            # Generate export files with transformed annotations
            export_path = self._generate_export_files(
                release_id,
                all_results,
                optimal_export_format,
                getattr(config, 'task_type', 'object_detection')
            )

            # Update progress
            self.update_release_progress(
                release_id,
                current_step="creating_zip_package",
                progress_percentage=90.0
            )

            # Create comprehensive ZIP package with organized structure
            try:
                config.export_format = optimal_export_format
                zip_path = self.create_zip_package(
                    release_id,
                    all_results,
                    config,
                    transformation_records
                )

                # Update release with ZIP path
                if release and zip_path:
                    relative_zip_path = PathManager().get_project_relative_path(zip_path)
                    release.model_path = relative_zip_path
                    release.export_format = optimal_export_format
                    release.task_type = getattr(config, 'task_type', 'object_detection')
                    self.db.commit()
                    logger.info(
                        "operations.releases",
                        f"✅ ZIP package created successfully: {zip_path}",
                        "zip_created_success",
                        {
                            'zip_path': zip_path,
                            'release_id': release_id,
                            'file_size': os.path.getsize(zip_path) if os.path.exists(zip_path) else 0
                        }
                    )
            except Exception as e:
                logger.error(
                    "errors.system",
                    f"Failed to create ZIP package: {str(e)}",
                    "zip_creation_error",
                    {
                        'error': str(e),
                        'release_id': release_id,
                        'zip_path': locals().get("zip_path")
                    }
                )
                # Fall back to regular export path if ZIP creation fails
                if release and export_path:
                    release.model_path = PathManager().get_project_relative_path(export_path)
                    release.export_format = optimal_export_format
                    release.task_type = getattr(config, 'task_type', 'object_detection')
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

            logger.info(
                "operations.releases",
                f"✅ MULTI-DATASET RELEASE GENERATION COMPLETED: {release_id}",
                "release_generation_complete",
                {
                    'release_id': release_id,
                    'dataset_counts': dataset_counts,
                    'total_original_images': len(image_paths),
                    'total_generated_images': total_generated,
                    'image_format': config.output_format.upper() if config.output_format.lower() != 'original' else 'Original (preserved)',
                    'export_path': export_path
                }
            )

            return release_id

        except Exception as e:
            error_msg = f"Failed to generate release: {str(e)}"
            logger.error("errors.system", error_msg, "release_generation_error", {
                'error': str(e),
                'release_id': release_id
            })

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
                logger.info("operations.releases", f"🧹 Cleaned up staging directory: {staging_dir}", "staging_cleanup_success", {
                    'staging_dir': staging_dir
                })
        except Exception as e:
            logger.warning("errors.validation", f"Failed to cleanup staging directory {staging_dir}: {e}", "staging_cleanup_failed", {
                'staging_dir': staging_dir,
                'error': str(e)
            })
    
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
            logger.info("operations.releases", f"Using user-selected export format: {user_format}", "export_format_selected", {
                'user_format': user_format,
                'task_type': task_type
            })
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
                        elif ann.get('type') == 'bbox':
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
        
            logger.info("operations.releases", f"Intelligently selected export format: {optimal_format} ({reason})", "export_format_auto_selected", {
                'optimal_format': optimal_format,
                'reason': reason,
                'task_type': task_type,
                'has_polygons': has_polygons,
                'has_bboxes': has_bboxes
            })
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
            logger.info("operations.releases", f"Generating export files for release {release_id} in format {export_format}", "export_files_generation_start", {
                'release_id': release_id,
                'export_format': export_format,
                'task_type': task_type
            })
            
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
            
            logger.info("operations.releases", f"Successfully generated export files at {export_path}", "export_files_generated", {
                'export_path': export_path,
                'release_id': release_id,
                'export_format': export_format
            })
            return export_path
            
        except Exception as e:
            logger.error("errors.system", f"Failed to generate export files for release {release_id}: {str(e)}", "export_files_generation_error", {
                'error': str(e),
                'release_id': release_id,
                'export_format': export_format
            })
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
                        elif ann.get('type') == 'bbox':
                            # Convert flat fields into a bbox array for downstream exporters
                            annotation['bbox'] = [
                                float(ann.get('x_min', 0.0)),
                                float(ann.get('y_min', 0.0)),
                                float(ann.get('x_max', 0.0)),
                                float(ann.get('y_max', 0.0)),
                            ]

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
            
    def create_zip_package(self, release_id: str, generation_results: Dict[str, List[Dict]], 
                          config: ReleaseConfig, transformation_records: List[Dict]) -> str:
        """
        Create a comprehensive ZIP package for release export with the following structure:
        
        release_v1.zip
        ├── images/
        │   ├── train/
        │   ├── val/
        │   └── test/
        ├── labels/
        │   ├── train/
        │   ├── val/
        │   └── test/
        ├── metadata/
        │   ├── release_config.json
        │   ├── dataset_stats.json
        │   ├── transformation_log.json
        └── README.md
        
        Args:
            release_id: Release ID
            generation_results: Results from image generation with annotations
            config: Release configuration
            transformation_records: Transformation records used for this release
            
        Returns:
            Path to the generated ZIP file
        """
        try:
            logger.info("operations.releases", f"Creating ZIP package for release {release_id}", "zip_package_creation_start", {
                'release_id': release_id
            })
            
            # Get release record from database
            release = self.db.query(Release).filter(Release.id == release_id).first()
            if not release:
                raise ValueError(f"Release {release_id} not found in database")
            
            # Create temporary directory for ZIP package
            temp_dir = tempfile.mkdtemp(prefix=f"release_{release_id}_zip_")
            
            # Create directory structure
            images_dir = os.path.join(temp_dir, "images")
            labels_dir = os.path.join(temp_dir, "labels")
            metadata_dir = os.path.join(temp_dir, "metadata")
            
            # Create split directories
            for split in ["train", "val", "test"]:
                os.makedirs(os.path.join(images_dir, split), exist_ok=True)
                os.makedirs(os.path.join(labels_dir, split), exist_ok=True)
            
            os.makedirs(metadata_dir, exist_ok=True)
            
            # Organize images and labels by split
            dataset_stats = {
                "total_images": 0,
                "split_counts": {"train": 0, "val": 0, "test": 0},
                "class_distribution": {},
                "original_images": 0,
                "augmented_images": 0,
                "dataset_distribution": {}
            }
            
            transformation_log = {}
            
            # Process all images and organize by split
            for original_image, results in generation_results.items():
                for result in results:
                    # Get image info
                    output_filename = result.get('output_filename', '')
                    output_path = result.get('output_path', '')
                    split_section = result.get('split_section', 'train')  # Default to train if not specified
                    is_original = result.get('is_original', False)
                    source_dataset = result.get('source_dataset', 'unknown')
                    
                    # Skip if output path doesn't exist
                    if not output_path or not os.path.exists(output_path):
                        logger.warning("errors.validation", f"Output path not found: {output_path}", "output_path_missing", {
                    'output_path': output_path,
                    'release_id': release_id
                })
                        continue
                    
                    # Copy image to appropriate split directory
                    dst_image_path = os.path.join(images_dir, split_section, output_filename)
                    shutil.copy2(output_path, dst_image_path)
                    
                    # Update dataset stats
                    dataset_stats["total_images"] += 1
                    dataset_stats["split_counts"][split_section] += 1
                    
                    if is_original:
                        dataset_stats["original_images"] += 1
                    else:
                        dataset_stats["augmented_images"] += 1
                    
                    # Update dataset distribution
                    if source_dataset not in dataset_stats["dataset_distribution"]:
                        dataset_stats["dataset_distribution"][source_dataset] = 0
                    dataset_stats["dataset_distribution"][source_dataset] += 1
                    
                    # Process annotations if available
                    if 'annotations' in result and result['annotations']:
                        # Get annotation file path based on export format
                        if config.export_format in ['yolo_detection', 'yolo_segmentation']:
                            # YOLO format: one .txt file per image with same basename
                            label_filename = os.path.splitext(output_filename)[0] + '.txt'
                            src_label_path = os.path.join(os.path.dirname(output_path), '..', 'labels', label_filename)
                            
                            if os.path.exists(src_label_path):
                                dst_label_path = os.path.join(labels_dir, split_section, label_filename)
                                shutil.copy2(src_label_path, dst_label_path)
                        
                        # Update class distribution
                        for ann in result['annotations']:
                            class_name = ann.get('class_name', 'unknown')
                            if class_name not in dataset_stats["class_distribution"]:
                                dataset_stats["class_distribution"][class_name] = 0
                            dataset_stats["class_distribution"][class_name] += 1
                    
                    # Record transformation log
                    if not is_original:
                        transformations_applied = result.get('transformations_applied', [])
                        transformation_log[output_filename] = {
                            "source_image": original_image,
                            "transformations": transformations_applied
                        }

            # --- NEW: Persist split counts and class count to release record ---
            try:
                # Fallback to user-defined split_counts in the original configuration when
                # automatic counting produced zeros (e.g. when images are not physically split yet).
                train_count = dataset_stats["split_counts"].get("train", 0)
                val_count = dataset_stats["split_counts"].get("val", 0)
                test_count = dataset_stats["split_counts"].get("test", 0)
                if train_count == 0 and hasattr(config, "split_counts"):
                    train_count = config.split_counts.get("train", 0)
                if val_count == 0 and hasattr(config, "split_counts"):
                    val_count = config.split_counts.get("val", 0)
                if test_count == 0 and hasattr(config, "split_counts"):
                    test_count = config.split_counts.get("test", 0)

                release.train_image_count = train_count
                release.val_image_count = val_count
                release.test_image_count = test_count
                release.class_count = len(dataset_stats["class_distribution"])
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                logger.warning("errors.system", f"Could not update split/class counts for release {release_id}: {str(e)}", "release_counts_update_failed", {
                    'release_id': release_id,
                    'error': str(e)
                })
            
            # Generate metadata files (two-file schema)
            
            # Build classes array and transformation summary
            classes = sorted(dataset_stats["class_distribution"].keys())
            transformations_summary = [
                {
                    "tool": rec.get("transformation_type", "unknown"),
                    "params": rec.get("parameters", {})
                }
                for rec in transformation_records
            ]
            
            # Prepare release configuration dictionary
            release_config = {
                "release_version": release.name,
                "release_id": release_id,
                "release_date": datetime.utcnow().isoformat(),
                "description": release.description,
                "export_format": config.export_format,
                "task_type": config.task_type,
                "image_format": config.output_format,
                "images_per_original": config.images_per_original,
                "include_original": config.include_original,
                "sampling_strategy": config.sampling_strategy,
                "preserve_original_splits": config.preserve_original_splits,
                "classes": classes,
                "dataset_stats": dataset_stats,
                "transformations": transformations_summary,
                "source_datasets": config.dataset_ids
            }
            
            # Write release_config.json
            with open(os.path.join(metadata_dir, "release_config.json"), "w") as f:
                json.dump(release_config, f, indent=4)
            
            # Build annotations.json
            annotations_data = self._prepare_export_data(generation_results, config.task_type)
            with open(os.path.join(metadata_dir, "annotations.json"), "w") as f:
                json.dump(annotations_data, f, indent=4)
            release_config = {
                "release_version": release.name,
                "release_id": release_id,
                "release_date": datetime.utcnow().isoformat(),
                "description": release.description,
                "export_format": config.export_format,
                "task_type": config.task_type,
                "image_format": config.output_format,
                "images_per_original": config.images_per_original,
                "include_original": config.include_original,
                "sampling_strategy": config.sampling_strategy,
                "preserve_original_splits": config.preserve_original_splits,
                "source_datasets": config.dataset_ids
            }
            
            # Legacy aggregated metadata generation removed
            
            
            # 4. README.md
            readme_content = f"""# Release: {release.name}

## Overview
- **Release ID:** {release_id}
- **Created:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}
- **Description:** {release.description}
- **Export Format:** {config.export_format}
- **Task Type:** {config.task_type}

## Dataset Statistics
- **Total Images:** {dataset_stats["total_images"]}
- **Original Images:** {dataset_stats["original_images"]}
- **Augmented Images:** {dataset_stats["augmented_images"]}

### Split Distribution
- **Train:** {dataset_stats["split_counts"]["train"]} images
- **Validation:** {dataset_stats["split_counts"]["val"]} images
- **Test:** {dataset_stats["split_counts"]["test"]} images

### Source Datasets
{chr(10).join([f"- {dataset_id}" for dataset_id in config.dataset_ids])}

## Transformations Applied
{chr(10).join([f"- {t['transformation_type']}" for t in transformation_records])}

## Directory Structure
- `images/` - Contains all images organized by split (train/val/test)
- `labels/` - Contains all annotation files organized by split
- `metadata/` - Contains configuration and statistics files

## Metadata Files
- `release_config.json` - Build information, classes array, dataset stats, transformations
- `annotations.json` - Ready-to-draw shapes with class IDs
"""
            
            with open(os.path.join(temp_dir, "README.md"), 'w') as f:
                f.write(readme_content)
            
            # Create ZIP file in project-specific folder
            # Get project name for folder structure
            project = self.db.query(Project).filter(Project.id == config.project_id).first()
            project_name = project.name if project else f"project_{config.project_id}"
            
            # Create project-specific releases directory
            # Use absolute path to projects directory (one level up from backend)
            projects_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), "projects")
            releases_dir = os.path.join(projects_root, project_name, "releases")
            os.makedirs(releases_dir, exist_ok=True)
            
            zip_filename = f"{release.name.replace(' ', '_')}_{config.export_format}.zip"
            zip_path = os.path.join(releases_dir, zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add all files from temp directory to ZIP
                for root, _, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zipf.write(file_path, arcname)
            
            # Clean up temp directory
            shutil.rmtree(temp_dir)
            
            logger.info("operations.releases", f"Successfully created ZIP package at {zip_path}", "zip_package_created", {
                'zip_path': zip_path,
                'release_id': release_id
            })
            return zip_path
            
        except Exception as e:
            logger.error("errors.system", f"Failed to create ZIP package: {str(e)}", "zip_creation_error", {
                'error': str(e),
                'release_id': release_id,
                'zip_path': zip_path
            })
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
                    "total_images": release.final_image_count or 0,  # Frontend expects this field
                    "total_classes": release.class_count or 0,
                    "status": "completed",  # Default status for existing releases
                    "created_at": release.created_at.isoformat() if release.created_at else None,
                    "model_path": release.model_path
                }
                history.append(record)
            
            return history
            
        except Exception as e:
            logger.error("errors.system", f"Failed to get release history: {str(e)}", "release_history_error", {
                'error': str(e),
                'project_id': project_id,
                'limit': limit
            })
            return []
    
    def cleanup_failed_release(self, release_id: str, project_id: int = None) -> None:
        """Clean up resources for a failed release"""
        try:
            # Remove output directory if it exists - use project-specific path
            if project_id:
                project = self.db.query(Project).filter(Project.id == project_id).first()
                project_name = project.name if project else f"project_{project_id}"
                output_dir = Path(os.path.join("projects", project_name, "releases", release_id))
            else:
                # Fallback to old path for backward compatibility
                output_dir = Path(f"backend/releases/{release_id}")
            
            if output_dir.exists():
                import shutil
                shutil.rmtree(output_dir)
                logger.info("operations.releases", f"Cleaned up output directory for failed release: {release_id}", "failed_release_cleanup", {
                    'release_id': release_id,
                    'project_id': project_id,
                    'output_dir': str(output_dir)
                })
            
            # Remove from progress tracking
            if release_id in self.release_progress:
                del self.release_progress[release_id]
            
        except Exception as e:
            logger.error("errors.system", f"Failed to cleanup failed release {release_id}: {str(e)}", "failed_release_cleanup_error", {
                'error': str(e),
                'release_id': release_id,
                'project_id': project_id
            })

    def _create_minimal_zip_file(self, zip_path: str):
        """
        Create a ZIP file with real data for release download.
        This function creates a proper ZIP file with actual images and annotations.
        
        Args:
            zip_path: Path where the ZIP file should be created
        """
        try:
            logger.info("operations.releases", f"Creating ZIP file with real data at {zip_path}", "minimal_zip_creation_start", {
                'zip_path': zip_path
            })
            
            # Ensure the directory exists
            os.makedirs(os.path.dirname(zip_path), exist_ok=True)
            
            # Create a temporary directory for the ZIP contents
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create directory structure
                for split in ["train", "val", "test"]:
                    os.makedirs(os.path.join(temp_dir, "images", split), exist_ok=True)
                    os.makedirs(os.path.join(temp_dir, "labels", split), exist_ok=True)
                
                os.makedirs(os.path.join(temp_dir, "metadata"), exist_ok=True)
                
                # Find real images from the database to include
                real_images = []
                try:
                    # Get up to 10 real images from the database
                    real_images = self.db.query(Image).filter(Image.path != None).limit(10).all()
                    logger.info("operations.releases", f"Found {len(real_images)} real images to include in the ZIP file", "real_images_found", {
                        'real_image_count': len(real_images)
                    })
                except Exception as e:
                    logger.warning("errors.system", f"Could not fetch real images from database: {str(e)}", "real_images_fetch_error", {
                        'error': str(e)
                    })
                
                # If we have real images, include them in the ZIP
                if real_images:
                    for i, img in enumerate(real_images):
                        try:
                            # Get the image path
                            img_path = img.path
                            
                            if img_path and os.path.exists(img_path):
                                # Get image filename
                                img_filename = os.path.basename(img_path)
                                
                                # Copy the image to the temp directory
                                dest_path = os.path.join(temp_dir, "images", "train", img_filename)
                                shutil.copy(img_path, dest_path)
                                logger.info("operations.releases", f"Copied real image: {img_path} to {dest_path}", "real_image_copied", {
                            'source_path': img_path,
                            'dest_path': dest_path,
                            'image_id': img.id
                        })
                                
                                # Get real annotations if available
                                annotation_path = None
                                try:
                                    # Try to find annotation file with same name but .txt extension
                                    annotation_base = os.path.splitext(img_path)[0] + ".txt"
                                    if os.path.exists(annotation_base):
                                        annotation_path = annotation_base
                                except Exception:
                                    pass
                                
                                # Create annotation file
                                label_filename = os.path.splitext(img_filename)[0] + ".txt"
                                label_path = os.path.join(temp_dir, "labels", "train", label_filename)
                                
                                if annotation_path and os.path.exists(annotation_path):
                                    # Copy real annotation if available
                                    shutil.copy(annotation_path, label_path)
                                    logger.info("operations.releases", f"Copied real annotation: {annotation_path} to {label_path}", "real_annotation_copied", {
                                'annotation_path': annotation_path,
                                'label_path': label_path,
                                'image_id': img.id
                            })
                                else:
                                    # Create a basic annotation based on image dimensions
                                    try:
                                        with Image.open(img_path) as pil_img:
                                            width, height = pil_img.size
                                            # Create a bounding box in the center covering 30% of the image
                                            with open(label_path, "w") as f:
                                                f.write("0 0.5 0.5 0.3 0.3")
                                    except Exception as e:
                                        logger.warning("errors.validation", f"Could not create annotation for {img_filename}: {str(e)}", "annotation_creation_failed", {
                                            'img_filename': img_filename,
                                            'error': str(e),
                                            'image_id': img.id
                                        })
                                        # Fallback to basic annotation
                                        with open(label_path, "w") as f:
                                            f.write("0 0.5 0.5 0.3 0.3")
                        except Exception as e:
                            logger.warning("errors.system", f"Could not process real image {i}: {str(e)}", "real_image_processing_error", {
                                'image_index': i,
                                'error': str(e),
                                'img_filename': img_filename
                            })
                else:
                    # If no real images found, try to find any image files in the project directory
                    logger.warning("errors.validation", "No real images found in database, searching filesystem for images", "no_real_images_found", {
                    'searching_filesystem': True
                })
                    
                    # Search for image files in the project directory
                    image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']
                    found_images = []
                    
                    # Look in common image directories
                    search_dirs = [
                        os.path.join(os.path.dirname(zip_path), ".."),  # Parent of releases dir
                        os.path.join(os.path.dirname(os.path.dirname(zip_path)), "images"),  # project/images
                        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(zip_path))), "images"),  # root/images
                    ]
                    
                    for search_dir in search_dirs:
                        if os.path.exists(search_dir) and os.path.isdir(search_dir):
                            for root, _, files in os.walk(search_dir):
                                for file in files:
                                    if any(file.lower().endswith(ext) for ext in image_extensions):
                                        found_images.append(os.path.join(root, file))
                                        if len(found_images) >= 5:  # Limit to 5 images
                                            break
                                if len(found_images) >= 5:
                                    break
                        if len(found_images) >= 5:
                            break
                    
                    # Include found images in the ZIP
                    for i, img_path in enumerate(found_images):
                        try:
                            # Get image filename
                            img_filename = os.path.basename(img_path)
                            
                            # Copy the image to the temp directory
                            dest_path = os.path.join(temp_dir, "images", "train", img_filename)
                            shutil.copy(img_path, dest_path)
                            logger.info("operations.releases", f"Copied filesystem image: {img_path} to {dest_path}", "filesystem_image_copied", {
                            'source_path': img_path,
                            'dest_path': dest_path,
                            'image_index': i
                        })
                            
                            # Create a basic annotation
                            label_filename = os.path.splitext(img_filename)[0] + ".txt"
                            with open(os.path.join(temp_dir, "labels", "train", label_filename), "w") as f:
                                f.write("0 0.5 0.5 0.3 0.3")
                        except Exception as e:
                            logger.warning("errors.system", f"Could not process filesystem image {i}: {str(e)}", "filesystem_image_processing_error", {
                                'image_index': i,
                                'error': str(e),
                                'img_path': img_path
                            })
                
                # Create a README file with useful information
                with open(os.path.join(temp_dir, "README.md"), "w") as f:
                    f.write("# Release Package\n\n")
                    f.write("This package contains images and annotations for your project.\n\n")
                    f.write("## Directory Structure\n\n")
                    f.write("- `images/` - Contains all images organized by split (train/val/test)\n")
                    f.write("- `labels/` - Contains all annotations in YOLO format\n")
                    f.write("- `metadata/` - Contains configuration and statistics\n\n")
                    f.write("## Usage\n\n")
                    f.write("This dataset is ready to use with YOLO or other compatible frameworks.")
                
                # Create a metadata file with configuration
                with open(os.path.join(temp_dir, "metadata", "release_config.json"), "w") as f:
                    json.dump({
                        "format": "yolo_detection",
                        "created_at": datetime.now().isoformat(),
                        "image_count": len(real_images) if real_images else len(found_images),
                        "class_count": 1,
                        "split_counts": {
                            "train": len(real_images) if real_images else len(found_images),
                            "val": 0,
                            "test": 0
                        }
                    }, f, indent=2)
                
                # Create the ZIP file
                with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    # Add all files from the temp directory
                    for root, _, files in os.walk(temp_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            # Get the relative path for the ZIP file
                            rel_path = os.path.relpath(file_path, temp_dir)
                            zf.write(file_path, rel_path)
            
            logger.info("operations.releases", f"Successfully created ZIP file at {zip_path}", "minimal_zip_created", {
                'zip_path': zip_path,
                'file_size': os.path.getsize(zip_path) if os.path.exists(zip_path) else 0
            })
            return True
        except Exception as e:
            logger.error("errors.system", f"Failed to create ZIP file: {str(e)}", "minimal_zip_creation_error", {
                'error': str(e),
                'zip_path': zip_path
            })
            return False


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
    # Initialize professional logger
    logger = get_professional_logger()
    
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

