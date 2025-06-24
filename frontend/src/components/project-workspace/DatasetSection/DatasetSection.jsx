// src/components/project-workspace/DatasetSection.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Spin, 
  message, 
  Typography, 
  Input, 
  Select, 
  Row, 
  Col, 
  Button,
  Space,
  Pagination 
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined,
  FilterOutlined,
  ExportOutlined 
} from '@ant-design/icons';
import { projectsAPI } from '../../../services/api';
import './DatasetSection.css';

const { Title, Text } = Typography;
const { Option } = Select;

const DatasetSection = ({ projectId }) => {
  const [allImages, setAllImages] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSplitSection, setFilterSplitSection] = useState('all');
  const [filterDataset, setFilterDataset] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [pageSize] = useState(50); // Show 50 images per page for optimal performance
  const navigate = useNavigate();

  // Navigate to Release section
  const handleCreateRelease = () => {
    navigate(`/projects/${projectId}/workspace`, { 
      state: { selectedSection: 'versions', openCreateModal: true } 
    });
  };

  const fetchDatasetImages = async () => {
    setLoading(true);
    try {
      // Fetch all images with split_type=dataset filter (client-side pagination)
      const response = await projectsAPI.getProjectDatasetImages(projectId, 'dataset', 10000, 0);
      console.log('Dataset images response:', response);
      
      // Store all dataset images for client-side filtering and pagination
      const datasetImages = response.images || [];
      setAllImages(datasetImages);
      
      // Extract unique dataset names for filter dropdown
      const uniqueDatasets = [...new Set(datasetImages.map(img => img.dataset_name))].filter(Boolean);
      setAvailableDatasets(uniqueDatasets);
      
      // Note: Available classes will be updated based on filtered images in separate useEffect
      
      console.log('Dataset images loaded:', datasetImages.length);
      console.log('Available datasets:', uniqueDatasets);
    } catch (error) {
      message.error('Failed to load dataset images');
      console.error('Error fetching dataset images:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle pagination change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterSplitSection, filterDataset, filterClass, sortBy]);

  // Update available classes based on currently filtered images (excluding class filter)
  useEffect(() => {
    if (allImages.length === 0) return;

    // Filter images by all criteria except class filter
    const filteredImagesForClasses = allImages.filter(img => {
      // Search filter
      const matchesSearch = search === '' || 
        img.name?.toLowerCase().includes(search.toLowerCase()) ||
        img.filename?.toLowerCase().includes(search.toLowerCase());
      
      // Split section filter (train/validation/test)
      const matchesSplitSection = filterSplitSection === 'all' || 
        img.split_section === filterSplitSection;
      
      // Dataset filter
      const matchesDataset = filterDataset === 'all' || 
        img.dataset_name === filterDataset;
      
      return matchesSearch && matchesSplitSection && matchesDataset;
    });

    // Extract unique class names from filtered images
    const allClasses = new Set();
    filteredImagesForClasses.forEach(img => {
      if (img.annotations && Array.isArray(img.annotations)) {
        img.annotations.forEach(annotation => {
          if (annotation.class_name) {
            allClasses.add(annotation.class_name);
          }
        });
      }
      // Also check if image has class_names property (some APIs might return it this way)
      if (img.class_names && Array.isArray(img.class_names)) {
        img.class_names.forEach(className => allClasses.add(className));
      }
    });
    
    const uniqueClasses = Array.from(allClasses).sort();
    setAvailableClasses(uniqueClasses);
    
    console.log('Available classes updated based on filters:', uniqueClasses);
    
    // Reset class filter if current selection is no longer available
    if (filterClass !== 'all' && !uniqueClasses.includes(filterClass)) {
      setFilterClass('all');
    }
  }, [allImages, search, filterSplitSection, filterDataset]);

  // Filter and sort images based on current filters (client-side pagination)
  useEffect(() => {
    if (allImages.length === 0) return;

    let filteredImages = allImages.filter(img => {
      // Search filter
      const matchesSearch = search === '' || 
        img.name?.toLowerCase().includes(search.toLowerCase()) ||
        img.filename?.toLowerCase().includes(search.toLowerCase());
      
      // Split section filter (train/validation/test)
      const matchesSplitSection = filterSplitSection === 'all' || 
        img.split_section === filterSplitSection;
      
      // Dataset filter
      const matchesDataset = filterDataset === 'all' || 
        img.dataset_name === filterDataset;
      
      // Class filter - check if image contains annotations with the selected class
      const matchesClass = filterClass === 'all' || (() => {
        // Check in annotations array
        if (img.annotations && Array.isArray(img.annotations)) {
          return img.annotations.some(annotation => 
            annotation.class_name === filterClass
          );
        }
        // Check in class_names array (alternative API format)
        if (img.class_names && Array.isArray(img.class_names)) {
          return img.class_names.includes(filterClass);
        }
        return false;
      })();
      
      return matchesSearch && matchesSplitSection && matchesDataset && matchesClass;
    });

    // Sort images
    filteredImages.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'oldest':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'split':
          const splitOrder = { 'train': 1, 'val': 2, 'test': 3 };
          const aOrder = splitOrder[a.split_section] || 4;
          const bOrder = splitOrder[b.split_section] || 4;
          return aOrder - bOrder;
        default:
          // Default to newest first
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    // Apply pagination to filtered results
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedImages = filteredImages.slice(startIndex, endIndex);
    
    setImages(paginatedImages);
    setTotalImages(filteredImages.length);
  }, [allImages, search, filterSplitSection, filterDataset, filterClass, sortBy, currentPage, pageSize]);

  useEffect(() => {
    if (projectId) {
      fetchDatasetImages();
    }
  }, [projectId]);

  const handleImageClick = (image) => {
    // Navigate to manual labeling page
    navigate(`/annotate/${image.dataset_id}/manual`, {
      state: { 
        imageId: image.id,
        projectId: projectId 
      }
    });
  };

  if (loading) {
    return (
      <div className="dataset-container">
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #f0f0f0'
        }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">Loading dataset images...</Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dataset-container">
      {/* Header */}
      <div className="dataset-header">
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: '8px' }}>
            Dataset
          </Title>
          <Text type="secondary">
            Dataset images ready for training ({images.length} images)
          </Text>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleCreateRelease}
            style={{
              background: '#1890ff',
              borderColor: '#1890ff',
              fontWeight: '500'
            }}
          >
            Create New Release
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            onClick={fetchDatasetImages}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        background: '#fafafa', 
        padding: '16px', 
        borderRadius: '8px', 
        marginTop: '16px',
        border: '1px solid #f0f0f0'
      }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search dataset images by name..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={8} sm={6} md={4}>
            <Select
              value={filterSplitSection}
              onChange={setFilterSplitSection}
              style={{ width: '100%' }}
              placeholder="Split Section"
            >
              <Option value="all">All Splits</Option>
              <Option value="train">Train</Option>
              <Option value="val">Validation</Option>
              <Option value="test">Test</Option>
            </Select>
          </Col>
          <Col xs={8} sm={6} md={4}>
            <Select
              value={filterDataset}
              onChange={setFilterDataset}
              style={{ width: '100%' }}
              placeholder="Dataset"
            >
              <Option value="all">All Datasets</Option>
              {availableDatasets.map(dataset => (
                <Option key={dataset} value={dataset}>{dataset}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={8} sm={6} md={4}>
            <Select
              value={filterClass}
              onChange={setFilterClass}
              style={{ width: '100%' }}
              placeholder="Class"
            >
              <Option value="all">All Classes</Option>
              {availableClasses.map(className => (
                <Option key={className} value={className}>{className}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={8} sm={6} md={4}>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: '100%' }}
              placeholder="Sort by"
            >
              <Option value="newest">Newest First</Option>
              <Option value="oldest">Oldest First</Option>
              <Option value="split">Split Section</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Text type="secondary" style={{ lineHeight: '32px' }}>
                {totalImages > pageSize ? 
                  `Page ${currentPage} of ${Math.ceil(totalImages / pageSize)} (${totalImages} total images)` :
                  `${images.length} of ${totalImages} dataset images`
                }
              </Text>
            </div>
          </Col>
        </Row>
      </div>

      {/* Image Grid */}
      <div className="image-grid" style={{ marginTop: '24px' }}>
        {images.map((image) => (
          <DatasetImageCard 
            key={image.id} 
            image={image} 
            onClick={() => handleImageClick(image)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalImages > pageSize && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '32px',
          marginBottom: '24px'
        }}>
          <Pagination
            current={currentPage}
            total={totalImages}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
            showQuickJumper={totalImages > 100}
            showTotal={(total, range) => 
              `${range[0]}-${range[1]} of ${total} images`
            }
          />
        </div>
      )}

      {images.length === 0 && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#fafafa',
          borderRadius: '8px',
          border: '2px dashed #d9d9d9',
          marginTop: '24px'
        }}>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            {allImages.length === 0 ? 'No labeled dataset images found' : 'No images match your filters'}
          </Text>
          <br />
          <Text type="secondary">
            {allImages.length === 0 ? 'Complete annotation tasks to see images here' : 'Try adjusting your search terms or filters'}
          </Text>
        </div>
      )}
    </div>
  );
};

