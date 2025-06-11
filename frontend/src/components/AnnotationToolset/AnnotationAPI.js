/**
 * AnnotationAPI.js
 * Centralized API service for annotation operations
 */

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:12000/api/v1';

class AnnotationAPI {
  /**
   * Get all annotations for a specific image
   * @param {string} imageId - Image ID
   * @returns {Promise<Array>} Array of annotations
   */
  static async getImageAnnotations(imageId) {
    try {
      const response = await axios.get(`${API_BASE}/images/${imageId}/annotations`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch image annotations:', error);
      return [];
    }
  }

  /**
   * Create a new annotation
   * @param {Object} annotation - Annotation data
   * @returns {Promise<Object>} Created annotation
   */
  static async createAnnotation(annotation) {
    try {
      // Use the correct endpoint for saving image annotations
      const imageId = annotation.image_id;
      if (!imageId) {
        throw new Error('image_id is required for creating annotations');
      }
      
      console.log('CREATING ANNOTATION WITH TYPE:', annotation.type);
      console.log('FULL ANNOTATION DATA:', JSON.stringify(annotation));
      
      // Convert annotation to the format expected by the backend
      const annotationData = {
        class_name: annotation.class_name || annotation.label,
        class_id: 0, // Default class ID
        confidence: annotation.confidence || 1.0,
        image_id: annotation.image_id
      };
      
      // CRITICAL FIX: Handle each type separately and explicitly
      if (annotation.type === 'polygon' && Array.isArray(annotation.segmentation)) {
        console.log('SAVING POLYGON WITH POINTS:', annotation.segmentation.length);
        
        // CRITICAL: Set the type explicitly for the backend
        annotationData.type = 'polygon';
        
        // For polygons, we MUST set the segmentation field
        // Make a deep copy to avoid reference issues
        annotationData.segmentation = JSON.parse(JSON.stringify(annotation.segmentation));
        
        // Calculate bounding box from points
        const xs = annotation.segmentation.map(p => p.x);
        const ys = annotation.segmentation.map(p => p.y);
        
        // Set both coordinate formats for compatibility
        annotationData.x = Math.min(...xs);
        annotationData.y = Math.min(...ys);
        annotationData.width = Math.max(...xs) - Math.min(...xs);
        annotationData.height = Math.max(...ys) - Math.min(...ys);
        
        annotationData.x_min = Math.min(...xs);
        annotationData.y_min = Math.min(...ys);
        annotationData.x_max = Math.max(...xs);
        annotationData.y_max = Math.max(...ys);
        
        console.log('POLYGON ANNOTATION DATA:', {
          type: annotationData.type,
          segmentation_points: annotationData.segmentation.length,
          x_min: annotationData.x_min,
          y_min: annotationData.y_min,
          x_max: annotationData.x_max,
          y_max: annotationData.y_max
        });
      } 
      // CRITICAL FIX: Only handle box type in the else if, not in a generic else
      else if (annotation.type === 'box') {
        // CRITICAL: Set the type explicitly for the backend
        annotationData.type = 'box';
        
        // For boxes, set both coordinate formats
        annotationData.x = annotation.x;
        annotationData.y = annotation.y;
        annotationData.width = annotation.width;
        annotationData.height = annotation.height;
        
        annotationData.x_min = annotation.x;
        annotationData.y_min = annotation.y;
        annotationData.x_max = annotation.x + annotation.width;
        annotationData.y_max = annotation.y + annotation.height;
        
        console.log('BOX ANNOTATION DATA:', {
          type: annotationData.type,
          x_min: annotationData.x_min,
          y_min: annotationData.y_min,
          x_max: annotationData.x_max,
          y_max: annotationData.y_max
        });
      }
      // CRITICAL FIX: Handle unknown types explicitly
      else {
        console.error('Unknown annotation type:', annotation.type);
        throw new Error(`Unknown annotation type: ${annotation.type}`);
      }

      
      const response = await axios.post(`${API_BASE}/images/${imageId}/annotations`, {
        annotations: [annotationData]
      });
      
      console.log('✅ Annotation saved to database:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to create annotation:', error);
      throw error;
    }
  }

  /**
   * Update an existing annotation
   * @param {string} annotationId - Annotation ID
   * @param {Object} updates - Updated annotation data
   * @returns {Promise<Object>} Updated annotation
   */
  static async updateAnnotation(annotationId, updates) {
    try {
      console.log('Updating annotation:', annotationId, updates);
      // The annotations router is mounted at /api/v1/images
      const response = await axios.put(`${API_BASE}/images/${annotationId}`, updates);
      console.log('Update response:', response);
      return response.data;
    } catch (error) {
      console.error('Failed to update annotation:', error);
      throw error;
    }
  }

  /**
   * Delete an annotation
   * @param {string} annotationId - Annotation ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteAnnotation(annotationId) {
    if (!annotationId) {
      console.error('No annotation ID provided for deletion');
      throw new Error('Annotation ID is required for deletion');
    }
    
    try {
      console.log('AnnotationAPI: Sending DELETE request for annotation:', annotationId);
      
      // The annotations router is mounted at /api/v1/images
      // The delete endpoint is /{annotation_id}
      // So the full path is /api/v1/images/{annotation_id}
      const deleteUrl = `${API_BASE}/images/${annotationId}`;
      console.log('DELETE URL:', deleteUrl);
      
      const response = await axios.delete(deleteUrl);
      console.log('Delete annotation response:', response);
      
      return true;
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      console.error('Error details:', error.message);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  }

  /**
   * Get available labels for the current image (from existing annotations)
   * @param {Array} annotations - Current image annotations
   * @returns {Array} Unique labels used in this image
   */
  static getImageLabels(annotations) {
    const labelMap = new Map();
    
    annotations.forEach(annotation => {
      if (annotation.label_id) {
        labelMap.set(annotation.label_id, {
          id: annotation.label_id,
          name: annotation.label_id,
          color: this.generateLabelColor(annotation.label_id),
          count: (labelMap.get(annotation.label_id)?.count || 0) + 1
        });
      }
    });

    return Array.from(labelMap.values());
  }

  /**
   * Generate consistent color for a label
   * @param {string} labelId - Label identifier
   * @returns {string} Hex color
   */
  static generateLabelColor(labelId) {
    // Default color if labelId is invalid
    if (!labelId || typeof labelId !== 'string') {
      console.warn('Invalid label ID provided to generateLabelColor:', labelId);
      return '#CCCCCC'; // Default gray color
    }
    
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    let hash = 0;
    for (let i = 0; i < labelId.length; i++) {
      hash = labelId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Validate annotation data before saving
   * @param {Object} annotation - Annotation to validate
   * @returns {boolean} Is valid
   */
  static validateAnnotation(annotation) {
    if (!annotation.image_id || !annotation.label_id) {
      return false;
    }

    if (annotation.type === 'box') {
      return annotation.x !== undefined && annotation.y !== undefined && 
             annotation.width !== undefined && annotation.height !== undefined;
    }

    if (annotation.type === 'polygon') {
      return Array.isArray(annotation.coordinates) && annotation.coordinates.length >= 3;
    }

    return false;
  }

  /**
   * Get all images for a dataset
   * @param {string} datasetId - Dataset ID
   * @returns {Promise<Object>} Dataset images response
   */
  static async getDatasetImages(datasetId) {
    try {
      console.log(`Fetching images for dataset ID: ${datasetId}`);
      
      // First, get the dataset information to determine which project it belongs to
      const datasetResponse = await axios.get(`${API_BASE}/datasets/${datasetId}`);
      const dataset = datasetResponse.data;
      const projectId = dataset.project_id;
      
      console.log(`Dataset ${datasetId} belongs to project ${projectId}`);
      
      // Now fetch images for this specific dataset
      const response = await axios.get(`${API_BASE}/datasets/${datasetId}/images`);
      
      console.log(`Found ${response.data.images?.length || 0} images for dataset ${datasetId}`);
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dataset images:', error);
      throw error;
    }
  }

  /**
   * Get project labels
   * @param {string} datasetId - Dataset ID (or project ID)
   * @returns {Promise<Array>} Array of project labels
   */
  static async getProjectLabels(datasetId) {
    try {
      // First get the project ID from the dataset ID
      let projectId;
      
      try {
        // Try to get the dataset info first to find its project
        console.log(`Getting dataset info for ID: ${datasetId}`);
        const datasetResponse = await axios.get(`${API_BASE}/datasets/${datasetId}`);
        projectId = datasetResponse.data.project_id;
        console.log(`Dataset ${datasetId} belongs to project ${projectId}`);
      } catch (e) {
        // If dataset lookup fails, try using the datasetId as projectId directly
        console.log('Could not get dataset info, using datasetId as projectId');
        projectId = parseInt(datasetId);
      }
      
      console.log(`Fetching project labels for project ID: ${projectId}`);
      
      // Make the API call to get all labels for this project
      console.log(`GET ${API_BASE}/projects/${projectId}/labels`);
      const response = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
      
      // The API returns an array directly, not wrapped in a 'labels' property
      const labels = Array.isArray(response.data) ? response.data : [];
      console.log('Raw labels from API:', labels);
      
      if (labels.length === 0) {
        console.log('No labels found in database, checking local storage');
        // Try to get from local storage
        const storedLabels = localStorage.getItem(`project_labels_${datasetId}`);
        if (storedLabels) {
          try {
            const parsedLabels = JSON.parse(storedLabels);
            console.log('Found labels in local storage:', parsedLabels);
            
            // CRITICAL: Save these labels to the database one by one
            for (const label of parsedLabels) {
              try {
                console.log(`Saving local label to database: ${label.name}`);
                await this.saveProjectLabel(projectId, {
                  name: label.name,
                  color: label.color || this.generateLabelColor(label.name)
                });
              } catch (e) {
                console.error(`Failed to save local label to database: ${label.name}`, e);
              }
            }
            
            // After saving all labels, fetch them again from the API
            console.log('Fetching labels again after saving local labels');
            const refreshResponse = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
            const refreshedLabels = Array.isArray(refreshResponse.data) ? refreshResponse.data : [];
            
            if (refreshedLabels.length > 0) {
              console.log('Successfully saved labels to database:', refreshedLabels);
              
              // Transform labels to the expected format
              const formattedLabels = refreshedLabels.map(label => ({
                id: label.id,
                name: label.name,
                color: label.color || this.generateLabelColor(label.name),
                count: label.count || 0, // Use count from API if available
                projectCount: label.count || 0 // Store project-wide count
              }));
              
              // Store in local storage as backup
              localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(formattedLabels));
              
              return formattedLabels;
            }
            
            return parsedLabels;
          } catch (parseError) {
            console.error('Failed to parse stored labels:', parseError);
          }
        }
      }
      
      // Transform labels to the expected format
      const formattedLabels = labels.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color || this.generateLabelColor(label.name),
        count: label.count || 0, // Use count from API if available
        projectCount: label.count || 0 // Store project-wide count
      }));
      
      console.log('Formatted labels:', formattedLabels);
      
      // Store in local storage as backup
      localStorage.setItem(`project_labels_${datasetId}`, JSON.stringify(formattedLabels));
      
      return formattedLabels;
    } catch (error) {
      console.error('Failed to fetch project labels:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Fallback to local storage if API fails
      try {
        const storedLabels = localStorage.getItem(`project_labels_${datasetId}`);
        if (storedLabels) {
          console.log('Using labels from local storage as fallback');
          return JSON.parse(storedLabels);
        }
      } catch (e) {
        console.error('Failed to parse stored labels:', e);
      }
      
      return [];
    }
  }
  
