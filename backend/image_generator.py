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
    
    def generate_augmented_filename(self, original_filename: str, config_id: str, 
                                  output_format: str = "jpg") -> str:
        """Generate filename for augmented image"""
        # Extract base name without extension
        base_name = Path(original_filename).stem
        
        # Create augmented filename
        augmented_filename = f"{base_name}_{config_id}.{output_format}"
        return augmented_filename
    
    def apply_transformations_to_image(self, image: Image.Image, 
                                     transformation_config: Dict[str, Any]) -> Image.Image:
        """Apply transformations using existing ImageTransformer service"""
        try:
            # Use the existing ImageTransformer service
            transformed_image = self.transformer.apply_transformations(image, transformation_config)
            logger.debug(f"Applied transformations: {list(transformation_config.keys())}")
            return transformed_image
            
        except Exception as e:
            logger.error(f"Failed to apply transformations: {str(e)}")
            # Return original image if transformation fails
            return image
    
    def update_annotations_for_transformations(self, annotations: List[Union[BoundingBox, Polygon]], 
                                             transformation_config: Dict[str, Any],
                                             original_dims: Tuple[int, int],
                                             new_dims: Tuple[int, int]) -> List[Union[BoundingBox, Polygon]]:
        """
        Update annotations based on applied transformations
        Phase 1: Basic annotation updates for common transformations
        """
        if not annotations:
            return []
        
        updated_annotations = []
        
        for annotation in annotations:
            try:
                updated_annotation = self._transform_single_annotation(
                    annotation, transformation_config, original_dims, new_dims
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
        Generate augmented image with updated annotations
        
        Args:
            image_path: Path to original image
            transformation_config: Dictionary of transformations to apply
            config_id: Unique identifier for this configuration
            dataset_split: Dataset split (train/val/test)
            output_format: Output image format
            annotations: List of annotations to update
            
        Returns:
            AugmentationResult with paths and updated annotations
        """
        try:
            # Load original image
            original_image, original_dims = self.load_image_from_path(image_path)
            
            # Apply transformations
            augmented_image = self.apply_transformations_to_image(original_image, transformation_config)
            augmented_dims = augmented_image.size
            
            # Generate output filename and path
            original_filename = os.path.basename(image_path)
            augmented_filename = self.generate_augmented_filename(original_filename, config_id, output_format)
            output_path = self.output_base_dir / dataset_split / augmented_filename
            
            # Save augmented image
            augmented_image.save(output_path, quality=95, optimize=True)
            
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
                         output_format: str = "jpg") -> Dict[str, List[AugmentationResult]]:
    """
    Process multiple images for release generation
    
    Args:
        image_paths: List of image file paths
        transformation_configs: Dict mapping image_id to list of transformation configs
        dataset_splits: Dict mapping image_path to dataset split (train/val/test)
        output_dir: Output directory for augmented images
        output_format: Output image format
        
    Returns:
        Dictionary mapping image_path to list of AugmentationResult objects
    """
    engine = create_augmentation_engine(output_dir)
    all_results = {}
    
    for image_path in image_paths:
        try:
            # Get image ID from path (you might need to adjust this based on your ID scheme)
            image_id = Path(image_path).stem
            
            # Get transformation configs for this image
            configs = transformation_configs.get(image_id, [])
            if not configs:
                logger.warning(f"No transformation configs found for image: {image_id}")
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
