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
const IMAGE_PAGE_SIZE = 50;

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

const RetrainingImageCard = ({ img, isNew, openLabeling, datasetId, annotations: propAnnotations }) => {
    const annotations = Array.isArray(propAnnotations) ? propAnnotations : [];
    const [imageLoaded, setImageLoaded] = useState(false);

    useEffect(() => {
        setImageLoaded(false);
    }, [img?.id]);

    const displayName = img.original_filename || img.filename || `Image ${img.id}`;
    const imageUrl = img.thumbnail_url || img.url;
    const statusColor = img.is_labeled ? '#10b981' : '#f59e0b';
    const statusText = img.is_labeled ? 'Labeled' : 'Unlabeled';
    const dimensions = img.width && img.height ? `${img.width} x ${img.height}` : 'Size not available';

    return (
        <div
            onClick={() => isNew && openLabeling(datasetId, img.id)}
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
                        onLoad={() => setImageLoaded(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                ) : (
                    <PictureOutlined style={{ color: '#cbd5e1', fontSize: '2rem' }} />
                )}

                {imageLoaded && <AnnotationOverlay image={img} annotations={annotations} />}

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#64748b', fontSize: '0.82rem' }}>
                        <FileImageOutlined style={{ marginRight: 5 }} />
                        {dimensions}
                    </Text>
                    {img.split_type === 'dataset' && img.split_section && (
                        <Tag
                            style={{
                                margin: 0, border: 'none', fontWeight: 700, fontSize: '0.72rem',
                                background: img.split_section === 'train' ? 'rgba(124,58,237,0.12)' : img.split_section === 'val' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                                color: img.split_section === 'train' ? '#7c3aed' : img.split_section === 'val' ? '#3b82f6' : '#10b981',
                            }}
                        >
                            {img.split_section}
                        </Tag>
                    )}
                </div>
            </div>
        </div>
    );
};

