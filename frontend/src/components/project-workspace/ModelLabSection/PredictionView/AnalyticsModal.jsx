import React, { useState } from 'react';
import { Modal, Row, Col, Card, Statistic, Typography, Divider, Table, Tabs, Empty } from 'antd';
import {
    BarChartOutlined,
    PieChartOutlined,
    DotChartOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    LineChartOutlined,
    FileTextOutlined,
    DownloadOutlined,
    FundOutlined,
    TrophyOutlined
} from '@ant-design/icons';
import './AnalyticsModal.css';

const { Title, Text, Paragraph } = Typography;

/**
 * AnalyticsModal Component
 * 
 * Comprehensive analytics dashboard with 5 tabs:
 * - Overview: Key metrics and distributions (current content)
 * - Quality: Performance analysis (precision, recall, FP rate) [Coming soon]
 * - Charts: Visual data exploration [Coming soon]
 * - Report: Executive summary [Coming soon]
 * - Export: Share and download capabilities [Coming soon]
 * 
 * Fully responsive design that adapts to any screen size
 */
const AnalyticsModal = ({ visible, onCancel, experiment }) => {
    const [activeTab, setActiveTab] = useState('overview');

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

    // Prepare chart data for classes detected
    const classData = Object.entries(classes_detected).map(([name, count], index) => ({
        key: index,
        class: name,
        count: count,
        percent: ((count / total_detections) * 100).toFixed(1) + '%'
    }));

    const classColumns = [
        { title: 'Class Name', dataIndex: 'class', key: 'class' },
        { title: 'Count', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
        { title: 'Distribution', dataIndex: 'percent', key: 'percent' }
    ];

    // Overview Tab (existing content)
    const renderOverview = () => (
        <div className="analytics-tab-content">
            {/* Key Metrics Row */}
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={12} md={6} lg={6}>
                    <Card size="small" className="metric-card">
                        <Statistic
                            title="Total Detections"
                            value={total_detections}
                            valueStyle={{ color: '#1890ff' }}
                            prefix={<DotChartOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6}>
                    <Card size="small" className="metric-card">
                        <Statistic
                            title="Avg Confidence"
                            value={avg_confidence * 100}
                            precision={1}
                            suffix="%"
                            valueStyle={{ color: '#52c41a' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6}>
                    <Card size="small" className="metric-card">
                        <Statistic
                            title="Images w/ Hits"
                            value={images_with_detections}
                            suffix={`/ ${experiment.image_count}`}
                            valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6}>
                    <Card size="small" className="metric-card">
                        <Statistic
                            title="Detections/Img"
                            value={avg_detections_per_image}
                            precision={2}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Divider />

            {/* Class Distribution & Confidence Ranges */}
            <Row gutter={[24, 24]}>
                <Col xs={24} sm={24} md={14} lg={14}>
                    <Card
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <PieChartOutlined /> Class Distribution
                            </div>
                        }
                        size="small"
                        className="distribution-card"
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
                                <BarChartOutlined /> Confidence Ranges
                            </div>
                        }
                        size="small"
                        className="confidence-card"
                    >
                        <div className="conf-dist-list">
                            {Object.entries(confidence_distribution).map(([range, count]) => (
                                <div key={range} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <Text type="secondary">{range}:</Text>
                                    <Text strong>{count} objects</Text>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#e6f7ff', borderRadius: '0.25rem' }}>
                            <Text size="small" type="secondary">
                                <InfoCircleOutlined /> Most objects were detected in the {
                                    Object.entries(confidence_distribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
                                } range.
                            </Text>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );

    // Quality Tab (placeholder)
    const renderQuality = () => (
        <div className="analytics-tab-content">
            <Empty
                image={<TrophyOutlined style={{ fontSize: '64px', color: '#1890ff' }} />}
                description={
                    <div>
                        <Title level={4}>Quality Analysis Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will show:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>Precision & Recall metrics</li>
                                <li>False Positive analysis by class and size</li>
                                <li>Missed detections breakdown</li>
                                <li>Human verification progress</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );

    // Charts Tab (placeholder)
    const renderCharts = () => (
        <div className="analytics-tab-content">
            <Empty
                image={<LineChartOutlined style={{ fontSize: '64px', color: '#52c41a' }} />}
                description={
                    <div>
                        <Title level={4}>Visual Charts Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will show:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>Confidence distribution histogram</li>
                                <li>Class balance pie chart</li>
                                <li>Size distribution bar chart</li>
                                <li>FP rate comparison charts</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );

    // Report Tab (placeholder)
    const renderReport = () => (
        <div className="analytics-tab-content">
            <Empty
                image={<FileTextOutlined style={{ fontSize: '64px', color: '#722ed1' }} />}
                description={
                    <div>
                        <Title level={4}>Executive Report Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will show:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>AI-generated summary narrative</li>
                                <li>Strengths & weaknesses analysis</li>
                                <li>Actionable recommendations</li>
                                <li>Detailed performance breakdown</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );

    // Export Tab (placeholder)
    const renderExport = () => (
        <div className="analytics-tab-content">
            <Empty
                image={<DownloadOutlined style={{ fontSize: '64px', color: '#faad14' }} />}
                description={
                    <div>
                        <Title level={4}>Export Options Coming Soon!</Title>
                        <Paragraph type="secondary">
                            This tab will offer:
                            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                                <li>PDF report generation</li>
                                <li>CSV data export</li>
                                <li>Chart pack download</li>
                                <li>Share link creation</li>
                            </ul>
                        </Paragraph>
                    </div>
                }
            />
        </div>
    );

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChartOutlined /> Prediction Analytics: {experiment.name}
                </div>
            }
            visible={visible}
            onCancel={onCancel}
            footer={null}
            width="90vw"
            style={{ maxWidth: '1400px', top: '3vh' }}
            bodyStyle={{
                padding: '1rem',
                background: '#f5f7fa',
                height: '82vh',
                overflowY: 'auto'
            }}
            destroyOnClose
            className="analytics-modal"
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="large"
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
                    {renderQuality()}
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
                    {renderCharts()}
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
                    {renderReport()}
                </Tabs.TabPane>

                <Tabs.TabPane
                    tab={
                        <span>
                            <DownloadOutlined />
                            Export
                        </span>
                    }
                    key="export"
                >
                    {renderExport()}
                </Tabs.TabPane>
            </Tabs>
        </Modal>
    );
};

export default AnalyticsModal;
