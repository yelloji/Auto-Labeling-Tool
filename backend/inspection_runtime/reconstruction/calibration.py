"""Evidence-driven fixed-camera calibration for 16-frame disc acquisition."""

from __future__ import annotations

import json
import math
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from statistics import median
from typing import Iterable, Optional, Sequence, Tuple

import cv2
import numpy as np

from inspection_runtime.schemas import (
    Calibration,
    CalibrationState,
    LensDistortion,
    LensDistortionModel,
    Point2D,
    RoiRectangle,
)


EXPECTED_FRAME_COUNT = 16
EXPECTED_ROTATION_DEG = -22.5
MAX_ANGLE_DEVIATION_DEG = 2.0
MIN_SCALE = 0.995
MAX_SCALE = 1.005
MIN_INLIER_COUNT = 5
MAX_MEDIAN_RESIDUAL_PX = 4.0
MIN_ACCEPTED_PAIRS = 5
MAX_CENTER_DEVIATION_PX = 250.0


class CalibrationFailure(ValueError):
    """Raised when the evidence cannot safely establish one calibration."""


@dataclass(frozen=True)
class PairObservation:
    source_frame: int
    target_frame: int
    angle_deg: float
    scale: float
    affine_matrix: Tuple[Tuple[float, float, float], Tuple[float, float, float]]
    inlier_count: int
    median_residual_px: float

    def rotation_center_px(self) -> Tuple[float, float]:
        """Solve ``translation = (I - linear) * centre``."""
        r00, r01, tx = self.affine_matrix[0]
        r10, r11, ty = self.affine_matrix[1]
        a00, a01 = 1.0 - r00, -r01
        a10, a11 = -r10, 1.0 - r11
        determinant = a00 * a11 - a01 * a10
        if abs(determinant) < 1e-9:
            raise CalibrationFailure("pair transform cannot define a finite rotation centre")
        centre_x = (tx * a11 - a01 * ty) / determinant
        centre_y = (a00 * ty - tx * a10) / determinant
        if not math.isfinite(centre_x) or not math.isfinite(centre_y):
            raise CalibrationFailure("pair transform produced a non-finite rotation centre")
        return centre_x, centre_y


@dataclass(frozen=True)
class PairMatchAttempt:
    source_frame: int
    target_frame: int
    observation: Optional[PairObservation]
    rejection_reason: Optional[str] = None

    @property
    def pair_name(self) -> str:
        return f"{self.source_frame}->{self.target_frame}"


@dataclass(frozen=True)
class CalibrationEstimate:
    calibration: Calibration
    accepted_pairs: Tuple[str, ...]
    rejected_pairs: Tuple[str, ...]
    centre_spread_px: float
    median_pair_residual_px: float


def _is_expected_neighbor(source_frame: int, target_frame: int) -> bool:
    return target_frame == (source_frame + 1 if source_frame < EXPECTED_FRAME_COUNT else 1)


def _observation_rejection(observation: PairObservation) -> Optional[str]:
    if not _is_expected_neighbor(observation.source_frame, observation.target_frame):
        return "not an adjacent acquisition pair"
    if abs(observation.angle_deg - EXPECTED_ROTATION_DEG) > MAX_ANGLE_DEVIATION_DEG:
        return "rotation is outside the calibrated 22.5-degree bound"
    if not MIN_SCALE <= observation.scale <= MAX_SCALE:
        return "scale is outside the fixed-camera bound"
    if observation.inlier_count < MIN_INLIER_COUNT:
        return "insufficient robust correspondences"
    if observation.median_residual_px > MAX_MEDIAN_RESIDUAL_PX:
        return "median residual exceeds the dataset threshold"
    return None


