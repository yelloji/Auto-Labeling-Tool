import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Button, Row, Col, ConfigProvider, Affix, Steps, Tabs, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { logInfo } from '../../../utils/professional_logger';
import ModeToggle from './ModeToggle/ModeToggle';
import IdentitySection from './Identity/IdentitySection';
import FrameworkTaskSection from './FrameworkTask/FrameworkTaskSection';
import PretrainedModelSelect from './PretrainedModel/PretrainedModelSelect';
import TrainingDatasetSection from './TrainingDataset/TrainingDatasetSection';
import PresetSection from './Preset/PresetSection';
import './compact.css';
import { trainingAPI, releasesAPI } from '../../../services/api';
import TerminalPanel from './Terminal/TerminalPanel';
import LiveTrainingDashboard from './Dashboard/LiveTrainingDashboard';
import TrainingInitializing from './Dashboard/TrainingInitializing';

const { Title, Text } = Typography;

// Simple initial state model (will be moved into a hook later)
const initialFormState = {
  mode: 'user',
  projectId: '',
  trainingName: '',
  description: '',
  framework: 'ultralytics',
  taskType: 'segmentation',
  pretrainedModel: '',
  datasetSource: 'release_zip',
  datasetReleaseId: null,
  datasetZipPath: '',
  datasetReleaseDir: '',
  classes: [],
  epochs: 50,
  imgSize: 640,
  batchSize: 2,
  mixedPrecision: true,
  earlyStop: true,
  saveBestOnly: true,
  resume: false,
  device: 'cpu',
  gpuIndex: null,
  optimizerMode: 'smart-auto',
  warmup_momentum: 0.8,
  warmup_bias_lr: 0.1,
  cos_lr: false,
  val_plots: true,
  hydratedIdentity: false
};

