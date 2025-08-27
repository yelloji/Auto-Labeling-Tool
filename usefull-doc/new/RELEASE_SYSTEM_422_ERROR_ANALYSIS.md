# Release System 422 Error Analysis

## Issue Summary

When attempting to create a new release in the Auto-Labeling App, the system returns a **422 Unprocessable Entity** error. This occurs when clicking the "Create Release" button after configuring a release with transformations (rotation, resize, brightness, and shear).

## Root Cause Analysis

After investigating the code, I've identified a mismatch between the frontend request payload and the backend API expectations:

### Frontend Request (ReleaseSection.jsx)
```javascript
// Frontend sends this payload
const releaseData = {
  name: releaseConfig.name,
  dataset_ids: releaseConfig.selectedDatasets,
  transformations: transformations,
  multiplier: releaseConfig.multiplier,
  target_split: { train: 70, val: 20, test: 10 },
  preserve_annotations: releaseConfig.preserveAnnotations,
  task_type: releaseConfig.taskType || 'object_detection',
  export_format: releaseConfig.exportFormat || 'yolo_detection',
  project_id: projectId || 'gevis'
};
```

### Test Script Request (test_rotation_fix.py)
```python
# Test script sends this payload (works correctly)
payload = {
    "version_name": "rotation_fix_test",
    "dataset_ids": ["1c62d270-2df3-4568-986d-0cff06cd7e7d"],
    "transformations": [
        {
            "type": "rotate",
            "params": {
                "angle": 90
            }
        }
    ],
    "multiplier": 3,
    "export_format": "yolo_detection",
    "project_id": "gevis"
}
```

### Backend Expectation (releases.py)
```python
# Backend expects this model
class ReleaseCreate(BaseModel):
    version_name: str  # ❌ Mismatch: frontend sends "name", backend expects "version_name"
    dataset_ids: List[str]
    description: Optional[str] = ""
    transformations: List[dict] = []
    multiplier: int = 1
    preserve_annotations: bool = True
    export_format: str = "YOLO"
    task_type: Optional[str] = "object_detection"
    include_images: bool = True
    include_annotations: bool = True
    verified_only: bool = False
```

### Key Discrepancies:
1. **Field Name Mismatch**: Frontend sends `name` but backend expects `version_name` (test script correctly uses `version_name`)
2. **Additional Fields**: Frontend sends fields not defined in the backend model:
   - `target_split`
   - `project_id` (test script also sends this)
3. **Missing Fields**: Frontend doesn't send some fields the backend model defines:
   - `description`
   - `include_images`
   - `include_annotations`
   - `verified_only`
4. **Transformation Format**: The test script uses a different format for transformations with a `params` object

## Solution

To fix this issue, we need to align the frontend request with the backend expectations. Here are the recommended changes:

### Option 1: Update Frontend Request
```javascript
// Updated frontend payload
const releaseData = {
  version_name: releaseConfig.name,  // ✅ Changed from "name" to "version_name"
  dataset_ids: releaseConfig.selectedDatasets,
  transformations: transformations.map(t => ({
    type: t.type,
    params: t.params  // ✅ Ensure transformations have the correct format with params object
  })),
  multiplier: releaseConfig.multiplier,
  description: "",  // ✅ Added missing field
  preserve_annotations: releaseConfig.preserveAnnotations,
  task_type: releaseConfig.taskType || 'object_detection',
  export_format: releaseConfig.exportFormat || 'yolo_detection',
  include_images: true,  // ✅ Added missing field
  include_annotations: true,  // ✅ Added missing field
  verified_only: false  // ✅ Added missing field
  // ✅ Removed "target_split" and "project_id" which aren't expected by backend
};
```

### Option 2: Update Backend Model
```python
# Updated backend model
class ReleaseCreate(BaseModel):
    name: str  # ✅ Changed from "version_name" to "name"
    dataset_ids: List[str]
    description: Optional[str] = ""
    transformations: List[dict] = []
    multiplier: int = 1
    preserve_annotations: bool = True
    export_format: str = "YOLO"
    task_type: Optional[str] = "object_detection"
    include_images: bool = True
    include_annotations: bool = True
    verified_only: bool = False
    target_split: Optional[Dict[str, int]] = None  # ✅ Added to match frontend
    project_id: Optional[str] = None  # ✅ Added to match frontend
```

## Recommended Approach

Based on the test script that works correctly, I recommend updating the frontend request to match the backend expectations. This approach is recommended because:

1. The backend API is already working correctly with the test script
2. The test script uses the correct field name `version_name` instead of `name`
3. The transformation format in the test script includes a `params` object which may be required by the backend
4. Changing the frontend is less risky than modifying the backend model which could affect other parts of the system

## Implementation Plan

1. Update the frontend code in `ReleaseSection.jsx` to match the backend API expectations:
   - Change `name` to `version_name`
   - Ensure transformations have the correct format with a `params` object
   - Add missing required fields
   - Remove fields not expected by the backend

2. Test the release creation process to verify the fix works:
   - Use the existing test script as a reference for the correct payload format
   - Verify that the UI can successfully create releases with transformations

3. Document the API contract for future reference to prevent similar issues

## Additional Observations

1. The error occurs silently in the UI with just a "Failed to create release" message
2. Better error handling with specific validation messages would improve the developer experience
3. The API documentation should be updated to reflect the expected payload structure
4. Consider adding OpenAPI/Swagger documentation to prevent future mismatches
5. The test script (`test_rotation_fix.py`) provides a working example of the correct payload format
6. The backend is already handling the `project_id` field even though it's not in the model definition
7. The transformation format in the test script is different from what the frontend is sending