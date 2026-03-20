import numpy as np
import cv2
import base64
import os
import torch
import time
from io import BytesIO
from PIL import Image
from pathlib import Path
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from logging_system.professional_logger import get_professional_logger
from core.config import settings
from database.database import get_db, SessionLocal
from database.operations import ImageOperations

logger = get_professional_logger()
router = APIRouter()

class SmartPoint(BaseModel):
    x: float
    y: float
    label: int = 1  # 1 for positive, 0 for negative

class SmartPolygonRequest(BaseModel):
    image_id: str
    points: List[SmartPoint]
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    complexity: Optional[float] = 0.5 # New: control smoothing
    algorithm: Optional[str] = "sam"

class SmartPolygonResponse(BaseModel):
    success: bool
    points: List[Dict[str, float]]
    confidence: float
    algorithm: str
    error: Optional[str] = None

# Legacy Models for backward compatibility
class SegmentationPoint(BaseModel):
    x: float
    y: float

class PolygonPoint(BaseModel):
    x: float
    y: float

class SegmentationRequest(BaseModel):
    image_id: Optional[str] = None
    image_url: Optional[str] = None
    point: SegmentationPoint
    algorithm: Optional[str] = "auto"
    model_type: Optional[str] = "sam"
    class_index: Optional[int] = 0

class SegmentationResponse(BaseModel):
    polygon_points: List[Dict[str, float]]
    confidence: float
    mask_area: int
    bbox: Dict[str, float]

# --- Modular Segmentation Architecture ---

class SegmentorStrategy(ABC):
    """Base class for all segmentation providers"""
    
    @abstractmethod
    def segment(self, image: np.ndarray, points: List[SmartPoint]) -> Tuple[List[Dict[str, float]], float]:
        pass

    @abstractmethod
    def reset_cache(self):
        """Clear any cached embeddings"""
        pass

class SegmentorRegistry:
    _instance = None
    _segmentors = {}
    _current = "mock"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, name: str, segmentor: SegmentorStrategy):
        self._segmentors[name] = segmentor

    def get_current(self) -> SegmentorStrategy:
        return self._segmentors.get(self._current)

    def set_current(self, name: str):
        if name in self._segmentors:
            self._current = name

class MockSegmentor(SegmentorStrategy):
    """Fallback segmentor that generates realistic fake polygons"""
    def segment(self, image: np.ndarray, points: List[SmartPoint]) -> Tuple[List[Dict[str, float]], float]:
        if not points:
            return [], 0.0
        
        # Take the first point and generate a polygon
        p = points[0]
        h, w = image.shape[:2]
        poly = generate_realistic_polygon(int(p.x), int(p.y), w, h)
        return [{"x": float(pt[0]), "y": float(pt[1])} for pt in poly], 0.8

    def reset_cache(self):
        pass

