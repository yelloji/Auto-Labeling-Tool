# Inspection Runtime Reconstruction — Implementation Tasks

## Document Status

- Feature: Inspection Runtime — Brake-disc reconstruction
- Current phase: Planning
- Current task: Task 2 — Dataset audit (`APPROVED`)
- Code changes started: No
- Database changes started: No
- Inference changes started: No
- Task 2 completion approval: Pending

## Purpose

Add an Inspection Runtime mode to Gevis AI Studio, beginning with a scientifically faithful reconstruction of one brake disc from 16 ordered high-resolution acquisitions.

This work must extend the existing React, FastAPI, SQLite, Electron, project-storage, logging, and test patterns. It must not create a separate application or duplicate the existing normal/SAHI inference system.

## Working Agreement

1. Work on one task at a time.
2. Explain the intended change, reason, risks, and affected files before editing.
3. Do not change code, files, dependencies, configuration, or database outside the approved task.
4. Preserve existing user work and unrelated changes.
5. When a task is implemented and locally verified, mark it `READY FOR USER REVIEW` and stop.
6. Report the exact changed files and verification results to the user.
7. The user tests or reviews the task.
8. Only after user approval, mark the task `APPROVED` in this document and commit it.
9. Never commit without explicit user confirmation.
10. Use one focused commit per approved task where practical.
11. Never add a co-author line to commits.
12. Do not use emojis in code, documentation, commits, or responses.
13. Database tests must use a real test database, never a mocked database.
14. Prediction device selection remains automatic; no device selector will be added.

## Status Definitions

- `PLANNED`: Defined but not started.
- `IN PROGRESS`: Approved task currently being implemented.
- `READY FOR USER REVIEW`: Implementation and local checks completed; waiting for the user.
- `APPROVED`: User confirmed the result; task may be committed.
- `COMMITTED`: Approved task committed with its commit hash recorded.
- `BLOCKED`: Cannot continue safely; blocker and required decision documented.
- `DEFERRED`: Intentionally outside the current milestone.

## Confirmed Acquisition Contract

- Physical brake-disc diameter: not yet confirmed and not required for the initial pixel reconstruction. It will be added later for millimetre-scale measurement and reporting.
- Number of acquisitions per disc: 16.
- Fixed acquisition reference: image 1 at 0 degrees.
- Rotation step: exactly 22.5 degrees.
- Acquisition direction: sequential in image-number order; final clockwise/counterclockwise sign must be verified against the data.
- Capture angles are acquisition centre positions:

| Image | Angle | Image | Angle |
|---:|---:|---:|---:|
| 1 | 0.0° | 9 | 180.0° |
| 2 | 22.5° | 10 | 202.5° |
| 3 | 45.0° | 11 | 225.0° |
| 4 | 67.5° | 12 | 247.5° |
| 5 | 90.0° | 13 | 270.0° |
| 6 | 112.5° | 14 | 292.5° |
| 7 | 135.0° | 15 | 315.0° |
| 8 | 157.5° | 16 | 337.5° |

## Source Data

- Reconstruction dataset: `V:\NEW-DISC\image-reconstruction-app\images\10%`
- Full-disc geometry reference: `V:\NEW-DISC\image-reconstruction-app\full-disk.jpeg`
- Source images are read-only test inputs. They must not be renamed, overwritten, recompressed, or moved.
- Large binary test images will not be copied into the application repository without separate approval.

## Initial Milestone Scope

The first milestone includes only:

1. Import and validate 16 ordered frames.
2. Store the acquisition order and known angles.
3. Calibrate the close-up camera view to the disc coordinate system.
4. Transform the frames into their correct circular positions.
5. Refine neighboring alignment using drilled holes and measured surface texture.
6. Composite the valid measured regions without missing or duplicated disc areas.
7. Validate all neighboring joins and the image 16 to image 1 closure.
8. Save the reconstruction, transformations, coverage map, preview, and validation report.
9. Integrate the approved reconstruction workflow into Inspection Runtime.

## Explicitly Deferred

- Normal inference integration
- SAHI inference integration
- PyTorch-to-ONNX conversion
- C++ inference
- Prediction projection onto the reconstructed disc
- Automatic C++ acquisition control
- Continuous production-folder monitoring
- Production reports beyond the reconstruction validation report

The existing normal and SAHI implementations remain untouched. Later runtime inference will reuse them through a thin adapter.

## Required Reconstruction Outputs

Each successful inspection must produce:

```text
reconstructed_disc.tiff
reconstructed_preview.png
transforms.json
coverage_map.png
reconstruction_report.json
```

`transforms.json` is a permanent contract. It must contain sufficient information to map points, boxes, polygons, and segmentation masks from every source image into the reconstructed disc later.

## Planned Runtime Storage

All runtime data paths must be relative to `settings.BASE_DIR`.

