# Validation & Prediction Features - Complete Specification

## Overview
Advanced features for Model Lab to run validation experiments and predictions on trained models. Framework-agnostic design supporting YOLO, MMDetection, and future frameworks.

---

## Database Schema

### `model_experiments` Table

```sql
CREATE TABLE model_experiments (
    -- Primary Keys
    id                  VARCHAR PRIMARY KEY,        -- Unique experiment ID (UUID)
    training_id         VARCHAR NOT NULL,           -- FK to trainings table
    project_id          INTEGER NOT NULL,           -- FK to projects table
    
    -- Experiment Classification
    experiment_type     VARCHAR NOT NULL,           -- 'validation' or 'prediction'
    framework           VARCHAR NOT NULL,           -- 'ultralytics', 'mmdetection', etc.
    
    -- Dataset Information
    dataset_source      VARCHAR NOT NULL,           -- 'val', 'test', 'upload', 'filesystem'
    dataset_path        VARCHAR,                    -- Path to dataset/images folder
    image_count         INTEGER,                    -- Number of images processed
    
    -- Common Parameters (all experiments)
    confidence          FLOAT DEFAULT 0.25,         -- Confidence threshold
    iou_threshold       FLOAT DEFAULT 0.45,         -- IoU threshold for NMS
    custom_params       JSON,                       -- Framework-specific parameters
    
    -- Validation-Specific Fields
    max_detections      INTEGER DEFAULT 300,        -- Max detections per image (YOLO)
    validation_metrics  JSON,                       -- mAP, Precision, Recall, F1, etc.
    per_class_metrics   JSON,                       -- Metrics breakdown by class
    confusion_matrix    JSON,                       -- Confusion matrix data
    
    -- Prediction-Specific Fields
    input_images        JSON,                       -- Array of uploaded image filenames
    output_folder       VARCHAR,                    -- Where prediction results are saved
    predictions         JSON,                       -- Detection results per image
                                                   -- Format: {image_name: [{class, conf, bbox}]}
    
    -- Execution Metadata
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at          DATETIME,                   -- When execution started
    completed_at        DATETIME,                   -- When execution finished
    duration_sec        FLOAT,                      -- Total execution time
    
    -- Status & Error Handling
    status              VARCHAR DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
    error_message       TEXT,                       -- Error details if failed
    
    -- Additional Metadata
    user_notes          TEXT,                       -- User-added notes/description
    is_default          BOOLEAN DEFAULT FALSE,      -- True for initial validation run
    
    FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for Performance
CREATE INDEX idx_experiments_training ON model_experiments(training_id);
CREATE INDEX idx_experiments_type ON model_experiments(experiment_type);
CREATE INDEX idx_experiments_status ON model_experiments(status);
CREATE INDEX idx_experiments_created ON model_experiments(created_at DESC);
```

---

## Feature 1: Validation Tab

### Purpose
Run model validation on val/test datasets with custom parameters to evaluate performance metrics.

### UI Design

#### Top Section: Parameters
```
┌─────────────────────────────────────────────────────────┐
│  Task Selection (Based on Model Type)                   │
│  ─────────────────────────────────────────────────────  │
│  If Detection Model:                                     │
│    Task: Detection (locked)                              │
│                                                          │
│  If Segmentation Model:                                  │
│    Task: ◉ Segmentation  ○ Detection                    │
│    (Segmentation models can do both! Recommend seg.)    │
├─────────────────────────────────────────────────────────┤
│  Dataset Selection                                       │
│  ◉ Validation Set    ○ Test Set                        │
├─────────────────────────────────────────────────────────┤
│  Validation Parameters                                   │
│  ├─ Confidence Threshold: ▬▬▬▬▬●────── 0.25            │
│  ├─ IoU Threshold:        ▬▬▬▬●──────── 0.45           │
│  └─ Max Detections:       ▬▬▬▬▬●────── 300             │
│                                                          │
│  [Reset to Defaults]  [Run Validation]                  │
└─────────────────────────────────────────────────────────┘
```

