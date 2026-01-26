import React, { useState, useMemo, useEffect } from 'react';
import {
    Row, Col, Card, Space, Typography, Slider, Segmented,
    Tag, Tooltip, Empty, Descriptions, Divider, Modal, List, Button
} from 'antd';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';
import {
    FilterOutlined,
    ColumnHeightOutlined,
    CloudSyncOutlined,
    DatabaseOutlined,
    BarChartOutlined,
    LineChartOutlined,
    WarningOutlined
} from '@ant-design/icons';

import { projectsAPI } from '../../../../../services/api';

const { Text } = Typography;

/**
 * ChartsView Component - Simple White Edition
 * 
 * focuses on Confidence Slicer fix and clean white design.
 */
const ChartsView = ({ experiment, verifications = [], projectLabels = [], trainingClasses = [] }) => {
    const [confRange, setConfRange] = useState([10, 100]);
    const [sizeSlice, setSizeSlice] = useState('all');
    const [classFilter, setClassFilter] = useState('all');

    const [qualityStats, setQualityStats] = useState(null);
    const [loadingQuality, setLoadingQuality] = useState(false);

    // New State for Error Detail Modal
    const [errorModal, setErrorModal] = useState({ visible: false, title: '', items: [] });

    const isSplit = experiment?.dataset_source && experiment.dataset_source !== 'upload';

    // --- 📡 Fetch Quality Stats for Split Datasets ---
    useEffect(() => {
        if (isSplit && experiment?.id) {
            setLoadingQuality(true);
            projectsAPI.getQualityStats(experiment.id)
                .then(stats => {
                    setQualityStats(stats);
                })
                .catch(err => console.error("Analytics fetch failed:", err))
                .finally(() => setLoadingQuality(false));
        }
    }, [experiment?.id, isSplit]);

    // --- 📐 Data Processing ---
    const processedData = useMemo(() => {
        if (!experiment?.predictions) return null;

        // --- 1. Confidence Thresholds ---
        const [minConf, maxConf] = [confRange[0] / 100, confRange[1] / 100];

        // --- 2. Calculate Size Thresholds (for the quartiles to work) ---
        let allAreas = [];
        Object.values(experiment.predictions).forEach(dets => {
            if (Array.isArray(dets)) {
                dets.forEach(d => {
                    if (d.bbox) {
                        const area = (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]);
                        allAreas.push(area);
                    }
                });
            }
        });
        allAreas.sort((a, b) => a - b);
        const q25 = allAreas[Math.floor(allAreas.length * 0.25)] || 0;
        const q50 = allAreas[Math.floor(allAreas.length * 0.50)] || 0;
        const q75 = allAreas[Math.floor(allAreas.length * 0.75)] || 0;

        const getSizeGrp = (bbox) => {
            const area = bbox ? (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) : 0;
            if (area <= q25) return 'tiny';
            if (area <= q50) return 'small';
            if (area <= q75) return 'medium';
            return 'large';
        };

        // --- 3. Base Data from Backend vs Local fallback ---
        let tpList = [];
        let fpList = [];
        let fnList = [];

        if (qualityStats && qualityStats.has_ground_truth) {
            // ELITE MODE: Use Backend matched lists
            fpList = qualityStats.detailed_false_positives || [];
            fnList = qualityStats.detailed_missed_objects || [];

            // True Positives = All predictions NOT in the FP list
            // We build a quick lookup for FPs to identify TPs
            const fpLookup = new Set(fpList.map(fp => `${fp.image}_${JSON.stringify(fp.bbox)}`));

            Object.entries(experiment.predictions).forEach(([imgName, dets]) => {
                if (!Array.isArray(dets)) return;
                const fileName = imgName.split('/').pop();
                dets.forEach(d => {
                    const key = `${fileName}_${JSON.stringify(d.bbox)}`;
                    if (!fpLookup.has(key)) {
                        tpList.push({ ...d, imgName: fileName, type: 'True Positive' });
                    }
                });
            });
        } else {
            // FALLBACK: Old manual matching (only for uploads or if backend fails)
            // (Keeping this for safety, but with projectLabels awareness)
            const verifyMap = {};
            verifications.forEach(v => { if (!verifyMap[v.image_name]) verifyMap[v.image_name] = []; verifyMap[v.image_name].push(v); });

            const getIoU = (boxA, boxB) => {
                const xA = Math.max(boxA[0], boxB[0]); const yA = Math.max(boxA[1], boxB[1]);
                const xB = Math.min(boxA[2], boxB[2]); const yB = Math.min(boxA[3], boxB[3]);
                const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
                if (inter === 0) return 0;
                const areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
                const areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);
                return inter / (areaA + areaB - inter);
            };

            const matchedGtIds = new Set();
            Object.entries(experiment.predictions).forEach(([imgName, dets]) => {
                if (!Array.isArray(dets)) return;
                const fileName = imgName.split('/').pop();
                const imgGts = verifyMap[imgName] || [];

                dets.forEach(d => {
                    let bestMatch = null;
                    let maxIoU = 0.5;
                    imgGts.forEach(gt => {
                        const iou = getIoU(d.bbox, gt.bbox);
                        if (iou > maxIoU && gt.class_name === d.class) { maxIoU = iou; bestMatch = gt; }
                    });

                    if (bestMatch && !matchedGtIds.has(bestMatch.id)) {
                        tpList.push({ ...d, imgName: fileName, type: 'True Positive' });
                        matchedGtIds.add(bestMatch.id);
                    } else {
                        fpList.push({ ...d, imgName: fileName, type: 'False Positive', reason: 'No Match' });
                    }
                });
            });
            // Manual FN calculation is limited here
            fnList = [];
        }

        // --- 4. Apply Filters (The Heart of the UI) ---
        const filterItem = (item, isFN = false) => {
            const conf = item.confidence || item.conf || 0;
            const rawCls = item.class || item.class_name || 'Unknown';
            const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
            const sz = getSizeGrp(item.bbox);

            const matchesConf = isFN ? true : (conf >= minConf && conf <= maxConf);
            const matchesClass = classFilter === 'all' || classFilter === cls;
            const matchesSize = sizeSlice === 'all' || sizeSlice === sz;
            const matchesTraining = trainingClasses && trainingClasses.length > 0 ? trainingClasses.includes(cls) : true;

            return matchesConf && matchesClass && matchesSize && matchesTraining;
        };

        const filteredTP = tpList.filter(i => filterItem(i));
        const filteredFP = fpList.filter(i => filterItem(i));
        const filteredFN = fnList.filter(i => filterItem(i, true));

        // --- 5. Metrics & Distributions ---
        const tp = filteredTP.length;
        const fp = filteredFP.length;
        const fn = filteredFN.length;

        const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
        const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
        const f1 = (precision + recall) > 0 ? (2 * (precision * recall) / (precision + recall)) : 0;

        const sizeDistrib = { tiny: 0, small: 0, medium: 0, large: 0 };
        // Distributions should show trends for ALL predictions (matched and unmatched)
        [...tpList, ...fpList].forEach(d => {
            const conf = d.confidence || d.conf || 0;
            if (conf >= minConf && conf <= maxConf) {
                const cls = d.class || d.class_name;
                if (classFilter === 'all' || classFilter === cls) {
                    sizeDistrib[getSizeGrp(d.bbox)]++;
                }
            }
        });

        // --- 6. Charts Data ---
        const classStats = {};
        [...filteredTP, ...filteredFP].forEach(d => {
            const rawCls = d.class || d.class_name;
            const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
            if (!classStats[cls]) classStats[cls] = { name: cls, total: 0, pass: 0, fail: 0 };
            classStats[cls].total++;
            if (d.type === 'True Positive') classStats[cls].pass++; else classStats[cls].fail++;
        });

        const stressCurve = [];
        for (let t = 0.1; t <= 0.95; t += 0.05) {
            let tPass = 0, tTotal = 0;
            [...tpList, ...fpList].forEach(c => {
                const conf = c.confidence || c.conf || 0;
                if (conf >= t) {
                    tTotal++;
                    if (c.type === 'True Positive') tPass++;
                }
            });
            stressCurve.push({ threshold: t.toFixed(2), yield: tTotal > 0 ? ((tPass / tTotal) * 100).toFixed(1) : 0 });
        }

        // Available Classes Collection
        const availableClasses = new Set();
        [...tpList, ...fpList, ...fnList].forEach(i => {
            const rawCls = i.class || i.class_name;
            const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
            availableClasses.add(cls);
        });

        return {
            kpis: {
                tp, fp, fn,
                precision: precision.toFixed(1),
                recall: recall.toFixed(1),
                f1: f1.toFixed(1),
                sizeDistrib,
                fpItems: filteredFP.map(i => ({ ...i, imgName: i.image || i.imgName })),
                fnItems: filteredFN.map(i => ({ ...i, imgName: i.image || i.imgName }))
            },
            classChart: Object.values(classStats),
            stressCurve,
            availableClasses: Array.from(availableClasses).filter(c => trainingClasses.length > 0 ? trainingClasses.includes(c) : true)
        };
    }, [experiment, verifications, qualityStats, confRange, sizeSlice, classFilter, trainingClasses]);

    if (!processedData) return <Empty />;

    const { kpis, classChart, stressCurve, availableClasses } = processedData;

    return (
        <div style={{ padding: '24px', background: '#fff' }}>
            <Row gutter={[24, 24]}>
                {/* --- Sidebar (Refined per User Specs) --- */}
                <Col xs={24} lg={6}>
                    <Card size="small" style={{ marginBottom: 16, border: '1px solid #f0f0f0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>Active Dataset</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 4 }}>
                                {isSplit ? <CloudSyncOutlined style={{ color: '#1890ff' }} /> : <DatabaseOutlined style={{ color: '#faad14' }} />}
                                <Text strong style={{ fontSize: 14 }}>{isSplit ? 'Split: ' + experiment.dataset_path?.split('/').pop()?.toUpperCase() : 'Manual Upload'}</Text>
                            </div>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Class Filter (Isolate)</Text>
                            <Segmented
                                block
                                size="small"
                                value={classFilter}
                                onChange={setClassFilter}
                                options={[
                                    { label: 'All', value: 'all' },
                                    ...availableClasses.map(c => ({ label: c, value: c }))
                                ]}
                            />
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: 600 }}>Confidence Filter</Text>
                                <Tag color="blue" style={{ margin: 0 }}>{(confRange[0] / 100).toFixed(2)} - {(confRange[1] / 100).toFixed(2)}</Tag>
                            </div>
                            <Slider
                                range
                                min={0}
                                max={100}
                                value={confRange}
                                onChange={setConfRange}
                                tipFormatter={v => (v / 100).toFixed(2)}
                            />
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div>
                            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 12 }}>Size Distribution Filter</Text>
                            <div style={{ height: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: 'Tiny', value: kpis.sizeDistrib?.tiny || 0, key: 'tiny' },
                                            { name: 'Small', value: kpis.sizeDistrib?.small || 0, key: 'small' },
                                            { name: 'Medium', value: kpis.sizeDistrib?.medium || 0, key: 'medium' },
                                            { name: 'Large', value: kpis.sizeDistrib?.large || 0, key: 'large' }
                                        ]}
                                        onClick={(data) => {
                                            if (data && data.activePayload && data.activePayload.length > 0) {
                                                const key = data.activePayload[0].payload.key;
                                                setSizeSlice(sizeSlice === key ? 'all' : key);
                                            }
                                        }}
                                    >
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: 9 }} />
                                        <YAxis hide domain={[0, 'auto']} />
                                        <RechartsTooltip cursor={{ fill: '#f0f7ff' }} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {
                                                ['tiny', 'small', 'medium', 'large'].map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={(sizeSlice === entry || sizeSlice === 'all') ? '#1890ff' : '#d9d9d9'}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <Tag
                                    color={sizeSlice === 'all' ? 'blue' : 'default'}
                                    onClick={() => setSizeSlice('all')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    Clear Size Filter
                                </Tag>
                            </div>
                        </div>
                    </Card>
                </Col>

                {/* --- Main Section --- */}
                <Col xs={24} lg={18}>
                    {/* 5 KPI Cards - Deep Isolation Logic (Fixed Order) */}
                    <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #f0f0f0', cursor: 'pointer' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: 'False Positives Triggered',
                                    items: kpis.fpItems
                                })}
                            >
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>FALSE POSITIVE</Text>
                                <Text strong style={{ fontSize: 20, color: '#ff4d4f' }}>
                                    {isSplit ? kpis.fp : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #f0f0f0', cursor: 'pointer' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: 'Missed Objects (FN)',
                                    items: kpis.fnItems
                                })}
                            >
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>MISSING (FN)</Text>
                                <Text strong style={{ fontSize: 20, color: '#faad14' }}>
                                    {isSplit ? kpis.fn : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>PRECISION</Text>
                                <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
                                    {isSplit ? `${kpis.precision}%` : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>RECALL</Text>
                                <Text strong style={{ fontSize: 20, color: '#722ed1' }}>
                                    {isSplit ? `${kpis.recall}%` : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>F1 SCORE</Text>
                                <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                                    {isSplit ? `${kpis.f1}%` : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col span={12}>
                            <Card title={<Space><BarChartOutlined /> Class Matrix</Space>} size="small">
                                <div style={{ height: 250 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={classChart} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={80} />
                                            <RechartsTooltip />
                                            <Bar dataKey="pass" fill="#52c41a" stackId="a" />
                                            <Bar dataKey="total" fill="#f0f0f0" stackId="a" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </Col>
                        <Col span={12}>
                            <Card title={<Space><LineChartOutlined /> Stress Curve</Space>} size="small">
                                <div style={{ height: 250 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={stressCurve}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="threshold" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Line type="monotone" dataKey="yield" stroke="#1890ff" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </Col>
            </Row>

            {/* Error Detail Modal */}
            <Modal
                title={
                    <Space>
                        <WarningOutlined style={{ color: errorModal.title.includes('False') ? '#ff4d4f' : '#faad14' }} />
                        {errorModal.title}
                        <Tag>{errorModal.items?.length || 0} Items</Tag>
                    </Space>
                }
                visible={errorModal.visible}
                onCancel={() => setErrorModal({ ...errorModal, visible: false })}
                footer={[
                    <Button key="close" onClick={() => setErrorModal({ ...errorModal, visible: false })}>
                        Close
                    </Button>
                ]}
                width={600}
                bodyStyle={{ maxHeight: '60vh', overflowY: 'auto' }}
            >
                {
                    errorModal.items && errorModal.items.length > 0 ? (
                        <List
                            itemLayout="horizontal"
                            dataSource={errorModal.items}
                            renderItem={item => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 4,
                                                background: item.type === 'False Positive' ? '#ff4d4f20' : '#faad1420',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: item.type === 'False Positive' ? '#ff4d4f' : '#faad14'
                                            }}>
                                                {item.type === 'False Positive' ? 'FP' : 'FN'}
                                            </div>
                                        }
                                        title={<Text strong>{item.imgName}</Text>}
                                        description={
                                            <Space>
                                                <Tag>{item.class || item.class_name}</Tag>
                                                {item.conf && <Text type="secondary">Conf: {(item.conf * 100).toFixed(1)}%</Text>}
                                            </Space>
                                        }
                                    />
                                    {item.bbox && (
                                        <Tag color="default">
                                            Box: [{item.bbox.map(x => Math.round(x)).join(', ')}]
                                        </Tag>
                                    )}
                                </List.Item>
                            )}
                        />
                    ) : (
                        <Empty description="No errors found in this selection" />
                    )
                }
            </Modal>
        </div>
    );
};

export default ChartsView;
