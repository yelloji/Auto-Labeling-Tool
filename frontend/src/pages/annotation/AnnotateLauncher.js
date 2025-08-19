import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Typography, 
  Row, 
  Col, 
  Space,
  Spin,
  message,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  UserOutlined
} from '@ant-design/icons';
import { datasetsAPI } from '../../services/api';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const { Title, Paragraph } = Typography;

const AnnotateLauncher = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);

  // Log component mount
  useEffect(() => {
    logInfo('app.frontend.navigation', 'annotate_launcher_page_loaded', 'AnnotateLauncher page loaded', {
      datasetId,
      timestamp: new Date().toISOString()
    });
  }, [datasetId]);

  // Load dataset information
  useEffect(() => {
    const loadDataset = async () => {
      if (!datasetId) {
        logError('app.frontend.validation', 'dataset_id_missing', 'Dataset ID is required', null, {
          datasetId,
          timestamp: new Date().toISOString()
        });
        message.error('Dataset ID is required');
        navigate('/projects');
        return;
      }

      setLoading(true);
      logInfo('app.frontend.interactions', 'loading_dataset', 'Loading dataset information', {
        datasetId,
        timestamp: new Date().toISOString()
      });

      try {
        // Try to get dataset info from API
        const response = await datasetsAPI.getDataset(datasetId);
        setDataset(response);
        logInfo('app.frontend.interactions', 'dataset_loaded_success', 'Dataset loaded successfully', {
          datasetId,
          datasetName: response.name,
          datasetDescription: response.description,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logError('app.frontend.validation', 'dataset_load_failed', 'Failed to load dataset from API', error, {
          datasetId,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
        console.error('Error loading dataset:', error);
        // If API fails, use a fallback with the dataset ID
        setDataset({
          id: datasetId,
          name: `Dataset ${datasetId}`,
          description: 'Dataset ready for annotation'
        });
        logInfo('app.frontend.ui', 'fallback_dataset_created', 'Created fallback dataset', {
          datasetId,
          fallbackName: `Dataset ${datasetId}`,
          timestamp: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    loadDataset();
  }, [datasetId, navigate]);

  const handleManualLabeling = () => {
    logUserClick('AnnotateLauncher', 'manual_labeling_button', {
      datasetId,
      datasetName: dataset?.name,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.navigation', 'navigate_to_manual_labeling', 'Navigating to manual labeling', {
      datasetId,
      targetUrl: `/annotate-progress/${datasetId}`,
      timestamp: new Date().toISOString()
    });
    navigate(`/annotate-progress/${datasetId}`);
  };

  const handleAutoLabeling = () => {
    logUserClick('AnnotateLauncher', 'auto_labeling_button', {
      datasetId,
      datasetName: dataset?.name,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.navigation', 'navigate_to_auto_labeling', 'Navigating to auto labeling', {
      datasetId,
      targetUrl: `/annotate/${datasetId}/auto`,
      timestamp: new Date().toISOString()
    });
    navigate(`/annotate/${datasetId}/auto`);
  };

  const handleGoBack = () => {
    // Get the project ID from the dataset
    // If dataset has a project_id property, use it; otherwise try to extract from the ID
    const projectId = dataset?.project_id || 
                     (datasetId.includes('-') ? datasetId.split('-')[0] : '1');
    
    logUserClick('AnnotateLauncher', 'go_back_button', {
      datasetId,
      projectId,
      datasetName: dataset?.name,
      timestamp: new Date().toISOString()
    });
    
    logInfo('app.frontend.navigation', 'navigate_back_to_project', 'Navigating back to project workspace', {
      datasetId,
      projectId,
      targetUrl: `/projects/${projectId}/workspace?section=management`,
      timestamp: new Date().toISOString()
    });
    
    console.log('Navigating back to project workspace:', {
      projectId,
      datasetId,
      dataset
    });
    
    // Navigate to the project workspace with management section selected
    // Use both state and URL parameter for maximum compatibility
    navigate(`/projects/${projectId}/workspace?section=management`, { 
      state: { selectedSection: 'management' } 
    });
  };

  if (loading) {
    logInfo('app.frontend.ui', 'annotate_launcher_loading', 'AnnotateLauncher loading state', {
      datasetId,
      timestamp: new Date().toISOString()
    });
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ maxWidth: 800, width: '100%' }}>
        {/* Back Button */}
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleGoBack}
          style={{ 
            marginBottom: 24,
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white'
          }}
          size="large"
        >
          Back
        </Button>

        {/* Main Card */}
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            border: 'none'
          }}
          bodyStyle={{ padding: '48px 40px' }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Title level={1} style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 16
            }}>
              🎯 How do you want to label your images?
            </Title>
            
            {dataset && (
              <div style={{ marginBottom: 24 }}>
                <Title level={4} style={{ color: '#666', margin: 0 }}>
                  Dataset: {dataset.name}
                </Title>
                {dataset.description && (
                  <Paragraph style={{ color: '#999', margin: 0 }}>
                    {dataset.description}
                  </Paragraph>
                )}
              </div>
            )}
            
            <Paragraph style={{ 
              fontSize: '1.1rem', 
              color: '#666',
              maxWidth: 600,
              margin: '0 auto'
            }}>
              Choose your preferred annotation method to start labeling your dataset images.
            </Paragraph>
          </div>

          <Divider style={{ margin: '32px 0' }} />

          {/* Annotation Options */}
          <Row gutter={[32, 32]} justify="center">
            {/* Manual Labeling Option */}
            <Col xs={24} md={12}>
              <Card
                hoverable
                style={{
                  height: '100%',
                  borderRadius: 12,
                  border: '2px solid #f0f0f0',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                bodyStyle={{ 
                  padding: '32px 24px',
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onClick={handleManualLabeling}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1890ff';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(24, 144, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#f0f0f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <div style={{ 
                    fontSize: '4rem', 
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #1890ff, #40a9ff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    📝
                  </div>
                  <Title level={3} style={{ marginBottom: 16 }}>
                    Manual Labeling
                  </Title>
                  <Paragraph style={{ color: '#666', marginBottom: 24 }}>
                    Draw bounding boxes and polygons manually with full control over every annotation. 
                    Perfect for precise labeling and quality assurance.
                  </Paragraph>
                  <Space direction="vertical" size="small">
                    <div style={{ color: '#52c41a' }}>✓ Full precision control</div>
                    <div style={{ color: '#52c41a' }}>✓ Custom annotation tools</div>
                    <div style={{ color: '#52c41a' }}>✓ Quality assurance</div>
                  </Space>
                </div>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<UserOutlined />}
                  style={{ 
                    marginTop: 24,
                    height: 48,
                    borderRadius: 8,
                    fontWeight: 'bold'
                  }}
                  block
                >
                  Start Manual Labeling
                </Button>
              </Card>
            </Col>

            {/* Auto Labeling Option */}
            <Col xs={24} md={12}>
              <Card
                hoverable
                style={{
                  height: '100%',
                  borderRadius: 12,
                  border: '2px solid #f0f0f0',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                bodyStyle={{ 
                  padding: '32px 24px',
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onClick={handleAutoLabeling}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#52c41a';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(82, 196, 26, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#f0f0f0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <div style={{ 
                    fontSize: '4rem', 
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    🤖
                  </div>
                  <Title level={3} style={{ marginBottom: 16 }}>
                    Auto Labeling
                  </Title>
                  <Paragraph style={{ color: '#666', marginBottom: 24 }}>
                    Let AI automatically detect and label objects in your images. 
                    Fast and efficient for large datasets with manual review options.
                  </Paragraph>
                  <Space direction="vertical" size="small">
                    <div style={{ color: '#52c41a' }}>✓ AI-powered detection</div>
                    <div style={{ color: '#52c41a' }}>✓ Batch processing</div>
                    <div style={{ color: '#52c41a' }}>✓ Manual refinement</div>
                  </Space>
                </div>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<ThunderboltOutlined />}
                  style={{ 
                    marginTop: 24,
                    height: 48,
                    borderRadius: 8,
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                    border: 'none'
                  }}
                  block
                >
                  Start Auto Labeling
                </Button>
              </Card>
            </Col>
          </Row>

          {/* Additional Info */}
          <div style={{ 
            textAlign: 'center', 
            marginTop: 48,
            padding: '24px',
            background: '#f8f9fa',
            borderRadius: 8
          }}>
            <Paragraph style={{ margin: 0, color: '#666' }}>
              💡 <strong>Tip:</strong> You can switch between manual and auto labeling modes at any time during the annotation process.
            </Paragraph>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnnotateLauncher;