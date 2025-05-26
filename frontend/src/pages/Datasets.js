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
  Input,
  Select,
  Progress
} from 'antd';
import {
  UploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  DownloadOutlined
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

const Datasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Project',
      dataIndex: 'project',
      key: 'project',
    },
    {
      title: 'Images',
      dataIndex: 'images',
      key: 'images',
    },
    {
      title: 'Annotated',
      dataIndex: 'annotated',
      key: 'annotated',
      render: (annotated, record) => (
        <div>
          <Progress 
            percent={Math.round((annotated / record.images) * 100)} 
            size="small" 
            style={{ width: 100 }}
          />
          <span style={{ marginLeft: 8 }}>{annotated}/{record.images}</span>
        </div>
      ),
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
          <Button icon={<DeleteOutlined />} size="small" danger>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const uploadProps = {
    name: 'files',
    multiple: true,
    accept: 'image/*',
    action: '/api/datasets/upload',
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
          <Title level={2}>Datasets</Title>
          <Paragraph>
            Upload and manage your image datasets
          </Paragraph>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleUpload}
        >
          Upload Dataset
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={datasets}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <DatabaseOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div>No datasets uploaded yet</div>
                <Button 
                  type="primary" 
                  icon={<UploadOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={handleUpload}
                >
                  Upload Your First Dataset
                </Button>
              </div>
            )
          }}
        />
      </Card>

      <Modal
        title="Upload Dataset"
        open={uploadModalVisible}
        onOk={handleModalOk}
        onCancel={() => setUploadModalVisible(false)}
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
            name="project"
            label="Project"
            rules={[{ required: true, message: 'Please select a project' }]}
          >
            <Select placeholder="Select project">
              <Option value="project1">Project 1</Option>
              <Option value="project2">Project 2</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Enter dataset description" rows={3} />
          </Form.Item>

          <Form.Item label="Images">
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click or drag images to this area to upload</p>
              <p className="ant-upload-hint">
                Support for JPG, PNG, and other image formats. You can select multiple files.
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Datasets;