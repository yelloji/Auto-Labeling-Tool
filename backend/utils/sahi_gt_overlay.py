"""
Live SAHI Prediction image-viewer overlay — real GT crack shapes and pixel-
coverage match results for ONE image in ONE experiment.

Separate from sahi_comparison_engine.py: that module compares two
experiments against each other (baseline vs challenger); this one supports
looking at a single experiment's predictions on a single image while
reviewing/labeling — real crack polygons instead of boxes, which
predictions belong to which GT crack, coverage %, and genuine FP flags.
"""
import json
from typing import Dict, List
from sqlalchemy.orm import Session, defer
from database.models import ModelExperiment
from utils.sahi_gt_matching import match_predictions_to_gt, FULL_COVERAGE_THRESHOLD
from utils.experiment_image_resolver import (
    get_filename as _get_filename,
    get_experiment_image_meta,
    resolve_experiment_image,
    load_gt_polygons,
)
from utils import overlay_cache

COVERAGE_MODES = ("length", "width", "total")

# Bump whenever the shape of the returned dict changes, so cached results from
# an older shape are never served. 2 added image_width / image_height.
OVERLAY_FORMAT = 2


def get_gt_overlay_for_image(
    db: Session,
    experiment_id: str,
    image_name: str,
    coverage_mode: str = "length",
    full_coverage_threshold: float = FULL_COVERAGE_THRESHOLD,
) -> dict:
    """
    Real GT polygons + match result for ONE image in ONE experiment — powers
    the live image viewer overlay (real crack shapes, not boxes; which
    predictions belong to which GT; coverage %; genuine FP flags).
    """
    try:
        if coverage_mode not in COVERAGE_MODES:
            return {"error": f"coverage_mode must be one of {COVERAGE_MODES}"}

        # `predictions` is several megabytes of JSON and a cache hit never looks
        # at it, so it is deferred: SQLAlchemy fetches it lazily, on the first
        # attribute access, which only happens when the overlay is recomputed.
        # Loading it eagerly cost ~250ms on every request.
        experiment = (
            db.query(ModelExperiment)
            .options(defer(ModelExperiment.predictions))
            .filter(ModelExperiment.id == experiment_id)
            .first()
        )
        if not experiment:
            return {"error": "Experiment not found."}

        filename = _get_filename(image_name)
        # Resolved by the md5 this experiment recorded, so a same-named photo
        # from another shoot cannot contribute its cracks to this image.
        image_row = resolve_experiment_image(db, experiment, image_name)

        # Rasterising and skeletonising the full-resolution masks costs ~700ms
        # for a ~10KB answer that cannot change while the experiment stays
        # completed, so it is computed once per label state. The key carries the
        # label fingerprint, so editing a crack rebuilds it automatically.
        # Only cache once the experiment is finished and the image is actually
        # known: a running experiment keeps changing, and an unresolved image
        # means something is wrong rather than that the answer is empty.
        cacheable = experiment.status == "completed" and image_row is not None
        cached_at = None
        if cacheable:
            # OVERLAY_FORMAT is part of the key, so adding a field to the result
            # invalidates every stale entry instead of serving an older shape.
            variant = f"v{OVERLAY_FORMAT}:{coverage_mode}:{full_coverage_threshold}"
            fingerprint = overlay_cache.label_fingerprint(db, image_row)
            cached_at = overlay_cache.cache_path(
                experiment_id, image_name, fingerprint, variant,
                getattr(experiment, "project_name", None))
            hit = overlay_cache.read(cached_at)
            if hit is not None:
                return hit

        gt_polygons = load_gt_polygons(db, image_row)

        predictions = experiment.predictions
        if isinstance(predictions, str):
            predictions = json.loads(predictions)
        predictions = predictions or {}
        pred_key = next((k for k in predictions if _get_filename(k) == filename), None)
        raw_preds = predictions.get(pred_key, []) if pred_key else []

        pred_polygons = []
        pred_meta = []
        for d in raw_preds:
            seg = d.get("segmentation")
            if seg and len(seg) >= 3:
                poly = [(pt[0], pt[1]) for pt in seg]
            else:
                bbox = d.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue
                x1, y1, x2, y2 = bbox
                poly = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
            pred_polygons.append(poly)
            pred_meta.append({
                "class_name": d.get("class") or d.get("class_name"),
                "confidence": d.get("confidence"),
                "bbox": d.get("bbox"),
            })

        match = match_predictions_to_gt(gt_polygons, pred_polygons, full_coverage_threshold=full_coverage_threshold)

        gt_cracks = []
        for gt_r in match["gt_results"]:
            gt_cracks.append({
                "gt_index": gt_r["gt_index"],
                "polygon": [list(p) for p in gt_polygons[gt_r["gt_index"]]],
                "status": gt_r["status"],
                "coverage_length": gt_r["coverage_length"],
                "coverage_width": gt_r["coverage_width"],
                "coverage_total": gt_r["coverage_total"],
                "matched_pred_indices": gt_r["matched_pred_indices"],
            })

        fp_set = set(match["fp_pred_indices"])
        predictions_out = []
        for i, (poly, meta) in enumerate(zip(pred_polygons, pred_meta)):
            predictions_out.append({
                "pred_index": i,
                "polygon": [list(p) for p in poly],
                "class_name": meta["class_name"],
                "confidence": meta["confidence"],
                "bbox": meta["bbox"],
                "is_fp": i in fp_set,
            })

        # The polygons below are in original-image pixels, so the viewer needs
        # the original's size to place them. Sending it here means the overlay
        # can be drawn over the stand-in preview immediately, instead of waiting
        # for the full-size image just to learn how big it is.
        meta = get_experiment_image_meta(experiment, image_name) or {}
        img_w = (getattr(image_row, "width", None) if image_row else None) or meta.get("width")
        img_h = (getattr(image_row, "height", None) if image_row else None) or meta.get("height")

        result = {
            "image_name": filename,
            "coverage_mode": coverage_mode,
            "full_coverage_threshold": full_coverage_threshold,
            "image_width": img_w,
            "image_height": img_h,
            "gt_cracks": gt_cracks,
            "predictions": predictions_out,
        }
        if cacheable:
            overlay_cache.write(cached_at, result)
        return result

    except Exception as e:
        from logging_system.professional_logger import get_professional_logger
        logger = get_professional_logger()
        logger.error("engine.sahi_gt_overlay", f"Failed to compute GT overlay for {image_name}: {str(e)}")
        return {"error": str(e)}
