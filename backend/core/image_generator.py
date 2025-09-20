"""Image Augmentation Engine for Auto-Labeling Tool Release Pipeline
Integrates with existing ImageTransformer service and handles annotation updates
"""

import os
import json
import numpy as np
from typing import List, Dict, Any, Tuple, Optional, Union
from dataclasses import dataclass
from pathlib import Path
from PIL import Image
import uuid

# Pillow 9/10 compatibility for resampling
RESAMPLING = getattr(Image, "Resampling", Image)

# Whitelist of photometric adjustments to be applied post-geometry
PHOTOMETRIC_KEYS = {
    "brightness", "contrast", "blur", "noise",
    "color_jitter", "gamma_correction", "clahe",
    "equalize", "grayscale", "cutout"
}

# Import existing transformation service
from api.services.image_transformer import ImageTransformer

# Import dual-value transformation functions
#from core.transformation_config import is_dual_value_transformation, generate_auto_value

# Import variant generation function
# NOTE: transform_resolver and affine_builder were removed - functionality moved to annotation_transformer.py
# Removed: ImageVariantRepository - not using any DB table for variants

# Import professional logging system - CORRECT UNIFORM PATTERN
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

# Centralized annotation utilities
from core.annotation_transformer import BoundingBox, Polygon, update_annotations_for_transformations

@dataclass
class AugmentationResult:
    """Result of image augmentation"""
    augmented_image_path: str
    updated_annotations: List[Union[BoundingBox, Polygon]]
    transformation_applied: Dict[str, Any]
    original_dimensions: Tuple[int, int]
    augmented_dimensions: Tuple[int, int]
    config_id: str

