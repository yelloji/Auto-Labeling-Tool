## Summary
- Keep: `training_sessions` (backend/models/training/models.py:15–47)
- Remove: `training_iterations`, `uncertain_samples`, `model_versions`, `model_usage`

## Steps
- Delete ORM models and imports/exports for removed tables.
- Refactor `core/active_learning.py`, `models/training/engine.py`, `api/active_learning.py` to drop usage.
- Drop DB tables if present (safe `DROP TABLE IF EXISTS ...`).
- Remove `ModelUsage` and its ops from `backend/database/models.py` and `backend/database/operations.py`.
- Update tests/docs; quick DB check to verify tables are gone.

Confirm and I’ll implement quickly.