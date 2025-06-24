




import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Tag, Spin, Alert } from 'antd';
import { PictureOutlined, TagsOutlined, FileTextOutlined } from '@ant-design/icons';

const DatasetStats = ({ datasetId }) => {
  const [stats, setStats] = useState({
    total_images: 0,
    num_classes: 0,
    total_annotations: 0,
    splits: {
      train: 0,
      val: 0,
      test: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!datasetId) return;
    
    setLoading(true);
    fetch(`/api/v1/datasets/${datasetId}/stats`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch stats: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setStats(data);
        setError(null);
      })
      .catch(err => {
        console.error('Error fetching dataset stats:', err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [datasetId]);

  if (loading) {
    return (
      <Card title="Dataset Statistics" style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Dataset Statistics" style={{ marginBottom: 24 }}>
        <Alert
          message="Error Loading Stats"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card 
      title="Dataset Statistics" 
      style={{ marginBottom: 24 }}
      className="dataset-stats-card"
    >
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="Total Images"
            value={stats.total_images || 0}
            prefix={<PictureOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Number of Classes"
            value={stats.num_classes || 0}
            prefix={<TagsOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Annotations"
            value={stats.total_annotations || 0}
            prefix={<FileTextOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        <h4 style={{ marginBottom: 12, color: '#262626' }}>Split Distribution</h4>
        <Row gutter={8}>
          <Col>
            <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
              Train: {stats.splits?.train || 0}
            </Tag>
          </Col>
          <Col>
            <Tag color="geekblue" style={{ fontSize: '14px', padding: '4px 8px' }}>
              Val: {stats.splits?.val || 0}
            </Tag>
          </Col>
          <Col>
            <Tag color="purple" style={{ fontSize: '14px', padding: '4px 8px' }}>
              Test: {stats.splits?.test || 0}
            </Tag>
          </Col>
        </Row>
      </div>
    </Card>
  );
};

export default DatasetStats;




