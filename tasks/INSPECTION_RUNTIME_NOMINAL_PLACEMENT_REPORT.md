# Inspection Runtime - Nominal Circular Placement Report

## Status

- Date: 2026-07-21
- Task: Task 5 - Nominal circular placement
- Dataset: 16 JPEG-compressed development acquisitions
- Result: nominal placement passed

## Implemented behavior

The placement core builds exactly one transform for every acquisition frame. Frame 1 is placed at 0 degrees. Frames 2 through 16 use the exact nominal sequence through 337.5 degrees.

Because the observed source-to-next-image motion is negative in the documented top-left image coordinate system, placement applies the inverse positive nominal rotation to return every acquisition to the frame-1 disc orientation. Every transform contains both source-to-reconstruction and reconstruction-to-source 3x3 matrices.

The implementation also provides:

- unique per-frame reconstruction-mask paths;
- point mapping through homogeneous matrices;
- clipped output bounds for each frame;
- ROI and annulus validity evaluation in bounded output tiles;
- a 1,048,576-pixel maximum tile guard;
- deterministic, atomic `transforms.json` persistence and safe reload;
- rejection of mismatched inspection IDs, non-validated calibration, unsafe paths, unsafe tiles, and inconsistent input geometry.

No full-size reconstruction image or mask is allocated by this task.

## Real-data verification

The initial placement check correctly exposed that the first provisional radial limits covered only 91.14 percent of the nominal annulus. Those limits used the nearest and farthest ROI points and were too wide near the corners. They were rejected.

The calibration was corrected to use only the radial interval visible throughout a complete 22.5-degree sector. With a two-pixel inward safety margin, the accepted geometry is:

| Measurement | Result |
|---|---:|
| Inner valid radius | `11826 px` |
| Outer valid radius | `15597 px` |
| Native output canvas | `31197 x 31197 px` |
| Transform records | `16` |
| Unique frame numbers | `16` |
| Unique source hashes | `16` |
| Unique transformed bounds | `16` |
| Maximum matrix round-trip error | `5.46e-12 px` |
| Sampled annular coverage | `100%` |
| Sampled uncovered annulus pixels | `0` |
| Coverage count inside annulus | `1-2` source frames |
| Per-frame sampled contribution | `26708-26855` pixels |

The 1024 x 1024 diagnostic samples the complete native output geometry without allocating the native canvas. Dark blue regions have one source contributor and green regions have two overlapping contributors. No magenta uncovered region remains.

## Temporary diagnostic artifacts

- `C:\tmp\inspection-runtime-task5-20260721\transforms.json`
- `C:\tmp\inspection-runtime-task5-20260721\nominal-coverage-preview.png`

These are untracked development diagnostics and not production inspection outputs.

## Verification

- Schema, calibration, and placement suites: 31 tests passed.
- Exact frame order and angles: passed.
- Physical-point agreement between frame 1 and rotated frame 2: passed.
- Forward/inverse round trips for every frame: passed.
- Tile-bounded mask generation and memory guard: passed.
- Deterministic serialization and reload: passed.
- Real-data 16-frame identity and ordering: passed.
- Real-data sampled annular coverage: 100 percent.
- Existing application components modified: none.
- Source images modified: none.

## Limits carried to Task 6

- Placement is nominal; fine corrections remain exactly zero.
- Weak texture pairs and the `16 -> 1` closure require bounded fine registration.
- The coverage preview validates geometry and masks, not final pixel seams.
- Full-resolution reconstruction must remain tiled or memory-mapped.
