Scope
- Enforce model name uniqueness using only the AiModel DB table on (name, project_id)
- Remove in-memory name rejection in ModelManager

Changes
1) Import route `/api/v1/models/import`
- Normalize project_id (empty → None)
- DB check: if AiModel with same `name` and `project_id` exists → 409; otherwise proceed

2) ModelManager.import_custom_model
- Remove `models_info` name check
- Generate scope-aware `model_id`: global → `custom_<slug>`; project → `custom_<projectSlug>_<slug>`
- If target file exists, add a safe numeric suffix to filename (not the name stored in DB)

3) Optional DB migration
- Drop legacy global unique index `ix_ai_models_name` (keep unique `(name, project_id)`)

Result
- Name duplicate decisions are DB-driven; reusing a name after delete works; memory/config won’t block uploads