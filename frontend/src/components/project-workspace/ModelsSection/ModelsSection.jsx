import React, { useEffect } from 'react';
import {
  Typography,
  Alert,
  Button
} from 'antd';
import {
  RobotOutlined
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderModelsContent function (lines 1566-1587)
const ModelsSection = ({ navigate }) => {
  useEffect(() => {
    logInfo('app.frontend.ui', 'models_section_initialized', 'ModelsSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ModelsSection'
    });
  }, []);

  const handleViewModelsClick = () => {
    logUserClick('view_models_button_clicked', 'User clicked View Models button');
    logInfo('app.frontend.navigation', 'navigate_to_models_page', 'Navigating to models page', {
      timestamp: new Date().toISOString(),
      destination: '/models',
      source: 'ModelsSection'
    });
    navigate('/models');
  };

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'models_section_rendered', 'ModelsSection component rendered', {
    timestamp: new Date().toISOString(),
    component: 'ModelsSection'
  });

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <RobotOutlined style={{ marginRight: '8px' }} />
        Models
      </Title>
      <Alert
        message="Model Training"
        description="Train and manage your computer vision models."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />
      <Button 
        type="primary" 
        size="large"
        onClick={handleViewModelsClick}
      >
        View Models
      </Button>
    </div>
  );
};

export default ModelsSection;