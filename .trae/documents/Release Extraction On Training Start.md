Goal
- When Start Training is clicked, extract selected release ZIP into the project (same level as releases) and use it for training.

What I’ll implement
- Folder layout (per project):
  - `projects/<projectName>/releases/<release>.zip` (existing)
  - `projects/<projectName>/datasets/<release_slug>/` (new extracted folder)
  - Inside: `images/`, `labels/`, `data.yaml`
- Backend flow:
  1) `POST /api/v1/training/sessions` → create session (stores zip_path, task, model, device)
  2) `POST /api/v1/training/sessions/{id}/start` →
     - Extract ZIP to `projects/<projectName>/datasets/<release_slug>/`
     - Read `data.yaml` (classes, nc, splits)
     - Validate task vs release
     - Launch training adapter with extracted path
     - Persist status, paths, and dataset info in session
  3) `GET /api/v1/training/sessions/{id}/status` → progress + last logs

UI
- On dropdown select, show `zip_path`
- On Start, call start endpoint; show extracted path + classes/splits in Status tab

Safety
- If folder exists, reuse or create `-N` suffix
- Large ZIP streaming with progress, errors return clear 4xx/5xx

If you approve, I’ll add the session+start endpoints and extraction logic now.