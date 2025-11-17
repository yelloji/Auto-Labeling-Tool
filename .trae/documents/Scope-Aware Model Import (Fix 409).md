Summary
- Prevent global name collision; allow reuse after delete.

Backend Changes
1) ModelManager: scope runtime IDs
- In import_custom_model: if dest_dir is a project folder (projects/<ProjectName>/model), set model_id = custom_<projectSlug>_<slug>; else custom_<slug>.
- Keep file path under target_base; delete removes file + config to free name.

2) Models import route
- Treat empty project_id as None (global) robustly.
- Map scope duplicates to 409 only when (name, project_id) exists; otherwise allow.

3) DB migration
- Drop legacy global unique index ix_ai_models_name; rely on unique (name, project_id).
- Add a one-time DROP INDEX IF EXISTS in init_db.

Result
- Uploading “mas” in a project does not collide with global; re-upload after delete works.

Proceed to implement these changes?