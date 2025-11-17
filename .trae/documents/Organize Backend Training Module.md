## What I Propose (short)
- Keep `TrainingSession` (done) and add a clean training module under `backend/models/training/`.

## Folder Layout
- `interfaces.py` — simple `Trainer` interface (prepare, train, status)
- `adapters/ultralytics.py` — Ultralytics YOLO trainer (current)
- `adapters/mmdetection.py` — placeholder adapter (later)
- `runner.py` — orchestrates a training job (reads config, updates status)
- `repository.py` — DB CRUD for `TrainingSession`
- `data_yaml.py` — parse data.yaml from release ZIP (classes, splits)
- `dto.py` — Pydantic schemas for training requests/responses

## Flow
1) Parse dataset ZIP → data.yaml → classes/splits
2) Create `TrainingSession` → start `runner` with chosen `Trainer`
3) Update status/metrics → store outputs in `projects/{projectId}/models/{sessionId}/`

## Now vs Later
- Now: Ultralytics adapter + runner + data.yaml parser + repository
- Later: MMDetection adapter; same interface so no other changes

## Questions
- Confirm outputs path: `projects/{projectId}/models/{sessionId}/`?
- OK to add these files under `backend/models/training/`?
- Device string from UI (`cpu` or `cuda:{index}`) will be passed to trainer.

If approved, I'll create these files and wire minimal status functions.