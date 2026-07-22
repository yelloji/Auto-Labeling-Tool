# Brake Disc Production Application - Implementation Tasks

## Document Status

- State: `APPROVED`
- Date: 2026-07-22
- Scope: Architecture and task planning only
- Application code started: No
- Database started: No
- New repository created: No
- Commit created: No

## Product Decision

Create a new, independent brake-disc production application. Do not add a general Inspection Runtime mode to Gevis AI Studio.

The responsibilities are separated as follows:

```text
Gevis AI Studio
Labeling -> Training -> Validation -> Analytics -> Production Model Export

Brake Disc Production Application
Acquisition Intake -> Reconstruction -> ONNX SAHI -> Review -> Database/Export
```

Gevis AI Studio remains a model-development product. The new application is a production system dedicated to the brake-disc acquisition and inspection process.

## Repository and Folder Decision

The production application must be a new sibling folder and a separate Git repository:

```text
V:\stage-1-labeling-app\
|-- app-3-fix-release-system-422-error\  # Current Gevis AI Studio repository
|   `-- image-reconstruction-app\        # Current read-only reconstruction evidence
`-- brake-disc-production-app\           # New production application and Git repository
```

It must not be created inside:

- the Gevis AI Studio repository;
- `image-reconstruction-app/images`;
- a temporary directory;
- an application-generated data directory.

The current `V:\stage-1-labeling-app\app-3-fix-release-system-422-error\image-reconstruction-app` folder remains reference evidence. It is not the new application repository.

Production data must also remain outside the source repository. Its final installed path will be configurable, for example:

```text
{PRODUCTION_DATA_ROOT}\
|-- pipelines\
|-- models\
|-- incoming\
|-- processing\
|-- completed\
|-- failed\
|-- database\
|-- logs\
`-- temp\
```

No production run may depend on a developer drive path such as `V:\...`.

## Code-Sharing Rule

The applications are independent and must not import Python modules from each other's repository at runtime.

Allowed exchange:

- versioned ONNX model bundles;
- documented JSON schemas;
- exported pipeline packages;
- immutable calibration/reference assets;
- test fixtures and expected results;
- a one-time reviewed port of pure reconstruction algorithms with their tests.

Not allowed:

- adding the AI Studio repository to `PYTHONPATH`;
- reading the AI Studio database from production;
- importing AI Studio backend services directly;
- copying UI, API, database, or training code without review;
- silently maintaining two changing copies of the same algorithm;
- making production depend on AI Studio being installed.

When the proven reconstruction core is moved, each source file must be reviewed for application-specific paths, settings, database imports, logging, and side effects. Only pure contracts and algorithms are ported. The new repository becomes the owner of the production version after acceptance.

## Technology Decision

Initial implementation:

- Language: Python
- Image processing: OpenCV, NumPy, and native image libraries
- Production inference: ONNX Runtime CUDA FP16
- Optional acceleration: ONNX Runtime TensorRT execution provider
- Desktop UI: lightweight Python desktop UI, provisionally PySide6
- Local API/service boundary: internal Python services; optional local API only when needed by online integration
- Local database: SQLite for one production station, behind a repository interface
- Packaging: Windows executable/installer after functional acceptance

Python coordinates the pipeline. Heavy image and inference operations execute in compiled C/C++/CUDA libraries. Custom C++ is introduced only when profiling proves a specific bottleneck and the user approves a bounded accelerator task.

## Operating Modes

### Offline Mode

Used for development, validation, historical data, and manual reprocessing.

```text
Select Folder -> Validate -> Run Saved Pipeline -> Review -> Save/Export
```

### Online Mode

Used with the external C++ acquisition software.

```text
External Signal -> Claim Completed Acquisition -> Run Saved Pipeline
-> Store Result -> Return Status/Result
```

Both modes call exactly the same pipeline engine. Only the intake connector differs.

The online protocol remains unselected until the external software team confirms its capabilities. The first supported candidate is an atomic folder plus `READY.json` signal.

## Saved Production Pipeline

An administrator configures a pipeline once. Operators run the approved, locked version without editing technical settings.

Initial brake-disc pipeline contents:

```text
Identity
- Pipeline ID and version
- Product/project ID
- Approved/locked state

Input
- 16 images
- Expected dimensions: 6560 x 4948
- Numeric order: 1 through 16
- Nominal step: 22.5 degrees
- Allowed formats and quality tier

Reconstruction
- Upper or downside strategy
- Calibration version
- Side-specific reference assets
- Registration and closure thresholds
- Coverage, provenance, and artifact settings

