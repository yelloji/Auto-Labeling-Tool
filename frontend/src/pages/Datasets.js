import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Upload, 
  message, 
  Table, 
  Space, 
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Progress,
  Spin
} from 'antd';
import {
  UploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { datasetsAPI, projectsAPI } from '../services/api';
import { handleAPIError } from '../utils/errorHandler';

const { Title, Paragraph } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

const Datasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();

  // Load datasets and projects
  const loadData = async () => {
    setLoading(true);
    try {
      const [datasetsData, projectsData] = await Promise.all([
        datasetsAPI.getDatasets(),
        projectsAPI.getProjects()
      ]);
      setDatasets(datasetsData);
      setProjects(projectsData);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to load data: ${errorInfo.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <strong>{name}</strong>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_id',
      key: 'project_id',
      render: (projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : 'No Project';
      },
    },
    {
      title: 'Images',
      dataIndex: 'image_count',
      key: 'image_count',
      render: (count) => `${count || 0} images`,
    },
    {
      title: 'Annotated',
      key: 'annotated',
      render: (_, record) => {
        const total = record.image_count || 0;
        const annotated = record.annotated_count || 0;
        const percent = total > 0 ? Math.round((annotated / total) * 100) : 0;
        
        return (
          <div>
            <Progress 
              percent={percent} 
              size="small" 
              style={{ width: 100 }}
            />
            <span style={{ marginLeft: 8 }}>{annotated}/{total}</span>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small">
            View
          </Button>
          <Button icon={<DownloadOutlined />} size="small">
            Export
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  // Handle dataset upload
  const handleUpload = async (values) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('description', values.description || '');
      if (values.project_id) {
        formData.append('project_id', values.project_id);
      }
      
      // Add files
      values.files.forEach(file => {
        formData.append('files', file.originFileObj);
      });

      await datasetsAPI.uploadDataset(formData);
      message.success('Dataset uploaded successfully!');
      setUploadModalVisible(false);
      form.resetFields();
      loadData(); // Reload datasets
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Upload failed: ${errorInfo.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle dataset deletion
  const handleDelete = async (datasetId) => {
    try {
      await datasetsAPI.deleteDataset(datasetId);
      message.success('Dataset deleted successfully!');
      loadData(); // Reload datasets
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Delete failed: ${errorInfo.message}`);
    }
  };

  const showUploadModal = () => {
    setUploadModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      handleUpload(values);
    });
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2}>Datasets</Title>
          <Paragraph>
            Upload and manage your image datasets
          </Paragraph>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={showUploadModal}
          >
            Upload Dataset
          </Button>
        </Space>
      </div>

      <Card>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={datasets}
            rowKey="id"
            locale={{
              emptyText: (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <DatabaseOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                  <div>No datasets uploaded yet</div>
                  <Button 
                    type="primary" 
                    icon={<UploadOutlined />}
                    style={{ marginTop: 16 }}
                    onClick={showUploadModal}
                  >
                    Upload Your First Dataset
                  </Button>
                </div>
              )
            }}
          />
        </Spin>
      </Card>

      <Modal
        title="Upload Dataset"
        open={uploadModalVisible}
        onOk={handleModalOk}
        onCancel={() => setUploadModalVisible(false)}
        confirmLoading={uploading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Dataset Name"
            rules={[{ required: true, message: 'Please enter dataset name' }]}
          >
            <Input placeholder="Enter dataset name" />
          </Form.Item>
          
          <Form.Item
            name="project_id"
            label="Project (Optional)"
          >
            <Select placeholder="Select project" allowClear>
              {projects.map(project => (
                <Option key={project.id} value={project.id}>
                  {project.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Enter dataset description" rows={3} />
          </Form.Item>

          <Form.Item
            name="files"
            label="Images"
            rules={[{ required: true, message: 'Please select images to upload' }]}
          >
            <Upload.Dragger
              multiple
              accept=".jpg,.jpeg,.png,.bmp,.tiff,.webp"
              beforeUpload={() => false} // Prevent auto upload
              onChange={(info) => {
                form.setFieldsValue({ files: info.fileList });
              }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click or drag images to this area to upload</p>
              <p className="ant-upload-hint">
                Support for JPG, JPEG, PNG, BMP, TIFF, WEBP formats. Max 500MB per file, up to 10,000 images.
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Datasets;