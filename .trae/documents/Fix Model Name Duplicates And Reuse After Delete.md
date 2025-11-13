## Goals
- Block same name only when it exists in the same scope (global or the current project)
- Allow reusing a name after deletion (name, file, and runtime config fully cleared)

## Changes
- Scope-aware IDs: when importing with project_id, generate `custom_<projectSlug>_<slug>`; global stays `custom_<slug>`
- Import check: conflict only if a model with same (name, project_id) exists in DB or runtime for that scope
- Delete flow: ensure DB row, runtime models_info, models_config.json, and file on disk are removed, so the name becomes free
- DB: keep unique index on `(name, project_id)`; do not enforce global name uniqueness

## Verification
- Create global "rakesh" → delete → re-import "rakesh" allowed
- Create project "rakesh" → delete → re-import allowed
- Try duplicate within same project/global → blocked with clear message

Proceed to implement?