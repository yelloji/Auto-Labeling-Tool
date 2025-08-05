"""
Central Transformation Configuration
Single source of truth for all transformation parameters in the application

All components should import parameters from this file to ensure consistency.
"""

# =====================================================================
# TRANSFORMATION PARAMETERS - SINGLE SOURCE OF TRUTH
# =====================================================================

# Shear transformation parameters (ENHANCED: Added unit display)
SHEAR_ANGLE_MIN = -30
SHEAR_ANGLE_MAX = 30
SHEAR_ANGLE_DEFAULT = 0
SHEAR_ANGLE_STEP = 0.1
SHEAR_UNIT = "degrees"
SHEAR_DESCRIPTION = "Shear angle in degrees"

# Rotation parameters (ENHANCED: Added unit display)
ROTATION_ANGLE_MIN = -180
ROTATION_ANGLE_MAX = 180
ROTATION_ANGLE_DEFAULT = 0
ROTATION_ANGLE_STEP = 0.1
ROTATION_UNIT = "degrees"
ROTATION_DESCRIPTION = "Rotation angle in degrees"

# Brightness parameters (UPDATED: Factor → Percentage for better UX)
# OLD: factor (0.5-1.5) → NEW: percentage (-50% to +50%)
BRIGHTNESS_MIN = -50  # -50% (darker)
BRIGHTNESS_MAX = 50   # +50% (brighter)
BRIGHTNESS_DEFAULT = 0  # 0% (no change)
BRIGHTNESS_STEP = 1
BRIGHTNESS_UNIT = "percent"
BRIGHTNESS_DESCRIPTION = "Brightness adjustment (-50% darker to +50% brighter)"

# Conversion function: percentage → factor
def brightness_percentage_to_factor(percentage):
    """Convert brightness percentage (-50 to +50) to factor (0.5 to 1.5)"""
    return 1.0 + (percentage / 100.0)

# Contrast parameters (UPDATED: Factor → Percentage for better UX)
# OLD: factor (0.5-1.5) → NEW: percentage (-50% to +50%)
CONTRAST_MIN = -50  # -50% (less contrast)
CONTRAST_MAX = 50   # +50% (more contrast)
CONTRAST_DEFAULT = 0  # 0% (no change)
CONTRAST_STEP = 1
CONTRAST_UNIT = "percent"
CONTRAST_DESCRIPTION = "Contrast adjustment (-50% less to +50% more contrast)"

# Conversion function: percentage → factor
def contrast_percentage_to_factor(percentage):
    """Convert contrast percentage (-50 to +50) to factor (0.5 to 1.5)"""
    return 1.0 + (percentage / 100.0)

# Blur parameters (ENHANCED: Added unit display)
BLUR_RADIUS_MIN = 0.5
BLUR_RADIUS_MAX = 20.0
BLUR_RADIUS_DEFAULT = 2.0
BLUR_RADIUS_STEP = 0.1
BLUR_UNIT = "pixels"
BLUR_DESCRIPTION = "Blur radius in pixels"

# Hue parameters (ENHANCED: Added unit display)
HUE_SHIFT_MIN = -30
HUE_SHIFT_MAX = 30
HUE_SHIFT_DEFAULT = 0
HUE_SHIFT_STEP = 0.1
HUE_UNIT = "degrees"
HUE_DESCRIPTION = "Hue shift in degrees"

# Noise parameters (UPDATED: Intensity → Percentage for better UX)
# OLD: intensity (0.001-0.1) → NEW: strength (1-50%)
NOISE_STRENGTH_MIN = 1    # 1% (subtle)
NOISE_STRENGTH_MAX = 50   # 50% (heavy)
NOISE_STRENGTH_DEFAULT = 5  # 5% (moderate)
NOISE_STRENGTH_STEP = 1
NOISE_UNIT = "percent"
NOISE_DESCRIPTION = "Noise strength (1% subtle to 50% heavy)"

