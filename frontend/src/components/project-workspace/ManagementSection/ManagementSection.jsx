import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Button,
  Spin,
  Row,
  Col,
  Select,
  Progress,
  Dropdown,
  message
} from 'antd';
import {
  TagOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  UploadOutlined,
  EyeOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, handleAPIError } from '../../../services/api';

const { Title, Text } = Typography;

// DatasetCard Component - Extracted from original ProjectWorkspace.js renderDatasetCard function
const DatasetCard = ({ 
  dataset, 
  status, 
  onDatasetClick, 
  onRenameDataset, 
  onMoveToUnassigned, 
  onMoveToAnnotating, 
  onMoveToDataset, 
  onDeleteDataset 
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'unassigned': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'annotating': return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default: return <DatabaseOutlined />;
    }
  };

  const getProgressPercent = () => {
    if (dataset.total_images === 0) return 0;
    
    if (status === 'annotating' || status === 'unassigned') {
      return Math.round((dataset.labeled_images / dataset.total_images) * 100);
    }
    
    if (status === 'completed') {
      return 100;
    }
    
    return Math.round((dataset.labeled_images / dataset.total_images) * 100);
  };

  const getMenuItems = () => {
    const baseItems = [
      {
        key: 'rename',
        label: 'Rename',
        icon: <EditOutlined />,
        onClick: (e) => {
          e?.domEvent?.stopPropagation();
          onRenameDataset(dataset);
        }
      }
    ];

    if (status === 'annotating') {
      baseItems.push({
        key: 'move-to-unassigned',
        label: 'Move to Unassigned',
        icon: <ClockCircleOutlined />,
        onClick: (e) => {
          e?.domEvent?.stopPropagation();
          onMoveToUnassigned(dataset);
        }
      });

      const isFullyLabeled = dataset.labeled_images === dataset.total_images && dataset.total_images > 0;
      if (isFullyLabeled) {
        baseItems.push({
          key: 'move-to-dataset',
          label: 'Move to Dataset',
          icon: <CheckCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            onMoveToDataset(dataset);
          }
        });
      }
    } else if (status === 'completed') {
      baseItems.push(
        {
          key: 'move-to-unassigned',
          label: 'Move to Unassigned',
          icon: <ClockCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            onMoveToUnassigned(dataset);
          }
        },
        {
          key: 'move-to-annotating',
          label: 'Move to Annotating',
          icon: <PlayCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            onMoveToAnnotating(dataset);
          }
        }
      );
    }

    baseItems.push({
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (e) => {
        e?.domEvent?.stopPropagation();
        onDeleteDataset(dataset);
      }
    });

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <Card
      key={dataset.id}
      size="small"
      style={{ 
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: '1px solid #f0f0f0',
        position: 'relative'
      }}
      hoverable
      bodyStyle={{ padding: '12px' }}
      onClick={() => onDatasetClick(dataset, status)}
    >
      <div style={{ 
        position: 'absolute', 
        top: '8px', 
        right: '8px', 
        zIndex: 10 
      }}>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button 
            type="text" 
            icon={<MoreOutlined />} 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{ 
              border: 'none',
              boxShadow: 'none',
              padding: '4px'
            }}
          />
        </Dropdown>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', paddingRight: '24px' }}>
        {getStatusIcon()}
        <Text strong style={{ marginLeft: '8px', fontSize: '14px' }}>
          {dataset.name}
        </Text>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {dataset.total_images} images
        </Text>
        {(status === 'annotating' || status === 'unassigned') && (
          <div style={{ marginTop: '4px' }}>
            <Progress 
              percent={getProgressPercent()} 
              size="small" 
              status={getProgressPercent() === 100 ? 'success' : 'active'}
            />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {dataset.labeled_images}/{dataset.total_images} labeled
              {dataset.labeled_images < dataset.total_images && status === 'annotating' && (
                <Text type="warning" style={{ fontSize: '10px', display: 'block' }}>
                  Label all images to move to dataset
                </Text>
              )}
            </Text>
          </div>
        )}
        {status === 'completed' && (
          <div style={{ marginTop: '4px' }}>
            <Progress 
              percent={100} 
              size="small" 
              status="success"
            />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {dataset.total_images}/{dataset.total_images} labeled
            </Text>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {new Date(dataset.created_at).toLocaleDateString()}
        </Text>
      </div>
    </Card>
  );
};

