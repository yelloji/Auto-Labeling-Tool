# Ultralytics Version Notes

## Required Version

```
ultralytics >= 8.4.0
Tested on: 8.4.23
```

To update your venv:
```
pip install ultralytics==8.4.23
```

---

## Why 8.4.0+ is Required

YOLO26 models (`yolo26n.pt`, `yolo26s.pt`, `yolo26n-seg.pt`, `yolo26s-seg.pt`) were introduced
in ultralytics 8.4.x. Earlier versions (8.3.x) will raise `FileNotFoundError` when trying to
load or download YOLO26 weights.

---

## Breaking Changes from 8.3.x → 8.4.x (and our fixes)

### 1. Training output directory — `api_routes.py`

**What changed:** `get_save_dir()` in 8.4.x prepends `runs/{task}/` to any relative `project`
path in the training YAML. A relative path like `projects/gevis/model/training` would resolve
to `runs/segment/projects/gevis/model/training` instead.

**Fix:** Use absolute path for `resolved_config['train']['project']` in `api_routes.py`.
DB paths (`ts.run_dir`, `ts.weights_dir`, etc.) remain relative — they are set separately.

---

### 2. Training log format — `metrics_parser.py`

**What changed:** Ultralytics 8.4.x switched from plain tqdm (`|##########|`) to rich terminal
renderer. The log file now contains:

- `\x1b[K` ANSI erase-line codes at the start of each progress line
- `━━──` box-drawing progress bars instead of `|####|`
- `\r` carriage returns between batch updates (multiple updates per physical line)
- **New `sem_loss` column** in segmentation training output (between `dfl_loss` and `Instances`)

**Old format (8.3.x segmentation):**
```
Epoch  GPU_mem  box_loss  seg_loss  cls_loss  dfl_loss  Instances  Size
  1/3    2.05G     2.359     5.076     4.834     1.757         37   768:  3%|2  | 1/35
```

**New format (8.4.x segmentation):**
```
Epoch  GPU_mem  box_loss  seg_loss  cls_loss  dfl_loss  sem_loss  Instances  Size
\x1b[K   1/5    1.74G     2.333     3.465     5.693    0.008071     7.121       57  640: 6%
```

**Fix:**
- Strip ANSI codes with `re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', line)` before parsing
- Segmentation regex: added optional `sem_loss` group between `dfl_loss` and `Instances`
- Detection log format: **unchanged** — no `sem_loss` column in detection (confirmed)

---

### 3. sem_loss — what it is

| | sem_loss |
|---|---|
| **Present in** | Segmentation tasks only (8.4.x+) |
| **YOLO26 value** | Non-zero (e.g. 7.121) — semantic supervision is active |
| **YOLO11 value** | Always 0 — column present but unused |
| **Detection** | Not present at all |
| **Configurable?** | No — hardcoded as `BCEDiceLoss(weight_bce=0.5, weight_dice=0.5)` in `loss.py` |

---

### 4. DFL loss scale difference — YOLO26 vs YOLO11

YOLO26 sets `reg_max: 1` (vs YOLO11 default `reg_max: 16`). With only 1 DFL bin, the
distribution focal loss is near-trivial by design — YOLO26's NMS-free end-to-end head directly
regresses coordinates. A very low `dfl_loss` (~0.008) from epoch 1 is expected and correct.

---

## Model Summary

| Model | Task | File | Size |
|---|---|---|---|
| YOLO26 Nano | Object Detection | `yolo26n.pt` | ~5MB |
| YOLO26 Small | Object Detection | `yolo26s.pt` | ~23MB |
| YOLO26 Nano Seg | Instance Segmentation | `yolo26n-seg.pt` | ~6MB |
| YOLO26 Small Seg | Instance Segmentation | `yolo26s-seg.pt` | ~23MB |

Models auto-download on first backend start via `model_manager.py → _download_default_models()`.

---

## YOLO26 Architecture Notes

- **NMS-free end-to-end** — no post-processing needed
- **MuSGD optimizer** — recommended (auto-selected by Smart Auto when YOLO26 detected)
- **43% faster CPU inference** vs YOLO11
- **Best with large datasets** (500+ images, 50+ epochs) — YOLO11 converges faster on small data
- **reg_max: 1** — DFL is simplified; cls_loss and sem_loss carry more training signal
