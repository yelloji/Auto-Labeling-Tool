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
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';
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

  useEffect(() => {
    logInfo('app.frontend.ui', 'dataset_section_initialized', 'DatasetSection component initialized', {
      timestamp: new Date().toISOString(),
      component: 'DatasetSection',
      projectId: projectId
    });

    if (projectId) {
      fetchDatasetImages();
    }

    // Listen for dataset changes from other components
    const handleDatasetChange = (event) => {
      if (event.detail.projectId === projectId) {
        logInfo('app.frontend.interactions', 'dataset_auto_refresh_triggered', 'Dataset auto-refresh triggered by external change', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          action: event.detail.action
        });
        fetchDatasetImages();
      }
    };

    window.addEventListener('datasetChanged', handleDatasetChange);

    return () => {
      window.removeEventListener('datasetChanged', handleDatasetChange);
    };
  }, [projectId]);

  // Navigate to Release section
  const handleCreateRelease = () => {
    logUserClick('create_release_button_clicked', 'User clicked create release button');
    logInfo('app.frontend.navigation', 'navigate_to_release_section', 'Navigating to release section', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      destination: 'release_section'
    });
    navigate(`/projects/${projectId}/workspace`, { 
      state: { selectedSection: 'versions', openCreateModal: true } 
    });
  };

  const fetchDatasetImages = async () => {
    logInfo('app.frontend.interactions', 'dataset_images_loading_started', 'Started loading dataset images', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    setLoading(true);
    try {
      // Fetch all images with split_type=dataset filter (client-side pagination)
      const response = await projectsAPI.getProjectDatasetImages(projectId, 'dataset', 10000, 0);
      console.log('Dataset images response:', response);
      
      // Store all dataset images for client-side filtering and pagination
      const datasetImages = response.images || [];
      setAllImages(datasetImages);
      
      // Fetch all datasets (including empty ones) for complete dropdown
      const datasetsResponse = await projectsAPI.getProjectDatasets(projectId);
      const allDatasets = datasetsResponse.datasets || [];
      
      // Extract dataset names from images
      const datasetsWithImages = [...new Set(datasetImages.map(img => img.dataset_name))].filter(Boolean);
      
      // Combine all dataset names (from both API calls) to ensure empty datasets appear
      const allDatasetNames = [...new Set([
        ...allDatasets.map(dataset => dataset.name),
        ...datasetsWithImages
      ])].filter(Boolean);
      
      setAvailableDatasets(allDatasetNames);
      
      // Note: Available classes will be updated based on filtered images in separate useEffect
      
      console.log('Dataset images loaded:', datasetImages.length);
      console.log('All datasets loaded:', allDatasets.length);
      console.log('Available datasets:', allDatasetNames);

      logInfo('app.frontend.interactions', 'dataset_images_loading_success', 'Successfully loaded dataset images and datasets', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        imagesCount: datasetImages.length,
        totalDatasetsCount: allDatasets.length,
        availableDatasetsCount: allDatasetNames.length
      });
    } catch (error) {
      logError('app.frontend.validation', 'dataset_images_loading_failed', 'Failed to load dataset images', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        error: error.message,
        errorDetails: error.response?.data
      });
      message.error('Failed to load dataset images');
      console.error('Error fetching dataset images:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle pagination change
  const handlePageChange = (page) => {
    logUserClick('pagination_page_changed', `User changed to page ${page}`);
    logInfo('app.frontend.ui', 'pagination_changed', 'Pagination page changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      oldPage: currentPage,
      newPage: page,
      totalImages: totalImages,
      pageSize: pageSize
    });
    setCurrentPage(page);
  };

  // Reset page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      logInfo('app.frontend.ui', 'filters_changed_reset_page', 'Filters changed, resetting to page 1', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        search: search,
        filterSplitSection: filterSplitSection,
        filterDataset: filterDataset,
        filterClass: filterClass,
        sortBy: sortBy
      });
      setCurrentPage(1);
    }
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
      logInfo('app.frontend.ui', 'class_filter_reset', 'Class filter reset due to unavailable class', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        oldFilterClass: filterClass,
        availableClasses: uniqueClasses
      });
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

    logInfo('app.frontend.ui', 'images_filtered_and_paginated', 'Images filtered and paginated', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      totalImages: allImages.length,
      filteredImages: filteredImages.length,
      paginatedImages: paginatedImages.length,
      currentPage: currentPage,
      pageSize: pageSize,
      filters: {
        search: search,
        splitSection: filterSplitSection,
        dataset: filterDataset,
        class: filterClass,
        sortBy: sortBy
      }
    });
  }, [allImages, search, filterSplitSection, filterDataset, filterClass, sortBy, currentPage, pageSize]);

  const handleImageClick = (image) => {
    logUserClick('dataset_image_clicked', `User clicked on dataset image: ${image.filename || image.name}`);
    logInfo('app.frontend.navigation', 'navigate_to_manual_labeling', 'Navigating to manual labeling page', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      imageId: image.id,
      datasetId: image.dataset_id,
      imageName: image.filename || image.name
    });
    // Navigate to manual labeling page
    navigate(`/annotate/${image.dataset_id}/manual`, {
      state: { 
        imageId: image.id,
        projectId: projectId 
      }
    });
  };

  const handleSearchChange = (e) => {
    const newSearch = e.target.value;
    logInfo('app.frontend.ui', 'search_filter_changed', 'Search filter changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      oldSearch: search,
      newSearch: newSearch
    });
    setSearch(newSearch);
  };

  const handleSplitSectionFilterChange = (value) => {
    logInfo('app.frontend.ui', 'split_section_filter_changed', 'Split section filter changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      oldFilter: filterSplitSection,
      newFilter: value
    });
    setFilterSplitSection(value);
  };

  const handleDatasetFilterChange = (value) => {
    logInfo('app.frontend.ui', 'dataset_filter_changed', 'Dataset filter changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      oldFilter: filterDataset,
      newFilter: value
    });
    setFilterDataset(value);
  };

  const handleClassFilterChange = (value) => {
    logInfo('app.frontend.ui', 'class_filter_changed', 'Class filter changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      oldFilter: filterClass,
      newFilter: value
    });
    setFilterClass(value);
  };

  const handleSortByChange = (value) => {
    logInfo('app.frontend.ui', 'sort_by_changed', 'Sort by changed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      oldSortBy: sortBy,
      newSortBy: value
    });
    setSortBy(value);
  };

  const handleRefreshClick = () => {
    logUserClick('refresh_dataset_button_clicked', 'User clicked refresh dataset button');
    logInfo('app.frontend.interactions', 'dataset_refresh_triggered', 'Dataset refresh triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });
    fetchDatasetImages();
  };

  if (loading) {
    logInfo('app.frontend.ui', 'dataset_loading_state', 'Dataset section showing loading state', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });
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
      {(() => {
        logInfo('app.frontend.ui', 'dataset_section_rendered', 'Dataset section fully rendered', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          totalImages: totalImages,
          displayedImages: images.length,
          hasImages: allImages.length > 0,
          currentPage: currentPage,
          totalPages: Math.ceil(totalImages / pageSize)
        });
        return null;
      })()}
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
            onClick={handleRefreshClick}
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
              onChange={handleSearchChange}
              allowClear
            />
          </Col>
          <Col xs={8} sm={6} md={4}>
            <Select
              value={filterSplitSection}
              onChange={handleSplitSectionFilterChange}
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
              onChange={handleDatasetFilterChange}
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
              onChange={handleClassFilterChange}
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
              onChange={handleSortByChange}
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
        logInfo('app.frontend.interactions', 'image_annotations_loading_started', 'Started loading image annotations', {
          timestamp: new Date().toISOString(),
          imageId: image.id,
          imageName: image.filename || image.name
        });

        try {
          const annotationData = await projectsAPI.getImageAnnotations(image.id);
          console.log(`Annotations for image ${image.filename}:`, annotationData);
          setAnnotations(annotationData || []);

          logInfo('app.frontend.interactions', 'image_annotations_loading_success', 'Successfully loaded image annotations', {
            timestamp: new Date().toISOString(),
            imageId: image.id,
            imageName: image.filename || image.name,
            annotationsCount: annotationData?.length || 0
          });
        } catch (error) {
          logError('app.frontend.validation', 'image_annotations_loading_failed', 'Failed to load image annotations', {
            timestamp: new Date().toISOString(),
            imageId: image.id,
            imageName: image.filename || image.name,
            error: error.message,
            errorDetails: error.response?.data
          });
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

            logInfo('app.frontend.ui', 'image_loaded', 'Image loaded successfully', {
              timestamp: new Date().toISOString(),
              imageId: image.id,
              imageName: image.filename || image.name,
              dimensions: {
                width: e.target.clientWidth,
                height: e.target.clientHeight
              }
            });
          }}
          onError={(e) => {
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
            setImageLoaded(true);
            setImageDimensions({ width: 200, height: 150 });

            logError('app.frontend.validation', 'image_load_failed', 'Image failed to load', {
              timestamp: new Date().toISOString(),
              imageId: image.id,
              imageName: image.filename || image.name,
              imageUrl: imageUrl
            });
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