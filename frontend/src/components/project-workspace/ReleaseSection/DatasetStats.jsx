




import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Tag, Spin, Alert } from 'antd';
import { PictureOutlined, TagsOutlined, FileTextOutlined } from '@ant-design/icons';

const DatasetStats = ({ selectedDatasets = [] }) => {
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
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedDatasets || selectedDatasets.length === 0) {
        setStats({
          total_images: 0,
          num_classes: 0,
          total_annotations: 0,
          splits: {
            train: 0,
            val: 0,
            test: 0
          }
        });
        return;
      }
      
      setLoading(true);
      
      try {
        // Calculate basic stats from available dataset data
        const totalImages = selectedDatasets.reduce((sum, dataset) => sum + (dataset.total_images || 0), 0);
        const totalLabeled = selectedDatasets.reduce((sum, dataset) => sum + (dataset.labeled_images || 0), 0);
        const totalAnnotations = totalLabeled;
        
        // Fetch actual unique classes from annotations
        const uniqueClasses = new Set();
        
        for (const dataset of selectedDatasets) {
          try {
            // Get dataset details to access images
            const datasetResponse = await fetch(`http://localhost:12000/api/v1/datasets/${dataset.id}`);
            if (datasetResponse.ok) {
              const datasetData = await datasetResponse.json();
              
              // For each image, fetch its annotations to count unique classes
              if (datasetData.recent_images) {
                for (const image of datasetData.recent_images) {
                  try {
                    const annotationsResponse = await fetch(`http://localhost:12000/api/v1/images/${image.id}/annotations`);
                    if (annotationsResponse.ok) {
                      const annotations = await annotationsResponse.json();
                      annotations.forEach(annotation => {
                        if (annotation.class_name) {
                          uniqueClasses.add(annotation.class_name);
                        }
                      });
                    }
                  } catch (error) {
                    console.error('Error fetching annotations for image:', image.id, error);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching dataset details:', error);
          }
        }
        
        const actualClassCount = uniqueClasses.size || 1;
        
        // Fetch real split data for each dataset
        let totalTrainCount = 0;
        let totalValCount = 0;
        let totalTestCount = 0;
        
        for (const dataset of selectedDatasets) {
          try {
            const response = await fetch(`http://localhost:12000/api/v1/datasets/${dataset.id}/split-stats`);
            if (response.ok) {
              const splitData = await response.json();
              totalTrainCount += splitData.train || 0;
              totalValCount += splitData.val || 0;
              totalTestCount += splitData.test || 0;
            }
          } catch (error) {
            console.error(`Failed to fetch split stats for dataset ${dataset.id}:`, error);
            // Fallback to estimation for this dataset
            const datasetImages = dataset.total_images || 0;
            totalTrainCount += Math.floor(datasetImages * 0.7);
            totalValCount += Math.floor(datasetImages * 0.2);
            totalTestCount += Math.floor(datasetImages * 0.1);
          }
        }
        
        setStats({
          total_images: totalImages,
          num_classes: actualClassCount,
          total_annotations: totalAnnotations,
          splits: {
            train: totalTrainCount,
            val: totalValCount,
            test: totalTestCount
          }
        });
      } catch (error) {
        console.error('Error calculating dataset stats:', error);
        // Fallback to basic calculation
        const totalImages = selectedDatasets.reduce((sum, dataset) => sum + (dataset.total_images || 0), 0);
        const totalLabeled = selectedDatasets.reduce((sum, dataset) => sum + (dataset.labeled_images || 0), 0);
        
        setStats({
          total_images: totalImages,
          num_classes: 1,
          total_annotations: totalLabeled,
          splits: {
            train: Math.floor(totalImages * 0.7),
            val: Math.floor(totalImages * 0.2),
            test: Math.floor(totalImages * 0.1)
          }
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [selectedDatasets]);

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




