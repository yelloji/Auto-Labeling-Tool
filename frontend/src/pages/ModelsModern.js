import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Upload, 
  message, 
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
  Row,
  Col,
  Statistic,
  Progress,
  Empty,
  Tooltip,
  Badge,
  Dropdown,
  Menu,
  Divider
} from 'antd';
import { logInfo, logError, logUserClick } from '../utils/professional_logger';
  import { 
    UploadOutlined,
    RobotOutlined,
    DeleteOutlined,
    EyeOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    DownloadOutlined,
    MoreOutlined,
    ExperimentOutlined,
    ThunderboltOutlined,
    CloudUploadOutlined,
    SettingOutlined,
    BarChartOutlined,
    SearchOutlined,
    FilterOutlined,
    StarOutlined,
    ClockCircleOutlined,
    QuestionCircleOutlined
  } from '@ant-design/icons';
import { modelsAPI, handleAPIError } from '../services/api';
import YAML from 'yaml';

const { Title, Paragraph, Text } = Typography;
  const { Dragger } = Upload;
const { Option } = Select;
const { Search } = Input;

const ModelsModern = () => {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState(['yolov8n', 'yolov8s', 'yolov8m', 'yolov8l', 'yolov8x', 'custom']);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [form] = Form.useForm();

  useEffect(() => {
    logInfo('app.frontend.navigation', 'ModelsModern page loaded', 'page_view', { component: 'ModelsModern' });
    logInfo('app.frontend.ui', 'ModelsModern component mounted', 'component_mount', { component: 'ModelsModern' });
    loadModels();
    
    // Cleanup function for component unmount
    return () => {
      logInfo('app.frontend.ui', 'ModelsModern component unmounted', 'component_unmount', { component: 'ModelsModern' });
    };
  }, []);

  useEffect(() => {
    // Filter models based on search term and type
    let filtered = models;
    
    if (searchTerm) {
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterType !== 'all') {
      if (filterType === 'custom') {
        // Show models that were imported by user, regardless of task type
        filtered = filtered.filter(model => model.is_custom);
      } else {
        filtered = filtered.filter(model => model.type === filterType);
      }
    }
    
    setFilteredModels(filtered);
  }, [models, searchTerm, filterType]);

  // Load models and supported types
  const loadModels = async () => {
    setLoading(true);
    logInfo('app.frontend.ui', 'ModelsModern loading state changed', 'state_change', { component: 'ModelsModern', newState: 'loading_started' });
    
    try {
      logInfo('app.frontend.interactions', 'Loading AI models', 'load_models', { component: 'ModelsModern' });
      const modelsData = await modelsAPI.getModels();
      setModels(modelsData || []);
      
      logInfo('app.frontend.interactions', 'AI models loaded successfully', 'load_models', { component: 'ModelsModern', modelCount: modelsData?.length || 0 });
      logInfo('app.frontend.ui', 'ModelsModern state updated', 'state_change', { component: 'ModelsModern', newState: 'models_loaded', modelCount: modelsData?.length || 0 });
      
      // Try to get supported types, but don't fail if it doesn't work
      try {
        logInfo('app.frontend.interactions', 'Loading supported model types', 'load_supported_types', { component: 'ModelsModern' });
        const typesData = await modelsAPI.getSupportedTypes();
        if (Array.isArray(typesData)) {
          setSupportedTypes(typesData);
          logInfo('app.frontend.interactions', 'Supported model types loaded', 'load_supported_types', { component: 'ModelsModern', typeCount: typesData.length });
        }
      } catch (typesError) {
        logError('app.frontend.validation', 'Could not load supported types, using defaults', typesError, { component: 'ModelsModern' });
        console.warn('Could not load supported types, using defaults');
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.validation', 'Failed to load AI models', error, { component: 'ModelsModern', errorInfo });
      message.error(`Failed to load models: ${errorInfo.message}`);
      setModels([]);
    } finally {
      setLoading(false);
      logInfo('app.frontend.ui', 'ModelsModern loading state changed', 'state_change', { component: 'ModelsModern', newState: 'loading_finished' });
    }
  };

  // Upload model
  const handleUpload = async (values) => {
    setUploading(true);
    logInfo('app.frontend.ui', 'ModelsModern upload state changed', 'state_change', { component: 'ModelsModern', newState: 'uploading_started' });
    
    try {
      logUserClick('ModelsModern', 'upload_model');
      logInfo('app.frontend.interactions', 'Preparing model upload payload', 'upload_model_prepare', { component: 'ModelsModern', modelName: values.name, modelType: values.type });

      // Validate form values and build multipart/form-data
      const fileItem = Array.isArray(values.file) ? values.file[0] : null;
      const rawFile = fileItem?.originFileObj || null;
      if (!rawFile) {
        message.error('Please select a model file (.pt, .onnx, or .engine)');
        throw new Error('No file selected');
      }

      const formData = new FormData();
      formData.append('file', rawFile);
      formData.append('name', values.name);
      formData.append('type', values.type);
      if (values.description) formData.append('description', values.description);
      // Optional: classes as JSON string if you ever support it
      // if (values.classes) formData.append('classes', JSON.stringify(values.classes));

      // If uploading a .pt model, include training input size from UI
      const fileName = (rawFile.name || '').toLowerCase();
      const ext = fileName.slice(fileName.lastIndexOf('.'));
      if (ext === '.pt') {
        const w = values.training_input_width;
        const h = values.training_input_height;
        if (!w || !h) {
          message.error('Please provide training input width and height for .pt models');
          throw new Error('Missing training input size for .pt');
        }
        const size = [parseInt(w, 10), parseInt(h, 10)];
        formData.append('training_input_size', JSON.stringify(size));
      } else if (ext === '.onnx') {
        const w = values.training_input_width;
        const h = values.training_input_height;
        if (!w || !h) {
          message.error('Please provide training input width and height for .onnx models');
          throw new Error('Missing training input size for .onnx');
        }
        const yamlList = values.classes_yaml || [];
        const hasYaml = Array.isArray(yamlList) && yamlList.length > 0;
        let classList = null;
        let ncVal = null;
        if (!hasYaml) {
          const classesCsv = (values.onnx_classes_csv || '').trim();
          if (!classesCsv) {
            message.error('Please provide classes (comma-separated) for .onnx models');
            throw new Error('Missing classes for .onnx');
          }
          classList = classesCsv.split(',').map(s => s.trim()).filter(s => s.length > 0);
          ncVal = parseInt(values.onnx_nc, 10);
          if (!ncVal || ncVal <= 0) {
            message.error('Please provide a valid number of classes (nc) for .onnx models');
            throw new Error('Invalid nc for .onnx');
          }
          if (classList.length !== ncVal) {
            message.error(`nc (${ncVal}) must match classes length (${classList.length})`);
            throw new Error('nc mismatch with classes length');
          }
        }
        const size = [parseInt(w, 10), parseInt(h, 10)];
        formData.append('training_input_size', JSON.stringify(size));
        if (hasYaml) {
          const yamlFile = yamlList[0]?.originFileObj || yamlList[0]?.file || yamlList[0]?.originFileObj;
          if (yamlFile) formData.append('classes_yaml', yamlFile);
          // If user also typed classes/nc, include them for cross-checking on backend
          const classesCsvOpt = (values.onnx_classes_csv || '').trim();
          const ncOpt = values.onnx_nc;
          if (classesCsvOpt) {
            const classListOpt = classesCsvOpt.split(',').map(s => s.trim()).filter(s => s.length > 0);
            formData.append('classes', JSON.stringify(classListOpt));
          }
          if (ncOpt) {
            formData.append('nc', String(parseInt(ncOpt, 10)));
          }
        } else {
          formData.append('classes', JSON.stringify(classList));
          formData.append('nc', String(ncVal));
        }
      }

      // Use the correct API function for multipart import
      await modelsAPI.importModel(formData);
      
      logInfo('app.frontend.interactions', 'AI model uploaded successfully', 'upload_model', { component: 'ModelsModern', modelName: values.name, modelType: values.type });
      logInfo('app.frontend.ui', 'Upload modal closed', 'modal_close', { component: 'ModelsModern', modal: 'upload_model' });
      
      message.success('Model uploaded successfully!');
      setUploadModalVisible(false);
      form.resetFields();
      loadModels();
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.validation', 'Failed to upload AI model', error, { component: 'ModelsModern', modelName: values.name, modelType: values.type, errorInfo });
      message.error(`Failed to upload model: ${errorInfo.message}`);
    } finally {
      setUploading(false);
      logInfo('app.frontend.ui', 'ModelsModern upload state changed', 'state_change', { component: 'ModelsModern', newState: 'uploading_finished' });
    }
  };

  // Delete model
  const handleDelete = async (modelId) => {
    try {
      logUserClick('ModelsModern', 'delete_model');
      logInfo('app.frontend.interactions', 'Deleting AI model', 'delete_model', { component: 'ModelsModern', modelId });
      
      await modelsAPI.deleteModel(modelId);
      
      logInfo('app.frontend.interactions', 'AI model deleted successfully', 'delete_model', { component: 'ModelsModern', modelId });
      message.success('Model deleted successfully');
      loadModels();
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.validation', 'Failed to delete AI model', error, { component: 'ModelsModern', modelId, errorInfo });
      message.error(`Failed to delete model: ${errorInfo.message}`);
    }
  };

  // Get model type info for styling
  const getModelTypeInfo = (type) => {
    const typeInfo = {
      // Primary types we use in this app
      'object_detection': { color: 'blue', label: 'Object Detection', icon: <BarChartOutlined /> },
      'instance_segmentation': { color: 'purple', label: 'Segmentation', icon: <ExperimentOutlined /> },
      'custom': { color: 'cyan', label: 'Custom Model', icon: <SettingOutlined /> }
    };
    return typeInfo[type] || { color: 'default', label: type, icon: <RobotOutlined /> };
  };

  // Get model status info
  const getModelStatus = (model) => {
    if (model.is_training) {
      return { status: 'processing', text: 'Training', color: 'blue' };
    }
    if (model.is_ready) {
      return { status: 'success', text: 'Ready', color: 'green' };
    }
    return { status: 'warning', text: 'Pending', color: 'orange' };
  };

  // Generate model thumbnail
  const getModelThumbnail = (model) => {
    const typeInfo = getModelTypeInfo(model.type);
    return (
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${
          typeInfo.color === 'blue' ? '#1890ff, #40a9ff' : 
          typeInfo.color === 'green' ? '#52c41a, #73d13d' : 
          typeInfo.color === 'orange' ? '#fa8c16, #ffa940' :
          typeInfo.color === 'red' ? '#f5222d, #ff4d4f' :
          typeInfo.color === 'purple' ? '#722ed1, #9254de' :
          typeInfo.color === 'cyan' ? '#13c2c2, #36cfc9' : '#d9d9d9, #f0f0f0'
        })`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        flexShrink: 0
      }}>
        {typeInfo.icon}
      </div>
    );
  };

  const renderModelCard = (model) => {
    const typeInfo = getModelTypeInfo(model.type);
    const statusInfo = getModelStatus(model);
    
    const moreMenu = (
      <Menu>
        <Menu.Item 
          key="view" 
          icon={<EyeOutlined />}
          onClick={() => {
            logUserClick('ModelsModern', 'view_model_details');
            logInfo('app.frontend.interactions', 'Viewing model details', 'view_model', { component: 'ModelsModern', modelId: model.id, modelName: model.name, modelType: model.type });
            logInfo('app.frontend.ui', 'View modal opened', 'modal_open', { component: 'ModelsModern', modal: 'view_model', modelId: model.id });
            setSelectedModel(model);
            setViewModalVisible(true);
          }}
        >
          View Details
        </Menu.Item>
        {model.is_custom && (
          <Menu.Item 
            key="download" 
            icon={<DownloadOutlined />}
            onClick={() => {
              logUserClick('ModelsModern', 'download_model');
              logInfo('app.frontend.interactions', 'Download model requested', 'download_model', { component: 'ModelsModern', modelId: model.id, modelName: model.name });
              const hide = message.loading('Preparing download...', 0);
              modelsAPI.downloadModel(model.id)
                .then(({ blob, filename }) => {
                  try {
                    // Create a temporary link to trigger browser download
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    // Fallback filename if header is not accessible: use model.format to infer extension
                    const extMap = { pytorch: '.pt', onnx: '.onnx', engine: '.engine' };
                    const fallbackExt = extMap[(model.format || '').toLowerCase()] || '';
                    const safeName = (model.name || `model_${model.id || 'download'}`).replace(/\s+/g, '_');
                    const fallbackFilename = `${safeName}${fallbackExt}`;
                    link.download = filename || fallbackFilename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    message.success(`Downloading ${filename || fallbackFilename}`);
                    logInfo('app.frontend.file', 'Model download started', 'download_model_started', {
                      component: 'ModelsModern',
                      modelId: model.id,
                      modelName: model.name,
                      filename: filename || fallbackFilename,
                    });
                  } finally {
                    hide();
                  }
                })
                .catch((error) => {
                  hide();
                  handleAPIError(error, 'Download Model');
                  logError('app.frontend.errors', 'download_model_failed', 'Download model failed', error, {
                    component: 'ModelsModern',
                    modelId: model.id,
                    modelName: model.name,
                  });
                });
            }}
          >
            Download Model
          </Menu.Item>
        )}
        {model.is_custom && (
          <>
            <Menu.Divider />
            <Menu.Item 
              key="delete" 
              icon={<DeleteOutlined />}
              danger
              onClick={() => {
                logUserClick('ModelsModern', 'confirm_delete_model');
                logInfo('app.frontend.interactions', 'Delete model confirmation dialog opened', 'confirm_delete', { component: 'ModelsModern', modelId: model.id, modelName: model.name });
                Modal.confirm({
                  title: 'Delete Model',
                  content: `Are you sure you want to delete "${model.name}"? This action cannot be undone.`,
                  okText: 'Delete',
                  okType: 'danger',
                  cancelText: 'Cancel',
                  onOk: () => handleDelete(model.id),
                });
              }}
            >
              Delete Model
            </Menu.Item>
          </>
        )}
      </Menu>
    );

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={model.id}>
        <Card
          hoverable
          style={{ 
            height: '100%',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            transition: 'all 0.2s ease'
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {/* Model Thumbnail */}
            {getModelThumbnail(model)}
            
            {/* Model Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Model Type Badge */}
              <Tag 
                color={typeInfo.color} 
                style={{ 
                  marginBottom: '8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex' }}>{typeInfo.icon}</span>
                  {typeInfo.label}
                </span>
              </Tag>
              {model.is_custom && (
                <Tag 
                  color="cyan"
                  style={{ 
                    marginBottom: '8px',
                    marginLeft: '8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    border: 'none'
                  }}
                >
                  Custom
                </Tag>
              )}
              
              {/* Model Name */}
              <Title 
                level={4} 
                style={{ 
                  margin: 0, 
                  marginBottom: '4px',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '20px'
                }}
                ellipsis={{ tooltip: model.name }}
              >
                {model.name}
              </Title>
              
              {/* Model Description */}
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: '13px',
                  lineHeight: '18px',
                  display: 'block',
                  marginBottom: '12px'
                }}
                ellipsis={{ tooltip: model.description }}
              >
                {model.description || 'No description provided'}
              </Text>
              
              {/* Model Stats */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                marginBottom: '8px',
                fontSize: '13px',
                color: '#666'
              }}>
                {model.accuracy && (
                  <span>
                    <BarChartOutlined style={{ marginRight: '4px' }} />
                    {`${model.accuracy}% mAP`}
                  </span>
                )}
                <span>
                  <ClockCircleOutlined style={{ marginRight: '4px' }} />
                  {model.file_size ? `${(model.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown'}
                </span>
              </div>
              
              {/* Status and Date */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                fontSize: '12px',
                color: '#999'
              }}>
                <Badge 
                  status={statusInfo.status} 
                  text={statusInfo.text}
                  style={{ fontSize: '12px' }}
                />
                <span>
                  {new Date(model.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            {/* Action Menu */}
            <Dropdown 
              overlay={moreMenu} 
              trigger={['click']}
              placement="bottomRight"
            >
              <Button 
                type="text"
                icon={<MoreOutlined />}
                style={{ 
                  color: '#999',
                  border: 'none',
                  boxShadow: 'none'
                }}
              />
            </Dropdown>
          </div>
          
          {/* Training Progress (if training) */}
          {model.is_training && (
            <div style={{ marginTop: '12px' }}>
              <Text style={{ fontSize: '12px', color: '#666' }}>Training Progress</Text>
              <Progress 
                percent={model.training_progress || 0} 
                size="small"
                status="active"
                style={{ marginTop: '4px' }}
              />
            </div>
          )}
        </Card>
      </Col>
    );
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
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '32px'
      }}>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: '#C0C0C0' }}>
            🤖 AI Models
          </Title>
          <Text type="secondary" style={{ fontSize: '16px', color: '#C0C0C0' }}>
            Manage your machine learning models for auto-labeling
          </Text>
        </div>
        <Space size="middle">
          <Button 
            icon={<ReloadOutlined />}
            onClick={() => {
              logUserClick('ModelsModern', 'refresh_models');
              logInfo('app.frontend.interactions', 'Refreshing AI models', 'refresh_models', { component: 'ModelsModern' });
              loadModels();
            }}
            style={{ 
              borderRadius: '6px',
              height: '36px'
            }}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<CloudUploadOutlined />}
            onClick={() => {
              logUserClick('ModelsModern', 'open_upload_modal');
              logInfo('app.frontend.ui', 'Upload modal opened', 'modal_open', { component: 'ModelsModern', modal: 'upload_model' });
              setUploadModalVisible(true);
            }}
            style={{ 
              borderRadius: '6px',
              height: '36px',
              fontSize: '14px',
              background: '#722ed1',
              borderColor: '#722ed1'
            }}
          >
            Upload Model
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Total Models" 
              value={models.length} 
              prefix={<RobotOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Ready Models" 
              value={models.filter(m => m.is_ready).length} 
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Training (All Projects)" 
              value={models.filter(m => m.is_training).length} 
              prefix={<ExperimentOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Custom Models" 
              value={models.filter(m => m.is_custom).length} 
              prefix={<SettingOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Search and Filter Bar */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <Search
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => {
              logInfo('app.frontend.ui', 'Model search term changed', 'search_input', { component: 'ModelsModern', searchTerm: e.target.value });
              setSearchTerm(e.target.value);
            }}
            style={{ width: 250 }}
            allowClear
          />
          
          <Select
            value={filterType}
            onChange={(value) => {
              logInfo('app.frontend.ui', 'Model filter type changed', 'filter_change', { component: 'ModelsModern', filterType: value });
              setFilterType(value);
            }}
            style={{ width: 220 }}
          >
            <Option value="all">All Types</Option>
            <Option value="object_detection">Object Detection</Option>
            <Option value="instance_segmentation">Segmentation</Option>
            <Option value="custom">Custom</Option>
          </Select>

          <Text type="secondary">
            {filteredModels.length} of {models.length} models
          </Text>
        </div>
      </Card>

      {/* Models Grid */}
      {filteredModels.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchTerm || filterType !== 'all' 
                ? "No models match your filters" 
                : "No models available"
            }
          >
            {!searchTerm && filterType === 'all' && (
              <Button 
                type="primary" 
                icon={<CloudUploadOutlined />}
                onClick={() => {
                  logUserClick('ModelsModern', 'upload_first_model');
                  logInfo('app.frontend.ui', 'Upload modal opened from empty state', 'modal_open', { component: 'ModelsModern', modal: 'upload_model', trigger: 'empty_state' });
                  setUploadModalVisible(true);
                }}
              >
                Upload Your First Model
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredModels.map(renderModelCard)}
        </Row>
      )}

      {/* Upload Model Modal */}
      <Modal
        title="Upload Model"
        open={uploadModalVisible}
        onCancel={() => {
          logUserClick('ModelsModern', 'cancel_upload_modal');
          logInfo('app.frontend.ui', 'Upload modal closed', 'modal_close', { component: 'ModelsModern', modal: 'upload_model' });
          setUploadModalVisible(false);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
          onFinishFailed={(errorInfo) => {
            logError('app.frontend.validation', 'Model upload form validation failed', null, { component: 'ModelsModern', errorInfo });
          }}
        >
          <Form.Item
            name="name"
            label="Model Name"
            rules={[
              { required: true, message: 'Please enter model name' },
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  const v = (value || '').trim();
                  if (!v) return Promise.resolve();
                  const exists = (models || []).some(m => (m?.is_custom) && (m?.name || '').toLowerCase() === v.toLowerCase());
                  if (exists) {
                    return Promise.reject(new Error('Model name already exists. Please choose another name.'));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <Input placeholder="Enter model name" />
          </Form.Item>

          {/* Name suggestions if duplicate (no automatic 'custom' in suggestions) */}
          <Form.Item shouldUpdate noStyle>
            {() => {
              const v = (form.getFieldValue('name') || '').trim();
              if (!v) return null;
              const exists = (models || []).some(m => (m?.is_custom) && (m?.name || '').toLowerCase() === v.toLowerCase());
              if (!exists) return null;
              const base = v.replace(/\s+/g, '_');
              const suggestions = [`${base}_new`, `${base}_alt`, `${base}_v2`];
              return (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                  message={<span>Model name "{v}" already exists. Try: {suggestions.join(', ')}</span>} />
              );
            }}
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Enter model description (optional)" 
            />
          </Form.Item>

          <Form.Item
            name="type"
            label="Model Type"
            rules={[{ required: true, message: 'Please select model type' }]}
          >
            <Select placeholder="Select model type">
              {(() => {
                // Only show the two supported tasks for import; backend expects ModelType, not 'custom'
                const allowed = ['object_detection', 'instance_segmentation'];
                const filtered = (supportedTypes || []).filter(t => allowed.includes(t));
                const typesToShow = filtered.length > 0 ? filtered : allowed;
                return typesToShow.map(type => (
                  <Option key={type} value={type}>
                    {getModelTypeInfo(type).label}
                  </Option>
                ));
              })()}
            </Select>
          </Form.Item>

          <Form.Item
            name="file"
            label="Model File"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              // Normalize Upload event to fileList for Form
              if (Array.isArray(e)) return e;
              return e && e.fileList ? e.fileList.slice(-1) : [];
            }}
            rules={[{ required: true, message: 'Please upload model file' }]}
          >
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={(file) => {
                // Validate file type
                const validTypes = ['.pt', '.onnx', '.engine'];
                const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                if (!validTypes.includes(fileExtension)) {
                  logError('app.frontend.validation', 'Invalid model file type uploaded', null, { 
                    component: 'ModelsModern', 
                    fileName: file.name, 
                    fileType: fileExtension,
                    validTypes 
                  });
                  message.error('Invalid file type. Please upload .pt, .onnx, or .engine files only.');
                  return false;
                }
                
                // Validate file size (max 100MB to match backend)
                const maxSize = 100 * 1024 * 1024; // 100MB
                if (file.size > maxSize) {
                  logError('app.frontend.validation', 'Model file too large', null, { 
                    component: 'ModelsModern', 
                    fileName: file.name, 
                    fileSize: file.size,
                    maxSize 
                  });
                  message.error('File too large. Maximum size is 100MB.');
                  return false;
                }
                
                return false; // Prevent auto upload; file captured in Form via fileList
              }}
              accept=".pt,.onnx,.engine"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click or drag model file to upload</p>
              <p className="ant-upload-hint">
                Support .pt, .onnx, .engine formats
              </p>
            </Dragger>
          </Form.Item>

          {/* Conditional metadata for .pt models */}
          <Form.Item shouldUpdate={(prev, cur) => prev.file !== cur.file} noStyle>
            {() => {
              const fileList = form.getFieldValue('file') || [];
              const fileItem = Array.isArray(fileList) ? fileList[0] : null;
              const name = fileItem?.originFileObj?.name || fileItem?.name || '';
              const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
              const isPt = ext === '.pt';
              const isOnnx = ext === '.onnx';

              if (!isPt) return null;

              return (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={
                      <span>
                        For .pt models, classes are auto-detected. Please provide the training input image size used during training.
                      </span>
                    }
                  />
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="training_input_width"
                        label="Training Input Width"
                        rules={[{ required: true, message: 'Please enter width (e.g., 640)' }]}
                      >
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="training_input_height"
                        label="Training Input Height"
                        rules={[{ required: true, message: 'Please enter height (e.g., 640)' }]}
                      >
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              );
            }}
          </Form.Item>

          {/* Conditional metadata for .onnx models */}
          <Form.Item shouldUpdate={(prev, cur) => prev.file !== cur.file} noStyle>
            {() => {
              const fileList = form.getFieldValue('file') || [];
              const fileItem = Array.isArray(fileList) ? fileList[0] : null;
              const name = fileItem?.originFileObj?.name || fileItem?.name || '';
              const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
              const isOnnx = ext === '.onnx';

              if (!isOnnx) return null;

              return (
                <>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={
                      <span>
                        For .onnx models, please provide training input size, classes (comma-separated), and number of classes (nc).
                      </span>
                    }
                  />
                  <Form.Item
                    name="classes_yaml"
                    label="Classes YAML (optional)"
                    valuePropName="fileList"
                    getValueFromEvent={(e) => {
                      if (Array.isArray(e)) return e;
                      return e && e.fileList ? e.fileList.slice(-1) : [];
                    }}
                    extra="Upload Ultralytics-style data.yaml to auto-fill classes and nc"
                  >
                    <Upload
                      name="classes_yaml"
                      multiple={false}
                      beforeUpload={() => false}
                      accept=".yaml,.yml"
                      onChange={async ({ file }) => {
                        try {
                          const origin = file?.originFileObj || file;
                          if (!origin) return;
                          const text = await origin.text();
                          const data = YAML.parse(text);
                          let names = [];
                          const rawNames = data && data.names;
                          if (Array.isArray(rawNames)) {
                            names = rawNames.map((n) => String(n));
                          } else if (rawNames && typeof rawNames === 'object') {
                            names = Object.entries(rawNames)
                              .sort((a, b) => Number(a[0]) - Number(b[0]))
                              .map(([, v]) => String(v));
                          }
                          const parsedNc = data && (typeof data.nc !== 'undefined') ? Number(data.nc) : (names.length || null);
                          if (!names || names.length === 0) {
                            message.warning('YAML parsed but no names found. Please fill classes and nc manually.');
                            return;
                          }
                          if (!parsedNc || parsedNc <= 0) {
                            message.warning('YAML parsed but nc missing/invalid. Please enter nc manually.');
                          }
                          if (parsedNc && parsedNc !== names.length) {
                            message.warning(`YAML nc (${parsedNc}) does not match names length (${names.length}). Using names length.`);
                          }
                          // Auto-fill the form fields
                          form.setFieldsValue({
                            onnx_classes_csv: names.join(','),
                            onnx_nc: String(names.length)
                          });
                          message.success('Classes and nc auto-filled from YAML');
                        } catch (err) {
                          message.error(`Failed to parse YAML: ${err?.message || 'Unknown error'}`);
                        }
                      }}
                    >
                      <Button icon={<UploadOutlined />}>Select YAML</Button>
                    </Upload>
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="training_input_width"
                        label="Training Input Width"
                        rules={[{ required: true, message: 'Please enter width (e.g., 640)' }]}
                      >
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="training_input_height"
                        label="Training Input Height"
                        rules={[{ required: true, message: 'Please enter height (e.g., 640)' }]}
                      >
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="onnx_classes_csv"
                    label={
                      <span>
                        Classes (comma-separated)
                        <Tooltip title="Order defines class IDs (0-based). Keep the same order as used during training/yaml.">
                          <QuestionCircleOutlined style={{ marginLeft: 6 }} />
                        </Tooltip>
                      </span>
                    }
                    rules={[({ getFieldValue }) => ({
                      validator: (_, value) => {
                        const yamlList = getFieldValue('classes_yaml') || [];
                        const hasYaml = Array.isArray(yamlList) && yamlList.length > 0;
                        if (hasYaml) return Promise.resolve();
                        if (!value || !String(value).trim()) {
                          return Promise.reject(new Error('Please enter class names (comma-separated)'));
                        }
                        return Promise.resolve();
                      }
                    })]}
                    extra="Example: person, car, dog → IDs: person(0), car(1), dog(2). nc must equal classes count."
                  >
                    <Input placeholder="e.g., person,car,dog" />
                  </Form.Item>
                  <Form.Item
                    name="onnx_nc"
                    label="Number of Classes (nc)"
                    rules={[({ getFieldValue }) => ({
                      validator: (_, value) => {
                        const yamlList = getFieldValue('classes_yaml') || [];
                        const hasYaml = Array.isArray(yamlList) && yamlList.length > 0;
                        if (hasYaml) return Promise.resolve();
                        if (!value || parseInt(value, 10) <= 0) {
                          return Promise.reject(new Error('Please enter number of classes'));
                        }
                        return Promise.resolve();
                      }
                    })]}
                    extra="Must equal the number of classes provided above."
                  >
                    <Input type="number" min={1} max={1024} placeholder="e.g., 3" />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={uploading}
                icon={<CloudUploadOutlined />}
              >
                Upload Model
              </Button>
              <Button onClick={() => {
                logUserClick('ModelsModern', 'cancel_upload_form');
                logInfo('app.frontend.ui', 'Upload modal closed from form', 'modal_close', { component: 'ModelsModern', modal: 'upload_model' });
                setUploadModalVisible(false);
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Model Details Modal */}
      <Modal
        title="Model Details"
        open={viewModalVisible}
        onCancel={() => {
          logUserClick('ModelsModern', 'close_view_modal');
          logInfo('app.frontend.ui', 'View modal closed', 'modal_close', { component: 'ModelsModern', modal: 'view_model' });
          setViewModalVisible(false);
        }}
        footer={[
          <Button key="close" onClick={() => {
            logUserClick('ModelsModern', 'close_view_modal_button');
            logInfo('app.frontend.ui', 'View modal closed from button', 'modal_close', { component: 'ModelsModern', modal: 'view_model' });
            setViewModalVisible(false);
          }}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedModel && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                    {getModelThumbnail(selectedModel)}
                    <div>
                      <Title level={3} style={{ margin: 0 }}>
                        {selectedModel.name}
                      </Title>
                      <Tag color={getModelTypeInfo(selectedModel.type).color}>
                        {getModelTypeInfo(selectedModel.type).label}
                      </Tag>
                    </div>
                  </div>
                  
                  <Divider />
                  
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Text strong>Description:</Text>
                      <div>{selectedModel.description || 'No description'}</div>
                    </Col>
                    <Col span={12}>
                      <Text strong>File Size:</Text>
                      <div>{selectedModel.file_size ? `${(selectedModel.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}</div>
                    </Col>
                    <Col span={12}>
                      <Text strong>Created:</Text>
                      <div>{new Date(selectedModel.created_at).toLocaleString()}</div>
                    </Col>
                    <Col span={12}>
                      <Text strong>Status:</Text>
                      <div>
                        <Badge 
                          status={getModelStatus(selectedModel).status} 
                          text={getModelStatus(selectedModel).text}
                        />
                      </div>
                    </Col>
                  </Row>
                  
                  {selectedModel.accuracy && (
                    <>
                      <Divider />
                      <Text strong>Performance Metrics:</Text>
                      <Row gutter={[16, 16]} style={{ marginTop: '8px' }}>
                        <Col span={8}>
                          <Statistic title="mAP50" value={selectedModel.accuracy} suffix="%" />
                        </Col>
                        <Col span={8}>
                          <Statistic title="Precision" value={selectedModel.precision || 0} suffix="%" />
                        </Col>
                        <Col span={8}>
                          <Statistic title="Recall" value={selectedModel.recall || 0} suffix="%" />
                        </Col>
                      </Row>
                    </>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ModelsModern;