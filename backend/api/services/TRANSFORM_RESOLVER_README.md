# Transform Resolver Module

## Overview
The `transform_resolver.py` module provides a standardized way to extract and order geometric transformations from configuration dictionaries. It ensures consistent transformation order between image processing and annotation coordinate transformations.

## Purpose
This module addresses a critical need in the application:

1. **Consistent Ordering**: Ensures that transformations are always applied in the same order regardless of where they're processed (image transformer or annotation transformer)

2. **Geometric vs. Photometric Separation**: Only includes geometric transformations that affect coordinates, ignoring purely photometric operations like brightness/contrast

3. **Standardized Configuration**: Converts various input formats into a consistent operation "tape" that can be executed sequentially

## Usage

```python
from backend.services.transform_resolver import resolve_to_op_tape

# Example configuration dictionary
config = {
    "resize": {"enabled": True, "width": 800, "height": 600, "resize_mode": "fit_within"},
    "crop": {"enabled": True, "percent": 0.8, "mode": "center"},
    "rotate": {"enabled": True, "angle": 45.0},
    "brightness": {"enabled": True, "factor": 1.2}  # This will be ignored as it's photometric
}

# Get the ordered list of geometric operations
original_size = (1024, 768)  # Width, height
ops = resolve_to_op_tape(config, orig_size=original_size)

# Result will be a list of standardized operation dictionaries in the correct order
# Note that brightness is excluded as it's not a geometric transformation
```

## Transformation Order
The module enforces the following order for geometric transformations:

1. Resize
2. Crop
3. Rotate
4. Flip
5. Random Zoom
6. Affine Transform
7. Shear

This order is critical for ensuring that annotations remain properly aligned with transformed images.

## Implementation Notes

- All numeric values are converted to their appropriate types (int/float/bool)
- Default values are provided for optional parameters
- The module handles missing or disabled transformations gracefully
- Special handling for deterministic random operations (seed parameter)

## Integration

This module should be used by both the image transformation pipeline and the annotation transformation pipeline to ensure perfect alignment between transformed images and their annotations.