import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { trainingNotificationAPI } from '../../services/api';
import './GlobalTrainingNotification.css';

export default function GlobalTrainingNotification() {
    const [completion, setCompletion] = useState(null);
    const [videoStage, setVideoStage] = useState('hidden'); // hidden, playing, showing

    useEffect(() => {
        // Poll for completion every 30 seconds
        const interval = setInterval(async () => {
            try {
                const data = await trainingNotificationAPI.checkCompletions();
                if (data && data.length > 0 && !completion) {
                    setCompletion(data[0]); // Show first completion
                    setVideoStage('playing');

                    // After video finishes (8 seconds), show message
                    setTimeout(() => setVideoStage('showing'), 8000);
                }
                // Keep polling even if empty - future trainings may complete!
            } catch (error) {
                console.error('Error checking completions:', error);
            }
        }, 30000); // Check every 30s

        // Initial check
        (async () => {
            try {
                const data = await trainingNotificationAPI.checkCompletions();
                if (data && data.length > 0) {
                    setCompletion(data[0]);
                    setVideoStage('playing');
                    setTimeout(() => setVideoStage('showing'), 8000);
                }
                // Keep polling active for future completions
            } catch (error) {
                console.error('Error checking completions:', error);
            }
        })();

        return () => clearInterval(interval);
    }, []); // ← EMPTY! Run only once on mount

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
