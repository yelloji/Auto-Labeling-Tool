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
    
    # Filter by split - image paths like "images\\val\\defect_001.png"
    split_prefix = f"images\\{split}\\"
    return {
        path: anns 
        for path, anns in all_annotations.items()
        if path.startswith(split_prefix)
    }


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
    iou_threshold: float = 0.3
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
    
    # Find missed detections
    missed = []
    for gt in ground_truth:
        has_match = False
        
        for pred in predictions:
            # Check if same class
            if pred.get('class') == gt['class_name']:
                # Calculate IoU
                iou = calculate_iou(gt['bbox'], pred['bbox'])
                if iou >= iou_threshold:
                    has_match = True
                    break
        
        if not has_match:
            missed.append(gt)
    
    return missed
