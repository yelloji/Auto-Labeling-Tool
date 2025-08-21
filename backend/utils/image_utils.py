"""
Image utility functions for transformation processing
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import base64
import io
from typing import Dict, Any, Tuple, Optional

# Import professional logging system
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

def encode_image_to_base64(image: np.ndarray) -> str:
    """Convert numpy image array to base64 string"""
    logger.info("operations.images", "Starting image encoding to base64", "encode_image_start", {
        'image_shape': image.shape if image is not None else None,
        'image_dtype': str(image.dtype) if image is not None else None
    })
    
    try:
        # Convert BGR to RGB if needed
        if len(image.shape) == 3 and image.shape[2] == 3:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            logger.info("operations.images", "Converted BGR to RGB", "color_conversion", {
                'conversion': 'BGR2RGB'
            })
        else:
            image_rgb = image
        
        # Convert to PIL Image
        pil_image = Image.fromarray(image_rgb.astype(np.uint8))
        
        # Convert to base64
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=95)
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        result = f"data:image/jpeg;base64,{img_str}"
        
        logger.info("operations.images", "Image successfully encoded to base64", "encode_image_success", {
            'base64_length': len(img_str),
            'format': 'JPEG',
            'quality': 95
        })
        
        return result
        
    except Exception as e:
        logger.error("errors.system", f"Failed to encode image to base64: {str(e)}", "encode_image_failed", {
            'error': str(e),
            'error_type': type(e).__name__
        })
        raise

def decode_base64_to_image(base64_string: str) -> np.ndarray:
    """Convert base64 string to numpy image array"""
    logger.info("operations.images", "Starting base64 decoding to image", "decode_base64_start", {
        'base64_length': len(base64_string),
        'has_data_url_prefix': base64_string.startswith('data:image')
    })
    
    try:
        # Remove data URL prefix if present
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
            logger.info("operations.images", "Removed data URL prefix", "prefix_removal", {
                'prefix_removed': True
            })
        
        # Decode base64
        image_data = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_data))
        
        # Convert to numpy array
        image_array = np.array(pil_image)
        
        # Convert RGB to BGR for OpenCV
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            logger.info("operations.images", "Converted RGB to BGR", "color_conversion", {
                'conversion': 'RGB2BGR'
            })
        
        logger.info("operations.images", "Base64 successfully decoded to image", "decode_base64_success", {
            'image_shape': image_array.shape,
            'image_dtype': str(image_array.dtype)
        })
        
        return image_array
        
    except Exception as e:
        logger.error("errors.system", f"Failed to decode base64 to image: {str(e)}", "decode_base64_failed", {
            'error': str(e),
            'error_type': type(e).__name__
        })
        raise

def load_image_from_file(file_path: str) -> Optional[np.ndarray]:
    """Load image from file path"""
    logger.info("operations.images", "Loading image from file", "load_image_start", {
        'file_path': file_path
    })
    
    try:
        image = cv2.imread(file_path)
        
        if image is not None:
            logger.info("operations.images", "Image successfully loaded from file", "load_image_success", {
                'file_path': file_path,
                'image_shape': image.shape,
                'image_dtype': str(image.dtype)
            })
        else:
            logger.error("errors.validation", f"Failed to load image from {file_path}", "load_image_failed", {
                'file_path': file_path,
                'error': 'cv2.imread returned None'
            })
        
        return image
        
    except Exception as e:
        logger.error("errors.system", f"Error loading image from {file_path}: {e}", "load_image_exception", {
            'file_path': file_path,
            'error': str(e),
            'error_type': type(e).__name__
        })
        return None

def save_image_to_file(image: np.ndarray, file_path: str) -> bool:
    """Save image to file path"""
    logger.info("operations.images", "Saving image to file", "save_image_start", {
        'file_path': file_path,
        'image_shape': image.shape if image is not None else None
    })
    
    try:
        success = cv2.imwrite(file_path, image)
        
        if success:
            logger.info("operations.images", "Image successfully saved to file", "save_image_success", {
                'file_path': file_path,
                'image_shape': image.shape if image is not None else None
            })
        else:
            logger.error("errors.system", f"Failed to save image to {file_path}", "save_image_failed", {
                'file_path': file_path,
                'cv2_imwrite_result': success
            })
        
        return success
        
    except Exception as e:
        logger.error("errors.system", f"Error saving image to {file_path}: {e}", "save_image_exception", {
            'file_path': file_path,
            'error': str(e),
            'error_type': type(e).__name__
        })
        return False

def resize_image_for_preview(image: np.ndarray, max_size: int = 400) -> np.ndarray:
    """Resize image for preview while maintaining aspect ratio"""
    logger.info("operations.images", "Resizing image for preview", "resize_preview_start", {
        'original_shape': image.shape if image is not None else None,
        'max_size': max_size
    })
    
    height, width = image.shape[:2]
    
    # Calculate scaling factor
    scale = min(max_size / width, max_size / height)
    
    if scale < 1:
        new_width = int(width * scale)
        new_height = int(height * scale)
        resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        logger.info("operations.images", "Image resized for preview", "resize_preview_success", {
            'original_shape': (height, width),
            'new_shape': (new_height, new_width),
            'scale_factor': scale
        })
        
        return resized
    
    logger.info("operations.images", "Image not resized (already within size limit)", "resize_preview_skipped", {
        'original_shape': (height, width),
        'max_size': max_size,
        'scale_factor': scale
    })
    
    return image

def validate_image_format(image: np.ndarray) -> bool:
    """Validate if image is in correct format"""
    logger.info("operations.images", "Validating image format", "validate_format_start", {
        'image_shape': image.shape if image is not None else None
    })
    
    if image is None:
        logger.error("errors.validation", "Image is None", "validate_format_failed", {
            'error': 'image_is_none'
        })
        return False
    
    if len(image.shape) not in [2, 3]:
        logger.error("errors.validation", "Invalid image dimensions", "validate_format_failed", {
            'error': 'invalid_dimensions',
            'shape': image.shape
        })
        return False
    
    if len(image.shape) == 3 and image.shape[2] not in [1, 3, 4]:
        logger.error("errors.validation", "Invalid number of channels", "validate_format_failed", {
            'error': 'invalid_channels',
            'channels': image.shape[2]
        })
        return False
    
    logger.info("operations.images", "Image format validation successful", "validate_format_success", {
        'shape': image.shape,
        'channels': image.shape[2] if len(image.shape) == 3 else 1
    })
    
    return True

def normalize_image_values(image: np.ndarray) -> np.ndarray:
    """Normalize image values to 0-255 range"""
    logger.info("operations.images", "Normalizing image values", "normalize_values_start", {
        'original_dtype': str(image.dtype),
        'original_min': float(np.min(image)),
        'original_max': float(np.max(image))
    })
    
    if image.dtype == np.float32 or image.dtype == np.float64:
        # If values are in 0-1 range, scale to 0-255
        if image.max() <= 1.0:
            image = (image * 255).astype(np.uint8)
            logger.info("operations.images", "Scaled 0-1 values to 0-255", "normalize_scale_01", {
                'scaling': '0-1_to_0-255'
            })
        else:
            image = np.clip(image, 0, 255).astype(np.uint8)
            logger.info("operations.images", "Clipped values to 0-255 range", "normalize_clip", {
                'clipping': '0-255_range'
            })
    
    logger.info("operations.images", "Image values normalization completed", "normalize_values_success", {
        'final_dtype': str(image.dtype),
        'final_min': float(np.min(image)),
        'final_max': float(np.max(image))
    })
    
    return image

def convert_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert image to RGB format"""
    logger.info("operations.images", "Converting image to RGB format", "convert_to_rgb_start", {
        'original_shape': image.shape,
        'original_channels': image.shape[2] if len(image.shape) == 3 else 1
    })
    
    if len(image.shape) == 3:
        if image.shape[2] == 3:
            # Assume BGR, convert to RGB
            result = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            logger.info("operations.images", "Converted BGR to RGB", "convert_bgr_to_rgb", {
                'conversion': 'BGR2RGB'
            })
        elif image.shape[2] == 4:
            # BGRA to RGB
            result = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
            logger.info("operations.images", "Converted BGRA to RGB", "convert_bgra_to_rgb", {
                'conversion': 'BGRA2RGB'
            })
        else:
            result = image
            logger.info("operations.images", "No conversion needed (already RGB-like)", "convert_no_change", {
                'reason': 'already_rgb_like'
            })
    else:
        # Grayscale to RGB
        if len(image.shape) == 2:
            result = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
            logger.info("operations.images", "Converted grayscale to RGB", "convert_gray_to_rgb", {
                'conversion': 'GRAY2RGB'
            })
        else:
            result = image
            logger.info("operations.images", "No conversion needed", "convert_no_change", {
                'reason': 'no_conversion_needed'
            })
    
    logger.info("operations.images", "RGB conversion completed", "convert_to_rgb_success", {
        'final_shape': result.shape,
        'final_channels': result.shape[2] if len(result.shape) == 3 else 1
    })
    
    return result

