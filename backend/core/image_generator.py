"""
Image Augmentation Engine for Auto-Labeling Tool Release Pipeline
Integrates with existing ImageTransformer service and handles annotation updates
"""

import os
import json
import logging
from typing import List, Dict, Any, Tuple, Optional, Union
from dataclasses import dataclass
from pathlib import Path
from PIL import Image
import uuid

# Import existing transformation service
from api.services.image_transformer import ImageTransformer

# Import dual-value transformation functions
from core.transformation_config import is_dual_value_transformation, generate_auto_value

logger = logging.getLogger(__name__)

@dataclass
class BoundingBox:
    """Bounding box representation"""
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    class_name: str
    class_id: int
    confidence: float = 1.0

@dataclass
class Polygon:
    """Polygon representation for segmentation"""
    points: List[Tuple[float, float]]
    class_name: str
    class_id: int
    confidence: float = 1.0

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
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.bmp']
        
        # Create output directories
        for split in ['train', 'val', 'test']:
            (self.output_base_dir / split).mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Initialized ImageAugmentationEngine with output dir: {self.output_base_dir}")
    
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
            logger.debug(f"Loaded image: {image_path}, dimensions: {original_dims}")
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
                logger.warning(f"Unsupported output format: {output_format}, using original")
                image.save(output_path, quality=95, optimize=True)
                
            logger.debug(f"Saved image as {output_format.upper()}: {output_path}")
            
        except Exception as e:
            logger.error(f"Failed to save image in format {output_format}: {str(e)}")
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
                        logger.debug(f"Resolved {tool_type}.{param_name}: user_value = {param_value['user_value']}")
                    elif 'auto_value' in param_value and param_value['auto_value'] is not None:
                        # Priority 2: Use auto value
                        resolved_params[param_name] = param_value['auto_value']
                        logger.debug(f"Resolved {tool_type}.{param_name}: auto_value = {param_value['auto_value']}")
                    else:
                        # Fallback: Use the dict as-is (shouldn't happen)
                        resolved_params[param_name] = param_value
                        logger.warning(f"Could not resolve dual-value for {tool_type}.{param_name}: {param_value}")
                else:
                    # This is already a resolved single value
                    resolved_params[param_name] = param_value
            
            resolved_config[tool_type] = resolved_params
        
        logger.debug(f"Resolved transformation config: {resolved_config}")
        return resolved_config
    
    def apply_transformations_to_image(self, image: Image.Image, 
                                     transformation_config: Dict[str, Any]) -> Image.Image:
        """Apply transformations using existing ImageTransformer service with dual-value support"""
        try:
            # Resolve dual-value parameters before applying transformations
            resolved_config = self._resolve_dual_value_parameters(transformation_config)
            
            # Use the existing ImageTransformer service
            transformed_image = self.transformer.apply_transformations(image, resolved_config)
            logger.debug(f"Applied transformations: {list(resolved_config.keys())}")
            return transformed_image
            
        except Exception as e:
            logger.error(f"Failed to apply transformations: {str(e)}")
            logger.error(f"Transformation config: {transformation_config}")
            # Return original image if transformation fails
            return image
    
    def update_annotations_for_transformations(self, annotations: List[Union[BoundingBox, Polygon]], 
                                             transformation_config: Dict[str, Any],
                                             original_dims: Tuple[int, int],
                                             new_dims: Tuple[int, int]) -> List[Union[BoundingBox, Polygon]]:
        """
        Update annotations based on applied transformations with dual-value support
        Phase 1: Basic annotation updates for common transformations
        """
        if not annotations:
            return []
        
        # Resolve dual-value parameters for annotation processing
        resolved_config = self._resolve_dual_value_parameters(transformation_config)
        
        updated_annotations = []
        
        for annotation in annotations:
            try:
                updated_annotation = self._transform_single_annotation(
                    annotation, resolved_config, original_dims, new_dims
                )
                if updated_annotation:
                    updated_annotations.append(updated_annotation)
            except Exception as e:
                logger.warning(f"Failed to update annotation: {str(e)}")
                # Keep original annotation if update fails
                updated_annotations.append(annotation)
        
        logger.debug(f"Updated {len(updated_annotations)} annotations")
        return updated_annotations
    
    def _transform_single_annotation(self, annotation: Union[BoundingBox, Polygon],
                                   transformation_config: Dict[str, Any],
                                   original_dims: Tuple[int, int],
                                   new_dims: Tuple[int, int]) -> Optional[Union[BoundingBox, Polygon]]:
        """Transform a single annotation based on transformations applied"""
        
        # For Phase 1, we'll handle basic transformations that don't change coordinates
        # More complex transformations will be added in later phases
        
        if isinstance(annotation, BoundingBox):
            return self._transform_bbox(annotation, transformation_config, original_dims, new_dims)
        elif isinstance(annotation, Polygon):
            return self._transform_polygon(annotation, transformation_config, original_dims, new_dims)
        else:
            return annotation
    
    def _transform_bbox(self, bbox: BoundingBox, transformation_config: Dict[str, Any],
                       original_dims: Tuple[int, int], new_dims: Tuple[int, int]) -> Optional[BoundingBox]:
        """Transform bounding box coordinates"""
        
        # Start with original coordinates
        x_min, y_min, x_max, y_max = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max
        orig_width, orig_height = original_dims
        new_width, new_height = new_dims
        
        # Handle transformations that affect coordinates
        for transform_name, params in transformation_config.items():
            if not params.get('enabled', True):
                continue
                
            if transform_name == 'flip':
                if params.get('horizontal', False):
                    # Flip horizontally
                    x_min, x_max = orig_width - x_max, orig_width - x_min
                if params.get('vertical', False):
                    # Flip vertically
                    y_min, y_max = orig_height - y_max, orig_height - y_min
            
            elif transform_name == 'resize':
                # Scale coordinates based on resize
                width_ratio = new_width / orig_width
                height_ratio = new_height / orig_height
                
                x_min *= width_ratio
                x_max *= width_ratio
                y_min *= height_ratio
                y_max *= height_ratio
                
                # Update original dimensions for subsequent transformations
                orig_width, orig_height = new_width, new_height
        
        # Ensure coordinates are within bounds
        x_min = max(0, min(x_min, new_width))
        x_max = max(0, min(x_max, new_width))
        y_min = max(0, min(y_min, new_height))
        y_max = max(0, min(y_max, new_height))
        
        # Ensure min < max
        if x_min >= x_max or y_min >= y_max:
            logger.warning("Invalid bounding box after transformation, skipping")
            return None
        
        return BoundingBox(x_min, y_min, x_max, y_max, bbox.class_name, bbox.class_id, bbox.confidence)
    
    def _transform_polygon(self, polygon: Polygon, transformation_config: Dict[str, Any],
                          original_dims: Tuple[int, int], new_dims: Tuple[int, int]) -> Optional[Polygon]:
        """Transform polygon coordinates"""
        
        # Start with original points
        points = polygon.points.copy()
        orig_width, orig_height = original_dims
        new_width, new_height = new_dims
        
        # Handle transformations that affect coordinates
        for transform_name, params in transformation_config.items():
            if not params.get('enabled', True):
                continue
                
            if transform_name == 'flip':
                if params.get('horizontal', False):
                    # Flip horizontally
                    points = [(orig_width - x, y) for x, y in points]
                if params.get('vertical', False):
                    # Flip vertically
                    points = [(x, orig_height - y) for x, y in points]
            
            elif transform_name == 'resize':
                # Scale coordinates based on resize
                width_ratio = new_width / orig_width
                height_ratio = new_height / orig_height
                
                points = [(x * width_ratio, y * height_ratio) for x, y in points]
                
                # Update original dimensions for subsequent transformations
                orig_width, orig_height = new_width, new_height
        
        # Ensure all points are within bounds
        valid_points = []
        for x, y in points:
            x = max(0, min(x, new_width))
            y = max(0, min(y, new_height))
            valid_points.append((x, y))
        
        if len(valid_points) < 3:
            logger.warning("Polygon has less than 3 valid points after transformation, skipping")
            return None
        
        return Polygon(valid_points, polygon.class_name, polygon.class_id, polygon.confidence)
    
    def generate_augmented_image(self, image_path: str, transformation_config: Dict[str, Any],
                               config_id: str, dataset_split: str = "train",
                               output_format: str = "jpg",
                               annotations: Optional[List[Union[BoundingBox, Polygon]]] = None) -> AugmentationResult:
        """
        Generate augmented image with updated annotations and dual-value support
        
        Args:
            image_path: Path to original image
            transformation_config: Dictionary of transformations to apply (supports dual-value format)
            config_id: Unique identifier for this configuration
            dataset_split: Dataset split (train/val/test)
            output_format: Output image format
            annotations: List of annotations to update
            
        Returns:
            AugmentationResult with paths and updated annotations
        """
        try:
            # Validate transformation config
            if not transformation_config:
                logger.warning(f"Empty transformation config for image: {image_path}")
                transformation_config = {}
            
            # Load original image
            original_image, original_dims = self.load_image_from_path(image_path)
            
            # Apply transformations with dual-value support
            augmented_image = self.apply_transformations_to_image(original_image, transformation_config)
            augmented_dims = augmented_image.size
            
            # Generate output filename and path
            original_filename = os.path.basename(image_path)
            augmented_filename = self.generate_augmented_filename(original_filename, config_id, output_format)
            output_path = self.output_base_dir / dataset_split / augmented_filename
            
            # Save augmented image with proper format conversion
            self._save_image_with_format(augmented_image, output_path, output_format)
            
            # Update annotations if provided
            updated_annotations = []
            if annotations:
                updated_annotations = self.update_annotations_for_transformations(
                    annotations, transformation_config, original_dims, augmented_dims
                )
            
            result = AugmentationResult(
                augmented_image_path=str(output_path),
                updated_annotations=updated_annotations,
                transformation_applied=transformation_config,
                original_dimensions=original_dims,
                augmented_dimensions=augmented_dims,
                config_id=config_id
            )
            
            logger.info(f"Generated augmented image: {augmented_filename}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate augmented image: {str(e)}")
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
                logger.error(f"Failed to process config {config_data.get('config_id', 'unknown')}: {str(e)}")
                continue
        
        logger.info(f"Processed {len(results)} configurations for image: {os.path.basename(image_path)}")
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
                logger.info(f"Cleaned up {dataset_split} directory")
        else:
            # Clean all splits
            for split in ['train', 'val', 'test']:
                self.cleanup_output_directory(split)


