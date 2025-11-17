"""
Central Transformation Configuration
Single source of truth for all transformation parameters in the application

All components should import parameters from this file to ensure consistency.
"""

# Import professional logging system
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

# =====================================================================
# TRANSFORMATION PARAMETERS - SINGLE SOURCE OF TRUTH
# =====================================================================

logger.info("app.backend", "Loading transformation configuration parameters", "config_loading_start", {
    'file': 'transformation_config.py',
    'total_parameters': 25  # Approximate count of parameter sets
})

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
    logger.info("operations.transformations", f"Converting brightness percentage to factor: {percentage}%", "brightness_conversion", {
        'percentage': percentage,
        'conversion_type': 'percentage_to_factor'
    })
    
    try:
        factor = 1.0 + (percentage / 100.0)
        logger.info("operations.transformations", f"Brightness conversion successful: {percentage}% → {factor:.3f}", "brightness_conversion_success", {
            'percentage': percentage,
            'factor': factor
        })
        return factor
    except Exception as e:
        logger.error("errors.validation", f"Brightness conversion failed: {percentage}%", "brightness_conversion_failed", {
            'percentage': percentage,
            'error': str(e)
        })
        return 1.0  # Return default factor on error

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
    logger.info("operations.transformations", f"Converting contrast percentage to factor: {percentage}%", "contrast_conversion", {
        'percentage': percentage,
        'conversion_type': 'percentage_to_factor'
    })
    
    try:
        factor = 1.0 + (percentage / 100.0)
        logger.info("operations.transformations", f"Contrast conversion successful: {percentage}% → {factor:.3f}", "contrast_conversion_success", {
            'percentage': percentage,
            'factor': factor
        })
        return factor
    except Exception as e:
        logger.error("errors.validation", f"Contrast conversion failed: {percentage}%", "contrast_conversion_failed", {
            'percentage': percentage,
            'error': str(e)
        })
        return 1.0  # Return default factor on error

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
    logger.info("operations.transformations", f"Converting noise strength to intensity: {strength}%", "noise_conversion", {
        'strength': strength,
        'conversion_type': 'strength_to_intensity'
    })
    
    try:
        intensity = strength / 1000.0
        logger.info("operations.transformations", f"Noise conversion successful: {strength}% → {intensity:.6f}", "noise_conversion_success", {
            'strength': strength,
            'intensity': intensity
        })
        return intensity
    except Exception as e:
        logger.error("errors.validation", f"Noise conversion failed: {strength}%", "noise_conversion_failed", {
            'strength': strength,
            'error': str(e)
        })
        return 0.005  # Return default intensity on error

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
RESIZE_WIDTH_DEFAULT = 200
RESIZE_HEIGHT_MIN = 64
RESIZE_HEIGHT_MAX = 4096
RESIZE_HEIGHT_DEFAULT = 200
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
    logger.info("operations.transformations", "Retrieving brightness parameters for UI", "parameter_retrieval", {
        'parameter_type': 'brightness'
    })
    
    params = {
        'min': BRIGHTNESS_MIN,
        'max': BRIGHTNESS_MAX,
        'default': BRIGHTNESS_DEFAULT,
        'step': BRIGHTNESS_STEP,
        'unit': BRIGHTNESS_UNIT,
        'description': BRIGHTNESS_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Brightness parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'brightness',
        'min': BRIGHTNESS_MIN,
        'max': BRIGHTNESS_MAX,
        'default': BRIGHTNESS_DEFAULT
    })
    
    return params

def get_contrast_parameters():
    """Get contrast parameters for UI"""
    logger.info("operations.transformations", "Retrieving contrast parameters for UI", "parameter_retrieval", {
        'parameter_type': 'contrast'
    })
    
    params = {
        'min': CONTRAST_MIN,
        'max': CONTRAST_MAX,
        'default': CONTRAST_DEFAULT,
        'step': CONTRAST_STEP,
        'unit': CONTRAST_UNIT,
        'description': CONTRAST_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Contrast parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'contrast',
        'min': CONTRAST_MIN,
        'max': CONTRAST_MAX,
        'default': CONTRAST_DEFAULT
    })
    
    return params

