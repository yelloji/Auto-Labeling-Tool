import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Modal, Spin, Table, Tabs, Tag, Typography, message } from 'antd';
import {
    CheckCircleOutlined,
    DownloadOutlined,
    ExperimentOutlined,
    InfoCircleOutlined,
    RocketOutlined,
    SwapOutlined,
    TrophyOutlined,
} from '@ant-design/icons';
import { projectsAPI } from '../../services/api';
import TrainingList from '../project-workspace/ModelLabSection/TrainingList/TrainingList';

const { Text } = Typography;

const pageStyle = {
    padding: '1.4rem 1.75rem 6.5rem',
    width: '100%',
    minHeight: '100%',
    background: 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 52%, #f0fdf4 100%)',
};

const shellStyle = {
    background: 'rgba(255,255,255,0.76)',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    border: '1px solid rgba(255,255,255,0.72)',
    borderRadius: 14,
    boxShadow: '0 14px 30px rgba(15,23,42,0.08)',
    overflow: 'hidden',
};

const leftPanelStyle = {
    width: 340,
    borderRight: '1px solid rgba(226,232,240,0.95)',
    background: 'rgba(255,255,255,0.48)',
    minHeight: 'calc(100vh - 250px)',
    maxHeight: 'calc(100vh - 250px)',
    overflow: 'hidden',
};

const rightPanelStyle = {
    flex: 1,
    minHeight: 'calc(100vh - 250px)',
    background: 'rgba(255,255,255,0.38)',
    overflowY: 'auto',
};

const parseMaybeJson = (value, fallback = null) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const getRetrainingDataPath = (session) => {
    const resolvedConfig = parseMaybeJson(session?.resolved_config_json, {});
    return String(resolvedConfig?.train?.data || '').toLowerCase();
};

const isRetrainingSession = (session) => {
    if (!session) return false;
    const description = String(session.description || '').toLowerCase();
    if (description.includes('retraining mode')) return true;
    return getRetrainingDataPath(session).includes('retraining_data');
};

const getEpochCount = (session) => {
    const metrics = parseMaybeJson(session?.metrics_json || session?.metrics, {});
    return (
        metrics?.training?.total_epochs
        || metrics?.epochs
        || session?.epochs
        || session?.best_epoch
        || 0
    );
};

const toPercent = (value) => (
    value !== undefined && value !== null ? `${(value * 100).toFixed(1)}%` : 'N/A'
);

const calculateF1 = (precision, recall) => {
    if (!precision || !recall) return 0;
    return (2 * precision * recall) / (precision + recall);
};

const parseTrainingForOverview = (session, projectId) => {
    const metrics = parseMaybeJson(session?.metrics_json || session?.metrics, {});
    const validation = metrics?.validation || {};
    const classes = metrics?.classes || [];
    const taskType = session?.task || 'segmentation';
    const isSegmentation = taskType === 'segmentation';
    const quickStats = [
        { label: 'Instances', value: validation.instances || 0, icon: '🎯' },
        { label: 'Images', value: validation.images || 0, icon: '🖼️' },
        { label: 'Epochs', value: getEpochCount(session), icon: '🔄' },
        { label: 'Classes', value: classes.length || 0, icon: '🏷️' },
    ];

    const classRows = classes.map((item, index) => ({
        key: index,
        class: item.class,
        box_p: item.box_p,
        box_r: item.box_r,
        box_f1: calculateF1(item.box_p, item.box_r),
        box_map50: item.box_map50,
        box_map50_95: item.box_map50_95,
        mask_p: item.mask_p,
        mask_r: item.mask_r,
        mask_f1: calculateF1(item.mask_p, item.mask_r),
        mask_map50: item.mask_map50,
        mask_map50_95: item.mask_map50_95,
    }));

    return {
        id: session.id,
        name: session.name || `Training ${session.id}`,
        taskType,
        status: session.status || 'queued',
        date: session.created_at,
        epochs: getEpochCount(session),
        metrics,
        validation,
        classes: classRows,
        isSegmentation,
        quickStats,
        projectId,
    };
};

