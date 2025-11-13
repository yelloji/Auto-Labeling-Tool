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
        const firstZip = (Array.isArray(releases) ? releases : [])
          .find((r) => String(r?.model_path || '').toLowerCase().endsWith('.zip'));
        if (firstZip && !datasetZipPath) {
          onChange({ datasetZipPath: firstZip.model_path });
        }
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
      {true && (
        <Form.Item label="Release ZIP file" required tooltip="Pick a release ZIP from DB or type a path. Exactly one .zip.">
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder={loadingReleases ? 'Loading releases…' : (projectReleases && projectReleases.length ? 'Select a release ZIP from this project' : 'No releases available for this project')}
            value={datasetZipPath || undefined}
            onChange={(val) => onChange({ datasetZipPath: val })}
            optionFilterProp="label"
            disabled={loadingReleases || !(projectReleases && projectReleases.length)}
          >
            {(projectReleases || [])
              .filter((r) => String(r?.model_path || '').toLowerCase().endsWith('.zip'))
              .map((r) => {
                const filename = String(r?.model_path || '').split(/[\\/]/).pop();
                const label = `${r?.name || r?.release_version || filename || 'Release'} — ${filename || ''}`;
                const value = r?.model_path || '';
                return (
                  <Select.Option key={r?.id || value} value={value} label={label}>
                    {label}
                  </Select.Option>
                );
              })}
          </Select>
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