# Conversion function: percentage → intensity
def noise_strength_to_intensity(strength):
    """Convert noise strength percentage (1-50) to intensity (0.001-0.05)"""
    return strength / 1000.0

# Crop parameters (UPDATED: Scale → Percentage for better UX)
# OLD: scale (0.8-1.0) → NEW: crop_percentage (50-100%)
CROP_PERCENTAGE_MIN = 50    # 50% (heavy crop)
CROP_PERCENTAGE_MAX = 100   # 100% (no crop)
CROP_PERCENTAGE_DEFAULT = 100  # 100% (no crop)
CROP_PERCENTAGE_STEP = 1
CROP_UNIT = "percent"
CROP_DESCRIPTION = "Crop to percentage of original size"

# Color Jitter parameters (UPDATED: Multiple factors → Separate controls with clear units)
# Hue shift
COLOR_JITTER_HUE_MIN = -30    # -30° (shift left)
COLOR_JITTER_HUE_MAX = 30     # +30° (shift right)
COLOR_JITTER_HUE_DEFAULT = 0  # 0° (no change)
COLOR_JITTER_HUE_STEP = 1
COLOR_JITTER_HUE_UNIT = "degrees"
COLOR_JITTER_HUE_DESCRIPTION = "Hue shift in degrees (-30° to +30°)"

# Brightness variation
COLOR_JITTER_BRIGHTNESS_MIN = -20    # -20% (darker)
COLOR_JITTER_BRIGHTNESS_MAX = 20     # +20% (brighter)
COLOR_JITTER_BRIGHTNESS_DEFAULT = 0  # 0% (no change)
COLOR_JITTER_BRIGHTNESS_STEP = 1
COLOR_JITTER_BRIGHTNESS_UNIT = "percent"
COLOR_JITTER_BRIGHTNESS_DESCRIPTION = "Brightness variation (-20% to +20%)"

# Contrast variation
COLOR_JITTER_CONTRAST_MIN = -20    # -20% (less contrast)
COLOR_JITTER_CONTRAST_MAX = 20     # +20% (more contrast)
COLOR_JITTER_CONTRAST_DEFAULT = 0  # 0% (no change)
COLOR_JITTER_CONTRAST_STEP = 1
COLOR_JITTER_CONTRAST_UNIT = "percent"
COLOR_JITTER_CONTRAST_DESCRIPTION = "Contrast variation (-20% to +20%)"

# Saturation variation
COLOR_JITTER_SATURATION_MIN = -20    # -20% (less saturated)
COLOR_JITTER_SATURATION_MAX = 20     # +20% (more saturated)
COLOR_JITTER_SATURATION_DEFAULT = 0  # 0% (no change)
COLOR_JITTER_SATURATION_STEP = 1
COLOR_JITTER_SATURATION_UNIT = "percent"
COLOR_JITTER_SATURATION_DESCRIPTION = "Saturation variation (-20% to +20%)"

# =====================================================================
# PHASE 2: MODERATE FIXES - Enhanced parameter definitions
# =====================================================================

# Random Zoom parameters (ENHANCED: Added clear unit display)
RANDOM_ZOOM_FACTOR_MIN = 0.5    # 0.5× (zoom out)
RANDOM_ZOOM_FACTOR_MAX = 2.0    # 2.0× (zoom in)
RANDOM_ZOOM_FACTOR_DEFAULT = 1.0  # 1.0× (original size)
RANDOM_ZOOM_FACTOR_STEP = 0.1
RANDOM_ZOOM_UNIT = "ratio"
RANDOM_ZOOM_DESCRIPTION = "Zoom factor (1.0 = original size)"