Inference
- Approved model bundle and SHA-256
- ONNX Runtime CUDA or TensorRT provider
- FP16
- Fixed ONNX spatial input: 1312 x 1312
- Dynamic/approved batch size
- SAHI slice: 1312 x 1312
- SAHI overlap: initial value 50 percent
- Confidence, IoU, NMS, and class settings

Output
- Database policy
- Preview and native artifact policy
- Retention and reporting policy
```

Changing a model, calibration, image geometry, slice size, overlap, threshold, reconstruction rule, or output policy creates a new pipeline version. A completed run permanently references the exact version and resolved snapshot it used.

## Production Workflow

```text
1. Receive/select an acquisition
2. Stage and hash 16 immutable inputs
3. Validate geometry, order, uniqueness, format, and side
4. Start CPU reconstruction and GPU raw inference concurrently
5. Validate reconstruction and side-specific alignment
6. Project source-frame predictions through saved transforms
7. Merge overlap duplicates
8. Produce compact result and database record
9. Write large audit artifacts in the background when allowed
10. Mark completed only after required artifacts and database transaction pass
```

Raw inference may run speculatively in parallel, but predictions cannot be published when reconstruction validation fails.

## Proposed Source Layout

The exact folders are created only by their approved task.

```text
brake-disc-production-app/
|-- src/brake_disc_inspection/
|   |-- app/
|   |-- configuration/
|   |-- contracts/
|   |-- intake/
|   |-- pipelines/
|   |-- reconstruction/
|   |-- inference/
|   |-- projection/
|   |-- orchestration/
|   |-- storage/
|   |-- database/
|   |-- reporting/
|   |-- ui/
|   `-- diagnostics/
|-- tests/
|   |-- unit/
|   |-- integration/
|   |-- golden/
|   `-- performance/
|-- docs/
|-- scripts/
|-- packaging/
|-- pyproject.toml
|-- README.md
`-- .gitignore
```

## Working Agreement

1. Work on one task at a time.
2. Explain purpose, design, risks, and affected files before editing.
3. Do not begin the next task until the current result is ready for user review.
4. After user review, update this document with results and exact verification.
5. Commit only after explicit user approval.
6. Use focused commits and never include datasets, models, outputs, databases, logs, caches, or unrelated files.
7. Never modify source acquisitions.
8. Use a real temporary/test SQLite database for database tests.
9. Keep paths configurable and contained beneath an approved data root.
10. No destructive cleanup without resolving and validating the exact run path.
11. Performance claims require measurements on the intended production hardware.
12. Accuracy is never reduced for speed without explicit defect-level validation and approval.

## Status Definitions

- `PLANNED`: Defined but not started.
- `IN PROGRESS`: Authorized task currently being implemented.
- `READY FOR USER REVIEW`: Implementation and checks are complete; waiting for the user.
- `APPROVED`: User accepted the task; it may be committed.
- `COMMITTED`: Approved task committed with its hash recorded.
- `BLOCKED`: The task cannot proceed safely without a decision or external information.
- `DEFERRED`: Intentionally postponed.

## Detailed Implementation Tasks

### Task 0 - Approve Product Boundary and Repository

Status: `APPROVED`

Work:

- Approve the separate-application decision.
- Approve the proposed folder and repository name.
- Confirm that `image-reconstruction-app` remains reference data.
- Confirm that AI Studio and production use model/file contracts rather than runtime imports.
- Record the initial production-PC assumptions and target operating system.

Acceptance:

- Repository boundary is unambiguous.
- No application code is created prematurely.
- No existing repository or dataset is moved or modified.

Approval recorded on 2026-07-22:

- The user approved a separate production application and Git repository.
- Approved future folder: `V:\stage-1-labeling-app\brake-disc-production-app`.
- Approved Python orchestration with ONNX Runtime CUDA production inference.
- Approved offline mode as the first implementation path.
- Online integration remains pending the external acquisition-software discussion.
- No new repository or application code was created under Task 0.

### Task 1 - Create the Safe Repository Baseline

Status: `PLANNED`

Work:

- Create `V:\stage-1-labeling-app\brake-disc-production-app` only after Task 0 approval.
- Initialize a new Git repository and dedicated main/development branch policy.
- Add the Python `src` layout, tests, documentation, and packaging placeholders.
- Add strict `.gitignore` rules for models, datasets, run data, databases, logs, caches, native outputs, and secrets.
- Pin a supported Python version and define dependencies without installing unnecessary packages.
- Add baseline formatting, type-check, test, and build commands.

