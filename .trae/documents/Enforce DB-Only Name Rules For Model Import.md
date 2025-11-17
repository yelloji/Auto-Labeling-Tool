Rules

* Global name reserved across all scopes (block if global exists)

* Project name unique per project (allow same name in other projects unless a global exists)

Changes

* `/api/v1/models/import`:

  * Normalize `project_id` (empty → None)

  * Query DB:

    * If `project_id is None`: block if any AiModel with `name`

    * If `project_id is not None`: block if global with `name` OR same `(name, project_id)`

  * Return clear 409 messages; avoid 500

* `ModelManager.import_custom_model`:

  * Remove in-memory name rejection

  * Scope runtime `model_id`: global → `custom_<slug>`; project → `custom_<projectSlug>_<slug>`

  * If file exists, write with suffix; keep DB `name` unchanged

* DB migration:

  * Drop legacy global unique index `ix_ai_models_name`; keep unique `(name, project_id)`

Verification

* Upload “rakesh” global → OK; local “rakesh” → blocked

* Upload “rakesh” in project A → OK; project B → OK

* Delete and re-upload “rakesh” in same scope → OK

* \`python

