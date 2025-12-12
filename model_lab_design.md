# Model Lab - Complete UI/UX Design & Architecture

## 🎯 Overview

**Section Name:** Model Lab  
**Purpose:** View all trained models, analyze results, test with custom parameters, run predictions, and deploy models.

---

## 📐 Layout Structure

### **Main Layout - Two-Panel Design**

```
┌──────────────────────────────────────────────────────────────────┐
│                        🔬 MODEL LAB                              │
├────────────────┬─────────────────────────────────────────────────┤
│                │                                                 │
│   TRAINING     │          DETAIL / ACTION PANEL                  │
│   LIST         │                                                 │
│   (Left Panel) │        (Right Panel - Dynamic Content)          │
│                │                                                 │
│   • super-1    │   ┌─────────────────────────────────────────┐  │
│   • check_2    │   │  Model: super-1                         │  │
│   • iou-max    │   │  Task: Detection                        │  │
│   • srl-seg    │   │  mAP: 0.701                             │  │
│                │   │                                         │  │
│   [+ New]      │   │  [View Details] [Validate] [Predict]   │  │
│                │   │  [Download]     [Deploy]                │  │
│                │   └─────────────────────────────────────────┘  │
│                │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
```

---

## 🎨 Left Panel - Training List

### **Design: Compact List with Mini Cards**

```
┌────────────────────────────┐
│  🔬 TRAINED MODELS (4)     │
│  ─────────────────────     │
│                            │
│  ┌──────────────────────┐ │
│  │ ✅ super-1          │ │ <- Active/Selected (highlighted)
│  │ 📊 Detection        │ │
│  │ mAP: 0.701 • 5 Ep   │ │
│  │ 2 Dec 2024 10:41    │ │
│  └──────────────────────┘ │
│                            │
│  ┌──────────────────────┐ │
│  │ ⏸️ check_2          │ │
│  │ 📊 Segmentation     │ │
│  │ mAP: 0.692 • 15 Ep  │ │
│  │ 2 Dec 2024 10:22    │ │
│  └──────────────────────┘ │
│                            │
│  ┌──────────────────────┐ │
│  │ ✅ iou-max-1        │ │
│  │ 📊 Detection        │ │
│  │ mAP: 0.706 • 14 Ep  │ │
│  │ 1 Dec 2024 15:20    │ │
│  └──────────────────────┘ │
│                            │
│  ┌──────────────────────┐ │
│  │ ✅ srl-seg          │ │
│  │ 📊 Segmentation     │ │
│  │ mAP: 0.689 • 50 Ep  │ │
│  │ 30 Nov 2024 14:10   │ │
│  └──────────────────────┘ │
│                            │
│  [+ Start New Training]    │
└────────────────────────────┘
```

### **Features:**
- ✅ Status indicator (✅ Completed, ⏸️ Failed, 🔄 Running)
- 📊 Task type icon
- Key metrics preview (mAP, epochs)
- Click to select → Shows details in right panel
- Sorted by date (newest first)
- Search/filter bar at top (hide if <5 models)

---

## 📊 Right Panel - Dynamic Content (4 Views)

### **View 1️⃣: Overview (Default when model selected)**

