import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Typography, Spin, Tag, message, Tooltip, Modal } from 'antd';
import {
    RocketOutlined, CheckCircleOutlined, DownloadOutlined,
    FileZipOutlined, SettingOutlined, ThunderboltOutlined,
    ClockCircleOutlined, EditOutlined, DeleteOutlined,
    ExclamationCircleOutlined, EyeOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import ReleaseDetailsView from '../project-workspace/ReleaseSection/ReleaseDetailsView';

const { Text } = Typography;
const API = '/api/v1';

const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';

const autoName = () => {
    const d = new Date();
    return `retraining-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TRANSFORM_LABELS = {
    resize: 'Resize',
    brightness: 'Brightness',
    contrast: 'Contrast',
    flip: 'Flip',
    gamma_correction: 'Gamma',
    rotate: 'Rotate',
    random_zoom: 'Zoom',
    tile: 'Tile',
    crop: 'Crop',
};

const panel = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    boxShadow: '0 12px 30px rgba(15,23,42,0.07)',
};

const statBox = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '0.85rem 0.95rem',
    minHeight: 80,
};

const chipStyle = (tone = 'slate') => {
    const colors = {
        purple: ['rgba(124,58,237,0.10)', 'rgba(124,58,237,0.24)', '#6d28d9'],
        blue: ['rgba(37,99,235,0.09)', 'rgba(37,99,235,0.22)', '#2563eb'],
        green: ['rgba(16,185,129,0.10)', 'rgba(16,185,129,0.24)', '#059669'],
        slate: ['#f8fafc', '#e2e8f0', '#475569'],
    };
    const [bg, border, color] = colors[tone] || colors.slate;
    return {
        background: bg,
        border: `1px solid ${border}`,
        color,
        borderRadius: 7,
        padding: '3px 9px',
        fontSize: '0.72rem',
        fontWeight: 800,
        lineHeight: 1.3,
    };
};

const formatParamValue = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'boolean') return value ? 'on' : 'off';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
    if (Array.isArray(value)) return value.join(', ');
    return String(value).replace(/_/g, ' ');
};

const getTransformationSummary = (transformation) => {
    const params = transformation?.params || {};
    const entries = Object.entries(params)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .slice(0, 3)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${formatParamValue(value)}`);
    return entries.join(' | ');
};


const ValueBox = ({ label, value, color = '#0f172a' }) => (
    <div style={statBox}>
        <Text style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
            {label}
        </Text>
        <div style={{ color, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 900, marginTop: 7 }}>
            {value ?? '-'}
        </div>
    </div>
);

