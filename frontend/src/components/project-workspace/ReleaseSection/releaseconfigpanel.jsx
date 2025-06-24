



import React, { useState } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Checkbox, Space, Divider, Row, Col, Statistic, Tag, Alert } from 'antd';
import { RocketOutlined, EyeOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

const ReleaseConfigPanel = ({ onGenerate, onPreview, transformations = [], selectedDatasets = [] }) => {
  const [form] = Form.useForm();
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      // Calculate preview statistics
      const baseImages = selectedDatasets.reduce((sum, dataset) => sum + (dataset.totalImages || 0), 0);
      const totalImages = baseImages * (values.multiplier || 1);
      const totalClasses = [...new Set(selectedDatasets.flatMap(d => d.classes || []))].length;
      
      const preview = {
        releaseName: values.name,
        totalImages,
        totalClasses,
        baseImages,
        multiplier: values.multiplier,
        transformationsCount: transformations.length,
        appliedTo: values.split,
        preserveAnnotations: values.preserveAnnotations
      };
      
      setPreviewData(preview);
      if (onPreview) {
        onPreview(preview);
      }
    } catch (error) {
      console.error('Preview validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      const releaseConfig = {
        ...values,
        transformations,
        selectedDatasets: selectedDatasets.map(d => d.id),
        previewData
      };
      onGenerate(releaseConfig);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  return (
    <Card 
      title={
        <Space>
          <SettingOutlined />
          <span>Release Configuration</span>
        </Space>
      }
      style={{ marginTop: 24 }}
      className="release-config-panel"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ 
          multiplier: 5,
          split: 'all',
          preserveAnnotations: true
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="Release Name"
              name="name"
              rules={[
                { required: true, message: 'Please enter a release name' },
                { min: 3, message: 'Release name must be at least 3 characters' }
              ]}
            >
              <Input 
                placeholder="e.g., Release v1.0, Dataset-2024-01" 
                style={{ fontSize: '14px' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Images per Original"
              name="multiplier"
              rules={[{ required: true }]}
              tooltip="Number of augmented images to generate per original image"
            >
              <InputNumber 
                min={1} 
                max={100} 
                style={{ width: '100%' }}
                formatter={value => `${value} images`}
                parser={value => value.replace(' images', '')}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Apply to Split"
              name="split"
              tooltip="Which dataset split to apply transformations to"
            >
              <Select>
                <Option value="all">All Splits</Option>
                <Option value="train">Train Only</Option>
                <Option value="val">Validation Only</Option>
                <Option value="test">Test Only</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="preserveAnnotations"
              valuePropName="checked"
            >
              <Checkbox>
                <Space>
                  <span>Preserve Annotations</span>
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Space>
              </Checkbox>
            </Form.Item>
            <div style={{ fontSize: '12px', color: '#666', marginTop: -16, marginBottom: 16 }}>
              Keep original annotations and transform them along with images
            </div>
          </Col>
        </Row>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12, color: '#262626' }}>Current Configuration</h4>
          <Row gutter={8}>
            <Col>
              <Tag color="blue">
                Datasets: {selectedDatasets.length}
              </Tag>
            </Col>
            <Col>
              <Tag color="green">
                Transformations: {transformations.length}
              </Tag>
            </Col>
            <Col>
              <Tag color="purple">
                Base Images: {selectedDatasets.reduce((sum, d) => sum + (d.totalImages || 0), 0)}
              </Tag>
            </Col>
          </Row>
        </div>

        {previewData && (
          <Alert
            message="Preview Generated"
            description={
              <div style={{ marginTop: 8 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic 
                      title="Total Images" 
                      value={previewData.totalImages}
                      valueStyle={{ fontSize: '16px', color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic 
                      title="Classes" 
                      value={previewData.totalClasses}
                      valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic 
                      title="Multiplier" 
                      value={`${previewData.multiplier}x`}
                      valueStyle={{ fontSize: '16px', color: '#722ed1' }}
                    />
                  </Col>
                </Row>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button 
            icon={<EyeOutlined />}
            onClick={handlePreview}
            loading={loading}
            style={{ minWidth: 120 }}
          >
            Preview Output
          </Button>
          
          <Button 
            type="primary"
            icon={<RocketOutlined />}
            onClick={handleGenerate}
            disabled={!previewData}
            style={{ minWidth: 140 }}
          >
            Create Release
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

export default ReleaseConfigPanel;


