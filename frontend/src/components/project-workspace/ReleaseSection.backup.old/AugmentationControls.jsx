import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Switch,
  Slider,
  Select,
  Button,
  Space,
  Typography,
  Collapse,
  Alert,
  Tag,
  Tooltip,
  InputNumber
} from 'antd';
import {
  ExperimentOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

const AugmentationControls = ({ config, onChange }) => {
  const [selectedPreset, setSelectedPreset] = useState('medium');
  const [form] = Form.useForm();

  // Augmentation presets based on the existing DataAugmentation.js
  const presets = {
    light: {
      name: 'Light Augmentation',
      description: 'Minimal augmentations for high-quality datasets',
      config: {
        rotation: { enabled: true, probability: 0.3, range: [-5, 5] },
        brightness: { enabled: true, probability: 0.3, range: [0.9, 1.1] },
        horizontal_flip: { enabled: true, probability: 0.5 },
        gaussian_noise: { enabled: false }
      }
    },
    medium: {
      name: 'Medium Augmentation',
      description: 'Balanced augmentations for general use',
      config: {
        rotation: { enabled: true, probability: 0.5, range: [-15, 15] },
        brightness: { enabled: true, probability: 0.5, range: [0.8, 1.2] },
        contrast: { enabled: true, probability: 0.4, range: [0.8, 1.2] },
        horizontal_flip: { enabled: true, probability: 0.5 },
        gaussian_blur: { enabled: true, probability: 0.3, kernel_size: [3, 5] },
        gaussian_noise: { enabled: true, probability: 0.2, std: [0.01, 0.03] }
      }
    },
    heavy: {
      name: 'Heavy Augmentation',
      description: 'Aggressive augmentations for small datasets',
      config: {
        rotation: { enabled: true, probability: 0.7, range: [-30, 30] },
        brightness: { enabled: true, probability: 0.6, range: [0.7, 1.3] },
        contrast: { enabled: true, probability: 0.6, range: [0.7, 1.3] },
        saturation: { enabled: true, probability: 0.5, range: [0.7, 1.3] },
        hue: { enabled: true, probability: 0.3, range: [-0.1, 0.1] },
        horizontal_flip: { enabled: true, probability: 0.5 },
        vertical_flip: { enabled: true, probability: 0.2 },
        gaussian_blur: { enabled: true, probability: 0.4, kernel_size: [3, 7] },
        gaussian_noise: { enabled: true, probability: 0.3, std: [0.01, 0.05] },
        cutout: { enabled: true, probability: 0.3, num_holes: [1, 3], hole_size: [0.1, 0.3] }
      }
    }
  };

  const augmentationCategories = {
    geometric: {
      title: 'Geometric Transformations',
      augmentations: ['rotation', 'horizontal_flip', 'vertical_flip', 'crop', 'zoom']
    },
    color: {
      title: 'Color Adjustments',
      augmentations: ['brightness', 'contrast', 'saturation', 'hue']
    },
    noise_blur: {
      title: 'Noise & Blur Effects',
      augmentations: ['gaussian_noise', 'gaussian_blur', 'motion_blur']
    },
    cutout: {
      title: 'Cutout Techniques',
      augmentations: ['cutout', 'random_erasing']
    }
  };

  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    const preset = presets[presetName];
    if (preset) {
      form.setFieldsValue(preset.config);
      onChange(preset.config);
    }
  };

  const handleConfigChange = (changedFields, allFields) => {
    onChange(allFields);
  };

  const renderAugmentationSpecificControls = (augName) => {
    switch (augName) {
      case 'rotation':
        return (
          <Form.Item name={[augName, 'range']} label="Rotation Range (degrees)" initialValue={[-15, 15]}>
            <Slider range min={-180} max={180} />
          </Form.Item>
        );
      
      case 'brightness':
      case 'contrast':
      case 'saturation':
        return (
          <Form.Item name={[augName, 'range']} label="Adjustment Range" initialValue={[0.8, 1.2]}>
            <Slider range min={0.1} max={2.0} step={0.1} />
          </Form.Item>
        );
      
      case 'hue':
        return (
          <Form.Item name={[augName, 'range']} label="Hue Shift Range" initialValue={[-0.1, 0.1]}>
            <Slider range min={-0.5} max={0.5} step={0.05} />
          </Form.Item>
        );
      
      case 'gaussian_blur':
        return (
          <Form.Item name={[augName, 'kernel_size']} label="Kernel Size Range" initialValue={[3, 7]}>
            <Slider range min={1} max={15} step={2} />
          </Form.Item>
        );
      
      case 'gaussian_noise':
        return (
          <Form.Item name={[augName, 'std']} label="Noise Std Range" initialValue={[0.01, 0.05]}>
            <Slider range min={0.001} max={0.1} step={0.001} />
          </Form.Item>
        );
      
      case 'cutout':
        return (
          <>
            <Form.Item name={[augName, 'num_holes']} label="Number of Holes" initialValue={[1, 3]}>
              <Slider range min={1} max={10} />
            </Form.Item>
            <Form.Item name={[augName, 'hole_size']} label="Hole Size (ratio)" initialValue={[0.1, 0.3]}>
              <Slider range min={0.05} max={0.5} step={0.05} />
            </Form.Item>
          </>
        );
      
      case 'crop':
        return (
          <Form.Item name={[augName, 'scale']} label="Crop Scale Range" initialValue={[0.8, 1.0]}>
            <Slider range min={0.1} max={1.0} step={0.1} />
          </Form.Item>
        );
      
      case 'zoom':
        return (
          <Form.Item name={[augName, 'range']} label="Zoom Range" initialValue={[0.9, 1.1]}>
            <Slider range min={0.5} max={2.0} step={0.1} />
          </Form.Item>
        );
      
      default:
        return null;
    }
  };

  const renderAugmentationCategory = (categoryKey, category) => {
    return (
      <Panel header={category.title} key={categoryKey}>
        <Row gutter={[16, 16]}>
          {category.augmentations.map(augName => (
            <Col span={12} key={augName}>
              <Card size="small" title={augName.replace(/_/g, ' ').toUpperCase()}>
                <Form.Item name={[augName, 'enabled']} valuePropName="checked" noStyle>
                  <Switch 
                    checkedChildren="ON" 
                    unCheckedChildren="OFF"
                    style={{ marginBottom: 8 }}
                  />
                </Form.Item>
                
                <Form.Item 
                  noStyle 
                  shouldUpdate={(prevValues, currentValues) => 
                    prevValues[augName]?.enabled !== currentValues[augName]?.enabled
                  }
                >
                  {({ getFieldValue }) => {
                    const isEnabled = getFieldValue([augName, 'enabled']);
                    if (!isEnabled) return null;
                    
                    return (
                      <div>
                        <Form.Item 
                          name={[augName, 'probability']} 
                          label="Probability"
                          initialValue={0.5}
                        >
                          <Slider min={0} max={1} step={0.1} />
                        </Form.Item>
                        
                        {renderAugmentationSpecificControls(augName)}
                      </div>
                    );
                  }}
                </Form.Item>
              </Card>
            </Col>
          ))}
        </Row>
      </Panel>
    );
  };

  return (
    <div>
      <Card size="small" title="Quick Presets" style={{ marginBottom: 16 }}>
        <Space wrap>
          {Object.entries(presets).map(([name, preset]) => (
            <Button
              key={name}
              type={selectedPreset === name ? 'primary' : 'default'}
              onClick={() => handlePresetChange(name)}
            >
              {preset.name}
            </Button>
          ))}
        </Space>
        {presets[selectedPreset] && (
          <Alert
            message={presets[selectedPreset].description}
            type="info"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </Card>

      <Form 
        form={form} 
        layout="vertical"
        onValuesChange={handleConfigChange}
        initialValues={presets[selectedPreset]?.config || {}}
      >
        <Collapse defaultActiveKey={['geometric', 'color']}>
          {Object.entries(augmentationCategories).map(([categoryKey, category]) =>
            renderAugmentationCategory(categoryKey, category)
          )}
        </Collapse>
      </Form>

      <Card size="small" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div>
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              <Text strong>Augmentation Tips:</Text>
              <ul style={{ fontSize: '12px', marginTop: 8, paddingLeft: 16 }}>
                <li>Start with light augmentations for high-quality datasets</li>
                <li>Use heavy augmentations for small datasets</li>
                <li>Geometric augmentations preserve object shapes</li>
                <li>Color augmentations help with lighting variations</li>
              </ul>
            </div>
          </Col>
          <Col span={12}>
            <div>
              <Text strong>Active Augmentations:</Text>
              <div style={{ marginTop: 8 }}>
                {Object.entries(config).filter(([_, aug]) => aug?.enabled).map(([name]) => (
                  <Tag key={name} color="blue" style={{ margin: '2px' }}>
                    {name.replace(/_/g, ' ')}
                  </Tag>
                ))}
                {Object.entries(config).filter(([_, aug]) => aug?.enabled).length === 0 && (
                  <Text type="secondary">No augmentations enabled</Text>
                )}
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AugmentationControls;