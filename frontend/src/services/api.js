/**
 * API service for connecting frontend to backend
 * Centralized API calls with error handling
 */

import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://work-1-btzzwrbvqorkpjhi.prod-runtime.all-hands.dev',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
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
    const response = await api.get(`/models/${modelId}`);
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
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  // Update project
  updateProject: async (projectId, updateData) => {
    const response = await api.put(`/projects/${projectId}`, updateData);
    return response.data;
  },

  // Delete project
  deleteProject: async (projectId) => {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  },

  // Get project datasets
  getProjectDatasets: async (projectId) => {
    const response = await api.get(`/projects/${projectId}/datasets`);
    return response.data;
  },

  // Get project statistics
  getProjectStats: async (projectId) => {
    const response = await api.get(`/projects/${projectId}/stats`);
    return response.data;
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

  // Get specific dataset
  getDataset: async (datasetId) => {
    const response = await api.get(`/datasets/${datasetId}`);
    return response.data;
  },

  // Upload images to dataset
  uploadImages: async (datasetId, files, autoLabel = true) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('auto_label', autoLabel);

    const response = await api.post(`/datasets/${datasetId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Start auto-labeling
  startAutoLabeling: async (datasetId, autoLabelData) => {
    const response = await api.post(`/datasets/${datasetId}/auto-label`, autoLabelData);
    return response.data;
  },

  // Get dataset images
  getDatasetImages: async (datasetId, skip = 0, limit = 50, labeledOnly = null) => {
    const params = { skip, limit };
    if (labeledOnly !== null) params.labeled_only = labeledOnly;

    const response = await api.get(`/datasets/${datasetId}/images`, { params });
    return response.data;
  },
};

// Error handler for API calls
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.detail || error.response.data?.message || 'Server error';
    return {
      type: 'server_error',
      message,
      status: error.response.status,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      type: 'network_error',
      message: 'Network error - please check your connection',
    };
  } else {
    // Something else happened
    return {
      type: 'unknown_error',
      message: error.message || 'An unknown error occurred',
    };
  }
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