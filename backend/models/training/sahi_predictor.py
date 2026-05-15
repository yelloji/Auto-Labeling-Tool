import gc
import inspect
import os
import shutil
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch

from logging_system.professional_logger import get_professional_logger
from models.training.predictor import BasePredictor


logger = get_professional_logger()


class SahiUltralyticsPredictor(BasePredictor):
    """SAHI sliced predictor for Ultralytics models."""

    def predict(self, model_path: str, images: List[str], output_folder: str, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            from sahi import AutoDetectionModel
            from sahi.predict import get_sliced_prediction
        except ImportError as exc:
            raise RuntimeError("SAHI is not installed. Install sahi>=0.11.36 before running SAHI prediction.") from exc

        os.makedirs(output_folder, exist_ok=True)
        visuals_dir = Path(output_folder) / "visuals"
        visuals_dir.mkdir(parents=True, exist_ok=True)

        img_list = images if isinstance(images, list) else [images]
        device = self._resolve_device(params.get("device", "auto"))
        confidence = float(params.get("confidence", params.get("model_confidence_threshold", 0.5)))

        logger.info(
            "operations.training",
            f"Running SAHI prediction on {len(img_list)} full images",
            "sahi_prediction_start",
            {"model": model_path, "image_count": len(img_list), "device": device}
        )

        detection_model = None
        try:
            detection_model = AutoDetectionModel.from_pretrained(
                model_type="ultralytics",
                model_path=model_path,
                confidence_threshold=confidence,
                device=device,
            )

            predictions: Dict[str, List[Dict[str, Any]]] = {}
            total_detections = 0
            classes_detected: Dict[str, int] = {}
            images_with_detections = 0
            images_without_detections = 0
            confidence_sum = 0.0
            confidence_count = 0
            confidence_distribution = {
                "0.0-0.2": 0,
                "0.2-0.5": 0,
                "0.5-0.8": 0,
                "0.8-1.0": 0,
            }

            for image_path in img_list:
                image_name = Path(image_path).name
                result = get_sliced_prediction(**self._build_sahi_prediction_kwargs(
                    get_sliced_prediction=get_sliced_prediction,
                    image_path=image_path,
                    detection_model=detection_model,
                    params=params,
                ))

                image_predictions = []
                for object_prediction in getattr(result, "object_prediction_list", []) or []:
                    converted = self._convert_object_prediction(object_prediction)
                    image_predictions.append(converted)

                    confidence_value = converted["confidence"]
                    class_name = converted["class"]
                    total_detections += 1
                    classes_detected[class_name] = classes_detected.get(class_name, 0) + 1
                    confidence_sum += confidence_value
                    confidence_count += 1
                    self._add_confidence_bucket(confidence_distribution, confidence_value)

                predictions[image_name] = image_predictions
                if image_predictions:
                    images_with_detections += 1
                else:
                    images_without_detections += 1

                self._export_visual(result, visuals_dir, Path(image_path).stem, params)

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

            image_count = len(img_list)
            avg_confidence = confidence_sum / confidence_count if confidence_count else 0.0
            avg_detections_per_image = total_detections / image_count if image_count else 0.0
            analytics_summary = {
                "total_detections": total_detections,
                "avg_detections_per_image": round(avg_detections_per_image, 2),
                "avg_confidence": round(avg_confidence, 4),
                "classes_detected": classes_detected,
                "images_with_detections": images_with_detections,
                "images_without_detections": images_without_detections,
                "confidence_distribution": confidence_distribution,
                "prediction_mode": "sahi",
                "slice_height": int(params.get("slice_height", params.get("imgsz", 896))),
                "slice_width": int(params.get("slice_width", params.get("imgsz", 896))),
            }

            logger.info(
                "operations.training",
                f"SAHI prediction completed: {image_count} images, {total_detections} detections",
                "sahi_prediction_complete",
                {"image_count": image_count, "total_detections": total_detections}
            )

            return {
                "predictions": predictions,
                "analytics_summary": analytics_summary,
                "output_folder": Path(output_folder).as_posix(),
                "image_count": image_count,
            }
        except Exception as exc:
            print(f"SAHI prediction task hit a critical error: {exc}", file=sys.stderr, flush=True)
            print(traceback.format_exc(), file=sys.stderr, flush=True)
            logger.error("errors.system", f"SAHI prediction task hit a critical error: {str(exc)}", "sahi_prediction_critical_error")
            raise
        finally:
            try:
                if detection_model is not None:
                    del detection_model
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass

    @staticmethod
    def _resolve_device(device_value: str) -> str:
        requested = str(device_value or "auto").lower()
        cuda_available = torch.cuda.is_available()
        if requested in {"auto", "cuda", "cuda:0", "0"}:
            return "cuda:0" if cuda_available else "cpu"
        if requested.startswith("cuda") and not cuda_available:
            return "cpu"
        if requested.isdigit():
            return f"cuda:{requested}" if cuda_available else "cpu"
        return requested

    @staticmethod
    def _add_confidence_bucket(distribution: Dict[str, int], confidence: float) -> None:
        if confidence < 0.2:
            distribution["0.0-0.2"] += 1
        elif confidence < 0.5:
            distribution["0.2-0.5"] += 1
        elif confidence < 0.8:
            distribution["0.5-0.8"] += 1
        else:
            distribution["0.8-1.0"] += 1

    @staticmethod
    def _build_sahi_prediction_kwargs(get_sliced_prediction: Any, image_path: str, detection_model: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        kwargs = {
            "image": image_path,
            "detection_model": detection_model,
            "slice_height": int(params.get("slice_height", params.get("imgsz", 896))),
            "slice_width": int(params.get("slice_width", params.get("imgsz", 896))),
            "overlap_height_ratio": float(params.get("overlap_height_ratio", 0.25)),
            "overlap_width_ratio": float(params.get("overlap_width_ratio", 0.25)),
            "postprocess_type": params.get("postprocess_type", "GREEDYNMM"),
            "postprocess_match_metric": params.get("postprocess_match_metric", "IOS"),
            "postprocess_match_threshold": float(params.get("postprocess_match_threshold", params.get("iou_threshold", 0.3))),
            "postprocess_class_agnostic": bool(params.get("postprocess_class_agnostic", True)),
            "verbose": int(params.get("verbose", 0)),
        }

        signature = inspect.signature(get_sliced_prediction)
        supported_keys = set(signature.parameters.keys())

        if "perform_standard_pred" in supported_keys:
            kwargs["perform_standard_pred"] = not bool(params.get("no_standard_prediction", True))
        elif "no_standard_prediction" in supported_keys:
            kwargs["no_standard_prediction"] = bool(params.get("no_standard_prediction", True))

        if "no_sliced_prediction" in supported_keys:
            kwargs["no_sliced_prediction"] = bool(params.get("no_sliced_prediction", False))

        return {key: value for key, value in kwargs.items() if key in supported_keys}

    def _convert_object_prediction(self, object_prediction: Any) -> Dict[str, Any]:
        category = getattr(object_prediction, "category", None)
        score = getattr(object_prediction, "score", None)

        class_id = self._safe_int(getattr(category, "id", None), default=None)
        class_name = str(getattr(category, "name", class_id if class_id is not None else "unknown"))
        confidence = self._safe_float(getattr(score, "value", score), default=0.0)
        segmentation = self._extract_segmentation(object_prediction)
        bbox = self._extract_bbox(object_prediction, segmentation)

        return {
            "class": class_name,
            "class_id": class_id,
            "confidence": confidence,
            "bbox": bbox,
            "segmentation": segmentation,
            "mask": segmentation,
            "source": "sahi",
        }

    def _extract_bbox(self, object_prediction: Any, segmentation: Optional[List[List[float]]]) -> List[float]:
        bbox_obj = getattr(object_prediction, "bbox", None)

        if bbox_obj is not None:
            for method_name in ("to_xyxy", "to_voc_bbox"):
                method = getattr(bbox_obj, method_name, None)
                if callable(method):
                    try:
                        return [float(value) for value in method()]
                    except Exception:
                        pass

            attrs = [getattr(bbox_obj, name, None) for name in ("minx", "miny", "maxx", "maxy")]
            if all(value is not None for value in attrs):
                return [float(value) for value in attrs]

        if segmentation:
            calculated_bbox = self.calculate_bbox_from_polygon(segmentation)
            if calculated_bbox:
                return [float(value) for value in calculated_bbox]

        return [0.0, 0.0, 0.0, 0.0]

    @staticmethod
    def _extract_segmentation(object_prediction: Any) -> Optional[List[List[float]]]:
        mask = getattr(object_prediction, "mask", None)
        if mask is None:
            return None

        for attr_name in ("segmentation", "full_shape_segmentation"):
            segmentation = getattr(mask, attr_name, None)
            normalized = SahiUltralyticsPredictor._normalize_polygon(segmentation)
            if normalized:
                return normalized

        return None

    @staticmethod
    def _normalize_polygon(segmentation: Any) -> Optional[List[List[float]]]:
        if not segmentation:
            return None

        if isinstance(segmentation, list) and segmentation:
            first = segmentation[0]
            if isinstance(first, (int, float)):
                points = segmentation
            elif isinstance(first, list) and first and isinstance(first[0], (int, float)):
                points = first
            else:
                return segmentation

            if len(points) < 4:
                return None
            return [[float(points[i]), float(points[i + 1])] for i in range(0, len(points) - 1, 2)]

        return None

    @staticmethod
    def _safe_int(value: Any, default: Optional[int] = 0) -> Optional[int]:
        try:
            return int(value)
        except Exception:
            return default

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except Exception:
            return default

    @staticmethod
    def _export_visual(result: Any, visuals_dir: Path, image_stem: str, params: Dict[str, Any]) -> None:
        export_dir = visuals_dir / image_stem
        export_dir.mkdir(parents=True, exist_ok=True)
        export_visuals = getattr(result, "export_visuals", None)
        if not callable(export_visuals):
            return

        try:
            export_visuals(
                export_dir=export_dir.as_posix(),
                hide_labels=bool(params.get("visual_hide_labels", False)),
                hide_conf=bool(params.get("visual_hide_conf", False)),
            )
        except TypeError:
            export_visuals(export_dir=export_dir.as_posix())

        exported_files = [path for path in export_dir.iterdir() if path.is_file()]
        if len(exported_files) == 1:
            target = visuals_dir / f"{image_stem}{exported_files[0].suffix}"
            if target.exists():
                target.unlink()
            shutil.move(exported_files[0].as_posix(), target.as_posix())
            try:
                export_dir.rmdir()
            except OSError:
                pass