// Individual image card component
const DatasetImageCard = ({ image, onClick }) => {
  const [annotations, setAnnotations] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const loadAnnotations = async () => {
      if (image.id) {
        try {
          const annotationData = await projectsAPI.getImageAnnotations(image.id);
          console.log(`Annotations for image ${image.filename}:`, annotationData);
          setAnnotations(annotationData || []);
        } catch (error) {
          console.error('Error loading annotations:', error);
          setAnnotations([]);
        }
      }
    };

    loadAnnotations();
  }, [image.id]);

  const imageUrl = `http://localhost:12000/api/images/${image.id}`;

  // Get split section display name and color
  const getSplitInfo = (splitSection) => {
    switch (splitSection) {
      case 'train':
        return { label: 'Train', color: '#52c41a' }; // Green
      case 'val':
        return { label: 'Valid', color: '#1890ff' }; // Blue
      case 'test':
        return { label: 'Test', color: '#fa8c16' }; // Orange
      default:
        return { label: 'Unknown', color: '#d9d9d9' }; // Gray
    }
  };

  const splitInfo = getSplitInfo(image.split_section);

  const [imageDimensions, setImageDimensions] = useState({ width: 200, height: 150 });

  return (
    <div className="image-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ position: 'relative', width: '180px', height: 'auto', display: 'flex', justifyContent: 'center' }}>
        <img
          src={imageUrl}
          alt={image.filename || image.name}
          style={{ 
            width: '180px', 
            height: 'auto',
            borderRadius: '6px',
            display: imageLoaded ? 'block' : 'none'
          }}
          onLoad={(e) => {
            setImageLoaded(true);
            // Get actual rendered dimensions for proper SVG scaling
            setImageDimensions({
              width: e.target.clientWidth,
              height: e.target.clientHeight
            });
          }}
          onError={(e) => {
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
            setImageLoaded(true);
            setImageDimensions({ width: 200, height: 150 });
          }}
        />
        
        {/* Split section tag */}
        {image.split_section && imageLoaded && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              backgroundColor: splitInfo.color,
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              zIndex: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          >
            {splitInfo.label}
          </div>
        )}
        
        {!imageLoaded && (
          <div style={{
            width: '180px',
            height: '135px',
            background: '#f5f5f5',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Spin size="small" />
          </div>
        )}

        {/* Annotation Overlay using SVG */}
        {imageLoaded && annotations.length > 0 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '180px',
              height: '100%',
              pointerEvents: 'none',
              borderRadius: '6px'
            }}
            viewBox={`0 0 ${image.width || imageDimensions.width} ${image.height || imageDimensions.height}`}
            preserveAspectRatio="none"
          >
            {annotations.map((annotation, index) => {
              console.log(`Processing annotation ${index}:`, annotation);
              
              // Check if annotation has segmentation data (polygon)
              if (annotation.segmentation && annotation.segmentation.length > 0) {
                console.log(`Found polygon annotation with segmentation:`, annotation.segmentation);
                
                let points = annotation.segmentation;
                let pointsString = '';
                
                // Parse JSON string if needed
                if (typeof points === 'string') {
                  try {
                    points = JSON.parse(points);
                  } catch (e) {
                    console.error('Failed to parse segmentation JSON:', e);
                    return null;
                  }
                }
                
                // Handle different segmentation formats
                if (Array.isArray(points)) {
                  if (points.length > 0 && typeof points[0] === 'object' && points[0].x !== undefined) {
                    // Format: [{"x": 102, "y": 123}, {"x": 105, "y": 111}, ...] - array of objects
                    pointsString = points.map(point => `${point.x},${point.y}`).join(' ');
                    console.log(`Generated polygon points from objects:`, pointsString);
                  } else if (Array.isArray(points[0])) {
                    // Format: [[x1,y1,x2,y2,...]] - nested array
                    pointsString = points[0].reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  } else {
                    // Format: [x1,y1,x2,y2,...] - flat array
                    pointsString = points.reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  }
                }

                console.log(`Generated polygon points string:`, pointsString);

                if (pointsString) {
                  const firstPoint = points[0];
                  const labelX = typeof firstPoint === 'object' ? firstPoint.x : points[0];
                  const labelY = typeof firstPoint === 'object' ? firstPoint.y : points[1];
                  
                  return (
                    <g key={`polygon-${annotation.id || index}`}>
                      <polygon
                        points={pointsString}
                        fill="rgba(52, 196, 26, 0.3)"
                        stroke="#34c426"
                        strokeWidth="2"
                        strokeDasharray="none"
                      />
                      {annotation.class_name && (
                        <text
                          x={labelX || 10}
                          y={(labelY || 10) - 5}
                          fill="#34c426"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="start"
                          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}
                        >
                          {annotation.class_name}
                        </text>
                      )}
                    </g>
                  );
                }
              }
              
              // Also check for type === 'polygon' with segmentation
              if (annotation.type === 'polygon' && annotation.segmentation) {
                console.log(`Found type=polygon annotation:`, annotation);
                
                const points = annotation.segmentation;
                let pointsString = '';
                
                if (Array.isArray(points)) {
                  if (Array.isArray(points[0])) {
                    pointsString = points[0].reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  } else {
                    pointsString = points.reduce((acc, point, i) => {
                      if (i % 2 === 0) {
                        return acc + `${point},`;
                      } else {
                        return acc + `${point} `;
                      }
                    }, '').trim();
                  }
                }

                if (pointsString) {
                  return (
                    <g key={`polygon-type-${annotation.id || index}`}>
                      <polygon
                        points={pointsString}
                        fill="rgba(52, 196, 26, 0.2)"
                        stroke="#34c426"
                        strokeWidth="2"
                        strokeDasharray="none"
                      />
                      {annotation.class_name && (
                        <text
                          x={points[0] || 10}
                          y={(points[1] || 10) - 5}
                          fill="#34c426"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="start"
                        >
                          {annotation.class_name}
                        </text>
                      )}
                    </g>
                  );
                }
              }
              
              // Bounding box annotation - check for bounding box coordinates
              if (annotation.x_min !== undefined && annotation.y_min !== undefined && 
                  annotation.x_max !== undefined && annotation.y_max !== undefined) {
                // Convert normalized coordinates to pixel coordinates
                const imageWidth = image.width || imageDimensions.width;
                const imageHeight = image.height || imageDimensions.height;
                
                const x = annotation.x_min * imageWidth;
                const y = annotation.y_min * imageHeight;
                const width = (annotation.x_max - annotation.x_min) * imageWidth;
                const height = (annotation.y_max - annotation.y_min) * imageHeight;
                
                return (
                  <g key={`box-${annotation.id || index}`}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="rgba(255, 77, 79, 0.2)"
                      stroke="#ff4d4f"
                      strokeWidth="2"
                      strokeDasharray="none"
                    />
                    {annotation.class_name && (
                      <text
                        x={x + 5}
                        y={y - 5}
                        fill="#ff4d4f"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="start"
                      >
                        {annotation.class_name}
                      </text>
                    )}
                  </g>
                );
              }
              
              // Legacy format support - if annotation has x, y, width, height directly
              if (annotation.x !== undefined && annotation.y !== undefined && 
                  annotation.width !== undefined && annotation.height !== undefined) {
                return (
                  <g key={`legacy-box-${annotation.id || index}`}>
                    <rect
                      x={annotation.x}
                      y={annotation.y}
                      width={annotation.width}
                      height={annotation.height}
                      fill="rgba(255, 77, 79, 0.2)"
                      stroke="#ff4d4f"
                      strokeWidth="2"
                      strokeDasharray="none"
                    />
                    {annotation.class_name && (
                      <text
                        x={annotation.x + 5}
                        y={annotation.y - 5}
                        fill="#ff4d4f"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="start"
                      >
                        {annotation.class_name}
                      </text>
                    )}
                  </g>
                );
              }
              
              return null;
            })}
          </svg>
        )}
      </div>
      
      {/* Image filename below thumbnail */}
      <div style={{
        width: '180px',
        marginTop: '8px',
        padding: '6px 8px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#666',
        lineHeight: '1.3',
        wordBreak: 'break-word',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        background: '#fff',
        borderRadius: '4px',
        border: '1px solid #e8e8e8',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        {image.filename || image.name || 'Unknown'}
      </div>
    </div>
  );
};

export default DatasetSection;