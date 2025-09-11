# backend/services/transform_resolver.py
"""
Only geometry ops included; brightness/contrast/fill-color/etc. are ignored.
Order: resize → crop → rotate → flip → random_zoom → affine_transform → shear
"""

from typing import Dict, List, Tuple, Any

# import bounds from your single-source config
from core.transformation_config import (
    CROP_PERCENTAGE_MIN, CROP_PERCENTAGE_MAX,
    RANDOM_ZOOM_FACTOR_MIN, RANDOM_ZOOM_FACTOR_MAX,
    AFFINE_SCALE_MIN, AFFINE_SCALE_MAX,
    ROTATION_ANGLE_MIN, ROTATION_ANGLE_MAX,
    SHEAR_ANGLE_MIN, SHEAR_ANGLE_MAX,
)

_GEOM_ORDER = ["resize","crop","rotate","flip","random_zoom","affine_transform","shear"]

def _clamp(v: Any, lo: float, hi: float, fallback: float) -> float:
    try:
        v = float(v)
    except Exception:
        return fallback
    if v < lo: return lo
    if v > hi: return hi
    return v

def resolve_to_op_tape(config: Dict[str, Any], *, orig_size: Tuple[int,int]) -> List[Dict[str, Any]]:
    """Return the exact, final, ordered list of geometric ops (no photometric)."""
    ops: List[Dict[str, Any]] = []

    # 1) resize
    rz = config.get("resize")
    if isinstance(rz, dict) and rz.get("enabled"):
        try:
            tw = int(rz.get("width", 0))
            th = int(rz.get("height", 0))
        except Exception:
            tw, th = 0, 0
        if tw > 0 and th > 0:
            ops.append({
                "name":"resize","enabled":True,
                "width":tw,"height":th,
                "resize_mode": (rz.get("resize_mode") or "stretch_to"),
            })

    # 2) crop
    cp = config.get("crop")
    if isinstance(cp, dict) and cp.get("enabled"):
        pct = _clamp(cp.get("percent", CROP_PERCENTAGE_MAX),
                     CROP_PERCENTAGE_MIN, CROP_PERCENTAGE_MAX,
                     CROP_PERCENTAGE_MAX)
        op = {
            "name":"crop","enabled":True,
            "percent": pct,
            "mode": (cp.get("mode") or "center"),
        }
        if "seed" in cp:
            op["seed"] = cp["seed"]  # builder will coerce if needed
        ops.append(op)

    # 3) rotate
    rt = config.get("rotate")
    if isinstance(rt, dict) and rt.get("enabled"):
        ang = _clamp(rt.get("angle", 0.0),
                    ROTATION_ANGLE_MIN, ROTATION_ANGLE_MAX, 0.0)
        ops.append({
            "name": "rotate",
            "enabled": True,
            "angle": ang,
            "expand": bool(rt.get("expand", False)),   # <-- pass-through from UI/config
            # "pad_mode": rt.get("pad_mode")           # <-- optional, if you add it
        })

    # 4) flip
    fl = config.get("flip")
    if isinstance(fl, dict) and fl.get("enabled"):
        h = bool(fl.get("horizontal", False))
        v = bool(fl.get("vertical", False))
        if h or v:
            ops.append({"name":"flip","enabled":True,"horizontal":h,"vertical":v})

    # 5) random zoom
    rz2 = config.get("random_zoom")
    if isinstance(rz2, dict) and rz2.get("enabled"):
        z = _clamp(rz2.get("zoom_factor", 1.0),
                   RANDOM_ZOOM_FACTOR_MIN, RANDOM_ZOOM_FACTOR_MAX, 1.0)
        if z > 0:
            ops.append({"name":"random_zoom","enabled":True,"zoom_factor": z})

    # 6) affine transform
    af = config.get("affine_transform")
    if isinstance(af, dict) and af.get("enabled"):
        s  = _clamp(af.get("scale", 1.0),  AFFINE_SCALE_MIN,  AFFINE_SCALE_MAX, 1.0)
        ang = float(af.get("angle", 0.0))
        sx = float(af.get("shift_x_pct", 0.0))
        sy = float(af.get("shift_y_pct", 0.0))
        sx = max(-100.0, min(100.0, sx))
        sy = max(-100.0, min(100.0, sy))
        ops.append({
            "name":"affine_transform","enabled":True,
            "scale": s, "angle": ang,
            "shift_x_pct": sx, "shift_y_pct": sy
        })

    # 7) shear
    sh = config.get("shear")
    if isinstance(sh, dict) and sh.get("enabled"):
        shear = _clamp(sh.get("shear_angle", 0.0),
                       SHEAR_ANGLE_MIN, SHEAR_ANGLE_MAX, 0.0)
        ops.append({"name":"shear","enabled":True,"shear_angle": shear})

    return ops
