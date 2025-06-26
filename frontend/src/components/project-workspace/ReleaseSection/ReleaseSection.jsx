


import { projectsAPI } from '../../../services/api';

import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, Divider, Row, Col, Card, message } from 'antd';
import { PlusOutlined, RocketOutlined } from '@ant-design/icons';

// Import all the components we've built
import { DatasetStats, TransformationCard, TransformationModal, ReleaseConfigPanel, ExportOptionsModal, ReleaseHistoryList } from './';

// Import CSS for styling
import './ReleaseSection.css';

const { Content } = Layout;

const ReleaseSection = ({ projectId, datasetId }) => {
  // State management
  const [transformations, setTransformations] = useState([]);
  const [transformationModalVisible, setTransformationModalVisible] = useState(false);
  const [editingTransformation, setEditingTransformation] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [releaseData, setReleaseData] = useState(null);
  const [selectedDatasets, setSelectedDatasets] = useState([]);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const response = await projectsAPI.getProjectManagementData(projectId);
        console.log("Filtered completed datasets only:", response);

        // ✅ Only get datasets with split_type === 'dataset'
        const completedDatasets = response?.dataset?.datasets?.filter(
          (ds) => ds.split_type === 'dataset'
        ) || [];

        console.log("✅ Datasets set in state:", completedDatasets);
        setSelectedDatasets(completedDatasets);
      } catch (error) {
        console.error("Failed to load datasets:", error);
        message.error('Failed to load datasets');
      }
    };

    if (projectId) {
      fetchDatasets();
    }
  }, [projectId]);




  // Transformation handlers
  const handleAddTransformation = () => {
    setEditingTransformation(null);
    setTransformationModalVisible(true);
  };

  const handleEditTransformation = (transformation) => {
    setEditingTransformation(transformation);
    setTransformationModalVisible(true);
  };

  const handleSaveTransformation = (transformationData) => {
    if (editingTransformation) {
      // Update existing transformation
      setTransformations(transformations.map(t => 
        t.id === transformationData.id ? transformationData : t
      ));
      message.success('Transformation updated successfully');
    } else {
      // Add new transformation
      setTransformations([...transformations, transformationData]);
      message.success('Transformation added successfully');
    }
    setTransformationModalVisible(false);
    setEditingTransformation(null);
  };

  const handleDeleteTransformation = (transformationId) => {
    setTransformations(transformations.filter(t => t.id !== transformationId));
    message.success('Transformation deleted successfully');
  };

  // Release handlers
  const handlePreviewRelease = (previewData) => {
    console.log('Preview data:', previewData);
    message.info('Release preview generated');
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

          {/* Dataset Statistics */}
          <DatasetStats datasetId={selectedDatasets[0]?.id} />


          {/* Transformation Pipeline */}
          <Card 
            title={
              <Space>
                <span style={{ fontSize: '18px', fontWeight: 600 }}>Transformation Pipeline</span>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleAddTransformation}
                  size="small"
                >
                  Add Transformation
                </Button>
              </Space>
            }
            style={{ marginBottom: 24 }}
            className="transformation-pipeline-card"
          >
            {transformations.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 0',
                color: '#666'
              }}>
                <div style={{ fontSize: '48px', marginBottom: 16 }}>⚙️</div>
                <h3 style={{ color: '#666' }}>No transformations added</h3>
                <p>Add transformations to augment your dataset before creating a release</p>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleAddTransformation}
                >
                  Add Your First Transformation
                </Button>
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '16px',
                padding: '16px 0'
              }}>
                {transformations.map(transformation => (
                  <TransformationCard
                    key={transformation.id}
                    step={transformation}
                    onEdit={handleEditTransformation}
                    onDelete={handleDeleteTransformation}
                  />
                ))}
                <Card
                  style={{
                    minWidth: 280,
                    maxWidth: 320,
                    height: 200,
                    border: '2px dashed #d9d9d9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  hoverable
                  onClick={handleAddTransformation}
                  className="add-transformation-card"
                >
                  <div style={{ textAlign: 'center', color: '#666' }}>
                    <PlusOutlined style={{ fontSize: '32px', marginBottom: 8 }} />
                    <div>Add Transformation</div>
                  </div>
                </Card>
              </div>
            )}
          </Card>

          {/* Release Configuration */}
          <ReleaseConfigPanel
            onGenerate={handleCreateRelease}
            onPreview={handlePreviewRelease}
            transformations={transformations}
            selectedDatasets={Array.isArray(selectedDatasets) ? selectedDatasets : []}
          />

          {/* Release History */}
          <ReleaseHistoryList datasetId={selectedDatasets[0]?.id} />


          {/* Modals */}
          <TransformationModal
            visible={transformationModalVisible}
            step={editingTransformation}
            onSave={handleSaveTransformation}
            onCancel={() => {
              setTransformationModalVisible(false);
              setEditingTransformation(null);
            }}
          />

          <ExportOptionsModal
            visible={exportModalVisible}
            releaseData={releaseData}
            onExport={handleExportRelease}
            onCancel={() => setExportModalVisible(false)}
          />
        </Content>
      </Layout>
    </div>
  );
};

export default ReleaseSection;



