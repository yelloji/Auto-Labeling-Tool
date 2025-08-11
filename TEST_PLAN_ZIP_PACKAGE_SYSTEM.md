# ZIP Package System Test Plan

## Available Datasets
- **Car Dataset**: 5 labeled images
- **Animal Dataset**: 3 labeled images
- **Rakesh Dataset**: 3 labeled images
- **Good Dataset**: 1 labeled image

## Test Cases (Simple to Complex)

### Test Case 1: Basic Single Dataset Export
**Configuration:**
- **Dataset**: Car Dataset only
- **Split Ratio**: 80% train, 10% val, 10% test (4-0-1)
- **Images per Original**: 2
- **Export Format**: YOLO Detection
- **Transformations**: 
  - Brightness (min: 0.8, max: 1.2)
  - Rotation (min: -15, max: 15)

**Expected Results:**
- ZIP file created with proper structure
- 10 total images (5 original + 5 augmented)
- Metadata files contain correct information
- README.md generated with dataset statistics

### Test Case 2: Multi-Dataset Simple Export
**Configuration:**
- **Datasets**: Car Dataset + Animal Dataset
- **Split Ratio**: 70% train, 15% val, 15% test
- **Images per Original**: 3
- **Export Format**: YOLO Detection
- **Transformations**:
  - Brightness (min: 0.8, max: 1.2)
  - Rotation (min: -15, max: 15)
  - Flip (horizontal)

**Expected Results:**
- ZIP file with images from both datasets
- 32 total images (8 original + 24 augmented)
- Metadata shows correct dataset distribution
- Labels preserved correctly for both datasets

### Test Case 3: Format Conversion Test
**Configuration:**
- **Dataset**: Rakesh Dataset
- **Split Ratio**: 60% train, 20% val, 20% test
- **Images per Original**: 2
- **Export Format**: COCO
- **Output Format**: PNG (convert from original)
- **Transformations**:
  - Brightness (min: 0.7, max: 1.3)
  - Contrast (min: 0.8, max: 1.2)

**Expected Results:**
- All images converted to PNG format
- COCO format annotations in metadata
- 9 total images (3 original + 6 augmented)
- Image quality preserved during conversion

### Test Case 4: Complex Multi-Dataset with Format Conversion
**Configuration:**
- **Datasets**: All datasets (Car, Animal, Rakesh, Good)
- **Split Ratio**: 75% train, 15% val, 10% test
- **Images per Original**: 4
- **Export Format**: YOLO Detection
- **Output Format**: JPG (convert all to jpg)
- **Transformations**:
  - Brightness (min: 0.7, max: 1.3)
  - Contrast (min: 0.8, max: 1.2)
  - Rotation (min: -30, max: 30)
  - Flip (horizontal and vertical)
  - Blur (min: 0, max: 1.0)

**Expected Results:**
- ZIP file with complex directory structure
- 60 total images (12 original + 48 augmented)
- All images converted to JPG format
- Metadata shows distribution across all datasets
- Transformation logs show all applied transformations

### Test Case 5: Edge Case - Maximum Transformations
**Configuration:**
- **Dataset**: Car Dataset
- **Split Ratio**: 100% train, 0% val, 0% test
- **Images per Original**: 8 (maximum)
- **Export Format**: YOLO Detection
- **Transformations**: Apply all available transformations with wide ranges

**Expected Results:**
- ZIP file with highly diverse augmented images
- 45 total images (5 original + 40 augmented)
- Transformation logs show complex combinations
- All augmented images properly labeled

### Test Case 6: Edge Case - Preserve Original Splits
**Configuration:**
- **Datasets**: Car Dataset + Animal Dataset
- **Split Ratio**: Use original dataset splits
- **Images per Original**: 3
- **Export Format**: Pascal VOC
- **Preserve Original Splits**: Yes

**Expected Results:**
- ZIP file maintains original train/val/test assignments
- Directory structure preserves original organization
- 32 total images (8 original + 24 augmented)
- Metadata shows original split preservation

## Testing Procedure

1. **For each test case:**
   - Configure the release settings as specified
   - Generate the release
   - Download the ZIP package
   - Extract and verify the structure
   - Check metadata files for correctness
   - Verify image counts and transformations

2. **Verification Checklist:**
   - ✅ ZIP file created successfully
   - ✅ Directory structure matches expected format
   - ✅ Image counts match expectations (original + augmented)
   - ✅ Labels/annotations correctly transformed
   - ✅ Metadata files contain accurate information
   - ✅ README.md generated with correct statistics
   - ✅ Split ratios maintained as configured

3. **API Endpoint Testing:**
   - Test `/releases/{release_id}/download` endpoint
   - Test `/releases/{release_id}/package-info` endpoint
   - Verify response formats and content

## Results Tracking

| Test Case | Status | ZIP Created | Structure Correct | Image Count | Notes |
|-----------|--------|-------------|-------------------|-------------|-------|
| Case 1    | 🔄     | -           | -                 | -           | -     |
| Case 2    | 🔄     | -           | -                 | -           | -     |
| Case 3    | 🔄     | -           | -                 | -           | -     |
| Case 4    | 🔄     | -           | -                 | -           | -     |
| Case 5    | 🔄     | -           | -                 | -           | -     |
| Case 6    | 🔄     | -           | -                 | -           | -     |

## Notes for Testing

- Start with Test Case 1 (simplest) and progress to more complex cases
- For each test, record the actual results in the tracking table
- Take screenshots of the UI and ZIP contents for documentation
- Note any discrepancies between expected and actual results
- If an issue is found, fix it before proceeding to the next test case