  /**
   * Create or update a project label
   * @param {string} datasetId - Dataset ID (or project ID)
   * @param {Object} label - Label object with name, color, etc.
   * @returns {Promise<Object>} Created or updated label
   */
  static async saveProjectLabel(datasetId, label) {
    try {
      console.log('Saving project label:', label, 'for dataset:', datasetId);
      
      // Validate inputs
      if (!datasetId) {
        throw new Error('Dataset ID is required');
      }
      
      if (!label || !label.name) {
        throw new Error('Label name is required');
      }
      
      // Generate color if not provided
      if (!label.color) {
        label.color = this.generateLabelColor(label.name);
      }
      
      // First, get the project ID for this dataset
      const response = await axios.get(`${API_BASE}/datasets/${datasetId}`);
      const projectId = response.data.project_id;
      console.log(`Dataset ${datasetId} belongs to project ${projectId}`);
      
      // Prepare the label data
      const labelData = {
        name: label.name.trim(),
        color: label.color,
        project_id: parseInt(projectId)
      };
      
      console.log('Prepared label data for API:', labelData);
      
      // First check if we already have this label in local storage
      const storedLabelsStr = localStorage.getItem(`project_labels_${projectId}`);
      let existingLabel = null;
      
      if (storedLabelsStr) {
        try {
          const storedLabels = JSON.parse(storedLabelsStr);
          existingLabel = storedLabels.find(l => 
            l.name.toLowerCase() === label.name.toLowerCase()
          );
          
          if (existingLabel) {
            console.log('Found existing label in local storage:', existingLabel);
          }
        } catch (e) {
          console.error('Failed to parse stored labels:', e);
        }
      }
      
      // CRITICAL: Always check the API directly to ensure we have the latest data
      try {
        console.log(`Checking for existing label in API: GET ${API_BASE}/projects/${projectId}/labels`);
        const response = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
        const apiLabels = Array.isArray(response.data) ? response.data : [];
        console.log('API returned labels:', apiLabels);
        
        existingLabel = apiLabels.find(l => 
          l.name.toLowerCase() === label.name.toLowerCase()
        );
        
        if (existingLabel) {
          console.log('Found existing label in API:', existingLabel);
        }
      } catch (e) {
        console.error('Failed to check existing labels from API:', e);
      }
      
      let apiResponse;
      
      if (existingLabel) {
        console.log('Label already exists, updating if needed:', existingLabel);
        
        // Update existing label if color is different
        if (existingLabel.color !== labelData.color) {
          console.log(`Updating label: PUT ${API_BASE}/projects/${projectId}/labels/${existingLabel.id}`);
          apiResponse = await axios.put(
            `${API_BASE}/projects/${projectId}/labels/${existingLabel.id}`, 
            labelData
          );
          
          console.log('Label update response:', apiResponse.data);
          
          // Store in local storage as backup
          const updatedLabel = apiResponse.data;
          this.storeProjectLabelLocally(datasetId, updatedLabel);
          
          return updatedLabel;
        }
        
        // If no update needed, return existing label
        return existingLabel;
      } else {
        console.log(`Creating new label: POST ${API_BASE}/projects/${projectId}/labels`);
        console.log('Label data:', labelData);
        
        // CRITICAL: Force create new label with direct API call
        try {
          // Create new label
          apiResponse = await axios.post(
            `${API_BASE}/projects/${projectId}/labels`, 
            labelData
          );
          
          console.log('Label creation response:', apiResponse.data);
          
          // Store in local storage as backup
          const newLabel = apiResponse.data;
          this.storeProjectLabelLocally(datasetId, newLabel);
          
          // CRITICAL: Verify the label was created by fetching it again
          const verifyResponse = await axios.get(`${API_BASE}/projects/${projectId}/labels`);
          console.log('Verification response:', verifyResponse.data);
          
          return newLabel;
        } catch (createError) {
          console.error('Error creating label:', createError);
          console.error('Error response:', createError.response?.data);
          throw createError;
        }
      }
    } catch (error) {
      console.error('Failed to save project label:', error);
      
      // Create a local version of the label as fallback
      const localLabel = {
        id: Date.now(), // Use timestamp as temporary ID
        name: label.name,
        color: label.color || this.generateLabelColor(label.name),
        project_id: parseInt(datasetId)
      };
      
      console.log('Created local label as fallback:', localLabel);
      
      // Store in local storage
      this.storeProjectLabelLocally(datasetId, localLabel);
      
      return localLabel;
    }
  }
  
