"""
Pixel-coverage GT matching for SAHI comparison — fixes the tile-fragmentation
false-positive problem.

The standard greedy matcher (ground_truth_loader.get_missed_detections) does
1-GT-to-1-best-prediction matching: only the single best-IoU prediction near a
GT box counts as TP, every other prediction near that same GT becomes a false
positive. That's correct when duplicates are the risk, but wrong for SAHI: a
single long crack sliced across tile boundaries can legitimately produce 2-3
separate real detections, and this module must not punish that.

Instead: for each GT object, find EVERY prediction that overlaps its real
polygon shape (small edge buffer allowed), union all of them into one pixel
mask (same rasterization technique as duplicate-removal), and compare that
combined mask's pixel coverage against the GT's own mask. A prediction that
doesn't overlap any GT at all is a real false positive.

Fully automatic — geometry only, no human verification involved.
Pure functions, no I/O — safe to unit test in isolation.
"""
import math

MAX_MASK_DIM = 4000
EDGE_BUFFER_PX = 5
FULL_COVERAGE_THRESHOLD = 0.85


def _rasterize_mask(points_list, min_x, min_y, width, height, pad):
    import numpy as np
    import cv2

    mask = np.zeros((height, width), dtype=np.uint8)
    for points in points_list:
        if len(points) < 3:
            continue
        local_pts = np.array(
            [[int(round(x - min_x)) + pad, int(round(y - min_y)) + pad] for x, y in points],
            dtype=np.int32,
        )
        cv2.fillPoly(mask, [local_pts], 255)
    return mask