def get_blur_parameters():
    """Get blur parameters for UI"""
    logger.info("operations.transformations", "Retrieving blur parameters for UI", "parameter_retrieval", {
        'parameter_type': 'blur'
    })
    
    params = {
        'min': BLUR_RADIUS_MIN,
        'max': BLUR_RADIUS_MAX,
        'default': BLUR_RADIUS_DEFAULT,
        'step': BLUR_RADIUS_STEP,
        'unit': BLUR_UNIT,
        'description': BLUR_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Blur parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'blur',
        'min': BLUR_RADIUS_MIN,
        'max': BLUR_RADIUS_MAX,
        'default': BLUR_RADIUS_DEFAULT
    })
    
    return params

def get_hue_parameters():
    """Get hue parameters for UI"""
    logger.info("operations.transformations", "Retrieving hue parameters for UI", "parameter_retrieval", {
        'parameter_type': 'hue'
    })
    
    params = {
        'min': HUE_SHIFT_MIN,
        'max': HUE_SHIFT_MAX,
        'default': HUE_SHIFT_DEFAULT,
        'step': HUE_SHIFT_STEP,
        'unit': HUE_UNIT,
        'description': HUE_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Hue parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'hue',
        'min': HUE_SHIFT_MIN,
        'max': HUE_SHIFT_MAX,
        'default': HUE_SHIFT_DEFAULT
    })
    
    return params

def get_noise_parameters():
    """Get noise parameters for UI"""
    logger.info("operations.transformations", "Retrieving noise parameters for UI", "parameter_retrieval", {
        'parameter_type': 'noise'
    })
    
    params = {
        'min': NOISE_STRENGTH_MIN,
        'max': NOISE_STRENGTH_MAX,
        'default': NOISE_STRENGTH_DEFAULT,
        'step': NOISE_STRENGTH_STEP,
        'unit': NOISE_UNIT,
        'description': NOISE_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Noise parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'noise',
        'min': NOISE_STRENGTH_MIN,
        'max': NOISE_STRENGTH_MAX,
        'default': NOISE_STRENGTH_DEFAULT
    })
    
    return params

def get_shear_parameters():
    """Get shear parameters for UI"""
    logger.info("operations.transformations", "Retrieving shear parameters for UI", "parameter_retrieval", {
        'parameter_type': 'shear'
    })
    
    params = {
        'min': SHEAR_ANGLE_MIN,
        'max': SHEAR_ANGLE_MAX,
        'default': SHEAR_ANGLE_DEFAULT,
        'step': SHEAR_ANGLE_STEP,
        'unit': SHEAR_UNIT,
        'description': SHEAR_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Shear parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'shear',
        'min': SHEAR_ANGLE_MIN,
        'max': SHEAR_ANGLE_MAX,
        'default': SHEAR_ANGLE_DEFAULT
    })
    
    return params

def get_rotation_parameters():
    """Get rotation parameters for UI"""
    logger.info("operations.transformations", "Retrieving rotation parameters for UI", "parameter_retrieval", {
        'parameter_type': 'rotation'
    })
    
    params = {
        'min': ROTATION_ANGLE_MIN,
        'max': ROTATION_ANGLE_MAX,
        'default': ROTATION_ANGLE_DEFAULT,
        'step': ROTATION_ANGLE_STEP,
        'unit': ROTATION_UNIT,
        'description': ROTATION_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Rotation parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'rotation',
        'min': ROTATION_ANGLE_MIN,
        'max': ROTATION_ANGLE_MAX,
        'default': ROTATION_ANGLE_DEFAULT
    })
    
    return params

