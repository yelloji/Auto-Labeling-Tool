import React from 'react';
import PropTypes from 'prop-types';
import './TrainingCard.css';

/**
 * TrainingCard Component
 * 
 * Displays individual training session with dual-color theme:
 * - Orange for Detection tasks
 * - Teal for Segmentation tasks
 * 
 * @param {Object} training - Training data object
 * @param {boolean} isSelected - Whether this card is currently selected
 * @param {Function} onClick - Click handler
 * @param {Function} onDelete - Delete handler
 */
const TrainingCard = ({ training, isSelected, onClick, onDelete }) => {
    const {
        name,
        taskType,
        status,
        epochs,
        date
    } = training;

    // Format date to readable string
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get status icon
    const getStatusIcon = () => {
        switch (status) {
            case 'completed':
                return '✅';
            case 'failed':
                return '⏸️';
            case 'running':
                return '🔄';
            default:
                return '⚪';
        }
    };

    // Get task type icon
    const getTaskIcon = () => {
        return taskType === 'detection' ? '🔬' : '🎯';
    };

    // Get task type label
    const getTaskLabel = () => {
        return taskType === 'detection' ? 'Detection' : 'Segmentation';
    };

    return (
        <div
            className={`training-card ${taskType} ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onClick();
                }
            }}
        >
            {/* Header: Icon + Name + Status */}
            <div className="training-card-header">
                <span className="training-card-icon">{getTaskIcon()}</span>
                <span className="training-card-name">{name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onDelete && (
                        <button
                            className="training-card-delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(training);
                            }}
                            title="Delete"
                        >
                            🗑️
                        </button>
                    )}
                    <span className={`status-icon status-${status}`}>
                        {getStatusIcon()}
                    </span>
                </div>
            </div>

            {/* Date */}
            <div className="training-card-date">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                {formatDate(date)}
            </div>

            {/* Info: Task Type + Epochs */}
            <div className="training-card-info">
                <span className="training-card-task">{getTaskLabel()}</span>
                <span className="training-card-epochs">{epochs} Epochs</span>
            </div>
        </div>
    );
};

TrainingCard.propTypes = {
    training: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        taskType: PropTypes.oneOf(['detection', 'segmentation']).isRequired,
        status: PropTypes.oneOf(['completed', 'failed']).isRequired,
        epochs: PropTypes.number.isRequired,
        date: PropTypes.string.isRequired,
        metrics: PropTypes.object
    }).isRequired,
    isSelected: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
    onDelete: PropTypes.func
};

export default TrainingCard;
