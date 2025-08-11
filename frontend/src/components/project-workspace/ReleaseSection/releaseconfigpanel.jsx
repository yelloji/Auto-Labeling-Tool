import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Space, Divider, Row, Col, Statistic, Tag, Alert, message } from 'antd';
import { RocketOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';
import { imageTransformationsAPI } from '../../../services/api';

const { Option } = Select;

const ReleaseConfigPanel = ({ onGenerate, onPreview, transformations = [], selectedDatasets = [], currentReleaseVersion, onReleaseVersionChange }) => {
  console.log('🔥 UPDATED COMPONENT LOADED - VERSION 2.0 🔥');
  const [form] = Form.useForm();
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingReleaseVersion, setLoadingReleaseVersion] = useState(true);
  const [classCount, setClassCount] = useState(0);
  const [maxCombinations, setMaxCombinations] = useState(100); // Default max
  const [originalSplits, setOriginalSplits] = useState({ train: 0, val: 0, test: 0 });

  // Fetch class count and split information when selected datasets change
  useEffect(() => {
    const fetchDatasetInfo = async () => {
      if (!selectedDatasets || selectedDatasets.length === 0) {
        setClassCount(0);
        setOriginalSplits({ train: 0, val: 0, test: 0 });
        return;
      }
      
      const uniqueClasses = new Set();
      let trainCount = 0;
      let valCount = 0;
      let testCount = 0;
      
      for (const ds of selectedDatasets) {
        try {
          const res = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}`);
          if (res.ok) {
            const data = await res.json();
            
            // Get split counts from dataset
            if (data.split_counts) {
              trainCount += data.split_counts.train || 0;
              valCount += data.split_counts.validation || 0;
              testCount += data.split_counts.test || 0;
            } else {
              // Fallback: try to get split information from images
              const splitRes = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}/split-stats`);
              if (splitRes.ok) {
                const splitData = await splitRes.json();
                trainCount += splitData.train || 0;
                valCount += splitData.val || 0;
                testCount += splitData.test || 0;
              } else {
                // If no split info available, estimate based on total images
                const totalImages = data.total_images || 0;
                trainCount += Math.floor(totalImages * 0.7);
                valCount += Math.floor(totalImages * 0.2);
                testCount += Math.ceil(totalImages * 0.1);
              }
            }
            
            // Get class information
            if (data.recent_images) {
              for (const img of data.recent_images) {
                try {
                  const aRes = await fetch(`http://localhost:12000/api/v1/images/${img.id}/annotations`);
                  if (aRes.ok) {
                    const anns = await aRes.json();
                    anns.forEach(a => { if (a.class_name) uniqueClasses.add(a.class_name); });
                  }
                } catch (e) { console.error('Annotation fetch error:', img.id, e); }
              }
            }
          }
        } catch (e) { console.error('Dataset fetch error:', e); }
      }
      
      setClassCount(uniqueClasses.size);
      setOriginalSplits({ 
        train: trainCount, 
        val: valCount, 
        test: testCount 
      });
      
      console.log('📊 Original splits:', { train: trainCount, val: valCount, test: testCount });
    };

    fetchDatasetInfo();
  }, [selectedDatasets]);

  // Fetch combination count and user selection for current release version
  useEffect(() => {
    const fetchReleaseConfig = async () => {
      console.log('🔍 DEBUG: fetchReleaseConfig called with currentReleaseVersion:', currentReleaseVersion);
      
      if (!currentReleaseVersion) {
        console.log('❌ No currentReleaseVersion, skipping fetch');
        return;
      }
      
      try {
        const url = `http://localhost:12000/api/image-transformations/release-config/${currentReleaseVersion}`;
        console.log('🌐 Fetching from URL:', url);
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Response data:', data);
        
        if (data.max_images_per_original) {
          console.log('✅ Setting maxCombinations to:', data.max_images_per_original);
          setMaxCombinations(data.max_images_per_original);
          // Set current user selection in form if it exists
          if (data.user_selected_images_per_original) {
            form.setFieldsValue({ multiplier: data.user_selected_images_per_original });
          }
          console.log(`✅ Release config for ${currentReleaseVersion}: max=${data.max_images_per_original}, current=${data.user_selected_images_per_original}`);
        } else {
          console.log('❌ No max_images_per_original in response:', data);
        }
      } catch (error) {
        console.error('❌ Failed to fetch release config:', error);
        // Fallback to old API if new one fails
        try {
          console.log('🔄 Trying fallback API...');
          const response = await fetch('http://localhost:12000/api/v1/releases/versions?status=PENDING');
          const data = await response.json();
          console.log('📊 Fallback data:', data);
          if (data.success && data.versions) {
            const versionData = data.versions.find(v => v.version === currentReleaseVersion);
            if (versionData && versionData.max_combinations) {
              console.log('✅ Fallback: Setting maxCombinations to:', versionData.max_combinations);
              setMaxCombinations(versionData.max_combinations);
            }
          }
        } catch (fallbackError) {
          console.error('❌ Fallback API also failed:', fallbackError);
        }
      }
    };

    fetchReleaseConfig();
  }, [currentReleaseVersion]);

  // Load existing release version when component mounts
  useEffect(() => {
    const loadReleaseVersion = async () => {
      try {
        setLoadingReleaseVersion(true);
        
        // Only load if not already provided by parent
        if (!currentReleaseVersion) {
          // Get pending release versions
          const pendingVersions = await imageTransformationsAPI.getReleaseVersions('PENDING');
          
          if (pendingVersions && pendingVersions.length > 0) {
            // Use the most recent version (first in sorted array)
            const latestVersion = pendingVersions[0];
            onReleaseVersionChange?.(latestVersion);
            
            // Set the form field value
            form.setFieldsValue({
              name: latestVersion
            });
            
            console.log('Loaded existing release version:', latestVersion);
          } else {
            console.log('No pending release versions found');
          }
        } else {
          // Use the provided release version
          form.setFieldsValue({
            name: currentReleaseVersion
          });
        }
      } catch (error) {
        console.error('Failed to load release version:', error);
        message.error('Failed to load existing release version');
      } finally {
        setLoadingReleaseVersion(false);
      }
    };

    loadReleaseVersion();
  }, [form, currentReleaseVersion, onReleaseVersionChange]);

  // Handle release name change and save to database
  const handleReleaseNameChange = async (newName) => {
    if (!currentReleaseVersion || !newName || newName === currentReleaseVersion) {
      return; // No change needed
    }

    try {
      console.log(`Updating release version from "${currentReleaseVersion}" to "${newName}"`);
      
      const result = await imageTransformationsAPI.updateReleaseVersion(currentReleaseVersion, newName);
      
      onReleaseVersionChange(newName);
      message.success(`Release name updated to "${newName}"`);
      
      console.log('Release version update result:', result);
    } catch (error) {
      console.error('Failed to update release name:', error);
      message.error('Failed to update release name');
      
      // Revert the form field to the original value
      form.setFieldsValue({
        name: currentReleaseVersion
      });
    }
  };

  // Handle Enter key press in release name field
  const handleReleaseNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      const newName = e.target.value.trim();
      handleReleaseNameChange(newName);
    }
  };

  // Handle immediate update of images per original
  const handleImagesPerOriginalUpdate = async (value) => {
    console.log('🔍 DEBUG: handleImagesPerOriginalUpdate called with value:', value);
    console.log('🔍 DEBUG: currentReleaseVersion:', currentReleaseVersion);
    console.log('🔍 DEBUG: maxCombinations:', maxCombinations);
    
    if (!currentReleaseVersion) {
      console.log('❌ No currentReleaseVersion, aborting update');
      message.error('No release version selected');
      return;
    }
    
    if (!value || value < 1) {
      console.log('❌ Invalid value (too small):', value);
      message.error('Value must be at least 1');
      return;
    }
    
    if (value > maxCombinations) {
      console.log('❌ Invalid value (too large):', value, 'max:', maxCombinations);
      message.error(`Value cannot exceed ${maxCombinations}`);
      return;
    }

    try {
      console.log(`🚀 Updating images per original for "${currentReleaseVersion}" to ${value}`);
      
      const url = 'http://localhost:12000/api/image-transformations/update-user-selected-images';
      const payload = {
        release_version: currentReleaseVersion,
        user_selected_count: value
      };
      
      console.log('🌐 POST URL:', url);
      console.log('📦 Payload:', payload);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📊 Response data:', result);
      
      if (result.success === true) {
        message.success(`Images per Original updated to ${value}`);
        console.log('✅ Images per original update successful:', result);
        
        // 🔄 BIDIRECTIONAL UPDATE: Update the UI form field with the saved value
        form.setFieldsValue({ multiplier: result.user_selected_count });
        console.log('🔄 UI updated with saved value:', result.user_selected_count);
      } else {
        throw new Error(result.detail || result.message || 'Update failed');
      }
    } catch (error) {
      console.error('❌ Failed to update images per original:', error);
      message.error('Failed to update Images per Original: ' + error.message);
    }
  };

  // Handle Enter key press in images per original field
  const handleImagesPerOriginalKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value);
      handleImagesPerOriginalUpdate(value);
    }
  };

  // Handle blur event (when user clicks away from field)
  const handleImagesPerOriginalBlur = (e) => {
    const value = parseInt(e.target.value);
    handleImagesPerOriginalUpdate(value);
  };

  const handlePreview = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      // Calculate preview statistics
      const baseImages = selectedDatasets.reduce((sum, dataset) => sum + (dataset.total_images || 0), 0);
      const totalImages = baseImages * (values.multiplier || 1);
      
      // Calculate augmented images based on original split ratios
      const totalOriginalImages = originalSplits.train + originalSplits.val + originalSplits.test;
      
      // Calculate augmented counts based on original split ratios
      let augmentedSplits = { train: 0, val: 0, test: 0 };
      
      if (totalOriginalImages > 0) {
        // Use original split ratios
        augmentedSplits = {
          train: Math.round(totalImages * (originalSplits.train / totalOriginalImages)),
          val: Math.round(totalImages * (originalSplits.val / totalOriginalImages)),
          test: Math.round(totalImages * (originalSplits.test / totalOriginalImages))
        };
        
        // Adjust for rounding errors to ensure total matches
        const calculatedTotal = augmentedSplits.train + augmentedSplits.val + augmentedSplits.test;
        if (calculatedTotal !== totalImages) {
          const diff = totalImages - calculatedTotal;
          // Add/subtract the difference to/from the largest split
          if (augmentedSplits.train >= augmentedSplits.val && augmentedSplits.train >= augmentedSplits.test) {
            augmentedSplits.train += diff;
          } else if (augmentedSplits.val >= augmentedSplits.train && augmentedSplits.val >= augmentedSplits.test) {
            augmentedSplits.val += diff;
          } else {
            augmentedSplits.test += diff;
          }
        }
      } else {
        // Fallback to default split ratios if no original data
        augmentedSplits = {
          train: Math.floor(totalImages * 0.7),
          val: Math.floor(totalImages * 0.2),
          test: Math.ceil(totalImages * 0.1)
        };
      }
      
      const preview = {
        releaseName: values.name,
        totalImages,
        totalClasses: classCount, // Use calculated class count
        baseImages,
        multiplier: values.multiplier,
        transformationsCount: transformations.length,
        appliedTo: "automatic (preserves original splits)",
        preserveAnnotations: true, // Always true now
        exportFormat: values.exportFormat,
        taskType: values.taskType,
        imageFormat: values.imageFormat || 'original',
        selectedDatasets: selectedDatasets.map(d => d.name || d.id),
        transformationsList: transformations.map(t => t.name || t.type),
        // Include both original and augmented splits
        originalSplits: {
          train: originalSplits.train,
          val: originalSplits.val,
          test: originalSplits.test
        },
        splitBreakdown: augmentedSplits
      };
      
      setPreviewData(preview);
      if (onPreview) {
        onPreview(preview);
      }
    } catch (error) {
      console.error('Preview validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      const releaseConfig = {
        ...values,
        preserveAnnotations: true, // Ensure this is always true on generate
        transformations,
        selectedDatasets: selectedDatasets.map(d => d.id),
        previewData
      };
      onGenerate(releaseConfig);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  return (
    <Card 
      title={
        <Space>
          <SettingOutlined />
          <span>Release Configuration</span>
        </Space>
      }
      style={{ marginTop: 24 }}
      className="release-config-panel"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ 
          multiplier: 5,
          exportFormat: 'yolo_detection',
          taskType: 'object_detection',
          imageFormat: 'original'
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="Release Name"
              name="name"
              rules={[
                { required: true, message: 'Please enter a release name' },
                { min: 3, message: 'Release name must be at least 3 characters' }
              ]}
            >
              <Input 
                placeholder={loadingReleaseVersion ? "Loading existing release version..." : "e.g., Release v1.0, Dataset-2024-01"}
                style={{ fontSize: '14px' }}
                onKeyPress={handleReleaseNameKeyPress}
                disabled={loadingReleaseVersion}
                suffix={
                  loadingReleaseVersion ? (
                    <span style={{ color: '#999', fontSize: '12px' }}>Loading...</span>
                  ) : currentReleaseVersion ? (
                    <span style={{ color: '#52c41a', fontSize: '12px' }}>Press Enter to save</span>
                  ) : null
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={
                <span>
                  Images per Original
                  <span style={{ marginLeft: '10px', color: '#666', fontWeight: 'normal' }}>
                    Max: {maxCombinations}
                  </span>
                </span>
              }
              name="multiplier"
              rules={[
                { required: true },
                { 
                  type: 'number', 
                  min: 1, 
                  max: maxCombinations, 
                  message: `Value must be between 1 and ${maxCombinations}` 
                }
              ]}
            >
              <InputNumber 
                min={1} 
                max={maxCombinations} 
                style={{ width: '100%', backgroundColor: '#f0f8ff' }}
                placeholder="🔢 Enter number (UPDATED VERSION)"
                onPressEnter={handleImagesPerOriginalKeyPress}
                onBlur={handleImagesPerOriginalBlur}
              />
            </Form.Item>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '-12px', marginBottom: '16px' }}>
              ✅ Augmented images maintain their original train/val/test assignments
            </div>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label="Image Format"
              name="imageFormat"
              tooltip="Select image format for download"
            >
              <Select>
                <Option value="original">Original Format</Option>
                <Option value="jpg">JPG/JPEG (smaller size)</Option>
                <Option value="png">PNG (lossless)</Option>
                <Option value="webp">WEBP (modern, smaller)</Option>
                <Option value="bmp">BMP (uncompressed)</Option>
                <Option value="tiff">TIFF (high quality)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Export Format"
              name="exportFormat"
              tooltip="Select the export format"
            >
              <Select>
                <Option value="yolo_detection">YOLO Detection</Option>
                <Option value="yolo_segmentation">YOLO Segmentation</Option>
                <Option value="coco">COCO</Option>
                <Option value="pascal_voc">Pascal VOC</Option>
                <Option value="csv">CSV</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Task Type"
              name="taskType"
              tooltip="What task the model is trained for"
            >
              <Select>
                <Option value="object_detection">Object Detection</Option>
                <Option value="segmentation">Instance Segmentation</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Additional configuration options can be added here in the future */}

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12, color: '#262626' }}>Current Configuration</h4>
          <Row gutter={8}>
            <Col>
              <Tag color="blue">
                Datasets: {selectedDatasets.length}
              </Tag>
            </Col>
            <Col>
              <Tag color="green">
                Transformations: {transformations.length}
              </Tag>
            </Col>
            <Col>
              <Tag color="purple">
                Base Images: {selectedDatasets.reduce((sum, d) => sum + (d.total_images || 0), 0)}
              </Tag>
            </Col>
            <Col>
              <Tag color="cyan">
                Classes: {classCount}
              </Tag>
            </Col>
          </Row>
        </div>

        {previewData && (
          <Alert
            message={`Release Configuration Preview: "${previewData.releaseName}"`}
            description={
              <div style={{ marginTop: 12 }}>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic 
                      title="Total Images" 
                      value={previewData.totalImages}
                      valueStyle={{ fontSize: '16px', color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Base Images" 
                      value={previewData.baseImages}
                      valueStyle={{ fontSize: '14px', color: '#666' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Classes" 
                      value={previewData.totalClasses}
                      valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Multiplier" 
                      value={`${previewData.multiplier}x`}
                      valueStyle={{ fontSize: '16px', color: '#722ed1' }}
                    />
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginBottom: 8 }}>
                  <Col span={24}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Original Dataset Splits:
                    </div>
                  </Col>
                </Row>
                
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic 
                      title="Train (Original)" 
                      value={previewData.originalSplits.train}
                      valueStyle={{ fontSize: '14px', color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Validation (Original)" 
                      value={previewData.originalSplits.val}
                      valueStyle={{ fontSize: '14px', color: '#faad14' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Test (Original)" 
                      value={previewData.originalSplits.test}
                      valueStyle={{ fontSize: '14px', color: '#f5222d' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Transformations" 
                      value={previewData.transformationsCount}
                      valueStyle={{ fontSize: '14px', color: '#722ed1' }}
                    />
                  </Col>
                </Row>
                
                <Row gutter={16} style={{ marginBottom: 8 }}>
                  <Col span={24}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Augmented Dataset Splits:
                    </div>
                  </Col>
                </Row>
                
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic 
                      title="Train (Augmented)" 
                      value={previewData.splitBreakdown.train}
                      valueStyle={{ fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Validation (Augmented)" 
                      value={previewData.splitBreakdown.val}
                      valueStyle={{ fontSize: '14px', color: '#faad14', fontWeight: 'bold' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Test (Augmented)" 
                      value={previewData.splitBreakdown.test}
                      valueStyle={{ fontSize: '14px', color: '#f5222d', fontWeight: 'bold' }}
                    />
                  </Col>
                  <Col span={6}>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
                      ✅ Split ratios preserved from original datasets
                    </div>
                  </Col>
                </Row>
                
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <div>
                      <strong>Export Format:</strong> {previewData.exportFormat || 'Not selected'}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div>
                      <strong>Task Type:</strong> {previewData.taskType || 'Not selected'}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div>
                      <strong>Image Format:</strong> {previewData.imageFormat}
                    </div>
                  </Col>
                </Row>

                {previewData.selectedDatasets.length > 0 && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={24}>
                      <div>
                        <strong>Selected Datasets:</strong> {previewData.selectedDatasets.join(', ')}
                      </div>
                    </Col>
                  </Row>
                )}

                {previewData.transformationsList.length > 0 && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={24}>
                      <div>
                        <strong>Applied Transformations:</strong> {previewData.transformationsList.join(', ')}
                      </div>
                    </Col>
                  </Row>
                )}

                <Row>
                  <Col span={24}>
                    <div>
                      <strong>Applied To:</strong> {previewData.appliedTo}
                    </div>
                  </Col>
                </Row>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button 
            icon={<EyeOutlined />}
            onClick={handlePreview}
            loading={loading}
            style={{ minWidth: 120 }}
          >
            Preview Output
          </Button>
          
          <Button 
            type="primary"
            icon={<RocketOutlined />}
            onClick={handleGenerate}
            disabled={!previewData}
            style={{ minWidth: 140 }}
          >
            Create Release
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

export default ReleaseConfigPanel;
