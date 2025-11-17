## Changes
- Update SQLAlchemy `AiModel` with `project_name` column
- Safe migration: add column if missing during `init_db`
- Update `AiModelOperations.upsert_ai_model` to set `project_name` as 'global' or actual project name
- Update debug_database to show project_name (already showing project_id)

## Result
- AiModel rows include both `project_id` and `project_name` for clarity
- Global models show `project_name='global'`; project-scoped rows show the actual project name