Acceptance:

- The new repository is independent.
- No dataset or model binary is tracked.
- A minimal import and test pass.
- No production behavior exists yet.

### Task 2 - Define Versioned Contracts and Configuration

Status: `PLANNED`

Work:

- Define schemas for model bundles, pipeline versions, acquisition manifests, run state, transforms, predictions, artifacts, and reports.
- Define coordinate systems, units, matrix direction, angle convention, and side values.
- Define stable error codes and run states.
- Add configuration loading with environment-specific data roots.
- Add deterministic serialization, checksums, and atomic writes.

Acceptance:

- Invalid or unknown fields fail clearly.
- Old run snapshots remain readable after a pipeline update.
- Absolute and escaping paths are rejected.
- Contract fixtures and round-trip tests pass.

### Task 3 - Implement Offline Acquisition Intake

Status: `PLANNED`

Work:

- Select/register a folder without modifying it.
- Discover exactly 16 supported images in numeric order.
- Stream file hashes and record dimensions, format, byte size, and timestamps.
- Reject missing, extra, duplicate, unreadable, mixed-geometry, mixed-tier, and unsafe inputs.
- Stage a run through safe references or controlled copies according to the approved policy.
- Produce an immutable acquisition manifest.

Acceptance:

- All current upper/down 60-percent inputs validate read-only.
- Failure messages identify the exact frame and reason.
- Partially written inputs cannot start a run.
- Original files remain byte-identical.

### Task 4 - Port the Pure Reconstruction Foundation

Status: `PLANNED`

Work:

- Inventory the proven reconstruction contracts and algorithms currently developed in AI Studio.
- Port only pure, production-relevant geometry and validation code.
- Remove AI Studio settings, database, API, logging, and filesystem assumptions.
- Port focused unit tests and golden numeric fixtures.
- Record source version/commit and every intentional behavioral difference.

Acceptance:

- Production code has no AI Studio runtime import.
- Contract and transform tests reproduce approved results.
- Source paths and outputs are application-owned and configurable.
- The port is reviewed file by file before acceptance.

### Task 5 - Implement Side-Specific Reconstruction Pipelines

Status: `PLANNED`

Work:

- Implement the common 16-frame validation, placement, registration, coverage, closure, and provenance stages.
- Implement the approved upper black-plate strategy.
- Implement downside complete black-assembly and flash/screen circular-alignment strategy.
- Solve per-run bounded alignment from evidence; never hardcode the current `160.0-degree` proof as universal.
- Keep acquired and reference pixels in separate provenance classes.
- Fail closed on ambiguous or low-confidence physical evidence.

Acceptance:

- Both approved datasets reproduce their accepted geometry.
- Every frame contributes exactly once.
- Required neighbor and closure gates pass or the run fails visibly.
- Reference pixels never become acquired inspection evidence.

### Task 6 - Implement Tiled Reconstruction and Artifacts

Status: `PLANNED`

Work:

- Render in bounded tiles or memory-mapped regions.
- Produce navigation preview, coverage, provenance, transforms, and reconstruction report.
- Add BigTIFF-compatible native output.
- Benchmark lossless tiled compression.
- Separate critical result artifacts from large background audit artifacts.
- Use atomic finalization and validate completed files by reopening them.

Acceptance:

- No full-canvas floating-point allocation is required.
- Peak memory remains bounded and measured.
- Acquired pixels are not silently changed.
- Interrupted files cannot be reported as complete.

### Task 7 - Define and Validate the ONNX Model Bundle

Status: `PLANNED`

Work:

- Define the production package exported by AI Studio.
- Require `model.onnx`, class mapping, preprocessing, output decoding, thresholds, SAHI configuration, manifest, validation evidence, and checksums.
- Validate fixed spatial input `1312 x 1312` and supported batch range.
- Define `.pt` to ONNX parity requirements using known crack images.
- Reject incompatible, altered, or incomplete bundles.

Acceptance:

- The production app never requires a `.pt` model.
- Model identity and preprocessing are unambiguous.
- Known-crack parity passes before the bundle can be approved.

### Task 8 - Implement Persistent ONNX GPU Inference

Status: `PLANNED`

Work:

- Load the approved ONNX model once in a dedicated worker.
- Use ONNX Runtime CUDA FP16 first.
- Add warm-up, GPU availability checks, input/output binding, and bounded batches.
- Decode predictions according to the model bundle rather than hardcoded assumptions.
- Preserve immutable raw source-frame predictions.
- Add clear GPU out-of-memory and provider-fallback behavior; do not silently switch to a slow backend during production.

