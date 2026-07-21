"""Focused contract tests for Inspection Runtime reconstruction artifacts."""

import json
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError

from inspection_runtime.schemas import (
    AcquisitionManifest,
    Calibration,
    ReconstructionReport,
    TransformSet,
)


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "inspection_runtime"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("filename", "contract"),
    [
        ("acquisition_manifest.json", AcquisitionManifest),
        ("calibration.json", Calibration),
        ("transforms.json", TransformSet),
        ("reconstruction_report.json", ReconstructionReport),
    ],
)
def test_contract_fixtures_validate_and_round_trip(filename, contract):
    parsed = contract.model_validate(load_fixture(filename))
    assert contract.model_validate_json(parsed.model_dump_json()) == parsed


def test_manifest_defines_complete_ordered_22_5_degree_sequence():
    manifest = AcquisitionManifest.model_validate(load_fixture("acquisition_manifest.json"))
    assert [frame.frame_number for frame in manifest.frames] == list(range(1, 17))
    assert [frame.nominal_angle_deg for frame in manifest.frames] == [index * 22.5 for index in range(16)]
    assert manifest.coordinate_convention.source_to_next_image_rotation_sign.value == "negative"


@pytest.mark.parametrize("bad_path", ["C:/outside/image.jpg", "/outside/image.jpg", "../image.jpg", "folder\\image.jpg"])
def test_manifest_rejects_paths_outside_base_dir_contract(bad_path):
    data = load_fixture("acquisition_manifest.json")
    data["frames"][0]["source_path"] = bad_path
    with pytest.raises(ValidationError):
        AcquisitionManifest.model_validate(data)


def test_manifest_rejects_missing_or_duplicate_frames():
    missing = load_fixture("acquisition_manifest.json")
    missing["frames"].pop()
    with pytest.raises(ValidationError, match="exactly 16"):
        AcquisitionManifest.model_validate(missing)

    duplicate = load_fixture("acquisition_manifest.json")
    duplicate["frames"][1]["sha256"] = duplicate["frames"][0]["sha256"]
    with pytest.raises(ValidationError, match="hashes must be unique"):
        AcquisitionManifest.model_validate(duplicate)


def test_calibration_rejects_out_of_bounds_roi_and_non_inverse_matrix():
    bad_roi = load_fixture("calibration.json")
    bad_roi["usable_source_roi"]["width"] = 7000
    with pytest.raises(ValidationError, match="ROI"):
        Calibration.model_validate(bad_roi)

    bad_inverse = load_fixture("calibration.json")
    bad_inverse["calibrated_to_source_matrix"][0][2] = 5
    with pytest.raises(ValidationError, match="inverse"):
        Calibration.model_validate(bad_inverse)


def test_transform_set_rejects_unbounded_correction_and_incomplete_projection_support():
    correction = load_fixture("transforms.json")
    correction["transforms"][0]["fine_angle_correction_deg"] = 2.1
    with pytest.raises(ValidationError):
        TransformSet.model_validate(correction)

    geometry = load_fixture("transforms.json")
    geometry["supported_geometry"].remove("mask")
    with pytest.raises(ValidationError, match="mask"):
        TransformSet.model_validate(geometry)


def passing_report() -> dict:
    data = deepcopy(load_fixture("reconstruction_report.json"))
    data.update(
        state="passed",
        completed_at="2026-07-21T10:05:00Z",
        uncovered_annulus_pixel_count=0,
        minimum_coverage_count=1,
        contributing_frames=list(range(1, 17)),
    )
    data["pair_validations"] = [
        {
            "source_frame": frame,
            "target_frame": frame + 1 if frame < 16 else 1,
            "is_loop_closure": frame == 16,
            "passed": True,
            "confidence": 0.9,
            "evidence_count": 20,
            "median_residual_px": 3.0,
            "overlap_percent": 12.0,
            "angle_correction_deg": 0.0,
        }
        for frame in range(1, 17)
    ]
    return data


def test_passed_report_requires_complete_coverage_all_pairs_and_loop_closure():
    report = ReconstructionReport.model_validate(passing_report())
    assert report.state.value == "passed"
    assert report.pair_validations[-1].is_loop_closure

    uncovered = passing_report()
    uncovered["uncovered_annulus_pixel_count"] = 1
    with pytest.raises(ValidationError, match="coverage"):
        ReconstructionReport.model_validate(uncovered)

    missing_pair = passing_report()
    missing_pair["pair_validations"].pop()
    with pytest.raises(ValidationError, match="neighbor validations"):
        ReconstructionReport.model_validate(missing_pair)
