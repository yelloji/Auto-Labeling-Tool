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
import ImportWithLabelsSection from './ImportWithLabelsSection';
import {
  Typography,
  Card,
  Button,
  Input,
  Select,
  Row,
  Col,
  Divider,
  Progress,
  message,
  Space,
  Modal,
  Tag,
  Collapse,
  Alert
} from 'antd';
import {
  UploadOutlined,
  PictureOutlined,
  DatabaseOutlined,
  TagOutlined,
  FolderOutlined,
  YoutubeOutlined,
  ApiOutlined,
  CloudOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { projectsAPI, datasetsAPI, handleAPIError } from '../../../services/api';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const { Title, Text, Paragraph } = Typography;
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
  const [tagWarning, setTagWarning] = useState(null); // Warning when selected dataset is not in unassigned stage

  // Upload management
  const [uploading, setUploading] = useState(false); // Upload in progress flag

  // Data and UI state
  const [availableDatasets, setAvailableDatasets] = useState([]); // Available datasets for tagging
  const [recentImages, setRecentImages] = useState([]); // Recently uploaded images for display
  const [batchNameModalVisible, setBatchNameModalVisible] = useState(false); // Modal visibility state

  // Upload type and file handling
  const [uploadType, setUploadType] = useState('files'); // Current upload type: 'files' or 'folder'
  const [uploadResult, setUploadResult] = useState(null); // Result of last bulk upload for inline display

  // Video upload state
  const [videoFile, setVideoFile] = useState(null); // Selected video file
  const [selectedFPS, setSelectedFPS] = useState(2); // Selected frames per second
  const [selectedImageFormat, setSelectedImageFormat] = useState('jpeg'); // Selected output image format
  const [videoProcessing, setVideoProcessing] = useState(false); // Video processing status
  const [extractedFrames, setExtractedFrames] = useState([]); // Extracted image frames

  // ==================== REFS ====================
  const fileInputRef = useRef(null); // Reference to hidden file input element
  const folderInputRef = useRef(null); // Reference to hidden folder input element
  const importLabelsRef = useRef(null); // Reference to ImportWithLabelsSection

  // ==================== COMPONENT INITIALIZATION ====================

  useEffect(() => {
    // Validate project ID
    if (!projectId) {
      logError('app.frontend.validation', 'upload_section_invalid_project_id', 'UploadSection validation failed: invalid project ID', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        validationType: 'invalid_project_id'
      });
      return;
    }

    logInfo('app.frontend.ui', 'upload_section_initialized', 'UploadSection component initialized', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    loadAvailableDatasets();
    loadRecentImages();
  }, [projectId]);

  // ==================== API FUNCTIONS ====================

  /**
   * Load available datasets for the project to populate the tags dropdown
   * Fetches datasets from the backend and formats them for Select component
   */
  const loadAvailableDatasets = async () => {
    logInfo('app.frontend.interactions', 'load_datasets_started', 'Started loading available datasets', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    try {
      const response = await projectsAPI.getProjectDatasets(projectId);
      const datasets = response.datasets || response || [];
      const options = datasets.map(dataset => ({
        value: dataset.id,
        label: dataset.name,
        split_type: dataset.split_type
      }));
      setAvailableDatasets(options);

      logInfo('app.frontend.interactions', 'load_datasets_success', 'Successfully loaded available datasets', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        datasetCount: options.length
      });
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.interactions', 'load_datasets_failed', 'Failed to load available datasets', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        error: errorInfo.message
      });
      message.error(`Failed to load datasets: ${errorInfo.message}`);
    }
  };

  /**
   * Load recent images for the project to display in the upload status section
   * Shows the last 6 uploaded images with thumbnails
   */
  const loadRecentImages = async () => {
    logInfo('app.frontend.interactions', 'load_recent_images_started', 'Started loading recent images', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    try {
      const images = await projectsAPI.getRecentImages(projectId, 6);
      setRecentImages(images);

      logInfo('app.frontend.interactions', 'load_recent_images_success', 'Successfully loaded recent images', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        imageCount: images.length
      });
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.interactions', 'load_recent_images_failed', 'Failed to load recent images', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        error: errorInfo.message
      });
      console.error('Failed to load recent images:', errorInfo);
    }
  };

  // ==================== EVENT HANDLERS ====================

  /**
   * Handle file selection button click
   * Shows batch name modal if no tags are selected, otherwise opens file dialog directly
   */
  const handleFileSelect = () => {
    logUserClick('file_select_button_clicked', 'User clicked file select button');
    logInfo('app.frontend.interactions', 'file_selection_triggered', 'File selection triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      uploadType: 'files',
      tagsSelected: tags.length > 0
    });

    setUploadType('files');
    // Only show batch name modal if no tags are selected
    if (tags.length === 0) {
      setBatchNameModalVisible(true);
      logInfo('app.frontend.ui', 'batch_name_modal_opened', 'Batch name modal opened for file selection', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        reason: 'no_tags_selected'
      });
    } else {
      // Tags are selected, proceed directly to file selection
      logInfo('app.frontend.interactions', 'file_dialog_opened', 'File dialog opened directly (tags selected)', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        selectedTags: tags
      });
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
    logUserClick('folder_select_button_clicked', 'User clicked folder select button');
    logInfo('app.frontend.interactions', 'folder_selection_triggered', 'Folder selection triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      uploadType: 'folder'
    });

    setUploadType('folder');
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  /**
   * Handle batch name confirmation from modal
   * Validates batch name and opens file dialog
   */
  const handleBatchNameConfirm = () => {
    logUserClick('batch_name_confirm_button_clicked', 'User clicked batch name confirm button');

    if (!batchName.trim()) {
      logError('app.frontend.validation', 'batch_name_empty', 'Batch name validation failed: empty name', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        batchName: batchName,
        validationType: 'empty_batch_name'
      });
      message.error('Batch name cannot be empty');
      return;
    }

    logInfo('app.frontend.interactions', 'batch_name_confirmed', 'Batch name confirmed', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      batchName: batchName
    });

    setBatchNameModalVisible(false);

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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
    // Validate file
    if (!file) {
      logError('app.frontend.validation', 'upload_file_invalid_file', 'File upload validation failed: invalid file', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        batchName: batchNameToUse,
        validationType: 'invalid_file'
      });
      throw new Error('Invalid file');
    }

    logInfo('app.frontend.interactions', 'single_file_upload_started', 'Started single file upload', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      batchName: batchNameToUse,
      tagsSelected: tags.length > 0
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_name', batchNameToUse);

    // Add dataset IDs if tags are selected
    if (tags.length > 0) {
      formData.append('dataset_ids', JSON.stringify(tags));
    }

    try {
      const result = await projectsAPI.uploadImagesToProject(projectId, formData);

      logInfo('app.frontend.interactions', 'single_file_upload_success', 'Single file upload successful', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        fileName: file.name,
        batchName: batchNameToUse,
        result: result
      });

      return result;
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.interactions', 'single_file_upload_failed', 'Single file upload failed', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        fileName: file.name,
        batchName: batchNameToUse,
        error: errorInfo.message
      });
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
    // Validate files array
    if (!files || files.length === 0) {
      logError('app.frontend.validation', 'upload_multiple_files_invalid', 'Multiple files upload validation failed: invalid files array', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        batchName: batchNameToUse,
        filesCount: files?.length || 0,
        validationType: 'invalid_files_array'
      });
      throw new Error('Invalid files array');
    }

    logInfo('app.frontend.interactions', 'multiple_files_upload_started', 'Started multiple files upload', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      filesCount: files.length,
      fileNames: files.map(f => f.name),
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      batchName: batchNameToUse,
      tagsSelected: tags.length > 0
    });

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

      logInfo('app.frontend.interactions', 'multiple_files_upload_success', 'Multiple files upload successful', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        filesCount: files.length,
        batchName: batchNameToUse,
        result: result
      });

      return result;
    } catch (error) {
      const errorInfo = handleAPIError(error);
      logError('app.frontend.interactions', 'multiple_files_upload_failed', 'Multiple files upload failed', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        filesCount: files.length,
        batchName: batchNameToUse,
        error: errorInfo.message
      });
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
    logUserClick('video_select_button_clicked', 'User clicked video select button');
    logInfo('app.frontend.interactions', 'video_selection_triggered', 'Video selection triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,.mov,.avi,video/*';
    input.multiple = true; // Allow multiple video selection

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) {
        logInfo('app.frontend.interactions', 'video_selection_cancelled', 'Video selection cancelled by user', {
          timestamp: new Date().toISOString(),
          projectId: projectId
        });
        return;
      }

      logInfo('app.frontend.interactions', 'video_files_selected', 'Video files selected', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        filesCount: files.length,
        fileNames: files.map(f => f.name)
      });

      // Validate all video files
      const validVideos = [];
      const invalidFiles = [];

      for (const file of files) {
        if (!file.type.startsWith('video/')) {
          logError('app.frontend.validation', 'video_file_invalid_type', 'Video file validation failed: invalid file type', {
            timestamp: new Date().toISOString(),
            projectId: projectId,
            fileName: file.name,
            fileType: file.type,
            validationType: 'invalid_file_type'
          });
          message.error(`${file.name} is not a valid video file`);
          invalidFiles.push({ file, reason: 'invalid_type' });
          continue;
        }

        // Check file size (1GB limit for videos)
        const isLt1GB = file.size / 1024 / 1024 < 1024;
        if (!isLt1GB) {
          logError('app.frontend.validation', 'video_file_too_large', 'Video file validation failed: file too large', {
            timestamp: new Date().toISOString(),
            projectId: projectId,
            fileName: file.name,
            fileSize: file.size,
            fileSizeMB: file.size / 1024 / 1024,
            validationType: 'file_too_large'
          });
          message.error(`${file.name} must be smaller than 1GB!`);
          invalidFiles.push({ file, reason: 'too_large' });
          continue;
        }

        validVideos.push(file);
      }

      if (validVideos.length > 0) {
        // Always store as array for consistent handling
        setVideoFile(validVideos);
        message.success(`${validVideos.length} video file(s) selected`);

        logInfo('app.frontend.interactions', 'video_files_validated', 'Video files validated successfully', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          validCount: validVideos.length,
          invalidCount: invalidFiles.length,
          validFileNames: validVideos.map(f => f.name)
        });
      } else {
        logError('app.frontend.validation', 'no_valid_video_files', 'No valid video files found', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          totalFiles: files.length,
          invalidFiles: invalidFiles.map(f => ({ name: f.file.name, reason: f.reason }))
        });
      }
    };

    input.click();
  };

  /**
   * Handle video folder selection
   */
  const handleVideoFolderSelect = () => {
    logUserClick('video_folder_select_button_clicked', 'User clicked video folder select button');
    logInfo('app.frontend.interactions', 'video_folder_selection_triggered', 'Video folder selection triggered', {
      timestamp: new Date().toISOString(),
      projectId: projectId
    });

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,.mov,.avi,video/*';
    input.webkitdirectory = true; // Enable folder selection
    input.directory = true;
    input.mozdirectory = true;
    input.multiple = true;

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) {
        logInfo('app.frontend.interactions', 'video_folder_selection_cancelled', 'Video folder selection cancelled by user', {
          timestamp: new Date().toISOString(),
          projectId: projectId
        });
        return;
      }

      logInfo('app.frontend.interactions', 'video_folder_files_selected', 'Video folder files selected', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        totalFiles: files.length,
        fileNames: files.map(f => f.name)
      });

      // Filter and validate video files
      const validVideos = [];
      const invalidFiles = [];

      for (const file of files) {
        if (!file.type.startsWith('video/')) {
          logInfo('app.frontend.interactions', 'video_folder_non_video_skipped', 'Non-video file skipped in folder selection', {
            timestamp: new Date().toISOString(),
            projectId: projectId,
            fileName: file.name,
            fileType: file.type
          });
          continue; // Skip non-video files silently
        }

        // Check file size (1GB limit for videos)
        const isLt1GB = file.size / 1024 / 1024 < 1024;
        if (!isLt1GB) {
          logError('app.frontend.validation', 'video_folder_file_too_large', 'Video folder file validation failed: file too large', {
            timestamp: new Date().toISOString(),
            projectId: projectId,
            fileName: file.name,
            fileSize: file.size,
            fileSizeMB: file.size / 1024 / 1024,
            validationType: 'file_too_large'
          });
          message.error(`${file.name} must be smaller than 1GB!`);
          invalidFiles.push({ file, reason: 'too_large' });
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

        logInfo('app.frontend.interactions', 'video_folder_files_validated', 'Video folder files validated successfully', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          validCount: validVideos.length,
          invalidCount: invalidFiles.length,
          folderName: folderName,
          validFileNames: validVideos.map(f => f.name)
        });
      } else {
        logError('app.frontend.validation', 'video_folder_no_valid_files', 'No valid video files found in folder', {
          timestamp: new Date().toISOString(),
          projectId: projectId,
          totalFiles: files.length,
          invalidFiles: invalidFiles.map(f => ({ name: f.file.name, reason: f.reason }))
        });
        message.warning('No valid video files found in the selected folder');
      }
    };

    input.click();
  };

  /**
   * Process video upload with selected FPS (supports multiple videos)
   */
  const processVideoUpload = async () => {
    logUserClick('process_video_upload_button_clicked', 'User clicked process video upload button');

    // Validate video processing parameters
    if (!videoFile || !Array.isArray(videoFile) || videoFile.length === 0) {
      logError('app.frontend.validation', 'video_processing_no_video_selected', 'Video processing validation failed: no video selected', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        validationType: 'no_video_selected'
      });
      message.error('Please select video file(s) and FPS');
      return;
    }

    if (!selectedFPS) {
      logError('app.frontend.validation', 'video_processing_no_fps_selected', 'Video processing validation failed: no FPS selected', {
        timestamp: new Date().toISOString(),
        projectId: projectId,
        validationType: 'no_fps_selected'
      });
      message.error('Please select video file(s) and FPS');
      return;
    }

    logInfo('app.frontend.interactions', 'video_processing_started', 'Video processing started', {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      videoCount: videoFile.length,
      selectedFPS: selectedFPS,
      selectedImageFormat: selectedImageFormat,
      videoNames: videoFile.map(v => v.name)
    });

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


  // ==================== RENDER ====================

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'upload_section_rendered', 'UploadSection component rendered', {
    timestamp: new Date().toISOString(),
    projectId: projectId,
    uploading: uploading,
    videoProcessing: videoProcessing,
    batchNameModalVisible: batchNameModalVisible
  });

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* ==================== HEADER SECTION ==================== */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Title level={2} style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.5rem', color: '#1890ff' }}>
          <UploadOutlined style={{ marginRight: '0.5rem', fontSize: '1.5rem' }} />
          Upload
        </Title>
      </div>

      {/* ==================== BATCH NAME & TAGS CONFIGURATION ==================== */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <Row gutter={['1rem', '1rem']}>
          {/* Batch Name Input */}
          <Col span={12}>
            <div style={{ marginBottom: '1rem' }}>
              <Text strong style={{ fontSize: '0.875rem' }}>Batch Name:</Text>
            </div>
            <Input
              placeholder={`Uploaded on ${new Date().toISOString().slice(0,10)}`}
              value={batchName}
              onChange={(e) => {
                const newBatchName = e.target.value;
                setBatchName(newBatchName);

                logInfo('app.frontend.ui', 'batch_name_changed', 'Batch name input changed', {
                  timestamp: new Date().toISOString(),
                  projectId: projectId,
                  newBatchName: newBatchName,
                  previousTagsCount: tags.length
                });

                // Clear tags when batch name is entered (mutual exclusivity)
                if (newBatchName.trim() && tags.length > 0) {
                  logInfo('app.frontend.ui', 'tags_cleared_for_batch_name', 'Tags cleared due to batch name entry', {
                    timestamp: new Date().toISOString(),
                    projectId: projectId,
                    clearedTags: tags
                  });
                  setTags([]);
                }
              }}
              disabled={tags.length > 0} // Disabled when tags are selected
              style={{
                marginBottom: '1rem',
                opacity: tags.length > 0 ? 0.6 : 1,
                fontSize: '0.875rem',
                height: '2rem'
              }}
            />
          </Col>

          {/* Tags/Dataset Selection */}
          <Col span={12}>
            <div style={{ marginBottom: '1rem' }}>
              <Text strong style={{ fontSize: '0.875rem' }}>Tags:</Text>
              <Text type="secondary" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                <SettingOutlined />
              </Text>
            </div>
            <Select
              mode="multiple"
              style={{
                width: '100%',
                opacity: batchName.trim() ? 0.6 : 1,
                minHeight: '2.25rem',
                fontSize: '0.875rem'
              }}
              className="vector-select"
              popupClassName="vector-select-dropdown"
              placeholder="Select existing dataset or leave empty for new batch..."
              value={tags}
              onChange={(selectedTags) => {
                setTags(selectedTags);
                setTagWarning(null);

                logInfo('app.frontend.ui', 'tags_selection_changed', 'Tags selection changed', {
                  timestamp: new Date().toISOString(),
                  projectId: projectId,
                  selectedTags: selectedTags,
                  previousBatchName: batchName
                });

                // Check if selected dataset is not in unassigned stage
                if (selectedTags.length > 0) {
                  const selectedDataset = availableDatasets.find(d => d.value === selectedTags[selectedTags.length - 1]);
                  if (selectedDataset && selectedDataset.split_type && selectedDataset.split_type !== 'unassigned') {
                    setTagWarning(`"${selectedDataset.label}" is currently in the "${selectedDataset.split_type}" stage. Move it back to Unassigned before adding new images.`);
                  }
                }

                // Clear batch name when tags are selected (mutual exclusivity)
                if (selectedTags.length > 0 && batchName.trim()) {
                  logInfo('app.frontend.ui', 'batch_name_cleared_for_tags', 'Batch name cleared due to tags selection', {
                    timestamp: new Date().toISOString(),
                    projectId: projectId,
                    clearedBatchName: batchName,
                    selectedTags: selectedTags
                  });
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

      {/* Tag stage warning */}
      {tagWarning && (
        <Alert
          type="warning"
          showIcon
          message={tagWarning}
          style={{ marginBottom: '1rem' }}
        />
      )}

      {/* ==================== UPLOAD AREA ==================== */}
      <Card>
        {/* Upload Buttons */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Button
            type="primary"
            icon={<FolderOutlined style={{ fontSize: '1rem' }} />}
            disabled={!!tagWarning}
            style={{ marginRight: '0.5rem', height: '2.25rem', fontSize: '0.875rem' }}
            onClick={(e) => {
              e.stopPropagation();
              handleFileSelect(); // Shows batch name modal first if no tags
            }}
          >
            Select File(s)
          </Button>
          <Button
            icon={<FolderOutlined style={{ fontSize: '1rem' }} />}
            disabled={!!tagWarning}
            style={{ marginRight: '0.5rem', height: '2.25rem', fontSize: '0.875rem' }}
            onClick={(e) => {
              e.stopPropagation();
              handleFolderSelect(); // Uses folder name as batch name
            }}
          >
            Select Folder
          </Button>
          <Button
            type="primary"
            icon={<FolderOutlined style={{ fontSize: '1rem' }} />}
            disabled={!!tagWarning}
            style={{ height: '2.25rem', fontSize: '0.875rem' }}
            onClick={(e) => {
              e.stopPropagation();
              importLabelsRef.current?.triggerFolderSelect();
            }}
          >
            Select Folder (images + labels)
          </Button>
        </div>

        {/* Import with Labels status — shows below buttons when folder selected */}
        <ImportWithLabelsSection ref={importLabelsRef} projectId={projectId} />

        {/* Upload result — shown after file/folder select upload */}
        {uploadResult && (
          <div style={{
            background: '#f5f5f5',
            borderRadius: 8,
            padding: '16px',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: 8 }}>
              {uploadResult.uploaded > 0 && (
                <Text strong>{uploadResult.uploaded} image{uploadResult.uploaded !== 1 ? 's' : ''} uploaded to &ldquo;{uploadResult.batchName}&rdquo;</Text>
              )}
              {uploadResult.uploaded > 0 && uploadResult.skipped > 0 && <Text> — </Text>}
              {uploadResult.skipped > 0 && (
                <Text type="warning"><strong>{uploadResult.skipped}</strong> skipped</Text>
              )}
            </div>
            {uploadResult.skipped > 0 && (
              <Collapse ghost size="small" style={{ textAlign: 'left' }} items={[{
                key: 'dup',
                label: <Text type="secondary" style={{ fontSize: 12 }}><WarningOutlined style={{ color: '#faad14', marginRight: 4 }} />{uploadResult.skipped} image{uploadResult.skipped !== 1 ? 's' : ''} already exist in this project</Text>,
                children: (
                  <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 11 }}>
                    {uploadResult.duplicateFiles.map(f => (
                      <Tag key={f} color="orange" style={{ marginBottom: 2 }}>{f}</Tag>
                    ))}
                  </div>
                )
              }]} />
            )}
            <Button size="small" style={{ marginTop: 8 }} onClick={() => setUploadResult(null)}>Dismiss</Button>
          </div>
        )}

        {/* Video FPS Selection - Shows when video is selected */}
        {videoFile && Array.isArray(videoFile) && videoFile.length > 0 && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f6f6f6',
            borderRadius: '0.5rem',
            border: '0.0625rem solid #d9d9d9'
          }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <Text strong style={{ fontSize: '0.875rem' }}>Selected Video{videoFile.length > 1 ? 's' : ''}: </Text>
              {videoFile.length === 1 ? (
                <Text>{videoFile[0].name}</Text>
              ) : (
                <div style={{ marginTop: '0.5rem' }}>
                  <Text style={{ fontSize: '0.875rem' }}>{videoFile.length} videos selected</Text>
                  <div style={{ marginTop: '0.25rem', maxHeight: '6.25rem', overflowY: 'auto' }}>
                    {videoFile.map((video, index) => (
                      <div key={index} style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.125rem' }}>
                        {index + 1}. {video.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Row gutter={['1rem', '1rem']} style={{ marginBottom: '0.75rem' }}>
              <Col span={12}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <Text strong style={{ fontSize: '0.875rem' }}>Extract frames every:</Text>
                </div>
                <Select
                  value={selectedFPS}
                  onChange={(fps) => {
                    logInfo('app.frontend.ui', 'fps_selection_changed', 'FPS selection changed', {
                      timestamp: new Date().toISOString(),
                      projectId: projectId,
                      newFPS: fps,
                      previousFPS: selectedFPS
                    });
                    setSelectedFPS(fps);
                  }}
                  style={{ width: '100%', height: '2.5rem' }}
                  className="vector-select"
                  popupClassName="vector-select-dropdown"
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
                <div style={{ marginBottom: '0.5rem' }}>
                  <Text strong style={{ fontSize: '0.875rem' }}>Output image format:</Text>
                </div>
                <Select
                  value={selectedImageFormat}
                  onChange={(format) => {
                    logInfo('app.frontend.ui', 'image_format_selection_changed', 'Image format selection changed', {
                      timestamp: new Date().toISOString(),
                      projectId: projectId,
                      newFormat: format,
                      previousFormat: selectedImageFormat
                    });
                    setSelectedImageFormat(format);
                  }}
                  style={{ width: '100%', height: '2.5rem' }}
                  className="vector-select"
                  popupClassName="vector-select-dropdown"
                  size="large"
                >
                  <Option value="jpeg">JPEG (.jpg) - Smaller size, good quality</Option>
                  <Option value="png">PNG (.png) - Lossless, larger size</Option>
                  <Option value="webp">WebP (.webp) - Modern, efficient</Option>
                </Select>
              </Col>
            </Row>

            <Row gutter={['1rem', '1rem']} align="middle">
              <Col span={24} style={{ textAlign: 'center' }}>
                <Space size="0.5rem">
                  <Button
                    type="primary"
                    loading={videoProcessing}
                    onClick={processVideoUpload}
                    style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', height: '2.5rem', padding: '0 1.5rem', fontSize: '0.875rem' }}
                  >
                    {videoProcessing ? 'Processing...' : 'Extract Frames'}
                  </Button>
                  <Button
                    style={{ height: '2.5rem', padding: '0 1.5rem', fontSize: '0.875rem' }}
                    onClick={() => {
                      logUserClick('video_processing_cancel_button_clicked', 'User clicked video processing cancel button');
                      logInfo('app.frontend.ui', 'video_processing_cancelled', 'Video processing cancelled by user', {
                        timestamp: new Date().toISOString(),
                        projectId: projectId,
                        videoCount: videoFile?.length || 0
                      });
                      setVideoFile(null);
                      setExtractedFrames([]);
                    }}
                  >
                    Cancel
                  </Button>
                </Space>
              </Col>
            </Row>

            <div style={{ marginTop: '0.75rem' }}>
              <Text type="secondary" style={{ fontSize: '0.75rem' }}>
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
            if (files.length === 0) {
              logInfo('app.frontend.interactions', 'file_selection_cancelled', 'File selection cancelled by user', {
                timestamp: new Date().toISOString(),
                projectId: projectId
              });
              return;
            }

            logInfo('app.frontend.interactions', 'files_selected_for_upload', 'Files selected for upload via file input', {
              timestamp: new Date().toISOString(),
              projectId: projectId,
              filesCount: files.length,
              fileNames: files.map(f => f.name),
              batchName: batchName
            });

            setUploading(true);
            const batchNameToUse = batchName || `Uploaded on ${new Date().toISOString().slice(0,10)}`;

            try {
              setUploadResult(null);
              let result;
              if (files.length > 1) {
                result = await uploadMultipleFiles(files, batchNameToUse);
                setUploadResult({
                  uploaded: result.results?.successful_uploads ?? files.length,
                  skipped: result.skipped_duplicates ?? 0,
                  duplicateFiles: result.duplicate_files || [],
                  batchName: result.dataset_name || batchNameToUse
                });
              } else {
                result = await uploadFile(files[0], batchNameToUse);
                setUploadResult({
                  uploaded: result?.duplicate ? 0 : 1,
                  skipped: result?.duplicate ? 1 : 0,
                  duplicateFiles: result?.duplicate ? [files[0].name] : [],
                  batchName: result?.dataset_name || batchNameToUse
                });
              }
              loadRecentImages();
            } catch (error) {
              logError('app.frontend.interactions', 'file_upload_error', 'File upload error via file input', {
                timestamp: new Date().toISOString(),
                projectId: projectId,
                filesCount: files.length,
                batchName: batchNameToUse,
                error: error.message
              });
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
            if (files.length === 0) {
              logInfo('app.frontend.interactions', 'folder_selection_cancelled', 'Folder selection cancelled by user', {
                timestamp: new Date().toISOString(),
                projectId: projectId
              });
              return;
            }

            // Extract folder name from the first file's path
            const firstFile = files[0];
            const pathParts = firstFile.webkitRelativePath.split('/');
            const folderName = pathParts[0] || `Folder_${new Date().toISOString().slice(0,10)}`;

            logInfo('app.frontend.interactions', 'folder_selected_for_upload', 'Folder selected for upload', {
              timestamp: new Date().toISOString(),
              projectId: projectId,
              filesCount: files.length,
              folderName: folderName,
              fileNames: files.map(f => f.name)
            });

            setUploading(true);

            try {
              setUploadResult(null);
              const result = await uploadMultipleFiles(files, folderName);
              setUploadResult({
                uploaded: result.results?.successful_uploads ?? files.length,
                skipped: result.skipped_duplicates ?? 0,
                duplicateFiles: result.duplicate_files || [],
                batchName: folderName
              });
              loadRecentImages();
            } catch (error) {
              logError('app.frontend.interactions', 'folder_upload_error', 'Folder upload error', {
                timestamp: new Date().toISOString(),
                projectId: projectId,
                filesCount: files.length,
                folderName: folderName,
                error: error.message
              });
              console.error('Folder upload error:', error);
            } finally {
              setUploading(false);
              // Clear the input value to allow re-uploading the same folder
              e.target.value = '';
            }
          }}
        />

        {/* ==================== SUPPORTED FORMATS SECTION ==================== */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Title level={4} style={{ color: '#666', fontSize: '1.25rem' }}>Supported Formats</Title>
          <Row gutter={['1.5rem', '1rem']} justify="center">
            {/* Images Format */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <PictureOutlined style={{ fontSize: '1.5rem', color: '#1890ff' }} />
                <div style={{ marginTop: '0.5rem' }}>
                  <Text strong style={{ fontSize: '0.875rem' }}>Images</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                    .jpg, .jpeg, .png, .bmp, .webp, .avif
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '0.6875rem' }}>
                    Common image formats
                  </Text>
                </div>
              </div>
            </Col>

            {/* Annotations Format */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <TagOutlined style={{ fontSize: '1.5rem', color: '#52c41a' }} />
                <div style={{ marginTop: '0.5rem' }}>
                  <Text strong style={{ fontSize: '0.875rem' }}>Annotations</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                    .json, .xml, .txt
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '0.6875rem' }}>
                    Label files
                  </Text>
                </div>
              </div>
            </Col>

            {/* Videos Format */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <YoutubeOutlined style={{ fontSize: '1.5rem', color: '#722ed1' }} />
                <div style={{ marginTop: '0.5rem' }}>
                  <Text strong style={{ fontSize: '0.875rem' }}>Videos</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                    .mp4, .mov, .avi
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '0.6875rem' }}>
                    Video files
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: '0.6875rem' }}>
            (Max size of 20MB and 16,000 pixels for images).
          </Text>
        </div>

        <Divider />

        {/* ==================== ADDITIONAL UPLOAD OPTIONS ==================== */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Title level={5} style={{ fontSize: '1rem', marginBottom: '1rem' }}>Need images to get started? We've got you covered.</Title>

          {/* Video Upload Section */}
          <Card size="small" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <YoutubeOutlined style={{ fontSize: '1.25rem', color: '#722ed1', marginRight: '0.75rem' }} />
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: '0.875rem' }}>Upload Videos and Extract Frames</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                  Upload single/multiple .mp4, .mov, or .avi files or select a folder containing videos
                </Text>
              </div>
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                type="primary"
                icon={<YoutubeOutlined style={{ fontSize: '0.875rem' }} />}
                loading={videoProcessing}
                onClick={handleVideoSelect}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', height: '2rem', fontSize: '0.8125rem' }}
              >
                {videoProcessing ? 'Processing...' : 'Select Video File(s)'}
              </Button>
              <Button
                icon={<FolderOutlined style={{ fontSize: '0.875rem' }} />}
                loading={videoProcessing}
                onClick={handleVideoFolderSelect}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', color: 'white', height: '2rem', fontSize: '0.8125rem' }}
              >
                {videoProcessing ? 'Processing...' : 'Select Video Folder'}
              </Button>
              {videoFile && Array.isArray(videoFile) && videoFile.length > 0 && (
                <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                  Selected: {videoFile.length} video{videoFile.length > 1 ? 's' : ''}
                </Text>
              )}
            </div>
          </Card>

          {/* API and Cloud Provider Options */}
          <Row gutter={['1rem', '1rem']}>
            <Col span={12}>
              <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ApiOutlined style={{ fontSize: '1.25rem', color: '#1890ff', marginRight: '0.75rem' }} />
                  <Text strong style={{ fontSize: '0.8125rem' }}>Collect Images via the Upload API</Text>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CloudOutlined style={{ fontSize: '1.25rem', color: '#52c41a', marginRight: '0.75rem' }} />
                  <Text strong style={{ fontSize: '0.8125rem' }}>Import From Cloud Providers</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>

      {/* ==================== UPLOAD STATUS & PROGRESS ==================== */}
      {recentImages.length > 0 && (
        <Card title={<span style={{ fontSize: '1rem' }}>Upload Status</span>} style={{ marginTop: '1.5rem' }}>
          <div>
            <Title level={5} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Recently Uploaded ({recentImages.length} files)</Title>
            <Row gutter={['1rem', '1rem']}>
              {recentImages.map((fileInfo, index) => (
                <Col span={4} key={index}>
                  <Card
                    size="small"
                    cover={
                      <div style={{
                        height: '5rem',
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {fileInfo.thumbnail_url ? (
                          <img
                            src={fileInfo.thumbnail_url}
                            alt={fileInfo.filename || 'Image'}
                            style={{ maxHeight: '5rem', maxWidth: '100%' }}
                          />
                        ) : (
                          <PictureOutlined style={{ fontSize: '1.5rem', color: '#999' }} />
                        )}
                      </div>
                    }
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ fontSize: '0.75rem' }}>
                          {fileInfo.filename || 'Unknown'}
                        </Text>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
            {recentImages.length > 6 && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Button type="link" style={{ fontSize: '0.8125rem' }}>
                  View all {recentImages.length} uploaded files
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ==================== BATCH NAME MODAL ==================== */}
      <Modal
        title="Enter Batch Name"
        width="25rem"
        open={batchNameModalVisible}
        onOk={handleBatchNameConfirm}
        onCancel={() => {
          logUserClick('batch_name_modal_cancel_button_clicked', 'User clicked batch name modal cancel button');
          logInfo('app.frontend.ui', 'batch_name_modal_cancelled', 'Batch name modal cancelled', {
            timestamp: new Date().toISOString(),
            projectId: projectId
          });
          setBatchNameModalVisible(false);
          setBatchName('');
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
          style={{ fontSize: '0.875rem', height: '2.25rem' }}
        />
      </Modal>
    </div>
  );
};

export default UploadSection;
