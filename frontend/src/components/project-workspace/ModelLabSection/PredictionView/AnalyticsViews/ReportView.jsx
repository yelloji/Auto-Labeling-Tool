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
    FileTextOutlined
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

        // --- MANUAL GT CALCULATION (For Upload Mode) ---
        // If backend GT is missing (Upload), calculate from Verifications like ChartsView
        if (!gtCoverage && verifications?.length > 0) {
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
                        // If it's not fail/pass and no AI matched, it's a human add
                        // ChartsView logic: "No AI match + Not 'fail' status = User manually marked a missing object"
                        // But wait, we need to check if it matched AI first.
                        // Simplified check: If status is NOT 'fail' and NOT 'pass', it's likely a new box.
                        // Actually, let's trust the 'type' if available or fallback to status check.
                        // Smart check: If status is 'fail', it subtracts from GT (it was an AI box).
                        // If status is 'pass', it confirms GT (it was an AI box).
                        // If status is undefined/null/other, did it match AI?

                        // Let's replicate ChartsView exact logic for robustness:
                        const predKey = Object.keys(experiment.predictions || {}).find(k => getFileName(k) === vFile);
                        const imgDets = experiment.predictions?.[predKey] || [];

                        const matchedAI = imgDets.find(d =>
                            d.bbox && v.bbox &&
                            Math.abs(d.bbox[0] - v.bbox[0]) < 0.1 && Math.abs(d.bbox[1] - v.bbox[1]) < 0.1 &&
                            Math.abs(d.bbox[2] - v.bbox[2]) < 0.1 && Math.abs(d.bbox[3] - v.bbox[3]) < 0.1
                        );

                        if (matchedAI) {
                            // It's an AI box
                        } else {
                            // It's a Human box (Missing Object)
                            humanMissing++;
                        }
                    }
                }
            });

            // Effective GT = (Total AI - Verified Fails) + Human Missing
            // Note: verifiedFails are FP (not GT).
            // Pass are TP (GT).
            // Unverified are TP (GT assumed).
            // So Start with Total AI, remove Fails, add Missing.
            gtCoverage = Math.max(0, (total_detections - verifiedFails) + humanMissing);
        }

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
                classDistribution: classDistribArray,
                confidenceRanges: confRangesArray,
                // Add a simple avg confidence check
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
        if (!qualityStats?.has_ground_truth) return null;

        // Use backend's detailed lists
        const tpList = qualityStats.detailed_true_positives || [];
        const fpList = qualityStats.detailed_false_positives || [];
        const fnList = qualityStats.detailed_missed_objects || [];

        const tp = tpList.length;
        const fp = fpList.length;
        const fn = fnList.length;

        // Calculate precision, recall, F1
        const p = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
        const r = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
        const f1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;


        // --- 1. SCALE DIAGNOSTICS LOGIC ---
        // Calculate Quartiles from all prediction areas (Mocking behavior if raw predictions unavailable)
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

        // Calculate Scale Stress Data (Simulated across thresholds 0.1 - 0.9)
        const CONF_LIST = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        const sizeStressData = CONF_LIST.map(t => {
            const row = { t };
            ['tiny', 'small', 'medium', 'large'].forEach(sz => {
                const szTPs = tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || 0) >= t);
                const szGT = tpList.filter(d => getSizeGrp(d.bbox) === sz).length +
                    fnList.filter(d => getSizeGrp(d.bbox) === sz).length; // GT is constant (TP+FN at baseline)

                row[`${sz}_yield`] = szGT > 0 ? parseFloat(((szTPs.length / szGT) * 100).toFixed(1)) : 0;
                row[`${sz}_gt`] = szGT;
            });
            return row;
        });

        // Generate Narrative
        const sizes = ['tiny', 'small', 'medium', 'large'];
        const sizeLabels = { tiny: 'Tiny', small: 'Small', medium: 'Medium', large: 'Large' };

        // Find rows at key thresholds
        const prodT = experiment.confidence || 0.45;
        const findRow = (t) => sizeStressData.find(r => Math.abs(r.t - t) < 0.06) || sizeStressData[Math.floor(sizeStressData.length / 2)];

        const prodRow = findRow(prodT);

        const scaleAnalysis = sizes.map(sz => {
            const gtCount = prodRow[`${sz}_gt`] || 0;
            const atProd = prodRow[`${sz}_yield`] || 0;

            let signature = 'no_data';
            if (gtCount === 0) signature = 'no_data';
            else if (atProd >= 80) signature = 'stable_strong';
            else if (atProd >= 50) signature = 'moderate';
            else if (atProd > 0) signature = 'weak';
            else signature = 'structural_blind';

            return {
                size: sz,
                label: sizeLabels[sz],
                gt: gtCount,
                atProd: parseFloat(atProd), // ensure it's a number
                signature
            };
        });

        // Diagnostic Narrative Text (Original)
        const weak = scaleAnalysis.filter(s => (s.signature === 'weak' || s.signature === 'structural_blind') && s.gt > 0);
        const scaleNarrativeCheck = weak.length > 0
            ? `Weakness detected in ${weak.map(s => s.label).join(', ')} objects (detection rate < 50%). Recommendation: Add more training examples for these sizes.`
            : "Scale performance is stable across all object sizes.";


        // --- SCALE DIAGNOSTIC STORY (NEW) ---
        let scaleStory = {
            headline: "Scale Performance is Optimal",
            narrative: "The model performs consistently well across all object sizes, indicating robust feature learning and generalization.",
            action: "No specific action required for scale. Continue monitoring.",
            color: '#52c41a' // Green
        };

        if (scaleNarrativeCheck.includes("Weakness detected")) {
            // Check if specifically Tiny is weak
            const tinyWeak = weak.find(w => w.label === 'Tiny');
            const largeWeak = weak.find(w => w.label === 'Large');

            if (tinyWeak) {
                scaleStory = {
                    headline: "Significant Weakness with Small Objects",
                    narrative: "The model has a notable difficulty in detecting small objects, leading to high false negatives in this category. This could be due to insufficient training data for small objects or architectural limitations.",
                    action: "Augment dataset with more small objects, consider higher resolution inputs, or explore multi-scale detection architectures.",
                    color: '#ff4d4f' // Red
                };
            } else if (largeWeak) {
                scaleStory = {
                    headline: "Weakness with Large Objects Detected",
                    narrative: "The model shows reduced performance on large objects. This might indicate issues with receptive field size or how contextual information is utilized.",
                    action: "Review anchor box configurations, ensure diverse large object examples in training, or adjust model architecture for better large object handling.",
                    color: '#faad14' // Yellow
                };
            } else {
                scaleStory = {
                    headline: "Inconsistent Scale Performance",
                    narrative: "Performance varies across different object sizes, suggesting the model hasn't fully generalized scale invariance. There are specific size ranges where reliability drops.",
                    action: "Increase diversity of object scales in the training data. Consider techniques like image pyramids or scale-aware training strategies.",
                    color: '#faad14' // Yellow
                };
            }
        }


        // --- 2. SPATIAL DIAGNOSTICS LOGIC ---
        // Normalize bounds
        let maxX = 1, maxY = 1;
        [...tpList, ...fpList, ...fnList].forEach(d => {
            if (d.bbox) {
                maxX = Math.max(maxX, d.bbox[2]);
                maxY = Math.max(maxY, d.bbox[3]);
            }
        });

        const spatialGrid = Array(9).fill(0).map(() => ({ fp: 0, fn: 0, total: 0 }));
        const spatialErrors = [...fpList, ...fnList]; // Analyze errors only

        spatialErrors.forEach(d => {
            if (d.bbox) {
                const cx = (d.bbox[0] + d.bbox[2]) / 2;
                const cy = (d.bbox[1] + d.bbox[3]) / 2;
                const col = Math.min(2, Math.floor((cx / maxX) * 3));
                const row = Math.min(2, Math.floor((cy / maxY) * 3));
                const idx = row * 3 + col;
                if (idx >= 0 && idx < 9) {
                    if (d.type === 'False Positive' || ((!d.matched_iou) && (!d.confidence))) spatialGrid[idx].fp++;
                    else spatialGrid[idx].fn++;
                    spatialGrid[idx].total++;
                }
            }
        });

        const totalSpatialErrors = spatialErrors.length || 1;
        const spatialData = spatialGrid.map((tile, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const label = `${String.fromCharCode(65 + row)}${col + 1}`;
            return {
                ...tile,
                label,
                density: parseFloat(((tile.total / totalSpatialErrors) * 100).toFixed(1))
            };
        });

        // Spatial Narratives (Original - for raw checks)
        const hotspots = spatialData.filter(t => t.density >= 25).sort((a, b) => b.density - a.density);
        const warmspots = spatialData.filter(t => t.density >= 15 && t.density < 25).sort((a, b) => b.density - a.density);

        const spatialNarrative = hotspots.map(h => ({
            type: 'urgent',
            msg: `${h.label} region accounts for ${h.density}% of all errors.`
        }));

        // --- SPATIAL DIAGNOSTIC STORY (NEW) ---
        let spatialStory = {
            headline: "No Significant Spatial Bias Detected",
            narrative: "The model's performance is consistent across the image frame, indicating no particular blind spots or regions of weakness.",
            action: "Continue to ensure diverse spatial distribution in future datasets.",
            color: '#52c41a' // Green
        };

        if (hotspots.length > 0) {
            const h = hotspots[0]; // Primary hotspot
            spatialStory = {
                headline: "Critical Spatial Blind Spots Identified",
                narrative: `The model exhibits significant performance degradation in specific regions of the image frame, particularly in the ${h.label} region (${h.density}% of errors). This indicates a strong spatial bias.`,
                action: "Analyze training data for spatial imbalances. Ensure objects of interest appear uniformly across the image frame. Consider data augmentation techniques like random cropping or shifting.",
                color: '#ff4d4f' // Red
            };
        } else if (warmspots.length > 0) {
            const h = warmspots[0];
            spatialStory = {
                headline: "Potential Spatial Bias Detected",
                narrative: `There are noticeable performance drops in certain image regions, such as the ${h.label} region. While not critical, this suggests a minor spatial bias.`,
                action: "Investigate if objects are consistently located in specific parts of the image in the training data. Diversify object placement through augmentation.",
                color: '#faad14' // Yellow
            };
        }


        // --- 3. PRODUCTION STRATEGY LOGIC ---
        // 1. Identify Model Ceiling (First major drop in yield)
        let ceilingT = 0.9;
        let ceilingDrop = 0;
        for (let i = 0; i < sizeStressData.length - 1; i++) {
            const curr = sizeStressData[i];
            const next = sizeStressData[i + 1];
            // Calculate aggregate yield (sum of all gt / sum of all yields)
            // Simplified: just check total TPs
            const currTP = ['tiny', 'small', 'medium', 'large'].reduce((sum, sz) => sum + (tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || 0) >= curr.t).length), 0);
            const nextTP = ['tiny', 'small', 'medium', 'large'].reduce((sum, sz) => sum + (tpList.filter(d => getSizeGrp(d.bbox) === sz && (d.confidence || 0) >= next.t).length), 0);

            const drop = currTP - nextTP;
            if (drop > (tpList.length * 0.15)) { // 15% drop trigger
                ceilingT = next.t;
                ceilingDrop = drop;
                break;
            }
        }

        // 2. Identify Best F1 (Target)
        // We need to simulate F1 at each threshold
        let bestF1 = 0;
        let bestT = 0.5;

        CONF_LIST.forEach(t => {
            const simTP = tpList.filter(d => (d.confidence || 0) >= t).length;
            const simFP = fpList.filter(d => (d.confidence || 0) >= t).length;
            const simFN = fnList.length + (tpList.length - simTP); // FN = Baseline FN + TP lost due to threshold

            const sP = (simTP + simFP) > 0 ? simTP / (simTP + simFP) : 0;
            const sR = (simTP + simFN) > 0 ? simTP / (simTP + simFN) : 0;
            const sF1 = (sP + sR) > 0 ? (2 * sP * sR) / (sP + sR) : 0;

            if (sF1 > bestF1) {
                bestF1 = sF1;
                bestT = t;
            }
        });

        // 3. Generate Strategy Log
        const strategyLog = [];
        strategyLog.push(`[AUTO] Scan complete. ${tpList.length} TPs analysis.`);
        strategyLog.push(`[CEILING] Detected structural ceiling at ${(ceilingT * 100).toFixed(0)}%.`);
        if (ceilingT < 0.5) strategyLog.push(`[WARN] Ceiling is dangerously low (<50%). Model is unstable.`);

        strategyLog.push(`[OPTIMAL] Peak F1 (${(bestF1 * 100).toFixed(1)}%) found at ${(bestT * 100).toFixed(0)}% confidence.`);

        const isReady = bestF1 > 0.6 && ceilingT > 0.6; // Simple readiness heuristic
        const status = isReady ? "READY" : "NOT READY";
        const action = isReady ? "Recommended for Pilot" : "Retraining Required";


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
                log: strategyLog
            },
            executiveSummary
        };
    }, [qualityStats, experiment]);

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
                <Title level={3} style={{ fontSize: '16px', fontWeight: 600, marginBottom: '1rem', color: '#00f2ff' }}>
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
                    <Title level={3} style={{ fontSize: '16px', fontWeight: 600, marginBottom: '1rem', color: '#722ed1' }}>
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
                    } style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                            {/* Left: The Story */}
                            <div style={{ flex: 1 }}>
                                <Title level={4} style={{ marginTop: 0, color: kpis.scaleDiagnostic.story.color }}>
                                    {kpis.scaleDiagnostic.story.headline}
                                </Title>
                                <Text style={{ fontSize: '14px', lineHeight: '1.6', color: '#555', display: 'block', marginBottom: '1rem' }}>
                                    {kpis.scaleDiagnostic.story.narrative}
                                </Text>
                                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: '12px', borderRadius: '4px' }}>
                                    <Text strong style={{ color: '#389e0d', display: 'block', marginBottom: '4px' }}>Recommended Action:</Text>
                                    <Text type="secondary">{kpis.scaleDiagnostic.story.action}</Text>
                                </div>
                            </div>

                            {/* Right: The Data Table */}
                            <div style={{ width: '400px' }}>
                                <Table
                                    dataSource={kpis.scaleDiagnostic.analysis}
                                    pagination={false}
                                    size="small"
                                    rowKey="size"
                                    columns={[
                                        {
                                            title: 'Size Group',
                                            dataIndex: 'label',
                                            key: 'label',
                                            render: (text) => <Text strong>{text}</Text>
                                        },
                                        {
                                            title: 'Reliability',
                                            dataIndex: 'atProd',
                                            key: 'atProd',
                                            align: 'right',
                                            render: (val, record) => {
                                                const color = val >= 80 ? '#52c41a' : (val >= 50 ? '#faad14' : '#ff4d4f');
                                                return <Text style={{ color, fontWeight: 'bold' }}>{val}%</Text>;
                                            }
                                        },
                                        {
                                            title: 'Samples',
                                            dataIndex: 'gt',
                                            key: 'gt',
                                            align: 'right',
                                            render: (val) => <Text type="secondary">{val}</Text>
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
                            <span>3.2 Spatial Bias Analysis</span>
                        </Space>
                    }>
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                            {/* Left: The Story */}
                            <div style={{ flex: 1 }}>
                                <Title level={4} style={{ marginTop: 0, color: kpis.spatialStory.color }}>
                                    {kpis.spatialStory.headline}
                                </Title>
                                <Text style={{ fontSize: '14px', lineHeight: '1.6', color: '#555', display: 'block', marginBottom: '1rem' }}>
                                    {kpis.spatialStory.narrative}
                                </Text>
                                <div style={{ background: '#fff0f6', border: '1px solid #ffadd2', padding: '12px', borderRadius: '4px' }}>
                                    <Text strong style={{ color: '#c41d7f', display: 'block', marginBottom: '4px' }}>Recommended Check:</Text>
                                    <Text type="secondary">{kpis.spatialStory.action}</Text>
                                </div>
                            </div>

                            {/* Right: 3x3 Grid Visualization */}
                            <div style={{ width: '200px' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '2px',
                                    aspectRatio: '1',
                                    background: '#f0f0f0',
                                    border: '1px solid #d9d9d9',
                                    padding: '2px'
                                }}>
                                    {kpis.spatialData.map((tile, i) => (
                                        <div key={i} style={{
                                            background: tile.density > 25 ? '#ffccc7' : (tile.density > 15 ? '#fffb8f' : '#fff'),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                            border: '1px solid #f0f0f0',
                                            cursor: 'default'
                                        }} title={`${tile.label}: ${tile.density}% errors`}>
                                            <Text strong style={{ fontSize: '12px', color: tile.density > 25 ? '#cf1322' : '#595959' }}>
                                                {tile.density}%
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: '9px' }}>{tile.label}</Text>
                                        </div>
                                    ))}
                                </div>
                                <Text type="secondary" style={{ fontSize: '10px', display: 'block', textAlign: 'center', marginTop: '4px' }}>Error Density Heatmap</Text>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* SECTION 04: DEPLOYMENT READINESS */}
            {kpis && kpis.productionStrategy && (
                <div className="report-section" style={{ marginTop: '3rem', marginBottom: '3rem' }}>
                    <Title level={3} style={{ fontSize: '16px', fontWeight: 600, marginBottom: '1rem', color: '#1890ff' }}>
                        <CloudSyncOutlined /> Section 04: Deployment Readiness
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '1.5rem' }}>
                        Automated stability audit to determine if the model is ready for live production use.
                    </Text>

                    <Row gutter={16}>
                        {/* 4.1 RELIABILITY LIMIT */}
                        <Col span={8}>
                            <Card size="small" style={{ background: '#f9f9f9', textAlign: 'center', height: '100%' }}>
                                <Text strong style={{ color: '#722ed1', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Reliability Limit</Text>
                                <Title level={2} style={{ margin: '8px 0', color: '#722ed1' }}>
                                    {kpis.productionStrategy.ceiling}%
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>Maximum Confidence Score</Text>
                            </Card>
                        </Col>
                        {/* 4.2 OPTIMAL BALANCE */}
                        <Col span={8}>
                            <Card size="small" style={{ background: '#f0f9ff', textAlign: 'center', height: '100%', borderColor: '#69c0ff' }}>
                                <Text strong style={{ color: '#1890ff', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Optimal Balance Point</Text>
                                <Title level={2} style={{ margin: '8px 0', color: '#1890ff' }}>
                                    {kpis.productionStrategy.target}%
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>Recommended Confidence Setting</Text>
                            </Card>
                        </Col>
                        {/* 4.3 PILOT READINESS */}
                        <Col span={8}>
                            <Card size="small" style={{ background: kpis.productionStrategy.status === 'READY' ? '#f6ffed' : '#fff1f0', textAlign: 'center', height: '100%', borderColor: kpis.productionStrategy.status === 'READY' ? '#b7eb8f' : '#ffa39e' }}>
                                <Text strong style={{ color: kpis.productionStrategy.status === 'READY' ? '#52c41a' : '#ff4d4f', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Pilot Readiness</Text>
                                <Title level={2} style={{ margin: '8px 0', color: kpis.productionStrategy.status === 'READY' ? '#52c41a' : '#ff4d4f' }}>
                                    {kpis.productionStrategy.status}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '11px' }}>{kpis.productionStrategy.action}</Text>
                            </Card>
                        </Col>
                    </Row>

                    <div style={{ marginTop: '1rem', padding: '12px', background: '#f0f2f5', borderRadius: '4px', border: '1px solid #d9d9d9', fontFamily: 'monospace' }}>
                        <Text strong style={{ color: '#595959', display: 'block', marginBottom: '4px' }}>READINESS AUDIT LOG:</Text>
                        <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            {kpis.productionStrategy.log.map((line, idx) => (
                                <li key={idx} style={{ color: '#595959', fontSize: '12px' }}>{line}</li>
                            ))}
                        </ul>
                    </div>
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
