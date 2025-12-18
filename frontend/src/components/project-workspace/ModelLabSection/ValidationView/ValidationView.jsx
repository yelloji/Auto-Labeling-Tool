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
        name: '',
        dataset_source: 'val',
        confidence: 0.25,
        iou_threshold: 0.45,
        imgsz: 640,
        max_detections: 300,
        task: training?.taskType || 'detection',
        weights_type: 'best'
    });

    const [activeExperimentId, setActiveExperimentId] = useState(null);
    const lastTrainingId = useRef(null);
    const isInitializing = useRef(false);
    const syncTimeoutRef = useRef(null);

    // Sync any parameter change with the database
    const updateParam = async (key, value) => {
        const newParams = { ...params, [key]: value };
        setParams(newParams);

        // If we don't have an active experiment ID yet, we need to INIT first
        if (!activeExperimentId && !isInitializing.current) {
            isInitializing.current = true;
            try {
                const response = await projectsAPI.initValidation(training.id, newParams);
                setActiveExperimentId(response.id);
                logInfo('app.frontend.validation', 'draft_initialized', `Draft created for training ${training.id}`, { experiment_id: response.id });
            } catch (error) {
                console.error("Failed to initialize validation draft:", error);
                message.error("Failed to sync settings to database. Please check connection.");
            } finally {
                isInitializing.current = false;
            }
        } else if (activeExperimentId) {
            // We have an ID, so update/PATCH it (Debounced)
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = setTimeout(async () => {
                try {
                    await projectsAPI.updateValidationDraft(activeExperimentId, { [key]: value });
                    logInfo('app.frontend.validation', 'draft_synced', `Draft ${activeExperimentId} updated: ${key}=${value}`);
                } catch (error) {
                    console.error("Failed to sync validation parameter:", error);
                }
            }, 800); // 800ms debounce for senior-level feel
        }
    };

    // Load existing draft or model defaults on model switch
    useEffect(() => {
        const loadDraftOrDefaults = async () => {
            if (training && training.id !== lastTrainingId.current) {
                lastTrainingId.current = training.id;

                let existingDraft = null;
                try {
                    existingDraft = await projectsAPI.getQueuedValidation(training.id);
                } catch (e) {
                    console.error("Error checking for queued validation", e);
                }

                if (existingDraft) {
                    // RESUME from Database
                    setActiveExperimentId(existingDraft.id);
                    setParams({
                        name: existingDraft.name || '',
                        dataset_source: existingDraft.dataset_source || 'val',
                        confidence: existingDraft.confidence || 0.25,
                        iou_threshold: existingDraft.iou_threshold || 0.45,
                        imgsz: existingDraft.imgsz || 640,
                        max_detections: existingDraft.max_detections || 300,
                        task: existingDraft.task || training.taskType || 'detection',
                        weights_type: existingDraft.weights_type || 'best'
                    });
                    logInfo('app.frontend.validation', 'draft_resumed', `Resumed draft ${existingDraft.id} from database`);
                } else {
                    // NEW: Load from Model config
                    setActiveExperimentId(null);
                    let detectedImgsz = 640;
                    if (training.resolved_config_json) {
                        try {
                            const config = typeof training.resolved_config_json === 'string'
                                ? JSON.parse(training.resolved_config_json)
                                : training.resolved_config_json;
                            detectedImgsz = config.train?.imgsz || config.imgsz || 640;
                        } catch (e) {
                            console.error("Failed to parse config for imgsz", e);
                        }
                    }

                    setParams({
                        name: '', // Empty experiment name by default
                        dataset_source: 'val',
                        task: training.taskType || 'detection',
                        imgsz: detectedImgsz,
                        confidence: 0.25,
                        iou_threshold: 0.45,
                        max_detections: 300,
                        weights_type: 'best'
                    });
                }
            }
        };

        loadDraftOrDefaults();
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

            // If nothing selected yet, pick the first one from history
            setActiveExperiment(prev => {
                if (prev) {
                    const updated = (data || []).find(e => e.id === prev.id);
                    return updated || prev;
                }
                return (data && data.length > 0) ? data[0] : null;
            });
        } catch (error) {
            if (!quiet) handleAPIError(error, "Failed to load validation history");
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [training?.id]);

    // Side effect: Monitor running experiment status transitions
    useEffect(() => {
        if (!activeExperiment || activeExperiment.status === 'completed' || activeExperiment.status === 'failed') return;

        // Check if the current active experiment in the list has finished
        const currentInList = experiments.find(e => e.id === activeExperiment.id);
        if (currentInList && (currentInList.status === 'completed' || currentInList.status === 'failed')) {
            setRunning(false);
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }

            if (currentInList.status === 'completed') {
                message.success("Validation completed!");
                // Fresh session: record is no longer 'queued' (it's completed)
                setActiveExperimentId(null);
                setParams(prev => ({ ...prev, name: '' }));
            } else {
                message.error("Validation failed: " + currentInList.error_message);
            }
        }
    }, [experiments, activeExperiment?.id]);

    useEffect(() => {
        if (training?.id) {
            fetchHistory();
        }
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, [training?.id, fetchHistory]);

    const handleRunValidation = async () => {
        if (running) return;

        setRunning(true);
        logUserClick('ValidationView', 'run_validation');
        try {
            // Final sync before run
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

            const response = await projectsAPI.validateTraining(training.id, params);
            const expId = response.experiment_id;

            // Mark as active but reset the draft ID since it's now running (not a draft anymore)
            setActiveExperimentId(null);

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
        logUserClick('ValidationView', 'delete_experiment');

        // Confirmation dialog
        const confirmDelete = window.confirm("Are you sure you want to delete this experiment? This action cannot be undone.");
        if (!confirmDelete) return;

        try {
            await projectsAPI.deleteExperiment(id);
            message.success("Experiment deleted successfully");

            // Refresh history
            await fetchHistory();

            // If the deleted experiment was the active one, clear the selection
            if (activeExperiment?.id === id) {
                setActiveExperiment(null);
            }

            // If we deleted the current queued draft, reset the form to defaults
            if (activeExperimentId === id) {
                setActiveExperimentId(null);

                // Detect imgsz from training config (same logic as initial load)
                let detectedImgsz = 640;
                if (training?.resolved_config_json) {
                    try {
                        const config = typeof training.resolved_config_json === 'string'
                            ? JSON.parse(training.resolved_config_json)
                            : training.resolved_config_json;
                        detectedImgsz = config.train?.imgsz || config.imgsz || 640;
                    } catch (e) {
                        console.error("Failed to parse config for imgsz", e);
                    }
                }

                setParams({
                    name: '',
                    dataset_source: 'val',
                    task: training?.taskType || 'detection',
                    imgsz: detectedImgsz,
                    confidence: 0.25,
                    iou_threshold: 0.45,
                    max_detections: 300,
                    weights_type: 'best'
                });

                logInfo('app.frontend.validation', 'draft_deleted', `Deleted queued draft ${id}, all fields reset to defaults`);
            }
        } catch (error) {
            if (error.response?.status === 400) {
                message.error(error.response.data.detail || "Cannot delete this experiment");
            } else {
                handleAPIError(error, "Failed to delete experiment");
            }
        }
    };

    const renderKPICard = (label, value, icon, color, tooltipText) => (
        <Tooltip title={tooltipText || label}>
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
                            <Card
                                className="v-config-panel"
                                title={
                                    <Tooltip title="Fine-tune your model's validation parameters to test its performance under different conditions.">
                                        <Space><ExperimentOutlined /><span>Parameters</span></Space>
                                    </Tooltip>
                                }
                            >
                                <div style={{ marginBottom: 16 }}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Configure validation settings to fine-tune how the model evaluates on the dataset.
                                    </Text>
                                </div>
                                <div className="v-form-item" style={{ marginBottom: 16 }}>
                                    <Tooltip title="Unique name to identify this validation run. Helps in comparing results later.">
                                        <Text strong style={{ cursor: 'help' }}>Experiment Name</Text>
                                    </Tooltip>
                                    <Input
                                        value={params.name}
                                        style={{ marginTop: 4 }}
                                        onChange={e => updateParam('name', e.target.value)}
                                        placeholder="Enter experiment name..."
                                        autoComplete="off"
                                    />
                                </div>

                                <div className="v-form-item" style={{ marginBottom: 16 }}>
                                    <Tooltip title="Best: Uses the model state with highest metrics. Last: Uses the final state from training.">
                                        <Text strong style={{ cursor: 'help' }}>Select Validation Model</Text>
                                    </Tooltip>
                                    <Select
                                        value={params.weights_type}
                                        style={{ width: '100%', marginTop: 4 }}
                                        onChange={v => updateParam('weights_type', v)}
                                    >
                                        <Option value="best">Best Weights (Recommended)</Option>
                                        <Option value="last">Last Weights (Most Recent)</Option>
                                    </Select>
                                </div>

                                {training?.taskType === 'segmentation' && (
                                    <div className="v-form-item" style={{ marginBottom: 12 }}>
                                        <Tooltip title="Detection: Validates bounding boxes. Segmentation: Validates pixel-level masks.">
                                            <Text strong style={{ cursor: 'help' }}>Validation Task</Text>
                                        </Tooltip>
                                        <Select
                                            value={params.task}
                                            style={{ width: '100%', marginTop: 4 }}
                                            onChange={v => updateParam('task', v)}
                                        >
                                            <Option value="segmentation">Instance Segmentation</Option>
                                            <Option value="detection">Object Detection</Option>
                                        </Select>
                                    </div>
                                )}

                                <div className="v-form-item">
                                    <Tooltip title="Choose which data split to validate against (typically 'val').">
                                        <Text strong style={{ cursor: 'help' }}>Dataset Split</Text>
                                    </Tooltip>
                                    <Select
                                        value={params.dataset_source}
                                        style={{ width: '100%', marginTop: 4 }}
                                        onChange={v => updateParam('dataset_source', v)}
                                    >
                                        <Option value="val">Validation</Option>
                                        <Option value="test">Test</Option>
                                        <Option value="train">Train</Option>
                                    </Select>
                                </div>

                                <div className="v-form-item" style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Tooltip title="Minimum probability required for a detection. Lower values find more objects but may increase false positives (noise).">
                                            <Text strong style={{ cursor: 'help' }}>Confidence</Text>
                                        </Tooltip>
                                        <InputNumber
                                            min={0.01} max={1.0} step={0.01}
                                            value={params.confidence}
                                            size="small"
                                            onChange={v => updateParam('confidence', v)}
                                        />
                                    </div>
                                    <Slider
                                        min={0.01} max={1.0} step={0.01}
                                        value={params.confidence}
                                        style={{ margin: '8px 0' }}
                                        onChange={v => updateParam('confidence', v)}
                                    />
                                </div>

                                <div className="v-form-item" style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Tooltip title="NMS Overlap threshold. Lower values are stricter and reduce duplicate detections for the same object.">
                                            <Text strong style={{ cursor: 'help' }}>IoU Threshold</Text>
                                        </Tooltip>
                                        <InputNumber
                                            min={0.01} max={1.0} step={0.01}
                                            value={params.iou_threshold}
                                            size="small"
                                            onChange={v => updateParam('iou_threshold', v)}
                                        />
                                    </div>
                                    <Slider
                                        min={0.01} max={1.0} step={0.01}
                                        value={params.iou_threshold}
                                        style={{ margin: '8px 0' }}
                                        onChange={v => updateParam('iou_threshold', v)}
                                    />
                                </div>

                                <div className="v-form-item" style={{ marginTop: 12 }}>
                                    <Tooltip title="Pixel resolution for validation. Matches the model's training size for best results.">
                                        <Text strong style={{ cursor: 'help' }}>Image Size</Text>
                                    </Tooltip>
                                    <InputNumber
                                        min={32} step={32}
                                        value={params.imgsz}
                                        style={{ width: '100%', marginTop: 4 }}
                                        onChange={v => updateParam('imgsz', v)}
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
                                <div style={{ marginBottom: 16, padding: '0 4px' }}>
                                    <Title level={5} style={{ marginBottom: 4 }}>Validation Performance</Title>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Performance scores showing how well your model detects objects. Higher values (closer to 100%) indicate better accuracy.
                                    </Text>
                                </div>
                                {/* KPI Row */}
                                <div className={`v-kpi-grid ${isSegmentation ? 'v-kpi-grid-10' : ''}`}>
                                    {renderKPICard(isSegmentation ? 'Box mAP@0.5' : 'mAP@0.5', metrics.map50?.toFixed(3) || '0.00', '📊', '#1890ff', 'Mean Average Precision at 50% IoU threshold. Standard quality metric.')}
                                    {renderKPICard(isSegmentation ? 'Box mAP@0.5:0.95' : 'mAP@0.5:0.95', metrics.map50_95?.toFixed(3) || '0.00', '📈', '#722ed1', 'Mean Average Precision averaged across IoU thresholds 50% to 95%. Deep measure of robustness.')}
                                    {renderKPICard(isSegmentation ? 'Box Precision' : 'Precision', (metrics.precision * 100 || 0).toFixed(1) + '%', '🎯', '#52c41a', 'Precision measures how many predicted boxes are correct.')}
                                    {renderKPICard(isSegmentation ? 'Box Recall' : 'Recall', (metrics.recall * 100 || 0).toFixed(1) + '%', '🔍', '#faad14', 'Recall measures how many actual objects were detected.')}
                                    {renderKPICard(isSegmentation ? 'Box F1' : 'F1 Score', (metrics.f1 * 100 || 0).toFixed(1) + '%', '🔥', '#ff4d4f', 'F1-Score is the harmonic mean of Precision and Recall.')}

                                    {isSegmentation && (
                                        <>
                                            {renderKPICard('Mask mAP@0.5', metrics.mask_map50?.toFixed(3) || '0.00', '🎭', '#1890ff', 'Mean Average Precision for masks at 50% IoU threshold.')}
                                            {renderKPICard('Mask mAP@0.5:0.95', metrics.mask_map50_95?.toFixed(3) || '0.00', '🎬', '#722ed1', 'Mean Average Precision for masks averaged across IoU thresholds 50% to 95%.')}
                                            {renderKPICard('Mask Precision', (metrics.mask_precision * 100 || 0).toFixed(1) + '%', '🧿', '#52c41a', 'Precision measures how many predicted masks are correct.')}
                                            {renderKPICard('Mask Recall', (metrics.mask_recall * 100 || 0).toFixed(1) + '%', '💎', '#faad14', 'Recall measures how many actual masks were detected.')}
                                            {renderKPICard('Mask F1', (metrics.mask_f1 * 100 || 0).toFixed(1) + '%', '🧬', '#ff4d4f', 'F1-Score is the harmonic mean of Precision and Recall for masks.')}
                                        </>
                                    )}
                                </div>s

                                {/* Interactive Heatmap */}
                                <Card
                                    className="v-heatmap-card"
                                    title={
                                        <Tooltip title="A visual summary of prediction accuracy. Correct predictions are on the diagonal; off-diagonal values show class-to-class confusion.">
                                            <Space><RadarChartOutlined /><span>Confusion Matrix Heatmap</span></Space>
                                        </Tooltip>
                                    }
                                    extra={<Space><Button icon={<SwapOutlined />} disabled={experiments.length < 2}>Compare</Button></Space>}
                                >
                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Visual heatmap showing prediction accuracy. Diagonal cells show correct predictions, off-diagonal shows confusion between classes.
                                        </Text>
                                    </div>
                                    {renderConfusionMatrix()}
                                </Card>
                            </div>
                        </Col>
                    </Row>

                    {/* Wide Row - Per Class Performance */}
                    <Row style={{ marginTop: 12 }}>
                        <Col span={24}>
                            <Card
                                className="v-table-card"
                                title={
                                    <Tooltip title="Detailed performance breakdown for each object class. Shows how well your model identifies specific types of objects.">
                                        <Space><TableOutlined /><span>Per-Class Performance Breakdown</span></Space>
                                    </Tooltip>
                                }
                            >
                                <div style={{ marginBottom: 12 }}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Granular analysis of metrics filtered by individual object classes.
                                    </Text>
                                </div>
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
                    <Card
                        className="v-history-panel"
                        title={
                            <Tooltip title="A list of all previous validation experiments conducted for this model session.">
                                <Space><HistoryOutlined /><span>Experiment History</span></Space>
                            </Tooltip>
                        }
                        bodyStyle={{ padding: 0 }}
                    >
                        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                                Track and compare previous validation runs to find the best settings for your model.
                            </Text>
                        </div>
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
