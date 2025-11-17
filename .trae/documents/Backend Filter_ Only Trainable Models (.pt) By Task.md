## What I'll Do (backend only)
- Update `/api/v1/projects/{project_id}/models` to return only trainable models:
  - `format == 'pytorch'` and `file_path` ends with `.pt`
  - `type` in {'object_detection','instance_segmentation'}
- No UI changes; the dropdown will auto-enable with real `.pt` models per task.

## Files
- Edit `backend/api/routes/projects.py` (filter before serialization)

## Later (MMDetection)
- Extend filter for framework=MMDet: `.pth` + `config_path` (no DB changes now)

Proceed?