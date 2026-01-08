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
        
        # Ensure path uses forward slashes
        rel_output_dir = Path(args.output_folder).relative_to(Path(os.getcwd()))
        experiment.output_folder = rel_output_dir.as_posix()
        
        db.commit()
        logger.info("operations.training", f"Prediction subprocess completed for {args.experiment_id}", "prediction_subprocess_success")

        # 5. Cleanup temporary source if this was an upload-based prediction
        if experiment.dataset_source == 'upload' and experiment.dataset_path:
            # dataset_path is relative like "projects/gevis/model/prediction_temp/UUID"
            abs_source_dir = Path(os.getcwd()) / experiment.dataset_path
            if abs_source_dir.exists() and "prediction_temp" in str(abs_source_dir):
                try:
                    shutil.rmtree(abs_source_dir)
                    logger.info("operations.cleanup", f"Cleaned up temporary source directory: {experiment.dataset_path}", "prediction_cleanup_success")
                except Exception as cleanup_err:
                    logger.warning("errors.system", f"Failed to cleanup temp source {abs_source_dir}: {cleanup_err}", "prediction_cleanup_failed")

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
