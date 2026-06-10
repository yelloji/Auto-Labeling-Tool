import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    Col,
    Divider,
    Empty,
    Form,
    Input,
    InputNumber,
    List,
    Modal,
    Radio,
    Row,
    Select,
    Space,
    Spin,
    Statistic,
    Slider,
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
    PlusOutlined,
    SearchOutlined,
    ScissorOutlined
} from '@ant-design/icons';
import ImageViewerModal from '../PredictionView/ImageViewerModal';
import { projectsAPI, handleAPIError } from '../../../../services/api';
import './SahiPredictionView.css';

const { Text, Title } = Typography;
const { Option } = Select;

const DEFAULT_CONFIG = {
    name: '',
    dataset_source: 'dataset_images',
    split: 'all',
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

const DEFAULT_FILTERS = {
    detectionCount: 'any',
    className: 'all',
    selectedClasses: [],
    confidenceRange: [10, 100],
    imageSearch: '',
    riskLevel: 'any',
    reviewStatus: 'any',
    overlapIoU: 0.5,
    showOverlapping: false,
    isolateOverlaps: false,
    showOnlyDuplicates: false,
    selectedSizeGroup: 'all',
    isolateBySize: false
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

const calculateIoU = (bbox1, bbox2) => {
    if (!bbox1 || !bbox2 || bbox1.length !== 4 || bbox2.length !== 4) return 0;
    const x1 = Math.max(bbox1[0], bbox2[0]);
    const y1 = Math.max(bbox1[1], bbox2[1]);
    const x2 = Math.min(bbox1[2], bbox2[2]);
    const y2 = Math.min(bbox1[3], bbox2[3]);
    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1]);
    const area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1]);
    const union = area1 + area2 - intersection;
    return union > 0 ? intersection / union : 0;
};

const resetFilterState = () => ({
    ...DEFAULT_FILTERS,
    selectedClasses: [],
    confidenceRange: [...DEFAULT_FILTERS.confidenceRange]
});

