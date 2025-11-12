import React from 'react';
import { Form, Input } from 'antd';

export default function IdentitySection({ projectId, trainingName, onChange }) {
  return (
    <Form layout="vertical">
      <Form.Item label="Project ID">
        <Input value={projectId} readOnly />
      </Form.Item>
      <Form.Item
        label="Training Name"
        tooltip="Unique per project. Use letters, numbers, dashes '-' and underscores '_' only. Spaces will be converted to underscores."
        required
      >
        <Input
          value={trainingName}
          placeholder="e.g., cuffia-ext-seg-2025-02-12-v1"
          onChange={(e) => {
            const raw = e.target.value || '';
            // Replace spaces with underscores and strip invalid chars
            const sanitized = raw.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
            onChange({ trainingName: sanitized });
          }}
          maxLength={64}
        />
      </Form.Item>
    </Form>
  );
}