import React from 'react';
import {
  Typography,
  Alert
} from 'antd';
import {
  HistoryOutlined
} from '@ant-design/icons';

const { Title } = Typography;

// This component is extracted from ProjectWorkspace.js
// The main structure comes from the renderVersionsContent function (lines 1551-1564)
const VersionsSection = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <HistoryOutlined style={{ marginRight: '8px' }} />
        Versions
      </Title>
      <Alert
        message="Dataset Versions"
        description="Track different versions of your dataset."
        type="info"
        showIcon
      />
    </div>
  );
};

export default VersionsSection;