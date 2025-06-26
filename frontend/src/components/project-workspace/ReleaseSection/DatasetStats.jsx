



import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Tag, Spin, Alert, Button, Modal, Slider, InputNumber, Space, message, Progress } from 'antd';
import { PictureOutlined, TagsOutlined, FileTextOutlined, SyncOutlined } from '@ant-design/icons';

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
  const [rebalanceModalVisible, setRebalanceModalVisible] = useState(false);
  const [trainCount, setTrainCount] = useState(7);
  const [valCount, setValCount] = useState(2);
  const [testCount, setTestCount] = useState(1);
  const [totalAvailableImages, setTotalAvailableImages] = useState(10);

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

        // Set total available images for rebalancing
        setTotalAvailableImages(totalLabeled);
        
        // Initialize counts with current split values
        setTrainCount(totalTrainCount);
        setValCount(totalValCount);
        setTestCount(totalTestCount);
        
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

        setTotalAvailableImages(totalLabeled);
        setTrainCount(Math.floor(totalLabeled * 0.7));
        setValCount(Math.floor(totalLabeled * 0.2));
        setTestCount(totalLabeled - Math.floor(totalLabeled * 0.7) - Math.floor(totalLabeled * 0.2));
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [selectedDatasets]);

  const handleRebalance = () => {
    setRebalanceModalVisible(true);
  };

  const handleSaveRebalance = async () => {
    const totalCount = trainCount + valCount + testCount;
    if (totalCount !== totalAvailableImages) {
      message.error(`Total images must equal ${totalAvailableImages}. Current total: ${totalCount}`);
      return;
    }

    try {
      setLoading(true);
      
      // Calculate percentages for backend API
      const trainPercent = Math.round((trainCount / totalAvailableImages) * 100);
      const valPercent = Math.round((valCount / totalAvailableImages) * 100);
      const testPercent = 100 - trainPercent - valPercent;
      
      // Call the backend API to rebalance all selected datasets
      for (const dataset of selectedDatasets) {
        const requestData = {
          method: 'assign_random',
          train_percent: trainPercent,
          val_percent: valPercent,
          test_percent: testPercent
        };
        
        console.log(`Rebalancing dataset ${dataset.id} with counts: Train=${trainCount}, Val=${valCount}, Test=${testCount}`);
        console.log(`Converted to percentages:`, requestData);
        
        // Use the existing API function from datasetsAPI
        const response = await fetch(`http://localhost:12000/api/v1/datasets/${dataset.id}/splits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to rebalance dataset ${dataset.name}`);
        }
        
        const result = await response.json();
        console.log(`Dataset ${dataset.name} rebalanced:`, result);
      }
      
      message.success('All datasets rebalanced successfully!');
      setRebalanceModalVisible(false);
      
      // Trigger a re-fetch of stats instead of page reload
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

          // Set total available images for rebalancing
          setTotalAvailableImages(totalLabeled);
          
          // Initialize counts with current split values
          setTrainCount(totalTrainCount);
          setValCount(totalValCount);
          setTestCount(totalTestCount);
          
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

          setTotalAvailableImages(totalLabeled);
          setTrainCount(Math.floor(totalLabeled * 0.7));
          setValCount(Math.floor(totalLabeled * 0.2));
          setTestCount(totalLabeled - Math.floor(totalLabeled * 0.7) - Math.floor(totalLabeled * 0.2));
        } finally {
          setLoading(false);
        }
      };
      
      fetchStats();
      
    } catch (error) {
      console.error('Error rebalancing datasets:', error);
      message.error(`Failed to rebalance datasets: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRebalance = () => {
    setRebalanceModalVisible(false);
  };

  const handleCountChange = (value, type) => {
    const newValue = Math.max(0, Math.min(value || 0, totalAvailableImages));
    
    if (type === 'train') {
      setTrainCount(newValue);
    } else if (type === 'val') {
      setValCount(newValue);
    } else if (type === 'test') {
      setTestCount(newValue);
    }
  };

  const getCurrentTotal = () => trainCount + valCount + testCount;
  const getRemainingImages = () => totalAvailableImages - getCurrentTotal();

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
        <Row justify="space-between" align="middle">
          <Col>
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
          </Col>
          <Col>
            <Button 
              type="default" 
              icon={<SyncOutlined />}
              onClick={handleRebalance}
              disabled={totalAvailableImages === 0}
            >
              Rebalance
            </Button>
          </Col>
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
        <Alert
          message="Note: changing your test set will invalidate model performance comparisons with previously generated versions."
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />
        
        <div style={{ marginBottom: 20 }}>
          <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <strong>Train:</strong>
            </Col>
            <Col span={12}>
              <InputNumber
                min={0}
                max={totalAvailableImages}
                value={trainCount}
                onChange={(value) => handleCountChange(value, 'train')}
                style={{ width: '100%' }}
                addonAfter="images"
              />
            </Col>
            <Col span={6}>
              <Tag color="blue" style={{ fontSize: '12px' }}>
                {totalAvailableImages > 0 ? Math.round((trainCount / totalAvailableImages) * 100) : 0}%
              </Tag>
            </Col>
          </Row>
          
          <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <strong>Valid:</strong>
            </Col>
            <Col span={12}>
              <InputNumber
                min={0}
                max={totalAvailableImages}
                value={valCount}
                onChange={(value) => handleCountChange(value, 'val')}
                style={{ width: '100%' }}
                addonAfter="images"
              />
            </Col>
            <Col span={6}>
              <Tag color="geekblue" style={{ fontSize: '12px' }}>
                {totalAvailableImages > 0 ? Math.round((valCount / totalAvailableImages) * 100) : 0}%
              </Tag>
            </Col>
          </Row>
          
          <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <strong>Test:</strong>
            </Col>
            <Col span={12}>
              <InputNumber
                min={0}
                max={totalAvailableImages}
                value={testCount}
                onChange={(value) => handleCountChange(value, 'test')}
                style={{ width: '100%' }}
                addonAfter="images"
              />
            </Col>
            <Col span={6}>
              <Tag color="purple" style={{ fontSize: '12px' }}>
                {totalAvailableImages > 0 ? Math.round((testCount / totalAvailableImages) * 100) : 0}%
              </Tag>
            </Col>
          </Row>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <strong>Total: {getCurrentTotal()} / {totalAvailableImages} images</strong>
            </Col>
            <Col>
              {getRemainingImages() !== 0 && (
                <Tag color={getRemainingImages() > 0 ? 'orange' : 'red'}>
                  {getRemainingImages() > 0 ? `${getRemainingImages()} remaining` : `${Math.abs(getRemainingImages())} over limit`}
                </Tag>
              )}
              {getRemainingImages() === 0 && (
                <Tag color="green">Perfect match!</Tag>
              )}
            </Col>
          </Row>
          <Progress 
            percent={Math.min((getCurrentTotal() / totalAvailableImages) * 100, 100)}
            status={getCurrentTotal() === totalAvailableImages ? 'success' : getCurrentTotal() > totalAvailableImages ? 'exception' : 'active'}
            strokeColor={getCurrentTotal() === totalAvailableImages ? '#52c41a' : getCurrentTotal() > totalAvailableImages ? '#ff4d4f' : '#1890ff'}
          />
        </div>

        <Alert
          message={`This will assign all labeled images to the dataset splits according to the counts you've set. Unlabeled images will be ignored.`}
          type="info"
          showIcon
        />
      </Modal>
    </Card>
  );
};

export default DatasetStats;





