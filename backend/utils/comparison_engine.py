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

        result = {
            "mode": "split",
            "baseline": _format_split_stats(baseline_exp.name, baseline_exp_id, stats_a, baseline_exp),
            "challenger_b": _format_split_stats(challenger_b.name, challenger_b_id, stats_b, challenger_b),
        }

        if challenger_c_id:
            challenger_c = db.query(ModelExperiment).filter(ModelExperiment.id == challenger_c_id).first()
            if challenger_c:
                stats_c = calculate_experiment_quality(challenger_c, project_root)
                result["challenger_c"] = _format_split_stats(challenger_c.name, challenger_c_id, stats_c, challenger_c)


        return result

    except Exception as e:
        logger.error("engine.split_comparison", f"Failed to compute split comparison: {str(e)}")
        return {"error": str(e)}


def _format_split_stats(name: str, exp_id: str, stats: Dict, exp=None) -> Dict:
    """Normalise quality stats into a consistent shape for the frontend."""
    base = {
        "name": name,
        "id": exp_id,
        "dataset_source": getattr(exp, 'dataset_source', None) if exp else None,
        "dataset_path": getattr(exp, 'dataset_path', None) if exp else None,
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
