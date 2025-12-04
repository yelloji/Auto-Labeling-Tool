import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Card, Typography, Spin } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './AnalyticsView.css';

const { Title, Text } = Typography;

/**
 * AnalyticsView Component
 * 
 * Shows 5 training analytics charts in compact grid.
 * Click to expand all charts in modal with interactive tooltips.
 */
const AnalyticsView = ({ training }) => {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!training) return;

        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const response = await fetch(
                    `/api/v1/projects/${training.projectId}/training/${training.id}/analytics`
                );

                if (!response.ok) throw new Error('Failed to load analytics');

                const data = await response.json();
                setAnalyticsData(data);
                setError(null);
            } catch (err) {
                console.error('Analytics fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [training]);

    if (loading) {
        return (
            <div className="analytics-loading">
                <Spin size="large" />
                <Text>Loading analytics...</Text>
            </div>
        );
    }

    if (error) {
        return (
            <div className="analytics-error">
                <Text type="secondary">Analytics not available</Text>
            </div>
        );
    }

    if (!analyticsData) return null;

    const { epochs, train_losses, val_losses, metrics, is_segmentation } = analyticsData;

    // Prepare data for charts
    const chartData = epochs.map((epoch, idx) => ({
        epoch,
        train_box: train_losses.box[idx],
        train_seg: is_segmentation ? train_losses.seg[idx] : null,
        train_cls: train_losses.cls[idx],
        val_box: val_losses.box[idx],
        val_seg: is_segmentation ? val_losses.seg[idx] : null,
        val_cls: val_losses.cls[idx],
        box_map50: metrics.box_map50[idx],
        box_map50_95: metrics.box_map50_95[idx],
        box_precision: metrics.box_precision[idx],
        box_recall: metrics.box_recall[idx],
        mask_map50: is_segmentation ? metrics.mask_map50[idx] : null,
        mask_map50_95: is_segmentation ? metrics.mask_map50_95[idx] : null,
        mask_precision: is_segmentation ? metrics.mask_precision[idx] : null,
        mask_recall: is_segmentation ? metrics.mask_recall[idx] : null,
    }));

    // Calculate average losses for overfitting check
    const overfitData = epochs.map((epoch, idx) => ({
        epoch,
        train_avg: (train_losses.box[idx] + train_losses.cls[idx] + (is_segmentation ? train_losses.seg[idx] : 0)) / (is_segmentation ? 3 : 2),
        val_avg: (val_losses.box[idx] + val_losses.cls[idx] + (is_segmentation ? val_losses.seg[idx] : 0)) / (is_segmentation ? 3 : 2),
    }));

    const renderChart = (size = 'small') => {
        const fontSize = size === 'small' ? 10 : 12;
        const chartHeight = size === 'small' ? 80 : 400;  // 80px compact, 400px expanded

        return (
            <>
                {/* Chart 1: Training Loss */}
                <div className={`chart-wrapper ${size}`}>
                    <Text strong className="chart-title">Training Loss</Text>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} />
                            <YAxis tick={{ fontSize }} />
                            <Tooltip />
                            {size === 'large' && <Legend />}
                            <Line type="monotone" dataKey="train_box" stroke="#3b82f6" name="Box Loss" strokeWidth={2} />
                            {is_segmentation && <Line type="monotone" dataKey="train_seg" stroke="#8b5cf6" name="Seg Loss" strokeWidth={2} />}
                            <Line type="monotone" dataKey="train_cls" stroke="#ef4444" name="Cls Loss" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 2: Validation Loss */}
                <div className={`chart-wrapper ${size}`}>
                    <Text strong className="chart-title">Validation Loss</Text>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} />
                            <YAxis tick={{ fontSize }} />
                            <Tooltip />
                            {size === 'large' && <Legend />}
                            <Line type="monotone" dataKey="val_box" stroke="#3b82f6" name="Box Loss" strokeWidth={2} />
                            {is_segmentation && <Line type="monotone" dataKey="val_seg" stroke="#8b5cf6" name="Seg Loss" strokeWidth={2} />}
                            <Line type="monotone" dataKey="val_cls" stroke="#ef4444" name="Cls Loss" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 3: Box/mAP Metrics */}
                <div className={`chart-wrapper ${size}`}>
                    <Text strong className="chart-title">{is_segmentation ? 'Box Metrics' : 'Accuracy (mAP)'}</Text>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} />
                            <YAxis tick={{ fontSize }} />
                            <Tooltip />
                            {size === 'large' && <Legend />}
                            <Line type="monotone" dataKey="box_map50" stroke="#10b981" name="mAP@50" strokeWidth={2} />
                            <Line type="monotone" dataKey="box_map50_95" stroke="#06b6d4" name="mAP@50-95" strokeWidth={2} />
                            <Line type="monotone" dataKey="box_precision" stroke="#f59e0b" name="Precision" strokeWidth={2} />
                            <Line type="monotone" dataKey="box_recall" stroke="#ec4899" name="Recall" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 4: Precision/Recall or Mask Metrics */}
                {is_segmentation ? (
                    <div className={`chart-wrapper ${size}`}>
                        <Text strong className="chart-title">Mask Metrics</Text>
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoch" tick={{ fontSize }} />
                                <YAxis tick={{ fontSize }} />
                                <Tooltip />
                                {size === 'large' && <Legend />}
                                <Line type="monotone" dataKey="mask_map50" stroke="#10b981" name="mAP@50" strokeWidth={2} />
                                <Line type="monotone" dataKey="mask_map50_95" stroke="#06b6d4" name="mAP@50-95" strokeWidth={2} />
                                <Line type="monotone" dataKey="mask_precision" stroke="#f59e0b" name="Precision" strokeWidth={2} />
                                <Line type="monotone" dataKey="mask_recall" stroke="#ec4899" name="Recall" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className={`chart-wrapper ${size}`}>
                        <Text strong className="chart-title">Precision & Recall</Text>
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoch" tick={{ fontSize }} />
                                <YAxis tick={{ fontSize }} />
                                <Tooltip />
                                {size === 'large' && <Legend />}
                                <Line type="monotone" dataKey="box_precision" stroke="#f59e0b" name="Precision" strokeWidth={2} />
                                <Line type="monotone" dataKey="box_recall" stroke="#ec4899" name="Recall" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Chart 5: Overfitting Check */}
                <div className={`chart-wrapper ${size} full-width`}>
                    <Text strong className="chart-title">Overfitting Check</Text>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={overfitData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} />
                            <YAxis tick={{ fontSize }} />
                            <Tooltip />
                            {size === 'large' && <Legend />}
                            <Line type="monotone" dataKey="train_avg" stroke="#3b82f6" name="Avg Train Loss" strokeWidth={2} />
                            <Line type="monotone" dataKey="val_avg" stroke="#ef4444" name="Avg Val Loss" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </>
        );
    };

    return (
        <div className="analytics-section">
            <Title level={4}>📊 Training Analytics</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                Track your model's learning progress epoch by epoch
            </Text>

            {/* Compact Grid */}
            <div className="analytics-grid" onClick={() => setExpanded(true)}>
                {renderChart('small')}
                <div className="analytics-overlay">
                    <Text>Click to expand all graphs</Text>
                </div>
            </div>

            {/* Expanded Modal */}
            {expanded && (
                <div className="analytics-modal">
                    <div className="analytics-modal-backdrop" onClick={() => setExpanded(false)}>
                        <div className="analytics-modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="analytics-modal-close" onClick={() => setExpanded(false)}>✕</button>
                            <div className="analytics-grid-large">
                                {renderChart('large')}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

AnalyticsView.propTypes = {
    training: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        projectId: PropTypes.number.isRequired,
    }).isRequired,
};

export default AnalyticsView;
