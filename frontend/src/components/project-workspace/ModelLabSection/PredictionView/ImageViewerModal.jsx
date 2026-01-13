import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Tag, Tooltip } from 'antd';
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
    CloseCircleOutlined
} from '@ant-design/icons';

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
    verifications = [], // New: Project-level human reviews
    onVerify // New: Function to trigger save to DB
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

    // Individual Detection Selection State (Phase 2.4)
    // We store the INDICES of the detections that are checked.
    const [selectedIndices, setSelectedIndices] = useState([]);

    const currentIndex = images.indexOf(currentImage);

    // Helper to get detections (handles both full path and filename only)
    const getDetectionsForImage = (name) => {
        if (!name || !experiment?.predictions) return [];
        if (experiment.predictions[name]) return experiment.predictions[name];
        const fileName = name.split('/').pop();
        return experiment.predictions[fileName] || [];
    };
    const allDets = getDetectionsForImage(currentImage);

    // Apply active filters to detections shown in big view
    const filteredDets = allDets.filter(d => {
        if (!filters) return true;
        const [minConf, maxConf] = [filters.confidenceRange[0] / 100, filters.confidenceRange[1] / 100];
        const confMatch = d.confidence >= minConf && d.confidence <= maxConf;
        const classMatch = filters.className === 'all' || d.class === filters.className;

        // Apply Strict Risk Level Filter
        const riskLevel = filters.riskLevel;
        let riskMatch = true;
        if (riskLevel === 'high') riskMatch = d.confidence < 0.4;
        else if (riskLevel === 'medium') riskMatch = d.confidence >= 0.4 && d.confidence < 0.7;
        else if (riskLevel === 'low') riskMatch = d.confidence >= 0.7;

        return confMatch && classMatch && riskMatch;
    });

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
     * PRO DOWNLOAD HANDLER:
     * Uses the backend proxy to force a download via Content-Disposition.
     * This bypasses CORS fetch issues and "new tab" frustrations.
     */
    const handleDownload = () => {
        const downloadUrl = `${window.location.protocol}//${window.location.hostname}:12000/api/v1/experiments/${experiment.id}/original-image/${currentImage}?download=true`;

        // This will trigger the browser's save dialog without navigating away
        // because the backend sends 'Content-Disposition: attachment'
        window.location.href = downloadUrl;
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

    // Panning Handlers
    const handleMouseDown = (e) => {
        if (scale <= 1) return;
        setIsDragging(true);
        setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

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
            closeIcon={null} // We will use a custom close button for better UX
            className="image-viewer-modal"
        >
            {/* Header / Info Bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '0.75rem 1.25rem',
                background: 'rgba(0,0,0,0.8)',
                zIndex: 100,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
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

                <Space size={16}>
                    <div style={{
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '3px',
                        display: 'flex',
                        gap: '6px',
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
                                        cursor: 'pointer',
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
                            style={{ background: '#1890ff', borderColor: '#1890ff', color: '#fff', borderRadius: '6px' }}
                            icon={<DownloadOutlined />}
                            onClick={handleDownload}
                        >
                            Download
                        </Button>
                    </Tooltip>

                    <Button
                        type="text"
                        icon={<CloseOutlined style={{ color: '#fff', fontSize: 18 }} />}
                        onClick={onCancel}
                        style={{ marginLeft: '8px' }}
                    />
                </Space>
            </div>

            {/* Image Container */}
            <div style={{
                flex: 1,
                position: 'relative',
                background: '#000',
                overflow: 'hidden',
                cursor: isDragging ? 'grabbing' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Main Image Layer */}
                {/* Navigation Buttons */}
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
                    cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}>
                    {/* 
                        ROBUST SHRINK-WRAP WRAPPER with ZOOM & PANNING:
                    */}
                    <div
                        onMouseDown={handleMouseDown}
                        onClick={(e) => {
                            // If clicked exactly on the background (not a box), reset zoom
                            if (e.target.tagName !== 'rect' && e.target.tagName !== 'g' && e.target.tagName !== 'text' && scale > 1) {
                                handleResetZoom();
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
                            cursor: scale > 1 ? 'zoom-out' : 'default'
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt={currentImage}
                            onLoad={handleImgLoad}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                boxShadow: '0 0 60px rgba(0,0,0,0.9)',
                                pointerEvents: 'none' // Let dragging be handled by the parent
                            }}
                        />

                        {/* SVG Dynamic Overlay - NATURALLY PERFECT ALIGNMENT */}
                        {dimensions.width > 0 && filteredDets.length > 0 && !isImgLoading && (
                            <svg
                                className="detection-overlay-svg"
                                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 10
                                }}
                            >
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

                                    const labelX = d.bbox[0];
                                    const labelY = d.bbox[1] < 20 ? d.bbox[1] + 20 : d.bbox[1] - 4;
                                    const indexLabel = `#${i + 1}`;

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
                                                        width={Math.max((indexLabel.length + d.class.length) * 9 + 45, 90)}
                                                        height={18}
                                                        fill={isHovered ? '#fff' : riskColor}
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
                                                        {isHovered ? `${indexLabel} ` : ''}{d.class} {(d.confidence * 100).toFixed(0)}%
                                                    </text>
                                                </g>
                                            )}
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
                padding: '0.75rem 1.25rem',
                background: 'rgba(10,10,10,0.95)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                maxHeight: '12rem',
                overflowY: 'auto',
                zIndex: 100
            }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Text type="secondary" style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600 }}>
                        <InfoCircleOutlined /> MATCHING FILTERS ({filteredDets.length})
                    </Text>
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
                </div>
                {scale > 1 && (
                    <Text style={{ color: '#444', fontSize: '0.7rem' }}>Click and Drag to Pan Image</Text>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
            </div>

        </Modal>
    );
};

export default ImageViewerModal;