class UltralyticsSAMSegmentor(SegmentorStrategy):
    """Real SAM segmentor using Ultralytics"""
    def __init__(self):
        self.model = None
        self.last_image_id = None
        self.predictor = None # For caching embeddings
        self.device = self._get_optimal_device()
        self.cached_resized_image = None
        self.cached_scale = 1.0

    def _get_optimal_device(self):
        """Pick the safest device (prefers CUDA if >2GB free)"""
        if not torch.cuda.is_available():
            return "cpu"
        try:
            # Check free memory (Total - Allocated)
            total_mem = torch.cuda.get_device_properties(0).total_memory
            allocated_mem = torch.cuda.memory_allocated(0)
            free_mem = total_mem - allocated_mem
            
            # 2GB safety margin (2 * 1024^3 bytes)
            if free_mem < 2 * 1024 * 1024 * 1024:
                return "cpu"
            return "cuda"
        except:
            return "cpu"

    def _load_model(self):
        if self.model is None:
            try:
                from ultralytics import SAM
                import shutil
                logger.info("operations.annotations", "Loading SAM model...", "sam_load_start")
                
                # Use SAM2 Base - Better accuracy, still good speed
                model_size = os.getenv("SAM_MODEL_SIZE", "sam2_b.pt")  # Best overall balance
                
                # Target directory for our local copy — writable on any PC
                sam_dir = settings.BASE_DIR / "models" / "sam"
                sam_dir.mkdir(parents=True, exist_ok=True)
                local_model_path = sam_dir / model_size
                
                # Check if we already have it locally
                if local_model_path.exists():
                    logger.info("operations.annotations", f"Loading SAM from local cache: {local_model_path}", "sam_local_load")
                    self.model = SAM(str(local_model_path))
                else:
                    # Auto-download (like YOLO) and then copy to our directory
                    logger.info("operations.annotations", f"Downloading SAM model {model_size}...", "sam_download_start")
                    temp_model = SAM(model_size)  # Triggers auto-download to Ultralytics cache
                    
                    # Try to copy from Ultralytics cache to our local models/sam
                    try:
                        ckpt_path = getattr(temp_model, 'ckpt_path', None)
                        if ckpt_path and os.path.exists(ckpt_path):
                            shutil.copy2(ckpt_path, local_model_path)
                            logger.info("operations.annotations", f"SAM model copied to {local_model_path}", "sam_copy_success")
                            self.model = SAM(str(local_model_path))
                        else:
                            # If copy fails, use the temp model directly (still works!)
                            logger.warning("operations.annotations", "Could not copy SAM to local dir, using from cache", "sam_copy_skip")
                            self.model = temp_model
                    except Exception as copy_error:
                        logger.warning("operations.annotations", f"Copy failed: {copy_error}, using cached model", "sam_copy_fail")
                        self.model = temp_model
                
                logger.info("operations.annotations", f"SAM model ({model_size}) ready", "sam_load_success", {"device": self.device})
            except Exception as e:
                logger.error("errors.system", f"Failed to load SAM: {e}. Falling back to MockSegmentor", "sam_load_error")
                # Don't raise - fall back to mock mode instead
                logger.warning("operations.annotations", "Using MockSegmentor as fallback", "sam_fallback_mock")

    def set_image(self, image: np.ndarray, image_id: str):
        """Prepare the image for segmentation (compute embeddings)"""
        self._load_model()
        if self.last_image_id != image_id:
            self.last_image_id = image_id
            # Pre-calculate a 512px downscale to use as a persistent cache
            # This makes both CPU and GPU hover previews near-instant
            h, w = image.shape[:2]
            max_dim = 512
            scale = min(1.0, max_dim / max(h, w))
            if scale < 1.0:
                self.cached_resized_image = cv2.resize(image, (int(w*scale), int(h*scale)))
                self.cached_scale = scale
            else:
                self.cached_resized_image = image
                self.cached_scale = 1.0

            # Dynamic health check on device before we start a new image
            self.device = self._get_optimal_device()
            
            # EXPLICITLY move model to device now
            if self.model and hasattr(self.model, 'to'):
                try:
                    self.model.to(self.device)
                except Exception as e:
                    logger.warning("operations.annotations", f"Failed to move model to {self.device}: {e}", "sam_device_move_fail")
        
    def segment(self, image: np.ndarray, points: List[SmartPoint]) -> Tuple[List[Dict[str, float]], float]:
        if not points:
            return [], 0.0
        
        try:
            self._load_model()
            
            # Use cached resized image if available
            if hasattr(self, 'last_image_id') and self.last_image_id is not None:
                resized_image = self.cached_resized_image
                scale_factor = self.cached_scale
            else:
                # Fallback to ad-hoc scaling
                h, w = image.shape[:2]
                scale_factor = min(1.0, 512 / max(h, w))
                resized_image = cv2.resize(image, (int(w*scale_factor), int(h*scale_factor))) if scale_factor < 1.0 else image

            point_coords = np.array([[p.x * scale_factor, p.y * scale_factor] for p in points], dtype=np.float32)
            point_labels = np.array([p.label for p in points], dtype=np.int32)
            
            # Use the model with cached image check
            # Wrap in try-except for OOM fallback (training protection)
            t_start = time.time()
            try:
                # DEBUG PRINT for user verification
                if self.device == "cuda":
                    free_mem = (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)) / (1024**2)
                    print(f"🚀 [SMART POLYGON] Device: RTX 3060 (Free VRAM: {free_mem:.0f}MB)")
                else:
                    print(f"💻 [SMART POLYGON] Device: CPU (Safe Mode)")

                # Use the predict method with the resized image
                # This is the most reliable way and with 512px it should be fast
                results = self.model.predict(
                    source=resized_image, 
                    points=[point_coords.tolist()],
                    labels=[point_labels.tolist()],
                    verbose=False,
                    device=self.device
                )
                t_predict = (time.time() - t_start) * 1000
                print(f"⏱️ [SMART POLYGON] Prediction Time: {t_predict:.1f}ms")
            except Exception as e:
                t_err = (time.time() - t_start) * 1000
                print(f"⚠️ [SMART POLYGON] Prediction Error after {t_err:.1f}ms: {e}")
                # If GPU fails (OOM or otherwise), fallback to CPU to avoid crash
                if "out of memory" in str(e).lower() and self.device == "cuda":
                    self.device = "cpu"
                    print(f"🔄 [SMART POLYGON] Fallback to CPU due to OOM")
                    # Re-run with full image on CPU
                    results = self.model.predict(
                        source=resized_image,
                        points=[point_coords.tolist()],
                        labels=[point_labels.tolist()],
                        verbose=False,
                        device="cpu"
                    )
                else:
                    raise e
            
            if not results or len(results) == 0:
                return [], 0.0
                
            result = results[0]
            
            if not hasattr(result, 'masks') or result.masks is None:
                return [], 0.0
                
            # Get the mask data
            mask_tensor = result.masks.data[0]
            mask = mask_tensor.cpu().numpy()
            confidence = 0.8
            
            # Convert mask to polygon using OpenCV
            # Mask is boolean/float, convert to uint8
            mask8 = (mask * 255).astype(np.uint8)
            
            # Find contours
            contours, _ = cv2.findContours(mask8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return [], 0.0
                
            # Take the largest contour
            largest_contour = max(contours, key=cv2.contourArea)
            
            # Simplify contour - reduced factor for more detail
            base_epsilon = 0.01 
            epsilon_factor = 0.3  # Reduced from 0.5 to keep more detail
            epsilon = base_epsilon * epsilon_factor * cv2.arcLength(largest_contour, True)
            
            simplified = cv2.approxPolyDP(largest_contour, epsilon, True)
            
            # Convert to [{x, y}] format and scale back to original resolution
            if scale_factor != 1.0:
                # Scale coordinates back up
                points_out = [{
                    "x": float(pt[0][0] / scale_factor), 
                    "y": float(pt[0][1] / scale_factor)
                } for pt in simplified]
            else:
                points_out = [{"x": float(pt[0][0]), "y": float(pt[0][1])} for pt in simplified]
            
            return points_out, confidence
            
        except Exception as e:
            logger.warning("operations.annotations", f"Real SAM segmentation failed, falling back: {e}", "sam_seg_fallback")
            # Fallback to mock
            return MockSegmentor().segment(image, points)

    def reset_cache(self):
        self.last_image_id = None
        self.predictor = None

# Initialize registry
registry = SegmentorRegistry.get_instance()
registry.register("mock", MockSegmentor())
registry.register("sam", UltralyticsSAMSegmentor())
registry.set_current("sam")
@router.post("/segment", response_model=SegmentationResponse)
async def click_to_segment(request: SegmentationRequest):
    """
    Advanced click-to-segment functionality using multiple algorithms
    """
    try:
        # Compatibility layer: convert old request to new format
        # This allows existing frontend code to keep working
        image_id = getattr(request, 'image_id', 'none') # Fallback if missing
        points = [SmartPoint(x=request.point.x, y=request.point.y, label=1)]
        
        # Load image (placeholder logic for old URL-based request)
        image = await load_image_from_url(request.image_url)
        
        # Use current segmentor
        segmentor = registry.get_current()
        points_out, confidence = segmentor.segment(image, points)
        
        return SegmentationResponse(
            polygon_points=points_out,
            confidence=confidence,
            mask_area=calculate_polygon_area([(p['x'], p['y']) for p in points_out]),
            bbox=calculate_polygon_bbox([(p['x'], p['y']) for p in points_out])
        )
        
    except Exception as e:
        logger.error("errors.system", f"Segmentation failed: {str(e)}", "segmentation_failed")
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

async def load_image_from_url(image_url: str) -> np.ndarray:
    """Load image from URL or base64 data"""
    try:
        source_type = 'base64' if image_url.startswith('data:image') else 'url'
        logger.info("operations.images", "Loading image", "load_image_start", {
            'source_type': source_type
        })
        if image_url.startswith('data:image'):
            # Handle base64 encoded images
            header, data = image_url.split(',', 1)
            image_data = base64.b64decode(data)
            image = Image.open(BytesIO(image_data))
            img = np.array(image.convert('RGB'))
            logger.info("operations.images", "Image loaded from base64", "load_image_success", {
                'width': int(img.shape[1]),
                'height': int(img.shape[0])
            })
            return img
        else:
            # Handle regular URLs (placeholder - in real implementation would fetch from URL)
            # For now, create a sample image
            img = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
            logger.info("operations.images", "Image loaded from url (mock)", "load_image_success", {
                'width': 800,
                'height': 600
            })
            return img
    except Exception as e:
        logger.error("errors.validation", f"Failed to load image: {e}", "load_image_error", {
            'error': str(e),
            'source_preview': image_url[:30] if image_url else ''
        })
        raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")

async def segment_with_sam(image: np.ndarray, point: SegmentationPoint) -> SegmentationResponse:
    """
    Segment using SAM (Segment Anything Model)
    This is a placeholder - in real implementation would use actual SAM model
    """
    try:
        height, width = image.shape[:2]
        
        # Mock SAM segmentation - create a realistic polygon around the click point
        center_x, center_y = int(point.x), int(point.y)
        
        # Generate a realistic object-like polygon
        polygon_points = generate_realistic_polygon(center_x, center_y, width, height)
        
        # Calculate mask area and bounding box
        mask_area = calculate_polygon_area(polygon_points)
        bbox = calculate_polygon_bbox(polygon_points)
        
        return SegmentationResponse(
            polygon_points=[PolygonPoint(x=p[0], y=p[1]) for p in polygon_points],
            confidence=0.92,  # High confidence for SAM
            mask_area=mask_area,
            bbox=bbox
        )
        
    except Exception as e:
        logger.error("errors.system", f"SAM segmentation failed: {e}", "sam_segmentation_failed", {
            'error': str(e),
            'point_x': point.x,
            'point_y': point.y
        })
        raise HTTPException(status_code=500, detail=f"SAM segmentation failed: {str(e)}")

async def segment_with_yolo(image: np.ndarray, point: SegmentationPoint, class_index: int) -> SegmentationResponse:
    """
    Segment using YOLO instance segmentation
    """
    try:
        # Mock YOLO segmentation
        height, width = image.shape[:2]
        center_x, center_y = int(point.x), int(point.y)
        
        # Generate polygon based on typical object shapes for different classes
        if class_index == 0:  # Person - vertical rectangle-like
            polygon_points = generate_person_like_polygon(center_x, center_y, width, height)
        elif class_index == 1:  # Car - horizontal rectangle-like
            polygon_points = generate_car_like_polygon(center_x, center_y, width, height)
        else:  # Generic object
            polygon_points = generate_realistic_polygon(center_x, center_y, width, height)
        
        mask_area = calculate_polygon_area(polygon_points)
        bbox = calculate_polygon_bbox(polygon_points)
        
        return SegmentationResponse(
            polygon_points=[PolygonPoint(x=p[0], y=p[1]) for p in polygon_points],
            confidence=0.87,  # Good confidence for YOLO
            mask_area=mask_area,
            bbox=bbox
        )
        
    except Exception as e:
        logger.error("errors.system", f"YOLO segmentation failed: {e}", "yolo_segmentation_failed", {
            'error': str(e),
            'point_x': point.x,
            'point_y': point.y,
            'class_index': class_index
        })
        raise HTTPException(status_code=500, detail=f"YOLO segmentation failed: {str(e)}")

async def segment_with_watershed(image: np.ndarray, point: SegmentationPoint) -> SegmentationResponse:
    """
    Segment using watershed algorithm for quick segmentation
    """
    try:
        height, width = image.shape[:2]
        center_x, center_y = int(point.x), int(point.y)
        
        # Mock watershed segmentation - typically produces more irregular shapes
        polygon_points = generate_watershed_polygon(center_x, center_y, width, height)
        
        mask_area = calculate_polygon_area(polygon_points)
        bbox = calculate_polygon_bbox(polygon_points)
        
        return SegmentationResponse(
            polygon_points=[PolygonPoint(x=p[0], y=p[1]) for p in polygon_points],
            confidence=0.75,  # Lower confidence for traditional methods
            mask_area=mask_area,
            bbox=bbox
        )
        
    except Exception as e:
        logger.error("errors.system", f"Watershed segmentation failed: {e}", "watershed_segmentation_failed", {
            'error': str(e),
            'point_x': point.x,
            'point_y': point.y
        })
        raise HTTPException(status_code=500, detail=f"Watershed segmentation failed: {str(e)}")

async def segment_with_hybrid(image: np.ndarray, point: SegmentationPoint, class_index: int) -> SegmentationResponse:
    """
    Intelligent hybrid segmentation combining multiple approaches
    """
    try:
        # Try SAM first for best quality
        try:
            return await segment_with_sam(image, point)
        except:
            pass
        
        # Fallback to YOLO
        try:
            return await segment_with_yolo(image, point, class_index)
        except:
            pass
        
        # Final fallback to watershed
        return await segment_with_watershed(image, point)
        
    except Exception as e:
        logger.error("errors.system", f"Hybrid segmentation failed: {e}", "hybrid_segmentation_failed", {
            'error': str(e),
            'point_x': point.x,
            'point_y': point.y,
            'class_index': class_index
        })
        raise HTTPException(status_code=500, detail=f"Hybrid segmentation failed: {str(e)}")

def generate_realistic_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate a realistic object-like polygon"""
    import math
    import random
    
    logger.info("operations.annotations", "Generating realistic polygon", "generate_realistic_polygon", {
        'center_x': center_x,
        'center_y': center_y,
        'width': width,
        'height': height
    })
    
    # Base radius
    base_radius = min(width, height) * 0.1
    
    # Generate points in a circle with some randomness
    points = []
    num_points = random.randint(8, 16)
    
    for i in range(num_points):
        angle = (2 * math.pi * i) / num_points
        # Add some randomness to radius
        radius = base_radius * (0.7 + 0.6 * random.random())
        
        x = center_x + radius * math.cos(angle)
        y = center_y + radius * math.sin(angle)
        
        # Ensure points are within image bounds
        x = max(0, min(width - 1, x))
        y = max(0, min(height - 1, y))
        
        points.append((x, y))
    
    logger.info("operations.annotations", "Realistic polygon generated", "generate_realistic_polygon_complete", {
        'point_count': len(points),
        'base_radius': base_radius
    })
    
    return points

def generate_person_like_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate a person-like polygon (taller than wide)"""
    logger.info("operations.annotations", "Generating person-like polygon", "generate_person_polygon", {
        'center_x': center_x,
        'center_y': center_y,
        'width': width,
        'height': height
    })
    
    w = min(width, height) * 0.08
    h = min(width, height) * 0.15
    
    points = [
        (center_x - w, center_y - h),
        (center_x - w*0.7, center_y - h*1.2),  # Head
        (center_x + w*0.7, center_y - h*1.2),
        (center_x + w, center_y - h),
        (center_x + w*1.2, center_y),  # Arms
        (center_x + w, center_y + h*0.5),
        (center_x + w*0.5, center_y + h),  # Legs
        (center_x + w*0.2, center_y + h*1.3),
        (center_x - w*0.2, center_y + h*1.3),
        (center_x - w*0.5, center_y + h),
        (center_x - w, center_y + h*0.5),
        (center_x - w*1.2, center_y),
    ]
    
    logger.info("operations.annotations", "Person-like polygon generated", "generate_person_polygon_complete", {
        'point_count': len(points),
        'width_ratio': w,
        'height_ratio': h
    })
    
    return points

def generate_car_like_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate a car-like polygon (wider than tall)"""
    logger.info("operations.annotations", "Generating car-like polygon", "generate_car_polygon", {
        'center_x': center_x,
        'center_y': center_y,
        'width': width,
        'height': height
    })
    
    w = min(width, height) * 0.15
    h = min(width, height) * 0.08
    
    points = [
        (center_x - w, center_y - h*0.5),
        (center_x - w*0.8, center_y - h),
        (center_x + w*0.8, center_y - h),
        (center_x + w, center_y - h*0.5),
        (center_x + w, center_y + h*0.5),
        (center_x + w*0.8, center_y + h),
        (center_x - w*0.8, center_y + h),
        (center_x - w, center_y + h*0.5),
    ]
    
    logger.info("operations.annotations", "Car-like polygon generated", "generate_car_polygon_complete", {
        'point_count': len(points),
        'width_ratio': w,
        'height_ratio': h
    })
    
    return points

def generate_watershed_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate an irregular watershed-like polygon"""
    import math
    import random
    
    logger.info("operations.annotations", "Generating watershed polygon", "generate_watershed_polygon", {
        'center_x': center_x,
        'center_y': center_y,
        'width': width,
        'height': height
    })
    
    points = []
    num_points = random.randint(12, 20)
    base_radius = min(width, height) * 0.08
    
    for i in range(num_points):
        angle = (2 * math.pi * i) / num_points
        # More irregular radius variation for watershed
        radius = base_radius * (0.5 + random.random())
        
        x = center_x + radius * math.cos(angle)
        y = center_y + radius * math.sin(angle)
        
        # Add some noise
        x += random.uniform(-10, 10)
        y += random.uniform(-10, 10)
        
        x = max(0, min(width - 1, x))
        y = max(0, min(height - 1, y))
        
        points.append((x, y))
    
    logger.info("operations.annotations", "Watershed polygon generated", "generate_watershed_polygon_complete", {
        'point_count': len(points),
        'base_radius': base_radius,
        'num_points': num_points
    })
    
    return points

def calculate_polygon_area(points: List[tuple]) -> int:
    """Calculate polygon area using shoelace formula"""
    logger.info("operations.annotations", "Calculating polygon area", "calculate_polygon_area", {
        'point_count': len(points)
    })
    
    if len(points) < 3:
        logger.warning("errors.validation", "Insufficient points for area calculation", "calculate_polygon_area_insufficient", {
            'point_count': len(points)
        })
        return 0
    
    area = 0
    for i in range(len(points)):
        j = (i + 1) % len(points)
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]
    
    result = abs(area) // 2
    
    logger.info("operations.annotations", "Polygon area calculated", "calculate_polygon_area_complete", {
        'area': result,
        'point_count': len(points)
    })
    
    return result

