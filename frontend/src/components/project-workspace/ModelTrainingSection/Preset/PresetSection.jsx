import React, { useState } from 'react';
import { Form, InputNumber, Switch, Radio, Modal, Select, Tag, Button, Spin, Space, Row, Col, Collapse } from 'antd';
import { systemAPI } from '../../../../services/api';

export default function PresetSection({ epochs, imgSize, batchSize, mixedPrecision, earlyStop, saveBestOnly, device, gpuIndex, isDeveloper, onChange }) {
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [loadingHW, setLoadingHW] = useState(false);
  const [hw, setHW] = useState(null);

  const openDeviceModal = async () => {
    setShowDeviceModal(true);
    setLoadingHW(true);
    try {
      const info = await systemAPI.getHardware();
      setHW(info);
      if (!info?.torch_cuda_available || !info?.gpus?.length) {
        onChange({ device: 'cpu', gpuIndex: null });
      }
    } finally {
      setLoadingHW(false);
    }
  };
  return (
    <Form layout="vertical">
      <Form.Item label="Presets">
        <Space>
          <Button size="small" onClick={() => onChange({ epochs: 20, imgSize: 640, batchSize: 'auto', mixedPrecision: true })}>Fast</Button>
          <Button size="small" onClick={() => onChange({ epochs: 50, imgSize: 640, batchSize: 'auto', mixedPrecision: true })}>Balanced</Button>
          <Button size="small" onClick={() => onChange({ epochs: 100, imgSize: 1024, batchSize: 'auto', mixedPrecision: false })}>Accurate</Button>
        </Space>
      </Form.Item>
      <Form.Item label="Epochs" required>
        <InputNumber min={1} max={500} value={epochs} onChange={(v) => onChange({ epochs: v })} />
      </Form.Item>
      <Form.Item label="Image Size" required>
        <InputNumber min={64} max={2048} step={64} value={imgSize} onChange={(v) => onChange({ imgSize: v })} />
      </Form.Item>
      <Form.Item label="Batch Size" tooltip="Use 'auto' or a number">
        <InputNumber min={1} value={typeof batchSize === 'number' ? batchSize : undefined} onChange={(v) => onChange({ batchSize: v })} />
      </Form.Item>
      <Form.Item label="Mixed Precision (AMP)">
        <Switch checked={mixedPrecision} onChange={(v) => onChange({ mixedPrecision: v })} />
      </Form.Item>
      <Form.Item label="Early Stop">
        <Switch checked={earlyStop} onChange={(v) => onChange({ earlyStop: v })} />
      </Form.Item>
      <Form.Item label="Save Best Only">
        <Switch checked={saveBestOnly} onChange={(v) => onChange({ saveBestOnly: v })} />
      </Form.Item>
      {isDeveloper && (
        <Collapse defaultActiveKey={["opt","loss","aug"]}>
          <Collapse.Panel header="Optimization" key="opt">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Optimizer">
                  <Select value={undefined} placeholder="Select optimizer" onChange={(v) => onChange({ optimizer: v })}>
                    <Select.Option value="SGD">SGD</Select.Option>
                    <Select.Option value="Adam">Adam</Select.Option>
                    <Select.Option value="AdamW">AdamW</Select.Option>
                    <Select.Option value="RMSProp">RMSProp</Select.Option>
                  </Select>
                </Form.Item>
          <Form.Item label="Learning Rate (lr0)">
            <InputNumber min={0} step={0.0001} onChange={(v) => onChange({ lr0: v })} />
          </Form.Item>
          <Form.Item label="Final LR Factor (lrf)">
            <InputNumber min={0} max={1} step={0.001} onChange={(v) => onChange({ lrf: v })} />
          </Form.Item>
                <Form.Item label="Momentum">
                  <InputNumber min={0} max={1} step={0.001} onChange={(v) => onChange({ momentum: v })} />
                </Form.Item>
                <Form.Item label="Weight Decay">
                  <InputNumber min={0} step={0.0001} onChange={(v) => onChange({ weight_decay: v })} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Cosine LR Scheduler">
                  <Switch onChange={(v) => onChange({ cos_lr: v })} />
                </Form.Item>
                <Form.Item label="Patience (Early Stop)">
                  <InputNumber min={0} onChange={(v) => onChange({ patience: v })} />
                </Form.Item>
                <Form.Item label="Save Period (epochs)">
                  <InputNumber min={-1} onChange={(v) => onChange({ save_period: v })} />
                </Form.Item>
                <Form.Item label="Workers">
                  <InputNumber min={0} onChange={(v) => onChange({ workers: v })} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={8}><Form.Item label="Warmup Epochs"><InputNumber min={0} step={0.1} onChange={(v) => onChange({ warmup_epochs: v })} /></Form.Item></Col>
              <Col span={8}><Form.Item label="Warmup Momentum"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ warmup_momentum: v })} /></Form.Item></Col>
              <Col span={8}><Form.Item label="Warmup Bias LR"><InputNumber min={0} step={0.001} onChange={(v) => onChange({ warmup_bias_lr: v })} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Loss Weights" key="loss">
            <Row gutter={12}>
              <Col span={8}><Form.Item label="Box"><InputNumber min={0} step={0.1} onChange={(v) => onChange({ box: v })} /></Form.Item></Col>
              <Col span={8}><Form.Item label="Cls"><InputNumber min={0} step={0.1} onChange={(v) => onChange({ cls: v })} /></Form.Item></Col>
              <Col span={8}><Form.Item label="DFL"><InputNumber min={0} step={0.1} onChange={(v) => onChange({ dfl: v })} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Augmentation" key="aug">
            <Row gutter={12}>
              <Col span={6}><Form.Item label="Mosaic"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ mosaic: v })} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Mixup"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ mixup: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="HSV H"><InputNumber min={0} max={1} step={0.001} onChange={(v) => onChange({ hsv_h: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="HSV S"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ hsv_s: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="HSV V"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ hsv_v: v })} /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col span={4}><Form.Item label="FlipUD"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ flipud: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="FlipLR"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ fliplr: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Degrees"><InputNumber min={0} max={180} step={0.5} onChange={(v) => onChange({ degrees: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Translate"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ translate: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Scale"><InputNumber min={0} max={2} step={0.01} onChange={(v) => onChange({ scale: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Shear"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ shear: v })} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Perspective"><InputNumber min={0} max={1} step={0.001} onChange={(v) => onChange({ perspective: v })} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Task & Segmentation" key="task">
            <Row gutter={12}>
              <Col span={6}><Form.Item label="Single Class"><Switch onChange={(v) => onChange({ single_cls: v })} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Rectangular"><Switch onChange={(v) => onChange({ rect: v })} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Overlap Mask"><Switch onChange={(v) => onChange({ overlap_mask: v })} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Mask Ratio"><InputNumber min={1} step={1} onChange={(v) => onChange({ mask_ratio: v })} /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col span={6}><Form.Item label="Freeze Layers"><InputNumber min={0} step={1} onChange={(v) => onChange({ freeze: v })} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Validation" key="val">
            <Row gutter={12}>
              <Col span={12}><Form.Item label="Val IoU"><InputNumber min={0} max={1} step={0.01} onChange={(v) => onChange({ val_iou: v })} /></Form.Item></Col>
              <Col span={12}><Form.Item label="Val Plots"><Switch onChange={(v) => onChange({ val_plots: v })} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
        </Collapse>
      )}
      <Form.Item label="Device">
        <Radio.Group
          value={device}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'gpu') {
              openDeviceModal();
            } else {
              onChange({ device: 'cpu', gpuIndex: null });
            }
          }}
        >
          <Radio.Button value="cpu">CPU</Radio.Button>
          <Radio.Button value="gpu">GPU</Radio.Button>
        </Radio.Group>
        {device === 'gpu' && typeof gpuIndex === 'number' && (
          <Tag style={{ marginLeft: 8 }}>GPU #{gpuIndex}</Tag>
        )}
      </Form.Item>
      <Modal
        title="Select GPU"
        open={showDeviceModal}
        onCancel={() => setShowDeviceModal(false)}
        onOk={() => setShowDeviceModal(false)}
        okButtonProps={{ disabled: !hw?.gpus?.length }}
      >
        {loadingHW ? (
          <Spin />
        ) : hw ? (
          <div>
            <div style={{ marginBottom: 8 }}>
              <Tag color={hw.torch_cuda_available ? 'green' : 'red'}>
                CUDA {hw.torch_cuda_available ? `available${hw.cuda_version ? ` (${hw.cuda_version})` : ''}` : 'not available'}
              </Tag>
              {hw.torch_version && <Tag>torch {hw.torch_version}</Tag>}
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder={hw.gpus?.length ? 'Choose a GPU' : 'No GPUs found'}
              value={typeof gpuIndex === 'number' ? gpuIndex : undefined}
              onChange={(val) => onChange({ device: 'gpu', gpuIndex: val })}
              disabled={!hw.gpus?.length}
            >
              {(hw.gpus || []).map((g) => (
                <Select.Option key={g.id} value={g.id}>
                  #{g.id} • {g.name} • {g.memory_mb ? `${g.memory_mb} MB` : ''}
                </Select.Option>
              ))}
            </Select>
            {!hw.gpus?.length && (
              <div style={{ marginTop: 8 }}>No compatible GPUs detected. Using CPU.</div>
            )}
          </div>
        ) : (
          <div>Error loading hardware info</div>
        )}
      </Modal>
    </Form>
  );
}
