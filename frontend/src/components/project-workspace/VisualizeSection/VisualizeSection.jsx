import React from 'react';
import {
  Typography,
  Alert
} from 'antd';
import {
  EyeOutlined
} from '@ant-design/icons';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderVisualizeContent function (lines 1589-1601)
const VisualizeSection = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <EyeOutlined style={{ marginRight: '8px' }} />
        Visualize
      </Title>
      <Alert
        message="Data Visualization"
        description="Visualize your dataset and model performance."
        type="info"
        showIcon
      />
    </div>
  );
};

export default VisualizeSection;