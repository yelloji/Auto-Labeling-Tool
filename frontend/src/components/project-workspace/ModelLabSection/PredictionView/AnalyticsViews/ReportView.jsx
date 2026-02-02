import React, { useMemo } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Button, Divider, Space } from 'antd';
import {
    DownloadOutlined,
    DatabaseOutlined,
    ExperimentOutlined,
    AimOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { projectsAPI } from '../../../../../services/api';

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
    const [qualityStats, setQualityStats] = React.useState(null);
    const isSplit = experiment?.dataset_source && experiment.dataset_source !== 'upload';

    // --- 📡 Fetch Quality Stats (Same as ChartsView) ---
    React.useEffect(() => {
        if (isSplit && experiment?.id) {
            projectsAPI.getQualityStats(experiment.id)
                .then(setQualityStats)
                .catch(err => console.error("Quality fetch failed:", err));
        }
    }, [experiment?.id, isSplit]);


    // --- USE ANALYTICS SUMMARY (Same as Overview Tab) ---
    const predictionAnalytics = useMemo(() => {
        if (!experiment?.analytics_summary) return null;

        const summary = experiment.analytics_summary;
        const {
            total_detections = 0,
            classes_detected = {},
            confidence_distribution = {}
        } = summary;

        // Basic scope
        const predictionImages = experiment.image_count || 0;
        const gtCoverage = qualityStats?.total_gt || 0;

        // Class distribution (same as Overview)
        const classDistribArray = Object.entries(classes_detected).map(([className, count]) => ({
            class: className,
            count,
            percentage: total_detections > 0 ? (count / total_detections * 100) : 0
        })).sort((a, b) => b.count - a.count);

        // Confidence ranges with per-class breakdown
        const confRangesArray = Object.entries(confidence_distribution).map(([range, count]) => ({
            range,
            count,
            percentage: total_detections > 0 ? (count / total_detections * 100) : 0,
            byClass: {} // Will populate below
        })).sort((a, b) => {
            const aMin = parseFloat(a.range.split('-')[0]);
            const bMin = parseFloat(b.range.split('-')[0]);
            return aMin - bMin;
        });

        // Calculate per-class breakdown for each confidence range
        if (experiment?.predictions) {
            Object.values(experiment.predictions).forEach(dets => {
                if (Array.isArray(dets)) {
                    dets.forEach(d => {
                        if (d.confidence !== undefined && d.class) {
                            const conf = d.confidence;
                            const className = d.class;

                            // Find matching range
                            confRangesArray.forEach(rangeObj => {
                                const [min, max] = rangeObj.range.split('-').map(parseFloat);
                                if ((conf >= min && conf < max) || (conf === 1.0 && max === 1.0)) {
                                    rangeObj.byClass[className] = (rangeObj.byClass[className] || 0) + 1;
                                }
                            });
                        }
                    });
                }
            });
        }

        return {
            scope: {
                predictionImages,
                totalDetections: total_detections,
                gtCoverage,
                classDistribution: classDistribArray,
                confidenceRanges: confRangesArray
            }
        };
    }, [experiment, qualityStats]);

    // --- KPIs CALCULATION (Same as ChartsView) ---
    const kpis = useMemo(() => {
        if (!qualityStats?.has_ground_truth) return null;

        // Use backend's detailed lists for TP/FP/FN counts
        const tp = (qualityStats.detailed_true_positives || []).length;
        const fp = (qualityStats.detailed_false_positives || []).length;
        const fn = (qualityStats.detailed_missed_objects || []).length;

        // Calculate precision, recall, F1 (same formula as ChartsView)
        const p = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
        const r = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
        const f1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;

        return {
            tp,
            fp,
            fn,
            precision: p.toFixed(1),  // Already percentage string "32.6"
            recall: r.toFixed(1),     // Already percentage string "56.4"
            f1: f1.toFixed(1)         // Already percentage string "41.4"
        };
    }, [qualityStats]);

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

            {/* ========== TRAINING ANALYTICS DETAIL ========== */}
            <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #f0f0f0' }}>
                <Title level={3} style={{ margin: 0, color: '#722ed1' }}>
                    <ExperimentOutlined /> Training Analytics Detail
                </Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                    Comprehensive analysis of the training process and model performance
                </Text>
            </div>

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

            {/* ========== PREDICTION ANALYTICS DETAIL ========== */}
            <div style={{ marginTop: '4rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #f0f0f0' }}>
                <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                    <AimOutlined /> Prediction Analytics Detail
                </Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                    Real-world performance analysis of model predictions on new data
                </Text>
            </div>


            {/* SECTION 01: PREDICTION SCOPE */}
            <div className="report-section" style={{ marginBottom: '3rem' }}>
                <Space align="center" style={{ marginBottom: '1rem' }}>
                    <DatabaseOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                    <Title level={4} style={{ margin: 0 }}>Section 01: Prediction Analytics Scope</Title>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
                    Coverage details for the current prediction experiment being analyzed.
                </Text>

                {predictionAnalytics ? (
                    <>
                        {/* Scope Metrics */}
                        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        Images Processed
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                                        {predictionAnalytics.scope.predictionImages}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Fresh images in this test run
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        Total Detections
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                                        {predictionAnalytics.scope.totalDetections}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Objects detected by the model
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        GT Coverage
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#722ed1' }}>
                                        {predictionAnalytics.scope.gtCoverage}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Ground truth objects available
                                    </Text>
                                </Card>
                            </Col>
                        </Row>

                        {/* Class Distribution Table */}
                        <Card size="small" title="Class Distribution" style={{ marginBottom: '16px' }}>
                            <Table
                                dataSource={predictionAnalytics.scope.classDistribution}
                                pagination={false}
                                size="small"
                                rowKey="class"
                                columns={[
                                    {
                                        title: 'Class Name',
                                        dataIndex: 'class',
                                        key: 'class',
                                        render: (text) => <Tag color="blue">{text}</Tag>
                                    },
                                    {
                                        title: 'Detections',
                                        dataIndex: 'count',
                                        key: 'count',
                                        align: 'center',
                                        render: (count) => <Text strong>{count}</Text>
                                    },
                                    {
                                        title: 'Distribution',
                                        dataIndex: 'percentage',
                                        key: 'percentage',
                                        align: 'right',
                                        render: (pct) => <Text type="secondary">{pct.toFixed(1)}%</Text>
                                    }
                                ]}
                            />
                        </Card>

                        {/* Confidence Range Breakdown */}
                        <Card size="small" title="Confidence Range Breakdown">
                            <Table
                                dataSource={predictionAnalytics.scope.confidenceRanges}
                                pagination={false}
                                size="small"
                                rowKey="range"
                                columns={[
                                    {
                                        title: 'Confidence Range',
                                        dataIndex: 'range',
                                        key: 'range',
                                        render: (text) => <Tag>{text}</Tag>
                                    },
                                    {
                                        title: 'Total Detections',
                                        dataIndex: 'count',
                                        key: 'count',
                                        align: 'center',
                                        render: (count) => <Text strong>{count}</Text>
                                    },
                                    {
                                        title: 'Distribution',
                                        dataIndex: 'percentage',
                                        key: 'percentage',
                                        align: 'center',
                                        render: (pct) => <Text type="secondary">{pct.toFixed(1)}%</Text>
                                    },
                                    {
                                        title: 'Per Class',
                                        dataIndex: 'byClass',
                                        key: 'byClass',
                                        render: (byClass) => (
                                            <Space size={4} wrap>
                                                {Object.entries(byClass).map(([cls, cnt]) => (
                                                    <Tag key={cls} color="blue" style={{ margin: 0 }}>
                                                        {cls}: {cnt}
                                                    </Tag>
                                                ))}
                                                {Object.keys(byClass).length === 0 && <Text type="secondary">None</Text>}
                                            </Space>
                                        )
                                    }
                                ]}
                            />
                        </Card>
                    </>
                ) : (
                    <Card>
                        <Text type="secondary">No prediction data available for this experiment.</Text>
                    </Card>
                )}
            </div>

            {/* SECTION 02: REAL-WORLD PERFORMANCE */}
            <div className="report-section" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                <Title level={3} style={{ fontSize: '16px', fontWeight: 600, marginBottom: '1rem', color: '#1890ff' }}>
                    <AimOutlined /> Section 02: Real-World Performance
                </Title>

                {predictionAnalytics && kpis ? (
                    <>
                        {/* Analysis Parameters */}
                        <Card size="small" style={{ marginBottom: '1rem', background: '#f9f9f9', border: '1px solid #eee' }}>
                            <Space split={<Divider type="vertical" />}>
                                <Text>
                                    <Text strong style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', marginRight: '8px' }}>Confidence:</Text>{' '}
                                    <Tag color="blue" style={{ borderRadius: '4px', fontWeight: 'bold' }}>{experiment?.confidence?.toFixed(2) || 'N/A'}</Tag>
                                </Text>
                                <Text>
                                    <Text strong style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', marginRight: '8px' }}>IOU Threshold:</Text>{' '}
                                    <Tag color="green" style={{ borderRadius: '4px', fontWeight: 'bold' }}>{experiment?.iou_threshold?.toFixed(2) || 'N/A'}</Tag>
                                </Text>
                            </Space>
                        </Card>

                        {/* Performance Metrics - Row 1: TP, FP, FN */}
                        <Row gutter={[16, 16]} style={{ marginBottom: '1rem' }}>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%', background: '#f6ffed', borderColor: '#b7eb8f' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        True Positives
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#52c41a', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {kpis.tp || 0}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Correct detections
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%', background: '#fff1f0', borderColor: '#ffa39e' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        False Positives
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#ff4d4f', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {kpis.fp || 0}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Incorrect finds
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%', background: '#fffbe6', borderColor: '#ffe58f' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        False Negatives
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#fa8c16', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {kpis.fn || 0}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Missed objects
                                    </Text>
                                </Card>
                            </Col>
                        </Row>

                        {/* Performance Metrics - Row 2: Precision, Recall, F1 */}
                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%', border: '1px solid #e6f7ff', background: '#f0f9ff' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        Precision
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#1890ff', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {kpis.precision ? `${kpis.precision}%` : 'N/A'}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        TP / (TP + FP)
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%', border: '1px solid #f9f0ff', background: '#f9f0ff' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        Recall
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#722ed1', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {kpis.recall ? `${kpis.recall}%` : 'N/A'}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        TP / (TP + FN)
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%', background: '#e6f7ff', borderColor: '#91d5ff' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        F1 Score
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#1890ff', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {kpis.f1 ? `${kpis.f1}%` : 'N/A'}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Overall accuracy
                                    </Text>
                                </Card>
                            </Col>
                        </Row>
                    </>
                ) : (
                    <Card style={{ border: '1px dashed #ccc', textAlign: 'center', padding: '2rem' }}>
                        <Text type="secondary">Quality metrics not available. Run on a split dataset for performance analysis.</Text>
                    </Card>
                )}
            </div>

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
