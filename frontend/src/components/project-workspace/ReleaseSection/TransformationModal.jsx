import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Row, Col, Card, message, Spin, Alert, Divider, Slider, Space } from 'antd';
import { SettingOutlined, EyeOutlined, SaveOutlined, ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons';
import IndividualTransformationControl from './IndividualTransformationControl';
import { augmentationAPI } from '../../../services/api';

const { TextArea } = Input;

// Transformation icons mapping
const getTransformationIcon = (type) => {
  // Use emoji icons directly as they are more reliable
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
  
  return <span className="transformation-icon-fallback" style={{ fontSize: '24px' }}>{fallbackIcons[type] || '⚙️'}</span>;
};

const TransformationModal = ({ 
  visible, 
  onCancel, 
  onSave, 
  onContinue, // New prop for Continue button
  availableTransformations, 
  editingTransformation,
  selectedDatasets = [],
  transformationType, // 'basic' or 'advanced'
  existingTransformations = [] // Existing transformations to show Continue button
}) => {
  const [form] = Form.useForm();
  const [view, setView] = useState('selection'); // 'selection' or 'configuration'
  const [selectedTransformation, setSelectedTransformation] = useState(null);
  const [transformationConfig, setTransformationConfig] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [currentSelectedImage, setCurrentSelectedImage] = useState(null); // Store the current image for reuse

  // Initialize form and config when modal opens or editing transformation changes
  useEffect(() => {
    if (visible) {
      if (editingTransformation) {
        form.setFieldsValue({
          name: editingTransformation.name,
          description: editingTransformation.description
        });
        setTransformationConfig(editingTransformation.config || {});
      } else {
        form.resetFields();
        setTransformationConfig({});
      }
      setView('selection');
      setSelectedTransformation(null);
      setPreviewImage(null);
      setOriginalImage(null);
      setCurrentSelectedImage(null); // Clear stored image when modal opens
    }
  }, [visible, editingTransformation, form]);

  // Function to load the original image first
  const loadOriginalImage = async () => {
    if (selectedDatasets.length === 0) {
      setPreviewError("Please select a dataset to preview transformations");
      return Promise.reject("No datasets selected");
    }
    
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      
      // Get dataset information from the selected datasets
      const selectedDatasetNames = selectedDatasets.map(dataset => dataset.name || 'unknown');
      console.log('Selected datasets for preview:', selectedDatasetNames);
      
      // Get random image from the first selected dataset using the same API as rebalance function
      const firstDataset = selectedDatasets[0];
      const datasetId = firstDataset.id;
      
      // Fetch actual images from the dataset (same API call as rebalance function)
      const datasetResponse = await fetch(`http://localhost:12000/api/v1/datasets/${datasetId}`);
      if (!datasetResponse.ok) {
        throw new Error('Failed to fetch dataset images');
      }
      
      const datasetData = await datasetResponse.json();
      const availableImages = datasetData.recent_images || [];
      
      if (availableImages.length === 0) {
        setPreviewError("No images available in the selected dataset");
        return Promise.reject("No images available");
      }
      
      // Select a random image (fresh random selection every time)
      const getRandomIndex = (max) => {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] % max;
      };
      
      const randomIndex = getRandomIndex(availableImages.length);
      const selectedImage = availableImages[randomIndex];
      
      console.log(`Using random image from dataset "${firstDataset.name}": ${selectedImage.filename}`);
      
      // Set the original image
      setOriginalImage(`http://localhost:12000/api/images/${selectedImage.id}`);
      
      // Store the selected image for reuse
      setCurrentSelectedImage(selectedImage);
      
      return Promise.resolve(selectedImage);
    } catch (error) {
      console.error('Failed to load original image:', error);
      setPreviewError("Failed to load original image. Please try again.");
      setPreviewLoading(false);
      return Promise.reject(error);
    }
  };

  const handleTransformationSelect = (transformationType, transformationDetails) => {
    console.log('Selected transformation:', transformationType, transformationDetails);
    setSelectedTransformation({
      type: transformationType,
      details: transformationDetails
    });
    setView('configuration');
    
    // Initialize configuration with default values if available
    const defaultConfig = transformationDetails.default_config || {};
    setTransformationConfig({
      ...transformationConfig,
      [transformationType]: defaultConfig
    });
    
    // First load the original image, then generate the preview
    loadOriginalImage().then((selectedImage) => {
      // Generate a preview with the selected transformation
      generatePreview(transformationType, defaultConfig, selectedImage);
    }).catch(error => {
      console.error("Failed to load original image:", error);
    });
  };

  const handleBackToSelection = () => {
    setView('selection');
    setSelectedTransformation(null);
    setPreviewImage(null);
    setOriginalImage(null);
    setPreviewError(null);
  };

  const handleParameterChange = (paramKey, value) => {
    if (!selectedTransformation) return;
    
    const type = selectedTransformation.type;
    const updatedConfig = {
      ...(transformationConfig[type] || {}),
      [paramKey]: value,
      enabled: true
    };
    
    setTransformationConfig(prev => ({
      ...prev,
      [type]: updatedConfig
    }));
    
    // Use the stored current image or extract from URL as fallback
    console.log('handleParameterChange - currentSelectedImage:', currentSelectedImage);
    console.log('handleParameterChange - originalImage:', originalImage);

    if (currentSelectedImage) {
      console.log('Using stored image:', currentSelectedImage.id);
      // Generate preview with updated parameters using the same image
      generatePreview(type, updatedConfig, currentSelectedImage);
    } else if (originalImage) {
      // Extract image ID from URL and create image object
      const match = originalImage.match(/\/api\/images\/([^\/]+)$/);
      if (match && match[1]) {
        const imageId = match[1];
        const imageObject = { id: imageId };
        console.log('Using image from URL:', imageId);
        generatePreview(type, updatedConfig, imageObject);
      } else {
        console.log('Could not extract image ID from URL, falling back to new selection');
        generatePreview(type, updatedConfig);
      }
    } else {
      console.log('No stored image or original image URL, falling back to new selection');
      generatePreview(type, updatedConfig);
    }
  };

  const generatePreview = async (transformationType, config, providedImage = null) => {
    if (selectedDatasets.length === 0) {
      setPreviewError("Please select a dataset to preview transformations");
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewError(null);
      
      // Use the provided image if available, otherwise fetch a new one
      let selectedImage = providedImage;
      
      if (!selectedImage) {
        // Get dataset information from the selected datasets
        const selectedDatasetNames = selectedDatasets.map(dataset => dataset.name || 'unknown');
        console.log('Selected datasets for preview:', selectedDatasetNames);
        
        // Get random image from the first selected dataset using the same API as rebalance function
        const firstDataset = selectedDatasets[0];
        const datasetId = firstDataset.id;
        
        // Fetch actual images from the dataset (same API call as rebalance function)
        const datasetResponse = await fetch(`http://localhost:12000/api/v1/datasets/${datasetId}`);
        if (!datasetResponse.ok) {
          throw new Error('Failed to fetch dataset images');
        }
        
        const datasetData = await datasetResponse.json();
        const availableImages = datasetData.recent_images || [];
        
        if (availableImages.length === 0) {
          setPreviewError("No images available in the selected dataset");
          return;
        }
        
        // Select a random image (fresh random selection every time)
        const getRandomIndex = (max) => {
          const array = new Uint32Array(1);
          crypto.getRandomValues(array);
          return array[0] % max;
        };
        
        const randomIndex = getRandomIndex(availableImages.length);
        selectedImage = availableImages[randomIndex];
        
        console.log(`Using random image from dataset "${firstDataset.name}": ${selectedImage.filename}`);
        
        // Set the original image if we're fetching a new one
        setOriginalImage(`http://localhost:12000/api/images/${selectedImage.id}`);
        
        // Store the selected image for reuse
        setCurrentSelectedImage(selectedImage);
      }
      
      console.log('generatePreview - providedImage:', providedImage);
      
      // Prepare transformation configuration
      const transformConfig = {
        [transformationType]: config
      };
      
      // Call the real backend API for transformation preview
      const formData = new FormData();
      formData.append('image_id', selectedImage.id.toString());
      formData.append('transformations', JSON.stringify(transformConfig));
      
      const previewResponse = await fetch('http://localhost:12000/api/transformation/preview-with-image-id', {
        method: 'POST',
        body: formData
      });
      
      if (!previewResponse.ok) {
        throw new Error('Failed to generate transformation preview');
      }
      
      const previewResult = await previewResponse.json();
      
      if (!previewResult.success) {
        throw new Error('Backend failed to generate preview');
      }
      
      // Set the preview image from the backend response
      setPreviewImage(previewResult.data.preview_image);
      
      // Only set the original image if we're NOT using a provided image
      // This prevents the original image from changing when parameters are updated
      if (!providedImage) {
        setOriginalImage(`http://localhost:12000/api/images/${selectedImage.id}`);
      }
      
      // Log the successful transformation
      const appliedTransformations = previewResult.data.applied_transformations;
      const processingTime = previewResult.data.processing_time_ms;
      
      console.log(`✅ Real transformation preview generated successfully!`);
      console.log(`📸 Image: ${selectedImage.filename}`);
      console.log(`🔧 Applied transformations: ${appliedTransformations.join(', ')}`);
      console.log(`⏱️ Processing time: ${processingTime}ms`);
      console.log(`📐 Original dimensions: ${previewResult.data.image_dimensions.width}x${previewResult.data.image_dimensions.height}`);
      console.log(`🖼️ Preview dimensions: ${previewResult.data.preview_dimensions.width}x${previewResult.data.preview_dimensions.height}`);
      
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setPreviewError("Failed to generate preview. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyTransformation = async () => {
    if (!selectedTransformation) return;
    
    try {
      // Add the transformation to the config
      const type = selectedTransformation.type;
      const config = transformationConfig[type] || {};
      
      // Return to selection view
      setView('selection');
      setSelectedTransformation(null);
      setPreviewImage(null);
      setOriginalImage(null);
      
      // Notify parent component
      const transformationData = {
        name: `Transformation with ${type}`,
        description: `Applied ${type} transformation`,
        transformations: {
          [type]: {
            ...config,
            enabled: true
          }
        }
      };
      
      onSave(transformationData);
    } catch (error) {
      console.error('Failed to apply transformation:', error);
      message.error('Failed to apply transformation');
    }
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    }
  };

  const renderTransformationSelectionView = () => {
    if (!availableTransformations) {
      return (
        <div className="transformation-loading">
          <Spin size="large" />
          <p>Loading transformation options...</p>
        </div>
      );
    }

    // Process the available transformations based on the API response structure
    const processTransformations = () => {
      if (!availableTransformations || !availableTransformations.transformations) {
        return { basic: {}, advanced: {} };
      }
      
      const transformations = availableTransformations.transformations;
      const categories = availableTransformations.categories || {
        basic: ["resize", "rotate", "flip", "crop", "brightness", "contrast", "blur", "noise"],
        advanced: ["color_jitter", "cutout", "random_zoom", "affine_transform", "perspective_warp", "grayscale", "shear", "gamma_correction", "equalize", "clahe"]
      };
      
      const basicTransformations = {};
      const advancedTransformations = {};
      
      // Sort transformations into basic and advanced categories
      Object.entries(transformations).forEach(([key, transformation]) => {
        if (categories.basic.includes(key)) {
          basicTransformations[key] = transformation;
        } else if (categories.advanced.includes(key)) {
          advancedTransformations[key] = transformation;
        }
      });
      
      return { basic: basicTransformations, advanced: advancedTransformations };
    };
    
    const { basic: basicTransformations, advanced: advancedTransformations } = processTransformations();

    return (
      <div className="transformation-selection-view">
        {/* Show only Basic or Advanced Transformations based on transformationType */}
        {transformationType === 'basic' && (
          <div className="transformation-category">
            <h3 className="transformation-category-title">
              <span className="category-dot basic"></span>
              Basic Transformations
            </h3>
            <Row gutter={[16, 16]} className="transformation-grid">
              {Object.entries(basicTransformations).map(([key, transformation]) => (
                <Col key={key} xs={12} sm={8} md={6}>
                  <Card 
                    className="transformation-card"
                    hoverable
                    onClick={() => handleTransformationSelect(key, transformation)}
                  >
                    <div className="transformation-card-content">
                      <div className="transformation-icon-container">
                        {getTransformationIcon(key)}
                      </div>
                      <div className="transformation-name">{transformation.name || key}</div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {transformationType === 'advanced' && (
          <div className="transformation-category">
            <h3 className="transformation-category-title">
              <span className="category-dot advanced"></span>
              Advanced Transformations
            </h3>
            <Row gutter={[16, 16]} className="transformation-grid">
              {Object.entries(advancedTransformations).map(([key, transformation]) => (
                <Col key={key} xs={12} sm={8} md={6}>
                  <Card 
                    className="transformation-card"
                    hoverable
                    onClick={() => handleTransformationSelect(key, transformation)}
                  >
                    <div className="transformation-card-content">
                      <div className="transformation-icon-container">
                        {getTransformationIcon(key)}
                      </div>
                      <div className="transformation-name">{transformation.name || key}</div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </div>
    );
  };

  const renderTransformationConfigurationView = () => {
    if (!selectedTransformation) return null;

    const { type, details } = selectedTransformation;
    const config = transformationConfig[type] || {};
    const parameters = details.parameters || {};

    return (
      <div className="transformation-configuration-view">
        <div className="configuration-header">
          <Button 
            type="link" 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBackToSelection}
            className="back-button"
          >
            Back to Tools
          </Button>
          <div className="selected-transformation-title">
            {getTransformationIcon(type)}
            <span>{details.name || type}</span>
          </div>
        </div>

        <Divider />

        <div className="preview-section">
          <Row gutter={24}>
            <Col span={12}>
              <div className="preview-container">
                <h4>Original</h4>
                <div className="image-preview original-preview">
                  {previewLoading ? (
                    <div className="preview-loading">
                      <Spin />
                      <p>Loading image...</p>
                    </div>
                  ) : originalImage ? (
                    <img 
                      src={originalImage} 
                      alt="Original Image" 
                      className="preview-image"
                    />
                  ) : (
                    <div className="sample-image">Sample Image</div>
                  )}
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className="preview-container">
                <h4>Preview</h4>
                <div className="image-preview transformed-preview">
                  {previewLoading ? (
                    <div className="preview-loading">
                      <Spin />
                      <p>Generating preview...</p>
                    </div>
                  ) : previewError ? (
                    <div className="preview-error">
                      <Alert
                        message="Preview Error"
                        description={previewError}
                        type="error"
                        showIcon
                      />
                    </div>
                  ) : previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Transformation Preview" 
                      className="preview-image"
                    />
                  ) : (
                    <div className="preview-placeholder">
                      <EyeOutlined />
                      <p>Preview will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </div>

        <div className="parameters-section">
          <h4>Parameters</h4>
          <div className="parameters-container">
            {Object.entries(parameters).map(([paramKey, paramDef]) => (
              <div key={paramKey} className="parameter-control">
                <div className="parameter-label">{paramKey.toUpperCase()}</div>
                {paramDef.type === 'int' || paramDef.type === 'float' ? (
                  <div className="parameter-slider-container">
                    <div className="slider-container">
                      <Input.Group compact>
                        <div style={{ width: '70%' }}>
                          <Slider
                            min={paramDef.min}
                            max={paramDef.max}
                            step={paramDef.type === 'int' ? 1 : 0.1}
                            value={config[paramKey] !== undefined ? config[paramKey] : paramDef.default}
                            onChange={(value) => handleParameterChange(paramKey, value)}
                          />
                        </div>
                        <div style={{ width: '30%' }}>
                          <Input
                            type="number"
                            min={paramDef.min}
                            max={paramDef.max}
                            step={paramDef.type === 'int' ? 1 : 0.1}
                            value={config[paramKey] !== undefined ? config[paramKey] : paramDef.default}
                            onChange={(e) => handleParameterChange(paramKey, parseFloat(e.target.value))}
                          />
                        </div>
                      </Input.Group>
                    </div>
                  </div>
                ) : paramDef.type === 'bool' ? (
                  <div className="parameter-switch-container">
                    <Button
                      type={config[paramKey] ? "primary" : "default"}
                      onClick={() => handleParameterChange(paramKey, !config[paramKey])}
                    >
                      {config[paramKey] ? "On" : "Off"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="apply-transformation-container">
          <Button 
            type="primary" 
            size="large"
            onClick={handleApplyTransformation}
            className="apply-transformation-button"
          >
            Apply Transformation
          </Button>
        </div>
      </div>
    );
  };

  // Determine the modal title based on the transformation type
  const getModalTitle = () => {
    if (transformationType === 'basic') {
      return "Add Basic Transformation";
    } else if (transformationType === 'advanced') {
      return "Add Advanced Transformation";
    }
    return "Add Transformation Step";
  };

  return (
    <Modal
      title={
        <div className="transformation-modal-title">
          <SettingOutlined />
          <span>{getModalTitle()}</span>
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      width={1000}
      footer={
        view === 'selection' && existingTransformations.length > 0 ? (
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                icon={<RocketOutlined />}
                onClick={handleContinue}
                size="large"
              >
                Continue to Release Configuration
              </Button>
            </Space>
          </div>
        ) : null
      }
      destroyOnClose
      className="transformation-modal"
    >
      {view === 'selection' ? renderTransformationSelectionView() : renderTransformationConfigurationView()}
    </Modal>
  );
};

export default TransformationModal;

