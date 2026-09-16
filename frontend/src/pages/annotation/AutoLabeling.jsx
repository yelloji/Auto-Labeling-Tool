import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Select, Slider, InputNumber, Tooltip, message, Spin, Tag, Empty, Progress, Switch,
} from 'antd';
import {
  ArrowLeftOutlined, ThunderboltOutlined, PlayCircleOutlined,
  SaveOutlined, DeleteOutlined, RobotOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeOutlined, LeftOutlined, RightOutlined,
  ReloadOutlined, DragOutlined, BorderOutlined, ExpandOutlined,
  BlockOutlined, ZoomInOutlined, ZoomOutOutlined,
} from '@ant-design/icons';


import AnnotationCanvas from '../../components/AnnotationToolset/AnnotationCanvas';
import LabelSelectionPopup from '../../components/AnnotationToolset/LabelSelectionPopup';
import AnnotationAPI from '../../components/AnnotationToolset/AnnotationAPI';
import { logInfo } from '../../utils/professional_logger';

const API = '/api/v1';

// ── helpers ───────────────────────────────────────────────────────────────────

const getImageUrl = (image) => {
  if (!image) return '';
  const path = image.url || image.file_path;
  if (!path) return '';
  return path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`);
};

const getThumbnailUrl = (image) => {
  if (!image) return '';
  const path = image.thumbnail_url || image.url || image.file_path;
  if (!path) return '';
  return path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`);
};

let _draftCounter = 0;
const draftId = () => `draft-${++_draftCounter}-${Date.now()}`;
const isDraftId = (id) => String(id).startsWith('draft-');

// Convert a flat [x0, y0, x1, y1, ...] or [{x,y},...] segmentation to [{x,y},...] points
const toPoints = (seg) => {
  if (!seg || seg.length === 0) return [];
  if (typeof seg[0] === 'object' && seg[0] !== null) return seg;  // already [{x,y}]
  const pts = [];
  for (let i = 0; i + 1 < seg.length; i += 2) pts.push({ x: seg[i], y: seg[i + 1] });
  return pts;
};

// RDP polygon simplification — same algorithm as ManualLabeling's prediction import
const _rdpSquaredDist = (pt, s, e) => {
  const dx = e.x - s.x, dy = e.y - s.y;
  if (dx === 0 && dy === 0) return (pt.x - s.x) ** 2 + (pt.y - s.y) ** 2;
  const t = Math.max(0, Math.min(1, ((pt.x - s.x) * dx + (pt.y - s.y) * dy) / (dx * dx + dy * dy)));
  return (pt.x - (s.x + t * dx)) ** 2 + (pt.y - (s.y + t * dy)) ** 2;
};
const _rdpSimplify = (pts, tol) => {
  if (pts.length <= 2) return pts;
  const tolSq = tol * tol;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = _rdpSquaredDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tolSq) {
    const l = _rdpSimplify(pts.slice(0, maxI + 1), tol);
    const r = _rdpSimplify(pts.slice(maxI), tol);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
};
const simplifyPolygon = (points, tolerance = 2, minPoints = 8) => {
  if (!Array.isArray(points) || points.length <= minPoints) return points || [];
  const unique = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  const last = unique[unique.length - 1], first = unique[0];
  const open = last && first && last.x === first.x && last.y === first.y ? unique.slice(0, -1) : unique;
  if (open.length <= minPoints) return open;
  for (const tol of [tolerance, tolerance * 0.5, tolerance * 0.25, tolerance * 0.1]) {
    const simplified = _rdpSimplify([...open, open[0]], tol).slice(0, -1);
    if (simplified.length >= minPoints && simplified.length < open.length) return simplified;
  }
  return open;
};

// Same generic-name list as ManualLabeling's resolvePredictionLabelName
const GENERIC_CLASS_NAMES = new Set(['item', 'object', 'objects', 'class', 'unknown']);

// Resolve raw model class_name → real project label name (mirrors ManualLabeling logic)
const resolveLabel = (rawName, labels = []) => {
  const meaningfulLabels = labels.filter(l => !GENERIC_CLASS_NAMES.has(String(l.name || '').trim().toLowerCase()));
  const byName = new Map(labels.map(l => [String(l.name || '').trim().toLowerCase(), l.name]));

  const normalized = String(rawName || '').trim().toLowerCase();
  if (normalized && !GENERIC_CLASS_NAMES.has(normalized) && byName.has(normalized))
    return byName.get(normalized);
  if (normalized && !GENERIC_CLASS_NAMES.has(normalized) && normalized.length > 0)
    return rawName;

  // rawName is generic — fall back to sole meaningful project label
  if (meaningfulLabels.length === 1) return meaningfulLabels[0].name;
  if (labels.length === 1) return labels[0].name;
  return rawName || 'item';
};

