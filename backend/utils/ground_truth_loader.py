"""
Ground Truth Loader Utility
Loads annotations.json and compares with predictions to find missed detections.
"""
import json
import os
from typing import Dict, List, Tuple


def load_split_annotations(dataset_path: str, split: str) -> Dict:
    """
    Load annotations filtered by dataset split.
    
    Args:
        dataset_path: Path to dataset folder
        split: 'train', 'val', or 'test'
    
    Returns:
        Dict of {image_path: [annotations]}
    """
    json_path = os.path.join(dataset_path, 'metadata', 'annotations.json')
    
    if not os.path.exists(json_path):
        return {}
    
    with open(json_path, 'r') as f:
        all_annotations = json.load(f)
    
    # Filter by split and normalize paths to use /
    split_prefix = f"images/{split}/"
    normalized_annotations = {}
    
    for path, anns in all_annotations.items():
        standard_path = path.replace('\\', '/')
        if standard_path.startswith(split_prefix):
            normalized_annotations[standard_path] = anns
            
    return normalized_annotations


def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """
    Calculate Intersection over Union for two bounding boxes.
    
    Args:
        box1, box2: [x1, y1, x2, y2] format
    
    Returns:
        IoU value between 0 and 1
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    # No intersection
    if x2 < x1 or y2 < y1:
        return 0.0
    
    intersection = (x2 - x1) * (y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0


def annotation_to_bbox(annotation: Dict, img_width: int, img_height: int) -> List[float]:
    """
    Convert annotation to bounding box [x1, y1, x2, y2].
    Handles both 'bbox' (YOLO format) and 'polygon' (segmentation) formats.
    
    Args:
        annotation: Dict with either 'bbox' or 'polygon' key
        img_width, img_height: Image dimensions
    
    Returns:
        [x1, y1, x2, y2] in pixel coordinates
    """
    if "bbox" in annotation:
        # YOLO format: [x_center, y_center, width, height] normalized
        x_c, y_c, w, h = annotation["bbox"]
        x1 = (x_c - w/2) * img_width
        y1 = (y_c - h/2) * img_height
        x2 = (x_c + w/2) * img_width
        y2 = (y_c + h/2) * img_height
        return [x1, y1, x2, y2]
    
    elif "polygon" in annotation:
        # Polygon: [x1,y1,x2,y2,...] normalized  
        polygon = annotation["polygon"]
        xs = [polygon[i] * img_width for i in range(0, len(polygon), 2)]
        ys = [polygon[i] * img_height for i in range(1, len(polygon), 2)]
        return [min(xs), min(ys), max(xs), max(ys)]
    
    return [0, 0, 0, 0]


def get_missed_detections(
    annotations_dict: Dict,
    image_key: str,
    predictions: List[Dict],
    img_width: int,
    img_height: int,
    label_mapping: Dict[int, str],
    iou_threshold: float = 0.5
) -> List[Dict]:
    """
    Find ground truth objects with no matching prediction.
    
    Args:
        annotations_dict: Split-filtered annotations
        image_key: Image path key in annotations
        predictions: List of model predictions for this image
        img_width, img_height: Image dimensions
        label_mapping: {class_id: class_name}
        iou_threshold: Minimum IoU to consider a match
    
    Returns:
        List of missed detections with bbox and class info
    """
    if image_key not in annotations_dict:
        return []
    
    # Convert ground truth to bboxes
    ground_truth = []
    for ann in annotations_dict[image_key]:
        bbox = annotation_to_bbox(ann, img_width, img_height)
        ground_truth.append({
            'class_name': label_mapping.get(ann['class_id'], f"Class{ann['class_id']}"),
            'bbox': bbox,
            'class_id': ann['class_id']
        })
    
    # GREEDY BEST MATCHING ALGORITHM
    # Each GT can only be matched by ONE prediction (best IoU)
    # Each prediction can only match ONE GT
    # This prevents multiple predictions from inflating TP count
    
    # Step 1: Build IoU matrix (all GT vs all predictions)
    iou_matrix = []
    for gt_idx, gt in enumerate(ground_truth):
        for pred_idx, pred in enumerate(predictions):
            iou = calculate_iou(gt['bbox'], pred['bbox'])
            if iou >= iou_threshold:
                iou_matrix.append((iou, gt_idx, pred_idx))
    
    # Step 2: Sort by IoU (highest first) for greedy matching
    iou_matrix.sort(key=lambda x: x[0], reverse=True)
    
    # Step 3: Greedy assignment - each GT and prediction can only be matched once
    matched_gt_indices = set()
    matched_prediction_indices = set()
    matched_ious = []
    
    for iou, gt_idx, pred_idx in iou_matrix:
        if gt_idx not in matched_gt_indices and pred_idx not in matched_prediction_indices:
            # This is the best available match for this GT
            matched_gt_indices.add(gt_idx)
            matched_prediction_indices.add(pred_idx)
            matched_ious.append(iou)
    
    # Step 4: Find missed GT objects (not matched by any prediction)
    missed = [ground_truth[i] for i in range(len(ground_truth)) if i not in matched_gt_indices]
    
    # Step 5: Find FP predictions (not matched to any GT)
    fp_indices = [i for i in range(len(predictions)) if i not in matched_prediction_indices]

    return {
        "missed": missed,
        "fp_indices": fp_indices,
        "matched_ious": matched_ious
    }
