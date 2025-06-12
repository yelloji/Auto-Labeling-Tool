import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Tag,
  Progress,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Checkbox,
  Badge,
  Tooltip,
  Dropdown,
  Menu,
  Alert,
  Statistic,
  Typography,
  Divider,
  Image,
  Spin
} from 'antd';
import {
  SplitCellsOutlined,
  FilterOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PictureOutlined,
  TagsOutlined,
  MoreOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const DatasetManagement = ({ datasetId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [splitConfig, setSplitConfig] = useState(null);
  const [datasetSummary, setDatasetSummary] = useState(null);
  
  // Modal states
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [imageDetailVisible, setImageDetailVisible] = useState(false);
  const [selectedImageDetail, setSelectedImageDetail] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    split_type: null,
    is_labeled: null,
    is_verified: null,
    class_names: [],
    filename_pattern: ''
  });

  const [form] = Form.useForm();

  useEffect(() => {
    if (datasetId) {
      loadDatasetData();
    }
  }, [datasetId]);

  const loadDatasetData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadImages(),
        loadSplitConfig(),
        loadDatasetSummary()
      ]);
    } catch (error) {
      console.error('Error loading dataset data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dataset-management/filter-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          ...filters,
          limit: 1000
        })
      });
      const data = await response.json();
      setImages(data.images);
      setFilteredImages(data.images);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  const loadSplitConfig = async () => {
    try {
      // Call the correct API endpoint to get split configuration
      const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/split-stats`);
      
      if (response.ok) {
        const data = await response.json();
        setSplitConfig(data);
        console.log("Loaded split config successfully:", data);
      } else {
        console.error("Failed to load split config, status:", response.status);
      }
    } catch (error) {
      console.error('Error loading split config:', error);
    }
  };

  const loadDatasetSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dataset-management/dataset-summary/${datasetId}`);
      const data = await response.json();
      setDatasetSummary(data);
    } catch (error) {
      console.error('Error loading dataset summary:', error);
    }
  };

  const handleCreateSplit = async (values) => {
    try {
      // Debug: Log the values received from the form
      console.log('Form submitted with values:', values);
      
      // Map frontend split_method to backend method format
      let method;
      if (values.split_method === 'random') {
        method = 'assign_random';
      } else if (values.split_method === 'stratified') {
        method = 'assign_random'; // Backend also uses assign_random for stratified
      } else if (values.split_method === 'manual') {
        method = 'assign_sequential';
      } else {
        method = values.split_method;
      }
      
      // Ensure percentages are valid numbers and add up to 100%
      let trainPercent = parseInt(values.train_percentage) || 0;
      let valPercent = parseInt(values.val_percentage) || 0;
      let testPercent = parseInt(values.test_percentage) || 0;
      
      // Check if percentages add up to 100
      const totalPercent = trainPercent + valPercent + testPercent;
      if (totalPercent !== 100) {
        console.warn(`Percentages don't add up to 100%: ${totalPercent}%`);
        // Adjust to make sure they add up to 100%
        // We'll adjust the test percentage to make it work
        testPercent = 100 - trainPercent - valPercent;
        console.log(`Adjusting test percentage from ${values.test_percentage} to ${testPercent}`);
      }
      
      // Create the request body - convert percentage field names to percent as expected by API
      const requestBody = {
        method: method,
        train_percent: trainPercent,
        val_percent: valPercent,
        test_percent: testPercent
      };
      
      // Log the request for debugging
      console.log('Split request:', {
        url: `${API_BASE_URL}/api/v1/datasets/${datasetId}/splits`,
        method: 'POST',
        body: requestBody
      });
      
      // Force using the correct backend API URL
      const apiUrl = `http://localhost:12000/api/v1/datasets/${datasetId}/splits`;
      console.log('Using hardcoded API URL:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const responseText = await response.text();
      console.log('Split response status:', response.status, response.statusText);
      console.log('Split response text:', responseText);
      
      if (response.ok) {
        setSplitModalVisible(false);
        
        // Force a complete reload of all data with a slight delay
        // to ensure the backend has time to process the changes
        setTimeout(() => {
          console.log("Reloading dataset data after split creation");
          loadSplitConfig();
          loadImages();
          loadDatasetSummary();
        }, 500);
        
        Modal.success({
          title: 'Split Created',
          content: 'Dataset split has been created successfully.'
        });
      } else {
        // Show error message
        Modal.error({
          title: 'Error Creating Split',
          content: `Failed to create split: ${responseText}`
        });
      }
    } catch (error) {
      console.error('Error creating split:', error);
    }
  };

  const handleBulkAssign = async (splitType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dataset-management/assign-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_ids: selectedImages,
          split_type: splitType
        })
      });
      
      if (response.ok) {
        setSelectedImages([]);
        loadImages();
        Modal.success({
          title: 'Images Assigned',
          content: `Successfully assigned ${selectedImages.length} images to ${splitType} split.`
        });
      }
    } catch (error) {
      console.error('Error assigning images:', error);
    }
  };

  const handleMoveImages = async (targetLocation) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dataset-management/move-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedImages)
      });
      
      if (response.ok) {
        setSelectedImages([]);
        setMoveModalVisible(false);
        loadImages();
        Modal.success({
          title: 'Images Moved',
          content: `Successfully moved ${selectedImages.length} images to ${targetLocation}.`
        });
      }
    } catch (error) {
      console.error('Error moving images:', error);
    }
  };

  const handleFilter = async (filterValues) => {
    setFilters(filterValues);
    setFilterModalVisible(false);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/dataset-management/filter-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          ...filterValues,
          limit: 1000
        })
      });
      const data = await response.json();
      setFilteredImages(data.images);
    } catch (error) {
      console.error('Error filtering images:', error);
    }
  };

  const showImageDetail = async (imageId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dataset-management/image-details/${imageId}`);
      const data = await response.json();
      setSelectedImageDetail(data);
      setImageDetailVisible(true);
    } catch (error) {
      console.error('Error loading image details:', error);
    }
  };

  const getSplitColor = (splitType) => {
    const colors = {
      unassigned: 'default',
      annotating: 'processing',
      dataset: 'success',
      reserved: 'purple'
    };
    return colors[splitType] || 'default';
  };
  
  const getDatasetSplitColor = (splitSection) => {
    const colors = {
      train: 'blue',
      val: 'orange',
      test: 'green'
    };
    return colors[splitSection] || 'default';
  };

  const getStatusIcon = (image) => {
    if (image.is_verified) return <CheckCircleOutlined style={{ color: 'green' }} />;
    if (image.is_labeled) return <CheckCircleOutlined style={{ color: 'orange' }} />;
    return <ExclamationCircleOutlined style={{ color: 'red' }} />;
  };

  const columns = [
    {
      title: 'Select',
      key: 'select',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedImages.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedImages([...selectedImages, record.id]);
            } else {
              setSelectedImages(selectedImages.filter(id => id !== record.id));
            }
          }}
        />
      )
    },
    {
      title: 'Image',
      dataIndex: 'filename',
      key: 'filename',
      width: 200,
      render: (filename, record) => (
        <Space>
          <PictureOutlined />
          <div>
            <div style={{ fontWeight: 'bold' }}>{filename}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.width || 0}x{record.height || 0} • {record.file_size ? (record.file_size / 1024).toFixed(1) : 0}KB
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <div>
            {getStatusIcon(record)}
            <Text style={{ marginLeft: 4 }}>
              {record.is_verified ? 'Verified' : record.is_labeled ? 'Labeled' : 'Unlabeled'}
            </Text>
          </div>
          {record.is_auto_labeled && <Tag size="small" color="cyan">Auto</Tag>}
        </Space>
      )
    },
    {
      title: 'Workflow',
      dataIndex: 'split_type',
      key: 'split_type',
      width: 100,
      render: (splitType) => (
        <Tag color={getSplitColor(splitType)}>
          {splitType ? splitType.toUpperCase() : 'UNKNOWN'}
        </Tag>
      )
    },
    {
      title: 'Dataset Split',
      dataIndex: 'split_section',
      key: 'split_section',
      width: 100,
      render: (splitSection) => (
        <Tag color={getDatasetSplitColor(splitSection)}>
          {splitSection ? splitSection.toUpperCase() : 'NOT ASSIGNED'}
        </Tag>
      )
    },
    {
      title: 'Annotations',
      dataIndex: 'annotation_count',
      key: 'annotation_count',
      width: 120,
      render: (count, record) => (
        <Space direction="vertical" size="small">
          <Badge count={count} style={{ backgroundColor: count > 0 ? '#52c41a' : '#f5222d' }} />
          {record.class_names && Array.isArray(record.class_names) && record.class_names.length > 0 && (
            <div>
              {record.class_names.slice(0, 2).map(className => (
                <Tag key={className} size="small">{className}</Tag>
              ))}
              {record.class_names.length > 2 && (
                <Tag size="small">+{record.class_names.length - 2}</Tag>
              )}
            </div>
          )}
        </Space>
      )
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              icon={<EyeOutlined />} 
              size="small" 
              onClick={() => showImageDetail(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit Labels">
            <Button icon={<EditOutlined />} size="small" />
          </Tooltip>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item key="train" onClick={() => handleBulkAssign('train')}>
                  Move to Train
                </Menu.Item>
                <Menu.Item key="val" onClick={() => handleBulkAssign('val')}>
                  Move to Val
                </Menu.Item>
                <Menu.Item key="test" onClick={() => handleBulkAssign('test')}>
                  Move to Test
                </Menu.Item>
                <Menu.Item key="reserved" onClick={() => handleBulkAssign('reserved')}>
                  Move to Reserved
                </Menu.Item>
                <Menu.Item key="unassigned" onClick={() => handleBulkAssign('unassigned')}>
                  Move to Unassigned
                </Menu.Item>
              </Menu>
            }
          >
            <Button icon={<MoreOutlined />} size="small" />
          </Dropdown>
        </Space>
      )
    }
  ];

  const renderSplitSummary = () => {
    if (!splitConfig) return null;

    return (
      <Card title="Dataset Split Summary" size="small">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Train"
              value={splitConfig.train || 0}
              suffix={`(${splitConfig.train_percent || 0}%)`}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Validation"
              value={splitConfig.val || 0}
              suffix={`(${splitConfig.val_percent || 0}%)`}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Test"
              value={splitConfig.test || 0}
              suffix={`(${splitConfig.test_percent || 0}%)`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total"
              value={splitConfig.total_images || 0}
              prefix={<TagsOutlined />}
            />
          </Col>
        </Row>
      </Card>
    );
  };

  const renderDatasetStats = () => {
    if (!datasetSummary) return null;

    return (
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Images"
              value={datasetSummary.total_images}
              prefix={<PictureOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Labeled"
              value={datasetSummary.labeled_images}
              suffix={`/ ${datasetSummary.total_images}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress 
              percent={datasetSummary.labeling_progress} 
              size="small" 
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Classes"
              value={datasetSummary.class_distribution ? Object.keys(datasetSummary.class_distribution).length : 0}
              prefix={<TagsOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Size"
              value={datasetSummary.total_size_bytes ? (datasetSummary.total_size_bytes / (1024 * 1024)).toFixed(1) : 0}
              suffix="MB"
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  if (loading || !images || !datasetSummary) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading dataset...</div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3}>Dataset Management</Title>
        <Button onClick={onClose}>Close</Button>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Dataset Statistics */}
        {renderDatasetStats()}

        {/* Split Summary */}
        {renderSplitSummary()}

        {/* Action Bar */}
        <Card size="small">
          <Space wrap>
            <Button 
              icon={<SplitCellsOutlined />} 
              onClick={() => setSplitModalVisible(true)}
            >
              Configure Split
            </Button>
            <Button 
              icon={<FilterOutlined />} 
              onClick={() => setFilterModalVisible(true)}
            >
              Filter Images
            </Button>
            <Button 
              icon={<FolderOutlined />} 
              disabled={selectedImages.length === 0}
              onClick={() => setMoveModalVisible(true)}
            >
              Move Selected ({selectedImages.length})
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadDatasetData}
            >
              Refresh
            </Button>
          </Space>

          {selectedImages.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Alert
                message={`${selectedImages.length} images selected`}
                type="info"
                action={
                  <Space>
                    <Button size="small" onClick={() => handleBulkAssign('train')}>
                      → Train
                    </Button>
                    <Button size="small" onClick={() => handleBulkAssign('val')}>
                      → Val
                    </Button>
                    <Button size="small" onClick={() => handleBulkAssign('test')}>
                      → Test
                    </Button>
                    <Button size="small" onClick={() => handleBulkAssign('unassigned')}>
                      → Unassigned
                    </Button>
                    <Button size="small" onClick={() => setSelectedImages([])}>
                      Clear
                    </Button>
                  </Space>
                }
              />
            </div>
          )}
        </Card>

        {/* Images Table */}
        <Card title={`Images (${filteredImages.length})`} size="small">
          <Table
            dataSource={filteredImages}
            columns={columns}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} images`
            }}
            scroll={{ x: 1000 }}
            size="small"
          />
        </Card>
      </Space>

      {/* Split Configuration Modal */}
      <Modal
        title="Configure Dataset Split"
        visible={splitModalVisible}
        onCancel={() => setSplitModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSplit}
          initialValues={{
            train_percentage: 70,
            val_percentage: 20,
            test_percentage: 10,
            split_method: 'random',
            stratify_by_class: true,
            random_seed: 42
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="train_percentage" label="Train %">
                <InputNumber min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="val_percentage" label="Validation %">
                <InputNumber min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="test_percentage" label="Test %">
                <InputNumber min={0} max={100} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="split_method" label="Split Method">
            <Select>
              <Option value="random">Random</Option>
              <Option value="stratified">Stratified (by class)</Option>
              <Option value="manual">Manual</Option>
            </Select>
          </Form.Item>

          <Form.Item name="stratify_by_class" label="Stratify by Class" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="random_seed" label="Random Seed">
            <InputNumber />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setSplitModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create Split</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Filter Modal */}
      <Modal
        title="Filter Images"
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          layout="vertical"
          onFinish={handleFilter}
          initialValues={filters}
        >
          <Form.Item name="split_type" label="Workflow">
            <Select allowClear placeholder="All splits">
              <Option value="train">Train</Option>
              <Option value="val">Validation</Option>
              <Option value="test">Test</Option>
              <Option value="unassigned">Unassigned</Option>
              <Option value="reserved">Reserved</Option>
            </Select>
          </Form.Item>

          <Form.Item name="is_labeled" label="Labeling Status">
            <Select allowClear placeholder="All statuses">
              <Option value={true}>Labeled</Option>
              <Option value={false}>Unlabeled</Option>
            </Select>
          </Form.Item>

          <Form.Item name="is_verified" label="Verification Status">
            <Select allowClear placeholder="All statuses">
              <Option value={true}>Verified</Option>
              <Option value={false}>Not Verified</Option>
            </Select>
          </Form.Item>

          <Form.Item name="filename_pattern" label="Filename Pattern">
            <Input placeholder="Search in filename..." />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setFilterModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Apply Filter</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Image Detail Modal */}
      <Modal
        title="Image Details"
        visible={imageDetailVisible}
        onCancel={() => setImageDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedImageDetail && (
          <Row gutter={16}>
            <Col span={12}>
              <Image
                src={selectedImageDetail.image && selectedImageDetail.image.file_path 
                  ? `${API_BASE_URL}${selectedImageDetail.image.file_path}` 
                  : ''}
                alt={selectedImageDetail.image ? selectedImageDetail.image.filename : ''}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Card size="small" title="Image Info">
                  {selectedImageDetail.image && (
                    <>
                      <p><strong>Filename:</strong> {selectedImageDetail.image.filename || 'N/A'}</p>
                      <p><strong>Size:</strong> {selectedImageDetail.image.width || 0}x{selectedImageDetail.image.height || 0}</p>
                      <p><strong>Format:</strong> {selectedImageDetail.image.format || 'N/A'}</p>
                      <p><strong>File Size:</strong> {selectedImageDetail.image.file_size ? (selectedImageDetail.image.file_size / 1024).toFixed(1) : 0}KB</p>
                      <p><strong>Workflow Stage:</strong> <Tag color={getSplitColor(selectedImageDetail.image.split_type)}>{selectedImageDetail.image.split_type || 'N/A'}</Tag></p>
                      <p><strong>Dataset Split:</strong> <Tag color={getDatasetSplitColor(selectedImageDetail.image.split_section)}>{selectedImageDetail.image.split_section || 'Not assigned'}</Tag></p>
                    </>
                  )}
                </Card>

                <Card size="small" title={`Annotations (${selectedImageDetail.annotations ? selectedImageDetail.annotations.length : 0})`}>
                  {selectedImageDetail.annotations && selectedImageDetail.annotations.map(ann => (
                    <div key={ann.id} style={{ marginBottom: 8 }}>
                      <Tag color="blue">{ann.class_name}</Tag>
                      <Text type="secondary">
                        Confidence: {(ann.confidence * 100).toFixed(1)}%
                        {ann.is_auto_generated && <Tag size="small" color="cyan">Auto</Tag>}
                        {ann.is_verified && <Tag size="small" color="green">Verified</Tag>}
                      </Text>
                    </div>
                  ))}
                  {(!selectedImageDetail.annotations || selectedImageDetail.annotations.length === 0) && (
                    <Text type="secondary">No annotations</Text>
                  )}
                </Card>
              </Space>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
};

export default DatasetManagement;