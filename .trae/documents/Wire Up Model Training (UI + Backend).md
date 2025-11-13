## Summary

* Implement minimal training API and wire the existing UI.

* Use `TrainingSession` only (no iterations/uncertain samples).

## Backend Endpoints (new)

* `POST /api/v1/training/sessions` — create session with config + dataset path + base model.

* `POST /api/v1/training/sessions/{id}/start` — start async training job; persist status.

* `GET /api/v1/training/sessions/{id}/status` — progress, metrics, last log snippet.

* `GET /api/v1/training/sessions/{id}` — session details.

## Training Execution

* Background worker (thread) stub now; integrate Ultralytics later.

* Persist status: `pending → running → completed/failed` in `TrainingSession`.

* Store outputs under `projects/{projectId}/models/{sessionId}/` (checkpoints, logs).

## Frontend Wiring

* On “Start Training (MVP)”:

  * Create session → start training → begin polling status.

* Show status and last logs in `ModelTrainingSection`.

* Use selected release `.zip` as dataset path, plus hyperparameters.

## Error Handling

* Map backend validation to UI via existing `handleAPIError` (422 friendly messages).

* Guardrails: dataset zip not found, invalid config, base model missing.

## Questions

* Confirm training framework: Ultralytics YOLO for MVP?

* Confirm outputs location: `projects/{projectId}/models/{sessionId}/` acceptable?

* Polling interval preference (e.g., 2–3s)?

## Next

* After approval, I’ll add the router, worker stub, and wire the UI button + status panel.

