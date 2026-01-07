import React, { useState, useEffect } from 'react';
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
 * Provides a full-screen detailed view of a prediction result.
 * Includes:
 * - Image navigation (prev/next)
 * - Detection list overlay
 * - Zoom/Pan capabilities (simplified for now)
 * - Download option
 */
const ImageViewerModal = ({ visible, onCancel, currentImage, images, experiment, onNavigate }) => {
    if (!visible || !currentImage) return null;

    const currentIndex = images.indexOf(currentImage);
    const detections = experiment?.predictions?.[currentImage] || [];

    const imageUrl = `${window.location.protocol}//${window.location.hostname}:12000/${experiment.output_folder}/${currentImage}`;

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
                        <Tag color="blue">{detections.length} Detections</Tag>
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

            {/* Main Content: Image & Nav */}
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

                <img
                    src={imageUrl}
                    alt={currentImage}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        boxShadow: '0 0 40px rgba(0,0,0,0.8)'
                    }}
                />

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
                        <InfoCircleOutlined /> DETECTIONS IN THIS IMAGE
                    </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {detections.length > 0 ? detections.map((d, i) => (
                        <div key={i} style={{
                            background: 'rgba(24, 144, 255, 0.15)',
                            border: '1px solid #1890ff',
                            padding: '2px 8px',
                            borderRadius: '4px'
                        }}>
                            <Text style={{ color: '#1890ff', fontSize: '0.8125rem' }}>
                                <strong>{d.class}</strong>: {(d.confidence * 100).toFixed(1)}%
                            </Text>
                        </div>
                    )) : (
                        <Text type="secondary" style={{ color: '#666' }}>No objects detected.</Text>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ImageViewerModal;
