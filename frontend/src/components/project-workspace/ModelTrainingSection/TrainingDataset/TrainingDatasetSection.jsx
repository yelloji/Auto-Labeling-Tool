import React, { useEffect, useState } from 'react';
import { Form, Alert, Tag, Space, Select, Button, Card, Typography } from 'antd';
import { releasesAPI, trainingAPI } from '../../../../services/api';

export default function TrainingDatasetSection({ projectId, datasetSource, datasetReleaseId, datasetZipPath, datasetReleaseDir, classes, datasetSummary, isDeveloper, hydratedIdentity, onChange, disabled }) {
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [projectReleases, setProjectReleases] = useState([]);
  const [checkingExtract, setCheckingExtract] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState({ extracted: false, target_dir: '' });
  const [summary, setSummary] = useState(datasetSummary || null);
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
          .find((r) => String(getZipPath(r) || '').toLowerCase().endsWith('.zip'));
        if (firstZip && hydratedIdentity && !datasetZipPath && !datasetReleaseDir && !datasetReleaseId) {
          onChange({ datasetReleaseId: firstZip.id, datasetZipPath: getZipPath(firstZip) });
        }
      } catch (e) {
        // swallow error, keep manual input
        setProjectReleases([]);
      } finally {
        setLoadingReleases(false);
      }
    };
    loadReleases();
  }, [projectId, hydratedIdentity, datasetReleaseDir, datasetZipPath, datasetReleaseId]);

  useEffect(() => {
    const check = async () => {
      const zp = (datasetZipPath || '').trim();
      if (!zp || !zp.toLowerCase().endsWith('.zip')) {
        setExtractedInfo({ extracted: false, target_dir: '' });
        setSummary(null);
        return;
      }
      setCheckingExtract(true);
      try {
        const info = await trainingAPI.checkExtracted(zp);
        setExtractedInfo({ extracted: Boolean(info?.extracted), target_dir: String(info?.target_dir || '') });
        if (info?.extracted && info?.target_dir) {
          try {
            const sum = await trainingAPI.datasetSummary({ releaseDir: info.target_dir });
            setSummary(sum);
            if (Array.isArray(sum?.classes)) {
              onChange({ classes: sum.classes });
            }
          } catch (e) {
            setSummary(null);
          }
        } else {
          setSummary(null);
        }
      } catch (e) {
        setExtractedInfo({ extracted: false, target_dir: '' });
        setSummary(null);
      } finally {
        setCheckingExtract(false);
      }
    };
    check();
  }, [datasetZipPath]);

  useEffect(() => {
    const refresh = async () => {
      const dir = String(datasetReleaseDir || '').trim();
      if (!dir) return;
      setExtractedInfo({ extracted: true, target_dir: dir });
      try {
        const sum = await trainingAPI.datasetSummary({ releaseDir: dir });
        setSummary(sum);
        if (Array.isArray(sum?.classes)) {
          onChange({ classes: sum.classes });
        }
      } catch (e) { }
    };
    refresh();
  }, [datasetReleaseDir]);

  return (
    <Form layout="vertical">
      <Form.Item label="Release" required>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={loadingReleases ? 'Loading releases…' : ((projectReleases && projectReleases.length) ? 'Select a release' : 'No releases available for this project')}
          value={(datasetReleaseId ? String(datasetReleaseId) : undefined)}
          onChange={(val) => {
            const rel = (projectReleases || []).find((r) => String(r?.id) === String(val));
            const zp = getZipPath(rel);
            onChange({ datasetReleaseId: String(val), datasetZipPath: zp });
          }}
          optionFilterProp="label"
          disabled={disabled || loadingReleases || !(projectReleases && projectReleases.length)}
        >
          {(projectReleases || []).map((r) => {
            const label = r?.name || r?.release_version || 'Release';
            const value = String(r?.id);
            const zp = getZipPath(r);
            const isItemZip = zp.toLowerCase().endsWith('.zip');
            return (
              <Select.Option key={r?.id || label} value={isItemZip ? value : undefined} label={label} disabled={!isItemZip}>
                {label}
              </Select.Option>
            );
          })}
        </Select>
      </Form.Item>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div />
        <div style={{ textAlign: 'right' }}>
          <Tag color={isZip ? 'blue' : 'red'}>{isZip ? 'ZIP selected' : 'Select .zip'}</Tag>
          {isZip && (
            <span style={{ marginLeft: 8 }}>
              {extractedInfo.extracted ? (
                <Tag color="green">Extracted</Tag>
              ) : (
                <Button size="small" type="primary" loading={checkingExtract} disabled={disabled}
                  onClick={async () => {
                    try {
                      const res = await trainingAPI.extractRelease(datasetZipPath);
                      if (res?.target_dir) setExtractedInfo({ extracted: true, target_dir: res.target_dir });
                    } catch (e) { }
                  }}
                >Extract</Button>
              )}
            </span>
          )}
        </div>
      </div>

      {summary && (
        <Card size="small" style={{ marginTop: 8 }} bodyStyle={{ padding: 12 }}>
          <Typography.Text strong>Dataset Summary</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <div>Train: <code>{summary?.splits?.train || 0}</code> • Val: <code>{summary?.splits?.val || 0}</code> • Test: <code>{summary?.splits?.test || 0}</code></div>
            <div>Classes (<code>{summary?.num_classes || (summary?.classes?.length || 0)}</code>): <code>{(summary?.classes || []).join(', ')}</code></div>
          </div>
        </Card>
      )}
    </Form>
  );
}
