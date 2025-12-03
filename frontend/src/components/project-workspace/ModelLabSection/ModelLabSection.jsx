import React, { useState, useEffect } from 'react';
import { Typography, Spin, message, Modal } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import TrainingList from './TrainingList/TrainingList';
import { projectsAPI, handleAPIError } from '../../../services/api';
import { logInfo, logError } from '../../../utils/professional_logger';
import './ModelLabSection.css';

const { Title } = Typography;

/**
 * ModelLabSection Component
 * 
 * Main container for Model Lab feature
 * Two-panel layout: Training List (left) + Details Panel (right)
 */
const ModelLabSection = ({ projectId }) => {
    const [selectedTraining, setSelectedTraining] = useState(null);
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrainings = async () => {
            if (!projectId) return;

            setLoading(true);
            try {
                const data = await projectsAPI.getTrainingSessions(projectId);

                // Map API data to UI format
                const mappedTrainings = data.map(session => {
                    let metrics = {};
                    if (session.metrics) {
                        try {
                            metrics = typeof session.metrics === 'string'
                                ? JSON.parse(session.metrics)
                                : session.metrics;
                        } catch (e) {
                            console.error("Failed to parse metrics", e);
                        }
                    }

                    return {
                        id: session.id,
                        name: session.name,
                        taskType: session.task || 'unknown',
                        status: session.status,
                        epochs: metrics.epochs || session.best_epoch || 0,
                        date: session.created_at,
                        metrics: metrics
                    };
                });

                setTrainings(mappedTrainings);
                logInfo('app.frontend.ui', 'trainings_loaded', 'Loaded training sessions', { count: mappedTrainings.length });
            } catch (error) {
                handleAPIError(error, 'Failed to load training sessions');
                logError('app.frontend.ui', 'trainings_load_error', 'Failed to load trainings', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrainings();
    }, [projectId]);

    const handleTrainingSelect = (training) => {
        setSelectedTraining(training);
        logInfo('app.frontend.ui', 'training_selected', 'Training selected in Model Lab', {
            trainingId: training.id,
            trainingName: training.name,
            taskType: training.taskType
        });
    };

    const handleTrainingDelete = async (training) => {
        Modal.confirm({
            title: 'Delete Training Session',
            content: `Are you sure you want to delete "${training.name}"? This will permanently remove the training folder and data.`,
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await projectsAPI.deleteTrainingSession(projectId, training.id);
                    message.success(`Training "${training.name}" deleted successfully`);
                    
                    // Remove from list
                    setTrainings(prev => prev.filter(t => t.id !== training.id));
                    
                    // Clear selection if deleted
                    if (selectedTraining?.id === training.id) {
                        setSelectedTraining(null);
                    }
                    
                    logInfo('app.frontend.ui', 'training_deleted', 'Training deleted', {
                        trainingId: training.id,
                        trainingName: training.name
                    });
                } catch (error) {
                    handleAPIError(error, 'Failed to delete training session');
                    logError('app.frontend.ui', 'training_delete_error', 'Delete failed', error);
                }
            }
        });
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>Loading training sessions...</div>
            </div>
        );
    }

    return (
        <div className="model-lab-container">
            {/* Header */}
            <div className="model-lab-header">
                <Title level={2} className="model-lab-title" style={{ margin: 0, background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>
                    <ExperimentOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    Model Lab
                </Title>
                <p className="model-lab-subtitle">
                    Test, validate, and manage your trained models
                </p>
            </div>

            {/* Two-Panel Layout */}
            <div className="model-lab-content">
                {/* Left Panel - Training List */}
                <div className="model-lab-left-panel">
                    <TrainingList
                        trainings={trainings}
                        onTrainingSelect={handleTrainingSelect}
                        onTrainingDelete={handleTrainingDelete}
                    />
                </div>

                {/* Right Panel - Details */}
                <div className="model-lab-right-panel">
                    {selectedTraining ? (
                        <div className="model-lab-details-container">
                            <div className="details-header">
                                <div className="details-title-row">
                                    <Title level={3} style={{ margin: 0 }}>{selectedTraining.name}</Title>
                                    <span className={`status-badge ${selectedTraining.status}`}>
                                        {selectedTraining.status ? selectedTraining.status.toUpperCase() : 'UNKNOWN'}
                                    </span>
                                </div>
                                <p className="details-subtitle">
                                    Task: <strong>{selectedTraining.taskType}</strong> •
                                    Epochs: <strong>{selectedTraining.epochs}</strong> •
                                    Date: {selectedTraining.date ? new Date(selectedTraining.date).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>

                            <div className="details-content-placeholder">
                                <div className="placeholder-message">
                                    <ExperimentOutlined style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px' }} />
                                    <h3>Detailed Metrics & Visualization</h3>
                                    <p>Full training analysis coming in Task 2A</p>
                                </div>
                                <pre className="debug-data">{JSON.stringify(selectedTraining, null, 2)}</pre>
                            </div>
                        </div>
                    ) : (
                        <div className="model-lab-empty-state">
                            <div className="empty-state-icon">
                                <ExperimentOutlined />
                            </div>
                            <h3>Select a Training Model</h3>
                            <p>Choose a model from the list on the left to view its performance metrics, configuration, and logs.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModelLabSection;
