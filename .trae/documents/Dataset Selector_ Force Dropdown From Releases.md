## What I'll Change

* In `DatasetSection.jsx`, always show a dropdown of project releases; remove manual text input fallback.

* Default `Dataset Source` to `Release ZIP` and disable `Custom Path`.

* Populate options from `projectReleases` filtered to items with `.zip` in `model_path`.

* Label each option with `release.name` or `release_version` + ZIP filename.

* If no releases, show a disabled dropdown with “No releases available for this project”.

* Auto-select the first available release if none chosen.

## Files

* `frontend/src/components/project-workspace/ModelTrainingSection/Dataset/DatasetSection.jsx` only.

## Result

* Users pick dataset via dropdown; no typing paths. Ready to wire training next.

