# backend/services/affine_builder.py

import math
import numpy as np
from typing import Dict, List, Tuple, Any
from datetime import datetime

# Import professional logging system
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

# Column-vector convention. Apply op M by: A = M @ A
def _T(tx: float, ty: float) -> np.ndarray:
    return np.array([[1,0,tx],[0,1,ty],[0,0,1]], dtype=np.float32)

def _S(sx: float, sy: float) -> np.ndarray:
    return np.array([[sx,0,0],[0,sy,0],[0,0,1]], dtype=np.float32)

def _R(deg: float) -> np.ndarray:
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return np.array([[ c,-s,0],[ s, c,0],[0,0,1]], dtype=np.float32)

def _assert_canvas(cw: float, ch: float) -> None:
    if cw <= 0 or ch <= 0:
        # Example of proper error logging before raising exception
        logger.error("errors.validation", f"Invalid canvas size during build: {cw}x{ch}", "invalid_canvas_dimensions", {
            "width": cw,
            "height": ch,
            "error_type": "ValueError",
            "validation_rule": "dimensions_must_be_positive"
        })
        raise ValueError(f"Invalid canvas size during build: {cw}x{ch}")

def toggle_auto_export(enabled: bool) -> None:
    """Example function to toggle auto-export functionality"""
    # Example of proper logger.info usage as requested by user
    logger.info("operations.exports", f"Auto-export {'enabled' if enabled else 'disabled'}", "auto_export_toggle", { 
        "enabled": enabled,
        "timestamp": datetime.now().isoformat(),
        "folder": "exports/auto"
    })

