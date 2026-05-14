# Tile Project Mode & SAHI Prediction — Implementation Reference

This document is the single source of truth for the Tile-enabled project feature and SAHI sliding window prediction.
Written from real discussion + notebook analysis + ultralytics official docs.

---

## Background & Problem

- User projects have very large images: e.g. 5000×6000 pixels
- YOLO cannot train on images this large directly — too big, breaks training
- Objects (cracks, defects) may span only part of the image and appear at one side
- Solution already partially built: **Tile transformation** in Release splits images into N×M grids
- New problem: after tiling (e.g. 3×3 = 9 tiles per image), most tiles are empty (no label)
  - Example: 1 crack tile out of 9 = 88% empty tiles
  - Feeding this directly to YOLO = heavily imbalanced dataset = poor training
- Prediction problem: YOLO trained on tiles cannot run inference on a full 5000×6000 image directly
  - Need sliding window (SAHI) to run tile-sized inference windows across the full image and merge results

---

## Feature Overview

Three linked features, all gated on a single project-level flag: `tile_enabled`

| Feature | Where | When shown |
|---|---|---|
| `tile_enabled` toggle | Project creation | Always (default: disabled) |
| Tile Balance Tool | Release Detail View | Only when `tile_enabled = true` |
| SAHI Sliding Window Prediction | Prediction UI | Only when `tile_enabled = true` |

---

## Feature 1 — `tile_enabled` Project Flag

### At project creation
- Current options: `Object Detection` / `Segmentation`
- New addition: **Tile** toggle switch — default = **disabled**
- When enabled: marks the project as a tile-type project permanently

### Rules
- `tile_enabled` is **locked after creation** — cannot be toggled on an existing project
- This is intentional — tile and non-tile workflows are fundamentally different
- No migration tool needed inside the app

### Migration path for existing labeled projects
If a user already labeled images in a normal project and wants to use tiling:
1. Create a **new project** with `tile_enabled = true`
2. Use **Upload → "Select Folder (images + labels)"** — imports images + YOLO `.txt` annotations + `data.yaml`
3. Images land in dataset with labels already attached — no re-labeling needed
4. Proceed to Release → apply Tile transformation → create tiled release
5. Use Tile Balance Tool → create balanced release → train YOLO

The user cannot continue annotating in the new project (indirect import), but they don't need to — labeling is already done.

### DB change
- Add `tile_enabled = Column(Boolean, default=False)` to `Project` model
- Migration: `ALTER TABLE projects ADD COLUMN tile_enabled BOOLEAN DEFAULT 0`

---

## Feature 2 — Tile Balance Tool (opened from Release Detail View)

### Problem it solves
After a release is created with Tile transformation:
- 3×3 tile grid = 9 tiles per original image
- Only 1–2 tiles may have labels (crack at one corner)
- Remaining 7–8 tiles = empty (background only)
- Direct YOLO training on this = extreme class imbalance

### Where it lives
- Entry point is **Release Detail View**
- User clicks a dedicated **`Tile Balance`** button
- That button opens a **new Tile Balance workspace**
- Only visible when `project.tile_enabled = true`
- Does NOT appear for non-tile projects

### UI flow
1. User opens an existing tiled release in **Release Detail View**
2. User clicks **`Tile Balance`**
3. App opens a dedicated **Tile Balance workspace** for that parent release
4. Top summary shows:
   - Total labeled tiles
   - Total unlabeled tiles
   - Selected tiles count
   - Final expected release total
5. User chooses one of two modes:
   - **Automatic Balance**
   - **Manual Selection**
6. User creates a **new balanced child release ZIP** from the existing tiled release
7. New balanced release appears in Release History — ready to use for YOLO training

### UX design direction
- This should be a **premium tool workspace**, not a basic admin form
- Tile thumbnails are the main surface
- Viewing pattern should match existing release-detail behavior:
  - small thumbnails for scanning
  - click thumbnail -> open large image viewer
- Parent release stays untouched; balanced output is always a child release

