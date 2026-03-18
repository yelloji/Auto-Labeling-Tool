import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Typography,
  Row,
  Col,
  Space,
  Spin,
  message,
  Progress,
  Tabs,
  Input,
  Tag,
  Avatar,
  Divider,
  Empty,
  Tooltip,
  Drawer,
  Slider,
  Radio,
  Statistic,
  Select
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  FileImageOutlined,
  TagOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { datasetsAPI, projectsAPI } from '../../services/api';
import { logInfo, logError, logUserClick } from '../../utils/professional_logger';

const { Title, Paragraph, Text } = Typography;
const { Sider, Content } = Layout;
const { TextArea } = Input;

const AnnotateProgress = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();

  // State management
  const [dataset, setDataset] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [instructions, setInstructions] = useState('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [tempInstructions, setTempInstructions] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Dataset split drawer state
  const [splitDrawerVisible, setSplitDrawerVisible] = useState(false);
  const [splitMethod, setSplitMethod] = useState('use_existing');
  const [splitPercentages, setSplitPercentages] = useState([70, 20]); // [train, val] - test is calculated (10%)
  const [assignLoading, setAssignLoading] = useState(false);

  const imagesPerPage = 50;

  // Log component mount
  useEffect(() => {
    logInfo('app.frontend.navigation', 'annotate_progress_page_loaded', 'AnnotateProgress page loaded', {
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
      logInfo('app.frontend.interactions', 'loading_dataset_info', 'Loading dataset information', {
        datasetId,
        timestamp: new Date().toISOString()
      });

      try {
        const response = await datasetsAPI.getDataset(datasetId);
        setDataset(response);
        setInstructions(response.description || 'Click edit to add annotation instructions...');
        setTempInstructions(response.description || '');
        logInfo('app.frontend.interactions', 'dataset_info_loaded_success', 'Dataset information loaded successfully', {
          datasetId,
          datasetName: response.name,
          totalImages: response.total_images,
          labeledImages: response.labeled_images,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logError('app.frontend.validation', 'dataset_info_load_failed', 'Failed to load dataset information', error, {
          datasetId,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
        console.error('Error loading dataset:', error);
        message.error('Failed to load dataset information');
        // Fallback dataset info
        setDataset({
          id: datasetId,
          name: `Dataset ${datasetId}`,
          description: 'Dataset ready for annotation',
          total_images: 0,
          labeled_images: 0,
          unlabeled_images: 0,
          created_at: new Date().toISOString()
        });
        logInfo('app.frontend.ui', 'fallback_dataset_created', 'Created fallback dataset info', {
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

  // Load images with pagination
  useEffect(() => {
    const loadImages = async () => {
      if (!datasetId) return;

      setImagesLoading(true);
      logInfo('app.frontend.interactions', 'loading_dataset_images', 'Loading dataset images', {
        datasetId,
        timestamp: new Date().toISOString()
      });

      try {
        // Load more images to handle filtering on client side
        const response = await datasetsAPI.getDatasetImages(datasetId, 0, 1000);
        setImages(response.images || []);
        logInfo('app.frontend.interactions', 'dataset_images_loaded_success', 'Dataset images loaded successfully', {
          datasetId,
          imageCount: response.images?.length || 0,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logError('app.frontend.validation', 'dataset_images_load_failed', 'Failed to load dataset images', error, {
          datasetId,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
        console.error('Error loading images:', error);
        message.error('Failed to load images');
        setImages([]);
      } finally {
        setImagesLoading(false);
      }
    };

    loadImages();
  }, [datasetId]);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
    logInfo('app.frontend.ui', 'tab_changed_reset_pagination', 'Tab changed, resetting pagination', {
      datasetId,
      activeTab,
      timestamp: new Date().toISOString()
    });
  }, [activeTab, datasetId]);

  // Filter images based on active tab
  const allFilteredImages = images.filter(image => {
    if (activeTab === 'labeled') return image.is_labeled;
    if (activeTab === 'unlabeled') return !image.is_labeled;
    return true; // 'all' tab
  });

  // Paginate filtered images
  const startIndex = (currentPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const filteredImages = allFilteredImages.slice(startIndex, endIndex);
  const totalFilteredImages = allFilteredImages.length;

  // Calculate progress
  const totalImagesCount = images.length;
  const labeledImages = images.filter(img => img.is_labeled).length;
  const progressPercentage = totalImagesCount > 0 ? Math.round((labeledImages / totalImagesCount) * 100) : 0;

  // Handle image click
  const handleImageClick = (imageId) => {
    logUserClick('AnnotateProgress', 'image_click', {
      datasetId,
      imageId,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.navigation', 'navigate_to_manual_annotation', 'Navigating to manual annotation', {
      datasetId,
      imageId,
      targetUrl: `/annotate/${datasetId}/manual?imageId=${imageId}`,
      timestamp: new Date().toISOString()
    });
    navigate(`/annotate/${datasetId}/manual?imageId=${imageId}`);
  };

  // Handle split method change
  const handleSplitMethodChange = (value) => {
    logUserClick('AnnotateProgress', 'split_method_change', {
      datasetId,
      splitMethod: value,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.ui', 'split_method_updated', 'Dataset split method updated', {
      datasetId,
      oldMethod: splitMethod,
      newMethod: value,
      timestamp: new Date().toISOString()
    });
    setSplitMethod(value);
  };

  // Handle slider change for percentages
  const handleSliderChange = (newValues) => {
    // The slider has two points:
    // - First point (newValues[0]) is the end of train set
    // - Second point (newValues[1]) is the end of train+val sets

    let [trainEnd, valEnd] = newValues;

    // Ensure the slider handles stay within valid bounds (0-100)
    trainEnd = Math.max(0, Math.min(trainEnd, 100));
    valEnd = Math.max(trainEnd, Math.min(valEnd, 100));

    // Calculate all three percentages
    const trainPercent = trainEnd;
    const valPercent = valEnd - trainEnd;
    const testPercent = 100 - valEnd;  // Explicitly calculate test percentage

    // Update the splitPercentages state
    setSplitPercentages([trainPercent, valPercent]);

    logInfo('app.frontend.ui', 'split_percentages_updated', 'Dataset split percentages updated', {
      datasetId,
      trainPercent,
      valPercent,
      testPercent,
      timestamp: new Date().toISOString()
    });

    // Log the percentages for debugging
    console.log(`Train: ${trainPercent}%, Val: ${valPercent}%, Test: ${testPercent}%`);
  };

  // Calculate test percentage based on valEnd (which is splitPercentages[0] + splitPercentages[1])
  const testPercentage = Math.max(0, 100 - (splitPercentages[0] + splitPercentages[1]));

  // For the slider, we need the cumulative values
  const trainEndPoint = splitPercentages[0];
  const valEndPoint = splitPercentages[0] + splitPercentages[1];

  // Calculate number of images per split
  const totalLabeledImages = images.filter(img => img.is_labeled).length;

  // Use smarter allocation for small datasets
  let trainCount, valCount, testCount;

  if (totalLabeledImages <= 3) {
    // Special handling for small datasets
    trainCount = 0;
    valCount = 0;
    testCount = 0;

    // Create list of splits with their percentages
    const splits = [
      { name: 'train', percentage: splitPercentages[0] },
      { name: 'val', percentage: splitPercentages[1] },
      { name: 'test', percentage: testPercentage }
    ];

    // Filter out any splits with 0%
    const nonZeroSplits = splits.filter(split => split.percentage > 0);

    // Sort by percentage (highest first)
    nonZeroSplits.sort((a, b) => b.percentage - a.percentage);

    // Distribute images
    let imagesLeft = totalLabeledImages;

    nonZeroSplits.forEach(split => {
      // Allocate at least 1 image to each non-zero split if possible
      if (imagesLeft > 0) {
        const splitImages = Math.min(
          Math.max(1, Math.round(totalLabeledImages * split.percentage / 100)),
          imagesLeft
        );

        if (split.name === 'train') trainCount = splitImages;
        else if (split.name === 'val') valCount = splitImages;
        else testCount = splitImages;

        imagesLeft -= splitImages;
      }
    });
  } else {
    // Standard calculation for larger datasets
    trainCount = Math.floor(totalLabeledImages * splitPercentages[0] / 100);
    valCount = Math.floor(totalLabeledImages * splitPercentages[1] / 100);
    // Ensure all images are accounted for by assigning remainder to test
    testCount = totalLabeledImages - trainCount - valCount;
  }

  // Handle assigning images to dataset splits
  const handleAssignImages = async () => {
    logUserClick('AnnotateProgress', 'assign_images_button', {
      datasetId,
      splitMethod,
      splitPercentages,
      totalLabeledImages,
      timestamp: new Date().toISOString()
    });

    setAssignLoading(true);
    logInfo('app.frontend.interactions', 'assigning_images_to_splits', 'Assigning images to dataset splits', {
      datasetId,
      splitMethod,
      splitPercentages,
      totalLabeledImages,
      timestamp: new Date().toISOString()
    });

    try {
      // Prepare request data based on the selected method
      let requestData = {
        method: splitMethod
      };

      // Only include percentages for the random assignment method
      if (splitMethod === 'assign_random') {
        // Ensure percentages are integers and sum to 100
        const trainPercent = Math.round(splitPercentages[0]);
        const valPercent = Math.round(splitPercentages[1]);
        // Calculate test percent using the same logic as the slider
        const testPercent = 100 - (trainPercent + valPercent);

        console.log(`Split percentages: Train=${trainPercent}%, Val=${valPercent}%, Test=${testPercent}%`);

        requestData = {
          ...requestData,
          train_percent: trainPercent,
          val_percent: valPercent,
          test_percent: testPercent
        };
      }

      console.log('Assigning images with data:', requestData);
      const response = await datasetsAPI.assignImagesToSplits(datasetId, requestData);

      logInfo('app.frontend.interactions', 'images_assigned_success', 'Images assigned to splits successfully', {
        datasetId,
        splitMethod,
        response: response.message,
        timestamp: new Date().toISOString()
      });

      message.success(response.message || 'Images assigned successfully');

      // Move dataset to completed section
      logInfo('app.frontend.interactions', 'moving_dataset_to_completed', 'Moving dataset to completed section', {
        datasetId,
        projectId: dataset.project_id,
        timestamp: new Date().toISOString()
      });

      await projectsAPI.moveDatasetToCompleted(dataset.project_id, datasetId);

      // Navigate to main project workspace
      logInfo('app.frontend.navigation', 'navigate_to_project_workspace', 'Navigating to project workspace', {
        datasetId,
        projectId: dataset.project_id,
        targetUrl: `/projects/${dataset.project_id}/workspace`,
        timestamp: new Date().toISOString()
      });

      navigate(`/projects/${dataset.project_id}/workspace`);

    } catch (error) {
      logError('app.frontend.validation', 'assign_images_failed', 'Failed to assign images to splits', error, {
        datasetId,
        splitMethod,
        splitPercentages,
        errorMessage: error.message,
        errorDetail: error.response?.data?.detail,
        timestamp: new Date().toISOString()
      });

      console.error('Error assigning images:', error);
      message.error('Failed to assign images to dataset splits');

      // Show more detailed error if available
      if (error.response && error.response.data && error.response.data.detail) {
        message.error(`Error: ${error.response.data.detail}`);
      }
    } finally {
      setAssignLoading(false);
      setSplitDrawerVisible(false);
    }
  };

  // Handle instructions edit
  const handleEditInstructions = () => {
    logUserClick('AnnotateProgress', 'edit_instructions_button', {
      datasetId,
      currentInstructions: instructions,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.ui', 'instructions_edit_mode_enabled', 'Instructions edit mode enabled', {
      datasetId,
      timestamp: new Date().toISOString()
    });
    setEditingInstructions(true);
    setTempInstructions(instructions);
  };

  const handleSaveInstructions = async () => {
    logUserClick('AnnotateProgress', 'save_instructions_button', {
      datasetId,
      newInstructions: tempInstructions,
      timestamp: new Date().toISOString()
    });

    logInfo('app.frontend.interactions', 'saving_instructions', 'Saving annotation instructions', {
      datasetId,
      newInstructions: tempInstructions,
      timestamp: new Date().toISOString()
    });

    try {
      await datasetsAPI.updateDataset(datasetId, { description: tempInstructions });
      setInstructions(tempInstructions);
      setEditingInstructions(false);

      logInfo('app.frontend.interactions', 'instructions_saved_success', 'Instructions saved successfully', {
        datasetId,
        newInstructions: tempInstructions,
        timestamp: new Date().toISOString()
      });

      message.success('Instructions updated successfully');
    } catch (error) {
      logError('app.frontend.validation', 'save_instructions_failed', 'Failed to save instructions', error, {
        datasetId,
        newInstructions: tempInstructions,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('Error updating instructions:', error);
      message.error('Failed to update instructions');
    }
  };

  const handleCancelEdit = () => {
    logUserClick('AnnotateProgress', 'cancel_edit_instructions_button', {
      datasetId,
      timestamp: new Date().toISOString()
    });
    logInfo('app.frontend.ui', 'instructions_edit_cancelled', 'Instructions edit cancelled', {
      datasetId,
      timestamp: new Date().toISOString()
    });
    setEditingInstructions(false);
    setTempInstructions(instructions);
  };

  const handleGoBack = () => {
    logUserClick('AnnotateProgress', 'go_back_button', {
      datasetId,
      timestamp: new Date().toISOString()
    });

    // Navigate back to the annotate launcher instead of browser history
    logInfo('app.frontend.navigation', 'navigate_back_to_launcher', 'Navigating back to annotate launcher', {
      datasetId,
      targetUrl: `/annotate-launcher/${datasetId}`,
      timestamp: new Date().toISOString()
    });

    navigate(`/annotate-launcher/${datasetId}`);
  };

  // Professional Responsive Engine
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 576; // Standard phone breakpoint
  const isTablet = windowWidth >= 576 && windowWidth < 1024;



  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color and icon
  const getImageStatus = (image) => {
    if (image.is_labeled) {
      return {
        color: '#52c41a',
        icon: <CheckCircleOutlined />,
        text: 'Labeled',
        tag: 'success'
      };
    } else {
      return {
        color: '#faad14',
        icon: <ExclamationCircleOutlined />,
        text: 'Unlabeled',
        tag: 'warning'
      };
    }
  };

  if (loading) {
    logInfo('app.frontend.ui', 'annotate_progress_loading', 'AnnotateProgress loading state', {
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

  const tabItems = [
    {
      key: 'all',
      label: <span style={{ fontSize: '1.0625rem' }}>All Images ({totalImagesCount})</span>,
      children: null
    },
    {
      key: 'labeled',
      label: <span style={{ fontSize: '1.0625rem' }}>Annotated ({labeledImages})</span>,
      children: null
    },
    {
      key: 'unlabeled',
      label: <span style={{ fontSize: '1.0625rem' }}>Unannotated ({totalImagesCount - labeledImages})</span>,
      children: null
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Left Sidebar */}
      <Sider
        width="20rem"
        style={{
          background: '#fff',
          boxShadow: '0.125rem 0 0.5rem rgba(0,0,0,0.1)',
          zIndex: 1
        }}
      >
        <div style={{ padding: '1.5rem' }}>
          {/* Back Button */}
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBack}
            style={{ marginBottom: '1.5rem', fontSize: '1.0625rem' }}
            type="text"
          >
            Back to Launcher
          </Button>

          {/* Dataset Metadata */}
          <Card
            size="small"
            style={{ marginBottom: '1.5rem' }}
            title={
              <Space style={{ whiteSpace: 'nowrap' }}>
                <FileImageOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ whiteSpace: 'nowrap', fontSize: '1.25rem' }}>Dataset Info</Text>
              </Space>
            }
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '1.125rem' }}>Name:</Text>
                <br />
                <Text strong style={{ whiteSpace: 'nowrap', fontSize: '1.25rem' }}>{dataset?.name}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '1.125rem' }}>Created:</Text>
                <br />
                <Space style={{ whiteSpace: 'nowrap' }}>
                  <CalendarOutlined style={{ color: '#666' }} />
                  <Text style={{ whiteSpace: 'nowrap', fontSize: '1.125rem' }}>{formatDate(dataset?.created_at)}</Text>
                </Space>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '1.125rem' }}>Assigned User:</Text>
                <br />
                <Space style={{ whiteSpace: 'nowrap' }}>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text style={{ whiteSpace: 'nowrap', fontSize: '1.125rem' }}>Current User</Text>
                </Space>
              </div>
            </Space>
          </Card>

          {/* Timeline/Progress Section */}
          <Card
            size="small"
            style={{ marginBottom: '1.5rem' }}
            title={
              <Space>
                <TagOutlined style={{ color: '#52c41a' }} />
                <Text strong style={{ fontSize: '1.25rem' }}>Progress Timeline</Text>
              </Space>
            }
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '1.125rem' }}>Total Images:</Text>
                <br />
                <Text strong style={{ fontSize: '1.375rem' }}>{totalImagesCount}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '1.125rem' }}>Completion:</Text>
                <br />
                <Progress
                  percent={progressPercentage}
                  size="small"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
                <Text style={{ fontSize: '1.125rem', color: '#666' }}>
                  {labeledImages} of {totalImagesCount} images annotated
                </Text>
              </div>
            </Space>
          </Card>

          {/* Instructions Section */}
          <Card
            size="small"
            title={
              <Space>
                <EditOutlined style={{ color: '#722ed1' }} />
                <Text strong style={{ fontSize: '1.25rem' }}>Annotation Instructions</Text>
              </Space>
            }
            extra={
              !editingInstructions ? (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleEditInstructions}
                  style={{ fontSize: '1rem' }}
                >
                  Edit
                </Button>
              ) : (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<SaveOutlined />}
                    onClick={handleSaveInstructions}
                    style={{ fontSize: '1rem' }}
                  >
                    Save
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleCancelEdit}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    Cancel
                  </Button>
                </Space>
              )
            }
          >
            {editingInstructions ? (
              <TextArea
                value={tempInstructions}
                onChange={(e) => setTempInstructions(e.target.value)}
                placeholder="Enter annotation instructions..."
                rows={4}
                style={{ resize: 'none' }}
              />
            ) : (
              <Paragraph
                style={{
                  margin: 0,
                  minHeight: '3.75rem',
                  color: instructions.includes('Click edit') ? '#999' : '#333',
                  fontSize: '0.875rem'
                }}
              >
                {instructions}
              </Paragraph>
            )}
          </Card>
        </div>
      </Sider>

      {/* Main Content */}
      <Content style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ flex: '1 1 15rem', minWidth: 0 }}>
            <Title level={4} style={{
              margin: 0,
              marginBottom: '0.25rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '1.5rem'
            }}>
              🎯 Annotation Progress
            </Title>
            <Text type="secondary" style={{ fontSize: '1.125rem', display: 'block' }}>
              Track your annotation progress and manage image labeling
            </Text>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            {/* Add Images Button - Show when all images are annotated */}
            {dataset && dataset.labeled_images === dataset.total_images && dataset.total_images > 0 && (
              <Button
                type="primary"
                size="middle"
                icon={<PlusOutlined />}
                onClick={() => {
                  logUserClick('AnnotateProgress', 'open_split_drawer', {
                    datasetId,
                    timestamp: new Date().toISOString()
                  });
                  logInfo('app.frontend.ui', 'split_drawer_opened', 'Dataset split drawer opened', {
                    datasetId,
                    timestamp: new Date().toISOString()
                  });
                  setSplitDrawerVisible(true);
                }}
                style={{
                  background: '#52c41a',
                  borderColor: '#52c41a',
                  boxShadow: '0 0.25rem 0.5rem rgba(82, 196, 26, 0.2)',
                  whiteSpace: 'nowrap',
                  height: '2.25rem',
                  fontSize: '0.875rem'
                }}
              >
                Add Images to Dataset
              </Button>
            )}
          </div>
        </div>

        <Card
          style={{ marginBottom: '1.5rem' }}
          bodyStyle={{ padding: '1rem 1.5rem' }}
        >
          <Row gutter={[24, 16]} align="middle">
            <Col span={16}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: '1.125rem' }}>
                  Overall Progress: {labeledImages} / {totalImagesCount} annotated
                </Text>
                <Progress
                  percent={progressPercentage}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                  style={{ marginBottom: 0 }}
                />
              </Space>
            </Col>
            <Col span={8} style={{ textAlign: 'right' }}>
              <Space size="large">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#52c41a' }}>
                    {labeledImages}
                  </div>
                  <div style={{ fontSize: '1.125rem', color: '#666' }}>Labeled</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#faad14' }}>
                    {totalImagesCount - labeledImages}
                  </div>
                  <div style={{ fontSize: '1.125rem', color: '#666' }}>Remaining</div>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Tabs and Image Grid */}
        <Card bodyStyle={{ padding: '1rem 1.5rem' }}>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              logUserClick('AnnotateProgress', 'tab_change', {
                datasetId,
                oldTab: activeTab,
                newTab: key,
                timestamp: new Date().toISOString()
              });
              logInfo('app.frontend.navigation', 'annotation_tab_changed', 'Annotation tab changed', {
                datasetId,
                oldTab: activeTab,
                newTab: key,
                timestamp: new Date().toISOString()
              });
              setActiveTab(key);
            }}
            items={tabItems}
            size="large"
          />

          <Divider style={{ margin: '1rem 0' }} />

          {/* Image Grid */}
          {imagesLoading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem' }}>
              <Spin size="large" />
              <div style={{ marginTop: '1rem', fontSize: '1.0625rem' }}>Loading images...</div>
            </div>
          ) : filteredImages.length === 0 ? (
            <Empty
              description={
                activeTab === 'all'
                  ? "No images found in this dataset"
                  : activeTab === 'labeled'
                    ? "No labeled images yet"
                    : "No unlabeled images remaining"
              }
              style={{ padding: '2.5rem' }}
            />
          ) : (
            <>
              <Row gutter={[24, 24]}>
                {filteredImages.map((image) => {
                  const status = getImageStatus(image);
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} xl={4} key={image.id}>
                      <Card
                        hoverable
                        style={{
                          borderRadius: '0.75rem',
                          overflow: 'hidden',
                          border: `0.125rem solid ${status.color}20`,
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        bodyStyle={{ padding: 0 }}
                        onClick={() => handleImageClick(image.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-0.25rem)';
                          e.currentTarget.style.boxShadow = `0 0.75rem 2rem ${status.color}30`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Image */}
                        <div style={{
                          height: '12.5rem',
                          background: '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}>
                          {image.url ? (
                            <img
                              src={image.thumbnail_url || image.url}
                              alt={image.filename}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div style={{
                            display: image.url ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#999'
                          }}>
                            <FileImageOutlined style={{ fontSize: '3rem' }} />
                          </div>

                          {/* Status Badge */}
                          <div style={{
                            position: 'absolute',
                            top: '0.75rem',
                            right: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.15)'
                          }}>
                            <Tag color={status.tag} style={{ margin: 0, border: 'none', fontWeight: 'bold' }}>
                              {status.text}
                            </Tag>
                          </div>
                        </div>

                        {/* Image Info */}
                        <div style={{ padding: '1rem' }}>
                          <Tooltip title={image.original_filename || image.filename}>
                            <Text
                              strong
                              style={{
                                fontSize: '1rem',
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginBottom: '0.25rem'
                              }}
                            >
                              {image.original_filename || image.filename}
                            </Text>
                          </Tooltip>
                          <Text
                            type="secondary"
                            style={{ fontSize: '1rem' }}
                          >
                            {image.width} × {image.height}
                          </Text>
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>

              {/* Pagination */}
              {totalFilteredImages > imagesPerPage && (
                <div style={{
                  textAlign: 'center',
                  marginTop: '2rem',
                  padding: '1.5rem',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <Space size="large">
                    <Button
                      disabled={currentPage === 1}
                      onClick={() => {
                        logUserClick('AnnotateProgress', 'pagination_change', {
                          datasetId,
                          oldPage: currentPage,
                          newPage: currentPage - 1,
                          activeTab,
                          timestamp: new Date().toISOString()
                        });
                        logInfo('app.frontend.navigation', 'annotation_page_changed', 'Annotation page changed', {
                          datasetId,
                          oldPage: currentPage,
                          newPage: currentPage - 1,
                          activeTab,
                          timestamp: new Date().toISOString()
                        });
                        setCurrentPage(currentPage - 1);
                      }}
                      size="large"
                    >
                      ← Previous
                    </Button>

                    <Text style={{ fontSize: '1rem' }}>
                      Page {currentPage} of {Math.ceil(totalFilteredImages / imagesPerPage)}
                    </Text>

                    <Button
                      disabled={currentPage >= Math.ceil(totalFilteredImages / imagesPerPage)}
                      onClick={() => {
                        logUserClick('AnnotateProgress', 'pagination_change', {
                          datasetId,
                          oldPage: currentPage,
                          newPage: currentPage + 1,
                          activeTab,
                          timestamp: new Date().toISOString()
                        });
                        logInfo('app.frontend.navigation', 'annotation_page_changed', 'Annotation page changed', {
                          datasetId,
                          oldPage: currentPage,
                          newPage: currentPage + 1,
                          activeTab,
                          timestamp: new Date().toISOString()
                        });
                        setCurrentPage(currentPage + 1);
                      }}
                      size="large"
                    >
                      Next →
                    </Button>
                  </Space>

                  <div style={{ marginTop: '0.5rem' }}>
                    <Text type="secondary" style={{ fontSize: '1rem' }}>
                      Showing {((currentPage - 1) * imagesPerPage) + 1} - {Math.min(currentPage * imagesPerPage, totalFilteredImages)} of {totalFilteredImages} images
                    </Text>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </Content>

      {/* Dataset Split Drawer */}
      <Drawer
        title={<span style={{ fontWeight: 700, fontSize: '1.5rem', color: '#111' }}>Add Images to Dataset Splits</span>}
        width={isMobile ? '100%' : '32rem'} // Senior Context Logic: Sidebar stays sidebar on tablets
        open={splitDrawerVisible}
        placement={isMobile ? 'bottom' : 'right'}
        height={isMobile ? '90%' : '100%'}
        bodyStyle={{
          padding: isMobile ? '1.5rem' : '2rem',
          background: '#fff'
        }}
        onClose={() => {
          logUserClick('AnnotateProgress', 'close_split_drawer', {
            datasetId,
            timestamp: new Date().toISOString()
          });
          logInfo('app.frontend.ui', 'split_drawer_closed', 'Dataset split drawer closed', {
            datasetId,
            timestamp: new Date().toISOString()
          });
          setSplitDrawerVisible(false);
        }}
        footer={
          <div style={{
            display: 'flex',
            flexFlow: isMobile ? 'column' : 'row wrap', // Natural wrap for senior flexibility
            gap: '1rem',
            justifyContent: 'flex-end',
            padding: '1.25rem 0',
            borderTop: '1px solid #f0f0f0'
          }}>
            <Button
              onClick={() => {
                logUserClick('AnnotateProgress', 'close_split_drawer', {
                  datasetId,
                  timestamp: new Date().toISOString()
                });
                logInfo('app.frontend.ui', 'split_drawer_closed', 'Dataset split drawer closed', {
                  datasetId,
                  timestamp: new Date().toISOString()
                });
                setSplitDrawerVisible(false);
              }}
              style={{
                height: '3.25rem',
                fontSize: '1rem',
                minWidth: isMobile ? '100%' : '8rem',
                borderRadius: '0.625rem',
                fontWeight: 500,
                order: isMobile ? 2 : 1
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={handleAssignImages}
              loading={assignLoading}
              style={{
                height: '3.25rem',
                fontSize: '1rem',
                padding: '0 2rem',
                minWidth: isMobile ? '100%' : '12rem',
                borderRadius: '0.625rem',
                order: isMobile ? 1 : 2,
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                border: 'none',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.2)'
              }}
            >
              Update & Go to Workspace
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: '2.5rem' }}>
          <Title level={4} style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Split Method</Title>
          <Select
            value={splitMethod}
            onChange={handleSplitMethodChange}
            style={{ width: '100%', fontSize: '1.125rem' }}
            size="large"
            className="vector-select"
            dropdownClassName="vector-select-dropdown"
            options={[
              {
                value: 'use_existing',
                label: <span style={{ fontSize: '1.0625rem' }}>USE EXISTING SPLIT</span>,
              },
              {
                value: 'assign_random',
                label: <span style={{ fontSize: '1.0625rem' }}>SPLIT IMAGES BETWEEN TRAIN/VALID/TEST</span>,
              },
              {
                value: 'all_train',
                label: <span style={{ fontSize: '1.0625rem' }}>ADD ALL IMAGES TO TRAIN SET</span>,
              },
              {
                value: 'all_val',
                label: <span style={{ fontSize: '1.0625rem' }}>ADD ALL IMAGES TO VALID SET</span>,
              },
              {
                value: 'all_test',
                label: <span style={{ fontSize: '1.0625rem' }}>ADD ALL IMAGES TO TEST SET</span>,
              }
            ]}
          />
          <div style={{ marginTop: '1rem', fontSize: '1.125rem', color: '#555', lineHeight: 1.6 }}>
            {splitMethod === 'use_existing' && 'Keep current split values in the database (for existing datasets)'}
            {splitMethod === 'assign_random' && 'Randomly assigns images to splits based on the percentages below'}
            {splitMethod === 'all_train' && 'Assigns all labeled images to the training set'}
            {splitMethod === 'all_val' && 'Assigns all labeled images to the validation set'}
            {splitMethod === 'all_test' && 'Assigns all labeled images to the test set'}
          </div>
        </div>

        {splitMethod === 'assign_random' && (
          <div style={{ marginBottom: '3rem' }}>
            <Title level={4} style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Dataset Distribution</Title>
            <Paragraph type="secondary" style={{ fontSize: '1.125rem', lineHeight: 1.6, marginBottom: '2.5rem', color: '#555' }}>
              Adjust the sliders to define split boundaries:
            </Paragraph>

            <div style={{ padding: '0 0.5rem', marginBottom: '3.5rem' }}>
              <Slider
                range
                min={0}
                max={100}
                value={splitPercentages}
                onChange={handleSliderChange}
                tooltip={{
                  formatter: value => `${value}%`,
                  open: true
                }}
                trackStyle={[{ background: '#1890ff' }, { background: '#722ed1' }]}
                handleStyle={[{ borderColor: '#1890ff' }, { borderColor: '#722ed1' }]}
              />
            </div>

            {/* Senior Distribution Display: Grid on mobile/tablet, Bar on desktop */}
            {(isMobile || isTablet) ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                marginBottom: '2rem'
              }}>
                <div style={{ background: 'rgba(24, 144, 255, 0.05)', padding: '1rem', borderRadius: '0.625rem', textAlign: 'center', border: '1px solid rgba(24, 144, 255, 0.1)' }}>
                  <div style={{ color: '#1890ff', fontWeight: 700, fontSize: '1.25rem' }}>{splitPercentages[0]}%</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#1890ff', marginTop: '0.25rem' }}>Train</div>
                </div>
                <div style={{ background: 'rgba(114, 46, 209, 0.05)', padding: '1rem', borderRadius: '0.625rem', textAlign: 'center', border: '1px solid rgba(114, 46, 209, 0.1)' }}>
                  <div style={{ color: '#722ed1', fontWeight: 700, fontSize: '1.25rem' }}>{splitPercentages[1] - splitPercentages[0]}%</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#722ed1', marginTop: '0.25rem' }}>Val</div>
                </div>
                <div style={{ background: 'rgba(82, 196, 26, 0.05)', padding: '1rem', borderRadius: '0.625rem', textAlign: 'center', border: '1px solid rgba(82, 196, 26, 0.1)' }}>
                  <div style={{ color: '#52c41a', fontWeight: 700, fontSize: '1.25rem' }}>{100 - splitPercentages[1]}%</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#52c41a', marginTop: '0.25rem' }}>Test</div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                marginTop: '-2.5rem',
                marginBottom: '2.5rem'
              }}>
                <div style={{
                  width: `${splitPercentages[0]}%`,
                  textAlign: 'center',
                  paddingRight: '0.25rem',
                  minWidth: '4.5rem'
                }}>
                  <Tag color="blue" style={{ marginRight: 0, fontSize: '0.9375rem', padding: '0.25rem 0.75rem' }}>Train: {splitPercentages[0]}%</Tag>
                </div>
                <div style={{
                  width: `${splitPercentages[1] - splitPercentages[0]}%`,
                  textAlign: 'center',
                  minWidth: '6rem'
                }}>
                  <Tag color="orange" style={{ marginRight: 0, fontSize: '0.9375rem', padding: '0.25rem 0.75rem' }}>Val: {splitPercentages[1] - splitPercentages[0]}%</Tag>
                </div>
                <div style={{
                  width: `${100 - splitPercentages[1]}%`,
                  textAlign: 'center',
                  paddingLeft: '0.25rem',
                  minWidth: '4.5rem'
                }}>
                  <Tag color="green" style={{ marginRight: 0, fontSize: '0.9375rem', padding: '0.25rem 0.75rem' }}>Test: {100 - splitPercentages[1]}%</Tag>
                </div>
              </div>
            )}

            {/* Distribution Statistics */}
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Train"
                  value={splitPercentages[0]}
                  suffix="%"
                  valueStyle={{ color: '#1890ff' }}
                  precision={0}
                />
                <Text type="secondary">{trainCount} images</Text>
              </Col>
              <Col span={8}>
                <Statistic
                  title="Validation"
                  value={splitPercentages[1] - splitPercentages[0]}
                  suffix="%"
                  valueStyle={{ color: '#722ed1' }}
                  precision={0}
                />
                <Text type="secondary">{valCount} images</Text>
              </Col>
              <Col span={8}>
                <Statistic
                  title="Test"
                  value={100 - splitPercentages[1]}
                  suffix="%"
                  valueStyle={{ color: '#52c41a' }}
                  precision={0}
                />
                <Text type="secondary">{testCount} images</Text>
              </Col>
            </Row>
          </div>
        )}

        {/* Show appropriate message for other split methods */}
        {splitMethod === 'use_existing' && (
          <div style={{ marginBottom: '2rem' }}>
            <Title level={4} style={{ fontSize: '1.125rem' }}>Using Existing Split</Title>
            <Paragraph style={{ fontSize: '1.0625rem', lineHeight: 1.6 }}>
              This option will keep the current train/val/test assignments for all labeled images.
            </Paragraph>
          </div>
        )}

        {splitMethod === 'all_train' && (
          <div style={{ marginBottom: '2rem' }}>
            <Title level={4} style={{ fontSize: '1.125rem' }}>All Images to Training Set</Title>
            <Paragraph style={{ fontSize: '1.0625rem', lineHeight: 1.6 }}>
              This option will assign all {totalLabeledImages} labeled images to the training set.
            </Paragraph>
          </div>
        )}

        {splitMethod === 'all_val' && (
          <div style={{ marginBottom: '2rem' }}>
            <Title level={4} style={{ fontSize: '1.125rem' }}>All Images to Validation Set</Title>
            <Paragraph style={{ fontSize: '1.0625rem', lineHeight: 1.6 }}>
              This option will assign all {totalLabeledImages} labeled images to the validation set.
            </Paragraph>
          </div>
        )}

        {splitMethod === 'all_test' && (
          <div style={{ marginBottom: '2rem' }}>
            <Title level={4} style={{ fontSize: '1.125rem' }}>All Images to Test Set</Title>
            <Paragraph style={{ fontSize: '1.0625rem', lineHeight: 1.6 }}>
              This option will assign all {totalLabeledImages} labeled images to the test set.
            </Paragraph>
          </div>
        )}

        <Divider />

        <Paragraph style={{ fontSize: '1.125rem', lineHeight: 1.7, paddingBottom: isMobile ? '3rem' : '2rem' }}>
          <Text strong style={{ fontSize: '1.125rem' }}>Note:</Text> {
            splitMethod === 'assign_random'
              ? "This will assign all labeled images to the dataset splits according to the percentages you've set."
              : splitMethod === 'use_existing'
                ? "This will keep the current train/val/test assignments for all labeled images."
                : `This will assign all labeled images to the ${splitMethod === 'all_train' ? 'training' :
                  splitMethod === 'all_val' ? 'validation' : 'test'
                } set.`
          } Unlabeled images will be ignored.
        </Paragraph>
      </Drawer>
    </Layout>
  );
};

export default AnnotateProgress;
