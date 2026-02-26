"""
Global Comparison Engine Utility

Supports two comparison modes:
  - SPLIT MODE:  Both experiments ran on a dataset split with real ground truth labels.
                 GT is loaded automatically — no human verifications needed.
                 Returns side-by-side quality metrics (Precision, Recall, F1, IoU, TP/FP/FN).
  - UPLOAD MODE: No ground truth. Compares human verifications (PASS/FAIL/manual marks)
                 from the baseline against raw predictions of the challenger.
"""
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from database.models import HumanVerification, ModelExperiment
from utils.ground_truth_loader import calculate_iou
from utils.analytics_engine import calculate_experiment_quality
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


def _get_project_root() -> Path:
    """Resolve the project root (parent of /backend) — same logic as api_routes.py."""
    current = Path(__file__).resolve()
    backend_dir = next(p for p in current.parents if p.name == "backend")
    return backend_dir.parent



def calculate_split_comparison(
    db: Session,
    baseline_exp_id: str,
    challenger_b_id: str,
    challenger_c_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Split-mode comparison: uses real GT labels from the dataset.
    Runs calculate_experiment_quality on each experiment and returns side-by-side metrics.
    No human verifications required.
    """
    try:
        project_root = _get_project_root()

        baseline_exp = db.query(ModelExperiment).filter(ModelExperiment.id == baseline_exp_id).first()
        challenger_b  = db.query(ModelExperiment).filter(ModelExperiment.id == challenger_b_id).first()

        if not baseline_exp or not challenger_b:
            return {"error": "One or both experiments not found."}

        stats_a = calculate_experiment_quality(baseline_exp, project_root)
        stats_b = calculate_experiment_quality(challenger_b,  project_root)

        stats_a_fmt = _format_split_stats(baseline_exp.name, baseline_exp_id, stats_a, baseline_exp)
        stats_b_fmt = _format_split_stats(challenger_b.name, challenger_b_id, stats_b, challenger_b)

        result = {
            "mode": "split",
            "baseline":     _strip_internals(stats_a_fmt),
            "challenger_b": _strip_internals(stats_b_fmt),
            "delta_b": _compute_delta_gallery(stats_a_fmt, stats_b_fmt)
                       if stats_a_fmt.get("has_ground_truth") and stats_b_fmt.get("has_ground_truth")
                       else None,
        }

        if challenger_c_id:
            challenger_c = db.query(ModelExperiment).filter(ModelExperiment.id == challenger_c_id).first()
            if challenger_c:
                stats_c = calculate_experiment_quality(challenger_c, project_root)
                stats_c_fmt = _format_split_stats(challenger_c.name, challenger_c_id, stats_c, challenger_c)
                result["challenger_c"] = _strip_internals(stats_c_fmt)
                result["delta_c"] = _compute_delta_gallery(stats_a_fmt, stats_c_fmt) \
                    if stats_a_fmt.get("has_ground_truth") and stats_c_fmt.get("has_ground_truth") else None

        return result


    except Exception as e:
        logger.error("engine.split_comparison", f"Failed to compute split comparison: {str(e)}")
        return {"error": str(e)}


def _format_split_stats(name: str, exp_id: str, stats: Dict, exp=None) -> Dict:
    """Normalise quality stats into a consistent shape for the frontend."""
    completed = getattr(exp, 'completed_at', None)
    base = {
        "name": name,
        "id": exp_id,
        "training_name": getattr(exp, 'training_name', None) if exp else None,
        "dataset_source": getattr(exp, 'dataset_source', None) if exp else None,
        "dataset_path": getattr(exp, 'dataset_path', None) if exp else None,
        "confidence": getattr(exp, 'confidence', None) if exp else None,
        "iou_threshold": getattr(exp, 'iou_threshold', None) if exp else None,
        "image_count": getattr(exp, 'image_count', None) if exp else None,
        "completed_at": completed.isoformat() if completed else None,
    }
    if not stats.get("has_ground_truth"):
        return {
            **base,
            "has_ground_truth": False,
            "gt_error": stats.get("error", "dataset_path missing or no annotations found"),
            "precision": None, "recall": None, "f1": None, "avg_iou": None,
            "true_positives": None, "false_positives": None, "false_negatives": None,
            "total_gt": None, "total_preds": None,
        }
    return {
        **base,
        "has_ground_truth": True,
        "precision":        stats.get("precision"),
        "recall":           stats.get("recall"),
        "f1":               stats.get("f1"),
        "avg_iou":          round((stats.get("avg_iou") or 0) * 100, 1),
        "true_positives":   stats.get("total_gt", 0) - stats.get("missed_objects", 0),
        "false_positives":  stats.get("false_positives", 0),
        "false_negatives":  stats.get("missed_objects", 0),
        "total_gt":         stats.get("total_gt"),
        "total_preds":      stats.get("total_preds"),
        # Detailed per-detection lists for delta gallery (kept on each model)
        "_detail_fps":  stats.get("detailed_false_positives", []),
        "_detail_fns":  stats.get("detailed_missed_objects", []),
        "_detail_tps":  stats.get("detailed_true_positives", []),
    }


def _strip_internals(d: Dict) -> Dict:
    """Remove internal _detail_* keys before sending response to frontend."""
    return {k: v for k, v in d.items() if not k.startswith("_")}


def _compute_delta_gallery(stats_a: Dict, stats_b: Dict) -> Dict:
    """
    Compare FP/FN counts per image between baseline (A) and challenger (B).

    Rules (image-level, based on count difference):
      - Fixed FP   : image has FEWER FPs in B than in A (improvement)    ✅
      - Fixed FN   : image has FEWER FNs in B than in A (improvement)    ✅
      - New FP     : image has MORE  FPs in B than in A (regression)     ❌
      - New FN     : image has MORE  FNs in B than in A (regression)     ❌
    """
    a_fps = stats_a.get("_detail_fps", [])
    a_fns = stats_a.get("_detail_fns", [])
    a_tps = stats_a.get("_detail_tps", [])
    b_fps = stats_b.get("_detail_fps", [])
    b_fns = stats_b.get("_detail_fns", [])
    b_tps = stats_b.get("_detail_tps", [])

    # Build per-image detail maps
    def detail_map(detail_list):
        m: Dict[str, list] = {}
        for d in detail_list:
            img = d.get("image")
            if img:
                if img not in m: m[img] = []
                m[img].append(d)
        return m

    a_fp_map = detail_map(a_fps)
    a_fn_map = detail_map(a_fns)
    a_tp_map = detail_map(a_tps)
    b_fp_map = detail_map(b_fps)
    b_fn_map = detail_map(b_fns)
    b_tp_map = detail_map(b_tps)

    all_images = set(
        list(a_fp_map.keys()) + list(b_fp_map.keys()) + 
        list(a_fn_map.keys()) + list(b_fn_map.keys()) +
        list(a_tp_map.keys()) + list(b_tp_map.keys())
    )

    fixed_fp, new_fp, fixed_fn, new_fn = [], [], [], []
    improved_conf, degraded_conf = [], []

    def calculate_iou(box1, box2):
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        if x2 < x1 or y2 < y1: return 0.0
        intersection = (x2 - x1) * (y2 - y1)
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union = area1 + area2 - intersection
        return intersection / union if union > 0 else 0.0

    for img in sorted(all_images):
        a_fp_list = a_fp_map.get(img, [])
        b_fp_list = b_fp_map.get(img, [])
        a_fn_list = a_fn_map.get(img, [])
        b_fn_list = b_fn_map.get(img, [])
        a_tp_list = a_tp_map.get(img, [])
        b_tp_list = b_tp_map.get(img, [])

        a_fp = len(a_fp_list)
        b_fp = len(b_fp_list)
        a_fn = len(a_fn_list)
        b_fn = len(b_fn_list)
        fp_delta = b_fp - a_fp
        fn_delta = b_fn - a_fn

        # Confidence and Class Confusion analysis on True Positives
        conf_deltas = []
        class_confusions = []
        matched_b_tps = set()
        
        for a_tp in a_tp_list:
            best_iou = 0.5
            best_match = None
            best_idx = -1
            for idx, b_tp in enumerate(b_tp_list):
                if idx in matched_b_tps: continue
                iou = calculate_iou(a_tp.get("bbox", [0,0,0,0]), b_tp.get("bbox", [0,0,0,0]))
                if iou > best_iou:
                    best_iou = iou
                    best_match = b_tp
                    best_idx = idx
            
            if best_match:
                matched_b_tps.add(best_idx)
                conf_a = a_tp.get("confidence", 0)
                conf_b = best_match.get("confidence", 0)
                delta = conf_b - conf_a
                conf_deltas.append(delta)
                
                class_a = a_tp.get("class_name")
                class_b = best_match.get("class_name")
                if class_a != class_b:
                    class_confusions.append({
                        "bbox": best_match.get("bbox"),
                        "baseline_class": class_a,
                        "challenger_class": class_b
                    })
        
        avg_conf_delta = sum(conf_deltas) / len(conf_deltas) if conf_deltas else 0.0
        improved_boxes = sum(1 for d in conf_deltas if d > 0.05)
        degraded_boxes = sum(1 for d in conf_deltas if d < -0.05)

        # Determine Verdict
        verdict = "no change"
        # B is better if it reduced FPs/FNs significantly, or if counts are same but confidence improved
        if fp_delta < 0 or fn_delta < 0:
            verdict = "B better"
        elif fp_delta > 0 or fn_delta > 0:
            verdict = "B worse"
        elif avg_conf_delta > 0.05:
            verdict = "B better"
        elif avg_conf_delta < -0.05:
            verdict = "B worse"

        item = {
            "image_name": img,
            "a_fps": a_fp, "b_fps": b_fp,
            "a_fns": a_fn, "b_fns": b_fn,
            "fp_delta": fp_delta,
            "fn_delta": fn_delta,
            "avg_conf_delta": round(avg_conf_delta, 3),
            "improved_boxes": improved_boxes,
            "degraded_boxes": degraded_boxes,
            "class_confusions": class_confusions,
            "verdict": verdict,
            "a_fp_list": a_fp_list,
            "b_fp_list": b_fp_list,
            "a_fn_list": a_fn_list,
            "b_fn_list": b_fn_list,
            "a_tp_list": a_tp_list,
            "b_tp_list": b_tp_list,
        }

        if b_fp < a_fp:
            fixed_fp.append(item)
        elif b_fp > a_fp:
            new_fp.append(item)

        if b_fn < a_fn:
            fixed_fn.append(item)
        elif b_fn > a_fn:
            new_fn.append(item)
            
        # Track confidence improvements regardless of FP/FN changes
        if improved_boxes > 0:
            improved_conf.append(item)
        if degraded_boxes > 0:
            degraded_conf.append(item)

    # Sort: biggest improvement / biggest regression first
    fixed_fp.sort(key=lambda x: x["fp_delta"])        # most negative first (biggest fix)
    new_fp.sort(key=lambda x: -x["fp_delta"])         # most positive first (biggest regression)
    fixed_fn.sort(key=lambda x: x["fn_delta"])
    new_fn.sort(key=lambda x: -x["fn_delta"])
    improved_conf.sort(key=lambda x: -x["avg_conf_delta"])
    degraded_conf.sort(key=lambda x: x["avg_conf_delta"])

    return {
        "fixed_fp": fixed_fp,
        "fixed_fn": fixed_fn,
        "new_fp":   new_fp,
        "new_fn":   new_fn,
        "improved_conf": improved_conf,
        "degraded_conf": degraded_conf,
        "counts": {
            "fixed_fp": len(fixed_fp),
            "fixed_fn": len(fixed_fn),
            "new_fp":   len(new_fp),
            "new_fn":   len(new_fn),
            "improved_conf": len(improved_conf),
            "degraded_conf": len(degraded_conf),
        },
        # Total detections saved / added across all images in each category
        "detections": {
            "fp_saved":  sum(abs(x["fp_delta"]) for x in fixed_fp),
            "fn_saved":  sum(abs(x["fn_delta"]) for x in fixed_fn),
            "fp_added":  sum(x["fp_delta"] for x in new_fp),
            "fn_added":  sum(x["fn_delta"] for x in new_fn),
            "improved_conf": sum(x["improved_boxes"] for x in improved_conf),
            "degraded_conf": sum(x["degraded_boxes"] for x in degraded_conf),
        }
    }





def calculate_three_way_delta(
    db: Session,
    project_id: int,
    baseline_exp_id: str,
    challenger_b_id: str,
    challenger_c_id: str
) -> Dict[str, Any]:
    """
    Runs two independent A vs B and A vs C comparisons and merges the results.
    Returns both result sets so the frontend can display them side-by-side.
    """
    result_b = calculate_model_delta(db, project_id, baseline_exp_id, challenger_b_id)
    result_c = calculate_model_delta(db, project_id, baseline_exp_id, challenger_c_id)

    if "error" in result_b:
        return result_b
    if "error" in result_c:
        return result_c

    return {
        "mode": "three_way",
        "baseline_name": result_b.get("baseline_name"),
        "challenger_b": {
            "name": result_b.get("challenger_name"),
            "counts": result_b.get("counts"),
            "deltas": result_b.get("deltas"),
        },
        "challenger_c": {
            "name": result_c.get("challenger_name"),
            "counts": result_c.get("counts"),
            "deltas": result_c.get("deltas"),
        },
    }

def calculate_model_delta(db: Session, project_id: int, baseline_exp_id: str, challenger_exp_id: str) -> Dict[str, Any]:
    """
    Compares manual verifications from the baseline experiment against raw predictions from the challenger experiment.
    Calculates exactly how many mistakes were fixed and how many working detections were broken.
    """
    try:
        # 1. Fetch Experiments
        baseline_exp = db.query(ModelExperiment).filter(ModelExperiment.id == baseline_exp_id).first()
        challenger_exp = db.query(ModelExperiment).filter(ModelExperiment.id == challenger_exp_id).first()
        
        if not baseline_exp or not challenger_exp:
            return {"error": "One or both experiments not found."}

        # 2. Parse Challenger Predictions
        challenger_preds = {}
        if challenger_exp.predictions:
            challenger_preds = json.loads(challenger_exp.predictions) if isinstance(challenger_exp.predictions, str) else challenger_exp.predictions

        # 3. Fetch Manual Verifications for Baseline
        verifications = db.query(HumanVerification).filter(
            HumanVerification.project_id == project_id,
            HumanVerification.experiment_id == baseline_exp_id
        ).all()

        if not verifications:
             return {
                "message": "No manual verifications found for the baseline model to compare against.",
                "resolved_false_positives": [],
                "resolved_misses": [],
                "regressions": [],
                "persistent_false_positives": [],
                "persistent_misses": []
            }

        delta_results = {
            "resolved_false_positives": [],  # Was Fail -> Now Ignored (Good)
            "resolved_misses": [],           # Was Missing -> Now Detected (Good)
            "regressions": [],               # Was Pass -> Now Missed (Bad)
            "persistent_false_positives": [],# Was Fail -> Still Detected (Bad)
            "persistent_misses": []          # Was Missing -> Still Missed (Bad)
        }

        # 4. Compare Objects via Spatial IoU
        IOU_THRESHOLD = 0.3

        for v in verifications:
            # Baseline box
            v_bbox = [v.x_min, v.y_min, v.x_max, v.y_max]
            img_name = v.image_name
            
            # Find challenger predictions for this image
            # Try full name or just filename
            c_preds = challenger_preds.get(img_name)
            if c_preds is None:
                c_preds = challenger_preds.get(img_name.split('/')[-1], [])

            # Check if Challenger outputs a box at this location
            has_match = False
            matched_pred = None
            
            for p in c_preds:
                p_bbox = p.get('bbox', [0,0,0,0])
                if calculate_iou(v_bbox, p_bbox) >= IOU_THRESHOLD:
                    # Also consider class match if you want strict comparisons
                    # if p.get('class') == v.class_name or str(p.get('class')) == str(v.class_name):
                    has_match = True
                    matched_pred = p
                    break

            # Core Delta Logic
            result_item = {
                "id": v.id,
                "image_name": img_name,
                "class_name": v.class_name,
                "bbox": v_bbox,
                "baseline_status": v.status,
                "challenger_match": matched_pred
            }

            if v.status == 'fail': # It was a False Positive
                if has_match:
                    delta_results["persistent_false_positives"].append(result_item)
                else:
                    delta_results["resolved_false_positives"].append(result_item)
            
            elif v.status == 'missing': # It was a Missed Defect (False Negative)
                if has_match:
                    delta_results["resolved_misses"].append(result_item)
                else:
                    delta_results["persistent_misses"].append(result_item)
            
            elif v.status == 'pass': # It was a True Positive
                if not has_match:
                    delta_results["regressions"].append(result_item)
                # If it has a match, it's just a maintained TP, no need to flag as a delta

        # Return Summary & Lists
        return {
            "baseline_name": baseline_exp.name,
            "challenger_name": challenger_exp.name,
            "counts": {
                "resolved_fps": len(delta_results["resolved_false_positives"]),
                "resolved_fns": len(delta_results["resolved_misses"]),
                "regressions": len(delta_results["regressions"]),
                "persistent_fps": len(delta_results["persistent_false_positives"]),
                "persistent_fns": len(delta_results["persistent_misses"])
            },
            "deltas": delta_results
        }

    except Exception as e:
        logger.error("engine.comparison", f"Failed to compute delta: {str(e)}")
        return {"error": str(e)}