def _robust_common_center(
    attempts: Sequence[PairMatchAttempt],
) -> Tuple[Tuple[float, float], Tuple[PairObservation, ...], Tuple[str, ...], float]:
    candidates = []
    rejected = []
    for attempt in attempts:
        if attempt.observation is None:
            rejected.append(f"{attempt.pair_name}: {attempt.rejection_reason or 'no transform'}")
            continue
        reason = _observation_rejection(attempt.observation)
        if reason:
            rejected.append(f"{attempt.pair_name}: {reason}")
            continue
        try:
            center = attempt.observation.rotation_center_px()
        except CalibrationFailure as error:
            rejected.append(f"{attempt.pair_name}: {error}")
            continue
        candidates.append((attempt.observation, center))

    if len(candidates) < MIN_ACCEPTED_PAIRS:
        raise CalibrationFailure(
            f"only {len(candidates)} reliable neighbor pairs; at least {MIN_ACCEPTED_PAIRS} are required"
        )

    median_x = median(center[0] for _, center in candidates)
    median_y = median(center[1] for _, center in candidates)
    distances = [math.hypot(center[0] - median_x, center[1] - median_y) for _, center in candidates]
    median_distance = median(distances)
    robust_limit = min(MAX_CENTER_DEVIATION_PX, max(25.0, 3.0 * median_distance))
    retained = [item for item, distance in zip(candidates, distances) if distance <= robust_limit]
    for (observation, _), distance in zip(candidates, distances):
        if distance > robust_limit:
            rejected.append(
                f"{observation.source_frame}->{observation.target_frame}: rotation centre is an outlier"
            )

    if len(retained) < MIN_ACCEPTED_PAIRS:
        raise CalibrationFailure("too few neighbor pairs agree on one fixed rotation centre")

    final_x = median(center[0] for _, center in retained)
    final_y = median(center[1] for _, center in retained)
    spread = max(math.hypot(center[0] - final_x, center[1] - final_y) for _, center in retained)
    return (final_x, final_y), tuple(observation for observation, _ in retained), tuple(rejected), spread


def _radial_extent(center: Tuple[float, float], roi: RoiRectangle) -> Tuple[float, float]:
    center_x, center_y = center
    left, top = float(roi.x), float(roi.y)
    right, bottom = float(roi.x + roi.width), float(roi.y + roi.height)
    delta_x = max(left - center_x, 0.0, center_x - right)
    delta_y = max(top - center_y, 0.0, center_y - bottom)
    inner = math.hypot(delta_x, delta_y)
    outer = max(
        math.hypot(x - center_x, y - center_y)
        for x, y in ((left, top), (right, top), (left, bottom), (right, bottom))
    )
    return inner, outer


def build_calibration(
    *,
    inspection_id: str,
    attempts: Sequence[PairMatchAttempt],
    input_width_px: int,
    input_height_px: int,
    usable_source_roi: RoiRectangle,
    valid_source_mask_path: str,
) -> CalibrationEstimate:
    """Build one deterministic native-pixel calibration from pair evidence."""
    if input_width_px <= 0 or input_height_px <= 0:
        raise CalibrationFailure("input dimensions must be positive")
    center, accepted, rejected, spread = _robust_common_center(attempts)
    inner_radius, outer_radius = _radial_extent(center, usable_source_roi)
    output_radius = math.ceil(outer_radius) + 1
    output_center = (float(output_radius), float(output_radius))
    translate_x = output_center[0] - center[0]
    translate_y = output_center[1] - center[1]
    forward = [[1.0, 0.0, translate_x], [0.0, 1.0, translate_y], [0.0, 0.0, 1.0]]
    inverse = [[1.0, 0.0, -translate_x], [0.0, 1.0, -translate_y], [0.0, 0.0, 1.0]]
    roi_center = (
        usable_source_roi.x + usable_source_roi.width / 2.0,
        usable_source_roi.y + usable_source_roi.height / 2.0,
    )
    reference_ray = math.degrees(math.atan2(roi_center[1] - center[1], roi_center[0] - center[0])) % 360.0
    calibration = Calibration(
        inspection_id=inspection_id,
        state=CalibrationState.VALIDATED,
        input_width_px=input_width_px,
        input_height_px=input_height_px,
        output_width_px=2 * output_radius + 1,
        output_height_px=2 * output_radius + 1,
        usable_source_roi=usable_source_roi,
        valid_source_mask_path=valid_source_mask_path,
        source_disc_center_px=Point2D(x=center[0], y=center[1]),
        reconstruction_disc_center_px=Point2D(x=output_center[0], y=output_center[1]),
        inner_radius_px=inner_radius,
        outer_radius_px=outer_radius,
        reference_ray_deg=reference_ray,
        pixels_per_mm=None,
        source_to_calibrated_matrix=forward,
        calibrated_to_source_matrix=inverse,
        lens_distortion=LensDistortion(model=LensDistortionModel.NONE, coefficients=[]),
    )
    residual = median(item.median_residual_px for item in accepted)
    return CalibrationEstimate(
        calibration=calibration,
        accepted_pairs=tuple(f"{item.source_frame}->{item.target_frame}" for item in accepted),
        rejected_pairs=rejected,
        centre_spread_px=spread,
        median_pair_residual_px=residual,
    )


