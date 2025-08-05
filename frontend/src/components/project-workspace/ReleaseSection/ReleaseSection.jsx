


import { projectsAPI } from '../../../services/api';

import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, Divider, Row, Col, Card, message, Modal, Image, Tag, Spin, Alert, InputNumber, Progress } from 'antd';
import { PlusOutlined, RocketOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';

// Import all the components we've built
import { DatasetStats, TransformationCard, TransformationModal, ReleaseConfigPanel, ExportOptionsModal, ReleaseHistoryList } from './';

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
        try {
          const response = await fetch(`http://localhost:12000/api/v1/images/${image.id}/annotations`);
          const annotationData = await response.json();
          console.log(`Annotations for image ${image.filename}:`, annotationData);
          setAnnotations(annotationData || []);
        } catch (error) {
          console.error('Error loading annotations:', error);
          setAnnotations([]);
        }
      }
    };

    loadAnnotations();
  }, [image.id]);

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
                          x={points[0] || 10}s
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
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [releaseData, setReleaseData] = useState(null);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [showReleaseConfig, setShowReleaseConfig] = useState(false); // New state to control Release Config visibility
  const [currentReleaseVersion, setCurrentReleaseVersion] = useState(null); // Shared release version state
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

  // Function to fetch datasets
  const fetchDatasets = async () => {
    try {
      const response = await projectsAPI.getProjectManagementData(projectId);
      console.log("Management data response:", response);
      
      // The API returns response.dataset.datasets for completed datasets
      const completedDatasets = response?.dataset?.datasets || [];
      console.log("Filtered completed datasets only:", completedDatasets);
      
      setSelectedDatasets(completedDatasets);
    } catch (error) {
      console.error("Failed to load datasets:", error);
      message.error("Failed to load datasets");
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchDatasets();
    }
  }, [projectId]);

  // Function to handle viewing dataset details
  const handleViewDatasetDetails = async (dataset) => {
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

      setDatasetDetailsModal(prev => ({
        ...prev,
        images: imagesData.recent_images || [],
        splitStats: splitData,
        loading: false
      }));
    } catch (error) {
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
    const { dataset, trainCount, valCount, testCount, totalImages } = datasetRebalanceModal;

    const totalCount = trainCount + valCount + testCount;
    if (totalCount !== totalImages) {
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
      console.error('Error rebalancing dataset:', error);
      message.error(`Failed to rebalance dataset: ${error.message}`);
    } finally {
      setDatasetRebalanceModal(prev => ({ ...prev, loading: false }));
    }
  };


  // Function to cancel dataset rebalance
  const handleCancelDatasetRebalance = () => {
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
    
    setDatasetRebalanceModal(prev => ({
      ...prev,
      [type === 'train' ? 'trainCount' : type === 'val' ? 'valCount' : 'testCount']: newValue
    }));
  };



  // Release handlers
  const handlePreviewRelease = (previewData) => {
    console.log('Preview data:', previewData);
    message.info('Release preview generated');
  };

  const handleContinueToReleaseConfig = () => {
    // Show the Release Configuration section
    setShowReleaseConfig(true);
    
    // Scroll to the Release Configuration section after a short delay to ensure it's rendered
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
    
    message.success('Ready to configure your release!');
  };

  const handleCreateRelease = async (releaseConfig) => {
    try {
      // Prepare release data for API
      const releaseData = {
        version_name: releaseConfig.name,
        dataset_id: releaseConfig.selectedDatasets[0], // ✅ use just the first selected one
        transformations: transformations,
        multiplier: releaseConfig.multiplier,
        target_split: { train: 70, val: 20, test: 10 }, // Default split
        preserve_annotations: releaseConfig.preserveAnnotations,
        task_type: 'object_detection',
        export_format: 'yolo'
      };

      // Call the backend API
      const response = await fetch("/releases/create", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(releaseData),
      });

      if (response.ok) {
        const createdRelease = await response.json();
        setReleaseData(createdRelease);
        setExportModalVisible(true);
        message.success('Release created successfully!');
      } else {
        throw new Error('Failed to create release');
      }
    } catch (error) {
      console.error('Error creating release:', error);
      message.error('Failed to create release. Please try again.');
    }
  };

  const handleExportRelease = (exportConfig) => {
    console.log('Export config:', exportConfig);
    message.success('Export started successfully!');
    setExportModalVisible(false);
  };

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

          {/* NEW LAYOUT: Release History on LEFT, Main Content on RIGHT */}
          <Row gutter={24}>
            {/* LEFT SIDEBAR: Release History */}
            <Col xs={24} lg={8} xl={6}>
              <div style={{ position: 'sticky', top: 24 }}>
                <ReleaseHistoryList datasetId={datasetId} />
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
                    {selectedDatasets.map(dataset => (
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
                                onClick={() => handleViewDatasetDetails(dataset)}
                              >
                                View Details
                              </Button>
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>

              {/* Transformation Pipeline */}
              <TransformationSection 
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

          {/* Modals */}
          <ExportOptionsModal
            visible={exportModalVisible}
            releaseData={releaseData}
            onExport={handleExportRelease}
            onCancel={() => setExportModalVisible(false)}
          />

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
                            onClick={() => handleDatasetRebalance(datasetDetailsModal.dataset, datasetDetailsModal.splitStats)}
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
              />
            </div>

            <Alert
              message={`This will assign all labeled images in "${datasetRebalanceModal.dataset?.name}" to the dataset splits according to the counts you've set. Unlabeled images will be ignored.`}
              type="info"
              showIcon
            />
          </Modal>
        </Content>
      </Layout>
    </div>
  );
};

export default ReleaseSection;



