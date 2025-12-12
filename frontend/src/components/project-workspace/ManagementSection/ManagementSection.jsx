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
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

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
          logUserClick('dataset_rename_menu_clicked', `User clicked rename menu for dataset: ${dataset.name}`);
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
          logUserClick('dataset_move_to_unassigned_menu_clicked', `User clicked move to unassigned menu for dataset: ${dataset.name}`);
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
            logUserClick('dataset_move_to_completed_menu_clicked', `User clicked move to completed menu for dataset: ${dataset.name}`);
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
            logUserClick('dataset_move_to_unassigned_menu_clicked', `User clicked move to unassigned menu for dataset: ${dataset.name}`);
            onMoveToUnassigned(dataset);
          }
        },
        {
          key: 'move-to-annotating',
          label: 'Move to Annotating',
          icon: <PlayCircleOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation();
            logUserClick('dataset_move_to_annotating_menu_clicked', `User clicked move to annotating menu for dataset: ${dataset.name}`);
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
        logUserClick('dataset_delete_menu_clicked', `User clicked delete menu for dataset: ${dataset.name}`);
        onDeleteDataset(dataset);
      }
    });

    return baseItems;
  };

  const menuItems = getMenuItems();

  const handleCardClick = () => {
    logUserClick('dataset_card_clicked', `User clicked dataset card: ${dataset.name} (status: ${status})`);
    onDatasetClick(dataset, status);
  };

  const handleMoreButtonClick = (e) => {
    e.stopPropagation();
    logUserClick('dataset_more_button_clicked', `User clicked more button for dataset: ${dataset.name}`);
  };

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
      onClick={handleCardClick}
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
            onClick={handleMoreButtonClick}
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
    logInfo('app.frontend.interactions', 'management_data_loading_started', 'Started loading management data', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    setLoadingManagement(true);
    try {
      const data = await projectsAPI.getProjectManagementData(projectId);
      setManagementData(data);

      logInfo('app.frontend.interactions', 'management_data_loading_success', 'Successfully loaded management data', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        unassignedCount: data?.unassigned?.count || 0,
        annotatingCount: data?.annotating?.count || 0,
        completedCount: data?.dataset?.count || 0
      });
    } catch (error) {
      console.error('Error loading management data:', error);
      logError('app.frontend.interactions', 'management_data_loading_failed', 'Failed to load management data', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        error: error.message
      });
      handleAPIError(error);
    } finally {
      setLoadingManagement(false);
      logInfo('app.frontend.ui', 'management_loading_state_changed', 'Management loading state changed to false', {
        timestamp: new Date().toISOString(),
        projectId: projectId
      });
    }
  };

  useEffect(() => {
    // Validate project ID
    if (!projectId) {
      logError('app.frontend.validation', 'management_invalid_project_id', 'Management section validation failed: invalid project ID', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        validationType: 'invalid_project_id'
      });
      return;
    }

    if (projectId) {
      logInfo('app.frontend.ui', 'management_section_initialized', 'ManagementSection component initialized', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        projectName: project?.name
      });
      loadManagementData();
    }

    // Listen for dataset changes from other components
    const handleDatasetChange = (event) => {
      if (event.detail.projectId === projectId) {
        logInfo('app.frontend.interactions', 'management_auto_refresh_triggered', 'Management auto-refresh triggered by external change', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          action: event.detail.action
        });
        loadManagementData();
      }
    };

    window.addEventListener('datasetChanged', handleDatasetChange);

    return () => {
      window.removeEventListener('datasetChanged', handleDatasetChange);
    };
  }, [projectId]);

  // Handler functions
  const handleDatasetClick = (dataset, status) => {
    // Validate dataset object
    if (!dataset || !dataset.id || !dataset.name) {
      logError('app.frontend.validation', 'dataset_click_invalid_dataset', 'Dataset click validation failed: invalid dataset object', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset?.id,
        datasetName: dataset?.name,
        status: status,
        validationType: 'invalid_dataset_object'
      });
      return;
    }

    // Validate status
    const validStatuses = ['unassigned', 'annotating', 'completed'];
    if (!validStatuses.includes(status)) {
      logError('app.frontend.validation', 'dataset_click_invalid_status', 'Dataset click validation failed: invalid status', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name,
        status: status,
        validStatuses: validStatuses,
        validationType: 'invalid_status'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'dataset_click_handled', 'Dataset click handled', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name,
      status: status
    });

    if (status === 'annotating') {
      handleStartAnnotating(dataset);
    } else if (status === 'unassigned') {
      handleAssignToAnnotating(dataset);
    }
  };

  const handleStartAnnotating = (dataset) => {
    logInfo('app.frontend.navigation', 'navigate_to_annotation_launcher', 'Navigating to annotation launcher', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name,
      destination: `/annotate-launcher/${dataset.id}`
    });
    navigate(`/annotate-launcher/${dataset.id}`);
  };

  const handleAssignToAnnotating = async (dataset) => {
    // Validate dataset object
    if (!dataset || !dataset.id || !dataset.name) {
      logError('app.frontend.validation', 'assign_dataset_invalid_dataset', 'Assign dataset validation failed: invalid dataset object', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset?.id,
        datasetName: dataset?.name,
        validationType: 'invalid_dataset_object'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'assign_dataset_to_annotating_started', 'Started assigning dataset to annotating', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name
    });

    try {
      message.info(`Assigning dataset to annotating: ${dataset.name}`);
      await projectsAPI.assignDatasetToAnnotating(projectId, dataset.id);
      message.success(`Dataset assigned to annotating: ${dataset.name}`);

      logInfo('app.frontend.interactions', 'assign_dataset_to_annotating_success', 'Successfully assigned dataset to annotating', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name
      });

      loadManagementData(); // Reload data
    } catch (error) {
      logError('app.frontend.interactions', 'assign_dataset_to_annotating_failed', 'Failed to assign dataset to annotating', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name,
        error: error.message
      });
      handleAPIError(error);
    }
  };

  const handleRenameDataset = async (dataset) => {
    logInfo('app.frontend.interactions', 'rename_dataset_triggered', 'Dataset rename triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name
    });

    // Validate dataset object
    if (!dataset || !dataset.id || !dataset.name) {
      logError('app.frontend.validation', 'rename_dataset_invalid_dataset', 'Dataset rename validation failed: invalid dataset object', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset?.id,
        datasetName: dataset?.name,
        validationType: 'invalid_dataset_object'
      });
      return;
    }

    // Handle dataset rename with modal input
    const newName = prompt(`Enter new name for dataset "${dataset.name}":`, dataset.name);

    // Validation checks
    if (!newName || newName.trim() === '') {
      logError('app.frontend.validation', 'rename_dataset_empty_name', 'Dataset rename validation failed: empty name', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        oldName: dataset.name,
        newName: newName,
        validationType: 'empty_name'
      });
      return;
    }

    if (newName === dataset.name) {
      logError('app.frontend.validation', 'rename_dataset_same_name', 'Dataset rename validation failed: same name', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        oldName: dataset.name,
        newName: newName,
        validationType: 'same_name'
      });
      return;
    }

    // Name length validation
    if (newName.length > 100) {
      logError('app.frontend.validation', 'rename_dataset_name_too_long', 'Dataset rename validation failed: name too long', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        oldName: dataset.name,
        newName: newName,
        validationType: 'name_too_long',
        nameLength: newName.length
      });
      return;
    }

    // Name format validation - check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(newName)) {
      logError('app.frontend.validation', 'rename_dataset_invalid_characters', 'Dataset rename validation failed: invalid characters', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        oldName: dataset.name,
        newName: newName,
        validationType: 'invalid_characters',
        invalidChars: newName.match(invalidChars)
      });
      return;
    }

    // Name format validation - check for leading/trailing spaces
    if (newName !== newName.trim()) {
      logError('app.frontend.validation', 'rename_dataset_leading_trailing_spaces', 'Dataset rename validation failed: leading/trailing spaces', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        oldName: dataset.name,
        newName: newName,
        validationType: 'leading_trailing_spaces'
      });
      return;
    }

    if (newName && newName !== dataset.name) {
      logInfo('app.frontend.interactions', 'rename_dataset_started', 'Started renaming dataset', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        oldName: dataset.name,
        newName: newName
      });

      try {
        message.loading(`Renaming dataset to: ${newName}...`, 0);
        await projectsAPI.renameDataset(projectId, dataset.id, newName);
        message.destroy(); // Clear loading message
        message.success(`Dataset renamed to: ${newName}`);

        logInfo('app.frontend.interactions', 'rename_dataset_success', 'Successfully renamed dataset', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          datasetId: dataset.id,
          oldName: dataset.name,
          newName: newName
        });

        // Add a small delay to ensure backend operations complete
        setTimeout(() => {
          loadManagementData(); // Reload data
        }, 500);
      } catch (error) {
        message.destroy(); // Clear loading message
        logError('app.frontend.interactions', 'rename_dataset_failed', 'Failed to rename dataset', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          datasetId: dataset.id,
          oldName: dataset.name,
          newName: newName,
          error: error.message
        });
        handleAPIError(error);
      }
    } else {
      logInfo('app.frontend.interactions', 'rename_dataset_cancelled', 'Dataset rename cancelled by user', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name
      });
    }
  };

  const handleMoveToUnassigned = async (dataset) => {
    logInfo('app.frontend.interactions', 'move_dataset_to_unassigned_started', 'Started moving dataset to unassigned', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name
    });

    try {
      message.loading(`Moving dataset to unassigned: ${dataset.name}...`, 0);
      await projectsAPI.moveDatasetToUnassigned(projectId, dataset.id);
      message.destroy(); // Clear loading message
      message.success(`Dataset moved to unassigned: ${dataset.name}`);

      logInfo('app.frontend.interactions', 'move_dataset_to_unassigned_success', 'Successfully moved dataset to unassigned', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name
      });

      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        loadManagementData(); // Reload data
      }, 500);
    } catch (error) {
      message.destroy(); // Clear loading message
      logError('app.frontend.interactions', 'move_dataset_to_unassigned_failed', 'Failed to move dataset to unassigned', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name,
        error: error.message
      });
      handleAPIError(error);
    }
  };

  const handleMoveToAnnotating = async (dataset) => {
    logInfo('app.frontend.interactions', 'move_dataset_to_annotating_started', 'Started moving dataset to annotating', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name
    });

    try {
      message.loading(`Moving dataset to annotating: ${dataset.name}...`, 0);
      await projectsAPI.assignDatasetToAnnotating(projectId, dataset.id);
      message.destroy(); // Clear loading message
      message.success(`Dataset moved to annotating: ${dataset.name}`);

      logInfo('app.frontend.interactions', 'move_dataset_to_annotating_success', 'Successfully moved dataset to annotating', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name
      });

      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        loadManagementData(); // Reload data
      }, 500);
    } catch (error) {
      message.destroy(); // Clear loading message
      logError('app.frontend.interactions', 'move_dataset_to_annotating_failed', 'Failed to move dataset to annotating', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name,
        error: error.message
      });
      handleAPIError(error);
    }
  };

  const handleMoveToDataset = async (dataset) => {
    logInfo('app.frontend.interactions', 'move_dataset_to_completed_started', 'Started moving dataset to completed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name
    });

    try {
      message.loading(`Moving dataset to completed: ${dataset.name}...`, 0);
      await projectsAPI.moveDatasetToCompleted(projectId, dataset.id);
      message.destroy(); // Clear loading message
      message.success(`Dataset moved to completed: ${dataset.name}`);

      logInfo('app.frontend.interactions', 'move_dataset_to_completed_success', 'Successfully moved dataset to completed', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name
      });

      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        loadManagementData(); // Reload data
      }, 500);
    } catch (error) {
      message.destroy(); // Clear loading message
      logError('app.frontend.interactions', 'move_dataset_to_completed_failed', 'Failed to move dataset to completed', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name,
        error: error.message
      });
      handleAPIError(error);
    }
  };

  const handleDeleteDataset = async (dataset) => {
    logInfo('app.frontend.interactions', 'delete_dataset_started', 'Started deleting dataset', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      datasetId: dataset.id,
      datasetName: dataset.name
    });

    try {
      message.info(`Deleting dataset: ${dataset.name}`);
      await projectsAPI.deleteProjectDataset(projectId, dataset.id);
      message.success(`Dataset deleted: ${dataset.name}`);

      logInfo('app.frontend.interactions', 'delete_dataset_success', 'Successfully deleted dataset', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name
      });

      loadManagementData(); // Reload data
    } catch (error) {
      logError('app.frontend.interactions', 'delete_dataset_failed', 'Failed to delete dataset', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetId: dataset.id,
        datasetName: dataset.name,
        error: error.message
      });
      handleAPIError(error);
    }
  };

  const handleSortChange = (value) => {
    // Validation for sort value
    const validSortOptions = ['newest', 'oldest', 'name'];
    if (!validSortOptions.includes(value)) {
      logError('app.frontend.validation', 'management_sort_invalid_value', 'Management sort validation failed: invalid sort value', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        sortValue: value,
        validOptions: validSortOptions,
        validationType: 'invalid_sort_value'
      });
      return;
    }

    logInfo('app.frontend.ui', 'management_sort_changed', 'Management sort option changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      sortValue: value
    });
  };

  const handleNewVersionClick = () => {
    logUserClick('new_version_button_clicked', 'User clicked New Version button');
    logInfo('app.frontend.interactions', 'new_version_triggered', 'New version creation triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });
  };

  const handleUploadMoreClick = () => {
    logUserClick('upload_more_button_clicked', 'User clicked Upload More Images button');
    logInfo('app.frontend.navigation', 'navigate_to_upload_section', 'Navigating to upload section', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      destination: 'upload'
    });
    setSelectedKey('upload');
  };

  const handleSeeAllImagesClick = () => {
    logUserClick('see_all_images_button_clicked', 'User clicked See all images button');
    logInfo('app.frontend.navigation', 'navigate_to_dataset_section', 'Navigating to dataset section', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      destination: 'dataset',
      totalImages: project?.image_count || 0
    });
    setSelectedKey('dataset');
  };

  if (loadingManagement) {
    logInfo('app.frontend.ui', 'management_loading_state_active', 'Management loading state is active', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading management data...</Text>
        </div>
      </div>
    );
  }

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'management_section_rendered', 'ManagementSection component rendered', {
    timestamp: new Date().toISOString(),
    projectId: projectId,
    projectName: project?.name,
    unassignedCount: managementData?.unassigned?.count || 0,
    annotatingCount: managementData?.annotating?.count || 0,
    completedCount: managementData?.dataset?.count || 0
  });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: '8px', background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>
            <TagOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            Management
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Text type="secondary">Sort By:</Text>
            <Select defaultValue="newest" style={{ width: 120 }} onChange={handleSortChange}>
              <Select.Option value="newest">Newest</Select.Option>
              <Select.Option value="oldest">Oldest</Select.Option>
              <Select.Option value="name">Name</Select.Option>
            </Select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNewVersionClick}>
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
              <Button type="link" icon={<UploadOutlined />} onClick={handleUploadMoreClick}>
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
              <Button type="link" icon={<EyeOutlined />} onClick={handleSeeAllImagesClick}>
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
