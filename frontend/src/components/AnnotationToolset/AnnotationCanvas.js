import React, { useRef, useEffect, useState, useCallback } from 'react';
import SmartPolygonTool from './SmartPolygonTool';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const AnnotationCanvas = ({
  imageUrl,
  imageId,
  annotations = [],
  selectedAnnotation = null,
  activeTool = 'box',
  zoomLevel = 50,
  onShapeComplete,
  onAnnotationSelect,
  onAnnotationDelete,
  onImagePositionChange,
  onPolygonStateChange,
  style = {}
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const handleMouseDownRef = useRef(null);
  const handleMouseMoveRef = useRef(null);
  const handleMouseUpRef = useRef(null);
  const handleDoubleClickRef = useRef(null);
  const handleCanvasClickRef = useRef(null);
  const handleRightClickRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  // Polygon point history for undo/redo functionality
  const [polygonPointsHistory, setPolygonPointsHistory] = useState([]);
  const [polygonPointsFuture, setPolygonPointsFuture] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 }); // Used for canvas dimensions
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  // Throttled logging for redraws (reduce console/log noise during frequent redraws)
  const redrawLogTimestampsRef = useRef({ started: 0, completed: 0 });
  const logRedrawThrottled = useCallback((stage, payload) => {
    const now = Date.now();
    const last = redrawLogTimestampsRef.current[stage] || 0;
    if (now - last > 300) {
      redrawLogTimestampsRef.current[stage] = now;
      const eventId = stage === 'started' ? 'canvas_redraw_started' : 'canvas_redraw_completed';
      const message = stage === 'started' ? 'Canvas redraw operation started' : 'Canvas redraw operation completed';
      logInfo('app.frontend.ui', eventId, message, payload);
    }
  }, []);

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

  // Log component initialization
  useEffect(() => {
    logInfo('app.frontend.ui', 'annotation_canvas_initialized', 'AnnotationCanvas component initialized', {
      imageId,
      activeTool,
      zoomLevel,
      annotationCount: annotations.length,
      hasImageUrl: !!imageUrl
    });
  }, [imageId, activeTool, zoomLevel, annotations.length, imageUrl]);

  // Initialize canvas and load image - supports all formats and sizes with retry logic
  useEffect(() => {
    if (!imageUrl) {
      logError('app.frontend.validation', 'annotation_canvas_no_image_url', 'No imageUrl provided to AnnotationCanvas', {
        imageId,
        activeTool
      });
      console.log('AnnotationCanvas: No imageUrl provided');
      return;
    }

    logInfo('app.frontend.ui', 'image_loading_started', 'Image loading started', {
      imageUrl,
      imageId,
      activeTool
    });

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
        logInfo('app.frontend.ui', 'image_loaded_successfully', 'Image loaded successfully', {
          imageUrl,
          imageId,
          imageWidth: img.width,
          imageHeight: img.height,
          retryCount
        });
        console.log(`✅ Image loaded successfully: ${img.width}x${img.height} pixels`);
        console.log(`✅ Image URL: ${imageUrl}`);
        imageRef.current = img;
        setImageSize({ width: img.width, height: img.height });
        resizeCanvas();
      };
      
      img.onerror = (error) => {
        if (isCancelled) return;
        logError('app.frontend.validation', 'image_load_failed', 'Failed to load image', {
          imageUrl,
          imageId,
          retryCount,
          maxRetries,
          error: error.message || 'Unknown error'
        });
        console.error('❌ AnnotationCanvas: Failed to load image:', error);
        console.error('❌ Image URL:', imageUrl);
        console.error('❌ Retry count:', retryCount);
        
        // Retry loading with a delay
        if (retryCount < maxRetries) {
          retryCount++;
          logInfo('app.frontend.ui', 'image_load_retry', 'Retrying image load', {
            imageUrl,
            imageId,
            retryCount,
            maxRetries
          });
          console.log(`🔄 Retrying image load (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(() => {
            if (!isCancelled) {
              loadImage();
            }
          }, 500 * retryCount); // Shorter delay for faster retries
        } else {
          logError('app.frontend.validation', 'image_load_max_retries_reached', 'Max retries reached for image loading', {
            imageUrl,
            imageId,
            maxRetries
          });
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
  }, [imageUrl, imageId, activeTool]);

  // Clear incomplete polygon when tool changes - FIX FOR STUCK POLYGON BUG
  useEffect(() => {
    if (activeTool !== 'polygon' && polygonPoints.length > 0) {
      logInfo('app.frontend.ui', 'polygon_points_cleared_tool_change', 'Clearing incomplete polygon due to tool change', {
        previousTool: activeTool,
        polygonPointsCount: polygonPoints.length
      });
      console.log('Clearing incomplete polygon due to tool change');
      setPolygonPoints([]);
      setPolygonPointsHistory([]);
      setPolygonPointsFuture([]);
    }
  }, [activeTool, polygonPoints.length]);

  // Notify parent component when polygon drawing state changes
  useEffect(() => {
    if (onPolygonStateChange) {
      const isPolygonDrawing = activeTool === 'polygon' && polygonPoints.length > 0;
      onPolygonStateChange(isPolygonDrawing, polygonPoints.length);
    }
  }, [activeTool, polygonPoints.length, onPolygonStateChange]);

  // Redraw canvas with image and annotations
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) {
      logError('app.frontend.validation', 'redraw_canvas_missing_elements', 'Cannot redraw canvas - missing required elements', {
        hasCanvas: !!canvas,
        hasContext: !!ctx,
        hasImage: !!img
      });
      return;
    }

    logRedrawThrottled('started', {
      imageId,
      annotationCount: annotations.length,
      selectedAnnotationId: selectedAnnotation?.id,
      activeTool,
      zoomLevel
    });

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

    logRedrawThrottled('completed', {
      imageId,
      annotationsDrawn: annotations.length,
      hasCurrentShape: !!currentShape,
      polygonPointsCount: polygonPoints.length,
      activeTool
    });
  }, [annotations, selectedAnnotation, currentShape, polygonPoints, activeTool, imagePosition, imageSize, zoomLevel, smartPolygonTool, imageId]);

  // Resize canvas to fit container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageRef.current) {
      logError('app.frontend.validation', 'resize_canvas_missing_elements', 'Cannot resize canvas - missing required elements', {
        hasCanvas: !!canvas,
        hasContainer: !!container,
        hasImage: !!imageRef.current
      });
      return;
    }

    logInfo('app.frontend.ui', 'canvas_resize_started', 'Canvas resize operation started', {
      imageId,
      zoomLevel,
      imageSize
    });

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

    // Center the image in the canvas (use the same formula as redraw to avoid drift)
    const baseW = (imageSize?.width && imageSize?.height) ? imageSize.width : img.width;
    const baseH = (imageSize?.width && imageSize?.height) ? imageSize.height : img.height;
    const consistentW = baseW * (zoomLevel / 100);
    const consistentH = baseH * (zoomLevel / 100);
    
    // Determine canvas size: expand when zoomed in to avoid clipping
    let canvasWidth = containerWidth;
    let canvasHeight = containerHeight;
    if (zoomLevel >= 25) {
      canvasWidth = Math.max(containerWidth, Math.ceil(consistentW) + 40);
      canvasHeight = Math.max(containerHeight, Math.ceil(consistentH) + 40);
    }

    // Center within the actual canvas size
    const x = (canvasWidth - consistentW) / 2;
    const y = (canvasHeight - consistentH) / 2;

    const newPosition = { x, y };
    setImagePosition(newPosition);
    if (onImagePositionChange) {
      onImagePositionChange(newPosition);
    }
    setCanvasSize({ width: canvasWidth, height: canvasHeight });

    // Set canvas size to match actual canvas pixels
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    logInfo('app.frontend.ui', 'canvas_resize_completed', 'Canvas resize operation completed', {
      imageId,
      containerWidth,
      containerHeight,
      displayWidth,
      displayHeight,
      imagePosition: newPosition,
      zoomLevel
    });

    // Redraw everything
    redrawCanvas();
  }, [zoomLevel, imageId, imageSize, onImagePositionChange, redrawCanvas]);

  // Draw a single annotation
  const drawAnnotation = (ctx, annotation, isSelected = false) => {
    logInfo('app.frontend.ui', 'annotation_drawing_started', 'Drawing annotation', {
      annotationId: annotation.id,
      annotationType: annotation.type,
      isSelected,
      imageId
    });

    // Removed verbose console logs in hot draw path
    
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
      // Make sure we have valid points
      if (!Array.isArray(annotation.points) || annotation.points.length < 3) {
        logError('app.frontend.validation', 'polygon_insufficient_points', 'Not enough points to draw polygon', {
          annotationId: annotation.id,
          pointsCount: annotation.points?.length || 0,
          points: annotation.points
        });
        return;
      }
      
      // Draw the polygon
      ctx.beginPath();
      let validPointsCount = 0;
      
      annotation.points.forEach((point, index) => {
        // Check if point is valid
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
          logError('app.frontend.validation', 'polygon_invalid_point', 'Invalid polygon point', {
            annotationId: annotation.id,
            pointIndex: index,
            point: point
          });
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
        logError('app.frontend.validation', 'polygon_insufficient_valid_points', 'Not enough valid points to draw polygon', {
          annotationId: annotation.id,
          validPointsCount,
          totalPoints: annotation.points.length
        });
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

    logInfo('app.frontend.ui', 'annotation_drawing_completed', 'Annotation drawing completed', {
      annotationId: annotation.id,
      annotationType: annotation.type,
      isSelected,
      imageId
    });
  };

  // Draw shape being drawn
  const drawShape = (ctx, shape, isActive = false) => {
    logInfo('app.frontend.ui', 'shape_drawing', 'Drawing current shape', {
      shapeType: shape.type,
      isActive,
      coordinates: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
      imageId
    });

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

    logInfo('app.frontend.ui', 'polygon_in_progress_drawing', 'Drawing polygon in progress', {
      pointsCount: points.length,
      imageId
    });

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
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#52c41a';
      ctx.fill();
      
      // Highlight first point if we have enough points to complete
      if (index === 0 && points.length >= 3) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
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

  // Helper function to check if click is near first polygon point
  const isNearFirstPoint = useCallback((mousePos) => {
    if (polygonPoints.length < 3) return false;
    
    const firstPoint = polygonPoints[0];
    const distance = Math.sqrt(
      Math.pow(mousePos.x - firstPoint.x, 2) + Math.pow(mousePos.y - firstPoint.y, 2)
    );
    
    return distance <= 12; // 12 pixel threshold for first point detection
  }, [polygonPoints]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    logUserClick('AnnotationCanvas', 'mouse_down', {
      activeTool,
      imageId,
      isDrawing,
      hasStartPoint: !!startPoint
    });

    console.log('Mouse down - activeTool:', activeTool);
    if (!activeTool || activeTool === 'select') return;

    const mousePos = getMousePos(e);
    console.log('Mouse down position:', mousePos);
    
    if (activeTool === 'smart_polygon') {
      // Handle smart polygon tool
      smartPolygonTool.handleCanvasClick(e);
    } else if (activeTool === 'box') {
      logUserClick('AnnotationCanvas', 'box_drawing_started', {
        imageId,
        startPoint: mousePos,
        zoomLevel,
        tool: activeTool
      });
      logInfo('app.frontend.interactions', 'box_drawing_started', 'Box drawing started', {
        imageId,
        startPoint: mousePos,
        zoomLevel,
        tool: activeTool
      });
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
      // Check if clicking near first point to complete polygon
      if (isNearFirstPoint(mousePos)) {
        if (polygonPoints.length >= 3) {
          logInfo('app.frontend.interactions', 'polygon_completed_first_point_click', 'Polygon completed by clicking first point', {
            imageId,
            pointsCount: polygonPoints.length,
            zoomLevel
          });
          
          // Complete polygon
          const imagePoints = polygonPoints.map(point => screenToImageCoords(point.x, point.y));
          
          const shape = {
            type: 'polygon',
            points: imagePoints
          };

          onShapeComplete?.(shape);
          
          logInfo('app.frontend.interactions', 'polygon_on_shape_complete_called', 'onShapeComplete called for polygon via first point click', {
            imageId,
            shapeType: shape.type,
            pointsCount: imagePoints.length
          });
          
          // Clear polygon points and history
          setPolygonPoints([]);
          setPolygonPointsHistory([]);
          setPolygonPointsFuture([]);
          redrawCanvas();
          return;
        }
      }
      
      // Add new point with history management
      logUserClick('AnnotationCanvas', 'polygon_point_added', {
        imageId,
        newPoint: mousePos,
        currentPointsCount: polygonPoints.length,
        zoomLevel,
        tool: activeTool
      });
      logInfo('app.frontend.interactions', 'polygon_point_added', 'Polygon point added', {
        imageId,
        newPoint: mousePos,
        currentPointsCount: polygonPoints.length,
        zoomLevel,
        totalPoints: polygonPoints.length + 1
      });
      
      // Save current state to history before adding new point
      setPolygonPointsHistory(prev => [...prev, polygonPoints]);
      setPolygonPointsFuture([]); // Clear future when new action is performed
      
      const newPoint = mousePos;
      setPolygonPoints(prev => [...prev, newPoint]);
    }
  }, [activeTool, smartPolygonTool, imageId, isDrawing, startPoint, polygonPoints.length, zoomLevel, isNearFirstPoint, polygonPoints, screenToImageCoords, onShapeComplete, redrawCanvas]);

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

    logInfo('app.frontend.ui', 'box_drawing_progress', 'Box drawing in progress', {
      imageId,
      startPoint,
      currentPoint: mousePos,
      width: Math.abs(width),
      height: Math.abs(height),
      zoomLevel
    });

    // Removed verbose console logs during mouse move

    setCurrentShape({
      type: 'box',
      x: Math.min(startPoint.x, mousePos.x),
      y: Math.min(startPoint.y, mousePos.y),
      width: Math.abs(width),
      height: Math.abs(height)
    });
  }, [isDrawing, startPoint, activeTool, smartPolygonTool, imageId, zoomLevel]);

  const handleMouseUp = useCallback((e) => {
    if (activeTool === 'smart_polygon') {
      // Handle smart polygon tool mouse up
      smartPolygonTool.handleMouseUp(e);
      return;
    }

    logUserClick('AnnotationCanvas', 'mouse_up', {
      activeTool,
      imageId,
      isDrawing,
      hasCurrentShape: !!currentShape,
      shapeSize: currentShape ? { width: currentShape.width, height: currentShape.height } : null
    });

    // Removed verbose console logs on mouse up
    if (!isDrawing || !currentShape || activeTool !== 'box') {
      logInfo('app.frontend.interactions', 'mouse_up_no_drawing', 'Mouse up but no active drawing', {
        imageId,
        isDrawing,
        hasCurrentShape: !!currentShape,
        activeTool,
        tool: activeTool
      });
      return;
    }

    setIsDrawing(false);
    
    // Only create shape if it has meaningful size (reduced minimum size)
    if (currentShape.width > 5 && currentShape.height > 5) {
      logUserClick('AnnotationCanvas', 'box_shape_completed', {
        imageId,
        shapeSize: { width: currentShape.width, height: currentShape.height },
        coordinates: { x: currentShape.x, y: currentShape.y },
        zoomLevel,
        tool: activeTool
      });
      
      logInfo('app.frontend.interactions', 'box_shape_completed', 'Box shape completed successfully', {
        imageId,
        shapeSize: { width: currentShape.width, height: currentShape.height },
        coordinates: { x: currentShape.x, y: currentShape.y },
        zoomLevel,
        tool: activeTool,
        screenCoordinates: currentShape
      });
      
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

      logInfo('app.frontend.interactions', 'box_coordinates_converted', 'Box coordinates converted to image space', {
        imageId,
        screenCoordinates: currentShape,
        imageCoordinates: shape,
        zoomLevel,
        conversionFactor: zoomLevel / 100
      });

      if (onShapeComplete) {
        onShapeComplete(shape);
        logInfo('app.frontend.interactions', 'on_shape_complete_called', 'onShapeComplete callback called successfully', {
          imageId,
          shapeType: shape.type,
          shapeCoordinates: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
          tool: activeTool
        });
      } else {
        logError('app.frontend.validation', 'on_shape_complete_missing', 'onShapeComplete function is not provided', {
          imageId,
          shapeType: shape.type,
          tool: activeTool
        });
      }
    } else {
      logUserClick('AnnotationCanvas', 'box_shape_too_small', {
        imageId,
        shapeSize: { width: currentShape.width, height: currentShape.height },
        minimumSize: 5,
        tool: activeTool
      });
      
      logError('app.frontend.validation', 'box_shape_too_small', 'Box shape too small, not creating annotation', {
        imageId,
        shapeSize: { width: currentShape.width, height: currentShape.height },
        minimumSize: 5,
        tool: activeTool
      });
    }

    // ALWAYS clear the temporary shape immediately after drawing
    setCurrentShape(null);
    setStartPoint(null);
    redrawCanvas();
  }, [isDrawing, currentShape, activeTool, onShapeComplete, zoomLevel, smartPolygonTool, imageId, redrawCanvas]);

  const handleDoubleClick = useCallback((e) => {
    if (activeTool === 'polygon' && polygonPoints.length >= 3) {
      logInfo('app.frontend.interactions', 'polygon_completed_double_click', 'Polygon completed with double click', {
        imageId,
        pointsCount: polygonPoints.length,
        zoomLevel
      });
      
      // Complete polygon
      const imagePoints = polygonPoints.map(point => screenToImageCoords(point.x, point.y));
      
      const shape = {
        type: 'polygon',
        points: imagePoints
      };

      onShapeComplete?.(shape);
      
      logInfo('app.frontend.interactions', 'polygon_on_shape_complete_called', 'onShapeComplete called for polygon', {
        imageId,
        shapeType: shape.type,
        pointsCount: imagePoints.length
      });
      
      // ALWAYS clear polygon points immediately after completion
      setPolygonPoints([]);
      redrawCanvas();
    }
  }, [activeTool, polygonPoints, onShapeComplete, screenToImageCoords, imageId, redrawCanvas, zoomLevel]);

  const handleCanvasClick = useCallback((e) => {
    if (activeTool === 'select') {
      logUserClick('AnnotationCanvas', 'canvas_click_select_mode', {
        imageId,
        annotationCount: annotations.length,
        zoomLevel
      });

      // Check if clicking on an annotation
      const mousePos = getMousePos(e);
      // Find all annotations that contain the click point
      const matchingAnnotations = annotations.filter(ann => {
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
      
      // Select the topmost annotation (last in array = most recently drawn)
      const clickedAnnotation = matchingAnnotations.length > 0 ? matchingAnnotations[matchingAnnotations.length - 1] : null;

      if (clickedAnnotation) {
        logInfo('app.frontend.interactions', 'annotation_selected', 'Annotation selected via click', {
          imageId,
          annotationId: clickedAnnotation.id,
          annotationType: clickedAnnotation.type,
          clickPosition: mousePos
        });
        onAnnotationSelect?.(clickedAnnotation);
      } else {
        logInfo('app.frontend.interactions', 'annotation_deselected', 'Annotation deselected - clicked outside', {
          imageId,
          clickPosition: mousePos,
          annotationCount: annotations.length
        });
        onAnnotationSelect?.(null);
      }
    }
  }, [activeTool, annotations, onAnnotationSelect, zoomLevel, imagePosition, imageId, screenToImageCoords]);

  // Handle right-click for smart polygon tool
  const handleRightClick = useCallback((e) => {
    if (activeTool === 'smart_polygon') {
      logUserClick('AnnotationCanvas', 'right_click_smart_polygon', {
        imageId,
        activeTool
      });
      smartPolygonTool.handleRightClick(e);
    }
  }, [activeTool, smartPolygonTool, imageId, zoomLevel]);

  // Keep handler refs in sync with latest callbacks so listeners bind once but call newest logic
  useEffect(() => {
    handleMouseDownRef.current = handleMouseDown;
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;
    handleDoubleClickRef.current = handleDoubleClick;
    handleCanvasClickRef.current = handleCanvasClick;
    handleRightClickRef.current = handleRightClick;
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleCanvasClick, handleRightClick]);

  // Handle keyboard events for polygon completion and undo/redo
  const handleKeyDown = useCallback((e) => {
    if (activeTool === 'polygon') {
      if (e.key === 'Backspace' && polygonPoints.length > 0) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling to parent handlers
        
        logInfo('app.frontend.interactions', 'polygon_point_removed_backspace', 'Last polygon point removed with Backspace', {
          imageId,
          removedPointIndex: polygonPoints.length - 1,
          remainingPoints: polygonPoints.length - 1,
          zoomLevel
        });
        
        // Save current state to future before undoing
        setPolygonPointsFuture(prev => [polygonPoints, ...prev]);
        
        // Restore previous state from history or remove last point
        if (polygonPointsHistory.length > 0) {
          const previousState = polygonPointsHistory[polygonPointsHistory.length - 1];
          setPolygonPoints(previousState);
          setPolygonPointsHistory(prev => prev.slice(0, -1));
        } else {
          // Fallback: just remove last point if no history
          setPolygonPoints(prev => prev.slice(0, -1));
        }
        
        redrawCanvas();
        return;
      }
      
      // Handle Shift+Y for polygon point redo
      if (e.shiftKey && e.key === 'Y' && polygonPointsFuture.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        logInfo('app.frontend.interactions', 'polygon_point_redo_shift_y', 'Polygon point redo with Shift+Y', {
          imageId,
          futureStatesCount: polygonPointsFuture.length,
          zoomLevel
        });
        
        // Save current state to history before redoing
        setPolygonPointsHistory(prev => [...prev, polygonPoints]);
        
        // Restore next state from future
        const nextState = polygonPointsFuture[0];
        setPolygonPoints(nextState);
        setPolygonPointsFuture(prev => prev.slice(1));
        
        redrawCanvas();
        return;
      }
      
      if (polygonPoints.length >= 3) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          
          if (e.key === 'Enter') {
            logInfo('app.frontend.interactions', 'polygon_completed_enter_key', 'Polygon completed with Enter key', {
              imageId,
              pointsCount: polygonPoints.length,
              zoomLevel
            });
            
            // Complete polygon
            const imagePoints = polygonPoints.map(point => screenToImageCoords(point.x, point.y));
            
            const shape = {
              type: 'polygon',
              points: imagePoints
            };

            onShapeComplete?.(shape);
            
            logInfo('app.frontend.interactions', 'polygon_on_shape_complete_called', 'onShapeComplete called for polygon via Enter key', {
              imageId,
              shapeType: shape.type,
              pointsCount: imagePoints.length
            });
          } else {
            logInfo('app.frontend.interactions', 'polygon_cancelled_escape_key', 'Polygon cancelled with Escape key', {
              imageId,
              pointsCount: polygonPoints.length
            });
          }
          
          // Clear polygon points and history
          setPolygonPoints([]);
          setPolygonPointsHistory([]);
          setPolygonPointsFuture([]);
          redrawCanvas();
        }
      }
    }
  }, [activeTool, polygonPoints, polygonPointsHistory, polygonPointsFuture, screenToImageCoords, onShapeComplete, imageId, zoomLevel, redrawCanvas]);

  // Setup event listeners using refs to avoid dependency issues
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      logError('app.frontend.validation', 'canvas_event_listeners_setup_failed', 'Cannot setup event listeners - canvas not found', {
        imageId
      });
      return;
    }

    logInfo('app.frontend.ui', 'canvas_event_listeners_setup', 'Setting up canvas event listeners', {
      imageId,
      activeTool
    });

    const onMouseDown = (e) => handleMouseDownRef.current && handleMouseDownRef.current(e);
    const onMouseMove = (e) => handleMouseMoveRef.current && handleMouseMoveRef.current(e);
    const onMouseUp = (e) => handleMouseUpRef.current && handleMouseUpRef.current(e);
    const onDblClick = (e) => handleDoubleClickRef.current && handleDoubleClickRef.current(e);
    const onClick = (e) => handleCanvasClickRef.current && handleCanvasClickRef.current(e);
    const onContextMenu = (e) => handleRightClickRef.current && handleRightClickRef.current(e);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      logInfo('app.frontend.ui', 'canvas_event_listeners_cleanup', 'Cleaning up canvas event listeners', {
        imageId
      });
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  // Setup keyboard event listener separately
  useEffect(() => {
    logInfo('app.frontend.ui', 'keyboard_event_listener_setup', 'Setting up keyboard event listener', {
      imageId,
      activeTool
    });

    // Add keyboard event listener to document for polygon completion
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      logInfo('app.frontend.ui', 'keyboard_event_listener_cleanup', 'Cleaning up keyboard event listener', {
        imageId
      });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, imageId, activeTool]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      logInfo('app.frontend.ui', 'window_resize_detected', 'Window resize detected, resizing canvas', {
        imageId
      });
      setTimeout(resizeCanvas, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      logInfo('app.frontend.ui', 'window_resize_listener_cleanup', 'Cleaning up window resize listener', {
        imageId
      });
      window.removeEventListener('resize', handleResize);
    };
  }, [resizeCanvas, imageId]);

  // Initial resize
  useEffect(() => {
    logInfo('app.frontend.ui', 'initial_canvas_resize', 'Performing initial canvas resize', {
      imageId
    });
    setTimeout(resizeCanvas, 100);
  }, [resizeCanvas, imageId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'auto',
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
          width: canvasSize.width,
          height: canvasSize.height,
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
            onClick={() => {
              logUserClick('AnnotationCanvas', 'smart_polygon_complete_button', {
                imageId,
                activeTool
              });
              smartPolygonTool.completePolygon();
            }}
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
            onClick={() => {
              logUserClick('AnnotationCanvas', 'smart_polygon_cancel_button', {
                imageId,
                activeTool
              });
              smartPolygonTool.cancelPolygon();
            }}
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

      {/* Polygon drawing instructions */}
       {activeTool === 'polygon' && polygonPoints.length > 0 && (() => {
         // Calculate average Y position of polygon points to determine message placement
         const avgY = polygonPoints.reduce((sum, point) => sum + point.y, 0) / polygonPoints.length;
         const canvasHeight = canvasRef.current?.height || 600;
         const isDrawingInTopHalf = avgY < canvasHeight / 2;
         
         return (
           <div style={{
             position: 'absolute',
             ...(isDrawingInTopHalf ? { bottom: 20 } : { top: 50 }),
             left: '50%',
             transform: 'translateX(-50%)',
             background: 'rgba(0, 0, 0, 0.8)',
             color: 'white',
             padding: '8px 16px',
             borderRadius: '8px',
             fontSize: '12px',
             zIndex: 1000,
             textAlign: 'center'
           }}>
             {polygonPoints.length >= 3 
               ? 'Click first point, double-click, or press Enter to complete • Backspace to undo • Escape to cancel'
               : `${polygonPoints.length} point${polygonPoints.length === 1 ? '' : 's'} added • Backspace to undo • Escape to cancel`
             }
           </div>
         );
       })()}

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
        {activeTool === 'polygon' && polygonPoints.length > 0 && ` | Points: ${polygonPoints.length}`}
      </div>
    </div>
  );
};

export default AnnotationCanvas;