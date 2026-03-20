"""
Training Executor for Ultralytics YOLO

This module handles subprocess execution for Ultralytics YOLO training.
For other frameworks, create separate executor modules.
"""

import subprocess
import os
from pathlib import Path
from typing import Optional
from database.models import TrainingSession
from sqlalchemy.orm import Session
from logging_system.professional_logger import get_professional_logger
from core.config import settings

logger = get_professional_logger()


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
        
        # Find yolo executable: check PATH first, then Scripts/ next to python.exe (exe mode)
        yolo_cmd = shutil.which("yolo")
        if not yolo_cmd:
            # In exe mode yolo is not on PATH — find it next to the bundled python.exe
            scripts_dir = Path(sys.executable).parent / "Scripts"
            yolo_in_scripts = scripts_dir / "yolo.exe"
            if yolo_in_scripts.exists():
                yolo_cmd = str(yolo_in_scripts)

        if yolo_cmd:
            cmd = [yolo_cmd, f"cfg={config_yaml_path}"]
        else:
            # Last resort: call the ultralytics entrypoint directly via -c
            logger.warning("operations.training", "yolo.exe not found, using inline entrypoint fallback", "yolo_fallback", {
                "python": sys.executable
            })
            cmd = [
                sys.executable, "-c",
                f"from ultralytics.cfg import entrypoint; import sys; sys.argv=['yolo', 'cfg={config_yaml_path}']; entrypoint('yolo')"
            ]
        

        
        # Find project root directory
        project_root = settings.BASE_DIR
        
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
        
        # Force unbuffered output for real-time logging
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        
        process = subprocess.Popen(
            cmd,
            cwd=cwd_path,
            stdout=log_file,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            text=True,
            bufsize=1,  # Line buffering
            env=env
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
        
        # Training process now runs independently.
        # Health checker (health_checker.py) monitors the PID and updates status when complete.
        # This prevents blocking the backend and allows navigation to other UIs during training.
        
        return process
        
    except Exception as e:
        logger.error("operations.training", "Failed to start training", "training_start_error", {
            "session_name": session.name,
            "framework": "ultralytics",
            "error": str(e)
        })
        return None
