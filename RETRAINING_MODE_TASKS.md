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
- [x] `POST /api/v1/retraining/{project_id}/create-release` — auto-copy config from reference
- [x] `POST /api/v1/retraining/{project_id}/start-training` — copy all params, user gives name only
- [x] Register routes in main app

---

## PHASE 2 — Mode Toggle

### Task 2.1 — AppModeContext
- [ ] Create `frontend/src/context/AppModeContext.jsx`
- [ ] State: `fullMode` / `retrainingMode`
- [ ] Persist mode in localStorage
- [ ] Wrap app with context provider

### Task 2.2 — Nav Bar Toggle
- [ ] Add mode toggle switch to top navigation bar — labels: `Full Mode` | `User Retraining Mode`
- [ ] Add tooltip on hover: *"Simplified mode for operators to retrain existing models"*
- [ ] Style consistent with existing app color scheme (purple/blue theme)
- [ ] "Gevis AI Studio" branding consistent across all Retraining Mode pages
- [ ] Switching mode refreshes current page

---

## PHASE 3 — Retraining Projects Page

### Task 3.1 — RetrainingProjects
- [ ] Create `frontend/src/components/retraining/RetrainingProjects.jsx`
- [ ] Fetch only projects with retraining reference (`GET /retraining/projects`)
- [ ] If project has no reference → show locked state with message:
  "No production reference set. Please contact your developer."
- [ ] Click unlocked project → enter retraining workspace

---

## PHASE 4 — Retraining Labeling

### Task 4.1 — RetrainingLabeling
- [ ] Create `frontend/src/components/retraining/RetrainingLabeling.jsx`
- [ ] Two tabs: `New` (newly uploaded images) and `Old` (existing project images)
- [ ] Show image count + labeled count per tab
- [ ] Click image → enter existing manual labeling UI (reuse)
- [ ] Upload button → reuse existing upload component
- [ ] "Add to Dataset" button after all images labeled
  - Auto split using same ratios as reference release
  - Show result: X train / Y val / Z test
- [ ] "Create Release" button after split complete
  - Calls `POST /retraining/{project_id}/create-release`
  - No transformation UI shown
  - No release history shown

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
- [ ] Add "Assign to Production" button in Model Lab → experiment Overview tab
- [ ] Calls `POST /retraining/{project_id}/assign-production`
- [ ] Confirm dialog before assigning
- [ ] Show which experiment is currently set as production reference

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

*(Update this section as tasks are completed)*
