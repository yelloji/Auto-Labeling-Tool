# Current TODO

## Active Branch
feature/professional-logging-system

## Next Task
Phase 2 — Task 5: Electron Setup
Wrap React frontend in Electron window so app opens like a normal Windows program.

## Upcoming
- Task 6: PyInstaller — bundle Python + FastAPI into exe
- Task 7: Installer — single .exe via electron-builder
- Task 8: Data folder — AppData\Local\YourApp\

## Completed This Branch
- [x] ultralytics 8.4.x — ANSI codes + sem_loss log parsing fix (metrics_parser.py)
- [x] YOLO26 support — MuSGD optimizer, model download, training config
- [x] sem_loss UI display in LiveTrainingDashboard (YOLO26 segmentation only)
- [x] prediction image names broken (result.path → batch_chunk[result_idx])
- [x] batch size from UI never forwarded to predictor (api_routes.py)
- [x] device hardcoded '0' — now auto-detects GPU/CPU (predictor + validator)
- [x] requirements pinned: ultralytics==8.4.23
