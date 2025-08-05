# Database Max Count Issue

## Problem Description
The `transformation_combination_count` column in the database is not being populated with the correct calculated max images value.

## Current Status
- ✅ Database column `transformation_combination_count` exists
- ✅ API endpoint `/api/image-transformations/calculate-max-images` calculates correctly (min:6, max:15)
- ❌ Database update function sets incorrect value (100 instead of 15)
- ❌ Manual update endpoint works but saves wrong value

## Issue Details
When testing with release version "test_dual_value_v1":
- **Expected**: `transformation_combination_count` should be 15 (calculated max)
- **Actual**: `transformation_combination_count` is set to 100 (hardcoded value)

## Root Cause
The `update_transformation_combination_count()` function is likely using a hardcoded value instead of calling the calculation logic.

## How to Verify the Issue
1. Check current database values:
```sql
SELECT release_version, transformation_combination_count 
FROM image_transformations 
WHERE release_version = "test_dual_value_v1";
```

2. Test calculation API:
```bash
curl -X POST "http://localhost:12000/api/image-transformations/calculate-max-images" \
  -H "Content-Type: application/json" \
  -d '{"release_version": "test_dual_value_v1"}'
```

3. Compare values - they should match but currently don't.

## Solution Steps
1. **Fix the update function** in `/backend/api/routes/image_transformations.py`
   - Locate `update_transformation_combination_count()` function
   - Ensure it calls `calculate_max_images_for_transformations()` 
   - Use the calculated `max` value instead of hardcoded value

2. **Update the function to**:
   - Get transformations for the release version
   - Calculate max images using existing logic
   - Save the calculated max value to `transformation_combination_count`

3. **Test the fix**:
   - Run manual update endpoint
   - Verify database shows correct value (15)
   - Test with different release versions

## Files to Check/Modify
- `/backend/api/routes/image_transformations.py` - Main update function
- `/backend/database/models.py` - Database model
- Database: `/workspace/project/app-1/database.db`

## Expected Result After Fix
- Database `transformation_combination_count` = 15 (matches API calculation)
- Release Configuration UI displays correct "Images per Original" value
- Dual-value system shows proper limits in frontend