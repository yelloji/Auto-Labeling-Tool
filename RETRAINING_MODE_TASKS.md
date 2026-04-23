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

### Task 4.0 — Auto Dataset Split Design (DECIDED — ready to code)

**Decision: auto-split silently, zero operator input. No "Add Dataset" button shown.**

#### Split ratio calculation
- Reference release `config` stores `split_counts: { train: N, val: N, test: N }` (augmented counts)
- Calculate ratio from those counts:
  - `total = train + val + test`
  - `train_ratio = train / total`, `val_ratio = val / total`, `test_ratio = test / total`
- Apply ratio to new image count → get new train/val/test counts for random split

#### Auto-split trigger (backend call from frontend)
- Triggered automatically when user returns to Label UI from manual labeling
- Conditions that must ALL be true to run auto-split:
  1. All new images (`upload_source = 'user_retraining'`) are labeled (is_labeled = True)
  2. Those images are still in `annotating` stage (split_type = 'annotating')
- If images already in `dataset` stage → skip auto-split, keep existing assignment
- If not all labeled → skip auto-split, do nothing

#### What auto-split does (same as "Add Dataset" button in Full Mode)
1. Assigns `split_section = train / val / test` randomly per image using calculated ratio
2. Moves images from `annotating` → `dataset` (sets split_type = 'dataset')
3. Moves files on filesystem from `annotating/` folder → `dataset/` folder
4. Updates DB records for all affected images

#### Edge cases (all accepted behavior)
- User edits labels after split → images stay in dataset, split stays untouched ✅
- Developer in Full Mode moves images back to annotating → user returns to Retraining Mode → all labeled → auto-split runs again, reassigns randomly (overrides any manual per-image split) ✅
- Developer manually changes per-image split in Full Mode while images are in dataset → safe, auto-split never runs on dataset images ✅
- Only images with `upload_source = 'user_retraining'` are ever auto-split ✅

#### "Next: Release" button lock condition
- Locked unless ALL of:
  1. All new images (`upload_source = 'user_retraining'`) are labeled
  2. All new images are in `dataset` stage (split_type = 'dataset')
- Button just navigates to Release step — does NOT create the release
- Release creation happens inside the Release step itself

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
  - `New Images` — filtered by `upload_source === 'user_retraining'` (correct isolation)
  - `Old Images` — filtered by `split_type === 'dataset'` (already labeled and split)
- [x] Image thumbnails shown in grid per dataset (fetched via `GET /api/v1/datasets/{id}/images`)
- [x] Labeled count per dataset shown as Tag
- [x] Green badge overlay on labeled images, `is_labeled` field used
- [x] "Label Batch" button per dataset → navigates to `/annotate/:datasetId/manual`
- [x] Clicking any image also opens the same manual labeling view
- [x] Next button disabled until all New Images are labeled, using full dataset totals
- [x] UI redesign complete: card-based premium operator layout
  - Added top stat bar for New Images and Old Images
  - Added card-per-dataset design with colored left borders, progress bars, and clear status tags
  - Kept existing filtering, image grid, manual labeling navigation, and Next gating logic unchanged
- [x] CURRENT FIX complete: per-dataset/batch image pagination in RetrainingLabeling
  - Removed current `limit=200` display risk for New Images and Old Images
  - No project, dataset, or batch image limit in UI logic
  - Each dataset/batch stays separate
  - Each selected dataset/batch shows 50 images per page
  - All images in that dataset/batch are reachable through page numbers / next-prev
  - Annotation overlays load only for the currently visible 50 cards
- [x] Dataset-name sub-tabs inside New Images / Old Images — `d8170a9`
  - Multiple datasets → sub-tabs by name with labeled/total tag per tab
  - Single dataset → no sub-tabs, grid shown directly (no change)
- [x] Annotations included in images API response — `d6ed54a`
  - `include_annotations=true` param added to `GET /datasets/{id}/images`
  - Batch loads all annotations in one query — eliminates 50 separate per-card fetches
  - Image + overlay render together on first paint
  - Full Mode callers unaffected (param defaults to false)
- [x] Stat cards made clickable as tab selectors — `67ae60a`
  - Clicking New Images or Previous Training Images card switches the grid below
  - Small AntD tab bar removed — cards ARE the navigation
  - Active card: gradient bg, stronger border, glow shadow, lift, bottom strip, icon glow
  - "Old Images" renamed to "Previous Training Images"
