# Full Project Export / Import Reference

Reference project: `Sensore di Forza internal`

Purpose: define what a complete project backup/restore must include so the project can move from one PC to another without manually copying `database.db` and the project folder.

## Goal

Export one project as a single package, then import it into another app installation and make it work like a normal local project.

This is not only a file copy. The project folder contains the images, releases, training outputs, predictions, and model files. The database contains the relationships that tell the app how those files belong together.

## Recommended Package Shape

```text
project_export.zip
  manifest.json
  database_snapshot.json
  files/
    Sensore di Forza internal/
      annotating/
      dataset/
      model/
      releases/
      training_data/
      unassigned/
```

`manifest.json` should store package metadata:

- Export format version
- App version
- Original project id and project name
- Exported date/time
- Project folder name
- File checksum summary if we want stronger validation

`database_snapshot.json` should store the DB rows for only this project, grouped by table.

Design decision: export the full selected project folder. Do not exclude `training_data/` or other large project subfolders. Export/import may take time and may produce a large ZIP, but the goal is full restore, not a compact partial export.

Do not export global app model folders such as `models/`, `yolo/`, or `yolo26seg/`. Those belong to the app installation, not to one project. Only export model files that are inside the selected project folder or DB model rows that belong to that project/training session.

## Reference Project Snapshot

Project DB row:

```text
id: 8
name: Sensore di Forza internal
project_type: segmentation
created_at: 2025-09-29 13:26:21
updated_at: 2025-09-29 13:26:21
```

Project folder summary:

```text
annotating:      0 files
dataset:         4 files,    9.18 MB
model:         242 files,   51.96 MB
releases:        4 files,  918.76 MB
training_data: 1763 files, 925.34 MB
unassigned:     18 files,   41.31 MB
```

This project is a good reference because it has the main production objects:

- 3 datasets
- 22 images
- 88 annotations
- 5 project labels
- 4 releases
- 9 release transformations
- 1 training session
- 3 model experiments

## Project Folder Contents

The full project folder must be copied into the export package.

Important folders:

- `unassigned/`: uploaded batches that are not currently in the completed dataset column.
- `annotating/`: batches currently assigned for annotation work.
- `dataset/`: batches moved into the dataset column and split into train/val/test folders.
- `releases/`: release ZIP files and staging folders.
- `training_data/`: extracted/generated release training data used by training.
- `model/`: training runs, weights, validation outputs, prediction outputs, charts, and experiment files.

For this project, the training run exists here:

```text
projects/Sensore di Forza internal/model/training/SENSORE-FIRST
```

Important training files inside that run include:

- `args.yaml`
- `results.csv`
- `results.png`
- `confusion_matrix.png`
- `confusion_matrix_normalized.png`
- `weights/`
- `artifacts/`
- `logs/`
- `experiments/`
- validation/prediction image outputs

## DB Tables To Export

These tables are directly project-related or can be related through project objects.

### `projects`

Root row for the project.

Import behavior:

- Create a new project row on the target PC.
- Do not reuse the old project id if it already exists.
- Store an id map: `old_project_id -> new_project_id`.

### `datasets`

Stores image batches/datasets for the project.

Reference project rows:

```text
good:            10 total, 10 labeled, 0 unlabeled
int2_square:      8 total,  8 labeled, 0 unlabeled
internal_square:  4 total,  4 labeled, 0 unlabeled
```

Import behavior:

- Insert every dataset row with a new dataset id or preserve UUID only if guaranteed unique.
- Update `project_id` to the new project id.
- Store an id map: `old_dataset_id -> new_dataset_id`.

### `images`

Stores every uploaded image record and its file path, size, label status, split status, hash, and thumbnail path.

Important columns:

- `id`
- `dataset_id`
- `filename`
- `original_filename`
- `file_path`
- `thumbnail_path`
- `width`
- `height`
- `split_type`
- `split_section`
- `is_labeled`
- `is_auto_labeled`
- `is_verified`
- `image_hash_md5`

