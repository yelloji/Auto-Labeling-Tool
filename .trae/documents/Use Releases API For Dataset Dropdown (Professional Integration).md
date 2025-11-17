## Approach
- Use existing endpoint `GET /api/v1/projects/{project_id}/releases` (directly tied to Release table).
- Display `release.name` (fallback `release_version`) in dropdown; use `release.model_path` as value.
- Filter to items where `model_path` ends with `.zip`.

## Frontend Changes
- In `DatasetSection.jsx`:
  - Fetch with `releasesAPI.getProjectReleases(projectId)` (already wired).
  - Map options: `label = name || release_version`, `value = model_path`.
  - Auto-select first `.zip` if none selected.
  - Empty state: “No releases available for this project”.
  - Optional: show `task_type` badge and warn if task mismatch.

## Backend (later when starting training)
- Use the selected `model_path` to extract ZIP into `projects/<projectName>/training_data/<release_slug>/`.
- Read `data.yaml` to validate task and load classes/splits.

## Outcome
- Professional, permanent integration using your Release table/API.
- Clean dropdown UX with release names; training uses the exact ZIP path.

Proceed to implement these UI updates now?