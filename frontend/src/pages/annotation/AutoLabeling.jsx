import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Select, Slider, Switch, Tooltip, message, Spin, Tag, Progress,
  Empty, Badge
} from 'antd';
import {
  ArrowLeftOutlined, ThunderboltOutlined, PlayCircleOutlined,
  SaveOutlined, DeleteOutlined, RobotOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeOutlined, LeftOutlined, RightOutlined,
  ReloadOutlined, InfoCircleOutlined,
} from '@ant-design/icons';

import AnnotationCanvas from '../../components/AnnotationToolset/AnnotationCanvas';
import AnnotationToolbox from '../../components/AnnotationToolset/AnnotationToolbox';
import LabelSelectionPopup from '../../components/AnnotationToolset/LabelSelectionPopup';
import AnnotationAPI from '../../components/AnnotationToolset/AnnotationAPI';
import { logInfo } from '../../utils/professional_logger';

const API = '/api/v1';

// ── helpers ─────────────────────────────────────────────────────────────────

const getImageUrl = (image) => {
  if (!image) return '';
  const path = image.thumbnail_url || image.url || image.file_path;
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
};

let _draftCounter = 0;
const draftId = () => `draft-${++_draftCounter}-${Date.now()}`;

const predsToDraft = (predictions) =>
  predictions.map((p) => ({
    id: draftId(),
    class_name: p.class_name,
    confidence: p.confidence,
    x_min: p.x_min,
    y_min: p.y_min,
    x_max: p.x_max,
    y_max: p.y_max,
    segmentation: p.segmentation || [],
    type: p.segmentation && p.segmentation.length > 0 ? 'polygon' : 'box',
    isDraft: true,
    is_auto_generated: true,
  }));

const confColor = (c) => {
  if (c >= 0.8) return '#10b981';
  if (c >= 0.6) return '#f59e0b';
  return '#ef4444';
};

const statusBorder = (imageId, savedIds, allPreds) => {
  if (savedIds.has(imageId)) return '3px solid #10b981';
  if (allPreds[imageId]?.length > 0) return '3px solid #7c3aed';
  return '3px solid transparent';
};

// ── component ────────────────────────────────────────────────────────────────

