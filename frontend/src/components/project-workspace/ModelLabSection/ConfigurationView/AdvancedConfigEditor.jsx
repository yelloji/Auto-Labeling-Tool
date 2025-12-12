import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Card, Typography, Input, InputNumber, Select, Button, Modal, message, Alert } from 'antd';
import { projectsAPI } from '../../../../services/api';

const { Title, Text } = Typography;

// Optimizer-specific hyperparameter defaults
const OPTIMIZER_PRESETS = {
    SGD: { lr0: 0.01, lrf: 0.1, momentum: 0.937, weight_decay: 0.0005 },
    Adam: { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    Adamax: { lr0: 0.002, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    AdamW: { lr0: 0.0007, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005 },
    NAdam: { lr0: 0.002, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    RAdam: { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    RMSProp: { lr0: 0.01, lrf: 0.1, momentum: 0.9, weight_decay: 0.0005 }
};

// Default values for user mode (to detect developer mode)
const USER_MODE_DEFAULTS = {
    box: 7.5, cls: 0.5, dfl: 1.5,
    mosaic: 1.0, close_mosaic: 10, mixup: 0.0,
    hsv_h: 0.015, hsv_s: 0.7, hsv_v: 0.4,
    flipud: 0.0, fliplr: 0.5, degrees: 0.0,
    translate: 0.1, scale: 0.5, shear: 0.0, perspective: 0.0,
    rect: false, overlap_mask: true, mask_ratio: 4, freeze: 0,
    conf: 0.25, iou: 0.5, max_det: 300, plots: true
};

// Default values to show in placeholders
const FIELD_DEFAULTS = {
    epochs: 100, batch: 16, imgsz: 640, lr0: 0.01, lrf: 0.01,
    momentum: 0.937, weight_decay: 0.0005, warmup_epochs: 3.0,
    warmup_momentum: 0.8, warmup_bias_lr: 0.1,
    patience: 50, workers: 8, close_mosaic: 10,
    mosaic: 1.0, mixup: 0.0, fliplr: 0.5, flipud: 0.0,
    hsv_h: 0.015, hsv_s: 0.7, hsv_v: 0.4,
    degrees: 0.0, translate: 0.1, scale: 0.5, shear: 0.0, perspective: 0.0,
    box: 7.5, cls: 0.5, dfl: 1.5,
    conf: 0.25, iou: 0.5, max_det: 300
};

/**
 * AdvancedConfigEditor Component
 * Dynamically displays and edits ALL parameters from resolved_config_json
 */
const AdvancedConfigEditor = ({ training }) => {
    const navigate = useNavigate();
    const [config, setConfig] = useState({
        train: {},
        hyperparameters: {},
        augmentation: {},
        val: {}
    });
    const [originalConfig, setOriginalConfig] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Parse resolved_config_json - keep nested structure
        if (training.resolved_config_json) {
            try {
                const parsed = typeof training.resolved_config_json === 'string'
                    ? JSON.parse(training.resolved_config_json)
                    : training.resolved_config_json;

                setConfig(parsed);
                setOriginalConfig(parsed);
            } catch (e) {
                console.error('Failed to parse resolved_config_json:', e);
            }
        }
    }, [training]);

    // Detect if config was created in developer mode
    const isDeveloperConfig = () => {
        const allParams = {
            ...config.train,
            ...config.hyperparameters,
            ...config.augmentation,
            ...config.val
        };

        // Check if ANY value differs from user-mode defaults
        for (const [key, defaultValue] of Object.entries(USER_MODE_DEFAULTS)) {
            if (allParams[key] !== undefined && allParams[key] !== defaultValue) {
                return true; // Developer mode detected!
            }
        }

        // Also check for developer-only optimizers
        if (['Adamax', 'NAdam', 'RAdam', 'RMSProp'].includes(allParams.optimizer)) {
            return true;
        }

        return false; // User mode
    };

    const handleChange = (section, key, value) => {
        setConfig(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: value }
        }));
    };

    const handleReset = () => {
        setConfig({ ...originalConfig });
        message.info('Settings reset to original values');
    };

    const handleApplyToQueued = async () => {
        setLoading(true);
        try {
            // Check for queued training
            const queuedTraining = await projectsAPI.getQueuedTraining(training.projectId);

            if (!queuedTraining) {
                Modal.warning({
                    title: 'No Queued Training Found',
                    content: 'Please create a new training first. This config will be applied to your next queued training.',
                    okText: 'Go to Training',
                    onOk: () => {
                        navigate(`/projects/${training.projectId}/workspace`, {
                            state: { selectedSection: 'model-training' }
                        });
                    }
                });
                setLoading(false);
                return;
            }

            // Show confirmation modal
            Modal.confirm({
                title: 'Apply Config to Training',
                content: (
                    <div>
                        <p>Apply these settings to:</p>
                        <p style={{ fontWeight: 'bold', fontSize: '16px', color: '#1890ff' }}>
                            {queuedTraining.name}
                        </p>
                        <p style={{ marginTop: '12px', color: '#666' }}>
                            <strong>Note:</strong> Model, Data, and Project settings won't be changed.
                            Only training hyperparameters will be updated.
                        </p>
                    </div>
                ),
                okText: 'Apply Config',
                cancelText: 'Cancel',
                onOk: async () => {
                    try {
                        await projectsAPI.applyConfigToTraining(
                            training.projectId,
                            queuedTraining.id,
                            config
                        );
                        message.success(`Config applied to training "${queuedTraining.name}"!`);
                    } catch (error) {
                        message.error('Failed to apply config: ' + error.message);
                    }
                }
            });
        } catch (error) {
            message.error('Error checking for queued training: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderEditableField = (section, key, value) => {
        // Determine field type based on value
        const isBoolean = typeof value === 'boolean';
        const isNumber = typeof value === 'number' || value === null || value === undefined;
        const isString = typeof value === 'string';

        // Special handling for optimizer field
        const isOptimizer = key === 'optimizer';

        return (
            <div key={key} style={{ marginBottom: '12px' }}>
                <Text strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    {key}
                </Text>
                {isBoolean ? (
                    <Select
                        value={value}
                        onChange={(val) => handleChange(section, key, val)}
                        style={{ width: '100%' }}
                        options={[
                            { label: 'True', value: true },
                            { label: 'False', value: false }
                        ]}
                    />
                ) : isOptimizer ? (
                    <Select
                        value={value}
                        onChange={(val) => {
                            handleChange(section, key, val);
                            // Auto-update hyperparameters for this optimizer
                            const preset = OPTIMIZER_PRESETS[val];
                            if (preset) {
                                Object.keys(preset).forEach(paramKey => {
                                    handleChange('hyperparameters', paramKey, preset[paramKey]);
                                });
                                message.success(`Optimizer changed to ${val} - hyperparameters updated!`);
                            }
                        }}
                        style={{ width: '100%' }}
                        options={isDeveloperConfig() ? [
                            { label: 'SGD', value: 'SGD' },
                            { label: 'Adam', value: 'Adam' },
                            { label: 'Adamax', value: 'Adamax' },
                            { label: 'AdamW', value: 'AdamW' },
                            { label: 'NAdam', value: 'NAdam' },
                            { label: 'RAdam', value: 'RAdam' },
                            { label: 'RMSProp', value: 'RMSProp' }
                        ] : [
                            { label: 'SGD', value: 'SGD' },
                            { label: 'Adam', value: 'Adam' },
                            { label: 'AdamW', value: 'AdamW' }
                        ]}
                    />
                ) : isNumber ? (

                    <InputNumber
                        value={value === null || value === undefined || value === 'null' ? undefined : value}
                        onChange={(val) => handleChange(section, key, val === null ? null : val)}
                        style={{ width: '100%' }}
                        step={typeof value === 'number' && value < 1 ? 0.0001 : 1}
                        placeholder={FIELD_DEFAULTS[key] !== undefined ? `Default: ${FIELD_DEFAULTS[key]}` : 'Enter value'}

                    />
                ) : isString ? (
                    <Input
                        value={value}
                        onChange={(e) => handleChange(section, key, e.target.value)}
                        style={{ width: '100%' }}
                    />
                ) : (
                    <Text type="secondary">{String(value)}</Text>
                )}
            </div>
        );
    };

    const renderSection = (title, sectionKey, emoji) => {
        const sectionData = config[sectionKey] || {};

        // Fields to SKIP (set during training creation, not editable here)
        const skipFields = ['model', 'data', 'device'];

        // Filter out non-editable fields
        const keys = Object.keys(sectionData).filter(key => !skipFields.includes(key));

        // Don't render section if empty after filtering
        if (keys.length === 0) return null;

        return (
            <Card
                title={`${emoji} ${title} (${keys.length})`}
                size="small"
                style={{ marginBottom: '16px' }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {keys.map(key => renderEditableField(sectionKey, key, sectionData[key]))}
                </div>
            </Card>
        );
    };

    return (
        <div style={{ padding: '20px' }}>
            <Title level={4}>⚡ Advanced Config Editor</Title>
            <Alert
                message="Edit settings to reuse in your next training"
                description="Changes here won't affect the current training - they'll be saved for your upcoming queued training."
                type="info"
                showIcon
                style={{ marginBottom: '20px' }}
            />

            {renderSection('Training Settings', 'train', '🔧')}
            {renderSection('Hyperparameters', 'hyperparameters', '⚙️')}
            {renderSection('Data Augmentation', 'augmentation', '🖼️')}
            {renderSection('Validation', 'val', '✅')}

            <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                justifyContent: 'flex-end'
            }}>
                <Button onClick={handleReset} disabled={loading}>
                    🔄 Reset Changes
                </Button>
                <Button
                    type="primary"
                    onClick={handleApplyToQueued}
                    loading={loading}
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        fontWeight: 'bold'
                    }}
                >
                    ➕ Add to Upcoming Training
                </Button>
            </div>

            <Alert
                message="Note"
                description="Model, Data, and Project Name must be set when creating the new training - they won't be copied here."
                type="warning"
                showIcon
                style={{ marginTop: '20px' }}
            />
        </div>
    );
};

AdvancedConfigEditor.propTypes = {
    training: PropTypes.shape({
        projectId: PropTypes.number.isRequired,
        resolved_config_json: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
    }).isRequired
};

export default AdvancedConfigEditor;
