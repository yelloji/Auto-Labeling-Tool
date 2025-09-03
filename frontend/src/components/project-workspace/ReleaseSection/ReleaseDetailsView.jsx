import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Button, 
  Space, 
  Row, 
  Col, 
  Card, 
  Descriptions, 
  message, 
  Tag, 
  Spin, 
  Modal,
  Input,
  Tooltip,
  Divider,
  Typography,
  Image
} from 'antd';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined, 
  EditOutlined, 
  PlusOutlined,
  EyeOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileImageOutlined,
  TagsOutlined,
  SettingOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';
import { API_BASE_URL } from '../../../config';

const { Content } = Layout;
const { Title, Text } = Typography;

const ReleaseDetailsView = ({ 
  release, 
  onBack, 
  onDownload, 
  onRename, 
  onCreateNew,
  projectId 
}) => {
  const [releaseImages, setReleaseImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(release?.name || '');
const [isHeaderHovered, setIsHeaderHovered] = useState(false);
const [isDetailsHovered, setIsDetailsHovered] = useState(false);

  const handleCopy = (text, successMsg) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(successMsg);
    });
  };

  useEffect(() => {
    if (release) {
      loadReleaseImages();
      setNewName(release.name);
    }
  }, [release]);

  const loadReleaseImages = async () => {
    if (!release) return;

    logInfo('app.frontend.interactions', 'load_release_images_started', 'Loading release images started', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      releaseName: release.name,
      function: 'loadReleaseImages'
    });

    setLoading(true);
    try {
      // TODO: Replace with actual API call to get images from ZIP
      // For now, using mock data
      const mockImages = [
        {
          id: 1,
          filename: 'car_1.jpg',
          split: 'train',
          annotations: [
            { class: 'car', bbox: [100, 50, 200, 150], confidence: 0.95 }
          ],
          thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjkwIiB5PSI2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5jYXJfMS5qcGc8L3RleHQ+Cjwvc3ZnPgo='
        },
        {
          id: 2,
          filename: 'car_2.jpg',
          split: 'val',
          annotations: [
            { class: 'car', bbox: [80, 60, 180, 140], confidence: 0.92 }
          ],
          thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjkwIiB5PSI2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5jYXJfMi5qcGc8L3RleHQ+Cjwvc3ZnPgo='
        },
        {
          id: 3,
          filename: 'car_3.jpg',
          split: 'test',
          annotations: [
            { class: 'car', bbox: [120, 40, 220, 160], confidence: 0.88 }
          ],
          thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDE4MCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjkwIiB5PSI2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5jYXJfMy5qcGc8L3RleHQ+Cjwvc3ZnPgo='
        }
      ];

      setReleaseImages(mockImages);
      
      logInfo('app.frontend.interactions', 'load_release_images_success', 'Release images loaded successfully', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        imagesCount: mockImages.length,
        function: 'loadReleaseImages'
      });
    } catch (error) {
      logError('app.frontend.interactions', 'load_release_images_failed', 'Failed to load release images', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        error: error.message,
        function: 'loadReleaseImages'
      });
      message.error('Failed to load release images');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!newName || newName.trim() === '') {
      message.error('Release name cannot be empty');
      return;
    }

    logUserClick('release_rename_button_clicked', 'User clicked release rename button');
    logInfo('app.frontend.interactions', 'release_rename_started', 'Release rename started', {
      timestamp: new Date().toISOString(),
      releaseId: release.id,
      oldName: release.name,
      newName: newName,
      function: 'handleRename'
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // ✅ ENHANCED: Handle ZIP file rename information
        if (result.zip_renamed) {
          message.success(`Release renamed successfully! ZIP file also renamed to: ${result.new_zip_path?.split('/').pop() || 'new_name.zip'}`);
          
          logInfo('app.frontend.interactions', 'release_rename_success_with_zip', 'Release and ZIP file renamed successfully', {
            timestamp: new Date().toISOString(),
            releaseId: release.id,
            oldName: release.name,
            newName: newName,
            zipRenamed: result.zip_renamed,
            oldZipPath: result.old_zip_path,
            newZipPath: result.new_zip_path,
            function: 'handleRename'
          });
        } else {
          message.success('Release renamed successfully');
          
          logInfo('app.frontend.interactions', 'release_rename_success', 'Release renamed successfully (no ZIP file)', {
            timestamp: new Date().toISOString(),
            releaseId: release.id,
            oldName: release.name,
            newName: newName,
            zipRenamed: result.zip_renamed,
            function: 'handleRename'
          });
        }
        
        setEditingName(false);
        onRename && onRename(release.id, newName);
      } else {
        throw new Error('Failed to rename release');
      }
    } catch (error) {
      logError('app.frontend.interactions', 'release_rename_failed', 'Failed to rename release', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        oldName: release.name,
        newName: newName,
        error: error.message,
        function: 'handleRename'
      });
      message.error('Failed to rename release');
    }
  };

  const getSplitColor = (split) => {
    switch (split) {
      case 'train': return 'green';
      case 'val': return 'blue';
      case 'test': return 'orange';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!release) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text type="secondary">No release selected</Text>
      </div>
    );
  }

  return (
    <Layout style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <Content style={{ padding: '24px' }}>
        {/* Header with Back Button and Action Buttons */}
        <div style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button 
                  icon={<ArrowLeftOutlined />} 
                  onClick={onBack}
                  type="text"
                  size="large"
                >
                  Back to Release History
                </Button>
                <Divider type="vertical" />
                <Title level={3} style={{ margin: 0 }}>
                  {editingName ? (
                    <Space>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onPressEnter={handleRename}
                        onBlur={handleRename}
                        autoFocus
                        style={{ width: '300px' }}
                      />
                    </Space>
                  ) : (
                    <Space>
                      <span>{release.name}</span>
                      <Button 
                        icon={<EditOutlined />} 
                        type="text" 
                        size="small"
                        onClick={() => setEditingName(true)}
                      />
                    </Space>
                  )}
                </Title>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button 
                  icon={<PlusOutlined />} 
                  type="primary"
                  onClick={onCreateNew}
                >
                  Create New Release
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  type="primary"
                  onClick={() => onDownload && onDownload(release)}
                >
                  Download ZIP
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Release Information Card */}
        <Card style={{ marginBottom: '24px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          {/* Slim header for Created and Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 16px',
            background: '#ffffff',
            borderBottom: '1px solid #d9d9d9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <CalendarOutlined style={{ fontSize: '16px', color: '#52c41a', marginRight: '8px' }} />
              <span style={{ color: '#666', fontSize: '12px', marginRight: '4px' }}>Created:</span>
              <span style={{ color: '#389e0d', fontSize: '14px', fontWeight: 'bold' }}>
                {formatDate(release.created_at)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: '16px', color: '#389e0d', marginRight: '8px' }} />
              <span style={{ color: '#666', fontSize: '12px', marginRight: '4px' }}>Status:</span>
              <span style={{ color: '#389e0d', fontSize: '14px', fontWeight: 'bold' }}>
                {release.status || 'Completed'}
              </span>
            </div>
          </div>

          <div
            style={{
              background: isHeaderHovered ? '#e6f7ff' : '#f0f0f0',
              border: '1px solid #ffffff',
              borderRadius: '8px',
              padding: '8px'
            }}
            onMouseEnter={() => setIsHeaderHovered(true)}
            onMouseLeave={() => setIsHeaderHovered(false)}
          >
            <Row gutter={24}>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <FileImageOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {release.total_images || release.total_original_images || 0}
                  </div>
                  <div style={{ color: '#666' }}>Total Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <FileImageOutlined style={{ fontSize: '24px', color: 'green', marginBottom: '8px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseImages.filter(img => img.split === 'train').length}
                  </div>
                  <div style={{ color: '#666' }}>Train Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <FileImageOutlined style={{ fontSize: '24px', color: 'blue', marginBottom: '8px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseImages.filter(img => img.split === 'val').length}
                  </div>
                  <div style={{ color: '#666' }}>Val Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <FileImageOutlined style={{ fontSize: '24px', color: 'orange', marginBottom: '8px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseImages.filter(img => img.split === 'test').length}
                  </div>
                  <div style={{ color: '#666' }}>Test Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <TagsOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {release.total_classes || 0}
                  </div>
                  <div style={{ color: '#666' }}>Classes</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <SettingOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: '8px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {release.export_format?.toUpperCase() || 'YOLO'}
                  </div>
                  <div style={{ color: '#666' }}>Format</div>
                </div>
              </Col>
            </Row>
          </div>
          
          <Divider />

          <div
            style={{
              background: isDetailsHovered ? '#e6f7ff' : '#f0f0f0',
              border: '1px solid #ffffff',
              borderRadius: '8px',
              padding: '16px'
            }}
            onMouseEnter={() => setIsDetailsHovered(true)}
            onMouseLeave={() => setIsDetailsHovered(false)}
          >
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Task Type">
                <Tag color="blue">
                  {release.task_type?.replace('_', ' ') || 'Object Detection'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Model Path">
                <Space>
                  <Text code>{release.model_path || 'Not specified'}</Text>
                  {release.model_path && (
                    <Tooltip title="Copy to clipboard">
                      <CopyOutlined onClick={() => handleCopy(release.model_path, 'Model path copied!')} style={{ cursor: 'pointer' }} />
                    </Tooltip>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="ZIP File">
                <Space>
                  <Text code style={{ color: '#1677ff' }}>{release.model_path ? release.model_path.split('/')?.pop() : 'Not available'}</Text>
                  {release.model_path && (
                    <Tooltip title="Copy to clipboard">
                      <CopyOutlined onClick={() => handleCopy(release.model_path.split('/')?.pop(), 'ZIP file name copied!')} style={{ cursor: 'pointer' }} />
                    </Tooltip>
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Card>

        {/* Images Grid */}
        <Card title="Release Images" extra={<Text type="secondary">{releaseImages.length} images</Text>} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>Loading release images...</div>
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              {releaseImages.map((image) => (
                <Col key={image.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    size="small"
                    hoverable
                    style={{ height: '100%' }}
                    cover={
                      <div style={{ position: 'relative', height: '120px' }}>
                        <img
                          src={image.thumbnail}
                          alt={image.filename}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover' 
                          }}
                        />
                        {/* Annotation Overlay */}
                        {image.annotations?.map((annotation, index) => (
                          <div
                            key={index}
                            style={{
                              position: 'absolute',
                              left: `${(annotation.bbox[0] / 180) * 100}%`,
                              top: `${(annotation.bbox[1] / 120) * 100}%`,
                              width: `${((annotation.bbox[2] - annotation.bbox[0]) / 180) * 100}%`,
                              height: `${((annotation.bbox[3] - annotation.bbox[1]) / 120) * 100}%`,
                              border: '2px solid #ff4d4f',
                              backgroundColor: 'rgba(255, 77, 79, 0.1)',
                              pointerEvents: 'none'
                            }}
                          />
                        ))}
                      </div>
                    }
                  >
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {image.filename}
                      </div>
                      <Space size="small">
                        <Tag color={getSplitColor(image.split)} size="small">
                          {image.split.toUpperCase()}
                        </Tag>
                        {image.annotations?.length > 0 && (
                          <Tag color="red" size="small">
                            {image.annotations.length} label{image.annotations.length !== 1 ? 's' : ''}
                          </Tag>
                        )}
                      </Space>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default ReleaseDetailsView;
