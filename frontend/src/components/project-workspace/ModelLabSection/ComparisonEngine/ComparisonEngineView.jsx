import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Spin, Empty, Tag, Space, Row, Col, Divider, Tooltip } from 'antd';
import { SwapOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { trainingAPI, projectsAPI } from '../../../../services/api';
import DeltaGalleryModal from './DeltaGalleryModal';
import './ComparisonEngineView.css';

const { Title, Text } = Typography;
const { Option } = Select;

const ComparisonEngineView = ({ currentTraining }) => {
    const [trainings, setTrainings] = useState([]);

    const [baselineTrainingId, setBaselineTrainingId] = useState(currentTraining?.id);
    const [baselineExperiments, setBaselineExperiments] = useState([]);
    const [baselineId, setBaselineId] = useState(null);

    const [challengerTrainingId, setChallengerTrainingId] = useState(null);
    const [challengerExperiments, setChallengerExperiments] = useState([]);
    const [challengerId, setChallengerId] = useState(null);

    const [loading, setLoading] = useState(false);
    const [comparisonData, setComparisonData] = useState(null);

    // Gallery Modal State
    const [galleryVisible, setGalleryVisible] = useState(false);
    const [galleryConfig, setGalleryConfig] = useState({ type: '', items: [] });

    const openGallery = (type, items) => {
        if (!items || items.length === 0) return;
        setGalleryConfig({ type, items });
        setGalleryVisible(true);
    };

    useEffect(() => {
        // Fetch all trainings for the select dropdowns
        const fetchTrainings = async () => {
            if (!currentTraining?.projectId) return;
            try {
                const data = await projectsAPI.getTrainingSessions(currentTraining.projectId);
                setTrainings(data || []);
            } catch (err) {
                console.error("Failed to fetch trainings", err);
            }
        };
        fetchTrainings();
    }, [currentTraining]);

    useEffect(() => {
        const fetchExps = async (tId, setExps) => {
            if (!tId) return;
            try {
                const exps = await projectsAPI.getTrainingExperiments(tId);
                const predictions = exps.filter(e => e.experiment_type === 'prediction' && e.status === 'completed');
                setExps(predictions);
            } catch (e) { }
        };
        fetchExps(baselineTrainingId, setBaselineExperiments);
    }, [baselineTrainingId]);

    useEffect(() => {
        const fetchExps = async (tId, setExps) => {
            if (!tId) return;
            try {
                const exps = await projectsAPI.getTrainingExperiments(tId);
                const predictions = exps.filter(e => e.experiment_type === 'prediction' && e.status === 'completed');
                setExps(predictions);
            } catch (e) { }
        };
        fetchExps(challengerTrainingId, setChallengerExperiments);
    }, [challengerTrainingId]);

    const handleCompare = async () => {
        if (!baselineId || !challengerId) return;
        setLoading(true);
        setComparisonData(null);
        try {
            const data = await projectsAPI.compareExperiments(currentTraining.projectId, baselineId, challengerId);
            console.log("Compare Data:", data); // For easy debugging
            setComparisonData(data);
        } catch (err) {
            console.error(err);
            setComparisonData({ error: err.message || "Failed to compare" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="comparison-engine-container" style={{ padding: '0 16px 16px' }}>
            <div style={{ marginBottom: 24, padding: "16px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e8e8e8" }}>
                <Row gutter={24} align="middle">
                    <Col span={10}>
                        <Card size="small" title="Model A (Baseline)" bordered={false} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div>
                                    <Text type="secondary">Training Session</Text>
                                    <Select
                                        style={{ width: '100%' }}
                                        value={baselineTrainingId}
                                        onChange={v => { setBaselineTrainingId(v); setBaselineId(null); }}
                                    >
                                        {trainings.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
                                    </Select>
                                </div>
                                <div>
                                    <Text type="secondary">Prediction Run (Verifications)</Text>
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="Select prediction run"
                                        value={baselineId}
                                        onChange={setBaselineId}
                                    >
                                        {baselineExperiments.map(e => <Option key={e.id} value={e.id}>{e.name}</Option>)}
                                    </Select>
                                </div>
                            </Space>
                        </Card>
                    </Col>
                    <Col span={4} style={{ textAlign: 'center' }}>
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<SwapOutlined />}
                            size="large"
                            onClick={handleCompare}
                            loading={loading}
                            disabled={!baselineId || !challengerId}
                            style={{ width: 64, height: 64, background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)", border: "none" }}
                        />
                        <div style={{ marginTop: 8 }}><Text strong type="secondary">VS</Text></div>
                    </Col>
                    <Col span={10}>
                        <Card size="small" title="Model B (Challenger)" bordered={false} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div>
                                    <Text type="secondary">Training Session</Text>
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="Select new training"
                                        value={challengerTrainingId}
                                        onChange={v => { setChallengerTrainingId(v); setChallengerId(null); }}
                                    >
                                        {trainings.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
                                    </Select>
                                </div>
                                <div>
                                    <Text type="secondary">Prediction Run</Text>
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="Select prediction run"
                                        value={challengerId}
                                        onChange={setChallengerId}
                                    >
                                        {challengerExperiments.map(e => <Option key={e.id} value={e.id}>{e.name}</Option>)}
                                    </Select>
                                </div>
                            </Space>
                        </Card>
                    </Col>
                </Row>
            </div>

            <Divider />

            {loading ? (
                <div style={{ textAlign: 'center', padding: '64px' }}>
                    <Spin size="large" />
                    <Title level={4} style={{ marginTop: 16 }}>Running Detailed Delta Analysis...</Title>
                    <Text type="secondary">Matching bounding boxes across two isolated model outputs.</Text>
                </div>
            ) : comparisonData ? (
                comparisonData.error ? (
                    <Empty description={`Error: ${comparisonData.error}`} />
                ) : comparisonData.message ? (
                    <Empty description={comparisonData.message} />
                ) : (
                    <div className="delta-dashboard">
                        <Title level={4}>Delta Analysis Results</Title>
                        <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
                            Comparing human verifications from {comparisonData.baseline_name} against the raw outputs of {comparisonData.challenger_name}.
                        </Text>

                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Card className="delta-card success-card" bordered={false} onClick={() => openGallery('resolved_fps', comparisonData.deltas.resolved_false_positives)}>
                                    <div className="delta-icon"><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                                    <div className="delta-content">
                                        <Text className="delta-value" style={{ color: '#52c41a' }}>
                                            {comparisonData.counts.resolved_fps}
                                        </Text>
                                        <Text className="delta-label">Resolved False Positives</Text>
                                        <Tooltip title="Baseline had FPs (hallucinations/glare). New model learned to ignore them.">
                                            <InfoCircleOutlined style={{ color: '#bfbfbf', marginLeft: 8 }} />
                                        </Tooltip>
                                    </div>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="delta-card success-card" bordered={false} onClick={() => openGallery('resolved_fns', comparisonData.deltas.resolved_misses)}>
                                    <div className="delta-icon"><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                                    <div className="delta-content">
                                        <Text className="delta-value" style={{ color: '#52c41a' }}>
                                            {comparisonData.counts.resolved_fns}
                                        </Text>
                                        <Text className="delta-label">Resolved Misses (FN)</Text>
                                        <Tooltip title="Baseline missed objects. New model successfully detected them.">
                                            <InfoCircleOutlined style={{ color: '#bfbfbf', marginLeft: 8 }} />
                                        </Tooltip>
                                    </div>
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card className="delta-card danger-card" bordered={false} onClick={() => openGallery('regressions', comparisonData.deltas.regressions)}>
                                    <div className="delta-icon"><CloseCircleOutlined style={{ color: '#f5222d' }} /></div>
                                    <div className="delta-content">
                                        <Text className="delta-value" style={{ color: '#f5222d' }}>
                                            {comparisonData.counts.regressions}
                                        </Text>
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
                                    <div onClick={() => openGallery('persistent_fps', comparisonData.deltas.persistent_false_positives)} style={{ cursor: comparisonData.counts.persistent_fps > 0 ? 'pointer' : 'default' }}>
                                        <Card size="small" bordered={false} style={{ background: '#fffbe6', transition: 'all 0.3s' }} className="delta-card">
                                            <Statistic title="Persistent False Positives" value={comparisonData.counts.persistent_fps} valueStyle={{ color: '#faad14' }} />
                                        </Card>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div onClick={() => openGallery('persistent_fns', comparisonData.deltas.persistent_misses)} style={{ cursor: comparisonData.counts.persistent_fns > 0 ? 'pointer' : 'default' }}>
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

// Mock Statistic to avoid importing it from antd if not needed, or just use typography
const Statistic = ({ title, value, valueStyle }) => (
    <div>
        <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '24px', ...valueStyle }}>{value}</div>
    </div>
);

export default ComparisonEngineView;