def apply_safe_transformation(image: np.ndarray, transform_func, **kwargs) -> np.ndarray:
    """Apply transformation with error handling"""
    logger.info("operations.images", "Applying safe transformation", "safe_transform_start", {
        'transform_func': transform_func.__name__,
        'kwargs': kwargs,
        'image_shape': image.shape if image is not None else None
    })
    
    try:
        result = transform_func(image, **kwargs)
        
        # Validate result
        if not validate_image_format(result):
            logger.error("errors.validation", f"Invalid result from transformation {transform_func.__name__}", "safe_transform_invalid_result", {
                'transform_func': transform_func.__name__,
                'result_shape': result.shape if result is not None else None
            })
            return image
        
        # Normalize values
        result = normalize_image_values(result)
        
        logger.info("operations.images", "Safe transformation applied successfully", "safe_transform_success", {
            'transform_func': transform_func.__name__,
            'original_shape': image.shape,
            'result_shape': result.shape
        })
        
        return result
    
    except Exception as e:
        logger.error("errors.system", f"Error applying transformation {transform_func.__name__}: {e}", "safe_transform_failed", {
            'transform_func': transform_func.__name__,
            'error': str(e),
            'error_type': type(e).__name__,
            'kwargs': kwargs
        })
        return image

def create_side_by_side_comparison(original: np.ndarray, transformed: np.ndarray) -> np.ndarray:
    """Create side-by-side comparison image"""
    logger.info("operations.images", "Creating side-by-side comparison", "comparison_start", {
        'original_shape': original.shape,
        'transformed_shape': transformed.shape
    })
    
    # Ensure both images have same height
    h1, w1 = original.shape[:2]
    h2, w2 = transformed.shape[:2]
    
    # Resize to same height
    target_height = min(h1, h2, 300)  # Limit height for preview
    
    scale1 = target_height / h1
    scale2 = target_height / h2
    
    new_w1 = int(w1 * scale1)
    new_w2 = int(w2 * scale2)
    
    resized1 = cv2.resize(original, (new_w1, target_height))
    resized2 = cv2.resize(transformed, (new_w2, target_height))
    
    # Concatenate horizontally
    comparison = np.hstack([resized1, resized2])
    
    logger.info("operations.images", "Side-by-side comparison created successfully", "comparison_success", {
        'original_shape': original.shape,
        'transformed_shape': transformed.shape,
        'comparison_shape': comparison.shape,
        'target_height': target_height,
        'scale1': scale1,
        'scale2': scale2
    })
    
    return comparison


