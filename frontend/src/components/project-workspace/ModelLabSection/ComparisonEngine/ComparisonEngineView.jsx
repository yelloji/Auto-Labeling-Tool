import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Spin, Empty, Tag, Space, Row, Col, Divider, Tooltip, Switch } from 'antd';
import { SwapOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, PlusOutlined, MinusOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons';
import { trainingAPI, projectsAPI } from '../../../../services/api';
import DeltaGalleryModal from './DeltaGalleryModal';
import { mergeModelLabGuideState } from '../modellabGuideState';
import './ComparisonEngineView.css';

const { Title, Text } = Typography;
const { Option } = Select;

// ─── Reusable Model Selector Card ────────────────────────────────────────────
const ModelSelectorCard = ({ title, trainings, trainingId, experiments, experimentId, onTrainingChange, onExperimentChange }) => (
    <Card size="small" title={title} bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
            <div>
                <Text type="secondary">Training Session</Text>
                <Select
                    style={{ width: '100%' }}
                    value={trainingId}
                    placeholder="Select training"
                    onChange={v => onTrainingChange(v)}
                >
                    {trainings.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
                </Select>
            </div>
            <div>
                <Text type="secondary">Prediction Run</Text>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Select prediction run"
                    value={experimentId}
                    onChange={onExperimentChange}
                >
                    {experiments.map(e => <Option key={e.id} value={e.id}>{e.name}</Option>)}
                </Select>
            </div>
        </Space>
    </Card>
);

// ─── Delta Results Panel (reusable for both B and C) ─────────────────────────
const DeltaPanel = ({ data, label, onGallery, baselineId, challengerId, projectId, allBaselineId, allChallengerId }) => {
    if (!data) return null;
    const counts = data.counts || {};
    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
                Baseline <Text type="secondary">vs</Text> {label}
            </Title>
            <Row gutter={[12, 12]}>
                <Col span={8}>
                    <Card
                        className="delta-card success-card"
                        bordered={false}
                        onClick={() => onGallery('resolved_fps', data.deltas?.resolved_false_positives)}
                    >
                        <div className="delta-icon"><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                        <div className="delta-content">
                            <Text className="delta-value" style={{ color: '#52c41a' }}>{counts.resolved_fps ?? 0}</Text>
                            <Text className="delta-label">Resolved FPs</Text>
                            <Tooltip title="Baseline had FPs (hallucinations/glare). New model learned to ignore them.">
                                <InfoCircleOutlined style={{ color: '#bfbfbf', marginLeft: 8 }} />
                            </Tooltip>
                        </div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card
                        className="delta-card success-card"
                        bordered={false}
                        onClick={() => onGallery('resolved_fns', data.deltas?.resolved_misses)}
                    >
                        <div className="delta-icon"><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                        <div className="delta-content">
                            <Text className="delta-value" style={{ color: '#52c41a' }}>{counts.resolved_fns ?? 0}</Text>
                            <Text className="delta-label">Resolved Misses</Text>
                            <Tooltip title="Baseline missed objects. New model successfully detected them.">
                                <InfoCircleOutlined style={{ color: '#bfbfbf', marginLeft: 8 }} />
                            </Tooltip>
                        </div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card
                        className="delta-card danger-card"
                        bordered={false}
                        onClick={() => onGallery('regressions', data.deltas?.regressions)}
                    >
                        <div className="delta-icon"><CloseCircleOutlined style={{ color: '#f5222d' }} /></div>
                        <div className="delta-content">
                            <Text className="delta-value" style={{ color: '#f5222d' }}>{counts.regressions ?? 0}</Text>
                            <Text className="delta-label">New Regressions</Text>
                            <Tooltip title="Baseline detected these correctly, but the new model broke them.">
                                <InfoCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />
                            </Tooltip>
                        </div>
                    </Card>
                </Col>
            </Row>
            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                <Col span={12}>
                    <div
                        onClick={() => onGallery('persistent_fps', data.deltas?.persistent_false_positives)}
                        style={{ cursor: counts.persistent_fps > 0 ? 'pointer' : 'default' }}
                    >
                        <Card size="small" bordered={false} style={{ background: '#fffbe6' }} className="delta-card">
                            <Statistic title="Persistent FPs" value={counts.persistent_fps ?? 0} valueStyle={{ color: '#faad14' }} />
                        </Card>
                    </div>
                </Col>
                <Col span={12}>
                    <div
                        onClick={() => onGallery('persistent_fns', data.deltas?.persistent_misses)}
                        style={{ cursor: counts.persistent_fns > 0 ? 'pointer' : 'default' }}
                    >
                        <Card size="small" bordered={false} style={{ background: '#fffbe6' }} className="delta-card">
                            <Statistic title="Persistent Misses" value={counts.persistent_fns ?? 0} valueStyle={{ color: '#faad14' }} />
                        </Card>
                    </div>
                </Col>
            </Row>
        </div>
    );
};

// ─── Metric Row (used inside SplitOverviewPanel) ──────────────────────────────
const MetricRow = ({ label, valA, valB, valC, unit = '%', higherIsBetter = true }) => {
    const calcDelta = (a, b) => {
        if (a == null || b == null) return null;
        return parseFloat((b - a).toFixed(1));
    };
    const badge = (d) => {
        if (d === null) return null;
        const better = higherIsBetter === null ? false : higherIsBetter ? d > 0 : d < 0;
        const color = d === 0 ? '#8c8c8c' : (higherIsBetter === null ? '#8c8c8c' : better ? '#52c41a' : '#f5222d');
        return <span style={{ fontSize: 11, color, fontWeight: 600 }}>{d > 0 ? '+' : ''}{d}{unit}</span>;
    };
    return (
        <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
            <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>{label}</Text></Col>
            <Col span={valC !== undefined ? 5 : 7} style={{ textAlign: 'center' }}>
                <Text strong>{valA != null ? `${valA}${unit}` : '—'}</Text>
            </Col>
            <Col span={valC !== undefined ? 6 : 11} style={{ textAlign: 'center' }}>
                <Text strong>{valB != null ? `${valB}${unit}` : '—'}</Text>
                {' '}{badge(calcDelta(valA, valB))}
            </Col>
            {valC !== undefined && (
                <Col span={7} style={{ textAlign: 'center' }}>
                    <Text strong>{valC != null ? `${valC}${unit}` : '—'}</Text>
                    {' '}{badge(calcDelta(valA, valC))}
                </Col>
            )}
        </Row>
    );
};

// ─── Model Info Card (shown at top of results) ───────────────────────────────
const ModelInfoCard = ({ model, label, color }) => {
    if (!model) return null;
    const fmt = (v) => v != null ? v : '—';
    const dateStr = model.completed_at
        ? new Date(model.completed_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
    return (
        <div style={{
            flex: 1, padding: '12px 16px', borderRadius: 8,
            border: `1.5px solid ${color}22`, background: `${color}08`,
            borderTop: `3px solid ${color}`
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Tag color={color === '#1890ff' ? 'blue' : color === '#722ed1' ? 'purple' : 'default'} style={{ fontSize: 11 }}>{label}</Tag>
                <Text strong style={{ fontSize: 13 }}>{model.name}</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Training</Text><br /><Text style={{ fontSize: 12 }}>{fmt(model.training_name)}</Text></div>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Split</Text><br /><Text style={{ fontSize: 12, textTransform: 'uppercase' }}>{fmt(model.dataset_source)}</Text></div>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Confidence</Text><br /><Text style={{ fontSize: 12 }}>{model.confidence != null ? `${(model.confidence * 100).toFixed(0)}%` : '—'}</Text></div>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Images</Text><br /><Text style={{ fontSize: 12 }}>{fmt(model.image_count)}</Text></div>
                <div style={{ gridColumn: '1/-1' }}><Text type="secondary" style={{ fontSize: 11 }}>Completed</Text><br /><Text style={{ fontSize: 12 }}>{dateStr}</Text></div>
            </div>
        </div>
    );
};

// ─── Delta Gallery Card ───────────────────────────────────────────────────────
const DeltaCard = ({ imageCount, totalImages, detectionCount, title, description, detectionLabel, good, onClick }) => {
    const hasData = imageCount > 0;
    const pct = totalImages > 0 ? Math.round((imageCount / totalImages) * 100) : 0;
    const borderColor = good ? '#b7eb8f' : '#ffa39e';
    const badgeBg = good ? '#52c41a' : '#f5222d';
    const bg = good ? '#f6ffed' : '#fff1f0';
    return (
        <div
            onClick={hasData ? onClick : undefined}
            style={{
                flex: 1, borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${borderColor}`, background: '#fff',
                cursor: hasData ? 'pointer' : 'default',
                transition: 'transform 0.15s, box-shadow 0.15s',
                opacity: hasData ? 1 : 0.55,
            }}
            onMouseEnter={e => { if (hasData) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
        >
            {/* Header strip */}
            <div style={{ background: bg, borderBottom: `1px solid ${borderColor}`, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{good ? '✅' : '❌'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: good ? '#389e0d' : '#cf1322', textTransform: 'uppercase', letterSpacing: 0.3 }}>{title}</span>
            </div>

            <div style={{ padding: '12px 14px' }}>
                {/* Image count + percentage */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 30, fontWeight: 800, color: badgeBg, lineHeight: 1 }}>{imageCount}</span>
                        <span style={{ fontSize: 12, color: '#8c8c8c' }}>/ {totalImages ?? '?'} images</span>
                    </div>
                    {hasData && totalImages > 0 && (
                        <span style={{ fontSize: 15, fontWeight: 700, color: badgeBg }}>{pct}%</span>
                    )}
                </div>

                {/* Progress bar */}
                {totalImages > 0 && (
                    <div style={{ height: 4, borderRadius: 4, background: '#f0f0f0', marginBottom: 8 }}>
                        <div style={{ height: 4, borderRadius: 4, width: `${pct}%`, background: badgeBg, transition: 'width 0.4s ease' }} />
                    </div>
                )}

                {/* Detection count */}
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                    {hasData
                        ? <><span style={{ fontWeight: 700, color: badgeBg }}>{good ? '−' : '+'}{detectionCount}</span>{' '}<span style={{ color: '#8c8c8c' }}>{detectionLabel}</span></>
                        : <span style={{ color: '#bfbfbf' }}>No images affected</span>
                    }
                </div>

                {/* Description */}
                <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.45, borderTop: `1px dashed ${borderColor}`, paddingTop: 8 }}>
                    {description}
                </div>

                {hasData && (
                    <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 8, textAlign: 'right' }}>View affected images →</div>
                )}
            </div>
        </div>
    );
};

// ─── Metric Verdict Row (quick win/loss summary) ──────────────────────────────
const VerdictRow = ({ a, b, labelA = 'Baseline', labelB = 'Model B', colorB = '#0958d9', shadowB = '#69b1ff' }) => {
    const metrics = [
        { key: 'Precision', vA: a.precision, vB: b.precision, higherBetter: true },
        { key: 'Recall', vA: a.recall, vB: b.recall, higherBetter: true },
        { key: 'F1 Score', vA: a.f1, vB: b.f1, higherBetter: true },
        { key: 'Avg IoU', vA: a.avg_iou, vB: b.avg_iou, higherBetter: true },
        { key: 'Less FP', vA: a.false_positives, vB: b.false_positives, higherBetter: false },
        { key: 'Less FN', vA: a.false_negatives, vB: b.false_negatives, higherBetter: false },
    ];
    const bWins = metrics.filter(({ vA, vB, higherBetter }) => vA != null && vB != null && (higherBetter ? vB > vA : vB < vA)).length;
    const aWins = metrics.filter(({ vA, vB, higherBetter }) => vA != null && vB != null && (higherBetter ? vA > vB : vA < vB)).length;
    const bLeads = bWins > aWins;
    const tied = bWins === aWins;
    const totalMetrics = metrics.filter(m => m.vA != null && m.vB != null).length;
    return (
        <div style={{ marginBottom: 16 }}>
            {/* Score banner */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                padding: '10px 16px', borderRadius: 8,
                background: bLeads ? '#e6f7ff' : !tied ? '#f9f0ff' : '#fafafa',
                border: `1.5px solid ${bLeads ? '#91caff' : !tied ? '#d3adf7' : '#e8e8e8'}`,
            }}>
                <span style={{
                    fontSize: !tied && !bLeads ? 16 : 12, fontWeight: 800,
                    color: '#fff', background: '#531dab',
                    padding: !tied && !bLeads ? '5px 18px' : '3px 12px',
                    borderRadius: 20,
                    boxShadow: !tied && !bLeads ? '0 0 0 3px #b37feb, 0 2px 8px rgba(83,29,171,0.4)' : 'none',
                    transition: 'all 0.2s',
                }}>{labelA} &nbsp;{aWins}/{totalMetrics}</span>
                <span style={{ fontSize: 12, color: '#bfbfbf', fontWeight: 600 }}>vs</span>
                <span style={{
                    fontSize: !tied && bLeads ? 16 : 12, fontWeight: 800,
                    color: '#fff', background: colorB,
                    padding: !tied && bLeads ? '5px 18px' : '3px 12px',
                    borderRadius: 20,
                    boxShadow: !tied && bLeads ? `0 0 0 3px ${shadowB}, 0 2px 8px rgba(9,88,217,0.4)` : 'none',
                    transition: 'all 0.2s',
                }}>{labelB} &nbsp;{bWins}/{totalMetrics}</span>
                <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 6, color: bLeads ? '#389e0d' : !tied ? '#722ed1' : '#8c8c8c' }}>
                    {bLeads ? `🏆 ${labelB} wins` : !tied ? `🏆 ${labelA} wins` : '🤝 Tied'}
                </span>
            </div>
            {/* Per-metric chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {metrics.map(({ key, vA, vB, higherBetter }) => {
                    if (vA == null || vB == null) return null;
                    const bBetter = higherBetter ? vB > vA : vB < vA;
                    const aBetter = higherBetter ? vA > vB : vA < vB;
                    const winner = bBetter ? 'B' : aBetter ? 'A' : 'TIE';
                    const diff = Math.abs(vB - vA).toFixed(1);
                    return (
                        <div key={key} style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d9d9d9', fontSize: 12 }}>
                            <span style={{ padding: '4px 9px', background: '#fafafa', color: '#595959', fontWeight: 500, borderRight: '1px solid #d9d9d9' }}>{key}</span>
                            <span style={{
                                padding: '4px 10px', fontWeight: 700,
                                background: winner === 'B' ? colorB : winner === 'A' ? '#531dab' : '#8c8c8c',
                                color: '#fff',
                            }}>
                                {winner === 'TIE' ? 'Tie' : `${winner === 'B' ? labelB : labelA} +${diff}`}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Split Mode Overview Panel ────────────────────────────────────────────────
const SplitOverviewPanel = ({ data, is3Way, onDelta, onDeltaC, isUpload }) => {
    const a = data.baseline;
    const b = data.challenger_b;
    const c = data.challenger_c;
    const delta = data.delta_b;
    const deltaC = data.delta_c;
    const hasGT = a?.has_ground_truth && b?.has_ground_truth;

    return (
        <div className="delta-dashboard">
            <Title level={4} style={{ marginBottom: 4 }}>
                {isUpload ? 'Upload Mode — Quality Comparison' : 'Split Mode — Quality Comparison'}
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {isUpload
                    ? 'Ground truth from human verifications. Users can review and override.'
                    : 'Real ground truth from dataset labels. No manual verification needed.'}
            </Text>

            {/* ── Model Info Header ── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <ModelInfoCard model={a} label="Baseline" color="#595959" />
                <ModelInfoCard model={b} label="Model B" color="#1890ff" />
                {is3Way && c && <ModelInfoCard model={c} label="Model C" color="#722ed1" />}
            </div>

            {!hasGT ? (
                <div style={{ padding: '16px 0' }}>
                    <Text type="warning" strong style={{ display: 'block', marginBottom: 12 }}>
                        ⚠️ Ground truth not available for one or both experiments
                    </Text>
                    {[['Baseline', a], ['Model B', b]].map(([label, m]) => m && (
                        <div key={label} style={{ marginBottom: 8, padding: '8px 12px', background: m.has_ground_truth ? '#f6ffed' : '#fff7e6', borderRadius: 6, border: `1px solid ${m.has_ground_truth ? '#b7eb8f' : '#ffd591'}` }}>
                            <Text strong>{label} — {m.name}</Text><br />
                            <Text type="secondary" style={{ fontSize: 12 }}>dataset_source: <code>{m.dataset_source || 'unknown'}</code></Text><br />
                            <Text type="secondary" style={{ fontSize: 12 }}>dataset_path: <code>{m.dataset_path || 'not set'}</code></Text><br />
                            {!m.has_ground_truth && <Text type="danger" style={{ fontSize: 12 }}>❌ {m.gt_error}</Text>}
                            {m.has_ground_truth && <Text type="success" style={{ fontSize: 12 }}>✅ GT available</Text>}
                        </div>
                    ))}
                </div>

            ) : (
                <>
                    {/* ── Column Header ── */}
                    <Row gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={6} />
                        <Col span={is3Way ? 5 : 7} style={{ textAlign: 'center' }}>
                            <Tag color="default" style={{ fontSize: 11 }}>Baseline — {a.name}</Tag>
                        </Col>
                        <Col span={is3Way ? 6 : 11} style={{ textAlign: 'center' }}>
                            <Tag color="blue" style={{ fontSize: 11 }}>Model B — {b.name}</Tag>
                        </Col>
                        {is3Way && c && (
                            <Col span={7} style={{ textAlign: 'center' }}>
                                <Tag color="purple" style={{ fontSize: 11 }}>Model C — {c.name}</Tag>
                            </Col>
                        )}
                    </Row>

                    <Divider style={{ margin: '8px 0' }} />

                    {/* ── Metric Rows ── */}
                    <MetricRow label="Precision" valA={a.precision} valB={b.precision} valC={is3Way && c ? c.precision : undefined} />
                    <MetricRow label="Recall" valA={a.recall} valB={b.recall} valC={is3Way && c ? c.recall : undefined} />
                    <MetricRow label="F1 Score" valA={a.f1} valB={b.f1} valC={is3Way && c ? c.f1 : undefined} />
                    <MetricRow label="Avg IoU" valA={a.avg_iou} valB={b.avg_iou} valC={is3Way && c ? c.avg_iou : undefined} />

                    <Divider style={{ margin: '8px 0 16px' }} />

                    {/* ── TP / FP / FN ── */}
                    <MetricRow label="True Positives ✓" valA={a.true_positives} valB={b.true_positives} valC={is3Way && c ? c.true_positives : undefined} unit="" />
                    <MetricRow label="False Positives ✗" valA={a.false_positives} valB={b.false_positives} valC={is3Way && c ? c.false_positives : undefined} unit="" higherIsBetter={false} />
                    <MetricRow label="False Negatives △" valA={a.false_negatives} valB={b.false_negatives} valC={is3Way && c ? c.false_negatives : undefined} unit="" higherIsBetter={false} />
                    <MetricRow label="Total GT objects" valA={a.total_gt} valB={b.total_gt} valC={is3Way && c ? c.total_gt : undefined} unit="" higherIsBetter={null} />

                    {/* ── Delta Gallery Cards — Model B ── */}
                    {delta && (
                        <>
                            <VerdictRow a={a} b={b} labelA="Baseline" labelB="Model B" colorB="#0958d9" shadowB="#69b1ff" />

                            <Divider style={{ margin: '12px 0 12px' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Individual Image Delta — Model B vs Baseline</Text>
                            </Divider>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <DeltaCard
                                    good
                                    imageCount={delta.counts?.fixed_fp ?? 0}
                                    totalImages={a.image_count ?? b.image_count}
                                    detectionCount={delta.detections?.fp_saved ?? 0}
                                    detectionLabel="false alarms removed"
                                    title="False Positives Fixed"
                                    description={`Model B reduced wrong detections on ${delta.counts?.fixed_fp ?? 0} images — ${delta.detections?.fp_saved ?? 0} fewer false alarms in total.`}
                                    onClick={() => onDelta('fixed_fp', delta.fixed_fp || [], b.name)}
                                />
                                <DeltaCard
                                    good
                                    imageCount={delta.counts?.fixed_fn ?? 0}
                                    totalImages={a.image_count ?? b.image_count}
                                    detectionCount={delta.detections?.fn_saved ?? 0}
                                    detectionLabel="missed objects now found"
                                    title="Missed Objects Fixed"
                                    description={`Model B found more real objects on ${delta.counts?.fixed_fn ?? 0} images — ${delta.detections?.fn_saved ?? 0} objects that were previously missed.`}
                                    onClick={() => onDelta('fixed_fn', delta.fixed_fn || [], b.name)}
                                />
                                <DeltaCard
                                    good={false}
                                    imageCount={delta.counts?.new_fp ?? 0}
                                    totalImages={a.image_count ?? b.image_count}
                                    detectionCount={delta.detections?.fp_added ?? 0}
                                    detectionLabel="new false alarms introduced"
                                    title="New False Positives"
                                    description={`Model B created extra wrong detections on ${delta.counts?.new_fp ?? 0} images — ${delta.detections?.fp_added ?? 0} false alarms added.`}
                                    onClick={() => onDelta('new_fp', delta.new_fp || [], b.name)}
                                />
                                <DeltaCard
                                    good={false}
                                    imageCount={delta.counts?.new_fn ?? 0}
                                    totalImages={a.image_count ?? b.image_count}
                                    detectionCount={delta.detections?.fn_added ?? 0}
                                    detectionLabel="objects now being missed"
                                    title="New Missed Objects"
                                    description={`Model B missed real objects on ${delta.counts?.new_fn ?? 0} images — ${delta.detections?.fn_added ?? 0} detections lost.`}
                                    onClick={() => onDelta('new_fn', delta.new_fn || [], b.name)}
                                />
                            </div>

                            <Divider style={{ margin: '12px 0 12px' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Confidence Analysis — Unchanged Bounding Box Counts</Text>
                            </Divider>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <DeltaCard
                                    good
                                    imageCount={delta.counts?.improved_conf ?? 0}
                                    totalImages={a.image_count ?? b.image_count}
                                    detectionCount={delta.detections?.improved_conf ?? 0}
                                    detectionLabel="boxes with >5% higher confidence"
                                    title="Confidence Improved"
                                    description={`${b.name} showed significantly higher confidence on True Positives for ${delta.counts?.improved_conf ?? 0} images.`}
                                    onClick={() => onDelta('improved_conf', delta.improved_conf || [], b.name)}
                                />
                                <DeltaCard
                                    good={false}
                                    imageCount={delta.counts?.degraded_conf ?? 0}
                                    totalImages={a.image_count ?? b.image_count}
                                    detectionCount={delta.detections?.degraded_conf ?? 0}
                                    detectionLabel="boxes with >5% lower confidence"
                                    title="Confidence Degraded"
                                    description={`${b.name} showed significantly lower confidence on True Positives for ${delta.counts?.degraded_conf ?? 0} images.`}
                                    onClick={() => onDelta('degraded_conf', delta.degraded_conf || [], b.name)}
                                />
                            </div>
                        </>
                    )}

                    {/* ── Delta Gallery Cards — Model C (3-way only) ── */}
                    {is3Way && c && deltaC && (
                        <>
                            <VerdictRow a={a} b={c} labelA="Baseline" labelB="Model C" colorB="#722ed1" shadowB="#b37feb" />
                            <Divider style={{ margin: '20px 0 12px' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Individual Image Delta — Model C vs Baseline</Text>
                            </Divider>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <DeltaCard
                                    good
                                    imageCount={deltaC.counts?.fixed_fp ?? 0}
                                    totalImages={a.image_count ?? c.image_count}
                                    detectionCount={deltaC.detections?.fp_saved ?? 0}
                                    detectionLabel="false alarms removed"
                                    title="False Positives Fixed"
                                    description={`Model C reduced wrong detections on ${deltaC.counts?.fixed_fp ?? 0} images — ${deltaC.detections?.fp_saved ?? 0} fewer false alarms in total.`}
                                    onClick={() => onDeltaC('fixed_fp', deltaC.fixed_fp || [], c.name)}
                                />
                                <DeltaCard
                                    good
                                    imageCount={deltaC.counts?.fixed_fn ?? 0}
                                    totalImages={a.image_count ?? c.image_count}
                                    detectionCount={deltaC.detections?.fn_saved ?? 0}
                                    detectionLabel="missed objects now found"
                                    title="Missed Objects Fixed"
                                    description={`Model C found more real objects on ${deltaC.counts?.fixed_fn ?? 0} images — ${deltaC.detections?.fn_saved ?? 0} objects that were previously missed.`}
                                    onClick={() => onDeltaC('fixed_fn', deltaC.fixed_fn || [], c.name)}
                                />
                                <DeltaCard
                                    good={false}
                                    imageCount={deltaC.counts?.new_fp ?? 0}
                                    totalImages={a.image_count ?? c.image_count}
                                    detectionCount={deltaC.detections?.fp_added ?? 0}
                                    detectionLabel="new false alarms introduced"
                                    title="New False Positives"
                                    description={`Model C created extra wrong detections on ${deltaC.counts?.new_fp ?? 0} images — ${deltaC.detections?.fp_added ?? 0} false alarms added.`}
                                    onClick={() => onDeltaC('new_fp', deltaC.new_fp || [], c.name)}
                                />
                                <DeltaCard
                                    good={false}
                                    imageCount={deltaC.counts?.new_fn ?? 0}
                                    totalImages={a.image_count ?? c.image_count}
                                    detectionCount={deltaC.detections?.fn_added ?? 0}
                                    detectionLabel="objects now being missed"
                                    title="New Missed Objects"
                                    description={`Model C missed real objects on ${deltaC.counts?.new_fn ?? 0} images — ${deltaC.detections?.fn_added ?? 0} detections lost.`}
                                    onClick={() => onDeltaC('new_fn', deltaC.new_fn || [], c.name)}
                                />
                            </div>

                            <Divider style={{ margin: '12px 0 12px' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Confidence Analysis — Model C vs Baseline</Text>
                            </Divider>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <DeltaCard
                                    good
                                    imageCount={deltaC.counts?.improved_conf ?? 0}
                                    totalImages={a.image_count ?? c.image_count}
                                    detectionCount={deltaC.detections?.improved_conf ?? 0}
                                    detectionLabel="boxes with >5% higher confidence"
                                    title="Confidence Improved"
                                    description={`${c.name} showed significantly higher confidence on True Positives for ${deltaC.counts?.improved_conf ?? 0} images.`}
                                    onClick={() => onDeltaC('improved_conf', deltaC.improved_conf || [], c.name)}
                                />
                                <DeltaCard
                                    good={false}
                                    imageCount={deltaC.counts?.degraded_conf ?? 0}
                                    totalImages={a.image_count ?? c.image_count}
                                    detectionCount={deltaC.detections?.degraded_conf ?? 0}
                                    detectionLabel="boxes with >5% lower confidence"
                                    title="Confidence Degraded"
                                    description={`${c.name} showed significantly lower confidence on True Positives for ${deltaC.counts?.degraded_conf ?? 0} images.`}
                                    onClick={() => onDeltaC('degraded_conf', deltaC.degraded_conf || [], c.name)}
                                />
                            </div>
                        </>
                    )}

                </>
            )}
        </div>
    );
};

// ─── Upload Mode: Compute per-experiment metrics from human verifications ─────
const _getFileName = (path) => (path ? path.split('/').pop().split('\\').pop() : '');

const computeUploadMetrics = (expObj, allVerifications) => {
    if (!expObj?.predictions) return null;

    const vMap = {};
    const humanMissing = [];

    allVerifications
        .filter(v => String(v.experiment_id) === String(expObj.id))
        .forEach(v => {
            const vFile = _getFileName(v.image_name);
            const predKey = Object.keys(expObj.predictions).find(k => _getFileName(k) === vFile);
            const imgDets = expObj.predictions[predKey] || [];

            const matchedAI = imgDets.find(d =>
                d.bbox && v.bbox &&
                Math.abs(d.bbox[0] - v.bbox[0]) < 0.1 &&
                Math.abs(d.bbox[1] - v.bbox[1]) < 0.1 &&
                Math.abs(d.bbox[2] - v.bbox[2]) < 0.1 &&
                Math.abs(d.bbox[3] - v.bbox[3]) < 0.1
            );

            if (matchedAI) {
                if (v.status === 'pass' || v.status === 'fail') {
                    vMap[`${vFile}|${matchedAI.bbox.join(',')}`] = v.status;
                }
            } else if (v.status !== 'fail') {
                humanMissing.push(v);
            }
        });

    let tp = 0, fp = 0;
    Object.entries(expObj.predictions).forEach(([imgName, dets]) => {
        if (!Array.isArray(dets)) return;
        const fileName = _getFileName(imgName);
        dets.forEach(d => {
            const key = `${fileName}|${d.bbox?.join(',') || ''}`;
            if (vMap[key] === 'fail') fp++;
            else tp++;
        });
    });

    const fn = humanMissing.length;
    const precision = (tp + fp) > 0 ? parseFloat(((tp / (tp + fp)) * 100).toFixed(1)) : null;
    const recall    = (tp + fn) > 0 ? parseFloat(((tp / (tp + fn)) * 100).toFixed(1)) : null;
    const f1        = (precision != null && recall != null && (precision + recall) > 0)
        ? parseFloat(((2 * precision * recall) / (precision + recall)).toFixed(1))
        : null;

    return {
        name:           expObj.name,
        training_name:  expObj.training_name  || null,
        confidence:     expObj.confidence     || null,
        completed_at:   expObj.completed_at   || null,
        dataset_source: 'upload',
        precision,
        recall,
        f1,
        avg_iou:        null,
        true_positives:  tp,
        false_positives: fp,
        false_negatives: fn,
        total_gt:        tp + fn,
        image_count:     Object.keys(expObj.predictions).length,
        has_ground_truth: true,
    };
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ComparisonEngineView = ({ currentTraining }) => {
    const [trainings, setTrainings] = useState([]);

    // Model A (Baseline)
    const [baselineTrainingId, setBaselineTrainingId] = useState(currentTraining?.id);
    const [baselineExperiments, setBaselineExperiments] = useState([]);
    const [baselineId, setBaselineId] = useState(null);

    // Model B (Challenger)
    const [challengerTrainingId, setChallengerTrainingId] = useState(null);
    const [challengerExperiments, setChallengerExperiments] = useState([]);
    const [challengerId, setChallengerId] = useState(null);

    // Model C (Optional Challenger)
    const [modelCEnabled, setModelCEnabled] = useState(false);
    const [challengerCTrainingId, setChallengerCTrainingId] = useState(null);
    const [challengerCExperiments, setChallengerCExperiments] = useState([]);
    const [challengerCId, setChallengerCId] = useState(null);

    // Results
    const [loading, setLoading] = useState(false);
    const [comparisonData, setComparisonData] = useState(null);

    // Dataset Overlap
    const [overlapInfo, setOverlapInfo] = useState(null); // { common, totalA, totalB, totalC }
    const [overlapLoading, setOverlapLoading] = useState(false);

    // Gallery Modal
    const [galleryVisible, setGalleryVisible] = useState(false);
    const [galleryConfig, setGalleryConfig] = useState({ type: '', items: [], challengerName: '', challengerId: null });

    const openGallery = (type, items, challengerName, galleryChallengerId) => {
        if (!items || items.length === 0) return;
        setGalleryConfig({ type, items, challengerName, challengerId: galleryChallengerId });
        setGalleryVisible(true);
    };

    // Fetch all trainings
    useEffect(() => {
        const fetch = async () => {
            if (!currentTraining?.projectId) return;
            try {
                const data = await projectsAPI.getTrainingSessions(currentTraining.projectId);
                setTrainings(data || []);
            } catch (err) { console.error('Failed to fetch trainings', err); }
        };
        fetch();
    }, [currentTraining]);

    // Generic experiment fetcher
    const fetchExps = async (tId, setExps) => {
        if (!tId) { setExps([]); return; }
        try {
            const exps = await projectsAPI.getTrainingExperiments(tId);
            setExps(exps.filter(e => e.experiment_type === 'prediction' && e.status === 'completed'));
        } catch (e) { setExps([]); }
    };

    useEffect(() => { fetchExps(baselineTrainingId, setBaselineExperiments); }, [baselineTrainingId]);
    useEffect(() => { fetchExps(challengerTrainingId, setChallengerExperiments); }, [challengerTrainingId]);
    useEffect(() => { fetchExps(challengerCTrainingId, setChallengerCExperiments); }, [challengerCTrainingId]);

    // Calculate dataset overlap whenever selection changes
    useEffect(() => {
        const computeOverlap = async () => {
            if (!baselineId || !challengerId) { setOverlapInfo(null); return; }
            setOverlapLoading(true);
            try {
                const [imgsA, imgsB] = await Promise.all([
                    projectsAPI.getExperimentImages(baselineId),
                    projectsAPI.getExperimentImages(challengerId),
                ]);
                const setA = new Set(imgsA.map(f => f.split('/').pop()));
                const setB = new Set(imgsB.map(f => f.split('/').pop()));
                const common = [...setA].filter(f => setB.has(f)).length;

                let commonC = null, totalC = null;
                if (modelCEnabled && challengerCId) {
                    const imgsC = await projectsAPI.getExperimentImages(challengerCId);
                    const setC = new Set(imgsC.map(f => f.split('/').pop()));
                    commonC = [...setA].filter(f => setC.has(f)).length;
                    totalC = imgsC.length;
                }

                setOverlapInfo({ common, totalA: imgsA.length, totalB: imgsB.length, commonC, totalC });
            } catch (e) {
                console.error('Failed to compute overlap', e);
                setOverlapInfo(null);
            } finally {
                setOverlapLoading(false);
            }
        };
        computeOverlap();
    }, [baselineId, challengerId, challengerCId, modelCEnabled]);

    // Disable Model C → clear its state
    const handleToggleModelC = (enabled) => {
        setModelCEnabled(enabled);
        if (!enabled) {
            setChallengerCTrainingId(null);
            setChallengerCExperiments([]);
            setChallengerCId(null);
            setComparisonData(null); // reset results when toggling
        }
    };

    const isCompareReady = baselineId && challengerId && (!modelCEnabled || challengerCId);

    useEffect(() => {
        mergeModelLabGuideState({
            comparisonViewerOpen: galleryVisible,
            comparisonHasBaseline: !!baselineId,
            comparisonHasChallenger: !!challengerId,
            comparisonHasThirdModel: !!challengerCId,
            comparisonReady: !!isCompareReady,
            comparisonMode: modelCEnabled ? 'three-way' : 'two-way',
            comparisonResultLoaded: !!comparisonData,
            comparisonBaselineExperimentId: baselineId || null,
            comparisonChallengerExperimentId: challengerId || null,
            comparisonViewerType: galleryVisible ? galleryConfig.type || null : null,
            stateKey: galleryVisible ? 'modellab-comparison-viewer' : 'modellab-comparison-engine',
        }, galleryVisible ? { forceRefresh: true } : {});
    }, [galleryVisible, galleryConfig.type, baselineId, challengerId, challengerCId, isCompareReady, modelCEnabled, comparisonData]);

    const handleCompare = async () => {
        if (!isCompareReady) return;
        setLoading(true);
        setComparisonData(null);
        try {
            const data = await projectsAPI.compareExperiments(
                currentTraining.projectId,
                baselineId,
                challengerId,
                modelCEnabled ? challengerCId : null
            );
            console.log('Compare Data:', data);

            // Upload mode (2-way only): compute per-experiment metrics from human verifications.
            // Guards: backend mode must NOT be split/three_way, Model C must be off,
            // AND both experiments must be genuine upload experiments (dataset_source === 'upload').
            // Never apply upload math to split experiments — they have real GT already.
            const baselineExp   = baselineExperiments.find(e => String(e.id) === String(baselineId));
            const challengerExp = challengerExperiments.find(e => String(e.id) === String(challengerId));
            const bothAreUpload = baselineExp?.dataset_source === 'upload' && challengerExp?.dataset_source === 'upload';

            if (!['split', 'three_way'].includes(data.mode) && !modelCEnabled && bothAreUpload) {
                try {
                    const verifications   = await projectsAPI.getProjectVerifications(currentTraining.projectId);
                    const baselineMetrics   = computeUploadMetrics(baselineExp, verifications);
                    const challengerMetrics = computeUploadMetrics(challengerExp, verifications);

                    if (baselineMetrics && challengerMetrics) {
                        data.mode      = 'split';
                        data._isUpload = true;
                        data.baseline     = baselineMetrics;
                        data.challenger_b = challengerMetrics;
                        data.delta_b = {
                            counts: {
                                fixed_fp:      data.counts?.resolved_fps  ?? 0,
                                fixed_fn:      data.counts?.resolved_fns  ?? 0,
                                new_fp:        0,
                                new_fn:        data.counts?.regressions   ?? 0,
                                improved_conf: 0,
                                degraded_conf: 0,
                            },
                            detections: {
                                fp_saved: data.counts?.resolved_fps  ?? 0,
                                fn_saved: data.counts?.resolved_fns  ?? 0,
                                fp_added: 0,
                                fn_added: data.counts?.regressions   ?? 0,
                            },
                            fixed_fp:      data.deltas?.resolved_false_positives || [],
                            fixed_fn:      data.deltas?.resolved_misses          || [],
                            new_fp:        [],
                            new_fn:        data.deltas?.regressions              || [],
                            improved_conf: [],
                            degraded_conf: [],
                        };
                    }
                } catch (uploadErr) {
                    console.warn('Upload metrics computation failed, falling back to basic view:', uploadErr);
                    // setComparisonData(data) still runs below with original untransformed data
                }
            }

            setComparisonData(data);
        } catch (err) {
            console.error(err);
            setComparisonData({ error: err.message || 'Failed to compare' });
        } finally {
            setLoading(false);
        }
    };

    // Column layout: 2-way = 10/4/10, 3-way = 7/3/7/3/7 (A | VS | B | VS | C)
    const is3Way = modelCEnabled;

    return (
        <div className="comparison-engine-container" style={{ padding: '0 16px 16px' }}>

            {/* ── Selector Row ── */}
            <div style={{ marginBottom: 24, padding: '16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
                <Row gutter={16} align="middle" wrap={false}>
                    {/* Model A */}
                    <Col flex={is3Way ? '0 0 30%' : '0 0 42%'}>
                        <ModelSelectorCard
                            title="Model A (Baseline)"
                            trainings={trainings}
                            trainingId={baselineTrainingId}
                            experiments={baselineExperiments}
                            experimentId={baselineId}
                            onTrainingChange={v => { setBaselineTrainingId(v); setBaselineId(null); }}
                            onExperimentChange={setBaselineId}
                        />
                    </Col>

                    {/* VS + Run Button */}
                    <Col flex="0 0 auto" style={{ textAlign: 'center', minWidth: 80 }}>
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<SwapOutlined />}
                            size="large"
                            onClick={handleCompare}
                            loading={loading}
                            disabled={!isCompareReady}
                            style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', border: 'none' }}
                        />
                        <div style={{ marginTop: 6 }}><Text strong type="secondary">VS</Text></div>
                    </Col>

                    {/* Model B */}
                    <Col flex={is3Way ? '0 0 30%' : '0 0 42%'}>
                        <ModelSelectorCard
                            title="Model B (Challenger)"
                            trainings={trainings}
                            trainingId={challengerTrainingId}
                            experiments={challengerExperiments}
                            experimentId={challengerId}
                            onTrainingChange={v => { setChallengerTrainingId(v); setChallengerId(null); }}
                            onExperimentChange={setChallengerId}
                        />
                    </Col>

                    {/* Model C section (VS + Card) — only when enabled */}
                    {is3Way && (
                        <>
                            <Col flex="0 0 auto" style={{ textAlign: 'center', minWidth: 80 }}>
                                <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text strong type="secondary" style={{ fontSize: 18 }}>VS</Text>
                                </div>
                            </Col>
                            <Col flex="0 0 30%">
                                <ModelSelectorCard
                                    title="Model C (Challenger)"
                                    trainings={trainings}
                                    trainingId={challengerCTrainingId}
                                    experiments={challengerCExperiments}
                                    experimentId={challengerCId}
                                    onTrainingChange={v => { setChallengerCTrainingId(v); setChallengerCId(null); }}
                                    onExperimentChange={setChallengerCId}
                                />
                            </Col>
                        </>
                    )}
                </Row>

                {/* Dataset Overlap Strip */}
                {(baselineId && challengerId) && (
                    <div style={{ marginTop: 16 }}>
                        {overlapLoading ? (
                            <Text type="secondary" style={{ fontSize: 12 }}>Checking image overlap...</Text>
                        ) : overlapInfo !== null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                                {/* A vs B overlap */}
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                                    background: overlapInfo.common === 0 ? '#fff1f0' : '#f6ffed',
                                    border: `1px solid ${overlapInfo.common === 0 ? '#ffa39e' : '#b7eb8f'}`,
                                    color: overlapInfo.common === 0 ? '#cf1322' : '#389e0d',
                                }}>
                                    {overlapInfo.common === 0
                                        ? <><WarningOutlined /> A vs B: 0 common images — comparison will be empty!</>
                                        : <><LinkOutlined /> A vs B: <strong>{overlapInfo.common}</strong> common images ({overlapInfo.totalA} / {overlapInfo.totalB})</>}
                                </span>
                                {/* A vs C overlap (when enabled) */}
                                {modelCEnabled && challengerCId && overlapInfo.commonC !== null && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                                        background: overlapInfo.commonC === 0 ? '#fff1f0' : '#f6ffed',
                                        border: `1px solid ${overlapInfo.commonC === 0 ? '#ffa39e' : '#b7eb8f'}`,
                                        color: overlapInfo.commonC === 0 ? '#cf1322' : '#389e0d',
                                    }}>
                                        {overlapInfo.commonC === 0
                                            ? <><WarningOutlined /> A vs C: 0 common images — comparison will be empty!</>
                                            : <><LinkOutlined /> A vs C: <strong>{overlapInfo.commonC}</strong> common images ({overlapInfo.totalA} / {overlapInfo.totalC})</>}
                                    </span>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Toggle Model C */}
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Switch
                        checked={modelCEnabled}
                        onChange={handleToggleModelC}
                        checkedChildren={<MinusOutlined />}
                        unCheckedChildren={<PlusOutlined />}
                        size="small"
                    />
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        {modelCEnabled ? 'Remove Model C' : 'Add a third model to compare (Model C)'}
                    </Text>
                </div>
            </div>

            <Divider />

            {/* ── Results Area ── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '64px' }}>
                    <Spin size="large" />
                    <Title level={4} style={{ marginTop: 16 }}>Running Detailed Delta Analysis...</Title>
                    <Text type="secondary">Matching bounding boxes across isolated model outputs.</Text>
                </div>
            ) : comparisonData ? (
                comparisonData.error ? (
                    <Empty description={`Error: ${comparisonData.error}`} />
                ) : comparisonData.message ? (
                    <Empty description={comparisonData.message} />
                ) : comparisonData.mode === 'split' ? (
                    // ── Split Mode Overview Panel ──
                    <div className="delta-dashboard">
                        <SplitOverviewPanel
                            data={comparisonData}
                            is3Way={!!comparisonData.challenger_c}
                            isUpload={!!comparisonData._isUpload}
                            onDelta={(type, items, challengerName) =>
                                openGallery(type, items, challengerName, challengerId)
                            }
                            onDeltaC={(type, items, challengerName) =>
                                openGallery(type, items, challengerName, challengerCId)
                            }
                        />
                        <DeltaGalleryModal
                            visible={galleryVisible}
                            onCancel={() => setGalleryVisible(false)}
                            items={galleryConfig.items}
                            type={galleryConfig.type}
                            baselineName={comparisonData.baseline_name}
                            challengerName={galleryConfig.challengerName}
                            baselineId={baselineId}
                            challengerId={galleryConfig.challengerId}
                            projectId={currentTraining.projectId}
                        />
                    </div>
                ) : comparisonData.mode === 'three_way' ? (
                    // ── 3-Way Results ──
                    <div className="delta-dashboard">
                        <Title level={4}>Delta Analysis Results — 3-Way Comparison</Title>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                            Baseline: <strong>{comparisonData.baseline_name}</strong> — compared independently against B and C.
                        </Text>
                        <div style={{ display: 'flex', gap: 24 }}>
                            <DeltaPanel
                                data={comparisonData.challenger_b}
                                label={<><Tag color="blue">B</Tag>{comparisonData.challenger_b?.name}</>}
                                onGallery={(type, items) =>
                                    openGallery(type, items, comparisonData.challenger_b?.name, challengerId)
                                }
                            />
                            <Divider type="vertical" style={{ height: 'auto', alignSelf: 'stretch' }} />
                            <DeltaPanel
                                data={comparisonData.challenger_c}
                                label={<><Tag color="purple">C</Tag>{comparisonData.challenger_c?.name}</>}
                                onGallery={(type, items) =>
                                    openGallery(type, items, comparisonData.challenger_c?.name, challengerCId)
                                }
                            />
                        </div>
                        <DeltaGalleryModal
                            visible={galleryVisible}
                            onCancel={() => setGalleryVisible(false)}
                            items={galleryConfig.items}
                            type={galleryConfig.type}
                            baselineName={comparisonData.baseline_name}
                            challengerName={galleryConfig.challengerName}
                            baselineId={baselineId}
                            challengerId={galleryConfig.challengerId}
                            projectId={currentTraining.projectId}
                        />
                    </div>
                ) : (
                    // ── 2-Way Results (existing behavior, unchanged) ──
                    <div className="delta-dashboard">
                        <Title level={4}>Delta Analysis Results</Title>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                            Comparing human verifications from {comparisonData.baseline_name} against the raw outputs of {comparisonData.challenger_name}.
                        </Text>

                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Card className="delta-card success-card" bordered={false} onClick={() => openGallery('resolved_fps', comparisonData.deltas.resolved_false_positives, comparisonData.challenger_name, challengerId)}>
                                    <div className="delta-icon"><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                                    <div className="delta-content">
                                        <Text className="delta-value" style={{ color: '#52c41a' }}>{comparisonData.counts.resolved_fps}</Text>
                                        <Text className="delta-label">Resolved False Positives</Text>
                                        <Tooltip title="Baseline had FPs (hallucinations/glare). New model learned to ignore them.">
                                            <InfoCircleOutlined style={{ color: '#bfbfbf', marginLeft: 8 }} />
                                        </Tooltip>
                                    </div>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="delta-card success-card" bordered={false} onClick={() => openGallery('resolved_fns', comparisonData.deltas.resolved_misses, comparisonData.challenger_name, challengerId)}>
                                    <div className="delta-icon"><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                                    <div className="delta-content">
                                        <Text className="delta-value" style={{ color: '#52c41a' }}>{comparisonData.counts.resolved_fns}</Text>
                                        <Text className="delta-label">Resolved Misses (FN)</Text>
                                        <Tooltip title="Baseline missed objects. New model successfully detected them.">
                                            <InfoCircleOutlined style={{ color: '#bfbfbf', marginLeft: 8 }} />
                                        </Tooltip>
                                    </div>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="delta-card danger-card" bordered={false} onClick={() => openGallery('regressions', comparisonData.deltas.regressions, comparisonData.challenger_name, challengerId)}>
                                    <div className="delta-icon"><CloseCircleOutlined style={{ color: '#f5222d' }} /></div>
                                    <div className="delta-content">
                                        <Text className="delta-value" style={{ color: '#f5222d' }}>{comparisonData.counts.regressions}</Text>
                                        <Text className="delta-label">New Regressions</Text>
                                        <Tooltip title="Baseline detected these correctly, but the new model broke them (Missed them).">
                                            <InfoCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />
                                        </Tooltip>
                                    </div>
                                </Card>
                            </Col>
                        </Row>

                        <div style={{ marginTop: 24 }}>
                            <Title level={5}>Persistent Errors (Still Broken ⚠️)</Title>
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <div onClick={() => openGallery('persistent_fps', comparisonData.deltas.persistent_false_positives, comparisonData.challenger_name, challengerId)} style={{ cursor: comparisonData.counts.persistent_fps > 0 ? 'pointer' : 'default' }}>
                                        <Card size="small" bordered={false} style={{ background: '#fffbe6', transition: 'all 0.3s' }} className="delta-card">
                                            <Statistic title="Persistent False Positives" value={comparisonData.counts.persistent_fps} valueStyle={{ color: '#faad14' }} />
                                        </Card>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div onClick={() => openGallery('persistent_fns', comparisonData.deltas.persistent_misses, comparisonData.challenger_name, challengerId)} style={{ cursor: comparisonData.counts.persistent_fns > 0 ? 'pointer' : 'default' }}>
                                        <Card size="small" bordered={false} style={{ background: '#fffbe6', transition: 'all 0.3s' }} className="delta-card">
                                            <Statistic title="Persistent Misses" value={comparisonData.counts.persistent_fns} valueStyle={{ color: '#faad14' }} />
                                        </Card>
                                    </div>
                                </Col>
                            </Row>
                        </div>

                        <DeltaGalleryModal
                            visible={galleryVisible}
                            onCancel={() => setGalleryVisible(false)}
                            items={galleryConfig.items}
                            type={galleryConfig.type}
                            baselineName={comparisonData.baseline_name}
                            challengerName={comparisonData.challenger_name}
                            baselineId={baselineId}
                            challengerId={challengerId}
                            projectId={currentTraining.projectId}
                        />
                    </div>
                )
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Select a Baseline and Challenger model to compare prediction deltas."
                />
            )}
        </div>
    );
};

const Statistic = ({ title, value, valueStyle }) => (
    <div>
        <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '24px', ...valueStyle }}>{value}</div>
    </div>
);

export default ComparisonEngineView;
