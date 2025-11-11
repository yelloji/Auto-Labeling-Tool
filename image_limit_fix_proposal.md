# Proposed Fix for Image Loading Limit in Annotation Canvas

This document details the exact changes needed to fix the 50-image limit in the annotation canvas. It includes file paths, exact line numbers (based on current file contents), old code snippets, and new code snippets.

## Change 1: Update AnnotationAPI.js to Handle Skip and Limit Parameters

**File:** v:\stage-1-labeling-app\app-3-fix-release-system-422-error\frontend\src\components\AnnotationToolset\AnnotationAPI.js  
**Exact Lines:** 400-440 (full function span)  

**Old Code:**  
```
static async getDatasetImages(datasetId) {
  try {
    logInfo('app.frontend.interactions', 'get_dataset_images_started', 'Fetching dataset images started', {
      datasetId
    });

    console.log(`Fetching images for dataset ID: ${datasetId}`);
    
    // First, get the dataset information to determine which project it belongs to
    const datasetResponse = await axios.get(`${API_BASE}/datasets/${datasetId}`);
    const dataset = datasetResponse.data;
    const projectId = dataset.project_id;
    
    logInfo('app.frontend.ui', 'dataset_project_mapping', 'Dataset project mapping found', {
      datasetId,
      projectId
    });

    console.log(`Dataset ${datasetId} belongs to project ${projectId}`);
    
    // Now fetch images for this specific dataset
    const response = await axios.get(`${API_BASE}/datasets/${datasetId}/images`);
    
    const imageCount = response.data.images?.length || 0;
    logInfo('app.frontend.interactions', 'get_dataset_images_success', 'Dataset images fetched successfully', {
      datasetId,
      projectId,
      imageCount
    });

    console.log(`Found ${imageCount} images for dataset ${datasetId}`);
    
    return response.data;
  } catch (error) {
    logError('app.frontend.validation', 'get_dataset_images_failed', 'Failed to fetch dataset images', {
      datasetId,
      error: error.message,
      status: error.response?.status
    });
    console.error('Failed to fetch dataset images:', error);
    throw error;
  }
}
```

**New Code:** (Updated to include skip and limit, and add them to the URL)  
```
static async getDatasetImages(datasetId, skip = 0, limit = 50) {
  try {
    logInfo('app.frontend.interactions', 'get_dataset_images_started', 'Fetching dataset images started', {
      datasetId,
      skip,
      limit
    });

    console.log(`Fetching images for dataset ID: ${datasetId} with skip=${skip} limit=${limit}`);
    
    // First, get the dataset information to determine which project it belongs to
    const datasetResponse = await axios.get(`${API_BASE}/datasets/${datasetId}`);
    const dataset = datasetResponse.data;
    const projectId = dataset.project_id;
    
    logInfo('app.frontend.ui', 'dataset_project_mapping', 'Dataset project mapping found', {
      datasetId,
      projectId
    });

    console.log(`Dataset ${datasetId} belongs to project ${projectId}`);
    
    // Now fetch images for this specific dataset with parameters
    const response = await axios.get(`${API_BASE}/datasets/${datasetId}/images?skip=${skip}&limit=${limit}`);
    
    const imageCount = response.data.images?.length || 0;
    logInfo('app.frontend.interactions', 'get_dataset_images_success', 'Dataset images fetched successfully', {
      datasetId,
      projectId,
      imageCount
    });

    console.log(`Found ${imageCount} images for dataset ${datasetId}`);
    
    return response.data;
  } catch (error) {
    logError('app.frontend.validation', 'get_dataset_images_failed', 'Failed to fetch dataset images', {
      datasetId,
      skip,
      limit,
      error: error.message,
      status: error.response?.status
    });
    console.error('Failed to fetch dataset images:', error);
    throw error;
  }
}
```

## Change 2: Update Call in ManualLabeling.jsx to Pass Parameters

**File:** v:\stage-1-labeling-app\app-3-fix-release-system-422-error\frontend\src\pages\annotation\ManualLabeling.jsx  
**Exact Line:** 612  

**Old Code:**  
```
const response = await AnnotationAPI.getDatasetImages(datasetId);
```

**New Code:**  
```
const response = await AnnotationAPI.getDatasetImages(datasetId, 0, 1000);
```

These changes will allow loading up to 1000 images. The updates maintain all existing logging and logic. If approved, I can apply them directly.