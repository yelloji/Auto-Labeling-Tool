import React from 'react';
import { Card, Typography } from 'antd';
import './TransformationComponents.css';

const { Text } = Typography;

const TransformationCard = ({ name, icon, enabled }) => {
  return (
    <div className={`transformation-card-item ${enabled ? 'enabled' : ''}`}>
      <div className="transformation-card-icon">{icon}</div>
      <Text className="transformation-card-name" strong>{name}</Text>
    </div>
  );
};

export default TransformationCard;

