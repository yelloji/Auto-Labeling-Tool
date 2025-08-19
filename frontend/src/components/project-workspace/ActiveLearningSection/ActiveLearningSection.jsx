import React, { useEffect } from 'react';
import {
  Typography,
  Alert,
  Button
} from 'antd';
import {
  BulbOutlined
} from '@ant-design/icons';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderActiveLearningContent function (lines 1619-1640)
const ActiveLearningSection = ({ navigate }) => {
  useEffect(() => {
    logInfo('app.frontend.ui', 'active_learning_section_initialized', 'ActiveLearningSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ActiveLearningSection'
    });
  }, []);

  const handleStartActiveLearning = () => {
    logUserClick('active_learning_start_button_clicked', 'User clicked Start Active Learning button');
    logInfo('app.frontend.navigation', 'active_learning_navigation_started', 'Navigating to active learning page', {
      timestamp: new Date().toISOString(),
      destination: '/active-learning',
      source: 'ActiveLearningSection'
    });
    navigate('/active-learning');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BulbOutlined style={{ marginRight: '8px' }} />
        Active Learning
      </Title>
      <Alert
        message="Active Learning"
        description="Improve your model with active learning techniques."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />
      <Button 
        type="primary" 
        size="large"
        onClick={handleStartActiveLearning}
      >
        Start Active Learning
      </Button>
    </div>
  );
};

export default ActiveLearningSection;