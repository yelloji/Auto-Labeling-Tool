

import React, { useState, useEffect } from 'react';
import { List, Button, Tag, Card, Space, Tooltip, Modal, Input, message, Empty, Spin, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, EditOutlined, DeleteOutlined, LinkOutlined, HistoryOutlined, ExclamationCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../../config';

const { confirm } = Modal;

const ReleaseHistoryList = ({ datasetId, onReleaseSelect, onReleaseClick }) => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRelease, setEditingRelease] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (datasetId) {
      loadReleases();
    }
  }, [datasetId]);

  const loadReleases = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/${datasetId}/history`);
      if (response.ok) {
        const data = await response.json();
        setReleases(data);
      } else {
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
      }
    } catch (error) {
      console.error('Failed to load releases:', error);
      message.error('Failed to load release history');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (release) => {
    if (release.download_url) {
      window.open(release.download_url, '_blank');
      message.success(`Downloading ${release.name}...`);
    } else {
      message.warning('Download not available for this release');
    }
  };

  const handleCopyLink = (release) => {
    if (release.download_url) {
      const fullUrl = window.location.origin + release.download_url;
      navigator.clipboard.writeText(fullUrl);
      message.success('Download link copied to clipboard!');
    }
  };

  const handleEdit = (release) => {
    setEditingRelease(release);
    setNewName(release.name);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/${editingRelease.id}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        setReleases(releases.map(r => 
          r.id === editingRelease.id ? { ...r, name: newName } : r
        ));
        message.success('Release renamed successfully');
      } else {
        message.error('Failed to rename release');
      }
    } catch (error) {
      console.error('Failed to rename release:', error);
      message.error('Failed to rename release');
    } finally {
      setEditingRelease(null);
      setNewName('');
    }
  };

  const handleDelete = (release) => {
    confirm({
      title: 'Delete Release',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${release.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setReleases(releases.filter(r => r.id !== release.id));
            message.success('Release deleted successfully');
          } else {
            message.error('Failed to delete release');
          }
        } catch (error) {
          console.error('Failed to delete release:', error);
          message.error('Failed to delete release');
        }
      },
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
              onClick={() => onReleaseClick && onReleaseClick(release)}
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
                      onReleaseClick && onReleaseClick(release);
                    }}
                    type="primary"
                    size="small"
                    style={{ flex: 1 }}
                  />
                </Tooltip>
                <Tooltip title="Copy link">
                  <Button 
                    icon={<LinkOutlined />} 
                    onClick={() => handleCopyLink(release)}
                    size="small"
                  />
                </Tooltip>
                <Tooltip title="Rename">
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={() => handleEdit(release)}
                    size="small"
                  />
                </Tooltip>
                <Tooltip title="Delete">
                  <Button 
                    icon={<DeleteOutlined />} 
                    onClick={() => handleDelete(release)}
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
          setEditingRelease(null);
          setNewName('');
        }}
        okText="Save"
        cancelText="Cancel"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter new release name"
          onPressEnter={handleSaveEdit}
        />
      </Modal>
    </Card>
  );
};

export default ReleaseHistoryList;






