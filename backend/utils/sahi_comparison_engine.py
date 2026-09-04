"""
SAHI-aware comparison mode — plugs the pixel-coverage GT matcher
(sahi_gt_matching.match_predictions_to_gt) into a baseline-vs-challenger
comparison, instead of the standard greedy 1-GT-to-1-prediction matcher.

Fully automatic (GT polygons vs prediction polygons only) — no human
verification involved. See sahi_gt_matching.py for why this exists: the
standard matcher wrongly counts real crack fragments (from SAHI tile
splitting) as false positives.
"""
import json
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from database.models import ModelExperiment, Annotation, Image as DBImage
from utils.sahi_gt_matching import match_predictions_to_gt, FULL_COVERAGE_THRESHOLD
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

COVERAGE_MODES = ("length", "width", "total")


def _get_filename(path: str) -> str:
    return path.replace("\\", "/").split("/")[-1] if path else ""


def _load_gt_polygons_by_image(db: Session, image_filenames: set) -> Dict[str, List[list]]:
    """Real GT crack polygons (absolute pixel points), keyed by image filename.
    Source: the `annotations` table (original, un-tiled images) — the same
    source already used by the Analytic Report and Guide Bot review flow."""
    if not image_filenames:
        return {}
    rows = (
        db.query(DBImage.filename, Annotation.segmentation)
        .join(Annotation, Annotation.image_id == DBImage.id)
        .filter(DBImage.filename.in_(image_filenames))
        .all()
    )
    result: Dict[str, List[list]] = {}
    for filename, seg_json in rows:
        if not seg_json:
            continue
        try:
            seg = json.loads(seg_json) if isinstance(seg_json, str) else seg_json
        except Exception:
            continue
        points = [(pt["x"], pt["y"]) for pt in seg if "x" in pt and "y" in pt]
        if len(points) >= 3:
            result.setdefault(filename, []).append(points)
    return result


def _load_pred_polygons_by_image(experiment: ModelExperiment) -> Dict[str, List[list]]:
    """Final (already-deduplicated) prediction polygons (absolute pixel points),
    keyed by image filename. Source: the experiment's own stored predictions."""
    predictions = experiment.predictions
    if isinstance(predictions, str):
        predictions = json.loads(predictions)
    if not predictions:
        return {}

    result: Dict[str, List[list]] = {}
    for img_key, dets in predictions.items():
        if not isinstance(dets, list):
            continue
        filename = _get_filename(img_key)
        polys = []
        for d in dets:
            seg = d.get("segmentation")
            if seg and len(seg) >= 3:
                polys.append([(pt[0], pt[1]) for pt in seg])
            else:
                bbox = d.get("bbox")
                if bbox and len(bbox) == 4:
                    x1, y1, x2, y2 = bbox
                    polys.append([(x1, y1), (x2, y1), (x2, y2), (x1, y2)])
        result[filename] = polys
    return result


def _classify(coverage_value: float, threshold: float, has_any_match: bool) -> str:
    if not has_any_match:
        return "missing"
    return "tp" if coverage_value >= threshold else "partial_missing"


def _coverage_for_mode(gt_result: dict, mode: str) -> float:
    return gt_result[f"coverage_{mode}"]


