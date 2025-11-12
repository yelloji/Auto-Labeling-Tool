import React, { useMemo } from 'react';
import { Form, Select } from 'antd';

const YOLO_DET = ['yolov8n.pt','yolov8s.pt','yolov8m.pt','yolov8l.pt','yolov8x.pt'];
const YOLO_SEG = ['yolov8n-seg.pt','yolov8s-seg.pt','yolov8m-seg.pt','yolov8l-seg.pt','yolov8x-seg.pt'];
const YOLO_CLS = ['yolov8n-cls.pt','yolov8s-cls.pt','yolov8m-cls.pt','yolov8l-cls.pt','yolov8x-cls.pt'];

export default function PretrainedModelSelect({ framework, taskType, value, onChange }) {
  const options = useMemo(() => {
    if (framework !== 'ultralytics') return [];
    let list = YOLO_DET;
    if (taskType === 'segmentation') list = YOLO_SEG;
    if (taskType === 'classification') list = YOLO_CLS;
    return list.map((m) => ({ label: m, value: m }));
  }, [framework, taskType]);

  return (
    <Form layout="vertical">
      <Form.Item label="Pretrained Model" required>
        <Select
          value={value}
          placeholder="Select a pretrained model"
          options={options}
          onChange={onChange}
        />
      </Form.Item>
    </Form>
  );
}