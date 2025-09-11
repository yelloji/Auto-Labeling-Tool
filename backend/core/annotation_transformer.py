"""
Annotation geometry transformer

Provides reusable utilities to transform annotation coordinates (bounding boxes
and polygons) using either:
  - a precise 3x3 homogeneous transform matrix (preferred), or
  - the legacy sequential config-based approach (fallback).

This keeps labels consistent with augmented images.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union
import numpy as np
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


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


# ---------------------------
# Helpers for matrix-based path
# ---------------------------

def _apply_matrix_to_point(A: np.ndarray, x: float, y: float) -> Tuple[float, float]:
    """Apply a 3x3 homogeneous transform (affine or perspective) to a point."""
    p = np.array([x, y, 1.0], dtype=float).reshape(3, 1)
    p2 = A @ p
    w = p2[2, 0]
    if abs(w) < 1e-12:
        # Extremely rare; avoid divide-by-zero. Return large/sentinel-ish but log it.
        logger.warning("errors.validation", "Homography w ~ 0 while transforming point", "homography_w_near_zero", {
            "x": x, "y": y, "w": float(w)
        })
        w = 1e-12
    return (p2[0, 0] / w, p2[1, 0] / w)


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _clip_bbox_to_dims(x_min: float, y_min: float, x_max: float, y_max: float,
                       width: int, height: int) -> Optional[Tuple[float, float, float, float]]:
    x_min = _clip(x_min, 0, width)
    x_max = _clip(x_max, 0, width)
    y_min = _clip(y_min, 0, height)
    y_max = _clip(y_max, 0, height)
    if x_min >= x_max or y_min >= y_max:
        return None
    return (x_min, y_min, x_max, y_max)


def _transform_bbox_with_matrix(bbox: BoundingBox, A: np.ndarray,
                                new_dims: Tuple[int, int]) -> Optional[BoundingBox]:
    x_min, y_min, x_max, y_max = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max
    corners = [
        (x_min, y_min),
        (x_max, y_min),
        (x_min, y_max),
        (x_max, y_max),
    ]
    tx = []
    ty = []
    for (x, y) in corners:
        x2, y2 = _apply_matrix_to_point(A, x, y)
        tx.append(x2); ty.append(y2)

    new_x_min, new_x_max = min(tx), max(tx)
    new_y_min, new_y_max = min(ty), max(ty)

    w, h = new_dims
    clipped = _clip_bbox_to_dims(new_x_min, new_y_min, new_x_max, new_y_max, w, h)
    if clipped is None:
        logger.warning("errors.validation", "Invalid bounding box after matrix transform, skipping",
                       "invalid_bbox_after_matrix", {
                           "old": [x_min, y_min, x_max, y_max],
                           "new": [new_x_min, new_y_min, new_x_max, new_y_max],
                           "new_dims": new_dims
                       })
        return None

    cx_min, cy_min, cx_max, cy_max = clipped
    return BoundingBox(cx_min, cy_min, cx_max, cy_max, bbox.class_name, bbox.class_id, bbox.confidence)


def _transform_polygon_with_matrix(polygon: Polygon, A: np.ndarray,
                                   new_dims: Tuple[int, int]) -> Optional[Polygon]:
    w, h = new_dims
    out: List[Tuple[float, float]] = []
    for (x, y) in polygon.points:
        x2, y2 = _apply_matrix_to_point(A, x, y)
        # clip to image bounds
        out.append((_clip(x2, 0, w), _clip(y2, 0, h)))

    # keep only valid polygons (>=3 points)
    if len(out) < 3:
        logger.warning("errors.validation", "Polygon < 3 points after matrix transform, skipping",
                       "invalid_polygon_after_matrix", {"original_points": len(polygon.points)})
        return None

    return Polygon(out, polygon.class_name, polygon.class_id, polygon.confidence)


# ------------------------------------------------------
# Public API (now supports precise matrix A if provided)
# ------------------------------------------------------

def update_annotations_for_transformations(
    annotations: List[Union[BoundingBox, Polygon]],
    transformation_config: Dict[str, Any],
    original_dims: Tuple[int, int],
    new_dims: Tuple[int, int],
    affine_matrix: Optional[Union[List[float], List[List[float]], np.ndarray]] = None
) -> List[Union[BoundingBox, Polygon]]:
    """
    Update annotations based on applied transformations.

    Preferred path:
        If `affine_matrix` (3x3) is provided, use it to transform geometry exactly,
        then clip to `new_dims`.

    Fallback path:
        Use the legacy sequential config-based method to approximate updates.

    Args:
        annotations: list of BoundingBox / Polygon
        transformation_config: the (resolved) config used for the image
        original_dims: (width, height) of source image
        new_dims: (width, height) of resulting image
        affine_matrix: optional 3x3 matrix (list or np.ndarray) used on pixels

    Returns:
        List of updated annotations (invalid ones are dropped).
    """
    if not annotations:
        return []

    logger.info("operations.transformations", f"Updating {len(annotations)} annotations", "annotations_update_start", {
        'annotation_count': len(annotations),
        'transformation_types': list(transformation_config.keys()),
        'original_dims': original_dims,
        'new_dims': new_dims,
        'has_affine_matrix': affine_matrix is not None
    })

    updated_annotations: List[Union[BoundingBox, Polygon]] = []

    # --- Matrix-based precise path ---
    if affine_matrix is not None:
        try:
            # normalize to 3x3 np.ndarray
            A = np.array(affine_matrix, dtype=float).reshape(3, 3)
        except Exception as e:
            logger.error("errors.validation", f"Bad affine_matrix shape/value: {str(e)}; falling back to legacy path",
                         "affine_matrix_invalid", {})
            A = None

        if A is not None:
            for ann in annotations:
                try:
                    if isinstance(ann, BoundingBox):
                        u = _transform_bbox_with_matrix(ann, A, new_dims)
                        if u is not None:
                            updated_annotations.append(u)
                    elif isinstance(ann, Polygon):
                        u = _transform_polygon_with_matrix(ann, A, new_dims)
                        if u is not None:
                            updated_annotations.append(u)
                    else:
                        updated_annotations.append(ann)
                except Exception as e:
                    logger.warning("errors.validation", f"Matrix-based annotation update failed: {str(e)}",
                                   "annotation_update_failed_matrix", {"type": type(ann).__name__})
                    updated_annotations.append(ann)

            logger.info("operations.transformations", f"Updated {len(updated_annotations)} annotations (matrix path)",
                        "annotations_updated_matrix", {
                            'annotation_count': len(updated_annotations),
                            'original_count': len(annotations)
                        })
            return updated_annotations

    # --- Legacy fallback (sequential config order) ---
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
            updated_annotations.append(annotation)

    logger.info("operations.transformations", f"Updated {len(updated_annotations)} annotations (legacy path)",
                "annotations_updated", {
                    'annotation_count': len(updated_annotations),
                    'original_count': len(annotations)
                })
    return updated_annotations


# ------------------------------------------------------
# Legacy per-transform fallback (unchanged from before)
# ------------------------------------------------------

def _transform_single_annotation(annotation: Union[BoundingBox, Polygon],
                                 transformation_config: Dict[str, Any],
                                 original_dims: Tuple[int, int],
                                 new_dims: Tuple[int, int]) -> Optional[Union[BoundingBox, Polygon]]:
    """Legacy path: transform a single annotation using old method with sequential order."""
    if isinstance(annotation, BoundingBox):
        return _transform_bbox(annotation, transformation_config, original_dims, new_dims)
    elif isinstance(annotation, Polygon):
        return _transform_polygon(annotation, transformation_config, original_dims, new_dims)
    else:
        return annotation


def _transform_bbox(bbox: BoundingBox, transformation_config: Dict[str, Any],
                    original_dims: Tuple[int, int], new_dims: Tuple[int, int]) -> Optional[BoundingBox]:
    """Legacy: bbox updates by sequential transforms (approximation)."""
    x_min, y_min, x_max, y_max = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max
    orig_width, orig_height = original_dims
    new_width, new_height = new_dims

    current_width, current_height = orig_width, orig_height
    coordinate_transforms = {'resize', 'rotate', 'flip', 'crop', 'random_zoom', 'affine_transform', 'perspective_warp', 'shear'}

    for transform_name, params in transformation_config.items():
        if transform_name in coordinate_transforms and params.get('enabled', True):
            if transform_name == 'flip':
                if params.get('horizontal', False):
                    x_min, x_max = current_width - x_max, current_width - x_min
                if params.get('vertical', False):
                    y_min, y_max = current_height - y_max, current_height - y_min

            elif transform_name == 'resize':
                target_width = params.get('width', 640)
                target_height = params.get('height', 640)
                resize_mode = params.get('resize_mode', 'stretch_to')

                if resize_mode == 'stretch_to':
                    width_ratio = target_width / current_width
                    height_ratio = target_height / current_height
                    x_min *= width_ratio; x_max *= width_ratio
                    y_min *= height_ratio; y_max *= height_ratio
                    current_width, current_height = target_width, target_height

                elif resize_mode == 'fill_center_crop':
                    original_aspect = current_width / current_height
                    target_aspect = target_width / target_height
                    if original_aspect > target_aspect:
                        scale_factor = target_height / current_height
                        scaled_width = int(current_width * scale_factor)
                        x_min *= scale_factor; x_max *= scale_factor
                        y_min *= scale_factor; y_max *= scale_factor
                        crop_offset = (scaled_width - target_width) // 2
                        x_min -= crop_offset; x_max -= crop_offset
                    else:
                        scale_factor = target_width / current_width
                        scaled_height = int(current_height * scale_factor)
                        x_min *= scale_factor; x_max *= scale_factor
                        y_min *= scale_factor; y_max *= scale_factor
                        crop_offset = (scaled_height - target_height) // 2
                        y_min -= crop_offset; y_max -= crop_offset
                    current_width, current_height = target_width, target_height

                elif resize_mode == 'fit_within':
                    original_aspect = current_width / current_height
                    target_aspect = target_width / target_height
                    if original_aspect > target_aspect:
                        scale_factor = target_width / current_width
                    else:
                        scale_factor = target_height / current_height
                    x_min *= scale_factor; x_max *= scale_factor
                    y_min *= scale_factor; y_max *= scale_factor

                elif resize_mode in ['fit_reflect_edges', 'fit_black_edges', 'fit_white_edges']:
                    original_aspect = current_width / current_height
                    target_aspect = target_width / target_height
                    if original_aspect > target_aspect:
                        scale_factor = target_width / current_width
                        new_h = int(current_height * scale_factor)
                        x_min *= scale_factor; x_max *= scale_factor
                        y_min *= scale_factor; y_max *= scale_factor
                        paste_y = (target_height - new_h) // 2
                        y_min += paste_y; y_max += paste_y
                    else:
                        scale_factor = target_height / current_height
                        new_w = int(current_width * scale_factor)
                        x_min *= scale_factor; x_max *= scale_factor
                        y_min *= scale_factor; y_max *= scale_factor
                        paste_x = (target_width - new_w) // 2
                        x_min += paste_x; x_max += paste_x
                    current_width, current_height = target_width, target_height

            elif transform_name == 'rotate':
                # TODO: implement precise rotation handling in legacy path if needed
                pass

            elif transform_name == 'crop':
                crop_x = params.get('x', 0)
                crop_y = params.get('y', 0)
                x_min -= crop_x; x_max -= crop_x
                y_min -= crop_y; y_max -= crop_y

            elif transform_name == 'random_zoom':
                zoom_factor = params.get('zoom_factor', 1.0)
                center_x, center_y = current_width / 2, current_height / 2
                x_min = center_x + (x_min - center_x) * zoom_factor
                x_max = center_x + (x_max - center_x) * zoom_factor
                y_min = center_y + (y_min - center_y) * zoom_factor
                y_max = center_y + (y_max - center_y) * zoom_factor

            elif transform_name in ['affine_transform', 'perspective_warp', 'shear']:
                # Not implemented in legacy path
                pass

    # clip
    x_min = _clip(x_min, 0, new_width)
    x_max = _clip(x_max, 0, new_width)
    y_min = _clip(y_min, 0, new_height)
    y_max = _clip(y_max, 0, new_height)

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
    """Legacy: polygon updates by sequential transforms (approximation)."""
    points = polygon.points.copy()
    orig_width, orig_height = original_dims
    new_width, new_height = new_dims

    current_width, current_height = orig_width, orig_height
    coordinate_transforms = {'resize', 'rotate', 'flip', 'crop', 'random_zoom', 'affine_transform', 'perspective_warp', 'shear'}

    for transform_name, params in transformation_config.items():
        if transform_name in coordinate_transforms and params.get('enabled', True):

            if transform_name == 'flip':
                if params.get('horizontal', False):
                    points = [(current_width - x, y) for x, y in points]
                if params.get('vertical', False):
                    points = [(x, current_height - y) for x, y in points]

            elif transform_name == 'resize':
                target_width = params.get('width', 640)
                target_height = params.get('height', 640)
                resize_mode = params.get('resize_mode', 'stretch_to')

                if resize_mode == 'stretch_to':
                    width_ratio = target_width / current_width
                    height_ratio = target_height / current_height
                    points = [(x * width_ratio, y * height_ratio) for x, y in points]
                    current_width, current_height = target_width, target_height

                elif resize_mode == 'fill_center_crop':
                    original_aspect = current_width / current_height
                    target_aspect = target_width / target_height
                    if original_aspect > target_aspect:
                        scale_factor = target_height / current_height
                        scaled_width = int(current_width * scale_factor)
                        points = [(x * scale_factor, y * scale_factor) for x, y in points]
                        crop_offset = (scaled_width - target_width) // 2
                        points = [(x - crop_offset, y) for x, y in points]
                    else:
                        scale_factor = target_width / current_width
                        scaled_height = int(current_height * scale_factor)
                        points = [(x * scale_factor, y * scale_factor) for x, y in points]
                        crop_offset = (scaled_height - target_height) // 2
                        points = [(x, y - crop_offset) for x, y in points]
                    current_width, current_height = target_width, target_height

                elif resize_mode == 'fit_within':
                    original_aspect = current_width / current_height
                    target_aspect = target_width / target_height
                    if original_aspect > target_aspect:
                        scale_factor = target_width / current_width
                    else:
                        scale_factor = target_height / current_height
                    points = [(x * scale_factor, y * scale_factor) for x, y in points]
                    current_width, current_height = target_width, target_height

                elif resize_mode in ['fit_reflect_edges', 'fit_black_edges', 'fit_white_edges']:
                    original_aspect = current_width / current_height
                    target_aspect = target_width / target_height
                    if original_aspect > target_aspect:
                        scale_factor = target_width / current_width
                        new_h = int(current_height * scale_factor)
                        points = [(x * scale_factor, y * scale_factor) for x, y in points]
                        paste_y = (target_height - new_h) // 2
                        points = [(x, y + paste_y) for x, y in points]
                    else:
                        scale_factor = target_height / current_height
                        new_w = int(current_width * scale_factor)
                        points = [(x * scale_factor, y * scale_factor) for x, y in points]
                        paste_x = (target_width - new_w) // 2
                        points = [(x + paste_x, y) for x, y in points]
                    current_width, current_height = target_width, target_height

            elif transform_name == 'rotate':
                # TODO: implement precise rotation if needed in legacy path
                pass

            elif transform_name == 'crop':
                crop_x = params.get('x', 0)
                crop_y = params.get('y', 0)
                points = [(x - crop_x, y - crop_y) for x, y in points]

            elif transform_name == 'random_zoom':
                zoom_factor = params.get('zoom_factor', 1.0)
                center_x, center_y = orig_width / 2, orig_height / 2
                points = [
                    (center_x + (x - center_x) * zoom_factor, center_y + (y - center_y) * zoom_factor)
                    for x, y in points
                ]

            elif transform_name in ['affine_transform', 'perspective_warp', 'shear']:
                # Not implemented in legacy path
                pass

    # clip points
    valid_points = []
    for x, y in points:
        valid_points.append((_clip(x, 0, new_width), _clip(y, 0, new_height)))

    if len(valid_points) < 3:
        logger.warning("errors.validation", "Polygon has less than 3 valid points after transformation, skipping",
                       "invalid_polygon_skipped", {
                           'valid_points': len(valid_points),
                           'original_points': len(polygon.points)
                       })
        return None

    return Polygon(valid_points, polygon.class_name, polygon.class_id, polygon.confidence)
