import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Layout,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Pagination,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../../config';
import ReleaseImageViewerModal from './ReleaseImageViewerModal';

const { Content } = Layout;
const { Title, Text } = Typography;

function TileThumbnail({ src, filename, selected, onClick, onToggle, badges = [] }) {
  return (
    <Card
      hoverable
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: selected ? '2px solid #7c3aed' : '1px solid #dbe4f0',
        boxShadow: selected ? '0 8px 24px rgba(124, 58, 237, 0.18)' : '0 6px 18px rgba(15, 23, 42, 0.08)',
        background: '#fff',
      }}
      bodyStyle={{ padding: 10 }}
    >
      <div
        onClick={onClick}
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '100%',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#f3f6fb',
          cursor: 'pointer',
          marginBottom: 10,
        }}
      >
        <img
          src={src}
          alt={filename}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#f8fafc',
          }}
        />
      </div>

      <div style={{ minHeight: 38 }}>
        <Text strong style={{ display: 'block', color: '#0f172a' }} ellipsis={{ tooltip: filename }}>
          {filename}
        </Text>
        <Space size={[6, 6]} wrap style={{ marginTop: 8 }}>
          {badges}
        </Space>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {selected ? 'Included' : 'Excluded'}
        </Text>
        <Button
          size="small"
          type={selected ? 'primary' : 'default'}
          onClick={onToggle}
          style={selected ? { background: '#7c3aed', borderColor: '#7c3aed' } : undefined}
        >
          {selected ? 'Remove' : 'Include'}
        </Button>
      </div>
    </Card>
  );
}

const splitColor = {
  train: 'purple',
  val: 'blue',
  test: 'green',
};

const ratioOptions = [
  { label: '1:0.5', value: 0.5 },
  { label: '1:1', value: 1 },
  { label: '1:2', value: 2 },
  { label: '1:3', value: 3 },
];

const normalizeAnnotationKey = (value = '') => String(value).replace(/\\/g, '/');
const PAGE_SIZE = 50;
const SPLIT_ORDER = ['train', 'val', 'test'];

const formatCount = (value) => Number(value || 0).toLocaleString();

const formatSplitName = (split) => {
  if (!split) return 'Unknown';
  return `${split.charAt(0).toUpperCase()}${split.slice(1)}`;
};

