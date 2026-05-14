"""
SAHI Prediction Executor

Standalone subprocess runner for SAHI sliced prediction.
It updates the ModelExperiment row directly on completion or failure.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
import traceback
from datetime import datetime
from pathlib import Path

from PIL import Image

# Add backend directory to path so this script can run as a subprocess.
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database.database import SessionLocal
from database.models import ModelExperiment
from logging_system.professional_logger import get_professional_logger
from models.training.sahi_predictor import SahiUltralyticsPredictor


logger = get_professional_logger()


def calculate_md5(file_path: str):
    if not os.path.exists(file_path):
        return None
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def load_images(args) -> list:
    if args.images_manifest:
        with open(args.images_manifest, "r", encoding="utf-8") as manifest_file:
            return json.load(manifest_file)
    if args.images_json:
        return json.loads(args.images_json)
    raise ValueError("SAHI prediction executor requires either --images_manifest or --images_json")


def build_image_metadata(images: list) -> dict:
    image_metadata = {}
    for img_path_str in images:
        img_path = Path(img_path_str)
        if not img_path.exists():
            continue

        md5 = calculate_md5(img_path_str)
        try:
            with Image.open(img_path_str) as img:
                width, height = img.size
        except Exception:
            width, height = None, None

        if md5:
            image_metadata[img_path.name] = {
                "md5": md5,
                "width": width,
                "height": height,
            }
    return image_metadata


def persist_uploaded_sources(experiment: ModelExperiment, output_folder: Path, project_root: Path, db) -> None:
    if experiment.dataset_source != "upload" or not experiment.dataset_path:
        return

    abs_source_dir = project_root / experiment.dataset_path
    perm_input_dir = output_folder / "input_images"

    if not abs_source_dir.exists() or "prediction_temp" not in str(abs_source_dir):
        return

    try:
        perm_input_dir.mkdir(parents=True, exist_ok=True)
        for item in abs_source_dir.iterdir():
            if item.is_file():
                shutil.move(str(item), str(perm_input_dir / item.name))

        rel_perm_path = perm_input_dir.relative_to(project_root)
        experiment.dataset_path = rel_perm_path.as_posix()
        db.commit()
        shutil.rmtree(abs_source_dir)
        logger.info("operations.training", f"Moved SAHI uploads to permanent folder: {experiment.dataset_path}", "sahi_prediction_persistence_success")
    except Exception as persist_err:
        print(f"SAHI prediction persistence warning: {persist_err}", file=sys.stderr, flush=True)
        logger.warning("errors.system", f"Failed to persist SAHI uploaded images {abs_source_dir}: {persist_err}", "sahi_prediction_persistence_failed")


def run_executor():
    parser = argparse.ArgumentParser(description="Run SAHI prediction in a separate process.")
    parser.add_argument("--experiment_id", required=True, help="UUID of the experiment record")
    parser.add_argument("--weights_path", required=True, help="Absolute path to model weights")
    parser.add_argument("--images_json", help="JSON string array of image paths")
    parser.add_argument("--images_manifest", help="Path to JSON file containing image paths")
    parser.add_argument("--output_folder", required=True, help="Absolute path to output folder")
    parser.add_argument("--params_json", required=True, help="JSON string of SAHI prediction parameters")

    args = parser.parse_args()

    db = SessionLocal()
    experiment = None
    project_root = Path(os.getcwd())
    output_folder = Path(args.output_folder)

    try:
        experiment = db.query(ModelExperiment).filter(ModelExperiment.id == args.experiment_id).first()
        if not experiment:
            print(f"Error: SAHI experiment {args.experiment_id} not found")
            return

        experiment.status = "running"
        experiment.started_at = datetime.utcnow()
        experiment.process_pid = os.getpid()
        db.commit()

        images = load_images(args)
        params = json.loads(args.params_json)

        predictor = SahiUltralyticsPredictor()
        results = predictor.predict(
            model_path=args.weights_path,
            images=images,
            output_folder=args.output_folder,
            params=params,
        )

        experiment.status = "completed"
        experiment.completed_at = datetime.utcnow()
        experiment.duration_sec = (experiment.completed_at - experiment.started_at).total_seconds()
        experiment.predictions = results["predictions"]
        experiment.analytics_summary = results["analytics_summary"]
        experiment.image_count = results["image_count"]
        experiment.input_images = build_image_metadata(images)

        rel_output_dir = output_folder.relative_to(project_root)
        experiment.output_folder = rel_output_dir.as_posix()

        db.commit()
        logger.info("operations.training", f"SAHI prediction subprocess completed for {args.experiment_id}", "sahi_prediction_subprocess_success")

        persist_uploaded_sources(experiment, output_folder, project_root, db)

    except Exception as exc:
        print(f"SAHI prediction subprocess failed: {exc}", file=sys.stderr, flush=True)
        print(traceback.format_exc(), file=sys.stderr, flush=True)
        logger.error("errors.system", f"SAHI prediction subprocess failed: {str(exc)}", "sahi_prediction_subprocess_error", {
            "experiment_id": args.experiment_id,
            "error": str(exc),
        })
        if experiment:
            experiment.status = "failed"
            experiment.error_message = str(exc)
            experiment.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run_executor()
