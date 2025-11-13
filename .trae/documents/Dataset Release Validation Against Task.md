## Scope

* Validate selected release ZIP against chosen task (Object Detection or Segmentation) and extract dataset metadata (classes, splits)

## Backend

* Add `backend/models/training/data_yaml.py` to inspect ZIP and read `data.yaml` (names, nc, train/val/test)

* Add `GET /api/v1/training/releases/inspect` with params: `project_id`, `zip_path`

  * Infer task from filename (e.g., contains `seg` → segmentation) and return `{task_inferred, classes, nc, splits}`

## Frontend

* Add `trainingAPI.inspectRelease(projectId, zipPath)`

* On release selection, call inspect; show class count, splits, and warn if task mismatch; block Start Training on mismatch

## Result

* User picks a release; UI confirms it matches the task and shows dataset details; training proceeds only when consistent