  /**
   * Store a project label in local storage as backup
   * @param {string} datasetId - Dataset ID
   * @param {Object} label - Label object
   */
  static async storeProjectLabelLocally(datasetId, label) {
    try {
      // First get the project ID for this dataset
      let projectId;
      try {
        const response = await axios.get(`${API_BASE}/datasets/${datasetId}`);
        projectId = response.data.project_id;
        console.log(`For localStorage: Dataset ${datasetId} belongs to project ${projectId}`);
      } catch (e) {
        console.error('Failed to get project ID for localStorage, using datasetId as fallback:', e);
        projectId = datasetId; // fallback
      }
      
      // Get existing labels from local storage
      const storageKey = `project_labels_${projectId}`;
      console.log(`Using localStorage key: ${storageKey}`);
      const storedLabelsStr = localStorage.getItem(storageKey);
      let storedLabels = [];
      
      if (storedLabelsStr) {
        storedLabels = JSON.parse(storedLabelsStr);
      }
      
      // Check if label already exists
      const existingIndex = storedLabels.findIndex(l => l.name === label.name);
      
      if (existingIndex >= 0) {
        // Update existing label
        storedLabels[existingIndex] = {
          ...storedLabels[existingIndex],
          ...label
        };
      } else {
        // Add new label
        storedLabels.push(label);
      }
      
      // Save back to local storage
      localStorage.setItem(storageKey, JSON.stringify(storedLabels));
      
      console.log(`Stored label in local storage with key ${storageKey}:`, label);
    } catch (error) {
      console.error('Failed to store label in local storage:', error);
    }
  }

