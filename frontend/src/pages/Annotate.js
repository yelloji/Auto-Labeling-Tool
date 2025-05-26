import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Typography,
  Row,
  Col,
  Select,
  Space,
  Divider
} from 'antd';
import {
  EditOutlined,
  RobotOutlined,
  SaveOutlined,
  StepForwardOutlined,
  UndoOutlined
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const Annotate = () => {
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Annotation Tool</Title>
        <Paragraph>
          Manually annotate images or use AI models for auto-labeling
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={18}>
          <Card 
            title="Image Canvas"
            style={{ minHeight: 600 }}
          >
            {!currentImage ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                height: 400,
                color: '#999'
              }}>
                <EditOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                <div>Select a dataset to start annotating</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                {/* Image annotation canvas will go here */}
                <div style={{ 
                  width: '100%', 
                  height: 400, 
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #d9d9d9'
                }}>
                  Image annotation canvas placeholder
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card title="Dataset Selection" size="small">
              <Select
                placeholder="Select dataset"
                style={{ width: '100%', marginBottom: 12 }}
                value={selectedDataset}
                onChange={setSelectedDataset}
              >
                <Option value="dataset1">Dataset 1</Option>
                <Option value="dataset2">Dataset 2</Option>
              </Select>
              
              <Select
                placeholder="Select model (optional)"
                style={{ width: '100%' }}
                value={selectedModel}
                onChange={setSelectedModel}
              >
                <Option value="model1">YOLO Model 1</Option>
                <Option value="model2">YOLO Model 2</Option>
              </Select>
            </Card>

            <Card title="Tools" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  icon={<RobotOutlined />}
                  block
                  disabled={!selectedModel}
                >
                  Auto-Label
                </Button>
                <Button icon={<SaveOutlined />} block>
                  Save
                </Button>
                <Button icon={<StepForwardOutlined />} block>
                  Skip
                </Button>
                <Button icon={<UndoOutlined />} block>
                  Undo
                </Button>
              </Space>
            </Card>

            <Card title="Classes" size="small">
              <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
                No classes defined
              </div>
            </Card>

            <Card title="Progress" size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>0/0</div>
                <div style={{ color: '#999' }}>Images annotated</div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default Annotate;