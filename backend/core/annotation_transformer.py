"""
Annotation geometry transformer

Provides reusable utilities to transform annotation coordinates (bounding boxes
and polygons) for common geometric image transformations, ensuring label
coordinates stay consistent with augmented images.

This module is designed to be used by the release pipeline and any other
exporters that require label updates after transformations.
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
class BoundingBox:
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    class_name: str
    class_id: int
    confidence: float = 1.0


@dataclass
class Polygon:
    points: List[Tuple[float, float]]
    class_name: str
    class_id: int
    confidence: float = 1.0


def _is_normalized_box(x_min: float, y_min: float, x_max: float, y_max: float) -> bool:
    return 0.0 <= x_min <= 1.0 and 0.0 <= y_min <= 1.0 and 0.0 <= x_max <= 1.0 and 0.0 <= y_max <= 1.0


def _rotate_point_cxcy(x: float, y: float, cx: float, cy: float, rad: float) -> Tuple[float, float]:
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    dx, dy = x - cx, y - cy
    return cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a


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


def update_annotations_for_transformations(annotations: List[Union[BoundingBox, Polygon]], 
                                         transformation_config: Dict[str, Any],
                                         original_dims: Tuple[int, int],
                                         new_dims: Tuple[int, int]) -> List[Union[BoundingBox, Polygon]]:
    """
    Update annotations based on applied transformations with dual-value support
    Phase 1: Basic annotation updates for common transformations
    """
    if not annotations:
        return []
    
    updated_annotations = []
    
    for annotation in annotations:
        try:
            updated_annotation = _transform_single_annotation(
                annotation, transformation_config, original_dims, new_dims
            )
            if updated_annotation:
                updated_annotations.append(updated_annotation)
        except Exception as e:
            logger.warning("errors.validation", f"Failed to update annotation: {str(e)}", "annotation_update_failed", {
                'error': str(e),
                'annotation_type': type(annotation).__name__
            })
            # Keep original annotation if update fails
            updated_annotations.append(annotation)
    
    logger.info("operations.transformations", f"Updated {len(updated_annotations)} annotations", "annotations_updated", {
        'annotation_count': len(updated_annotations),
        'original_count': len(annotations)
    })
    return updated_annotations


def _transform_single_annotation(annotation: Union[BoundingBox, Polygon],
                               transformation_config: Dict[str, Any],
                               original_dims: Tuple[int, int],
                               new_dims: Tuple[int, int]) -> Optional[Union[BoundingBox, Polygon]]:
    """Transform a single annotation based on transformations applied"""
    
    # For Phase 1, we'll handle basic transformations that don't change coordinates
    # More complex transformations will be added in later phases
    
    if isinstance(annotation, BoundingBox):
        return _transform_bbox(annotation, transformation_config, original_dims, new_dims)
    elif isinstance(annotation, Polygon):
        return _transform_polygon(annotation, transformation_config, original_dims, new_dims)
    else:
        return annotation


def _transform_bbox(bbox: BoundingBox, transformation_config: Dict[str, Any],
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
        logger.warning("errors.validation", "Invalid bounding box after transformation, skipping", "invalid_bbox_skipped", {
            'bbox_coords': (x_min, y_min, x_max, y_max),
            'original_dims': original_dims,
            'new_dims': new_dims
        })
        return None
    
    return BoundingBox(x_min, y_min, x_max, y_max, bbox.class_name, bbox.class_id, bbox.confidence)


def _transform_polygon(polygon: Polygon, transformation_config: Dict[str, Any],
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
    
    # Ensure we have at least 3 points for a valid polygon
    if len(valid_points) < 3:
        logger.warning("errors.validation", "Polygon has less than 3 valid points after transformation, skipping", "invalid_polygon_skipped", {
            'valid_points': len(valid_points),
            'original_points': len(polygon.points)
        })
        return None
    
    return Polygon(valid_points, polygon.class_name, polygon.class_id, polygon.confidence)