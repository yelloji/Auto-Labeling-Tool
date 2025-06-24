import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Slider,
  InputNumber,
  Typography,
  Space,
  Alert,
  Statistic,
  Progress,
  Button,
  Tooltip
} from 'antd';
import {
  InfoCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const SplitManager = ({ config, onChange, totalImages = 100 }) => {
  const [splits, setSplits] = useState({
    train: config?.train || 70,
    val: config?.val || 20,
    test: config?.test || 10
  });

  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    const total = splits.train + splits.val + splits.test;
    setIsValid(Math.abs(total - 100) < 0.1);
    
    if (onChange) {
      onChange(splits);
    }
  }, [splits, onChange]);

  const handleSplitChange = (splitType, value) => {
    const newSplits = { ...splits, [splitType]: value };
    
    // Auto-adjust other splits to maintain 100% total
    const total = Object.values(newSplits).reduce((sum, val) => sum + val, 0);
    
    if (total !== 100) {
      const diff = 100 - total;
      const otherSplits = Object.keys(newSplits).filter(key => key !== splitType);
      
      // Distribute the difference proportionally among other splits
      if (otherSplits.length > 0) {
        const otherTotal = otherSplits.reduce((sum, key) => sum + newSplits[key], 0);
        
        if (otherTotal > 0) {
          otherSplits.forEach(key => {
            const proportion = newSplits[key] / otherTotal;
            newSplits[key] = Math.max(0, newSplits[key] + (diff * proportion));
          });
        }
      }
    }

    // Round to 1 decimal place
    Object.keys(newSplits).forEach(key => {
      newSplits[key] = Math.round(newSplits[key] * 10) / 10;
    });

    setSplits(newSplits);
  };

  const resetToDefault = () => {
    setSplits({ train: 70, val: 20, test: 10 });
  };

  const presetSplits = [
    { name: '70/20/10', train: 70, val: 20, test: 10 },
    { name: '80/10/10', train: 80, val: 10, test: 10 },
    { name: '60/20/20', train: 60, val: 20, test: 20 },
    { name: '90/5/5', train: 90, val: 5, test: 5 }
  ];

  const calculateImageCounts = () => {
    return {
      train: Math.floor(totalImages * splits.train / 100),
      val: Math.floor(totalImages * splits.val / 100),
      test: Math.floor(totalImages * splits.test / 100)
    };
  };

  const imageCounts = calculateImageCounts();
  const totalSplit = splits.train + splits.val + splits.test;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Title level={5} style={{ margin: 0 }}>Dataset Splits</Title>
          <Tooltip title="Reset to default 70/20/10 split">
            <Button 
              size="small" 
              icon={<ReloadOutlined />} 
              onClick={resetToDefault}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Quick Presets */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>Quick Presets:</Text>
        <div style={{ marginTop: 8 }}>
          <Space wrap>
            {presetSplits.map(preset => (
              <Button
                key={preset.name}
                size="small"
                onClick={() => setSplits({
                  train: preset.train,
                  val: preset.val,
                  test: preset.test
                })}
                type={
                  splits.train === preset.train && 
                  splits.val === preset.val && 
                  splits.test === preset.test 
                    ? 'primary' 
                    : 'default'
                }
              >
                {preset.name}
              </Button>
            ))}
          </Space>
        </div>
      </div>

      {/* Split Controls */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" title="Training Set" style={{ borderColor: '#3f8600' }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Slider
                  min={10}
                  max={90}
                  step={0.1}
                  value={splits.train}
                  onChange={(value) => handleSplitChange('train', value)}
                  trackStyle={{ backgroundColor: '#3f8600' }}
                  handleStyle={{ borderColor: '#3f8600' }}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={10}
                  max={90}
                  step={0.1}
                  value={splits.train}
                  onChange={(value) => handleSplitChange('train', value)}
                  formatter={value => `${value}%`}
                  parser={value => value.replace('%', '')}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  value={imageCounts.train}
                  suffix="images"
                  valueStyle={{ fontSize: '14px', color: '#3f8600' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Validation Set" style={{ borderColor: '#1890ff' }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Slider
                  min={5}
                  max={50}
                  step={0.1}
                  value={splits.val}
                  onChange={(value) => handleSplitChange('val', value)}
                  trackStyle={{ backgroundColor: '#1890ff' }}
                  handleStyle={{ borderColor: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={5}
                  max={50}
                  step={0.1}
                  value={splits.val}
                  onChange={(value) => handleSplitChange('val', value)}
                  formatter={value => `${value}%`}
                  parser={value => value.replace('%', '')}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  value={imageCounts.val}
                  suffix="images"
                  valueStyle={{ fontSize: '14px', color: '#1890ff' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Test Set" style={{ borderColor: '#cf1322' }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Slider
                  min={5}
                  max={50}
                  step={0.1}
                  value={splits.test}
                  onChange={(value) => handleSplitChange('test', value)}
                  trackStyle={{ backgroundColor: '#cf1322' }}
                  handleStyle={{ borderColor: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={5}
                  max={50}
                  step={0.1}
                  value={splits.test}
                  onChange={(value) => handleSplitChange('test', value)}
                  formatter={value => `${value}%`}
                  parser={value => value.replace('%', '')}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  value={imageCounts.test}
                  suffix="images"
                  valueStyle={{ fontSize: '14px', color: '#cf1322' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Summary */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <div>
              <Text strong>Total: {totalSplit.toFixed(1)}%</Text>
              <Progress
                percent={totalSplit}
                size="small"
                status={isValid ? 'success' : 'exception'}
                style={{ marginTop: 4 }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ textAlign: 'right' }}>
              {isValid ? (
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text type="success">Valid split configuration</Text>
                </Space>
              ) : (
                <Space>
                  <InfoCircleOutlined style={{ color: '#faad14' }} />
                  <Text type="warning">Total should equal 100%</Text>
                </Space>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Guidelines */}
      <Alert
        message="Split Guidelines"
        description={
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li><strong>Training Set (60-80%):</strong> Used to train the model</li>
            <li><strong>Validation Set (10-20%):</strong> Used for hyperparameter tuning</li>
            <li><strong>Test Set (10-20%):</strong> Used for final model evaluation</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  );
};

export default SplitManager;