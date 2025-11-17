import React from 'react';
import { Segmented, Tooltip } from 'antd';

export default function ModeToggle({ mode, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <strong>Mode</strong>
      </div>
      <Tooltip title="User mode: simple and safe. Developer mode: full control with advanced settings.">
        <Segmented
          value={mode}
          onChange={(val) => onChange(val)}
          options={[
            { label: 'User', value: 'user' },
            { label: 'Developer', value: 'developer' }
          ]}
        />
      </Tooltip>
    </div>
  );
}