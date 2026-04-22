# Large Dataset Pagination Plan

## Purpose

The app must support projects and datasets with 10,000 to 50,000+ images.

Showing **50 images per page** is a UI/UX rule, not a data-size limit. The app should never require loading every image card, every thumbnail, or every annotation overlay at once.

## Core Rule

- Page size stays at 50 images by default.
- Backend APIs should return only the requested page:
  - `limit=50`
  - `offset=(page - 1) * 50`
- API responses should include:
  - `images`
  - `total`
  - `limit`
  - `offset`
- Annotation overlays should load only for visible image cards.
- Search, filter, and sort should move backend-side before this is considered complete for very large datasets.

## Screens To Update Safely Later

### Full Mode

- Dataset Section
  - Current known issue: frontend fetch uses a large hard limit around `10000`.
  - This is not acceptable for unlimited datasets.
  - UI can stay 50-per-page, but backend must page all project dataset images.
  - Move filtering/search/sort to backend pagination when possible.

- Annotation Progress
  - Current known issue: frontend fetch uses a hard limit around `1000`.
  - This must be replaced with real backend pagination.
  - UI can stay 50-per-page, but all dataset images must be reachable.

- Release Detail View
  - Currently shows 50 release images per page and uses thumbnails.
  - Keep this pattern, but verify backend/package image listing does not become too heavy for very large releases.

### User Retraining Mode

- RetrainingLabeling
  - Current status: fixed for the review UI.
  - Dataset image fetch now uses `skip` plus `limit=50`.
  - New Images tab and Old Images tab remain 50-per-page.
  - Do not render all uploaded or old dataset images at once.
  - Every image in each dataset/batch must be reachable through pagination.
  - Annotation overlays should be fetched only for visible cards.

## Known Hard Limits To Remove

- Full Mode Annotation Progress: remove current `1000` image fetch limit.
- Full Mode Dataset Section: remove current `10000` image fetch limit.
- User Retraining Mode Labeling: fixed current `200` image fetch limit in RetrainingLabeling.
- Release Detail View: verify package/release image loading has no hidden hard limit.

## Implementation Safety

- Do one screen at a time.
- Preserve existing visual behavior while changing data loading.
- Verify counts before and after pagination changes.
- Do not change annotation editing behavior while changing pagination.
- Do not mix this with release/training logic work.

## Status

User Retraining Mode review pagination is fixed. Full Mode large dataset backend pagination is still deferred until the Retraining Mode flow is complete and stable.
