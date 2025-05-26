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
  Spin,
  Alert,
  Tag,
  Popconfirm
} from 'antd';
import {
  UploadOutlined,
  RobotOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { modelsAPI, handleAPIError } from '../services/api';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

const Models = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState([]);
  const [form] = Form.useForm();

  // Load models and supported types
  const loadModels = async () => {
    setLoading(true);
    try {
      const [modelsData, typesData] = await Promise.all([
        modelsAPI.getModels(),
        modelsAPI.getSupportedTypes()
      ]);
      setModels(modelsData);
      setSupportedTypes(typesData.model_types || []);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to load models: ${errorInfo.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  // Delete model
  const handleDeleteModel = async (modelId) => {
    try {
      await modelsAPI.deleteModel(modelId);
      message.success('Model deleted successfully');
      loadModels(); // Reload models
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to delete model: ${errorInfo.message}`);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.is_custom && <Tag color="blue" style={{ marginLeft: 8 }}>Custom</Tag>}
          {!record.is_custom && <Tag color="green" style={{ marginLeft: 8 }}>Pre-trained</Tag>}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="purple">{type}</Tag>,
    },
    {
      title: 'Classes',
      dataIndex: 'classes',
      key: 'classes',
      render: (classes) => (
        <Text>{classes?.length || 0} classes</Text>
      ),
    },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format) => <Tag>{format}</Tag>,
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence_threshold',
      key: 'confidence_threshold',
      render: (threshold) => `${(threshold * 100).toFixed(0)}%`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small">
            View
          </Button>
          {record.is_custom && (
            <Popconfirm
              title="Are you sure you want to delete this model?"
              onConfirm={() => handleDeleteModel(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button icon={<DeleteOutlined />} size="small" danger>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Handle model import
  const handleImportModel = async (values, file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', values.name);
      formData.append('description', values.description || '');
      formData.append('model_type', values.model_type);

      await modelsAPI.importModel(formData);
      message.success('Model imported successfully!');
      setUploadModalVisible(false);
      form.resetFields();
      loadModels(); // Reload models
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to import model: ${errorInfo.message}`);
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pt,.onnx,.weights',
    beforeUpload: () => false, // Prevent auto upload
    onChange(info) {
      // Store file for manual upload
      form.setFieldsValue({ file: info.file });
    },
  };

  const handleUpload = () => {
    setUploadModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const file = values.file;
      if (!file) {
        message.error('Please select a model file');
        return;
      }
      handleImportModel(values, file);
    });
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading models...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2}>Models</Title>
          <Paragraph>
            Import and manage your YOLO models for auto-labeling
          </Paragraph>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadModels}
            loading={loading}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleUpload}
          >
            Import Model
          </Button>
        </Space>
      </div>

      {models.length > 0 && (
        <Alert
          message={`${models.length} models available`}
          description="Models are ready for auto-labeling. You can use them in your projects."
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={models}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div>No models imported yet</div>
                <Paragraph type="secondary">
                  Import your first YOLO model to start auto-labeling
                </Paragraph>
                <Button 
                  type="primary" 
                  icon={<UploadOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={handleUpload}
                >
                  Import Your First Model
                </Button>
              </div>
            )
          }}
        />
      </Card>

      <Modal
        title="Import Model"
        open={uploadModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
        }}
        width={600}
        confirmLoading={uploading}
        okText="Import Model"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Model Name"
            rules={[{ required: true, message: 'Please enter model name' }]}
          >
            <Input placeholder="Enter model name" />
          </Form.Item>

          <Form.Item
            name="model_type"
            label="Model Type"
            rules={[{ required: true, message: 'Please select model type' }]}
          >
            <Select placeholder="Select model type">
              {supportedTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Enter model description" rows={3} />
          </Form.Item>

          <Form.Item 
            name="file"
            label="Model File"
            rules={[{ required: true, message: 'Please select a model file' }]}
          >
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">
                Support for YOLO models (.pt, .onnx, .weights files)
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Models;