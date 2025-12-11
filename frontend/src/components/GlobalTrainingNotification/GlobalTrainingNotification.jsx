import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { trainingNotificationAPI } from '../../services/api';
import './GlobalTrainingNotification.css';

export default function GlobalTrainingNotification() {
    const [completion, setCompletion] = useState(null);
    const [videoStage, setVideoStage] = useState('hidden'); // hidden, playing, showing

    useEffect(() => {
        let timeoutId;

        const checkForCompletions = async () => {
            try {
                const data = await trainingNotificationAPI.checkCompletions();

                // Handle both legacy array format and new object format
                let completions = [];
                let hasActive = false;

                if (Array.isArray(data)) {
                    completions = data;
                } else if (data && data.completions) {
                    completions = data.completions;
                    hasActive = data.has_active_trainings;
                }

                // Logic to process notifications
                if (completions && completions.length > 0 && !completion) {
                    setCompletion(completions[0]); // Show first completion
                    setVideoStage('playing');
                    setTimeout(() => setVideoStage('showing'), 8000);
                }

                // SMART POLLING:
                // If we have active trainings OR just finished one -> Poll Fast (30s)
                // Otherwise -> Poll Slow (2 mins) to save resources/logs
                const nextInterval = (hasActive || (completions && completions.length > 0))
                    ? 30000
                    : 120000;

                timeoutId = setTimeout(checkForCompletions, nextInterval);

            } catch (error) {
                console.error('Error checking completions:', error);
                // On error, retry in 30s
                timeoutId = setTimeout(checkForCompletions, 30000);
            }
        };

        // Start polling immediately
        checkForCompletions();

        return () => clearTimeout(timeoutId);
    }, [completion]); // Re-run if completion state changes (to avoid overwriting current one)

    const handleDismiss = async () => {
        if (completion) {
            try {
                await trainingNotificationAPI.acknowledgeCompletion(completion.id);
                setVideoStage('hidden');
                setCompletion(null);
            } catch (error) {
                console.error('Error acknowledging completion:', error);
            }
        }
    };

    const handleViewResults = async () => {
        if (completion) {
            // FIRST: Mark as acknowledged
            try {
                await trainingNotificationAPI.acknowledgeCompletion(completion.id);
            } catch (error) {
                console.error('Error acknowledging completion:', error);
            }

            // THEN: Navigate to Model Lab and auto-select training
            window.location.href = `/projects/${completion.project_id}/workspace?section=model-lab&trainingId=${completion.id}`;
        }
    };

    if (!completion || videoStage === 'hidden') return null;

    return (
        <div className="training-notification-overlay">
            {/* Video Background */}
            <video
                className="notification-video"
                src="/assets/training-complete.mp4"
                autoPlay
                muted
            />

            {/* Text Overlay - appears after video */}
            {videoStage === 'showing' && (
                <div className="message-overlay">
                    <div className={`message-card ${completion.status === 'failed' ? 'failed' : 'success'}`}>
                        {completion.status === 'failed' ? (
                            <>
                                <h2>❌ Training Failed ❌</h2>
                                <p className="training-name">"{completion.name}"</p>
                                <p className="project-info">from project "{completion.project_name}"</p>
                                {completion.duration && (
                                    <p className="duration-info">Duration: {completion.duration}</p>
                                )}
                                {completion.error_msg && (
                                    <p className="error-msg">{completion.error_msg}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <h2>🎉 Training Complete! 🎉</h2>
                                <p className="training-name">"{completion.name}"</p>
                                <p className="project-info">from project "{completion.project_name}"</p>
                                {completion.duration && (
                                    <p className="duration-info">Duration: {completion.duration}</p>
                                )}
                            </>
                        )}
                        <div className="action-buttons">
                            <Button
                                type="primary"
                                size="large"
                                onClick={handleViewResults}
                                style={{ marginRight: 12 }}
                            >
                                View Details 🔍
                            </Button>
                            <Button
                                size="large"
                                onClick={handleDismiss}
                            >
                                Got it!
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
