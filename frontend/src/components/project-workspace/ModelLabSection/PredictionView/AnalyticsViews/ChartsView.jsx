import React, { useState, useMemo, useEffect } from 'react';
import {
    Row, Col, Card, Space, Typography, Slider, Select,
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
    const [iouThreshold, setIouThreshold] = useState(30); // New: Dynamic IOU (30 = 0.3)
    const [sizeSlice, setSizeSlice] = useState('all');
    const [selectedClasses, setSelectedClasses] = useState([]); // Empty = All

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

        let tpList = [];
        let fpList = [];
        let fnList = [];
        let totalGT = 0; // Initialize early to prevent ReferenceError

        if (qualityStats && qualityStats.has_ground_truth) {
            // ELITE MODE: Use Backend matched lists
            const rawTP = qualityStats.detailed_true_positives || [];
            const rawFP = qualityStats.detailed_false_positives || [];
            const rawFN = qualityStats.detailed_missed_objects || [];

            // 1. Threshold-Sensitive TP/FP/Misaligned Split
            rawTP.forEach(d => {
                const conf = (d.confidence || 0) * 100;
                const iou = (d.matched_iou || 0) * 100;
                const rawCls = d.class || d.class_name || 'Unknown';
                const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;

                const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);

                if (matchesClass) {
                    // Find Global Index in original predictions array
                    const originalArray = experiment.predictions[d.image || d.imgName] || [];
                    const gIdx = originalArray.findIndex(orig =>
                        orig.bbox && d.bbox &&
                        orig.bbox[0] === d.bbox[0] && orig.bbox[1] === d.bbox[1] &&
                        orig.bbox[2] === d.bbox[2] && orig.bbox[3] === d.bbox[3]
                    );

                    if (conf >= confRange[0] && conf <= confRange[1]) {
                        if (iou >= iouThreshold) {
                            tpList.push({ ...d, type: 'True Positive', globalIdx: gIdx !== -1 ? gIdx + 1 : null });
                        } else {
                            // It matched GT, but is misaligned!
                            fpList.push({ ...d, type: 'Misaligned', reason: 'Low IoU', globalIdx: gIdx !== -1 ? gIdx + 1 : null });
                        }
                    } else {
                        // DYNAMIC FN: Suppressed by confidence slider = Missing Ground Truth
                        fnList.push({ ...d, type: 'Missed (Low Confidence)', globalIdx: gIdx !== -1 ? gIdx + 1 : null });
                    }
                }
            });

            // DENOMINATOR LOGIC: Calculate total GT objects that pass Class/Size filters
            // Total GT = All matched objects (rawTP) + All unmatched objects (rawFN)
            const allGTObjects = [...rawTP, ...rawFN];
            const filteredGTUniverse = allGTObjects.filter(item => {
                const rawCls = item.class || item.class_name || 'Unknown';
                const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
                const sz = getSizeGrp(item.bbox);

                const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);
                const matchesSize = sizeSlice === 'all' || sizeSlice === sz;
                const matchesTraining = trainingClasses && trainingClasses.length > 0 ? trainingClasses.includes(cls) : true;

                return matchesClass && matchesSize && matchesTraining;
            });
            totalGT = filteredGTUniverse.length; // Update the outer variable

            rawFP.forEach(d => {
                const conf = (d.confidence || 0) * 100;
                const rawCls = d.class || d.class_name || 'Unknown';
                const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
                const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);

                if (matchesClass && conf >= confRange[0] && conf <= confRange[1]) {
                    // Find Global Index in original predictions array
                    const originalArray = experiment.predictions[d.image || d.imgName] || [];
                    const gIdx = originalArray.findIndex(orig =>
                        orig.bbox && d.bbox &&
                        orig.bbox[0] === d.bbox[0] && orig.bbox[1] === d.bbox[1] &&
                        orig.bbox[2] === d.bbox[2] && orig.bbox[3] === d.bbox[3]
                    );
                    fpList.push({ ...d, type: 'False Positive', reason: 'No Match', globalIdx: gIdx !== -1 ? gIdx + 1 : null });
                }
            });

            // Combine backend reported missed objects with our confidence-suppressed ones
            fnList = [...fnList, ...rawFN];
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

            // Fallback GT count
            totalGT = verifications.filter(v => {
                const cls = (v.class_name || 'Unknown').replace(/^Class\s+/i, '');
                const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);
                return matchesClass;
            }).length;
        }

        // --- 4. Apply Filters (The Heart of the UI) ---
        const filterItem = (item, isFN = false) => {
            const conf = item.confidence || item.conf || 0;
            const rawCls = item.class || item.class_name || 'Unknown';
            const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
            const sz = getSizeGrp(item.bbox);

            const matchesConf = isFN ? true : (conf >= minConf && conf <= maxConf);
            const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);
            const matchesSize = sizeSlice === 'all' || sizeSlice === sz;
            const matchesTraining = trainingClasses && trainingClasses.length > 0 ? trainingClasses.includes(cls) : true;

            return matchesConf && matchesClass && matchesSize && matchesTraining;
        };

        const filteredTP = tpList.filter(i => filterItem(i));
        const filteredFP = fpList.filter(i => filterItem(i));
        const filteredFN = fnList.filter(i => filterItem(i, true));

        // Separating True False Positives from Misaligned ones
        const purelyFP = filteredFP.filter(i => i.type === 'False Positive');
        const misaligned = filteredFP.filter(i => i.type === 'Misaligned');

        // Separating Real FN (never detected) from Filtered FN (suppressed by confidence)
        const fnReal = filteredFN.filter(i => i.type !== 'Missed (Low Confidence)');
        const fnFiltered = filteredFN.filter(i => i.type === 'Missed (Low Confidence)');


        // --- 5. Metrics & Distributions ---
        const tp = filteredTP.length;
        const fp = purelyFP.length;
        const ma = misaligned.length;
        const fn = filteredFN.length;

        // Ratio Calculation: Numerator is ALL AI detections (TP+FP+MA) / Denominator is ALL GT objects
        const totalDetections = tp + fp + ma;
        const aiGTRatio = totalGT > 0 ? (totalDetections / totalGT).toFixed(2) : '0.00';

        const precision = (tp + fp + ma) > 0 ? (tp / (tp + fp + ma)) * 100 : 0;
        const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
        const f1 = (precision + recall) > 0 ? (2 * (precision * recall) / (precision + recall)) : 0;

        const sizeDistrib = { tiny: 0, small: 0, medium: 0, large: 0 };
        // Distributions should show trends for ALL predictions (matched and unmatched)
        [...tpList, ...fpList].forEach(d => {
            const conf = d.confidence || d.conf || 0;
            if (conf >= minConf && conf <= maxConf) {
                const rawCls = d.class || d.class_name;
                const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
                if (selectedClasses.length === 0 || selectedClasses.includes(cls)) {
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
                tp, fp, fn, ma, aiGTRatio, totalGT,
                fnReal: fnReal.length,
                fnFiltered: fnFiltered.length,
                precision: precision.toFixed(1),
                recall: recall.toFixed(1),
                f1: f1.toFixed(1),
                sizeDistrib,
                tpItems: filteredTP.map(i => ({ ...i, imgName: i.image || i.imgName })),
                fpItems: purelyFP.map(i => ({ ...i, imgName: i.image || i.imgName })),
                maItems: misaligned.map(i => ({ ...i, imgName: i.image || i.imgName })),
                fnItems: filteredFN.map(i => ({ ...i, imgName: i.image || i.imgName }))
            },
            classChart: Object.values(classStats),
            stressCurve,
            availableClasses: Array.from(availableClasses).filter(c => trainingClasses.length > 0 ? trainingClasses.includes(c) : true)
        };
    }, [experiment, verifications, qualityStats, confRange, iouThreshold, sizeSlice, selectedClasses, trainingClasses]);

    if (!processedData) return <Empty />;

    const { kpis, classChart, stressCurve, availableClasses } = processedData;
    const { tp, fp, ma, fn, totalGT } = kpis;

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
                            <Tooltip title="Select specific object classes to analyze. Metrics will aggregate all selected classes together.">
                                <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Class Filter (Isolate)</Text>
                            </Tooltip>
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="All Classes"
                                value={selectedClasses}
                                onChange={setSelectedClasses}
                                allowClear
                                maxTagCount="responsive"
                            >
                                {availableClasses.map(c => (
                                    <Select.Option key={c} value={c}>{c}</Select.Option>
                                ))}
                            </Select>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Tooltip title="Filters out detections the AI is unsure about. Setting this higher reduces Incorrect Alarms but may cause the AI to miss some objects.">
                                    <Text style={{ fontSize: 13, fontWeight: 600, cursor: 'help' }}>Confidence Filter</Text>
                                </Tooltip>
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

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Tooltip title="Defines the standard for 'Good Alignment'. Raising this moves poor quality boxes from 'True Positives' into 'Accuracy Errors' live.">
                                    <Text style={{ fontSize: 13, fontWeight: 600, cursor: 'help' }}>Overlap (IoU) Threshold</Text>
                                </Tooltip>
                                <Tag color="orange" style={{ margin: 0 }}>{(iouThreshold / 100).toFixed(2)}+</Tag>
                            </div>
                            <Slider
                                min={10}
                                max={90}
                                value={iouThreshold}
                                onChange={setIouThreshold}
                                tipFormatter={v => (v / 100).toFixed(2)}
                            />
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div>
                            <Tooltip title="Isolate model bias by size. Use this to see if your model fails specifically on 'Tiny' objects.">
                                <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 12, cursor: 'help' }}>Size Distribution Filter</Text>
                            </Tooltip>
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
                    {/* Dynamic Analytical Header */}
                    <div style={{ marginBottom: 20, padding: '0 8px' }}>
                        <Text strong style={{ fontSize: 16, color: '#1890ff', display: 'block', marginBottom: 4 }}>
                            Analytical Insights & Guidance
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                            Configure the filters in the sidebar to perform a deep-dive analysis of your model's performance.
                            The values below update instantly based on your selection, allowing you to gain deep insights into
                            how the model performs on specific images, classes, or box sizes.
                        </Text>
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Tag color={(confRange[0] === 10 && confRange[1] === 100 && iouThreshold === 30 && sizeSlice === 'all' && selectedClasses.length === 0) ? "default" : "processing"} icon={<FilterOutlined />}>
                                {(confRange[0] === 10 && confRange[1] === 100 && iouThreshold === 30 && sizeSlice === 'all' && selectedClasses.length === 0)
                                    ? "Showing: Global Model Performance (Default)"
                                    : "Showing: Filtered Model Insights (Custom)"
                                }
                            </Tag>
                        </div>
                    </div>

                    {/* 5 KPI Cards - Deep Isolation Logic (Fixed Order) */}
                    <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0', background: '#f9f9f9' }}>
                                <Tooltip title="Density Score: Compares total AI detections to actual objects. Ideally 1.0. If > 1.0, the AI is 'over-reporting' and seeing objects that don't exist.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Detection Ratio</Text>
                                </Tooltip>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 18, color: '#000' }}>
                                        {isSplit ? `${kpis.aiGTRatio}x` : 'N/A'}
                                    </Text>
                                    <Tooltip title={`AI found ${tp + fp + ma} objects while there are only ${totalGT} actual objects in reality.`}>
                                        <Text type="secondary" style={{ fontSize: 9, cursor: 'help' }}>
                                            {isSplit ? `${tp + fp + ma} AI / ${totalGT} GT` : ''}
                                        </Text>
                                    </Tooltip>
                                </div>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #f6ffed', background: '#f6ffed', cursor: 'pointer' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: 'True Positive Detections',
                                    items: kpis.tpItems
                                })}
                            >
                                <Tooltip title="Correct Results: AI successfully found the right label with high confidence and precision. These are your reliable data points.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>True Positives</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                                    {isSplit ? kpis.tp : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #fff1f0', cursor: 'pointer', background: '#fff1f0' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: 'False Positive Detections',
                                    items: kpis.fpItems
                                })}
                            >
                                <Tooltip title="Incorrect Alarms: Cases where the AI reported an object, but nothing exists at that location. Raising 'Confidence' reduces these.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>False Positives</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 20, color: '#ff4d4f' }}>
                                    {isSplit ? kpis.fp : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #fff7e6', cursor: 'pointer', background: '#fff7e6' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: 'Misaligned Objects',
                                    items: kpis.maItems
                                })}
                            >
                                <Tooltip title="Accuracy Errors: The AI found the right object but placed the box inaccurately. Adjust the 'IoU' slider to set your precision standard.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Misaligned Objects</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 20, color: '#fa8c16' }}>
                                    {isSplit ? kpis.ma : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #fffbe6', cursor: 'pointer', background: '#fffbe6' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: 'Missed Ground Truth Objects',
                                    items: kpis.fnItems
                                })}
                            >
                                <Tooltip title="Unfound Objects: Actual objects the AI missed. 'Real' were never detected. 'Filtered' are hidden due to your current Confidence setting.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Missed Objects</Text>
                                </Tooltip>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 20, color: '#faad14' }}>
                                        {isSplit ? kpis.fn : 'N/A'}
                                    </Text>
                                    <Tooltip title={`'Real' (${kpis.fnReal}) were missed by the model. 'Filtered' (${kpis.fnFiltered}) were found but suppressed by your confidence settings.`}>
                                        <Text type="secondary" style={{ fontSize: 9, cursor: 'help' }}>
                                            {isSplit ? `${kpis.fnReal} Real / ${kpis.fnFiltered} Filtered` : ''}
                                        </Text>
                                    </Tooltip>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Tooltip title="Quality Score: Percentage of AI detections that were correct. High score means the model produces clean, reliable results.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Precision</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                                    {isSplit ? `${kpis.precision}%` : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Tooltip title="Completion Score: Percentage of actual objects successfully found. High score means the model is not missing things.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Recall</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#722ed1' }}>
                                    {isSplit ? `${kpis.recall}%` : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Tooltip title="Stability Score: A weighted balance of Quality and Completion. Use this single metric to track overall model health.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>F1 Score</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#13c2c2' }}>
                                    {isSplit ? `${kpis.f1}%` : 'N/A'}
                                </Text>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col span={12}>
                            <Card title={
                                <Tooltip title="Visualizes performance per class. 'Pass' is the ratio of True Positives to the total detections of that class.">
                                    <Space style={{ cursor: 'help' }}><BarChartOutlined /> Class Matrix</Space>
                                </Tooltip>
                            } size="small">
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
                            <Card title={
                                <Tooltip title="Shows how 'Yield' (model health) changes as you raise confidence. Steep drops mean the model is unconfident.">
                                    <Space style={{ cursor: 'help' }}><LineChartOutlined /> Stress Curve</Space>
                                </Tooltip>
                            } size="small">
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
            </Row >

            {/* Error Detail Modal */}
            < Modal
                title={
                    < Space >
                        <WarningOutlined style={{
                            color: errorModal.title.includes('True') ? '#52c41a' :
                                errorModal.title.includes('False') ? '#ff4d4f' :
                                    errorModal.title.includes('Misaligned') ? '#d46b08' : '#faad14'
                        }} />
                        {errorModal.title}
                        <Tag color={errorModal.title.includes('True') ? 'green' : 'default'}>{errorModal.items?.length || 0} Items</Tag>
                    </Space >
                }
                visible={errorModal.visible}
                onCancel={() => setErrorModal({ ...errorModal, visible: false })}
                footer={
                    [
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
                                                background: item.type === 'True Positive' ? '#52c41a20' :
                                                    item.type === 'False Positive' ? '#ff4d4f20' : '#faad1420',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: item.type === 'True Positive' ? '#52c41a' :
                                                    item.type === 'False Positive' ? '#ff4d4f' : '#faad14',
                                                fontWeight: 'bold', fontSize: '10px'
                                            }}>
                                                {item.type === 'True Positive' ? 'TP' :
                                                    item.type === 'False Positive' ? 'FP' :
                                                        item.type === 'Missed (Low Confidence)' ? 'FL' : 'FN'}
                                            </div>
                                        }
                                        title={
                                            <Space>
                                                {item.globalIdx && (
                                                    <Tag color={item.type === 'True Positive' ? "green" : "default"} style={{ fontWeight: 'bold' }}>
                                                        #{item.globalIdx}
                                                    </Tag>
                                                )}
                                                <Text strong>{item.imgName}</Text>
                                            </Space>
                                        }
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
            </Modal >
        </div >
    );
};

export default ChartsView;
