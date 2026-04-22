# Current TODO

## Active Branch
feature/professional-logging-system

## Current Feature: User Retraining Mode

### Phase Status
1. ✅ DB migration — `retraining_references` table — `131c802`
2. ✅ Backend `retraining.py` — 5 endpoints + unassign DELETE — `09c387a`, `cd60d2f`
3. ✅ AppModeContext + nav bar mode toggle — `f93200a`, `b2b2267`, `34503a8`
4. ✅ RetrainingProjects page (locked/ready cards) — `7971554`, `3ff2971`
5. ✅ Retraining Mode hides Dashboard + Models, redirects to Projects — `fd78415`
6. ✅ Full Mode: Assign to Production + Unassign buttons in Model Lab Overview — `269b9fd`, `cd60d2f`
7. ✅ isProduction check fixed (500 error: wrong Release column names) — `5b9bc65`, `9bcaddc`

### Phase 4 — In Progress
- [x] RetrainingWorkspace — premium step layout (Upload | Label | Release | Train | Results)
- [x] RetrainingLabeling — New Images / Old Images tabs, label counts, Next gated on all-labeled
- [x] Upload step — UploadSection reused with `operatorMode={true}` hiding developer tools
- [x] `upload_source` column added to datasets table — isolates Retraining Mode uploads from Full Mode batches
- [x] Images correctly saved to `annotating/` folder (not `unassigned/`) when upload_source=user_retraining
- [x] debug_database.py updated with `--retraining-refs` and `--retraining` flags
- [x] RetrainingLabeling UI redesign — premium stat bar, dataset cards, progress bars, colored borders
- [ ] NEXT: Task 4.0: Decide split ratio strategy for create-release (auto-copy from reference vs operator slider)
- [ ] Task 4.4: Create Release (auto) — calls `POST /retraining/{project_id}/create-release`, no config UI shown

### Upcoming Phases
- [ ] Phase 5: RetrainingTraining — name input, model select, start, live status
- [ ] Phase 6: RetrainingResults — prediction view, Assign to Production, Download
- [ ] Phase 8: Guide Bot update for Retraining Mode
- [ ] DEFERRED after Retraining Mode: large dataset backend pagination for Full Mode + Retraining Mode — see `docs/LARGE_DATASET_PAGINATION_PLAN.md`

## Completed This Branch
- [x] Professional logging system (frontend + backend)
- [x] Guide Bot — all sections: Upload, Management, Annotation, Dataset, Analytics, Release, Project Models, Training, Model Lab
- [x] Full Project Export / Import feature
- [x] Tile transformation — splits large images into N×M grid for YOLO training
- [x] Tile + augmentation variants generate correctly per tile
- [x] Flip variants split (Horizontal / Vertical / Both as separate outputs)
- [x] Rotation annotation alignment for expanded canvas
- [x] Affine transform + perspective warp hidden from release UI (unsafe)
- [x] Label case-variant normalization (SCRATCH vs scratch deduplication)
- [x] Global AI Models page rename
- [x] App logo assets added
- [x] User Retraining Mode — Phases 1-3 + Phase 7 complete (see above)
