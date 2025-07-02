import React from 'react';
import {
  Typography,
  Alert,
  Button
} from 'antd';
import {
  BulbOutlined
} from '@ant-design/icons';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderActiveLearningContent function (lines 1619-1640)
const ActiveLearningSection = ({ navigate }) => {
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
        onClick={() => navigate('/active-learning')}
      >
        Start Active Learning
      </Button>
    </div>
  );
};

export default ActiveLearningSection;