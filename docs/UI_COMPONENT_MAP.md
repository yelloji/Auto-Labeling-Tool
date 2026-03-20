# UI Component Map — Gevis AI Studio

Complete map of every UI section, sub-component, tab, modal and API call.
Use this as reference for testing, debugging, and new features.

---

## PAGES (Top-level Routes)

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/` | Health status, key stats, recent projects |
| Projects | `/projects` | Create/list/edit/delete projects |
| ModelsModern | `/models` | Global AI model management |
| AnnotateLauncher | `/annotate-launcher/{datasetId}` | Annotation entry point |
| ManualLabeling | `/annotate/{datasetId}/manual` | Full annotation canvas |

---

## PROJECT WORKSPACE Sections (Sidebar Menu)

Route: `/projects/{projectId}/workspace`

### 1. UploadSection
**Purpose:** Upload images to project
- Drag & drop area
- Select files / select folder
- Batch naming modal
- Tag/dataset assignment
- Video frame extraction (FPS + format selection)
- Import with Labels (YOLO/COCO format)
- Recent images display

**API:** POST /upload, POST /upload-bulk, POST /import-with-labels

---

### 2. ManagementSection
**Purpose:** Manage dataset workflow across 3 stages
- 3-column layout: Unassigned | Annotating | Dataset (Completed)
- Dataset card per column: name, image count, progress bar
- Per-dataset dropdown: Rename, Move to stage, Delete

**API:** GET /management, PUT /assign, PUT /rename, PUT /move-*, DELETE

---

### 3. DatasetSection
**Purpose:** Browse all labeled images ready for training
- Image grid (50 per page, paginated)
- Filters: filename search, split (train/val/test), dataset, class, sort
- Each image card: thumbnail + annotation SVG overlay + split tag
- Supports bbox, polygon, legacy annotation formats
- "Create New Release" button

**API:** GET /projects/{id}/images (split_type=dataset), GET /annotations

---

### 4. ReleaseSection
**Purpose:** Create and manage dataset releases with augmentation
- Sub-components:
  - ReleaseHistoryList — all releases with versions
  - ReleaseDetailsView — create/edit release
  - DatasetStats — statistics for selected release
  - ReleaseConfigPanel — train/val/test split config
  - TransformationSection — augmentation pipeline
  - TransformationCard + TransformationModal — individual transform
  - IndividualTransformationControl — per-transform control
  - DownloadModal — download release as ZIP
  - ReleaseImageViewerModal — preview images with transforms

**Transformation types:** rotation, flip, brightness, contrast, blur, noise, etc.

**API:** GET /releases, POST /releases/create, GET/POST/PUT/DELETE /transformations, GET /download

---

### 5. AnalyticsSection
**Purpose:** Project and dataset statistics
- Project overview: total datasets, images, labels, annotations, labeling progress
- Label distribution: table (color, count, %) + pie chart
- Dataset table: per-dataset labeled/unlabeled count + progress bar
- LabelManagementModal — create/edit project labels

**API:** GET /labels, GET /analytics/label-distribution, POST/PUT/DELETE /labels

---

### 6. ModelsSection
**Purpose:** Project-scoped AI model management
- Model cards: name, type, status (Ready/Pending), source badge
- Search + filter by type
- Toggle: include global models
- Upload modal: file upload + type selection
- View details modal: classes CSV, config YAML, metadata

**API:** GET /projects/{id}/models, GET /models/types/supported, POST /models/import, DELETE /models/{id}

---

### 7. ModelTrainingSection
**Purpose:** Configure and launch YOLO training
- **Tab 1: Config**
  - Mode toggle (User / Developer)
  - Identity: training name, description
  - Framework & Task selection (ultralytics / segmentation or detection)
  - Pretrained model selection
  - Dataset source: release ZIP or local path
  - Hyperparameters: epochs, image size, batch, mixed precision, early stop,
    save best, resume, device (CPU/GPU), optimizer, learning rate, val plots
- **Tab 2: Training**
  - LiveTrainingDashboard — real-time metrics charts
  - TerminalPanel — live log output
  - TrainingInitializing — placeholder while starting

**API:** GET /training/models, POST /training/session/upsert, POST /training/session/start,
         POST /training/config/resolve, GET /training/dataset/summary, WS /training/session/terminal/logs

---

### 8. ModelLabSection
**Purpose:** Analyze training results, validate and predict with trained models
- **Left panel:** TrainingList — list of all training sessions, select one
- **Right panel (OverviewView):** 6 tabs when a training is selected:

  **Tab 1: Overview**
  - Best metrics summary
  - Final validation metrics table
  - AnalyticsView — loss/accuracy curves, performance graphs

  **Tab 2: Configuration**
  - ViewConfig — view training config
  - AdvancedConfigEditor — YAML config editor

  **Tab 3: Models (ModelManagerView)**
  - Manage weights (best.pt, last.pt)
  - Download models
  - Model versions and details

  **Tab 4: Validation (ValidationView)**
  - Experiment list — select or create validation run
  - Select weights (best/last)
  - Select dataset split (val/test)
  - Configure: confidence, IoU, image size
  - Run validation button
  - Results: mAP metrics, confusion matrix, per-class metrics

  **Tab 5: Prediction (PredictionView)**
  - Experiment list — select or create prediction run
  - Configuration section: confidence, IoU, batch size, weights
  - KPI Metrics section — key numbers after run
  - Gallery section — images with predicted bounding boxes/masks
  - ImageViewerModal — full-size prediction image view
  - ManualClassPopup — manually classify prediction
  - Analytics button → AnalyticsModal with 4 sub-views:
    - ChartsView — prediction charts/graphs
    - QualityView — quality statistics
    - ReportView — full PDF report generation
    - ExportView — export results as ZIP

  **Tab 6: Comparison Engine (ComparisonEngineView)**
  - Compare 2 or 3 experiments side by side
  - Delta gallery showing differences between runs
  - Side-by-side metrics table

**API:** GET /training/sessions, POST /validation/init, POST /predict,
         GET /experiments/{id}/images, GET /experiments/compare, GET /experiments/{id}/download

---

### 9. DeploymentsSection
**Purpose:** Deploy models to production (placeholder — not yet implemented)

---

### 10. ActiveLearningSection
**Purpose:** Entry point for active learning (navigates to /active-learning)

---

## ANNOTATION (ManualLabeling page)

**Layout:** Left Sidebar | Main Canvas | Right Toolbox | Bottom Controls

- **LabelSidebar** — image list, thumbnails, navigate between images
- **AnnotationCanvas** — image display + drawing tools + annotation overlay
- **AnnotationToolbox** — tool selection (rectangle/polygon/point), label selector, annotation list, undo/redo
- **LabelSelectionPopup** — class picker when creating annotation
- **AnnotationSplitControl** — assign image to train/val/test
- **Bottom controls** — previous/next, save, delete image, progress

**Annotation formats supported:**
- Bounding box: {x_min, y_min, x_max, y_max}
- Polygon/segmentation: {segmentation: [points]}
- Legacy: {x, y, width, height}

**API:** GET/POST/PUT/DELETE /images/{id}/annotations, PUT /images/{id}/split

---

## SUMMARY — Test Coverage Needed

| Section | Sub-UIs to Test |
|---|---|
| Projects page | CRUD, search, duplicate |
| Upload | drag-drop, batch name, import with labels |
| Management | 3 columns, move datasets between stages |
| Dataset | gallery, filters, annotation overlay |
| Release | create release, transformations, download |
| Analytics | label distribution, dataset stats |
| Models | upload, filter, view details |
| ModelTraining | config form, start training |
| ModelLab → Training List | list, select session |
| ModelLab → Overview | metrics, analytics |
| ModelLab → Configuration | view config, YAML editor |
| ModelLab → Models | weights, download |
| ModelLab → Validation | init, run, results, metrics |
| ModelLab → Prediction | init, run, gallery, analytics (4 sub-views) |
| ModelLab → Comparison | compare 2 experiments |
| Annotation | draw box, polygon, save, navigate images |
