## Change
- Use `file_path` (project) or `path` (global) to include only `.pt` models.
- Filter by backend `type` (object detection vs segmentation); fallback to filename hint only if type missing.
- Never include non-.pt entries; avoid dummy names unless no real models exist.

## File
- `frontend/src/components/project-workspace/ModelTrainingSection/PretrainedModel/PretrainedModelSelect.jsx`

## Result
- Both tasks show only real models that can be trained; no ONNX/other formats; no dummy entries when real models are available.