**Task Selection Logic:**
```python
# Determine available tasks based on model training type
if training_record['task'] == 'detection':
    # Detection model → Only detection
    available_tasks = ['detect']
    default_task = 'detect'
    
elif training_record['task'] == 'segmentation':
    # Segmentation model → Both segmentation AND detection! ✅
    # Because segmentation models output:
    #   1. Segmentation masks
    #   2. Bounding boxes
    available_tasks = ['segment', 'detect']
    default_task = 'segment'  # Recommend segmentation
```

#### Bottom Section: Results
- **Reuse Overview Tab Components**: Same metric cards design
- **Default Validation**: Always shown (from training)
- **Custom Validation**: Show when user runs custom params
- **Comparison**: Show delta (+/- changes) between default and custom

```
┌─────────────────────────────────────────────────────────┐
│  Default Validation Results                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ mAP@0.5  │ │Precision │ │  Recall  │ │    F1    │  │
│  │  0.842   │ │  0.856   │ │  0.823   │ │  0.839   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Custom Validation Results                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ mAP@0.5  │ │Precision │ │  Recall  │ │    F1    │  │
│  │  0.867   │ │  0.872   │ │  0.845   │ │  0.858   │  │
│  │ +0.025⬆️ │ │ +0.016⬆️ │ │ +0.022⬆️ │ │ +0.019⬆️ │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Backend API

#### Endpoint: `POST /api/v1/training/{training_id}/validate`

**Request Body:**
```json
{
  "dataset_source": "val",
  "confidence": 0.25,
  "iou_threshold": 0.45,
  "max_detections": 300,
  "custom_params": {}
}
```

**Response:**
```json
{
  "experiment_id": "exp_123",
  "status": "running",
  "message": "Validation started"
}
```

#### Endpoint: `GET /api/v1/experiments/{experiment_id}`

**Response:**
```json
{
  "id": "exp_123",
  "experiment_type": "validation",
  "status": "completed",
  "validation_metrics": {
    "mAP@0.5": 0.867,
    "mAP@0.5:0.95": 0.645,
    "precision": 0.872,
    "recall": 0.845,
    "f1": 0.858
  },
  "per_class_metrics": {
    "person": {"mAP": 0.89, "precision": 0.91, "recall": 0.87},
    "car": {"mAP": 0.84, "precision": 0.83, "recall": 0.86}
  },
  "duration_sec": 12.5
}
```

---

## Feature 2: Prediction Tab

### Purpose
Run inference on images (from val/test/upload/filesystem) and visualize predictions with bounding boxes.

### UI Design

#### Section 1: Image Source
```
┌─────────────────────────────────────────────────────────┐
│  Select Image Source                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐     │
│  │Val Set │ │Test Set│ │ Upload │ │Browse Folder│     │
│  └────────┘ └────────┘ └────────┘ └─────────────┘     │
│                                                          │
│  [If Upload selected]                                    │
│  ┌──────────────────────────────────────────────┐      │
│  │  📁 Drag & Drop Images Here                  │      │
│  │     or click to browse                        │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

#### Section 2: Parameters
```
┌─────────────────────────────────────────────────────────┐
│  Task Selection (Based on Model Type)                   │
│  If Detection Model: Detection (locked)                 │
│  If Segmentation Model: ◉ Segmentation  ○ Detection     │
├─────────────────────────────────────────────────────────┤
│  Prediction Parameters                                   │
│  ├─ Confidence: ▬▬▬▬▬●────── 0.25                      │
│  └─ IoU:        ▬▬▬▬●──────── 0.45                     │
│                                                          │
│  [Run Prediction]  [Download Results]                   │
└─────────────────────────────────────────────────────────┘
```

#### Section 3: Results Gallery
```
┌─────────────────────────────────────────────────────────┐
│  Prediction Results (15 images)                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ 🖼️   │ │ 🖼️   │ │ 🖼️   │ │ 🖼️   │ │ 🖼️   │         │
│  │ Cat  │ │ Dog  │ │Person│ │ Car  │ │ Cat  │ ← Click  │
│  │  2   │ │  1   │ │  3   │ │  1   │ │  1   │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
│                                                          │
│  [Load More...]                                          │
└─────────────────────────────────────────────────────────┘
```

