# Affine Builder Module

## Overview
The `affine_builder.py` module provides a unified approach to geometric transformations by converting a sequence of operations into a single 3×3 affine transformation matrix. This ensures consistent transformation ordering and precise coordinate mapping between images and annotations.

## Purpose
- **Unified Transformation**: Combines multiple geometric operations into a single affine matrix
- **Consistent Ordering**: Ensures transformations are applied in the exact same order across the application
- **Coordinate Precision**: Maintains accurate coordinate mapping for annotations during transformations
- **Deterministic Behavior**: Provides predictable results for the same input parameters

## Key Functions

### Helper Functions
- `_T(tx, ty)`: Creates a translation matrix
- `_S(sx, sy)`: Creates a scaling matrix
- `_R(deg)`: Creates a rotation matrix

### Main Function
```python
build_affine_from_ops(orig_w: int, orig_h: int, ops: List[Dict]) -> Tuple[np.ndarray, Tuple[int, int]]
```

**Parameters:**
- `orig_w`: Original image width
- `orig_h`: Original image height
- `ops`: List of transformation operations

**Returns:**
- A tuple containing:
  - 3×3 affine transformation matrix
  - New dimensions (width, height) after all transformations

## Supported Transformations
- **resize**: With multiple modes (stretch_to, fit_within, fill_center_crop, fit_reflect_edges, etc.)
- **crop**: With various positioning modes (center, random, top_left, etc.)
- **rotate**: Rotation by specified angle
- **flip**: Horizontal and/or vertical flipping
- **random_zoom**: Zooming by a specified factor
- **affine_transform**: Combined scale, rotation, and translation
- **shear**: Shearing by specified angle

## Usage Example

```python
from backend.api.services.affine_builder import build_affine_from_ops
import cv2
import numpy as np

# Define transformation operations
ops = [
    {"name": "resize", "width": 800, "height": 600, "resize_mode": "fit_within"},
    {"name": "rotate", "angle": 45},
    {"name": "crop", "percent": 80, "mode": "center"}
]

# Build affine matrix and get new dimensions
affine_matrix, new_dims = build_affine_from_ops(1024, 768, ops)

# Apply to image using OpenCV
image = cv2.warpAffine(
    image,
    affine_matrix[:2, :],  # OpenCV uses 2×3 matrix
    (new_dims[0], new_dims[1])
)

# Apply to coordinates
def transform_point(x, y, matrix):
    p = np.array([x, y, 1.0])
    new_p = matrix @ p
    return new_p[0] / new_p[2], new_p[1] / new_p[2]
```

## Integration with Existing Systems

This module is designed to work with:

1. **ImageTransformer**: For applying transformations to images
2. **AnnotationTransformer**: For updating annotation coordinates
3. **transform_resolver**: For determining the correct operation order

## Benefits

- **Performance**: Single matrix multiplication is more efficient than sequential operations
- **Accuracy**: Prevents cumulative rounding errors from multiple transformations
- **Maintainability**: Centralizes transformation logic in one place
- **Extensibility**: Easy to add new transformation types