import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Typography, Progress, Tag, Divider, Empty, Skeleton, Space } from 'antd';
import {
    AimOutlined,
    LineChartOutlined,
    SafetyCertificateOutlined,
    InfoCircleOutlined,
    ExclamationCircleOutlined,
    ScanOutlined,
    RadarChartOutlined,
    SearchOutlined
} from '@ant-design/icons';
import { projectsAPI } from '../../../../../services/api';

const { Title, Text, Paragraph } = Typography;

/**
 * AnimatedNumber Component
 * Provides a "Pro Max" feel with smooth value counting on load
 */
const AnimatedNumber = ({ value, suffix = "", decimal = 1 }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = parseFloat(value) || 0;
        if (start === end) return;

        let totalDuration = 1000;
        let increment = end / (totalDuration / 16);

        let timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setDisplayValue(end.toFixed(decimal));
                clearInterval(timer);
            } else {
                setDisplayValue(start.toFixed(decimal));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [value, decimal]);

    return <span>{displayValue}{suffix}</span>;
};

/**
 * LuxuryMetricCard Component
 * Matches the main Analytics dashboard but with specialized diagnostic polish
 */
const LuxuryMetricCard = ({ title, value, suffix, icon, gradient, insight }) => (
    <Card className="premium-metric-card" style={{ background: gradient }}>
        <div className="metric-icon" style={{ opacity: 0.2 }}>{icon}</div>
        <div className="metric-content">
            <Text className="metric-title" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '1.5px' }}>{title}</Text>
            <div className="metric-value-row">
                <span className="metric-value" style={{ fontSize: '2.8rem' }}>
                    <AnimatedNumber value={value} decimal={1} />
                </span>
                <span className="metric-suffix" style={{ fontSize: '1.2rem', opacity: 0.8 }}>{suffix}</span>
            </div>
            {insight && (
                <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                    <Text style={{ color: '#fff', fontSize: '11px', fontWeight: 500 }}>{insight}</Text>
                </div>
            )}
        </div>
    </Card>
);