Import behavior:

- Insert all image rows for exported datasets.
- Update `dataset_id` using the dataset id map.
- Rewrite `file_path` and `thumbnail_path` to the new project folder path.
- Store an id map: `old_image_id -> new_image_id`.

Important note from the reference project:

- Some labeled images are still under `unassigned/`.
- Some images are under `dataset/<batch>/<split>/`.
- Import must preserve `split_type`, `split_section`, and actual file path. It must not guess based only on label status.

### `annotations`

Stores manual and auto annotations for images.

Reference project annotation count:

```text
total:   88
defects: 62
null:    10
HOLE:     6
CUT:      6
scratch:  4
```

Important columns:

- `id`
- `image_id`
- `class_name`
- `class_id`
- `x_min`, `y_min`, `x_max`, `y_max`
- `segmentation`
- `is_auto_generated`
- `is_verified`
- `model_id`

Import behavior:

- Insert all annotation rows for imported images.
- Update `image_id` using the image id map.
- Update `class_id` using the label id map when it refers to an imported project label.
- Update `model_id` using the AI model id map when it refers to an imported project/custom/trained model.
- Keep `class_name`, bbox, and segmentation exactly.

### `labels`

Stores project-level class labels.

Reference project labels:

```text
defects
null
scratch
CUT
HOLE
```

Import behavior:

- Insert all labels for the new project id.
- Preserve label names and colors.
- Avoid merging with labels from a different project.
- Store an id map: `old_label_id -> new_label_id`.

### `dataset_splits`

Stores split configuration for each dataset.

Import behavior:

- Insert split rows for imported datasets.
- Update `dataset_id` using the dataset id map.

### `releases`

Stores release metadata.

Reference project releases:

```text
release_good_sensore_int: 60 final images
RELEASE_SENSORE_INT_2:    288 final images
SENSORE-IN-NEW:           528 final images
INTERNLA:                 4 final images
```

Important columns:

- `id`
- `project_id`
- `name`
- `export_format`
- `task_type`
- `datasets_used`
- `config`
- image counts
- class count
- `model_path`
- `created_at`

Import behavior:

- Insert releases with new release ids or preserved UUIDs only if safe.
- Update `project_id`.
- Rewrite any file paths in `config`, `datasets_used`, or `model_path` if present.
- Parse `datasets_used` JSON and remap dataset ids using the dataset id map.
- Parse `config` JSON and remap dataset ids, release paths, or project paths if present.
- Store an id map: `old_release_id -> new_release_id`.

### `image_transformations`

Stores release transformation steps.

Reference project count:

```text
9 transformation rows linked to releases
```

Import behavior:

- Insert all transformation rows linked by `release_id` or `release_version`.
- Update `release_id` using the release id map.
- Keep transformation parameters exactly.

### `training_sessions`

Stores model training run metadata.

Reference project training:

```text
name: SENSORE-FIRST
status: completed
release id: 74404f4c-4251-4535-8981-f25d283c09e2
task: segmentation
run_dir: projects/Sensore di Forza internal/model/training/SENSORE-FIRST
```

Import behavior:

- Insert training session rows for the project.
- Update `project_id`.
- Update `dataset_release_id` using the release id map.
- Resolve `base_model_id`.
  - If it points to a project/custom/trained model included in the export, remap it using the AI model id map.
  - If it points to a global/default app model, do not export that model file; resolve it on the target app by installed model id/name/path.
- Rewrite file paths like `dataset_release_dir`, `run_dir`, `weights_dir`, `best_weights_path`, `logs_dir`, and `artifacts_dir`.
- Parse JSON fields such as `dataset_summary_json`, `resolved_config_json`, and `training_config_snapshot` and remap project paths or ids if present.
- Store an id map: `old_training_id -> new_training_id`.

### `model_experiments`

Stores validation and prediction experiment rows.

Reference project experiments:

