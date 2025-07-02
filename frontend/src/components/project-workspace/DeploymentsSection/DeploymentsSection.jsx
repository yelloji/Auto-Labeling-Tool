import React from 'react';
import {
  Typography,
  Alert
} from 'antd';
import {
  DeploymentUnitOutlined
} from '@ant-design/icons';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderDeploymentsContent function (lines 1604-1617)
const DeploymentsSection = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <DeploymentUnitOutlined style={{ marginRight: '8px' }} />
        Deployments
      </Title>
      <Alert
        message="Model Deployment"
        description="Deploy your trained models to production."
        type="info"
        showIcon
      />
    </div>
  );
};

export default DeploymentsSection;