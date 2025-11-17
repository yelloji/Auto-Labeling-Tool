## Overview
- Add a backend endpoint to report hardware info (GPU list, CUDA availability, versions) and expose via UI.
- Add a CPU/GPU toggle in Model Training UI; if GPU is chosen, show a small modal with available GPUs and CUDA status to pick a device.

## Backend (minimal change)
- File: `backend/main.py`
- Endpoint: `GET /api/v1/system/hardware`
- Returns: `{ device: 'cpu'|'gpu', cuda_available: bool, cuda_version: string|null, torch_cuda_available: bool, gpus: [{id, name, memory_mb}] }`
- Implementation: use `torch` if available (`torch.cuda.is_available()`, `torch.cuda.device_count()`, `torch.cuda.get_device_name(i)`), otherwise report CPU-only. Gracefully handle absence of torch.

## Frontend
- Files: `frontend/src/services/api.js`, `frontend/src/components/project-workspace/ModelTrainingSection/*`
- Add `systemAPI.getHardware()` calling `/api/v1/system/hardware`.
- Add a toggle in the Preset or Identity area: `Device: CPU | GPU`.
- On selecting GPU: open a modal showing CUDA availability and a dropdown of GPUs; let user pick `gpuIndex`; store in form state.
- Disable GPU option if endpoint reports no GPUs.

## Result
- Users can see whether CUDA/GPU is available on their local machine and select which GPU to use for training.
- Stays within current architecture; minimal footprint.

## Notes
- No new router file; endpoint goes into `main.py` to follow “prefer editing existing file”.