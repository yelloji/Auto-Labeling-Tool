"""Calibration geometry, persistence, and diagnostic tests."""

import math
from pathlib import Path

import numpy as np
import pytest

from inspection_runtime.reconstruction import (
    CalibrationFailure,
    PairMatchAttempt,
    PairObservation,
    build_calibration,
    draw_calibration_overlay,
    load_calibration,
    save_calibration,
    serialize_calibration,
)
from inspection_runtime.schemas import RoiRectangle


def observation(frame, center=(150.0, -500.0), angle_deg=-22.5, inliers=20, residual=2.0):
    radians = math.radians(angle_deg)
    cosine, sine = math.cos(radians), math.sin(radians)
    rotation = ((cosine, -sine), (sine, cosine))
    translate_x = center[0] - (rotation[0][0] * center[0] + rotation[0][1] * center[1])
    translate_y = center[1] - (rotation[1][0] * center[0] + rotation[1][1] * center[1])
    item = PairObservation(
        source_frame=frame,
        target_frame=frame + 1 if frame < 16 else 1,
        angle_deg=angle_deg,
        scale=1.0,
        affine_matrix=(
            (rotation[0][0], rotation[0][1], translate_x),
            (rotation[1][0], rotation[1][1], translate_y),
        ),
        inlier_count=inliers,
        median_residual_px=residual,
    )
    return PairMatchAttempt(item.source_frame, item.target_frame, item)


def calibration_estimate():
    return build_calibration(
        inspection_id="inspection-test",
        attempts=[observation(frame) for frame in range(1, 9)],
        input_width_px=300,
        input_height_px=200,
        usable_source_roi=RoiRectangle(x=0, y=100, width=300, height=100),
        valid_source_mask_path="projects/demo/inspections/inspection-test/calibration/source-mask.png",
    )


def test_build_calibration_recovers_common_off_frame_center_and_radial_band():
    result = calibration_estimate()
    calibration = result.calibration

    assert calibration.source_disc_center_px.x == pytest.approx(150.0)
    assert calibration.source_disc_center_px.y == pytest.approx(-500.0)
    assert calibration.inner_radius_px == pytest.approx(614.0)
    assert calibration.outer_radius_px == pytest.approx(698.0)
    assert calibration.state.value == "validated"
    assert result.accepted_pairs == tuple(f"{frame}->{frame + 1}" for frame in range(1, 9))
    assert result.rejected_pairs == ()
    assert result.median_pair_residual_px == 2.0


def test_calibrated_band_is_visible_across_the_complete_nominal_sector():
    calibration = calibration_estimate().calibration
    center = np.array([calibration.source_disc_center_px.x, calibration.source_disc_center_px.y])
    roi = calibration.usable_source_roi
    for radius in (calibration.inner_radius_px, calibration.outer_radius_px):
        for angle in np.linspace(calibration.reference_ray_deg - 11.25, calibration.reference_ray_deg + 11.25, 257):
            radians = math.radians(angle)
            point = center + radius * np.array([math.cos(radians), math.sin(radians)])
            assert roi.x <= point[0] < roi.x + roi.width
            assert roi.y <= point[1] < roi.y + roi.height


def test_calibration_rejects_insufficient_or_physically_unbounded_evidence():
    attempts = [observation(frame) for frame in range(1, 5)]
    attempts.append(observation(5, angle_deg=-30.0))
    with pytest.raises(CalibrationFailure, match="at least 5"):
        build_calibration(
            inspection_id="inspection-test",
            attempts=attempts,
            input_width_px=300,
            input_height_px=200,
            usable_source_roi=RoiRectangle(x=0, y=100, width=300, height=100),
            valid_source_mask_path="projects/demo/inspections/inspection-test/calibration/source-mask.png",
        )


def test_calibration_serialization_is_deterministic_and_round_trips(tmp_path):
    calibration = calibration_estimate().calibration
    first = serialize_calibration(calibration)
    second = serialize_calibration(calibration)
    assert first == second

    saved = save_calibration(calibration, tmp_path, "calibration/calibration.json")
    assert saved == tmp_path / "calibration" / "calibration.json"
    assert saved.read_text(encoding="utf-8") == first
    assert load_calibration(saved) == calibration


@pytest.mark.parametrize("unsafe", ["../outside.json", "/outside.json", "C:/outside.json"])
def test_calibration_save_rejects_unsafe_output_paths(tmp_path, unsafe):
    with pytest.raises(CalibrationFailure):
        save_calibration(calibration_estimate().calibration, tmp_path, unsafe)


def test_diagnostic_overlay_preserves_dimensions_and_draws_geometry():
    calibration = calibration_estimate().calibration
    source = np.zeros((200, 300, 3), dtype=np.uint8)
    overlay = draw_calibration_overlay(source, calibration)

    assert overlay.shape == source.shape
    assert np.count_nonzero(source) == 0
    assert np.count_nonzero(overlay) > 0


def test_diagnostic_overlay_rejects_wrong_image_geometry():
    calibration = calibration_estimate().calibration
    with pytest.raises(CalibrationFailure, match="dimensions"):
        draw_calibration_overlay(np.zeros((100, 100, 3), dtype=np.uint8), calibration)