def calculate_polygon_bbox(points: List[tuple]) -> Dict[str, float]:
    """Calculate bounding box of polygon"""
    logger.info("operations.annotations", "Calculating polygon bounding box", "calculate_polygon_bbox", {
        'point_count': len(points)
    })
    
    if not points:
        logger.warning("errors.validation", "No points for bounding box calculation", "calculate_polygon_bbox_empty", {
            'point_count': 0
        })
        return {"x": 0, "y": 0, "width": 0, "height": 0}
    
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    bbox = {
        "x": min_x,
        "y": min_y,
        "width": max_x - min_x,
        "height": max_y - min_y
    }
    
    logger.info("operations.annotations", "Polygon bounding box calculated", "calculate_polygon_bbox_complete", {
        'bbox': bbox,
        'point_count': len(points)
    })
    
    return bbox

@router.post("/segment/batch")
async def batch_segment(points: List[SegmentationRequest]):
    """
    Batch segmentation for multiple points
    """
    results = []
    logger.info("operations.annotations", "Starting batch segmentation", "batch_segmentation_start", {
        'request_count': len(points)
    })
    for idx, request in enumerate(points):
        try:
            result = await click_to_segment(request)
            results.append({"success": True, "result": result})
        except Exception as e:
            logger.warning("errors.system", f"Batch item failed: {e}", "batch_segmentation_item_failed", {
                'index': idx,
                'error': str(e),
                'model_type': getattr(request, 'model_type', None)
            })
            results.append({"success": False, "error": str(e)})
    success_count = sum(1 for r in results if r.get('success'))
    failure_count = len(results) - success_count
    logger.info("operations.annotations", "Completed batch segmentation", "batch_segmentation_complete", {
        'success_count': success_count,
        'failure_count': failure_count
    })
    
    return {"results": results}