# ==================== NEW UI ENHANCEMENT UTILITIES ====================

def encode_pil_image_to_base64(pil_image: Image.Image, format: str = 'JPEG', quality: int = 95) -> str:
    """
    Convert PIL Image to base64 string
    Enhanced for the new transformation UI
    """
    logger.info("operations.images", "Encoding PIL image to base64", "encode_pil_start", {
        'image_size': pil_image.size,
        'image_mode': pil_image.mode,
        'format': format,
        'quality': quality
    })
    
    try:
        buffer = io.BytesIO()
        
        # Handle different formats
        if format.upper() == 'PNG':
            pil_image.save(buffer, format='PNG', optimize=True)
            mime_type = 'image/png'
            logger.info("operations.images", "Saved as PNG format", "encode_pil_png", {
                'format': 'PNG',
                'optimize': True
            })
        else:
            # Convert to RGB if necessary for JPEG
            if pil_image.mode in ('RGBA', 'LA', 'P'):
                pil_image = pil_image.convert('RGB')
                logger.info("operations.images", "Converted image to RGB for JPEG", "encode_pil_rgb_conversion", {
                    'original_mode': pil_image.mode,
                    'new_mode': 'RGB'
                })
            pil_image.save(buffer, format='JPEG', quality=quality, optimize=True)
            mime_type = 'image/jpeg'
            logger.info("operations.images", "Saved as JPEG format", "encode_pil_jpeg", {
                'format': 'JPEG',
                'quality': quality,
                'optimize': True
            })
        
        img_str = base64.b64encode(buffer.getvalue()).decode()
        result = f"data:{mime_type};base64,{img_str}"
        
        logger.info("operations.images", "PIL image successfully encoded to base64", "encode_pil_success", {
            'base64_length': len(img_str),
            'mime_type': mime_type,
            'format': format
        })
        
        return result
        
    except Exception as e:
        logger.error("errors.system", f"Failed to encode PIL image to base64: {str(e)}", "encode_pil_failed", {
            'error': str(e),
            'error_type': type(e).__name__,
            'format': format,
            'quality': quality
        })
        raise

