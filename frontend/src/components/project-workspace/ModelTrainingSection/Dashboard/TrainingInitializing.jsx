import React from 'react';
import { Card, Typography } from 'antd';
import { ThunderboltFilled } from '@ant-design/icons';
import './TrainingInitializing.css';

const { Title, Text } = Typography;

const TrainingInitializing = () => {
    return (
        <Card
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: 12,
                minHeight: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
            }}
            bodyStyle={{
                width: '100%',
                padding: '60px 40px',
                textAlign: 'center'
            }}
        >
            <div className="training-initializing-container">
                {/* Animated Icon */}
                <div className="pulse-icon">
                    <ThunderboltFilled
                        style={{
                            fontSize: 80,
                            color: '#fff',
                            filter: 'drop-shadow(0 4px 12px rgba(255, 255, 255, 0.3))'
                        }}
                    />
                </div>

                {/* Main Title */}
                <Title
                    level={2}
                    style={{
                        color: '#fff',
                        marginTop: 32,
                        marginBottom: 16,
                        fontWeight: 700,
                        fontSize: 28,
                        textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}
                >
                    Initializing Training
                </Title>

                {/* Subtitle */}
                <Text
                    style={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: 16,
                        display: 'block',
                        marginBottom: 32
                    }}
                >
                    Setting up model architecture and loading dataset...
                </Text>

                {/* Animated Loading Dots */}
                <div className="loading-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                </div>

                {/* Progress Steps */}
                <div style={{ marginTop: 40 }}>
                    <div className="progress-step fade-in-1">
                        <div className="step-icon">✓</div>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
                            Model configuration loaded
                        </Text>
                    </div>
                    <div className="progress-step fade-in-2">
                        <div className="step-icon">⟳</div>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
                            Preparing training pipeline
                        </Text>
                    </div>
                    <div className="progress-step fade-in-3">
                        <div className="step-icon-pending">○</div>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
                            Waiting for first epoch...
                        </Text>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default TrainingInitializing;
