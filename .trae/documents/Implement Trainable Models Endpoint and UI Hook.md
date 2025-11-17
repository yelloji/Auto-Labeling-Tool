## Backend

* Add `backend/models/training/model_selector.py` with `get_trainable_models(db, project_id, framework, task)`

* Add `backend/api/routes/training_models.py` with `GET /api/v1/training/models` using selector and serializer

* Include router in `backend/main.py`

## Frontend

* Add `trainingAPI.getTrainableModels(projectId, framework, task)` in `frontend/src/services/api.js`

* Update `PretrainedModelSelect.jsx` to call the training API and show only returned models

## Result

* Dropdown shows only trainable `.pt` models for Ultralytics by task; backend logic lives in training folder

