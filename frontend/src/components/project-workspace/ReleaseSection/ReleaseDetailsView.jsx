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
  Image,
  List
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
  CopyOutlined,
  InfoCircleOutlined
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
const [releaseConfig, setReleaseConfig] = useState(null);

useEffect(() => {
  if (release) {
    // Fetch release_config.json from backend
    fetch(`${API_BASE_URL}/api/v1/releases/${release.id}/package-info`)
      .then(res => res.json())
      .then(data => {
        setReleaseConfig(data.release_config || null);
      })
      .catch(err => {
        message.error('Failed to load release config');
        setReleaseConfig(null);
      });
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px', background: '#ffffff', borderBottom: '1px solid #d9d9d9' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <CalendarOutlined style={{ fontSize: '16px', color: '#52c41a', marginRight: '8px' }} />
              <span style={{ color: '#666', fontSize: '12px', marginRight: '4px' }}>Created:</span>
              <span style={{ color: '#389e0d', fontSize: '14px', fontWeight: 'bold' }}>{formatDate(release.created_at)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: '16px', color: '#389e0d', marginRight: '8px' }} />
              <span style={{ color: '#666', fontSize: '12px', marginRight: '4px' }}>Status:</span>
              <span style={{ color: '#389e0d', fontSize: '14px', fontWeight: 'bold' }}>{release.status || 'Completed'}</span>
            </div>
          </div>

          <div
            style={{
              background: isHeaderHovered ? 'linear-gradient(135deg, #e1f5fe 0%, #f8e5ff 100%)' : 'linear-gradient(135deg, #e0f7fa 0%, #f3e5f5 100%)',
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
                  <div style={{ marginBottom: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="totalImagesGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#1890ff" />
                          <stop offset="100%" stopColor="#40a9ff" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#totalImagesGradient)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      <circle fill="url(#totalImagesGradient)" cx="18" cy="6" r="2" opacity="0.8"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseConfig?.total_images ?? '--'}
                  </div>
                  <div style={{ color: '#666' }}>Total Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="trainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#52c41a" />
                          <stop offset="100%" stopColor="#73d13d" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#trainGradient)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      <path fill="url(#trainGradient)" d="M9 11h6v2H9z" opacity="0.8"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseConfig?.split_counts?.train ?? '--'}
                  </div>
                  <div style={{ color: '#666' }}>Train Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="validationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#1890ff" />
                          <stop offset="100%" stopColor="#40a9ff" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#validationGradient)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseConfig?.split_counts?.val ?? '--'}
                  </div>
                  <div style={{ color: '#666' }}>Validation Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="testGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#fa8c16" />
                          <stop offset="100%" stopColor="#ffa940" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#testGradient)" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {releaseConfig?.split_counts?.test ?? '--'}
                  </div>
                  <div style={{ color: '#666' }}>Test Images</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="classesGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#52c41a" />
                          <stop offset="100%" stopColor="#73d13d" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#classesGradient)" d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
                      <path fill="url(#classesGradient)" d="M7 9h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2z" opacity="0.8"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {release.total_classes || 0}
                  </div>
                  <div style={{ color: '#666' }}>Classes</div>
                </div>
              </Col>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="formatGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#722ed1" />
                          <stop offset="100%" stopColor="#9254de" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#formatGradient)" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      <path fill="url(#formatGradient)" d="M8 12h8v2H8zm0 4h6v2H8z" opacity="0.8"/>
                      <circle fill="url(#formatGradient)" cx="16" cy="6" r="1.5" opacity="0.6"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {release.export_format?.toUpperCase() || 'YOLO'}
                  </div>
                  <div style={{ color: '#666' }}>Format</div>
                </div>
              </Col>
            </Row>
          </div>
          
          <Divider />
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Title level={4} style={{ margin: 0, background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Transformation</Title>
            <span style={{ marginLeft: '8px', fontSize: '16px', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="transformationIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1890ff" />
                    <stop offset="100%" stop-color="#722ed1" />
                  </linearGradient>
                </defs>
                <path fill="url(#transformationIconGradient)" d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
                <path fill="url(#transformationIconGradient)" d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" />
              </svg>
            </span>
          </div>

          {/* Metadata Cards Row */}
          <Row gutter={[24, 8]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} md={8} lg={8}>
              <Card size="small" bordered={false} style={{
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #e3f2fd 0%, #e3f2fd 100%)',
                boxShadow: '0 2px 8px rgba(60, 60, 120, 0.08)',
                padding: '8px 12px',
                minHeight: 'auto',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '8px'
              }} bodyStyle={{ padding: 0 }}>
                <span style={{ fontSize: '18px', color: '#1976d2', flexShrink: 0 }}>
                   <i className="fas fa-images" />
                 </span>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <div style={{ fontWeight: 600, fontSize: '14px', color: '#1976d2' }}>Images per Original:</div>
                   <div style={{ fontSize: '16px', color: '#333', whiteSpace: 'nowrap', fontWeight: 500 }}>{releaseConfig?.images_per_original ?? '--'}</div>
                 </div>
              </Card>
              </Col>
              <Col xs={24} sm={8} md={8} lg={8}>
                <Card size="small" bordered={false} style={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #e3f2fd 100%)',
                  boxShadow: '0 2px 8px rgba(60, 60, 120, 0.08)',
                  padding: '8px 12px',
                  minHeight: 'auto',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '8px'
                }} bodyStyle={{ padding: 0 }}>
                  <span style={{ fontSize: '18px', color: '#1976d2', flexShrink: 0 }}>
                     <i className="fas fa-file-archive" />
                   </span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div style={{ fontWeight: 600, fontSize: '14px', color: '#1976d2' }}>Output Format:</div>
                     <div style={{ fontSize: '16px', color: '#333', whiteSpace: 'nowrap', fontWeight: 500 }}>{releaseConfig?.output_format ?? '--'}</div>
                   </div>
                </Card>
                </Col>
                <Col xs={24} sm={8} md={8} lg={8}>
                <Card size="small" bordered={false} style={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #e3f2fd 100%)',
                  boxShadow: '0 2px 8px rgba(60, 60, 120, 0.08)',
                  padding: '8px 12px',
                  minHeight: 'auto',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '8px'
                }} bodyStyle={{ padding: 0 }}>
                  <span style={{ fontSize: '18px', color: '#1976d2', flexShrink: 0 }}>
                      <i className="fas fa-tags" />
                    </span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div style={{ fontWeight: 600, fontSize: '14px', color: '#1976d2' }}>Classes:</div>
                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '3px', justifyContent: 'flex-start', alignItems: 'center', overflow: 'auto' }}>
                      {releaseConfig?.classes?.map((cls, idx) => {
                        const classColors = ['#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b'];
                        const bgColor = classColors[idx % classColors.length];
                        return (
                          <span key={cls} style={{
                             background: bgColor,
                             color: '#fff',
                             borderRadius: '3px',
                             padding: '2px 5px',
                             fontWeight: 500,
                             fontSize: releaseConfig?.classes?.length > 6 ? '9px' : releaseConfig?.classes?.length > 4 ? '10px' : '11px',
                             minHeight: 'auto',
                             display: 'inline-flex',
                             alignItems: 'center',
                             lineHeight: 1.1,
                             whiteSpace: 'nowrap'
                           }}>{cls}</span>
                        );
                      })}
                    </div>
                  </div>
                </Card>
                </Col>
              </Row>

              <div
                style={{
                  background: 'linear-gradient(135deg, #e0f7fa 0%, #f3e5f5 100%)',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 24px rgba(60, 60, 120, 0.08)',
                  marginBottom: '24px'
                }}
                onMouseEnter={() => setIsDetailsHovered(true)}
                onMouseLeave={() => setIsDetailsHovered(false)}
              >
                {releaseConfig?.transformations && releaseConfig.transformations.length > 0 ? (
                  <Row gutter={[24, 24]} style={{ justifyContent: 'flex-start' }}>
                    {releaseConfig.transformations.map((item, idx) => {
                      // Emoji icon mapping for all 18 tools
                      const emojiIcons = {
                        resize: '📏', rotate: '🔄', flip: '🔀', crop: '✂️', brightness: '☀️', contrast: '🌗', blur: '🌫️', noise: '📺', color_jitter: '🎨', cutout: '⬛', random_zoom: '🔍', affine_transform: '📐', perspective_warp: '🏗️', grayscale: '⚫', shear: '📊', gamma_correction: '💡', equalize: '⚖️', clahe: '🔆'
                      };
                      const icon = <span style={{fontSize:'32px'}}>{emojiIcons[item.type] || '⚙️'}</span>;
                      // Generate readable description for each tool
                      const paramDesc = [];
                      if (item.params) {
                        Object.entries(item.params).forEach(([key, val]) => {
                          // Use transformationUtils.js formatting
                          let unit = '';
                          let formatted = '';
                          if (typeof val === 'number') {
                            if (key === 'width' || key === 'height' || key === 'hole_size') unit = 'px';
                            else if (key === 'angle' || key === 'rotation') unit = '°';
                            else if (key === 'scale' || key === 'crop_percentage' || key === 'percentage' || key === 'strength' || key === 'intensity') unit = '%';
                            else if (key === 'gamma') unit = '';
                            else if (key === 'factor') unit = '×';
                            else if (key === 'grid_size' || key === 'clip_limit') unit = '';
                            formatted = `${val}${unit}`;
                          } else if (typeof val === 'boolean') {
                            formatted = val ? 'Yes' : 'No';
                          } else {
                            formatted = val;
                          }
                          paramDesc.push(`${key.charAt(0).toUpperCase()+key.slice(1)}: ${formatted}`);
                        });
                      }
                      let description = paramDesc.length > 0 ? paramDesc.join(', ') : 'No parameters';
                      // Special readable text for common tools
                      if (item.type === 'resize' && item.params?.width && item.params?.height) description = `Resize to ${item.params.width}x${item.params.height} px`;
                      if (item.type === 'brightness' && item.params?.percentage) description = `Adjust brightness by ${item.params.percentage}%`;
                      if (item.type === 'contrast' && item.params?.percentage) description = `Adjust contrast by ${item.params.percentage}%`;
                      if (item.type === 'rotate' && item.params?.angle) description = `Rotate by ${item.params.angle}°`;
                      if (item.type === 'flip') description = `Flip: ${item.params?.horizontal?'Horizontal':''}${item.params?.vertical?' Vertical':''}`.trim() || 'Flip';
                      if (item.type === 'crop' && item.params?.crop_percentage) description = `Crop ${item.params.crop_percentage}%`;
                      if (item.type === 'blur' && item.params?.radius) description = `Blur radius ${item.params.radius}px`;
                      if (item.type === 'noise' && item.params?.intensity) description = `Noise intensity ${item.params.intensity}%`;
                      if (item.type === 'color_jitter') description = paramDesc.join(', ');
                      if (item.type === 'cutout' && item.params?.num_holes && item.params?.hole_size) description = `Cutout ${item.params.num_holes} holes (${item.params.hole_size}px)`;
                      if (item.type === 'random_zoom' && item.params?.scale) description = `Random zoom ${item.params.scale}%`;
                      if (item.type === 'affine_transform') description = paramDesc.join(', ');
                      if (item.type === 'perspective_warp' && item.params?.strength) description = `Perspective warp strength ${item.params.strength}%`;
                      if (item.type === 'grayscale') description = 'Convert to grayscale';
                      if (item.type === 'shear' && item.params?.angle) description = `Shear by ${item.params.angle}°`;
                      if (item.type === 'gamma_correction' && item.params?.gamma) description = `Gamma correction ${item.params.gamma}`;
                      if (item.type === 'equalize') description = 'Histogram equalization';
                      if (item.type === 'clahe' && item.params?.grid_size && item.params?.clip_limit) description = `CLAHE grid ${item.params.grid_size}, clip ${item.params.clip_limit}`;
                      return (
                        <Col xs={24} sm={12} md={8} lg={8} key={idx}>
                          <Card
                            size="small"
                            bordered={false}
                            style={{
                              borderRadius: '12px',
                              background: 'linear-gradient(135deg, #fff 0%, #e3f2fd 100%)',
                              boxShadow: '0 2px 12px rgba(60, 60, 120, 0.10)',
                              padding: '16px',
                              minHeight: '110px',
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: '16px'
                            }}
                            bodyStyle={{ padding: 0 }}
                            title={null}
                          >
                            <div style={{ marginRight: '16px', flexShrink: 0 }}>{icon}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '16px', color: '#1976d2', marginBottom: '4px' }}>
                                {item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('_', ' ')}
                              </div>
                              <div style={{ fontSize: '14px', color: '#333' }}>{description}</div>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <img src="https://cdn.jsdelivr.net/gh/ant-design/ant-design-icons@4.7.0/svg/outline/InboxOutline.svg" alt="No data" style={{ width: 48, opacity: 0.3, marginBottom: 8 }} />
                    <div style={{ color: '#888' }}>No transformation data available yet. We'll integrate this soon.</div>
                  </div>
                )}
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
