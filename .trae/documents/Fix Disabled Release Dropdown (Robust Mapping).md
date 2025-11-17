## Problem
- Dropdown is disabled because it sees no `.zip` entries; filesystem has 12 releases, but API entries may not expose ZIP under `model_path`.

## Fix (UI-only)
- Use Releases API `GET /api/v1/projects/{project_id}/releases`.
- Map robustly:
  - `zipPath = r.model_path || r.path || r.release_zip || r.zip_path || ''`
  - `label = r.name || r.release_version || 'Release'`
- Enable when there is at least one release (`releases.length > 0`).
- Filter to show `.zip` when available; if none, still show names but mark “No ZIP” in summary and keep Start disabled.
- Auto-select first `.zip` if none chosen.

## Optional (later)
- Add a backend sync that populates `model_path` from `projects/<projectName>/releases/` to keep DB consistent.

## Files
- `frontend/src/components/project-workspace/ModelTrainingSection/Dataset/DatasetSection.jsx` (mapping + enablement)

## Outcome
- Release names appear, dropdown enabled; selection yields ZIP path when present; Start is gated correctly.

Proceed to implement these UI updates now?