```text
projects/{project_name}/inspections/{inspection_id}/
├── input/
├── manifests/
├── calibration/
├── reconstruction/
├── reports/
└── logs/
```

Development data resolves beneath the repository root. Installed application data resolves beneath `AppData\Local\Gevis AI Studio` through the existing `GEVIS_EXE_MODE` behavior.

## Planned Code Boundaries

```text
backend/
├── api/routes/inspection_runtime.py
└── inspection_runtime/
    ├── ingestion/
    ├── reconstruction/
    ├── orchestration/
    ├── storage/
    └── schemas/

frontend/src/components/inspection-runtime/
├── InspectionProjects/
├── InspectionWorkspace/
├── InputFrames/
├── Reconstruction/
├── Validation/
└── Export/
```

These are planned boundaries, not permission to create all folders at once. Each folder is created only when its approved task needs it.

## Quality Principles

- Known 22.5-degree positions provide nominal placement; they do not replace calibration.
- Hole and texture matching may apply only measured, bounded fine corrections.
- Original frames remain immutable.
- Hard seams must not delete, duplicate, or invent measured surface information.
- Reconstruction pixels and later AI predictions remain separate data layers.
- Every output pixel inside the valid annulus must have traceable source-frame provenance.
- Validation failure must be visible; the system must not silently label a poor reconstruction successful.
- All long-running reconstruction work must run outside the FastAPI request thread.

## Task Plan

### Task 1 — Establish the Safe Feature Baseline

Status: `APPROVED FOR COMMIT`

Work:

- Confirm active branch and working-tree state.
- Identify overlap with unfinished User Retraining Mode work.
- Agree on the feature branch strategy before any branch operation.
- Record the exact existing files that Inspection Runtime may eventually touch.
- Confirm development and EXE path behavior.

Acceptance:

- No user changes are overwritten.
- Branch strategy is explicitly approved.
- Baseline build/test commands are recorded.
- No application behavior changes.

Baseline findings recorded on 2026-07-21:

- Active branch: `feature/professional-logging-system`.
- Baseline HEAD: `9cff0da chore(db): update database backup and exports`.
- The current worktree is not clean. It contains existing modified exports, configuration/memory files, and many untracked backups, logs, datasets, models, runs, documents, and reconstruction assets.
- No existing dirty file may be staged, removed, renamed, reset, or included in an Inspection Runtime commit.
- The current branch also contains unfinished User Retraining Mode work.
- Future Inspection Runtime work will overlap with `frontend/src/context/AppModeContext.jsx`, `frontend/src/components/Navbar.js`, `frontend/src/App.js`, `frontend/src/pages/Projects.js`, `backend/main.py`, and the database initialization/model files.
- Development data resolves through `settings.BASE_DIR` to the repository root.
- Installed-EXE data resolves through `GEVIS_EXE_MODE=1` to `AppData\Local\Gevis AI Studio`.
- Backend code is packaged as an Electron `extraResource`; user data must never be written beneath the packaged backend directory.
- User-identified local planning, debug, backup, dataset, model-run, cache, and reconstruction-reference artifacts were added to `.gitignore` with path-specific rules. No artifact was deleted.

Approved branch strategy:

- Use the existing AI Studio application folder.
- Create the dedicated local branch `feature/inspection-runtime` from baseline commit `9cff0da`.
- Do not create a second application folder or Git worktree.
- Preserve all pre-existing modified and untracked files carried into the new branch.
- Reference the 16 source frames from their current read-only dataset path rather than copying them into Git.
- Stage and commit only explicitly approved Inspection Runtime files.
- Do not push the branch to GitHub without explicit user instruction.

Branch result:

- Current branch is now `feature/inspection-runtime`.
- No commit was created.
- No existing application file or database was changed by the branch operation.

Recorded baseline verification commands:

```text
python -m pytest test-suites/backend test-suites/database
python -m pytest test-suites/ui
npm test -- --watchAll=false
npm run build
npm run electron:dev
python scripts/build_exe.py
```

Commands will be selected proportionally for each task. Full UI, Electron, or installer checks are reserved for tasks that affect those layers.

### Task 2 — Audit the 16-Frame Reconstruction Dataset

Status: `APPROVED`

Work:

- Read frames in numeric order.
- Record dimensions, formats, channels, and metadata.
- Measure brightness/color variation.
- Analyze overlap between every neighboring pair and the 16-to-1 pair.
- Verify clockwise/counterclockwise sequence.
- Identify stable drilled-hole and texture landmarks.
- Determine whether camera distortion or perspective correction is required.
- Define measurable acceptance thresholds from the real data.

Deliverable:

- Read-only dataset audit report.
- Approved reconstruction geometry and quality thresholds.
- Report: `tasks/INSPECTION_RUNTIME_DATASET_AUDIT.md`

