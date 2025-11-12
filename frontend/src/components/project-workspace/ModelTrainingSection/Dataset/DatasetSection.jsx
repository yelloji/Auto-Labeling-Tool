import React from 'react';
import { Form, Radio, Input, Alert } from 'antd';

export default function DatasetSection({ projectId, datasetSource, datasetZipPath, classes, isDeveloper, onChange }) {
  return (
    <Form layout="vertical">
      <Form.Item label="Dataset Source" required>
        <Radio.Group
          value={datasetSource}
          onChange={(e) => onChange({ datasetSource: e.target.value })}
        >
          <Radio.Button value="release_zip">Release ZIP (recommended)</Radio.Button>
          <Radio.Button value="custom_path" disabled>Custom Path (coming soon)</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {datasetSource === 'release_zip' && (
        <Form.Item label="Release ZIP path" required tooltip="Pick a ZIP from projects/<project>/releases; backend will auto-extract to training area.">
          <Input
            value={datasetZipPath}
            placeholder={`e.g., V:/.../projects/${projectId}/releases/RELEASE-2-CUFFIA-EXT_yolo_segmentation.zip`}
            onChange={(e) => onChange({ datasetZipPath: e.target.value })}
          />
        </Form.Item>
      )}

      <Alert
        type="info"
        showIcon
        message="Classes"
        description={
          <div>
            <code>{Array.isArray(classes) && classes.length ? classes.join(', ') : 'Will auto-fill from data.yaml after extraction'}</code>
            {!isDeveloper && (
              <div style={{ marginTop: 6 }}>
                Editing classes is available in Developer mode.
              </div>
            )}
          </div>
        }
      />
    </Form>
  );
}