def get_saturation_parameters():
    """Get saturation parameters for UI"""
    logger.info("operations.transformations", "Retrieving saturation parameters for UI", "parameter_retrieval", {
        'parameter_type': 'saturation'
    })
    
    params = {
        'min': SATURATION_MIN,
        'max': SATURATION_MAX,
        'default': SATURATION_DEFAULT,
        'step': SATURATION_STEP,
        'unit': SATURATION_UNIT,
        'description': SATURATION_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Saturation parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'saturation',
        'min': SATURATION_MIN,
        'max': SATURATION_MAX,
        'default': SATURATION_DEFAULT
    })
    
    return params

def get_gamma_parameters():
    """Get gamma parameters for UI"""
    logger.info("operations.transformations", "Retrieving gamma parameters for UI", "parameter_retrieval", {
        'parameter_type': 'gamma'
    })
    
    params = {
        'min': GAMMA_MIN,
        'max': GAMMA_MAX,
        'default': GAMMA_DEFAULT,
        'step': GAMMA_STEP,
        'unit': GAMMA_UNIT,
        'description': GAMMA_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Gamma parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'gamma',
        'min': GAMMA_MIN,
        'max': GAMMA_MAX,
        'default': GAMMA_DEFAULT
    })
    
    return params

def get_resize_parameters():
    """Get resize parameters for UI"""
    logger.info("operations.transformations", "Retrieving resize parameters for UI", "parameter_retrieval", {
        'parameter_type': 'resize'
    })
    
    params = {
        'width_min': RESIZE_WIDTH_MIN,
        'width_max': RESIZE_WIDTH_MAX,
        'width_default': RESIZE_WIDTH_DEFAULT,
        'height_min': RESIZE_HEIGHT_MIN,
        'height_max': RESIZE_HEIGHT_MAX,
        'height_default': RESIZE_HEIGHT_DEFAULT,
        'unit': RESIZE_UNIT,
        'description': RESIZE_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Resize parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'resize',
        'width_min': RESIZE_WIDTH_MIN,
        'width_max': RESIZE_WIDTH_MAX,
        'width_default': RESIZE_WIDTH_DEFAULT,
        'height_min': RESIZE_HEIGHT_MIN,
        'height_max': RESIZE_HEIGHT_MAX,
        'height_default': RESIZE_HEIGHT_DEFAULT
    })
    
    return params

def get_clahe_clip_limit_parameters():
    """Get CLAHE clip limit parameters for UI"""
    logger.info("operations.transformations", "Retrieving CLAHE clip limit parameters for UI", "parameter_retrieval", {
        'parameter_type': 'clahe_clip_limit'
    })
    
    params = {
        'min': CLAHE_CLIP_LIMIT_MIN,
        'max': CLAHE_CLIP_LIMIT_MAX,
        'default': CLAHE_CLIP_LIMIT_DEFAULT,
        'step': CLAHE_CLIP_LIMIT_STEP,
        'unit': CLAHE_CLIP_LIMIT_UNIT,
        'description': CLAHE_CLIP_LIMIT_DESCRIPTION
    }
    
    logger.info("operations.transformations", "CLAHE clip limit parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'clahe_clip_limit',
        'min': CLAHE_CLIP_LIMIT_MIN,
        'max': CLAHE_CLIP_LIMIT_MAX,
        'default': CLAHE_CLIP_LIMIT_DEFAULT
    })
    
    return params

