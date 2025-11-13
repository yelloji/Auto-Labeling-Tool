## Why
- The UI reads `/api/v1/projects/{id}/models` which is a general listing. To avoid touching that, we’ll add a dedicated training endpoint that returns only trainable models.

## What I’ll Add
- `backend/models/training/model_selector.py` — `get_trainable_models(db, project_id, framework, task)`
  - Ultralytics: `.pt` + `format='pytorch'`, `type in {'object_detection','instance_segmentation'}`
  - MMDet (later): `.pth` + `config_path`
- `backend/api/routes/training_models.py` — `GET /api/v1/training/models?project_id&framework&task`
  - Calls `model_selector.get_trainable_models`

## Minimal UI Hook
- `frontend/src/services/api.js`: `trainingAPI.getTrainableModels(projectId, framework, task)`
- `PretrainedModelSelect.jsx`: use this endpoint; no random UI changes.

## Result
- Clean separation: logic lives in training folder; UI shows only real trainable models per framework/task.

Proceed?