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

  // Load dataset information
  useEffect(() => {
    const loadDataset = async () => {
      if (!datasetId) {
        message.error('Dataset ID is required');
        navigate('/projects');
        return;
      }

      setLoading(true);
      try {
        const response = await datasetsAPI.getDataset(datasetId);
        setDataset(response);
        setInstructions(response.description || 'Click edit to add annotation instructions...');
        setTempInstructions(response.description || '');
      } catch (error) {
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
      try {
        // Load more images to handle filtering on client side
        const response = await datasetsAPI.getDatasetImages(datasetId, 0, 1000);
        setImages(response.images || []);

      } catch (error) {
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
  }, [activeTab]);

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
    navigate(`/annotate/${datasetId}/manual?imageId=${imageId}`);
  };
  
  // Handle split method change
  const handleSplitMethodChange = (value) => {
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
    setAssignLoading(true);
    
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
      
      message.success(response.message || 'Images assigned successfully');
      
      // Move dataset to completed section
      await projectsAPI.moveDatasetToCompleted(dataset.project_id, datasetId);
      
      // Navigate to main project workspace
      navigate(`/projects/${dataset.project_id}/workspace`);
      
    } catch (error) {
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
    setEditingInstructions(true);
    setTempInstructions(instructions);
  };

  const handleSaveInstructions = async () => {
    try {
      await datasetsAPI.updateDataset(datasetId, { description: tempInstructions });
      setInstructions(tempInstructions);
      setEditingInstructions(false);
      message.success('Instructions updated successfully');
    } catch (error) {
      console.error('Error updating instructions:', error);
      message.error('Failed to update instructions');
    }
  };

  const handleCancelEdit = () => {
    setEditingInstructions(false);
    setTempInstructions(instructions);
  };

  const handleGoBack = () => {
    // Navigate back to the annotate launcher instead of browser history
    navigate(`/annotate-launcher/${datasetId}`);
  };

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
      label: `All Images (${totalImagesCount})`,
      children: null
    },
    {
      key: 'labeled',
      label: `Annotated (${labeledImages})`,
      children: null
    },
    {
      key: 'unlabeled',
      label: `Unannotated (${totalImagesCount - labeledImages})`,
      children: null
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Left Sidebar */}
      <Sider 
        width={320} 
        style={{ 
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          zIndex: 1
        }}
      >
        <div style={{ padding: '24px' }}>
          {/* Back Button */}
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleGoBack}
            style={{ marginBottom: 24 }}
            type="text"
          >
            Back to Launcher
          </Button>

          {/* Dataset Metadata */}
          <Card 
            size="small" 
            style={{ marginBottom: 24 }}
            title={
              <Space>
                <FileImageOutlined style={{ color: '#1890ff' }} />
                <Text strong>Dataset Info</Text>
              </Space>
            }
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Name:</Text>
                <br />
                <Text strong>{dataset?.name}</Text>
              </div>
              <div>
                <Text type="secondary">Created:</Text>
                <br />
                <Space>
                  <CalendarOutlined style={{ color: '#666' }} />
                  <Text>{formatDate(dataset?.created_at)}</Text>
                </Space>
              </div>
              <div>
                <Text type="secondary">Assigned User:</Text>
                <br />
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text>Current User</Text>
                </Space>
              </div>
            </Space>
          </Card>

          {/* Timeline/Progress Section */}
          <Card 
            size="small" 
            style={{ marginBottom: 24 }}
            title={
              <Space>
                <TagOutlined style={{ color: '#52c41a' }} />
                <Text strong>Progress Timeline</Text>
              </Space>
            }
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Total Images:</Text>
                <br />
                <Text strong style={{ fontSize: '18px' }}>{totalImagesCount}</Text>
              </div>
              <div>
                <Text type="secondary">Completion:</Text>
                <br />
                <Progress 
                  percent={progressPercentage} 
                  size="small"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
                <Text style={{ fontSize: '12px', color: '#666' }}>
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
                <Text strong>Annotation Instructions</Text>
              </Space>
            }
            extra={
              !editingInstructions ? (
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EditOutlined />}
                  onClick={handleEditInstructions}
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
                  >
                    Save
                  </Button>
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<CloseOutlined />}
                    onClick={handleCancelEdit}
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
                  minHeight: '60px',
                  color: instructions.includes('Click edit') ? '#999' : '#333'
                }}
              >
                {instructions}
              </Paragraph>
            )}
          </Card>
        </div>
      </Sider>

      {/* Main Content */}
      <Content style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              🎯 Annotation Progress
            </Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              Track your annotation progress and manage image labeling
            </Text>
          </div>
          
          {/* Add Images Button - Show when all images are annotated */}
          {dataset && dataset.labeled_images === dataset.total_images && dataset.total_images > 0 && (
            <Button 
              type="primary" 
              size="large"
              icon={<PlusOutlined />}
              onClick={() => setSplitDrawerVisible(true)}
              style={{
                background: '#52c41a',
                borderColor: '#52c41a',
                boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)'
              }}
            >
              Add Images to Dataset
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]} align="middle">
            <Col span={16}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: '16px' }}>
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
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                    {labeledImages}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Labeled</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                    {totalImagesCount - labeledImages}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Remaining</div>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Tabs and Image Grid */}
        <Card>
          <Tabs 
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
          />
          
          <Divider style={{ margin: '16px 0' }} />

          {/* Image Grid */}
          {imagesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Loading images...</div>
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
              style={{ padding: '40px' }}
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
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: `2px solid ${status.color}20`,
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        bodyStyle={{ padding: 0 }}
                        onClick={() => handleImageClick(image.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = `0 12px 32px ${status.color}30`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Image */}
                        <div style={{ 
                          height: 200, 
                          background: '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}>
                          {image.url ? (
                            <img 
                              src={image.url} 
                              alt={image.filename}
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
                            <FileImageOutlined style={{ fontSize: '48px' }} />
                          </div>
                          
                          {/* Status Badge */}
                          <div style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            background: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: 8,
                            padding: '4px 8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}>
                            <Tag color={status.tag} style={{ margin: 0, border: 'none', fontWeight: 'bold' }}>
                              {status.text}
                            </Tag>
                          </div>
                        </div>

                        {/* Image Info */}
                        <div style={{ padding: '16px' }}>
                          <Tooltip title={image.original_filename || image.filename}>
                            <Text 
                              strong 
                              style={{ 
                                fontSize: '14px',
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginBottom: '4px'
                              }}
                            >
                              {image.original_filename || image.filename}
                            </Text>
                          </Tooltip>
                          <Text 
                            type="secondary" 
                            style={{ fontSize: '12px' }}
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
                  marginTop: '32px',
                  padding: '24px',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <Space size="large">
                    <Button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      size="large"
                    >
                      ← Previous
                    </Button>
                    
                    <Text style={{ fontSize: '16px' }}>
                      Page {currentPage} of {Math.ceil(totalFilteredImages / imagesPerPage)}
                    </Text>
                    
                    <Button 
                      disabled={currentPage >= Math.ceil(totalFilteredImages / imagesPerPage)}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      size="large"
                    >
                      Next →
                    </Button>
                  </Space>
                  
                  <div style={{ marginTop: '8px' }}>
                    <Text type="secondary">
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
        title="Add Images to Dataset Splits"
        width={520}
        open={splitDrawerVisible}
        onClose={() => setSplitDrawerVisible(false)}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button 
              onClick={() => setSplitDrawerVisible(false)} 
              style={{ marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleAssignImages}
              loading={assignLoading}
            >
              Update & Go to Workspace
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>Split Method</Title>
          <Select
            value={splitMethod}
            onChange={handleSplitMethodChange}
            style={{ width: '100%', marginTop: 8 }}
            size="large"
            options={[
              {
                value: 'use_existing',
                label: 'USE EXISTING SPLIT',
              },
              {
                value: 'assign_random',
                label: 'SPLIT IMAGES BETWEEN TRAIN/VALID/TEST',
              },
              {
                value: 'all_train',
                label: 'ADD ALL IMAGES TO TRAIN SET',
              },
              {
                value: 'all_val',
                label: 'ADD ALL IMAGES TO VALID SET',
              },
              {
                value: 'all_test',
                label: 'ADD ALL IMAGES TO TEST SET',
              }
            ]}
          />
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            {splitMethod === 'use_existing' && 'Keep current split values in the database (for existing datasets)'}
            {splitMethod === 'assign_random' && 'Randomly assigns images to splits based on the percentages below'}
            {splitMethod === 'all_train' && 'Assigns all labeled images to the training set'}
            {splitMethod === 'all_val' && 'Assigns all labeled images to the validation set'}
            {splitMethod === 'all_test' && 'Assigns all labeled images to the test set'}
          </div>
        </div>

        {/* Only show distribution controls for SPLIT IMAGES BETWEEN TRAIN/VALID/TEST option */}
        {splitMethod === 'assign_random' && (
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>Dataset Distribution</Title>
            <Paragraph type="secondary">
              Drag the sliders to adjust the dataset split:
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li>First slider: End of training set</li>
                <li>Second slider: End of validation set</li>
                <li>Remaining percentage goes to test set</li>
              </ul>
            </Paragraph>
            
            <div style={{ marginTop: 24, marginBottom: 48 }}>
              <Slider
                range
                min={0}
                max={100}
                value={[trainEndPoint, valEndPoint]}
                onChange={handleSliderChange}
                marks={{
                  0: '0%',
                  25: '25%',
                  50: '50%',
                  75: '75%',
                  100: '100%'
                }}
                tooltip={{
                  formatter: (value, index) => {
                    if (index === 0) {
                      return `Train: ${splitPercentages[0]}%`;
                    } else {
                      return `Val: ${splitPercentages[1]}%`;
                    }
                  }
                }}
              />
              
              {/* Distribution Markers */}
              <div style={{ 
                display: 'flex', 
                marginTop: -36,
                marginBottom: 24
              }}>
                <div style={{ 
                  width: `${splitPercentages[0]}%`, 
                  textAlign: 'center',
                  paddingRight: 4,
                  minWidth: '60px'
                }}>
                  <Tag color="blue" style={{ marginRight: 0 }}>Train</Tag>
                </div>
                <div style={{ 
                  width: `${splitPercentages[1]}%`, 
                  textAlign: 'center',
                  minWidth: '80px'
                }}>
                  <Tag color="orange" style={{ marginRight: 0 }}>Val</Tag>
                </div>
                <div style={{ 
                  width: `${testPercentage}%`, 
                  textAlign: 'center',
                  paddingLeft: 4,
                  minWidth: '60px'
                }}>
                  <Tag color="green" style={{ marginRight: 0 }}>Test</Tag>
                </div>
              </div>
            </div>
            
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
                  value={splitPercentages[1]}
                  suffix="%"
                  valueStyle={{ color: '#fa8c16' }}
                  precision={0}
                />
                <Text type="secondary">{valCount} images</Text>
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Test"
                  value={testPercentage}
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
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>Using Existing Split</Title>
            <Paragraph>
              This option will keep the current train/val/test assignments for all labeled images.
            </Paragraph>
          </div>
        )}
        
        {splitMethod === 'all_train' && (
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>All Images to Training Set</Title>
            <Paragraph>
              This option will assign all {totalLabeledImages} labeled images to the training set.
            </Paragraph>
          </div>
        )}
        
        {splitMethod === 'all_val' && (
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>All Images to Validation Set</Title>
            <Paragraph>
              This option will assign all {totalLabeledImages} labeled images to the validation set.
            </Paragraph>
          </div>
        )}
        
        {splitMethod === 'all_test' && (
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>All Images to Test Set</Title>
            <Paragraph>
              This option will assign all {totalLabeledImages} labeled images to the test set.
            </Paragraph>
          </div>
        )}
        
        <Divider />
        
        <Paragraph>
          <Text strong>Note:</Text> {
            splitMethod === 'assign_random'
              ? "This will assign all labeled images to the dataset splits according to the percentages you've set."
              : splitMethod === 'use_existing'
                ? "This will keep the current train/val/test assignments for all labeled images."
                : `This will assign all labeled images to the ${
                    splitMethod === 'all_train' ? 'training' : 
                    splitMethod === 'all_val' ? 'validation' : 'test'
                  } set.`
          } Unlabeled images will be ignored.
        </Paragraph>
      </Drawer>
    </Layout>
  );
};

export default AnnotateProgress;