```text
VAL-SENSORE-INT:        validation, completed
prediction-sensore-int: prediction, completed
sensore-int-pred:       prediction, completed
```

Important columns:

- `id`
- `training_id`
- `project_id`
- `experiment_type`
- `dataset_source`
- `dataset_path`
- `validation_metrics`
- `per_class_metrics`
- `confusion_matrix`
- `input_images`
- `output_folder`
- `predictions`
- `analytics_summary`

Import behavior:

- Insert experiments after training sessions.
- Update `training_id` and `project_id`.
- Rewrite `dataset_path`, `output_folder`, and any file paths inside JSON fields if they contain project paths.
- Explicitly rewrite paths inside `predictions`, `input_images`, and `analytics_summary` when those fields contain project paths.
- Store an id map: `old_experiment_id -> new_experiment_id`.

### `human_verifications`

This table is important for prediction review: pass, fail, and missing/manual verification records live here.

Current reference project `Sensore di Forza internal` has no rows in this table, but the table is used by other projects and must be included in the full export/import design.

Observed DB usage:

```text
total human_verifications rows: 142
gevis project has pass/fail/missing records
```

Important columns:

- `id`
- `project_id`
- `image_name`
- `class_name`
- bbox coordinates
- `status`
- `notes`
- `experiment_id`
- `image_hash_md5`
- `image_hash_perceptual`
- `is_manual`

Import behavior:

- Export all rows where `project_id` matches the project.
- Also export rows linked to exported `model_experiments.id` if needed.
- Update `project_id` to the new project id.
- Update `experiment_id` using the experiment id map when it exists.
- Keep image hashes and manual status.

### `label_analytics`

Stores dataset analytics if present.

Import behavior:

- Export rows where `dataset_id` belongs to this project.
- Update `dataset_id` using the dataset id map.
- Update `model_id` using the AI model id map when it refers to an imported project/custom/trained model.
- If `model_id` refers to a global/default app model, resolve it on the target app instead of importing a duplicate global model.

### `auto_label_jobs`

Stores auto-label job history if present.

Import behavior:

- Export rows where `dataset_id` belongs to this project.
- Update `dataset_id` using the dataset id map.

### `image_variants`

Stores image variant rows if present.

Import behavior:

- Export rows linked to imported image ids if the table is actively used.
- Update `parent_image_id` using the image id map.

### `ai_models`

Stores uploaded/default/trained model metadata.

Import behavior:

- Export project-specific model rows where `project_id` matches the project or `training_session_id` belongs to this project.
- Update `project_id`, `project_name`, and `training_session_id`.
- Rewrite `file_path` if it points inside the exported project folder.
- Do not export global/default model files from app-level folders.
- Store an id map: `old_ai_model_id -> new_ai_model_id` for project/custom/trained models.
- Resolve references to global/default models on the target app by installed model id/name/path.

## Import Order

Recommended import order:

1. Validate `manifest.json`.
2. Extract project folder to a safe staging folder.
3. Create new `projects` row.
4. Copy project files into the target `projects/<new project name>/` folder.
5. Insert `labels`.
6. Insert project/custom/trained `ai_models` rows that do not depend on training session ids.
7. Insert `datasets`.
8. Insert `images`.
9. Insert `annotations`.
10. Insert `dataset_splits`.
11. Insert `label_analytics`.
12. Insert `releases`.
13. Insert `image_transformations`.
14. Insert `training_sessions`.
15. Insert project/custom/trained `ai_models` rows that depend on imported training sessions, if needed.
16. Insert `model_experiments`.
17. Insert `human_verifications`.
18. Insert `auto_label_jobs` and `image_variants` if present.
19. Run integrity checks.

Note: `ai_models` has a circular practical relationship with training. Some model rows can be imported before training sessions, while trained-model rows may reference a training session. The implementation should split AI model import into two passes if necessary:

- Pass 1: independent uploaded/project model rows.
- Pass 2: trained model rows after `training_sessions` id mapping exists.

