import React from 'react';
import { Form, Input } from 'antd';

// Project ID is kept internally by the parent and sent to backend; no need to display here.
export default function IdentitySection({ trainingName, description, onChange }) {
  return (
    <Form layout="vertical">
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
      <Form.Item
        label="Description"
        tooltip="Short note about this training session"
      >
        <Input.TextArea
          value={description}
          placeholder="Add a short description…"
          rows={3}
          onChange={(e) => {
            const raw = e.target.value || '';
            onChange({ description: raw });
          }}
          maxLength={500}
        />
      </Form.Item>
    </Form>
  );
}