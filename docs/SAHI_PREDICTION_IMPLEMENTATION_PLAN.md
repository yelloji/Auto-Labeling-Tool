# SAHI Prediction Implementation Plan

This plan covers the new **SAHI Prediction** workflow for tile-enabled projects.

SAHI Prediction must be a separate Model Lab tab beside the existing Prediction tab. It must not change or merge with normal Prediction.

---

## Core Product Rule

- Normal Prediction remains unchanged.
- SAHI Prediction appears only when `project.tile_enabled = true`.
- SAHI Prediction runs on full original dataset-stage images.
- SAHI Prediction does not run on tiled release images.
- The trained model can still come from a tiled/balanced release training run.
- Output predictions are stitched back into original full-image coordinates.
- Heavy work runs in a subprocess, same as training, validation, and normal prediction.

---

## Official References Checked

### SAHI Documentation

- SAHI is a lightweight vision library for large-scale object detection and instance segmentation.
- SAHI supports Ultralytics models including YOLOv8, YOLO11, and YOLO26.
- Official docs confirm the low-level API:
  - `AutoDetectionModel.from_pretrained(...)`
  - `get_sliced_prediction(...)`
- Official docs confirm SAHI can export visuals and return prediction objects.

Reference:
- https://obss.github.io/sahi/
- https://obss.github.io/sahi/predict/
- https://obss.github.io/sahi/models/ultralytics/

### Ultralytics Documentation

- Ultralytics documents SAHI tiled inference as splitting high-resolution images into slices, running YOLO per slice, and stitching predictions back onto the original image.

Reference:
- https://docs.ultralytics.com/guides/sahi-tiled-inference

### Postprocessing

- SAHI supports NMS / NMM / GreedyNMM style postprocessing.
- `match_threshold` controls how aggressively overlapping predictions merge/suppress.
- `class_agnostic=True` merges/suppresses across classes.
- Backend can auto-resolve to `torchvision` on CUDA, then `numba`, then `numpy`.

Reference:
- https://obss.github.io/sahi/postprocess/backends/

---

## Notebook Defaults To Match

From `sahi-inference.ipynb`, the working manual configuration is:

```python
model_type = "ultralytics"
model_device = "cuda"
model_confidence_threshold = 0.5

slice_height = 896
slice_width = 896
overlap_height_ratio = 0.25
overlap_width_ratio = 0.25

visual_hide_labels = False
visual_hide_conf = False

postprocess_match_threshold = 0.3
postprocess_class_agnostic = True
no_standard_prediction = True
no_sliced_prediction = False
force_postprocess_type = True
```

These should become the first app defaults.

---

## UI Location

File:

- `frontend/src/components/project-workspace/ModelLabSection/OverviewView/OverviewView.jsx`

Current tabs:

- Overview
- Configuration
- Model Manager
- Validation
- Prediction
- Comparison Engine

Tile-enabled projects should show:

- Overview
- Configuration
- Model Manager
- Validation
- Prediction
- **SAHI Prediction**
- Comparison Engine

Normal projects should not show SAHI Prediction.

---

## Backend Architecture

SAHI must follow the existing subprocess pattern.

### Flow

1. Frontend starts SAHI prediction.
2. Backend creates or finalizes a `ModelExperiment`.
3. Experiment uses:
   - `experiment_type = "sahi_prediction"`
   - `status = "queued"` then `running`
4. Backend resolves:
   - training session
   - project
   - `best.pt` or selected weights
   - original project images
   - output folder
   - SAHI params
5. Backend launches:
   - `backend/models/training/sahi_prediction_executor.py`
6. API returns immediately.
7. Frontend polls experiment status.
8. Executor updates DB with:
   - `status`
   - `predictions`
   - `analytics_summary`
   - `input_images`
   - `output_folder`
   - `image_count`
   - `duration_sec`
   - `error_message` if failed

### Do Not

- Do not run SAHI inside the FastAPI request.
- Do not reuse normal `experiment_type = "prediction"`.
- Do not scan tiled release folders as default input.
- Do not mix SAHI history into normal Prediction history.

---

## Input Image Strategy

SAHI input must be full original images from the dataset stage.

Important: this means images that are ready for release/training, not every project upload.

Supported source options for first version:

1. **Dataset Images**
   - Images from project datasets after they are moved into the dataset stage.
   - Database filter: `Image.split_type == "dataset"`.
   - Use `Image.split_section` to preserve `train`, `val`, and `test`.
   - Use original image file paths stored in DB.
   - Do not include `annotating` or `unassigned` images.
   - Exclude generated release tile images.

2. **Upload Images**
   - Optional but useful because normal Prediction already supports uploaded images.
   - Uploaded images are stored in a prediction temp/permanent folder like normal Prediction.
   - They are still full-size user images, not release tiles.

