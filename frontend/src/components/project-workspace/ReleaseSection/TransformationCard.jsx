



import React from 'react';
import { Card, Button, Tag, Tooltip, Space } from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';

const TransformationCard = ({ step, onEdit, onDelete }) => {
  const getTransformationIcon = (type) => {
    const icons = {
      'resize': '📐',
      'flip': '🔄',
      'rotate': '↻',
      'brightness': '☀️',
      'contrast': '🌗',
      'blur': '🌫️',
      'noise': '📺',
      'crop': '✂️',
      'zoom': '🔍',
      'saturation': '🎨',
      'hue': '🌈'
    };
    return icons[type.toLowerCase()] || '⚙️';
  };

  const formatConfigValue = (key, value) => {
    if (typeof value === 'boolean') {
      return value ? 'Enabled' : 'Disabled';
    }
    if (Array.isArray(value)) {
      return value.join(' - ');
    }
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    return String(value);
  };

  return (
    <Card
      size="small"
      className="transformation-card"
      style={{
        minWidth: 280,
        maxWidth: 320,
        margin: '0 8px 16px 0',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      }}
      hoverable
      title={
        <Space>
          <span style={{ fontSize: '16px' }}>{getTransformationIcon(step.type)}</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{step.type}</span>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="Edit transformation">
            <Button 
              type="text" 
              size="small"
              icon={<EditOutlined />} 
              onClick={() => onEdit(step)}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Tooltip title="Delete transformation">
            <Button 
              type="text" 
              size="small"
              icon={<DeleteOutlined />} 
              onClick={() => onDelete(step.id)}
              style={{ color: '#ff4d4f' }}
            />
          </Tooltip>
        </Space>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <p style={{ 
          margin: 0, 
          color: '#666', 
          fontSize: '13px',
          lineHeight: '1.4'
        }}>
          {step.description || `Apply ${step.type} transformation`}
        </p>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 500, 
          color: '#262626',
          marginBottom: 6
        }}>
          Parameters:
        </div>
        <Space wrap size={[4, 4]}>
          {Object.entries(step.config || {}).map(([key, value]) => (
            <Tag 
              key={key} 
              color="blue"
              style={{ 
                fontSize: '11px',
                margin: 0,
                borderRadius: 4
              }}
            >
              {key}: {formatConfigValue(key, value)}
            </Tag>
          ))}
        </Space>
      </div>

      {step.enabled !== undefined && (
        <div style={{ marginTop: 8 }}>
          <Tag 
            color={step.enabled ? 'green' : 'red'}
            style={{ fontSize: '11px' }}
          >
            {step.enabled ? 'Enabled' : 'Disabled'}
          </Tag>
        </div>
      )}
    </Card>
  );
};

export default TransformationCard;



