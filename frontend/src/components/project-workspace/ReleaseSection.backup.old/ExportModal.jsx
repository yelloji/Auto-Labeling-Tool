import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Space,
  Alert,
  Divider,
  Statistic,
  Progress,
  message,
  Collapse,
  Tag
} from 'antd';
import {
  DatabaseOutlined,
  ExperimentOutlined,
  ExportOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import AugmentationControls from './AugmentationControls';
import SplitManager from './SplitManager';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Step } = Steps;
const { Panel } = Collapse;

const ExportModal = ({ 
  visible, 
  onCancel, 
  onSuccess, 
  projectId, 
  project 
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [augmentationConfig, setAugmentationConfig] = useState({});
  const [splitConfig, setSplitConfig] = useState({
    train: 70,
    val: 20,
    test: 10
  });
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (visible && projectId) {
      loadDatasets();
      resetForm();
    }
  }, [visible, projectId]);

  const loadDatasets = async () => {
    try {
      // TODO: Replace with actual API call
      const mockDatasets = [
        {
          id: 1,
          name: 'animal',
          totalImages: 150,
          annotatedImages: 150,
          classes: ['dog', 'cat', 'bird']
        },
        {
          id: 2,
          name: 'car_dataset',
          totalImages: 200,
          annotatedImages: 180,
          classes: ['car', 'truck', 'bus']
        }
      ];
      setDatasets(mockDatasets);
      setSelectedDatasets(mockDatasets.map(d => d.id));
    } catch (error) {
      console.error('Error loading datasets:', error);
      message.error('Failed to load datasets');
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setAugmentationConfig({});
    setSplitConfig({ train: 70, val: 20, test: 10 });
    setExportProgress(0);
    setIsExporting(false);
    form.resetFields();
    
    // Set default values
    form.setFieldsValue({
      releaseName: `Release-${Date.now()}`,
      taskType: 'Object Detection',
      outputFormat: 'YOLO',
      enableAugmentation: false,
      imagesPerOriginal: 3
    });
  };

  const handleNext = async () => {
    try {
      await form.validateFields();
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      setIsExporting(true);
      
      const values = await form.validateFields();
      
      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // Simulate API call
      setTimeout(() => {
        const newRelease = {
          id: Date.now(),
          name: values.releaseName,
          createdAt: new Date().toISOString(),
          totalImages: selectedDatasets.reduce((sum, id) => {
            const dataset = datasets.find(d => d.id === id);
            return sum + (dataset?.totalImages || 0);
          }, 0),
          totalClasses: [...new Set(
            selectedDatasets.flatMap(id => {
              const dataset = datasets.find(d => d.id === id);
              return dataset?.classes || [];
            })
          )].length,
          taskType: values.taskType,
          format: values.outputFormat,
          isAugmented: values.enableAugmentation,
          splits: {
            train: Math.floor(splitConfig.train * 0.01 * 100), // Mock calculation
            val: Math.floor(splitConfig.val * 0.01 * 100),
            test: Math.floor(splitConfig.test * 0.01 * 100)
          },
          status: 'completed'
        };

        clearInterval(progressInterval);
        setExportProgress(100);
        
        setTimeout(() => {
          onSuccess(newRelease);
          setLoading(false);
          setIsExporting(false);
        }, 1000);
      }, 5000);

    } catch (error) {
      console.error('Error creating release:', error);
      message.error('Failed to create release');
      setLoading(false);
      setIsExporting(false);
    }
  };

  const renderStep1 = () => (
    <div>
      <Title level={4}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        Dataset & Augmentation Setup
      </Title>
      
      <Card title="Source Datasets" style={{ marginBottom: 16 }}>
        <Form.Item
          name="selectedDatasets"
          label="Select Datasets"
          initialValue={selectedDatasets}
        >
          <Select
            mode="multiple"
            placeholder="Choose datasets to include"
            value={selectedDatasets}
            onChange={setSelectedDatasets}
          >
            {datasets.map(dataset => (
              <Option key={dataset.id} value={dataset.id}>
                <Space>
                  <span>{dataset.name}</span>
                  <Tag>{dataset.totalImages} images</Tag>
                  <Tag color="blue">{dataset.classes.length} classes</Tag>
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedDatasets.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Title level={5}>Dataset Summary</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total Images"
                  value={selectedDatasets.reduce((sum, id) => {
                    const dataset = datasets.find(d => d.id === id);
                    return sum + (dataset?.totalImages || 0);
                  }, 0)}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Unique Classes"
                  value={[...new Set(
                    selectedDatasets.flatMap(id => {
                      const dataset = datasets.find(d => d.id === id);
                      return dataset?.classes || [];
                    })
                  )].length}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Datasets"
                  value={selectedDatasets.length}
                />
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <Card title="Data Augmentation">
        <Form.Item
          name="enableAugmentation"
          label="Enable Data Augmentation"
          valuePropName="checked"
          initialValue={false}
        >
          <Switch />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enableAugmentation !== curr.enableAugmentation}>
          {({ getFieldValue }) => {
            const enableAugmentation = getFieldValue('enableAugmentation');
            
            if (!enableAugmentation) {
              return (
                <Alert
                  message="Augmentation Disabled"
                  description="Your release will use original images only."
                  type="info"
                  showIcon
                />
              );
            }

            return (
              <div>
                <Form.Item
                  name="imagesPerOriginal"
                  label="Images per Original"
                  initialValue={3}
                >
                  <InputNumber min={1} max={10} />
                </Form.Item>

                <AugmentationControls
                  config={augmentationConfig}
                  onChange={setAugmentationConfig}
                />
              </div>
            );
          }}
        </Form.Item>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <Title level={4}>
        <ExportOutlined style={{ marginRight: 8 }} />
        Export Configuration
      </Title>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Release Settings" style={{ marginBottom: 16 }}>
            <Form.Item
              name="releaseName"
              label="Release Name"
              rules={[{ required: true, message: 'Please enter a release name' }]}
            >
              <Input placeholder="e.g., Release-1" />
            </Form.Item>

            <Form.Item
              name="taskType"
              label="Task Type"
              rules={[{ required: true, message: 'Please select a task type' }]}
            >
              <Select>
                <Option value="Classification">Classification</Option>
                <Option value="Object Detection">Object Detection</Option>
                <Option value="Segmentation">Segmentation</Option>
                <Option value="Instance Segmentation">Instance Segmentation</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="outputFormat"
              label="Output Format"
              rules={[{ required: true, message: 'Please select an output format' }]}
            >
              <Select>
                <Option value="YOLO">YOLO</Option>
                <Option value="COCO">COCO</Option>
                <Option value="VOC">Pascal VOC</Option>
                <Option value="JSON">Custom JSON</Option>
              </Select>
            </Form.Item>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Dataset Splits" style={{ marginBottom: 16 }}>
            <SplitManager
              config={splitConfig}
              onChange={setSplitConfig}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Release Preview">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Total Images"
              value={selectedDatasets.reduce((sum, id) => {
                const dataset = datasets.find(d => d.id === id);
                const baseImages = dataset?.totalImages || 0;
                const multiplier = form.getFieldValue('enableAugmentation') 
                  ? (form.getFieldValue('imagesPerOriginal') || 1) 
                  : 1;
                return sum + (baseImages * multiplier);
              }, 0)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Training Set"
              value={Math.floor(
                selectedDatasets.reduce((sum, id) => {
                  const dataset = datasets.find(d => d.id === id);
                  const baseImages = dataset?.totalImages || 0;
                  const multiplier = form.getFieldValue('enableAugmentation') 
                    ? (form.getFieldValue('imagesPerOriginal') || 1) 
                    : 1;
                  return sum + (baseImages * multiplier);
                }, 0) * splitConfig.train / 100
              )}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Validation Set"
              value={Math.floor(
                selectedDatasets.reduce((sum, id) => {
                  const dataset = datasets.find(d => d.id === id);
                  const baseImages = dataset?.totalImages || 0;
                  const multiplier = form.getFieldValue('enableAugmentation') 
                    ? (form.getFieldValue('imagesPerOriginal') || 1) 
                    : 1;
                  return sum + (baseImages * multiplier);
                }, 0) * splitConfig.val / 100
              )}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Test Set"
              value={Math.floor(
                selectedDatasets.reduce((sum, id) => {
                  const dataset = datasets.find(d => d.id === id);
                  const baseImages = dataset?.totalImages || 0;
                  const multiplier = form.getFieldValue('enableAugmentation') 
                    ? (form.getFieldValue('imagesPerOriginal') || 1) 
                    : 1;
                  return sum + (baseImages * multiplier);
                }, 0) * splitConfig.test / 100
              )}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );

  const renderProgress = () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <Title level={3}>
        <ExportOutlined style={{ marginRight: 8 }} />
        Creating Release...
      </Title>
      
      <Progress
        type="circle"
        percent={exportProgress}
        size={120}
        status={exportProgress === 100 ? 'success' : 'active'}
      />
      
      <div style={{ marginTop: 24 }}>
        <Text>
          {exportProgress < 30 && 'Preparing datasets...'}
          {exportProgress >= 30 && exportProgress < 60 && 'Applying augmentations...'}
          {exportProgress >= 60 && exportProgress < 90 && 'Generating annotations...'}
          {exportProgress >= 90 && exportProgress < 100 && 'Finalizing release...'}
          {exportProgress === 100 && 'Release created successfully!'}
        </Text>
      </div>
    </div>
  );

  const steps = [
    {
      title: 'Dataset & Augmentation',
      content: renderStep1(),
      icon: <DatabaseOutlined />
    },
    {
      title: 'Export Configuration',
      content: renderStep2(),
      icon: <SettingOutlined />
    }
  ];

  return (
    <Modal
      title="Create New Release"
      visible={visible}
      onCancel={onCancel}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        {!isExporting ? (
          <>
            <Steps current={currentStep} style={{ marginBottom: 24 }}>
              {steps.map((step, index) => (
                <Step
                  key={index}
                  title={step.title}
                  icon={step.icon}
                />
              ))}
            </Steps>

            <div style={{ minHeight: 400 }}>
              {steps[currentStep]?.content}
            </div>

            <Divider />

            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={onCancel}>
                  Cancel
                </Button>
                {currentStep > 0 && (
                  <Button onClick={handlePrev}>
                    Previous
                  </Button>
                )}
                {currentStep < steps.length - 1 && (
                  <Button type="primary" onClick={handleNext}>
                    Next
                  </Button>
                )}
                {currentStep === steps.length - 1 && (
                  <Button
                    type="primary"
                    loading={loading}
                    onClick={handleFinish}
                    icon={<CheckCircleOutlined />}
                  >
                    Generate Release
                  </Button>
                )}
              </Space>
            </div>
          </>
        ) : (
          renderProgress()
        )}
      </Form>
    </Modal>
  );
};

export default ExportModal;