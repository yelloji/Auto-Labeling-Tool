import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
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
  Popconfirm,
  message,
  Progress
} from 'antd';
import {
  ProjectOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, handleAPIError } from '../services/api';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  // Load projects
  const loadProjects = async () => {
    setLoading(true);
    try {
      const projectsData = await projectsAPI.getProjects();
      setProjects(projectsData);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to load projects: ${errorInfo.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Delete project
  const handleDeleteProject = async (projectId) => {
    try {
      await projectsAPI.deleteProject(projectId);
      message.success('Project deleted successfully');
      loadProjects(); // Reload projects
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to delete project: ${errorInfo.message}`);
    }
  };

  // Create project
  const handleCreateProject = async (values) => {
    setCreating(true);
    try {
      const newProject = await projectsAPI.createProject(values);
      message.success('Project created successfully!');
      setCreateModalVisible(false);
      form.resetFields();
      loadProjects(); // Reload projects
      // Navigate to the new project
      navigate(`/projects/${newProject.id}`);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to create project: ${errorInfo.message}`);
    } finally {
      setCreating(false);
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
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description) => (
        <Text type="secondary">
          {description || 'No description'}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'project_type',
      key: 'project_type',
      render: (type) => {
        const colors = {
          'object_detection': 'blue',
          'classification': 'green',
          'segmentation': 'purple'
        };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Statistics',
      key: 'stats',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <div>
            <DatabaseOutlined style={{ marginRight: 4 }} />
            <Text>{record.total_datasets} datasets</Text>
          </div>
          <div>
            <PictureOutlined style={{ marginRight: 4 }} />
            <Text>{record.total_images} images</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_, record) => {
        const progress = record.total_images > 0 
          ? Math.round((record.labeled_images / record.total_images) * 100) 
          : 0;
        return (
          <div style={{ minWidth: '120px' }}>
            <Progress percent={progress} size="small" />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.labeled_images}/{record.total_images} labeled
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EyeOutlined />} 
            size="small"
            onClick={() => navigate(`/projects/${record.id}`)}
          >
            View
          </Button>
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => navigate(`/projects/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this project?"
            onConfirm={() => handleDeleteProject(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      handleCreateProject(values);
    });
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading projects...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2}>Projects</Title>
          <Paragraph>
            Create and manage your computer vision projects
          </Paragraph>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadProjects}
            loading={loading}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Create Project
          </Button>
        </Space>
      </div>

      {projects.length > 0 && (
        <Alert
          message={`${projects.length} projects found`}
          description="Manage your computer vision projects and track their progress."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <ProjectOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div>No projects created yet</div>
                <Paragraph type="secondary">
                  Create your first project to start organizing your datasets and models
                </Paragraph>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={handleCreate}
                >
                  Create Your First Project
                </Button>
              </div>
            )
          }}
        />
      </Card>

      <Modal
        title="Create Project"
        open={createModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        width={600}
        confirmLoading={creating}
        okText="Create Project"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Project Name"
            rules={[{ required: true, message: 'Please enter project name' }]}
          >
            <Input placeholder="Enter project name" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Enter project description" rows={3} />
          </Form.Item>

          <Form.Item
            name="project_type"
            label="Project Type"
            rules={[{ required: true, message: 'Please select project type' }]}
          >
            <Select placeholder="Select project type">
              <Option value="object_detection">Object Detection</Option>
              <Option value="classification">Image Classification</Option>
              <Option value="segmentation">Image Segmentation</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;