const overviewCardStyle = {
    borderRadius: 12,
    border: '1px solid #e7eaf3',
    boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
};

const statCardStyle = {
    background: '#fff',
    border: '1px solid #edf2f7',
    borderRadius: 12,
    padding: '1rem 0.75rem 0.85rem',
    textAlign: 'center',
    minHeight: 122,
};

const metricRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.52rem 0',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: '0.84rem',
};

const actionCardStyle = {
    borderRadius: 12,
    border: '1px solid #e7eaf3',
    boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
    marginBottom: '1rem',
};

const OverviewPanel = ({ training }) => {
    const classColumns = [
        {
            title: 'Class',
            dataIndex: 'class',
            key: 'class',
            fixed: 'left',
            width: 120,
            render: (value) => <Text strong>{value}</Text>,
        },
        {
            title: 'Box Precision',
            dataIndex: 'box_p',
            key: 'box_p',
            render: toPercent,
        },
        {
            title: 'Box Recall',
            dataIndex: 'box_r',
            key: 'box_r',
            render: toPercent,
        },
        {
            title: 'Box F1',
            dataIndex: 'box_f1',
            key: 'box_f1',
            render: toPercent,
        },
        {
            title: 'Box mAP@50',
            dataIndex: 'box_map50',
            key: 'box_map50',
            render: (value) => value?.toFixed(3) || 'N/A',
        },
        {
            title: 'Box mAP@50-95',
            dataIndex: 'box_map50_95',
            key: 'box_map50_95',
            render: (value) => value?.toFixed(3) || 'N/A',
        },
    ];

    if (training.isSegmentation) {
        classColumns.push(
            {
                title: 'Mask Precision',
                dataIndex: 'mask_p',
                key: 'mask_p',
                render: toPercent,
            },
            {
                title: 'Mask Recall',
                dataIndex: 'mask_r',
                key: 'mask_r',
                render: toPercent,
            },
            {
                title: 'Mask F1',
                dataIndex: 'mask_f1',
                key: 'mask_f1',
                render: toPercent,
            },
            {
                title: 'Mask mAP@50',
                dataIndex: 'mask_map50',
                key: 'mask_map50',
                render: (value) => value?.toFixed(3) || 'N/A',
            },
            {
                title: 'Mask mAP@50-95',
                dataIndex: 'mask_map50_95',
                key: 'mask_map50_95',
                render: (value) => value?.toFixed(3) || 'N/A',
            },
        );
    }

    const validation = training.validation || {};
    const boxF1 = calculateF1(validation.box_p, validation.box_r);
    const maskF1 = calculateF1(validation.mask_p, validation.mask_r);

    return (
        <div style={{ padding: '1.1rem 1.15rem 1.4rem' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Text strong style={{ fontSize: '1.22rem', color: '#0f172a' }}>{training.name}</Text>
                <div style={{ marginTop: 4 }}>
                    <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {training.taskType === 'detection' ? 'Object Detection' : 'Instance Segmentation'} · Created {new Date(training.date).toLocaleDateString()}
                    </Text>
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <Text strong style={{ display: 'block', color: '#2563eb', fontSize: '1rem', marginBottom: 4 }}>Quick Stats</Text>
                <Text style={{ display: 'block', color: '#64748b', fontSize: '0.77rem', marginBottom: '1rem' }}>
                    Key overview numbers from your training and validation datasets
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
                    {training.quickStats.map((stat) => (
                        <div key={stat.label} style={statCardStyle}>
                            <div style={{
                                width: 44,
                                height: 44,
                                margin: '0 auto 0.8rem',
                                borderRadius: '50%',
                                border: '1px solid #9db1ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.15rem',
                                background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(167,139,250,0.08))',
                            }}>
                                {stat.icon}
                            </div>
                            <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '1.45rem', lineHeight: 1.1 }}>{stat.value}</div>
                            <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 6, textTransform: 'uppercase', fontWeight: 700 }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <Text strong style={{ display: 'block', color: '#2563eb', fontSize: '1rem', marginBottom: 4 }}>Final Validation Metrics</Text>
                <Text style={{ display: 'block', color: '#64748b', fontSize: '0.77rem', marginBottom: '1rem' }}>
                    Performance scores showing how well your model detects objects. Higher values indicate better accuracy.
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: training.isSegmentation ? '1fr 1fr' : '1fr', gap: '0.9rem' }}>
                    <Card title="Box Detection" headStyle={{ color: '#fff', fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }} style={overviewCardStyle}>
                        <div style={metricRowStyle}><span>Precision:</span><strong>{toPercent(validation.box_p)}</strong></div>
                        <div style={metricRowStyle}><span>Recall:</span><strong>{toPercent(validation.box_r)}</strong></div>
                        <div style={metricRowStyle}><span>F1-Score:</span><strong>{toPercent(boxF1)}</strong></div>
                        <div style={metricRowStyle}><span>mAP@50:</span><strong>{validation.box_map50?.toFixed(3) || 'N/A'}</strong></div>
                        <div style={{ ...metricRowStyle, borderBottom: 'none' }}><span>mAP@50-95:</span><strong>{validation.box_map50_95?.toFixed(3) || 'N/A'}</strong></div>
                    </Card>

                    {training.isSegmentation && (
                        <Card title="Mask Segmentation" headStyle={{ color: '#fff', fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }} style={overviewCardStyle}>
                            <div style={metricRowStyle}><span>Precision:</span><strong>{toPercent(validation.mask_p)}</strong></div>
                            <div style={metricRowStyle}><span>Recall:</span><strong>{toPercent(validation.mask_r)}</strong></div>
                            <div style={metricRowStyle}><span>F1-Score:</span><strong>{toPercent(maskF1)}</strong></div>
                            <div style={metricRowStyle}><span>mAP@50:</span><strong>{validation.mask_map50?.toFixed(3) || 'N/A'}</strong></div>
                            <div style={{ ...metricRowStyle, borderBottom: 'none' }}><span>mAP@50-95:</span><strong>{validation.mask_map50_95?.toFixed(3) || 'N/A'}</strong></div>
                        </Card>
                    )}
                </div>
            </div>

            <div>
                <Text strong style={{ display: 'block', color: '#2563eb', fontSize: '1rem', marginBottom: 4 }}>Class-wise Performance</Text>
                <Text style={{ display: 'block', color: '#64748b', fontSize: '0.77rem', marginBottom: '1rem' }}>
                    Detailed performance breakdown for each object class.
                </Text>
                <Table
                    dataSource={training.classes}
                    columns={classColumns}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                />
            </div>
        </div>
    );
};

