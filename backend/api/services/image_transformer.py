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
import logging

logger = logging.getLogger(__name__)

class ImageTransformer:
    """
    Handles all image transformation operations
    """
    
    def __init__(self):
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
            result_image = image.copy()
            
            # Apply transformations in order
            for transform_name, params in config.items():
                if transform_name in self.transformation_methods and params.get('enabled', True):
                    try:
                        result_image = self.transformation_methods[transform_name](result_image, params)
                    except Exception as e:
                        logger.warning(f"Failed to apply {transform_name}: {str(e)}")
                        continue
            
            return result_image
            
        except Exception as e:
            logger.error(f"Error applying transformations: {str(e)}")
            return image
    
    def get_available_transformations(self) -> Dict[str, Dict[str, Any]]:
        """
        Get specifications for all available transformations
        
        Returns:
            Dictionary with transformation specifications
        """
        return {
            'resize': {
                'name': 'Resize',
                'category': 'basic',
                'parameters': {
                    'width': {'type': 'int', 'min': 64, 'max': 2048, 'default': 640},
                    'height': {'type': 'int', 'min': 64, 'max': 2048, 'default': 640}
                }
            },
            'rotate': {
                'name': 'Rotate',
                'category': 'basic',
                'parameters': {
                    'angle': {'type': 'float', 'min': -15, 'max': 15, 'default': 0}
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
                    'scale': {'type': 'float', 'min': 0.8, 'max': 1.0, 'default': 1.0}
                }
            },
            'brightness': {
                'name': 'Brightness',
                'category': 'basic',
                'parameters': {
                    'factor': {'type': 'float', 'min': 0.8, 'max': 1.2, 'default': 1.0}
                }
            },
            'contrast': {
                'name': 'Contrast',
                'category': 'basic',
                'parameters': {
                    'factor': {'type': 'float', 'min': 0.8, 'max': 1.2, 'default': 1.0}
                }
            },
            'blur': {
                'name': 'Blur',
                'category': 'basic',
                'parameters': {
                    'kernel_size': {'type': 'int', 'min': 3, 'max': 7, 'default': 3}
                }
            },
            'noise': {
                'name': 'Noise',
                'category': 'basic',
                'parameters': {
                    'std': {'type': 'float', 'min': 0.01, 'max': 0.05, 'default': 0.01}
                }
            },
            'color_jitter': {
                'name': 'Color Jitter',
                'category': 'advanced',
                'parameters': {
                    'hue': {'type': 'float', 'min': -0.1, 'max': 0.1, 'default': 0},
                    'brightness': {'type': 'float', 'min': 0.8, 'max': 1.2, 'default': 1.0},
                    'contrast': {'type': 'float', 'min': 0.8, 'max': 1.2, 'default': 1.0},
                    'saturation': {'type': 'float', 'min': 0.8, 'max': 1.2, 'default': 1.0}
                }
            },
            'cutout': {
                'name': 'Cutout',
                'category': 'advanced',
                'parameters': {
                    'num_holes': {'type': 'int', 'min': 1, 'max': 5, 'default': 1},
                    'hole_size': {'type': 'int', 'min': 16, 'max': 64, 'default': 32}
                }
            },
            'random_zoom': {
                'name': 'Random Zoom',
                'category': 'advanced',
                'parameters': {
                    'zoom_range': {'type': 'float', 'min': 0.9, 'max': 1.1, 'default': 1.0}
                }
            },
            'affine_transform': {
                'name': 'Affine Transform',
                'category': 'advanced',
                'parameters': {
                    'scale': {'type': 'float', 'min': 0.9, 'max': 1.1, 'default': 1.0},
                    'rotate': {'type': 'float', 'min': -10, 'max': 10, 'default': 0},
                    'shift_x': {'type': 'float', 'min': -0.1, 'max': 0.1, 'default': 0},
                    'shift_y': {'type': 'float', 'min': -0.1, 'max': 0.1, 'default': 0}
                }
            },
            'perspective_warp': {
                'name': 'Perspective Warp',
                'category': 'advanced',
                'parameters': {
                    'distortion': {'type': 'float', 'min': 0.0, 'max': 0.3, 'default': 0.1}
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
                    'angle': {'type': 'float', 'min': -5, 'max': 5, 'default': 0}
                }
            },
            'gamma_correction': {
                'name': 'Gamma Correction',
                'category': 'advanced',
                'parameters': {
                    'gamma': {'type': 'float', 'min': 0.5, 'max': 2.0, 'default': 1.0}
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
                    'clip_limit': {'type': 'float', 'min': 1.0, 'max': 4.0, 'default': 2.0},
                    'grid_size': {'type': 'int', 'min': 4, 'max': 16, 'default': 8}
                }
            }
        }
    
    # Basic transformation methods
    def _apply_resize(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Resize image to specified dimensions"""
        width = params.get('width', 640)
        height = params.get('height', 640)
        return image.resize((width, height), Image.Resampling.LANCZOS)
    
    def _apply_rotate(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Rotate image by specified angle"""
        angle = params.get('angle', 0)
        return image.rotate(angle, expand=True, fillcolor=(255, 255, 255))
    
    def _apply_flip(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Flip image horizontally and/or vertically"""
        result = image
        if params.get('horizontal', False):
            result = result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if params.get('vertical', False):
            result = result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        return result
    
    def _apply_crop(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply random crop with specified scale"""
        scale = params.get('scale', 1.0)
        if scale >= 1.0:
            return image
        
        width, height = image.size
        new_width = int(width * scale)
        new_height = int(height * scale)
        
        left = random.randint(0, width - new_width)
        top = random.randint(0, height - new_height)
        
        cropped = image.crop((left, top, left + new_width, top + new_height))
        return cropped.resize((width, height), Image.Resampling.LANCZOS)
    
    def _apply_brightness(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Adjust image brightness"""
        factor = params.get('factor', 1.0)
        enhancer = ImageEnhance.Brightness(image)
        return enhancer.enhance(factor)
    
    def _apply_contrast(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Adjust image contrast"""
        factor = params.get('factor', 1.0)
        enhancer = ImageEnhance.Contrast(image)
        return enhancer.enhance(factor)
    
    def _apply_blur(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply Gaussian blur"""
        kernel_size = params.get('kernel_size', 3)
        radius = kernel_size / 2
        return image.filter(ImageFilter.GaussianBlur(radius=radius))
    
    def _apply_noise(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Add Gaussian noise to image"""
        std = params.get('std', 0.01)
        
        # Convert to numpy array
        img_array = np.array(image)
        
        # Generate noise
        noise = np.random.normal(0, std * 255, img_array.shape)
        
        # Add noise and clip values
        noisy_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
        
        return Image.fromarray(noisy_array)
    
    # Advanced transformation methods
    def _apply_color_jitter(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply color jittering"""
        result = image
        
        # Apply brightness
        brightness_factor = params.get('brightness', 1.0)
        if brightness_factor != 1.0:
            enhancer = ImageEnhance.Brightness(result)
            result = enhancer.enhance(brightness_factor)
        
        # Apply contrast
        contrast_factor = params.get('contrast', 1.0)
        if contrast_factor != 1.0:
            enhancer = ImageEnhance.Contrast(result)
            result = enhancer.enhance(contrast_factor)
        
        # Apply saturation
        saturation_factor = params.get('saturation', 1.0)
        if saturation_factor != 1.0:
            enhancer = ImageEnhance.Color(result)
            result = enhancer.enhance(saturation_factor)
        
        # Apply hue shift (simplified implementation)
        hue_shift = params.get('hue', 0)
        if hue_shift != 0:
            # Convert to HSV, shift hue, convert back
            img_array = np.array(result)
            hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
            hsv[:, :, 0] = (hsv[:, :, 0] + hue_shift * 180) % 180
            rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
            result = Image.fromarray(rgb)
        
        return result
    
    def _apply_cutout(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply cutout augmentation"""
        num_holes = params.get('num_holes', 1)
        hole_size = params.get('hole_size', 32)
        
        img_array = np.array(image)
        height, width = img_array.shape[:2]
        
        for _ in range(num_holes):
            y = random.randint(0, height - hole_size)
            x = random.randint(0, width - hole_size)
            img_array[y:y+hole_size, x:x+hole_size] = 0
        
        return Image.fromarray(img_array)
    
    def _apply_random_zoom(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply random zoom"""
        zoom_range = params.get('zoom_range', 1.0)
        if zoom_range == 1.0:
            return image
        
        width, height = image.size
        
        if zoom_range > 1.0:
            # Zoom in (crop and resize)
            new_width = int(width / zoom_range)
            new_height = int(height / zoom_range)
            left = (width - new_width) // 2
            top = (height - new_height) // 2
            cropped = image.crop((left, top, left + new_width, top + new_height))
            return cropped.resize((width, height), Image.Resampling.LANCZOS)
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
            return new_image
    
    def _apply_affine_transform(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply affine transformation"""
        # This is a simplified implementation
        # For full affine transforms, you might want to use cv2.warpAffine
        result = image
        
        # Apply rotation
        rotate_angle = params.get('rotate', 0)
        if rotate_angle != 0:
            result = result.rotate(rotate_angle, expand=False, fillcolor=(255, 255, 255))
        
        # Apply scaling
        scale_factor = params.get('scale', 1.0)
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
        
        return result
    
    def _apply_perspective_warp(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply perspective warp transformation"""
        distortion = params.get('distortion', 0.1)
        if distortion == 0:
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
        
        return Image.fromarray(warped)
    
    def _apply_grayscale(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Convert image to grayscale"""
        if params.get('enabled', False):
            return ImageOps.grayscale(image).convert('RGB')
        return image
    
    def _apply_shear(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply shear transformation"""
        angle = params.get('angle', 0)
        if angle == 0:
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
        
        return Image.fromarray(sheared)
    
    def _apply_gamma_correction(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply gamma correction"""
        gamma = params.get('gamma', 1.0)
        if gamma == 1.0:
            return image
        
        # Convert to numpy array
        img_array = np.array(image)
        
        # Normalize to 0-1, apply gamma, then scale back to 0-255
        normalized = img_array / 255.0
        corrected = np.power(normalized, gamma)
        result_array = (corrected * 255).astype(np.uint8)
        
        return Image.fromarray(result_array)
    
    def _apply_equalize(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply histogram equalization"""
        if params.get('enabled', False):
            return ImageOps.equalize(image)
        return image
    
    def _apply_clahe(self, image: Image.Image, params: Dict[str, Any]) -> Image.Image:
        """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)"""
        clip_limit = params.get('clip_limit', 2.0)
        grid_size = params.get('grid_size', 8)
        
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
        
        return Image.fromarray(result_array)

