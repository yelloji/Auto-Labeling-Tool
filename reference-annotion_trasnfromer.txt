"""Annotation geometry transformer

Provides reusable utilities to transform annotation coordinates (bounding boxes
and polygons) for common geometric image transformations, ensuring label
coordinates stay consistent with augmented images.

This module is designed to be used by the release pipeline and any other
exporters that require label updates after transformations.

Supports dynamic transformation pipeline with all 18 transformation tools
and their different options (e.g., resize with fit, stretch options).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


@dataclass
class BoundingBoxPixels:
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    class_id: int
    

@dataclass
class PolygonPixels:
    points: List[Tuple[float, float]]
    class_id: int


def _is_normalized_box(x_min: float, y_min: float, x_max: float, y_max: float) -> bool:
    return 0.0 <= x_min <= 1.0 and 0.0 <= y_min <= 1.0 and 0.0 <= x_max <= 1.0 and 0.0 <= y_max <= 1.0


def _rotate_point_cxcy(x: float, y: float, cx: float, cy: float, rad: float) -> Tuple[float, float]:
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    dx, dy = x - cx, y - cy
    return cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a


def _rotate_bbox_axis_aligned(
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    img_w: int,
    img_h: int,
    angle_deg: float,
) -> Optional[Tuple[float, float, float, float]]:
    """Rotate bbox corners around image center and return YOLO-normalized cx, cy, w, h.

    Returns None if the resulting box is invalid.
    """
    cx, cy = img_w / 2.0, img_h / 2.0
    rad = math.radians(angle_deg)
    points = [(xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)]
    rpoints = [_rotate_point_cxcy(px, py, cx, cy, rad) for px, py in points]
    xs = [px for px, _ in rpoints]
    ys = [py for _, py in rpoints]
    nxmin, nxmax = max(0.0, min(xs)), min(float(img_w), max(xs))
    nymin, nymax = max(0.0, min(ys)), min(float(img_h), max(ys))
    if nxmin >= nxmax or nymin >= nymax:
        return None
    bw, bh = nxmax - nxmin, nymax - nymin
    cxn = (nxmin + nxmax) / 2.0 / img_w
    cyn = (nymin + nymax) / 2.0 / img_h
    wn = bw / img_w
    hn = bh / img_h
    return cxn, cyn, wn, hn


def _apply_flip_box(
    xmin: float, ymin: float, xmax: float, ymax: float, img_w: int, img_h: int,
    horizontal: bool, vertical: bool,
) -> Tuple[float, float, float, float]:
    if horizontal:
        xmin, xmax = img_w - xmax, img_w - xmin
    if vertical:
        ymin, ymax = img_h - ymax, img_h - ymin
    return xmin, ymin, xmax, ymax


def _apply_resize_box(
    xmin: float, ymin: float, xmax: float, ymax: float,
    orig_w: int, orig_h: int, new_w: int, new_h: int,
) -> Tuple[float, float, float, float]:
    if orig_w == 0 or orig_h == 0:
        return xmin, ymin, xmax, ymax
    sx, sy = new_w / float(orig_w), new_h / float(orig_h)
    return xmin * sx, ymin * sy, xmax * sx, ymax * sy


def _extract_bbox_pixels(ann: Any, img_w: int, img_h: int) -> Optional[BoundingBoxPixels]:
    """Extract bbox from various annotation shapes (ORM object or dict)."""
    try:
        class_id = int(getattr(ann, "class_id", 0) or getattr(ann, "label_id", 0) or 0)
        if hasattr(ann, "x_min") and hasattr(ann, "x_max"):
            xmin = float(ann.x_min)
            ymin = float(ann.y_min)
            xmax = float(ann.x_max)
            ymax = float(ann.y_max)
        elif hasattr(ann, "bbox") and ann.bbox:
            bbox = ann.bbox if isinstance(ann.bbox, dict) else json.loads(ann.bbox)
            xmin = float(bbox["x_min"])  # type: ignore[index]
            ymin = float(bbox["y_min"])  # type: ignore[index]
            xmax = float(bbox["x_max"])  # type: ignore[index]
            ymax = float(bbox["y_max"])  # type: ignore[index]
        else:
            return None
        if _is_normalized_box(xmin, ymin, xmax, ymax):
            xmin, xmax = xmin * img_w, xmax * img_w
            ymin, ymax = ymin * img_h, ymax * img_h
        return BoundingBoxPixels(xmin, ymin, xmax, ymax, class_id)
    except Exception:
        return None


def _extract_polygon_pixels(ann: Any, img_w: int, img_h: int) -> Optional[PolygonPixels]:
    """Extract polygon points from database segmentation like old system, with fallbacks."""
    try:
        class_id = int(getattr(ann, "class_id", 0) or getattr(ann, "label_id", 0) or 0)
        seg = getattr(ann, "segmentation", None)
        if seg is None:
            logger.warning(f"No segmentation data for annotation {ann}")
            return None

        logger.debug(f"Raw segmentation data: {seg} (type: {type(seg)})")
        print(f"TEMP DEBUG: Raw segmentation data: {seg} (type: {type(seg)})")

        # Like old system: json.loads to get list of [x,y] points
        if isinstance(seg, str):
            seg = json.loads(seg)
            logger.debug(f"After json.loads: {seg} (type: {type(seg)})")
            print(f"TEMP DEBUG: After json.loads: {seg} (type: {type(seg)})")

        pairs: List[Tuple[float, float]] = []

        # Primary: list of [x,y] lists
        if isinstance(seg, list) and all(isinstance(p, list) and len(p) == 2 for p in seg):
            pairs = [(float(x), float(y)) for x, y in seg]
            logger.debug("Matched primary format: list of [x,y]")
            print("TEMP DEBUG: Matched primary format: list of [x,y]")

        # Fallback: flat list [x1,y1,x2,y2,...]
        elif isinstance(seg, list) and all(isinstance(v, (int, float)) for v in seg) and len(seg) % 2 == 0:
            pairs = [(float(seg[i]), float(seg[i+1])) for i in range(0, len(seg), 2)]
            logger.debug("Matched fallback: flat list")
            print("TEMP DEBUG: Matched fallback: flat list")

        # Fallback: dict with 'points'
        elif isinstance(seg, dict) and 'points' in seg:
            points = seg['points']
            logger.debug(f"Matched dict format, points: {points} (type: {type(points)})")
            print(f"TEMP DEBUG: Matched dict format, points: {points} (type: {type(points)})")
            if isinstance(points, list):
                if all(isinstance(p, list) and len(p) == 2 for p in points):
                    pairs = [(float(x), float(y)) for x, y in points]
                    logger.debug("Dict points: list of [x,y]")
                    print("TEMP DEBUG: Dict points: list of [x,y]")
                else:
                    pairs = [(float(points[i]), float(points[i+1])) for i in range(0, len(points), 2)]
                    logger.debug("Dict points: flat list")
                    print("TEMP DEBUG: Dict points: flat list")

        if not pairs or len(pairs) < 3:
            logger.error(f"Invalid polygon points: insufficient or malformed data {seg}")
            return None

        logger.debug(f"Extracted {len(pairs)} points: {pairs}")
        print(f"TEMP DEBUG: Extracted {len(pairs)} points: {pairs}")

        # Assume points are absolute pixels; normalize only if in 0-1 range
        is_normalized = all(0.0 <= x <= 1.0 and 0.0 <= y <= 1.0 for x, y in pairs)
        if is_normalized:
            pairs = [(x * img_w, y * img_h) for x, y in pairs]
            logger.debug("Points were normalized, converted to pixels")
            print("TEMP DEBUG: Points were normalized, converted to pixels")
        else:
            logger.debug("Points assumed as absolute pixels")
            print("TEMP DEBUG: Points assumed as absolute pixels")

        return PolygonPixels(pairs, class_id)
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error in segmentation: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error extracting polygon pixels: {str(e)}")
        return None


def transform_detection_annotations_to_yolo(
    annotations: Iterable[Any],
    img_w: int,
    img_h: int,
    transform_config: Dict[str, Dict[str, Any]],
    class_index_resolver=None,
) -> List[str]:
    """Convert annotations to YOLO detection lines after applying transforms.
    
    Uses the AnnotationTransformer class for consistent transformation handling.
    
    Args:
        annotations: List of annotation objects (ORM objects or dicts)
        img_w: Original image width
        img_h: Original image height
        transform_config: Dictionary of transformation configurations
        class_index_resolver: Optional function to resolve class index from annotation
        
    Returns:
        List of YOLO format detection lines
    """
    logger.info("operations.transformations", f"Starting detection annotations transformation to YOLO", "detection_transform_start", {
        "image_width": img_w,
        "image_height": img_h,
        "transform_config": transform_config
    })
    
    try:
        # Determine new dimensions after transformations
        resize_params = transform_config.get("resize", {}) if transform_config.get("resize", {}).get("enabled", False) else {}
        target_w = int(resize_params.get("width", img_w) or img_w)
        target_h = int(resize_params.get("height", img_h) or img_h)
        new_dims = (target_w, target_h)
        
        # Use the AnnotationTransformer to apply all transformations
        transformer = AnnotationTransformer()
        extracted_annotations = []
        
        # Extract annotations to standard format
        for ann in annotations:
            bbox = _extract_bbox_pixels(ann, img_w, img_h)
            if bbox:
                extracted_annotations.append(bbox)
        
        # Apply transformations
        transformed_annotations = transformer.apply_transformations(
            extracted_annotations, transform_config, (img_w, img_h), new_dims
        )

        lines: List[str] = []
        processed_count = 0
        skipped_count = len(annotations) - len(extracted_annotations)
        
        for bbox in transformed_annotations:
            if not isinstance(bbox, BoundingBoxPixels):
                continue
                
            # Convert to YOLO format (normalized center x, center y, width, height)
            bw, bh = bbox.x_max - bbox.x_min, bbox.y_max - bbox.y_min
            cxn = ((bbox.x_min + bbox.x_max) / 2.0) / float(target_w)
            cyn = ((bbox.y_min + bbox.y_max) / 2.0) / float(target_h)
            wn = bw / float(target_w)
            hn = bh / float(target_h)

            # Clamp
            cxn = max(0.0, min(1.0, cxn))
            cyn = max(0.0, min(1.0, cyn))
            wn = max(0.0, min(1.0, wn))
            hn = max(0.0, min(1.0, hn))

            # Resolve class index
            class_idx = int(class_index_resolver(bbox) if callable(class_index_resolver) else bbox.class_id)
            lines.append(f"{class_idx} {cxn:.6f} {cyn:.6f} {wn:.6f} {hn:.6f}")
            processed_count += 1

        logger.info("operations.transformations", f"Detection annotations transformation completed", "detection_transform_success", {
            "processed_annotations": processed_count,
            "skipped_annotations": skipped_count,
            "total_output_lines": len(lines),
            "image_width": img_w,
            "image_height": img_h
        })

        return lines
        
    except Exception as e:
        logger.error("errors.system", f"Detection annotations transformation failed", "detection_transform_failure", {
            "image_width": img_w,
            "image_height": img_h,
            "transform_config": transform_config,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise


def transform_polygon_points(
    points: List[Tuple[float, float]],
    img_w: int,
    img_h: int,
    transform_config: Dict[str, Dict[str, Any]],
) -> List[Tuple[float, float]]:
    """Apply flip/resize/rotate to polygon points in pixels and return pixel points.
    
    This function uses the AnnotationTransformer class for consistent transformation handling.
    """
    logger.debug("operations.transformations", f"Starting polygon points transformation", "polygon_transform_start", {
        "points_count": len(points),
        "image_width": img_w,
        "image_height": img_h,
        "transform_config": transform_config
    })
    
    try:
        # Create a polygon object
        polygon = PolygonPixels(points, 0)  # Class ID doesn't matter for this function
        
        # Use the AnnotationTransformer
        transformer = AnnotationTransformer()
        original_dims = (img_w, img_h)
        
        # Determine new dimensions after transformations
        resize_params = transform_config.get("resize", {}) if transform_config.get("resize", {}).get("enabled", False) else {}
        target_w = int(resize_params.get("width", img_w) or img_w)
        target_h = int(resize_params.get("height", img_h) or img_h)
        new_dims = (target_w, target_h)
        
        # Apply transformations
        transformed_annotations = transformer.apply_transformations(
            [polygon], transform_config, original_dims, new_dims
        )
        
        # Extract the transformed points
        if transformed_annotations and isinstance(transformed_annotations[0], PolygonPixels):
            transformed_polygon = transformed_annotations[0]
            transformed_points = transformed_polygon.points
            
            logger.info("operations.transformations", f"Polygon points transformation completed", "polygon_transform_success", {
                "input_points": len(points),
                "output_points": len(transformed_points),
                "image_width": target_w,
                "image_height": target_h
            })
            
            return transformed_points
        else:
            # Fallback to original points if transformation failed
            logger.warning("errors.validation", "Polygon transformation returned no valid results", "polygon_transform_empty")
            return points
        
    except Exception as e:
        logger.error("errors.system", f"Polygon points transformation failed", "polygon_transform_failure", {
            "points_count": len(points),
            "image_width": img_w,
            "image_height": img_h,
            "transform_config": transform_config,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise


def create_annotation_transformer_from_image_transformer(image_transformer) -> AnnotationTransformer:
    """Create an AnnotationTransformer instance from an image transformer.
    
    This function allows using the same transformation pipeline for both images and annotations,
    ensuring consistent transformation application and order.
    
    Args:
        image_transformer: The image transformer instance from image_generator.py
        
    Returns:
        An AnnotationTransformer instance configured with the same transformation order
    """
    annotation_transformer = AnnotationTransformer()
    
    # Copy transformation order if available
    if hasattr(image_transformer, "transformation_order"):
        annotation_transformer.transformation_order = image_transformer.transformation_order.copy()
    
    return annotation_transformer


def apply_transformations_to_annotations(
    annotations: List[Any],
    img_w: int,
    img_h: int,
    transformation_config: Dict[str, Dict[str, Any]],
    new_dims: Optional[Tuple[int, int]] = None
) -> List[Union[BoundingBoxPixels, PolygonPixels]]:
    """Apply transformations to a list of annotations (bounding boxes or polygons).
    
    This function extracts annotation data from various formats and applies the
    specified transformations using the AnnotationTransformer class.
    
    Args:
        annotations: List of annotation objects (ORM objects or dicts)
        img_w: Original image width
        img_h: Original image height
        transformation_config: Dictionary of transformation configurations
        new_dims: New image dimensions after transformations (width, height)
            If None, will be calculated from the resize parameters
            
    Returns:
        List of transformed annotations (BoundingBoxPixels or PolygonPixels)
    """
    logger.info("operations.transformations", f"Starting annotations transformation", "annotations_transform_start", {
        "annotation_count": len(annotations),
        "image_width": img_w,
        "image_height": img_h,
        "transformation_types": list(transformation_config.keys())
    })
    
    try:
        # Extract annotations to standard format
        extracted_annotations = []
        for ann in annotations:
            # Try to extract as bounding box
            bbox = _extract_bbox_pixels(ann, img_w, img_h)
            if bbox:
                extracted_annotations.append(bbox)
                continue
                
            # Try to extract as polygon
            polygon = _extract_polygon_pixels(ann, img_w, img_h)
            if polygon:
                extracted_annotations.append(polygon)
                continue
                
            logger.warning("errors.validation", "Could not extract annotation data", "annotation_extract_failed", {
                "annotation_type": type(ann).__name__
            })
        
        if not extracted_annotations:
            logger.warning("errors.validation", "No valid annotations to transform", "annotations_empty")
            return []
        
        # Determine new dimensions
        if new_dims is None:
            resize_params = transformation_config.get("resize", {}) if transformation_config.get("resize", {}).get("enabled", False) else {}
            target_w = int(resize_params.get("width", img_w) or img_w)
            target_h = int(resize_params.get("height", img_h) or img_h)
            
            # Ensure resize_mode is properly passed from image transformer
            if "resize_mode" not in resize_params and "mode" in resize_params:
                # Handle legacy mode parameter
                mode = resize_params.get("mode")
                if mode == "fit":
                    resize_params["resize_mode"] = "fit_within"
                elif mode == "stretch":
                    resize_params["resize_mode"] = "stretch_to"
            
            new_dims = (target_w, target_h)
        
        # Apply transformations
        transformer = AnnotationTransformer()
        transformed_annotations = transformer.apply_transformations(
            extracted_annotations, transformation_config, (img_w, img_h), new_dims
        )
        
        logger.info("operations.transformations", f"Annotations transformation completed", "annotations_transform_success", {
            "input_count": len(annotations),
            "extracted_count": len(extracted_annotations),
            "output_count": len(transformed_annotations)
        })
        
        return transformed_annotations
        
    except Exception as e:
        logger.error("errors.system", f"Annotations transformation failed", "annotations_transform_failure", {
            "annotation_count": len(annotations),
            "image_width": img_w,
            "image_height": img_h,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise


class AnnotationTransformer:
    """Dynamic annotation transformation pipeline that handles all 18 transformation tools.
    
    This class provides a unified interface for transforming annotations (bounding boxes and polygons)
    using the same transformation sequence as applied to images. It supports all 18 transformation tools
    with their different options (e.g., resize with fit, stretch options).
    """
    
    def __init__(self):
        """Initialize the annotation transformer."""
        logger.info("operations.transformations", "Initializing dynamic annotation transformer", "annotation_transformer_init")
    
    def apply_transformations(self, annotations: List[Union[BoundingBoxPixels, PolygonPixels]], 
                             transformation_config: Dict[str, Dict[str, Any]],
                             original_dims: Tuple[int, int],
                             new_dims: Tuple[int, int]) -> List[Union[BoundingBoxPixels, PolygonPixels]]:
        """Apply a sequence of transformations to annotations.
        
        Args:
            annotations: List of annotations (BoundingBoxPixels or PolygonPixels)
            transformation_config: Dictionary of transformation configurations
            original_dims: Original image dimensions (width, height)
            new_dims: New image dimensions after transformations (width, height)
            
        Returns:
            List of transformed annotations
        """
        if not annotations:
            return []
        
        logger.info("operations.transformations", "Applying transformations to annotations", "annotations_transform_start", {
            "annotation_count": len(annotations),
            "transformation_types": list(transformation_config.keys()),
            "original_dims": original_dims,
            "new_dims": new_dims
        })
        
        try:
            # Process transformations in the correct order
            # First apply resize if present (same as in image_transformer)
            ordered_transforms = self._get_ordered_transformations(transformation_config)
            
            updated_annotations = []
            for annotation in annotations:
                try:
                    updated_annotation = self._transform_single_annotation(
                        annotation, ordered_transforms, original_dims, new_dims
                    )
                    if updated_annotation:
                        updated_annotations.append(updated_annotation)
                except Exception as e:
                    logger.warning("errors.validation", f"Failed to update annotation: {str(e)}", "annotation_update_failed", {
                        "error": str(e),
                        "annotation_type": type(annotation).__name__
                    })
                    # Keep original annotation if update fails
                    updated_annotations.append(annotation)
            
            logger.info("operations.transformations", f"Updated {len(updated_annotations)} annotations", "annotations_updated", {
                "annotation_count": len(updated_annotations),
                "original_count": len(annotations)
            })
            
            return updated_annotations
            
        except Exception as e:
            logger.error("errors.system", f"Failed to apply transformations to annotations: {str(e)}", "annotations_transform_error", {
                "error": str(e),
                "transformation_config": transformation_config
            })
            # Return original annotations if transformation fails
            return annotations
    
    def _get_ordered_transformations(self, transformation_config: Dict[str, Dict[str, Any]]) -> List[Tuple[str, Dict[str, Any]]]:
        """Get transformations in the correct order for processing.
        
        Ensures resize is applied first, followed by other transformations in a specific order.
        """
        # Define transformation order (same as in image_transformer)
        # Resize should be first, followed by geometric transformations, then color/filter transformations
        transform_order = [
            "resize",       # Always first
            "rotate",      # Geometric transformations
            "flip",
            "crop",
            "affine",
            "perspective",
            "shear",
            # Other transformations follow but don't affect annotation coordinates
        ]
        
        # Start with resize if present
        ordered_transforms = []
        
        # Add transformations in the defined order
        for transform_type in transform_order:
            if transform_type in transformation_config and transformation_config[transform_type].get("enabled", True):
                # Handle legacy mode parameter for resize
                if transform_type == "resize":
                    params = transformation_config[transform_type].copy()
                    if "resize_mode" not in params and "mode" in params:
                        # Convert legacy mode parameter to resize_mode
                        mode = params.get("mode")
                        if mode == "fit":
                            params["resize_mode"] = "fit_within"
                        elif mode == "stretch":
                            params["resize_mode"] = "stretch_to"
                    ordered_transforms.append((transform_type, params))
                else:
                    ordered_transforms.append((transform_type, transformation_config[transform_type]))
        
        # Add any remaining transformations that affect annotations but weren't in the predefined order
        for transform_type, params in transformation_config.items():
            if transform_type not in transform_order and params.get("enabled", True):
                # Only add transformations that affect annotation coordinates
                if transform_type in ["cutout", "random_zoom"]:
                    ordered_transforms.append((transform_type, params))
        
        logger.debug("operations.transformations", "Ordered transformations for annotations", "annotations_transform_order", {
            "transform_order": [t[0] for t in ordered_transforms]
        })
        
        return ordered_transforms
    
    def _transform_single_annotation(self, annotation: Union[BoundingBoxPixels, PolygonPixels],
                                   ordered_transforms: List[Tuple[str, Dict[str, Any]]],
                                   original_dims: Tuple[int, int],
                                   new_dims: Tuple[int, int]) -> Optional[Union[BoundingBoxPixels, PolygonPixels]]:
        """Transform a single annotation based on ordered transformations."""
        
        if isinstance(annotation, BoundingBoxPixels):
            return self._transform_bbox(annotation, ordered_transforms, original_dims, new_dims)
        elif isinstance(annotation, PolygonPixels):
            return self._transform_polygon(annotation, ordered_transforms, original_dims, new_dims)
        else:
            return annotation
    
    def _transform_bbox(self, bbox: BoundingBoxPixels, 
                       ordered_transforms: List[Tuple[str, Dict[str, Any]]],
                       original_dims: Tuple[int, int], 
                       new_dims: Tuple[int, int]) -> Optional[BoundingBoxPixels]:
        """Transform bounding box coordinates based on ordered transformations."""
        
        # Start with original coordinates
        x_min, y_min, x_max, y_max = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max
        orig_width, orig_height = original_dims
        curr_width, curr_height = orig_width, orig_height
        
        # Apply each transformation in order
        for transform_name, params in ordered_transforms:
            if transform_name == "resize":
                # Get target dimensions
                target_width = int(params.get("width", curr_width))
                target_height = int(params.get("height", curr_height))
                resize_mode = params.get("resize_mode", "stretch_to")
                
                # Calculate scale factors based on resize mode
                if resize_mode in ["fit_within", "fit_reflect_edges", "fit_black_edges", "fit_white_edges"]:
                    # Maintain aspect ratio for all fit modes
                    original_aspect = curr_width / curr_height
                    target_aspect = target_width / target_height
                    
                    if original_aspect > target_aspect:
                        # Original is wider - scale by width
                        new_width = target_width
                        new_height = int(target_width / original_aspect)
                        width_scale = target_width / curr_width
                        height_scale = new_height / curr_height
                    else:
                        # Original is taller - scale by height
                        new_height = target_height
                        new_width = int(target_height * original_aspect)
                        width_scale = new_width / curr_width
                        height_scale = target_height / curr_height
                        
                elif resize_mode == "fill_center_crop":
                    # Fill with center crop - scale to fill, then crop center
                    original_aspect = curr_width / curr_height
                    target_aspect = target_width / target_height
                    
                    if original_aspect > target_aspect:
                        # Original is wider - scale by height, crop width
                        scale_height = target_height
                        scale_width = int(target_height * original_aspect)
                        width_scale = scale_width / curr_width
                        height_scale = target_height / curr_height
                    else:
                        # Original is taller - scale by width, crop height
                        scale_width = target_width
                        scale_height = int(target_width / original_aspect)
                        width_scale = target_width / curr_width
                        height_scale = scale_height / curr_height
                    
                    new_width = target_width
                    new_height = target_height
                else:  # "stretch_to" mode or default
                    width_scale = target_width / curr_width
                    height_scale = target_height / curr_height
                    new_width = target_width
                    new_height = target_height
                
                # Scale coordinates
                x_min *= width_scale
                x_max *= width_scale
                y_min *= height_scale
                y_max *= height_scale
                
                # Update current dimensions
                curr_width, curr_height = new_width, new_height
                
            elif transform_name == "flip":
                if params.get("horizontal", False):
                    # Flip horizontally
                    x_min, x_max = curr_width - x_max, curr_width - x_min
                if params.get("vertical", False):
                    # Flip vertically
                    y_min, y_max = curr_height - y_max, curr_height - y_min
            
            elif transform_name == "rotate":
                # Get rotation angle
                angle_deg = float(params.get("angle", 0))
                # Get fill color (not directly used for annotation transformation but logged for consistency)
                fill_color = params.get("fill_color", "white")
                
                if angle_deg != 0:
                    # Convert to radians
                    angle_rad = math.radians(angle_deg)
                    
                    # Get center of rotation
                    cx, cy = curr_width / 2, curr_height / 2
                    
                    # Rotate all four corners of the bounding box
                    corners = [
                        (x_min, y_min),
                        (x_max, y_min),
                        (x_max, y_max),
                        (x_min, y_max)
                    ]
                    
                    rotated_corners = [
                        _rotate_point_cxcy(x, y, cx, cy, angle_rad)
                        for x, y in corners
                    ]
                    
                    # Get the bounding box of the rotated corners
                    xs = [x for x, _ in rotated_corners]
                    ys = [y for _, y in rotated_corners]
                    
                    x_min = max(0, min(xs))
                    y_min = max(0, min(ys))
                    x_max = min(curr_width, max(xs))
                    y_max = min(curr_height, max(ys))
                    
                    # Log rotation with fill color for consistency with image transformer
                    logger.info("operations.transformations", f"Applied rotation to annotation", "annotation_rotate", {
                        "angle": angle_deg,
                        "fill_color": fill_color
                    })
            
            elif transform_name == "crop":
                # Get crop parameters
                crop_left = float(params.get("left", 0)) * curr_width / 100
                crop_top = float(params.get("top", 0)) * curr_height / 100
                crop_width = float(params.get("width", 100)) * curr_width / 100
                crop_height = float(params.get("height", 100)) * curr_height / 100
                
                # Adjust coordinates based on crop
                x_min = max(0, x_min - crop_left)
                y_min = max(0, y_min - crop_top)
                x_max = max(0, x_max - crop_left)
                y_max = max(0, y_max - crop_top)
                
                # Update current dimensions
                curr_width, curr_height = crop_width, crop_height
                
                # Check if bbox is outside crop area
                if x_min >= crop_width or y_min >= crop_height or x_max <= 0 or y_max <= 0:
                    return None
                
                # Clamp to crop boundaries
                x_min = max(0, min(x_min, crop_width))
                y_min = max(0, min(y_min, crop_height))
                x_max = max(0, min(x_max, crop_width))
                y_max = max(0, min(y_max, crop_height))
                
            elif transform_name == "shear":
                # Get shear angle
                shear_angle = float(params.get("shear_angle", params.get("angle", 0)))
                
                if shear_angle != 0:
                    # Convert to radians
                    angle_rad = math.radians(shear_angle)
                    
                    # Apply horizontal shear to each corner of the bounding box
                    # Shear formula: x' = x + y * tan(angle), y' = y
                    shear_factor = math.tan(angle_rad)
                    
                    # Convert corners to points for shearing
                    corners = [
                        (x_min, y_min),  # top-left
                        (x_max, y_min),  # top-right
                        (x_max, y_max),  # bottom-right
                        (x_min, y_max)   # bottom-left
                    ]
                    
                    # Apply shear to each corner
                    sheared_corners = []
                    for x, y in corners:
                        # Apply horizontal shear
                        new_x = x + y * shear_factor
                        sheared_corners.append((new_x, y))
                    
                    # Get new bounding box from sheared corners
                    x_coords = [p[0] for p in sheared_corners]
                    y_coords = [p[1] for p in sheared_corners]
                    x_min, x_max = min(x_coords), max(x_coords)
                    y_min, y_max = min(y_coords), max(y_coords)
                    
                    # Ensure bounding box stays within image boundaries
                    x_min = max(0, x_min)
                    y_min = max(0, y_min)
                    x_max = min(curr_width, x_max)
                    y_max = min(curr_height, y_max)
                    
                    logger.info("operations.transformations", f"Applied shear to bounding box", "bbox_shear", {
                        "angle": shear_angle,
                        "shear_factor": shear_factor,
                        "original_bbox": corners,
                        "sheared_bbox": (x_min, y_min, x_max, y_max)
                    })
                
            elif transform_name == "affine":
                # Get affine parameters
                # Support both old and new parameter names for compatibility
                rotation_angle = float(params.get("rotation_angle", params.get("rotate", 0)))
                scale_factor = float(params.get("scale_factor", params.get("scale", 1.0)))
                
                # Handle horizontal shift (convert percentage to pixels if needed)
                horizontal_shift = float(params.get("horizontal_shift", params.get("shift_x", 0)))
                if -20 <= horizontal_shift <= 20:  # New percentage format
                    shift_x_factor = horizontal_shift / 100.0
                else:  # Old factor format
                    shift_x_factor = horizontal_shift
                
                # Handle vertical shift (convert percentage to pixels if needed)
                vertical_shift = float(params.get("vertical_shift", params.get("shift_y", 0)))
                if -20 <= vertical_shift <= 20:  # New percentage format
                    shift_y_factor = vertical_shift / 100.0
                else:  # Old factor format
                    shift_y_factor = vertical_shift
                
                # Calculate pixel shifts
                shift_x_pixels = int(curr_width * shift_x_factor)
                shift_y_pixels = int(curr_height * shift_y_factor)
                
                # Apply rotation if needed
                if rotation_angle != 0:
                    # Get center of bounding box
                    center_x = (x_min + x_max) / 2
                    center_y = (y_min + y_max) / 2
                    
                    # Convert corners to points for rotation
                    corners = [
                        (x_min, y_min),  # top-left
                        (x_max, y_min),  # top-right
                        (x_max, y_max),  # bottom-right
                        (x_min, y_max)   # bottom-left
                    ]
                    
                    # Rotate each corner around the center
                    rotated_corners = []
                    for x, y in corners:
                        # Translate point to origin
                        x_centered = x - center_x
                        y_centered = y - center_y
                        
                        # Rotate
                        angle_rad = math.radians(rotation_angle)
                        x_rotated = x_centered * math.cos(angle_rad) - y_centered * math.sin(angle_rad)
                        y_rotated = x_centered * math.sin(angle_rad) + y_centered * math.cos(angle_rad)
                        
                        # Translate back
                        rotated_corners.append((x_rotated + center_x, y_rotated + center_y))
                    
                    # Get new bounding box from rotated corners
                    x_coords = [p[0] for p in rotated_corners]
                    y_coords = [p[1] for p in rotated_corners]
                    x_min, x_max = min(x_coords), max(x_coords)
                    y_min, y_max = min(y_coords), max(y_coords)
                    
                    logger.info("operations.transformations", f"Applied rotation to bounding box in affine transform", "bbox_affine_rotation", {
                        "angle": rotation_angle,
                        "center": (center_x, center_y),
                        "original_bbox": (x_min, y_min, x_max, y_max),
                        "rotated_bbox": (min(x_coords), min(y_coords), max(x_coords), max(y_coords))
                    })
                
                # Apply scaling if needed
                if scale_factor != 1.0:
                    # Get center of bounding box
                    center_x = (x_min + x_max) / 2
                    center_y = (y_min + y_max) / 2
                    
                    # Calculate width and height
                    width = x_max - x_min
                    height = y_max - y_min
                    
                    # Scale width and height
                    new_width = width * scale_factor
                    new_height = height * scale_factor
                    
                    # Calculate new coordinates based on center
                    x_min = center_x - (new_width / 2)
                    y_min = center_y - (new_height / 2)
                    x_max = center_x + (new_width / 2)
                    y_max = center_y + (new_height / 2)
                    
                    logger.info("operations.transformations", f"Applied scaling to bounding box in affine transform", "bbox_affine_scaling", {
                        "scale_factor": scale_factor,
                        "center": (center_x, center_y),
                        "original_width_height": (width, height),
                        "scaled_width_height": (new_width, new_height)
                    })
                
                # Apply shifts if needed
                if shift_x_pixels != 0 or shift_y_pixels != 0:
                    x_min += shift_x_pixels
                    x_max += shift_x_pixels
                    y_min += shift_y_pixels
                    y_max += shift_y_pixels
                    
                    logger.info("operations.transformations", f"Applied shifts to bounding box in affine transform", "bbox_affine_shifts", {
                        "shift_x_pixels": shift_x_pixels,
                        "shift_y_pixels": shift_y_pixels,
                        "horizontal_shift": horizontal_shift,
                        "vertical_shift": vertical_shift
                    })
            
            elif transform_name == "shear":
                # Get shear angle
                shear_angle = float(params.get("shear_angle", params.get("angle", 0)))
                
                if shear_angle != 0:
                    # Convert to radians
                    angle_rad = math.radians(shear_angle)
                    
                    # Apply horizontal shear to each point
                    # Shear formula: x' = x + y * tan(angle), y' = y
                    shear_factor = math.tan(angle_rad)
                    
                    # Apply shear to each point
                    sheared_points = []
                    for x, y in points:
                        # Apply horizontal shear
                        new_x = x + y * shear_factor
                        sheared_points.append((new_x, y))
                    
                    points = sheared_points
                    
                    logger.info("operations.transformations", f"Applied shear to polygon", "polygon_shear", {
                        "angle": shear_angle,
                        "shear_factor": shear_factor,
                        "points_count": len(points)
                    })
            
            # Add more transformations as needed
        
        # Ensure coordinates are within bounds of final dimensions
        final_width, final_height = new_dims
        x_min = max(0, min(x_min, final_width))
        y_min = max(0, min(y_min, final_height))
        x_max = max(0, min(x_max, final_width))
        y_max = max(0, min(y_max, final_height))
        
        # Ensure min < max
        if x_min >= x_max or y_min >= y_max:
            logger.warning("errors.validation", "Invalid bounding box after transformation, skipping", "invalid_bbox_skipped", {
                'bbox_coords': (x_min, y_min, x_max, y_max),
                'original_dims': original_dims,
                'new_dims': new_dims
            })
            return None
        
        return BoundingBoxPixels(x_min, y_min, x_max, y_max, bbox.class_id)
    
    def _transform_polygon(self, polygon: PolygonPixels,
                          ordered_transforms: List[Tuple[str, Dict[str, Any]]],
                          original_dims: Tuple[int, int],
                          new_dims: Tuple[int, int]) -> Optional[PolygonPixels]:
        """Transform polygon coordinates based on ordered transformations."""
        
        # Start with original points
        points = polygon.points.copy()
        orig_width, orig_height = original_dims
        curr_width, curr_height = orig_width, orig_height
        
        # Apply each transformation in order
        for transform_name, params in ordered_transforms:
            if transform_name == "resize":
                # Get target dimensions
                target_width = int(params.get("width", curr_width))
                target_height = int(params.get("height", curr_height))
                resize_mode = params.get("resize_mode", "stretch_to")
                
                # Calculate scale factors based on resize mode
                if resize_mode in ["fit_within", "fit_reflect_edges", "fit_black_edges", "fit_white_edges"]:
                    # Maintain aspect ratio for all fit modes
                    original_aspect = curr_width / curr_height
                    target_aspect = target_width / target_height
                    
                    if original_aspect > target_aspect:
                        # Original is wider - scale by width
                        new_width = target_width
                        new_height = int(target_width / original_aspect)
                        width_scale = target_width / curr_width
                        height_scale = new_height / curr_height
                    else:
                        # Original is taller - scale by height
                        new_height = target_height
                        new_width = int(target_height * original_aspect)
                        width_scale = new_width / curr_width
                        height_scale = target_height / curr_height
                        
                elif resize_mode == "fill_center_crop":
                    # Fill with center crop - scale to fill, then crop center
                    original_aspect = curr_width / curr_height
                    target_aspect = target_width / target_height
                    
                    if original_aspect > target_aspect:
                        # Original is wider - scale by height, crop width
                        scale_height = target_height
                        scale_width = int(target_height * original_aspect)
                        width_scale = scale_width / curr_width
                        height_scale = target_height / curr_height
                    else:
                        # Original is taller - scale by width, crop height
                        scale_width = target_width
                        scale_height = int(target_width / original_aspect)
                        width_scale = target_width / curr_width
                        height_scale = scale_height / curr_height
                    
                    new_width = target_width
                    new_height = target_height
                else:  # "stretch_to" mode or default
                    width_scale = target_width / curr_width
                    height_scale = target_height / curr_height
                    new_width = target_width
                    new_height = target_height
                
                # Scale coordinates
                points = [(x * width_scale, y * height_scale) for x, y in points]
                
                # Update current dimensions
                curr_width, curr_height = new_width, new_height
                
            elif transform_name == "flip":
                if params.get("horizontal", False):
                    # Flip horizontally
                    points = [(curr_width - x, y) for x, y in points]
                if params.get("vertical", False):
                    # Flip vertically
                    points = [(x, curr_height - y) for x, y in points]
            
            elif transform_name == "rotate":
                # Get rotation angle
                angle_deg = float(params.get("angle", 0))
                # Get fill color (not directly used for annotation transformation but logged for consistency)
                fill_color = params.get("fill_color", "white")
                
                if angle_deg != 0:
                    # Convert to radians
                    angle_rad = math.radians(angle_deg)
                    
                    # Get center of rotation
                    cx, cy = curr_width / 2, curr_height / 2
                    
                    # Rotate all points
                    points = [
                        _rotate_point_cxcy(x, y, cx, cy, angle_rad)
                        for x, y in points
                    ]
                    
                    # Log rotation with fill color for consistency with image transformer
                    logger.info("operations.transformations", f"Applied rotation to polygon annotation", "polygon_annotation_rotate", {
                        "angle": angle_deg,
                        "fill_color": fill_color,
                        "points_count": len(points)
                    })
            
            elif transform_name == "crop":
                # Get crop parameters
                crop_left = float(params.get("left", 0)) * curr_width / 100
                crop_top = float(params.get("top", 0)) * curr_height / 100
                crop_width = float(params.get("width", 100)) * curr_width / 100
                crop_height = float(params.get("height", 100)) * curr_height / 100
                
                # Adjust coordinates based on crop
                points = [
                    (max(0, x - crop_left), max(0, y - crop_top))
                    for x, y in points
                ]
                
                # Update current dimensions
                curr_width, curr_height = crop_width, crop_height
                
                # Clamp to crop boundaries
                points = [
                    (max(0, min(x, crop_width)), max(0, min(y, crop_height)))
                    for x, y in points
                ]
                
            elif transform_name == "affine":
                # Get affine parameters
                # Support both old and new parameter names for compatibility
                rotation_angle = float(params.get("rotation_angle", params.get("rotate", 0)))
                scale_factor = float(params.get("scale_factor", params.get("scale", 1.0)))
                
                # Handle horizontal shift (convert percentage to pixels if needed)
                horizontal_shift = float(params.get("horizontal_shift", params.get("shift_x", 0)))
                if -20 <= horizontal_shift <= 20:  # New percentage format
                    shift_x_factor = horizontal_shift / 100.0
                else:  # Old factor format
                    shift_x_factor = horizontal_shift
                
                # Handle vertical shift (convert percentage to pixels if needed)
                vertical_shift = float(params.get("vertical_shift", params.get("shift_y", 0)))
                if -20 <= vertical_shift <= 20:  # New percentage format
                    shift_y_factor = vertical_shift / 100.0
                else:  # Old factor format
                    shift_y_factor = vertical_shift
                
                # Calculate pixel shifts
                shift_x_pixels = int(curr_width * shift_x_factor)
                shift_y_pixels = int(curr_height * shift_y_factor)
                
                # Calculate centroid of polygon for rotation and scaling
                if len(points) > 0:
                    centroid_x = sum(p[0] for p in points) / len(points)
                    centroid_y = sum(p[1] for p in points) / len(points)
                    
                    # Apply rotation if needed
                    if rotation_angle != 0:
                        angle_rad = math.radians(rotation_angle)
                        rotated_points = []
                        
                        for x, y in points:
                            # Translate point to origin
                            x_centered = x - centroid_x
                            y_centered = y - centroid_y
                            
                            # Rotate
                            x_rotated = x_centered * math.cos(angle_rad) - y_centered * math.sin(angle_rad)
                            y_rotated = x_centered * math.sin(angle_rad) + y_centered * math.cos(angle_rad)
                            
                            # Translate back
                            rotated_points.append((x_rotated + centroid_x, y_rotated + centroid_y))
                        
                        points = rotated_points
                        
                        logger.info("operations.transformations", f"Applied rotation to polygon in affine transform", "polygon_affine_rotation", {
                            "angle": rotation_angle,
                            "centroid": (centroid_x, centroid_y),
                            "points_count": len(points)
                        })
                    
                    # Apply scaling if needed
                    if scale_factor != 1.0:
                        scaled_points = []
                        
                        for x, y in points:
                            # Calculate vector from centroid to point
                            dx = x - centroid_x
                            dy = y - centroid_y
                            
                            # Scale vector
                            dx_scaled = dx * scale_factor
                            dy_scaled = dy * scale_factor
                            
                            # Calculate new point
                            scaled_points.append((centroid_x + dx_scaled, centroid_y + dy_scaled))
                        
                        points = scaled_points
                        
                        logger.info("operations.transformations", f"Applied scaling to polygon in affine transform", "polygon_affine_scaling", {
                            "scale_factor": scale_factor,
                            "centroid": (centroid_x, centroid_y),
                            "points_count": len(points)
                        })
                
                # Apply shifts if needed
                if shift_x_pixels != 0 or shift_y_pixels != 0:
                    points = [
                        (x + shift_x_pixels, y + shift_y_pixels)
                        for x, y in points
                    ]
                    
                    logger.info("operations.transformations", f"Applied shifts to polygon in affine transform", "polygon_affine_shifts", {
                        "shift_x_pixels": shift_x_pixels,
                        "shift_y_pixels": shift_y_pixels,
                        "horizontal_shift": horizontal_shift,
                        "vertical_shift": vertical_shift,
                        "points_count": len(points)
                    })
            
            # Add more transformations as needed
        
        # Ensure all points are within bounds of final dimensions
        final_width, final_height = new_dims
        valid_points = [
            (max(0, min(x, final_width)), max(0, min(y, final_height)))
            for x, y in points
        ]
        
        # Check if we have enough valid points for a polygon (at least 3)
        if len(valid_points) < 3:
            logger.warning("errors.validation", "Invalid polygon after transformation, skipping", "invalid_polygon_skipped", {
                'points_count': len(valid_points),
                'original_dims': original_dims,
                'new_dims': new_dims
            })
            return None
        
        return PolygonPixels(valid_points, polygon.class_id)


def transform_segmentation_annotations_to_yolo(
    annotations: Iterable[Any],
    img_w: int,
    img_h: int,
    transform_config: Dict[str, Dict[str, Any]],
    class_index_resolver=None,
) -> List[str]:
    """Convert polygon annotations to YOLO segmentation lines after transforms.
    
    Uses the AnnotationTransformer class for consistent transformation handling.
    
    Args:
        annotations: List of annotation objects (ORM objects or dicts)
        img_w: Original image width
        img_h: Original image height
        transform_config: Dictionary of transformation configurations
        class_index_resolver: Optional function to resolve class index from annotation
        
    Returns:
        List of YOLO format segmentation lines
    """
    logger.info("operations.transformations", f"Starting segmentation annotations transformation to YOLO", "segmentation_transform_start", {
        "image_width": img_w,
        "image_height": img_h,
        "transform_config": transform_config
    })
    
    try:
        # Determine new dimensions after transformations
        resize_params = transform_config.get("resize", {}) if transform_config.get("resize", {}).get("enabled", False) else {}
        target_w = int(resize_params.get("width", img_w) or img_w)
        target_h = int(resize_params.get("height", img_h) or img_h)
        new_dims = (target_w, target_h)
        
        # Use the apply_transformations_to_annotations function
        transformed_annotations = apply_transformations_to_annotations(
            list(annotations), img_w, img_h, transform_config, new_dims
        )
        
        lines: List[str] = []
        processed_count = 0
        skipped_count = 0
        
        for ann in transformed_annotations:
            if not isinstance(ann, PolygonPixels) or len(ann.points) < 3:
                skipped_count += 1
                continue
                
            # Resolve class index
            class_id = int(class_index_resolver(ann) if callable(class_index_resolver) else ann.class_id)
            
            # Normalize points to 0-1 range
            norm = []
            for x, y in ann.points:
                nx = max(0.0, min(1.0, x / target_w))
                ny = max(0.0, min(1.0, y / target_h))
                norm.extend([f"{nx:.6f}", f"{ny:.6f}"])
                
            if len(norm) >= 6:  # At least 3 points (6 coordinates)
                lines.append(" ".join([str(class_id)] + norm))
                processed_count += 1
            else:
                skipped_count += 1

        logger.info("operations.transformations", f"Segmentation annotations transformation completed", "segmentation_transform_success", {
            "processed_annotations": processed_count,
            "skipped_annotations": skipped_count,
            "total_output_lines": len(lines),
            "image_width": target_w,
            "image_height": target_h
        })

        return lines
        
    except Exception as e:
        logger.error("errors.system", f"Segmentation annotations transformation failed", "segmentation_transform_failure", {
            "image_width": img_w,
            "image_height": img_h,
            "transform_config": transform_config,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise


