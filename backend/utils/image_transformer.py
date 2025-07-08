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


    
    # ==================== NEW UI ENHANCEMENT METHODS ====================
    
    def get_transformation_presets(self) -> Dict[str, Dict[str, Any]]:
        """
        Get predefined transformation presets for the new UI
        """
        return {
            "light": {
                "name": "Light Augmentation",
                "description": "Minimal transformations for high-quality datasets",
                "transformations": {
                    "rotate": {"enabled": True, "angle": 5},
                    "flip": {"enabled": True, "horizontal": True, "vertical": False},
                    "brightness": {"enabled": True, "factor": 1.1},
                    "contrast": {"enabled": True, "factor": 1.1}
                }
            },
            "medium": {
                "name": "Medium Augmentation", 
                "description": "Balanced transformations for most use cases",
                "transformations": {
                    "rotate": {"enabled": True, "angle": 15},
                    "flip": {"enabled": True, "horizontal": True, "vertical": False},
                    "brightness": {"enabled": True, "factor": 1.2},
                    "contrast": {"enabled": True, "factor": 1.2},
                    "blur": {"enabled": True, "kernel_size": 5},
                    "noise": {"enabled": True, "std": 0.02},
                    "crop": {"enabled": True, "scale": 0.9}
                }
            },
            "heavy": {
                "name": "Heavy Augmentation",
                "description": "Aggressive transformations for maximum diversity",
                "transformations": {
                    "rotate": {"enabled": True, "angle": 30},
                    "flip": {"enabled": True, "horizontal": True, "vertical": True},
                    "brightness": {"enabled": True, "factor": 1.4},
                    "contrast": {"enabled": True, "factor": 1.4},
                    "blur": {"enabled": True, "kernel_size": 7},
                    "noise": {"enabled": True, "std": 0.05},
                    "crop": {"enabled": True, "scale": 0.8},
                    "color_jitter": {"enabled": True, "hue": 0.1, "brightness": 1.3, "contrast": 1.3, "saturation": 1.3},
                    "cutout": {"enabled": True, "num_holes": 2, "hole_size": 48}
                }
            }
        }
    
    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate transformation configuration
        
        Args:
            config: Transformation configuration dictionary
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        try:
            for transform_name, params in config.items():
                if transform_name not in self.transformation_methods:
                    errors.append(f"Unknown transformation: {transform_name}")
                    continue
                
                # Validate specific parameters based on transformation type
                if transform_name == "resize":
                    width = params.get("width", 640)
                    height = params.get("height", 640)
                    if not (64 <= width <= 2048) or not (64 <= height <= 2048):
                        errors.append(f"Resize dimensions must be between 64 and 2048")
                
                elif transform_name == "rotate":
                    angle = params.get("angle", 0)
                    if not (-180 <= angle <= 180):
                        errors.append(f"Rotation angle must be between -180 and 180 degrees")
                
                elif transform_name == "brightness":
                    factor = params.get("factor", 1.0)
                    if not (0.1 <= factor <= 3.0):
                        errors.append(f"Brightness factor must be between 0.1 and 3.0")
                
                elif transform_name == "contrast":
                    factor = params.get("factor", 1.0)
                    if not (0.1 <= factor <= 3.0):
                        errors.append(f"Contrast factor must be between 0.1 and 3.0")
                
                elif transform_name == "blur":
                    kernel_size = params.get("kernel_size", 3)
                    if kernel_size % 2 == 0 or not (1 <= kernel_size <= 15):
                        errors.append(f"Blur kernel size must be odd and between 1 and 15")
                
                elif transform_name == "noise":
                    std = params.get("std", 0.01)
                    if not (0 <= std <= 0.2):
                        errors.append(f"Noise standard deviation must be between 0 and 0.2")
                
                elif transform_name == "crop":
                    scale = params.get("scale", 1.0)
                    if not (0.1 <= scale <= 1.0):
                        errors.append(f"Crop scale must be between 0.1 and 1.0")
                
                elif transform_name == "cutout":
                    num_holes = params.get("num_holes", 1)
                    hole_size = params.get("hole_size", 32)
                    if not (1 <= num_holes <= 10):
                        errors.append(f"Number of cutout holes must be between 1 and 10")
                    if not (8 <= hole_size <= 128):
                        errors.append(f"Cutout hole size must be between 8 and 128")
                
                elif transform_name == "gamma_correction":
                    gamma = params.get("gamma", 1.0)
                    if not (0.1 <= gamma <= 3.0):
                        errors.append(f"Gamma value must be between 0.1 and 3.0")
        
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
            
        except Exception as e:
            warnings.append(f"Warning check error: {str(e)}")
        
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
            logger.error(f"Failed to load image {image_path}: {str(e)}")
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
            logger.error(f"Failed to save image {output_path}: {str(e)}")
            return False
    
    def get_image_info(self, image: Image.Image) -> Dict[str, Any]:
        """
        Get information about an image
        
        Args:
            image: PIL Image
            
        Returns:
            Dictionary with image information
        """
        return {
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "format": image.format,
            "size_bytes": len(image.tobytes()) if hasattr(image, 'tobytes') else 0
        }
    
    def create_preview_image(self, image: Image.Image, max_size: int = 400) -> Image.Image:
        """
        Create a preview-sized version of an image
        
        Args:
            image: Original PIL Image
            max_size: Maximum dimension for preview
            
        Returns:
            Resized PIL Image for preview
        """
        # Calculate new dimensions maintaining aspect ratio
        width, height = image.size
        if width > height:
            new_width = min(width, max_size)
            new_height = int(height * (new_width / width))
        else:
            new_height = min(height, max_size)
            new_width = int(width * (new_height / height))
        
        return image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    def batch_apply_transformations(self, images: List[Image.Image], config: Dict[str, Any]) -> List[Image.Image]:
        """
        Apply transformations to a batch of images
        
        Args:
            images: List of PIL Images
            config: Transformation configuration
            
        Returns:
            List of transformed PIL Images
        """
        results = []
        for image in images:
            try:
                transformed = self.apply_transformations(image, config)
                results.append(transformed)
            except Exception as e:
                logger.error(f"Failed to transform image in batch: {str(e)}")
                results.append(image)  # Return original on failure
        
        return results

