import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Typography,
  Spin,
  message,
  Tag,
  Button,
  Progress,
  Statistic,
  Row,
  Col,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  PictureOutlined,
  DatabaseOutlined,
  TagOutlined,
  RobotOutlined,
  EyeOutlined,
  DeploymentUnitOutlined,
  BulbOutlined,
  HistoryOutlined,
  PieChartOutlined,
  ThunderboltOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { projectsAPI, handleAPIError } from '../../services/api';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';
// Sidebar theme styles (keep imports at the top)
import './ProjectWorkspace.css';

// Import components (these will be created later)
import {
  UploadSection,
  ManagementSection,
  DatasetSection,
  ReleaseSection,
  AnalyticsSection,
  ModelsSection,
  ModelTrainingSection,
  ModelLabSection,
  DeploymentsSection,
  ActiveLearningSection
} from '../../components/project-workspace';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set initial selected key based on location state or default to 'upload'
  const [selectedKey, setSelectedKey] = useState(
    location.state?.selectedSection || 'upload'
  );

  // Log initial state
  useEffect(() => {
    logInfo('app.frontend.ui', 'ProjectWorkspace initial state set', {
      projectId,
      initialSection: location.state?.selectedSection || 'upload'
    });
  }, []);

  // Update selectedKey when location state changes
  useEffect(() => {
    // Check for state first
    if (location.state?.selectedSection) {
      console.log('Updating selectedKey from location state:', location.state.selectedSection);
      setSelectedKey(location.state.selectedSection);
      window.dispatchEvent(new CustomEvent('workspaceSectionChanged', {
        detail: { section: location.state.selectedSection }
      }));
      logInfo('app.frontend.navigation', 'Workspace section changed from location state', {
        projectId,
        section: location.state.selectedSection
      });
    }
    // Then check URL search params
    else {
      const searchParams = new URLSearchParams(location.search);
      const section = searchParams.get('section');
      if (section) {
        console.log('Updating selectedKey from URL parameter:', section);
        setSelectedKey(section);
        window.dispatchEvent(new CustomEvent('workspaceSectionChanged', {
          detail: { section }
        }));
        logInfo('app.frontend.navigation', 'Workspace section changed from URL parameter', {
          projectId,
          section
        });
      }
    }
  }, [location.state, location.search]);

  // Load project details
  const loadProject = async () => {
    setLoading(true);
    logInfo('app.frontend.interactions', 'Loading project details', { projectId });
    try {
      const projectData = await projectsAPI.getProject(projectId);
      setProject(projectData);
      logInfo('app.frontend.interactions', 'Project details loaded successfully', {
        projectId,
        projectName: projectData.name,
        projectType: projectData.project_type,
        totalImages: projectData.total_images,
        totalDatasets: projectData.total_datasets,
        labeledImages: projectData.labeled_images,
        progressPercentage: projectData.total_images > 0
          ? Math.round((projectData.labeled_images / projectData.total_images) * 100)
          : 0
      });
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to load project: ${errorInfo.message}`);
      logError('app.frontend.validation', 'Failed to load project details', {
        projectId,
        error: errorInfo.message
      });
      console.error('Load project error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      // Clear any existing notifications when component loads
      message.destroy();
      logInfo('app.frontend.navigation', 'ProjectWorkspace page loaded', { projectId });
      loadProject();
    }

    // Cleanup function for component unmount
    return () => {
      if (projectId) {
        logInfo('app.frontend.ui', 'ProjectWorkspace component unmounting', { projectId });
      }
    };
  }, [projectId]);

  // Log project type validation when project loads
  useEffect(() => {
    if (project && project.project_type) {
      // Classification task is not supported in the app; keep only supported tasks
      const validTypes = ['object_detection', 'segmentation'];
      if (!validTypes.includes(project.project_type)) {
        logInfo('app.frontend.validation', 'Unknown project type encountered', {
          projectId,
          unknownType: project.project_type,
          validTypes
        });
      }

      // Log progress validation
      if (project.total_images === 0) {
        logInfo('app.frontend.validation', 'Project has no images for progress calculation', {
          projectId,
          projectName: project.name,
          totalImages: project.total_images,
          labeledImages: project.labeled_images
        });
      }
    }
  }, [project, projectId]);

  // Get project type info for styling
  const getProjectTypeInfo = (type) => {
    const typeInfo = {
      'object_detection': { color: 'blue', label: 'Object Detection' },
      'segmentation': { color: 'purple', label: 'Instance Segmentation' }
    };
    return typeInfo[type] || { color: 'default', label: type };
  };

  // Sidebar menu items
  const menuItems = [
    {
      key: 'data',
      label: 'DATA',
      type: 'group',
      children: [
        {
          key: 'upload',
          icon: <UploadOutlined />,
          label: 'Upload Data',
        },
        {
          key: 'management',
          icon: <TagOutlined />,
          label: 'Management',
        },
        {
          key: 'dataset',
          icon: <DatabaseOutlined />,
          label: 'Dataset',
        },
        {
          key: 'versions',
          icon: <HistoryOutlined />,
          label: 'RELEASE',
        },
        {
          key: 'analytics',
          icon: <PieChartOutlined />,
          label: 'Analytics',
        },
      ],
    },
    {
      key: 'models',
      label: 'AI TRAINING',
      type: 'group',
      children: [
        {
          key: 'models',
          icon: <RobotOutlined />,
          label: 'Models',
        },
        {
          key: 'model-training',
          icon: <ThunderboltOutlined />,
          label: 'Model Training',
        },
        {
          key: 'model-lab',
          icon: <ExperimentOutlined />,
          label: 'Model Lab',
        },
      ],
    },
    {
      key: 'deploy',
      label: 'DEPLOY',
      type: 'group',
      children: [
        {
          key: 'deployments',
          icon: <DeploymentUnitOutlined />,
          label: 'Deployments',
        },
        {
          key: 'active-learning',
          icon: <BulbOutlined />,
          label: 'Active Learning',
        },
      ],
    },
  ];

  // Render content based on selected menu item
  const renderContent = () => {
    logInfo('app.frontend.ui', 'Rendering workspace section', {
      projectId,
      projectName: project.name,
      section: selectedKey
    });

    switch (selectedKey) {
      case 'upload':
        return (
          <UploadSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'management':
        return (
          <ManagementSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'dataset':
        return (
          <DatasetSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'versions':
        return (
          <ReleaseSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'analytics':
        return (
          <AnalyticsSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'models':
        return (
          <ModelsSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
            navigate={navigate}
          />
        );
      case 'model-training':
        return (
          <ModelTrainingSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
            navigate={navigate}
          />
        );
      case 'model-lab':
        return (
          <ModelLabSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'deployments':
        return (
          <DeploymentsSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
      case 'active-learning':
        return (
          <ActiveLearningSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
            navigate={navigate}
          />
        );
      default:
        return (
          <UploadSection
            projectId={projectId}
            setSelectedKey={setSelectedKey}
            project={project}
            loadProject={loadProject}
          />
        );
    }
  };

  if (loading) {
    logInfo('app.frontend.ui', 'ProjectWorkspace loading state', { projectId });
    return (
      <div style={{ textAlign: 'center', padding: '3.125rem' }}>
        <Spin size="large" />
        <div style={{ marginTop: '1rem' }}>
          <Text style={{ fontSize: '0.875rem' }}>Loading project workspace...</Text>
        </div>
      </div>
    );
  }

  if (!project) {
    logError('app.frontend.validation', 'Project not found in workspace', { projectId });
    return (
      <Alert
        message="Project Not Found"
        description="The requested project could not be found."
        type="error"
        showIcon
        style={{ margin: '3.125rem auto', maxWidth: '31.25rem' }}
      />
    );
  }

  const typeInfo = getProjectTypeInfo(project.project_type);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Project Sidebar */}
      <Sider
        width="17.5rem"
        className="workspace-sider"
        style={{
          background: '#0C2132',
          borderRight: '0.0625rem solid rgba(255,255,255,0.08)',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 100
        }}
      >
        {/* Back Button */}
        <div style={{ padding: '1rem', borderBottom: '0.0625rem solid rgba(255,255,255,0.08)' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined style={{ fontSize: '1rem' }} />}
            onClick={() => {
              logUserClick('ProjectWorkspace', 'back_to_projects_button', { projectId, projectName: project.name });
              navigate('/projects');
            }}
            style={{
              marginBottom: '1rem',
              fontSize: '1rem',
              height: 'auto',
              padding: '0.25rem 0',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 500
            }}
          >
            Back to Projects
          </Button>

          {/* Project Header */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                background: project.tile_enabled
                  ? 'linear-gradient(135deg, #13c2c2, #36cfc9)'
                  : `linear-gradient(135deg, ${typeInfo.color === 'blue' ? '#1890ff, #40a9ff' :
                      typeInfo.color === 'green' ? '#52c41a, #73d13d' :
                        typeInfo.color === 'purple' ? '#722ed1, #9254de' : '#d9d9d9, #f0f0f0'
                    })`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.125rem',
                marginRight: '0.75rem'
              }}>
                {typeInfo.color === 'blue' ? '🎯' :
                  typeInfo.color === 'green' ? '🏷️' :
                    typeInfo.color === 'purple' ? '✂️' : '📁'}
              </div>
              <div>
                <Title level={4} style={{ margin: 0, fontSize: '1.25rem', lineHeight: '1.6rem', color: '#ffffff', fontWeight: 600 }}>
                  {project.name}
                </Title>
                <div style={{ marginTop: '0.375rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <Tag
                    color={typeInfo.color}
                    style={{
                      fontSize: '0.75rem',
                      lineHeight: '1rem',
                      height: 'auto',
                      padding: '0.25rem 0.625rem',
                      fontWeight: 500
                    }}
                  >
                    {typeInfo.label}
                  </Tag>
                  {project.tile_enabled && (
                    <Tag
                      color="cyan"
                      style={{
                        fontSize: '0.75rem',
                        lineHeight: '1rem',
                        height: 'auto',
                        padding: '0.25rem 0.625rem',
                        fontWeight: 600
                      }}
                    >
                      Tile
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Project Stats */}
          <Row gutter={['0.5rem', '0.5rem']}>
            <Col span={12}>
              <Statistic
                title={<span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Images</span>}
                value={project.total_images}
                prefix={<PictureOutlined style={{ fontSize: '0.875rem' }} />}
                valueStyle={{ fontSize: '1rem', color: '#E6E6E6', fontWeight: 600 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={<span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Datasets</span>}
                value={project.total_datasets}
                prefix={<DatabaseOutlined style={{ fontSize: '0.875rem' }} />}
                valueStyle={{ fontSize: '1rem', color: '#E6E6E6', fontWeight: 600 }}
              />
            </Col>
          </Row>

          <div style={{ marginTop: '0.75rem' }}>
            <Text type="secondary" style={{ fontSize: '0.875rem', color: '#A3A7AD', fontWeight: 500 }}>
              Progress: {project.total_images > 0
                ? Math.round((project.labeled_images / project.total_images) * 100)
                : 0}% annotated
            </Text>
            <div style={{ height: '0.5rem', marginTop: '0.25rem' }}>
              <Progress
                percent={project.total_images > 0
                  ? Math.round((project.labeled_images / project.total_images) * 100)
                  : 0}
                size="small"
                showInfo={false}
                strokeWidth={4}
                style={{ margin: 0, padding: 0 }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '0.8125rem' // 13px override for vector scaling
          }}
          items={menuItems}
          onClick={({ key }) => {
            logUserClick('ProjectWorkspace', 'workspace_menu_item', {
              projectId,
              projectName: project.name,
              previousSection: selectedKey,
              newSection: key
            });
            setSelectedKey(key);
            window.dispatchEvent(new CustomEvent('workspaceSectionChanged', { detail: { section: key } }));
          }}
        />
      </Sider>

      {/* Main Content */}
      <Layout style={{ marginLeft: '17.5rem', background: '#f5f5f5', minHeight: '100vh' }}>
        <Content style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default ProjectWorkspace;