# Affine Transform parameters (ENHANCED: Added clear units for all 4 parameters)
# Scale factor
AFFINE_SCALE_MIN = 0.8    # 0.8× (smaller)
AFFINE_SCALE_MAX = 1.2    # 1.2× (larger)
AFFINE_SCALE_DEFAULT = 1.0  # 1.0× (original size)
AFFINE_SCALE_STEP = 0.01
AFFINE_SCALE_UNIT = "ratio"
AFFINE_SCALE_DESCRIPTION = "Scale factor (0.8× smaller to 1.2× larger)"

# Rotation angle
AFFINE_ROTATION_MIN = -15    # -15° (counter-clockwise)
AFFINE_ROTATION_MAX = 15     # +15° (clockwise)
AFFINE_ROTATION_DEFAULT = 0  # 0° (no rotation)
AFFINE_ROTATION_STEP = 0.1
AFFINE_ROTATION_UNIT = "degrees"
AFFINE_ROTATION_DESCRIPTION = "Rotation angle in degrees"

# Horizontal shift
AFFINE_HORIZONTAL_SHIFT_MIN = -20    # -20% (left)
AFFINE_HORIZONTAL_SHIFT_MAX = 20     # +20% (right)
AFFINE_HORIZONTAL_SHIFT_DEFAULT = 0  # 0% (no shift)
AFFINE_HORIZONTAL_SHIFT_STEP = 1
AFFINE_HORIZONTAL_SHIFT_UNIT = "percent"
AFFINE_HORIZONTAL_SHIFT_DESCRIPTION = "Horizontal shift (-20% left to +20% right)"

# Vertical shift
AFFINE_VERTICAL_SHIFT_MIN = -20    # -20% (up)
AFFINE_VERTICAL_SHIFT_MAX = 20     # +20% (down)
AFFINE_VERTICAL_SHIFT_DEFAULT = 0  # 0% (no shift)
AFFINE_VERTICAL_SHIFT_STEP = 1
AFFINE_VERTICAL_SHIFT_UNIT = "percent"
AFFINE_VERTICAL_SHIFT_DESCRIPTION = "Vertical shift (-20% up to +20% down)"

# Perspective Warp parameters (UPDATED: Changed to percentage strength)
PERSPECTIVE_DISTORTION_MIN = 0     # 0% (no distortion)
PERSPECTIVE_DISTORTION_MAX = 30    # 30% (heavy distortion)
PERSPECTIVE_DISTORTION_DEFAULT = 10  # 10% (moderate distortion)
PERSPECTIVE_DISTORTION_STEP = 1
PERSPECTIVE_DISTORTION_UNIT = "percent"
PERSPECTIVE_DISTORTION_DESCRIPTION = "Perspective distortion strength (0% none to 30% heavy)"

# Saturation parameters (ENHANCED: Added unit display)
SATURATION_MIN = 0.5
SATURATION_MAX = 1.5
SATURATION_DEFAULT = 1.0
SATURATION_STEP = 0.01
SATURATION_UNIT = "factor"
SATURATION_DESCRIPTION = "Saturation factor (0.5 = half, 1.0 = normal, 1.5 = enhanced)"

# Gamma parameters (ENHANCED: Added unit display)
GAMMA_MIN = 0.5
GAMMA_MAX = 2.0
GAMMA_DEFAULT = 1.0
GAMMA_STEP = 0.01
GAMMA_UNIT = "gamma"
GAMMA_DESCRIPTION = "Gamma correction value (1.0 = no change)"

# Resize parameters (ENHANCED: Added unit display)
RESIZE_WIDTH_MIN = 64
RESIZE_WIDTH_MAX = 4096
RESIZE_WIDTH_DEFAULT = 640
RESIZE_HEIGHT_MIN = 64
RESIZE_HEIGHT_MAX = 4096
RESIZE_HEIGHT_DEFAULT = 640
RESIZE_UNIT = "pixels"
RESIZE_DESCRIPTION = "Image dimensions in pixels"

