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
        const sizeTag = (name) => name?.includes('n') ? 'n' : name?.includes('s') ? 's' : name?.includes('m') ? 'm' : name?.includes('l') ? 'l' : 'x';
        for (const m of Array.isArray(list) ? list : []) {
          const filePath = String(m?.file_path || '');
          const name = String(m?.name || filePath || '').split(/[\\\/]/).pop();
          const scope = m?.project_id ? (m?.project_name || 'project') : 'global';
          if (!filePath.toLowerCase().endsWith('.pt')) continue;
          const size = sizeTag(name.toLowerCase());
          const label = (
            <span>
              {name} <Tag style={{ marginLeft: 6 }}>{scope}</Tag> <Tag color="blue" style={{ marginLeft: 6 }}>{size}</Tag>
            </span>
          );
          items.push({ label, value: filePath, modelInfo: m });  // Include full model info
          modelMap[filePath] = m;  // Store for lookup
        }
        setModelOptions(items);
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
              onChange(val, selected?.modelInfo);  // Pass file path and model info
            }}
            showSearch
            disabled={disabled || !modelOptions.length}
          />
        )}
      </Form.Item>
    </Form>
  );
}
