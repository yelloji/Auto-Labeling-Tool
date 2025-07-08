import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Checkbox, Space, Divider, Row, Col, Statistic, Tag, Alert, message } from 'antd';
import { RocketOutlined, EyeOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { imageTransformationsAPI } from '../../../services/api';

const { Option } = Select;

const ReleaseConfigPanel = ({ onGenerate, onPreview, transformations = [], selectedDatasets = [], currentReleaseVersion, onReleaseVersionChange }) => {
  const [form] = Form.useForm();
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingReleaseVersion, setLoadingReleaseVersion] = useState(true);

  // Load existing release version when component mounts
  useEffect(() => {
    const loadReleaseVersion = async () => {
      try {
        setLoadingReleaseVersion(true);
        
        // Only load if not already provided by parent
        if (!currentReleaseVersion) {
          // Get pending release versions
          const pendingVersions = await imageTransformationsAPI.getReleaseVersions('PENDING');
          
          if (pendingVersions && pendingVersions.length > 0) {
            // Use the most recent version (first in sorted array)
            const latestVersion = pendingVersions[0];
            onReleaseVersionChange?.(latestVersion);
            
            // Set the form field value
            form.setFieldsValue({
              name: latestVersion
            });
            
            console.log('Loaded existing release version:', latestVersion);
          } else {
            console.log('No pending release versions found');
          }
        } else {
          // Use the provided release version
          form.setFieldsValue({
            name: currentReleaseVersion
          });
        }
      } catch (error) {
        console.error('Failed to load release version:', error);
        message.error('Failed to load existing release version');
      } finally {
        setLoadingReleaseVersion(false);
      }
    };

    loadReleaseVersion();
  }, [form, currentReleaseVersion, onReleaseVersionChange]);

  // Handle release name change and save to database
  const handleReleaseNameChange = async (newName) => {
    if (!currentReleaseVersion || !newName || newName === currentReleaseVersion) {
      return; // No change needed
    }

    try {
      console.log(`Updating release version from "${currentReleaseVersion}" to "${newName}"`);
      
      const result = await imageTransformationsAPI.updateReleaseVersion(currentReleaseVersion, newName);
      
      onReleaseVersionChange(newName);
      message.success(`Release name updated to "${newName}"`);
      
      console.log('Release version update result:', result);
    } catch (error) {
      console.error('Failed to update release name:', error);
      message.error('Failed to update release name');
      
      // Revert the form field to the original value
      form.setFieldsValue({
        name: currentReleaseVersion
      });
    }
  };

  // Handle Enter key press in release name field
  const handleReleaseNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      const newName = e.target.value.trim();
      handleReleaseNameChange(newName);
    }
  };

  const handlePreview = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      // Calculate preview statistics
      const baseImages = selectedDatasets.reduce((sum, dataset) => sum + (dataset.total_images || 0), 0);
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
        preserveAnnotations: values.preserveAnnotations,
        exportFormat: values.exportFormat,
        taskType: values.taskType,
        imageFormat: values.imageFormat || 'original',
        selectedDatasets: selectedDatasets.map(d => d.name || d.id),
        transformationsList: transformations.map(t => t.name || t.type),
        splitBreakdown: {
          train: Math.floor(totalImages * 0.7),
          val: Math.floor(totalImages * 0.2), 
          test: Math.floor(totalImages * 0.1)
        }
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
          preserveAnnotations: true,
          exportFormat: 'yolo',          // set initial export format here
          taskType: 'object_detection'   // set initial task type here
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
                placeholder={loadingReleaseVersion ? "Loading existing release version..." : "e.g., Release v1.0, Dataset-2024-01"}
                style={{ fontSize: '14px' }}
                onKeyPress={handleReleaseNameKeyPress}
                disabled={loadingReleaseVersion}
                suffix={
                  loadingReleaseVersion ? (
                    <span style={{ color: '#999', fontSize: '12px' }}>Loading...</span>
                  ) : currentReleaseVersion ? (
                    <span style={{ color: '#52c41a', fontSize: '12px' }}>Press Enter to save</span>
                  ) : null
                }
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

        {/* <-- ROW FOR EXPORT FORMAT AND TASK TYPE --> */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Export Format"
              name="exportFormat"
              tooltip="Select the export format"
            >
              <Select>
                <Option value="yolo">YOLO</Option>
                <Option value="coco">COCO</Option>
                <Option value="voc">Pascal VOC</Option>
                <Option value="tfrecord">TFRecord</Option>
                <Option value="csv">CSV</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Task Type"
              name="taskType"
              tooltip="What task the model is trained for"
            >
              <Select>
                <Option value="object_detection">Object Detection</Option>
                <Option value="classification">Classification</Option>
                <Option value="segmentation">Segmentation</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* <-- NEW ROW FOR IMAGE FORMAT --> */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Image Format"
              name="imageFormat"
              tooltip="Select image format for download"
            >
              <Select>
                <Option value="original">Original Format</Option>
                <Option value="jpg">JPG/JPEG (smaller size)</Option>
                <Option value="png">PNG (lossless)</Option>
                <Option value="webp">WEBP (modern, smaller)</Option>
                <Option value="bmp">BMP (uncompressed)</Option>
                <Option value="tiff">TIFF (high quality)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            {/* Placeholder for future options */}
          </Col>
        </Row>
        {/* <-- END NEW ROW --> */}

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
                Base Images: {selectedDatasets.reduce((sum, d) => sum + (d.total_images || 0), 0)}
              </Tag>
            </Col>
          </Row>
        </div>

        {previewData && (
          <Alert
            message={`Release Configuration Preview: "${previewData.releaseName}"`}
            description={
              <div style={{ marginTop: 12 }}>
                {/* Dataset & Images Statistics */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic 
                      title="Total Images" 
                      value={previewData.totalImages}
                      valueStyle={{ fontSize: '16px', color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Base Images" 
                      value={previewData.baseImages}
                      valueStyle={{ fontSize: '14px', color: '#666' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Classes" 
                      value={previewData.totalClasses}
                      valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Multiplier" 
                      value={`${previewData.multiplier}x`}
                      valueStyle={{ fontSize: '16px', color: '#722ed1' }}
                    />
                  </Col>
                </Row>

                {/* Split Breakdown */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic 
                      title="Train Split" 
                      value={previewData.splitBreakdown.train}
                      valueStyle={{ fontSize: '14px', color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Validation Split" 
                      value={previewData.splitBreakdown.val}
                      valueStyle={{ fontSize: '14px', color: '#faad14' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Test Split" 
                      value={previewData.splitBreakdown.test}
                      valueStyle={{ fontSize: '14px', color: '#f5222d' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Transformations" 
                      value={previewData.transformationsCount}
                      valueStyle={{ fontSize: '14px', color: '#722ed1' }}
                    />
                  </Col>
                </Row>

                {/* Configuration Details */}
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <div>
                      <strong>Export Format:</strong> {previewData.exportFormat || 'Not selected'}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div>
                      <strong>Task Type:</strong> {previewData.taskType || 'Not selected'}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div>
                      <strong>Image Format:</strong> {previewData.imageFormat}
                    </div>
                  </Col>
                </Row>

                {/* Selected Datasets */}
                {previewData.selectedDatasets.length > 0 && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={24}>
                      <div>
                        <strong>Selected Datasets:</strong> {previewData.selectedDatasets.join(', ')}
                      </div>
                    </Col>
                  </Row>
                )}

                {/* Applied Transformations */}
                {previewData.transformationsList.length > 0 && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={24}>
                      <div>
                        <strong>Applied Transformations:</strong> {previewData.transformationsList.join(', ')}
                      </div>
                    </Col>
                  </Row>
                )}

                {/* Additional Settings */}
                <Row>
                  <Col span={12}>
                    <div>
                      <strong>Applied To:</strong> {previewData.appliedTo}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <strong>Preserve Annotations:</strong> {previewData.preserveAnnotations ? 'Yes' : 'No'}
                    </div>
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