# CLAHE (Contrast Limited Adaptive Histogram Equalization) parameters
CLAHE_CLIP_LIMIT_MIN = 1.0
CLAHE_CLIP_LIMIT_MAX = 4.0
CLAHE_CLIP_LIMIT_DEFAULT = 2.0
CLAHE_CLIP_LIMIT_STEP = 0.1
CLAHE_CLIP_LIMIT_UNIT = "threshold"
CLAHE_CLIP_LIMIT_DESCRIPTION = "Contrast clipping threshold (higher = more contrast)"

CLAHE_GRID_SIZE_MIN = 4
CLAHE_GRID_SIZE_MAX = 16
CLAHE_GRID_SIZE_DEFAULT = 8
CLAHE_GRID_SIZE_STEP = 1
CLAHE_GRID_SIZE_UNIT = "tiles"
CLAHE_GRID_SIZE_DESCRIPTION = "Grid size for local histogram equalization"

# Cutout parameters
CUTOUT_NUM_HOLES_MIN = 1
CUTOUT_NUM_HOLES_MAX = 5
CUTOUT_NUM_HOLES_DEFAULT = 1
CUTOUT_NUM_HOLES_STEP = 1
CUTOUT_NUM_HOLES_UNIT = "holes"
CUTOUT_NUM_HOLES_DESCRIPTION = "Number of rectangular holes to cut out"

CUTOUT_HOLE_SIZE_MIN = 16
CUTOUT_HOLE_SIZE_MAX = 64
CUTOUT_HOLE_SIZE_DEFAULT = 32
CUTOUT_HOLE_SIZE_STEP = 1
CUTOUT_HOLE_SIZE_UNIT = "pixels"
CUTOUT_HOLE_SIZE_DESCRIPTION = "Size of each cutout hole in pixels"

# =====================================================================
# PHASE 3: UI ENHANCEMENT - Complete unit system
# =====================================================================

# All parameters now have:
# - Clear units (pixels, percent, degrees, ratio, factor, gamma)
# - Descriptive names and helpful descriptions
# - Consistent step values for smooth UI interaction
# - Professional parameter presentation

# =====================================================================
# PARAMETER GETTER FUNCTIONS - For image_transformer.py integration
# =====================================================================

def get_brightness_parameters():
    """Get brightness parameters for UI"""
    return {
        'min': BRIGHTNESS_MIN,
        'max': BRIGHTNESS_MAX,
        'default': BRIGHTNESS_DEFAULT,
        'step': BRIGHTNESS_STEP,
        'unit': BRIGHTNESS_UNIT,
        'description': BRIGHTNESS_DESCRIPTION
    }

def get_contrast_parameters():
    """Get contrast parameters for UI"""
    return {
        'min': CONTRAST_MIN,
        'max': CONTRAST_MAX,
        'default': CONTRAST_DEFAULT,
        'step': CONTRAST_STEP,
        'unit': CONTRAST_UNIT,
        'description': CONTRAST_DESCRIPTION
    }

def get_blur_parameters():
    """Get blur parameters for UI"""
    return {
        'min': BLUR_RADIUS_MIN,
        'max': BLUR_RADIUS_MAX,
        'default': BLUR_RADIUS_DEFAULT,
        'step': BLUR_RADIUS_STEP,
        'unit': BLUR_UNIT,
        'description': BLUR_DESCRIPTION
    }

def get_hue_parameters():
    """Get hue parameters for UI"""
    return {
        'min': HUE_SHIFT_MIN,
        'max': HUE_SHIFT_MAX,
        'default': HUE_SHIFT_DEFAULT,
        'step': HUE_SHIFT_STEP,
        'unit': HUE_UNIT,
        'description': HUE_DESCRIPTION
    }

def get_noise_parameters():
    """Get noise parameters for UI"""
    return {
        'min': NOISE_STRENGTH_MIN,
        'max': NOISE_STRENGTH_MAX,
        'default': NOISE_STRENGTH_DEFAULT,
        'step': NOISE_STRENGTH_STEP,
        'unit': NOISE_UNIT,
        'description': NOISE_DESCRIPTION
    }