### Automatic Balance mode
- Keeps all labeled tiles automatically
- User chooses unlabeled keep ratio:
  - `1:0.5`
  - `1:1`
  - `1:2`
  - `1:3`
- User chooses output tile size:
  - `640`
  - `896`
- Live preview shows:
  - labeled tiles kept
  - unlabeled tiles to be kept
  - final balanced release total

### Manual Selection mode
- Two tabs:
  - **Labeled Tiles**
  - **Unlabeled Tiles**
- **Labeled Tiles tab**
  - Shows labeled tiles only
  - All selected by default
  - User can deselect bad labeled tiles if annotations are not correct
- **Unlabeled Tiles tab**
  - Shows unlabeled tiles only
  - User manually selects which unlabeled tiles to include
- Both tabs use:
  - small thumbnail grid
  - split badge (`train` / `val` / `test`)
  - click thumbnail -> open large viewer
- Summary stays visible while selecting:
  - selected labeled count
  - selected unlabeled count
  - final child release total

### Key rules
- Source tiles come from the existing release ZIP (already created with Tile transformation)
- The new balanced release is a child of the original tiled release
- Child linkage uses `parent_release_id`
- Original tiled release is NOT modified
- Balance is applied per split independently (train tiles balanced separately from val tiles)
- Random selection of unlabeled tiles is reproducible if needed (seeded random)

### Important pause before continuing Tile Balance
- Tile Balance UI/workspace can exist, but **it is NOT the current priority**
- Real investigation showed the deeper problem is in **tile release creation quality**
- Many tiled outputs are currently considered "labeled" only because their `.txt` files are non-empty
- In reality, many of those labels are just tiny clipped leftovers from a larger original annotation
- So Tile Balance is currently operating on already-noisy tile releases
- Correct order:
  1. Fix tile release creation quality
  2. Verify original + augmented tile annotation quality
  3. Return to Tile Balance after tile output is trustworthy

### What the real tile-release issue is
- Current tile export behavior is effectively:
  - if an original annotation intersects a tile,
  - keep the clipped annotation piece for that tile
- This is too permissive
- It creates many weak edge fragments that are technically non-empty labels but are not meaningful training signals
- Example: one long crack on the original image may become:
  - one or two meaningful tile segments
  - plus several tiny clipped leftovers at tile borders
- Those tiny leftovers should not become training labels

### Correct mental model for tile annotation filtering
- We must judge each tile annotation **relative to the original annotation it came from**
- Not:
  - "tile has any annotation"
- But:
  - "how much of the original annotation survived into this tile?"
  - "is the surviving piece still meaningful?"

### Safe first-rule shape for tile annotation filtering
- Apply this only to **tile release creation**
- Do NOT change global non-tile annotation transformation behavior
- Keep a tiled annotation only if:
  - enough of the original annotation remains inside the tile
  - and the remaining piece is not too tiny / too weak
- For crack-like long thin classes, area alone may be misleading
- So first implementation should use:
  - preserved ratio versus original annotation
  - plus minimum size/span check
- This must apply to:
  - original tiled outputs
  - augmented tiled outputs too

### Tile grid safety cap
- Current product decision:
  - maximum tile split allowed = **6 × 6**
- Reason:
  - higher grids (e.g. 10 × 10) create excessive fragmentation and noisy clipped labels
- UI and backend validation for tile transform should both follow this limit

### Why this is the right approach
- YOLO trains best with a balanced mix of positive (labeled) and negative (background) tiles
- 1:1 = aggressive balance, forces model to focus on labeled regions
- 1:2 = softer balance, gives more background context
- Developer chooses ratio based on how sparse the defects are

---

## Feature 3 — SAHI Sliding Window Prediction

### Problem it solves
- Model was trained on 640×640 or 896×896 tiles
- Inference input must match training input size
- Cannot run the model directly on a 5000×6000 image
- Solution: SAHI (Slicing Aided Hyper Inference) — slides a window across the full image, runs model on each window, merges all detections back onto the full image

