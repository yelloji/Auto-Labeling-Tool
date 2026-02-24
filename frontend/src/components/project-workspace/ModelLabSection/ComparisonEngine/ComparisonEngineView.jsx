import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Spin, Empty, Tag, Space, Row, Col, Divider, Tooltip, Switch } from 'antd';
import { SwapOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
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
