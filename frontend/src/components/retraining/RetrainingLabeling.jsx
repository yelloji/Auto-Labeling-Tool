import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, Typography, Spin, Tag, Empty, message, Progress, Tooltip } from 'antd';
import {
    CheckCircleOutlined,
    TagsOutlined,
    ArrowRightOutlined,
    ArrowLeftOutlined,
    PictureOutlined,
    FolderOpenOutlined,
    FileImageOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const API_BASE = '/api/v1';

const getClassColor = (classId) => {
    const colors = [
        '#ff4d4f', '#1890ff', '#52c41a', '#faad14', '#722ed1',
        '#eb2f96', '#13c2c2', '#fa541c', '#a0d911', '#2f54eb'
    ];
    return colors[Math.abs(Number(classId) || 0) % colors.length];
};

const parseSegmentationPoints = (segmentation) => {
    let points = segmentation;
    if (!points) return '';

    if (typeof points === 'string') {
        try {
            points = JSON.parse(points);
        } catch {
            return '';
        }
    }

    if (!Array.isArray(points) || points.length === 0) return '';

    if (typeof points[0] === 'object' && points[0]?.x !== undefined) {
        return points.map(point => `${point.x},${point.y}`).join(' ');
    }

    if (Array.isArray(points[0])) {
        return points[0].reduce((acc, value, index) => (
            index % 2 === 0 ? `${acc}${value},` : `${acc}${value} `
        ), '').trim();
    }

    if (typeof points[0] === 'number') {
        return points.reduce((acc, value, index) => (
            index % 2 === 0 ? `${acc}${value},` : `${acc}${value} `
        ), '').trim();
    }

    return '';
};

const AnnotationOverlay = ({ image, annotations }) => {
    if (!annotations?.length || !image?.width || !image?.height) return null;

    return (
        <svg
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
            }}
            viewBox={`0 0 ${image.width} ${image.height}`}
            preserveAspectRatio="xMidYMid meet"
        >
            {annotations.map((annotation, index) => {
                const color = getClassColor(annotation.class_id || index);
                const pointsString = parseSegmentationPoints(annotation.segmentation);

                if (pointsString) {
                    return (
                        <g key={`polygon-${annotation.id || index}`}>
                            <polygon
                                points={pointsString}
                                fill={`${color}30`}
                                stroke={color}
                                strokeWidth={Math.max(2, image.width * 0.002)}
                            />
                        </g>
                    );
                }

                if (
                    annotation.x_min !== undefined &&
                    annotation.y_min !== undefined &&
                    annotation.x_max !== undefined &&
                    annotation.y_max !== undefined
                ) {
                    const x = annotation.x_min * image.width;
                    const y = annotation.y_min * image.height;
                    const width = (annotation.x_max - annotation.x_min) * image.width;
                    const height = (annotation.y_max - annotation.y_min) * image.height;

                    return (
                        <g key={`box-${annotation.id || index}`}>
                            <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                fill={`${color}26`}
                                stroke={color}
                                strokeWidth={Math.max(2, image.width * 0.002)}
                            />
                        </g>
                    );
                }

                if (
                    annotation.x !== undefined &&
                    annotation.y !== undefined &&
                    annotation.width !== undefined &&
                    annotation.height !== undefined
                ) {
                    return (
                        <rect
                            key={`legacy-box-${annotation.id || index}`}
                            x={annotation.x}
                            y={annotation.y}
                            width={annotation.width}
                            height={annotation.height}
                            fill={`${color}26`}
                            stroke={color}
                            strokeWidth={Math.max(2, image.width * 0.002)}
                        />
                    );
                }

                return null;
            })}
        </svg>
    );
};

