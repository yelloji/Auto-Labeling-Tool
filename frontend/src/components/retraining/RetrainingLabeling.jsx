import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, Typography, Spin, Tag, Empty, message } from 'antd';
import {
    CheckCircleOutlined, TagsOutlined,
    ArrowRightOutlined, ArrowLeftOutlined, PictureOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const API_BASE = '/api/v1';

const RetrainingLabeling = ({ projectId, onNext, onBack, hideNav }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('new');
    const [newDatasets, setNewDatasets] = useState([]);   // unassigned + annotating
    const [oldDatasets, setOldDatasets] = useState([]);   // dataset stage (already labeled)
    const [datasetImages, setDatasetImages] = useState({}); // { datasetId: [images] }
    const [loadingDatasets, setLoadingDatasets] = useState(true);
    const [loadingImages, setLoadingImages] = useState({});  // { datasetId: bool }

    // Load all datasets then fetch images for each
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

            // Fetch images for all datasets in parallel
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

    // Open manual labeling for the dataset this image belongs to
    const openLabeling = (datasetId) => {
        navigate(`/annotate/${datasetId}/manual`);
    };

    // All new images labeled → unlock Next
    const allNewImages = newDatasets.flatMap(d => datasetImages[d.id] || []);
    const allNewLabeled = allNewImages.length > 0 && allNewImages.every(img => img.is_labeled);

    const renderImageGrid = (datasets, isNew) => {
        if (loadingDatasets) {
            return <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>;
        }

        const allImages = datasets.flatMap(ds => {
            const imgs = datasetImages[ds.id] || [];
            return imgs.map(img => ({ ...img, _datasetId: ds.id, _datasetName: ds.name }));
        });

        if (allImages.length === 0 && !Object.values(loadingImages).some(Boolean)) {
            return (
                <Empty
                    description={
                        <span style={{ color: '#888' }}>
                            {isNew
                                ? 'No new images. Go back to Upload to add images.'
                                : 'No existing labeled images found.'}
                        </span>
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            );
        }

        // Group by dataset
        return datasets.map(ds => {
            const imgs = datasetImages[ds.id] || [];
            const isLoading = loadingImages[ds.id];
            const labeled = imgs.filter(i => i.is_labeled).length;
            const total = imgs.length;
            const allDone = total > 0 && labeled >= total;

            return (
                <div key={ds.id} style={{ marginBottom: '1.5rem' }}>
                    {/* Dataset header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        marginBottom: '0.6rem',
                        paddingBottom: '0.4rem',
                        borderBottom: '1px solid #e8e8e8',
                    }}>
                        <Text strong style={{ fontSize: '0.88rem' }}>{ds.name}</Text>
                        <Tag
                            style={{ fontSize: '0.68rem' }}
                            color={allDone ? 'green' : isNew ? 'purple' : 'default'}
                        >
                            {labeled} / {total} labeled
                        </Tag>
                        {ds.split_type && (
                            <Tag
                                style={{ fontSize: '0.65rem' }}
                                color={ds.split_type === 'dataset' ? 'green' : ds.split_type === 'annotating' ? 'blue' : 'default'}
                            >
                                {ds.split_type}
                            </Tag>
                        )}
                        {isNew && !allDone && (
                            <Button
                                size="small"
                                icon={<TagsOutlined />}
                                onClick={() => openLabeling(ds.id)}
                                style={{
                                    marginLeft: 'auto',
                                    background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                                    border: 'none', color: '#fff', borderRadius: 6,
                                    fontSize: '0.72rem',
                                }}
                            >
                                Label Batch
                            </Button>
                        )}
                    </div>

                    {/* Image grid */}
                    {isLoading ? (
                        <div style={{ padding: '1rem', textAlign: 'center' }}><Spin size="small" /></div>
                    ) : imgs.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: '0.78rem' }}>No images in this batch.</Text>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                            gap: '0.5rem',
                        }}>
                            {imgs.map(img => (
                                <div
                                    key={img.id}
                                    onClick={() => isNew && openLabeling(ds.id)}
                                    title={img.filename}
                                    style={{
                                        position: 'relative',
                                        borderRadius: 6,
                                        overflow: 'hidden',
                                        border: img.is_labeled
                                            ? '2px solid #4ade80'
                                            : '2px solid #e0e0e0',
                                        cursor: isNew ? 'pointer' : 'default',
                                        background: '#f5f5f5',
                                        aspectRatio: '1',
                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                        if (isNew) {
                                            e.currentTarget.style.transform = 'scale(1.04)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.3)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {img.thumbnail_url ? (
                                        <img
                                            src={img.thumbnail_url}
                                            alt={img.filename}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <PictureOutlined style={{ color: '#ccc', fontSize: '1.4rem' }} />
                                        </div>
                                    )}

                                    {/* Labeled badge */}
                                    {img.is_labeled && (
                                        <div style={{
                                            position: 'absolute', top: 3, right: 3,
                                            background: '#16a34a',
                                            borderRadius: '50%',
                                            width: 16, height: 16,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <CheckCircleOutlined style={{ color: '#fff', fontSize: '0.6rem' }} />
                                        </div>
                                    )}

                                    {/* Hover overlay for new unlabeled images */}
                                    {isNew && !img.is_labeled && (
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'rgba(124,58,237,0.12)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            opacity: 0,
                                            transition: 'opacity 0.15s',
                                        }}
                                            className="img-hover-overlay"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        });
    };

    const totalNew = newDatasets.reduce((s, d) => s + (datasetImages[d.id]?.length || 0), 0);
    const totalOld = oldDatasets.reduce((s, d) => s + (datasetImages[d.id]?.length || 0), 0);
    const labeledNew = newDatasets.reduce((s, d) => s + (datasetImages[d.id]?.filter(i => i.is_labeled).length || 0), 0);

    const tabItems = [
        {
            key: 'new',
            label: (
                <span>
                    New Images
                    <Tag style={{ marginLeft: 6, fontSize: '0.7rem' }} color="purple">{totalNew}</Tag>
                </span>
            ),
            children: (
                <div>
                    <Text type="secondary" style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.75rem' }}>
                        Newly uploaded images — click any image to open manual labeling for that batch.
                        {totalNew > 0 && (
                            <span style={{ marginLeft: 8, color: allNewLabeled ? '#16a34a' : '#d97706', fontWeight: 600 }}>
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
                <span>
                    Old Images
                    <Tag style={{ marginLeft: 6, fontSize: '0.7rem' }} color="green">{totalOld}</Tag>
                </span>
            ),
            children: (
                <div>
                    <Text type="secondary" style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.75rem' }}>
                        Images already labeled from previous sessions — included automatically in the next release.
                    </Text>
                    {renderImageGrid(oldDatasets, false)}
                </div>
            ),
        },
    ];

    return (
        <div>
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
            />

            {/* Navigation */}
            {!hideNav && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: '1.5rem', borderTop: '1px solid #e8e8e8', paddingTop: '1rem',
                }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                        Back: Upload
                    </Button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {allNewImages.length > 0 && !allNewLabeled && (
                            <Text style={{ color: '#d97706', fontSize: '0.8rem' }}>
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
                                border: 'none', borderRadius: 8,
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
