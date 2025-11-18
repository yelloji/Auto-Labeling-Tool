/**
 * API service for connecting frontend to backend
 * Centralized API calls with error handling and professional logging
 */

import axios from 'axios';
import { API_BASE_URL } from '../config';
import { logInfo, logError } from '../utils/professional_logger';

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
    const startTime = Date.now();
    config.metadata = { startTime };
    
    // Log API request
    logInfo('app.frontend.interactions', 'api_request', `API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: config.headers,
      params: config.params,
      data: config.data,
      timestamp: new Date().toISOString()
    });
    
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
    logError('app.frontend.validation', 'api_request_error', 'API Request Error', error, {
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    const endTime = Date.now();
    const startTime = response.config.metadata?.startTime;
    const responseTime = startTime ? endTime - startTime : null;
    
    // Log API response
    logInfo('app.frontend.interactions', 'api_response', `API Response: ${response.status} ${response.config.url}`, {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      statusText: response.statusText,
      responseTime: responseTime ? `${responseTime}ms` : null,
      dataSize: response.data ? JSON.stringify(response.data).length : 0,
      headers: response.headers,
      timestamp: new Date().toISOString()
    });
    
    return response;
  },
  (error) => {
    const endTime = Date.now();
    const startTime = error.config?.metadata?.startTime;
    const responseTime = startTime ? endTime - startTime : null;
    
    // Log API response error
    logError('app.frontend.validation', 'api_response_error', 'API Response Error', error, {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseTime: responseTime ? `${responseTime}ms` : null,
      errorMessage: error.response?.data?.detail || error.response?.data?.message || error.message,
      errorData: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    return Promise.reject(error);
  }
);

// Helper function for handling API errors
export const handleAPIError = (error, defaultMessage = 'API request failed') => {
  let errorMessage = error.response?.data?.detail || error.message || defaultMessage;
  // Normalize FastAPI 422 validation errors (detail can be an array of error objects)
  if (Array.isArray(error.response?.data?.detail)) {
    const details = error.response.data.detail;
    errorMessage = details
      .map((d) => {
        const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
        const msg = d.msg || d.message || JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join('; ');
  } else if (typeof errorMessage === 'object' && errorMessage !== null) {
    // If detail is an object, stringify safely
    try { errorMessage = JSON.stringify(errorMessage); } catch { errorMessage = defaultMessage; }
  }
  
  // Log API error using professional logger
  logError('app.frontend.validation', 'api_error_handled', `API Error: ${defaultMessage}`, error, {
    errorMessage: errorMessage,
    status: error.response?.status,
    statusText: error.response?.statusText,
    url: error.config?.url,
    method: error.config?.method?.toUpperCase(),
    errorData: error.response?.data,
    timestamp: new Date().toISOString()
  });
  
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
    logInfo('app.frontend.interactions', 'health_check_started', 'Health check started');
    const response = await api.get('/health');
    logInfo('app.frontend.interactions', 'health_check_success', 'Health check successful', {
      status: response.status,
      data: response.data,
      timestamp: new Date().toISOString()
    });
    return response.data;
  } catch (error) {
    logError('app.frontend.validation', 'health_check_failed', 'Health check failed', error, {
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
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

  // Import custom model (optionally scoped to a project)
  importModel: async (formData, projectId = null) => {
    try {
      // Create a new FormData and copy entries to avoid mutating the original reference
      const fd = new FormData();
      if (formData && formData instanceof FormData) {
        for (const [key, value] of formData.entries()) {
          fd.append(key, value);
        }
      }
      if (projectId) {
        fd.append('project_id', String(projectId));
      }

      const response = await api.post('/api/v1/models/import', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Large model files and backend processing can exceed 30s
        timeout: 120000,
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to import model');
      throw error;
    }
  },

  // Delete model
  deleteModel: async (modelId) => {
    const response = await api.delete(`/api/v1/models/${modelId}`);
    return response.data;
  },

  // Download model file
  downloadModel: async (modelId) => {
    const response = await api.get(`/api/v1/models/${modelId}/download`, {
      responseType: 'blob'
    });
    // Try to extract filename from Content-Disposition
    const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
    let filename = `model_${modelId}`;
    if (contentDisposition) {
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    return { blob: response.data, filename };
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

  // Get models associated with a project (optionally include global models)
  getProjectModels: async (projectId, includeGlobal = false) => {
    const params = { include_global: includeGlobal };
    const response = await api.get(`/api/v1/projects/${projectId}/models`, { params });

    // Normalize model fields so the Project Models UI can consistently classify
    // readiness, training, and custom-vs-pretrained across different backends.
    const normalizeProjectModel = (m) => {
      const statusStr = String(m?.status || m?.state || m?.phase || m?.training_status || '').toLowerCase();
      const src = String(m?.source || m?.origin || '').toLowerCase();
      const scope = String(m?.scope || (m?.project_id ? 'project' : 'global')).toLowerCase();
      const isProjectScoped = String(m?.project_id || '') === String(projectId);
      const isPretrained = typeof m?.is_pretrained !== 'undefined' ? Boolean(m?.is_pretrained) : null;
      // Minimal, safe normalization to match Global Models UI behavior:
      // trust backend flags when present; only fallback to strict status values.
      const is_training = (typeof m?.is_training !== 'undefined')
        ? Boolean(m?.is_training)
        : (statusStr === 'training' || statusStr === 'running');
      const is_ready = (typeof m?.is_ready !== 'undefined')
        ? Boolean(m?.is_ready)
        : (statusStr === 'ready');

      // If backend omitted flags for pretrained models (global or linked to project),
      // surface them as Ready consistently.
      const isPretrainedLike = (isPretrained === true) || (src === 'pretrained');
      const final_is_ready = is_ready || isPretrainedLike;
      const final_is_training = isPretrainedLike ? false : is_training;
      const is_custom = Boolean(m?.is_custom)
        || src === 'custom' || src === 'user' || src === 'uploaded'
        || scope === 'project'
        || (isProjectScoped && isPretrained === false);

      return {
        ...m,
        status: m?.status || statusStr, // keep original if present
        scope,
        is_training: final_is_training,
        is_ready: final_is_ready,
        is_custom,
      };
    };

    let data = response?.data;
    if (Array.isArray(data)) {
      let models = data.map(normalizeProjectModel);
      // If global models are included, enrich global items with authoritative flags
      // from the global models endpoint to ensure Ready/Training status matches
      // the Global Models UI.
      if (includeGlobal) {
        try {
          const globalList = await modelsAPI.getModels();
          const gmap = new Map();
          if (Array.isArray(globalList)) {
            globalList.forEach(g => {
              if (g && typeof g.id !== 'undefined') {
                gmap.set(String(g.id), g);
              }
            });
          }
          models = models.map(m => {
            if (gmap.has(String(m?.id))) {
              const g = gmap.get(String(m.id));
              const merged_is_ready = (typeof m?.is_ready !== 'undefined') ? Boolean(m.is_ready) : Boolean(g?.is_ready);
              const merged_is_training = (typeof m?.is_training !== 'undefined') ? Boolean(m.is_training) : Boolean(g?.is_training);
              const merged_is_pretrained = (typeof m?.is_pretrained !== 'undefined') ? Boolean(m.is_pretrained) : Boolean(g?.is_pretrained);
              const merged_source = m?.source || m?.origin || g?.source || g?.origin || (merged_is_pretrained ? 'pretrained' : undefined);
              return {
                ...m,
                is_ready: merged_is_ready,
                is_training: merged_is_training,
                is_pretrained: merged_is_pretrained,
                source: merged_source,
              };
            }
            return m;
          });
        } catch (e) {
          // If enrichment fails, proceed with normalized models
          logError('app.frontend.validation', 'enrich_global_models_failed', e, { component: 'api.projectsAPI', endpoint: '/api/v1/models/' });
        }
      }
      return models;
    }
    return data;
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
  // Get all releases for a project
  getProjectReleases: async (projectId) => {
    try {
      const response = await api.get(`/api/v1/projects/${projectId}/releases`);
      const data = response.data;
      return Array.isArray(data) ? data : (data?.releases || []);
    } catch (error) {
      handleAPIError(error, 'Failed to get project releases');
      throw error;
    }
  },
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

// ==================== TRAINING API ====================

export const trainingAPI = {
  checkExtracted: async (zipPath) => {
    try {
      const response = await api.get('/api/v1/training/check-extracted', {
        params: { zip_path: zipPath }
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to check extraction');
      throw error;
    }
  },
  extractRelease: async (zipPath) => {
    try {
      const response = await api.post('/api/v1/training/extract-release', {
        zip_path: zipPath
      });
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to extract release');
      throw error;
    }
  },
  resolveConfig: async (framework, task, overrides) => {
    const response = await api.post('/api/v1/training/config/resolve', { framework, task, overrides });
    return response.data;
  },
  datasetSummary: async ({ releaseDir, dataYamlPath }) => {
    const params = new URLSearchParams();
    if (releaseDir) params.append('release_dir', releaseDir);
    if (dataYamlPath) params.append('data_yaml_path', dataYamlPath);
    const response = await api.get(`/api/v1/training/dataset/summary?${params.toString()}`);
    return response.data;
  },
  verifyDevPassword: async (password) => {
    const response = await api.post('/api/v1/dev/auth/verify', { password });
    return response.data;
  },
  changeDevPassword: async ({ currentPassword, newPassword }) => {
    const response = await api.post('/api/v1/dev/auth/change', { current_password: currentPassword, new_password: newPassword });
    return response.data;
  },
  getTrainableModels: async (projectId, framework, task) => {
    try {
      const params = { framework, task };
      if (projectId !== null && projectId !== undefined && String(projectId).trim() !== '') {
        params.project_id = projectId;
      }
      const response = await api.get('/api/v1/training/models', { params });
      return response.data || [];
    } catch (error) {
      handleAPIError(error, 'Failed to load trainable models');
      throw error;
    }
  },
  upsertSession: async ({ projectId, name, description }) => {
    const response = await api.post('/api/v1/training/session/upsert', {
      project_id: projectId,
      name,
      description,
    });
    return response.data;
  },
  getSession: async ({ projectId, name }) => {
    const response = await api.get('/api/v1/training/session/get', {
      params: { project_id: projectId, name }
    });
    return response.data;
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

export const systemAPI = {
  getHardware: async () => {
    try {
      const response = await api.get('/api/v1/system/hardware');
      return response.data;
    } catch (error) {
      handleAPIError(error, 'Failed to get hardware info');
      throw error;
    }
  }
};


export default api;