// Auto-label predictions: backend returns normalized [0,1] coords — scale to pixels for canvas
const predsToDraft = (predictions, imgW, imgH, labels = []) =>
  predictions.map((p) => {
    const sw = imgW || 1;
    const sh = imgH || 1;
    const x_min = p.x_min * sw;
    const y_min = p.y_min * sh;
    const x_max = p.x_max * sw;
    const y_max = p.y_max * sh;
    const rawPoints = toPoints(p.segmentation).map(pt => ({ x: pt.x * sw, y: pt.y * sh }));
    const points = rawPoints.length > 8 ? simplifyPolygon(rawPoints) : rawPoints;
    const type = points.length >= 3 ? 'polygon' : 'box';
    const resolvedLabel = resolveLabel(p.class_name, labels);
    const confPct = Math.round((p.confidence || 0) * 100);
    return {
      id: draftId(),
      type,
      label: resolvedLabel,
      class_name: resolvedLabel,
      displayLabel: `${resolvedLabel} ${confPct}%`,
      confidence: p.confidence,
      x: x_min, y: y_min,
      width: x_max - x_min,
      height: y_max - y_min,
      x_min, y_min, x_max, y_max,
      points, segmentation: points,
      isDraft: true, is_auto_generated: true,
    };
  });

// Existing DB annotations: segmentation stored as [{x,y},...] objects
const dbAnnotationToDraft = (ann) => {
  const points = toPoints(ann.segmentation || ann.points || []);
  const type = ann.type || (points.length >= 3 ? 'polygon' : 'box');
  return {
    id: ann.id,   // real DB id — not draft-*, so save won't re-create it
    type,
    label: ann.class_name || ann.label || 'unknown',
    class_name: ann.class_name || ann.label || 'unknown',
    confidence: ann.confidence ?? 1.0,
    x: ann.x_min, y: ann.y_min,
    width: ann.x_max - ann.x_min,
    height: ann.y_max - ann.y_min,
    x_min: ann.x_min, y_min: ann.y_min,
    x_max: ann.x_max, y_max: ann.y_max,
    points, segmentation: points,
    isDraft: false, isExisting: true,
  };
};

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

// 'project' = this project's own models, 'global' = shared app-wide models.
// The API sends an authoritative `scope`; project_id is a fallback for older payloads.
const scopeOf = (m) => m?.scope || (m?.project_id ? 'project' : 'global');

// ── component ─────────────────────────────────────────────────────────────────

