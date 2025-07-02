import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Row, Col, message, Spin, Empty, Tooltip, Tag, Divider } from 'antd';
import { PlusOutlined, SettingOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons';
import TransformationModal from './TransformationModal';
import { augmentationAPI } from '../../../services/api';

// Helper function to get transformation icon
const getTransformationIcon = (type) => {
  const fallbackIcons = {
    resize: '📏',
    rotate: '🔄',
    flip: '🔀',
    crop: '✂️',
    brightness: '☀️',
    contrast: '🌗',
    blur: '🌫️',
    noise: '📺',
    color_jitter: '🎨',
    cutout: '⬛',
    random_zoom: '🔍',
    affine_transform: '📐',
    perspective_warp: '🏗️',
    grayscale: '⚫',
    shear: '📊',
    gamma_correction: '💡',
    equalize: '⚖️',
    clahe: '🔆'
  };
  
  return fallbackIcons[type] || '⚙️';
};

// Helper function to format transformation parameters for display
const formatParameters = (config) => {
  if (!config) return '';
  
  const params = Object.entries(config)
    .filter(([key]) => key !== 'enabled')
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return `${key}: ${value ? 'on' : 'off'}`;
      } else if (typeof value === 'number') {
        return `${key}: ${value}`;
      }
      return `${key}: ${value}`;
    })
    .join(', ');
  
  return params;
};