#### Advanced Image Viewer (Click thumbnail)
```
┌─────────────────────────────────────────────────────────┐
│  ← → [Image 1/15]    image_001.jpg          [✕] Close  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│              [Large Image with Bboxes]                   │
│                                                          │
│  Detections:                                             │
│  🔹 Cat (95.2%)      Bbox: [x, y, w, h]                 │
│  🔹 Cat (87.3%)      Bbox: [x, y, w, h]                 │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  [Zoom In] [Zoom Out] [Toggle Boxes] [Download]         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Thumbnail grid with object counts
- Click → Full-screen viewer
- Navigation arrows (← →)
- Bounding boxes with labels & confidence
- Zoom controls
- Toggle boxes on/off
- Download individual image predictions

### Backend API

#### Endpoint: `POST /api/v1/training/{training_id}/predict`

**Request Body (Dataset):**
```json
{
  "dataset_source": "val",
  "confidence": 0.25,
  "iou_threshold": 0.45
}
```

**Request Body (Upload):**
```
Content-Type: multipart/form-data

Files: image1.jpg, image2.jpg, ...
Body: {
  "confidence": 0.25,
  "iou_threshold": 0.45
}
```

**Response:**
```json
{
  "experiment_id": "exp_456",
  "status": "running",
  "message": "Prediction started on 15 images"
}
```

#### Endpoint: `GET /api/v1/experiments/{experiment_id}`

**Response:**
```json
{
  "id": "exp_456",
  "experiment_type": "prediction",
  "status": "completed",
  "image_count": 15,
  "output_folder": "/path/to/predictions/exp_456",
  "predictions": {
    "image_001.jpg": [
      {
        "class": "cat",
        "confidence": 0.952,
        "bbox": [120, 50, 200, 180]
      },
      {
        "class": "cat",
        "confidence": 0.873,
        "bbox": [340, 80, 180, 160]
      }
    ],
    "image_002.jpg": [...]
  },
  "duration_sec": 8.3
}
```

#### Endpoint: `GET /api/v1/experiments/{experiment_id}/download`

Downloads ZIP file with:
- Original images
- Annotated images (with bboxes)
- JSON results file

---

## Data Extraction from Training Record

### Everything You Need is in the `trainings` Table! ✅

```python
class ExperimentDataExtractor:
    """Extract all needed data from training database record"""
    
    @staticmethod
    def extract_paths(training_record):
        """
        Extract all file paths from training record
        
        Args:
            training_record: Database row from trainings table
        
        Returns:
            Dict with all paths needed for validation/prediction
        """
        # Model paths
        model_best = f"{training_record['weights_dir']}/best.pt"
        model_last = f"{training_record['weights_dir']}/last.pt"
        
        # Dataset YAML path
        dataset_summary = json.loads(training_record['dataset_summary_json'])
        dataset_yaml = dataset_summary['data_yaml_path']
        
        # Dataset image folders (from data.yaml structure)
        dataset_base = training_record['dataset_release_dir']
        val_images = f"{dataset_base}/valid/images"    # Validation set
        test_images = f"{dataset_base}/test/images"     # Test set (if exists)
        
        # Experiments output folder
        experiments_dir = f"{training_record['run_dir']}/experiments"
        
        return {
            'model_best': model_best,
            'model_last': model_last,
            'dataset_yaml': dataset_yaml,
            'val_images_dir': val_images,
            'test_images_dir': test_images,
            'experiments_dir': experiments_dir
        }
    
    @staticmethod
    def extract_params(training_record):
        """Extract parameters from training config"""
        config = json.loads(training_record['resolved_config_json'])
        
        return {
            'task': training_record['task'],              # 'detection' or 'segmentation'
            'framework': training_record['framework'],    # 'ultralytics'
            'imgsz': config['train']['imgsz'],           # 640
            'device': config['train']['device'],         # 'cuda:0' or 'cpu'
            'batch': config['train'].get('batch', 16),   # Batch size
            'project_id': training_record['project_id'],
            'training_uid': training_record['training_uid']
        }
    
    @staticmethod
    def get_experiment_output_folder(training_record, experiment_type):
        """
        Generate output folder for new experiment
        
        Args:
            training_record: Database row
            experiment_type: 'validation' or 'prediction'
        
        Returns:
            Path for experiment output
        """
        import uuid
        experiment_id = str(uuid.uuid4())[:8]
        
        base_dir = f"{training_record['run_dir']}/experiments"
        return f"{base_dir}/{experiment_type}/{experiment_id}"

