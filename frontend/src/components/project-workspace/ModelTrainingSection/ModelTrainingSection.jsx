import React, { useEffect } from 'react';
import { Typography, Alert, Button, Space } from 'antd';
import { ThunderboltOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { logInfo, logUserClick } from '../../../utils/professional_logger';

const { Title, Paragraph } = Typography;

const ModelTrainingSection = ({ projectId, project, navigate }) => {
  useEffect(() => {
    logInfo('app.frontend.ui', 'model_training_section_initialized', 'ModelTrainingSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ModelTrainingSection',
      projectId
    });
  }, [projectId]);

  const handleGoToModels = () => {
    logUserClick('ModelTrainingSection', 'go_to_models_button', { projectId });
    navigate('/models');
  };

  const handleStartTraining = () => {
    logUserClick('ModelTrainingSection', 'start_training_button', { projectId });
    // Placeholder: navigate to models page for training setup
    navigate('/models');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        Model Training
      </Title>
      <Alert
        message="Training Pipeline"
        description="Configure datasets, select models, and start training jobs."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      {project && (
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          Project: <strong>{project.name}</strong>
        </Paragraph>
      )}
      <Space>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartTraining}>
          Start Training
        </Button>
        <Button onClick={handleGoToModels}>Open Models</Button>
      </Space>
    </div>
  );
};

export default ModelTrainingSection;