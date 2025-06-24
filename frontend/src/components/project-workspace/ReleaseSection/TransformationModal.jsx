

import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Slider, Select, Row, Col, Form, Input, Switch, Card, Space, Divider } from 'antd';
import { SwapOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;

const TransformationModal = ({ visible, step, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState(step?.config || {});
  const [transformationType, setTransformationType] = useState(step?.type || 'resize');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (step) {
      setConfig(step.config || {});
      setTransformationType(step.type || 'resize');
      form.setFieldsValue({
        type: step.type,
        enabled: step.enabled !== false,
        ...step.config
      });
    }
  }, [step, form]);

  const transformationTypes = {
    resize: {
      name: 'Resize',
      description: 'Resize images to specific dimensions',
      icon: '📐',
      params: {
        width: { type: 'slider', min: 64, max: 2048, step: 32, default: 640 },
        height: { type: 'slider', min: 64, max: 2048, step: 32, default: 640 },
        method: { 
          type: 'select', 
          options: [
            { value: 'stretch', label: 'Stretch' },
            { value: 'pad', label: 'Pad with background' },
            { value: 'crop', label: 'Crop to fit' }
          ],
          default: 'stretch'
        }
      }
    },
    flip: {
      name: 'Flip',
      description: 'Flip images horizontally or vertically',
      icon: '🔄',
      params: {
        direction: {
          type: 'select',
          options: [
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
            { value: 'both', label: 'Both' }
          ],
          default: 'horizontal'
        },
        probability: { type: 'slider', min: 0, max: 1, step: 0.1, default: 0.5 }
      }
    },
    rotate: {
      name: 'Rotate',
      description: 'Rotate images by specified degrees',
      icon: '↻',
      params: {
        degrees: { type: 'slider', min: -180, max: 180, step: 5, default: 0 },
        fill_color: { type: 'input', default: '#000000' },
        probability: { type: 'slider', min: 0, max: 1, step: 0.1, default: 0.5 }
      }
    },
    brightness: {
      name: 'Brightness',
      description: 'Adjust image brightness',
      icon: '☀️',
      params: {
        factor: { type: 'slider', min: 0.1, max: 3, step: 0.1, default: 1 },
        probability: { type: 'slider', min: 0, max: 1, step: 0.1, default: 0.5 }
      }
    },
    contrast: {
      name: 'Contrast',
      description: 'Adjust image contrast',
      icon: '🌗',
      params: {
        factor: { type: 'slider', min: 0.1, max: 3, step: 0.1, default: 1 },
        probability: { type: 'slider', min: 0, max: 1, step: 0.1, default: 0.5 }
      }
    },
    blur: {
      name: 'Blur',
      description: 'Apply gaussian blur to images',
      icon: '🌫️',
      params: {
        radius: { type: 'slider', min: 0, max: 10, step: 0.5, default: 1 },
        probability: { type: 'slider', min: 0, max: 1, step: 0.1, default: 0.3 }
      }
    },
    noise: {
      name: 'Noise',
      description: 'Add random noise to images',
      icon: '📺',
      params: {
        intensity: { type: 'slider', min: 0, max: 0.5, step: 0.01, default: 0.1 },
        probability: { type: 'slider', min: 0, max: 1, step: 0.1, default: 0.3 }
      }
    }
  };

  const renderParamControl = (paramName, paramConfig) => {
    const value = config[paramName] ?? paramConfig.default;

    switch (paramConfig.type) {
      case 'slider':
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>{paramName.charAt(0).toUpperCase() + paramName.slice(1)}:</span>
              <span style={{ color: '#1890ff', fontWeight: 600 }}>{value}</span>
            </div>
            <Slider
              min={paramConfig.min}
              max={paramConfig.max}
              step={paramConfig.step}
              value={value}
              onChange={val => setConfig({ ...config, [paramName]: val })}
              marks={paramConfig.marks}
            />
          </div>
        );

      case 'select':
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {paramName.charAt(0).toUpperCase() + paramName.slice(1)}:
            </div>
            <Select
              style={{ width: '100%' }}
              value={value}
              onChange={val => setConfig({ ...config, [paramName]: val })}
            >
              {paramConfig.options.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>
        );

      case 'input':
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {paramName.charAt(0).toUpperCase() + paramName.slice(1)}:
            </div>
            <Input
              value={value}
              onChange={e => setConfig({ ...config, [paramName]: e.target.value })}
              placeholder={`Enter ${paramName}`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const handleSave = () => {
    const transformationData = {
      id: step?.id || Date.now().toString(),
      type: transformationType,
      description: transformationTypes[transformationType]?.description,
      config: config,
      enabled: form.getFieldValue('enabled') !== false
    };
    onSave(transformationData);
  };

  const currentTransformation = transformationTypes[transformationType];

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>Configure {currentTransformation?.name || 'Transformation'}</span>
        </Space>
      }
      visible={visible}
      width={900}
      onOk={handleSave}
      onCancel={onCancel}
      okText="Save Transformation"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={24}>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Transformation Type" name="type">
                    <Select
                      value={transformationType}
                      onChange={setTransformationType}
                      style={{ width: '100%' }}
                    >
                      {Object.entries(transformationTypes).map(([key, type]) => (
                        <Option key={key} value={key}>
                          <Space>
                            <span>{type.icon}</span>
                            <span>{type.name}</span>
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Enable Transformation" name="enabled" valuePropName="checked">
                    <Switch defaultChecked />
                  </Form.Item>
                </Col>
              </Row>
              <div style={{ color: '#666', fontSize: '13px' }}>
                {currentTransformation?.description}
              </div>
            </Card>
          </Col>
        </Row>

        <Tabs defaultActiveKey="1">
          <TabPane tab={<Space><SettingOutlined />Parameters</Space>} key="1">
            <Row gutter={24}>
              <Col span={12}>
                <Card title="Configuration" size="small">
                  {currentTransformation && Object.entries(currentTransformation.params).map(([paramName, paramConfig]) => (
                    <div key={paramName}>
                      {renderParamControl(paramName, paramConfig)}
                    </div>
                  ))}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Preview" size="small">
                  <Row gutter={8}>
                    <Col span={12}>
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Original</span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: 120, 
                        background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <EyeOutlined style={{ fontSize: 24, color: '#bfbfbf' }} />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Transformed</span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: 120, 
                        background: 'linear-gradient(45deg, #e6f7ff 25%, transparent 25%), linear-gradient(-45deg, #e6f7ff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e6f7ff 75%), linear-gradient(-45deg, transparent 75%, #e6f7ff 75%)',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                        border: '1px solid #91d5ff',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <SwapOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                      </div>
                    </Col>
                  </Row>
                  <div style={{ 
                    marginTop: 12, 
                    padding: 8, 
                    background: '#f6ffed', 
                    border: '1px solid #b7eb8f',
                    borderRadius: 4,
                    fontSize: '12px',
                    color: '#389e0d'
                  }}>
                    💡 Preview will show actual transformation results when connected to backend
                  </div>
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
};

export default TransformationModal;

