# Inspection Runtime - Calibration Core Report

## Status

- Date: 2026-07-21
- Task: Task 4 - Calibration core
- Dataset: `V:\NEW-DISC\image-reconstruction-app\images\10%`
- Input policy: read-only
- Result: provisional development calibration succeeded

This calibration uses the 10-percent JPEG-compressed development copies. It must be repeated for production acceptance with the original-quality acquisitions.

## Implemented calibration model

The core estimates one fixed disc rotation centre from robust adjacent-frame similarity transforms. It accepts evidence only when all of these conditions hold:

- pair is an expected numeric neighbor, including the possible `16 -> 1` pair;
- apparent rotation is within 2.0 degrees of -22.5 degrees in the documented image-coordinate convention;
- estimated scale is between 0.995 and 1.005;
- at least five RANSAC inliers exist;
- median full-resolution inlier residual is no greater than 4 pixels;
- the inferred rotation centre agrees with the robust common centre.

At least five reliable pairs are required. Weak pairs are reported and excluded; they are never forced into the calibration.

The calibration records the source ROI, off-frame disc centre, measured radial band, reference ray, native-resolution output geometry, forward and inverse matrices, and lens model. Output JSON is stable and sorted, saved atomically, and reloads through the strict Task 3 schema.

## Real-dataset result

The real read-only run used all 16 frames in numeric order at quarter resolution for feature measurement, while converting residuals and geometry back into full-resolution pixels.

| Measurement | Result |
|---|---:|
| Accepted reliable pairs | 11 |
| Source disc centre | `(3528.13, -10651.79)` px |
| Maximum retained centre spread | `113.03` px |
| Median accepted pair residual | `2.27` px |
| Provisional usable source ROI | `x=0, y=900, width=6560, height=4048` |
| Continuously covered radial band | `11826-15597` px |
| Native output canvas | `31197 x 31197` px |
| Source reference ray | `91.0471` degrees |
| Lens-distortion model | `none` |

Accepted pairs:

`1->2`, `4->5`, `5->6`, `6->7`, `7->8`, `10->11`, `11->12`, `12->13`, `13->14`, `14->15`, `15->16`

Rejected calibration evidence:

- `2->3`: unconstrained texture fit selected an incorrect rotation.
- `3->4`: unconstrained texture fit selected an incorrect rotation.
- `8->9`: valid local rotation evidence but its independently inferred centre was an outlier.
- `9->10`: unconstrained texture fit collapsed to an invalid scale/rotation.
- `16->1`: unconstrained texture evidence was insufficient for calibration.

These rejections do not mean frames are missing. Task 2's constrained audit found continuity across all five boundaries. They mean the fixed camera calibration must be learned from reliable pairs, while Task 6 must validate the weak seams and loop closure through the fixed model plus independent evidence.

## Diagnostic artifacts

The development verification produced temporary, untracked artifacts:

- `C:\tmp\inspection-runtime-task4-20260721\calibration.json`
- `C:\tmp\inspection-runtime-task4-20260721\calibration-overlay-frame-1.png`

The overlay shows the accepted source ROI, radial limits, and direction toward the off-frame centre. These files are diagnostics only and are not application or source data.

## Memory and output implication

A native `31197 x 31197` RGB canvas contains approximately 973 million pixel locations. A dense 8-bit RGB buffer alone would require about 2.92 GB, before masks, blending weights, provenance, or intermediate arrays. The valid annular band contains approximately 325 million pixels and is still large.

Task 5 and later compositing must therefore use tiled or memory-mapped processing and a tiled BigTIFF-compatible output path. The implementation must not allocate several complete full-resolution floating-point canvases in memory.

## Verification

- Contract and calibration suites: 21 tests passed.
- Deterministic JSON serialization and reload: passed.
- Atomic save and path-containment rejection: passed.
- Invalid geometry, insufficient evidence, unsafe paths, and incorrect image dimensions: rejected by tests.
- Real accepted median residual `2.27 px`: passed the Task 2 `<=4 px` threshold.
- Diagnostic overlay: generated and visually inspected.
- Source image modifications: none.

Task 5 integration initially showed that using the ROI's nearest and farthest points as radial limits covered only 91.14 percent of the complete nominal annulus. The calibration rule was therefore tightened to the largest radial interval visible across every ray in a complete 22.5-degree source sector, with a two-pixel inward safety margin. Recalibration produced the corrected `11826-15597` pixel band and Task 5 verified 100 percent sampled nominal coverage. The earlier wider band is rejected.

## Remaining limits

- The ROI is provisional and derived from the development audit; production calibration must confirm it.
- Physical millimetre scale remains unknown.
- Lens distortion is not enabled without systematic evidence.
- Fine seam registration, weak-pair recovery, and global `16 -> 1` closure belong to Task 6.
- This task does not reconstruct or composite the disc.