# Usage Example:
training = db.get_training_by_id(18)

paths = ExperimentDataExtractor.extract_paths(training)
# {
#   'model_best': 'projects/gevis/model/training/srl_obje-1/weights/best.pt',
#   'dataset_yaml': 'V:\\...\\object_detection_yolo_detection\\data.yaml',
#   'val_images_dir': 'projects/gevis/training_data/.../valid/images',
#   ...
# }

params = ExperimentDataExtractor.extract_params(training)
# {
#   'task': 'detection',
#   'framework': 'ultralytics',
#   'imgsz': 640,
#   'device': 'cuda:0',
#   ...
# }
```

---

## Framework-Agnostic Design

### Official Ultralytics API Implementation

#### Validation with Custom Parameters

```python
from ultralytics import YOLO
import json

class UltralyticsValidator:
    """Ultralytics YOLO Validator - Official API"""
    
    def validate(self, model_path, dataset_yaml, output_folder, params):
        """
        Run validation with custom parameters
        
        Args:
            model_path: Path to model file (best.pt, last.pt)
            dataset_yaml: Path to ORIGINAL dataset.yaml
            output_folder: Custom output directory
            params: Dict with conf, iou, max_det, dataset_source
        
        Returns:
            Dict with metrics and confusion matrix
        """
        # ✅ CRITICAL: Create temporary data.yaml for custom split!
        # YOLO requires data.yaml, but original has fixed paths (val, train, test)
        # We need to dynamically select which split to validate on
        
        import yaml
        import tempfile
        import os
        
        # Read original data.yaml
        with open(dataset_yaml, 'r') as f:
            data_config = yaml.safe_load(f)
        
        # Get user's selected dataset source ('val', 'test', 'train')
        dataset_source = params.get('dataset_source', 'val')
        
        # Get base directory
        dataset_base = os.path.dirname(dataset_yaml)
        
        # ✅ Create temporary data.yaml with selected split as "val"
        # YOLO always validates on the "val" path in data.yaml
        # So we map user's selection to "val" path
        temp_data_config = {
            'path': data_config.get('path', dataset_base),
            'nc': data_config['nc'],
            'names': data_config['names'],
            # ✅ Map selected split to "val" path for YOLO
            'val': f'{dataset_source}/images',    # e.g., 'test/images' if user selected test
            # Keep original train (not used for validation)
            'train': data_config.get('train', 'train/images')
        }
        
        # Save temporary data.yaml
        temp_yaml_path = os.path.join(output_folder, 'temp_data.yaml')
        os.makedirs(output_folder, exist_ok=True)
        with open(temp_yaml_path, 'w') as f:
            yaml.dump(temp_data_config, f)
        
        # Load model
        model = YOLO(model_path)
        
        # Run validation with TEMPORARY data.yaml ✅
        results = model.val(
            data=temp_yaml_path,          # ✅ Use temp yaml, not original!
            task='detect',                # ✅ 'detect' or 'segment' (auto-detected but explicit is better)
            imgsz=640,                    # ✅ Image size (default: 640)
            batch=16,                     # ✅ Batch size (default: 16)
            conf=params.get('confidence', 0.25),
            iou=params.get('iou_threshold', 0.45),
            max_det=params.get('max_detections', 300),
            device='0',                   # ✅ '0' for GPU, 'cpu' for CPU (auto-detects if omitted)
            project=output_folder,        # Custom output directory
            name='validation',            # Subfolder name
            save=True,                    # Save confusion matrix PNG
            save_json=True,               # Save results as JSON
            plots=True                    # Save plots
        )
        
        # ✅ Confusion Matrix - Multiple formats available:
        # 1. .matrix.tolist()  → 2D array (JSON) - BEST for DB/UI visualization ✅
        # 2. .to_df()          → Polars DataFrame - For advanced analysis
        # 3. .plot()           → Saves PNG image
        
        confusion_matrix = results.confusion_matrix.matrix.tolist() if results.confusion_matrix else None
        # Example: [[85, 5, 2], [3, 92, 1], [1, 2, 88]]
        # Row = Actual class, Column = Predicted class
        
        # ✅ Use official YOLO result methods for easy data export
        metrics_summary = results.results_dict  # Main metrics dict
        
        # For UI/API - use built-in conversion methods:
        # results.summary()    → List[Dict] - Summary of all metrics
        # results.to_json()    → JSON string - Perfect for API/UI ✅
        # results.to_df()      → Polars DataFrame - For data analysis
        # results.to_csv()     → CSV string - For export
        
        # Extract metrics for database storage
        metrics = {
            'mAP@0.5': metrics_summary.get('metrics/mAP50(B)', 0),
            'mAP@0.5:0.95': metrics_summary.get('metrics/mAP50-95(B)', 0),
            'precision': metrics_summary.get('metrics/precision(B)', 0),
            'recall': metrics_summary.get('metrics/recall(B)', 0),
            'f1': (2 * metrics_summary.get('metrics/precision(B)', 0) * 
                   metrics_summary.get('metrics/recall(B)', 0)) / 
                  (metrics_summary.get('metrics/precision(B)', 0) + 
                   metrics_summary.get('metrics/recall(B)', 0) + 1e-6)
        }
        
        # Per-class metrics
        per_class = {}
        if results.names:
            for class_id, class_name in results.names.items():
                per_class[class_name] = {
                    'mAP50': results.box.maps[class_id] if hasattr(results, 'box') else 0,
                    'precision': results.box.p[class_id] if hasattr(results, 'box') else 0,
                    'recall': results.box.r[class_id] if hasattr(results, 'box') else 0
                }
        
        return {
            'metrics': metrics,
            'per_class_metrics': per_class,
            'confusion_matrix': confusion_matrix,
            'results_json': results.to_json(),      # ✅ For UI visualization
            'results_summary': results.summary(),   # ✅ Alternative format
            'output_folder': f"{output_folder}/validation"
        }