def _load_gray(path: Path, scale: float) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise CalibrationFailure(f"cannot decode source image: {path.name}")
    if scale != 1.0:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return image


def estimate_pair_observations(
    frame_paths: Sequence[Path],
    *,
    working_scale: float = 0.25,
    excluded_top_fraction: float = 0.18,
) -> Tuple[PairMatchAttempt, ...]:
    """Measure all neighbor transforms, including 16-to-1, without modifying inputs."""
    if len(frame_paths) != EXPECTED_FRAME_COUNT:
        raise CalibrationFailure("calibration requires exactly 16 ordered image paths")
    if not 0.05 <= working_scale <= 1.0:
        raise CalibrationFailure("working scale must be between 0.05 and 1.0")
    if not 0.0 <= excluded_top_fraction < 0.8:
        raise CalibrationFailure("excluded top fraction is outside the safe range")

    cv2.setRNGSeed(0)
    sift = cv2.SIFT_create(nfeatures=8000, contrastThreshold=0.015, edgeThreshold=15)
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    features = []
    for path in frame_paths:
        gray = _load_gray(Path(path), working_scale)
        mask = np.zeros_like(gray, dtype=np.uint8)
        mask[int(gray.shape[0] * excluded_top_fraction) :, :] = 255
        keypoints, descriptors = sift.detectAndCompute(gray, mask)
        features.append((keypoints, descriptors))

    attempts = []
    for source_index in range(EXPECTED_FRAME_COUNT):
        target_index = (source_index + 1) % EXPECTED_FRAME_COUNT
        source_frame, target_frame = source_index + 1, target_index + 1
        source_keypoints, source_descriptors = features[source_index]
        target_keypoints, target_descriptors = features[target_index]
        if source_descriptors is None or target_descriptors is None:
            attempts.append(PairMatchAttempt(source_frame, target_frame, None, "no feature descriptors"))
            continue
        raw_matches = matcher.knnMatch(source_descriptors, target_descriptors, k=2)
        matches = [first for first, second in raw_matches if first.distance < 0.78 * second.distance]
        if len(matches) < 3:
            attempts.append(PairMatchAttempt(source_frame, target_frame, None, "fewer than three matches"))
            continue
        source_points = np.float32([source_keypoints[item.queryIdx].pt for item in matches])
        target_points = np.float32([target_keypoints[item.trainIdx].pt for item in matches])
        affine, inlier_mask = cv2.estimateAffinePartial2D(
            source_points,
            target_points,
            method=cv2.RANSAC,
            ransacReprojThreshold=4.0,
            maxIters=10000,
            confidence=0.999,
            refineIters=20,
        )
        if affine is None or inlier_mask is None:
            attempts.append(PairMatchAttempt(source_frame, target_frame, None, "RANSAC found no similarity transform"))
            continue
        inliers = inlier_mask.ravel().astype(bool)
        predicted = cv2.transform(source_points[None, :, :], affine)[0]
        residuals = np.linalg.norm(predicted - target_points, axis=1)[inliers] / working_scale
        linear00, linear01 = float(affine[0, 0]), float(affine[0, 1])
        angle = math.degrees(math.atan2(float(affine[1, 0]), linear00))
        scale = math.hypot(linear00, linear01)
        full_affine = (
            (linear00, linear01, float(affine[0, 2]) / working_scale),
            (float(affine[1, 0]), float(affine[1, 1]), float(affine[1, 2]) / working_scale),
        )
        observation = PairObservation(
            source_frame=source_frame,
            target_frame=target_frame,
            angle_deg=angle,
            scale=scale,
            affine_matrix=full_affine,
            inlier_count=int(inliers.sum()),
            median_residual_px=float(np.median(residuals)),
        )
        attempts.append(PairMatchAttempt(source_frame, target_frame, observation))
    return tuple(attempts)


