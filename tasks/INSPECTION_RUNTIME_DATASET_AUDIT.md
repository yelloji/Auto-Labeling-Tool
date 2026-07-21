# Inspection Runtime - 16-Frame Dataset Audit

## Audit status

- Date: 2026-07-21
- Scope: read-only analysis of the first brake-disc reconstruction dataset
- Dataset: `V:\NEW-DISC\image-reconstruction-app\images\10%`
- Geometry reference: `V:\NEW-DISC\image-reconstruction-app\full-disk.jpeg`
- Application branch: `feature/inspection-runtime`
- Result: suitable for calibrated reconstruction; not suitable for blind panorama stitching

The user confirmed that the folder name `10%` identifies heavily JPEG-compressed development copies created to reduce implementation and trial time. It does not describe geometric overlap and it does not mean that the pixel dimensions were reduced. Production acceptance must later be repeated with the original-quality acquisitions.

No source image was renamed, moved, overwritten, recompressed, or copied into the application repository. No application code, dependency, configuration, or database was changed during this audit.

## Executive conclusion

The folder contains exactly 16 unique, ordered RGB JPEG acquisitions. All frames have the same 6560 x 4948 pixel geometry. The visible drilled holes and surface texture move continuously through the numbered sequence. A constrained image-registration check found the same rotation sign at every boundary, including the final `16 -> 1` closure.

The data supports 16 nominal positions separated by 22.5 degrees. Measured apparent increments range from 20.8 to 24.4 degrees before final camera calibration and total 357.9 degrees around the loop. This 2.1-degree pre-calibration closure residual is small enough to continue, but it must not be hidden by independent free-form warps.

The camera sees only a narrow close-up region and the inferred disc rotation centre lies well outside the image. Reconstruction therefore requires one reusable camera/disc calibration, a fixed valid source mask, nominal circular placement, and tightly bounded fine registration. Arbitrary per-pair homographies would risk bending cracks, duplicating holes, and hiding acquisition error.

## Acquisition contract verified

| Item | Finding |
|---|---|
| Frame count | Exactly 16 |
| Numeric order | Complete sequence 1 through 16; no missing or repeated number |
| Nominal step | 22.5 degrees |
| Nominal coverage | 16 x 22.5 = 360 degrees |
| Image-coordinate motion | Negative rotation from each numbered frame to the next |
| Physical clockwise/counterclockwise label | Must be attached to the acquisition-machine convention; image evidence alone establishes the sign in image coordinates |
| Source mutability | Inputs treated as read-only |
| Physical diameter | Unknown and not needed for pixel reconstruction; required later for millimetre measurements |

Image coordinates use origin at the top-left, x increasing right, and y increasing down. In that convention, the fitted source-to-next-frame transform has a negative rotation angle. This coordinate definition must be carried into the future transform schema.

## File inventory and integrity fingerprints

All source files are JPEG/JFIF 1.1, RGB, 6560 x 4948 pixels, with three 8-bit decoded channels. They contain no EXIF tags and no embedded DPI value. DPI therefore cannot be used as physical calibration.

| Frame | Filename | Bytes | SHA-256 |
|---:|---|---:|---|
| 1 | `1RGB-compensated_10.jpg` | 630210 | `35f1164bdde1fd1855d938fc6393b44ba9386143b95261f4d0557c8a58ab2c14` |
| 2 | `2RGB-compensated_10.jpg` | 634684 | `6dde5ca9813d4c675427334697a04ac7c7e24d406fbb523ded39a11f4b5ffc30` |
| 3 | `3RGB-compensated_10.jpg` | 621075 | `35f2c759136b68779a2bedfa0c4c7adca7ba66ea228f9bd1e33df5461a357442` |
| 4 | `4RGB-compensated_10.jpg` | 626968 | `2f6b12891e63f0bbc1491a6bde0c1093d31eca79d6cf8b3d4e34a7edcfa2bcac` |
| 5 | `5RGB-compensated_10.jpg` | 622140 | `c2f9fdd46bd7e5d94e83cfbbe286ca795e31148477d216f9280b6fcd20a01dc2` |
| 6 | `6RGB-compensated_10.jpg` | 659310 | `bbd962888adff5751738db0e10f6c52061819862bd1271bf4268467095463906` |
| 7 | `7RGB-compensated_10.jpg` | 655783 | `0d39bad6c1a4ba2a63683aab9ba2f3202ef8ca3cf23350b15eb642c8ab0055de` |
| 8 | `8RGB-compensated_10.jpg` | 607312 | `3190a9e55a3c02d2453db3485d93c025f63b2d430edc321007805a3111882ad9` |
| 9 | `9RGB-compensated_10.jpg` | 603745 | `61f33c496b480d87226995d657fbad2d6e0f62176996dccf0404eea0fc52c54f` |
| 10 | `10RGB-compensated_10.jpg` | 629326 | `613143280b77a8dfc87f47e07a865f436ca8c730c2a2a257754c5d692b96a556` |
| 11 | `11RGB-compensated_10.jpg` | 652744 | `2e280c50a9abb2462f2ca865bae4e3e82fb796ff8107a2d9aeaa81a2cfd92d19` |
| 12 | `12RGB-compensated_10.jpg` | 648878 | `959771a06c1b3557d443b0cb73dd60b76c977fc49c433c07c9b7ade5a71b353a` |
| 13 | `13RGB-compensated_10.jpg` | 634122 | `e4d2057908259a2205a8acf0fb5255b60bd1a1e0c525237fa40c94aaeb12138f` |
| 14 | `14RGB-compensated_10.jpg` | 636263 | `f08025362b8c56960f4db72f258b441d8bb14c8b7e6d73c89d04754fe27bcae9` |
| 15 | `15RGB-compensated_10.jpg` | 667732 | `0162a195922c66f38ed4e5d16633b5a9a7549cd821b392f9ed70d375f7dd6eed` |
| 16 | `16RGB-compensated_10.jpg` | 677951 | `13b58073ea0d8f26a46caa06c1b0c5a2cf3997dcf398820667a4b3ec81b3f996` |

