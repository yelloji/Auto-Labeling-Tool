import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Space, Divider, Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { logInfo } from '../../../utils/professional_logger';
import ModeToggle from './ModeToggle/ModeToggle';
import IdentitySection from './Identity/IdentitySection';
import FrameworkTaskSection from './FrameworkTask/FrameworkTaskSection';
import PretrainedModelSelect from './PretrainedModel/PretrainedModelSelect';
import DatasetSection from './Dataset/DatasetSection';
import PresetSection from './Preset/PresetSection';

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
  saveBestOnly: true
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
      model: form.pretrainedModel
    }
  }), [form]);

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ margin: 0 }}>
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        Model Training
      </Title>
      {project && (
        <Text type="secondary" style={{ marginLeft: 0 }}>Project: {project.name}</Text>
      )}

      <Card style={{ marginTop: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <ModeToggle mode={form.mode} onChange={(mode) => handleChange({ mode })} />

          <IdentitySection
            projectId={form.projectId}
            trainingName={form.trainingName}
            onChange={(patch) => handleChange(patch)}
          />

          <Divider />
          <Title level={4}>Setup</Title>
          <FrameworkTaskSection
            framework={form.framework}
            taskType={form.taskType}
            onChange={(patch) => handleChange(patch)}
          />
          <PretrainedModelSelect
            framework={form.framework}
            taskType={form.taskType}
            value={form.pretrainedModel}
            onChange={(value) => handleChange({ pretrainedModel: value })}
          />
          <DatasetSection
            projectId={form.projectId}
            datasetSource={form.datasetSource}
            datasetZipPath={form.datasetZipPath}
            classes={form.classes}
            isDeveloper={isDeveloper}
            onChange={(patch) => handleChange(patch)}
          />

          <Divider />
          <Title level={4}>Training Preset</Title>
          <PresetSection
            epochs={form.epochs}
            imgSize={form.imgSize}
            batchSize={form.batchSize}
            mixedPrecision={form.mixedPrecision}
            earlyStop={form.earlyStop}
            saveBestOnly={form.saveBestOnly}
            onChange={(patch) => handleChange(patch)}
          />

          <Divider />
          <Title level={4}>Config Preview</Title>
          <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 4, maxHeight: 240, overflow: 'auto' }}>
            {JSON.stringify(resolvedConfig, null, 2)}
          </pre>

          <Divider />
          <Title level={4}>Run</Title>
          <Button type="primary" disabled={!form.trainingName || !form.datasetZipPath}>
            Start Training (MVP)
          </Button>

          <Text type="secondary">MVP — backend wiring for ZIP extraction, logs, checkpoints and export will be added later.</Text>
        </Space>
      </Card>
    </div>
  );
};

export default ModelTrainingSection;