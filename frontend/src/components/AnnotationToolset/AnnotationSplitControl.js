import React from 'react';
import { Select, Tag } from 'antd';

const { Option } = Select;

const AnnotationSplitControl = ({ 
  currentSplit = 'train', 
  onSplitChange,
  style = {}
}) => {
  const getSplitColor = (split) => {
    switch (split) {
      case 'train': return '#52c41a';
      case 'val': return '#1890ff';
      case 'test': return '#fa8c16';
      default: return '#d9d9d9';
    }
  };

  const getSplitLabel = (split) => {
    switch (split) {
      case 'train': return 'Training';
      case 'val': return 'Validation';
      case 'test': return 'Testing';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
      <Tag color={getSplitColor(currentSplit)} style={{ margin: 0 }}>
        {getSplitLabel(currentSplit).toUpperCase()}
      </Tag>
      <Select
        value={currentSplit}
        onChange={onSplitChange}
        style={{ width: 120 }}
        size="small"
      >
        <Option value="train">Training</Option>
        <Option value="val">Validation</Option>
        <Option value="test">Testing</Option>
      </Select>
    </div>
  );
};

export default AnnotationSplitControl;