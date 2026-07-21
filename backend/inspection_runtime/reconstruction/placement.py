"""Deterministic nominal placement without allocating the full disc canvas."""

from __future__ import annotations

import json
import math
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterator, Sequence, Tuple

import numpy as np

from inspection_runtime.schemas import (
    AcquisitionManifest,
    Calibration,
    CalibrationState,
    FrameTransform,
    RegistrationEvidence,
    TransformSet,
)


FRAME_COUNT = 16
ANGLE_STEP_DEG = 22.5
MAX_TILE_PIXELS = 1_048_576


class PlacementFailure(ValueError):
    """Raised when nominal placement would violate its geometry contract."""


@dataclass(frozen=True)
class OutputTile:
    x: int
    y: int
    width: int
    height: int

    def __post_init__(self) -> None:
        if min(self.x, self.y) < 0 or self.width <= 0 or self.height <= 0:
            raise PlacementFailure("tile origin must be non-negative and dimensions positive")
        if self.width * self.height > MAX_TILE_PIXELS:
            raise PlacementFailure("tile exceeds the safe pixel limit")


def _relative_path(value: str) -> str:
    if not value or "\\" in value or "//" in value:
        raise PlacementFailure("path must be a non-empty POSIX-style relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or path.anchor or ":" in path.parts[0] or ".." in path.parts:
        raise PlacementFailure("path must remain relative to the application base directory")
    return path.as_posix()


def _nominal_matrix(calibration: Calibration, angle_deg: float) -> Tuple[list, list]:
    """Map a rotated acquisition back into image-1 reconstruction orientation."""
    radians = math.radians(angle_deg)
    cosine, sine = math.cos(radians), math.sin(radians)
    source_x = calibration.source_disc_center_px.x
    source_y = calibration.source_disc_center_px.y
    output_x = calibration.reconstruction_disc_center_px.x
    output_y = calibration.reconstruction_disc_center_px.y
    forward = [
        [cosine, -sine, output_x - cosine * source_x + sine * source_y],
        [sine, cosine, output_y - sine * source_x - cosine * source_y],
        [0.0, 0.0, 1.0],
    ]
    inverse = [
        [cosine, sine, source_x - cosine * output_x - sine * output_y],
        [-sine, cosine, source_y + sine * output_x - cosine * output_y],
        [0.0, 0.0, 1.0],
    ]
    return forward, inverse


def build_nominal_transform_set(
    manifest: AcquisitionManifest,
    calibration: Calibration,
    *,
    calibration_path: str,
    reconstruction_mask_dir: str,
) -> TransformSet:
    """Create all 16 source-to-reconstruction transforms exactly once."""
    if manifest.inspection_id != calibration.inspection_id:
        raise PlacementFailure("manifest and calibration inspection IDs do not match")
    if calibration.state != CalibrationState.VALIDATED:
        raise PlacementFailure("nominal placement requires a validated calibration")
    if any(
        frame.width_px != calibration.input_width_px or frame.height_px != calibration.input_height_px
        for frame in manifest.frames
    ):
        raise PlacementFailure("manifest image geometry does not match calibration input geometry")
    calibration_path = _relative_path(calibration_path)
    mask_dir = _relative_path(reconstruction_mask_dir).rstrip("/")
    transforms = []
    for frame in manifest.frames:
        forward, inverse = _nominal_matrix(calibration, frame.nominal_angle_deg)
        transforms.append(
            FrameTransform(
                frame_number=frame.frame_number,
                source_sha256=frame.sha256,
                nominal_angle_deg=frame.nominal_angle_deg,
                fine_angle_correction_deg=0.0,
                source_to_reconstruction_matrix=forward,
                reconstruction_to_source_matrix=inverse,
                valid_reconstruction_mask_path=f"{mask_dir}/frame-{frame.frame_number:02d}.tiff",
                evidence=RegistrationEvidence(
                    method="nominal",
                    confidence=1.0,
                    evidence_count=0,
                    median_residual_px=None,
                    overlap_percent=0.0,
                ),
            )
        )
    return TransformSet(
        inspection_id=manifest.inspection_id,
        calibration_path=calibration_path,
        transforms=transforms,
    )


def map_points(matrix: Sequence[Sequence[float]], points: np.ndarray) -> np.ndarray:
    """Map an ``N x 2`` point array through a homogeneous 3x3 matrix."""
    values = np.asarray(points, dtype=np.float64)
    transform = np.asarray(matrix, dtype=np.float64)
    if values.ndim != 2 or values.shape[1] != 2:
        raise PlacementFailure("points must be an N x 2 array")
    if transform.shape != (3, 3) or not np.isfinite(transform).all() or not np.isfinite(values).all():
        raise PlacementFailure("points and matrix must be finite with 3x3 matrix geometry")
    homogeneous = np.column_stack((values, np.ones(len(values), dtype=np.float64)))
    mapped = homogeneous @ transform.T
    denominator = mapped[:, 2]
    if np.any(np.abs(denominator) < 1e-12):
        raise PlacementFailure("transform maps a point to infinity")
    return mapped[:, :2] / denominator[:, None]


def frame_output_bounds(calibration: Calibration, transform: FrameTransform) -> Tuple[int, int, int, int]:
    """Return the clipped output bounding box of one transformed source ROI."""
    roi = calibration.usable_source_roi
    corners = np.array(
        [[roi.x, roi.y], [roi.x + roi.width, roi.y], [roi.x + roi.width, roi.y + roi.height], [roi.x, roi.y + roi.height]],
        dtype=np.float64,
    )
    mapped = map_points(transform.source_to_reconstruction_matrix, corners)
    left = max(0, int(math.floor(float(mapped[:, 0].min()))))
    top = max(0, int(math.floor(float(mapped[:, 1].min()))))
    right = min(calibration.output_width_px, int(math.ceil(float(mapped[:, 0].max()))) + 1)
    bottom = min(calibration.output_height_px, int(math.ceil(float(mapped[:, 1].max()))) + 1)
    if right <= left or bottom <= top:
        raise PlacementFailure(f"frame {transform.frame_number} has no output intersection")
    return left, top, right, bottom


def render_validity_tile(calibration: Calibration, transform: FrameTransform, tile: OutputTile) -> np.ndarray:
    """Evaluate one frame's ROI/annulus mask for a bounded output tile."""
    if tile.x + tile.width > calibration.output_width_px or tile.y + tile.height > calibration.output_height_px:
        raise PlacementFailure("tile extends outside the calibrated output canvas")
    x_values = np.arange(tile.x, tile.x + tile.width, dtype=np.float64)
    y_values = np.arange(tile.y, tile.y + tile.height, dtype=np.float64)
    output_x, output_y = np.meshgrid(x_values, y_values)
    inverse = np.asarray(transform.reconstruction_to_source_matrix, dtype=np.float64)
    source_x = inverse[0, 0] * output_x + inverse[0, 1] * output_y + inverse[0, 2]
    source_y = inverse[1, 0] * output_x + inverse[1, 1] * output_y + inverse[1, 2]
    denominator = inverse[2, 0] * output_x + inverse[2, 1] * output_y + inverse[2, 2]
    if np.any(np.abs(denominator) < 1e-12):
        raise PlacementFailure("inverse transform maps tile pixels to infinity")
    source_x /= denominator
    source_y /= denominator
    roi = calibration.usable_source_roi
    inside_roi = (
        (source_x >= roi.x)
        & (source_x < roi.x + roi.width)
        & (source_y >= roi.y)
        & (source_y < roi.y + roi.height)
    )
    radius_squared = (
        (source_x - calibration.source_disc_center_px.x) ** 2
        + (source_y - calibration.source_disc_center_px.y) ** 2
    )
    inside_annulus = (
        (radius_squared >= calibration.inner_radius_px**2)
        & (radius_squared <= calibration.outer_radius_px**2)
    )
    return np.where(inside_roi & inside_annulus, 255, 0).astype(np.uint8)


def iter_output_tiles(calibration: Calibration, tile_size: int = 1024) -> Iterator[OutputTile]:
    if tile_size <= 0 or tile_size * tile_size > MAX_TILE_PIXELS:
        raise PlacementFailure("tile size is outside the safe range")
    for y in range(0, calibration.output_height_px, tile_size):
        for x in range(0, calibration.output_width_px, tile_size):
            yield OutputTile(
                x=x,
                y=y,
                width=min(tile_size, calibration.output_width_px - x),
                height=min(tile_size, calibration.output_height_px - y),
            )


def serialize_transform_set(transform_set: TransformSet) -> str:
    return json.dumps(transform_set.model_dump(mode="json"), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _safe_output(base_dir: Path, relative_path: str) -> Path:
    normalized = _relative_path(relative_path)
    base = Path(base_dir).resolve()
    output = (base / Path(*PurePosixPath(normalized).parts)).resolve()
    try:
        output.relative_to(base)
    except ValueError as error:
        raise PlacementFailure("transform output escapes the supplied base directory") from error
    return output


def save_transform_set(transform_set: TransformSet, base_dir: Path, relative_path: str) -> Path:
    output = _safe_output(Path(base_dir), relative_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(serialize_transform_set(transform_set))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_name, output)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise
    return output


def load_transform_set(path: Path) -> TransformSet:
    return TransformSet.model_validate_json(Path(path).read_text(encoding="utf-8"))
