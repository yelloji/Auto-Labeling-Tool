import React, { useState, useEffect } from 'react';
import { Card, Button, message, Modal, Input, Spin, Empty, Tag, Tooltip } from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  RocketOutlined,
  FileTextOutlined,
  TrophyOutlined,
  SaveOutlined
} from '@ant-design/icons';
import axios from 'axios';
import './ModelManagerView.css';

const { TextArea } = Input;

const ModelManagerView = ({ projectId, trainingId, sessionName }) => {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState(null);
  const [editingNotes, setEditingNotes] = useState({ best: false, last: false });
  const [notes, setNotes] = useState({ best: '', last: '' });
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [deployingModel, setDeployingModel] = useState(null);
  const [deployForm, setDeployForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadModels();
  }, [projectId, trainingId]);

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
