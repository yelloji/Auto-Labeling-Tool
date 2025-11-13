import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Button, Row, Col, ConfigProvider, Affix, Steps, Tabs, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { logInfo } from '../../../utils/professional_logger';
import ModeToggle from './ModeToggle/ModeToggle';
import IdentitySection from './Identity/IdentitySection';
import FrameworkTaskSection from './FrameworkTask/FrameworkTaskSection';
import PretrainedModelSelect from './PretrainedModel/PretrainedModelSelect';
import DatasetSection from './Dataset/DatasetSection';
import PresetSection from './Preset/PresetSection';
import './compact.css';

const { Title, Text } = Typography;

// Simple initial state model (will be moved into a hook later)
const initialFormState = {
  mode: 'user',
  projectId: '',
  trainingName: '',
  framework: 'ultralytics',
  taskType: 'segmentation',
  pretrainedModel: '',
  datasetSource: 'release_zip',
  datasetZipPath: '',
  classes: [],
  epochs: 50,
  imgSize: 640,
  batchSize: 'auto',
  mixedPrecision: true,
  earlyStop: true,
  saveBestOnly: true,
  device: 'cpu',
  gpuIndex: null
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
              <DatasetSection
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
                saveBestOnly={form.saveBestOnly}
                device={form.device}
                gpuIndex={form.gpuIndex}
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
                    <Button type="default" size="small" disabled={!readiness.datasetReady || !readiness.modelReady}>Preflight</Button>
                  </div>
                  <Button type="primary" block style={{ marginTop: 8 }} disabled={!(readiness.nameReady && readiness.datasetReady && readiness.modelReady)}>
                    Start Training
                  </Button>
                </Card>
                <Card size="small" style={{ marginTop: 12 }} bodyStyle={{ padding: 12 }}>
                  <Tabs defaultActiveKey="config" items={[
                    {
                      key: 'config',
                      label: 'Config Preview',
                      children: (
                        <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 4, maxHeight: 300, overflow: 'auto', margin: 0 }}>
                          {JSON.stringify(resolvedConfig, null, 2)}
                        </pre>
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
