import React, { useEffect, useState } from 'react';
import {
  Typography,
  Alert,
  Button,
  Card,
  Upload,
  message,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Tag,
  Row,
  Col,
  Statistic,
  Progress,
  Empty,
  Tooltip,
  Badge,
  Dropdown,
  Menu,
  Divider,
  Switch
} from 'antd';
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
  CloudUploadOutlined,
  SettingOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { logInfo, logError } from '../../../utils/professional_logger';
import { buildClassesCSV, copyTextToClipboard } from '../../../utils/modelDetailsHelpers';
import { modelsAPI, projectsAPI, handleAPIError } from '../../../services/api';
import YAML from 'yaml';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;
const { Search } = Input;

// Project-scoped Models section, mirroring ModelsModern style/functionality
const ModelsSection = ({ projectId, project }) => {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);

  // Align status mapping with Global Models UI: trust backend flags
  const getModelStatus = (model) => {
    if (model?.is_training) {
      return { status: 'processing', text: 'Trained' };
    }
    if (model?.is_ready) {
      return { status: 'success', text: 'Ready' };
    }
    return { status: 'default', text: 'Pending' };
  };
  const [loading, setLoading] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState(['object_detection', 'instance_segmentation']);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [includeGlobal, setIncludeGlobal] = useState(false);
  const [form] = Form.useForm();
  const [classesExpanded, setClassesExpanded] = useState(false);
  const [enrichingDetails, setEnrichingDetails] = useState(false);

  useEffect(() => {
    logInfo('app.frontend.ui', 'models_section_initialized', 'ModelsSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ModelsSection',
      projectId
    });
  }, [projectId]);

  const loadModels = React.useCallback(async (includeGlobalParam = false) => {
    setLoading(true);
    logInfo('app.frontend.interactions', 'Loading project AI models', 'load_models_project', { projectId, includeGlobal: includeGlobalParam });
    try {
      const modelsData = await projectsAPI.getProjectModels(projectId, includeGlobalParam);
      setModels(modelsData || []);
      logInfo('app.frontend.interactions', 'Project AI models loaded', 'load_models_project', { projectId, modelCount: modelsData?.length || 0 });
      try {
        const typesData = await modelsAPI.getSupportedTypes();
        if (Array.isArray(typesData)) {
          // Filter to two primary types for import; keep full list if backend provides more
          const allowed = ['object_detection', 'instance_segmentation'];
          const filtered = typesData.filter(t => allowed.includes(t));
          setSupportedTypes(filtered.length > 0 ? filtered : allowed);
        }
      } catch (typesError) {
        logError('app.frontend.validation', 'Could not load supported types (project models)', typesError, { projectId });
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.validation', 'Failed to load project AI models', error, { projectId, errorInfo });
      message.error(`Failed to load models: ${errorInfo.message}`);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // Load models when projectId or includeGlobal changes
    if (!projectId) return;
    loadModels(includeGlobal);
  }, [projectId, includeGlobal, loadModels]);

  useEffect(() => {
    // Filter models based on search term and type
    let filtered = models;
    if (searchTerm) {
      filtered = filtered.filter(model =>
        (model.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (model.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterType !== 'all') {
      if (filterType === 'custom_local') {
        // Only project-scoped custom models
        filtered = filtered.filter(model => {
          const scope = String(model?.scope || '').toLowerCase();
          const isProjectScoped = String(model?.project_id || '') === String(projectId);
          const isPretrained = typeof model?.is_pretrained !== 'undefined' ? Boolean(model?.is_pretrained) : null;
          const isCustomLocal = Boolean(model?.is_custom_local) || ((scope === 'project' || isProjectScoped) && (isPretrained === false || typeof isPretrained === 'undefined'));
          return isCustomLocal;
        });
      } else if (filterType === 'trained') {
        // Show models currently marked as Trained (in-progress per requested label change)
        filtered = filtered.filter(model => getModelStatus(model).text === 'Trained');
      } else {
        filtered = filtered.filter(model => model.type === filterType);
      }
    }
    // Exclude global custom models from project view
    filtered = filtered.filter(m => {
      const src = String(m?.source || m?.origin || '').toLowerCase();
      const scope = String(m?.scope || '').toLowerCase();
      const isPretrained = typeof m?.is_pretrained !== 'undefined' ? Boolean(m?.is_pretrained) : null;
      const isCustomGlobal = Boolean(m?.is_custom_global) || ((Boolean(m?.is_custom) || src === 'custom') && scope === 'global' && (isPretrained === false || typeof isPretrained === 'undefined'));
      return !isCustomGlobal;
    });
    setFilteredModels(filtered);
  }, [models, searchTerm, filterType]);


  // Helpers similar to ModelsModern
  const getModelTypeInfo = (type) => {
    const typeInfo = {
      'object_detection': { color: 'blue', label: 'Object Detection', icon: <BarChartOutlined /> },
      'instance_segmentation': { color: 'purple', label: 'Segmentation', icon: <ExperimentOutlined /> },
      'custom': { color: 'cyan', label: 'Custom Model', icon: <SettingOutlined /> }
    };
    return typeInfo[type] || { color: 'default', label: type, icon: <RobotOutlined /> };
  };

  // Note: getModelStatus is defined above with robust Ready/Training/Pending derivation.

  const getModelThumbnail = (model) => {
    const typeInfo = getModelTypeInfo(model.type);
    return (
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${typeInfo.color === 'blue' ? '#1890ff, #40a9ff' :
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

  // Upload handler (project-scoped)
  const handleUpload = async (values) => {
    setUploading(true);
    logInfo('app.frontend.ui', 'ModelsSection upload started', 'upload_start', { projectId });
    try {
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

      // Use modelsAPI.importModel with projectId to scope upload
      await modelsAPI.importModel(formData, projectId);
      message.success('Model uploaded successfully!');
      setUploadModalVisible(false);
      form.resetFields();
      loadModels(includeGlobal);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.validation', 'Failed to upload project AI model', error, { projectId, errorInfo });
      message.error(`Failed to upload model: ${errorInfo.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (modelId) => {
    try {
      await modelsAPI.deleteModel(modelId);
      message.success('Model deleted successfully');
      loadModels(includeGlobal);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to delete model: ${errorInfo.message}`);
    }
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
            openModelDetails(model);
          }}
        >
          View Details
        </Menu.Item>
        {(() => {
          const src = String(model?.source || model?.origin || '').toLowerCase();
          const scope = String(model?.scope || '').toLowerCase();
          const isProjectScoped = String(model?.project_id || '') === String(projectId);
          const isPretrained = typeof model?.is_pretrained !== 'undefined' ? Boolean(model?.is_pretrained) : null;
          const isCustom = Boolean(model?.is_custom) || src === 'custom' || scope === 'project' || (isProjectScoped && isPretrained === false);
          return isCustom ? (
            <Menu.Item
              key="download"
              icon={<DownloadOutlined />}
              onClick={() => {
                const hide = message.loading('Preparing download...', 0);
                modelsAPI.downloadModel(model.manager_id || model.id)
                  .then(({ blob, filename }) => {
                    try {
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
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
                    } finally {
                      hide();
                    }
                  })
                  .catch((error) => {
                    hide();
                    handleAPIError(error, 'Download Model');
                  });
              }}
            >
              Download Model
            </Menu.Item>
          ) : null;
        })()}
        {(() => {
          const src = String(model?.source || model?.origin || '').toLowerCase();
          const scope = String(model?.scope || '').toLowerCase();
          const isProjectScoped = String(model?.project_id || '') === String(projectId);
          const isPretrained = typeof model?.is_pretrained !== 'undefined' ? Boolean(model?.is_pretrained) : null;
          const isCustom = Boolean(model?.is_custom) || src === 'custom' || scope === 'project' || (isProjectScoped && isPretrained === false);
          return isCustom ? (
            <>
              <Menu.Divider />
              <Menu.Item
                key="delete"
                icon={<DeleteOutlined />}
                danger
                onClick={() => {
                  Modal.confirm({
                    title: 'Delete Model',
                    content: `Are you sure you want to delete "${model.name}"? This action cannot be undone.`,
                    okText: 'Delete',
                    okType: 'danger',
                    cancelText: 'Cancel',
                    onOk: () => handleDelete(model.manager_id || model.id),
                  });
                }}
              >
                Delete Model
              </Menu.Item>
            </>
          ) : null;
        })()}
      </Menu>
    );

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={model.id}>
        <Card hoverable style={{ height: '100%', borderRadius: '8px', border: '1px solid #f0f0f0' }} bodyStyle={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {getModelThumbnail(model)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Tag color={typeInfo.color} style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 500, border: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex' }}>{typeInfo.icon}</span>
                  {typeInfo.label}
                </span>
              </Tag>
              {(() => {
                const src = String(model?.source || model?.origin || '').toLowerCase();
                const scope = String(model?.scope || '').toLowerCase();
                const isProjectScoped = String(model?.project_id || '') === String(projectId);
                const isPretrained = typeof model?.is_pretrained !== 'undefined' ? Boolean(model?.is_pretrained) : null;
                const isLocal = Boolean(model?.is_custom_local) || ((scope === 'project' || isProjectScoped) && (isPretrained === false || typeof isPretrained === 'undefined'));
                const isGlobal = Boolean(model?.is_custom_global) || ((Boolean(model?.is_custom) || src === 'custom') && scope === 'global' && (isPretrained === false || typeof isPretrained === 'undefined'));
                if (isLocal) {
                  return (
                    <Tag color="cyan" style={{ marginBottom: '8px', marginLeft: '8px', fontSize: '11px', fontWeight: 500, border: 'none' }}>
                      Custom (Local)
                    </Tag>
                  );
                }
                return null; // Do not show "Custom (Global)" tag in project view
              })()}
              <Title level={4} style={{ margin: 0, marginBottom: '4px', fontSize: '16px', fontWeight: 600, lineHeight: '20px' }} ellipsis={{ tooltip: model.name }}>
                {model.name}
              </Title>
              <Text type="secondary" style={{ fontSize: '13px', lineHeight: '18px', display: 'block', marginBottom: '12px' }} ellipsis={{ tooltip: model.description }}>
                {model.description || 'No description provided'}
              </Text>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '13px', color: '#666' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#999' }}>
                <Badge status={statusInfo.status} text={statusInfo.text} style={{ fontSize: '12px' }} />
                <span>
                  {model.created_at ? new Date(model.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
            <Dropdown overlay={moreMenu} trigger={['click']} placement="bottomRight">
              <Button type="text" icon={<MoreOutlined />} style={{ color: '#999', border: 'none', boxShadow: 'none' }} />
            </Dropdown>
          </div>
          {model.is_training && (
            <div style={{ marginTop: '12px' }}>
              <Text style={{ fontSize: '12px', color: '#666' }}>Training Progress</Text>
              <Progress percent={model.training_progress || 0} size="small" status="active" style={{ marginTop: '4px' }} />
            </div>
          )}
        </Card>
      </Col>
    );
  };

  const openModelDetails = async (model) => {
    try {
      setViewModalVisible(true);
      setSelectedModel(model);
      setEnrichingDetails(true);
      const id = model.manager_id || model.id;
      const response = await modelsAPI.getModel(id);
      const data = response; // modelsAPI.getModel returns response.data
      setSelectedModel({ ...model, ...data });
    } catch (error) {
      handleAPIError(error, 'Failed to load model details');
    } finally {
      setEnrichingDetails(false);
    }
  };

  // Duplicate name validation (per-project)
  const isNameDuplicateInProject = (name) => {
    if (!name) return false;
    const v = String(name).trim().toLowerCase();
    // Prefer explicit project_id if provided by backend; otherwise, when includeGlobal=false, models are project-scoped
    const projectModels = includeGlobal ? (models || []).filter(m => String(m.project_id || '') === String(projectId)) : (models || []);
    return projectModels.some(m => (m?.is_custom) && (m?.name || '').toLowerCase() === v);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
            <span style={{ marginRight: '8px' }}>🤖</span>
            <span style={{ background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              AI Models
            </span>
            {project?.name && <span style={{ marginLeft: '12px', fontSize: '20px', color: '#999', fontWeight: 400 }}>{project.name}</span>}
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Manage models for auto-labeling in this project
          </Text>
        </div>
        <Space size="middle">
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadModels(includeGlobal)}
            style={{ borderRadius: '6px', height: '36px' }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => setUploadModalVisible(true)}
            style={{ borderRadius: '6px', height: '36px', fontSize: '14px', background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', border: 'none' }}
          >
            Upload Model
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Total Models" value={filteredModels.length} prefix={<RobotOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Ready" value={filteredModels.filter(m => getModelStatus(m).text === 'Ready').length} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Trained" value={filteredModels.filter(m => getModelStatus(m).text === 'Trained').length} prefix={<ExperimentOutlined style={{ color: '#faad14' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Row gutter={[8, 8]}>
              <Col span={24}>
                <Statistic title="Custom (Local)" value={filteredModels.filter(m => {
                  const scope = String(m?.scope || '').toLowerCase();
                  const isProjectScoped = String(m?.project_id || '') === String(projectId);
                  const isPretrained = typeof m?.is_pretrained !== 'undefined' ? Boolean(m?.is_pretrained) : null;
                  const isCustomLocal = Boolean(m?.is_custom_local) || ((scope === 'project' || isProjectScoped) && (isPretrained === false || typeof isPretrained === 'undefined'));
                  return isCustomLocal;
                }).length} prefix={<SettingOutlined style={{ color: '#13c2c2' }} />} />
              </Col>
              {/* Removed Custom (Global) statistic per requirement */}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Search, Filter and Include Global */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Search
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={filterType}
            onChange={(value) => setFilterType(value)}
            style={{ width: 220 }}
          >
            <Option value="all">All Types</Option>
            <Option value="object_detection">Object Detection</Option>
            <Option value="instance_segmentation">Segmentation</Option>
            <Option value="custom_local">Custom (Local)</Option>
            <Option value="trained">Trained</Option>
          </Select>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={includeGlobal} onChange={(v) => setIncludeGlobal(v)} />
            <Text type="secondary">Include Global Models</Text>
          </div>
          <Text type="secondary">{filteredModels.length} of {models.length} models</Text>
        </div>
      </Card>

      {/* Models Grid */}
      {filteredModels.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchTerm || filterType !== 'all'
                ? 'No models match your filters'
                : 'No models available for this project'
            }
          >
            {!searchTerm && filterType === 'all' && (
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadModalVisible(true)}>
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
        title="Upload Model to Project"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
          onFinishFailed={(errorInfo) => {
            logError('app.frontend.validation', 'Model upload form validation failed (project)', null, { projectId, errorInfo });
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
                  if (isNameDuplicateInProject(v)) {
                    return Promise.reject(new Error('Model name already exists in this project.'));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <Input placeholder="Enter model name" />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {() => {
              const v = (form.getFieldValue('name') || '').trim();
              if (!v) return null;
              if (!isNameDuplicateInProject(v)) return null;
              const base = v.replace(/\s+/g, '_');
              const suggestions = [`${base}_new`, `${base}_alt`, `${base}_v2`];
              return (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                  message={<span>Model name "{v}" already exists in this project. Try: {suggestions.join(', ')}</span>} />
              );
            }}
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Enter model description (optional)" />
          </Form.Item>

          <Form.Item name="type" label="Model Type" rules={[{ required: true, message: 'Please select model type' }]}>
            <Select placeholder="Select model type">
              {(() => {
                const allowed = ['object_detection', 'instance_segmentation'];
                const typesToShow = (supportedTypes || []).filter(t => allowed.includes(t));
                const list = typesToShow.length > 0 ? typesToShow : allowed;
                return list.map(type => (
                  <Option key={type} value={type}>{getModelTypeInfo(type).label}</Option>
                ));
              })()}
            </Select>
          </Form.Item>

          <Form.Item
            name="file"
            label="Model File"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) return e;
              return e && e.fileList ? e.fileList.slice(-1) : [];
            }}
            rules={[{ required: true, message: 'Please upload model file' }]}
          >
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={(file) => {
                const validTypes = ['.pt', '.onnx', '.engine'];
                const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                if (!validTypes.includes(fileExtension)) {
                  message.error('Invalid file type. Please upload .pt, .onnx, or .engine files only.');
                  return false;
                }
                const maxSize = 100 * 1024 * 1024; // 100MB
                if (file.size > maxSize) {
                  message.error('File too large. Maximum size is 100MB.');
                  return false;
                }
                return false;
              }}
              accept=".pt,.onnx,.engine"
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Click or drag model file to upload</p>
              <p className="ant-upload-hint">Support .pt, .onnx, .engine formats</p>
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
              if (!isPt) return null;
              return (
                <>
                  <Alert type="info" showIcon style={{ marginBottom: 12 }} message={<span>For .pt models, classes are auto-detected. Please provide the training input image size used during training.</span>} />
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="training_input_width" label="Training Input Width" rules={[{ required: true, message: 'Please enter width (e.g., 640)' }]}>
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="training_input_height" label="Training Input Height" rules={[{ required: true, message: 'Please enter height (e.g., 640)' }]}>
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
                  <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={<span>For .onnx models, please provide training input size, classes (comma-separated), and number of classes (nc).</span>} />
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
                    <Upload name="classes_yaml" multiple={false} beforeUpload={() => false} accept=".yaml,.yml"
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
                          form.setFieldsValue({ onnx_classes_csv: names.join(','), onnx_nc: String(names.length) });
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
                      <Form.Item name="training_input_width" label="Training Input Width" rules={[{ required: true, message: 'Please enter width (e.g., 640)' }]}>
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="training_input_height" label="Training Input Height" rules={[{ required: true, message: 'Please enter height (e.g., 640)' }]}>
                        <Input type="number" min={16} max={8192} placeholder="e.g., 640" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="onnx_classes_csv"
                    label={<span>Classes (comma-separated)<Tooltip title="Order defines class IDs (0-based). Keep the same order as used during training/yaml."><QuestionCircleOutlined style={{ marginLeft: 6 }} /></Tooltip></span>}
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
              <Button type="primary" htmlType="submit" loading={uploading} icon={<CloudUploadOutlined />}>Upload Model</Button>
              <Button onClick={() => setUploadModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Model Details Modal */}
      <Modal
        title="Model Details"
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setClassesExpanded(false); }}
        footer={[<Button key="close" onClick={() => { setViewModalVisible(false); setClassesExpanded(false); }}>Close</Button>]}
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
                      <Title level={3} style={{ margin: 0 }}>{selectedModel.name}</Title>
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
                      <div>{selectedModel.created_at ? new Date(selectedModel.created_at).toLocaleString() : ''}</div>
                    </Col>
                    <Col span={12}>
                      <Text strong>Status:</Text>
                      <div>
                        <Badge status={getModelStatus(selectedModel).status} text={getModelStatus(selectedModel).text} />
                      </div>
                    </Col>
                  </Row>
                  <Divider />
                  <Text strong>Model Metadata:</Text>
                  <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                    <Col span={12}>
                      <Text type="secondary">Format</Text>
                      <div>{selectedModel.format || 'Unknown'}</div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Number of Classes (nc)</Text>
                      <div>{(selectedModel.nc ?? selectedModel.num_classes ?? (Array.isArray(selectedModel.classes) ? selectedModel.classes.length : 'Unknown'))}</div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Training Input Size</Text>
                      <div>
                        {(() => {
                          const tis = selectedModel.training_input_size ?? selectedModel.input_size;
                          if (!tis) return 'Unknown';
                          if (Array.isArray(tis)) {
                            return tis.length === 2 ? `${tis[0]} x ${tis[1]}` : tis.join(', ');
                          }
                          if (typeof tis === 'object') {
                            const w = tis.width || tis.w || tis[0];
                            const h = tis.height || tis.h || tis[1];
                            return (w && h) ? `${w} x ${h}` : JSON.stringify(tis);
                          }
                          return String(tis);
                        })()}
                      </div>
                    </Col>
                  </Row>
                  {selectedModel.accuracy && (
                    <>
                      <Divider />
                      <Text strong>Performance Metrics:</Text>
                      <Row gutter={[16, 16]} style={{ marginTop: '8px' }}>
                        <Col span={8}><Statistic title="mAP50" value={selectedModel.accuracy} suffix="%" /></Col>
                        <Col span={8}><Statistic title="Precision" value={selectedModel.precision || 0} suffix="%" /></Col>
                        <Col span={8}><Statistic title="Recall" value={selectedModel.recall || 0} suffix="%" /></Col>
                      </Row>
                    </>
                  )}
                  <Divider />
                  <Text strong>Classes:</Text>
                  <div style={{ marginTop: 8 }}>
                    {(() => {
                      const classes = Array.isArray(selectedModel.classes) ? selectedModel.classes : [];
                      const count = classes.length;
                      const displayList = classesExpanded ? classes : classes.slice(0, 20);
                      return (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text type="secondary">Total: {count}</Text>
                            <Space>
                              <Button size="small" onClick={() => {
                                const csv = buildClassesCSV(classes);
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${(selectedModel.name || 'model')}_classes.csv`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                                message.success('Classes CSV downloaded');
                              }}>Download CSV</Button>
                              <Button size="small" onClick={() => {
                                copyTextToClipboard(classes.join(', '));
                                message.success('Classes copied to clipboard');
                              }}>Copy</Button>
                              {count > 20 && (
                                <Button size="small" type="link" onClick={() => setClassesExpanded(!classesExpanded)}>
                                  {classesExpanded ? 'Show less' : 'Show all'}
                                </Button>
                              )}
                            </Space>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: classesExpanded ? 260 : 120, overflowY: 'auto', paddingRight: 4 }}>
                            {displayList.map((name, idx) => (
                              <Tooltip key={`${name}-${idx}`} title={name}>
                                <Tag>
                                  <span style={{ opacity: 0.7, marginRight: 6 }}>{idx}</span>
                                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{name}</span>
                                </Tag>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ModelsSection;