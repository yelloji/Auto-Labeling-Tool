# Retraining Mode — Implementation Plan

## Core Concept

Retraining Mode is a **simplified UI layer** on top of the existing app.
- No new data tables (except one reference pointer table)
- All data (releases, training sessions, labels, images) saved in the same DB tables and folders as Full Mode
- Retraining Mode = a new training experiment in the same project, created with auto-filled parameters
- Full Mode developer sees all retraining data normally — no difference

---

## Mode Toggle

- Global switch in the **top navigation bar** — always visible
- Two states: `Full Mode` | `Retraining Mode`
- Switching mode refreshes the Projects page (filters project list accordingly)
- No password needed (offline single-device app)
- UI color must match the existing app color scheme (consistent with current setup/config button colors)

---

## New DB Table

### `retraining_references`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | |
| project_id | INTEGER FK | project this reference belongs to |
| training_session_id | INTEGER FK | the production reference training session |
| release_id | INTEGER FK | the reference release (transformation config source) |
| assigned_at | DATETIME | when assigned |
| notes | TEXT | optional developer note |

- One row per project maximum
- Created/updated when developer clicks **"Assign to Production"**
- Only projects with a row in this table are visible in Retraining Mode

---

## New Backend File

### `backend/api/routes/retraining.py`

Endpoints:
```
GET  /api/v1/retraining/projects
     → returns only projects that have a retraining_reference row

GET  /api/v1/retraining/{project_id}/reference
     → returns the reference training session params + release config

POST /api/v1/retraining/{project_id}/assign-production
     → body: { training_session_id }
     → inserts or updates retraining_references row for this project

POST /api/v1/retraining/{project_id}/create-release
     → reads reference release config (transformations, format, task type)
     → creates new release using same config automatically
     → returns new release_id

POST /api/v1/retraining/{project_id}/start-training
     → body: { name }
     → reads reference training session (all params: model, epochs, optimizer, etc.)
     → starts new training experiment with copied params
     → user only provides the name
```

---

## New Frontend Files

```
frontend/src/components/retraining/
├── RetrainingLayout.jsx        ← top-level wrapper, mode routing
├── RetrainingProjects.jsx      ← filtered project list (only projects with reference)
├── RetrainingLabeling.jsx      ← New/Old tabs + annotation progress + Create Release button
├── RetrainingTraining.jsx      ← name input + start training + live status
└── RetrainingResults.jsx       ← prediction view + Assign to Production + Download
```

```
frontend/src/context/
└── AppModeContext.jsx           ← global fullMode / retrainingMode state
```

Existing full mode components are **not modified**.
Retraining components **reuse** existing pieces (labeling canvas, upload section, prediction viewer).

---

## Retraining Mode — Full UI Flow

### Step 1: Upload
- Same upload UI as Full Mode (Select Files / Select Folder / Video extract)
- No changes needed here — reuse existing upload component

### Step 2: Labeling (RetrainingLabeling.jsx)
- **Two tabs:**
  - `New` — newly uploaded images (not yet labeled)
  - `Old` — existing images in the project (labels loaded from DB + file system)
- Each tab shows image count + labeled count
- Click any image → enters same manual labeling UI (reuse existing)
- After all images labeled → **"Add to Dataset"** button
  - Auto split: same train/val/test ratios as the reference release
  - No separate Dataset section
  - Shows result: "X train / Y val / Z test"
- **"Create Release"** button appears after split is complete
  - Click → calls `POST /retraining/{project_id}/create-release`
  - Backend auto-copies all transformation config from reference release
  - No transformation UI shown to operator
  - No release history shown in Retraining Mode

### Step 3: Training (RetrainingTraining.jsx)
- Only input: **Training Name** (text field)
- Model selection: two options only
  - Full pretrained model (YOLO default)
  - best.pt from the project's Model page (if developer added one)
- All other parameters copied from reference training session automatically
- **"Start Training"** button
- Live training status shown (reuse existing training status UI)

### Step 4: Results (RetrainingResults.jsx)
- After training completes:
  - Show simple training summary (final mAP, loss — no deep analysis)
  - Validation runs automatically (shown as simple metrics)
  - Operator runs **Prediction** on selected images to visually verify
  - Prediction image viewer shown (simplified — no advanced analytics, no comparison engine)
- Two action buttons:
  - **"Assign to Production"** → calls `POST /retraining/{project_id}/assign-production`
  - **"Download Model"** → downloads best.pt

---

## "Assign to Production" — Where It Appears

1. In Retraining Mode → Results page after training completes
2. In Full Mode → Model Lab → experiment Overview tab → **"Assign to Production"** button
   - Developer can assign any training experiment from any project as the retraining reference

---

## What Full Mode Developer Sees

