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
import ReleaseImageViewerModal from './ReleaseImageViewerModal';

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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [releaseConfig, setReleaseConfig] = useState({});
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isDetailsHovered, setIsDetailsHovered] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [imagesPerPage] = useState(50);
  const [annotations, setAnnotations] = useState({});
  const [classMapping, setClassMapping] = useState({});
  const [showAnnotations, setShowAnnotations] = useState(true);

useEffect(() => {
  if (release) {
    loadReleaseImages();
    setNewName(release.name);
  }
}, [release]);

  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setModalVisible(true);
  };

  // Pagination logic
  const totalImages = releaseImages.length;
  const totalPages = Math.ceil(totalImages / imagesPerPage);
  const startIndex = (currentPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const currentImages = releaseImages.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

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
      // Fetch package info to get real image filenames
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}/package-info`);
      if (!response.ok) {
        throw new Error(`Failed to fetch package info: ${response.status}`);
      }
      
      const packageData = await response.json();
      const { image_files, file_counts } = packageData;
      
      // Create image objects from real filenames
      const images = [];
      let imageId = 1;
      
      // Process each split (train, val, test)
      ['train', 'val', 'test'].forEach(split => {
        if (image_files[split]) {
          image_files[split].forEach(filename => {
            // Extract just the filename without path
            const displayName = filename.split('/').pop();
            
            images.push({
              id: imageId++,
              filename: displayName,
              fullPath: filename, // Keep full path for API requests
              split: split,
              path: filename,
              thumbnailUrl: `${API_BASE_URL}/api/v1/releases/${release.id}/file/${filename}?thumbnail=true`,
              fullImageUrl: `${API_BASE_URL}/api/v1/releases/${release.id}/file/${filename}`,
              hasAnnotations: file_counts?.labels?.[split] > 0,
              annotationFile: `labels/${split}/${displayName.replace(/\.(jpg|jpeg|png)$/i, '.txt')}`
            });
          });
        }
      });

      setReleaseImages(images);
      setCurrentPage(1); // Reset to first page when loading new images
      
      // Store annotations and class mapping
      console.log('📊 Package Data:', packageData);
      console.log('🎯 Annotations received:', packageData.annotations);
      console.log('🏷️ Class mapping received:', packageData.class_mapping);
      console.log('🗂️ Image files structure:', packageData.image_files);
      
      // Debug: Check if annotations exist and their structure
      if (packageData.annotations && Object.keys(packageData.annotations).length > 0) {
        console.log('✅ Annotations found! Keys:', Object.keys(packageData.annotations));
        console.log('📝 First annotation example:', Object.entries(packageData.annotations)[0]);
      } else {
        console.log('❌ No annotations found in package data');
      }
      
      setAnnotations(packageData.annotations || {});
      setClassMapping(packageData.class_mapping || {});
      
      // Update releaseConfig with accurate counts
      setReleaseConfig({
        ...packageData.release_config,
        total_images: file_counts?.images?.total || 0,
        train_images: file_counts?.images?.train || 0,
        val_images: file_counts?.images?.val || 0,
        test_images: file_counts?.images?.test || 0,
        has_annotations: file_counts?.labels?.total > 0
      });
      
      logInfo('app.frontend.interactions', 'load_release_images_success', 'Release images loaded successfully', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        imagesCount: images.length,
        realFilenames: true,
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
      setReleaseImages([]);
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

  const getClassColor = (classId) => {
    const colors = ['#ff4d4f', '#52c41a', '#1890ff', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2', '#a0d911'];
    return colors[classId % colors.length];
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

  const release_id = release.id;
  const mappedImages = releaseImages.map((img, index) => {
    const { filename, split, path, thumbnailUrl, hasAnnotations } = img;
    return (
      <Col 
        span={4} 
        key={`${split}-${filename}-${index}`}
        style={{}}
      >
        <Card
          hoverable
          onClick={() => {
            setSelectedImageIndex(index);
            setModalVisible(true);
          }}
          style={{}}
          cover={
            <div style={{ 
              position: 'relative', 
              height: '200px', 
              width: '100%',
              // Enhanced CSS containment to isolate from browser zoom
              contain: 'layout style size paint',
              // Force consistent sizing regardless of zoom
              minHeight: '200px',
              maxHeight: '200px',
              boxSizing: 'border-box',
              overflow: 'hidden',
              // Additional zoom isolation
              transform: 'scale(1)',
              transformOrigin: 'top left',
              isolation: 'isolate'
            }}>
              <img
                alt={filename}
                src={`${thumbnailUrl}?v=${Date.now()}`}
                style={{ 
                  height: '100%', 
                  width: '100%', 
                  objectFit: 'contain', 
                  backgroundColor: '#f5f5f5',
                  // Prevent image from being affected by zoom
                  imageRendering: 'auto',
                  transform: 'scale(1)'
                }}
              onLoad={() => {
                console.log(`✅ Image loaded successfully: ${filename}`);
                logInfo('app.frontend.ui', 'release_image_loaded', 'Release image loaded successfully', {
                  timestamp: new Date().toISOString(),
                  filename: filename,
                  releaseId: release_id,
                  imagePath: path,
                  thumbnailUrl: thumbnailUrl
                });
              }}
              onError={(e) => {
                console.error(`❌ Image failed to load: ${filename}`, e);
                logError('app.frontend.ui', 'release_image_load_failed', 'Release image failed to load', {
                  timestamp: new Date().toISOString(),
                  filename: filename,
                  releaseId: release_id,
                  imagePath: path,
                  thumbnailUrl: thumbnailUrl,
                  error: e.message || 'Image load error'
                });
              }}
            />
            
            {/* Annotation overlay with enhanced debugging and zoom stability */}
            {(() => {
              // Enhanced key matching with cross-platform path handling
              const normalizedPath = path.replace(/\\/g, '/');
              const backslashPath = path.replace(/\//g, '\\');
              const possibleKeys = [
                // Original path formats
                path,
                normalizedPath,
                backslashPath,
                // Filename formats
                filename,
                filename.replace(/\.[^/.]+$/, ""), // Remove extension
                // Split-based formats
                `${split}/${filename}`,
                `${split}/${filename.replace(/\.[^/.]+$/, "")}`, // Remove extension from split/filename
                `images/${split}/${filename}`,
                `images\\${split}\\${filename}`,
                // Additional path variations
                path.replace(/\.[^/.]+$/, ""), // Remove extension from path
                normalizedPath.replace(/\.[^/.]+$/, ""),
                backslashPath.replace(/\.[^/.]+$/, "")
              ];
              
              // Debug logging
              console.log(`🔍 Available annotation keys: (${Object.keys(annotations).length})`, Object.keys(annotations));
              console.log(`🔍 Trying keys for ${filename} (split: ${split}): (${possibleKeys.length})`, possibleKeys);
              console.log(`🔍 Image path: ${path}, filename: ${filename}, split: ${split}`);
              
              let annotationKey = null;
              let imageAnnotations = null;
              
              for (const key of possibleKeys) {
                if (annotations && annotations[key]) {
                  annotationKey = key;
                  imageAnnotations = annotations[key];
                  console.log(`✅ Found annotations for ${filename} using key: ${key}`, imageAnnotations);
                  break;
                }
              }
              
              if (!annotationKey) {
                console.log(`❌ No annotations found for ${filename} with any key variant`);
              }
              
              return showAnnotations && imageAnnotations && (
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    // Enhanced zoom stability
                    transform: 'scale(1)',
                    transformOrigin: 'top left',
                    isolation: 'isolate'
                  }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {imageAnnotations.map((annotation, annIndex) => {
                    const { class_id, bbox, polygon, segmentation, type } = annotation;
                    const className = classMapping[class_id] || `Class ${class_id}`;
                    
                    console.log(`🎨 Rendering annotation ${annIndex} for ${filename}:`, { class_id, polygon: polygon ? `Array(${polygon.length})` : 'none', bbox: bbox ? `Array(${bbox.length})` : 'none' });
                    
                    // Generate color based on class_id
                    const colors = ['#ff4d4f', '#52c41a', '#1890ff', '#fa8c16', '#eb2f96', '#722ed1'];
                    const color = colors[class_id % colors.length];
                    
                    // Handle polygon annotations (flat array format from your JSON)
                    if (polygon && Array.isArray(polygon) && polygon.length > 0) {
                      const points = [];
                      for (let i = 0; i < polygon.length; i += 2) {
                        if (i + 1 < polygon.length) {
                          // Convert to percentage coordinates for SVG viewBox 0 0 100 100
                          const x = polygon[i] * 100;
                          const y = polygon[i + 1] * 100;
                          points.push(`${x},${y}`);
                        }
                      }
                      
                      console.log(`📍 Polygon points for ${filename}:`, points.join(' '));
                      
                      return (
                        <g key={annIndex}>
                          <polygon
                            points={points.join(' ')}
                            fill={color}
                            fillOpacity="0.1"
                            stroke={color}
                            strokeWidth="0.5"
                            opacity="0.8"
                          />
                          <text
                            x={polygon[0] * 100}
                            y={polygon[1] * 100 - 1}
                            fill={color}
                            fontSize="3"
                            fontWeight="bold"
                          >
                            {className}
                          </text>
                        </g>
                      );
                    }
                    
                    // Handle segmentation annotations (array of point objects)
                    if (segmentation && Array.isArray(segmentation) && segmentation.length > 0) {
                      const points = segmentation.map(point => `${point.x},${point.y}`).join(' ');
                      
                      return (
                        <g key={annIndex}>
                          <polygon
                            points={points}
                            fill="none"
                            stroke={color}
                            strokeWidth="0.5"
                            opacity="0.8"
                          />
                          <text
                            x={segmentation[0].x}
                            y={segmentation[0].y - 1}
                            fill={color}
                            fontSize="3"
                            fontWeight="bold"
                          >
                            {className}
                          </text>
                        </g>
                      );
                    }
                    
                    // Handle bounding box annotations
                    if (bbox && Array.isArray(bbox) && bbox.length >= 4) {
                      const [x, y, width, height] = bbox;
                      console.log(`📦 Bounding box for ${filename}:`, { x, y, width, height });
                      
                      // Check if coordinates are normalized (0-1) or pixel values
                      const isNormalized = x <= 1 && y <= 1 && width <= 1 && height <= 1;
                      console.log(`📦 Bbox isNormalized: ${isNormalized}`);
                      
                      let rectX, rectY, rectWidth, rectHeight;
                      if (isNormalized) {
                        // Normalized coordinates (0-1) - convert to percentages
                        rectX = x * 100;
                        rectY = y * 100;
                        rectWidth = width * 100;
                        rectHeight = height * 100;
                      } else {
                        // Assume pixel coordinates - treat as percentages for thumbnails
                        rectX = x;
                        rectY = y;
                        rectWidth = width;
                        rectHeight = height;
                      }
                      
                      console.log(`📦 Final bbox coords for ${filename}:`, { rectX, rectY, rectWidth, rectHeight });
                      
                      return (
                        <g key={annIndex}>
                          <rect
                            x={rectX}
                            y={rectY}
                            width={rectWidth}
                            height={rectHeight}
                            fill={color}
                            fillOpacity="0.1"
                            stroke={color}
                            strokeWidth="0.5"
                            opacity="0.8"
                          />
                          <text
                            x={rectX}
                            y={Math.max(2, rectY - 1)}
                            fill={color}
                            fontSize="3"
                            fontWeight="bold"
                          >
                            {className}
                          </text>
                        </g>
                      );
                    }
                    
                    return null;
                  })}
                </svg>
              );
            })()}
            </div>
          }
        >
          <Card.Meta
            title={filename}
            description={
              <Space>
                <Tag color={getSplitColor(split)}>{split.toUpperCase()}</Tag>
                {hasAnnotations && <Tag color="green" icon={<TagsOutlined />}>Annotated</Tag>}
              </Space>
            }
          />
        </Card>
      </Col>
    );
  });

  if (!release) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text type="secondary">No release selected</Text>
      </div>
    );
  }

  return (
    <Layout style={{ background: '#fafafa', minHeight: '100vh' }}>
      <Content style={{ padding: '3px' }}>
        {/* Header with Back Button and Action Buttons */}
        <div style={{ marginBottom: '3px' }}>
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
        <Card style={{ marginBottom: '6px', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
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
              border: '2px solid #ffffff',
              borderRadius: '6px',
              padding: '4px'
            }}
            onMouseEnter={() => setIsHeaderHovered(true)}
            onMouseLeave={() => setIsHeaderHovered(false)}
          >
            <Row gutter={12}>
              <Col span={4}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '4px' }}>
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
                  <div style={{ marginBottom: '4px' }}>
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
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
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
                minHeight: 'auto'
              }} bodyStyle={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                  <div style={{ flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="imagesPerOriginalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#1976d2" />
                          <stop offset="100%" stopColor="#42a5f5" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#imagesPerOriginalGradient)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      <circle fill="url(#imagesPerOriginalGradient)" cx="18" cy="6" r="2" opacity="0.8"/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: '#1976d2' }}>Images per Original:</div>
                  <div style={{ fontSize: '16px', color: '#333', whiteSpace: 'nowrap', fontWeight: 500 }}>{releaseConfig?.images_per_original ?? '--'}</div>
                </div>
              </Card>
              </Col>
              <Col xs={24} sm={8} md={8} lg={8}>
                <Card size="small" bordered={false} style={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #e3f2fd 100%)',
                  boxShadow: '0 2px 8px rgba(60, 60, 120, 0.08)',
                  minHeight: 'auto'
                }} bodyStyle={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <div style={{ flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="outputFormatGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1976d2" />
                            <stop offset="100%" stopColor="#42a5f5" />
                          </linearGradient>
                        </defs>
                        <path fill="url(#outputFormatGradient)" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        <path fill="url(#outputFormatGradient)" d="M8 12h8v2H8zm0 4h6v2H8z" opacity="0.8"/>
                      </svg>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: '#1976d2' }}>Output Format:</div>
                    <div style={{ fontSize: '16px', color: '#333', whiteSpace: 'nowrap', fontWeight: 500 }}>{releaseConfig?.output_format ?? '--'}</div>
                  </div>
                </Card>
                </Col>
                <Col xs={24} sm={8} md={8} lg={8}>
                <Card size="small" bordered={false} style={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #e3f2fd 100%)',
                  boxShadow: '0 2px 8px rgba(60, 60, 120, 0.08)',
                  minHeight: 'auto'
                }} bodyStyle={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <div style={{ flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="classesMetadataGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1976d2" />
                            <stop offset="100%" stopColor="#42a5f5" />
                          </linearGradient>
                        </defs>
                        <path fill="url(#classesMetadataGradient)" d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
                        <circle fill="url(#classesMetadataGradient)" cx="7" cy="12" r="2" opacity="0.8"/>
                      </svg>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: '#1976d2' }}>Classes:</div>
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
                             whiteSpace: 'nowrap',
                             textDecoration: 'none'
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
                  border: '8px solid',
                  borderImage: 'linear-gradient(135deg, #e0f7fa 0%, #f3e5f5 100%) 1',
                  borderRadius: '6px',
                  padding: '4px',
                  boxShadow: '0 1px 6px rgba(60, 60, 120, 0.03)',
                  marginBottom: '4px'
                }}
                onMouseEnter={() => setIsDetailsHovered(true)}
                onMouseLeave={() => setIsDetailsHovered(false)}
              >
                {releaseConfig?.transformations && releaseConfig.transformations.length > 0 ? (
                  <Row gutter={[8, 8]} style={{ justifyContent: 'flex-start' }}>
                    {releaseConfig.transformations.map((item, idx) => {
                      // Emoji icon mapping for all 18 tools
                      const emojiIcons = {
                        resize: '📏', rotate: '🔄', flip: '🔀', crop: '✂️', brightness: '☀️', contrast: '🌗', blur: '🌫️', noise: '📺', color_jitter: '🎨', cutout: '⬛', random_zoom: '🔍', affine_transform: '📐', perspective_warp: '🏗️', grayscale: '⚫', shear: '📊', gamma_correction: '💡', equalize: '⚖️', clahe: '🔆'
                      };
                      const icon = <span style={{fontSize:'22px'}}>{emojiIcons[item.type] || '⚙️'}</span>;

                      
                      const getFullDescription = (type, params) => {
                        if (!params) return 'No parameters specified.';
                        switch(type) {
                          case 'resize': return params.width && params.height ? `Resize image to ${params.width} × ${params.height} pixels.` : 'Resize image.';
                          case 'brightness': return typeof params.percentage === 'number' ? `Adjust brightness by ${params.percentage > 0 ? '+' : ''}${params.percentage}%.` : 'Adjust brightness.';
                          case 'contrast': return typeof params.percentage === 'number' ? `Adjust contrast by ${params.percentage > 0 ? '+' : ''}${params.percentage}%.` : 'Adjust contrast.';
                          case 'rotate': return typeof params.angle === 'number' ? `Rotate image by ${params.angle}°.` : 'Rotate image.';
                          case 'flip': {
                            let direction = '';
                            if (params.horizontal && params.vertical) direction = 'horizontally and vertically';
                            else if (params.horizontal) direction = 'horizontally';
                            else if (params.vertical) direction = 'vertically';
                            return direction ? `Flip image ${direction}.` : 'Flip image.';
                          }
                          case 'crop': return typeof params.crop_percentage === 'number' ? `Crop ${params.crop_percentage}% from image edges.` : 'Crop image.';
                          case 'blur': return typeof params.radius === 'number' ? `Apply blur with radius ${params.radius}px.` : 'Blur image.';
                          case 'noise': {
                            if (!params || Object.keys(params).length === 0) return 'Add noise.';
                            const paramList = Object.entries(params)
                              .filter(([k]) => k !== 'enabled')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ');
                            return `Add noise (${paramList}).`;
                          }
                          case 'color_jitter': {
                            if (!params || Object.keys(params).length === 0) return 'Apply color jitter.';
                            const paramList = Object.entries(params)
                              .filter(([k]) => k !== 'enabled')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ');
                            return `Color jitter (${paramList}).`;
                          }
                          case 'random_zoom': {
                            if (!params || Object.keys(params).length === 0) return 'Random zoom.';
                            const paramList = Object.entries(params)
                              .filter(([k]) => k !== 'enabled')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ');
                            return `Random zoom (${paramList}).`;
                          }
                          case 'affine_transform': {
                            if (!params || Object.keys(params).length === 0) return 'Apply affine transform.';
                            const paramList = Object.entries(params)
                              .filter(([k]) => k !== 'enabled')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ');
                            return `Affine transform (${paramList}).`;
                          }
                          case 'perspective_warp': {
                            if (!params || Object.keys(params).length === 0) return 'Apply perspective warp.';
                            const paramList = Object.entries(params)
                              .filter(([k]) => k !== 'enabled')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ');
                            return `Perspective warp (${paramList}).`;
                          }
                          case 'shear': {
                            if (!params || Object.keys(params).length === 0) return 'Apply shear.';
                            const paramList = Object.entries(params)
                              .filter(([k]) => k !== 'enabled')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ');
                            return `Shear (${paramList}).`;
                          }
                          case 'gamma_correction': return typeof params.gamma === 'number' ? `Gamma correction (γ = ${params.gamma}).` : 'Apply gamma correction.';
                          case 'equalize': return 'Apply histogram equalization.';
                          case 'clahe': {
                            let desc = 'CLAHE';
                            if (params.grid_size && params.clip_limit) desc += `: grid size ${params.grid_size}, clip limit ${params.clip_limit}`;
                            else if (params.grid_size) desc += `: grid size ${params.grid_size}`;
                            else if (params.clip_limit) desc += `: clip limit ${params.clip_limit}`;
                            return desc + '.';
                          }
                          case 'cutout': {
                            // Only show num_holes if present
                            if (params && typeof params.num_holes === 'number') {
                              return `Cutout ${params.num_holes} holes`;
                            }
                            return 'Cutout.';
                          }
                          case 'grayscale': {
                              return 'Convert to grayscale';
                          }
                          default: return 'Custom transformation.';
                        }
                      };
                      
                      const fullDesc = getFullDescription(item.type, item.params);
                       
                       // Short transformation names
                       const shortNames = {
                         'resize': 'Resize',
                         'rotate': 'Rotate', 
                         'flip': 'Flip',
                         'crop': 'Crop',
                         'brightness': 'Bright',
                         'contrast': 'Contrast',
                         'blur': 'Blur',
                         'noise': 'Noise',
                         'color_jitter': 'Color',
                         'cutout': 'Cutout',
                         'random_zoom': 'Zoom',
                         'affine_transform': 'Affine',
                         'perspective_warp': 'Perspective',
                         'grayscale': 'Grayscale',
                         'shear': 'Shear',
                         'gamma_correction': 'Gamma',
                         'equalize': 'Equalize',
                         'clahe': 'CLAHE'
                       };
                       const displayName = shortNames[item.type] || item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('_', ' ');
                       
                       const tooltipText = fullDesc;
                      return (
                        <Col xs={24} sm={12} md={8} lg={24/9} key={idx} style={{flex: '0 0 11.11%', maxWidth: '11.11%'}}>
                          <Tooltip title={tooltipText} placement="top">
                            <Card
                              size="small"
                              bordered={false}
                              style={{
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #fff 0%, #e3f2fd 100%)',
                                boxShadow: '0 1px 6px rgba(60, 60, 120, 0.08)',
                                padding: '4px',
                                height: '80px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                textAlign: 'center',
                                cursor: 'pointer'
                              }}
                              bodyStyle={{ padding: 0 }}
                              title={null}
                            >
                              <div style={{ marginBottom: '3px', flexShrink: 0, fontSize: '14px' }}>{icon}</div>
                              <div style={{ width: '100%', overflow: 'hidden', boxSizing: 'border-box', padding: '0 1px' }}>
                                <div style={{ 
                                  fontWeight: 600, 
                                  fontSize: '12px', 
                                  color: '#1976d2', 
                                  marginBottom: '2px', 
                                  lineHeight: '1.0', 
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {displayName}
                                </div>
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#444', 
                                  lineHeight: '1.2',
                                  overflow: 'hidden',
                                  fontWeight: 500,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical'
                                }}>
                                  {fullDesc}
                                </div>
                              </div>
                            </Card>
                          </Tooltip>
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
            <Card 
              title="Release Images" 
              extra={
                <Space>
                  <Button
                    size="small"
                    type={showAnnotations ? "primary" : "default"}
                    icon={<TagsOutlined />}
                    onClick={() => {
                      console.log(`🔄 Toggling annotations from ${showAnnotations} to ${!showAnnotations}`);
                      setShowAnnotations(!showAnnotations);
                    }}
                  >
                    {showAnnotations ? 'Hide' : 'Show'} Annotations
                  </Button>
                  <Text type="secondary">{releaseImages.length} images</Text>
                </Space>
              } 
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px' }}>Loading release images...</div>
                </div>
              ) : (
                <>
                  <Row gutter={[16, 16]} style={{flexWrap: 'wrap'}}>
                    {currentImages.map((img, index) => {
                      const actualIndex = startIndex + index;
                      const { filename, split, path, thumbnailUrl, hasAnnotations, fullPath } = img;
                      return (
                        <Col span={4} key={`${split}-${filename}-${actualIndex}-${showAnnotations}`}>
                          <Card
                            hoverable
                            onClick={() => {
                              setSelectedImageIndex(actualIndex);
                              setModalVisible(true);
                            }}
                            cover={
                              <div style={{ 
                                position: 'relative', 
                                height: '256px', 
                                width: '256px',
                                overflow: 'hidden',
                                contain: 'layout style size paint',
                                transform: 'scale(1)',
                                isolation: 'isolate'
                              }}>
                                <img
                                  alt={filename}
                                  src={thumbnailUrl}
                                  style={{ 
                                    height: '256px', 
                                    width: '256px', 
                                    objectFit: 'contain',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0
                                  }}
                                  onLoad={(e) => {
                                    // Store actual image dimensions
                                    const img = e.target;
                                    window[`imageSize_${filename}`] = {
                                      width: img.naturalWidth,
                                      height: img.naturalHeight
                                    };
                                    console.log(`✅ Image loaded: ${filename}, size: ${img.naturalWidth}x${img.naturalHeight}`);
                                    logInfo('app.frontend.ui', 'release_image_loaded', 'Release image loaded successfully', {
                                      timestamp: new Date().toISOString(),
                                      filename: filename,
                                      releaseId: release_id,
                                      imagePath: path,
                                      thumbnailUrl: thumbnailUrl
                                    });
                                  }}
                                  onError={(e) => {
                                    console.error(`❌ Image failed to load: ${filename}`, e);
                                    logError('app.frontend.ui', 'release_image_load_failed', 'Release image failed to load', {
                                      timestamp: new Date().toISOString(),
                                      filename: filename,
                                      releaseId: release_id,
                                      imagePath: path,
                                      thumbnailUrl: thumbnailUrl,
                                      error: e.message || 'Image load error'
                                    });
                                  }}
                                />
                                
                                {/* ANNOTATIONS OVERLAY */}
                                {showAnnotations && (() => {
                                  console.log(`🔍 Available annotation keys:`, Object.keys(annotations));
                                  
                                  // Try multiple possible keys for this image
                                  const possibleKeys = [
                                    `images\\${split}\\${filename}`,
                                    `images/${split}/${filename}`,
                                    `images\\${split}\\${filename.replace('.jpg', '')}`,
                                    `images/${split}/${filename.replace('.jpg', '')}`,
                                    filename,
                                    filename.replace('.jpg', ''),
                                    `images/${split}/${filename}`,
                                    `images/${split}/${filename.replace('.jpg', '')}`,
                                    `${split}/${filename}`,
                                    `${split}/${filename.replace('.jpg', '')}`,
                                    filename,
                                    filename.replace('.jpg', ''),
                                    `images/${split}/${filename}`,
                                    `images/${split}/${filename}`,
                                    `images/${split}/${filename.replace('.jpg', '')}`
                                  ];
                                  
                                  console.log(`🔍 Trying keys for ${filename} (split: ${split}):`, possibleKeys);
                                  console.log(`🔍 Image path: ${path}, filename: ${filename}, split: ${split}`);
                                  
                                  let imageAnnotations = null;
                                  let foundKey = null;
                                  
                                  for (const key of possibleKeys) {
                                    if (annotations[key]) {
                                      imageAnnotations = annotations[key];
                                      foundKey = key;
                                      break;
                                    }
                                  }
                                  
                                  if (imageAnnotations) {
                                    console.log(`✅ Found annotations for ${filename} using key: ${foundKey}`, imageAnnotations);
                                  } else {
                                    console.log(`❌ No annotations found for ${filename}`);
                                    return null;
                                  }
                                  
                                  return (
                                    <svg
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        pointerEvents: 'none',
                                        zIndex: 10
                                      }}
                                      viewBox="0 0 256 256"
                                      preserveAspectRatio="none"
                                    >
                                      {imageAnnotations.map((annotation, annIndex) => {
                                        const { class_id, polygon, bbox, segmentation } = annotation;
                                        const className = classMapping[class_id] || `Class ${class_id}`;
                                        const color = getClassColor(class_id);
                                        
                                        console.log(`🎨 Rendering annotation ${annIndex} for ${filename}:`, { class_id, polygon, bbox });
                                        
                                        // Handle polygon annotations
                                        if (polygon && Array.isArray(polygon) && polygon.length >= 6) {
                                          const points = [];
                                          let minX = 256, minY = 256;
                                          
                                          for (let i = 0; i < polygon.length; i += 2) {
                                            if (i + 1 < polygon.length) {
                                              const x = polygon[i];
                                              const y = polygon[i + 1];
                                              points.push(`${x},${y}`);
                                              minX = Math.min(minX, x);
                                              minY = Math.min(minY, y);
                                            }
                                          }
                                          const pointsString = points.join(' ');
                                          console.log(`📍 Polygon points for ${filename}:`, pointsString);
                                          console.log(`📍 Label position: x=${minX}, y=${minY}`);
                                          
                                          return (
                                            <g key={annIndex}>
                                              <polygon
                                                points={pointsString}
                                                fill={color}
                                                fillOpacity="0.2"
                                                stroke={color}
                                                strokeWidth="0.8"
                                                opacity="0.9"
                                              />
                                              {/* Label background */}
                                              <rect
                                                x={minX}
                                                y={Math.max(0, minY - 4)}
                                                width={className.length * 1.5 + 2}
                                                height="4"
                                                fill={color}
                                                opacity="0.8"
                                              />
                                              {/* Label text */}
                                              <text
                                                x={minX + 1}
                                                y={Math.max(2.5, minY - 0.5)}
                                                fill="white"
                                                fontSize="2.5"
                                                fontWeight="bold"
                                              >
                                                {className}
                                              </text>
                                            </g>
                                          );
                                        }
                                        
                                        // Handle bounding box annotations
                                        if (bbox && Array.isArray(bbox) && bbox.length >= 4) {
                                          const [x, y, width, height] = bbox;
                                          console.log(`📦 Bounding box for ${filename}:`, { x, y, width, height });
                                          
                                          // Check if coordinates are normalized (0-1) or pixel values
                                          const isNormalized = x <= 1 && y <= 1 && width <= 1 && height <= 1;
                                          console.log(`📦 Bbox isNormalized: ${isNormalized}`);
                                          
                                          let rectX, rectY, rectWidth, rectHeight;
                                          if (isNormalized) {
                                            // Normalized coordinates (0-1) - convert to 256px
                                            rectX = x * 256;
                                            rectY = y * 256;
                                            rectWidth = width * 256;
                                            rectHeight = height * 256;
                                          } else {
                                            // Already pixel coordinates - use directly
                                            rectX = x;
                                            rectY = y;
                                            rectWidth = width;
                                            rectHeight = height;
                                          }
                                          
                                          console.log(`📦 Final bbox coords for ${filename}:`, { rectX, rectY, rectWidth, rectHeight });
                                          
                                          return (
                                            <g key={annIndex}>
                                              <rect
                                                x={rectX}
                                                y={rectY}
                                                width={rectWidth}
                                                height={rectHeight}
                                                fill={color}
                                                fillOpacity="0.1"
                                                stroke={color}
                                                strokeWidth="0.8"
                                                opacity="0.9"
                                              />
                                              {/* Label background */}
                                              <rect
                                                x={rectX}
                                                y={Math.max(0, rectY - 4)}
                                                width={className.length * 1.5 + 2}
                                                height="4"
                                                fill={color}
                                                opacity="0.8"
                                              />
                                              {/* Label text */}
                                              <text
                                                x={rectX + 1}
                                                y={Math.max(2.5, rectY - 0.5)}
                                                fill="white"
                                                fontSize="2.5"
                                                fontWeight="bold"
                                              >
                                                {className}
                                              </text>
                                            </g>
                                          );
                                        }
                                        
                                        return null;
                                      })}
                                    </svg>
                                  );
                                })()}
                            </div>
                          }
                        >
                          <Card.Meta
                              title={filename}
                              description={
                                <Space>
                                  <Tag color={getSplitColor(split)}>{split.toUpperCase()}</Tag>
                                  {hasAnnotations && <Tag color="green" icon={<TagsOutlined />}>Annotated</Tag>}
                                </Space>
                              }
                            />
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px', gap: '16px' }}>
                      <Button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        type={currentPage === 1 ? 'default' : 'primary'}
                      >
                        Previous
                      </Button>
                      
                      <Text type="secondary">
                        Page {currentPage} of {totalPages} ({totalImages} images)
                      </Text>
                      
                      <Button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        type={currentPage === totalPages ? 'default' : 'primary'}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                  <ReleaseImageViewerModal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    images={releaseImages}
                    currentIndex={selectedImageIndex}
                    onIndexChange={setSelectedImageIndex}
                    releaseId={release?.id}
                    annotations={annotations}
                    classMapping={classMapping}
                    showAnnotations={showAnnotations}
                  />
                </>
              )}
            </Card>
          </Content>
        </Layout>
      );
    };

    export default ReleaseDetailsView;

