import React, { useState, useEffect } from 'react';
import { Card, Switch, Slider, InputNumber, Row, Col, Tooltip, Space, Divider } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';

const IndividualTransformationControl = ({ 
  transformationType, 
  transformation, 
  config = {}, 
  onChange 
}) => {
  const [enabled, setEnabled] = useState(config.enabled !== false);
  const [parameters, setParameters] = useState({});

  // Initialize parameters from transformation definition and current config
  useEffect(() => {
    const initialParams = {};
    
    if (transformation.parameters) {
      Object.entries(transformation.parameters).forEach(([key, paramDef]) => {
        initialParams[key] = config[key] !== undefined ? config[key] : paramDef.default;
      });
    }
    
    setParameters(initialParams);
    setEnabled(config.enabled !== false);
  }, [transformation, config]);

  // Update parent when configuration changes
  useEffect(() => {
    const newConfig = {
      enabled,
      ...parameters
    };
    onChange(newConfig);
  }, [enabled, parameters, onChange]);

  const handleParameterChange = (paramKey, value) => {
    setParameters(prev => ({
      ...prev,
      [paramKey]: value
    }));
  };

  const renderParameterControl = (paramKey, paramDef) => {
    const value = parameters[paramKey];
    
    switch (paramDef.type) {
      case 'bool':
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 4
            }}>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>
                {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
              </span>
              <Switch
                size="small"
                checked={value}
                onChange={(checked) => handleParameterChange(paramKey, checked)}
                disabled={!enabled}
              />
            </div>
          </div>
        );

      case 'int':
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 4
            }}>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>
                {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
              </span>
              <InputNumber
                size="small"
                value={value}
                min={paramDef.min}
                max={paramDef.max}
                step={1}
                onChange={(val) => handleParameterChange(paramKey, val)}
                disabled={!enabled}
                style={{ width: 70 }}
              />
            </div>
            {paramDef.min !== undefined && paramDef.max !== undefined && (
              <Slider
                value={value}
                min={paramDef.min}
                max={paramDef.max}
                step={1}
                onChange={(val) => handleParameterChange(paramKey, val)}
                disabled={!enabled}
                tooltip={{ formatter: null }}
                style={{ margin: '4px 0' }}
              />
            )}
          </div>
        );

      case 'float':
        const step = paramDef.step || 0.1;
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 4
            }}>
              <span style={{ fontSize: '12px', fontWeight: 500 }}>
                {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
              </span>
              <InputNumber
                size="small"
                value={value}
                min={paramDef.min}
                max={paramDef.max}
                step={step}
                precision={2}
                onChange={(val) => handleParameterChange(paramKey, val)}
                disabled={!enabled}
                style={{ width: 80 }}
              />
            </div>
            {paramDef.min !== undefined && paramDef.max !== undefined && (
              <Slider
                value={value}
                min={paramDef.min}
                max={paramDef.max}
                step={step}
                onChange={(val) => handleParameterChange(paramKey, val)}
                disabled={!enabled}
                tooltip={{ formatter: (val) => val?.toFixed(2) }}
                style={{ margin: '4px 0' }}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const getTransformationIcon = (type) => {
    const iconMap = {
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
    return iconMap[type] || '⚙️';
  };

  const getTransformationDescription = (type) => {
    const descriptions = {
      resize: 'Change image dimensions',
      rotate: 'Rotate image by specified angle',
      flip: 'Flip image horizontally or vertically',
      crop: 'Randomly crop and resize image',
      brightness: 'Adjust image brightness',
      contrast: 'Adjust image contrast',
      blur: 'Apply Gaussian blur effect',
      noise: 'Add random noise to image',
      color_jitter: 'Randomly adjust color properties',
      cutout: 'Remove random rectangular regions',
      random_zoom: 'Randomly zoom in or out',
      affine_transform: 'Apply affine transformations',
      perspective_warp: 'Apply perspective distortion',
      grayscale: 'Convert to grayscale',
      shear: 'Apply shear transformation',
      gamma_correction: 'Adjust gamma values',
      equalize: 'Histogram equalization',
      clahe: 'Contrast Limited Adaptive Histogram Equalization'
    };
    return descriptions[type] || 'Apply transformation';
  };

  return (
    <Card
      size="small"
      style={{
        height: '100%',
        border: enabled ? '1px solid #1890ff' : '1px solid #e8e8e8',
        borderRadius: '8px',
        backgroundColor: enabled ? '#f6ffed' : '#fafafa',
        transition: 'all 0.3s ease'
      }}
      bodyStyle={{ padding: '12px' }}
    >
      {/* Header with title and enable/disable switch */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: 12
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: 4
          }}>
            <span style={{ fontSize: '16px', marginRight: 6 }}>
              {getTransformationIcon(transformationType)}
            </span>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 600,
              color: enabled ? '#1890ff' : '#666'
            }}>
              {transformation.name || transformationType}
            </span>
            <Tooltip title={getTransformationDescription(transformationType)}>
              <InfoCircleOutlined 
                style={{ 
                  fontSize: '12px', 
                  color: '#999', 
                  marginLeft: 4 
                }} 
              />
            </Tooltip>
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: '#999',
            lineHeight: '1.3'
          }}>
            {transformation.category === 'basic' ? 'Basic' : 'Advanced'} transformation
          </div>
        </div>
        <Switch
          checked={enabled}
          onChange={setEnabled}
          size="small"
        />
      </div>

      {/* Parameters */}
      {enabled && transformation.parameters && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ opacity: enabled ? 1 : 0.5 }}>
            {Object.entries(transformation.parameters).map(([paramKey, paramDef]) => (
              <div key={paramKey}>
                {renderParameterControl(paramKey, paramDef)}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Summary when disabled */}
      {!enabled && (
        <div style={{ 
          textAlign: 'center', 
          color: '#999', 
          fontSize: '11px',
          padding: '8px 0'
        }}>
          Enable to configure parameters
        </div>
      )}

      {/* Parameter count indicator */}
      {enabled && transformation.parameters && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: 8,
          fontSize: '10px',
          color: '#666'
        }}>
          {Object.keys(transformation.parameters).length} parameter{Object.keys(transformation.parameters).length !== 1 ? 's' : ''}
        </div>
      )}
    </Card>
  );
};

export default IndividualTransformationControl;

