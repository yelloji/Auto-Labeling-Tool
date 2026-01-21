import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    Col,
    Radio,
    Upload,
    Segmented,
    Pagination,
    Divider,
    Switch,
    Checkbox
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
    SyncOutlined,
    PlusOutlined,
    CloudUploadOutlined,
    InboxOutlined,
    InfoCircleOutlined
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
    const [pendingFiles, setPendingFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Results state
    const [experimentImages, setExperimentImages] = useState([]); // All image names
    const [filteredImages, setFilteredImages] = useState([]); // Filtered image names
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState(''); // current image name
    const [fetchingResults, setFetchingResults] = useState(false);
    const [verifications, setVerifications] = useState([]); // Project-level manual reviews

    // Advanced Features Modals
    const [compareVisible, setCompareVisible] = useState(false);
    const [analyticsVisible, setAnalyticsVisible] = useState(false);
    const [projectLabels, setProjectLabels] = useState([]); // All used labels in the project

    // Filter State
    const [filters, setFilters] = useState({
        detectionCount: 'any',
        className: 'all', // LEGACY: Restored to prevent breakage
        selectedClasses: [], // Phase 1: Dynamic Multi-select
        confidenceRange: [10, 100],
        imageSearch: '',
        riskLevel: 'any',
        reviewStatus: 'any',
        overlapIoU: 0.5, // Phase 1: IoU Threshold
        showOverlapping: false, // Phase 1: Toggle for overlap mode
        isolateOverlaps: false, // Phase 1.5: ONLY show overlapping boxes
        showOnlyDuplicates: false, // Phase 1: Toggle for duplicates
        selectedSizeGroup: 'all', // Phase 2: Object Size Filter (Scale Diagnostic)
        isolateBySize: false // Phase 2.5: Hide detections not matching size group
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 30;

    // Form inputs (Draft state for 'queued' experiment)
    const [config, setConfig] = useState({
        name: '',
        dataset_source: 'upload',
        task: training?.taskType || 'detection',  // Default to training's task type
        confidence: 0.25,
        iou_threshold: 0.45
    });

    // Phase 1.5: Pre-calculate Duplicate Groups for Insights
    const duplicateMatchMap = React.useMemo(() => {
        if (!selectedExp?.input_images) return {};
        const imgMetadata = selectedExp.input_images;
        const hashGroups = {};

        // Group by hash
        Object.entries(imgMetadata).forEach(([name, hash]) => {
            if (hash) {
                if (!hashGroups[hash]) hashGroups[hash] = [];
                hashGroups[hash].push(name);
            }
        });

        const mapping = {};
        let groupCounter = 1;

        // Only map if there are 2+ images with the same hash
        Object.values(hashGroups).forEach(names => {
            if (names.length > 1) {
                names.forEach(name => {
                    mapping[name] = groupCounter;
                });
                groupCounter++;
            }
        });
        return mapping;
    }, [selectedExp?.input_images]);

    // Phase 2: Dynamic Object Size Bucketing (Scale Diagnostic - 4 Groups)
    const sizeGroups = React.useMemo(() => {
        if (!selectedExp?.predictions) return { thresholds: [0, 0, 0], count: 0 };

        let allAreas = [];
        Object.values(selectedExp.predictions).forEach(detections => {
            if (Array.isArray(detections)) {
                detections.forEach(det => {
                    if (det.bbox && det.bbox.length === 4) {
                        const [x1, y1, x2, y2] = det.bbox;
                        const area = (x2 - x1) * (y2 - y1);
                        allAreas.push(area);
                    }
                });
            }
        });

        if (allAreas.length === 0) return { thresholds: [0, 0, 0], count: 0 };

        // Sort to find precise quantiles for 4 groups
        allAreas.sort((a, b) => a - b);
        const q25 = allAreas[Math.floor(allAreas.length * 0.25)];
        const q50 = allAreas[Math.floor(allAreas.length * 0.50)];
        const q75 = allAreas[Math.floor(allAreas.length * 0.75)];

        return {
            thresholds: [q25, q50, q75],
            count: allAreas.length
        };
    }, [selectedExp]);

    // --- References ---
    const pollTimerRef = useRef(null);
    const syncTimeoutRef = useRef(null);
    const galleryRef = useRef(null);
    const layoutRef = useRef(null);

    // Dynamic Alignment Logic
    const [historyHeight, setHistoryHeight] = useState('100%');

    const updateAlignment = useCallback(() => {
        if (galleryRef.current && layoutRef.current) {
            const galleryRect = galleryRef.current.getBoundingClientRect();
            const layoutRect = layoutRef.current.getBoundingClientRect();
            // Calculate height of history section (distance from layout top to gallery top)
            const topOffset = galleryRect.top - layoutRect.top;

            // Only split if filters are actually going to be shown
            if (selectedExp && selectedExp.status === 'completed' && topOffset > 100) {
                // Subtract exact padding to align headers:
                // - Right column has 1rem (16px) top padding
                // - Filter card has 0.5rem (8px) top margin
                // Total to subtract: 24px
                setHistoryHeight(`${topOffset - 24}px`);
            } else {
                setHistoryHeight('100%');
            }
        }
    }, [selectedExp]);

    useEffect(() => {
        // Initial measurement
        updateAlignment();

        // Update on resize or content changes
        window.addEventListener('resize', updateAlignment);

        // Intersection observer to track when things might shift
        const observer = new ResizeObserver(updateAlignment);
        if (layoutRef.current) observer.observe(layoutRef.current);

        return () => {
            window.removeEventListener('resize', updateAlignment);
            observer.disconnect();
        };
    }, [updateAlignment, experiments, selectedExp]); // Re-run when content changes

    // Compute available dataset splits from training session
    const availableSplits = React.useMemo(() => {
        if (!training?.dataset_summary_json) return ['val', 'train', 'test'];
        try {
            const summary = typeof training.dataset_summary_json === 'string'
                ? JSON.parse(training.dataset_summary_json)
                : training.dataset_summary_json;
            const splits = summary?.splits || {};
            const found = [];
            if (splits.test > 0) found.push('test');
            if (splits.val > 0) found.push('val');
            if (splits.train > 0) found.push('train');
            return found.length > 0 ? found : ['val', 'train', 'test'];
        } catch (e) {
            return ['val', 'train', 'test'];
        }
    }, [training]);

    const datasetSplitCounts = React.useMemo(() => {
        if (!training?.dataset_summary_json) return {};
        try {
            const summary = typeof training.dataset_summary_json === 'string'
                ? JSON.parse(training.dataset_summary_json)
                : training.dataset_summary_json;
            return summary?.splits || {};
        } catch (e) {
            return {};
        }
    }, [training]);

    // Helper: Determine best default dataset split
    const getDefaultSplit = useCallback(() => {
        // Prefer test, then val, then train, then upload as fallback
        if (availableSplits.includes('test')) return 'test';
        if (availableSplits.includes('val')) return 'val';
        if (availableSplits.includes('train')) return 'train';
        return 'upload'; // Fallback to upload if no splits available
    }, [availableSplits]);

    // Helper: Detect training resolution
    const getDetectedImgsz = useCallback(() => {
        if (training?.resolved_config_json) {
            try {
                const cfg = typeof training.resolved_config_json === 'string'
                    ? JSON.parse(training.resolved_config_json)
                    : training.resolved_config_json;
                return cfg.train?.imgsz || cfg.imgsz || 640;
            } catch (e) {
                console.error("Failed to parse config for imgsz", e);
            }
        }
        return 640;
    }, [training?.resolved_config_json]);




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

    /**
     * Helper: Calculate Intersection over Union (IoU) for two boxes
     * bbox format: [x1, y1, x2, y2]
     */
    const calculateIoU = useCallback((boxA, boxB) => {
        if (!boxA || !boxB) return 0;
        const xA = Math.max(boxA[0], boxB[0]);
        const yA = Math.max(boxA[1], boxB[1]);
        const xB = Math.min(boxA[2], boxB[2]);
        const yB = Math.min(boxA[3], boxB[3]);

        const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
        if (interArea === 0) return 0;

        const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
        const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

        return interArea / (boxAArea + boxBArea - interArea);
    }, []);

    const fetchVerifications = useCallback(async () => {
        const pId = training?.project_id || training?.projectId;
        if (!pId) return;
        try {
            const data = await projectsAPI.getProjectVerifications(pId);
            setVerifications(data);
        } catch (error) {
            console.error("Failed to fetch verifications", error);
        }
    }, [training?.project_id, training?.projectId]);

    const fetchProjectLabels = useCallback(async () => {
        const pId = training?.project_id || training?.projectId;
        if (!pId) return;
        try {
            const data = await projectsAPI.getProjectLabels(pId);
            setProjectLabels(data);
        } catch (error) {
            console.error("Failed to fetch project labels", error);
        }
    }, [training?.project_id, training?.projectId]);

    const handleVerify = async (payload) => {
        const pId = training?.project_id || training?.projectId;
        if (!pId) return;
        try {
            // If it's a manual missing defect, we can use the specific manual API
            // but the updated verifyDetection also handles it now.
            // Let's stick to verifyDetection for uniformity if it works.
            await projectsAPI.verifyDetection({
                ...payload,
                project_id: pId
            });
            // Refresh verifications to reflect changes in UI
            fetchVerifications();
            message.success(`Status updated to ${payload.status}`);
        } catch (error) {
            console.error("Failed to update status", error);
            message.error("Failed to update status");
        }
    };

    const handleDeleteVerification = async (verificationId) => {
        try {
            await projectsAPI.deleteManualVerification(verificationId);
            // Instant UI feedback: refresh the list
            fetchVerifications();
            message.success("Manual box deleted successfully");
        } catch (error) {
            console.error("Failed to delete manual verification", error);
            message.error("Failed to delete box");
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

            if (preds.length === 0) {
                setSelectedExp(null);
                setExperimentImages([]);
                // Reset form to defaults for this training
                setConfig({
                    name: '',
                    dataset_source: getDefaultSplit(),
                    task: training?.taskType || 'detection',
                    confidence: 0.25,
                    iou_threshold: 0.45,
                    batch: 1,
                    imgsz: getDetectedImgsz(),
                    weights_type: 'best'
                });
            } else if (!isPolling && preds.length > 0) {
                // If switching training OR no selection yet, load latest
                const latest = preds[0];
                // Check if the current selectedExp belongs to this training (optional but safer)
                // If not, or if nothing selected, force load latest
                if (!selectedExp || !preds.find(e => e.id === selectedExp.id)) {
                    setSelectedExp(latest);
                    // Always populate config when auto-selecting, regardless of status
                    setConfig({
                        name: latest.name || '',
                        dataset_source: latest.dataset_source || getDefaultSplit(),
                        task: latest.task || training?.taskType || 'detection',
                        confidence: latest.confidence || 0.25,
                        iou_threshold: latest.iou_threshold || 0.45,
                        batch: latest.batch || 1,
                        imgsz: latest.imgsz || getDetectedImgsz(),
                        weights_type: latest.weights_type || 'best',
                        max_det: latest.max_det || 300
                    });
                }
            }
        } catch (error) {
            if (!isPolling) handleAPIError(error, 'Failed to load experiments');
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, [training?.id, selectedExp, training?.taskType, getDefaultSplit, getDetectedImgsz]);

    // Initial load for verifications & labels
    useEffect(() => {
        if (training?.project_id || training?.projectId) {
            fetchVerifications();
            fetchProjectLabels();
        }
    }, [training?.project_id, training?.projectId, fetchVerifications, fetchProjectLabels]);

    useEffect(() => {
        if (pollingActive) {
            pollTimerRef.current = setInterval(() => fetchExperiments(true), 3000);
        } else if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
        }
        return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
    }, [pollingActive, fetchExperiments]);

    // This effect handles the initial load and training switches
    useEffect(() => {
        if (training?.id) {
            // Background load - no setLoading(true) here to prevent flicker
            setSelectedExp(null); // Force clear old training's experiment
            setExperimentImages([]);
            setPendingFiles([]); // Fix: Clear staged images from previous training
            fetchExperiments();
        }
    }, [training?.id]);

    // --- Filtering Logic ---
    useEffect(() => {
        // Reset to page 1 whenever filters change
        setCurrentPage(1);

        if (!selectedExp || !selectedExp.predictions || experimentImages.length === 0) {
            setFilteredImages(experimentImages);
            return;
        }

        const {
            detectionCount, selectedClasses, confidenceRange,
            imageSearch, riskLevel, showOverlapping, overlapIoU, isolateOverlaps, showOnlyDuplicates,
            selectedSizeGroup, isolateBySize
        } = filters;

        const preds = selectedExp.predictions;
        const [minConf, maxConf] = [confidenceRange[0] / 100, confidenceRange[1] / 100];

        // 0. Pre-identify Duplicates if needed
        let duplicateHashes = new Set();
        if (showOnlyDuplicates) {
            const imgMetadata = selectedExp?.input_images || {};
            const hashCounts = {};
            Object.values(imgMetadata).forEach(h => {
                if (h) hashCounts[h] = (hashCounts[h] || 0) + 1;
            });
            Object.keys(hashCounts).forEach(h => {
                if (hashCounts[h] > 1) duplicateHashes.add(h);
            });
        }

        const filtered = experimentImages.filter(imgName => {
            const fileName = imgName.split('/').pop();
            const imgMetadata = selectedExp?.input_images || {};
            const imgHash = typeof imgMetadata === 'object' && !Array.isArray(imgMetadata) ? imgMetadata[fileName] : null;

            // 1. Duplicate Filter
            if (showOnlyDuplicates && (!imgHash || !duplicateHashes.has(imgHash))) {
                return false;
            }

            // 2. Image Search Filter
            if (imageSearch && !imgName.toLowerCase().includes(imageSearch.toLowerCase())) {
                return false;
            }

            // Helper to get detections
            const getDetections = (name) => {
                if (preds[name]) return preds[name];
                const fName = name.split('/').pop();
                return preds[fName] || [];
            };

            const allDets = getDetections(imgName);

            // 3. Overlap Filter (Must check ALL pairs in the image)
            if (showOverlapping) {
                let hasOverlap = false;
                for (let i = 0; i < allDets.length; i++) {
                    for (let j = i + 1; j < allDets.length; j++) {
                        if (calculateIoU(allDets[i].bbox, allDets[j].bbox) >= overlapIoU) {
                            hasOverlap = true;
                            break;
                        }
                    }
                    if (hasOverlap) break;
                }
                if (!hasOverlap) return false;
            }

            // Filter detections by current filters (Range + Class)
            const detections = allDets.filter(d => {
                const confMatch = d.confidence >= minConf && d.confidence <= maxConf;
                const classMatch = (selectedClasses && selectedClasses.length > 0)
                    ? selectedClasses.includes(d.class)
                    : (filters.className === 'all' || d.class === filters.className);
                return confMatch && classMatch;
            });

            // 4. Detection Count Filter
            let countMatch = true;
            if (detectionCount === 'no') countMatch = allDets.length === 0;
            else if (detectionCount === 'yes') countMatch = detections.length > 0;
            else if (detectionCount === '1-5') countMatch = detections.length >= 1 && detections.length <= 5;
            else if (detectionCount === '6-10') countMatch = detections.length >= 6 && detections.length <= 10;
            else if (detectionCount === '10+') countMatch = detections.length > 10;

            if (!countMatch) return false;

            // 5. Multi-Class Filter (AND/OR logic)
            // If classes are selected, at least one MUST be present in the filtered detections
            if (selectedClasses.length > 0 && detections.length === 0) {
                return false;
            }

            // 6. Strict Risk Level Filter
            const matchingDets = detections.filter(d => {
                if (riskLevel === 'any') return true;
                if (riskLevel === 'high') return d.confidence < 0.4;
                if (riskLevel === 'medium') return d.confidence >= 0.4 && d.confidence < 0.7;
                if (riskLevel === 'low') return d.confidence >= 0.7;
                return true;
            });

            if (riskLevel !== 'any' && matchingDets.length === 0) {
                return false;
            }

            // 7. Review Status Filter (Independent)
            if (filters.reviewStatus !== 'any') {
                const imgVerifications = verifications.filter(v =>
                    imgHash ? v.image_hash_md5 === imgHash : v.image_name === fileName
                );

                if (filters.reviewStatus === 'unverified') {
                    if (!(detections.length > 0 && imgVerifications.length === 0)) return false;
                } else {
                    const hasMatch = imgVerifications.some(v => v.status === filters.reviewStatus);
                    if (!hasMatch) return false;
                }
            }

            // 8. Object Size Filter (Phase 2)
            if (selectedSizeGroup !== 'all') {
                const [q25, q50, q75] = sizeGroups.thresholds;
                const hasMatchingSize = detections.some(det => {
                    const [x1, y1, x2, y2] = det.bbox;
                    const area = (x2 - x1) * (y2 - y1);
                    if (selectedSizeGroup === 'tiny') return area <= q25;
                    if (selectedSizeGroup === 'small') return area > q25 && area <= q50;
                    if (selectedSizeGroup === 'medium') return area > q50 && area <= q75;
                    if (selectedSizeGroup === 'large') return area > q75;
                    return false;
                });
                if (!hasMatchingSize) return false;
            }

            return true;
        });

        setFilteredImages(filtered);
    }, [filters, selectedExp, experimentImages, verifications, calculateIoU, sizeGroups]);

    // --- Actions ---
    const updateParam = async (key, value) => {
        // 1. Update local UI state immediately for responsiveness
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);

        // 2. INITIALIZATION: Only create a record in DB if NO experiment is selected 
        // (or if we are moving away from a completed run to start something new)
        if (!selectedExp && key === 'name' && value.trim().length >= 3) {
            try {
                const initPayload = { ...newConfig, training_id: training.id };
                const draft = await projectsAPI.initPrediction(training.id, initPayload);
                setSelectedExp(draft);
                // Add new draft to history, removing any old instance with same ID
                setExperiments(prev => {
                    const filtered = prev.filter(e => e.id !== draft.id);
                    return [draft, ...filtered];
                });
            } catch (error) {
                console.error("Failed to initialize prediction draft:", error);
            }
        }
        // 3. AUTOSAVE: Only sync to DB if we are editing an active DRAFT ('queued')
        else if (selectedExp && selectedExp.status === 'queued') {
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = setTimeout(async () => {
                // STICKY IDENTITY: Guard against syncing invalid short names
                if (key === 'name' && value.trim().length < 3) return;

                try {
                    await projectsAPI.updatePredictionDraft(selectedExp.id, { [key]: value });
                    // Sync local state for real-time sidebar/header update
                    setExperiments(prev => (prev || []).map(e => e.id === selectedExp.id ? { ...e, [key]: value } : e));
                    setSelectedExp(prev => (prev?.id === selectedExp.id ? { ...prev, [key]: value } : prev));
                } catch (error) {
                    console.error("Failed to autosave prediction parameter:", error);
                }
            }, 800);
        }
        // 4. VOLATILE MODE: If no name is given and no draft exists, we do nothing here.
        // The UI is already updated via setConfig above, but nothing is saved to DB.
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
                    batch: 1,
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

            let currentExp = selectedExp;

            // 1. If 'upload' source, we MUST have a draft experiment initialized first to have a target folder
            if (config.dataset_source === 'upload' && (!currentExp || currentExp.status !== 'queued')) {
                const initPayload = { ...config, training_id: training.id };
                currentExp = await projectsAPI.initPrediction(training.id, initPayload);
                setSelectedExp(currentExp);
                setExperiments(prev => [currentExp, ...prev.filter(e => e.id !== currentExp.id)]);
            }

            // 2. If 'upload' source and we have pending files, upload them now
            if (config.dataset_source === 'upload' && pendingFiles.length > 0) {
                const formData = new FormData();
                pendingFiles.forEach(file => formData.append('files', file));

                const hideMsg = message.loading(`Uploading ${pendingFiles.length} images...`, 0);
                try {
                    setUploading(true);
                    await projectsAPI.uploadPredictionImages(training.id, currentExp.id, formData);
                    hideMsg();
                    message.success("Images uploaded successfully");
                    setPendingFiles([]); // Clear pending files
                } finally {
                    setUploading(false);
                    hideMsg();
                }
            }

            // 3. Trigger the prediction
            await projectsAPI.triggerPrediction(training.id, config);
            message.success(`Prediction "${config.name}" started`);

            await fetchExperiments();
            setPollingActive(true);
        } catch (error) {
            handleAPIError(error, 'Failed to start prediction');
            // Refresh to show 'FAILED' status if backend updated it
            fetchExperiments();
        }
        finally { setRunning(false); }
    };

    const handleReset = () => {
        setConfig({
            name: '',
            dataset_source: 'test',
            confidence: 0.25,
            iou_threshold: 0.45,
            batch: 1,
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

    const availableClasses = selectedExp?.analytics_summary?.classes_detected ? Object.keys(selectedExp.analytics_summary.classes_detected) : [];

    return (
        <div className="prediction-view-container" ref={layoutRef}>
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
                        style={{ height: historyHeight }}
                        extra={<Button type="text" icon={<SyncOutlined />} onClick={() => fetchExperiments()} />}
                    >
                        <List
                            dataSource={experiments}
                            renderItem={item => (
                                <List.Item
                                    className={`exp-list-item ${selectedExp?.id === item.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedExp(item);
                                        // Always populate the configuration panel with the clicked experiment's settings
                                        setConfig({
                                            name: item.name || '',
                                            dataset_source: item.dataset_source || 'test',
                                            confidence: item.confidence || 0.25,
                                            iou_threshold: item.iou_threshold || 0.45,
                                            batch: item.batch || 1,
                                            imgsz: item.imgsz || 640,
                                            weights_type: item.weights_type || 'best',
                                            max_det: item.max_det || 300,
                                            task: item.task || training?.taskType || 'detection'
                                        });
                                    }}
                                >
                                    <div className="history-item-meta">
                                        <div className="history-item-title">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Text strong>{item.name || 'Untitled Experiment'}</Text>
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

                    {/* --- Filters Card (New!) --- */}
                    {selectedExp && selectedExp.status === 'completed' && (
                        <Card
                            title={
                                <Space style={{ cursor: 'default' }}><SearchOutlined /> Filter Results</Space>
                            }
                            className="filters-card"
                            size="small"
                        >
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                {/* Search Filter */}
                                <div>
                                    <Tooltip title="Find a specific image by its filename.">
                                        <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Search Image</Text>
                                    </Tooltip>
                                    <Input
                                        placeholder="Search by name..."
                                        size="small"
                                        allowClear
                                        value={filters.imageSearch}
                                        onChange={e => setFilters(f => ({ ...f, imageSearch: e.target.value }))}
                                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                    />
                                </div>
                                {/* Detection Count Filter */}
                                <div>
                                    <Tooltip title="Filter images by the total number of boxes the model found.">
                                        <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Detection Count</Text>
                                    </Tooltip>
                                    <Select
                                        value={filters.detectionCount}
                                        onChange={val => setFilters(f => ({ ...f, detectionCount: val }))}
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

                                {/* Class Filter */}
                                <div>
                                    <Tooltip title="See only images containing these specific object types.">
                                        <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Class (Multi-Select)</Text>
                                    </Tooltip>
                                    <Select
                                        mode="multiple"
                                        placeholder="Select classes..."
                                        value={filters.selectedClasses}
                                        onChange={val => setFilters(f => ({ ...f, selectedClasses: val }))}
                                        style={{ width: '100%' }}
                                        size="small"
                                        maxTagCount="responsive"
                                    >
                                        {availableClasses.map(c => <Option key={c} value={c}>{c}</Option>)}
                                    </Select>
                                </div>

                                {/* Confidence Range Filter */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <Tooltip title="View boxes based on how 'sure' the model is (suggested: 10-40% for debugging).">
                                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>Confidence Range</Text>
                                        </Tooltip>
                                        <Text type="secondary" style={{ fontSize: '0.75rem' }}>{filters.confidenceRange[0]}% - {filters.confidenceRange[1]}%</Text>
                                    </div>
                                    <Slider
                                        range
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={filters.confidenceRange}
                                        onChange={val => setFilters(f => ({ ...f, confidenceRange: val }))}
                                    />
                                </div>

                                <Divider style={{ margin: '8px 0' }} />

                                {/* Expert Diagnostic Filters */}
                                <div>
                                    <Text strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.75rem', color: '#1890ff' }}>
                                        EXPERT DIAGNOSTICS
                                    </Text>

                                    {/* Overlapping Filter */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <Tooltip title="Find 'Stacked Boxes' in the same spot. Great for fixing double-counting issues.">
                                                <Text type="secondary" style={{ fontSize: '0.75rem' }}>Detect Overlaps</Text>
                                            </Tooltip>
                                            <Switch
                                                size="small"
                                                checked={filters.showOverlapping}
                                                onChange={val => setFilters(f => ({ ...f, showOverlapping: val }))}
                                            />
                                        </div>
                                        {filters.showOverlapping && (
                                            <div style={{ padding: '0 8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <Tooltip title="Adjust how much boxes must touch to be flagged as an overlap.">
                                                        <Text type="secondary" style={{ fontSize: '0.7rem' }}>IoU Threshold</Text>
                                                    </Tooltip>
                                                    <Text style={{ fontSize: '0.7rem' }}>{filters.overlapIoU}</Text>
                                                </div>
                                                <Slider
                                                    min={0.1}
                                                    max={0.9}
                                                    step={0.05}
                                                    value={filters.overlapIoU}
                                                    onChange={val => setFilters(f => ({ ...f, overlapIoU: val }))}
                                                />
                                                <div style={{ marginTop: '4px' }}>
                                                    <Checkbox
                                                        checked={filters.isolateOverlaps}
                                                        onChange={e => setFilters(f => ({ ...f, isolateOverlaps: e.target.checked }))}
                                                        style={{ fontSize: '0.7rem' }}
                                                    >
                                                        <Tooltip title="Hide all boxes that are NOT overlapping. Focus only on the problem areas.">
                                                            <Text type="secondary" style={{ fontSize: '0.7rem' }}>Isolate Overlaps Only</Text>
                                                        </Tooltip>
                                                    </Checkbox>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Duplicate Filter */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Tooltip title="Find images that are 100% identical files—even if names are different.">
                                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>Content Duplicates</Text>
                                        </Tooltip>
                                        <Switch
                                            size="small"
                                            checked={filters.showOnlyDuplicates}
                                            onChange={val => setFilters(f => ({ ...f, showOnlyDuplicates: val }))}
                                        />
                                    </div>

                                    {/* Object Size Filter (Phase 2) */}
                                    <div style={{ marginTop: '1rem' }}>
                                        <Tooltip title="Filter detections by their pixel area (Tiny, Small, Medium, Large). Thresholds are dynamically calculated based on all detections in this experiment.">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <Text type="secondary" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Object Size</Text>
                                                {sizeGroups.count > 0 && (
                                                    <Tag color="default" style={{ fontSize: '9px', margin: 0, padding: '0 4px', background: 'rgba(255,255,255,0.05)', color: '#666', border: 'none' }}>
                                                        {sizeGroups.count} DETS ANALYZED
                                                    </Tag>
                                                )}
                                            </div>
                                        </Tooltip>
                                        <Select
                                            value={filters.selectedSizeGroup}
                                            onChange={val => setFilters(f => ({ ...f, selectedSizeGroup: val }))}
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
                                            <div style={{ marginTop: '0.5rem', paddingLeft: '4px' }}>
                                                <Checkbox
                                                    checked={filters.isolateBySize}
                                                    onChange={e => setFilters(f => ({ ...f, isolateBySize: e.target.checked }))}
                                                    style={{ color: '#888', fontSize: '0.7rem' }}
                                                >
                                                    Isolate Selected Size
                                                </Checkbox>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Divider style={{ margin: '12px 0 8px 0' }} />

                                {/* Risk Level Filter */}
                                <div>
                                    <Tooltip title="Instantly see 'High Risk' images that probably need a human eyes.">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>Risk Level</Text>
                                            <Space size={8}>
                                                <Tooltip title="High Risk: < 40% Confidence">
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff4d4f', boxShadow: '0 0 8px rgba(255, 77, 79, 0.6)' }} />
                                                </Tooltip>
                                                <Tooltip title="Medium Risk: 40-70% Confidence">
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#faad14', boxShadow: '0 0 8px rgba(250, 173, 20, 0.6)' }} />
                                                </Tooltip>
                                                <Tooltip title="Low Risk: > 70% Confidence">
                                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 8px rgba(82, 196, 26, 0.6)' }} />
                                                </Tooltip>
                                            </Space>
                                        </div >
                                    </Tooltip>
                                    <Select
                                        value={filters.riskLevel}
                                        onChange={val => setFilters(f => ({ ...f, riskLevel: val }))}
                                        style={{ width: '100%' }}
                                        size="small"
                                    >
                                        <Option value="any">Any Risk</Option>
                                        <Option value="high">
                                            <Space size={10}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4d4f', boxShadow: '0 0 4px rgba(255, 77, 79, 0.4)' }} />
                                                <span>High Risk (Needs Review)</span>
                                            </Space>
                                        </Option>
                                        <Option value="medium">
                                            <Space size={10}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#faad14', boxShadow: '0 0 4px rgba(250, 173, 20, 0.4)' }} />
                                                <span>Medium Risk</span>
                                            </Space>
                                        </Option>
                                        <Option value="low">
                                            <Space size={10}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 4px rgba(82, 196, 26, 0.4)' }} />
                                                <span>Low Risk (Validated)</span>
                                            </Space>
                                        </Option>
                                    </Select>
                                </div>

                                {/* Review Status Filter */}
                                <div>
                                    <Tooltip title="Filter by images you've already audited as Correct (Pass) or Wrong (Fail).">
                                        <Text type="secondary" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Review Status (Master Truth)</Text>
                                    </Tooltip>
                                    <Select
                                        value={filters.reviewStatus}
                                        onChange={val => setFilters(f => ({ ...f, reviewStatus: val }))}
                                        style={{ width: '100%' }}
                                        size="small"
                                    >
                                        <Option value="any">Any Status</Option>
                                        <Option value="pass">
                                            <Space>
                                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                                <span>Verified Correct (Pass)</span>
                                            </Space>
                                        </Option>
                                        <Option value="fail">
                                            <Space>
                                                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                                <span>Verified Wrong (Fail)</span>
                                            </Space>
                                        </Option>
                                        <Option value="unverified">
                                            <Space>
                                                <div style={{ width: 14, height: 14, border: '1px dashed #666', borderRadius: '50%' }} />
                                                <span>Unverified Detections</span>
                                            </Space>
                                        </Option>
                                    </Select>
                                </div>

                                {/* Results Counter & Clear */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingTop: '0.5rem',
                                    borderTop: '1px dashed #f0f0f0'
                                }}>
                                    <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                        {filteredImages.length} of {experimentImages.length}
                                    </Text>
                                    <Button
                                        type="link"
                                        size="small"
                                        onClick={() => setFilters({
                                            detectionCount: 'any',
                                            className: 'all', // LEGACY: Restored
                                            selectedClasses: [],
                                            confidenceRange: [10, 100],
                                            imageSearch: '',
                                            riskLevel: 'any',
                                            reviewStatus: 'any',
                                            overlapIoU: 0.5,
                                            showOverlapping: false,
                                            isolateOverlaps: false,
                                            showOnlyDuplicates: false,
                                            selectedSizeGroup: 'all'
                                        })}
                                    >
                                        Clear All
                                    </Button>
                                </div>
                            </Space>
                        </Card>
                    )}
                </div>

                {/* --- Right Content Column --- */}
                <div className="prediction-right-col">
                    {/* 1. Configuration Section */}
                    <div className="config-section-container">
                        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><SettingOutlined /> Configuration</div>
                            <Button
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    // Check if a queued experiment already exists for this training
                                    const queuedExp = experiments.find(e => e.status === 'queued');

                                    if (queuedExp) {
                                        // Load the existing queued experiment instead of creating new
                                        setSelectedExp(queuedExp);
                                        setConfig({
                                            name: queuedExp.name || '',
                                            dataset_source: queuedExp.dataset_source || getDefaultSplit(),
                                            confidence: queuedExp.confidence || 0.25,
                                            iou_threshold: queuedExp.iou_threshold || 0.45,
                                            batch: queuedExp.batch || 1,
                                            imgsz: queuedExp.imgsz || getDetectedImgsz(),
                                            weights_type: queuedExp.weights_type || 'best',
                                            max_det: queuedExp.max_det || 300,
                                            task: queuedExp.task || training?.taskType || 'detection'
                                        });
                                        message.info("Loaded existing draft. Rename or delete it to start fresh.");
                                    } else {
                                        // No queued experiment, clear for fresh start
                                        setSelectedExp(null);
                                        setConfig({
                                            name: '',
                                            dataset_source: getDefaultSplit(),
                                            confidence: 0.25,
                                            iou_threshold: 0.45,
                                            batch: 1,
                                            imgsz: getDetectedImgsz(),
                                            weights_type: 'best',
                                            max_det: 300,
                                            task: training?.taskType || 'detection'
                                        });
                                        message.info("Form reset for new experiment");
                                    }
                                }}
                                disabled={running}
                            >
                                New
                            </Button>
                        </div>
                        <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                Configure these settings to run a new prediction experiment and detect objects in your images.
                            </Text>
                        </div>
                        <div className="config-grid">
                            {/* Column 1: Basic & Source Info */}
                            <div className="config-column">
                                <div className="config-item">
                                    <Tooltip title="Unique name to identify this prediction run. Helps organize and compare results later.">
                                        <Text strong style={{ cursor: 'help' }}>Experiment Name</Text>
                                    </Tooltip>
                                    <Input
                                        placeholder="Enter experiment name..."
                                        value={config.name}
                                        onChange={e => updateParam('name', e.target.value)}
                                        onBlur={(e) => {
                                            // SNAP-BACK: If user leaves field with invalid name, restore from DB state
                                            const val = e.target.value.trim();
                                            if (selectedExp && val.length < 3) {
                                                const restoredName = selectedExp.name || 'Untitled Experiment';
                                                setConfig(prev => ({ ...prev, name: restoredName }));
                                            }
                                        }}
                                        autoComplete="off"
                                        disabled={running || (selectedExp && selectedExp.status !== 'queued')}
                                    />
                                </div>
                                <div className="config-item">
                                    <Tooltip title="Choose which dataset to run predictions on: Test/Val/Train sets, or upload custom images.">
                                        <Text strong style={{ cursor: 'help' }}>Select Prediction Data</Text>
                                    </Tooltip>

                                    <div className="source-selection-list">
                                        <Radio.Group
                                            value={config.dataset_source}
                                            onChange={e => updateParam('dataset_source', e.target.value)}
                                            disabled={selectedExp && selectedExp.status !== 'queued'}
                                            style={{ width: '100%' }}
                                        >
                                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                                {availableSplits.includes('test') && (
                                                    <Radio value="test" className="source-card-radio">
                                                        <div className="radio-content">
                                                            <span className="source-label">Test Set</span>
                                                            <Badge
                                                                count={datasetSplitCounts.test || 0}
                                                                overflowCount={99999}
                                                                style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                            />
                                                        </div>
                                                    </Radio>
                                                )}
                                                {availableSplits.includes('val') && (
                                                    <Radio value="val" className="source-card-radio">
                                                        <div className="radio-content">
                                                            <span className="source-label">Validation Set</span>
                                                            <Badge
                                                                count={datasetSplitCounts.val || 0}
                                                                overflowCount={99999}
                                                                style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                            />
                                                        </div>
                                                    </Radio>
                                                )}
                                                {availableSplits.includes('train') && (
                                                    <Radio value="train" className="source-card-radio">
                                                        <div className="radio-content">
                                                            <span className="source-label">Training Set</span>
                                                            <Badge
                                                                count={datasetSplitCounts.train || 0}
                                                                overflowCount={99999}
                                                                style={{ backgroundColor: '#f0f2f5', color: '#8c8c8c', boxShadow: 'none' }}
                                                            />
                                                        </div>
                                                    </Radio>
                                                )}
                                                <Radio value="upload" className="source-card-radio">
                                                    <div className="radio-content">
                                                        <span className="source-label">📁 Custom Upload</span>
                                                    </div>
                                                </Radio>
                                            </Space>
                                        </Radio.Group>
                                    </div>

                                    {config.dataset_source === 'upload' && (
                                        <div className="inline-uploader-row">
                                            <Upload
                                                multiple
                                                directory={false}
                                                showUploadList={false}
                                                disabled={selectedExp && selectedExp.status !== 'queued'}
                                                beforeUpload={(file, fileList) => {
                                                    // Ensure we capture all files in the selection
                                                    setPendingFiles(prev => {
                                                        const combined = [...prev, file];
                                                        // Only show message once for the batch
                                                        if (combined.length === prev.length + fileList.length) {
                                                            message.success(`${fileList.length} images staged`);
                                                        }
                                                        return combined;
                                                    });
                                                    return false;
                                                }}
                                            >
                                                <Button
                                                    size="small"
                                                    icon={<CloudUploadOutlined />}
                                                    className="compact-upload-btn"
                                                    loading={uploading}
                                                    disabled={selectedExp && selectedExp.status !== 'queued'}
                                                >
                                                    {pendingFiles.length > 0
                                                        ? `${pendingFiles.length} Images Selected`
                                                        : "Select Images or Folders"}
                                                </Button>
                                            </Upload>
                                            {pendingFiles.length > 0 && (
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    onClick={() => setPendingFiles([])}
                                                    style={{ fontSize: '10px', marginLeft: '4px' }}
                                                >
                                                    Clear
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Thresholds & Sliders */}
                            <div className="config-column">
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
                                <div className="config-item">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <Tooltip title="Number of images to process per GPU call. Lower values use less VRAM. Set to 1 for maximum accuracy and stability.">
                                            <Text strong style={{ cursor: 'help' }}>Batch Size</Text>
                                        </Tooltip>
                                        <InputNumber
                                            min={1} max={128} step={1}
                                            value={config.batch}
                                            size="small"
                                            onChange={val => updateParam('batch', val)}
                                            disabled={selectedExp && selectedExp.status !== 'queued'}
                                            style={{ width: '80px' }}
                                        />
                                    </div>
                                    <Slider
                                        min={1} max={32} step={1}
                                        value={config.batch}
                                        onChange={val => updateParam('batch', val)}
                                        disabled={selectedExp && selectedExp.status !== 'queued'}
                                        marks={{ 1: '1', 8: '8', 16: '16', 32: '32' }}
                                    />
                                </div>
                            </div>

                            {/* Column 3: Task & Model Settings */}
                            <div className="config-column">
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
                                <div className="config-item">
                                    <Tooltip title="Input image resolution for predictions. Higher values are more accurate but slower, lower values are faster. Best results are usually achieved at the model's training resolution.">
                                        <Text strong style={{ cursor: 'help' }}>Image Size</Text>
                                    </Tooltip>
                                    <InputNumber
                                        min={32} step={32}
                                        value={config.imgsz}
                                        style={{ width: '100%', marginTop: '0.25rem' }}
                                        onChange={val => updateParam('imgsz', val)}
                                        placeholder={`Model default: ${training?.imgsz || 640}`}
                                        disabled={selectedExp && selectedExp.status !== 'queued'}
                                    />
                                </div>
                                <div className="config-item">
                                    <Tooltip title="Best: Uses model checkpoint with highest validation metrics. Last: Uses final checkpoint from training.">
                                        <Text strong style={{ cursor: 'help' }}>Select Prediction Model</Text>
                                    </Tooltip>
                                    <Select
                                        value={config.weights_type}
                                        onChange={val => updateParam('weights_type', val)}
                                        disabled={selectedExp && selectedExp.status !== 'queued'}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="best">Best Weights (Recommended)</Option>
                                        <Option value="last">Last Weights (Most Recent)</Option>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'space-between' }}>
                            <Space>
                                <Button icon={<LineChartOutlined />} onClick={() => setAnalyticsVisible(true)} disabled={!selectedExp || selectedExp.status !== 'completed'}>📈 Analytics</Button>
                                <Button icon={<ExperimentOutlined />} onClick={() => setCompareVisible(true)} disabled={experiments.length < 2}>📊 Compare</Button>
                            </Space>
                            <Tooltip title={!config.name?.trim() || config.name.trim().length < 3 ? "Name must be at least 3 characters" : ""}>
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={handleRun}
                                    loading={running}
                                    disabled={(selectedExp && selectedExp.status !== 'queued') || !config.name?.trim() || config.name.trim().length < 3}
                                >
                                    Run Prediction
                                </Button>
                            </Tooltip>
                        </div>
                    </div>

                    {/* 1.5. KPI Metrics Section */}
                    {
                        selectedExp && selectedExp.status === 'completed' && (
                            <div className="p-kpi-grid">
                                {renderKPICard("Total Objects", stats.total_detections || 0, <CheckCircleOutlined />, "#1890ff", "Total number of items detected across all images")}
                                {renderKPICard("Images w/ Det", stats.images_with_detections || 0, <EyeOutlined />, "#52c41a", "Number of images where at least one object was found")}
                                {renderKPICard("Avg Confidence", ((stats.avg_confidence || 0) * 100).toFixed(1) + "%", <SyncOutlined />, "#722ed1", "Mean confidence score of all predictions")}
                                {renderKPICard("Process Time", (selectedExp.duration_sec || 0).toFixed(1) + "s", <ClockCircleOutlined />, "#fa8c16", "Total duration of the prediction run")}
                            </div>
                        )
                    }

                    {/* 2. Filter Bar Section - MOVED TO SIDEBAR (hidden for safety, will delete after testing) */}
                    <div style={{ display: 'none' }}>
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
                                        <Button type="link" size="small" onClick={() => setFilters({ detectionCount: 'any', className: 'all', confidenceRange: [10, 100], imageSearch: '', riskLevel: 'any' })}>Clear Filters</Button>
                                        <Text type="secondary" style={{ marginLeft: 'auto' }}>
                                            Showing {filteredImages.length} of {experimentImages.length}
                                        </Text>
                                    </Space>
                                </div>
                            )
                        }
                    </div>

                    {/* 3. Gallery Section */}
                    <div className="gallery-section-container" ref={galleryRef}>
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
                            <>
                                {/* Calculate pagination */}
                                {(() => {
                                    const totalPages = Math.ceil(filteredImages.length / itemsPerPage);
                                    const startIndex = (currentPage - 1) * itemsPerPage;
                                    const endIndex = startIndex + itemsPerPage;
                                    const currentPageImages = filteredImages.slice(startIndex, endIndex);

                                    return (
                                        <>
                                            <div className="prediction-gallery-grid">
                                                {currentPageImages.map(imgName => {
                                                    const getDetections = (name) => {
                                                        if (selectedExp?.predictions?.[name]) return selectedExp.predictions[name];
                                                        const fileName = name.split('/').pop();
                                                        return selectedExp?.predictions?.[fileName] || [];
                                                    };
                                                    const allDets = getDetections(imgName);
                                                    const [minConf, maxConf] = [filters.confidenceRange[0] / 100, filters.confidenceRange[1] / 100];
                                                    const detections = allDets.filter((d, idx) => {
                                                        const confMatch = d.confidence >= minConf && d.confidence <= maxConf;
                                                        const classMatch = (filters.selectedClasses && filters.selectedClasses.length > 0)
                                                            ? filters.selectedClasses.includes(d.class)
                                                            : (filters.className === 'all' || d.class === filters.className);

                                                        // Apply Strict Risk Level Filter in Gallery Thumbnails
                                                        const riskLevel = filters.riskLevel;
                                                        let riskMatch = true;
                                                        if (riskLevel === 'high') riskMatch = d.confidence < 0.4;
                                                        else if (riskLevel === 'medium') riskMatch = d.confidence >= 0.4 && d.confidence < 0.7;
                                                        else if (riskLevel === 'low') riskMatch = d.confidence >= 0.7;

                                                        // 8. Size Isolation Logic (Phase 2.5)
                                                        let sizeMatch = true;
                                                        if (filters.selectedSizeGroup !== 'all' && filters.isolateBySize) {
                                                            const [q25, q50, q75] = sizeGroups.thresholds;
                                                            const [x1, y1, x2, y2] = d.bbox;
                                                            const area = (x2 - x1) * (y2 - y1);
                                                            if (filters.selectedSizeGroup === 'tiny') sizeMatch = area <= q25;
                                                            else if (filters.selectedSizeGroup === 'small') sizeMatch = area > q25 && area <= q50;
                                                            else if (filters.selectedSizeGroup === 'medium') sizeMatch = area > q50 && area <= q75;
                                                            else if (filters.selectedSizeGroup === 'large') sizeMatch = area > q75;
                                                        }

                                                        // ONLY show boxes that are actually overlapping? (Isolation Mode)
                                                        let overlapMatch = true;
                                                        if (filters.showOverlapping && filters.isolateOverlaps) {
                                                            overlapMatch = allDets.some((otherD, otherIdx) => {
                                                                if (idx === otherIdx) return false;
                                                                const iou = calculateIoU(d.bbox, otherD.bbox);
                                                                return iou >= filters.overlapIoU;
                                                            });
                                                        }

                                                        return confMatch && classMatch && riskMatch && overlapMatch && sizeMatch;
                                                    });
                                                    const imageUrl = selectedExp?.id
                                                        ? `${window.location.protocol}//${window.location.hostname}:12000/api/v1/experiments/${selectedExp.id}/original-image/${imgName}`
                                                        : '';
                                                    // Clean filename: remove "predict/" and any path components
                                                    const displayName = imgName.split('/').pop();
                                                    const matchId = duplicateMatchMap[displayName] || duplicateMatchMap[imgName];
                                                    // Render detection overlay for filtered detections
                                                    const DetectionOverlay = ({ dets, imgKey }) => {
                                                        const [dimensions, setDimensions] = useState({ width: 640, height: 640 });

                                                        // This effect handles getting the image's natural dimensions once loaded
                                                        // to ensure the SVG coordinates scale perfectly.
                                                        const handleImgLoad = (e) => {
                                                            setDimensions({
                                                                width: e.target.naturalWidth || 640,
                                                                height: e.target.naturalHeight || 640
                                                            });
                                                        };

                                                        return (
                                                            <div className="prediction-image-container">
                                                                <img
                                                                    src={imageUrl}
                                                                    alt={imgName}
                                                                    loading="lazy"
                                                                    onLoad={handleImgLoad}
                                                                />
                                                                {dets.length > 0 && dimensions.width > 0 && (
                                                                    <svg
                                                                        className="detection-overlay-svg"
                                                                        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                                                                        preserveAspectRatio="none"
                                                                    >
                                                                        {dets.map((d, i) => {
                                                                            if (!d.bbox) return null;
                                                                            const [x1, y1, x2, y2] = d.bbox;
                                                                            // Determine risk class for coloring
                                                                            let riskClass = '';
                                                                            if (d.confidence < 0.4) riskClass = 'high-risk';
                                                                            else if (d.confidence < 0.7) riskClass = 'medium-risk';
                                                                            else riskClass = 'low-risk';

                                                                            return (
                                                                                <g key={i}>
                                                                                    {/* 1. RENDER CONTOUR (Polygon) */}
                                                                                    {d.segmentation && (
                                                                                        <polygon
                                                                                            points={d.segmentation.map(p => `${p[0]},${p[1]}`).join(' ')}
                                                                                            fill={`${riskClass === 'high-risk' ? '#ff4d4f' : riskClass === 'medium-risk' ? '#faad14' : '#52c41a'}22`}
                                                                                            stroke={riskClass === 'high-risk' ? '#ff4d4f' : riskClass === 'medium-risk' ? '#faad14' : '#52c41a'}
                                                                                            strokeWidth={1}
                                                                                            strokeDasharray="2,1"
                                                                                        />
                                                                                    )}

                                                                                    {/* 2. RENDER BBOX */}
                                                                                    <rect
                                                                                        x={x1}
                                                                                        y={y1}
                                                                                        width={x2 - x1}
                                                                                        height={y2 - y1}
                                                                                        className={`detection-highlight-rect ${riskClass}`}
                                                                                    />
                                                                                </g>
                                                                            );
                                                                        })}
                                                                    </svg>
                                                                )}
                                                                <div className="image-overlay"><EyeOutlined style={{ color: '#fff', fontSize: 24 }} /></div>
                                                            </div>
                                                        );
                                                    };

                                                    return (
                                                        <div key={imgName} className="prediction-gallery-item-wrapper">
                                                            <div className="prediction-gallery-item" onClick={() => { setPreviewImage(imgName); setPreviewVisible(true); }}>
                                                                <DetectionOverlay dets={detections} imgKey={imgName} />
                                                            </div>
                                                            <div className="image-name-label" title={imgName}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                    {matchId && filters.showOnlyDuplicates && (
                                                                        <Tag color="purple" style={{ fontSize: '0.6rem', fontWeight: 'bold', margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                                                                            MATCH #{matchId}
                                                                        </Tag>
                                                                    )}
                                                                    <span style={{ fontSize: '0.75rem' }}>
                                                                        {displayName.length > 25 ? displayName.slice(0, 22) + '...' : displayName}
                                                                    </span>
                                                                </div>
                                                                <Tooltip title={`This image has ${detections.length} detection${detections.length !== 1 ? 's' : ''} found by our model`}>
                                                                    <Badge count={detections.length} style={{ marginLeft: '0.5rem' }} showZero />
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Pagination Controls */}
                                            {totalPages > 1 && (
                                                <div style={{
                                                    padding: '1rem',
                                                    borderTop: '1px solid #f0f0f0',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: '1rem',
                                                    background: '#fafafa'
                                                }}>
                                                    <Text type="secondary" style={{ fontSize: '0.875rem' }}>
                                                        Showing {startIndex + 1}-{Math.min(endIndex, filteredImages.length)} of {filteredImages.length}
                                                    </Text>
                                                    <Pagination
                                                        current={currentPage}
                                                        total={filteredImages.length}
                                                        pageSize={itemsPerPage}
                                                        onChange={(page) => setCurrentPage(page)}
                                                        showSizeChanger={false}
                                                        size="small"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </>
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
                filters={filters}
                setFilters={setFilters}
                verifications={verifications}
                onVerify={handleVerify}
                onDeleteVerification={handleDeleteVerification}
                projectLabels={projectLabels}
                duplicateMatchMap={duplicateMatchMap}
                sizeGroups={sizeGroups}
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
