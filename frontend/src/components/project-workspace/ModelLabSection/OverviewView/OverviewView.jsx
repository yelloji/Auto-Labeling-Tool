import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Typography, Table, Tag, Tooltip, Tabs, Modal, Button, message } from 'antd';
import { TrophyOutlined, DisconnectOutlined } from '@ant-design/icons';
import AnalyticsView from '../AnalyticsView/AnalyticsView';
import ViewConfig from '../ConfigurationView/ViewConfig';
import AdvancedConfigEditor from '../ConfigurationView/AdvancedConfigEditor';
import ModelManagerView from '../ModelManagerView/ModelManagerView';
import ValidationView from '../ValidationView/ValidationView';
import PredictionView from '../PredictionView/PredictionView';
import ComparisonEngineView from '../ComparisonEngine/ComparisonEngineView';
import { mergeModelLabGuideState } from '../modellabGuideState';
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
const OverviewView = ({ training, projectId }) => {
    const [activeTopLevelTab, setActiveTopLevelTab] = useState('overview');
    const [activeConfigTab, setActiveConfigTab] = useState('view');
    const [confusionModalOpen, setConfusionModalOpen] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [unassigning, setUnassigning] = useState(false);
    const [isProduction, setIsProduction] = useState(false);

    // Check if this training is already the production reference
    useEffect(() => {
        if (!projectId || !training?.id) return;
        fetch(`/api/v1/retraining/${projectId}/reference`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const refTrainingId = data?.training_info?.id;
                setIsProduction(refTrainingId != null && Number(refTrainingId) === Number(training.id));
            })
            .catch(() => setIsProduction(false));
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
            content: `Remove "${training.name}" as the production reference? Operators will no longer be able to retrain using this project's settings until a new reference is assigned.`,
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
                    setIsProduction(false);
                    message.success('Production reference removed.');
                } catch {
                    message.error('Failed to remove production reference.');
                } finally {
                    setUnassigning(false);
                }
            },
        });
    };

    useEffect(() => {
        if (!training) return;

        const topLevelStateMap = {
            overview: 'modellab-overview',
            configuration: activeConfigTab === 'editor' ? 'modellab-config-advanced' : 'modellab-config-view',
            'model-manager': 'modellab-model-manager',
            validation: 'modellab-validation',
            prediction: 'modellab-prediction',
            'comparison-engine': 'modellab-comparison-engine',
        };

        mergeModelLabGuideState({
            activeTopLevelTab,
            activeConfigTab,
            confusionMatrixOpen: confusionModalOpen,
            stateKey: confusionModalOpen ? 'modellab-confusion-modal' : (topLevelStateMap[activeTopLevelTab] || 'modellab-overview'),
        }, confusionModalOpen ? { forceRefresh: true } : {});
    }, [training, activeTopLevelTab, activeConfigTab, confusionModalOpen]);

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
    // Parse training_config_snapshot (YAML format)
    let configSnapshot = {};
    try {
        if (typeof training.training_config_snapshot === 'string') {
            // Parse YAML-like format: "key: value" lines
            const lines = training.training_config_snapshot.split('\n');
            lines.forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    if (key && value !== 'null') {
                        configSnapshot[key] = value;
                    }
                }
            });
        } else {
            configSnapshot = training.training_config_snapshot || {};
        }
    } catch (e) {
        console.error('Failed to parse training_config_snapshot:', e);
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
        { label: 'Classes', value: classes.length || 0, icon: '🏷️' }
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
            title: () => (
                <Tooltip title="Object class name">
                    <span>Class</span>
                </Tooltip>
            ),
            dataIndex: 'class',
            key: 'class',
            fixed: 'left',
            width: 120,
            render: (text) => <Text strong>{text}</Text>
        },
        // Box Metrics
        {
            title: () => (
                <Tooltip title="Precision measures how many predicted boxes are correct for this class">
                    <span>Box Precision</span>
                </Tooltip>
            ),
            dataIndex: 'box_p',
            key: 'box_p',
            render: (val) => toPercent(val)
        },
        {
            title: () => (
                <Tooltip title="Recall measures how many actual objects of this class were detected">
                    <span>Box Recall</span>
                </Tooltip>
            ),
            dataIndex: 'box_r',
            key: 'box_r',
            render: (val) => toPercent(val)
        },
        {
            title: () => (
                <Tooltip title="F1-Score is the harmonic mean of Precision and Recall for this class">
                    <span>Box F1</span>
                </Tooltip>
            ),
            dataIndex: 'box_f1',
            key: 'box_f1',
            render: (val) => toPercent(val)
        },
        {
            title: () => (
                <Tooltip title="Mean Average Precision for boxes at 50% IoU threshold for this class">
                    <span>Box mAP@50</span>
                </Tooltip>
            ),
            dataIndex: 'box_map50',
            key: 'box_map50',
            render: (val) => val?.toFixed(3) || 'N/A'
        },
        {
            title: () => (
                <Tooltip title="Mean Average Precision for boxes averaged across IoU thresholds 50% to 95% for this class">
                    <span>Box mAP@50-95</span>
                </Tooltip>
            ),
            dataIndex: 'box_map50_95',
            key: 'box_map50_95',
            render: (val) => val?.toFixed(3) || 'N/A'
        }
    ];

    // Add Mask metrics if segmentation
    if (isSeg) {
        classColumns.push(
            {
                title: () => (
                    <Tooltip title="Precision measures how many predicted masks are correct for this class">
                        <span>Mask Precision</span>
                    </Tooltip>
                ),
                dataIndex: 'mask_p',
                key: 'mask_p',
                render: (val) => toPercent(val)
            },
            {
                title: () => (
                    <Tooltip title="Recall measures how many actual masks of this class were detected">
                        <span>Mask Recall</span>
                    </Tooltip>
                ),
                dataIndex: 'mask_r',
                key: 'mask_r',
                render: (val) => toPercent(val)
            },
            {
                title: () => (
                    <Tooltip title="F1-Score is the harmonic mean of Precision and Recall for masks of this class">
                        <span>Mask F1</span>
                    </Tooltip>
                ),
                dataIndex: 'mask_f1',
                key: 'mask_f1',
                render: (val) => toPercent(val)
            },
            {
                title: () => (
                    <Tooltip title="Mean Average Precision for masks at 50% IoU threshold for this class">
                        <span>Mask mAP@50</span>
                    </Tooltip>
                ),
                dataIndex: 'mask_map50',
                key: 'mask_map50',
                render: (val) => val?.toFixed(3) || 'N/A'
            },
            {
                title: () => (
                    <Tooltip title="Mean Average Precision for masks averaged across IoU thresholds 50% to 95% for this class">
                        <span>Mask mAP@50-95</span>
                    </Tooltip>
                ),
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
                    <Title level={4} style={{ margin: 0, marginBottom: 4 }}>{training.name}</Title>
                    <Text type="secondary">
                        {training.taskType === 'detection' ? 'Object Detection' : 'Instance Segmentation'} •
                        Created {new Date(training.date).toLocaleDateString()}
                    </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Tag color={training.status === 'completed' ? 'success' : 'default'}>
                        {training.status?.toUpperCase()}
                    </Tag>
                    {training.status === 'completed' && projectId && (
                        <>
                            <Tooltip title={isProduction ? 'This training is the current production reference' : 'Set as production reference for User Retraining Mode'}>
                                <Button
                                    size="small"
                                    icon={<TrophyOutlined />}
                                    loading={assigning}
                                    disabled={isProduction}
                                    onClick={handleAssignToProduction}
                                    style={{
                                        background: isProduction ? 'rgba(109,40,217,0.15)' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                                        border: isProduction ? '1px solid #7c3aed' : 'none',
                                        color: '#fff',
                                        fontWeight: 600,
                                        fontSize: '0.75rem',
                                        borderRadius: '6px',
                                    }}
                                >
                                    {isProduction ? 'Production Reference' : 'Assign to Production'}
                                </Button>
                            </Tooltip>
                            {isProduction && (
                                <Tooltip title="Remove this training as the production reference">
                                    <Button
                                        size="small"
                                        icon={<DisconnectOutlined />}
                                        loading={unassigning}
                                        onClick={handleUnassignProduction}
                                        style={{
                                            background: 'rgba(220,38,38,0.1)',
                                            border: '1px solid rgba(220,38,38,0.4)',
                                            color: '#f87171',
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            borderRadius: '6px',
                                        }}
                                    >
                                        Unassign
                                    </Button>
                                </Tooltip>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs activeKey={activeTopLevelTab} onChange={setActiveTopLevelTab} items={[
                {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                        <>

                            {/* Quick Stats */}
                            <div className="quick-stats">
                                <Title level={4}>Quick Stats</Title>
                                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                    Key overview numbers from your training and validation datasets
                                </Text>
                                <div className="stats-grid">
                                    {quickStats.map((stat, idx) => {
                                        let tooltipText = '';
                                        switch (stat.label) {
                                            case 'Instances':
                                                tooltipText = 'Total number of object instances in validation dataset';
                                                break;
                                            case 'Images':
                                                tooltipText = 'Total number of images in validation dataset';
                                                break;
                                            case 'Epochs':
                                                tooltipText = 'Total number of training epochs completed';
                                                break;
                                            case 'Classes':
                                                tooltipText = 'Total number of object classes in training dataset';
                                                break;
                                            default:
                                                tooltipText = `Total number of ${stat.label.toLowerCase()}`;
                                        }
                                        return (
                                            <Tooltip key={idx} title={tooltipText} placement="top">
                                                <Card className="stat-card">
                                                    <div className="stat-icon-circle">
                                                        <div className="stat-icon">{stat.icon}</div>
                                                    </div>
                                                    <div className="stat-value">{stat.value}</div>
                                                    <div className="stat-label">{stat.label}</div>
                                                </Card>
                                            </Tooltip>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Validation Results */}
                            <div className="validation-results">
                                <Title level={4}>Final Validation Metrics</Title>
                                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                    Performance scores showing how well your model detects objects. Higher values (closer to 100%) indicate better accuracy.
                                </Text>
                                <div className="metrics-grid">
                                    {/* Box Detection Metrics */}
                                    <Card title="Box Detection" className="metrics-card">
                                        <Tooltip title="Precision measures how many predicted boxes are correct">
                                            <div className="metric-row">
                                                <Text>Precision:</Text>
                                                <Text strong>{toPercent(validation.box_p)}</Text>
                                            </div>
                                        </Tooltip>
                                        <Tooltip title="Recall measures how many actual objects were detected">
                                            <div className="metric-row">
                                                <Text>Recall:</Text>
                                                <Text strong>{toPercent(validation.box_r)}</Text>
                                            </div>
                                        </Tooltip>
                                        <Tooltip title="F1-Score is the harmonic mean of Precision and Recall">
                                            <div className="metric-row">
                                                <Text>F1-Score:</Text>
                                                <Text strong>{toPercent(boxF1)}</Text>
                                            </div>
                                        </Tooltip>
                                        <Tooltip title="Mean Average Precision at 50% IoU threshold">
                                            <div className="metric-row">
                                                <Text>mAP@50:</Text>
                                                <Text strong>{validation.box_map50?.toFixed(3) || 'N/A'}</Text>
                                            </div>
                                        </Tooltip>
                                        <Tooltip title="Mean Average Precision averaged across IoU thresholds 50% to 95%">
                                            <div className="metric-row">
                                                <Text>mAP@50-95:</Text>
                                                <Text strong>{validation.box_map50_95?.toFixed(3) || 'N/A'}</Text>
                                            </div>
                                        </Tooltip>
                                    </Card>

                                    {/* Mask Segmentation Metrics (if applicable) */}
                                    {training.taskType === 'segmentation' && validation.mask_p !== undefined && (
                                        <Card title="Mask Segmentation" className="metrics-card">
                                            <Tooltip title="Precision measures how many predicted masks are correct">
                                                <div className="metric-row">
                                                    <Text>Precision:</Text>
                                                    <Text strong>{toPercent(validation.mask_p)}</Text>
                                                </div>
                                            </Tooltip>
                                            <Tooltip title="Recall measures how many actual masks were detected">
                                                <div className="metric-row">
                                                    <Text>Recall:</Text>
                                                    <Text strong>{toPercent(validation.mask_r)}</Text>
                                                </div>
                                            </Tooltip>
                                            <Tooltip title="F1-Score is the harmonic mean of Precision and Recall for masks">
                                                <div className="metric-row">
                                                    <Text>F1-Score:</Text>
                                                    <Text strong>{toPercent(maskF1)}</Text>
                                                </div>
                                            </Tooltip>
                                            <Tooltip title="Mean Average Precision for masks at 50% IoU threshold">
                                                <div className="metric-row">
                                                    <Text>mAP@50:</Text>
                                                    <Text strong>{validation.mask_map50?.toFixed(3) || 'N/A'}</Text>
                                                </div>
                                            </Tooltip>
                                            <Tooltip title="Mean Average Precision for masks averaged across IoU thresholds 50% to 95%">
                                                <div className="metric-row">
                                                    <Text>mAP@50-95:</Text>
                                                    <Text strong>{validation.mask_map50_95?.toFixed(3) || 'N/A'}</Text>
                                                </div>
                                            </Tooltip>
                                        </Card>
                                    )}
                                </div>
                            </div>

                            {/* Class-wise Results */}
                            {classData.length > 0 && (
                                <div className="classwise-results">
                                    <Title level={4}>Class-wise Performance</Title>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                        Detailed performance breakdown for each object class. Shows how well your model identifies specific types of objects.
                                    </Text>
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
                                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                    Visual heatmap showing prediction accuracy. Diagonal cells show correct predictions, off-diagonal shows confusion between classes.
                                </Text>
                                <div className="confusion-matrix-container">
                                    <Tooltip title="Click to view full size">
                                        <img
                                            src={`/api/v1/projects/${training.projectId}/training/${training.id}/confusion_matrix.png`}
                                            alt="Confusion Matrix"
                                            className="confusion-matrix-image confusion-matrix-thumbnail"
                                            onClick={() => { setConfusionModalOpen(true); return;
                                                // Open image in modal with loading state
                                                const modal = document.createElement('div');
                                                modal.className = 'confusion-matrix-modal';
                                                modal.innerHTML = `
                                    <div class="confusion-matrix-modal-backdrop">
                                        <div class="confusion-matrix-modal-content">
                                            <button class="confusion-matrix-modal-close">✕</button>
                                            <div class="confusion-matrix-loading">
                                                <div class="spinner"></div>
                                                <p>Loading confusion matrix...</p>
                                            </div>
                                            <img 
                                                src="/api/v1/projects/${training.projectId}/training/${training.id}/confusion_matrix.png" 
                                                alt="Confusion Matrix Full Size" 
                                                style="display: none;" 
                                                onload="this.style.display='block'; this.previousElementSibling.style.display='none';"
                                            />
                                        </div>
                                    </div>
                                `;
                                                document.body.appendChild(modal);

                                                // Close on click
                                                modal.querySelector('.confusion-matrix-modal-backdrop').addEventListener('click', (e) => {
                                                    if (e.target.classList.contains('confusion-matrix-modal-backdrop') ||
                                                        e.target.classList.contains('confusion-matrix-modal-close')) {
                                                        document.body.removeChild(modal);
                                                    }
                                                });
                                            }}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'block';
                                            }}
                                        />
                                    </Tooltip>
                                    <div className="confusion-matrix-placeholder" style={{ display: 'none' }}>
                                        <Text type="secondary">Confusion matrix not available</Text>
                                    </div>
                                </div>
                            </div>
                            {/* Analytics Section */}
                            <AnalyticsView training={training} />
                        </>
                    )
                },
                {
                    key: 'configuration',
                    label: 'Configuration',
                    children: (
                        <Tabs
                            activeKey={activeConfigTab}
                            onChange={setActiveConfigTab}
                            items={[
                                {
                                    key: 'view',
                                    label: (
                                        <Tooltip title="View the training settings that were used for this session">
                                            <span>View Config</span>
                                        </Tooltip>
                                    ),
                                    children: <ViewConfig configSnapshot={configSnapshot} />
                                },
                                {
                                    key: 'editor',
                                    label: (
                                        <Tooltip title="Edit these settings to reuse in your next training. Changes here won't affect this current training - only they'll be saved for your next training">
                                            <span>Advanced Config Editor</span>
                                        </Tooltip>
                                    ),
                                    children: <AdvancedConfigEditor training={training} />
                                }
                            ]}
                        />
                    )
                },
                {
                    key: 'model-manager',
                    label: 'Model Manager',
                    children: (
                        <ModelManagerView
                            projectId={training.projectId}
                            trainingId={training.id}
                            sessionName={training.name}
                        />
                    )
                },
                {
                    key: 'validation',
                    label: 'Validation',
                    children: <ValidationView training={training} />
                },
                {
                    key: 'prediction',
                    label: 'Prediction',
                    children: <PredictionView training={training} />
                },
                {
                    key: 'comparison-engine',
                    label: 'Comparison Engine',
                    children: <ComparisonEngineView currentTraining={training} />
                }
            ]} />
            <Modal
                open={confusionModalOpen}
                onCancel={() => setConfusionModalOpen(false)}
                footer={null}
                width="80vw"
                destroyOnClose
                title="Confusion Matrix"
            >
                <img
                    src={`/api/v1/projects/${training.projectId}/training/${training.id}/confusion_matrix.png`}
                    alt="Confusion Matrix Full Size"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                />
            </Modal>
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