```

#### Prediction with Custom Parameters

```python
class UltralyticsPred ictor:
    """Ultralytics YOLO Predictor - Official API"""
    
    def predict(self, model_path, image_sources, output_folder, params):
        """
        Run prediction with custom parameters
        
        Args:
            model_path: Path to model file
            image_sources: List of image paths or folder path
            output_folder: Custom output directory
            params: Dict with conf, iou
        
        Returns:
            Dict with predictions per image
        """
        # Load model
        model = YOLO(model_path)
        
        # Run prediction with custom params
        results = model.predict(
            source=image_sources,
            task='detect',                 # ✅ 'detect' or 'segment'
            imgsz=640,                     # ✅ Image size
            conf=params.get('confidence', 0.25),
            iou=params.get('iou_threshold', 0.45),
            device='0',                    # ✅ '0' for GPU, 'cpu' for CPU
            project=output_folder,         # Custom output directory
            name='predictions',            # Subfolder name
            save=True,                     # Save annotated images
            save_txt=True,                 # Save labels as .txt
            save_conf=True,                # Save confidence in labels
            show_labels=True,              # Show labels on images
            show_conf=True                 # Show confidence on images
        )
        
        # Extract predictions per image
        predictions = {}
        for result in results:
            image_name = result.path.split('/')[-1]
            boxes = result.boxes
            
            predictions[image_name] = []
            for i in range(len(boxes)):
                predictions[image_name].append({
                    'class': result.names[int(boxes.cls[i])],
                    'confidence': float(boxes.conf[i]),
                    'bbox': boxes.xyxy[i].tolist()  # [x1, y1, x2, y2]
                })
        
        return {
            'predictions': predictions,
            'image_count': len(results),
            'output_folder': f"{output_folder}/predictions"
        }
