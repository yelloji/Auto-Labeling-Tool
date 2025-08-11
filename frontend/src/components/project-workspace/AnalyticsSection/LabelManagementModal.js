import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Table,
  Space,
  Tag,
  message,
  Popconfirm,
  ColorPicker,
  Typography,
  Divider,
  Row,
  Col,
  Card,
  Tooltip,
  Alert,
  List,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TagOutlined,
  SaveOutlined,
  CloseOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { projectsAPI, analyticsAPI } from '../../../services/api';

const { Title, Text } = Typography;

const LabelManagementModal = ({
  visible,
  onCancel,
  projectId,
  onLabelsUpdated
}) => {
  const [form] = Form.useForm();
  const [labels, setLabels] = useState([]);
  const [labelDistribution, setLabelDistribution] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState(null);

  useEffect(() => {
    if (visible && projectId) {
      loadLabels();
    }
  }, [visible, projectId]);

  const loadLabels = async () => {
    setLoading(true);
    try {
      // Load both labels and their usage distribution
      const [labelsResponse, distributionResponse] = await Promise.all([
        projectsAPI.getProjectLabels(projectId),
        analyticsAPI.getProjectLabelDistribution(projectId).catch(() => ({ label_distribution: {} }))
      ]);

      const labelsData = labelsResponse.data || labelsResponse || [];
      const distributionData = distributionResponse.label_distribution || {};

      setLabels(labelsData);
      setLabelDistribution(distributionData);
    } catch (error) {
      console.error('Error loading labels:', error);
      message.error('Failed to load labels');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLabel = () => {
    setIsCreating(true);
    setEditingLabel(null);
    form.resetFields();

    // Auto-assign color based on existing label count
    const defaultColors = [
      '#f50', '#2db7f5', '#87d068', '#108ee9', '#f56a00',
      '#722ed1', '#eb2f96', '#52c41a', '#13c2c2', '#1890ff',
      '#fa541c', '#faad14', '#a0d911', '#36cfc9', '#40a9ff'
    ];
    const nextColor = defaultColors[labels.length % defaultColors.length];

    form.setFieldsValue({
      name: '',
      color: nextColor
    });
  };

  const handleEditLabel = (label) => {
    setEditingLabel(label);
    setIsCreating(false);
    form.setFieldsValue({
      name: label.name,
      color: label.color
    });
  };

  const handleSaveLabel = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Normalize color value
      const colorValue = typeof values.color === 'string' ? values.color : values.color.toHexString();

      if (isCreating) {
        // Check if label name already exists
        const existingLabel = labels.find(label => 
          label.name.toLowerCase() === values.name.toLowerCase()
        );
        
        if (existingLabel) {
          message.error(`Label "${values.name}" already exists. Please choose a different name.`);
          return;
        }

        // Create new label
        await projectsAPI.createProjectLabel(projectId, {
          name: values.name,
          color: colorValue
        });
        message.success('Label created successfully');
      } else if (editingLabel) {
        // Check if the new name conflicts with existing labels (excluding current label)
        const existingLabel = labels.find(label => 
          label.id !== editingLabel.id && 
          label.name.toLowerCase() === values.name.toLowerCase()
        );
        
        if (existingLabel) {
          message.error(`Label "${values.name}" already exists. Please choose a different name.`);
          return;
        }

        // Update existing label
        console.log(`Updating label ${editingLabel.id} with:`, { name: values.name, color: colorValue });
        await projectsAPI.updateProjectLabel(projectId, editingLabel.id, {
          name: values.name,
          color: colorValue
        });
        message.success('Label updated successfully');
      }

      // Reset form and reload labels
      form.resetFields();
      setIsCreating(false);
      setEditingLabel(null);
      await loadLabels();

      // Notify parent component
      if (onLabelsUpdated) {
        onLabelsUpdated();
      }
    } catch (error) {
      console.error('Error saving label:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save label';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (label) => {
    setLabelToDelete(label);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!labelToDelete) return;

    try {
      setLoading(true);
      
      const usage = labelDistribution[labelToDelete.name];
      const count = usage?.count || 0;
      
      console.log(`Deleting label "${labelToDelete.name}" (ID: ${labelToDelete.id}) with ${count} annotations`);
      
      await projectsAPI.deleteProjectLabel(projectId, labelToDelete.id);
      
      if (count > 0) {
        message.success(`Label "${labelToDelete.name}" deleted successfully. ${count} annotations were removed.`);
      } else {
        message.success(`Label "${labelToDelete.name}" deleted successfully.`);
      }
      
      setDeleteModalVisible(false);
      setLabelToDelete(null);
      await loadLabels();

      // Notify parent component
      if (onLabelsUpdated) {
        onLabelsUpdated();
      }
    } catch (error) {
      console.error('Error deleting label:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete label';
      message.error(`Failed to delete label: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalVisible(false);
    setLabelToDelete(null);
  };

  const handleCancel = () => {
    form.resetFields();
    setIsCreating(false);
    setEditingLabel(null);
    onCancel();
  };

  const handleCancelEdit = () => {
    form.resetFields();
    setIsCreating(false);
    setEditingLabel(null);
  };

  const generateRandomColor = () => {
    const colors = [
      '#f50', '#2db7f5', '#87d068', '#108ee9', '#f56a00',
      '#722ed1', '#eb2f96', '#52c41a', '#13c2c2', '#1890ff',
      '#fa541c', '#faad14', '#a0d911', '#36cfc9', '#40a9ff'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const columns = [
    {
      title: 'Label',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: record.color,
              borderRadius: 4,
              border: '1px solid #d9d9d9'
            }}
          />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      render: (color) => <Tag color={color}>{color}</Tag>
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_, record) => {
        const usage = labelDistribution[record.name];
        const count = usage?.count || 0;
        const percentage = usage?.percentage || 0;

        return (
          <Space direction="vertical" size={0}>
            <Badge
              count={count}
              style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}
              showZero
            />
            {count > 0 && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {percentage.toFixed(1)}%
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const usage = labelDistribution[record.name];
        const count = usage?.count || 0;
        const hasAnnotations = count > 0;

        return (
          <Space>
            <Tooltip title="Edit Label">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEditLabel(record)}
                size="small"
              />
            </Tooltip>
            {!hasAnnotations && (
              <Tooltip title="Delete Label (only available when no annotations exist)">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteClick(record)}
                  size="small"
                />
              </Tooltip>
            )}
            {hasAnnotations && (
              <Tooltip title={`Cannot delete: ${count} annotation${count > 1 ? 's' : ''} exist for this label`}>
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  disabled
                  style={{ color: '#d9d9d9' }}
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <TagOutlined />
          <span>Manage Project Labels</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="Label Management"
          description={
            <div>
              <p>Create, edit, and manage labels for your project. Labels are used to categorize and annotate your images.</p>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li><strong>Create:</strong> Add new labels with unique names and colors</li>
                <li><strong>Edit:</strong> Rename labels or change colors (updates all existing annotations)</li>
                <li><strong>Delete:</strong> Remove labels and all associated annotations</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingLabel) && (
        <Card
          title={isCreating ? "Create New Label" : "Edit Label"}
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={handleCancelEdit}
              size="small"
            />
          }
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveLabel}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Label Name"
                  rules={[
                    { required: true, message: 'Please enter a label name' },
                    { min: 1, max: 50, message: 'Label name must be between 1 and 50 characters' },
                    { 
                      pattern: /^[a-zA-Z0-9_\-\s]+$/, 
                      message: 'Label name can only contain letters, numbers, spaces, hyphens, and underscores' 
                    },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        
                        // Check for duplicate names (case-insensitive)
                        const existingLabel = labels.find(label => {
                          // If editing, exclude the current label from the check
                          if (editingLabel && label.id === editingLabel.id) return false;
                          return label.name.toLowerCase() === value.toLowerCase();
                        });
                        
                        if (existingLabel) {
                          return Promise.reject(new Error(`Label "${value}" already exists`));
                        }
                        
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <Input 
                    placeholder="Enter label name" 
                    maxLength={50}
                    showCount
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="color"
                  label="Label Color"
                  rules={[{ required: true, message: 'Please select a color' }]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ColorPicker
                      showText
                      format="hex"
                      presets={[
                        {
                          label: 'Recommended',
                          colors: [
                            '#f50', '#2db7f5', '#87d068', '#108ee9', '#f56a00',
                            '#722ed1', '#eb2f96', '#52c41a', '#13c2c2', '#1890ff',
                            '#fa541c', '#faad14', '#a0d911', '#36cfc9', '#40a9ff'
                          ]
                        }
                      ]}
                    />
                    <Button
                      type="link"
                      size="small"
                      onClick={() => form.setFieldsValue({ color: generateRandomColor() })}
                    >
                      Random
                    </Button>
                  </div>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                  {isCreating ? 'Create Label' : 'Update Label'}
                </Button>
                <Button onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* Labels Table */}
      <Card
        title="Existing Labels"
        size="small"
        extra={
          !isCreating && !editingLabel && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateLabel}
              size="small"
            >
              Create Label
            </Button>
          )
        }
      >
        <Table
          dataSource={labels}
          columns={columns}
          loading={loading}
          pagination={false}
          size="small"
          rowKey="id"
          locale={{
            emptyText: 'No labels found. Create your first label to get started.'
          }}
        />
      </Card>

      <Divider />

      <div style={{ textAlign: 'right' }}>
        <Button onClick={handleCancel}>
          Close
        </Button>
      </div>

      {/* Smart Delete Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>Delete Label</span>
          </Space>
        }
        open={deleteModalVisible}
        onCancel={handleDeleteCancel}
        footer={null}
        width={500}
        destroyOnClose
      >
        {labelToDelete && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: labelToDelete.color,
                    borderRadius: 4,
                    border: '1px solid #d9d9d9'
                  }}
                />
                <Text strong>"{labelToDelete.name}"</Text>
              </Space>
            </div>

            {(() => {
              const usage = labelDistribution[labelToDelete.name];
              const count = usage?.count || 0;
              const percentage = usage?.percentage || 0;
              const isUsed = count > 0;

              if (isUsed) {
                return (
                  <>
                    <Alert
                      message="⚠️ Warning: Label is in use"
                      description={
                        <div>
                          <p>This label is currently being used in <strong>{count} annotations</strong> ({percentage.toFixed(1)}% of total annotations).</p>
                          <p><strong>Deleting this label will:</strong></p>
                          <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                            <li>Permanently remove all {count} annotations using this label</li>
                            <li>Images with only this label will become unlabeled</li>
                            <li>This action cannot be undone</li>
                          </ul>
                          <p style={{ marginBottom: 0, fontWeight: 'bold', color: '#fa541c' }}>
                            Consider renaming the label instead of deleting it if you want to preserve the annotations.
                          </p>
                        </div>
                      }
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ color: '#fa541c' }}>
                        Are you sure you want to delete this label and lose all {count} annotations?
                      </Text>
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <Alert
                      message="Safe to delete"
                      description="This label is not currently being used in any annotations. It's safe to delete."
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <Text>Are you sure you want to delete this label?</Text>
                    </div>
                  </>
                );
              }
            })()}

            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Space>
                <Button onClick={handleDeleteCancel}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  danger
                  onClick={handleDeleteConfirm}
                  loading={loading}
                  icon={<DeleteOutlined />}
                >
                  {(() => {
                    const usage = labelDistribution[labelToDelete.name];
                    const count = usage?.count || 0;
                    return count > 0 ? `Delete & Lose ${count} Annotations` : 'Delete Label';
                  })()}
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
};

export default LabelManagementModal;