def create_transformation_grid(images: list, titles: list = None, grid_size: tuple = None) -> np.ndarray:
    """
    Create a grid of transformation results for comparison
    """
    logger.info("operations.images", "Creating transformation grid", "create_grid_start", {
        'num_images': len(images),
        'has_titles': titles is not None,
        'grid_size': grid_size
    })
    
    if not images:
        logger.warning("operations.images", "No images provided for grid creation", "create_grid_no_images", {
            'result': 'returning_none'
        })
        return None
    
    num_images = len(images)
    
    # Auto-calculate grid size if not provided
    if grid_size is None:
        cols = int(np.ceil(np.sqrt(num_images)))
        rows = int(np.ceil(num_images / cols))
        grid_size = (rows, cols)
        logger.info("operations.images", "Auto-calculated grid size", "grid_size_calculated", {
            'rows': rows,
            'cols': cols,
            'total_cells': rows * cols
        })
    
    rows, cols = grid_size
    
    # Get dimensions from first image
    if isinstance(images[0], Image.Image):
        sample_width, sample_height = images[0].size
        image_type = 'PIL'
    else:
        sample_height, sample_width = images[0].shape[:2]
        image_type = 'numpy'
    
    logger.info("operations.images", "Grid dimensions calculated", "grid_dimensions", {
        'sample_width': sample_width,
        'sample_height': sample_height,
        'image_type': image_type,
        'grid_width': cols * sample_width,
        'grid_height': rows * sample_height
    })
    
    # Create grid canvas
    grid_width = cols * sample_width
    grid_height = rows * sample_height
    
    if isinstance(images[0], Image.Image):
        grid_image = Image.new('RGB', (grid_width, grid_height), (255, 255, 255))
        
        for i, img in enumerate(images):
            if i >= rows * cols:
                break
            
            row = i // cols
            col = i % cols
            
            x = col * sample_width
            y = row * sample_height
            
            # Resize image to fit grid cell
            resized_img = img.resize((sample_width, sample_height), Image.Resampling.LANCZOS)
            grid_image.paste(resized_img, (x, y))
        
        result = np.array(grid_image)
        
    else:
        # Handle numpy arrays
        grid_image = np.ones((grid_height, grid_width, 3), dtype=np.uint8) * 255
        
        for i, img in enumerate(images):
            if i >= rows * cols:
                break
            
            row = i // cols
            col = i % cols
            
            y1 = row * sample_height
            y2 = y1 + sample_height
            x1 = col * sample_width
            x2 = x1 + sample_width
            
            # Resize image to fit grid cell
            resized_img = cv2.resize(img, (sample_width, sample_height))
            
            # Ensure 3 channels
            if len(resized_img.shape) == 2:
                resized_img = cv2.cvtColor(resized_img, cv2.COLOR_GRAY2RGB)
            elif resized_img.shape[2] == 4:
                resized_img = cv2.cvtColor(resized_img, cv2.COLOR_BGRA2RGB)
            
            grid_image[y1:y2, x1:x2] = resized_img
        
        result = grid_image
    
    logger.info("operations.images", "Transformation grid created successfully", "create_grid_success", {
        'grid_shape': result.shape,
        'images_processed': min(len(images), rows * cols),
        'grid_size': grid_size
    })
    
    return result

