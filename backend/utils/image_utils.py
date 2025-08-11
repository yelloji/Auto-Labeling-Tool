"""
Image utility functions for transformation processing
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import base64
import io
from typing import Dict, Any, Tuple, Optional

def encode_image_to_base64(image: np.ndarray) -> str:
    """Convert numpy image array to base64 string"""
    # Convert BGR to RGB if needed
    if len(image.shape) == 3 and image.shape[2] == 3:
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    else:
        image_rgb = image
    
    # Convert to PIL Image
    pil_image = Image.fromarray(image_rgb.astype(np.uint8))
    
    # Convert to base64
    buffer = io.BytesIO()
    pil_image.save(buffer, format='JPEG', quality=95)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/jpeg;base64,{img_str}"

def decode_base64_to_image(base64_string: str) -> np.ndarray:
    """Convert base64 string to numpy image array"""
    # Remove data URL prefix if present
    if base64_string.startswith('data:image'):
        base64_string = base64_string.split(',')[1]
    
    # Decode base64
    image_data = base64.b64decode(base64_string)
    
    # Convert to PIL Image
    pil_image = Image.open(io.BytesIO(image_data))
    
    # Convert to numpy array
    image_array = np.array(pil_image)
    
    # Convert RGB to BGR for OpenCV
    if len(image_array.shape) == 3 and image_array.shape[2] == 3:
        image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
    
    return image_array

def load_image_from_file(file_path: str) -> Optional[np.ndarray]:
    """Load image from file path"""
    try:
        image = cv2.imread(file_path)
        return image
    except Exception as e:
        print(f"Error loading image from {file_path}: {e}")
        return None

def save_image_to_file(image: np.ndarray, file_path: str) -> bool:
    """Save image to file path"""
    try:
        cv2.imwrite(file_path, image)
        return True
    except Exception as e:
        print(f"Error saving image to {file_path}: {e}")
        return False

def resize_image_for_preview(image: np.ndarray, max_size: int = 400) -> np.ndarray:
    """Resize image for preview while maintaining aspect ratio"""
    height, width = image.shape[:2]
    
    # Calculate scaling factor
    scale = min(max_size / width, max_size / height)
    
    if scale < 1:
        new_width = int(width * scale)
        new_height = int(height * scale)
        resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        return resized
    
    return image

def validate_image_format(image: np.ndarray) -> bool:
    """Validate if image is in correct format"""
    if image is None:
        return False
    
    if len(image.shape) not in [2, 3]:
        return False
    
    if len(image.shape) == 3 and image.shape[2] not in [1, 3, 4]:
        return False
    
    return True

def normalize_image_values(image: np.ndarray) -> np.ndarray:
    """Normalize image values to 0-255 range"""
    if image.dtype == np.float32 or image.dtype == np.float64:
        # If values are in 0-1 range, scale to 0-255
        if image.max() <= 1.0:
            image = (image * 255).astype(np.uint8)
        else:
            image = np.clip(image, 0, 255).astype(np.uint8)
    
    return image

def convert_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert image to RGB format"""
    if len(image.shape) == 3:
        if image.shape[2] == 3:
            # Assume BGR, convert to RGB
            return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        elif image.shape[2] == 4:
            # BGRA to RGB
            return cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
    
    # Grayscale to RGB
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    
    return image

def apply_safe_transformation(image: np.ndarray, transform_func, **kwargs) -> np.ndarray:
    """Apply transformation with error handling"""
    try:
        result = transform_func(image, **kwargs)
        
        # Validate result
        if not validate_image_format(result):
            print(f"Invalid result from transformation {transform_func.__name__}")
            return image
        
        # Normalize values
        result = normalize_image_values(result)
        
        return result
    
    except Exception as e:
        print(f"Error applying transformation {transform_func.__name__}: {e}")
        return image

def create_side_by_side_comparison(original: np.ndarray, transformed: np.ndarray) -> np.ndarray:
    """Create side-by-side comparison image"""
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
    
    return comparison


# ==================== NEW UI ENHANCEMENT UTILITIES ====================

def encode_pil_image_to_base64(pil_image: Image.Image, format: str = 'JPEG', quality: int = 95) -> str:
    """
    Convert PIL Image to base64 string
    Enhanced for the new transformation UI
    """
    buffer = io.BytesIO()
    
    # Handle different formats
    if format.upper() == 'PNG':
        pil_image.save(buffer, format='PNG', optimize=True)
        mime_type = 'image/png'
    else:
        # Convert to RGB if necessary for JPEG
        if pil_image.mode in ('RGBA', 'LA', 'P'):
            pil_image = pil_image.convert('RGB')
        pil_image.save(buffer, format='JPEG', quality=quality, optimize=True)
        mime_type = 'image/jpeg'
    
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:{mime_type};base64,{img_str}"

