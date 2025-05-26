import React from 'react';
import { Card, Row, Col, Statistic, Button, Typography } from 'antd';
import {
  RobotOutlined,
  DatabaseOutlined,
  ProjectOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>Dashboard</Title>
      <Paragraph>
        Welcome to Auto-Labeling-Tool - Your local computer vision dataset labeling solution
      </Paragraph>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Models"
              value={0}
              prefix={<RobotOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Projects"
              value={0}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Datasets"
              value={0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Annotations"
              value={0}
              prefix={<EditOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title="Quick Actions"
            extra={<PlusOutlined />}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Button 
                type="primary" 
                icon={<RobotOutlined />}
                onClick={() => navigate('/models')}
                block
              >
                Import YOLO Model
              </Button>
              <Button 
                icon={<ProjectOutlined />}
                onClick={() => navigate('/projects')}
                block
              >
                Create New Project
              </Button>
              <Button 
                icon={<DatabaseOutlined />}
                onClick={() => navigate('/datasets')}
                block
              >
                Upload Dataset
              </Button>
              <Button 
                icon={<EditOutlined />}
                onClick={() => navigate('/annotate')}
                block
              >
                Start Annotating
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Recent Activity">
            <Paragraph type="secondary">
              No recent activity. Start by importing a model or creating a project.
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;