def add_text_overlay(image: np.ndarray, text: str, position: tuple = (10, 30), 
                    font_scale: float = 0.7, color: tuple = (255, 255, 255), 
                    thickness: int = 2) -> np.ndarray:
    """
    Add text overlay to image for labeling transformations
    """
    logger.info("operations.images", "Adding text overlay to image", "add_text_overlay_start", {
        'text': text,
        'position': position,
        'font_scale': font_scale,
        'color': color,
        'thickness': thickness,
        'image_shape': image.shape
    })
    
    result = image.copy()
    
    # Add black background for better text visibility
    text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)[0]
    cv2.rectangle(result, 
                 (position[0] - 5, position[1] - text_size[1] - 10),
                 (position[0] + text_size[0] + 5, position[1] + 5),
                 (0, 0, 0), -1)
    
    # Add text
    cv2.putText(result, text, position, cv2.FONT_HERSHEY_SIMPLEX, 
                font_scale, color, thickness)
    
    logger.info("operations.images", "Text overlay added successfully", "add_text_overlay_success", {
        'text': text,
        'text_size': text_size,
        'position': position
    })
    
    return result

def create_before_after_comparison(original: Image.Image, transformed: Image.Image, 
                                 labels: tuple = ("Original", "Transformed")) -> Image.Image:
    """
    Create before/after comparison for the transformation UI
    """
    logger.info("operations.images", "Creating before/after comparison", "before_after_start", {
        'original_size': original.size,
        'transformed_size': transformed.size,
        'labels': labels
    })
    
    # Ensure both images are the same size
    width = max(original.width, transformed.width)
    height = max(original.height, transformed.height)
    
    # Resize images to match
    original_resized = original.resize((width, height), Image.Resampling.LANCZOS)
    transformed_resized = transformed.resize((width, height), Image.Resampling.LANCZOS)
    
    # Create side-by-side comparison
    comparison_width = width * 2 + 20  # 20px gap
    comparison_height = height + 60    # 60px for labels
    
    comparison = Image.new('RGB', (comparison_width, comparison_height), (240, 240, 240))
    
    # Paste images
    comparison.paste(original_resized, (0, 40))
    comparison.paste(transformed_resized, (width + 20, 40))
    
    # Convert to numpy for text overlay
    comparison_np = np.array(comparison)
    
    # Add labels
    comparison_np = add_text_overlay(comparison_np, labels[0], (10, 30))
    comparison_np = add_text_overlay(comparison_np, labels[1], (width + 30, 30))
    
    result = Image.fromarray(comparison_np)
    
    logger.info("operations.images", "Before/after comparison created successfully", "before_after_success", {
        'comparison_size': result.size,
        'original_size': original.size,
        'transformed_size': transformed.size,
        'labels': labels
    })
    
    return result

