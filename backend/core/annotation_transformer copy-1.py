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

# Import debug logger
from TRANSFORMATION_DEBUG import debug_logger
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
    # --- sanity on inputs ---
    w, h = new_dims
    assert w > 0 and h > 0, "new_dims must be the final canvas (width,height) > 0"

    x_min, y_min, x_max, y_max = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max
    # early reject degenerate inputs
    if not (x_max > x_min and y_max > y_min):
        logger.warning("errors.validation", "Degenerate input bbox, skipping",
                       "degenerate_bbox_input", {"old": [x_min, y_min, x_max, y_max]})
        return None

    # transform the 4 corners
    corners = [(x_min, y_min), (x_max, y_min), (x_min, y_max), (x_max, y_max)]
    tx, ty = [], []

    for (x, y) in corners:
        x2, y2 = _apply_matrix_to_point(A, x, y)
        # guard against NaN/Inf from extreme homographies
        if not (math.isfinite(x2) and math.isfinite(y2)):
            logger.warning("errors.validation", "Non-finite point from matrix, skipping bbox",
                           "bbox_matrix_nonfinite",
                           {"in": [x, y], "out": [float(x2), float(y2)]})
            return None
        tx.append(x2); ty.append(y2)

    new_x_min, new_x_max = min(tx), max(tx)
    new_y_min, new_y_max = min(ty), max(ty)

    clipped = _clip_bbox_to_dims(new_x_min, new_y_min, new_x_max, new_y_max, w, h)
    if clipped is None:
        logger.warning("errors.validation", "Invalid bbox after matrix transform, skipping",
                       "invalid_bbox_after_matrix",
                       {"old": [x_min, y_min, x_max, y_max],
                        "new": [new_x_min, new_y_min, new_x_max, new_y_max],
                        "new_dims": new_dims})
        return None

    cx_min, cy_min, cx_max, cy_max = clipped
    return BoundingBox(cx_min, cy_min, cx_max, cy_max,
                       bbox.class_name, bbox.class_id, bbox.confidence)


def _transform_polygon_with_matrix(polygon: Polygon, A: np.ndarray,
                                   new_dims: Tuple[int, int]) -> Optional[Polygon]:
    w, h = new_dims
    assert w > 0 and h > 0, "new_dims must be the final canvas"

    # 1) transform all points (no per-vertex clamp)
    pts: List[Tuple[float, float]] = []
    for (x, y) in polygon.points:
        x2, y2 = _apply_matrix_to_point(A, x, y)
        if not (math.isfinite(x2) and math.isfinite(y2)):
            logger.warning("errors.validation", "Non-finite point from matrix, skipping polygon",
                           "polygon_matrix_nonfinite",
                           {"in": [x, y], "out": [float(x2), float(y2)]})
            return None
        pts.append((x2, y2))

    if len(pts) < 3:
        logger.warning("errors.validation", "Polygon < 3 points after transform, skipping",
                       "invalid_polygon_after_matrix", {"original_points": len(polygon.points)})
        return None

    # 2) clip against the image rectangle using Sutherland–Hodgman (inline)
    def clip_against_edge(points: List[Tuple[float,float]], edge: str) -> List[Tuple[float,float]]:
        out: List[Tuple[float,float]] = []
        if not points:
            return out

        def inside(p):
            x, y = p
            if edge == "left":   return x >= 0.0
            if edge == "right":  return x <= w
            if edge == "top":    return y >= 0.0
            if edge == "bottom": return y <= h
            return True

        def intersect(p1, p2):
            x1, y1 = p1; x2, y2 = p2
            dx = x2 - x1; dy = y2 - y1
            # avoid division by zero in intersection
            if edge in ("left", "right"):
                x_edge = 0.0 if edge == "left" else float(w)
                if dx == 0:   # vertical segment; return point on edge
                    return (x_edge, y1)
                t = (x_edge - x1) / dx
                return (x_edge, y1 + t * dy)
            else:
                y_edge = 0.0 if edge == "top" else float(h)
                if dy == 0:   # horizontal segment; return point on edge
                    return (x1, y_edge)
                t = (y_edge - y1) / dy
                return (x1 + t * dx, y_edge)

        s = points[-1]
        for e in points:
            if inside(e):
                if inside(s):
                    out.append(e)
                else:
                    out.append(intersect(s, e))
                    out.append(e)
            else:
                if inside(s):
                    out.append(intersect(s, e))
            s = e
        return out

    for edge in ("left", "right", "top", "bottom"):
        pts = clip_against_edge(pts, edge)
        if len(pts) < 3:
            # fully clipped
            logger.debug("operations.annotations", "Polygon fully outside after clipping",
                         "polygon_fully_clipped", {"edge": edge})
            return None

    # 3) drop zero/near-zero area polygons
    area = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        area += x1 * y2 - x2 * y1
    area = abs(area) * 0.5
    if area < 1e-3:
        logger.debug("operations.annotations", "Polygon near-zero area after clip, skipping",
                     "polygon_tiny_area", {"area": area, "points": len(pts)})
        return None

    # 4) final numeric clamp (safety), now that shape is clipped
    out = [(_clip(x, 0.0, w), _clip(y, 0.0, h)) for (x, y) in pts]

    return Polygon(out, polygon.class_name, polygon.class_id, polygon.confidence)


# ------------------------------------------------------
# Public API (now supports precise matrix A if provided)
# ------------------------------------------------------