def _polygon_bbox(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def _skeleton_length_coverage(gt_mask, union_mask_for_match) -> float:
    """
    What fraction of the GT crack's actual LENGTH (its centerline/skeleton) is
    covered by predictions — deliberately ignores width, so a thin-but-correct
    detection scores the same as a thick one, while a real gap in the middle
    still shows up. This is what should decide TP vs Partial Missing; raw area
    coverage conflates "missing a chunk" with "just drawn narrower," which are
    different problems (see coverage_width for the latter).
    """
    import numpy as np
    from skimage.morphology import skeletonize

    skeleton = skeletonize(gt_mask > 0)
    total_skel_px = int(np.count_nonzero(skeleton))
    if total_skel_px == 0:
        return 0.0
    covered_skel_px = int(np.count_nonzero(skeleton & (union_mask_for_match > 0)))
    return covered_skel_px / total_skel_px


def match_predictions_to_gt(gt_polygons: list, pred_polygons: list, edge_buffer_px: float = EDGE_BUFFER_PX,
                             full_coverage_threshold: float = FULL_COVERAGE_THRESHOLD) -> dict:
    """
    gt_polygons: list of [(x, y), ...] pixel-coordinate polygons (one real crack each).
    pred_polygons: list of [(x, y), ...] pixel-coordinate polygons (one final, already-deduplicated
                   detection each — not raw SAHI tile output).

    Three coverage numbers per GT, since area alone conflates two different
    problems (a real gap vs. just being drawn narrower than the GT):
      - coverage_length: % of the GT's centerline/path covered — real gaps only, width-blind.
      - coverage_width:  average width covered along the parts that ARE detected.
      - coverage_total:  raw pixel-area coverage (length * width combined).
    Status (TP vs Partial Missing) is decided by coverage_length.

    Returns:
        {
            "gt_results": [
                {"gt_index": i, "status": "tp"|"partial_missing"|"missing",
                 "coverage_total": 0.0-1.0, "coverage_length": 0.0-1.0, "coverage_width": 0.0-1.0,
                 "matched_pred_indices": [...]},
                ...
            ],
            "fp_pred_indices": [indices of predictions that matched no GT at all],
        }
    """
    import numpy as np
    import cv2

    n_gt = len(gt_polygons)
    n_pred = len(pred_polygons)

    if n_gt == 0:
        return {"gt_results": [], "fp_pred_indices": list(range(n_pred))}

    dilate_kernel = np.ones((max(1, int(round(edge_buffer_px))) * 2 + 1,) * 2, np.uint8) if edge_buffer_px > 0 else None

    matched_pred_indices_overall = set()
    gt_results = []

    for gt_idx, gt_pts in enumerate(gt_polygons):
        if len(gt_pts) < 3:
            gt_results.append({"gt_index": gt_idx, "status": "missing", "coverage_total": 0.0, "coverage_length": 0.0, "coverage_width": 0.0, "matched_pred_indices": []})
            continue

        gx1, gy1, gx2, gy2 = _polygon_bbox(gt_pts)

        # Find predictions whose bbox is anywhere near this GT's bbox (cheap prefilter)
        candidate_idx = []
        for pred_idx, pred_pts in enumerate(pred_polygons):
            if len(pred_pts) < 3:
                continue
            px1, py1, px2, py2 = _polygon_bbox(pred_pts)
            if px2 < gx1 - edge_buffer_px * 4 or px1 > gx2 + edge_buffer_px * 4:
                continue
            if py2 < gy1 - edge_buffer_px * 4 or py1 > gy2 + edge_buffer_px * 4:
                continue
            candidate_idx.append(pred_idx)

        if not candidate_idx:
            gt_results.append({"gt_index": gt_idx, "status": "missing", "coverage_total": 0.0, "coverage_length": 0.0, "coverage_width": 0.0, "matched_pred_indices": []})
            continue

        # Shared raster space covering GT + all candidate predictions
        all_pts = list(gt_pts) + [pt for i in candidate_idx for pt in pred_polygons[i]]
        min_x, min_y = min(p[0] for p in all_pts), min(p[1] for p in all_pts)
        max_x, max_y = max(p[0] for p in all_pts), max(p[1] for p in all_pts)
        pad = int(math.ceil(edge_buffer_px)) + 2
        width = min(int(math.ceil(max_x - min_x)) + pad * 2 + 1, MAX_MASK_DIM)
        height = min(int(math.ceil(max_y - min_y)) + pad * 2 + 1, MAX_MASK_DIM)
        if width < 1 or height < 1:
            gt_results.append({"gt_index": gt_idx, "status": "missing", "coverage_total": 0.0, "coverage_length": 0.0, "coverage_width": 0.0, "matched_pred_indices": []})
            continue

        gt_mask = _rasterize_mask([gt_pts], min_x, min_y, width, height, pad)
        gt_mask_for_match = cv2.dilate(gt_mask, dilate_kernel) if dilate_kernel is not None else gt_mask

        assigned = []
        for pred_idx in candidate_idx:
            pred_mask = _rasterize_mask([pred_polygons[pred_idx]], min_x, min_y, width, height, pad)
            overlap = cv2.bitwise_and(pred_mask, gt_mask_for_match)
            if cv2.countNonZero(overlap) > 0:
                assigned.append(pred_idx)

        if not assigned:
            gt_results.append({"gt_index": gt_idx, "status": "missing", "coverage_total": 0.0, "coverage_length": 0.0, "coverage_width": 0.0, "matched_pred_indices": []})
            continue

        matched_pred_indices_overall.update(assigned)

        union_mask = _rasterize_mask([pred_polygons[i] for i in assigned], min_x, min_y, width, height, pad)
        gt_area = cv2.countNonZero(gt_mask)
        covered = cv2.countNonZero(cv2.bitwise_and(union_mask, gt_mask))
        coverage_total = (covered / gt_area) if gt_area > 0 else 0.0

        union_mask_for_match = cv2.dilate(union_mask, dilate_kernel) if dilate_kernel is not None else union_mask
        coverage_length = _skeleton_length_coverage(gt_mask, union_mask_for_match)
        # total ~= length * width (over the covered length) => width = total / length.
        # Immune to the width/length being measured on different denominators;
        # clamped since a slightly-wider prediction than GT can push the ratio over 1.
        coverage_width = min(1.0, coverage_total / coverage_length) if coverage_length > 0 else 0.0

        status = "tp" if coverage_length >= full_coverage_threshold else "partial_missing"
        gt_results.append({
            "gt_index": gt_idx, "status": status,
            "coverage_total": round(coverage_total, 4),
            "coverage_length": round(coverage_length, 4),
            "coverage_width": round(coverage_width, 4),
            "matched_pred_indices": assigned,
        })

    fp_pred_indices = [i for i in range(n_pred) if i not in matched_pred_indices_overall]

    return {"gt_results": gt_results, "fp_pred_indices": fp_pred_indices}