def calculate_image_statistics(image: np.ndarray) -> Dict[str, Any]:
    """
    Calculate image statistics for transformation analysis
    """
    logger.info("operations.images", "Calculating image statistics", "calculate_stats_start", {
        'image_shape': image.shape,
        'image_dtype': str(image.dtype)
    })
    
    try:
        if len(image.shape) == 3:
            # Color image
            stats = {
                "mean_rgb": [float(np.mean(image[:, :, i])) for i in range(3)],
                "std_rgb": [float(np.std(image[:, :, i])) for i in range(3)],
                "brightness": float(np.mean(image)),
                "contrast": float(np.std(image))
            }
            logger.info("operations.images", "Calculated color image statistics", "stats_color", {
                'channels': 3,
                'mean_rgb': stats["mean_rgb"],
                'std_rgb': stats["std_rgb"]
            })
        else:
            # Grayscale image
            stats = {
                "mean": float(np.mean(image)),
                "std": float(np.std(image)),
                "brightness": float(np.mean(image)),
                "contrast": float(np.std(image))
            }
            logger.info("operations.images", "Calculated grayscale image statistics", "stats_grayscale", {
                'channels': 1,
                'mean': stats["mean"],
                'std': stats["std"]
            })
        
        # Common statistics
        stats.update({
            "min_value": float(np.min(image)),
            "max_value": float(np.max(image)),
            "shape": image.shape,
            "dtype": str(image.dtype)
        })
        
        logger.info("operations.images", "Image statistics calculated successfully", "calculate_stats_success", {
            'min_value': stats["min_value"],
            'max_value': stats["max_value"],
            'brightness': stats["brightness"],
            'contrast': stats["contrast"]
        })
        
        return stats
        
    except Exception as e:
        logger.error("errors.system", f"Failed to calculate image statistics: {str(e)}", "calculate_stats_failed", {
            'error': str(e),
            'error_type': type(e).__name__
        })
        raise

def validate_transformation_parameters(transform_type: str, parameters: Dict[str, Any]) -> Tuple[bool, list]:
    """
    Validate transformation parameters for the new UI
    """
    logger.info("operations.images", "Validating transformation parameters", "validate_params_start", {
        'transform_type': transform_type,
        'parameters': parameters
    })
    
    errors = []
    
    if transform_type == "resize":
        width = parameters.get("width", 640)
        height = parameters.get("height", 640)
        if not (64 <= width <= 4096) or not (64 <= height <= 4096):
            errors.append("Resize dimensions must be between 64 and 4096")
            logger.error("errors.validation", "Invalid resize dimensions", "validate_resize_failed", {
                'width': width,
                'height': height,
                'valid_range': '64-4096'
            })
    
    elif transform_type == "rotate":
        angle = parameters.get("angle", 0)
        if not (-360 <= angle <= 360):
            errors.append("Rotation angle must be between -360 and 360 degrees")
            logger.error("errors.validation", "Invalid rotation angle", "validate_rotate_failed", {
                'angle': angle,
                'valid_range': '-360 to 360'
            })
    
    elif transform_type == "brightness":
        factor = parameters.get("factor", 1.0)
        if not (0.1 <= factor <= 3.0):
            errors.append("Brightness factor must be between 0.1 and 3.0")
            logger.error("errors.validation", "Invalid brightness factor", "validate_brightness_failed", {
                'factor': factor,
                'valid_range': '0.1-3.0'
            })
    
    elif transform_type == "contrast":
        factor = parameters.get("factor", 1.0)
        if not (0.1 <= factor <= 3.0):
            errors.append("Contrast factor must be between 0.1 and 3.0")
            logger.error("errors.validation", "Invalid contrast factor", "validate_contrast_failed", {
                'factor': factor,
                'valid_range': '0.1-3.0'
            })
    
    elif transform_type == "blur":
        kernel_size = parameters.get("kernel_size", 3)
        if kernel_size % 2 == 0 or not (1 <= kernel_size <= 15):
            errors.append("Blur kernel size must be odd and between 1 and 15")
            logger.error("errors.validation", "Invalid blur kernel size", "validate_blur_failed", {
                'kernel_size': kernel_size,
                'valid_range': '1-15 (odd numbers only)'
            })
    
    elif transform_type == "noise":
        std = parameters.get("std", 0.01)
        if not (0 <= std <= 0.2):
            errors.append("Noise standard deviation must be between 0 and 0.2")
            logger.error("errors.validation", "Invalid noise standard deviation", "validate_noise_failed", {
                'std': std,
                'valid_range': '0-0.2'
            })
    
    elif transform_type == "crop":
        scale = parameters.get("scale", 1.0)
        if not (0.1 <= scale <= 1.0):
            errors.append("Crop scale must be between 0.1 and 1.0")
            logger.error("errors.validation", "Invalid crop scale", "validate_crop_failed", {
                'scale': scale,
                'valid_range': '0.1-1.0'
            })
    
    is_valid = len(errors) == 0
    
    if is_valid:
        logger.info("operations.images", "Transformation parameters validation successful", "validate_params_success", {
            'transform_type': transform_type,
            'parameters': parameters
        })
    else:
        logger.error("errors.validation", "Transformation parameters validation failed", "validate_params_failed", {
            'transform_type': transform_type,
            'parameters': parameters,
            'errors': errors
        })
    
    return is_valid, errors

