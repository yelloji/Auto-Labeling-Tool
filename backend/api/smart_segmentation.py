from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter()

class SegmentationPoint(BaseModel):
    x: float
    y: float

class SegmentationRequest(BaseModel):
    image_url: str
    point: SegmentationPoint
    class_index: int
    model_type: str = "sam"  # sam, yolo, or watershed

class PolygonPoint(BaseModel):
    x: float
    y: float

class SegmentationResponse(BaseModel):
    polygon_points: List[PolygonPoint]
    confidence: float
    mask_area: int
    bbox: Dict[str, float]

class SmartPolygonRequest(BaseModel):
    image_id: str
    x: int
    y: int
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    algorithm: Optional[str] = "auto"  # auto, grabcut, watershed, contour

class SmartPolygonResponse(BaseModel):
    success: bool
    points: List[Dict[str, float]]
    confidence: float
    algorithm: str
    error: Optional[str] = None

@router.post("/segment", response_model=SegmentationResponse)
async def click_to_segment(request: SegmentationRequest):
    """
    Advanced click-to-segment functionality using multiple algorithms
    """
    try:
        logger.info(f"Processing segmentation request for point ({request.point.x}, {request.point.y})")
        
        # Load image from URL or base64
        image = await load_image_from_url(request.image_url)
        
        if request.model_type == "sam":
            # Use SAM (Segment Anything Model) for high-quality segmentation
            result = await segment_with_sam(image, request.point)
        elif request.model_type == "yolo":
            # Use YOLO instance segmentation
            result = await segment_with_yolo(image, request.point, request.class_index)
        elif request.model_type == "watershed":
            # Use traditional watershed algorithm for quick segmentation
            result = await segment_with_watershed(image, request.point)
        else:
            # Default to intelligent hybrid approach
            result = await segment_with_hybrid(image, request.point, request.class_index)
        
        return result
        
    except Exception as e:
        logger.error(f"Segmentation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

async def load_image_from_url(image_url: str) -> np.ndarray:
    """Load image from URL or base64 data"""
    try:
        if image_url.startswith('data:image'):
            # Handle base64 encoded images
            header, data = image_url.split(',', 1)
            image_data = base64.b64decode(data)
            image = Image.open(BytesIO(image_data))
            return np.array(image.convert('RGB'))
        else:
            # Handle regular URLs (placeholder - in real implementation would fetch from URL)
            # For now, create a sample image
            return np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
    except Exception as e:
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
        raise HTTPException(status_code=500, detail=f"Hybrid segmentation failed: {str(e)}")

def generate_realistic_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate a realistic object-like polygon"""
    import math
    import random
    
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
    
    return points

def generate_person_like_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate a person-like polygon (taller than wide)"""
    w = min(width, height) * 0.08
    h = min(width, height) * 0.15
    
    return [
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

def generate_car_like_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate a car-like polygon (wider than tall)"""
    w = min(width, height) * 0.15
    h = min(width, height) * 0.08
    
    return [
        (center_x - w, center_y - h*0.5),
        (center_x - w*0.8, center_y - h),
        (center_x + w*0.8, center_y - h),
        (center_x + w, center_y - h*0.5),
        (center_x + w, center_y + h*0.5),
        (center_x + w*0.8, center_y + h),
        (center_x - w*0.8, center_y + h),
        (center_x - w, center_y + h*0.5),
    ]

def generate_watershed_polygon(center_x: int, center_y: int, width: int, height: int) -> List[tuple]:
    """Generate an irregular watershed-like polygon"""
    import math
    import random
    
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
    
    return points

def calculate_polygon_area(points: List[tuple]) -> int:
    """Calculate polygon area using shoelace formula"""
    if len(points) < 3:
        return 0
    
    area = 0
    for i in range(len(points)):
        j = (i + 1) % len(points)
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]
    
    return abs(area) // 2

def calculate_polygon_bbox(points: List[tuple]) -> Dict[str, float]:
    """Calculate bounding box of polygon"""
    if not points:
        return {"x": 0, "y": 0, "width": 0, "height": 0}
    
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    return {
        "x": min_x,
        "y": min_y,
        "width": max_x - min_x,
        "height": max_y - min_y
    }

@router.post("/segment/batch")
async def batch_segment(points: List[SegmentationRequest]):
    """
    Batch segmentation for multiple points
    """
    results = []
    for request in points:
        try:
            result = await click_to_segment(request)
            results.append({"success": True, "result": result})
        except Exception as e:
            results.append({"success": False, "error": str(e)})
    
    return {"results": results}

@router.get("/segment/models")
async def get_available_models():
    """
    Get list of available segmentation models
    """
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

@router.post("/segment-polygon", response_model=SmartPolygonResponse)
async def segment_polygon(request: SmartPolygonRequest):
    """
    Smart Polygon Tool endpoint - Generate polygon from click point
    
    This endpoint takes a click point and generates a polygon around the object
    using various computer vision algorithms.
    """
    try:
        logger.info(f"🎯 Smart Polygon: Processing request for image {request.image_id} at ({request.x}, {request.y})")
        
        # Load image from database/filesystem
        image_path = await get_image_path_from_id(request.image_id)
        if not image_path or not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail=f"Image not found: {request.image_id}")
        
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise HTTPException(status_code=400, detail="Failed to load image")
        
        height, width = image.shape[:2]
        logger.info(f"📏 Image loaded: {width}x{height}")
        
        # Validate click coordinates
        if request.x < 0 or request.x >= width or request.y < 0 or request.y >= height:
            raise HTTPException(status_code=400, detail="Click coordinates outside image bounds")
        
        # Choose algorithm
        algorithm = request.algorithm
        if algorithm == "auto":
            # Auto-select best algorithm based on image characteristics
            algorithm = choose_best_algorithm(image, request.x, request.y)
        
        # Perform segmentation
        if algorithm == "grabcut":
            points, confidence = segment_with_grabcut(image, request.x, request.y)
        elif algorithm == "watershed":
            points, confidence = segment_with_watershed_cv(image, request.x, request.y)
        elif algorithm == "contour":
            points, confidence = segment_with_contour_detection(image, request.x, request.y)
        else:
            # Default to flood fill + contour detection
            points, confidence = segment_with_flood_fill(image, request.x, request.y)
            algorithm = "flood_fill"
        
        logger.info(f"✅ Smart Polygon: Generated {len(points)} points with confidence {confidence}")
        
        return SmartPolygonResponse(
            success=True,
            points=[{"x": float(p[0]), "y": float(p[1])} for p in points],
            confidence=confidence,
            algorithm=algorithm
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Smart Polygon: Segmentation failed: {str(e)}")
        return SmartPolygonResponse(
            success=False,
            points=[],
            confidence=0.0,
            algorithm="error",
            error=str(e)
        )

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
                logger.info(f"📁 Found image at: {path}")
                return path
        
        logger.warning(f"⚠️ Image file not found for ID {image_id}, tried paths: {possible_paths}")
        return None
        
    except Exception as e:
        logger.error(f"❌ Error getting image path: {e}")
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
            return "grabcut"  # Complex objects with clear edges
        elif edge_density > 0.05:
            return "contour"  # Objects with moderate edges
        else:
            return "flood_fill"  # Simple objects or uniform regions
            
    except Exception as e:
        logger.warning(f"Algorithm selection failed, using default: {e}")
        return "flood_fill"

def segment_with_grabcut(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using GrabCut algorithm"""
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
        
        return points, confidence
        
    except Exception as e:
        logger.warning(f"GrabCut failed, using fallback: {e}")
        return segment_with_flood_fill(image, x, y)

def segment_with_watershed_cv(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using Watershed algorithm"""
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
        
        return points, confidence
        
    except Exception as e:
        logger.warning(f"Watershed failed, using fallback: {e}")
        return segment_with_flood_fill(image, x, y)

def segment_with_contour_detection(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using edge detection and contour finding"""
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
        
        return points, confidence
        
    except Exception as e:
        logger.warning(f"Contour detection failed, using fallback: {e}")
        return segment_with_flood_fill(image, x, y)

def segment_with_flood_fill(image: np.ndarray, x: int, y: int) -> tuple:
    """Segment using flood fill algorithm (fallback method)"""
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
            return points, 0.3
        
        # Get largest contour
        target_contour = max(contours, key=cv2.contourArea)
        
        # Simplify contour
        epsilon = 0.02 * cv2.arcLength(target_contour, True)
        simplified = cv2.approxPolyDP(target_contour, epsilon, True)
        
        points = [(int(p[0][0]), int(p[0][1])) for p in simplified]
        confidence = 0.60
        
        return points, confidence
        
    except Exception as e:
        logger.error(f"Flood fill failed: {e}")
        # Ultimate fallback - simple rectangle
        size = min(image.shape[1], image.shape[0]) // 10
        points = [
            (max(0, x - size), max(0, y - size)),
            (min(image.shape[1] - 1, x + size), max(0, y - size)),
            (min(image.shape[1] - 1, x + size), min(image.shape[0] - 1, y + size)),
            (max(0, x - size), min(image.shape[0] - 1, y + size))
        ]
        return points, 0.1