const QualityView = ({ experiment }) => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const [error, setError] = useState(null);

    const hasGroundTruth = experiment?.dataset_source && experiment.dataset_source !== 'upload';

    useEffect(() => {
        if (hasGroundTruth && experiment?.id) {
            fetchStats();
        } else {
            setLoading(false);
        }
    }, [experiment?.id, hasGroundTruth]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await projectsAPI.getQualityStats(experiment.id);
            if (data.has_ground_truth) {
                setMetrics(data);
            } else {
                setError(data.error || "Quality stats unavailable");
            }
        } catch (err) {
            setError("Analytics communication failure");
        } finally {
            setLoading(false);
        }
    };

    if (!hasGroundTruth) {
        return (
            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <Empty
                    image={<ScanOutlined style={{ fontSize: '80px', color: '#1890ff', opacity: 0.2 }} />}
                    description={
                        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                            <Title level={3} style={{ color: '#262626', fontWeight: 700 }}>Diagnostic Data Locked</Title>
                            <Paragraph style={{ color: '#8c8c8c', fontSize: '1rem' }}>
                                To unlock **Precision**, **Recall**, and **Geometric Accuracy**, you must evaluate the model against a labeled dataset.
                            </Paragraph>
                            <Divider dashed />
                            <div style={{ textAlign: 'left', background: '#f8faff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e6f0ff' }}>
                                <Text strong style={{ color: '#1890ff', display: 'block', marginBottom: '1rem', size: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>System Requirements:</Text>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ background: '#e6f7ff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: '#1890ff', fontSize: '12px' }}>1</Text>
                                        </div>
                                        <Text style={{ color: '#595959' }}>Use a split dataset (e.g. <b>Val</b> or <b>Test</b>)</Text>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ background: '#e6f7ff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: '#1890ff', fontSize: '12px' }}>2</Text>
                                        </div>
                                        <Text style={{ color: '#595959' }}>Ensure images have existing Ground Truth labels</Text>
                                    </div>
                                </Space>
                            </div>
                        </div>
                    }
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: '24px' }}>
                <Row gutter={[16, 16]}>
                    {[1, 2, 3].map(i => (
                        <Col span={8} key={i}>
                            <Skeleton.Button active block style={{ height: '150px', borderRadius: '16px' }} />
                        </Col>
                    ))}
                </Row>
                <div style={{ marginTop: '32px' }}>
                    <Skeleton active paragraph={{ rows: 6 }} />
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '16px' }}>
            {/* Primary KPI Row - Modern Luxury Style */}
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <LuxuryMetricCard
                        title="PRECISION"
                        value={metrics?.precision || 0}
                        suffix="%"
                        icon={<AimOutlined />}
                        gradient="linear-gradient(135deg, #1890ff 0%, #001529 120%)"
                        insight={metrics?.precision > 70 ? "🎯 High identification accuracy" : "🔭 Potential for False Positives"}
                    />
                </Col>
                <Col xs={24} md={8}>
                    <LuxuryMetricCard
                        title="RECALL"
                        value={metrics?.recall || 0}
                        suffix="%"
                        icon={<RadarChartOutlined />}
                        gradient="linear-gradient(135deg, #722ed1 0%, #001529 120%)"
                        insight={metrics?.recall > 70 ? "⚡ Good object capture" : "🔍 Missing too many objects"}
                    />
                </Col>
                <Col xs={24} md={8}>
                    <LuxuryMetricCard
                        title="F1 SCORE"
                        value={metrics?.f1 || 0}
                        suffix="%"
                        icon={<SafetyCertificateOutlined />}
                        gradient="linear-gradient(135deg, #52c41a 0%, #001529 120%)"
                        insight="Balanced Performance Index"
                    />
                </Col>
            </Row>

            <div style={{ marginTop: '32px' }}>
                <Title level={5} style={{ marginBottom: '16px', color: '#262626', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SearchOutlined style={{ color: '#1890ff' }} />
                    <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '13px', fontWeight: 700 }}>Deep Diagnostics</span>
                </Title>

                <Row gutter={[12, 12]} style={{ alignItems: 'stretch', width: '100%', margin: 0 }}>
                    <Col xs={24} md={12} style={{ display: 'flex', padding: '6px' }}>
                        <Card
                            className="glass-diagnostic-card"
                            title={
                                <Space size="small">
                                    <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '14px' }} />
                                    <span style={{ fontSize: '11px', color: '#8c8c8c', letterSpacing: '1px', fontWeight: 600 }}>ERROR VECTOR ANALYSIS</span>
                                </Space>
                            }
                            headStyle={{ borderBottom: '1px solid #f0f0f0', minHeight: '44px', padding: '0 16px' }}
                            bodyStyle={{ padding: '24px', flex: 1, display: 'flex' }}
                            style={{ width: '100%' }}
                        >
                            <Row gutter={16} style={{ width: '100%', margin: 0 }}>
                                <Col span={12} style={{ textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', padding: '0 8px' }}>
                                    <div className="glass-inset-container" style={{ padding: '20px' }}>
                                        <Text style={{ color: '#8c8c8c', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px', fontWeight: 600 }}>False Positives</Text>
                                        <Title level={2} style={{ margin: '0', color: '#ff4d4f', fontWeight: 800, lineHeight: 1 }}>
                                            <AnimatedNumber value={metrics?.false_positives || 0} decimal={0} />
                                        </Title>
                                        <div style={{ marginTop: '16px' }}>
                                            <Tag color="#ff4d4f10" bordered={false} style={{ borderRadius: '4px', fontSize: '10px', fontWeight: 700, padding: '2px 10px', color: '#cf1322' }}>HALLUCINATIONS</Tag>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', padding: '0 8px' }}>
                                    <div className="glass-inset-container" style={{ padding: '20px' }}>
                                        <Text style={{ color: '#8c8c8c', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Missed Objects</Text>
                                        <Title level={2} style={{ margin: '0', color: '#faad14', fontWeight: 800, lineHeight: 1 }}>
                                            <AnimatedNumber value={metrics?.missed_objects || 0} decimal={0} />
                                        </Title>
                                        <div style={{ marginTop: '16px' }}>
                                            <Tag color="#fffbe6" bordered={false} style={{ borderRadius: '4px', fontSize: '10px', fontWeight: 700, padding: '2px 10px', color: '#d48806' }}>FALSE NEGATIVES</Tag>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </Col>

                    <Col xs={24} md={12} style={{ display: 'flex', padding: '6px' }}>
                        <Card
                            className="glass-diagnostic-card"
                            title={
                                <Space size="small">
                                    <RadarChartOutlined style={{ color: '#13c2c2', fontSize: '14px' }} />
                                    <span style={{ fontSize: '11px', color: '#8c8c8c', letterSpacing: '1px', fontWeight: 600 }}>GEOMETRIC ACCURACY</span>
                                </Space>
                            }
                            headStyle={{ borderBottom: '1px solid #f0f0f0', minHeight: '44px', padding: '0 16px' }}
                            bodyStyle={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                            style={{ width: '100%' }}
                        >
                            <div className="luxury-scan-container" style={{ width: '100%', padding: '24px' }}>
                                <div className="luxury-scan-line" />
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px', alignItems: 'baseline' }}>
                                    <Text strong style={{ color: '#00474f', fontSize: '1.1rem' }}>Average IoU</Text>
                                    <div style={{ textAlign: 'right', flex: 1 }}>
                                        <Text className="status-value-mono" style={{ color: '#13c2c2', fontSize: '1.4rem', fontWeight: 800 }}>
                                            {(metrics?.avg_iou || 0).toFixed(2)}
                                        </Text>
                                    </div>
                                </div>
                                <div style={{ width: '100%' }}>
                                    <Progress
                                        percent={(metrics?.avg_iou || 0) * 100}
                                        strokeColor="#13c2c2"
                                        showInfo={false}
                                        strokeWidth={12}
                                        strokeLinecap="round"
                                        style={{ width: '100%', display: 'block' }}
                                    />
                                </div>
                                <Paragraph style={{ fontSize: '11px', color: '#595959', marginTop: '20px', lineHeight: '1.5', italic: true, marginBottom: 0 }}>
                                    The "Laser Scan" confirms the mathematical overlap between AI boxes and human ground truth.
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
