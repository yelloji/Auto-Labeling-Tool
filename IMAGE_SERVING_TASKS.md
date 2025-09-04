# Image Serving and Viewer Implementation Tasks

This document tracks errors, requirements, and step-by-step tasks for implementing Option B (optimized image serving with resizing) and the new viewer modal. We'll update it as we complete items.

## Current Errors and Issues
- 404 errors when fetching images via non-existent endpoint `/api/v1/releases/{id}/file/{filename}`.
- Thumbnails not loading in ReleaseDetailsView due to missing backend support.
- Ensure no breaks in existing APIs like `/releases/{release_id}/package-info` or other release functionalities.

## Requirements
- Serve images directly from release ZIP without extraction for security/efficiency.
- Option B: Stream with on-the-fly resizing for fast thumbnails.
- UI: 5 images per row grid with fixed sizes, labels (split/filename).
- Modal viewer: Full image, annotations, navigation, metadata, zoom/pan.
- Long-term: Maintainable, scalable, no regressions.

## Tasks
1. **Implement backend endpoint** (In Progress): Add GET `/releases/{release_id}/file/{filename:path}` in `release_detail_view.py` with ZIP streaming and Pillow resizing.
2. **Create ReleaseImageViewerModal.jsx** (Pending): Build modal with image display, annotations, navigation, metadata, zoom/pan.
3. **Update ReleaseDetailsView.jsx** (Pending): Implement 5-per-row grid, labels, fixed sizes, modal integration.
4. **Verify full flow** (Pending): Test loading, annotations, performance, no breaks.

## Updates
- [Date]: Task 1 completed, tested locally.

Feel free to add notes here as we go!