const DeploymentPanel = ({ projectId, training }) => {
    const [assigning, setAssigning] = useState(false);
    const [unassigning, setUnassigning] = useState(false);
    const [isProduction, setIsProduction] = useState(false);

    useEffect(() => {
        let alive = true;
        const loadProductionState = async () => {
            if (!projectId || !training?.id) return;
            try {
                const response = await fetch(`/api/v1/retraining/${projectId}/reference`);
                if (!response.ok) {
                    if (alive) setIsProduction(false);
                    return;
                }
                const data = await response.json();
                const refTrainingId = data?.training_info?.id;
                if (alive) {
                    setIsProduction(refTrainingId != null && Number(refTrainingId) === Number(training.id));
                }
            } catch {
                if (alive) setIsProduction(false);
            }
        };
        loadProductionState();
        return () => {
            alive = false;
        };
    }, [projectId, training?.id]);

    const handleAssignToProduction = () => {
        if (!projectId || !training?.id) return;
        Modal.confirm({
            title: 'Assign to Production',
            content: `Set "${training.name}" as the production reference for User Retraining Mode? Operators will use its parameters for all future retraining.`,
            okText: 'Assign to Production',
            okButtonProps: { style: { background: '#6d28d9', borderColor: '#7c3aed' } },
            cancelText: 'Cancel',
            onOk: async () => {
                setAssigning(true);
                try {
                    const res = await fetch(`/api/v1/retraining/${projectId}/assign-production`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ training_session_id: training.id }),
                    });
                    if (!res.ok) throw new Error('Failed');
                    const data = await res.json();
                    setIsProduction(true);
                    if (data?.auto_model_added) {
                        message.success(`"${training.name}" is now the production reference, and its production trained model was added to Project Models.`);
                    } else {
                        message.success(`"${training.name}" is now the production reference. Its production trained model already exists in Project Models.`);
                    }
                } catch {
                    message.error('Failed to assign production reference.');
                } finally {
                    setAssigning(false);
                }
            },
        });
    };

    const handleUnassignProduction = () => {
        if (!projectId) return;
        Modal.confirm({
            title: 'Remove Production Reference',
            content: `Remove "${training.name}" as the production reference? Operators will no longer use it for retraining until another model is assigned.`,
            okText: 'Remove Reference',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            onOk: async () => {
                setUnassigning(true);
                try {
                    const res = await fetch(`/api/v1/retraining/${projectId}/unassign-production`, {
                        method: 'DELETE',
                    });
                    if (!res.ok) throw new Error('Failed');
                    const data = await res.json();
                    setIsProduction(false);
                    if (data?.fallback_reference?.assignment_label) {
                        message.success(`Production reference removed. ${data.fallback_reference.assignment_label} is active again.`);
                    } else {
                        message.success('Production reference removed.');
                    }
                } catch {
                    message.error('Failed to remove production reference.');
                } finally {
                    setUnassigning(false);
                }
            },
        });
    };

    return (
        <div style={{ padding: '1.1rem 1.15rem 1.4rem' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Text strong style={{ fontSize: '1.22rem', color: '#0f172a' }}>Deployment</Text>
                <div style={{ marginTop: 4 }}>
                    <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        Approve this retraining model for production use and prepare export actions.
                    </Text>
                </div>
            </div>

            <Card style={actionCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <TrophyOutlined style={{ color: '#7c3aed', fontSize: '1rem' }} />
                        <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>Production Assignment</Text>
                    </div>
                    <Tag color={isProduction ? 'success' : 'default'} style={{ borderRadius: 999, fontWeight: 700, margin: 0 }}>
                        {isProduction ? 'Assigned' : 'Not Assigned'}
                    </Tag>
                </div>

                <Alert
                    type={isProduction ? 'success' : 'info'}
                    showIcon
                    icon={isProduction ? <CheckCircleOutlined /> : <InfoCircleOutlined />}
                    message={isProduction ? 'This retraining model is already the production reference.' : 'This model is not assigned to production yet.'}
                    description={isProduction
                        ? 'This training is now the active retraining reference, and its production trained model is available in Project Models for future retraining.'
                        : 'Assigning to production makes this training the active retraining reference and keeps its production trained model available in Project Models.'}
                    style={{ borderRadius: 10, marginBottom: '1rem' }}
                />

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        loading={assigning}
                        disabled={isProduction}
                        onClick={handleAssignToProduction}
                        style={{
                            background: isProduction ? undefined : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                            border: 'none',
                            borderRadius: 10,
                            fontWeight: 800,
                            minWidth: 190,
                            boxShadow: isProduction ? 'none' : '0 10px 24px rgba(124,58,237,0.28)',
                        }}
                    >
                        {isProduction ? 'Assigned to Production' : 'Assign to Production'}
                    </Button>

                    {isProduction && (
                        <Button
                            danger
                            loading={unassigning}
                            onClick={handleUnassignProduction}
                            style={{ borderRadius: 10, fontWeight: 700 }}
                        >
                            Unassign
                        </Button>
                    )}
                </div>
            </Card>

            <Card style={actionCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <SwapOutlined style={{ color: '#2563eb', fontSize: '1rem' }} />
                        <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>ONNX Conversion</Text>
                    </div>
                    <Tag color="default" style={{ borderRadius: 999, fontWeight: 700, margin: 0 }}>
                        Pending
                    </Tag>
                </div>

                <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    message="best.pt will be used automatically for ONNX conversion."
                    description="We are keeping this simple for operators. No best.pt / last.pt choice is shown here in retraining mode."
                    style={{ borderRadius: 10, marginBottom: '1rem' }}
                />

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Button
                        icon={<SwapOutlined />}
                        disabled
                        style={{ borderRadius: 10, fontWeight: 700 }}
                    >
                        Convert to ONNX
                    </Button>
                    <Button
                        icon={<DownloadOutlined />}
                        disabled
                        style={{ borderRadius: 10, fontWeight: 700 }}
                    >
                        Download ONNX
                    </Button>
                </div>
            </Card>
        </div>
    );
};

const RetrainingResults = ({ projectId }) => {
    const [loading, setLoading] = useState(true);
    const [trainings, setTrainings] = useState([]);
    const [selectedTraining, setSelectedTraining] = useState(null);

    useEffect(() => {
        const loadTrainings = async () => {
            setLoading(true);
            try {
                const sessions = await projectsAPI.getTrainingSessions(projectId);
                const retrainingSessions = (sessions || [])
                    .filter(isRetrainingSession)
                    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                    .map((session) => parseTrainingForOverview(session, projectId));
                setTrainings(retrainingSessions);

            } catch {
                message.error('Failed to load retraining results');
            } finally {
                setLoading(false);
            }
        };

        loadTrainings();
    }, [projectId]);

    const handleTrainingDelete = (training) => {
        Modal.confirm({
            title: 'Delete Training Session',
            content: `Are you sure you want to delete "${training.name}"? This will permanently remove the training folder and data.`,
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await projectsAPI.deleteTrainingSession(projectId, training.id);
                    setTrainings((prev) => prev.filter((item) => item.id !== training.id));
                    if (selectedTraining?.id === training.id) {
                        setSelectedTraining(null);
                    }
                    message.success(`Training "${training.name}" deleted successfully`);
                } catch {
                    message.error('Failed to delete training session');
                }
            },
        });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '55vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={pageStyle}>
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <ExperimentOutlined style={{ color: '#2563eb', fontSize: '1.45rem' }} />
                    <Text strong style={{ fontSize: '1.12rem', color: '#2563eb' }}>Results</Text>
                </div>
                <Text style={{ color: '#64748b', fontSize: '0.84rem' }}>
                    Review your retraining model experiments
                </Text>
            </div>

            <div style={{ ...shellStyle, display: 'flex' }}>
                <div style={leftPanelStyle}>
                    <TrainingList
                        trainings={trainings}
                        onTrainingSelect={setSelectedTraining}
                        onTrainingDelete={handleTrainingDelete}
                    />
                </div>

                <div style={rightPanelStyle}>
                    {selectedTraining ? (
                        <div style={{ width: '100%' }}>
                            <Tabs
                                defaultActiveKey="overview"
                                items={[
                                    {
                                        key: 'overview',
                                        label: 'Overview',
                                        children: <OverviewPanel training={selectedTraining} />,
                                    },
                                    {
                                        key: 'deployment',
                                        label: 'Deployment',
                                        children: <DeploymentPanel projectId={projectId} training={selectedTraining} />,
                                    },
                                ]}
                                style={{ padding: '0 0.9rem' }}
                            />
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', maxWidth: 430, padding: '2rem' }}>
                            <div style={{ fontSize: '3.8rem', color: 'rgba(148,163,184,0.18)', lineHeight: 1, marginBottom: '1rem' }}>
                                <ExperimentOutlined />
                            </div>
                            <div style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.55rem' }}>
                                Select a Training Model
                            </div>
                            <Text style={{ color: '#64748b', fontSize: '0.86rem' }}>
                                Choose a model from the list on the left to view its result details.
                            </Text>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RetrainingResults;
