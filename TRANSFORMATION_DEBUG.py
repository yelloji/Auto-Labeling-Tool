"""
TRANSFORMATION DEBUG LOGGER
============================
This file logs every step of the annotation transformation process
to help identify where coordinates are going wrong.
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Any, Union, Tuple

class TransformationDebugger:
    def __init__(self, debug_file_path="TRANSFORMATION_DEBUG.log"):
        self.debug_file = debug_file_path
        self.current_image = None
        self.step_counter = 0
        
        # Clear the debug file at start
        with open(self.debug_file, 'w') as f:
            f.write(f"TRANSFORMATION DEBUG LOG - {datetime.now()}\n")
            f.write("=" * 80 + "\n\n")
    
    def start_image_debug(self, image_name: str, original_dims: Tuple[int, int], target_dims: Tuple[int, int]):
        """Start debugging for a new image"""
        self.current_image = image_name
        self.step_counter = 0
        
        with open(self.debug_file, 'a') as f:
            f.write(f"\n🖼️  IMAGE: {image_name}\n")
            f.write(f"📐 ORIGINAL DIMS: {original_dims[0]}x{original_dims[1]}\n")
            f.write(f"🎯 TARGET DIMS: {target_dims[0]}x{target_dims[1]}\n")
            f.write("-" * 60 + "\n")
    
    def log_original_annotations(self, annotations: List[Any]):
        """Log the original annotations before any transformation"""
        self.step_counter += 1
        
        with open(self.debug_file, 'a') as f:
            f.write(f"\n📋 STEP {self.step_counter}: ORIGINAL ANNOTATIONS ({len(annotations)} total)\n")
            
            for i, ann in enumerate(annotations):
                if hasattr(ann, 'x_min'):  # BoundingBox
                    f.write(f"   Ann {i+1}: BBox({ann.x_min:.2f}, {ann.y_min:.2f}, {ann.x_max:.2f}, {ann.y_max:.2f}) ")
                    f.write(f"class_id={ann.class_id} class_name='{ann.class_name}'\n")
                    
                    # Calculate center and size for reference
                    center_x = (ann.x_min + ann.x_max) / 2
                    center_y = (ann.y_min + ann.y_max) / 2
                    width = ann.x_max - ann.x_min
                    height = ann.y_max - ann.y_min
                    f.write(f"          Center: ({center_x:.2f}, {center_y:.2f}) Size: {width:.2f}x{height:.2f}\n")
                    
                elif hasattr(ann, 'points'):  # Polygon
                    f.write(f"   Ann {i+1}: Polygon({len(ann.points)} points) class_id={ann.class_id}\n")
                    f.write(f"          Points: {ann.points[:3]}{'...' if len(ann.points) > 3 else ''}\n")
                else:
                    f.write(f"   Ann {i+1}: {type(ann).__name__} class_id={getattr(ann, 'class_id', '?')}\n")
    
    def log_transformation_config(self, transform_config: Dict[str, Any]):
        """Log the transformation configuration"""
        self.step_counter += 1
        
        with open(self.debug_file, 'a') as f:
            f.write(f"\n⚙️  STEP {self.step_counter}: TRANSFORMATION CONFIG\n")
            f.write(json.dumps(transform_config, indent=4) + "\n")
    
    def log_canvas_calculation(self, original_dims: Tuple[int, int], target_dims: Tuple[int, int], 
                             final_canvas: Tuple[int, int], resize_mode: str, scale_factor: float = None):
        """Log canvas size calculations"""
        self.step_counter += 1
        
        with open(self.debug_file, 'a') as f:
            f.write(f"\n📐 STEP {self.step_counter}: CANVAS CALCULATION\n")
            f.write(f"   Original: {original_dims[0]}x{original_dims[1]}\n")
            f.write(f"   Target: {target_dims[0]}x{target_dims[1]}\n")
            f.write(f"   Resize Mode: {resize_mode}\n")
            if scale_factor:
                f.write(f"   Scale Factor: {scale_factor:.4f}\n")
            f.write(f"   Final Canvas: {final_canvas[0]}x{final_canvas[1]}\n")
    
    def log_transformed_annotations(self, annotations: List[Any], lost_count: int = 0):
        """Log annotations after transformation"""
        self.step_counter += 1
        
        with open(self.debug_file, 'a') as f:
            f.write(f"\n🔧 STEP {self.step_counter}: TRANSFORMED ANNOTATIONS ({len(annotations)} remaining")
            if lost_count > 0:
                f.write(f", {lost_count} LOST")
            f.write(")\n")
            
            for i, ann in enumerate(annotations):
                if hasattr(ann, 'x_min'):  # BoundingBox
                    f.write(f"   Ann {i+1}: BBox({ann.x_min:.2f}, {ann.y_min:.2f}, {ann.x_max:.2f}, {ann.y_max:.2f}) ")
                    f.write(f"class_id={ann.class_id}\n")
                    
                    # Calculate center and size for reference
                    center_x = (ann.x_min + ann.x_max) / 2
                    center_y = (ann.y_min + ann.y_max) / 2
                    width = ann.x_max - ann.x_min
                    height = ann.y_max - ann.y_min
                    f.write(f"          Center: ({center_x:.2f}, {center_y:.2f}) Size: {width:.2f}x{height:.2f}\n")
                    
                elif hasattr(ann, 'points'):  # Polygon
                    f.write(f"   Ann {i+1}: Polygon({len(ann.points)} points) class_id={ann.class_id}\n")
                else:
                    f.write(f"   Ann {i+1}: {type(ann).__name__} class_id={getattr(ann, 'class_id', '?')}\n")
    
    def log_yolo_conversion(self, annotations: List[Any], yolo_lines: List[str], canvas_dims: Tuple[int, int]):
        """Log YOLO conversion process"""
        self.step_counter += 1
        
        with open(self.debug_file, 'a') as f:
            f.write(f"\n🎯 STEP {self.step_counter}: YOLO CONVERSION\n")
            f.write(f"   Canvas for normalization: {canvas_dims[0]}x{canvas_dims[1]}\n")
            f.write(f"   Input annotations: {len(annotations)}\n")
            f.write(f"   Output YOLO lines: {len(yolo_lines)}\n")
            
            for i, (ann, yolo_line) in enumerate(zip(annotations, yolo_lines)):
                if hasattr(ann, 'x_min'):  # BoundingBox
                    # Parse YOLO line
                    parts = yolo_line.strip().split()
                    if len(parts) >= 5:
                        class_id, center_x_norm, center_y_norm, width_norm, height_norm = parts[:5]
                        
                        # Convert back to pixel coordinates for verification
                        center_x_px = float(center_x_norm) * canvas_dims[0]
                        center_y_px = float(center_y_norm) * canvas_dims[1]
                        width_px = float(width_norm) * canvas_dims[0]
                        height_px = float(height_norm) * canvas_dims[1]
                        
                        f.write(f"   Ann {i+1}:\n")
                        f.write(f"      Original BBox: ({ann.x_min:.2f}, {ann.y_min:.2f}, {ann.x_max:.2f}, {ann.y_max:.2f})\n")
                        f.write(f"      YOLO Line: {yolo_line.strip()}\n")
                        f.write(f"      YOLO Back to Pixels: center=({center_x_px:.2f}, {center_y_px:.2f}) size=({width_px:.2f}x{height_px:.2f})\n")
                        
                        # Check if conversion is correct
                        orig_center_x = (ann.x_min + ann.x_max) / 2
                        orig_center_y = (ann.y_min + ann.y_max) / 2
                        orig_width = ann.x_max - ann.x_min
                        orig_height = ann.y_max - ann.y_min
                        
                        center_diff_x = abs(orig_center_x - center_x_px)
                        center_diff_y = abs(orig_center_y - center_y_px)
                        size_diff_w = abs(orig_width - width_px)
                        size_diff_h = abs(orig_height - height_px)
                        
                        if center_diff_x > 1 or center_diff_y > 1 or size_diff_w > 1 or size_diff_h > 1:
                            f.write(f"      ⚠️  MISMATCH DETECTED! Differences: center=({center_diff_x:.2f}, {center_diff_y:.2f}) size=({size_diff_w:.2f}, {size_diff_h:.2f})\n")
                        else:
                            f.write(f"      ✅ Conversion looks correct\n")
    
    def log_final_result(self, original_count: int, final_count: int, yolo_lines_count: int):
        """Log the final result summary"""
        with open(self.debug_file, 'a') as f:
            f.write(f"\n📊 FINAL RESULT FOR {self.current_image}:\n")
            f.write(f"   Original annotations: {original_count}\n")
            f.write(f"   After transformation: {final_count}\n")
            f.write(f"   YOLO lines generated: {yolo_lines_count}\n")
            
            if original_count != final_count:
                f.write(f"   ❌ LOST {original_count - final_count} annotations during transformation\n")
            if final_count != yolo_lines_count:
                f.write(f"   ❌ LOST {final_count - yolo_lines_count} annotations during YOLO conversion\n")
            if original_count == final_count == yolo_lines_count:
                f.write(f"   ✅ All annotations preserved\n")
            
            f.write("=" * 80 + "\n")

# Global debugger instance
debug_logger = TransformationDebugger()