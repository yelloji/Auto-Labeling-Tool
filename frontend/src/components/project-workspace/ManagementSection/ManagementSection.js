import React, { useState } from 'react';
import {
  Typography,
  Card,
  Button,
  Spin,
  Row,
  Col,
  Tabs,
  Empty,
  Input,
  Modal,
  Select
} from 'antd';
import {
  TagOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  UploadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import DatasetCard from './DatasetCard';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ManagementSection = ({
  loadingManagement,
  unassignedDatasets = [],
  annotatingDatasets = [],
  completedDatasets = [],
  onDatasetClick,
  onRenameDataset,
  onMoveToUnassigned,
  onMoveToAnnotating,
  onMoveToDataset,
  onDeleteDataset,
  onCreateDataset,
  onUploadClick,
  projectImageCount = 0
}) => {
  if (loadingManagement) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading management data...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: '8px' }}>
            <TagOutlined style={{ marginRight: '8px' }} />
            Management
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Text type="secondary">
              Manage your datasets and annotation workflow
            </Text>
          </div>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={onCreateDataset}
        >
          Create Dataset
        </Button>
      </div>

      {/* Tab-based layout (similar to the current implementation) */}
      <Tabs defaultActiveKey="unassigned">
        <TabPane 
          tab={
            <span>
              <ClockCircleOutlined style={{ marginRight: '8px' }} />
              Unassigned
              {unassignedDatasets.length > 0 && (
                <span style={{ 
                  marginLeft: '8px', 
                  background: '#faad14', 
                  color: 'white', 
                  borderRadius: '10px', 
                  padding: '0 8px',
                  fontSize: '12px'
                }}>
                  {unassignedDatasets.length}
                </span>
              )}
            </span>
          } 
          key="unassigned"
        >
          <div style={{ padding: '16px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Button type="link" icon={<UploadOutlined />} onClick={onUploadClick}>
                Upload More Images
              </Button>
            </div>
            
            {unassignedDatasets.length > 0 ? (
              <Row gutter={16}>
                {unassignedDatasets.map(dataset => (
                  <Col xs={24} sm={12} md={8} lg={6} key={dataset.id}>
                    <DatasetCard
                      dataset={dataset}
                      status="unassigned"
                      onClick={onDatasetClick}
                      onRename={onRenameDataset}
                      onMoveToUnassigned={onMoveToUnassigned}
                      onMoveToAnnotating={onMoveToAnnotating}
                      onMoveToDataset={onMoveToDataset}
                      onDelete={onDeleteDataset}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty 
                description="No unassigned datasets" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <PlayCircleOutlined style={{ marginRight: '8px' }} />
              Annotating
              {annotatingDatasets.length > 0 && (
                <span style={{ 
                  marginLeft: '8px', 
                  background: '#1890ff', 
                  color: 'white', 
                  borderRadius: '10px', 
                  padding: '0 8px',
                  fontSize: '12px'
                }}>
                  {annotatingDatasets.length}
                </span>
              )}
            </span>
          } 
          key="annotating"
        >
          <div style={{ padding: '16px 0' }}>
            {annotatingDatasets.length > 0 ? (
              <Row gutter={16}>
                {annotatingDatasets.map(dataset => (
                  <Col xs={24} sm={12} md={8} lg={6} key={dataset.id}>
                    <DatasetCard
                      dataset={dataset}
                      status="annotating"
                      onClick={onDatasetClick}
                      onRename={onRenameDataset}
                      onMoveToUnassigned={onMoveToUnassigned}
                      onMoveToAnnotating={onMoveToAnnotating}
                      onMoveToDataset={onMoveToDataset}
                      onDelete={onDeleteDataset}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty 
                description="No datasets in annotation" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <DatabaseOutlined style={{ marginRight: '8px' }} />
              Dataset
              {completedDatasets.length > 0 && (
                <span style={{ 
                  marginLeft: '8px', 
                  background: '#52c41a', 
                  color: 'white', 
                  borderRadius: '10px', 
                  padding: '0 8px',
                  fontSize: '12px'
                }}>
                  {completedDatasets.length}
                </span>
              )}
            </span>
          } 
          key="dataset"
        >
          <div style={{ padding: '16px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Button type="link" icon={<EyeOutlined />}>
                See all {projectImageCount} images
              </Button>
            </div>
            
            {completedDatasets.length > 0 ? (
              <Row gutter={16}>
                {completedDatasets.map(dataset => (
                  <Col xs={24} sm={12} md={8} lg={6} key={dataset.id}>
                    <DatasetCard
                      dataset={dataset}
                      status="completed"
                      onClick={onDatasetClick}
                      onRename={onRenameDataset}
                      onMoveToUnassigned={onMoveToUnassigned}
                      onMoveToAnnotating={onMoveToAnnotating}
                      onMoveToDataset={onMoveToDataset}
                      onDelete={onDeleteDataset}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty 
                description="No completed datasets" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </TabPane>
      </Tabs>

      {/* Alternative layout (similar to the original code) */}
      {/* Uncomment this and comment out the Tabs section above to use the original layout */}
      {/*
      <Row gutter={[24, 24]}>
        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Unassigned</Text>
                <Text type="secondary">{unassignedDatasets.length} Datasets</Text>
              </div>
            }
            style={{ height: '500px', overflow: 'auto' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Button type="link" icon={<UploadOutlined />} onClick={onUploadClick}>
                Upload More Images
              </Button>
            </div>
            
            {unassignedDatasets.length > 0 ? (
              unassignedDatasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  status="unassigned"
                  onClick={onDatasetClick}
                  onRename={onRenameDataset}
                  onMoveToUnassigned={onMoveToUnassigned}
                  onMoveToAnnotating={onMoveToAnnotating}
                  onMoveToDataset={onMoveToDataset}
                  onDelete={onDeleteDataset}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Text type="secondary">No unassigned datasets found.</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Annotating</Text>
                <Text type="secondary">{annotatingDatasets.length} Datasets</Text>
              </div>
            }
            style={{ height: '500px', overflow: 'auto' }}
          >
            {annotatingDatasets.length > 0 ? (
              annotatingDatasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  status="annotating"
                  onClick={onDatasetClick}
                  onRename={onRenameDataset}
                  onMoveToUnassigned={onMoveToUnassigned}
                  onMoveToAnnotating={onMoveToAnnotating}
                  onMoveToDataset={onMoveToDataset}
                  onDelete={onDeleteDataset}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Text type="secondary">Upload and assign images to an annotator.</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Dataset</Text>
                <Text type="secondary">{completedDatasets.length} Datasets</Text>
              </div>
            }
            style={{ height: '500px', overflow: 'auto' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Button type="link" icon={<EyeOutlined />}>
                See all {projectImageCount} images
              </Button>
            </div>

            {completedDatasets.length > 0 ? (
              completedDatasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  status="completed"
                  onClick={onDatasetClick}
                  onRename={onRenameDataset}
                  onMoveToUnassigned={onMoveToUnassigned}
                  onMoveToAnnotating={onMoveToAnnotating}
                  onMoveToDataset={onMoveToDataset}
                  onDelete={onDeleteDataset}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Text type="secondary">No completed datasets found.</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
      */}
    </div>
  );
};

export default ManagementSection;