/**
 * LabelSelectionPopup.js
 * Modal for selecting/creating labels after drawing shapes
 */

import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, Button, Tag, Space, message, Divider } from 'antd';
import { PlusOutlined, TagOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import AnnotationAPI from './AnnotationAPI';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const { Option } = Select;

const LabelSelectionPopup = React.memo(({
  visible,
  onCancel,
  onConfirm,
  onDelete,
  existingLabels = [],
  defaultLabel = null,
  shapeType = 'box',
  isEditing = false
}) => {
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);
  const [newLabelName, setNewLabelName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handle popup visibility changes and logging
  useEffect(() => {
    if (visible) {
      console.log('🏷️ LabelSelectionPopup visibility changed:', visible);
      console.log('🏷️ Default label:', defaultLabel);
      console.log('🏷️ Existing labels:', existingLabels);
      console.log('🏷️ Shape type:', shapeType);
      console.log('🏷️ Is editing:', isEditing);
      
      logInfo('app.frontend.ui', 'label_popup_opened', 'Label selection popup opened', {
        shapeType,
        isEditing,
        existingLabelsCount: existingLabels.length,
        defaultLabel
      });
    } else {
      // Clear the flag when the popup closes
      try {
        document.getElementById('root').removeAttribute('data-label-popup-initialized');
      } catch (e) {
        // Ignore errors
      }
    }
  }, [visible, shapeType, isEditing, existingLabels.length, defaultLabel]);
  
  // Handle label refresh when popup opens
  useEffect(() => {
    if (!visible) return;
    
    // Refresh project labels when popup opens to ensure we see all labels
    try {
      const apiBase = process.env.REACT_APP_API_BASE || '/api/v1';
      
      // Get current dataset ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const datasetId = urlParams.get('dataset');
      
      if (datasetId) {
        console.log('Popup refreshing labels for dataset:', datasetId);
        
        logInfo('app.frontend.interactions', 'popup_refresh_labels_started', 'Popup started refreshing labels', {
          datasetId
        });
        
        // Force refresh labels from API
        fetch(`${apiBase}/datasets/${datasetId}`)
          .then(r => r.json())
          .then(data => {
            const projectId = data.project_id;
            return fetch(`${apiBase}/projects/${projectId}/labels`);
          })
          .then(r => r.json())
          .then(labels => {
            console.log('Popup refreshed labels:', labels);
            logInfo('app.frontend.interactions', 'popup_refresh_labels_success', 'Popup successfully refreshed labels', {
              datasetId,
              labelsCount: labels.length
            });
            // We don't need to update state here as the parent component 
            // will receive these labels on next render
          })
          .catch(err => {
            console.error('Error refreshing labels in popup:', err);
            logError('app.frontend.validation', 'popup_refresh_labels_failed', 'Failed to refresh labels in popup', {
              datasetId,
              error: err.message
            });
          });
      }
    } catch (e) {
      console.error('Error in popup label refresh:', e);
    }
  }, [visible]); // Only run when visibility changes
  
  // Handle state initialization when popup opens
  useEffect(() => {
    if (!visible) return;
    
    // Only initialize state when first opening the popup
    if (!document.getElementById('root').hasAttribute('data-label-popup-initialized')) {
      // Set a flag on the document to prevent state reset during typing
      document.getElementById('root').setAttribute('data-label-popup-initialized', 'true');
      
      // Only reset name field when first opening, not during typing
      setNewLabelName('');
      
      // Only reset the creation mode when first opening
      if (!isCreatingNew) {
        setIsCreatingNew(false);
      }
      
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
          logInfo('app.frontend.ui', 'default_label_found', 'Default label found and set', {
            defaultLabel,
            foundLabelId: foundLabel.id,
            foundLabelName: foundLabel.name
          });
        } else {
          console.log('🏷️ No matching label found for default, using as is:', defaultLabel);
          setSelectedLabel(defaultLabel);
          logInfo('app.frontend.ui', 'default_label_not_found', 'Default label not found, using as is', {
            defaultLabel
          });
        }
      } else if (!isCreatingNew) {
        // If no default label and not creating new, reset selection
        setSelectedLabel(null);
      }
      
      console.log('🏷️ Popup opened and state reset');
    }
  }, [visible, defaultLabel, existingLabels, isCreatingNew]); // Include all dependencies

  const handleConfirm = async () => {
    if (!selectedLabel && !newLabelName.trim()) {
      message.warning('Please select or create a label');
      return;
    }

    setLoading(true);
    let labelToUse = null; // Define outside try block
    
    try {
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
      
      // Show different success message based on whether we're editing or creating
      if (isEditing) {
        message.success(`Annotation updated to "${labelToUse}"`);
        logInfo('app.frontend.interactions', 'annotation_label_updated', 'Annotation label updated successfully', {
          labelName: labelToUse,
          shapeType,
          isEditing
        });
      } else {
        message.success(`${shapeType} labeled as "${labelToUse}"`);
        logInfo('app.frontend.interactions', 'annotation_label_applied', 'Annotation label applied successfully', {
          labelName: labelToUse,
          shapeType,
          isEditing
        });
      }
    } catch (error) {
      message.error(`Failed to save annotation: ${error.message}`);
      console.error('Label assignment error:', error);
      logError('app.frontend.validation', 'annotation_label_failed', 'Failed to save annotation label', {
        error: error.message,
        labelName: labelToUse || 'unknown',
        shapeType,
        isEditing
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    console.log('Delete button clicked in popup');
    console.log('onDelete function exists:', !!onDelete);
    
    if (onDelete) {
      setLoading(true);
      try {
        console.log('Calling onDelete function');
        await onDelete();
        console.log('onDelete completed successfully');
        message.success('Annotation deleted successfully');
        logInfo('app.frontend.interactions', 'annotation_deleted', 'Annotation deleted successfully', {
          shapeType,
          isEditing
        });
        // Close the popup after successful deletion
        console.log('Calling onCancel to close popup');
        onCancel();
      } catch (error) {
        console.error('Delete error in popup component:', error);
        message.error(`Failed to delete annotation: ${error.message || 'Unknown error'}`);
        logError('app.frontend.validation', 'annotation_delete_failed', 'Failed to delete annotation', {
          error: error.message || 'Unknown error',
          shapeType,
          isEditing
        });
      } finally {
        setLoading(false);
      }
    } else {
      console.error('No onDelete handler provided to popup');
    }
  };

  const handleCreateNew = () => {
    console.log('Switching to create new label mode');
    
    logUserClick('LabelSelectionPopup', 'NewButton', 'User clicked New button');
    
    // Don't reset any text already entered
    setIsCreatingNew(true);
    
    // Only clear selected label if we're switching modes
    setSelectedLabel(null);
    
    // Set a flag to prevent useEffect from resetting our state
    document.getElementById('root').setAttribute('data-creating-new-label', 'true');
    
    // Focus on the input field (will be rendered after state update)
    setTimeout(() => {
      const input = document.querySelector('input[placeholder="Enter new label name"]');
      if (input) input.focus();
    }, 100);
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

    // Labels are already logged in useEffect to prevent render loop spam

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
                onClick={() => {
                  handleSelectExisting(label.id);
                  logUserClick('LabelSelectionPopup', 'LabelTagClick', label.name);
                }}
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
          {isEditing 
            ? `Edit ${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} Label` 
            : `Label ${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)}`}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      confirmLoading={loading}
      okText={isEditing ? "Update Label" : "Apply Label"}
      cancelText="Cancel"
      width={360}
      centered={false}
      style={{ top: 100 }}
      okButtonProps={{
        disabled: !selectedLabel && !newLabelName.trim()
      }}
      footer={[
        // Add delete button when editing
        ...(isEditing && onDelete ? [
          <Button 
            key="delete" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={handleDelete}
            loading={loading}
          >
            Delete
          </Button>
        ] : []),
        <Button key="cancel" onClick={() => {
          onCancel();
          logUserClick('LabelSelectionPopup', 'CancelButton', 'User clicked Cancel');
        }}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={() => {
            handleConfirm();
            logUserClick('LabelSelectionPopup', 'ApplyButton', 'User clicked Apply Label');
          }}
          disabled={!selectedLabel && !newLabelName.trim()}
          icon={isEditing ? <EditOutlined /> : null}
        >
          {isEditing ? "Update Label" : "Apply Label"}
        </Button>
      ].filter(Boolean)} // Filter out falsy values (when isEditing is false)
    >
      <div style={{ padding: '8px 0' }}>
        {renderExistingLabels()}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500' }}>
            {isEditing ? "Change label to:" : "Select label:"}
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
                onChange={(e) => {
                  e.persist(); // Ensure the event persists
                  setNewLabelName(e.target.value);
                }}
                onPressEnter={handleConfirm}
                size="large"
                style={{ flex: 1 }}
                autoFocus
                // Use a stable key to prevent component remounting
                key="new-label-input"
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

        {/* Optimized preview that doesn't cause re-renders during typing */}
        {(() => {
          // Skip rendering if we don't have enough content to preview
          if (!selectedLabel && (!newLabelName || newLabelName.trim().length <= 2)) {
            return null;
          }
                // Use memoized values to prevent recalculations
          const previewColor = isCreatingNew 
            ? (newLabelName ? AnnotationAPI.generateLabelColor(newLabelName) : '#ccc')
            : (selectedLabel && existingLabels.find(label => label.id === selectedLabel)?.color || 
               AnnotationAPI.generateLabelColor(selectedLabel || ''));
    
               
          const previewText = isCreatingNew 
            ? newLabelName
            : (selectedLabel && existingLabels.find(label => label.id === selectedLabel)?.name || selectedLabel);
          
          return (
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
                color={previewColor}
                style={{ fontSize: '14px', padding: '4px 12px' }}
              >
                {previewText}
              </Tag>
            </div>
          );
        })()}

        <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
          💡 Tip: You can edit or delete this annotation later by clicking on it
        </div>
      </div>
    </Modal>
  );
});

export default LabelSelectionPopup;