const AutoLabeling = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();

  const [dataset, setDataset] = useState(null);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(true);

  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  // which kind of model the picker lists: 'project' (this project's own) or 'global'
  const [modelScope, setModelScope] = useState('project');
  const [confidence, setConfidence] = useState(0.50);
  const [iou, setIou] = useState(0.45);

  // prediction mode: 'normal' | 'sahi'
  const [predictionMode, setPredictionMode] = useState('normal');
  const [sliceSize, setSliceSize] = useState(896);
  const [overlapRatio, setOverlapRatio] = useState(0.25);
  // Merge threshold: how much overlap between detections from different SAHI
  // slices counts as "the same object" and gets merged into one, instead of
  // kept as a duplicate. SAHI-only — normal mode uses the IOU slider instead.
  const [mergeThreshold, setMergeThreshold] = useState(0.20);
  // Stitch distance (pixels): joins same-class detections that are close but
  // don't actually overlap — fixes long thin objects (cracks) that get cut
  // into pieces at tile boundaries that Merge Threshold alone can't combine.
  // 0 = off.
  // Defaults to 0 (off) — the stitch geometry isn't accurate enough to trust
  // yet, so it stays opt-in until that work is done.
  const [stitchDistance, setStitchDistance] = useState(0);
  // Independent toggle: combine detections that truly overlap (real
  // duplicates of the same spot) into one. On by default. Off shows SAHI's
  // raw, untouched predictions for the overlap case.
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  // How much two detections must overlap to count as the same spot, measured
  // as shared_area / smaller_box_area (NOT IoU). 0.10 = overlap covers 10% of
  // the smaller box.
  const [duplicateOverlap, setDuplicateOverlap] = useState(0.10);

  const [draftAnnotations, setDraftAnnotations] = useState([]);
  const [allPredictions, setAllPredictions] = useState({});   // imageId → draft[]
  const [savedImageIds, setSavedImageIds] = useState(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [activeTool, setActiveTool] = useState('select');
  const [zoomLevel, setZoomLevel] = useState(50);
  const [labels, setLabels] = useState([]);
  const [pendingShape, setPendingShape] = useState(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const selectedAnnotationRef = useRef(null);

  const thumbnailStripRef = useRef(null);
  const prevImageIdRef = useRef(null);
  // tracks which imageIds are currently being async-loaded (prevents double-fetch)
  const loadingAnnotationsRef = useRef(new Set());
  // tracks which real DB annotation IDs were loaded for each image
  const initialAnnotationIdsRef = useRef({});

  // ── data loading ──────────────────────────────────────────────────────────

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
      setImages(Array.isArray(data) ? data : (data.images || []));
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
        const trained = ready.find(m => m.type === 'trained' || scopeOf(m) === 'project');
        const initial = trained || ready[0];
        setSelectedModelId(initial.id);
        // open the picker on the tab the auto-selected model actually lives in
        setModelScope(scopeOf(initial));
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

  // Effect 1: When navigating to a new image, populate allPredictions cache.
  // If image is already labeled in DB and not yet loaded, fetch existing annotations.
  // Intentionally does NOT depend on allPredictions to avoid re-triggering.
  useEffect(() => {
    const img = images[currentIndex];
    if (!img) return;
    if (allPredictions[img.id] !== undefined) return;   // already cached
    if (loadingAnnotationsRef.current.has(img.id)) return;  // already loading

    if (img.is_labeled) {
      loadingAnnotationsRef.current.add(img.id);
      AnnotationAPI.getImageAnnotations(img.id)
        .then(existing => {
          const drafts = (existing || []).map(dbAnnotationToDraft);
          initialAnnotationIdsRef.current[img.id] = new Set((existing || []).map(a => a.id));
          setAllPredictions(prev => ({ ...prev, [img.id]: drafts }));
        })
        .catch(() => {
          setAllPredictions(prev => ({ ...prev, [img.id]: [] }));
        })
        .finally(() => {
          loadingAnnotationsRef.current.delete(img.id);
        });
    } else {
      setAllPredictions(prev => ({ ...prev, [img.id]: [] }));
    }
  }, [currentIndex, images]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: Sync draftAnnotations whenever the cache or navigation changes.
  // isDirty is only auto-reset on actual image switch — not on every allPredictions update.
  useEffect(() => {
    const img = images[currentIndex];
    if (!img) { setDraftAnnotations([]); return; }
    const anns = allPredictions[img.id] || [];
    setDraftAnnotations(anns);
    if (img.id !== prevImageIdRef.current) {
      prevImageIdRef.current = img.id;
      // Auto-detect dirty: image has unsaved draft predictions (e.g. from Run All)
      setIsDirty(anns.some(a => isDraftId(a.id)));
    }
  }, [currentIndex, images, allPredictions]);

  // Scroll thumbnail into view
  useEffect(() => {
    const strip = thumbnailStripRef.current;
    if (!strip) return;
    const thumb = strip.querySelector(`[data-index="${currentIndex}"]`);
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentIndex]);

  // Keep ref in sync with selectedAnnotation state (avoids stale closures during rapid drag)
  useEffect(() => { selectedAnnotationRef.current = selectedAnnotation; }, [selectedAnnotation]);

  // ── prediction ────────────────────────────────────────────────────────────

  const currentImage = images[currentIndex] || null;

  const getPreviewEndpoint = useCallback((imgId) => {
    const suffix = predictionMode === 'sahi' ? 'preview-sahi' : 'preview';
    return `${API}/datasets/${datasetId}/images/${imgId}/auto-label/${suffix}`;
  }, [datasetId, predictionMode]);

  const getPreviewBody = useCallback(() => ({
    model_id: selectedModelId,
    confidence_threshold: confidence,
    // SAHI's iou_threshold is the tile-boundary MERGE threshold (postprocess_match_threshold
    // server-side), a different concept from normal mode's NMS IOU — each mode gets its own value.
    iou_threshold: predictionMode === 'sahi' ? mergeThreshold : iou,
    ...(predictionMode === 'sahi' ? {
      slice_height: sliceSize, slice_width: sliceSize, overlap_ratio: overlapRatio,
      stitch_distance: stitchDistance, remove_duplicates: removeDuplicates,
      duplicate_overlap_fraction: duplicateOverlap,
    } : {}),
  }), [selectedModelId, confidence, iou, predictionMode, sliceSize, overlapRatio, mergeThreshold, stitchDistance, removeDuplicates, duplicateOverlap]);

  const runPreview = useCallback(async (imgOverride) => {
    const img = imgOverride || currentImage;
    if (!img || !selectedModelId) { message.warning('Select a model first'); return; }
    setIsRunning(true);
    try {
      const r = await fetch(getPreviewEndpoint(img.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPreviewBody()),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Prediction failed');
      }
      const data = await r.json();
      const drafts = predsToDraft(data.predictions || [], img.width, img.height, labels);
      setDraftAnnotations(drafts);
      setAllPredictions(prev => ({ ...prev, [img.id]: drafts }));
      setIsDirty(drafts.length > 0);
      if (drafts.length === 0) message.info('No predictions found on this image');
    } catch (e) {
      message.error(e.message || 'Prediction failed');
    } finally {
      setIsRunning(false);
    }
  }, [currentImage, selectedModelId, getPreviewEndpoint, getPreviewBody, labels]);

  const runAll = useCallback(async () => {
    if (!selectedModelId || images.length === 0) { message.warning('Select a model first'); return; }
    setIsRunningAll(true);
    setBatchProgress({ current: 0, total: images.length });
    const collected = {};
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const r = await fetch(getPreviewEndpoint(img.id), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getPreviewBody()),
        });
        if (r.ok) {
          const data = await r.json();
          collected[img.id] = predsToDraft(data.predictions || [], img.width, img.height, labels);
        }
      } catch {}
      setBatchProgress({ current: i + 1, total: images.length });
    }
    setAllPredictions(collected);
    const cur = images[currentIndex];
    if (cur) {
      setDraftAnnotations(collected[cur.id] || []);
      if ((collected[cur.id]?.length || 0) > 0) setIsDirty(true);
    }
    setIsRunningAll(false);
    const total = Object.values(collected).reduce((s, a) => s + a.length, 0);
    message.success(`Batch complete — ${total} predictions across ${images.length} images`);
  }, [selectedModelId, images, getPreviewEndpoint, getPreviewBody, currentIndex, labels]);

  // ── save ──────────────────────────────────────────────────────────────────

  const saveCurrentImage = useCallback(async () => {
    if (!currentImage || isSaving) return;

    const existingInView = draftAnnotations.filter(a => !isDraftId(a.id));
    const newDrafts = draftAnnotations.filter(a => isDraftId(a.id));

    // Determine which initial DB annotations the user removed
    const initialIds = initialAnnotationIdsRef.current[currentImage.id] || new Set();
    const keptIds = new Set(existingInView.map(a => a.id));
    const toDelete = [...initialIds].filter(id => !keptIds.has(id));

    if (newDrafts.length === 0 && toDelete.length === 0) {
      message.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      // Delete removed existing annotations from DB
      for (const id of toDelete) {
        await AnnotationAPI.deleteAnnotation(id);
      }
      // Create new draft annotations in DB
      for (const ann of newDrafts) {
        await AnnotationAPI.createAnnotation({ ...ann, image_id: currentImage.id });
      }

      // Reload from DB so annotations have real IDs — prevents re-save on next click
      const fresh = await AnnotationAPI.getImageAnnotations(currentImage.id);
      const freshDrafts = (fresh || []).map(dbAnnotationToDraft);
      initialAnnotationIdsRef.current[currentImage.id] = new Set((fresh || []).map(a => a.id));
      setDraftAnnotations(freshDrafts);
      setAllPredictions(p => ({ ...p, [currentImage.id]: freshDrafts }));
      setIsDirty(false);

      setSavedImageIds(prev => new Set([...prev, currentImage.id]));
      setImages(prev => prev.map(img =>
        img.id === currentImage.id ? { ...img, is_labeled: true } : img
      ));

      logInfo('app.frontend.interactions', 'auto_label_saved', 'Auto label annotations saved', {
        imageId: currentImage.id, created: newDrafts.length, deleted: toDelete.length,
      });

      const parts = [];
      if (newDrafts.length > 0) parts.push(`${newDrafts.length} added`);
      if (toDelete.length > 0) parts.push(`${toDelete.length} removed`);
      message.success(`Saved — ${parts.join(', ')}`);
    } catch {
      message.error('Failed to save annotations');
    } finally {
      setIsSaving(false);
    }
  }, [currentImage, draftAnnotations]);

  // ── canvas callbacks ───────────────────────────────────────────────────────

  const handleShapeComplete = useCallback((shape) => { setPendingShape(shape); }, []);

  const handleLabelSelect = useCallback((labelName) => {
    if (!pendingShape) return;
    const newAnn = { ...pendingShape, id: draftId(), label: labelName, class_name: labelName, confidence: 1.0, isDraft: true };
    setDraftAnnotations(prev => {
      const updated = [...prev, newAnn];
      if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: updated }));
      return updated;
    });
    setIsDirty(true);
    setPendingShape(null);
  }, [pendingShape, currentImage]);

  const handleAnnotationDelete = useCallback((id) => {
    setDraftAnnotations(prev => {
      const updated = prev.filter(a => a.id !== id);
      if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: updated }));
      return updated;
    });
    setSelectedAnnotation(prev => (prev?.id === id ? null : prev));
    setIsDirty(true);
  }, [currentImage]);

  const handleAnnotationSelect = useCallback((ann) => {
    setSelectedAnnotation(ann);
  }, []);

  const handlePolygonEditChange = useCallback((newPoints) => {
    // Use ref to get the current annotation — avoids stale closure during rapid drag events
    const ann = selectedAnnotationRef.current;
    if (!ann) return;

    // If this is a DB annotation being edited for the first time, give it a new draft ID
    // so saveCurrentImage treats it as: delete old DB record + create updated one
    const wasDB = !isDraftId(ann.id);
    const newId = wasDB ? draftId() : ann.id;
    const updated = { ...ann, id: newId, points: newPoints, segmentation: newPoints, isDraft: wasDB };

    // Update ref immediately so next drag event sees the new ID
    selectedAnnotationRef.current = updated;
    setSelectedAnnotation(updated);
    setDraftAnnotations(prev => {
      const next = prev.map(a => a.id === ann.id ? updated : a);
      if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: next }));
      return next;
    });
    setIsDirty(true);
  }, [currentImage]); // no selectedAnnotation dep — uses ref to avoid stale closures

  // Delete key removes the selected annotation.
  // While the polygon tool is active, Backspace belongs to the canvas (it removes
  // the last polygon point), so it must not delete the selected annotation here.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Backspace' && activeTool === 'polygon') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotation &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        handleAnnotationDelete(selectedAnnotation.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnnotation, handleAnnotationDelete, activeTool]);

  // Shift+Z / Shift+Y — polygon POINT undo/redo while drawing, same as Manual Labeling.
  // The canvas owns the polygon point history and listens on document for Backspace
  // (remove last point) and Shift+Y (restore it), so Shift+Z is relayed to it the
  // same way Manual Labeling does. Annotation-level undo is a separate concern.
  useEffect(() => {
    if (activeTool !== 'polygon') return;
    const onKeyDown = (e) => {
      if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.toLowerCase() !== 'z') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (document.activeElement?.isContentEditable) return;
      e.preventDefault();
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true, cancelable: true,
      }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool]);

  const handleRemovePrediction = handleAnnotationDelete;

  const handleClearAll = useCallback(() => {
    setDraftAnnotations([]);
    if (currentImage) setAllPredictions(p => ({ ...p, [currentImage.id]: [] }));
    setIsDirty(true);
  }, [currentImage]);

  // ── navigation ────────────────────────────────────────────────────────────

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= images.length) return;
    setCurrentIndex(idx);
    setActiveTool('select');
    setSelectedAnnotation(null);
  }, [images.length]);

  // Left/Right arrow keys move between images
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (document.activeElement?.isContentEditable) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, goTo]);

  // ── derived ───────────────────────────────────────────────────────────────

  const projectModels = useMemo(() => models.filter(m => scopeOf(m) === 'project'), [models]);
  const globalModels = useMemo(() => models.filter(m => scopeOf(m) === 'global'), [models]);
  const visibleModels = modelScope === 'project' ? projectModels : globalModels;

  // Switching scope must not leave a model from the other scope selected —
  // fall back to the first model of the newly picked scope (or nothing).
  const handleScopeChange = useCallback((scope) => {
    setModelScope(scope);
    const list = scope === 'project' ? projectModels : globalModels;
    if (!list.some(m => m.id === selectedModelId)) {
      setSelectedModelId(list[0]?.id ?? null);
    }
  }, [projectModels, globalModels, selectedModelId]);

  const savedCount = savedImageIds.size;
  const pendingCount = Object.values(allPredictions).filter(a => a.length > 0).length;
  const totalPreds = draftAnnotations.length;
  const existingCount = draftAnnotations.filter(a => !isDraftId(a.id)).length;
  const newCount = draftAnnotations.filter(a => isDraftId(a.id)).length;
  const imageUrl = currentImage ? getImageUrl(currentImage) : '';

  // ── styles ────────────────────────────────────────────────────────────────

  const S = {
    root: {
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    topBar: {
      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.85rem',
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
    datasetName: { color: '#fff', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 },
    imgCount: { color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 },
    spacer: { flex: 1 },
    modelSelect: { width: 185, flexShrink: 0 },
    modeToggle: {
      display: 'flex', borderRadius: 8, overflow: 'hidden', flexShrink: 0,
      border: '1px solid rgba(124,58,237,0.35)',
    },
    modeBtn: (active) => ({
      background: active ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.04)',
      color: active ? '#fff' : 'rgba(255,255,255,0.38)',
      border: 'none', cursor: 'pointer',
      padding: '5px 11px', fontSize: '0.67rem', fontWeight: 900,
      letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.15s',
    }),
    confLabel: { color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700 },
    confValue: { color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 800, minWidth: 28, textAlign: 'right' },
    numInput: {
      width: 58, fontSize: '0.72rem', fontWeight: 800,
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 6, color: '#c4b5fd',
    },
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
      background: isDirty
        ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
      border: 'none', borderRadius: 8, fontWeight: 800, height: 34, fontSize: '0.8rem',
      boxShadow: isDirty ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
    },
    main: { display: 'flex', flex: 1, overflow: 'hidden' },
    leftPanel: {
      width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(15,23,42,0.95)', borderRight: '1px solid rgba(124,58,237,0.18)',
    },
    toolStrip: {
      padding: '0.55rem 0.65rem 0.45rem',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 6,
    },
    toolRow: {
      display: 'flex', gap: 5,
    },
    toolBtn: (active) => ({
      flex: 1, height: 34, border: 'none', borderRadius: 7, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 1, padding: '2px 0',
      background: active ? 'rgba(124,58,237,0.65)' : 'rgba(255,255,255,0.07)',
      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      boxShadow: active ? '0 0 0 1px rgba(124,58,237,0.6)' : 'none',
      transition: 'all 0.12s',
    }),
    toolBtnIcon: { fontSize: '0.8rem' },
    toolBtnLabel: { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.03em' },
    zoomRow: {
      display: 'flex', alignItems: 'center', gap: 5,
    },
    zoomBtn: {
      flex: 'none', width: 28, height: 24, border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 5, cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '0.75rem',
    },
    zoomVal: {
      flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.5)',
      fontSize: '0.7rem', fontWeight: 800,
    },
    leftHeader: {
      padding: '0.85rem 0.95rem 0.65rem',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    predTitle: {
      color: 'rgba(255,255,255,0.55)', fontSize: '0.65rem', fontWeight: 900,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    },
    predList: {
      flex: 1, overflowY: 'auto', padding: '0.5rem 0.7rem',
      display: 'flex', flexDirection: 'column', gap: 5,
    },
    predItem: (ann) => ({
      background: 'rgba(255,255,255,0.04)',
      border: ann.isExisting
        ? '1px solid rgba(96,165,250,0.35)'
        : `1px solid ${confColor(ann.confidence || 1)}33`,
      borderLeft: ann.isExisting
        ? '3px solid rgba(96,165,250,0.75)'
        : `3px solid ${confColor(ann.confidence || 1)}`,
      borderRadius: 8, padding: '0.5rem 0.6rem',
      display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'default',
    }),
    predClass: {
      color: '#fff', fontSize: '0.8rem', fontWeight: 800, flex: 1,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    removeBtn: {
      color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none',
      cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: '0.75rem',
      flexShrink: 0, display: 'flex', alignItems: 'center',
    },
    leftActions: {
      padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    },
    canvasWrap: {
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    },
    canvasToolbar: {
      height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 0.75rem', gap: '0.5rem',
      background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    canvasViewport: { flex: 1, overflow: 'hidden', position: 'relative' },
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
    thumbStrip: {
      flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2,
    },
    thumb: (idx, cur, imageId, savedIds, allPreds) => ({
      width: 56, height: 56, flexShrink: 0, borderRadius: 7, overflow: 'hidden',
      cursor: 'pointer', position: 'relative',
      border: idx === cur ? '2px solid #7c3aed' : statusBorder(imageId, savedIds, allPreds),
      boxShadow: idx === cur ? '0 0 0 2px rgba(124,58,237,0.4)' : 'none',
      opacity: idx === cur ? 1 : 0.7, transition: 'all 0.15s',
    }),
    thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    thumbBadge: {
      position: 'absolute', top: 2, right: 2, width: 14, height: 14,
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.55rem', fontWeight: 900,
    },
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (loadingImages) {
    return (
      <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
        <span style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: '0.85rem' }}>
          Loading images…
        </span>
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

        {/* Model scope — decides which models the picker below lists */}
        <div style={S.modeToggle}>
          <button style={S.modeBtn(modelScope === 'project')} onClick={() => handleScopeChange('project')}>
            Local ({projectModels.length})
          </button>
          <button style={S.modeBtn(modelScope === 'global')} onClick={() => handleScopeChange('global')}>
            Global ({globalModels.length})
          </button>
        </div>

        {/* Model picker — only models of the selected scope */}
        <Select
          value={selectedModelId}
          onChange={setSelectedModelId}
          placeholder={modelScope === 'project' ? 'Select local model…' : 'Select global model…'}
          style={S.modelSelect}
          size="small"
          dropdownStyle={{ background: '#1e293b', border: '1px solid rgba(124,58,237,0.3)' }}
          notFoundContent={
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
              No {modelScope === 'project' ? 'local' : 'global'} models
            </span>
          }
        >
          {visibleModels.map(m => (
            <Select.Option key={m.id} value={m.id}>
              <span style={{ fontWeight: 700 }}>{m.name}</span>
              {m.type === 'trained' && (
                <Tag color="purple" style={{ marginLeft: 5, fontSize: '0.6rem' }}>Trained</Tag>
              )}
            </Select.Option>
          ))}
        </Select>

        {/* Normal / SAHI mode toggle */}
        <div style={S.modeToggle}>
          <button style={S.modeBtn(predictionMode === 'normal')} onClick={() => setPredictionMode('normal')}>
            Normal
          </button>
          <button style={S.modeBtn(predictionMode === 'sahi')} onClick={() => setPredictionMode('sahi')}>
            SAHI
          </button>
        </div>

        {/* Confidence — slider + input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={S.confLabel}>CONF</span>
          <Slider min={1} max={99} step={1} value={Math.round(confidence * 100)}
            onChange={v => setConfidence(v / 100)}
            style={{ width: 60 }} tooltip={{ formatter: v => `${v}%` }} />
          <InputNumber
            min={1} max={99} step={1} value={Math.round(confidence * 100)}
            onChange={v => v != null && setConfidence(Math.min(0.99, Math.max(0.01, v / 100)))}
            formatter={v => `${v}%`} parser={v => v.replace('%', '')}
            size="small" style={S.numInput} controls={false} className="al-num-input" />
        </div>

        {/* IOU (normal mode) or Slice size (SAHI mode) — slider + input */}
        {predictionMode === 'normal' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={S.confLabel}>IOU</span>
            <Slider min={1} max={95} step={1} value={Math.round(iou * 100)}
              onChange={v => setIou(v / 100)}
              style={{ width: 55 }} tooltip={{ formatter: v => `${v}%` }} />
            <InputNumber
              min={1} max={95} step={1} value={Math.round(iou * 100)}
              onChange={v => v != null && setIou(Math.min(0.95, Math.max(0.01, v / 100)))}
              formatter={v => `${v}%`} parser={v => v.replace('%', '')}
              size="small" style={S.numInput} controls={false} className="al-num-input" />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ ...S.confLabel, color: '#38bdf8' }}>SLICE</span>
            <Slider min={256} max={4096} step={64} value={sliceSize}
              onChange={setSliceSize}
              style={{ width: 70 }} tooltip={{ formatter: v => `${v}px` }} />
            <InputNumber
              min={32} step={64} value={sliceSize}
              onChange={v => v != null && setSliceSize(Math.max(32, v))}
              formatter={v => `${v}px`} parser={v => parseInt(v.replace('px', ''), 10) || 256}
              size="small" style={{ ...S.numInput, width: 72 }} controls={false}
              className="al-num-input sahi" />
          </div>
        )}

        <div style={S.spacer} />

        <Button icon={<PlayCircleOutlined />} loading={isRunning}
          disabled={!selectedModelId || isRunningAll}
          onClick={() => runPreview()} style={S.runBtn} size="small">
          Run Image
        </Button>

        <Button icon={<ThunderboltOutlined />} loading={isRunningAll}
          disabled={!selectedModelId || isRunning}
          onClick={runAll} style={S.runAllBtn} size="small">
          {isRunningAll
            ? `${batchProgress.current}/${batchProgress.total}`
            : 'Run All'}
        </Button>

        <Button icon={<SaveOutlined />} loading={isSaving}
          disabled={!isDirty || isSaving}
          onClick={saveCurrentImage} style={S.saveBtn} size="small">
          Save ({totalPreds})
        </Button>
      </div>

      {/* ── MAIN ── */}
      <div style={S.main}>

        {/* LEFT PANEL — tools + annotation list */}
        <div style={S.leftPanel}>

          {/* Tool strip */}
          <div style={S.toolStrip}>
            <div style={S.toolRow}>
              {[
                { key: 'select',  label: 'Select',  Icon: DragOutlined },
                { key: 'box',     label: 'Box',     Icon: BorderOutlined },
                { key: 'polygon', label: 'Polygon', Icon: ExpandOutlined },
                { key: 'smart_polygon', label: 'Smart', Icon: ThunderboltOutlined },
                { key: 'null',    label: 'Null',    Icon: BlockOutlined },
              ].map(({ key, label, Icon }) => (
                <Tooltip key={key} title={label} placement="bottom">
                  <button
                    style={S.toolBtn(activeTool === key)}
                    onClick={() => setActiveTool(key)}
                  >
                    <Icon style={S.toolBtnIcon} />
                    <span style={S.toolBtnLabel}>{label}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
            <div style={S.zoomRow}>
              <button style={S.zoomBtn} onClick={() => setZoomLevel(z => Math.max(10, z - 25))}>
                <ZoomOutOutlined />
              </button>
              <span style={S.zoomVal}>{zoomLevel}%</span>
              <button style={S.zoomBtn} onClick={() => setZoomLevel(z => Math.min(500, z + 25))}>
                <ZoomInOutlined />
              </button>
            </div>
          </div>

          <div style={S.leftHeader}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={S.predTitle}>Annotations</span>
              <span style={{
                background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)',
                color: '#c4b5fd', borderRadius: 12, padding: '1px 8px',
                fontSize: '0.68rem', fontWeight: 900,
              }}>
                {totalPreds}
              </span>
            </div>

            {/* SAHI extra params */}
            {predictionMode === 'sahi' && (
              <div style={{
                marginTop: 8, padding: '0.5rem 0.6rem',
                background: 'rgba(14,165,233,0.08)', borderRadius: 8,
                border: '1px solid rgba(14,165,233,0.2)',
              }}>
                <span style={{
                  color: '#38bdf8', fontSize: '0.62rem', fontWeight: 900,
                  display: 'block', marginBottom: 6, letterSpacing: '0.06em',
                }}>
                  SAHI — Overlap
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <Slider min={5} max={50} step={1} value={Math.round(overlapRatio * 100)}
                    onChange={v => setOverlapRatio(v / 100)}
                    style={{ flex: 1, margin: 0 }}
                    tooltip={{ formatter: v => `${v}%` }} />
                  <InputNumber
                    min={5} max={50} step={1} value={Math.round(overlapRatio * 100)}
                    onChange={v => v != null && setOverlapRatio(Math.min(0.5, Math.max(0.05, v / 100)))}
                    formatter={v => `${v}%`} parser={v => parseInt(v.replace('%', ''), 10) || 25}
                    size="small" controls={false}
                    className="al-num-input sahi"
                    style={{ width: 52, fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8',
                      background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.3)',
                      borderRadius: 6 }} />
                </div>

                <span style={{
                  color: '#38bdf8', fontSize: '0.62rem', fontWeight: 900,
                  display: 'block', margin: '8px 0 6px', letterSpacing: '0.06em',
                }}>
                  SAHI — Merge Threshold
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <Slider min={5} max={95} step={1} value={Math.round(mergeThreshold * 100)}
                    onChange={v => setMergeThreshold(v / 100)}
                    style={{ flex: 1, margin: 0 }}
                    tooltip={{ formatter: v => `${v}%` }} />
                  <InputNumber
                    min={5} max={95} step={1} value={Math.round(mergeThreshold * 100)}
                    onChange={v => v != null && setMergeThreshold(Math.min(0.95, Math.max(0.05, v / 100)))}
                    formatter={v => `${v}%`} parser={v => parseInt(v.replace('%', ''), 10) || 20}
                    size="small" controls={false}
                    className="al-num-input sahi"
                    style={{ width: 52, fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8',
                      background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.3)',
                      borderRadius: 6 }} />
                </div>

                <span style={{
                  color: '#38bdf8', fontSize: '0.62rem', fontWeight: 900,
                  display: 'block', margin: '8px 0 6px', letterSpacing: '0.06em',
                }} title="Joins same-class detections that are close but don't touch — fixes long thin cracks cut apart at tile edges. 0 = off.">
                  SAHI — Stitch Distance
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <Slider min={0} max={150} step={5} value={stitchDistance}
                    onChange={setStitchDistance}
                    style={{ flex: 1, margin: 0 }}
                    tooltip={{ formatter: v => `${v}px` }} />
                  <InputNumber
                    min={0} max={150} step={5} value={stitchDistance}
                    onChange={v => v != null && setStitchDistance(Math.min(150, Math.max(0, v)))}
                    formatter={v => `${v}px`} parser={v => parseInt(String(v).replace('px', ''), 10) || 0}
                    size="small" controls={false}
                    className="al-num-input sahi"
                    style={{ width: 56, fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8',
                      background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.3)',
                      borderRadius: 6 }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}
                  title="Combine detections that truly overlap (same real spot) into one. Off shows SAHI's raw, untouched predictions for overlapping cases.">
                  <Switch size="small" checked={removeDuplicates} onChange={setRemoveDuplicates} />
                  <span style={{ color: '#38bdf8', fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.06em' }}>
                    SAHI — Remove Duplicates
                  </span>
                </div>

                {removeDuplicates && (
                  <>
                    <span style={{
                      color: '#38bdf8', fontSize: '0.62rem', fontWeight: 900,
                      display: 'block', margin: '8px 0 6px', letterSpacing: '0.06em',
                    }} title="How much two detections must overlap to count as the same spot. Measured as shared area ÷ smaller box area (not IoU). Lower = merges more easily.">
                      SAHI — Duplicate Overlap %
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <Slider min={1} max={100} step={1} value={Math.round(duplicateOverlap * 100)}
                        onChange={v => setDuplicateOverlap(v / 100)}
                        style={{ flex: 1, margin: 0 }}
                        tooltip={{ formatter: v => `${v}%` }} />
                      <InputNumber
                        min={1} max={100} step={1} value={Math.round(duplicateOverlap * 100)}
                        onChange={v => v != null && setDuplicateOverlap(Math.min(100, Math.max(1, v)) / 100)}
                        formatter={v => `${v}%`} parser={v => parseInt(String(v).replace('%', ''), 10) || 0}
                        size="small" controls={false}
                        className="al-num-input sahi"
                        style={{ width: 56, fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8',
                          background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.3)',
                          borderRadius: 6 }} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Existing vs new badges */}
            {(existingCount > 0 || newCount > 0) && (
              <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                {existingCount > 0 && (
                  <span style={{
                    background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
                    color: '#60a5fa', borderRadius: 10, padding: '1px 7px',
                    fontSize: '0.62rem', fontWeight: 800,
                  }}>
                    {existingCount} existing
                  </span>
                )}
                {newCount > 0 && (
                  <span style={{
                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
                    color: '#c4b5fd', borderRadius: 10, padding: '1px 7px',
                    fontSize: '0.62rem', fontWeight: 800,
                  }}>
                    {newCount} new
                  </span>
                )}
              </div>
            )}

            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Spin size="small" />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>
                  Running {predictionMode === 'sahi' ? 'SAHI' : 'model'}…
                </span>
              </div>
            )}
            {isRunningAll && (
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={Math.round((batchProgress.current / batchProgress.total) * 100)}
                  size="small" strokeColor="#7c3aed" trailColor="rgba(255,255,255,0.08)"
                  format={() => (
                    <span style={{ color: '#c4b5fd', fontSize: '0.65rem' }}>
                      {batchProgress.current}/{batchProgress.total}
                    </span>
                  )}
                />
              </div>
            )}
          </div>

          <div style={S.predList}>
            {draftAnnotations.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                <RobotOutlined style={{
                  fontSize: '1.8rem', color: 'rgba(255,255,255,0.12)',
                  display: 'block', marginBottom: 8,
                }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>
                  {isRunning ? 'Predicting…' : 'Run model to see predictions'}
                </span>
              </div>
            ) : (
              [...draftAnnotations]
                .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                .map((ann) => (
                  <div key={ann.id} style={S.predItem(ann)}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: ann.isExisting ? '#60a5fa' : confColor(ann.confidence || 1),
                    }} />
                    <span style={S.predClass}>{ann.class_name}</span>
                    <span style={{
                      color: ann.isExisting ? '#60a5fa' : confColor(ann.confidence || 1),
                      fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
                    }}>
                      {ann.isExisting ? 'DB' : (ann.confidence != null
                        ? `${Math.round(ann.confidence * 100)}%` : '—')}
                    </span>
                    <Tooltip title={ann.isExisting
                      ? 'Remove (deletes from DB on Save)'
                      : 'Remove prediction'}>
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
              <Button size="small" danger ghost icon={<DeleteOutlined />}
                onClick={handleClearAll} style={{ borderRadius: 7, fontWeight: 700 }}>
                Clear All
              </Button>
            )}
            <Button size="small" icon={<ReloadOutlined />}
              disabled={!selectedModelId || isRunning || isRunningAll}
              loading={isRunning} onClick={() => runPreview()}
              style={{ borderRadius: 7, fontWeight: 700, borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' }}
              ghost>
              Re-run on this image
            </Button>
          </div>
        </div>

        {/* CENTER — canvas */}
        <div style={S.canvasWrap}>
          <div style={S.canvasToolbar}>
            <span style={{
              background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.45)',
              color: '#c4b5fd', borderRadius: 20, padding: '2px 11px',
              fontSize: '0.78rem', fontWeight: 800, whiteSpace: 'nowrap',
            }}>
              {images.length ? currentIndex + 1 : 0} / {images.length}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              ← → keys
            </span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', fontWeight: 700 }}>
              {currentImage?.filename || '—'}
            </span>
            <div style={{ flex: 1 }} />
            {predictionMode === 'sahi' && (
              <span style={{
                background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)',
                color: '#38bdf8', borderRadius: 20, padding: '2px 9px',
                fontSize: '0.65rem', fontWeight: 800,
              }}>
                SAHI {sliceSize}px
              </span>
            )}
            {savedImageIds.has(currentImage?.id) && (
              <span style={{
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                color: '#10b981', borderRadius: 20, padding: '2px 10px',
                fontSize: '0.68rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <CheckCircleOutlined style={{ fontSize: '0.7rem' }} /> Saved
              </span>
            )}
          </div>

          <div style={S.canvasViewport}>
            {!currentImage ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>No images in this batch</span>
                } />
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
                onAnnotationSelect={handleAnnotationSelect}
                polygonEditMode={selectedAnnotation?.type === 'polygon'}
                editableAnnotation={selectedAnnotation?.type === 'polygon' ? selectedAnnotation : null}
                onPolygonEditChange={handlePolygonEditChange}
              />
            )}
          </div>

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
                  src={getThumbnailUrl(img)}
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
