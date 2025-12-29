/**
 * SmartPolygonTool.js
 * Smart Polygon Tool with automatic segmentation, refinement, and manual editing.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { message, Spin } from 'antd';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const SmartPolygonTool = ({
  imageUrl,
  imageId,
  onPolygonComplete,
  onToolChange, // New prop
  isActive = false,
  zoomLevel = 100,
  imagePosition = { x: 0, y: 0 },
  imageSize = { width: 0, height: 0 }
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState(null); // High-res generated polygon
  const [previewPolygon, setPreviewPolygon] = useState(null); // Blue hover preview
  const [refinementPoints, setRefinementPoints] = useState([]); // [{x, y, label}]
  const [editingMode, setEditingMode] = useState(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState(-1);
  const [complexity, setComplexity] = useState(0.4); // For polygon smoothing
  const processingRef = useRef(false);
  const lastHoverRequestRef = useRef(0);

  // --- Coordinate Conversions ---
  const screenToImageCoords = useCallback((screenX, screenY) => {
    const scale = zoomLevel / 100;
    return {
      x: (screenX - imagePosition.x) / scale,
      y: (screenY - imagePosition.y) / scale
    };
  }, [zoomLevel, imagePosition]);

  const imageToScreenCoords = useCallback((imageX, imageY) => {
    const scale = zoomLevel / 100;
    return {
      x: imagePosition.x + (imageX * scale),
      y: imagePosition.y + (imageY * scale)
    };
  }, [zoomLevel, imagePosition]);

  // --- Core Segmentation Logic ---
  const runSegmentation = async (points, isHover = false) => {
    if (!imageId || points.length === 0) return;

    try {
      if (!isHover) {
        setIsProcessing(true);
        processingRef.current = true;
      }

      const response = await fetch(isHover ? '/api/segment-preview' : '/api/segment-polygon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          points: points,
          complexity: complexity, // Pass smoothing detail
          image_width: imageSize.width,
          image_height: imageSize.height
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const result = await response.json();

      console.log('🔍 Smart Polygon API Response:', {
        isHover,
        success: result.success,
        pointCount: result.points?.length || 0,
        points: result.points,
        confidence: result.confidence
      });

      if (result.success && result.points && result.points.length > 0) {
        const polyPoints = result.points.map(p => ({ x: p.x, y: p.y }));

        console.log('🎨 Setting polygon:', { isHover, pointCount: polyPoints.length });

        if (isHover) {
          setPreviewPolygon({ points: polyPoints, confidence: result.confidence });
        } else {
          setCurrentPolygon({
            type: 'smart_polygon',
            points: polyPoints,
            confidence: result.confidence || 0.8,
            algorithm: result.algorithm || 'sam'
          });
          setEditingMode(true);
        }
      }
    } catch (error) {
      if (!isHover) {
        console.error('Segmentation failed', error);
        message.error(`Smart segmentation failed: ${error.message}`);
      }
    } finally {
      if (!isHover) {
        setIsProcessing(false);
        processingRef.current = false;
      }
    }
  };

  // --- Manual Edit Helpers ---
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

  const addPointOnEdge = useCallback((clickX, clickY) => {
    if (!currentPolygon || !currentPolygon.points) return;
    const clickImageCoords = screenToImageCoords(clickX, clickY);
    let insertIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < currentPolygon.points.length; i++) {
      const p1 = currentPolygon.points[i];
      const p2 = currentPolygon.points[(i + 1) % currentPolygon.points.length];
      const distance = distanceToLineSegment(clickImageCoords, p1, p2);
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        insertIndex = i + 1;
      }
    }

    if (insertIndex >= 0) {
      const newPoints = [...currentPolygon.points];
      newPoints.splice(insertIndex, 0, clickImageCoords);
      setCurrentPolygon({ ...currentPolygon, points: newPoints });
      message.success('Point added to polygon edge');
    }
  }, [currentPolygon, screenToImageCoords]);

  // --- State Actions ---
  const completePolygon = useCallback(() => {
    if (!currentPolygon || currentPolygon.points.length < 3) return;
    onPolygonComplete?.({
      type: 'polygon',
      points: currentPolygon.points,
      confidence: currentPolygon.confidence,
      isSmartGenerated: true
    });
    setCurrentPolygon(null);
    setPreviewPolygon(null);
    setRefinementPoints([]);
    setEditingMode(false);
  }, [currentPolygon, onPolygonComplete]);

  const cancelPolygon = useCallback(() => {
    setCurrentPolygon(null);
    setPreviewPolygon(null);
    setRefinementPoints([]);
    setEditingMode(false);
  }, []);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        completePolygon();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelPolygon();
      } else if (e.key.toLowerCase() === 's') {
        // Roboflow spec: 'S' activates smart tool
        if (typeof onToolChange === 'function') onToolChange('smart_polygon');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, completePolygon, cancelPolygon]);

  // --- Canvas Interaction Handlers ---
  // Ray-casting for inside/outside detection
  const isPointInPolygon = useCallback((point, vs) => {
    var x = point.x, y = point.y;
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      var xi = vs[i].x, yi = vs[i].y;
      var xj = vs[j].x, yj = vs[j].y;
      var intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  const handleCanvasClick = useCallback(async (e) => {
    if (!isActive || processingRef.current) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const imageCoords = screenToImageCoords(clickX, clickY);

    if (imageCoords.x < 0 || imageCoords.x > imageSize.width ||
      imageCoords.y < 0 || imageCoords.y > imageSize.height) {
      return;
    }

    // 1. If in Edit Mode, check if we're clicking a vertex OR near an edge
    if (editingMode && currentPolygon) {
      const threshold = 10;
      let clickedPIndex = -1;
      for (let i = 0; i < currentPolygon.points.length; i++) {
        const sPt = imageToScreenCoords(currentPolygon.points[i].x, currentPolygon.points[i].y);
        const dist = Math.sqrt((clickX - sPt.x) ** 2 + (clickY - sPt.y) ** 2);
        if (dist <= threshold) {
          clickedPIndex = i;
          break;
        }
      }

      if (clickedPIndex >= 0) {
        setDraggedPointIndex(clickedPIndex);
        return;
      }

      // If not clicking a vertex, maybe add one to an edge
      if (!e.altKey && !e.ctrlKey) {
        addPointOnEdge(clickX, clickY);
        return;
      }
    }

    // 2. Otherwise, handle as a Refinement Point
    // ROBFLOW SPEC: Automatic Inside/Outside detection
    const isInside = currentPolygon && isPointInPolygon(imageCoords, currentPolygon.points);
    const label = isInside ? 0 : 1; // Inside means "remove", Outside means "add"

    // Fallback to manual Alt key if specifically used
    const finalLabel = e.altKey ? 0 : label;

    const newPoints = [...refinementPoints, { ...imageCoords, label: finalLabel }];
    setRefinementPoints(newPoints);
    setPreviewPolygon(null);
    await runSegmentation(newPoints, false);
  }, [isActive, refinementPoints, currentPolygon, editingMode, imageSize, screenToImageCoords, imageToScreenCoords, addPointOnEdge, isPointInPolygon]);

  const handleMouseMove = useCallback((e) => {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // FIRST: Check if mouse is physically outside the canvas element
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return; // Stop immediately if outside canvas
    }

    const imageCoords = screenToImageCoords(x, y);

    // SECOND: Check if mouse is within image bounds
    const isOutOfBounds =
      imageCoords.x < 0 ||
      imageCoords.x > imageSize.width ||
      imageCoords.y < 0 ||
      imageCoords.y > imageSize.height;

    if (isOutOfBounds) {
      // Clear preview when mouse leaves the image
      if (previewPolygon) {
        setPreviewPolygon(null);
      }
      return;
    }

    // Vertex Dragging Logic
    if (draggedPointIndex >= 0 && currentPolygon) {
      const newPoints = [...currentPolygon.points];
      newPoints[draggedPointIndex] = imageCoords;
      setCurrentPolygon({ ...currentPolygon, points: newPoints });
      return;
    }

    // Hover Preview Logic - STRICT CONDITIONS:
    // 1. Only BEFORE first click (refinementPoints.length === 0)
    // 2. Only when mouse is INSIDE image bounds
    // 3. Not while processing
    // 4. With throttling to prevent lag
    if (isActive &&
      !processingRef.current &&
      !isOutOfBounds &&
      refinementPoints.length === 0 &&
      !currentPolygon) {
      const now = Date.now();
      if (now - lastHoverRequestRef.current > 150) { // Fast response for better UX
        lastHoverRequestRef.current = now;
        const pts = [{ ...imageCoords, label: 1 }];
        runSegmentation(pts, true);
      }
    }
  }, [isActive, draggedPointIndex, currentPolygon, refinementPoints, screenToImageCoords, imageSize, runSegmentation, previewPolygon]);

  const handleMouseUp = useCallback(() => {
    setDraggedPointIndex(-1);
  }, []);

  const handleRightClick = useCallback((e) => {
    e.preventDefault();
    if (refinementPoints.length > 0) {
      const nextPoints = refinementPoints.slice(0, -1);
      setRefinementPoints(nextPoints);
      if (nextPoints.length > 0) runSegmentation(nextPoints, false);
      else {
        setCurrentPolygon(null);
        setPreviewPolygon(null);
        setEditingMode(false);
      }
    } else if (editingMode && currentPolygon) {
      cancelPolygon();
    }
  }, [refinementPoints, editingMode, currentPolygon, cancelPolygon]);

  // --- Rendering ---
  const renderPolygon = (ctx) => {
    const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    console.log('🖌️ renderPolygon called:', {
      hasPreview: !!previewPolygon,
      previewPoints: previewPolygon?.points?.length || 0,
      hasCurrent: !!currentPolygon,
      currentPoints: currentPolygon?.points?.length || 0
    });

    // Draw Blue "Ghost" Preview
    if (previewPolygon && previewPolygon.points) {
      ctx.beginPath();
      previewPolygon.points.forEach((p, i) => {
        const s = imageToScreenCoords(p.x, p.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.setLineDash([5, 5]); // Dashed line for ghost look
      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)';
      ctx.strokeStyle = 'rgba(24, 144, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash
    }

    // Draw Main Generated Polygon
    if (currentPolygon && currentPolygon.points) {
      ctx.beginPath();
      currentPolygon.points.forEach((p, i) => {
        const s = imageToScreenCoords(p.x, p.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(82, 196, 26, 0.25)';
      ctx.strokeStyle = '#52c41a';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Draw vertices if editing
      if (editingMode) {
        currentPolygon.points.forEach((p, i) => {
          const s = imageToScreenCoords(p.x, p.y);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = i === draggedPointIndex ? '#ff4d4f' : '#52c41a';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        });
      }
    }

    // Draw Refinement Clicks
    refinementPoints.forEach(p => {
      const s = imageToScreenCoords(p.x, p.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = p.label === 1 ? '#52c41a' : '#ff4d4f';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  return {
    handleCanvasClick,
    handleMouseMove,
    handleMouseUp,
    handleRightClick,
    renderPolygon,
    isProcessing,
    editingMode,
    currentPolygon,
    previewPolygon, // Expose for canvas redraw triggering
    completePolygon,
    cancelPolygon,
    complexity,
    setComplexity,
    ProcessingIndicator: () => isProcessing ? (
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'rgba(0,0,0,0.85)', color: 'white', padding: '1rem 1.5rem', borderRadius: '0.75rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <Spin size="small" />
        <span style={{ fontWeight: 500 }}>Smart Segmenting...</span>
      </div>
    ) : null
  };
};

export default SmartPolygonTool;