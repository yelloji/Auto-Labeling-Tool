"""
RESIZE MODEL MATHEMATICAL CALCULATION DEMONSTRATION
====================================================
This script demonstrates the 6 resize models with step-by-step calculations
using the exact values from your debug logs.
"""

import math

def demonstrate_resize_models():
    """Demonstrate all 6 resize models with step-by-step calculations"""
    
    # From your debug logs: Original image 800x600, Target 640x640
    original_width, original_height = 800, 600
    target_width, target_height = 640, 640
    
    print("🎯 RESIZE MODEL MATHEMATICAL CALCULATIONS")
    print("=" * 60)
    print(f"Original dimensions: {original_width}x{original_height}")
    print(f"Target dimensions: {target_width}x{target_height}")
    print()
    
    # Test annotation coordinates from your debug logs
    test_bbox = [100, 100, 200, 200]  # x_min, y_min, x_max, y_max
    print(f"Test annotation bbox: {test_bbox}")
    print(f"  Center: ({(test_bbox[0] + test_bbox[2])/2:.1f}, {(test_bbox[1] + test_bbox[3])/2:.1f})")
    print(f"  Size: {test_bbox[2]-test_bbox[0]}x{test_bbox[3]-test_bbox[1]}")
    print()
    
    # 1. STRETCH_TO (Default mode)
    print("1. 🟢 STRETCH_TO (Default Mode)")
    print("-" * 40)
    scale_x = target_width / original_width
    scale_y = target_height / original_height
    print(f"Scale X: {target_width}/{original_width} = {scale_x:.6f}")
    print(f"Scale Y: {target_height}/{original_height} = {scale_y:.6f}")
    
    # Transform coordinates
    x_min_stretch = test_bbox[0] * scale_x
    y_min_stretch = test_bbox[1] * scale_y
    x_max_stretch = test_bbox[2] * scale_x
    y_max_stretch = test_bbox[3] * scale_y
    
    print(f"Transformed bbox: [{x_min_stretch:.2f}, {y_min_stretch:.2f}, {x_max_stretch:.2f}, {y_max_stretch:.2f}]")
    print(f"  Center: ({(x_min_stretch + x_max_stretch)/2:.1f}, {(y_min_stretch + y_max_stretch)/2:.1f})")
    print(f"  Size: {x_max_stretch-x_min_stretch:.1f}x{y_max_stretch-y_min_stretch:.1f}")
    print()
    
    # 2. FIT_WITHIN (Maintain aspect ratio, fit inside target)
    print("2. 🔵 FIT_WITHIN (Maintain Aspect Ratio)")
    print("-" * 40)
    scale_factor = min(target_width / original_width, target_height / original_height)
    print(f"Scale factor: min({target_width}/{original_width}, {target_height}/{original_height}) = {scale_factor:.6f}")
    
    new_width = original_width * scale_factor
    new_height = original_height * scale_factor
    print(f"New dimensions: {original_width}*{scale_factor:.6f} = {new_width:.1f}x{original_height}*{scale_factor:.6f} = {new_height:.1f}")
    
    # Transform coordinates
    x_min_fit = test_bbox[0] * scale_factor
    y_min_fit = test_bbox[1] * scale_factor
    x_max_fit = test_bbox[2] * scale_factor
    y_max_fit = test_bbox[3] * scale_factor
    
    print(f"Transformed bbox: [{x_min_fit:.2f}, {y_min_fit:.2f}, {x_max_fit:.2f}, {y_max_fit:.2f}]")
    print(f"  Center: ({(x_min_fit + x_max_fit)/2:.1f}, {(y_min_fit + y_max_fit)/2:.1f})")
    print(f"  Size: {x_max_fit-x_min_fit:.1f}x{y_max_fit-y_min_fit:.1f}")
    print()
    
    # 3. FIT_BLACK_EDGES (Letterbox with black borders)
    print("3. ⚫ FIT_BLACK_EDGES (Letterbox)")
    print("-" * 40)
    scale_factor = min(target_width / original_width, target_height / original_height)
    print(f"Scale factor: {scale_factor:.6f} (same as FIT_WITHIN)")
    
    new_width = original_width * scale_factor
    new_height = original_height * scale_factor
    print(f"Scaled dimensions: {new_width:.1f}x{new_height:.1f}")
    
    # Calculate padding
    pad_x = (target_width - new_width) / 2
    pad_y = (target_height - new_height) / 2
    print(f"Padding X: ({target_width} - {new_width:.1f})/2 = {pad_x:.1f}")
    print(f"Padding Y: ({target_height} - {new_height:.1f})/2 = {pad_y:.1f}")
    
    # Transform coordinates (add padding)
    x_min_letter = test_bbox[0] * scale_factor + pad_x
    y_min_letter = test_bbox[1] * scale_factor + pad_y
    x_max_letter = test_bbox[2] * scale_factor + pad_x
    y_max_letter = test_bbox[3] * scale_factor + pad_y
    
    print(f"Transformed bbox: [{x_min_letter:.2f}, {y_min_letter:.2f}, {x_max_letter:.2f}, {y_max_letter:.2f}]")
    print(f"  Center: ({(x_min_letter + x_max_letter)/2:.1f}, {(y_min_letter + y_max_letter)/2:.1f})")
    print(f"  Size: {x_max_letter-x_min_letter:.1f}x{y_max_letter-y_min_letter:.1f}")
    print()
    
    # 4. FIT_WHITE_EDGES (Letterbox with white borders)
    print("4. ⚪ FIT_WHITE_EDGES (White Letterbox)")
    print("-" * 40)
    print("Same calculation as FIT_BLACK_EDGES, just different border color")
    print(f"Transformed bbox: [{x_min_letter:.2f}, {y_min_letter:.2f}, {x_max_letter:.2f}, {y_max_letter:.2f}]")
    print()
    
    # 5. FIT_REFLECT_EDGES (Letterbox with reflected edges)
    print("5. 🔄 FIT_REFLECT_EDGES (Reflected Edges)")
    print("-" * 40)
    print("Same calculation as FIT_BLACK_EDGES, just different border treatment")
    print(f"Transformed bbox: [{x_min_letter:.2f}, {y_min_letter:.2f}, {x_max_letter:.2f}, {y_max_letter:.2f}]")
    print()
    
    # 6. FILL_CENTER_CROP (Scale to fill, then crop center)
    print("6. ✂️  FILL_CENTER_CROP (Scale to Fill + Center Crop)")
    print("-" * 40)
    scale_factor = max(target_width / original_width, target_height / original_height)
    print(f"Scale factor: max({target_width}/{original_width}, {target_height}/{original_height}) = {scale_factor:.6f}")
    
    scaled_width = original_width * scale_factor
    scaled_height = original_height * scale_factor
    print(f"Scaled dimensions: {original_width}*{scale_factor:.6f} = {scaled_width:.1f}x{original_height}*{scale_factor:.6f} = {scaled_height:.1f}")
    
    # Calculate crop offsets
    crop_x = (scaled_width - target_width) / 2
    crop_y = (scaled_height - target_height) / 2
    print(f"Crop X offset: ({scaled_width:.1f} - {target_width})/2 = {crop_x:.1f}")
    print(f"Crop Y offset: ({scaled_height:.1f} - {target_height})/2 = {crop_y:.1f}")
    
    # Transform coordinates (scale then subtract crop offset)
    x_min_crop = test_bbox[0] * scale_factor - crop_x
    y_min_crop = test_bbox[1] * scale_factor - crop_y
    x_max_crop = test_bbox[2] * scale_factor - crop_x
    y_max_crop = test_bbox[3] * scale_factor - crop_y
    
    print(f"Transformed bbox: [{x_min_crop:.2f}, {y_min_crop:.2f}, {x_max_crop:.2f}, {y_max_crop:.2f}]")
    print(f"  Center: ({(x_min_crop + x_max_crop)/2:.1f}, {(y_min_crop + y_max_crop)/2:.1f})")
    print(f"  Size: {x_max_crop-x_min_crop:.1f}x{y_max_crop-y_min_crop:.1f}")
    print()
    
    # YOLO Normalization (for all modes)
    print("🎯 YOLO NORMALIZATION CALCULATION")
    print("-" * 40)
    print("For STRETCH_TO mode (640x640 canvas):")
    
    # Use stretched coordinates
    center_x = (x_min_stretch + x_max_stretch) / 2
    center_y = (y_min_stretch + y_max_stretch) / 2
    width = x_max_stretch - x_min_stretch
    height = y_max_stretch - y_min_stretch
    
    print(f"Center: ({center_x:.2f}, {center_y:.2f})")
    print(f"Size: {width:.2f}x{height:.2f}")
    
    # Normalize to 0-1 range
    center_x_norm = center_x / target_width
    center_y_norm = center_y / target_height
    width_norm = width / target_width
    height_norm = height / target_height
    
    print(f"Normalized center: {center_x_norm:.6f}, {center_y_norm:.6f}")
    print(f"Normalized size: {width_norm:.6f}, {height_norm:.6f}")
    print(f"YOLO format: 0 {center_x_norm:.6f} {center_y_norm:.6f} {width_norm:.6f} {height_norm:.6f}")
    print()
    
    # Summary table
    print("📊 RESIZE MODES SUMMARY")
    print("=" * 60)
    print("Mode               | Scale X   | Scale Y   | Final Canvas  | BBox Coordinates")
    print("-" * 80)
    print(f"STRETCH_TO        | {scale_x:.6f} | {scale_y:.6f} | 640x640       | [{x_min_stretch:.1f}, {y_min_stretch:.1f}, {x_max_stretch:.1f}, {y_max_stretch:.1f}]")
    print(f"FIT_WITHIN        | {scale_factor:.6f} | {scale_factor:.6f} | {new_width:.0f}x{new_height:.0f}     | [{x_min_fit:.1f}, {y_min_fit:.1f}, {x_max_fit:.1f}, {y_max_fit:.1f}]")
    print(f"FIT_BLACK_EDGES   | {scale_factor:.6f} | {scale_factor:.6f} | 640x640       | [{x_min_letter:.1f}, {y_min_letter:.1f}, {x_max_letter:.1f}, {y_max_letter:.1f}]")
    print(f"FILL_CENTER_CROP  | {scale_factor:.6f} | {scale_factor:.6f} | 640x640       | [{x_min_crop:.1f}, {y_min_crop:.1f}, {x_max_crop:.1f}, {y_max_crop:.1f}]")

if __name__ == "__main__":
    demonstrate_resize_models()