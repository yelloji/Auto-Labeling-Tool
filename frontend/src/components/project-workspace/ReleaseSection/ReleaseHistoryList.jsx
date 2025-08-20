

import React, { useState, useEffect } from 'react';
import { List, Button, Tag, Card, Space, Tooltip, Modal, Input, message, Empty, Spin, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, EditOutlined, DeleteOutlined, LinkOutlined, HistoryOutlined, ExclamationCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../../config';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const { confirm } = Modal;

const ReleaseHistoryList = ({ projectId, datasetId, onReleaseSelect, onReleaseClick }) => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRelease, setEditingRelease] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    logInfo('app.frontend.ui', 'release_history_list_initialized', 'ReleaseHistoryList component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ReleaseHistoryList',
      projectId: projectId,
      datasetId: datasetId
    });

    // Load releases for the project (not just one dataset)
    if (projectId) {
      logInfo('app.frontend.ui', 'release_history_load_triggered', 'Release history load triggered by projectId', {
        timestamp: new Date().toISOString(),
        projectId: projectId
      });
      loadReleases();
    } else {
      logError('app.frontend.validation', 'release_history_no_project_id', 'ReleaseHistoryList initialized without projectId', {
        timestamp: new Date().toISOString(),
        function: 'useEffect'
      });
    }
  }, [projectId]);

  // ✅ FIXED: Listen for release history refresh trigger (NO CONSTANT POLLING)
  useEffect(() => {
    // Only refresh when explicitly triggered, not constantly
    if (window.releaseHistoryRefreshKey && projectId) {
      logInfo('app.frontend.ui', 'release_history_refresh_triggered', 'Release history refresh triggered', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        refreshKey: window.releaseHistoryRefreshKey,
        function: 'useEffect_refresh_trigger'
      });
      
      console.log('🔄 Release History refresh triggered by key:', window.releaseHistoryRefreshKey);
      loadReleases();
    }
  }, [projectId, window.releaseHistoryRefreshKey]); // Only depend on projectId and refreshKey

  const loadReleases = async () => {
    logInfo('app.frontend.interactions', 'load_releases_started', 'Loading release history started', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      function: 'loadReleases'
    });

    try {
      setLoading(true);
      // Get all releases for the project
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/releases`);
      if (response.ok) {
        const data = await response.json();
        setReleases(data);
        logInfo('app.frontend.interactions', 'load_releases_success', 'Release history loaded successfully', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          releaseCount: data.length,
          function: 'loadReleases'
        });
      } else {
        logError('app.frontend.interactions', 'load_releases_failed', 'Failed to load release history from API', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          status: response.status,
          statusText: response.statusText,
          function: 'loadReleases'
        });
        // Mock data for demonstration
        const mockReleases = [
          {
            id: '1',
            name: 'Release v1.0',
            created_at: '2024-01-15T10:30:00Z',
            total_images: 1500,
            total_classes: 6,
            task_type: 'object_detection',
            export_format: 'yolo',
            status: 'completed',
            download_url: '/api/releases/1/download'
          },
          {
            id: '2',
            name: 'Dataset-2024-01',
            created_at: '2024-01-10T14:20:00Z',
            total_images: 800,
            total_classes: 4,
            task_type: 'classification',
            export_format: 'csv',
            status: 'completed',
            download_url: '/api/releases/2/download'
          },
          {
            id: '3',
            name: 'Augmented Release',
            created_at: '2024-01-05T09:15:00Z',
            total_images: 2400,
            total_classes: 8,
            task_type: 'segmentation',
            export_format: 'coco',
            status: 'completed',
            download_url: '/api/releases/3/download'
          }
        ];
        setReleases(mockReleases);
        logInfo('app.frontend.ui', 'load_releases_mock_data', 'Using mock release data due to API failure', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          mockReleaseCount: mockReleases.length,
          function: 'loadReleases'
        });
      }
    } catch (error) {
      logError('app.frontend.interactions', 'load_releases_error', 'Error loading release history', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        error: error.message,
        function: 'loadReleases'
      });
      console.error('Failed to load releases:', error);
      message.error('Failed to load release history');
    } finally {
      setLoading(false);
      logInfo('app.frontend.ui', 'load_releases_completed', 'Release history loading completed', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        finalReleaseCount: releases.length,
        function: 'loadReleases'
      });
    }
  };

  const handleDownload = (release) => {
    logUserClick('release_download_button_clicked', 'User clicked release download button');
    logInfo('app.frontend.interactions', 'release_download_started', 'Release download started', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      downloadUrl: release.download_url,
      function: 'handleDownload'
    });

    if (release.download_url) {
      window.open(release.download_url, '_blank');
      message.success(`Downloading ${release.name}...`);
      logInfo('app.frontend.interactions', 'release_download_triggered', 'Release download triggered', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        downloadUrl: release.download_url,
        function: 'handleDownload'
      });
    } else {
      logError('app.frontend.validation', 'release_download_no_url', 'Release download failed - no download URL', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        function: 'handleDownload'
      });
      message.warning('Download not available for this release');
    }
  };

  const handleCopyLink = (release) => {
    logUserClick('release_copy_link_button_clicked', 'User clicked release copy link button');
    logInfo('app.frontend.interactions', 'release_copy_link_started', 'Release copy link started', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      downloadUrl: release.download_url,
      function: 'handleCopyLink'
    });

    if (release.download_url) {
      const fullUrl = window.location.origin + release.download_url;
      navigator.clipboard.writeText(fullUrl);
      message.success('Download link copied to clipboard!');
      logInfo('app.frontend.interactions', 'release_copy_link_success', 'Release download link copied successfully', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        fullUrl: fullUrl,
        function: 'handleCopyLink'
      });
    } else {
      logError('app.frontend.validation', 'release_copy_link_no_url', 'Release copy link failed - no download URL', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        function: 'handleCopyLink'
      });
    }
  };

  const handleEdit = (release) => {
    logUserClick('release_edit_button_clicked', 'User clicked release edit button');
    logInfo('app.frontend.ui', 'release_edit_modal_opened', 'Release edit modal opened', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      currentName: release.name,
      function: 'handleEdit'
    });

    setEditingRelease(release);
    setNewName(release.name);
  };

  const handleSaveEdit = async () => {
    logUserClick('release_save_edit_button_clicked', 'User clicked release save edit button');
    logInfo('app.frontend.interactions', 'release_rename_started', 'Release rename started', {
      timestamp: new Date().toISOString(),
      releaseId: editingRelease.id,
      oldName: editingRelease.name,
      newName: newName,
      function: 'handleSaveEdit'
    });

    if (!newName || newName.trim() === '') {
      logError('app.frontend.validation', 'release_rename_empty_name', 'Release rename failed - empty name', {
        timestamp: new Date().toISOString(),
        releaseId: editingRelease.id,
        newName: newName,
        function: 'handleSaveEdit'
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/${editingRelease.id}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        const result = await response.json();
        
        setReleases(releases.map(r => 
          r.id === editingRelease.id ? { ...r, name: newName } : r
        ));
        
        // ✅ ENHANCED: Handle ZIP file rename information
        if (result.zip_renamed) {
          message.success(`Release renamed successfully! ZIP file also renamed to: ${result.new_zip_path?.split('/').pop() || 'new_name.zip'}`);
          
          logInfo('app.frontend.interactions', 'release_rename_success_with_zip', 'Release and ZIP file renamed successfully', {
            timestamp: new Date().toISOString(),
            releaseId: editingRelease.id,
            oldName: editingRelease.name,
            newName: newName,
            zipRenamed: result.zip_renamed,
            oldZipPath: result.old_zip_path,
            newZipPath: result.new_zip_path,
            function: 'handleSaveEdit'
          });
        } else {
          message.success('Release renamed successfully');
          
          logInfo('app.frontend.interactions', 'release_rename_success', 'Release renamed successfully (no ZIP file)', {
            timestamp: new Date().toISOString(),
            releaseId: editingRelease.id,
            oldName: editingRelease.name,
            newName: newName,
            zipRenamed: result.zip_renamed,
            function: 'handleSaveEdit'
          });
        }
      } else {
        logError('app.frontend.interactions', 'release_rename_failed', 'Failed to rename release', {
          timestamp: new Date().toISOString(),
          releaseId: editingRelease.id,
          oldName: editingRelease.name,
          newName: newName,
          status: response.status,
          statusText: response.statusText,
          function: 'handleSaveEdit'
        });
        message.error('Failed to rename release');
      }
    } catch (error) {
      logError('app.frontend.interactions', 'release_rename_error', 'Error renaming release', {
        timestamp: new Date().toISOString(),
        releaseId: editingRelease.id,
        oldName: editingRelease.name,
        newName: newName,
        error: error.message,
        function: 'handleSaveEdit'
      });
      console.error('Failed to rename release:', error);
      message.error('Failed to rename release');
    } finally {
      setEditingRelease(null);
      setNewName('');
      logInfo('app.frontend.ui', 'release_edit_modal_closed', 'Release edit modal closed', {
        timestamp: new Date().toISOString(),
        function: 'handleSaveEdit'
      });
    }
  };

  const handleDelete = (release) => {
    logUserClick('release_delete_button_clicked', 'User clicked release delete button');
    logInfo('app.frontend.ui', 'release_delete_confirmation_opened', 'Release delete confirmation opened', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      function: 'handleDelete'
    });

    confirm({
      title: 'Delete Release',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${release.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        logUserClick('release_delete_confirmed', 'User confirmed release deletion');
        logInfo('app.frontend.interactions', 'release_delete_started', 'Release deletion started', {
          timestamp: new Date().toISOString(),
          releaseId: release.id,
          releaseName: release.name,
          function: 'handleDelete'
        });

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setReleases(releases.filter(r => r.id !== release.id));
            message.success('Release deleted successfully');
            logInfo('app.frontend.interactions', 'release_delete_success', 'Release deleted successfully', {
              timestamp: new Date().toISOString(),
              releaseId: release.id,
              releaseName: release.name,
              remainingReleases: releases.length - 1,
              function: 'handleDelete'
            });
          } else {
            logError('app.frontend.interactions', 'release_delete_failed', 'Failed to delete release', {
              timestamp: new Date().toISOString(),
              releaseId: release.id,
              releaseName: release.name,
              status: response.status,
              statusText: response.statusText,
              function: 'handleDelete'
            });
            message.error('Failed to delete release');
          }
        } catch (error) {
          logError('app.frontend.interactions', 'release_delete_error', 'Error deleting release', {
            timestamp: new Date().toISOString(),
            releaseId: release.id,
            releaseName: release.name,
            error: error.message,
            function: 'handleDelete'
          });
          console.error('Failed to delete release:', error);
          message.error('Failed to delete release');
        }
      },
      onCancel: () => {
        logUserClick('release_delete_cancelled', 'User cancelled release deletion');
        logInfo('app.frontend.ui', 'release_delete_confirmation_cancelled', 'Release delete confirmation cancelled', {
          timestamp: new Date().toISOString(),
          releaseId: release.id,
          releaseName: release.name,
          function: 'handleDelete'
        });
      }
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTaskIcon = (taskType) => {
    const icons = {
      'classification': '🏷️',
      'object_detection': '📦',
      'segmentation': '🎨'
    };
    return icons[taskType] || '📊';
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'success',
      'processing': 'processing',
      'failed': 'error',
      'pending': 'default'
    };
    return colors[status] || 'default';
  };

  if (loading) {
    logInfo('app.frontend.ui', 'release_history_loading_rendered', 'ReleaseHistoryList loading state rendered', {
      timestamp: new Date().toISOString(),
      datasetId: datasetId
    });

    return (
      <Card 
        title={
          <Space>
            <HistoryOutlined />
            <span>Release History</span>
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'release_history_list_rendered', 'ReleaseHistoryList component rendered', {
    timestamp: new Date().toISOString(),
    component: 'ReleaseHistoryList',
    datasetId: datasetId,
    releaseCount: releases.length,
    loading: loading,
    editingRelease: !!editingRelease
  });

  return (
    <Card 
      title={
        <Space>
          <HistoryOutlined />
          <span>Release History</span>
          <Tag color="blue">{releases.length}</Tag>
        </Space>
      }
      style={{ marginBottom: 24 }}
      className="release-history-card"
      size="small"
    >
      {releases.length === 0 ? (
        <Empty
          description="No releases found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '20px 0' }}
        />
      ) : (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {releases.map(release => (
            <Card
              key={release.id}
              size="small"
              style={{
                marginBottom: '12px',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              className="release-history-item"
              onClick={() => {
                logUserClick('release_card_clicked', 'User clicked release card');
                logInfo('app.frontend.navigation', 'release_selected', 'Release selected from history', {
                  timestamp: new Date().toISOString(),
                  releaseId: release.id,
                  releaseName: release.name
                });
                onReleaseClick && onReleaseClick(release);
              }}
              hoverable
            >
              {/* Release Header */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 4
                }}>
                  <Space size="small">
                    <span style={{ fontSize: '14px' }}>{getTaskIcon(release.task_type)}</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{release.name}</span>
                  </Space>
                  <Tag color={getStatusColor(release.status)} size="small">{release.status}</Tag>
                </div>
                
                <div style={{ fontSize: '12px', color: '#666', marginBottom: 8 }}>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  {formatDate(release.created_at)}
                </div>
                
                <Space wrap size="small">
                  <Tag color="blue" size="small">{release.task_type.replace('_', ' ')}</Tag>
                  <Tag color="green" size="small">{release.export_format.toUpperCase()}</Tag>
                </Space>
              </div>
              
              {/* Release Stats */}
              <Row gutter={8} style={{ marginBottom: 8 }}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1890ff' }}>
                      {release.total_images}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>Images</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#52c41a' }}>
                      {release.total_classes}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>Classes</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#722ed1' }}>
                      {release.export_format.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>Format</div>
                  </div>
                </Col>
              </Row>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                <Tooltip title="Download">
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      handleDownload(release);
                    }}
                    type="primary"
                    size="small"
                    style={{ flex: 1 }}
                  />
                </Tooltip>
                <Tooltip title="Copy link">
                  <Button 
                    icon={<LinkOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      handleCopyLink(release);
                    }}
                    size="small"
                  />
                </Tooltip>
                <Tooltip title="Rename">
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      handleEdit(release);
                    }}
                    size="small"
                  />
                </Tooltip>
                <Tooltip title="Delete">
                  <Button 
                    icon={<DeleteOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      handleDelete(release);
                    }}
                    danger
                    size="small"
                  />
                </Tooltip>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="Rename Release"
        visible={!!editingRelease}
        onOk={handleSaveEdit}
        onCancel={() => {
          logUserClick('release_edit_modal_cancel_button_clicked', 'User clicked release edit modal cancel button');
          logInfo('app.frontend.ui', 'release_edit_modal_cancelled', 'Release edit modal cancelled', {
            timestamp: new Date().toISOString(),
            releaseId: editingRelease?.id,
            releaseName: editingRelease?.name
          });
          setEditingRelease(null);
          setNewName('');
        }}
        okText="Save"
        cancelText="Cancel"
      >
        <Input
          value={newName}
          onChange={(e) => {
            logInfo('app.frontend.ui', 'release_edit_name_changed', 'Release edit name changed', {
              timestamp: new Date().toISOString(),
              oldValue: newName,
              newValue: e.target.value,
              releaseId: editingRelease?.id
            });
            setNewName(e.target.value);
          }}
          placeholder="Enter new release name"
          onPressEnter={handleSaveEdit}
        />
      </Modal>
    </Card>
  );
};

export default ReleaseHistoryList;






