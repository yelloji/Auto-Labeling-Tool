import React, { useEffect } from 'react';
import { Card, Typography, Tag } from 'antd';
import { logInfo } from '../../../utils/professional_logger';
import './TransformationComponents.css';

const { Text } = Typography;

const TransformationCard = ({ name, icon, enabled, status }) => {
  useEffect(() => {
    logInfo('app.frontend.ui', 'transformation_card_rendered', 'TransformationCard component rendered', {
      timestamp: new Date().toISOString(),
      component: 'TransformationCard',
      props: { name, enabled, status }
    });
  }, [name, enabled, status]);

  return (
    <div className={`transformation-card-item ${enabled ? 'enabled' : ''}`}>
      <div className="transformation-card-icon">{icon}</div>
      <div className="transformation-card-content">
        <Text className="transformation-card-name" strong>{name}</Text>
        {status && (
          <Tag color={status === 'COMPLETED' ? 'green' : 'blue'}>
            {status}
          </Tag>
        )}
      </div>
    </div>
  );
};

export default TransformationCard;

