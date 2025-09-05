# Automatic Release Statistics Population

This document describes how the backend automatically derives and stores dataset–level statistics **after** a release ZIP package is generated.

## Overview
1. **ZIP creation** – When a user creates a release, the existing pipeline builds the ZIP file on-disk (`model_path`).
2. **Background worker** – Immediately after successful ZIP creation the route `POST /releases/create` schedules `schedule_zip_stats_update(release_id)`.
3. **Worker execution** – A daemon thread defined in `backend/services/release_stats_worker.py` parses the ZIP once and writes statistics back to the `releases` table.
4. **Frontend visibility** – Columns such as `train_image_count`, `class_count`, and `classes_json` become available to the UI through the standard releases endpoints.

## Database Columns Populated
| Column | Description |
| ------ | ----------- |
| `train_image_count` | Number of images in `images/train/` |
| `val_image_count`   | Number of images in `images/val/`   |
| `test_image_count`  | Number of images in `images/test/`  |
| `class_count`       | Total number of distinct object classes |
| `classes_json`      | JSON list of class names or numeric IDs |
| `shapes_json`*      | Placeholder for per-shape summaries (future) |

\* `shapes_json` will be filled in a later milestone once polygon/box metrics are agreed.

## Implementation Details
- **Entry point:** `schedule_zip_stats_update` spawns a daemon `Thread` so the API response remains fast.
- **Fast path:** If `metadata/dataset_stats.json` exists inside the ZIP the worker trusts its counts (created by `ReleaseController.create_zip_package`).  This keeps the operation O(1) with respect to the number of ZIP entries.
- **Fallback:** If metadata is missing the worker iterates through the archive, counting image files (`*.jpg`, `*.png`, …) under `images/<split>/` folders and derives class IDs from YOLO label files.
- **Error handling:** Any exception is logged with `zip_stats_worker_*` tags but never blocks the user flow.
- **Idempotency:** Re-running the worker on the same release simply overwrites the same DB columns; the thread exits once done.

## Future Improvements
1. **Shape distribution** – tally bounding boxes, polygons and segmentations for deeper insights.
2. **Periodic consistency check** – cron-like task to ensure all releases have cached stats even if worker failed.
3. **UI enhancements** – display split bars and class badges using the new columns (see `frontend_stats_display_plan`).

---
_Updated: 2023-10-12_