```

### Backend Validator Registry

```python
class ValidatorRegistry:
    """Framework-agnostic validator registry"""
    
    validators = {
        'ultralytics': UltralyticsValidator,
        'mmdetection': MMDetValidator,      # Future
        'detectron2': Detectron2Validator,  # Future
        # More frameworks...
    }
    
    @staticmethod
    def get_validator(framework: str):
        """Get validator instance for framework"""
        validator_class = ValidatorRegistry.validators.get(framework)
        if not validator_class:
            raise ValueError(f"Unsupported framework: {framework}")
        return validator_class()
    
    @staticmethod
    def get_predictor(framework: str):
        """Get predictor instance for framework"""
        # Similar to get_validator
        pass
    
    @staticmethod
    def get_params_schema(framework: str, operation: str):
        """Get parameter schema for dynamic UI generation"""
        schemas = {
            'ultralytics': {
                'validation': {
                    'confidence': {'min': 0.01, 'max': 1.0, 'default': 0.25, 'type': 'slider'},
                    'iou_threshold': {'min': 0.1, 'max': 0.95, 'default': 0.45, 'type': 'slider'},
                    'max_detections': {'min': 10, 'max': 1000, 'default': 300, 'type': 'slider'}
                },
                'prediction': {
                    'confidence': {'min': 0.01, 'max': 1.0, 'default': 0.25, 'type': 'slider'},
                    'iou_threshold': {'min': 0.1, 'max': 0.95, 'default': 0.45, 'type': 'slider'}
                }
            }
        }
        return schemas.get(framework, {}).get(operation, {})
```

### Dynamic UI Generation

Frontend fetches parameter schema from backend and renders controls dynamically:

```javascript
// GET /api/v1/training/{id}/params-schema
{
  "validation": {
    "confidence": {"type": "slider", "min": 0.01, "max": 1.0, "default": 0.25},
    "iou_threshold": {"type": "slider", "min": 0.1, "max": 0.95, "default": 0.45},
    "max_detections": {"type": "slider", "min": 10, "max": 1000, "default": 300}
  }
}

// UI renders sliders automatically
```

---

## File Structure

```
training_sessions/
└── {training_id}/
    ├── runs/
    │   └── train/
    │       ├── weights/
    │       │   ├── best.pt
    │       │   └── last.pt
    │       └── ...
    └── experiments/
        ├── validation/
        │   ├── exp_123/
        │   │   ├── results.json
        │   │   └── confusion_matrix.png
        │   └── exp_124/
        └── prediction/
            ├── exp_456/
            │   ├── results.json
            │   ├── original/
            │   │   ├── image_001.jpg
            │   │   └── image_002.jpg
            │   └── annotated/
            │       ├── image_001.jpg  (with bboxes)
            │       └── image_002.jpg
            └── exp_457/
```

---

## Missing Considerations

### 1. Experiment History
- Show list of past experiments for each training
- Allow re-running with same params
- Compare multiple experiments side-by-side

### 2. Export/Share
- Export validation results as PDF report
- Share prediction results via link
- Copy results to clipboard

### 3. Real-time Progress
- WebSocket updates during validation/prediction
- Progress bar showing processed images
- Cancel running experiment

### 4. Batch Operations
- Run predictions on multiple models
- Compare validation across different checkpoints
- Batch download results

### 5. Advanced Filters
- Filter predictions by confidence threshold
- Filter by specific classes
- Filter by detection count

---

## Next Steps

1. Create database migration for `model_experiments` table
2. Implement backend validators (start with YOLO)
3. Create validation API endpoints
4. Build Validation Tab UI
5. Create prediction API endpoints
6. Build Prediction Tab UI with image viewer
7. Test end-to-end with real training session

---

## Database Migration Command

```python
# Create table
alembic revision --autogenerate -m "Add model_experiments table"
alembic upgrade head
```

---

**Ready to start implementation in new conversation!** 🚀