The geometry reference is a 5120 x 2880 RGB JPEG, 1,220,062 bytes, with SHA-256 `a0a50f9c797379254ca31308701c343f726cdd7c9d25a09c1ff1760f316499c1`. It documents the intended 16-sector layout; it is not a pixel-registration target.

## Image consistency

The images have moderate, manageable photometric variation. Mean red spans 56.17-67.49, green 55.34-62.11, and blue 82.03-98.13 on the decoded 0-255 scale. Grayscale median is 58 for most frames, with frames 2 and 3 slightly darker at 51 and 52. This supports seam-local exposure compensation, but not destructive global normalization of source files.

Quarter-resolution Laplacian variance ranges from 123.8 to 229.5. Frames 8 and 9 are the softest, but still retain matching surface structure. The value is a relative diagnostic for this dataset, not an absolute camera-focus measurement.

| Frame | Mean RGB | Gray median | Relative sharpness |
|---:|---:|---:|---:|
| 1 | 62.47, 57.15, 88.53 | 58 | 161.6 |
| 2 | 62.64, 55.34, 85.82 | 51 | 164.4 |
| 3 | 62.44, 55.59, 82.60 | 52 | 147.5 |
| 4 | 62.04, 58.66, 86.65 | 58 | 154.5 |
| 5 | 63.91, 57.43, 88.24 | 58 | 145.3 |
| 6 | 67.49, 58.42, 89.75 | 58 | 190.8 |
| 7 | 60.54, 58.20, 91.73 | 58 | 190.4 |
| 8 | 60.36, 62.11, 87.68 | 58 | 123.8 |
| 9 | 66.46, 58.16, 82.03 | 58 | 125.2 |
| 10 | 61.07, 57.77, 89.06 | 58 | 161.1 |
| 11 | 61.89, 56.04, 87.18 | 58 | 197.0 |
| 12 | 56.17, 59.39, 88.85 | 58 | 184.8 |
| 13 | 63.83, 62.11, 89.67 | 58 | 164.1 |
| 14 | 61.41, 57.35, 98.13 | 58 | 177.7 |
| 15 | 59.04, 57.25, 89.98 | 58 | 219.6 |
| 16 | 63.31, 56.75, 87.30 | 58 | 229.5 |

## Neighbor geometry and loop closure

The audit used two reduced-resolution checks: SIFT texture correspondences with similarity-transform RANSAC, followed by a constrained rotation search around the common centre inferred from reliable fits. The non-disc upper band was excluded.

Reliable unconstrained fits consistently produced scale near 1.000 and a common quarter-resolution rotation centre near `(883, -2666)`, above the captured frame. This is physically consistent with a close-up camera viewing only a sector. Weak unconstrained pairs were not accepted blindly; the common-centre model was used to check them.

| Pair | Apparent increment | Constrained valid-field overlap | Audit result |
|---|---:|---:|---|
| 1 -> 2 | 23.5 deg | 12.2% | Consistent |
| 2 -> 3 | 23.2 deg | 13.1% | Consistent under common-centre constraint |
| 3 -> 4 | 24.4 deg | 9.4% | Consistent under common-centre constraint |
| 4 -> 5 | 22.9 deg | 14.1% | Consistent |
| 5 -> 6 | 22.9 deg | 14.1% | Consistent |
| 6 -> 7 | 22.2 deg | 16.2% | Strong texture support |
| 7 -> 8 | 20.9 deg | 20.3% | Strong texture support |
| 8 -> 9 | 22.2 deg | 16.2% | Consistent under common-centre constraint |
| 9 -> 10 | 20.8 deg | 20.6% | Consistent under common-centre constraint |
| 10 -> 11 | 20.9 deg | 20.3% | Strong texture support |
| 11 -> 12 | 21.2 deg | 19.3% | Consistent |
| 12 -> 13 | 20.8 deg | 20.6% | Strong texture support |
| 13 -> 14 | 22.9 deg | 14.1% | Consistent |
| 14 -> 15 | 23.0 deg | 13.7% | Consistent |
| 15 -> 16 | 22.3 deg | 15.9% | Strong texture support |
| 16 -> 1 | 23.8 deg | 11.2% | Closure consistent under common-centre constraint |