- [x] Bulk upload path bug fixed — `22a23d5`
  - All upload options (Select Folder, Video frames) now save relative path from the start
  - Previously saved absolute Windows path (V:\...) — broken on any other PC
  - Fix: `path_manager.get_relative_image_path()` used in bulk upload same as single upload
  - Single upload, Select Folder (images+labels) were already correct — only bulk was broken
- [x] Clicking image in labeling grid opens annotator at correct image position — `f244586`
  - `openLabeling(datasetId, img.id)` passes imageId — navigates with `?imageId=...`
  - Previously always opened from image 1 regardless of which image was clicked
- [x] Back button from manual labeling returns to Retraining Label step — `f9f8d49`
  - RetrainingLabeling passes `state: { returnTo: /retraining/${projectId}?step=1 }`
  - RetrainingWorkspace reads `?step` from URL to initialize at correct step
  - ManualLabeling reads `location.state?.returnTo` — falls back to Full Mode behavior if not set
  - Full Mode back button behavior completely unchanged
- [ ] DEFERRED backend scalability task: real backend pagination for very large datasets
  - Track shared Full Mode + Retraining Mode work in `docs/LARGE_DATASET_PAGINATION_PLAN.md`

### Task 4.0 — Auto Dataset Split
- [x] Backend: `POST /retraining/{project_id}/auto-split` — `79f234b`
  - Calculates ratio from reference release train/val/test_image_count
  - Falls back to 70/20/10 if reference has no images
  - Collects all annotating images from user_retraining datasets
  - Skips if not all labeled, or already in dataset stage
  - Shuffles, assigns split_section by ratio, copies files to dataset/{name}/{split}/
  - Updates split_type='dataset', split_section, file_path in DB
  - Removes annotating folder after successful move
- [x] Frontend: loadAll in RetrainingLabeling triggers auto-split automatically — `79f234b`
  - Checks: newDs with some not-yet-split AND all labeled
  - Calls POST /retraining/{projectId}/auto-split silently
  - Re-fetches datasets if split_done=true → allNewSplit becomes true → Next unlocks

### Task 4.4 — Create Release (auto)

#### Architecture decisions (finalised)
- `release_source = 'user_retraining'` column added to releases table — same pattern as upload_source on datasets
- Operator input: release NAME only — all else (transformations, format, task_type, multiplier) auto-copied from reference release
- One active user_retraining release per project — on new creation, old unprotected user_retraining release is deleted (DB + ZIP file)
- Production-protected exception: if a user_retraining release is currently pointed to by `retraining_references.release_id` → it is NOT deleted → stays until production is reassigned
- Frontend calls two endpoints in sequence: `POST /retraining/{project_id}/create-release` → returns cleanup + full payload → then `POST /releases/create` with that payload
- No download popup after creation — download available from history card
- Release history shows only `release_source === 'user_retraining'` releases (max 1 visible normally, max 2 in production-protected edge case)
- Click release card → opens same ReleaseDetailsView as Full Mode (no changes to that component)
- Training step UI lock → user cannot reach Release step during training → no need to guard in this step
- Delete old release BEFORE creating new one is acceptable — user just re-enters name if creation fails

#### Backend changes
- [ ] DB migration: `ALTER TABLE releases ADD COLUMN release_source VARCHAR(50)` in database.py init_db
- [ ] models.py: `release_source = Column(String(50), nullable=True)` on Release class
- [ ] releases.py: add `release_source: Optional[str] = None` to ReleaseCreate; save to Release object in create_release handler; include in get_project_releases response
- [ ] retraining.py: rewrite `create-release` endpoint:
  - Body: `{name: str}`
  - Get reference release config (transformations, format, task_type, multiplier, output_format)
  - Get ALL dataset IDs for this project
  - Find + delete old unprotected user_retraining releases (DB + ZIP file on disk)
  - Return: full ReleaseCreate payload with `release_source='user_retraining'` + `dataset_ids`

