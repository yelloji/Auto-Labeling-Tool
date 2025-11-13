import React, { useEffect, useState } from 'react';
import { Form, Radio, Input, Alert, Tag, Space, Select, Spin } from 'antd';
import { releasesAPI } from '../../../../services/api';

export default function DatasetSection({ projectId, datasetSource, datasetZipPath, classes, isDeveloper, onChange }) {
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [projectReleases, setProjectReleases] = useState([]);
  const zipName = datasetZipPath ? datasetZipPath.split(/[\\/]/).pop() : '';
  const isZip = datasetZipPath?.toLowerCase().endsWith('.zip');

  useEffect(() => {
    const loadReleases = async () => {
      if (!projectId) return;
      setLoadingReleases(true);
      try {
        const releases = await releasesAPI.getProjectReleases(projectId);
        setProjectReleases(Array.isArray(releases) ? releases : []);
      } catch (e) {
        // swallow error, keep manual input
        setProjectReleases([]);
      } finally {
        setLoadingReleases(false);
      }
    };
    loadReleases();
  }, [projectId]);

  return (
    <Form layout="vertical">
      <Form.Item label="Dataset Source" required>
        <Radio.Group
          value={datasetSource}
          onChange={(e) => onChange({ datasetSource: e.target.value })}
        >
          <Radio.Button value="release_zip">Release ZIP (recommended)</Radio.Button>
          <Radio.Button value="custom_path" disabled>Custom Path (developer)</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {datasetSource === 'release_zip' && (
        <Form.Item label="Release ZIP file" required tooltip="Pick a release ZIP from DB or type a path. Exactly one .zip.">
          {loadingReleases ? (
            <Spin size="small" />
          ) : projectReleases && projectReleases.length > 0 ? (
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Select a release ZIP from this project"
              value={datasetZipPath || undefined}
              onChange={(val) => onChange({ datasetZipPath: val })}
              optionFilterProp="label"
            >
              {projectReleases.map((r) => {
                const filename = String(r?.model_path || '').split(/[\\/]/).pop();
                const label = `${r?.name || r?.release_version || filename || 'Release'} — ${filename || ''}`;
                const value = r?.model_path || '';
                return (
                  <Select.Option key={r?.id || value} value={value} label={label}>
                    {label}
                  </Select.Option>
                );
              })}
              {/* Manual entry option */}
              <Select.Option key="__manual__" value={datasetZipPath || ''} label="Type manual path">
                Type manual path…
              </Select.Option>
            </Select>
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                allowClear
                value={datasetZipPath}
                placeholder={`e.g., V:/.../projects/${projectId}/releases/RELEASE-2-CUFFIA-EXT_yolo_segmentation.zip`}
                onChange={(e) => onChange({ datasetZipPath: e.target.value })}
              />
              {zipName && (
                <Tag color={isZip ? 'blue' : 'red'} style={{ alignSelf: 'center' }}>
                  {zipName}
                </Tag>
              )}
            </Space.Compact>
          )}
          {!isZip && datasetZipPath && (
            <div style={{ marginTop: 6, color: 'var(--ant-color-error)' }}>
              Please provide a .zip file path.
            </div>
          )}
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