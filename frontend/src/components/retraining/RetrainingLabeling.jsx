import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, Typography, Spin, Tag, Empty, message } from 'antd';
import {
    PictureOutlined, CheckCircleOutlined, TagsOutlined,
    ArrowRightOutlined, ArrowLeftOutlined, EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const API_BASE = '/api/v1';

const RetrainingLabeling = ({ projectId, onNext, onBack }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('new');
    const [newImages, setNewImages] = useState([]);   // unassigned + annotating datasets/images
    const [oldImages, setOldImages] = useState([]);   // dataset images (already split)
    const [loading, setLoading] = useState(true);

    const loadImages = useCallback(async () => {
        setLoading(true);
        try {
            // Load all datasets for this project
            const res = await fetch(`${API_BASE}/projects/${projectId}/datasets?limit=200`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const datasets = Array.isArray(data) ? data : (data.datasets || data.items || []);

            // New = unassigned or annotating stage (not yet in dataset split)
            const newDs = datasets.filter(d => d.stage === 'unassigned' || d.stage === 'annotating');
            // Old = dataset stage (already labeled and split)
            const oldDs = datasets.filter(d => d.stage === 'dataset');

            setNewImages(newDs);
            setOldImages(oldDs);
        } catch {
            message.error('Failed to load images');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { loadImages(); }, [loadImages]);

    const totalNew = newImages.reduce((sum, d) => sum + (d.image_count || d.total_images || 0), 0);
    const labeledNew = newImages.reduce((sum, d) => sum + (d.labeled_count || d.annotated_count || 0), 0);
    const totalOld = oldImages.reduce((sum, d) => sum + (d.image_count || d.total_images || 0), 0);

    const openLabeling = (dataset) => {
        // Navigate to existing annotation progress page
        navigate(`/annotate-progress/${dataset.id}`);
    };

    const renderDatasetCard = (dataset, isNew) => {
        const total = dataset.image_count || dataset.total_images || 0;
        const labeled = dataset.labeled_count || dataset.annotated_count || 0;
        const allLabeled = total > 0 && labeled >= total;

        return (
            <div
                key={dataset.id}
                style={{
                    background: '#fff',
                    border: `1px solid ${allLabeled ? '#86efac' : '#e8e8e8'}`,
                    borderRadius: 8,
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.6rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
            >
                <PictureOutlined style={{ color: allLabeled ? '#22c55e' : '#7c3aed', fontSize: '1.2rem', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: '0.88rem', display: 'block' }}>
                        {dataset.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '0.76rem' }}>
                        {labeled} / {total} labeled
                        {dataset.stage && (
                            <Tag
                                style={{ marginLeft: 8, fontSize: '0.68rem' }}
                                color={dataset.stage === 'dataset' ? 'green' : dataset.stage === 'annotating' ? 'blue' : 'default'}
                            >
                                {dataset.stage}
                            </Tag>
                        )}
                    </Text>
                </div>

                {allLabeled ? (
                    <CheckCircleOutlined style={{ color: '#4ade80', fontSize: '1.1rem' }} />
                ) : isNew ? (
                    <Button
                        size="small"
                        icon={<TagsOutlined />}
                        onClick={() => openLabeling(dataset)}
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                            border: 'none', color: '#fff', borderRadius: 6,
                            fontSize: '0.75rem',
                        }}
                    >
                        Label
                    </Button>
                ) : (
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => openLabeling(dataset)}
                        style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#fff', borderRadius: 6,
                            fontSize: '0.75rem',
                        }}
                    >
                        View
                    </Button>
                )}
            </div>
        );
    };

    const allNewLabeled = newImages.length > 0 && newImages.every(d => {
        const total = d.image_count || d.total_images || 0;
        const labeled = d.labeled_count || d.annotated_count || 0;
        return total > 0 && labeled >= total;
    });

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
                    <Text type="secondary" style={{ fontSize: '0.82rem', display: 'block', marginBottom: '1rem' }}>
                        Newly uploaded images that need to be labeled before adding to the dataset.
                    </Text>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                    ) : newImages.length === 0 ? (
                        <Empty
                            description={<span style={{ color: 'rgba(255,255,255,0.35)' }}>No new images. Go back to Upload to add images.</span>}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    ) : (
                        newImages.map(d => renderDatasetCard(d, true))
                    )}
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
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', display: 'block', marginBottom: '1rem' }}>
                        Images already labeled and added to the dataset in previous sessions.
                    </Text>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                    ) : oldImages.length === 0 ? (
                        <Empty
                            description={<span style={{ color: 'rgba(255,255,255,0.35)' }}>No existing dataset images found.</span>}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    ) : (
                        oldImages.map(d => renderDatasetCard(d, false))
                    )}
                </div>
            ),
        },
    ];

    return (
        <div>
            <Text type="secondary" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '1rem' }}>
                Label all new images before proceeding. Old images are already labeled and will be included automatically.
            </Text>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                style={{ color: '#fff' }}
            />

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={onBack}
                >
                    Back: Upload
                </Button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {newImages.length > 0 && !allNewLabeled && (
                        <Text style={{ color: 'rgba(255,199,0,0.85)', fontSize: '0.8rem' }}>
                            Label all new images before continuing
                        </Text>
                    )}
                    <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        disabled={newImages.length > 0 && !allNewLabeled}
                        onClick={onNext}
                        style={{
                            background: (newImages.length === 0 || allNewLabeled)
                                ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                                : undefined,
                            border: 'none', borderRadius: 8,
                        }}
                    >
                        Next: Create Release
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RetrainingLabeling;
