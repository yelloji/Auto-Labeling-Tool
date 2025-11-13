import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Button, Row, Col, ConfigProvider, Affix } from 'antd';
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
                value={form.pretrainedModel}
                onChange={(value) => handleChange({ pretrainedModel: value })}
              />
            </Card>

            <Card size="small" title="Dataset" bodyStyle={{ padding: 12 }} style={{ marginTop: 12 }}>
              <DatasetSection
                projectId={form.projectId}
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
            <Card size="small" title="Config Preview" bodyStyle={{ padding: 12 }}>
              <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 4, maxHeight: 300, overflow: 'auto', margin: 0 }}>
                {JSON.stringify(resolvedConfig, null, 2)}
              </pre>
            </Card>
            <Affix offsetBottom={16}>
              <Card size="small" bodyStyle={{ padding: 12 }} style={{ marginTop: 12 }}>
                <Button type="primary" block disabled={!form.trainingName || !form.datasetZipPath}>
                  Start Training (MVP)
                </Button>
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  MVP — backend wiring for ZIP extraction, logs, checkpoints and export will be added later.
                </Text>
              </Card>
            </Affix>
          </Col>
        </Row>
      </ConfigProvider>
    </div>
  );
};

export default ModelTrainingSection;
