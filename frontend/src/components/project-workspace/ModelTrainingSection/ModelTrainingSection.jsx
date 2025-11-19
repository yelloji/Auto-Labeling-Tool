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
  close_mosaic: null,
  device: 'cpu',
  gpuIndex: null,
  optimizerMode: 'smart-auto',
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
  const isDeveloper = form.mode === 'developer';
  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const [consoleVisible, setConsoleVisible] = useState(false);

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
        } catch (_) {}
      } catch (_) {}
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
      } catch (_) {}
    };
    resumeActive();
  }, [form.projectId, form.trainingName]);

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
      } catch (_) {}
    };
    maybeExtract();
  }, [form.sessionId]);

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
      } catch (_) {}
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
      } catch (_) {}
    };
    saveDataset();
  }, [form.projectId, form.trainingName, form.datasetZipPath, form.hydratedIdentity]);

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
            if (typeof t.epochs === 'number') patch.epochs = t.epochs;
            if (typeof t.imgsz === 'number') patch.imgSize = t.imgsz;
            if (typeof t.batch === 'number') patch.batchSize = t.batch;
            if (typeof t.amp === 'boolean') patch.mixedPrecision = t.amp;
            if (typeof t.early_stop === 'boolean') patch.earlyStop = t.early_stop;
            if (typeof t.save_best === 'boolean') patch.saveBestOnly = t.save_best;
            if (typeof t.model === 'string') patch.pretrainedModel = t.model;
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
            if (typeof t.resume === 'boolean') patch.resume = t.resume;
            if (typeof t.optimizer === 'string') patch.optimizer = t.optimizer;
            if (typeof t.single_cls === 'boolean') patch.single_cls = t.single_cls;
            if (typeof t.rect === 'boolean') patch.rect = t.rect;
            if (typeof t.overlap_mask === 'boolean') patch.overlap_mask = t.overlap_mask;
            if (typeof t.mask_ratio === 'number') patch.mask_ratio = t.mask_ratio;
            if (typeof t.freeze === 'number' || Array.isArray(t.freeze)) patch.freeze = t.freeze;
            if (typeof t.data === 'string' && t.data.endsWith('/data.yaml')) {
              const baseDir = t.data.slice(0, -('/data.yaml'.length));
              if (baseDir.length) patch.datasetReleaseDir = baseDir;
            }
            if (typeof h.lr0 === 'number') patch.lr0 = h.lr0;
            if (typeof h.lrf === 'number') patch.lrf = h.lrf;
            if (typeof h.momentum === 'number') patch.momentum = h.momentum;
            if (typeof h.weight_decay === 'number') patch.weight_decay = h.weight_decay;
            if (typeof h.warmup_epochs === 'number') patch.warmup_epochs = h.warmup_epochs;
            if (typeof h.warmup_momentum === 'number') patch.warmup_momentum = h.warmup_momentum;
            if (typeof h.warmup_bias_lr === 'number') patch.warmup_bias_lr = h.warmup_bias_lr;
            if (typeof h.cos_lr === 'boolean') patch.cos_lr = h.cos_lr;
            if (typeof h.box === 'number') patch.box = h.box;
            if (typeof h.cls === 'number') patch.cls = h.cls;
            if (typeof h.dfl === 'number') patch.dfl = h.dfl;
            if (typeof a.mosaic === 'boolean') patch.mosaic = a.mosaic;
            if (typeof a.mixup === 'boolean') patch.mixup = a.mixup;
            if (typeof a.hsv_h === 'number') patch.hsv_h = a.hsv_h;
            if (typeof a.hsv_s === 'number') patch.hsv_s = a.hsv_s;
            if (typeof a.hsv_v === 'number') patch.hsv_v = a.hsv_v;
            if (typeof a.flipud === 'number' || typeof a.flipud === 'boolean') patch.flipud = a.flipud;
            if (typeof a.fliplr === 'number' || typeof a.fliplr === 'boolean') patch.fliplr = a.fliplr;
            if (typeof a.degrees === 'number') patch.degrees = a.degrees;
            if (typeof a.translate === 'number') patch.translate = a.translate;
            if (typeof a.scale === 'number') patch.scale = a.scale;
            if (typeof a.shear === 'number') patch.shear = a.shear;
            if (typeof a.perspective === 'number') patch.perspective = a.perspective;
            if (typeof a.close_mosaic === 'number') patch.close_mosaic = a.close_mosaic;
            if (typeof v.iou === 'number') patch.val_iou = v.iou;
            if (typeof v.plots === 'boolean') patch.val_plots = v.plots;
            if (Array.isArray(d.classes)) patch.classes = d.classes;
            window.__resolvedServerConfig = cfg;
            if (typeof cfg.framework === 'string') patch.framework = cfg.framework;
            if (typeof cfg.task === 'string') patch.taskType = cfg.task;
          } catch {}
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
          } catch {}
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
            plots: form.val_plots,
          },
          // omit dataset from config preview; use train.data (data.yaml)
        };
        const res = await trainingAPI.resolveConfig(form.framework, form.taskType, overrides);
        const resolved = res?.resolved || overrides;
        window.__resolvedServerConfig = resolved;
        window.__argsPreview = (res?.preview?.args || []);
        await trainingAPI.saveSessionConfig({
          projectId: form.projectId,
          name: form.trainingName,
          resolvedConfig: resolved,
        });
      } catch {}
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
    form.val_plots,
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
              />
            </Card>

            <Card size="small" title="Framework & Task" bodyStyle={{ padding: 12 }} style={{ marginTop: 12 }}>
              <FrameworkTaskSection
                framework={form.framework}
                taskType={form.taskType}
                onChange={(patch) => handleChange(patch)}
              />
              <PretrainedModelSelect
                framework={form.framework}
                taskType={form.taskType}
                projectId={form.projectId}
                value={form.pretrainedModel}
                onChange={(value) => handleChange({ pretrainedModel: value })}
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
                val_plots={form.val_plots}
                isDeveloper={isDeveloper}
                onChange={(patch) => handleChange(patch)}
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
                    <Button type="default" size="small" disabled={!readiness.datasetReady || !readiness.modelReady}
                      onClick={async () => {
                        try {
                          const overrides = {
                            train: (() => {
                              const t = {
                                model: form.pretrainedModel,
                                epochs: form.epochs,
                                imgsz: form.imgSize,
                                batch: form.batchSize,
                                amp: form.mixedPrecision,
                                early_stop: form.earlyStop,
                                resume: form.resume,
                                device: form.device === 'gpu' && typeof form.gpuIndex === 'number' ? `cuda:${form.gpuIndex}` : 'cpu',
                                optimizer: (() => {
                                  if (form.optimizerMode === 'smart-auto') {
                                    const isGPU = form.device === 'gpu';
                                    const bsz = typeof form.batchSize === 'number' ? form.batchSize : 0;
                                    if (!isGPU) return 'Adam';
                                    if (bsz >= 32) return 'SGD';
                                    return 'AdamW';
                                  }
                                  return form.optimizer;
                                })(),
                                momentum: form.momentum,
                                weight_decay: form.weight_decay,
                                cos_lr: form.cos_lr,
                                patience: form.patience,
                                save_period: form.save_period,
                                workers: form.workers,
                                overlap_mask: form.overlap_mask,
                                mask_ratio: form.mask_ratio,
                                single_cls: form.single_cls,
                                rect: form.rect,
                                freeze: form.freeze
                              };
                              return t;
                            })(),
                            hyperparameters: {
                              lr0: form.lr0,
                              lrf: form.lrf,
                              warmup_epochs: form.warmup_epochs,
                              warmup_momentum: form.warmup_momentum,
                              warmup_bias_lr: form.warmup_bias_lr,
                              box: form.box,
                              cls: form.cls,
                              dfl: form.dfl
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
                              perspective: form.perspective
                            },
                            val: {
                              iou: form.val_iou,
                              plots: form.val_plots
                            },
                            dataset: {
                              zip_path: form.datasetZipPath
                            }
                          };
                          const res = await trainingAPI.resolveConfig(form.framework, form.taskType, overrides);
                          const resolved = res?.resolved || resolvedConfig;
                          // Update preview by temporarily overriding resolvedConfig output
                          // We don't change the memo; we show server-resolved in the preview below
                          window.__resolvedServerConfig = resolved;
                          window.__argsPreview = (res?.preview?.args || []);
                          // Save resolved config to session
                          if (form.projectId && form.trainingName) {
                            await trainingAPI.saveSessionConfig({
                              projectId: form.projectId,
                              name: form.trainingName,
                              resolvedConfig: resolved,
                            });
                          }
                        } catch (e) {}
                      }}
                    >Preflight</Button>
                  </div>
                    <Button type="primary" block style={{ marginTop: 8 }} disabled={!(readiness.nameReady && readiness.datasetReady && readiness.modelReady)}
                      onClick={async () => {
                        try {
                          if (form.projectId && form.trainingName) {
                            await trainingAPI.startSession({ projectId: form.projectId, name: form.trainingName });
                          }
                        } catch (e) {}
                      }}
                    >Start Training</Button>
                </Card>
                <Card size="small" style={{ marginTop: 12 }} bodyStyle={{ padding: 12 }}>
                  <Tabs defaultActiveKey="config" items={[
                    {
                      key: 'config',
                      label: 'Config Preview',
                      children: (
                        <div>
                          <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 4, maxHeight: 220, overflow: 'auto', margin: 0 }}>
                            {JSON.stringify(window.__resolvedServerConfig || resolvedConfig, null, 2)}
                          </pre>
                          {Array.isArray(window.__argsPreview) && window.__argsPreview.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <pre style={{ background: '#fafafa', padding: 8, borderRadius: 4, maxHeight: 100, overflow: 'auto', margin: 0 }}>
                                {window.__argsPreview.join(' ')}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      children: (
                        <div style={{ color: '#888' }}>Training status will appear here (progress, logs)</div>
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
