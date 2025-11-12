# Model Training UI Spec (v0.1)

Purpose
- Define a simple, fast, and future-ready Model Training UI with two modes: User (essential) and Developer (advanced).
- Keep code organized and framework-neutral; add framework-specific mappings (Ultralytics now, MMDetection later).

Scope (MVP)
- Framework: Ultralytics (YOLO) first.
- Tasks: Start with Detection and Segmentation (can narrow to Detection if preferred).
- Dataset source: Release ZIP from project releases (auto extract + parse data.yaml).

Mode Toggle
- Control at top of the Training window: Mode = User | Developer.
- Persist selection per user.
- Progressive disclosure: User sees essential fields; Developer sees advanced panels.

Identity
- Project ID: auto-filled from context (read-only).
- Training Name: user input.
  - Uniqueness: must be unique within the Project.
  - Allowed characters: letters, numbers, dashes, underscores. No spaces (auto-convert to `_`).
  - Suggested format: `<project>-<task>-<date>-<short-note>` (e.g., `cuffia-ext-seg-2025-02-12-v1`).
  - Length: 6–64 chars; show inline validation.

Framework & Task
- Framework selector: Ultralytics (v1). Future: MMDetection.
- Task type selector: Detection | Segmentation | Classification (pick supported set).
- Pretrained model selector:
  - Ultralytics examples (filtered by task):
    - Detection: `yolov8n.pt`, `yolov8s.pt`, `yolov8m.pt`, ...
    - Segmentation: `yolov8n-seg.pt`, `yolov8s-seg.pt`, ...
    - Classification: `yolov8n-cls.pt`, ...
  - Custom upload: path or file picker (optional for v1).

Dataset
- Source options:
  1) Release ZIP (recommended): select from project releases list.
  2) Custom Path: advanced option.
- Release ZIP flow:
  - UI: user selects a ZIP from `projects/<project>/releases/`.
  - Backend (later): validate ZIP, extract to training area, parse `data.yaml`.
  - Extraction path (proposal):
    `models/training/<project>/sources/<training_name>/<release_name>/`
  - Parsed info returned to UI:
    - train/val/test image/label paths
    - `names[]` (classes)
    - dataset type inferred (detect/seg/cls)
- UI auto-fill:
  - Read-only paths (in User mode); editable in Developer mode.
  - Classes populated from `data.yaml` (editable only in Developer mode with warning).
- Validation:
  - Dataset type must match selected Task type.
  - Paths must exist.
  - Class count > 0.

Training Preset (User mode)
- Epochs: default 50.
- Image size: default 640 (YOLO).
- Batch size: auto-estimate based on VRAM; editable.
- Mixed precision: ON by default.
- Early stop: ON by default.
- Save best only: ON by default.

Compute
- Device: GPU id selector or CPU.
- Workers: default 4 (can tune later).

Developer Mode (Advanced)
- Grouped controls with search/filter:
  - Model: variant, depth/width, backbone freeze, EMA.
  - Optimizer: type, lr, momentum/betas, weight decay.
  - Scheduler: warmup, schedule type, milestones.
  - Dataloaders: workers, shuffle, persistent workers.
  - Augmentations: mosaic, mixup, hsv, perspective, crop, rotations, flips.
  - Training: epochs, batch, gradient accumulation, clip, seed, deterministic.
  - Evaluation: val interval, metrics, NMS thresholds.
  - Checkpointing: save period, resume, save top-k.
  - Logging: log interval, verbosity.
- Framework-specific behavior:
  - Ultralytics: map directly to YAML keys; validate types/ranges.
  - MMDetection (future): provide overrides panel (JSON/dict) that applies to mmengine Config; avoid raw `.py` edits in UI.
- Raw config editor (optional, dangerous):
  - Ultralytics YAML: optional, with validation before run.
  - MMDetection: show final `.py` config read-only; overrides.json used for changes.

Final Config Preview (read-only)
- Shows resolved config after applying defaults + UI inputs.
- Saved per run:
  - Ultralytics: `configs/training.yaml` and `configs/data.yaml`.
  - MMDetection (future): `configs/config.py` and `configs/overrides.json`.

Run & Monitor (UI skeleton)
- Start / Stop buttons.
- Live logs area (hook later).
- Progress bar and basic charts (hook later).
- Run info card: epochs, batch, img_size, device, dataset counts.

Results & Export (UI skeleton)
- Checkpoints list (hook later).
- Export formats: ONNX, TorchScript, .pt.
- Model registration (hook later): save model + metadata to registry.

Validation rules
- Required: Training Name, Framework, Task type, Dataset ZIP.
- Dataset-task match: block Start if mismatch.
- Paths exist (after extraction).
- Batch size feasibility vs VRAM: show warning, suggest auto-batch.
- Type and range checks for advanced params.
- Pre-run summary modal for confirmation.

Frontend file organization (proposal)
- `frontend/src/pages/ModelTrainingPage.jsx` — container + mode toggle
- `frontend/src/components/ModelTraining/`
  - `IdentitySection.jsx`
  - `ModeToggle.jsx`
  - `FrameworkTaskSection.jsx`
  - `PretrainedModelSelect.jsx`
  - `DatasetSection.jsx`
  - `PresetSection.jsx`
  - `ComputeSection.jsx`
  - `AdvancedParamsPanel.jsx`
  - `FinalConfigPreview.jsx`
  - `RunMonitorSection.jsx`
  - `ResultsExportSection.jsx`
- `frontend/src/hooks/`
  - `useTrainingForm.js`
  - `useAdvancedParams.js`
- `frontend/src/services/`
  - `trainingApi.js` (stubs now)
  - `releasesApi.js` (stubs now)
- `frontend/src/utils/`
  - `validation.js`
  - `configResolvers/ultralyticsResolver.js`
  - `configResolvers/mmdetResolver.js` (future)
  - `parameterSchemas/ultralyticsSchema.json`
  - `parameterSchemas/mmdetSchema.json` (future)

Backend API (to wire later)
- `POST /api/datasets/extract-release` { project_id, training_name, zip_path }
- `GET /api/datasets/releases` { project_id }
- `POST /api/training/start` { project_id, training_name, framework, task, config }
- `POST /api/training/stop` { project_id, training_name }
- `GET /api/training/logs` { project_id, training_name }
- `GET /api/training/checkpoints` { project_id, training_name }
- `POST /api/training/export` { project_id, training_name, format }

Open Questions (need your decision)
1) Tasks in v1: Detection only, or Detection + Segmentation?
2) Preset defaults OK? epochs=50, img_size=640, mixed_precision=on, early_stop=on, save_best_only=on.
3) Extraction path: adopt `models/training/<project>/sources/<training_name>/<release_name>/`?
4) Allow class names editing in User mode (no) vs Developer mode (yes, with warning) — confirm.