import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Row, Col, Card, Statistic, Typography, Divider, Table, Tabs, Empty, Progress, Tag, Alert } from 'antd';
import {
    BarChartOutlined,
    PieChartOutlined,
    DotChartOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    LineChartOutlined,
    FileTextOutlined,
    FundOutlined,
    TrophyOutlined,
    RiseOutlined,
    FallOutlined,
    MinusOutlined,
    WarningOutlined,
    BulbOutlined,
    SafetyOutlined
} from '@ant-design/icons';
import './AnalyticsModal.css';
import QualityView from './AnalyticsViews/QualityView';
import ChartsView from './AnalyticsViews/ChartsView';
import ReportView from './AnalyticsViews/ReportView';
import { mergeModelLabGuideState } from '../modellabGuideState';

const { Title, Text, Paragraph } = Typography;

/**
 * AnalyticsModal Component
 * 
 * Premium analytics dashboard with 4 tabs
 */
const AnalyticsModal = ({ visible, onCancel, training, experiment, verifications = [], projectLabels = [], trainingClasses = [] }) => {
    const [activeTab, setActiveTab] = useState('overview');

    const prevVisibleRef = React.useRef(false);
    useEffect(() => {
        if (!visible) { prevVisibleRef.current = false; return; }
        const justOpened = !prevVisibleRef.current;
        prevVisibleRef.current = true;
        mergeModelLabGuideState({
            predictionAnalyticsOpen: true,
            activePredictionAnalyticsTab: activeTab,
            stateKey: `modellab-prediction-analytics-${activeTab}`,
        }, justOpened ? { forceRefresh: true } : {});
    }, [visible, activeTab]);

    // Calculate insights - with safety checks
    const insights = useMemo(() => {
        if (!experiment || !experiment.analytics_summary) return null;

        const summary = experiment.analytics_summary;
        const {
            total_detections = 0,
            images_with_detections = 0,
            images_without_detections = 0,
            confidence_distribution = {}
        } = summary;

        const coveragePercent = experiment.image_count ? Math.round((images_with_detections / experiment.image_count) * 100) : 0;
        const highConfCount = Object.entries(confidence_distribution)
            .filter(([range]) => range.includes('0.7') || range.includes('0.8') || range.includes('0.9') || range.includes('1.0'))
            .reduce((sum, [_, count]) => sum + count, 0);
        const highConfPercent = total_detections ? Math.round((highConfCount / total_detections) * 100) : 0;

        return {
            coverage: coveragePercent,
            highConfidence: highConfPercent,
            lowCoverage: coveragePercent < 70,
            goodConfidence: highConfPercent >= 60,
            hasGaps: images_without_detections > 0
        };
    }, [experiment]);

    // Early return AFTER all hooks
    if (!experiment || !experiment.analytics_summary) return null;

    const summary = experiment.analytics_summary;
    const {
        total_detections = 0,
        avg_confidence = 0,
        avg_detections_per_image = 0,
        classes_detected = {},
        images_with_detections = 0,
        images_without_detections = 0,
        confidence_distribution = {}
    } = summary;

    // Prepare class data with visual progress
    const classData = Object.entries(classes_detected).map(([name, count], index) => {
        const percentNum = ((count / total_detections) * 100);
        return {
            key: index,
            class: name,
            count: count,
            percent: percentNum.toFixed(1),
            percentNum: percentNum
        };
    });

    const classColumns = [
        {
            title: 'Class Name',
            dataIndex: 'class',
            key: 'class',
            render: (text) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
                    }} />
                    <Text strong style={{ fontSize: '0.9rem' }}>{text}</Text>
                </div>
            )
        },
        {
            title: 'Detections',
            dataIndex: 'count',
            key: 'count',
            sorter: (a, b) => a.count - b.count,
            render: (count) => <Tag color="blue" style={{ fontWeight: 600 }}>{count.toLocaleString()}</Tag>
        },
        {
            title: 'Distribution',
            dataIndex: 'percent',
            key: 'percent',
            render: (percent, record) => (
                <div style={{ minWidth: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <Text strong style={{ fontSize: '0.85rem' }}>{percent}%</Text>
                    </div>
                    <Progress
                        percent={record.percentNum}
                        size="small"
                        strokeColor={{
                            '0%': '#1890ff',
                            '100%': '#096dd9'
                        }}
                        showInfo={false}
                    />
                </div>
            )
        }
    ];

    // Premium Metric Card Component
    const PremiumMetricCard = ({ title, value, suffix, icon, gradient, trend, insight }) => (
        <Card className="premium-metric-card" style={{ background: gradient }}>
            <div className="metric-icon">{icon}</div>
            <div className="metric-content">
                <Text className="metric-title">{title}</Text>
                <div className="metric-value-row">
                    <span className="metric-value">{value}</span>
                    {suffix && <span className="metric-suffix">{suffix}</span>}
                </div>
                {trend && (
                    <div className="metric-trend">
                        {trend.direction === 'up' && <RiseOutlined style={{ color: '#52c41a' }} />}
                        {trend.direction === 'down' && <FallOutlined style={{ color: '#ff4d4f' }} />}
                        {trend.direction === 'same' && <MinusOutlined style={{ color: '#faad14' }} />}
                        <Text className="trend-text" style={{
                            color: trend.direction === 'up' ? '#52c41a' : trend.direction === 'down' ? '#ff4d4f' : '#faad14'
                        }}>
                            {trend.text}
                        </Text>
                    </div>
                )}
                {insight && <Text className="metric-insight">{insight}</Text>}
            </div>
        </Card>
    );

    // Overview Tab
    const renderOverview = () => (
        <div className="analytics-tab-content">
            {/* Premium Metric Cards */}
            <Row gutter={[16, 16]} className="premium-metrics-row">
                <Col xs={24} sm={12} md={6} lg={6}>
                    <PremiumMetricCard
                        title="TOTAL DETECTIONS"
                        value={total_detections}
                        suffix="objects"
                        icon={<DotChartOutlined />}
                        gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        insight={total_detections > 100 ? "Great volume!" : "Consider more images"}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={6}>
                    <PremiumMetricCard
                        title="AVG CONFIDENCE"
                        value={(avg_confidence * 100).toFixed(1)}
                        suffix="%"
                        icon={<CheckCircleOutlined />}
                        gradient="linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)"
                        insight={avg_confidence > 0.7 ? "Strong confidence!" : "Needs review"}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={6}>
                    <PremiumMetricCard
                        title="COVERAGE"
                        value={`${images_with_detections}/${experiment.image_count}`}
                        suffix={`${insights.coverage}%`}
                        icon={<SafetyOutlined />}
                        gradient="linear-gradient(135deg, #9D50BB 0%, #6E48AA 100%)"
                        insight={insights.lowCoverage ? "⚠️ Low coverage!" : "✅ Good coverage"}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={6}>
                    <PremiumMetricCard
                        title="DENSITY"
                        value={avg_detections_per_image.toFixed(2)}
                        suffix="dets/img"
                        icon={<FundOutlined />}
                        gradient="linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 100%)"
                        insight="Distribution metric"
                    />
                </Col>
            </Row>

            {/* Smart Insights Box */}
            <Alert
                message="🎯 Smart Insights"
                description={
                    <div className="insights-list">
                        {insights.goodConfidence && (
                            <div className="insight-item">
                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                <Text>Strong: {insights.highConfidence}% detections have &gt;70% confidence</Text>
                            </div>
                        )}
                        {insights.hasGaps && (
                            <div className="insight-item">
                                <WarningOutlined style={{ color: '#faad14' }} />
                                <Text>Alert: {images_without_detections} images had no detections</Text>
                            </div>
                        )}
                        {insights.coverage >= 90 && (
                            <div className="insight-item">
                                <TrophyOutlined style={{ color: '#1890ff' }} />
                                <Text>Excellent coverage: {insights.coverage}% of images have detections!</Text>
                            </div>
                        )}
                        {!insights.goodConfidence && (
                            <div className="insight-item">
                                <BulbOutlined style={{ color: '#722ed1' }} />
                                <Text>Tip: Consider retraining with more labeled examples</Text>
                            </div>
                        )}
                    </div>
                }
                type="info"
                showIcon={false}
                style={{ marginTop: '1rem', marginBottom: '1rem' }}
                className="insights-alert"
            />

            <Divider />

            {/* Class Distribution & Confidence Ranges */}
            <Row gutter={[24, 24]}>
                <Col xs={24} sm={24} md={14} lg={14}>
                    <Card
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <PieChartOutlined style={{ color: '#1890ff' }} />
                                <span>Class Distribution</span>
                            </div>
                        }
                        className="distribution-card"
                        extra={
                            <Tag color="blue" style={{ fontWeight: 600 }}>
                                {Object.keys(classes_detected).length} {Object.keys(classes_detected).length === 1 ? 'class' : 'classes'}
                            </Tag>
                        }
                    >
                        <Table
                            dataSource={classData}
                            columns={classColumns}
                            pagination={{ pageSize: 5, size: 'small' }}
                            size="small"
                        />
                    </Card>
                </Col>

                <Col xs={24} sm={24} md={10} lg={10}>
                    <Card
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BarChartOutlined style={{ color: '#52c41a' }} />
                                <span>Confidence Ranges</span>
                            </div>
                        }
                        className="confidence-card"
                    >
                        <div className="conf-dist-list">
                            {Object.entries(confidence_distribution).map(([range, count]) => {
                                const percent = ((count / total_detections) * 100).toFixed(1);
                                const isLow = range.includes('0.0') || range.includes('0.1') || range.includes('0.2');
                                const isMedium = range.includes('0.3') || range.includes('0.4') || range.includes('0.5');
                                return (
                                    <div key={range} className="conf-range-item">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    background: isLow ? '#ff4d4f' : isMedium ? '#faad14' : '#52c41a',
                                                    boxShadow: `0 0 6px ${isLow ? '#ff4d4f40' : isMedium ? '#faad1440' : '#52c41a40'}`
                                                }} />
                                                <Text strong style={{ fontSize: '0.85rem' }}>{range}</Text>
                                            </div>
                                            <Tag color={isLow ? 'red' : isMedium ? 'orange' : 'green'} style={{ fontWeight: 600 }}>
                                                {count} ({percent}%)
                                            </Tag>
                                        </div>
                                        <Progress
                                            percent={parseFloat(percent)}
                                            size="small"
                                            strokeColor={{
                                                '0%': range.includes('0.0') || range.includes('0.1') || range.includes('0.2') ? '#ff4d4f' :
                                                    range.includes('0.3') || range.includes('0.4') || range.includes('0.5') ? '#faad14' :
                                                        '#52c41a',
                                                '100%': range.includes('0.0') || range.includes('0.1') || range.includes('0.2') ? '#ff7875' :
                                                    range.includes('0.3') || range.includes('0.4') || range.includes('0.5') ? '#ffc53d' :
                                                        '#95de64'
                                            }}
                                            showInfo={false}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <Alert
                            message={
                                <Text>
                                    <InfoCircleOutlined /> Peak range: {
                                        Object.entries(confidence_distribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
                                    }
                                </Text>
                            }
                            type="info"
                            showIcon={false}
                            style={{ marginTop: '1rem' }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );


    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    <BarChartOutlined /> Prediction Analytics: <Text strong style={{ color: '#1890ff' }}>{experiment.name}</Text>
                </div>
            }
            visible={visible}
            onCancel={onCancel}
            footer={null}
            width="90vw"
            style={{ maxWidth: '1400px', top: '3vh' }}
            bodyStyle={{
                padding: '0',
                background: 'linear-gradient(to bottom, #f5f7fa 0%, #fafbfc 100%)',
                height: '82vh',
                display: 'flex',
                flexDirection: 'column'
            }}
            destroyOnClose
            className="analytics-modal"
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="small"
                className="analytics-tabs"
            >
                <Tabs.TabPane
                    tab={
                        <span>
                            <FundOutlined />
                            Overview
                        </span>
                    }
                    key="overview"
                >
                    {renderOverview()}
                </Tabs.TabPane>

                <Tabs.TabPane
                    tab={
                        <span>
                            <TrophyOutlined />
                            Quality
                        </span>
                    }
                    key="quality"
                >
                    <QualityView experiment={experiment} />
                </Tabs.TabPane>

                <Tabs.TabPane
                    tab={
                        <span>
                            <LineChartOutlined />
                            Charts
                        </span>
                    }
                    key="charts"
                >
                    <ChartsView
                        experiment={experiment}
                        verifications={verifications}
                        projectLabels={projectLabels}
                        trainingClasses={trainingClasses}
                    />
                </Tabs.TabPane>

                <Tabs.TabPane
                    tab={
                        <span>
                            <FileTextOutlined />
                            Report
                        </span>
                    }
                    key="report"
                >
                    <ReportView
                        experiment={experiment}
                        training={training}
                        verifications={verifications}
                    />
                </Tabs.TabPane>

            </Tabs>
        </Modal>
    );
};

export default AnalyticsModal;
