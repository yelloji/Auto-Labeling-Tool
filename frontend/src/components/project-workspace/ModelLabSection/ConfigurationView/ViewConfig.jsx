import React from 'react';
import PropTypes from 'prop-types';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

/**
 * ViewConfig Component
 * Displays training configuration snapshot in organized groups
 */
const ViewConfig = ({ configSnapshot }) => {
    const snapshot = configSnapshot || {};
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
};

ViewConfig.propTypes = {
    configSnapshot: PropTypes.object.isRequired
};

export default ViewConfig;
