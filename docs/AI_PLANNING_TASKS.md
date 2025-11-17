# AI Planning & Tracking Doc

Objective
- Design the application to use Ultralytics only for internal training while shipping ONNX-only inference to customers via Docker, avoiding AGPL obligations in the distributed runtime.
- Keep the system modular so we can switch to other frameworks (e.g., MMYOLO/MMDetection) later with minimal changes.

Deployment & Licensing Strategy
- Internal Training Environment:
  - Ultralytics YOLO for training and inspection.
  - After training, export to ONNX (.onnx) for deployment.
  - TRAINING_ENABLED=true; MODEL_UPLOAD_POLICY=ALLOW_PT_AND_ONNX.
- Customer Runtime (distributed Docker image):
  - ONNX Runtime/PyTorch runtime only (no Ultralytics package).
  - Accept ONNX models for inference; no training features exposed.
  - TRAINING_ENABLED=false; MODEL_UPLOAD_POLICY=ONNX_ONLY.

Environment Flags
- TRAINING_ENABLED: boolean; enables/disables all training endpoints/flows.
- MODEL_UPLOAD_POLICY: enum; values: ONNX_ONLY | ALLOW_PT_AND_ONNX | ALLOW_ALL.

Database: ai_models schema (already present)
- Fields: id, name, type, format, file_path, nc, classes[], input_size_default [w,h], training_input_size [w,h], created_at, updated_at.
- We will add ‘placeholder’ entries with format="unknown" and file_path="pending" to store metadata before a file upload exists.

New API: Create Model Metadata Placeholder (Step 1)
- Endpoint: POST /api/v1/models/placeholder
- Purpose: Create an AiModel row without a file; capture metadata early.
- Request Body (JSON):
  {
    "name": "My Detector",
    "type": "object_detection",
    "classes": ["classA", "classB"],
    "input_size_default": [640, 640],
    "training_input_size": [640, 640],
    "description": "Prototype model placeholder"
  }
- Server Behavior:
  - Validate unique name.
  - Set nc = len(classes) or 0 if classes omitted.
  - Persist: format = "unknown"; file_path = "pending"; type; classes; input sizes; description.
  - Return the created AiModel JSON with a derived status field (e.g., status = "placeholder").
- Response (example):
  {
    "id": "uuid-...",
    "name": "My Detector",
    "type": "object_detection",
    "format": "unknown",
    "file_path": "pending",
    "nc": 2,
    "classes": ["classA", "classB"],
    "input_size_default": [640, 640],
    "training_input_size": [640, 640],
    "status": "placeholder",
    "created_at": "...",
    "updated_at": "..."
  }
- Validation & Errors:
  - 409 if name already exists.
  - 400 if invalid type or sizes.
  - 422 for malformed JSON.

Existing API: File Import (reference)
- Endpoint: POST /api/v1/models/import
- Accepts: .pt, .onnx, .engine in internal environment.
- In Customer Runtime: reject .pt/.pth when MODEL_UPLOAD_POLICY=ONNX_ONLY.
- For ONNX uploads in runtime: require classes[] or nc in the form; treat as inference-only (no retrain).

Frontend Changes (Step 2)
- Models page:
  - Add “New Placeholder” form: name, type, classes (tag input or comma-separated), default input size, optional training size, description.
  - Render a badge for placeholders: “Placeholder (no file)”.
  - If runtime (TRAINING_ENABLED=false):
    - Hide retrain UI.
    - Model upload modal allows ONNX-only; show metadata fields (classes/nc required).
  - If internal training:
    - Allow attaching .pt/.pth/.onnx to placeholders.
    - Show “Retrain” controls (Ultralytics).

Adapter Layer for Auto‑Labeling (Step 3)
- Define ModelAdapter interface:
  - load(model_path, classes, input_size)
  - infer(image, confidence, iou)
  - normalize(predictions) => [{class_id, class_name, confidence, bbox: [x_min, y_min, x_max, y_max]}]
- Implement adapters:
  - UltralyticsAdapter: used in internal training environment.
  - ONNXAdapter: used in customer runtime.
- The auto-label job runner picks an adapter based on model.format and environment flags.

Auto‑Label Job Runner Integration
- For runtime ONNX-only:
  - Use ONNXAdapter; no training/retrain endpoints exposed.
- For internal training:
  - UltralyticsAdapter allowed; after training, export ONNX and update ai_models entry with ONNX path for deployment.

Compliance Notes
- Add NOTICE/licenses to the distributed runtime:
  - ONNX Runtime (MIT), PyTorch (BSD-3-Clause), other permissive libs.
  - Document that Ultralytics is used only in internal training environment (or covered by commercial license if chosen).
- Keep Ultralytics out of the customer Docker image to avoid AGPL obligations.

Testing & Acceptance Criteria
- Placeholder API:
  - Create new placeholder; verify DB row created with format="unknown" and file_path="pending".
  - Attempt inference on placeholder => API returns clear error “Model file not available”.
- Runtime Gating:
  - In runtime image, upload .pt/.pth => 400 “Runtime is ONNX-only”.
  - Upload .onnx without classes => 400 “classes or nc required”.
  - Upload .onnx with classes => success; no retrain UI.
- Adapter Layer:
  - Predict via ONNXAdapter returns normalized bbox format; auto-label job creates annotations.

Migration Readiness
- Because adapters standardize predictions, switching to MMYOLO/MMDetection later only requires a new adapter and training/export flow; database and UI stay stable.

Task Tracking
- Metadata Placeholder API — Status: in_progress
  - Implement POST /models/placeholder.
  - Validation, error handling, response schema.
- Frontend: Training UI scaffold — Status: pending
  - Form to create/edit placeholders; badge rendering; runtime/internals gating.
- Runtime policy gating — Status: pending
  - TRAINING_ENABLED=false; MODEL_UPLOAD_POLICY=ONNX_ONLY; reject .pt/.pth in runtime.
- ModelAdapter layer — Status: pending
  - Interface + UltralyticsAdapter + ONNXAdapter.
- Auto‑labeling implementation — Status: pending
  - Wire adapters into job runner; runtime uses ONNX.
- Compliance docs — Status: pending
  - Add NOTICE/licenses; document licensing stance.

References (current code)
- DB models: backend/database/models.py (AiModel schema: name, type, format, file_path, nc, classes, input sizes).
- Model import route: backend/api/routes/models.py (/api/v1/models/import).
- AiModel operations: backend/database/operations.py (upsert_ai_model, sync_from_config).

Next Actions
- Complete the placeholder endpoint.
- Add runtime gating flags and enforce ONNX-only policy in customer Docker.
- Implement adapters and connect the auto‑label job runner.
- Ship the minimal frontend changes for placeholders and upload modal behavior.