def optimize_image_for_web(image: Image.Image, max_size: int = 800, quality: int = 85) -> Image.Image:
    """
    Optimize image for web display in the transformation UI
    """
    logger.info("operations.images", "Optimizing image for web display", "optimize_web_start", {
        'original_size': image.size,
        'original_mode': image.mode,
        'max_size': max_size,
        'quality': quality
    })
    
    try:
        # Calculate new dimensions
        width, height = image.size
        if max(width, height) > max_size:
            if width > height:
                new_width = max_size
                new_height = int(height * (max_size / width))
            else:
                new_height = max_size
                new_width = int(width * (max_size / height))
            
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info("operations.images", "Image resized for web optimization", "optimize_web_resize", {
                'original_size': (width, height),
                'new_size': (new_width, new_height),
                'scale_factor': max_size / max(width, height)
            })
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
            logger.info("operations.images", "Image converted to RGB for web", "optimize_web_rgb_conversion", {
                'original_mode': image.mode,
                'new_mode': 'RGB'
            })
        
        logger.info("operations.images", "Image optimized for web successfully", "optimize_web_success", {
            'final_size': image.size,
            'final_mode': image.mode
        })
        
        return image
        
    except Exception as e:
        logger.error("errors.system", f"Failed to optimize image for web: {str(e)}", "optimize_web_failed", {
            'error': str(e),
            'error_type': type(e).__name__,
            'max_size': max_size,
            'quality': quality
        })
        raise

def create_thumbnail_with_overlay(image: Image.Image, overlay_text: str, 
                                thumbnail_size: tuple = (200, 200)) -> Image.Image:
    """
    Create thumbnail with text overlay for transformation previews
    """
    logger.info("operations.images", "Creating thumbnail with overlay", "create_thumbnail_start", {
        'original_size': image.size,
        'overlay_text': overlay_text,
        'thumbnail_size': thumbnail_size
    })
    
    try:
        # Create thumbnail
        thumbnail = image.copy()
        thumbnail.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
        
        # Convert to numpy for text overlay
        thumbnail_np = np.array(thumbnail)
        
        # Add text overlay
        thumbnail_np = add_text_overlay(thumbnail_np, overlay_text, (5, 20), 
                                      font_scale=0.5, thickness=1)
        
        result = Image.fromarray(thumbnail_np)
        
        logger.info("operations.images", "Thumbnail with overlay created successfully", "create_thumbnail_success", {
            'original_size': image.size,
            'thumbnail_size': result.size,
            'overlay_text': overlay_text
        })
        
        return result
        
    except Exception as e:
        logger.error("errors.system", f"Failed to create thumbnail with overlay: {str(e)}", "create_thumbnail_failed", {
            'error': str(e),
            'error_type': type(e).__name__,
            'overlay_text': overlay_text,
            'thumbnail_size': thumbnail_size
        })
        raise