def create_transformation_grid(images: list, titles: list = None, grid_size: tuple = None) -> np.ndarray:
    """
    Create a grid of transformation results for comparison
    """
    if not images:
        return None
    
    num_images = len(images)
    
    # Auto-calculate grid size if not provided
    if grid_size is None:
        cols = int(np.ceil(np.sqrt(num_images)))
        rows = int(np.ceil(num_images / cols))
        grid_size = (rows, cols)
    
    rows, cols = grid_size
    
    # Get dimensions from first image
    if isinstance(images[0], Image.Image):
        sample_width, sample_height = images[0].size
    else:
        sample_height, sample_width = images[0].shape[:2]
    
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
        
        return np.array(grid_image)
    
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
        
        return grid_image

def add_text_overlay(image: np.ndarray, text: str, position: tuple = (10, 30), 
                    font_scale: float = 0.7, color: tuple = (255, 255, 255), 
                    thickness: int = 2) -> np.ndarray:
    """
    Add text overlay to image for labeling transformations
    """
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
    
    return result

def create_before_after_comparison(original: Image.Image, transformed: Image.Image, 
                                 labels: tuple = ("Original", "Transformed")) -> Image.Image:
    """
    Create before/after comparison for the transformation UI
    """
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
    
    return Image.fromarray(comparison_np)

def calculate_image_statistics(image: np.ndarray) -> Dict[str, Any]:
    """
    Calculate image statistics for transformation analysis
    """
    if len(image.shape) == 3:
        # Color image
        stats = {
            "mean_rgb": [float(np.mean(image[:, :, i])) for i in range(3)],
            "std_rgb": [float(np.std(image[:, :, i])) for i in range(3)],
            "brightness": float(np.mean(image)),
            "contrast": float(np.std(image))
        }
    else:
        # Grayscale image
        stats = {
            "mean": float(np.mean(image)),
            "std": float(np.std(image)),
            "brightness": float(np.mean(image)),
            "contrast": float(np.std(image))
        }
    
    # Common statistics
    stats.update({
        "min_value": float(np.min(image)),
        "max_value": float(np.max(image)),
        "shape": image.shape,
        "dtype": str(image.dtype)
    })
    
    return stats

def validate_transformation_parameters(transform_type: str, parameters: Dict[str, Any]) -> Tuple[bool, list]:
    """
    Validate transformation parameters for the new UI
    """
    errors = []
    
    if transform_type == "resize":
        width = parameters.get("width", 640)
        height = parameters.get("height", 640)
        if not (64 <= width <= 4096) or not (64 <= height <= 4096):
            errors.append("Resize dimensions must be between 64 and 4096")
    
    elif transform_type == "rotate":
        angle = parameters.get("angle", 0)
        if not (-360 <= angle <= 360):
            errors.append("Rotation angle must be between -360 and 360 degrees")
    
    elif transform_type == "brightness":
        factor = parameters.get("factor", 1.0)
        if not (0.1 <= factor <= 3.0):
            errors.append("Brightness factor must be between 0.1 and 3.0")
    
    elif transform_type == "contrast":
        factor = parameters.get("factor", 1.0)
        if not (0.1 <= factor <= 3.0):
            errors.append("Contrast factor must be between 0.1 and 3.0")
    
    elif transform_type == "blur":
        kernel_size = parameters.get("kernel_size", 3)
        if kernel_size % 2 == 0 or not (1 <= kernel_size <= 15):
            errors.append("Blur kernel size must be odd and between 1 and 15")
    
    elif transform_type == "noise":
        std = parameters.get("std", 0.01)
        if not (0 <= std <= 0.2):
            errors.append("Noise standard deviation must be between 0 and 0.2")
    
    elif transform_type == "crop":
        scale = parameters.get("scale", 1.0)
        if not (0.1 <= scale <= 1.0):
            errors.append("Crop scale must be between 0.1 and 1.0")
    
    return len(errors) == 0, errors

def optimize_image_for_web(image: Image.Image, max_size: int = 800, quality: int = 85) -> Image.Image:
    """
    Optimize image for web display in the transformation UI
    """
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
    
    # Convert to RGB if necessary
    if image.mode in ('RGBA', 'LA', 'P'):
        # Create white background
        background = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode == 'P':
            image = image.convert('RGBA')
        background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
        image = background
    
    return image

def create_thumbnail_with_overlay(image: Image.Image, overlay_text: str, 
                                thumbnail_size: tuple = (200, 200)) -> Image.Image:
    """
    Create thumbnail with text overlay for transformation previews
    """
    # Create thumbnail
    thumbnail = image.copy()
    thumbnail.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
    
    # Convert to numpy for text overlay
    thumbnail_np = np.array(thumbnail)
    
    # Add text overlay
    thumbnail_np = add_text_overlay(thumbnail_np, overlay_text, (5, 20), 
                                  font_scale=0.5, thickness=1)
    
    return Image.fromarray(thumbnail_np)