## ID Remapping Rules

Never assume old ids are safe on the target PC.

Required maps:

```text
old_project_id     -> new_project_id
old_dataset_id     -> new_dataset_id
old_image_id       -> new_image_id
old_label_id       -> new_label_id
old_ai_model_id    -> new_ai_model_id
old_release_id     -> new_release_id
old_training_id    -> new_training_id
old_experiment_id  -> new_experiment_id
```

Labels use integer ids and annotations include `class_id`, so the import must build and use a label id map. Keep class names consistent, but do not rely on class name alone if `class_id` is used by UI/export logic.

JSON fields may also contain IDs. The importer must parse and remap IDs inside JSON, not only normal table columns.

Fields that may contain IDs:

- `releases.datasets_used`
- `releases.config`
- `training_sessions.dataset_summary_json`
- `training_sessions.resolved_config_json`
- `training_sessions.training_config_snapshot`
- `model_experiments.input_images`
- `model_experiments.predictions`
- `model_experiments.analytics_summary`

## Path Remapping Rules

Any DB value pointing to the old project folder must be rewritten.

Example:

```text
projects/Sensore di Forza internal/...
```

should become:

```text
projects/<imported project folder>/...
```

Fields that may contain paths:

- `images.file_path`
- `images.thumbnail_path`
- `releases.model_path`
- `releases.config`
- `training_sessions.dataset_release_dir`
- `training_sessions.run_dir`
- `training_sessions.weights_dir`
- `training_sessions.best_weights_path`
- `training_sessions.logs_dir`
- `training_sessions.artifacts_dir`
- `model_experiments.dataset_path`
- `model_experiments.output_folder`
- `model_experiments.input_images`
- `model_experiments.predictions`
- `ai_models.file_path`

If project name does not change and paths are already relative, many path values can stay unchanged. If project name changes because the target app already has the same project name, replace the old project folder segment in all imported relative paths.

## Integrity Checks After Import

After import, verify:

- Project appears in the Projects page.
- Project folder exists.
- Dataset batches appear in Management/Dataset.
- Image counts match the export.
- Annotation counts match the export.
- Labels/classes match the export.
- Train/validation/test split counts match.
- Release history appears.
- Release detail view opens and image/annotation overlays load.
- Training session appears in Model Training / Model Lab.
- Validation and prediction experiments appear.
- Prediction analytics pass/fail/missing records appear if `human_verifications` rows existed.
- All file paths open from the new PC location.

## Implementation Recommendation

Build this as a dedicated feature, not inside the existing release creation file.

Suggested backend structure:

```text
backend/api/routes/project_transfer.py
backend/api/services/project_export_service.py
backend/api/services/project_import_service.py
backend/api/services/project_transfer_manifest.py
```

Suggested API endpoints:

```text
POST /api/v1/projects/{project_id}/export
POST /api/v1/projects/import/validate
POST /api/v1/projects/import
```

Why separate service files:

- Release code is already large.
- Import/export touches many tables and file operations.
- We need safer testing and rollback logic.

## Import Safety / Rollback

Import must not leave a half-created project.

Required safety plan:

- Extract ZIP into a staging folder first.
- Validate manifest and database snapshot before inserting rows.
- Use a SQLite transaction for the DB insert phase.
- If any DB insert/remap fails, rollback the transaction.
- Copy the project folder only after validation, or track copied files/folders so they can be deleted on failure.
- If file copy succeeds but DB insert fails, delete the imported project folder.
- If DB insert succeeds but final integrity checks fail, rollback if still inside transaction or mark import as failed and remove copied files.
- Only show success after folder copy, DB insert, remapping, and integrity checks all pass.

## Main Risk

The project folder copy is straightforward. The real risk is DB remapping.

If remapping is wrong, the imported project may open but release history, model experiments, prediction analytics, or human verification records can point to old IDs or old file paths.

So the first production implementation should include a dry-run validation step before writing into the target DB.