# Utility functions for easy usage
def create_augmentation_engine(output_dir: str = "augmented") -> ImageAugmentationEngine:
    """Create and configure augmentation engine"""
    return ImageAugmentationEngine(output_dir)


def process_release_images(image_paths: List[str], 
                         transformation_configs: Dict[str, List[Dict[str, Any]]],
                         dataset_splits: Dict[str, str],
                         output_dir: str = "augmented",
                         output_format: str = "jpg",
                         dataset_sources: Dict[str, Dict[str, Any]] = None) -> Dict[str, List[AugmentationResult]]:
    """
    Process multiple images for release generation with multi-dataset support
    
    Args:
        image_paths: List of image file paths
        transformation_configs: Dict mapping image_id to list of transformation configs
        dataset_splits: Dict mapping image_path to dataset split (train/val/test)
        output_dir: Output directory for augmented images
        output_format: Output image format
        dataset_sources: Dict mapping image_path to dataset source information
        
    Returns:
        Dictionary mapping image_path to list of AugmentationResult objects
    """
    engine = create_augmentation_engine(output_dir)
    all_results = {}
    dataset_sources = dataset_sources or {}
    
    logger.info(f"🎨 PROCESSING {len(image_paths)} IMAGES FROM MULTIPLE DATASETS")
    
    for image_path in image_paths:
        try:
            # Get image ID from path - handle multi-dataset naming
            image_filename = Path(image_path).stem
            
            # Extract original image ID (remove dataset prefix if present)
            if dataset_sources and image_path in dataset_sources:
                source_info = dataset_sources[image_path]
                original_filename = source_info.get("original_filename", image_filename)
                image_id = Path(original_filename).stem
                dataset_name = source_info.get("dataset_name", "unknown")
                logger.debug(f"   Processing {dataset_name}/{original_filename}")
            else:
                image_id = image_filename
                dataset_name = "unknown"
            
            # Get transformation configs for this image
            configs = transformation_configs.get(image_id, [])
            if not configs:
                logger.warning(f"No transformation configs found for image: {image_id} (from {dataset_name})")
                continue
            
            # Get dataset split for this image
            split = dataset_splits.get(image_path, "train")
            
            # Process image with all configurations
            results = engine.process_image_with_multiple_configs(
                image_path=image_path,
                transformation_configs=configs,
                dataset_split=split,
                output_format=output_format
            )
            
            all_results[image_path] = results
            
        except Exception as e:
            logger.error(f"Failed to process image {image_path}: {str(e)}")
            continue
    
    logger.info(f"Processed {len(all_results)} images for release generation")
    return all_results


if __name__ == "__main__":
    # Example usage and testing
    logging.basicConfig(level=logging.INFO)
    
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
