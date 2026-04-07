"""
Analytics Engine Utility
Aggregates image-level detection comparisons into global experiment metrics.
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any
from utils.ground_truth_loader import load_split_annotations, get_missed_detections, calculate_iou
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

def calculate_experiment_quality(experiment: Any, project_root: Path) -> Dict[str, Any]:
    """
    Compare all predictions in an experiment with ground truth to get real quality metrics.
    """
    try:
        # 1. Early exit if no ground truth possible
        if not experiment.dataset_path or experiment.dataset_source == 'upload':
            return {"has_ground_truth": False}

        # 2. Resolve dataset paths
        rel_path = experiment.dataset_path
        if "images" in rel_path:
            base_rel_path = rel_path.split("images")[0].rstrip("/\\")
        else:
            base_rel_path = rel_path
            
        abs_dataset_path = (project_root / base_rel_path).resolve()
        
        # 3. Load Annotations
        annotations = load_split_annotations(str(abs_dataset_path), experiment.dataset_source)
        if not annotations:
            logger.warning("analytics.engine", f"No annotations found for {experiment.id}", "no_annotations_found")
            return {"has_ground_truth": False, "error": "No annotations found"}

        # 4. Load Predictions
        if isinstance(experiment.predictions, str):
            predictions_dict = json.loads(experiment.predictions)
        else:
            predictions_dict = experiment.predictions or {}

        # 5. Load Label Mapping (Class ID -> Name)
        label_mapping = {}
        data_yaml_path = abs_dataset_path / "data.yaml"
        if data_yaml_path.exists():
            try:
                import yaml
                with open(data_yaml_path, 'r') as f:
                    data_yaml = yaml.safe_load(f)
                    names = data_yaml.get('names', {})
                    if isinstance(names, list):
                        label_mapping = {i: name for i, name in enumerate(names)}
                    elif isinstance(names, dict):
                        label_mapping = {int(k): v for k, v in names.items()}
            except Exception: pass

        # 6. Global Stats Initialization
        total_gt_objects = 0
        total_predictions = 0
        total_true_positives = 0
        total_false_positives = 0
        total_false_negatives = 0
        iou_sum = 0.0
        iou_count = 0
        
        # Detailed lists for frontend filtering
        detailed_false_positives = []
        detailed_missed_objects = []
        detailed_true_positives = []

        # Class-level breakdown (Future expansion)
        class_stats = {}
        
        # Aggregate IoU tracking
        iou_sum = 0.0
        iou_count = 0
        match_iou_threshold = float(getattr(experiment, "iou_threshold", None) or 0.45)

        # 7. Process Image by Image
        # Key in annotations is "images/val/image.jpg"
        # Key in predictions is "image.jpg"
        for img_key_full, img_anns in annotations.items():
            img_name = Path(img_key_full).name
            img_preds = predictions_dict.get(img_name, [])
            
            total_gt_objects += len(img_anns)
            total_predictions += len(img_preds)
            
            # Find dimensions from input_images if available
            img_metadata = {}
            if experiment.input_images:
                if isinstance(experiment.input_images, str):
                    try: image_metadata = json.loads(experiment.input_images)
                    except: image_metadata = {}
                else:
                    image_metadata = experiment.input_images
                img_metadata = image_metadata.get(img_name, {})
            
            # Safely get width/height
            if isinstance(img_metadata, str): img_metadata = {} 
            width = img_metadata.get('width', 640) if isinstance(img_metadata, dict) else 640
            height = img_metadata.get('height', 640) if isinstance(img_metadata, dict) else 640

            # Run comparison
            comp_result = get_missed_detections(
                annotations,
                img_key_full,
                img_preds,
                width,
                height,
                label_mapping,
                iou_threshold=match_iou_threshold
            )
            
            missed = comp_result.get("missed", [])
            fp_indices = comp_result.get("fp_indices", [])
            
            # LOCAL IoU MATCHING: Re-calculate best IoU for each prediction locally 
            # to avoid breaking shared ground_truth_loader.py
            local_matches = {}
            from utils.ground_truth_loader import calculate_iou, annotation_to_bbox
            gt_bboxes = [annotation_to_bbox(ann, width, height) for ann in annotations[img_key_full]]
            
            for p_idx, p_det in enumerate(img_preds):
                best_p_iou = 0.0
                for g_box in gt_bboxes:
                    cur_iou = calculate_iou(g_box, p_det['bbox'])
                    if cur_iou > best_p_iou: best_p_iou = cur_iou
                if best_p_iou >= match_iou_threshold:
                    local_matches[p_idx] = best_p_iou

            total_false_negatives += len(missed)
            total_false_positives += len(fp_indices)
            
            # FIXED: True Positives = GT objects that were matched (not predictions - FP)
            # This prevents TP > total_gt_objects which causes Recall > 100%
            img_tp_count = len(annotations[img_key_full]) - len(missed)
            total_true_positives += img_tp_count
            
            # --- Collect Detailed Errors for Frontend ---
            
            # 1. Collect Missed Objects (False Negatives)
            for m in missed:
                detailed_missed_objects.append({
                    "image": img_name,
                    "class_name": m.get('class_name', 'Unknown'),
                    "class_id": m.get('class_id', -1),
                    "bbox": m.get('bbox', [0,0,0,0])
                })
                
            # 2. Collect Positive Detections (TP and FP)
            for idx, pred in enumerate(img_preds):
                c_id = pred.get('class', -1)
                if isinstance(c_id, str):
                    c_name = c_id
                else:
                    c_name = label_mapping.get(c_id, pred.get('name', f'Class {c_id}'))
                
                det_obj = {
                    "image": img_name,
                    "class_name": c_name,
                    "class_id": c_id,
                    "confidence": pred.get('confidence', 0.0),
                    "bbox": pred.get('bbox', [0,0,0,0])
                }

                if idx in fp_indices:
                    detailed_false_positives.append(det_obj)
                else:
                    # It's a match!
                    match_iou = local_matches.get(idx, 0.0)
                    det_obj["matched_iou"] = match_iou
                    detailed_true_positives.append(det_obj)
                    
                    iou_sum += match_iou
                    iou_count += 1

        # 8. Final Calculation
        precision = total_true_positives / (total_predictions) if total_predictions > 0 else 0.0
        recall = total_true_positives / (total_gt_objects) if total_gt_objects > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall + 1e-6)
        avg_iou = iou_sum / iou_count if iou_count > 0 else 0.0

        return {
            "has_ground_truth": True,
            "precision": round(precision * 100, 1),
            "recall": round(recall * 100, 1),
            "f1": round(f1 * 100, 1),
            "false_positives": total_false_positives,
            "missed_objects": total_false_negatives,
            "detailed_false_positives": detailed_false_positives,
            "detailed_missed_objects": detailed_missed_objects,
            "detailed_true_positives": detailed_true_positives,
            "avg_iou": round(avg_iou, 2),
            "total_gt": total_gt_objects,
            "total_preds": total_predictions
        }

    except Exception as e:
        logger.error("analytics.engine", f"Failed to calculate quality stats: {str(e)}", "quality_calculation_error")
        return {"has_ground_truth": False, "error": str(e)}
