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
    ReloadOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * ImageViewerModal Component
 * 
 * Provides a full-screen detailed view of a prediction result with pixel-perfect overlays.
 */
const ImageViewerModal = ({ visible, onCancel, currentImage, images, experiment, onNavigate, filters }) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const currentIndex = images.indexOf(currentImage);

    // Reset zoom when image changes
    React.useEffect(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, [currentImage]);

    if (!visible || !currentImage || !experiment) return null;

    // Helper to get detections (handles both full path and filename only)
    const getDetectionsForImage = (name) => {
        if (experiment?.predictions?.[name]) return experiment.predictions[name];
        const fileName = name.split('/').pop();
        return experiment?.predictions?.[fileName] || [];
    };
    const allDets = getDetectionsForImage(currentImage);

    // Apply active filters to detections shown in big view
    const filteredDets = allDets.filter(d => {
        if (!filters) return true;
        const [minConf, maxConf] = [filters.confidenceRange[0] / 100, filters.confidenceRange[1] / 100];
        const confMatch = d.confidence >= minConf && d.confidence <= maxConf;
        const classMatch = filters.className === 'all' || d.class === filters.className;
        return confMatch && classMatch;
    });

    const imageUrl = `${window.location.protocol}//${window.location.hostname}:12000/${experiment.output_folder}/${currentImage}`;

    const handleImgLoad = (e) => {
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
        const relativePath = `${experiment.output_folder}/${currentImage}`;
        const downloadUrl = `${window.location.protocol}//${window.location.hostname}:12000/api/v1/download-file?path=${encodeURIComponent(relativePath)}`;

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
                    </Space>
                </div>

                <Space size={16}>
                    {/* Zoom Level Indicator */}
                    <Text style={{ color: '#aaa', fontSize: '0.75rem', marginRight: '8px' }}>
                        {Math.round(scale * 100)}%
                    </Text>

                    <Space.Compact style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '2px' }}>
                        <Tooltip title="Zoom Out">
                            <Button type="text" style={{ color: '#fff' }} icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
                        </Tooltip>
                        <Tooltip title="Reset View">
                            <Button type="text" style={{ color: '#fff' }} icon={<ReloadOutlined />} onClick={handleResetZoom} />
                        </Tooltip>
                        <Tooltip title="Zoom In">
                            <Button type="text" style={{ color: '#fff' }} icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                        </Tooltip>
                    </Space.Compact>

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

            {/* Main Content: Image & Nav & Overlay */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
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
                        style={{
                            position: 'relative',
                            display: 'flex',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            userSelect: 'none'
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
                        {dimensions.width > 0 && filteredDets.length > 0 && (
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
                                    zIndex: 5
                                }}
                            >
                                {filteredDets.map((d, i) => {
                                    if (!d.bbox) return null;
                                    const [x1, y1, x2, y2] = d.bbox;
                                    // Risk coloring
                                    let riskClass = '';
                                    if (d.confidence < 0.4) riskClass = 'high-risk';
                                    else if (d.confidence < 0.7) riskClass = 'medium-risk';
                                    else riskClass = 'low-risk';

                                    return (
                                        <rect
                                            key={i}
                                            x={x1}
                                            y={y1}
                                            width={x2 - x1}
                                            height={y2 - y1}
                                            className={`detection-highlight-rect ${riskClass}`}
                                        />
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
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600 }}>
                        <InfoCircleOutlined /> MATCHING FILTERS ({filteredDets.length})
                    </Text>
                    {scale > 1 && (
                        <Text style={{ color: '#555', fontSize: '0.7rem' }}>Click and Drag to Pan Image</Text>
                    )}
                </div>
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

                        return (
                            <div key={i} style={{
                                background: bg,
                                border: `1px solid ${color}`,
                                padding: '2px 8px',
                                borderRadius: '4px'
                            }}>
                                <Text style={{ color, fontSize: '0.8125rem', fontWeight: 500 }}>
                                    <strong>{d.class}</strong>: {(d.confidence * 100).toFixed(1)}%
                                </Text>
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
