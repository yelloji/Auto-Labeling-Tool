import React from 'react';
import { Form, Select } from 'antd';

const frameworkOptions = [
  { label: 'Ultralytics (YOLO)', value: 'ultralytics' },
  // Future: { label: 'MMDetection', value: 'mmdet' },
];

const taskOptions = [
  { label: 'Object Detection', value: 'detection' },
  { label: 'Segmentation', value: 'segmentation' },
];

export default function FrameworkTaskSection({ framework, taskType, onChange, disabled }) {
  return (
    <Form layout="vertical">
      <Form.Item label="Framework" required>
        <Select
          value={framework}
          options={frameworkOptions}
          onChange={(value) => onChange({ framework: value })}
          disabled={disabled}
        />
      </Form.Item>
      <Form.Item label="Task Type" required>
        <Select
          value={taskType}
          options={taskOptions}
          onChange={(value) => onChange({ taskType: value })}
          disabled={disabled}
        />
      </Form.Item>
    </Form>
  );
}
