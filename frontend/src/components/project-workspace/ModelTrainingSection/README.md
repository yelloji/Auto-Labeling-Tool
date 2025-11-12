# ModelTrainingSection

Main UI for configuring and starting model training jobs. This section is intentionally modular with subfolders for each part of the workflow (Identity, Setup, Dataset, Preset), which you confirmed is acceptable.

## Overview

ModelTrainingSection.jsx composes several focused components to build a training configuration:

- ModeToggle — switch between user and developer modes
- IdentitySection — project identity and training run name
- FrameworkTaskSection — training framework and task type
- PretrainedModelSelect — model selection aligned to framework/task
- DatasetSection — dataset source, ZIP path, classes
- PresetSection — training hyperparameters (epochs, image size, batch, AMP, early stop, save best)

The page shows a JSON “Config Preview” built from the form state and provides a Start Training (MVP) button. Backend wiring (ZIP extraction, logs, checkpoints, export) is to be added.

## Folder Structure

```
ModelTrainingSection/
  ModeToggle/ModeToggle.jsx
  Identity/IdentitySection.jsx
  FrameworkTask/FrameworkTaskSection.jsx
  PretrainedModel/PretrainedModelSelect.jsx
  Dataset/DatasetSection.jsx
  Preset/PresetSection.jsx
  ModelTrainingSection.jsx
  index.js
```

You can keep this subfolder structure or flatten later; imports already point to these paths.

## Usage

ModelTrainingSection is exported via components/project-workspace/index.js, so you can import it alongside other sections:

```jsx
import { ModelTrainingSection } from '../../components/project-workspace';

// Within ProjectWorkspace or a page-level component:
<ModelTrainingSection projectId={project.id} project={project} />
```

Props:
- projectId: string — used to auto-fill IdentitySection
- project: object — used to show project name

## Identity Section — Rules and Conventions

- Project ID
  - Auto-filled from the parent prop.
  - Read-only in UI to prevent mis-assignment.

- Training Name
  - User-defined and required.
  - Must be unique per project (recommended). If you already have an API to check uniqueness, provide it and the UI will validate inline.
  - Allowed characters: letters, numbers, hyphens and underscores. Spaces are discouraged; they will be slugified if needed.
  - Recommended naming convention: `<task>-<model>-<date>-<nonce>`
    - Example: `seg-yolov8n-2025-02-12-a3`
  - On submit, normalize to lowercase and replace spaces with `-`.

## Framework & Task

- FrameworkTaskSection controls:
  - framework: default `ultralytics`
  - taskType: e.g., `segmentation` (extend as needed)

## Pretrained Model

- PretrainedModelSelect aligns available models to the selected framework/task.
- The selected model string is placed under `train.model` in the config preview.

## Dataset

- Typical source: `release_zip`.
- Fields:
  - datasetZipPath: absolute/relative path to ZIP containing YOLO/Ultralytics training data (after extraction).
  - classes: list of class names; optional for MVP but recommended.
- Developer mode gating:
  - Advanced toggles are shown only when ModeToggle is set to developer.

## Preset (Training Hyperparameters)

- epochs: number (1–500)
- imgSize: number (64–2048, step 64)
- batchSize: `auto` or number
  - UI will show a numeric input. If you want explicit `auto`, leave it blank and set to `auto` in state.
- mixedPrecision (AMP): boolean
- earlyStop: boolean
- saveBestOnly: boolean

## Config Preview

Generated from the internal form state, for transparency and debugging:

```json
{
  "project_id": "...",
  "training_name": "...",
  "framework": "ultralytics",
  "task": "segmentation",
  "dataset": {
    "source": "release_zip",
    "zip_path": "...",
    "classes": ["..."]
  },
  "train": {
    "epochs": 50,
    "imgsz": 640,
    "batch": "auto",
    "amp": true,
    "early_stop": true,
    "save_best": true,
    "model": "yolov8n-seg.pt"
  }
}
```

## Start Training (MVP)

- Button is disabled until both `trainingName` and `datasetZipPath` are provided.
- Wire this to your backend job API when ready. Suggested steps:
  1) Validate identity (unique name per project)
  2) Extract ZIP to project path
  3) Launch training with structured logs
  4) Persist checkpoints and final weights to `projects/<project>/model` or `models/training`
  5) Expose streaming logs to UI (WebSocket or polling)

## Extending

- Add more tasks/frameworks:
  - Extend FrameworkTaskSection options
  - Update PretrainedModelSelect mapping
- Add advanced parameters:
  - LR, optimizer, augmentation toggles, warmup, scheduler
- Add runtime/compute selection:
  - GPU/CPU, VRAM guardrails, batch auto-derivation
- Add monitoring & results:
  - Live logs, metrics charts, export report

## Notes

- Subfolders are intentionally used for clarity. You can keep or flatten later; Update imports if flattening.
- Logging is integrated via `utils/professional_logger` to track UI usage.