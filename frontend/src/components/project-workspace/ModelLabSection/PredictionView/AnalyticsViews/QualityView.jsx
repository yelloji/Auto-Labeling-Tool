import React from 'react';
import { Row, Col, Card, Typography, Progress, Tag, Divider, Empty } from 'antd';
import {
    TrophyOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined,
    LineChartOutlined,
    AimOutlined,
    DotChartOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * QualityView Component - Premium Redesign
 * 
 * Focused on a clean, professional "Modern SaaS" aesthetic.
 */
const QualityView = ({ experiment }) => {
    // Check if we have ground truth data for comparison
    const hasGroundTruth = experiment?.dataset_source && experiment.dataset_source !== 'upload';

    // Mock metrics for design view (vibrant but professional)
    const qualityMetrics = {
        precision: 85.4,
        recall: 72.1,
        f1: 78.2,
        falsePositives: 42,
        missedObjects: 18,
        avgIoU: 0.88
    };

    if (!hasGroundTruth) {
        return (
            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <Empty
                    image={<InfoCircleOutlined style={{ fontSize: '64px', color: '#bfbfbf' }} />}
                    description={
                        <div style={{ maxWidth: '440px', margin: '0 auto' }}>
                            <Title level={4} style={{ color: '#262626' }}>Evaluation Data Missing</Title>
                            <Paragraph style={{ color: '#8c8c8c' }}>
                                To calculate quality metrics like **Precision** and **Recall**, the model needs a "Ground Truth" dataset to compare against.
                            </Paragraph>
                            <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginTop: '1.5rem', textAlign: 'left' }}>
                                <Text strong style={{ fontSize: '0.8rem', color: '#595959', display: 'block', marginBottom: '0.5rem' }}>HOW TO ENABLE:</Text>
                                <ul style={{ paddingLeft: '1.2rem', margin: 0, color: '#595959', fontSize: '0.85rem' }}>
                                    <li>Run predictions on a dataset split (val, test, or train)</li>
                                    <li>Ensure the selected images have existing labels</li>
                                </ul>
                            </div>
                        </div>
                    }
                />
            </div>
        );
    }

    const CustomMetric = ({ title, value, subtext, icon, color }) => (
        <Card size="small" style={{ borderRadius: '12px', border: '1px solid #f0f0f0', height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color,
                    fontSize: '1rem'
                }}>
                    {icon}
                </div>
                <Text strong style={{ color: '#8c8c8c', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#262626' }}>{value}</Title>
                <Text style={{ color: '#bfbfbf', fontSize: '1rem' }}>%</Text>
            </div>
            <div style={{ marginTop: '8px' }}>
                <Progress percent={parseFloat(value)} size="small" strokeColor={color} trailColor="#f5f7fa" showInfo={false} strokeWidth={6} />
            </div>
            <Text style={{ color: '#8c8c8c', fontSize: '0.75rem', marginTop: '8px', display: 'block' }}>{subtext}</Text>
        </Card>
    );

    return (
        <div style={{ padding: '16px' }}>
            {/* Primary Metrics Row */}
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <CustomMetric
                        title="Precision Accuracy"
                        value={qualityMetrics.precision}
                        subtext="Detections correctly identified"
                        icon={<AimOutlined />}
                        color="#1890ff"
                    />
                </Col>
                <Col xs={24} md={8}>
                    <CustomMetric
                        title="Model Recall"
                        value={qualityMetrics.recall}
                        subtext="Actual objects captured by AI"
                        icon={<LineChartOutlined />}
                        color="#722ed1"
                    />
                </Col>
                <Col xs={24} md={8}>
                    <CustomMetric
                        title="F1 Performance"
                        value={qualityMetrics.f1}
                        subtext="Overall balance of P & R"
                        icon={<SafetyCertificateOutlined />}
                        color="#52c41a"
                    />
                </Col>
            </Row>

            <div style={{ marginTop: '32px' }}>
                <Title level={5} style={{ marginBottom: '16px', color: '#262626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '16px', background: '#1890ff', borderRadius: '4px' }} />
                    Diagnostic Metrics
                </Title>

                <Row gutter={[16, 16]}>
                    <Col xs={24} md={14}>
                        <Card size="small" title={<span style={{ fontSize: '0.85rem', color: '#595959' }}>DETECTION ERROR BREAKDOWN</span>} style={{ borderRadius: '12px', border: '1px solid #f0f0f0' }}>
                            <Row gutter={16}>
                                <Col span={12} style={{ textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
                                    <Paragraph style={{ margin: 0, color: '#8c8c8c', fontSize: '0.75rem' }}>FALSE POSITIVES</Paragraph>
                                    <Title level={2} style={{ margin: '8px 0', color: '#ff4d4f', fontWeight: 700 }}>{qualityMetrics.falsePositives}</Title>
                                    <Tag bordered={false} color="error" style={{ fontSize: '10px', borderRadius: '4px' }}>HALLUCINATIONS</Tag>
                                </Col>
                                <Col span={12} style={{ textAlign: 'center' }}>
                                    <Paragraph style={{ margin: 0, color: '#8c8c8c', fontSize: '0.75rem' }}>MISSED OBJECTS</Paragraph>
                                    <Title level={2} style={{ margin: '8px 0', color: '#faad14', fontWeight: 700 }}>{qualityMetrics.missedObjects}</Title>
                                    <Tag bordered={false} color="warning" style={{ fontSize: '10px', borderRadius: '4px' }}>FALSE NEGATIVES</Tag>
                                </Col>
                            </Row>
                        </Card>
                    </Col>

                    <Col xs={24} md={10}>
                        <Card size="small" title={<span style={{ fontSize: '0.85rem', color: '#595959' }}>GEOMETRIC ACCURACY</span>} style={{ borderRadius: '12px', border: '1px solid #f0f0f0', height: '100%' }}>
                            <div style={{ padding: '8px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <Text style={{ color: '#595959', fontSize: '0.85rem' }}>Average IoU</Text>
                                    <Text strong style={{ color: '#13c2c2' }}>{qualityMetrics.avgIoU}</Text>
                                </div>
                                <Progress percent={qualityMetrics.avgIoU * 100} size="small" strokeColor="#13c2c2" showInfo={false} strokeWidth={8} />
                                <Paragraph style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '12px', lineHeight: '1.4' }}>
                                    Mean overlap accuracy between predictions and ground truth. High values indicate precise bounding boxes.
                                </Paragraph>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default QualityView;
