/**
 * SmartPolygonTool.js
 * Smart Polygon Tool with automatic segmentation and manual editing capabilities
 * 
 * Features:
 * - Click to auto-generate polygon around objects
 * - Manual polygon point editing (drag, add, remove)
 * - Integration with existing annotation system
 */

import React, { useState, useCallback, useRef } from 'react';
import { message, Spin } from 'antd';

const SmartPolygonTool = ({
  imageUrl,
  imageId,
  onPolygonComplete,
  isActive = false,
  zoomLevel = 100,
  imagePosition = { x: 0, y: 0 },
  imageSize = { width: 0, height: 0 }
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState(null);
  const [editingMode, setEditingMode] = useState(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState(-1);
  const processingRef = useRef(false);

  // Convert screen coordinates to image coordinates
  const screenToImageCoords = useCallback((screenX, screenY) => {
    const scale = zoomLevel / 100;
    const imageX = (screenX - imagePosition.x) / scale;
    const imageY = (screenY - imagePosition.y) / scale;
    return { x: imageX, y: imageY };
  }, [zoomLevel, imagePosition]);

  // Convert image coordinates to screen coordinates
  const imageToScreenCoords = useCallback((imageX, imageY) => {
    const scale = zoomLevel / 100;
    const screenX = imagePosition.x + (imageX * scale);
    const screenY = imagePosition.y + (imageY * scale);
    return { x: screenX, y: screenY };
  }, [zoomLevel, imagePosition]);

  // Call backend segmentation API
  const performSmartSegmentation = async (clickX, clickY) => {
    try {
      setIsProcessing(true);
      processingRef.current = true;

      // Convert screen coordinates to image coordinates for API
      const imageCoords = screenToImageCoords(clickX, clickY);
      
      console.log('🎯 Smart Polygon: Calling segmentation API', {
        imageId,
        clickPoint: { x: clickX, y: clickY },
        imageCoords,
        imageSize
      });

      // Call backend segmentation endpoint
      const response = await fetch('/api/v1/segment-polygon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_id: imageId,
          x: Math.round(imageCoords.x),
          y: Math.round(imageCoords.y),
          image_width: imageSize.width,
          image_height: imageSize.height
        })
      });

      if (!response.ok) {
        throw new Error(`Segmentation failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.points && result.points.length > 0) {
        console.log('✅ Smart Polygon: Segmentation successful', result);
        
        // Convert API points to our format
        const polygonPoints = result.points.map(point => ({
          x: point.x || point[0],
          y: point.y || point[1]
        }));

        setCurrentPolygon({
          type: 'smart_polygon',
          points: polygonPoints,
          confidence: result.confidence || 0.8,
          algorithm: result.algorithm || 'auto'
        });

        setEditingMode(true);
        message.success(`Smart polygon generated with ${polygonPoints.length} points`);
      } else {
        throw new Error(result.error || 'No polygon points returned');
      }

    } catch (error) {
      console.error('❌ Smart Polygon: Segmentation failed', error);
      message.error(`Smart segmentation failed: ${error.message}`);
      
      // Fallback: Create a simple polygon around click point
      const fallbackPolygon = createFallbackPolygon(clickX, clickY);
      setCurrentPolygon(fallbackPolygon);
      setEditingMode(true);
      message.warning('Using fallback polygon - please adjust manually');
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  // Create a simple fallback polygon when segmentation fails
  const createFallbackPolygon = (centerX, centerY) => {
    const imageCoords = screenToImageCoords(centerX, centerY);
    const size = 50; // Default size in image coordinates
    
    return {
      type: 'smart_polygon',
      points: [
        { x: imageCoords.x - size, y: imageCoords.y - size },
        { x: imageCoords.x + size, y: imageCoords.y - size },
        { x: imageCoords.x + size, y: imageCoords.y + size },
        { x: imageCoords.x - size, y: imageCoords.y + size }
      ],
      confidence: 0.1,
      algorithm: 'fallback'
    };
  };

  // Handle canvas click for smart segmentation
  const handleCanvasClick = useCallback(async (e) => {
    if (!isActive || processingRef.current) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if click is within image bounds
    const imageCoords = screenToImageCoords(clickX, clickY);
    if (imageCoords.x < 0 || imageCoords.x > imageSize.width || 
        imageCoords.y < 0 || imageCoords.y > imageSize.height) {
      message.warning('Please click within the image area');
      return;
    }

    if (editingMode && currentPolygon) {
      // Handle polygon editing
      handlePolygonEdit(clickX, clickY, e);
    } else {
      // Start smart segmentation
      await performSmartSegmentation(clickX, clickY);
    }
  }, [isActive, editingMode, currentPolygon, imageSize, screenToImageCoords]);

  // Handle polygon point editing
  const handlePolygonEdit = (clickX, clickY, e) => {
    if (!currentPolygon || !currentPolygon.points) return;

    const clickThreshold = 10; // Pixels
    let clickedPointIndex = -1;

    // Check if clicked on existing point
    for (let i = 0; i < currentPolygon.points.length; i++) {
      const screenPoint = imageToScreenCoords(currentPolygon.points[i].x, currentPolygon.points[i].y);
      const distance = Math.sqrt(
        Math.pow(clickX - screenPoint.x, 2) + Math.pow(clickY - screenPoint.y, 2)
      );
      
      if (distance <= clickThreshold) {
        clickedPointIndex = i;
        break;
      }
    }

    if (clickedPointIndex >= 0) {
      // Start dragging existing point
      setDraggedPointIndex(clickedPointIndex);
    } else {
      // Add new point on edge
      addPointOnEdge(clickX, clickY);
    }
  };

  // Add point on polygon edge
  const addPointOnEdge = (clickX, clickY) => {
    if (!currentPolygon || !currentPolygon.points) return;

    const points = currentPolygon.points;
    const clickImageCoords = screenToImageCoords(clickX, clickY);
    let insertIndex = -1;
    let minDistance = Infinity;

    // Find closest edge
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      
      // Calculate distance from click point to line segment
      const distance = distanceToLineSegment(clickImageCoords, p1, p2);
      
      if (distance < minDistance && distance < 20) { // 20 pixel threshold in image coords
        minDistance = distance;
        insertIndex = i + 1;
      }
    }

    if (insertIndex >= 0) {
      const newPoints = [...points];
      newPoints.splice(insertIndex, 0, clickImageCoords);
      
      setCurrentPolygon({
        ...currentPolygon,
        points: newPoints
      });
      
      message.success('Point added to polygon');
    }
  };

  // Calculate distance from point to line segment
  const distanceToLineSegment = (point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));
    
    const xx = lineStart.x + param * C;
    const yy = lineStart.y + param * D;
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle mouse move for dragging points
  const handleMouseMove = useCallback((e) => {
    if (draggedPointIndex < 0 || !currentPolygon) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newImageCoords = screenToImageCoords(mouseX, mouseY);
    
    const newPoints = [...currentPolygon.points];
    newPoints[draggedPointIndex] = newImageCoords;
    
    setCurrentPolygon({
      ...currentPolygon,
      points: newPoints
    });
  }, [draggedPointIndex, currentPolygon, screenToImageCoords]);

  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    setDraggedPointIndex(-1);
  }, []);

  // Handle right-click to remove point
  const handleRightClick = useCallback((e) => {
    e.preventDefault();
    
    if (!editingMode || !currentPolygon || currentPolygon.points.length <= 3) {
      message.warning('Polygon must have at least 3 points');
      return;
    }

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickThreshold = 10;
    let clickedPointIndex = -1;

    // Find clicked point
    for (let i = 0; i < currentPolygon.points.length; i++) {
      const screenPoint = imageToScreenCoords(currentPolygon.points[i].x, currentPolygon.points[i].y);
      const distance = Math.sqrt(
        Math.pow(clickX - screenPoint.x, 2) + Math.pow(clickY - screenPoint.y, 2)
      );
      
      if (distance <= clickThreshold) {
        clickedPointIndex = i;
        break;
      }
    }

    if (clickedPointIndex >= 0) {
      const newPoints = currentPolygon.points.filter((_, index) => index !== clickedPointIndex);
      setCurrentPolygon({
        ...currentPolygon,
        points: newPoints
      });
      message.success('Point removed from polygon');
    }
  }, [editingMode, currentPolygon, imageToScreenCoords]);

  // Complete polygon and save
  const completePolygon = useCallback(() => {
    if (!currentPolygon || !currentPolygon.points || currentPolygon.points.length < 3) {
      message.error('Polygon must have at least 3 points');
      return;
    }

    console.log('🎯 Smart Polygon: Completing polygon', currentPolygon);
    
    const finalPolygon = {
      type: 'polygon',
      points: currentPolygon.points,
      confidence: currentPolygon.confidence,
      algorithm: currentPolygon.algorithm,
      isSmartGenerated: true
    };

    onPolygonComplete?.(finalPolygon);
    
    // Reset state
    setCurrentPolygon(null);
    setEditingMode(false);
    setDraggedPointIndex(-1);
    
    message.success('Smart polygon annotation completed!');
  }, [currentPolygon, onPolygonComplete]);

  // Cancel polygon editing
  const cancelPolygon = useCallback(() => {
    setCurrentPolygon(null);
    setEditingMode(false);
    setDraggedPointIndex(-1);
    message.info('Polygon editing cancelled');
  }, []);

  // Render polygon on canvas
  const renderPolygon = (ctx) => {
    if (!currentPolygon || !currentPolygon.points || currentPolygon.points.length === 0) return;

    const points = currentPolygon.points;
    
    // Draw polygon fill and stroke
    ctx.beginPath();
    points.forEach((point, index) => {
      const screenPoint = imageToScreenCoords(point.x, point.y);
      if (index === 0) {
        ctx.moveTo(screenPoint.x, screenPoint.y);
      } else {
        ctx.lineTo(screenPoint.x, screenPoint.y);
      }
    });
    ctx.closePath();
    
    // Style based on confidence
    const alpha = Math.max(0.1, currentPolygon.confidence || 0.5);
    ctx.fillStyle = `rgba(82, 196, 26, ${alpha * 0.2})`;
    ctx.strokeStyle = `rgba(82, 196, 26, ${alpha})`;
    ctx.lineWidth = 2;
    
    ctx.fill();
    ctx.stroke();

    // Draw control points
    points.forEach((point, index) => {
      const screenPoint = imageToScreenCoords(point.x, point.y);
      
      ctx.beginPath();
      ctx.arc(screenPoint.x, screenPoint.y, 6, 0, 2 * Math.PI);
      
      if (index === draggedPointIndex) {
        ctx.fillStyle = '#ff4d4f';
        ctx.strokeStyle = '#fff';
      } else {
        ctx.fillStyle = '#52c41a';
        ctx.strokeStyle = '#fff';
      }
      
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    });
  };

  return {
    // Event handlers to be attached to canvas
    handleCanvasClick,
    handleMouseMove,
    handleMouseUp,
    handleRightClick,
    
    // Rendering function
    renderPolygon,
    
    // State and actions
    isProcessing,
    editingMode,
    currentPolygon,
    completePolygon,
    cancelPolygon,
    
    // Processing indicator component
    ProcessingIndicator: () => isProcessing ? (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1000
      }}>
        <Spin size="small" />
        <span>Generating smart polygon...</span>
      </div>
    ) : null
  };
};

export default SmartPolygonTool;