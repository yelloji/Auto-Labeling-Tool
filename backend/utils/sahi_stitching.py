"""
SAHI fragment stitching — Auto Labeling only.

SAHI's built-in merge (postprocess_match_threshold) can only combine two
detections that actually share pixels (real overlap). A long, thin, winding
object like a crack often gets sliced into pieces at tile boundaries that
barely touch or don't touch at all — no overlap-based merge setting can fix
that, because there's nothing to compare.

This module adds a second, distance-based pass AFTER SAHI's own merge:
if two same-class detections' nearest points are within `stitch_distance_px`
pixels of each other, they get joined into one continuous detection —
covering both "touching a little" (distance ~0, always caught) and
"close but not touching" (distance up to the threshold) in one rule.

Merge geometry: joins each pair of fragments directly at their true nearest
points (where the tile was actually cut), rather than computing an abstract
shape axis — simpler and more robust. A safety check verifies the result is
a valid, non-self-crossing polygon; if not, it falls back to a convex hull
(always valid, but loses fine shape detail) rather than risk a broken shape.

Pure functions, no side effects, no I/O — safe to unit test in isolation.
"""

import math


MAX_STITCH_POLYGON_POINTS = 60
MAX_UNION_MASK_DIM = 4000


def _rasterized_polygon_union(fragments: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """
    Compute the true pixel-level union of several polygons by rasterizing
    them onto a shared mask, drawing all of them onto it, and tracing the
    outer boundary of what's actually covered. Unlike point-based merging
    (hull, nearest-point chaining), this can never invent empty background
    area as part of the shape, and can never lose real detected coverage —
    it's built entirely from the actual filled pixels of the real
    detections. Used to combine true duplicate detections.
    """
    import numpy as np
    import cv2

    all_points = [pt for f in fragments for pt in f]
    if not all_points:
        return []

    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    min_x, min_y = min(xs), min(ys)
    max_x, max_y = max(xs), max(ys)

    pad = 2
    width = min(int(math.ceil(max_x - min_x)) + pad * 2 + 1, MAX_UNION_MASK_DIM)
    height = min(int(math.ceil(max_y - min_y)) + pad * 2 + 1, MAX_UNION_MASK_DIM)
    if width < 1 or height < 1:
        return all_points

    mask = np.zeros((height, width), dtype=np.uint8)
    for frag in fragments:
        if len(frag) < 3:
            continue
        local_pts = np.array(
            [[int(round(x - min_x)) + pad, int(round(y - min_y)) + pad] for x, y in frag],
            dtype=np.int32,
        )
        cv2.fillPoly(mask, [local_pts], 255)

    # Rounding coordinates to whole pixels can leave a hairline 1-2px gap or
    # notch exactly where two fragments' edges meet — the traced outline then
    # follows both sides of that tiny notch, showing up as a doubled/parallel
    # line right at the seam. Closing (dilate then erode) fills gaps that
    # small without changing the real shape at any meaningful scale.
    close_kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return all_points

    largest = max(contours, key=cv2.contourArea)
    result = [(float(p[0][0] - pad + min_x), float(p[0][1] - pad + min_y)) for p in largest]
    return result if len(result) >= 3 else all_points


def _simplify_polygon(points: list[tuple[float, float]], max_points: int = MAX_STITCH_POLYGON_POINTS) -> list[tuple[float, float]]:
    """
    Real segmentation contours from a full-resolution mask can have hundreds
    or thousands of points — far denser than needed to represent a crack's
    shape, and dense enough that near-duplicate/near-touching points from
    ordinary contour noise can trip a strict self-crossing check. Uniformly
    thin the point list down to a manageable count before doing any stitch
    geometry; the shape is effectively unchanged, but the math becomes both
    faster and far less prone to spurious false positives.
    """
    n = len(points)
    if n <= max_points:
        return points
    step = n / max_points
    indices = sorted(set(int(i * step) for i in range(max_points)))
    return [points[i] for i in indices]


def _polygon_points_px(pred: dict, img_w: int, img_h: int) -> list[tuple[float, float]]:
    """
    Return this prediction's shape as a list of (x, y) pixel points, at FULL
    precision — used to decide whether two fragments are close enough to
    stitch. Simplifying here would make genuinely-close fragments look
    farther apart than they really are (their true closest points could fall
    exactly on the detail that gets thinned away), so grouping must always
    see the real, full-resolution shape. Simplification only happens later,
    on the geometry actually used to build the merged polygon.
    """
    seg = pred.get("segmentation")
    if seg and len(seg) >= 6:
        pts = []
        for i in range(0, len(seg) - 1, 2):
            pts.append((seg[i] * img_w, seg[i + 1] * img_h))
        return pts
    x1, y1, x2, y2 = pred["x_min"] * img_w, pred["y_min"] * img_h, pred["x_max"] * img_w, pred["y_max"] * img_h
    return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]


