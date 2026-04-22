import React, { useState, useEffect } from 'react';
import { Typography, Button, Steps, Spin, message, Tag } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, TagsOutlined, RocketOutlined, ExperimentOutlined, TrophyOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import UploadSection from '../project-workspace/UploadSection/UploadSection';
import RetrainingLabeling from './RetrainingLabeling';

const { Title, Text } = Typography;

const STEPS = [
    { key: 'upload',   title: 'Upload',   icon: <UploadOutlined /> },
    { key: 'label',    title: 'Label',    icon: <TagsOutlined /> },
    { key: 'release',  title: 'Release',  icon: <RocketOutlined /> },
    { key: 'train',    title: 'Train',    icon: <ExperimentOutlined /> },
    { key: 'results',  title: 'Results',  icon: <TrophyOutlined /> },
];

const RetrainingWorkspace = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/v1/projects/${projectId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setProject(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [projectId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#001529' }}>
                <Spin size="large" />
            </div>
        );
    }

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div>
                        <div style={{ marginBottom: '1rem' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>
                                Upload new images for this project. Use "Select Files" or "Select Folder" to add images.
                                When done, click Next to proceed to labeling.
                            </Text>
                        </div>
                        <UploadSection projectId={projectId} />
                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                type="primary"
                                size="large"
                                onClick={() => setCurrentStep(1)}
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', borderRadius: 8 }}
                            >
                                Next: Label Images
                            </Button>
                        </div>
                    </div>
                );
            case 1:
                return (
                    <RetrainingLabeling
                        projectId={projectId}
                        onNext={() => setCurrentStep(2)}
                        onBack={() => setCurrentStep(0)}
                    />
                );
            case 2:
                return (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.45)' }}>
                        <RocketOutlined style={{ fontSize: '3rem', marginBottom: '1rem', color: '#7c3aed' }} />
                        <div style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>Release — Coming in Phase 4</div>
                        <Text style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Release will be created automatically from the production reference config.
                        </Text>
                    </div>
                );
            case 3:
                return (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.45)' }}>
                        <ExperimentOutlined style={{ fontSize: '3rem', marginBottom: '1rem', color: '#7c3aed' }} />
                        <div style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>Training — Coming in Phase 5</div>
                        <Text style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Operator provides a name. All training parameters are copied from the production reference.
                        </Text>
                    </div>
                );
            case 4:
                return (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.45)' }}>
                        <TrophyOutlined style={{ fontSize: '3rem', marginBottom: '1rem', color: '#7c3aed' }} />
                        <div style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>Results — Coming in Phase 6</div>
                        <Text style={{ color: 'rgba(255,255,255,0.45)' }}>
                            View metrics, run prediction, and assign to production.
                        </Text>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{ background: '#001529', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* Top bar */}
            <div style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255,255,255,0.04)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/projects')}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                >
                    Back to Projects
                </Button>
                <div style={{ flex: 1 }}>
                    <Title level={4} style={{ margin: 0, color: '#fff' }}>
                        {project?.name || `Project ${projectId}`}
                    </Title>
                    {project?.project_type && (
                        <Tag color={project.project_type === 'segmentation' ? 'purple' : 'blue'} style={{ fontSize: '0.7rem' }}>
                            {project.project_type}
                        </Tag>
                    )}
                </div>
                <Tag icon={<TrophyOutlined />} color="purple" style={{ fontSize: '0.78rem' }}>
                    User Retraining Mode
                </Tag>
            </div>

            {/* Steps */}
            <div style={{ padding: '1.25rem 2rem 0', background: 'rgba(255,255,255,0.02)' }}>
                <Steps
                    current={currentStep}
                    onChange={setCurrentStep}
                    items={STEPS.map((s, i) => ({
                        title: <span style={{ color: i === currentStep ? '#a78bfa' : 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>{s.title}</span>,
                        icon: React.cloneElement(s.icon, { style: { color: i === currentStep ? '#a78bfa' : 'rgba(255,255,255,0.3)' } }),
                    }))}
                    style={{ maxWidth: 600 }}
                />
            </div>

            {/* Step content */}
            <div style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
                {renderStep()}
            </div>
        </div>
    );
};

export default RetrainingWorkspace;
