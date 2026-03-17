/**
 * ImportWithLabelsSection
 *
 * Lets the user select a folder containing images + label files
 * (YOLO .txt + data.yaml  OR  COCO annotations.json) and import
 * them into the project with annotations pre-populated.
 *
 * Supported formats:
 *   YOLO  — .txt per image + data.yaml
 *   COCO  — single annotations.json
 */

import React, { useState, useRef } from 'react';
import {
  Button, Input, Progress, Tag, Typography, Alert, Divider, Space
} from 'antd';
import {
  FolderOpenOutlined, CheckCircleOutlined, WarningOutlined, LoadingOutlined
} from '@ant-design/icons';
import { datasetsAPI } from '../../../services/api';

const { Text, Title } = Typography;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']);

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function detectFormat(files) {
  const names = files.map(f => f.name.toLowerCase());
  const hasJson  = names.some(n => n.endsWith('.json'));
  const hasTxt   = names.some(n => n.endsWith('.txt') && n !== 'data.yaml');
  const hasYaml  = names.includes('data.yaml');
  if (hasJson)               return 'coco';
  if (hasTxt && hasYaml)     return 'yolo';
  if (hasTxt && !hasYaml)    return 'yolo_missing_yaml';
  return 'no_labels';
}

function summariseFiles(files) {
  let images = 0, labels = 0, hasYaml = false, hasJson = false;
  for (const f of files) {
    const ext  = getExt(f.name);
    const low  = f.name.toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext))                          images++;
    else if (low === 'data.yaml')                           hasYaml = true;
    else if (ext === '.txt')                                labels++;
    else if (ext === '.json')                             { hasJson = true; labels++; }
  }
  return { images, labels, hasYaml, hasJson };
}

const ImportWithLabelsSection = ({ projectId }) => {
  const folderInputRef  = useRef(null);

  const [files,       setFiles]       = useState([]);
  const [batchName,   setBatchName]   = useState('');
  const [format,      setFormat]      = useState(null);   // 'yolo'|'coco'|'yolo_missing_yaml'|'no_labels'|null
  const [summary,     setSummary]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState(null);   // success response
  const [error,       setError]       = useState(null);

  // ── Folder selection ────────────────────────────────────────────────────────
  const handleFolderSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    // Auto-fill batch name from folder name
    if (!batchName) {
      const folderPath = selected[0].webkitRelativePath || '';
      const folderName = folderPath.split('/')[0] || 'imported-batch';
      setBatchName(folderName);
    }

    const fmt  = detectFormat(selected);
    const summ = summariseFiles(selected);
    setFiles(selected);
    setFormat(fmt);
    setSummary(summ);
    setResult(null);
    setError(null);
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!files.length)  return;
    if (!batchName.trim()) { setError('Please enter a batch name.'); return; }
    if (format === 'yolo_missing_yaml') {
      setError('data.yaml is required for YOLO format. Please include it in your folder.');
      return;
    }
    if (format === 'no_labels') {
      setError('No label files found. Include .txt + data.yaml (YOLO) or annotations.json (COCO).');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const res = await datasetsAPI.importWithLabels(
        projectId,
        batchName.trim(),
        files,
        (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      );
      setResult(res);
      setProgress(100);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Import failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFiles([]); setFormat(null); setSummary(null);
    setResult(null); setError(null); setProgress(0); setBatchName('');
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // ── Format badge ────────────────────────────────────────────────────────────
  const FormatBadge = () => {
    if (!format) return null;
    if (format === 'yolo')             return <Tag color="blue">YOLO detected</Tag>;
    if (format === 'coco')             return <Tag color="green">COCO detected</Tag>;
    if (format === 'yolo_missing_yaml') return <Tag color="red">YOLO — data.yaml missing</Tag>;
    if (format === 'no_labels')        return <Tag color="orange">No label files found</Tag>;
    return null;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 24 }}>
      <Divider />

      <Title level={5} style={{ marginBottom: 4 }}>
        Import Images with Labels
      </Title>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
        Select a folder containing images + label files. Supports YOLO (.txt + data.yaml) and COCO (annotations.json).
        Annotations are created automatically — no re-labeling needed.
      </Text>

      {/* Folder picker + batch name */}
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Space wrap>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => folderInputRef.current?.click()}
            disabled={loading}
          >
            Select Folder (images + labels)
          </Button>
          {/* Hidden folder input */}
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory="true"
            directory="true"
            multiple
            style={{ display: 'none' }}
            onChange={handleFolderSelect}
          />
          <FormatBadge />
        </Space>

        {/* File summary */}
        {summary && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {summary.images} image{summary.images !== 1 ? 's' : ''}
            {format === 'yolo' && `, ${Object.keys(files.filter(f => getExt(f.name) === '.txt')).length || summary.labels} label files, data.yaml ✓`}
            {format === 'coco' && `, annotations.json ✓`}
            {format === 'yolo_missing_yaml' && ` — ⚠ data.yaml not found`}
          </Text>
        )}

        {/* Batch name */}
        {files.length > 0 && (
          <Input
            placeholder="Batch name"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            style={{ maxWidth: 320 }}
            disabled={loading}
          />
        )}

        {/* Error */}
        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}

        {/* Import button */}
        {files.length > 0 && !result && (
          <Button
            type="primary"
            icon={loading ? <LoadingOutlined /> : undefined}
            onClick={handleImport}
            disabled={loading || format === 'yolo_missing_yaml' || format === 'no_labels'}
            loading={loading}
          >
            {loading ? 'Importing...' : 'Import'}
          </Button>
        )}

        {/* Progress */}
        {loading && (
          <Progress percent={progress} size="small" style={{ maxWidth: 400 }} />
        )}

        {/* Success result */}
        {result && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={
              <span>
                Import complete — <strong>{result.total_images}</strong> images,{' '}
                <strong>{result.total_annotations}</strong> annotations
                {' '}(<Tag color="blue" style={{ margin: 0 }}>{result.format_detected?.toUpperCase()}</Tag>)
              </span>
            }
            description={
              <div style={{ fontSize: 12, marginTop: 6 }}>
                {result.classes_created?.length > 0 && (
                  <div>New classes created: {result.classes_created.map(c => <Tag key={c} color="purple">{c}</Tag>)}</div>
                )}
                {result.classes_reused?.length > 0 && (
                  <div style={{ marginTop: 4 }}>Classes reused: {result.classes_reused.map(c => <Tag key={c}>{c}</Tag>)}</div>
                )}
                {result.warnings?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <WarningOutlined style={{ color: '#faad14' }} />{' '}
                    {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}:
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                <Button
                  size="small"
                  style={{ marginTop: 8 }}
                  onClick={reset}
                >
                  Import another batch
                </Button>
              </div>
            }
          />
        )}
      </Space>
    </div>
  );
};

export default ImportWithLabelsSection;
