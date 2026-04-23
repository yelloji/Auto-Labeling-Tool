import React, { useState, useEffect, useCallback } from 'react';
import {
    Button, Input, Typography, Spin, Tag, message, Card, Divider, Empty, Tooltip
} from 'antd';
import {
    RocketOutlined, CheckCircleOutlined, DownloadOutlined,
    FileZipOutlined, TagsOutlined, SettingOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import ReleaseDetailsView from '../project-workspace/ReleaseSection/ReleaseDetailsView';

const { Text, Title } = Typography;
const API = '/api/v1';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const autoName = () => {
    const d = new Date();
    return `retraining-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const RetrainingRelease = ({ projectId, onNext, onReadyChange }) => {
    const [reference, setReference] = useState(null);
    const [releases, setReleases] = useState([]);
    const [name, setName] = useState(autoName());
    const [creating, setCreating] = useState(false);
    const [loadingRef, setLoadingRef] = useState(true);
    const [selectedRelease, setSelectedRelease] = useState(null); // for detail view

    // ── Load reference info for preview ──────────────────────────────────────
    const loadReference = useCallback(async () => {
        setLoadingRef(true);
        try {
            const r = await fetch(`${API}/retraining/${projectId}/reference`);
            if (r.ok) setReference(await r.json());
        } catch { /* non-critical */ }
        finally { setLoadingRef(false); }
    }, [projectId]);

    // ── Load release history (user_retraining only) ───────────────────────────
    const loadReleases = useCallback(async () => {
        try {
            const r = await fetch(`${API}/projects/${projectId}/releases`);
            if (!r.ok) return;
            const all = await r.json();
            setReleases((all || []).filter(rel => rel.release_source === 'user_retraining'));
        } catch { /* non-critical */ }
    }, [projectId]);

    useEffect(() => {
        loadReference();
        loadReleases();
    }, [loadReference, loadReleases]);

    // Notify workspace when release readiness changes
    useEffect(() => {
        if (onReadyChange) onReadyChange(releases.length > 0);
    }, [releases.length, onReadyChange]);

    // ── Create Release ────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!name.trim()) { message.error('Please enter a release name'); return; }
        setCreating(true);
        try {
            // Step 1: get payload + cleanup old releases
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

            // Step 2: create actual release (ZIP generation)
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
            setName(autoName()); // reset name for next time
            await loadReleases();
        } catch (e) {
            message.error(e.message || 'Release creation failed');
        } finally {
            setCreating(false);
        }
    };

    // ── If a release is selected → show detail view ───────────────────────────
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

    // ── Reference config preview helpers ──────────────────────────────────────
    const releaseInfo = reference?.release_info || {};
    const transformations = releaseInfo.transformations || [];
    const hasRelease = releases.length > 0;

    return (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: '1.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <RocketOutlined style={{ fontSize: '1.4rem', color: '#7c3aed' }} />
                    <Title level={4} style={{ margin: 0, color: '#0f172a' }}>Create Release</Title>
                </div>
                <Text style={{ color: '#64748b' }}>
                    Dataset configuration is auto-copied from the production reference. Enter a name and click Create.
                </Text>
            </div>

            {/* ── Config Preview ── */}
            {loadingRef ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
            ) : reference ? (
                <Card
                    size="small"
                    style={{
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(124,58,237,0.2)',
                        borderRadius: 10,
                        background: 'rgba(124,58,237,0.03)',
                    }}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <SettingOutlined style={{ color: '#7c3aed' }} />
                            <Text strong style={{ color: '#0f172a' }}>Reference Configuration (read-only)</Text>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>Export Format</Text>
                            <div>
                                <Tag color="purple" style={{ marginTop: 4 }}>
                                    {releaseInfo.export_format || 'YOLO'}
                                </Tag>
                            </div>
                        </div>
                        <div>
                            <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>Task Type</Text>
                            <div>
                                <Tag color="blue" style={{ marginTop: 4 }}>
                                    {releaseInfo.task_type || 'object_detection'}
                                </Tag>
                            </div>
                        </div>
                        <div>
                            <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>Images per Original</Text>
                            <div>
                                <Tag style={{ marginTop: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}>
                                    ×{releaseInfo.images_per_original ?? 1}
                                </Tag>
                            </div>
                        </div>
                        <div>
                            <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>Transformations</Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                {transformations.length === 0 ? (
                                    <Tag style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#94a3b8' }}>None</Tag>
                                ) : transformations.map((t, i) => (
                                    <Tag key={i} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}>
                                        {t.type || t.name || JSON.stringify(t)}
                                    </Tag>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            ) : null}

            {/* ── Create Form ── */}
            <Card
                style={{ marginBottom: '2rem', borderRadius: 10, border: '1px solid #e2e8f0' }}
                bodyStyle={{ padding: '1.25rem 1.5rem' }}
            >
                <Text strong style={{ display: 'block', marginBottom: '0.6rem', color: '#0f172a' }}>
                    Release Name
                </Text>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. retraining-2026-04-23"
                        disabled={creating}
                        style={{ borderRadius: 8, flex: 1 }}
                        size="large"
                        onPressEnter={handleCreate}
                    />
                    <Button
                        type="primary"
                        size="large"
                        icon={creating ? null : <RocketOutlined />}
                        loading={creating}
                        onClick={handleCreate}
                        disabled={!name.trim()}
                        style={{
                            background: name.trim() ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : undefined,
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 600,
                            minWidth: 160,
                            boxShadow: name.trim() ? '0 4px 15px rgba(124,58,237,0.35)' : 'none',
                        }}
                    >
                        {creating ? 'Creating…' : 'Create Release'}
                    </Button>
                </div>
                {creating && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Spin size="small" />
                        <Text style={{ color: '#7c3aed', fontSize: '0.85rem' }}>
                            Generating release ZIP — this may take a moment…
                        </Text>
                    </div>
                )}
            </Card>

            {/* ── Release History ── */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <FileZipOutlined style={{ color: '#7c3aed' }} />
                    <Text strong style={{ color: '#0f172a', fontSize: '1rem' }}>Release History</Text>
                    <Tag style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}>
                        {releases.length}
                    </Tag>
                </div>

                {releases.length === 0 ? (
                    <Empty
                        description="No release created yet — create one above"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ padding: '2rem', color: '#94a3b8' }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {releases.map(rel => (
                            <Card
                                key={rel.id}
                                hoverable
                                onClick={() => setSelectedRelease(rel)}
                                style={{
                                    borderRadius: 10,
                                    border: '1px solid rgba(124,58,237,0.2)',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    transition: 'box-shadow 0.2s, transform 0.15s',
                                }}
                                bodyStyle={{ padding: '1rem 1.25rem' }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.18)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.boxShadow = '';
                                    e.currentTarget.style.transform = '';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 8,
                                            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(91,33,182,0.1))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <FileZipOutlined style={{ color: '#7c3aed', fontSize: '1.1rem' }} />
                                        </div>
                                        <div>
                                            <Text strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{rel.name}</Text>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                                                <Text style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                                    {formatDate(rel.created_at)}
                                                </Text>
                                                {rel.export_format && (
                                                    <Tag color="purple" style={{ fontSize: '0.72rem', margin: 0 }}>
                                                        {rel.export_format}
                                                    </Tag>
                                                )}
                                                {rel.task_type && (
                                                    <Tag color="blue" style={{ fontSize: '0.72rem', margin: 0 }}>
                                                        {rel.task_type}
                                                    </Tag>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {rel.final_image_count != null && (
                                            <Tag style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}>
                                                {rel.final_image_count} images
                                            </Tag>
                                        )}
                                        <Tag color="success" icon={<CheckCircleOutlined />}>Ready</Tag>
                                        {rel.model_path && (
                                            <Tooltip title="Download ZIP">
                                                <Button
                                                    size="small"
                                                    icon={<DownloadOutlined />}
                                                    style={{ borderRadius: 6 }}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        window.open(`${API}/releases/${rel.id}/download`, '_blank');
                                                    }}
                                                />
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Next: Training unlock hint ── */}
            {hasRelease && (
                <div style={{
                    marginTop: '1.5rem',
                    padding: '0.9rem 1.2rem',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                }}>
                    <CheckCircleOutlined style={{ color: '#10b981', fontSize: '1.1rem' }} />
                    <Text style={{ color: '#065f46', fontWeight: 600 }}>
                        Release ready — click <strong>Next: Train</strong> in the bottom bar to continue.
                    </Text>
                </div>
            )}
        </div>
    );
};

export default RetrainingRelease;
