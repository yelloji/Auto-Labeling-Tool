import React, { useEffect, useState } from 'react';
import { Form, Select, Tag, Spin } from 'antd';
import { trainingAPI } from '../../../../services/api';


export default function PretrainedModelSelect({ framework, taskType, projectId, value, onChange, disabled }) {
  const [loading, setLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (framework !== 'ultralytics') { setModelOptions([]); return; }
      setLoading(true);
      try {
        const list = await trainingAPI.getTrainableModels(projectId, framework, taskType);
        const items = [];
        const modelMap = {};  // Store full model info
        for (const m of Array.isArray(list) ? list : []) {
          const filePath = String(m?.file_path || '');
          const name = String(m?.name || filePath || '').split(/[\\\/]/).pop();
          const scope = m?.project_id ? (m?.project_name || 'project') : 'global';
          if (!filePath.toLowerCase().endsWith('.pt')) continue;
          const label = (
            <span>
              {name} <Tag style={{ marginLeft: 6 }}>{scope}</Tag>
            </span>
          );
          items.push({ label, value: filePath, modelInfo: m });  // Include full model info
          modelMap[filePath] = m;  // Store for lookup
        }
        setModelOptions(items);

        // Clear selection if current model is not compatible with new task type
        if (value && !items.find(item => item.value === value)) {
          onChange('', null);  // Clear model selection
        }

        // Store model map for parent component
        if (onChange && value) {
          const selectedModel = modelMap[value];
          if (selectedModel) {
            onChange(value, selectedModel);  // Pass both file path and model info
          }
        }
      } catch {
        setModelOptions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [framework, taskType, projectId]);

  const isYolo26Selected = typeof value === 'string' && value.toLowerCase().includes('yolo26');

  return (
    <Form layout="vertical">
      <Form.Item label="Pretrained Model" required>
        {loading ? (
          <Spin />
        ) : (
          <Select
            value={value}
            placeholder={modelOptions.length ? 'Select a pretrained model' : 'No compatible models found'}
            options={modelOptions}
            onChange={(val) => {
              const selected = modelOptions.find(opt => opt.value === val);
              onChange(val, selected?.modelInfo);
            }}
            showSearch
            disabled={disabled || !modelOptions.length}
          />
        )}
        {isYolo26Selected && (
          <div style={{ marginTop: 6, color: '#1677ff', fontSize: 12 }}>
            YOLO26 detected — Smart Auto will use MuSGD optimizer for best results. You can also select MuSGD manually.
          </div>
        )}
      </Form.Item>
    </Form>
  );
}
