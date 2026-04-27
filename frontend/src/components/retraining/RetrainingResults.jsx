import React, { useEffect, useState } from 'react';
import { Modal, Spin, Typography, message } from 'antd';
import {
    ExperimentOutlined,
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.38)',
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
                    .map((session) => ({
                        id: session.id,
                        name: session.name || `Training ${session.id}`,
                        status: session.status || 'queued',
                        taskType: session.task || 'segmentation',
                        date: session.created_at,
                        epochs: getEpochCount(session),
                    }));
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
                        <div style={{ textAlign: 'center', maxWidth: 420, padding: '2rem' }}>
                            <div style={{ fontSize: '3.7rem', color: 'rgba(148,163,184,0.18)', lineHeight: 1, marginBottom: '1rem' }}>
                                <ExperimentOutlined />
                            </div>
                            <div style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.55rem' }}>
                                {selectedTraining.name}
                            </div>
                            <Text style={{ color: '#64748b', fontSize: '0.86rem' }}>
                                Result details will come here next.
                            </Text>
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