const ModelTrainingSection = ({ projectId, project }) => {
  useEffect(() => {
    logInfo('app.frontend.ui', 'model_training_section_initialized', 'ModelTrainingSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ModelTrainingSection',
      projectId
    });
  }, [projectId]);



  const [form, setForm] = useState({ ...initialFormState, projectId, sessionId: null, status: 'queued' });
  const [activeTab, setActiveTab] = useState('config');
  const [serverConfig, setServerConfig] = useState({});
  const isTraining = form.status === 'running';
  const isDeveloper = form.mode === 'developer';
  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const [consoleVisible, setConsoleVisible] = useState(false);

  // Refs to track previous values for Early Stop / Patience sync
  const prevEarlyStop = React.useRef(form.earlyStop);
  const prevPatience = React.useRef(form.patience);

  useEffect(() => {
    if (projectId && projectId !== form.projectId) {
      setForm((prev) => ({ ...prev, projectId }));
    }
  }, [projectId, form.projectId]);

  // Persist identity while status is queued (name/description)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if (!form.projectId || !form.trainingName || form.trainingName.length < 3) return;
        if (!form.hydratedIdentity) return;
        const payload = { projectId: form.projectId, name: form.trainingName };
        if (typeof form.description === 'string' && form.description.trim().length) {
          payload.description = form.description;
        }
        await trainingAPI.upsertSession(payload);
        try {
          const sess = await trainingAPI.getSession({ projectId: form.projectId, name: form.trainingName });
          if (sess && sess.id) {
            setForm((prev) => ({ ...prev, sessionId: sess.id, status: sess.status || prev.status }));
          }
        } catch (_) { }
      } catch (_) { }
    }, 200);
    return () => clearTimeout(timer);
  }, [form.projectId, form.trainingName, form.description, form.hydratedIdentity]);

  useEffect(() => {
    const resumeActive = async () => {
      try {
        if (!form.projectId || form.trainingName) return;
        const data = await trainingAPI.getActiveSession(form.projectId);
        if (data && data.name) {
          setForm((prev) => ({ ...prev, trainingName: data.name }));
        }
      } catch (_) { }
    };
    resumeActive();
  }, [form.projectId, form.trainingName]);

  // Poll for live metrics every 1 second during training 
  useEffect(() => {

    if (!form.sessionId) return;

    // Stop polling if training is completed (to preserve final metrics)
    const interval = setInterval(async () => {
      try {
        const session = await trainingAPI.getSession({ projectId: form.projectId, name: form.trainingName });
        if (session?.metrics_json) {
          const newMetrics = JSON.parse(session.metrics_json);
          setForm(prev => ({
            ...prev,
            liveMetrics: newMetrics,
            status: session.status || prev.status,
            finalMetricsFetched: session.status === 'completed'
          }));
          // Stop polling after fetching completed metrics
          if (session.status === 'completed') {
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error('Failed to fetch metrics:', e);
      }
    }, 500);
    return () => clearInterval(interval);

  }, [form.sessionId, form.projectId, form.trainingName]);

  // Clear live metrics only when user enters a NEW training name (not empty)
  const prevTrainingName = React.useRef(form.trainingName);
  useEffect(() => {
    // Only clear if:
    // 1. Previous name existed
    // 2. New name is different
    // 3. New name is NOT empty (not a reset)
    if (prevTrainingName.current &&
      prevTrainingName.current !== form.trainingName &&
      form.trainingName.trim().length > 0) {
      setForm(prev => ({ ...prev, liveMetrics: null }));
    }
    prevTrainingName.current = form.trainingName;
  }, [form.trainingName]);

  // Load last completed training's metrics on page mount
  useEffect(() => {
    const loadLastMetrics = async (retryCount = 0) => {
      try {
        if (!form.projectId || form.liveMetrics) return;

        const response = await fetch(`/api/v1/projects/${form.projectId}/training/last-completed`);
        if (response.ok) {
          const session = await response.json();
          if (session?.metrics_json) {
            setForm(prev => ({
              ...prev,
              liveMetrics: JSON.parse(session.metrics_json),
              status: 'completed'
            }));
          }
        }
      } catch (e) {
        console.error('Failed to load last metrics:', e);
        // Retry once if first attempt fails
        if (retryCount < 1) {
          setTimeout(() => loadLastMetrics(retryCount + 1), 2000);
        }
      }
    };

    loadLastMetrics();
  }, [form.projectId]);

  useEffect(() => {
    const maybeExtract = async () => {
      try {
        if (!form.sessionId) return;
        if (!form.projectId || !form.trainingName || !form.datasetZipPath) return;
        if (!form.hydratedIdentity) return;
        const res = await trainingAPI.updateSessionDatasetFromZip({
          projectId: form.projectId,
          name: form.trainingName,
          zipPath: form.datasetZipPath,
        });
        const patch = {};
        if (res && typeof res.dataset_release_dir === 'string' && res.dataset_release_dir.length) {
          patch.datasetReleaseDir = res.dataset_release_dir;
        }
        if (res && typeof res.dataset_release_id !== 'undefined' && res.dataset_release_id !== null) {
          patch.datasetReleaseId = String(res.dataset_release_id);
        }
        if (Object.keys(patch).length) {
          setForm(prev => ({ ...prev, ...patch }));
        }
      } catch (_) { }
    };
    maybeExtract();
  }, [form.sessionId]);

  // Poll for status updates when running
  useEffect(() => {
    if (!isTraining || !form.projectId || !form.trainingName) return;

    const timer = setInterval(async () => {
      try {
        const sess = await trainingAPI.getSession({ projectId: form.projectId, name: form.trainingName });
        if (sess && sess.status && sess.status !== form.status) {
          setForm(prev => ({ ...prev, status: sess.status }));
        }
      } catch (e) { }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(timer);
  }, [isTraining, form.projectId, form.trainingName, form.status]);



  // Reset form when training completes
  useEffect(() => {
    // Track previous training state
    const wasTraining = sessionStorage.getItem('wasTraining') === 'true';

    if (wasTraining && !isTraining && (form.status === 'completed' || form.status === 'failed')) {
      // Training just finished - reset form to initial state
      setForm(prev => ({ ...initialFormState, projectId, sessionId: null, status: 'queued', liveMetrics: prev.liveMetrics }));
      sessionStorage.removeItem('wasTraining');

      logInfo('app.frontend.ui', 'training_completed_form_reset', 'Form reset after training completion', {
        timestamp: new Date().toISOString()
      });
    }

    // Update tracking flag
    if (isTraining) {
      sessionStorage.setItem('wasTraining', 'true');
    }
  }, [isTraining, form.status, projectId]);


  // Persist selected model/framework/task
  useEffect(() => {
    const saveModel = async () => {
      try {
        if (!form.projectId || !form.trainingName) return;
        if (!form.hydratedIdentity) return;
        const hasModel = typeof form.pretrainedModel === 'string' && form.pretrainedModel.trim().length;
        const hasFramework = typeof form.framework === 'string' && form.framework.trim().length;
        const hasTask = typeof form.taskType === 'string' && form.taskType.trim().length;
        if (!(hasModel || hasFramework || hasTask)) return;
        const payload = { projectId: form.projectId, name: form.trainingName };
        if (hasModel) {
          payload.baseModelId = form.pretrainedModel;
          payload.modelName = form.pretrainedModel;
        }
        if (hasFramework) payload.framework = form.framework;
        if (hasTask) payload.task = form.taskType;
        await trainingAPI.updateSessionModel(payload);
      } catch (_) { }
    };
    saveModel();
  }, [form.projectId, form.trainingName, form.pretrainedModel, form.framework, form.taskType, form.hydratedIdentity]);

  // Persist dataset selection from zip: extract if needed, save dir + summary
  useEffect(() => {
    const saveDataset = async () => {
      try {
        if (!form.projectId || !form.trainingName || !form.datasetZipPath) return;
        if (!form.hydratedIdentity) return;
        const res = await trainingAPI.updateSessionDatasetFromZip({
          projectId: form.projectId,
          name: form.trainingName,
          zipPath: form.datasetZipPath,
        });
        const patch = {};
        if (res && typeof res.dataset_release_dir === 'string' && res.dataset_release_dir.length) {
          patch.datasetReleaseDir = res.dataset_release_dir;
        }
        if (res && typeof res.dataset_release_id !== 'undefined' && res.dataset_release_id !== null) {
          patch.datasetReleaseId = String(res.dataset_release_id);
        }
        if (Object.keys(patch).length) {
          setForm(prev => ({ ...prev, ...patch }));
        }
      } catch (_) { }
    };
    saveDataset();
  }, [form.projectId, form.trainingName, form.datasetZipPath, form.hydratedIdentity]);

  // Synchronize Early Stop switch with Patience value
  useEffect(() => {
    if (!form.hydratedIdentity) return; // Don't run during initial hydration

    // Detect what changed
    const earlyStopChanged = prevEarlyStop.current !== form.earlyStop;
    const patienceChanged = prevPatience.current !== form.patience;

    // Rule 3: If user toggled earlyStop to ON and patience is 0, set patience to 30
    if (earlyStopChanged && form.earlyStop === true && (typeof form.patience !== 'number' || form.patience === 0)) {
      setForm(prev => ({ ...prev, patience: 30 }));
    }
    // Rule 1: If user changed patience to 0, turn off earlyStop
    else if (patienceChanged && form.patience === 0 && form.earlyStop === true) {
      setForm(prev => ({ ...prev, earlyStop: false }));
    }

    // Update refs for next comparison
    prevEarlyStop.current = form.earlyStop;
    prevPatience.current = form.patience;
  }, [form.patience, form.earlyStop, form.hydratedIdentity]);

  // Auto-recalculate smart-auto optimizer when device or batch size changes
  useEffect(() => {
    if (!form.hydratedIdentity) return; // Don't run during initial hydration
    if (form.optimizerMode !== 'smart-auto') return; // Only for smart-auto mode

    const isGPU = form.device === 'gpu';
    const bsz = typeof form.batchSize === 'number' ? form.batchSize : 0;
    let picked = 'AdamW';
    let rec = { lr0: 0.0007, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005 };

    if (!isGPU) {
      picked = 'Adam';
      rec = { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 };
    } else if (bsz >= 32) {
      picked = 'SGD';
      rec = { lr0: 0.01, lrf: 0.1, momentum: 0.937, weight_decay: 0.0005 };
    }

    // Only update if the optimizer actually changed
    if (form.optimizer !== picked) {
      setForm(prev => ({ ...prev, optimizer: picked, ...rec }));
    }
  }, [form.device, form.batchSize, form.optimizerMode, form.optimizer, form.hydratedIdentity]);

  // Auto-load resolved config and hydrate UI when returning (status=queued)
  useEffect(() => {
    const loadSession = async () => {
      try {
        if (!form.projectId || !form.trainingName) return;
        const data = await trainingAPI.getSession({ projectId: form.projectId, name: form.trainingName });
        const patch = {};
        if (data && typeof data.resolved_config_json === 'string' && data.resolved_config_json.length) {
          try {
            const cfg = JSON.parse(data.resolved_config_json);
            const t = cfg?.train || {};
            const h = cfg?.hyperparameters || {};
            const a = cfg?.augmentation || {};
            const v = cfg?.val || {};
            const d = cfg?.dataset || {};
            // Helper to check if value is defined and not null (allows 0, false, etc.)
            const isValidValue = (v) => v !== undefined && v !== null;

            if (isValidValue(t.epochs)) patch.epochs = t.epochs;
            if (isValidValue(t.imgsz)) patch.imgSize = t.imgsz;
            if (isValidValue(t.batch)) patch.batchSize = t.batch;
            if (isValidValue(t.amp)) patch.mixedPrecision = t.amp;
            if (isValidValue(t.early_stop)) patch.earlyStop = t.early_stop;
            if (isValidValue(t.save_best)) patch.saveBestOnly = t.save_best;
            if (isValidValue(t.model)) patch.pretrainedModel = t.model;
            if (typeof t.device === 'string') {
              if (t.device.startsWith('cuda:')) {
                patch.device = 'gpu';
                const gi = Number(t.device.replace('cuda:', ''));
                if (!Number.isNaN(gi)) patch.gpuIndex = gi;
              } else {
                patch.device = 'cpu';
                patch.gpuIndex = null;
              }
            }
            if (isValidValue(t.resume)) patch.resume = t.resume;

            // Optimizer Hydration
            if (isValidValue(t.optimizer)) {
              patch.optimizer = t.optimizer;
              // Check if this optimizer matches the "Smart Auto" default
              const isGPU = (patch.device || form.device) === 'gpu';
              const bsz = (patch.batchSize || form.batchSize);
              let smartDefault = 'Adam';
              if (!isGPU) smartDefault = 'Adam';
              else if (bsz >= 32) smartDefault = 'SGD';
              else smartDefault = 'AdamW';

              if (t.optimizer !== smartDefault) {
                patch.optimizerMode = 'manual';
              } else {
                // If it matches smart default, we can leave it as smart-auto OR set to manual. 
                // To be safe and preserve user intent, if it's explicitly saved, we could set manual, 
                // but usually 'smart-auto' is preferred if it matches. 
                // Let's stick to: if it differs, force manual.
              }
            }

            if (isValidValue(t.single_cls)) patch.single_cls = t.single_cls;
            if (isValidValue(t.rect)) patch.rect = t.rect;
            if (isValidValue(t.overlap_mask)) patch.overlap_mask = t.overlap_mask;
            if (isValidValue(t.mask_ratio)) patch.mask_ratio = t.mask_ratio;
            if (isValidValue(t.freeze)) patch.freeze = t.freeze;

            // Hydrate Root/Train params that might be missing
            if (isValidValue(t.patience)) patch.patience = t.patience;
            else if (isValidValue(cfg.patience)) patch.patience = cfg.patience;

            if (isValidValue(t.save_period)) patch.save_period = t.save_period;
            else if (isValidValue(cfg.save_period)) patch.save_period = cfg.save_period;

            if (isValidValue(t.workers)) patch.workers = t.workers;
            else if (isValidValue(cfg.workers)) patch.workers = cfg.workers;

            if (typeof t.data === 'string') {
              const normalizedData = t.data.replace(/\\/g, '/');
              if (normalizedData.endsWith('/data.yaml')) {
                const baseDir = t.data.slice(0, -('/data.yaml'.length));
                if (baseDir.length) patch.datasetReleaseDir = baseDir;
              }
            }

            if (isValidValue(h.lr0)) patch.lr0 = h.lr0;
            if (isValidValue(h.lrf)) patch.lrf = h.lrf;
            if (isValidValue(h.momentum)) patch.momentum = h.momentum;
            if (isValidValue(h.weight_decay)) patch.weight_decay = h.weight_decay;
            if (isValidValue(h.warmup_epochs)) patch.warmup_epochs = h.warmup_epochs;
            if (isValidValue(h.warmup_momentum)) patch.warmup_momentum = h.warmup_momentum;
            if (isValidValue(h.warmup_bias_lr)) patch.warmup_bias_lr = h.warmup_bias_lr;

            // cos_lr might be in hyperparameters OR train/root depending on version
            if (isValidValue(h.cos_lr)) patch.cos_lr = h.cos_lr;
            else if (isValidValue(t.cos_lr)) patch.cos_lr = t.cos_lr;
            else if (isValidValue(cfg.cos_lr)) patch.cos_lr = cfg.cos_lr;

            if (isValidValue(h.box)) patch.box = h.box;
            if (isValidValue(h.cls)) patch.cls = h.cls;
            if (isValidValue(h.dfl)) patch.dfl = h.dfl;

            if (isValidValue(a.mosaic)) patch.mosaic = a.mosaic;
            if (isValidValue(a.mixup)) patch.mixup = a.mixup;
            if (isValidValue(a.hsv_h)) patch.hsv_h = a.hsv_h;
            if (isValidValue(a.hsv_s)) patch.hsv_s = a.hsv_s;
            if (isValidValue(a.hsv_v)) patch.hsv_v = a.hsv_v;
            if (isValidValue(a.flipud)) patch.flipud = a.flipud;
            if (isValidValue(a.fliplr)) patch.fliplr = a.fliplr;
            if (isValidValue(a.degrees)) patch.degrees = a.degrees;
            if (isValidValue(a.translate)) patch.translate = a.translate;
            if (isValidValue(a.scale)) patch.scale = a.scale;
            if (isValidValue(a.shear)) patch.shear = a.shear;
            if (isValidValue(a.perspective)) patch.perspective = a.perspective;
            if (isValidValue(a.close_mosaic)) patch.close_mosaic = a.close_mosaic;

            if (isValidValue(v.iou)) patch.val_iou = v.iou;
            if (isValidValue(v.conf)) patch.val_conf = v.conf;
            if (isValidValue(v.plots)) patch.val_plots = v.plots;
            if (isValidValue(v.max_det)) patch.max_det = v.max_det;
            if (Array.isArray(d.classes)) patch.classes = d.classes;
            window.__resolvedServerConfig = cfg;
            if (typeof cfg.framework === 'string') patch.framework = cfg.framework;
            if (typeof cfg.task === 'string') patch.taskType = cfg.task;
          } catch { }
        }
        if (data && typeof data.description === 'string') patch.description = data.description;
        if (data && typeof data.framework === 'string') patch.framework = data.framework;
        if (data && typeof data.task === 'string') patch.taskType = data.task;
        if (data && typeof data.model_name === 'string' && !(typeof patch.pretrainedModel === 'string' && patch.pretrainedModel.length)) {
          patch.pretrainedModel = data.model_name;
        }
        if (typeof data.dataset_release_dir === 'string' && data.dataset_release_dir.length) {
          patch.datasetReleaseDir = data.dataset_release_dir;
        }
        if (data && typeof data.dataset_release_id !== 'undefined' && data.dataset_release_id !== null) {
          try {
            const rels = await releasesAPI.getProjectReleases(form.projectId);
            const match = (Array.isArray(rels) ? rels : []).find((r) => String(r?.id) === String(data.dataset_release_id));
            const zp = String(match?.model_path || match?.path || match?.release_zip || match?.zip_path || '').trim();
            if (zp.length) patch.datasetZipPath = zp;
            patch.datasetReleaseId = String(data.dataset_release_id);
          } catch { }
        }
        patch.hydratedIdentity = true;
        setForm(prev => ({ ...prev, ...patch }));
      } catch { setForm(prev => ({ ...prev, hydratedIdentity: true })); }
    };
    loadSession();
  }, [form.projectId, form.trainingName]);

  // Auto-resolve and save config on UI changes
  useEffect(() => {
    const autoSaveConfig = async () => {
      try {
        if (!form.projectId || !form.trainingName) return;
        if (!form.hydratedIdentity) return;
        const trainOverrides = {
          model: form.pretrainedModel,
          epochs: form.epochs,
          imgsz: form.imgSize,
          batch: form.batchSize,
          amp: form.mixedPrecision,
          early_stop: form.earlyStop,
          resume: form.resume,
          optimizer: form.optimizer,
          single_cls: form.single_cls,
          rect: form.rect,
          overlap_mask: form.overlap_mask,
          mask_ratio: form.mask_ratio,
          freeze: form.freeze,
          device: form.device === 'gpu' && typeof form.gpuIndex === 'number' ? `cuda:${form.gpuIndex}` : 'cpu',
          patience: form.patience,
          save_period: form.save_period,
          workers: form.workers,
        };
        if (typeof form.datasetReleaseDir === 'string' && form.datasetReleaseDir.length) {
          trainOverrides.data = `${form.datasetReleaseDir}/data.yaml`;
        }
        const overrides = {
          train: trainOverrides,
          hyperparameters: {
            lr0: form.lr0,
            lrf: form.lrf,
            momentum: form.momentum,
            weight_decay: form.weight_decay,
            warmup_epochs: form.warmup_epochs,
            warmup_momentum: form.warmup_momentum,
            warmup_bias_lr: form.warmup_bias_lr,
            cos_lr: form.cos_lr,
            box: form.box,
            cls: form.cls,
            dfl: form.dfl,
          },
          augmentation: {
            mosaic: form.mosaic,
            close_mosaic: form.close_mosaic,
            mixup: form.mixup,
            hsv_h: form.hsv_h,
            hsv_s: form.hsv_s,
            hsv_v: form.hsv_v,
            flipud: form.flipud,
            fliplr: form.fliplr,
            degrees: form.degrees,
            translate: form.translate,
            scale: form.scale,
            shear: form.shear,
            perspective: form.perspective,
          },
          val: {
            iou: form.val_iou,
            conf: form.val_conf,
            plots: form.val_plots,
            max_det: form.max_det,
          },
          // omit dataset from config preview; use train.data (data.yaml)
        };
        const res = await trainingAPI.resolveConfig(form.framework, form.taskType, overrides);
        const resolved = res?.resolved || overrides;
        setServerConfig(overrides);  // ← ADD THIS LINE
        window.__resolvedServerConfig = overrides;
        window.__argsPreview = (res?.preview?.args || []);
        await trainingAPI.saveSessionConfig({
          projectId: form.projectId,
          name: form.trainingName,
          resolvedConfig: overrides,
        });
      } catch { }
    };
    autoSaveConfig();
  }, [
    form.projectId,
    form.trainingName,
    form.hydratedIdentity,
    form.framework,
    form.taskType,
    form.pretrainedModel,
    form.epochs,
    form.imgSize,
    form.batchSize,
    form.mixedPrecision,
    form.earlyStop,
    form.resume,
    form.optimizer,
    form.single_cls,
    form.rect,
    form.overlap_mask,
    form.mask_ratio,
    form.freeze,
    form.device,
    form.gpuIndex,
    form.lr0,
    form.lrf,
    form.momentum,
    form.weight_decay,
    form.warmup_epochs,
    form.warmup_momentum,
    form.warmup_bias_lr,
    form.cos_lr,
    form.patience,
    form.save_period,
    form.workers,
    form.box,
    form.cls,
    form.dfl,
    form.mosaic,
    form.close_mosaic,
    form.mixup,
    form.hsv_h,
    form.hsv_s,
    form.hsv_v,
    form.flipud,
    form.fliplr,
    form.degrees,
    form.translate,
    form.scale,
    form.shear,
    form.perspective,
    form.val_iou,
    form.val_conf,
    form.val_plots,
    form.max_det,
    form.datasetZipPath,
    form.classes,
    form.datasetReleaseDir,
  ]);

  const resolvedConfig = useMemo(() => ({
    project_id: form.projectId,
    training_name: form.trainingName,
    framework: form.framework,
    task: form.taskType,
    train: (() => {
      const t = {
        epochs: form.epochs,
        imgsz: form.imgSize,
        batch: form.batchSize,
        amp: form.mixedPrecision,
        early_stop: form.earlyStop,
        resume: form.resume,
        save_best: form.saveBestOnly,
        model: form.pretrainedModel,
        device: form.device === 'gpu' && typeof form.gpuIndex === 'number' ? `cuda:${form.gpuIndex}` : 'cpu'
      };
      if (typeof form.datasetReleaseDir === 'string' && form.datasetReleaseDir.length) {
        t.data = `${form.datasetReleaseDir}/data.yaml`;
      }
      return t;
    })()
  }), [form]);
  // Config Preview: Extract only nested sections (user overrides)
  const configPreview = useMemo(() => {
    const cfg = serverConfig;  // ← CHANGED
    // Fallback to resolvedConfig if server config is missing, though resolvedConfig is incomplete (only train)
    const src = cfg || resolvedConfig;  // ← CHANGED (use cfg instead of serverConfig)
    if (src && typeof src === 'object') {
      return {
        train: src.train || {},
        hyperparameters: src.hyperparameters || {},
        augmentation: src.augmentation || {},
        val: src.val || {}
      };
    }
    return { train: {}, hyperparameters: {}, augmentation: {}, val: {} };
  }, [serverConfig, resolvedConfig]);

  const readiness = useMemo(() => ({
    nameReady: Boolean(form.trainingName),
    datasetReady: Boolean(form.datasetZipPath),
    modelReady: Boolean(form.pretrainedModel)
  }), [form]);

  const currentStep = useMemo(() => {
    if (!readiness.nameReady) return 0;
    if (!readiness.datasetReady) return 1;
    return 2;
  }, [readiness]);


  return (
    <div className="compact-mts" style={{ padding: 16 }}>
      <ConfigProvider
        size="small"
        theme={{
          token: {
            controlHeight: 28,
            fontSize: 13,
            paddingSM: 8,
          },
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            Model Training
          </Title>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isDeveloper && (
              <Button size="small" onClick={() => setConsoleVisible(true)}>AI Console</Button>
            )}
            <ModeToggle mode={form.mode} onChange={(mode) => handleChange({ mode })} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <Steps size="small" current={currentStep} items={[
            { title: 'Identity' },
            { title: 'Dataset' },
            { title: 'Train' },
          ]} />
        </div>
        {project && (
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>Project: {project.name}</Text>
        )}

        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={16}>
            <Card size="small" title="Identity" bodyStyle={{ padding: 12 }}>
              <IdentitySection
                trainingName={form.trainingName}
                description={form.description}
                onChange={(patch) => handleChange(patch)}
                disabled={isTraining}
              />
            </Card>

            <Card size="small" title="Framework & Task" bodyStyle={{ padding: 12 }} style={{ marginTop: 12 }}>
              <FrameworkTaskSection
                framework={form.framework}
                taskType={form.taskType}
                onChange={(patch) => handleChange(patch)}
                disabled={isTraining}
              />
              <PretrainedModelSelect
                framework={form.framework}
                taskType={form.taskType}
                projectId={form.projectId}
                value={form.pretrainedModel}
                onChange={(value) => handleChange({ pretrainedModel: value })}
                disabled={isTraining}
              />
            </Card>

            <Card size="small" title="Dataset" bodyStyle={{ padding: 12 }} style={{ marginTop: 12 }}>
              <TrainingDatasetSection
                projectId={project?.id || projectId || form.projectId}
                datasetSource={form.datasetSource}
                datasetReleaseId={form.datasetReleaseId}
                datasetZipPath={form.datasetZipPath}
                datasetReleaseDir={form.datasetReleaseDir}
                classes={form.classes}
                isDeveloper={isDeveloper}
                hydratedIdentity={form.hydratedIdentity}
                onChange={(patch) => handleChange(patch)}
              />
            </Card>

            <Card size="small" title="Training Preset" bodyStyle={{ padding: 12 }} style={{ marginTop: 12 }}>
              <PresetSection
                epochs={form.epochs}
                imgSize={form.imgSize}
                batchSize={form.batchSize}
                mixedPrecision={form.mixedPrecision}
                earlyStop={form.earlyStop}
                resume={form.resume}
                device={form.device}
                gpuIndex={form.gpuIndex}
                taskType={form.taskType}
                optimizerMode={form.optimizerMode}
                optimizer={form.optimizer}
                lr0={form.lr0}
                lrf={form.lrf}
                momentum={form.momentum}
                weight_decay={form.weight_decay}
                patience={form.patience}
                save_period={form.save_period}
                workers={form.workers}
                warmup_epochs={form.warmup_epochs}
                warmup_momentum={form.warmup_momentum}
                warmup_bias_lr={form.warmup_bias_lr}
                cos_lr={form.cos_lr}
                box={form.box}
                cls={form.cls}
                dfl={form.dfl}
                mosaic={form.mosaic}
                close_mosaic={form.close_mosaic}
                mixup={form.mixup}
                hsv_h={form.hsv_h}
                hsv_s={form.hsv_s}
                hsv_v={form.hsv_v}
                flipud={form.flipud}
                fliplr={form.fliplr}
                degrees={form.degrees}
                translate={form.translate}
                scale={form.scale}
                shear={form.shear}
                perspective={form.perspective}
                single_cls={form.single_cls}
                rect={form.rect}
                overlap_mask={form.overlap_mask}
                mask_ratio={form.mask_ratio}
                freeze={form.freeze}
                val_iou={form.val_iou}
                val_conf={form.val_conf}
                val_plots={form.val_plots}
                max_det={form.max_det}
                isDeveloper={isDeveloper}
                onChange={(patch) => handleChange(patch)}
                disabled={isTraining}
              />
            </Card>

          </Col>

          <Col span={8}>
            <Affix offsetTop={16}>
              <div>
                <Card size="small" bodyStyle={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Tag color={readiness.nameReady ? 'green' : 'red'}>Name</Tag>
                      <Tag color={readiness.datasetReady ? 'green' : 'red'}>Dataset</Tag>
                      <Tag color={readiness.modelReady ? 'green' : 'red'}>Model</Tag>
                    </div>

                  </div>
                  <Button type="primary" block style={{ marginTop: 8 }} disabled={!(readiness.nameReady && readiness.datasetReady && readiness.modelReady) || isTraining}
                    onClick={async () => {
                      try {
                        if (form.projectId && form.trainingName) {
                          setForm(prev => ({ ...prev, status: 'running' }));
                          await trainingAPI.startSession({ projectId: form.projectId, name: form.trainingName });
                          setActiveTab('status'); // Auto-switch to status tab
                        }
                      } catch (e) {
                        setForm(prev => ({ ...prev, status: 'queued' }));
                      }
                    }}
                  >{isTraining ? 'Training...' : 'Start Training'}</Button>
                </Card>
                <Card size="small" style={{ marginTop: 12 }} bodyStyle={{ padding: 12 }}>
                  <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    {
                      key: 'config',
                      label: 'Config Preview',
                      children: (
                        <div>
                          <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 4, maxHeight: 220, overflow: 'auto', margin: 0 }}>
                            {JSON.stringify(configPreview, null, 2)}
                          </pre>

                        </div>
                      )
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      children: (
                        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
                          {form.status === 'running' && (!form.liveMetrics || !form.liveMetrics.training || !form.liveMetrics.training.epoch) ? (
                               <TrainingInitializing />
                             ) : (
                               <LiveTrainingDashboard metrics={form.liveMetrics || {}} status={form.status} />
                             )}
                        </div>
                      )
                    }
                  ]} />
                </Card>
              </div>
            </Affix>
          </Col>
        </Row>
        {isDeveloper && consoleVisible && (
          <TerminalPanel projectId={form.projectId} trainingName={form.trainingName} visible={consoleVisible} autoPrompt onClose={() => setConsoleVisible(false)} />
        )}
      </ConfigProvider>
    </div>
  );
};

export default ModelTrainingSection;