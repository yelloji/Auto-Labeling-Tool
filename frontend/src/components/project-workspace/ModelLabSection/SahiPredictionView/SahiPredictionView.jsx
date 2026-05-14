import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Empty,
    Form,
    Input,
    InputNumber,
    List,
    Modal,
    Row,
    Select,
    Space,
    Spin,
    Statistic,
    Switch,
    Tag,
    Tooltip,
    Typography,
    message
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EyeOutlined,
    FileImageOutlined,
    LoadingOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
    ScissorOutlined
} from '@ant-design/icons';
import { projectsAPI, handleAPIError } from '../../../../services/api';
import './SahiPredictionView.css';

const { Text, Title } = Typography;
const { Option } = Select;

const DEFAULT_CONFIG = {
    name: '',
    dataset_source: 'dataset_images',
    task: 'detect',
    weights_type: 'best',
    confidence: 0.5,
    slice_height: 896,
    slice_width: 896,
    overlap_height_ratio: 0.25,
    overlap_width_ratio: 0.25,
    postprocess_match_threshold: 0.3,
    postprocess_class_agnostic: true,
    no_standard_prediction: true,
    no_sliced_prediction: false,
    visual_hide_labels: false,
    visual_hide_conf: false,
    device: 'auto'
};

const isRunningStatus = (status) => ['queued', 'running'].includes(status);

const normalizeTask = (training) => {
    const task = training?.taskType || training?.task || 'detection';
    return task === 'segmentation' || task === 'segment' ? 'segment' : 'detect';
};

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getExperimentParams = (experiment) => {
    const params = experiment?.custom_params;
    if (!params) return {};
    if (typeof params === 'string') {
        try {
            return JSON.parse(params);
        } catch {
            return {};
        }
    }
    return params;
};

const getStatusTag = (status) => {
    switch (status) {
        case 'queued':
            return <Tag icon={<ClockCircleOutlined />} color="processing">QUEUED</Tag>;
        case 'running':
            return <Tag icon={<LoadingOutlined spin />} color="warning">RUNNING</Tag>;
        case 'completed':
            return <Tag icon={<CheckCircleOutlined />} color="success">COMPLETED</Tag>;
        case 'failed':
            return <Tag icon={<CloseCircleOutlined />} color="error">FAILED</Tag>;
        default:
            return <Tag>{status?.toUpperCase() || 'UNKNOWN'}</Tag>;
    }
};

const countDetections = (experiment) => {
    if (experiment?.analytics_summary?.total_detections !== undefined) {
        return experiment.analytics_summary.total_detections;
    }
    if (!experiment?.predictions) return 0;
    return Object.values(experiment.predictions).reduce((sum, detections) => {
        return sum + (Array.isArray(detections) ? detections.length : 0);
    }, 0);
};

const getImageDetections = (experiment, imageName) => {
    if (!experiment?.predictions || !imageName) return [];
    const fileName = imageName.split('/').pop();
    return experiment.predictions[imageName] || experiment.predictions[fileName] || [];
};

const buildImageUrl = (experimentId, imageName, thumbnail = true) => {
    if (!experimentId || !imageName) return '';
    const suffix = thumbnail ? '?thumbnail=true&size=320' : '';
    return `${window.location.protocol}//${window.location.hostname}:12000/api/v1/experiments/${experimentId}/original-image/${imageName}${suffix}`;
};