### Where it lives
- **Prediction UI** — new option visible only when `project.tile_enabled = true`
- Normal prediction UI (existing) stays unchanged for non-tile projects
- For tile projects: SAHI prediction replaces/supplements normal prediction

### SAHI library
- Package: `sahi` (separate from ultralytics — must be installed)
- Ultralytics has NO native SAHI support — `sahi` package is the standard integration
- Add to `requirements-cuda121.txt`: `sahi>=0.11.0`
- ultralytics model is used as the detection backend inside SAHI

### Correct code pattern (from official ultralytics docs + user notebook)

```python
from sahi import AutoDetectionModel
from sahi.predict import get_sliced_prediction

# Load model once (reuse across images)
detection_model = AutoDetectionModel.from_pretrained(
    model_type="ultralytics",
    model_path="path/to/best.pt",
    confidence_threshold=0.5,
    device="cuda:0",  # or "cpu"
)

# Run per image — sliced inference
result = get_sliced_prediction(
    "path/to/full_original_image.jpg",
    detection_model,
    slice_height=896,
    slice_width=896,
    overlap_height_ratio=0.25,
    overlap_width_ratio=0.25,
)

# Save annotated result image
result.export_visuals(export_dir="output/")

# Access detections programmatically
for pred in result.object_prediction_list:
    bbox = pred.bbox                  # bounding box
    class_name = pred.category.name  # class name
    confidence = pred.score.value    # confidence score
    mask = pred.mask                  # segmentation mask (when segmentation model)
```

### Key parameters (from user notebook — confirmed working)
| Parameter | Default | Notes |
|---|---|---|
| `slice_height` | 896 | Must match training tile size |
| `slice_width` | 896 | Must match training tile size |
| `overlap_height_ratio` | 0.25 | 25% overlap between windows |
| `overlap_width_ratio` | 0.25 | 25% overlap between windows |
| `model_confidence_threshold` | 0.5 | Detection confidence cutoff |
| `postprocess_match_threshold` | 0.3 | NMS merge threshold for overlapping detections |
| `postprocess_class_agnostic` | True | Merge overlapping boxes regardless of class |
| `no_standard_prediction` | True | Skip full-image pass, sliced only |
| `device` | cuda:0 | GPU or CPU |

### Input images
- **Full original images** — NOT the tiled release dataset
- User selects images from the project (existing uploaded images) or uploads new full images
- Same image selection flow as existing normal prediction

### Segmentation support
- SAHI works for **both object detection and segmentation** — same code
- When a segmentation model is used: `pred.mask` contains polygon/mask data
- No code change needed — SAHI handles both task types automatically
- Confirmed: user's notebook ran segmentation inference with SAHI successfully

### Integration into our app architecture
- Do NOT use `predict()` batch function (saves to random folder, not integrated)
- Use `get_sliced_prediction()` per image — we control output
- Create `backend/models/prediction/sahi_prediction_executor.py`
  - Same subprocess pattern as existing `prediction_executor.py`
  - Parameters passed via JSON file (same as `prediction_inputs.json` pattern)
  - Results saved to our experiment folder in the standard format
  - Status polled same way as normal prediction

### Result storage
- Results saved into `model_experiments` table — same as normal prediction
- Annotated images saved to experiment output folder
- Detection data (bbox / class / confidence / mask) saved in same JSON format as normal prediction
- `experiment_type = 'sahi_prediction'` to distinguish from normal prediction in analytics

### Analytics
- Normal prediction analytics (existing): works on tile-sized images, existing UI unchanged
- SAHI prediction analytics (new): works on full original images
  - Detection count per image
  - Class distribution
  - Confidence distribution
  - Full annotated image viewer (shows detections on the original 5000×6000 image)

---

## What is NOT changing

- Normal prediction UI — completely unchanged for all non-tile projects
- Existing tile transformation — no changes to how tiles are created in Release
- Existing release creation flow — no changes
- Existing training flow — no changes (balanced release ZIP feeds training same as any other release)
- Existing annotation / labeling — no changes
- Manual labeling on full large images stays the same (label on full image, tile in release)

---

## Implementation Order (updated)