def get_shear_parameters():
    """Get shear parameters for UI"""
    return {
        'min': SHEAR_ANGLE_MIN,
        'max': SHEAR_ANGLE_MAX,
        'default': SHEAR_ANGLE_DEFAULT,
        'step': SHEAR_ANGLE_STEP,
        'unit': SHEAR_UNIT,
        'description': SHEAR_DESCRIPTION
    }

def get_rotation_parameters():
    """Get rotation parameters for UI"""
    return {
        'min': ROTATION_ANGLE_MIN,
        'max': ROTATION_ANGLE_MAX,
        'default': ROTATION_ANGLE_DEFAULT,
        'step': ROTATION_ANGLE_STEP,
        'unit': ROTATION_UNIT,
        'description': ROTATION_DESCRIPTION
    }

def get_saturation_parameters():
    """Get saturation parameters for UI"""
    return {
        'min': SATURATION_MIN,
        'max': SATURATION_MAX,
        'default': SATURATION_DEFAULT,
        'step': SATURATION_STEP,
        'unit': SATURATION_UNIT,
        'description': SATURATION_DESCRIPTION
    }

def get_gamma_parameters():
    """Get gamma parameters for UI"""
    return {
        'min': GAMMA_MIN,
        'max': GAMMA_MAX,
        'default': GAMMA_DEFAULT,
        'step': GAMMA_STEP,
        'unit': GAMMA_UNIT,
        'description': GAMMA_DESCRIPTION
    }

def get_resize_parameters():
    """Get resize parameters for UI"""
    return {
        'width_min': RESIZE_WIDTH_MIN,
        'width_max': RESIZE_WIDTH_MAX,
        'width_default': RESIZE_WIDTH_DEFAULT,
        'height_min': RESIZE_HEIGHT_MIN,
        'height_max': RESIZE_HEIGHT_MAX,
        'height_default': RESIZE_HEIGHT_DEFAULT,
        'unit': RESIZE_UNIT,
        'description': RESIZE_DESCRIPTION
    }

def get_clahe_clip_limit_parameters():
    """Get CLAHE clip limit parameters for UI"""
    return {
        'min': CLAHE_CLIP_LIMIT_MIN,
        'max': CLAHE_CLIP_LIMIT_MAX,
        'default': CLAHE_CLIP_LIMIT_DEFAULT,
        'step': CLAHE_CLIP_LIMIT_STEP,
        'unit': CLAHE_CLIP_LIMIT_UNIT,
        'description': CLAHE_CLIP_LIMIT_DESCRIPTION
    }

def get_clahe_grid_size_parameters():
    """Get CLAHE grid size parameters for UI"""
    return {
        'min': CLAHE_GRID_SIZE_MIN,
        'max': CLAHE_GRID_SIZE_MAX,
        'default': CLAHE_GRID_SIZE_DEFAULT,
        'step': CLAHE_GRID_SIZE_STEP,
        'unit': CLAHE_GRID_SIZE_UNIT,
        'description': CLAHE_GRID_SIZE_DESCRIPTION
    }

def get_cutout_num_holes_parameters():
    """Get cutout num holes parameters for UI"""
    return {
        'min': CUTOUT_NUM_HOLES_MIN,
        'max': CUTOUT_NUM_HOLES_MAX,
        'default': CUTOUT_NUM_HOLES_DEFAULT,
        'step': CUTOUT_NUM_HOLES_STEP,
        'unit': CUTOUT_NUM_HOLES_UNIT,
        'description': CUTOUT_NUM_HOLES_DESCRIPTION
    }

def get_cutout_hole_size_parameters():
    """Get cutout hole size parameters for UI"""
    return {
        'min': CUTOUT_HOLE_SIZE_MIN,
        'max': CUTOUT_HOLE_SIZE_MAX,
        'default': CUTOUT_HOLE_SIZE_DEFAULT,
        'step': CUTOUT_HOLE_SIZE_STEP,
        'unit': CUTOUT_HOLE_SIZE_UNIT,
        'description': CUTOUT_HOLE_SIZE_DESCRIPTION
    }

