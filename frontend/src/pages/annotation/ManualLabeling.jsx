import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Button,
  Typography,
  message,
  Space,
  Modal,
  Progress,
  Divider,
  Tooltip,
  Select,
  Input,
  Tag,
  Alert,
  Empty,
  Radio
} from 'antd';
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
  CopyOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

// Import our annotation components
import AnnotationCanvas from '../../components/AnnotationToolset/AnnotationCanvas';
import AnnotationToolbox from '../../components/AnnotationToolset/AnnotationToolbox';
import LabelSelectionPopup from '../../components/AnnotationToolset/LabelSelectionPopup';
import LabelSidebar from '../../components/AnnotationToolset/LabelSidebar';
import AnnotationSplitControl from '../../components/AnnotationToolset/AnnotationSplitControl';
import AnnotationAPI from '../../components/AnnotationToolset/AnnotationAPI';

// API base URL
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:12000/api/v1';

const { Content, Sider } = Layout;
const { Text, Title } = Typography;
const { Option } = Select;
const PREVIEW_COPY_PREFIX = 'copy-preview-';
const PREDICTION_EXPERIMENT_TYPES = ['prediction', 'sahi_prediction'];

const getImageDisplayUrl = (image) => {
  if (!image) return '';
  const baseUrl = API_BASE.replace('/api/v1', '');
  const path = image.thumbnail_url || image.url || image.file_path;
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const ManualLabeling = () => {
  const { datasetId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const imageId = searchParams.get('imageId');
  const navigate = useNavigate();
  const returnToStorageKey = `manual_labeling_return_to_${datasetId}`;
  const currentReturnTo = location.state?.returnTo || null;

  useEffect(() => {
    if (location.state?.returnTo) {
      sessionStorage.setItem(returnToStorageKey, location.state.returnTo);
    } else {
      sessionStorage.removeItem(returnToStorageKey);
    }
  }, [location.state, returnToStorageKey]);

  // Core state
  const [imageList, setImageList] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Image deletion handler
  const handleDeleteImage = useCallback(async () => {
    if (!imageData || !imageData.id) {
      console.error('No image data available for deletion');
      return;
    }
    const confirmed = window.confirm('Are you sure you want to delete this image? This action cannot be undone.');
    if (!confirmed) return;
    try {
      console.log('Deleting image with ID:', imageData.id);
      await AnnotationAPI.deleteImage(imageData.id);
      message.success('Image deleted successfully');

      // Trigger dataset refresh across all components
      window.dispatchEvent(new CustomEvent('datasetChanged', {
        detail: { projectId: datasetId, action: 'imageDeleted' }
      }));

      const newImageList = imageList.filter(img => img.id !== imageData.id);
      setImageList(newImageList);
      if (newImageList.length === 0) {
        navigate(`/annotate/${datasetId}/manual`, currentReturnTo ? { state: { returnTo: currentReturnTo } } : undefined);
        return;
      }
      const newIndex = Math.max(0, currentImageIndex - (currentImageIndex === newImageList.length ? 1 : 0));
      setCurrentImageIndex(newIndex);
      const newImage = newImageList[newIndex];
      navigate(
        `/annotate/${datasetId}/manual?imageId=${newImage.id}`,
        currentReturnTo ? { state: { returnTo: currentReturnTo } } : undefined
      );
    } catch (error) {
      message.error('Failed to delete image');
      console.error('Delete image error:', error);
    }
  }, [imageData, imageList, currentImageIndex, navigate, datasetId, currentReturnTo]);

  // Mark as Null handler
  const handleMarkAsNull = async () => {
    if (!imageData || !imageData.id) return;

    // Check if null marker already exists (using full annotations, not filtered)
    const allAnnotations = await AnnotationAPI.getImageAnnotations(imageData.id);
    const existingNullMarker = allAnnotations.find(ann =>
      (ann.class_name || ann.label || '').toLowerCase() === 'null'
    );

    // TOGGLE: If null marker exists, remove it (undo)
    if (existingNullMarker) {
      try {
        logInfo('app.frontend.interactions', 'remove_null_started', 'Removing null marking', {
          datasetId,
          imageId: imageData.id,
          nullAnnotationId: existingNullMarker.id
        });

        // Delete the null marker from database
        await AnnotationAPI.deleteAnnotation(existingNullMarker.id);

        // Sync everything: update memory list and re-load current image
        const updatedImage = { ...imageData, is_labeled: false };
        setImageList(prev => prev.map(img => img.id === imageData.id ? updatedImage : img));
        setDatasetProgress(prev => ({
          ...prev,
          labeled: Math.max(0, prev.labeled - 1),
          percentage: prev.total > 0 ? Math.round((Math.max(0, prev.labeled - 1) / prev.total) * 100) : 0
        }));

        await loadImageData(updatedImage);
        message.success('Null marking removed');

        logInfo('app.frontend.interactions', 'remove_null_success', 'Null marking removed successfully', {
          datasetId,
          imageId: imageData.id
        });

      } catch (error) {
        logError('app.frontend.interactions', 'remove_null_failed', 'Failed to remove null marking', error);
        message.error('Failed to remove null marking');
      }
      return;
    }

    // SAFETY: Block if regular annotations exist - null button has no deletion rights
    if (annotations.length > 0) {
      message.error('Please remove all existing annotations first');
      return;
    }

    // CREATE: Add null marker for clean image
    try {
      logInfo('app.frontend.interactions', 'mark_as_null_started', 'Marking image as Null', {
        datasetId,
        imageId: imageData.id
      });

      // Create a specialized 'null' annotation marker (degenerate bbox)
      // This marks is_labeled=true and results in empty export file
      // Includes segmentation=[] for compatibility with both box and polygon exports
      const createdAnnotation = await AnnotationAPI.createAnnotation({
        image_id: imageData.id,
        type: 'box',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        class_name: 'null',
        segmentation: []
      });

      // Sync everything: update memory list and re-load current image
      const updatedImage = { ...imageData, is_labeled: true };
      setImageList(prev => prev.map(img => img.id === imageData.id ? updatedImage : img));

      if (!imageData.is_labeled) {
        setDatasetProgress(prev => ({
          ...prev,
          labeled: prev.labeled + 1,
          percentage: prev.total > 0 ? Math.round(((prev.labeled + 1) / prev.total) * 100) : 0
        }));
      }

      await loadImageData(updatedImage);
      setActiveTool('select');
      message.success('Image marked as Background (Null)');

    } catch (error) {
      logError('app.frontend.interactions', 'mark_as_null_failed', 'Failed to mark as Null', error);
      message.error('Failed to mark image as Null');
    }
  };

  // Annotation state
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [shapeEditAnnotation, setShapeEditAnnotation] = useState(null);
  const [shapeEditOriginal, setShapeEditOriginal] = useState(null);
  const [shapeEditSaving, setShapeEditSaving] = useState(false);
  const [pendingShape, setPendingShape] = useState(null);
  const [activeTool, setActiveTool] = useState('box');
  const [zoomLevel, setZoomLevel] = useState(50);

  // History stacks for Undo/Redo (local only)
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  // Per-image history storage to preserve undo/redo across image switches
  const [imageHistoryMap, setImageHistoryMap] = useState(new Map());
  const pushHistory = useCallback((prevSnapshot) => {
    console.log('📚 pushHistory called with snapshot:', prevSnapshot?.length || 0, 'annotations');
    setHistoryPast((p) => {
      const newPast = [...p, prevSnapshot];
      // Limit history to maximum 5 actions
      const limitedPast = newPast.length > 5 ? newPast.slice(-5) : newPast;
      console.log('📚 History past updated. New length:', limitedPast.length, '(limited to 5)');
      return limitedPast;
    });
    setHistoryFuture([]);
    console.log('📚 History future cleared');
  }, []);
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  // Debug: Log history state changes
  useEffect(() => {
    console.log('📊 History state updated:', {
      canUndo,
      canRedo,
      historyPastLength: historyPast.length,
      historyFutureLength: historyFuture.length,
      annotationsLength: annotations.length
    });
  }, [canUndo, canRedo, historyPast.length, historyFuture.length, annotations.length]);

  // Label management
  const [projectLabels, setProjectLabels] = useState([]);
  const [imageLabels, setImageLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [hiddenLabels, setHiddenLabels] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  const findProjectLabelByName = useCallback((labelName) => {
    if (!labelName) return null;
    const normalizedName = labelName.toLowerCase();
    return projectLabels.find(label => (label.name || '').toLowerCase() === normalizedName) || null;
  }, [projectLabels]);

  const resolveLabelColor = useCallback((labelName, fallbackColor = null) => {
    const existingProjectLabel = findProjectLabelByName(labelName);
    return existingProjectLabel?.color || fallbackColor || AnnotationAPI.generateLabelColor(labelName);
  }, [findProjectLabelByName]);

  const isLabelHidden = useCallback((labelName) => {
    if (!labelName) return false;
    const existingProjectLabel = findProjectLabelByName(labelName);
    return hiddenLabels.includes(existingProjectLabel?.id) || hiddenLabels.includes(labelName);
  }, [findProjectLabelByName, hiddenLabels]);

  const toggleLabelVisibility = useCallback((labelId) => {
    const targetLabel = projectLabels.find(label => label.id === labelId);
    const targetLabelName = targetLabel?.name || labelId;
    const selectedLabelName = selectedAnnotation?.class_name || selectedAnnotation?.label;
    const isCurrentlyHidden = hiddenLabels.includes(labelId);

    if (!isCurrentlyHidden && selectedLabelName && selectedLabelName.toLowerCase() === String(targetLabelName).toLowerCase()) {
      setSelectedAnnotation(null);
      setEditingAnnotation(null);
      setShowLabelPopup(false);
    }

    setHiddenLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  }, [projectLabels, selectedAnnotation, hiddenLabels]);

  // UI state
  const [showLabelPopup, setShowLabelPopup] = useState(false);
  const [labelPopupPosition, setLabelPopupPosition] = useState({ x: 0, y: 0 });
  const [currentSplit, setCurrentSplit] = useState('train');
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyDatasets, setCopyDatasets] = useState([]);
  const [copySourceDatasetId, setCopySourceDatasetId] = useState(null);
  const [copySourceImages, setCopySourceImages] = useState([]);
  const [copySearchText, setCopySearchText] = useState('');
  const [copySelectedImage, setCopySelectedImage] = useState(null);
  const [copyPreviewAnnotations, setCopyPreviewAnnotations] = useState([]);
  const [copySourceMode, setCopySourceMode] = useState('image');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyApplying, setCopyApplying] = useState(false);
  const [predictionImportTrainings, setPredictionImportTrainings] = useState([]);
  const [predictionImportTrainingId, setPredictionImportTrainingId] = useState(null);
  const [predictionImportExperiments, setPredictionImportExperiments] = useState([]);
  const [predictionImportExperimentId, setPredictionImportExperimentId] = useState(null);
  const [predictionImportScope, setPredictionImportScope] = useState('current');
  const [predictionImportConflictMode, setPredictionImportConflictMode] = useState('skip');
  const [predictionImportPreview, setPredictionImportPreview] = useState(null);
  const [predictionImportLoading, setPredictionImportLoading] = useState(false);
  const [predictionImportApplying, setPredictionImportApplying] = useState(false);

  // Dataset progress
  const [datasetProgress, setDatasetProgress] = useState({
    total: 0,
    labeled: 0,
    percentage: 0
  });

  const visibleAnnotations = annotations.filter(ann => {
    const labelName = ann.class_name || ann.label || '';
    return labelName.toLowerCase() !== 'null' && !isLabelHidden(labelName);
  });
  const visibleAnnotationsForCanvas = shapeEditAnnotation
    ? visibleAnnotations.map(ann => ann.id === shapeEditAnnotation.id ? shapeEditAnnotation : ann)
    : visibleAnnotations;
  const canvasAnnotations = [...visibleAnnotationsForCanvas, ...copyPreviewAnnotations];
  const filteredCopySourceImages = copySourceImages.filter(img => {
    const search = copySearchText.trim().toLowerCase();
    if (!search) return true;
    return `${img.filename || ''} ${img.original_filename || ''}`.toLowerCase().includes(search);
  });
  const selectedCopySizeMatches = !!(
    imageData &&
    copySelectedImage &&
    Number(imageData.width) === Number(copySelectedImage.width) &&
    Number(imageData.height) === Number(copySelectedImage.height)
  );
  const isTargetMarkedNull = annotations.some(ann =>
    (ann.class_name || ann.label || '').toLowerCase() === 'null'
  );

  // State to track polygon drawing
  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);
  const [polygonPointsCount, setPolygonPointsCount] = useState(0);

  useEffect(() => {
    const detail = {
      activeTool,
      showLabelPopup,
      selectedAnnotationId: selectedAnnotation?.id || null,
      annotationCount: annotations.length,
      currentImageIndex,
      isNullMarked: annotations.some(ann => (ann.class_name || ann.label || '').toLowerCase() === 'null'),
      isPolygonDrawing,
      polygonPointsCount,
    };

    window.__manualLabelingGuideState = detail;
    window.dispatchEvent(new CustomEvent('manualLabelingStateChanged', { detail }));
  }, [activeTool, showLabelPopup, selectedAnnotation, annotations, currentImageIndex, isPolygonDrawing, polygonPointsCount]);

  // Load initial data
  useEffect(() => {
    if (datasetId) {
      logInfo('app.frontend.navigation', 'manual_labeling_page_loaded', 'ManualLabeling page loaded', {
        datasetId,
        imageId,
        timestamp: new Date().toISOString()
      });
      console.log('Loading initial data for dataset:', datasetId);
      // Clean up orphaned labels on app start using the direct endpoint
      const cleanupOrphanedLabels = async () => {
        try {
          logInfo('app.frontend.interactions', 'cleanup_orphaned_labels_started', 'Cleaning up orphaned labels', {
            datasetId,
            timestamp: new Date().toISOString()
          });
          console.log('Cleaning up orphaned labels on app start');
          console.log(`DELETE ${API_BASE}/fix-labels`);
          const response = await axios.delete(`${API_BASE}/fix-labels`);
          console.log('Cleanup response:', response.data);
          logInfo('app.frontend.interactions', 'cleanup_orphaned_labels_success', 'Orphaned labels cleanup completed', {
            datasetId,
            responseData: response.data,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logError('app.frontend.validation', 'cleanup_orphaned_labels_failed', 'Failed to cleanup orphaned labels', error, {
            datasetId,
            errorMessage: error.message,
            timestamp: new Date().toISOString()
          });
          console.error('Error cleaning up orphaned labels:', error);
          console.error('Error details:', error.response?.data || error.message);
        }
      };

      cleanupOrphanedLabels();

      // Load dataset images and project labels
      logInfo('app.frontend.interactions', 'loading_initial_data', 'Loading initial dataset data', {
        datasetId,
        timestamp: new Date().toISOString()
      });
      loadDatasetImages();
      loadProjectLabels(true); // Force refresh labels

      // Set up periodic refresh of project labels
      const labelsRefreshInterval = setInterval(() => {
        logInfo('app.frontend.ui', 'periodic_labels_refresh', 'Refreshing project labels (periodic)', {
          datasetId,
          timestamp: new Date().toISOString()
        });
        console.log('Refreshing project labels (periodic)');
        loadProjectLabels();
      }, 5000); // Refresh every 5 seconds

      return () => {
        clearInterval(labelsRefreshInterval);
      };
    }
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

  // Load current image data with per-image history management
  useEffect(() => {
    if (imageList.length > 0 && currentImageIndex >= 0) {
      const currentImageId = imageList[currentImageIndex]?.id;

      // Save current image's history before switching
      if (imageData?.id && imageData.id !== currentImageId) {
        setImageHistoryMap(prev => {
          const newMap = new Map(prev);
          newMap.set(imageData.id, {
            past: historyPast,
            future: historyFuture
          });
          return newMap;
        });
      }

      // Load new image data
      loadImageData(imageList[currentImageIndex]);

      // Restore history for the new image
      if (currentImageId) {
        const savedHistory = imageHistoryMap.get(currentImageId);
        if (savedHistory) {
          setHistoryPast(savedHistory.past || []);
          setHistoryFuture(savedHistory.future || []);
        }
        // Note: Don't clear history for new images - let it accumulate naturally
      }
    }
  }, [currentImageIndex, imageList, imageData?.id, historyPast, historyFuture, imageHistoryMap]);

  // Database synchronization function for undo/redo
  const syncAnnotationsWithDatabase = useCallback(async (targetAnnotations, currentAnnotations) => {
    try {
      console.log('🔄 Syncing annotations with database...');
      console.log('Current annotations:', currentAnnotations.length);
      console.log('Target annotations:', targetAnnotations.length);

      // Filter out annotations without valid database IDs for comparison
      const currentWithIds = currentAnnotations.filter(ann => ann.id && typeof ann.id === 'string' && ann.id.length > 0);
      const targetWithIds = targetAnnotations.filter(ann => ann.id && typeof ann.id === 'string' && ann.id.length > 0);

      console.log('Current annotations with valid IDs:', currentWithIds.length);
      console.log('Target annotations with valid IDs:', targetWithIds.length);

      // Create maps for easier comparison using only annotations with valid IDs
      const currentMap = new Map(currentWithIds.map(ann => [ann.id, ann]));
      const targetMap = new Map(targetWithIds.map(ann => [ann.id, ann]));

      // Find annotations to delete (in current but not in target)
      const toDelete = currentWithIds.filter(ann => !targetMap.has(ann.id));

      // Find annotations to create (in target but not in current)
      // Only try to create annotations that don't already exist in the database
      const toCreate = targetWithIds.filter(ann => !currentMap.has(ann.id));

      // Find annotations to update (in both but different)
      const toUpdate = targetWithIds.filter(ann => {
        const current = currentMap.get(ann.id);
        return current && JSON.stringify(current) !== JSON.stringify(ann);
      });

      console.log(`Database sync plan: Delete ${toDelete.length}, Create ${toCreate.length}, Update ${toUpdate.length}`);

      // Execute deletions
      for (const annotation of toDelete) {
        try {
          await AnnotationAPI.deleteAnnotation(annotation.id);
          console.log('✅ Deleted annotation:', annotation.id);
        } catch (error) {
          console.error('❌ Failed to delete annotation:', annotation.id, error);
        }
      }

      // Execute creations - but only for annotations that truly don't exist
      for (const annotation of toCreate) {
        try {
          // Double-check: fetch current annotations from database to avoid duplicates
          const currentDbAnnotations = await AnnotationAPI.getImageAnnotations(imageData.id);
          const existsInDb = currentDbAnnotations.some(dbAnn => dbAnn.id === annotation.id);

          if (!existsInDb) {
            // Ensure the annotation has the correct image_id
            const annotationToCreate = {
              ...annotation,
              image_id: imageData.id
            };
            await AnnotationAPI.createAnnotation(annotationToCreate);
            console.log('✅ Created annotation:', annotation.id);
          } else {
            console.log('⚠️ Skipped creating annotation (already exists in DB):', annotation.id);
          }
        } catch (error) {
          console.error('❌ Failed to create annotation:', annotation.id, error);
        }
      }

      // Execute updates
      for (const annotation of toUpdate) {
        try {
          await AnnotationAPI.updateAnnotation(annotation.id, annotation);
          console.log('✅ Updated annotation:', annotation.id);
        } catch (error) {
          console.error('❌ Failed to update annotation:', annotation.id, error);
        }
      }

      console.log('✅ Database synchronization completed');
    } catch (error) {
      console.error('❌ Database synchronization failed:', error);
      throw error;
    }
  }, [imageData]);

  // Intelligent undo handler - point-by-point during polygon drawing, annotation-level otherwise
  const handleUndo = useCallback(async () => {
    console.log('🔄 ManualLabeling handleUndo called! canUndo:', canUndo, 'historyPast length:', historyPast.length);
    console.log('🎯 Polygon state:', { isPolygonDrawing, polygonPointsCount });

    // If polygon is being drawn and has points, let AnnotationCanvas handle point-by-point undo
    if (isPolygonDrawing && polygonPointsCount > 0) {
      console.log('🎯 Polygon is being drawn - letting AnnotationCanvas handle point-by-point undo via Backspace');
      // The AnnotationCanvas component handles point removal via Backspace key
      // We don't interfere with polygon drawing here
      return;
    }

    // Standard annotation-level undo
    if (!canUndo) {
      console.log('❌ Cannot undo - canUndo is false');
      return;
    }

    try {
      const past = [...historyPast];
      const last = past.pop();
      console.log('✅ Undoing to previous state:', last);

      // Sync with database FIRST, then update UI state
      try {
        await syncAnnotationsWithDatabase(last || [], annotations);
        console.log('✅ Database sync completed for undo');

        // Only update UI state after successful database sync
        setHistoryPast(past);
        setHistoryFuture((f) => [annotations, ...f]);
        setAnnotations(last || []);
        setSelectedAnnotation(null);
      } catch (error) {
        console.error('❌ Failed to sync undo with database:', error);
        message.error('Failed to sync undo operation with database');
        throw error;
      }
    } catch (error) {
      console.error('❌ Undo operation failed:', error);
      message.error('Undo operation failed');
    }
  }, [canUndo, annotations, historyPast, syncAnnotationsWithDatabase, isPolygonDrawing, polygonPointsCount]);

  // Redo handler with database synchronization
  const handleRedo = useCallback(async () => {
    console.log('🔄 ManualLabeling handleRedo called! canRedo:', canRedo, 'historyFuture length:', historyFuture.length);
    if (!canRedo) {
      console.log('❌ Cannot redo - canRedo is false');
      return;
    }

    try {
      const future = [...historyFuture];
      const next = future.shift();
      if (next) {
        console.log('✅ Redoing to next state:', next);

        // Sync with database FIRST, then update UI state
        try {
          await syncAnnotationsWithDatabase(next, annotations);
          console.log('✅ Database sync completed for redo');

          // Only update UI state after successful database sync
          setHistoryPast((p) => [...p, annotations]);
          setHistoryFuture(future);
          setAnnotations(next);
          setSelectedAnnotation(null);
        } catch (error) {
          console.error('❌ Failed to sync redo with database:', error);
          message.error('Failed to sync redo operation with database');
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ Redo operation failed:', error);
      message.error('Redo operation failed');
    }
  }, [canRedo, annotations, historyFuture, syncAnnotationsWithDatabase]);

  // Callback to handle polygon state changes from AnnotationCanvas
  const handlePolygonStateChange = useCallback((isDrawing, pointsCount) => {
    setIsPolygonDrawing(isDrawing);
    setPolygonPointsCount(pointsCount || 0);
    console.log('🎯 Polygon state changed:', { isDrawing, pointsCount });
  }, []);

  // Handle polygon point removal (canvas-level undo)
  const handlePolygonPointRemoval = useCallback(() => {
    console.log('🔄 Canvas-level undo: removing last polygon point');
    // This will be handled by the AnnotationCanvas component
    // We'll pass this function to the canvas to trigger point removal
    return true; // Indicate that canvas should handle this
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Skip if event was already handled by canvas (e.g., polygon drawing)
      if (e.defaultPrevented) {
        return;
      }

      // Skip if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        return;
      }

      // Shift+Z for polygon point undo during polygon drawing
      if (e.shiftKey && e.key.toLowerCase() === 'z' && !e.ctrlKey && !e.altKey && isPolygonDrawing) {
        e.preventDefault();
        console.log('🎹 Shift+Z pressed - triggering polygon point undo');
        // Trigger backspace event to remove last polygon point
        const backspaceEvent = new KeyboardEvent('keydown', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(backspaceEvent);
        return;
      }

      // Shift+Y for polygon point redo during polygon drawing
      if (e.shiftKey && e.key.toLowerCase() === 'y' && !e.ctrlKey && !e.altKey && isPolygonDrawing) {
        e.preventDefault();
        console.log('🎹 Shift+Y pressed - polygon point redo');
        // Trigger Shift+Y event for AnnotationCanvas to handle
        const shiftYEvent = new KeyboardEvent('keydown', {
          key: 'Y',
          code: 'KeyY',
          shiftKey: true,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(shiftYEvent);
        return;
      }

      // Ctrl+Z for annotation-level undo (only when not drawing polygon)
      if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey && !isPolygonDrawing) {
        e.preventDefault();
        console.log('🎹 Ctrl+Z pressed - triggering annotation-level undo');
        handleUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z for annotation-level redo (only when not drawing polygon)
      if (((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) && !isPolygonDrawing) {
        e.preventDefault();
        console.log('🎹 Ctrl+Y/Ctrl+Shift+Z pressed - triggering annotation-level redo');
        handleRedo();
        return;
      }

      // L key for label popup
      if (e.key.toLowerCase() === 'l' && pendingShape && !showLabelPopup) {
        setShowLabelPopup(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pendingShape, showLabelPopup, handleUndo, handleRedo, isPolygonDrawing]);

  // Clear all annotations for current image
  const handleClearAll = useCallback(async () => {
    if (!annotations || annotations.length === 0) {
      message.info('No annotations to clear');
      return;
    }
    const confirmed = window.confirm('Clear all annotations on this image? This cannot be undone.');
    if (!confirmed) return;

    try {
      const snapshot = JSON.parse(JSON.stringify(annotations));
      pushHistory(snapshot);

      // Delete all annotations from database first
      let deletionErrors = 0;
      for (const ann of snapshot) {
        try {
          await AnnotationAPI.deleteAnnotation(ann.id);
          console.log('Successfully deleted annotation:', ann.id);
        } catch (e) {
          console.error('Failed to delete', ann.id, e);
          deletionErrors++;
        }
      }

      // Refresh annotations from database to ensure UI reflects actual state
      try {
        const refreshedAnnotations = await AnnotationAPI.getImageAnnotations(imageData.id);
        console.log('Refreshed annotations after clear all:', refreshedAnnotations);

        // Transform refreshed annotations for UI display
        const transformedAnnotations = refreshedAnnotations.map(ann => {
          let annotationType = ann.type || 'box';
          if (ann.segmentation && Array.isArray(ann.segmentation) && ann.segmentation.length > 2) {
            annotationType = 'polygon';
          }

          return {
            id: ann.id,
            type: annotationType,
            label: ann.class_name,
            confidence: ann.confidence || 1.0,
            x: ann.x_min,
            y: ann.y_min,
            width: ann.x_max - ann.x_min,
            height: ann.y_max - ann.y_min,
            points: ann.segmentation || ann.points || [],
            segmentation: ann.segmentation || ann.points || []
          };
        });

        setAnnotations(transformedAnnotations);
        setSelectedAnnotation(null);
        setEditingAnnotation(null);

        // Update image labels based on remaining annotations
        const labelCounts = {};
        transformedAnnotations.forEach(ann => {
          labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
        });

        const updatedImageLabels = Object.entries(labelCounts).map(([name, count]) => {
          const projectLabel = findProjectLabelByName(name);
          return {
            name,
            count,
            color: resolveLabelColor(name, projectLabel?.color)
          };
        });

        setImageLabels(updatedImageLabels);

        // Update dataset progress and image status
        const hasAnnotations = transformedAnnotations.length > 0;
        if (imageData?.is_labeled && !hasAnnotations) {
          setDatasetProgress(prev => ({
            ...prev,
            labeled: Math.max(0, prev.labeled - 1),
            percentage: prev.total > 0 ? Math.round(((Math.max(0, prev.labeled - 1)) / prev.total) * 100) : 0
          }));
          setImageData(prev => ({ ...prev, is_labeled: false }));
          setImageList(prev => prev.map(img => img.id === imageData.id ? { ...img, is_labeled: false } : img));
        }

        if (deletionErrors > 0) {
          message.warning(`Cleared annotations with ${deletionErrors} errors. Some annotations may still remain.`);
        } else {
          message.success('All annotations cleared successfully');
        }

      } catch (refreshError) {
        console.error('Failed to refresh annotations after clear:', refreshError);
        // Fallback: clear UI state anyway
        setAnnotations([]);
        setSelectedAnnotation(null);
        setEditingAnnotation(null);
        setImageLabels([]);
        message.warning('Annotations cleared but UI refresh failed. Please reload the page.');
      }

    } catch (e) {
      console.error('Clear all failed', e);
      message.error('Failed to clear all annotations');
    }
  }, [annotations, imageData, findProjectLabelByName, resolveLabelColor]);

  const loadDatasetImages = async () => {
    try {
      setLoading(true);
      logInfo('app.frontend.interactions', 'loading_dataset_images', 'Loading dataset images', {
        datasetId,
        timestamp: new Date().toISOString()
      });
      const response = await AnnotationAPI.getDatasetImages(datasetId, 0, 1000);
      const allImages = response.images;

      // If navigated from Dataset section with a filtered list, use that order/subset
      const filteredIds = location.state?.filteredImageIds;
      let imagesToShow = allImages;
      if (filteredIds && filteredIds.length > 0) {
        const ordered = filteredIds
          .map(id => allImages.find(img => img.id === id))
          .filter(Boolean);
        if (ordered.length > 0) imagesToShow = ordered;
      }

      setImageList(imagesToShow);
      setDatasetProgress({
        total: allImages.length,
        labeled: allImages.filter(img => img.is_labeled).length,
        percentage: allImages.length > 0 ?
          Math.round((allImages.filter(img => img.is_labeled).length / allImages.length) * 100) : 0
      });
      logInfo('app.frontend.interactions', 'dataset_images_loaded_success', 'Dataset images loaded successfully', {
        datasetId,
        imageCount: response.images.length,
        labeledCount: response.images.filter(img => img.is_labeled).length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError('app.frontend.validation', 'dataset_images_load_failed', 'Failed to load dataset images', error, {
        datasetId,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      message.error('Failed to load dataset images');
      console.error('Load images error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectLabels = async (forceRefresh = false) => {
    try {
      logInfo('app.frontend.interactions', 'loading_project_labels', 'Loading project labels', {
        datasetId,
        forceRefresh,
        timestamp: new Date().toISOString()
      });
      console.log('🔍 LOADING PROJECT LABELS - Dataset ID:', datasetId);

      // Get the project ID for this dataset to load labels
      const response = await axios.get(`${API_BASE}/datasets/${datasetId}`);
      const projectId = response.data.project_id;
      setCurrentProjectId(projectId);

      console.log(`🔍 DATASET ${datasetId} belongs to PROJECT ${projectId}`);

      // CRITICAL: Prevent 422 errors by checking for NaN project ID
      if (!projectId || isNaN(projectId)) {
        logError('app.frontend.validation', 'invalid_project_id', 'Cannot load labels for invalid project ID', {
          datasetId,
          projectId
        });
        console.error(`❌ INVALID PROJECT ID: ${projectId} for dataset ${datasetId}. Skipping labels fetch.`);
        return;
      }

      console.log('🔍 CURRENT PROJECT LABELS STATE:', projectLabels.length, 'labels');

      // Now get the labels for this project
      // Add force_refresh parameter if needed to clean up orphaned labels
      const url = forceRefresh
        ? `${API_BASE}/projects/${projectId}/labels?force_refresh=true`
        : `${API_BASE}/projects/${projectId}/labels`;

      console.log(`GET ${url}`);
      const labelResponse = await axios.get(url);
      const apiLabels = Array.isArray(labelResponse.data) ? labelResponse.data : [];

      console.log('Loaded project labels from API:', apiLabels);

      if (apiLabels && apiLabels.length > 0) {
        logInfo('app.frontend.interactions', 'project_labels_loaded_success', 'Project labels loaded successfully', {
          datasetId,
          labelCount: apiLabels.length,
          timestamp: new Date().toISOString()
        });
        // Transform to UI format
        const formattedLabels = apiLabels.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color || AnnotationAPI.generateLabelColor(label.name),
          count: label.count || 0, // Use count from API if available
          projectCount: label.count || 0, // Store project-wide count
          project_id: projectId // Store the project ID with each label
        }));

        console.log('Formatted project labels:', formattedLabels);
        setProjectLabels(formattedLabels);
        logInfo('app.frontend.ui', 'project_labels_formatted', 'Project labels formatted and set', {
          datasetId,
          formattedLabelCount: formattedLabels.length,
          timestamp: new Date().toISOString()
        });

        // Store in local storage as backup using both project ID and dataset ID for better availability
        localStorage.setItem(`project_labels_${projectId}`, JSON.stringify(formattedLabels));
        localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(formattedLabels));
      } else {
        logInfo('app.frontend.ui', 'no_api_labels_found', 'No labels found from API; clearing stale label cache', {
          datasetId,
          projectId,
          timestamp: new Date().toISOString()
        });
        localStorage.removeItem(`project_labels_${projectId}`);
        localStorage.removeItem(`project_labels_${datasetId}`);
        setProjectLabels([]);
      }
    } catch (error) {
      logError('app.frontend.validation', 'project_labels_load_failed', 'Failed to load project labels', error, {
        datasetId,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('Load project labels error:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Try to get project ID from error response if possible
      let projectId;
      try {
        if (error.response && error.response.data && error.response.data.project_id) {
          projectId = error.response.data.project_id;
        }
      } catch (e) {
        console.log('Could not get project ID from error response');
      }

      // Do not revive labels from local storage after API failures.
      // Project labels should come only from the server to avoid cross-project leaks.
      if (projectId) {
        localStorage.removeItem(`project_labels_${projectId}`);
      }
      localStorage.removeItem(`project_labels_${datasetId}`);
      setProjectLabels([]);
      console.warn('Project labels not loaded from API; cleared stale local cache instead of restoring it.');
    }
  };

  const resetCopyLabelsState = () => {
    setCopySourceMode('image');
    setCopySearchText('');
    setCopySelectedImage(null);
    setCopySourceImages([]);
    setCopyPreviewAnnotations([]);
    setPredictionImportTrainingId(null);
    setPredictionImportExperiments([]);
    setPredictionImportExperimentId(null);
    setPredictionImportScope('current');
    setPredictionImportConflictMode('skip');
    setPredictionImportPreview(null);
  };

  const openCopyLabelsModal = async () => {
    if (!imageData?.id) {
      message.warning('Open a target image before copying labels');
      return;
    }

    setCopyModalVisible(true);
    setCopyLoading(true);
    resetCopyLabelsState();

    try {
      let projectId = currentProjectId;
      if (!projectId) {
        const datasetResponse = await axios.get(`${API_BASE}/datasets/${datasetId}`);
        projectId = datasetResponse.data.project_id;
        setCurrentProjectId(projectId);
      }

      const datasetsResponse = await axios.get(`${API_BASE}/datasets/`, {
        params: { project_id: projectId, skip: 0, limit: 10000 }
      });
      const datasets = Array.isArray(datasetsResponse.data) ? datasetsResponse.data : [];
      setCopyDatasets(datasets);
      const initialDatasetId = datasets.find(ds => String(ds.id) === String(datasetId))?.id || datasets[0]?.id || null;
      setCopySourceDatasetId(initialDatasetId);
      if (initialDatasetId) {
        await loadCopySourceImages(initialDatasetId);
      }
      const trainingResponse = await axios.get(`${API_BASE}/projects/${projectId}/training/sessions`);
      const trainings = (Array.isArray(trainingResponse.data) ? trainingResponse.data : [])
        .filter(session => session?.id && !String(session.id).startsWith('unmanaged_'));
      setPredictionImportTrainings(trainings);

      const initialTraining = trainings[0] || null;
      if (initialTraining) {
        setPredictionImportTrainingId(initialTraining.id);
        await loadPredictionImportExperiments(initialTraining.id, 'current', 'skip');
      }
    } catch (error) {
      console.error('Failed to prepare copy labels modal:', error);
      message.error('Failed to load copy label sources');
    } finally {
      setCopyLoading(false);
    }
  };

  const loadCopySourceImages = async (sourceDatasetId) => {
    if (!sourceDatasetId) return;
    setCopyLoading(true);
    setCopySelectedImage(null);
    setCopyPreviewAnnotations([]);

    try {
      const response = await axios.get(`${API_BASE}/datasets/${sourceDatasetId}/images`, {
        params: {
          skip: 0,
          limit: 10000,
          labeled_only: true,
          include_annotations: true
        }
      });
      const images = (response.data.images || [])
        .filter(img => img.id !== imageData?.id)
        .map(img => ({
          ...img,
          annotation_count: Array.isArray(img.annotations) ? img.annotations.length : 0
        }))
        .filter(img => img.annotation_count > 0);
      setCopySourceImages(images);
    } catch (error) {
      console.error('Failed to load source images:', error);
      message.error('Failed to load labeled source images');
    } finally {
      setCopyLoading(false);
    }
  };

  const buildCopiedAnnotation = (sourceAnnotation, index, preview = false) => {
    const labelName = sourceAnnotation.class_name || sourceAnnotation.label || 'unknown';
    const normalizePoint = (point) => {
      if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) };
      return { x: Number(point.x), y: Number(point.y) };
    };
    const normalizeSegmentation = (segmentationValue) => {
      if (!Array.isArray(segmentationValue) || segmentationValue.length === 0) return null;
      if (typeof segmentationValue[0] === 'number') {
        const points = [];
        for (let i = 0; i < segmentationValue.length - 1; i += 2) {
          points.push({ x: Number(segmentationValue[i]), y: Number(segmentationValue[i + 1]) });
        }
        return points;
      }
      return segmentationValue.map(normalizePoint).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    };
    const segmentation = normalizeSegmentation(sourceAnnotation.segmentation);
    const copied = {
      id: preview ? `${PREVIEW_COPY_PREFIX}${sourceAnnotation.id || index}` : undefined,
      class_name: labelName,
      label: labelName,
      confidence: sourceAnnotation.confidence || 1.0,
      color: resolveLabelColor(labelName, sourceAnnotation.color),
      type: segmentation && segmentation.length > 2 ? 'polygon' : 'box',
      segmentation
    };

    if (segmentation && segmentation.length > 2) {
      copied.points = segmentation;
      const xs = segmentation.map(point => point.x);
      const ys = segmentation.map(point => point.y);
      copied.x = Math.min(...xs);
      copied.y = Math.min(...ys);
      copied.width = Math.max(...xs) - copied.x;
      copied.height = Math.max(...ys) - copied.y;
    } else {
      const x = sourceAnnotation.x_min ?? sourceAnnotation.x ?? 0;
      const y = sourceAnnotation.y_min ?? sourceAnnotation.y ?? 0;
      const xMax = sourceAnnotation.x_max ?? (x + (sourceAnnotation.width || 0));
      const yMax = sourceAnnotation.y_max ?? (y + (sourceAnnotation.height || 0));
      copied.x = x;
      copied.y = y;
      copied.width = xMax - x;
      copied.height = yMax - y;
    }

    return copied;
  };

  const selectCopySourceImage = async (sourceImage) => {
    setCopySelectedImage(sourceImage);
    setCopyPreviewAnnotations([]);

    if (!imageData || Number(sourceImage.width) !== Number(imageData.width) || Number(sourceImage.height) !== Number(imageData.height)) {
      return;
    }

    const sourceAnnotations = Array.isArray(sourceImage.annotations) && sourceImage.annotations.length
      ? sourceImage.annotations
      : await AnnotationAPI.getImageAnnotations(sourceImage.id);
    const previewAnnotations = sourceAnnotations.map((ann, index) => buildCopiedAnnotation(ann, index, true));
    setCopyPreviewAnnotations(previewAnnotations);
  };

  const applyCopiedLabels = async () => {
    if (isTargetMarkedNull) {
      message.warning('Remove Null marking before copying labels');
      return;
    }

    if (!copySelectedImage || !selectedCopySizeMatches || copyPreviewAnnotations.length === 0 || !imageData?.id) {
      message.warning('Select a same-size labeled source image first');
      return;
    }

    const saveCopiedAnnotations = async () => {
      setCopyApplying(true);
      try {
        const annotationsToSave = copyPreviewAnnotations.map(({ id, color, points, ...ann }) => ({
          ...ann,
          image_id: imageData.id,
          segmentation: ann.segmentation ? JSON.parse(JSON.stringify(ann.segmentation)) : null
        }));

        await axios.post(`${API_BASE}/images/${imageData.id}/annotations`, {
          annotations: annotationsToSave
        });

        const wasUnlabeled = !imageData.is_labeled;
        await loadImageData({ ...imageData, is_labeled: true });
        setImageList(prev => prev.map(img => img.id === imageData.id ? { ...img, is_labeled: true } : img));
        if (wasUnlabeled) {
          setDatasetProgress(prev => ({
            ...prev,
            labeled: prev.labeled + 1,
            percentage: prev.total > 0 ? Math.round(((prev.labeled + 1) / prev.total) * 100) : 0
          }));
        }

        setCopyModalVisible(false);
        resetCopyLabelsState();
        message.success(`Copied ${annotationsToSave.length} label${annotationsToSave.length !== 1 ? 's' : ''}`);
      } catch (error) {
        console.error('Failed to copy labels:', error);
        message.error('Failed to copy labels');
      } finally {
        setCopyApplying(false);
      }
    };

    if (annotations.length > 0) {
      Modal.confirm({
        title: 'Target image already has labels',
        content: 'Copied labels will be added to the current labels. Continue?',
        okText: 'Apply Labels',
        onOk: saveCopiedAnnotations
      });
    } else {
      await saveCopiedAnnotations();
    }
  };

  const parsePredictionMap = (predictions) => {
    if (!predictions) return {};
    if (typeof predictions === 'string') {
      try {
        return JSON.parse(predictions) || {};
      } catch (error) {
        console.error('Failed to parse experiment predictions:', error);
        return {};
      }
    }
    return predictions;
  };

  const getBaseFilename = (value) => {
    if (!value) return '';
    const normalized = String(value).replace(/\\/g, '/');
    return normalized.split('/').pop().toLowerCase();
  };

  const getImageMatchNames = (image) => {
    return [
      image?.filename,
      image?.original_filename,
      image?.name,
      image?.file_path,
      image?.path,
      image?.url
    ]
      .filter(Boolean)
      .map(getBaseFilename)
      .filter(Boolean);
  };

  const findPredictionEntryForImage = (predictionMap, image) => {
    const imageNames = new Set(getImageMatchNames(image));
    if (imageNames.size === 0) return null;

    for (const [key, detections] of Object.entries(predictionMap || {})) {
      const predictionName = getBaseFilename(key);
      if (imageNames.has(predictionName)) {
        return { key, detections: Array.isArray(detections) ? detections : [] };
      }
    }

    return null;
  };

  const normalizePredictionSegmentation = (segmentationValue) => {
    if (!Array.isArray(segmentationValue) || segmentationValue.length === 0) return null;
    if (typeof segmentationValue[0] === 'number') {
      const points = [];
      for (let i = 0; i < segmentationValue.length - 1; i += 2) {
        points.push({ x: Number(segmentationValue[i]), y: Number(segmentationValue[i + 1]) });
      }
      return points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    }
    if (Array.isArray(segmentationValue[0]) && typeof segmentationValue[0][0] === 'number') {
      return segmentationValue
        .map(point => ({ x: Number(point[0]), y: Number(point[1]) }))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    }
    return segmentationValue
      .map(point => ({ x: Number(point.x), y: Number(point.y) }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  };

  const resolvePredictionLabelName = (detection) => {
    const genericNames = new Set(['item', 'object', 'objects', 'class', 'unknown']);
    const meaningfulLabels = projectLabels.filter((label) => {
      const name = String(label.name || '').trim().toLowerCase();
      return name && !genericNames.has(name);
    });
    const projectLabelByName = new Map(
      projectLabels.map(label => [String(label.name || '').trim().toLowerCase(), label.name]).filter(([name]) => name)
    );

    const rawNameCandidates = [
      detection.class_name,
      detection.label,
      detection.category_name,
      detection.name,
      detection.class
    ];

    for (const candidate of rawNameCandidates) {
      const value = String(candidate ?? '').trim();
      if (!value || /^\d+$/.test(value)) continue;

      const normalized = value.toLowerCase();
      if (genericNames.has(normalized)) continue;
      if (projectLabelByName.has(normalized)) {
        return projectLabelByName.get(normalized);
      }
      return value;
    }

    if (meaningfulLabels.length === 1 && meaningfulLabels[0]?.name) {
      return meaningfulLabels[0].name;
    }

    const classIdCandidates = [
      detection.class_id,
      detection.class_idx,
      detection.category_id,
      detection.category,
      detection.class
    ];

    for (const candidate of classIdCandidates) {
      const classIndex = Number(candidate);
      if (Number.isInteger(classIndex) && classIndex >= 0 && projectLabels[classIndex]?.name) {
        const labelName = projectLabels[classIndex].name;
        return genericNames.has(String(labelName).trim().toLowerCase()) && meaningfulLabels.length === 1
          ? meaningfulLabels[0].name
          : labelName;
      }
    }

    if (projectLabels.length === 1 && projectLabels[0]?.name) {
      return projectLabels[0].name;
    }

    return 'item';
  };

  const predictionToAnnotation = (detection, imageIdForSave) => {
    const labelName = resolvePredictionLabelName(detection);
    const segmentation = normalizePredictionSegmentation(detection.segmentation || detection.mask);
    const annotation = {
      image_id: imageIdForSave,
      class_name: labelName,
      label: labelName,
      confidence: Number(detection.confidence ?? detection.score ?? 1.0) || 1.0,
      color: resolveLabelColor(labelName),
      type: segmentation && segmentation.length > 2 ? 'polygon' : 'box',
      segmentation: segmentation && segmentation.length > 2 ? segmentation : null
    };

    if (annotation.type === 'polygon') {
      const xs = segmentation.map(point => point.x);
      const ys = segmentation.map(point => point.y);
      annotation.points = segmentation;
      annotation.x = Math.min(...xs);
      annotation.y = Math.min(...ys);
      annotation.width = Math.max(...xs) - annotation.x;
      annotation.height = Math.max(...ys) - annotation.y;
      return annotation;
    }

    const bbox = Array.isArray(detection.bbox) ? detection.bbox : null;
    const xMin = Number(detection.x_min ?? detection.x ?? bbox?.[0] ?? 0);
    const yMin = Number(detection.y_min ?? detection.y ?? bbox?.[1] ?? 0);
    const xMax = Number(detection.x_max ?? bbox?.[2] ?? (xMin + Number(detection.width || 0)));
    const yMax = Number(detection.y_max ?? bbox?.[3] ?? (yMin + Number(detection.height || 0)));

    annotation.x = xMin;
    annotation.y = yMin;
    annotation.width = Math.max(0, xMax - xMin);
    annotation.height = Math.max(0, yMax - yMin);
    return annotation;
  };

  const buildPredictionImportPreview = async (experiment, scope = predictionImportScope, conflictMode = predictionImportConflictMode) => {
    if (!experiment) {
      setPredictionImportPreview(null);
      return null;
    }

    setPredictionImportLoading(true);
    try {
      const predictionMap = parsePredictionMap(experiment.predictions);
      const predictionKeys = Object.keys(predictionMap || {});
      const targetImages = scope === 'current'
        ? [imageData].filter(Boolean)
        : (await AnnotationAPI.getDatasetImages(datasetId, 0, 10000)).images || [];

      const usedPredictionKeys = new Set();
      const rows = targetImages.map(image => {
        const match = findPredictionEntryForImage(predictionMap, image);
        const detections = match?.detections || [];
        const annotationsToImport = detections
          .map(det => predictionToAnnotation(det, image.id))
          .filter(ann => ann.width > 0 || ann.height > 0 || (ann.segmentation && ann.segmentation.length > 2));
        const hasLabels = Boolean(image?.is_labeled);
        const skipped = conflictMode === 'skip' && hasLabels;

        if (match?.key) usedPredictionKeys.add(match.key);

        return {
          image,
          predictionKey: match?.key || null,
          detections,
          annotationsToImport,
          hasLabels,
          skipped,
          importable: Boolean(match) && annotationsToImport.length > 0 && !skipped
        };
      });

      const importRows = rows.filter(row => row.importable);
      const matchedRows = rows.filter(row => row.predictionKey);
      const skippedRows = rows.filter(row => row.skipped && row.predictionKey);
      const unmatchedPredictionKeys = predictionKeys.filter(key => !usedPredictionKeys.has(key));
      const preview = {
        experiment,
        scope,
        conflictMode,
        rows,
        importRows,
        matchedCount: matchedRows.length,
        skippedCount: skippedRows.length,
        unmatchedPredictionKeys,
        importImageCount: importRows.length,
        importAnnotationCount: importRows.reduce((sum, row) => sum + row.annotationsToImport.length, 0),
        predictionImageCount: predictionKeys.length,
        targetImageCount: targetImages.length
      };

      setPredictionImportPreview(preview);
      return preview;
    } catch (error) {
      console.error('Failed to build prediction import preview:', error);
      message.error('Failed to prepare prediction import preview');
      setPredictionImportPreview(null);
      return null;
    } finally {
      setPredictionImportLoading(false);
    }
  };

  const loadPredictionImportExperiments = async (trainingId, scope = predictionImportScope, conflictMode = predictionImportConflictMode) => {
    if (!trainingId) return [];

    setPredictionImportLoading(true);
    setPredictionImportExperiments([]);
    setPredictionImportExperimentId(null);
    setPredictionImportPreview(null);

    try {
      const response = await axios.get(`${API_BASE}/training/${trainingId}/experiments`);
      const experiments = (Array.isArray(response.data) ? response.data : [])
        .filter(exp =>
          PREDICTION_EXPERIMENT_TYPES.includes(exp.experiment_type) &&
          exp.status === 'completed' &&
          exp.predictions
        );
      setPredictionImportExperiments(experiments);

      const initialExperiment = experiments[0] || null;
      if (initialExperiment) {
        setPredictionImportExperimentId(initialExperiment.id);
        await buildPredictionImportPreview(initialExperiment, scope, conflictMode);
      }

      return experiments;
    } catch (error) {
      console.error('Failed to load prediction experiments:', error);
      message.error('Failed to load prediction experiments');
      return [];
    } finally {
      setPredictionImportLoading(false);
    }
  };

  const applyPredictionImport = async () => {
    if (!predictionImportPreview || predictionImportPreview.importRows.length === 0) {
      message.warning('No prediction annotations ready to import');
      return;
    }

    setPredictionImportApplying(true);
    try {
      for (const row of predictionImportPreview.importRows) {
        const annotationsToSave = row.annotationsToImport.map(({ color, points, ...ann }) => ({
          ...ann,
          image_id: row.image.id,
          segmentation: ann.segmentation ? JSON.parse(JSON.stringify(ann.segmentation)) : null
        }));

        await axios.post(`${API_BASE}/images/${row.image.id}/annotations`, {
          annotations: annotationsToSave
        });
      }

      const currentImported = predictionImportPreview.importRows.some(row => row.image.id === imageData?.id);
      if (currentImported) {
        await loadImageData({ ...imageData, is_labeled: true });
      }
      await loadDatasetImages();

      const importedCount = predictionImportPreview.importAnnotationCount;
      setCopyModalVisible(false);
      resetCopyLabelsState();
      message.success(`Imported ${importedCount} prediction annotation${importedCount !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to import prediction annotations:', error);
      message.error('Failed to import prediction annotations');
    } finally {
      setPredictionImportApplying(false);
    }
  };

  const loadImageData = async (image) => {
    try {
      setLoading(true);
      logInfo('app.frontend.interactions', 'loading_image_data', 'Loading image data', {
        datasetId,
        imageId: image.id,
        imageName: image.filename,
        timestamp: new Date().toISOString()
      });
      setImageData(image);
      console.log('🔍 LOADED IMAGE DATA:', { filename: image.filename, is_labeled: image.is_labeled, id: image.id });
      // Use split_section instead of split_type for train/val/test
      setCurrentSplit(image.split_section || 'train');

      // Load image URL
      const imageUrl = await AnnotationAPI.getImageUrl(image.id);
      setImageUrl(imageUrl);

      // Load annotations
      const fetchedAnnotations = await AnnotationAPI.getImageAnnotations(image.id);

      // DO NOT filter out 'null' markers here - they need to stay in state for button highlighting
      // Filtering for display happens at render time in AnnotationCanvas
      const physicalAnnotations = fetchedAnnotations;

      console.log('Fetched annotations:', fetchedAnnotations);
      console.log('Physical annotations (filtered):', physicalAnnotations);

      logInfo('app.frontend.interactions', 'image_annotations_loaded', 'Image annotations loaded', {
        datasetId,
        imageId: image.id,
        annotationCount: physicalAnnotations.length,
        timestamp: new Date().toISOString()
      });

      // Transform annotations for UI display
      const transformedAnnotations = physicalAnnotations.map(ann => {
        console.log('Processing annotation:', ann);

        // CRITICAL: Determine the annotation type
        let annotationType = ann.type || 'box';
        if (ann.segmentation && Array.isArray(ann.segmentation) && ann.segmentation.length > 2) {
          annotationType = 'polygon';
          console.log('Detected polygon annotation with segmentation points:', ann.segmentation.length);
        }

        // CRITICAL: Get the correct label color from project labels
        const labelName = ann.class_name || ann.label;
        const existingProjectLabel = findProjectLabelByName(labelName);
        const labelColor = resolveLabelColor(labelName, ann.color);

        // Create UI-friendly annotation object
        const uiAnnotation = {
          id: ann.id,
          class_name: labelName,
          label: labelName,
          confidence: ann.confidence || 1.0,
          color: labelColor,
          type: annotationType
        };

        console.log('Setting annotation type to:', annotationType);

        // Handle box annotations
        if (ann.x_min !== undefined && ann.y_min !== undefined &&
          ann.x_max !== undefined && ann.y_max !== undefined) {
          uiAnnotation.x = ann.x_min;
          uiAnnotation.y = ann.y_min;
          uiAnnotation.width = ann.x_max - ann.x_min;
          uiAnnotation.height = ann.y_max - ann.y_min;
        } else if (ann.x !== undefined && ann.y !== undefined &&
          ann.width !== undefined && ann.height !== undefined) {
          uiAnnotation.x = ann.x;
          uiAnnotation.y = ann.y;
          uiAnnotation.width = ann.width;
          uiAnnotation.height = ann.height;
        }

        // CRITICAL: Handle polygon annotations
        if (annotationType === 'polygon' && ann.segmentation) {
          console.log('Setting polygon points:', ann.segmentation);

          // Make a deep copy to avoid reference issues
          uiAnnotation.points = JSON.parse(JSON.stringify(ann.segmentation));

          // Log the points to verify
          console.log('UI annotation points set to:', uiAnnotation.points);
        }

        return uiAnnotation;
      });

      console.log('Transformed annotations for UI:', transformedAnnotations);
      setAnnotations(transformedAnnotations);
      logInfo('app.frontend.ui', 'annotations_transformed', 'Annotations transformed for UI', {
        datasetId,
        imageId: image.id,
        transformedAnnotationCount: transformedAnnotations.length,
        timestamp: new Date().toISOString()
      });

      // Extract unique labels from annotations (exclude 'null' markers from UI list)
      const uniqueLabels = [...new Set(fetchedAnnotations.map(ann => ann.class_name || ann.label))]
        .filter(labelName => labelName && labelName.toLowerCase() !== 'null')
        .map(labelName => {
          const existingLabel = findProjectLabelByName(labelName);
          return existingLabel || {
            id: labelName,
            name: labelName,
            color: resolveLabelColor(labelName),
            count: fetchedAnnotations.filter(ann => (ann.class_name || ann.label) === labelName).length
          };
        });
      setImageLabels(uniqueLabels);

      // CRITICAL: If image is marked as null, force the active tool to 'select'
      // This prevents accidental drawing after a page reload or navigation
      const hasNullMarker = fetchedAnnotations.some(ann =>
        (ann.class_name || ann.label || '').toLowerCase() === 'null'
      );
      if (hasNullMarker) {
        console.log('🔍 Null marker detected on load, forcing "select" tool');
        setActiveTool('select');
      }

    } catch (error) {
      logError('app.frontend.validation', 'image_data_load_failed', 'Failed to load image data', error, {
        datasetId,
        imageId: image?.id,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      message.error('Failed to load image data');
      console.error('Load image data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToolChange = useCallback((tool) => {
    console.log('🎯 TOOL CHANGE REQUESTED:', tool);
    console.log('🎯 Current activeTool:', activeTool);
    console.log('🎯 handleToolChange function called with tool:', tool);

    // CRITICAL: If image is marked as null, only allow 'select' and 'null' tools
    const isLabeledNull = annotations.some(ann => (ann.class_name || ann.label || '').toLowerCase() === 'null');
    if (isLabeledNull && tool !== 'select' && tool !== 'null') {
      message.warning('Drawing tools are disabled for Background (Null) images');
      return;
    }

    console.log('🎯 About to call setActiveTool with:', tool);
    // Set the tool immediately for UI responsiveness
    setActiveTool(tool);
    setSelectedAnnotation(null);
    console.log('🎯 Tool change completed. New activeTool will be:', tool);

    // Log asynchronously without blocking UI
    logUserClick('ManualLabeling', 'tool_change', {
      datasetId,
      newTool: tool,
      timestamp: new Date().toISOString()
    }).catch(err => console.error('Logging error:', err));

    logInfo('app.frontend.interactions', 'annotation_tool_changed', 'Annotation tool changed', {
      datasetId,
      newTool: tool,
      timestamp: new Date().toISOString()
    }).catch(err => console.error('Logging error:', err));
  }, [datasetId, activeTool, annotations]);

  const handleShapeComplete = useCallback(async (shape) => {
    console.log('🎯 handleShapeComplete called with shape:', shape);

    logInfo('app.frontend.interactions', 'shape_completed', 'Annotation shape completed', {
      datasetId,
      imageId: imageData?.id,
      shapeType: shape.type,
      timestamp: new Date().toISOString()
    });

    // CRITICAL: Prevent saving boxes if image is marked as null
    const isLabeledNull = annotations.some(ann => (ann.class_name || ann.label || '').toLowerCase() === 'null');
    if (isLabeledNull) {
      logInfo('app.frontend.interactions', 'shape_blocked_on_null', 'Shape completion blocked: image is marked as null', {
        datasetId, imageId: imageData?.id
      });
      message.warning('Cannot add annotations to a Background (Null) image. Please remove null marking first.');
      return;
    }

    // Make a deep copy to avoid reference issues
    const shapeCopy = JSON.parse(JSON.stringify(shape));

    // CRITICAL: Detect polygon shapes by checking for points array
    if (shapeCopy.points && Array.isArray(shapeCopy.points) && shapeCopy.points.length > 2) {
      console.log('🎯 POLYGON SHAPE DETECTED with points:', shapeCopy.points.length);
      shapeCopy.type = 'polygon';

      // Calculate bounding box for the polygon
      const xs = shapeCopy.points.map(p => p.x);
      const ys = shapeCopy.points.map(p => p.y);
      shapeCopy.x = Math.min(...xs);
      shapeCopy.y = Math.min(...ys);
      shapeCopy.width = Math.max(...xs) - Math.min(...xs);
      shapeCopy.height = Math.max(...ys) - Math.min(...ys);

      console.log('🎯 Calculated polygon bounding box:', {
        x: shapeCopy.x,
        y: shapeCopy.y,
        width: shapeCopy.width,
        height: shapeCopy.height
      });
    } else {
      console.log('🎯 BOX SHAPE DETECTED');
      shapeCopy.type = 'box';
    }

    console.log('🎯 Setting pending shape and showing label popup');
    setPendingShape(shapeCopy);
    logInfo('app.frontend.ui', 'label_popup_triggered', 'Label popup triggered for shape', {
      datasetId,
      imageId: imageData?.id,
      shapeType: shapeCopy.type,
      timestamp: new Date().toISOString()
    });

    // Position the label popup appropriately based on shape type
    if (shapeCopy.type === 'polygon' && shapeCopy.points && shapeCopy.points.length > 0) {
      // For polygons, position near the first point
      setLabelPopupPosition({
        x: shapeCopy.points[0].x,
        y: shapeCopy.points[0].y - 20
      });
    } else {
      // For boxes, position at the top center
      setLabelPopupPosition({
        x: shapeCopy.x + shapeCopy.width / 2,
        y: shapeCopy.y - 10
      });
    }

    // Force refresh ALL labels from the project when opening the popup
    try {
      // Use our loadProjectLabels function with forceRefresh=true
      console.log('FORCE REFRESHING ALL PROJECT LABELS');
      await loadProjectLabels(true);

      // Get the current project ID for this dataset
      const response = await axios.get(`${API_BASE}/datasets/${datasetId}`);
      const currentProjectId = response.data.project_id;

      // Also clean up unused labels for this project
      console.log('Cleaning up unused labels');
      if (currentProjectId) {
        await axios.delete(`${API_BASE}/projects/${currentProjectId}/labels/unused`);

        // Refresh again after cleanup
        await loadProjectLabels(true);
      }
    } catch (error) {
      console.error('Error refreshing project labels:', error);
    }

    // Automatically show the label popup when shape is completed
    setShowLabelPopup(true);

    console.log('🎯 Shape completed with type:', shapeCopy.type);
    logInfo('app.frontend.ui', 'label_popup_shown', 'Label popup shown for shape', {
      datasetId,
      imageId: imageData?.id,
      shapeType: shapeCopy.type,
      timestamp: new Date().toISOString()
    });
  }, [datasetId, imageData, annotations]);

  const handleLabelAssignment = useCallback(async (labelName) => {
    // Check if we're editing an existing annotation or creating a new one
    const isEditing = !!editingAnnotation;
    const requestedLabelName = typeof labelName === 'string' ? labelName.trim() : labelName;

    logInfo('app.frontend.interactions', 'label_assignment_started', 'Label assignment started', {
      datasetId,
      imageId: imageData?.id,
      labelName: requestedLabelName,
      isEditing,
      hasPendingShape: !!pendingShape,
      timestamp: new Date().toISOString()
    });

    if (!isEditing && !pendingShape) {
      logError('app.frontend.validation', 'no_pending_shape', 'No pending shape to label', null, {
        datasetId,
        imageId: imageData?.id,
        timestamp: new Date().toISOString()
      });
      console.error('No pending shape to label');
      return;
    }

    if (!requestedLabelName || typeof labelName !== 'string') {
      logError('app.frontend.validation', 'invalid_label_name', 'Invalid label name provided', null, {
        datasetId,
        imageId: imageData?.id,
        labelName: requestedLabelName,
        timestamp: new Date().toISOString()
      });
      console.error('Invalid label name:', requestedLabelName);
      throw new Error('Invalid label name');
    }

    // CRITICAL: Block any manual assignment of the reserved 'null' label
    // Use lowercase check to be robust
    if (requestedLabelName.toLowerCase() === 'null') {
      message.warning('The "null" label is reserved for system use. Please use a different name.');
      logInfo('app.frontend.validation', 'null_label_assignment_blocked', 'Manual assignment of null label blocked', {
        datasetId, imageId: imageData?.id
      });
      return;
    }

    if (isEditing) {
      logInfo('app.frontend.interactions', 'editing_existing_annotation', 'Editing existing annotation', {
        datasetId,
        imageId: imageData?.id,
        annotationId: editingAnnotation.id,
        oldLabel: editingAnnotation.label,
        newLabel: requestedLabelName,
        timestamp: new Date().toISOString()
      });
      console.log('Editing annotation with new label:', requestedLabelName, 'annotation:', editingAnnotation);
    } else {
      logInfo('app.frontend.interactions', 'creating_new_annotation', 'Creating new annotation', {
        datasetId,
        imageId: imageData?.id,
        labelName: requestedLabelName,
        shapeType: pendingShape?.type,
        timestamp: new Date().toISOString()
      });
      console.log('Assigning label:', requestedLabelName, 'to shape:', pendingShape);
    }

    try {
      // First, ensure the label exists in the project labels
      logInfo('app.frontend.interactions', 'saving_project_label', 'Saving project label', {
        datasetId,
        imageId: imageData?.id,
        labelName: requestedLabelName,
        timestamp: new Date().toISOString()
      });
      console.log(`Saving label "${requestedLabelName}" to dataset ${datasetId}`);
      const savedLabel = await AnnotationAPI.saveProjectLabel(datasetId, {
        name: requestedLabelName,
        color: resolveLabelColor(requestedLabelName)
      });
      const canonicalLabelName = savedLabel?.name || findProjectLabelByName(requestedLabelName)?.name || requestedLabelName;

      console.log('Label saved to project:', savedLabel);
      logInfo('app.frontend.interactions', 'project_label_saved_success', 'Project label saved successfully', {
        datasetId,
        imageId: imageData?.id,
        labelName: canonicalLabelName,
        savedLabelId: savedLabel.id,
        timestamp: new Date().toISOString()
      });

      // Check if we're editing an existing annotation
      if (isEditing) {
        console.log('Updating existing annotation:', editingAnnotation);

        // Push current state to history before updating annotation
        const currentSnapshot = JSON.parse(JSON.stringify(annotations));
        pushHistory(currentSnapshot);
        console.log('📚 History pushed before updating annotation. History length:', historyPast.length + 1);

        // Update the annotation in the UI immediately
        setAnnotations(prev => prev.map(ann =>
          ann.id === editingAnnotation.id ? {
            ...ann,
            label: canonicalLabelName,
            class_name: canonicalLabelName,
            color: resolveLabelColor(canonicalLabelName, savedLabel.color)
          } : ann
        ));

        // Send update to API
        try {
          logInfo('app.frontend.interactions', 'updating_annotation_api', 'Updating annotation via API', {
            datasetId,
            imageId: imageData?.id,
            annotationId: editingAnnotation.id,
            newLabel: canonicalLabelName,
            timestamp: new Date().toISOString()
          });
          await AnnotationAPI.updateAnnotation(editingAnnotation.id, {
            class_name: canonicalLabelName
          });

          message.success(`Annotation updated to "${canonicalLabelName}"`);
          logInfo('app.frontend.interactions', 'annotation_update_success', 'Annotation updated successfully', {
            datasetId,
            imageId: imageData?.id,
            annotationId: editingAnnotation.id,
            newLabel: canonicalLabelName,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logError('app.frontend.validation', 'annotation_update_failed', 'Failed to update annotation', error, {
            datasetId,
            imageId: imageData?.id,
            annotationId: editingAnnotation.id,
            newLabel: canonicalLabelName,
            errorMessage: error.message,
            timestamp: new Date().toISOString()
          });
          console.error('Failed to update annotation:', error);
          message.error('Failed to update annotation');
        }

        // Clear editing state
        setEditingAnnotation(null);
        setShowLabelPopup(false);
        return;
      }

      // If we get here, we're creating a new annotation
      // Make a deep copy of the pending shape to avoid reference issues
      const shapeCopy = JSON.parse(JSON.stringify(pendingShape));

      // Now create the annotation
      const annotation = {
        image_id: imageData.id,
        class_name: canonicalLabelName,
        label: canonicalLabelName,
        confidence: 1.0
      };

      // CRITICAL: Set the type explicitly and handle each type differently
      if (shapeCopy.points && Array.isArray(shapeCopy.points) && shapeCopy.points.length > 2) {
        // This is definitely a polygon
        annotation.type = 'polygon';

        console.log('POLYGON SHAPE DETECTED with points:', shapeCopy.points.length);

        // For polygons, preserve the original points exactly
        annotation.segmentation = JSON.parse(JSON.stringify(shapeCopy.points));

        // Calculate bounding box from points
        const xs = shapeCopy.points.map(p => p.x);
        const ys = shapeCopy.points.map(p => p.y);

        // Set bounding box coordinates
        annotation.x = Math.min(...xs);
        annotation.y = Math.min(...ys);
        annotation.width = Math.max(...xs) - Math.min(...xs);
        annotation.height = Math.max(...ys) - Math.min(...ys);

        // Convert to x_min, y_min, x_max, y_max format for API
        annotation.x_min = annotation.x;
        annotation.y_min = annotation.y;
        annotation.x_max = annotation.x + annotation.width;
        annotation.y_max = annotation.y + annotation.height;

        console.log('POLYGON ANNOTATION CREATED:', {
          type: annotation.type,
          points: annotation.segmentation.length,
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height
        });
      } else {
        // This is a box
        annotation.type = 'box';

        // Preserve original coordinates exactly
        annotation.x = shapeCopy.x;
        annotation.y = shapeCopy.y;
        annotation.width = shapeCopy.width;
        annotation.height = shapeCopy.height;

        // Convert to x_min, y_min, x_max, y_max format for API
        annotation.x_min = shapeCopy.x;
        annotation.y_min = shapeCopy.y;
        annotation.x_max = shapeCopy.x + shapeCopy.width;
        annotation.y_max = shapeCopy.y + shapeCopy.height;

        console.log('BOX ANNOTATION CREATED:', {
          type: annotation.type,
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height
        });
      }
      logInfo('app.frontend.interactions', 'saving_annotation_api', 'Saving annotation via API', {
        datasetId,
        imageId: imageData?.id,
        annotationType: annotation.type,
        labelName: canonicalLabelName,
        timestamp: new Date().toISOString()
      });
      console.log('Saving annotation:', annotation);
      const response = await AnnotationAPI.saveAnnotation(annotation);
      console.log('Saved annotation response:', response);
      logInfo('app.frontend.interactions', 'annotation_saved_success', 'Annotation saved successfully', {
        datasetId,
        imageId: imageData?.id,
        annotationId: response.annotation?.id || response.id,
        annotationType: annotation.type,
        labelName: canonicalLabelName,
        timestamp: new Date().toISOString()
      });
      const savedAnnotation = response.annotation || response;
      // Create UI-friendly annotation object
      const uiAnnotation = {
        id: savedAnnotation.id,
        class_name: savedAnnotation.class_name || savedAnnotation.label,
        label: savedAnnotation.class_name || savedAnnotation.label,
        confidence: savedAnnotation.confidence || 1.0,
        color: resolveLabelColor(canonicalLabelName, savedLabel.color)
      };

      // CRITICAL: Set the type explicitly based on the annotation we just created
      if (annotation.type === 'polygon') {
        // This is a polygon annotation
        uiAnnotation.type = 'polygon';

        console.log('CREATING UI POLYGON ANNOTATION');

        // CRITICAL: Always use the original points from the shape we drew
        if (shapeCopy.points && Array.isArray(shapeCopy.points) && shapeCopy.points.length > 2) {
          console.log('Using original polygon points from shapeCopy');
          // Deep copy to avoid reference issues
          uiAnnotation.points = JSON.parse(JSON.stringify(shapeCopy.points));

          // Calculate bounding box from original points
          const xs = shapeCopy.points.map(p => p.x);
          const ys = shapeCopy.points.map(p => p.y);
          uiAnnotation.x = Math.min(...xs);
          uiAnnotation.y = Math.min(...ys);
          uiAnnotation.width = Math.max(...xs) - Math.min(...xs);
          uiAnnotation.height = Math.max(...ys) - Math.min(...ys);

          console.log('UI POLYGON POINTS:', uiAnnotation.points);
        }
        // Fallback to segmentation from server response
        else if (savedAnnotation.segmentation && Array.isArray(savedAnnotation.segmentation) && savedAnnotation.segmentation.length > 2) {
          console.log('Using server polygon points');
          // Deep copy to avoid reference issues
          uiAnnotation.points = JSON.parse(JSON.stringify(savedAnnotation.segmentation));

          // Calculate bounding box from server points
          const xs = savedAnnotation.segmentation.map(p => p.x);
          const ys = savedAnnotation.segmentation.map(p => p.y);
          uiAnnotation.x = Math.min(...xs);
          uiAnnotation.y = Math.min(...ys);
          uiAnnotation.width = Math.max(...xs) - Math.min(...xs);
          uiAnnotation.height = Math.max(...ys) - Math.min(...ys);

          console.log('UI POLYGON POINTS FROM SERVER:', uiAnnotation.points);
        }
        // Last resort fallback
        else if (annotation.segmentation && Array.isArray(annotation.segmentation) && annotation.segmentation.length > 2) {
          console.log('Using annotation segmentation as last resort');
          // Deep copy to avoid reference issues
          uiAnnotation.points = JSON.parse(JSON.stringify(annotation.segmentation));
          uiAnnotation.x = annotation.x;
          uiAnnotation.y = annotation.y;
          uiAnnotation.width = annotation.width;
          uiAnnotation.height = annotation.height;

          console.log('UI POLYGON POINTS FROM ANNOTATION:', uiAnnotation.points);
        }
        else {
          console.error('CRITICAL ERROR: No valid polygon points found!');
          console.error('shapeCopy:', shapeCopy);
          console.error('savedAnnotation:', savedAnnotation);
          console.error('annotation:', annotation);
        }

        console.log('CREATED UI POLYGON:', {
          type: uiAnnotation.type,
          points: uiAnnotation.points ? uiAnnotation.points.length : 0,
          x: uiAnnotation.x,
          y: uiAnnotation.y,
          width: uiAnnotation.width,
          height: uiAnnotation.height
        });
      }
      else {
        // This is a box annotation
        uiAnnotation.type = 'box';

        // For boxes, use the server response coordinates if available
        if (savedAnnotation.x_min !== undefined && savedAnnotation.y_min !== undefined &&
          savedAnnotation.x_max !== undefined && savedAnnotation.y_max !== undefined) {
          uiAnnotation.x = savedAnnotation.x_min;
          uiAnnotation.y = savedAnnotation.y_min;
          uiAnnotation.width = savedAnnotation.x_max - savedAnnotation.x_min;
          uiAnnotation.height = savedAnnotation.y_max - savedAnnotation.y_min;
        }
        else if (savedAnnotation.x !== undefined && savedAnnotation.y !== undefined &&
          savedAnnotation.width !== undefined && savedAnnotation.height !== undefined) {
          uiAnnotation.x = savedAnnotation.x;
          uiAnnotation.y = savedAnnotation.y;
          uiAnnotation.width = savedAnnotation.width;
          uiAnnotation.height = savedAnnotation.height;
        }
        // Fallback to original shape coordinates
        else {
          uiAnnotation.x = shapeCopy.x;
          uiAnnotation.y = shapeCopy.y;
          uiAnnotation.width = shapeCopy.width;
          uiAnnotation.height = shapeCopy.height;
        }

        console.log('CREATED UI BOX:', {
          type: uiAnnotation.type,
          x: uiAnnotation.x,
          y: uiAnnotation.y,
          width: uiAnnotation.width,
          height: uiAnnotation.height
        });
      }

      console.log('Created UI annotation:', uiAnnotation);

      // Push current state to history before adding new annotation
      const currentSnapshot = JSON.parse(JSON.stringify(annotations));
      pushHistory(currentSnapshot);
      console.log('📚 History pushed before adding annotation. History length:', historyPast.length + 1);

      // Add the annotation with proper database ID to the state
      setAnnotations(prev => {
        const newAnnotations = [...prev, uiAnnotation];
        console.log('✅ Added annotation with database ID:', uiAnnotation.id);
        return newAnnotations;
      });
      // Check if the label already exists in the project
      const existingProjectLabel = findProjectLabelByName(canonicalLabelName);

      // Check if the label already exists in the image
      const existingImageLabel = imageLabels.find(
        l => (l.name || '').toLowerCase() === canonicalLabelName.toLowerCase()
      );

      // Generate a consistent color for the label
      const labelColor = resolveLabelColor(canonicalLabelName, savedLabel.color);

      // Update image labels
      if (existingImageLabel) {
        // Update the count for the existing label
        setImageLabels(prev => prev.map(l =>
          (l.name || '').toLowerCase() === canonicalLabelName.toLowerCase()
            ? { ...l, count: l.count + 1 }
            : l
        ));
      } else {
        const newImageLabel = {
          id: existingProjectLabel?.id || canonicalLabelName,
          name: canonicalLabelName,
          color: labelColor,
          count: 1
        };
        setImageLabels(prev => [...prev, newImageLabel]);
      }

      // Update project labels if needed
      if (!existingProjectLabel) {
        const newProjectLabel = {
          id: canonicalLabelName,
          name: canonicalLabelName,
          color: labelColor,
          count: 1,
          projectCount: 1
        };
        setProjectLabels(prev => [...prev, newProjectLabel]);

        // Also update local storage as backup
        const updatedLabels = [...projectLabels, newProjectLabel];
        localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(updatedLabels));
      } else {
        // Update the project-wide count
        setProjectLabels(prev => prev.map(l =>
          (l.name || '').toLowerCase() === canonicalLabelName.toLowerCase()
            ? { ...l, count: l.count + 1, projectCount: (l.projectCount || 0) + 1 }
            : l
        ));
      }

      // CRITICAL: Make sure the label is saved to the database and updated in UI
      try {
        console.log('UPDATING PROJECT LABELS with label:', canonicalLabelName);

        // CRITICAL: Use the project ID resolved by the API service
        const projectId = savedLabel?.project_id;

        if (!projectId || isNaN(projectId)) {
          console.warn('Skipping redundant label save: No valid project ID available');
          return;
        }

        // Force save the label to the database again to ensure it's there
        const projectLabel = {
          name: canonicalLabelName,
          color: labelColor, // Use the labelColor we defined earlier
          project_id: projectId
        };

        // Save to database with direct API call
        console.log(`FORCE SAVING LABEL TO DATABASE: POST ${API_BASE}/projects/${projectId}/labels`);
        console.log('Label data:', projectLabel);

        let savedLabelFromDb = null;
        try {
          const labelResponse = await axios.post(`${API_BASE}/projects/${projectId}/labels`, projectLabel);
          console.log('Label save response:', labelResponse.data);
          savedLabelFromDb = labelResponse.data;
        } catch (labelError) {
          console.error('Error saving label to database:', labelError);
          console.error('Error response:', labelError.response?.data);
        }

        // Case-insensitive search for existing label in UI state
        const existingProjectLabel = findProjectLabelByName(canonicalLabelName);

        if (!existingProjectLabel) {
          // Add the new label to project labels UI state
          const newProjectLabel = {
            id: (savedLabelFromDb && savedLabelFromDb.id) || Date.now(),
            name: canonicalLabelName,
            color: (savedLabelFromDb && savedLabelFromDb.color) || labelColor,
            count: 1
          };

          console.log('ADDING NEW PROJECT LABEL TO UI STATE:', newProjectLabel);
          setProjectLabels(prev => [...prev, newProjectLabel]);
        } else {
          // Update existing label count
          console.log('UPDATING EXISTING PROJECT LABEL COUNT:', existingProjectLabel);
          setProjectLabels(prev => prev.map(l =>
            l.name.toLowerCase() === canonicalLabelName.toLowerCase()
              ? { ...l, count: (l.count || 0) + 1 }
              : l
          ));
        }

        // CRITICAL: Force refresh project labels from server immediately
        console.log(`FORCE REFRESHING PROJECT LABELS FROM SERVER: GET ${API_BASE}/projects/${projectId}/labels`);

        try {
          const labelsResponse = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
          const freshLabels = Array.isArray(labelsResponse.data) ? labelsResponse.data : [];

          console.log('RECEIVED FRESH PROJECT LABELS:', freshLabels);

          if (freshLabels && freshLabels.length > 0) {
            // Transform to UI format
            const formattedLabels = freshLabels.map(label => {
              // Find existing label to preserve count
              const existingLabel = projectLabels.find(l =>
                l.name.toLowerCase() === label.name.toLowerCase()
              );

              return {
                id: label.id,
                name: label.name,
                color: label.color || AnnotationAPI.generateLabelColor(label.name),
                count: existingLabel ? (existingLabel.count || 1) : 1
              };
            });

            console.log('SETTING FORMATTED PROJECT LABELS:', formattedLabels);
            setProjectLabels(formattedLabels);

            // Also update local storage as backup
            localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(formattedLabels));
          }
        } catch (refreshError) {
          console.error('Error refreshing labels from server:', refreshError);
        }

        // CRITICAL: Force reload project labels using our improved function
        setTimeout(() => {
          console.log('Delayed refresh of project labels');
          loadProjectLabels();
        }, 1000);

      } catch (error) {
        console.error('FAILED TO UPDATE PROJECT LABELS:', error);

        // Even if updating the database fails, ensure the label is in the UI
        const existingProjectLabel = findProjectLabelByName(canonicalLabelName);

        if (!existingProjectLabel) {
          // Add the new label to project labels
          const newProjectLabel = {
            id: savedLabel.id || Date.now(),
            name: canonicalLabelName,
            color: resolveLabelColor(canonicalLabelName, savedLabel.color),
            count: 1
          };

          console.log('ADDING NEW PROJECT LABEL TO UI STATE (FALLBACK):', newProjectLabel);
          setProjectLabels(prev => [...prev, newProjectLabel]);

          // Store in local storage as backup
          const updatedLabels = [...projectLabels, newProjectLabel];
          localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(updatedLabels));
        }
      }
      if (!imageData.is_labeled) {
        logInfo('app.frontend.ui', 'image_marked_as_labeled', 'Image marked as labeled', {
          datasetId,
          imageId: imageData?.id,
          timestamp: new Date().toISOString()
        });
        setDatasetProgress(prev => ({
          ...prev,
          labeled: prev.labeled + 1,
          percentage: Math.round(((prev.labeled + 1) / prev.total) * 100)
        }));
        setImageData(prev => ({ ...prev, is_labeled: true }));
        setImageList(prev => prev.map(img => img.id === imageData.id ? { ...img, is_labeled: true } : img));
      }
      message.success(`Annotation saved with label "${canonicalLabelName}"`);
      logInfo('app.frontend.interactions', 'annotation_complete', 'Annotation process completed', {
        datasetId,
        imageId: imageData?.id,
        labelName: canonicalLabelName,
        annotationType: pendingShape?.type,
        timestamp: new Date().toISOString()
      });

      // Note: Removed server refresh that was breaking undo/redo history chain
      // The annotation is already added to UI state above, no need to refresh from server

    } catch (error) {
      logError('app.frontend.validation', 'annotation_save_failed', 'Failed to save annotation', error, {
        datasetId,
        imageId: imageData?.id,
        labelName: requestedLabelName,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      message.error(`Failed to save annotation: ${error.message}`);
      console.error('Save annotation error:', error);
    } finally {
      setShowLabelPopup(false);
      // Clear editing state
      setEditingAnnotation(null);
      // ✅ Delay clearing to allow canvas redraw to complete
      setTimeout(() => {
        setPendingShape(null);
      }, 100); // short delay is enough
    }
  }, [pendingShape, imageData, datasetId, imageLabels, editingAnnotation, annotations, pushHistory, historyPast, findProjectLabelByName, resolveLabelColor]);

  const buildPolygonAnnotationWithPoints = useCallback((annotation, points) => {
    const cleanPoints = points
      .map(point => ({ x: Number(point.x), y: Number(point.y) }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (cleanPoints.length < 3) {
      return null;
    }

    const xs = cleanPoints.map(point => point.x);
    const ys = cleanPoints.map(point => point.y);
    const xMin = Math.min(...xs);
    const yMin = Math.min(...ys);
    const xMax = Math.max(...xs);
    const yMax = Math.max(...ys);

    return {
      ...annotation,
      type: 'polygon',
      points: cleanPoints,
      segmentation: cleanPoints,
      x: xMin,
      y: yMin,
      width: xMax - xMin,
      height: yMax - yMin
    };
  }, []);

  const startPolygonShapeEdit = useCallback(() => {
    const annotationToEdit = editingAnnotation || selectedAnnotation;
    if (!annotationToEdit || annotationToEdit.type !== 'polygon' || !Array.isArray(annotationToEdit.points)) {
      message.warning('Select a polygon annotation to edit shape');
      return;
    }

    const draft = buildPolygonAnnotationWithPoints(annotationToEdit, annotationToEdit.points);
    if (!draft) {
      message.warning('Polygon must have at least 3 valid points');
      return;
    }

    setShapeEditOriginal(JSON.parse(JSON.stringify(annotationToEdit)));
    setShapeEditAnnotation(JSON.parse(JSON.stringify(draft)));
    setSelectedAnnotation(draft);
    setShowLabelPopup(false);
    setEditingAnnotation(null);
    message.info('Edit shape mode: drag points, then Save Shape');
  }, [editingAnnotation, selectedAnnotation, buildPolygonAnnotationWithPoints]);

  const updatePolygonShapeDraft = useCallback((points) => {
    setShapeEditAnnotation(prev => {
      if (!prev) return prev;
      return buildPolygonAnnotationWithPoints(prev, points) || prev;
    });
  }, [buildPolygonAnnotationWithPoints]);

  const cancelPolygonShapeEdit = useCallback(() => {
    setShapeEditAnnotation(null);
    setShapeEditOriginal(null);
    setShapeEditSaving(false);
    if (shapeEditOriginal) {
      setSelectedAnnotation(shapeEditOriginal);
    }
    message.info('Shape edit cancelled');
  }, [shapeEditOriginal]);

  const savePolygonShapeEdit = useCallback(async () => {
    if (!shapeEditAnnotation || !shapeEditAnnotation.id || shapeEditAnnotation.points.length < 3) {
      message.warning('No valid polygon shape to save');
      return;
    }

    const xs = shapeEditAnnotation.points.map(point => point.x);
    const ys = shapeEditAnnotation.points.map(point => point.y);
    const xMin = Math.min(...xs);
    const yMin = Math.min(...ys);
    const xMax = Math.max(...xs);
    const yMax = Math.max(...ys);

    setShapeEditSaving(true);
    const currentSnapshot = JSON.parse(JSON.stringify(annotations));
    pushHistory(currentSnapshot);

    setAnnotations(prev => prev.map(ann =>
      ann.id === shapeEditAnnotation.id ? {
        ...ann,
        points: JSON.parse(JSON.stringify(shapeEditAnnotation.points)),
        segmentation: JSON.parse(JSON.stringify(shapeEditAnnotation.points)),
        x: xMin,
        y: yMin,
        width: xMax - xMin,
        height: yMax - yMin
      } : ann
    ));

    try {
      await AnnotationAPI.updateAnnotation(shapeEditAnnotation.id, {
        x_min: xMin,
        y_min: yMin,
        x_max: xMax,
        y_max: yMax,
        segmentation: JSON.parse(JSON.stringify(shapeEditAnnotation.points))
      });

      const savedDraft = JSON.parse(JSON.stringify({
        ...shapeEditAnnotation,
        x: xMin,
        y: yMin,
        width: xMax - xMin,
        height: yMax - yMin,
        segmentation: shapeEditAnnotation.points
      }));
      setSelectedAnnotation(savedDraft);
      setShapeEditAnnotation(null);
      setShapeEditOriginal(null);
      message.success('Shape updated');
    } catch (error) {
      console.error('Failed to update polygon shape:', error);
      message.error('Failed to save shape');
      if (shapeEditOriginal) {
        setAnnotations(prev => prev.map(ann =>
          ann.id === shapeEditOriginal.id ? JSON.parse(JSON.stringify(shapeEditOriginal)) : ann
        ));
        setSelectedAnnotation(shapeEditOriginal);
      }
    } finally {
      setShapeEditSaving(false);
    }
  }, [shapeEditAnnotation, shapeEditOriginal, annotations, pushHistory]);

  const handleAnnotationSelect = useCallback((annotation) => {
    if (shapeEditAnnotation) {
      if (annotation?.id !== shapeEditAnnotation.id) {
        message.info('Save or cancel shape edit first');
      }
      return;
    }

    logUserClick('ManualLabeling', 'annotation_select', {
      datasetId,
      imageId: imageData?.id,
      annotationId: annotation?.id,
      annotationLabel: annotation?.label,
      activeTool,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.interactions', 'annotation_selected', 'Annotation selected', {
      datasetId,
      imageId: imageData?.id,
      annotationId: annotation?.id,
      annotationLabel: annotation?.label,
      activeTool,
      timestamp: new Date().toISOString()
    });
    setSelectedAnnotation(annotation);

    // If we're in select mode and clicked on an annotation, open label editor
    if (activeTool === 'select' && annotation) {
      logInfo('app.frontend.ui', 'annotation_edit_mode_activated', 'Annotation edit mode activated', {
        datasetId,
        imageId: imageData?.id,
        annotationId: annotation?.id,
        annotationLabel: annotation?.label,
        timestamp: new Date().toISOString()
      });
      setEditingAnnotation(annotation);
      setShowLabelPopup(true);
    }
  }, [activeTool, datasetId, imageData, shapeEditAnnotation]);

  const handleAnnotationDelete = useCallback(async (annotationId) => {
    try {
      logInfo('app.frontend.interactions', 'annotation_delete_started', 'Annotation deletion started', {
        datasetId,
        imageId: imageData?.id,
        annotationId,
        timestamp: new Date().toISOString()
      });
      console.log('Deleting annotation with ID:', annotationId);

      // Push current state to history before deleting annotation
      const currentSnapshot = JSON.parse(JSON.stringify(annotations));
      pushHistory(currentSnapshot);
      console.log('📚 History pushed before deleting annotation. History length:', historyPast.length + 1);

      await AnnotationAPI.deleteAnnotation(annotationId);

      // Update UI state
      setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
      setSelectedAnnotation(null);
      setEditingAnnotation(null);
      setShowLabelPopup(false);

      message.success('Annotation deleted');
      logInfo('app.frontend.interactions', 'annotation_delete_success', 'Annotation deleted successfully', {
        datasetId,
        imageId: imageData?.id,
        annotationId,
        timestamp: new Date().toISOString()
      });

      // Update label counts
      const deletedAnnotation = annotations.find(ann => ann.id === annotationId);
      if (deletedAnnotation) {
        setImageLabels(prev => prev.map(l =>
          l.name === deletedAnnotation.label ? { ...l, count: Math.max(0, l.count - 1) } : l
        ).filter(l => l.count > 0));
      }

      // Sync progress if this was the last annotation
      // Check length - 1 because we haven't updated annotations state yet with setAnnotations (which is async)
      // or check the current annotations array directly
      if (annotations.length === 1 && imageData?.is_labeled) {
        setDatasetProgress(prev => ({
          ...prev,
          labeled: Math.max(0, prev.labeled - 1),
          percentage: prev.total > 0 ? Math.round((Math.max(0, prev.labeled - 1) / prev.total) * 100) : 0
        }));
        setImageData(prev => ({ ...prev, is_labeled: false }));
        setImageList(prev => prev.map(img => img.id === imageData.id ? { ...img, is_labeled: false } : img));
      }
    } catch (error) {
      logError('app.frontend.validation', 'annotation_delete_failed', 'Failed to delete annotation', error, {
        datasetId,
        imageId: imageData?.id,
        annotationId,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      message.error('Failed to delete annotation');
      console.error('Delete annotation error:', error);
    }
  }, [annotations, setAnnotations, setSelectedAnnotation, setEditingAnnotation, setShowLabelPopup, setImageLabels, datasetId, imageData, pushHistory, historyPast]);

  // Handle delete selected annotation from toolbox
  const handleDeleteSelected = useCallback(() => {
    if (!selectedAnnotation) {
      message.info('No annotation selected');
      return;
    }

    logInfo('app.frontend.interactions', 'delete_selected_started', 'Delete selected annotation started', {
      datasetId,
      imageId: imageData?.id,
      annotationId: selectedAnnotation.id,
      timestamp: new Date().toISOString()
    });

    handleAnnotationDelete(selectedAnnotation.id);
  }, [selectedAnnotation, handleAnnotationDelete, datasetId, imageData]);

  const handleSplitChange = useCallback(async (newSplit) => {
    try {
      logInfo('app.frontend.interactions', 'split_change_started', 'Image split change started', {
        datasetId,
        imageId: imageData?.id,
        oldSplit: currentSplit,
        newSplit,
        timestamp: new Date().toISOString()
      });
      // Use the split_section endpoint instead of split_type
      await AnnotationAPI.updateImageSplitSection(imageData.id, newSplit);
      setCurrentSplit(newSplit);
      setImageData(prev => ({ ...prev, split_section: newSplit }));
      message.success(`Image moved to ${newSplit} set`);
      logInfo('app.frontend.interactions', 'split_change_success', 'Image split changed successfully', {
        datasetId,
        imageId: imageData?.id,
        oldSplit: currentSplit,
        newSplit,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError('app.frontend.validation', 'split_change_failed', 'Failed to update image split', error, {
        datasetId,
        imageId: imageData?.id,
        oldSplit: currentSplit,
        newSplit,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      message.error('Failed to update split');
      console.error('Update split error:', error);
    }
  }, [imageData, datasetId, currentSplit]);

  const navigateToImage = useCallback((direction) => {
    logUserClick('ManualLabeling', 'image_navigation', {
      datasetId,
      currentImageId: imageData?.id,
      currentImageIndex,
      direction,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.navigation', 'image_navigation_started', 'Image navigation started', {
      datasetId,
      currentImageId: imageData?.id,
      currentImageIndex,
      direction,
      timestamp: new Date().toISOString()
    });

    const newIndex = direction === 'next' ?
      Math.min(currentImageIndex + 1, imageList.length - 1) :
      Math.max(currentImageIndex - 1, 0);

    if (newIndex !== currentImageIndex) {
      setCurrentImageIndex(newIndex);
      const newImage = imageList[newIndex];
      logInfo('app.frontend.navigation', 'image_navigation_completed', 'Image navigation completed', {
        datasetId,
        oldImageId: imageData?.id,
        newImageId: newImage?.id,
        oldIndex: currentImageIndex,
        newIndex,
        timestamp: new Date().toISOString()
      });
      navigate(
        `/annotate/${datasetId}/manual?imageId=${newImage.id}`,
        currentReturnTo ? { state: { returnTo: currentReturnTo } } : undefined
      );
    }
  }, [currentImageIndex, imageList, datasetId, navigate, imageData, currentReturnTo]);

  useEffect(() => {
    const handleArrowNavigation = (e) => {
      const targetTag = e.target?.tagName;
      const isTypingTarget =
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        e.target?.isContentEditable;

      if (isTypingTarget) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToImage('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToImage('next');
      }
    };

    document.addEventListener('keydown', handleArrowNavigation);
    return () => document.removeEventListener('keydown', handleArrowNavigation);
  }, [navigateToImage]);

  const handleBack = () => {
    logUserClick('ManualLabeling', 'back_button', {
      datasetId,
      imageId: imageData?.id,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.navigation', 'back_to_progress', 'Navigating back to annotation progress', {
      datasetId,
      imageId: imageData?.id,
      timestamp: new Date().toISOString()
    });
    // Go back to returnTo location (Retraining Mode) or annotation progress (Full Mode)
    navigate(currentReturnTo || `/annotate-progress/${datasetId}`);
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
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '4rem',
        borderBottom: '0.0625rem solid #002140',
        width: '100%',
        gap: '2rem',
        zIndex: 3000,
        flexShrink: 0
      }}>
        {/* Left Side: Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            type="text"
            size="middle"
            style={{ color: '#bdc3c7', fontSize: '1rem', flexShrink: 0 }}
          >
            Back
          </Button>
          <Divider type="vertical" style={{ height: '1.5rem', margin: 0, flexShrink: 0 }} />
          <Text strong style={{ fontSize: '1.125rem', color: '#bdc3c7', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {currentImageIndex + 1} / {imageList.length}
          </Text>
        </div>

        {/* Center Side: Image Navigation (Flexible) */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigateToImage('prev')}
            disabled={currentImageIndex === 0}
            size="middle"
            type="text"
            style={{ color: '#bdc3c7', flexShrink: 0 }}
          />

          <div style={{ minWidth: 0, textAlign: 'center' }}>
            <Text strong style={{
              fontSize: '1.25rem',
              color: '#fff',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              display: 'block'
            }}>
              {imageData?.filename || 'Loading...'}
            </Text>
          </div>

          <Button
            icon={<RightOutlined />}
            onClick={() => navigateToImage('next')}
            disabled={currentImageIndex === imageList.length - 1}
            size="middle"
            type="text"
            style={{ color: '#bdc3c7', flexShrink: 0 }}
          />
        </div>

        {/* Right Side: Status & Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '1.5rem',
          flexShrink: 0
        }}>
          <Tooltip title={`Dataset Progress: ${datasetProgress.labeled} of ${datasetProgress.total} images labeled.`} placement="bottom">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, cursor: 'help' }}>
              <InfoCircleOutlined style={{ color: '#3498db', fontSize: '1rem', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <Text style={{ fontSize: '0.8125rem', color: '#95a5a6', whiteSpace: 'nowrap', lineHeight: 1.2 }}>Progress</Text>
                <Progress
                  percent={datasetProgress.percentage}
                  size="small"
                  style={{ width: '5rem', margin: 0 }}
                  showInfo={false}
                />
              </div>
              <Text style={{ fontSize: '0.875rem', color: '#bdc3c7', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {datasetProgress.labeled}/{datasetProgress.total}
              </Text>
            </div>
          </Tooltip>

          <Button
            icon={<CopyOutlined />}
            onClick={openCopyLabelsModal}
            size="middle"
            style={{ flexShrink: 0 }}
          >
            Copy Labels
          </Button>

          <AnnotationSplitControl
            currentSplit={currentSplit}
            onSplitChange={handleSplitChange}
          />
        </div>
      </div>

      <Layout style={{ background: '#001529', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Labels */}
        <Sider
          width="13.75rem"
          style={{
            background: '#001529',
            borderRight: '1px solid #002140',
            overflow: 'auto',
            height: '100%'
          }}
        >
          <LabelSidebar
            projectLabels={projectLabels}
            imageAnnotations={annotations.filter(ann => (ann.class_name || ann.label || '').toLowerCase() !== 'null')}
            selectedLabel={selectedLabel}
            hiddenLabels={hiddenLabels}
            onLabelSelect={setSelectedLabel}
            onLabelHighlight={(labelName) => {
              // Highlight annotations with this label
              console.log('Highlight label:', labelName);
            }}
            onLabelVisibilityToggle={toggleLabelVisibility}
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
                annotations={canvasAnnotations}
                selectedAnnotation={selectedAnnotation}
                activeTool={activeTool}
                zoomLevel={zoomLevel}
                onShapeComplete={handleShapeComplete}
                onAnnotationSelect={handleAnnotationSelect}
                onAnnotationDelete={handleAnnotationDelete}
                onImagePositionChange={setImagePosition}
                onPolygonStateChange={handlePolygonStateChange}
                onToolChange={setActiveTool}
                onZoomChange={setZoomLevel}
                polygonEditMode={!!shapeEditAnnotation}
                editableAnnotation={shapeEditAnnotation}
                onPolygonEditChange={updatePolygonShapeDraft}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            )}
            {shapeEditAnnotation && (
              <div style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 2500,
                display: 'flex',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.72)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
              }}>
                <Button
                  type="primary"
                  size="small"
                  loading={shapeEditSaving}
                  onClick={savePolygonShapeEdit}
                >
                  Save Shape
                </Button>
                <Button
                  size="small"
                  disabled={shapeEditSaving}
                  onClick={cancelPolygonShapeEdit}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Content>

        {/* Right Sidebar - Tools */}
        <Sider
          width="4.25rem"
          style={{
            background: '#001529',
            borderLeft: '1px solid #002140',
            padding: '8px 0',
            height: '100%',
            position: 'relative',
            zIndex: 2000,
            pointerEvents: 'auto'
          }}
        >
          <AnnotationToolbox
            activeTool={activeTool}
            onToolChange={setActiveTool}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClearAll}
            canUndo={canUndo}
            canRedo={canRedo}
            onDeleteImage={handleDeleteImage}
            onMarkAsNull={handleMarkAsNull}
            isLabeledNull={annotations.some(ann => (ann.class_name || ann.label || '').toLowerCase() === 'null')}
            onDeleteSelected={handleDeleteSelected}
            selectedAnnotation={selectedAnnotation}
            annotations={annotations}
          />
        </Sider>
      </Layout>

      <Modal
        title="Copy Labels From Image"
        open={copyModalVisible}
        onCancel={() => {
          setCopyModalVisible(false);
          resetCopyLabelsState();
        }}
        width={copySourceMode === 'prediction' ? 920 : 900}
        okText={copySourceMode === 'prediction' ? 'Import Annotations' : 'Apply Labels'}
        okButtonProps={{
          disabled: copySourceMode === 'prediction'
            ? (!predictionImportPreview || predictionImportPreview.importRows.length === 0)
            : (isTargetMarkedNull || !selectedCopySizeMatches || copyPreviewAnnotations.length === 0),
          loading: copySourceMode === 'prediction' ? predictionImportApplying : copyApplying
        }}
        onOk={copySourceMode === 'prediction' ? applyPredictionImport : applyCopiedLabels}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Text strong>Copy source</Text>
            <Radio.Group
              value={copySourceMode}
              onChange={(event) => setCopySourceMode(event.target.value)}
              style={{ display: 'block', marginTop: 8 }}
              buttonStyle="solid"
            >
              <Radio.Button value="image">Image Labels</Radio.Button>
              <Radio.Button value="prediction">Prediction Results</Radio.Button>
            </Radio.Group>
          </div>

          {copySourceMode === 'image' && (
            <>
              <Alert
                type="info"
                showIcon
                message="Choose the exact labeled source image. Labels are only saved after Apply Labels."
              />

              {annotations.length > 0 && (
                <Alert
                  type={isTargetMarkedNull ? 'error' : 'warning'}
                  showIcon
                  message={isTargetMarkedNull
                    ? 'Current image is marked Null. Remove Null before copying labels.'
                    : 'Current image already has labels. Applying will add copied labels to the existing labels.'}
                />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Text strong>Source dataset / batch</Text>
                  <Select
                    value={copySourceDatasetId}
                    loading={copyLoading}
                    style={{ width: '100%', marginTop: 6 }}
                    placeholder="Select source dataset"
                    onChange={(value) => {
                      setCopySourceDatasetId(value);
                      loadCopySourceImages(value);
                    }}
                  >
                    {copyDatasets.map(dataset => (
                      <Option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text strong>Search source image</Text>
                  <Input
                    value={copySearchText}
                    onChange={(event) => setCopySearchText(event.target.value)}
                    placeholder="Type part of filename..."
                    allowClear
                    style={{ marginTop: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)', gap: 16 }}>
                <div style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: 12,
                  maxHeight: 360,
                  overflowY: 'auto'
                }}>
                  {filteredCopySourceImages.length === 0 ? (
                    <Empty description={copyLoading ? 'Loading labeled images...' : 'No labeled source images found'} />
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: 10
                    }}>
                      {filteredCopySourceImages.map(sourceImage => {
                        const sameSize = imageData && Number(sourceImage.width) === Number(imageData.width) && Number(sourceImage.height) === Number(imageData.height);
                        const selected = copySelectedImage?.id === sourceImage.id;
                        return (
                          <button
                            key={sourceImage.id}
                            type="button"
                            onClick={() => selectCopySourceImage(sourceImage)}
                            style={{
                              textAlign: 'left',
                              border: selected ? '2px solid #1677ff' : '1px solid #d9d9d9',
                              borderRadius: 8,
                              padding: 8,
                              background: selected ? '#e6f4ff' : '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{
                              height: 82,
                              borderRadius: 6,
                              overflow: 'hidden',
                              background: '#f5f5f5',
                              marginBottom: 6
                            }}>
                              {getImageDisplayUrl(sourceImage) && (
                                <img
                                  src={getImageDisplayUrl(sourceImage)}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              )}
                            </div>
                            <Text style={{
                              display: 'block',
                              fontSize: 12,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {sourceImage.filename}
                            </Text>
                            <Space size={4} wrap style={{ marginTop: 6 }}>
                              <Tag color="blue">{sourceImage.annotation_count} labels</Tag>
                              <Tag color={sameSize ? 'green' : 'red'}>
                                {sameSize ? 'Same size' : 'Different size'}
                              </Tag>
                            </Space>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                  <Text strong>Selected source</Text>
                  {!copySelectedImage ? (
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">Select a labeled source image to preview labels on the current image.</Text>
                    </div>
                  ) : (
                    <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 12 }}>
                      <Text>{copySelectedImage.filename}</Text>
                      <Text type="secondary">
                        Source: {copySelectedImage.width} x {copySelectedImage.height}
                      </Text>
                      <Text type="secondary">
                        Target: {imageData?.width} x {imageData?.height}
                      </Text>
                      <Tag color={selectedCopySizeMatches ? 'green' : 'red'}>
                        {selectedCopySizeMatches ? 'Safe to copy' : 'Blocked: image sizes differ'}
                      </Tag>
                      <Text type="secondary">
                        Preview labels: {copyPreviewAnnotations.length}
                      </Text>
                    </Space>
                  )}
                </div>
              </div>
            </>
          )}

          {copySourceMode === 'prediction' && (
            <>
              <Alert
                type="info"
                showIcon
                message="Import stored prediction detections as real manual annotations."
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Text strong>Training session</Text>
                  <Select
                    value={predictionImportTrainingId}
                    loading={predictionImportLoading}
                    style={{ width: '100%', marginTop: 6 }}
                    placeholder="Select training"
                    onChange={async (value) => {
                      setPredictionImportTrainingId(value);
                      await loadPredictionImportExperiments(value, predictionImportScope, predictionImportConflictMode);
                    }}
                  >
                    {predictionImportTrainings.map(training => (
                      <Option key={training.id} value={training.id}>
                        {training.name} {training.status ? `(${training.status})` : ''}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text strong>Prediction experiment</Text>
                  <Select
                    value={predictionImportExperimentId}
                    loading={predictionImportLoading}
                    style={{ width: '100%', marginTop: 6 }}
                    placeholder="Select prediction run"
                    onChange={async (value) => {
                      setPredictionImportExperimentId(value);
                      const experiment = predictionImportExperiments.find(exp => exp.id === value);
                      await buildPredictionImportPreview(experiment, predictionImportScope, predictionImportConflictMode);
                    }}
                  >
                    {predictionImportExperiments.map(experiment => (
                      <Option key={experiment.id} value={experiment.id}>
                        {experiment.name || 'Unnamed'} - {experiment.experiment_type === 'sahi_prediction' ? 'SAHI' : 'Prediction'}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Text strong>Import scope</Text>
                  <Select
                    value={predictionImportScope}
                    style={{ width: '100%', marginTop: 6 }}
                    onChange={async (value) => {
                      setPredictionImportScope(value);
                      const experiment = predictionImportExperiments.find(exp => exp.id === predictionImportExperimentId);
                      await buildPredictionImportPreview(experiment, value, predictionImportConflictMode);
                    }}
                  >
                    <Option value="current">Current image only</Option>
                    <Option value="all">All matching images in this dataset</Option>
                  </Select>
                </div>
                <div>
                  <Text strong>Existing labels</Text>
                  <Select
                    value={predictionImportConflictMode}
                    style={{ width: '100%', marginTop: 6 }}
                    onChange={async (value) => {
                      setPredictionImportConflictMode(value);
                      const experiment = predictionImportExperiments.find(exp => exp.id === predictionImportExperimentId);
                      await buildPredictionImportPreview(experiment, predictionImportScope, value);
                    }}
                  >
                    <Option value="skip">Skip images with labels</Option>
                    <Option value="append">Append to existing labels</Option>
                  </Select>
                </div>
              </div>

              {predictionImportConflictMode === 'skip' && (
                <Alert
                  type="success"
                  showIcon
                  message="Safe mode is active: images that already have labels will be skipped."
                />
              )}
              {predictionImportConflictMode === 'append' && (
                <Alert
                  type="warning"
                  showIcon
                  message="Append mode will add prediction annotations to images that already have labels."
                />
              )}

              {!predictionImportLoading && predictionImportTrainings.length === 0 && (
                <Empty description="No managed training sessions found for this project" />
              )}
              {!predictionImportLoading && predictionImportTrainingId && predictionImportExperiments.length === 0 && (
                <Empty description="No completed prediction or SAHI prediction experiments found for this training" />
              )}

              {predictionImportPreview && (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                      <Text type="secondary">Prediction Images</Text>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{predictionImportPreview.predictionImageCount}</div>
                    </div>
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                      <Text type="secondary">Matched Images</Text>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{predictionImportPreview.matchedCount}</div>
                    </div>
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                      <Text type="secondary">Skipped Labeled</Text>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{predictionImportPreview.skippedCount}</div>
                    </div>
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                      <Text type="secondary">Annotations To Import</Text>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{predictionImportPreview.importAnnotationCount}</div>
                    </div>
                  </div>

                  {predictionImportPreview.importRows.length === 0 ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="No annotations will be imported with the current settings."
                    />
                  ) : (
                    <div style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: 12,
                      maxHeight: 220,
                      overflowY: 'auto'
                    }}>
                      <Text strong>Ready to import</Text>
                      <div style={{ marginTop: 8 }}>
                        {predictionImportPreview.importRows.slice(0, 12).map(row => (
                          <div
                            key={row.image.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '6px 0',
                              borderBottom: '1px solid #f5f5f5'
                            }}
                          >
                            <Text ellipsis style={{ maxWidth: 420 }}>{row.image.filename || row.predictionKey}</Text>
                            <Space>
                              <Tag color={row.image.is_labeled ? 'orange' : 'green'}>
                                {row.image.is_labeled ? 'has labels' : 'unlabeled'}
                              </Tag>
                              <Tag color="blue">{row.annotationsToImport.length} detections</Tag>
                            </Space>
                          </div>
                        ))}
                        {predictionImportPreview.importRows.length > 12 && (
                          <Text type="secondary">+ {predictionImportPreview.importRows.length - 12} more images</Text>
                        )}
                      </div>
                    </div>
                  )}

                  {predictionImportPreview.unmatchedPredictionKeys.length > 0 && (
                    <Text type="secondary">
                      {predictionImportPreview.unmatchedPredictionKeys.length} prediction image(s) did not match images in this dataset.
                    </Text>
                  )}
                </Space>
              )}
            </>
          )}
        </Space>
      </Modal>

      {/* Label Selection Popup */}
      <LabelSelectionPopup
        visible={showLabelPopup}
        onCancel={() => {
          logUserClick('ManualLabeling', 'label_popup_cancel', {
            datasetId,
            imageId: imageData?.id,
            isEditing: !!editingAnnotation,
            timestamp: new Date().toISOString()
          });
          logInfo('app.frontend.ui', 'label_popup_cancelled', 'Label popup cancelled', {
            datasetId,
            imageId: imageData?.id,
            isEditing: !!editingAnnotation,
            timestamp: new Date().toISOString()
          });
          console.log('Cancel button clicked');
          setShowLabelPopup(false);
          setPendingShape(null);
          setEditingAnnotation(null);
        }}
        onConfirm={handleLabelAssignment}
        onDelete={editingAnnotation ? () => {
          logUserClick('ManualLabeling', 'label_popup_delete', {
            datasetId,
            imageId: imageData?.id,
            annotationId: editingAnnotation.id,
            annotationLabel: editingAnnotation.label,
            timestamp: new Date().toISOString()
          });
          logInfo('app.frontend.interactions', 'annotation_delete_from_popup', 'Annotation delete triggered from popup', {
            datasetId,
            imageId: imageData?.id,
            annotationId: editingAnnotation.id,
            annotationLabel: editingAnnotation.label,
            timestamp: new Date().toISOString()
          });
          console.log('Delete Image triggered');
          console.log('Annotation ID:', editingAnnotation.id);
          return handleAnnotationDelete(editingAnnotation.id);
        } : null}
        existingLabels={projectLabels}
        defaultLabel={editingAnnotation?.label || null}
        shapeType={(editingAnnotation?.type || pendingShape?.type || 'box')}
        isEditing={!!editingAnnotation}
        onEditShape={editingAnnotation?.type === 'polygon' ? startPolygonShapeEdit : null}
      />
    </Layout>
  );
};

export default ManualLabeling;
