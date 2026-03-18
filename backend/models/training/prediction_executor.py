"""
Prediction Executor for Ultralytics YOLO

This standalone script runs model prediction in a separate process.
It updates the database directly upon completion or failure.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime
import shutil

# Add parent directory to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database.database import SessionLocal
from database.models import ModelExperiment
from models.training.predictor import PredictorRegistry
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

import hashlib

def calculate_md5(file_path):
    """Calculate MD5 hash of a file."""
    if not os.path.exists(file_path):
        return None
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def run_executor():
    parser = argparse.ArgumentParser(description="Run model prediction in a separate process.")
    parser.add_argument("--experiment_id", required=True, help="UUID of the experiment record")
    parser.add_argument("--weights_path", required=True, help="Absolute path to model weights")
    parser.add_argument("--images_json", required=True, help="JSON string array of image paths")
    parser.add_argument("--output_folder", required=True, help="Absolute path to output folder")
    parser.add_argument("--params_json", required=True, help="JSON string of prediction parameters")
    
    args = parser.parse_args()
    
    db = SessionLocal()
    experiment = None
    
    try:
        # 1. Update status to running
        experiment = db.query(ModelExperiment).filter(ModelExperiment.id == args.experiment_id).first()
        if not experiment:
            print(f"Error: Experiment {args.experiment_id} not found")
            return

        experiment.status = "running"
        experiment.started_at = datetime.utcnow()
        experiment.process_pid = os.getpid()
        db.commit()

        # 2. Parse arguments
        images = json.loads(args.images_json)
        params = json.loads(args.params_json)
        
        # 3. Run Prediction
        predictor = PredictorRegistry.get_predictor(experiment.framework or "ultralytics")
        
        results = predictor.predict(
            model_path=args.weights_path,
            images=images,
            output_folder=args.output_folder,
            params=params
        )

        # 4. Save Results
        experiment.status = "completed"
        experiment.completed_at = datetime.utcnow()
        experiment.duration_sec = (experiment.completed_at - experiment.started_at).total_seconds()
        
        # Store predictions JSON and analytics summary
        experiment.predictions = results['predictions']
        experiment.analytics_summary = results['analytics_summary']
        experiment.image_count = results['image_count']

        # NEW: Hashing Foundation (Media Identity)
        # Store {image_name: md5_hash} for 100% stable identity
        image_metadata = {}
        for img_path_str in images:
            img_path = Path(img_path_str)
            if img_path.exists():
                md5 = calculate_md5(img_path_str)
                if md5:
                    image_metadata[img_path.name] = md5
        experiment.input_images = image_metadata
        
        # Ensure path uses forward slashes
        rel_output_dir = Path(args.output_folder).relative_to(Path(os.getcwd()))
        experiment.output_folder = rel_output_dir.as_posix()
        
        db.commit()
        logger.info("operations.training", f"Prediction subprocess completed for {args.experiment_id}", "prediction_subprocess_success")

        # 5. Handle source image persistence (Phase 2.1)
        if experiment.dataset_source == 'upload' and experiment.dataset_path:
            # dataset_path is relative like "projects/gevis/model/prediction_temp/UUID"
            abs_source_dir = Path(os.getcwd()) / experiment.dataset_path
            
            # Destination: experiment_folder/input_images
            perm_input_dir = Path(args.output_folder) / "input_images"
            
            if abs_source_dir.exists() and "prediction_temp" in str(abs_source_dir):
                try:
                    # Create permanent folder and MOVE images there
                    perm_input_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Move individual files to handle potential cross-device issues or directory locks
                    for item in abs_source_dir.iterdir():
                        if item.is_file():
                            shutil.move(str(item), str(perm_input_dir / item.name))
                    
                    # Update database to point to the new permanent location
                    rel_perm_path = perm_input_dir.relative_to(Path(os.getcwd()))
                    experiment.dataset_path = rel_perm_path.as_posix()
                    db.commit()
                    
                    # Now safe to remove the empty temp folder
                    shutil.rmtree(abs_source_dir)
                    logger.info("operations.cleanup", f"Moved uploads to permanent folder: {experiment.dataset_path}", "prediction_persistence_success")
                except Exception as persist_err:
                    logger.warning("errors.system", f"Failed to persist uploaded images {abs_source_dir}: {persist_err}", "prediction_persistence_failed")

    except Exception as e:
        logger.error("errors.prediction", f"Prediction subprocess failed: {str(e)}", "prediction_subprocess_error", {
            "experiment_id": args.experiment_id,
            "error": str(e)
        })
        if experiment:
            experiment.status = "failed"
            experiment.error_message = str(e)
            experiment.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    run_executor()
