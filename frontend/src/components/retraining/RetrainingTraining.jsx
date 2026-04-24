import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Input, Row, Select, Spin, Tabs, Tag, Typography, message } from 'antd';
import {
    CheckCircleOutlined,
    ExperimentOutlined,
    InfoCircleOutlined,
    PlayCircleOutlined,
    StopOutlined,
} from '@ant-design/icons';
import { projectsAPI, trainingAPI } from '../../services/api';
import LiveTrainingDashboard from '../project-workspace/ModelTrainingSection/Dashboard/LiveTrainingDashboard';
import TrainingInitializing from '../project-workspace/ModelTrainingSection/Dashboard/TrainingInitializing';

const { Text } = Typography;
const API = '/api/v1';

const panelStyle = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.66)',
    borderTop: '3px solid #7c3aed',
    borderRadius: 12,
    boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
};

const statStyle = {
    background: 'rgba(255,255,255,0.56)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.72)',
    borderRadius: 10,
    padding: '0.85rem 0.95rem',
    minHeight: 86,
};

const tabScrollFrameStyle = {
    maxHeight: 'calc(100vh - 245px)',
    minHeight: 380,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 4,
};

const fileName = (value) => String(value || '').split(/[\\/]/).pop() || '-';
const parseMaybeJson = (value, fallback = null) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const RetrainingTraining = ({ projectId, onReadyChange }) => {
    const [reference, setReference] = useState(null);
    const [activeRelease, setActiveRelease] = useState(null);
    const [productionProjectModel, setProductionProjectModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [trainingName, setTrainingName] = useState('');
    const [selectedBaseModel, setSelectedBaseModel] = useState('');
    const [configPreview, setConfigPreview] = useState({});
    const [datasetReleaseDir, setDatasetReleaseDir] = useState('');
    const [datasetReleaseId, setDatasetReleaseId] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [status, setStatus] = useState('queued');
    const [liveMetrics, setLiveMetrics] = useState(null);
    const [activeTab, setActiveTab] = useState('config');
    const [preparing, setPreparing] = useState(false);
    const [starting, setStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [lastCompletedMetrics, setLastCompletedMetrics] = useState(null);
    const [lastCompletedSession, setLastCompletedSession] = useState(null);
    const suppressNameResetRef = React.useRef(false);

    const isRetrainingSession = useCallback((sessionLike) => {
        if (!sessionLike) return false;

        const description = String(sessionLike.description || '').toLowerCase();
        if (description.includes('retraining mode')) return true;

        if (activeRelease?.id && String(sessionLike.dataset_release_id || '') === String(activeRelease.id)) {
            return true;
        }

        const resolvedConfig = parseMaybeJson(sessionLike.resolved_config_json, {});
        const dataPath = String(resolvedConfig?.train?.data || '').toLowerCase();
        const releaseName = String(activeRelease?.name || '').toLowerCase();

        return dataPath.includes('retraining_data') || (releaseName && dataPath.includes(releaseName));
    }, [activeRelease]);

    const applyRecoveredSession = useCallback((sessionLike) => {
        if (!sessionLike) return;

        suppressNameResetRef.current = true;
        const resolvedConfig = parseMaybeJson(sessionLike.resolved_config_json, {});
        const metrics = parseMaybeJson(sessionLike.metrics_json || sessionLike.metrics, null);
        const trainConfig = resolvedConfig?.train || {};

        setTrainingName(sessionLike.name || '');
        setSessionId(sessionLike.id || null);
        setStatus(sessionLike.status || 'queued');
        setLiveMetrics(metrics);
        setConfigPreview({
            train: trainConfig,
            hyperparameters: resolvedConfig?.hyperparameters || {},
            augmentation: resolvedConfig?.augmentation || {},
            val: resolvedConfig?.val || {},
        });

        if (trainConfig.model) {
            setSelectedBaseModel(trainConfig.model);
        }
        if (sessionLike.dataset_release_dir) {
            setDatasetReleaseDir(sessionLike.dataset_release_dir);
        }
        if (sessionLike.dataset_release_id) {
            setDatasetReleaseId(sessionLike.dataset_release_id);
        }
    }, []);

    const applyLastCompletedSession = useCallback((sessionLike) => {
        if (!sessionLike) return;

        const resolvedConfig = parseMaybeJson(sessionLike.resolved_config_json, {});
        const metrics = parseMaybeJson(sessionLike.metrics_json || sessionLike.metrics, null);

        setLastCompletedSession(sessionLike);
        setLastCompletedMetrics(metrics);
        setStatus('completed');
        setConfigPreview({
            train: resolvedConfig?.train || {},
            hyperparameters: resolvedConfig?.hyperparameters || {},
            augmentation: resolvedConfig?.augmentation || {},
            val: resolvedConfig?.val || {},
        });
    }, []);

    const loadCore = useCallback(async () => {
        setLoading(true);
        try {
            const [referenceRes, releasesRes, projectModels] = await Promise.all([
                fetch(`${API}/retraining/${projectId}/reference`),
                fetch(`${API}/projects/${projectId}/releases`),
                projectsAPI.getProjectModels(projectId, false).catch(() => []),
            ]);

            const referenceData = referenceRes.ok ? await referenceRes.json() : null;
            const allReleases = releasesRes.ok ? await releasesRes.json() : [];
            const retrainingReleases = (allReleases || []).filter(rel => rel.release_source === 'user_retraining');
            const productionTrainingId = referenceData?.training_info?.id;
            const matchedProductionModel = (projectModels || []).find((model) => (
                model?.source_type === 'training'
                && String(model?.training_session_id || '') === String(productionTrainingId || '')
                && Boolean(model?.is_best)
            )) || null;

            setReference(referenceData);
            setActiveRelease(retrainingReleases[0] || null);
            setProductionProjectModel(matchedProductionModel);

            const defaultModel = matchedProductionModel?.file_path
                || referenceData?.training_info?.best_weights_path
                || referenceData?.training_info?.base_model_id
                || '';
            setSelectedBaseModel(prev => prev || defaultModel);
        } catch {
            message.error('Failed to load retraining training setup');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadCore();
    }, [loadCore]);

    useEffect(() => {
        const restoreRetrainingSession = async () => {
            if (!projectId || !activeRelease?.id || trainingName.trim()) return;

            try {
                const activeSession = await trainingAPI.getActiveSession(projectId);
                if (activeSession?.name) {
                    const fullActiveSession = await trainingAPI.getSession({ projectId, name: activeSession.name });
                    if (isRetrainingSession(fullActiveSession)) {
                        applyRecoveredSession(fullActiveSession);
                        return;
                    }
                }
            } catch (error) {
                if (error?.response?.status !== 404) {
                    /* ignore active restore issues */
                }
            }

            try {
                const sessions = await projectsAPI.getTrainingSessions(projectId);
                const latestCompletedRetraining = (sessions || []).find((session) => (
                    session?.status === 'completed' && isRetrainingSession(session)
                ));

                if (latestCompletedRetraining) {
                    applyLastCompletedSession(latestCompletedRetraining);
                }
            } catch {
                /* ignore last-completed restore issues */
            }
        };

        restoreRetrainingSession();
    }, [projectId, activeRelease, trainingName, isRetrainingSession, applyRecoveredSession, applyLastCompletedSession]);

    const modelOptions = useMemo(() => {
        const trainingInfo = reference?.training_info || {};
        const options = [];
        const seen = new Set();

        const pushOption = (value, label, hint, kind) => {
            if (!value || seen.has(value)) return;
            seen.add(value);
            options.push({
                value,
                label,
                title: label,
                hint,
                kind,
            });
        };

        pushOption(
            productionProjectModel?.file_path || trainingInfo.best_weights_path,
            'Production trained model',
            productionProjectModel?.name || fileName(trainingInfo.best_weights_path),
            'production'
        );
        pushOption(
            trainingInfo.base_model_id,
            'Original default pretrained model',
            fileName(trainingInfo.base_model_id),
            'default'
        );

        return options;
    }, [reference, productionProjectModel]);

    const selectedModelOption = useMemo(
        () => modelOptions.find(option => option.value === selectedBaseModel) || null,
        [modelOptions, selectedBaseModel]
    );

    const readiness = useMemo(() => ({
        nameReady: Boolean(trainingName.trim()),
        releaseReady: Boolean(activeRelease?.model_path),
        modelReady: Boolean(selectedBaseModel),
    }), [trainingName, activeRelease, selectedBaseModel]);

    useEffect(() => {
        if (onReadyChange) onReadyChange(status === 'completed');
    }, [status, onReadyChange]);

    const prepareTrainingSession = useCallback(async () => {
        if (!trainingName.trim() || !selectedBaseModel || !activeRelease?.model_path) {
            return;
        }

        setPreparing(true);
        try {
            await trainingAPI.upsertSession({
                projectId,
                name: trainingName.trim(),
                description: 'Created from User Retraining Mode',
            });

            const payloadRes = await fetch(`${API}/retraining/${projectId}/start-training`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trainingName.trim(),
                    base_model_id: selectedBaseModel,
                    release_id: activeRelease.id,
                }),
            });

            if (!payloadRes.ok) {
                const error = await payloadRes.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to prepare training payload');
            }

            const { training_payload } = await payloadRes.json();

            await trainingAPI.updateSessionModel({
                projectId,
                name: trainingName.trim(),
                baseModelId: selectedBaseModel,
                framework: training_payload.framework,
                task: training_payload.task,
                modelName: selectedBaseModel,
            });

            const datasetRes = await trainingAPI.updateSessionDatasetFromZip({
                projectId,
                name: trainingName.trim(),
                zipPath: activeRelease.model_path,
            });

            const releaseDir = datasetRes?.dataset_release_dir || '';
            const releaseId = datasetRes?.dataset_release_id ?? training_payload.dataset_release_id ?? null;

            const nextConfig = JSON.parse(JSON.stringify(training_payload.resolved_config || {}));
            nextConfig.train = nextConfig.train || {};
            nextConfig.train.model = selectedBaseModel;
            if (releaseDir) {
                nextConfig.train.data = `${releaseDir}/data.yaml`;
            }

            await trainingAPI.saveSessionConfig({
                projectId,
                name: trainingName.trim(),
                resolvedConfig: nextConfig,
            });

            const session = await trainingAPI.getSession({ projectId, name: trainingName.trim() });
            if (session?.id) setSessionId(session.id);
            setStatus(session?.status || 'queued');
            setDatasetReleaseDir(releaseDir);
            setDatasetReleaseId(releaseId);
            setConfigPreview({
                train: nextConfig.train || {},
                hyperparameters: nextConfig.hyperparameters || {},
                augmentation: nextConfig.augmentation || {},
                val: nextConfig.val || {},
            });
        } catch (error) {
            message.error(error.message || 'Failed to prepare training config');
        } finally {
            setPreparing(false);
        }
    }, [trainingName, selectedBaseModel, activeRelease, projectId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            prepareTrainingSession();
        }, 250);
        return () => clearTimeout(timer);
    }, [prepareTrainingSession]);

    useEffect(() => {
        if (!trainingName.trim()) return;
        if (suppressNameResetRef.current) {
            suppressNameResetRef.current = false;
            return;
        }
        setLastCompletedMetrics(null);
        setLastCompletedSession(null);
        setLiveMetrics(null);
        setStatus('queued');
    }, [trainingName]);

    useEffect(() => {
        if (!projectId || !trainingName.trim() || !sessionId) return;

        const timer = setInterval(async () => {
            try {
                const session = await trainingAPI.getSession({ projectId, name: trainingName.trim() });
                if (!session) return;
                setStatus(session.status || 'queued');
                setSessionId(session.id || null);
                if (session.metrics_json) {
                    try {
                        setLiveMetrics(JSON.parse(session.metrics_json));
                    } catch {
                        /* ignore metrics parse issues */
                    }
                }
            } catch {
                /* non-blocking polling */
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [projectId, trainingName, sessionId]);

    const handleStart = async () => {
        if (!(readiness.nameReady && readiness.releaseReady && readiness.modelReady)) {
            message.error('Training name, release, and base model are required');
            return;
        }

        setStarting(true);
        try {
            await prepareTrainingSession();
            await trainingAPI.startSession({ projectId, name: trainingName.trim() });
            setStatus('running');
            setActiveTab('status');
            message.success('Training started');
        } catch (error) {
            setStatus('queued');
            message.error(error.message || 'Failed to start training');
        } finally {
            setStarting(false);
        }
    };

    const handleStopTraining = async () => {
        if (!projectId || !sessionId) return;
        setIsStopping(true);
        try {
            await trainingAPI.stopSession(projectId, sessionId);
        } catch {
            message.error('Failed to stop training');
        } finally {
            setIsStopping(false);
        }
    };

    const showInitializing = activeTab === 'status'
        && status === 'running'
        && (!liveMetrics || !liveMetrics.training || !liveMetrics.training.epoch);

    const displayedMetrics = liveMetrics || lastCompletedMetrics || {};

    const previewSummary = useMemo(() => {
        const trainingInfo = reference?.training_info || {};
        return [
            ['Framework', trainingInfo.framework || '-'],
            ['Task', trainingInfo.task || '-'],
            ['Base Model', selectedModelOption?.label || fileName(selectedBaseModel)],
            ['Release', activeRelease?.name || '-'],
        ];
    }, [reference, selectedBaseModel, selectedModelOption, activeRelease]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '55vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: '1.4rem 1.75rem 6.5rem', width: '100%', background: 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 50%, #f0fdf4 100%)', minHeight: '100%' }}>
            <Row gutter={16} align="top">
                <Col span={15}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ ...panelStyle, padding: '1.15rem 1.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <ExperimentOutlined style={{ color: '#7c3aed', fontSize: '1rem' }} />
                                    <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>Retraining Training</Text>
                                </div>
                                <Tag color={status === 'completed' ? 'success' : status === 'running' ? 'processing' : 'default'} style={{ margin: 0, borderRadius: 14, fontWeight: 800 }}>
                                    {status === 'completed' ? (trainingName.trim() ? 'Completed' : 'Last result') : status === 'running' ? 'Running' : 'Ready to start'}
                                </Tag>
                            </div>

                            <Row gutter={12}>
                                {previewSummary.map(([label, value]) => (
                                    <Col span={6} key={label}>
                                        <div style={statStyle}>
                                            <Text style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{label}</Text>
                                            <div style={{ color: '#0f172a', fontSize: '1rem', lineHeight: 1.3, fontWeight: 800, marginTop: 8, wordBreak: 'break-word' }}>
                                                {value}
                                            </div>
                                        </div>
                                    </Col>
                                ))}
                            </Row>
                        </div>

                        <div style={{ ...panelStyle, padding: '1.15rem 1.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1rem' }}>
                                <PlayCircleOutlined style={{ color: '#7c3aed', fontSize: '1rem' }} />
                                <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>Training Setup</Text>
                            </div>

                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <Text style={{ display: 'block', color: '#475569', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                                        Training execution name
                                    </Text>
                                    <Input
                                        value={trainingName}
                                        onChange={(e) => setTrainingName(e.target.value)}
                                        placeholder="Enter training execution name"
                                        size="large"
                                        disabled={status === 'running' || starting}
                                        style={{ borderRadius: 10 }}
                                    />
                                </div>

                                <div>
                                    <Text style={{ display: 'block', color: '#475569', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                                        Base model
                                    </Text>
                                    <Select
                                        value={selectedBaseModel || undefined}
                                        onChange={setSelectedBaseModel}
                                        options={modelOptions}
                                        disabled={status === 'running' || starting}
                                        size="large"
                                        style={{ width: '100%' }}
                                        placeholder="Select base model"
                                        optionRender={(option) => {
                                            const data = option.data;
                                            return (
                                                <div style={{ padding: '0.1rem 0' }}>
                                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>{data.label}</div>
                                                    <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 2 }}>{data.hint}</div>
                                                </div>
                                            );
                                        }}
                                    />
                                    {selectedModelOption && (
                                        <div style={{
                                            marginTop: 10,
                                            padding: '0.72rem 0.85rem',
                                            background: 'rgba(248,250,252,0.92)',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <Text strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                                                    {selectedModelOption.label}
                                                </Text>
                                                {selectedModelOption.kind === 'production' && (
                                                    <Tag color="green" style={{ margin: 0, borderRadius: 999, fontWeight: 700 }}>
                                                        Default
                                                    </Tag>
                                                )}
                                            </div>
                                            <Text style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: '0.76rem' }}>
                                                {selectedModelOption.hint}
                                            </Text>
                                        </div>
                                    )}
                                    <Text style={{ display: 'block', marginTop: 8, color: '#64748b', fontSize: '0.78rem' }}>
                                        Default is the production trained model best.pt. If results are not good, switch to the original default pretrained model and try again.
                                    </Text>
                                </div>

                                <Alert
                                    type="info"
                                    showIcon
                                    icon={<InfoCircleOutlined />}
                                    message="All other training settings are copied from the production reference training."
                                    description="Backend flow, subprocess execution, live status, and training-complete behavior stay the same as Full Mode."
                                    style={{ borderRadius: 10 }}
                                />

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<PlayCircleOutlined />}
                                        loading={starting}
                                        disabled={!(readiness.nameReady && readiness.releaseReady && readiness.modelReady) || status === 'running' || preparing}
                                        onClick={handleStart}
                                        style={{
                                            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                                            border: 'none',
                                            borderRadius: 10,
                                            fontWeight: 800,
                                            minWidth: 180,
                                            boxShadow: '0 10px 24px rgba(124,58,237,0.28)',
                                        }}
                                    >
                                        {status === 'running' ? 'Training...' : 'Start Training'}
                                    </Button>

                                    {status === 'running' && (
                                        <Button
                                            danger
                                            size="large"
                                            icon={<StopOutlined />}
                                            loading={isStopping}
                                            onClick={handleStopTraining}
                                            style={{ borderRadius: 10, fontWeight: 700 }}
                                        >
                                            Stop
                                        </Button>
                                    )}

                                    {preparing && (
                                        <Text style={{ color: '#7c3aed', fontSize: '0.8rem', fontWeight: 700 }}>
                                            Syncing config preview...
                                        </Text>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Col>

                <Col span={9}>
                    <div style={{ ...panelStyle, padding: '1rem 1rem 0.8rem', position: 'sticky', top: 16 }}>
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            items={[
                                {
                                    key: 'config',
                                    label: 'Config Preview',
                                    children: (
                                        <div style={tabScrollFrameStyle}>
                                            <div style={{ marginBottom: 10 }}>
                                                <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                                    Read-only preview of the copied production training config with the current run name, model, and release dataset.
                                                </Text>
                                            </div>
                                            <pre style={{
                                                background: 'rgba(248,250,252,0.88)',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 10,
                                                padding: 12,
                                                minHeight: 300,
                                                overflow: 'auto',
                                                margin: 0,
                                                fontSize: 12,
                                            }}>
                                                {JSON.stringify(configPreview, null, 2)}
                                            </pre>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    children: (
                                        <div style={tabScrollFrameStyle}>
                                            {showInitializing ? (
                                                <TrainingInitializing />
                                            ) : (
                                                <LiveTrainingDashboard metrics={displayedMetrics} status={status} />
                                            )}
                                            {status === 'completed' && (
                                                <Alert
                                                    type="success"
                                                    showIcon
                                                    icon={<CheckCircleOutlined />}
                                                    message={trainingName.trim() ? 'Training complete' : 'Last completed retraining result'}
                                                    description={trainingName.trim()
                                                        ? 'The same training-complete flow is active here. Continue to the Results step to review the trained model.'
                                                        : `Showing the latest completed retraining result${lastCompletedSession?.name ? `: ${lastCompletedSession.name}` : ''}. Enter a new training name to start a fresh run.`}
                                                    style={{ marginTop: 12, borderRadius: 10 }}
                                                />
                                            )}
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </Col>
            </Row>
        </div>
    );
};

export default RetrainingTraining;
