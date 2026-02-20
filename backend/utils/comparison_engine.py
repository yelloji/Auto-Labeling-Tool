"""
Global Comparison Engine Utility
Calculates the object-level delta between a Baseline model and a Challenger model.
"""
import json
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from database.models import HumanVerification, ModelExperiment
from utils.ground_truth_loader import calculate_iou
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

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
