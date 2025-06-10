import React, { useRef, useEffect, useState, useCallback } from 'react';
import SmartPolygonTool from './SmartPolygonTool';

const AnnotationCanvas = ({
  imageUrl,
  imageId,
  annotations = [],
  selectedAnnotation = null,
  activeTool = 'box',
  zoomLevel = 100,
  onShapeComplete,
  onAnnotationSelect,
  onAnnotationDelete,
  onImagePositionChange,
  style = {}
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  // Initialize Smart Polygon Tool
  const smartPolygonTool = SmartPolygonTool({
    imageUrl,
    imageId,
    onPolygonComplete: onShapeComplete,
    isActive: activeTool === 'smart_polygon',
    zoomLevel,
    imagePosition,
    imageSize
  });



  // Initialize canvas and load image - supports all formats and sizes with retry logic
  useEffect(() => {
    if (!imageUrl) {
      console.log('AnnotationCanvas: No imageUrl provided');
      return;
    }

    let retryCount = 0;
    const maxRetries = 5; // Increased retries
    let isCancelled = false;
    
    const loadImage = () => {
      if (isCancelled) return;
      
      const img = new Image();
      
      // Enable cross-origin for external images
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        if (isCancelled) return;
        console.log(`✅ Image loaded successfully: ${img.width}x${img.height} pixels`);
        console.log(`✅ Image URL: ${imageUrl}`);
        imageRef.current = img;
        setImageSize({ width: img.width, height: img.height });
        resizeCanvas();
      };
      
      img.onerror = (error) => {
        if (isCancelled) return;
        console.error('❌ AnnotationCanvas: Failed to load image:', error);
        console.error('❌ Image URL:', imageUrl);
        console.error('❌ Retry count:', retryCount);
        
        // Retry loading with a delay
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Retrying image load (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(() => {
            if (!isCancelled) {
              loadImage();
            }
          }, 500 * retryCount); // Shorter delay for faster retries
        } else {
          console.error('💥 Max retries reached. Image failed to load.');
          console.error('💥 Final URL that failed:', imageUrl);
        }
      };
      
      // Support all image formats: JPG, PNG, GIF, WEBP, BMP, SVG, etc.
      img.src = imageUrl;
      
      console.log('🔄 Loading image:', imageUrl);
    };
    
    loadImage();
    
    // Cleanup function to cancel loading if component unmounts or imageUrl changes
    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  // Clear incomplete polygon when tool changes - FIX FOR STUCK POLYGON BUG
  useEffect(() => {
    if (activeTool !== 'polygon' && polygonPoints.length > 0) {
      console.log('Clearing incomplete polygon due to tool change');
      setPolygonPoints([]);
    }
  }, [activeTool, polygonPoints.length]);

  // Resize canvas to fit container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageRef.current) return;

    const containerRect = container.getBoundingClientRect();
    const img = imageRef.current;
    
    // Use the full container size for better layout
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Calculate image display size maintaining aspect ratio for ANY size
    const containerAspect = containerWidth / containerHeight;
    const imageAspect = img.width / img.height;
    
    let displayWidth, displayHeight;
    
    // Handle extreme aspect ratios and any image dimensions
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width (works for panoramic, wide images)
      displayWidth = Math.min(containerWidth * 0.95, img.width);
      displayHeight = displayWidth / imageAspect;
      
      // Ensure height doesn't exceed container
      if (displayHeight > containerHeight * 0.95) {
        displayHeight = containerHeight * 0.95;
        displayWidth = displayHeight * imageAspect;
      }
    } else {
      // Image is taller - fit to height (works for portrait, tall images)
      displayHeight = Math.min(containerHeight * 0.95, img.height);
      displayWidth = displayHeight * imageAspect;
      
      // Ensure width doesn't exceed container
      if (displayWidth > containerWidth * 0.95) {
        displayWidth = containerWidth * 0.95;
        displayHeight = displayWidth / imageAspect;
      }
    }
    
    // Handle very small images - ensure minimum display size
    const minSize = 100;
    if (displayWidth < minSize || displayHeight < minSize) {
      if (displayWidth < displayHeight) {
        displayWidth = minSize;
        displayHeight = minSize / imageAspect;
      } else {
        displayHeight = minSize;
        displayWidth = minSize * imageAspect;
      }
    }

    // Apply zoom
    displayWidth *= (zoomLevel / 100);
    displayHeight *= (zoomLevel / 100);

    // Center the image in the canvas
    const x = (containerWidth - displayWidth) / 2;
    const y = (containerHeight - displayHeight) / 2;

    const newPosition = { x, y };
    setImagePosition(newPosition);
    if (onImagePositionChange) {
      onImagePositionChange(newPosition);
    }
    setCanvasSize({ width: containerWidth, height: containerHeight });

    // Set canvas size to match container
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Redraw everything
    redrawCanvas();
  }, [zoomLevel]);

  // Redraw canvas with image and annotations
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const displayWidth = imageSize.width * (zoomLevel / 100);
    const displayHeight = imageSize.height * (zoomLevel / 100);
    
    ctx.drawImage(
      img,
      imagePosition.x,
      imagePosition.y,
      displayWidth,
      displayHeight
    );

    // Draw existing annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation, annotation.id === selectedAnnotation?.id);
    });

    // Draw current shape being drawn
    if (currentShape) {
      drawShape(ctx, currentShape, true);
    }

    // Draw polygon points
    if (activeTool === 'polygon' && polygonPoints.length > 0) {
      drawPolygonInProgress(ctx, polygonPoints);
    }

    // Draw smart polygon
    if (activeTool === 'smart_polygon') {
      smartPolygonTool.renderPolygon(ctx);
    }
  }, [annotations, selectedAnnotation, currentShape, polygonPoints, activeTool, imagePosition, imageSize, zoomLevel, smartPolygonTool]);

  // Draw a single annotation
  const drawAnnotation = (ctx, annotation, isSelected = false) => {
    console.log('Drawing annotation:', annotation);
    console.log('Annotation type:', annotation.type);
    
    // Set styles based on selection state
    ctx.strokeStyle = isSelected ? '#ff4d4f' : (annotation.color || '#1890ff');
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.fillStyle = isSelected ? 'rgba(255, 77, 79, 0.1)' : 'rgba(24, 144, 255, 0.1)';
    
    const scale = zoomLevel / 100;
    
    // For all annotation types, we need these coordinates
    const x = imagePosition.x + (annotation.x * scale);
    const y = imagePosition.y + (annotation.y * scale);
    const width = annotation.width * scale;
    const height = annotation.height * scale;
    
    console.log(`Drawing annotation type: ${annotation.type}, coordinates: (${x}, ${y}, ${width}, ${height})`);
    if (annotation.type === 'polygon') {
      console.log('Polygon points:', annotation.points);
    }

    if (annotation.type === 'box') {
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      
      // Draw label
      if (annotation.label) {
        ctx.fillStyle = annotation.color || '#1890ff';
        ctx.fillRect(x, y - 20, ctx.measureText(annotation.label).width + 8, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(annotation.label, x + 4, y - 6);
      }
    } else if (annotation.type === 'polygon' && annotation.points) {
      console.log('Drawing polygon with points:', annotation.points);
      
      // Make sure we have valid points
      if (!Array.isArray(annotation.points) || annotation.points.length < 3) {
        console.warn('Not enough points to draw polygon:', annotation.points);
        return;
      }
      
      // Draw the polygon
      ctx.beginPath();
      let validPointsCount = 0;
      
      annotation.points.forEach((point, index) => {
        // Check if point is valid
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
          console.warn('Invalid polygon point:', point);
          return;
        }
        
        validPointsCount++;
        const px = imagePosition.x + (point.x * scale);
        const py = imagePosition.y + (point.y * scale);
        
        if (index === 0 || validPointsCount === 1) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      
      // Only close and fill if we have enough valid points
      if (validPointsCount >= 3) {
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw points at each vertex for better visibility
        annotation.points.forEach(point => {
          if (point && typeof point.x === 'number' && typeof point.y === 'number') {
            const px = imagePosition.x + (point.x * scale);
            const py = imagePosition.y + (point.y * scale);
            
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, 2 * Math.PI);
            ctx.fillStyle = isSelected ? '#ff4d4f' : '#1890ff';
            ctx.fill();
          }
        });
      } else {
        console.warn('Not enough valid points to draw polygon:', validPointsCount);
      }
      
      // Draw label for polygon too
      if (annotation.label) {
        // Find the topmost point to place the label
        const topY = Math.min(...annotation.points.map(p => p.y)) * scale + imagePosition.y;
        const leftX = Math.min(...annotation.points.map(p => p.x)) * scale + imagePosition.x;
        
        ctx.fillStyle = annotation.color || '#1890ff';
        ctx.fillRect(leftX, topY - 20, ctx.measureText(annotation.label).width + 8, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(annotation.label, leftX + 4, topY - 6);
      }
    }
  };

  // Draw shape being drawn
  const drawShape = (ctx, shape, isActive = false) => {
    ctx.strokeStyle = isActive ? '#52c41a' : '#1890ff';
    ctx.lineWidth = 3; // Make stroke thicker for better visibility
    ctx.fillStyle = isActive ? 'rgba(82, 196, 26, 0.15)' : 'rgba(24, 144, 255, 0.15)';

    if (shape.type === 'box') {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }
  };

  // Draw polygon in progress
  const drawPolygonInProgress = (ctx, points) => {
    if (points.length < 2) return;

    ctx.strokeStyle = '#52c41a';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(82, 196, 26, 0.1)';

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    
    if (points.length > 2) {
      ctx.fill();
    }
    ctx.stroke();

    // Draw points
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#52c41a';
      ctx.fill();
    });
  };

  // Convert screen coordinates to image coordinates
  const screenToImageCoords = (screenX, screenY) => {
    const scale = zoomLevel / 100;
    const imageX = (screenX - imagePosition.x) / scale;
    const imageY = (screenY - imagePosition.y) / scale;
    return { x: imageX, y: imageY };
  };
  
  // Check if a point is inside a polygon using ray casting algorithm
  const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        
      if (intersect) inside = !inside;
    }
    
    return inside;
  };

  // Get mouse position relative to canvas
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    console.log('Mouse down - activeTool:', activeTool);
    if (!activeTool || activeTool === 'select') return;

    const mousePos = getMousePos(e);
    console.log('Mouse down position:', mousePos);
    
    if (activeTool === 'smart_polygon') {
      // Handle smart polygon tool
      smartPolygonTool.handleCanvasClick(e);
    } else if (activeTool === 'box') {
      console.log('Starting box drawing');
      setIsDrawing(true);
      setStartPoint(mousePos);
      setCurrentShape({
        type: 'box',
        x: mousePos.x,
        y: mousePos.y,
        width: 0,
        height: 0
      });
    } else if (activeTool === 'polygon') {
      const newPoint = mousePos;
      setPolygonPoints(prev => [...prev, newPoint]);
    }
  }, [activeTool, smartPolygonTool]);

  const handleMouseMove = useCallback((e) => {
    if (activeTool === 'smart_polygon') {
      // Handle smart polygon tool mouse move
      smartPolygonTool.handleMouseMove(e);
      return;
    }

    if (!isDrawing || !startPoint || activeTool !== 'box') return;

    const mousePos = getMousePos(e);
    const width = mousePos.x - startPoint.x;
    const height = mousePos.y - startPoint.y;

    console.log('Mouse move - drawing box:', {
      start: startPoint,
      current: mousePos,
      width: Math.abs(width),
      height: Math.abs(height)
    });

    setCurrentShape({
      type: 'box',
      x: Math.min(startPoint.x, mousePos.x),
      y: Math.min(startPoint.y, mousePos.y),
      width: Math.abs(width),
      height: Math.abs(height)
    });
  }, [isDrawing, startPoint, activeTool, smartPolygonTool]);

  const handleMouseUp = useCallback((e) => {
    if (activeTool === 'smart_polygon') {
      // Handle smart polygon tool mouse up
      smartPolygonTool.handleMouseUp(e);
      return;
    }

    console.log('Mouse up - isDrawing:', isDrawing, 'currentShape:', currentShape);
    if (!isDrawing || !currentShape || activeTool !== 'box') return;

    setIsDrawing(false);
    
    // Only create shape if it has meaningful size (reduced minimum size)
    if (currentShape.width > 5 && currentShape.height > 5) {
      console.log('✅ Shape completed:', currentShape);
      // Convert to image coordinates
      const imageCoords = screenToImageCoords(currentShape.x, currentShape.y);
      const imageWidth = currentShape.width / (zoomLevel / 100);
      const imageHeight = currentShape.height / (zoomLevel / 100);

      const shape = {
        type: 'box',
        x: imageCoords.x,
        y: imageCoords.y,
        width: imageWidth,
        height: imageHeight
      };

      console.log('✅ Calling onShapeComplete with shape:', shape);
      console.log('✅ onShapeComplete function exists:', !!onShapeComplete);
      
      if (onShapeComplete) {
        onShapeComplete(shape);
        console.log('✅ onShapeComplete called successfully');
      } else {
        console.error('❌ onShapeComplete function is not provided!');
      }
    } else {
      console.log('❌ Shape too small, not creating annotation. Size:', currentShape.width, 'x', currentShape.height);
    }

    // ALWAYS clear the temporary shape immediately after drawing (professional behavior)
    setCurrentShape(null);
    setStartPoint(null);
    redrawCanvas();
    console.log('✅ Box cleared immediately - popup should appear');
  }, [isDrawing, currentShape, activeTool, onShapeComplete, zoomLevel, smartPolygonTool]);

  const handleDoubleClick = useCallback((e) => {
    if (activeTool === 'polygon' && polygonPoints.length >= 3) {
      console.log('✅ Polygon completed with', polygonPoints.length, 'points');
      
      // Complete polygon
      const imagePoints = polygonPoints.map(point => screenToImageCoords(point.x, point.y));
      
      const shape = {
        type: 'polygon',
        points: imagePoints
      };

      console.log('✅ Calling onShapeComplete for polygon:', shape);
      onShapeComplete?.(shape);
      
      // ALWAYS clear polygon points immediately after completion (professional behavior)
      setPolygonPoints([]);
      redrawCanvas();
      console.log('✅ Polygon points cleared immediately - popup should appear');
    }
  }, [activeTool, polygonPoints, onShapeComplete, screenToImageCoords]);

  const handleCanvasClick = useCallback((e) => {
    if (activeTool === 'select') {
      // Check if clicking on an annotation
      const mousePos = getMousePos(e);
      const clickedAnnotation = annotations.find(ann => {
        const scale = zoomLevel / 100;
        
        // For box annotations
        if (ann.type === 'box') {
          const x = imagePosition.x + (ann.x * scale);
          const y = imagePosition.y + (ann.y * scale);
          const width = ann.width * scale;
          const height = ann.height * scale;
  
          return mousePos.x >= x && mousePos.x <= x + width &&
                 mousePos.y >= y && mousePos.y <= y + height;
        } 
        // For polygon annotations
        else if (ann.type === 'polygon' && ann.points && ann.points.length > 0) {
          // Use point-in-polygon algorithm
          const scaledPoints = ann.points.map(point => ({
            x: imagePosition.x + (point.x * scale),
            y: imagePosition.y + (point.y * scale)
          }));
          
          return isPointInPolygon(mousePos, scaledPoints);
        }
        
        return false;
      });

      if (clickedAnnotation) {
        onAnnotationSelect?.(clickedAnnotation);
      } else {
        onAnnotationSelect?.(null);
      }
    }
  }, [activeTool, annotations, onAnnotationSelect, zoomLevel, imagePosition]);

  // Handle right-click for smart polygon tool
  const handleRightClick = useCallback((e) => {
    if (activeTool === 'smart_polygon') {
      smartPolygonTool.handleRightClick(e);
    }
  }, [activeTool, smartPolygonTool]);

  // Setup event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleRightClick);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('contextmenu', handleRightClick);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleCanvasClick, handleRightClick]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setTimeout(resizeCanvas, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas]);

  // Initial resize
  useEffect(() => {
    setTimeout(resizeCanvas, 100);
  }, [resizeCanvas]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#001529',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: activeTool === 'box' ? 'crosshair' : 
               activeTool === 'polygon' ? 'crosshair' :
               activeTool === 'smart_polygon' ? 'crosshair' : 'default',
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          backgroundColor: '#001529',
          margin: '0 auto'
        }}
      />
      
      {/* Smart Polygon Processing Indicator */}
      <smartPolygonTool.ProcessingIndicator />
      
      {/* Smart Polygon Controls */}
      {activeTool === 'smart_polygon' && smartPolygonTool.editingMode && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '8px 16px',
          borderRadius: '8px',
          zIndex: 1000
        }}>
          <button
            onClick={smartPolygonTool.completePolygon}
            style={{
              background: '#52c41a',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✓ Complete
          </button>
          <button
            onClick={smartPolygonTool.cancelPolygon}
            style={{
              background: '#ff4d4f',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Debug info */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: '12px',
        pointerEvents: 'none'
      }}>
        Tool: {activeTool} | Zoom: {zoomLevel}% | Annotations: {annotations.length}
      </div>
    </div>
  );
};

export default AnnotationCanvas;