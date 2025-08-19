import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Progress,
  Statistic,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tabs,
  Timeline,
  Alert,
  Image,
  Divider
} from 'antd';
import {
  PlayCircleOutlined,
  PlusOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  ExperimentOutlined as BrainOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { Line, Column } from '@ant-design/plots';
import axios from 'axios';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const { TabPane } = Tabs;
const { Option } = Select;

const ActiveLearningDashboard = () => {
  // Log component initialization
  logInfo('app.frontend.ui', 'active_learning_dashboard_initialized', 'ActiveLearningDashboard component initialized', {
    timestamp: new Date().toISOString(),
    component: 'ActiveLearningDashboard',
    function: 'component_initialization'
  });

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [progress, setProgress] = useState(null);
  const [uncertainSamples, setUncertainSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    logInfo('app.frontend.interactions', 'active_learning_initial_data_fetch', 'Initial data fetch started', {
      timestamp: new Date().toISOString(),
      function: 'useEffect_initial_fetch'
    });
    fetchSessions();
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      logInfo('app.frontend.interactions', 'active_learning_session_selected', 'Active learning session selected', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        sessionName: selectedSession.name,
        sessionStatus: selectedSession.status,
        function: 'useEffect_session_selected'
      });
      fetchProgress();
      fetchUncertainSamples();
      // Auto-refresh progress every 10 seconds during training
      const interval = setInterval(() => {
        if (selectedSession.status === 'training') {
          logInfo('app.frontend.ui', 'active_learning_auto_refresh', 'Auto-refreshing progress during training', {
            timestamp: new Date().toISOString(),
            sessionId: selectedSession.id,
            function: 'useEffect_auto_refresh'
          });
          fetchProgress();
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    logInfo('app.frontend.interactions', 'fetch_active_learning_sessions_started', 'Fetching active learning sessions started', {
      timestamp: new Date().toISOString(),
      function: 'fetchSessions'
    });

    try {
      const response = await axios.get('/api/active-learning/sessions');
      setSessions(response.data);
      
      logInfo('app.frontend.interactions', 'fetch_active_learning_sessions_success', 'Active learning sessions fetched successfully', {
        timestamp: new Date().toISOString(),
        sessionsCount: response.data?.length || 0,
        function: 'fetchSessions'
      });
    } catch (error) {
      logError('app.frontend.interactions', 'fetch_active_learning_sessions_failed', 'Failed to fetch active learning sessions', {
        timestamp: new Date().toISOString(),
        error: error.message,
        function: 'fetchSessions'
      });
      message.error('Failed to fetch training sessions');
    }
  };

  const fetchDatasets = async () => {
    logInfo('app.frontend.interactions', 'fetch_active_learning_datasets_started', 'Fetching datasets for active learning started', {
      timestamp: new Date().toISOString(),
      function: 'fetchDatasets'
    });

    try {
      const response = await axios.get('/api/datasets');
      setDatasets(response.data);
      
      logInfo('app.frontend.interactions', 'fetch_active_learning_datasets_success', 'Datasets for active learning fetched successfully', {
        timestamp: new Date().toISOString(),
        datasetsCount: response.data?.length || 0,
        function: 'fetchDatasets'
      });
    } catch (error) {
      logError('app.frontend.interactions', 'fetch_active_learning_datasets_failed', 'Failed to fetch datasets for active learning', {
        timestamp: new Date().toISOString(),
        error: error.message,
        function: 'fetchDatasets'
      });
      message.error('Failed to fetch datasets');
    }
  };

  const fetchProgress = async () => {
    if (!selectedSession) {
      logInfo('app.frontend.ui', 'fetch_progress_no_session', 'No session selected for progress fetch', {
        timestamp: new Date().toISOString(),
        function: 'fetchProgress'
      });
      return;
    }
    
    logInfo('app.frontend.interactions', 'fetch_active_learning_progress_started', 'Fetching active learning progress started', {
      timestamp: new Date().toISOString(),
      sessionId: selectedSession.id,
      sessionName: selectedSession.name,
      function: 'fetchProgress'
    });
    
    try {
      const response = await axios.get(`/api/active-learning/sessions/${selectedSession.id}/progress`);
      setProgress(response.data);
      // Update selected session with latest data
      setSelectedSession(prev => ({ ...prev, ...response.data.session }));
      
      logInfo('app.frontend.interactions', 'fetch_active_learning_progress_success', 'Active learning progress fetched successfully', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        progressData: response.data,
        function: 'fetchProgress'
      });
    } catch (error) {
      logError('app.frontend.interactions', 'fetch_active_learning_progress_failed', 'Failed to fetch active learning progress', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        error: error.message,
        function: 'fetchProgress'
      });
    }
  };

  const fetchUncertainSamples = async () => {
    if (!selectedSession) {
      logInfo('app.frontend.ui', 'fetch_uncertain_samples_no_session', 'No session selected for uncertain samples fetch', {
        timestamp: new Date().toISOString(),
        function: 'fetchUncertainSamples'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'fetch_uncertain_samples_started', 'Fetching uncertain samples started', {
      timestamp: new Date().toISOString(),
      sessionId: selectedSession.id,
      sessionName: selectedSession.name,
      function: 'fetchUncertainSamples'
    });

    try {
      const response = await axios.get(`/api/active-learning/sessions/${selectedSession.id}/uncertain-samples`);
      setUncertainSamples(response.data);
      
      logInfo('app.frontend.interactions', 'fetch_uncertain_samples_success', 'Uncertain samples fetched successfully', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        samplesCount: response.data?.length || 0,
        function: 'fetchUncertainSamples'
      });
    } catch (error) {
      logError('app.frontend.interactions', 'fetch_uncertain_samples_failed', 'Failed to fetch uncertain samples', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        error: error.message,
        function: 'fetchUncertainSamples'
      });
    }
  };

  const createSession = async (values) => {
    logInfo('app.frontend.interactions', 'create_active_learning_session_started', 'Creating active learning session started', {
      timestamp: new Date().toISOString(),
      sessionValues: values,
      function: 'createSession'
    });

    try {
      setLoading(true);
      const response = await axios.post('/api/active-learning/sessions', values);
      setSessions(prev => [...prev, response.data]);
      setCreateModalVisible(false);
      form.resetFields();
      
      logInfo('app.frontend.interactions', 'create_active_learning_session_success', 'Active learning session created successfully', {
        timestamp: new Date().toISOString(),
        sessionId: response.data.id,
        sessionName: response.data.name,
        function: 'createSession'
      });
      
      message.success('Active learning session created successfully');
    } catch (error) {
      logError('app.frontend.interactions', 'create_active_learning_session_failed', 'Failed to create active learning session', {
        timestamp: new Date().toISOString(),
        sessionValues: values,
        error: error.message,
        function: 'createSession'
      });
      message.error('Failed to create active learning session');
    } finally {
      setLoading(false);
    }
  };

  const startIteration = async () => {
    if (!selectedSession) {
      logError('app.frontend.validation', 'start_iteration_no_session', 'No session selected for iteration start', {
        timestamp: new Date().toISOString(),
        function: 'startIteration'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'start_active_learning_iteration_started', 'Starting active learning iteration', {
      timestamp: new Date().toISOString(),
      sessionId: selectedSession.id,
      sessionName: selectedSession.name,
      function: 'startIteration'
    });

    try {
      setLoading(true);
      const response = await axios.post(`/api/active-learning/sessions/${selectedSession.id}/start-iteration`);
      setSelectedSession(prev => ({ ...prev, status: 'training' }));
      
      logInfo('app.frontend.interactions', 'start_active_learning_iteration_success', 'Active learning iteration started successfully', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        response: response.data,
        function: 'startIteration'
      });
      
      message.success('🎯 Iteration started! Model is now training on the selected samples.');
    } catch (error) {
      logError('app.frontend.interactions', 'start_active_learning_iteration_failed', 'Failed to start active learning iteration', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        error: error.message,
        function: 'startIteration'
      });
      message.error('Failed to start iteration');
    } finally {
      setLoading(false);
    }
  };

  const reviewSample = async (sampleId, accepted, corrected = false) => {
    if (!selectedSession) {
      logError('app.frontend.validation', 'review_sample_no_session', 'No session selected for sample review', {
        timestamp: new Date().toISOString(),
        sampleId: sampleId,
        function: 'reviewSample'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'review_sample_started', 'Reviewing sample started', {
      timestamp: new Date().toISOString(),
      sessionId: selectedSession.id,
      sampleId: sampleId,
      accepted: accepted,
      corrected: corrected,
      function: 'reviewSample'
    });

    try {
      const response = await axios.post(`/api/active-learning/sessions/${selectedSession.id}/review-sample`, {
        sample_id: sampleId,
        accepted,
        corrected
      });
      
      // Update uncertain samples list
      setUncertainSamples(prev => prev.filter(sample => sample.id !== sampleId));
      
      logInfo('app.frontend.interactions', 'review_sample_success', 'Sample reviewed successfully', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        sampleId: sampleId,
        accepted: accepted,
        corrected: corrected,
        response: response.data,
        function: 'reviewSample'
      });
      
      message.success(accepted ? '✅ Sample accepted!' : '❌ Sample rejected!');
    } catch (error) {
      logError('app.frontend.interactions', 'review_sample_failed', 'Failed to review sample', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        sampleId: sampleId,
        accepted: accepted,
        corrected: corrected,
        error: error.message,
        function: 'reviewSample'
      });
      message.error('Failed to review sample');
    }
  };

  const exportModel = async () => {
    if (!selectedSession) {
      logError('app.frontend.validation', 'export_model_no_session', 'No session selected for model export', {
        timestamp: new Date().toISOString(),
        function: 'exportModel'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'export_active_learning_model_started', 'Exporting active learning model started', {
      timestamp: new Date().toISOString(),
      sessionId: selectedSession.id,
      sessionName: selectedSession.name,
      function: 'exportModel'
    });

    try {
      setLoading(true);
      const response = await axios.get(`/api/active-learning/sessions/${selectedSession.id}/export-model`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `active-learning-model-${selectedSession.name}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      logInfo('app.frontend.interactions', 'export_active_learning_model_success', 'Active learning model exported successfully', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        sessionName: selectedSession.name,
        function: 'exportModel'
      });
      
      message.success('🎉 Model exported successfully!');
    } catch (error) {
      logError('app.frontend.interactions', 'export_active_learning_model_failed', 'Failed to export active learning model', {
        timestamp: new Date().toISOString(),
        sessionId: selectedSession.id,
        sessionName: selectedSession.name,
        error: error.message,
        function: 'exportModel'
      });
      message.error('Failed to export model');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      training: 'blue',
      completed: 'green',
      failed: 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <ClockCircleOutlined />,
      training: <RobotOutlined spin />,
      completed: <CheckCircleOutlined />,
      failed: <ExclamationCircleOutlined />
    };
    return icons[status] || <ExclamationCircleOutlined />;
  };

  const getProgressData = () => {
    if (!progress || !progress.iterations) return [];
    
    return progress.iterations.map(iteration => ({
      iteration: `Iter ${iteration.iteration_number}`,
      'mAP50': iteration.map50 || 0,
      'mAP95': iteration.map95 || 0,
      'Precision': iteration.precision || 0,
      'Recall': iteration.recall || 0
    }));
  };

  const getUncertaintyDistribution = () => {
    if (!uncertainSamples.length) return [];
    
    const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const distribution = bins.slice(0, -1).map((bin, index) => {
      const count = uncertainSamples.filter(sample => 
        sample.uncertainty_score >= bin && sample.uncertainty_score < bins[index + 1]
      ).length;
      return {
        range: `${bin.toFixed(1)}-${bins[index + 1].toFixed(1)}`,
        count,
        percentage: (count / uncertainSamples.length * 100).toFixed(1)
      };
    });
    
    return distribution;
  };

  const sessionColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => setSelectedSession(record)}
          style={{ padding: 0, fontWeight: 'bold' }}
        >
          <BrainOutlined /> {text}
        </Button>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_, record) => {
        const percent = (record.current_iteration / record.max_iterations) * 100;
        return (
          <Progress 
            percent={percent}
            size="small"
            format={() => `${record.current_iteration}/${record.max_iterations}`}
            strokeColor={percent === 100 ? '#52c41a' : '#1890ff'}
          />
        );
      }
    },
    {
      title: 'Best mAP50',
      dataIndex: 'best_map50',
      key: 'best_map50',
      render: value => value ? (
        <Tag color="green">{(value * 100).toFixed(1)}%</Tag>
      ) : (
        <Tag color="default">-</Tag>
      )
    },
    {
      title: 'Dataset',
      dataIndex: 'dataset_id',
      key: 'dataset_id',
      render: datasetId => {
        const dataset = datasets.find(d => d.id === datasetId);
        return dataset ? dataset.name : `Dataset ${datasetId}`;
      }
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => new Date(date).toLocaleDateString()
    }
  ];

  const sampleColumns = [
    {
      title: 'Image',
      dataIndex: 'image_id',
      key: 'image_id',
      render: imageId => (
        <Tag color="blue">
          <EyeOutlined /> Image {imageId}
        </Tag>
      )
    },
    {
      title: 'Uncertainty Score',
      dataIndex: 'uncertainty_score',
      key: 'uncertainty_score',
      render: score => (
        <div>
          <Progress 
            percent={score * 100} 
            size="small" 
            format={() => score.toFixed(3)}
            strokeColor={
              score > 0.8 ? '#ff4d4f' : 
              score > 0.6 ? '#faad14' : 
              score > 0.4 ? '#1890ff' : '#52c41a'
            }
          />
          <small style={{ color: '#666' }}>
            {score > 0.8 ? 'Very High' : 
             score > 0.6 ? 'High' : 
             score > 0.4 ? 'Medium' : 'Low'}
          </small>
        </div>
      )
    },
    {
      title: 'Confidence Range',
      key: 'confidence_range',
      render: (_, record) => (
        <div>
          <div>{record.min_confidence.toFixed(2)} - {record.max_confidence.toFixed(2)}</div>
          <small style={{ color: '#666' }}>
            Variance: {record.confidence_variance.toFixed(3)}
          </small>
        </div>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        if (!record.reviewed) return <Tag color="orange">🔍 Needs Review</Tag>;
        if (record.accepted && record.corrected) return <Tag color="blue">✏️ Corrected</Tag>;
        if (record.accepted) return <Tag color="green">✅ Accepted</Tag>;
        return <Tag color="red">❌ Rejected</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          size="small" 
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedSample(record);
            setReviewModalVisible(true);
          }}
          disabled={record.reviewed}
        >
          {record.reviewed ? 'Reviewed' : 'Review'}
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {(() => {
        logInfo('app.frontend.ui', 'active_learning_dashboard_rendered', 'ActiveLearningDashboard component rendered', {
          timestamp: new Date().toISOString(),
          component: 'ActiveLearningDashboard',
          sessionsCount: sessions.length,
          selectedSessionId: selectedSession?.id,
          loading: loading,
          createModalVisible: createModalVisible,
          reviewModalVisible: reviewModalVisible,
          function: 'component_render'
        });
        return null;
      })()}
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <h1 style={{ color: 'white', margin: 0 }}>
                  🧠 Active Learning Dashboard
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', margin: '8px 0 0 0', fontSize: '16px' }}>
                  Train custom models iteratively with intelligent sample selection
                </p>
              </Col>
              <Col>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    logUserClick('new_training_session_button_clicked', 'User clicked New Training Session button');
                    logInfo('app.frontend.interactions', 'create_modal_opened', 'Create training session modal opened', {
                      timestamp: new Date().toISOString(),
                      function: 'new_training_session_button_onClick'
                    });
                    setCreateModalVisible(true);
                  }}
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}
                >
                  New Training Session
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Quick Stats */}
        {sessions.length > 0 && (
          <Col span={24}>
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="Total Sessions" 
                    value={sessions.length}
                    prefix={<ExperimentOutlined style={{ color: '#1890ff' }} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="Active Sessions" 
                    value={sessions.filter(s => s.status === 'training').length}
                    prefix={<RobotOutlined style={{ color: '#52c41a' }} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="Completed Sessions" 
                    value={sessions.filter(s => s.status === 'completed').length}
                    prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="Best Performance" 
                    value={Math.max(...sessions.map(s => s.best_map50 || 0)) * 100}
                    precision={1}
                    suffix="%"
                    prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        )}

        {/* Sessions Overview */}
        <Col span={24}>
          <Card 
            title={
              <span>
                <ExperimentOutlined /> Training Sessions
              </span>
            }
            extra={
              <Button onClick={() => {
                logUserClick('refresh_sessions_button_clicked', 'User clicked Refresh Sessions button');
                logInfo('app.frontend.interactions', 'refresh_sessions_clicked', 'Refresh sessions button clicked', {
                  timestamp: new Date().toISOString(),
                  function: 'refresh_sessions_button_onClick'
                });
                fetchSessions();
              }} loading={loading}>
                Refresh
              </Button>
            }
          >
            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <BrainOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                <h3 style={{ color: '#999', marginTop: '16px' }}>No Training Sessions Yet</h3>
                <p style={{ color: '#666' }}>Create your first active learning session to get started!</p>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => {
                    logUserClick('create_session_empty_state_button_clicked', 'User clicked Create Session button from empty state');
                    logInfo('app.frontend.interactions', 'create_modal_opened_empty_state', 'Create training session modal opened from empty state', {
                      timestamp: new Date().toISOString(),
                      function: 'create_session_empty_state_button_onClick'
                    });
                    setCreateModalVisible(true);
                  }}
                >
                  Create Session
                </Button>
              </div>
            ) : (
              <Table 
                columns={sessionColumns}
                dataSource={sessions}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                rowClassName={(record) => 
                  selectedSession?.id === record.id ? 'ant-table-row-selected' : ''
                }
              />
            )}
          </Card>
        </Col>

        {/* Selected Session Details */}
        {selectedSession && (
          <Col span={24}>
            <Card 
              title={
                <span>
                  <BrainOutlined /> Session: {selectedSession.name}
                  <Tag 
                    color={getStatusColor(selectedSession.status)} 
                    style={{ marginLeft: 8 }}
                    icon={getStatusIcon(selectedSession.status)}
                  >
                    {selectedSession.status.toUpperCase()}
                  </Tag>
                </span>
              }
              extra={
                <Space>
                  <Button 
                    type="primary" 
                    icon={<PlayCircleOutlined />}
                    onClick={startIteration}
                    loading={loading}
                    disabled={selectedSession.status === 'completed' || selectedSession.status === 'training'}
                  >
                    {selectedSession.current_iteration === 0 ? 'Start First Iteration' : 'Start Next Iteration'}
                  </Button>
                  <Button 
                    icon={<DownloadOutlined />}
                    onClick={exportModel}
                    disabled={!selectedSession.best_map50}
                    type={selectedSession.status === 'completed' ? 'primary' : 'default'}
                  >
                    Export Best Model
                  </Button>
                </Space>
              }
            >
              <Tabs defaultActiveKey="progress">
                <TabPane tab={<span><TrophyOutlined />Progress</span>} key="progress">
                  {progress && (
                    <Row gutter={[16, 16]}>
                      {/* Key Metrics */}
                      <Col span={24}>
                        <Row gutter={16}>
                          <Col span={6}>
                            <Card size="small">
                              <Statistic 
                                title="Current Iteration" 
                                value={progress.session.current_iteration}
                                suffix={`/ ${progress.session.max_iterations}`}
                                prefix={<ExperimentOutlined style={{ color: '#1890ff' }} />}
                              />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card size="small">
                              <Statistic 
                                title="Best mAP50" 
                                value={progress.session.best_map50 * 100}
                                precision={1}
                                suffix="%"
                                prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                              />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card size="small">
                              <Statistic 
                                title="Best mAP95" 
                                value={progress.session.best_map95 * 100}
                                precision={1}
                                suffix="%"
                                prefix={<TrophyOutlined style={{ color: '#722ed1' }} />}
                              />
                            </Card>
                          </Col>
                          <Col span={6}>
                            <Card size="small">
                              <Statistic 
                                title="Total Training Time" 
                                value={progress.iterations.reduce((sum, it) => sum + (it.training_time_seconds || 0), 0)}
                                suffix="sec"
                                prefix={<ClockCircleOutlined style={{ color: '#52c41a' }} />}
                              />
                            </Card>
                          </Col>
                        </Row>
                      </Col>

                      {/* Performance Chart */}
                      {getProgressData().length > 0 && (
                        <Col span={24}>
                          <Card title="📈 Performance Metrics Over Iterations" size="small">
                            <Line
                              data={getProgressData().flatMap(item => 
                                Object.entries(item).filter(([key]) => key !== 'iteration').map(([metric, value]) => ({
                                  iteration: item.iteration,
                                  metric,
                                  value
                                }))
                              )}
                              xField="iteration"
                              yField="value"
                              seriesField="metric"
                              height={300}
                              smooth={true}
                              point={{ size: 5 }}
                              legend={{ position: 'top' }}
                              yAxis={{ min: 0, max: 1 }}
                              color={['#1890ff', '#52c41a', '#faad14', '#722ed1']}
                              meta={{
                                value: { alias: 'Score' },
                                iteration: { alias: 'Iteration' }
                              }}
                            />
                          </Card>
                        </Col>
                      )}

                      {/* Training Timeline */}
                      <Col span={24}>
                        <Card title="🕐 Training Timeline" size="small">
                          <Timeline>
                            {progress.iterations.map(iteration => (
                              <Timeline.Item 
                                key={iteration.iteration_number}
                                color={getStatusColor(iteration.status)}
                                dot={getStatusIcon(iteration.status)}
                              >
                                <div>
                                  <strong>Iteration {iteration.iteration_number}</strong>
                                  <Tag 
                                    color={getStatusColor(iteration.status)} 
                                    style={{ marginLeft: 8 }}
                                  >
                                    {iteration.status}
                                  </Tag>
                                  {iteration.map50 && (
                                    <div style={{ marginTop: 4 }}>
                                      <Row gutter={16}>
                                        <Col span={6}>
                                          <small>mAP50: <strong>{(iteration.map50 * 100).toFixed(1)}%</strong></small>
                                        </Col>
                                        <Col span={6}>
                                          <small>mAP95: <strong>{(iteration.map95 * 100).toFixed(1)}%</strong></small>
                                        </Col>
                                        <Col span={6}>
                                          <small>Precision: <strong>{(iteration.precision * 100).toFixed(1)}%</strong></small>
                                        </Col>
                                        <Col span={6}>
                                          <small>Recall: <strong>{(iteration.recall * 100).toFixed(1)}%</strong></small>
                                        </Col>
                                      </Row>
                                      {iteration.training_time_seconds && (
                                        <div style={{ marginTop: 4 }}>
                                          <small>Training time: <strong>{iteration.training_time_seconds}s</strong></small>
                                          <small style={{ marginLeft: 16 }}>
                                            Images: <strong>{iteration.training_images_count}</strong> train, 
                                            <strong> {iteration.validation_images_count}</strong> val
                                          </small>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Timeline.Item>
                            ))}
                          </Timeline>
                        </Card>
                      </Col>
                    </Row>
                  )}
                </TabPane>

                <TabPane tab={<span><EyeOutlined />Uncertain Samples ({uncertainSamples.length})</span>} key="samples">
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Alert
                        message="🎯 Review High-Uncertainty Samples"
                        description="These images have high uncertainty scores and would benefit most from manual labeling to improve the model. Focus on the highest uncertainty samples first."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    </Col>

                    {/* Uncertainty Distribution */}
                    {uncertainSamples.length > 0 && (
                      <Col span={24}>
                        <Card title="📊 Uncertainty Score Distribution" size="small">
                          <Column
                            data={getUncertaintyDistribution()}
                            xField="range"
                            yField="count"
                            height={200}
                            color="#1890ff"
                            meta={{
                              count: { alias: 'Number of Samples' },
                              range: { alias: 'Uncertainty Range' }
                            }}
                          />
                        </Card>
                      </Col>
                    )}

                    <Col span={24}>
                      {uncertainSamples.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                          <EyeOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                          <h3 style={{ color: '#999', marginTop: '16px' }}>No Uncertain Samples Yet</h3>
                          <p style={{ color: '#666' }}>
                            Complete a training iteration to generate uncertain samples for review.
                          </p>
                        </div>
                      ) : (
                        <Table 
                          columns={sampleColumns}
                          dataSource={uncertainSamples}
                          rowKey="id"
                          pagination={{ 
                            pageSize: 20,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                              `${range[0]}-${range[1]} of ${total} uncertain samples`
                          }}
                          scroll={{ x: 800 }}
                        />
                      )}
                    </Col>
                  </Row>
                </TabPane>
              </Tabs>
            </Card>
          </Col>
        )}
      </Row>

      {/* Create Session Modal */}
      <Modal
        title={
          <span>
            <BrainOutlined /> Create New Active Learning Session
          </span>
        }
        open={createModalVisible}
        onCancel={() => {
          logUserClick('create_session_modal_canceled', 'User canceled create session modal');
          logInfo('app.frontend.ui', 'create_session_modal_closed', 'Create session modal closed', {
            timestamp: new Date().toISOString(),
            function: 'create_session_modal_onCancel'
          });
          setCreateModalVisible(false);
        }}
        footer={null}
        width={700}
        onOpenChange={(open) => {
          if (open) {
            logInfo('app.frontend.ui', 'create_session_modal_opened', 'Create session modal opened', {
              timestamp: new Date().toISOString(),
              function: 'create_session_modal_onOpenChange'
            });
          }
        }}
      >
        <Alert
          message="🚀 Start Your Active Learning Journey"
          description="Create a training session to iteratively improve your model with intelligent sample selection. Perfect for complex defects, custom objects, and domain-specific detection tasks."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            logInfo('app.frontend.interactions', 'create_session_form_submitted', 'Create session form submitted', {
              timestamp: new Date().toISOString(),
              formValues: values,
              function: 'create_session_form_onFinish'
            });
            createSession(values);
          }}
          onFinishFailed={(errorInfo) => {
            logError('app.frontend.validation', 'create_session_form_validation_failed', 'Create session form validation failed', {
              timestamp: new Date().toISOString(),
              errorInfo: errorInfo,
              function: 'create_session_form_onFinishFailed'
            });
          }}
        >
          <Form.Item
            name="name"
            label="Session Name"
            rules={[{ required: true, message: 'Please enter session name' }]}
          >
            <Input 
              placeholder="e.g., Industrial Defect Detection v1" 
              prefix={<ExperimentOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              placeholder="Describe your training objective and expected outcomes..."
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="dataset_id"
            label="Dataset"
            rules={[{ required: true, message: 'Please select a dataset' }]}
          >
            <Select placeholder="Select dataset for training">
              {datasets.map(dataset => (
                <Option key={dataset.id} value={dataset.id}>
                  📁 {dataset.name} ({dataset.image_count || 0} images)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Training Configuration</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="epochs"
                label="Epochs per Iteration"
                initialValue={50}
                tooltip="Number of training epochs for each iteration"
              >
                <InputNumber 
                  min={10} 
                  max={200} 
                  style={{ width: '100%' }}
                  formatter={value => `${value} epochs`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="batch_size"
                label="Batch Size"
                initialValue={16}
                tooltip="Number of images processed together"
              >
                <InputNumber 
                  min={1} 
                  max={64} 
                  style={{ width: '100%' }}
                  formatter={value => `${value} images`}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="learning_rate"
                label="Learning Rate"
                initialValue={0.001}
                tooltip="Controls how fast the model learns"
              >
                <InputNumber 
                  min={0.0001} 
                  max={0.1} 
                  step={0.0001} 
                  style={{ width: '100%' }}
                  formatter={value => `${value}`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_iterations"
                label="Max Iterations"
                initialValue={10}
                tooltip="Maximum number of active learning iterations"
              >
                <InputNumber 
                  min={1} 
                  max={20} 
                  style={{ width: '100%' }}
                  formatter={value => `${value} iterations`}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                🚀 Create Session
              </Button>
              <Button onClick={() => setCreateModalVisible(false)} size="large">
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Review Sample Modal */}
      <Modal
        title={
          <span>
            <EyeOutlined /> Review Uncertain Sample
          </span>
        }
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedSample && (
          <div>
            <Alert
              message="🎯 High-Uncertainty Sample Detected"
              description="This image has high prediction uncertainty. Your review will help improve the model's performance on similar cases."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="📊 Sample Information" size="small">
                  <Row gutter={[8, 8]}>
                    <Col span={24}>
                      <strong>Image ID:</strong> {selectedSample.image_id}
                    </Col>
                    <Col span={24}>
                      <strong>Uncertainty Score:</strong> 
                      <Progress 
                        percent={selectedSample.uncertainty_score * 100}
                        size="small"
                        format={() => selectedSample.uncertainty_score.toFixed(3)}
                        strokeColor={
                          selectedSample.uncertainty_score > 0.8 ? '#ff4d4f' : 
                          selectedSample.uncertainty_score > 0.6 ? '#faad14' : '#1890ff'
                        }
                        style={{ marginLeft: 8 }}
                      />
                    </Col>
                    <Col span={12}>
                      <strong>Min Confidence:</strong> {selectedSample.min_confidence.toFixed(3)}
                    </Col>
                    <Col span={12}>
                      <strong>Max Confidence:</strong> {selectedSample.max_confidence.toFixed(3)}
                    </Col>
                    <Col span={12}>
                      <strong>Variance:</strong> {selectedSample.confidence_variance.toFixed(3)}
                    </Col>
                    <Col span={12}>
                      <strong>Entropy:</strong> {selectedSample.entropy_score.toFixed(3)}
                    </Col>
                  </Row>
                </Card>
              </Col>
              
              <Col span={12}>
                <Card title="🎯 Review Actions" size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Button 
                      type="primary" 
                      block
                      size="large"
                      onClick={() => reviewSample(selectedSample.id, true)}
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                      ✅ Accept Prediction
                      <br />
                      <small>The model's prediction is correct</small>
                    </Button>
                    
                    <Button 
                      block
                      size="large"
                      onClick={() => reviewSample(selectedSample.id, true, true)}
                      style={{ background: '#1890ff', borderColor: '#1890ff', color: 'white' }}
                    >
                      ✏️ Accept with Corrections
                      <br />
                      <small>Mostly correct but needs minor adjustments</small>
                    </Button>
                    
                    <Button 
                      danger 
                      block
                      size="large"
                      onClick={() => reviewSample(selectedSample.id, false)}
                    >
                      ❌ Reject Prediction
                      <br />
                      <small>The prediction is incorrect</small>
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ActiveLearningDashboard;