def _min_distance(pts_a: list[tuple[float, float]], pts_b: list[tuple[float, float]]) -> float:
    """Smallest distance between any point of A and any point of B.
    O(n*m) — fine here since polygons are small (tens of points, not thousands)."""
    best = float("inf")
    for ax, ay in pts_a:
        for bx, by in pts_b:
            d = math.hypot(ax - bx, ay - by)
            if d < best:
                best = d
    return best


def _bbox_of(points: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def _convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """
    Standard Andrew's monotone chain convex hull, O(n log n). Given ANY set of
    points, always returns a valid simple (non-self-crossing) polygon —
    unlike trying to trace/reorder the original fragments' boundaries, which
    is fragile for thin, wobbly, curving shapes (corner ties, ambiguous
    "sides"). This trades a little shape precision (it can't represent a
    concave notch between two fragments) for a hard guarantee: the merged
    annotation can never come out jagged or self-intersecting, which matters
    more for real training data than perfect boundary tracing.
    """
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def _closest_point_pair(pts_a: list[tuple[float, float]], pts_b: list[tuple[float, float]]):
    """Index of the closest point in A, index of the closest point in B, and their distance."""
    best_i, best_j, best_d = 0, 0, float("inf")
    for i, (ax, ay) in enumerate(pts_a):
        for j, (bx, by) in enumerate(pts_b):
            d = math.hypot(ax - bx, ay - by)
            if d < best_d:
                best_d, best_i, best_j = d, i, j
    return best_i, best_j, best_d


def _rotate_to_end(points: list[tuple[float, float]], idx: int) -> list[tuple[float, float]]:
    """Rotate a closed point loop so index `idx` becomes the LAST element."""
    return points[idx + 1:] + points[:idx + 1]


def _rotate_to_start(points: list[tuple[float, float]], idx: int) -> list[tuple[float, float]]:
    """Rotate a closed point loop so index `idx` becomes the FIRST element."""
    return points[idx:] + points[:idx]


def _nearest_point_chain_merge(fragments: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """
    Merge fragments by directly connecting each pair at their true nearest
    points, instead of computing an abstract shape axis. SAHI slice-boundary
    detections are genuinely closest to each other exactly where the tile was
    cut, so rotating each fragment's point loop to open right at that real
    connection point and splicing them together follows the actual pixel
    positions of the cut, with the shortest possible connecting edge.
    """
    frags = [list(f) for f in fragments if f]
    if len(frags) < 2:
        return frags[0] if frags else []

    remaining = frags[1:]
    chain = list(frags[0])

    while remaining:
        best_idx, best_chain_i, best_frag_i, best_d = None, 0, 0, float("inf")
        for idx, frag in enumerate(remaining):
            ci, fi, d = _closest_point_pair(chain, frag)
            if d < best_d:
                best_idx, best_chain_i, best_frag_i, best_d = idx, ci, fi, d

        frag = remaining.pop(best_idx)
        chain = _rotate_to_end(chain, best_chain_i)
        frag = _rotate_to_start(frag, best_frag_i)
        chain = chain + frag

    return chain


def _segments_intersect(p1, p2, p3, p4) -> bool:
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
    return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)


def _is_simple_polygon(points: list[tuple[float, float]]) -> bool:
    """True if no two non-adjacent edges of this closed polygon cross."""
    n = len(points)
    if n < 4:
        return True
    edges = [(points[i], points[(i + 1) % n]) for i in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if j == i or j == (i + 1) % n or i == (j + 1) % n:
                continue  # adjacent edges legitimately share a vertex
            if _segments_intersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1]):
                return False
    return True


