/**
 * UploadSection Component
 * 
 * This component handles file uploads for a project workspace with three main upload methods:
 * 1. Drag & Drop - Files can be dragged into the upload area
 * 2. Select Files - Manual file selection with batch name modal
 * 3. Select Folder - Folder selection that auto-uses folder name as batch name
 * 
 * Features:
 * - Batch name modal for file uploads (when no tags selected)
 * - Tag-based uploads (skip batch name modal when tags are selected)
 * - Progress tracking and visual feedback
 * - File validation (type and size checks)
 * - Recent images display
 * - Multiple file format support
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Typography,
  Card,
  Button,
  Upload,
  Input,
  Select,
  Row,
  Col,
  Divider,
  Progress,
  message,
  Space,
  Modal
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  PictureOutlined,
  DatabaseOutlined,
  TagOutlined,
  FolderOutlined,
  YoutubeOutlined,
  ApiOutlined,
  CloudOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { projectsAPI, datasetsAPI, handleAPIError } from '../../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

/**
 * UploadSection Component
 * @param {string} projectId - The ID of the current project
 */
const UploadSection = ({ projectId }) => {
  // ==================== STATE VARIABLES ====================
  
  // Batch naming and tagging
  const [batchName, setBatchName] = useState(''); // User-defined batch name for uploads
  const [tags, setTags] = useState([]); // Selected dataset tags for categorization
  
  // Upload management
  const [uploadedFiles, setUploadedFiles] = useState([]); // List of successfully uploaded files
  const [uploading, setUploading] = useState(false); // Upload in progress flag
  const [uploadProgress, setUploadProgress] = useState(0); // Upload progress percentage (0-100)
  const [uploadTimeout, setUploadTimeout] = useState(null); // Timeout for batch upload processing
  
  // Data and UI state
  const [availableDatasets, setAvailableDatasets] = useState([]); // Available datasets for tagging
  const [recentImages, setRecentImages] = useState([]); // Recently uploaded images for display
  const [batchNameModalVisible, setBatchNameModalVisible] = useState(false); // Modal visibility state
  
  // Upload type and file handling
  const [uploadType, setUploadType] = useState('files'); // Current upload type: 'files' or 'folder'
  const [pendingFiles, setPendingFiles] = useState([]); // Files waiting for batch name confirmation
  
  // Video upload state
  const [videoFile, setVideoFile] = useState(null); // Selected video file
  const [selectedFPS, setSelectedFPS] = useState(2); // Selected frames per second
  const [selectedImageFormat, setSelectedImageFormat] = useState('jpeg'); // Selected output image format
  const [videoProcessing, setVideoProcessing] = useState(false); // Video processing status
  const [extractedFrames, setExtractedFrames] = useState([]); // Extracted image frames
  
  // ==================== REFS ====================
  const fileInputRef = useRef(null); // Reference to hidden file input element
  const folderInputRef = useRef(null); // Reference to hidden folder input element

  // ==================== API FUNCTIONS ====================
  
  /**
   * Load available datasets for the project to populate the tags dropdown
   * Fetches datasets from the backend and formats them for Select component
   */
  const loadAvailableDatasets = async () => {
    try {
      const response = await projectsAPI.getProjectDatasets(projectId);
      const datasets = response.datasets || response || [];
      const options = datasets.map(dataset => ({
        value: dataset.id,
        label: dataset.name
      }));
      setAvailableDatasets(options);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to load datasets: ${errorInfo.message}`);
    }
  };

  /**
   * Load recent images for the project to display in the upload status section
   * Shows the last 6 uploaded images with thumbnails
   */
  const loadRecentImages = async () => {
    try {
      const images = await projectsAPI.getRecentImages(projectId, 6);
      setRecentImages(images);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      console.error('Failed to load recent images:', errorInfo);
    }
  };

  // ==================== EVENT HANDLERS ====================
  
  /**
   * Handle file selection button click
   * Shows batch name modal if no tags are selected, otherwise opens file dialog directly
   */
  const handleFileSelect = () => {
    setUploadType('files');
    // Only show batch name modal if no tags are selected
    if (tags.length === 0) {
      setBatchNameModalVisible(true);
    } else {
      // Tags are selected, proceed directly to file selection
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  /**
   * Handle folder selection button click
   * Always opens folder dialog directly (uses folder name as batch name)
   */
  const handleFolderSelect = () => {
    setUploadType('folder');
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  /**
   * Handle batch name confirmation from modal
   * Validates batch name and either opens file dialog or processes pending drag & drop files
   */
  const handleBatchNameConfirm = () => {
    if (!batchName.trim()) {
      message.error('Batch name cannot be empty');
      return;
    }
    setBatchNameModalVisible(false);
    
    // Check if we have pending files from drag & drop
    if (pendingFiles.length > 0) {
      // Process pending drag & drop files
      const batchNameToUse = batchName;
      
      pendingFiles.forEach(async ({ file, onSuccess, onError, onProgress }) => {
        try {
          // Simulate progress
          let percent = 0;
          const interval = setInterval(() => {
            percent = Math.min(99, percent + 10);
            onProgress({ percent });
          }, 200);
          
          // Upload the file
          await uploadFile(file, batchNameToUse);
          
          // Clear interval and set progress to 100%
          clearInterval(interval);
          onProgress({ percent: 100 });
          onSuccess("ok", null);
          
          // Reload recent images
          loadRecentImages();
        } catch (error) {
          onError(error);
        }
      });
      
      // Clear pending files
      setPendingFiles([]);
    } else {
      // Regular file selection flow
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  /**
   * Handle drag and drop with batch name modal (UNUSED - kept for reference)
   * This function is not currently used as drag & drop logic is handled in uploadProps
   */
  const handleDragDrop = (files) => {
    if (tags.length === 0) {
      // No tags selected, show batch name modal first
      setPendingFiles(files);
      setBatchNameModalVisible(true);
    } else {
      // Tags are selected, proceed directly with upload
      processDragDropFiles(files);
    }
  };

  /**
   * Process drag and drop files after batch name is confirmed (UNUSED - kept for reference)
   * This function is not currently used as drag & drop logic is handled in uploadProps
   */
  const processDragDropFiles = (files) => {
    const batchNameToUse = batchName || `Uploaded on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
    
    // Process files using the existing upload logic
    files.forEach(file => {
      const fileObj = {
        file,
        onSuccess: () => {},
        onError: () => {},
        onProgress: () => {}
      };
      
      // Add to pending files for batch processing
      setPendingFiles(prev => {
        const newFiles = [...prev, fileObj];
        
        // Clear existing timeout
        if (uploadTimeout) {
          clearTimeout(uploadTimeout);
        }
        
        // Set new timeout to upload after 500ms
        const newTimeout = setTimeout(async () => {
          try {
            setUploading(true);
            setUploadProgress(0);

            const progressInterval = setInterval(() => {
              setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 100);

            const filesToUpload = newFiles.map(item => item.file);
            const result = await uploadMultipleFiles(filesToUpload, batchNameToUse);

            clearInterval(progressInterval);
            setUploadProgress(100);

            setUploadedFiles(prev => [...prev, ...newFiles.map(item => ({ ...result, file: item.file }))]);
            
            loadRecentImages();
            setPendingFiles([]);
          } catch (error) {
            console.error('Drag drop upload error:', error);
          } finally {
            setUploading(false);
            setUploadProgress(0);
          }
        }, 500);
        
        setUploadTimeout(newTimeout);
        return newFiles;
      });
    });
  };

  // ==================== EFFECTS ====================
  
  /**
   * Initialize component data when projectId changes
   * Loads available datasets and recent images
   */
  useEffect(() => {
    loadAvailableDatasets();
    loadRecentImages();
  }, [projectId]);

  // ==================== UPLOAD FUNCTIONS ====================

  /**
   * Upload a single file to the project
   * @param {File} file - The file to upload
   * @param {string} batchNameToUse - The batch name for categorization
   * @returns {Promise} Upload result from API
   */
  const uploadFile = async (file, batchNameToUse) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_name', batchNameToUse);
    
    // Add dataset IDs if tags are selected
    if (tags.length > 0) {
      formData.append('dataset_ids', JSON.stringify(tags));
    }

    try {
      const result = await projectsAPI.uploadImagesToProject(projectId, formData);
      message.success(`${file.name} uploaded successfully to "${batchNameToUse}"!`);
      return result;
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to upload ${file.name}: ${errorInfo.message}`);
      console.error('Upload error:', error);
      throw error;
    }
  };

  /**
   * Upload multiple files to the project in a single batch
   * @param {File[]} files - Array of files to upload
   * @param {string} batchNameToUse - The batch name for categorization
   * @returns {Promise} Upload result from API
   */
  const uploadMultipleFiles = async (files, batchNameToUse) => {
    const formData = new FormData();
    
    // Append all files to FormData
    files.forEach(file => {
      formData.append('files', file);
    });
    
    formData.append('batch_name', batchNameToUse);
    
    // Add dataset IDs if tags are selected
    if (tags.length > 0) {
      formData.append('dataset_ids', JSON.stringify(tags));
    }

    try {
      const result = await projectsAPI.uploadMultipleImagesToProject(projectId, formData);
      message.success(`${files.length} files uploaded successfully to "${batchNameToUse}"!`);
      return result;
    } catch (error) {
      const errorInfo = handleAPIError(error);
      message.error(`Failed to upload files: ${errorInfo.message}`);
      throw error;
    }
  };

  // ==================== VIDEO PROCESSING FUNCTIONS ====================

  /**
   * Extract frames from video at specified FPS and format
   * @param {File} videoFile - The video file to process
   * @param {number} fps - Frames per second to extract
   * @param {string} imageFormat - Output image format ('jpeg', 'png', 'webp')
   * @param {number} startFrameIndex - Starting frame number for continuous numbering
   * @returns {Promise<Blob[]>} Array of image blobs
   */
  const extractFramesFromVideo = async (videoFile, fps, imageFormat = 'jpeg', startFrameIndex = 1) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames = [];
      
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const duration = video.duration;
        const interval = 1 / fps; // Time between frames
        let currentTime = 0;
        let frameIndex = 0;
        
        const extractFrame = () => {
          if (currentTime >= duration) {
            resolve(frames);
            return;
          }
          
          video.currentTime = currentTime;
        };
        
        video.onseeked = () => {
          // Draw current frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get file extension and MIME type based on selected format
          const formatConfig = {
            'jpeg': { ext: 'jpg', mime: 'image/jpeg', quality: 0.8 },
            'png': { ext: 'png', mime: 'image/png', quality: 1.0 },
            'webp': { ext: 'webp', mime: 'image/webp', quality: 0.8 }
          };
          
          const config = formatConfig[imageFormat] || formatConfig['jpeg'];
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              // Create a file-like object with continuous frame numbering
              const globalFrameNumber = startFrameIndex + frameIndex;
              const frameFile = new File([blob], `frame_${String(globalFrameNumber).padStart(3, '0')}.${config.ext}`, {
                type: config.mime
              });
              frames.push(frameFile);
            }
            
            frameIndex++;
            currentTime += interval;
            extractFrame();
          }, config.mime, config.quality);
        };
        
        video.onerror = () => {
          reject(new Error('Error processing video'));
        };
        
        extractFrame();
      };
      
      video.onloadeddata = () => {
        // Video is ready
      };
      
      video.onerror = () => {
        reject(new Error('Error loading video'));
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  /**
   * Handle video file selection (single or multiple)
   */
  const handleVideoSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,.mov,.avi,video/*';
    input.multiple = true; // Allow multiple video selection
    
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      // Validate all video files
      const validVideos = [];
      for (const file of files) {
        if (!file.type.startsWith('video/')) {
          message.error(`${file.name} is not a valid video file`);
          continue;
        }
        
        // Check file size (1GB limit for videos)
        const isLt1GB = file.size / 1024 / 1024 < 1024;
        if (!isLt1GB) {
          message.error(`${file.name} must be smaller than 1GB!`);
          continue;
        }
        
        validVideos.push(file);
      }
      
      if (validVideos.length > 0) {
        // Always store as array for consistent handling
        setVideoFile(validVideos);
        message.success(`${validVideos.length} video file(s) selected`);
      }
    };
    
    input.click();
  };

  /**
   * Handle video folder selection
   */
  const handleVideoFolderSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,.mov,.avi,video/*';
    input.webkitdirectory = true; // Enable folder selection
    input.directory = true;
    input.mozdirectory = true;
    input.multiple = true;
    
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      // Filter and validate video files
      const validVideos = [];
      for (const file of files) {
        if (!file.type.startsWith('video/')) {
          continue; // Skip non-video files silently
        }
        
        // Check file size (1GB limit for videos)
        const isLt1GB = file.size / 1024 / 1024 < 1024;
        if (!isLt1GB) {
          message.error(`${file.name} must be smaller than 1GB!`);
          continue;
        }
        
        validVideos.push(file);
      }
      
      if (validVideos.length > 0) {
        // Store videos with folder info
        setVideoFile(validVideos);
        
        // Extract folder name from first file's path
        const firstFile = validVideos[0];
        const pathParts = firstFile.webkitRelativePath.split('/');
        const folderName = pathParts[0] || 'VideoFolder';
        
        message.success(`${validVideos.length} video file(s) selected from folder "${folderName}"`);
      } else {
        message.warning('No valid video files found in the selected folder');
      }
    };
    
    input.click();
  };

  /**
   * Process video upload with selected FPS (supports multiple videos)
   */
  const processVideoUpload = async () => {
    if (!videoFile || !Array.isArray(videoFile) || videoFile.length === 0 || !selectedFPS) {
      message.error('Please select video file(s) and FPS');
      return;
    }
    
    setVideoProcessing(true);
    
    try {
      const totalVideos = videoFile.length;
      let totalFramesExtracted = 0;
      
      message.info(`Processing ${totalVideos} video file(s)...`);
      
      // Determine if videos are from a folder (check if first video has webkitRelativePath)
      const isFromFolder = videoFile[0].webkitRelativePath && videoFile[0].webkitRelativePath.includes('/');
      let folderName = null;
      
      if (isFromFolder) {
        // Extract folder name from first file's path
        const pathParts = videoFile[0].webkitRelativePath.split('/');
        folderName = pathParts[0] || 'VideoFolder';
      }
      
      // Create batch name based on context
      let batchNameToUse;
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      
      if (batchName) {
        // User provided custom batch name
        batchNameToUse = batchName;
      } else if (isFromFolder && totalVideos > 1) {
        // Multiple videos from folder - use folder name
        batchNameToUse = `${folderName}_${selectedFPS}fps_${selectedImageFormat}_${timestamp}`;
      } else if (totalVideos > 1) {
        // Multiple individual videos - use generic name
        batchNameToUse = `Filmati_${selectedFPS}fps_${selectedImageFormat}_${timestamp}`;
      } else {
        // Single video - use video name
        const videoName = videoFile[0].name.replace(/\.[^/.]+$/, ''); // Remove extension
        batchNameToUse = `Video_${videoName}_${selectedFPS}fps_${selectedImageFormat}_${timestamp}`;
      }

      // Collect all frames from all videos with continuous numbering
      const allFrames = [];
      let globalFrameIndex = 1;

      // Process each video sequentially
      for (let i = 0; i < videoFile.length; i++) {
        const currentVideo = videoFile[i];
        const videoNumber = i + 1;
        
        message.info(`Extracting frames from video ${videoNumber}/${totalVideos}: ${currentVideo.name}`);
        
        // Extract frames from current video with continuous numbering
        const frames = await extractFramesFromVideo(currentVideo, selectedFPS, selectedImageFormat, globalFrameIndex);
        
        if (frames.length === 0) {
          message.warning(`No frames could be extracted from ${currentVideo.name}`);
          continue;
        }
        
        allFrames.push(...frames);
        globalFrameIndex += frames.length;
        totalFramesExtracted += frames.length;
        
        message.success(`✓ Processed ${currentVideo.name}: ${frames.length} frames extracted`);
      }

      // Upload all frames at once with continuous numbering
      if (allFrames.length > 0) {
        message.info(`Uploading ${allFrames.length} total frames with continuous numbering to "${batchNameToUse}"...`);
        await uploadMultipleFiles(allFrames, batchNameToUse);
        message.success(`✓ All frames uploaded to "${batchNameToUse}"`);
      }
      
      message.success(`Successfully processed ${totalVideos} video(s) and uploaded ${totalFramesExtracted} total frames!`);
      
      // Refresh recent images
      loadRecentImages();
      
      // Reset video upload state
      setVideoFile(null);
      setExtractedFrames([]);
      
    } catch (error) {
      console.error('Video processing error:', error);
      message.error(`Failed to process videos: ${error.message}`);
    } finally {
      setVideoProcessing(false);
    }
  };

  // ==================== UPLOAD CONFIGURATION ====================
  
  /**
   * Configuration object for Ant Design Dragger component
   * Handles drag & drop uploads with batch name modal integration
   */
  const uploadProps = {
    name: 'file',
    multiple: true,
    
    /**
     * Custom upload handler for drag & drop files
     * Shows batch name modal if no tags are selected and no batch name is set
     */
    customRequest: async ({ file, onSuccess, onError, onProgress }) => {
      // Check if we need to show batch name modal for drag & drop
      if (tags.length === 0 && !batchName.trim()) {
        // Store the file and show batch name modal
        setPendingFiles([{ file, onSuccess, onError, onProgress }]);
        setBatchNameModalVisible(true);
        return;
      }

      try {
        // Create a batch name if not provided (fallback for tagged uploads)
        const batchNameToUse = batchName || `Uploaded on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
        
        // Simulate progress for better UX
        let percent = 0;
        const interval = setInterval(() => {
          percent = Math.min(99, percent + 10);
          onProgress({ percent });
        }, 200);
        
        // Upload the file using our upload function
        await uploadFile(file, batchNameToUse);
        
        // Complete the progress and notify success
        clearInterval(interval);
        onProgress({ percent: 100 });
        onSuccess("ok", null);
        
        // Refresh recent images display
        loadRecentImages();
      } catch (error) {
        onError(error);
      }
    },
    
    /**
     * Handle upload status changes and update UI accordingly
     */
    onChange(info) {
      const { status } = info.file;
      
      // Show success/error messages
      if (status === 'done') {
        message.success(`${info.file.name} file uploaded successfully.`);
      } else if (status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
      
      // Update uploaded files list for display
      setUploadedFiles(prevFiles => {
        const newFiles = [...prevFiles, { file: info.file, status }];
        
        // Reset progress after a delay for visual feedback
        if (uploadTimeout) {
          clearTimeout(uploadTimeout);
        }
        
        const newTimeout = setTimeout(() => {
          if (status === 'done' || status === 'error') {
            setUploadProgress(0);
          }
        }, 500);
        
        setUploadTimeout(newTimeout);
        return newFiles;
      });
    },
    
    // File type restrictions
    accept: 'image/*,.jpg,.jpeg,.png,.bmp,.webp,.avif',
    
    /**
     * Validate files before upload
     * Checks file type and size constraints
     */
    beforeUpload: (file) => {
      // Check if file is an image
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error(`${file.name} is not an image file`);
        return false;
      }
      
      // Check file size (20MB limit)
      const isLt20M = file.size / 1024 / 1024 < 20;
      if (!isLt20M) {
        message.error(`${file.name} must be smaller than 20MB!`);
        return false;
      }
      
      return true;
    },
    
    // Upload list display configuration
    showUploadList: {
      showPreviewIcon: true,
      showRemoveIcon: true,
      showDownloadIcon: false,
    },
  };

  // ==================== RENDER ====================
  
  return (
    <div style={{ padding: '24px' }}>
      {/* ==================== HEADER SECTION ==================== */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, marginBottom: '8px' }}>
          <UploadOutlined style={{ marginRight: '8px' }} />
          Upload
        </Title>
      </div>

      {/* ==================== BATCH NAME & TAGS CONFIGURATION ==================== */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          {/* Batch Name Input */}
          <Col span={12}>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Batch Name:</Text>
            </div>
            <Input 
              placeholder={`Uploaded on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`}
              value={batchName}
              onChange={(e) => {
                setBatchName(e.target.value);
                // Clear tags when batch name is entered (mutual exclusivity)
                if (e.target.value.trim() && tags.length > 0) {
                  setTags([]);
                }
              }}
              disabled={tags.length > 0} // Disabled when tags are selected
              style={{ 
                marginBottom: '16px',
                opacity: tags.length > 0 ? 0.6 : 1
              }}
            />
          </Col>
          
          {/* Tags/Dataset Selection */}
          <Col span={12}>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Tags:</Text>
              <Text type="secondary" style={{ marginLeft: '8px' }}>
                <SettingOutlined />
              </Text>
            </div>
            <Select
              mode="multiple"
              style={{ 
                width: '100%',
                opacity: batchName.trim() ? 0.6 : 1
              }}
              placeholder="Select existing dataset or leave empty for new batch..."
              value={tags}
              onChange={(selectedTags) => {
                setTags(selectedTags);
                // Clear batch name when tags are selected (mutual exclusivity)
                if (selectedTags.length > 0 && batchName.trim()) {
                  setBatchName('');
                }
              }}
              options={availableDatasets}
              allowClear
              disabled={batchName.trim() !== ''} // Disabled when batch name is entered
            />
          </Col>
        </Row>
      </Card>

      {/* ==================== UPLOAD AREA ==================== */}
      <Card>
        {/* Drag & Drop Upload Area */}
        <Dragger {...uploadProps} style={{ marginBottom: '16px' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: '18px', fontWeight: 500 }}>
            Drag and drop file(s) to upload, or:
          </p>
        </Dragger>
        
        {/* Upload Buttons */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Button 
            type="primary" 
            icon={<FolderOutlined />} 
            style={{ marginRight: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              handleFileSelect(); // Shows batch name modal first if no tags
            }}
          >
            Select File(s)
          </Button>
          <Button 
            icon={<FolderOutlined />}
            style={{ marginRight: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              handleFolderSelect(); // Uses folder name as batch name
            }}
          >
            Select Folder
          </Button>
        </div>

        {/* Video FPS Selection - Shows when video is selected */}
        {videoFile && Array.isArray(videoFile) && videoFile.length > 0 && (
          <div style={{ 
            marginBottom: '24px', 
            padding: '16px', 
            backgroundColor: '#f6f6f6', 
            borderRadius: '8px',
            border: '1px solid #d9d9d9'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <Text strong>Selected Video{videoFile.length > 1 ? 's' : ''}: </Text>
              {videoFile.length === 1 ? (
                <Text>{videoFile[0].name}</Text>
              ) : (
                <div style={{ marginTop: '8px' }}>
                  <Text>{videoFile.length} videos selected</Text>
                  <div style={{ marginTop: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                    {videoFile.map((video, index) => (
                      <div key={index} style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                        {index + 1}. {video.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <Row gutter={16} style={{ marginBottom: '12px' }}>
              <Col span={12}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Extract frames every:</Text>
                </div>
                <Select
                  value={selectedFPS}
                  onChange={setSelectedFPS}
                  style={{ width: '100%' }}
                  size="large"
                >
                  <Option value={1}>1 frame per second (1 FPS)</Option>
                  <Option value={2}>2 frames per second (2 FPS)</Option>
                  <Option value={5}>5 frames per second (5 FPS)</Option>
                  <Option value={10}>10 frames per second (10 FPS)</Option>
                  <Option value={30}>30 frames per second (30 FPS)</Option>
                </Select>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Output image format:</Text>
                </div>
                <Select
                  value={selectedImageFormat}
                  onChange={setSelectedImageFormat}
                  style={{ width: '100%' }}
                  size="large"
                >
                  <Option value="jpeg">JPEG (.jpg) - Smaller size, good quality</Option>
                  <Option value="png">PNG (.png) - Lossless, larger size</Option>
                  <Option value="webp">WebP (.webp) - Modern, efficient</Option>
                </Select>
              </Col>
            </Row>
            
            <Row gutter={16} align="middle">
              <Col span={24} style={{ textAlign: 'center' }}>
                <Space>
                  <Button 
                    type="primary" 
                    loading={videoProcessing}
                    onClick={processVideoUpload}
                    style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                  >
                    {videoProcessing ? 'Processing...' : 'Extract Frames'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setVideoFile(null);
                      setExtractedFrames([]);
                    }}
                  >
                    Cancel
                  </Button>
                </Space>
              </Col>
            </Row>
            
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>Note:</strong> Higher FPS will extract more frames. JPEG offers smaller files, PNG preserves quality, WebP provides modern compression. For most use cases, 2-5 FPS with JPEG format provides good coverage.
              </Text>
            </div>
          </div>
        )}
          
          {/* ==================== HIDDEN FILE INPUTS ==================== */}
          
          {/* Hidden input for file selection */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            accept="image/*,.jpg,.jpeg,.png,.bmp,.webp,.avif"
            onChange={async (e) => {
              const files = Array.from(e.target.files);
              if (files.length === 0) return;

              setUploading(true);
              const batchNameToUse = batchName || `Uploaded on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
              
              try {
                // Use bulk upload for multiple files, single upload for one file
                if (files.length > 1) {
                  await uploadMultipleFiles(files, batchNameToUse);
                } else {
                  // For single file, use the uploadFile function
                  for (const file of files) {
                    await uploadFile(file, batchNameToUse);
                  }
                }
                
                // Refresh UI after successful upload
                loadRecentImages();
                message.success(`${files.length} file(s) uploaded successfully to "${batchNameToUse}"!`);
              } catch (error) {
                console.error('Batch upload error:', error);
              } finally {
                setUploading(false);
                // Clear the input value to allow re-uploading the same file
                e.target.value = '';
              }
            }}
          />
          
          {/* Hidden input for folder selection */}
          <input
            type="file"
            ref={folderInputRef}
            style={{ display: 'none' }}
            webkitdirectory="" // Enable folder selection
            directory=""
            mozdirectory=""
            multiple
            accept=".jpg,.jpeg,.png,.bmp,.webp,.avif"
            onChange={async (e) => {
              const files = Array.from(e.target.files);
              if (files.length === 0) return;

              // Extract folder name from the first file's path
              const firstFile = files[0];
              const pathParts = firstFile.webkitRelativePath.split('/');
              const folderName = pathParts[0] || `Folder_${new Date().toLocaleDateString()}`;
              
              setUploading(true);
              
              try {
                // Upload all files in the folder using folder name as batch name
                for (const file of files) {
                  await uploadFile(file, folderName);
                }
                
                // Refresh UI after successful upload
                loadRecentImages();
                message.success(`${files.length} file(s) uploaded successfully to "${folderName}"!`);
              } catch (error) {
                console.error('Folder upload error:', error);
              } finally {
                setUploading(false);
                // Clear the input value to allow re-uploading the same folder
                e.target.value = '';
              }
            }}
          />
        
        {/* ==================== SUPPORTED FORMATS SECTION ==================== */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={4} style={{ color: '#666' }}>Supported Formats</Title>
          <Row gutter={[24, 16]} justify="center">
            {/* Images Format */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <PictureOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Images</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .jpg, .jpeg, .png, .bmp, .webp, .avif
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Common image formats
                  </Text>
                </div>
              </div>
            </Col>
            
            {/* Annotations Format */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <TagOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Annotations</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .json, .xml, .txt
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Label files
                  </Text>
                </div>
              </div>
            </Col>
            
            {/* Videos Format */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <YoutubeOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Videos</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    .mp4, .mov, .avi
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Video files
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            (Max size of 20MB and 16,000 pixels for images).
          </Text>
        </div>

        <Divider />

        {/* ==================== ADDITIONAL UPLOAD OPTIONS ==================== */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={5}>Need images to get started? We've got you covered.</Title>
          
          {/* Video Upload Section */}
          <Card size="small" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <YoutubeOutlined style={{ fontSize: '20px', color: '#722ed1', marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <Text strong>Upload Videos and Extract Frames</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Upload single/multiple .mp4, .mov, or .avi files or select a folder containing videos
                </Text>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button 
                type="primary" 
                icon={<YoutubeOutlined />}
                loading={videoProcessing}
                onClick={handleVideoSelect}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
              >
                {videoProcessing ? 'Processing...' : 'Select Video File(s)'}
              </Button>
              <Button 
                icon={<FolderOutlined />}
                loading={videoProcessing}
                onClick={handleVideoFolderSelect}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', color: 'white' }}
              >
                {videoProcessing ? 'Processing...' : 'Select Video Folder'}
              </Button>
              {videoFile && Array.isArray(videoFile) && videoFile.length > 0 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Selected: {videoFile.length} video{videoFile.length > 1 ? 's' : ''}
                </Text>
              )}
            </div>
          </Card>

          {/* YouTube Video Import */}
          <Card size="small" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <YoutubeOutlined style={{ fontSize: '20px', color: '#ff4d4f', marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <Text strong>Import YouTube Video</Text>
              </div>
            </div>
            <Input 
              placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              suffix={<Button type="primary" size="small">→</Button>}
              style={{ marginTop: '12px' }}
            />
          </Card>

          {/* API and Cloud Provider Options */}
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ApiOutlined style={{ fontSize: '20px', color: '#1890ff', marginRight: '12px' }} />
                  <Text strong>Collect Images via the Upload API</Text>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CloudOutlined style={{ fontSize: '20px', color: '#52c41a', marginRight: '12px' }} />
                  <Text strong>Import From Cloud Providers</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>

      {/* ==================== UPLOAD STATUS & PROGRESS ==================== */}
      {(uploading || uploadedFiles.length > 0 || recentImages.length > 0) && (
        <Card title="Upload Status" style={{ marginTop: '24px' }}>
          {/* Upload Progress Bar */}
          {uploading && (
            <div style={{ marginBottom: '16px' }}>
              <Text>Uploading files...</Text>
              <Progress percent={uploadProgress} status="active" />
            </div>
          )}
          
          {/* Recently Uploaded Files Display */}
          {(uploadedFiles.length > 0 || recentImages.length > 0) && (
            <div>
              <Title level={5}>Recently Uploaded ({recentImages.length || uploadedFiles.length} files)</Title>
              <Row gutter={[16, 16]}>
                {/* Display recent images or uploaded files (max 6) */}
                {(recentImages.length > 0 ? recentImages : uploadedFiles.slice(-6)).map((fileInfo, index) => (
                  <Col span={4} key={index}>
                    <Card
                      size="small"
                      cover={
                        <div style={{ 
                          height: '80px', 
                          background: '#f5f5f5', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          {/* Show thumbnail if available, otherwise show placeholder icon */}
                          {fileInfo.thumbnail_url ? (
                            <img 
                              src={fileInfo.thumbnail_url} 
                              alt={fileInfo.filename || 'Image'} 
                              style={{ maxHeight: '80px', maxWidth: '100%' }}
                            />
                          ) : (
                            <PictureOutlined style={{ fontSize: '24px', color: '#999' }} />
                          )}
                        </div>
                      }
                    >
                      <Card.Meta 
                        title={
                          <Text ellipsis style={{ fontSize: '12px' }}>
                            {fileInfo.filename || fileInfo.file?.name || 'Unknown'}
                          </Text>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {fileInfo.file?.size ? `${(fileInfo.file.size / 1024).toFixed(1)} KB` : ''}
                          </Text>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
              
              {/* Show "View all" button if more than 6 files */}
              {(recentImages.length > 6 || uploadedFiles.length > 6) && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Button type="link">
                    View all {recentImages.length || uploadedFiles.length} uploaded files
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ==================== BATCH NAME MODAL ==================== */}
      <Modal
        title="Enter Batch Name"
        open={batchNameModalVisible}
        onOk={handleBatchNameConfirm}
        onCancel={() => {
          setBatchNameModalVisible(false);
          setBatchName('');
          setPendingFiles([]); // Clear any pending files
        }}
        okText="Continue"
        cancelText="Cancel"
      >
        <Input
          placeholder="Enter batch name for uploaded files"
          value={batchName}
          onChange={(e) => setBatchName(e.target.value)}
          onPressEnter={handleBatchNameConfirm} // Allow Enter key to confirm
          autoFocus // Auto-focus on modal open
        />
      </Modal>
    </div>
  );
};

export default UploadSection;
