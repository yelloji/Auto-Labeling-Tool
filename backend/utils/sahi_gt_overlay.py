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
from sqlalchemy.orm import Session
from database.models import ModelExperiment, Annotation, Image as DBImage
from utils.sahi_gt_matching import match_predictions_to_gt, FULL_COVERAGE_THRESHOLD

COVERAGE_MODES = ("length", "width", "total")


def _get_filename(path: str) -> str:
    return path.replace("\\", "/").split("/")[-1] if path else ""


def _load_gt_polygons_for_image(db: Session, filename: str) -> List[list]:
    """Real GT crack polygons (absolute pixel points) for one image.
    Source: the `annotations` table (original, un-tiled images) — the same
    source already used by the Analytic Report and Guide Bot review flow."""
    rows = (
        db.query(Annotation.segmentation)
        .join(DBImage, Annotation.image_id == DBImage.id)
        .filter(DBImage.filename == filename)
        .all()
    )
    polygons: List[list] = []
    for (seg_json,) in rows:
        if not seg_json:
            continue
        try:
            seg = json.loads(seg_json) if isinstance(seg_json, str) else seg_json
        except Exception:
            continue
        points = [(pt["x"], pt["y"]) for pt in seg if "x" in pt and "y" in pt]
        if len(points) >= 3:
            polygons.append(points)
    return polygons


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

        experiment = db.query(ModelExperiment).filter(ModelExperiment.id == experiment_id).first()
        if not experiment:
            return {"error": "Experiment not found."}

        filename = _get_filename(image_name)
        gt_polygons = _load_gt_polygons_for_image(db, filename)

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

        return {
            "image_name": filename,
            "coverage_mode": coverage_mode,
            "full_coverage_threshold": full_coverage_threshold,
            "gt_cracks": gt_cracks,
            "predictions": predictions_out,
        }

    except Exception as e:
        from logging_system.professional_logger import get_professional_logger
        logger = get_professional_logger()
        logger.error("engine.sahi_gt_overlay", f"Failed to compute GT overlay for {image_name}: {str(e)}")
        return {"error": str(e)}
