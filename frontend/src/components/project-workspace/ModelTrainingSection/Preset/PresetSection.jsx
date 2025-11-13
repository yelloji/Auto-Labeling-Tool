import React, { useState } from 'react';
import { Form, InputNumber, Switch, Radio, Modal, Select, Tag, Button, Spin, Space } from 'antd';
import { systemAPI } from '../../../../services/api';

export default function PresetSection({ epochs, imgSize, batchSize, mixedPrecision, earlyStop, saveBestOnly, device, gpuIndex, onChange }) {
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
