import React, { useState, useRef, useEffect } from 'react';
import {
  Typography,
  Card,
  Button,
  Upload,
  Input,
  Select,
  Row,
  Col,
  Divider,
  Progress,
  message,
  Space
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  PictureOutlined,
  DatabaseOutlined,
  TagOutlined,
  FolderOutlined,
  YoutubeOutlined,
  ApiOutlined,
  CloudOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { projectsAPI, datasetsAPI, handleAPIError } from '../../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

const UploadSection = ({ projectId }) => {
  const [batchName, setBatchName] = useState('');
  const [tags, setTags] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTimeout, setUploadTimeout] = useState(null);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [recentImages, setRecentImages] = useState([]);
  const [batchNameModalVisible, setBatchNameModalVisible] = useState(false);
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Load available datasets for the project
  const loadAvailableDatasets = async () => {
    try {
      const response = await projectsAPI.getProjectDatasets(projectId);
      const datasets = response.datasets || response || [];
      const options = datasets.map(dataset => ({
        value: dataset.id,
        label: dataset.name
      }));
      setAvailableDatasets(options);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to load datasets: ${errorInfo.message}`);
    }
  };

  // Load recent images
  const loadRecentImages = async () => {
    try {
      const images = await projectsAPI.getRecentImages(projectId, 6);
      setRecentImages(images);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      console.error('Failed to load recent images:', errorInfo);
    }
  };

  useEffect(() => {
    loadAvailableDatasets();
    loadRecentImages();
  }, [projectId]);

  // Handle file selection
  const handleFileSelect = () => {
    if (batchName.trim() === '' && tags.length === 0) {
      // Show batch name modal
      setBatchNameModalVisible(true);
    } else {
      // Directly trigger file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  // Handle folder selection
  const handleFolderSelect = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  // Upload a single file
  const uploadFile = async (file, batchNameToUse) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_name', batchNameToUse);
    
    if (tags.length > 0) {
      formData.append('dataset_ids', JSON.stringify(tags));
    }

    try {
      const result = await projectsAPI.uploadImagesToProject(projectId, formData);
      message.success(`${file.name} uploaded successfully to "${batchNameToUse}"!`);
      return result;
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to upload ${file.name}: ${errorInfo.message}`);
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Upload multiple files
  const uploadMultipleFiles = async (files, batchNameToUse) => {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    
    formData.append('batch_name', batchNameToUse);
    
    if (tags.length > 0) {
      formData.append('dataset_ids', JSON.stringify(tags));
    }

    try {
      const result = await projectsAPI.uploadMultipleImagesToProject(projectId, formData);
      message.success(`${files.length} files uploaded successfully to "${batchNameToUse}"!`);
      return result;
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to upload files: ${errorInfo.message}`);
      throw error;
    }
  };

  // Upload props for Dragger component
  const uploadProps = {
    name: 'file',
    multiple: true,
    action: `${process.env.REACT_APP_API_URL || 'http://localhost:12000'}/api/v1/projects/${projectId}/upload`,
    onChange(info) {
      const { status } = info.file;
      
      if (status === 'done') {
        message.success(`${info.file.name} file uploaded successfully.`);
      } else if (status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
      
      // Update uploaded files list
      setUploadedFiles(prevFiles => {
        const newFiles = [...prevFiles, { file: info.file, status }];
        
        // Simulate progress for visual feedback
        if (uploadTimeout) {
          clearTimeout(uploadTimeout);
        }
        
        const newTimeout = setTimeout(() => {
          if (status === 'done' || status === 'error') {
            setUploadProgress(0);
          }
        }, 500);
        
        setUploadTimeout(newTimeout);
        return newFiles;
      });
    },
    accept: '.jpg,.jpeg,.png,.bmp,.webp,.avif',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error(`${file.name} is not an image file`);
        return false;
      }
      
      const isLt20M = file.size / 1024 / 1024 < 20;
      if (!isLt20M) {
        message.error(`${file.name} must be smaller than 20MB!`);
        return false;
      }
      
      return true;
    },
    showUploadList: {
      showPreviewIcon: true,
      showRemoveIcon: true,
      showDownloadIcon: false,
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, marginBottom: '8px' }}>
          <UploadOutlined style={{ marginRight: '8px' }} />
          Upload
        </Title>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Batch Name:</Text>
            </div>
            <Input 
              placeholder={`Uploaded on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`}
              value={batchName}
              onChange={(e) => {
                setBatchName(e.target.value);
                // Clear tags when batch name is entered
                if (e.target.value.trim() && tags.length > 0) {
                  setTags([]);
                }
              }}
              disabled={tags.length > 0}
              style={{ 
                marginBottom: '16px',
                opacity: tags.length > 0 ? 0.6 : 1
              }}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Tags:</Text>
              <Text type="secondary" style={{ marginLeft: '8px' }}>
                <SettingOutlined />
              </Text>
            </div>
            <Select
              mode="multiple"
              style={{ 
                width: '100%',
                opacity: batchName.trim() ? 0.6 : 1
              }}
              placeholder="Select existing dataset or leave empty for new batch..."
              value={tags}
              onChange={(selectedTags) => {
                setTags(selectedTags);
                // Clear batch name when tags are selected
                if (selectedTags.length > 0 && batchName.trim()) {
                  setBatchName('');
                }
              }}
              options={availableDatasets}
              allowClear
              disabled={batchName.trim() !== ''}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Dragger {...uploadProps} style={{ marginBottom: '16px' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: '18px', fontWeight: 500 }}>
            Drag and drop file(s) to upload, or:
          </p>
        </Dragger>
        
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Button 
            type="primary" 
            icon={<FolderOutlined />} 
            style={{ marginRight: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              handleFileSelect();
            }}
          >
            Select File(s)
          </Button>
          <Button 
            icon={<FolderOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleFolderSelect();
            }}
          >
            Select Folder
          </Button>
          
          {/* Hidden file inputs */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            accept=".jpg,.jpeg,.png,.bmp,.webp,.avif"
            onChange={async (e) => {
              const files = Array.from(e.target.files);
              if (files.length === 0) return;

              setUploading(true);
              const batchNameToUse = batchName || `Uploaded on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
              
              try {
                for (const file of files) {
                  await uploadFile(file, batchNameToUse);
                }
                
                // Reload data after all uploads
                loadRecentImages();
                message.success(`${files.length} file(s) uploaded successfully to "${batchNameToUse}"!`);
              } catch (error) {
                console.error('Batch upload error:', error);
              } finally {
                setUploading(false);
                // Clear the input value to allow re-uploading the same file
                e.target.value = '';
              }
            }}
          />
          <input
            type="file"
            ref={folderInputRef}
            style={{ display: 'none' }}
            webkitdirectory=""
            multiple
            accept=".jpg,.jpeg,.png,.bmp,.webp,.avif"
            onChange={async (e) => {
              const files = Array.from(e.target.files);
              if (files.length === 0) return;

              // Extract folder name from the first file's path
              const firstFile = files[0];
              const pathParts = firstFile.webkitRelativePath.split('/');
              const folderName = pathParts[0] || `Folder_${new Date().toLocaleDateString()}`;
              
              setUploading(true);
              
              try {
                for (const file of files) {
                  await uploadFile(file, folderName);
                }
                
                // Reload data after all uploads
                loadRecentImages();
                message.success(`${files.length} file(s) uploaded successfully to "${folderName}"!`);
              } catch (error) {
                console.error('Folder upload error:', error);
              } finally {
                setUploading(false);
                // Clear the input value to allow re-uploading the same folder
                e.target.value = '';
              }
            }}
          />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={4} style={{ color: '#666' }}>Supported Formats</Title>
          <Row gutter={[24, 16]} justify="center">
            <Col>
              <div style={{ textAlign: 'center' }}>
                <PictureOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Images</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .jpg, .png, .bmp, .webp, .avif
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    in 26 formats
                  </Text>
                </div>
              </div>
            </Col>
            <Col>
              <div style={{ textAlign: 'center' }}>
                <TagOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Annotations</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .mov, .mp4
                  </Text>
                </div>
              </div>
            </Col>
            <Col>
              <div style={{ textAlign: 'center' }}>
                <PictureOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Videos</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .pdf
                  </Text>
                </div>
              </div>
            </Col>
            <Col>
              <div style={{ textAlign: 'center' }}>
                <DatabaseOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>PDFs</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .pdf
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            (Max size of 20MB and 16,000 pixels).
          </Text>
        </div>

        <Divider />

        <div style={{ marginBottom: '24px' }}>
          <Title level={5}>Need images to get started? We've got you covered.</Title>
          
          <Card size="small" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <DatabaseOutlined style={{ fontSize: '20px', color: '#722ed1', marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <Text strong>Search on Roboflow Universe: World's Largest Platform for Computer Vision Data</Text>
              </div>
            </div>
            <Input 
              placeholder="Search images and annotations from 600k datasets and 400 million images (e.g. cars, people)"
              suffix={<Button type="primary" size="small">→</Button>}
              style={{ marginTop: '12px' }}
            />
          </Card>

          <Card size="small" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <YoutubeOutlined style={{ fontSize: '20px', color: '#ff4d4f', marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <Text strong>Import YouTube Video</Text>
              </div>
            </div>
            <Input 
              placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              suffix={<Button type="primary" size="small">→</Button>}
              style={{ marginTop: '12px' }}
            />
          </Card>

          <Row gutter={16}>
            <Col span={12}>
              <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ApiOutlined style={{ fontSize: '20px', color: '#1890ff', marginRight: '12px' }} />
                  <Text strong>Collect Images via the Upload API</Text>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CloudOutlined style={{ fontSize: '20px', color: '#52c41a', marginRight: '12px' }} />
                  <Text strong>Import From Cloud Providers</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>

      {/* Upload Progress and Results */}
      {(uploading || uploadedFiles.length > 0 || recentImages.length > 0) && (
        <Card title="Upload Status" style={{ marginTop: '24px' }}>
          {uploading && (
            <div style={{ marginBottom: '16px' }}>
              <Text>Uploading files...</Text>
              <Progress percent={uploadProgress} status="active" />
            </div>
          )}
          
          {(uploadedFiles.length > 0 || recentImages.length > 0) && (
            <div>
              <Title level={5}>Recently Uploaded ({recentImages.length || uploadedFiles.length} files)</Title>
              <Row gutter={[16, 16]}>
                {(recentImages.length > 0 ? recentImages : uploadedFiles.slice(-6)).map((fileInfo, index) => (
                  <Col span={4} key={index}>
                    <Card
                      size="small"
                      cover={
                        <div style={{ 
                          height: '80px', 
                          background: '#f5f5f5', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          {fileInfo.thumbnail_url ? (
                            <img 
                              src={fileInfo.thumbnail_url} 
                              alt={fileInfo.filename || 'Image'} 
                              style={{ maxHeight: '80px', maxWidth: '100%' }}
                            />
                          ) : (
                            <PictureOutlined style={{ fontSize: '24px', color: '#999' }} />
                          )}
                        </div>
                      }
                    >
                      <Card.Meta 
                        title={
                          <Text ellipsis style={{ fontSize: '12px' }}>
                            {fileInfo.filename || fileInfo.file?.name || 'Unknown'}
                          </Text>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {fileInfo.file?.size ? `${(fileInfo.file.size / 1024).toFixed(1)} KB` : ''}
                          </Text>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
              
              {(recentImages.length > 6 || uploadedFiles.length > 6) && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Button type="link">
                    View all {recentImages.length || uploadedFiles.length} uploaded files
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default UploadSection;