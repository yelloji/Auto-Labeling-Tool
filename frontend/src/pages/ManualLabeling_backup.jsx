import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Layout, 
  Button, 
  Typography, 
  Tooltip, 
  message,
  Space,
  Progress,
  Card
} from 'antd';
import {
  ArrowLeftOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

// Import our new annotation components
import AnnotationCanvas from '../components/AnnotationToolset/AnnotationCanvas';
import AnnotationToolbox from '../components/AnnotationToolset/AnnotationToolbox';
import LabelSelectionPopup from '../components/AnnotationToolset/LabelSelectionPopup';
import LabelSidebar from '../components/AnnotationToolset/LabelSidebar';
import AnnotationAPI from '../components/AnnotationToolset/AnnotationAPI';

const { Content } = Layout;
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
  
  // Annotation state
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [activeTool, setActiveTool] = useState('box');
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // Label management
  const [imageLabels, setImageLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [hiddenLabels, setHiddenLabels] = useState([]);
  const [highlightedLabel, setHighlightedLabel] = useState(null);
  
  // UI state
  const [showLabelPopup, setShowLabelPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load image list
  useEffect(() => {
    const loadImageList = async () => {
      try {
        const response = await fetch(`/api/v1/datasets/${datasetId}/images?skip=0&limit=1000`);
        const data = await response.json();
        setImageList(data.images);
        
        // Find current image index
        const currentIndex = data.images.findIndex(img => img.id === imageId);
        setCurrentImageIndex(currentIndex >= 0 ? currentIndex : 0);
      } catch (error) {
        console.error('Error loading image list:', error);
        message.error('Failed to load image list');
      }
    };

    if (datasetId) {
      loadImageList();
    }
  }, [datasetId, imageId]);

  // Load image and annotations
  useEffect(() => {
    const loadImageAndAnnotations = async () => {
      if (!datasetId || !imageId) return;

      try {
        // Load image data
        const response = await fetch(`/api/v1/datasets/images/${imageId}`);
        const data = await response.json();
        setImageData(data);
        
        // Set image URL
        const imageSrc = data.file_path || `/api/v1/datasets/${datasetId}/images/${imageId}/file`;
        setImageUrl(imageSrc);
        
        // Load annotations for this image
        await loadAnnotations();
        
      } catch (error) {
        console.error('Error loading image:', error);
        message.error('Failed to load image');
      }
    };

    loadImageAndAnnotations();
  }, [datasetId, imageId]);

  // Load annotations function
  const loadAnnotations = async () => {
    if (!imageId) return;
    
    try {
      const existingAnnotations = await AnnotationAPI.getImageAnnotations(imageId);
      
      // Convert API format to internal format
      const convertedAnnotations = existingAnnotations.map((ann, index) => ({
        id: ann.id || `annotation_${index}`,
        type: ann.type || 'box',
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        coordinates: ann.coordinates,
        label_id: ann.label_id,
        color: AnnotationAPI.generateLabelColor(ann.label_id),
        image_id: imageId
      }));
      
      setAnnotations(convertedAnnotations);
      
      // Update image labels based on annotations
      const labels = AnnotationAPI.getImageLabels(convertedAnnotations);
      setImageLabels(labels);
      
      // Reset history
      setHistory([convertedAnnotations]);
      setHistoryIndex(0);
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error('Error loading annotations:', error);
      setAnnotations([]);
      setImageLabels([]);
    }
  };

  // Navigation functions
  const handlePreviousImage = () => {
    if (currentImageIndex > 0 && imageList.length > 0) {
      const prevImage = imageList[currentImageIndex - 1];
      navigate(`/annotate/${datasetId}/manual?imageId=${prevImage.id}`);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < imageList.length - 1 && imageList.length > 0) {
      const nextImage = imageList[currentImageIndex + 1];
      navigate(`/annotate/${datasetId}/manual?imageId=${nextImage.id}`);
    }
  };

  // History management
  const addToHistory = (newAnnotations) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newAnnotations]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedChanges(true);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations([...history[historyIndex - 1]]);
      const labels = AnnotationAPI.getImageLabels(history[historyIndex - 1]);
      setImageLabels(labels);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations([...history[historyIndex + 1]]);
      const labels = AnnotationAPI.getImageLabels(history[historyIndex + 1]);
      setImageLabels(labels);
    }
  };

  // Annotation event handlers
  const handleAnnotationCreate = async (shape) => {
    if (!AnnotationAPI.validateAnnotation({ ...shape, image_id: imageId, label_id: 'temp' })) {
      message.error('Invalid annotation shape');
      return;
    }

    setPendingShape(shape);
    setShowLabelPopup(true);
  };

  const handleLabelConfirm = async (labelId) => {
    if (!pendingShape) return;

    try {
      const annotationData = {
        ...pendingShape,
        image_id: imageId,
        label_id: labelId,
        color: AnnotationAPI.generateLabelColor(labelId)
      };

      // Save to backend
      const savedAnnotation = await AnnotationAPI.createAnnotation(annotationData);
      
      // Add to local state
      const newAnnotations = [...annotations, { ...annotationData, id: savedAnnotation.id }];
      setAnnotations(newAnnotations);
      
      // Update history
      addToHistory(newAnnotations);
      
      // Update labels
      const labels = AnnotationAPI.getImageLabels(newAnnotations);
      setImageLabels(labels);
      
      setHasUnsavedChanges(false);
      setShowLabelPopup(false);
      setPendingShape(null);
      
    } catch (error) {
      console.error('Error saving annotation:', error);
      message.error('Failed to save annotation');
    }
  };

  const handleAnnotationSelect = (annotation) => {
    setSelectedAnnotation(annotation);
  };

  const handleAnnotationUpdate = async (annotationId, updates) => {
    try {
      await AnnotationAPI.updateAnnotation(annotationId, updates);
      
      const newAnnotations = annotations.map(ann => 
        ann.id === annotationId ? { ...ann, ...updates } : ann
      );
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
      
      const labels = AnnotationAPI.getImageLabels(newAnnotations);
      setImageLabels(labels);
      
    } catch (error) {
      console.error('Error updating annotation:', error);
      message.error('Failed to update annotation');
    }
  };

  const handleAnnotationDelete = async (annotationId) => {
    if (!annotationId) {
      // Delete selected annotation
      if (selectedAnnotation) {
        annotationId = selectedAnnotation.id;
      } else {
        message.warning('No annotation selected');
        return;
      }
    }

    try {
      await AnnotationAPI.deleteAnnotation(annotationId);
      
      const newAnnotations = annotations.filter(ann => ann.id !== annotationId);
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
      
      const labels = AnnotationAPI.getImageLabels(newAnnotations);
      setImageLabels(labels);
      
      setSelectedAnnotation(null);
      
    } catch (error) {
      console.error('Error deleting annotation:', error);
      message.error('Failed to delete annotation');
    }
  };

  // Tool handlers
  const handleToolChange = (tool) => {
    setActiveTool(tool);
    setSelectedAnnotation(null);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 500));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 10));
  };

  const handleFitToScreen = () => {
    setZoomLevel(100);
  };

  const handleResetView = () => {
    setZoomLevel(100);
  };

  // Label handlers
  const handleLabelClick = (labelId) => {
    setSelectedLabel(selectedLabel === labelId ? null : labelId);
    setHighlightedLabel(selectedLabel === labelId ? null : labelId);
  };

  const handleLabelVisibilityToggle = (labelId) => {
    setHiddenLabels(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleHighlightLabel = (labelId, highlight) => {
    setHighlightedLabel(highlight ? labelId : null);
  };

  // Clear all annotations
  const handleClear = () => {
    if (annotations.length === 0) return;
    
    const newAnnotations = [];
    setAnnotations(newAnnotations);
    addToHistory(newAnnotations);
    setImageLabels([]);
    setSelectedAnnotation(null);
  };

  // Save all annotations
  const handleSave = async () => {
    setSaving(true);
    try {
      // All annotations are already saved individually
      // This is just for manual save trigger
      setHasUnsavedChanges(false);
      message.success('All annotations saved');
    } catch (error) {
      message.error('Failed to save annotations');
    } finally {
      setSaving(false);
    }
  };

  // Calculate progress
  const totalImages = imageList.length;
  const labeledImages = imageList.filter(img => img.is_labeled).length;
  const progressPercent = totalImages > 0 ? Math.round((labeledImages / totalImages) * 100) : 0;

  return (
    <div style={{ height: '100vh', background: '#f5f5f5' }}>
      {/* Top Navigation */}
      <div style={{
        height: '64px',
        background: 'white',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Tooltip title="Back to Progress">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate(`/annotate-progress/${datasetId}`)}
              size="large"
              style={{ 
                borderRadius: '8px',
                height: '40px',
                paddingLeft: '16px',
                paddingRight: '20px'
              }}
            >
              Back
            </Button>
          </Tooltip>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Text strong style={{ fontSize: '16px', color: '#262626' }}>
              {imageList.length > 0 ? `${currentImageIndex + 1} / ${imageList.length}` : '1 / 3'}
            </Text>
            
            <Space>
              <Button 
                disabled={currentImageIndex <= 0 || imageList.length === 0}
                onClick={handlePreviousImage}
                style={{ borderRadius: '6px' }}
              >
                ← Previous
              </Button>
              <Button 
                disabled={currentImageIndex >= imageList.length - 1 || imageList.length === 0}
                onClick={handleNextImage}
                style={{ borderRadius: '6px' }}
              >
                Next →
              </Button>
            </Space>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Text strong style={{ fontSize: '16px' }}>
            {imageData?.filename || 'Loading...'}
          </Text>
          
          <Card size="small" style={{ minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>Dataset Progress</div>
                <Progress 
                  percent={progressPercent} 
                  size="small" 
                  status={progressPercent === 100 ? 'success' : 'active'}
                  format={() => `${labeledImages}/${totalImages}`}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Layout */}
      <Layout style={{ marginTop: '64px', height: 'calc(100vh - 64px)' }}>
        {/* Left Sidebar - Labels */}
        <div style={{
          position: 'fixed',
          left: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 999
        }}>
          <LabelSidebar
            labels={imageLabels}
            selectedLabel={selectedLabel}
            hiddenLabels={hiddenLabels}
            onLabelClick={handleLabelClick}
            onLabelVisibilityToggle={handleLabelVisibilityToggle}
            onHighlightLabel={handleHighlightLabel}
          />
        </div>

        {/* Center - Canvas Area */}
        <Content style={{ 
          position: 'relative', 
          background: '#2a2a2a',
          margin: '0 16px',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <AnnotationCanvas
            imageUrl={imageUrl}
            annotations={annotations}
            activeTool={activeTool}
            selectedAnnotation={selectedAnnotation}
            hiddenLabels={hiddenLabels}
            highlightedLabel={highlightedLabel}
            onAnnotationCreate={handleAnnotationCreate}
            onAnnotationSelect={handleAnnotationSelect}
            onAnnotationUpdate={handleAnnotationUpdate}
            onAnnotationDelete={handleAnnotationDelete}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Right Sidebar - Tools */}
          <AnnotationToolbox
            activeTool={activeTool}
            onToolChange={handleToolChange}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            canDelete={selectedAnnotation !== null}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDelete={() => handleAnnotationDelete()}
            onClear={handleClear}
            onSave={handleSave}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            onResetView={handleResetView}
            zoomLevel={Math.round(zoomLevel)}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </Content>
      </Layout>

      {/* Label Selection Popup */}
      <LabelSelectionPopup
        visible={showLabelPopup}
        onCancel={() => {
          setShowLabelPopup(false);
          setPendingShape(null);
        }}
        onConfirm={handleLabelConfirm}
        existingLabels={imageLabels}
        shapeType={pendingShape?.type || 'box'}
      />
    </div>
  );
};

export default ManualLabeling;