def build_affine_from_ops(
    orig_w: int,
    orig_h: int,
    ops: List[Dict[str, Any]],
) -> Tuple[np.ndarray, Tuple[int, int]]:
    """
    Compose a single 3x3 affine matrix A from the ordered geometric ops.
    Tracks canvas size. Only resize/crop/fit/pad change (W,H).
    """
    A = np.eye(3, dtype=np.float32)
    cw, ch = float(orig_w), float(orig_h)
    _assert_canvas(cw, ch)

    for op in ops:
        if not op or not op.get("enabled", True):
            continue

        name = (op.get("name") or op.get("type") or "").lower()
        logger.debug("operations.transformations", f"Processing operation: {name}", "transform_operation_processing", {
            "operation": name,
            "canvas_size": f"{cw}x{ch}"
        })
        cx, cy = cw / 2.0, ch / 2.0

        if name == "resize":
            tw = float(op.get("width", cw))
            th = float(op.get("height", ch))
            mode = (op.get("resize_mode") or op.get("mode") or "stretch_to").lower()

            if mode == "stretch_to":
                A = _S(tw/cw, th/ch) @ A
                cw, ch = tw, th
                _assert_canvas(cw, ch)

            elif mode == "fit_within":
                # Scale to fit, maintain aspect, no padding (output size becomes scaled size)
                ar_o, ar_t = cw/ch, tw/th
                s = (tw/cw) if ar_o > ar_t else (th/ch)
                A = _S(s, s) @ A
                cw, ch = cw * s, ch * s
                _assert_canvas(cw, ch)

            elif mode == "fill_center_crop":
                # Scale to fill, then center-crop to (tw, th)
                ar_o, ar_t = cw/ch, tw/th
                if ar_o > ar_t:
                    s = th / ch
                    scaled_w = cw * s
                    off_x = (scaled_w - tw) / 2.0
                    A = _T(-off_x, 0) @ _S(s, s) @ A
                else:
                    s = tw / cw
                    scaled_h = ch * s
                    off_y = (scaled_h - th) / 2.0
                    A = _T(0, -off_y) @ _S(s, s) @ A
                cw, ch = tw, th
                _assert_canvas(cw, ch)

            elif mode in ("fit_reflect_edges", "fit_black_edges", "fit_white_edges"):
                # Scale to fit, then center-pad into (tw, th)
                ar_o, ar_t = cw/ch, tw/th
                if ar_o > ar_t:
                    s = tw / cw
                    new_h = ch * s
                    pad_y = (th - new_h) / 2.0
                    A = _T(0, pad_y) @ _S(s, s) @ A
                else:
                    s = th / ch
                    new_w = cw * s
                    pad_x = (tw - new_w) / 2.0
                    A = _T(pad_x, 0) @ _S(s, s) @ A
                cw, ch = tw, th
                _assert_canvas(cw, ch)

            else:
                # Fallback: direct stretch
                A = _S(tw/cw, th/ch) @ A
                cw, ch = tw, th
                _assert_canvas(cw, ch)

        elif name == "crop":
            # Two possible shapes:
            #  - percent/mode[/seed]  (preferred; compute x,y,w,h from the *current* canvas)
            #  - x,y,width,height     (already absolute)
            if "percent" in op:
                pct = float(op.get("percent", 100.0))
                pct = max(1.0, min(100.0, pct))  # avoid degenerate crops
                w = cw * pct / 100.0
                h = ch * pct / 100.0
                mode = (op.get("mode") or "center").lower()

                if mode == "center":
                    x, y = (cw - w) / 2.0, (ch - h) / 2.0
                elif mode == "random":
                    import random
                    seed_val = op.get("seed")
                    try:
                        seed_val = int(seed_val) if seed_val is not None else None
                    except Exception:
                        pass
                    rng = random.Random(seed_val) if seed_val is not None else random
                    x = rng.uniform(0.0, max(0.0, cw - w))
                    y = rng.uniform(0.0, max(0.0, ch - h))
                elif mode == "top_left":
                    x, y = 0.0, 0.0
                elif mode == "top_right":
                    x, y = (cw - w), 0.0
                elif mode == "bottom_left":
                    x, y = 0.0, (ch - h)
                elif mode == "bottom_right":
                    x, y = (cw - w), (ch - h)
                else:
                    x, y = (cw - w) / 2.0, (ch - h) / 2.0
            else:
                # Already absolute crop
                x = float(op.get("x", 0.0))
                y = float(op.get("y", 0.0))
                w = float(op.get("width", cw))
                h = float(op.get("height", ch))

            A = _T(-x, -y) @ A
            cw, ch = w, h
            _assert_canvas(cw, ch)

        
        elif name == "rotate":
            # angle in degrees; optional expand (default False)
            ang = float(op.get("angle", 0.0))
            expand = bool(op.get("expand", False))

            if abs(ang) < 1e-9:
                continue  # no-op

            # rotate about current canvas center
            cx, cy = cw / 2.0, ch / 2.0
            # rotation matrix in homogeneous form (float32 to match your code)
            r = math.radians(ang)
            c, s = math.cos(r), math.sin(r)

            T_to   = np.array([[1, 0, -cx],
                               [0, 1, -cy],
                               [0, 0,   1 ]], dtype=np.float32)
            R      = np.array([[ c, -s, 0],
                               [ s,  c, 0],
                               [ 0,  0, 1]], dtype=np.float32)
            T_back = np.array([[1, 0, cx],
                               [0, 1, cy],
                               [0, 0,  1]], dtype=np.float32)

            A_rot_center = T_back @ R @ T_to

            if not expand:
                # keep the same canvas; cropping may occur
                A = A_rot_center @ A
                # cw, ch unchanged
            else:
                # compute bounding box of rotated corners to expand canvas
                corners = np.array([
                    [0.0,   0.0,   1.0],
                    [cw-1,  0.0,   1.0],
                    [0.0,   ch-1,  1.0],
                    [cw-1,  ch-1,  1.0]
                ], dtype=np.float32).T  # 3x4

                warped = A_rot_center @ corners  # 3x4
                xs = warped[0, :] / warped[2, :]
                ys = warped[1, :] / warped[2, :]
                min_x, max_x = float(xs.min()), float(xs.max())
                min_y, max_y = float(ys.min()), float(ys.max())

                new_w = max_x - min_x + 1.0
                new_h = max_y - min_y + 1.0

                # shift so min corner maps to (0,0) on the expanded canvas
                T_shift = np.array([[1, 0, -min_x],
                                    [0, 1, -min_y],
                                    [0, 0,   1   ]], dtype=np.float32)

                A_expand = T_shift @ A_rot_center
                A = A_expand @ A

                cw, ch = float(new_w), float(new_h)
                _assert_canvas(cw, ch)


        elif name == "flip":
            hflip = bool(op.get("horizontal", False))
            vflip = bool(op.get("vertical", False))
            if hflip:
                A = _T(cx, cy) @ _S(-1, 1) @ _T(-cx, -cy) @ A
            if vflip:
                A = _T(cx, cy) @ _S( 1,-1) @ _T(-cx, -cy) @ A

        elif name == "random_zoom":
            z = float(op.get("zoom_factor", 1.0))
            if z <= 0:
                logger.warning("operations.transformations", f"Invalid zoom factor: {z}, skipping operation", "invalid_zoom_factor", {
                    "zoom_factor": z,
                    "operation": name,
                    "canvas_size": f"{cw}x{ch}"
                })
                continue
            A = _T(cx, cy) @ _S(z, z) @ _T(-cx, -cy) @ A

        elif name == "affine_transform":
            s  = float(op.get("scale", 1.0))
            if s <= 0: s = 1.0
            ang = float(op.get("angle", 0.0))
            tx_pct = float(op.get("shift_x_pct", 0.0))
            ty_pct = float(op.get("shift_y_pct", 0.0))
            tx = tx_pct / 100.0 * cw
            ty = ty_pct / 100.0 * ch
            # scale+rotate around center, then translate
            A = _T(tx, ty) @ _T(cx, cy) @ _R(ang) @ _S(s, s) @ _T(-cx, -cy) @ A

        elif name == "shear":
            # horizontal shear by angle (add vertical later if needed)
            phi = float(op.get("shear_angle", 0.0))
            k = math.tan(math.radians(phi))
            Sh = np.array([[1, k, 0],[0, 1, 0],[0, 0, 1]], dtype=np.float32)
            A = _T(cx, cy) @ Sh @ _T(-cx, -cy) @ A

        else:
            # ignore unknown (or photometric) ops
            continue

    Wf, Hf = int(round(cw)), int(round(ch))
    _assert_canvas(Wf, Hf)  # Final validation
    logger.debug("operations.transformations", "Built affine matrix with final dimensions", "affine_matrix_built", {
        "final_dimensions": f"{Wf}x{Hf}",
        "original_dimensions": f"{orig_w}x{orig_h}",
        "operations_count": len(ops)
    })
    return A, (Wf, Hf)