class ImageAugmentationEngine:
    """
    Handles image transformations and annotation updates for release pipeline
    Phase 1: Integrates with existing ImageTransformer service
    """
    
    def __init__(self, output_base_dir: str = "augmented"):
        self.output_base_dir = Path(output_base_dir)
        self.transformer = ImageTransformer()
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']
        
        # Create output directories
        for split in ['train', 'val', 'test']:
            (self.output_base_dir / split).mkdir(parents=True, exist_ok=True)
        
        logger.info("operations.transformations", f"Initialized ImageAugmentationEngine with output dir: {self.output_base_dir}", "augmentation_engine_initialized", {
            'output_base_dir': str(self.output_base_dir)
        })
    
    def load_image_from_path(self, image_path: str) -> Tuple[Image.Image, Tuple[int, int]]:
        """Load image and return PIL Image with original dimensions"""
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        try:
            image = Image.open(image_path)
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            original_dims = image.size  # (width, height)
            logger.info("operations.images", f"Loaded image: {image_path}, dimensions: {original_dims}", "image_loaded", {
                'image_path': image_path,
                'dimensions': original_dims
            })
            return image, original_dims
            
        except Exception as e:
            raise ValueError(f"Failed to load image {image_path}: {str(e)}")
    
    def _save_image_with_format(self, image: Image.Image, output_path: Path, output_format: str) -> None:
        """
        Save image with proper format conversion
        
        Args:
            image: PIL Image to save
            output_path: Output file path
            output_format: Target format (original, jpg, png, webp, bmp, tiff)
        """
        try:
            if output_format.lower() == "original":
                # Keep original format - save as-is
                image.save(output_path, quality=95, optimize=True)
            elif output_format.lower() in ["jpg", "jpeg"]:
                # Convert to RGB for JPEG (no transparency)
                if image.mode in ("RGBA", "LA", "P"):
                    # Create white background for transparent images
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    if image.mode == "P":
                        image = image.convert("RGBA")
                    background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
                    image = background
                image.save(output_path, format="JPEG", quality=95, optimize=True)
            elif output_format.lower() == "png":
                # PNG supports transparency
                image.save(output_path, format="PNG", optimize=True)
            elif output_format.lower() == "webp":
                # WebP format
                image.save(output_path, format="WEBP", quality=95, optimize=True)
            elif output_format.lower() == "bmp":
                # BMP format (convert to RGB)
                if image.mode in ("RGBA", "LA", "P"):
                    image = image.convert("RGB")
                image.save(output_path, format="BMP")
            elif output_format.lower() == "tiff":
                # TIFF format
                image.save(output_path, format="TIFF", quality=95)
            else:
                # Fallback to original format
                logger.warning("errors.validation", f"Unsupported output format: {output_format}, using original", "unsupported_format", {
                'output_format': output_format,
                'output_path': str(output_path)
            })
                image.save(output_path, quality=95, optimize=True)
                
            logger.info("operations.images", f"Saved image as {output_format.upper()}: {output_path}", "image_saved", {
                'output_format': output_format.upper(),
                'output_path': str(output_path)
            })
            
        except Exception as e:
            logger.error("errors.system", f"Failed to save image in format {output_format}: {str(e)}", "image_save_error", {
                'error': str(e),
                'output_format': output_format,
                'output_path': str(output_path)
            })
            # Fallback to default save
            image.save(output_path, quality=95, optimize=True)
    
    def generate_augmented_filename(self, original_filename: str, config_id: str, 
                                  output_format: str = "jpg") -> str:
        """Generate filename for augmented image"""
        # Extract base name without extension
        base_name = Path(original_filename).stem
        
        # Determine file extension
        if output_format.lower() == "original":
            # Keep original extension
            original_ext = Path(original_filename).suffix.lstrip('.')
            extension = original_ext if original_ext else "jpg"
        else:
            # Use specified format
            extension = output_format.lower()
            # Handle jpeg -> jpg
            if extension == "jpeg":
                extension = "jpg"
        
        # Create augmented filename
        augmented_filename = f"{base_name}_{config_id}.{extension}"
        return augmented_filename
    
    def _resolve_dual_value_parameters(self, transformation_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve dual-value parameters to single values for image processing
        
        Handles both formats:
        1. Already resolved: {"brightness": {"adjustment": 20}}
        2. Dual-value format: {"brightness": {"adjustment": {"user_value": 20, "auto_value": -15}}}
        
        Priority Order: User Value → Auto Value → Original Value
        """
        resolved_config = {}
        
        for tool_type, tool_params in transformation_config.items():
            if not isinstance(tool_params, dict):
                # Handle non-dict parameters (shouldn't happen, but be safe)
                resolved_config[tool_type] = tool_params
                continue
            
            resolved_params = {}
            
            for param_name, param_value in tool_params.items():
                if isinstance(param_value, dict) and ('user_value' in param_value or 'auto_value' in param_value):
                    # This is a dual-value parameter - resolve it
                    if 'user_value' in param_value and param_value['user_value'] is not None:
                        # Priority 1: Use user value
                        resolved_params[param_name] = param_value['user_value']
                        logger.info("operations.transformations", f"Resolved {tool_type}.{param_name}: user_value = {param_value['user_value']}", "dual_value_resolved", {
                            'tool_type': tool_type,
                            'param_name': param_name,
                            'value_type': 'user_value',
                            'value': param_value['user_value']
                        })
                    elif 'auto_value' in param_value and param_value['auto_value'] is not None:
                        # Priority 2: Use auto value
                        resolved_params[param_name] = param_value['auto_value']
                        logger.info("operations.transformations", f"Resolved {tool_type}.{param_name}: auto_value = {param_value['auto_value']}", "dual_value_resolved", {
                            'tool_type': tool_type,
                            'param_name': param_name,
                            'value_type': 'auto_value',
                            'value': param_value['auto_value']
                        })
                    else:
                        # Fallback: Use the dict as-is (shouldn't happen)
                        resolved_params[param_name] = param_value
                        logger.warning("errors.validation", f"Could not resolve dual-value for {tool_type}.{param_name}: {param_value}", "dual_value_resolution_failed", {
                            'tool_type': tool_type,
                            'param_name': param_name,
                            'param_value': param_value
                        })
                else:
                    # This is already a resolved single value
                    resolved_params[param_name] = param_value
            
            resolved_config[tool_type] = resolved_params
        
        logger.info("operations.transformations", f"Resolved transformation config: {resolved_config}", "transformation_config_resolved", {
            'resolved_config': resolved_config
        })
        return resolved_config
    
# REMOVED: _split_config_into_geometry_and_photometric - no longer needed with sequential approach
    
    def apply_transformations_to_image(self, image: Image.Image, 
                                     transformation_config: Dict[str, Any]) -> Image.Image:
        """Apply transformations to image - KEEP WORKING AS-IS"""
        try:
            # Resolve dual-value parameters before applying transformations
            resolved_config = self._resolve_dual_value_parameters(transformation_config)
            
            # Use ImageTransformer for all transformations (working approach)
            transformed_image = self.transformer.apply_transformations(image, resolved_config)
            
            logger.info("operations.transformations", f"Applied transformations: {list(resolved_config.keys())}", "transformations_applied", {
                'transformation_types': list(resolved_config.keys()),
                'config_count': len(resolved_config)
            })
            return transformed_image
            
        except Exception as e:
            logger.error("errors.system", f"Failed to apply transformations: {str(e)}", "transformations_application_error", {
                'error': str(e),
                'transformation_config': transformation_config
            })
            # Return original image if transformation fails
            return image
    
    def generate_augmented_image(self, image_path: str, transformation_config: Dict[str, Any], 
                              config_id: str, dataset_split: str = "train", 
                              output_format: str = "jpg", 
                              annotations: Optional[List[Union[BoundingBox, Polygon]]] = None) -> AugmentationResult: 
        """ 
        Generate augmented image with updated annotations and dual-value support: 
        geometry via single affine, then optional photometric pass. 
        """ 
        try: 
            # 0) basic guard 
            if not transformation_config: 
                logger.warning("errors.validation", f"Empty transformation config for image: {image_path}", "empty_transformation_config", { 
                    'image_path': image_path 
                }) 
                transformation_config = {} 
 
            # 1) load source 
            original_image, original_dims = self.load_image_from_path(image_path) 
 
            # 2) resolve dual-value params once 
            resolved_config = self._resolve_dual_value_parameters(transformation_config) 
 
            # 3) Apply transformations using simple sequential approach (same as releases.py)
            augmented_image = self.transformer.apply_transformations(original_image, resolved_config)
            augmented_dims = augmented_image.size 
 
            # 6) save with requested format and name 
            original_filename = os.path.basename(image_path) 
            augmented_filename = self.generate_augmented_filename(original_filename, config_id, output_format) 
            output_path = self.output_base_dir / dataset_split / augmented_filename 
            self._save_image_with_format(augmented_image, output_path, output_format) 
 
            # 7) update annotations (using sequential transformations - same as releases.py) 
            updated_annotations: List[Union[BoundingBox, Polygon]] = [] 
            if annotations: 
                # Use the centralized annotation transformer with sequential approach (no matrix)
                updated_annotations = update_annotations_for_transformations( 
                    annotations, resolved_config, original_dims, augmented_dims, affine_matrix=None 
                ) 
 
            result = AugmentationResult( 
                augmented_image_path=str(output_path), 
                updated_annotations=updated_annotations, 
                transformation_applied=resolved_config, 
                original_dimensions=original_dims, 
                augmented_dimensions=augmented_dims, 
                config_id=config_id 
            ) 
 
            logger.info("operations.transformations", f"Generated augmented image: {augmented_filename}", "augmented_image_generated", { 
                'augmented_filename': augmented_filename, 
                'config_id': config_id, 
                'output_path': str(output_path) 
            }) 
            return result 
 
        except Exception as e: 
            logger.error("errors.system", f"Failed to generate augmented image: {str(e)}", "augmented_image_generation_error", { 
                'error': str(e), 
                'image_path': image_path, 
                'config_id': config_id 
            }) 
            raise
    
    def process_image_with_multiple_configs(self, image_path: str, 
                                          transformation_configs: List[Dict[str, Any]],
                                          dataset_split: str = "train",
                                          output_format: str = "jpg",
                                          annotations: Optional[List[Union[BoundingBox, Polygon]]] = None) -> List[AugmentationResult]:
        """
        Process a single image with multiple transformation configurations
        
        Args:
            image_path: Path to original image
            transformation_configs: List of transformation configurations
            dataset_split: Dataset split (train/val/test)
            output_format: Output image format
            annotations: List of annotations to update
            
        Returns:
            List of AugmentationResult objects
        """
        results = []
        
        for config_data in transformation_configs:
            try:
                config_id = config_data.get('config_id', str(uuid.uuid4()))
                transformations = config_data.get('transformations', {})
                
                result = self.generate_augmented_image(
                    image_path=image_path,
                    transformation_config=transformations,
                    config_id=config_id,
                    dataset_split=dataset_split,
                    output_format=output_format,
                    annotations=annotations
                )
                
                results.append(result)
                
            except Exception as e:
                logger.error("errors.system", f"Failed to process config {config_data.get('config_id', 'unknown')}: {str(e)}", "config_processing_error", {
                    'error': str(e),
                    'config_id': config_data.get('config_id', 'unknown'),
                    'image_path': image_path
                })
                continue
        
        logger.info("operations.transformations", f"Processed {len(results)} configurations for image: {os.path.basename(image_path)}", "configurations_processed", {
            'config_count': len(results),
            'image_filename': os.path.basename(image_path)
        })
        return results
    
    def get_available_transformations(self) -> Dict[str, Dict[str, Any]]:
        """Get available transformations from ImageTransformer service"""
        return self.transformer.get_available_transformations()
    

    
    def cleanup_output_directory(self, dataset_split: Optional[str] = None) -> None:
        """Clean up output directory"""
        if dataset_split:
            # Clean specific split
            split_dir = self.output_base_dir / dataset_split
            if split_dir.exists():
                for file in split_dir.glob("*"):
                    if file.is_file():
                        file.unlink()
                logger.info("operations.transformations", f"Cleaned up {dataset_split} directory", "directory_cleaned", {
            'dataset_split': dataset_split,
            'output_base_dir': str(self.output_base_dir)
        })
        else:
            # Clean all splits
            for split in ['train', 'val', 'test']:
                self.cleanup_output_directory(split)


def create_augmentation_engine(output_dir: str = "augmented") -> ImageAugmentationEngine:
    """Create and configure augmentation engine"""
    return ImageAugmentationEngine(output_dir)


def process_release_images(image_paths: List[str], 
                           transformation_configs: Dict[str, List[Dict[str, Any]]],
                           dataset_splits: Dict[str, str],
                           output_dir: str = "augmented",
                           output_format: str = "jpg",
                           dataset_sources: Dict[str, Dict[str, Any]] = None,
                           annotations_map: Optional[Dict[str, List[Union[BoundingBox, Polygon]]]] = None
                           ) -> Dict[str, List[AugmentationResult]]:
    """
    Process multiple images for release generation with multi-dataset support

    Args:
        image_paths: List of absolute image file paths (source images)
        transformation_configs: Dict mapping image_id -> list of transformation configs
        dataset_splits: Dict mapping image_path -> dataset split (train/val/test)
        output_dir: Output directory for augmented images
        output_format: Output image format ("jpg"|"png"|"webp"|"tiff"|"original")
        dataset_sources: Dict mapping image_path -> {"dataset_name": ..., "original_filename": ...}
        annotations_map: OPTIONAL. Dict keyed by image_path and/or image_id -> List[BoundingBox|Polygon] in **pixels**
    """
    engine = create_augmentation_engine(output_dir)
    all_results: Dict[str, List[AugmentationResult]] = {}
    dataset_sources = dataset_sources or {}
    annotations_map = annotations_map or {}

    logger.info("operations.transformations",
                f"🎨 PROCESSING {len(image_paths)} IMAGES FROM MULTIPLE DATASETS",
                "multi_dataset_processing_start",
                {
                    'total_images': len(image_paths),
                    'dataset_count': len(set(
                        (dataset_sources[p].get('dataset_name', 'unknown')
                         if (dataset_sources and p in dataset_sources) else 'unknown')
                        for p in image_paths
                    ))
                })

    for image_path in image_paths:
        try:
            image_filename = Path(image_path).stem

            # Use the actual database image_id that matches transformation_configs keys
            if dataset_sources and image_path in dataset_sources:
                source_info = dataset_sources[image_path]
                original_filename = source_info.get("original_filename", image_filename)
                # FIXED: Use the actual database image ID instead of filename stem
                image_id = source_info.get("source_image_id", image_filename)
                dataset_name = source_info.get("dataset_name", "unknown")
                logger.info("operations.transformations",
                            f"   Processing {dataset_name}/{original_filename} (ID: {image_id})",
                            "image_processing_start",
                            {
                                'dataset_name': dataset_name,
                                'original_filename': original_filename,
                                'image_path': image_path,
                                'image_id': image_id
                            })
            else:
                image_id = image_filename
                dataset_name = "unknown"

            # Get transformation configs for this image_id
            configs = transformation_configs.get(image_id, [])
            if not configs:
                logger.warning("errors.validation",
                               f"No transformation configs found for image: {image_id} (from {dataset_name})",
                               "no_transformation_configs",
                               {
                                   'image_id': image_id,
                                   'dataset_name': dataset_name,
                                   'image_path': image_path
                               })
                continue

            # Resolve dataset split
            split = dataset_splits.get(image_path, "train")

            # ----- FIXED: pull pixel annotations with robust fallback keys -----
            
# Pull pixel-space annotations for this image, if provided by caller
            annotations_for_this_image: Optional[List[Union[BoundingBox, Polygon]]] = None
            if annotations_map:
                # 1) exact key by absolute path
                annotations_for_this_image = annotations_map.get(image_path)
                if annotations_for_this_image is None:
                    # 2) key by image_id (stem of original filename)
                    annotations_for_this_image = annotations_map.get(image_id)

            # Log how many we’re using for this image (safe even if None)
            logger.info("operations.annotations",
                f"Using {len(annotations_for_this_image or [])} annotations for {image_id}",
                "release_annotations_selected",
                {"image_path": image_path, "image_id": image_id}, 
            )
            if not annotations_for_this_image:
                logger.warning(
                    "operations.annotations",
                    "No annotations found for this image; labels will NOT be transformed",
                    "release_annotations_missing",
                    {"image_path": image_path, "image_id": image_id}
                )  
            # Optional: normalize to empty list
            if annotations_for_this_image is None:
                annotations_for_this_image = []
             # Process with all configurations (now passing annotations)
            results = engine.process_image_with_multiple_configs(
                image_path=image_path,
                transformation_configs=configs,
                dataset_split=split,
                output_format=output_format,
                annotations=annotations_for_this_image
            )

            all_results[image_path] = results


        except Exception as e:
            logger.error("errors.system",
                         f"Failed to process image {image_path}: {str(e)}",
                         "image_processing_error",
                         {
                             'error': str(e),
                             'image_path': image_path
                         })
            continue

    logger.info("operations.transformations",
                f"Processed {len(all_results)} images for release generation",
                "release_images_processed",
                {
                    'processed_images': len(all_results),
                    'total_images': len(image_paths)
                })
    return all_results




if __name__ == "__main__":
    # Example usage and testing
    # Initialize professional logger
    logger = get_professional_logger()
    
    # Test the augmentation engine
    engine = create_augmentation_engine("test_output")
    
    # Get available transformations
    available_transforms = engine.get_available_transformations()
    print("Available transformations:")
    for name, spec in available_transforms.items():
        print(f"  {name}: {spec['name']}")
    
    # Example transformation config
    test_config = {
        "brightness": {"adjustment": 20, "enabled": True},
        "flip": {"horizontal": True, "enabled": True}
    }
    
    print(f"\nTest configuration: {test_config}")
    print("Ready for image processing!")