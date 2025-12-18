import { Skeleton, Card, Row, Col, Typography, Space, Button, Select, Slider, InputNumber, Input, Tag, List, Badge, Empty, Tooltip, Table, message } from 'antd';
import {
    ExperimentOutlined,
    PlayCircleOutlined,
    HistoryOutlined,
    RadarChartOutlined,
    CheckCircleOutlined,
    SyncOutlined,
    CloseCircleOutlined,
    StarOutlined,
    StarFilled,
    DeleteOutlined,
    ArrowRightOutlined,
    SwapOutlined,
    TableOutlined
} from '@ant-design/icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { projectsAPI, handleAPIError } from '../../../../services/api';
import { logInfo, logError, logUserClick } from '../../../../utils/professional_logger';
import './ValidationView.css';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * ValidationView Component
 *
 * Detailed validation tab with 3-column layout:
 * - Left: Configuration
 * - Middle: Results (KPIs, Confusion Matrix, Class Table)
 * - Right: History
 */
const ValidationView = ({ training }) => {

    // State for configuration
    const [params, setParams] = useState({
        name: '', // Start empty as requested
        dataset_source: 'val',
        confidence: 0.25,
        iou_threshold: 0.45,
        imgsz: 640,
        max_detections: 300,
        task: training?.taskType || 'detection',
        weights_type: 'best'
    });

    const lastTrainingId = useRef(null);

    // Update params if training changes
    useEffect(() => {
        if (training && training.id !== lastTrainingId.current) {
            lastTrainingId.current = training.id;

            // Senior approach: Parse config purely from DB record
            let detectedImgsz = 640;
            if (training.resolved_config_json) {
                try {
                    const config = typeof training.resolved_config_json === 'string'
                        ? JSON.parse(training.resolved_config_json)
                        : training.resolved_config_json;
                    // Most configs store it in 'train' block, but handles root too
                    detectedImgsz = config.train?.imgsz || config.imgsz || 640;
                } catch (e) {
                    console.error("Failed to parse config for imgsz", e);
                }
            }

            setParams(prev => ({
                ...prev,
                name: '', // Reset name to empty on model switch
                task: training.taskType || 'detection',
                imgsz: detectedImgsz,
                weights_type: 'best'
            }));
        }
    }, [training, training?.id]);

    // State for data
    const [experiments, setExperiments] = useState([]);
    const [activeExperiment, setActiveExperiment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);

    // Polling interval ref
    const pollingIntervalRef = useRef(null);

    const fetchHistory = useCallback(async (quiet = false) => {
        if (!training?.id) return;
        if (!quiet) setLoading(true);
        try {
            const data = await projectsAPI.getTrainingExperiments(training.id);
            setExperiments(data || []);

            // If we have an active experiment, update its status
            if (activeExperiment) {
                const updated = data.find(e => e.id === activeExperiment.id);
                if (updated) {
                    setActiveExperiment(updated);
                    if (updated.status === 'completed' || updated.status === 'failed') {
                        setRunning(false);
                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                        if (updated.status === 'completed') {
                            message.success("Validation completed!");
                            // Fresh UI reset: clear the name for next run
                            setParams(prev => ({
                                ...prev,
                                name: '',
                            }));
                        } else {
                            message.error("Validation failed: " + updated.error_message);
                        }
                    }
                }
            } else if (data.length > 0 && !activeExperiment) {
                // Auto-select latest completed or first one
                setActiveExperiment(data[0]);
            }
        } catch (error) {
            if (!quiet) handleAPIError(error, "Failed to load validation history");
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [training?.id, activeExperiment]);

    useEffect(() => {
        if (training?.id) {
            fetchHistory();
        }
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, [training?.id, fetchHistory]);

    const handleRunValidation = async () => {
        if (running) return;

        setRunning(true);
        logUserClick('ValidationView', 'run_validation');
        try {
            const response = await projectsAPI.validateTraining(training.id, params);
            const expId = response.experiment_id;

            // Add a temporary pending experiment to history
            const tempExp = {
                id: expId,
                status: 'queued',
                created_at: new Date().toISOString(),
                ...params
            };
            setExperiments(prev => [tempExp, ...prev]);
            setActiveExperiment(tempExp);

            // Start polling
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = setInterval(() => {
                fetchHistory(true);
            }, 3000);

            message.loading("Validation started in background...", 2);
        } catch (error) {
            setRunning(false);
            handleAPIError(error, "Failed to start validation");
        }
    };

    const deleteExperiment = async (id) => {
        // Not implemented in backend yet, but UI placeholder
        message.info("Delete functionality coming soon");
    };

    const renderKPICard = (label, value, icon, color) => (
        <Tooltip title={label}>
            <Card className="v-stat-card">
                <div className="v-stat-icon-circle" style={{ '--gradient-start': color }}>
                    <div className="v-stat-icon">{icon}</div>
                </div>
                <div className="v-stat-value">{value}</div>
                <div className="v-stat-label">{label}</div>
            </Card>
        </Tooltip>
    );

    const metrics = activeExperiment?.validation_metrics || {};
    const classes = activeExperiment?.per_class_metrics || [];

    // Use the task type from params for parameters, but activeExperiment task for results display
    const currentTask = activeExperiment?.task || params.task;
    const isSegmentation = currentTask === 'segmentation';

    const tableColumns = [
        { title: 'Class', dataIndex: 'name', key: 'name', fixed: 'left' },
        // Box metrics
        {
            title: isSegmentation ? 'Box Precision' : 'Precision',
            dataIndex: 'precision', key: 'precision',
            render: v => (v * 100).toFixed(1) + '%'
        },
        {
            title: isSegmentation ? 'Box Recall' : 'Recall',
            dataIndex: 'recall', key: 'recall',
            render: v => (v * 100).toFixed(1) + '%'
        },
        {
            title: isSegmentation ? 'Box F1' : 'F1',
            dataIndex: 'f1', key: 'f1',
            render: v => (v * 100).toFixed(1) + '%'
        },
        {
            title: isSegmentation ? 'Box mAP50' : 'mAP50',
            dataIndex: 'map50', key: 'map50',
            render: v => v?.toFixed(3)
        },
        {
            title: isSegmentation ? 'Box mAP50-95' : 'mAP50-95',
            dataIndex: 'map50_95', key: 'map50_95',
            render: v => v?.toFixed(3)
        },
    ];

    if (isSegmentation) {
        tableColumns.push(
            { title: 'Mask Precision', dataIndex: 'mask_precision', key: 'mask_precision', render: v => (v * 100 || 0).toFixed(1) + '%' },
            { title: 'Mask Recall', dataIndex: 'mask_recall', key: 'mask_recall', render: v => (v * 100 || 0).toFixed(1) + '%' },
            { title: 'Mask F1', dataIndex: 'mask_f1', key: 'mask_f1', render: v => (v * 100 || 0).toFixed(1) + '%' },
            { title: 'Mask mAP50', dataIndex: 'mask_map50', key: 'mask_map50', render: v => v?.toFixed(3) || '0.000' },
            { title: 'Mask mAP50-95', dataIndex: 'mask_map50_95', key: 'mask_map50_95', render: v => v?.toFixed(3) || '0.000' },
        );
    }

    const renderConfusionMatrix = () => {
        if (loading && !activeExperiment) return <Skeleton active paragraph={{ rows: 8 }} />;
        if (!activeExperiment || !activeExperiment.confusion_matrix) {
            return (
                <div className="v-heatmap-placeholder">
                    <Empty description="No confusion matrix data available" />
                </div>
            );
        }

        const matrix = activeExperiment.confusion_matrix;
        // matrix is [{actual: '...', predicted: '...', count: ...}]
        const classes = [...new Set(matrix.map(m => m.actual))];

        return (
            <div className="v-matrix-scroll">
                <table className="v-matrix">
                    <thead>
                        <tr>
                            <th></th>
                            {classes.map(c => <th key={c}>{c}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {classes.map(actual => (
                            <tr key={actual}>
                                <td className="v-class-label">{actual}</td>
                                {classes.map(predicted => {
                                    const cell = matrix.find(m => m.actual === actual && m.predicted === predicted);
                                    const count = cell ? cell.count : 0;
                                    // Calculate intensity (0-1)
                                    const rowTotal = matrix.filter(m => m.actual === actual).reduce((acc, curr) => acc + curr.count, 0);
                                    const intensity = rowTotal > 0 ? count / rowTotal : 0;

                                    return (
                                        <Tooltip
                                            key={predicted}
                                            title={
                                                <div>
                                                    <div>Actual: {actual}</div>
                                                    <div>Predicted: {predicted}</div>
                                                    <div>Samples: {count}</div>
                                                    <div>Recall: {(intensity * 100).toFixed(1)}%</div>
                                                </div>
                                            }
                                        >
                                            <td
                                                style={{
                                                    background: `rgba(24, 144, 255, ${intensity})`,
                                                    color: intensity > 0.5 ? 'white' : 'inherit'
                                                }}
                                                className="v-matrix-cell"
                                            >
                                                {count}
                                            </td>
                                        </Tooltip>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="validation-view-container">
            <Row gutter={[12, 12]} style={{ height: '100%', margin: 0 }}>
                {/* Main Content Area (Config + Results) */}
                <Col span={19}>
                    <Row gutter={[12, 12]}>
                        {/* Left Sidebar - Configuration */}
                        <Col span={7}>
                            <Card className="v-config-panel" title={<Space><ExperimentOutlined /><span>Parameters</span></Space>}>
                                <div className="v-form-item" style={{ marginBottom: 16 }}>
                                    <Text strong>Experiment Name</Text>
                                    <Input
                                        value={params.name}
                                        style={{ marginTop: 4 }}
                                        onChange={e => setParams({ ...params, name: e.target.value })}
                                        placeholder="Enter experiment name..."
                                        autoComplete="off"
                                    />
                                </div>

                                <div className="v-form-item" style={{ marginBottom: 16 }}>
                                    <Text strong>Select Validation Model</Text>
                                    <Select
                                        value={params.weights_type}
                                        style={{ width: '100%', marginTop: 4 }}
                                        onChange={v => setParams({ ...params, weights_type: v })}
                                    >
                                        <Option value="best">Best Weights (Recommended)</Option>
                                        <Option value="last">Last Weights (Most Recent)</Option>
                                    </Select>
                                </div>

                                {training?.taskType === 'segmentation' && (
                                    <div className="v-form-item" style={{ marginBottom: 12 }}>
                                        <Text strong>Validation Task</Text>
                                        <Select
                                            value={params.task}
                                            style={{ width: '100%', marginTop: 4 }}
                                            onChange={v => setParams({ ...params, task: v })}
                                        >
                                            <Option value="segmentation">Instance Segmentation</Option>
                                            <Option value="detection">Object Detection</Option>
                                        </Select>
                                    </div>
                                )}

                                <div className="v-form-item">
                                    <Text strong>Dataset Split</Text>
                                    <Select
                                        value={params.dataset_source}
                                        style={{ width: '100%', marginTop: 4 }}
                                        onChange={v => setParams({ ...params, dataset_source: v })}
                                    >
                                        <Option value="val">Validation</Option>
                                        <Option value="test">Test</Option>
                                        <Option value="train">Train</Option>
                                    </Select>
                                </div>

                                <div className="v-form-item" style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>Confidence</Text>
                                        <InputNumber
                                            min={0.01} max={1.0} step={0.01}
                                            value={params.confidence}
                                            size="small"
                                            onChange={v => setParams({ ...params, confidence: v })}
                                        />
                                    </div>
                                    <Slider
                                        min={0.01} max={1.0} step={0.01}
                                        value={params.confidence}
                                        style={{ margin: '8px 0' }}
                                        onChange={v => setParams({ ...params, confidence: v })}
                                    />
                                </div>

                                <div className="v-form-item" style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>IoU Threshold</Text>
                                        <InputNumber
                                            min={0.01} max={1.0} step={0.01}
                                            value={params.iou_threshold}
                                            size="small"
                                            onChange={v => setParams({ ...params, iou_threshold: v })}
                                        />
                                    </div>
                                    <Slider
                                        min={0.01} max={1.0} step={0.01}
                                        value={params.iou_threshold}
                                        style={{ margin: '8px 0' }}
                                        onChange={v => setParams({ ...params, iou_threshold: v })}
                                    />
                                </div>

                                <div className="v-form-item" style={{ marginTop: 12 }}>
                                    <Text strong>Image Size</Text>
                                    <InputNumber
                                        min={32} step={32}
                                        value={params.imgsz}
                                        style={{ width: '100%', marginTop: 4 }}
                                        onChange={v => setParams({ ...params, imgsz: v })}
                                        placeholder={`Model default: ${training?.imgsz || 640}`}
                                    />
                                </div>

                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    block
                                    size="large"
                                    className="v-run-btn"
                                    onClick={handleRunValidation}
                                    loading={running}
                                    style={{ marginTop: 24 }}
                                >
                                    {running ? 'Validating...' : 'Run Validation'}
                                </Button>
                            </Card>
                        </Col>

                        {/* Middle Content - KPIs & Heatmap */}
                        <Col span={17}>
                            <div className="v-results-panel">
                                {/* KPI Row */}
                                <div className={`v-kpi-grid ${isSegmentation ? 'v-kpi-grid-10' : ''}`}>
                                    {renderKPICard(isSegmentation ? 'Box mAP@0.5' : 'mAP@0.5', metrics.map50?.toFixed(3) || '0.00', '📊', '#1890ff')}
                                    {renderKPICard(isSegmentation ? 'Box mAP@0.5:0.95' : 'mAP@0.5:0.95', metrics.map50_95?.toFixed(3) || '0.00', '📈', '#722ed1')}
                                    {renderKPICard(isSegmentation ? 'Box Precision' : 'Precision', (metrics.precision * 100 || 0).toFixed(1) + '%', '🎯', '#52c41a')}
                                    {renderKPICard(isSegmentation ? 'Box Recall' : 'Recall', (metrics.recall * 100 || 0).toFixed(1) + '%', '🔍', '#faad14')}
                                    {renderKPICard(isSegmentation ? 'Box F1' : 'F1 Score', (metrics.f1 * 100 || 0).toFixed(1) + '%', '🔥', '#ff4d4f')}

                                    {isSegmentation && (
                                        <>
                                            {renderKPICard('Mask mAP@0.5', metrics.mask_map50?.toFixed(3) || '0.00', '🎭', '#1890ff')}
                                            {renderKPICard('Mask mAP@0.5:0.95', metrics.mask_map50_95?.toFixed(3) || '0.00', '🎬', '#722ed1')}
                                            {renderKPICard('Mask Precision', (metrics.mask_precision * 100 || 0).toFixed(1) + '%', '🧿', '#52c41a')}
                                            {renderKPICard('Mask Recall', (metrics.mask_recall * 100 || 0).toFixed(1) + '%', '💎', '#faad14')}
                                            {renderKPICard('Mask F1', (metrics.mask_f1 * 100 || 0).toFixed(1) + '%', '🧬', '#ff4d4f')}
                                        </>
                                    )}
                                </div>

                                {/* Interactive Heatmap */}
                                <Card
                                    className="v-heatmap-card"
                                    title={<Space><RadarChartOutlined /><span>Confusion Matrix Heatmap</span></Space>}
                                    extra={<Space><Button icon={<SwapOutlined />} disabled={experiments.length < 2}>Compare</Button></Space>}
                                >
                                    {renderConfusionMatrix()}
                                </Card>
                            </div>
                        </Col>
                    </Row>

                    {/* Wide Row - Per Class Performance */}
                    <Row style={{ marginTop: 12 }}>
                        <Col span={24}>
                            <Card className="v-table-card" title={<Space><TableOutlined /><span>Per-Class Performance Breakdown</span></Space>}>
                                <Table
                                    size="small"
                                    pagination={false}
                                    columns={tableColumns}
                                    dataSource={classes.map((c, i) => ({ ...c, key: i }))}
                                    loading={loading && !activeExperiment}
                                    scroll={{ x: 'max-content' }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </Col>

                {/* Right Sidebar - History (Full Height) */}
                <Col span={5}>
                    <Card className="v-history-panel" title={<Space><HistoryOutlined /><span>Experiment History</span></Space>} bodyStyle={{ padding: 0 }}>
                        <List
                            loading={loading}
                            dataSource={experiments}
                            renderItem={item => (
                                <List.Item
                                    className={`v-history-item ${activeExperiment?.id === item.id ? 'active' : ''}`}
                                    onClick={() => setActiveExperiment(item)}
                                >
                                    <div className="v-history-content">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text strong>{item.name || new Date(item.created_at).toLocaleTimeString()}</Text>
                                            {(item.status === 'queued' || item.status === 'running' || item.status === 'pending') ?
                                                <SyncOutlined spin style={{ color: '#1890ff' }} /> :
                                                item.status === 'failed' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> :
                                                    <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                        </div>
                                        {item.name && (
                                            <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                                                {new Date(item.created_at).toLocaleTimeString()}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                            <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>mAP: {item.validation_metrics?.map50?.toFixed(2) || 'N/A'}</Tag>
                                            <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>{item.dataset_source}</Tag>
                                        </div>
                                    </div>
                                    <Space className="v-history-actions">
                                        <Tooltip title="Delete">
                                            <DeleteOutlined onClick={(e) => { e.stopPropagation(); deleteExperiment(item.id); }} />
                                        </Tooltip>
                                    </Space>
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No experiments yet" /> }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ValidationView;
