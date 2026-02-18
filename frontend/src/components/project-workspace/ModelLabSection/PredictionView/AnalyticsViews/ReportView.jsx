import React, { useMemo, useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Button, Divider, Space, Spin, Alert, Statistic } from 'antd';
import {
    DownloadOutlined,
    DatabaseOutlined,
    ExperimentOutlined,
    AimOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    CloudSyncOutlined,
    LoadingOutlined,
    FileTextOutlined,
    BulbOutlined
} from '@ant-design/icons';
import { projectsAPI } from '../../../../../services/api';

const { Title, Text } = Typography;

/**
 * ReportView Component
 * 
 * Clean, organized Training Report with:
 * - Dataset Details
 * - Training Metrics (Box + Mask for Segmentation)
 * - Class-wise Performance
 * - All with simple English explanations
 */
const ReportView = ({ experiment, training, verifications = [] }) => {
    const [qualityStats, setQualityStats] = useState(null);
    const isSplit = experiment?.dataset_source && experiment.dataset_source !== 'upload';

    // --- 📡 Fetch Quality Stats (Same as ChartsView) ---
    useEffect(() => {
        if (isSplit && experiment?.id) {
            projectsAPI.getQualityStats(experiment.id)
                .then(setQualityStats)
                .catch(err => console.error("Quality fetch failed:", err));
        }
    }, [experiment?.id, isSplit]);


    // --- USE ANALYTICS SUMMARY (Same as Overview Tab) ---
    const predictionAnalytics = useMemo(() => {
        if (!experiment?.analytics_summary) return null;

        const summary = experiment.analytics_summary;
        const {
            total_detections = 0,
            classes_detected = {},
            confidence_distribution = {}
        } = summary;

        // Basic scope
        const predictionImages = experiment.image_count || 0;
        let gtCoverage = qualityStats?.total_gt || 0;
        let tp = 0, fp = 0, fn = 0;

        // --- METRICS CALCULATION PRIORITY ---
        if (qualityStats?.has_ground_truth) {
            // Priority 1: Backend Quality Stats (Split / Baseline Mode)
            tp = qualityStats.detailed_true_positives?.length || 0;
            fp = qualityStats.detailed_false_positives?.length || 0;
            fn = qualityStats.detailed_missed_objects?.length || 0;
            gtCoverage = qualityStats.total_gt;
        } else if (verifications?.length > 0) {
            // Priority 2: Manual Verifications (Upload Mode)
            // 1. Prepare Helpers
            const getFileName = (path) => path ? path.split(/[/\\]/).pop() : '';

            // 2. Parse Metadata for Hash Lookup
            let rawMeta = experiment.input_images || {};
            if (typeof rawMeta === 'string') {
                try { rawMeta = JSON.parse(rawMeta); } catch (e) { rawMeta = {}; }
            }
            const hashLookup = {};
            Object.entries(rawMeta).forEach(([path, hash]) => {
                hashLookup[getFileName(path)] = hash;
            });

            // 3. Analyze Verifications
            let verifiedFails = 0;
            let humanMissing = 0;

            verifications.forEach(v => {
                const vFile = getFileName(v.image_name);
                const vHash = v.image_hash_md5 || v.imageHashMd5;
                const targetHash = hashLookup[vFile];

                // Triple Match Logic (ExpID + Name + Hash)
                const isExpMatch = String(v.experiment_id) === String(experiment.id) ||
                    (experiment.name && String(v.experiment_id) === String(experiment.name));

                if (isExpMatch && vFile && vHash === targetHash) {
                    if (v.status === 'fail') {
                        verifiedFails++;
                    } else if (v.status !== 'pass' && !v.matched_ai) {
                        const predKey = Object.keys(experiment.predictions || {}).find(k => getFileName(k) === vFile);
                        const imgDets = experiment.predictions?.[predKey] || [];
                        const matchedAI = imgDets.find(d =>
                            d.bbox && v.bbox &&
                            Math.abs(d.bbox[0] - v.bbox[0]) < 0.1 && Math.abs(d.bbox[1] - v.bbox[1]) < 0.1 &&
                            Math.abs(d.bbox[2] - v.bbox[2]) < 0.1 && Math.abs(d.bbox[3] - v.bbox[3]) < 0.1
                        );
                        if (!matchedAI) humanMissing++;
                    }
                }
            });

            fp = verifiedFails;
            fn = humanMissing;
            tp = Math.max(0, total_detections - fp);
            gtCoverage = tp + fn;
        }

        const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
        const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
        const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;


        // Class distribution (same as Overview)
        const classDistribArray = Object.entries(classes_detected).map(([className, count]) => ({
            class: className,
            count,
            percentage: total_detections > 0 ? (count / total_detections * 100) : 0
        })).sort((a, b) => b.count - a.count);

        // Confidence ranges with per-class breakdown
        const confRangesArray = Object.entries(confidence_distribution).map(([range, count]) => ({
            range,
            count,
            percentage: total_detections > 0 ? (count / total_detections * 100) : 0,
            byClass: {} // Will populate below
        })).sort((a, b) => {
            const aMin = parseFloat(a.range.split('-')[0]);
            const bMin = parseFloat(b.range.split('-')[0]);
            return aMin - bMin;
        });

        // Calculate per-class breakdown for each confidence range
        if (experiment?.predictions) {
            Object.values(experiment.predictions).forEach(dets => {
                if (Array.isArray(dets)) {
                    dets.forEach(d => {
                        if (d.confidence !== undefined && d.class) {
                            const conf = d.confidence;
                            const className = d.class;

                            // Find matching range
                            confRangesArray.forEach(rangeObj => {
                                const [min, max] = rangeObj.range.split('-').map(parseFloat);
                                if ((conf >= min && conf < max) || (conf === 1.0 && max === 1.0)) {
                                    rangeObj.byClass[className] = (rangeObj.byClass[className] || 0) + 1;
                                }
                            });
                        }
                    });
                }
            });
        }

        return {
            scope: {
                predictionImages,
                totalDetections: total_detections,
                gtCoverage,
                tp,
                fp,
                fn,
                precision,
                recall,
                f1: f1.toFixed(1),
                classDistribution: classDistribArray,
                confidenceRanges: confRangesArray,
                avgConfidence: total_detections > 0 ? (Object.entries(confidence_distribution).reduce((acc, [range, count]) => {
                    const [min, max] = range.split('-').map(parseFloat);
                    const mid = (min + max) / 2;
                    return acc + (mid * count);
                }, 0) / total_detections * 100).toFixed(1) : 0
            }
        };


    }, [experiment, qualityStats]);

    // --- KPIs & DIAGNOSTICS CALCULATION (INCLUDING STORY MODE) ---
    const kpis = useMemo(() => {
        // --- 0. DATA PREPARATION (UNIFYING SPLIT & UPLOAD MODES) ---
        let tpList = [];
        let fpList = [];
        let fnList = [];

        if (qualityStats?.has_ground_truth) {
            // MODE A: Split / Baseline (Use Backend Quality Stats)
            tpList = qualityStats.detailed_true_positives || [];
            fpList = qualityStats.detailed_false_positives || [];
            fnList = qualityStats.detailed_missed_objects || [];
        } else if (verifications?.length > 0) {
            // MODE B: Manual Upload (Use Verifications matching logic from ChartsView)
            const getFileName = (path) => path ? path.split(/[/\\]/).pop() : '';

            // 1. Prepare Helper Data
            let rawMeta = experiment.input_images || {};
            if (typeof rawMeta === 'string') {
                try { rawMeta = JSON.parse(rawMeta); } catch (e) { rawMeta = {}; }
            }
            const hashLookup = {};
            Object.entries(rawMeta).forEach(([path, hash]) => {
                hashLookup[getFileName(path)] = hash;
            });

            // 2. Build Bbox-Mapping (Match 0.1 tolerance COORDINATES)
            const vMap = {};
            const localHumanMissing = [];

            verifications.forEach(v => {
                const vFile = getFileName(v.image_name);
                const vHash = v.image_hash_md5 || v.imageHashMd5;
                const targetHash = hashLookup[vFile];
                const isExpMatch = String(v.experiment_id) === String(experiment.id) ||
                    (experiment.name && String(v.experiment_id) === String(experiment.name));

                if (isExpMatch && vFile && vHash === targetHash) {
                    const predKey = Object.keys(experiment.predictions || {}).find(k => getFileName(k) === vFile);
                    const imgDets = experiment.predictions?.[predKey] || [];

                    // FIND CLOSEST MATCH (0.1 TOLERANCE)
                    const matchedAI = imgDets.find(d =>
                        d.bbox && v.bbox &&
                        Math.abs(d.bbox[0] - v.bbox[0]) < 0.1 && Math.abs(d.bbox[1] - v.bbox[1]) < 0.1 &&
                        Math.abs(d.bbox[2] - v.bbox[2]) < 0.1 && Math.abs(d.bbox[3] - v.bbox[3]) < 0.1
                    );

                    if (matchedAI) {
                        // Map status to AI's original bbox coordinates
                        const key = `${vFile}|${matchedAI.bbox.join(',')}`;
                        vMap[key] = v.status;
                    } else if (v.status !== 'fail') {
                        // User manually marked a missing object
                        localHumanMissing.push({ ...v, type: 'Human Missing', imgName: vFile });
                    }
                }
            });

            // 3. Classify AI Detections as TP vs FP
            Object.entries(experiment.predictions || {}).forEach(([imgName, dets]) => {
                const fName = getFileName(imgName);
                (dets || []).forEach(d => {
                    if (!d.bbox) return;
                    const key = `${fName}|${d.bbox.join(',')}`;
                    const status = vMap[key];

                    const item = {
                        ...d,
                        imgName: fName,
                        class_name: d.class_name || d.class || 'Unknown',
                        type: status === 'fail' ? 'False Positive' : 'True Positive'
                    };

                    if (status === 'fail') {
                        fpList.push(item);
                    } else {
                        tpList.push(item);
                    }
                });
            });

            // 4. Combine Missed Objects
            fnList = [...localHumanMissing];
        }

        const tp = tpList.length;
        const fp = fpList.length;
        const fn = fnList.length;

        if (tp === 0 && fp === 0 && fn === 0) return null; // Still hide if NO data at all

        // Calculate precision, recall, F1
        const p = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
        const r = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
        const f1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;


        // --- 1. OPTIMIZATION & CEILING LOGIC (CORE DATA) ---
        // Calculate Quartiles for naming size groups
        let allAreas = [];
        if (experiment?.predictions) {
            Object.values(experiment.predictions).forEach(dets => {
                if (Array.isArray(dets)) {
                    dets.forEach(d => {
                        if (d.bbox) {
                            allAreas.push((d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]));
                        }
                    });
                }
            });
        }
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

        // Sweep Confidence range (REQUIRED for both Threshold Optimization and sizeStressData)
        const CONF_LIST = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.46, 0.5, 0.55, 0.56, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
        const sizeStressData = CONF_LIST.map(t => {
            const row = { t };
            ['tiny', 'small', 'medium', 'large'].forEach(sz => {
                const szTPs = tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || 0) >= t);
                const szGT = tpList.filter(d => getSizeGrp(d.bbox) === sz).length +
                    fnList.filter(d => getSizeGrp(d.bbox) === sz).length;
                row[`${sz}_yield`] = szGT > 0 ? parseFloat(((szTPs.length / szGT) * 100).toFixed(1)) : 0;
                row[`${sz}_gt`] = szGT;
            });
            return row;
        });

        // === INDUSTRIAL PERFORMANCE ENGINE (Exact port of Charts algorithm) ===
        // Step 1: Build fine-grained performance rows (1% steps, same as Charts)
        const totalGTCount = tpList.length + fnList.length;
        const CONF_STEP_FINE = 0.01;
        const MIN_AUTOMATION = 0.15;
        const W_TP = 2, W_FP = 1, W_FN = 10; // Charts training weights

        const calcF1 = (tp, fp, fn) => {
            const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
            const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
            return (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        };

        const fineConfList = [];
        for (let t = CONF_STEP_FINE; t <= 0.951; t += CONF_STEP_FINE) fineConfList.push(parseFloat(t.toFixed(2)));

        const pRowsFine = fineConfList.map(t => {
            const tpCount = tpList.filter(d => (d.confidence || 0) >= t).length;
            const fpCount = fpList.filter(d => (d.confidence || 0) >= t).length;
            const fnCount = fnList.length + (tpList.length - tpCount);
            const automation = totalGTCount > 0 ? (tpCount / totalGTCount) : 0;
            const score = (W_TP * tpCount) - (W_FP * fpCount) - (W_FN * fnCount);
            const tpIoUs = tpList.filter(d => (d.confidence || 0) >= t).map(d => d.matched_iou || 0).filter(v => v > 0);
            return { t, tp: tpCount, fp: fpCount, fn: fnCount, automation, score, tpIoUs };
        });

        // Step 2: Filter valid rows (automation >= 15%)
        const validRows = pRowsFine.filter(r => r.automation >= MIN_AUTOMATION);

        // Step 3: Production target — F1-based selection from validRows (same as Charts)
        let bestF1 = 0;
        let bestT = experiment.confidence || 0.45;
        if (validRows.length > 0) {
            const productionChosen = validRows.reduce((prev, curr) => {
                const prevF1 = calcF1(prev.tp, prev.fp, prev.fn);
                const currF1 = calcF1(curr.tp, curr.fp, curr.fn);
                return currF1 >= prevF1 ? curr : prev;
            });
            bestF1 = calcF1(productionChosen.tp, productionChosen.fp, productionChosen.fn);
            bestT = productionChosen.t;
        }

        // Step 4: Model Ceiling — automation-based drop detection (same as Charts)
        let ceilingT = 0.9;
        if (validRows.length >= 2) {
            const aMax = Math.max(...validRows.map(r => r.automation));
            const dropTrigger = Math.max(0.10, 0.25 * aMax);
            let firstMaterialDrop = null;
            let maxDrop = { t: null, val: -1 };

            for (let i = 0; i < validRows.length - 1; i++) {
                const drop = validRows[i].automation - validRows[i + 1].automation;
                if (drop > maxDrop.val) {
                    maxDrop = { t: validRows[i + 1].t, val: drop };
                }
                if (!firstMaterialDrop && drop >= dropTrigger) {
                    firstMaterialDrop = { t: validRows[i + 1].t, val: drop };
                }
            }

            if (firstMaterialDrop) ceilingT = firstMaterialDrop.t;
            else if (maxDrop.t !== null) ceilingT = maxDrop.t;
        }

        const prodT = bestT; // Use the optimized target as the production basis

        // --- 2. SCALE DIAGNOSTICS LOGIC ---
        const sizes = ['tiny', 'small', 'medium', 'large'];
        const sizeLabels = { tiny: 'Tiny', small: 'Small', medium: 'Medium', large: 'Large' };

        // Get unique classes
        const allPossibleClasses = new Set();
        [...tpList, ...fnList].forEach(d => allPossibleClasses.add(d.class_name || d.class || 'Other'));
        const uniqueClasses = Array.from(allPossibleClasses);

        const scaleAnalysis = sizes.map(sz => {
            // Global metrics for this size
            const szTPs = tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || 0) >= prodT);
            const szGT = tpList.filter(d => getSizeGrp(d.bbox) === sz).length +
                fnList.filter(d => getSizeGrp(d.bbox) === sz).length;
            const yieldAtProd = szGT > 0 ? (szTPs.length / szGT) * 100 : 0;

            // Class-wise metrics for this size
            const classBreakdown = uniqueClasses.map(cls => {
                const clsTPs = tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || 0) >= prodT && (d.class_name === cls || d.class === cls));
                const clsGT = tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.class_name === cls || d.class === cls)).length +
                    fnList.filter(d => getSizeGrp(d.bbox) === sz && (d.class_name === cls || d.class === cls)).length;
                return {
                    name: cls,
                    reliability: clsGT > 0 ? (clsTPs.length / clsGT) * 100 : 0,
                    samples: clsGT
                };
            }).filter(c => c.samples > 0);

            return {
                size: sz,
                label: sizeLabels[sz],
                gt: szGT,
                atProd: parseFloat(yieldAtProd.toFixed(1)),
                classes: classBreakdown
            };
        });



        // 1.3 Generate Multi-Point Story (Simple English)
        const observations = [];
        const actions = [];
        let storyColor = '#52c41a'; // Default Green (Optimal)
        let mainHeadline = "Size Performance is Optimal";

        // Logic to build the story based on class-wise failures
        const weakPoints = scaleAnalysis.filter(s => s.gt > 0 && s.atProd < 70);

        if (weakPoints.length > 0) {
            storyColor = weakPoints.some(s => s.atProd < 40) ? '#ff4d4f' : '#faad14';
            mainHeadline = weakPoints.some(s => s.atProd < 40) ? "Critical Gaps in Size Detection" : "Size Reliability Needs Attention";

            weakPoints.forEach(wp => {
                const worstClass = wp.classes.sort((a, b) => a.reliability - b.reliability)[0];
                if (wp.atProd < 70) {
                    observations.push(`The model is struggling to find ${wp.label} objects, achieving only ${wp.atProd}% reliability.`);
                    if (worstClass && worstClass.reliability < 50) {
                        observations.push(`Specifically, the class "${worstClass.name}" is getting missed frequently at this size.`);
                    }
                }

                // intuitive expert advice
                if (wp.size === 'tiny' || wp.size === 'small') {
                    if (!actions.includes("Pixel Perfection: Tiny items have very few pixels. If your label is even slightly off-center, the model will miss it. Audit these boxes for a tight fit.")) {
                        actions.push("Pixel Perfection: Tiny items have very few pixels. If your label is even slightly off-center, the model will miss it. Audit these boxes for a tight fit.");
                    }
                    if (!actions.includes("Model Blindness: Items might be too small for the camera's resolution. Add zoomed-in data to show the model the fine details.")) {
                        actions.push("Model Blindness: Items might be too small for the camera's resolution. Add zoomed-in data to show the model the fine details.");
                    }
                } else if (wp.size === 'large') {
                    if (!actions.includes("Empty Box Space: Check if your 'Large' boxes have too much background inside. The model learns the wrong shape if the box is loose.")) {
                        actions.push("Empty Box Space: Check if your 'Large' boxes have too much background inside. The model learns the wrong shape if the box is loose.");
                    }
                    if (!actions.includes("Data Shortage: You need more pictures where this object is large. The model hasn't seen enough 'Up-close' examples.")) {
                        actions.push("Data Shortage: You need more pictures where this object is large. The model hasn't seen enough 'Up-close' examples.");
                    }
                }
            });

            if (actions.length === 0) {
                actions.push("Improve data balance: Add more variety of the underperforming sizes in your next dataset.");
            }
        } else {
            observations.push("High Consistency: The model performs uniformly across all size groups.");
            observations.push("No major blind spots: Scaling behavior is predictable and stable.");
            actions.push("Maintain quality: The current scale distribution is healthy. No changes needed.");
        }

        const scaleStory = {
            headline: mainHeadline,
            observations,
            actions,
            color: storyColor
        };

        const scaleNarrativeCheck = observations.length > 0 ? observations.join(' ') : "Scale performance is stable.";


        // --- 3. COGNITIVE SPATIAL ENGINE (ADVANCED) ---
        // Normalize frame bounds
        let maxX = 1, maxY = 1;
        [...tpList, ...fpList, ...fnList].forEach(d => {
            if (d.bbox) {
                maxX = Math.max(maxX, d.bbox[2]);
                maxY = Math.max(maxY, d.bbox[3]);
            }
        });

        // Sync and analyze errors with Production Target
        const syncFP = fpList.filter(d => (d.confidence || 0) >= prodT).map(d => ({ ...d, _isFP: true }));
        const syncFN = [...fnList, ...tpList.filter(d => (d.confidence || 0) < prodT)].map(d => ({ ...d, _isFP: false }));
        const spatialErrors = [...syncFP, ...syncFN];

        const getGridStats = (errors) => {
            const grid = Array(9).fill(0).map(() => ({ fp: 0, fn: 0, total: 0, classErrors: {} }));
            errors.forEach(d => {
                if (d.bbox) {
                    const cx = (d.bbox[0] + d.bbox[2]) / 2;
                    const cy = (d.bbox[1] + d.bbox[3]) / 2;
                    const col = Math.min(2, Math.floor((cx / maxX) * 3));
                    const row = Math.min(2, Math.floor((cy / maxY) * 3));
                    const idx = row * 3 + col;
                    if (idx >= 0 && idx < 9) {
                        const cls = d.class_name || d.class || 'Unknown';
                        grid[idx].classErrors[cls] = (grid[idx].classErrors[cls] || 0) + 1;
                        if (d._isFP) grid[idx].fp++;
                        else grid[idx].fn++;
                        grid[idx].total++;
                    }
                }
            });
            const totalE = errors.length || 1;
            return grid.map((tile, i) => ({
                ...tile,
                label: `${String.fromCharCode(65 + Math.floor(i / 3))}${(i % 3) + 1}`,
                density: parseFloat(((tile.total / totalE) * 100).toFixed(1))
            }));
        };

        const globalSpatial = getGridStats(spatialErrors);
        const hotspots = globalSpatial.filter(t => t.density >= 25).sort((a, b) => b.density - a.density);
        const warmspots = globalSpatial.filter(t => t.density >= 15 && t.density < 25).sort((a, b) => b.density - a.density);

        // --- 3.1 VIRTUAL MULTI-SCALE SCAN (PATTERN CONFLICT) ---
        const szGrps = ['tiny', 'small', 'medium', 'large'];
        const szSnaps = {};
        szGrps.forEach(sz => {
            const szErr = spatialErrors.filter(d => getSizeGrp(d.bbox) === sz);
            if (szErr.length > 5) szSnaps[sz] = getGridStats(szErr);
        });

        // Aggregate Pattern Synthesis (Executive Point of View)
        const getPatterns = (d) => ({
            corners: (d[0].density + d[2].density + d[6].density + d[8].density),
            left: (d[0].density + d[3].density + d[6].density),
            right: (d[2].density + d[5].density + d[8].density),
            top: (d[0].density + d[1].density + d[2].density),
            bottom: (d[6].density + d[7].density + d[8].density),
            center: d[4].density
        });

        const gPatterns = getPatterns(globalSpatial);
        const obs = [];
        const recs = [];

        // Human-readable zone positions
        const zoneNames = { A1: 'top-left', A2: 'top-center', A3: 'top-right', B1: 'center-left', B2: 'center', B3: 'center-right', C1: 'bottom-left', C2: 'bottom-center', C3: 'bottom-right' };
        const describeErrors = (h) => {
            const parts = [];
            if (h.fn > 0) parts.push(`${h.fn} missed object${h.fn > 1 ? 's' : ''}`);
            if (h.fp > 0) parts.push(`${h.fp} false alarm${h.fp > 1 ? 's' : ''}`);
            return parts.length > 0 ? parts.join(' and ') : `${h.total} error${h.total > 1 ? 's' : ''}`;
        };

        // --- ORDER 1: Aggregate Patterns (environmental overview) ---
        if (gPatterns.corners > 30) {
            obs.push(`Corner Clustering: ${gPatterns.corners.toFixed(0)}% of all errors happen in the 4 corner areas of the image.`);
            recs.push("Check Corner Clarity: Verify if lens distortion, dark corners (vignetting), or focus drop-off might be hiding objects near the edges.");
        }
        if (Math.abs(gPatterns.left - gPatterns.right) > 15) {
            const side = gPatterns.left > gPatterns.right ? 'left' : 'right';
            const pct = Math.abs(gPatterns.left - gPatterns.right).toFixed(0);
            obs.push(`Left/Right Imbalance: The ${side} side of the image has ${pct}% more errors than the opposite side. This suggests an environmental factor on that side.`);
            recs.push(`Verify Lighting: Check if persistent shadows, glares, or obstructions exist mainly on the ${side} side of the capture area.`);
        }
        if (Math.abs(gPatterns.top - gPatterns.bottom) > 15) {
            const zone = gPatterns.top > gPatterns.bottom ? 'upper' : 'lower';
            const pct = Math.abs(gPatterns.top - gPatterns.bottom).toFixed(0);
            obs.push(`Top/Bottom Imbalance: The ${zone} half of the image has ${pct}% more errors. This may indicate a camera height or angle issue.`);
            recs.push(`Audit Camera Mounting: Check if camera perspective creates different object visibility or resolution in the ${zone} part of the frame.`);
        }

        // --- ORDER 2: Region Specifics (matches the 3x3 heatmap) ---
        hotspots.forEach(h => {
            const cls = Object.entries(h.classErrors).sort((a, b) => b[1] - a[1])[0];
            const pos = zoneNames[h.label] || h.label;
            const errDesc = describeErrors(h);
            obs.push(`⚠ Critical Zone ${h.label} (${pos}): ${h.density}% of all failures — ${errDesc}. Most affected class: "${cls ? cls[0] : 'unknown'}".`);
            recs.push(`Priority Audit (${h.label}): Manually review "${cls ? cls[0] : 'unknown'}" labels in the ${pos} area of your images. ${h.fn > h.fp ? 'Focus on missing annotations.' : 'Focus on over-sensitive detections.'}`);
        });
        warmspots.forEach(h => {
            const cls = Object.entries(h.classErrors).sort((a, b) => b[1] - a[1])[0];
            const pos = zoneNames[h.label] || h.label;
            const errDesc = describeErrors(h);
            obs.push(`Watch Zone ${h.label} (${pos}): ${h.density}% error density — ${errDesc}. Class: "${cls ? cls[0] : 'unknown'}".`);
        });

        // --- ORDER 3 (LAST): Complete Size Breakdown ---
        const spatialSizeLabels = { tiny: 'Tiny', small: 'Small', medium: 'Medium', large: 'Large' };
        const sizeIssues = [];
        szGrps.forEach(sz => {
            const szErr = spatialErrors.filter(d => getSizeGrp(d.bbox) === sz);
            if (szErr.length > 0) {
                const szFP = szErr.filter(d => d._isFP).length;
                const szFN = szErr.length - szFP;
                const snap = szSnaps[sz];
                const dangerZones = snap ? snap.filter(t => t.density >= 30).sort((a, b) => b.density - a.density) : [];
                const zoneInfo = dangerZones.length > 0 ? ` — danger zone${dangerZones.length > 1 ? 's' : ''}: ${dangerZones.map(z => `${z.label} (${zoneNames[z.label] || z.label}, ${z.density}%)`).join(', ')}` : '';
                const errType = szFN > szFP * 2 ? 'mostly missed objects' : (szFP > szFN * 2 ? 'mostly false alarms' : 'mixed errors');
                sizeIssues.push(`${spatialSizeLabels[sz]}: ${szErr.length} errors (${errType}: ${szFN} missed, ${szFP} false alarms)${zoneInfo}`);
            }
        });
        if (sizeIssues.length > 0) {
            obs.push(`Size Breakdown: ${sizeIssues.join(' · ')}.`);
        }

        // --- ORDER 4 (LAST): Per-Class Summary ---
        const classErrorMap = {};
        spatialErrors.forEach(d => {
            const cls = d.class_name || d.class || 'Unknown';
            if (!classErrorMap[cls]) classErrorMap[cls] = { fp: 0, fn: 0, total: 0 };
            if (d._isFP) classErrorMap[cls].fp++;
            else classErrorMap[cls].fn++;
            classErrorMap[cls].total++;
        });
        const classIssues = Object.entries(classErrorMap)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([cls, v]) => {
                const errType = v.fn > v.fp * 2 ? 'mostly missed' : (v.fp > v.fn * 2 ? 'mostly false alarms' : 'mixed');
                return `"${cls}": ${v.total} errors (${errType}: ${v.fn} missed, ${v.fp} false alarms)`;
            });
        if (classIssues.length > 0) {
            obs.push(`Class Breakdown: ${classIssues.join(' · ')}.`);
        }

        // Final Story Synthesis
        const spatialStory = {
            headline: hotspots.length > 0 ? "Complex Spatial Blind Spots Identified" : (obs.length > 0 ? "Spatial Patterns Require Attention" : "Healthy Spatial Distribution"),
            observations: obs.length > 0 ? obs.slice(0, 10) : ["Model performance is consistent across all frame regions."],
            recommendations: recs.length > 0 ? recs.slice(0, 4) : ["Maintain current spatial diversity in future datasets."],
            color: hotspots.length > 0 ? '#ff4d4f' : (warmspots.length > 0 || obs.length > 0 ? '#faad14' : '#52c41a')
        };

        const spatialData = globalSpatial;
        const spatialNarrative = hotspots.map(h => ({ type: 'urgent', msg: `${h.label} region accounts for ${h.density}% of all errors.` }));




        // --- 4. PRODUCTION STRATEGY LOGIC ---
        // Compute results at production threshold
        const prodTP = tpList.filter(d => (d.confidence || 0) >= prodT).length;
        const prodFP = fpList.filter(d => (d.confidence || 0) >= prodT).length;
        const prodFN = fnList.length + (tpList.length - prodTP);
        const prodF1Val = (prodTP + prodFP) > 0 && (prodTP + prodFN) > 0
            ? (2 * (prodTP / (prodTP + prodFP)) * (prodTP / (prodTP + prodFN))) / ((prodTP / (prodTP + prodFP)) + (prodTP / (prodTP + prodFN)))
            : 0;
        const automationPct = totalGTCount > 0 ? ((prodTP / totalGTCount) * 100).toFixed(0) : 0;

        // Neighbor delta analysis (why not lower / why not higher)
        const CONF_STEP_SIZE = 0.01;
        const tLow = parseFloat((prodT - CONF_STEP_SIZE).toFixed(2));
        const tHigh = parseFloat((prodT + CONF_STEP_SIZE).toFixed(2));

        const getCountsAtT = (t) => {
            const tp = tpList.filter(d => (d.confidence || 0) >= t).length;
            const fp = fpList.filter(d => (d.confidence || 0) >= t).length;
            const fn = fnList.length + (tpList.length - tp);
            return { tp, fp, fn };
        };

        const lowCounts = getCountsAtT(tLow);
        const highCounts = getCountsAtT(tHigh);

        let whyNotLower = '';
        if (lowCounts) {
            const dtpDown = lowCounts.tp - prodTP;
            const dfpDown = lowCounts.fp - prodFP;
            whyNotLower = dfpDown > dtpDown
                ? `FP rises faster than TP (more false alarms than value)`
                : `only small TP gain with higher FP cost`;
        }

        let whyNotHigher = '';
        if (highCounts) {
            whyNotHigher = `FN increases and Automation drops (more missed objects)`;
        }

        // Training mode: Pre-wall target (same as Charts — uses validRows pre-filtered by ceiling)
        const preWallRows = validRows.filter(r => r.t <= ceilingT);
        const trainTarget = preWallRows.length > 0
            ? preWallRows.reduce((prev, curr) => curr.score >= prev.score ? curr : prev)
            : null;

        // TargetIoU (P75 of matched IoUs at training target)
        const trainTPItems = trainTarget
            ? tpList.filter(d => (d.confidence || 0) >= trainTarget.t)
            : [];
        const matchedIoUs = trainTPItems.map(d => d.matched_iou || 0).filter(v => v > 0).sort((a, b) => a - b);
        const targetIoU = matchedIoUs.length > 0
            ? (() => { const pos = (matchedIoUs.length - 1) * 0.75; const base = Math.floor(pos); return matchedIoUs[base + 1] !== undefined ? matchedIoUs[base] + (pos - base) * (matchedIoUs[base + 1] - matchedIoUs[base]) : matchedIoUs[base]; })()
            : 0;

        // Training diagnosis
        const trainDiagnosis = trainTarget && (trainTarget.fn / totalGTCount) > 0.50
            ? 'Recall/Coverage limit (many missed objects). Add more diverse training data.'
            : 'Improve confidence strength to push ceiling right. Model needs stronger feature extraction.';

        // Generate structured briefing logs
        const productionLog = [];
        productionLog.push(`[CEILING] MAXIMUM SAFE CONFIDENCE at ~${(ceilingT * 100).toFixed(0)}%: TP collapses beyond this point.`);
        productionLog.push(`[OPTIMAL] ${(prodT * 100).toFixed(0)}% confidence (Best F1 Score).`);
        productionLog.push(`[RESULTS] ${prodTP} correct, ${prodFP} false alarms, ${prodFN} missed (F1=${(prodF1Val * 100).toFixed(1)}%).`);
        if (whyNotLower) productionLog.push(`[WHY NOT ${(tLow * 100).toFixed(0)}%] ${whyNotLower}.`);
        if (whyNotHigher) productionLog.push(`[WHY NOT ${(tHigh * 100).toFixed(0)}%] ${whyNotHigher}.`);

        const trainingLog = [];
        trainingLog.push(`[CEILING] MAXIMUM SAFE CONFIDENCE at ~${(ceilingT * 100).toFixed(0)}% (structural drop zone).`);
        if (trainTarget) {
            trainingLog.push(`[TARGET] Pre-wall confidence: ${(trainTarget.t * 100).toFixed(0)}% (best usable region before collapse).`);
            trainingLog.push(`[AT ${(trainTarget.t * 100).toFixed(0)}%] TP=${trainTarget.tp}, FP=${trainTarget.fp}, FN=${trainTarget.fn} → Automation=${(trainTarget.automation * 100).toFixed(0)}%.`);
        }
        trainingLog.push(`[IoU] Target IoU: ${targetIoU > 0 ? targetIoU.toFixed(2) : 'N/A'} (box quality goal for next training).`);
        trainingLog.push(`[DIAGNOSIS] ${trainDiagnosis}`);

        // Combined readiness log (legacy compatibility)
        const strategyLog = [...productionLog];

        const isReady = bestF1 > 0.6 && ceilingT > 0.6;
        const status = isReady ? "READY" : "NOT READY";
        const action = isReady ? "Recommended for Pilot" : "Not Ready for Production. Retraining Required.";

        // Not-ready reasons (data-backed)
        const notReadyReasons = [];
        if (!isReady) {
            if (bestF1 <= 0.6) notReadyReasons.push(`F1 score (${(bestF1 * 100).toFixed(1)}%) is below 60% minimum threshold`);
            if (ceilingT <= 0.6) notReadyReasons.push(`MAXIMUM SAFE CONFIDENCE (${(ceilingT * 100).toFixed(0)}%) is below 60% stability threshold`);
            if (prodFP > prodTP) notReadyReasons.push(`False alarms (${prodFP}) exceed correct detections (${prodTP})`);
            if (prodFN > prodTP) notReadyReasons.push(`Missed objects (${prodFN}) exceed correct detections (${prodTP})`);
        }


        // --- 4. EXECUTIVE SUMMARY ---
        const isCritical = scaleStory.color === '#ff4d4f' || spatialStory.color === '#ff4d4f' || ceilingT < 0.5;
        const executiveSummary = {
            headline: isCritical ? "CRITICAL ADJUSTMENTS REQUIRED" : (scaleStory.color === '#faad14' || spatialStory.color === '#faad14' ? "CONDITIONAL DEPLOYMENT ONLY" : "READY FOR PILOT DEPLOYMENT"),
            color: isCritical ? '#ff4d4f' : (scaleStory.color === '#faad14' || spatialStory.color === '#faad14' ? '#faad14' : '#52c41a'),
            subtext: isCritical
                ? "The model has significant blind spots that make it unsafe for autonomous operation. Retraining with targeted data is mandatory."
                : (scaleStory.color === '#faad14' || spatialStory.color === '#faad14'
                    ? "The model is functional but has specific limitations. Use with human-in-the-loop verification."
                    : "The model demonstrates high stability across scale, space, and confidence. It is suitable for automated workflows.")
        };


        return {
            tp,
            fp,
            fn,
            precision: p.toFixed(1),
            recall: r.toFixed(1),
            f1: f1.toFixed(1),
            scaleDiagnostic: {
                analysis: scaleAnalysis,
                narrativeText: scaleNarrativeCheck,
                story: scaleStory
            },
            spatialData,
            spatialNarrative,
            spatialStory,
            productionStrategy: {
                ceiling: (ceilingT * 100).toFixed(0),
                target: (bestT * 100).toFixed(0),
                status,
                action,
                log: strategyLog,
                productionLog,
                trainingLog,
                notReadyReasons,
                automationPct
            },
            executiveSummary
        };
    }, [qualityStats, experiment, verifications]);

    // --- DATA EXTRACTION (For Section 1) ---
    // Use reportData like logic but inside component since we calculate predictionAnalytics inside
    const reportData = useMemo(() => {
        if (!training) return null;

        // Parse metrics
        let metrics = {};
        try {
            metrics = typeof training.metrics === 'string'
                ? JSON.parse(training.metrics)
                : (training.metrics || {});
        } catch (e) { }

        // Parse config snapshot
        let config = {};
        try {
            if (typeof training.training_config_snapshot === 'string') {
                const lines = training.training_config_snapshot.split('\n');
                lines.forEach(line => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        const key = line.substring(0, colonIndex).trim();
                        const value = line.substring(colonIndex + 1).trim();
                        if (key && value !== 'null') config[key] = value;
                    }
                });
            } else {
                config = training.training_config_snapshot || {};
            }
        } catch (e) { }

        const validation = metrics.validation || {};
        const classes = metrics.classes || [];
        const isSeg = training.taskType === 'segmentation';

        // Helper to calculate F1
        const calculateF1 = (precision, recall) => {
            if (!precision || !recall) return 0;
            return (2 * precision * recall) / (precision + recall);
        };

        const boxF1 = calculateF1(validation.box_p, validation.box_r);
        const maskF1 = isSeg ? calculateF1(validation.mask_p, validation.mask_r) : 0;

        return {
            // Basic Info
            name: training.name,
            taskType: isSeg ? 'Instance Segmentation' : 'Object Detection',
            status: training.status,
            date: new Date(training.date).toLocaleDateString(),
            isSeg,

            // Dataset Details
            dataset: {
                trainingImages: validation.images || 0,
                totalInstances: validation.instances || 0,
                imageSize: config.imgsz || 640,
                epochs: training.epochs || config.epochs || 0,
                classCount: classes.length || 0,
                batchSize: config.batch || 16
            },

            // Box Metrics
            box: {
                map50: (validation.box_map50 || 0) * 100,
                map50_95: (validation.box_map50_95 || 0) * 100,
                precision: (validation.box_p || 0) * 100,
                recall: (validation.box_r || 0) * 100,
                f1: boxF1 * 100
            },
            // Mask Metrics (if segmentation)
            mask: isSeg ? {
                map50: (validation.mask_map50 || 0) * 100,
                map50_95: (validation.mask_map50_95 || 0) * 100,
                precision: (validation.mask_p || 0) * 100,
                recall: (validation.mask_r || 0) * 100,
                f1: maskF1 * 100
            } : null,

            // Class Performance
            classes: classes.map(c => {
                const bF1 = calculateF1(c.box_p, c.box_r);
                const mF1 = isSeg ? calculateF1(c.mask_p, c.mask_r) : 0;
                return {
                    name: c.class || c.name || 'Unknown', // Correctly map class name
                    // Box
                    map50: ((c.box_map50 || 0) * 100).toFixed(1),
                    precision: ((c.box_p || 0) * 100).toFixed(1),
                    recall: ((c.box_r || 0) * 100).toFixed(1),
                    f1: (bF1 * 100).toFixed(1),
                    // Mask
                    mask_map50: isSeg ? ((c.mask_map50 || 0) * 100).toFixed(3) : undefined,
                    mask_precision: isSeg ? ((c.mask_p || 0) * 100).toFixed(1) : undefined,
                    mask_recall: isSeg ? ((c.mask_r || 0) * 100).toFixed(1) : undefined,
                    mask_f1: isSeg ? (mF1 * 100).toFixed(1) : undefined,
                    instances: c.instances || 0
                };
            }).sort((a, b) => parseFloat(b.map50) - parseFloat(a.map50))
        };
    }, [training]);


    if (!reportData || (!kpis && isSplit)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                <div style={{ marginTop: '1rem', color: '#888' }}>Generating Training Report...</div>
            </div>
        );
    }

    return (
        <div className="report-container" style={{ padding: '2rem', background: '#fff', minHeight: '100%' }}>
            {/* Header section */}
            <div className="report-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <Title level={2} style={{ color: '#1890ff', marginBottom: '0.5rem' }}>Training Report</Title>
                <Text type="secondary">Comprehensive analysis of model performance and deployment readiness.</Text>
            </div>

            {/* SECTION 01: TRAINING PERFORMANCE (RESTORED DESIGN) */}
            <div className="report-section" style={{ marginBottom: '3rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <Title level={2} style={{ color: '#722ed1', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ExperimentOutlined /> Training Analytics Detail
                    </Title>
                    <Text type="secondary" style={{ fontSize: '16px' }}>Comprehensive analysis of the training process and model performance</Text>
                    <Divider />
                </div>

                {/* 1. DATASET DETAILS TABLE */}
                <div style={{ marginBottom: '3rem' }}>
                    <Title level={4} style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileTextOutlined /> Dataset Details
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>Information about the data used to train and validate this model.</Text>

                    <Card size="small" className="dataset-details-card">
                        <Table
                            dataSource={[
                                { item: 'Training Epochs', value: reportData.dataset.epochs, meaning: `The AI studied the data ${reportData.dataset.epochs} times to learn.` },
                                { item: 'Validation Images', value: reportData.dataset.trainingImages, meaning: 'Number of images used to test the AI after training.' },
                                { item: 'Total Instances', value: reportData.dataset.totalInstances, meaning: 'Total number of labeled objects in the validation set.' },
                                { item: 'Image Size', value: `${reportData.dataset.imageSize}px`, meaning: `All images were resized to ${reportData.dataset.imageSize}×${reportData.dataset.imageSize} pixels.` },
                                { item: 'Classes', value: reportData.dataset.classCount, meaning: reportData.classes.map(c => c.name).join(', ') }
                            ]}
                            pagination={false}
                            size="middle"
                            rowKey="item"
                            columns={[
                                { title: 'Item', dataIndex: 'item', key: 'item', width: '25%', render: t => <Text strong>{t}</Text> },
                                { title: 'Value', dataIndex: 'value', key: 'value', width: '25%', render: t => <Text strong style={{ fontSize: '15px' }}>{t}</Text> },
                                { title: 'What it means', dataIndex: 'meaning', key: 'meaning', render: t => <Text type="secondary">{t}</Text> }
                            ]}
                        />
                    </Card>
                </div>

                {/* 2. BOX METRICS (GREEN THEME) */}
                <div style={{ marginBottom: '3rem' }}>
                    <Title level={4} style={{ color: '#389e0d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AimOutlined /> Box Detection Metrics
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>How well the AI draws boxes around objects. Higher values = better performance.</Text>

                    <Row gutter={[24, 24]}>
                        <Col xs={24} sm={12} md={6}>
                            <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #b7eb8f' }}>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>PRECISION</Text>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#52c41a', margin: '12px 0' }}>
                                    {reportData.box.precision.toFixed(1)}%
                                </div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {Math.round(reportData.box.precision)} out of 100 detections were correct.
                                </Text>
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #69c0ff' }}>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>RECALL</Text>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1890ff', margin: '12px 0' }}>
                                    {reportData.box.recall.toFixed(1)}%
                                </div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    The AI found {Math.round(reportData.box.recall)} out of 100 real objects.
                                </Text>
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #d3adf7' }}>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>F1 SCORE</Text>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#722ed1', margin: '12px 0' }}>
                                    {reportData.box.f1.toFixed(1)}%
                                </div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    Balance between precision and recall.
                                </Text>
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #ffadd2' }}>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>MAP@50</Text>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fa8c16', margin: '12px 0' }}>
                                    {(reportData.box.map50 / 100).toFixed(3)}
                                </div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    Average accuracy of box placement.
                                </Text>
                            </Card>
                        </Col>
                    </Row>
                </div>

                {/* 2.5. MASK METRICS (CYAN THEME - IF SEGMENTATION) */}
                {reportData.isSeg && reportData.mask && (
                    <div style={{ marginBottom: '3rem' }}>
                        <Title level={4} style={{ color: '#13c2c2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AimOutlined /> Mask Segmentation Metrics
                        </Title>
                        <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>How well the AI draws pixel-perfect masks around objects.</Text>

                        <Row gutter={[24, 24]}>
                            <Col xs={24} sm={12} md={6}>
                                <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #87e8de' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>MASK PRECISION</Text>
                                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#13c2c2', margin: '12px 0' }}>
                                        {reportData.mask.precision.toFixed(1)}%
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {Math.round(reportData.mask.precision)} out of 100 mask detections were correct.
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #69c0ff' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>MASK RECALL</Text>
                                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1890ff', margin: '12px 0' }}>
                                        {reportData.mask.recall.toFixed(1)}%
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        The AI segmented {Math.round(reportData.mask.recall)} out of 100 real objects.
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #d3adf7' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>MASK F1</Text>
                                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#722ed1', margin: '12px 0' }}>
                                        {reportData.mask.f1.toFixed(1)}%
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Balance between mask precision and recall.
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card className="metric-card" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #ffadd2' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>MASK MAP@50</Text>
                                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#eb2f96', margin: '12px 0' }}>
                                        {(reportData.mask.map50 / 100).toFixed(3)}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Average accuracy of mask placement.
                                    </Text>
                                </Card>
                            </Col>
                        </Row>
                    </div>
                )}

                {/* 4. CLASS PERFORMANCE TABLE */}
                <div style={{ marginBottom: '1rem' }}>
                    <Title level={4} style={{ color: '#722ed1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircleOutlined /> Class-wise Performance
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>How well the AI performs for each type of object it was trained to detect.</Text>

                    <Table
                        dataSource={reportData.classes}
                        pagination={false}
                        size="small"
                        rowKey="name"
                        columns={[
                            { title: 'Class', dataIndex: 'name', key: 'name', render: t => <Text strong>{t}</Text> },
                            { title: 'Box Precision', dataIndex: 'precision', key: 'precision', render: t => `${t}%` },
                            { title: 'Box Recall', dataIndex: 'recall', key: 'recall', render: t => `${t}%` },
                            {
                                title: 'Box F1',
                                dataIndex: 'f1',
                                key: 'f1',
                                render: t => `${t}%`
                            },
                            { title: 'Box mAP@50', dataIndex: 'map50', key: 'map50', render: t => (parseFloat(t) / 100).toFixed(3) },
                            ...(reportData.isSeg ? [
                                { title: 'Mask Precision', dataIndex: 'mask_precision', key: 'mask_precision', render: t => t ? `${t}%` : 'N/A' },
                                { title: 'Mask Recall', dataIndex: 'mask_recall', key: 'mask_recall', render: t => t ? `${t}%` : 'N/A' },
                                { title: 'Mask F1', dataIndex: 'mask_f1', key: 'mask_f1', render: t => t ? `${t}%` : 'N/A' },
                                { title: 'Mask mAP@50', dataIndex: 'mask_map50', key: 'mask_map50', render: t => t ? (parseFloat(t) / 100).toFixed(3) : 'N/A' }
                            ] : [])
                        ]}
                    />
                </div>
            </div>

            {/* SECTION 02: PREDICTION ANALYTICS */}
            <div className="report-section" style={{ marginBottom: '2rem' }}>
                <Title level={2} style={{ color: '#00f2ff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AimOutlined /> Section 02: Prediction Analytics
                </Title>

                {predictionAnalytics ? (
                    <>
                        {/* Overall Prediction Statistics */}
                        <Row gutter={[16, 16]} style={{ marginBottom: '1rem' }}>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        Total Detections
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#00f2ff' }}>
                                        {predictionAnalytics.scope.totalDetections}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Across all images
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        Avg. Confidence
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#00f2ff' }}>
                                        {predictionAnalytics.scope.avgConfidence}%
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Mean confidence score
                                    </Text>
                                </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                        GT Coverage
                                    </Text>
                                    <Title level={2} style={{ margin: 0, color: '#722ed1' }}>
                                        {predictionAnalytics.scope.gtCoverage}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                        Ground truth objects available
                                    </Text>
                                </Card>
                            </Col>
                        </Row>

                        {/* Prediction Performance Metrics */}
                        <div style={{ marginBottom: '2rem' }}>
                            <Title level={4} style={{ fontSize: '14px', marginBottom: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Performance Metrics (vs Ground Truth)
                            </Title>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={4}>
                                    <Card size="small" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #52c41a' }}>
                                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Precision</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{predictionAnalytics.scope.precision.toFixed(1)}%</div>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>Correctness</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} sm={4}>
                                    <Card size="small" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #1890ff' }}>
                                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Recall</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{predictionAnalytics.scope.recall.toFixed(1)}%</div>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>Completeness</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} sm={4}>
                                    <Card size="small" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #722ed1' }}>
                                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>F1 Score</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>{predictionAnalytics.scope.f1}%</div>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>Harmonic Mean</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} sm={4}>
                                    <Card size="small" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #52c41a' }}>
                                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>True Positive</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{predictionAnalytics.scope.tp}</div>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>Correct Detections</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} sm={4}>
                                    <Card size="small" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #fa8c16' }}>
                                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>False Positives</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>{predictionAnalytics.scope.fp}</div>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>Extra Detections</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} sm={4}>
                                    <Card size="small" style={{ textAlign: 'center', height: '100%', borderTop: '3px solid #ff4d4f' }}>
                                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Missing (FN)</Text>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>{predictionAnalytics.scope.fn}</div>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>Undetected Objects</Text>
                                    </Card>
                                </Col>
                            </Row>
                        </div>

                        {/* Class Distribution Table */}
                        <Card size="small" title="Class Distribution" style={{ marginBottom: '16px' }}>
                            <Table
                                dataSource={predictionAnalytics.scope.classDistribution}
                                pagination={false}
                                size="small"
                                rowKey="class"
                                columns={[
                                    {
                                        title: 'Class Name',
                                        dataIndex: 'class',
                                        key: 'class',
                                        render: (text) => <Tag color="blue">{text}</Tag>
                                    },
                                    {
                                        title: 'Detections',
                                        dataIndex: 'count',
                                        key: 'count',
                                        align: 'center',
                                        render: (count) => <Text strong>{count}</Text>
                                    },
                                    {
                                        title: 'Distribution',
                                        dataIndex: 'percentage',
                                        key: 'percentage',
                                        align: 'right',
                                        render: (pct) => <Text type="secondary">{pct.toFixed(1)}%</Text>
                                    }
                                ]}
                            />
                        </Card>

                        {/* Confidence Range Breakdown */}
                        <Card size="small" title="Confidence Range Breakdown">
                            <Table
                                dataSource={predictionAnalytics.scope.confidenceRanges}
                                pagination={false}
                                size="small"
                                rowKey="range"
                                columns={[
                                    {
                                        title: 'Confidence Range',
                                        dataIndex: 'range',
                                        key: 'range',
                                        render: (text) => <Tag>{text}</Tag>
                                    },
                                    {
                                        title: 'Total Detections',
                                        dataIndex: 'count',
                                        key: 'count',
                                        align: 'center',
                                        render: (count) => <Text strong>{count}</Text>
                                    },
                                    {
                                        title: 'Distribution',
                                        dataIndex: 'percentage',
                                        key: 'percentage',
                                        align: 'right',
                                        render: (pct) => <Text type="secondary">{pct.toFixed(1)}%</Text>
                                    }
                                ]}
                            />
                        </Card>
                    </>
                ) : (
                    <Card style={{ border: '1px dashed #ccc', textAlign: 'center', padding: '2rem' }}>
                        <Text type="secondary">Run predictions to unlock detailed analytics.</Text>
                    </Card>
                )}
            </div>

            {/* SECTION 03: EVIDENCE-BASED DIAGNOSTICS */}
            {kpis && kpis.scaleDiagnostic && kpis.spatialData && (
                <div className="report-section" style={{ marginTop: '3rem', marginBottom: '3rem' }}>
                    <Title level={2} style={{ color: '#722ed1', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CheckCircleOutlined /> Section 03: Evidence-Based Diagnostics
                    </Title>

                    {/* 3.0 EXECUTIVE SUMMARY BANNER */}
                    <div style={{
                        marginBottom: '2rem',
                        padding: '16px 24px',
                        background: kpis.executiveSummary.color === '#52c41a' ? '#f6ffed' : (kpis.executiveSummary.color === '#ff4d4f' ? '#fff1f0' : '#fffbe6'),
                        border: `1px solid ${kpis.executiveSummary.color}`,
                        borderRadius: '4px',
                        borderLeft: `6px solid ${kpis.executiveSummary.color}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {kpis.executiveSummary.color === '#52c41a' ? <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} /> :
                                (kpis.executiveSummary.color === '#ff4d4f' ? <CloseCircleOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} /> :
                                    <WarningOutlined style={{ fontSize: '24px', color: '#faad14' }} />)}

                            <div>
                                <Title level={4} style={{ margin: 0, color: kpis.executiveSummary.color, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {kpis.executiveSummary.headline}
                                </Title>
                                <Text style={{ color: '#555' }}>
                                    {kpis.executiveSummary.subtext}
                                </Text>
                            </div>
                        </div>
                    </div>

                    <Text type="secondary" style={{ display: 'block', marginBottom: '1.5rem' }}>
                        Deep-dive analysis of model failures by object size and spatial location.
                    </Text>

                    {/* 3.1 SCALE FIDELITY ANALYSIS (STORY MODE) */}
                    <Card size="small" title={
                        <Space>
                            <ExperimentOutlined style={{ color: '#722ed1' }} />
                            <span>3.1 Size Performance (Scale Fidelity)</span>
                        </Space>
                    } style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            {/* Left: The Story */}
                            <div style={{ flex: 1, minWidth: '350px' }}>
                                <Title level={4} style={{ marginTop: 0, color: kpis.scaleDiagnostic.story.color, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                    {kpis.scaleDiagnostic.story.headline}
                                </Title>

                                <div style={{ marginBottom: '1rem' }}>
                                    <Text strong style={{ color: '#555', display: 'block', marginBottom: '4px', fontSize: '13px' }}>OBSERVATIONS:</Text>
                                    <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                        {kpis.scaleDiagnostic.story.observations.map((obs, i) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>
                                                <Text style={{ color: '#555', fontSize: '14px' }}>{obs}</Text>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div style={{ background: kpis.scaleDiagnostic.story.color === '#52c41a' ? '#f6ffed' : '#fffbe6', border: `1px solid ${kpis.scaleDiagnostic.story.color === '#52c41a' ? '#b7eb8f' : '#ffe58f'}`, padding: '12px', borderRadius: '4px' }}>
                                    <Text strong style={{ color: kpis.scaleDiagnostic.story.color === '#52c41a' ? '#389e0d' : '#d48806', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                                        <BulbOutlined /> RECOMMENDATIONS:
                                    </Text>
                                    <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                        {kpis.scaleDiagnostic.story.actions.map((act, i) => (
                                            <li key={i} style={{ marginBottom: '2px' }}>
                                                <Text type="secondary" style={{ color: '#555', fontSize: '14px' }}>{act}</Text>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Right: The Data Table */}
                            <div style={{ width: '420px' }}>
                                <Table
                                    dataSource={kpis.scaleDiagnostic.analysis}
                                    pagination={false}
                                    size="small"
                                    rowKey="size"
                                    expandable={{
                                        expandedRowRender: record => (
                                            <div style={{ padding: '4px 0 4px 34px', background: '#fff' }}>
                                                <Table
                                                    dataSource={record.classes}
                                                    pagination={false}
                                                    size="small"
                                                    showHeader={false}
                                                    rowKey="name"
                                                    columns={[
                                                        { title: 'Class', dataIndex: 'name', key: 'name', render: (t) => <Text style={{ fontSize: '13px', color: '#888' }}>{t}</Text> },
                                                        {
                                                            title: 'Reliability',
                                                            dataIndex: 'reliability',
                                                            key: 'reliability',
                                                            align: 'right',
                                                            render: (v) => {
                                                                const color = v >= 80 ? '#52c41a' : (v >= 50 ? '#faad14' : '#ff4d4f');
                                                                return <Text strong style={{ color, fontSize: '13px', opacity: 0.8 }}>{v.toFixed(1)}%</Text>;
                                                            }
                                                        },
                                                        { title: 'Samples', dataIndex: 'samples', key: 'samples', align: 'right', render: (v) => <Text type="secondary" style={{ fontSize: '12px', opacity: 0.7 }}>{v}</Text> }
                                                    ]}
                                                />
                                            </div>
                                        ),
                                        rowExpandable: record => record.classes.length > 1,
                                        defaultExpandAllRows: true
                                    }}
                                    columns={[
                                        {
                                            title: 'Size Group',
                                            dataIndex: 'label',
                                            key: 'label',
                                            render: (text) => <Text strong style={{ fontSize: '14px' }}>{text}</Text>
                                        },
                                        {
                                            title: 'Reliability',
                                            dataIndex: 'atProd',
                                            key: 'atProd',
                                            align: 'right',
                                            render: (val, record) => {
                                                const color = val >= 80 ? '#52c41a' : (val >= 50 ? '#faad14' : '#ff4d4f');
                                                return <Text style={{ color, fontWeight: 'bold', fontSize: '14px' }}>{val}%</Text>;
                                            },
                                            title: (
                                                <div style={{ textAlign: 'right' }}>
                                                    <div>Reliability</div>
                                                    <div style={{ fontSize: '10px', color: '#aaa', fontWeight: 'normal' }}>AT {(kpis.productionStrategy.target)}% TARGET</div>
                                                </div>
                                            )
                                        },
                                        {
                                            title: 'Samples',
                                            dataIndex: 'gt',
                                            key: 'gt',
                                            align: 'right',
                                            render: (val) => <Text type="secondary" style={{ fontSize: '13px' }}>{val}</Text>
                                        }
                                    ]}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* 3.2 SPATIAL BIAS ANALYSIS */}
                    <Card size="small" title={
                        <Space>
                            <AimOutlined style={{ color: '#eb2f96' }} />
                            <span>3.2 Spatial Bias Analysis (Blind Spots)</span>
                        </Space>
                    }>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            {/* Left: The Story */}
                            <div style={{ flex: 1, minWidth: '350px' }}>
                                <Title level={4} style={{ marginTop: 0, color: kpis.spatialStory.color, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                    {kpis.spatialStory.headline}
                                </Title>

                                <div style={{ marginBottom: '1rem' }}>
                                    <Text strong style={{ color: '#555', display: 'block', marginBottom: '4px', fontSize: '13px' }}>OBSERVATIONS:</Text>
                                    <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                        {kpis.spatialStory.observations.map((obs, i) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>
                                                <Text style={{ color: '#555', fontSize: '14px' }}>{obs}</Text>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div style={{ background: kpis.spatialStory.color === '#52c41a' ? '#f6ffed' : (kpis.spatialStory.color === '#faad14' ? '#fffbe6' : '#fff1f0'), border: `1px solid ${kpis.spatialStory.color === '#52c41a' ? '#b7eb8f' : (kpis.spatialStory.color === '#faad14' ? '#ffe58f' : '#ffa39e')}`, padding: '12px', borderRadius: '4px' }}>
                                    <Text strong style={{ color: kpis.spatialStory.color === '#52c41a' ? '#389e0d' : (kpis.spatialStory.color === '#faad14' ? '#d48806' : '#cf1322'), display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                                        <BulbOutlined /> RECOMMENDATIONS:
                                    </Text>
                                    <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                        {kpis.spatialStory.recommendations.map((act, i) => (
                                            <li key={i} style={{ marginBottom: '2px' }}>
                                                <Text type="secondary" style={{ color: '#555', fontSize: '14px' }}>{act}</Text>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Right: 3x3 Grid Visualization */}
                            <div style={{ width: '180px', marginTop: '4px' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '4px',
                                    aspectRatio: '1.2',
                                    background: '#f9f9f9',
                                    border: '1px solid #eee',
                                    padding: '6px',
                                    borderRadius: '4px'
                                }}>
                                    {kpis.spatialData.map((tile, i) => (
                                        <div key={i} style={{
                                            background: tile.density > 25 ? '#ff4d4f' : (tile.density > 15 ? '#faad14' : '#f0f0f0'),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                            border: '1px solid #fff',
                                            borderRadius: '2px',
                                            opacity: tile.density > 0 ? 0.8 : 0.3,
                                            cursor: 'default',
                                            transition: 'all 0.3s'
                                        }} title={`${tile.label}: ${tile.density}% errors`}>
                                            <Text strong style={{ fontSize: '12px', color: tile.density > 15 ? '#fff' : '#595959' }}>
                                                {tile.density > 0 ? `${tile.density}%` : '0%'}
                                            </Text>
                                            <Text style={{ fontSize: '9px', color: tile.density > 15 ? '#eee' : '#999' }}>{tile.label}</Text>
                                        </div>
                                    ))}
                                </div>
                                <Text type="secondary" style={{ fontSize: '10px', display: 'block', textAlign: 'center', marginTop: '6px', opacity: 0.6 }}>ERROR DENSITY HEATMAP</Text>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* SECTION 04: DEPLOYMENT READINESS */}
            {kpis && kpis.productionStrategy && (
                <div className="report-section" style={{ marginTop: '3rem', marginBottom: '3rem' }}>
                    <Title level={2} style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CloudSyncOutlined /> Section 04: Deployment Readiness
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1.5rem' }}>
                        Automated stability audit to determine if the model is ready for live production use.
                    </Text>

                    <Row gutter={16}>
                        {/* 4.1 RELIABILITY LIMIT */}
                        <Col span={6}>
                            <Card size="small" style={{ background: '#f9f9f9', textAlign: 'center', height: '100%' }}>
                                <Text strong style={{ color: '#722ed1', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Reliability Limit</Text>
                                <Title level={2} style={{ margin: '8px 0', color: '#722ed1' }}>
                                    {kpis.productionStrategy.ceiling}%
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>Maximum Confidence Score</Text>
                            </Card>
                        </Col>
                        {/* 4.2 OPTIMAL BALANCE */}
                        <Col span={6}>
                            <Card size="small" style={{ background: '#f0f9ff', textAlign: 'center', height: '100%', borderColor: '#69c0ff' }}>
                                <Text strong style={{ color: '#1890ff', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Optimal Balance Point</Text>
                                <Title level={2} style={{ margin: '8px 0', color: '#1890ff' }}>
                                    {kpis.productionStrategy.target}%
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>Recommended Confidence Setting</Text>
                            </Card>
                        </Col>
                        {/* 4.3 AUTOMATION */}
                        <Col span={6}>
                            <Card size="small" style={{ background: '#f6ffed', textAlign: 'center', height: '100%', borderColor: '#b7eb8f' }}>
                                <Text strong style={{ color: '#389e0d', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Automation Rate</Text>
                                <Title level={2} style={{ margin: '8px 0', color: '#389e0d' }}>
                                    {kpis.productionStrategy.automationPct}%
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>% of real objects found by model</Text>
                            </Card>
                        </Col>
                        {/* 4.4 PILOT READINESS */}
                        <Col span={6}>
                            <Card size="small" style={{ background: kpis.productionStrategy.status === 'READY' ? '#f6ffed' : '#fff1f0', textAlign: 'center', height: '100%', borderColor: kpis.productionStrategy.status === 'READY' ? '#b7eb8f' : '#ffa39e' }}>
                                <Text strong style={{ color: kpis.productionStrategy.status === 'READY' ? '#52c41a' : '#ff4d4f', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>DEPLOYMENT STATUS</Text>
                                <Title level={2} style={{ margin: '8px 0', color: kpis.productionStrategy.status === 'READY' ? '#52c41a' : '#ff4d4f' }}>
                                    {kpis.productionStrategy.status}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>{kpis.productionStrategy.action}</Text>
                            </Card>
                        </Col>
                    </Row>

                    {/* NOT READY REASONS */}
                    {kpis.productionStrategy.notReadyReasons && kpis.productionStrategy.notReadyReasons.length > 0 && (
                        <div style={{ marginTop: '1rem', padding: '12px', background: '#fff2e8', borderRadius: '4px', border: '1px solid #ffbb96' }}>
                            <Text strong style={{ color: '#d4380d', display: 'block', marginBottom: '6px', fontSize: '12px', textTransform: 'uppercase' }}>⚠ Why Not Ready:</Text>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                {kpis.productionStrategy.notReadyReasons.map((reason, idx) => (
                                    <li key={idx} style={{ color: '#ad4e00', fontSize: '12px', marginBottom: '2px' }}>{reason}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* DUAL BRIEFING: PRODUCTION + TRAINING */}
                    <Row gutter={16} style={{ marginTop: '1rem' }}>
                        {/* PRODUCTION ASSESSMENT */}
                        <Col span={12}>
                            <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: '4px', border: '1px solid #d9d9d9', fontFamily: 'monospace', height: '100%' }}>
                                <Text strong style={{ color: '#1890ff', display: 'block', marginBottom: '6px', fontSize: '12px', textTransform: 'uppercase' }}>🔍 Production Assessment</Text>
                                <ul style={{ paddingLeft: '16px', margin: 0 }}>
                                    {(kpis.productionStrategy.productionLog || []).map((line, idx) => (
                                        <li key={idx} style={{ color: '#595959', fontSize: '11px', marginBottom: '3px' }}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        </Col>
                        {/* TRAINING ASSESSMENT */}
                        <Col span={12}>
                            <div style={{ padding: '12px', background: '#f9f0ff', borderRadius: '4px', border: '1px solid #d3adf7', fontFamily: 'monospace', height: '100%' }}>
                                <Text strong style={{ color: '#722ed1', display: 'block', marginBottom: '6px', fontSize: '12px', textTransform: 'uppercase' }}>↑ Training Assessment</Text>
                                <ul style={{ paddingLeft: '16px', margin: 0 }}>
                                    {(kpis.productionStrategy.trainingLog || []).map((line, idx) => (
                                        <li key={idx} style={{ color: '#595959', fontSize: '11px', marginBottom: '3px' }}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        </Col>
                    </Row>
                </div>
            )}

            {/* FOOTER */}
            <div className="report-footer" style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                    Training Report • Generated {new Date().toLocaleString()}
                </Text>
            </div>
        </div>
    );
};

export default ReportView;