# =====================================================================
# TRANSFORMATION CATEGORIES
# =====================================================================

# List of transformations that support negative values (for Smart & Minimal Strategy)
SYMMETRIC_TRANSFORMATIONS = [
    'rotate', 'brightness', 'contrast', 'shear', 'hue', 'saturation', 'gamma'
]

# =====================================================================
# DUAL-VALUE TRANSFORMATION SYSTEM
# =====================================================================

# Tools that support dual-value auto-generation system
# User selects one value, system auto-generates opposite value
DUAL_VALUE_TRANSFORMATIONS = [
    'rotate',      # -180° to +180°
    'hue',         # -30 to +30
    'shear',       # -30° to +30°
    'brightness',  # -0.5 to +0.5 (relative)
    'contrast'     # -0.5 to +0.5 (relative)
]

# Dual-value parameter ranges (for auto-generation)
DUAL_VALUE_RANGES = {
    'rotate': {'min': -180, 'max': 180, 'step': 0.1, 'default': 0},
    'hue': {'min': -30, 'max': 30, 'step': 0.1, 'default': 0},
    'shear': {'min': -30, 'max': 30, 'step': 0.1, 'default': 0},
    'brightness': {'min': -0.5, 'max': 0.5, 'step': 0.01, 'default': 0},
    'contrast': {'min': -0.5, 'max': 0.5, 'step': 0.01, 'default': 0}
}

def is_dual_value_transformation(transformation_type: str) -> bool:
    """Check if transformation supports dual-value system"""
    return transformation_type in DUAL_VALUE_TRANSFORMATIONS

def generate_auto_value(transformation_type: str, user_value: float) -> float:
    """Generate automatic opposite value for dual-value transformations"""
    if not is_dual_value_transformation(transformation_type):
        return user_value
    
    # For symmetric transformations, generate opposite value
    return -user_value

def get_dual_value_range(transformation_type: str) -> dict:
    """Get parameter range for dual-value transformation"""
    return DUAL_VALUE_RANGES.get(transformation_type, {})

def calculate_max_images_per_original(transformations: list) -> dict:
    """
    Calculate max images per original for UI display
    Returns both minimum guaranteed and maximum possible counts
    """
    if not transformations:
        return {"min": 1, "max": 1, "has_dual_value": False}
    
    # Count dual-value and regular transformations
    dual_value_count = 0
    regular_count = 0
    
    for transformation in transformations:
        if transformation.get('enabled', True):
            tool_type = transformation.get('transformation_type') or transformation.get('tool_type')
            if is_dual_value_transformation(tool_type):
                dual_value_count += 1
            else:
                regular_count += 1
    
    if dual_value_count > 0:
        # Dual-value system
        # Minimum: 2 images per dual-value transformation (user + auto)
        min_images = 2 * dual_value_count
        
        # Maximum: includes all possible combinations
        max_images = min_images + (2 ** dual_value_count) + regular_count
        
        return {
            "min": min_images,
            "max": max_images,
            "has_dual_value": True,
            "dual_value_count": dual_value_count,
            "regular_count": regular_count
        }
    else:
        # Single-value system
        total_count = regular_count
        max_images = 2 ** total_count if total_count > 0 else 1
        
        return {
            "min": max_images,
            "max": max_images,
            "has_dual_value": False,
            "dual_value_count": 0,
            "regular_count": regular_count
        }

# Transformation categories
BASIC_TRANSFORMATIONS = [
    'resize', 'rotate', 'flip', 'brightness', 'contrast', 'blur'
]

ADVANCED_TRANSFORMATIONS = [
    'shear', 'hue', 'saturation', 'gamma'
]

