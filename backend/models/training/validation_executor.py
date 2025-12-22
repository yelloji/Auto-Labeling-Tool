"""
Validation Executor for Ultralytics YOLO

This standalone script runs model validation in a separate process.
It updates the database directly upon completion or failure.
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime

# Add parent directory to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database.database import SessionLocal
from database.models import ModelExperiment
from models.training.validator import ValidatorRegistry
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

def run_executor():
    parser = argparse.ArgumentParser(description="Run model validation in a separate process.")
    parser.add_argument("--experiment_id", required=True, help="UUID of the experiment record")
    parser.add_argument("--weights_path", required=True, help="Absolute path to model weights")
    parser.add_argument("--dataset_yaml", required=True, help="Absolute path to dataset data.yaml")
    parser.add_argument("--output_folder", required=True, help="Absolute path to output folder")
    parser.add_argument("--params_json", required=True, help="JSON string of validation parameters")
    
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

        params = json.loads(args.params_json)
        
        # 2. Run Validation
        validator = ValidatorRegistry.get_validator(experiment.framework or "ultralytics")
        
        results = validator.validate(
            model_path=args.weights_path,
            dataset_yaml=args.dataset_yaml,
            output_folder=args.output_folder,
            params=params
        )

        # 3. Save Results
        experiment.status = "completed"
        experiment.completed_at = datetime.utcnow()
        experiment.duration_sec = (experiment.completed_at - experiment.started_at).total_seconds()
        
        # results['metrics'] is already a dict of floats
        experiment.validation_metrics = results['metrics']
        experiment.per_class_metrics = results['per_class_metrics']
        experiment.confusion_matrix = results['confusion_matrix']
        experiment.predictions = results['results_json']
        
        # Ensure path uses forward slashes
        rel_output_dir = Path(args.output_folder).relative_to(Path(os.getcwd()))
        experiment.output_folder = rel_output_dir.as_posix()
        
        db.commit()
        logger.info("operations.training", f"Validation subprocess completed for {args.experiment_id}", "validation_subprocess_success")

    except Exception as e:
        logger.error("errors.validation", f"Validation subprocess failed: {str(e)}", "validation_subprocess_error", {
            "experiment_id": args.experiment_id,
            "error": str(e)
        })
        if experiment:
            experiment.status = "failed"
            experiment.error_message = str(e)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    run_executor()