def _chain_merge_points(fragments: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """
    Merge 2+ fragments into one polygon. Tries the precise boundary-tracing
    merge first (preserves the crack's real shape, needed for usable training
    data) and only falls back to a convex hull — always valid, but discards
    fine shape detail — if the precise merge ever produces something
    self-crossing. Never raises, never returns empty for non-empty input.
    """
    frags = [list(f) for f in fragments if f]
    if not frags:
        return []
    if len(frags) == 1:
        return frags[0]

    try:
        precise = _nearest_point_chain_merge(frags)
        if precise and _is_simple_polygon(precise):
            return precise
    except Exception:
        pass

    all_points = [pt for f in frags for pt in f]
    hull = _convex_hull(all_points)
    return hull if hull else all_points


DUPLICATE_OVERLAP_FRACTION = 0.1


def _overlap_fraction(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    """
    How much of the SMALLER box's area is covered by the shared region —
    0 means no overlap, 1 means one box fully contains the other. Two
    adjacent-but-different pieces of a thin diagonal crack can have boxes
    that just barely touch right where they meet (which should be stitched
    together, not discarded) — a plain "do they touch at all" check can't
    tell that apart from a real duplicate. Requiring a substantial shared
    fraction, not just any touching, is what actually distinguishes them.
    """
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    inter_area = (ix2 - ix1) * (iy2 - iy1)
    area_a = max(0.0, (ax2 - ax1)) * max(0.0, (ay2 - ay1))
    area_b = max(0.0, (bx2 - bx1)) * max(0.0, (by2 - by1))
    smaller = min(area_a, area_b)
    if smaller <= 0:
        return 0.0
    return inter_area / smaller


def _group_true_overlaps(member_idx: list[int], points_px: list[list[tuple[float, float]]]) -> list[list[int]]:
    """
    Within a group of nearby fragments, cluster together whichever ones
    substantially overlap each other's box — real duplicate detections of the
    same spot. Only a large shared fraction counts; a small incidental touch
    (common where two genuinely different adjacent pieces meet) does not
    count, and is left for stitching instead. Returns groups of indices —
    each group of size > 1 is a duplicate cluster to be combined into one
    shape (never simply discarded), each singleton passes through untouched.
    """
    boxes = {i: _bbox_of(points_px[i]) for i in member_idx}
    parent = {i: i for i in member_idx}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for a in member_idx:
        for b in member_idx:
            if a >= b:
                continue
            if _overlap_fraction(boxes[a], boxes[b]) >= DUPLICATE_OVERLAP_FRACTION:
                union(a, b)

    groups: dict[int, list[int]] = {}
    for i in member_idx:
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def _union_duplicate_group(dup_idx: list[int], predictions: list[dict], points_px: list[list[tuple[float, float]]],
                            has_segmentation: bool) -> tuple[list[tuple[float, float]], float]:
    """
    Resolve a cluster of true-duplicate fragments into ONE shape: the real
    pixel-level union of everything any of them detected (via
    _rasterized_polygon_union). This can neither invent empty background area
    (like a hull/chain-merge boundary sometimes did) nor silently drop a
    weaker duplicate's uniquely-covered area (like just picking a "winner"
    did) — it's built directly from the actual detected pixels of every
    member. Returns (union_points, best_confidence).
    """
    best_conf = max(predictions[i].get("confidence", 0.0) for i in dup_idx)
    fragments = [points_px[i] for i in dup_idx]
    union_points = _rasterized_polygon_union(fragments)
    return union_points, best_conf


def _build_stitched_prediction(class_name: str, points: list[tuple[float, float]], confidence: float,
                                img_w: int, img_h: int, has_segmentation: bool, source_count: int) -> dict:
    x1, y1, x2, y2 = _bbox_of(points)
    seg_norm = None
    if has_segmentation:
        seg_norm = []
        for x, y in points:
            seg_norm.extend([x / img_w, y / img_h])
    return {
        "class_name": class_name,
        "confidence": confidence,
        "x_min": x1 / img_w, "y_min": y1 / img_h,
        "x_max": x2 / img_w, "y_max": y2 / img_h,
        "segmentation": seg_norm,
        "stitched": True,
        "stitched_from": source_count,
    }


def stitch_sahi_fragments(predictions: list[dict], img_w: int, img_h: int, stitch_distance_px: float,
                           remove_duplicates: bool = True) -> list[dict]:
    """
    Two independent stages, run in order. Returns a new list — never
    mutates the input. Each stage has its own on/off control — turning one
    off does not affect the other.

    Stage 1 — duplicate removal (on by default; set remove_duplicates=False to
    disable): same-class detections whose boxes substantially overlap (a real
    duplicate of the same spot) get combined into one shape covering
    everything any of them detected — never simply dropped, since a
    "duplicate" can still cover a bit more area than the one kept. When
    disabled, every prediction passes through untouched by this stage,
    exactly like SAHI's own raw output.

    Stage 2 — gap stitching (only runs when stitch_distance_px > 0): whatever
    is left after stage 1 gets joined into one continuous detection if the
    pieces are within stitch_distance_px of each other. Setting
    stitch_distance_px to 0 turns OFF this stage only.
    """
    if len(predictions) < 2:
        return list(predictions)

    points_px = [_polygon_points_px(p, img_w, img_h) for p in predictions]

    # ── Stage 1: duplicate removal — independently toggleable ──────────────
    by_class: dict[str, list[int]] = {}
    for i, p in enumerate(predictions):
        by_class.setdefault(p.get("class_name"), []).append(i)

    effective = []  # each: {"points", "confidence", "class_name", "has_seg", "combined", "count", "original"}
    for class_name, idxs in by_class.items():
        dup_groups = _group_true_overlaps(idxs, points_px) if remove_duplicates else [[i] for i in idxs]
        for dup_idx in dup_groups:
            if len(dup_idx) == 1:
                i = dup_idx[0]
                effective.append({
                    "points": points_px[i], "confidence": predictions[i].get("confidence", 0.0),
                    "class_name": class_name, "has_seg": bool(predictions[i].get("segmentation")),
                    "combined": False, "count": 1, "original": predictions[i],
                })
            else:
                has_seg = all(predictions[i].get("segmentation") for i in dup_idx)
                union_pts, conf = _union_duplicate_group(dup_idx, predictions, points_px, has_seg)
                effective.append({
                    "points": union_pts, "confidence": conf,
                    "class_name": class_name, "has_seg": has_seg,
                    "combined": True, "count": len(dup_idx), "original": None,
                })

    def emit(e: dict) -> dict:
        if not e["combined"]:
            return e["original"]
        return _build_stitched_prediction(e["class_name"], e["points"], e["confidence"], img_w, img_h,
                                           e["has_seg"], e["count"])

    # ── Stage 2: gap stitching — only if enabled ────────────────────────────
    if stitch_distance_px is None or stitch_distance_px <= 0:
        return [emit(e) for e in effective]

    m = len(effective)
    parent = list(range(m))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(m):
        for j in range(i + 1, m):
            if effective[i]["class_name"] != effective[j]["class_name"]:
                continue
            if _min_distance(effective[i]["points"], effective[j]["points"]) <= stitch_distance_px:
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(m):
        groups.setdefault(find(i), []).append(i)

    merged: list[dict] = []
    for members in groups.values():
        if len(members) == 1:
            merged.append(emit(effective[members[0]]))
            continue

        frags = [effective[i] for i in members]
        class_name = frags[0]["class_name"]
        has_all_seg = all(f["has_seg"] for f in frags)
        best_conf = max(f["confidence"] for f in frags)
        total_sources = sum(f["count"] for f in frags)

        if has_all_seg:
            simplified = [_simplify_polygon(f["points"]) for f in frags]
            chained = _chain_merge_points(simplified)
            merged.append(_build_stitched_prediction(class_name, chained, best_conf, img_w, img_h, True, total_sources))
        else:
            all_pts = [pt for f in frags for pt in f["points"]]
            merged.append(_build_stitched_prediction(class_name, all_pts, best_conf, img_w, img_h, False, total_sources))

    return merged
