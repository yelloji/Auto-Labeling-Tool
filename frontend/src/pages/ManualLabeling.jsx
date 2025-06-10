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

// Import our annotation components
import AnnotationCanvas from '../components/AnnotationToolset/AnnotationCanvas';
import AnnotationToolbox from '../components/AnnotationToolset/AnnotationToolbox';
import LabelSelectionPopup from '../components/AnnotationToolset/LabelSelectionPopup';
import LabelSidebar from '../components/AnnotationToolset/LabelSidebar';
import AnnotationSplitControl from '../components/AnnotationToolset/AnnotationSplitControl';
import AnnotationAPI from '../components/AnnotationToolset/AnnotationAPI';

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
    if (datasetId) {
      console.log('Loading initial data for dataset:', datasetId);
      loadDatasetImages();
      loadProjectLabels();
      
      // Set up periodic refresh of project labels
      const labelsRefreshInterval = setInterval(() => {
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
      console.log('Loading project labels for dataset ID:', datasetId);
      
      // CRITICAL: In this application, datasetId is actually the project ID
      const projectId = parseInt(datasetId);
      
      // CRITICAL: Make a direct API call to get labels
      console.log(`GET ${API_BASE}/projects/${projectId}/labels`);
      const response = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
      const apiLabels = Array.isArray(response.data) ? response.data : [];
      
      console.log('Loaded project labels from API:', apiLabels);
      
      if (apiLabels && apiLabels.length > 0) {
        // Transform to UI format
        const formattedLabels = apiLabels.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color || AnnotationAPI.generateLabelColor(label.name),
          count: label.count || 0, // Use count from API if available
          projectCount: label.count || 0 // Store project-wide count
        }));
        
        console.log('Formatted project labels:', formattedLabels);
        setProjectLabels(formattedLabels);
        
        // Store in local storage as backup
        localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(formattedLabels));
      } else {
        // If no labels from API, try to get from local storage
        const storedLabelsStr = localStorage.getItem(`project_labels_${datasetId}`);
        if (storedLabelsStr) {
          try {
            const storedLabels = JSON.parse(storedLabelsStr);
            console.log('Loaded project labels from local storage:', storedLabels);
            setProjectLabels(storedLabels);
            
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
          } catch (e) {
            console.error('Failed to parse stored labels:', e);
          }
        }
      }
    } catch (error) {
      console.error('Load project labels error:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Try to get from local storage as fallback
      const storedLabelsStr = localStorage.getItem(`project_labels_${datasetId}`);
      if (storedLabelsStr) {
        try {
          const storedLabels = JSON.parse(storedLabelsStr);
          console.log('Loaded project labels from local storage (fallback):', storedLabels);
          setProjectLabels(storedLabels);
        } catch (e) {
          console.error('Failed to parse stored labels:', e);
        }
      }
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
      const fetchedAnnotations = await AnnotationAPI.getImageAnnotations(image.id);
      console.log('Fetched annotations:', fetchedAnnotations);
      
      // Transform annotations for UI display
      const transformedAnnotations = fetchedAnnotations.map(ann => {
        console.log('Processing annotation:', ann);
        
        // CRITICAL: Determine the annotation type
        let annotationType = ann.type || 'box';
        if (ann.segmentation && Array.isArray(ann.segmentation) && ann.segmentation.length > 2) {
          annotationType = 'polygon';
          console.log('Detected polygon annotation with segmentation points:', ann.segmentation.length);
        }
        
        // Create UI-friendly annotation object
        const uiAnnotation = {
          id: ann.id,
          class_name: ann.class_name || ann.label,
          label: ann.class_name || ann.label,
          confidence: ann.confidence || 1.0,
          color: AnnotationAPI.generateLabelColor(ann.class_name || ann.label),
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
    
    // Automatically show the label popup when shape is completed
    setShowLabelPopup(true);
    
    console.log('🎯 Shape completed with type:', shapeCopy.type);
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
    // CRITICAL: First, ensure the label exists in the project labels
    // In this application, datasetId is actually the project ID
    console.log(`Saving label "${labelName}" to project ${datasetId}`);
    const savedLabel = await AnnotationAPI.saveProjectLabel(datasetId, {
      name: labelName,
      color: AnnotationAPI.generateLabelColor(labelName)
    });
    
    console.log('Label saved to project:', savedLabel);
    
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
    console.log('Saving annotation:', annotation);
    const response = await AnnotationAPI.saveAnnotation(annotation);
    console.log('Saved annotation response:', response);
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
    setAnnotations(prev => [...prev, uiAnnotation]);
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
      setDatasetProgress(prev => ({
        ...prev,
        labeled: prev.labeled + 1,
        percentage: Math.round(((prev.labeled + 1) / prev.total) * 100)
      }));
      setImageData(prev => ({ ...prev, is_labeled: true }));
    }
    message.success(`Annotation saved with label "${labelName}"`);
    
    // Refresh annotations from server to ensure we have the latest data
    setTimeout(async () => {
      try {
        const refreshedAnnotations = await AnnotationAPI.getImageAnnotations(imageData.id);
        console.log('Refreshed annotations from server:', refreshedAnnotations);
        
        // Transform refreshed annotations for UI display
        const refreshedTransformedAnnotations = refreshedAnnotations.map(ann => {
          // Create UI-friendly annotation object
          const refreshedUiAnnotation = {
            id: ann.id,
            class_name: ann.class_name || ann.label,
            label: ann.class_name || ann.label,
            confidence: ann.confidence || 1.0,
            color: AnnotationAPI.generateLabelColor(ann.class_name || ann.label),
            type: ann.type || 'box'
          };
          
          // Handle box annotations
          if (ann.x_min !== undefined && ann.y_min !== undefined && 
              ann.x_max !== undefined && ann.y_max !== undefined) {
            refreshedUiAnnotation.x = ann.x_min;
            refreshedUiAnnotation.y = ann.y_min;
            refreshedUiAnnotation.width = ann.x_max - ann.x_min;
            refreshedUiAnnotation.height = ann.y_max - ann.y_min;
          } else if (ann.x !== undefined && ann.y !== undefined && 
                    ann.width !== undefined && ann.height !== undefined) {
            refreshedUiAnnotation.x = ann.x;
            refreshedUiAnnotation.y = ann.y;
            refreshedUiAnnotation.width = ann.width;
            refreshedUiAnnotation.height = ann.height;
          }
          
          // Handle polygon annotations
          if (ann.type === 'polygon' && ann.segmentation) {
            refreshedUiAnnotation.points = ann.segmentation;
          }
          
          return refreshedUiAnnotation;
        });
        
        console.log('Transformed refreshed annotations for UI:', refreshedTransformedAnnotations);
        setAnnotations(refreshedTransformedAnnotations);
      } catch (error) {
        console.error('Failed to refresh annotations:', error);
      }
    }, 500); // Delay to ensure server has processed the save
    
  } catch (error) {
    message.error(`Failed to save annotation: ${error.message}`);
    console.error('Save annotation error:', error);
  } finally {
    setShowLabelPopup(false);
    // ✅ Delay clearing to allow canvas redraw to complete
    setTimeout(() => {
      setPendingShape(null);
    }, 100); // short delay is enough
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
        existingLabels={projectLabels}
        shapeType={pendingShape?.type || 'box'}
      />
    </Layout>
  );
};

export default ManualLabeling;