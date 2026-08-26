import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, message, Modal, Input, Spin, Empty, Tag, Tooltip, Table, Alert, Typography, Checkbox, Switch, Select } from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  RocketOutlined,
  FileTextOutlined,
  TrophyOutlined,
  SaveOutlined,
  SwapOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { mergeModelLabGuideState } from '../modellabGuideState';
import './ModelManagerView.css';

const { TextArea } = Input;
const { Text } = Typography;

const ModelManagerView = ({ projectId, trainingId, sessionName }) => {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState(null);
  const [editingNotes, setEditingNotes] = useState({ best: false, last: false });
  const [notes, setNotes] = useState({ best: '', last: '' });
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [deployingModel, setDeployingModel] = useState(null);
  const [deployForm, setDeployForm] = useState({ name: '', description: '' });

  // ONNX conversion state
  const [onnxStatus, setOnnxStatus] = useState('pending'); // pending | converting | validating | done | failed
  const [onnxValidation, setOnnxValidation] = useState(null);
  const [onnxError, setOnnxError] = useState(null);
  const onnxPollRef = useRef(null);

  // Production ONNX options — pre-filled from this project's last-used settings,
  // editable here before export. Retraining Mode has no picker of its own; it
  // reuses whatever was last chosen for this project.
  const ONNX_BATCH_CHOICES = [1, 2, 4, 8, 16, 32, 64];
  const ONNX_OPSET_CHOICES = [12, 13, 14, 15, 16, 17, 18];
  const [onnxOptionsOpen, setOnnxOptionsOpen] = useState(false);
  const [onnxOptions, setOnnxOptions] = useState({
    batch_sizes: [1, 8, 16, 32],
    dynamic: true,
    half: true,
    opset: 17,
    simplify: true,
  });

  useEffect(() => {
    loadModels();
  }, [projectId, trainingId]);

  const pollOnnxStatus = () => {
    clearInterval(onnxPollRef.current);
    onnxPollRef.current = setInterval(async () => {
      try {
        const sr = await fetch(`/api/v1/onnx/training/${trainingId}/status`);
        if (sr.ok) {
          const d = await sr.json();
          setOnnxStatus(d.status);
          setOnnxValidation(d.validation || null);
          setOnnxError(d.error || null);
          if (d.status === 'done') {
            clearInterval(onnxPollRef.current);
            message.success('Production ONNX export passed all validation checks.');
          } else if (d.status === 'failed') {
            clearInterval(onnxPollRef.current);
            message.error('Production ONNX export or validation failed.');
          }
        }
      } catch { clearInterval(onnxPollRef.current); }
    }, 3000);
  };

  // Poll ONNX status on mount / when trainingId changes
  useEffect(() => {
    if (!trainingId) return;
    const checkStatus = async () => {
      try {
        const r = await fetch(`/api/v1/onnx/training/${trainingId}/status`);
        if (r.ok) {
          const d = await r.json();
          setOnnxStatus(d.status);
          setOnnxValidation(d.validation || null);
          setOnnxError(d.error || null);
          if (d.project_defaults) {
            setOnnxOptions(d.project_defaults);
          }
          if (d.status === 'converting' || d.status === 'validating') {
            pollOnnxStatus();
          }
        }
      } catch { /* non-blocking */ }
    };
    checkStatus();
    return () => clearInterval(onnxPollRef.current);
  }, [trainingId]);

  const handleConvertOnnx = async () => {
    setOnnxStatus('converting');
    setOnnxValidation(null);
    setOnnxError(null);
    try {
      const r = await fetch(`/api/v1/onnx/training/${trainingId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onnxOptions),
      });
      if (!r.ok) throw new Error('Failed');
      pollOnnxStatus();
    } catch {
      setOnnxStatus('failed');
      message.error('Could not start Production ONNX export.');
    }
  };

  const toggleBatchSize = (size, checked) => {
    setOnnxOptions((prev) => {
      const next = checked
        ? [...prev.batch_sizes, size]
        : prev.batch_sizes.filter((b) => b !== size);
      return { ...prev, batch_sizes: next.sort((a, b) => a - b) };
    });
  };

  const handleDownloadOnnx = () => {
    window.open(`/api/v1/onnx/training/${trainingId}/download`, '_blank');
  };

  useEffect(() => {
    mergeModelLabGuideState({
      modelManagerHasBestModel: !!models?.best_model,
      modelManagerHasLastModel: !!models?.last_model,
      modelManagerAdditionalFilesCount: models?.additional_files?.length || 0,
    });
  }, [models]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/v1/projects/${projectId}/training/${trainingId}/models`
      );
      setModels(response.data);

      // Load notes
      setNotes({
        best: response.data.best_model?.notes || '',
        last: response.data.last_model?.notes || ''
      });
    } catch (error) {
      message.error('Failed to load training models');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileName) => {
    try {
      const response = await axios.get(
        `/api/v1/projects/${projectId}/training/${trainingId}/download/${fileName}`,
        { responseType: 'blob' }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success(`Downloaded ${fileName}`);
    } catch (error) {
      message.error(`Failed to download ${fileName}`);
      console.error(error);
    }
  };

  const handleSaveNotes = async (modelType) => {
    try {
      await axios.patch(
        `/api/v1/projects/${projectId}/training/${trainingId}/models/${modelType}/notes`,
        { notes: notes[modelType] }
      );

      setEditingNotes({ ...editingNotes, [modelType]: false });
      message.success('Notes saved successfully');
    } catch (error) {
      message.error('Failed to save notes');
      console.error(error);
    }
  };

  const handleDeployClick = (modelType) => {
    setDeployingModel(modelType);
    setDeployForm({
      name: `${sessionName}_${modelType}`,
      description: notes[modelType] || `Trained model from ${sessionName}`
    });
    setDeployModalVisible(true);
  };

  const handleDeploy = async () => {
    try {
      await axios.post(
        `/api/v1/projects/${projectId}/training/${trainingId}/deploy`,
        {
          model_type: deployingModel,
          model_name: deployForm.name,
          description: deployForm.description
        }
      );

      message.success('Model deployed to project successfully!');
      setDeployModalVisible(false);
      setDeployingModel(null);
    } catch (error) {
      message.error('Failed to deploy model');
      console.error(error);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.1) {
      // Show in KB for small files
      const kb = bytes / 1024;
      return `${kb.toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderModelCard = (model, modelType, icon, title, color) => {
    if (!model) return null;

    const isEditing = editingNotes[modelType];
    const modelNotes = notes[modelType];

    // Card styles for each model type
    const cardStyle = modelType === 'best'
      ? {
        background: 'linear-gradient(135deg, #fff2e8 20%, #f6ffed 80%)',
        borderLeft: `4px solid #FFD700`
      }
      : {
        background: 'linear-gradient(135deg, #f9f0ff 20%, #f6ffed 80%)',
        borderLeft: `4px solid #722ed1`
      };

    return (
      <Card
        className="model-card"
        style={cardStyle}
      >
        <div className="model-card-header">
          <div className="model-card-title">
            {icon}
            <span>{title}</span>
          </div>
          <Tag color={modelType === 'best' ? 'gold' : 'cyan'}>{modelType.toUpperCase()}</Tag>
        </div>

        <div className="model-card-info">
          <div className="info-row">
            <span className="info-label">Size:</span>
            <span className="info-value">{formatFileSize(model.size)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Created:</span>
            <span className="info-value">{formatDate(model.created_at)}</span>
          </div>
        </div>

        <div className="model-card-notes">
          <div className="notes-header">
            <FileTextOutlined /> Notes
            {!isEditing && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setEditingNotes({ ...editingNotes, [modelType]: true })}
              />
            )}
          </div>
          {isEditing ? (
            <div className="notes-edit">
              <TextArea
                value={modelNotes}
                onChange={(e) => setNotes({ ...notes, [modelType]: e.target.value })}
                placeholder="Add notes about this model..."
                rows={3}
                autoFocus
              />
              <div className="notes-actions">
                <Button
                  size="small"
                  onClick={() => {
                    setEditingNotes({ ...editingNotes, [modelType]: false });
                    setNotes({ ...notes, [modelType]: model.notes || '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={() => handleSaveNotes(modelType)}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="notes-display">
              {modelNotes || <span className="notes-placeholder">Click edit to add notes...</span>}
            </div>
          )}
        </div>

        <div className="model-card-actions">
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(`${modelType}.pt`)}
          >
            Download
          </Button>
          <Button
            type="primary"
            icon={<RocketOutlined />}
            onClick={() => handleDeployClick(modelType)}
          >
            Add to Project
          </Button>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="model-manager-loading">
        <Spin size="large" />
        <p>Loading training models...</p>
      </div>
    );
  }

  if (!models || (!models.best_model && !models.last_model)) {
    return (
      <Empty
        description="No trained models found"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="model-manager-tab">
      <div className="models-grid">
        {renderModelCard(
          models.best_model,
          'best',
          <TrophyOutlined style={{ color: '#faad14' }} />,
          'Best Model (best.pt)',
          '#faad14'
        )}
        {renderModelCard(
          models.last_model,
          'last',
          <SaveOutlined style={{ color: '#1890ff' }} />,
          'Last Checkpoint (last.pt)',
          '#1890ff'
        )}
      </div>

      <Card
        className="onnx-conversion-card"
        style={{ marginTop: 16 }}
        title={<span><SwapOutlined style={{ marginRight: 8 }} />Production ONNX</span>}
        extra={
          <Tag color={
            onnxStatus === 'done' ? 'success' :
            (onnxStatus === 'converting' || onnxStatus === 'validating') ? 'processing' :
            onnxStatus === 'failed' ? 'error' : 'default'
          }>
            {onnxStatus === 'done' ? '✅ Export passed' :
             onnxStatus === 'converting' ? 'Exporting...' :
             onnxStatus === 'validating' ? 'Validating (CUDA)...' :
             onnxStatus === 'failed' ? 'Failed' : 'Pending'}
          </Tag>
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <Tag>Image size: {onnxValidation?.imgsz || '—'}×{onnxValidation?.imgsz || '—'} (from training)</Tag>
          <Tag color="blue">Precision: {onnxOptions.half ? 'FP16' : 'FP32'}</Tag>
          <Tag color="blue">Dynamic batch: {onnxOptions.dynamic ? 'enabled' : 'disabled'}</Tag>
          <Tag color="blue">Opset: {onnxOptions.opset}</Tag>
          <Tag color="blue">{onnxOptions.simplify ? 'Simplified' : 'Not simplified'}</Tag>
          <Tag color="blue">Batches: {onnxOptions.batch_sizes.join(', ')}</Tag>
          <Tag color="purple">Task: segmentation</Tag>
          <Tag color="purple">RGB · NCHW · scale 1/255</Tag>
        </div>

        <Button
          type="link"
          icon={<SettingOutlined />}
          onClick={() => setOnnxOptionsOpen((v) => !v)}
          disabled={onnxStatus === 'converting' || onnxStatus === 'validating'}
          style={{ padding: 0, marginBottom: onnxOptionsOpen ? 12 : 14 }}
        >
          {onnxOptionsOpen ? 'Hide export options' : 'Export options'}
        </Button>

        {onnxOptionsOpen && (
          <div style={{
            border: '1px solid #f0f0f0', borderRadius: 8, padding: 14, marginBottom: 14,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Validated batch sizes</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ONNX_BATCH_CHOICES.map((size) => (
                  <Checkbox
                    key={size}
                    checked={onnxOptions.batch_sizes.includes(size)}
                    disabled={!onnxOptions.dynamic && size !== 1}
                    onChange={(e) => toggleBatchSize(size, e.target.checked)}
                  >
                    {size}
                  </Checkbox>
                ))}
              </div>
              {!onnxOptions.dynamic && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Dynamic batch is off — a static export only supports batch 1.
                </Text>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={onnxOptions.dynamic}
                onChange={(checked) => setOnnxOptions((prev) => ({
                  ...prev,
                  dynamic: checked,
                  batch_sizes: checked ? prev.batch_sizes : [1],
                }))}
              />
              <Text>Dynamic batch</Text>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={onnxOptions.half}
                onChange={(checked) => setOnnxOptions((prev) => ({ ...prev, half: checked }))}
              />
              <Text>FP16 precision</Text>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={onnxOptions.simplify}
                onChange={(checked) => setOnnxOptions((prev) => ({ ...prev, simplify: checked }))}
              />
              <Text>Simplify (onnxslim)</Text>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text>ONNX opset</Text>
              <Select
                size="small"
                style={{ width: 90 }}
                value={onnxOptions.opset}
                onChange={(v) => setOnnxOptions((prev) => ({ ...prev, opset: v }))}
                options={ONNX_OPSET_CHOICES.map((o) => ({ value: o, label: o }))}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tooltip title={onnxStatus === 'done' ? 'Already exported and validated' : 'Export best.pt to a validated Production ONNX file'}>
            <Button
              icon={<SwapOutlined />}
              onClick={handleConvertOnnx}
              disabled={onnxStatus === 'converting' || onnxStatus === 'validating' || onnxStatus === 'done'}
              loading={onnxStatus === 'converting' || onnxStatus === 'validating'}
            >
              {onnxStatus === 'done' ? 'Exported' : 'Export Production ONNX'}
            </Button>
          </Tooltip>
          <Button
            type={onnxStatus === 'done' ? 'primary' : 'default'}
            icon={<DownloadOutlined />}
            onClick={handleDownloadOnnx}
            disabled={!(onnxStatus === 'done' || onnxStatus === 'failed')}
          >
            Download ONNX
          </Button>
        </div>

        {onnxError && !onnxValidation && (
          <Alert
            style={{ marginTop: 14 }}
            type="error"
            showIcon
            message="Export failed"
            description={onnxError}
          />
        )}

        {onnxValidation && (
          <div style={{ marginTop: 16 }}>
            {onnxValidation.errors && onnxValidation.errors.length > 0 && (
              <Alert
                style={{ marginBottom: 12 }}
                type={onnxValidation.passed ? 'warning' : 'error'}
                showIcon
                message={onnxValidation.passed ? 'Completed with warnings' : 'Validation failed'}
                description={onnxValidation.errors.join(' | ')}
              />
            )}
            <Table
              size="small"
              pagination={false}
              rowKey="batch"
              dataSource={Object.entries(onnxValidation.batches || {}).map(([batch, r]) => ({ batch, ...r }))}
              columns={[
                { title: 'Batch', dataIndex: 'batch', key: 'batch' },
                {
                  title: 'Status', dataIndex: 'status', key: 'status',
                  render: (s) => <Tag color={s === 'passed' ? 'success' : 'error'}>{s === 'passed' ? 'Passed' : 'Failed'}</Tag>,
                },
                { title: 'ONNX det.', dataIndex: 'onnx_detections', key: 'onnx_detections' },
                { title: 'PT det.', dataIndex: 'pt_detections', key: 'pt_detections' },
                { title: 'Masks', dataIndex: 'has_masks', key: 'has_masks', render: (v) => v ? 'Yes' : 'No' },
                { title: 'Time / img (ms)', dataIndex: 'inference_time_ms', key: 'inference_time_ms' },
                { title: 'GPU mem (MB)', dataIndex: 'gpu_memory_mb', key: 'gpu_memory_mb' },
              ]}
            />
            {onnxValidation.checksum_sha256 && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary">SHA-256: </Text>
                <Text code copyable style={{ fontSize: 12 }}>{onnxValidation.checksum_sha256}</Text>
              </div>
            )}
          </div>
        )}
      </Card>

      {models.additional_files && models.additional_files.length > 0 && (
        <Card className="additional-files-card" title="📄 Additional Files">
          <div className="additional-files-list">
            {models.additional_files.map((file) => (
              <div key={file.name} className="file-item">
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(file.name)}
                >
                  Download
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        title="Deploy Model to Project"
        open={deployModalVisible}
        onOk={handleDeploy}
        onCancel={() => setDeployModalVisible(false)}
        okText="Deploy"
        cancelText="Cancel"
      >
        <div className="deploy-modal-content">
          <p>
            This will add the <strong>{deployingModel}.pt</strong> model to your project's models page.
          </p>
          <div className="form-field">
            <label>Model Name:</label>
            <Input
              value={deployForm.name}
              onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })}
              placeholder="Enter model name"
            />
          </div>
          <div className="form-field">
            <label>Description:</label>
            <TextArea
              value={deployForm.description}
              onChange={(e) => setDeployForm({ ...deployForm, description: e.target.value })}
              placeholder="Enter model description"
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ModelManagerView;