Do not include train/val/test tiled release split selector as the primary SAHI input.

---

## SAHI Parameters

### Required Defaults

| Param | Default | Notes |
|---|---:|---|
| `model_type` | `ultralytics` | Fixed |
| `weights_type` | `best` | Same normal prediction choice can remain |
| `confidence_threshold` | `0.5` | From notebook |
| `slice_height` | `896` | Match tile training size |
| `slice_width` | `896` | Match tile training size |
| `overlap_height_ratio` | `0.25` | From notebook |
| `overlap_width_ratio` | `0.25` | From notebook |
| `postprocess_match_threshold` | `0.3` | From notebook |
| `postprocess_class_agnostic` | `true` | From notebook |
| `no_standard_prediction` | `true` | Sliced-only |
| `no_sliced_prediction` | `false` | Sliced enabled |
| `visual_hide_labels` | `false` | Show labels |
| `visual_hide_conf` | `false` | Show confidence |
| `device` | `cuda:0` if available, else `cpu` | Backend should tolerate fallback |

### UI Controls

Show only the controls an operator/developer actually needs:

- Prediction name
- Image source
- Weights type: best / last
- Confidence
- Slice size: 640 / 896 / custom
- Overlap ratio
- Merge threshold
- Class-agnostic merge toggle
- Device selector: auto / cuda:0 / cpu

Keep advanced SAHI internals hidden at first:

- postprocess backend
- forced postprocess type
- raw CLI flags

---

## Result Format

Store predictions in a shape compatible with the existing Prediction gallery as much as possible.

Each image should map to a list of detections:

```json
{
  "image_name.jpg": [
    {
      "class": "scratch",
      "class_id": 0,
      "confidence": 0.87,
      "bbox": [x1, y1, x2, y2],
      "mask": [[x, y], [x, y]],
      "source": "sahi"
    }
  ]
}
```

For segmentation:

- Preserve mask/polygon data when SAHI returns it.
- Always include bbox as fallback.
- Coordinates must refer to the original full image.

---

## Output Folder

Use a separate folder branch under the selected training run:

```text
projects/{project}/model/{training_run}/experiments/sahi_prediction/{safe_name}_{timestamp}/
```

Expected files:

- `sahi_prediction_inputs.json`
- `sahi_prediction_params.json`
- `sahi_prediction.log`
- `predictions.json`
- `analytics_summary.json`
- `visuals/`
- `input_images/` only for uploaded images that need persistence

---

## Frontend Architecture

### New Component

Create:

```text
frontend/src/components/project-workspace/ModelLabSection/SahiPredictionView/SahiPredictionView.jsx
frontend/src/components/project-workspace/ModelLabSection/SahiPredictionView/SahiPredictionView.css
```

This should reuse visual patterns from normal Prediction but keep its own API calls and history filtering.

### Behavior

- Show history list of only `experiment_type === "sahi_prediction"`.
- Run button starts SAHI subprocess.
- Poll status until completed/failed.
- Results gallery loads from existing experiment image endpoints if compatible, or new SAHI-specific endpoints if needed.
- Image viewer displays full original image with stitched detections.
- Analytics are separate from normal Prediction analytics.

---

## API Plan

Prefer adding SAHI-specific endpoints in existing training API route file for consistency:

```text
backend/models/training/api_routes.py
```

Proposed endpoints:

- `GET /api/v1/training/{training_id}/sahi-prediction/queued`
- `POST /api/v1/training/{training_id}/sahi-prediction/init`
- `PATCH /api/v1/experiments/{experiment_id}/sahi-prediction`
- `POST /api/v1/training/{training_id}/sahi-predict`

If existing generic experiment read endpoints already work, reuse:

- `GET /api/v1/training/{training_id}/experiments`
- `GET /api/v1/experiments/{experiment_id}`
- `GET /api/v1/experiments/{experiment_id}/images`
- `GET /api/v1/experiments/{experiment_id}/original-image/{filename}`
- `GET /api/v1/experiments/{experiment_id}/download`
- `DELETE /api/v1/experiments/{experiment_id}`

Add new endpoints only where normal Prediction assumptions break.

---

## Dependency Plan

Add SAHI to the active CUDA requirements file:

```text
backend/requirements-cuda121.txt
```

Recommended:

```text
sahi>=0.11.36
```

Reason:

- User notebook has `sahi 0.11.36` working.
- Official docs support the needed APIs.

Do not add this only to the CPU requirements file unless we intentionally support CPU-only packaging too.

---

## Implementation Tasks

### Task 1 - Project Tile Flag In Model Lab - DONE

