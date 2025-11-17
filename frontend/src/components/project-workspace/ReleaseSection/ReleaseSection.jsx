


import { projectsAPI } from '../../../services/api';
import { API_BASE_URL } from '../../../config';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Button, Space, Row, Col, Card, message, Modal, Tag, Spin, Alert, InputNumber, Progress } from 'antd';
import { RocketOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';

// Import all the components we've built
import { DatasetStats, ReleaseConfigPanel, ReleaseHistoryList, DownloadModal, ReleaseDetailsView } from './';

// Import the new TransformationSection component
import TransformationSection from './TransformationSection';

// Import CSS for styling
import './ReleaseSection.css';
import './TransformationComponents.css';

const { Content } = Layout;

// AnnotatedImageCard component for displaying images with annotations
const AnnotatedImageCard = ({ image }) => {
  const [annotations, setAnnotations] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 180, height: 120 });

  useEffect(() => {
    const loadAnnotations = async () => {
      if (image.id) {
        logInfo('app.frontend.interactions', 'load_image_annotations_started', 'Loading image annotations started', {
          timestamp: new Date().toISOString(),
          imageId: image.id,
          imageFilename: image.filename,
          function: 'loadAnnotations'
        });

        try {
          const response = await fetch(`http://localhost:12000/api/v1/images/${image.id}/annotations`);
          const annotationData = await response.json();
          console.log(`Annotations for image ${image.filename}:`, annotationData);
          
          logInfo('app.frontend.interactions', 'load_image_annotations_success', 'Image annotations loaded successfully', {
            timestamp: new Date().toISOString(),
            imageId: image.id,
            imageFilename: image.filename,
            annotationsCount: annotationData?.length || 0,
            function: 'loadAnnotations'
          });
          
          setAnnotations(annotationData || []);
        } catch (error) {
          logError('app.frontend.interactions', 'load_image_annotations_failed', 'Failed to load image annotations', {
            timestamp: new Date().toISOString(),
            imageId: image.id,
            imageFilename: image.filename,
            error: error.message,
            function: 'loadAnnotations'
          });
          console.error('Error loading annotations:', error);
          setAnnotations([]);
        }
      } else {
        logError('app.frontend.validation', 'load_image_annotations_no_id', 'Cannot load annotations - no image ID', {
          timestamp: new Date().toISOString(),
          image: image,
          function: 'loadAnnotations'
        });
      }
    };

    loadAnnotations();
  }, [image.id, image]);

  const imageUrl = `http://localhost:12000/api/images/${image.id}`;

  return (
    <div style={{ 
      border: '1px solid #e8e8e8', 
      borderRadius: '8px', 
      overflow: 'hidden',
      backgroundColor: '#fafafa'
    }}>
      <div style={{ position: 'relative', width: '100%', height: '120px', display: 'flex', justifyContent: 'center' }}>
        <img
          src={imageUrl}
          alt={image.filename || image.name}
          style={{ 
            width: '100%', 
            height: '120px',
            objectFit: 'cover',
            borderRadius: '6px',
            display: imageLoaded ? 'block' : 'none'
          }}
          onLoad={(e) => {
            setImageLoaded(true);
            setImageDimensions({
              width: e.target.naturalWidth,
              height: e.target.naturalHeight
            });
            
            logInfo('app.frontend.ui', 'image_loaded_successfully', 'Image loaded successfully', {
              timestamp: new Date().toISOString(),
              imageId: image.id,
              imageFilename: image.filename,
              naturalWidth: e.target.naturalWidth,
              naturalHeight: e.target.naturalHeight,
              function: 'onLoad'
            });
          }}
          onError={(e) => {
            logError('app.frontend.ui', 'image_load_failed', 'Image failed to load', {
              timestamp: new Date().toISOString(),
              imageId: image.id,
              imageFilename: image.filename,
              imageUrl: imageUrl,
              function: 'onError'
            });
          }}
        />
        
        {/* Loading placeholder */}
        {!imageLoaded && (
          <div style={{
            width: '100%',
            height: '120px',
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999'
          }}>
            <Spin size="small" />
          </div>
        )}

        {/* Annotation overlay */}
        {imageLoaded && annotations.length > 0 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '120px',
              pointerEvents: 'none'
            }}
            viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
            preserveAspectRatio="xMidYMid slice"
          >
            {annotations.map((annotation, index) => {
              console.log(`Processing annotation ${index}:`, annotation);
              
              // Check if annotation has segmentation data (polygon)
              if (annotation.segmentation && annotation.segmentation.length > 0) {
                console.log(`Found polygon annotation with segmentation:`, annotation.segmentation);
                
                let points = annotation.segmentation;
                let pointsString = '';
                
                // Parse JSON string if needed
                if (typeof points === 'string') {
                  try {
                    points = JSON.parse(points);
                  } catch (e) {
                    logError('app.frontend.ui', 'annotation_parse_failed', 'Failed to parse annotation segmentation JSON', {
                      timestamp: new Date().toISOString(),
                      imageId: image.id,
                      annotationIndex: index,
                      annotationId: annotation.id,
                      error: e.message,
                      function: 'annotation_processing'
                    });
                    console.error('Failed to parse segmentation JSON:', e);
                    return null;
                  }
                }
                
                // Handle different segmentation formats
                if (Array.isArray(points)) {
                  if (points.length > 0 && typeof points[0] === 'object' && points[0].x !== undefined) {
                    // Format: [{"x": 102, "y": 123}, {"x": 105, "y": 111}, ...] - array of objects
                    pointsString = points.map(point => `${point.x},${point.y}`).join(' ');
                    console.log(`Generated polygon points from objects:`, pointsString);
                  } else if (Array.isArray(points[0])) {
                    // Format: [[x1,y1,x2,y2,...]] - nested array
                    pointsString = points[0].reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  } else {
                    // Format: [x1,y1,x2,y2,...] - flat array
                    pointsString = points.reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  }
                }

                if (pointsString) {
                  // Get first point for label positioning
                  const firstPoint = points[0];
                  const labelX = typeof firstPoint === 'object' ? firstPoint.x : points[0];
                  const labelY = typeof firstPoint === 'object' ? firstPoint.y : points[1];
                  
                  return (
                    <g key={`polygon-${annotation.id || index}`}>
                      <polygon
                        points={pointsString}
                        fill="rgba(52, 196, 26, 0.3)"
                        stroke="#34c426"
                        strokeWidth="2"
                        strokeDasharray="none"
                      />
                      {annotation.class_name && (
                        <text
                          x={labelX || 10}
                          y={(labelY || 10) - 5}
                          fill="#34c426"
                          fontSize="16"
                          fontWeight="bold"
                          textAnchor="start"
                          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}
                        >
                          {annotation.class_name}
                        </text>
                      )}
                    </g>
                  );
                }
              }
              
              // Also check for type === 'polygon' with segmentation
              if (annotation.type === 'polygon' && annotation.segmentation) {
                console.log(`Found type=polygon annotation:`, annotation);
                
                const points = annotation.segmentation;
                let pointsString = '';
                
                if (Array.isArray(points)) {
                  if (Array.isArray(points[0])) {
                    pointsString = points[0].reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  } else {
                    pointsString = points.reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  }
                }

                if (pointsString) {
                  return (
                    <g key={`polygon-type-${annotation.id || index}`}>
                      <polygon
                        points={pointsString}
                        fill="rgba(52, 196, 26, 0.2)"
                        stroke="#34c426"
                        strokeWidth="2"
                        strokeDasharray="none"
                      />
                      {annotation.class_name && (
                        <text
                          x={points[0] || 10}
                          y={(points[1] || 10) - 5}
                          fill="#34c426"
                          fontSize="16"
                          fontWeight="bold"
                          textAnchor="start"
                        >
                          {annotation.class_name}
                        </text>
                      )}
                    </g>
                  );
                }
              }
              
              // Handle normalized bounding box coordinates
              if (annotation.x_min !== undefined && annotation.y_min !== undefined && 
                  annotation.x_max !== undefined && annotation.y_max !== undefined) {
                // Convert normalized coordinates to pixel coordinates
                const imageWidth = image.width || imageDimensions.width;
                const imageHeight = image.height || imageDimensions.height;
                
                const x = annotation.x_min * imageWidth;
                const y = annotation.y_min * imageHeight;
                const width = (annotation.x_max - annotation.x_min) * imageWidth;
                const height = (annotation.y_max - annotation.y_min) * imageHeight;
                
                return (
                  <g key={`box-${annotation.id || index}`}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="rgba(255, 77, 79, 0.2)"
                      stroke="#ff4d4f"
                      strokeWidth="2"
                      strokeDasharray="none"
                    />
                    {annotation.class_name && (
                      <text
                        x={x + 5}
                        y={y - 5}
                        fill="#ff4d4f"
                        fontSize="40"
                        fontWeight="bold"
                        textAnchor="start"
                      >
                        {annotation.class_name}
                      </text>
                    )}
                  </g>
                );
              }
              
              // Legacy format support - if annotation has x, y, width, height directly
              if (annotation.x !== undefined && annotation.y !== undefined && 
                  annotation.width !== undefined && annotation.height !== undefined) {
                return (
                  <g key={`legacy-box-${annotation.id || index}`}>
                    <rect
                      x={annotation.x}
                      y={annotation.y}
                      width={annotation.width}
                      height={annotation.height}
                      fill="rgba(255, 77, 79, 0.2)"
                      stroke="#ff4d4f"
                      strokeWidth="2"
                      strokeDasharray="none"
                    />
                    {annotation.class_name && (
                      <text
                        x={annotation.x + 5}
                        y={annotation.y - 5}
                        fill="#ff4d4f"
                        fontSize="40"
                        fontWeight="bold"
                        textAnchor="start"
                      >
                        {annotation.class_name}
                      </text>
                    )}
                  </g>
                );
              }
              
              return null;
            })}
          </svg>
        )}
      </div>
      
      <div style={{ padding: '8px', fontSize: '12px' }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {image.filename}
        </div>
        <div style={{ color: '#666' }}>
          {image.width}x{image.height}
        </div>
        <div style={{ color: image.is_labeled ? '#52c41a' : '#ff4d4f' }}>
          {image.is_labeled ? '✓ Labeled' : '✗ Unlabeled'}
        </div>
        {annotations.length > 0 && (
          <div style={{ color: '#1890ff', fontSize: '11px' }}>
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

const ReleaseSection = ({ projectId, datasetId }) => {
  // State management
  const [transformations, setTransformations] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [showReleaseConfig, setShowReleaseConfig] = useState(false); // New state to control Release Config visibility
  const [currentReleaseVersion, setCurrentReleaseVersion] = useState(null); // Shared release version state
  const [transformationKey, setTransformationKey] = useState(0); // Force refresh transformation section
  const [datasetDetailsModal, setDatasetDetailsModal] = useState({
    visible: false,
    dataset: null,
    images: [],
    splitStats: null,
    loading: false
  });
  const [datasetRebalanceModal, setDatasetRebalanceModal] = useState({
    visible: false,
    dataset: null,
    trainCount: 0,
    valCount: 0,
    testCount: 0,
    totalImages: 0,
    loading: false
  });

  // Download Modal State
  const [downloadModal, setDownloadModal] = useState({
    isOpen: false,
    release: null,
    isExporting: false,
    exportProgress: null
  });

  // Release Details View State
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [showReleaseDetails, setShowReleaseDetails] = useState(false);
  const [releaseImages, setReleaseImages] = useState([]);
  const [releaseLoading, setReleaseLoading] = useState(false);

  // Function to fetch datasets
  const fetchDatasets = useCallback(async () => {
    logInfo('app.frontend.interactions', 'fetch_datasets_started', 'Fetching project datasets started', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      function: 'fetchDatasets'
    });

    try {
      const response = await projectsAPI.getProjectManagementData(projectId);
      console.log("Management data response:", response);
      
      // The API returns response.dataset.datasets for completed datasets
      const completedDatasets = response?.dataset?.datasets || [];
      console.log("Filtered completed datasets only:", completedDatasets);
      
      logInfo('app.frontend.interactions', 'fetch_datasets_success', 'Project datasets fetched successfully', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        completedDatasetsCount: completedDatasets.length,
        function: 'fetchDatasets'
      });
      
      setSelectedDatasets(completedDatasets);
    } catch (error) {
      logError('app.frontend.interactions', 'fetch_datasets_failed', 'Failed to fetch project datasets', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        error: error.message,
        function: 'fetchDatasets'
      });
      console.error("Failed to load datasets:", error);
      message.error("Failed to load datasets");
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      logInfo('app.frontend.ui', 'release_section_initialized', 'ReleaseSection component initialized', {
        timestamp: new Date().toISOString(),
        component: 'ReleaseSection',
        projectId: projectId,
        datasetId: datasetId,
        function: 'useEffect'
      });

      fetchDatasets();
    } else {
      logError('app.frontend.validation', 'release_section_no_project_id', 'ReleaseSection initialized without projectId', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: datasetId,
        function: 'useEffect'
      });
    }
  }, [projectId, datasetId, fetchDatasets]);

  // Monitor transformationKey changes to ensure proper refresh
  useEffect(() => {
    if (transformationKey > 0) {
      logInfo('app.frontend.ui', 'transformation_section_refreshed', 'Transformation section refreshed', {
        timestamp: new Date().toISOString(),
        transformationKey: transformationKey,
        function: 'useEffect'
      });
      console.log('🔄 Transformation section refreshed with key:', transformationKey);
    }
  }, [transformationKey]);

  // Function to handle viewing dataset details
  const handleViewDatasetDetails = async (dataset) => {
    logUserClick('view_dataset_details_button_clicked', 'User clicked view dataset details button');
    logInfo('app.frontend.interactions', 'view_dataset_details_started', 'Viewing dataset details started', {
      timestamp: new Date().toISOString(),
      datasetId: dataset.id,
      datasetName: dataset.name,
      function: 'handleViewDatasetDetails'
    });

    setDatasetDetailsModal({
      visible: true,
      dataset: dataset,
      images: [],
      splitStats: null,
      loading: true
    });

    try {
      // Fetch dataset images
      const imagesResponse = await fetch(`http://localhost:12000/api/v1/datasets/${dataset.id}`);
      const imagesData = await imagesResponse.json();
      
      // Fetch split statistics
      const splitResponse = await fetch(`http://localhost:12000/api/v1/datasets/${dataset.id}/split-stats`);
      const splitData = await splitResponse.json();

      logInfo('app.frontend.interactions', 'dataset_details_loaded_success', 'Dataset details loaded successfully', {
        timestamp: new Date().toISOString(),
        datasetId: dataset.id,
        datasetName: dataset.name,
        imagesCount: imagesData.recent_images?.length || 0,
        hasSplitStats: !!splitData,
        function: 'handleViewDatasetDetails'
      });

      setDatasetDetailsModal(prev => ({
        ...prev,
        images: imagesData.recent_images || [],
        splitStats: splitData,
        loading: false
      }));
    } catch (error) {
      logError('app.frontend.interactions', 'dataset_details_load_failed', 'Failed to load dataset details', {
        timestamp: new Date().toISOString(),
        datasetId: dataset.id,
        datasetName: dataset.name,
        error: error.message,
        function: 'handleViewDatasetDetails'
      });
      console.error('Error fetching dataset details:', error);
      message.error('Failed to load dataset details');
      setDatasetDetailsModal(prev => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Function to close dataset details modal
  const handleCloseDatasetDetails = () => {
    logUserClick('close_dataset_details_button_clicked', 'User clicked close dataset details button');
    logInfo('app.frontend.ui', 'dataset_details_modal_closed', 'Dataset details modal closed', {
      timestamp: new Date().toISOString(),
      function: 'handleCloseDatasetDetails'
    });

    setDatasetDetailsModal({
      visible: false,
      dataset: null,
      images: [],
      splitStats: null,
      loading: false
    });
  };

  // Function to handle dataset rebalance
  const handleDatasetRebalance = (dataset, splitStats) => {
    logUserClick('dataset_rebalance_button_clicked', 'User clicked dataset rebalance button');
    logInfo('app.frontend.interactions', 'dataset_rebalance_started', 'Dataset rebalance started', {
      timestamp: new Date().toISOString(),
      datasetId: dataset.id,
      datasetName: dataset.name,
      currentTrain: splitStats.train || 0,
      currentVal: splitStats.val || 0,
      currentTest: splitStats.test || 0,
      totalImages: splitStats.total_images || 0,
      function: 'handleDatasetRebalance'
    });

    const totalImages = splitStats.total_images || 0;
    setDatasetRebalanceModal({
      visible: true,
      dataset: dataset,
      trainCount: splitStats.train || 0,
      valCount: splitStats.val || 0,
      testCount: splitStats.test || 0,
      totalImages: totalImages,
      loading: false
    });
  };

  // Function to save dataset rebalance
  const handleSaveDatasetRebalance = async () => {
    logUserClick('save_dataset_rebalance_button_clicked', 'User clicked save dataset rebalance button');
    logInfo('app.frontend.interactions', 'save_dataset_rebalance_started', 'Saving dataset rebalance started', {
      timestamp: new Date().toISOString(),
      datasetId: datasetRebalanceModal.dataset?.id,
      datasetName: datasetRebalanceModal.dataset?.name,
      trainCount: datasetRebalanceModal.trainCount,
      valCount: datasetRebalanceModal.valCount,
      testCount: datasetRebalanceModal.testCount,
      totalImages: datasetRebalanceModal.totalImages,
      function: 'handleSaveDatasetRebalance'
    });

    const { dataset, trainCount, valCount, testCount, totalImages } = datasetRebalanceModal;

    const totalCount = trainCount + valCount + testCount;
    if (totalCount !== totalImages) {
      logError('app.frontend.validation', 'dataset_rebalance_total_mismatch', 'Dataset rebalance total count mismatch', {
        timestamp: new Date().toISOString(),
        datasetId: dataset?.id,
        datasetName: dataset?.name,
        totalCount: totalCount,
        totalImages: totalImages,
        difference: totalImages - totalCount,
        function: 'handleSaveDatasetRebalance'
      });
      message.error(`Total images must equal ${totalImages}. Current total: ${totalCount}`);
      return;
    }

    try {
      setDatasetRebalanceModal(prev => ({ ...prev, loading: true }));

      const requestData = {
        train_count: trainCount,
        val_count: valCount,
        test_count: testCount
      };

      const response = await fetch(`http://localhost:12000/api/v1/datasets/${dataset.id}/rebalance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Failed to rebalance dataset ${dataset.name}`);
      }

      const result = await response.json();
      console.log(`Dataset ${dataset.name} rebalanced:`, result);
      
      logInfo('app.frontend.interactions', 'dataset_rebalance_success', 'Dataset rebalance completed successfully', {
        timestamp: new Date().toISOString(),
        datasetId: dataset.id,
        datasetName: dataset.name,
        trainCount: trainCount,
        valCount: valCount,
        testCount: testCount,
        function: 'handleSaveDatasetRebalance'
      });
      
      message.success(`Dataset "${dataset.name}" rebalanced successfully!`);

      // Close modal
      setDatasetRebalanceModal({
        visible: false,
        dataset: null,
        trainCount: 0,
        valCount: 0,
        testCount: 0,
        totalImages: 0,
        loading: false
      });

      // Refresh stats + UI
      if (datasetDetailsModal.visible && datasetDetailsModal.dataset) {
        handleViewDatasetDetails(datasetDetailsModal.dataset);
      }
      fetchDatasets();

    } catch (error) {
      logError('app.frontend.interactions', 'dataset_rebalance_failed', 'Failed to rebalance dataset', {
        timestamp: new Date().toISOString(),
        datasetId: dataset?.id,
        datasetName: dataset?.name,
        error: error.message,
        function: 'handleSaveDatasetRebalance'
      });
      console.error('Error rebalancing dataset:', error);
      message.error(`Failed to rebalance dataset: ${error.message}`);
    } finally {
      setDatasetRebalanceModal(prev => ({ ...prev, loading: false }));
    }
  };


  // Function to cancel dataset rebalance
  const handleCancelDatasetRebalance = () => {
    logUserClick('cancel_dataset_rebalance_button_clicked', 'User clicked cancel dataset rebalance button');
    logInfo('app.frontend.ui', 'dataset_rebalance_cancelled', 'Dataset rebalance cancelled', {
      timestamp: new Date().toISOString(),
      datasetId: datasetRebalanceModal.dataset?.id,
      datasetName: datasetRebalanceModal.dataset?.name,
      function: 'handleCancelDatasetRebalance'
    });

    setDatasetRebalanceModal({
      visible: false,
      dataset: null,
      trainCount: 0,
      valCount: 0,
      testCount: 0,
      totalImages: 0,
      loading: false
    });
  };

  // Function to handle count changes in dataset rebalance modal
  const handleDatasetCountChange = (value, type) => {
    const newValue = Math.max(0, Math.min(value || 0, datasetRebalanceModal.totalImages));
    
    logInfo('app.frontend.ui', 'dataset_count_changed', 'Dataset split count changed', {
      timestamp: new Date().toISOString(),
      datasetId: datasetRebalanceModal.dataset?.id,
      datasetName: datasetRebalanceModal.dataset?.name,
      splitType: type,
      oldValue: datasetRebalanceModal[type === 'train' ? 'trainCount' : type === 'val' ? 'valCount' : 'testCount'],
      newValue: newValue,
      totalImages: datasetRebalanceModal.totalImages,
      function: 'handleDatasetCountChange'
    });
    
    setDatasetRebalanceModal(prev => ({
      ...prev,
      [type === 'train' ? 'trainCount' : type === 'val' ? 'valCount' : 'testCount']: newValue
    }));
  };



  // Release handlers
  const handlePreviewRelease = (previewData) => {
    logUserClick('preview_release_button_clicked', 'User clicked preview release button');
    logInfo('app.frontend.interactions', 'preview_release_started', 'Release preview started', {
      timestamp: new Date().toISOString(),
      previewData: previewData,
      function: 'handlePreviewRelease'
    });

    console.log('Preview data:', previewData);
    message.info('Release preview generated');
  };

  const handleContinueToReleaseConfig = () => {
    logUserClick('continue_to_release_config_button_clicked', 'User clicked continue to release config button');
    logInfo('app.frontend.navigation', 'continue_to_release_config_triggered', 'Continue to release configuration triggered', {
      timestamp: new Date().toISOString(),
      transformationsCount: transformations.length,
      selectedDatasetsCount: selectedDatasets.length,
      function: 'handleContinueToReleaseConfig'
    });

    // Force refresh by temporarily hiding then showing the config panel
    setShowReleaseConfig(false);
    
    // Use setTimeout to ensure the state update is processed
    setTimeout(() => {
      setShowReleaseConfig(true);
      
      // Scroll to the Release Configuration section after rendering
      setTimeout(() => {
        const releaseConfigElement = document.querySelector('.release-config-panel, [data-testid="release-config-panel"]');
        if (releaseConfigElement) {
          releaseConfigElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        } else {
          // Fallback: scroll to a reasonable position
          window.scrollTo({ 
            top: window.innerHeight, 
            behavior: 'smooth' 
          });
        }
      }, 100);
      
      message.success('Release configuration updated with latest transformations!');
    }, 50); // Small delay to ensure state change is processed
  };

  const handleCreateRelease = async (releaseConfig) => {
    logUserClick('create_release_button_clicked', 'User clicked create release button');
    logInfo('app.frontend.interactions', 'create_release_started', 'Release creation started', {
      timestamp: new Date().toISOString(),
      releaseName: releaseConfig.name,
      selectedDatasetsCount: releaseConfig.selectedDatasets?.length || 0,
      transformationsCount: transformations?.length || 0,
      multiplier: releaseConfig.multiplier,
      exportFormat: releaseConfig.exportFormat,
      taskType: releaseConfig.taskType,
      function: 'handleCreateRelease'
    });

    try {
      // Show loading message
      const loadingMessage = message.loading('Creating release...', 0);
      
      // Normalize transformations from UI shape to backend `{ type, params }`
      const normalizedTransformations = (transformations || [])
        .map((t) => {
          // Case 1: already normalized
          if (t && t.type && t.params) {
            return { type: t.type, params: { ...t.params } };
          }
          // Case 2: saved UI object with `config: { [type]: params }`
          if (t && t.config && typeof t.config === 'object') {
            const keys = Object.keys(t.config);
            if (keys.length === 1) {
              const type = keys[0];
              const params = { ...t.config[type] };
              // Strip UI-only flags
              if (params && Object.prototype.hasOwnProperty.call(params, 'enabled')) {
                delete params.enabled;
              }
              return { type, params };
            }
          }
          // Case 3: modal payload shape `transformations: { [type]: params }`
          if (t && t.transformations && typeof t.transformations === 'object') {
            const keys = Object.keys(t.transformations);
            if (keys.length === 1) {
              const type = keys[0];
              const params = { ...t.transformations[type] };
              if (params && Object.prototype.hasOwnProperty.call(params, 'enabled')) {
                delete params.enabled;
              }
              return { type, params };
            }
          }
          return null;
        })
        .filter(Boolean);

    logInfo('app.frontend.interactions', 'transformations_normalized', 'Transformations normalized for backend', {
      timestamp: new Date().toISOString(),
      originalTransformationsCount: transformations?.length || 0,
      normalizedTransformationsCount: normalizedTransformations.length,
      function: 'handleCreateRelease'
    });

      // Prepare release data for API using the values from the release config form
      const releaseData = {
        version_name: releaseConfig.name, // ✅ backend expects "version_name"
        dataset_ids: releaseConfig.selectedDatasets,
        transformations: normalizedTransformations,
        multiplier: releaseConfig.multiplier,
        description: "",
        preserve_annotations: releaseConfig.preserveAnnotations,
        task_type: releaseConfig.taskType || 'object_detection',
        export_format: releaseConfig.exportFormat || 'yolo_detection',
        output_format: releaseConfig.imageFormat || 'original', // ✅ Add output_format for image conversion
        include_images: true,
        include_annotations: true,
        verified_only: false,
        project_id: projectId || 'gevis',
        preview_data: releaseConfig.previewData // ✅ FIXED: Send preview data with calculated split counts
      };

      console.log('Creating release with config:', releaseData);

    logInfo('app.frontend.interactions', 'release_api_call_started', 'Release API call started', {
      timestamp: new Date().toISOString(),
      releaseName: releaseConfig.name,
      releaseData: releaseData,
      function: 'handleCreateRelease'
    });

      // Call the backend API using the API service
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(releaseData),
      });

      // Close the loading message
      loadingMessage();

      if (response.ok) {
        const responseData = await response.json();
        console.log('Release created successfully:', JSON.stringify(responseData, null, 2));
        
        // ✅ Fixed: Handle nested response format
        const createdRelease = responseData.release || responseData;
        console.log('Model path from response:', createdRelease.model_path);
        
        logInfo('app.frontend.interactions', 'release_created_success', 'Release created successfully', {
          timestamp: new Date().toISOString(),
          releaseName: releaseConfig.name,
          releaseId: createdRelease.id || createdRelease.release_id,
          modelPath: createdRelease.model_path,
          function: 'handleCreateRelease'
        });
        
        // Show success message
        message.success('Release created successfully! Starting export...');
        
        // Prepare release data for the download modal
        const modalReleaseId = createdRelease.id || createdRelease.release_id;
        const releaseForModal = {
          id: modalReleaseId,
          name: releaseConfig.name,
          description: `${releaseConfig.exportFormat} export with ${transformations.length} transformations`,
          export_format: releaseConfig.exportFormat,
          final_image_count: releaseConfig.multiplier * (selectedDatasets[0]?.image_count || 0),
          created_at: new Date().toISOString(),
          model_path: createdRelease.model_path || (modalReleaseId ? `/api/v1/releases/${modalReleaseId}/download` : '')
        };
        
        console.log('Opening download modal with release:', releaseForModal);
        
        logInfo('app.frontend.ui', 'download_modal_opening', 'Opening download modal for release', {
          timestamp: new Date().toISOString(),
          releaseId: modalReleaseId,
          releaseName: releaseConfig.name,
          function: 'handleCreateRelease'
        });
        
        // Open download modal in export mode
        setDownloadModal({
          isOpen: true,
          release: releaseForModal,
          isExporting: true,
          exportProgress: { percentage: 0, step: 'initializing' }
        });
        
        // Force refresh transformation section after successful release creation
        setTransformationKey(prev => prev + 1);
        
        // ✅ REFRESH RELEASE HISTORY after successful release creation
        if (window.releaseHistoryRefreshKey) {
          window.releaseHistoryRefreshKey = window.releaseHistoryRefreshKey + 1;
        } else {
          window.releaseHistoryRefreshKey = 1;
        }
        
        logInfo('app.frontend.ui', 'transformation_section_refreshed_after_release', 'Transformation section refreshed after release creation', {
          timestamp: new Date().toISOString(),
          releaseId: modalReleaseId,
          releaseName: releaseConfig.name,
          newTransformationKey: transformationKey + 1,
          releaseHistoryRefreshKey: window.releaseHistoryRefreshKey,
          function: 'handleCreateRelease'
        });
        
        console.log('✅ Release History refresh triggered after successful release creation');
        
        // Log the current state of the download modal
        console.log('Download modal state after setting:', {
          isOpen: true,
          release: releaseForModal,
          isExporting: true,
          exportProgress: { percentage: 0, step: 'initializing' }
        });
        
        // Simulate export progress
        simulateExportProgress(releaseForModal);
      } else {
        logError('app.frontend.interactions', 'release_creation_api_failed', 'Release creation API call failed', {
          timestamp: new Date().toISOString(),
          releaseName: releaseConfig.name,
          status: response.status,
          statusText: response.statusText,
          function: 'handleCreateRelease'
        });
        throw new Error('Failed to create release');
      }
    } catch (error) {
      logError('app.frontend.interactions', 'release_creation_failed', 'Release creation failed', {
        timestamp: new Date().toISOString(),
        releaseName: releaseConfig?.name,
        error: error.message,
        function: 'handleCreateRelease'
      });
      console.error('Error creating release:', error);
      message.error('Failed to create release. Please try again.');
    }
  };

  // Simulate export progress for the download modal
  const simulateExportProgress = (release) => {
    logInfo('app.frontend.ui', 'export_progress_simulation_started', 'Export progress simulation started', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      function: 'simulateExportProgress'
    });

    const steps = [
      { step: 'initializing', percentage: 10, duration: 1000 },
      { step: 'processing_images', percentage: 60, duration: 2000 },
      { step: 'creating_zip', percentage: 90, duration: 1500 },
      { step: 'completed', percentage: 100, duration: 500 }
    ];

    let currentStepIndex = 0;

    const updateProgress = () => {
      if (currentStepIndex < steps.length) {
        const currentStep = steps[currentStepIndex];
        
        logInfo('app.frontend.ui', 'export_progress_updated', 'Export progress updated', {
          timestamp: new Date().toISOString(),
          releaseId: release.id,
          releaseName: release.name,
          step: currentStep.step,
          percentage: currentStep.percentage,
          function: 'updateProgress'
        });
        
        setDownloadModal(prev => ({
          ...prev,
          exportProgress: {
            step: currentStep.step,
            percentage: currentStep.percentage
          }
        }));

        if (currentStep.step === 'completed') {
          // ✅ CLEAR TRANSFORMATION TOOLS WHEN EXPORT COMPLETES
          setTransformations([]);
          setTransformationKey(prev => prev + 1);
          
          logInfo('app.frontend.ui', 'transformation_tools_cleared_on_export_complete', 'Transformation tools cleared when export completed', {
            timestamp: new Date().toISOString(),
            releaseId: release.id,
            releaseName: release.name,
            function: 'updateProgress'
          });
          
          console.log('✅ Transformation tools cleared when export completed');
          
          // Export completed, switch to download mode
          setTimeout(() => {
            logInfo('app.frontend.ui', 'export_completed_switch_to_download', 'Export completed, switching to download mode', {
              timestamp: new Date().toISOString(),
              releaseId: release.id,
              releaseName: release.name,
              function: 'updateProgress'
            });
            
            setDownloadModal(prev => ({
              ...prev,
              isExporting: false,
              exportProgress: null
            }));
          }, 1000);
        } else {
          // Move to next step
          setTimeout(() => {
            currentStepIndex++;
            updateProgress();
          }, currentStep.duration);
        }
      }
    };

    // Start the progress simulation
    setTimeout(updateProgress, 500);
  };

  // Handle release history item click to show release details view
  const handleReleaseHistoryClick = (release) => {
    logUserClick('release_history_item_clicked', 'User clicked release history item');
    logInfo('app.frontend.interactions', 'release_history_clicked', 'Release history item clicked', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      function: 'handleReleaseHistoryClick'
    });

    // Set the selected release for details view
    setSelectedRelease(release);
    
    // Show release details view instead of download modal
    setShowReleaseDetails(true);
  };

  // Handle back button from release details view
  const handleBackFromDetails = () => {
    logUserClick('back_from_release_details_clicked', 'User clicked back from release details');
    logInfo('app.frontend.navigation', 'back_from_release_details', 'Back from release details view', {
      timestamp: new Date().toISOString(),
      releaseId: selectedRelease?.id,
      releaseName: selectedRelease?.name,
      function: 'handleBackFromDetails'
    });

    setShowReleaseDetails(false);
    setSelectedRelease(null);
  };

  // Handle download from release details view
  const handleDownloadFromDetails = (release) => {
    logUserClick('download_from_details_clicked', 'User clicked download from release details');
    logInfo('app.frontend.interactions', 'download_from_details', 'Download from release details view', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      function: 'handleDownloadFromDetails'
    });

    setDownloadModal({
      isOpen: true,
      release: release,
      isExporting: false,
      exportProgress: null
    });
  };

  // Handle rename from release details view
  const handleRenameFromDetails = (releaseId, newName) => {
    logInfo('app.frontend.interactions', 'rename_from_details', 'Release renamed from details view', {
      timestamp: new Date().toISOString(),
      releaseId: releaseId,
      newName: newName,
      function: 'handleRenameFromDetails'
    });

    // Update the selected release name
    setSelectedRelease(prev => prev ? { ...prev, name: newName } : null);
  };

  // Handle create new release from details view
  const handleCreateNewFromDetails = () => {
    logUserClick('create_new_from_details_clicked', 'User clicked create new from release details');
    logInfo('app.frontend.navigation', 'create_new_from_details', 'Create new release from details view', {
      timestamp: new Date().toISOString(),
      function: 'handleCreateNewFromDetails'
    });

    setShowReleaseDetails(false);
    setSelectedRelease(null);
    // Reset to main view for creating new release
  };

  // Close download modal and refresh the Release Section state
  const closeDownloadModal = () => {
    logUserClick('close_download_modal_button_clicked', 'User clicked close download modal button');
    logInfo('app.frontend.ui', 'download_modal_closing', 'Download modal closing', {
      timestamp: new Date().toISOString(),
      releaseId: downloadModal.release?.id,
      releaseName: downloadModal.release?.name,
      function: 'closeDownloadModal'
    });

    setDownloadModal({
      isOpen: false,
      release: null,
      isExporting: false,
      exportProgress: null
    });
    
    // ✅ COMPLETE REFRESH OF RELEASE SECTION STATE
    // Use setTimeout to ensure state updates happen in correct order
    setTimeout(async () => {
      try {
        // ✅ STEP 1: Clear transformations to show fresh state FIRST
        setTransformations([]);
        
        // ✅ STEP 2: Hide release config panel to go back to transformation step
        setShowReleaseConfig(false);
        
        // ✅ STEP 3: Clear current release version to force new session
        setCurrentReleaseVersion(null);
        sessionStorage.removeItem('currentReleaseVersion');
        
        // ✅ STEP 4: Force refresh of transformation section by updating key
        setTransformationKey(prev => prev + 1);
        
        // ✅ STEP 5: REFRESH RELEASE HISTORY
        if (window.releaseHistoryRefreshKey) {
          window.releaseHistoryRefreshKey = window.releaseHistoryRefreshKey + 1;
        } else {
          window.releaseHistoryRefreshKey = 1;
        }
        
        // ✅ STEP 6: Update transformation status in backend AFTER cleanup (pending → completed)
        if (downloadModal.release?.id) {
          logInfo('app.frontend.ui', 'transformation_status_update_started', 'Updating transformation status to completed AFTER cleanup', {
            timestamp: new Date().toISOString(),
            releaseId: downloadModal.release.id,
            function: 'closeDownloadModal'
          });
          
          // Call backend to update transformation status
          const response = await fetch(`${API_BASE_URL}/api/v1/releases/${downloadModal.release.id}/complete-transformations`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            logInfo('app.frontend.ui', 'transformation_status_updated', 'Transformation status updated to completed', {
              timestamp: new Date().toISOString(),
              releaseId: downloadModal.release.id,
              function: 'closeDownloadModal'
            });
          } else {
            logError('app.frontend.ui', 'transformation_status_update_failed', 'Failed to update transformation status', {
              timestamp: new Date().toISOString(),
              releaseId: downloadModal.release.id,
              status: response.status,
              function: 'closeDownloadModal'
            });
          }
        }
        
        logInfo('app.frontend.ui', 'release_section_state_refreshed', 'Release Section state completely refreshed', {
          timestamp: new Date().toISOString(),
          function: 'closeDownloadModal',
          releaseHistoryRefreshKey: window.releaseHistoryRefreshKey,
          transformationKey: transformationKey + 1
        });
        
        console.log('✅ Release Section state completely refreshed after modal close');
        console.log('✅ Transformation tools cleared from UI');
        console.log('✅ Transformation status updated to completed');
        console.log('✅ Release History refresh triggered');
        message.info('Ready to create a new release!');
        
      } catch (error) {
        logError('app.frontend.ui', 'release_section_refresh_error', 'Error during release section refresh', {
          timestamp: new Date().toISOString(),
          error: error.message,
          function: 'closeDownloadModal'
        });
        console.error('Error refreshing release section:', error);
      }
    }, 100); // Small delay to ensure modal closes first
    
    // Keep selected datasets as they are still valid for next release
    // setSelectedDatasets([]); - Commented out to keep dataset selection
  };

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'release_section_rendered', 'ReleaseSection component rendered', {
    timestamp: new Date().toISOString(),
    component: 'ReleaseSection',
    projectId: projectId,
    datasetId: datasetId,
    selectedDatasetsCount: selectedDatasets.length,
    transformationsCount: transformations.length,
    showReleaseConfig: showReleaseConfig,
    currentReleaseVersion: currentReleaseVersion,
    transformationKey: transformationKey,
    datasetDetailsModalVisible: datasetDetailsModal.visible,
    datasetRebalanceModalVisible: datasetRebalanceModal.visible,
    downloadModalOpen: downloadModal.isOpen,
    downloadModalExporting: downloadModal.isExporting
  });

  return (
    <div className="release-section">
      <Layout style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <Content style={{ padding: '24px' }}>
          {/* Header */}
          <div className="release-section-header">
            <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
              <Col>
                <Space>
                  <RocketOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                  <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
                    Dataset Releases
                  </h1>
                </Space>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '16px' }}>
                  Create, manage, and export versioned dataset releases with transformations
                </p>
              </Col>
            </Row>
          </div>

          {/* Conditional Rendering: Show Release Details View or Main Content */}
          {showReleaseDetails ? (
            <ReleaseDetailsView
              release={selectedRelease}
              onBack={handleBackFromDetails}
              onDownload={handleDownloadFromDetails}
              onRename={handleRenameFromDetails}
              onCreateNew={handleCreateNewFromDetails}
              projectId={projectId}
            />
          ) : (
            <>
              {/* NEW LAYOUT: Release History on LEFT, Main Content on RIGHT */}
              <Row gutter={24}>
            {/* LEFT SIDEBAR: Release History */}
            <Col xs={24} lg={8} xl={6}>
              <div style={{ position: 'sticky', top: 24 }}>
                <ReleaseHistoryList 
                  projectId={projectId}
                  datasetId={datasetId} 
                  onReleaseClick={handleReleaseHistoryClick}
                />
              </div>
            </Col>

            {/* RIGHT MAIN CONTENT: All other sections */}
            <Col xs={24} lg={16} xl={18}>
              {/* Dataset Statistics */}
              <DatasetStats selectedDatasets={selectedDatasets} />

              {/* Available Datasets for Release */}
              <Card 
                title={
                  <Space>
                    <span style={{ fontSize: '18px', fontWeight: 600 }}>Available Datasets for Release</span>
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      ({selectedDatasets.length} completed dataset{selectedDatasets.length !== 1 ? 's' : ''})
                    </span>
                  </Space>
                }
                style={{ marginBottom: 24 }}
                className="available-datasets-card"
              >
                {selectedDatasets.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 0',
                    color: '#666'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: 16 }}>📦</div>
                    <h3 style={{ color: '#666' }}>No completed datasets available</h3>
                    <p>Complete annotation tasks and move datasets to the "Dataset" section to see them here</p>
                  </div>
                ) : (
                  <div style={{ padding: '16px 0' }}>
                    {(() => {
                      logInfo('app.frontend.ui', 'dataset_cards_rendering', 'Dataset cards rendering', {
                        timestamp: new Date().toISOString(),
                        datasetsCount: selectedDatasets.length,
                        function: 'dataset_cards_render'
                      });
                      return selectedDatasets.map(dataset => (
                        <Card
                          key={dataset.id}
                          style={{ 
                            marginBottom: 16,
                            border: '1px solid #e8e8e8',
                            borderRadius: '8px'
                          }}
                          hoverable
                        >
                          <Row gutter={[16, 16]} align="middle">
                            <Col xs={24} sm={12} md={8}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                  {dataset.name}
                                </h4>
                                <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
                                  {dataset.description || 'No description'}
                                </p>
                              </div>
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 600, color: '#1890ff' }}>
                                  {dataset.total_images || 0}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Total Images</div>
                              </div>
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a' }}>
                                  {dataset.labeled_images || 0}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Labeled</div>
                              </div>
                            </Col>
                            <Col xs={24} sm={12} md={4}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                  Created: {new Date(dataset.created_at).toLocaleDateString()}
                                </div>
                                <div style={{ fontSize: '14px', color: '#666' }}>
                                  Updated: {new Date(dataset.updated_at).toLocaleDateString()}
                                </div>
                              </div>
                            </Col>
                            <Col xs={24} sm={12} md={4}>
                              <div style={{ textAlign: 'right' }}>
                                <Button 
                                  type="link" 
                                  size="small"
                                  icon={<EyeOutlined />}
                                  onClick={() => {
                                    logUserClick('view_dataset_details_card_button_clicked', 'User clicked view details button on dataset card');
                                    logInfo('app.frontend.interactions', 'dataset_card_details_clicked', 'Dataset card details button clicked', {
                                      timestamp: new Date().toISOString(),
                                      datasetId: dataset.id,
                                      datasetName: dataset.name,
                                      totalImages: dataset.total_images || 0,
                                      labeledImages: dataset.labeled_images || 0,
                                      function: 'dataset_card_onClick'
                                    });
                                    handleViewDatasetDetails(dataset);
                                  }}
                                >
                                  View Details
                                </Button>
                              </div>
                            </Col>
                          </Row>
                        </Card>
                      ));
                    })()}
                  </div>
                )}
              </Card>

              {/* Transformation Pipeline */}
              <TransformationSection 
                key={`${currentReleaseVersion || 'default'}-${transformationKey}`} // ✅ Force re-render when release version changes or after modal close
                onTransformationsChange={setTransformations}
                selectedDatasets={selectedDatasets}
                onContinue={handleContinueToReleaseConfig}
                currentReleaseVersion={currentReleaseVersion}
                onReleaseVersionChange={setCurrentReleaseVersion}
              />

              {/* Release Configuration - Only show after Continue is clicked */}
              {showReleaseConfig && (
                <div className="release-config-panel" data-testid="release-config-panel">
                  <ReleaseConfigPanel
                    onGenerate={handleCreateRelease}
                    onPreview={handlePreviewRelease}
                    transformations={transformations}
                    selectedDatasets={Array.isArray(selectedDatasets) ? selectedDatasets : []}
                    currentReleaseVersion={currentReleaseVersion}
                    onReleaseVersionChange={setCurrentReleaseVersion}
                  />
                </div>
              )}
            </Col>
          </Row>

          {/* Export is now handled directly in the handleCreateRelease function */}

          {/* Dataset Details Modal */}
          <Modal
            title={
              <Space>
                <EyeOutlined />
                <span>Dataset Details: {datasetDetailsModal.dataset?.name}</span>
              </Space>
            }
            open={datasetDetailsModal.visible}
            onCancel={handleCloseDatasetDetails}
            footer={[
              <Button key="close" onClick={handleCloseDatasetDetails}>
                Close
              </Button>
            ]}
            width={800}
            style={{ top: 20 }}
            onOpenChange={(open) => {
              if (open) {
                logInfo('app.frontend.ui', 'dataset_details_modal_opened', 'Dataset details modal opened', {
                  timestamp: new Date().toISOString(),
                  datasetId: datasetDetailsModal.dataset?.id,
                  datasetName: datasetDetailsModal.dataset?.name,
                  function: 'dataset_details_modal_onOpenChange'
                });
              }
            }}
          >
            {datasetDetailsModal.loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>Loading dataset details...</div>
              </div>
            ) : datasetDetailsModal.dataset ? (
              <div>
                {/* Dataset Overview */}
                <Card title="Dataset Overview" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <p><strong>Name:</strong> {datasetDetailsModal.dataset.name}</p>
                      <p><strong>Description:</strong> {datasetDetailsModal.dataset.description || 'No description'}</p>
                      <p><strong>Created:</strong> {new Date(datasetDetailsModal.dataset.created_at).toLocaleString()}</p>
                      <p><strong>Updated:</strong> {new Date(datasetDetailsModal.dataset.updated_at).toLocaleString()}</p>
                    </Col>
                    <Col span={12}>
                      <p><strong>Total Images:</strong> {datasetDetailsModal.dataset.total_images}</p>
                      <p><strong>Labeled Images:</strong> {datasetDetailsModal.dataset.labeled_images}</p>
                      <p><strong>Unlabeled Images:</strong> {datasetDetailsModal.dataset.unlabeled_images}</p>
                    </Col>
                  </Row>
                </Card>

                {/* Split Distribution */}
                {datasetDetailsModal.splitStats && (
                  <Card 
                    title={
                      <Row justify="space-between" align="middle">
                        <Col>Split Distribution</Col>
                        <Col>
                          <Button 
                            type="default" 
                            size="small"
                            icon={<SyncOutlined />}
                            onClick={() => {
                              logUserClick('rebalance_dataset_button_clicked', 'User clicked rebalance dataset button');
                              logInfo('app.frontend.interactions', 'rebalance_dataset_clicked', 'Rebalance dataset button clicked', {
                                timestamp: new Date().toISOString(),
                                datasetId: datasetDetailsModal.dataset?.id,
                                datasetName: datasetDetailsModal.dataset?.name,
                                function: 'rebalance_dataset_onClick'
                              });
                              handleDatasetRebalance(datasetDetailsModal.dataset, datasetDetailsModal.splitStats)}
                            }
                          >
                            Rebalance
                          </Button>
                        </Col>
                      </Row>
                    } 
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <Tag color="blue" style={{ fontSize: '16px', padding: '8px 16px' }}>
                            Train: {datasetDetailsModal.splitStats.train}
                          </Tag>
                          <div style={{ marginTop: 4, color: '#666' }}>
                            {datasetDetailsModal.splitStats.train_percent}%
                          </div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <Tag color="geekblue" style={{ fontSize: '16px', padding: '8px 16px' }}>
                            Val: {datasetDetailsModal.splitStats.val}
                          </Tag>
                          <div style={{ marginTop: 4, color: '#666' }}>
                            {datasetDetailsModal.splitStats.val_percent}%
                          </div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <Tag color="purple" style={{ fontSize: '16px', padding: '8px 16px' }}>
                            Test: {datasetDetailsModal.splitStats.test}
                          </Tag>
                          <div style={{ marginTop: 4, color: '#666' }}>
                            {datasetDetailsModal.splitStats.test_percent}%
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* Image Gallery */}
                <Card title="Sample Images" style={{ marginBottom: 16 }}>
                  {datasetDetailsModal.images.length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {datasetDetailsModal.images.slice(0, 8).map(image => (
                        <Col key={image.id} xs={12} sm={8} md={6}>
                          <AnnotatedImageCard image={image} />
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#666', padding: '20px 0' }}>
                      No images available
                    </div>
                  )}
                </Card>
              </div>
            ) : null}
          </Modal>

          {/* Individual Dataset Rebalance Modal */}
          <Modal
            title={`Rebalance Dataset: ${datasetRebalanceModal.dataset?.name}`}
            open={datasetRebalanceModal.visible}
            onOk={handleSaveDatasetRebalance}
            onCancel={handleCancelDatasetRebalance}
            okText="Save"
            cancelText="Cancel"
            width={600}
            confirmLoading={datasetRebalanceModal.loading}
            onOpenChange={(open) => {
              if (open) {
                logInfo('app.frontend.ui', 'dataset_rebalance_modal_opened', 'Dataset rebalance modal opened', {
                  timestamp: new Date().toISOString(),
                  datasetId: datasetRebalanceModal.dataset?.id,
                  datasetName: datasetRebalanceModal.dataset?.name,
                  trainCount: datasetRebalanceModal.trainCount,
                  valCount: datasetRebalanceModal.valCount,
                  testCount: datasetRebalanceModal.testCount,
                  totalImages: datasetRebalanceModal.totalImages,
                  function: 'dataset_rebalance_modal_onOpenChange'
                });
              }
            }}
          >
            <p>You can update this dataset's train/test split here.</p>
            <Alert
              message="Note: changing your test set will invalidate model performance comparisons with previously generated versions."
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
            />
            
            <div style={{ marginBottom: 20 }}>
              <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <strong>Train:</strong>
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={datasetRebalanceModal.totalImages}
                    value={datasetRebalanceModal.trainCount}
                    onChange={(value) => handleDatasetCountChange(value, 'train')}
                    style={{ width: '100%' }}
                    addonAfter="images"
                    onBlur={(e) => {
                      logInfo('app.frontend.ui', 'train_count_input_blurred', 'Train count input blurred', {
                        timestamp: new Date().toISOString(),
                        datasetId: datasetRebalanceModal.dataset?.id,
                        datasetName: datasetRebalanceModal.dataset?.name,
                        trainCount: datasetRebalanceModal.trainCount,
                        function: 'train_count_input_onBlur'
                      });
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Tag color="blue" style={{ fontSize: '12px' }}>
                    {datasetRebalanceModal.totalImages > 0 ? Math.round((datasetRebalanceModal.trainCount / datasetRebalanceModal.totalImages) * 100) : 0}%
                  </Tag>
                </Col>
              </Row>
              
              <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <strong>Valid:</strong>
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={datasetRebalanceModal.totalImages}
                    value={datasetRebalanceModal.valCount}
                    onChange={(value) => handleDatasetCountChange(value, 'val')}
                    style={{ width: '100%' }}
                    addonAfter="images"
                    onBlur={(e) => {
                      logInfo('app.frontend.ui', 'val_count_input_blurred', 'Valid count input blurred', {
                        timestamp: new Date().toISOString(),
                        datasetId: datasetRebalanceModal.dataset?.id,
                        datasetName: datasetRebalanceModal.dataset?.name,
                        valCount: datasetRebalanceModal.valCount,
                        function: 'val_count_input_onBlur'
                      });
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Tag color="geekblue" style={{ fontSize: '12px' }}>
                    {datasetRebalanceModal.totalImages > 0 ? Math.round((datasetRebalanceModal.valCount / datasetRebalanceModal.totalImages) * 100) : 0}%
                  </Tag>
                </Col>
              </Row>
              
              <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <strong>Test:</strong>
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={datasetRebalanceModal.totalImages}
                    value={datasetRebalanceModal.testCount}
                    onChange={(value) => handleDatasetCountChange(value, 'test')}
                    style={{ width: '100%' }}
                    addonAfter="images"
                    onBlur={(e) => {
                      logInfo('app.frontend.ui', 'test_count_input_blurred', 'Test count input blurred', {
                        timestamp: new Date().toISOString(),
                        datasetId: datasetRebalanceModal.dataset?.id,
                        datasetName: datasetRebalanceModal.dataset?.name,
                        testCount: datasetRebalanceModal.testCount,
                        function: 'test_count_input_onBlur'
                      });
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Tag color="purple" style={{ fontSize: '12px' }}>
                    {datasetRebalanceModal.totalImages > 0 ? Math.round((datasetRebalanceModal.testCount / datasetRebalanceModal.totalImages) * 100) : 0}%
                  </Tag>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <strong>Total: {datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount} / {datasetRebalanceModal.totalImages} images</strong>
                </Col>
                <Col>
                  {(() => {
                    const currentTotal = datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount;
                    const remaining = datasetRebalanceModal.totalImages - currentTotal;
                    
                    logInfo('app.frontend.ui', 'rebalance_total_calculation', 'Rebalance total calculation updated', {
                      timestamp: new Date().toISOString(),
                      datasetId: datasetRebalanceModal.dataset?.id,
                      datasetName: datasetRebalanceModal.dataset?.name,
                      currentTotal: currentTotal,
                      totalImages: datasetRebalanceModal.totalImages,
                      remaining: remaining,
                      trainCount: datasetRebalanceModal.trainCount,
                      valCount: datasetRebalanceModal.valCount,
                      testCount: datasetRebalanceModal.testCount,
                      function: 'rebalance_total_calculation'
                    });
                    
                    if (remaining !== 0) {
                      return (
                        <Tag color={remaining > 0 ? 'orange' : 'red'}>
                          {remaining > 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over limit`}
                        </Tag>
                      );
                    }
                    return <Tag color="green">Perfect match!</Tag>;
                  })()}
                </Col>
              </Row>
              <Progress 
                percent={Math.min(((datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount) / datasetRebalanceModal.totalImages) * 100, 100)}
                status={
                  (datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount) === datasetRebalanceModal.totalImages 
                    ? 'success' 
                    : (datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount) > datasetRebalanceModal.totalImages 
                      ? 'exception' 
                      : 'active'
                }
                strokeColor={
                  (datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount) === datasetRebalanceModal.totalImages 
                    ? '#52c41a' 
                    : (datasetRebalanceModal.trainCount + datasetRebalanceModal.valCount + datasetRebalanceModal.testCount) > datasetRebalanceModal.totalImages 
                      ? '#ff4d4f' 
                      : '#1890ff'
                }
                onUpdate={(percent) => {
                  logInfo('app.frontend.ui', 'rebalance_progress_updated', 'Rebalance progress bar updated', {
                    timestamp: new Date().toISOString(),
                    datasetId: datasetRebalanceModal.dataset?.id,
                    datasetName: datasetRebalanceModal.dataset?.name,
                    progressPercent: percent,
                    function: 'rebalance_progress_onUpdate'
                  });
                }}
              />
            </div>

            <Alert
              message={`This will assign all labeled images in "${datasetRebalanceModal.dataset?.name}" to the dataset splits according to the counts you've set. Unlabeled images will be ignored.`}
              type="info"
              showIcon
            />
          </Modal>

          {/* Professional Download Modal */}
          <DownloadModal
            isOpen={downloadModal.isOpen}
            onClose={closeDownloadModal}
            release={downloadModal.release}
            isExporting={downloadModal.isExporting}
            exportProgress={downloadModal.exportProgress}
          />
            </>
          )}
        </Content>
      </Layout>
    </div>
  );
};

export default ReleaseSection;





