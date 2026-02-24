import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Spin, Empty, Tag, Space, Row, Col, Divider, Tooltip, Switch } from 'antd';
import { SwapOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, PlusOutlined, MinusOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons';
import { trainingAPI, projectsAPI } from '../../../../services/api';
import DeltaGalleryModal from './DeltaGalleryModal';
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

// ─── Split Mode Overview Panel ───────────────────────────────────────────────
const MetricRow = ({ label, valA, valB, valC, unit = '%', higherIsBetter = true }) => {
    const delta = (a, b) => {
        if (a == null || b == null) return null;
        return parseFloat((b - a).toFixed(1));
    };
    const badge = (d) => {
        if (d === null) return null;
        const better = higherIsBetter ? d > 0 : d < 0;
        const color = d === 0 ? '#8c8c8c' : better ? '#52c41a' : '#f5222d';
        return <span style={{ fontSize: 11, color, fontWeight: 600 }}>{d > 0 ? '+' : ''}{d}{unit}</span>;
    };
    return (
        <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
            <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>{label}</Text></Col>
            <Col span={valC ? 5 : 7} style={{ textAlign: 'center' }}>
                <Text strong>{valA != null ? `${valA}${unit}` : '—'}</Text>
            </Col>
            <Col span={valC ? 6 : 11} style={{ textAlign: 'center' }}>
                <Text strong>{valB != null ? `${valB}${unit}` : '—'}</Text>
                {' '}{badge(delta(valA, valB))}
            </Col>
            {valC !== undefined && (
                <Col span={7} style={{ textAlign: 'center' }}>
                    <Text strong>{valC != null ? `${valC}${unit}` : '—'}</Text>
                    {' '}{badge(delta(valA, valC))}
                </Col>
            )}
        </Row>
    );
};

const SplitOverviewPanel = ({ data, is3Way }) => {
    const a = data.baseline;
    const b = data.challenger_b;
    const c = data.challenger_c;
    const hasGT = a?.has_ground_truth && b?.has_ground_truth;

    return (
        <div className="delta-dashboard">
            <Title level={4} style={{ marginBottom: 4 }}>Split Mode — Quality Comparison</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                Real ground truth from dataset labels. No manual verification needed.
            </Text>

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
                    {/* Header Row */}
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

                    {/* Metric Rows */}
                    <MetricRow label="Precision" valA={a.precision} valB={b.precision} valC={is3Way && c ? c.precision : undefined} />
                    <MetricRow label="Recall" valA={a.recall} valB={b.recall} valC={is3Way && c ? c.recall : undefined} />
                    <MetricRow label="F1 Score" valA={a.f1} valB={b.f1} valC={is3Way && c ? c.f1 : undefined} />
                    <MetricRow label="Avg IoU" valA={a.avg_iou} valB={b.avg_iou} valC={is3Way && c ? c.avg_iou : undefined} />

                    <Divider style={{ margin: '8px 0 16px' }} />

                    {/* TP / FP / FN Counts */}
                    <MetricRow label="True Positives ✓" valA={a.true_positives} valB={b.true_positives} valC={is3Way && c ? c.true_positives : undefined} unit="" />
                    <MetricRow label="False Positives ✗" valA={a.false_positives} valB={b.false_positives} valC={is3Way && c ? c.false_positives : undefined} unit="" higherIsBetter={false} />
                    <MetricRow label="False Negatives △" valA={a.false_negatives} valB={b.false_negatives} valC={is3Way && c ? c.false_negatives : undefined} unit="" higherIsBetter={false} />
                    <MetricRow label="Total GT objects" valA={a.total_gt} valB={b.total_gt} valC={is3Way && c ? c.total_gt : undefined} unit="" higherIsBetter={null} />
                </>
            )}
        </div>
    );
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
                    <SplitOverviewPanel data={comparisonData} is3Way={!!comparisonData.challenger_c} />
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