- [x] Fetch/pass project info into `OverviewView`.
- [x] Determine `isTileProject`.
- [x] Show `SAHI Prediction` tab only when tile-enabled.
- [x] Keep normal Prediction tab unchanged.

Files likely touched:

- `ModelLabSection.jsx`
- `OverviewView.jsx`

Completed implementation:

- `ProjectWorkspace` already passed `project` into `ModelLabSection`.
- `ModelLabSection` now passes `project` into `OverviewView`.
- `OverviewView` reads `project?.tile_enabled`.
- Tile projects get a placeholder `SAHI Prediction` tab beside `Prediction`.
- Non-tile projects do not get the SAHI tab.
- Verification: `npm run build` in `frontend/` completed successfully. Build still reports pre-existing source-map/lint warnings unrelated to this gated tab change.

### Task 2 - SAHI Experiment Schema In API - DONE

- [x] Add SAHI request/update models.
- [x] Create queued SAHI experiment with `experiment_type = "sahi_prediction"`.
- [x] Keep normal prediction queue separate.
- [x] Add tile-project backend guard so SAHI init/update cannot run on normal projects.
- [x] Validate SAHI image source as `dataset_images` or `upload`.
- [x] Store notebook/default SAHI parameters in `custom_params`.

Files likely touched:

- `backend/models/training/sahi_prediction_api.py`
- `backend/models/training/api_routes.py` only mounts the SAHI router

Completed implementation:

- Added `SahiPredictionRequest` and `SahiPredictionUpdate`.
- Added `GET /training/{training_id}/sahi-prediction/queued`.
- Added `POST /training/{training_id}/sahi-prediction/init`.
- Added `PATCH /experiments/{experiment_id}/sahi-prediction`.
- SAHI drafts use `experiment_type = "sahi_prediction"` and do not share the normal `prediction` queue.
- SAHI drafts default to full original dataset-stage image source (`dataset_source = "dataset_images"`) and support upload metadata without resolving/running images yet.
- SAHI draft task defaults to the training task unless the UI explicitly sends `detect` or `segment`.
- SAHI API code lives in `backend/models/training/sahi_prediction_api.py`; the main training API only includes that router.
- Verification: `python -m py_compile backend/models/training/api_routes.py backend/models/training/sahi_prediction_api.py` completed successfully.

### Task 3 - Resolve Full Original Images - DONE

- [x] Implement backend helper to collect dataset-stage original images.
- [x] Collect only `Image.split_type == "dataset"` images from project datasets.
- [x] Preserve `Image.split_section` (`train`, `val`, `test`) in returned metadata.
- [x] Exclude `annotating`, `unassigned`, release ZIP, tiled generated outputs, model folders, training-data folders, and prediction temp folders.
- [x] Support upload source with existence/extension validation.
- [x] Wire SAHI draft init/update to resolve image count and split-count summary without running inference.

Files likely touched:

- `backend/models/training/sahi_image_resolver.py`
- `backend/models/training/sahi_prediction_api.py`

Completed implementation:

- Added `resolve_sahi_input_images(...)`.
- `dataset_images` source queries `Dataset` + `Image` from the database and only includes ready dataset-stage records.
- Returned resolver data includes absolute image paths, item metadata, split counts, skipped records, and count.
- SAHI draft API stores `image_count`, `input_source`, `input_split_counts`, and `input_skipped_count` in the experiment summary/custom params.
- Verification: `python -m py_compile backend/models/training/sahi_image_resolver.py backend/models/training/sahi_prediction_api.py backend/models/training/api_routes.py` completed successfully.

### Task 4 - SAHI Predictor - DONE

- [x] Create SAHI predictor using the existing `BasePredictor` contract.
- [x] Load `AutoDetectionModel`.
- [x] Loop through input images.
- [x] Run `get_sliced_prediction`.
- [x] Export visual image per input.
- [x] Convert predictions to app JSON.
- [x] Return analytics in the same shape as normal Prediction.

Files likely touched:

- `backend/models/training/sahi_predictor.py`

Completed implementation:

- Added `SahiUltralyticsPredictor(BasePredictor)`.
- Uses SAHI `AutoDetectionModel.from_pretrained(...)` and `get_sliced_prediction(...)`.
- Keeps model loading inside the predictor method so import errors are reported only when SAHI prediction runs.
- Converts SAHI object predictions into `{class, class_id, confidence, bbox, segmentation, mask, source}`.
- Uses original full-image coordinates returned by SAHI.
- Saves SAHI visuals under the predictor output folder.
- Verification: `python -m py_compile backend/models/training/sahi_predictor.py` completed successfully.

### Task 5 - SAHI Executor - DONE