def get_clahe_grid_size_parameters():
    """Get CLAHE grid size parameters for UI"""
    logger.info("operations.transformations", "Retrieving CLAHE grid size parameters for UI", "parameter_retrieval", {
        'parameter_type': 'clahe_grid_size'
    })
    
    params = {
        'min': CLAHE_GRID_SIZE_MIN,
        'max': CLAHE_GRID_SIZE_MAX,
        'default': CLAHE_GRID_SIZE_DEFAULT,
        'step': CLAHE_GRID_SIZE_STEP,
        'unit': CLAHE_GRID_SIZE_UNIT,
        'description': CLAHE_GRID_SIZE_DESCRIPTION
    }
    
    logger.info("operations.transformations", "CLAHE grid size parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'clahe_grid_size',
        'min': CLAHE_GRID_SIZE_MIN,
        'max': CLAHE_GRID_SIZE_MAX,
        'default': CLAHE_GRID_SIZE_DEFAULT
    })
    
    return params

def get_cutout_num_holes_parameters():
    """Get cutout num holes parameters for UI"""
    logger.info("operations.transformations", "Retrieving cutout num holes parameters for UI", "parameter_retrieval", {
        'parameter_type': 'cutout_num_holes'
    })
    
    params = {
        'min': CUTOUT_NUM_HOLES_MIN,
        'max': CUTOUT_NUM_HOLES_MAX,
        'default': CUTOUT_NUM_HOLES_DEFAULT,
        'step': CUTOUT_NUM_HOLES_STEP,
        'unit': CUTOUT_NUM_HOLES_UNIT,
        'description': CUTOUT_NUM_HOLES_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Cutout num holes parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'cutout_num_holes',
        'min': CUTOUT_NUM_HOLES_MIN,
        'max': CUTOUT_NUM_HOLES_MAX,
        'default': CUTOUT_NUM_HOLES_DEFAULT
    })
    
    return params

def get_cutout_hole_size_parameters():
    """Get cutout hole size parameters for UI"""
    logger.info("operations.transformations", "Retrieving cutout hole size parameters for UI", "parameter_retrieval", {
        'parameter_type': 'cutout_hole_size'
    })
    
    params = {
        'min': CUTOUT_HOLE_SIZE_MIN,
        'max': CUTOUT_HOLE_SIZE_MAX,
        'default': CUTOUT_HOLE_SIZE_DEFAULT,
        'step': CUTOUT_HOLE_SIZE_STEP,
        'unit': CUTOUT_HOLE_SIZE_UNIT,
        'description': CUTOUT_HOLE_SIZE_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Cutout hole size parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'cutout_hole_size',
        'min': CUTOUT_HOLE_SIZE_MIN,
        'max': CUTOUT_HOLE_SIZE_MAX,
        'default': CUTOUT_HOLE_SIZE_DEFAULT
    })
    
    return params

def get_crop_parameters():
    """Get crop parameters for UI"""
    logger.info("operations.transformations", "Retrieving crop parameters for UI", "parameter_retrieval", {
        'parameter_type': 'crop'
    })
    
    params = {
        'min': CROP_PERCENTAGE_MIN,
        'max': CROP_PERCENTAGE_MAX,
        'default': CROP_PERCENTAGE_DEFAULT,
        'step': CROP_PERCENTAGE_STEP,
        'unit': CROP_UNIT,
        'description': CROP_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Crop parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'crop',
        'min': CROP_PERCENTAGE_MIN,
        'max': CROP_PERCENTAGE_MAX,
        'default': CROP_PERCENTAGE_DEFAULT
    })
    
    return params

