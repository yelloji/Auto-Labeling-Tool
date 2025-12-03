import React from 'react';
import PropTypes from 'prop-types';
import { Card, Typography, Table, Tag } from 'antd';
import './OverviewView.css';

const { Title, Text } = Typography;

/**
 * OverviewView Component
 * 
 * Displays detailed training overview with:
 * - Quick Stats (instances, images, epochs, classes)
 * - Validation Results (metrics)
 * - Class-wise breakdown
 * - Confusion Matrix
 */
const OverviewView = ({ training }) => {
    if (!training) {
        return (
            <div className="overview-empty">
                <Text type="secondary">Select a training to view details</Text>
            </div>
        );
    }

    // Parse metrics
    let metrics = {};
    try {
        metrics = typeof training.metrics === 'string'
            ? JSON.parse(training.metrics)
            : (training.metrics || {});
    } catch (e) {
        console.error('Failed to parse metrics:', e);
    }

    const validation = metrics.validation || {};
    const trainingMetrics = metrics.training || {};
    const classes = metrics.classes || [];

    // Calculate F1 score
    const calculateF1 = (precision, recall) => {
        if (!precision || !recall) return 0;
        return (2 * precision * recall) / (precision + recall);
    };

    const boxF1 = calculateF1(validation.box_p, validation.box_r);
    const maskF1 = calculateF1(validation.mask_p, validation.mask_r);

    // Quick Stats data
    const quickStats = [
        { label: 'Instances', value: validation.instances || 0, icon: '🎯' },
        { label: 'Images', value: validation.images || 0, icon: '🖼️' },
        { label: 'Epochs', value: training.epochs || trainingMetrics.total_epochs || 0, icon: '🔄' },
        { label: 'Classes', value: classes.length || 0, icon: '📂' }
    ];

    // Helper to format percentage
    const toPercent = (val) => val !== undefined && val !== null ? `${(val * 100).toFixed(1)}%` : 'N/A';

    // Determine metric keys based on task type
    const isSeg = training.taskType === 'segmentation';
    const pKey = isSeg ? 'mask_p' : 'box_p';
    const rKey = isSeg ? 'mask_r' : 'box_r';
    const map50Key = isSeg ? 'mask_map50' : 'box_map50';
    const map5095Key = isSeg ? 'mask_map50_95' : 'box_map50_95';

    // Class-wise table columns
    const classColumns = [
        {
            title: 'Class',
            dataIndex: 'class',
            key: 'class',
            fixed: 'left',
            width: 120,
            render: (text) => <Text strong>{text}</Text>
        },
        // Box Metrics
        {
            title: 'Box Precision',
            dataIndex: 'box_p',
            key: 'box_p',
            render: (val) => toPercent(val)
        },
        {
            title: 'Box Recall',
            dataIndex: 'box_r',
            key: 'box_r',
            render: (val) => toPercent(val)
        },
        {
            title: 'Box F1',
            dataIndex: 'box_f1',
            key: 'box_f1',
            render: (val) => toPercent(val)
        },
        {
            title: 'Box mAP@50',
            dataIndex: 'box_map50',
            key: 'box_map50',
            render: (val) => val?.toFixed(3) || 'N/A'
        },
        {
            title: 'Box mAP@50-95',
            dataIndex: 'box_map50_95',
            key: 'box_map50_95',
            render: (val) => val?.toFixed(3) || 'N/A'
        }
    ];

    // Add Mask metrics if segmentation
    if (isSeg) {
        classColumns.push(
            {
                title: 'Mask Precision',
                dataIndex: 'mask_p',
                key: 'mask_p',
                render: (val) => toPercent(val)
            },
            {
                title: 'Mask Recall',
                dataIndex: 'mask_r',
                key: 'mask_r',
                render: (val) => toPercent(val)
            },
            {
                title: 'Mask F1',
                dataIndex: 'mask_f1',
                key: 'mask_f1',
                render: (val) => toPercent(val)
            },
            {
                title: 'Mask mAP@50',
                dataIndex: 'mask_map50',
                key: 'mask_map50',
                render: (val) => val?.toFixed(3) || 'N/A'
            },
            {
                title: 'Mask mAP@50-95',
                dataIndex: 'mask_map50_95',
                key: 'mask_map50_95',
                render: (val) => val?.toFixed(3) || 'N/A'
            }
        );
    }

    // Add F1 to class data
    const classData = classes.map((cls, idx) => ({
        ...cls,
        key: idx,
        box_f1: calculateF1(cls.box_p, cls.box_r),
        mask_f1: isSeg ? calculateF1(cls.mask_p, cls.mask_r) : undefined
    }));

    return (
        <div className="overview-container">
            {/* Header */}
            <div className="overview-header">
                <div>
                    <Title level={3} style={{ margin: 0 }}>{training.name}</Title>
                    <Text type="secondary">
                        {training.taskType === 'detection' ? 'Object Detection' : 'Instance Segmentation'} •
                        Created {new Date(training.date).toLocaleDateString()}
                    </Text>
                </div>
                <Tag color={training.status === 'completed' ? 'success' : 'default'}>
                    {training.status?.toUpperCase()}
                </Tag>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
                <Title level={4}>Quick Stats</Title>
                <div className="stats-grid">
                    {quickStats.map((stat, idx) => (
                        <Card key={idx} className="stat-card">
                            <div className="stat-icon">{stat.icon}</div>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-label">{stat.label}</div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Validation Results */}
            <div className="validation-results">
                <Title level={4}>Final Validation Metrics</Title>
                <div className="metrics-grid">
                    {/* Box Detection Metrics */}
                    <Card title="Box Detection" className="metrics-card">
                        <div className="metric-row">
                            <Text>Precision:</Text>
                            <Text strong>{toPercent(validation.box_p)}</Text>
                        </div>
                        <div className="metric-row">
                            <Text>Recall:</Text>
                            <Text strong>{toPercent(validation.box_r)}</Text>
                        </div>
                        <div className="metric-row">
                            <Text>F1-Score:</Text>
                            <Text strong>{toPercent(boxF1)}</Text>
                        </div>
                        <div className="metric-row">
                            <Text>mAP@50:</Text>
                            <Text strong>{validation.box_map50?.toFixed(3) || 'N/A'}</Text>
                        </div>
                        <div className="metric-row">
                            <Text>mAP@50-95:</Text>
                            <Text strong>{validation.box_map50_95?.toFixed(3) || 'N/A'}</Text>
                        </div>
                    </Card>

                    {/* Mask Segmentation Metrics (if applicable) */}
                    {training.taskType === 'segmentation' && validation.mask_p !== undefined && (
                        <Card title="Mask Segmentation" className="metrics-card">
                            <div className="metric-row">
                                <Text>Precision:</Text>
                                <Text strong>{toPercent(validation.mask_p)}</Text>
                            </div>
                            <div className="metric-row">
                                <Text>Recall:</Text>
                                <Text strong>{toPercent(validation.mask_r)}</Text>
                            </div>
                            <div className="metric-row">
                                <Text>F1-Score:</Text>
                                <Text strong>{toPercent(maskF1)}</Text>
                            </div>
                            <div className="metric-row">
                                <Text>mAP@50:</Text>
                                <Text strong>{validation.mask_map50?.toFixed(3) || 'N/A'}</Text>
                            </div>
                            <div className="metric-row">
                                <Text>mAP@50-95:</Text>
                                <Text strong>{validation.mask_map50_95?.toFixed(3) || 'N/A'}</Text>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Class-wise Results */}
            {classData.length > 0 && (
                <div className="classwise-results">
                    <Title level={4}>Class-wise Performance</Title>
                    <Table
                        dataSource={classData}
                        columns={classColumns}
                        pagination={false}
                        size="small"
                    />
                </div>
            )}

            {/* Confusion Matrix */}
            <div className="confusion-matrix-section">
                <Title level={4}>Confusion Matrix</Title>
                <div className="confusion-matrix-container">
                    <img
                        src={`/api/v1/projects/${training.projectId}/training/${training.id}/confusion_matrix.png`}
                        alt="Confusion Matrix"
                        className="confusion-matrix-image"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                        }}
                    />
                    <div className="confusion-matrix-placeholder" style={{ display: 'none' }}>
                        <Text type="secondary">Confusion matrix not available</Text>
                    </div>
                </div>
            </div>
        </div>
    );
};

OverviewView.propTypes = {
    training: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
        name: PropTypes.string.isRequired,
        taskType: PropTypes.string,
        status: PropTypes.string,
        epochs: PropTypes.number,
        date: PropTypes.string,
        metrics: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
};

export default OverviewView;
