# Augmentation System Documentation

## Overview

This document explains how the image augmentation system works in the application, covering both the UI (frontend) and backend components. Understanding this system is crucial for working on the Release Section.

## System Architecture

The augmentation system consists of several components:

1. **Frontend UI**: Displays transformation options to users
2. **API Services**: Handles requests from the frontend
3. **Backend Processing**: Applies transformations to images
4. **Augmentation Utils**: Provides utility functions for augmentation
5. **Central Configuration**: Standardizes parameters across all components

## Key Files and Their Roles

### 1. Central Configuration System

**File**: `/workspace/project/sy-app-6/backend/core/transformation_config.py`

**Purpose**: Acts as the single source of truth for all transformation parameters across the entire application.

**Important for**: Ensuring consistency across all components.

**Example (Shear Transformation)**:
```python
# Shear transformation parameters
SHEAR_ANGLE_MIN = -15
SHEAR_ANGLE_MAX = 15

def get_shear_parameters():
    """Get shear transformation parameters"""
    return {
        'min': SHEAR_ANGLE_MIN,
        'max': SHEAR_ANGLE_MAX
    }
```

### 2. Frontend UI Definition

**File**: `/workspace/project/sy-app-6/backend/api/services/image_transformer.py`

**Purpose**: Defines the transformation parameters that are displayed in the UI.

**Important for**: Understanding what options users see in the interface.

**Example (Shear Transformation)**:
```python
from backend.core.transformation_config import get_shear_parameters

'shear_angle': {
    'type': 'float', 
    'min': get_shear_parameters()['min'],  # Uses central configuration
    'max': get_shear_parameters()['max'], 
    'default': 0,
    'unit': 'degrees',
    'step': 0.1,
    'description': 'Shear angle in degrees'
}
```

### 3. Backend Implementation

**File**: `/workspace/project/sy-app-6/backend/api/services/image_transformer.py`

**Purpose**: Contains the actual implementation of transformations that are applied to images.

**Important for**: Understanding what transformations are actually applied to images.

**Example (Shear Transformation)**:
```python
from backend.core.transformation_config import get_shear_parameters

def _apply_shear(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
    """Apply shear transformation"""
    shear_angle = params.get('shear_angle', params.get('angle', 0))
    
    # Clamp to valid range from central configuration
    shear_min = get_shear_parameters()['min']
    shear_max = get_shear_parameters()['max']
    shear_angle = max(shear_min, min(shear_max, shear_angle))
    
    if shear_angle == 0:
        return image

    # Convert angle to radians and calculate shear factor
    shear_factor = math.tan(math.radians(shear_angle))

    # Create shear transformation matrix
    shear_matrix = np.float32([[1, shear_factor, 0], [0, 1, 0]])

    # Apply shear transformation
    sheared = cv2.warpAffine(img_array, shear_matrix, (width, height))

    return Image.fromarray(sheared)
```

### 4. Augmentation API Routes

**File**: `/workspace/project/sy-app-6/backend/api/routes/augmentation.py`

**Purpose**: Defines API endpoints for augmentation and provides transformation definitions to the frontend.

**Important for**: Understanding how the frontend gets information about available transformations.

**Example (Shear Transformation)**:
```python
from backend.core.transformation_config import get_shear_parameters

"shear": {
    "name": "Shear",
    "description": "Apply shear transformation",
    "icon": "italic",
    "parameters": {
        "shear_min": {
            "type": "number", 
            "min": get_shear_parameters()['min'], 
            "max": get_shear_parameters()['max'], 
            "default": get_shear_parameters()['min'] / 3
        },
        "shear_max": {
            "type": "number", 
            "min": get_shear_parameters()['min'], 
            "max": get_shear_parameters()['max'], 
            "default": get_shear_parameters()['max'] / 3
        },
        "probability": {"type": "number", "min": 0, "max": 1, "default": 0.3, "step": 0.1}
    }
}
```

### 5. Augmentation Utils

**File**: `/workspace/project/sy-app-6/backend/utils/augmentation_utils.py`

**Purpose**: Provides utility functions for creating augmentation pipelines.

**Important for**: Understanding how multiple transformations are combined.

**Example (Shear Transformation)**:
```python
from backend.core.transformation_config import get_shear_parameters

"shear": {
    "enabled": True,
    "range": [get_shear_parameters()['min'], get_shear_parameters()['max']],  # Uses central configuration
    "probability": 0.3
}
```

## Transformations Covered by Central Configuration

The central configuration system standardizes parameters for all transformation types:

### Geometric Transformations
- **Rotation**: Controls image rotation angles
- **Shear**: Controls image shearing angles
- **Perspective**: Controls perspective distortion
- **Flip**: Controls horizontal and vertical flipping
- **Resize**: Controls image resizing parameters

### Color Transformations
- **Brightness**: Controls image brightness adjustment
- **Contrast**: Controls image contrast adjustment
- **Saturation**: Controls color saturation
- **Hue**: Controls color hue shifting
- **Gamma**: Controls gamma correction

### Noise & Blur Transformations
- **Gaussian Blur**: Controls blur kernel size
- **Motion Blur**: Controls motion blur parameters
- **Median Blur**: Controls median blur parameters
- **Noise**: Controls noise intensity

## Benefits of the Standardized System

1. **Consistency**: All components use exactly the same parameter definitions
2. **Maintainability**: Parameters only need to be updated in one place
3. **Clarity**: Clear documentation of all available parameters
4. **Extensibility**: Easy to add new parameters or transformations
5. **Error Prevention**: Eliminates parameter mismatches between components

## How Transformations Flow Through the System

1. **User Interaction**:
   - User selects a transformation in the UI (e.g., shear with angle 10°)
   - Frontend sends this value to the backend

2. **API Processing**:
   - Backend receives the request through an API endpoint
   - The transformation is passed to the image transformer

3. **Image Transformation**:
   - The image transformer applies the transformation
   - Parameters are validated against the central configuration
   - All components use the same parameter ranges

4. **Result**:
   - Transformed image is returned to the frontend
   - User sees the result, which matches expectations because all components use the same parameter ranges

## Smart & Minimal Transformation Strategy

The system implements the Smart & Minimal Transformation Strategy:

1. **Original Image**: Preserved as-is
2. **Positive Value Transformations**: Apply each transformation with its positive value
3. **Negative Value Transformations**: Apply each transformation with its negative value
4. **Optional Combinations**: Only if more images per original are requested

This approach ensures:
- Perfect coverage of transformation effects
- Clean, interpretable results
- Efficient use of augmentation (no wasted combinations)
- Predictable output

## Conclusion

The standardized transformation parameter system provides a robust foundation for consistent image augmentation across the application. By centralizing parameter definitions, the system eliminates inconsistencies, improves maintainability, and ensures all components work together seamlessly. The comprehensive coverage of all transformation types ensures that the entire augmentation pipeline benefits from this standardization.