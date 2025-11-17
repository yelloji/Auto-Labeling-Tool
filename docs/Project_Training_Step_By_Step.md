# Project Training — Step‑by‑Step Tasks

## Overview
- Frameworks: start with Ultralytics YOLO; later add MMDetection
- Scope: Developer mode (full options) first, then derive User mode (safe subset)
- Project‑scoped I/O: inputs under `projects/<Project>/training_data/<release_slug>/`, outputs under `projects/<Project>/model/training/<training_name>/`

## Prerequisites
- A project exists and a release ZIP has been extracted to `training_data/<release_slug>/`
- Base config file present for Ultralytics (e.g., `default_yolo11.yaml`)
- Backend logging category `operations.training` enabled

## Backend Tasks
1) Config Base and Resolver
- Place base configs under `backend/models/training/configs/ultralytics/{detection,segmentation}/default.yaml`
- Implement a resolver that merges UI patches onto the base YAML and emits:
  - Resolved YAML (for reproducibility)
  - CLI args preview (for transparency)
- Endpoints:
  - `GET /api/v1/training/config/default?framework=ultralytics&task=segmentation`
  - `POST /api/v1/training/config/resolve` { base_config, overrides }

2) Training Runner
- File: `backend/models/training/training_runner.py`
- Responsibilities:
  - Build runtime command from resolved config
  - Launch Ultralytics process and stream logs
  - Track job status (queued → running → completed/failed)
  - Save checkpoints and best weights under `projects/<Project>/model/training/<training_name>/weights/`
  - Persist run metadata (config snapshot, paths, timestamps)
- Endpoints:
  - `POST /api/v1/training/start` { project_id, training_name, framework, task, dataset_path, config }
  - `POST /api/v1/training/stop` { project_id, training_name }
  - `GET /api/v1/training/logs` { project_id, training_name, page/offset }
  - `GET /api/v1/training/checkpoints` { project_id, training_name }

3) Model Export and Registration
- After training finishes, copy best weights to a stable location:
  - `projects/<Project>/model/training/<training_name>/weights/best.pt`
- Upsert AiModel with:
  - `file_path`: relative path to `best.pt`
  - `project_id`: numeric project id
  - `type` and `format`: based on task/framework
  - `training_input_size`, classes, and metadata

4) Extraction (completed)
- Check extracted: `GET /api/v1/training/check-extracted?zip_path=projects/<Project>/releases/<zip>`
- Extract release: `POST /api/v1/training/extract-release` { zip_path }
- Cascade delete handled when release ZIP is deleted

## Frontend Tasks
1) Training Preset (Developer/User Modes)
- Developer mode: full advanced options (optimizer/LR/scheduler, aug, loss, freeze, workers, save cadence, seed/resume, device)
- User mode: minimal safe options (epochs, imgsz, batch, amp, early_stop, save_best, device)
- Both generate overrides for the resolver

2) Data Source and Preflight
- Dataset section shows extracted target dir and classes (from data.yaml)
- Preflight button:
  - Calls resolver; shows resolved YAML and CLI preview
  - Validates required inputs (name, dataset path, model)

3) Start Training and Monitor
- Start button posts `training/start`
- Status panel shows:
  - Live logs (poll or stream)
  - Progress percent (derived from epochs/logs)
  - Checkpoints list and “Export Best” action

4) Post‑Run
- On completion, refresh Project Models; new AiModel appears under the project with Ready status

## Paths and Structure
- Input: `projects/<Project>/training_data/<release_slug>/`
- Output: `projects/<Project>/model/training/<training_name>/`
  - `weights/` — checkpoints and `best.pt`
  - `logs/` — runtime logs and summaries
  - `artifacts/` — resolved config YAML, report JSON, figures

## Logging and Diagnostics
- Use `operations.training` for runner and resolver events
- Use `app.backend` for API calls; `errors.system/validation` for failures
- Log resolved config snapshot and command preview for reproducibility

## Safety and Cleanup
- On release delete: cascade remove `training_data/<slug>/` if exists (already implemented)
- Do not delete training outputs automatically; explicit actions only
- Orphan cleanup script (internal use) should touch DB rows only when image count is zero

## Milestones
- M1: Resolver + endpoints + Developer Preset UI + Start/Stop/Logs/Checkpoints
- M2: Export Best + AiModel upsert + Project Models refresh
- M3: User Preset UI (subset) derived from Developer config
- M4: Add MMDetection configs/resolver; reuse same UI shell

## Deliverables
- Backend files: configs, resolver, training_runner, API routes
- Frontend: Preset section (mode‑aware), dataset/preflight, monitor panel
- Documentation: this plan and a short “Quick Start” for training from UI