def update_annotations_for_transformations(
    annotations: List[Union[BoundingBox, Polygon]],
    transformation_config: Dict[str, Any],
    original_dims: Tuple[int, int],
    new_dims: Tuple[int, int],
    affine_matrix: Optional[Union[List[float], List[List[float]], np.ndarray]] = None,
    debug_tracking: bool = False

) -> Union[List[Union[BoundingBox, Polygon]], Tuple[List[Union[BoundingBox, Polygon]], Dict]]:

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
        debug_tracking: if True, return (annotations, debug_info) tuple

    Returns:
        List of updated annotations (invalid ones are dropped).
        If debug_tracking=True, returns (annotations, debug_info) tuple.
    """
    if not annotations:
        if debug_tracking:
            return [], {}
        return []

    logger.info("operations.transformations", f"Updating {len(annotations)} annotations", "annotations_update_start", {
        'annotation_count': len(annotations),
        'transformation_types': list(transformation_config.keys()),
        'original_dims': original_dims,
        'new_dims': new_dims,
        'has_affine_matrix': affine_matrix is not None,
        'debug_tracking': debug_tracking
    })

    updated_annotations: List[Union[BoundingBox, Polygon]] = []

    # --- resolve the REAL final canvas we must clip to ---
    final_dims = new_dims  # default fallback
    try:
        if 'resize' in transformation_config and transformation_config['resize'].get('enabled', True):
            rz = transformation_config['resize']
            mode = rz.get('resize_mode', 'stretch_to')
            tw = int(rz.get('width',  new_dims[0]))
            th = int(rz.get('height', new_dims[1]))
            ow, oh = map(float, original_dims)

            if mode == 'fit_within':
                s = min(float(tw)/ow, float(th)/oh)
                # IMPORTANT: use the same rounding your image pipeline uses for canvas
                cw = int(round(ow * s))
                ch = int(round(oh * s))
                final_dims = (cw, ch)
            else:
                # stretch_to, fill_center_crop, fit_*_edges → canvas is target
                final_dims = (tw, th)
    except Exception as e:
        logger.warning("errors.validation", f"Could not resolve final canvas dims: {e}",
                       "final_canvas_resolve_failed", {"original_dims": original_dims, "new_dims": new_dims})

    # Initialize debug tracking data
    debug_info = {
        'transformation_method': 'matrix' if affine_matrix is not None else 'sequential',
        'transformation_config': transformation_config,
        'original_dims': original_dims,
        'new_dims': new_dims,
        'actual_final_canvas_dims': final_dims,   # << add this
        'annotation_steps': []
    } if debug_tracking else None

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
            fw, fh = final_dims
            assert fw > 0 and fh > 0, "final_dims must be > 0 for matrix path"
            for ann in annotations:
                try:
                    if isinstance(ann, BoundingBox):
                        u = _transform_bbox_with_matrix(ann, A, final_dims)   # << use final_dims
                        if u is not None:
                            updated_annotations.append(u)
                    elif isinstance(ann, Polygon):
                        u = _transform_polygon_with_matrix(ann, A, final_dims) # << use final_dims
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
            
            if debug_tracking:
                debug_info['annotation_steps'] = [
                    {
                        'annotation_id': i,
                        'transformation_method': 'matrix_based',
                        'matrix_applied': True,
                        'note': 'Precise matrix transformation applied'
                    }
                    for i in range(len(updated_annotations))
                ]
                return updated_annotations, debug_info
            return updated_annotations

    # --- Legacy fallback (sequential config order) ---
    for ann_idx, annotation in enumerate(annotations):
        try:
            if debug_tracking:
                updated_annotation, ann_debug = _transform_single_annotation_with_debug(
                    annotation, transformation_config, original_dims, final_dims, ann_idx  # << use final
                )
                debug_info['annotation_steps'].append(ann_debug)
            else:
                updated_annotation = _transform_single_annotation(
                    annotation, transformation_config, original_dims, final_dims  # << use final
                )
            
            if updated_annotation:
                updated_annotations.append(updated_annotation)
        except Exception as e:
            logger.warning("errors.validation", f"Failed to update annotation: {str(e)}", "annotation_update_failed", {
                'error': str(e),
                'annotation_type': type(annotation).__name__
            })
            updated_annotations.append(annotation)
            
            if debug_tracking:
                debug_info['annotation_steps'].append({
                    'annotation_id': ann_idx,
                    'transformation_method': 'sequential_failed',
                    'error': str(e),
                    'fallback_used': True
                })

    logger.info("operations.transformations", f"Updated {len(updated_annotations)} annotations (legacy path)",
                "annotations_updated", {
                    'annotation_count': len(updated_annotations),
                    'original_count': len(annotations)
                })
    
    if debug_tracking:
        # we already computed it at the top:
        debug_info['actual_canvas_dimensions'] = final_dims
        # optional: flag if caller's new_dims mismatched what we resolved
        if tuple(new_dims) != tuple(final_dims):
            debug_info['note'] = 'new_dims != actual final canvas; used actual for clipping'
        return updated_annotations, debug_info
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


def _transform_single_annotation_with_debug(annotation: Union[BoundingBox, Polygon],
                                           transformation_config: Dict[str, Any],
                                           original_dims: Tuple[int, int],
                                           new_dims: Tuple[int, int],
                                           annotation_id: int) -> Tuple[Optional[Union[BoundingBox, Polygon]], Dict]:
    """Legacy path with debug tracking: transform a single annotation and track each step."""
    
    # Initialize debug tracking for this annotation
    ann_debug = {
        'annotation_id': annotation_id,
        'annotation_type': type(annotation).__name__,
        'class_name': getattr(annotation, 'class_name', 'unknown'),
        'class_id': getattr(annotation, 'class_id', 0),
        'transformation_method': 'sequential',
        'transformation_steps': [],
        'original_coordinates': None,
        'final_coordinates': None
    }
    
    # Record original coordinates
    if isinstance(annotation, BoundingBox):
        ann_debug['original_coordinates'] = {
            'type': 'bbox',
            'x_min': float(annotation.x_min),
            'y_min': float(annotation.y_min),
            'x_max': float(annotation.x_max),
            'y_max': float(annotation.y_max)
        }
        updated_annotation = _transform_bbox(annotation, transformation_config, original_dims, new_dims, debug_info=ann_debug)
    elif isinstance(annotation, Polygon):
        ann_debug['original_coordinates'] = {
            'type': 'polygon',
            'points': [(float(x), float(y)) for x, y in annotation.points]
        }
        updated_annotation = _transform_polygon(annotation, transformation_config, original_dims, new_dims, debug_info=ann_debug)
    else:
        ann_debug['transformation_steps'].append({
            'step': 0,
            'transformation': 'no_transformation',
            'note': 'Unknown annotation type, no transformation applied'
        })
        updated_annotation = annotation
    
    # Record final coordinates
    if updated_annotation and isinstance(updated_annotation, BoundingBox):
        ann_debug['final_coordinates'] = {
            'type': 'bbox',
            'x_min': float(updated_annotation.x_min),
            'y_min': float(updated_annotation.y_min),
            'x_max': float(updated_annotation.x_max),
            'y_max': float(updated_annotation.y_max)
        }
    elif updated_annotation and isinstance(updated_annotation, Polygon):
        ann_debug['final_coordinates'] = {
            'type': 'polygon',
            'points': [(float(x), float(y)) for x, y in updated_annotation.points]
        }
    
    return updated_annotation, ann_debug


def _transform_bbox(bbox: BoundingBox, transformation_config: Dict[str, Any],
                    original_dims: Tuple[int, int], new_dims: Tuple[int, int], 
                    debug_info: Optional[Dict] = None) -> Optional[BoundingBox]:
    """Transform bbox coordinates using sequential transforms with optional debug tracking."""

    x_min, y_min, x_max, y_max = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max
    orig_width, orig_height = original_dims
    new_width, new_height = new_dims

    current_width, current_height = orig_width, orig_height
    
    # Updated coordinate_transforms to match transformation_config.py
    # GEOMETRY TOOLS (affect coordinates): resize, rotation, flip, crop, random_zoom, affine_transform, perspective_warp, shear
    # APPEARANCE TOOLS (don't affect coordinates): brightness, contrast, blur, noise, color_jitter, saturation, gamma, clahe, cutout
    coordinate_transforms = {'resize', 'rotation', 'rotate', 'flip', 'crop', 'random_zoom', 'affine_transform', 'perspective_warp', 'shear'}
    
    step_counter = 0

    for transform_name, params in transformation_config.items():

        if transform_name in coordinate_transforms and params.get('enabled', True):
            # Record coordinates before this transformation (for debug tracking)
            if debug_info is not None:
                before_coords = {
                    'x_min': float(x_min),
                    'y_min': float(y_min),
                    'x_max': float(x_max),
                    'y_max': float(y_max)
                }
            
            if transform_name == 'flip':
                if params.get('horizontal', False):
                    x_min, x_max = current_width - x_max, current_width - x_min
                if params.get('vertical', False):
                    y_min, y_max = current_height - y_max, current_height - y_min

            elif transform_name == 'resize':
                target_width  = params.get('width',  640)
                target_height = params.get('height', 640)
                resize_mode   = params.get('resize_mode', 'stretch_to')

                source_w = float(current_width)
                source_h = float(current_height)
                tw = float(target_width)
                th = float(target_height)

                if resize_mode == 'stretch_to':
                    # non-uniform scale
                    sx = tw / source_w
                    sy = th / source_h
                    x_min *= sx; x_max *= sx
                    y_min *= sy; y_max *= sy
                    canvas_width, canvas_height = tw, th

                elif resize_mode == 'fit_within':
                    # uniform scale, no padding, canvas shrinks
                    s = min(tw / source_w, th / source_h)
                    x_min *= s; x_max *= s
                    y_min *= s; y_max *= s
                    canvas_width  = source_w * s
                    canvas_height = source_h * s

                elif resize_mode in ['fit_reflect_edges', 'fit_black_edges', 'fit_white_edges']:
                    # uniform scale + letterbox padding (positive offsets)
                    s  = min(tw / source_w, th / source_h)
                    sw = source_w * s
                    sh = source_h * s
                    pad_x = int(round((tw - sw) / 2.0))  # match image renderer rounding
                    pad_y = int(round((th - sh) / 2.0))
                    x_min = x_min * s + pad_x; x_max = x_max * s + pad_x
                    y_min = y_min * s + pad_y; y_max = y_max * s + pad_y
                    canvas_width, canvas_height = tw, th

                elif resize_mode == 'fill_center_crop':
                    # uniform scale + crop (offsets can be negative)
                    s  = max(tw / source_w, th / source_h)
                    sw = source_w * s
                    sh = source_h * s
                    ox = (tw - sw) / 2.0
                    oy = (th - sh) / 2.0
                    x_min = x_min * s + ox; x_max = x_max * s + ox
                    y_min = y_min * s + oy; y_max = y_max * s + oy
                    canvas_width, canvas_height = tw, th

                else:
                    # default: behave like stretch_to
                    sx = tw / source_w
                    sy = th / source_h
                    x_min *= sx; x_max *= sx
                    y_min *= sy; y_max *= sy
                    canvas_width, canvas_height = tw, th

                # make the new canvas available to any next transform
                current_width, current_height = canvas_width, canvas_height

            
            elif transform_name in ('rotation', 'rotate'):
                angle = float(params.get('angle', params.get('degrees', params.get('rotation', 0))))
                if angle != 0:
                    angle_rad = math.radians(angle)
                    cos_a = math.cos(angle_rad)
                    sin_a = math.sin(angle_rad)
                    center_x, center_y = current_width / 2, current_height / 2
                    corners = [
                        (x_min - center_x, y_min - center_y),
                        (x_max - center_x, y_min - center_y),
                        (x_min - center_x, y_max - center_y),
                        (x_max - center_x, y_max - center_y)
                    ]
                    rotated = []
                    for (x, y) in corners:
                        new_x = x * cos_a - y * sin_a + center_x
                        new_y = x * sin_a + y * cos_a + center_y
                        rotated.append((new_x, new_y))
                    xs = [p[0] for p in rotated]; ys = [p[1] for p in rotated]
                    x_min, x_max = min(xs), max(xs)
                    y_min, y_max = min(ys), max(ys)


            elif transform_name == 'crop':
                crop_x = params.get('x', 0)
                crop_y = params.get('y', 0)
                x_min -= crop_x; x_max -= crop_x
                y_min -= crop_y; y_max -= crop_y
                
                crop_w = params.get('width',  current_width  - crop_x)
                crop_h = params.get('height', current_height - crop_y)
                current_width, current_height = float(crop_w), float(crop_h)

            elif transform_name == 'random_zoom':
                zoom_factor = params.get('zoom_factor', 1.0)
                center_x, center_y = current_width / 2, current_height / 2
                x_min = center_x + (x_min - center_x) * zoom_factor
                x_max = center_x + (x_max - center_x) * zoom_factor
                y_min = center_y + (y_min - center_y) * zoom_factor
                y_max = center_y + (y_max - center_y) * zoom_factor

            elif transform_name == 'shear':
                # Implement shear coordinate transformation
                shear_angle = params.get('shear_angle', 0) or params.get('angle', 0)
                if shear_angle != 0:
                    # Convert shear angle to shear factor
                    shear_factor = math.tan(math.radians(shear_angle))
                    
                    # Apply horizontal shear transformation
                    # x' = x + shear_factor * y
                    # y' = y (unchanged)
                    corners = [
                        (x_min, y_min),
                        (x_max, y_min),
                        (x_min, y_max),
                        (x_max, y_max)
                    ]
                    
                    sheared_corners = []
                    for (x, y) in corners:
                        new_x = x + shear_factor * y
                        new_y = y
                        sheared_corners.append((new_x, new_y))
                    
                    # Find new bounding box from sheared corners
                    xs = [corner[0] for corner in sheared_corners]
                    ys = [corner[1] for corner in sheared_corners]
                    x_min, x_max = min(xs), max(xs)
                    y_min, y_max = min(ys), max(ys)
            
            elif transform_name == 'affine_transform':
                # Implement basic affine transformation
                scale_x = params.get('scale_x', 1.0)
                scale_y = params.get('scale_y', 1.0)
                translate_x = params.get('translate_x', 0)
                translate_y = params.get('translate_y', 0)
                rotation_angle = params.get('rotation', 0)
                
                if scale_x != 1.0 or scale_y != 1.0 or translate_x != 0 or translate_y != 0 or rotation_angle != 0:
                    # Apply scaling
                    center_x, center_y = current_width / 2, current_height / 2
                    x_min = center_x + (x_min - center_x) * scale_x
                    x_max = center_x + (x_max - center_x) * scale_x
                    y_min = center_y + (y_min - center_y) * scale_y
                    y_max = center_y + (y_max - center_y) * scale_y
                    
                    # Apply translation
                    x_min += translate_x
                    x_max += translate_x
                    y_min += translate_y
                    y_max += translate_y
                    
                    # Apply rotation if specified
                    if rotation_angle != 0:
                        angle_rad = math.radians(rotation_angle)
                        cos_a = math.cos(angle_rad)
                        sin_a = math.sin(angle_rad)
                        
                        corners = [
                            (x_min - center_x, y_min - center_y),
                            (x_max - center_x, y_min - center_y),
                            (x_min - center_x, y_max - center_y),
                            (x_max - center_x, y_max - center_y)
                        ]
                        
                        rotated_corners = []
                        for (x, y) in corners:
                            new_x = x * cos_a - y * sin_a + center_x
                            new_y = x * sin_a + y * cos_a + center_y
                            rotated_corners.append((new_x, new_y))
                        
                        xs = [corner[0] for corner in rotated_corners]
                        ys = [corner[1] for corner in rotated_corners]
                        x_min, x_max = min(xs), max(xs)
                        y_min, y_max = min(ys), max(ys)
            
            elif transform_name == 'perspective_warp':
                # Perspective transformation is complex - use matrix-based approach if available
                # For legacy path, we'll skip precise perspective transformation
                # as it requires solving perspective equations
                logger.warning("operations.transformations", 
                             "Perspective transformation in legacy path not fully supported, use matrix-based path for precision",
                             "perspective_legacy_warning", {
                                 'transform_name': transform_name
                             })
                pass
            
            # Record debug info after this transformation
            if debug_info is not None:
                after_coords = {
                    'x_min': float(x_min),
                    'y_min': float(y_min),
                    'x_max': float(x_max),
                    'y_max': float(y_max)
                }
                
                # Calculate coordinate changes
                coordinate_changes = {
                    'x_min_change': after_coords['x_min'] - before_coords['x_min'],
                    'y_min_change': after_coords['y_min'] - before_coords['y_min'],
                    'x_max_change': after_coords['x_max'] - before_coords['x_max'],
                    'y_max_change': after_coords['y_max'] - before_coords['y_max'],
                    'center_x_change': ((after_coords['x_min'] + after_coords['x_max'])/2) - ((before_coords['x_min'] + before_coords['x_max'])/2),
                    'center_y_change': ((after_coords['y_min'] + after_coords['y_max'])/2) - ((before_coords['y_min'] + before_coords['y_max'])/2)
                }
                
                debug_info['transformation_steps'].append({
                    'step': step_counter,
                    'transformation': transform_name,
                    'parameters': params,
                    'before_coordinates': before_coords,
                    'after_coordinates': after_coords,
                    'coordinate_changes': coordinate_changes,
                    'current_dimensions': {'width': current_width, 'height': current_height}
                })
                
                step_counter += 1

    # clip to the REAL final canvas, not new_dims
    x_min = _clip(x_min, 0.0, current_width)
    x_max = _clip(x_max, 0.0, current_width)
    y_min = _clip(y_min, 0.0, current_height)
    y_max = _clip(y_max, 0.0, current_height)

    if x_min >= x_max or y_min >= y_max:
        logger.warning("errors.validation", "Invalid bounding box after transformation, skipping", "invalid_bbox_skipped", {
            'bbox_coords': (x_min, y_min, x_max, y_max),
            'original_dims': original_dims,
            'new_dims': new_dims
        })
        return None

    # Create new BoundingBox with transformed coordinates
    transformed_bbox = BoundingBox(x_min, y_min, x_max, y_max, bbox.class_name, bbox.class_id, bbox.confidence)
    
    # 🎯 CRITICAL FIX: Preserve segmentation data if it exists
    if hasattr(bbox, 'segmentation') and bbox.segmentation:
        # Transform the segmentation polygon points using the same transformations
        transformed_segmentation = _transform_segmentation_points(
            bbox.segmentation, transformation_config, original_dims, new_dims
        )
        transformed_bbox.segmentation = transformed_segmentation
    
    return transformed_bbox


def _transform_segmentation_points(segmentation_data, transformation_config: Dict[str, Any],
                                   original_dims: Tuple[int, int], new_dims: Tuple[int, int]) -> str:
    """
    Transform segmentation polygon points using the same transformations applied to the image.
    Returns a JSON string like [{"x":..., "y":...}, ...]
    """
    import json
    import math

    # 1) parse input
    if isinstance(segmentation_data, str):
        try:
            points = json.loads(segmentation_data)
        except Exception:
            return segmentation_data
    else:
        points = segmentation_data

    if not isinstance(points, list) or len(points) == 0:
        return json.dumps(points) if not isinstance(segmentation_data, str) else segmentation_data

    # we only handle [{"x":..,"y":..}, ...] here
    if not (isinstance(points[0], dict) and 'x' in points[0] and 'y' in points[0]):
        return json.dumps(points) if not isinstance(segmentation_data, str) else segmentation_data

    # 2) set up dims (floats)
    orig_w, orig_h = original_dims
    cur_w, cur_h = float(orig_w), float(orig_h)   # current canvas for THIS point's transform path

    transformed = []

    # 3) transform each point with the SAME sequence (resize, flip, rotation, crop/zoom if configured, etc.)
    coordinate_transforms = {'resize', 'rotation', 'rotate', 'flip', 'crop', 'random_zoom', 'affine_transform', 'perspective_warp', 'shear'}

    for p in points:
        x = float(p['x']); y = float(p['y'])
        temp_w, temp_h = cur_w, cur_h  # temp canvas that follows this point through the pipeline

        for transform_name, params in transformation_config.items():
            if not (transform_name in coordinate_transforms and params.get('enabled', True)):
                continue

            if transform_name == 'resize':
                tw = float(params.get('width',  640))
                th = float(params.get('height', 640))
                mode = params.get('resize_mode', 'stretch_to')

                if mode == 'stretch_to':
                    sx = tw / temp_w
                    sy = th / temp_h
                    x *= sx; y *= sy
                    temp_w, temp_h = tw, th

                elif mode == 'fit_within':
                    # uniform scale, NO padding; canvas shrinks
                    s = min(tw / temp_w, th / temp_h)
                    x *= s; y *= s
                    temp_w, temp_h = temp_w * s, temp_h * s  # keep floats (no int)

                elif mode in ['fit_reflect_edges', 'fit_black_edges', 'fit_white_edges']:
                    # uniform scale + letterbox padding (positive offsets). pads must match image rounding
                    s  = min(tw / temp_w, th / temp_h)
                    sw = temp_w * s
                    sh = temp_h * s
                    pad_x = int(round((tw - sw) / 2.0))
                    pad_y = int(round((th - sh) / 2.0))
                    x = x * s + pad_x
                    y = y * s + pad_y
                    temp_w, temp_h = tw, th

                elif mode == 'fill_center_crop':
                    # uniform scale + crop (offsets can be negative)
                    s  = max(tw / temp_w, th / temp_h)
                    sw = temp_w * s
                    sh = temp_h * s
                    ox = (tw - sw) / 2.0
                    oy = (th - sh) / 2.0
                    x = x * s + ox
                    y = y * s + oy
                    temp_w, temp_h = tw, th

                else:
                    # default: treat as stretch_to
                    sx = tw / temp_w
                    sy = th / temp_h
                    x *= sx; y *= sy
                    temp_w, temp_h = tw, th

            elif transform_name == 'flip':
                # accept both boolean flags and legacy 'direction'
                if params.get('horizontal', False) or params.get('direction') == 'horizontal':
                    x = temp_w - x
                if params.get('vertical', False) or params.get('direction') == 'vertical':
                    y = temp_h - y

            elif transform_name in ('rotation', 'rotate'):
                angle = float(params.get('angle', params.get('degrees', params.get('rotation', 0))))
                if angle != 0.0:
                    ang = math.radians(angle)
                    cos_a = math.cos(ang); sin_a = math.sin(ang)
                    cx, cy = temp_w / 2.0, temp_h / 2.0
                    dx, dy = (x - cx), (y - cy)
                    x = cx + dx * cos_a - dy * sin_a
                    y = cy + dx * sin_a + dy * cos_a

            elif transform_name == 'random_zoom':
                z = float(params.get('zoom_factor', 1.0))
                if z != 1.0:
                    cx, cy = temp_w / 2.0, temp_h / 2.0
                    x = cx + (x - cx) * z
                    y = cy + (y - cy) * z

            elif transform_name == 'crop':
                crop_x = float(params.get('x', 0))
                crop_y = float(params.get('y', 0))
                crop_w = float(params.get('width',  temp_w - crop_x))
                crop_h = float(params.get('height', temp_h - crop_y))
                x -= crop_x; y -= crop_y
                # update canvas for subsequent ops
                temp_w, temp_h = crop_w, crop_h

            elif transform_name == 'affine_transform':
                sx = float(params.get('scale_x', 1.0))
                sy = float(params.get('scale_y', 1.0))
                tx = float(params.get('translate_x', 0.0))
                ty = float(params.get('translate_y', 0.0))
                rot = float(params.get('rotation', 0.0))
                # scale about center
                cx, cy = temp_w / 2.0, temp_h / 2.0
                x = cx + (x - cx) * sx
                y = cy + (y - cy) * sy
                # translate
                x += tx; y += ty
                # rotate about center if any
                if rot != 0.0:
                    ang = math.radians(rot)
                    cos_a = math.cos(ang); sin_a = math.sin(ang)
                    dx, dy = (x - cx), (y - cy)
                    x = cx + dx * cos_a - dy * sin_a
                    y = cy + dx * sin_a + dy * cos_a

            elif transform_name == 'shear':
                ang = float(params.get('shear_angle', params.get('angle', 0.0)))
                if ang != 0.0:
                    k = math.tan(math.radians(ang))
                    # horizontal shear about y-axis
                    x = x + k * (y - (temp_h / 2.0))

            elif transform_name == 'perspective_warp':
                # legacy path cannot be exact; matrix path should be preferred
                pass

        # 4) clamp ONCE to the actual final canvas of this path (temp_w/temp_h), not new_dims
        x = max(0.0, min(temp_w, x))
        y = max(0.0, min(temp_h, y))
        transformed.append({'x': x, 'y': y})

    return json.dumps(transformed)


def _transform_polygon(polygon: Polygon, transformation_config: Dict[str, Any],
                       original_dims: Tuple[int, int], new_dims: Tuple[int, int],
                       debug_info: Optional[Dict] = None) -> Optional[Polygon]:
    """Transform polygon coordinates using sequential transforms with optional debug tracking."""
    points = polygon.points.copy()
    orig_width, orig_height = original_dims
    new_width, new_height = new_dims

    current_width, current_height = orig_width, orig_height
    
    # Updated coordinate_transforms to match transformation_config.py
    # GEOMETRY TOOLS (affect coordinates): resize, rotation, flip, crop, random_zoom, affine_transform, perspective_warp, shear
    # APPEARANCE TOOLS (don't affect coordinates): brightness, contrast, blur, noise, color_jitter, saturation, gamma, clahe, cutout
    coordinate_transforms = {'resize', 'rotation', 'rotate', 'flip', 'crop', 'random_zoom', 'affine_transform', 'perspective_warp', 'shear'}
    
    step_counter = 0

    for transform_name, params in transformation_config.items():
        if transform_name in coordinate_transforms and params.get('enabled', True):
            # Record coordinates before this transformation (for debug tracking)
            if debug_info is not None:
                before_coords = {
                    'type': 'polygon',
                    'points': [(float(x), float(y)) for x, y in points]
                }

            if transform_name == 'flip':
                if params.get('horizontal', False):
                    points = [(current_width - x, y) for x, y in points]
                if params.get('vertical', False):
                    points = [(x, current_height - y) for x, y in points]

            elif transform_name == 'resize':
                target_width  = params.get('width',  640)
                target_height = params.get('height', 640)
                resize_mode   = params.get('resize_mode', 'stretch_to')

                source_w = float(current_width)
                source_h = float(current_height)
                tw = float(target_width)
                th = float(target_height)

                if resize_mode == 'stretch_to':
                    sx = tw / source_w
                    sy = th / source_h
                    points = [(x * sx, y * sy) for (x, y) in points]
                    canvas_width, canvas_height = tw, th

                elif resize_mode == 'fit_within':
                    s = min(tw / source_w, th / source_h)
                    points = [(x * s, y * s) for (x, y) in points]
                    canvas_width  = source_w * s
                    canvas_height = source_h * s

                elif resize_mode in ['fit_reflect_edges', 'fit_black_edges', 'fit_white_edges']:
                    s  = min(tw / source_w, th / source_h)
                    sw = source_w * s
                    sh = source_h * s
                    pad_x = int(round((tw - sw) / 2.0))
                    pad_y = int(round((th - sh) / 2.0))
                    points = [(x * s + pad_x, y * s + pad_y) for (x, y) in points]
                    canvas_width, canvas_height = tw, th

                elif resize_mode == 'fill_center_crop':
                    s  = max(tw / source_w, th / source_h)
                    sw = source_w * s
                    sh = source_h * s
                    ox = (tw - sw) / 2.0
                    oy = (th - sh) / 2.0
                    points = [(x * s + ox, y * s + oy) for (x, y) in points]
                    canvas_width, canvas_height = tw, th

                else:
                    sx = tw / source_w
                    sy = th / source_h
                    points = [(x * sx, y * sy) for (x, y) in points]
                    canvas_width, canvas_height = tw, th

                current_width, current_height = canvas_width, canvas_height

            elif transform_name in ('rotation', 'rotate'):

                # Implement rotation coordinate transformation for polygons
                angle = float(params.get('angle', params.get('degrees', params.get('rotation', 0))))

                if angle != 0:
                    # Convert angle to radians
                    angle_rad = math.radians(angle)
                    cos_a = math.cos(angle_rad)
                    sin_a = math.sin(angle_rad)
                    
                    # Rotation around image center
                    center_x, center_y = current_width / 2, current_height / 2
                    
                    # Transform all polygon points
                    rotated_points = []
                    for (x, y) in points:
                        # Translate to origin, rotate, translate back
                        x_centered = x - center_x
                        y_centered = y - center_y
                        new_x = x_centered * cos_a - y_centered * sin_a + center_x
                        new_y = x_centered * sin_a + y_centered * cos_a + center_y
                        rotated_points.append((new_x, new_y))
                    
                    points = rotated_points

            elif transform_name == 'crop':
                crop_x = params.get('x', 0)
                crop_y = params.get('y', 0)
                points = [(x - crop_x, y - crop_y) for x, y in points]
                
                crop_w = params.get('width',  current_width  - crop_x)
                crop_h = params.get('height', current_height - crop_y)
                current_width, current_height = float(crop_w), float(crop_h)

            
            elif transform_name == 'random_zoom':
                zoom_factor = params.get('zoom_factor', 1.0)
                # use the CURRENT canvas, not original
                center_x, center_y = current_width / 2.0, current_height / 2.0
                points = [
                    (center_x + (x - center_x) * zoom_factor,
                    center_y + (y - center_y) * zoom_factor)
                    for x, y in points
                ]

            elif transform_name == 'shear':
                # Implement shear coordinate transformation for polygons
                shear_angle = params.get('shear_angle', 0) or params.get('angle', 0)
                if shear_angle != 0:
                    # Convert shear angle to shear factor
                    shear_factor = math.tan(math.radians(shear_angle))
                    
                    # Apply horizontal shear transformation to all points
                    # x' = x + shear_factor * y
                    # y' = y (unchanged)
                    sheared_points = []
                    for (x, y) in points:
                        new_x = x + shear_factor * y
                        new_y = y
                        sheared_points.append((new_x, new_y))
                    
                    points = sheared_points
            
            elif transform_name == 'affine_transform':
                # Implement basic affine transformation for polygons
                scale_x = params.get('scale_x', 1.0)
                scale_y = params.get('scale_y', 1.0)
                translate_x = params.get('translate_x', 0)
                translate_y = params.get('translate_y', 0)
                rotation_angle = params.get('rotation', 0)
                
                if scale_x != 1.0 or scale_y != 1.0 or translate_x != 0 or translate_y != 0 or rotation_angle != 0:
                    center_x, center_y = current_width / 2, current_height / 2
                    
                    # Apply scaling and translation
                    transformed_points = []
                    for (x, y) in points:
                        # Apply scaling around center
                        new_x = center_x + (x - center_x) * scale_x
                        new_y = center_y + (y - center_y) * scale_y
                        
                        # Apply translation
                        new_x += translate_x
                        new_y += translate_y
                        
                        transformed_points.append((new_x, new_y))
                    
                    points = transformed_points
                    
                    # Apply rotation if specified
                    if rotation_angle != 0:
                        angle_rad = math.radians(rotation_angle)
                        cos_a = math.cos(angle_rad)
                        sin_a = math.sin(angle_rad)
                        
                        rotated_points = []
                        for (x, y) in points:
                            x_centered = x - center_x
                            y_centered = y - center_y
                            new_x = x_centered * cos_a - y_centered * sin_a + center_x
                            new_y = x_centered * sin_a + y_centered * cos_a + center_y
                            rotated_points.append((new_x, new_y))
                        
                        points = rotated_points
            
            elif transform_name == 'perspective_warp':
                # Perspective transformation is complex - use matrix-based approach if available
                # For legacy path, we'll skip precise perspective transformation
                # as it requires solving perspective equations
                logger.warning("operations.transformations", 
                             "Perspective transformation in legacy path not fully supported, use matrix-based path for precision",
                             "perspective_legacy_warning", {
                                 'transform_name': transform_name
                             })
                pass
            
            # Record debug info after this transformation
            if debug_info is not None:
                after_coords = {
                    'type': 'polygon',
                    'points': [(float(x), float(y)) for x, y in points]
                }
                
                # Calculate coordinate changes (center point movement)
                before_center_x = sum(p[0] for p in before_coords['points']) / len(before_coords['points'])
                before_center_y = sum(p[1] for p in before_coords['points']) / len(before_coords['points'])
                after_center_x = sum(p[0] for p in after_coords['points']) / len(after_coords['points'])
                after_center_y = sum(p[1] for p in after_coords['points']) / len(after_coords['points'])
                
                coordinate_changes = {
                    'center_x_change': after_center_x - before_center_x,
                    'center_y_change': after_center_y - before_center_y,
                    'point_count': len(after_coords['points'])
                }
                
                debug_info['transformation_steps'].append({
                    'step': step_counter,
                    'transformation': transform_name,
                    'parameters': params,
                    'before_coordinates': before_coords,
                    'after_coordinates': after_coords,
                    'coordinate_changes': coordinate_changes,
                    'current_dimensions': {'width': current_width, 'height': current_height}
                })
                
                step_counter += 1

    # clip points
    valid_points = [(_clip(x, 0.0, current_width), _clip(y, 0.0, current_height)) for (x, y) in points]

    if len(valid_points) < 3:
        logger.warning("errors.validation", "Polygon has less than 3 valid points after transformation, skipping",
                       "invalid_polygon_skipped", {
                           'valid_points': len(valid_points),
                           'original_points': len(polygon.points)
                       })
        return None

    return Polygon(valid_points, polygon.class_name, polygon.class_id, polygon.confidence)


# ---------------------------
# DEBUG FUNCTION FOR YOLO ISSUES
# ---------------------------

def _debug_yolo_dump(image_name, anns, final_w, final_h, transform_config=None, original_w=None, original_h=None):
    """Debug function to trace YOLO conversion issues"""
    print(f"\n=== DEBUG YOLO DUMP :: {image_name} ===")
    print(f"final canvas passed to YOLO: {final_w}x{final_h}")
    
    if transform_config:
        print(f"transform_config: {transform_config}")
        print(f"original dimensions: {original_w}x{original_h}")

    if not anns:
        print("🚨 anns list is EMPTY before conversion")
        return [], []

    # 🔧 FIX: Apply transformations FIRST if config provided
    if transform_config and original_w and original_h:
        print("🔧 APPLYING TRANSFORMATIONS TO ANNOTATIONS...")
        # ✅ RIGHT
        transformed_anns, dbg = update_annotations_for_transformations(
            annotations=anns,
            transformation_config=transform_config,  # correct key
            original_dims=(original_w, original_h),  # tuple (w,h)
            new_dims=(final_w, final_h),             # tuple (w,h) = ACTUAL saved image size
            debug_tracking=True
        )
        print(f"   Debug tracking: {dbg}")  

        print(f"   Transformed annotations: {len(transformed_anns)}")
       
        print(f"   Original annotations: {len(anns)}")
        anns = transformed_anns  # Use transformed annotations
    else:
        print("⚠️  NO TRANSFORMATIONS APPLIED - using raw annotations")

    # Show first few annotations (now transformed if config was provided)
    for i, a in enumerate(anns[:3]):
        if hasattr(a, "x_min"):
            print(f"  ann[{i}] BBOX -> [{a.x_min:.2f},{a.y_min:.2f},{a.x_max:.2f},{a.y_max:.2f}]")
        elif hasattr(a, "points"):
            print(f"  ann[{i}] POLY -> {len(a.points)} pts; min=({min(p[0] for p in a.points):.1f},{min(p[1] for p in a.points):.1f}) "
                  f"max=({max(p[0] for p in a.points):.1f},{max(p[1] for p in a.points):.1f})")

    # Convert (now with properly transformed annotations)
    det_lines = transform_detection_annotations_to_yolo(anns, final_w, final_h)
    seg_lines = transform_segmentation_annotations_to_yolo(anns, final_w, final_h)

    print(f"YOLO DET lines: {len(det_lines)}")
    for L in det_lines[:3]: print("  det:", L)
    print(f"YOLO SEG lines: {len(seg_lines)}")
    for L in seg_lines[:1]: print("  seg:", L[:120] + ("..." if len(L) > 120 else ""))

    # If empty, explain WHY by checking bounds
    if not det_lines:
        for i, a in enumerate(anns):
            if hasattr(a, "x_min"):
                x1,y1,x2,y2 = float(a.x_min), float(a.y_min), float(a.x_max), float(a.y_max)
                cx = (x1+x2)/(2*final_w); cy = (y1+y2)/(2*final_h)
                w  = (x2-x1)/final_w;     h  = (y2-y1)/final_h
                print(f"  bbox[{i}] norm -> cx={cx:.4f} cy={cy:.4f} w={w:.4f} h={h:.4f}  "
                      f"valid={0<=cx<=1 and 0<=cy<=1 and 0<w<=1 and 0<h<=1}")
    return det_lines, seg_lines


# ---------------------------
# YOLO Conversion Functions
# ---------------------------

def transform_detection_annotations_to_yolo(
    annotations,
    img_w: int,
    img_h: int,
    transform_config: Optional[Dict] = None,
    original_dims: Optional[Tuple[int, int]] = None,
    class_index_resolver=None
) -> List[str]:
    """
    Transform detection annotations and convert to YOLO format:
    'class_id cx cy w h' normalized by the FINAL canvas (post-resize).
    
    If transform_config and original_dims are provided, annotations will be transformed first.
    """
    print(f"🎯 NEW DETECTION FUNCTION CALLED!")
    print(f"   Annotations: {len(annotations) if annotations else 0}")
    print(f"   Final dims: {img_w}x{img_h}")
    print(f"   Has transform_config: {bool(transform_config)}")
    print(f"   Original dims: {original_dims}")
    
    logger.debug(
        "operations.annotations",
        "Converting detection annotations to YOLO format",
        "yolo_detection_conversion_start",
        {
            'annotation_count': len(annotations) if annotations else 0,
            'image_dimensions': f"{img_w}x{img_h}",
            'has_transform_config': bool(transform_config),
            'has_class_resolver': bool(class_index_resolver),
        },
    )

    if not annotations:
        logger.debug("operations.annotations", "No annotations to convert", "yolo_detection_empty", {})
        return []

    # must be FINAL canvas (e.g., 640x480 for fit_within, 640x640 for letterbox/stretch/fill)
    assert img_w > 0 and img_h > 0, "YOLO conversion received invalid final canvas size"

    # 🔧 TRANSFORM ANNOTATIONS IF CONFIG PROVIDED
    working_annotations = annotations
    if transform_config and original_dims:
        print(f"🔧 TRANSFORMING ANNOTATIONS: {original_dims} → {img_w}x{img_h}")
        working_annotations = update_annotations_for_transformations(
            annotations=annotations,
            transformation_config=transform_config,
            original_dims=original_dims,
            new_dims=(img_w, img_h)
        )
        print(f"   Original: {len(annotations)} → Transformed: {len(working_annotations)}")
    else:
        print(f"⚠️  NO TRANSFORMATION - using raw annotations")

    yolo_lines: List[str] = []

    for ann in working_annotations:
        # class id
        if callable(class_index_resolver):
            try:
                class_id = int(class_index_resolver(ann))
            except Exception as e:
                logger.warning("errors.validation", "Class resolver failed, using fallback", "class_resolver_fallback", {'error': str(e)})
                class_id = int(getattr(ann, 'class_id', 0))
        else:
            class_id = int(getattr(ann, 'class_id', 0))

        # transformed bbox in pixels (already clipped to [0..img_w]x[0..img_h])
        x_min = float(getattr(ann, 'x_min', 0.0))
        y_min = float(getattr(ann, 'y_min', 0.0))
        x_max = float(getattr(ann, 'x_max', 0.0))
        y_max = float(getattr(ann, 'y_max', 0.0))

        # skip degenerates
        if x_max <= x_min or y_max <= y_min:
            logger.debug("operations.annotations", "Skipping degenerate bbox", "yolo_detection_degenerate", {
                'class_id': class_id, 'bbox': {'x_min': x_min, 'y_min': y_min, 'x_max': x_max, 'y_max': y_max}
            })
            continue

        # normalize (no max(1,...) and no clamp here)
        cx = (x_min + x_max) / 2.0 / img_w
        cy = (y_min + y_max) / 2.0 / img_h
        w  = (x_max - x_min) / img_w
        h  = (y_max - y_min) / img_h

        # sanity (don't "fix" here—if it fails, upstream clip/canvas is wrong)
        if not (0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
            logger.debug("errors.validation", "BBox out of [0,1] after normalization — likely wrong clip/canvas upstream",
                         "yolo_detection_out_of_bounds",
                         {'class_id': class_id, 'normalized': {'cx': cx, 'cy': cy, 'w': w, 'h': h}})
            continue

        yolo_line = f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
        yolo_lines.append(yolo_line)

        logger.debug("operations.annotations", "Detection annotation converted to YOLO", "yolo_detection_converted", {
            'class_id': class_id,
            'original_bbox': {'x_min': x_min, 'y_min': y_min, 'x_max': x_max, 'y_max': y_max},
            'normalized': {'cx': cx, 'cy': cy, 'w': w, 'h': h},
            'yolo_line': yolo_line
        })

    logger.debug("operations.annotations", "Detection annotations converted to YOLO format", "yolo_detection_conversion_complete",
                 {'total_converted': len(yolo_lines)})

    return yolo_lines


def transform_segmentation_annotations_to_yolo(
    annotations,
    img_w: int,
    img_h: int,
    transform_config: Optional[Dict] = None,
    original_dims: Optional[Tuple[int, int]] = None,
    class_index_resolver=None
) -> List[str]:
    """
    Transform segmentation annotations and convert to YOLO polygon format:
    'class_id x1 y1 x2 y2 ...' with coords normalized by the FINAL canvas.
    
    If transform_config and original_dims are provided, annotations will be transformed first.
    Supports:
      - ann.segmentation as [{"x":..,"y":..}], [x1,y1,...], or [[x1,y1,...],[...]]
      - Polygon.points as [(x,y), ...] if segmentation missing
    """
    print(f"🎯 NEW SEGMENTATION FUNCTION CALLED!")
    print(f"   Annotations: {len(annotations) if annotations else 0}")
    print(f"   Final dims: {img_w}x{img_h}")
    print(f"   Has transform_config: {bool(transform_config)}")
    print(f"   Original dims: {original_dims}")
    
    logger.debug(
        "operations.annotations",
        "Converting segmentation annotations to YOLO format",
        "yolo_segmentation_conversion_start",
        {
            'annotation_count': len(annotations) if annotations else 0,
            'image_dimensions': f"{img_w}x{img_h}",
            'has_transform_config': bool(transform_config),
            'has_class_resolver': bool(class_index_resolver),
        },
    )

    if not annotations:
        logger.debug("operations.annotations", "No annotations to convert", "yolo_segmentation_empty", {})
        return []

    # must be FINAL canvas (post-resize)
    assert img_w > 0 and img_h > 0, "YOLO conversion received invalid final canvas size"

    # 🔧 TRANSFORM ANNOTATIONS IF CONFIG PROVIDED
    working_annotations = annotations
    if transform_config and original_dims:
        print(f"🔧 TRANSFORMING ANNOTATIONS: {original_dims} → {img_w}x{img_h}")
        working_annotations = update_annotations_for_transformations(
            annotations=annotations,
            transformation_config=transform_config,
            original_dims=original_dims,
            new_dims=(img_w, img_h)
        )
        print(f"   Original: {len(annotations)} → Transformed: {len(working_annotations)}")
    else:
        print(f"⚠️  NO TRANSFORMATION - using raw annotations")

    yolo_lines: List[str] = []

    for ann in working_annotations:
        # class id
        if callable(class_index_resolver):
            try:
                class_id = int(class_index_resolver(ann))
            except Exception as e:
                logger.warning("errors.validation", "Class resolver failed, using fallback", "class_resolver_fallback", {'error': str(e)})
                class_id = int(getattr(ann, 'class_id', 0))
        else:
            class_id = int(getattr(ann, 'class_id', 0))

        seg = getattr(ann, 'segmentation', None)
        points_attr = getattr(ann, 'points', None)

        # parse segmentation if string
        if isinstance(seg, str):
            try:
                seg = json.loads(seg)
            except Exception as e:
                logger.debug("errors.validation", "Failed to parse segmentation JSON", "segmentation_json_parse_error",
                             {'error': str(e)})
                seg = None

        # collect rings in pixels
        rings: List[List[Tuple[float, float]]] = []

        if isinstance(seg, list) and len(seg) > 0:
            if isinstance(seg[0], dict) and 'x' in seg[0] and 'y' in seg[0]:
                rings.append([(float(p['x']), float(p['y'])) for p in seg])  # single ring
            elif isinstance(seg[0], list):
                # multiple rings: [[x1,y1,...], [x1,y1,...], ...]
                for flat in seg:
                    pts: List[Tuple[float, float]] = []
                    for i in range(0, len(flat) - 1, 2):
                        pts.append((float(flat[i]), float(flat[i+1])))
                    if len(pts) >= 3:
                        rings.append(pts)
            else:
                # flat list: [x1,y1,x2,y2,...]
                pts: List[Tuple[float, float]] = []
                for i in range(0, len(seg) - 1, 2):
                    pts.append((float(seg[i]), float(seg[i+1])))
                if len(pts) >= 3:
                    rings.append(pts)

        elif isinstance(points_attr, list) and len(points_attr) >= 3:
            rings.append([(float(x), float(y)) for (x, y) in points_attr])

        if not rings:
            logger.debug("errors.validation", "No valid rings for segmentation", "segmentation_no_valid_rings",
                         {'class_id': class_id})
            continue

        # build one YOLO line; keep good rings, drop only bad rings
        parts: List[str] = [str(class_id)]
        kept_any = False

        for pts in rings:
            ring_ok = True
            ring_vals: List[str] = []
            for (px, py) in pts:
                nx = px / img_w
                ny = py / img_h
                if not (0.0 <= nx <= 1.0 and 0.0 <= ny <= 1.0):
                    logger.debug("errors.validation", "Segmentation point OOB; dropping this ring",
                                 "yolo_segmentation_ring_oob",
                                 {'class_id': class_id, 'px': px, 'py': py, 'img_w': img_w, 'img_h': img_h})
                    ring_ok = False
                    break
                ring_vals.append(f"{nx:.6f}")
                ring_vals.append(f"{ny:.6f}")
            if ring_ok and ring_vals:
                parts.extend(ring_vals)
                kept_any = True

        if not kept_any:
            continue

        yolo_line = " ".join(parts)
        yolo_lines.append(yolo_line)

        logger.debug("operations.annotations", "Segmentation annotation converted to YOLO",
                     "yolo_segmentation_converted",
                     {'class_id': class_id, 'num_rings': len(rings), 'yolo_line_length': len(yolo_line)})

    logger.debug("operations.annotations", "Segmentation annotations converted to YOLO format",
                 "yolo_segmentation_conversion_complete", {'total_converted': len(yolo_lines)})

    return yolo_lines





