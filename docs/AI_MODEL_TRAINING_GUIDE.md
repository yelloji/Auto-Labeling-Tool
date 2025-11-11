# AI Model Training Guide (Local GPU / CUDA)

Goal
- Train and use AI models (YOLO and custom) locally from the website (localhost) with smooth flow and zero errors.
- First step: import a REAL AI model into the system.

Overview
- Frontend (website) sends actions.
- Backend (Python/FastAPI) does heavy work (import, train, predict). If CUDA is available, training runs on your local GPU.
- Current status: models can be listed and imported. Training endpoints need to be added and wired to the UI.

Prerequisites
1) NVIDIA GPU and drivers installed.
2) Install CUDA-enabled PyTorch in the backend environment.
   - Use `backend/requirements-cuda121.txt` (project standard for GPU training).
3) Ultralytics YOLO is already referenced in code (used by `backend/models/model_manager.py`).

Choosing the right requirements file (CPU vs CUDA)
- If you want GPU acceleration and your system has CUDA 12.1: use `backend/requirements-cuda121.txt`.
  - Command: `pip install -r backend/requirements-cuda121.txt`
  - If you previously installed CPU-only Torch, first run: `pip uninstall -y torch torchvision torchaudio`
- If you do NOT have a GPU or CUDA: use `backend/requirements.txt` (CPU Torch).
  - Command: `pip install -r backend/requirements.txt`
Project uses Python venv (not conda)
- Create venv: `python -m venv .venv`
- Activate:
  - Windows: `.venv\\Scripts\\activate`
  - Linux/macOS: `source .venv/bin/activate`
- Upgrade pip: `python -m pip install --upgrade pip`
- Install GPU deps: `pip install -r backend/requirements-cuda121.txt`

Quick CUDA check
```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda)"
```
If you get `CUDA available: True`, your GPU is ready.

Automated setup via start.py
- You do NOT need to create venv manually. The root script `start.py` will:
  - Create backend venv automatically (backend/venv) if missing
  - Install backend deps using `backend/requirements-cuda121.txt` (GPU)
  - Install frontend deps (npm install) if missing
  - Launch backend (port 12000) and frontend (port 12001)
- Prereqs it does NOT install: Node.js and Python 3.10 (install these yourself once).

Step 1 — Import a REAL model (first task)
You can import via the Website UI or API.

Option A: Website UI
- Open the navbar → Models (/models).
- Click “Upload Model”.
- Fill:
  - Name: e.g., "YOLOv8 Custom"
  - Type: object_detection / instance_segmentation / etc.
  - Choose a file: .pt (PyTorch), .onnx (ONNX), or .engine (TensorRT)
- Submit. On success, you will see the new model card. Status will show as "Pending" until we add training/ready logic.

Option B: API (direct call)
- Endpoint: `POST /models/import`
- Multipart form fields:
  - file: model file (.pt / .onnx / .engine)
  - name: string
  - type: one of `object_detection`, `instance_segmentation`, `semantic_segmentation`, `classification`, `pose_estimation`
  - classes: optional JSON string of class names
  - description, confidence_threshold, iou_threshold (optional)

Example curl:
```bash
curl -X POST "http://localhost:12000/models/import" \
  -F "file=@/path/to/model.pt" \
  -F "name=My Custom YOLO" \
  -F "type=object_detection" \
  -F "description=First real model"
```

Traditional training outside the website (upload later)
- If you already train models the traditional way, just produce the weights file and upload it.
- Example YOLO training command (GPU if available):
  - Detection:
    ```bash
    yolo detect/train data=/path/to/data.yaml model=yolov8n.pt epochs=50 imgsz=640 device=0
    ```
  - After training completes, use the best weights file (typically `runs/.../weights/best.pt`).
- Upload that file via the Models page (or API) and set the correct Type.

Supported model formats
- .pt (PyTorch)
- .onnx (ONNX)
- .engine (TensorRT)

