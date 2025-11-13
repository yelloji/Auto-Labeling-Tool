- Ensure `AiModel` upsert must succeed; otherwise return 500, not success
- In `/api/v1/models/import`:
  - If `model_manager.models_info[model_id]` missing → 500
  - Wrap `AiModelOperations.upsert_ai_model` in try/except; on error → 500 with reason
  - Return success only after upsert succeeds

This solves: file saved but DB not updated → model missing in UI