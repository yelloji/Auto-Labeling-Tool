import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Card, Typography, Spin, Checkbox } from 'antd';
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

    // State for line visibility (only used in expanded view)
    const [visibleLines, setVisibleLines] = useState({
        train_box: true,
        train_seg: true,
        train_cls: true,
        val_box: true,
        val_seg: true,
        val_cls: true,
        box_map50: true,
        box_map50_95: true,
        box_precision: true,
        box_recall: true,
        mask_map50: true,
        mask_map50_95: true,
        mask_precision: true,
        mask_recall: true,
        train_avg: true,
        val_avg: true
    });

    const toggleLine = (lineKey) => {
        setVisibleLines(prev => ({
            ...prev,
            [lineKey]: !prev[lineKey]
        }));
    };

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
                    {size === 'large' && (
                        <div className="chart-filters">
                            <Checkbox checked={visibleLines.train_box} onChange={() => toggleLine('train_box')}>
                                <span style={{ color: '#3b82f6', fontSize: '16px', fontWeight: 'bold' }}>●</span> Box Loss
                            </Checkbox>
                            {is_segmentation && (
                                <Checkbox checked={visibleLines.train_seg} onChange={() => toggleLine('train_seg')}>
                                    <span style={{ color: '#8b5cf6', fontSize: '16px', fontWeight: 'bold' }}>●</span> Seg Loss
                                </Checkbox>
                            )}
                            <Checkbox checked={visibleLines.train_cls} onChange={() => toggleLine('train_cls')}>
                                <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>●</span> Cls Loss
                            </Checkbox>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} label={{ value: 'Epochs', position: 'insideBottom', offset: 0 }} />
                            <YAxis tick={{ fontSize }} label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            {visibleLines.train_box && <Line type="monotone" dataKey="train_box" stroke="#3b82f6" name="Box Loss" strokeWidth={2} />}
                            {is_segmentation && visibleLines.train_seg && <Line type="monotone" dataKey="train_seg" stroke="#8b5cf6" name="Seg Loss" strokeWidth={2} />}
                            {visibleLines.train_cls && <Line type="monotone" dataKey="train_cls" stroke="#ef4444" name="Cls Loss" strokeWidth={2} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 2: Validation Loss */}
                <div className={`chart-wrapper ${size}`}>
                    <Text strong className="chart-title">Validation Loss</Text>
                    {size === 'large' && (
                        <div className="chart-filters">
                            <Checkbox checked={visibleLines.val_box} onChange={() => toggleLine('val_box')}>
                                <span style={{ color: '#3b82f6', fontSize: '16px', fontWeight: 'bold' }}>●</span> Box Loss
                            </Checkbox>
                            {is_segmentation && (
                                <Checkbox checked={visibleLines.val_seg} onChange={() => toggleLine('val_seg')}>
                                    <span style={{ color: '#8b5cf6', fontSize: '16px', fontWeight: 'bold' }}>●</span> Seg Loss
                                </Checkbox>
                            )}
                            <Checkbox checked={visibleLines.val_cls} onChange={() => toggleLine('val_cls')}>
                                <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>●</span> Cls Loss
                            </Checkbox>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} label={{ value: 'Epochs', position: 'insideBottom', offset: 0 }} />
                            <YAxis tick={{ fontSize }} label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            {visibleLines.val_box && <Line type="monotone" dataKey="val_box" stroke="#3b82f6" name="Box Loss" strokeWidth={2} />}
                            {is_segmentation && visibleLines.val_seg && <Line type="monotone" dataKey="val_seg" stroke="#8b5cf6" name="Seg Loss" strokeWidth={2} />}
                            {visibleLines.val_cls && <Line type="monotone" dataKey="val_cls" stroke="#ef4444" name="Cls Loss" strokeWidth={2} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 3: Precision & Recall (Segmentation) OR mAP only (Detection) */}
                <div className={`chart-wrapper ${size}`}>
                    <Text strong className="chart-title">{is_segmentation ? 'Precision & Recall Comparison' : 'Accuracy (mAP)'}</Text>
                    {size === 'large' && (
                        <div className="chart-filters">
                            {is_segmentation ? (
                                <>
                                    <Checkbox checked={visibleLines.box_precision} onChange={() => toggleLine('box_precision')}>
                                        <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 'bold' }}>●</span> Box Precision
                                    </Checkbox>
                                    <Checkbox checked={visibleLines.box_recall} onChange={() => toggleLine('box_recall')}>
                                        <span style={{ color: '#ec4899', fontSize: '16px', fontWeight: 'bold' }}>●</span> Box Recall
                                    </Checkbox>
                                    <Checkbox checked={visibleLines.mask_precision} onChange={() => toggleLine('mask_precision')}>
                                        <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>●</span> Mask Precision
                                    </Checkbox>
                                    <Checkbox checked={visibleLines.mask_recall} onChange={() => toggleLine('mask_recall')}>
                                        <span style={{ color: '#06b6d4', fontSize: '16px', fontWeight: 'bold' }}>●</span> Mask Recall
                                    </Checkbox>
                                </>
                            ) : (
                                <>
                                    <Checkbox checked={visibleLines.box_map50} onChange={() => toggleLine('box_map50')}>
                                        <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>●</span> mAP@50
                                    </Checkbox>
                                    <Checkbox checked={visibleLines.box_map50_95} onChange={() => toggleLine('box_map50_95')}>
                                        <span style={{ color: '#06b6d4', fontSize: '16px', fontWeight: 'bold' }}>●</span> mAP@50-95
                                    </Checkbox>
                                </>
                            )}
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} label={{ value: 'Epochs', position: 'insideBottom', offset: 0 }} />
                            <YAxis tick={{ fontSize }} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            {is_segmentation ? (
                                <>
                                    {visibleLines.box_precision && <Line type="monotone" dataKey="box_precision" stroke="#f59e0b" name="Box Precision" strokeWidth={2} />}
                                    {visibleLines.box_recall && <Line type="monotone" dataKey="box_recall" stroke="#ec4899" name="Box Recall" strokeWidth={2} />}
                                    {visibleLines.mask_precision && <Line type="monotone" dataKey="mask_precision" stroke="#10b981" name="Mask Precision" strokeWidth={2} />}
                                    {visibleLines.mask_recall && <Line type="monotone" dataKey="mask_recall" stroke="#06b6d4" name="Mask Recall" strokeWidth={2} />}
                                </>
                            ) : (
                                <>
                                    {visibleLines.box_map50 && <Line type="monotone" dataKey="box_map50" stroke="#10b981" name="mAP@50" strokeWidth={2} />}
                                    {visibleLines.box_map50_95 && <Line type="monotone" dataKey="box_map50_95" stroke="#06b6d4" name="mAP@50-95" strokeWidth={2} />}
                                </>
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 4: mAP Comparison */}
                {is_segmentation ? (
                    <div className={`chart-wrapper ${size}`}>
                        <Text strong className="chart-title">mAP Comparison</Text>
                        {size === 'large' && (
                            <div className="chart-filters">
                                <Checkbox checked={visibleLines.box_map50} onChange={() => toggleLine('box_map50')}>
                                    <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>●</span> Box mAP@50
                                </Checkbox>
                                <Checkbox checked={visibleLines.box_map50_95} onChange={() => toggleLine('box_map50_95')}>
                                    <span style={{ color: '#06b6d4', fontSize: '16px', fontWeight: 'bold' }}>●</span> Box mAP@50-95
                                </Checkbox>
                                <Checkbox checked={visibleLines.mask_map50} onChange={() => toggleLine('mask_map50')}>
                                    <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 'bold' }}>●</span> Mask mAP@50
                                </Checkbox>
                                <Checkbox checked={visibleLines.mask_map50_95} onChange={() => toggleLine('mask_map50_95')}>
                                    <span style={{ color: '#ec4899', fontSize: '16px', fontWeight: 'bold' }}>●</span> Mask mAP@50-95
                                </Checkbox>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoch" tick={{ fontSize }} label={{ value: 'Epochs', position: 'insideBottom', offset: 0 }} />
                                <YAxis tick={{ fontSize }} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                {visibleLines.box_map50 && <Line type="monotone" dataKey="box_map50" stroke="#10b981" name="Box mAP@50" strokeWidth={2} />}
                                {visibleLines.box_map50_95 && <Line type="monotone" dataKey="box_map50_95" stroke="#06b6d4" name="Box mAP@50-95" strokeWidth={2} />}
                                {visibleLines.mask_map50 && <Line type="monotone" dataKey="mask_map50" stroke="#f59e0b" name="Mask mAP@50" strokeWidth={2} />}
                                {visibleLines.mask_map50_95 && <Line type="monotone" dataKey="mask_map50_95" stroke="#ec4899" name="Mask mAP@50-95" strokeWidth={2} />}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className={`chart-wrapper ${size}`}>
                        <Text strong className="chart-title">Precision & Recall</Text>
                        {size === 'large' && (
                            <div className="chart-filters">
                                <Checkbox checked={visibleLines.box_precision} onChange={() => toggleLine('box_precision')}>
                                    <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 'bold' }}>●</span> Precision
                                </Checkbox>
                                <Checkbox checked={visibleLines.box_recall} onChange={() => toggleLine('box_recall')}>
                                    <span style={{ color: '#ec4899', fontSize: '16px', fontWeight: 'bold' }}>●</span> Recall
                                </Checkbox>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoch" tick={{ fontSize }} label={{ value: 'Epochs', position: 'insideBottom', offset: 0 }} />
                                <YAxis tick={{ fontSize }} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                {visibleLines.box_precision && <Line type="monotone" dataKey="box_precision" stroke="#f59e0b" name="Precision" strokeWidth={2} />}
                                {visibleLines.box_recall && <Line type="monotone" dataKey="box_recall" stroke="#ec4899" name="Recall" strokeWidth={2} />}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Chart 5: Overfitting Check */}
                <div className={`chart-wrapper ${size} full-width`}>
                    <Text strong className="chart-title">Overfitting Check</Text>
                    {size === 'large' && (
                        <div className="chart-filters">
                            <Checkbox checked={visibleLines.train_avg} onChange={() => toggleLine('train_avg')}>
                                <span style={{ color: '#3b82f6', fontSize: '16px', fontWeight: 'bold' }}>●</span> Avg Train Loss
                            </Checkbox>
                            <Checkbox checked={visibleLines.val_avg} onChange={() => toggleLine('val_avg')}>
                                <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>●</span> Avg Val Loss
                            </Checkbox>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart data={overfitData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" tick={{ fontSize }} label={{ value: 'Epochs', position: 'insideBottom', offset: 0 }} />
                            <YAxis tick={{ fontSize }} label={{ value: 'Average Loss', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            {visibleLines.train_avg && <Line type="monotone" dataKey="train_avg" stroke="#3b82f6" name="Avg Train Loss" strokeWidth={2} />}
                            {visibleLines.val_avg && <Line type="monotone" dataKey="val_avg" stroke="#ef4444" name="Avg Val Loss" strokeWidth={2} />}
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