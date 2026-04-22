import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Spin, Tag, Button, Progress, Row, Col } from 'antd';
import {
    ArrowLeftOutlined, UploadOutlined, TagsOutlined,
    RocketOutlined, ExperimentOutlined, TrophyOutlined,
    PictureOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import UploadSection from '../project-workspace/UploadSection/UploadSection';
import RetrainingLabeling from './RetrainingLabeling';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
    { key: 'upload',  icon: <UploadOutlined />,    label: 'Upload Data' },
    { key: 'label',   icon: <TagsOutlined />,       label: 'Label' },
    { key: 'release', icon: <RocketOutlined />,     label: 'Release' },
    { key: 'train',   icon: <ExperimentOutlined />, label: 'Train' },
    { key: 'results', icon: <TrophyOutlined />,     label: 'Results' },
];

const RetrainingWorkspace = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [selectedKey, setSelectedKey] = useState('upload');
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/v1/projects/${projectId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setProject(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [projectId]);

    const renderContent = () => {
        switch (selectedKey) {
            case 'upload':
                return <UploadSection projectId={projectId} />;
            case 'label':
                return (
                    <RetrainingLabeling
                        projectId={projectId}
                        onNext={() => setSelectedKey('release')}
                        onBack={() => setSelectedKey('upload')}
                    />
                );
            case 'release':
                return (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <RocketOutlined style={{ fontSize: '3rem', marginBottom: '1rem', color: '#7c3aed' }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Release — Coming Soon</div>
                        <Text type="secondary">Release will be created automatically from the production reference config.</Text>
                    </div>
                );
            case 'train':
                return (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <ExperimentOutlined style={{ fontSize: '3rem', marginBottom: '1rem', color: '#7c3aed' }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Training — Coming Soon</div>
                        <Text type="secondary">Operator provides a name. All training parameters are copied from the production reference.</Text>
                    </div>
                );
            case 'results':
                return (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <TrophyOutlined style={{ fontSize: '3rem', marginBottom: '1rem', color: '#7c3aed' }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Results — Coming Soon</div>
                        <Text type="secondary">View metrics, run prediction, and assign to production.</Text>
                    </div>
                );
            default:
                return <UploadSection projectId={projectId} />;
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    const projectType = project?.project_type || 'detection';
    const typeColor = projectType === 'segmentation' ? 'purple' : 'blue';
    const typeLabel = projectType === 'segmentation' ? 'Instance Segmentation' : 'Object Detection';
    const totalImages = project?.total_images || 0;
    const labeledImages = project?.labeled_images || 0;
    const progressPct = totalImages > 0 ? Math.round((labeledImages / totalImages) * 100) : 0;

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Sidebar — same style as ProjectWorkspace */}
            <Sider
                width="17.5rem"
                style={{
                    background: '#0C2132',
                    borderRight: '0.0625rem solid rgba(255,255,255,0.08)',
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    zIndex: 100,
                }}
            >
                {/* Back button + project info */}
                <div style={{ padding: '1rem', borderBottom: '0.0625rem solid rgba(255,255,255,0.08)' }}>
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined style={{ fontSize: '1rem' }} />}
                        onClick={() => navigate('/projects')}
                        style={{
                            marginBottom: '1rem', fontSize: '1rem',
                            height: 'auto', padding: '0.25rem 0',
                            display: 'flex', alignItems: 'center', fontWeight: 500,
                        }}
                    >
                        Back to Projects
                    </Button>

                    {/* Project name + type */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{
                                width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
                                background: 'linear-gradient(135deg, #722ed1, #9254de)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: '1.125rem', marginRight: '0.75rem',
                            }}>
                                {projectType === 'segmentation' ? '✂️' : '🎯'}
                            </div>
                            <div>
                                <Title level={4} style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.5rem', color: '#ffffff', fontWeight: 600 }}>
                                    {project?.name || `Project ${projectId}`}
                                </Title>
                                <Tag color={typeColor} style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                    {typeLabel}
                                </Tag>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <Row gutter={['0.5rem', '0.5rem']}>
                        <Col span={12}>
                            <div style={{ fontSize: '0.75rem', color: '#A3A7AD', fontWeight: 500 }}>Images</div>
                            <div style={{ fontSize: '1rem', color: '#E6E6E6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <PictureOutlined style={{ fontSize: '0.875rem' }} />
                                {totalImages}
                            </div>
                        </Col>
                        <Col span={12}>
                            <div style={{ fontSize: '0.75rem', color: '#A3A7AD', fontWeight: 500 }}>Datasets</div>
                            <div style={{ fontSize: '1rem', color: '#E6E6E6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <DatabaseOutlined style={{ fontSize: '0.875rem' }} />
                                {project?.total_datasets || 0}
                            </div>
                        </Col>
                    </Row>

                    <div style={{ marginTop: '0.75rem' }}>
                        <Text style={{ fontSize: '0.875rem', color: '#A3A7AD', fontWeight: 500 }}>
                            Progress: {progressPct}% annotated
                        </Text>
                        <Progress
                            percent={progressPct}
                            size="small"
                            showInfo={false}
                            strokeWidth={4}
                            style={{ margin: 0, padding: 0 }}
                        />
                    </div>

                    {/* Retraining Mode badge */}
                    <div style={{ marginTop: '0.75rem' }}>
                        <Tag icon={<TrophyOutlined />} color="purple" style={{ fontSize: '0.72rem' }}>
                            User Retraining Mode
                        </Tag>
                    </div>
                </div>

                {/* Navigation */}
                <Menu
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.8125rem' }}
                    items={menuItems}
                    onClick={({ key }) => setSelectedKey(key)}
                />
            </Sider>

            {/* Main content — same offset and background as ProjectWorkspace */}
            <Layout style={{ marginLeft: '17.5rem', background: '#f5f5f5', minHeight: '100vh' }}>
                <Content style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
};

export default RetrainingWorkspace;
