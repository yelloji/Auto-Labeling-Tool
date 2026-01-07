import React from 'react';
import { Modal, Row, Col, Card, Statistic, Typography, Divider, Table } from 'antd';
import {
    BarChartOutlined,
    PieChartOutlined,
    DotChartOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * AnalyticsModal Component
 * 
 * Displays aggregate performance insights for a completed prediction experiment.
 */
const AnalyticsModal = ({ visible, onCancel, experiment }) => {
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

    return (
        <Modal
            title={<Space><BarChartOutlined /> Prediction Analytics: {experiment.name}</Space>}
            visible={visible}
            onCancel={onCancel}
            footer={null}
            width={900}
            centered
            bodyStyle={{ padding: '1.5rem', background: '#f5f7fa' }}
        >
            <div className="analytics-dashboard">
                {/* 1. Key Metrics Row */}
                <Row gutter={16}>
                    <Col span={6}>
                        <Card size="small" className="metric-card">
                            <Statistic
                                title="Total Detections"
                                value={total_detections}
                                valueStyle={{ color: '#1890ff' }}
                                prefix={<DotChartOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
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
                    <Col span={6}>
                        <Card size="small" className="metric-card">
                            <Statistic
                                title="Images w/ Hits"
                                value={images_with_detections}
                                suffix={`/ ${experiment.image_count}`}
                                valueStyle={{ color: '#722ed1' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
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

                <Row gutter={24}>
                    {/* 2. Class Distribution Table */}
                    <Col span={14}>
                        <Card title={<Space><PieChartOutlined /> Class Distribution</Space>} size="small">
                            <Table
                                dataSource={classData}
                                columns={classColumns}
                                pagination={{ pageSize: 5 }}
                                size="small"
                            />
                        </Card>
                    </Col>

                    {/* 3. Confidence Distribution */}
                    <Col span={10}>
                        <Card title={<Space><BarChartOutlined /> Confidence Ranges</Space>} size="small">
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
                                        Object.entries(confidence_distribution).sort((a, b) => b[1] - a[1])[0][0]
                                    } range.
                                </Text>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        </Modal>
    );
};

const Space = ({ children }) => <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{children}</div>;

export default AnalyticsModal;