function SplitSummaryCard({ title, total, color, background, rows, equation = false }) {
  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 12,
        background,
        minHeight: 178,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
      }}
      bodyStyle={{ padding: '18px 20px' }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {title}
      </Text>
      <div style={{ fontSize: 26, lineHeight: 1.1, fontWeight: 700, color, marginBottom: 14 }}>
        {formatCount(total)}
      </div>
      <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: 10 }}>
        {(rows || []).map((row) => (
          <div
            key={row.split}
            style={{
              display: 'grid',
              gridTemplateColumns: equation ? '72px 1fr' : '72px 1fr',
              columnGap: 8,
              alignItems: 'center',
              marginBottom: 7,
              fontSize: 13,
            }}
          >
            <Text strong style={{ color: '#334155' }}>{formatSplitName(row.split)}</Text>
            {equation ? (
              <Text style={{ color: '#475569' }}>
                {formatCount(row.labeled)} labeled + {formatCount(row.unlabeled)} unlabeled = <strong>{formatCount(row.total)}</strong>
              </Text>
            ) : (
              <Text style={{ color: '#475569' }}>
                <strong>{formatCount(row.total)}</strong> tiles
              </Text>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const TileBalanceWorkspace = ({ release, onBackToDetails, onBalancedReleaseCreated }) => {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tileImages, setTileImages] = useState([]);
  const [annotations, setAnnotations] = useState({});
  const [classMapping, setClassMapping] = useState({});
  const [manualTab, setManualTab] = useState('labeled');
  const [mode, setMode] = useState('automatic');
  const [ratioValue, setRatioValue] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [labeledPage, setLabeledPage] = useState(1);
  const [unlabeledPage, setUnlabeledPage] = useState(1);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    const loadTiles = async () => {
      if (!release?.id) return;
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}/package-info`);
        if (!response.ok) {
          throw new Error(`Failed to load release package info: ${response.status}`);
        }

        const packageData = await response.json();
        const packageAnnotations = packageData.annotations || {};
        const normalizedAnnotations = new Map(
          Object.entries(packageAnnotations).map(([key, value]) => [normalizeAnnotationKey(key), value])
        );
        const imageFiles = packageData.image_files || {};

        const images = [];
        let nextId = 1;

        ['train', 'val', 'test'].forEach((split) => {
          (imageFiles[split] || []).forEach((fullPath) => {
            const filename = fullPath.split('/').pop();
            const annotationFile = `labels/${split}/${filename.replace(/\.(jpg|jpeg|png|bmp|webp|tif|tiff)$/i, '.txt')}`;
            const normalizedFullPath = normalizeAnnotationKey(fullPath);
            const backslashFullPath = fullPath.replace(/\//g, '\\');
            const normalizedAnnotationFile = normalizeAnnotationKey(annotationFile);
            const backslashAnnotationFile = annotationFile.replace(/\//g, '\\');
            const possibleKeys = [
              fullPath,
              normalizedFullPath,
              backslashFullPath,
              filename,
              annotationFile,
              normalizedAnnotationFile,
              backslashAnnotationFile,
            ];
            let imageAnnotations = null;
            for (const key of possibleKeys) {
              const directMatch = packageAnnotations[key];
              if (directMatch !== undefined) {
                imageAnnotations = directMatch;
                break;
              }
              const normalizedMatch = normalizedAnnotations.get(normalizeAnnotationKey(key));
              if (normalizedMatch !== undefined) {
                imageAnnotations = normalizedMatch;
                break;
              }
            }

            const hasAnnotations = Array.isArray(imageAnnotations) ? imageAnnotations.length > 0 : !!imageAnnotations;

            images.push({
              id: nextId++,
              filename,
              fullPath,
              path: fullPath,
              split,
              thumbnailUrl: `${API_BASE_URL}/api/v1/releases/${release.id}/file/${fullPath}?thumbnail=true`,
              fullImageUrl: `${API_BASE_URL}/api/v1/releases/${release.id}/file/${fullPath}`,
              hasAnnotations,
            });
          });
        });

        setTileImages(images);
        setAnnotations(packageAnnotations);
        setClassMapping(packageData.class_mapping || {});
        setLabeledPage(1);
        setUnlabeledPage(1);

        const initialSelection = new Set(images.filter((img) => img.hasAnnotations).map((img) => img.id));
        setSelectedIds(initialSelection);
      } catch (error) {
        console.error(error);
        message.error('Failed to load tile balance images');
      } finally {
        setLoading(false);
      }
    };

    loadTiles();
  }, [release]);

  const labeledTiles = useMemo(() => tileImages.filter((img) => img.hasAnnotations), [tileImages]);
  const unlabeledTiles = useMemo(() => tileImages.filter((img) => !img.hasAnnotations), [tileImages]);

  const selectedLabeledCount = useMemo(
    () => labeledTiles.filter((img) => selectedIds.has(img.id)).length,
    [labeledTiles, selectedIds]
  );
  const selectedUnlabeledCount = useMemo(
    () => unlabeledTiles.filter((img) => selectedIds.has(img.id)).length,
    [unlabeledTiles, selectedIds]
  );

  const selectedLabeledTiles = useMemo(
    () => labeledTiles.filter((img) => selectedIds.has(img.id)),
    [labeledTiles, selectedIds]
  );

  const splitNames = useMemo(() => {
    const allSplits = new Set(tileImages.map((img) => img.split).filter(Boolean));
    return [
      ...SPLIT_ORDER.filter((split) => allSplits.has(split)),
      ...Array.from(allSplits).filter((split) => !SPLIT_ORDER.includes(split)),
    ];
  }, [tileImages]);

  const automaticUnlabeledTiles = useMemo(() => {
    return splitNames.flatMap((split) => {
      const labeledInSplit = selectedLabeledTiles.filter((img) => img.split === split).length;
      const target = Math.floor(labeledInSplit * ratioValue);
      if (target <= 0) return [];
      return unlabeledTiles.filter((img) => img.split === split).slice(0, target);
    });
  }, [ratioValue, selectedLabeledTiles, splitNames, unlabeledTiles]);

  const automaticUnlabeledCount = automaticUnlabeledTiles.length;

  const automaticFinalCount = selectedLabeledCount + automaticUnlabeledCount;
  const manualFinalCount = selectedLabeledCount + selectedUnlabeledCount;

  const automaticSelectedTiles = useMemo(() => {
    return [...selectedLabeledTiles, ...automaticUnlabeledTiles];
  }, [automaticUnlabeledTiles, selectedLabeledTiles]);

  const manualSelectedTiles = useMemo(
    () => tileImages.filter((img) => selectedIds.has(img.id)),
    [tileImages, selectedIds]
  );

  const splitSummaryRows = useMemo(() => {
    return splitNames.map((split) => {
      const labeledTotal = labeledTiles.filter((img) => img.split === split).length;
      const unlabeledTotal = unlabeledTiles.filter((img) => img.split === split).length;
      const selectedLabeled = selectedLabeledTiles.filter((img) => img.split === split).length;
      const selectedUnlabeledSource = mode === 'automatic'
        ? automaticUnlabeledTiles
        : unlabeledTiles.filter((img) => selectedIds.has(img.id));
      const selectedUnlabeled = selectedUnlabeledSource.filter((img) => img.split === split).length;

      return {
        split,
        labeledTotal,
        unlabeledTotal,
        selectedLabeled,
        selectedUnlabeled,
        expectedTotal: selectedLabeled + selectedUnlabeled,
      };
    });
  }, [
    automaticUnlabeledTiles,
    labeledTiles,
    mode,
    selectedIds,
    selectedLabeledTiles,
    splitNames,
    unlabeledTiles,
  ]);

  const currentTileSet = manualTab === 'labeled' ? labeledTiles : unlabeledTiles;
  const currentPage = manualTab === 'labeled' ? labeledPage : unlabeledPage;
  const paginatedTileSet = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return currentTileSet.slice(start, start + PAGE_SIZE);
  }, [currentTileSet, currentPage]);

  const toggleSelection = (tile) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tile.id)) next.delete(tile.id);
      else next.add(tile.id);
      return next;
    });
  };

  const openViewer = (tile) => {
    const idx = tileImages.findIndex((img) => img.id === tile.id);
    if (idx >= 0) {
      setViewerIndex(idx);
      setViewerVisible(true);
    }
  };

  const handleCreateBalancedRelease = async () => {
    const selectedTiles = mode === 'automatic' ? automaticSelectedTiles : manualSelectedTiles;
    if (!selectedTiles.length) {
      message.warning('No tiles selected for the balanced child release');
      return;
    }

    setCreating(true);
    try {
      // This creates a child release from the already-exported parent release ZIP.
      // We only send the chosen tile paths; backend reuses the parent package assets.
      const response = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}/tile-balance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          ratio_value: mode === 'automatic' ? ratioValue : null,
          selected_image_paths: selectedTiles.map((tile) => tile.fullPath),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create balanced child release');
      }

      const result = await response.json();
      if (!result?.release) {
        throw new Error('Balanced child release response was incomplete');
      }

      onBalancedReleaseCreated && onBalancedReleaseCreated(result.release);
    } catch (error) {
      console.error(error);
      message.error(error.message || 'Failed to create balanced child release');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout style={{ background: '#fafafa', minHeight: '100vh' }}>
      <Content style={{ padding: 3 }}>
        <div style={{ marginBottom: 12 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Space direction="vertical" size={2}>
                <Space>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    type="text"
                    size="large"
                    onClick={onBackToDetails}
                  >
                    Back to Release Details
                  </Button>
                  <Divider type="vertical" />
                  <Title level={3} style={{ margin: 0 }}>
                    Tile Balance
                  </Title>
                </Space>
                <Text type="secondary">
                  Review labeled and unlabeled tiles from <strong>{release?.name}</strong> and prepare a balanced child release.
                </Text>
              </Space>
            </Col>
          </Row>
        </div>

        <Card style={{ marginBottom: 16, borderRadius: 12, boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12} xl={16}>
              <Space size={12} wrap>
                <Tag color="purple" style={{ padding: '6px 10px', borderRadius: 999 }}>Parent Release</Tag>
                <Text strong>{release?.name}</Text>
                <Tag color="geekblue">{release?.export_format?.toUpperCase() || 'YOLO'}</Tag>
              </Space>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <Space wrap style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Segmented
                  options={[
                    { label: 'Automatic Balance', value: 'automatic' },
                    { label: 'Manual Selection', value: 'manual' },
                  ]}
                  value={mode}
                  onChange={setMode}
                />
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <SplitSummaryCard
              title="Labeled Tiles"
              total={labeledTiles.length}
              color="#7c3aed"
              background="linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)"
              rows={splitSummaryRows.map((row) => ({
                split: row.split,
                total: row.labeledTotal,
              }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <SplitSummaryCard
              title="Unlabeled Tiles"
              total={unlabeledTiles.length}
              color="#16a34a"
              background="linear-gradient(135deg, #fbfffb 0%, #eefbf0 100%)"
              rows={splitSummaryRows.map((row) => ({
                split: row.split,
                total: row.unlabeledTotal,
              }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <SplitSummaryCard
              title={mode === 'automatic' ? 'Expected Balanced Total' : 'Selected Tile Total'}
              total={mode === 'automatic' ? automaticFinalCount : manualFinalCount}
              color="#ea580c"
              background="linear-gradient(135deg, #fffaf5 0%, #fff2e8 100%)"
              equation
              rows={splitSummaryRows.map((row) => ({
                split: row.split,
                labeled: row.selectedLabeled,
                unlabeled: row.selectedUnlabeled,
                total: row.expectedTotal,
              }))}
            />
          </Col>
        </Row>

        {loading ? (
          <Card style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading tile thumbnails...</div>
            </div>
          </Card>
        ) : mode === 'automatic' ? (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card
                title={<Space><FilterOutlined />Automatic Balance</Space>}
                style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)' }}
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 18, borderRadius: 12 }}
                  message="Automatic mode keeps all labeled tiles and selects unlabeled tiles by ratio."
                  description="This is the quick path for balancing tile-heavy releases before training."
                />

                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Unlabeled Keep Ratio</Text>
                  <Segmented options={ratioOptions} value={ratioValue} onChange={setRatioValue} />
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card
                title={<Space><CheckCircleOutlined />Balance Preview</Space>}
                style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)' }}
              >
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">Labeled tiles kept</Text>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#7c3aed' }}>{selectedLabeledCount}</div>
                  </div>
                  <div>
                    <Text type="secondary">Unlabeled tiles selected</Text>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}>{automaticUnlabeledCount}</div>
                  </div>
                  <div>
                    <Text type="secondary">Final child release total</Text>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#2563eb' }}>{automaticFinalCount}</div>
                  </div>
                  <Alert
                    type="success"
                    showIcon
                    style={{ borderRadius: 12 }}
                    message="Child release flow ready"
                    description="This will create a balanced child release linked by parent_release_id and place it in Release History."
                  />
                  <Button
                    type="primary"
                    size="large"
                    loading={creating}
                    onClick={handleCreateBalancedRelease}
                    style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  >
                    Create Balanced Release
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={17}>
              <Card style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)' }}>
                <Tabs
                  activeKey={manualTab}
                  onChange={setManualTab}
                  items={[
                    {
                      key: 'labeled',
                      label: `Labeled Tiles (${labeledTiles.length})`,
                      children: labeledTiles.length ? (
                        <Space direction="vertical" size={16} style={{ width: '100%' }}>
                          <Row gutter={[16, 16]}>
                            {paginatedTileSet.map((tile) => (
                              <Col xs={24} sm={12} md={8} xl={6} key={tile.id}>
                                <TileThumbnail
                                  src={tile.thumbnailUrl}
                                  filename={tile.filename}
                                  selected={selectedIds.has(tile.id)}
                                  onClick={() => openViewer(tile)}
                                  onToggle={() => toggleSelection(tile)}
                                  badges={[
                                    <Tag key="status" color="green" icon={<TagsOutlined />}>Labeled</Tag>,
                                    <Tag key="split" color={splitColor[tile.split] || 'default'}>{tile.split}</Tag>,
                                  ]}
                                />
                              </Col>
                            ))}
                          </Row>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Pagination
                              current={labeledPage}
                              pageSize={PAGE_SIZE}
                              total={labeledTiles.length}
                              onChange={setLabeledPage}
                              showSizeChanger={false}
                            />
                          </div>
                        </Space>
                      ) : (
                        <Empty description="No labeled tiles found in this release" />
                      ),
                    },
                    {
                      key: 'unlabeled',
                      label: `Unlabeled Tiles (${unlabeledTiles.length})`,
                      children: unlabeledTiles.length ? (
                        <Space direction="vertical" size={16} style={{ width: '100%' }}>
                          <Row gutter={[16, 16]}>
                            {paginatedTileSet.map((tile) => (
                              <Col xs={24} sm={12} md={8} xl={6} key={tile.id}>
                                <TileThumbnail
                                  src={tile.thumbnailUrl}
                                  filename={tile.filename}
                                  selected={selectedIds.has(tile.id)}
                                  onClick={() => openViewer(tile)}
                                  onToggle={() => toggleSelection(tile)}
                                  badges={[
                                    <Tag key="status" color="default">Unlabeled</Tag>,
                                    <Tag key="split" color={splitColor[tile.split] || 'default'}>{tile.split}</Tag>,
                                  ]}
                                />
                              </Col>
                            ))}
                          </Row>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Pagination
                              current={unlabeledPage}
                              pageSize={PAGE_SIZE}
                              total={unlabeledTiles.length}
                              onChange={setUnlabeledPage}
                              showSizeChanger={false}
                            />
                          </div>
                        </Space>
                      ) : (
                        <Empty description="No unlabeled tiles found in this release" />
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={7}>
              <Card
                title={<Space><AppstoreOutlined />Selection Summary</Space>}
                style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)' }}
              >
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Statistic title="Labeled selected" value={selectedLabeledCount} valueStyle={{ color: '#7c3aed' }} />
                  <Statistic title="Unlabeled selected" value={selectedUnlabeledCount} valueStyle={{ color: '#16a34a' }} />
                  <Statistic title="Final child release total" value={manualFinalCount} valueStyle={{ color: '#2563eb' }} />
                  <Alert
                    type="info"
                    showIcon
                    style={{ borderRadius: 12 }}
                    message="Manual review mode"
                    description="Labeled tiles start included. Remove bad labeled tiles or add selected unlabeled tiles before creating the child release."
                  />
                  <Button
                    type="primary"
                    size="large"
                    loading={creating}
                    onClick={handleCreateBalancedRelease}
                    style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  >
                    Create Balanced Release
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        )}

        <ReleaseImageViewerModal
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
          images={tileImages}
          currentIndex={viewerIndex}
          onIndexChange={setViewerIndex}
          releaseId={release?.id}
          annotations={annotations}
          classMapping={classMapping}
          showAnnotations
        />
      </Content>
    </Layout>
  );
};

export default TileBalanceWorkspace;
