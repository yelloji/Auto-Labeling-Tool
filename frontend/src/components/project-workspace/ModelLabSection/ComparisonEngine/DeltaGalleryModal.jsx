import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Space, Typography, Tag, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined, CloseOutlined, SplitCellsOutlined } from '@ant-design/icons';
import './DeltaGalleryModal.css';

const { Text, Title } = Typography;

const DeltaGalleryModal = ({
    visible,
    onCancel,
    items,
    type,
    baselineName,
    challengerName,
    baselineId,
    challengerId,
    projectId
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageDim, setImageDim] = useState({ width: 0, height: 0 });
    const containerRef = useRef(null);

    // Reset index when modal opens or items change
    useEffect(() => {
        if (visible) setCurrentIndex(0);
    }, [visible, items]);

    if (!visible || !items || items.length === 0) return null;

    const currentItem = items[currentIndex];
    // Baseline prediction images endpoint provides the raw image
    const imageUrl = `${window.location.protocol}//${window.location.hostname}:12000/api/v1/experiments/${baselineId}/original-image/${currentItem.image_name}`;

    const handleNext = () => setCurrentIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
    const handlePrev = () => setCurrentIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));

    const handleImageLoad = (e) => {
        setImageDim({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
        });
    };

    const getTypeConfig = () => {
        switch (type) {
            // Upload mode (manual GT)
            case 'resolved_fps': return { title: 'Resolved False Positives', color: '#52c41a', desc: `${baselineName} hallucinated this, but ${challengerName} successfully ignored it.` };
            case 'resolved_fns': return { title: 'Resolved Misses (FN)', color: '#52c41a', desc: `${baselineName} missed this, but ${challengerName} successfully detected it.` };
            case 'regressions': return { title: 'New Regressions (Broken)', color: '#f5222d', desc: `${baselineName} detected this correctly, but ${challengerName} missed it.` };
            case 'persistent_fps': return { title: 'Persistent False Positives', color: '#faad14', desc: `Both models hallucinate an object here.` };
            case 'persistent_fns': return { title: 'Persistent Misses', color: '#faad14', desc: `Both models failed to detect this object.` };

            // Split mode (auto GT)
            case 'fixed_fp': return { title: 'False Positives Fixed', color: '#52c41a', desc: `${challengerName} reduced wrong detections on these images — fewer false alarms.` };
            case 'fixed_fn': return { title: 'Missed Objects Fixed', color: '#52c41a', desc: `${challengerName} found more real objects that were previously missed.` };
            case 'new_fp': return { title: 'New False Positives', color: '#f5222d', desc: `${challengerName} created extra wrong detections on these images — false alarms added.` };
            case 'new_fn': return { title: 'New Missed Objects', color: '#f5222d', desc: `${challengerName} missed real objects — detections lost.` };

            default: return { title: 'Delta Viewer', color: '#1890ff', desc: '' };
        }
    };

    const config = getTypeConfig();

    return (
        <Modal
            open={visible}
            onCancel={onCancel}
            footer={null}
            closeIcon={<CloseOutlined style={{ color: 'white', fontSize: 20 }} />}
            width="90vw"
            style={{ top: 20 }}
            className="delta-gallery-modal"
            destroyOnClose
        >
            <div className="delta-gallery-header">
                <div>
                    <Title level={4} style={{ color: 'white', margin: 0 }}>
                        <SplitCellsOutlined style={{ marginRight: 8, color: config.color }} />
                        {config.title} ({currentIndex + 1} / {items.length})
                    </Title>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>{config.desc}</Text>
                </div>
                <Space>
                    <Tag color="blue">{currentItem.class_name}</Tag>
                    <Text style={{ color: 'white' }}>{currentItem.image_name}</Text>
                </Space>
            </div>

            <div className="delta-gallery-body" ref={containerRef}>
                <div className="delta-navigation left" onClick={handlePrev}><LeftOutlined /></div>

                <div className="delta-image-container">
                    <img
                        src={imageUrl}
                        alt="Delta Visual"
                        onLoad={handleImageLoad}
                        style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                    />

                    {/* SVG Overlay for Bounding Boxes */}
                    {imageDim.width > 0 && (
                        <svg
                            className="delta-svg-overlay"
                            viewBox={`0 0 ${imageDim.width} ${imageDim.height}`}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            {/* 1. Upload Mode (Legacy single box) */}
                            {currentItem.bbox && (
                                <g className="baseline-group">
                                    <rect
                                        x={currentItem.bbox[0]} y={currentItem.bbox[1]}
                                        width={currentItem.bbox[2] - currentItem.bbox[0]} height={currentItem.bbox[3] - currentItem.bbox[1]}
                                        fill="none" stroke={type.includes('resolved') ? '#ff4d4f' : '#1890ff'} strokeWidth="3" strokeDasharray="8,4"
                                    />
                                    <text
                                        x={currentItem.bbox[0]} y={currentItem.bbox[1] - 5}
                                        fill={type.includes('resolved') ? '#ff4d4f' : '#1890ff'} fontSize="14" fontWeight="bold" style={{ textShadow: '1px 1px 2px black' }}
                                    >
                                        Baseline: {currentItem.baseline_status?.toUpperCase()}
                                    </text>
                                </g>
                            )}

                            {currentItem.challenger_match && currentItem.challenger_match.bbox && (
                                <g className="challenger-group">
                                    <rect
                                        x={currentItem.challenger_match.bbox[0]} y={currentItem.challenger_match.bbox[1]}
                                        width={currentItem.challenger_match.bbox[2] - currentItem.challenger_match.bbox[0]} height={currentItem.challenger_match.bbox[3] - currentItem.challenger_match.bbox[1]}
                                        fill="rgba(82, 196, 26, 0.2)" stroke="#52c41a" strokeWidth="3"
                                    />
                                    <text
                                        x={currentItem.challenger_match.bbox[0]} y={currentItem.challenger_match.bbox[1] - 5}
                                        fill="#52c41a" fontSize="14" fontWeight="bold" style={{ textShadow: '1px 1px 2px black' }}
                                    >
                                        Challenger: {(currentItem.challenger_match.confidence * 100).toFixed(1)}%
                                    </text>
                                </g>
                            )}

                            {/* 2. Split Mode (Multiple boxes per image) */}
                            {['fixed_fp', 'new_fp'].includes(type) && currentItem.a_fp_list?.map((d, i) => d.bbox && (
                                <g key={`a-fp-${i}`} className="baseline-group">
                                    <rect x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2] - d.bbox[0]} height={d.bbox[3] - d.bbox[1]} fill="none" stroke="#ff4d4f" strokeWidth="3" strokeDasharray="8,4" />
                                    <text x={d.bbox[0]} y={d.bbox[1] - 5} fill="#ff4d4f" fontSize="14" fontWeight="bold" style={{ textShadow: '1px 1px 2px black' }}>Baseline FP</text>
                                </g>
                            ))}
                            {['fixed_fp', 'new_fp'].includes(type) && currentItem.b_fp_list?.map((d, i) => d.bbox && (
                                <g key={`b-fp-${i}`} className="challenger-group">
                                    <rect x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2] - d.bbox[0]} height={d.bbox[3] - d.bbox[1]} fill="rgba(250, 173, 20, 0.2)" stroke="#faad14" strokeWidth="3" />
                                    <text x={d.bbox[0]} y={d.bbox[1] - 5} fill="#faad14" fontSize="14" fontWeight="bold" style={{ textShadow: '1px 1px 2px black' }}>Challenger FP</text>
                                </g>
                            ))}

                            {['fixed_fn', 'new_fn'].includes(type) && currentItem.a_fn_list?.map((d, i) => d.bbox && (
                                <g key={`a-fn-${i}`} className="baseline-group">
                                    <rect x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2] - d.bbox[0]} height={d.bbox[3] - d.bbox[1]} fill="none" stroke="#1890ff" strokeWidth="3" strokeDasharray="8,4" />
                                    <text x={d.bbox[0]} y={d.bbox[1] - 5} fill="#1890ff" fontSize="14" fontWeight="bold" style={{ textShadow: '1px 1px 2px black' }}>Baseline Missed</text>
                                </g>
                            ))}
                            {['fixed_fn', 'new_fn'].includes(type) && currentItem.b_fn_list?.map((d, i) => d.bbox && (
                                <g key={`b-fn-${i}`} className="challenger-group">
                                    <rect x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2] - d.bbox[0]} height={d.bbox[3] - d.bbox[1]} fill="rgba(82, 196, 26, 0.2)" stroke="#52c41a" strokeWidth="3" />
                                    <text x={d.bbox[0]} y={d.bbox[1] - 5} fill="#52c41a" fontSize="14" fontWeight="bold" style={{ textShadow: '1px 1px 2px black' }}>Challenger Missed</text>
                                </g>
                            ))}
                        </svg>
                    )}
                </div>

                <div className="delta-navigation right" onClick={handleNext}><RightOutlined /></div>
            </div>

            <div className="delta-gallery-footer">
                <div className="legend">
                    <div className="legend-item">
                        <span className="legend-color" style={{ border: '2px dashed #ff4d4f' }}></span>
                        <Text style={{ color: 'white' }}>Baseline Box (Manual Review)</Text>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ border: '2px solid #52c41a', background: 'rgba(82,196,26,0.2)' }}></span>
                        <Text style={{ color: 'white' }}>Challenger Box (New Prediction)</Text>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DeltaGalleryModal;
