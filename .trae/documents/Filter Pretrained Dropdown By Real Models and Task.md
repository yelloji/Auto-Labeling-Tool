## Change
- In PretrainedModelSelect, include only real models with `.pt` (or format PyTorch) and filter by backend `type` to match selected task.
- Use API models when available; fallback to static YOLO list only if no matches.
- Value stays as usable identifier (`path` if present, else `name`).

## Files
- `frontend/src/components/project-workspace/ModelTrainingSection/PretrainedModel/PretrainedModelSelect.jsx`

## Outcome
- Segmentation shows only real segmentation models; Object Detection shows only detection models.
- No dummy entries when real models exist. 