```
┌─────────────────────────────────────────────────────────────┐
│  MODEL: super-1                                   [⋯ Menu]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 QUICK STATS                                             │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ mAP      │ Epochs   │ Images   │ Classes  │             │
│  │ 0.701    │ 5/50     │ 70       │ 2        │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│                                                             │
│  📈 FINAL VALIDATION RESULTS                                │
│  ┌───────────────────────────────────────────┐             │
│  │  Box Detection:                           │             │
│  │    Precision: 96.7% │ Recall: 47.1%       │             │
│  │    mAP50: 0.701     │ mAP50-95: 0.460     │             │
│  │                                           │             │
│  │  Mask Segmentation:                       │             │
│  │    Precision: 96.7% │ Recall: 47.1%       │             │
│  │    mAP50: 0.692     │ mAP50-95: 0.456     │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  📁 FILES & EXPORT                                          │
│  ┌───────────────────────────────────────────┐             │
│  │  best.pt (45.2 MB)      [⬇️ Download]     │             │
│  │  args.yaml (2.1 KB)     [⬇️ Download]     │             │
│  │  metrics_summary.json   [⬇️ Download]     │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  🛠️ ACTIONS                                                 │
│  ┌───────────────────────────────────────────┐             │
│  │  [🧪 Run Custom Validation]               │             │
│  │  [🎯 Run Prediction]                      │             │
│  │  [📦 Add to Project Models]               │             │
│  │  [📊 View Full Analytics]                 │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **View 2️⃣: Full Analytics (Click "View Full Analytics")**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Overview                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📈 TRAINING HISTORY                                        │
│  ┌───────────────────────────────────────────┐             │
│  │  [Line Chart: Loss curves over epochs]   │             │
│  │  - train/box_loss                         │             │
│  │  - train/cls_loss                         │             │
│  │  - val/box_loss                           │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  ┌───────────────────────────────────────────┐             │
│  │  [Line Chart: mAP curves over epochs]    │             │
│  │  - mAP50                                  │             │
│  │  - mAP50-95                               │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  📊 CLASS-WISE PERFORMANCE                                  │
│  ┌───────────────────────────────────────────┐             │
│  │  Class: Apple                             │             │
│  │    Precision: 100% │ Recall: 54.3%        │             │
│  │    mAP50: 0.706                           │             │
│  │                                           │             │
│  │  Class: Orange                            │             │
│  │    Precision: 93.3% │ Recall: 100%        │             │
│  │    mAP50: 0.701                           │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  🔧 TRAINING CONFIGURATION                                  │
│  ┌───────────────────────────────────────────┐             │
│  │  Model: yolo11m-seg.pt                    │             │
│  │  Epochs: 5 (early stop at epoch 5)        │             │
│  │  Batch Size: 18                           │             │
│  │  Image Size: 640                          │             │
│  │  Optimizer: SGD                           │             │
│  │  [View Full Config →]                     │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **View 3️⃣: Custom Validation (Click "Run Custom Validation")**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Overview                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🧪 CUSTOM VALIDATION                                       │
│                                                             │
│  Run validation with custom confidence and IoU thresholds   │
│  to optimize for your specific use case.                    │
│                                                             │
│  ┌───────────────────────────────────────────┐             │
│  │  Confidence Threshold                     │             │
│  │  [━━━━━━●━━━━] 0.35                       │             │
│  │  (0.01 - 1.00)                            │             │
│  │                                           │             │
│  │  IoU Threshold                            │             │
│  │  [━━━━━━━●━━━] 0.50                       │             │
│  │  (0.10 - 0.95)                            │             │
│  │                                           │             │
│  │  Max Detections                           │             │
│  │  [━━━━━━●━━━━] 300                        │             │
│  │  (10 - 1000)                              │             │
│  │                                           │             │
│  │  Dataset to Validate:                     │             │
│  │  ( ) Training Set                         │             │
│  │  (●) Validation Set (Default)             │             │
│  │  ( ) Test Set                             │             │
│  │                                           │             │
│  │       [Cancel]  [🚀 Run Validation]       │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  📊 VALIDATION RESULTS (after running)                      │
│  ┌───────────────────────────────────────────┐             │
│  │  Conf: 0.35 • IoU: 0.50 • MaxDet: 300     │             │
│  │                                           │             │
│  │  mAP50: 0.715 (+0.014 vs default)         │             │
│  │  mAP50-95: 0.468 (+0.008 vs default)      │             │
│  │  Precision: 94.2% (-2.5%)                 │             │
│  │  Recall: 52.1% (+5.0%)                    │             │
│  │                                           │             │
│  │  [💾 Save as New Config]                  │             │
│  │  [📊 Compare with Default]                │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **View 4️⃣: Prediction / Inference (Click "Run Prediction")**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Overview                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🎯 RUN PREDICTION                                          │
│                                                             │
│  Run inference on new images using this trained model.      │
│                                                             │
│  ┌───────────────────────────────────────────┐             │
│  │  1️⃣ SELECT DATA SOURCE                    │             │
│  │                                           │             │
│  │  ( ) Validation Set (70 images)           │             │
│  │  ( ) Test Set (if available)              │             │
│  │  (●) Upload Custom Images                 │             │
│  │                                           │             │
│  │  [📁 Choose Files] or Drag & Drop         │             │
│  │  ┌─────────────────────────────────────┐ │             │
│  │  │  • IMG_001.jpg (2.3 MB)             │ │             │
│  │  │  • IMG_002.jpg (1.8 MB)             │ │             │
│  │  │  • IMG_003.jpg (2.1 MB)             │ │             │
│  │  └─────────────────────────────────────┘ │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  ┌───────────────────────────────────────────┐             │
│  │  2️⃣ PREDICTION SETTINGS                   │             │
│  │                                           │             │
│  │  Confidence: [──●────] 0.25               │             │
│  │  IoU:        [────●──] 0.50               │             │
│  │                                           │             │
│  │  Save Options:                            │             │
│  │  [✓] Save annotated images                │             │
│  │  [✓] Save predictions as JSON             │             │
│  │  [ ] Save cropped detections              │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  [Cancel]  [🚀 Run Prediction]                              │
│                                                             │
│  ─────────────────────────────────────────────             │
│                                                             │
│  📊 PREDICTION RESULTS (after running)                      │
│  ┌───────────────────────────────────────────┐             │
│  │  Processed: 3 images in 1.2s              │             │
│  │  Total Detections: 12 objects             │             │
│  │                                           │             │
│  │  [Image Gallery with predictions]         │             │
│  │  ┌─────┐ ┌─────┐ ┌─────┐                 │             │
│  │  │ IMG │ │ IMG │ │ IMG │                 │             │
│  │  │ 001 │ │ 002 │ │ 003 │                 │             │
│  │  └─────┘ └─────┘ └─────┘                 │             │
│  │                                           │             │
│  │  [⬇️ Download Results]                    │             │
│  │  [📊 View Detailed Report]                │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Flows

### **Flow 1: View Model Details**
1. User opens "Model Lab"
2. Sees list of trained models (left panel)
3. Clicks on a model → Right panel shows Overview
4. Can see quick stats, metrics, download files

### **Flow 2: Custom Validation**
1. From Overview, clicks "Run Custom Validation"
2. Adjusts Conf/IoU/MaxDet sliders
3. Selects dataset (train/val/test)
4. Clicks "Run Validation" → Backend runs validation
5. Results appear below → Can compare with default
6. Can save config for future use

### **Flow 3: Run Prediction**
1. From Overview, clicks "Run Prediction"
2. Selects data source (val/test/upload)
3. Uploads images (if custom)
4. Sets prediction parameters (conf, iou)
5. Clicks "Run Prediction" → Backend processes
6. Results show in gallery → Can download

### **Flow 4: Deploy Model**
1. From Overview, clicks "Add to Project Models"
2. Modal appears: "Add model to Project Models page?"
3. User confirms → Model appears in project's deployed models
4. Can now use for inference in annotation workflow

### **Flow 5: Download Model**
1. From Overview, in "Files & Export" section
2. Clicks "Download" next to `best.pt`
3. File downloads to user's computer

---

## 🎨 Design Principles

### **Visual Style:**
- **Left Panel:** Compact, scrollable list (250-300px wide)
- **Right Panel:** Spacious, comfortable reading (rest of width)
- **Colors:** 
  - Detection: Blue tones
  - Segmentation: Purple tones
  - Status indicators: Green (✅), Red (❌), Orange (⏸️)
- **Cards:** Subtle shadows, rounded corners, hover effects

### **Interactions:**
- Smooth transitions between views
- Loading states during validation/prediction
- Progress bars for long operations
- Tooltips for all icons and metrics

### **Responsive:**
- On mobile: Stack panels vertically
- Left panel becomes dropdown/modal

---

## 🛠️ Technical Architecture

### **Database Schema:**

**Single Table - `model_experiments`** (Optimized for fast queries)

```sql
CREATE TABLE model_experiments (
    id INTEGER PRIMARY KEY,
    training_session_id INTEGER NOT NULL,
    experiment_type TEXT NOT NULL,        -- 'validation' or 'prediction'
    name TEXT NOT NULL,
    
    -- Model & Parameters (common to both)
    model_weight TEXT DEFAULT 'best.pt', -- 'best.pt' or 'last.pt'
    conf_threshold REAL NOT NULL,
    iou_threshold REAL NOT NULL,
    max_det INTEGER DEFAULT 300,
    
    -- Source (slightly different meaning)
    source_type TEXT NOT NULL,           -- 'train'/'val'/'test'/'upload'
    
    -- Results
    image_count INTEGER,                 -- How many images processed
    total_detections INTEGER,            -- For predictions only
    results_json TEXT,                   -- Full metrics/predictions
    output_dir TEXT,                     -- For predictions only (saved images)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (training_session_id) REFERENCES training_sessions(id),
    INDEX idx_session (training_session_id),
    INDEX idx_type (experiment_type)
);
```

**Why Single Table:**
- ✅ Simpler queries (one SELECT vs multiple JOINs)
- ✅ Better performance with proper indexing
- ✅ Can show unified timeline of all experiments
- ✅ Both validation & prediction are fundamentally "model testing"

**Example Query:**
```sql
-- Get all experiments for a training
SELECT * FROM model_experiments 
WHERE training_session_id = ?
ORDER BY created_at DESC;