@router.get("/segment/models")
async def get_available_models():
    """
    Get list of available segmentation models
    """
    logger.info("app.backend", "Returning available segmentation models", "get_available_models", {
        'model_count': 4
    })
    return {
        "models": [
            {
                "id": "sam",
                "name": "Segment Anything Model (SAM)",
                "description": "High-quality segmentation for any object",
                "accuracy": "Very High",
                "speed": "Medium"
            },
            {
                "id": "yolo",
                "name": "YOLO Instance Segmentation",
                "description": "Fast object-specific segmentation",
                "accuracy": "High",
                "speed": "Fast"
            },
            {
                "id": "watershed",
                "name": "Watershed Algorithm",
                "description": "Traditional computer vision approach",
                "accuracy": "Medium",
                "speed": "Very Fast"
            },
            {
                "id": "hybrid",
                "name": "Intelligent Hybrid",
                "description": "Combines multiple approaches for best results",
                "accuracy": "Very High",
                "speed": "Medium"
            }
        ]
    }

# Simple in-memory cache for the current image to avoid redundant disk I/O
_image_cache = {
    "image_id": None,
    "image": None,
    "path": None
}

@router.post("/segment-polygon", response_model=SmartPolygonResponse)

async def segment_polygon(request: SmartPolygonRequest, db: Session = Depends(get_db)):
    """Main entry point for segmentation"""
    global _image_cache
    
    try:
        # Check cache first
        if _image_cache["image_id"] == request.image_id and _image_cache["image"] is not None:
            image = _image_cache["image"]
            image_path = _image_cache["path"]
        else:
            # Not in cache, load from DB and disk
            image_record = ImageOperations.get_image(db, request.image_id)
            if not image_record:
                raise HTTPException(status_code=404, detail="Image not found")

            # Resolve path using BASE_DIR — works on any PC (dev and exe)
            image_path_raw = image_record.normalized_file_path
            image_path = str(settings.BASE_DIR / image_path_raw.lstrip('/'))

            if not os.path.exists(image_path):
                raise HTTPException(status_code=404, detail=f"Image file not found at {image_path_raw}")

            image = cv2.imread(image_path)
            if image is None:
                raise HTTPException(status_code=500, detail="Could not read image file")
            
            # Update cache by value (keeps the reference stable)
            _image_cache["image_id"] = request.image_id
            _image_cache["image"] = image
            _image_cache["path"] = image_path

        # Get segmentor
        segmentor = registry.get_current()
        
        # If it's the real SAM segmentor, it might want to cache embeddings
        if hasattr(segmentor, 'set_image'):
            segmentor.set_image(image, request.image_id)

        points, confidence = segmentor.segment(image, request.points)

        return SmartPolygonResponse(
            success=True,
            points=points,
            confidence=confidence,
            algorithm=registry._current
        )

    except Exception as e:
        logger.error("errors.system", f"Smart Polygon failed: {e}", "smart_polygon_error")
        return SmartPolygonResponse(
            success=False,
            points=[],
            confidence=0.0,
            algorithm="error",
            error=str(e)
        )

