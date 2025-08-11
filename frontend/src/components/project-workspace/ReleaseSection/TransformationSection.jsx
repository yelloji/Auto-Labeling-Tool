import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Row, Col, message, Spin, Empty, Tooltip, Tag, Divider } from 'antd';
import { PlusOutlined, SettingOutlined, DeleteOutlined, CloseOutlined, RocketOutlined } from '@ant-design/icons';
import TransformationModal from './TransformationModal';
import { augmentationAPI, imageTransformationsAPI } from '../../../services/api';

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

const TransformationSection = ({ onTransformationsChange, selectedDatasets = [], onContinue }) => {
  const [basicTransformations, setBasicTransformations] = useState([]);
  const [advancedTransformations, setAdvancedTransformations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState(null); // 'basic' or 'advanced'
  const [editingTransformation, setEditingTransformation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableTransformations, setAvailableTransformations] = useState(null);
  const [currentReleaseVersion, setCurrentReleaseVersion] = useState(null);
  const [loadingTransformations, setLoadingTransformations] = useState(false);

  // Load available transformations and existing transformations on component mount
  useEffect(() => {
    loadAvailableTransformations();
    initializeReleaseVersion();
  }, []);

  // Initialize or get current release version
  const initializeReleaseVersion = async () => {
    try {
      // Check if there's a stored release version in session storage
      let releaseVersion = sessionStorage.getItem('currentReleaseVersion');
      
      if (!releaseVersion) {
        // Generate a new release version
        const response = await imageTransformationsAPI.generateVersion();
        releaseVersion = response.version;
        sessionStorage.setItem('currentReleaseVersion', releaseVersion);
      }
      
      setCurrentReleaseVersion(releaseVersion);
      console.log('Using release version:', releaseVersion);
      
      // Load existing transformations for this version
      await loadExistingTransformations(releaseVersion);
    } catch (error) {
      console.error('Failed to initialize release version:', error);
      message.error('Failed to initialize transformation session');
    }
  };

  // Load existing transformations from database
  const loadExistingTransformations = async (releaseVersion) => {
    try {
      setLoadingTransformations(true);
      console.log('Loading transformations for version:', releaseVersion);
      
      // FIXED: Load ALL PENDING transformations instead of just one version
      // This ensures transformations persist across app restarts
      const transformations = await imageTransformationsAPI.getPendingTransformations();
      console.log('Loaded PENDING transformations:', transformations);
      
      // Separate basic and advanced transformations
      const basic = [];
      const advanced = [];
      
      transformations.forEach(transform => {
        // Convert database format to UI format
        const uiTransform = {
          id: transform.id,
          name: transform.transformation_type,
          description: `${transform.transformation_type} transformation`,
          config: { [transform.transformation_type]: transform.parameters },
          enabled: transform.is_enabled,
          createdAt: transform.created_at,
          updatedAt: transform.created_at,
          dbId: transform.id, // Keep reference to database ID
          status: transform.status || 'PENDING', // Add status
          releaseId: transform.release_id // Add release_id
        };
        
        // Use the category from database to place in correct section
        if (transform.category === 'advanced') {
          advanced.push(uiTransform);
        } else {
          basic.push(uiTransform);
        }
      });
      
      setBasicTransformations(basic);
      setAdvancedTransformations(advanced);
      
      // Notify parent component
      onTransformationsChange?.([...basic, ...advanced]);
      
      if (transformations.length > 0) {
        message.success(`Loaded ${transformations.length} existing transformation(s)`);
      }
    } catch (error) {
      console.error('Failed to load existing transformations:', error);
      // Don't show error message if no transformations exist (404 is expected)
      if (error.response?.status !== 404) {
        message.error('Failed to load existing transformations');
      }
    } finally {
      setLoadingTransformations(false);
    }
  };

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

  const handleDeleteTransformation = async (transformationId, isAdvanced) => {
    try {
      // Find the transformation to get its database ID
      const allTransformations = [...basicTransformations, ...advancedTransformations];
      const transformationToDelete = allTransformations.find(t => t.id === transformationId);
      
      if (transformationToDelete?.dbId) {
        console.log('Deleting transformation from database:', transformationToDelete.dbId);
        await imageTransformationsAPI.deleteTransformation(transformationToDelete.dbId);
      }

      // Update UI state
      if (isAdvanced) {
        const updatedTransformations = advancedTransformations.filter(t => t.id !== transformationId);
        setAdvancedTransformations(updatedTransformations);
        onTransformationsChange?.([...basicTransformations, ...updatedTransformations]);
      } else {
        const updatedTransformations = basicTransformations.filter(t => t.id !== transformationId);
        setBasicTransformations(updatedTransformations);
        onTransformationsChange?.([...updatedTransformations, ...advancedTransformations]);
      }
      
      message.success('Transformation removed successfully');
    } catch (error) {
      console.error('Failed to delete transformation:', error);
      message.error('Failed to remove transformation from database');
    }
  };

  const handleSaveTransformation = async (transformationConfig) => {
    if (!currentReleaseVersion) {
      message.error('Release version not initialized');
      return;
    }

    try {
      // Determine transformation type and parameters
      const transformationType = Object.keys(transformationConfig.transformations)[0];
      const parameters = transformationConfig.transformations[transformationType];
      
      // Determine if this is a basic or advanced transformation
      const isAdvanced = modalType === 'advanced';
      
      // Prepare data for API
      // Note: release_version is intentionally omitted to let backend handle version logic
      const transformationData = {
        transformation_type: transformationType,
        parameters: parameters,
        is_enabled: true,
        order_index: (basicTransformations.length + advancedTransformations.length) + 1,
        category: isAdvanced ? 'advanced' : 'basic'
      };

      console.log('Saving transformation to database:', transformationData);

      // Save to database
      const savedTransformation = await imageTransformationsAPI.createTransformation(transformationData);
      console.log('Saved transformation:', savedTransformation);

      // Create UI transformation object
      const newTransformation = {
        id: savedTransformation.id,
        name: transformationType,
        description: `${transformationType} transformation`,
        config: { [transformationType]: parameters },
        enabled: true,
        createdAt: savedTransformation.created_at,
        updatedAt: savedTransformation.created_at,
        dbId: savedTransformation.id
      };

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

      message.success(`${transformationType} transformation saved successfully!`);
    } catch (error) {
      console.error('Failed to save transformation:', error);
      message.error('Failed to save transformation to database');
      return;
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
        {transformation.status && (
          <Tag color={transformation.status === "COMPLETED" ? "green" : "blue"} style={{ marginRight: 8 }}>
            {transformation.status}
          </Tag>
        )}
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

  if ((loading && !availableTransformations) || loadingTransformations) {
    return (
      <div className="transformations-section">
        <div className="transformations-header">
          <SettingOutlined className="transformations-icon" />
          <h2 className="transformations-title">Transformations</h2>
        </div>
        <div className="transformations-loading">
          <Spin size="large" />
          <p>{loadingTransformations ? 'Loading existing transformations...' : 'Loading transformation options...'}</p>
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

        {/* Continue Button - Show when transformations exist */}
        {([...basicTransformations, ...advancedTransformations].length > 0) && (
          <div style={{ 
            marginTop: 24, 
            textAlign: 'center',
            padding: '16px',
            borderTop: '1px solid #f0f0f0'
          }}>
            <Button 
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={() => {
                if (onContinue) {
                  onContinue();
                }
              }}
              style={{
                minWidth: 200,
                height: 48,
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Continue to Release Configuration
            </Button>
          </div>
        )}
      </div>

      <TransformationModal
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setModalType(null);
          setEditingTransformation(null);
        }}
        onSave={handleSaveTransformation}
        onContinue={() => {
          setModalVisible(false);
          setModalType(null);
          setEditingTransformation(null);
          if (onContinue) {
            onContinue();
          }
        }}
        availableTransformations={availableTransformations}
        editingTransformation={editingTransformation}
        selectedDatasets={selectedDatasets}
        transformationType={modalType}
        existingTransformations={[...basicTransformations, ...advancedTransformations]}
      />
    </>
  );
};

export default TransformationSection;