const RetrainingImageCard = ({ img, isNew, openLabeling, datasetId }) => {
    const [annotations, setAnnotations] = useState([]);

    useEffect(() => {
        let cancelled = false;

        const loadAnnotations = async () => {
            if (!img?.id || !img?.is_labeled) {
                setAnnotations([]);
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/images/${img.id}/annotations`);
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled) setAnnotations(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setAnnotations([]);
            }
        };

        loadAnnotations();

        return () => {
            cancelled = true;
        };
    }, [img?.id, img?.is_labeled]);

    const displayName = img.original_filename || img.filename || `Image ${img.id}`;
    const imageUrl = img.thumbnail_url || img.url;
    const statusColor = img.is_labeled ? '#10b981' : '#f59e0b';
    const statusText = img.is_labeled ? 'Labeled' : 'Unlabeled';
    const dimensions = img.width && img.height ? `${img.width} x ${img.height}` : 'Size not available';

    return (
        <div
            onClick={() => isNew && openLabeling(datasetId)}
            title={displayName}
            style={{
                background: '#fff',
                border: `1px solid ${img.is_labeled ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.3)'}`,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: isNew ? 'pointer' : 'default',
                boxShadow: '0 6px 16px rgba(15,23,42,0.06)',
                transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
                if (isNew) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(124,58,237,0.18)';
                    e.currentTarget.style.borderColor = img.is_labeled ? '#10b981' : '#7c3aed';
                }
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.06)';
                e.currentTarget.style.borderColor = img.is_labeled ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.3)';
            }}
        >
            <div style={{
                height: 190,
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
            }}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={displayName}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                ) : (
                    <PictureOutlined style={{ color: '#cbd5e1', fontSize: '2rem' }} />
                )}

                <AnnotationOverlay image={img} annotations={annotations} />

            </div>

            <div style={{ padding: '0.85rem 0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <Tooltip title={displayName}>
                        <Text strong style={{
                            color: '#0f172a',
                            fontSize: '0.9rem',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            minWidth: 0,
                        }}>
                            {displayName}
                        </Text>
                    </Tooltip>
                    <Tag
                        color={img.is_labeled ? 'success' : 'warning'}
                        style={{ margin: 0, border: 'none', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}
                    >
                        {statusText}
                    </Tag>
                </div>
                <Text style={{ color: '#64748b', fontSize: '0.82rem' }}>
                    <FileImageOutlined style={{ marginRight: 5 }} />
                    {dimensions}
                </Text>
            </div>
        </div>
    );
};

const RetrainingLabeling = ({ projectId, onNext, onBack, hideNav }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('new');
    const [newDatasets, setNewDatasets] = useState([]);
    const [oldDatasets, setOldDatasets] = useState([]);
    const [datasetImages, setDatasetImages] = useState({});
    const [loadingDatasets, setLoadingDatasets] = useState(true);
    const [loadingImages, setLoadingImages] = useState({});

    const loadAll = useCallback(async () => {
        setLoadingDatasets(true);
        try {
            const res = await fetch(`${API_BASE}/projects/${projectId}/datasets?limit=200`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const datasets = Array.isArray(data) ? data : (data.datasets || data.items || []);

            const newDs = datasets.filter(d => d.upload_source === 'user_retraining');
            const oldDs = datasets.filter(d => d.split_type === 'dataset');

            setNewDatasets(newDs);
            setOldDatasets(oldDs);

            const all = [...newDs, ...oldDs];
            const loadingMap = {};
            all.forEach(d => { loadingMap[d.id] = true; });
            setLoadingImages(loadingMap);

            await Promise.all(all.map(async (ds) => {
                try {
                    const r = await fetch(`${API_BASE}/datasets/${ds.id}/images?limit=200`);
                    if (!r.ok) return;
                    const imgs = await r.json();
                    const list = Array.isArray(imgs) ? imgs : (imgs.images || []);
                    setDatasetImages(prev => ({ ...prev, [ds.id]: list }));
                } catch {
                    setDatasetImages(prev => ({ ...prev, [ds.id]: [] }));
                } finally {
                    setLoadingImages(prev => ({ ...prev, [ds.id]: false }));
                }
            }));
        } catch {
            message.error('Failed to load images');
        } finally {
            setLoadingDatasets(false);
        }
    }, [projectId]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const openLabeling = (datasetId) => {
        navigate(`/annotate/${datasetId}/manual`);
    };

    const allNewImages = newDatasets.flatMap(d => datasetImages[d.id] || []);
    const allNewLabeled = allNewImages.length > 0 && allNewImages.every(img => img.is_labeled);

    const totalNew = newDatasets.reduce((s, d) => s + (datasetImages[d.id]?.length || 0), 0);
    const totalOld = oldDatasets.reduce((s, d) => s + (datasetImages[d.id]?.length || 0), 0);
    const labeledNew = newDatasets.reduce((s, d) => s + (datasetImages[d.id]?.filter(i => i.is_labeled).length || 0), 0);
    const labeledOld = oldDatasets.reduce((s, d) => s + (datasetImages[d.id]?.filter(i => i.is_labeled).length || 0), 0);
    const remainingNew = Math.max(totalNew - labeledNew, 0);

    const getDatasetStats = (ds) => {
        const imgs = datasetImages[ds.id] || [];
        const labeled = imgs.filter(i => i.is_labeled).length;
        const total = imgs.length;
        const percent = total > 0 ? Math.round((labeled / total) * 100) : 0;
        const allDone = total > 0 && labeled >= total;
        return { imgs, labeled, total, percent, allDone };
    };

    const renderStatCard = ({ title, value, detail, status, icon, accent }) => {
        const done = status === 'complete';
        return (
            <div style={{
                flex: 1,
                minWidth: 220,
                background: '#fff',
                border: `1px solid ${done ? 'rgba(16,185,129,0.24)' : 'rgba(245,158,11,0.26)'}`,
                borderLeft: `4px solid ${accent}`,
                borderRadius: 8,
                padding: '1rem 1.1rem',
                boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div>
                        <Text style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            {title}
                        </Text>
                        <div style={{ color: '#0f172a', fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
                            {value}
                        </div>
                        <Text style={{ color: done ? '#047857' : '#b45309', fontSize: '0.82rem', fontWeight: 600 }}>
                            {detail}
                        </Text>
                    </div>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: done ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.12)',
                        color: accent,
                        fontSize: '1.1rem',
                    }}>
                        {icon}
                    </div>
                </div>
            </div>
        );
    };

    const renderImageGrid = (datasets, isNew) => {
        if (loadingDatasets) {
            return <div style={{ textAlign: 'center', padding: '3rem' }}><Spin /></div>;
        }

        const allImages = datasets.flatMap(ds => {
            const imgs = datasetImages[ds.id] || [];
            return imgs.map(img => ({ ...img, _datasetId: ds.id, _datasetName: ds.name }));
        });

        if (allImages.length === 0 && !Object.values(loadingImages).some(Boolean)) {
            return (
                <div style={{
                    background: '#fff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: 8,
                    padding: '2.25rem',
                    boxShadow: '0 8px 22px rgba(15,23,42,0.04)',
                }}>
                    <Empty
                        description={
                            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>
                                {isNew
                                    ? 'No new images. Go back to Upload to add images.'
                                    : 'No existing labeled images found.'}
                            </span>
                        }
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            );
        }

        return datasets.map(ds => {
            const isLoading = loadingImages[ds.id];
            const { imgs, labeled, total, percent, allDone } = getDatasetStats(ds);
            const accent = allDone ? '#10b981' : isNew ? '#f59e0b' : '#6366f1';
            const softAccent = allDone ? 'rgba(16,185,129,0.08)' : isNew ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)';

            return (
                <div
                    key={ds.id}
                    style={{
                        marginBottom: '1rem',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderLeft: `5px solid ${accent}`,
                        borderRadius: 8,
                        padding: '1rem',
                        boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        marginBottom: '0.9rem',
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                <div style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    background: softAccent,
                                    color: accent,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <FolderOpenOutlined />
                                </div>
                                <Text strong style={{
                                    color: '#0f172a',
                                    fontSize: '0.96rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 520,
                                }}>
                                    {ds.name}
                                </Text>
                                <Tag
                                    color={allDone ? 'success' : isNew ? 'warning' : 'processing'}
                                    style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700 }}
                                >
                                    {labeled} / {total} labeled
                                </Tag>
                                {ds.split_type && (
                                    <Tag
                                        style={{ margin: 0, fontSize: '0.68rem' }}
                                        color={ds.split_type === 'dataset' ? 'green' : ds.split_type === 'annotating' ? 'blue' : 'default'}
                                    >
                                        {ds.split_type}
                                    </Tag>
                                )}
                            </div>
                            <div style={{ marginTop: '0.65rem', maxWidth: 620 }}>
                                <Progress
                                    percent={percent}
                                    size="small"
                                    strokeColor={allDone ? '#10b981' : isNew ? '#f59e0b' : '#6366f1'}
                                    trailColor="#e5e7eb"
                                    showInfo={false}
                                />
                            </div>
                        </div>

                        {isNew && !allDone && (
                            <Button
                                icon={<TagsOutlined />}
                                onClick={() => openLabeling(ds.id)}
                                style={{
                                    background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: 8,
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    height: 36,
                                    boxShadow: '0 8px 18px rgba(124,58,237,0.28)',
                                    flexShrink: 0,
                                }}
                            >
                                Label Batch
                            </Button>
                        )}
                    </div>

                    {isLoading ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center' }}><Spin size="small" /></div>
                    ) : imgs.length === 0 ? (
                        <div style={{
                            padding: '1rem',
                            borderRadius: 8,
                            background: '#f8fafc',
                            color: '#64748b',
                            fontSize: '0.82rem',
                        }}>
                            No images in this batch.
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: '1rem',
                        }}>
                            {imgs.map(img => (
                                <RetrainingImageCard
                                    key={img.id}
                                    img={img}
                                    isNew={isNew}
                                    openLabeling={openLabeling}
                                    datasetId={ds.id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        });
    };

    const tabItems = [
        {
            key: 'new',
            label: (
                <span style={{ fontWeight: 700 }}>
                    New Images
                    <Tag style={{ marginLeft: 6, fontSize: '0.7rem' }} color="purple">{totalNew}</Tag>
                </span>
            ),
            children: (
                <div style={{ paddingTop: '0.25rem' }}>
                    <Text style={{ color: '#64748b', fontSize: '0.86rem', display: 'block', marginBottom: '1rem' }}>
                        Newly uploaded images. Click any image or use Label Batch to open manual labeling for that batch.
                        {totalNew > 0 && (
                            <span style={{ marginLeft: 8, color: allNewLabeled ? '#047857' : '#b45309', fontWeight: 700 }}>
                                {labeledNew} / {totalNew} labeled
                            </span>
                        )}
                    </Text>
                    {renderImageGrid(newDatasets, true)}
                </div>
            ),
        },
        {
            key: 'old',
            label: (
                <span style={{ fontWeight: 700 }}>
                    Old Images
                    <Tag style={{ marginLeft: 6, fontSize: '0.7rem' }} color="green">{totalOld}</Tag>
                </span>
            ),
            children: (
                <div style={{ paddingTop: '0.25rem' }}>
                    <Text style={{ color: '#64748b', fontSize: '0.86rem', display: 'block', marginBottom: '1rem' }}>
                        Images already labeled from previous sessions. These stay available as reference project data.
                    </Text>
                    {renderImageGrid(oldDatasets, false)}
                </div>
            ),
        },
    ];

    return (
        <div style={{ background: '#f7f8fa', minHeight: '100%', padding: '1.4rem 2rem 1.25rem' }}>
            <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '1rem',
            }}>
                {renderStatCard({
                    title: 'New Images',
                    value: totalNew,
                    detail: totalNew === 0
                        ? 'Upload images to begin'
                        : allNewLabeled
                            ? 'Ready for release'
                            : `${remainingNew} still need labels`,
                    status: totalNew > 0 && allNewLabeled ? 'complete' : 'pending',
                    icon: allNewLabeled && totalNew > 0 ? <CheckCircleOutlined /> : <ClockCircleOutlined />,
                    accent: totalNew > 0 && allNewLabeled ? '#10b981' : '#f59e0b',
                })}
                {renderStatCard({
                    title: 'Old Images',
                    value: totalOld,
                    detail: totalOld > 0 ? `${labeledOld} labeled project images` : 'No previous dataset images',
                    status: 'complete',
                    icon: <FileImageOutlined />,
                    accent: '#10b981',
                })}
            </div>

            <div style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 12px 30px rgba(15,23,42,0.06)',
                padding: '0.25rem 1rem 1rem',
            }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                />
            </div>

            {!hideNav && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '1.5rem',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '1rem',
                }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                        Back: Upload
                    </Button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {allNewImages.length > 0 && !allNewLabeled && (
                            <Text style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: 600 }}>
                                Label all new images before continuing
                            </Text>
                        )}
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined />}
                            disabled={allNewImages.length > 0 && !allNewLabeled}
                            onClick={onNext}
                            style={{
                                background: (allNewImages.length === 0 || allNewLabeled)
                                    ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                                    : undefined,
                                border: 'none',
                                borderRadius: 8,
                                fontWeight: 700,
                            }}
                        >
                            Next: Create Release
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RetrainingLabeling;