const TransformationSection = ({ onTransformationsChange, selectedDatasets = [] }) => {
  const [basicTransformations, setBasicTransformations] = useState([]);
  const [advancedTransformations, setAdvancedTransformations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState(null); // 'basic' or 'advanced'
  const [editingTransformation, setEditingTransformation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableTransformations, setAvailableTransformations] = useState(null);

  // Load available transformations on component mount
  useEffect(() => {
    loadAvailableTransformations();
  }, []);

  const loadAvailableTransformations = async () => {
    try {
      setLoading(true);
      const response = await augmentationAPI.getAvailableTransformations();
      if (response.success) {
        console.log('API Response:', response.data); // Debug log
        setAvailableTransformations(response.data);
      } else {
        console.error('API returned unsuccessful response:', response);
        message.error('Failed to load transformation options: API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Failed to load available transformations:', error);
      message.error('Failed to load transformation options');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBasicTransformation = () => {
    setEditingTransformation(null);
    setModalType('basic');
    setModalVisible(true);
  };

  const handleAddAdvancedTransformation = () => {
    setEditingTransformation(null);
    setModalType('advanced');
    setModalVisible(true);
  };

  const handleDeleteTransformation = (transformationId, isAdvanced) => {
    if (isAdvanced) {
      const updatedTransformations = advancedTransformations.filter(t => t.id !== transformationId);
      setAdvancedTransformations(updatedTransformations);
      onTransformationsChange?.([...basicTransformations, ...updatedTransformations]);
    } else {
      const updatedTransformations = basicTransformations.filter(t => t.id !== transformationId);
      setBasicTransformations(updatedTransformations);
      onTransformationsChange?.([...updatedTransformations, ...advancedTransformations]);
    }
    message.success('Transformation removed');
  };

  const handleSaveTransformation = (transformationConfig) => {
    const newTransformation = {
      id: editingTransformation?.id || Date.now().toString(),
      name: transformationConfig.name || 'Custom Transformation',
      description: transformationConfig.description || '',
      config: transformationConfig.transformations,
      enabled: true,
      createdAt: editingTransformation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Determine if this is a basic or advanced transformation
    const transformationType = Object.keys(transformationConfig.transformations)[0];
    const isAdvanced = modalType === 'advanced';

    if (isAdvanced) {
      if (editingTransformation) {
        const updatedTransformations = advancedTransformations.map(t => 
          t.id === editingTransformation.id ? newTransformation : t
        );
        setAdvancedTransformations(updatedTransformations);
        onTransformationsChange?.([...basicTransformations, ...updatedTransformations]);
      } else {
        const updatedTransformations = [...advancedTransformations, newTransformation];
        setAdvancedTransformations(updatedTransformations);
        onTransformationsChange?.([...basicTransformations, ...updatedTransformations]);
      }
    } else {
      if (editingTransformation) {
        const updatedTransformations = basicTransformations.map(t => 
          t.id === editingTransformation.id ? newTransformation : t
        );
        setBasicTransformations(updatedTransformations);
        onTransformationsChange?.([...updatedTransformations, ...advancedTransformations]);
      } else {
        const updatedTransformations = [...basicTransformations, newTransformation];
        setBasicTransformations(updatedTransformations);
        onTransformationsChange?.([...updatedTransformations, ...advancedTransformations]);
      }
    }

    setModalVisible(false);
    setModalType(null);
    setEditingTransformation(null);
    
    message.success(editingTransformation ? 'Transformation updated' : 'Transformation added');
  };

  const renderTransformationTag = (transformation, isAdvanced = false) => {
    // Get the first transformation type from the config
    const transformationType = Object.keys(transformation.config || {})[0];
    if (!transformationType) return null;

    const config = transformation.config[transformationType];
    const parameters = formatParameters(config);

    return (
      <div className="transformation-tag" key={transformation.id}>
        <span className="transformation-tag-icon">{getTransformationIcon(transformationType)}</span>
        <span className="transformation-tag-name">{transformationType}</span>
        {parameters && <span className="transformation-tag-params">({parameters})</span>}
        <Button 
          type="text" 
          size="small" 
          icon={<CloseOutlined />} 
          className="transformation-tag-delete"
          onClick={() => handleDeleteTransformation(transformation.id, isAdvanced)}
        />
      </div>
    );
  };

  if (loading && !availableTransformations) {
    return (
      <div className="transformations-section">
        <div className="transformations-header">
          <SettingOutlined className="transformations-icon" />
          <h2 className="transformations-title">Transformations</h2>
        </div>
        <div className="transformations-loading">
          <Spin size="large" />
          <p>Loading transformation options...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="transformations-section">
        <div className="transformations-header">
          <SettingOutlined className="transformations-icon" />
          <h2 className="transformations-title">Transformations</h2>
        </div>
        <p className="transformations-description">
          Add image-level transformations to augment your dataset before creating a release.
        </p>

        <div className="transformations-container">
          {/* Basic Transformations */}
          <div className="transformation-category basic-transformations">
            <div className="transformation-category-header">
              <h3 className="transformation-category-title">
                <span className="category-dot basic"></span>
                Basic Transformations
              </h3>
              <Button 
                icon={<PlusOutlined />}
                onClick={handleAddBasicTransformation}
                disabled={!availableTransformations}
                className="add-transformation-button basic"
              >
                Add Basic Transformation
              </Button>
            </div>
            <div className="transformation-list">
              {basicTransformations.length > 0 ? (
                <div className="transformation-tags">
                  {basicTransformations.map(transformation => 
                    renderTransformationTag(transformation)
                  )}
                </div>
              ) : (
                <div className="no-transformations">
                  No transformations added
                </div>
              )}
            </div>
          </div>

          {/* Advanced Transformations */}
          <div className="transformation-category advanced-transformations">
            <div className="transformation-category-header">
              <h3 className="transformation-category-title">
                <span className="category-dot advanced"></span>
                Advanced Transformations
              </h3>
              <Button 
                icon={<PlusOutlined />}
                onClick={handleAddAdvancedTransformation}
                disabled={!availableTransformations}
                className="add-transformation-button advanced"
              >
                Add Advanced Transformation
              </Button>
            </div>
            <div className="transformation-list">
              {advancedTransformations.length > 0 ? (
                <div className="transformation-tags">
                  {advancedTransformations.map(transformation => 
                    renderTransformationTag(transformation, true)
                  )}
                </div>
              ) : (
                <div className="no-transformations">
                  No transformations added
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TransformationModal
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setModalType(null);
          setEditingTransformation(null);
        }}
        onSave={handleSaveTransformation}
        availableTransformations={availableTransformations}
        editingTransformation={editingTransformation}
        selectedDatasets={selectedDatasets}
        transformationType={modalType}
      />
    </>
  );
};

export default TransformationSection;

