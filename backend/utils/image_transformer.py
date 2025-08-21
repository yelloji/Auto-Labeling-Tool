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
from logging_system.professional_logger import get_professional_logger
from core.transformation_config import (
    get_resize_parameters, get_rotation_parameters,
    get_brightness_parameters, get_contrast_parameters,
    get_blur_parameters, get_hue_parameters,
    get_saturation_parameters, get_gamma_parameters,
    get_shear_parameters, get_noise_parameters,
    get_clahe_clip_limit_parameters, get_clahe_grid_size_parameters,
    get_cutout_num_holes_parameters, get_cutout_hole_size_parameters,
    get_crop_parameters, get_color_jitter_parameters,
    get_random_zoom_parameters, get_affine_transform_parameters,
    get_perspective_warp_parameters
)

logger = get_professional_logger()

class ImageTransformer:
    """
    Handles all image transformation operations
    """
    
    def __init__(self):
        logger.info("operations.transformations", "Initializing ImageTransformer with transformation methods", "transformer_init", {
            'transformation_count': 18,
            'basic_transformations': ['resize', 'rotate', 'flip', 'crop', 'brightness', 'contrast', 'blur', 'noise'],
            'advanced_transformations': ['color_jitter', 'cutout', 'random_zoom', 'affine_transform', 'perspective_warp', 'grayscale', 'shear', 'gamma_correction', 'equalize', 'clahe']
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
            logger.info("operations.transformations", f"Starting image transformations", "transformations_start", {
                'transformation_count': len(config),
                'enabled_transformations': [name for name, params in config.items() if params.get('enabled', True)],
                'image_size': f"{image.size[0]}x{image.size[1]}"
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
                        logger.warning("operations.transformations", f"Failed to apply {transform_name}: {str(e)}", "transformation_failed", {
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
                'final_image_size': f"{result_image.size[0]}x{result_image.size[1]}"
            })
            
            return result_image
            
        except Exception as e:
            logger.error("errors.system", f"Error applying transformations: {str(e)}", "transformations_error", {
                'error': str(e),
                'config': config
            })
            return image
    
    def get_available_transformations(self) -> Dict[str, Dict[str, Any]]:
        """
        Get specifications for all available transformations
        
        Returns:
            Dictionary with transformation specifications
        """
        logger.info("operations.transformations", "Getting available transformations", "get_transformations", {
            'transformation_count': 18
        })
        
        return {
            'resize': {
                'name': 'Resize',
                'category': 'basic',
                'parameters': {
                    'width': {
                        'type': 'number', 
                        'min': get_resize_parameters()['width_min'], 
                        'max': get_resize_parameters()['width_max'], 
                        'default': get_resize_parameters()['width_default']
                    },
                    'height': {
                        'type': 'number', 
                        'min': get_resize_parameters()['height_min'], 
                        'max': get_resize_parameters()['height_max'], 
                        'default': get_resize_parameters()['height_default']
                    },
                    'maintain_aspect': {'type': 'boolean', 'default': True}
                }
            },
            'rotate': {
                'name': 'Rotate',
                'category': 'basic',
                'parameters': {
                    'angle_min': {
                        'type': 'number', 
                        'min': get_rotation_parameters()['min'], 
                        'max': get_rotation_parameters()['max'], 
                        'default': get_rotation_parameters()['min'] / 12
                    },
                    'angle_max': {
                        'type': 'number', 
                        'min': get_rotation_parameters()['min'], 
                        'max': get_rotation_parameters()['max'], 
                        'default': get_rotation_parameters()['max'] / 12
                    },
                    'probability': {'type': 'number', 'min': 0, 'max': 1, 'default': 0.5, 'step': 0.1}
                }
            },
            'flip': {
                'name': 'Flip',
                'category': 'basic',
                'parameters': {
                    'horizontal': {'type': 'boolean', 'default': True},
                    'vertical': {'type': 'boolean', 'default': False},
                    'h_probability': {'type': 'number', 'min': 0, 'max': 1, 'default': 0.5, 'step': 0.1},
                    'v_probability': {'type': 'number', 'min': 0, 'max': 1, 'default': 0.2, 'step': 0.1}
                }
            },
            'crop': {
                'name': 'Crop',
                'category': 'basic',
                'parameters': {
                    'scale': {
                        'type': 'float', 
                        'min': get_crop_parameters()['min'], 
                        'max': get_crop_parameters()['max'], 
                        'default': get_crop_parameters()['default']
                    }
                }
            },
            'brightness': {
                'name': 'Brightness',
                'category': 'basic',
                'parameters': {
                    'factor': {
                        'type': 'float', 
                        'min': get_brightness_parameters()['min'], 
                        'max': get_brightness_parameters()['max'], 
                        'default': get_brightness_parameters()['default']
                    }
                }
            },
            'contrast': {
                'name': 'Contrast',
                'category': 'basic',
                'parameters': {
                    'factor': {
                        'type': 'float', 
                        'min': get_contrast_parameters()['min'], 
                        'max': get_contrast_parameters()['max'], 
                        'default': get_contrast_parameters()['default']
                    }
                }
            },
            'blur': {
                'name': 'Blur',
                'category': 'basic',
                'parameters': {
                    'kernel_size': {
                        'type': 'int', 
                        'min': get_blur_parameters()['min'], 
                        'max': get_blur_parameters()['max'], 
                        'default': get_blur_parameters()['default']
                    }
                }
            },
            'noise': {
                'name': 'Noise',
                'category': 'basic',
                'parameters': {
                    'std': {
                        'type': 'float', 
                        'min': get_noise_parameters()['min'], 
                        'max': get_noise_parameters()['max'], 
                        'default': get_noise_parameters()['default']
                    }
                }
            },
            'color_jitter': {
                'name': 'Color Jitter',
                'category': 'advanced',
                'parameters': {
                    'hue': {
                        'type': 'float', 
                        'min': get_color_jitter_parameters()['hue']['min'], 
                        'max': get_color_jitter_parameters()['hue']['max'], 
                        'default': get_color_jitter_parameters()['hue']['default']
                    },
                    'brightness': {
                        'type': 'float', 
                        'min': get_color_jitter_parameters()['brightness']['min'], 
                        'max': get_color_jitter_parameters()['brightness']['max'], 
                        'default': get_color_jitter_parameters()['brightness']['default']
                    },
                    'contrast': {
                        'type': 'float', 
                        'min': get_color_jitter_parameters()['contrast']['min'], 
                        'max': get_color_jitter_parameters()['contrast']['max'], 
                        'default': get_color_jitter_parameters()['contrast']['default']
                    },
                    'saturation': {
                        'type': 'float', 
                        'min': get_color_jitter_parameters()['saturation']['min'], 
                        'max': get_color_jitter_parameters()['saturation']['max'], 
                        'default': get_color_jitter_parameters()['saturation']['default']
                    }
                }
            },
            'cutout': {
                'name': 'Cutout',
                'category': 'advanced',
                'parameters': {
                    'num_holes': {
                        'type': 'int', 
                        'min': get_cutout_num_holes_parameters()['min'], 
                        'max': get_cutout_num_holes_parameters()['max'], 
                        'default': get_cutout_num_holes_parameters()['default']
                    },
                    'hole_size': {
                        'type': 'int', 
                        'min': get_cutout_hole_size_parameters()['min'], 
                        'max': get_cutout_hole_size_parameters()['max'], 
                        'default': get_cutout_hole_size_parameters()['default']
                    }
                }
            },
            'random_zoom': {
                'name': 'Random Zoom',
                'category': 'advanced',
                'parameters': {
                    'zoom_range': {
                        'type': 'float', 
                        'min': get_random_zoom_parameters()['min'], 
                        'max': get_random_zoom_parameters()['max'], 
                        'default': get_random_zoom_parameters()['default']
                    }
                }
            },
            'affine_transform': {
                'name': 'Affine Transform',
                'category': 'advanced',
                'parameters': {
                    'scale': {
                        'type': 'float', 
                        'min': get_affine_transform_parameters()['scale']['min'], 
                        'max': get_affine_transform_parameters()['scale']['max'], 
                        'default': get_affine_transform_parameters()['scale']['default']
                    },
                    'rotate': {
                        'type': 'float', 
                        'min': get_affine_transform_parameters()['rotation']['min'], 
                        'max': get_affine_transform_parameters()['rotation']['max'], 
                        'default': get_affine_transform_parameters()['rotation']['default']
                    },
                    'shift_x': {
                        'type': 'float', 
                        'min': get_affine_transform_parameters()['horizontal_shift']['min'], 
                        'max': get_affine_transform_parameters()['horizontal_shift']['max'], 
                        'default': get_affine_transform_parameters()['horizontal_shift']['default']
                    },
                    'shift_y': {
                        'type': 'float', 
                        'min': get_affine_transform_parameters()['vertical_shift']['min'], 
                        'max': get_affine_transform_parameters()['vertical_shift']['max'], 
                        'default': get_affine_transform_parameters()['vertical_shift']['default']
                    }
                }
            },
            'perspective_warp': {
                'name': 'Perspective Warp',
                'category': 'advanced',
                'parameters': {
                    'distortion': {
                        'type': 'float', 
                        'min': get_perspective_warp_parameters()['min'], 
                        'max': get_perspective_warp_parameters()['max'], 
                        'default': get_perspective_warp_parameters()['default']
                    }
                }
            },
            'grayscale': {
                'name': 'Grayscale',
                'category': 'advanced',
                'parameters': {
                    'enabled': {'type': 'bool', 'default': False}
                }
            },
            'shear': {
                'name': 'Shear',
                'category': 'advanced',
                'parameters': {
                    'angle': {
                        'type': 'float', 
                        'min': get_shear_parameters()['min'], 
                        'max': get_shear_parameters()['max'], 
                        'default': get_shear_parameters()['default']
                    }
                }
            },
            'gamma_correction': {
                'name': 'Gamma Correction',
                'category': 'advanced',
                'parameters': {
                    'gamma': {
                        'type': 'float', 
                        'min': get_gamma_parameters()['min'], 
                        'max': get_gamma_parameters()['max'], 
                        'default': get_gamma_parameters()['default']
                    }
                }
            },
            'equalize': {
                'name': 'Equalize',
                'category': 'advanced',
                'parameters': {
                    'enabled': {'type': 'bool', 'default': False}
                }
            },
            'clahe': {
                'name': 'CLAHE',
                'category': 'advanced',
                'parameters': {
                    'clip_limit': {
                        'type': 'float', 
                        'min': get_clahe_clip_limit_parameters()['min'], 
                        'max': get_clahe_clip_limit_parameters()['max'], 
                        'default': get_clahe_clip_limit_parameters()['default']
                    },
                    'grid_size': {
                        'type': 'int', 
                        'min': get_clahe_grid_size_parameters()['min'], 
                        'max': get_clahe_grid_size_parameters()['max'], 
                        'default': get_clahe_grid_size_parameters()['default']
                    }
                }
            }
        }
    
    # Basic transformation methods
    def _apply_resize(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Resize image to specified dimensions"""
        try:
            original_size = image.size
            # Get parameters from central config
            resize_params = get_resize_parameters()
            width = params.get('width', resize_params['width_default'])
            height = params.get('height', resize_params['height_default'])
            
            logger.info("operations.transformations", f"Applying resize transformation", "resize_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'target_size': f"{width}x{height}",
                'resampling_method': 'LANCZOS',
                'params': params
            })
            
            result = image.resize((width, height), Image.Resampling.LANCZOS)
            
            logger.info("operations.transformations", f"Resize transformation completed", "resize_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
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
        """Rotate image by specified angle with range and probability support"""
        try:
            original_size = image.size
            # Get parameters from central config
            rotation_params = get_rotation_parameters()
            angle_min = params.get('angle_min', -15)
            angle_max = params.get('angle_max', 15)
            probability = params.get('probability', 0.5)
            
            # Check probability first
            if random.random() >= probability:
                logger.info("operations.transformations", f"Rotate transformation skipped due to probability", "rotate_skipped", {
                    'probability': probability,
                    'random_value': random.random()
                })
                return image
            
            # Generate random angle within range
            angle = random.uniform(angle_min, angle_max)
            
            logger.info("operations.transformations", f"Applying rotate transformation", "rotate_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'angle_min': angle_min,
                'angle_max': angle_max,
                'generated_angle': angle,
                'probability': probability,
                'expand': True,
                'fillcolor': '(255, 255, 255)',
                'params': params
            })
            
            result = image.rotate(angle, expand=True, fillcolor=(255, 255, 255))
            
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
        """Flip image horizontally and/or vertically with probability support"""
        try:
            original_size = image.size
            # Get parameters from central config (flip uses probability-based defaults)
            horizontal = params.get('horizontal', True)  # Match frontend default
            vertical = params.get('vertical', False)
            h_probability = params.get('h_probability', 0.5)
            v_probability = params.get('v_probability', 0.2)
            
            logger.info("operations.transformations", f"Applying flip transformation", "flip_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'horizontal_flip': horizontal,
                'vertical_flip': vertical,
                'h_probability': h_probability,
                'v_probability': v_probability,
                'params': params
            })
            
            result = image
            
            # Apply horizontal flip with probability
            if horizontal and random.random() < h_probability:
                result = result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                logger.info("operations.transformations", f"Applied horizontal flip", "flip_horizontal", {
                    'probability': h_probability,
                    'applied': True
                })
            
            # Apply vertical flip with probability
            if vertical and random.random() < v_probability:
                result = result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                logger.info("operations.transformations", f"Applied vertical flip", "flip_vertical", {
                    'probability': v_probability,
                    'applied': True
                })
            
            logger.info("operations.transformations", f"Flip transformation completed", "flip_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'horizontal_flip': horizontal,
                'vertical_flip': vertical,
                'h_probability': h_probability,
                'v_probability': v_probability
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
        """Apply random crop with specified scale"""
        try:
            original_size = image.size
            # Get parameters from central config
            crop_params = get_crop_parameters()
            scale = params.get('scale', crop_params['default'])
            
            logger.info("operations.transformations", f"Applying crop transformation", "crop_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'scale': scale,
                'params': params
            })
            
            if scale >= 1.0:
                logger.info("operations.transformations", f"Crop transformation skipped (scale >= 1.0)", "crop_skipped", {
                    'scale': scale,
                    'reason': 'scale >= 1.0'
                })
                return image
            
            width, height = image.size
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            left = random.randint(0, width - new_width)
            top = random.randint(0, height - new_height)
            
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
        """Adjust image brightness"""
        try:
            original_size = image.size
            # Get parameters from central config
            brightness_params = get_brightness_parameters()
            factor = params.get('factor', 1.0)  # Keep 1.0 as default since brightness uses percentage conversion
            
            logger.info("operations.transformations", f"Applying brightness transformation", "brightness_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'factor': factor,
                'params': params
            })
            
            enhancer = ImageEnhance.Brightness(image)
            result = enhancer.enhance(factor)
            
            logger.info("operations.transformations", f"Brightness transformation completed", "brightness_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
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
        """Adjust image contrast"""
        try:
            original_size = image.size
            # Get parameters from central config
            contrast_params = get_contrast_parameters()
            factor = params.get('factor', 1.0)  # Keep 1.0 as default since contrast uses percentage conversion
            
            logger.info("operations.transformations", f"Applying contrast transformation", "contrast_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'factor': factor,
                'params': params
            })
            
            enhancer = ImageEnhance.Contrast(image)
            result = enhancer.enhance(factor)
            
            logger.info("operations.transformations", f"Contrast transformation completed", "contrast_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
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
        """Apply Gaussian blur"""
        try:
            original_size = image.size
            # Get parameters from central config
            blur_params = get_blur_parameters()
            kernel_size = params.get('kernel_size', 3)  # Keep 3 as default for kernel size
            radius = kernel_size / 2
            
            logger.info("operations.transformations", f"Applying blur transformation", "blur_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'kernel_size': kernel_size,
                'radius': radius,
                'params': params
            })
            
            result = image.filter(ImageFilter.GaussianBlur(radius=radius))
            
            logger.info("operations.transformations", f"Blur transformation completed", "blur_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'kernel_size': kernel_size,
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
        """Add Gaussian noise to image"""
        try:
            original_size = image.size
            # Get parameters from central config
            noise_params = get_noise_parameters()
            std = params.get('std', noise_params['default'])
            
            logger.info("operations.transformations", f"Applying noise transformation", "noise_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'std': std,
                'params': params
            })
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Generate noise
            noise = np.random.normal(0, std * 255, img_array.shape)
            
            # Add noise and clip values
            noisy_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
            result = Image.fromarray(noisy_array)
            
            logger.info("operations.transformations", f"Noise transformation completed", "noise_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'std': std
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
        """Apply color jittering"""
        try:
            original_size = image.size
            # Get parameters from central config
            color_jitter_params = get_color_jitter_parameters()
            
            logger.info("operations.transformations", f"Applying color jitter transformation", "color_jitter_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'params': params
            })
            
            result = image
            applied_effects = []
            
            # Apply brightness
            brightness_factor = params.get('brightness', color_jitter_params['brightness']['default'])
            if brightness_factor != 1.0:
                enhancer = ImageEnhance.Brightness(result)
                result = enhancer.enhance(brightness_factor)
                applied_effects.append(f"brightness({brightness_factor})")
            
            # Apply contrast
            contrast_factor = params.get('contrast', color_jitter_params['contrast']['default'])
            if contrast_factor != 1.0:
                enhancer = ImageEnhance.Contrast(result)
                result = enhancer.enhance(contrast_factor)
                applied_effects.append(f"contrast({contrast_factor})")
            
            # Apply saturation
            saturation_factor = params.get('saturation', color_jitter_params['saturation']['default'])
            if saturation_factor != 1.0:
                enhancer = ImageEnhance.Color(result)
                result = enhancer.enhance(saturation_factor)
                applied_effects.append(f"saturation({saturation_factor})")
            
            # Apply hue shift (simplified implementation)
            hue_shift = params.get('hue', color_jitter_params['hue']['default'])
            if hue_shift != 0:
                # Convert to HSV, shift hue, convert back
                img_array = np.array(result)
                hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
                hsv[:, :, 0] = (hsv[:, :, 0] + hue_shift * 180) % 180
                rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
                result = Image.fromarray(rgb)
                applied_effects.append(f"hue({hue_shift})")
            
            logger.info("operations.transformations", f"Color jitter transformation completed", "color_jitter_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'applied_effects': applied_effects,
                'brightness_factor': brightness_factor,
                'contrast_factor': contrast_factor,
                'saturation_factor': saturation_factor,
                'hue_shift': hue_shift
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
            cutout_num_holes_params = get_cutout_num_holes_parameters()
            cutout_hole_size_params = get_cutout_hole_size_parameters()
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
            
            for i in range(num_holes):
                y = random.randint(0, height - hole_size)
                x = random.randint(0, width - hole_size)
                img_array[y:y+hole_size, x:x+hole_size] = 0
                hole_positions.append(f"({x},{y})")
            
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
            random_zoom_params = get_random_zoom_parameters()
            zoom_range = params.get('zoom_range', random_zoom_params['default'])
            
            logger.info("operations.transformations", f"Applying random zoom transformation", "random_zoom_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'zoom_range': zoom_range,
                'params': params
            })
            
            if zoom_range == 1.0:
                logger.info("operations.transformations", f"Random zoom transformation skipped (zoom_range == 1.0)", "random_zoom_skipped", {
                    'zoom_range': zoom_range,
                    'reason': 'zoom_range == 1.0'
                })
                return image
            
            width, height = image.size
            
            if zoom_range > 1.0:
                # Zoom in (crop and resize)
                new_width = int(width / zoom_range)
                new_height = int(height / zoom_range)
                left = (width - new_width) // 2
                top = (height - new_height) // 2
                cropped = image.crop((left, top, left + new_width, top + new_height))
                result = cropped.resize((width, height), Image.Resampling.LANCZOS)
                zoom_type = "zoom_in"
            else:
                # Zoom out (resize and pad)
                new_width = int(width * zoom_range)
                new_height = int(height * zoom_range)
                resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
                # Create new image with original size and paste resized image in center
                new_image = Image.new('RGB', (width, height), (255, 255, 255))
                left = (width - new_width) // 2
                top = (height - new_height) // 2
                new_image.paste(resized, (left, top))
                result = new_image
                zoom_type = "zoom_out"
            
            logger.info("operations.transformations", f"Random zoom transformation completed", "random_zoom_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'zoom_range': zoom_range,
                'zoom_type': zoom_type
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Random zoom transformation failed: {str(e)}", "random_zoom_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_affine_transform(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply affine transformation"""
        try:
            original_size = image.size
            # Get parameters from central config
            affine_params = get_affine_transform_parameters()
            
            logger.info("operations.transformations", f"Applying affine transform", "affine_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'params': params
            })
            
            # This is a simplified implementation
            # For full affine transforms, you might want to use cv2.warpAffine
            result = image
            applied_operations = []
            
            # Apply rotation
            rotate_angle = params.get('rotate', affine_params['rotation']['default'])
            if rotate_angle != 0:
                result = result.rotate(rotate_angle, expand=False, fillcolor=(255, 255, 255))
                applied_operations.append(f"rotation({rotate_angle}°)")
            
            # Apply scaling
            scale_factor = params.get('scale', affine_params['scale']['default'])
            if scale_factor != 1.0:
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
                applied_operations.append(f"scaling({scale_factor}x)")
            
            logger.info("operations.transformations", f"Affine transform completed", "affine_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'applied_operations': applied_operations,
                'rotate_angle': rotate_angle,
                'scale_factor': scale_factor
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Affine transform failed: {str(e)}", "affine_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_perspective_warp(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply perspective warp transformation"""
        try:
            original_size = image.size
            # Get parameters from central config
            perspective_params = get_perspective_warp_parameters()
            distortion = params.get('distortion', perspective_params['default'])
            
            logger.info("operations.transformations", f"Applying perspective warp transformation", "perspective_warp_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'distortion': distortion,
                'params': params
            })
            
            if distortion == 0:
                logger.info("operations.transformations", f"Perspective warp transformation skipped (distortion == 0)", "perspective_warp_skipped", {
                    'distortion': distortion,
                    'reason': 'distortion == 0'
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
            
            logger.info("operations.transformations", f"Perspective warp parameters calculated", "perspective_warp_params", {
                'max_distortion': max_distortion,
                'src_points': src_points.tolist(),
                'dst_points': dst_points.tolist()
            })
            
            # Apply perspective transformation
            matrix = cv2.getPerspectiveTransform(src_points, dst_points)
            warped = cv2.warpPerspective(img_array, matrix, (width, height), borderValue=(255, 255, 255))
            result = Image.fromarray(warped)
            
            logger.info("operations.transformations", f"Perspective warp transformation completed", "perspective_warp_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'distortion': distortion,
                'max_distortion': max_distortion
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Perspective warp transformation failed: {str(e)}", "perspective_warp_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_grayscale(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Convert image to grayscale"""
        try:
            original_size = image.size
            enabled = params.get('enabled', False)
            
            logger.info("operations.transformations", f"Applying grayscale transformation", "grayscale_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'enabled': enabled,
                'params': params
            })
            
            if enabled:
                result = ImageOps.grayscale(image).convert('RGB')
                logger.info("operations.transformations", f"Grayscale transformation completed", "grayscale_success", {
                    'original_size': f"{original_size[0]}x{original_size[1]}",
                    'final_size': f"{result.size[0]}x{result.size[1]}",
                    'enabled': enabled
                })
                return result
            else:
                logger.info("operations.transformations", f"Grayscale transformation skipped (disabled)", "grayscale_skipped", {
                    'enabled': enabled,
                    'reason': 'disabled'
                })
                return image
                
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
            shear_params = get_shear_parameters()
            angle = params.get('angle', shear_params['default'])
            
            logger.info("operations.transformations", f"Applying shear transformation", "shear_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'angle': angle,
                'params': params
            })
            
            if angle == 0:
                logger.info("operations.transformations", f"Shear transformation skipped (angle == 0)", "shear_skipped", {
                    'angle': angle,
                    'reason': 'angle == 0'
                })
                return image
            
            # Convert angle to radians and calculate shear factor
            shear_factor = math.tan(math.radians(angle))
            
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
                'angle': angle,
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
            gamma_params = get_gamma_parameters()
            gamma = params.get('gamma', gamma_params['default'])
            
            logger.info("operations.transformations", f"Applying gamma correction transformation", "gamma_correction_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'gamma': gamma,
                'params': params
            })
            
            if gamma == 1.0:
                logger.info("operations.transformations", f"Gamma correction transformation skipped (gamma == 1.0)", "gamma_correction_skipped", {
                    'gamma': gamma,
                    'reason': 'gamma == 1.0'
                })
                return image
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Normalize to 0-1, apply gamma, then scale back to 0-255
            normalized = img_array / 255.0
            corrected = np.power(normalized, gamma)
            result_array = (corrected * 255).astype(np.uint8)
            result = Image.fromarray(result_array)
            
            logger.info("operations.transformations", f"Gamma correction transformation completed", "gamma_correction_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'gamma': gamma
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Gamma correction transformation failed: {str(e)}", "gamma_correction_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise
    
    def _apply_equalize(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply histogram equalization"""
        try:
            original_size = image.size
            enabled = params.get('enabled', False)
            
            logger.info("operations.transformations", f"Applying equalize transformation", "equalize_start", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'enabled': enabled,
                'params': params
            })
            
            if enabled:
                result = ImageOps.equalize(image)
                logger.info("operations.transformations", f"Equalize transformation completed", "equalize_success", {
                    'original_size': f"{original_size[0]}x{original_size[1]}",
                    'final_size': f"{result.size[0]}x{result.size[1]}",
                    'enabled': enabled
                })
                return result
            else:
                logger.info("operations.transformations", f"Equalize transformation skipped (disabled)", "equalize_skipped", {
                    'enabled': enabled,
                    'reason': 'disabled'
                })
                return image
                
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
            clahe_clip_limit_params = get_clahe_clip_limit_parameters()
            clahe_grid_size_params = get_clahe_grid_size_parameters()
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
                image_type = "color"
            else:
                # Grayscale image
                result_array = clahe.apply(img_array)
                image_type = "grayscale"
            
            result = Image.fromarray(result_array)
            
            logger.info("operations.transformations", f"CLAHE transformation completed", "clahe_success", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'final_size': f"{result.size[0]}x{result.size[1]}",
                'clip_limit': clip_limit,
                'grid_size': grid_size,
                'image_type': image_type
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"CLAHE transformation failed: {str(e)}", "clahe_error", {
                'error': str(e),
                'params': params,
                'original_size': f"{image.size[0]}x{image.size[1]}"
            })
            raise


    
    # ==================== NEW UI ENHANCEMENT METHODS ====================
    
    def get_transformation_presets(self) -> Dict[str, Dict[str, Any]]:
        """
        Get predefined transformation presets for the new UI
        """
        try:
            logger.info("operations.transformations", "Getting transformation presets", "get_transformation_presets", {
                'preset_count': 3,
                'preset_names': ['light', 'medium', 'heavy']
            })
            
            # Get central config parameters for presets
            rotation_params = get_rotation_parameters()
            brightness_params = get_brightness_parameters()
            contrast_params = get_contrast_parameters()
            blur_params = get_blur_parameters()
            noise_params = get_noise_parameters()
            crop_params = get_crop_parameters()
            color_jitter_params = get_color_jitter_parameters()
            cutout_num_holes_params = get_cutout_num_holes_parameters()
            cutout_hole_size_params = get_cutout_hole_size_parameters()
            
            presets = {
            "light": {
                "name": "Light Augmentation",
                "description": "Minimal transformations for high-quality datasets",
                "transformations": {
                    "rotate": {"enabled": True, "angle": rotation_params['min'] / 6},
                    "flip": {"enabled": True, "horizontal": True, "vertical": False},
                    "brightness": {"enabled": True, "factor": brightness_params['min'] + (brightness_params['max'] - brightness_params['min']) * 0.1},
                    "contrast": {"enabled": True, "factor": contrast_params['min'] + (contrast_params['max'] - contrast_params['min']) * 0.1}
                }
            },
            "medium": {
                "name": "Medium Augmentation", 
                "description": "Balanced transformations for most use cases",
                "transformations": {
                    "rotate": {"enabled": True, "angle": rotation_params['min'] / 2},
                    "flip": {"enabled": True, "horizontal": True, "vertical": False},
                    "brightness": {"enabled": True, "factor": brightness_params['min'] + (brightness_params['max'] - brightness_params['min']) * 0.2},
                    "contrast": {"enabled": True, "factor": contrast_params['min'] + (contrast_params['max'] - contrast_params['min']) * 0.2},
                    "blur": {"enabled": True, "kernel_size": blur_params['min'] + (blur_params['max'] - blur_params['min']) * 0.3},
                    "noise": {"enabled": True, "std": noise_params['min'] + (noise_params['max'] - noise_params['min']) * 0.2},
                    "crop": {"enabled": True, "scale": crop_params['min'] + (crop_params['max'] - crop_params['min']) * 0.2}
                }
            },
            "heavy": {
                "name": "Heavy Augmentation",
                "description": "Aggressive transformations for maximum diversity",
                "transformations": {
                    "rotate": {"enabled": True, "angle": rotation_params['min']},
                    "flip": {"enabled": True, "horizontal": True, "vertical": True},
                    "brightness": {"enabled": True, "factor": brightness_params['min'] + (brightness_params['max'] - brightness_params['min']) * 0.4},
                    "contrast": {"enabled": True, "factor": contrast_params['min'] + (contrast_params['max'] - contrast_params['min']) * 0.4},
                    "blur": {"enabled": True, "kernel_size": blur_params['min'] + (blur_params['max'] - blur_params['min']) * 0.6},
                    "noise": {"enabled": True, "std": noise_params['min'] + (noise_params['max'] - noise_params['min']) * 0.4},
                    "crop": {"enabled": True, "scale": crop_params['min'] + (crop_params['max'] - crop_params['min']) * 0.4},
                    "color_jitter": {"enabled": True, "hue": color_jitter_params['hue']['max'], "brightness": color_jitter_params['brightness']['max'], "contrast": color_jitter_params['contrast']['max'], "saturation": color_jitter_params['saturation']['max']},
                    "cutout": {"enabled": True, "num_holes": cutout_num_holes_params['min'] + 1, "hole_size": cutout_hole_size_params['min'] + (cutout_hole_size_params['max'] - cutout_hole_size_params['min']) * 0.5}
                }
            }
        }
            
            logger.info("operations.transformations", "Transformation presets generated successfully", "transformation_presets_complete", {
                'preset_count': len(presets),
                'preset_names': list(presets.keys()),
                'total_transformations': sum(len(preset['transformations']) for preset in presets.values())
            })
            
            return presets
            
        except Exception as e:
            logger.error("errors.system", f"Failed to generate transformation presets: {str(e)}", "transformation_presets_error", {
                'error': str(e)
            })
            raise
    
    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate transformation configuration
        
        Args:
            config: Transformation configuration dictionary
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Get central config parameters for validation
        resize_params = get_resize_parameters()
        rotation_params = get_rotation_parameters()
        brightness_params = get_brightness_parameters()
        contrast_params = get_contrast_parameters()
        blur_params = get_blur_parameters()
        noise_params = get_noise_parameters()
        crop_params = get_crop_parameters()
        cutout_num_holes_params = get_cutout_num_holes_parameters()
        cutout_hole_size_params = get_cutout_hole_size_parameters()
        gamma_params = get_gamma_parameters()
        
        try:
            for transform_name, params in config.items():
                if transform_name not in self.transformation_methods:
                    errors.append(f"Unknown transformation: {transform_name}")
                    continue
                
                # Validate specific parameters based on transformation type
                if transform_name == "resize":
                    width = params.get("width", resize_params['width_default'])
                    height = params.get("height", resize_params['height_default'])
                    if not (resize_params['width_min'] <= width <= resize_params['width_max']) or not (resize_params['height_min'] <= height <= resize_params['height_max']):
                        errors.append(f"Resize dimensions must be between {resize_params['width_min']}-{resize_params['width_max']} and {resize_params['height_min']}-{resize_params['height_max']}")
                
                elif transform_name == "rotate":
                    angle = params.get("angle", rotation_params['default'])
                    if not (rotation_params['min'] <= angle <= rotation_params['max']):
                        errors.append(f"Rotation angle must be between {rotation_params['min']} and {rotation_params['max']} degrees")
                
                elif transform_name == "brightness":
                    factor = params.get("factor", brightness_params['default'])
                    if not (brightness_params['min'] <= factor <= brightness_params['max']):
                        errors.append(f"Brightness factor must be between {brightness_params['min']} and {brightness_params['max']}")
                
                elif transform_name == "contrast":
                    factor = params.get("factor", contrast_params['default'])
                    if not (contrast_params['min'] <= factor <= contrast_params['max']):
                        errors.append(f"Contrast factor must be between {contrast_params['min']} and {contrast_params['max']}")
                
                elif transform_name == "blur":
                    kernel_size = params.get("kernel_size", blur_params['default'])
                    if kernel_size % 2 == 0 or not (blur_params['min'] <= kernel_size <= blur_params['max']):
                        errors.append(f"Blur kernel size must be odd and between {blur_params['min']} and {blur_params['max']}")
                
                elif transform_name == "noise":
                    std = params.get("std", noise_params['default'])
                    if not (noise_params['min'] <= std <= noise_params['max']):
                        errors.append(f"Noise standard deviation must be between {noise_params['min']} and {noise_params['max']}")
                
                elif transform_name == "crop":
                    scale = params.get("scale", crop_params['default'])
                    if not (crop_params['min'] <= scale <= crop_params['max']):
                        errors.append(f"Crop scale must be between {crop_params['min']} and {crop_params['max']}")
                
                elif transform_name == "cutout":
                    num_holes = params.get("num_holes", cutout_num_holes_params['default'])
                    hole_size = params.get("hole_size", cutout_hole_size_params['default'])
                    if not (cutout_num_holes_params['min'] <= num_holes <= cutout_num_holes_params['max']):
                        errors.append(f"Number of cutout holes must be between {cutout_num_holes_params['min']} and {cutout_num_holes_params['max']}")
                    if not (cutout_hole_size_params['min'] <= hole_size <= cutout_hole_size_params['max']):
                        errors.append(f"Cutout hole size must be between {cutout_hole_size_params['min']} and {cutout_hole_size_params['max']}")
                
                elif transform_name == "gamma_correction":
                    gamma = params.get("gamma", gamma_params['default'])
                    if not (gamma_params['min'] <= gamma <= gamma_params['max']):
                        errors.append(f"Gamma value must be between {gamma_params['min']} and {gamma_params['max']}")
        
        except Exception as e:
            errors.append(f"Configuration validation error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def get_config_warnings(self, config: Dict[str, Any]) -> List[str]:
        """
        Get warnings for transformation configuration
        
        Args:
            config: Transformation configuration dictionary
            
        Returns:
            List of warning messages
        """
        logger.info("operations.transformations", "Getting configuration warnings", "get_config_warnings", {
            'config_keys': list(config.keys()),
            'enabled_transformations': [name for name, params in config.items() if params.get('enabled', True)]
        })
        
        warnings = []
        
        try:
            # Check for potentially conflicting transformations
            if config.get("grayscale", {}).get("enabled") and config.get("color_jitter", {}).get("enabled"):
                warnings.append("Grayscale and color jitter are both enabled - color effects will be lost")
            
            # Check for extreme values
            if config.get("brightness", {}).get("factor", 1.0) > 2.0:
                warnings.append("Very high brightness factor may cause image washout")
            
            if config.get("contrast", {}).get("factor", 1.0) > 2.0:
                warnings.append("Very high contrast factor may cause detail loss")
            
            if config.get("noise", {}).get("std", 0.01) > 0.1:
                warnings.append("High noise level may significantly degrade image quality")
            
            if config.get("blur", {}).get("kernel_size", 3) > 9:
                warnings.append("Large blur kernel may remove important details")
            
            # Check for too many transformations
            enabled_count = sum(1 for params in config.values() if params.get("enabled", True))
            if enabled_count > 8:
                warnings.append("Many transformations enabled - consider reducing for better performance")
            
            logger.info("operations.transformations", "Configuration warnings generated", "config_warnings_complete", {
                'warning_count': len(warnings),
                'warnings': warnings,
                'enabled_count': enabled_count
            })
            
        except Exception as e:
            warnings.append(f"Warning check error: {str(e)}")
            logger.error("errors.system", f"Configuration warning check failed: {str(e)}", "config_warnings_error", {
                'error': str(e),
                'config_keys': list(config.keys())
            })
        
        return warnings
    
    def load_image(self, image_path: str) -> Optional[Image.Image]:
        """
        Load image from file path
        
        Args:
            image_path: Path to image file
            
        Returns:
            PIL Image or None if loading fails
        """
        try:
            image = Image.open(image_path)
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            return image
        except Exception as e:
            logger.error("errors.system", f"Failed to load image {image_path}: {str(e)}", "load_image_error", {
                'image_path': str(image_path),
                'error': str(e)
            })
            return None
    
    def save_image(self, image: Image.Image, output_path: str, quality: int = 95) -> bool:
        """
        Save image to file
        
        Args:
            image: PIL Image to save
            output_path: Output file path
            quality: JPEG quality (if saving as JPEG)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if output_path.lower().endswith('.jpg') or output_path.lower().endswith('.jpeg'):
                image.save(output_path, 'JPEG', quality=quality)
            else:
                image.save(output_path)
            return True
        except Exception as e:
            logger.error("errors.system", f"Failed to save image {output_path}: {str(e)}", "save_image_error", {
                'output_path': output_path,
                'error': str(e),
                'quality': quality
            })
            return False
    
    def get_image_info(self, image: Image.Image) -> Dict[str, Any]:
        """
        Get information about an image
        
        Args:
            image: PIL Image
            
        Returns:
            Dictionary with image information
        """
        try:
            logger.info("operations.transformations", "Getting image information", "get_image_info", {
                'image_size': f"{image.width}x{image.height}",
                'image_mode': image.mode,
                'image_format': image.format
            })
            
            info = {
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "format": image.format,
                "size_bytes": len(image.tobytes()) if hasattr(image, 'tobytes') else 0
            }
            
            logger.info("operations.transformations", "Image information retrieved successfully", "get_image_info_complete", {
                'image_info': info
            })
            
            return info
            
        except Exception as e:
            logger.error("errors.system", f"Failed to get image information: {str(e)}", "get_image_info_error", {
                'error': str(e),
                'image_size': f"{image.width}x{image.height}" if hasattr(image, 'width') else 'unknown'
            })
            raise
    
    def create_preview_image(self, image: Image.Image, max_size: int = 400) -> Image.Image:
        """
        Create a preview-sized version of an image
        
        Args:
            image: Original PIL Image
            max_size: Maximum dimension for preview
            
        Returns:
            Resized PIL Image for preview
        """
        try:
            original_size = image.size
            
            logger.info("operations.transformations", "Creating preview image", "create_preview_image", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'max_size': max_size
            })
            
            # Calculate new dimensions maintaining aspect ratio
            width, height = image.size
            if width > height:
                new_width = min(width, max_size)
                new_height = int(height * (new_width / width))
            else:
                new_height = min(height, max_size)
                new_width = int(width * (new_height / height))
            
            result = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            logger.info("operations.transformations", "Preview image created successfully", "create_preview_image_complete", {
                'original_size': f"{original_size[0]}x{original_size[1]}",
                'preview_size': f"{result.size[0]}x{result.size[1]}",
                'scale_factor': f"{result.size[0]/original_size[0]:.2f}x"
            })
            
            return result
            
        except Exception as e:
            logger.error("errors.system", f"Failed to create preview image: {str(e)}", "create_preview_image_error", {
                'error': str(e),
                'original_size': f"{image.size[0]}x{image.size[1]}" if hasattr(image, 'size') else 'unknown',
                'max_size': max_size
            })
            raise
    
    def batch_apply_transformations(self, images: List[Image.Image], config: Dict[str, Any]) -> List[Image.Image]:
        """
        Apply transformations to a batch of images
        
        Args:
            images: List of PIL Images
            config: Transformation configuration
            
        Returns:
            List of transformed PIL Images
        """
        try:
            logger.info("operations.transformations", "Starting batch transformation", "batch_apply_transformations", {
                'image_count': len(images),
                'config_keys': list(config.keys()),
                'enabled_transformations': [name for name, params in config.items() if params.get('enabled', True)]
            })
            
            results = []
            successful_transforms = 0
            failed_transforms = 0
            
            for i, image in enumerate(images):
                try:
                    logger.info("operations.transformations", f"Processing image {i+1}/{len(images)}", "batch_image_process", {
                        'image_index': i,
                        'image_size': f"{image.size[0]}x{image.size[1]}",
                        'total_images': len(images)
                    })
                    
                    transformed = self.apply_transformations(image, config)
                    results.append(transformed)
                    successful_transforms += 1
                    
                except Exception as e:
                    logger.error("errors.system", f"Failed to transform image {i+1} in batch: {str(e)}", "batch_transform_error", {
                        'error': str(e),
                        'image_index': i,
                        'total_images': len(images)
                    })
                    results.append(image)  # Return original on failure
                    failed_transforms += 1
            
            logger.info("operations.transformations", "Batch transformation completed", "batch_apply_transformations_complete", {
                'total_images': len(images),
                'successful_transforms': successful_transforms,
                'failed_transforms': failed_transforms,
                'success_rate': f"{successful_transforms/len(images)*100:.1f}%"
            })
            
            return results
            
        except Exception as e:
            logger.error("errors.system", f"Batch transformation failed: {str(e)}", "batch_apply_transformations_error", {
                'error': str(e),
                'image_count': len(images)
            })
            raise