After a user retrains in Retraining Mode:
- The new release appears in the project's Release History (same `releases` table)
- The new training session appears in Model Lab (same `training_sessions` table)
- All new labels and images visible in management, dataset, annotation progress
- Everything is identical to a training session created in Full Mode
- Developer can assign any of these as the new production reference

---

## What Is Reused (No Duplication)

| Feature | Reused From |
|---|---|
| Upload UI | Existing UploadSection |
| Manual Labeling canvas | Existing labeling UI |
| Training status / live metrics | Existing training status UI |
| Prediction image viewer | Existing prediction viewer (simplified) |
| DB tables | All existing tables unchanged |
| File storage | Same project folder structure |

---

## UI Color Note

All Retraining Mode UI elements must use the **same color scheme** as the existing app — consistent with current setup/config button colors. No new color palette introduced.

---

## Implementation Order

1. **DB migration** — add `retraining_references` table
2. **Backend** — `retraining.py` routes (all 5 endpoints)
3. **AppModeContext** — global mode state + toggle in nav bar
4. **RetrainingProjects** — filtered project list
5. **RetrainingLabeling** — New/Old tabs + annotation progress + Create Release
6. **RetrainingTraining** — name input + start + live status
7. **RetrainingResults** — prediction view + Assign to Production + Download
8. **Full Mode addition** — "Assign to Production" button in Model Lab Overview tab

---

## Open Questions (Decide During Implementation)

- Auto split ratios: use exact same counts as reference release, or same percentages?
- Prediction images in results: from val/test split, or operator uploads new images, or both? — decide during implementation

## Decided

- If no reference assigned for a project in Retraining Mode → show message:
  **"No production reference set for this project. Please contact your developer."**
  Project is visible in the list but locked — operator cannot proceed until developer assigns a reference in Full Mode.

---

## Implementation Progress (as of 2026-04-22)

### What changed from the original plan

#### `upload_source` column added (not in original plan)
- `datasets.upload_source = 'user_retraining'` when uploaded via Retraining Mode
- NULL for all Full Mode data — no existing data disturbed
- This is what isolates New Images in the Labeling tab — NOT split_type
- Without this, Full Mode batches in `annotating` stage would appear in the New Images tab

#### Upload folder routing (decided during implementation)
- Retraining Mode uploads skip `unassigned/` entirely
- Images go directly to `annotating/` folder on disk
- `image.split_type = 'annotating'` set immediately in DB
- This means operator never has to deal with "Unassigned" concept

#### RetrainingLabeling tab filtering (decided during implementation)
- New Images tab: `dataset.upload_source === 'user_retraining'`
- Old Images tab: `dataset.split_type === 'dataset'` (already labeled + split in past sessions)
- NOTE: `split_type` on datasets API response is DERIVED from the first image's split_type — datasets table has no stage column

### Phase completion status
- ✅ Phase 1 — DB migration (`retraining_references` table)
- ✅ Phase 2 — AppModeContext + nav toggle
- ✅ Phase 3 — RetrainingProjects page
- ✅ Phase 7 — "Assign to Production" + "Unassign" in Full Mode Model Lab Overview
- ✅ Phase 4 (partial) — RetrainingWorkspace + Upload step + RetrainingLabeling premium image grid
- ⏳ Phase 4 (remaining) — split ratio decision + Create Release step
- ⏳ Phase 5 — RetrainingTraining
- ⏳ Phase 6 — RetrainingResults
- ⏳ Phase 8 — Guide Bot update

---

## RetrainingLabeling UI Redesign (completed 2026-04-22)

### Problem
Current UI is plain AntD white tabs — functional but not premium or operator-friendly.
Full Mode Annotation Progress page has a much richer look: dark cards, gradient badges, progress bars, visual hierarchy.

### Design direction (operator-focused, not a copy of Full Mode)
The operator needs a **task checklist feel**, not a developer data dump.

Proposed layout:
1. **Stat bar at top** — two bold stat boxes side by side:
   - "New Images: N (X labeled)" in orange if not all labeled, green when done
   - "Old Images: N (all labeled)" in green
2. **Each dataset as a card** (white card, subtle shadow):
   - Colored left border: orange = needs labeling, green = fully labeled
   - Card header: dataset name + "X / Y labeled" tag + progress bar
   - "Label Batch" button on the card header right side — gradient purple, prominent
   - Image thumbnails in a grid inside the card
3. **Background**: very light gray `#f7f8fa` instead of pure white
4. **Tabs remain**: "New Images" and "Old Images" — same structure, cards inside each tab
5. **Next button**: stays at bottom, same gating logic (all new images must be labeled)

### What stays the same
- Click image or "Label Batch" → `/annotate/:datasetId/manual` — no change
- Next button gated on `allNewImages.every(img => img.is_labeled)` — no change
- API calls — no change

### Status
Completed in `frontend/src/components/retraining/RetrainingLabeling.jsx`.
Verified with `npm run build` in `frontend/`; build passed with existing warnings.
