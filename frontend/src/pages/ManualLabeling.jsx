import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Layout, 
  Button, 
  Typography, 
  message,
  Space,
  Progress,
  Divider,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

// Import our annotation components
import AnnotationCanvas from '../components/AnnotationToolset/AnnotationCanvas';
import AnnotationToolbox from '../components/AnnotationToolset/AnnotationToolbox';
import LabelSelectionPopup from '../components/AnnotationToolset/LabelSelectionPopup';
import LabelSidebar from '../components/AnnotationToolset/LabelSidebar';
import AnnotationSplitControl from '../components/AnnotationToolset/AnnotationSplitControl';
import AnnotationAPI from '../components/AnnotationToolset/AnnotationAPI';

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

const ManualLabeling = () => {
  const { datasetId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const imageId = searchParams.get('imageId');
  const navigate = useNavigate();
  
  // Core state
  const [imageList, setImageList] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Annotation state
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [activeTool, setActiveTool] = useState('box');
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // Label management
  const [projectLabels, setProjectLabels] = useState([]);
  const [imageLabels, setImageLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  
  // UI state
  const [showLabelPopup, setShowLabelPopup] = useState(false);
  const [labelPopupPosition, setLabelPopupPosition] = useState({ x: 0, y: 0 });
  const [currentSplit, setCurrentSplit] = useState('train');
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  
  // Dataset progress
  const [datasetProgress, setDatasetProgress] = useState({
    total: 0,
    labeled: 0,
    percentage: 0
  });

  // Load initial data
  useEffect(() => {
    loadDatasetImages();
    loadProjectLabels();
  }, [datasetId]);

  // Load specific image when imageId changes
  useEffect(() => {
    if (imageId && imageList.length > 0) {
      const index = imageList.findIndex(img => img.id === imageId);
      if (index !== -1) {
        setCurrentImageIndex(index);
        loadImageData(imageList[index]);
      }
    }
  }, [imageId, imageList]);

  // Load current image data
  useEffect(() => {
    if (imageList.length > 0 && currentImageIndex >= 0) {
      loadImageData(imageList[currentImageIndex]);
    }
  }, [currentImageIndex, imageList]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key.toLowerCase() === 'l' && pendingShape && !showLabelPopup) {
        setShowLabelPopup(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pendingShape, showLabelPopup]);

  const loadDatasetImages = async () => {
    try {
      setLoading(true);
      const response = await AnnotationAPI.getDatasetImages(datasetId);
      setImageList(response.images);
      setDatasetProgress({
        total: response.images.length,
        labeled: response.images.filter(img => img.is_labeled).length,
        percentage: response.images.length > 0 ? 
          Math.round((response.images.filter(img => img.is_labeled).length / response.images.length) * 100) : 0
      });
    } catch (error) {
      message.error('Failed to load dataset images');
      console.error('Load images error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectLabels = async () => {
    try {
      const labels = await AnnotationAPI.getProjectLabels(datasetId);
      setProjectLabels(labels);
    } catch (error) {
      console.error('Load project labels error:', error);
    }
  };

  const loadImageData = async (image) => {
    try {
      setLoading(true);
      setImageData(image);
      setCurrentSplit(image.split_type || 'train');
      
      // Load image URL
      const imageUrl = await AnnotationAPI.getImageUrl(image.id);
      setImageUrl(imageUrl);
      
      // Load annotations
      const annotations = await AnnotationAPI.getImageAnnotations(image.id);
      setAnnotations(annotations);
      
      // Extract unique labels from annotations
      const uniqueLabels = [...new Set(annotations.map(ann => ann.class_name || ann.label))]
        .filter(labelName => labelName) // Remove null/undefined labels
        .map(labelName => {
          const existingLabel = projectLabels.find(l => l.name === labelName);
          return existingLabel || {
            id: labelName,
            name: labelName,
            color: AnnotationAPI.generateLabelColor(labelName),
            count: annotations.filter(ann => (ann.class_name || ann.label) === labelName).length
          };
        });
      setImageLabels(uniqueLabels);
      
    } catch (error) {
      message.error('Failed to load image data');
      console.error('Load image data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToolChange = useCallback((tool) => {
    setActiveTool(tool);
    setSelectedAnnotation(null);
  }, []);

  const handleShapeComplete = useCallback((shape) => {
    console.log('🎯 handleShapeComplete called with shape:', shape);
    console.log('🎯 Setting pending shape and showing label popup');
    
    setPendingShape(shape);
    setLabelPopupPosition({ x: shape.x + shape.width / 2, y: shape.y });
    
    // Automatically show the label popup when shape is completed
    setShowLabelPopup(true);
    
    console.log('🎯 Shape completed:', shape);
    console.log('🎯 Label popup should be visible now');
    console.log('🎯 showLabelPopup state will be:', true);
  }, []);

  const handleLabelAssignment = useCallback(async (labelName) => {
    if (!pendingShape) {
      console.error('No pending shape to label');
      return;
    }

    if (!labelName || typeof labelName !== 'string') {
      console.error('Invalid label name:', labelName);
      throw new Error('Invalid label name');
    }

    console.log('Assigning label:', labelName, 'to shape:', pendingShape);

    try {
      const zoomScale = zoomLevel / 100;
      const imageX = (pendingShape.x - imagePosition.x) / zoomScale;
      const imageY = (pendingShape.y - imagePosition.y) / zoomScale;
      const imageWidth = pendingShape.width / zoomScale;
      const imageHeight = pendingShape.height / zoomScale;
      const annotation = {
        image_id: imageData.id,
        class_name: labelName,
        label: labelName,
        confidence: 1.0,
        type: pendingShape.type || "box"
      };
      // Add diagnostic logging
      console.log('🔍 pendingShape:', pendingShape);
      console.log('🔍 pendingShape.points:', pendingShape.points);
      console.log('🔍 existingLabels:', imageLabels);
      console.log('🔍 labelName:', labelName);
      
      if (pendingShape.type === 'box') {
        annotation.x = imageX;
        annotation.y = imageY;
        annotation.width = imageWidth;
        annotation.height = imageHeight;
      } else if (
        pendingShape.type === 'polygon' && 
        pendingShape.points && 
        Array.isArray(pendingShape.points) && 
        pendingShape.points.length > 0 && 
        pendingShape.points.every(p => p && typeof p.x === 'number' && typeof p.y === 'number')
      ) {
        const imagePoints = pendingShape.points.map(p => ({
          x: (p.x - imagePosition.x) / zoomScale,
          y: (p.y - imagePosition.y) / zoomScale
        }));
        annotation.segmentation = imagePoints;
      }
      console.log('Saving annotation:', annotation);
      const response = await AnnotationAPI.saveAnnotation(annotation);
      console.log('Saved annotation response:', response);
      
      // Extract the annotation from the response
      const savedAnnotation = response.annotation || response;
      
      // Convert back to the format expected by the UI
      const uiAnnotation = {
        id: savedAnnotation.id,
        x: savedAnnotation.x_min,
        y: savedAnnotation.y_min,
        width: savedAnnotation.x_max - savedAnnotation.x_min,
        height: savedAnnotation.y_max - savedAnnotation.y_min,
        class_name: savedAnnotation.class_name || savedAnnotation.label,
        label: savedAnnotation.class_name || savedAnnotation.label,
        type: savedAnnotation.type,
        confidence: savedAnnotation.confidence,
        color: AnnotationAPI.generateLabelColor(savedAnnotation.class_name || savedAnnotation.label)
      };
      if (savedAnnotation.segmentation) {
        uiAnnotation.points = savedAnnotation.segmentation;
      }
      
      setAnnotations(prev => {
        const updated = [...prev, uiAnnotation];
        console.log('Updated annotations:', updated);
        return updated;
      });
      
      // Update image labels
      const existingLabel = imageLabels.find(l => l.name === labelName);
      if (existingLabel) {
        setImageLabels(prev => prev.map(l => 
          l.name === labelName ? { ...l, count: l.count + 1 } : l
        ));
      } else {
        const newLabel = {
          id: labelName,
          name: labelName,
          color: AnnotationAPI.generateLabelColor(labelName),
          count: 1
        };
        setImageLabels(prev => [...prev, newLabel]);
      }

      // Update dataset progress if this is the first annotation for this image
      if (!imageData.is_labeled) {
        setDatasetProgress(prev => ({
          ...prev,
          labeled: prev.labeled + 1,
          percentage: Math.round(((prev.labeled + 1) / prev.total) * 100)
        }));
        setImageData(prev => ({ ...prev, is_labeled: true }));
      }

      message.success(`Annotation saved with label "${labelName}"`);
    } catch (error) {
      message.error(`Failed to save annotation: ${error.message}`);
      console.error('Save annotation error:', error);
    } finally {
      setPendingShape(null);
      setShowLabelPopup(false);
    }
  }, [pendingShape, imageData, datasetId, imageLabels]);

  const handleAnnotationSelect = useCallback((annotation) => {
    setSelectedAnnotation(annotation);
    
    // If we're in select mode and clicked on an annotation, open label editor
    if (activeTool === 'select' && annotation) {
      setEditingAnnotation(annotation);
      setShowLabelPopup(true);
    }
  }, [activeTool]);

  const handleAnnotationDelete = useCallback(async (annotationId) => {
    try {
      await AnnotationAPI.deleteAnnotation(annotationId);
      setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
      setSelectedAnnotation(null);
      message.success('Annotation deleted');
      
      // Update label counts
      const deletedAnnotation = annotations.find(ann => ann.id === annotationId);
      if (deletedAnnotation) {
        setImageLabels(prev => prev.map(l => 
          l.name === deletedAnnotation.label ? { ...l, count: Math.max(0, l.count - 1) } : l
        ).filter(l => l.count > 0));
      }
    } catch (error) {
      message.error('Failed to delete annotation');
      console.error('Delete annotation error:', error);
    }
  }, [annotations]);

  const handleSplitChange = useCallback(async (newSplit) => {
    try {
      await AnnotationAPI.updateImageSplit(imageData.id, newSplit);
      setCurrentSplit(newSplit);
      setImageData(prev => ({ ...prev, split_type: newSplit }));
      message.success(`Image moved to ${newSplit} set`);
    } catch (error) {
      message.error('Failed to update split');
      console.error('Update split error:', error);
    }
  }, [imageData]);

  const navigateToImage = useCallback((direction) => {
    const newIndex = direction === 'next' ? 
      Math.min(currentImageIndex + 1, imageList.length - 1) :
      Math.max(currentImageIndex - 1, 0);
    
    if (newIndex !== currentImageIndex) {
      setCurrentImageIndex(newIndex);
      const newImage = imageList[newIndex];
      navigate(`/annotate/${datasetId}/manual?imageId=${newImage.id}`);
    }
  }, [currentImageIndex, imageList, datasetId, navigate]);

  const handleBack = () => {
    // Go back to annotation progress page instead of projects
    navigate(`/annotate-progress/${datasetId}`);
  };

  if (loading && !imageData) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div>Loading...</div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ height: '100vh', background: '#001529', overflow: 'hidden' }}>
      {/* Top Header */}
      <div style={{
        background: '#001529',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        flexShrink: 0
      }}>
        {/* Left: Back button and navigation */}
        <Space size="large">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
            type="text"
            size="large"
            style={{ color: '#bdc3c7' }}
          >
            Back
          </Button>
          
          <Divider type="vertical" style={{ height: '32px' }} />
          
          <Space>
            <Text strong style={{ fontSize: '16px', color: '#bdc3c7' }}>
              {currentImageIndex + 1} / {imageList.length}
            </Text>
            <Space>
              <Button
                icon={<LeftOutlined />}
                onClick={() => navigateToImage('prev')}
                disabled={currentImageIndex === 0}
                size="small"
                type="text"
                style={{ color: '#bdc3c7', border: 'none' }}
              >
                Previous
              </Button>
              <Button
                icon={<RightOutlined />}
                onClick={() => navigateToImage('next')}
                disabled={currentImageIndex === imageList.length - 1}
                size="small"
                type="text"
                style={{ color: '#bdc3c7', border: 'none' }}
              >
                Next
              </Button>
            </Space>
          </Space>
        </Space>

        {/* Center: Image name */}
        <div style={{ textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0, color: '#bdc3c7' }}>
            {imageData?.filename || 'Loading...'}
          </Title>
        </div>

        {/* Right: Split control and progress */}
        <Space size="large">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <InfoCircleOutlined style={{ color: '#3498db' }} />
            <div>
              <Text style={{ fontSize: '12px', color: '#95a5a6' }}>Dataset Progress</Text>
              <Progress
                percent={datasetProgress.percentage}
                size="small"
                style={{ width: '120px', margin: 0 }}
                format={() => `${datasetProgress.labeled}/${datasetProgress.total}`}
              />
            </div>
          </div>
          
          <AnnotationSplitControl
            currentSplit={currentSplit}
            onSplitChange={handleSplitChange}
          />
        </Space>
      </div>

      <Layout style={{ background: '#001529', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Labels */}
        <Sider 
          width={220} 
          style={{ 
            background: '#001529',
            borderRight: '1px solid #002140',
            overflow: 'auto',
            height: '100%'
          }}
        >
          <LabelSidebar
            labels={imageLabels}
            selectedLabel={selectedLabel}
            onLabelSelect={setSelectedLabel}
            onLabelHighlight={(labelName) => {
              // Highlight annotations with this label
              console.log('Highlight label:', labelName);
            }}
          />
        </Sider>

        {/* Main Content - Canvas */}
        <Content style={{ 
          position: 'relative',
          background: '#1a1a1a',
          display: 'flex !important',
          justifyContent: 'center !important',
          alignItems: 'center !important',
          overflow: 'hidden',
          height: '100%',
          flex: 1,
          width: '100%',
          minWidth: 0
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative'
          }}>
            {imageUrl && (
              <AnnotationCanvas
                imageUrl={imageUrl}
                imageId={imageData?.id}
                annotations={annotations}
                selectedAnnotation={selectedAnnotation}
                activeTool={activeTool}
                zoomLevel={zoomLevel}
                onShapeComplete={handleShapeComplete}
                onAnnotationSelect={handleAnnotationSelect}
                onAnnotationDelete={handleAnnotationDelete}
                onImagePositionChange={setImagePosition}
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            )}
          </div>
        </Content>

        {/* Right Sidebar - Tools */}
        <Sider 
          width={60} 
          style={{ 
            background: '#001529',
            borderLeft: '1px solid #002140',
            padding: '8px 0',
            height: '100%'
          }}
        >
          <AnnotationToolbox
            activeTool={activeTool}
            onToolChange={handleToolChange}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onUndo={() => console.log('Undo')}
            onRedo={() => console.log('Redo')}
            onClear={() => console.log('Clear')}
            onSave={() => console.log('Save')}
            canUndo={false}
            canRedo={false}
          />
        </Sider>
      </Layout>

      {/* Label Selection Popup */}
      <LabelSelectionPopup
        visible={showLabelPopup}
        onCancel={() => {
          setShowLabelPopup(false);
          setPendingShape(null);
        }}
        onConfirm={handleLabelAssignment}
        existingLabels={imageLabels}
        shapeType={pendingShape?.type || 'box'}
      />
    </Layout>
  );
};

export default ManualLabeling;