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
      // Reset state when popup opens
      setNewLabelName('');
      setIsCreatingNew(false);
      
      // If we have a default label, try to find it in existing labels
      if (defaultLabel) {
        // Try to find the label by ID first
        const foundLabel = existingLabels.find(label => 
          label.id === defaultLabel || 
          (label.name && label.name.toLowerCase() === defaultLabel.toLowerCase())
        );
        
        if (foundLabel) {
          console.log('🏷️ Found matching label for default:', foundLabel);
          setSelectedLabel(foundLabel.id);
        } else {
          console.log('🏷️ No matching label found for default, using as is:', defaultLabel);
          setSelectedLabel(defaultLabel);
        }
      } else {
        // If no default label, just reset selection
        setSelectedLabel(null);
      }
      
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
        // Using the new label name directly
        labelToUse = newLabelName.trim();
        console.log('Using new label name:', labelToUse);
      } else {
        // Find the selected label object by ID
        const selectedLabelObj = existingLabels.find(label => label.id === selectedLabel);
        console.log('Selected label object:', selectedLabelObj);
        
        // Use the name from the label object
        if (selectedLabelObj) {
          labelToUse = selectedLabelObj.name;
          console.log('Using existing label name:', labelToUse);
        } else {
          // Fallback to using the ID directly if no matching object found
          labelToUse = selectedLabel;
          console.log('Using label ID as name (fallback):', labelToUse);
        }
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
    console.log('Selected existing label with ID:', value);
    
    // Find the label object by ID
    const selectedLabelObj = existingLabels.find(label => label.id === value);
    console.log('Found label object:', selectedLabelObj);
    
    if (selectedLabelObj) {
      // Log the selected label details for debugging
      console.log('Selected label details:', {
        id: selectedLabelObj.id,
        name: selectedLabelObj.name,
        color: selectedLabelObj.color
      });
    } else {
      console.warn('Could not find label object for ID:', value);
    }
    
    setSelectedLabel(value);
    setIsCreatingNew(false);
    setNewLabelName('');
  };

  const renderExistingLabels = () => {
    if (!existingLabels || existingLabels.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          <TagOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
          <div>No labels available yet</div>
          <div style={{ fontSize: '12px' }}>Create your first label below</div>
        </div>
      );
    }

    // Log the existing labels to help with debugging
    console.log('Rendering existing labels in popup:', existingLabels);

    // Sort labels by name for better organization
    const sortedLabels = [...existingLabels].sort((a, b) => {
      if (!a.name) return 1;
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontWeight: '500' }}>
          Available labels ({sortedLabels.length}):
        </div>
        <Space wrap style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap' }}>
          {sortedLabels.map(label => {
            // Skip labels without an ID or name
            if (!label || (!label.id && !label.name)) {
              console.warn('Invalid label found:', label);
              return null;
            }
            
            return (
              <Tag
                key={label.id || label.name}
                color={label.color || AnnotationAPI.generateLabelColor(label.name)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 12px',
                  margin: '4px',
                  border: selectedLabel === label.id ? '2px solid #1890ff' : 'none',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                onClick={() => handleSelectExisting(label.id)}
              >
                {label.name} {label.count > 0 ? `(${label.count})` : ''}
              </Tag>
            );
          })}
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
                {existingLabels.sort((a, b) => a.name.localeCompare(b.name)).map(label => (
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
                      {label.name} {label.count > 0 ? `(${label.count})` : ''}
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
            {isCreatingNew ? (
              <Tag
                color={AnnotationAPI.generateLabelColor(newLabelName)}
                style={{ fontSize: '14px', padding: '4px 12px' }}
              >
                {newLabelName}
              </Tag>
            ) : (
              (() => {
                const selectedLabelObj = existingLabels.find(label => label.id === selectedLabel);
                return (
                  <Tag
                    color={selectedLabelObj ? selectedLabelObj.color : AnnotationAPI.generateLabelColor(selectedLabel)}
                    style={{ fontSize: '14px', padding: '4px 12px' }}
                  >
                    {selectedLabelObj ? selectedLabelObj.name : selectedLabel}
                  </Tag>
                );
              })()
            )}
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