def get_color_jitter_parameters():
    """Get color jitter parameters for UI"""
    logger.info("operations.transformations", "Retrieving color jitter parameters for UI", "parameter_retrieval", {
        'parameter_type': 'color_jitter'
    })
    
    params = {
        'hue': {
            'min': COLOR_JITTER_HUE_MIN,
            'max': COLOR_JITTER_HUE_MAX,
            'default': COLOR_JITTER_HUE_DEFAULT,
            'step': COLOR_JITTER_HUE_STEP,
            'unit': COLOR_JITTER_HUE_UNIT,
            'description': COLOR_JITTER_HUE_DESCRIPTION
        },
        'brightness': {
            'min': COLOR_JITTER_BRIGHTNESS_MIN,
            'max': COLOR_JITTER_BRIGHTNESS_MAX,
            'default': COLOR_JITTER_BRIGHTNESS_DEFAULT,
            'step': COLOR_JITTER_BRIGHTNESS_STEP,
            'unit': COLOR_JITTER_BRIGHTNESS_UNIT,
            'description': COLOR_JITTER_BRIGHTNESS_DESCRIPTION
        },
        'contrast': {
            'min': COLOR_JITTER_CONTRAST_MIN,
            'max': COLOR_JITTER_CONTRAST_MAX,
            'default': COLOR_JITTER_CONTRAST_DEFAULT,
            'step': COLOR_JITTER_CONTRAST_STEP,
            'unit': COLOR_JITTER_CONTRAST_UNIT,
            'description': COLOR_JITTER_CONTRAST_DESCRIPTION
        },
        'saturation': {
            'min': COLOR_JITTER_SATURATION_MIN,
            'max': COLOR_JITTER_SATURATION_MAX,
            'default': COLOR_JITTER_SATURATION_DEFAULT,
            'step': COLOR_JITTER_SATURATION_STEP,
            'unit': COLOR_JITTER_SATURATION_UNIT,
            'description': COLOR_JITTER_SATURATION_DESCRIPTION
        }
    }
    
    logger.info("operations.transformations", "Color jitter parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'color_jitter',
        'sub_parameters': ['hue', 'brightness', 'contrast', 'saturation']
    })
    
    return params

def get_random_zoom_parameters():
    """Get random zoom parameters for UI"""
    logger.info("operations.transformations", "Retrieving random zoom parameters for UI", "parameter_retrieval", {
        'parameter_type': 'random_zoom'
    })
    
    params = {
        'min': RANDOM_ZOOM_FACTOR_MIN,
        'max': RANDOM_ZOOM_FACTOR_MAX,
        'default': RANDOM_ZOOM_FACTOR_DEFAULT,
        'step': RANDOM_ZOOM_FACTOR_STEP,
        'unit': RANDOM_ZOOM_UNIT,
        'description': RANDOM_ZOOM_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Random zoom parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'random_zoom',
        'min': RANDOM_ZOOM_FACTOR_MIN,
        'max': RANDOM_ZOOM_FACTOR_MAX,
        'default': RANDOM_ZOOM_FACTOR_DEFAULT
    })
    
    return params

def get_affine_transform_parameters():
    """Get affine transform parameters for UI"""
    logger.info("operations.transformations", "Retrieving affine transform parameters for UI", "parameter_retrieval", {
        'parameter_type': 'affine_transform'
    })
    
    params = {
        'scale': {
            'min': AFFINE_SCALE_MIN,
            'max': AFFINE_SCALE_MAX,
            'default': AFFINE_SCALE_DEFAULT,
            'step': AFFINE_SCALE_STEP,
            'unit': AFFINE_SCALE_UNIT,
            'description': AFFINE_SCALE_DESCRIPTION
        },
        'rotation': {
            'min': AFFINE_ROTATION_MIN,
            'max': AFFINE_ROTATION_MAX,
            'default': AFFINE_ROTATION_DEFAULT,
            'step': AFFINE_ROTATION_STEP,
            'unit': AFFINE_ROTATION_UNIT,
            'description': AFFINE_ROTATION_DESCRIPTION
        },
        'horizontal_shift': {
            'min': AFFINE_HORIZONTAL_SHIFT_MIN,
            'max': AFFINE_HORIZONTAL_SHIFT_MAX,
            'default': AFFINE_HORIZONTAL_SHIFT_DEFAULT,
            'step': AFFINE_HORIZONTAL_SHIFT_STEP,
            'unit': AFFINE_HORIZONTAL_SHIFT_UNIT,
            'description': AFFINE_HORIZONTAL_SHIFT_DESCRIPTION
        },
        'vertical_shift': {
            'min': AFFINE_VERTICAL_SHIFT_MIN,
            'max': AFFINE_VERTICAL_SHIFT_MAX,
            'default': AFFINE_VERTICAL_SHIFT_DEFAULT,
            'step': AFFINE_VERTICAL_SHIFT_STEP,
            'unit': AFFINE_VERTICAL_SHIFT_UNIT,
            'description': AFFINE_VERTICAL_SHIFT_DESCRIPTION
        }
    }
    
    logger.info("operations.transformations", "Affine transform parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'affine_transform',
        'sub_parameters': ['scale', 'rotation', 'horizontal_shift', 'vertical_shift']
    })
    
    return params

