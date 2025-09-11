"""
Image Transformer Service
Core image processing logic for applying transformations
"""

import numpy as np
import cv2
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import random
import math
from typing import Dict, Any, List, Tuple, Optional
import sys
import os
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

# Add the backend directory to the path to import core modules
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# Import central configuration
from core.transformation_config import (
    get_shear_parameters, get_rotation_parameters,
    get_brightness_parameters, get_contrast_parameters,
    get_blur_parameters, get_hue_parameters,
    get_saturation_parameters, get_gamma_parameters,
    get_resize_parameters, get_noise_parameters,
    get_clahe_clip_limit_parameters, get_clahe_grid_size_parameters,
    get_cutout_num_holes_parameters, get_cutout_hole_size_parameters,
    get_crop_parameters, get_color_jitter_parameters,
    get_random_zoom_parameters, get_affine_transform_parameters,
    get_perspective_warp_parameters
)



class ImageTransformer:
    """
    Handles all image transformation operations
    """
    
    def __init__(self):
        logger.info("operations.transformations", "Initializing ImageTransformer service", "transformer_init", {
            'transformation_count': 18,
            'basic_transformations': ['resize', 'rotate', 'flip', 'crop', 'brightness', 'contrast', 'blur', 'noise'],
            'advanced_transformations': ['color_jitter', 'cutout', 'random_zoom', 'affine_transform', 'perspective_warp', 'grayscale', 'shear', 'gamma_correction', 'equalize', 'clahe'],
            'central_config_integration': True
        })
        
        # Helper methods to get transformation parameters from central config
        self._get_shear_params = get_shear_parameters
        self._get_rotation_params = get_rotation_parameters
        self._get_brightness_params = get_brightness_parameters
        self._get_contrast_params = get_contrast_parameters
        self._get_blur_params = get_blur_parameters
        self._get_hue_params = get_hue_parameters
        self._get_saturation_params = get_saturation_parameters
        self._get_gamma_params = get_gamma_parameters
        self._get_resize_params = get_resize_parameters
        self._get_noise_params = get_noise_parameters
        self._get_clahe_clip_limit_params = get_clahe_clip_limit_parameters
        self._get_clahe_grid_size_params = get_clahe_grid_size_parameters
        self._get_cutout_num_holes_params = get_cutout_num_holes_parameters
        self._get_cutout_hole_size_params = get_cutout_hole_size_parameters
        self._get_crop_params = get_crop_parameters
        self._get_color_jitter_params = get_color_jitter_parameters
        self._get_random_zoom_params = get_random_zoom_parameters
        self._get_affine_transform_params = get_affine_transform_parameters
        self._get_perspective_warp_params = get_perspective_warp_parameters
        
        logger.info("operations.transformations", "Central config parameters loaded successfully", "config_loaded", {
            'parameter_functions': 19,
            'config_sources': ['shear', 'rotation', 'brightness', 'contrast', 'blur', 'hue', 'saturation', 'gamma', 'resize', 'noise', 'clahe_clip_limit', 'clahe_grid_size', 'cutout_num_holes', 'cutout_hole_size', 'crop', 'color_jitter', 'random_zoom', 'affine_transform', 'perspective_warp']
        })
        
        self.transformation_methods = {
            # Basic transformations
            'resize': self._apply_resize,
            'rotate': self._apply_rotate,
            'flip': self._apply_flip,
            'crop': self._apply_crop,
            'brightness': self._apply_brightness,
            'contrast': self._apply_contrast,
            'blur': self._apply_blur,
            'noise': self._apply_noise,
            
            # Advanced transformations
            'color_jitter': self._apply_color_jitter,
            'cutout': self._apply_cutout,
            'random_zoom': self._apply_random_zoom,
            'affine_transform': self._apply_affine_transform,
            'perspective_warp': self._apply_perspective_warp,
            'grayscale': self._apply_grayscale,
            'shear': self._apply_shear,
            'gamma_correction': self._apply_gamma_correction,
            'equalize': self._apply_equalize,
            'clahe': self._apply_clahe
        }
    
    def apply_transformations(self, image: Image.Image, config: Dict[str, Any]) -> Image.Image:
        """
        Apply a series of transformations to an image
        
        Args:
            image: PIL Image to transform
            config: Dictionary containing transformation parameters
            
        Returns:
            Transformed PIL Image
        """
        try:
            original_size = image.size
            enabled_transformations = [name for name, params in config.items() if params.get('enabled', True)]
            
            logger.info("operations.transformations", f"Starting image transformations", "transformations_start", {
                'transformation_count': len(config),
                'enabled_transformations': enabled_transformations,
                'image_size': f"{original_size[0]}x{original_size[1]}",
                'config_keys': list(config.keys())
            })
            
            result_image = image.copy()
            applied_transformations = []
            failed_transformations = []
            
            # Apply transformations in order
            for transform_name, params in config.items():
                if transform_name in self.transformation_methods and params.get('enabled', True):
                    try:
                        logger.info("operations.transformations", f"Applying transformation: {transform_name}", "transformation_apply", {
                            'transform_name': transform_name,
                            'params': params,
                            'image_size_before': f"{result_image.size[0]}x{result_image.size[1]}"
                        })
                        
                        result_image = self.transformation_methods[transform_name](result_image, params)
                        applied_transformations.append(transform_name)
                        
                        logger.info("operations.transformations", f"Successfully applied transformation: {transform_name}", "transformation_success", {
                            'transform_name': transform_name,
                            'image_size_after': f"{result_image.size[0]}x{result_image.size[1]}"
                        })
                        
                    except Exception as e:
                        logger.warning("errors.system", f"Failed to apply {transform_name}: {str(e)}", "transformation_failed", {
                            'transform_name': transform_name,
                            'error': str(e),
                            'params': params
                        })
                        failed_transformations.append(transform_name)
                        continue
            
            logger.info("operations.transformations", f"Completed image transformations", "transformations_complete", {
                'applied_transformations': applied_transformations,
                'failed_transformations': failed_transformations,
                'success_rate': f"{len(applied_transformations)}/{len(applied_transformations) + len(failed_transformations)}",
                'final_image_size': f"{result_image.size[0]}x{result_image.size[1]}",
                'original_size': f"{original_size[0]}x{original_size[1]}"
            })
            
            return result_image
            
        except Exception as e:
            logger.error("errors.system", f"Error applying transformations: {str(e)}", "transformations_error", {
                'error': str(e),
                'config': config,
                'image_size': f"{image.size[0]}x{image.size[1]}" if image else 'None'
            })
            return image
    
    def get_available_transformations(self) -> Dict[str, Dict[str, Any]]:
        """
        Get specifications for all available transformations
        
        Returns:
            Dictionary with transformation specifications
        """
        logger.info("operations.transformations", "Getting available transformations", "get_transformations", {
            'transformation_count': 18,
            'basic_count': 8,
            'advanced_count': 10
        })
        
        return {
            'resize': {
                'name': 'Resize',
                'category': 'basic',
                'parameters': {
                    'width': {
                        'type': 'int', 
                        'min': self._get_resize_params()['width_min'], 
                        'max': self._get_resize_params()['width_max'], 
                        'default': self._get_resize_params()['width_default'], 
                        'placeholder': 'Width (e.g. 640)'
                    },
                    'height': {
                        'type': 'int', 
                        'min': self._get_resize_params()['height_min'], 
                        'max': self._get_resize_params()['height_max'], 
                        'default': self._get_resize_params()['height_default'], 
                        'placeholder': 'Height (e.g. 640)'
                    },
                    'resize_mode': {
                        'type': 'select', 
                        'options': [
                            'stretch_to',
                            'fill_center_crop', 
                            'fit_within',
                            'fit_reflect_edges',
                            'fit_black_edges',
                            'fit_white_edges'
                        ], 
                        'default': 'stretch_to',
                        'labels': {
                            'stretch_to': 'Stretch to',
                            'fill_center_crop': 'Fill (with center crop)',
                            'fit_within': 'Fit within',
                            'fit_reflect_edges': 'Fit (reflect edges)',
                            'fit_black_edges': 'Fit (black edges)',
                            'fit_white_edges': 'Fit (white edges)'
                        }
                    },
                    'preset_resolution': {
                        'type': 'select',
                        'options': [
                            'custom',
                            '224x224',
                            '256x256', 
                            '416x416',
                            '512x512',
                            '640x640',
                            '800x600',
                            '1024x768',
                            '1280x720',
                            '1920x1080'
                        ],
                        'default': 'custom',
                        'labels': {
                            'custom': 'Custom Size',
                            '224x224': '224×224 (Small)',
                            '256x256': '256×256 (Tiny)',
                            '416x416': '416×416 (YOLO)',
                            '512x512': '512×512 (Medium)',
                            '640x640': '640×640 (Standard)',
                            '800x600': '800×600 (SVGA)',
                            '1024x768': '1024×768 (XGA)',
                            '1280x720': '1280×720 (HD)',
                            '1920x1080': '1920×1080 (Full HD)'
                        }
                    }
                }
            },
            'rotate': {
                'name': 'Rotate',
                'category': 'basic',
                'parameters': {
                    'angle': {
                        'type': 'float', 
                        'min': self._get_rotation_params()['min'], 
                        'max': self._get_rotation_params()['max'], 
                        'default': self._get_rotation_params()['default'],
                        'unit': 'degrees',
                        'step': self._get_rotation_params()['step'],
                        'description': 'Rotation angle in degrees'
                    },
                    'fill_color': {'type': 'select', 'options': ['white', 'black'], 'default': 'white'}
                }
            },
            'flip': {
                'name': 'Flip',
                'category': 'basic',
                'parameters': {
                    'horizontal': {'type': 'bool', 'default': False},
                    'vertical': {'type': 'bool', 'default': False}
                }
            },
            'crop': {
                'name': 'Crop',
                'category': 'basic',
                'parameters': {
                    'crop_percentage': {
                        'type': 'int', 
                        'min': 50, 
                        'max': 100, 
                        'default': 100,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Crop to percentage of original size'
                    },
                    'crop_mode': {
                        'type': 'select',
                        'options': ['center', 'random', 'top_left', 'top_right', 'bottom_left', 'bottom_right'],
                        'default': 'center',
                        'labels': {
                            'center': 'Center Crop (consistent)',
                            'random': 'Random Crop (for augmentation)',
                            'top_left': 'Top-Left Corner',
                            'top_right': 'Top-Right Corner',
                            'bottom_left': 'Bottom-Left Corner',
                            'bottom_right': 'Bottom-Right Corner'
                        },
                        'description': 'Choose crop position'
                    }
                }
            },
            'brightness': {
                'name': 'Brightness',
                'category': 'basic',
                'parameters': {
                    'percentage': {
                        'type': 'int', 
                        'min': self._get_brightness_params()['min'], 
                        'max': self._get_brightness_params()['max'], 
                        'default': self._get_brightness_params()['default'],
                        'unit': self._get_brightness_params()['unit'],
                        'step': self._get_brightness_params()['step'],
                        'description': self._get_brightness_params()['description']
                    }
                }
            },
            'contrast': {
                'name': 'Contrast',
                'category': 'basic',
                'parameters': {
                    'percentage': {
                        'type': 'int', 
                        'min': self._get_contrast_params()['min'], 
                        'max': self._get_contrast_params()['max'], 
                        'default': self._get_contrast_params()['default'],
                        'unit': self._get_contrast_params()['unit'],
                        'step': self._get_contrast_params()['step'],
                        'description': self._get_contrast_params()['description']
                    }
                }
            },
            'blur': {
                'name': 'Blur',
                'category': 'basic',
                'parameters': {
                    'radius': {
                        'type': 'float', 
                        'min': self._get_blur_params()['min'], 
                        'max': self._get_blur_params()['max'], 
                        'default': self._get_blur_params()['default'],
                        'unit': 'pixels',
                        'step': self._get_blur_params()['step'],
                        'description': 'Blur radius in pixels'
                    },
                    'blur_type': {'type': 'select', 'options': ['gaussian', 'motion', 'box'], 'default': 'gaussian'}
                }
            },
            'noise': {
                'name': 'Noise',
                'category': 'basic',
                'parameters': {
                    'strength': {
                        'type': 'int', 
                        'min': 1, 
                        'max': 50, 
                        'default': 5,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Noise strength (1% subtle to 50% heavy)'
                    },
                    'noise_type': {'type': 'select', 'options': ['gaussian', 'salt_pepper', 'uniform'], 'default': 'gaussian'}
                }
            },
            'color_jitter': {
                'name': 'Color Jitter',
                'category': 'advanced',
                'parameters': {
                    'hue_shift': {
                        'type': 'int', 
                        'min': -30, 
                        'max': 30, 
                        'default': 0,
                        'unit': 'degrees',
                        'step': 1,
                        'description': 'Hue shift in degrees (-30° to +30°)'
                    },
                    'brightness_variation': {
                        'type': 'int', 
                        'min': -20, 
                        'max': 20, 
                        'default': 0,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Brightness variation (-20% to +20%)'
                    },
                    'contrast_variation': {
                        'type': 'int', 
                        'min': -20, 
                        'max': 20, 
                        'default': 0,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Contrast variation (-20% to +20%)'
                    },
                    'saturation_variation': {
                        'type': 'int', 
                        'min': -20, 
                        'max': 20, 
                        'default': 0,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Saturation variation (-20% to +20%)'
                    }
                }
            },
            'cutout': {
                'name': 'Cutout',
                'category': 'advanced',
                'parameters': {
                    'num_holes': {
                        'type': 'int', 
                        'min': self._get_cutout_num_holes_params()['min'], 
                        'max': self._get_cutout_num_holes_params()['max'], 
                        'default': self._get_cutout_num_holes_params()['default'],
                        'unit': self._get_cutout_num_holes_params()['unit'],
                        'step': self._get_cutout_num_holes_params()['step'],
                        'description': self._get_cutout_num_holes_params()['description']
                    },
                    'hole_size': {
                        'type': 'int', 
                        'min': self._get_cutout_hole_size_params()['min'], 
                        'max': self._get_cutout_hole_size_params()['max'], 
                        'default': self._get_cutout_hole_size_params()['default'],
                        'unit': self._get_cutout_hole_size_params()['unit'],
                        'step': self._get_cutout_hole_size_params()['step'],
                        'description': self._get_cutout_hole_size_params()['description']
                    }
                }
            },
            'random_zoom': {
                'name': 'Random Zoom',
                'category': 'advanced',
                'parameters': {
                    'zoom_factor': {
                        'type': 'float', 
                        'min': 0.5, 
                        'max': 2.0, 
                        'default': 1.0,
                        'unit': 'ratio',
                        'step': 0.1,
                        'description': 'Zoom factor (1.0 = original size)'
                    }
                }
            },
            'affine_transform': {
                'name': 'Affine Transform',
                'category': 'advanced',
                'parameters': {
                    'scale_factor': {
                        'type': 'float', 
                        'min': 0.8, 
                        'max': 1.2, 
                        'default': 1.0,
                        'unit': 'ratio',
                        'step': 0.01,
                        'description': 'Scale factor (0.8× smaller to 1.2× larger)'
                    },
                    'rotation_angle': {
                        'type': 'float', 
                        'min': -15, 
                        'max': 15, 
                        'default': 0,
                        'unit': 'degrees',
                        'step': 0.1,
                        'description': 'Rotation angle in degrees'
                    },
                    'horizontal_shift': {
                        'type': 'int', 
                        'min': -20, 
                        'max': 20, 
                        'default': 0,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Horizontal shift (-20% left to +20% right)'
                    },
                    'vertical_shift': {
                        'type': 'int', 
                        'min': -20, 
                        'max': 20, 
                        'default': 0,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Vertical shift (-20% up to +20% down)'
                    }
                }
            },
            'perspective_warp': {
                'name': 'Perspective Warp',
                'category': 'advanced',
                'parameters': {
                    'distortion_strength': {
                        'type': 'int', 
                        'min': 0, 
                        'max': 30, 
                        'default': 10,
                        'unit': 'percent',
                        'step': 1,
                        'description': 'Perspective distortion strength (0% none to 30% heavy)'
                    }
                }
            },
            'grayscale': {
                'name': 'Grayscale',
                'category': 'advanced',
                'parameters': {}
            },
            'shear': {
                'name': 'Shear',
                'category': 'advanced',
                'parameters': {
                    'shear_angle': {
                        'type': 'float', 
                        'min': self._get_shear_params()['min'], 
                        'max': self._get_shear_params()['max'], 
                        'default': self._get_shear_params()['default'],
                        'unit': 'degrees',
                        'step': self._get_shear_params()['step'],
                        'description': 'Shear angle in degrees'
                    }
                }
            },
            'gamma_correction': {
                'name': 'Gamma Correction',
                'category': 'advanced',
                'parameters': {
                    'gamma': {
                        'type': 'float', 
                        'min': self._get_gamma_params()['min'], 
                        'max': self._get_gamma_params()['max'], 
                        'default': self._get_gamma_params()['default'],
                        'unit': self._get_gamma_params()['unit'],
                        'step': self._get_gamma_params()['step'],
                        'description': self._get_gamma_params()['description']
                    }
                }
            },
            'equalize': {
                'name': 'Equalize',
                'category': 'advanced',
                'parameters': {}
            },
            'clahe': {
                'name': 'CLAHE',
                'category': 'advanced',
                'parameters': {
                    'clip_limit': {
                        'type': 'float', 
                        'min': self._get_clahe_clip_limit_params()['min'], 
                        'max': self._get_clahe_clip_limit_params()['max'], 
                        'default': self._get_clahe_clip_limit_params()['default'],
                        'unit': self._get_clahe_clip_limit_params()['unit'],
                        'step': self._get_clahe_clip_limit_params()['step'],
                        'description': self._get_clahe_clip_limit_params()['description']
                    },
                    'grid_size': {
                        'type': 'int', 
                        'min': self._get_clahe_grid_size_params()['min'], 
                        'max': self._get_clahe_grid_size_params()['max'], 
                        'default': self._get_clahe_grid_size_params()['default'],
                        'unit': self._get_clahe_grid_size_params()['unit'],
                        'step': self._get_clahe_grid_size_params()['step'],
                        'description': self._get_clahe_grid_size_params()['description']
                    }
                }
            }
        }
    
    # Basic transformation methods
    def _apply_resize(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Resize image with professional resize modes and high-quality resampling"""
        try:
            original_size = image.size
            preset_resolution = params.get('preset_resolution', 'custom')
            
            logger.info("operations.transformations", f"Applying resize transformation", "resize_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'preset_resolution': preset_resolution,
                'params': params
            })
            
            # Handle preset resolutions
            if preset_resolution != 'custom':
                # Parse preset resolution (e.g., '640x640' -> width=640, height=640)
                try:
                    width, height = map(int, preset_resolution.split('x'))
                    logger.info("operations.transformations", f"Using preset resolution: {preset_resolution}", "resize_preset", {
                        'preset': preset_resolution,
                        'parsed_size': f"{width}x{height}"
                    })
                except (ValueError, AttributeError):
                    # Fallback to custom values if preset parsing fails
                    width = params.get('width', 640)
                    height = params.get('height', 640)
                    logger.warning("operations.transformations", f"Failed to parse preset resolution, using fallback", "resize_preset_fallback", {
                        'preset': preset_resolution,
                        'fallback_size': f"{width}x{height}"
                    })
            else:
                # Use custom width and height
                width = params.get('width', 640)
                height = params.get('height', 640)
            
            resize_mode = params.get('resize_mode', 'stretch_to')
            fill_color = params.get('fill_color', 'black')
            
            # Convert fill_color to RGB tuple if it's a string
            if isinstance(fill_color, str):
                if fill_color.lower() == 'white':
                    fill_color = (255, 255, 255)
                elif fill_color.lower() == 'black':
                    fill_color = (0, 0, 0)
                else:
                    fill_color = (0, 0, 0)  # default to black
            
            original_width, original_height = image.size
            target_width, target_height = width, height
            
            # Choose high-quality resampling method
            original_size_pixels = original_width * original_height
            target_size_pixels = target_width * target_height
            resample = Image.Resampling.LANCZOS if target_size_pixels < original_size_pixels else Image.Resampling.BICUBIC
        
            if resize_mode == 'stretch_to':
                # Stretch to exact dimensions (may distort aspect ratio)
                result = image.resize((target_width, target_height), resample)
                
            elif resize_mode == 'fill_center_crop':
                # Fill with center crop - scale to fill, then crop center
                original_aspect = original_width / original_height
                target_aspect = target_width / target_height
                
                if original_aspect > target_aspect:
                    # Original is wider - scale by height, crop width
                    scale_height = target_height
                    scale_width = int(target_height * original_aspect)
                else:
                    # Original is taller - scale by width, crop height
                    scale_width = target_width
                    scale_height = int(target_width / original_aspect)
                
                # Resize to fill
                scaled = image.resize((scale_width, scale_height), resample)
                
                # Center crop
                left = (scale_width - target_width) // 2
                top = (scale_height - target_height) // 2
                right = left + target_width
                bottom = top + target_height
                
                result = scaled.crop((left, top, right, bottom))
                
            elif resize_mode == 'fit_within':
                # Fit within bounds - scale to fit, maintain aspect ratio
                original_aspect = original_width / original_height
                target_aspect = target_width / target_height
                
                if original_aspect > target_aspect:
                    # Original is wider - scale by width
                    new_width = target_width
                    new_height = int(target_width / original_aspect)
                else:
                    # Original is taller - scale by height
                    new_height = target_height
                    new_width = int(target_height * original_aspect)
                
                result = image.resize((new_width, new_height), resample)
                
            elif resize_mode == 'fit_reflect_edges':
                # Fit with reflected edges padding
                # First fit within bounds
                original_aspect = original_width / original_height
                target_aspect = target_width / target_height
                
                if original_aspect > target_aspect:
                    new_width = target_width
                    new_height = int(target_width / original_aspect)
                else:
                    new_height = target_height
                    new_width = int(target_height * original_aspect)
                
                fitted = image.resize((new_width, new_height), resample)
                
                # Create canvas with target size
                result = Image.new('RGB', (target_width, target_height), fill_color)
                
                # Paste fitted image in center
                paste_x = (target_width - new_width) // 2
                paste_y = (target_height - new_height) // 2
                result.paste(fitted, (paste_x, paste_y))
                
            elif resize_mode == 'fit_black_edges':
                # Fit with black edges padding
                original_aspect = original_width / original_height
                target_aspect = target_width / target_height
                
                if original_aspect > target_aspect:
                    new_width = target_width
                    new_height = int(target_width / original_aspect)
                else:
                    new_height = target_height
                    new_width = int(target_height * original_aspect)
                
                fitted = image.resize((new_width, new_height), resample)
                
                # Create black canvas
                result = Image.new('RGB', (target_width, target_height), (0, 0, 0))
                
                # Paste fitted image in center
                paste_x = (target_width - new_width) // 2
                paste_y = (target_height - new_height) // 2
                result.paste(fitted, (paste_x, paste_y))
                
            elif resize_mode == 'fit_white_edges':
                # Fit with white edges padding
                original_aspect = original_width / original_height
                target_aspect = target_width / target_height
                
                if original_aspect > target_aspect:
                    new_width = target_width
                    new_height = int(target_width / original_aspect)
                else:
                    new_height = target_height
                    new_width = int(target_height * original_aspect)
                
                fitted = image.resize((new_width, new_height), resample)
                
                # Create white canvas
                result = Image.new('RGB', (target_width, target_height), (255, 255, 255))
                
                # Paste fitted image in center
                paste_x = (target_width - new_width) // 2
                paste_y = (target_height - new_height) // 2
                result.paste(fitted, (paste_x, paste_y))
                
            else:
                # Default to stretch_to
                result = image.resize((target_width, target_height), resample)
            
            logger.info("operations.transformations", f"Resize transformation completed", "resize_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'resize_mode': resize_mode,
                'size_change': f"{((result.size[0] * result.size[1]) / (original_size[0] * original_size[1])):.2f}x"
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Resize transformation failed: {str(e)}", "resize_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_rotate(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Rotate image by specified angle with high-quality interpolation"""
        try:
            original_size = image.size
            # Get parameters from central config
            rotation_params = self._get_rotation_params()
            angle = params.get('angle', rotation_params['default'])
            fill_color = params.get('fill_color', 'white')
            
            logger.info("operations.transformations", f"Applying rotate transformation", "rotate_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'angle': angle,
                'fill_color': fill_color,
                'params': params
            })
            
            # Convert fill_color to RGB tuple if it's a string
            if isinstance(fill_color, str):
                if fill_color.lower() == 'white':
                    fill_color = (255, 255, 255)
                elif fill_color.lower() == 'black':
                    fill_color = (0, 0, 0)
                else:
                    fill_color = (255, 255, 255)  # default to white
            
            # Use high-quality bicubic interpolation for rotation
            result = image.rotate(
                angle, 
                resample=Image.Resampling.BICUBIC,  # High-quality interpolation
                expand=True, 
                fillcolor=fill_color
            )
            
            logger.info("operations.transformations", f"Rotate transformation completed", "rotate_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'angle': angle,
                'size_change': f"{((result.size[0] * result.size[1]) / (original_size[0] * original_size[1])):.2f}x"
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Rotate transformation failed: {str(e)}", "rotate_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_flip(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Flip image horizontally and/or vertically"""
        try:
            original_size = image.size
            horizontal = params.get('horizontal', False)
            vertical = params.get('vertical', False)
            
            logger.info("operations.transformations", f"Applying flip transformation", "flip_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'horizontal_flip': horizontal,
                'vertical_flip': vertical,
                'params': params
            })
            
            result = image
            if horizontal:
                result = result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                logger.info("operations.transformations", f"Applied horizontal flip", "flip_horizontal", {
                    'applied': True
                })
            if vertical:
                result = result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                logger.info("operations.transformations", f"Applied vertical flip", "flip_vertical", {
                    'applied': True
                })
            
            logger.info("operations.transformations", f"Flip transformation completed", "flip_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'horizontal_flip': horizontal,
                'vertical_flip': vertical
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Flip transformation failed: {str(e)}", "flip_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_crop(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply crop with specified percentage and position mode"""
        try:
            original_size = image.size
            # Get parameters from central config
            crop_params = self._get_crop_params()
            crop_percentage = params.get('crop_percentage', params.get('scale', crop_params['default']))  # Support both old and new parameter names
            crop_mode = params.get('crop_mode', 'center')  # Default to center crop
            
            logger.info("operations.transformations", f"Applying crop transformation", "crop_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'crop_percentage': crop_percentage,
                'crop_mode': crop_mode,
                'params': params
            })
            
            # Convert percentage to scale if needed
            if crop_percentage > 1.0:
                # New percentage format (50-100)
                scale = crop_percentage / 100.0
            else:
                # Old scale format (0.8-1.0) for backwards compatibility
                scale = crop_percentage
                
            if scale >= 1.0:
                logger.info("operations.transformations", f"Crop transformation skipped (scale >= 1.0)", "crop_skipped", {
                    'scale': scale,
                    'reason': 'scale >= 1.0'
                })
                return image
            
            width, height = image.size
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Calculate crop position based on mode
            if crop_mode == 'center':
                # Center crop (consistent results)
                left = (width - new_width) // 2
                top = (height - new_height) // 2
            elif crop_mode == 'random':
                # Random crop (for augmentation)
                left = random.randint(0, width - new_width)
                top = random.randint(0, height - new_height)
            elif crop_mode == 'top_left':
                # Top-left corner
                left = 0
                top = 0
            elif crop_mode == 'top_right':
                # Top-right corner
                left = width - new_width
                top = 0
            elif crop_mode == 'bottom_left':
                # Bottom-left corner
                left = 0
                top = height - new_height
            elif crop_mode == 'bottom_right':
                # Bottom-right corner
                left = width - new_width
                top = height - new_height
            else:
                # Default to center if unknown mode
                left = (width - new_width) // 2
                top = (height - new_height) // 2
            
            logger.info("operations.transformations", f"Crop parameters calculated", "crop_params", {
                'crop_size': f"{new_width}x{new_height}",
                'crop_position': f"({left}, {top})",
                'scale': scale
            })
            
            cropped = image.crop((left, top, left + new_width, top + new_height))
            result = cropped.resize((width, height), Image.Resampling.LANCZOS)
            
            logger.info("operations.transformations", f"Crop transformation completed", "crop_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'crop_size': f"{new_width}x{new_height}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'scale': scale
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Crop transformation failed: {str(e)}", "crop_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_brightness(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Adjust image brightness using centralized config bridge"""
        try:
            original_size = image.size
            from core.transformation_config import brightness_percentage_to_factor
            
            # Get parameters from central config
            brightness_params = self._get_brightness_params()
            # Get percentage value (centralized format)
            percentage = params.get('percentage', params.get('adjustment', params.get('factor', brightness_params['default'])))
            
            logger.info("operations.transformations", f"Applying brightness transformation", "brightness_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'percentage': percentage,
                'params': params
            })
            
            # Use centralized bridge function for 100% consistency
            if isinstance(percentage, (int, float)) and -50 <= percentage <= 50:
                factor = brightness_percentage_to_factor(percentage)
            else:
                # Fallback for legacy formats
                factor = percentage if percentage > 0 else 1.0
                
            enhancer = ImageEnhance.Brightness(image)
            result = enhancer.enhance(factor)
            
            logger.info("operations.transformations", f"Brightness transformation completed", "brightness_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'percentage': percentage,
                'factor': factor
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Brightness transformation failed: {str(e)}", "brightness_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_contrast(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Adjust image contrast using centralized config bridge"""
        try:
            original_size = image.size
            from core.transformation_config import contrast_percentage_to_factor
            
            # Get parameters from central config
            contrast_params = self._get_contrast_params()
            # Get percentage value (centralized format)
            percentage = params.get('percentage', params.get('adjustment', params.get('factor', contrast_params['default'])))
            
            logger.info("operations.transformations", f"Applying contrast transformation", "contrast_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'percentage': percentage,
                'params': params
            })
            
            # Use centralized bridge function for 100% consistency
            if isinstance(percentage, (int, float)) and -50 <= percentage <= 50:
                factor = contrast_percentage_to_factor(percentage)
            else:
                # Fallback for legacy formats
                factor = percentage if percentage > 0 else 1.0
                
            enhancer = ImageEnhance.Contrast(image)
            result = enhancer.enhance(factor)
            
            logger.info("operations.transformations", f"Contrast transformation completed", "contrast_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'percentage': percentage,
                'factor': factor
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Contrast transformation failed: {str(e)}", "contrast_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_blur(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply high-quality blur with specified radius"""
        try:
            original_size = image.size
            # Get parameters from central config
            blur_params = self._get_blur_params()
            blur_type = params.get('blur_type', 'gaussian')
            radius = params.get('radius', params.get('intensity', blur_params['default']))  # Support both old and new parameter names
            
            logger.info("operations.transformations", f"Applying blur transformation", "blur_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'blur_type': blur_type,
                'radius': radius,
                'params': params
            })
            
            # Convert old intensity to radius if needed
            if 'intensity' in params and 'radius' not in params:
                # Old intensity format (0.1-5.0) - convert to radius
                intensity = params.get('intensity', 1.0)
                radius = max(0.5, intensity * 2.0)
            else:
                # New radius format (0.5-20.0) - use directly
                radius = max(0.5, radius)
            
            if blur_type == 'gaussian':
                # Gaussian blur with direct radius
                result = image.filter(ImageFilter.GaussianBlur(radius=radius))
            elif blur_type == 'motion':
                # Motion blur simulation
                motion_radius = max(1, int(radius * 1.5))
                result = image.filter(ImageFilter.BoxBlur(radius=motion_radius))
            elif blur_type == 'box':
                # Box blur for different effect
                box_radius = max(1, int(radius))
                result = image.filter(ImageFilter.BoxBlur(radius=box_radius))
            else:
                # Default to Gaussian
                result = image.filter(ImageFilter.GaussianBlur(radius=radius))
            
            logger.info("operations.transformations", f"Blur transformation completed", "blur_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'blur_type': blur_type,
                'radius': radius
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Blur transformation failed: {str(e)}", "blur_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_noise(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Add noise to image with specified strength"""
        try:
            original_size = image.size
            # Get parameters from central config
            noise_params = self._get_noise_params()
            noise_type = params.get('noise_type', 'gaussian')
            strength = params.get('strength', params.get('intensity', noise_params['default']))  # Support both old and new parameter names
            
            logger.info("operations.transformations", f"Applying noise transformation", "noise_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'noise_type': noise_type,
                'strength': strength,
                'params': params
            })
            
            # Convert strength to intensity if needed
            if isinstance(strength, int) and 1 <= strength <= 50:
                # New percentage format (1-50) - convert to intensity
                intensity = strength / 1000.0  # 5% = 0.005 intensity
            else:
                # Old intensity format (0.001-0.1) for backwards compatibility
                intensity = strength
            
            # Convert to numpy array
            img_array = np.array(image).astype(np.float32)
            
            if noise_type == 'gaussian':
                # Gaussian noise
                noise = np.random.normal(0, intensity * 255, img_array.shape)
            elif noise_type == 'salt_pepper':
                # Salt and pepper noise
                noise = np.zeros_like(img_array)
                # Salt noise (white pixels)
                salt_coords = np.random.random(img_array.shape[:2]) < intensity / 2
                noise[salt_coords] = 255 - img_array[salt_coords]
                # Pepper noise (black pixels)
                pepper_coords = np.random.random(img_array.shape[:2]) < intensity / 2
                noise[pepper_coords] = -img_array[pepper_coords]
            elif noise_type == 'uniform':
                # Uniform noise
                noise = np.random.uniform(-intensity * 255, intensity * 255, img_array.shape)
            else:
                # Default to Gaussian
                noise = np.random.normal(0, intensity * 255, img_array.shape)
            
            # Add noise and clip values
            noisy_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
            result = Image.fromarray(noisy_array)
            
            logger.info("operations.transformations", f"Noise transformation completed", "noise_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'noise_type': noise_type,
                'strength': strength,
                'intensity': intensity
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Noise transformation failed: {str(e)}", "noise_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    # Advanced transformation methods
    def _apply_color_jitter(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply color jittering with improved parameter names"""
        try:
            original_size = image.size
            
            logger.info("operations.transformations", f"Applying color jitter transformation", "color_jitter_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'params': params
            })
            
            result = image
            applied_effects = []
            
            # Handle hue shift (new parameter name: hue_shift)
            hue_shift = params.get('hue_shift', params.get('hue', 0))  # Support both old and new parameter names
            
            # Convert hue shift to factor if needed
            if isinstance(hue_shift, int) and -30 <= hue_shift <= 30:
                # New degrees format (-30 to +30) - convert to factor
                hue_factor = hue_shift / 180.0  # Convert degrees to factor
            else:
                # Old factor format (-0.1 to 0.1) for backwards compatibility
                hue_factor = hue_shift
            
            if hue_factor != 0:
                logger.info("operations.transformations", f"Applying hue shift in color jitter", "color_jitter_hue", {
                    'hue_shift': hue_shift,
                    'hue_factor': hue_factor
                })
                # Convert to HSV, shift hue, convert back
                img_array = np.array(result)
                hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
                hsv[:, :, 0] = (hsv[:, :, 0] + hue_factor * 180) % 180
                rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
                result = Image.fromarray(rgb)
                applied_effects.append('hue_shift')
            
            # Handle brightness variation (new parameter name: brightness_variation)
            brightness_variation = params.get('brightness_variation', params.get('brightness', 1.0))  # Support both old and new parameter names
            
            # Convert brightness variation to factor if needed
            if isinstance(brightness_variation, int) and -20 <= brightness_variation <= 20:
                # New percentage format (-20 to +20) - convert to factor
                brightness_factor = 1.0 + (brightness_variation / 100.0)
            else:
                # Old factor format (0.8-1.2) for backwards compatibility
                brightness_factor = brightness_variation
            
            if brightness_factor != 1.0:
                logger.info("operations.transformations", f"Applying brightness variation in color jitter", "color_jitter_brightness", {
                    'brightness_variation': brightness_variation,
                    'brightness_factor': brightness_factor
                })
                enhancer = ImageEnhance.Brightness(result)
                result = enhancer.enhance(brightness_factor)
                applied_effects.append('brightness_variation')
            
            # Handle contrast variation (new parameter name: contrast_variation)
            contrast_variation = params.get('contrast_variation', params.get('contrast', 1.0))  # Support both old and new parameter names
            
            # Convert contrast variation to factor if needed
            if isinstance(contrast_variation, int) and -20 <= contrast_variation <= 20:
                # New percentage format (-20 to +20) - convert to factor
                contrast_factor = 1.0 + (contrast_variation / 100.0)
            else:
                # Old factor format (0.8-1.2) for backwards compatibility
                contrast_factor = contrast_variation
            
            if contrast_factor != 1.0:
                logger.info("operations.transformations", f"Applying contrast variation in color jitter", "color_jitter_contrast", {
                    'contrast_variation': contrast_variation,
                    'contrast_factor': contrast_factor
                })
                enhancer = ImageEnhance.Contrast(result)
                result = enhancer.enhance(contrast_factor)
                applied_effects.append('contrast_variation')
            
            # Handle saturation variation (new parameter name: saturation_variation)
            saturation_variation = params.get('saturation_variation', params.get('saturation', 1.0))  # Support both old and new parameter names
            
            # Convert saturation variation to factor if needed
            if isinstance(saturation_variation, int) and -20 <= saturation_variation <= 20:
                # New percentage format (-20 to +20) - convert to factor
                saturation_factor = 1.0 + (saturation_variation / 100.0)
            else:
                # Old factor format (0.8-1.2) for backwards compatibility
                saturation_factor = saturation_variation
            
            if saturation_factor != 1.0:
                logger.info("operations.transformations", f"Applying saturation variation in color jitter", "color_jitter_saturation", {
                    'saturation_variation': saturation_variation,
                    'saturation_factor': saturation_factor
                })
                enhancer = ImageEnhance.Color(result)
                result = enhancer.enhance(saturation_factor)
                applied_effects.append('saturation_variation')
            
            logger.info("operations.transformations", f"Color jitter transformation completed", "color_jitter_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'applied_effects': applied_effects,
                'hue_shift': hue_shift,
                'brightness_variation': brightness_variation,
                'contrast_variation': contrast_variation,
                'saturation_variation': saturation_variation
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Color jitter transformation failed: {str(e)}", "color_jitter_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_cutout(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply cutout augmentation"""
        try:
            original_size = image.size
            # Get parameters from central config
            cutout_num_holes_params = self._get_cutout_num_holes_params()
            cutout_hole_size_params = self._get_cutout_hole_size_params()
            num_holes = params.get('num_holes', cutout_num_holes_params['default'])
            hole_size = params.get('hole_size', cutout_hole_size_params['default'])
            
            logger.info("operations.transformations", f"Applying cutout transformation", "cutout_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'num_holes': num_holes,
                'hole_size': hole_size,
                'params': params
            })
            
            img_array = np.array(image)
            height, width = img_array.shape[:2]
            
            hole_positions = []
            for _ in range(num_holes):
                y = random.randint(0, height - hole_size)
                x = random.randint(0, width - hole_size)
                img_array[y:y+hole_size, x:x+hole_size] = 0
                hole_positions.append((x, y))
            
            result = Image.fromarray(img_array)
            
            logger.info("operations.transformations", f"Cutout transformation completed", "cutout_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'num_holes': num_holes,
                'hole_size': hole_size,
                'hole_positions': hole_positions
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Cutout transformation failed: {str(e)}", "cutout_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_random_zoom(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply random zoom"""
        try:
            original_size = image.size
            # Get parameters from central config
            random_zoom_params = self._get_random_zoom_params()
            zoom_factor = params.get('zoom_factor', params.get('zoom_range', random_zoom_params['default']))  # Support both old and new parameter names
            
            logger.info("operations.transformations", f"Applying random zoom transformation", "zoom_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'zoom_factor': zoom_factor,
                'params': params
            })
            
            if zoom_factor == 1.0:
                logger.info("operations.transformations", f"Random zoom skipped (zoom_factor = 1.0)", "zoom_skipped", {
                    'zoom_factor': zoom_factor,
                    'reason': 'zoom_factor = 1.0'
                })
                return image
            
            width, height = image.size
            
            if zoom_factor > 1.0:
                # Zoom in (crop and resize)
                new_width = int(width / zoom_factor)
                new_height = int(height / zoom_factor)
                left = (width - new_width) // 2
                top = (height - new_height) // 2
                cropped = image.crop((left, top, left + new_width, top + new_height))
                result = cropped.resize((width, height), Image.Resampling.LANCZOS)
                zoom_type = "zoom_in"
            else:
                # Zoom out (resize and pad)
                new_width = int(width * zoom_factor)
                new_height = int(height * zoom_factor)
                resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Create new image with original size and paste resized image in center
                new_image = Image.new('RGB', (width, height), (255, 255, 255))
                left = (width - new_width) // 2
                top = (height - new_height) // 2
                new_image.paste(resized, (left, top))
                result = new_image
                zoom_type = "zoom_out"
            
            logger.info("operations.transformations", f"Random zoom transformation completed", "zoom_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'zoom_factor': zoom_factor,
                'zoom_type': zoom_type
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Random zoom transformation failed: {str(e)}", "zoom_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_affine_transform(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply affine transformation with improved parameter names"""
        try:
            original_size = image.size
            # Get parameters from central config
            affine_params = self._get_affine_transform_params()
            
            logger.info("operations.transformations", f"Applying affine transformation", "affine_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'params': params
            })
            
            # This is a simplified implementation
            # For full affine transforms, you might want to use cv2.warpAffine
            result = image
            
            # Handle rotation (new parameter name: rotation_angle)
            rotation_angle = params.get('rotation_angle', params.get('rotate', affine_params['rotation']['default']))  # Support both old and new parameter names
            if rotation_angle != 0:
                logger.info("operations.transformations", f"Applying rotation in affine transform", "affine_rotation", {
                    'rotation_angle': rotation_angle
                })
                result = result.rotate(rotation_angle, expand=False, fillcolor=(255, 255, 255))
            
            # Handle scaling (new parameter name: scale_factor)
            scale_factor = params.get('scale_factor', params.get('scale', affine_params['scale']['default']))  # Support both old and new parameter names
            if scale_factor != 1.0:
                logger.info("operations.transformations", f"Applying scaling in affine transform", "affine_scaling", {
                    'scale_factor': scale_factor
                })
                width, height = result.size
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                result = result.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # If scaled up, crop to original size; if scaled down, pad
                if scale_factor > 1.0:
                    left = (new_width - width) // 2
                    top = (new_height - height) // 2
                    result = result.crop((left, top, left + width, top + height))
                else:
                    new_image = Image.new('RGB', (width, height), (255, 255, 255))
                    left = (width - new_width) // 2
                    top = (height - new_height) // 2
                    new_image.paste(result, (left, top))
                    result = new_image
            
            # Handle horizontal shift (new parameter name: horizontal_shift)
            horizontal_shift = params.get('horizontal_shift', params.get('shift_x', affine_params['horizontal_shift']['default']))  # Support both old and new parameter names
            
            # Convert horizontal shift to pixels if needed
            if isinstance(horizontal_shift, int) and -20 <= horizontal_shift <= 20:
                # New percentage format (-20 to +20) - convert to factor
                shift_x_factor = horizontal_shift / 100.0
            else:
                # Old factor format (-0.1 to 0.1) for backwards compatibility
                shift_x_factor = horizontal_shift
            
            # Handle vertical shift (new parameter name: vertical_shift)
            vertical_shift = params.get('vertical_shift', params.get('shift_y', affine_params['vertical_shift']['default']))  # Support both old and new parameter names
            
            # Convert vertical shift to pixels if needed
            if isinstance(vertical_shift, int) and -20 <= vertical_shift <= 20:
                # New percentage format (-20 to +20) - convert to factor
                shift_y_factor = vertical_shift / 100.0
            else:
                # Old factor format (-0.1 to 0.1) for backwards compatibility
                shift_y_factor = vertical_shift
            
            # Apply shifts if needed
            if shift_x_factor != 0 or shift_y_factor != 0:
                logger.info("operations.transformations", f"Applying shifts in affine transform", "affine_shifts", {
                    'horizontal_shift': horizontal_shift,
                    'vertical_shift': vertical_shift,
                    'shift_x_factor': shift_x_factor,
                    'shift_y_factor': shift_y_factor
                })
                width, height = result.size
                shift_x_pixels = int(width * shift_x_factor)
                shift_y_pixels = int(height * shift_y_factor)
                
                # Create new image with white background
                new_image = Image.new('RGB', (width, height), (255, 255, 255))
                
                # Calculate paste position
                paste_x = max(0, shift_x_pixels)
                paste_y = max(0, shift_y_pixels)
                
                # Calculate crop area from original image
                crop_left = max(0, -shift_x_pixels)
                crop_top = max(0, -shift_y_pixels)
                crop_right = min(width, width - shift_x_pixels)
                crop_bottom = min(height, height - shift_y_pixels)
                
                if crop_right > crop_left and crop_bottom > crop_top:
                    cropped = result.crop((crop_left, crop_top, crop_right, crop_bottom))
                    new_image.paste(cropped, (paste_x, paste_y))
                
                result = new_image
            
            logger.info("operations.transformations", f"Affine transformation completed", "affine_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'rotation_angle': rotation_angle,
                'scale_factor': scale_factor,
                'horizontal_shift': horizontal_shift,
                'vertical_shift': vertical_shift
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Affine transformation failed: {str(e)}", "affine_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_perspective_warp(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply perspective warp transformation with improved parameter name"""
        try:
            original_size = image.size
            # Get parameters from central config
            perspective_params = self._get_perspective_warp_parameters()
            distortion_strength = params.get('distortion_strength', params.get('distortion', perspective_params['default']))  # Support both old and new parameter names
            
            logger.info("operations.transformations", f"Applying perspective warp transformation", "perspective_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'distortion_strength': distortion_strength,
                'params': params
            })
            
            # Convert distortion strength to factor if needed
            if isinstance(distortion_strength, int) and 0 <= distortion_strength <= 30:
                # New percentage format (0-30) - convert to factor
                distortion = distortion_strength / 100.0
            else:
                # Old factor format (0.0-0.3) for backwards compatibility
                distortion = distortion_strength
            
            if distortion == 0:
                logger.info("operations.transformations", f"Perspective warp skipped (distortion = 0)", "perspective_skipped", {
                    'distortion': distortion,
                    'reason': 'distortion = 0'
                })
                return image
            
            # Convert to OpenCV format
            img_array = np.array(image)
            height, width = img_array.shape[:2]
            
            # Define source points (corners of the image)
            src_points = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
            
            # Define destination points with random distortion
            max_distortion = int(min(width, height) * distortion)
            dst_points = np.float32([
                [random.randint(0, max_distortion), random.randint(0, max_distortion)],
                [width - random.randint(0, max_distortion), random.randint(0, max_distortion)],
                [width - random.randint(0, max_distortion), height - random.randint(0, max_distortion)],
                [random.randint(0, max_distortion), height - random.randint(0, max_distortion)]
            ])
            
            # Apply perspective transformation
            matrix = cv2.getPerspectiveTransform(src_points, dst_points)
            warped = cv2.warpPerspective(img_array, matrix, (width, height), borderValue=(255, 255, 255))
            result = Image.fromarray(warped)
            
            logger.info("operations.transformations", f"Perspective warp transformation completed", "perspective_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'distortion_strength': distortion_strength,
                'distortion_factor': distortion,
                'max_distortion_pixels': max_distortion
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Perspective warp transformation failed: {str(e)}", "perspective_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_grayscale(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Convert image to grayscale"""
        try:
            original_size = image.size
            
            logger.info("operations.transformations", f"Applying grayscale transformation", "grayscale_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'params': params
            })
            
            result = ImageOps.grayscale(image).convert('RGB')
            
            logger.info("operations.transformations", f"Grayscale transformation completed", "grayscale_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}"
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Grayscale transformation failed: {str(e)}", "grayscale_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_shear(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply shear transformation"""
        try:
            original_size = image.size
            # Get parameters from central config
            shear_params = self._get_shear_params()
            shear_angle = params.get('shear_angle', params.get('angle', shear_params['default']))  # Support both old and new parameter names
            
            logger.info("operations.transformations", f"Applying shear transformation", "shear_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'shear_angle': shear_angle,
                'params': params
            })
            
            if shear_angle == 0:
                logger.info("operations.transformations", f"Shear transformation skipped (angle = 0)", "shear_skipped", {
                    'shear_angle': shear_angle,
                    'reason': 'angle = 0'
                })
                return image
            
            # Convert angle to radians and calculate shear factor
            shear_factor = math.tan(math.radians(shear_angle))
            
            # Convert to OpenCV format
            img_array = np.array(image)
            height, width = img_array.shape[:2]
            
            # Create shear transformation matrix
            shear_matrix = np.float32([[1, shear_factor, 0], [0, 1, 0]])
            
            # Apply shear transformation
            sheared = cv2.warpAffine(img_array, shear_matrix, (width, height), borderValue=(255, 255, 255))
            result = Image.fromarray(sheared)
            
            logger.info("operations.transformations", f"Shear transformation completed", "shear_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'shear_angle': shear_angle,
                'shear_factor': shear_factor
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Shear transformation failed: {str(e)}", "shear_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_gamma_correction(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply gamma correction"""
        try:
            original_size = image.size
            # Get parameters from central config
            gamma_params = self._get_gamma_params()
            gamma = params.get('gamma', gamma_params['default'])
            
            logger.info("operations.transformations", f"Applying gamma correction transformation", "gamma_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'gamma': gamma,
                'params': params
            })
            
            if gamma == 1.0:
                logger.info("operations.transformations", f"Gamma correction skipped (gamma = 1.0)", "gamma_skipped", {
                    'gamma': gamma,
                    'reason': 'gamma = 1.0'
                })
                return image
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Normalize to 0-1, apply gamma, then scale back to 0-255
            normalized = img_array / 255.0
            corrected = np.power(normalized, gamma)
            result_array = (corrected * 255).astype(np.uint8)
            result = Image.fromarray(result_array)
            
            logger.info("operations.transformations", f"Gamma correction transformation completed", "gamma_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'gamma': gamma
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Gamma correction transformation failed: {str(e)}", "gamma_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_equalize(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply histogram equalization"""
        try:
            original_size = image.size
            
            logger.info("operations.transformations", f"Applying equalize transformation", "equalize_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'params': params
            })
            
            result = ImageOps.equalize(image)
            
            logger.info("operations.transformations", f"Equalize transformation completed", "equalize_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}"
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Equalize transformation failed: {str(e)}", "equalize_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_clahe(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)"""
        try:
            original_size = image.size
            # Get parameters from central config
            clahe_clip_limit_params = self._get_clahe_clip_limit_params()
            clahe_grid_size_params = self._get_clahe_grid_size_params()
            clip_limit = params.get('clip_limit', clahe_clip_limit_params['default'])
            grid_size = params.get('grid_size', clahe_grid_size_params['default'])
            
            logger.info("operations.transformations", f"Applying CLAHE transformation", "clahe_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'clip_limit': clip_limit,
                'grid_size': grid_size,
                'params': params
            })
            
            # Convert to OpenCV format
            img_array = np.array(image)
            
            # Apply CLAHE to each channel
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(grid_size, grid_size))
            
            if len(img_array.shape) == 3:
                # Color image - apply to each channel
                result_channels = []
                for i in range(3):
                    channel = clahe.apply(img_array[:, :, i])
                    result_channels.append(channel)
                result_array = np.stack(result_channels, axis=2)
            else:
                # Grayscale image
                result_array = clahe.apply(img_array)
            
            result = Image.fromarray(result_array)
            
            logger.info("operations.transformations", f"CLAHE transformation completed", "clahe_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'clip_limit': clip_limit,
                'grid_size': grid_size,
                'image_channels': len(img_array.shape)
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"CLAHE transformation failed: {str(e)}", "clahe_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
