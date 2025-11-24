import React, { useState } from 'react';
import { Form, InputNumber, Switch, Radio, Modal, Select, Tag, Button, Spin, Space, Row, Col, Collapse } from 'antd';
import { systemAPI } from '../../../../services/api';

export default function PresetSection({ epochs, imgSize, batchSize, mixedPrecision, earlyStop, resume, device, gpuIndex, isDeveloper, onChange, optimizerMode, optimizer, lr0, lrf, momentum, weight_decay, patience, save_period, workers, warmup_epochs, warmup_momentum, warmup_bias_lr, cos_lr, box, cls, dfl, mosaic, close_mosaic, mixup, hsv_h, hsv_s, hsv_v, flipud, fliplr, degrees, translate, scale, shear, perspective, single_cls, rect, overlap_mask, mask_ratio, freeze, val_iou, val_plots, taskType, disabled }) {
  const OPTIMIZER_PRESETS = {
    SGD: { lr0: 0.01, lrf: 0.1, momentum: 0.937, weight_decay: 0.0005 },
    Adam: { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    Adamax: { lr0: 0.002, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    AdamW: { lr0: 0.0007, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005 },
    NAdam: { lr0: 0.002, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    RAdam: { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 },
    RMSProp: { lr0: 0.01, lrf: 0.1, momentum: 0.9, weight_decay: 0.0005 },
    auto: {}
  };
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
      {isDeveloper ? (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Presets" tooltip="Quick presets to populate core training fields">
                <Space>
                  <Button size="small" onClick={() => onChange({ epochs: 20, imgSize: 640, batchSize: 2, mixedPrecision: true })} disabled={disabled}>Quick</Button>
                  <Button size="small" onClick={() => onChange({ epochs: 50, imgSize: 640, batchSize: 2, mixedPrecision: true })} disabled={disabled}>Standard</Button>
                  <Button size="small" onClick={() => onChange({ epochs: 100, imgSize: 1024, batchSize: 2, mixedPrecision: false })} disabled={disabled}>High-Accuracy</Button>
                </Space>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Mixed Precision (AMP)" tooltip="Enable automatic mixed precision for speed">
                <Switch checked={mixedPrecision} onChange={(v) => onChange({ mixedPrecision: v })} disabled={disabled} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
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
                  disabled={disabled}
                >
                  <Radio.Button value="cpu">CPU</Radio.Button>
                  <Radio.Button value="gpu">GPU</Radio.Button>
                </Radio.Group>
                {device === 'gpu' && typeof gpuIndex === 'number' && (
                  <Tag style={{ marginLeft: 8 }}>GPU #{gpuIndex}</Tag>
                )}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Early Stop" tooltip="Allow stopping when no improvement for patience epochs">
                <Switch checked={earlyStop} onChange={(v) => onChange({ earlyStop: v })} disabled={disabled} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Resume" tooltip="Resume training from last checkpoint when available">
                <Switch checked={resume} onChange={(v) => onChange({ resume: v })} disabled={disabled} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Single Class" tooltip="Treat multi-class data as single-class">
                <Switch checked={single_cls} onChange={(v) => onChange({ single_cls: v })} disabled={disabled} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Epochs" tooltip="Maximum number of training epochs" required>
                <InputNumber min={1} max={500} value={epochs} onChange={(v) => onChange({ epochs: v })} disabled={disabled} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Batch Size" tooltip="Images per batch">
                <InputNumber min={1} placeholder={2} value={typeof batchSize === 'number' ? batchSize : undefined} onChange={(v) => onChange({ batchSize: v })} disabled={disabled} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Image Size" tooltip="Input image size (px)" required>
                <InputNumber min={64} max={2048} step={64} value={imgSize} onChange={(v) => onChange({ imgSize: v })} disabled={disabled} />
              </Form.Item>
            </Col>
            <Col span={12}>
            </Col>
          </Row>
        </>
      ) : (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Presets" tooltip="Quick presets to populate core training fields">
                <Space>
                  <Button size="small" onClick={() => onChange({ epochs: 20, imgSize: 640, batchSize: 2, mixedPrecision: true })} disabled={disabled}>Quick</Button>
                  <Button size="small" onClick={() => onChange({ epochs: 50, imgSize: 640, batchSize: 2, mixedPrecision: true })} disabled={disabled}>Standard</Button>
                  <Button size="small" onClick={() => onChange({ epochs: 100, imgSize: 1024, batchSize: 2, mixedPrecision: false })} disabled={disabled}>High-Accuracy</Button>
                </Space>
              </Form.Item>
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
                  disabled={disabled}
                >
                  <Radio.Button value="cpu">CPU</Radio.Button>
                  <Radio.Button value="gpu">GPU</Radio.Button>
                </Radio.Group>
                {device === 'gpu' && typeof gpuIndex === 'number' && (
                  <Tag style={{ marginLeft: 8 }}>GPU #{gpuIndex}</Tag>
                )}
              </Form.Item>
              <Form.Item label="Epochs" tooltip="Maximum number of training epochs" required>
                <InputNumber min={1} max={500} value={epochs} onChange={(v) => onChange({ epochs: v })} disabled={disabled} />
              </Form.Item>
              <Form.Item label="Image Size" tooltip="Input image size (px)" required>
                <InputNumber min={64} max={2048} step={64} value={imgSize} onChange={(v) => onChange({ imgSize: v })} disabled={disabled} />
              </Form.Item>
              <Form.Item label="Batch Size" tooltip="Images per batch">
                <InputNumber min={1} placeholder={2} value={typeof batchSize === 'number' ? batchSize : undefined} onChange={(v) => onChange({ batchSize: v })} disabled={disabled} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Mixed Precision (AMP)" tooltip="Enable automatic mixed precision for speed">
                <Switch checked={mixedPrecision} onChange={(v) => onChange({ mixedPrecision: v })} disabled={disabled} />
              </Form.Item>
              <Form.Item label="Early Stop" tooltip="Allow stopping when no improvement for patience epochs">
                <Switch checked={earlyStop} onChange={(v) => onChange({ earlyStop: v })} disabled={disabled} />
              </Form.Item>
              <Form.Item label="Resume" tooltip="Resume training from last checkpoint when available">
                <Switch checked={resume} onChange={(v) => onChange({ resume: v })} disabled={disabled} />
              </Form.Item>
              <Form.Item label="Optimizer" tooltip="Smart auto picks based on device and batch size">
                <Select
                  value={optimizerMode === 'smart-auto' ? 'smart-auto' : (optimizer || undefined)}
                  placeholder="Select"
                  onChange={(v) => {
                    if (v === 'smart-auto') {
                      const isGPU = device === 'gpu';
                      const bsz = typeof batchSize === 'number' ? batchSize : 0;
                      let picked = 'AdamW';
                      let rec = { lr0: 0.0007, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005 };
                      if (!isGPU) {
                        picked = 'Adam';
                        rec = { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 };
                      } else if (bsz >= 32) {
                        picked = 'SGD';
                        rec = { lr0: 0.01, lrf: 0.1, momentum: 0.937, weight_decay: 0.0005 };
                      }
                      onChange({ optimizerMode: 'smart-auto', optimizer: picked, ...rec });
                    } else {
                      const preset = OPTIMIZER_PRESETS[v] || {};
                      onChange({ optimizerMode: null, optimizer: v, ...preset });
                    }
                  }}
                  disabled={disabled}
                >
                  <Select.Option value="smart-auto">smart auto</Select.Option>
                  <Select.Option value="AdamW">AdamW</Select.Option>
                  <Select.Option value="SGD">SGD</Select.Option>
                </Select>
                {optimizerMode === 'smart-auto' && (
                  (() => {
                    const isGPU = device === 'gpu';
                    const bsz = typeof batchSize === 'number' ? batchSize : 0;
                    const resolved = !isGPU ? 'Adam' : (bsz >= 32) ? 'SGD' : 'AdamW';
                    return <span style={{ marginLeft: 8, color: '#888' }}>({resolved})</span>;
                  })()
                )}
              </Form.Item>
              <Form.Item label="Single Class" tooltip="Treat data as single class (industrial setups)">
                <Switch checked={single_cls} onChange={(v) => onChange({ single_cls: v })} disabled={disabled} />
              </Form.Item>
            </Col>
          </Row>

        </>
      )}
      {/* Save Best Only is enforced by backend default; use save_period to keep extra checkpoints */}
      {isDeveloper && (
        <Collapse defaultActiveKey={["opt", "loss", "aug"]}>
          <Collapse.Panel header="Optimization" key="opt">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Optimizer" tooltip="Training optimizer">
                  <Select value={optimizerMode === 'smart-auto' ? 'smart-auto' : (optimizer || undefined)} placeholder="Default: AdamW" onChange={(v) => {
                    if (v === 'smart-auto') {
                      const isGPU = device === 'gpu';
                      const bsz = typeof batchSize === 'number' ? batchSize : 0;
                      const heavyAug = (Number(mosaic) || 0) >= 0.3 || (Number(mixup) || 0) >= 0.03;
                      let picked = 'AdamW';
                      let rec = { lr0: 0.0007, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005 };
                      if (!isGPU) {
                        picked = 'Adam';
                        rec = { lr0: 0.001, lrf: 0.01, momentum: 0.9, weight_decay: 0.0005 };
                      } else if (bsz >= 32 || heavyAug) {
                        picked = 'SGD';
                        rec = { lr0: 0.01, lrf: 0.1, momentum: 0.937, weight_decay: 0.0005 };
                      } else if ((taskType || '') === 'segmentation') {
                        picked = 'AdamW';
                        rec = { lr0: 0.0007, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005 };
                      }
                      onChange({ optimizerMode: 'smart-auto', ...rec });
                    } else {
                      const preset = OPTIMIZER_PRESETS[v] || {};
                      onChange({ optimizerMode: null, optimizer: v, ...preset });
                    }
                  }}>
                    <Select.Option value="SGD">SGD</Select.Option>
                    <Select.Option value="Adam">Adam</Select.Option>
                    <Select.Option value="Adamax">Adamax</Select.Option>
                    <Select.Option value="AdamW">AdamW</Select.Option>
                    <Select.Option value="NAdam">NAdam</Select.Option>
                    <Select.Option value="RAdam">RAdam</Select.Option>
                    <Select.Option value="RMSProp">RMSProp</Select.Option>
                    <Select.Option value="smart-auto">smart auto</Select.Option>
                  </Select>
                  {optimizerMode === 'smart-auto' && (
                    (() => {
                      const isGPU = device === 'gpu';
                      const bsz = typeof batchSize === 'number' ? batchSize : 0;
                      const heavyAug = (Number(mosaic) || 0) >= 0.3 || (Number(mixup) || 0) >= 0.03;
                      const resolved = !isGPU ? 'Adam' : (bsz >= 32 || heavyAug) ? 'SGD' : ((taskType || '') === 'segmentation' ? 'AdamW' : 'AdamW');
                      return <span style={{ marginLeft: 8, color: '#888' }}>({resolved})</span>;
                    })()
                  )}
                </Form.Item>
                <Form.Item label="Learning Rate (lr0)" tooltip="Initial learning rate">
                  <InputNumber min={0} step={0.0001} placeholder={0.0007} value={lr0} onChange={(v) => onChange({ lr0: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Final LR Factor (lrf)" tooltip="Final LR = lr0 × lrf (cosine schedule end)">
                  <InputNumber min={0} max={1} step={0.001} placeholder={0.01} value={lrf} onChange={(v) => onChange({ lrf: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Momentum" tooltip="Optimizer momentum / Adam beta1">
                  <InputNumber min={0} max={1} step={0.001} placeholder={0.937} value={momentum} onChange={(v) => onChange({ momentum: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Weight Decay" tooltip="L2 regularization strength">
                  <InputNumber min={0} step={0.0001} placeholder={0.0005} value={weight_decay} onChange={(v) => onChange({ weight_decay: v })} disabled={disabled} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Cosine LR Scheduler" tooltip="Use cosine decay schedule">
                  <Switch checked={cos_lr} onChange={(v) => onChange({ cos_lr: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Warmup Epochs" tooltip="Epochs for warmup">
                  <InputNumber min={0} step={1} placeholder={3.0} value={warmup_epochs} onChange={(v) => onChange({ warmup_epochs: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Warmup Momentum" tooltip="Initial momentum for warmup">
                  <InputNumber min={0} max={1} step={0.01} placeholder={0.8} value={warmup_momentum} onChange={(v) => onChange({ warmup_momentum: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Warmup Bias LR" tooltip="Initial bias lr for warmup">
                  <InputNumber min={0} step={0.01} placeholder={0.1} value={warmup_bias_lr} onChange={(v) => onChange({ warmup_bias_lr: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Patience (Early Stop)" tooltip="Epochs to wait without improvement before stopping">
                  <InputNumber min={0} placeholder={30} value={patience} onChange={(v) => onChange({ patience: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Save Period (epochs)" tooltip="Checkpoint every N epochs; -1 disables">
                  <InputNumber min={-1} placeholder={-1} value={save_period} onChange={(v) => onChange({ save_period: v })} disabled={disabled} />
                </Form.Item>
                <Form.Item label="Workers" tooltip="Data loader workers">
                  <InputNumber min={0} placeholder={8} value={workers} onChange={(v) => onChange({ workers: v })} disabled={disabled} />
                </Form.Item>
              </Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Loss Weights" key="loss">
            <Row gutter={12}>
              <Col span={8}><Form.Item label="Box" tooltip="Weight of bounding-box regression loss"><InputNumber min={0} step={0.1} placeholder={10.0} value={box} onChange={(v) => onChange({ box: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={8}><Form.Item label="Cls" tooltip="Weight of classification loss"><InputNumber min={0} step={0.1} placeholder={0.3} value={cls} onChange={(v) => onChange({ cls: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={8}><Form.Item label="DFL" tooltip="Weight of distribution focal loss (box quality)"><InputNumber min={0} step={0.1} placeholder={2.0} value={dfl} onChange={(v) => onChange({ dfl: v })} disabled={disabled} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Augmentation" key="aug">
            <Row gutter={12}>
              <Col span={6}><Form.Item label="Mosaic" tooltip="Mosaic augmentation probability"><InputNumber min={0} max={1} step={0.01} placeholder={0.3} value={mosaic} onChange={(v) => onChange({ mosaic: v })} disabled={disabled} /></Form.Item></Col>
              {isDeveloper && (
                <Col span={6}>
                  <Form.Item label="Close Mosaic (final epochs)" tooltip="Disable mosaic for last N epochs (0 = disabled)">
                    <InputNumber min={0} max={500} step={1} placeholder={20} value={typeof close_mosaic === 'number' ? close_mosaic : undefined} onChange={(v) => onChange({ close_mosaic: v })} disabled={disabled} />
                  </Form.Item>
                </Col>
              )}
              <Col span={6}><Form.Item label="Mixup" tooltip="Mixup augmentation probability"><InputNumber min={0} max={1} step={0.01} placeholder={0.03} value={mixup} onChange={(v) => onChange({ mixup: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="HSV H" tooltip="Hue augmentation"><InputNumber min={0} max={1} step={0.001} placeholder={0.005} value={hsv_h} onChange={(v) => onChange({ hsv_h: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="HSV S" tooltip="Saturation augmentation"><InputNumber min={0} max={1} step={0.01} placeholder={0.1} value={hsv_s} onChange={(v) => onChange({ hsv_s: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="HSV V" tooltip="Value/Brightness augmentation"><InputNumber min={0} max={1} step={0.01} placeholder={0.05} value={hsv_v} onChange={(v) => onChange({ hsv_v: v })} disabled={disabled} /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col span={4}><Form.Item label="FlipUD" tooltip="Vertical flip probability"><InputNumber min={0} max={1} step={0.01} placeholder={0.0} value={flipud} onChange={(v) => onChange({ flipud: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="FlipLR" tooltip="Horizontal flip probability"><InputNumber min={0} max={1} step={0.01} placeholder={0.5} value={fliplr} onChange={(v) => onChange({ fliplr: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Degrees" tooltip="Rotation range"><InputNumber min={0} max={180} step={0.5} placeholder={0.0} value={degrees} onChange={(v) => onChange({ degrees: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Translate" tooltip="Translation fraction"><InputNumber min={0} max={1} step={0.01} placeholder={0.1} value={translate} onChange={(v) => onChange({ translate: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Scale" tooltip="Scale gain"><InputNumber min={0} max={2} step={0.01} placeholder={0.5} value={scale} onChange={(v) => onChange({ scale: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Shear" tooltip="Shear fraction"><InputNumber min={0} max={1} step={0.01} placeholder={0.0} value={shear} onChange={(v) => onChange({ shear: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={4}><Form.Item label="Perspective" tooltip="Perspective fraction"><InputNumber min={0} max={1} step={0.001} placeholder={0.0} value={perspective} onChange={(v) => onChange({ perspective: v })} disabled={disabled} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Task & Segmentation" key="task">
            <Row gutter={12}>
              <Col span={6}><Form.Item label="Rectangular" tooltip="Rectangular batches"><Switch checked={rect} onChange={(v) => onChange({ rect: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Overlap Mask" tooltip="Merge masks into single image mask"><Switch checked={overlap_mask} onChange={(v) => onChange({ overlap_mask: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Mask Ratio" tooltip="Mask downsample ratio"><InputNumber min={1} step={1} placeholder={2} value={mask_ratio} onChange={(v) => onChange({ mask_ratio: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={6}><Form.Item label="Freeze Layers" tooltip="Freeze first N layers"><InputNumber min={0} step={1} placeholder={0} value={freeze} onChange={(v) => onChange({ freeze: v })} disabled={disabled} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel header="Validation" key="val">
            <Row gutter={12}>
              <Col span={12}><Form.Item label="Val IoU" tooltip="IoU threshold used in validation"><InputNumber min={0} max={1} step={0.01} placeholder={0.5} value={val_iou} onChange={(v) => onChange({ val_iou: v })} disabled={disabled} /></Form.Item></Col>
              <Col span={12}><Form.Item label="Val Plots" tooltip="Save validation plots"><Switch checked={val_plots} onChange={(v) => onChange({ val_plots: v })} disabled={disabled} /></Form.Item></Col>
            </Row>
          </Collapse.Panel>
        </Collapse>
      )}
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