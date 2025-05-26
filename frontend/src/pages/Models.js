import React, { useState } from 'react';
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
  Input
} from 'antd';
import {
  UploadOutlined,
  RobotOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Dragger } = Upload;

const Models = () => {
  const [models, setModels] = useState([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Classes',
      dataIndex: 'classes',
      key: 'classes',
      render: (classes) => classes?.length || 0,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small">
            View
          </Button>
          <Button icon={<DeleteOutlined />} size="small" danger>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pt,.onnx,.weights',
    action: '/api/models/upload',
    onChange(info) {
      const { status } = info.file;
      if (status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (status === 'done') {
        message.success(`${info.file.name} file uploaded successfully.`);
      } else if (status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
  };

  const handleUpload = () => {
    setUploadModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      console.log('Form values:', values);
      setUploadModalVisible(false);
      form.resetFields();
    });
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2}>Models</Title>
          <Paragraph>
            Import and manage your YOLO models for auto-labeling
          </Paragraph>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleUpload}
        >
          Import Model
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={models}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div>No models imported yet</div>
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
        onCancel={() => setUploadModalVisible(false)}
        width={600}
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
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Enter model description" rows={3} />
          </Form.Item>

          <Form.Item label="Model File">
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