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
  
  // Image deletion handler
  const handleDeleteImage = async () => {
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
        navigate(`/annotate/${datasetId}/manual`);
        return;
      }
      const newIndex = Math.max(0, currentImageIndex - (currentImageIndex === newImageList.length ? 1 : 0));
      setCurrentImageIndex(newIndex);
      const newImage = newImageList[newIndex];
      navigate(`/annotate/${datasetId}/manual?imageId=${newImage.id}`);
    } catch (error) {
      message.error('Failed to delete image');
      console.error('Delete image error:', error);
    }
  };
  
  // Annotation state
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [activeTool, setActiveTool] = useState('box');
  const [zoomLevel, setZoomLevel] = useState(100);

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

  // State to track polygon drawing
  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);
  const [polygonPointsCount, setPolygonPointsCount] = useState(0);

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
      setAnnotations([]);
      setSelectedAnnotation(null);
      setEditingAnnotation(null);

      for (const ann of snapshot) {
        try { await AnnotationAPI.deleteAnnotation(ann.id); } catch (e) { console.error('Failed to delete', ann.id, e); }
      }

      setImageLabels([]);

      if (imageData?.is_labeled) {
        setDatasetProgress(prev => ({
          ...prev,
          labeled: Math.max(0, prev.labeled - 1),
          percentage: prev.total > 0 ? Math.round(((Math.max(0, prev.labeled - 1)) / prev.total) * 100) : 0
        }));
        setImageData(prev => ({ ...prev, is_labeled: false }));
      }

      message.success('Cleared all annotations');
    } catch (e) {
      console.error('Clear all failed', e);
      message.error('Failed to clear all annotations');
    }
  }, [annotations, imageData]);

  const loadDatasetImages = async () => {
    try {
      setLoading(true);
      logInfo('app.frontend.interactions', 'loading_dataset_images', 'Loading dataset images', {
        datasetId,
        timestamp: new Date().toISOString()
      });
      const response = await AnnotationAPI.getDatasetImages(datasetId);
      setImageList(response.images);
      setDatasetProgress({
        total: response.images.length,
        labeled: response.images.filter(img => img.is_labeled).length,
        percentage: response.images.length > 0 ? 
          Math.round((response.images.filter(img => img.is_labeled).length / response.images.length) * 100) : 0
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
      
      console.log(`🔍 DATASET ${datasetId} belongs to PROJECT ${projectId}`);
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
        logInfo('app.frontend.ui', 'no_api_labels_found', 'No labels found from API, checking local storage', {
          datasetId,
          projectId,
          timestamp: new Date().toISOString()
        });
        // If no labels from API, try to get from local storage (check both project and dataset ID)
        const storedLabelsStr = localStorage.getItem(`project_labels_${projectId}`) || 
                               localStorage.getItem(`project_labels_${datasetId}`);
        
        if (storedLabelsStr) {
          try {
            const storedLabels = JSON.parse(storedLabelsStr);
            console.log('Loaded project labels from local storage:', storedLabels);
            setProjectLabels(storedLabels);
            logInfo('app.frontend.ui', 'labels_loaded_from_storage', 'Project labels loaded from local storage', {
              datasetId,
              storedLabelCount: storedLabels.length,
              timestamp: new Date().toISOString()
            });
            
            // CRITICAL: Save these labels to the database one by one
            for (const label of storedLabels) {
              try {
                console.log(`Saving local label to database: ${label.name}`);
                await axios.post(`${API_BASE}/projects/${projectId}/labels`, {
                  name: label.name,
                  color: label.color || AnnotationAPI.generateLabelColor(label.name),
                  project_id: parseInt(projectId)
                });
              } catch (e) {
                console.error(`Failed to save local label to database: ${label.name}`, e);
              }
            }
            
            // After saving all labels, refresh from server to get IDs
            try {
              const refreshResponse = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
              const refreshedLabels = Array.isArray(refreshResponse.data) ? refreshResponse.data : [];
              
              if (refreshedLabels.length > 0) {
                const updatedLabels = refreshedLabels.map(label => ({
                  id: label.id,
                  name: label.name,
                  color: label.color || AnnotationAPI.generateLabelColor(label.name),
                  count: label.count || 0,
                  projectCount: label.count || 0,
                  project_id: projectId
                }));
                
                setProjectLabels(updatedLabels);
                localStorage.setItem(`project_labels_${projectId}`, JSON.stringify(updatedLabels));
                localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(updatedLabels));
              }
            } catch (refreshError) {
              console.error('Error refreshing labels after save:', refreshError);
            }
          } catch (e) {
            console.error('Failed to parse stored labels:', e);
          }
        }
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
      
      // Try to get from local storage as fallback, checking multiple possible keys
      const possibleKeys = [
        projectId ? `project_labels_${projectId}` : null,
        `project_labels_${datasetId}`
      ].filter(Boolean);
      
      console.log('Trying local storage keys:', possibleKeys);
      
      let storedLabels = null;
      
      // Try each possible key until we find stored labels
      for (const key of possibleKeys) {
        const storedLabelsStr = localStorage.getItem(key);
        if (storedLabelsStr) {
          try {
            storedLabels = JSON.parse(storedLabelsStr);
            console.log(`Loaded project labels from local storage key ${key}:`, storedLabels);
            break;
          } catch (e) {
            console.error(`Failed to parse stored labels from key ${key}:`, e);
          }
        }
      }
      
      if (storedLabels) {
        setProjectLabels(storedLabels);
      } else {
        console.warn('Could not load any project labels from local storage');
      }
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
      // Use split_section instead of split_type for train/val/test
      setCurrentSplit(image.split_section || 'train');
      
      // Load image URL
      const imageUrl = await AnnotationAPI.getImageUrl(image.id);
      setImageUrl(imageUrl);
      
      // Load annotations
      const fetchedAnnotations = await AnnotationAPI.getImageAnnotations(image.id);
      console.log('Fetched annotations:', fetchedAnnotations);
      logInfo('app.frontend.interactions', 'image_annotations_loaded', 'Image annotations loaded', {
        datasetId,
        imageId: image.id,
        annotationCount: fetchedAnnotations.length,
        timestamp: new Date().toISOString()
      });
      
      // Transform annotations for UI display
      const transformedAnnotations = fetchedAnnotations.map(ann => {
        console.log('Processing annotation:', ann);
        
        // CRITICAL: Determine the annotation type
        let annotationType = ann.type || 'box';
        if (ann.segmentation && Array.isArray(ann.segmentation) && ann.segmentation.length > 2) {
          annotationType = 'polygon';
          console.log('Detected polygon annotation with segmentation points:', ann.segmentation.length);
        }
        
        // CRITICAL: Get the correct label color from project labels
        const labelName = ann.class_name || ann.label;
        const existingProjectLabel = projectLabels.find(l => l.name === labelName);
        const labelColor = existingProjectLabel?.color || AnnotationAPI.generateLabelColor(labelName);
        
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
      
      // Extract unique labels from annotations
      const uniqueLabels = [...new Set(fetchedAnnotations.map(ann => ann.class_name || ann.label))]
        .filter(labelName => labelName) // Remove null/undefined labels
        .map(labelName => {
          const existingLabel = projectLabels.find(l => l.name === labelName);
          return existingLabel || {
            id: labelName,
            name: labelName,
            color: AnnotationAPI.generateLabelColor(labelName),
            count: fetchedAnnotations.filter(ann => (ann.class_name || ann.label) === labelName).length
          };
        });
      setImageLabels(uniqueLabels);
      
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
  }, [datasetId, activeTool]);

  const handleShapeComplete = useCallback(async (shape) => {
    console.log('🎯 handleShapeComplete called with shape:', shape);
    
    logInfo('app.frontend.interactions', 'shape_completed', 'Annotation shape completed', {
      datasetId,
      imageId: imageData?.id,
      shapeType: shape.type,
      timestamp: new Date().toISOString()
    });
    
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
  }, [datasetId, imageData]);

  const handleLabelAssignment = useCallback(async (labelName) => {
  // Check if we're editing an existing annotation or creating a new one
  const isEditing = !!editingAnnotation;
  
  logInfo('app.frontend.interactions', 'label_assignment_started', 'Label assignment started', {
    datasetId,
    imageId: imageData?.id,
    labelName,
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
  
  if (!labelName || typeof labelName !== 'string') {
    logError('app.frontend.validation', 'invalid_label_name', 'Invalid label name provided', null, {
      datasetId,
      imageId: imageData?.id,
      labelName,
      timestamp: new Date().toISOString()
    });
    console.error('Invalid label name:', labelName);
    throw new Error('Invalid label name');
  }
  
      if (isEditing) {
      logInfo('app.frontend.interactions', 'editing_existing_annotation', 'Editing existing annotation', {
        datasetId,
        imageId: imageData?.id,
        annotationId: editingAnnotation.id,
        oldLabel: editingAnnotation.label,
        newLabel: labelName,
        timestamp: new Date().toISOString()
      });
      console.log('Editing annotation with new label:', labelName, 'annotation:', editingAnnotation);
    } else {
      logInfo('app.frontend.interactions', 'creating_new_annotation', 'Creating new annotation', {
        datasetId,
        imageId: imageData?.id,
        labelName,
        shapeType: pendingShape?.type,
        timestamp: new Date().toISOString()
      });
      console.log('Assigning label:', labelName, 'to shape:', pendingShape);
    }
  
  try {
    // First, ensure the label exists in the project labels
    logInfo('app.frontend.interactions', 'saving_project_label', 'Saving project label', {
      datasetId,
      imageId: imageData?.id,
      labelName,
      timestamp: new Date().toISOString()
    });
    console.log(`Saving label "${labelName}" to dataset ${datasetId}`);
    const savedLabel = await AnnotationAPI.saveProjectLabel(datasetId, {
      name: labelName,
      color: AnnotationAPI.generateLabelColor(labelName)
    });
    
    console.log('Label saved to project:', savedLabel);
    logInfo('app.frontend.interactions', 'project_label_saved_success', 'Project label saved successfully', {
      datasetId,
      imageId: imageData?.id,
      labelName,
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
          label: labelName,
          class_name: labelName,
          color: savedLabel.color || AnnotationAPI.generateLabelColor(labelName)
        } : ann
      ));
      
      // Send update to API
      try {
        logInfo('app.frontend.interactions', 'updating_annotation_api', 'Updating annotation via API', {
          datasetId,
          imageId: imageData?.id,
          annotationId: editingAnnotation.id,
          newLabel: labelName,
          timestamp: new Date().toISOString()
        });
        await AnnotationAPI.updateAnnotation(editingAnnotation.id, {
          class_name: labelName
        });
        
        message.success(`Annotation updated to "${labelName}"`);
        logInfo('app.frontend.interactions', 'annotation_update_success', 'Annotation updated successfully', {
          datasetId,
          imageId: imageData?.id,
          annotationId: editingAnnotation.id,
          newLabel: labelName,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logError('app.frontend.validation', 'annotation_update_failed', 'Failed to update annotation', error, {
          datasetId,
          imageId: imageData?.id,
          annotationId: editingAnnotation.id,
          newLabel: labelName,
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
      class_name: labelName,
      label: labelName,
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
      labelName,
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
      labelName,
      timestamp: new Date().toISOString()
    });
    const savedAnnotation = response.annotation || response;
    // Create UI-friendly annotation object
    const uiAnnotation = {
      id: savedAnnotation.id,
      class_name: savedAnnotation.class_name || savedAnnotation.label,
      label: savedAnnotation.class_name || savedAnnotation.label,
      confidence: savedAnnotation.confidence || 1.0,
      color: savedLabel.color || AnnotationAPI.generateLabelColor(labelName)
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
    const existingProjectLabel = projectLabels.find(l => l.name === labelName);
    
    // Check if the label already exists in the image
    const existingImageLabel = imageLabels.find(l => l.name === labelName);
    
    // Generate a consistent color for the label
    const labelColor = existingProjectLabel?.color || 
                      AnnotationAPI.generateLabelColor(labelName);
    
    // Update image labels
    if (existingImageLabel) {
      // Update the count for the existing label
      setImageLabels(prev => prev.map(l => 
        l.name === labelName ? { ...l, count: l.count + 1 } : l
      ));
    } else {
      const newImageLabel = {
        id: existingProjectLabel?.id || labelName,
        name: labelName,
        color: labelColor,
        count: 1
      };
      setImageLabels(prev => [...prev, newImageLabel]);
    }
    
    // Update project labels if needed
    if (!existingProjectLabel) {
      const newProjectLabel = {
        id: labelName,
        name: labelName,
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
        l.name === labelName ? { ...l, count: l.count + 1, projectCount: (l.projectCount || 0) + 1 } : l
      ));
    }
    
    // CRITICAL: Make sure the label is saved to the database and updated in UI
    try {
      console.log('UPDATING PROJECT LABELS with label:', labelName);
      
      // CRITICAL: Get the project ID from the dataset ID
      // In this application, datasetId is actually the project ID
      const projectId = parseInt(datasetId);
      
      // Force save the label to the database again to ensure it's there
      const projectLabel = {
        name: labelName,
        color: labelColor, // Use the labelColor we defined earlier
        project_id: parseInt(projectId)
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
      const existingProjectLabel = projectLabels.find(l => 
        l.name.toLowerCase() === labelName.toLowerCase()
      );
      
      if (!existingProjectLabel) {
        // Add the new label to project labels UI state
        const newProjectLabel = {
          id: (savedLabelFromDb && savedLabelFromDb.id) || Date.now(),
          name: labelName,
          color: (savedLabelFromDb && savedLabelFromDb.color) || labelColor,
          count: 1
        };
        
        console.log('ADDING NEW PROJECT LABEL TO UI STATE:', newProjectLabel);
        setProjectLabels(prev => [...prev, newProjectLabel]);
      } else {
        // Update existing label count
        console.log('UPDATING EXISTING PROJECT LABEL COUNT:', existingProjectLabel);
        setProjectLabels(prev => prev.map(l => 
          l.name.toLowerCase() === labelName.toLowerCase() 
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
      const existingProjectLabel = projectLabels.find(l => 
        l.name.toLowerCase() === labelName.toLowerCase()
      );
      
      if (!existingProjectLabel) {
        // Add the new label to project labels
        const newProjectLabel = {
          id: savedLabel.id || Date.now(),
          name: labelName,
          color: savedLabel.color || AnnotationAPI.generateLabelColor(labelName),
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
    }
    message.success(`Annotation saved with label "${labelName}"`);
    logInfo('app.frontend.interactions', 'annotation_complete', 'Annotation process completed', {
      datasetId,
      imageId: imageData?.id,
      labelName,
      annotationType: pendingShape?.type,
      timestamp: new Date().toISOString()
    });
    
    // Note: Removed server refresh that was breaking undo/redo history chain
    // The annotation is already added to UI state above, no need to refresh from server
    
  } catch (error) {
    logError('app.frontend.validation', 'annotation_save_failed', 'Failed to save annotation', error, {
      datasetId,
      imageId: imageData?.id,
      labelName,
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
}, [pendingShape, imageData, datasetId, imageLabels, editingAnnotation, annotations, pushHistory, historyPast]);

  const handleAnnotationSelect = useCallback((annotation) => {
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
  }, [activeTool, datasetId, imageData]);

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
      navigate(`/annotate/${datasetId}/manual?imageId=${newImage.id}`);
    }
  }, [currentImageIndex, imageList, datasetId, navigate, imageData]);

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
            projectLabels={projectLabels} 
            imageAnnotations={annotations}
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
                onPolygonStateChange={handlePolygonStateChange}
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
            onDeleteSelected={handleDeleteSelected}
            selectedAnnotation={selectedAnnotation}
            annotations={annotations}
          />
        </Sider>
      </Layout>

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
      />
    </Layout>
  );
};

export default ManualLabeling;