const SahiPredictionView = ({ training }) => {
    const [form] = Form.useForm();
    const [experiments, setExperiments] = useState([]);
    const [selectedExp, setSelectedExp] = useState(null);
    const [queuedExp, setQueuedExp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const selectedExpRef = useRef(null);

    const defaultConfig = useMemo(() => ({
        ...DEFAULT_CONFIG,
        task: normalizeTask(training),
        name: training?.name ? `${training.name} SAHI Prediction` : 'SAHI Prediction'
    }), [training]);

    const hydrateFormFromExperiment = useCallback((experiment) => {
        const params = getExperimentParams(experiment);
        form.setFieldsValue({
            ...defaultConfig,
            ...params,
            name: experiment?.name || params.name || defaultConfig.name,
            dataset_source: params.dataset_source || experiment?.dataset_source || 'dataset_images',
            confidence: params.confidence ?? params.confidence_threshold ?? experiment?.confidence ?? 0.5,
            task: params.task || defaultConfig.task
        });
    }, [defaultConfig, form]);

    const fetchExperiments = useCallback(async (isPolling = false) => {
        if (!training?.id) return;
        try {
            const previousSelected = selectedExpRef.current;
            const [allExperiments, queued] = await Promise.all([
                projectsAPI.getTrainingExperiments(training.id),
                projectsAPI.getQueuedSahiPrediction(training.id)
            ]);
            const sahiExperiments = allExperiments
                .filter((experiment) => experiment.experiment_type === 'sahi_prediction')
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            setExperiments(sahiExperiments);
            setQueuedExp(queued);

            const current = previousSelected
                ? sahiExperiments.find((experiment) => experiment.id === previousSelected.id)
                : null;
            const nextSelected = current || sahiExperiments.find((experiment) => experiment.status !== 'queued') || sahiExperiments[0] || null;

            setSelectedExp(nextSelected);

            if (!isPolling) {
                if (queued) {
                    hydrateFormFromExperiment(queued);
                } else {
                    form.setFieldsValue(defaultConfig);
                }
            }

            if (isPolling && previousSelected?.status === 'running' && current?.status === 'completed') {
                message.success(`SAHI prediction "${current.name}" completed`);
            }
            if (isPolling && previousSelected?.status === 'running' && current?.status === 'failed') {
                message.error(`SAHI prediction "${current.name}" failed`);
            }
        } catch (error) {
            if (!isPolling) handleAPIError(error, 'Failed to load SAHI predictions');
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, [defaultConfig, form, hydrateFormFromExperiment, training?.id]);

    useEffect(() => {
        selectedExpRef.current = selectedExp;
    }, [selectedExp]);

    useEffect(() => {
        if (!training?.id) return;
        setLoading(true);
        setSelectedExp(null);
        setGalleryImages([]);
        form.setFieldsValue(defaultConfig);
        fetchExperiments(false);
    }, [defaultConfig, fetchExperiments, form, training?.id]);

    useEffect(() => {
        const hasActiveExperiment = experiments.some((experiment) => isRunningStatus(experiment.status));
        if (!hasActiveExperiment && !running) return undefined;

        const intervalId = window.setInterval(() => {
            fetchExperiments(true);
        }, 4000);

        return () => window.clearInterval(intervalId);
    }, [experiments, fetchExperiments, running]);

    useEffect(() => {
        const loadGallery = async () => {
            if (!selectedExp || selectedExp.status !== 'completed') {
                setGalleryImages([]);
                return;
            }
            setGalleryLoading(true);
            try {
                const images = await projectsAPI.getExperimentImages(selectedExp.id);
                setGalleryImages(Array.isArray(images) ? images : []);
            } catch (error) {
                console.error('Failed to load SAHI result images:', error);
                setGalleryImages([]);
            } finally {
                setGalleryLoading(false);
            }
        };

        loadGallery();
    }, [selectedExp]);

    const selectedStats = useMemo(() => {
        const totalDetections = countDetections(selectedExp);
        const imageCount = selectedExp?.image_count || selectedExp?.analytics_summary?.image_count || galleryImages.length || 0;
        const averageConfidence = selectedExp?.analytics_summary?.average_confidence;
        const params = getExperimentParams(selectedExp);

        return {
            imageCount,
            totalDetections,
            averageConfidence,
            splitCounts: params.input_split_counts || selectedExp?.analytics_summary?.input_split_counts || {}
        };
    }, [galleryImages.length, selectedExp]);

    const handleSaveDraft = async () => {
        if (!training?.id) return;
        try {
            const values = await form.validateFields();
            setSavingDraft(true);
            const payload = {
                ...values,
                dataset_source: 'dataset_images',
                custom_params: values
            };
            const result = queuedExp
                ? await projectsAPI.updateSahiPredictionDraft(queuedExp.id, payload)
                : await projectsAPI.initSahiPrediction(training.id, payload);
            setQueuedExp(result.experiment || result);
            message.success('SAHI draft saved');
            fetchExperiments(false);
        } catch (error) {
            if (error?.errorFields) return;
            handleAPIError(error, 'Failed to save SAHI draft');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleRun = async () => {
        if (!training?.id) return;
        try {
            const values = await form.validateFields();
            setRunning(true);
            const payload = {
                ...values,
                dataset_source: 'dataset_images',
                custom_params: values
            };
            const response = await projectsAPI.triggerSahiPrediction(training.id, payload);
            message.success('SAHI prediction started');
            if (response?.experiment) setSelectedExp(response.experiment);
            await fetchExperiments(false);
        } catch (error) {
            if (error?.errorFields) return;
            handleAPIError(error, 'Failed to start SAHI prediction');
        } finally {
            setRunning(false);
        }
    };

    const handleDelete = (experiment) => {
        Modal.confirm({
            title: 'Delete SAHI Prediction',
            content: `Delete "${experiment.name}" and its stored result metadata?`,
            okText: 'Delete',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await projectsAPI.deleteExperiment(experiment.id);
                    message.success('SAHI prediction deleted');
                    setExperiments((items) => items.filter((item) => item.id !== experiment.id));
                    if (selectedExp?.id === experiment.id) {
                        setSelectedExp(null);
                        setGalleryImages([]);
                    }
                    fetchExperiments(false);
                } catch (error) {
                    handleAPIError(error, 'Failed to delete SAHI prediction');
                }
            }
        });
    };

    const handleDownload = async (experiment = selectedExp) => {
        if (!experiment || experiment.status !== 'completed') return;
        try {
            message.loading('Preparing SAHI result download...', 2);
            const { blob, filename } = await projectsAPI.downloadExperimentResults(experiment.id);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename || `sahi_prediction_${experiment.id}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            handleAPIError(error, 'Failed to download SAHI prediction');
        }
    };

    if (loading) {
        return (
            <div className="sahi-prediction-view sahi-prediction-loading">
                <Spin tip="Loading SAHI prediction workspace..." />
            </div>
        );
    }

    return (
        <div className="sahi-prediction-view">
            <div className="sahi-prediction-header">
                <div>
                    <Space align="center">
                        <ScissorOutlined className="sahi-header-icon" />
                        <Title level={4}>SAHI Prediction</Title>
                    </Space>
                    <Text type="secondary">
                        Sliced inference on full original dataset-stage images for this tile-trained model.
                    </Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchExperiments(false)}>
                        Refresh
                    </Button>
                    <Button loading={savingDraft} onClick={handleSaveDraft}>
                        Save Draft
                    </Button>
                    <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={handleRun}>
                        Run SAHI
                    </Button>
                </Space>
            </div>

            <Row gutter={[16, 16]} className="sahi-main-grid">
                <Col xs={24} xl={7}>
                    <Card title="History" className="sahi-panel" bodyStyle={{ padding: 0 }}>
                        {experiments.length === 0 ? (
                            <Empty className="sahi-empty" description="No SAHI predictions yet" />
                        ) : (
                            <List
                                className="sahi-history-list"
                                dataSource={experiments}
                                renderItem={(experiment) => {
                                    const created = parseDate(experiment.created_at || experiment.date);
                                    const detections = countDetections(experiment);
                                    const active = selectedExp?.id === experiment.id;

                                    return (
                                        <List.Item
                                            className={active ? 'sahi-history-item active' : 'sahi-history-item'}
                                            onClick={() => setSelectedExp(experiment)}
                                        >
                                            <div className="sahi-history-main">
                                                <div className="sahi-history-title-row">
                                                    <Text strong ellipsis title={experiment.name}>{experiment.name}</Text>
                                                    {getStatusTag(experiment.status)}
                                                </div>
                                                <Text type="secondary">
                                                    {created ? created.toLocaleString() : 'Unknown date'}
                                                </Text>
                                                <div className="sahi-history-meta">
                                                    <Badge count={experiment.image_count || 0} overflowCount={99999} showZero />
                                                    <Text type="secondary">images</Text>
                                                    <Badge count={detections} overflowCount={99999} showZero color="#0f766e" />
                                                    <Text type="secondary">detections</Text>
                                                </div>
                                            </div>
                                            <Space size={4} onClick={(event) => event.stopPropagation()}>
                                                <Tooltip title="Download result">
                                                    <Button
                                                        size="small"
                                                        icon={<DownloadOutlined />}
                                                        disabled={experiment.status !== 'completed'}
                                                        onClick={() => handleDownload(experiment)}
                                                    />
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <Button
                                                        size="small"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        disabled={isRunningStatus(experiment.status)}
                                                        onClick={() => handleDelete(experiment)}
                                                    />
                                                </Tooltip>
                                            </Space>
                                        </List.Item>
                                    );
                                }}
                            />
                        )}
                    </Card>
                </Col>

                <Col xs={24} xl={17}>
                    <Card title="Run Configuration" className="sahi-panel">
                        <Alert
                            type="info"
                            showIcon
                            className="sahi-config-alert"
                            message="Input source is fixed to full original dataset-stage images for this first SAHI workflow."
                        />
                        <Form
                            form={form}
                            layout="vertical"
                            initialValues={defaultConfig}
                            className="sahi-config-form"
                        >
                            <Row gutter={12}>
                                <Col xs={24} lg={12}>
                                    <Form.Item
                                        name="name"
                                        label="Prediction Name"
                                        rules={[{ required: true, message: 'Enter a prediction name' }]}
                                    >
                                        <Input placeholder="SAHI prediction name" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="dataset_source" label="Image Source">
                                        <Select disabled>
                                            <Option value="dataset_images">Dataset Images</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="weights_type" label="Weights">
                                        <Select>
                                            <Option value="best">Best</Option>
                                            <Option value="last">Last</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={12}>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="confidence" label="Confidence">
                                        <InputNumber min={0.01} max={1} step={0.05} precision={2} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="slice_width" label="Slice Width">
                                        <InputNumber min={128} max={4096} step={32} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="slice_height" label="Slice Height">
                                        <InputNumber min={128} max={4096} step={32} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="device" label="Device">
                                        <Select>
                                            <Option value="auto">Auto</Option>
                                            <Option value="cuda:0">CUDA 0</Option>
                                            <Option value="cpu">CPU</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={12}>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="overlap_width_ratio" label="Width Overlap">
                                        <InputNumber min={0} max={0.9} step={0.05} precision={2} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="overlap_height_ratio" label="Height Overlap">
                                        <InputNumber min={0} max={0.9} step={0.05} precision={2} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="postprocess_match_threshold" label="Merge Threshold">
                                        <InputNumber min={0.05} max={1} step={0.05} precision={2} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="postprocess_class_agnostic" label="Class-Agnostic Merge" valuePropName="checked">
                                        <Switch />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Form>
                    </Card>

                    <Row gutter={[16, 16]} className="sahi-stats-row">
                        <Col xs={24} md={8}>
                            <Card className="sahi-stat-card">
                                <Statistic title="Images" value={selectedStats.imageCount} prefix={<FileImageOutlined />} />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card className="sahi-stat-card">
                                <Statistic title="Detections" value={selectedStats.totalDetections} />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card className="sahi-stat-card">
                                <Statistic
                                    title="Avg Confidence"
                                    value={selectedStats.averageConfidence ?? 0}
                                    precision={2}
                                />
                            </Card>
                        </Col>
                    </Row>

                    <Card
                        className="sahi-panel sahi-gallery-panel"
                        title="Result Gallery"
                        extra={selectedExp ? getStatusTag(selectedExp.status) : null}
                    >
                        {!selectedExp ? (
                            <Empty description="Run or select a SAHI prediction" />
                        ) : selectedExp.status === 'running' ? (
                            <div className="sahi-gallery-loading">
                                <Spin tip="SAHI sliced inference is running..." />
                            </div>
                        ) : selectedExp.status === 'failed' ? (
                            <Alert
                                type="error"
                                showIcon
                                message="SAHI prediction failed"
                                description={selectedExp.error_message || 'Open the backend log for more details.'}
                            />
                        ) : galleryLoading ? (
                            <div className="sahi-gallery-loading"><Spin /></div>
                        ) : galleryImages.length === 0 ? (
                            <Empty description="No result images available yet" />
                        ) : (
                            <div className="sahi-gallery-grid">
                                {galleryImages.map((imageName) => {
                                    const detections = getImageDetections(selectedExp, imageName);
                                    const displayName = imageName.split('/').pop();
                                    return (
                                        <button
                                            type="button"
                                            key={imageName}
                                            className="sahi-gallery-item"
                                            onClick={() => setPreviewImage(imageName)}
                                            title={imageName}
                                        >
                                            <div className="sahi-image-thumb">
                                                <img
                                                    src={buildImageUrl(selectedExp.id, imageName, true)}
                                                    alt={displayName}
                                                    loading="lazy"
                                                />
                                                <div className="sahi-image-hover">
                                                    <EyeOutlined />
                                                </div>
                                            </div>
                                            <div className="sahi-image-caption">
                                                <Text ellipsis>{displayName}</Text>
                                                <Badge count={detections.length} overflowCount={999} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal
                open={!!previewImage}
                onCancel={() => setPreviewImage(null)}
                footer={null}
                width="82vw"
                title={previewImage?.split('/').pop()}
                destroyOnClose
            >
                {previewImage && (
                    <img
                        className="sahi-preview-image"
                        src={buildImageUrl(selectedExp?.id, previewImage, false)}
                        alt={previewImage}
                    />
                )}
            </Modal>
        </div>
    );
};

SahiPredictionView.propTypes = {
    training: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
        name: PropTypes.string,
        task: PropTypes.string,
        taskType: PropTypes.string
    }).isRequired
};

export default SahiPredictionView;
