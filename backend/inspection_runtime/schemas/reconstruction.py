"""Strict persistent contracts for calibrated 16-frame reconstruction.

Paths are POSIX-style and relative to ``settings.BASE_DIR``. Matrices are
row-major and act on pixel-centre homogeneous column vectors. Forward matrices
always map source-image coordinates into final reconstruction coordinates.
"""

from __future__ import annotations

import math
from datetime import datetime
from enum import Enum
from pathlib import PurePosixPath
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator


SCHEMA_VERSION = "1.0"
FRAME_COUNT = 16
NOMINAL_ANGLE_STEP_DEG = 22.5
MAX_FINE_ANGLE_CORRECTION_DEG = 2.0

Sha256 = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
Matrix3x3 = List[List[float]]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ImageRotationSign(str, Enum):
    NEGATIVE = "negative"
    POSITIVE = "positive"


class GeometryType(str, Enum):
    POINT = "point"
    BOX = "box"
    POLYGON = "polygon"
    MASK = "mask"


class CalibrationState(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    REJECTED = "rejected"


class ReconstructionState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ReconstructionErrorCode(str, Enum):
    INPUT_COUNT_INVALID = "input_count_invalid"
    INPUT_ORDER_INVALID = "input_order_invalid"
    INPUT_DUPLICATE = "input_duplicate"
    INPUT_HASH_MISMATCH = "input_hash_mismatch"
    INPUT_GEOMETRY_MISMATCH = "input_geometry_mismatch"
    CALIBRATION_INVALID = "calibration_invalid"
    REGISTRATION_LOW_CONFIDENCE = "registration_low_confidence"
    REGISTRATION_OUT_OF_BOUNDS = "registration_out_of_bounds"
    COVERAGE_INCOMPLETE = "coverage_incomplete"
    LOOP_CLOSURE_FAILED = "loop_closure_failed"
    SEAM_VALIDATION_FAILED = "seam_validation_failed"
    ARTIFACT_WRITE_FAILED = "artifact_write_failed"
    CANCELLED_BY_USER = "cancelled_by_user"
    INTERNAL_ERROR = "internal_error"


class LensDistortionModel(str, Enum):
    NONE = "none"
    BROWN_CONRADY = "brown_conrady"


def _relative_path(value: str) -> str:
    if not value or "\\" in value or "//" in value:
        raise ValueError("path must be a non-empty POSIX-style relative path")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or path.anchor
        or ":" in path.parts[0]
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise ValueError("path must remain relative to settings.BASE_DIR")
    return path.as_posix()


def _matrix(value: Matrix3x3) -> Matrix3x3:
    if len(value) != 3 or any(len(row) != 3 for row in value):
        raise ValueError("matrix must contain exactly 3 rows and 3 columns")
    if not all(math.isfinite(number) for row in value for number in row):
        raise ValueError("matrix values must be finite")
    return value


def _multiply(left: Matrix3x3, right: Matrix3x3) -> Matrix3x3:
    return [[sum(left[row][k] * right[k][column] for k in range(3)) for column in range(3)] for row in range(3)]


def _require_inverse(forward: Matrix3x3, inverse: Matrix3x3) -> None:
    product = _multiply(forward, inverse)
    for row in range(3):
        for column in range(3):
            expected = 1.0 if row == column else 0.0
            if abs(product[row][column] - expected) > 1e-6:
                raise ValueError("forward and inverse matrices are inconsistent")


class Point2D(ContractModel):
    x: float
    y: float

    @model_validator(mode="after")
    def finite(self) -> "Point2D":
        if not math.isfinite(self.x) or not math.isfinite(self.y):
            raise ValueError("point coordinates must be finite")
        return self


class RoiRectangle(ContractModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class CoordinateConvention(ContractModel):
    source_origin: Literal["top_left"] = "top_left"
    reconstruction_origin: Literal["top_left"] = "top_left"
    x_axis: Literal["right"] = "right"
    y_axis: Literal["down"] = "down"
    pixel_reference: Literal["pixel_center"] = "pixel_center"
    matrix_vector_convention: Literal["homogeneous_column_vector"] = "homogeneous_column_vector"
    matrix_storage: Literal["row_major"] = "row_major"
    angle_unit: Literal["degrees"] = "degrees"
    acquisition_angle_direction: Literal["increasing_frame_number"] = "increasing_frame_number"
    source_to_next_image_rotation_sign: ImageRotationSign = ImageRotationSign.NEGATIVE


class AcquisitionFrame(ContractModel):
    frame_number: int = Field(ge=1, le=FRAME_COUNT)
    nominal_angle_deg: float = Field(ge=0.0, lt=360.0)
    source_path: str
    original_filename: str = Field(min_length=1)
    byte_length: int = Field(gt=0)
    sha256: Sha256
    width_px: int = Field(gt=0)
    height_px: int = Field(gt=0)
    channels: Literal[3] = 3
    color_space: Literal["RGB"] = "RGB"
    media_type: Literal["image/jpeg", "image/tiff", "image/png"]

    _source_path = field_validator("source_path")(_relative_path)

    @field_validator("original_filename")
    @classmethod
    def filename_only(cls, value: str) -> str:
        if "/" in value or "\\" in value or value in {".", ".."}:
            raise ValueError("original filename cannot contain a path")
        return value


class AcquisitionManifest(ContractModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    inspection_id: str = Field(min_length=1)
    project_name: str = Field(min_length=1)
    created_at: datetime
    frame_count: Literal[FRAME_COUNT] = FRAME_COUNT
    reference_frame_number: Literal[1] = 1
    nominal_angle_step_deg: Literal[NOMINAL_ANGLE_STEP_DEG] = NOMINAL_ANGLE_STEP_DEG
    physical_diameter_mm: Optional[float] = Field(default=None, gt=0)
    coordinate_convention: CoordinateConvention = Field(default_factory=CoordinateConvention)
    frames: List[AcquisitionFrame]

    @model_validator(mode="after")
    def complete_ordered_sequence(self) -> "AcquisitionManifest":
        if len(self.frames) != FRAME_COUNT:
            raise ValueError("manifest must contain exactly 16 frames")
        if [frame.frame_number for frame in self.frames] != list(range(1, FRAME_COUNT + 1)):
            raise ValueError("frames must appear once each in numeric order 1 through 16")
        for frame in self.frames:
            expected = (frame.frame_number - 1) * NOMINAL_ANGLE_STEP_DEG
            if not math.isclose(frame.nominal_angle_deg, expected, abs_tol=1e-9):
                raise ValueError("frame angles must follow the 22.5-degree sequence")
        if len({frame.sha256 for frame in self.frames}) != FRAME_COUNT:
            raise ValueError("source frame hashes must be unique")
        if len({frame.source_path for frame in self.frames}) != FRAME_COUNT:
            raise ValueError("source frame paths must be unique")
        if len({(frame.width_px, frame.height_px, frame.channels) for frame in self.frames}) != 1:
            raise ValueError("all source frames must have identical pixel geometry")
        return self


class LensDistortion(ContractModel):
    model: LensDistortionModel = LensDistortionModel.NONE
    coefficients: List[float] = Field(default_factory=list)

    @model_validator(mode="after")
    def valid_coefficients(self) -> "LensDistortion":
        if self.model == LensDistortionModel.NONE and self.coefficients:
            raise ValueError("the none distortion model cannot contain coefficients")
        if self.model == LensDistortionModel.BROWN_CONRADY and len(self.coefficients) not in {4, 5, 8}:
            raise ValueError("Brown-Conrady distortion requires 4, 5, or 8 coefficients")
        if not all(math.isfinite(value) for value in self.coefficients):
            raise ValueError("distortion coefficients must be finite")
        return self


class Calibration(ContractModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    inspection_id: str = Field(min_length=1)
    state: CalibrationState
    input_width_px: int = Field(gt=0)
    input_height_px: int = Field(gt=0)
    output_width_px: int = Field(gt=0)
    output_height_px: int = Field(gt=0)
    usable_source_roi: RoiRectangle
    valid_source_mask_path: str
    source_disc_center_px: Point2D
    reconstruction_disc_center_px: Point2D
    inner_radius_px: float = Field(ge=0)
    outer_radius_px: float = Field(gt=0)
    reference_ray_deg: float = Field(ge=0, lt=360)
    pixels_per_mm: Optional[float] = Field(default=None, gt=0)
    source_to_calibrated_matrix: Matrix3x3
    calibrated_to_source_matrix: Matrix3x3
    lens_distortion: LensDistortion = Field(default_factory=LensDistortion)
    coordinate_convention: CoordinateConvention = Field(default_factory=CoordinateConvention)

    _mask_path = field_validator("valid_source_mask_path")(_relative_path)
    _forward = field_validator("source_to_calibrated_matrix")(_matrix)
    _inverse = field_validator("calibrated_to_source_matrix")(_matrix)

    @model_validator(mode="after")
    def valid_geometry(self) -> "Calibration":
        roi = self.usable_source_roi
        if roi.x + roi.width > self.input_width_px or roi.y + roi.height > self.input_height_px:
            raise ValueError("usable source ROI must stay inside the source image")
        if self.inner_radius_px >= self.outer_radius_px:
            raise ValueError("inner radius must be smaller than outer radius")
        _require_inverse(self.source_to_calibrated_matrix, self.calibrated_to_source_matrix)
        return self


class RegistrationEvidence(ContractModel):
    method: Literal["nominal", "texture", "hole_and_texture", "fixed_model"]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_count: int = Field(ge=0)
    median_residual_px: Optional[float] = Field(default=None, ge=0)
    overlap_percent: float = Field(ge=0.0, le=100.0)


class FrameTransform(ContractModel):
    frame_number: int = Field(ge=1, le=FRAME_COUNT)
    source_sha256: Sha256
    nominal_angle_deg: float = Field(ge=0.0, lt=360.0)
    fine_angle_correction_deg: float = Field(ge=-MAX_FINE_ANGLE_CORRECTION_DEG, le=MAX_FINE_ANGLE_CORRECTION_DEG)
    source_to_reconstruction_matrix: Matrix3x3
    reconstruction_to_source_matrix: Matrix3x3
    valid_reconstruction_mask_path: str
    evidence: RegistrationEvidence

    _mask_path = field_validator("valid_reconstruction_mask_path")(_relative_path)
    _forward = field_validator("source_to_reconstruction_matrix")(_matrix)
    _inverse = field_validator("reconstruction_to_source_matrix")(_matrix)

    @model_validator(mode="after")
    def valid_transform(self) -> "FrameTransform":
        expected = (self.frame_number - 1) * NOMINAL_ANGLE_STEP_DEG
        if not math.isclose(self.nominal_angle_deg, expected, abs_tol=1e-9):
            raise ValueError("transform angle does not match its frame number")
        _require_inverse(self.source_to_reconstruction_matrix, self.reconstruction_to_source_matrix)
        return self


class TransformSet(ContractModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    inspection_id: str = Field(min_length=1)
    calibration_path: str
    coordinate_convention: CoordinateConvention = Field(default_factory=CoordinateConvention)
    supported_geometry: List[GeometryType] = Field(default_factory=lambda: list(GeometryType))
    transforms: List[FrameTransform]

    _calibration_path = field_validator("calibration_path")(_relative_path)

    @model_validator(mode="after")
    def complete_set(self) -> "TransformSet":
        if [item.frame_number for item in self.transforms] != list(range(1, FRAME_COUNT + 1)):
            raise ValueError("transform set must contain frames 1 through 16 once each in order")
        if self.supported_geometry != list(GeometryType):
            raise ValueError("point, box, polygon, and mask projection must all be supported")
        return self


class PairValidation(ContractModel):
    source_frame: int = Field(ge=1, le=FRAME_COUNT)
    target_frame: int = Field(ge=1, le=FRAME_COUNT)
    is_loop_closure: bool = False
    passed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_count: int = Field(ge=0)
    median_residual_px: Optional[float] = Field(default=None, ge=0)
    overlap_percent: float = Field(ge=0.0, le=100.0)
    angle_correction_deg: float


class ReconstructionIssue(ContractModel):
    code: ReconstructionErrorCode
    message: str = Field(min_length=1)
    frame_number: Optional[int] = Field(default=None, ge=1, le=FRAME_COUNT)
    pair: Optional[str] = None


class ArtifactPaths(ContractModel):
    reconstructed_disc_tiff: str
    reconstructed_preview_png: str
    transforms_json: str
    coverage_map_png: str
    reconstruction_report_json: str
    provenance_map: str

    @field_validator("*")
    @classmethod
    def paths_are_relative(cls, value: str) -> str:
        return _relative_path(value)


class ReconstructionReport(ContractModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    inspection_id: str = Field(min_length=1)
    state: ReconstructionState
    created_at: datetime
    completed_at: Optional[datetime] = None
    manifest_path: str
    calibration_path: str
    transforms_path: str
    output_width_px: int = Field(gt=0)
    output_height_px: int = Field(gt=0)
    approved_annulus_pixel_count: int = Field(gt=0)
    uncovered_annulus_pixel_count: int = Field(ge=0)
    minimum_coverage_count: int = Field(ge=0)
    contributing_frames: List[int]
    pair_validations: List[PairValidation] = Field(default_factory=list)
    issues: List[ReconstructionIssue] = Field(default_factory=list)
    artifacts: ArtifactPaths

    _paths = field_validator("manifest_path", "calibration_path", "transforms_path")(_relative_path)

    @model_validator(mode="after")
    def consistent_state(self) -> "ReconstructionReport":
        if self.completed_at is not None and self.completed_at < self.created_at:
            raise ValueError("completion time cannot precede creation time")
        if len(set(self.contributing_frames)) != len(self.contributing_frames):
            raise ValueError("contributing frame numbers must be unique")
        if self.state == ReconstructionState.PASSED:
            if self.completed_at is None or self.issues:
                raise ValueError("a passed report requires completion and no issues")
            if self.uncovered_annulus_pixel_count != 0 or self.minimum_coverage_count < 1:
                raise ValueError("a passed report requires complete annulus coverage")
            if self.contributing_frames != list(range(1, FRAME_COUNT + 1)):
                raise ValueError("a passed report requires all 16 frames in order")
            expected = [(number, number + 1) for number in range(1, FRAME_COUNT)] + [(FRAME_COUNT, 1)]
            actual = [(pair.source_frame, pair.target_frame) for pair in self.pair_validations]
            if actual != expected or not all(pair.passed for pair in self.pair_validations):
                raise ValueError("a passed report requires all neighbor validations and loop closure")
            if not self.pair_validations[-1].is_loop_closure or any(pair.is_loop_closure for pair in self.pair_validations[:-1]):
                raise ValueError("only the 16-to-1 pair may be loop closure")
        return self