1. ✅ DB: `tile_enabled` column on `projects` table — `9135b8a`
2. ✅ Project creation UI: add Tile toggle — `9135b8a`
3. ✅ Dynamic UI gating: Tile tool hidden in Basic Transformations for non-tile projects — `80cf311`
4. ✅ Visual indicators: teal icon + Tile tag on project card and workspace sidebar — `ece1920`
5. ✅ Bug fix: project deletion now cascade-deletes releases + training sessions — `466d1c2`
6. ✅ Fix tile release creation quality first — `8d39095`, `415c629`, `5eaa39a`
   - traced exact tile image creation and tile annotation split path
   - added tile-only annotation quality filtering
   - compared clipped tile piece to original annotation
   - dropped weak clipped leftovers
   - applied to original and augmented tiled outputs
   - added `6 × 6` max tile grid validation
7. ✅ Re-verify tile release outputs visually on real crack examples
8. ✅ Resume Tile Balance Tool backend: analyze tiled release ZIP, compute meaningful labeled/unlabeled counts, support manual/auto selection, create balanced child release (`parent_release_id`) — `a09b862`
9. ✅ Resume Tile Balance Tool frontend polishing — `021a53c`, `2aed874`
10. [ ] SAHI prediction executor: `sahi_prediction_executor.py` subprocess
11. [ ] SAHI prediction backend: new endpoints (start / status / results)
12. [ ] SAHI prediction frontend: prediction UI for tile projects
13. [ ] SAHI analytics frontend: full-image result viewer and stats
14. [ ] Add `sahi>=0.11.0` to `requirements-cuda121.txt`

## Implementation Notes

### tile_enabled wiring (completed)
- `backend/database/models.py` — `tile_enabled = Column(Boolean, default=False)` on `Project`
- `backend/database/database.py` — `ALTER TABLE projects ADD COLUMN tile_enabled BOOLEAN DEFAULT 0` on startup
- `backend/database/operations.py` — `create_project()` accepts and saves `tile_enabled`
- `backend/api/routes/projects.py` — `ProjectCreateRequest`, `ProjectResponse`, and all 3 response construction sites include `tile_enabled`
- `frontend/src/pages/Projects.js` — Switch toggle in project creation modal; teal thumbnail + Tile tag on card
- `frontend/src/pages/project-workspace/ProjectWorkspace.js` — teal thumbnail + Tile tag in sidebar header
- `frontend/.../ReleaseSection.jsx` — passes `tileEnabled={!!project?.tile_enabled}` to TransformationSection
- `frontend/.../TransformationSection.jsx` — accepts `tileEnabled` prop, passes to TransformationModal
- `frontend/.../TransformationModal.jsx` — adds `"tile"` to `hiddenTransformations` when `!tileEnabled`

### Project deletion bug fixed
- Root cause: `delete_project()` only deleted labels, leaving releases + training sessions orphaned in DB
- When new project gets same auto-increment ID, it inherits orphaned records
- Fix: delete model_experiments → training_sessions → releases → labels → project (in order)
- Confirmed working: `discs-sahi` project cleaned up, 7 releases + 1 training session removed

---

## Dependencies

| Package | File | Note |
|---|---|---|
| `sahi>=0.11.0` | `requirements-cuda121.txt` | Core SAHI inference library |
| `ultralytics` | already present | Used as detection backend inside SAHI |

---

## Key Decisions Summary

| Decision | Choice | Reason |
|---|---|---|
| `tile_enabled` locked after creation | Yes | Tile and non-tile workflows are fundamentally different |
| Migration path | New project + images+labels upload | Reuses existing upload path, no extra feature needed |
| SAHI input | Full original images | Tiled release images defeat the purpose of SAHI |
| SAHI function | `get_sliced_prediction()` | Programmatic control, integrates into our experiment system |
| Segmentation support | Yes | SAHI handles both, confirmed by user notebook |
| Balance ratio options | 1:0.5, 1:1, 1:2, or 1:3 | Developer chooses based on defect density |
| Balance output size | 640 or 896 | Developer chooses to match training requirements |