#### Frontend
- [ ] Create `frontend/src/components/retraining/RetrainingRelease.jsx`:
  - Load `GET /retraining/{projectId}/reference` for preview (format, task_type, transformations)
  - Load `GET /projects/{projectId}/releases` filtered by `release_source === 'user_retraining'` for history
  - Name input field (default: auto-name with date e.g. `retraining-2026-04-23`)
  - Config preview card: format, task_type, transformations list (read-only)
  - Image count summary (from current datasets)
  - "Create Release" button → spinner + locked during:
    1. `POST /retraining/{projectId}/create-release` → get dataset_ids + payload
    2. `POST /releases/create` with payload
  - On success: reload release history → card appears → Next: Training unlocks
  - No download popup
  - Release history: custom filtered list (same card style as Full Mode)
  - Click release card → open ReleaseDetailsView (reuse as-is)
  - Download button on history card
- [ ] RetrainingWorkspace case 2: replace placeholder with `<RetrainingRelease projectId={projectId} onNext={nextStep} />`

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
- 2026-04-22 Phase 4 partial — Tasks 4.1, 4.2, 4.3 complete — commits below
  - `9bea6f0` feat(retraining): add RetrainingWorkspace with Upload and Labeling steps
  - `2c075e5` fix(retraining): match ProjectWorkspace layout
  - `57f0474` fix(retraining): fix undefined AntLayout
  - `d52b01d` fix(retraining): add workspace-sider class and CSS
  - `d8eb202` feat(retraining): premium step layout sticky nav, dot progress, glow steps
  - `b7ba9d7` feat(retraining): hide developer upload options via operatorMode prop
  - `15e298a` feat(retraining): add upload_source column to datasets table
  - `d662fa5` feat(debug): add retraining_references and upload_source to debug_database.py
  - `26dd554` fix(retraining): save uploads to annotating/ folder when upload_source=user_retraining
- 2026-04-22 Phase 4 update — RetrainingLabeling UI redesign complete; Task 4.0 (split ratio decision) + Task 4.4 (Create Release auto) still pending

## Critical Technical Facts (for any Claude session picking this up)

### upload_source column — how it works
- `datasets.upload_source` = `'user_retraining'` when uploaded via Retraining Mode
- NULL for all Full Mode uploads — no existing data disturbed
- Migration in `backend/database/database.py` init_db block (ALTER TABLE IF NOT EXISTS pattern)
- Model in `backend/database/models.py` — `Dataset.upload_source = Column(String(50), nullable=True)`
- `create_dataset()` in `operations.py` accepts and saves `upload_source` param
- Both upload endpoints in `projects.py` accept `upload_source: str = Form(None)` and pass it through

### Upload folder routing — why it matters
- When `upload_source == 'user_retraining'`, images MUST go to `annotating/` folder, NOT `unassigned/`
- This is because in Retraining Mode there is no "Unassigned" step — images skip straight to annotating
- Code in `projects.py` both single and bulk upload: compute `workflow_stage` from upload_source before path creation
- `image_record.split_type = 'annotating'` set after image creation when upload_source == 'user_retraining'

### RetrainingLabeling filtering logic
- New Images tab: `d.upload_source === 'user_retraining'`
- Old Images tab: `d.split_type === 'dataset'`
- `split_type` on DATASETS is DERIVED from first image's split_type — returned in `GET /projects/{id}/datasets` response
- `split_type` on IMAGES is actual workflow stage: `unassigned | annotating | dataset`
- `split_section` on images is train/val/test split assignment (different concept)
- DATASETS table has NO stage column — this is a common confusion point

### Datasets API response
- `GET /api/v1/projects/{projectId}/datasets` returns upload_source per dataset
- `GET /api/v1/datasets/{datasetId}/images?skip={offset}&limit=50` returns current image page with `is_labeled`, `thumbnail_url`, and total count

### Next immediate step
- Finish Task 4.3 UI improvement: dynamic dataset-name tabs inside New Images / Old Images
- Then Task 4.0: decide split ratio strategy for auto create-release
- Then Task 4.4: implement Create Release auto step in RetrainingWorkspace

### Large Dataset Pagination Rule
- Showing 50 images per page is a UX rule, not a data-size limit.
- Retraining Mode and Full Mode must support datasets with 10,000 to 50,000+ images.
- Current/near-term UI should render only visible page cards.
- Future backend pagination work must cover both Retraining Mode and Full Mode safely.
- Shared follow-up plan: `docs/LARGE_DATASET_PAGINATION_PLAN.md`
