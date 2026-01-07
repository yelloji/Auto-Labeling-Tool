import React from 'react';
import { Modal, Table, Space, Typography, Tag, Card } from 'antd';
import { SwapOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * ComparisonModal Component
 * 
 * Compares metrics of multiple experiments side-by-side.
 */
const ComparisonModal = ({ visible, onCancel, experiments }) => {
    if (!experiments || experiments.length === 0) return null;

    // Filter only completed experiments for comparison
    const completedExps = experiments.filter(e => e.status === 'completed');

    if (completedExps.length === 0) {
        return (
            <Modal title="📊 Compare Experiments" visible={visible} onCancel={onCancel} footer={null} centered>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Text type="secondary">No completed experiments found to compare. Run some predictions first!</Text>
                </div>
            </Modal>
        );
    }

    // Columns: First column is the Metric Label, subsequent columns are Experiments
    const columns = [
        {
            title: 'Metric',
            dataIndex: 'metric',
            key: 'metric',
            fixed: 'left',
            width: 150,
            render: (text) => <Text strong>{text}</Text>
        },
        ...completedExps.map(exp => ({
            title: (
                <div style={{ textAlign: 'center' }}>
                    <Text strong>{exp.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                        {new Date(exp.created_at).toLocaleDateString()}
                    </Text>
                </div>
            ),
            dataIndex: exp.id,
            key: exp.id,
            align: 'center',
            width: 180
        }))
    ];

    // Prepare data rows
    const dataSource = [
        {
            key: 'status',
            metric: 'Status',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: <Tag color="success" icon={<CheckCircleOutlined />}>COMPLETED</Tag>
            }), {})
        },
        {
            key: 'confidence_thresh',
            metric: 'Conf Threshold',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.confidence || '-'
            }), {})
        },
        {
            key: 'iou_threshold',
            metric: 'IOU Threshold',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.iou_threshold || '-'
            }), {})
        },
        {
            key: 'imgsz',
            metric: 'Image Size',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.imgsz ? `${exp.imgsz}px` : '-'
            }), {})
        },
        {
            key: 'max_det',
            metric: 'Max Detections',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.max_det || '300'
            }), {})
        },
        {
            key: 'total_detections',
            metric: 'Total Objects',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.analytics_summary?.total_detections || 0
            }), {})
        },
        {
            key: 'avg_confidence',
            metric: 'Avg Confidence',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.analytics_summary?.avg_confidence ? `${(exp.analytics_summary.avg_confidence * 100).toFixed(1)}%` : '-'
            }), {})
        },
        {
            key: 'img_count',
            metric: 'Images',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.image_count || 0
            }), {})
        },
        {
            key: 'duration',
            metric: 'Duration',
            ...completedExps.reduce((acc, exp) => ({
                ...acc,
                [exp.id]: exp.duration_sec ? `${Math.round(exp.duration_sec)}s` : '-'
            }), {})
        }
    ];

    return (
        <Modal
            title={<Space><SwapOutlined /> Multi-Experiment Comparison</Space>}
            visible={visible}
            onCancel={onCancel}
            footer={null}
            width={1000}
            centered
            bodyStyle={{ padding: '1rem' }}
        >
            <Card size="small" style={{ marginBottom: '1rem', background: '#fafafa' }}>
                <Text type="secondary">
                    Comparing {completedExps.length} experiments across key metrics and parameters.
                </Text>
            </Card>

            <Table
                dataSource={dataSource}
                columns={columns}
                pagination={false}
                scroll={{ x: 'max-content' }}
                bordered
                size="middle"
            />
        </Modal>
    );
};

export default ComparisonModal;