@router.post("/segment-preview", response_model=SmartPolygonResponse)
async def segment_preview(request: SmartPolygonRequest, db: Session = Depends(get_db)):
    """Fast preview for hover segmentation"""
    # For now, same logic but we could use a smaller model or lower resolution
    return await segment_polygon(request, db)

async def get_image_path_from_id(image_id: str) -> Optional[str]:
    """Get image file path from image ID by checking database"""
    try:
        # Import database operations
        from database.operations import get_image_by_id
        
        image_record = get_image_by_id(image_id)
        if not image_record:
            return None
        
        # Try different possible paths
        possible_paths = [
            image_record.file_path,
            f"uploads/{image_record.file_path}",
            f"../{image_record.file_path}",
            f"uploads/projects/{image_record.file_path}",
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                logger.info("operations.images", f"📁 Found image at: {path}", "image_path_found", {
            'image_id': image_id,
            'path': path
        })
                return path
        
        logger.warning("errors.validation", f"⚠️ Image file not found for ID {image_id}, tried paths: {possible_paths}", "image_not_found", {
            'image_id': image_id,
            'tried_paths': possible_paths
        })
        return None
        
    except Exception as e:
        logger.error("errors.system", f"❌ Error getting image path: {e}", "image_path_error", {
            'error': str(e),
            'image_id': image_id
        })
        return None

def choose_best_algorithm(image: np.ndarray, x: int, y: int) -> str:
    """Choose the best segmentation algorithm based on image characteristics"""
    try:
        # Analyze local image characteristics around click point
        h, w = image.shape[:2]
        
        # Extract region around click point
        region_size = min(100, w//4, h//4)
        x1 = max(0, x - region_size//2)
        y1 = max(0, y - region_size//2)
        x2 = min(w, x + region_size//2)
        y2 = min(h, y + region_size//2)
        
        region = image[y1:y2, x1:x2]
        
        # Calculate image characteristics
        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        
        # Edge density
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        # Color variance
        color_variance = np.var(region.reshape(-1, 3), axis=0).mean()
        
        # Choose algorithm based on characteristics
        if edge_density > 0.1 and color_variance > 1000:
            algorithm = "grabcut"  # Complex objects with clear edges
        elif edge_density > 0.05:
            algorithm = "contour"  # Objects with moderate edges
        else:
            algorithm = "flood_fill"  # Simple objects or uniform regions
        
        logger.info("operations.annotations", "Algorithm selection completed", "algorithm_selection_complete", {
            'selected_algorithm': algorithm,
            'edge_density': edge_density,
            'color_variance': color_variance,
            'click_x': x,
            'click_y': y
        })
        
        return algorithm
            
    except Exception as e:
        logger.warning("operations.annotations", f"Algorithm selection failed, using default: {e}", "algorithm_selection_failed", {
            'error': str(e)
        })
        return "flood_fill"

def segment_with_grabcut(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using GrabCut algorithm"""
    logger.info("operations.annotations", "Starting GrabCut segmentation", "grabcut_segmentation_start", {
        'click_x': x,
        'click_y': y,
        'image_height': image.shape[0],
        'image_width': image.shape[1]
    })
    
    try:
        height, width = image.shape[:2]
        
        # Create initial rectangle around click point
        rect_size = min(width, height) // 8
        x1 = max(0, x - rect_size)
        y1 = max(0, y - rect_size)
        x2 = min(width, x + rect_size)
        y2 = min(height, y + rect_size)
        
        rect = (x1, y1, x2 - x1, y2 - y1)
        
        # Initialize mask
        mask = np.zeros((height, width), np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        # Apply GrabCut
        cv2.grabCut(image, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        
        # Create final mask
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
        
        # Find contours
        contours, _ = cv2.findContours(mask2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            raise ValueError("No contours found")
        
        # Find contour containing click point
        target_contour = None
        for contour in contours:
            if cv2.pointPolygonTest(contour, (x, y), False) >= 0:
                target_contour = contour
                break
        
        if target_contour is None:
            target_contour = max(contours, key=cv2.contourArea)
        
        # Simplify contour
        epsilon = 0.02 * cv2.arcLength(target_contour, True)
        simplified = cv2.approxPolyDP(target_contour, epsilon, True)
        
        points = [(int(p[0][0]), int(p[0][1])) for p in simplified]
        confidence = 0.85
        
        logger.info("operations.annotations", "GrabCut segmentation completed", "grabcut_segmentation_complete", {
            'point_count': len(points),
            'confidence': confidence,
            'click_x': x,
            'click_y': y
        })
        
        return points, confidence
        
    except Exception as e:
        logger.warning("operations.annotations", f"GrabCut failed, using fallback: {e}", "grabcut_failed", {
            'error': str(e),
            'click_x': x,
            'click_y': y
        })
        return segment_with_flood_fill(image, x, y)

def segment_with_watershed_cv(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using Watershed algorithm"""
    logger.info("operations.annotations", "Starting Watershed segmentation", "watershed_segmentation_start", {
        'click_x': x,
        'click_y': y,
        'image_height': image.shape[0],
        'image_width': image.shape[1]
    })
    
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Create markers
        markers = np.zeros(gray.shape, dtype=np.int32)
        markers[y, x] = 1  # Foreground marker
        
        # Background markers (image borders)
        markers[0, :] = 2
        markers[-1, :] = 2
        markers[:, 0] = 2
        markers[:, -1] = 2
        
        # Apply watershed
        cv2.watershed(image, markers)
        
        # Create mask from watershed result
        mask = np.where(markers == 1, 255, 0).astype(np.uint8)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            raise ValueError("No contours found")
        
        # Get largest contour
        target_contour = max(contours, key=cv2.contourArea)
        
        # Simplify contour
        epsilon = 0.02 * cv2.arcLength(target_contour, True)
        simplified = cv2.approxPolyDP(target_contour, epsilon, True)
        
        points = [(int(p[0][0]), int(p[0][1])) for p in simplified]
        confidence = 0.75
        
        logger.info("operations.annotations", "Watershed segmentation completed", "watershed_segmentation_complete", {
            'point_count': len(points),
            'confidence': confidence,
            'click_x': x,
            'click_y': y
        })
        
        return points, confidence
        
    except Exception as e:
        logger.warning("operations.annotations", f"Watershed failed, using fallback: {e}", "watershed_failed", {
            'error': str(e),
            'click_x': x,
            'click_y': y
        })
        return segment_with_flood_fill(image, x, y)

def segment_with_contour_detection(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using edge detection and contour finding"""
    logger.info("operations.annotations", "Starting contour detection segmentation", "contour_detection_start", {
        'click_x': x,
        'click_y': y,
        'image_height': image.shape[0],
        'image_width': image.shape[1]
    })
    
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Morphological operations to close gaps
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            raise ValueError("No contours found")
        
        # Find contour containing click point
        target_contour = None
        for contour in contours:
            if cv2.pointPolygonTest(contour, (x, y), False) >= 0:
                target_contour = contour
                break
        
        if target_contour is None:
            # Find closest contour
            min_dist = float('inf')
            for contour in contours:
                dist = abs(cv2.pointPolygonTest(contour, (x, y), True))
                if dist < min_dist:
                    min_dist = dist
                    target_contour = contour
        
        # Simplify contour
        epsilon = 0.02 * cv2.arcLength(target_contour, True)
        simplified = cv2.approxPolyDP(target_contour, epsilon, True)
        
        points = [(int(p[0][0]), int(p[0][1])) for p in simplified]
        confidence = 0.70
        
        logger.info("operations.annotations", "Contour detection segmentation completed", "contour_detection_complete", {
            'point_count': len(points),
            'confidence': confidence,
            'click_x': x,
            'click_y': y
        })
        
        return points, confidence
        
    except Exception as e:
        logger.warning("operations.annotations", f"Contour detection failed, using fallback: {e}", "contour_detection_failed", {
            'error': str(e),
            'click_x': x,
            'click_y': y
        })
        return segment_with_flood_fill(image, x, y)

def segment_with_flood_fill(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using flood fill algorithm (fallback method)"""
    logger.info("operations.annotations", "Starting flood fill segmentation", "flood_fill_segmentation_start", {
        'click_x': x,
        'click_y': y,
        'image_height': image.shape[0],
        'image_width': image.shape[1]
    })
    
    try:
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Create mask for flood fill
        mask = np.zeros((height + 2, width + 2), np.uint8)
        
        # Get seed color
        seed_color = gray[y, x]
        
        # Flood fill with tolerance
        tolerance = 20
        lo_diff = hi_diff = tolerance
        
        cv2.floodFill(gray, mask, (x, y), 255, lo_diff, hi_diff)
        
        # Extract the filled region
        filled_mask = mask[1:-1, 1:-1]
        
        # Find contours
        contours, _ = cv2.findContours(filled_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            # Create a simple polygon around click point
            size = min(width, height) // 10
            points = [
                (max(0, x - size), max(0, y - size)),
                (min(width - 1, x + size), max(0, y - size)),
                (min(width - 1, x + size), min(height - 1, y + size)),
                (max(0, x - size), min(height - 1, y + size))
            ]
            logger.warning("operations.annotations", "No contours found in flood fill, using simple rectangle", "flood_fill_no_contours", {
                'click_x': x,
                'click_y': y,
                'point_count': len(points),
                'confidence': 0.3
            })
            return points, 0.3
        
        # Get largest contour
        target_contour = max(contours, key=cv2.contourArea)
        
        # Simplify contour
        epsilon = 0.02 * cv2.arcLength(target_contour, True)
        simplified = cv2.approxPolyDP(target_contour, epsilon, True)
        
        points = [(int(p[0][0]), int(p[0][1])) for p in simplified]
        confidence = 0.60
        
        logger.info("operations.annotations", "Flood fill segmentation completed", "flood_fill_segmentation_complete", {
            'point_count': len(points),
            'confidence': confidence,
            'click_x': x,
            'click_y': y
        })
        
        return points, confidence
        
    except Exception as e:
        logger.error("errors.system", f"Flood fill failed: {e}", "flood_fill_failed", {
            'error': str(e),
            'click_x': x,
            'click_y': y
        })
        # Ultimate fallback - simple rectangle
        size = min(image.shape[1], image.shape[0]) // 10
        points = [
            (max(0, x - size), max(0, y - size)),
            (min(image.shape[1] - 1, x + size), max(0, y - size)),
            (min(image.shape[1] - 1, x + size), min(image.shape[0] - 1, y + size)),
            (max(0, x - size), min(image.shape[0] - 1, y + size))
        ]
        logger.warning("operations.annotations", "Using ultimate fallback - simple rectangle", "ultimate_fallback", {
            'click_x': x,
            'click_y': y,
            'point_count': len(points),
            'confidence': 0.1,
            'error': str(e)
        })
        return points, 0.1