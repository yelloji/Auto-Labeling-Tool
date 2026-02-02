import React, { useMemo } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Button, Divider, Space } from 'antd';
import {
    DownloadOutlined,
    DatabaseOutlined,
    ExperimentOutlined,
    AimOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * ReportView Component
 * 
 * Clean, organized Training Report with:
 * - Dataset Details
 * - Training Metrics (Box + Mask for Segmentation)
 * - Class-wise Performance
 * - All with simple English explanations
 */
const ReportView = ({ experiment, training, verifications = [] }) => {

    // --- DATA EXTRACTION ---
    const reportData = useMemo(() => {
        if (!training) return null;

        // Parse metrics
        let metrics = {};
        try {
            metrics = typeof training.metrics === 'string'
                ? JSON.parse(training.metrics)
                : (training.metrics || {});
        } catch (e) { }

        // Parse config snapshot
        let config = {};
        try {
            if (typeof training.training_config_snapshot === 'string') {
                const lines = training.training_config_snapshot.split('\n');
                lines.forEach(line => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        const key = line.substring(0, colonIndex).trim();
                        const value = line.substring(colonIndex + 1).trim();
                        if (key && value !== 'null') config[key] = value;
                    }
                });
            } else {
                config = training.training_config_snapshot || {};
            }
        } catch (e) { }

        const validation = metrics.validation || {};
        const classes = metrics.classes || [];
        const isSeg = training.taskType === 'segmentation';

        // Calculate F1
        const calcF1 = (p, r) => (p && r) ? (2 * p * r) / (p + r) : 0;

        return {
            // Basic Info
            name: training.name,
            taskType: isSeg ? 'Instance Segmentation' : 'Object Detection',
            status: training.status,
            date: new Date(training.date).toLocaleDateString(),
            isSeg,

            // Dataset Details
            dataset: {
                trainingImages: validation.images || 0,
                totalInstances: validation.instances || 0,
                imageSize: config.imgsz || 640,
                epochs: training.epochs || config.epochs || 0,
                classCount: classes.length || 0,
                classNames: classes.map(c => c.class).join(', ') || 'N/A'
            },

            // Box Metrics
            box: {
                precision: validation.box_p || 0,
                recall: validation.box_r || 0,
                f1: calcF1(validation.box_p, validation.box_r),
                map50: validation.box_map50 || 0,
                map5095: validation.box_map50_95 || 0
            },

            // Mask Metrics (only for segmentation)
            mask: isSeg ? {
                precision: validation.mask_p || 0,
                recall: validation.mask_r || 0,
                f1: calcF1(validation.mask_p, validation.mask_r),
                map50: validation.mask_map50 || 0,
                map5095: validation.mask_map50_95 || 0
            } : null,

            // Class-wise data
            classes: classes.map((cls, idx) => ({
                key: idx,
                class: cls.class,
                box_p: cls.box_p,
                box_r: cls.box_r,
                box_f1: calcF1(cls.box_p, cls.box_r),
                box_map50: cls.box_map50,
                mask_p: isSeg ? cls.mask_p : null,
                mask_r: isSeg ? cls.mask_r : null,
                mask_f1: isSeg ? calcF1(cls.mask_p, cls.mask_r) : null
            })),

            // Config for display
            config: {
                batch: config.batch || 16,
                lr0: config.lr0 || '0.01',
                optimizer: config.optimizer || 'Auto'
            }
        };
    }, [training]);

    if (!reportData) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Text type="secondary">Select a training to view the report</Text>
            </div>
        );
    }

    // --- HELPER: Format percentage ---
    const toPercent = (val) => val ? `${(val * 100).toFixed(1)}%` : 'N/A';

    // --- METRIC CARD COMPONENT ---
    const MetricCard = ({ title, value, explanation, color = '#1890ff' }) => (
        <Card size="small" className="metric-card-report" style={{ textAlign: 'center', height: '100%' }}>
            <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                {title}
            </Text>
            <Title level={2} style={{ margin: 0, color }}>{value}</Title>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                {explanation}
            </Text>
        </Card>
    );

    // --- DATASET DETAILS TABLE ---
    const datasetColumns = [
        { title: 'Item', dataIndex: 'item', key: 'item', width: '30%' },
        { title: 'Value', dataIndex: 'value', key: 'value', width: '25%', render: (v) => <Text strong>{v}</Text> },
        { title: 'What it means', dataIndex: 'explanation', key: 'explanation' }
    ];

    const datasetRows = [
        { key: 1, item: 'Training Epochs', value: reportData.dataset.epochs, explanation: `The AI studied the data ${reportData.dataset.epochs} times to learn.` },
        { key: 2, item: 'Validation Images', value: reportData.dataset.trainingImages, explanation: 'Number of images used to test the AI after training.' },
        { key: 3, item: 'Total Instances', value: reportData.dataset.totalInstances, explanation: 'Total number of labeled objects in the validation set.' },
        { key: 4, item: 'Image Size', value: `${reportData.dataset.imageSize}px`, explanation: `All images were resized to ${reportData.dataset.imageSize}×${reportData.dataset.imageSize} pixels.` },
        { key: 5, item: 'Classes', value: reportData.dataset.classCount, explanation: reportData.dataset.classNames }
    ];

    // --- CLASS-WISE TABLE ---
    const classColumns = [
        { title: 'Class', dataIndex: 'class', key: 'class', render: (v) => <Text strong>{v}</Text> },
        { title: 'Box Precision', dataIndex: 'box_p', key: 'box_p', render: toPercent },
        { title: 'Box Recall', dataIndex: 'box_r', key: 'box_r', render: toPercent },
        { title: 'Box F1', dataIndex: 'box_f1', key: 'box_f1', render: toPercent },
        { title: 'Box mAP@50', dataIndex: 'box_map50', key: 'box_map50', render: (v) => v?.toFixed(3) || 'N/A' }
    ];

    // Add mask columns for segmentation
    if (reportData.isSeg) {
        classColumns.push(
            { title: 'Mask Precision', dataIndex: 'mask_p', key: 'mask_p', render: toPercent },
            { title: 'Mask Recall', dataIndex: 'mask_r', key: 'mask_r', render: toPercent },
            { title: 'Mask F1', dataIndex: 'mask_f1', key: 'mask_f1', render: toPercent }
        );
    }

    return (
        <div className="report-view-container" style={{ padding: '24px', background: '#fff' }}>
            {/* HEADER */}
            <div className="report-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>{reportData.name}</Title>
                    <Space style={{ marginTop: '8px' }}>
                        <Tag color="blue">{reportData.taskType}</Tag>
                        <Tag color={reportData.status === 'completed' ? 'green' : 'default'}>{reportData.status?.toUpperCase()}</Tag>
                        <Text type="secondary">{reportData.date}</Text>
                    </Space>
                </div>
                <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.print()}>
                    Export Report
                </Button>
            </div>

            <Divider />

            {/* SECTION 1: DATASET DETAILS */}
            <div className="report-section" style={{ marginBottom: '3rem' }}>
                <Space align="center" style={{ marginBottom: '1rem' }}>
                    <DatabaseOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                    <Title level={4} style={{ margin: 0 }}>Dataset Details</Title>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
                    Information about the data used to train and validate this model.
                </Text>
                <Table
                    dataSource={datasetRows}
                    columns={datasetColumns}
                    pagination={false}
                    size="small"
                    bordered
                />
            </div>

            {/* SECTION 2: BOX DETECTION METRICS */}
            <div className="report-section" style={{ marginBottom: '3rem' }}>
                <Space align="center" style={{ marginBottom: '1rem' }}>
                    <AimOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
                    <Title level={4} style={{ margin: 0 }}>Box Detection Metrics</Title>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
                    How well the AI draws boxes around objects. Higher values = better performance.
                </Text>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <MetricCard
                            title="Precision"
                            value={toPercent(reportData.box.precision)}
                            explanation={`${Math.round(reportData.box.precision * 100)} out of 100 detections were correct.`}
                            color="#52c41a"
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <MetricCard
                            title="Recall"
                            value={toPercent(reportData.box.recall)}
                            explanation={`The AI found ${Math.round(reportData.box.recall * 100)} out of 100 real objects.`}
                            color="#1890ff"
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <MetricCard
                            title="F1 Score"
                            value={toPercent(reportData.box.f1)}
                            explanation="Balance between precision and recall."
                            color="#722ed1"
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <MetricCard
                            title="mAP@50"
                            value={reportData.box.map50?.toFixed(3) || 'N/A'}
                            explanation="Average accuracy of box placement."
                            color="#fa8c16"
                        />
                    </Col>
                </Row>
            </div>

            {/* SECTION 3: MASK SEGMENTATION METRICS (Only for Segmentation) */}
            {reportData.isSeg && reportData.mask && (
                <div className="report-section" style={{ marginBottom: '3rem' }}>
                    <Space align="center" style={{ marginBottom: '1rem' }}>
                        <ExperimentOutlined style={{ fontSize: '20px', color: '#13c2c2' }} />
                        <Title level={4} style={{ margin: 0 }}>Mask Segmentation Metrics</Title>
                    </Space>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
                        How well the AI draws pixel-perfect masks around objects.
                    </Text>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                            <MetricCard
                                title="Mask Precision"
                                value={toPercent(reportData.mask.precision)}
                                explanation={`${Math.round(reportData.mask.precision * 100)} out of 100 mask detections were correct.`}
                                color="#13c2c2"
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <MetricCard
                                title="Mask Recall"
                                value={toPercent(reportData.mask.recall)}
                                explanation={`The AI segmented ${Math.round(reportData.mask.recall * 100)} out of 100 real objects.`}
                                color="#1890ff"
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <MetricCard
                                title="Mask F1"
                                value={toPercent(reportData.mask.f1)}
                                explanation="Balance between mask precision and recall."
                                color="#722ed1"
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <MetricCard
                                title="Mask mAP@50"
                                value={reportData.mask.map50?.toFixed(3) || 'N/A'}
                                explanation="Average accuracy of mask placement."
                                color="#fa8c16"
                            />
                        </Col>
                    </Row>
                </div>
            )}

            {/* SECTION 4: CLASS-WISE PERFORMANCE */}
            {reportData.classes.length > 0 && (
                <div className="report-section" style={{ marginBottom: '3rem' }}>
                    <Space align="center" style={{ marginBottom: '1rem' }}>
                        <CheckCircleOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
                        <Title level={4} style={{ margin: 0 }}>Class-wise Performance</Title>
                    </Space>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
                        How well the AI performs for each type of object it was trained to detect.
                    </Text>
                    <Table
                        dataSource={reportData.classes}
                        columns={classColumns}
                        pagination={false}
                        size="small"
                        bordered
                    />
                </div>
            )}

            {/* FOOTER */}
            <div className="report-footer" style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                    Training Report • Generated {new Date().toLocaleString()}
                </Text>
            </div>
        </div>
    );
};

export default ReportView;
