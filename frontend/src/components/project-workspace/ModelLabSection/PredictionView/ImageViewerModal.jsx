import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Tag, Tooltip, Slider } from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    DownloadOutlined,
    CloseOutlined,
    InfoCircleOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    UpOutlined,
    DownOutlined
} from '@ant-design/icons';

import ManualClassPopup from './ManualClassPopup';

const { Text } = Typography;

/**
 * ImageViewerModal Component
 * 
 * Provides a full-screen detailed view of a prediction result with pixel-perfect overlays.
 */
const ImageViewerModal = ({
    visible,
    onCancel,
    currentImage,
    images,
    experiment,
    onNavigate,
    filters,
    setFilters, // New: To trigger global filter updates
    verifications = [], // New: Project-level human reviews
    onVerify, // New: Function to trigger save
    onDeleteVerification, // New: Function to trigger deletion
    projectLabels = [], // New: Project-level labels for classification
    duplicateMatchMap = {}, // New: Duplicate group insights
    sizeGroups = { thresholds: [0, 0, 0], count: 0 } // New: Size bucketing data
}) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const [isImgLoading, setIsImgLoading] = useState(true); // New: Guard for sync
    const [lastLoadTime, setLastLoadTime] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState(null); // New: Bidirectional bridge
    const [focusedIndex, setFocusedIndex] = useState(null); // New: For toggle logic
    const loadStartTime = React.useRef(performance.now());
    const hasInitSelection = React.useRef(false);

    // Layer Visibility State
    const [showBoxes, setShowBoxes] = useState(true);
    const [showContours, setShowContours] = useState(true);
    const [showLabels, setShowLabels] = useState(true);

    // Drawing Mode States (Phase 3)
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tempBox, setTempBox] = useState(null); // { x, y, width, height, startX, startY }
    const [showClassPopup, setShowClassPopup] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [selectedBoxForClass, setSelectedBoxForClass] = useState(null);

    // Phase 3.5: Deletion state
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [selectedVerifyForDelete, setSelectedVerifyForDelete] = useState(null);
    const [deletePopupPosition, setDeletePopupPosition] = useState({ x: 0, y: 0 });

    // Phase 4: Hint confirmation state
    const [showHintConfirm, setShowHintConfirm] = useState(false);
    const [selectedHint, setSelectedHint] = useState(null);
    const [hintConfirmPosition, setHintConfirmPosition] = useState({ x: 0, y: 0 });

    // Phase 4: Manual box details popup state  
    const [showManualDetails, setShowManualDetails] = useState(false);
    const [selectedManualForDetails, setSelectedManualForDetails] = useState(null);
    const [manualDetailsPosition, setManualDetailsPosition] = useState({ x: 0, y: 0 });

    // Phase 4.5: Custom Hover Tooltip (Premium Design)
    const [hoverTooltip, setHoverTooltip] = useState({ show: false, content: '', x: 0, y: 0, type: 'manual' });

    const svgRef = React.useRef(null);
    const clickTimer = React.useRef(null);

    // Individual Detection Selection State (Phase 2.4)
    // We store the INDICES of the detections that are checked.
    const [showHelp, setShowHelp] = useState(false);
    const helpRef = React.useRef(null);
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [isFooterCollapsed, setIsFooterCollapsed] = useState(false); // Phase 6.8: Collapsible Footer

    // Phase 7.1: Missed Ground Truth Detections
    const [missedDetections, setMissedDetections] = useState([]);
    const [showMissed, setShowMissed] = useState(true);
    const [iouThreshold, setIouThreshold] = useState(0.3);
    const [fpIndices, setFpIndices] = useState([]); // Phase 7.2: Unmatched prediction indices (False Positives)

    const currentIndex = images.indexOf(currentImage);

    // Helper to get detections (handles both full path and filename only)
    const getDetectionsForImage = (name) => {
        if (!name || !experiment?.predictions) return [];
        if (experiment.predictions[name]) return experiment.predictions[name];
        const fileName = name.split('/').pop();
        return experiment.predictions[fileName] || [];
    };
    const allDets = getDetectionsForImage(currentImage);

    // Phase 7.0: Calculate IoU (Intersection over Union) for accurate box comparison
    const calculateIoU = (bbox1, bbox2) => {
        // bbox format: [x1, y1, x2, y2]
        if (!bbox1 || !bbox2) return 0.0;
        const x1 = Math.max(bbox1[0], bbox2[0]);
        const y1 = Math.max(bbox1[1], bbox2[1]);
        const x2 = Math.min(bbox1[2], bbox2[2]);
        const y2 = Math.min(bbox1[3], bbox2[3]);

        // No intersection
        if (x2 < x1 || y2 < y1) {
            return 0.0;
        }

        const intersection = (x2 - x1) * (y2 - y1);
        const area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1]);
        const area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1]);
        const union = area1 + area2 - intersection;

        return union > 0 ? intersection / union : 0.0;
    };

    // Apply active filters to detections shown in big view
    const filteredDets = allDets.filter((d, idx) => {
        if (!filters) return true;
        const [minConf, maxConf] = [filters.confidenceRange[0] / 100, filters.confidenceRange[1] / 100];
        const confMatch = d.confidence >= minConf && d.confidence <= maxConf;
        const classMatch = (filters.selectedClasses && filters.selectedClasses.length > 0)
            ? filters.selectedClasses.includes(d.class)
            : (filters.className === 'all' || d.class === filters.className);

        // Apply Strict Risk Level Filter
        const riskLevel = filters.riskLevel;
        let riskMatch = true;
        if (riskLevel === 'high') riskMatch = d.confidence < 0.4;
        else if (riskLevel === 'medium') riskMatch = d.confidence >= 0.4 && d.confidence < 0.7;
        else if (riskLevel === 'low') riskMatch = d.confidence >= 0.7;

        // 8. Size Isolation Logic (Phase 2.5)
        let sizeMatch = true;
        if (filters.selectedSizeGroup !== 'all' && filters.isolateBySize) {
            const [q25, q50, q75] = sizeGroups.thresholds;
            const [x1, y1, x2, y2] = d.bbox;
            const area = (x2 - x1) * (y2 - y1);
            if (filters.selectedSizeGroup === 'tiny') sizeMatch = area <= q25;
            else if (filters.selectedSizeGroup === 'small') sizeMatch = area > q25 && area <= q50;
            else if (filters.selectedSizeGroup === 'medium') sizeMatch = area > q50 && area <= q75;
            else if (filters.selectedSizeGroup === 'large') sizeMatch = area > q75;
        }

        // 7. Overlap Isolation Mode (Existing Phase 1.5)
        let overlapMatch = true;
        if (filters.showOverlapping && filters.isolateOverlaps) {
            overlapMatch = allDets.some((otherD, otherIdx) => {
                if (idx === otherIdx) return false;
                const iou = calculateIoU(d.bbox, otherD.bbox);
                return iou >= filters.overlapIoU;
            });
        }

        return confMatch && classMatch && riskMatch && overlapMatch && sizeMatch;
    });

    // Phase 4: Split verifications for current image into "mine" and "hints"
    const currentFileName = currentImage?.split('/').pop();
    const currentImageVerifications = verifications.filter(v =>
        v.image_name === currentFileName && (v.status === 'missing' || v.is_manual)
    );

    // My boxes: verifications for THIS experiment
    const myBoxes = currentImageVerifications.filter(v => v.experiment_id === experiment?.id);

    // Helper to check if two bboxes match using IoU threshold
    const bboxesMatch = (bbox1, bbox2, iouThreshold = 0.3) => {
        return calculateIoU(bbox1, bbox2) >= iouThreshold;
    };

    const hintBoxes = currentImageVerifications
        .filter(v => v.experiment_id !== experiment?.id)
        .filter(hint => !myBoxes.some(myBox => bboxesMatch(hint.bbox, myBox.bbox)));

    // Helper to build tooltip content for a hint box
    const getHintTooltip = (hint) => {
        // Find all verifications at this location (from different experiments)
        const allAtLocation = currentImageVerifications.filter(v =>
            v.experiment_id !== experiment?.id &&
            bboxesMatch(v.bbox, hint.bbox)
        );

        const className = hint.class_name;

        if (allAtLocation.length === 1) {
            const v = allAtLocation[0];
            const expName = v.experiment_name || `Experiment ${v.experiment_id?.slice(0, 8)}`;
            const trainingName = v.training_name || 'Training';
            return `A ${className} was previously marked here during prediction experiment '${expName}' from training '${trainingName}'.\n\nClick to accept for your current experiment.`;
        } else {
            const expList = allAtLocation.map(v => {
                const expName = v.experiment_name || `Exp ${v.experiment_id?.slice(0, 8)}`;
                const trainingName = v.training_name || 'Training';
                return `  • Experiment '${expName}' from training '${trainingName}'`;
            }).join('\n');
            return `A ${className} was previously marked in ${allAtLocation.length} prediction experiments:\n${expList}\n\nClick to accept for your current experiment.`;
        }
    };

    // 1. IMAGE NAVIGATION TRIGGER
    // Only resets zoom and turns on the "Sync Guard" when the actual image changes.
    React.useEffect(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setIsImgLoading(true); // Guard ON - only when changing images
        loadStartTime.current = performance.now();
    }, [currentImage]);

    // 2. DETECTION AUTO-SELECT TRIGGER
    // Refreshes selection whenever data OR filters change, without hiding the image.
    React.useEffect(() => {
        if (filteredDets.length > 0) {
            setSelectedIndices(filteredDets.map((_, i) => i));
        } else {
            setSelectedIndices([]);
        }
    }, [currentImage, filteredDets.length]);

    // (Logic moved to unified handler above for perfect synchronization)

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (helpRef.current && !helpRef.current.contains(event.target)) {
                // Check if the click was on the help button itself to avoid toggling twice
                const helpBtn = document.querySelector('[title="Image Viewer Guide"]');
                if (helpBtn && helpBtn.contains(event.target)) return;

                setShowHelp(false);
            }
        };

        if (showHelp) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHelp]);

    // Phase 6.9: Keyboard Navigation (Arrow Keys)
    React.useEffect(() => {
        const handleKeyDown = (event) => {
            // Only handle arrow keys when modal is visible and no input is focused
            if (!visible) return;
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                return; // Don't interfere with text input
            }

            if (event.key === 'ArrowLeft') {
                // Navigate to previous image
                if (currentIndex > 0) {
                    event.preventDefault();
                    onNavigate(images[currentIndex - 1]);
                }
            } else if (event.key === 'ArrowRight') {
                // Navigate to next image
                if (currentIndex < images.length - 1) {
                    event.preventDefault();
                    onNavigate(images[currentIndex + 1]);
                }
            }
        };

        if (visible) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [visible, currentIndex, images, onNavigate]);

    // Phase 7.1: Fetch missed detections when image or IoU changes
    React.useEffect(() => {
        if (!currentImage || !experiment) {
            setMissedDetections([]);
            return;
        }

        const fetchMissedDetections = async () => {
            try {
                const { missedDetectionsAPI } = await import('../../../../services/api');
                const fileName = currentImage.split('/').pop();
                const data = await missedDetectionsAPI.getMissedDetections(
                    experiment.id,
                    fileName,
                    iouThreshold
                );

                // data is now { missed: [], fp_indices: [] }
                setMissedDetections(data.missed || []);
                setFpIndices(data.fp_indices || []);
            } catch (error) {
                console.error('Error fetching verification data:', error);
                setMissedDetections([]);
                setFpIndices([]);
            }
        };

        fetchMissedDetections();
    }, [currentImage, experiment, iouThreshold]);

    // Dynamic Story Engine for Historical Hints
    const generateVerificationStory = (hints) => {
        if (!hints || hints.length === 0) return null;

        const latest = hints[0];
        const count = hints.length;
        const allPass = hints.every(h => h.status === 'pass');
        const allFail = hints.every(h => h.status === 'fail');

        const latestName = `${latest.training_name || 'Legacy'} (${latest.experiment_name || 'N/A'})`;

        if (count === 1) {
            return `You reviewed this detection once in "${latestName}". At that time, you marked it as a ${latest.status.toUpperCase()}.`;
        }

        if (allPass || allFail) {
            const status = allPass ? 'PASS' : 'FAIL';
            return `You have been perfectly consistent across ${count} experiments, most recently in "${latestName}". You have always marked it as a ${status}.`;
        }

        // If behaviors have changed (Evolution)
        const first = hints[hints.length - 1];
        const firstName = `${first.training_name || 'Legacy'} (${first.experiment_name || 'N/A'})`;

        if (latest.status !== first.status) {
            return `Your standards have evolved. You originally marked it as ${first.status.toUpperCase()} in "${firstName}", but your most recent decision in "${latestName}" was to switch it to ${latest.status.toUpperCase()}.`;
        }

        return `This detection has a history of ${count} reviews. Your latest decision was ${latest.status.toUpperCase()} during the "${latestName}" session.`;
    };

    if (!visible || !currentImage || !experiment) return null;

    const toggleDetection = (index) => {
        if (selectedIndices.includes(index)) {
            setSelectedIndices(selectedIndices.filter(i => i !== index));
        } else {
            setSelectedIndices([...selectedIndices, index]);
        }
    };

    const selectAll = () => setSelectedIndices(filteredDets.map((_, i) => i));
    const selectNone = () => setSelectedIndices([]);

    const imageUrl = `${window.location.protocol}//${window.location.hostname}:12000/api/v1/experiments/${experiment.id}/original-image/${currentImage}`;

    const handleImgLoad = (e) => {
        const duration = performance.now() - loadStartTime.current;
        setLastLoadTime(duration);
        setIsImgLoading(false); // Guard OFF - Image is ready

        setDimensions({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
        });
    };

    /**
     * PRO COMPOSITE DOWNLOAD HANDLER:
     * Creates a high-res canvas composite of the original image + all visible annotations.
     * Respects visibility toggles (Boxes, Contours, Labels) and filters.
     */
    const handleDownload = async () => {
        if (!dimensions.width || !dimensions.height || isImgLoading) return;

        // 1. Load the image first to get true dimensions
        const img = new Image();
        img.crossOrigin = "anonymous"; // Essential for toDataURL to work with external URLs
        img.src = imageUrl;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // 2. Create off-screen canvas using the ACTUAL loaded image dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        // 3. Draw Base Image
        ctx.drawImage(img, 0, 0);

        // 4. Draw Detections (following same logic as SVG overlay)
        filteredDets.forEach((d, i) => {
            if (!selectedIndices.includes(i)) return;

            // Risk coloring logic (consistent with SVG)
            let riskColor = '#52c41a';
            if (d.confidence < 0.4) riskColor = '#ff4d4f';
            else if (d.confidence < 0.7) riskColor = '#faad14';

            const [x1, y1, x2, y2] = d.bbox;
            const w = x2 - x1;
            const h = y2 - y1;

            // A. Draw Contour (Polygon)
            if (showContours && d.segmentation) {
                ctx.beginPath();
                ctx.moveTo(d.segmentation[0][0], d.segmentation[0][1]);
                for (let p = 1; p < d.segmentation.length; p++) {
                    ctx.lineTo(d.segmentation[p][0], d.segmentation[p][1]);
                }
                ctx.closePath();
                ctx.fillStyle = riskColor + '33'; // 20% opacity
                ctx.fill();
                ctx.strokeStyle = riskColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]); // Dashed contours
                ctx.stroke();
                ctx.setLineDash([]); // Reset dash for boxes
            }

            // B. Draw Bounding Box
            if (showBoxes) {
                ctx.strokeStyle = riskColor;
                ctx.lineWidth = 2; // Match UI (2px)
                ctx.strokeRect(x1, y1, w, h);
            }

            // C. Draw Label (MATCH SVG DYNAMIC LOGIC PIXEL-PER-PIXEL)
            if (showLabels) {
                const labelText = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
                const fontSize = 14;
                ctx.font = `bold ${fontSize}px monospace`; // MIRROR FONT
                const textWidth = ctx.measureText(labelText).width;
                const labelWidth = textWidth + 10;
                const labelHeight = 18;

                // 1. Dynamic X (Bound check)
                let labelDrawX = x1;
                if (labelDrawX + labelWidth > img.naturalWidth) {
                    labelDrawX = Math.max(0, img.naturalWidth - labelWidth);
                }

                // 2. Dynamic Y (Mirror UI: Above > Below > Inside hierarchy)
                let labelDrawY;
                const spaceAbove = y1;
                const spaceBelow = img.naturalHeight - y2;

                if (spaceAbove >= labelHeight + 4) {
                    labelDrawY = y1 - labelHeight - 4; // Above
                } else if (spaceBelow >= labelHeight + 4) {
                    labelDrawY = y2 + 4; // Below
                } else {
                    labelDrawY = y1 + 4; // Inside Top
                }

                // Label Background
                ctx.fillStyle = riskColor;
                ctx.globalAlpha = 0.85;
                ctx.fillRect(labelDrawX, labelDrawY, labelWidth, labelHeight);
                ctx.globalAlpha = 1.0;

                // Label Text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, labelDrawX + 5, labelDrawY + 14); // Perfect Mirror Offset
            }
        });

        // 5. Draw Manual Boxes (Solid Purple)
        myBoxes.forEach(v => {
            const [x1, y1, x2, y2] = v.bbox;
            const w = x2 - x1;
            const h = y2 - y1;

            ctx.strokeStyle = '#a335ee';
            ctx.lineWidth = 3; // Match UI (3px)
            ctx.strokeRect(x1, y1, w, h);

            ctx.fillStyle = 'rgba(163, 53, 238, 0.1)';
            ctx.fillRect(x1, y1, w, h);

            // Dynamic Manual Label Position (Mirror UI)
            const manualLabel = v.class_name;
            ctx.font = 'bold 14px monospace'; // MIRROR FONT
            const manualLabelWidth = ctx.measureText(manualLabel).width + 12;
            const manualLabelHeight = 22;

            let mX = x1;
            if (mX + manualLabelWidth > img.naturalWidth) mX = Math.max(0, img.naturalWidth - manualLabelWidth);

            let mY = y1 - manualLabelHeight;
            if (mY < 0) {
                if (y2 + manualLabelHeight < img.naturalHeight) mY = y2;
                else mY = y1;
            }

            ctx.fillStyle = '#a335ee';
            ctx.fillRect(mX, mY, manualLabelWidth, manualLabelHeight);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(manualLabel, mX + 6, mY + 17); // Mirror vertical baseline
        });

        // 6. Draw Hint Boxes (Orange Dashed)
        hintBoxes.forEach(v => {
            const [x1, y1, x2, y2] = v.bbox;
            const w = x2 - x1;
            const h = y2 - y1;

            ctx.strokeStyle = '#ff8c00';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            ctx.strokeRect(x1, y1, w, h);
            ctx.setLineDash([]);
        });

        // 7. Draw Missed Ground Truth Detections (Light Gray) - Phase 7.1
        if (showMissed && missedDetections.length > 0) {
            missedDetections.forEach(missed => {
                const [x1, y1, x2, y2] = missed.bbox;
                const w = x2 - x1;
                const h = y2 - y1;

                // Draw dashed rectangle
                ctx.strokeStyle = '#d0d0d0';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 4]);
                ctx.strokeRect(x1, y1, w, h);
                ctx.setLineDash([]);

                // Draw semi-transparent fill
                ctx.fillStyle = 'rgba(208,208,208,0.08)';
                ctx.fillRect(x1, y1, w, h);

                // Dynamic Missed Label Position (Mirror UI Text-only Dynamic style)
                const missedLabel = `${missed.class_name} - MISSED`;
                ctx.font = 'bold 13px monospace'; // MIRROR FONT
                const missedWidth = ctx.measureText(missedLabel).width + 10;
                const missedHeight = 18;

                let mtX = x1;
                if (mtX + missedWidth > img.naturalWidth) mtX = Math.max(0, img.naturalWidth - missedWidth);

                let mtY;
                const sAbove = y1;
                const sBelow = img.naturalHeight - y2;

                if (sAbove >= missedHeight + 4) {
                    mtY = y1 - 4; // Position baseline above box
                } else if (sBelow >= missedHeight + 4) {
                    mtY = y2 + missedHeight + 4; // Position baseline below box
                } else {
                    mtY = y1 + missedHeight + 4; // Position baseline inside top
                }

                ctx.fillStyle = '#d0d0d0';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 6;
                ctx.fillText(missedLabel, mtX + 4, mtY); // Mirror SVG text-baseline positioning
                ctx.shadowBlur = 0; // Reset shadow
            });
        }

        // 8. Trigger Browser Download
        const fileName = `prediction_${currentImage.split('/').pop()}`;
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
    };

    // Zoom Handlers
    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
    const handleResetZoom = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    /**
     * CLICK-TO-FOCUS (Precision Zoom)
     * Calculates the center of a detection and zooms to it.
     */
    const handleFocusDetection = (index) => {
        // Toggle Logic: If clicking the same box while zoomed in, reset.
        if (focusedIndex === index && scale > 1.1) {
            handleResetZoom();
            setFocusedIndex(null);
            return;
        }

        const d = filteredDets[index];
        if (!d || !d.bbox || dimensions.width === 0) return;

        const [x1, y1, x2, y2] = d.bbox;
        const boxW = x2 - x1;
        const boxH = y2 - y1;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        // Smart Zoom Level: Aim for 70% of the view, clamped between 1.5x and 4x
        const targetScale = Math.min(4, Math.max(1.5, Math.min(dimensions.width / boxW, dimensions.height / boxH) * 0.7));

        // Offset: Displacement from center, scaled
        const targetOffset = {
            x: (dimensions.width / 2 - centerX) * targetScale,
            y: (dimensions.height / 2 - centerY) * targetScale
        };

        setScale(targetScale);
        setOffset(targetOffset);
        setFocusedIndex(index);
    };

    /**
     * PIXEL-PERFECT COORDINATE CONVERSION
     * Maps mouse coordinates to original image pixels via SVG Space.
     */
    const getPixelCoords = (e) => {
        if (!svgRef.current) return null;
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;

        // Use the SVG Matrix Transform to invert screen clicks into image pixels
        // This automatically handles Scale, Pan, and DOM positioning.
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        return {
            x: Math.max(0, Math.min(svgP.x, dimensions.width)),
            y: Math.max(0, Math.min(svgP.y, dimensions.height))
        };
    };

    const handleMouseDown = (e) => {
        if (isDrawingMode) {
            // Don't start new drawing if popup is showing - user needs to finish current action first
            if (showClassPopup) return;

            // Close details popup when starting a new drawing
            setShowManualDetails(false);

            e.stopPropagation();
            const coords = getPixelCoords(e);
            if (coords) {
                setIsDrawing(true);
                setTempBox({ x: coords.x, y: coords.y, width: 0, height: 0, startX: coords.x, startY: coords.y });
            }
            return;
        }

        setIsDragging(true);
        setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e) => {
        if (isDrawing && tempBox) {
            const coords = getPixelCoords(e);
            if (coords) {
                const startX = tempBox.startX;
                const startY = tempBox.startY;
                setTempBox({
                    ...tempBox,
                    x: Math.min(coords.x, startX),
                    y: Math.min(coords.y, startY),
                    width: Math.abs(coords.x - startX),
                    height: Math.abs(coords.y - startY)
                });
            }
            return;
        }

        if (!isDragging) return;
        setOffset({
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y
        });
    };

    const handleMouseUp = (e) => {
        if (isDrawing) {
            setIsDrawing(false);
            if (tempBox && tempBox.width > 2 && tempBox.height > 2) {
                // Phase 3: Classification popup
                setSelectedBoxForClass({
                    bbox: [tempBox.x, tempBox.y, tempBox.x + tempBox.width, tempBox.y + tempBox.height]
                });
                setPopupPosition({ x: e.clientX, y: e.clientY });
                setShowClassPopup(true);
            } else {
                setTempBox(null);
            }
            return;
        }
        setIsDragging(false);
    };

    const handleClassSelect = (className) => {
        if (!selectedBoxForClass) return;

        const fileName = currentImage.split('/').pop();
        onVerify({
            image_name: fileName,
            class_name: className,
            bbox: selectedBoxForClass.bbox,
            status: 'missing',
            is_manual: true,
            experiment_id: experiment.id
        });

        // Reset state
        setShowClassPopup(false);
        setSelectedBoxForClass(null);
        setTempBox(null);
        setIsDrawingMode(false);
    };

    // Single click: Show details popup (Toggle behavior with debouncing)
    const handleManualBoxClick = (e, v) => {
        if (isDrawingMode) return;
        e.stopPropagation();

        // If a timer is already running, this is effectively a Double Click 
        // (the double click handler will clear it)
        if (clickTimer.current) return;

        const x = e.clientX;
        const y = e.clientY;

        clickTimer.current = setTimeout(() => {
            if (showManualDetails && selectedManualForDetails?.id === v.id) {
                setShowManualDetails(false);
                setSelectedManualForDetails(null);
            } else {
                setSelectedManualForDetails(v);
                setManualDetailsPosition({ x, y });
                setShowManualDetails(true);
            }
            clickTimer.current = null;
        }, 300); // 300ms window to detect double click
    };

    // Double click: Show delete confirmation (Overrides single click details)
    const handleManualBoxDoubleClick = (e, v) => {
        if (isDrawingMode) return;
        e.stopPropagation();

        // Cancel the pending single click (Details popup)
        if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
        }

        // Explicitly hide details to prevent flicker
        setShowManualDetails(false);

        setSelectedVerifyForDelete(v);
        setDeletePopupPosition({ x: e.clientX, y: e.clientY });
        setShowDeletePopup(true);
    };

    const confirmDelete = () => {
        if (selectedVerifyForDelete) {
            onDeleteVerification(selectedVerifyForDelete.id);
            setShowDeletePopup(false);
            setSelectedVerifyForDelete(null);
        }
    };

    // Custom Hover Handlers for Bounding Boxes (Premium Design)
    const handleBoxMouseEnter = (e, content, type = 'manual') => {
        setHoverTooltip({
            show: true,
            content,
            x: e.clientX,
            y: e.clientY,
            type
        });
    };

    const handleBoxMouseMove = (e) => {
        if (hoverTooltip.show) {
            setHoverTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
        }
    };

    const handleBoxMouseLeave = () => {
        setHoverTooltip({ show: false, content: '', x: 0, y: 0, type: 'manual' });
    };

    // Phase 4: Show confirmation popup for hint acceptance
    const handleHintBoxClick = (e, hintBox) => {
        if (isDrawingMode) return;
        e.stopPropagation();

        // Store hint and show confirmation
        setSelectedHint(hintBox);
        setHintConfirmPosition({ x: e.clientX, y: e.clientY });
        setShowHintConfirm(true);
    };

    const confirmAcceptHint = () => {
        if (!selectedHint) return;

        // Create a new verification for THIS experiment using the hint's bbox and class
        const fileName = currentImage.split('/').pop();
        onVerify({
            image_name: fileName,
            class_name: selectedHint.class_name,
            bbox: selectedHint.bbox,
            status: 'missing',
            is_manual: true,
            experiment_id: experiment.id
        });

        // Reset
        setShowHintConfirm(false);
        setSelectedHint(null);
    };


    const isDuplicate = !!(duplicateMatchMap[currentFileName] || duplicateMatchMap[currentImage]);
    const matchId = duplicateMatchMap[currentFileName] || duplicateMatchMap[currentImage];

    return (
        <Modal
            visible={visible}
            footer={null}
            onCancel={onCancel}
            width="95%"
            centered
            bodyStyle={{
                padding: 0,
                height: '92vh',
                background: '#0a0a0a',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
            closeIcon={null}
            className="image-viewer-modal"
        >
            {/* Header / Info Bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '0.6rem 1.25rem',
                background: 'rgba(28, 28, 30, 0.7)',
                backdropFilter: 'blur(25px) saturate(180%)',
                WebkitBackdropFilter: 'blur(25px) saturate(180%)',
                zIndex: 100,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Space align="center">
                        <Text style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>{currentImage}</Text>
                        <Space size={10} style={{ marginLeft: '16px', background: 'rgba(255,255,255,0.08)', padding: '4px 12px', borderRadius: '14px' }}>
                            <Tooltip title="High Risk: < 40% Confidence">
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ff4d4f', boxShadow: '0 0 12px #ff4d4f' }} />
                            </Tooltip>
                            <Tooltip title="Medium Risk: 40-70% Confidence">
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#faad14', boxShadow: '0 0 12px #faad14' }} />
                            </Tooltip>
                            <Tooltip title="Low Risk: > 70% Confidence">
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 12px #52c41a' }} />
                            </Tooltip>
                        </Space>
                    </Space>
                    <Space size={12}>
                        <Tag color="blue" style={{ borderRadius: '4px', border: 'none', background: 'rgba(24, 144, 255, 0.2)', color: '#1890ff' }}>
                            {filteredDets.length} Matching Detections
                        </Tag>

                        <Text style={{ color: '#888', fontSize: '0.75rem' }}>{currentIndex + 1} of {images.length}</Text>
                        {lastLoadTime > 0 && (
                            <Tag color="cyan" style={{ borderRadius: '4px', border: 'none', background: 'rgba(0, 255, 255, 0.1)', color: '#00ffff', fontSize: '10px' }}>
                                Load: {lastLoadTime.toFixed(0)}ms
                            </Tag>
                        )}
                    </Space>
                </div>

                {/* RIGHT SIDE: PROACTIVE DUPLICATE INSIGHTS */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {isDuplicate && (
                        <Tooltip title="Click to isolate all matching images in gallery">
                            <Tag
                                color="purple"
                                onClick={() => {
                                    if (setFilters) {
                                        setFilters(prev => ({ ...prev, showOnlyDuplicates: true }));
                                        onCancel(); // Close to show results
                                    }
                                }}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
                                    color: 'white',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.3s',
                                    padding: '6px 16px',
                                    boxShadow: '0 4px 15px rgba(114, 46, 209, 0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}
                                className="duplicate-tag-hover-reveal"
                            >
                                <InfoCircleOutlined style={{ fontSize: '14px', color: 'white' }} />
                                DUPLICATE IMAGES: MATCH GROUP #{matchId}
                            </Tag>
                        </Tooltip>
                    )}
                </div>

                <Space size={14} align="center" style={{
                    background: 'rgba(28, 28, 30, 0.75)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    height: '42px',
                    padding: '0 16px',
                    borderRadius: '40px',
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '2px',
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center'
                    }}>
                        {/* 1. Precision Overlay Filters */}
                        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '2px', gap: '2px' }}>
                            <Tooltip title="Show/Hide Bounding Boxes">
                                <Button
                                    type="text"
                                    size="small"
                                    style={{
                                        color: showBoxes ? '#1890ff' : '#666',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0 8px',
                                        height: '24px'
                                    }}
                                    onClick={() => setShowBoxes(!showBoxes)}
                                >
                                    <div style={{ border: '2px solid currentColor', width: 12, height: 12 }} />
                                    <span style={{ fontSize: '11px', fontWeight: 600 }}>Boxes</span>
                                </Button>
                            </Tooltip>
                            <Tooltip title="Show/Hide Contours">
                                <Button
                                    type="text"
                                    size="small"
                                    style={{
                                        color: showContours ? '#faad14' : '#666',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0 8px',
                                        height: '24px'
                                    }}
                                    onClick={() => setShowContours(!showContours)}
                                >
                                    <div style={{
                                        width: 12, height: 12, borderRadius: '50%',
                                        border: '2px solid currentColor', borderStyle: 'dashed'
                                    }} />
                                    <span style={{ fontSize: '11px', fontWeight: 600 }}>Contours</span>
                                </Button>
                            </Tooltip>
                            <Tooltip title="Show/Hide Labels">
                                <Button
                                    type="text"
                                    size="small"
                                    style={{
                                        color: showLabels ? '#52c41a' : '#666',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0 8px',
                                        height: '24px'
                                    }}
                                    onClick={() => setShowLabels(!showLabels)}
                                >
                                    <span style={{ fontWeight: 800, fontSize: '11px' }}>Aa</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600 }}>Labels</span>
                                </Button>
                            </Tooltip>
                        </div>

                        {/* Divider Line */}
                        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

                        {/* 2. Advanced Zoom Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '2px' }}>
                            <Tooltip title="Zoom Out">
                                <Button type="text" size="small" style={{ color: '#fff', width: 32 }} icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
                            </Tooltip>

                            <Tooltip title="Reset Zoom">
                                <div
                                    onClick={handleResetZoom}
                                    style={{
                                        color: '#aaa',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '0 8px',
                                        minWidth: '45px',
                                        textAlign: 'center',
                                        userSelect: 'none'
                                    }}
                                >
                                    {Math.round(scale * 100)}%
                                </div>
                            </Tooltip>

                            <Tooltip title="Zoom In">
                                <Button type="text" size="small" style={{ color: '#fff', width: 32 }} icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                            </Tooltip>

                            <Tooltip title="Center View">
                                <Button type="text" size="small" style={{ color: '#fff', width: 32, marginLeft: '2px' }} icon={<ReloadOutlined />} onClick={handleResetZoom} />
                            </Tooltip>
                        </div>
                    </div>

                    <Tooltip title="Download Image">
                        <Button
                            className="premium-action-btn"
                            style={{
                                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '8px',
                                fontWeight: 700,
                                height: '30px',
                                padding: '0 12px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.25)',
                                letterSpacing: '0.4px'
                            }}
                            icon={<DownloadOutlined style={{ fontSize: '14px' }} />}
                            onClick={handleDownload}
                        >
                            Download
                        </Button>
                    </Tooltip>

                    <Tooltip title={isDrawingMode ? "Cancel Drawing" : "Add Missing Defect"}>
                        <Button
                            className="premium-action-btn"
                            onClick={() => {
                                setIsDrawingMode(!isDrawingMode);
                                setTempBox(null);
                            }}
                            style={{
                                background: isDrawingMode
                                    ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)'
                                    : 'linear-gradient(135deg, #52c41a 0%, #237804 100%)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '8px',
                                fontWeight: 800,
                                height: '30px',
                                padding: '0 12px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: isDrawingMode
                                    ? '0 4px 12px rgba(255, 77, 79, 0.25)'
                                    : '0 4px 12px rgba(82, 196, 26, 0.25)',
                                letterSpacing: '0.6px'
                            }}
                            icon={isDrawingMode ? <CloseCircleOutlined style={{ fontSize: '14px' }} /> : <CheckCircleOutlined style={{ fontSize: '14px' }} />}
                        >
                            {isDrawingMode ? "CANCEL" : "ADD MISSING"}
                        </Button>
                    </Tooltip>

                    {/* Phase 7.1: Missed Detections Toggle */}
                    {missedDetections.length > 0 && (
                        <>
                            <Tooltip title="Show/Hide Missed Ground Truth Detections">
                                <Button
                                    className="premium-action-btn"
                                    onClick={() => setShowMissed(!showMissed)}
                                    style={{
                                        background: showMissed
                                            ? 'linear-gradient(135deg, rgba(208,208,208,0.15) 0%, rgba(160,160,160,0.15) 100%)'
                                            : 'rgba(0,0,0,0.3)',
                                        border: `1px solid ${showMissed ? '#d0d0d0' : 'rgba(255,255,255,0.1)'}`,
                                        color: showMissed ? '#d0d0d0' : '#666',
                                        borderRadius: '8px',
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: showMissed ? '0 0 15px rgba(208,208,208,0.3)' : 'none',
                                        letterSpacing: '0.6px'
                                    }}
                                >
                                    <span style={{ fontSize: '13px' }}>◻️</span>
                                    MISSED ({missedDetections.length})
                                </Button>
                            </Tooltip>

                            {showMissed && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <span style={{ fontSize: '10px', color: '#888', fontWeight: 600 }}>IoU:</span>
                                    <input
                                        type="number"
                                        min="0.1"
                                        max="0.9"
                                        step="0.05"
                                        value={iouThreshold}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (val >= 0.1 && val <= 0.9) setIouThreshold(val);
                                        }}
                                        style={{
                                            width: '50px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '4px',
                                            color: '#fff',
                                            fontSize: '11px',
                                            padding: '2px 6px',
                                            textAlign: 'center',
                                            fontWeight: 600
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

                    <Tooltip title="Image Viewer Guide">
                        <Button
                            className="premium-action-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!showHelp) setShowManualDetails(false);
                                setShowHelp(!showHelp);
                            }}
                            style={{
                                background: showHelp
                                    ? 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)'
                                    : 'rgba(255,255,255,0.08)',
                                color: '#fff',
                                borderRadius: '8px',
                                height: '30px',
                                padding: '0 12px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: `1px solid ${showHelp ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.03)'}`,
                                fontWeight: 700,
                                letterSpacing: '0.6px',
                                boxShadow: showHelp ? '0 4px 12px rgba(114, 46, 209, 0.3)' : 'none'
                            }}
                        >
                            <InfoCircleOutlined style={{ fontSize: '14px' }} />
                            <span>HELP</span>
                        </Button>
                    </Tooltip>

                    <Button
                        type="text"
                        icon={<CloseOutlined style={{ color: '#fff', fontSize: 16 }} />}
                        onClick={onCancel}
                        style={{
                            marginLeft: '2px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '50%',
                            width: '30px',
                            height: '30px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}
                    />
                </Space>
            </div>

            {/* Image Container */}
            <div className={`prediction-image-container ${isDrawingMode ? 'drawing-active' : ''}`} style={{
                flex: 1,
                position: 'relative',
                background: '#000',
                overflow: 'hidden',
                cursor: isDrawingMode ? 'crosshair' : (scale > 1 ? 'zoom-out' : 'default'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={() => {
                    if (scale > 1 && !isDragging) handleResetZoom();
                }}
            >
                {/* Main Image Layer */}
                {/* Navigation Buttons */}
                {/* Floating Intelligence HUD Side Panel */}
                {/* Floating Intelligence HUD Side Panel - Premium Crystal Glass Redesign */}
                {showHelp && (
                    <div
                        ref={helpRef}
                        style={{
                            position: 'absolute',
                            left: '2.5rem',
                            top: '54%', // Shifted down slightly to utilize bottom space and feel more 'in the middle'
                            transform: 'translateY(-50%)',
                            width: '380px',
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1))', // Lighter Prism base
                            backdropFilter: 'blur(50px) saturate(210%)', // Ultra-clear frosted crystal
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderTop: '2px solid rgba(255,255,255,0.8)', // Brilliant refractive rim
                            borderLeft: '1.5px solid rgba(255,255,255,0.5)', // Sharp side edge
                            borderRadius: '20px',
                            padding: '10px 18px', // Shorter padding
                            zIndex: 1000,
                            boxShadow: `
                                0 30px 80px -20px rgba(0,0,0,0.5), 
                                0 0 0 1px rgba(255,255,255,0.1) inset,
                                0 1px 0 0 rgba(255,255,255,0.4) inset
                            `,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px', // Tighter gaps
                            animation: 'fadeInCrystal3D 0.7s cubic-bezier(0.19, 1, 0.22, 1)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Prism Sheen Highlight */}
                        <div style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-50%',
                            width: '200%',
                            height: '200%',
                            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                            pointerEvents: 'none',
                            transform: 'rotate(-20deg)',
                            zIndex: -1
                        }} />
                        <style>
                            {`
                                @keyframes fadeInCrystal3D {
                                    from { opacity: 0; transform: translateY(-50%) translateX(-60px) perspective(2000px) rotateY(25deg) scale(0.98); }
                                    to { opacity: 1; transform: translateY(-50%) translateX(0) perspective(2000px) rotateY(0deg) scale(1); }
                                }
                            `}
                        </style>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '-2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* Premium Crystal Indicator Symbol */}
                                <div style={{
                                    width: 6,
                                    height: 22,
                                    background: 'linear-gradient(to bottom, #1890ff, #0050b3)',
                                    borderRadius: '6px',
                                    boxShadow: '0 0 15px rgba(24,144,255,0.6), inset 0 1px 1px rgba(255,255,255,0.8)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)' }} />
                                </div>
                                <Text style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '1px', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>INTELLIGENCE HUD</Text>
                            </div>
                            <CloseOutlined
                                onClick={() => setShowHelp(false)}
                                style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px', transition: 'all 0.3s' }}
                            />
                        </div>

                        {/* NEW: PRIMARY ACTION - ADD MISSING DEFECT */}
                        <div style={{ margin: '2px 0 6px 0' }}>
                            <Button
                                block
                                icon={<span style={{ fontSize: '12px' }}>➕</span>}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDrawingMode(!isDrawingMode);
                                }}
                                style={{
                                    height: '30px',
                                    background: isDrawingMode ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'rgba(24, 144, 255, 0.15)',
                                    border: `1px solid ${isDrawingMode ? 'rgba(255,255,255,0.2)' : 'rgba(24, 144, 255, 0.3)'}`,
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    borderRadius: '8px',
                                    boxShadow: isDrawingMode ? '0 4px 12px rgba(255,77,79,0.3)' : 'none',
                                    transition: 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isDrawingMode ? 'CANCEL DRAWING' : 'ADD MISSING DEFECT'}
                            </Button>
                            {isDrawingMode && (
                                <div style={{ textAlign: 'center', marginTop: '6px', animation: 'pulseText 1.5s infinite' }}>
                                    <Text style={{ color: '#ff4d4f', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {tempBox
                                            ? `Drawing: ${Math.round(tempBox.width)} x ${Math.round(tempBox.height)} (${Math.round(tempBox.width * tempBox.height).toLocaleString()} px²)`
                                            : "Mode: Drawing on Image..."}
                                    </Text>
                                </div>
                            )}
                            <style>
                                {`
                                 @keyframes pulseText {
                                     0% { opacity: 0.5; }
                                     50% { opacity: 1; }
                                     100% { opacity: 0.5; }
                                 }
                               `}
                            </style>
                        </div>

                        {/* Section 1: Visual Intelligence */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <Text style={{ color: '#1890ff', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Visual Intelligence</Text>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <Text style={{ color: '#fff', fontSize: '0.7rem', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>• Box Colors: <span style={{ color: '#52c41a', fontWeight: 800 }}>Safe</span> | <span style={{ color: '#faad14', fontWeight: 800 }}>Review</span> | <span style={{ color: '#ff4d4f', fontWeight: 800 }}>Risk</span></Text>
                                <Text style={{ color: '#fff', fontSize: '0.7rem' }}>• Toggles: Use <strong>Aa</strong>, <strong>Boxes</strong>, <strong>Contours</strong>.</Text>
                                <Text style={{ color: '#fff', fontSize: '0.7rem' }}>• Download: Save this image with results.</Text>
                            </div>
                        </div>

                        {/* Section 2: Precision Verification */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <Text style={{ color: '#1890ff', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Precision Verification</Text>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>

                                {/* 1. The 5 Tools (Operational Area) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 12, height: 12, border: '1px solid rgba(255,255,255,0.5)', borderRadius: '3px', background: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ width: 6, height: 2, background: '#fff' }} />
                                            </div>
                                            <Text style={{ color: '#fff', fontSize: '0.68rem' }}><strong>Checkbox:</strong> Hide/Show box.</Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Text style={{ color: '#1890ff', fontSize: '0.7rem', fontWeight: 900 }}>Class Name</Text>
                                            <Text style={{ color: '#fff', fontSize: '0.68rem' }}>Click to Zoom.</Text>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontSize: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '1px 4px', borderRadius: '3px', fontWeight: 900, background: 'rgba(255,255,255,0.1)' }}>UNVERIFIED</div>
                                        <Text style={{ color: '#fff', fontSize: '0.68rem' }}>Reset decision.</Text>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                                            <div style={{ fontSize: '8px', color: '#1890ff', border: '1px solid rgba(24,144,255,0.5)', padding: '0 4px', borderRadius: '3px', fontWeight: 900, background: 'rgba(24,144,255,0.1)' }}>PASS</div>
                                            <Text style={{ color: '#fff', fontSize: '0.68rem' }}><strong>AI is Correct.</strong> Save as a baseline to compare next experiments.</Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                                            <div style={{ fontSize: '8px', color: '#ff4d4f', border: '1px solid rgba(255,77,79,0.5)', padding: '0 4px', borderRadius: '3px', fontWeight: 900, background: 'rgba(255,77,79,0.1)' }}>FAIL</div>
                                            <Text style={{ color: '#fff', fontSize: '0.68rem' }}><strong>False Positive.</strong> Track error to see if future models improve.</Text>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. The Story Box (Documentation Area) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 10, height: 10, background: 'rgba(163, 53, 238, 0.2)', border: '1px solid #a335ee', borderRadius: '2px' }} />
                                            <Text style={{ color: '#fff', fontSize: '0.68rem' }}><strong>Purple:</strong> Manual Marks.</Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 10, height: 10, background: 'transparent', border: '1px dashed #ff8c00', borderRadius: '2px' }} />
                                            <Text style={{ color: '#fff', fontSize: '0.68rem' }}><strong>Orange:</strong> History Hints.</Text>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                        <div style={{ fontSize: '9px', color: '#faad14', border: '1px solid rgba(250,173,20,0.5)', padding: '0 4px', borderRadius: '3px', fontWeight: 900, background: 'rgba(250,173,20,0.1)' }}>STORY</div>
                                        <Text style={{ color: '#fff', fontSize: '0.68rem', fontStyle: 'italic' }}><strong>Story History:</strong> Hover any box for its full evolution details.</Text>
                                    </div>
                                </div>
                            </div>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', paddingLeft: '4px', fontStyle: 'italic', marginTop: '2px' }}>
                                Tip: Use <u>Select All</u> / <u>Unselect All</u> for bulk actions.
                            </Text>
                        </div>

                        {/* Section 3: Navigation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <Text style={{ color: '#1890ff', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Dynamic Navigation</Text>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <Text style={{ color: '#fff', fontSize: '0.7rem', textShadow: '0 1px 2px rgba(0,0,0,0.4)', fontWeight: 700 }}>• Hover any box to see its "Evolution Story".</Text>
                                <Text style={{ color: '#fff', fontSize: '0.7rem', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>• <strong>Drag:</strong> Hold and move image to see edges.</Text>
                                <Text style={{ color: '#fff', fontSize: '0.7rem', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>• <strong>Reset:</strong> Click the black background area.</Text>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                            <Text style={{ color: '#52c41a', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.5px' }}>STRATEGY: Build a baseline to compare next models.</Text>
                        </div>
                    </div>
                )}

                <Button
                    className="nav-btn left"
                    icon={<LeftOutlined />}
                    disabled={currentIndex === 0}
                    onClick={() => onNavigate(images[currentIndex - 1])}
                    style={{
                        position: 'absolute',
                        left: '1.5rem',
                        zIndex: 200,
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(4px)',
                        border: 'none',
                        color: '#fff',
                        height: '3.5rem',
                        width: '3.5rem',
                        borderRadius: '50%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                />

                <div className="prediction-image-container" style={{
                    height: '100%',
                    width: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isDrawingMode ? 'crosshair' : (scale > 1 ? 'zoom-out' : 'default')
                }}>
                    {/* 
                        ROBUST SHRINK-WRAP WRAPPER with ZOOM & PANNING:
                    */}
                    <div
                        onMouseDown={handleMouseDown}
                        onDoubleClick={(e) => {
                            // Double-click outside = Cancel: dismiss box and popup (but keep drawing mode active)
                            if (e.target.tagName !== 'rect' && e.target.tagName !== 'g' && e.target.tagName !== 'text') {
                                if (showClassPopup || tempBox) {
                                    setShowClassPopup(false);
                                    setTempBox(null);
                                    setSelectedBoxForClass(null);
                                }
                            }
                        }}
                        onClick={(e) => {
                            // Image area: Only close popups/details, do NOT reset zoom
                            e.stopPropagation(); // Prevent background reset
                            if (e.target.tagName !== 'rect' && e.target.tagName !== 'g' && e.target.tagName !== 'text') {
                                setShowManualDetails(false);
                                setFocusedIndex(null);
                            }
                        }}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            userSelect: 'none',
                            cursor: isDrawingMode ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt={currentImage}
                            onLoad={handleImgLoad}
                            onClick={() => {
                                if (showHelp) setShowHelp(false);
                            }}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                boxShadow: '0 0 60px rgba(0,0,0,0.9)',
                                pointerEvents: 'none' // Let dragging be handled by the parent
                            }}
                        />

                        {/* SVG Dynamic Overlay - NATURALLY PERFECT ALIGNMENT */}
                        {dimensions.width > 0 && !isImgLoading && (
                            <svg
                                ref={svgRef}
                                className="detection-overlay-svg"
                                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: (isDrawingMode || selectedVerifyForDelete) ? 'all' : 'all', // Always allow events but control target
                                    zIndex: 10
                                }}
                            >
                                {/* Phase 2/3: Drawing Temporary Box */}
                                {tempBox && (
                                    <rect
                                        x={tempBox.x}
                                        y={tempBox.y}
                                        width={tempBox.width}
                                        height={tempBox.height}
                                        fill="rgba(24, 144, 255, 0.1)"
                                        stroke={showClassPopup ? "#a335ee" : "#1890ff"}
                                        strokeWidth={3 / scale}
                                        strokeDasharray={showClassPopup ? "none" : `${8 / scale},${4 / scale}`}
                                        style={{ pointerEvents: 'none' }}
                                    />
                                )}

                                {/* Phase 3: My Manual Boxes (Solid Purple) */}
                                {myBoxes.map((v, i) => (
                                    <g
                                        key={`manual-${v.id || i}`}
                                        onClick={(e) => handleManualBoxClick(e, v)}
                                        onDoubleClick={(e) => handleManualBoxDoubleClick(e, v)}
                                        onMouseEnter={(e) => handleBoxMouseEnter(e, `You marked this ${v.class_name} as missing from AI model prediction in this experiment.\n\nSingle-click for more details. Double-click to delete this mark.`, 'manual')}
                                        onMouseMove={handleBoxMouseMove}
                                        onMouseLeave={handleBoxMouseLeave}
                                        style={{ cursor: isDrawingMode ? 'crosshair' : 'pointer' }}
                                    >
                                        <rect
                                            x={v.bbox[0]}
                                            y={v.bbox[1]}
                                            width={v.bbox[2] - v.bbox[0]}
                                            height={v.bbox[3] - v.bbox[1]}
                                            fill={selectedVerifyForDelete?.id === v.id ? "rgba(255, 77, 79, 0.2)" : "rgba(163, 53, 238, 0.1)"}
                                            stroke={selectedVerifyForDelete?.id === v.id ? "#ff4d4f" : "#a335ee"}
                                            strokeWidth={(selectedVerifyForDelete?.id === v.id ? 4 : 3) / scale}
                                            style={{
                                                pointerEvents: 'all',
                                                strokeOpacity: 0.8,
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </g>
                                ))}

                                {/* Phase 4: Hint Boxes from Other Experiments (Orange Dotted) */}
                                {hintBoxes.map((v, i) => (
                                    <g
                                        key={`hint-${v.id || i}`}
                                        onClick={(e) => handleHintBoxClick(e, v)}
                                        onMouseEnter={(e) => handleBoxMouseEnter(e, getHintTooltip(v), 'hint')}
                                        onMouseMove={handleBoxMouseMove}
                                        onMouseLeave={handleBoxMouseLeave}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <rect
                                            x={v.bbox[0]}
                                            y={v.bbox[1]}
                                            width={v.bbox[2] - v.bbox[0]}
                                            height={v.bbox[3] - v.bbox[1]}
                                            fill="rgba(255, 140, 0, 0.05)"
                                            stroke="#ff8c00"
                                            strokeWidth={2 / scale}
                                            strokeDasharray={`${8 / scale},${4 / scale}`}
                                            style={{
                                                pointerEvents: 'all',
                                                strokeOpacity: 0.7
                                            }}
                                        />
                                    </g>
                                ))}
                                {filteredDets.map((d, i) => {
                                    if (!selectedIndices.includes(i)) return null;

                                    const isHovered = hoveredIndex === i;
                                    // Risk coloring logic
                                    let riskColor = '#52c41a';
                                    let riskClass = 'low-risk';
                                    if (d.confidence < 0.4) {
                                        riskColor = '#ff4d4f';
                                        riskClass = 'high-risk';
                                    } else if (d.confidence < 0.7) {
                                        riskColor = '#faad14';
                                        riskClass = 'medium-risk';
                                    }

                                    // FALSE POSITIVE DETECTION: Override ONLY for the label background
                                    // Use local fpIndices check (from verification API) OR flag on the detection object
                                    const isPossibleFP = fpIndices.includes(allDets.indexOf(d)) || d.has_ground_truth_match === false;

                                    let labelColor = riskColor;
                                    if (isPossibleFP) {
                                        labelColor = '#ff8c00';  // Orange (same as missing defect hints)
                                    }

                                    const [x1, y1, x2, y2] = d.bbox;
                                    const w = Math.round(x2 - x1);
                                    const h = Math.round(y2 - y1);
                                    const area = Math.round(w * h);

                                    const indexLabel = `#${i + 1}`;
                                    const baseLabel = `${indexLabel} ${d.class} ${(d.confidence * 100).toFixed(0)}%`;
                                    const fpTag = isPossibleFP ? ' [CHECK FP?]' : '';  // Add tag for possible FP
                                    const sizeLabel = ` [${w}x${h} | ${area.toLocaleString()}px²]`;
                                    const labelText = isHovered ? `${baseLabel}${fpTag}${sizeLabel}` : `${baseLabel}${fpTag}`;

                                    const charWidth = 8.5; // Estimated monospace width
                                    const labelPadding = 45;
                                    const labelWidth = Math.max((labelText.length) * charWidth + labelPadding, isHovered ? 180 : 90);
                                    const labelHeight = 18;

                                    // 1. Dynamic X (Don't go off right edge)
                                    let labelX = d.bbox[0];
                                    if (labelX + labelWidth > dimensions.width) {
                                        labelX = Math.max(0, dimensions.width - labelWidth);
                                    }

                                    // 2. Dynamic Y (Avoid clipping and overlap)
                                    // Logic: Find best baseline vertical position
                                    let labelY;
                                    const spaceAbove = d.bbox[1];
                                    const spaceBelow = dimensions.height - d.bbox[3];

                                    if (spaceAbove >= labelHeight + 4) {
                                        // Case A: Plenty of space ABOVE
                                        labelY = d.bbox[1] - 4;
                                    } else if (spaceBelow >= labelHeight + 4) {
                                        // Case B: Not enough space above, but space BELOW
                                        labelY = d.bbox[3] + labelHeight + 4;
                                    } else {
                                        // Case C: Box covers almost full height, put INSIDE top
                                        labelY = d.bbox[1] + labelHeight + 4;
                                    }

                                    return (
                                        <g key={i}>
                                            {/* 1. RENDER CONTOURS (Polygons) */}
                                            {showContours && d.segmentation && selectedIndices.includes(i) && (
                                                <polygon
                                                    points={d.segmentation.map(p => `${p[0]},${p[1]}`).join(' ')}
                                                    fill={`${riskColor}33`} // 20% opacity fill
                                                    stroke={riskColor}
                                                    strokeWidth={1.5}
                                                    strokeDasharray="4,2"
                                                    style={{ transition: 'none' }}
                                                />
                                            )}

                                            {/* 2. RENDER BOUNDING BOXES */}
                                            {showBoxes && d.bbox && (
                                                <rect
                                                    x={d.bbox[0]}
                                                    y={d.bbox[1]}
                                                    width={d.bbox[2] - d.bbox[0]}
                                                    height={d.bbox[3] - d.bbox[1]}
                                                    className={`detection-highlight-rect ${riskClass} ${isHovered ? 'hovered' : ''}`}
                                                    onMouseEnter={() => setHoveredIndex(i)}
                                                    onMouseLeave={() => setHoveredIndex(null)}
                                                    onClick={(e) => { e.stopPropagation(); handleFocusDetection(i); }}
                                                    style={{
                                                        strokeWidth: isHovered ? 4 : 2,
                                                        stroke: isHovered ? '#fff' : riskColor,
                                                        fill: isHovered ? `${riskColor}22` : 'transparent',
                                                        transition: 'all 0.1s ease',
                                                        pointerEvents: 'all',
                                                        cursor: focusedIndex === i && scale > 1.1 ? 'zoom-out' : 'zoom-in',
                                                        filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' : 'none'
                                                    }}
                                                />
                                            )}

                                            {/* 3. RENDER SMART LABELS (Text) */}
                                            {(showLabels || isHovered) && d.bbox && (
                                                <g
                                                    transform={`translate(${labelX}, ${labelY})`}
                                                    onMouseEnter={() => setHoveredIndex(i)}
                                                    onMouseLeave={() => setHoveredIndex(null)}
                                                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                                                >
                                                    {/* Label Background */}
                                                    <rect
                                                        x={0}
                                                        y={-18}
                                                        width={labelWidth}
                                                        height={18}
                                                        fill={isHovered ? '#fff' : labelColor}
                                                        opacity={isHovered ? 1 : 0.85}
                                                        rx={2}
                                                        style={{ transition: 'all 0.1s ease' }}
                                                    />
                                                    {/* Label Text */}
                                                    <text
                                                        x={4}
                                                        y={-5}
                                                        fill={isHovered ? '#000' : '#fff'}
                                                        style={{
                                                            fontSize: '14px',
                                                            fontWeight: '700',
                                                            fontFamily: 'monospace',
                                                            textShadow: isHovered ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                                                            transition: 'all 0.1s ease'
                                                        }}
                                                    >
                                                        {labelText}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Phase 7.1: Render Missed Ground Truth Detections (Light Gray) */}
                                {showMissed && missedDetections.map((missed, idx) => {
                                    const labelText = `${missed.class_name} - MISSED`;
                                    const charWidth = 8.5;
                                    const labelWidth = (labelText.length * charWidth) + 12;
                                    const labelHeight = 18;

                                    // Dynamic X
                                    let mtX = missed.bbox[0];
                                    if (mtX + labelWidth > dimensions.width) {
                                        mtX = Math.max(0, dimensions.width - labelWidth);
                                    }

                                    // Dynamic Y
                                    let mtY;
                                    const spaceAbove = missed.bbox[1];
                                    const spaceBelow = dimensions.height - missed.bbox[3];

                                    if (spaceAbove >= labelHeight + 4) {
                                        mtY = missed.bbox[1] - 4; // Above
                                    } else if (spaceBelow >= labelHeight + 4) {
                                        mtY = missed.bbox[3] + labelHeight + 4; // Below
                                    } else {
                                        mtY = missed.bbox[1] + labelHeight + 4; // Inside top
                                    }

                                    return (
                                        <g key={`missed-${idx}`}>
                                            <rect
                                                x={missed.bbox[0]}
                                                y={missed.bbox[1]}
                                                width={missed.bbox[2] - missed.bbox[0]}
                                                height={missed.bbox[3] - missed.bbox[1]}
                                                stroke="#d0d0d0"
                                                strokeWidth={3}
                                                strokeDasharray="8,4"
                                                fill="rgba(208,208,208,0.08)"
                                                pointerEvents="none"
                                            />
                                            <text
                                                x={mtX + 4}
                                                y={mtY - 4}
                                                fill="#d0d0d0"
                                                style={{
                                                    fontSize: '13px',
                                                    fontWeight: 800,
                                                    fontFamily: 'monospace',
                                                    textShadow: '0 0 6px #000, 0 0 3px #000'
                                                }}
                                            >
                                                {labelText}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        )}
                    </div>
                </div>

                <Button
                    className="nav-btn right"
                    icon={<RightOutlined />}
                    disabled={currentIndex === images.length - 1}
                    onClick={() => onNavigate(images[currentIndex + 1])}
                    style={{
                        position: 'absolute',
                        right: '1.5rem',
                        zIndex: 200,
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(4px)',
                        border: 'none',
                        color: '#fff',
                        height: '3.5rem',
                        width: '3.5rem',
                        borderRadius: '50%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                />
            </div>

            {/* Footer: Detection Details */}
            <div style={{
                padding: isFooterCollapsed ? '0.4rem 1.25rem' : '0.75rem 1.25rem',
                background: 'rgba(10,10,10,0.95)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                maxHeight: isFooterCollapsed ? '50px' : '12rem',
                overflowY: isFooterCollapsed ? 'hidden' : 'auto',
                zIndex: 100,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Text type="secondary" style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600 }}>
                            <InfoCircleOutlined /> MATCHING FILTERS ({filteredDets.length})
                        </Text>
                        {!isFooterCollapsed && (
                            <Space size={8}>
                                <Button
                                    size="small"
                                    type="text"
                                    style={{ color: '#1890ff', fontSize: '0.7rem', padding: '0 4px' }}
                                    onClick={selectAll}
                                >
                                    Select All
                                </Button>
                                <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                                <Button
                                    size="small"
                                    type="text"
                                    style={{ color: '#ff4d4f', fontSize: '0.7rem', padding: '0 4px' }}
                                    onClick={selectNone}
                                >
                                    Unselect All
                                </Button>
                            </Space>
                        )}
                    </div>

                    <Button
                        type="text"
                        size="small"
                        onClick={() => setIsFooterCollapsed(!isFooterCollapsed)}
                        icon={isFooterCollapsed ? <UpOutlined /> : <DownOutlined />}
                        style={{
                            color: isFooterCollapsed ? '#1890ff' : '#666',
                            background: isFooterCollapsed ? 'rgba(24,144,255,0.1)' : 'rgba(255,255,255,0.05)',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '0 8px',
                            height: '22px'
                        }}
                    >
                        {isFooterCollapsed ? 'EXPAND' : 'MINIMIZE'}
                    </Button>
                </div>

                {!isFooterCollapsed && (
                    <>
                        {scale > 1 && (
                            <Text style={{ color: '#444', fontSize: '0.7rem', marginTop: '4px', display: 'block' }}>Click and Drag to Pan Image</Text>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '8px' }}>
                            {filteredDets.length > 0 ? filteredDets.map((d, i) => {
                                let color = '#1890ff'; // Default Blue
                                let bg = 'rgba(24, 144, 255, 0.15)';

                                if (d.confidence < 0.4) {
                                    color = '#ff4d4f'; // High Risk
                                    bg = 'rgba(255, 77, 79, 0.15)';
                                } else if (d.confidence < 0.7) {
                                    color = '#faad14'; // Medium Risk
                                    bg = 'rgba(250, 173, 20, 0.15)';
                                } else {
                                    color = '#52c41a'; // Low Risk
                                    bg = 'rgba(82, 196, 26, 0.15)';
                                }

                                const isSelected = selectedIndices.includes(i);

                                // Find matching verification
                                const fileName = currentImage.split('/').pop();
                                let imgMetadata = experiment?.input_images || {};

                                // Parse JSON string if needed
                                if (typeof imgMetadata === 'string') {
                                    try {
                                        imgMetadata = JSON.parse(imgMetadata);
                                    } catch (e) {
                                        console.error('Failed to parse input_images metadata:', e);
                                        imgMetadata = {};
                                    }
                                }

                                const currentImgHash = imgMetadata && !Array.isArray(imgMetadata) ? imgMetadata[fileName] : null;

                                let activeVerification = null;
                                let hintVerifications = []; // Store all historical hints
                                let currentMatchMethod = null;

                                verifications.forEach(v => {
                                    const vHash = v.image_hash_md5 || v.imageHashMd5;
                                    const hashMatch = currentImgHash && vHash === currentImgHash;
                                    const nameMatch = v.image_name === fileName;

                                    const isIdentityMatch = hashMatch || nameMatch;

                                    const isMatch = isIdentityMatch &&
                                        v.class_name === d.class &&
                                        Math.abs(v.bbox[0] - d.bbox[0]) < 1.0 &&
                                        Math.abs(v.bbox[1] - d.bbox[1]) < 1.0 &&
                                        Math.abs(v.bbox[2] - d.bbox[2]) < 1.0 &&
                                        Math.abs(v.bbox[3] - d.bbox[3]) < 1.0;

                                    if (isMatch) {
                                        if (v.experiment_id === experiment.id) {
                                            activeVerification = v;
                                            currentMatchMethod = hashMatch ? 'HASH' : 'NAME';
                                        } else {
                                            hintVerifications.push(v);
                                        }
                                    }
                                });

                                const vStatus = activeVerification?.status || 'unverified';
                                const primaryHint = hintVerifications.length > 0 ? hintVerifications[0] : null;

                                const isHovered = hoveredIndex === i;

                                return (
                                    <div
                                        key={i}
                                        onMouseEnter={() => setHoveredIndex(i)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                        style={{
                                            background: isSelected ? bg : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isHovered ? '#fff' : (isSelected ? color : 'rgba(255,255,255,0.1)')}`,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s ease',
                                            opacity: isSelected ? 1 : 0.5,
                                            position: 'relative',
                                            transform: isHovered ? 'translateY(-2px)' : 'none',
                                            boxShadow: isHovered ? `0 0 12px ${color}` : 'none'
                                        }}
                                        onClick={() => handleFocusDetection(i)}
                                    >
                                        <Text style={{ color: '#fff', fontSize: '0.7rem', opacity: 0.5, fontWeight: 'bold' }}>#{i + 1}</Text>
                                        <div
                                            onClick={(e) => { e.stopPropagation(); toggleDetection(i); }}
                                            style={{
                                                width: 14,
                                                height: 14,
                                                borderRadius: '2px',
                                                border: `1.5px solid ${isSelected ? color : '#555'}`,
                                                background: isSelected ? color : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {isSelected && <div style={{ width: 8, height: 2, background: '#fff', borderRadius: '1px' }} />}
                                        </div>
                                        <Text
                                            style={{ color: isSelected ? color : '#888', fontSize: '0.8125rem', fontWeight: 500 }}
                                        >
                                            <strong>{d.class}</strong>: {(d.confidence * 100).toFixed(1)}%
                                            <span style={{ fontSize: '0.7rem', color: '#666', marginLeft: '8px', fontStyle: 'italic' }}>
                                                ({Math.round(d.bbox[2] - d.bbox[0])} × {Math.round(d.bbox[3] - d.bbox[1])} px)
                                            </span>
                                            {activeVerification && (
                                                <span title={`Verified in Current Experiment (via ${currentMatchMethod})`} style={{ fontSize: '0.7rem', marginLeft: '6px' }}>
                                                    {currentMatchMethod === 'HASH' ? '🔑' : '📄'}
                                                </span>
                                            )}
                                            {!activeVerification && primaryHint && (
                                                <span title="Historical Hint available" style={{ fontSize: '0.7rem', marginLeft: '6px', filter: 'grayscale(1)', opacity: 0.4 }}>
                                                    🔑
                                                </span>
                                            )}
                                        </Text>

                                        {/* 3-Button Verification Status Selector */}
                                        <Space size={6} style={{ marginLeft: '8px' }}>
                                            {/* UNVERIFIED Button */}
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onVerify({
                                                        image_name: fileName,
                                                        class_name: d.class,
                                                        bbox: d.bbox,
                                                        status: 'unverified',
                                                        experiment_id: experiment.id
                                                    });
                                                }}
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold',
                                                    background: vStatus === 'unverified' ? 'rgba(128, 128, 128, 0.2)' : 'transparent',
                                                    border: `1px solid ${vStatus === 'unverified' ? '#888' : 'rgba(255,255,255,0.1)'}`,
                                                    color: vStatus === 'unverified' ? '#fff' : 'rgba(255,255,255,0.3)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                UNVERIFIED
                                            </div>

                                            {/* PASS Button */}
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onVerify({
                                                        image_name: fileName,
                                                        class_name: d.class,
                                                        bbox: d.bbox,
                                                        status: 'pass',
                                                        experiment_id: experiment.id
                                                    });
                                                }}
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold',
                                                    background: vStatus === 'pass' ? 'rgba(24, 144, 255, 0.2)' : 'transparent',
                                                    border: `1px solid ${vStatus === 'pass' ? '#1890ff' : 'rgba(255,255,255,0.1)'}`,
                                                    color: vStatus === 'pass' ? '#1890ff' : 'rgba(255,255,255,0.3)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                ✅ PASS
                                            </div>

                                            {/* FAIL Button */}
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onVerify({
                                                        image_name: fileName,
                                                        class_name: d.class,
                                                        bbox: d.bbox,
                                                        status: 'fail',
                                                        experiment_id: experiment.id
                                                    });
                                                }}
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold',
                                                    background: vStatus === 'fail' ? 'rgba(250, 140, 22, 0.2)' : 'transparent',
                                                    border: `1px solid ${vStatus === 'fail' ? '#fa8c16' : 'rgba(255,255,255,0.1)'}`,
                                                    color: vStatus === 'fail' ? '#fa8c16' : 'rgba(255,255,255,0.3)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                ❌ FAIL
                                            </div>
                                        </Space>

                                        {/* Historical Hint Badge */}
                                        {!activeVerification && hintVerifications.length > 0 && primaryHint && (
                                            <Tooltip
                                                title={
                                                    <div style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                                                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '8px', color: '#1890ff' }}>
                                                            VERIFICATION STORY
                                                        </div>
                                                        <div style={{ marginBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.1)', pb: '8px' }}>
                                                            {generateVerificationStory(hintVerifications)}
                                                        </div>
                                                        <div style={{ maxHeight: '150px', overflowY: 'auto', pr: '4px' }}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', mb: '4px', opacity: 0.5 }}>NAME LOG:</div>
                                                            {hintVerifications.map((hv, idx) => (
                                                                <div key={idx} style={{ fontSize: '0.65rem', marginBottom: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '3px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#fff' }}>{hv.training_name || 'Legacy'}</span>
                                                                        <span style={{ color: hv.status === 'pass' ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{hv.status.toUpperCase()}</span>
                                                                    </div>
                                                                    <div style={{ opacity: 0.5 }}>Expt: {hv.experiment_name || hv.experiment_id?.slice(0, 8)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                }
                                                overlayStyle={{ maxWidth: '320px' }}
                                            >
                                                <div style={{
                                                    marginLeft: 'auto',
                                                    padding: '2px 6px',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: '4px',
                                                    border: '1px dashed rgba(255,255,255,0.15)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    height: '24px'
                                                }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#666', fontWeight: 600 }}>HINT:</span>
                                                    <Tag
                                                        color={primaryHint.status === 'pass' ? 'success' : 'error'}
                                                        style={{ fontSize: '0.6rem', padding: '0 4px', height: '16px', lineHeight: '14.5px', margin: 0, border: 'none', borderRadius: '2px' }}
                                                    >
                                                        {primaryHint.status.toUpperCase()}
                                                    </Tag>
                                                </div>
                                            </Tooltip>
                                        )}
                                    </div>
                                );
                            }) : (
                                <Text type="secondary" style={{ color: '#666' }}>No matching objects with current filters.</Text>
                            )}
                        </div>
                    </>
                )}
            </div>

            <ManualClassPopup
                visible={showClassPopup}
                labels={projectLabels}
                position={popupPosition}
                onSelect={handleClassSelect}
                onCancel={() => {
                    setShowClassPopup(false);
                    setTempBox(null);
                }}
            />

            {/* Phase 3.5: Deletion Confirmation Popup */}
            {showDeletePopup && (
                <div style={{
                    position: 'fixed',
                    top: deletePopupPosition.y,
                    left: deletePopupPosition.x,
                    transform: 'translate(-50%, -120%)',
                    zIndex: 2000,
                    background: 'rgba(28, 28, 30, 0.85)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    borderRadius: '12px',
                    padding: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    animation: 'popupAppear 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                    minWidth: '160px'
                }}>
                    <style>{`
                        @keyframes popupAppear {
                            from { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
                            to { opacity: 1; transform: translate(-50%, -120%) scale(1); }
                        }
                    `}</style>
                    <div style={{ padding: '4px 8px', color: '#fff', fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
                        Delete this box?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            size="small"
                            type="text"
                            onClick={() => {
                                setShowDeletePopup(false);
                                setSelectedVerifyForDelete(null);
                            }}
                            style={{ flex: 1, color: '#999' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            type="primary"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={confirmDelete}
                            style={{ flex: 1 }}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            )}

            {/* Phase 4: Hint Confirmation Popup */}
            {showHintConfirm && (
                <div style={{
                    position: 'fixed',
                    top: hintConfirmPosition.y,
                    left: hintConfirmPosition.x,
                    transform: 'translate(-50%, -120%)',
                    zIndex: 2000,
                    background: 'rgba(28, 28, 30, 0.85)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    borderRadius: '12px',
                    padding: '8px',
                    border: '1px solid rgba(255, 140, 0, 0.3)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    animation: 'popupAppear 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                    minWidth: '180px'
                }}>
                    <div style={{ padding: '4px 8px', color: '#fff', fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
                        Accept this hint?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            size="small"
                            type="text"
                            onClick={() => {
                                setShowHintConfirm(false);
                                setSelectedHint(null);
                            }}
                            style={{ flex: 1, color: '#999' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            type="primary"
                            style={{ flex: 1, background: '#ff8c00', borderColor: '#ff8c00' }}
                            onClick={confirmAcceptHint}
                        >
                            Accept
                        </Button>
                    </div>
                </div>
            )}

            {/* Phase 4: Manual Box Details Popup (Premium Frosted Glass) */}
            {showManualDetails && selectedManualForDetails && (
                <div style={{
                    position: 'fixed',
                    top: manualDetailsPosition.y,
                    left: manualDetailsPosition.x,
                    transform: 'translate(-50%, -105%)',
                    zIndex: 2000,
                    background: 'rgba(28, 28, 30, 0.85)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    borderRadius: '12px',
                    padding: '12px',
                    border: '1px solid rgba(163, 53, 238, 0.3)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    animation: 'popupAppear 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                    minWidth: '240px',
                    maxWidth: '320px',
                    color: '#fff'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#a335ee' }}>
                            Correction History
                        </div>
                        <Button
                            type="text"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowManualDetails(false);
                            }}
                            style={{ color: '#999', padding: '0 4px', height: '20px' }}
                        >
                            ✕
                        </Button>
                    </div>

                    <div style={{ fontSize: '0.9rem', lineHeight: '1.4', opacity: 0.9 }}>
                        You marked this <span style={{ fontWeight: 600, color: '#fff' }}>{selectedManualForDetails.class_name}</span> as missing from AI model prediction here.
                    </div>

                    {(() => {
                        const others = currentImageVerifications.filter(v =>
                            v.experiment_id !== experiment?.id &&
                            bboxesMatch(v.bbox, selectedManualForDetails.bbox)
                        );

                        if (others.length > 0) {
                            return (
                                <div style={{
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                    paddingTop: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffcc00', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>⚠️</span> AI also missed this in {others.length} other experiments:
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: '#bbb',
                                        maxHeight: '100px',
                                        overflowY: 'auto',
                                        paddingRight: '4px'
                                    }}>
                                        {others.map((v, idx) => (
                                            <div key={idx} style={{ marginBottom: '6px' }}>
                                                • Prediction experiment '<span style={{ color: '#eee' }}>{v.experiment_name || v.experiment_id?.slice(0, 8)}</span>'
                                                <br />&nbsp;&nbsp;from training '<span style={{ color: '#eee' }}>{v.training_name || 'unknown'}</span>'
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#888', marginTop: '4px' }}>
                                        This suggests a persistent blind spot in the AI model.
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div style={{
                        fontSize: '0.75rem',
                        color: '#666',
                        textAlign: 'center',
                        marginTop: '4px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        paddingTop: '8px'
                    }}>
                        Double-click the box if you want to delete this mark.
                    </div>
                </div>
            )}

            {/* Phase 4.5: Custom Premium Hover Tooltip (Frosted Glass) */}
            {hoverTooltip.show && (
                <div style={{
                    position: 'fixed',
                    top: hoverTooltip.y + 15,
                    left: hoverTooltip.x + 15,
                    zIndex: 3000,
                    pointerEvents: 'none',
                    background: 'rgba(28, 28, 30, 0.85)',
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    border: `1px solid ${hoverTooltip.type === 'manual' ? 'rgba(163, 53, 238, 0.4)' : 'rgba(255, 140, 0, 0.4)'}`,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    animation: 'tooltipFadeIn 0.15s ease-out',
                    maxWidth: '300px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap'
                }}>
                    {hoverTooltip.content}
                </div>
            )}
        </Modal>
    );
};

export default ImageViewerModal;