def serialize_calibration(calibration: Calibration) -> str:
    """Return stable UTF-8 JSON content for hashing and repeatable output."""
    return json.dumps(calibration.model_dump(mode="json"), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _safe_output(base_dir: Path, relative_path: str) -> Path:
    pure = PurePosixPath(relative_path)
    if pure.is_absolute() or pure.anchor or not pure.parts or ":" in pure.parts[0] or ".." in pure.parts:
        raise CalibrationFailure("calibration output path must remain relative to the supplied base directory")
    base = base_dir.resolve()
    output = (base / Path(*pure.parts)).resolve()
    try:
        output.relative_to(base)
    except ValueError as error:
        raise CalibrationFailure("calibration output escapes the supplied base directory") from error
    return output


def save_calibration(calibration: Calibration, base_dir: Path, relative_path: str) -> Path:
    """Atomically persist calibration beneath a caller-owned base directory."""
    output = _safe_output(Path(base_dir), relative_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(serialize_calibration(calibration))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_name, output)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise
    return output


def load_calibration(path: Path) -> Calibration:
    return Calibration.model_validate_json(Path(path).read_text(encoding="utf-8"))


def draw_calibration_overlay(image: np.ndarray, calibration: Calibration) -> np.ndarray:
    """Draw ROI, radial limits, reference direction, and off-frame centre cue."""
    if image is None or image.ndim not in {2, 3}:
        raise CalibrationFailure("overlay input must be a decoded grayscale or color image")
    if image.shape[1] != calibration.input_width_px or image.shape[0] != calibration.input_height_px:
        raise CalibrationFailure("overlay image dimensions do not match the calibration")
    overlay = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR) if image.ndim == 2 else image.copy()
    roi = calibration.usable_source_roi
    cv2.rectangle(overlay, (roi.x, roi.y), (roi.x + roi.width - 1, roi.y + roi.height - 1), (0, 255, 255), 8)
    centre = (int(round(calibration.source_disc_center_px.x)), int(round(calibration.source_disc_center_px.y)))
    for radius, color in (
        (calibration.inner_radius_px, (255, 180, 0)),
        (calibration.outer_radius_px, (0, 180, 255)),
    ):
        cv2.circle(overlay, centre, int(round(radius)), color, 6, lineType=cv2.LINE_AA)
    roi_center = (roi.x + roi.width // 2, roi.y + roi.height // 2)
    direction = np.array([calibration.source_disc_center_px.x - roi_center[0], calibration.source_disc_center_px.y - roi_center[1]])
    length = float(np.linalg.norm(direction))
    if length > 0:
        endpoint = np.array(roi_center) + direction / length * min(800.0, length)
        cv2.arrowedLine(overlay, roi_center, tuple(np.rint(endpoint).astype(int)), (0, 255, 0), 8, tipLength=0.08)
    cv2.putText(overlay, "valid source ROI", (max(20, roi.x + 20), max(60, roi.y + 60)), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 255), 4, cv2.LINE_AA)
    return overlay


def write_calibration_overlay(image_path: Path, calibration: Calibration, output_path: Path) -> Path:
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise CalibrationFailure(f"cannot decode overlay source: {Path(image_path).name}")
    output = Path(output_path)
    if output.suffix.lower() != ".png":
        raise CalibrationFailure("diagnostic overlay must be written as PNG")
    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), draw_calibration_overlay(image, calibration)):
        raise CalibrationFailure("OpenCV could not write the diagnostic overlay")
    return output