const RetrainingLabeling = ({ projectId, onNext, onBack, hideNav, onReadyChange }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('new');
    const [activeNewDataset, setActiveNewDataset] = useState(null);
    const [activeOldDataset, setActiveOldDataset] = useState(null);
    const [newDatasets, setNewDatasets] = useState([]);
    const [oldDatasets, setOldDatasets] = useState([]);
    const [datasetImages, setDatasetImages] = useState({});
    const [datasetImageTotals, setDatasetImageTotals] = useState({});
    const [datasetPages, setDatasetPages] = useState({});
    const [loadingDatasets, setLoadingDatasets] = useState(true);
    const [loadingImages, setLoadingImages] = useState({});

    const loadDatasetImagesPage = useCallback(async (ds, page = 1) => {
        setLoadingImages(prev => ({ ...prev, [ds.id]: true }));
        try {
            const skip = (page - 1) * IMAGE_PAGE_SIZE;
            const r = await fetch(`${API_BASE}/datasets/${ds.id}/images?skip=${skip}&limit=${IMAGE_PAGE_SIZE}&include_annotations=true`);
            if (!r.ok) throw new Error();
            const data = await r.json();
            const list = Array.isArray(data) ? data : (data.images || []);
            const total = Array.isArray(data)
                ? (ds.total_images || list.length)
                : (data.total ?? data.total_images ?? ds.total_images ?? list.length);

            setDatasetImages(prev => ({ ...prev, [ds.id]: list }));
            setDatasetImageTotals(prev => ({ ...prev, [ds.id]: total }));
            setDatasetPages(prev => ({ ...prev, [ds.id]: page }));
        } catch {
            setDatasetImages(prev => ({ ...prev, [ds.id]: [] }));
            setDatasetImageTotals(prev => ({ ...prev, [ds.id]: ds.total_images || 0 }));
            setDatasetPages(prev => ({ ...prev, [ds.id]: page }));
        } finally {
            setLoadingImages(prev => ({ ...prev, [ds.id]: false }));
        }
    }, []);

    const fetchDatasets = useCallback(async () => {
        const res = await fetch(`${API_BASE}/projects/${projectId}/datasets`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        return Array.isArray(data) ? data : (data.datasets || data.items || []);
    }, [projectId]);

    const loadAll = useCallback(async () => {
        setLoadingDatasets(true);
        try {
            let datasets = await fetchDatasets();

            // Auto-split: trigger silently if all new images are labeled and still in annotating stage
            const newDsCheck = datasets.filter(d => d.upload_source === 'user_retraining');
            const shouldAutoSplit =
                newDsCheck.length > 0 &&
                newDsCheck.some(d => d.split_type !== 'dataset') &&
                newDsCheck.every(d => (d.total_images ?? 0) > 0 && (d.labeled_images ?? 0) >= (d.total_images ?? 0));

            if (shouldAutoSplit) {
                try {
                    const sr = await fetch(`${API_BASE}/retraining/${projectId}/auto-split`, { method: 'POST' });
                    if (sr.ok) {
                        const sd = await sr.json();
                        if (sd.split_done) {
                            // Re-fetch so split_type reflects the new 'dataset' stage
                            datasets = await fetchDatasets();
                        }
                    }
                } catch { /* non-critical — state will be refreshed on next load */ }
            }

            const newDs = datasets.filter(d => d.upload_source === 'user_retraining');
            const oldDs = datasets.filter(d => d.split_type === 'dataset');

            setNewDatasets(newDs);
            setOldDatasets(oldDs);
            setActiveNewDataset(prev => prev && newDs.find(d => d.id === prev) ? prev : (newDs[0]?.id ?? null));
            setActiveOldDataset(prev => prev && oldDs.find(d => d.id === prev) ? prev : (oldDs[0]?.id ?? null));

            const all = [...newDs, ...oldDs];
            const loadingMap = {};
            all.forEach(d => { loadingMap[d.id] = true; });
            setLoadingImages(loadingMap);
            setDatasetPages(prev => {
                const next = { ...prev };
                all.forEach(d => { if (!next[d.id]) next[d.id] = 1; });
                return next;
            });
            setDatasetImageTotals(prev => {
                const next = { ...prev };
                all.forEach(d => { next[d.id] = d.total_images || 0; });
                return next;
            });

            await Promise.all(all.map(ds => loadDatasetImagesPage(ds, 1)));
        } catch {
            message.error('Failed to load images');
        } finally {
            setLoadingDatasets(false);
        }
    }, [projectId, fetchDatasets, loadDatasetImagesPage]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const openLabeling = (datasetId, imageId = null) => {
        const url = imageId
            ? `/annotate/${datasetId}/manual?imageId=${imageId}`
            : `/annotate/${datasetId}/manual`;
        navigate(url, { state: { returnTo: `/retraining/${projectId}?step=1` } });
    };

    const totalNew = newDatasets.reduce((s, d) => s + (datasetImageTotals[d.id] ?? d.total_images ?? 0), 0);
    const totalOld = oldDatasets.reduce((s, d) => s + (datasetImageTotals[d.id] ?? d.total_images ?? 0), 0);
    const labeledNew = newDatasets.reduce((s, d) => s + (d.labeled_images ?? 0), 0);
    const labeledOld = oldDatasets.reduce((s, d) => s + (d.labeled_images ?? 0), 0);
    const allNewLabeled = totalNew > 0 && labeledNew >= totalNew;
    const allNewSplit = newDatasets.length > 0 && newDatasets.every(d => d.split_type === 'dataset');
    const nextReleaseReady = allNewLabeled && allNewSplit;
    const remainingNew = Math.max(totalNew - labeledNew, 0);

    useEffect(() => {
        if (onReadyChange) onReadyChange(nextReleaseReady);
    }, [nextReleaseReady, onReadyChange]);

    const getDatasetStats = (ds) => {
        const imgs = datasetImages[ds.id] || [];
        const labeled = ds.labeled_images ?? imgs.filter(i => i.is_labeled).length;
        const total = datasetImageTotals[ds.id] ?? ds.total_images ?? imgs.length;
        const percent = total > 0 ? Math.round((labeled / total) * 100) : 0;
        const allDone = total > 0 && labeled >= total;
        return { imgs, labeled, total, percent, allDone };
    };

    const renderStatCard = ({ title, value, detail, status, icon, accent, tabKey }) => {
        const done = status === 'complete';
        const isActive = activeTab === tabKey;
        return (
            <div
                onClick={() => setActiveTab(tabKey)}
                style={{
                    flex: 1,
                    minWidth: 220,
                    background: isActive
                        ? `linear-gradient(135deg, ${accent}12 0%, ${accent}06 100%)`
                        : '#fff',
                    border: `${isActive ? '2px' : '1px'} solid ${isActive ? accent : done ? 'rgba(16,185,129,0.24)' : 'rgba(245,158,11,0.26)'}`,
                    borderLeft: `5px solid ${accent}`,
                    borderRadius: 10,
                    padding: '1.1rem 1.2rem',
                    boxShadow: isActive
                        ? `0 12px 32px ${accent}40, 0 2px 8px ${accent}20`
                        : '0 8px 22px rgba(15,23,42,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.22s ease',
                    transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Active glow strip at bottom */}
                {isActive && (
                    <div style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: 3,
                        background: `linear-gradient(90deg, ${accent}, ${accent}80)`,
                        borderRadius: '0 0 10px 10px',
                    }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div>
                        <Text style={{
                            color: isActive ? accent : '#64748b',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {title}
                        </Text>
                        <div style={{
                            color: '#0f172a',
                            fontSize: '1.9rem',
                            fontWeight: 800,
                            lineHeight: 1.1,
                            marginTop: 4,
                        }}>
                            {value}
                        </div>
                        <Text style={{ color: done ? '#047857' : '#b45309', fontSize: '0.82rem', fontWeight: 600 }}>
                            {detail}
                        </Text>
                    </div>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isActive
                            ? `linear-gradient(135deg, ${accent}30, ${accent}15)`
                            : done ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.12)',
                        color: accent,
                        fontSize: '1.2rem',
                        boxShadow: isActive ? `0 4px 12px ${accent}30` : 'none',
                        transition: 'all 0.22s ease',
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
            const currentPage = datasetPages[ds.id] || 1;
            const totalPages = Math.max(1, Math.ceil(total / IMAGE_PAGE_SIZE));
            const startImage = total > 0 ? ((currentPage - 1) * IMAGE_PAGE_SIZE) + 1 : 0;
            const endImage = Math.min(currentPage * IMAGE_PAGE_SIZE, total);
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
                        <>
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
                                        annotations={img.annotations}
                                    />
                                ))}
                            </div>

                            {total > IMAGE_PAGE_SIZE && (
                                <div style={{
                                    marginTop: '1rem',
                                    paddingTop: '0.9rem',
                                    borderTop: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    flexWrap: 'wrap',
                                }}>
                                    <Text style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
                                        Showing {startImage}-{endImage} of {total} images
                                    </Text>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <Button
                                            size="small"
                                            disabled={currentPage <= 1 || isLoading}
                                            onClick={() => loadDatasetImagesPage(ds, currentPage - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <Text style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                                            Page {currentPage} of {totalPages}
                                        </Text>
                                        <Button
                                            size="small"
                                            disabled={currentPage >= totalPages || isLoading}
                                            onClick={() => loadDatasetImagesPage(ds, currentPage + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
        });
    };

    const renderDatasetSubTabs = (datasets, isNew, activeDs, setActiveDs) => {
        if (datasets.length <= 1) {
            return renderImageGrid(datasets, isNew);
        }
        const subItems = datasets.map(ds => {
            const { labeled, total, allDone } = getDatasetStats(ds);
            return {
                key: String(ds.id),
                label: (
                    <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                        {ds.name}
                        <Tag
                            style={{ marginLeft: 5, fontSize: '0.65rem' }}
                            color={allDone ? 'success' : isNew ? 'warning' : 'processing'}
                        >
                            {labeled}/{total}
                        </Tag>
                    </span>
                ),
                children: renderImageGrid([ds], isNew),
            };
        });
        return (
            <Tabs
                size="small"
                activeKey={String(activeDs || datasets[0]?.id)}
                onChange={setActiveDs}
                items={subItems}
                style={{ marginTop: '-0.25rem' }}
            />
        );
    };

    return (
        <div style={{ background: '#f7f8fa', minHeight: '100%', padding: '1.4rem 2rem 1.25rem' }}>
            <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '1.25rem',
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
                    tabKey: 'new',
                })}
                {renderStatCard({
                    title: 'Previous Training Images',
                    value: totalOld,
                    detail: totalOld > 0 ? `${labeledOld} labeled project images` : 'No previous dataset images',
                    status: 'complete',
                    icon: <FileImageOutlined />,
                    accent: '#10b981',
                    tabKey: 'old',
                })}
            </div>

            <div style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 12px 30px rgba(15,23,42,0.06)',
                padding: '1rem',
            }}>
                {activeTab === 'new' ? (
                    <div>
                        <Text style={{ color: '#64748b', fontSize: '0.86rem', display: 'block', marginBottom: '1rem' }}>
                            Newly uploaded images. Click any image or use Label Batch to open manual labeling.
                            {totalNew > 0 && (
                                <span style={{ marginLeft: 8, color: allNewLabeled ? '#047857' : '#b45309', fontWeight: 700 }}>
                                    {labeledNew} / {totalNew} labeled
                                </span>
                            )}
                        </Text>
                        {renderDatasetSubTabs(newDatasets, true, activeNewDataset, setActiveNewDataset)}
                    </div>
                ) : (
                    <div>
                        <Text style={{ color: '#64748b', fontSize: '0.86rem', display: 'block', marginBottom: '1rem' }}>
                            Images already labeled from previous sessions. Included automatically in the next release.
                        </Text>
                        {renderDatasetSubTabs(oldDatasets, false, activeOldDataset, setActiveOldDataset)}
                    </div>
                )}
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
                        {totalNew > 0 && !allNewLabeled && (
                            <Text style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: 600 }}>
                                Label all new images before continuing
                            </Text>
                        )}
                        {totalNew > 0 && allNewLabeled && !allNewSplit && (
                            <Text style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: 600 }}>
                                Preparing dataset split...
                            </Text>
                        )}
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined />}
                            disabled={totalNew > 0 && !nextReleaseReady}
                            onClick={onNext}
                            style={{
                                background: (totalNew === 0 || nextReleaseReady)
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