const AutoLabeling = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();

  // dataset + images
  const [dataset, setDataset] = useState(null);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(true);

  // models
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [confidence, setConfidence] = useState(0.50);
  const [iou, setIou] = useState(0.45);

  // predictions / canvas
  const [draftAnnotations, setDraftAnnotations] = useState([]);
  const [allPredictions, setAllPredictions] = useState({});   // imageId → draft[]
  const [savedImageIds, setSavedImageIds] = useState(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // canvas
  const [activeTool, setActiveTool] = useState('select');
  const [zoomLevel, setZoomLevel] = useState(50);
  const [labels, setLabels] = useState([]);

  // label popup for manually drawn shapes
  const [pendingShape, setPendingShape] = useState(null);

  const thumbnailStripRef = useRef(null);

  // ── load ──────────────────────────────────────────────────────────────────

  const loadDataset = useCallback(async () => {
    try {
      const r = await fetch(`${API}/datasets/${datasetId}`);
      if (r.ok) setDataset(await r.json());
    } catch {}
  }, [datasetId]);

  const loadImages = useCallback(async () => {
    setLoadingImages(true);
    try {
      const r = await fetch(`${API}/datasets/${datasetId}/images?limit=500`);
      if (!r.ok) return;
      const data = await r.json();
      const imgs = Array.isArray(data) ? data : (data.images || []);
      setImages(imgs);
    } catch {
      message.error('Failed to load images');
    } finally {
      setLoadingImages(false);
    }
  }, [datasetId]);

  const loadModels = useCallback(async () => {
    if (!dataset?.project_id) return;
    try {
      const r = await fetch(`${API}/projects/${dataset.project_id}/models?include_global=true`);
      if (!r.ok) return;
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data.models || []);
      const ready = list.filter(m => m.status === 'ready' || m.status === 'Ready' || !m.status);
      setModels(ready);
      if (ready.length > 0 && !selectedModelId) {
        // prefer trained project model
        const trained = ready.find(m => m.type === 'trained' || m.is_project_model);
        setSelectedModelId(trained?.id || ready[0].id);
      }
    } catch {}
  }, [dataset?.project_id, selectedModelId]);

  const loadLabels = useCallback(async () => {
    if (!dataset?.project_id) return;
    try {
      const r = await fetch(`${API}/projects/${dataset.project_id}/labels`);
      if (r.ok) {
        const data = await r.json();
        setLabels(Array.isArray(data) ? data : (data.labels || []));
      }
    } catch {}
  }, [dataset?.project_id]);

  useEffect(() => { loadDataset(); loadImages(); }, [loadDataset, loadImages]);
  useEffect(() => { if (dataset) { loadModels(); loadLabels(); } }, [dataset, loadModels, loadLabels]);

  // sync draft annotations when navigating between images
  useEffect(() => {
    const img = images[currentIndex];
    if (!img) return;
    setDraftAnnotations(allPredictions[img.id] || []);
  }, [currentIndex, images, allPredictions]);

  // scroll thumbnail strip to keep current thumb visible
  useEffect(() => {
    const strip = thumbnailStripRef.current;
    if (!strip) return;
    const thumb = strip.querySelector(`[data-index="${currentIndex}"]`);
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentIndex]);

  // ── prediction ─────────────────────────────────────────────────────────────

  const currentImage = images[currentIndex] || null;

  const runPreview = useCallback(async (imgOverride) => {
    const img = imgOverride || currentImage;
    if (!img || !selectedModelId) {
      message.warning('Select a model first');
      return;
    }
    setIsRunning(true);
    try {
      const r = await fetch(`${API}/datasets/${datasetId}/images/${img.id}/auto-label/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: selectedModelId,
          confidence_threshold: confidence,
          iou_threshold: iou,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Prediction failed');
      }
      const data = await r.json();
      const drafts = predsToDraft(data.predictions || []);
      setDraftAnnotations(drafts);
      setAllPredictions(prev => ({ ...prev, [img.id]: drafts }));
      if (drafts.length === 0) message.info('No predictions found on this image');
    } catch (e) {
      message.error(e.message || 'Prediction failed');
    } finally {
      setIsRunning(false);
    }
  }, [currentImage, selectedModelId, datasetId, confidence, iou]);

  const runAll = useCallback(async () => {
    if (!selectedModelId || images.length === 0) {
      message.warning('Select a model first');
      return;
    }
    setIsRunningAll(true);
    setBatchProgress({ current: 0, total: images.length });
    const collected = {};
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const r = await fetch(`${API}/datasets/${datasetId}/images/${img.id}/auto-label/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_id: selectedModelId, confidence_threshold: confidence, iou_threshold: iou }),
        });
        if (r.ok) {
          const data = await r.json();
          collected[img.id] = predsToDraft(data.predictions || []);
        }
      } catch {}
      setBatchProgress({ current: i + 1, total: images.length });
    }
    setAllPredictions(collected);
    const cur = images[currentIndex];
    if (cur) setDraftAnnotations(collected[cur.id] || []);
    setIsRunningAll(false);
    const total = Object.values(collected).reduce((s, a) => s + a.length, 0);
    message.success(`Batch complete — ${total} predictions across ${images.length} images`);
  }, [selectedModelId, images, datasetId, confidence, iou, currentIndex]);

  // ── save ───────────────────────────────────────────────────────────────────

  const saveCurrentImage = useCallback(async () => {
    if (!currentImage || draftAnnotations.length === 0) {
      message.info('Nothing to save');
      return;
    }
    setIsSaving(true);
    try {
      for (const ann of draftAnnotations) {
        await AnnotationAPI.createAnnotation({ ...ann, image_id: currentImage.id });
      }
      setSavedImageIds(prev => new Set([...prev, currentImage.id]));
      setImages(prev => prev.map(img =>
        img.id === currentImage.id ? { ...img, is_labeled: true } : img
      ));
      logInfo('app.frontend.interactions', 'auto_label_saved', 'Auto label annotations saved', {
        imageId: currentImage.id, count: draftAnnotations.length,
      });
      message.success(`Saved ${draftAnnotations.length} annotation${draftAnnotations.length !== 1 ? 's' : ''}`);
    } catch {
      message.error('Failed to save annotations');
    } finally {
      setIsSaving(false);
    }
  }, [currentImage, draftAnnotations]);

  // ── canvas callbacks ───────────────────────────────────────────────────────

  const handleShapeComplete = useCallback((shape) => {
    setPendingShape(shape);
  }, []);

  const handleLabelSelect = useCallback((labelName) => {
    if (!pendingShape) return;
    const newAnn = {
      ...pendingShape,
      id: draftId(),
      class_name: labelName,
      confidence: 1.0,
      isDraft: true,
    };
    setDraftAnnotations(prev => {
      const updated = [...prev, newAnn];
      if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: updated }));
      return updated;
    });
    setPendingShape(null);
  }, [pendingShape, currentImage]);

  const handleAnnotationDelete = useCallback((id) => {
    setDraftAnnotations(prev => {
      const updated = prev.filter(a => a.id !== id);
      if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: updated }));
      return updated;
    });
  }, [currentImage]);

  const handleRemovePrediction = useCallback((id) => {
    handleAnnotationDelete(id);
  }, [handleAnnotationDelete]);

  const handleClearAll = useCallback(() => {
    setDraftAnnotations([]);
    if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: [] }));
  }, [currentImage]);

  // ── navigation ─────────────────────────────────────────────────────────────

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= images.length) return;
    setCurrentIndex(idx);
    setActiveTool('select');
  }, [images.length]);

  // ── derived ────────────────────────────────────────────────────────────────

  const savedCount = savedImageIds.size;
  const pendingCount = Object.values(allPredictions).filter(a => a.length > 0).length;
  const totalPreds = draftAnnotations.length;
  const imageUrl = currentImage ? getImageUrl(currentImage) : '';

  // ── styles ─────────────────────────────────────────────────────────────────

  const S = {
    root: {
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    topBar: {
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 1rem',
      height: 56, flexShrink: 0,
      background: 'linear-gradient(135deg, #10172a 0%, #1d1647 60%, #111827 100%)',
      borderBottom: '1px solid rgba(124,58,237,0.25)',
      boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
    },
    backBtn: {
      color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 34,
      display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
      cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, flexShrink: 0,
    },
    divider: { width: 1, height: 28, background: 'rgba(255,255,255,0.10)', flexShrink: 0 },
    datasetName: {
      color: '#fff', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.01em', flexShrink: 0,
    },
    imgCount: { color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 },
    spacer: { flex: 1 },
    // model picker
    modelSelect: { width: 200, flexShrink: 0 },
    confLabel: { color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700 },
    confValue: { color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 800, minWidth: 28, textAlign: 'right' },
    runBtn: {
      background: selectedModelId ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : undefined,
      border: 'none', borderRadius: 8, fontWeight: 800, height: 34, fontSize: '0.8rem',
      boxShadow: selectedModelId ? '0 4px 14px rgba(124,58,237,0.4)' : 'none',
    },
    runAllBtn: {
      background: selectedModelId ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : undefined,
      border: 'none', borderRadius: 8, fontWeight: 800, height: 34, fontSize: '0.8rem',
    },
    saveBtn: {
      background: draftAnnotations.length > 0
        ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
      border: 'none', borderRadius: 8, fontWeight: 800, height: 34, fontSize: '0.8rem',
      boxShadow: draftAnnotations.length > 0 ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
    },
    // main
    main: { display: 'flex', flex: 1, overflow: 'hidden' },
    // left panel
    leftPanel: {
      width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(15,23,42,0.95)', borderRight: '1px solid rgba(124,58,237,0.18)',
    },
    leftHeader: {
      padding: '0.85rem 0.95rem 0.6rem',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    predTitle: { color: 'rgba(255,255,255,0.55)', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' },
    predList: { flex: 1, overflowY: 'auto', padding: '0.5rem 0.7rem', display: 'flex', flexDirection: 'column', gap: 5 },
    predItem: (conf) => ({
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${confColor(conf)}33`,
      borderLeft: `3px solid ${confColor(conf)}`,
      borderRadius: 8,
      padding: '0.5rem 0.6rem',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      cursor: 'default',
    }),
    predClass: { color: '#fff', fontSize: '0.8rem', fontWeight: 800, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    predConf: (conf) => ({
      color: confColor(conf), fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
    }),
    removeBtn: {
      color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none',
      cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: '0.75rem',
      flexShrink: 0, display: 'flex', alignItems: 'center',
    },
    leftActions: {
      padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    },
    // center canvas
    canvasWrap: {
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    },
    canvasToolbar: {
      height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 0.75rem', gap: '0.5rem',
      background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    canvasViewport: { flex: 1, overflow: 'hidden', position: 'relative' },
    // right panel
    rightPanel: {
      width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(15,23,42,0.95)', borderLeft: '1px solid rgba(124,58,237,0.18)',
      padding: '0.85rem',
    },
    // bottom strip
    bottomStrip: {
      height: 80, flexShrink: 0,
      background: 'rgba(10,14,26,0.98)', borderTop: '1px solid rgba(124,58,237,0.18)',
      display: 'flex', alignItems: 'center', padding: '0 0.75rem', gap: '0.5rem',
      overflow: 'hidden',
    },
    thumbNav: {
      color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      flexShrink: 0, fontSize: '0.8rem',
    },
    thumbStrip: { flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 },
    thumb: (idx, cur, imageId, savedIds, allPreds) => ({
      width: 56, height: 56, flexShrink: 0, borderRadius: 7, overflow: 'hidden',
      cursor: 'pointer', position: 'relative',
      border: idx === cur ? '2px solid #7c3aed' : statusBorder(imageId, savedIds, allPreds),
      boxShadow: idx === cur ? '0 0 0 2px rgba(124,58,237,0.4)' : 'none',
      opacity: idx === cur ? 1 : 0.7,
      transition: 'all 0.15s',
    }),
    thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    thumbBadge: {
      position: 'absolute', top: 2, right: 2, width: 14, height: 14,
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.55rem', fontWeight: 900,
    },
  };

  // ── render ─────────────────────────────────────────────────────────────────

  if (loadingImages) {
    return (
      <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
        <span style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: '0.85rem' }}>Loading images…</span>
      </div>
    );
  }

  return (
    <div style={S.root}>

      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeftOutlined style={{ fontSize: '0.75rem' }} />
          Back
        </button>
        <div style={S.divider} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, flexShrink: 0 }}>
          <span style={S.datasetName}>{dataset?.name || 'Auto Labeling'}</span>
          <span style={S.imgCount}>{images.length} images · {savedCount} saved</span>
        </div>
        <div style={S.divider} />

        {/* Model picker */}
        <Select
          value={selectedModelId}
          onChange={setSelectedModelId}
          placeholder="Select model…"
          style={S.modelSelect}
          size="small"
          dropdownStyle={{ background: '#1e293b', border: '1px solid rgba(124,58,237,0.3)' }}
          notFoundContent={<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>No ready models</span>}
        >
          {models.map(m => (
            <Select.Option key={m.id} value={m.id}>
              <span style={{ fontWeight: 700 }}>{m.name}</span>
              {m.is_project_model && <Tag color="purple" style={{ marginLeft: 5, fontSize: '0.6rem' }}>Project</Tag>}
            </Select.Option>
          ))}
        </Select>

        {/* Confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={S.confLabel}>CONF</span>
          <Slider
            min={0.1} max={0.9} step={0.05} value={confidence}
            onChange={setConfidence}
            style={{ width: 80 }}
            tooltip={{ formatter: v => `${Math.round(v * 100)}%` }}
          />
          <span style={S.confValue}>{Math.round(confidence * 100)}%</span>
        </div>

        {/* IOU */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={S.confLabel}>IOU</span>
          <Slider
            min={0.1} max={0.9} step={0.05} value={iou}
            onChange={setIou}
            style={{ width: 70 }}
            tooltip={{ formatter: v => v.toFixed(2) }}
          />
          <span style={S.confValue}>{iou.toFixed(2)}</span>
        </div>

        <div style={S.spacer} />

        {/* Run image */}
        <Button
          icon={<PlayCircleOutlined />}
          loading={isRunning}
          disabled={!selectedModelId || isRunningAll}
          onClick={() => runPreview()}
          style={S.runBtn}
          size="small"
        >
          Run Image
        </Button>

        {/* Run all */}
        <Button
          icon={<ThunderboltOutlined />}
          loading={isRunningAll}
          disabled={!selectedModelId || isRunning}
          onClick={runAll}
          style={S.runAllBtn}
          size="small"
        >
          {isRunningAll
            ? `${batchProgress.current}/${batchProgress.total}`
            : 'Run All Batch'}
        </Button>

        {/* Save */}
        <Button
          icon={<SaveOutlined />}
          loading={isSaving}
          disabled={draftAnnotations.length === 0}
          onClick={saveCurrentImage}
          style={S.saveBtn}
          size="small"
        >
          Save Image ({totalPreds})
        </Button>
      </div>

      {/* ── MAIN ── */}
      <div style={S.main}>

        {/* LEFT PANEL — prediction list */}
        <div style={S.leftPanel}>
          <div style={S.leftHeader}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={S.predTitle}>Predictions</span>
              <span style={{
                background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)',
                color: '#c4b5fd', borderRadius: 12, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 900,
              }}>
                {draftAnnotations.length}
              </span>
            </div>
            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Spin size="small" />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>Running model…</span>
              </div>
            )}
            {isRunningAll && (
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={Math.round((batchProgress.current / batchProgress.total) * 100)}
                  size="small"
                  strokeColor="#7c3aed"
                  trailColor="rgba(255,255,255,0.08)"
                  format={() => <span style={{ color: '#c4b5fd', fontSize: '0.65rem' }}>{batchProgress.current}/{batchProgress.total}</span>}
                />
              </div>
            )}
          </div>

          <div style={S.predList}>
            {draftAnnotations.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                <RobotOutlined style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.12)', display: 'block', marginBottom: 8 }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>
                  {isRunning ? 'Predicting…' : 'Run model to see predictions'}
                </span>
              </div>
            ) : (
              [...draftAnnotations]
                .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                .map((ann) => (
                  <div key={ann.id} style={S.predItem(ann.confidence || 1)}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: confColor(ann.confidence || 1), flexShrink: 0 }} />
                    <span style={S.predClass}>{ann.class_name}</span>
                    <span style={S.predConf(ann.confidence || 1)}>
                      {ann.confidence != null ? `${Math.round(ann.confidence * 100)}%` : '—'}
                    </span>
                    <Tooltip title="Remove prediction">
                      <button style={S.removeBtn} onClick={() => handleRemovePrediction(ann.id)}>
                        <CloseCircleOutlined />
                      </button>
                    </Tooltip>
                  </div>
                ))
            )}
          </div>

          <div style={S.leftActions}>
            {draftAnnotations.length > 0 && (
              <Button
                size="small" danger ghost
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
                style={{ borderRadius: 7, fontWeight: 700 }}
              >
                Clear All
              </Button>
            )}
            <Button
              size="small"
              icon={<ReloadOutlined />}
              disabled={!selectedModelId || isRunning || isRunningAll}
              loading={isRunning}
              onClick={() => runPreview()}
              style={{ borderRadius: 7, fontWeight: 700, borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' }}
              ghost
            >
              Re-run on this image
            </Button>
          </div>
        </div>

        {/* CENTER — canvas */}
        <div style={S.canvasWrap}>
          {/* mini toolbar row */}
          <div style={S.canvasToolbar}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', fontWeight: 700 }}>
              {currentImage?.filename || '—'}
            </span>
            <div style={{ flex: 1 }} />
            {savedImageIds.has(currentImage?.id) && (
              <span style={{
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                color: '#10b981', borderRadius: 20, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <CheckCircleOutlined style={{ fontSize: '0.7rem' }} /> Saved
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>
              {currentIndex + 1} / {images.length}
            </span>
          </div>

          {/* canvas area */}
          <div style={S.canvasViewport}>
            {!currentImage ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={<span style={{ color: 'rgba(255,255,255,0.3)' }}>No images in this batch</span>} />
              </div>
            ) : (
              <AnnotationCanvas
                key={currentImage.id}
                imageUrl={imageUrl}
                imageId={currentImage.id}
                annotations={draftAnnotations}
                activeTool={activeTool}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onShapeComplete={handleShapeComplete}
                onAnnotationDelete={handleAnnotationDelete}
              />
            )}
          </div>

          {/* label popup for manually drawn shapes */}
          {pendingShape && (
            <LabelSelectionPopup
              visible={!!pendingShape}
              existingLabels={labels}
              onConfirm={handleLabelSelect}
              onCancel={() => setPendingShape(null)}
              shapeType={pendingShape?.type || 'box'}
              isEditing={false}
            />
          )}
        </div>

        {/* RIGHT PANEL — batch status + tools */}
        <div style={S.rightPanel}>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ ...S.predTitle, display: 'block', marginBottom: 8 }}>Batch Status</span>
            {[
              ['Saved', savedCount, '#10b981'],
              ['With predictions', pendingCount, '#7c3aed'],
              ['Total images', images.length, 'rgba(255,255,255,0.4)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{label}</span>
                <span style={{ color, fontWeight: 900, fontSize: '0.85rem' }}>{val}</span>
              </div>
            ))}
            <Progress
              percent={images.length > 0 ? Math.round((savedCount / images.length) * 100) : 0}
              size="small"
              strokeColor="#10b981"
              trailColor="rgba(255,255,255,0.06)"
              style={{ marginTop: 6 }}
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.5rem 0 1rem' }} />

          <span style={{ ...S.predTitle, display: 'block', marginBottom: 8 }}>Drawing Tools</span>
          <AnnotationToolbox
            activeTool={activeTool}
            onToolChange={setActiveTool}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.9rem 0' }} />

          <span style={{ ...S.predTitle, display: 'block', marginBottom: 8 }}>Legend</span>
          {[
            ['#10b981', 'Saved'],
            ['#7c3aed', 'Has predictions'],
            ['rgba(255,255,255,0.2)', 'Empty'],
          ].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{label}</span>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ padding: '0.6rem', background: 'rgba(124,58,237,0.08)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', lineHeight: 1.55, display: 'block' }}>
              <InfoCircleOutlined style={{ marginRight: 5, color: '#c4b5fd' }} />
              Predictions are NOT saved until you click <strong style={{ color: '#10b981' }}>Save Image</strong>. Edit or remove any shape before saving.
            </span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM STRIP ── */}
      <div style={S.bottomStrip}>
        <div style={S.thumbNav} onClick={() => goTo(currentIndex - 1)}>
          <LeftOutlined />
        </div>

        <div style={S.thumbStrip} ref={thumbnailStripRef}>
          {images.map((img, idx) => {
            const isSaved = savedImageIds.has(img.id);
            const hasPreds = (allPredictions[img.id]?.length || 0) > 0;
            return (
              <div
                key={img.id}
                data-index={idx}
                style={S.thumb(idx, currentIndex, img.id, savedImageIds, allPredictions)}
                onClick={() => goTo(idx)}
                title={img.filename}
              >
                <img
                  src={getImageUrl(img)}
                  alt={img.filename}
                  style={S.thumbImg}
                  loading="lazy"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                {isSaved && (
                  <div style={{ ...S.thumbBadge, background: '#10b981' }}>
                    <CheckCircleOutlined style={{ color: '#fff', fontSize: '0.6rem' }} />
                  </div>
                )}
                {!isSaved && hasPreds && (
                  <div style={{ ...S.thumbBadge, background: '#7c3aed' }}>
                    <EyeOutlined style={{ color: '#fff', fontSize: '0.6rem' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={S.thumbNav} onClick={() => goTo(currentIndex + 1)}>
          <RightOutlined />
        </div>
      </div>
    </div>
  );
};

export default AutoLabeling;