def get_perspective_warp_parameters():
    """Get perspective warp parameters for UI"""
    logger.info("operations.transformations", "Retrieving perspective warp parameters for UI", "parameter_retrieval", {
        'parameter_type': 'perspective_warp'
    })
    
    params = {
        'min': PERSPECTIVE_DISTORTION_MIN,
        'max': PERSPECTIVE_DISTORTION_MAX,
        'default': PERSPECTIVE_DISTORTION_DEFAULT,
        'step': PERSPECTIVE_DISTORTION_STEP,
        'unit': PERSPECTIVE_DISTORTION_UNIT,
        'description': PERSPECTIVE_DISTORTION_DESCRIPTION
    }
    
    logger.info("operations.transformations", "Perspective warp parameters retrieved successfully", "parameter_retrieval_success", {
        'parameter_type': 'perspective_warp',
        'min': PERSPECTIVE_DISTORTION_MIN,
        'max': PERSPECTIVE_DISTORTION_MAX,
        'default': PERSPECTIVE_DISTORTION_DEFAULT
    })
    
    return params

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
    'hue',         # -30° to +30°
    'shear',       # -30° to +30°
    'brightness',  # -50% to +50% (percentage)
    'contrast'     # -50% to +50% (percentage)
]

# Dual-value parameter ranges (for auto-generation)
# ✅ Updated to match current centralized parameter system
DUAL_VALUE_RANGES = {
    'rotate': {'min': ROTATION_ANGLE_MIN, 'max': ROTATION_ANGLE_MAX, 'step': ROTATION_ANGLE_STEP, 'default': ROTATION_ANGLE_DEFAULT},
    'hue': {'min': HUE_SHIFT_MIN, 'max': HUE_SHIFT_MAX, 'step': HUE_SHIFT_STEP, 'default': HUE_SHIFT_DEFAULT},
    'shear': {'min': SHEAR_ANGLE_MIN, 'max': SHEAR_ANGLE_MAX, 'step': SHEAR_ANGLE_STEP, 'default': SHEAR_ANGLE_DEFAULT},
    'brightness': {'min': BRIGHTNESS_MIN, 'max': BRIGHTNESS_MAX, 'step': BRIGHTNESS_STEP, 'default': BRIGHTNESS_DEFAULT},
    'contrast': {'min': CONTRAST_MIN, 'max': CONTRAST_MAX, 'step': CONTRAST_STEP, 'default': CONTRAST_DEFAULT}
}

# Define which parameters support dual-value processing for each transformation
# Only numeric parameters should be included here
DUAL_VALUE_PARAMETERS = {
    'rotate': ['angle'],  # exclude 'fill_color' - it's a string parameter
    'hue': ['hue_shift', 'hue'],
    'shear': ['shear_angle', 'angle'],
    'brightness': ['percentage', 'factor'],
    'contrast': ['percentage', 'factor']
}

def is_dual_value_transformation(transformation_type: str) -> bool:
    """Check if transformation supports dual-value system"""
    logger.info("operations.transformations", f"Checking dual-value support for: {transformation_type}", "dual_value_check", {
        'transformation_type': transformation_type
    })
    
    is_supported = transformation_type in DUAL_VALUE_TRANSFORMATIONS
    logger.info("operations.transformations", f"Dual-value check result: {transformation_type} → {is_supported}", "dual_value_check_result", {
        'transformation_type': transformation_type,
        'is_supported': is_supported
    })
    return is_supported

