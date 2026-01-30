import React, { useState, useMemo, useEffect } from 'react';
import {
    Row, Col, Card, Space, Typography, Slider, Select,
    Tag, Tooltip, Empty, Descriptions, Divider, Modal, List, Button, Table, Badge, Segmented
} from 'antd';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart, Cell, Legend, ReferenceLine, Label, ReferenceArea,
    PieChart, Pie
} from 'recharts';
import {
    FilterOutlined,
    ColumnHeightOutlined,
    CloudSyncOutlined,
    DatabaseOutlined,
    BarChartOutlined,
    LineChartOutlined,
    WarningOutlined,
    BulbOutlined,
    SafetyCertificateOutlined,
    ArrowUpOutlined,
    OrderedListOutlined,
    PlusSquareOutlined,
    FullscreenOutlined,
    SearchOutlined,
    FundOutlined
} from '@ant-design/icons';

import { projectsAPI } from '../../../../../services/api';

const { Text, Title } = Typography;

/**
 * ChartsView Component - Simple White Edition
 * 
 * focuses on Confidence Slicer fix and clean white design.
 */
const ChartsView = ({ experiment, verifications = [], projectLabels = [], trainingClasses = [] }) => {
    const [confRange, setConfRange] = useState([10, 100]);
    const [iouThreshold, setIouThreshold] = useState(30); // New: Dynamic IOU (30 = 0.3)
    const [graph4Class, setGraph4Class] = useState('all');
    const [sizeSlice, setSizeSlice] = useState('all');
    const [selectedClasses, setSelectedClasses] = useState([]); // Empty = All
    const [stressStrategy, setStressStrategy] = useState('balanced'); // safe | balanced | aggressive
    const [spatialClass, setSpatialClass] = useState('all');
    const [spatialSize, setSpatialSize] = useState('all');

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

    const getFileName = (path) => path ? path.split(/[\/\\]/).pop() : '';

    // --- 📐 Data Processing ---
    const processedData = useMemo(() => {
        if (!experiment?.predictions) return null;

        // --- 0. Parse Metadata for Hashing & Normalize Keys ---
        let rawMeta = experiment.input_images || {};
        if (typeof rawMeta === 'string') {
            try { rawMeta = JSON.parse(rawMeta); } catch (e) { rawMeta = {}; }
        }
        const hashLookup = {};
        Object.entries(rawMeta).forEach(([path, hash]) => {
            hashLookup[getFileName(path)] = hash;
        });

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

        // --- 3. Human Verification Mapping & Triple-Match ---
        const vMap = {};
        const humanDiscoveries = [];
        const verifiedAlarms = [];
        const humanConfirmations = [];
        const humanMissing = [];

        verifications.forEach(v => {
            const vFile = getFileName(v.image_name);
            const vHash = v.image_hash_md5 || v.imageHashMd5;
            const targetHash = hashLookup[vFile];

            // Triple Match: ExpID (or name) + Name + Hash
            const isExpMatch = String(v.experiment_id) === String(experiment.id) ||
                (experiment.name && String(v.experiment_id) === String(experiment.name));

            const isIdentityMatch = isExpMatch && vFile && vHash === targetHash;

            if (isIdentityMatch) {
                const cls = (v.class_name || 'Unknown').replace(/^Class\s+/i, '');
                const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);
                if (!matchesClass) return;

                // Find matching AI detection in THIS experiment
                const predKey = Object.keys(experiment.predictions).find(k => getFileName(k) === vFile);
                const imgDets = experiment.predictions[predKey] || [];

                const matchedAI = imgDets.find(d =>
                    d.bbox && v.bbox &&
                    Math.abs(d.bbox[0] - v.bbox[0]) < 0.1 && Math.abs(d.bbox[1] - v.bbox[1]) < 0.1 &&
                    Math.abs(d.bbox[2] - v.bbox[2]) < 0.1 && Math.abs(d.bbox[3] - v.bbox[3]) < 0.1
                );

                if (matchedAI) {
                    // CRITICAL: Key must use AI's bbox so we can find it later in prediction loops
                    if (v.status === 'pass' || v.status === 'fail') {
                        vMap[`${vFile}|${matchedAI.bbox.join(',')}`] = v.status;
                    }
                } else if (v.status !== 'fail') {
                    // No AI match + Not 'fail' status = User manually marked a missing object
                    humanMissing.push({ ...v, type: 'Human Missing', class: cls });
                }
            }
        });

        let tpList = [];
        let fpList = [];
        let fnList = [];
        let simPoolTP = []; // GLOBAL POOL: Ignores confidence filter
        let simPoolFP = []; // GLOBAL POOL: Ignores confidence filter
        let totalGT = 0;
        let aiGTRatio = '0.00';

        const calcStats = (tp, fp, fn) => {
            const p = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
            const r = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
            const f1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;
            return { p: p.toFixed(1), r: r.toFixed(1), f1: f1.toFixed(1), pRaw: p, rRaw: r, f1Raw: f1 };
        };

        const isUploadMode = !qualityStats?.has_ground_truth;

        if (!isUploadMode) {
            // ELITE MODE: Use Backend matched lists (Split / Experiment mode)
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
                    // Find Global Index
                    const originalArray = experiment.predictions[d.image || d.imgName] || [];
                    const gIdx = originalArray.findIndex(orig =>
                        orig.bbox && d.bbox &&
                        orig.bbox[0] === d.bbox[0] && orig.bbox[1] === d.bbox[1] &&
                        orig.bbox[2] === d.bbox[2] && orig.bbox[3] === d.bbox[3]
                    );

                    const item = { ...d, type: 'True Positive', globalIdx: gIdx !== -1 ? gIdx + 1 : null };

                    // Add to Simulation Pool (Unfiltered by confidence)
                    if (iou >= iouThreshold) {
                        simPoolTP.push(item);
                    } else {
                        simPoolFP.push({ ...item, type: 'Misaligned', reason: 'Low IoU' });
                    }

                    if (conf >= confRange[0] && conf <= confRange[1]) {
                        if (iou >= iouThreshold) {
                            const vFile = getFileName(d.image || d.imgName);
                            const key = `${vFile}|${d.bbox.join(',')}`;
                            const status = vMap[key];
                            if (status === 'pass') humanConfirmations.push(item);
                            tpList.push(item);
                        } else {
                            fpList.push({ ...d, type: 'Misaligned', reason: 'Low IoU', globalIdx: gIdx !== -1 ? gIdx + 1 : null });
                        }
                    } else {
                        fnList.push({ ...d, type: 'Missed (Low Confidence)', globalIdx: gIdx !== -1 ? gIdx + 1 : null });
                    }
                }
            });

            // DENOMINATOR LOGIC: totalGT will be calculated below as the sum of (tp + ma + fn)
            // to ensure a perfectly closed math system where percentages sum to 100%.

            rawFP.forEach(d => {
                const conf = (d.confidence || 0) * 100;
                const rawCls = d.class || d.class_name || 'Unknown';
                const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
                const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);

                if (matchesClass) {
                    // Find Global Index
                    const originalArray = experiment.predictions[d.image || d.imgName] || [];
                    const gIdx = originalArray.findIndex(orig =>
                        orig.bbox && d.bbox &&
                        orig.bbox[0] === d.bbox[0] && orig.bbox[1] === d.bbox[1] &&
                        orig.bbox[2] === d.bbox[2] && orig.bbox[3] === d.bbox[3]
                    );

                    const vFile = getFileName(d.image || d.imgName);
                    const key = `${vFile}|${d.bbox.join(',')}`;
                    const status = vMap[key];
                    const item = { ...d, class: cls, globalIdx: gIdx !== -1 ? gIdx + 1 : null };

                    // Add to Simulation Pool (Regardless of filter)
                    if (status === 'pass') {
                        simPoolTP.push({ ...item, type: 'True Positive', source: 'human' });
                    } else {
                        simPoolFP.push({ ...item, type: 'False Positive', reason: 'No Match' });
                    }

                    if (conf >= confRange[0] && conf <= confRange[1]) {
                        if (status === 'pass') {
                            humanDiscoveries.push(item);
                            tpList.push({ ...item, type: 'True Positive', source: 'human' });
                        } else {
                            if (status === 'fail') verifiedAlarms.push(item);
                            fpList.push({ ...item, type: 'False Positive', reason: status === 'fail' ? 'Verified Alarm' : 'No Match' });
                        }
                    }
                }
            });

            // Combine backend reported missed objects with our confidence-suppressed ones
            // CRITICAL: Filter rawFN by selected class to ensure baseline counts are accurate.
            const filteredRawFN = rawFN.filter(d => {
                const rawCls = d.class || d.class_name || 'Unknown';
                const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
                return selectedClasses.length === 0 || selectedClasses.includes(cls);
            });
            fnList = [...fnList, ...filteredRawFN];
        } else {
            // EXCEPTION-BASED LOGIC for Uploads (Raw Data Audit)
            // We assume all AI detections are TP unless marked as FAIL or identified as Misaligned
            Object.entries(experiment.predictions).forEach(([imgName, dets]) => {
                if (!Array.isArray(dets)) return;
                const fileName = getFileName(imgName);

                dets.forEach(d => {
                    const conf = (d.confidence || 0) * 100;
                    const rawCls = d.class || d.class_name || 'Unknown';
                    const cls = typeof rawCls === 'string' ? rawCls.replace(/^Class\s+/i, '') : rawCls;
                    const matchesClass = selectedClasses.length === 0 || selectedClasses.includes(cls);

                    if (matchesClass) {
                        const originalArray = experiment.predictions[imgName] || [];
                        const gIdx = originalArray.findIndex(orig =>
                            orig.bbox && d.bbox &&
                            orig.bbox[0] === d.bbox[0] && orig.bbox[1] === d.bbox[1] &&
                            orig.bbox[2] === d.bbox[2] && orig.bbox[3] === d.bbox[3]
                        );

                        const key = `${fileName}|${d.bbox.join(',')}`;
                        const status = vMap[key];
                        const item = { ...d, class: cls, imgName: fileName, globalIdx: gIdx !== -1 ? gIdx + 1 : null };

                        // --- Add to Simulation Pool (Regardless of UI filters) ---
                        if (status === 'fail') {
                            simPoolFP.push({ ...item, type: 'False Positive', reason: 'Verified Alarm' });
                        } else {
                            simPoolTP.push({ ...item, type: 'True Positive' });
                        }

                        // --- UI Filtering Logic ---
                        if (conf >= confRange[0] && conf <= confRange[1]) {
                            if (status === 'fail') {
                                verifiedAlarms.push(item);
                                fpList.push({ ...item, type: 'False Positive', reason: 'Verified Alarm' });
                            } else {
                                if (status === 'pass') humanConfirmations.push(item);
                                tpList.push({ ...item, type: 'True Positive' });
                            }
                        } else if (conf >= 10) {
                            if (status !== 'fail') {
                                fnList.push({ ...d, class: cls, type: 'Missed (Low Confidence)' });
                            }
                        }
                    }
                });
            });

            // Missed objects in upload mode are solely from human manual marks
            fnList = [...humanMissing];

            // totalGT will be calculated as (tp + ma + fn) below for consistency.
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
        const filteredFN = isUploadMode
            ? fnList.filter(i => filterItem(i, true))
            : [...fnList.filter(i => filterItem(i, true)), ...humanMissing.filter(i => filterItem(i, true))];

        // Separating True False Positives from Misaligned ones
        const purelyFP = filteredFP.filter(i => i.type === 'False Positive');
        const misaligned = filteredFP.filter(i => i.type === 'Misaligned');

        // Separating Real FN (never detected) from Filtered FN (suppressed by confidence)
        const fnReal = filteredFN.filter(i => i.type !== 'Missed (Low Confidence)');
        const fnFiltered = filteredFN.filter(i => i.type === 'Missed (Low Confidence)');

        const filteredDiscoveries = humanDiscoveries.filter(i => filterItem(i));
        const filteredAlarms = verifiedAlarms.filter(i => filterItem(i));
        const filteredConfirmations = humanConfirmations.filter(i => filterItem(i));


        // --- 5. Metrics & Distributions ---
        const tp = filteredTP.length;
        const fp = purelyFP.length;
        const ma = misaligned.length;
        const fn = filteredFN.length;

        // THE "CLOSED SYSTEM" FIX: 
        // Total Reality = Things found correctly + Things found sloppily + Things completely missed.
        totalGT = tp + ma + fn;

        const globalMetrics = calcStats(tp, fp, fn);

        // Ratio Calculation: Total Detections vs Total Reality
        const totalDetections = tp + fp + ma;
        aiGTRatio = totalGT > 0 ? (totalDetections / totalGT).toFixed(2) : '0.00';

        const precision = globalMetrics.pRaw;
        const recall = globalMetrics.rRaw;
        const f1 = globalMetrics.f1Raw;

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
        filteredTP.forEach(d => {
            const cls = (d.class || d.class_name || 'Unknown').replace(/^Class\s+/i, '');
            if (!classStats[cls]) classStats[cls] = { name: cls, tp: 0, fp: 0, fn: 0 };
            classStats[cls].tp++;
        });
        filteredFP.forEach(d => {
            const cls = (d.class || d.class_name || 'Unknown').replace(/^Class\s+/i, '');
            if (!classStats[cls]) classStats[cls] = { name: cls, tp: 0, fp: 0, fn: 0 };
            classStats[cls].fp++;
        });
        filteredFN.forEach(d => {
            const cls = (d.class || d.class_name || 'Unknown').replace(/^Class\s+/i, '');
            if (!classStats[cls]) classStats[cls] = { name: cls, tp: 0, fp: 0, fn: 0 };
            classStats[cls].fn++;
        });

        const classTableData = Object.values(classStats).map(stat => {
            const m = calcStats(stat.tp, stat.fp, stat.fn);
            return { ...stat, precision: parseFloat(m.p), recall: parseFloat(m.r), f1: parseFloat(m.f1) };
        }).sort((a, b) => b.f1 - a.f1);


        // --- 7. INDUSTRIAL PERFORMANCE ENGINE (FINAL SPEC v1.0) ---
        // Constants from grqaph-finla.md
        const CONF_STEP = 0.05;
        const MIN_AUTOMATION = 0.15;
        const W_TP = 2, W_FP = 1, W_FN = 10;

        const pRows = [];
        const CONF_LIST = [];
        for (let t = CONF_STEP; t <= 0.951; t += CONF_STEP) CONF_LIST.push(parseFloat(t.toFixed(2)));

        // Greedy-like Simulation using pre-matched backend data
        const totalGTCount = simPoolTP.length + fnList.length;

        CONF_LIST.forEach(t => {
            const tTPs = simPoolTP.filter(d => (d.confidence || d.conf || 0) >= t);
            const tFPs = simPoolFP.filter(d => (d.confidence || d.conf || 0) >= t);

            const tpCount = tTPs.length;
            const fpCount = tFPs.length;
            const fnCount = Math.max(0, totalGTCount - tpCount);

            const automation = totalGTCount > 0 ? (tpCount / totalGTCount) : 0;
            const score = (W_TP * tpCount) - (W_FP * fpCount) - (W_FN * fnCount);
            const tpIoUs = tTPs.map(d => d.matched_iou || 0).filter(v => v > 0);

            pRows.push({ t, tp: tpCount, fp: fpCount, fn: fnCount, automation, score, tpIoUs });
        });

        // 7.1 Silent zones (automation < 15%)
        const silentZones = [];
        let currentZone = null;
        pRows.forEach(r => {
            if (r.automation < MIN_AUTOMATION) {
                if (!currentZone) currentZone = { from: r.t, to: r.t };
                else currentZone.to = r.t;
            } else {
                if (currentZone) { silentZones.push(currentZone); currentZone = null; }
            }
        });
        if (currentZone) silentZones.push(currentZone);

        // 7.2 Model Ceiling (Industrial Stablility Rule)
        const validRows = pRows.filter(r => r.automation >= MIN_AUTOMATION);
        let modelCeiling = { t: null, drop: 0, rule: 'fallback' };
        if (validRows.length >= 2) {
            const aMax = Math.max(...validRows.map(r => r.automation));
            const dropTrigger = Math.max(0.10, 0.25 * aMax);

            let firstMaterialDrop = null;
            let maxDrop = { t: null, val: -1 };

            for (let i = 0; i < validRows.length - 1; i++) {
                const drop = validRows[i].automation - validRows[i + 1].automation;

                // Track max drop for fallback
                if (drop > maxDrop.val) {
                    maxDrop = { t: validRows[i + 1].t, val: drop };
                }

                // Stage B: Find EARLIEST material collapse
                if (!firstMaterialDrop && drop >= dropTrigger) {
                    firstMaterialDrop = { t: validRows[i + 1].t, val: drop };
                }
            }

            if (firstMaterialDrop) {
                modelCeiling = { t: firstMaterialDrop.t, drop: firstMaterialDrop.val, rule: 'material' };
            } else {
                modelCeiling = { t: maxDrop.t, drop: maxDrop.val, rule: 'fallback' };
            }
        }

        // 7.3 Mode Logic (Expert System v2)
        let productionChosen = null;
        if (validRows.length > 0) {
            productionChosen = validRows.reduce((prev, curr) => (curr.score >= prev.score) ? curr : prev);
        }

        let retrainTargets = null;
        if (validRows.length > 0) {
            const preWall = modelCeiling.t !== null ? validRows.filter(r => r.t <= modelCeiling.t) : validRows;
            const targetRow = preWall.reduce((prev, curr) => (curr.score >= prev.score) ? curr : prev);
            const p75 = (arr) => {
                if (!arr || arr.length === 0) return 0;
                const sorted = [...arr].sort((a, b) => a - b);
                const pos = (sorted.length - 1) * 0.75;
                const base = Math.floor(pos);
                if (sorted[base + 1] !== undefined) return sorted[base] + (pos - base) * (sorted[base + 1] - sorted[base]);
                return sorted[base];
            };
            retrainTargets = { confidence: targetRow.t, iou: p75(targetRow.tpIoUs), row: targetRow };
        }

        const generateBriefing = (mode) => {
            if (validRows.length === 0) {
                // FAILURE ANALYSIS (Industrial Honest)
                const bullets = [
                    "Hard rule: below 15% Automation is REJECTED ⚠️ (Silent Model).",
                    "No deployable threshold found: automation never reaches 15% at any confidence.",
                    "This is a Silent Model: the system cannot deliver operational utility.",
                    "Next action: retraining required (increase recall/coverage)."
                ];
                const minConfRow = pRows.find(r => r.t === CONF_STEP);
                if (minConfRow) {
                    if (minConfRow.tp === 0) bullets.push("Model is blind: produces no correct matches even at minimum confidence.");
                    else bullets.push("Model is weak: produces some matches but far below the utility floor.");
                }
                return bullets;
            }

            const bullets = ["Hard rule: below 15% Automation is REJECTED ⚠️ (Silent Model)."];
            if (mode === 'production' && productionChosen) {
                const c = productionChosen;
                const ceilingT = modelCeiling.t !== null ? (modelCeiling.t * 100).toFixed(0) : 'N/A';
                bullets.push(`MODEL CEILING 🛑 at ~${ceilingT}%: TP collapses beyond this point.`);
                bullets.push(`Production setting: ${(c.t * 100).toFixed(0)}% confidence.`);
                bullets.push(`At ${(c.t * 100).toFixed(0)}%: TP=${c.tp}, FP=${c.fp}, FN=${c.fn} → Automation=${(c.automation * 100).toFixed(0)}%.`);

                // Neighbor Deltas
                const tLow = parseFloat((c.t - CONF_STEP).toFixed(2));
                const tHigh = parseFloat((c.t + CONF_STEP).toFixed(2));
                const rLow = pRows.find(r => r.t === tLow);
                const rHigh = pRows.find(r => r.t === tHigh);

                if (rLow) {
                    const dtp_down = rLow.tp - c.tp;
                    const dfp_down = rLow.fp - c.fp;
                    if (dfp_down > dtp_down) {
                        bullets.push(`Why not lower (${(tLow * 100).toFixed(0)}%): FP rises faster than TP (more false alarms than value).`);
                    } else {
                        bullets.push(`Why not lower (${(tLow * 100).toFixed(0)}%): only small TP gain with higher FP cost.`);
                    }
                }
                if (rHigh) {
                    bullets.push(`Why not higher (${(tHigh * 100).toFixed(0)}%): FN increases and Automation drops (more missed defects).`);
                }

            } else if (retrainTargets) {
                const rt = retrainTargets;
                if (modelCeiling.t !== null) {
                    bullets.push(`MODEL CEILING 🛑 at ~${(modelCeiling.t * 100).toFixed(0)}% (Automation drop ${(modelCeiling.drop * 100).toFixed(0)}%).`);
                }
                bullets.push(`TargetConfidence (pre-wall): ${(rt.confidence * 100).toFixed(0)}% (best usable region before collapse).`);
                bullets.push(`At ${(rt.confidence * 100).toFixed(0)}%: TP=${rt.row.tp}, FP=${rt.row.fp}, FN=${rt.row.fn} → Automation=${(rt.row.automation * 100).toFixed(0)}%.`);

                if (rt.iou > 0) bullets.push(`TargetIoU: ${rt.iou.toFixed(2)} (box quality goal for next training).`);
                else bullets.push("TargetIoU: not available (not enough matched TP IoUs).");

                if (rt.row.fn / totalGTCount > 0.50) {
                    bullets.push("Diagnosis: Recall/Coverage limit (many missed defects).");
                } else {
                    bullets.push("Diagnosis: Improve confidence strength to push ceiling right.");
                }
            }


            return bullets;
        };

        const engineState = {
            gt_total: totalGTCount, rows: pRows, silent_zones: silentZones,
            model_ceiling: modelCeiling, production: productionChosen, retrain: retrainTargets,
            briefing: { production: generateBriefing('production'), retrain: generateBriefing('retrain') },
            status: validRows.length > 0 ? 'ok' : 'no_recommendation'
        };

        // --- 7.3 SCALED STRESS FINGERPRINT (NEW GRAPH 4) ---
        // Run parallel simulations for each size group (Tiny, Small, Medium, Large)
        const sizePoolTP = graph4Class === 'all' ? simPoolTP : simPoolTP.filter(d => (d.class || d.class_name || '').replace(/^Class\s+/i, '') === graph4Class);
        const sizePoolFP = graph4Class === 'all' ? simPoolFP : simPoolFP.filter(d => (d.class || d.class_name || '').replace(/^Class\s+/i, '') === graph4Class);
        const sizePoolFN = graph4Class === 'all' ? fnList : fnList.filter(d => (d.class || d.class_name || '').replace(/^Class\s+/i, '') === graph4Class);

        const sizeStressData = CONF_LIST.map(t => {
            const row = { t };
            ['tiny', 'small', 'medium', 'large'].forEach(sz => {
                const szTPs = sizePoolTP.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || d.conf || 0) >= t);
                const szGT = sizePoolTP.filter(d => getSizeGrp(d.bbox) === sz).length +
                    sizePoolFN.filter(d => getSizeGrp(d.bbox) === sz).length;

                row[`${sz}_yield`] = szGT > 0 ? parseFloat(((szTPs.length / szGT) * 100).toFixed(1)) : 0;

                // Calculate Average IoU for this size at this threshold
                const ious = szTPs.map(d => d.matched_iou || 0).filter(v => v > 0);
                row[`${sz}_iou`] = ious.length > 0 ? parseFloat(((ious.reduce((a, b) => a + b, 0) / ious.length) * 100).toFixed(1)) : 0;
            });
            return row;
        });

        // --- 7.4 SPATIAL FAILURE MAPPING (PRO MAX UPGRADE) ---
        // 1. Find the bounds of the coordinate system (normalizing pixels to 0-1)
        let maxX = 1, maxY = 1;
        [...simPoolTP, ...simPoolFP, ...fnList].forEach(d => {
            if (d.bbox) {
                maxX = Math.max(maxX, d.bbox[2]);
                maxY = Math.max(maxY, d.bbox[3]);
            }
        });

        const spatialGrid = Array(9).fill(0).map(() => ({ fp: 0, fn: 0, total: 0 }));

        // Sub-filter by LOCAL Graph 5 controls
        const spatialErrors = [...purelyFP, ...filteredFN].filter(d => {
            const cls = d.class || d.class_name;
            const pureCls = typeof cls === 'string' ? cls.replace(/^Class\s+/i, '') : cls;
            const matchesClass = spatialClass === 'all' || pureCls === spatialClass;
            const matchesSize = spatialSize === 'all' || getSizeGrp(d.bbox, q25, q50, q75) === spatialSize;
            return matchesClass && matchesSize;
        });

        spatialErrors.forEach(d => {
            if (d.bbox) {
                const cx = (d.bbox[0] + d.bbox[2]) / 2;
                const cy = (d.bbox[1] + d.bbox[3]) / 2;
                const col = Math.min(2, Math.floor((cx / maxX) * 3));
                const row = Math.min(2, Math.floor((cy / maxY) * 3));
                const idx = row * 3 + col;
                if (idx >= 0 && idx < 9) {
                    if (d.type === 'False Positive' || d.reason === 'No Match') spatialGrid[idx].fp++;
                    else spatialGrid[idx].fn++;
                    spatialGrid[idx].total++;
                }
            }
        });

        const totalErrors = spatialErrors.length || 1;
        const spatialData = spatialGrid.map(tile => ({
            ...tile,
            density: parseFloat(((tile.total / totalErrors) * 100).toFixed(1))
        }));

        // --- 8. AI Detection Health Score ---
        const gStats = calcStats(filteredTP.length, purelyFP.length, filteredFN.length);
        const accuracyScore = gStats.f1Raw / 100;
        const autonomyPenalty = (humanDiscoveries.length + humanMissing.length) / Math.max(totalGT, 1);
        const autonomyScore = Math.max(0, 1 - autonomyPenalty);
        const alignmentPenalty = misaligned.length / Math.max(totalGT, 1);
        const alignmentScore = Math.max(0, 1 - alignmentPenalty);

        const healthScore = Math.min(100, Math.max(0, (
            (accuracyScore * 0.7) +
            (autonomyScore * 0.2) +
            (alignmentScore * 0.1)
        ) * 100));

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
                discoveries: filteredDiscoveries.length,
                verifiedAlarms: filteredAlarms.length,
                confirmations: filteredConfirmations.length,
                humanMissing: humanMissing.filter(i => filterItem(i, true)).length,
                fnReal: fnReal.length,
                fnFiltered: fnFiltered.length,
                precision: globalMetrics.p,
                recall: globalMetrics.r,
                f1: globalMetrics.f1,
                sizeDistrib,
                engineState,
                tpItems: filteredTP.map(i => ({ ...i, imgName: i.image || i.imgName })),
                fpItems: purelyFP.map(i => ({ ...i, imgName: i.image || i.imgName })),
                maItems: misaligned.map(i => ({ ...i, imgName: i.image || i.imgName })),
                fnItems: filteredFN.map(i => ({ ...i, imgName: i.image || i.imgName || i.image_name })),
                discoveryItems: filteredDiscoveries.map(i => ({ ...i, imgName: i.image || i.imgName })),
                alarmItems: filteredAlarms.map(i => ({ ...i, imgName: i.image || i.imgName })),
                confirmationItems: filteredConfirmations.map(i => ({ ...i, imgName: i.image || i.imgName })),
                missingItems: humanMissing.filter(i => filterItem(i, true)).map(i => ({ ...i, type: 'Human Missing', imgName: (i.image || i.imgName || i.image_name || '').split('/').pop() })),
                isUploadMode,
                healthScore: healthScore.toFixed(1),
                sizeStressData,
                spatialData,
                spatialTotal: spatialErrors.length,
                spatialTotalRaw: purelyFP.length + filteredFN.length,
                outcomeData: [
                    { name: 'Successful Matches', value: tp, color: '#52c41a', key: 'tp' },
                    { name: 'Misaligned Objects', value: ma, color: '#fa8c16', key: 'ma' },
                    { name: 'Undetected (Missed)', value: fn, color: '#faad14', key: 'fn' }
                ].filter(i => isUploadMode ? i.key !== 'ma' : true),
                roiData: [
                    { name: 'Confirmations', value: filteredConfirmations.length, color: '#1890ff', key: 'conf' },
                    { name: 'Discoveries', value: filteredDiscoveries.length, color: '#52c41a', key: 'disc' },
                    { name: 'False Alarms', value: filteredAlarms.length, color: '#ff4d4f', key: 'alarm' },
                    { name: 'Human Misses', value: humanMissing.filter(i => filterItem(i, true)).length, color: '#faad14', key: 'miss' }
                ].filter(i => i.value > 0)
            },
            classChart: classTableData,
            availableClasses: Array.from(availableClasses).filter(c => trainingClasses.length > 0 ? trainingClasses.includes(c) : true)
        };
    }, [experiment, verifications, qualityStats, selectedClasses, trainingClasses, sizeSlice, confRange, iouThreshold, stressStrategy, graph4Class, spatialClass, spatialSize]);

    if (!processedData) return <Empty />;

    const { kpis, classChart, curveData, availableClasses } = processedData;
    const { tp, fp, ma, fn, totalGT, discoveries, verifiedAlarms, humanMissing } = kpis;

    return (
        <div style={{ padding: '24px', background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <style>{`
                /* Global HUD Overrides */
                .hud-card { 
                    background: rgba(20, 20, 20, 0.8) !important; 
                    border: 1px solid #303030 !important; 
                    border-radius: 4px !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                }
                .hud-card .ant-card-head { border-bottom: 1px solid #303030 !important; background: #141414 !important; }
                .hud-card .ant-card-head-title { color: #00f2ff !important; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; }
                
                .hud-sidebar-label { color: #aaa !important; font-size: 10px !important; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px !important; display: block; font-weight: 700; }
                
                /* Select & Slider HUD Styling */
                .hud-select .ant-select-selector { 
                    background: #141414 !important; 
                    border: 1px solid #333 !important; 
                    color: #fff !important;
                    border-radius: 4px !important;
                }
                .hud-select .ant-select-selection-placeholder { color: #555 !important; }
                .hud-select.ant-select-focused .ant-select-selector { border-color: #00f2ff !important; box-shadow: 0 0 5px rgba(0, 242, 255, 0.2) !important; }
                
                .hud-slider .ant-slider-track { background-color: #00f2ff !important; }
                .hud-slider .ant-slider-handle { border-color: #00f2ff !important; background-color: #141414 !important; }
                .hud-slider .ant-slider-rail { background-color: #222 !important; }
                
                .hud-tag-neon { 
                    background: rgba(0, 242, 255, 0.1) !important; 
                    border: 1px solid #00f2ff !important; 
                    color: #00f2ff !important; 
                    font-family: 'JetBrains Mono', monospace;
                    font-weight: bold;
                }
            `}</style>
            <Row gutter={[24, 24]}>
                {/* --- Sidebar (PRO HUD CONSOLE) --- */}
                <Col xs={24} lg={6}>
                    <Card size="small" className="hud-card" style={{ marginBottom: 16 }}>
                        <div style={{ padding: '8px 4px' }}>
                            <Text className="hud-sidebar-label">Active Channel</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 4 }}>
                                {isSplit ? <CloudSyncOutlined style={{ color: '#00f2ff' }} /> : <DatabaseOutlined style={{ color: '#faad14' }} />}
                                <Text strong style={{ fontSize: 13, color: '#fff' }}>{isSplit ? 'SPLIT: ' + experiment.dataset_path?.split('/').pop()?.toUpperCase() : 'MANUAL_UPLOAD'}</Text>
                            </div>
                        </div>

                        <Divider style={{ margin: '16px 0', borderTopColor: '#222' }} />

                        <div style={{ marginBottom: 20 }}>
                            <Tooltip title="Select specific object classes to analyze.">
                                <Text className="hud-sidebar-label">Class Filter [Isolate]</Text>
                            </Tooltip>
                            <Select
                                mode="multiple"
                                className="hud-select"
                                style={{ width: '100%' }}
                                placeholder="ALL_CLASSES_ACTIVE"
                                value={selectedClasses}
                                onChange={setSelectedClasses}
                                allowClear
                                maxTagCount="responsive"
                            >
                                {availableClasses.map(c => (
                                    <Select.Option key={c} value={c}>{c.toUpperCase()}</Select.Option>
                                ))}
                            </Select>
                        </div>

                        <Divider style={{ margin: '16px 0', borderTopColor: '#222' }} />

                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text className="hud-sidebar-label">Confidence Threshold</Text>
                                <Tag className="hud-tag-neon" style={{ margin: 0 }}>{(confRange[0] / 100).toFixed(2)} - {(confRange[1] / 100).toFixed(2)}</Tag>
                            </div>
                            <Slider
                                range
                                className="hud-slider"
                                min={0}
                                max={100}
                                value={confRange}
                                onChange={setConfRange}
                                tipFormatter={v => (v / 100).toFixed(2)}
                            />
                        </div>

                        {!kpis.isUploadMode && (
                            <>
                                <Divider style={{ margin: '16px 0', borderTopColor: '#222' }} />
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text className="hud-sidebar-label">Alignment [IoU] Threshold</Text>
                                        <Tag className="hud-tag-neon" style={{ margin: 0, borderColor: '#faad14', color: '#faad14', background: 'rgba(250, 173, 20, 0.1)' }}>{(iouThreshold / 100).toFixed(2)}+</Tag>
                                    </div>
                                    <Slider
                                        className="hud-slider"
                                        style={{ accentColor: '#faad14' }}
                                        min={10}
                                        max={90}
                                        value={iouThreshold}
                                        onChange={setIouThreshold}
                                        tipFormatter={v => (v / 100).toFixed(2)}
                                    />
                                </div>
                            </>
                        )}

                        <Divider style={{ margin: '16px 0', borderTopColor: '#222' }} />

                        <div>
                            <Text className="hud-sidebar-label">Scale Distribution [Global]</Text>
                            <div style={{ height: 160, marginTop: 12 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[
                                            { name: 'T', value: kpis.sizeDistrib?.tiny || 0, key: 'tiny' },
                                            { name: 'S', value: kpis.sizeDistrib?.small || 0, key: 'small' },
                                            { name: 'M', value: kpis.sizeDistrib?.medium || 0, key: 'medium' },
                                            { name: 'L', value: kpis.sizeDistrib?.large || 0, key: 'large' }
                                        ]}
                                        onClick={(data) => {
                                            if (data && data.activePayload && data.activePayload.length > 0) {
                                                const key = data.activePayload[0].payload.key;
                                                setSizeSlice(sizeSlice === key ? 'all' : key);
                                            }
                                        }}
                                    >
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis hide domain={[0, 'auto']} />
                                        <RechartsTooltip
                                            contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 4 }}
                                            itemStyle={{ color: '#00f2ff', fontSize: 10 }}
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        />
                                        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                            {
                                                ['tiny', 'small', 'medium', 'large'].map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={(sizeSlice === entry || sizeSlice === 'all') ? '#00f2ff' : '#262626'}
                                                        style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                                                    />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                                <Tag
                                    className="hud-tag-neon"
                                    style={{
                                        cursor: 'pointer',
                                        opacity: sizeSlice === 'all' ? 0.3 : 1,
                                        fontSize: 9,
                                        padding: '0 12px'
                                    }}
                                    onClick={() => setSizeSlice('all')}
                                >
                                    RESET_SCALE_SCAN
                                </Tag>
                            </div>
                        </div>
                    </Card>
                </Col>

                {/* --- Main Section (MISSION_CONTROL) --- */}
                <Col xs={24} lg={18}>
                    {/* Dynamic Analytical Header */}
                    <div style={{ marginBottom: 24, padding: '0 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 8 }}>
                            <div style={{ width: 4, height: 18, background: '#00f2ff', borderRadius: 2 }} />
                            <Text strong style={{ fontSize: 18, color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Inter, sans-serif' }}>
                                Analytical Performance HUD
                            </Text>
                        </div>
                        <Text style={{ fontSize: 13, display: 'block', color: '#8c8c8c', lineHeight: '1.6', maxWidth: '800px' }}>
                            Perform deep-dive telemetry analysis of model performance. Use the <Text code style={{ background: '#1c1c1c', color: '#00f2ff', border: 'none' }}>SYSTEM_CONSOLE</Text> on the left
                            to isolate specific blindspots across classes and object scales.
                        </Text>
                        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Tag
                                className="hud-tag-neon"
                                icon={<FilterOutlined />}
                                style={{ borderRadius: 20, padding: '2px 16px' }}
                            >
                                {(confRange[0] === 10 && confRange[1] === 100 && iouThreshold === 30 && sizeSlice === 'all' && selectedClasses.length === 0)
                                    ? "STATUS: GLOBAL_NOMINAL"
                                    : "STATUS: SUB_TELEMETRY_LIVE"
                                }
                            </Tag>
                        </div>
                    </div>

                    {/* MISSION_CONTROL_KPI_PANEL (UNIFIED READOUTS) */}
                    <Card size="small" className="hud-card" bodyStyle={{ padding: '0 12px' }} style={{ marginBottom: 16 }}>
                        <Row align="middle" gutter={0}>
                            {/* 1. HEALTH */}
                            <Col flex="1" style={{ borderRight: '1px solid #222', padding: '12px 16px', textAlign: 'center' }}>
                                <Tooltip title="Overall quality of predictions based on TP, FP, and FN.">
                                    <Text className="hud-sidebar-label" style={{ marginBottom: 4 }}>Quality Score</Text>
                                </Tooltip>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                                    <Text strong style={{ fontSize: 22, color: kpis.healthScore >= 80 ? '#52c41a' : (kpis.healthScore >= 60 ? '#faad14' : '#ff4d4f'), fontFamily: 'JetBrains Mono' }}>
                                        {kpis.healthScore}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: '#aaa' }}>%</Text>
                                </div>
                                <Badge
                                    status={kpis.healthScore >= 80 ? 'success' : (kpis.healthScore >= 60 ? 'warning' : 'error')}
                                    text={<Text style={{ fontSize: 8, color: '#888' }}>{kpis.healthScore >= 80 ? 'NOMINAL' : (kpis.healthScore >= 60 ? 'CAUTION' : 'CRITICAL')}</Text>}
                                />
                            </Col>

                            {/* 2. RATIO */}
                            <Col flex="1" style={{ borderRight: '1px solid #222', padding: '12px 16px', textAlign: 'center' }}>
                                <Tooltip title="Ratio of AI detections vs Reference objects. Ideal is 1.0.">
                                    <Text className="hud-sidebar-label" style={{ marginBottom: 4 }}>Detection Ratio</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 20, color: '#fff', fontFamily: 'JetBrains Mono' }}>{kpis.aiGTRatio}x</Text>
                                <div style={{ fontSize: 9, color: '#888' }}>{kpis.isUploadMode ? `${tp + fp} AI / ${totalGT} TRUTH` : `${tp + fp + ma} AI / ${totalGT} GT`}</div>
                            </Col>

                            {/* 3. TRUE POSITIVES (SUCCESS) */}
                            <Col flex="1" style={{ borderRight: '1px solid #222', padding: '12px 16px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.3s' }}
                                className="hud-readout-hover"
                                onClick={() => setErrorModal({ visible: true, title: 'TRUE_POSITIVE_TELEMETRY', items: kpis.tpItems })}>
                                <Tooltip title="Correct AI detections (successful matches). Click to view details.">
                                    <Text className="hud-sidebar-label" style={{ marginBottom: 4, color: '#52c41a' }}>True Positives</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 22, color: '#52c41a', fontFamily: 'JetBrains Mono' }}>{kpis.tp}</Text>
                                <div style={{ fontSize: 8, color: '#52c41a', opacity: 0.6 }}>CONFIRMED_GOOD</div>
                            </Col>

                            {/* 4. FALSE POSITIVES (ERRORS) */}
                            <Col flex="1" style={{ borderRight: '1px solid #222', padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}
                                className="hud-readout-hover"
                                onClick={() => setErrorModal({ visible: true, title: 'FALSE_POSITIVE_TELEMETRY', items: kpis.fpItems })}>
                                <Tooltip title="Incorrect AI detections (objects identified where none exist). Click to view details.">
                                    <Text className="hud-sidebar-label" style={{ marginBottom: 4, color: '#ff4d4f' }}>False Positives</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 22, color: '#ff4d4f', fontFamily: 'JetBrains Mono' }}>{kpis.fp}</Text>
                                <div style={{ fontSize: 8, color: '#ff4d4f', opacity: 0.6 }}>INCORRECT_FINDS</div>
                            </Col>

                            {/* 5. MISALIGNED (IF APPLICABLE) */}
                            {!kpis.isUploadMode && (
                                <Col flex="1" style={{ borderRight: '1px solid #222', padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}
                                    className="hud-readout-hover"
                                    onClick={() => setErrorModal({ visible: true, title: 'ACCURACY_DEVIATION', items: kpis.maItems })}>
                                    <Tooltip title="AI Detections correctly localized but with inaccurate bounding box coordinates. Click to view details.">
                                        <Text className="hud-sidebar-label" style={{ marginBottom: 4, color: '#fa8c16' }}>Misaligned</Text>
                                    </Tooltip>
                                    <Text strong style={{ fontSize: 22, color: '#fa8c16', fontFamily: 'JetBrains Mono' }}>{kpis.ma}</Text>
                                    <div style={{ fontSize: 8, color: '#fa8c16', opacity: 0.6 }}>MISALIGNED_BOX</div>
                                </Col>
                            )}

                            {/* 6. MISSED (BLINDSPOTS) */}
                            <Col flex="1" style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}
                                className="hud-readout-hover"
                                onClick={() => setErrorModal({ visible: true, title: 'BLINDSPOT_TELEMETRY', items: kpis.fnItems })}>
                                <Tooltip title="Objects that the AI failed to detect entirely. Click to view details.">
                                    <Text className="hud-sidebar-label" style={{ marginBottom: 4, color: '#faad14' }}>Missed Objects</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 22, color: '#faad14', fontFamily: 'JetBrains Mono' }}>{kpis.fn}</Text>
                                <div style={{ fontSize: 8, color: '#faad14', opacity: 0.6 }}>UNFOUND_GT</div>
                            </Col>
                        </Row>
                        <style>{`
                            .hud-readout-hover:hover { background: rgba(255,255,255,0.03); }
                        `}</style>
                    </Card>

                    <Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #e6f7ff', background: '#f0f9ff' }}>
                                <Tooltip title={kpis.isUploadMode
                                    ? "Quality Audit: Percentage of AI detections you agreed with. Shows how 'clean' the model is on new images."
                                    : "Quality Score: Percentage of AI detections that were correct."}>
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Precision</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                                    {`${kpis.precision}%`}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f9f0ff', background: '#f9f0ff' }}>
                                <Tooltip title={kpis.isUploadMode
                                    ? "Coverage Audit: Percentage of real objects successfully found. Shows how 'blind' the model is to new defects."
                                    : "Completion Score: Percentage of actual objects successfully found."}>
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Recall</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#722ed1' }}>
                                    {`${kpis.recall}%`}
                                </Text>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #e6fffb', background: '#e6fffb' }}>
                                <Tooltip title="Stability Score: A weighted balance of Quality and Coverage. Use this to track the overall model performance on this dataset.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>F1 Score</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#13c2c2' }}>
                                    {`${kpis.f1}%`}
                                </Text>
                            </Card>
                        </Col>
                    </Row>

                    {/* GRAPH 2: AI FINDINGS VS. MISSES (PRO_RECAP) */}
                    <Card
                        size="small"
                        className="hud-card"
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BarChartOutlined style={{ color: '#00f2ff' }} />
                                    <Text strong style={{ color: '#fff', fontSize: 11, letterSpacing: '1px' }}>AI FINDINGS VS. MISSES (OUTCOME RECAP)</Text>
                                </div>
                                <Tag className="hud-tag-neon" style={{ margin: 0 }}>TOTAL_TRUTH: {totalGT} OBJECTS</Tag>
                            </div>
                        }
                        style={{ marginBottom: 24 }}
                    >
                        <div style={{ padding: '8px 0' }}>
                            <div style={{ display: 'flex', height: 40, border: '1px solid #333', borderRadius: 4, overflow: 'hidden', background: '#141414' }}>
                                {kpis.outcomeData.map((seg, idx) => (
                                    <Tooltip key={idx} title={`${seg.name}: ${seg.value}`}>
                                        <div style={{
                                            width: `${totalGT > 0 ? (seg.value / totalGT) * 100 : 0}%`,
                                            background: seg.color,
                                            opacity: 0.85,
                                            height: '100%',
                                            transition: 'flex 0.5s ease'
                                        }} />
                                    </Tooltip>
                                ))}
                            </div>

                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '24px' }}>
                                {kpis.outcomeData.map((seg, idx) => {
                                    const pct = totalGT > 0 ? (seg.value / totalGT) * 100 : 0;
                                    return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: 8, height: 8, border: `2px solid ${seg.color}`, borderRadius: '50%' }} />
                                            <Text style={{ fontSize: 10, color: '#aaa', fontFamily: 'JetBrains Mono' }}>
                                                {seg.name}: <span style={{ color: '#fff', fontWeight: 'bold' }}>{seg.value}</span> ({pct.toFixed(0)}%)
                                            </Text>
                                        </div>
                                    )
                                })}
                            </div>

                            <Divider style={{ margin: '16px 0', borderTopColor: '#222' }} />

                            <div style={{
                                padding: '12px',
                                background: '#0a0a0a',
                                borderLeft: '3px solid #00f2ff',
                                borderRadius: '0 4px 4px 0',
                                fontFamily: 'monospace'
                            }}>
                                <Text style={{ fontSize: 11, color: '#aaa', lineHeight: '1.6' }}>
                                    {(() => {
                                        const fnPct = totalGT > 0 ? (kpis.fn / totalGT) * 100 : 0;
                                        const maPct = totalGT > 0 ? (kpis.ma / totalGT) * 100 : 0;
                                        const tpPct = totalGT > 0 ? (kpis.tp / totalGT) * 100 : 0;

                                        if (totalGT === 0) return <span>[STATUS: INCOMPLETE] NO_GT_SAMPLES_DETECTED. Analyze label configuration.</span>;
                                        if (fnPct > 80) return <span style={{ color: '#ff4d4f' }}>[STATUS: CRITICAL] TOTAL_COVERAGE_FAILURE: Model is functionally BLIND. Check training data.</span>;
                                        if (maPct > 20) return <span style={{ color: '#fa8c16' }}>[STATUS: WARNING] ALIGNMENT_DRIFT: {maPct.toFixed(0)}% accuracy deviation. Tune anchor resolution.</span>;
                                        if (tpPct > 85 && maPct < 5) return <span style={{ color: '#52c41a' }}>[STATUS: OPTIMAL] ELITE_PERFORMANCE: High alignment stability achieved. Fully Autonomous capable.</span>;

                                        return <span style={{ color: '#00f2ff' }}>[STATUS: NOMINAL] RELIABLE_TELEMETRY: Operation shows high alignment stability with current baseline.</span>;
                                    })()}
                                </Text>
                            </div>
                        </div>
                    </Card>

                    {/* GRAPH 3: ROI & VERIFICATION (TELEMETRY LOG) */}
                    {(discoveries > 0 || verifiedAlarms > 0 || humanMissing > 0 || kpis.confirmations > 0) && (
                        <Card
                            size="small"
                            className="hud-card"
                            headStyle={{ background: '#1c1c1c' }}
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FundOutlined style={{ color: '#00f2ff' }} />
                                    <Text strong style={{ color: '#fff', fontSize: 11, letterSpacing: '1px' }}>EXPERT VERIFICATION TELEMETRY (ROI LOG)</Text>
                                </div>
                            }
                            style={{ marginBottom: 24 }}
                        >
                            <div style={{ display: 'flex', gap: '32px', alignItems: 'center', padding: '12px 8px' }}>
                                {/* Left Side: HUD Donut */}
                                <div style={{ width: 120, textAlign: 'center' }}>
                                    <div style={{ height: 100, position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={kpis.roiData}
                                                    innerRadius={32}
                                                    outerRadius={45}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {kpis.roiData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                            <Text strong style={{ fontSize: 18, color: '#fff', display: 'block', fontFamily: 'JetBrains Mono' }}>
                                                {kpis.roiData.reduce((acc, curr) => acc + curr.value, 0)}
                                            </Text>
                                            <Text style={{ fontSize: 7, color: '#aaa', letterSpacing: '1px' }}>SAMPLES</Text>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Telemetry Readouts */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                                        <Text type="secondary" style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetry Stream: Model "Mark"</Text>
                                        <Space split={<Divider type="vertical" style={{ borderColor: '#333' }} />} size={0}>
                                            {[
                                                { label: 'CONF', val: kpis.confirmations, color: '#1890ff', title: 'Confirmations' },
                                                { label: 'DISC', val: discoveries, color: '#52c41a', title: 'Discoveries' },
                                                { label: 'ALRM', val: verifiedAlarms, color: '#ff4d4f', title: 'Alarms' },
                                                { label: 'MISS', val: humanMissing, color: '#faad14', title: 'Misses' }
                                            ].map((stat, i) => (
                                                <div key={i} style={{ padding: '0 12px', textAlign: 'center', cursor: 'pointer' }}
                                                    onClick={() => setErrorModal({ visible: true, title: stat.title.toUpperCase(), items: stat.label === 'CONF' ? kpis.confirmationItems : (stat.label === 'DISC' ? kpis.discoveryItems : (stat.label === 'ALRM' ? kpis.alarmItems : kpis.missingItems)) })}>
                                                    <Text strong style={{ fontSize: 14, color: stat.color, display: 'block', fontFamily: 'JetBrains Mono' }}>{stat.val}</Text>
                                                    <Text style={{ fontSize: 8, color: '#aaa' }}>{stat.label}</Text>
                                                </div>
                                            ))}
                                        </Space>
                                    </div>
                                    <Divider style={{ margin: '0 0 12px 0', borderTopColor: '#222' }} />
                                    <List
                                        size="small"
                                        split={false}
                                        dataSource={[
                                            { icon: <CloudSyncOutlined style={{ color: '#1890ff', fontSize: 11 }} />, text: `VALIDATED_${kpis.confirmations}_AI_NODES: CONFIRMED_GOOD.` },
                                            { icon: <BulbOutlined style={{ color: '#52c41a', fontSize: 11 }} />, text: `DETECTED_${discoveries}_HIDDEN_TARGETS: ROBUST_LEARNING.` },
                                            { icon: <WarningOutlined style={{ color: '#ff4d4f', fontSize: 11 }} />, text: `CLEANUP_${verifiedAlarms}_FALSE_ALARMS: SYSTEM_PURGE.` },
                                            { icon: <PlusSquareOutlined style={{ color: '#faad14', fontSize: 11 }} />, text: `IDENTIFIED_${humanMissing}_SYSTEM_GAPS: BLINDSPOT_AWARENESS.` }
                                        ].filter((item, i) => [kpis.confirmations, discoveries, verifiedAlarms, humanMissing][i] > 0)}
                                        renderItem={item => (
                                            <List.Item style={{ padding: '2px 0', border: 'none' }}>
                                                <Space size={8}>
                                                    {item.icon}
                                                    <Text style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>{item.text}</Text>
                                                </Space>
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* MISSION_STRESS_TEST: DETERMINISTIC_ENGINE_HUD */}
                    <Card
                        size="small"
                        className="hud-card"
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CloudSyncOutlined style={{ color: '#00f2ff' }} />
                                    <Text strong style={{ color: '#fff', fontSize: 11, letterSpacing: '1px' }}>AI ENGINE_STRESS_TEST (DETERMINISTIC_FEEDBACK)</Text>
                                </div>
                                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {kpis.engineState?.status === 'ok' && (
                                        <div>
                                            <Tag className="hud-tag-neon" style={{ margin: 0 }}>
                                                {stressStrategy === 'retrain'
                                                    ? `TARGET: ${(kpis.engineState.retrain.confidence * 100).toFixed(0)}%_CONF`
                                                    : `PROD: ${(kpis.engineState.production?.t * 100).toFixed(0)}%_CONF`}
                                            </Tag>
                                        </div>
                                    )}
                                    <Tooltip title="Switch between Production baseline and Training datasets.">
                                        <Segmented
                                            size="small"
                                            className="hud-segmented"
                                            value={stressStrategy === 'safe' || stressStrategy === 'balanced' ? 'production' : (stressStrategy === 'aggressive' ? 'retrain' : stressStrategy)}
                                            onChange={(v) => setStressStrategy(v)}
                                            options={[
                                                { label: 'Production', value: 'production', icon: <SearchOutlined /> },
                                                { label: 'Training', value: 'retrain', icon: <ArrowUpOutlined /> },
                                            ]}
                                            style={{ background: '#1c1c1c', border: '1px solid #333' }}
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                        }
                        style={{ marginBottom: 24 }}
                    >
                        <Row gutter={24}>
                            <Col span={16}>
                                <div style={{ height: 350 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={kpis.engineState?.rows || []}
                                            margin={{ top: 40, right: 10, left: 10, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="#333" />
                                            <XAxis
                                                dataKey="t"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                                                interval={1}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                                            <RechartsTooltip
                                                contentStyle={{ background: '#141414', border: '1px solid #333', borderRadius: 4 }}
                                                itemStyle={{ fontSize: 11 }}
                                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                formatter={(value, name) => [value, String(name).toUpperCase()]}
                                            />
                                            <Legend verticalAlign="bottom" align="center" height={36} iconType="rect" wrapperStyle={{ paddingTop: 20, fontSize: 10, color: '#8c8c8c' }} />

                                            <Bar dataKey="tp" stackId="a" fill="#52c41a" name="True Positives" radius={[0, 0, 0, 0]} opacity={0.6} />
                                            <Bar dataKey="fp" stackId="a" fill="#fa8c16" name="False Positives" radius={[0, 0, 0, 0]} opacity={0.6} />
                                            <Bar dataKey="fn" stackId="a" fill="#ff4d4f" name="Missed Objects" radius={[1, 1, 0, 0]} opacity={0.6} />

                                            {kpis.engineState?.silent_zones?.map((zone, idx) => (
                                                <ReferenceArea
                                                    key={idx}
                                                    x1={zone.from}
                                                    x2={zone.to}
                                                    fill="#1c1c1c"
                                                    fillOpacity={0.8}
                                                    label={{ value: 'Rejected Zone', position: 'insideTop', fill: '#888', fontSize: 8, fontWeight: 'bold' }}
                                                />
                                            ))}

                                            {kpis.engineState?.model_ceiling?.t !== null && kpis.engineState?.model_ceiling?.t !== undefined && (
                                                <ReferenceLine x={kpis.engineState.model_ceiling.t} stroke="#722ed1" strokeWidth={1} strokeDasharray="4 4">
                                                    <Label value="Model Ceiling" position="top" fill="#722ed1" fontSize={8} fontWeight="bold" offset={10} />
                                                </ReferenceLine>
                                            )}

                                            {kpis.engineState?.status === 'ok' && (
                                                <ReferenceLine
                                                    x={stressStrategy === 'retrain' ? kpis.engineState.retrain.confidence : kpis.engineState.production?.t}
                                                    stroke="#00f2ff"
                                                    strokeWidth={2}
                                                >
                                                    <Label
                                                        value={stressStrategy === 'retrain' ? 'Target Confidence' : 'Production Baseline'}
                                                        position="top"
                                                        fill="#00f2ff"
                                                        fontSize={9}
                                                        fontWeight="bold"
                                                        offset={25}
                                                    />
                                                </ReferenceLine>
                                            )}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Col>
                            <Col span={8}>
                                <div style={{ borderLeft: '1px solid #222', paddingLeft: 20, height: '100%' }}>
                                    <Text className="hud-sidebar-label" style={{ color: '#00f2ff' }}>Engine Briefing [Deterministic]</Text>
                                    <List
                                        size="small"
                                        style={{ marginTop: 12 }}
                                        dataSource={stressStrategy === 'retrain' ? kpis.engineState?.briefing?.retrain : kpis.engineState?.briefing?.production}
                                        renderItem={item => {
                                            const isReject = item.includes('REJECTED');
                                            const isCeiling = item.includes('MODEL CEILING');
                                            const isDiag = item.includes('Diagnosis:');

                                            return (
                                                <List.Item style={{
                                                    padding: '6px 10px',
                                                    border: 'none',
                                                    marginBottom: 8,
                                                    borderRadius: 2,
                                                    background: isReject ? 'rgba(255, 77, 79, 0.05)' : (isCeiling ? 'rgba(114, 46, 209, 0.05)' : (isDiag ? 'rgba(0, 242, 255, 0.05)' : '#0d0d0d')),
                                                    borderLeft: `2px solid ${isReject ? '#ff4d4f' : (isCeiling ? '#722ed1' : (isDiag ? '#00f2ff' : '#222'))}`
                                                }}>
                                                    <Text style={{
                                                        fontSize: 11,
                                                        color: '#aaa',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        {item.toUpperCase()}
                                                    </Text>
                                                </List.Item>
                                            );
                                        }}
                                    />
                                </div>
                            </Col>
                        </Row>
                    </Card>

                    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            {/* GRAPH 4: SCALE_PERFORMANCE_FINGERPRINT (STRESS_HUD) */}
                            <Card
                                size="small"
                                className="hud-card"
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <LineChartOutlined style={{ color: '#00f2ff' }} />
                                            <Text strong style={{ color: '#fff', fontSize: 11, letterSpacing: '1px' }}>SCALE_PERFORMANCE_FINGERPRINT (STRESS_HUD)</Text>
                                        </div>
                                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Space size={4}>
                                                <Text className="hud-sidebar-label" style={{ margin: 0 }}>CHANNEL:</Text>
                                                <Tooltip title="Filter scale performance by specific object classes.">
                                                    <Select
                                                        size="small"
                                                        className="hud-select"
                                                        style={{ width: 160 }}
                                                        value={graph4Class}
                                                        onChange={setGraph4Class}
                                                        bordered={false}
                                                        dropdownMatchSelectWidth={false}
                                                    >
                                                        <Select.Option value="all">GLOBAL_AVERAGE</Select.Option>
                                                        {availableClasses.map(c => (
                                                            <Select.Option key={c} value={c}>{c.toUpperCase()}</Select.Option>
                                                        ))}
                                                    </Select>
                                                </Tooltip>
                                            </Space>
                                        </div>
                                    </div>
                                }
                            >
                                <div style={{ height: 320, width: '100%', padding: '12px 0' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={kpis.sizeStressData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="yieldTiny" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="yieldSmall" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#faad14" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#faad14" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="yieldMed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#00f2ff" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="yieldLarge" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="1 5" vertical={true} stroke="#222" />
                                            <XAxis
                                                dataKey="t"
                                                type="number"
                                                domain={[0, 1]}
                                                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                                tick={{ fill: '#888', fontSize: 9, fontFamily: 'monospace' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tickFormatter={(v) => `${v}%`}
                                                tick={{ fill: '#888', fontSize: 9, fontFamily: 'monospace' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <RechartsTooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div style={{ background: 'rgba(20, 20, 20, 0.95)', padding: '12px', border: '1px solid #333', borderRadius: 4, backdropFilter: 'blur(8px)' }}>
                                                                <Text strong style={{ fontSize: 10, color: '#00f2ff', display: 'block', marginBottom: 12, borderBottom: '1px solid #222', paddingBottom: 4 }}>
                                                                    Telemetry Scan: {(label * 100).toFixed(0)}% Confidence
                                                                </Text>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '8px 16px' }}>
                                                                    <Text style={{ fontSize: 9, color: '#888' }}>CATEGORY</Text>
                                                                    <Text style={{ fontSize: 9, color: '#888' }}>YIELD</Text>
                                                                    <Text style={{ fontSize: 9, color: '#888' }}>ACCURACY</Text>
                                                                    {payload.map((entry, idx) => {
                                                                        const sz = entry.dataKey.split('_')[0];
                                                                        const iouValue = entry.payload[`${sz}_iou`] || 0;
                                                                        return (
                                                                            <React.Fragment key={idx}>
                                                                                <Text strong style={{ fontSize: 10, color: entry.color, fontFamily: 'monospace' }}>
                                                                                    {sz === 'tiny' ? 'Tiny ' : (sz === 'small' ? 'Small ' : (sz === 'medium' ? 'Medium ' : 'Large '))}:
                                                                                </Text>
                                                                                <Text style={{ fontSize: 10, color: '#fff', fontFamily: 'monospace' }}>{entry.value}%</Text>
                                                                                <Text style={{ fontSize: 10, color: iouValue > 70 ? '#52c41a' : (iouValue > 40 ? '#faad14' : '#ff4d4f'), fontFamily: 'monospace' }}>{iouValue}%</Text>
                                                                            </React.Fragment>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="rect" wrapperStyle={{ fontSize: 10, paddingBottom: 20 }} />

                                            <Area type="monotone" dataKey="tiny_yield" name="Tiny Units" stroke="#ff4d4f" fill="url(#yieldTiny)" strokeWidth={2} />
                                            <Area type="monotone" dataKey="small_yield" name="Small Units" stroke="#faad14" fill="url(#yieldSmall)" strokeWidth={2} />
                                            <Area type="monotone" dataKey="medium_yield" name="Medium Units" stroke="#00f2ff" fill="url(#yieldMed)" strokeWidth={2} />
                                            <Area type="monotone" dataKey="large_yield" name="Large Units" stroke="#52c41a" fill="url(#yieldLarge)" strokeWidth={2} />

                                            <ReferenceLine x={confRange[0] / 100} stroke="#444" strokeDasharray="3 3">
                                                <Label value="Current Filter" position="top" fill="#888" fontSize={8} fontFamily="monospace" />
                                            </ReferenceLine>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ marginTop: 20, padding: '12px', background: '#0a0a0a', border: '1px solid #1c1c1c', borderRadius: 2 }}>
                                    <Text style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>
                                        <BulbOutlined style={{ marginRight: 8, color: '#faad14' }} />
                                        <b>DIAGNOSTIC:</b> SCALE_RESPONSE_SIGNATURE FOR <b>{graph4Class.toUpperCase()}</b>.
                                        IF LOW_SCALE (T/S) DROPS PREMATURELY, CONSIDER RESOLUTION_BOOST.
                                    </Text>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <style>{`
                                .hud-select .ant-select-selection-item { color: #00f2ff !important; font-weight: bold; }
                                .hud-tile { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                                .hud-tile:hover {
                                    border-color: #00f2ff !important;
                                    background: rgba(0, 242, 255, 0.1) !important;
                                    box-shadow: inset 0 0 15px rgba(0, 242, 255, 0.2);
                                }
                                .hud-tile:hover::after {
                                    content: '';
                                    position: absolute;
                                    top: 10%; left: 10%; right: 10%; bottom: 10%;
                                    border: 1px dashed rgba(0, 242, 255, 0.3);
                                    pointer-events: none;
                                }
                            `}</style>
                            {/* GRAPH 5: SPATIAL_FAILURE_TELEMETRY (DISTORTION_HUD) */}
                            <Card
                                size="small"
                                className="hud-card"
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FullscreenOutlined style={{ color: '#00f2ff' }} />
                                            <Text strong style={{ color: '#fff', fontSize: 11, letterSpacing: '1px' }}>SPATIAL_FAILURE_TELEMETRY (DISTORTION_HUD)</Text>
                                        </div>
                                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                            <Tooltip title="Isolate spatial failures by specific object classes.">
                                                <Space size={4}>
                                                    <Text className="hud-sidebar-label" style={{ margin: 0 }}>CHANNEL:</Text>
                                                    <Select
                                                        size="small"
                                                        className="hud-select"
                                                        style={{ width: 140 }}
                                                        value={spatialClass}
                                                        onChange={setSpatialClass}
                                                        dropdownMatchSelectWidth={false}
                                                    >
                                                        <Select.Option value="all">Any Class</Select.Option>
                                                        {availableClasses.map(c => <Select.Option key={c} value={c}>{c.toUpperCase()}</Select.Option>)}
                                                    </Select>
                                                </Space>
                                            </Tooltip>
                                            <Tooltip title="Analyze failures based on object size categories.">
                                                <Space size={4}>
                                                    <Text className="hud-sidebar-label" style={{ margin: 0 }}>SCALE:</Text>
                                                    <Segmented
                                                        size="small"
                                                        className="hud-segmented"
                                                        value={spatialSize}
                                                        onChange={setSpatialSize}
                                                        options={[
                                                            { label: 'All', value: 'all' },
                                                            { label: 'Tiny', value: 'tiny' },
                                                            { label: 'Small', value: 'small' },
                                                            { label: 'Medium', value: 'medium' },
                                                            { label: 'Large', value: 'large' }
                                                        ]}
                                                        style={{ background: '#1c1c1c', border: '1px solid #333' }}
                                                    />
                                                </Space>
                                            </Tooltip>
                                        </div>
                                    </div>
                                }
                            >
                                <Row gutter={24}>
                                    <Col xs={24} md={10}>
                                        <div style={{ position: 'relative', padding: '12px' }}>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '4px',
                                                aspectRatio: '1',
                                                background: '#0d0d0d',
                                                padding: '4px',
                                                border: '1px solid #222',
                                                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                                                backgroundSize: '20px 20px'
                                            }}>
                                                {kpis.spatialData.map((tile, i) => {
                                                    const row = Math.floor(i / 3);
                                                    const col = i % 3;
                                                    const label = `${String.fromCharCode(65 + row)}${col + 1}`;
                                                    return (
                                                        <div key={i} className="hud-tile" style={{
                                                            background: tile.density > 40 ? 'rgba(255, 77, 79, 0.25)' : (tile.density > 15 ? 'rgba(250, 173, 20, 0.15)' : 'rgba(255,255,255,0.02)'),
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '1px solid #222',
                                                            cursor: 'crosshair',
                                                            position: 'relative',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                            <Text style={{ position: 'absolute', top: 4, left: 6, fontSize: 8, color: '#aaa', fontFamily: 'monospace' }}>[{label}]</Text>
                                                            <Text strong style={{ fontSize: 18, color: tile.density > 30 ? '#ff4d4f' : '#fff', fontFamily: 'JetBrains Mono' }}>{tile.density}<span style={{ fontSize: 9, opacity: 0.5 }}>%</span></Text>
                                                            <div style={{ marginTop: 2, textAlign: 'center' }}>
                                                                <Text style={{ fontSize: 8, color: '#888', fontFamily: 'monospace' }}>{tile.total} UNITS</Text>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Badge status="processing" color="#00f2ff" text={<Text style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>SPATIAL_SYNC_ACTIVE</Text>} />
                                                <Text style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>
                                                    SAMPLES: {kpis.spatialTotal} / {kpis.spatialTotalRaw}
                                                </Text>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col xs={24} md={14}>
                                        <div style={{ borderLeft: '1px solid #222', paddingLeft: 24, paddingRight: 12, height: '100%' }}>
                                            <Text className="hud-sidebar-label" style={{ color: '#00f2ff', marginBottom: 16, display: 'block' }}>Environmental Calibration Log</Text>

                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                {(() => {
                                                    const d = kpis.spatialData;
                                                    const cornerDensity = d[0].density + d[2].density + d[6].density + d[8].density;
                                                    const leftDensity = d[0].density + d[3].density + d[6].density;
                                                    const rightDensity = d[2].density + d[5].density + d[8].density;
                                                    const topDensity = d[0].density + d[1].density + d[2].density;

                                                    const alerts = [];
                                                    if (kpis.spatialTotal === 0) {
                                                        return <div style={{ padding: '24px', border: '1px dashed #333', textAlign: 'center', color: '#888', fontFamily: 'monospace', fontSize: 11 }}>[EMPTY_SCAN_BUFFER] NO_TELEMETRY_RECORDED</div>;
                                                    }

                                                    if (cornerDensity > 60) alerts.push({ type: 'warning', msg: "OPTICAL_DISTORTION: Cluster detected in EXTREMITIES. Lens aberration suspected." });
                                                    if (leftDensity > 60 || rightDensity > 60) alerts.push({ type: 'info', msg: "UNEVEN_ILLUMINATION: Failure bias detected on HORIZONTAL_AXIS. Check side-glow." });
                                                    if (topDensity > 60) alerts.push({ type: 'info', msg: "OVERHEAD_INTERFERENCE: Clustering in UPPER_QUADRANTS. Check ceiling sources." });
                                                    if (d[4].density > 40) alerts.push({ type: 'warning', msg: "FOCAL_BLINDSPOT: Primary sensor focus occlusion or overexposure detected." });

                                                    const avgFP = d.reduce((acc, t) => acc + t.fp, 0);
                                                    const avgFN = d.reduce((acc, t) => acc + t.fn, 0);
                                                    if (avgFP > avgFN * 2) alerts.push({ type: 'urgent', msg: "Over-prediction bias: False positives dominate this filter. Aggressive sensitivity warning." });
                                                    if (avgFN > avgFP * 2) alerts.push({ type: 'urgent', msg: "Under-prediction bias: Missed objects dominate this filter. Recall crisis warning." });

                                                    if (alerts.length === 0) return (
                                                        <div style={{ padding: '12px', background: 'rgba(82, 196, 26, 0.05)', borderLeft: '2px solid #52c41a', fontFamily: 'monospace' }}>
                                                            <Text style={{ fontSize: 11, color: '#52c41a' }}>[STATUS: OPTIMAL] Environmental Calibration Stable. No bias detected.</Text>
                                                        </div>
                                                    );

                                                    return alerts.map((a, idx) => (
                                                        <div key={idx} style={{
                                                            padding: '10px 14px',
                                                            background: a.type === 'warning' || a.type === 'urgent' ? 'rgba(255, 77, 79, 0.05)' : 'rgba(0, 242, 255, 0.05)',
                                                            borderLeft: `2px solid ${a.type === 'warning' || a.type === 'urgent' ? '#ff4d4f' : '#00f2ff'}`,
                                                            marginBottom: '4px',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            <Text style={{ fontSize: 11, color: a.type === 'warning' || a.type === 'urgent' ? '#ff4d4f' : '#00f2ff' }}>
                                                                [{a.type.toUpperCase()}] {a.msg}
                                                            </Text>
                                                        </div>
                                                    ));
                                                })()}
                                            </Space>

                                            <div style={{ marginTop: 24, padding: '12px', background: '#0d0d0d', border: '1px solid #222', borderRadius: 2 }}>
                                                <Text style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>
                                                    <BulbOutlined style={{ marginRight: 8, color: '#faad14' }} />
                                                    <b>USER_GUIDE:</b> CROSS-REFERENCE QUADS TO ISOLATE BLINDSPOTS. CLICK TO FILTER_STREAM_LIVE.
                                                </Text>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                    </Row>
                </Col>
            </Row>

            {/* TELEMETRY_SUB_SYSTEM_LOG: ERROR_DETAIL_MODAL */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 4, height: 16, background: '#00f2ff', borderRadius: 2 }} />
                        <Text strong style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Inter' }}>
                            {errorModal.title.toUpperCase()}: SUB_SYSTEM_LOG
                        </Text>
                        <Tag className="hud-tag-neon" style={{ margin: 0, fontSize: 10 }}>{errorModal.items?.length || 0} UNITS</Tag>
                    </div>
                }
                open={errorModal.visible}
                onCancel={() => setErrorModal({ ...errorModal, visible: false })}
                footer={[
                    <Button
                        key="close"
                        onClick={() => setErrorModal({ ...errorModal, visible: false })}
                        style={{ background: '#1c1c1c', border: '1px solid #333', color: '#fff', borderRadius: 2, fontSize: 11, fontFamily: 'monospace' }}
                    >
                        TERMINATE_SESSION
                    </Button>
                ]}
                width={700}
                style={{ top: 40 }}
                styles={{
                    mask: { backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)' },
                    content: { background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: 0 },
                    header: { background: '#141414', borderBottom: '1px solid #222', padding: '16px 24px', borderRadius: '4px 4px 0 0' },
                    body: { padding: '16px 24px', maxHeight: '70vh', overflowY: 'auto', background: '#0a0a0a' }
                }}
            >
                {errorModal.items && errorModal.items.length > 0 ? (
                    <List
                        itemLayout="horizontal"
                        dataSource={errorModal.items}
                        renderItem={item => (
                            <List.Item style={{ borderBottom: '1px solid #1c1c1c', padding: '12px 8px' }}>
                                <List.Item.Meta
                                    avatar={
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 4,
                                            background: (item.type || '').includes('True') ? 'rgba(82, 196, 26, 0.1)' :
                                                ((item.type || '').includes('False') ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 173, 20, 0.1)'),
                                            border: `1px solid ${(item.type || '').includes('True') ? '#52c41a' : ((item.type || '').includes('False') ? '#ff4d4f' : '#faad14')}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: (item.type || '').includes('True') ? '#52c41a' : ((item.type || '').includes('False') ? '#ff4d4f' : '#faad14'),
                                            fontWeight: 'bold', fontSize: 12, fontFamily: 'JetBrains Mono'
                                        }}>
                                            {(item.type || '').includes('True') ? 'TP' : ((item.type || '').includes('False') ? 'FP' : 'FN')}
                                        </div>
                                    }
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Text style={{ color: '#00f2ff', fontSize: 10, fontFamily: 'monospace' }}>[{item.globalIdx || 'SRC'}]</Text>
                                            <Text strong style={{ color: '#fff', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{(item.imgName || '').toUpperCase()}</Text>
                                        </div>
                                    }
                                    description={
                                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Tag style={{ background: '#141414', color: '#aaa', border: '1px solid #333', fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
                                                CLASS: {String(item.class || item.class_name || 'UNKNOWN').toUpperCase()}
                                            </Tag>
                                            {item.conf && (
                                                <Text style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>
                                                    CONF: <span style={{ color: '#00f2ff' }}>{(item.conf * 100).toFixed(1)}%</span>
                                                </Text>
                                            )}
                                            {item.bbox && (
                                                <Text style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>
                                                    BOX: [{item.bbox.map(x => Math.round(x)).join(', ')}]
                                                </Text>
                                            )}
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                ) : (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text style={{ color: '#555', fontFamily: 'monospace' }}>NO_TELEMETRY_ITEMS_DETECTED</Text>}
                    />
                )}
            </Modal>
        </div>
    );
};

export default ChartsView;
