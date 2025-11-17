import React, { useEffect, useState } from 'react';
import { Form, Alert, Tag, Space, Select, Button, Card, Typography } from 'antd';
import { releasesAPI, trainingAPI } from '../../../../services/api';

export default function TrainingDatasetSection({ projectId, datasetSource, datasetZipPath, classes, isDeveloper, onChange }) {
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [projectReleases, setProjectReleases] = useState([]);
  const [checkingExtract, setCheckingExtract] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState({ extracted: false, target_dir: '' });
  const zipName = datasetZipPath ? datasetZipPath.split(/[\\/]/).pop() : '';
  const isZip = datasetZipPath?.toLowerCase().endsWith('.zip');
  const getZipPath = (r) => String(r?.model_path || r?.path || r?.release_zip || r?.zip_path || '').trim();
  const hasZip = (projectReleases || []).some((r) => getZipPath(r).toLowerCase().endsWith('.zip'));

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

  useEffect(() => {
    const check = async () => {
      const zp = (datasetZipPath || '').trim();
      if (!zp || !zp.toLowerCase().endsWith('.zip')) {
        setExtractedInfo({ extracted: false, target_dir: '' });
        return;
      }
      setCheckingExtract(true);
      try {
        const info = await trainingAPI.checkExtracted(zp);
        setExtractedInfo({ extracted: Boolean(info?.extracted), target_dir: String(info?.target_dir || '') });
      } catch (e) {
        setExtractedInfo({ extracted: false, target_dir: '' });
      } finally {
        setCheckingExtract(false);
      }
    };
    check();
  }, [datasetZipPath]);

  return (
    <Form layout="vertical">
      <Form.Item label="Release" required>
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder={loadingReleases ? 'Loading releases…' : ((projectReleases && projectReleases.length) ? 'Select a release' : 'No releases available for this project')}
            value={datasetZipPath || undefined}
            onChange={(val) => onChange({ datasetZipPath: val })}
            optionFilterProp="label"
            disabled={loadingReleases || !(projectReleases && projectReleases.length)}
          >
            {(projectReleases || []).map((r) => {
              const label = r?.name || r?.release_version || 'Release';
              const value = getZipPath(r);
              const isItemZip = value.toLowerCase().endsWith('.zip');
              return (
                <Select.Option key={r?.id || value || label} value={isItemZip ? value : undefined} label={label} disabled={!isItemZip}>
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
            {extractedInfo?.target_dir && (
              <div>Target: <code>{extractedInfo.target_dir}</code></div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <Tag color={isZip ? 'blue' : 'red'}>{isZip ? 'ZIP selected' : 'Select .zip'}</Tag>
            {isZip && (
              <div style={{ marginTop: 6 }}>
                {extractedInfo.extracted ? (
                  <Tag color="green">Extracted</Tag>
                ) : (
                  <Button size="small" type="primary" loading={checkingExtract}
                    onClick={async () => {
                      try {
                        const res = await trainingAPI.extractRelease(datasetZipPath);
                        if (res?.target_dir) setExtractedInfo({ extracted: true, target_dir: res.target_dir });
                      } catch (e) {}
                    }}
                  >Extract</Button>
                )}
              </div>
            )}
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
