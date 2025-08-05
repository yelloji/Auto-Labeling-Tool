import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Alert,
  Button,
  Spin,
  Typography,
  Divider,
  Space,
  Tooltip,
  Badge,
  Select
} from 'antd';
import {
  PieChartOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  TagOutlined,
  FileImageOutlined,
  PlusOutlined,
  EditOutlined
} from '@ant-design/icons';
import { Pie, Bar, Column } from '@ant-design/plots';
import { projectsAPI, datasetsAPI, analyticsAPI } from '../../../services/api';
import LabelManagementModal from './LabelManagementModal';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const AnalyticsSection = ({ projectId, project, loadProject }) => {
  const [loading, setLoading] = useState(true);
  const [projectStats, setProjectStats] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [labels, setLabels] = useState([]);
  const [labelDistribution, setLabelDistribution] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState('all');
  const [labelModalVisible, setLabelModalVisible] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProjectAnalytics();
    }
  }, [projectId]);

  const loadProjectAnalytics = async () => {
    setLoading(true);
    try {
      // Load project data
      const [datasetsResp, labelsResp, labelDistResp] = await Promise.all([
        datasetsAPI.getDatasets(projectId),
        projectsAPI.getProjectLabels(projectId),
        analyticsAPI.getProjectLabelDistribution(projectId)
      ]);

      const datasetsData = datasetsResp.data || datasetsResp || [];
      const labelsData = labelsResp.data || labelsResp || [];
      const labelDistData = labelDistResp || {};

      setDatasets(datasetsData);
      setLabels(labelsData);
      setLabelDistribution(labelDistData);

      // Calculate project statistics
      const stats = calculateProjectStats(datasetsData, labelsData);
      setProjectStats(stats);
    } catch (error) {
      console.error('Error loading project analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProjectStats = (datasets, labels) => {
    const totalImages = datasets.reduce((sum, dataset) => sum + (dataset.total_images || 0), 0);
    const labeledImages = datasets.reduce((sum, dataset) => sum + (dataset.labeled_images || 0), 0);
    const unlabeledImages = datasets.reduce((sum, dataset) => sum + (dataset.unlabeled_images || 0), 0);
    
    return {
      totalDatasets: datasets.length,
      totalImages,
      totalAnnotations: labeledImages, // Using labeled images as proxy for annotations
      labeledImages,
      unlabeledImages,
      totalLabels: labels.length,
      labelingProgress: totalImages > 0 ? Math.round((labeledImages / totalImages) * 100) : 0
    };
  };

  const handleOpenLabelModal = () => {
    setLabelModalVisible(true);
  };

  const handleCloseLabelModal = () => {
    setLabelModalVisible(false);
  };

  const handleLabelsUpdated = () => {
    // Reload project analytics when labels are updated
    loadProjectAnalytics();
  };

  const renderProjectOverview = () => {
    if (!projectStats) return null;

    const getProgressColor = (progress) => {
      if (progress >= 90) return '#52c41a';
      if (progress >= 70) return '#1890ff';
      if (progress >= 50) return '#faad14';
      if (progress >= 30) return '#fa8c16';
      return '#f5222d';
    };

    return (
      <Card title="Project Overview" size="small">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Total Datasets"
              value={projectStats.totalDatasets}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total Images"
              value={projectStats.totalImages}
              prefix={<FileImageOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total Labels"
              value={projectStats.totalLabels}
              prefix={<TagOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total Annotations"
              value={projectStats.totalAnnotations}
              prefix={<PieChartOutlined />}
            />
          </Col>
        </Row>
        
        <Divider />
        
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Progress
              type="circle"
              percent={projectStats.labelingProgress}
              strokeColor={getProgressColor(projectStats.labelingProgress)}
              size={100}
            />
          </Col>
          <Col span={16}>
            <Space direction="vertical" size="small">
              <Text strong>Labeling Progress</Text>
              <div>
                <Text type="secondary">Labeled Images: </Text>
                <Tag color="green">{projectStats.labeledImages}</Tag>
              </div>
              <div>
                <Text type="secondary">Unlabeled Images: </Text>
                <Tag color="red">{projectStats.unlabeledImages}</Tag>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderLabelsOverview = () => {
    if (!labels || labels.length === 0) return null;

    // Use real label distribution data if available
    const labelData = labels.map(label => {
      const distributionData = labelDistribution?.label_distribution?.[label.name];
      return {
        name: label.name,
        color: label.color,
        usage: distributionData?.count || 0,
        percentage: distributionData?.percentage || 0
      };
    });

    // Filter out labels with no usage for pie chart and include colors
    const pieData = labelData
      .filter(label => label.usage > 0)
      .map(label => ({
        type: label.name,
        value: label.usage,
        color: label.color
      }));

    // Create color array in the same order as the data
    const colors = pieData.map(item => item.color);

    const pieConfig = {
      data: pieData,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      color: colors,
      interactions: [{ type: 'element-active' }],
      legend: {
        position: 'bottom'
      }
    };

    const columns = [
      {
        title: 'Label',
        dataIndex: 'name',
        key: 'name',
        render: (name, record) => (
          <Space>
            <div 
              style={{ 
                width: 16, 
                height: 16, 
                backgroundColor: record.color, 
                borderRadius: 2 
              }} 
            />
            <Text strong>{name}</Text>
          </Space>
        )
      },
      {
        title: 'Color',
        dataIndex: 'color',
        key: 'color',
        render: (color) => <Tag color={color}>{color}</Tag>
      },
      {
        title: 'Usage Count',
        dataIndex: 'usage',
        key: 'usage',
        render: (usage) => <Badge count={usage} style={{ backgroundColor: '#1890ff' }} />
      },
      {
        title: 'Percentage',
        dataIndex: 'percentage',
        key: 'percentage',
        render: (percentage) => <Text strong>{percentage.toFixed(1)}%</Text>
      }
    ];

    return (
      <Row gutter={16}>
        <Col span={12}>
          <Card
            title="Labels Overview"
            size="small"
            extra={
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={handleOpenLabelModal}
                size="small"
              >
                Create/Edit Labels
              </Button>
            }
          >
            <Table
              dataSource={labelData}
              columns={columns}
              pagination={false}
              size="small"
              rowKey="name"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="Label Distribution"
            size="small"
          >
            {pieData.length > 0 ? (
              <Pie {...pieConfig} height={300} />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Typography.Text type="secondary">
                  No label data available
                </Typography.Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    );
  };

  const renderDatasetsOverview = () => {
    if (!datasets || datasets.length === 0) return null;

    const columns = [
      {
        title: 'Dataset Name',
        dataIndex: 'name',
        key: 'name',
        render: (name) => <Text strong>{name}</Text>
      },
      {
        title: 'Images',
        dataIndex: 'total_images',
        key: 'total_images',
        render: (count) => <Badge count={count || 0} style={{ backgroundColor: '#1890ff' }} />
      },
      {
        title: 'Labeled',
        dataIndex: 'labeled_images',
        key: 'labeled_images',
        render: (count) => <Badge count={count || 0} style={{ backgroundColor: '#52c41a' }} />
      },
      {
        title: 'Unlabeled',
        dataIndex: 'unlabeled_images',
        key: 'unlabeled_images',
        render: (count) => <Badge count={count || 0} style={{ backgroundColor: '#fa8c16' }} />
      },
      {
        title: 'Progress',
        key: 'progress',
        render: (_, record) => {
          const progress = record.total_images > 0 
            ? Math.round(((record.labeled_images || 0) / record.total_images) * 100) 
            : 0;
          return <Progress percent={progress} size="small" />;
        }
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status) => {
          const color = status === 'completed' ? 'green' : 
                       status === 'in_progress' ? 'blue' : 'orange';
          return <Tag color={color}>{status || 'pending'}</Tag>;
        }
      }
    ];

    return (
      <Card title="Datasets Overview" size="small">
        <Table
          dataSource={datasets}
          columns={columns}
          pagination={false}
          size="small"
          rowKey="id"
        />
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading project analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Project Analytics</Title>
        <Text type="secondary">
          Comprehensive overview of your project's datasets, labels, and annotation progress.
        </Text>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Project Overview */}
        {renderProjectOverview()}

        {/* Labels Overview */}
        {renderLabelsOverview()}

        {/* Datasets Overview */}
        {renderDatasetsOverview()}
      </Space>

      {/* Label Management Modal */}
      <LabelManagementModal
        visible={labelModalVisible}
        onCancel={handleCloseLabelModal}
        projectId={projectId}
        onLabelsUpdated={handleLabelsUpdated}
      />
    </div>
  );
};

export default AnalyticsSection;
