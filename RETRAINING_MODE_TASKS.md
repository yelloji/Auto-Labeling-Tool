# Retraining Mode — Task Tracker

Reference plan: `RETRAINING_MODE_PLAN.md`

---

## PHASE 1 — Backend Foundation

### Task 1.1 — DB Migration
- [x] Create `retraining_references` table
  - id, project_id, training_session_id, release_id, assigned_at, notes
- [x] Add migration script (in `database.py` init_db — consistent with existing pattern)
- [x] Verify table created on app startup

### Task 1.2 — Backend Routes (`retraining.py`)
- [x] `GET /api/v1/retraining/projects` — only projects with a reference row
- [x] `GET /api/v1/retraining/{project_id}/reference` — get reference params
- [x] `POST /api/v1/retraining/{project_id}/assign-production` — set training as reference
- [x] `DELETE /api/v1/retraining/{project_id}/unassign-production` — remove production reference
- [x] `POST /api/v1/retraining/{project_id}/create-release` — auto-copy config from reference
- [x] `POST /api/v1/retraining/{project_id}/start-training` — copy all params, user gives name only
- [x] Register routes in main app
- [x] Fix 500 error: Release model has no train/val/test_ratio columns — use train/val/test_image_count

---

## PHASE 2 — Mode Toggle

### Task 2.1 — AppModeContext
- [x] Create `frontend/src/context/AppModeContext.jsx`
- [x] State: `fullMode` / `retrainingMode`
- [x] Persist mode in localStorage
- [x] Wrap app with context provider

### Task 2.2 — Nav Bar Toggle
- [x] Add mode toggle switch to top navigation bar — labels: `Full Mode` | `User Retraining Mode`
- [x] Add tooltip on hover: *"Simplified mode for operators to retrain existing models"*
- [x] Style consistent with existing app color scheme (purple/blue theme, highlighted when active)
- [x] Premium segmented switcher with gradient, glow, depth
- [x] Switching mode persists via localStorage

### Task 2.3 — Retraining Mode routing restrictions
- [x] Hide Dashboard and Models nav items in Retraining Mode
- [x] Auto-redirect `/` and `/models` to `/projects` in Retraining Mode (RetrainingGuard in App.js)

---

## PHASE 3 — Retraining Projects Page

### Task 3.1 — RetrainingProjects
- [x] Create `frontend/src/components/retraining/RetrainingProjects.jsx`
- [x] Fetch only projects with retraining reference (`GET /retraining/projects`)
- [x] If project has no reference → show locked state with message:
  "No production reference set. Please contact your developer."
- [x] Ready projects show: green "Ready for retraining" tag, reference date, settings icon
- [x] Click unlocked project → enter retraining workspace (placeholder for now)

---

## PHASE 4 — Upload → Labeling → Release

### Task 4.0 — Decision PENDING before coding
- [ ] Decide split ratio strategy for auto-split when creating a release:
  - Option A: Auto-copy ratio from reference release config (zero operator input)
  - Option B: Show operator a simple slider pre-filled with reference ratio
  - First check what keys the `Release.config` JSON actually stores for split ratios

### Task 4.1 — Upload UI
- [x] Operator can upload new images inside Retraining Mode project workspace
- [x] Reuse existing UploadSection component directly (import, no copy)
- [x] Add `operatorMode` prop to UploadSection — hides developer-only options for operators:
  - Hidden: `Select Folder (images + labels)` — developer import tool
  - Hidden: `Collect Images via Upload API` — not working
  - Hidden: `Import From Cloud Providers` — not working
  - Visible: `Select File(s)`, `Select Folder`, `Upload Videos and Extract Frames`
- [x] Full Mode unchanged — `operatorMode` defaults to `false`
- [x] After upload complete → operator clicks Next to proceed to Labeling step

