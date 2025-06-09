/**
 * LabelSelectionPopup.js
 * Modal for selecting/creating labels after drawing shapes
 */

import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, Button, Tag, Space, message } from 'antd';
import { PlusOutlined, TagOutlined } from '@ant-design/icons';
import AnnotationAPI from './AnnotationAPI';

const { Option } = Select;

const LabelSelectionPopup = ({
  visible,
  onCancel,
  onConfirm,
  existingLabels = [],
  defaultLabel = null,
  shapeType = 'box'
}) => {
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);
  const [newLabelName, setNewLabelName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('🏷️ LabelSelectionPopup visibility changed:', visible);
    console.log('🏷️ Default label:', defaultLabel);
    console.log('🏷️ Existing labels:', existingLabels);
    console.log('🏷️ Shape type:', shapeType);
    
    if (visible) {
      setSelectedLabel(defaultLabel);
      setNewLabelName('');
      setIsCreatingNew(false);
      console.log('🏷️ Popup opened and state reset');
    }
  }, [visible, defaultLabel, existingLabels, shapeType]);

  const handleConfirm = async () => {
    if (!selectedLabel && !newLabelName.trim()) {
      message.warning('Please select or create a label');
      return;
    }

    setLoading(true);
    try {
      let labelToUse;
      
      if (isCreatingNew) {
        labelToUse = newLabelName.trim();
      } else {
        const selectedLabelObj = existingLabels.find(label => label.id === selectedLabel);
        labelToUse = selectedLabelObj ? selectedLabelObj.name : selectedLabel;
      }
      
      if (!labelToUse) {
        message.warning('Please provide a valid label name');
        return;
      }
      
      console.log('Confirming with label:', labelToUse);
      await onConfirm(labelToUse);
      message.success(`${shapeType} labeled as "${labelToUse}"`);
    } catch (error) {
      message.error(`Failed to save annotation: ${error.message}`);
      console.error('Label assignment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedLabel(null);
  };

  const handleSelectExisting = (value) => {
    setSelectedLabel(value);
    setIsCreatingNew(false);
    setNewLabelName('');
  };

  const renderExistingLabels = () => {
    if (existingLabels.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          <TagOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
          <div>No labels used in this image yet</div>
          <div style={{ fontSize: '12px' }}>Create your first label below</div>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontWeight: '500' }}>
          Existing labels in this image:
        </div>
        <Space wrap>
          {existingLabels.map(label => (
            <Tag
              key={label.id}
              color={label.color}
              style={{
                cursor: 'pointer',
                padding: '4px 12px',
                border: selectedLabel === label.id ? '2px solid #1890ff' : 'none'
              }}
              onClick={() => handleSelectExisting(label.id)}
            >
              {label.name} ({label.count})
            </Tag>
          ))}
        </Space>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <TagOutlined />
          {`Label ${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)}`}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      confirmLoading={loading}
      okText="Apply Label"
      cancelText="Cancel"
      width={360}
      centered={false}
      style={{ top: 100 }}
      okButtonProps={{
        disabled: !selectedLabel && !newLabelName.trim()
      }}
    >
      <div style={{ padding: '8px 0' }}>
        {renderExistingLabels()}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500' }}>
            Select label:
          </div>
          
          {!isCreatingNew ? (
            <Space.Compact style={{ width: '100%' }}>
              <Select
                placeholder="Choose existing label"
                value={selectedLabel}
                onChange={handleSelectExisting}
                style={{ flex: 1 }}
                size="large"
                allowClear
              >
                {existingLabels.map(label => (
                  <Option key={label.id} value={label.id}>
                    <Space>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: label.color,
                          display: 'inline-block'
                        }}
                      />
                      {label.name} ({label.count})
                    </Space>
                  </Option>
                ))}
              </Select>
              <Button
                icon={<PlusOutlined />}
                onClick={handleCreateNew}
                size="large"
                type="dashed"
              >
                New
              </Button>
            </Space.Compact>
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Enter new label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onPressEnter={handleConfirm}
                size="large"
                style={{ flex: 1 }}
                autoFocus
                ref={(input) => input && input.focus()}
              />
              <Button
                onClick={() => setIsCreatingNew(false)}
                size="large"
              >
                Cancel
              </Button>
            </Space.Compact>
          )}
        </div>

        {(selectedLabel || newLabelName.trim()) && (
          <div
            style={{
              padding: '12px',
              background: '#f6f8fa',
              borderRadius: '6px',
              border: '1px solid #e1e4e8'
            }}
          >
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Preview:
            </div>
            <Tag
              color={AnnotationAPI.generateLabelColor(selectedLabel || newLabelName)}
              style={{ fontSize: '14px', padding: '4px 12px' }}
            >
              {selectedLabel || newLabelName}
            </Tag>
          </div>
        )}

        <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
          💡 Tip: You can edit or delete this annotation later by clicking on it
        </div>
      </div>
    </Modal>
  );
};

export default LabelSelectionPopup;