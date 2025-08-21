# Database Migration Archive

## Overview
This folder contains **one-time database migration scripts** that have already been executed and are no longer needed for regular application operation.

## Files Archived

### 1. `add_user_selected_images_migration.py`
- **Purpose**: Adds `user_selected_images_per_original` column to `image_transformations` table
- **Status**: ✅ COMPLETED - Column added successfully
- **Date**: August 2025

### 2. `add_transformation_combination_count_migration.py`
- **Purpose**: Adds `transformation_combination_count` column to `image_transformations` table
- **Status**: ✅ COMPLETED - Column added successfully
- **Date**: August 2025

### 3. `update_combination_counts.py`
- **Purpose**: Updates existing combination count values to include original file
- **Status**: ✅ COMPLETED - Values updated successfully
- **Date**: August 2025

### 4. `dual_value_migration.py`
- **Purpose**: Adds dual-value system columns to `image_transformations` table
- **Status**: ✅ COMPLETED - Columns added successfully
- **Date**: August 2025

## Important Notes

⚠️ **DO NOT DELETE THESE FILES** - They serve as documentation of database schema evolution.

⚠️ **DO NOT RUN THESE FILES AGAIN** - They are one-time migrations that have already been executed.

⚠️ **FOR REFERENCE ONLY** - These files show what database changes were made during development.

## Current Database Operations

The main application now uses:
- `backend/database/database.py` - Database initialization and session management
- `backend/database/models.py` - Current database models
- `backend/database/operations.py` - Database operations
- `backend/database/migrations.py` - Main migration utility (if needed for future schema changes)

## Migration History

These files represent the database schema evolution from the initial release system to the current professional logging system implementation.

---
*Archived on: August 13, 2025*
*Reason: One-time migrations completed, keeping for documentation*
