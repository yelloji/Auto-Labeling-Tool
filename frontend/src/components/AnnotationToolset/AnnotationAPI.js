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
      
      // Convert annotation to the format expected by the backend
      const annotationData = {
        class_name: annotation.class_name || annotation.label,
        class_id: 0, // Default class ID
        confidence: annotation.confidence || 1.0,
        type: annotation.type || 'box',
        image_id: annotation.image_id
      };
      
      // Add defensive checks for polygon type
      if (annotation.type === 'polygon') {
        // Check if segmentation exists and is an array
        if (!annotation.segmentation || !Array.isArray(annotation.segmentation)) {
          console.error('Invalid segmentation data:', annotation.segmentation);
          throw new Error('Invalid polygon data: segmentation is missing or invalid');
        }
        
        // Check if segmentation has points
        if (annotation.segmentation.length === 0) {
          console.error('Empty segmentation data');
          throw new Error('Invalid polygon data: no points provided');
        }
        
        // Validate each point has x and y coordinates
        const validPoints = annotation.segmentation.every(
          point => point && typeof point.x === 'number' && typeof point.y === 'number'
        );
        
        if (!validPoints) {
          console.error('Invalid points in segmentation:', annotation.segmentation);
          throw new Error('Invalid polygon data: points are missing or invalid');
        }
        
        annotationData.segmentation = annotation.segmentation;
      } else {
        // For box annotations
        if (typeof annotation.x !== 'number' || typeof annotation.y !== 'number' ||
            typeof annotation.width !== 'number' || typeof annotation.height !== 'number') {
          console.error('Invalid box coordinates:', annotation);
          throw new Error('Invalid box data: coordinates are missing or invalid');
        }
        
        annotationData.x_min = annotation.x;
        annotationData.y_min = annotation.y;
        annotationData.x_max = annotation.x + annotation.width;
        annotationData.y_max = annotation.y + annotation.height;
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
      const response = await axios.put(`${API_BASE}/images/${annotationId}`, updates);
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
    try {
      await axios.delete(`${API_BASE}/annotations/${annotationId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete annotation:', error);
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
      // Get project ID from dataset - for now we'll use project 1
      const response = await axios.get(`${API_BASE}/projects/1/images`);
      
      // Filter images by dataset ID
      const filteredImages = response.data.images.filter(img => img.dataset_id === datasetId);
      
      return {
        ...response.data,
        images: filteredImages,
        total: filteredImages.length
      };
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
      // For now, return empty array - labels will be created dynamically
      return [];
    } catch (error) {
      console.error('Failed to fetch project labels:', error);
      return [];
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
   * Update image split assignment
   * @param {string} imageId - Image ID
   * @param {string} split - Split assignment (train/val/test)
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
}

export default AnnotationAPI;