Audit result recorded on 2026-07-21:

- Exactly 16 unique RGB JPEG frames were found in numeric order, all 6560 x 4948 pixels.
- The `10%` folder name denotes JPEG-compressed development copies used for faster trials, not 10 percent overlap or reduced pixel dimensions; production acceptance must be repeated with original-quality acquisitions.
- The sequence is continuous and uses one consistent negative rotation sign in top-left-origin image coordinates.
- Constrained apparent increments span 20.8-24.4 degrees and total 357.9 degrees before final camera calibration.
- All neighbor boundaries, including `16 -> 1`, contain usable constrained overlap; measured pre-calibration valid-field overlap spans approximately 9.4-20.6 percent.
- A single fixed camera-to-disc calibration and source-validity mask are required. Independent free-form homographies are not approved.
- Lens-distortion or projective correction may be added only if Task 4 demonstrates systematic residual reduction from one reusable calibration model.
- Initial measurable integrity, geometry, coverage, seam, sharpness, and provenance gates are defined in the audit report.
- No source image, application code, database, dependency, or configuration was changed.

Acceptance:

- All 16 frames accounted for exactly once.
- Sequence direction supported by image evidence.
- Required calibration inputs identified.
- No source image modified.

### Task 3 — Define Reconstruction Data Contracts

Status: `PLANNED`

Work:

- Define acquisition manifest schema.
- Define calibration schema.
- Define per-frame transform schema.
- Define reconstruction-report schema.
- Define error codes and validation states.
- Define output coordinate conventions and angle sign.

Acceptance:

- Schemas support future point, box, polygon, and mask projection.
- All angles, units, coordinate origins, and transform direction are unambiguous.
- Schema fixtures validate successfully.

### Task 4 — Implement Calibration Core

Status: `PLANNED`

Work:

- Establish disc centre, inner/outer radii, scale, reference ray, and usable source ROI.
- Implement camera/perspective correction only if Task 2 proves it necessary.
- Provide deterministic serialization of calibration parameters.
- Produce diagnostic overlays.

Acceptance:

- Calibration reload reproduces the same mapping.
- Disc edges and stable hole landmarks align within the Task 2 threshold.
- Invalid calibration is rejected with a clear reason.

### Task 5 — Implement Nominal Circular Placement

Status: `PLANNED`

Work:

- Map each calibrated frame into disc coordinates.
- Place image 1 at 0 degrees.
- Place images 2 through 16 at 22.5-degree increments.
- Apply valid-annulus and source-ROI masks.
- Record a transform for each frame.

Acceptance:

- All frame centres occupy their commanded angles.
- The placement is deterministic.
- No frame is omitted or used twice.
- Transform round-trip tests pass within the approved numerical tolerance.

### Task 6 — Implement Fine Registration

Status: `PLANNED`

Work:

- Match neighboring drilled holes and surface texture.
- Restrict corrections to approved physical bounds.
- Calculate registration confidence and residuals.
- Handle low-confidence matches without silently forcing alignment.
- Verify the image 16-to-image 1 closure.

Acceptance:

- Hole patterns remain physically consistent.
- Corrections remain within approved bounds.
- Every neighbor pair has recorded residual and confidence values.
- Closure passes the Task 2 threshold or the run is marked failed.

### Task 7 — Implement Seam-Safe Compositing

Status: `PLANNED`

Work:

- Generate source-validity and overlap masks.
- Select a blending method using measured comparisons.
- Preserve high-frequency crack and scratch information.
- Generate a per-pixel source/provenance map.

Acceptance:

- No uncovered pixels exist inside the approved valid reconstruction region.
- No hole is visibly duplicated or cut at a seam.
- Surface detail is not visibly blurred beyond the approved threshold.
- Compositing is repeatable from the same inputs and calibration.

### Task 8 — Implement Reconstruction Validation and Artifacts

Status: `PLANNED`

Work:

- Calculate coverage and overlap statistics.
- Validate hole continuity, neighbor residuals, and loop closure.
- Generate the coverage map and reconstruction report.
- Export full-resolution TIFF and PNG preview.
- Save all transforms and provenance.

Acceptance:

- All five required outputs are generated.
- Report clearly states pass or fail and why.
- Outputs reopen successfully and retain expected dimensions.
- Failed validation cannot be reported as successful.

### Task 9 — Add the Reconstruction Executor

Status: `PLANNED`

Work:

- Run reconstruction in a dedicated subprocess.
- Follow the existing prediction/SAHI executor lifecycle pattern.
- Persist status, progress, logs, completion time, and errors.
- Support safe cancellation and recovery from an interrupted process.

Acceptance:

- FastAPI remains responsive during reconstruction.
- Process status survives frontend refresh.
- Failure logs contain a meaningful cause.
- No broad or unsafe path deletion is possible.

