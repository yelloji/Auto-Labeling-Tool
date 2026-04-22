import React, { useState, useEffect } from 'react';
import { Typography, Spin, Tag, Button } from 'antd';
import {
    ArrowLeftOutlined, UploadOutlined, TagsOutlined,
    RocketOutlined, ExperimentOutlined, TrophyOutlined,
    CheckOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import UploadSection from '../project-workspace/UploadSection/UploadSection';
import RetrainingLabeling from './RetrainingLabeling';

const { Title, Text } = Typography;

const STEPS = [
    { key: 'upload',  label: 'Upload',  icon: <UploadOutlined />,     desc: 'Add new images' },
    { key: 'label',   label: 'Label',   icon: <TagsOutlined />,        desc: 'Annotate images' },
    { key: 'release', label: 'Release', icon: <RocketOutlined />,      desc: 'Prepare dataset' },
    { key: 'train',   label: 'Train',   icon: <ExperimentOutlined />,  desc: 'Run training' },
    { key: 'results', label: 'Results', icon: <TrophyOutlined />,      desc: 'Review & deploy' },
];

const RetrainingWorkspace = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/v1/projects/${projectId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setProject(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [projectId]);

    const goToStep = (idx) => {
        // only allow going back or to completed steps
        if (idx < currentStep || completedSteps.has(idx)) {
            setCurrentStep(idx);
        }
    };

    const nextStep = () => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#050d1a' }}>
                <Spin size="large" />
            </div>
        );
    }

    const projectType = project?.project_type || 'detection';
    const typeColor = projectType === 'segmentation' ? '#9333ea' : '#2563eb';

    const renderContent = () => {
        switch (currentStep) {
            case 0:
                return <UploadSection projectId={projectId} operatorMode={true} />;
            case 1:
                return (
                    <RetrainingLabeling
                        projectId={projectId}
                        onNext={nextStep}
                        onBack={prevStep}
                        hideNav
                    />
                );
            case 2:
                return (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚀</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.5rem' }}>Release — Coming Soon</div>
                        <Text type="secondary">Your dataset will be packaged automatically using the production reference configuration.</Text>
                    </div>
                );
            case 3:
                return (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚗️</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.5rem' }}>Training — Coming Soon</div>
                        <Text type="secondary">Enter a name and the model trains automatically using the production reference parameters.</Text>
                    </div>
                );
            case 4:
                return (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🏆</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.5rem' }}>Results — Coming Soon</div>
                        <Text type="secondary">Review metrics, run prediction, and assign the best model to production.</Text>
                    </div>
                );
            default:
                return null;
        }
    };

    const showBottomNav = currentStep !== 1; // labeling handles its own nav

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

            {/* ── Premium Header ── */}
            <div style={{
                background: 'linear-gradient(135deg, #050d1a 0%, #0c1f3a 50%, #1a0a2e 100%)',
                padding: '0 2rem',
                flexShrink: 0,
            }}>
                {/* Top row */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    paddingTop: '1rem', paddingBottom: '0.75rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/projects')}
                        size="small"
                        style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: 'rgba(255,255,255,0.75)',
                            borderRadius: 8,
                        }}
                    >
                        Back
                    </Button>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Text strong style={{ color: '#fff', fontSize: '1rem' }}>
                                {project?.name || `Project ${projectId}`}
                            </Text>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 600,
                                padding: '2px 8px', borderRadius: 20,
                                background: typeColor + '30',
                                border: `1px solid ${typeColor}60`,
                                color: typeColor === '#9333ea' ? '#c084fc' : '#60a5fa',
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>
                                {projectType}
                            </span>
                        </div>
                    </div>

                    {/* Retraining Mode badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(91,33,182,0.25))',
                        border: '1px solid rgba(167,139,250,0.35)',
                        borderRadius: 20,
                        padding: '4px 12px',
                        boxShadow: '0 0 12px rgba(124,58,237,0.2)',
                    }}>
                        <TrophyOutlined style={{ color: '#a78bfa', fontSize: '0.8rem' }} />
                        <Text style={{ color: '#a78bfa', fontSize: '0.78rem', fontWeight: 600 }}>
                            User Retraining Mode
                        </Text>
                    </div>

                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
                        Step {currentStep + 1} of {STEPS.length}
                    </Text>
                </div>

                {/* ── Step Bar ── */}
                <div style={{ padding: '1.25rem 0 1.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>

                        {/* Connecting line background */}
                        <div style={{
                            position: 'absolute',
                            top: 20, left: 20, right: 20,
                            height: 2,
                            background: 'rgba(255,255,255,0.08)',
                            zIndex: 0,
                        }} />

                        {/* Connecting line fill */}
                        <div style={{
                            position: 'absolute',
                            top: 20, left: 20,
                            height: 2,
                            width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 40px / ${STEPS.length - 1} * ${currentStep})`,
                            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                            zIndex: 1,
                            transition: 'width 0.4s ease',
                        }} />

                        {STEPS.map((step, i) => {
                            const isCompleted = completedSteps.has(i);
                            const isActive = i === currentStep;
                            const isPast = i < currentStep;
                            const clickable = i < currentStep || completedSteps.has(i);

                            return (
                                <div
                                    key={step.key}
                                    onClick={() => goToStep(i)}
                                    title={clickable ? `Go to ${step.label}` : ''}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        position: 'relative',
                                        zIndex: 2,
                                        cursor: clickable ? 'pointer' : 'default',
                                        opacity: clickable || isActive ? 1 : 0.6,
                                        transition: 'opacity 0.2s',
                                    }}
                                >
                                    {/* Circle */}
                                    <div style={{
                                        width: 40, height: 40,
                                        borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: isActive ? '1.1rem' : '0.95rem',
                                        fontWeight: 700,
                                        transition: 'all 0.3s ease',
                                        ...(isCompleted || isPast ? {
                                            background: 'linear-gradient(135deg, #059669, #10b981)',
                                            color: '#fff',
                                            boxShadow: '0 0 12px rgba(16,185,129,0.4)',
                                        } : isActive ? {
                                            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                                            color: '#fff',
                                            boxShadow: '0 0 20px rgba(124,58,237,0.65), 0 0 40px rgba(124,58,237,0.2)',
                                            transform: 'scale(1.12)',
                                        } : {
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '2px solid rgba(255,255,255,0.15)',
                                            color: 'rgba(255,255,255,0.35)',
                                        }),
                                    }}>
                                        {(isCompleted || isPast) ? <CheckOutlined /> : step.icon}
                                    </div>

                                    {/* Label */}
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                                            color: isActive ? '#fff' : (isCompleted || isPast) ? '#86efac' : 'rgba(255,255,255,0.35)',
                                            transition: 'color 0.3s',
                                        }}>
                                            {step.label}
                                        </div>
                                        <div style={{
                                            fontSize: '0.68rem',
                                            color: isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)',
                                        }}>
                                            {step.desc}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '5rem' }}>
                {renderContent()}
            </div>

            {/* ── Bottom Nav — always sticky at bottom ── */}
            <div style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                background: '#fff',
                borderTop: '1px solid #e8e8e8',
                padding: '0.75rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 100,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    size="large"
                    style={{ borderRadius: 8 }}
                >
                    Back
                </Button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {STEPS.map((_, i) => (
                        <div key={i} style={{
                            width: i === currentStep ? 20 : 8,
                            height: 8,
                            borderRadius: 4,
                            background: i === currentStep ? '#7c3aed' : completedSteps.has(i) ? '#10b981' : '#e0e0e0',
                            transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>

                <Button
                    type="primary"
                    size="large"
                    onClick={nextStep}
                    disabled={currentStep === STEPS.length - 1}
                    style={{
                        background: currentStep === STEPS.length - 1 ? undefined : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        paddingLeft: '2rem',
                        paddingRight: '2rem',
                        boxShadow: currentStep === STEPS.length - 1 ? 'none' : '0 4px 15px rgba(124,58,237,0.35)',
                    }}
                >
                    {currentStep === STEPS.length - 1 ? 'Finish' : `Next: ${STEPS[currentStep + 1]?.label}`}
                </Button>
            </div>
        </div>
    );
};

export default RetrainingWorkspace;
