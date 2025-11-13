import React, { useEffect, useState } from 'react';
import { Form, Alert, Tag, Space, Select, Spin, Card, Typography } from 'antd';
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
      <Form.Item label="Release" required>
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
      </Form.Item>

      <Card size="small" style={{ marginTop: 8 }} bodyStyle={{ padding: 12 }}>
        <Typography.Text strong>Release Summary</Typography.Text>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div>File: <code>{zipName || '—'}</code></div>
            <div>Classes: <code>{Array.isArray(classes) && classes.length ? classes.length : 'auto from data.yaml'}</code></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Tag color={isZip ? 'blue' : 'red'}>{isZip ? 'ZIP selected' : 'Select .zip'}</Tag>
          </div>
        </div>
      </Card>

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
