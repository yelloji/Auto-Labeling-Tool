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
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass
class BoundingBoxPixels:
    x_min: float
    y_min: float
    x_max: float
    y_max: float
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


def transform_detection_annotations_to_yolo(
    annotations: Iterable[Any],
    img_w: int,
    img_h: int,
    transform_config: Dict[str, Dict[str, Any]],
    class_index_resolver=None,
) -> List[str]:
    """Convert annotations to YOLO detection lines after applying transforms.

    transform_config is a mapping like { "rotate": {"angle": 15, "enabled": True }, ... }
    Only rotate, flip, resize are considered here.
    """
    # Extract effective parameters
    angle = float(transform_config.get("rotate", {}).get("angle", 0) or 0)
    flip_h = bool(transform_config.get("flip", {}).get("horizontal", False))
    flip_v = bool(transform_config.get("flip", {}).get("vertical", False))

    # Optional resize: if present, use target dims for scaling during transform
    resize_params = transform_config.get("resize", {}) if transform_config.get("resize", {}).get("enabled", False) else {}
    target_w = int(resize_params.get("width", img_w) or img_w)
    target_h = int(resize_params.get("height", img_h) or img_h)

    lines: List[str] = []
    for ann in annotations:
        bbox = _extract_bbox_pixels(ann, img_w, img_h)
        if not bbox:
            continue

        xmin, ymin, xmax, ymax = bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max

        # Apply flip first in original space
        if flip_h or flip_v:
            xmin, ymin, xmax, ymax = _apply_flip_box(xmin, ymin, xmax, ymax, img_w, img_h, flip_h, flip_v)

        # Apply resize (scale box into new size)
        rxmin, rymin, rxmax, rymax = _apply_resize_box(xmin, ymin, xmax, ymax, img_w, img_h, target_w, target_h)

        # Apply rotation about center of final image if angle != 0
        if angle != 0:
            yolo = _rotate_bbox_axis_aligned(rxmin, rymin, rxmax, rymax, target_w, target_h, angle)
            if not yolo:
                continue
            cxn, cyn, wn, hn = yolo
        else:
            bw, bh = rxmax - rxmin, rymax - rymin
            cxn = ((rxmin + rxmax) / 2.0) / float(target_w)
            cyn = ((rymin + rymax) / 2.0) / float(target_h)
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

    return lines


def transform_polygon_points(
    points: List[Tuple[float, float]],
    img_w: int,
    img_h: int,
    transform_config: Dict[str, Dict[str, Any]],
) -> List[Tuple[float, float]]:
    """Apply flip/resize/rotate to polygon points in pixels and return pixel points."""
    angle = float(transform_config.get("rotate", {}).get("angle", 0) or 0)
    flip_h = bool(transform_config.get("flip", {}).get("horizontal", False))
    flip_v = bool(transform_config.get("flip", {}).get("vertical", False))
    resize_params = transform_config.get("resize", {}) if transform_config.get("resize", {}).get("enabled", False) else {}
    target_w = int(resize_params.get("width", img_w) or img_w)
    target_h = int(resize_params.get("height", img_h) or img_h)

    # Flip
    fpoints = []
    for x, y in points:
        px, py = x, y
        if 0.0 <= px <= 1.0 and 0.0 <= py <= 1.0:
            px, py = px * img_w, py * img_h
        if flip_h:
            px = img_w - px
        if flip_v:
            py = img_h - py
        fpoints.append((px, py))

    # Resize
    sx, sy = target_w / float(img_w), target_h / float(img_h)
    rpoints = [(px * sx, py * sy) for px, py in fpoints]

    # Rotate around center
    if angle != 0:
        cx, cy = target_w / 2.0, target_h / 2.0
        rad = math.radians(angle)
        rpoints = [_rotate_point_cxcy(px, py, cx, cy, rad) for px, py in rpoints]

    return rpoints


def transform_segmentation_annotations_to_yolo(
    annotations: Iterable[Any],
    img_w: int,
    img_h: int,
    transform_config: Dict[str, Dict[str, Any]],
    class_index_resolver=None,
) -> List[str]:
    """Convert polygon annotations to YOLO segmentation lines after transforms."""
    lines: List[str] = []
    for ann in annotations:
        class_id = int(class_index_resolver(ann) if callable(class_index_resolver) else getattr(ann, "class_id", 0) or 0)
        seg = getattr(ann, "segmentation", None)
        if not seg:
            continue
        # seg may be list or JSON string; expected flat list [x1,y1,x2,y2,...] normalized or pixels
        try:
            pts = seg
            if isinstance(seg, str):
                pts = json.loads(seg)
            if isinstance(pts, dict) and "points" in pts:
                pts = pts["points"]
            # Normalize list to pairs
            pairs: List[Tuple[float, float]] = []
            if isinstance(pts, list):
                if len(pts) >= 2 and all(isinstance(v, (int, float)) for v in pts):
                    it = iter(pts)
                    pairs = [(float(x), float(next(it))) for x in it]
                elif len(pts) >= 1 and isinstance(pts[0], (list, tuple)):
                    pairs = [(float(x), float(y)) for x, y in pts]
            if not pairs:
                continue
            tpoints = transform_polygon_points(pairs, img_w, img_h, transform_config)
            # Clamp and normalize
            norm = []
            for x, y in tpoints:
                nx = max(0.0, min(1.0, x / img_w))
                ny = max(0.0, min(1.0, y / img_h))
                norm.extend([f"{nx:.6f}", f"{ny:.6f}"])
            if len(norm) >= 6:
                lines.append(" ".join([str(class_id)] + norm))
        except Exception:
            continue

    return lines