def is_dual_value_parameter(transformation_type: str, parameter_name: str) -> bool:
    """Check if a specific parameter supports dual-value processing"""
    if not is_dual_value_transformation(transformation_type):
        return False
    
    supported_params = DUAL_VALUE_PARAMETERS.get(transformation_type, [])
    is_supported = parameter_name in supported_params
    
    logger.info("operations.transformations", f"Parameter dual-value check: {transformation_type}.{parameter_name} → {is_supported}", "parameter_dual_value_check", {
        'transformation_type': transformation_type,
        'parameter_name': parameter_name,
        'is_supported': is_supported,
        'supported_params': supported_params
    })
    
    return is_supported

def generate_auto_value(transformation_type: str, user_value: float) -> float:
    """Generate automatic opposite value for dual-value transformations"""
    logger.info("operations.transformations", f"Generating auto value for: {transformation_type}", "auto_value_generation", {
        'transformation_type': transformation_type,
        'user_value': user_value
    })
    
    if not is_dual_value_transformation(transformation_type):
        logger.info("operations.transformations", f"Not a dual-value transformation, returning user value: {user_value}", "auto_value_skipped", {
            'transformation_type': transformation_type,
            'user_value': user_value
        })
        return user_value
    
    # For symmetric transformations, generate opposite value
    auto_value = -user_value
    logger.info("operations.transformations", f"Auto value generated: {user_value} → {auto_value}", "auto_value_generated", {
        'transformation_type': transformation_type,
        'user_value': user_value,
        'auto_value': auto_value
    })
    return auto_value

def get_dual_value_range(transformation_type: str) -> dict:
    """Get parameter range for dual-value transformation"""
    logger.info("operations.transformations", f"Getting dual-value range for: {transformation_type}", "dual_value_range_request", {
        'transformation_type': transformation_type
    })
    
    range_data = DUAL_VALUE_RANGES.get(transformation_type, {})
    logger.info("operations.transformations", f"Dual-value range retrieved: {transformation_type}", "dual_value_range_retrieved", {
        'transformation_type': transformation_type,
        'has_range': bool(range_data),
        'range_keys': list(range_data.keys()) if range_data else []
    })
    return range_data

