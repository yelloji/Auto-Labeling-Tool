# save as: test_transformations.py
# run:     python3 test_transformations.py

from math import isclose

# >>> Adjust this import path if needed <<<
from core.annotation_transformer import (
    BoundingBox, Polygon,
    update_annotations_for_transformations,
    transform_detection_annotations_to_yolo,
    transform_segmentation_annotations_to_yolo,
)

EPS = 1e-4

def assert_close(a, b, eps=EPS, msg=""):
    if not isclose(a, b, rel_tol=0, abs_tol=eps):
        raise AssertionError(f"{msg} expected {b}, got {a}")

def expect_bbox(b, exp):
    x1,y1,x2,y2 = exp
    assert_close(b.x_min, x1, msg="x_min")
    assert_close(b.y_min, y1, msg="y_min")
    assert_close(b.x_max, x2, msg="x_max")
    assert_close(b.y_max, y2, msg="y_max")

def rect_polygon_from_bbox(x1,y1,x2,y2):
    return Polygon(points=[(x1,y1),(x2,y1),(x2,y2),(x1,y2)], class_name="test", class_id=0)

def bbox_minmax_from_polygon(poly):
    xs = [p[0] for p in poly.points]
    ys = [p[1] for p in poly.points]
    return min(xs), min(ys), max(xs), max(ys)

def run_case(mode, ow, oh, tw, th, exp_bbox, exp_canvas):
    print(f"\n=== MODE: {mode}  src={ow}x{oh}  target={tw}x{th} ===")

    # original annotations
    bbox0 = BoundingBox(100, 100, 200, 200, "test", 0)
    poly0 = rect_polygon_from_bbox(100, 100, 200, 200)

    cfg = {
        "resize": {"enabled": True, "resize_mode": mode, "width": tw, "height": th}
    }

    # Transform (sequential path)
    anns, dbg = update_annotations_for_transformations(
        [bbox0, poly0], cfg, (ow, oh), (tw, th), affine_matrix=None, debug_tracking=True
    )

    # pull results
    bbox1 = next(a for a in anns if isinstance(a, BoundingBox))
    poly1 = next(a for a in anns if isinstance(a, Polygon))
    canvas_w, canvas_h = dbg["actual_canvas_dimensions"]

    # assert canvas
    assert (canvas_w, canvas_h) == exp_canvas, f"canvas mismatch: {(canvas_w,canvas_h)} vs {exp_canvas}"
    print(f"canvas OK: {canvas_w}x{canvas_h}")

    # assert bbox numbers
    expect_bbox(bbox1, exp_bbox)
    print(f"bbox OK: [{bbox1.x_min:.1f},{bbox1.y_min:.1f},{bbox1.x_max:.1f},{bbox1.y_max:.1f}]")

    # polygon should match bbox min/max
    px1,py1,px2,py2 = bbox_minmax_from_polygon(poly1)
    expect_bbox(BoundingBox(px1,py1,px2,py2,"",0), exp_bbox)
    print(f"polygon OK (min/max matches bbox)")

    # YOLO checks (must use FINAL canvas!)
    yolo_box = transform_detection_annotations_to_yolo([bbox1], canvas_w, canvas_h)
    yolo_poly = transform_segmentation_annotations_to_yolo([poly1], canvas_w, canvas_h)
    assert len(yolo_box)==1 and len(yolo_poly)==1, "YOLO line missing"
    print(f"yolo bbox: {yolo_box[0]}")
    print(f"yolo poly: {yolo_poly[0]}")

def main():
    # Example from our discussion: src 800x600 -> target 640x640, bbox [100,100,200,200]
    ow, oh = 800, 600
    tw, th = 640, 640

    # Precomputed expected numbers (your previous results)
    # stretch_to: sx=640/800=0.8 ; sy=640/600=1.066666...
    run_case("stretch_to", ow, oh, tw, th,
             exp_bbox=(80.0, 106.6667, 160.0, 213.3333),
             exp_canvas=(640, 640))

    # fit_within: s=min(640/800,640/600)=0.8 ; canvas = 800*0.8 x 600*0.8 = 640x480
    run_case("fit_within", ow, oh, tw, th,
             exp_bbox=(80.0, 80.0, 160.0, 160.0),
             exp_canvas=(640, 480))

    # letterbox (fit_black_edges example): same s=0.8; pads (0,80)
    run_case("fit_black_edges", ow, oh, tw, th,
             exp_bbox=(80.0, 160.0, 160.0, 240.0),
             exp_canvas=(640, 640))

    # fill_center_crop: s=max(640/800,640/600)=1.066666...; ox=(640-853.333)/2=-106.6667
    run_case("fill_center_crop", ow, oh, tw, th,
             exp_bbox=(0.0, 106.6667, 106.6667, 213.3333),
             exp_canvas=(640, 640))

    print("\nALL TESTS PASSED ✅")

if __name__ == "__main__":
    main()
