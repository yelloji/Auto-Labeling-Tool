## Change
- Update `PretrainedModelSelect` to load both global and project models.

## Data Sources
- Global: `modelsAPI.getModels()`
- Project: `projectsAPI.getProjectModels(projectId, includeGlobal=false)`

## Behavior
- Merge lists, de-duplicate by `id` or `path`.
- Filter by task type using filename hint: `*-seg.pt` → segmentation, `*-cls.pt` → classification, else detection.
- Show badges: scope (Global/Project), size (n/s/m/l/x), status (Ready/Training).
- Fallback to static YOLO list if APIs return empty.

## Files
- `frontend/src/components/project-workspace/ModelTrainingSection/PretrainedModel/PretrainedModelSelect.jsx` (add fetch + render)
- Pass `projectId` into the component from `ModelTrainingSection.jsx`.

## Result
- Dropdown shows both global defaults and local custom models filtered by task.

Proceed to implement?