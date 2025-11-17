Short plan
- Enforce duplicate name check only in DB on (name, project_id)
- Stop ModelManager from rejecting names based on in-memory config

Changes
1) In `/api/v1/models/import`:
- Check DB: if AiModel exists with same (name, project_id) → 409
- If not, proceed to import

2) In `ModelManager.import_custom_model`:
- Remove name-based `models_info` check
- Generate a unique `model_id` (prefix project slug when project, else global) and allow suffix if needed
- If target file exists, write with a safe unique suffix

3) Optional: Drop legacy global unique index `ix_ai_models_name` (keep unique `(name, project_id)`) to align DB behavior

Result
- Name collisions handled by DB only; after delete, name can be reused; memory/config will not block it.

Proceed?