const SahiPredictionView = ({ training }) => {
    const [form] = Form.useForm();
    const watchedName = Form.useWatch('name', form);
    const [experiments, setExperiments] = useState([]);
    const [selectedExp, setSelectedExp] = useState(null);
    const [queuedExp, setQueuedExp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const [filters, setFilters] = useState(resetFilterState);
    const [projectLabels, setProjectLabels] = useState([]);
    const [verifications, setVerifications] = useState([]);
    const [historyHeight, setHistoryHeight] = useState('100%');
    const [sahiCounts, setSahiCounts] = useState({ split_counts: {}, total: 0, available_splits: [] });
    const selectedExpRef = useRef(null);
    const syncTimeoutRef = useRef(null);
    const galleryRef = useRef(null);
    const layoutRef = useRef(null);

    const defaultConfig = useMemo(() => ({
        ...DEFAULT_CONFIG,
        task: normalizeTask(training),
        name: ''
    }), [training]);

    const hydrateFormFromExperiment = useCallback((experiment) => {
        const params = getExperimentParams(experiment);
        form.setFieldsValue({
            ...defaultConfig,
            ...params,
            name: experiment?.name || params.name || defaultConfig.name,
            dataset_source: params.dataset_source || experiment?.dataset_source || 'dataset_images',
            split: params.split || defaultConfig.split,
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
        setPreviewImage(null);
        setFilters(resetFilterState());
        form.setFieldsValue(defaultConfig);
        fetchExperiments(false);
    }, [defaultConfig, fetchExperiments, form, training?.id]);

    // Fetch SAHI full-image counts per split (different from release/tile counts)
    useEffect(() => {
        if (!training?.id) {
            setSahiCounts({ split_counts: {}, total: 0, available_splits: [] });
            return;
        }
        let cancelled = false;
        projectsAPI.getSahiAvailableImages(training.id).then((data) => {
            if (!cancelled && data) setSahiCounts(data);
        });
        return () => { cancelled = true; };
    }, [training?.id]);

    const projectId = training?.project_id || training?.projectId;

    const fetchProjectLabels = useCallback(async () => {
        if (!projectId) return;
        try {
            const labels = await projectsAPI.getProjectLabels(projectId);
            setProjectLabels(labels || []);
        } catch (error) {
            console.error('Failed to fetch SAHI project labels:', error);
        }
    }, [projectId]);

    const fetchVerifications = useCallback(async () => {
        if (!projectId) return;
        try {
            const data = await projectsAPI.getProjectVerifications(projectId);
            setVerifications(data || []);
        } catch (error) {
            console.error('Failed to fetch SAHI verifications:', error);
        }
    }, [projectId]);

    useEffect(() => {
        fetchProjectLabels();
        fetchVerifications();
    }, [fetchProjectLabels, fetchVerifications]);

    useEffect(() => {
        return () => {
            if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
        };
    }, []);

    const updateAlignment = useCallback(() => {
        if (!galleryRef.current || !layoutRef.current) return;
        const galleryRect = galleryRef.current.getBoundingClientRect();
        const layoutRect = layoutRef.current.getBoundingClientRect();
        const topOffset = galleryRect.top - layoutRect.top;

        if (selectedExp?.status === 'completed' && topOffset > 100) {
            setHistoryHeight(`${topOffset - 24}px`);
        } else {
            setHistoryHeight('100%');
        }
    }, [selectedExp]);

    useEffect(() => {
        updateAlignment();
        window.addEventListener('resize', updateAlignment);

        const observer = new ResizeObserver(updateAlignment);
        if (layoutRef.current) observer.observe(layoutRef.current);

        return () => {
            window.removeEventListener('resize', updateAlignment);
            observer.disconnect();
        };
    }, [updateAlignment, experiments, selectedExp, galleryImages.length]);

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

    const availableClasses = useMemo(() => {
        if (selectedExp?.analytics_summary?.classes_detected) {
            return Object.keys(selectedExp.analytics_summary.classes_detected);
        }
        if (!selectedExp?.predictions) return [];
        const classes = new Set();
        Object.values(selectedExp.predictions).forEach((detections) => {
            if (Array.isArray(detections)) {
                detections.forEach((detection) => {
                    if (detection?.class) classes.add(detection.class);
                });
            }
        });
        return Array.from(classes).sort();
    }, [selectedExp]);

    const sizeGroups = useMemo(() => {
        if (!selectedExp?.predictions) return { thresholds: [0, 0, 0], count: 0 };
        const areas = [];
        Object.values(selectedExp.predictions).forEach((detections) => {
            if (Array.isArray(detections)) {
                detections.forEach((detection) => {
                    if (detection?.bbox?.length === 4) {
                        const [x1, y1, x2, y2] = detection.bbox;
                        areas.push((x2 - x1) * (y2 - y1));
                    }
                });
            }
        });
        if (areas.length === 0) return { thresholds: [0, 0, 0], count: 0 };
        areas.sort((a, b) => a - b);
        return {
            thresholds: [
                areas[Math.floor(areas.length * 0.25)],
                areas[Math.floor(areas.length * 0.5)],
                areas[Math.floor(areas.length * 0.75)]
            ],
            count: areas.length
        };
    }, [selectedExp]);

    const filteredImages = useMemo(() => {
        if (!selectedExp || selectedExp.status !== 'completed') return galleryImages;
        const minConf = filters.confidenceRange[0] / 100;
        const maxConf = filters.confidenceRange[1] / 100;

        return galleryImages.filter((imageName) => {
            const fileName = imageName.split('/').pop();
            if (filters.imageSearch && !imageName.toLowerCase().includes(filters.imageSearch.toLowerCase())) {
                return false;
            }

            const allDetections = getImageDetections(selectedExp, imageName);
            const imageVerifications = verifications.filter((verification) => verification.image_name === fileName);
            if (filters.reviewStatus !== 'any') {
                if (filters.reviewStatus === 'unverified') {
                    const hasReviewed = imageVerifications.some((verification) => verification.status === 'pass' || verification.status === 'fail');
                    if (hasReviewed) return false;
                } else if (!imageVerifications.some((verification) => verification.status === filters.reviewStatus)) {
                    return false;
                }
            }

            const matchingDetections = allDetections.filter((detection) => {
                const confidence = Number(detection.confidence || 0);
                const confMatch = confidence >= minConf && confidence <= maxConf;
                const classMatch = filters.selectedClasses.length > 0
                    ? filters.selectedClasses.includes(detection.class)
                    : filters.className === 'all' || detection.class === filters.className;

                let riskMatch = true;
                if (filters.riskLevel === 'high') riskMatch = confidence < 0.4;
                else if (filters.riskLevel === 'medium') riskMatch = confidence >= 0.4 && confidence < 0.7;
                else if (filters.riskLevel === 'low') riskMatch = confidence >= 0.7;

                let overlapMatch = true;
                if (filters.showOverlapping && filters.isolateOverlaps) {
                    overlapMatch = allDetections.some((otherDetection) => (
                        otherDetection !== detection &&
                        calculateIoU(detection.bbox, otherDetection.bbox) >= filters.overlapIoU
                    ));
                }

                let sizeMatch = true;
                if (filters.selectedSizeGroup !== 'all' && filters.isolateBySize && detection?.bbox?.length === 4) {
                    const [q25, q50, q75] = sizeGroups.thresholds;
                    const [x1, y1, x2, y2] = detection.bbox;
                    const area = (x2 - x1) * (y2 - y1);
                    if (filters.selectedSizeGroup === 'tiny') sizeMatch = area <= q25;
                    else if (filters.selectedSizeGroup === 'small') sizeMatch = area > q25 && area <= q50;
                    else if (filters.selectedSizeGroup === 'medium') sizeMatch = area > q50 && area <= q75;
                    else if (filters.selectedSizeGroup === 'large') sizeMatch = area > q75;
                }

                return confMatch && classMatch && riskMatch && overlapMatch && sizeMatch;
            });

            if (filters.detectionCount === 'no') return allDetections.length === 0;
            if (filters.detectionCount === 'yes') return matchingDetections.length > 0;
            if (filters.detectionCount === '1-5') return matchingDetections.length >= 1 && matchingDetections.length <= 5;
            if (filters.detectionCount === '6-10') return matchingDetections.length >= 6 && matchingDetections.length <= 10;
            if (filters.detectionCount === '10+') return matchingDetections.length > 10;

            if ((filters.selectedClasses.length > 0 || filters.className !== 'all' || filters.riskLevel !== 'any') && matchingDetections.length === 0) {
                return false;
            }
            return true;
        });
    }, [filters, galleryImages, selectedExp, sizeGroups, verifications]);

    const handleFormChange = async (changedValues, allValues) => {
        if (!training?.id) return;
        const selected = selectedExpRef.current;
        const changedKey = Object.keys(changedValues)[0];
        const name = (allValues.name || '').trim();

        if (!selected && changedKey === 'name' && name.length >= 3) {
            try {
                const payload = {
                    ...allValues,
                    name,
                    dataset_source: 'dataset_images',
                    custom_params: { ...allValues, name }
                };
                const draft = await projectsAPI.initSahiPrediction(training.id, payload);
                const experiment = draft.experiment || draft;
                selectedExpRef.current = experiment;
                setQueuedExp(experiment);
                setSelectedExp(experiment);
                setExperiments((items) => [experiment, ...items.filter((item) => item.id !== experiment.id)]);
            } catch (error) {
                console.error('Failed to initialize SAHI prediction draft:', error);
            }
            return;
        }

        if (!selected || selected.status !== 'queued') return;
        if (changedKey === 'name' && name.length < 3) return;

        if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = window.setTimeout(async () => {
            try {
                const payload = {
                    ...changedValues,
                    ...(changedKey === 'name' ? { name } : {}),
                    custom_params: {
                        ...getExperimentParams(selected),
                        ...allValues,
                        ...(changedKey === 'name' ? { name } : {})
                    }
                };
                await projectsAPI.updateSahiPredictionDraft(selected.id, payload);
                const updatedFields = {
                    ...changedValues,
                    ...(changedKey === 'name' ? { name } : {})
                };
                setExperiments((items) => items.map((item) => (
                    item.id === selected.id ? { ...item, ...updatedFields } : item
                )));
                setSelectedExp((current) => (
                    current?.id === selected.id ? { ...current, ...updatedFields } : current
                ));
                if (queuedExp?.id === selected.id) {
                    setQueuedExp((current) => current ? { ...current, ...updatedFields } : current);
                }
            } catch (error) {
                console.error('Failed to autosave SAHI prediction draft:', error);
            }
        }, 800);
    };

    const handleNameBlur = (event) => {
        const value = event.target.value.trim();
        const selected = selectedExpRef.current;
        if (selected && selected.status === 'queued' && value.length < 3) {
            form.setFieldsValue({ name: selected.name || 'Untitled Experiment' });
        }
    };

    const handleRun = async () => {
        if (!training?.id) return;
        try {
            const values = await form.validateFields();
            const name = values.name?.trim();
            if (!name || name.length < 3) {
                message.warning('Name must be at least 3 characters');
                return;
            }
            setRunning(true);
            const payload = {
                ...values,
                name,
                dataset_source: 'dataset_images',
                custom_params: { ...values, name }
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

    const handleNewRun = () => {
        setSelectedExp(null);
        selectedExpRef.current = null;
        setQueuedExp(null);
        setGalleryImages([]);
        setPreviewImage(null);
        setFilters(resetFilterState());
        form.setFieldsValue(defaultConfig);
        message.info('Ready for a new SAHI prediction');
    };

    const navigatePreview = (nextImage) => {
        setPreviewImage(nextImage);
    };

    const handleVerify = async (payload) => {
        if (!projectId) return;
        try {
            await projectsAPI.verifyDetection({
                ...payload,
                project_id: projectId
            });
            fetchVerifications();
            message.success(`Status updated to ${payload.status}`);
        } catch (error) {
            handleAPIError(error, 'Failed to update verification');
        }
    };

    const handleDeleteVerification = async (verificationId) => {
        try {
            await projectsAPI.deleteManualVerification(verificationId);
            fetchVerifications();
            message.success('Manual box deleted successfully');
        } catch (error) {
            handleAPIError(error, 'Failed to delete manual box');
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

    const renderFiltersCard = () => (
        <Card
            title={<Space><SearchOutlined /> Filter Results</Space>}
            className="sahi-filters-card"
            size="small"
        >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                    <Tooltip title="Find a specific image by its filename.">
                        <Text type="secondary" className="sahi-filter-label">Search Image</Text>
                    </Tooltip>
                    <Input
                        placeholder="Search by name..."
                        size="small"
                        allowClear
                        value={filters.imageSearch}
                        onChange={(event) => setFilters((current) => ({ ...current, imageSearch: event.target.value }))}
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    />
                </div>

                <div>
                    <Tooltip title="Filter images by total number of objects found.">
                        <Text type="secondary" className="sahi-filter-label">Detection Count</Text>
                    </Tooltip>
                    <Select
                        value={filters.detectionCount}
                        onChange={(value) => setFilters((current) => ({ ...current, detectionCount: value }))}
                        style={{ width: '100%' }}
                        size="small"
                    >
                        <Option value="any">Any</Option>
                        <Option value="yes">With Detections</Option>
                        <Option value="no">No Detections</Option>
                        <Option value="1-5">1-5 Detections</Option>
                        <Option value="6-10">6-10 Detections</Option>
                        <Option value="10+">10+ Detections</Option>
                    </Select>
                </div>

                <div>
                    <Tooltip title="See only images containing selected object classes.">
                        <Text type="secondary" className="sahi-filter-label">Class (Multi-Select)</Text>
                    </Tooltip>
                    <Select
                        mode="multiple"
                        placeholder="Select classes..."
                        value={filters.selectedClasses}
                        onChange={(value) => setFilters((current) => ({ ...current, selectedClasses: value, className: 'all' }))}
                        style={{ width: '100%' }}
                        size="small"
                        maxTagCount="responsive"
                    >
                        {availableClasses.map((className) => <Option key={className} value={className}>{className}</Option>)}
                    </Select>
                </div>

                <div>
                    <div className="sahi-filter-row-label">
                        <Tooltip title="View boxes based on model confidence.">
                            <Text type="secondary" className="sahi-filter-label-inline">Confidence Range</Text>
                        </Tooltip>
                        <Text type="secondary" className="sahi-filter-label-inline">
                            {filters.confidenceRange[0]}% - {filters.confidenceRange[1]}%
                        </Text>
                    </div>
                    <Slider
                        range
                        min={0}
                        max={100}
                        step={1}
                        value={filters.confidenceRange}
                        onChange={(value) => setFilters((current) => ({ ...current, confidenceRange: value }))}
                    />
                </div>

                <Divider className="sahi-filter-divider" />

                <div>
                    <Text strong className="sahi-filter-section-title">EXPERT DIAGNOSTICS</Text>
                    <div className="sahi-filter-switch-row">
                        <Tooltip title="Find boxes stacked in the same area.">
                            <Text type="secondary" className="sahi-filter-label-inline">Detect Overlaps</Text>
                        </Tooltip>
                        <Switch
                            size="small"
                            checked={filters.showOverlapping}
                            onChange={(value) => setFilters((current) => ({ ...current, showOverlapping: value }))}
                        />
                    </div>
                    {filters.showOverlapping && (
                        <div className="sahi-filter-nested">
                            <div className="sahi-filter-row-label">
                                <Text type="secondary" className="sahi-filter-label-inline">IoU Threshold</Text>
                                <Text className="sahi-filter-label-inline">{filters.overlapIoU}</Text>
                            </div>
                            <Slider
                                min={0.1}
                                max={0.9}
                                step={0.05}
                                value={filters.overlapIoU}
                                onChange={(value) => setFilters((current) => ({ ...current, overlapIoU: value }))}
                            />
                            <Checkbox
                                checked={filters.isolateOverlaps}
                                onChange={(event) => setFilters((current) => ({ ...current, isolateOverlaps: event.target.checked }))}
                            >
                                <Text type="secondary" className="sahi-filter-label-inline">Isolate Overlaps Only</Text>
                            </Checkbox>
                        </div>
                    )}

                    <div className="sahi-filter-size-block">
                        <div className="sahi-filter-row-label">
                            <Tooltip title="Filter detections by pixel area buckets calculated from this run.">
                                <Text type="secondary" className="sahi-filter-label-inline">Object Size</Text>
                            </Tooltip>
                            {sizeGroups.count > 0 && <Tag className="sahi-size-count">{sizeGroups.count} DETS</Tag>}
                        </div>
                        <Select
                            value={filters.selectedSizeGroup}
                            onChange={(value) => setFilters((current) => ({ ...current, selectedSizeGroup: value }))}
                            style={{ width: '100%' }}
                            size="small"
                        >
                            <Option value="all">All Sizes</Option>
                            <Option value="tiny">Tiny (Bottom 25%)</Option>
                            <Option value="small">Small (25-50%)</Option>
                            <Option value="medium">Medium (50-75%)</Option>
                            <Option value="large">Large (Top 25%)</Option>
                        </Select>
                        {filters.selectedSizeGroup !== 'all' && (
                            <Checkbox
                                className="sahi-filter-checkbox"
                                checked={filters.isolateBySize}
                                onChange={(event) => setFilters((current) => ({ ...current, isolateBySize: event.target.checked }))}
                            >
                                Isolate Selected Size
                            </Checkbox>
                        )}
                    </div>
                </div>

                <Divider className="sahi-filter-divider" />

                <div>
                    <Tooltip title="Focus images by risk level based on confidence.">
                        <Text type="secondary" className="sahi-filter-label">Risk Level</Text>
                    </Tooltip>
                    <Select
                        value={filters.riskLevel}
                        onChange={(value) => setFilters((current) => ({ ...current, riskLevel: value }))}
                        style={{ width: '100%' }}
                        size="small"
                    >
                        <Option value="any">Any Risk</Option>
                        <Option value="high">High Risk (&lt; 40%)</Option>
                        <Option value="medium">Medium Risk (40-70%)</Option>
                        <Option value="low">Low Risk (&gt; 70%)</Option>
                    </Select>
                </div>

                <div>
                    <Tooltip title="Filter by detections you have reviewed in the advanced viewer.">
                        <Text type="secondary" className="sahi-filter-label">Review Status</Text>
                    </Tooltip>
                    <Select
                        value={filters.reviewStatus}
                        onChange={(value) => setFilters((current) => ({ ...current, reviewStatus: value }))}
                        style={{ width: '100%' }}
                        size="small"
                    >
                        <Option value="any">Any Status</Option>
                        <Option value="pass"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Verified Correct</Option>
                        <Option value="fail"><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> Verified Wrong</Option>
                        <Option value="unverified">Unverified Detections</Option>
                    </Select>
                </div>

                <div className="sahi-filter-footer">
                    <Text type="secondary">{filteredImages.length} of {galleryImages.length}</Text>
                    <Button type="link" size="small" onClick={() => setFilters(resetFilterState())}>
                        Clear All
                    </Button>
                </div>
            </Space>
        </Card>
    );

    if (loading) {
        return (
            <div className="sahi-prediction-view-container sahi-prediction-loading">
                <Spin tip="Loading SAHI prediction workspace..." />
            </div>
        );
    }

    return (
        <div className="sahi-prediction-view-container" ref={layoutRef}>
            <div className="sahi-prediction-layout">
                <aside className="sahi-prediction-left-col">
                    <Card
                        title="SAHI History"
                        className="history-card sahi-history-card"
                        bodyStyle={{ padding: 0 }}
                        style={{ height: historyHeight }}
                    >
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
                                                <Tooltip title="Delete">
                                                    <Button
                                                        size="small"
                                                        danger
                                                        icon={<DeleteOutlined />}
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
                    {selectedExp?.status === 'completed' && renderFiltersCard()}
                </aside>

                <main className="sahi-prediction-right-col">
                    <section className="config-section-container sahi-config-section">
                        <div className="sahi-config-header">
                            <div>
                                <Space align="center">
                                    <ScissorOutlined className="sahi-header-icon" />
                                    <Title level={4}>SAHI Prediction</Title>
                                </Space>
                                <Text type="secondary">
                                    Sliced inference on full original dataset-stage images for this tile-trained model.
                                </Text>
                            </div>
                            <Space className="sahi-action-bar">
                                {selectedExp && selectedExp.status !== 'queued' && (
                                    <Button icon={<PlusOutlined />} onClick={handleNewRun}>
                                        New Run
                                    </Button>
                                )}
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    loading={running}
                                    onClick={handleRun}
                                    disabled={
                                        (selectedExp && selectedExp.status !== 'queued') ||
                                        !watchedName?.trim() ||
                                        watchedName?.trim().length < 3
                                    }
                                >
                                    Run SAHI
                                </Button>
                            </Space>
                        </div>
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
                            onValuesChange={handleFormChange}
                        >
                            <Row gutter={12}>
                                <Col xs={24} lg={12}>
                                    <Form.Item
                                        name="name"
                                        label="Prediction Name"
                                        rules={[{ required: true, message: 'Enter a prediction name' }]}
                                    >
                                        <Input
                                            placeholder="Enter prediction name"
                                            autoComplete="off"
                                            onBlur={handleNameBlur}
                                            disabled={running || (selectedExp && selectedExp.status !== 'queued')}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                    <Form.Item name="split" label="Image Source">
                                        <Radio.Group
                                            disabled={running || (selectedExp && selectedExp.status !== 'queued')}
                                            style={{ width: '100%' }}
                                        >
                                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                                <Radio value="all" className="sahi-source-radio">
                                                    <span className="sahi-source-label">All (Train + Val + Test)</span>
                                                    <Badge
                                                        count={sahiCounts.total || 0}
                                                        overflowCount={99999}
                                                        style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                    />
                                                </Radio>
                                                <Radio value="train" className="sahi-source-radio">
                                                    <span className="sahi-source-label">Training Set</span>
                                                    <Badge
                                                        count={sahiCounts.split_counts?.train || 0}
                                                        overflowCount={99999}
                                                        style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                    />
                                                </Radio>
                                                <Radio value="val" className="sahi-source-radio">
                                                    <span className="sahi-source-label">Validation Set</span>
                                                    <Badge
                                                        count={sahiCounts.split_counts?.val || 0}
                                                        overflowCount={99999}
                                                        style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                    />
                                                </Radio>
                                                {(sahiCounts.split_counts?.test || 0) > 0 && (
                                                    <Radio value="test" className="sahi-source-radio">
                                                        <span className="sahi-source-label">Test Set</span>
                                                        <Badge
                                                            count={sahiCounts.split_counts?.test || 0}
                                                            overflowCount={99999}
                                                            style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                        />
                                                    </Radio>
                                                )}
                                            </Space>
                                        </Radio.Group>
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
                    </section>

                    <Row gutter={[16, 16]} className="sahi-stats-row">
                        <Col xs={24} md={8}>
                            <div className="sahi-stat-card">
                                <Statistic title="Images" value={selectedStats.imageCount} prefix={<FileImageOutlined />} />
                            </div>
                        </Col>
                        <Col xs={24} md={8}>
                            <div className="sahi-stat-card">
                                <Statistic title="Detections" value={selectedStats.totalDetections} />
                            </div>
                        </Col>
                        <Col xs={24} md={8}>
                            <div className="sahi-stat-card">
                                <Statistic
                                    title="Avg Confidence"
                                    value={selectedStats.averageConfidence ?? 0}
                                    precision={2}
                                />
                            </div>
                        </Col>
                    </Row>

                    <section className="gallery-section-container sahi-gallery-panel" ref={galleryRef}>
                        <div className="gallery-header">
                            <span><FileImageOutlined /> Result Gallery</span>
                            <Space>
                                {selectedExp ? getStatusTag(selectedExp.status) : null}
                                <Button
                                    icon={<DownloadOutlined />}
                                    size="small"
                                    onClick={() => handleDownload(selectedExp)}
                                    disabled={!selectedExp || selectedExp.status !== 'completed'}
                                >
                                    Download Result
                                </Button>
                            </Space>
                        </div>
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
                        ) : filteredImages.length === 0 ? (
                            <Empty description="No result images available yet" />
                        ) : (
                            <div className="sahi-gallery-grid">
                                {filteredImages.map((imageName) => {
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
                    </section>
                </main>
            </div>

            <ImageViewerModal
                visible={!!previewImage}
                onCancel={() => setPreviewImage(null)}
                currentImage={previewImage}
                images={filteredImages}
                experiment={selectedExp}
                onNavigate={navigatePreview}
                filters={filters}
                setFilters={setFilters}
                verifications={verifications}
                onVerify={handleVerify}
                onDeleteVerification={handleDeleteVerification}
                projectLabels={projectLabels}
                duplicateMatchMap={{}}
                sizeGroups={sizeGroups}
                enableMissedInspection
            />
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
