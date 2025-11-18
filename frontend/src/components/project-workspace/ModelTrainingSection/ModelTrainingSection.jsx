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
import { trainingAPI } from '../../../services/api';

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
  datasetZipPath: '',
  classes: [],
  epochs: 50,
  imgSize: 640,
  batchSize: 2,
  mixedPrecision: true,
  earlyStop: true,
  saveBestOnly: true,
  device: 'cpu',
  gpuIndex: null,
  optimizerMode: 'smart-auto'
};

const ModelTrainingSection = ({ projectId, project }) => {
  useEffect(() => {
    logInfo('app.frontend.ui', 'model_training_section_initialized', 'ModelTrainingSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'ModelTrainingSection',
      projectId
    });
  }, [projectId]);

  

  const [form, setForm] = useState({ ...initialFormState, projectId });
  const isDeveloper = form.mode === 'developer';
  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (projectId && projectId !== form.projectId) {
      setForm((prev) => ({ ...prev, projectId }));
    }
  }, [projectId, form.projectId]);

  // Persist identity while status is queued (name/description)
  useEffect(() => {
    const saveIdentity = async () => {
      try {
        if (!form.projectId || !form.trainingName) return;
        await trainingAPI.upsertSession({
          projectId: form.projectId,
          name: form.trainingName,
          description: form.description || ''
        });
      } catch (_) {}
    };
    saveIdentity();
  }, [form.projectId, form.trainingName, form.description]);

  // Persist selected model/framework/task
  useEffect(() => {
    const saveModel = async () => {
      try {
        if (!form.projectId || !form.trainingName) return;
        await trainingAPI.updateSessionModel({
          projectId: form.projectId,
          name: form.trainingName,
          baseModelId: form.pretrainedModel || null,
          framework: form.framework || null,
          task: form.taskType || null,
          modelName: form.pretrainedModel || null,
        });
      } catch (_) {}
    };
    saveModel();
  }, [form.projectId, form.trainingName, form.pretrainedModel, form.framework, form.taskType]);

  // Persist dataset selection from zip: extract if needed, save dir + summary
  useEffect(() => {
    const saveDataset = async () => {
      try {
        if (!form.projectId || !form.trainingName || !form.datasetZipPath) return;
        await trainingAPI.updateSessionDatasetFromZip({
          projectId: form.projectId,
          name: form.trainingName,
          zipPath: form.datasetZipPath,
        });
      } catch (_) {}
    };
    saveDataset();
  }, [form.projectId, form.trainingName, form.datasetZipPath]);

  const resolvedConfig = useMemo(() => ({
    project_id: form.projectId,
    training_name: form.trainingName,
    framework: form.framework,
    task: form.taskType,
    dataset: {
      source: form.datasetSource,
      zip_path: form.datasetZipPath,
      classes: form.classes
    },
    train: {
      epochs: form.epochs,
      imgsz: form.imgSize,
      batch: form.batchSize,
      amp: form.mixedPrecision,
      early_stop: form.earlyStop,
      save_best: form.saveBestOnly,
      model: form.pretrainedModel,
      device: form.device === 'gpu' && typeof form.gpuIndex === 'number' ? `cuda:${form.gpuIndex}` : 'cpu'
    }
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
          <ModeToggle mode={form.mode} onChange={(mode) => handleChange({ mode })} />
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
                datasetZipPath={form.datasetZipPath}
                classes={form.classes}
                isDeveloper={isDeveloper}
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
                            train: {
                              model: form.pretrainedModel,
                              epochs: form.epochs,
                              imgsz: form.imgSize,
                              batch: form.batchSize,
                              amp: form.mixedPrecision,
                              early_stop: form.earlyStop,
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
                            },
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
      </ConfigProvider>
    </div>
  );
};

export default ModelTrainingSection;
