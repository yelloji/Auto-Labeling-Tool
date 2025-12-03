import React, { useState } from 'react';
import PropTypes from 'prop-types';
import TrainingCard from './TrainingCard';
import './TrainingList.css';

/**
 * TrainingList Component
 * 
 * Displays a scrollable list of training sessions
 * Handles selection state and click events
 * 
 * @param {Array} trainings - Array of training objects
 * @param {Function} onTrainingSelect - Callback when training is selected
 */
const TrainingList = ({ trainings, onTrainingSelect, onTrainingDelete }) => {
    const [selectedId, setSelectedId] = useState(null);

    const handleCardClick = (training) => {
        setSelectedId(training.id);
        onTrainingSelect(training);
    };

    // Empty state
    if (!trainings || trainings.length === 0) {
        return (
            <div className="training-list-container">
                <div className="training-list-header">
                    <h3 className="training-list-title">
                        🔬 Trained Models
                        <span className="training-count">0</span>
                    </h3>
                </div>
                <div className="training-list-body">
                    <div className="training-list-empty">
                        <div className="training-list-empty-icon">📭</div>
                        <div className="training-list-empty-text">No Trainings Found</div>
                        <div className="training-list-empty-subtext">
                            Train your first model to get started!
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="training-list-container">
            {/* Header */}
            <div className="training-list-header">
                <h3 className="training-list-title">
                    🔬 Trained Models
                    <span className="training-count">{trainings.length}</span>
                </h3>
            </div>

            {/* Scrollable List */}
            <div className="training-list-body">
                {trainings.map((training) => (
                    <TrainingCard
                        key={training.id}
                        training={training}
                        isSelected={selectedId === training.id}
                        onClick={() => handleCardClick(training)}
                        onDelete={onTrainingDelete}
                    />
                ))}
            </div>
        </div>
    );
};

TrainingList.propTypes = {
    trainings: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
            name: PropTypes.string.isRequired,
            taskType: PropTypes.string.isRequired,
            status: PropTypes.string.isRequired,
            epochs: PropTypes.number.isRequired,
            date: PropTypes.string.isRequired
        })
    ).isRequired,
    onTrainingSelect: PropTypes.func.isRequired,
    onTrainingDelete: PropTypes.func
};

export default TrainingList;