// Main ManagementSection Component - Extracted from original ProjectWorkspace.js renderManagementContent function
const ManagementSection = ({ 
  projectId, 
  setSelectedKey, 
  project, 
  loadProject 
}) => {
  const navigate = useNavigate();
  const [managementData, setManagementData] = useState(null);
  const [loadingManagement, setLoadingManagement] = useState(false);

  // Load management data
  const loadManagementData = async () => {
    setLoadingManagement(true);
    try {
      const data = await projectsAPI.getProjectManagementData(projectId);
      setManagementData(data);
    } catch (error) {
      console.error('Error loading management data:', error);
      handleAPIError(error);
    } finally {
      setLoadingManagement(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadManagementData();
    }
  }, [projectId]);

  // Handler functions
  const handleDatasetClick = (dataset, status) => {
    if (status === 'annotating') {
      handleStartAnnotating(dataset);
    } else if (status === 'unassigned') {
      handleAssignToAnnotating(dataset);
    }
  };

  const handleStartAnnotating = (dataset) => {
    navigate(`/annotate-launcher/${dataset.id}`);
  };


  const handleAssignToAnnotating = async (dataset) => {
    try {
      message.info(`Assigning dataset to annotating: ${dataset.name}`);
      await projectsAPI.assignDatasetToAnnotating(projectId, dataset.id);
      message.success(`Dataset assigned to annotating: ${dataset.name}`);
      loadManagementData(); // Reload data
    } catch (error) {
      handleAPIError(error);
    }
  };

  const handleRenameDataset = async (dataset) => {
    // Handle dataset rename with modal input
    const newName = prompt(`Enter new name for dataset "${dataset.name}":`, dataset.name);
    if (newName && newName !== dataset.name) {
      try {
        message.loading(`Renaming dataset to: ${newName}...`, 0);
        await projectsAPI.renameDataset(projectId, dataset.id, newName);
        message.destroy(); // Clear loading message
        message.success(`Dataset renamed to: ${newName}`);
        
        // Add a small delay to ensure backend operations complete
        setTimeout(() => {
          loadManagementData(); // Reload data
        }, 500);
      } catch (error) {
        message.destroy(); // Clear loading message
        handleAPIError(error);
      }
    }
  };

  const handleMoveToUnassigned = async (dataset) => {
    try {
      message.loading(`Moving dataset to unassigned: ${dataset.name}...`, 0);
      await projectsAPI.moveDatasetToUnassigned(projectId, dataset.id);
      message.destroy(); // Clear loading message
      message.success(`Dataset moved to unassigned: ${dataset.name}`);
      
      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        loadManagementData(); // Reload data
      }, 500);
    } catch (error) {
      message.destroy(); // Clear loading message
      handleAPIError(error);
    }
  };

  const handleMoveToAnnotating = async (dataset) => {
    try {
      message.loading(`Moving dataset to annotating: ${dataset.name}...`, 0);
      await projectsAPI.assignDatasetToAnnotating(projectId, dataset.id);
      message.destroy(); // Clear loading message
      message.success(`Dataset moved to annotating: ${dataset.name}`);
      
      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        loadManagementData(); // Reload data
      }, 500);
    } catch (error) {
      message.destroy(); // Clear loading message
      handleAPIError(error);
    }
  };

  const handleMoveToDataset = async (dataset) => {
    try {
      message.loading(`Moving dataset to completed: ${dataset.name}...`, 0);
      await projectsAPI.moveDatasetToCompleted(projectId, dataset.id);
      message.destroy(); // Clear loading message
      message.success(`Dataset moved to completed: ${dataset.name}`);
      
      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        loadManagementData(); // Reload data
      }, 500);
    } catch (error) {
      message.destroy(); // Clear loading message
      handleAPIError(error);
    }
  };

  const handleDeleteDataset = async (dataset) => {
    try {
      message.info(`Deleting dataset: ${dataset.name}`);
      await projectsAPI.deleteProjectDataset(projectId, dataset.id);
      message.success(`Dataset deleted: ${dataset.name}`);
      loadManagementData(); // Reload data
    } catch (error) {
      handleAPIError(error);
    }
  };

  if (loadingManagement) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading management data...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: '8px' }}>
            <TagOutlined style={{ marginRight: '8px' }} />
            Management
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Text type="secondary">Sort By:</Text>
            <Select defaultValue="newest" style={{ width: 120 }}>
              <Select.Option value="newest">Newest</Select.Option>
              <Select.Option value="oldest">Oldest</Select.Option>
              <Select.Option value="name">Name</Select.Option>
            </Select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button type="primary" icon={<PlusOutlined />}>
            New Version
          </Button>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* Unassigned Section */}
        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Unassigned</Text>
                <Text type="secondary">{managementData?.unassigned?.count || 0} Datasets</Text>
              </div>
            }
            style={{ height: '500px', overflow: 'auto' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Button type="link" icon={<UploadOutlined />} onClick={() => setSelectedKey('upload')}>
                Upload More Images
              </Button>
            </div>
            
            {managementData?.unassigned?.datasets?.length > 0 ? (
              managementData.unassigned.datasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  status="unassigned"
                  onDatasetClick={handleDatasetClick}
                  onRenameDataset={handleRenameDataset}
                  onMoveToUnassigned={handleMoveToUnassigned}
                  onMoveToAnnotating={handleMoveToAnnotating}
                  onMoveToDataset={handleMoveToDataset}
                  onDeleteDataset={handleDeleteDataset}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Text type="secondary">No unassigned datasets found.</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Annotating Section */}
        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Annotating</Text>
                <Text type="secondary">{managementData?.annotating?.count || 0} Datasets</Text>
              </div>
            }
            style={{ height: '500px', overflow: 'auto' }}
          >
            {managementData?.annotating?.datasets?.length > 0 ? (
              managementData.annotating.datasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  status="annotating"
                  onDatasetClick={handleDatasetClick}
                  onRenameDataset={handleRenameDataset}
                  onMoveToUnassigned={handleMoveToUnassigned}
                  onMoveToAnnotating={handleMoveToAnnotating}
                  onMoveToDataset={handleMoveToDataset}
                  onDeleteDataset={handleDeleteDataset}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Text type="secondary">Upload and assign images to an annotator.</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Dataset Section */}
        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Dataset</Text>
                <Text type="secondary">{managementData?.dataset?.count || 0} Datasets</Text>
              </div>
            }
            style={{ height: '500px', overflow: 'auto' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Button type="link" icon={<EyeOutlined />}>
                See all {project?.image_count || 0} images
              </Button>
            </div>

            {managementData?.dataset?.datasets?.length > 0 ? (
              managementData.dataset.datasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  status="completed"
                  onDatasetClick={handleDatasetClick}
                  onRenameDataset={handleRenameDataset}
                  onMoveToUnassigned={handleMoveToUnassigned}
                  onMoveToAnnotating={handleMoveToAnnotating}
                  onMoveToDataset={handleMoveToDataset}
                  onDeleteDataset={handleDeleteDataset}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Text type="secondary">No completed datasets found.</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ManagementSection;
