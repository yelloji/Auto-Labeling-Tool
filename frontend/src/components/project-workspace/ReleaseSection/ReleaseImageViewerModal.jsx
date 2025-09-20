import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Space, Typography, Tag, Spin, message, Tooltip, Slider, Input } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  ZoomInOutlined, 
  ZoomOutOutlined,
  FullscreenOutlined,
  TagsOutlined,
  FileImageOutlined,
  InfoCircleOutlined,
  EditOutlined,
  DownloadOutlined,
  UndoOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { logInfo, logError } from '../../../utils/professional_logger';

const { Text, Title } = Typography;


const ReleaseImageViewerModal = ({ 
  visible, 
  onClose, 
  images, 
  currentIndex, 
  onIndexChange,
  releaseId,
  annotations = {},
  classMapping = {},
  showAnnotations = true
}) => {
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [autoFitZoom, setAutoFitZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showAnnotationOverlay, setShowAnnotationOverlay] = useState(showAnnotations);
  
  // Drawing functionality
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [hasDrawings, setHasDrawings] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]); // Rectangle boxes for text
  const [textElements, setTextElements] = useState([]);
  const [activeTextInput, setActiveTextInput] = useState(null);
  const [isDrawingTextBox, setIsDrawingTextBox] = useState(false);
  const [currentTextBox, setCurrentTextBox] = useState(null);
  
  // Refs
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const currentImage = images[currentIndex];
  
  // Use same key-matching logic as thumbnails
  const imageAnnotations = currentImage ? (() => {
    const { path, filename, fullPath } = currentImage;
    // Handle both forward and backward slashes for cross-platform compatibility
    const normalizedPath = path.replace(/\\/g, '/');
    const backslashPath = path.replace(/\//g, '\\');
    const possibleKeys = [path, filename, fullPath, normalizedPath, backslashPath];
    
    for (const key of possibleKeys) {
      if (annotations[key]) {
        console.log(`✅ Modal found annotations for image using key: ${key}`, annotations[key]);
        return annotations[key];
      }
    }
    
    console.log(`❌ Modal: No annotations found for any key variant:`, possibleKeys);
    return [];
  })() : [];

  useEffect(() => {
    setImageLoaded(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    setShowAnnotationOverlay(showAnnotations);
  }, [showAnnotations]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      clearDrawings();
      onIndexChange(currentIndex - 1);
      logInfo('app.frontend.ui', 'image_viewer_previous', 'Previous image clicked', {
        timestamp: new Date().toISOString(),
        currentIndex: currentIndex - 1,
        totalImages: images.length
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      clearDrawings();
      onIndexChange(currentIndex + 1);
      logInfo('app.frontend.ui', 'image_viewer_next', 'Next image clicked', {
        timestamp: new Date().toISOString(),
        currentIndex: currentIndex + 1,
        totalImages: images.length
      });
    }
  };

  // Auto-fit calculation
  const calculateAutoFit = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return 1;
    
    const container = containerRef.current;
    const img = imageRef.current;
    
    const containerWidth = container.clientWidth - 40; // padding
    const containerHeight = container.clientHeight - 40;
    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;
    
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const autoFit = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
    
    return autoFit;
  }, []);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    const autoFit = calculateAutoFit();
    setZoom(autoFit);
    setAutoFitZoom(autoFit);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    const autoFit = calculateAutoFit();
    setZoom(autoFit);
    setAutoFitZoom(autoFit);
    setPan({ x: 0, y: 0 });
  };

  const handleActualSize = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  }, []);

  const handleMouseDown = (e) => {
    if (!svgRef.current) return; // Guard against null ref
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (textMode) {
      // Check if clicking inside an existing text box to add text
      const clickedTextBox = textBoxes.find(box => 
        x >= box.x && x <= box.x + box.width &&
        y >= box.y && y <= box.y + box.height
      );
      
      if (clickedTextBox) {
        // Click inside existing text box - create text input
        const newTextInput = {
          id: Date.now(),
          x: clickedTextBox.x + 1, // Slightly inside the box
          y: clickedTextBox.y + 1,
          text: '',
          fontSize: 3,
          color: '#ff0000',
          boxId: clickedTextBox.id
        };
        setActiveTextInput(newTextInput);
        return;
      } else {
        // Start drawing a new text box
        console.log('Starting text box drawing at:', x, y);
        setIsDrawingTextBox(true);
        setCurrentTextBox({ x, y, width: 0, height: 0, id: Date.now() });
        return;
      }
    }
    
    if (drawingMode) {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
    } else if (zoom > autoFitZoom) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!svgRef.current) return; // Guard against null ref
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (isDrawingTextBox && currentTextBox) {
      // Update text box dimensions while dragging
      const newBox = {
        ...currentTextBox,
        width: Math.abs(x - currentTextBox.x),
        height: Math.abs(y - currentTextBox.y),
        x: Math.min(x, currentTextBox.x),
        y: Math.min(y, currentTextBox.y)
      };
      console.log('Updating text box:', newBox);
      setCurrentTextBox(newBox);
    } else if (isDrawing && drawingMode) {
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (isDragging && zoom > autoFitZoom) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawingTextBox && currentTextBox && currentTextBox.width > 1 && currentTextBox.height > 1) {
      // Complete text box drawing (only if box is big enough)
      console.log('Completing text box:', currentTextBox);
      setTextBoxes(prev => [...prev, currentTextBox]);
      setCurrentTextBox(null);
      setIsDrawingTextBox(false);
      setHasDrawings(true);
    } else if (isDrawing && currentPath.length > 0 && drawingMode) {
      // Only add path if we're in drawing mode and have a valid path
      setDrawingPaths(prev => {
        const newPaths = [...prev, [...currentPath]]; // Create a copy of the path
        console.log('Adding drawing path:', currentPath, 'Total paths:', newPaths.length);
        return newPaths;
      });
      setCurrentPath([]);
      setHasDrawings(true); // Set hasDrawings after adding path
    }
    setIsDrawing(false);
    setIsDrawingTextBox(false);
    setIsDragging(false);
  };

  // Drawing controls
  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode);
    if (!drawingMode) setTextMode(false); // Disable text mode when enabling drawing mode
    if (drawingMode) {
      setIsDrawing(false);
      setCurrentPath([]);
    }
  };

  const clearDrawings = () => {
    setDrawingPaths([]);
    setCurrentPath([]);
    setTextBoxes([]);
    setTextElements([]);
    setHasDrawings(false);
  };

  const undoLastDrawing = () => {
    if (textElements.length > 0) {
      // Undo text first (most recent action)
      const newTexts = [...textElements];
      newTexts.pop();
      setTextElements(newTexts);
      setHasDrawings(drawingPaths.length > 0 || textBoxes.length > 0 || newTexts.length > 0);
    } else if (textBoxes.length > 0) {
      // Undo text box
      const newBoxes = [...textBoxes];
      newBoxes.pop();
      setTextBoxes(newBoxes);
      setHasDrawings(drawingPaths.length > 0 || newBoxes.length > 0 || textElements.length > 0);
    } else if (drawingPaths.length > 0) {
      // Undo drawing path
      const newPaths = [...drawingPaths];
      newPaths.pop();
      setDrawingPaths(newPaths);
      setHasDrawings(newPaths.length > 0 || textBoxes.length > 0 || textElements.length > 0);
    }
  };

  const handleTextInputComplete = (text) => {
    if (activeTextInput && text && text.trim()) {
      const newTextElement = {
        ...activeTextInput,
        text: text.trim()
      };
      setTextElements(prev => [...prev, newTextElement]);
      setHasDrawings(true);
    }
    setActiveTextInput(null);
  };

  const handleTextInputCancel = () => {
    setActiveTextInput(null);
  };



  // Download functionality
  const downloadImageWithDrawings = async () => {
    console.log('Download attempt - hasDrawings:', hasDrawings, 'drawingPaths:', drawingPaths.length, 'textBoxes:', textBoxes.length, 'textElements:', textElements.length);
    if (!hasDrawings || !imageRef.current) return;
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const originalImg = imageRef.current;
      
      // Create a new image with CORS enabled to avoid tainted canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = originalImg.src;
      });
      
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Draw the annotations
      ctx.strokeStyle = '#ff4d4f';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      drawingPaths.forEach(path => {
        if (path.length > 1) {
          ctx.beginPath();
          path.forEach((point, index) => {
            const x = (point.x / 100) * canvas.width;
            const y = (point.y / 100) * canvas.height;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        }
      });

      // Draw text boxes
      ctx.strokeStyle = '#0066cc';
      ctx.lineWidth = 2;
      textBoxes.forEach(box => {
        const x = (box.x / 100) * canvas.width;
        const y = (box.y / 100) * canvas.height;
        const width = (box.width / 100) * canvas.width;
        const height = (box.height / 100) * canvas.height;
        ctx.strokeRect(x, y, width, height);
      });

      // Draw text elements
      textElements.forEach(textElement => {
        const x = (textElement.x / 100) * canvas.width;
        const y = (textElement.y / 100) * canvas.height;
        const fontSize = (textElement.fontSize / 100) * Math.min(canvas.width, canvas.height);
        
        ctx.fillStyle = textElement.color;
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(textElement.text, x, y);
      });
      
      // Create download link
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `annotated_${currentImage.filename}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        message.success('Image downloaded successfully!');
      }, 'image/png');
      
    } catch (error) {
      console.error('Download failed:', error);
      message.error('Failed to download image');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'Escape') {
      if (drawingMode) {
        setDrawingMode(false);
      } else {
        clearDrawings();
        onClose();
      }
    } else if (e.key === '+' || e.key === '=') {
      handleZoomIn();
    } else if (e.key === '-') {
      handleZoomOut();
    } else if (e.key === '0') {
      handleFitToScreen();
    } else if (e.key === '1') {
      handleActualSize();
    } else if (e.key === 'd' || e.key === 'D') {
      toggleDrawingMode();
    } else if (e.key === 't' || e.key === 'T') {
      setTextMode(!textMode);
      setDrawingMode(false);
    } else if (e.key === 'z' || e.key === 'Z') {
      if (e.ctrlKey || e.metaKey) {
        undoLastDrawing();
      }
    } else if (e.key === 'c' || e.key === 'C') {
      if (e.ctrlKey || e.metaKey) {
        clearDrawings();
      }
    }
  };

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [visible, currentIndex, isDragging, dragStart, pan, isDrawing, drawingMode]);

  // Reset state when image changes
  useEffect(() => {
    // Don't clear drawingPaths - keep drawings when switching images
    setCurrentPath([]);
    setTextElements([]);
    setDrawingMode(false);
    setTextMode(false);
    setIsDrawing(false);
    setPan({ x: 0, y: 0 });
    setImageLoaded(false);
  }, [currentIndex]);

  // Auto-fit when image loads
  useEffect(() => {
    if (imageLoaded && imageRef.current && containerRef.current) {
      setTimeout(() => {
        const autoFit = calculateAutoFit();
        setZoom(autoFit);
        setAutoFitZoom(autoFit);
      }, 100);
    }
  }, [imageLoaded, calculateAutoFit]);

  if (!currentImage) {
    return null;
  }

  const fullImageUrl = `http://localhost:12000/api/v1/releases/${releaseId}/file/${currentImage.path}`;

  return (
    <Modal
      title={
        <div style={{ 
          position: 'relative',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: '#1a2332',
          color: 'white',
          padding: '12px 20px',
          margin: '-16px -24px 16px -24px',
          borderRadius: '8px 8px 0 0'
        }}>
          {/* Left - Back Button */}
          <div style={{ flex: '0 0 auto' }}>
            <Button 
              icon={<LeftOutlined />} 
              onClick={onClose}
              type="text"
              style={{ color: 'white', border: 'none' }}
            >
              Back
            </Button>
          </div>
          
          {/* Center - Navigation */}
          <div style={{ 
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', 
            alignItems: 'center',
            gap: '8px'
          }}>
            <Button 
              icon={<LeftOutlined />} 
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              type="text"
              style={{ color: 'white', border: 'none' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>Previous</span>
            <Text style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 16px' }}>
              {currentIndex + 1}/{images.length}
            </Text>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>Next</span>
            <Button 
              icon={<RightOutlined />} 
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
              type="text"
              style={{ color: 'white', border: 'none' }}
            />
          </div>
          
          {/* Right - Filename (no close button) */}
          <div style={{ flex: '0 0 auto' }}>
            <Space>
              <FileImageOutlined style={{ fontSize: '18px' }} />
              <span style={{ fontSize: '16px', fontWeight: '600' }}>{currentImage.filename}</span>
            </Space>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width="95vw"
      style={{ top: 10 }}
      closable={false}
      styles={{
        body: { 
          padding: '0',
          background: '#1a2332'
        },
        header: { 
          padding: '0',
          border: 'none',
          background: 'transparent'
        }
      }}
      footer={null}
    >
      {/* Main Layout - Left Image, Right Controls */}
      <div style={{ 
        display: 'flex', 
        height: '85vh',
        background: '#1a2332'
      }}>
        
        {/* Left Side - Image Display */}
        <div 
          ref={containerRef}
          style={{ 
            flex: '1',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            background: '#1a2332',
            cursor: textMode ? 'crosshair' : (drawingMode ? 'crosshair' : (zoom > autoFitZoom ? (isDragging ? 'grabbing' : 'grab') : 'default')),
            margin: '20px',
            borderRadius: '12px',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)'
          }}
          onWheel={handleWheel}
        >
        {loading && (
          <div style={{ 
            position: 'absolute', 
            zIndex: 10,
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <Spin size="large" />
          </div>
        )}
        
        <div
          style={{
            position: 'relative',
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging || isDrawing ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}
          onMouseDown={handleMouseDown}
        >
          <img
            ref={imageRef}
            src={fullImageUrl}
            alt={currentImage.filename}
            crossOrigin="anonymous"
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              minHeight: '60vh',
              objectFit: 'contain',
              display: imageLoaded ? 'block' : 'none',
              borderRadius: '8px'
            }}
            onLoad={(e) => {
              setImageLoaded(true);
              setLoading(false);
              // Store image dimensions for annotation calculations
              window.modalImageWidth = e.target.naturalWidth;
              window.modalImageHeight = e.target.naturalHeight;
              console.log(`🔍 Modal image loaded: ${window.modalImageWidth}x${window.modalImageHeight}`);
              logInfo('app.frontend.ui', 'modal_image_loaded', 'Modal image loaded successfully', {
                timestamp: new Date().toISOString(),
                filename: currentImage.filename,
                releaseId: releaseId,
                imagePath: currentImage.path
              });
            }}
            onError={(e) => {
              setLoading(false);
              logError('app.frontend.ui', 'modal_image_load_failed', 'Modal image failed to load', {
                timestamp: new Date().toISOString(),
                filename: currentImage.filename,
                releaseId: releaseId,
                imagePath: currentImage.path,
                error: e.message || 'Image load error'
              });
              message.error(`Failed to load image: ${currentImage.filename}`);
            }}
            onLoadStart={() => {
              setLoading(true);
            }}
            draggable={false}
          />
          
          {/* Enhanced Annotation and Drawing Overlay */}
          <svg
              key="drawing-overlay"
              ref={svgRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: (drawingMode || textMode) ? 'auto' : 'none',
                borderRadius: '8px',
                zIndex: 10
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Original Annotations */}
              {showAnnotationOverlay && imageAnnotations.length > 0 && 
                imageAnnotations.map((annotation, annIndex) => {
                const { class_id, bbox, polygon, segmentation, type } = annotation;
                const className = classMapping[class_id] || `Class ${class_id}`;
                const color = getClassColor(class_id);
                
                // Handle polygon annotations (flat array format)
                if (polygon && Array.isArray(polygon) && polygon.length > 0) {
                  // Convert flat array [x1, y1, x2, y2, ...] to points
                  const points = [];
                  for (let i = 0; i < polygon.length; i += 2) {
                    if (i + 1 < polygon.length) {
                      points.push({ x: polygon[i], y: polygon[i + 1] });
                    }
                  }
                  
                  if (points.length > 0) {
                    // Convert polygon points to SVG path
                    const pathData = points.map((point, index) => {
                      const x = point.x * 100; // Convert to percentage
                      const y = point.y * 100;
                      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ') + ' Z'; // Close the path
                    
                    // Calculate centroid for text placement
                    const centroidX = points.reduce((sum, p) => sum + p.x, 0) / points.length * 100;
                    const centroidY = points.reduce((sum, p) => sum + p.y, 0) / points.length * 100;
                    
                    return (
                      <g key={annIndex}>
                        <path
                          d={pathData}
                          fill={color}
                          fillOpacity="0.1"
                          stroke={color}
                          strokeWidth="0.5"
                          opacity="0.8"
                        />
                        <text
                          x={centroidX}
                          y={centroidY}
                          fill={color}
                          fontSize="3"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {className}
                        </text>
                      </g>
                    );
                  }
                }
                
                // Handle segmentation annotations (point objects)
                if (type === 'polygon' && segmentation && Array.isArray(segmentation)) {
                  // Convert polygon points to SVG path
                  const pathData = segmentation.map((point, index) => {
                    const x = (point.x / 1) * 100; // Assuming normalized coordinates
                    const y = (point.y / 1) * 100;
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ') + ' Z'; // Close the path
                  
                  // Calculate centroid for text placement
                  const centroidX = segmentation.reduce((sum, p) => sum + p.x, 0) / segmentation.length * 100;
                  const centroidY = segmentation.reduce((sum, p) => sum + p.y, 0) / segmentation.length * 100;
                  
                  return (
                    <g key={annIndex}>
                      <path
                        d={pathData}
                        fill={color}
                        fillOpacity="0.1"
                        stroke={color}
                        strokeWidth="0.5"
                        opacity="0.8"
                      />
                      <text
                        x={centroidX}
                        y={centroidY}
                        fontSize="3"
                        fill={color}
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ textShadow: '0 0 2px rgba(255,255,255,0.8)' }}
                      >
                        {className}
                      </text>
                    </g>
                  );
                }
                
                // Handle bounding box annotations
                if (bbox && Array.isArray(bbox) && bbox.length >= 4) {
                  // YOLO format: [center_x, center_y, width, height]
                  const [center_x, center_y, width, height] = bbox;
                  
                  // Convert to corner format: [x, y, width, height]  
                  const x = center_x - width/2;
                  const y = center_y - height/2;
                  
                  // Check if coordinates are normalized (0-1) or pixel values
                  const imageWidth = window.modalImageWidth || 1;
                  const imageHeight = window.modalImageHeight || 1;
                  console.log(`🔍 BBOX DEBUG: YOLO [${center_x}, ${center_y}, ${width}, ${height}] → Corner [${x}, ${y}, ${width}, ${height}], imageSize: ${imageWidth}x${imageHeight}`);
                  const isNormalized = center_x <= 1 && center_y <= 1 && width <= 1 && height <= 1;
                  console.log(`🔍 BBOX isNormalized: ${isNormalized}`);
                  
                  let rectX, rectY, rectWidth, rectHeight;
                  if (isNormalized) {
                    // Normalized coordinates (0-1) - convert to percentages
                    rectX = x * 100;
                    rectY = y * 100;
                    rectWidth = width * 100;
                    rectHeight = height * 100;
                  } else {
                    // Pixel coordinates - convert to percentages based on image size
                    rectX = (x / imageWidth) * 100;
                    rectY = (y / imageHeight) * 100;
                    rectWidth = (width / imageWidth) * 100;
                    rectHeight = (height / imageHeight) * 100;
                  }
                  
                  return (
                    <g key={annIndex}>
                      {/* Bounding box */}
                      <rect
                        x={rectX}
                        y={rectY}
                        width={rectWidth}
                        height={rectHeight}
                        fill={color}
                        fillOpacity="0.1"
                        stroke={color}
                        strokeWidth="0.5"
                        opacity="0.8"
                      />
                      {/* Class label background */}
                      <rect
                        x={rectX}
                        y={Math.max(0, rectY - 4)}
                        width={className.length * 1.2 + 2}
                        height="4"
                        fill={color}
                        opacity="0.8"
                      />
                      {/* Class label text */}
                      <text
                        x={rectX + 1}
                        y={Math.max(2.5, rectY - 0.5)}
                        fontSize="2.5"
                        fill="white"
                        fontWeight="bold"
                      >
                        {className}
                      </text>
                    </g>
                  );
                }
                
                // Return null for unsupported annotation types
                return null;
              })}
              
              {/* Drawing Paths */}
              {console.log('RENDERING PATHS:', drawingPaths)}
              {drawingPaths.map((path, pathIndex) => {
                if (path.length < 2) return null;
                const pathData = path.map((point, index) => 
                  `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                ).join(' ');
                
                return (
                  <path
                    key={`drawing-${pathIndex}`}
                    d={pathData}
                    fill="none"
                    stroke="#ff4d4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="1"
                  />
                );
              })}
              
              {/* Current Drawing Path */}
              {currentPath.length > 1 && (
                <path
                  d={currentPath.map((point, index) => 
                    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                  ).join(' ')}
                  fill="none"
                  stroke="#ff4d4f"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
              )}

              {/* Text boxes */}
              {textBoxes.map((box) => (
                <rect
                  key={box.id}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  fill="none"
                  stroke="#0066cc"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  opacity="1"
                />
              ))}

              {/* Current text box being drawn */}
              {currentTextBox && (
                <rect
                  x={currentTextBox.x}
                  y={currentTextBox.y}
                  width={currentTextBox.width}
                  height={currentTextBox.height}
                  fill="none"
                  stroke="#0066cc"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  opacity="1"
                />
              )}

              {/* Text elements */}
              {textElements.map((textElement) => (
                <text
                  key={textElement.id}
                  x={textElement.x}
                  y={textElement.y}
                  fontSize={textElement.fontSize}
                  fill={textElement.color}
                  fontFamily="Arial, sans-serif"
                  fontWeight="bold"
                  textAnchor="start"
                  dominantBaseline="hanging"
                >
                  {textElement.text}
                </text>
              ))}
            </svg>

          {/* Active Text Input */}
          {activeTextInput && (
            <input
              type="text"
              autoFocus
              style={{
                position: 'absolute',
                left: `${activeTextInput.x}%`,
                top: `${activeTextInput.y}%`,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '2px solid #ff0000',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                color: '#ff0000',
                zIndex: 1000,
                minWidth: '100px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextInputComplete(e.target.value);
                } else if (e.key === 'Escape') {
                  handleTextInputCancel();
                }
              }}
              onBlur={(e) => {
                handleTextInputComplete(e.target.value);
              }}
              placeholder="Type text here..."
            />
          )}
        </div>
        </div>
        
        {/* Right Side - Controls Panel */}
        <div style={{ 
          width: '300px',
          background: 'rgba(255,255,255,0.95)',
          padding: '20px',
          overflowY: 'auto',
          borderLeft: '1px solid rgba(255,255,255,0.2)'
        }}>
          
          {/* Image Info Section */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              color: '#2c3e50', 
              marginBottom: '12px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Image Info
            </h4>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text strong style={{ color: '#34495e' }}>File:</Text>
                <br />
                <Text code style={{ 
                  background: 'rgba(52, 73, 94, 0.1)', 
                  color: '#2c3e50',
                  fontSize: '12px'
                }}>
                  {currentImage.filename}
                </Text>
              </div>
              <div>
                <Text strong style={{ color: '#34495e' }}>Split:</Text>
                <br />
                <Tag color={getSplitColor(currentImage.split)} style={{ fontWeight: '500' }}>
                  {currentImage.split.toUpperCase()}
                </Tag>
              </div>
              <div>
                <Text strong style={{ color: '#34495e' }}>Annotations:</Text>
                <br />
                <Text style={{ color: '#7f8c8d' }}>{imageAnnotations.length}</Text>
              </div>
              {hasDrawings && (
                <div>
                  <Text strong style={{ color: '#34495e' }}>Drawings:</Text>
                  <br />
                  <Text style={{ color: '#e74c3c' }}>{drawingPaths.length}</Text>
                </div>
              )}
            </Space>
          </div>

          {/* Zoom Controls Section */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              color: '#2c3e50', 
              marginBottom: '12px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Zoom
            </h4>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button 
                  icon={<ZoomOutOutlined />} 
                  onClick={handleZoomOut} 
                  disabled={zoom <= 0.1}
                  size="small"
                />
                <Text style={{ 
                  minWidth: '60px', 
                  textAlign: 'center',
                  background: 'rgba(52, 73, 94, 0.1)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  {Math.round(zoom * 100)}%
                </Text>
                <Button 
                  icon={<ZoomInOutlined />} 
                  onClick={handleZoomIn} 
                  disabled={zoom >= 5}
                  size="small"
                />
              </div>
              <Button 
                onClick={handleFitToScreen}
                size="small"
                style={{ width: '100%' }}
              >
                Fit to Screen
              </Button>
            </Space>
          </div>

          {/* Tools Section */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              color: '#2c3e50', 
              marginBottom: '12px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Tools
            </h4>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button
                icon={<TagsOutlined />}
                type={showAnnotationOverlay ? "primary" : "default"}
                onClick={() => setShowAnnotationOverlay(!showAnnotationOverlay)}
                style={{ width: '100%' }}
                size="small"
              >
                {showAnnotationOverlay ? 'Hide' : 'Show'} Annotations
              </Button>
            </Space>
          </div>


        </div>
      </div>
    </Modal>
  );
};

// Helper function to get split color
const getSplitColor = (split) => {
  switch (split?.toLowerCase()) {
    case 'train': return 'blue';
    case 'val': case 'valid': return 'orange';
    case 'test': return 'red';
    default: return 'default';
  }
};

// Helper function to get class color
const getClassColor = (classId) => {
  const colors = [
    '#ff4d4f', '#1890ff', '#52c41a', '#faad14', '#722ed1',
    '#eb2f96', '#13c2c2', '#fa541c', '#a0d911', '#2f54eb'
  ];
  return colors[classId % colors.length];
};

export default ReleaseImageViewerModal;