-- Get only validations
SELECT * FROM model_experiments 
WHERE training_session_id = ? AND experiment_type = 'validation';
```

### **File System Structure:**

```
projects/{project_name}/model/training/{training_name}/
├── weights/
│   ├── best.pt
│   └── last.pt
├── args.yaml
├── metrics.json
├── logs/
│   └── training.log
├── experiments/                          ← NEW!
│   ├── validations/
│   │   ├── conf_0.35_iou_0.50_20241202_101523/
│   │   │   ├── results.json              # Full metrics
│   │   │   ├── confusion_matrix.png      # If available
│   │   │   └── summary.txt               # Human-readable
│   │   └── conf_0.25_iou_0.45_20241202_103010/
│   │       ├── results.json
│   │       └── summary.txt
│   └── predictions/
│       ├── val_set_20241202_101523/
│       │   ├── images/
│       │   │   ├── IMG_001_pred.jpg      # Annotated images
│       │   │   ├── IMG_002_pred.jpg
│       │   │   └── ...
│       │   ├── predictions.json          # All detections
│       │   └── summary.txt               # Stats
│       └── custom_upload_20241202_103010/
│           ├── images/
│           ├── predictions.json
│           └── summary.txt
```

### **Frontend Components:**
```
ModelLab/
├── ModelLabSection.jsx          (Main container)
├── TrainingList/
│   ├── TrainingList.jsx         (Left panel)
│   ├── TrainingCard.jsx         (Mini card for each model)
│   └── SearchFilter.jsx         (Search/filter bar)
├── DetailPanel/
│   ├── OverviewView.jsx         (View 1 - Default)
│   ├── AnalyticsView.jsx        (View 2 - Charts & stats)
│   ├── ValidationView.jsx       (View 3 - Custom validation)
│   └── PredictionView.jsx       (View 4 - Inference)
└── Shared/
    ├── MetricsCard.jsx          (Reusable metrics display)
    ├── FileDownloadButton.jsx   (Download files)
    └── ActionButton.jsx         (Primary actions)
