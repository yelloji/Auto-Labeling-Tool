# Annotation Transformation Debug Log

## Last Updated: 2024-06-29

### Files Checked and Findings

- **backend/core/annotation_transformer.py**
  - Verified matrix-based and legacy annotation transformation paths.
  - Matrix path uses affine matrix for precise updates; fallback path uses sequential config (flip, resize, crop, etc.).
  - Logging confirms when matrix path is used (`has_affine_matrix: True`).

- **backend/core/image_generator.py**
  - Confirmed affine matrix is built and passed to annotation updater.
  - Matrix is stored as `affine_json` for each image variant (DB insert/update logic not fully verified).
  - Annotation updates use matrix if present; fallback logic otherwise.

- **backend/database/models.py**
  - Could not directly confirm schema for `affine_json` in `image_variants` table due to missing context.

- **backend/database/archive/migrations.py**
  - No direct evidence of `affine_json` column creation or update logic found.

- **backend/api/routes/**
  - No direct evidence of exporter/viewer reading and using `affine_json` for annotation reconstruction.

### Key Dates

- 2024-06-29: Verified matrix path and fallback logic in annotation_transformer.py and image_generator.py.
- 2024-06-29: Searched for DB schema and commit logic for affine_json; not fully confirmed.

### Next Steps

- Double-check `image_variants` table for `affine_json` column and commit logic after insert/update.
- Ensure exporter/viewer loads and uses `affine_json` for annotation updates.
- Provide sample DB row, exported annotation JSON, and log line for further debugging if needed.

---

This document is updated as of 2024-06-29. All findings and file checks are listed for reference.

## Purpose
Track all files, logic, and notes needed to debug and achieve perfect annotation transformation (pixel-based) for the project.

## Key Facts
- Annotation data in the annotation table is stored in pixel coordinates.
- Goal: Ensure annotation transformations (bounding box, polygon) match image transformations exactly.

## Files to Check
- backend/core/image_generator.py: Handles image augmentation and annotation update logic.
- backend/core/annotation_transformer.py: Transforms annotation coordinates for geometric operations.
- backend/core/transformation_config.py: Stores and retrieves transformation parameters.
- backend/core/transformation_schema.py: Defines transformation config schema/order.
- backend/core/utils/image_transformer.py: Applies affine and geometric transforms to images.
- backend/database/models.py: Defines annotation table schema (pixel coordinates).
- backend/api/services/transform_resolver.py: Resolves transformation configs into ordered operation tapes for images and annotations.
- backend/api/services/affine_builder.py: Builds affine transformation matrices for image and annotation operations.
- backend/database/image_variant_repository.py: Handles storage and retrieval of image variants and their associated annotation operations.

## Next Steps
- Note down what each file does and how it affects annotation transformation.
- Document any mismatches or issues found during debugging.
- Update this file as we progress.