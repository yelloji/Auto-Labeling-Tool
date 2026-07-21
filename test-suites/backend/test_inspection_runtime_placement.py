"""Nominal circular placement and tile-safe validity-mask tests."""

import json
import math
from pathlib import Path

import numpy as np
import pytest

from inspection_runtime.reconstruction import (
    OutputTile,
    PlacementFailure,
    build_nominal_transform_set,
    frame_output_bounds,
    iter_output_tiles,
    load_transform_set,
    map_points,
    render_validity_tile,
    save_transform_set,
    serialize_transform_set,
)
from inspection_runtime.schemas import AcquisitionManifest, Calibration


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "inspection_runtime"


def manifest():
    data = json.loads((FIXTURES / "acquisition_manifest.json").read_text(encoding="utf-8"))
    data["inspection_id"] = "placement-test"
    for frame in data["frames"]:
        frame["width_px"] = 200
        frame["height_px"] = 200
    return AcquisitionManifest.model_validate(data)


def calibration():
    outer = math.hypot(100.0, 700.0)
    radius = math.ceil(outer) + 1
    translate_x, translate_y = radius - 100.0, radius + 500.0
    return Calibration.model_validate(
        {
            "inspection_id": "placement-test",
            "state": "validated",
            "input_width_px": 200,
            "input_height_px": 200,
            "output_width_px": 2 * radius + 1,
            "output_height_px": 2 * radius + 1,
            "usable_source_roi": {"x": 0, "y": 100, "width": 200, "height": 100},
            "valid_source_mask_path": "projects/demo/inspections/placement-test/calibration/source-mask.png",
            "source_disc_center_px": {"x": 100.0, "y": -500.0},
            "reconstruction_disc_center_px": {"x": radius, "y": radius},
            "inner_radius_px": 600.0,
            "outer_radius_px": outer,
            "reference_ray_deg": 90.0,
            "pixels_per_mm": None,
            "source_to_calibrated_matrix": [[1, 0, translate_x], [0, 1, translate_y], [0, 0, 1]],
            "calibrated_to_source_matrix": [[1, 0, -translate_x], [0, 1, -translate_y], [0, 0, 1]],
            "lens_distortion": {"model": "none", "coefficients": []},
        }
    )


def transform_set():
    return build_nominal_transform_set(
        manifest(),
        calibration(),
        calibration_path="projects/demo/inspections/placement-test/calibration/calibration.json",
        reconstruction_mask_dir="projects/demo/inspections/placement-test/reconstruction/masks",
    )


def test_builds_all_16_transforms_once_at_exact_nominal_angles():
    result = transform_set()
    assert [item.frame_number for item in result.transforms] == list(range(1, 17))
    assert [item.nominal_angle_deg for item in result.transforms] == [index * 22.5 for index in range(16)]
    assert len({item.source_sha256 for item in result.transforms}) == 16
    assert len({item.valid_reconstruction_mask_path for item in result.transforms}) == 16
    assert all(item.fine_angle_correction_deg == 0 for item in result.transforms)


def test_inverse_acquisition_rotation_places_same_physical_point_together():
    result = transform_set()
    source_center = np.array([100.0, -500.0])
    point_in_frame_1 = np.array([[120.0, 150.0]])
    radians = math.radians(-22.5)
    rotation = np.array([[math.cos(radians), -math.sin(radians)], [math.sin(radians), math.cos(radians)]])
    point_in_frame_2 = (point_in_frame_1 - source_center) @ rotation.T + source_center

    canonical_from_1 = map_points(result.transforms[0].source_to_reconstruction_matrix, point_in_frame_1)
    canonical_from_2 = map_points(result.transforms[1].source_to_reconstruction_matrix, point_in_frame_2)
    assert canonical_from_2 == pytest.approx(canonical_from_1, abs=1e-9)


def test_every_transform_round_trips_below_numerical_tolerance():
    points = np.array([[0.0, 100.0], [100.0, 150.0], [199.0, 199.0], [33.25, 170.75]])
    for transform in transform_set().transforms:
        output = map_points(transform.source_to_reconstruction_matrix, points)
        restored = map_points(transform.reconstruction_to_source_matrix, output)
        assert np.max(np.abs(restored - points)) < 1e-9


def test_frame_bounds_are_clipped_and_each_frame_intersects_output():
    current_calibration = calibration()
    bounds = [frame_output_bounds(current_calibration, item) for item in transform_set().transforms]
    assert len(bounds) == 16
    for left, top, right, bottom in bounds:
        assert 0 <= left < right <= current_calibration.output_width_px
        assert 0 <= top < bottom <= current_calibration.output_height_px


def test_validity_mask_is_tile_bounded_and_preserves_source_roi():
    current_calibration = calibration()
    first = transform_set().transforms[0]
    covered = render_validity_tile(current_calibration, first, OutputTile(x=600, y=1300, width=220, height=119))
    empty = render_validity_tile(current_calibration, first, OutputTile(x=0, y=0, width=100, height=100))
    assert covered.shape == (119, 220)
    assert np.count_nonzero(covered) > 0
    assert np.count_nonzero(covered) < covered.size
    assert np.count_nonzero(empty) == 0


def test_output_tile_iterator_covers_canvas_exactly_without_large_allocation():
    current_calibration = calibration()
    tiles = list(iter_output_tiles(current_calibration, tile_size=256))
    assert sum(tile.width * tile.height for tile in tiles) == (
        current_calibration.output_width_px * current_calibration.output_height_px
    )
    assert max(tile.width * tile.height for tile in tiles) <= 256 * 256


def test_transform_serialization_is_deterministic_and_round_trips(tmp_path):
    result = transform_set()
    assert serialize_transform_set(result) == serialize_transform_set(result)
    saved = save_transform_set(result, tmp_path, "reconstruction/transforms.json")
    assert load_transform_set(saved) == result
    assert saved.read_text(encoding="utf-8") == serialize_transform_set(result)


def test_rejects_mismatched_inspection_and_unsafe_output(tmp_path):
    current_manifest = manifest()
    current_calibration = calibration().model_copy(update={"inspection_id": "other"})
    with pytest.raises(PlacementFailure, match="IDs"):
        build_nominal_transform_set(
            current_manifest,
            current_calibration,
            calibration_path="projects/demo/calibration.json",
            reconstruction_mask_dir="projects/demo/masks",
        )
    with pytest.raises(PlacementFailure):
        save_transform_set(transform_set(), tmp_path, "../transforms.json")

    with pytest.raises(PlacementFailure, match="validated"):
        build_nominal_transform_set(
            current_manifest,
            calibration().model_copy(update={"state": "draft"}),
            calibration_path="projects/demo/calibration.json",
            reconstruction_mask_dir="projects/demo/masks",
        )


def test_rejects_tiles_large_enough_to_risk_excessive_memory():
    with pytest.raises(PlacementFailure, match="pixel limit"):
        OutputTile(x=0, y=0, width=2048, height=2048)
