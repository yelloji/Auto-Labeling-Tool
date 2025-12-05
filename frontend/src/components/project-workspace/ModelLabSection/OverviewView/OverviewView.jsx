import React from 'react';
import PropTypes from 'prop-types';
import { Card, Typography, Table, Tag, Tooltip, Tabs } from 'antd';
import AnalyticsView from '../AnalyticsView/AnalyticsView';
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
                <Tag color={training.status === 'completed' ? 'success' : 'default'}>
                    {training.status?.toUpperCase()}
                </Tag>
            </div>

            {/* Tabs */}
            <Tabs defaultActiveKey="overview" items={[
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
                            onClick={() => {
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
                            defaultActiveKey="view"
                            items={[
                                {
                                    key: 'view',
                                    label: (
                                        <Tooltip title="View the training settings that were used for this session">
                                            <span>View Config</span>
                                        </Tooltip>
                                    ),
                                    children: (() => {
                                        const snapshot = configSnapshot;
                                        const totalParams = Object.keys(snapshot).length;
                                        
                                        // Group 1: Basic Settings (8 params)
                                        const basicKeys = ['task', 'mode', 'model', 'data', 'project', 'name', 'exist_ok', 'time'];
                                        
                                        // Group 2: Training Hyperparameters (15 params)
                                        const trainingKeys = ['epochs', 'batch', 'imgsz', 'patience', 'device', 'workers', 
                                                             'optimizer', 'lr0', 'lrf', 'momentum', 'weight_decay',
                                                             'warmup_epochs', 'warmup_momentum', 'warmup_bias_lr', 'nbs'];
                                        
                                        // Group 3: Data Augmentation (18 params)
                                        const augmentKeys = ['hsv_h', 'hsv_s', 'hsv_v', 'degrees', 'translate', 'scale', 
                                                           'shear', 'perspective', 'flipud', 'fliplr', 'bgr', 
                                                           'mosaic', 'mixup', 'cutmix', 'copy_paste', 'copy_paste_mode',
                                                           'auto_augment', 'erasing'];
                                        
                                        // Group 4: Advanced Training (23 params)
                                        const advancedKeys = ['box', 'cls', 'dfl', 'pose', 'kobj', 
                                                            'save', 'save_period', 'cache', 'verbose', 'seed', 'deterministic',
                                                            'single_cls', 'rect', 'cos_lr', 'close_mosaic', 'resume', 
                                                            'amp', 'fraction', 'profile', 'freeze', 'multi_scale', 'dropout', 'plots'];
                                        
                                        // Group 5: Validation (7 params)
                                        const validationKeys = ['split', 'save_json', 'conf', 'iou', 'max_det', 'half', 'dnn'];
                                        
                                        const renderGroup = (title, keys, emoji) => {
                                            const items = keys
                                                .filter(key => snapshot.hasOwnProperty(key))
                                                .map(key => ({
                                                    key: key,
                                                    label: key,
                                                    children: String(snapshot[key])
                                                }));
                                            
                                            if (items.length === 0) return null;
                                            
                                            return (
                                                <Card 
                                                    size="small" 
                                                    style={{ marginBottom: '16px' }}
                                                    title={<span>{emoji} {title} ({items.length})</span>}
                                                >
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                        <tbody>
                                                            {items.map(item => (
                                                                <tr key={item.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                    <td style={{ padding: '4px 8px', fontWeight: '500', width: '35%' }}>
                                                                        {item.label}
                                                                        </td>
                                                                    <td style={{ padding: '4px 8px', color: '#666', wordBreak: 'break-all' }}>
                                                                        {item.children}
                                                                        </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </Card>
                                            );
                                        };
                                        
                                        return (
                                            <div style={{ padding: '20px' }}>
                                                <Title level={4}>Training Configuration ({totalParams} parameters)</Title>
                                                <Text type="secondary" style={{ display: 'block', marginBottom: '20px' }}>
                                                    View all settings that were used for this training session
                                                </Text>
                                                
                                                {renderGroup('Basic Settings', basicKeys, '⚙️')}
                                                {renderGroup('Training Hyperparameters', trainingKeys, '🔧')}
                                                {renderGroup('Data Augmentation', augmentKeys, '🖼️')}
                                                {renderGroup('Advanced Training', advancedKeys, '⚡')}
                                                {renderGroup('Validation', validationKeys, '✅')}
                                            </div>
                                        );
                                    })()
                                },
                                {
                                    key: 'editor',
                                    label: (
                                        <Tooltip title="Edit these settings to reuse in your next training. Changes here won't affect this current training - only they'll be saved for your next training">
                                            <span>Advanced Editor</span>
                                        </Tooltip>
                                    ),
                                    children: (
                                        <div style={{ padding: '20px', textAlign: 'center' }}>
                                            <h3>Advanced Config Editor</h3>
                                            <p>Edit and apply to queued training...</p>
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )
                },
                {
                    key: 'validation',
                    label: 'Validation',
                    children: (
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                            <h3>Custom Validation</h3>
                            <p>Coming soon...</p>
                        </div>
                    )
                }
            ]} />
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