### Task 4.2 — RetrainingWorkspace
- [x] Create `frontend/src/components/retraining/RetrainingWorkspace.jsx`
- [x] Step navigator: Upload | Label | Release | Train | Results
- [x] Fetches project name for header
- [x] Back to Projects button
- [x] Route added: `/retraining/:projectId` in App.js

### Task 4.3 — RetrainingLabeling
- [x] Create `frontend/src/components/retraining/RetrainingLabeling.jsx`
- [x] Two tabs:
  - `New Images` — unassigned/annotating batches (need labeling)
  - `Old Images` — dataset stage batches (already labeled)
- [x] Image count + labeled count shown per batch
- [x] Label button → navigates to existing annotation progress page (reuse)
- [x] Next button disabled until all new images are fully labeled
- [ ] "Add to Dataset" with auto split — pending split ratio decision

### Task 4.4 — Create Release (auto)
- [ ] "Create Release" button → calls `POST /retraining/{project_id}/create-release`
- [ ] No transformation UI shown to operator
- [ ] No release config shown — all copied from reference release automatically
- [ ] No release history shown
- [ ] On success → proceed to Training step

---

## PHASE 5 — Retraining Training

### Task 5.1 — RetrainingTraining
- [ ] Create `frontend/src/components/retraining/RetrainingTraining.jsx`
- [ ] Training name input field
- [ ] Model selection (two options only):
  - Full pretrained model (YOLO default)
  - best.pt from project Models page (if available)
- [ ] "Start Training" button → calls `POST /retraining/{project_id}/start-training`
- [ ] Live training status (reuse existing training status UI)
- [ ] On complete → navigate to Results

---

## PHASE 6 — Retraining Results

### Task 6.1 — RetrainingResults
- [ ] Create `frontend/src/components/retraining/RetrainingResults.jsx`
- [ ] Show simple training summary (final mAP, loss)
- [ ] Show validation result (auto-run, simple metrics only)
- [ ] Prediction section — operator runs prediction to visually verify
  - Reuse existing prediction image viewer (simplified)
  - Hide advanced analytics, comparison engine
- [ ] "Assign to Production" button → `POST /retraining/{project_id}/assign-production`
- [ ] "Download Model" button → downloads best.pt

---

## PHASE 7 — Full Mode Addition

### Task 7.1 — Assign to Production in Model Lab
- [x] Add "Assign to Production" button in Model Lab → experiment Overview tab
- [x] Calls `POST /retraining/{project_id}/assign-production`
- [x] Confirm dialog before assigning
- [x] Show "Production Reference" badge when already assigned
- [x] Show "Unassign" button when assigned — removes reference record
- [x] Fix isProduction check: use Number() comparison (projectId from URL is string)
- [x] Fix 500 on reference check endpoint (wrong Release column names)

---

## PHASE 8 — Guide Bot Update

### Task 8.1 — Bot pages for Retraining Mode
- [ ] Add retraining bot pages covering full operator flow
- [ ] Upload guidance in Retraining Mode
- [ ] Labeling guidance (New/Old tabs, add to dataset, create release)
- [ ] Training guidance (name input, model selection, start)
- [ ] Results guidance (how to read results, prediction check, assign to production)
- [ ] "Assign to Production" action guidance
- [ ] Message when no reference assigned (contact developer)

---

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Completed

---

## Completion Log

- 2026-04-21 Phase 1 complete — `131c802`, `09c387a`
- 2026-04-21 Phase 2 complete — `f93200a`, `b2b2267`, `34503a8`, `fd78415`, `3ff2971`
- 2026-04-21 Phase 3 complete — `7971554`, `3ff2971`
- 2026-04-21 Phase 7 complete — `269b9fd`, `cd60d2f`, `5b9bc65`, `9bcaddc`
- 2026-04-22 Phase 4 partial — Tasks 4.1, 4.2, 4.3 complete — `9bea6f0`, `d8eb202`, operator upload filtering added
- 2026-04-22 Phase 4 pending — Task 4.0 (split ratio decision) + Task 4.4 (Create Release auto) still pending
