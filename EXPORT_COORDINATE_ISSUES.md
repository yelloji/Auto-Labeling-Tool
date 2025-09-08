# Export Coordinate Issues — Investigation and Resolution

Status: Draft (for review)
Owner: Backend Release/Annotations
Last Updated: <set by reviewer>

## 1) Purpose
Ensure all exported labels (YOLO detection and YOLO segmentation) are geometrically correct after any combination of transforms (resize, flip, rotate) in the release pipeline. This document tracks the problem statement, hypotheses, fixes, and validation.

## 2) Scope
- Release ZIP generation (original and augmented images)
- YOLO Detection labels (class cx cy w h)
- YOLO Segmentation labels (class x1 y1 x2 y2 …)
- Transforms: resize, flip (H/V), rotation (about image center)
- Data sources: DB annotations (x_min, y_min, x_max, y_max, segmentation)
- Core code: backend/core/annotation_transformer.py, backend/api/routes/releases.py

## 3) Current Symptoms
- Some polygon annotations produce empty `label.txt` files during segmentation exports (lines are skipped).
- Bounding boxes look misaligned after resize/transform (centers/widths/heights don’t match the transformed objects in images).

## 4) Working Theory (Hypotheses)
- S-NORM: In segmentation export, points are transformed to target image size, but then normalized by original dimensions (img_w/img_h) instead of target (target_w/target_h). This causes wrong scales whenever resize is enabled.
- S-FALLBACK: When `segmentation` is missing/invalid, no conversion from bbox→polygon occurs, so the whole label gets skipped, leading to empty files.
- D-NORM: Detection path math appears consistent (normalize by target dims after transforms). We will still re-verify to ensure there’s no width-1 off-by-one or inconsistent rounding.
- CONFIG SYNC: Resize/letterbox parameters must be identical between image pixels and label transforms for both originals and augmented images.

## 5) Data & Code Mapping
- DB model fields: `x_min, y_min, x_max, y_max` (bbox in pixels), `segmentation` (polygon points; can be JSON string, list of numbers, list of pairs, or list of {x,y}).
- Transformer functions of interest:
  - `transform_detection_annotations_to_yolo` — applies flip/resize/rotate, then normalizes by target dims.
  - `transform_segmentation_annotations_to_yolo` — parses polygon points, uses `transform_polygon_points`, then normalizes.
  - `_extract_bbox_pixels` — reads bbox from ORM/dict; converts normalized→pixels if needed.

## 6) Decisions & Fix Plan (Checklist)
- [ ] S1 Segmentation normalization: normalize transformed polygon points by `target_w/target_h` (not original `img_w/img_h`).
- [ ] S2 Segmentation fallback: if polygon missing/invalid or < 3 points, and a bbox exists, auto-generate rectangle polygon and export.
- [ ] D1 Detection normalization audit: confirm all divisions use `target_w/target_h` consistently (no `width-1`).
- [ ] R1 Config sync: ensure the exact resize parameters passed to image generation are also used for label transforms (original and augment paths).
- [ ] L1 Logging: log explicit reasons for skipped polygons and when bbox→polygon fallback is used (with class/image id context).
- [ ] V1 Visual verification: extend `debug_annotation_visualizer_folders.py` to overlay transformed bboxes/polygons over exported images; add a numeric spot-check.
- [ ] E2E End-to-end: run a tiny release and validate non-empty labels and coordinate correctness across cases below.

## 7) Reproduction Steps (Minimal)
1. Prepare a small dataset (e.g., car images) with both bbox and polygon annotations.
2. Configure a release with:
   - One run with no transforms (baseline)
   - One run with resize enabled (e.g., width=300, height=168), optional flips/rotation
3. Generate YOLO-seg and YOLO-det releases.
4. Inspect `labels/*.txt` and corresponding images; verify that:
   - Files are non-empty for annotated images
   - Coordinates align visually (overlay) and numerically (spot-checks)

## 8) Test Matrix (must pass)
- [ ] T1 No transforms (original dims) — det + seg
- [ ] T2 Resize only — det + seg
- [ ] T3 Flip H, Flip V — det + seg (with/without resize)
- [ ] T4 Rotation (±15°, ±30°) — det + seg (with/without resize)
- [ ] T5 Missing polygon with bbox present — seg should export rectangle polygon
- [ ] T6 Polygon formats:
  - flat list [x1,y1,...] in pixels
  - flat list normalized [x1n,y1n,...]
  - list of pairs [(x,y),...]
  - list of dicts [{x:…, y:…},...]
- [ ] T7 Multiple objects per image
- [ ] T8 Edge bboxes/polygons touching image borders

## 9) Expected Behavior (after fixes)
- Segmentation: transformed points are normalized by target size, producing correctly scaled YOLO-seg coordinates in [0,1].
- Fallback: if polygon data is unusable but bbox is present, we export a 4-corner polygon derived from the bbox and transformed identically.
- Detection: normalized with target dims; clamped to [0,1]; visually aligned with objects.
- Config sync: Image and label transforms use identical parameters; no drift between visuals and labels.

## 10) Implementation Notes
- Minimal code surface change in `backend/core/annotation_transformer.py`:
  - Update normalization denominators in segmentation path to `target_w/target_h` (derived from `transform_config.resize` when enabled; fallback to `img_w/img_h`).
  - Add bbox→polygon fallback using `_extract_bbox_pixels` and the same transform pipeline.
  - Add logging for skip/fallback cases with image/annotation context.
- Keep `releases.py` unchanged unless a pipeline-side fallback is also desired (not necessary if transformer handles it robustly).

## 11) Acceptance Criteria
- For each test in the matrix, 100% of annotated images have non-empty label files matching the count of objects exported.
- Visual overlay shows alignment within 1 pixel (after de-normalization) for non-rotated; within small tolerance for rotated boxes due to rounding.
- No systematic center/w/h drift after resize.
- Logs show zero unexpected skip reasons after fixes.

## 12) Rollout & Verification
- Implement fixes behind current interfaces; no API changes.
- Generate a tiny release and validate.
- Keep a revert plan (single-file changes) if needed.

## 13) Open Questions
- Confirm whether images are strictly resized (stretch) or letterboxed anywhere; if letterbox is introduced, denominators and offsets must include padding.
- Preferred permanent behavior when both polygon and bbox exist: always prefer polygon, fallback only when polygon invalid? (Proposed)
- Where to persist the verification overlay outputs (e.g., under `output/verification/…`).