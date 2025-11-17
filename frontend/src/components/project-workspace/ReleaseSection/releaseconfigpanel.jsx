import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Space, Divider, Row, Col, Statistic, Tag, Alert, message } from 'antd';
import { RocketOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';
import { imageTransformationsAPI } from '../../../services/api';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const { Option } = Select;

const ReleaseConfigPanel = ({ onGenerate, onPreview, transformations = [], selectedDatasets = [], currentReleaseVersion, onReleaseVersionChange }) => {
  console.log('🔥 UPDATED COMPONENT LOADED - VERSION 2.0 🔥');
  
  // Log component initialization
  logInfo('app.frontend.ui', 'release_config_panel_initialized', 'ReleaseConfigPanel component initialized', {
    timestamp: new Date().toISOString(),
    component: 'ReleaseConfigPanel',
    transformationsCount: transformations.length,
    selectedDatasetsCount: selectedDatasets.length,
    currentReleaseVersion: currentReleaseVersion,
    function: 'component_initialization'
  });

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
      logInfo('app.frontend.interactions', 'fetch_dataset_info_started', 'Fetching dataset information started', {
        timestamp: new Date().toISOString(),
        selectedDatasetsCount: selectedDatasets?.length || 0,
        selectedDatasets: selectedDatasets?.map(ds => ({ id: ds.id, name: ds.name })),
        function: 'fetchDatasetInfo'
      });

      if (!selectedDatasets || selectedDatasets.length === 0) {
        logInfo('app.frontend.ui', 'no_datasets_selected', 'No datasets selected, resetting counts', {
          timestamp: new Date().toISOString(),
          function: 'fetchDatasetInfo'
        });
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
          logInfo('app.frontend.interactions', 'fetching_dataset_details', 'Fetching dataset details', {
            timestamp: new Date().toISOString(),
            datasetId: ds.id,
            datasetName: ds.name,
            function: 'fetchDatasetInfo'
          });

          const res = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}`);
          if (res.ok) {
            const data = await res.json();
            
            // Get split counts from dataset
            if (data.split_counts) {
              trainCount += data.split_counts.train || 0;
              valCount += data.split_counts.validation || 0;
              testCount += data.split_counts.test || 0;
              
              logInfo('app.frontend.interactions', 'split_counts_from_dataset', 'Split counts retrieved from dataset', {
                timestamp: new Date().toISOString(),
                datasetId: ds.id,
                datasetName: ds.name,
                train: data.split_counts.train || 0,
                validation: data.split_counts.validation || 0,
                test: data.split_counts.test || 0,
                function: 'fetchDatasetInfo'
              });
            } else {
              // Fallback: try to get split information from images
              logInfo('app.frontend.interactions', 'fetching_split_stats_fallback', 'Fetching split stats as fallback', {
                timestamp: new Date().toISOString(),
                datasetId: ds.id,
                datasetName: ds.name,
                function: 'fetchDatasetInfo'
              });

              const splitRes = await fetch(`http://localhost:12000/api/v1/datasets/${ds.id}/split-stats`);
              if (splitRes.ok) {
                const splitData = await splitRes.json();
                trainCount += splitData.train || 0;
                valCount += splitData.val || 0;
                testCount += splitData.test || 0;
                
                logInfo('app.frontend.interactions', 'split_stats_retrieved', 'Split stats retrieved successfully', {
                  timestamp: new Date().toISOString(),
                  datasetId: ds.id,
                  datasetName: ds.name,
                  train: splitData.train || 0,
                  val: splitData.val || 0,
                  test: splitData.test || 0,
                  function: 'fetchDatasetInfo'
                });
              } else {
                // If no split info available, estimate based on total images
                const totalImages = data.total_images || 0;
                const estimatedTrain = Math.floor(totalImages * 0.7);
                const estimatedVal = Math.floor(totalImages * 0.2);
                const estimatedTest = Math.ceil(totalImages * 0.1);
                
                trainCount += estimatedTrain;
                valCount += estimatedVal;
                testCount += estimatedTest;
                
                logInfo('app.frontend.interactions', 'split_estimation_used', 'Split estimation used due to missing data', {
                  timestamp: new Date().toISOString(),
                  datasetId: ds.id,
                  datasetName: ds.name,
                  totalImages: totalImages,
                  estimatedTrain: estimatedTrain,
                  estimatedVal: estimatedVal,
                  estimatedTest: estimatedTest,
                  function: 'fetchDatasetInfo'
                });
              }
            }
            
            // Get class information
            if (data.recent_images) {
              logInfo('app.frontend.interactions', 'fetching_annotations_for_classes', 'Fetching annotations for class counting', {
                timestamp: new Date().toISOString(),
                datasetId: ds.id,
                datasetName: ds.name,
                recentImagesCount: data.recent_images.length,
                function: 'fetchDatasetInfo'
              });

              for (const img of data.recent_images) {
                try {
                  const aRes = await fetch(`http://localhost:12000/api/v1/images/${img.id}/annotations`);
                  if (aRes.ok) {
                    const anns = await aRes.json();
                    anns.forEach(a => { if (a.class_name) uniqueClasses.add(a.class_name); });
                  }
                } catch (e) { 
                  logError('app.frontend.interactions', 'annotation_fetch_error', 'Failed to fetch annotations for class counting', {
                    timestamp: new Date().toISOString(),
                    datasetId: ds.id,
                    imageId: img.id,
                    error: e.message,
                    function: 'fetchDatasetInfo'
                  });
                  console.error('Annotation fetch error:', img.id, e); 
                }
              }
            }
          } else {
            logError('app.frontend.interactions', 'dataset_fetch_failed', 'Failed to fetch dataset details', {
              timestamp: new Date().toISOString(),
              datasetId: ds.id,
              datasetName: ds.name,
              status: res.status,
              statusText: res.statusText,
              function: 'fetchDatasetInfo'
            });
          }
        } catch (e) { 
          logError('app.frontend.interactions', 'dataset_fetch_error', 'Error fetching dataset information', {
            timestamp: new Date().toISOString(),
            datasetId: ds.id,
            datasetName: ds.name,
            error: e.message,
            function: 'fetchDatasetInfo'
          });
          console.error('Dataset fetch error:', e); 
        }
      }
      
      setClassCount(uniqueClasses.size);
      setOriginalSplits({ 
        train: trainCount, 
        val: valCount, 
        test: testCount 
      });
      
      logInfo('app.frontend.interactions', 'dataset_info_fetch_completed', 'Dataset information fetch completed', {
        timestamp: new Date().toISOString(),
        uniqueClassesCount: uniqueClasses.size,
        totalTrainCount: trainCount,
        totalValCount: valCount,
        totalTestCount: testCount,
        function: 'fetchDatasetInfo'
      });
      
      console.log('📊 Original splits:', { train: trainCount, val: valCount, test: testCount });
    };

    fetchDatasetInfo();
  }, [selectedDatasets]);

  // Fetch combination count and user selection for current release version
  // Also refetch when transformations change to get updated max count
  useEffect(() => {
    const fetchReleaseConfig = async () => {
      logInfo('app.frontend.interactions', 'fetch_release_config_started', 'Fetching release configuration started', {
        timestamp: new Date().toISOString(),
        currentReleaseVersion: currentReleaseVersion,
        transformationsCount: transformations.length,
        function: 'fetchReleaseConfig'
      });

      console.log('🔍 DEBUG: fetchReleaseConfig called with currentReleaseVersion:', currentReleaseVersion);
      console.log('🔍 DEBUG: Current transformations count:', transformations.length);
      
      if (!currentReleaseVersion) {
        logInfo('app.frontend.ui', 'no_release_version_skip_fetch', 'No currentReleaseVersion, skipping fetch', {
          timestamp: new Date().toISOString(),
          function: 'fetchReleaseConfig'
        });
        console.log('❌ No currentReleaseVersion, skipping fetch');
        return;
      }
      
      try {
        const url = `http://localhost:12000/api/image-transformations/release-config/${currentReleaseVersion}`;
        console.log('🌐 Fetching from URL:', url);
        
        logInfo('app.frontend.interactions', 'fetching_release_config_api', 'Fetching release configuration from API', {
          timestamp: new Date().toISOString(),
          currentReleaseVersion: currentReleaseVersion,
          url: url,
          function: 'fetchReleaseConfig'
        });
        
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
          
          logInfo('app.frontend.interactions', 'release_config_retrieved', 'Release configuration retrieved successfully', {
            timestamp: new Date().toISOString(),
            currentReleaseVersion: currentReleaseVersion,
            maxImagesPerOriginal: data.max_images_per_original,
            userSelectedImagesPerOriginal: data.user_selected_images_per_original,
            function: 'fetchReleaseConfig'
          });
          
          console.log(`✅ Release config for ${currentReleaseVersion}: max=${data.max_images_per_original}, current=${data.user_selected_images_per_original}`);
        } else {
          logError('app.frontend.interactions', 'release_config_missing_data', 'Release configuration missing max_images_per_original', {
            timestamp: new Date().toISOString(),
            currentReleaseVersion: currentReleaseVersion,
            responseData: data,
            function: 'fetchReleaseConfig'
          });
          console.log('❌ No max_images_per_original in response:', data);
        }
      } catch (error) {
        logError('app.frontend.interactions', 'release_config_fetch_failed', 'Failed to fetch release configuration', {
          timestamp: new Date().toISOString(),
          currentReleaseVersion: currentReleaseVersion,
          error: error.message,
          function: 'fetchReleaseConfig'
        });
        console.error('❌ Failed to fetch release config:', error);
        // Fallback to old API if new one fails
        try {
          console.log('🔄 Trying fallback API...');
          
          logInfo('app.frontend.interactions', 'trying_fallback_api', 'Trying fallback API for release configuration', {
            timestamp: new Date().toISOString(),
            currentReleaseVersion: currentReleaseVersion,
            function: 'fetchReleaseConfig'
          });
          
          const response = await fetch('http://localhost:12000/api/v1/releases/versions?status=PENDING');
          const data = await response.json();
          console.log('📊 Fallback data:', data);
          if (data.success && data.versions) {
            const versionData = data.versions.find(v => v.version === currentReleaseVersion);
            if (versionData && versionData.max_combinations) {
              console.log('✅ Fallback: Setting maxCombinations to:', versionData.max_combinations);
              setMaxCombinations(versionData.max_combinations);
              
              logInfo('app.frontend.interactions', 'fallback_api_success', 'Fallback API successful for release configuration', {
                timestamp: new Date().toISOString(),
                currentReleaseVersion: currentReleaseVersion,
                maxCombinations: versionData.max_combinations,
                function: 'fetchReleaseConfig'
              });
            }
          }
        } catch (fallbackError) {
          logError('app.frontend.interactions', 'fallback_api_failed', 'Fallback API also failed for release configuration', {
            timestamp: new Date().toISOString(),
            currentReleaseVersion: currentReleaseVersion,
            error: fallbackError.message,
            function: 'fetchReleaseConfig'
          });
          console.error('❌ Fallback API also failed:', fallbackError);
        }
      }
    };

    fetchReleaseConfig();
  }, [currentReleaseVersion, transformations]);

  // Load existing release version when component mounts
  useEffect(() => {
    const loadReleaseVersion = async () => {
      logInfo('app.frontend.interactions', 'load_release_version_started', 'Loading release version started', {
        timestamp: new Date().toISOString(),
        currentReleaseVersion: currentReleaseVersion,
        function: 'loadReleaseVersion'
      });

      try {
        setLoadingReleaseVersion(true);
        
        // Only load if not already provided by parent
        if (!currentReleaseVersion) {
          logInfo('app.frontend.interactions', 'fetching_pending_versions', 'Fetching pending release versions', {
            timestamp: new Date().toISOString(),
            function: 'loadReleaseVersion'
          });

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
            
            logInfo('app.frontend.interactions', 'release_version_loaded', 'Release version loaded successfully', {
              timestamp: new Date().toISOString(),
              latestVersion: latestVersion,
              pendingVersionsCount: pendingVersions.length,
              function: 'loadReleaseVersion'
            });
            
            console.log('Loaded existing release version:', latestVersion);
          } else {
            logInfo('app.frontend.ui', 'no_pending_versions', 'No pending release versions found', {
              timestamp: new Date().toISOString(),
              function: 'loadReleaseVersion'
            });
            console.log('No pending release versions found');
          }
        } else {
          // Use the provided release version
          logInfo('app.frontend.ui', 'using_provided_version', 'Using provided release version', {
            timestamp: new Date().toISOString(),
            currentReleaseVersion: currentReleaseVersion,
            function: 'loadReleaseVersion'
          });

          form.setFieldsValue({
            name: currentReleaseVersion
          });
        }
      } catch (error) {
        logError('app.frontend.interactions', 'load_release_version_failed', 'Failed to load release version', {
          timestamp: new Date().toISOString(),
          currentReleaseVersion: currentReleaseVersion,
          error: error.message,
          function: 'loadReleaseVersion'
        });
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
      logInfo('app.frontend.ui', 'release_name_no_change', 'Release name change skipped - no change needed', {
        timestamp: new Date().toISOString(),
        currentReleaseVersion: currentReleaseVersion,
        newName: newName,
        function: 'handleReleaseNameChange'
      });
      return; // No change needed
    }

    logInfo('app.frontend.interactions', 'release_name_update_started', 'Release name update started', {
      timestamp: new Date().toISOString(),
      currentReleaseVersion: currentReleaseVersion,
      newName: newName,
      function: 'handleReleaseNameChange'
    });

    try {
      console.log(`Updating release version from "${currentReleaseVersion}" to "${newName}"`);
      
      const result = await imageTransformationsAPI.updateReleaseVersion(currentReleaseVersion, newName);
      
      onReleaseVersionChange(newName);
      message.success(`Release name updated to "${newName}"`);
      
      logInfo('app.frontend.interactions', 'release_name_update_success', 'Release name updated successfully', {
        timestamp: new Date().toISOString(),
        oldName: currentReleaseVersion,
        newName: newName,
        result: result,
        function: 'handleReleaseNameChange'
      });
      
      console.log('Release version update result:', result);
    } catch (error) {
      logError('app.frontend.interactions', 'release_name_update_failed', 'Failed to update release name', {
        timestamp: new Date().toISOString(),
        currentReleaseVersion: currentReleaseVersion,
        newName: newName,
        error: error.message,
        function: 'handleReleaseNameChange'
      });
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
      logUserClick('release_name_enter_pressed', 'User pressed Enter in release name field');
      logInfo('app.frontend.interactions', 'release_name_enter_key', 'Enter key pressed in release name field', {
        timestamp: new Date().toISOString(),
        newName: newName,
        currentReleaseVersion: currentReleaseVersion,
        function: 'handleReleaseNameKeyPress'
      });
      handleReleaseNameChange(newName);
    }
  };

  // Handle immediate update of images per original
  const handleImagesPerOriginalUpdate = async (value) => {
    console.log('🔍 DEBUG: handleImagesPerOriginalUpdate called with value:', value);
    console.log('🔍 DEBUG: currentReleaseVersion:', currentReleaseVersion);
    console.log('🔍 DEBUG: maxCombinations:', maxCombinations);
    
    if (!currentReleaseVersion) {
      logError('app.frontend.validation', 'no_release_version_for_update', 'No release version selected for images per original update', {
        timestamp: new Date().toISOString(),
        value: value,
        function: 'handleImagesPerOriginalUpdate'
      });
      console.log('❌ No currentReleaseVersion, aborting update');
      message.error('No release version selected');
      return;
    }
    
    if (!value || value < 1) {
      logError('app.frontend.validation', 'invalid_value_too_small', 'Invalid value for images per original - too small', {
        timestamp: new Date().toISOString(),
        value: value,
        currentReleaseVersion: currentReleaseVersion,
        function: 'handleImagesPerOriginalUpdate'
      });
      console.log('❌ Invalid value (too small):', value);
      message.error('Value must be at least 1');
      return;
    }
    
    if (value > maxCombinations) {
      logError('app.frontend.validation', 'invalid_value_too_large', 'Invalid value for images per original - too large', {
        timestamp: new Date().toISOString(),
        value: value,
        maxCombinations: maxCombinations,
        currentReleaseVersion: currentReleaseVersion,
        function: 'handleImagesPerOriginalUpdate'
      });
      console.log('❌ Invalid value (too large):', value, 'max:', maxCombinations);
      message.error(`Value cannot exceed ${maxCombinations}`);
      return;
    }

    logInfo('app.frontend.interactions', 'images_per_original_update_started', 'Images per original update started', {
      timestamp: new Date().toISOString(),
      currentReleaseVersion: currentReleaseVersion,
      value: value,
      maxCombinations: maxCombinations,
      function: 'handleImagesPerOriginalUpdate'
    });

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
        
        logInfo('app.frontend.interactions', 'images_per_original_update_success', 'Images per original updated successfully', {
          timestamp: new Date().toISOString(),
          currentReleaseVersion: currentReleaseVersion,
          value: value,
          result: result,
          function: 'handleImagesPerOriginalUpdate'
        });
        
        // 🔄 BIDIRECTIONAL UPDATE: Update the UI form field with the saved value
        form.setFieldsValue({ multiplier: result.user_selected_count });
        console.log('🔄 UI updated with saved value:', result.user_selected_count);
      } else {
        throw new Error(result.detail || result.message || 'Update failed');
      }
    } catch (error) {
      logError('app.frontend.interactions', 'images_per_original_update_failed', 'Failed to update images per original', {
        timestamp: new Date().toISOString(),
        currentReleaseVersion: currentReleaseVersion,
        value: value,
        error: error.message,
        function: 'handleImagesPerOriginalUpdate'
      });
      console.error('❌ Failed to update images per original:', error);
      message.error('Failed to update Images per Original: ' + error.message);
    }
  };

  // Handle Enter key press in images per original field
  const handleImagesPerOriginalKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value);
      logUserClick('images_per_original_enter_pressed', 'User pressed Enter in images per original field');
      logInfo('app.frontend.interactions', 'images_per_original_enter_key', 'Enter key pressed in images per original field', {
        timestamp: new Date().toISOString(),
        value: value,
        currentReleaseVersion: currentReleaseVersion,
        function: 'handleImagesPerOriginalKeyPress'
      });
      handleImagesPerOriginalUpdate(value);
    }
  };

  // Handle blur event (when user clicks away from field)
  const handleImagesPerOriginalBlur = (e) => {
    const value = parseInt(e.target.value);
    logInfo('app.frontend.ui', 'images_per_original_blur', 'Images per original field lost focus', {
      timestamp: new Date().toISOString(),
      value: value,
      currentReleaseVersion: currentReleaseVersion,
      function: 'handleImagesPerOriginalBlur'
    });
    handleImagesPerOriginalUpdate(value);
  };

  const handlePreview = async () => {
    logInfo('app.frontend.interactions', 'preview_generation_started', 'Preview generation started', {
      timestamp: new Date().toISOString(),
      selectedDatasetsCount: selectedDatasets.length,
      transformationsCount: transformations.length,
      function: 'handlePreview'
    });

    try {
      setLoading(true);
      const values = await form.validateFields();
      
      logInfo('app.frontend.interactions', 'preview_form_validation_success', 'Preview form validation successful', {
        timestamp: new Date().toISOString(),
        formValues: values,
        function: 'handlePreview'
      });
      
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
      
      logInfo('app.frontend.interactions', 'preview_generation_completed', 'Preview generation completed successfully', {
        timestamp: new Date().toISOString(),
        preview: preview,
        function: 'handlePreview'
      });
      
      if (onPreview) {
        onPreview(preview);
      }
    } catch (error) {
      logError('app.frontend.validation', 'preview_validation_failed', 'Preview validation failed', {
        timestamp: new Date().toISOString(),
        error: error.message,
        function: 'handlePreview'
      });
      console.error('Preview validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    logInfo('app.frontend.interactions', 'release_generation_started', 'Release generation started', {
      timestamp: new Date().toISOString(),
      selectedDatasetsCount: selectedDatasets.length,
      transformationsCount: transformations.length,
      function: 'handleGenerate'
    });

    try {
      const values = await form.validateFields();
      
      logInfo('app.frontend.interactions', 'generate_form_validation_success', 'Generate form validation successful', {
        timestamp: new Date().toISOString(),
        formValues: values,
        function: 'handleGenerate'
      });

      const releaseConfig = {
        ...values,
        preserveAnnotations: true, // Ensure this is always true on generate
        transformations,
        selectedDatasets: selectedDatasets.map(d => d.id),
        previewData
      };
      
      logInfo('app.frontend.interactions', 'release_config_created', 'Release configuration created', {
        timestamp: new Date().toISOString(),
        releaseConfig: releaseConfig,
        function: 'handleGenerate'
      });

      onGenerate(releaseConfig);
    } catch (error) {
      logError('app.frontend.validation', 'generate_form_validation_failed', 'Generate form validation failed', {
        timestamp: new Date().toISOString(),
        error: error.message,
        function: 'handleGenerate'
      });
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
      {(() => {
        logInfo('app.frontend.ui', 'release_config_panel_rendered', 'ReleaseConfigPanel component rendered', {
          timestamp: new Date().toISOString(),
          component: 'ReleaseConfigPanel',
          selectedDatasetsCount: selectedDatasets.length,
          transformationsCount: transformations.length,
          hasPreviewData: !!previewData,
          loading: loading,
          loadingReleaseVersion: loadingReleaseVersion,
          function: 'component_render'
        });
        return null;
      })()}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ 
          multiplier: 5,
          exportFormat: 'yolo_detection',
          taskType: 'object_detection',
          imageFormat: 'original'
        }}
        onFinishFailed={(errorInfo) => {
          logError('app.frontend.validation', 'form_validation_failed', 'Form validation failed', {
            timestamp: new Date().toISOString(),
            errorInfo: errorInfo,
            function: 'form_onFinishFailed'
          });
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
                <Option value="pascal_voc">Pascal VOC (For Object Detection Tasks)</Option>
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
            onClick={() => {
              logUserClick('preview_output_button_clicked', 'User clicked Preview Output button');
              logInfo('app.frontend.interactions', 'preview_button_clicked', 'Preview Output button clicked', {
                timestamp: new Date().toISOString(),
                selectedDatasetsCount: selectedDatasets.length,
                transformationsCount: transformations.length,
                function: 'preview_button_onClick'
              });
              handlePreview();
            }}
            loading={loading}
            style={{ minWidth: 120 }}
          >
            Preview Output
          </Button>
          
          <Button 
            type="primary"
            icon={<RocketOutlined />}
            onClick={() => {
              logUserClick('create_release_button_clicked', 'User clicked Create Release button');
              logInfo('app.frontend.interactions', 'create_release_button_clicked', 'Create Release button clicked', {
                timestamp: new Date().toISOString(),
                selectedDatasetsCount: selectedDatasets.length,
                transformationsCount: transformations.length,
                hasPreviewData: !!previewData,
                function: 'create_release_button_onClick'
              });
              handleGenerate();
            }}
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