def _compute_experiment_pixel_stats(
    experiment: ModelExperiment,
    gt_by_image: Dict[str, List[list]],
    pred_by_image: Dict[str, List[list]],
    common_images: set,
    coverage_mode: str,
    full_coverage_threshold: float,
) -> dict:
    """Run the pixel-coverage matcher image-by-image over the given common
    image set, and aggregate into per-experiment TP/FP/Partial/Missing totals
    and Precision/Recall/Accuracy — for ALL THREE coverage modes at once, so
    the UI can switch modes without recomputing."""
    totals_by_mode = {m: {"tp": 0, "fp": 0, "partial_missing": 0, "missing": 0} for m in COVERAGE_MODES}
    per_image_details = []

    for img in sorted(common_images):
        gt_polys = gt_by_image.get(img, [])
        pred_polys = pred_by_image.get(img, [])
        if not gt_polys and not pred_polys:
            continue

        match_result = match_predictions_to_gt(gt_polys, pred_polys, full_coverage_threshold=full_coverage_threshold)

        fp_count = len(match_result["fp_pred_indices"])
        for mode in COVERAGE_MODES:
            totals_by_mode[mode]["fp"] += fp_count
            for gt_r in match_result["gt_results"]:
                status = _classify(_coverage_for_mode(gt_r, mode), full_coverage_threshold, bool(gt_r["matched_pred_indices"]))
                totals_by_mode[mode][status] += 1

        per_image_details.append({
            "image_name": img,
            "gt_count": len(gt_polys),
            "pred_count": len(pred_polys),
            "fp_count": fp_count,
            "gt_results": match_result["gt_results"],
        })

    metrics_by_mode = {}
    for mode in COVERAGE_MODES:
        t = totals_by_mode[mode]
        tp, fp, missing = t["tp"], t["fp"], t["missing"]
        precision = (tp / (tp + fp)) if (tp + fp) else None
        recall = (tp / (tp + missing)) if (tp + missing) else None
        accuracy = (tp / (tp + fp + missing)) if (tp + fp + missing) else None
        metrics_by_mode[mode] = {
            "totals": t,
            "precision": precision, "recall": recall, "accuracy": accuracy,
        }

    return {
        "experiment_id": experiment.id,
        "experiment_name": experiment.name,
        "image_count": len(common_images),
        "metrics_by_mode": metrics_by_mode,
        "per_image": per_image_details,
    }


def calculate_sahi_pixel_comparison(
    db: Session,
    baseline_exp_id: str,
    challenger_exp_id: str,
    coverage_mode: str = "length",
    full_coverage_threshold: float = FULL_COVERAGE_THRESHOLD,
) -> dict:
    """
    SAHI-aware baseline-vs-challenger comparison using real pixel-coverage GT
    matching (see sahi_gt_matching.py) instead of the standard greedy matcher.
    Requires both experiments to have real GT-backed images (dataset_source
    with annotations in the `annotations` table) — not upload-mode experiments.
    """
    try:
        if coverage_mode not in COVERAGE_MODES:
            return {"error": f"coverage_mode must be one of {COVERAGE_MODES}"}

        baseline_exp = db.query(ModelExperiment).filter(ModelExperiment.id == baseline_exp_id).first()
        challenger_exp = db.query(ModelExperiment).filter(ModelExperiment.id == challenger_exp_id).first()
        if not baseline_exp or not challenger_exp:
            return {"error": "One or both experiments not found."}

        baseline_preds = _load_pred_polygons_by_image(baseline_exp)
        challenger_preds = _load_pred_polygons_by_image(challenger_exp)

        common_images = set(baseline_preds.keys()) & set(challenger_preds.keys())
        if not common_images:
            return {"error": "Baseline and challenger have no images in common — SAHI pixel comparison needs the same images in both."}

        gt_by_image = _load_gt_polygons_by_image(db, common_images)

        baseline_stats = _compute_experiment_pixel_stats(
            baseline_exp, gt_by_image, baseline_preds, common_images, coverage_mode, full_coverage_threshold
        )
        challenger_stats = _compute_experiment_pixel_stats(
            challenger_exp, gt_by_image, challenger_preds, common_images, coverage_mode, full_coverage_threshold
        )

        return {
            "mode": "sahi_pixel",
            "coverage_mode": coverage_mode,
            "full_coverage_threshold": full_coverage_threshold,
            "common_image_count": len(common_images),
            "baseline": baseline_stats,
            "challenger": challenger_stats,
        }

    except Exception as e:
        logger.error("engine.sahi_pixel_comparison", f"Failed to compute SAHI pixel comparison: {str(e)}")
        return {"error": str(e)}
