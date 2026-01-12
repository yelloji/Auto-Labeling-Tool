import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Tag, Tooltip } from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    DownloadOutlined,
    FullscreenOutlined,
    CloseOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * ImageViewerModal Component
 * 
 * Provides a full-screen detailed view of a prediction result with pixel-perfect overlays.
 */
const ImageViewerModal = ({ visible, onCancel, currentImage, images, experiment, onNavigate, filters }) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    if (!visible || !currentImage || !experiment) return null;

    const currentIndex = images.indexOf(currentImage);

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

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = currentImage;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal
            visible={visible}
            footer={null}
            onCancel={onCancel}
            width="95%"
            centered
            bodyStyle={{
                padding: 0,
                height: '90vh',
                background: '#000',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
            closeIcon={<CloseOutlined style={{ color: '#fff', fontSize: 20 }} />}
            className="image-viewer-modal"
        >
            {/* Header / Info Bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '1rem',
                background: 'rgba(0,0,0,0.6)',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text style={{ color: '#fff', fontWeight: 600 }}>{currentImage}</Text>
                    <Space>
                        <Tag color="blue">{filteredDets.length} Matching Detections</Tag>
                        <Text style={{ color: '#aaa', fontSize: '0.75rem' }}>{currentIndex + 1} of {images.length}</Text>
                    </Space>
                </div>
                <Space>
                    <Tooltip title="Download Image">
                        <Button ghost icon={<DownloadOutlined />} onClick={handleDownload} />
                    </Tooltip>
                    <Button ghost icon={<FullscreenOutlined />} onClick={() => { }} disabled />
                </Space>
            </div>

            {/* Main Content: Image & Nav & Overlay */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Navigation Buttons */}
                <Button
                    className="nav-btn left"
                    icon={<LeftOutlined />}
                    disabled={currentIndex === 0}
                    onClick={() => onNavigate(images[currentIndex - 1])}
                    style={{
                        position: 'absolute',
                        left: '1rem',
                        zIndex: 20,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#fff',
                        height: '3rem',
                        width: '3rem',
                        borderRadius: '50%'
                    }}
                />

                <div className="prediction-image-container" style={{
                    height: '100%',
                    width: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* 
                        ROBUST SHRINK-WRAP WRAPPER:
                        This div will shrink to exactly the size of the rendered image.
                        The SVG can then be pinned to its edges with 0 top/left/width/height.
                    */}
                    <div style={{ position: 'relative', display: 'flex', maxWidth: '100%', maxHeight: '100%' }}>
                        <img
                            src={imageUrl}
                            alt={currentImage}
                            onLoad={handleImgLoad}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain', // Still used but wrapper limits its size
                                boxShadow: '0 0 40px rgba(0,0,0,0.8)'
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
                                    pointerEvents: 'none', // Critical: Let clicks through to the image
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
                        right: '1rem',
                        zIndex: 20,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#fff',
                        height: '3rem',
                        width: '3rem',
                        borderRadius: '50%'
                    }}
                />
            </div>

            {/* Footer: Detection Details */}
            <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.05)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                maxHeight: '15rem',
                overflowY: 'auto'
            }}>
                <div style={{ marginBottom: '0.5rem' }}>
                    <Text type="secondary" style={{ color: '#888', fontSize: '0.75rem' }}>
                        <InfoCircleOutlined /> MATCHING FILTERS ({filteredDets.length})
                    </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {filteredDets.length > 0 ? filteredDets.map((d, i) => (
                        <div key={i} style={{
                            background: d.confidence < 0.4 ? 'rgba(255, 77, 79, 0.15)' : 'rgba(24, 144, 255, 0.15)',
                            border: `1px solid ${d.confidence < 0.4 ? '#ff4d4f' : '#1890ff'}`,
                            padding: '2px 8px',
                            borderRadius: '4px'
                        }}>
                            <Text style={{ color: d.confidence < 0.4 ? '#ff4d4f' : '#1890ff', fontSize: '0.8125rem' }}>
                                <strong>{d.class}</strong>: {(d.confidence * 100).toFixed(1)}%
                            </Text>
                        </div>
                    )) : (
                        <Text type="secondary" style={{ color: '#666' }}>No matching objects with current filters.</Text>
                    )}
                </div>
            </div>

        </Modal>
    );
};

export default ImageViewerModal;
