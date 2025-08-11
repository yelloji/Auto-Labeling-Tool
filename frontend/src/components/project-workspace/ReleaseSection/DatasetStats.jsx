import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Tag, Spin, Alert, Button, Modal, InputNumber, message, Progress } from 'antd';
import { PictureOutlined, TagsOutlined, FileTextOutlined, SyncOutlined } from '@ant-design/icons';

const DatasetStats = ({ selectedDatasets = [] }) => {
  const [stats, setStats] = useState({
    total_images: 0,
    num_classes: 0,
    total_annotations: 0,
    splits: { train: 0, val: 0, test: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [rebalanceModalVisible, setRebalanceModalVisible] = useState(false);
  const [trainCount, setTrainCount] = useState(7);
  const [valCount, setValCount] = useState(2);
  const [testCount, setTestCount] = useState(1);
  const [totalAvailableImages, setTotalAvailableImages] = useState(10);

  useEffect(() => { fetchStats(); }, [selectedDatasets]);

  const fetchStats = async () => {
    if (!selectedDatasets || selectedDatasets.length === 0) {
      setStats({ total_images: 0, num_classes: 0, total_annotations: 0, splits: { train: 0, val: 0, test: 0 } });
      return;
    }
    setLoading(true);
    try {
      const totalImages = selectedDatasets.reduce((sum, ds) => sum + (ds.total_images || 0), 0);
      const totalLabeled = selectedDatasets.reduce((sum, ds) => sum + (ds.labeled_images || 0), 0);
      const totalAnnotations = totalLabeled;
      const uniqueClasses = new Set();

      for (const ds of selectedDatasets) {
        try {
          const res = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.recent_images) {
              for (const img of data.recent_images) {
                try {
                  const aRes = await fetch(`http://localhost:12000/api/v1/images/${img.id}/annotations`);
                  if (aRes.ok) {
                    const anns = await aRes.json();
                    anns.forEach(a => { if (a.class_name) uniqueClasses.add(a.class_name); });
                  }
                } catch (e) { console.error('Annotation fetch error:', img.id, e); }
              }
            }
          }
        } catch (e) { console.error('Dataset fetch error:', e); }
      }

      let train = 0, val = 0, test = 0;
      for (const ds of selectedDatasets) {
        try {
          const res = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}/split-stats`);
          if (res.ok) {
            const split = await res.json();
            train += split.train || 0;
            val += split.val || 0;
            test += split.test || 0;
          }
        } catch (e) { console.error('Split stats error:', e); }
      }

      setStats({
        total_images: totalImages,
        num_classes: uniqueClasses.size || 1,
        total_annotations: totalAnnotations,
        splits: { train, val, test }
      });

      setTotalAvailableImages(totalLabeled);
      setTrainCount(train);
      setValCount(val);
      setTestCount(test);

    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRebalance = () => setRebalanceModalVisible(true);
  const handleCancelRebalance = () => setRebalanceModalVisible(false);

  const handleSaveRebalance = async () => {
    const total = trainCount + valCount + testCount;
    if (total !== totalAvailableImages) {
      message.error(`Total images must equal ${totalAvailableImages}. Got ${total}`);
      return;
    }
    try {
      setLoading(true);
      for (const ds of selectedDatasets) {
        const labeled = ds.labeled_images || 0;
        if (labeled === 0) continue;

        const trainR = trainCount / totalAvailableImages;
        const valR = valCount / totalAvailableImages;
        const testR = testCount / totalAvailableImages;

        let train = Math.floor(labeled * trainR);
        let val = Math.floor(labeled * valR);
        let test = Math.floor(labeled * testR);

        // Fix rounding error: ensure total matches exactly
        let leftover = labeled - (train + val + test);

        // Distribute the leftover to the splits with highest decimal leftovers
        const splits = [
          { key: 'train', val: labeled * trainR - train },
          { key: 'val', val: labeled * valR - val },
          { key: 'test', val: labeled * testR - test }
        ];

        // Sort by highest leftover
        splits.sort((a, b) => b.val - a.val);

        for (let i = 0; i < leftover; i++) {
          if (splits[i % 3].key === 'train') train++;
          else if (splits[i % 3].key === 'val') val++;
          else if (splits[i % 3].key === 'test') test++;
        }


        const req = { train_count: train, val_count: val, test_count: test };
        const res = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}/rebalance`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req)
        });
        if (!res.ok) throw new Error(`Failed to rebalance ${ds.name}`);
        await res.json();
      }
      message.success('Rebalanced successfully');
      setRebalanceModalVisible(false);
      await fetchStats();
    } catch (err) {
      console.error('Rebalance error:', err);
      message.error(`Rebalance failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCountChange = (val, type) => {
    const v = Math.max(0, Math.min(val || 0, totalAvailableImages));
    if (type === 'train') setTrainCount(v);
    else if (type === 'val') setValCount(v);
    else if (type === 'test') setTestCount(v);
  };

  const getTotal = () => trainCount + valCount + testCount;
  const getRemaining = () => totalAvailableImages - getTotal();

  return (
    <Card title="Dataset Statistics" style={{ marginBottom: 24 }} className="dataset-stats-card">
      <Row gutter={16}>
        <Col span={8}><Statistic title="Total Images" value={stats.total_images} prefix={<PictureOutlined />} valueStyle={{ color: '#1890ff' }} /></Col>
        <Col span={8}><Statistic title="Number of Classes" value={stats.num_classes} prefix={<TagsOutlined />} valueStyle={{ color: '#52c41a' }} /></Col>
        <Col span={8}><Statistic title="Annotations" value={stats.total_annotations} prefix={<FileTextOutlined />} valueStyle={{ color: '#722ed1' }} /></Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h4>Split Distribution</h4>
            <Row gutter={8}>
              <Col><Tag color="blue">Train: {stats.splits.train}</Tag></Col>
              <Col><Tag color="geekblue">Val: {stats.splits.val}</Tag></Col>
              <Col><Tag color="purple">Test: {stats.splits.test}</Tag></Col>
            </Row>
          </Col>
          <Col><Button type="default" icon={<SyncOutlined />} onClick={handleRebalance} disabled={totalAvailableImages === 0}>Rebalance</Button></Col>
        </Row>
      </div>

      <Modal
        title="Rebalance Train/Test Split"
        open={rebalanceModalVisible}
        onOk={handleSaveRebalance}
        onCancel={handleCancelRebalance}
        okText="Save"
        cancelText="Cancel"
        width={600}
      >
        <p>You can update your dataset's train/test split here.</p>
        <Alert message="Note: changing test set affects version comparisons." type="warning" showIcon style={{ marginBottom: 20 }} />

        {['train', 'val', 'test'].map(type => (
          <Row align="middle" gutter={16} style={{ marginBottom: 16 }} key={type}>
            <Col span={6}><strong>{type.charAt(0).toUpperCase() + type.slice(1)}:</strong></Col>
            <Col span={12}>
              <InputNumber
                min={0}
                max={totalAvailableImages}
                value={type === 'train' ? trainCount : type === 'val' ? valCount : testCount}
                onChange={(v) => handleCountChange(v, type)}
                style={{ width: '100%' }}
                addonAfter="images"
              />
            </Col>
            <Col span={6}><Tag color={type === 'train' ? 'blue' : type === 'val' ? 'geekblue' : 'purple'}>{totalAvailableImages > 0 ? Math.round(((type === 'train' ? trainCount : type === 'val' ? valCount : testCount) / totalAvailableImages) * 100) : 0}%</Tag></Col>
          </Row>
        ))}

        <div style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col><strong>Total: {getTotal()} / {totalAvailableImages}</strong></Col>
            <Col>
              {getRemaining() !== 0 ? (
                <Tag color={getRemaining() > 0 ? 'orange' : 'red'}>{getRemaining() > 0 ? `${getRemaining()} remaining` : `${-getRemaining()} over limit`}</Tag>
              ) : <Tag color="green">Perfect match!</Tag>}
            </Col>
          </Row>
          <Progress percent={Math.min((getTotal() / totalAvailableImages) * 100, 100)} status={getTotal() === totalAvailableImages ? 'success' : getTotal() > totalAvailableImages ? 'exception' : 'active'} />
        </div>

        <Alert message="This will reassign labeled images per your split plan." type="info" showIcon />
      </Modal>
    </Card>
  );
};

export default DatasetStats;