  /**
   * Get image URL for display
   * @param {string} imageId - Image ID
   * @returns {Promise<string>} Image URL
   */
  static async getImageUrl(imageId) {
    try {
      // Get the image details directly by image ID
      const response = await axios.get(`${API_BASE}/datasets/images/${imageId}`);
      const image = response.data;
      
      console.log('AnnotationAPI.getImageUrl - Image found:', image);
      
      if (image && image.file_path) {
        // Backend already returns the correct web URL
        const baseUrl = API_BASE.replace('/api/v1', '');
        const imageUrl = `${baseUrl}${image.file_path}`;
        
        console.log('AnnotationAPI.getImageUrl - Generated URL:', imageUrl);
        console.log('AnnotationAPI.getImageUrl - Backend file_path:', image.file_path);
        
        return imageUrl;
      }
      
      console.log('AnnotationAPI.getImageUrl - No image or file_path found');
      return '';
    } catch (error) {
      console.error('Failed to get image URL:', error);
      return '';
    }
  }

  /**
   * Save annotation (create or update)
   * @param {Object} annotation - Annotation data
   * @returns {Promise<Object>} Saved annotation
   */
  static async saveAnnotation(annotation) {
    try {
      if (annotation.id) {
        return await this.updateAnnotation(annotation.id, annotation);
      } else {
        return await this.createAnnotation(annotation);
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      throw error;
    }
  }

  /**
   * Update image split assignment (workflow stage)
   * @param {string} imageId - Image ID
   * @param {string} split - Split assignment (unassigned/annotating/dataset)
   * @returns {Promise<boolean>} Success status
   */
  static async updateImageSplit(imageId, split) {
    try {
      await axios.patch(`${API_BASE}/images/${imageId}`, { split });
      return true;
    } catch (error) {
      console.error('Failed to update image split:', error);
      return false;
    }
  }

  /**
   * Update image split section (train/val/test)
   * @param {string} imageId - Image ID
   * @param {string} splitSection - Split section (train/val/test)
   * @returns {Promise<boolean>} Success status
   */
  static async updateImageSplitSection(imageId, splitSection) {
    try {
      // Use the correct endpoint for updating split_section
      // The endpoint is under the datasets router, not images
      await axios.put(`${API_BASE}/datasets/images/${imageId}/split-section`, { split_section: splitSection });
      return true;
    } catch (error) {
      console.error('Failed to update image split section:', error);
      console.error('Error details:', error.response?.data || error.message);
      return false;
    }
  }
}

export default AnnotationAPI;