const RetrainingRelease = ({ projectId, onReadyChange }) => {
    const [reference, setReference] = useState(null);
    const [releases, setReleases] = useState([]);
    const [datasetSummary, setDatasetSummary] = useState({ sourceImages: null, labeledImages: null });
    const [labels, setLabels] = useState([]);
    const [datasetStats, setDatasetStats] = useState(null);
    const [name, setName] = useState(autoName());
    const [creating, setCreating] = useState(false);
    const [loadingRef, setLoadingRef] = useState(true);
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [editingRelease, setEditingRelease] = useState(null);
    const [newName, setNewName] = useState('');
    const [renameSaving, setRenameSaving] = useState(false);

    const loadReference = useCallback(async () => {
        setLoadingRef(true);
        try {
            const r = await fetch(`${API}/retraining/${projectId}/reference`);
            if (r.ok) setReference(await r.json());
        } catch {
            /* reference card is non-blocking */
        } finally {
            setLoadingRef(false);
        }
    }, [projectId]);

    const loadReleases = useCallback(async () => {
        try {
            const r = await fetch(`${API}/projects/${projectId}/releases`);
            if (!r.ok) return;
            const all = await r.json();
            setReleases((all || []).filter(rel => rel.release_source === 'user_retraining'));
        } catch {
            /* release history is non-blocking */
        }
    }, [projectId]);

    const loadDatasetSummary = useCallback(async () => {
        try {
            const r = await fetch(`${API}/projects/${projectId}/datasets`);
            if (!r.ok) return;
            const payload = await r.json();
            const datasets = Array.isArray(payload) ? payload : (payload.datasets || []);
            const datasetStage = datasets.filter(ds => ds.split_type === 'dataset');
            setDatasetSummary({
                sourceImages: datasetStage.reduce((sum, ds) => sum + (ds.total_images || 0), 0),
                labeledImages: datasetStage.reduce((sum, ds) => sum + (ds.labeled_images || 0), 0),
            });
        } catch {
            /* dataset summary is non-blocking */
        }
    }, [projectId]);

    const loadLabels = useCallback(async () => {
        try {
            const r = await fetch(`${API}/projects/${projectId}/labels`);
            if (r.ok) {
                const data = await r.json();
                setLabels(Array.isArray(data) ? data : (data.labels || []));
            }
        } catch { /* non-blocking */ }
    }, [projectId]);

    const loadDatasetStats = useCallback(async () => {
        try {
            const r = await fetch(`${API}/retraining/${projectId}/dataset-stats`);
            if (r.ok) setDatasetStats(await r.json());
        } catch { /* non-blocking */ }
    }, [projectId]);

    useEffect(() => {
        loadReference(); loadReleases(); loadDatasetSummary(); loadLabels(); loadDatasetStats();
    }, [loadReference, loadReleases, loadDatasetSummary, loadLabels, loadDatasetStats]);

    useEffect(() => {
        if (onReadyChange) onReadyChange(releases.length > 0);
    }, [releases.length, onReadyChange]);

    const handleCreate = async () => {
        if (!name.trim()) { message.error('Please enter a release name'); return; }
        setCreating(true);
        try {
            const r1 = await fetch(`${API}/retraining/${projectId}/create-release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (!r1.ok) {
                const err = await r1.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to prepare release config');
            }
            const { release_payload } = await r1.json();

            const r2 = await fetch(`${API}/releases/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(release_payload),
            });
            if (!r2.ok) {
                const err = await r2.json().catch(() => ({}));
                throw new Error(err.detail || 'Release creation failed');
            }

            message.success('Release created successfully!');
            setName(autoName());
            await loadReleases();
        } catch (e) {
            message.error(e.message || 'Release creation failed');
        } finally {
            setCreating(false);
        }
    };

    const handleRename = (rel, e) => {
        e.stopPropagation();
        setEditingRelease(rel);
        setNewName(rel.name);
    };

    const handleSaveRename = async () => {
        if (!newName.trim()) return;
        setRenameSaving(true);
        try {
            const r = await fetch(`${API}/releases/${editingRelease.id}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (r.ok) {
                setReleases(prev => prev.map(x => x.id === editingRelease.id ? { ...x, name: newName.trim() } : x));
                message.success('Release renamed');
            } else {
                message.error('Failed to rename release');
            }
        } catch {
            message.error('Failed to rename release');
        } finally {
            setRenameSaving(false);
            setEditingRelease(null);
            setNewName('');
        }
    };

    const handleDelete = (rel, e) => {
        e.stopPropagation();
        Modal.confirm({
            title: 'Delete Release',
            icon: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />,
            content: `Delete "${rel.name}"? This cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const r = await fetch(`${API}/releases/${rel.id}`, { method: 'DELETE' });
                    if (r.ok) {
                        message.success('Release deleted');
                        await loadReleases();
                    } else {
                        message.error('Failed to delete release');
                    }
                } catch {
                    message.error('Failed to delete release');
                }
            },
        });
    };

    if (selectedRelease) {
        return (
            <ReleaseDetailsView
                release={selectedRelease}
                onBack={() => setSelectedRelease(null)}
                onDownload={() => {}}
                onRename={() => loadReleases()}
                onCreateNew={() => setSelectedRelease(null)}
                projectId={String(projectId)}
            />
        );
    }

    const releaseInfo = reference?.release_info || {};
    const transformations = releaseInfo.transformations || [];
    const multiplier = releaseInfo.multiplier ?? releaseInfo.images_per_original ?? 1;
    const activeRelease = releases[0] || null;
    const activeImageCount = activeRelease?.final_image_count ?? activeRelease?.image_count ?? activeRelease?.total_images;
    const previewOriginalCount = activeRelease?.original_image_count
        ?? activeRelease?.total_original_images
        ?? datasetSummary.sourceImages
        ?? releaseInfo.original_image_count
        ?? releaseInfo.source_image_count
        ?? releaseInfo.image_count
        ?? null;
    const previewFinalCount = activeImageCount
        ?? releaseInfo.final_image_count
        ?? releaseInfo.total_images
        ?? (previewOriginalCount != null ? previewOriginalCount * multiplier : null);
    const referenceTrainCount = releaseInfo.train_image_count ?? null;
    const referenceValCount = releaseInfo.val_image_count ?? null;
    const referenceTestCount = releaseInfo.test_image_count ?? null;
    const referenceSplitTotal = [referenceTrainCount, referenceValCount, referenceTestCount].reduce((sum, value) => sum + (value || 0), 0);
    const hasReferenceSplit = referenceSplitTotal > 0;
    const formatPercent = (count) => {
        if (!referenceSplitTotal || count == null) return null;
        return `${Math.round((count / referenceSplitTotal) * 100)}%`;
    };
    const hasRelease = releases.length > 0;
    const referenceRatios = hasReferenceSplit ? {
        train: (referenceTrainCount || 0) / referenceSplitTotal,
        val: (referenceValCount || 0) / referenceSplitTotal,
        test: (referenceTestCount || 0) / referenceSplitTotal,
    } : null;
    // Source split counts (actual from release ÷ multiplier, or estimated from reference ratios)
    const trainSrcEst = referenceRatios && previewOriginalCount != null ? Math.round(previewOriginalCount * referenceRatios.train) : null;
    const valSrcEst   = referenceRatios && previewOriginalCount != null ? Math.round(previewOriginalCount * referenceRatios.val)   : null;
    const trainSource = activeRelease?.train_image_count != null ? Math.round(activeRelease.train_image_count / multiplier) : trainSrcEst;
    const valSource   = activeRelease?.val_image_count   != null ? Math.round(activeRelease.val_image_count   / multiplier) : valSrcEst;
    const testSource  = activeRelease?.test_image_count  != null
        ? Math.round(activeRelease.test_image_count / multiplier)
        : (previewOriginalCount != null && trainSrcEst != null && valSrcEst != null
            ? Math.max(previewOriginalCount - trainSrcEst - valSrcEst, 0)
            : null);
    // Release split counts (actual or estimated)
    const trainRelease = activeRelease?.train_image_count ?? (trainSource != null ? Math.round(trainSource * multiplier) : null);
    const valRelease   = activeRelease?.val_image_count   ?? (valSource   != null ? Math.round(valSource   * multiplier) : null);
    const testRelease  = activeRelease?.test_image_count  ?? (testSource  != null ? Math.round(testSource  * multiplier) : null);

    return (
        <div style={{ padding: '1.4rem 1.75rem 6.5rem', width: '100%' }}>
            <div style={{
                background: 'linear-gradient(145deg, #10172a 0%, #1d1647 56%, #111827 100%)',
                borderRadius: 12,
                padding: '0.72rem 0.85rem',
                border: '1px solid rgba(124,58,237,0.28)',
                boxShadow: '0 18px 36px rgba(15,23,42,0.22)',
                marginBottom: '1rem',
                width: '100%',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
                    <SettingOutlined style={{ color: '#c4b5fd', fontSize: '0.88rem' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>
                        Reference Configuration
                    </Text>
                </div>

                {loadingRef ? (
                    <Spin size="small" />
                ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {/* Row 1 — 5 equal config cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.55rem', alignItems: 'stretch' }}>
                            {[
                                ['Format', releaseInfo.export_format || 'YOLO', '#ddd6fe'],
                                ['Task', releaseInfo.task_type || 'segmentation', '#bfdbfe'],
                                ['Output', releaseInfo.output_format || 'original', '#f9a8d4'],
                                ['Multiplier', `x${multiplier}`, '#86efac'],
                            ].map(([label, value, color]) => (
                                <div key={label} style={{
                                    background: 'rgba(255,255,255,0.055)',
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    borderRadius: 9,
                                    padding: '0.42rem 0.58rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.62rem', fontWeight: 800 }}>
                                        {label}
                                    </Text>
                                    <div style={{ color, fontWeight: 900, marginTop: 2, fontSize: '0.8rem', lineHeight: 1.2 }}>{value}</div>
                                </div>
                            ))}

                            <div style={{
                                background: 'rgba(255,255,255,0.055)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                borderRadius: 9,
                                padding: '0.42rem 0.58rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                            }}>
                                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.62rem', fontWeight: 800, display: 'block', marginBottom: 4 }}>
                                    Reference Split Ratio
                                </Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    {[
                                        ['Train', formatPercent(referenceTrainCount)],
                                        ['Val', formatPercent(referenceValCount)],
                                        ['Test', formatPercent(referenceTestCount)],
                                    ].map(([label, value]) => (
                                        <span key={label} style={{
                                            background: 'rgba(255,255,255,0.055)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 999,
                                            padding: '0.24rem 0.5rem',
                                        }}>
                                            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.58rem', fontWeight: 800 }}>
                                                {label}
                                            </Text>
                                            <Text style={{ color: '#fff', fontWeight: 900, fontSize: '0.72rem', marginLeft: 6 }}>
                                                {value || '-'}
                                            </Text>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Row 2 — 5 equal transformation cards */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '0.45rem',
                            alignItems: 'stretch',
                        }}>
                            {transformations.length === 0 ? (
                                <Text style={{ color: 'rgba(255,255,255,0.36)', fontSize: '0.74rem' }}>No transformations</Text>
                            ) : transformations.map((t, i) => (
                                <div key={`${t.type || 'transform'}-${i}`} style={{
                                    background: 'rgba(255,255,255,0.055)',
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    borderRadius: 8,
                                    padding: '0.38rem 0.48rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                }}>
                                    <Text style={{ color: '#fff', fontSize: '0.68rem', fontWeight: 800, display: 'block', lineHeight: 1.15 }}>
                                        {TRANSFORM_LABELS[t.type] || t.type}
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.62rem', lineHeight: 1.2 }}>
                                        {getTransformationSummary(t) || 'No extra parameters'}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.42fr) minmax(340px, 0.82fr)',
                gap: '1rem',
                alignItems: 'start',
                width: '100%',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                    <div style={{ ...panel, overflow: 'hidden', border: '1px solid #e2e8f0', borderTop: '3px solid #7c3aed', boxShadow: '0 4px 20px rgba(15,23,42,0.08)' }}>
                    {/* Header */}
                    <div style={{
                        padding: '1.15rem 1.25rem',
                        background: '#fff',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <EyeOutlined style={{ color: '#64748b', fontSize: '1rem' }} />
                            <Text strong style={{ color: '#0f172a', fontSize: '1.02rem' }}>Release Preview</Text>
                            <Text style={{ color: '#94a3b8', fontSize: '0.82rem' }}>— dataset package prepared for retraining</Text>
                        </div>
                        <Tag color={hasRelease ? 'success' : 'default'} style={{ margin: 0, borderRadius: 14, fontWeight: 700, fontSize: '0.78rem' }}>
                            {hasRelease ? 'Ready for training' : 'Ready to create'}
                        </Tag>
                    </div>

                    <div style={{ padding: '1.2rem 1.25rem 1.25rem' }}>
                        {/* Row 1: Source images */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
                            <div style={{ height: 1, width: 16, background: '#cbd5e1' }} />
                            <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source Images</Text>
                            <div style={{ height: 1, flex: 1, background: '#f1f5f9' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.6fr', gap: '0.65rem', marginBottom: '1.1rem' }}>
                            <div style={statBox}>
                                <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</Text>
                                <div style={{ color: '#0f172a', fontSize: '1.6rem', lineHeight: 1.1, fontWeight: 900, marginTop: 6 }}>{previewOriginalCount ?? '-'}</div>
                                {datasetStats?.total?.annotations != null && (
                                    <div style={{ fontSize: '0.69rem', color: '#94a3b8', fontWeight: 600, marginTop: 3 }}>
                                        {datasetStats.total.annotations} annotations
                                    </div>
                                )}
                            </div>
                            {[
                                ['Train', trainSource, formatPercent(referenceTrainCount), datasetStats?.train],
                                ['Val',   valSource,   formatPercent(referenceValCount),   datasetStats?.val],
                                ['Test',  testSource,  formatPercent(referenceTestCount),  datasetStats?.test],
                            ].map(([label, value, refPct, stats]) => (
                                <div key={label} style={statBox}>
                                    <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Text>
                                    <div style={{ color: '#0f172a', fontSize: '1.6rem', lineHeight: 1.1, fontWeight: 900, marginTop: 6 }}>{value ?? '-'}</div>
                                    {stats?.annotations != null && (
                                        <div style={{ fontSize: '0.69rem', color: '#94a3b8', fontWeight: 600, marginTop: 3 }}>
                                            {stats.annotations} annotations
                                        </div>
                                    )}
                                    {refPct && <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600, marginTop: 1 }}>split ratio {refPct}</div>}
                                </div>
                            ))}
                            {/* Classes box */}
                            <div style={statBox}>
                                <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Classes</Text>
                                <div style={{ color: '#0f172a', fontSize: '1.6rem', lineHeight: 1.1, fontWeight: 900, marginTop: 6 }}>{labels.length || '-'}</div>
                                {datasetStats?.per_class?.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                        {datasetStats.per_class.map(c => (
                                            <span key={c.class_name} style={{
                                                background: '#f1f5f9', border: '1px solid #e2e8f0',
                                                borderRadius: 5, padding: '1px 7px',
                                                fontSize: '0.65rem', fontWeight: 700, color: '#374151',
                                            }}>
                                                {c.class_name} ({c.annotations})
                                            </span>
                                        ))}
                                    </div>
                                ) : labels.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                        {labels.map(l => (
                                            <span key={l.id ?? l.name} style={{
                                                background: '#f1f5f9', border: '1px solid #e2e8f0',
                                                borderRadius: 5, padding: '1px 7px',
                                                fontSize: '0.65rem', fontWeight: 700, color: '#374151',
                                            }}>
                                                {l.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Release images after multiplier */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
                            <div style={{ height: 1, width: 16, background: '#cbd5e1' }} />
                            <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Release Images (after augmentation)</Text>
                            <div style={{ height: 1, flex: 1, background: '#f1f5f9' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.65rem', marginBottom: '1.1rem' }}>
                            <div style={statBox}>
                                <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Per Original</Text>
                                <div style={{ color: '#059669', fontSize: '1.6rem', lineHeight: 1.1, fontWeight: 900, marginTop: 6 }}>×{multiplier}</div>
                            </div>
                            {[
                                ['Train', trainRelease,      '#0f172a'],
                                ['Val',   valRelease,        '#0f172a'],
                                ['Test',  testRelease,       '#0f172a'],
                                ['Total', previewFinalCount, '#2563eb'],
                            ].map(([label, value, color]) => (
                                <div key={label} style={statBox}>
                                    <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Text>
                                    <div style={{ color, fontSize: '1.6rem', lineHeight: 1.1, fontWeight: 900, marginTop: 6 }}>{value ?? '-'}</div>
                                </div>
                            ))}
                        </div>

                        {/* Row 3: Config + Transformations */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
                            <div style={{ height: 1, width: 16, background: '#cbd5e1' }} />
                            <Text style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Configuration & Transformations</Text>
                            <div style={{ height: 1, flex: 1, background: '#f1f5f9' }} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: transformations.length ? '0.65rem' : 0 }}>
                            <span style={chipStyle('slate')}>{releaseInfo.task_type || 'segmentation'}</span>
                            <span style={chipStyle('slate')}>{releaseInfo.export_format || 'YOLO'}</span>
                            <span style={chipStyle('slate')}>{`output: ${releaseInfo.output_format || 'original'}`}</span>
                        </div>
                        {transformations.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.45rem', alignItems: 'stretch' }}>
                                {transformations.map((t, i) => (
                                    <div key={`${t.type}-${i}`} style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 8,
                                        padding: '0.4rem 0.65rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                    }}>
                                        <Text strong style={{ color: '#1e293b', fontSize: '0.78rem', display: 'block' }}>
                                            {TRANSFORM_LABELS[t.type] || t.type}
                                        </Text>
                                        {getTransformationSummary(t) && (
                                            <Text style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                                {getTransformationSummary(t)}
                                            </Text>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                    {hasRelease && (
                        <div style={{
                            padding: '0.95rem 1.05rem',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(240,253,250,0.96))',
                            border: '1px solid rgba(16,185,129,0.28)',
                            borderLeft: '5px solid #10b981',
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <CheckCircleOutlined style={{ color: '#10b981', fontSize: '1.15rem', flexShrink: 0 }} />
                                <div>
                                    <Text strong style={{ color: '#065f46', display: 'block' }}>Release ready</Text>
                                    <Text style={{ color: '#047857', fontSize: '0.84rem' }}>
                                        {previewOriginalCount != null && previewFinalCount != null
                                            ? `${previewOriginalCount} source images became ${previewFinalCount} release images. `
                                            : previewFinalCount ? `${previewFinalCount} images prepared. ` : ''}
                                        Continue to training from the bottom bar.
                                    </Text>
                                </div>
                            </div>
                            {activeRelease && (
                                <Button
                                    icon={<EyeOutlined />}
                                    onClick={() => setSelectedRelease(activeRelease)}
                                    style={{ borderRadius: 9, fontWeight: 800 }}
                                >
                                    Open Details
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                    {/* ── Create Release ── */}
                    {!hasRelease && (
                        <div style={{ ...panel, padding: '1.15rem 1.25rem', border: '1px solid #e2e8f0', borderTop: '3px solid #7c3aed' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                    <RocketOutlined style={{ color: '#7c3aed', fontSize: '1rem' }} />
                                    <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>Create Release</Text>
                                </div>
                                <Text style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>
                                    Name only — config copied from production reference.
                                </Text>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. retraining-2026-04-23"
                                    disabled={creating}
                                    size="large"
                                    onPressEnter={handleCreate}
                                    style={{ borderRadius: 9, flex: 1, fontSize: '0.94rem' }}
                                />
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<RocketOutlined />}
                                    loading={creating}
                                    onClick={handleCreate}
                                    disabled={!name.trim()}
                                    style={{
                                        background: name.trim() ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : undefined,
                                        border: 'none',
                                        borderRadius: 9,
                                        fontWeight: 800,
                                        minWidth: 170,
                                        boxShadow: name.trim() ? '0 9px 20px rgba(124,58,237,0.28)' : 'none',
                                        height: 40,
                                    }}
                                >
                                    {creating ? 'Creating…' : 'Create Release'}
                                </Button>
                            </div>
                            {creating && (
                                <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', background: 'rgba(124,58,237,0.06)', borderRadius: 9, border: '1px solid rgba(124,58,237,0.18)' }}>
                                    <ThunderboltOutlined style={{ color: '#7c3aed' }} />
                                    <Text style={{ color: '#5b21b6', fontSize: '0.84rem', fontWeight: 700 }}>Preparing dataset package and applying release settings…</Text>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Release History ── */}
                    <div style={{ ...panel, overflow: 'hidden', border: '1px solid #e2e8f0', borderTop: '3px solid #7c3aed' }}>
                        <div style={{
                            padding: '1rem 1.05rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                <FileZipOutlined style={{ color: '#7c3aed' }} />
                                <Text strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>Release History</Text>
                            </div>
                            <Tag color={releases.length > 0 ? 'purple' : 'default'} style={{ margin: 0, borderRadius: 14, fontWeight: 800 }}>
                                {releases.length}
                            </Tag>
                        </div>

                        {releases.length === 0 ? (
                            <div style={{ padding: '1.75rem 1.1rem', textAlign: 'center' }}>
                                <FileZipOutlined style={{ fontSize: '1.7rem', color: '#cbd5e1', marginBottom: '0.65rem', display: 'block' }} />
                                <Text style={{ color: '#64748b', fontSize: '0.84rem' }}>No release created yet</Text>
                            </div>
                        ) : (
                            <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {releases.map(rel => (
                                    <div
                                        key={rel.id}
                                        onClick={() => setSelectedRelease(rel)}
                                        style={{
                                            background: 'linear-gradient(135deg, #ffffff 0%, #f9f7ff 100%)',
                                            borderRadius: 10,
                                            border: '1px solid rgba(124,58,237,0.20)',
                                            borderLeft: '4px solid #7c3aed',
                                            padding: '0.8rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 14px rgba(124,58,237,0.08)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '0.72rem', alignItems: 'flex-start' }}>
                                            <div style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: 9,
                                                background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(37,99,235,0.10))',
                                                border: '1px solid rgba(124,58,237,0.25)',
                                                color: '#7c3aed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                fontSize: '1.05rem',
                                            }}>
                                                <FileZipOutlined />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <Text strong style={{
                                                    color: '#1e293b',
                                                    fontSize: '0.92rem',
                                                    display: 'block',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    letterSpacing: '-0.01em',
                                                }}>
                                                    {rel.name}
                                                </Text>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 3, flexWrap: 'wrap' }}>
                                                    <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: '0.72rem' }} />
                                                    <Text style={{ color: '#64748b', fontSize: '0.75rem' }}>{formatDate(rel.created_at)}</Text>
                                                    <span style={chipStyle('green')}>Ready</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.55rem',
                                            marginTop: '0.75rem',
                                        }}>
                                            <div>
                                                <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>
                                                    {rel.final_image_count ?? rel.image_count ?? '-'}
                                                </Text>
                                                <Text style={{ color: '#64748b', fontSize: '0.72rem', marginLeft: 4 }}>release imgs</Text>
                                                {rel.original_image_count != null && (
                                                    <Text style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>
                                                        from {rel.original_image_count} source imgs
                                                    </Text>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <Tooltip title="Open details">
                                                    <Button size="small" icon={<EyeOutlined />} style={{ borderRadius: 7 }} />
                                                </Tooltip>
                                                {rel.model_path && (
                                                    <Tooltip title="Download ZIP">
                                                        <Button
                                                            size="small"
                                                            icon={<DownloadOutlined />}
                                                            style={{ borderRadius: 7 }}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                window.open(`${API}/releases/${rel.id}/download`, '_blank');
                                                            }}
                                                        />
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Rename">
                                                    <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 7 }} onClick={e => handleRename(rel, e)} />
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 7 }} onClick={e => handleDelete(rel, e)} />
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '0.9rem 1rem',
                        display: 'flex',
                        gap: '0.7rem',
                        alignItems: 'flex-start',
                    }}>
                        <SafetyCertificateOutlined style={{ color: '#059669', marginTop: 2 }} />
                        <Text style={{ color: '#475569', fontSize: '0.8rem', lineHeight: 1.55 }}>
                            Retraining releases stay separate from Full Mode releases. Creating a new one replaces only the previous retraining package unless it is protected as production.
                        </Text>
                    </div>
                </div>
            </div>

            <Modal
                title="Rename Release"
                open={!!editingRelease}
                onOk={handleSaveRename}
                onCancel={() => { setEditingRelease(null); setNewName(''); }}
                okText="Save"
                cancelText="Cancel"
                confirmLoading={renameSaving}
            >
                <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Enter new release name"
                    onPressEnter={handleSaveRename}
                    style={{ marginTop: 8 }}
                />
            </Modal>
        </div>
    );
};

export default RetrainingRelease;