- [x] Create `sahi_prediction_executor.py`.
- [x] Call `SahiUltralyticsPredictor`.
- [x] Read image manifest and params JSON.
- [x] Update DB status/results.
- [x] Store per-image MD5 and dimensions for later review/verification.
- [x] Preserve upload persistence behavior for uploaded full images.

Files likely touched:

- `backend/models/training/sahi_prediction_executor.py`

Completed implementation:

- Added standalone SAHI subprocess runner.
- Accepts `--experiment_id`, `--weights_path`, `--images_manifest` or `--images_json`, `--output_folder`, and `--params_json`.
- Updates experiment status to `running`, then `completed` or `failed`.
- Stores predictions, analytics summary, image count, output folder, and input image metadata.
- Verification: `python -m py_compile backend/models/training/sahi_prediction_executor.py backend/models/training/sahi_predictor.py` completed successfully.
- CLI smoke: `python backend/models/training/sahi_prediction_executor.py --help` completed successfully with `DEBUG=false` for the local process.

### Task 6 - Launch Subprocess - DONE

- [x] Resolve selected weights.
- [x] Resolve dataset-stage or uploaded images.
- [x] Write input manifest and params JSON.
- [x] Launch executor with `subprocess.Popen`.
- [x] Record PID, output folder, and running status.

Files likely touched:

- `backend/models/training/sahi_prediction_api.py`

Completed implementation:

- Added `POST /training/{training_id}/sahi-predict`.
- Finalizes queued SAHI draft settings or creates a fallback experiment.
- Resolves `best.pt` / `last.pt` from the training session weights folder.
- Resolves SAHI input images through `resolve_sahi_input_images(...)`.
- Writes `sahi_prediction_inputs.json`, `sahi_prediction_params.json`, and `sahi_prediction.log`.
- Launches `sahi_prediction_executor.py` in a subprocess and stores the process PID.
- Verification: `python -m py_compile backend/models/training/sahi_prediction_api.py backend/models/training/sahi_prediction_executor.py backend/models/training/sahi_predictor.py backend/models/training/sahi_image_resolver.py backend/models/training/api_routes.py` completed successfully.

### Task 7 - Frontend API Methods - DONE

- [x] Add SAHI API functions to `frontend/src/services/api.js`.

Needed functions:

- [x] `getQueuedSahiPrediction`
- [x] `initSahiPrediction`
- [x] `updateSahiPredictionDraft`
- [x] `triggerSahiPrediction`

Completed implementation:

- Added SAHI methods beside the existing Prediction API methods.
- No SAHI UI is wired yet; this task only exposes frontend service calls.
- Verification: `npm run build` in `frontend/` completed successfully. Build still reports pre-existing source-map/lint warnings unrelated to these API methods.

### Task 8 - SAHI Prediction View UI

- Build `SahiPredictionView`.
- History list.
- Run configuration.
- Result gallery.
- Polling.
- Delete/download.

Files likely touched:

- `SahiPredictionView.jsx`
- `SahiPredictionView.css`
- `OverviewView.jsx`

### Task 9 - Viewer Compatibility

- Reuse normal `ImageViewerModal` if prediction JSON is compatible.
- If full-size image handling needs tweaks, isolate them behind props.

Files likely touched:

- `SahiPredictionView.jsx`
- maybe `PredictionView/ImageViewerModal.jsx`

### Task 10 - Analytics

- Start with basic SAHI stats:
  - image count
  - total detections
  - average confidence
  - class distribution
  - detections per image
- Keep advanced comparison/verification out of first version unless existing components work cleanly.

### Task 11 - Verification

- Backend compile:
  - `python -m py_compile backend/models/training/api_routes.py backend/models/training/sahi_prediction_executor.py`
- Frontend build or targeted lint if available.
- Manual smoke:
  - non-tile project: no SAHI tab
  - tile project: SAHI tab visible
  - run SAHI on one original large image
  - status changes queued -> running -> completed
  - annotated visual appears
  - predictions are in original image coordinates

---

## Risks And Guardrails

- Large images can create many slices. UI should warn on many selected images.
- GPU memory can fail; executor should mark experiment failed with clear error.
- CPU fallback can be slow; show device in experiment config.
- Segmentation masks may be heavy; store compact polygon data where possible.
- Do not block the API request during inference.
- Do not accidentally train/predict on tile release output for SAHI.

---

## First Coding Batch

Do this first:

1. Add SAHI dependency.
2. Add `SAHI Prediction` tab gated by `tile_enabled`.
3. Add backend `sahi_prediction` experiment init/trigger skeleton.
4. Add subprocess executor skeleton that can run one image.
5. Verify one original image inference end-to-end.

After that:

1. Polish full UI.
2. Add full history/gallery/download/delete.
3. Add analytics.
4. Commit.