```

### **Backend APIs Needed:**
```
GET  /api/v1/projects/{id}/training/sessions        # List all trainings
GET  /api/v1/projects/{id}/training/{name}/summary  # Full training details
GET  /api/v1/projects/{id}/training/{name}/analytics # Charts data
POST /api/v1/projects/{id}/training/{name}/validate # Custom validation
POST /api/v1/projects/{id}/training/{name}/predict  # Run prediction
GET  /api/v1/projects/{id}/training/{name}/download/{file} # Download files
POST /api/v1/projects/{id}/models/deploy            # Deploy to project models
```

### **Data Flow:**
1. Frontend fetches training list on mount
2. User selects model → Fetch full details
3. User triggers action (validate/predict) → POST request → Stream results
4. User downloads file → Direct file download link

---

## ✨ Nice-to-Have Features (Future)

- 📊 Compare 2+ models side-by-side
- 📈 Export metrics to CSV/PDF
- 🔔 Notifications when validation/prediction completes
- 🎥 Video inference support
- 🔄 Re-train from checkpoint with modified params
- 📝 Add notes/tags to each training session
- 🗑️ Delete old/failed trainings

---

## 🎯 Success Criteria

✅ User can **see all trained models** in one place  
✅ User can **view detailed metrics** for each model  
✅ User can **test with custom IoU/Conf**  
✅ User can **run predictions** on new images  
✅ User can **download .pt files**  
✅ User can **deploy model** to project  
✅ UI is **beautiful, modern, intuitive**  
