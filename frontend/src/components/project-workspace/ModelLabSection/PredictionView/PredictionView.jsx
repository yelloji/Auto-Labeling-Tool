import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Skeleton,
    Card,
    Typography,
    Space,
    Button,
    Select,
    Slider,
    InputNumber,
    Input,
    Tag,
    List,
    Badge,
    Empty,
    message,
    Spin,
    Modal,
    Tooltip,
    Row,
    Col
} from 'antd';
import {
    ExperimentOutlined,
    PlayCircleOutlined,
    HistoryOutlined,
    SettingOutlined,
    LineChartOutlined,
    DeleteOutlined,
    SearchOutlined,
    EyeOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined,
    SyncOutlined
} from '@ant-design/icons';

// Modular Components
import AnalyticsModal from './AnalyticsModal';
import ComparisonModal from './ComparisonModal';
import ImageViewerModal from './ImageViewerModal';

import { projectsAPI, handleAPIError } from '../../../../services/api';
import './PredictionView.css';

const { Text } = Typography;
const { Option } = Select;

/**
 * PredictionView Component
 * 
 * Detailed prediction tab with 2-column sidebar layout.
 */
const PredictionView = ({ training }) => {
    // --- State ---
    const [experiments, setExperiments] = useState([]);
    const [selectedExp, setSelectedExp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [pollingActive, setPollingActive] = useState(false);

    // Results state
    const [experimentImages, setExperimentImages] = useState([]); // All image names
    const [filteredImages, setFilteredImages] = useState([]); // Filtered image names
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState(''); // current image name
    const [fetchingResults, setFetchingResults] = useState(false);

    // Advanced Features Modals
    const [compareVisible, setCompareVisible] = useState(false);
    const [analyticsVisible, setAnalyticsVisible] = useState(false);

    // Filter State
    const [filters, setFilters] = useState({
        detectionCount: 'any',
        className: 'all',
        confidence: 0.25
    });

    // Form inputs (Draft state for 'queued' experiment)
    const [config, setConfig] = useState({
        name: '',
        dataset_source: 'test',
        task: training?.taskType || 'detection',  // Default to training's task type
        confidence: 0.25,
        iou_threshold: 0.45,
        imgsz: 640,
        weights_type: 'best',
        max_det: 300,
        device: '0'
    });

    // --- References ---
    const pollTimerRef = useRef(null);

    // --- Helpers ---
    const getStatusTag = (status) => {
        switch (status) {
            case 'queued': return <Tag icon={<ClockCircleOutlined />} color="processing">QUEUED</Tag>;
            case 'running': return <Tag icon={<LoadingOutlined spin />} color="warning">RUNNING</Tag>;
            case 'completed': return <Tag icon={<CheckCircleOutlined />} color="success">COMPLETED</Tag>;
            case 'failed': return <Tag icon={<CloseCircleOutlined />} color="error">FAILED</Tag>;
            default: return <Tag>{status?.toUpperCase()}</Tag>;
        }
    };

    // --- Data Fetching ---
    const fetchExperiments = useCallback(async (isPolling = false) => {
        if (!training?.id) return;
        try {
            const data = await projectsAPI.getTrainingExperiments(training.id);
            const preds = data.filter(e => e.experiment_type === 'prediction');
            preds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setExperiments(preds);

            const runningExp = preds.find(e => e.status === 'running');
            setPollingActive(!!runningExp);

            if (isPolling && selectedExp && runningExp && selectedExp.id === runningExp.id) {
                setSelectedExp(runningExp);
            } else if (isPolling && selectedExp && selectedExp.status === 'running' && !runningExp) {
                const finished = preds.find(e => e.id === selectedExp.id);
                if (finished) {
                    setSelectedExp(finished);
                    message.success(`Prediction "${finished.name}" completed!`);
                }
            }

            if (!isPolling && !selectedExp && preds.length > 0) {
                const latest = preds[0];
                setSelectedExp(latest);
                if (latest.status === 'queued') {
                    setConfig({
                        name: latest.name || '',
                        dataset_source: latest.dataset_source || 'test',
                        task: latest.task || training?.taskType || 'detection',
                        confidence: latest.confidence || 0.25,
                        iou_threshold: latest.iou_threshold || 0.45,
                        imgsz: latest.imgsz || 640,
                        weights_type: latest.weights_type || 'best'
                    });
                }
            }
        } catch (error) {
            if (!isPolling) handleAPIError(error, 'Failed to load experiments');
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, [training?.id, selectedExp]);

    useEffect(() => {
        if (pollingActive) {
            pollTimerRef.current = setInterval(() => fetchExperiments(true), 3000);
        } else if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
        }
        return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
    }, [pollingActive, fetchExperiments]);

    useEffect(() => {
        fetchExperiments();
    }, [training?.id]);

    // --- Filtering Logic ---
    useEffect(() => {
        if (!selectedExp || !selectedExp.predictions || experimentImages.length === 0) {
            setFilteredImages(experimentImages);
            return;
        }

        const { detectionCount, className, confidence } = filters;
        const preds = selectedExp.predictions;

        const filtered = experimentImages.filter(imgName => {
            const detections = preds[imgName] || [];

            // 1. Detection Count Filter
            let countMatch = true;
            if (detectionCount === '0') countMatch = detections.length === 0;
            else if (detectionCount === '1-5') countMatch = detections.length >= 1 && detections.length <= 5;
            else if (detectionCount === '6-10') countMatch = detections.length >= 6 && detections.length <= 10;
            else if (detectionCount === '10+') countMatch = detections.length > 10;

            // 2. Class Filter
            let classMatch = true;
            if (className !== 'all') {
                classMatch = detections.some(d => d.class === className);
            }

            // 3. Confidence Filter (applied to any detection in image)
            let confMatch = true;
            if (detections.length > 0) {
                confMatch = detections.some(d => d.confidence >= confidence);
            } else if (confidence > 0 && detectionCount === 'any') {
                // If filtering by confidence but no detections, don't show unless 'any' count
                confMatch = false;
            }

            return countMatch && classMatch && confMatch;
        });

        setFilteredImages(filtered);
    }, [filters, selectedExp, experimentImages]);

    // --- Actions ---
    const updateParam = async (key, value) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);

        if (selectedExp && selectedExp.status === 'queued') {
            try {
                await projectsAPI.updatePredictionDraft(selectedExp.id, { [key]: value });
                setExperiments(prev => prev.map(e => e.id === selectedExp.id ? { ...e, [key]: value } : e));
            } catch (error) { console.error("Failed to sync param:", error); }
        } else if (!selectedExp || selectedExp.status !== 'queued') {
            try {
                const initPayload = { ...newConfig, training_id: training.id };
                const draft = await projectsAPI.initPrediction(training.id, initPayload);
                setSelectedExp(draft);
                setExperiments(prev => [draft, ...prev.filter(e => e.status !== 'queued')]);
            } catch (error) { console.error("Failed to init draft:", error); }
        }
    };

    // --- UI Helpers ---
    const renderKPICard = (label, value, icon, color, tooltipText) => (
        <Tooltip title={tooltipText || label}>
            <Card className="p-stat-card">
                <div className="p-stat-icon-circle" style={{ '--gradient-start': color }}>
                    <div className="p-stat-icon">{icon}</div>
                </div>
                <div className="p-stat-value">{value}</div>
                <div className="p-stat-label">{label}</div>
            </Card>
        </Tooltip>
    );

    const stats = selectedExp?.analytics_summary || {};

    const deleteExperiment = async (id) => {
        try {
            await projectsAPI.deleteExperiment(id);
            message.success("Experiment deleted");
            setExperiments(prev => prev.filter(e => e.id !== id));
            if (selectedExp?.id === id) {
                setSelectedExp(null);
                setConfig({
                    name: '',
                    dataset_source: 'test',
                    confidence: 0.25,
                    iou_threshold: 0.45,
                    imgsz: 640,
                    weights_type: 'best',
                    max_det: 300,
                    device: '0'
                });
            }
        } catch (error) {
            handleAPIError(error, 'Failed to delete experiment');
        }
    };

    const handleDownload = async () => {
        if (!selectedExp || selectedExp.status !== 'completed') return;
        try {
            message.loading("Preparing download...", 2);
            const { blob, filename } = await projectsAPI.downloadExperimentResults(selectedExp.id);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleAPIError(error, 'Failed to download results');
        }
    };

    const handleRun = async () => {
        if (!config.name) { message.warning("Please enter an experiment name"); return; }
        try {
            setRunning(true);
            await projectsAPI.triggerPrediction(training.id, config);
            message.loading(`Starting prediction: ${config.name}...`, 2);
            await fetchExperiments();
            setPollingActive(true);
        } catch (error) { handleAPIError(error, 'Failed to start prediction'); }
        finally { setRunning(false); }
    };

    const handleReset = () => {
        setConfig({
            name: '',
            dataset_source: 'test',
            confidence: 0.25,
            iou_threshold: 0.45,
            imgsz: 640,
            weights_type: 'best',
            max_det: 300,
            device: '0'
        });
        setSelectedExp(null);
    };

    useEffect(() => {
        const loadResults = async () => {
            if (selectedExp && selectedExp.status === 'completed') {
                setFetchingResults(true);
                try {
                    const images = await projectsAPI.getExperimentImages(selectedExp.id);
                    setExperimentImages(images);
                } catch (error) { console.error("Failed to load images:", error); }
                finally { setFetchingResults(false); }
            } else {
                setExperimentImages([]);
            }
        };
        loadResults();
    }, [selectedExp?.id, selectedExp?.status]);

    if (loading) return <div className="prediction-view-container"><Spin size="large" /></div>;

    const availableClasses = selectedExp?.analytics_summary?.classes_detected ? Object.keys(selectedExp.analytics_summary.classes_detected) : [];

    return (
        <div className="prediction-view-container">
            <div className="prediction-layout">
                {/* --- Left Sidebar: History --- */}
                <div className="prediction-left-col">
                    <Card
                        title={
                            <Tooltip title="View all your prediction experiments. Click an experiment to see its results and configurations.">
                                <Space style={{ cursor: 'help' }}><HistoryOutlined /> History</Space>
                            </Tooltip>
                        }
                        className="history-card"
                        size="small"
                        extra={<Button type="text" icon={<SyncOutlined />} onClick={() => fetchExperiments()} />}
                    >
                        <List
                            dataSource={experiments}
                            renderItem={item => (
                                <List.Item
                                    className={`exp-list-item ${selectedExp?.id === item.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedExp(item);
                                        if (item.status === 'queued') {
                                            setConfig({
                                                name: item.name || '',
                                                dataset_source: item.dataset_source || 'test',
                                                confidence: item.confidence || 0.25,
                                                iou_threshold: item.iou_threshold || 0.45,
                                                imgsz: item.imgsz || 640,
                                                weights_type: item.weights_type || 'best'
                                            });
                                        }
                                    }}
                                >
                                    <div className="history-item-meta">
                                        <div className="history-item-title">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Text strong>{item.name || 'Unnamed'}</Text>
                                                {getStatusTag(item.status)}
                                            </div>
                                            <Button
                                                type="text"
                                                danger
                                                size="small"
                                                icon={<DeleteOutlined />}
                                                onClick={(e) => { e.stopPropagation(); deleteExperiment(item.id); }}
                                            />
                                        </div>
                                        <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                            {item.confidence} Conf • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </div>
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty description="No experiments" /> }}
                        />
                    </Card>
                </div>

                {/* --- Right Content Column --- */}
                <div className="prediction-right-col">
                    {/* 1. Configuration Section */}
                    <div className="config-section-container">
                        <div className="section-header"><SettingOutlined /> Configuration</div>
                        <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                Configure these settings to run a new prediction experiment and detect objects in your images.
                            </Text>
                        </div>
                        <div className="config-grid">
                            {/* Column 1: Basic Info */}
                            <div className="config-item">
                                <Tooltip title="Unique name to identify this prediction run. Helps organize and compare results later.">
                                    <Text strong style={{ cursor: 'help' }}>Experiment Name</Text>
                                </Tooltip>
                                <Input
                                    placeholder="Timestamp name if empty"
                                    value={config.name}
                                    onChange={e => updateParam('name', e.target.value)}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                />
                            </div>

                            {/* Column 2: Confidence Slider */}
                            <div className="config-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <Tooltip title="Minimum confidence score (0-1) for object detections. Lower values detect more objects but may include false positives.">
                                        <Text strong style={{ cursor: 'help' }}>Confidence</Text>
                                    </Tooltip>
                                    <InputNumber
                                        min={0.01} max={1.0} step={0.01}
                                        value={config.confidence}
                                        size="small"
                                        onChange={val => updateParam('confidence', val)}
                                        disabled={selectedExp && selectedExp.status !== 'queued'}
                                        style={{ width: '80px' }}
                                    />
                                </div>
                                <Slider
                                    min={0.01} max={1.00} step={0.01}
                                    value={config.confidence}
                                    onChange={val => updateParam('confidence', val)}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                />
                            </div>

                            {/* Column 3: Prediction Task (Only for segmentation models) */}
                            {training?.taskType === 'segmentation' && (
                                <div className="config-item">
                                    <Tooltip title="Type of prediction to perform: Object Detection (bounding boxes) or Segmentation (pixel-level masks).">
                                        <Text strong style={{ cursor: 'help' }}>Prediction Task</Text>
                                    </Tooltip>
                                    <Select
                                        value={config.task}
                                        onChange={val => updateParam('task', val)}
                                        disabled={selectedExp && selectedExp.status !== 'queued'}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="segmentation">Instance Segmentation (Recommended)</Option>
                                        <Option value="detection">Object Detection</Option>
                                    </Select>
                                </div>
                            )}

                            {/* Column 1: Dataset Split */}
                            <div className="config-item">
                                <Tooltip title="Choose which dataset to run predictions on: Test/Val/Train sets, or upload custom images.">
                                    <Text strong style={{ cursor: 'help' }}>Select Prediction Data</Text>
                                </Tooltip>
                                <Select
                                    value={config.dataset_source}
                                    onChange={val => updateParam('dataset_source', val)}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                    style={{ width: '100%' }}
                                >
                                    <Option value="test">Test Set</Option>
                                    <Option value="val">Validation Set</Option>
                                    <Option value="train">Training Set</Option>
                                    <Option value="upload">Upload Files</Option>
                                </Select>
                            </div>

                            {/* Column 2: IoU Threshold Slider */}
                            <div className="config-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <Tooltip title="Intersection over Union threshold for Non-Maximum Suppression. Higher values remove more overlapping boxes.">
                                        <Text strong style={{ cursor: 'help' }}>IoU Threshold</Text>
                                    </Tooltip>
                                    <InputNumber
                                        min={0.01} max={1.0} step={0.01}
                                        value={config.iou_threshold}
                                        size="small"
                                        onChange={val => updateParam('iou_threshold', val)}
                                        disabled={selectedExp && selectedExp.status !== 'queued'}
                                        style={{ width: '80px' }}
                                    />
                                </div>
                                <Slider
                                    min={0.01} max={1.00} step={0.01}
                                    value={config.iou_threshold}
                                    onChange={val => updateParam('iou_threshold', val)}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                />
                            </div>

                            {/* Column 3: Image Size */}
                            <div className="config-item">
                                <Tooltip title="Input image resolution for predictions. Higher values (1280px) are more accurate but slower, lower (320px) are faster.">
                                    <Text strong style={{ cursor: 'help' }}>Image Size</Text>
                                </Tooltip>
                                <Select
                                    value={config.imgsz}
                                    onChange={val => updateParam('imgsz', val)}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                    style={{ width: '100%' }}
                                >
                                    <Option value={320}>320px (Fast)</Option>
                                    <Option value={640}>640px (Default)</Option>
                                    <Option value={1280}>1280px (Accurate)</Option>
                                </Select>
                            </div>

                            {/* Empty cell to maintain grid alignment */}
                            <div className="config-item" style={{ visibility: 'hidden' }}></div>

                            {/* Empty cell to maintain grid alignment */}
                            <div className="config-item" style={{ visibility: 'hidden' }}></div>

                            {/* Column 3: Model Weights */}
                            <div className="config-item">
                                <Tooltip title="Best: Uses model checkpoint with highest validation metrics. Last: Uses final checkpoint from training.">
                                    <Text strong style={{ cursor: 'help' }}>Model Weights</Text>
                                </Tooltip>
                                <Select
                                    value={config.weights_type}
                                    onChange={val => updateParam('weights_type', val)}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                    style={{ width: '100%' }}
                                >
                                    <Option value="best">Best Weights</Option>
                                    <Option value="last">Last Weights</Option>
                                </Select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'space-between' }}>
                            <Space>
                                <Button icon={<LineChartOutlined />} onClick={() => setAnalyticsVisible(true)} disabled={!selectedExp || selectedExp.status !== 'completed'}>📈 Analytics</Button>
                                <Button icon={<ExperimentOutlined />} onClick={() => setCompareVisible(true)} disabled={experiments.length < 2}>📊 Compare</Button>
                            </Space>
                            <Space>
                                <Button onClick={handleReset}>Reset Defaults</Button>
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={handleRun}
                                    loading={running}
                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                >
                                    Run Prediction
                                </Button>
                            </Space>
                        </div>
                    </div>

                    {/* 1.5. KPI Metrics Section */}
                    {
                        selectedExp && selectedExp.status === 'completed' && (
                            <div className="p-kpi-grid">
                                {renderKPICard("Total Objects", stats.total_objects || 0, <CheckCircleOutlined />, "#1890ff", "Total number of items detected across all images")}
                                {renderKPICard("Images w/ Det", stats.images_with_detections || 0, <EyeOutlined />, "#52c41a", "Number of images where at least one object was found")}
                                {renderKPICard("Avg Confidence", ((stats.avg_confidence || 0) * 100).toFixed(1) + "%", <SyncOutlined />, "#722ed1", "Mean confidence score of all predictions")}
                                {renderKPICard("Process Time", (selectedExp.duration_sec || 0).toFixed(1) + "s", <ClockCircleOutlined />, "#fa8c16", "Total duration of the prediction run")}
                            </div>
                        )
                    }

                    {/* 2. Filter Bar Section */}
                    {
                        selectedExp && selectedExp.status === 'completed' && (
                            <div className="filter-section-container">
                                <div className="section-title" style={{ marginBottom: 0 }}><SearchOutlined /> 🔍 Filter Results</div>
                                <Space size="large">
                                    <div>
                                        <Text type="secondary" style={{ marginRight: 8 }}>Detection:</Text>
                                        <Select
                                            value={filters.detectionCount}
                                            onChange={val => setFilters(f => ({ ...f, detectionCount: val }))}
                                            style={{ width: 100 }}
                                            size="small"
                                        >
                                            <Option value="any">Any</Option>
                                            <Option value="0">None (0)</Option>
                                            <Option value="1-5">1-5</Option>
                                            <Option value="6-10">6-10</Option>
                                            <Option value="10+">10+</Option>
                                        </Select>
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ marginRight: 8 }}>Class:</Text>
                                        <Select
                                            value={filters.className}
                                            onChange={val => setFilters(f => ({ ...f, className: val }))}
                                            style={{ width: 120 }}
                                            size="small"
                                        >
                                            <Option value="all">All Classes</Option>
                                            {availableClasses.map(c => <Option key={c} value={c}>{c}</Option>)}
                                        </Select>
                                    </div>
                                    <Button type="link" size="small" onClick={() => setFilters({ detectionCount: 'any', className: 'all', confidence: 0.25 })}>Clear Filters</Button>
                                    <Text type="secondary" style={{ marginLeft: 'auto' }}>
                                        Showing {filteredImages.length} of {experimentImages.length}
                                    </Text>
                                </Space>
                            </div>
                        )
                    }

                    {/* 3. Gallery Section */}
                    <div className="gallery-section-container">
                        <div className="gallery-header">
                            <Tooltip title="Browse prediction results. Click any image to view detailed detection boxes and confidence scores.">
                                <span style={{ cursor: 'help' }}><EyeOutlined /> Image Gallery</span>
                            </Tooltip>
                            <Button
                                icon={<DownloadOutlined />}
                                size="small"
                                onClick={handleDownload}
                                disabled={!selectedExp || selectedExp.status !== 'completed'}
                            >
                                Download Result
                            </Button>
                        </div>

                        {selectedExp?.status === 'running' ? (
                            <div style={{ padding: '4rem', textAlign: 'center' }}>
                                <Spin tip="Running prediction... this may take a while" />
                            </div>
                        ) : fetchingResults ? (
                            <div style={{ padding: '4rem' }}><Skeleton active /></div>
                        ) : filteredImages.length > 0 ? (
                            <div className="prediction-gallery-grid">
                                {filteredImages.map(imgName => {
                                    const detections = selectedExp?.predictions?.[imgName] || [];
                                    const imageUrl = `${window.location.protocol}//${window.location.hostname}:12000/${selectedExp.output_folder}/${imgName}`;
                                    return (
                                        <div key={imgName} className="prediction-gallery-item" onClick={() => { setPreviewImage(imgName); setPreviewVisible(true); }}>
                                            <Badge count={detections.length} className="detection-badge" color="#1890ff" />
                                            <img src={imageUrl} alt={imgName} loading="lazy" />
                                            <div className="image-overlay"><EyeOutlined style={{ color: '#fff', fontSize: 24 }} /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: '4rem' }}>
                                <Empty description={selectedExp?.status === 'completed' ? "No images match your filters" : "Run a prediction to see results"} />
                            </div>
                        )}
                    </div>
                </div>
            </div >

            {/* Implemented Modals */}
            < ImageViewerModal
                visible={previewVisible}
                onCancel={() => setPreviewVisible(false)}
                currentImage={previewImage}
                images={filteredImages}
                experiment={selectedExp}
                onNavigate={(newImg) => setPreviewImage(newImg)}
            />

            < AnalyticsModal
                visible={analyticsVisible}
                onCancel={() => setAnalyticsVisible(false)}
                experiment={selectedExp}
            />

            <ComparisonModal
                visible={compareVisible}
                onCancel={() => setCompareVisible(false)}
                experiments={experiments}
            />
        </div >
    );
};


export default PredictionView;