Acceptance:

- Repeated runs do not reload the model.
- Predictions match approved ONNX validation evidence.
- GPU errors cannot be mistaken for a valid zero-defect result.
- Timing and GPU memory are recorded.

### Task 9 - Implement SAHI 1312 Pipeline

Status: `PLANNED`

Work:

- Generate `1312 x 1312` slices in memory.
- Use the pipeline's approved overlap, initially 50 percent.
- Pad edge slices deterministically without distorting pixels.
- Batch slices using the saved, hardware-approved batch size.
- Convert outputs back to original-frame coordinates.
- Implement class-aware slice-overlap merging.
- Never write thousands of temporary slice images.

Reference workload for `6560 x 4948`, 50-percent overlap:

- approximately 63 slices per image;
- approximately 1008 slices per 16-image side;
- approximately 32 inference batches if batch 32 is validated.

Acceptance:

- Boundary cracks are retained across slice joins.
- Coordinates match original images within the approved tolerance.
- Batch 8/16/24/32 profiling selects a stable value; no batch is assumed.
- Known-crack accuracy passes at the saved overlap.

### Task 10 - Implement Parallel Run Orchestration

Status: `PLANNED`

Work:

- Add a lightweight main service, one persistent GPU worker, bounded CPU reconstruction workers, and an image-loader pool.
- Start raw SAHI inference and CPU reconstruction concurrently after validated intake.
- Prevent CPU, disk, RAM, and GPU oversubscription.
- Add persistent stage checkpoints, progress, cancellation, failure, and restart recovery.
- Require reconstruction validation before predictions are published.
- Prevent two workers from claiming the same run.

Acceptance:

- The UI/service remains responsive.
- A restart cannot duplicate or falsely complete a run.
- Parallel processing produces the same result as sequential reference execution.
- Stage timing, queue time, peak RAM, VRAM, and disk throughput are recorded.

### Task 11 - Project and Merge Disc Predictions

Status: `PLANNED`

Work:

- Transform source boxes, polygons, and masks through the saved source-to-reconstruction transform.
- Clip predictions to acquired-pixel provenance.
- Store source and reconstructed geometry together.
- Merge detections from neighboring acquisition overlap using versioned class-aware rules.
- Retain every merged detection's original source evidence.

Acceptance:

- Reference-only pixels cannot generate predictions.
- Clicking a disc prediction resolves to its original image evidence.
- Duplicate-merging tests cover joins and `16 -> 1` closure.
- Raw predictions remain immutable.

### Task 12 - Add the Production Database

Status: `PLANNED`

Work:

- Add pipeline, model, run, frame, artifact, raw prediction, merged prediction, and review metadata.
- Store relative paths and checksums, not large image blobs.
- Add additive migrations, transactions, indexes, backup, recovery, and retention metadata.
- Keep a database repository boundary so a future plant database can replace SQLite without changing algorithms.

Acceptance:

- Tests use a real temporary SQLite database.
- A failed transaction cannot create a completed run.
- Existing records remain tied to their exact model and pipeline versions.
- Database backup and restore are demonstrated.

### Task 13 - Build the Offline Production UI

Status: `PLANNED`

Work:

- Add an operator view for selecting a folder and approved pipeline.
- Display 16-frame readiness, side, pipeline/model version, progress, and actionable failures.
- Keep technical settings locked for operators.
- Add a separate authenticated administrator configuration area.
- Reload all durable state from the service/database after restart.

Acceptance:

- A production operator can start an offline run without editing technical values.
- Invalid inputs are visible before processing.
- Closing/reopening the UI does not cancel or lose an active run.

### Task 14 - Build Review, History, and Export UI

Status: `PLANNED`

Work:

- Add zoomable reconstruction previews and prediction overlays.
- Show original high-resolution evidence for each prediction.
- Add accepted/rejected/review-required decisions as a separate layer.
- Add searchable run history and safe exports.
- Stream or tile large artifacts; never load the full BigTIFF into one UI canvas.

Acceptance:

- Operator decisions never overwrite raw AI output.
- Every result displays pipeline/model identity and reconstruction validity.
- Full-resolution downloads do not exhaust UI memory.

### Task 15 - Define the Online Connector Interface

Status: `PLANNED`

Work:

- Define connector operations: discover, validate signal, claim, acknowledge, report progress, complete, fail, and retry.
- Keep connector code separate from the production pipeline.
- Document candidate READY-file, REST, socket, named-pipe, and PLC-mediated protocols.
- Record external-team answers before selecting one implementation.

