# Centralized API Integration Fixes

## Overview
Fixed the frontend to properly use the centralized API service (`src/services/api.js`) instead of direct fetch calls, ensuring consistent error handling and proper endpoint usage.

## Issues Identified and Fixed

### 1. **Upload Section Issues**
**Problem**: The UploadSection component was using mixed API approaches:
- Direct `fetch()` calls to incorrect endpoints (`/api/projects/${projectId}/upload`)
- Inconsistent error handling
- Missing API functions for project uploads

**Solution**:
- Added missing upload functions to `projectsAPI` in `api.js`:
  - `uploadImagesToProject()` - Single file upload
  - `uploadMultipleImagesToProject()` - Bulk file upload
  - `getRecentImages()` - Get recent project images (placeholder)
- Updated UploadSection to use centralized API functions
- Fixed endpoint URLs to use correct `/api/v1/projects/` prefix
- Standardized error handling using `handleAPIError()`

### 2. **Management Section Issues**
**Problem**: Management section was already using centralized API but some functions were missing proper error handling.

**Solution**:
- Verified all management functions use `projectsAPI` correctly
- Ensured consistent error handling throughout

### 3. **API Service Enhancements**
**Added Functions**:
```javascript
// Upload images to project
uploadImagesToProject: async (projectId, formData) => {
  const response = await api.post(`/api/v1/projects/${projectId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
},

// Upload multiple images to project (bulk upload)
uploadMultipleImagesToProject: async (projectId, formData) => {
  const response = await api.post(`/api/v1/projects/${projectId}/upload-bulk`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
},

// Get recent images for project
getRecentImages: async (projectId, limit = 6) => {
  // Placeholder implementation - returns empty array for now
  return [];
}
```

### 4. **Endpoint Corrections**
**Fixed Endpoints**:
- ❌ `/api/projects/${projectId}/upload` 
- ✅ `/api/v1/projects/${projectId}/upload`
- ❌ Direct fetch calls
- ✅ Centralized API service calls

### 5. **Error Handling Standardization**
**Before**:
```javascript
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Upload failed');
} catch (error) {
  message.error(`Failed: ${error.message}`);
}
```

**After**:
```javascript
try {
  const result = await projectsAPI.uploadImagesToProject(projectId, formData);
  message.success('Upload successful!');
} catch (error) {
  const errorInfo = handleAPIError(error);
  message.error(`Failed: ${errorInfo.message}`);
}
```

## Files Modified

### 1. `/frontend/src/services/api.js`
- Added `uploadImagesToProject()` function
- Added `uploadMultipleImagesToProject()` function  
- Added `getRecentImages()` placeholder function

### 2. `/frontend/src/components/project-workspace/UploadSection/UploadSection.js`
- Replaced direct fetch calls with centralized API calls
- Updated `uploadFile()` function to use `projectsAPI.uploadImagesToProject()`
- Updated `uploadMultipleFiles()` function to use `projectsAPI.uploadMultipleImagesToProject()`
- Fixed Dragger component action URL to use correct endpoint
- Standardized error handling throughout

## Backend Verification
✅ Backend endpoints are correctly implemented:
- `POST /api/v1/projects/{project_id}/upload` - Single file upload
- `POST /api/v1/projects/{project_id}/upload-bulk` - Multiple file upload
- Routes are properly mounted with `/api/v1/projects` prefix

## Testing Status
✅ Backend running on port 12000
✅ Frontend running on port 12001  
✅ API health check successful
✅ Projects API endpoint responding correctly
✅ Upload endpoints available and properly routed

## Benefits of Centralized API Integration

1. **Consistency**: All API calls use the same base configuration, headers, and interceptors
2. **Error Handling**: Standardized error handling across all components
3. **Maintainability**: Single place to update API endpoints and configuration
4. **Debugging**: Centralized logging and request/response interceptors
5. **Cache Control**: Automatic cache busting for GET requests
6. **Type Safety**: Better TypeScript support (if migrated later)

## Next Steps
1. Test upload functionality in the browser
2. Add proper backend endpoint for `getRecentImages()` if needed
3. Consider migrating other components using direct fetch calls to centralized API
4. Add unit tests for API service functions

## Components Still Using Direct Fetch (Future Improvements)
- `DataAugmentation.js` - Uses direct fetch for augmentation endpoints
- `DatasetAnalytics.js` - Uses direct fetch for analytics endpoints
- `AnnotationToolset/LabelSelectionPopup.js` - Uses direct fetch
- `AnnotationToolset/SmartPolygonTool.js` - Uses direct fetch

These components use specialized endpoints that may need their own API service sections.