Verification checklist after upload
- UI: your model card appears on /models, and “Custom Models” count increases.
- API: `GET /models` returns the new model in the list.
- Files: uploaded file is saved under `models/custom/` and tracked in `models/models_config.json`.

Optional — Quick test prediction
- Endpoint: `POST /models/predict`
- Send multipart with `file` (image) and JSON field `model_id` (the id of your uploaded model).
- Example:
  ```bash
  curl -X POST "http://localhost:12000/models/predict" \
    -F "file=@/path/to/test.jpg" \
    -F "model_id=<your-model-id>"
  ```
  The backend runs inference using your uploaded model and returns predictions.

Where files are stored
- Settings path: `settings.MODELS_DIR` (see `backend/core/config.py`).
- Pretrained and YOLO models: `models/yolo/`
- Custom imports: `models/custom/`
- Model config JSON: `models/models_config.json` (managed by `backend/models/model_manager.py`).

Step 2 — Verify the model is visible
- Website: Models page → your model card should appear.
- API: `GET /models/` returns array of models.

Step 3 — Enable Local CUDA Training (design)
- We will add training endpoints that start YOLO training locally, track progress, and update model statuses.
- Database models for training already exist: `backend/models/training.py` (TrainingSession, TrainingIteration, ModelVersion).

Proposed Backend Endpoints
1) `POST /training/sessions`
   - Start a training job.
   - Payload (JSON):
     ```json
     {
       "dataset_id": "<dataset-id>",
       "base_model_id": "yolov8n" ,
       "epochs": 50,
       "batch_size": 16,
       "image_size": 640,
       "learning_rate": 0.001
     }
     ```
   - Response: `{ "session_id": 123, "status": "training" }`

2) `GET /training/sessions/{id}`
   - Returns status: `pending | training | completed | failed`, and progress percent if available.
   - Metrics: map50/map95, precision, recall, loss (from YOLO results).

3) `POST /training/sessions/{id}/cancel`
   - Stops a running job.

4) Update models API
   - `GET /models/` should include for each model:
     - `is_training: bool`
     - `is_ready: bool`
     - `accuracy/map`: number
     - `created_at`: date
     - `file_size`: bytes

Backend Implementation Notes
- Training loop can call Ultralytics:
  ```python
  from ultralytics import YOLO
  model = YOLO(base_model_path_or_id)
  model.train(data=dataset_yaml_path, epochs=epochs, imgsz=image_size, device=0)  # device=0 → use GPU
  ```
- Save best weights and metrics to `ModelVersion` (and filesystem under `models/training/` or project path).
- When training completes: set `is_training=false`, `is_ready=true` in model record, store metrics.

Step 4 — Frontend wiring (Model Training section)
- File: `frontend/src/components/project-workspace/ModelTrainingSection/ModelTrainingSection.jsx`
- Actions:
  - “Start Training” → POST `/training/sessions` with current project/dataset.
  - Show progress by polling `GET /training/sessions/{id}`.
  - On completion → refresh models list and show “Ready” with metrics.

Status Flow (simple)
1) Pending → model imported, not trained.
2) Training → job running (UI shows progress bar, Dashboard “Training” count increases).
3) Ready → training finished, metrics present (Dashboard “Ready Models” increases).
4) Custom → imported by user; can also become Ready after training.

Step 5 — Use trained model for Auto‑Labeling
- Connect trained model id in annotation pipeline (`backend/core/auto_labeler.py` or related services).
- The website can then run predictions for selected datasets/images using the chosen model.

Troubleshooting
- If `/models/import` fails: check file extension (.pt/.onnx/.engine) and max file size (see `settings.MAX_FILE_SIZE`).
- If CUDA not detected: install correct PyTorch build (match CUDA version), verify with the quick check above.
- If training stalls: check backend logs, ensure dataset YAML is valid, and GPU memory is sufficient.

Ask me anything
- If any step is unclear, ask. I can adjust endpoints, payloads, or UI flow as you need. We will keep this smooth and error‑free.