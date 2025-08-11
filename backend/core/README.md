# Comprehensive Central Transformation Configuration System

This directory contains the central configuration system for **ALL** transformation parameters in the application.

## Overview

The `transformation_config.py` file serves as the **single source of truth** for all transformation parameters across the entire system. All components of the application import and use these parameters to ensure perfect consistency.

## Transformations Covered

The central configuration system covers ALL transformation parameters:

1. **Geometric Transformations**
   - Rotation
   - Shear
   - Perspective
   - Flip
   - Crop
   - Resize

2. **Color Transformations**
   - Brightness
   - Contrast
   - Saturation
   - Hue
   - Gamma

3. **Noise & Blur Transformations**
   - Gaussian Blur
   - Motion Blur
   - Median Blur
   - Noise

## How It Works

1. **Central Definition**: All transformation parameters (min, max, default values, etc.) are defined in `transformation_config.py`.

2. **Component Integration**: All components that need transformation parameters import them from this central file:
   - UI/Frontend (`api/services/image_transformer.py`)
   - Augmentation API (`api/routes/augmentation.py`)
   - Backend Processing (`utils/augmentation_utils.py`)
   - Presets and Templates

3. **Consistency**: When a parameter needs to be changed, it only needs to be updated in one place, and all components will automatically use the new value.

## Example: Changing a Parameter

If you need to change the range of any transformation:

1. Open `core/transformation_config.py`
2. Update the values:
   ```python
   # Rotation transformation parameters
   ROTATION_ANGLE_MIN = -90  # Changed from -180
   ROTATION_ANGLE_MAX = 90   # Changed from 180
   ```

3. All components will automatically use the new values without any additional changes.

## Benefits

- **Perfect Consistency**: All components use exactly the same parameter definitions
- **Single Source of Truth**: Parameters only need to be updated in one place
- **Clarity**: Clear documentation of all available parameters
- **Extensibility**: Easy to add new parameters or transformations
- **Maintainability**: Changes propagate automatically throughout the system

## Future Improvements

- Add more helper functions for complex parameter combinations
- Implement parameter validation
- Add support for dynamic parameter updates
- Create a UI for managing transformation parameters
- Add versioning for parameter sets