import React from 'react';
import { Form, InputNumber, Switch } from 'antd';

export default function PresetSection({ epochs, imgSize, batchSize, mixedPrecision, earlyStop, saveBestOnly, onChange }) {
  return (
    <Form layout="vertical">
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
    </Form>
  );
}