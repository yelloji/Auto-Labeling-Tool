## What I'll Change
- Use `GET /api/v1/projects/{project_id}/releases` as the single source.
- Build dropdown options with:
  - label: `release.name || release.release_version`
  - value: `release.model_path`
  - include only when `model_path` ends with `.zip`.
- Enable control when there is at least one `.zip` release: `hasZip = releases.some(zip)`.
- Auto-select the first `.zip` when none selected.

## Files
- `frontend/src/components/project-workspace/ModelTrainingSection/Dataset/DatasetSection.jsx` (enablement + mapping)
- Verify `frontend/src/services/api.js` releases call already returns data; keep unchanged.

## Result
- Dropdown shows release names, not filenames; is enabled when `.zip` exists; selection yields ZIP path for training.

Proceed to implement now?