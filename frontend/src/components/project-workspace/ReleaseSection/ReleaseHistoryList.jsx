

import React, { useState, useEffect } from 'react';
import { List, Button, Tag, Card, Space, Tooltip, Modal, Input, message, Empty, Spin, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, EditOutlined, DeleteOutlined, LinkOutlined, HistoryOutlined, ExclamationCircleOutlined, CalendarOutlined } from '@ant-design/icons';

const { confirm } = Modal;

const ReleaseHistoryList = ({ datasetId, onReleaseSelect }) => {
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
      const response = await fetch(`/releases/${datasetId}/history`);
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
      const response = await fetch(`/releases/${editingRelease.id}/rename`, {
        method: 'POST',
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
          const response = await fetch(`/api/v1/releases/${release.id}`, {
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
          <Tag color="blue">{releases.length} releases</Tag>
        </Space>
      }
      style={{ marginTop: 24 }}
      className="release-history-card"
    >
      {releases.length === 0 ? (
        <Empty
          description="No releases found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          itemLayout="vertical"
          size="large"
          dataSource={releases}
          renderItem={release => (
            <List.Item
              key={release.id}
              style={{
                padding: '16px',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                marginBottom: '12px',
                backgroundColor: '#fafafa',
                transition: 'all 0.3s ease'
              }}
              className="release-history-item"
              actions={[
                <Tooltip title="Download release">
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={() => handleDownload(release)}
                    type="primary"
                    size="small"
                  />
                </Tooltip>,
                <Tooltip title="Copy download link">
                  <Button 
                    icon={<LinkOutlined />} 
                    onClick={() => handleCopyLink(release)}
                    size="small"
                  />
                </Tooltip>,
                <Tooltip title="Rename release">
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={() => handleEdit(release)}
                    size="small"
                  />
                </Tooltip>,
                <Tooltip title="Delete release">
                  <Button 
                    icon={<DeleteOutlined />} 
                    onClick={() => handleDelete(release)}
                    danger
                    size="small"
                  />
                </Tooltip>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span style={{ fontSize: '16px' }}>{getTaskIcon(release.task_type)}</span>
                    <span style={{ fontWeight: 600, fontSize: '16px' }}>{release.name}</span>
                    <Tag color={getStatusColor(release.status)}>{release.status}</Tag>
                  </Space>
                }
                description={
                  <Space wrap>
                    <Tag color="blue">{release.task_type.replace('_', ' ')}</Tag>
                    <Tag color="green">{release.export_format.toUpperCase()}</Tag>
                    <Space>
                      <CalendarOutlined style={{ color: '#666' }} />
                      <span style={{ color: '#666', fontSize: '13px' }}>
                        {formatDate(release.created_at)}
                      </span>
                    </Space>
                  </Space>
                }
              />
              
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}>
                  <Statistic 
                    title="Images" 
                    value={release.total_images}
                    valueStyle={{ fontSize: '14px', color: '#1890ff' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="Classes" 
                    value={release.total_classes}
                    valueStyle={{ fontSize: '14px', color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="Format" 
                    value={release.export_format.toUpperCase()}
                    valueStyle={{ fontSize: '14px', color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </List.Item>
          )}
        />
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






