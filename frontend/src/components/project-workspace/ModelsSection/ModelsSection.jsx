import React from 'react';
import {
  Typography,
  Alert,
  Button
} from 'antd';
import {
  RobotOutlined
} from '@ant-design/icons';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderModelsContent function (lines 1566-1587)
const ModelsSection = ({ navigate }) => {
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
        onClick={() => navigate('/models')}
      >
        View Models
      </Button>
    </div>
  );
};

export default ModelsSection;