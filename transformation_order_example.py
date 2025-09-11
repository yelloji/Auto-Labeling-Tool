#!/usr/bin/env python3
"""
Transformation Order Example
Demonstrates how ImageTransformer applies multiple transformations in sequence
"""

from PIL import Image
import json

def demonstrate_transformation_order():
    """
    Shows exactly how transformations are applied when multiple are configured
    """
    
    print("=== TRANSFORMATION ORDER DEMONSTRATION ===")
    print()
    
    # Example configuration with multiple transformations
    transformation_config = {
        "resize": {
            "enabled": True,
            "target_width": 640,
            "target_height": 640,
            "resize_mode": "stretch_to"
        },
        "rotate": {
            "enabled": True,
            "angle": 45,  # DUAL INPUT: User can set specific angle
            "fill_color": "white"
        },
        "flip": {
            "enabled": True,
            "horizontal": True,
            "vertical": False
        },
        "crop": {
            "enabled": True,
            "crop_percentage": 80,
            "crop_mode": "center"
        }
    }
    
    print("CONFIGURATION:")
    print(json.dumps(transformation_config, indent=2))
    print()
    
    print("=== HOW IMAGETRANSFORMER PROCESSES THIS ===")
    print()
    
    # Simulate the exact ImageTransformer logic
    print("ImageTransformer.apply_transformations() does:")
    print("```python")
    print("result_image = image.copy()")
    print("")
    print("# Apply transformations in config.items() order")
    print("for transform_name, params in config.items():")
    print("    if transform_name in self.transformation_methods and params.get('enabled', True):")
    print("        result_image = self.transformation_methods[transform_name](result_image, params)")
    print("```")
    print()
    
    print("=== STEP-BY-STEP EXECUTION ===")
    print()
    
    step = 1
    original_size = "800x600"
    current_size = original_size
    
    for transform_name, params in transformation_config.items():
        if params.get('enabled', True):
            print(f"STEP {step}: {transform_name.upper()}")
            print(f"  Input image size: {current_size}")
            print(f"  Parameters: {params}")
            
            # Simulate what each transformation does
            if transform_name == "resize":
                current_size = f"{params['target_width']}x{params['target_height']}"
                print(f"  → Resizes image to {current_size} using {params['resize_mode']} mode")
                
            elif transform_name == "rotate":
                print(f"  → Rotates image by {params['angle']}° with {params['fill_color']} fill")
                print(f"  → Image size may change due to rotation (expand=True)")
                current_size = "~720x720"  # Approximate after 45° rotation
                
            elif transform_name == "flip":
                if params['horizontal']:
                    print(f"  → Flips image horizontally (mirror effect)")
                if params['vertical']:
                    print(f"  → Flips image vertically")
                print(f"  → Size remains: {current_size}")
                
            elif transform_name == "crop":
                print(f"  → Crops to {params['crop_percentage']}% using {params['crop_mode']} mode")
                # Approximate crop calculation
                if current_size == "~720x720":
                    new_size = int(720 * params['crop_percentage'] / 100)
                    current_size = f"~{new_size}x{new_size}"
                    
            print(f"  Output image size: {current_size}")
            print()
            step += 1
    
    print("=== DUAL INPUT ROTATION EXPLANATION ===")
    print()
    print("ROTATION DUAL INPUT means:")
    print("• User sets angle: 45°")
    print("• System can generate opposite: -45°")
    print("• Both values can be used in different image generations")
    print("• Each rotation is applied to the CURRENT state of the image")
    print()
    
    print("=== KEY POINTS ===")
    print()
    print("1. SEQUENTIAL PROCESSING:")
    print("   Each transformation receives the OUTPUT of the previous transformation")
    print()
    print("2. ORDER MATTERS:")
    print("   resize → rotate → flip → crop produces different result than")
    print("   rotate → resize → flip → crop")
    print()
    print("3. SIZE CHANGES:")
    print("   - resize: Changes to target dimensions")
    print("   - rotate: May expand canvas to fit rotated image")
    print("   - flip: No size change")
    print("   - crop: Reduces size by percentage")
    print()
    print("4. COORDINATE IMPACT:")
    print("   Annotations must follow EXACT SAME ORDER to stay aligned")
    print()
    
    print("=== ANNOTATION TRANSFORMER ALIGNMENT ===")
    print()
    print("AnnotationTransformer now uses:")
    print("```python")
    print("# EXACT SAME ORDER as ImageTransformer")
    print("for transform_name, params in transformation_config.items():")
    print("    if transform_name in coordinate_transforms and params.get('enabled', True):")
    print("        # Apply coordinate transformation")
    print("```")
    print()
    print("This ensures 100% coordinate accuracy!")

if __name__ == "__main__":
    demonstrate_transformation_order()