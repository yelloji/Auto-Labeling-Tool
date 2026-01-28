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
    SearchOutlined
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
    const [sizeSlice, setSizeSlice] = useState('all');
    const [selectedClasses, setSelectedClasses] = useState([]); // Empty = All
    const [stressStrategy, setStressStrategy] = useState('balanced'); // safe | balanced | aggressive

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
            fnList = [...fnList, ...rawFN];
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

        // --- 6. AI Detection Health Score ---
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
                tp, fp, fn, ma, aiGTRatio, totalGT: totalGTCount,
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
                engineState, // NEW: Industrial Engine State
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
    }, [experiment, verifications, qualityStats, selectedClasses, trainingClasses, sizeSlice, confRange, iouThreshold, stressStrategy]);

    if (!processedData) return <Empty />;

    const { kpis, classChart, curveData, availableClasses } = processedData;
    const { tp, fp, ma, fn, totalGT, discoveries, verifiedAlarms, humanMissing } = kpis;

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

                        {!kpis.isUploadMode && (
                            <>
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
                            </>
                        )}

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
                    {/* --- NEW: Expert Reviews Impact Card --- */}


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
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #e6f7ff', background: '#f0f9ff' }}>
                                <Tooltip title="AI Trust Index: A balanced score of accuracy, human autonomy, and precision. Green = Autonomous, Yellow = Needs Audit, Red = High Risk.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>AI Detection Health</Text>
                                </Tooltip>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Text strong style={{
                                        fontSize: 20,
                                        color: kpis.healthScore >= 80 ? '#52c41a' : (kpis.healthScore >= 60 ? '#faad14' : '#ff4d4f')
                                    }}>
                                        {kpis.healthScore}%
                                    </Text>
                                    <Badge
                                        status={kpis.healthScore >= 80 ? 'success' : (kpis.healthScore >= 60 ? 'warning' : 'error')}
                                        text={<Text style={{ fontSize: 8 }}>{kpis.healthScore >= 80 ? 'STABLE' : (kpis.healthScore >= 60 ? 'REVIEW' : 'RISK')}</Text>}
                                    />
                                </div>
                            </Card>
                        </Col>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0', background: '#f9f9f9' }}>
                                <Tooltip title={kpis.isUploadMode
                                    ? "Proportionality: Compares total AI detections to your manual audit. Ideally 1.0. If > 1.0, the AI is hyper-active."
                                    : "Density Score: Compares total AI detections to actual ground truth. Ideally 1.0."}>
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Detection Ratio</Text>
                                </Tooltip>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 18, color: '#000' }}>
                                        {kpis.aiGTRatio}x
                                    </Text>
                                    <Tooltip title={kpis.isUploadMode
                                        ? `AI found ${tp + fp} objects while the 'Human-Verified Truth' is ${totalGT} objects.`
                                        : `AI found ${tp + fp + ma} objects while there are only ${totalGT} actual objects in reality.`}>
                                        <Text type="secondary" style={{ fontSize: 9, cursor: 'help' }}>
                                            {kpis.isUploadMode ? `${tp + fp} AI / ${totalGT} Truth` : `${tp + fp + ma} AI / ${totalGT} GT`}
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
                                <Tooltip title={kpis.isUploadMode
                                    ? "Confirmed Good: AI boxes you agreed with (implicitly or explicitly)."
                                    : "Correct Results: AI successfully found the right label with high confidence and precision."}>
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>True Positives</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                                    {kpis.tp}
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
                                <Tooltip title={kpis.isUploadMode
                                    ? "Verified False Alarms: Boxes you explicitly clicked [FAIL] on."
                                    : "Incorrect Alarms: Cases where the AI reported an object, but nothing exists at that location."}>
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>False Positives</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 20, color: '#ff4d4f' }}>
                                    {kpis.fp}
                                </Text>
                            </Card>
                        </Col>
                        {!kpis.isUploadMode && (
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
                                        {kpis.ma}
                                    </Text>
                                </Card>
                            </Col>
                        )}
                        <Col flex="1">
                            <Card
                                size="small"
                                style={{ textAlign: 'center', border: '1px solid #fffbe6', cursor: 'pointer', background: '#fffbe6' }}
                                hoverable
                                onClick={() => setErrorModal({
                                    visible: true,
                                    title: kpis.isUploadMode ? 'Manual Objects (AI Missed)' : 'Missed Ground Truth Objects',
                                    items: kpis.fnItems
                                })}
                            >
                                <Tooltip title={kpis.isUploadMode
                                    ? "Blind Spots: Objects you had to draw manually because the AI ignored them."
                                    : "Unfound Objects: Actual objects the AI missed."}>
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>Missed Objects</Text>
                                </Tooltip>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 20, color: '#faad14' }}>
                                        {kpis.fn}
                                    </Text>
                                    {(!kpis.isUploadMode) && (
                                        <Tooltip title={`'Real' (${kpis.fnReal}) were missed by the model. 'Filtered' (${kpis.fnFiltered}) were found but suppressed by your confidence settings.`}>
                                            <Text type="secondary" style={{ fontSize: 9, cursor: 'help' }}>
                                                {`${kpis.fnReal} Real / ${kpis.fnFiltered} Filtered`}
                                            </Text>
                                        </Tooltip>
                                    )}
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <Card size="small" style={{ border: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Tooltip title="Findings vs. Misses: A high-level view of what happened to all objects that exist in your data. Green = AI found them, Yellow = AI found them but box is sloppy, Orange = AI missed them.">
                                        <Text strong style={{ fontSize: 13, textTransform: 'uppercase', cursor: 'help' }}>
                                            <BarChartOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                            Graph 2: AI Findings vs. Misses (Outcome Recap)
                                        </Text>
                                    </Tooltip>
                                    <Tag color="blue">Total Truth: {totalGT} Objects</Tag>
                                </div>

                                <div style={{ height: 60, width: '100%', display: 'flex', borderRadius: 4, overflow: 'hidden', backgroundColor: '#f5f5f5' }}>
                                    {kpis.outcomeData.map((seg, idx) => {
                                        const pct = totalGT > 0 ? (seg.value / totalGT) * 100 : 0;
                                        if (pct === 0) return null;
                                        return (
                                            <Tooltip key={idx} title={`${seg.name}: ${seg.value} (${pct.toFixed(1)}%)`}>
                                                <div style={{ width: `${pct}%`, backgroundColor: seg.color, height: '100%', transition: 'all 0.3s ease' }} />
                                            </Tooltip>
                                        )
                                    })}
                                </div>

                                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: '24px' }}>
                                    {kpis.outcomeData.map((seg, idx) => {
                                        const pct = totalGT > 0 ? (seg.value / totalGT) * 100 : 0;
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: seg.color }} />
                                                <Text style={{ fontSize: 11 }}>{seg.name}: <b>{seg.value}</b> ({pct.toFixed(0)}%)</Text>
                                            </div>
                                        )
                                    })}
                                </div>

                                <Divider style={{ margin: '12px 0', borderStyle: 'dashed' }} />
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center' }}>
                                    {(() => {
                                        const fnPct = totalGT > 0 ? (kpis.fn / totalGT) * 100 : 0;
                                        const maPct = totalGT > 0 ? (kpis.ma / totalGT) * 100 : 0;
                                        const tpPct = totalGT > 0 ? (kpis.tp / totalGT) * 100 : 0;
                                        const fpRatio = kpis.tp > 0 ? (kpis.fp / kpis.tp) : 0;

                                        if (totalGT === 0) return <span>ℹ️ <b>No Ground Truth Detected:</b> Add manual boxes or upload a label file to begin performance analysis.</span>;
                                        if (fnPct > 80) return <span>🚨 <b>Total Coverage Failure:</b> Your model is misses <b>{fnPct.toFixed(0)}%</b> of reality. It is functionally "Blind." Ensure the labels are correct or increase training diversity.</span>;
                                        if (maPct > 20) return <span>📏 <b>Alignment Precision Crisis:</b> {maPct.toFixed(0)}% of findings are <b>Misaligned</b>. The model "Locates" features correctly but the boxes have <b>poor alignment</b>. Tune your anchor boxes or IoU settings.</span>;
                                        if (fnPct > 35) return <span>⚠️ <b>Major Recall Gap:</b> {fnPct.toFixed(0)}% of objects are undetected. This indicates a <b>Coverage Crisis</b>. The model sees the world but misses nearly half the details.</span>;
                                        if (tpPct > 85 && maPct < 5) return <span>🏆 <b>Elite Performance:</b> Exceptional alignment! Over {tpPct.toFixed(0)}% of reality matches perfectly. This model is ready for <b>High-Stakes Automation</b>.</span>;

                                        return <span>✅ <b>Reliable Industrial Baseline:</b> The model's findings align strongly with Ground Truth. The current configuration demonstrates <b>Operational Stability</b>.</span>;
                                    })()}
                                </Text>
                            </Card>
                        </Col>
                    </Row>

                    {(discoveries > 0 || verifiedAlarms > 0 || humanMissing > 0 || kpis.confirmations > 0) && (
                        <Card size="small" style={{ marginBottom: 24, borderRadius: 8, border: '1px solid #e6f7ff', background: '#f0f9ff' }}>
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                                {/* Left Side: Mini Donut ROI */}
                                <div style={{ width: 100, textAlign: 'center' }}>
                                    <div style={{ height: 100, position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={kpis.roiData}
                                                    innerRadius={30}
                                                    outerRadius={45}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {kpis.roiData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                            <Text strong style={{ fontSize: 16, display: 'block' }}>
                                                {kpis.roiData.reduce((acc, curr) => acc + curr.value, 0)}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 8 }}>SAVED</Text>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Dynamic Narrative & Metrics */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div>
                                            <Title level={5} style={{ margin: 0 }}>Expert Verification Narrative</Title>
                                            <Text type="secondary" style={{ fontSize: 11 }}>Human-in-the-loop corrections are actively improving the model "Mark."</Text>
                                        </div>
                                        <Space split={<Divider type="vertical" />}>
                                            <div
                                                style={{ textAlign: 'center', cursor: 'pointer' }}
                                                onClick={() => setErrorModal({
                                                    visible: true,
                                                    title: 'AI Confirmations (Validated Findings)',
                                                    items: kpis.confirmationItems
                                                })}
                                            >
                                                <Text strong style={{ fontSize: 18, color: '#1890ff', display: 'block' }}>{kpis.confirmations}</Text>
                                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>Confirmations</Text>
                                            </div>
                                            <div
                                                style={{ textAlign: 'center', cursor: 'pointer' }}
                                                onClick={() => setErrorModal({
                                                    visible: true,
                                                    title: 'Human Discoveries (Confirmed TP)',
                                                    items: kpis.discoveryItems
                                                })}
                                            >
                                                <Text strong style={{ fontSize: 18, color: '#52c41a', display: 'block' }}>{discoveries}</Text>
                                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>Discoveries</Text>
                                            </div>
                                            <div
                                                style={{ textAlign: 'center', cursor: 'pointer' }}
                                                onClick={() => setErrorModal({
                                                    visible: true,
                                                    title: 'Verified False Alarms (Cleanup)',
                                                    items: kpis.alarmItems
                                                })}
                                            >
                                                <Text strong style={{ fontSize: 18, color: '#ff4d4f', display: 'block' }}>{verifiedAlarms}</Text>
                                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>False Alarms</Text>
                                            </div>
                                            <div
                                                style={{ textAlign: 'center', cursor: 'pointer' }}
                                                onClick={() => setErrorModal({
                                                    visible: true,
                                                    title: 'Human Misses (Manual Boxes)',
                                                    items: kpis.missingItems
                                                })}
                                            >
                                                <Text strong style={{ fontSize: 18, color: '#faad14', display: 'block' }}>{humanMissing}</Text>
                                                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>Human Misses</Text>
                                            </div>
                                        </Space>
                                    </div>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <List
                                        size="small"
                                        split={false}
                                        dataSource={[
                                            { icon: <CloudSyncOutlined style={{ color: '#1890ff' }} />, text: `Validated ${kpis.confirmations} AI finding${kpis.confirmations === 1 ? '' : 's'} as correct.` },
                                            { icon: <BulbOutlined style={{ color: '#52c41a' }} />, text: `AI successfully found ${discoveries} real target${discoveries === 1 ? '' : 's'} missed in the initial training labels.` },
                                            { icon: <WarningOutlined style={{ color: '#ff4d4f' }} />, text: `Verified ${verifiedAlarms} AI finding${verifiedAlarms === 1 ? '' : 's'} as false alarm${verifiedAlarms === 1 ? '' : 's'}.` },
                                            { icon: <PlusSquareOutlined style={{ color: '#faad14' }} />, text: `Identified ${humanMissing} target${humanMissing === 1 ? '' : 's'} missed by both training labels and AI findings.` }
                                        ].filter(item => {
                                            if (item.text.includes('Validated')) return kpis.confirmations > 0;
                                            if (item.text.includes('successfully found')) return discoveries > 0;
                                            if (item.text.includes('false alarm')) return verifiedAlarms > 0;
                                            if (item.text.includes('Identified')) return humanMissing > 0;
                                            return false;
                                        })}
                                        renderItem={item => (
                                            <List.Item style={{ padding: '2px 0' }}>
                                                <Space>
                                                    {item.icon}
                                                    <Text style={{ fontSize: 12 }}>{item.text}</Text>
                                                </Space>
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card size="small" style={{ marginBottom: 24, borderRadius: 8, border: '1px solid #f0f0f0', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <Title level={5} style={{ margin: 0 }}>Decision Explanation</Title>
                                <Text type="secondary" style={{ fontSize: 11 }}>IoU Match: 0.30 • Min Automation: 15% • Step: 0.05</Text>
                            </div>
                            <Space align="center" size="large">
                                {kpis.engineState?.status === 'ok' && (
                                    <div style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase' }}>
                                            {stressStrategy === 'retrain' ? 'Target Confidence' : 'Production Target'}
                                        </Text>
                                        <Tag color="blue" icon={<SearchOutlined />} style={{ fontSize: 13, padding: '2px 8px' }}>
                                            {stressStrategy === 'retrain'
                                                ? `${(kpis.engineState.retrain?.confidence * 100).toFixed(0)}% Confidence`
                                                : `${(kpis.engineState.production?.t * 100).toFixed(0)}% Confidence`}
                                        </Tag>
                                    </div>
                                )}
                                <Segmented
                                    value={stressStrategy === 'safe' || stressStrategy === 'balanced' ? 'production' : (stressStrategy === 'aggressive' ? 'retrain' : stressStrategy)}
                                    onChange={(v) => setStressStrategy(v)}
                                    options={[
                                        { label: 'Production', value: 'production', icon: <SearchOutlined /> },
                                        { label: 'Retrain', value: 'retrain', icon: <ArrowUpOutlined /> },
                                    ]}
                                />
                            </Space>
                        </div>

                        <Row gutter={24}>
                            <Col span={16}>
                                <div style={{ height: 380 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={kpis.engineState?.rows || []}
                                            margin={{ top: 60, right: 10, left: 10, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis
                                                dataKey="t"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10 }}
                                                interval={1}
                                                label={{ value: 'Confidence Threshold', position: 'insideBottom', offset: -5, fontSize: 10 }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                            <RechartsTooltip
                                                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                formatter={(value, name) => [value, String(name).toUpperCase()]}
                                            />
                                            <Legend verticalAlign="bottom" align="center" height={36} iconType="circle" wrapperStyle={{ paddingTop: 20 }} />

                                            <Bar dataKey="tp" stackId="a" fill="#52c41a" name="Correct (TP)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="fp" stackId="a" fill="#fa8c16" name="Mistakes (FP)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="fn" stackId="a" fill="#ff4d4f" name="Missed (FN)" radius={[2, 2, 0, 0]} />

                                            {kpis.engineState?.silent_zones?.map((zone, idx) => (
                                                <ReferenceArea
                                                    key={idx}
                                                    x1={zone.from}
                                                    x2={zone.to}
                                                    fill="#f0f0f0"
                                                    fillOpacity={0.6}
                                                    label={{ value: 'REJECTED', position: 'insideTop', fill: '#8c8c8c', fontSize: 9, fontWeight: 'bold' }}
                                                />
                                            ))}

                                            {kpis.engineState?.model_ceiling?.t !== null && kpis.engineState?.model_ceiling?.t !== undefined && (
                                                <ReferenceLine x={kpis.engineState.model_ceiling.t} stroke="#722ed1" strokeWidth={2} strokeDasharray="3 3">
                                                    <Label value="MODEL CEILING 🛑" position="top" fill="#722ed1" fontSize={10} fontWeight="bold" offset={15} />
                                                </ReferenceLine>
                                            )}

                                            {kpis.engineState?.status === 'ok' && (
                                                <ReferenceLine
                                                    x={stressStrategy === 'retrain' ? kpis.engineState.retrain.confidence : kpis.engineState.production?.t}
                                                    stroke="#1890ff"
                                                    strokeWidth={3}
                                                >
                                                    <Label
                                                        value={stressStrategy === 'retrain' ? 'TARGET ⭐' : 'PRODUCTION ⭐'}
                                                        position="top"
                                                        fill="#1890ff"
                                                        fontSize={10}
                                                        fontWeight="bold"
                                                        offset={35}
                                                    />
                                                </ReferenceLine>
                                            )}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Col>
                            <Col span={8}>
                                <Title level={5} style={{ fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', color: '#1890ff' }}>
                                    <BulbOutlined style={{ marginRight: 8 }} />
                                    Deterministic Analysis
                                </Title>
                                <List
                                    size="small"
                                    dataSource={stressStrategy === 'retrain' ? kpis.engineState?.briefing?.retrain : kpis.engineState?.briefing?.production}
                                    renderItem={item => {
                                        const isReject = item.includes('REJECTED');
                                        const isCeiling = item.includes('MODEL CEILING');
                                        const isDiag = item.includes('Diagnosis:');
                                        const isWhy = item.includes('Why not');

                                        return (
                                            <List.Item style={{
                                                padding: '8px 12px',
                                                border: 'none',
                                                marginBottom: 6,
                                                borderRadius: 6,
                                                background: isReject ? '#fff1f0' : (isCeiling ? '#f9f0ff' : (isDiag ? '#e6f7ff' : (isWhy ? '#fff7e6' : 'transparent'))),
                                                fontSize: 12
                                            }}>
                                                <span style={{ fontWeight: (isReject || isCeiling || isDiag) ? 600 : 400 }}>
                                                    {item}
                                                </span>
                                            </List.Item>
                                        );
                                    }}
                                />
                            </Col>
                        </Row>
                    </Card>

                    <Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
                        <Col flex="1">
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
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
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
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
                            <Card size="small" style={{ textAlign: 'center', border: '1px solid #f0f0f0' }}>
                                <Tooltip title="Stability Score: A weighted balance of Quality and Coverage. Use this to track the overall model performance on this dataset.">
                                    <Text type="secondary" style={{ fontSize: 9, display: 'block', textTransform: 'uppercase', cursor: 'help' }}>F1 Score</Text>
                                </Tooltip>
                                <Text strong style={{ fontSize: 18, color: '#13c2c2' }}>
                                    {`${kpis.f1}%`}
                                </Text>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                            <Card
                                title={<Space><OrderedListOutlined />Performance Leaderboard (By Class)</Space>}
                                bodyStyle={{ height: 400, overflow: 'auto' }}
                            >
                                <Table
                                    dataSource={classChart}
                                    pagination={false}
                                    size="small"
                                    rowKey="name"
                                    columns={[
                                        { title: 'Class', dataIndex: 'name', key: 'name', fixed: 'left' },
                                        {
                                            title: 'F1-Score',
                                            dataIndex: 'f1',
                                            key: 'f1',
                                            sorter: (a, b) => a.f1 - b.f1,
                                            render: (v) => (
                                                <Space>
                                                    <div style={{ width: 100, height: 8, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${v}%`, background: v > 70 ? '#52c41a' : v > 40 ? '#faad14' : '#ff4d4f' }} />
                                                    </div>
                                                    <Text strong>{v}%</Text>
                                                </Space>
                                            )
                                        },
                                        { title: 'P', dataIndex: 'precision', key: 'precision', render: v => `${v}%` },
                                        { title: 'R', dataIndex: 'recall', key: 'recall', render: v => `${v}%` }
                                    ]}
                                />
                            </Card>
                        </Col>

                        <Col xs={24} md={12}>
                            <Card
                                title={<Space><LineChartOutlined />P-R-F1 Balance Curve</Space>}
                                bodyStyle={{ height: 400 }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={curveData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis
                                            dataKey="threshold"
                                            label={{ value: 'Confidence Threshold', position: 'bottom', offset: 0 }}
                                            tick={{ fontSize: 10 }}
                                        />
                                        <YAxis
                                            domain={[0, 100]}
                                            label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                                            tick={{ fontSize: 10 }}
                                        />
                                        <RechartsTooltip />
                                        <Legend verticalAlign="top" height={36} />

                                        {/* Dynamic Reference Line linked to Sidebar Slider */}
                                        <ReferenceLine x={confRange[0] / 100} stroke="#1890ff" strokeDasharray="5 5">
                                            <Label value="Filter" position="insideTopLeft" fill="#1890ff" fontSize={10} />
                                        </ReferenceLine>

                                        <Line type="monotone" dataKey="precision" stroke="#1890ff" strokeWidth={2} dot={false} name="Precision" />
                                        <Line type="monotone" dataKey="recall" stroke="#52c41a" strokeWidth={2} dot={false} name="Recall" />
                                        <Line type="monotone" dataKey="f1" stroke="#722ed1" strokeWidth={3} dot={false} name="F1-Score" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Card>
                        </Col>
                    </Row>
                </Col>
            </Row>

            {/* Error Detail Modal */}
            <Modal
                title={
                    <Space>
                        <WarningOutlined style={{
                            color: errorModal.title.includes('True') ? '#52c41a' :
                                errorModal.title.includes('False') ? '#ff4d4f' :
                                    errorModal.title.includes('Misaligned') ? '#d46b08' : '#faad14'
                        }} />
                        {errorModal.title}
                        <Tag color={errorModal.title.includes('True') ? 'green' : 'default'}>{errorModal.items?.length || 0} Items</Tag>
                    </Space>
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
            </Modal>
        </div>
    );
};

export default ChartsView;
