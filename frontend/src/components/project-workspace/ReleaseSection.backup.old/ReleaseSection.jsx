import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Layout,
  Typography,
  Button,
  Card,
  Empty,
  Spin,
  message,
  Row,
  Col,
  Statistic,
  Tag,
  Space,
  Tooltip,
  Image,
  Divider
} from 'antd';
import {
  HistoryOutlined,
  PlusOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  FolderOutlined,
  TagOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import ReleaseCard from './ReleaseCard';
import ExportModal from './ExportModal';
import './ReleaseSection.css';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

const ReleaseSection = ({ projectId, project }) => {
  const location = useLocation();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [creatingRelease, setCreatingRelease] = useState(false);

  // Load releases on component mount
  useEffect(() => {
    if (projectId) {
      loadReleases();
    }
  }, [projectId]);

  // Handle openCreateModal from navigation state
  useEffect(() => {
    if (location.state?.openCreateModal) {
      setExportModalVisible(true);
      // Clear the state to prevent reopening on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadReleases = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/v1/projects/${projectId}/releases`);
      // const data = await response.json();
      
      // Mock data for now
      const mockReleases = [
        {
          id: 1,
          name: 'Release-1',
          createdAt: '2024-01-15T10:30:00Z',
          totalImages: 150,
          totalClasses: 5,
          taskType: 'Object Detection',
          format: 'YOLO',
          isAugmented: true,
          splits: {
            train: 105,
            val: 30,
            test: 15
          },
          status: 'completed'
        },
        {
          id: 2,
          name: 'Release-2',
          createdAt: '2024-01-20T14:45:00Z',
          totalImages: 200,
          totalClasses: 8,
          taskType: 'Segmentation',
          format: 'COCO',
          isAugmented: false,
          splits: {
            train: 140,
            val: 40,
            test: 20
          },
          status: 'completed'
        }
      ];
      
      setReleases(mockReleases);
      if (mockReleases.length > 0 && !selectedRelease) {
        setSelectedRelease(mockReleases[0]);
      }
    } catch (error) {
      console.error('Error loading releases:', error);
      message.error('Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRelease = () => {
    setExportModalVisible(true);
  };

  const handleReleaseCreated = (newRelease) => {
    setReleases(prev => [...prev, newRelease]);
    setSelectedRelease(newRelease);
    setExportModalVisible(false);
    message.success('Release created successfully!');
  };

  const handleDeleteRelease = async (releaseId) => {
    try {
      // TODO: API call to delete release
      setReleases(prev => prev.filter(r => r.id !== releaseId));
      if (selectedRelease?.id === releaseId) {
        setSelectedRelease(releases.length > 1 ? releases[0] : null);
      }
      message.success('Release deleted successfully');
    } catch (error) {
      message.error('Failed to delete release');
    }
  };

  const handleExportRelease = async (releaseId, format) => {
    try {
      // TODO: API call to export release
      message.success(`Exporting release as ${format}...`);
    } catch (error) {
      message.error('Failed to export release');
    }
  };

  const renderReleaseDetails = () => {
    if (!selectedRelease) {
      return (
        <div className="release-empty-state">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Select a release to view details"
          />
        </div>
      );
    }

    return (
      <div className="release-details">
        <div className="release-header">
          <div className="release-title-section">
            <Title level={3}>
              <FolderOutlined style={{ marginRight: 8 }} />
              {selectedRelease.name}
            </Title>
            <Space>
              <Tag color={selectedRelease.isAugmented ? 'orange' : 'blue'}>
                {selectedRelease.isAugmented ? 'Augmented' : 'Original'}
              </Tag>
              <Tag color="green">{selectedRelease.taskType}</Tag>
              <Tag>{selectedRelease.format}</Tag>
            </Space>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleExportRelease(selectedRelease.id, selectedRelease.format)}
            >
              Export
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => {/* TODO: Edit release */}}
            >
              Edit
            </Button>
          </Space>
        </div>

        <Divider />

        <Row gutter={[16, 16]} className="release-stats">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Images"
                value={selectedRelease.totalImages}
                prefix={<TagOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Classes"
                value={selectedRelease.totalClasses}
                prefix={<FolderOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Train Set"
                value={selectedRelease.splits.train}
                suffix={`/ ${selectedRelease.totalImages}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Val Set"
                value={selectedRelease.splits.val}
                suffix={`/ ${selectedRelease.totalImages}`}
              />
            </Card>
          </Col>
        </Row>

        <div className="release-splits-section">
          <Title level={4}>Dataset Splits</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Card title="Training Set" size="small">
                <Statistic
                  value={selectedRelease.splits.train}
                  suffix="images"
                  valueStyle={{ color: '#3f8600' }}
                />
                <Text type="secondary">
                  {((selectedRelease.splits.train / selectedRelease.totalImages) * 100).toFixed(1)}%
                </Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="Validation Set" size="small">
                <Statistic
                  value={selectedRelease.splits.val}
                  suffix="images"
                  valueStyle={{ color: '#1890ff' }}
                />
                <Text type="secondary">
                  {((selectedRelease.splits.val / selectedRelease.totalImages) * 100).toFixed(1)}%
                </Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="Test Set" size="small">
                <Statistic
                  value={selectedRelease.splits.test}
                  suffix="images"
                  valueStyle={{ color: '#cf1322' }}
                />
                <Text type="secondary">
                  {((selectedRelease.splits.test / selectedRelease.totalImages) * 100).toFixed(1)}%
                </Text>
              </Card>
            </Col>
          </Row>
        </div>

        <div className="release-preview-section">
          <Title level={4}>Sample Images</Title>
          <div className="sample-images">
            {/* TODO: Add actual sample images */}
            <Empty description="Sample images will be displayed here" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="release-section">
      <div className="release-section-header">
        <Title level={2}>
          <HistoryOutlined style={{ marginRight: '8px' }} />
          Releases Management
        </Title>
        <Text type="secondary">
          Create, manage, and export finalized dataset versions
        </Text>
      </div>

      <Layout className="release-layout">
        <Sider width={350} className="release-sidebar">
          <div className="release-sidebar-header">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateRelease}
              block
              size="large"
            >
              Create New Release
            </Button>
          </div>

          <div className="release-list">
            {loading ? (
              <div className="release-loading">
                <Spin size="large" />
              </div>
            ) : releases.length === 0 ? (
              <Empty
                description="No releases yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              releases.map(release => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  isSelected={selectedRelease?.id === release.id}
                  onSelect={() => setSelectedRelease(release)}
                  onDelete={() => handleDeleteRelease(release.id)}
                  onExport={(format) => handleExportRelease(release.id, format)}
                />
              ))
            )}
          </div>
        </Sider>

        <Content className="release-content">
          {renderReleaseDetails()}
        </Content>
      </Layout>

      <ExportModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onSuccess={handleReleaseCreated}
        projectId={projectId}
        project={project}
      />
    </div>
  );
};

export default ReleaseSection;