### Task 10 — Add Minimal Inspection Database Support

Status: `PLANNED`

Work:

- Add only the approved minimum inspection-run and frame records.
- Link inspections to existing projects.
- Store relative paths and immutable acquisition metadata.
- Add guarded, additive migration logic following existing project conventions.
- Back up and test against a real test database.

Acceptance:

- Existing database opens without data loss.
- Migration is repeatable and safe when tables already exist.
- Project deletion behavior is explicitly tested.
- Real-database integration tests pass.

### Task 11 — Add Inspection Runtime Backend API

Status: `PLANNED`

Work:

- Create, list, and retrieve inspection runs.
- Upload/associate the 16 ordered frames.
- Validate completeness before reconstruction.
- Start reconstruction and expose status/artifacts.
- Apply existing logging, response, and path-security patterns.

Acceptance:

- Invalid order, duplicates, missing frames, and unsafe paths are rejected.
- API tests use the real test database.
- Existing APIs remain unchanged.

### Task 12 — Add the Third Global Mode

Status: `PLANNED`

Work:

- Add `Inspection Runtime` to the existing application mode context.
- Replace binary toggling with explicit three-mode selection.
- Add mode-specific navigation and route guards.
- Preserve Full Mode and User Retraining Mode behavior.

Acceptance:

- All three modes persist correctly across refresh.
- Switching remains locked inside protected workflows.
- Existing two modes pass regression checks.

### Task 13 — Add Inspection Project Selection and Workspace Shell

Status: `PLANNED`

Work:

- Add the Inspection Runtime project view.
- Add a full-screen workspace following the established specialized-mode pattern.
- Add reconstruction-only steps: Input, Calibrate, Reconstruct, Validate, Export.
- Do not expose inference controls.

Acceptance:

- Existing projects are reused without modifying training datasets.
- Navigation and back behavior are consistent with the application.
- No inference code or controls are added.

### Task 14 — Add Input and Reconstruction UI

Status: `PLANNED`

Work:

- Import exactly 16 numbered frames.
- Show angle, filename, readiness, and validation for each frame.
- Start reconstruction and show persistent progress.
- Display actionable errors.

Acceptance:

- Users can identify missing, duplicate, or incorrectly ordered frames before running.
- Refresh does not lose the active run state.
- UI does not block during reconstruction.

### Task 15 — Add Validation and Export UI

Status: `PLANNED`

Work:

- Display reconstructed disc, coverage map, seam diagnostics, and validation summary.
- Allow comparison with source frames and hole landmarks.
- Download required artifacts through safe backend endpoints.

Acceptance:

- The user can independently judge whether reconstruction passed.
- Full-resolution download does not pass image data through an HTML canvas.
- Failed runs remain inspectable and are not presented as approved results.

### Task 16 — Complete Regression and Windows Packaging Checks

Status: `PLANNED`

Work:

- Run focused backend, database, and frontend tests.
- Run existing relevant regression tests.
- Build the React frontend.
- Verify Electron development behavior.
- Verify installed-EXE path assumptions and required Python packages.
- Update EXE change documentation according to repository rules.

Acceptance:

- Existing Full Mode and User Retraining Mode remain functional.
- Inspection outputs are written to the correct dev/EXE data locations.
- Production build completes.
- No runtime dependency is missing from packaged setup.

### Task 17 — Final Reconstruction Acceptance

Status: `PLANNED`

Work:

- Run the approved 16-frame dataset end to end.
- Review all 16 neighbor joins and final loop closure.
- Confirm outputs against the approved measurable thresholds.
- Record limitations and calibration instructions.

Acceptance:

- User explicitly approves the reconstructed disc.
- Required artifacts and validation report are complete.
- Reconstruction milestone is marked complete only after user approval.

## Deferred Future Tasks

Status: `DEFERRED`

- Reuse normal inference in Inspection Runtime.
- Reuse SAHI inference in Inspection Runtime.
- Select production models automatically.
- Project detections and segmentation masks through saved transforms.
- Merge duplicate predictions from overlapping frames.
- Add watched-folder and C++ acquisition connectors.
- Add production inspection reports and runtime analytics.

## Task History

| Date | Task | Status | Verification | User Approval | Commit |
|---|---|---|---|---|---|
| 2026-07-21 | Planning document | READY FOR USER REVIEW | Documentation review pending | Pending | Not committed |
| 2026-07-21 | Task 1 — Safe feature baseline | APPROVED FOR COMMIT | Local branch created; baseline audited; local-only artifacts verified ignored | Approved | Task 1 baseline commit |
| 2026-07-21 | Task 2 — Dataset audit | APPROVED | 16-frame inventory, integrity, photometric, neighbor, direction, closure, calibration, and threshold audit completed | Approved | Pending focused commit |
