import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Typography, Tag, Spin, message } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  ZoomInOutlined, 
  ZoomOutOutlined,
  FullscreenOutlined,
  TagsOutlined,
  FileImageOutlined,
  InfoCircleOutlined
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showAnnotationOverlay, setShowAnnotationOverlay] = useState(showAnnotations);

  const currentImage = images[currentIndex];
  const imageAnnotations = currentImage ? annotations[currentImage.path] || [] : [];

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
      onIndexChange(currentIndex + 1);
      logInfo('app.frontend.ui', 'image_viewer_next', 'Next image clicked', {
        timestamp: new Date().toISOString(),
        currentIndex: currentIndex + 1,
        totalImages: images.length
      });
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'Escape') {
      onClose();
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
  }, [visible, currentIndex, isDragging, dragStart, pan]);

  if (!currentImage) {
    return null;
  }

  const fullImageUrl = `http://localhost:12000/api/v1/releases/${releaseId}/file/${currentImage.path}`;

  return (
    <Modal
      title={
        <Space>
          <FileImageOutlined />
          <span>{currentImage.filename}</span>
          <Tag color={getSplitColor(currentImage.split)}>
            {currentImage.split.toUpperCase()}
          </Tag>
          {imageAnnotations.length > 0 && (
            <Tag color="red">
              {imageAnnotations.length} annotation{imageAnnotations.length !== 1 ? 's' : ''}
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width="90vw"
      style={{ top: 20 }}
      footer={[
        <Space key="controls" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button 
              icon={<LeftOutlined />} 
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>
            <Text>
              {currentIndex + 1} of {images.length}
            </Text>
            <Button 
              icon={<RightOutlined />} 
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
            >
              Next
            </Button>
          </Space>
          
          <Space>
            <Button
              icon={<TagsOutlined />}
              type={showAnnotationOverlay ? "primary" : "default"}
              onClick={() => setShowAnnotationOverlay(!showAnnotationOverlay)}
            >
              {showAnnotationOverlay ? 'Hide' : 'Show'} Annotations
            </Button>
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={zoom <= 0.1} />
            <Text style={{ minWidth: '60px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Text>
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={zoom >= 5} />
            <Button icon={<FullscreenOutlined />} onClick={handleResetZoom}>
              Reset
            </Button>
          </Space>
        </Space>
      ]}
    >
      <div style={{ 
        height: '70vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f5f5f5',
        cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
      }}>
        {loading && (
          <div style={{ position: 'absolute', zIndex: 10 }}>
            <Spin size="large" />
          </div>
        )}
        
        <div
          style={{
            position: 'relative',
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease'
          }}
          onMouseDown={handleMouseDown}
        >
          <img
            src={fullImageUrl}
            alt={currentImage.filename}
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              display: imageLoaded ? 'block' : 'none'
            }}
            onLoad={() => {
              setImageLoaded(true);
              setLoading(false);
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
          
          {/* Annotation Overlay */}
          {showAnnotationOverlay && imageLoaded && imageAnnotations.length > 0 && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {imageAnnotations.map((annotation, annIndex) => {
                const { class_id, bbox } = annotation;
                const className = classMapping[class_id] || `Class ${class_id}`;
                const color = getClassColor(class_id);
                
                // Convert bbox coordinates to percentages
                const [x, y, width, height] = bbox;
                const rectX = x * 100;
                const rectY = y * 100;
                const rectWidth = width * 100;
                const rectHeight = height * 100;
                
                return (
                  <g key={annIndex}>
                    {/* Bounding box */}
                    <rect
                      x={rectX}
                      y={rectY}
                      width={rectWidth}
                      height={rectHeight}
                      fill="none"
                      stroke={color}
                      strokeWidth="0.5"
                      vectorEffect="non-scaling-stroke"
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
              })}
            </svg>
          )}
        </div>
      </div>
      
      {/* Image Metadata */}
      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Text strong>File:</Text>
            <Text code>{currentImage.filename}</Text>
          </Space>
          <Space>
            <Text strong>Split:</Text>
            <Tag color={getSplitColor(currentImage.split)}>
              {currentImage.split.toUpperCase()}
            </Tag>
          </Space>
          <Space>
            <Text strong>Path:</Text>
            <Text type="secondary">{currentImage.path}</Text>
          </Space>
          {imageAnnotations.length > 0 && (
            <Space>
              <Text strong>Annotations:</Text>
              <Space wrap>
                {imageAnnotations.map((annotation, index) => {
                  const className = classMapping[annotation.class_id] || `Class ${annotation.class_id}`;
                  return (
                    <Tag key={index} color={getClassColor(annotation.class_id)} size="small">
                      {className}
                    </Tag>
                  );
                })}
              </Space>
            </Space>
          )}
        </Space>
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