External information required:

- same PC or networked PC;
- final image folder and naming contract;
- how a completely written acquisition is signaled;
- available run ID, serial, side, timestamp, and product metadata;
- required acknowledgement and result fields;
- retry/timeout behavior;
- whether acquisitions may overlap;
- required maximum response time.

Acceptance:

- Offline processing remains unchanged regardless of connector choice.
- The interface prevents processing incomplete data or claiming a run twice.

### Task 16 - Implement the Approved Online Connector

Status: `BLOCKED` pending the external software discussion

Work:

- Implement only the protocol approved after Task 15.
- Add atomic handoff, idempotency, acknowledgement, timeout, retry, and error behavior.
- Add a simulator so online behavior can be tested without the real acquisition machine.
- Return production status/results without exposing internal paths or tracebacks.

Acceptance:

- Simulated and real integration tests pass.
- Partial files and duplicate signals are handled safely.
- Loss of either application recovers without losing or duplicating an inspection.

### Task 17 - Add Security, Recovery, and Retention

Status: `PLANNED`

Work:

- Enforce data-root containment, extension/size limits, and symlink/reparse-point protection.
- Add safe secret/configuration handling and role separation.
- Add disk-space gates before large output.
- Add crash recovery, quarantined failures, audit logs, and explicit retention cleanup.
- Add fault injection for corrupt input, disk full, GPU failure, worker crash, cancellation, database lock, and power-loss-like restart.

Acceptance:

- No user-controlled path escapes the approved root.
- A failure never becomes a zero-defect pass.
- Cleanup cannot target a broad or unresolved directory.
- Required audit evidence survives recovery.

### Task 18 - Optimize and Approve Performance

Status: `PLANNED`

Work:

- Benchmark on the intended RTX 4090, CPU, 128 GB RAM, and production NVMe.
- Measure decode, slicing, transfer, ONNX, NMS, registration, render, database, and artifact-write stages separately.
- Compare CUDA FP16 and TensorRT provider behavior.
- Validate batch sizes 8, 16, 24, and 32 at `1312 x 1312`.
- Compare overlap settings only if the user authorizes accuracy experiments.
- Move a measured bottleneck to C++/CUDA only through a separate approved task.

Acceptance:

- Timing claims include warm and cold runs, percentiles, peak resources, and accuracy results.
- Selected settings are saved in a new approved pipeline version.
- Speed changes do not reduce known-crack recall or geometry accuracy.

### Task 19 - Package the Windows Production Application

Status: `PLANNED`

Work:

- Package the UI, service, Python runtime, ONNX Runtime GPU provider, and required native libraries.
- Validate CUDA/TensorRT compatibility and provide a system-readiness diagnostic.
- Configure service/application startup, logs, data root, model import, backup, and recovery.
- Build installer, upgrade, rollback, and uninstall procedures that preserve production data.

Acceptance:

- A clean production-like Windows PC installs and runs without developer tools.
- Upgrade/uninstall never removes production data automatically.
- GPU/provider and model readiness are visible before online mode is enabled.

### Task 20 - Supervised Production Pilot and Final Acceptance

Status: `PLANNED`

Work:

- Run approved upper and downside datasets end to end.
- Run controlled good/defective physical samples.
- Compare reconstruction, ONNX predictions, projection, duplicate merging, database, reports, and cycle time.
- Operate in supervised mode until failure behavior and repeatability are proven.
- Record limitations, calibration procedure, recovery procedure, and operator manual.

Acceptance:

- User approves accuracy, reconstruction, workflow, and performance.
- External acquisition integration is proven under repeated operation.
- Every result is reproducible from model, pipeline, inputs, and software versions.
- Online automatic mode is enabled only after explicit final approval.

## Deferred Tasks

- Custom C++ reconstruction or slicing accelerator without profiling evidence.
- INT8 inference without a representative calibration set and accuracy approval.
- General-purpose support for unrelated production projects.
- Multi-station server database or cloud coordination.
- PLC/MES integration not required by the approved acquisition contract.
- Fully unattended pass/fail before the supervised pilot succeeds.

## Immediate Next Decision

Approve or revise Task 0:

- new folder: `V:\stage-1-labeling-app\brake-disc-production-app`;
- separate Git repository;
- Python production engine using ONNX Runtime CUDA;
- offline mode first;
- online connector after the external software discussion;
- no production application code until this boundary is approved.
