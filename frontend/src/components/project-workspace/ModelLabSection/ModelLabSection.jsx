import React, { useState } from 'react';
import { Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import TrainingList from './TrainingList/TrainingList';
import { mockTrainings } from './TrainingList/mockTrainingData';
import { logInfo } from '../../../utils/professional_logger';
import './ModelLabSection.css';

const { Title } = Typography;

/**
 * ModelLabSection Component
 * 
 * Main container for Model Lab feature
 * Two-panel layout: Training List (left) + Details Panel (right)
 */
const ModelLabSection = () => {
    const [selectedTraining, setSelectedTraining] = useState(null);

    const handleTrainingSelect = (training) => {
        setSelectedTraining(training);
        logInfo('app.frontend.ui', 'training_selected', 'Training selected in Model Lab', {
            trainingId: training.id,
            trainingName: training.name,
            taskType: training.taskType
        });
    };

    return (
        <div className="model-lab-container">
            {/* Header */}
            <div className="model-lab-header">
                <Title level={2} className="model-lab-title">
                    <ExperimentOutlined style={{ marginRight: '8px' }} />
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
                        trainings={mockTrainings}
                        onTrainingSelect={handleTrainingSelect}
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
                                        {selectedTraining.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="details-subtitle">
                                    Task: <strong>{selectedTraining.taskType}</strong> •
                                    Epochs: <strong>{selectedTraining.epochs}</strong> •
                                    Date: {new Date(selectedTraining.date).toLocaleDateString()}
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