Summary: mean increment 22.37 degrees, median 22.6 degrees, range 20.8-24.4 degrees, and accumulated loop 357.9 degrees. Overlap is measured against the complete rectangular camera field after excluding the upper non-disc band; it is not the final overlap percentage of the calibrated annular output.

The folder name `10%` describes the development JPEG compression setting, not a guaranteed geometric overlap. Final usable overlap must be recalculated after the source ROI and disc annulus are calibrated.

## Landmark findings

- Multiple drilled holes are visible and move continuously through numeric order.
- Surface scratches and machining texture supply more local correspondences than holes alone.
- Hole-only automatic detection is insufficient as the sole method because holes can be cropped, visually similar, or affected by reflections.
- Registration should combine the calibrated rotation model, hole geometry, and robust texture evidence.
- A diagnostic overlay must show selected hole and texture correspondences for every seam.

## Calibration and distortion decision

A fixed camera-to-disc calibration is required. It must identify the usable source ROI, disc rotation centre, inner and outer valid radii, image-1 reference ray, angle sign, a single mapping reused for all frames, and per-pixel validity/provenance.

Current evidence supports a constrained near-rigid rotation model: reliable similarity fits have scale close to 1.000 and a stable remote rotation centre. It does not justify 16 independent homographies.

Lens-distortion correction is not yet proven necessary because there is no calibration target or lens metadata. Task 4 must compare residuals across the field. Distortion correction may be enabled only if one calibrated model measurably improves residuals without deforming disc features. A projective plane correction likewise requires systematic evidence.

## Proposed provisional quality gates

These measurable starting gates are derived from this dataset. Task 4 may tighten them with documented evidence, but must not silently loosen them.

### Input integrity

- Exactly 16 readable files mapped once to frame numbers 1-16.
- Every frame decodes as RGB at 6560 x 4948 pixels.
- No duplicate SHA-256 fingerprints.
- The manifest preserves original filename, byte length, hash, frame number, and nominal angle.
- Source hashes match before and after reconstruction.

### Geometry

- Nominal placement remains exactly 22.5 degrees per acquisition.
- Fine registration may correct angle only within +/-2.0 degrees of nominal without explicit calibration review. Observed pre-calibration deviations are -1.7 to +1.9 degrees.
- Per-frame scale is fixed at 1.000 by the calibrated model. A diagnostic estimate outside 0.995-1.005 fails validation rather than authorizing free rescaling.
- A high-confidence texture fit should have median inlier residual no greater than 4 full-resolution pixels. Reliable audit fits measured approximately 2.2-3.3 pixels after scaling.
- Every neighbor and `16 -> 1` reports angle correction, residual, evidence count, overlap, and confidence. A weak pair is a visible failure unless supported by the fixed model plus independent hole/texture evidence.
- Loop closure is evaluated globally; sixteen independent seam corrections may not force closure by moving one physical feature inconsistently.

### Coverage and seams

- Every pixel in the approved output annulus has at least one valid source contributor.
- Every input frame contributes valid measured pixels.
- Each calibrated neighbor retains at least 8 percent valid-field overlap; observed pre-calibration minimum is 9.4 percent.
- No drilled hole is cut, duplicated, or omitted at a seam.
- Exposure compensation is overlap-local and reversible; source pixels are never rewritten.
- Composite sharpness in seam diagnostics does not fall below 85 percent of the sharper contributing patch without a warning.
- The reconstruction preserves a per-pixel source/provenance map and coverage-count map.

## Risks to carry forward

1. Frames 8 and 9 are relatively softer and require careful seam review.
2. Pairs 2->3, 3->4, 8->9, 9->10, and 16->1 have weaker unconstrained texture evidence and must not be silently accepted.
3. The remote rotation centre amplifies small angular errors into large close-up pixel shifts.
4. The upper non-disc region can create false stationary features unless masked.
5. JPEG compression and color compensation mean photometric differences are not geometry.
6. No embedded physical scale or lens calibration is present.
7. Numeric sharpness, texture-match, file-size, and runtime baselines from these compressed development copies are provisional. Final acceptance thresholds must be confirmed against the original-quality production acquisitions.

## Task 2 acceptance result

- All 16 frames accounted for exactly once: PASS
- Sequence sign supported by image evidence: PASS in the defined image-coordinate system
- Neighbor continuity including 16->1: PASS for proceeding to calibration
- Required calibration inputs identified: PASS
- Measurable initial thresholds defined: PASS
- Source files unchanged: PASS
- Ready for uncalibrated final reconstruction: NO
- Ready for Task 3 data-contract design after user approval: YES
