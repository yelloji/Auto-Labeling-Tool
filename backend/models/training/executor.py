"""
Training Executor for Ultralytics YOLO

This module handles subprocess execution for Ultralytics YOLO training.
For other frameworks, create separate executor modules.
"""

import subprocess
import os
import threading
from pathlib import Path
from typing import Optional
from datetime import datetime
from database.models import TrainingSession
from sqlalchemy.orm import Session
from database.database import SessionLocal
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


def _monitor_process_completion(process: subprocess.Popen, session_id: int, log_file):
    """
    Background thread function that waits for training process to complete.
    Updates database status based on exit code (framework-agnostic).
    
    Args:
        process: The subprocess.Popen object
        session_id: Database ID of the training session
        log_file: File handle to close after process finishes
    """
    try:
        # Wait for process to finish and get exit code
        exit_code = process.wait()
        
        # Close log file
        try:
            log_file.close()
        except:
            pass
        
        # Update database with completion status
        db = SessionLocal()
        try:
            session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
            if session and session.status == "running":
                # Only update if status is still "running" (health checker might have already updated)
                if exit_code == 0:
                    session.status = "completed"
                    logger.info("operations.training", f"Training completed successfully (exit code 0)", "training_completed", {
                        "session_id": session_id,
                        "session_name": session.name,
                        "exit_code": exit_code
                    })
                else:
                    session.status = "failed"
                    session.error_msg = f"Training process exited with code {exit_code}"
                    logger.error("operations.training", f"Training failed (exit code {exit_code})", "training_failed", {
                        "session_id": session_id,
                        "session_name": session.name,
                        "exit_code": exit_code
                    })
                
                session.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()
            
    except Exception as e:
        logger.error("operations.training", f"Error in process monitor thread: {e}", "monitor_thread_error", {
            "session_id": session_id,
            "error": str(e)
        })


def start_ultralytics_training(
    config_yaml_path: str,
    session: TrainingSession,
    db: Session
) -> Optional[subprocess.Popen]:
    """
    Execute Ultralytics YOLO training command in background subprocess.
    
    **FRAMEWORK: Ultralytics YOLO ONLY**
    
    Args:
        config_yaml_path: Path to YAML config file
        session: TrainingSession database object
        db: Database session
        
    Returns:
        subprocess.Popen if successful, None if failed
    """
    try:
        # Build command for Ultralytics YOLO
        import shutil
        import sys
        
        cmd = ["yolo", f"cfg={config_yaml_path}"]
        
        if not shutil.which("yolo"):
            logger.warning("operations.training", "YOLO command not found in PATH, falling back to python module", "yolo_fallback", {
                "path": str(os.environ.get("PATH"))
            })
            # Fallback to python -m ultralytics
            cmd = [sys.executable, "-m", "ultralytics", f"cfg={config_yaml_path}"]
        

        
        # Find project root directory (where "projects" folder exists)
        # This makes the code portable - works regardless of main folder name
        project_root = Path(__file__).resolve()
        while project_root.parent != project_root:
            if (project_root / "projects").exists():
                break
            project_root = project_root.parent
        
        # Start process from project root for relative paths to work
        cwd_path = str(project_root)
        
        # Resolve log path relative to project root (since DB now stores relative paths)
        # If session.logs_dir is absolute, this still works (Path handles it)
        # If relative (projects/...), it joins with project_root
        log_dir_path = project_root / session.logs_dir
        log_file_path = log_dir_path / "training.log"
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Open log file
        log_file = open(log_file_path, 'w', encoding='utf-8')
        
        process = subprocess.Popen(
            cmd,
            cwd=cwd_path,
            stdout=log_file,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            text=True
        )
        
        logger.info("operations.training", "Started Ultralytics YOLO training process", "training_start", {
            "session_name": session.name,
            "pid": process.pid,
            "command": " ".join(cmd),
            "framework": "ultralytics"
        })
        
        # Save PID to database for health checker monitoring
        session.process_pid = process.pid
        db.commit()
        
        # Start background thread to monitor process completion
        # This captures exit code for framework-agnostic success/failure detection
        # Health checker remains as safety net if backend crashes/restarts
        monitor_thread = threading.Thread(
            target=_monitor_process_completion,
            args=(process, session.id, log_file),
            daemon=True
        )
        monitor_thread.start()
        
        logger.info("operations.training", "Process monitoring thread started", "monitor_thread_start", {
            "session_id": session.id,
            "session_name": session.name
        })
        
        return process
        
    except Exception as e:
        logger.error("operations.training", "Failed to start training", "training_start_error", {
            "session_name": session.name,
            "framework": "ultralytics",
            "error": str(e)
        })
        return None
