/**
 * API service for connecting frontend to backend
 * Centralized API calls with error handling
 */

import axios from 'axios';
import { API_BASE_URL } from '../config';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

// Request interceptor for logging and cache busting
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add timestamp to prevent caching for GET requests
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Helper function for handling API errors
export const handleAPIError = (error, defaultMessage = 'API request failed') => {
  const errorMessage = error.response?.data?.detail || error.message || defaultMessage;
  console.error(`${defaultMessage}:`, errorMessage);
  // You can add notification/toast here if needed
  // Example: message.error(errorMessage);
  
  // Return error information object that components expect
  return {
    message: errorMessage,
    status: error.response?.status,
    data: error.response?.data
  };
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
};

// ==================== MODELS API ====================

export const modelsAPI = {
  // Get all models
  getModels: async () => {
    const response = await api.get('/api/v1/models/');
    return response.data;
  },

  // Get specific model
  getModel: async (modelId) => {
    const response = await api.get(`/api/v1/models/${modelId}`);
    return response.data;
  },

  // Import custom model
  importModel: async (formData) => {
    const response = await api.post('/api/v1/models/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete model
  deleteModel: async (modelId) => {
    const response = await api.delete(`/api/v1/models/${modelId}`);
    return response.data;
  },

  // Get supported model types
  getSupportedTypes: async () => {
    const response = await api.get('/api/v1/models/types/supported');
    return response.data;
  },
};

// ==================== PROJECTS API ====================

export const projectsAPI = {
  // Get all projects
  getProjects: async (skip = 0, limit = 100) => {
    const response = await api.get('/api/v1/projects/', {
      params: { skip, limit }
    });
    return response.data;
  },

  // Create new project
  createProject: async (projectData) => {
    const response = await api.post('/api/v1/projects/', projectData);
    return response.data;
  },

  // Get specific project
  getProject: async (projectId) => {
    const response = await api.get(`/api/v1/projects/${projectId}`);
    return response.data;
  },

  // Update project
  updateProject: async (projectId, updateData) => {
    const response = await api.put(`/api/v1/projects/${projectId}`, updateData);
    return response.data;
  },

  // Delete project
  deleteProject: async (projectId) => {
    const response = await api.delete(`/api/v1/projects/${projectId}`);
    return response.data;
  },

  // Get project datasets
  getProjectDatasets: async (projectId) => {
    const response = await api.get(`/api/v1/projects/${projectId}/datasets`);
    return response.data;
  },

  // Get project statistics
  getProjectStats: async (projectId) => {
    const response = await api.get(`/api/v1/projects/${projectId}/stats`);
    return response.data;
  },

  // Duplicate project with all datasets, images, and annotations
  duplicateProject: async (projectId) => {
    const response = await api.post(`/api/v1/projects/${projectId}/duplicate`);
    return response.data;
  },

  // Get project management data (datasets organized by status)
  getProjectManagementData: async (projectId) => {
    const response = await api.get(`/api/v1/projects/${projectId}/management`);
    return response.data;
  },

  // Assign dataset to annotating
  assignDatasetToAnnotating: async (projectId, datasetId) => {
    const response = await api.put(`/api/v1/projects/${projectId}/datasets/${datasetId}/assign`);
    return response.data;
  },

  // Rename dataset
  renameDataset: async (projectId, datasetId, newName) => {
    const response = await api.put(`/api/v1/projects/${projectId}/datasets/${datasetId}/rename`, {
      new_name: newName
    });
    return response.data;
  },

  // Delete dataset
  deleteProjectDataset: async (projectId, datasetId) => {
    const response = await api.delete(`/api/v1/projects/${projectId}/datasets/${datasetId}`);
    return response.data;
  },

  // Move dataset to unassigned
  moveDatasetToUnassigned: async (projectId, datasetId) => {
    const response = await api.put(`/api/v1/projects/${projectId}/datasets/${datasetId}/move-to-unassigned`);
    return response.data;
  },

  // Move dataset to completed/dataset section
  moveDatasetToCompleted: async (projectId, datasetId) => {
    const response = await api.put(`/api/v1/projects/${projectId}/datasets/${datasetId}/move-to-completed`);
    return response.data;
  },

  // Upload images to project
  uploadImagesToProject: async (projectId, formData) => {
    const response = await api.post(`/api/v1/projects/${projectId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload multiple images to project (bulk upload)
  uploadMultipleImagesToProject: async (projectId, formData) => {
    const response = await api.post(`/api/v1/projects/${projectId}/upload-bulk`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get recent images for project (placeholder - implement if backend supports it)
  getRecentImages: async (projectId, limit = 6) => {
    try {
      // This endpoint might not exist yet, so we'll return empty array for now
      // const response = await api.get(`/api/v1/projects/${projectId}/recent-images`, {
      //   params: { limit }
      // });
      // return response.data;
      return [];
    } catch (error) {
      console.warn('Recent images endpoint not available:', error);
      return [];
    }
  },

  // Get project dataset images (for Dataset section)
  getProjectDatasetImages: async (projectId, splitType = null, limit = 50, offset = 0) => {
    const params = { 
      limit, 
      offset,
      ...(splitType && { split_type: splitType })
    };
    const response = await api.get(`/api/v1/projects/${projectId}/images`, { params });
    return response.data;
  },

  // Get annotations for an image
  getImageAnnotations: async (imageId) => {
    try {
      const response = await api.get(`/api/v1/images/${imageId}/annotations`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to load image annotations');
      throw error;
    }
  },

  // Get project labels
  getProjectLabels: async (projectId) => {
    const response = await api.get(`/api/v1/projects/${projectId}/labels`);
    return response.data;
  },

  // Create project label
  createProjectLabel: async (projectId, labelData) => {
    const response = await api.post(`/api/v1/projects/${projectId}/labels`, labelData);
    return response.data;
  },

  // Update project label
  updateProjectLabel: async (projectId, labelId, labelData) => {
    const response = await api.put(`/api/v1/projects/${projectId}/labels/${labelId}`, labelData);
    return response.data;
  },

  // Delete project label
  deleteProjectLabel: async (projectId, labelId) => {
    const response = await api.delete(`/api/v1/projects/${projectId}/labels/${labelId}`);
    return response.data;
  },
};

// ==================== IMAGE TRANSFORMATIONS API ====================

export const imageTransformationsAPI = {
  // Get all transformations
  getTransformations: async (releaseVersion = null, transformationType = null) => {
    try {
      const params = {};
      if (releaseVersion) params.release_version = releaseVersion;
      if (transformationType) params.transformation_type = transformationType;
      
      const response = await api.get('/api/image-transformations/', { params });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get transformations');
      throw error;
    }
  },
  
  // Create a new transformation
  createTransformation: async (transformationData) => {
    try {
      const response = await api.post('/api/image-transformations/', transformationData);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to create transformation');
      throw error;
    }
  },
  
  // Create multiple transformations in batch
  createTransformationsBatch: async (transformationsData) => {
    try {
      const response = await api.post('/api/image-transformations/batch', transformationsData);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to create transformations batch');
      throw error;
    }
  },
  
  // Get a specific transformation
  getTransformation: async (transformationId) => {
    try {
      const response = await api.get(`/api/image-transformations/${transformationId}`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get transformation');
      throw error;
    }
  },
  
  // Update a transformation
  updateTransformation: async (transformationId, updateData) => {
    try {
      const response = await api.put(`/api/image-transformations/${transformationId}`, updateData);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to update transformation');
      throw error;
    }
  },
  
  // Delete a transformation
  deleteTransformation: async (transformationId) => {
    try {
      const response = await api.delete(`/api/image-transformations/${transformationId}`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to delete transformation');
      throw error;
    }
  },
  
  // Get transformations by version
  getTransformationsByVersion: async (releaseVersion, status = null) => {
    try {
      const params = {};
      if (status) params.status = status;
      
      const response = await api.get(`/api/image-transformations/version/${releaseVersion}`, { params });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get transformations by version');
      throw error;
    }
  },
  
  // Get pending transformations
  getPendingTransformations: async () => {
    try {
      const response = await api.get('/api/image-transformations/pending');
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get pending transformations');
      throw error;
    }
  },
  
  // Update release version name
  updateReleaseVersion: async (oldVersion, newVersion) => {
    try {
      const response = await api.put('/api/image-transformations/release-version', {
        old_release_version: oldVersion,
        new_release_version: newVersion
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to update release version');
      throw error;
    }
  },

  // Get all release versions
  getReleaseVersions: async (status = null) => {
    try {
      const params = {};
      if (status) params.status = status;
      
      const response = await api.get('/api/image-transformations/release-versions', { params });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get release versions');
      throw error;
    }
  },

  // Delete transformations by version
  deleteTransformationsByVersion: async (releaseVersion) => {
    try {
      const response = await api.delete(`/api/image-transformations/version/${releaseVersion}`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to delete transformations by version');
      throw error;
    }
  },
  
  // Reorder transformations
  reorderTransformations: async (transformationIds) => {
    try {
      const response = await api.post('/api/image-transformations/reorder', { transformation_ids: transformationIds });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to reorder transformations');
      throw error;
    }
  },
  
  // Generate a new version ID
  generateVersion: async () => {
    try {
      const response = await api.post('/api/image-transformations/generate-version');
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to generate version');
      throw error;
    }
  }
};

// ==================== RELEASES API ====================

export const releasesAPI = {
  // Create a new release
  createRelease: async (releaseData) => {
    try {
      const response = await api.post('/releases/create', releaseData);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to create release');
      throw error;
    }
  },
  
  // Get release history for a dataset
  getReleaseHistory: async (datasetId) => {
    try {
      const response = await api.get(`/releases/${datasetId}/history`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get release history');
      throw error;
    }
  },
  
  // Rename a release
  renameRelease: async (releaseId, newName) => {
    try {
      const response = await api.put(`/releases/${releaseId}/rename`, { name: newName });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to rename release');
      throw error;
    }
  },
  
  // Get download information for a release
  getDownloadInfo: async (releaseId) => {
    try {
      const response = await api.get(`/releases/${releaseId}/download`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get download information');
      throw error;
    }
  }
};

// ==================== DATA AUGMENTATION API ====================

export const augmentationAPI = {
  // Get augmentation presets
  getPresets: async () => {
    try {
      const response = await api.get('/api/augmentation/presets');
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to load augmentation presets');
      throw error;
    }
  },

  // Get default augmentation configuration
  getDefaultConfig: async () => {
    try {
      const response = await api.get('/api/augmentation/default-config');
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to load default augmentation config');
      throw error;
    }
  },

  // Get augmentation jobs for a dataset
  getJobs: async (datasetId) => {
    try {
      const response = await api.get(`/api/augmentation/jobs/${datasetId}`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to load augmentation jobs');
      throw error;
    }
  },

  // Get augmentation preview (config summary)
  getAugmentationConfigPreview: async (datasetId, config) => {
    try {
      const response = await api.post('/api/augmentation/preview', {
        dataset_id: datasetId,
        augmentation_config: config,
        images_per_original: config.images_per_original || 5,
        apply_to_split: config.apply_to_split || 'train'
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to generate augmentation preview');
      throw error;
    }
  },

  // Create augmentation job
  createJob: async (datasetId, jobData) => {
    try {
      const response = await api.post('/api/augmentation/create', {
        dataset_id: datasetId,
        name: jobData.name || `Augmentation ${new Date().toLocaleString()}`,
        description: jobData.description || '',
        augmentation_config: jobData.config,
        images_per_original: jobData.images_per_original || 5,
        apply_to_split: jobData.apply_to_split || 'train',
        preserve_annotations: jobData.preserve_annotations !== false
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to create augmentation job');
      throw error;
    }
  },

  // Delete augmentation job
  deleteJob: async (jobId) => {
    try {
      const response = await api.delete(`/api/augmentation/job/${jobId}`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to delete augmentation job');
      throw error;
    }
  },

  // Generate transformation preview
  generatePreview: async (imageFile, transformations) => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('transformations', JSON.stringify(transformations));

      const response = await api.post('/api/transformation/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to generate transformation preview');
      throw error;
    }
  },

  // Generate batch transformation previews
  generateBatchPreview: async (imageFile, transformationsList) => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('transformations', JSON.stringify(transformationsList));

      const response = await api.post('/api/transformation/batch-preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to generate batch transformation preview');
      throw error;
    }
  },

  // Get available transformations
  getAvailableTransformations: async () => {
    try {
      const response = await api.get('/api/transformation/available-transformations');
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get available transformations');
      throw error;
    }
  },

  // Save transformation configuration
  saveTransformationConfig: async (datasetId, configData) => {
    try {
      const response = await api.post('/api/augmentation/transformation-config', {
        dataset_id: datasetId,
        name: configData.name || `Transformation ${new Date().toLocaleString()}`,
        description: configData.description || '',
        augmentation_config: configData.transformations,
        images_per_original: configData.images_per_original || 5,
        apply_to_split: configData.apply_to_split || 'train',
        preserve_annotations: configData.preserve_annotations !== false
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to save transformation configuration');
      throw error;
    }
  },

  // Get transformation configuration
  getTransformationConfig: async (augmentationId) => {
    try {
      const response = await api.get(`/api/augmentation/transformation-config/${augmentationId}`);
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get transformation configuration');
      throw error;
    }
  },
};

// ==================== DATASETS API ====================

export const datasetsAPI = {
  // Get all datasets
  getDatasets: async (projectId = null, skip = 0, limit = 100) => {
    const params = { skip, limit };
    if (projectId) params.project_id = projectId;
    
    const response = await api.get('/api/v1/datasets/', { params });
    return response.data;
  },

  // Create new dataset
  createDataset: async (datasetData) => {
    const response = await api.post('/api/v1/datasets/', datasetData);
    return response.data;
  },

  // Upload dataset with files (create dataset + upload files)
  uploadDataset: async (formData) => {
    const response = await api.post('/api/v1/datasets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get specific dataset
  getDataset: async (datasetId) => {
    const response = await api.get(`/api/v1/datasets/${datasetId}`);
    return response.data;
  },

  // Upload images to dataset
  uploadImages: async (datasetId, files, autoLabel = true) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('auto_label', autoLabel);

    const response = await api.post(`/api/v1/datasets/${datasetId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Start auto-labeling
  startAutoLabeling: async (datasetId, autoLabelData) => {
    const response = await api.post(`/api/v1/datasets/${datasetId}/auto-label`, autoLabelData);
    return response.data;
  },

  // Get dataset images
  getDatasetImages: async (datasetId, skip = 0, limit = 50, labeledOnly = null) => {
    const params = { skip, limit };
    if (labeledOnly !== null) params.labeled_only = labeledOnly;

    const response = await api.get(`/api/v1/datasets/${datasetId}/images`, { params });
    return response.data;
  },



  // Delete dataset
  deleteDataset: async (datasetId) => {
    const response = await api.delete(`/api/v1/datasets/${datasetId}`);
    return response.data;
  },

  // Update dataset
  updateDataset: async (datasetId, updateData) => {
    const response = await api.put(`/api/v1/datasets/${datasetId}`, updateData);
    return response.data;
  },

  // Get dataset statistics
  getDatasetStats: async (datasetId) => {
    const response = await api.get(`/api/v1/datasets/${datasetId}/stats`);
    return response.data;
  },
  
  // Assign labeled images to dataset splits (train/val/test)
  assignImagesToSplits: async (datasetId, splitData) => {
    // Use the dataset splits endpoint
    const response = await api.post(`/api/v1/datasets/${datasetId}/splits`, splitData);
    return response.data;
  },

  // Rebalance dataset splits (NEW FUNCTIONALITY)
  rebalanceDataset: async (datasetId, rebalanceData) => {
    const response = await api.post(`/api/datasets/${datasetId}/rebalance`, rebalanceData);
    return response.data;
  },

  // Get dataset statistics including current splits (NEW FUNCTIONALITY)
  getDatasetStatistics: async (datasetId) => {
    const response = await api.get(`/api/datasets/${datasetId}/stats`);
    return response.data;
  },
};

// ==================== SMART SEGMENTATION API ====================

export const segmentationAPI = {
  // AI-powered segmentation
  segment: async (imageData, point, modelType = 'hybrid') => {
    const response = await api.post('/api/segment', {
      image_data: imageData,
      point: point,
      model_type: modelType
    });
    return response.data;
  },

  // Batch segmentation
  batchSegment: async (imageData, points, modelType = 'hybrid') => {
    const response = await api.post('/api/segment/batch', {
      image_data: imageData,
      points: points,
      model_type: modelType
    });
    return response.data;
  },

  // Get available models
  getModels: async () => {
    const response = await api.get('/api/segment/models');
    return response.data;
  },
};

// ==================== ANNOTATIONS API ====================

export const annotationsAPI = {
  // Get annotations for an image
  getAnnotations: async (imageId) => {
    const response = await api.get(`/api/v1/images/${imageId}/annotations`);
    return response.data;
  },

  // Save annotations for an image
  saveAnnotations: async (imageId, annotations) => {
    const response = await api.post(`/api/v1/images/${imageId}/annotations`, {
      annotations: annotations
    });
    return response.data;
  },

  // Update specific annotation
  updateAnnotation: async (imageId, annotationId, annotationData) => {
    const response = await api.put(`/api/v1/images/${imageId}/annotations/${annotationId}`, annotationData);
    return response.data;
  },

  // Delete annotation
  deleteAnnotation: async (imageId, annotationId) => {
    const response = await api.delete(`/api/v1/images/${imageId}/annotations/${annotationId}`);
    return response.data;
  },

  // Export annotations
  exportAnnotations: async (datasetId, format = 'json') => {
    const response = await api.get(`/api/v1/datasets/${datasetId}/export`, {
      params: { format }
    });
    return response.data;
  },
};

// ==================== ANALYTICS API ====================

export const analyticsAPI = {
  // Get project label distribution
  getProjectLabelDistribution: async (projectId) => {
    const response = await api.get(`/api/analytics/project/${projectId}/label-distribution`);
    return response.data;
  },

  // Get dataset class distribution
  getDatasetClassDistribution: async (datasetId) => {
    const response = await api.get(`/api/analytics/dataset/${datasetId}/class-distribution`);
    return response.data;
  },

  // Get dataset labeling progress
  getDatasetLabelingProgress: async (datasetId) => {
    const response = await api.get(`/api/analytics/dataset/${datasetId}/labeling-progress`);
    return response.data;
  },

  // Get dataset split analysis
  getDatasetSplitAnalysis: async (datasetId) => {
    const response = await api.get(`/api/analytics/dataset/${datasetId}/split-analysis`);
    return response.data;
  },

  // Get dataset imbalance report
  getDatasetImbalanceReport: async (datasetId) => {
    const response = await api.get(`/api/analytics/dataset/${datasetId}/imbalance-report`);
    return response.data;
  },
};

// Check if backend is available
export const checkBackendHealth = async () => {
  try {
    await healthCheck();
    return { available: true };
  } catch (error) {
    return { 
      available: false, 
      error: handleAPIError(error) 
    };
  }
};

export default api;