import React from 'react';
import {
  Typography,
  Card,
  Button,
  Upload,
  message,
  Row,
  Col,
  Statistic,
  Dropdown
} from 'antd';
import {
  DatabaseOutlined,
  PictureOutlined,
  TagOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  UploadOutlined,
  FolderOutlined,
  ExportOutlined,
  EyeOutlined,
  SettingOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderDatasetContent function (lines 1347-1547+)
const DatasetSection = ({
  project,
  projectId,
  loadProject,
  handleDeleteDataset
}) => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <DatabaseOutlined style={{ marginRight: '8px' }} />
        Dataset Management
      </Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Images"
              value={project?.total_images || 0}
              prefix={<PictureOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Labeled Images"
              value={project?.labeled_images || 0}
              prefix={<TagOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Progress"
              value={project?.total_images > 0 ? Math.round((project?.labeled_images || 0) / project.total_images * 100) : 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Upload New Images" style={{ marginBottom: '24px' }}>
        <Upload.Dragger
          name="file"
          multiple
          accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          directory={false}
          showUploadList={true}
          action={`http://localhost:12000/api/v1/projects/${projectId}/upload`}
          headers={{
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }}
          onChange={(info) => {
            const { status } = info.file;
            if (status !== 'uploading') {
              console.log(info.file, info.fileList);
            }
            if (status === 'done') {
              message.success(`${info.file.name} uploaded successfully.`);
              // Reload project data to update statistics
              loadProject();
            } else if (status === 'error') {
              message.error(`${info.file.name} upload failed.`);
            }
          }}
          onDrop={(e) => {
            console.log('Dropped files', e.dataTransfer.files);
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag images to upload</p>
          <p className="ant-upload-hint">
            Support for single or bulk upload. Accepts JPG, PNG, GIF, BMP, WebP formats.
          </p>
        </Upload.Dragger>
        
        <div style={{ marginTop: '16px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Upload
                name="file"
                multiple
                accept="image/*"
                showUploadList={false}
                action={`http://localhost:12000/api/v1/projects/${projectId}/upload`}
                headers={{
                  'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                }}
                onChange={(info) => {
                  if (info.file.status === 'done') {
                    message.success(`${info.file.name} uploaded successfully.`);
                    loadProject();
                  } else if (info.file.status === 'error') {
                    message.error(`${info.file.name} upload failed.`);
                  }
                }}
              >
                <Button type="primary" icon={<UploadOutlined />} block>
                  Select Files
                </Button>
              </Upload>
            </Col>
            <Col xs={24} sm={12}>
              <Upload
                name="file"
                multiple
                directory
                accept="image/*"
                showUploadList={false}
                action={`http://localhost:12000/api/v1/projects/${projectId}/upload`}
                headers={{
                  'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                }}
                onChange={(info) => {
                  if (info.file.status === 'done') {
                    message.success(`${info.file.name} uploaded successfully.`);
                    loadProject();
                  } else if (info.file.status === 'error') {
                    message.error(`${info.file.name} upload failed.`);
                  }
                }}
              >
                <Button icon={<FolderOutlined />} block>
                  Select Folder
                </Button>
              </Upload>
            </Col>
          </Row>
        </div>
      </Card>

      <Card title="Dataset Actions">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Button 
              type="primary" 
              icon={<TagOutlined />}
              block
              onClick={() => {
                // Navigate to annotation launcher - need a dataset ID
                // For now, show message to select a dataset first
                message.info('Please select a dataset from the Annotating section to start annotation');
              }}
            >
              Start Annotating
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button 
              icon={<ExportOutlined />}
              block
            >
              Export Dataset
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button 
              icon={<EyeOutlined />}
              block
            >
              View Images
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'view-settings',
                    icon: <SettingOutlined />,
                    label: 'Dataset Settings',
                  },
                  {
                    key: 'delete-dataset',
                    icon: <DeleteOutlined />,
                    label: 'Delete Dataset',
                    danger: true,
                  },
                ]
              }}
              onMenuClick={({ key }) => {
                if (key === 'delete-dataset') {
                  handleDeleteDataset();
                } else if (key === 'view-settings') {
                  // Handle dataset settings view
                  message.info('Dataset settings coming soon!');
                }
              }}
            >
              <Button 
                icon={<SettingOutlined />}
                block
              >
                Dataset Settings
              </Button>
            </Dropdown>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DatasetSection;