def calculate_max_images_per_original(transformations: list) -> dict:
    """
    Calculate max images per original for UI display
    Returns both minimum guaranteed and maximum possible counts
    """
    logger.info("operations.transformations", f"Calculating max images per original", "image_count_calculation_start", {
        'total_transformations': len(transformations) if transformations else 0
    })
    
    if not transformations:
        logger.info("operations.transformations", f"No transformations provided, returning default count", "image_count_default", {
            'min': 1,
            'max': 1,
            'has_dual_value': False
        })
        return {"min": 1, "max": 1, "has_dual_value": False}
    
    # Count dual-value and regular transformations
    # IMPORTANT: 'resize' is a mandatory baseline, not combinatorial → exclude from counts
    dual_value_count = 0
    regular_count = 0
    disabled_count = 0
    resize_count = 0
    
    logger.info("operations.transformations", f"Analyzing transformation types", "transformation_analysis_start", {
        'total_transformations': len(transformations)
    })
    
    for transformation in transformations:
        if not transformation.get('enabled', True):
            disabled_count += 1
            continue
        tool_type = transformation.get('transformation_type') or transformation.get('tool_type')
        if tool_type == 'resize':
            # Baseline resize applies to all images; do not increase combinations
            resize_count += 1
            continue
        if is_dual_value_transformation(tool_type):
            dual_value_count += 1
        else:
            regular_count += 1
    
    logger.info("operations.transformations", f"Transformation analysis completed", "transformation_analysis_complete", {
        'dual_value_count': dual_value_count,
        'regular_count': regular_count,
        'disabled_count': disabled_count,
        'resize_count': resize_count
    })
    
    # Original image is handled separately by UI, so we only count transformation combinations
    if dual_value_count > 0:
        logger.info("operations.transformations", f"Processing dual-value system", "dual_value_processing_start", {
            'dual_value_count': dual_value_count,
            'regular_count': regular_count
        })
        
        # Dual-value system with Priority Order logic
        # Priority 1: User values (individual) = dual_value_count
        # Priority 2: Auto values (individual) = dual_value_count  
        # Priority 3: Combinations (if multiple tools) + regular tool combinations
        priority1_count = dual_value_count
        priority2_count = dual_value_count
        priority3_count = 0
        
        # Add Priority 3 combinations for dual-value tools
        if dual_value_count >= 2:
            priority3_count += 2  # Both user + Both auto combinations
            priority3_count += dual_value_count * (dual_value_count - 1)  # Mixed combinations
        
        # Add regular tool combinations with dual-value variants
        if regular_count > 0:
            total_dual_combinations = priority1_count + priority2_count + priority3_count
            priority3_count += regular_count * (1 + min(total_dual_combinations, 4))
        
        variants = priority1_count + priority2_count + priority3_count
        min_images = 1 + variants  # Include original image (baseline_original = 1)
        max_images = min_images
        
        result = {
            "min": min_images,
            "max": max_images,
            "has_dual_value": True,
            "dual_value_count": dual_value_count,
            "regular_count": regular_count
        }
        
        logger.info("operations.transformations", f"Dual-value calculation completed", "dual_value_calculation_complete", {
            'priority1_count': priority1_count,
            'priority2_count': priority2_count,
            'priority3_count': priority3_count,
            'total_variants': variants,
            'min_images': min_images,
            'max_images': max_images,
            'result': result
        })
        
        return result
    else:
        logger.info("operations.transformations", f"Processing single-value system", "single_value_processing_start", {
            'regular_count': regular_count
        })
        
        # Single-value system (no dual-value tools)
        # Use Priority structure like dual system but for single-value tools
        if regular_count > 0:
            # Priority 1: Each tool applied individually to original image
            priority1_count = regular_count
            
            # Priority 2: No auto values for single-value tools
            priority2_count = 0
            
            # Priority 3: Tool combinations (2^n - 1 - n) = combinations beyond individual tools
            # Total combinations = 2^n - 1, minus individual tools = 2^n - 1 - n
            total_combinations = (2 ** regular_count) - 1
            priority3_count = total_combinations - regular_count
            
            max_images = 1 + priority1_count + priority2_count + priority3_count  # Include original image
        else:
            max_images = 1  # Just original image
        
        result = {
            "min": max_images,
            "max": max_images,
            "has_dual_value": False,
            "dual_value_count": 0,
            "regular_count": regular_count
        }
        
        logger.info("operations.transformations", f"Single-value calculation completed", "single_value_calculation_complete", {
            'regular_count': regular_count,
            'max_images': max_images,
            'result': result
        })
        
        return result

# Transformation categories
BASIC_TRANSFORMATIONS = [
    'resize', 'rotate', 'flip', 'brightness', 'contrast', 'blur'
]

ADVANCED_TRANSFORMATIONS = [
    'shear', 'hue', 'saturation', 'gamma'
]

# Log successful configuration loading
logger.info("app.backend", "Transformation configuration loaded successfully", "config_loading_complete", {
    'file': 'transformation_config.py',
    'basic_transformations': len(BASIC_TRANSFORMATIONS),
    'advanced_transformations': len(ADVANCED_TRANSFORMATIONS),
    'dual_value_transformations': len(DUAL_VALUE_TRANSFORMATIONS),
    'symmetric_transformations': len(SYMMETRIC_TRANSFORMATIONS)
})

