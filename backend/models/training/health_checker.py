import time
import threading
import psutil
import os
from datetime import datetime
from database.database import SessionLocal
from database.models import TrainingSession
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

def check_training_health():
    """
    Periodically checks the health of running training sessions.
    If a process ID is no longer running, updates the session status.
    """
    logger.info("system.startup", "Training health checker loop started", "health_checker_loop_start")
    
    while True:
        try:
            db = SessionLocal()
            try:
                # Find all sessions that are marked as 'running'
                running_sessions = db.query(TrainingSession).filter(TrainingSession.status == "running").all()
                
                for session in running_sessions:
                    if not session.process_pid:
                        # Skip sessions without PID (legacy or error)
                        continue
                        
                    pid = session.process_pid
                    
                    # Check if process is still running
                    is_running = False
                    try:
                        if psutil.pid_exists(pid):
                            proc = psutil.Process(pid)
                            # Double check status (zombie processes are technically dead)
                            if proc.status() != psutil.STATUS_ZOMBIE:
                                is_running = True
                    except psutil.NoSuchProcess:
                        is_running = False
                    except Exception:
                        # Permission denied or other error -> assume running to be safe? 
                        # Or assume dead? Usually permission denied means it belongs to another user/system.
                        # But we started it, so we should have access.
                        is_running = False
                    
                    if not is_running:
                        # Process is gone! Check training log to determine success/failure
                        log_status = "completed"  # Default to completed
                        error_msg = None
                        
                        # Try to read the training log file
                        try:
                            from pathlib import Path
                            
                            # Construct log file path (stored as relative path in DB)
                            # Find project root
                            current_file = Path(__file__).resolve()
                            project_root = current_file
                            while project_root.parent != project_root:
                                if (project_root / "projects").exists():
                                    break
                                project_root = project_root.parent
                            
                            log_file_path = project_root / session.logs_dir / "training.log"
                            
                            if log_file_path.exists():
                                # Read last 30 lines (sufficient for completion detection)
                                with open(log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                    lines = f.readlines()
                                    last_lines = ''.join(lines[-30:]) if len(lines) > 30 else ''.join(lines)
                                
                                # Check for failure markers first (universal across all frameworks)
                                if "KeyboardInterrupt" in last_lines:
                                    log_status = "failed"
                                    error_msg = "Training interrupted by user (Ctrl+C)"
                                elif "Error:" in last_lines or "ERROR:" in last_lines:
                                    log_status = "failed"
                                    error_msg = "Training failed with error (see log)"
                                elif "Exception:" in last_lines or "Traceback" in last_lines:
                                    log_status = "failed"
                                    error_msg = "Training failed with exception (see log)"
                                elif "CUDA out of memory" in last_lines:
                                    log_status = "failed"
                                    error_msg = "Training failed: GPU out of memory"
                                elif "RuntimeError" in last_lines:
                                    log_status = "failed"
                                    error_msg = "Training failed with runtime error"
                                # Check for success markers (framework-specific)
                                elif "Results saved to" in last_lines:
                                    # YOLO/Ultralytics success
                                    log_status = "completed"
                                elif "Training complete" in last_lines or "Finished training" in last_lines:
                                    # Generic PyTorch/Detectron2 success
                                    log_status = "completed"
                                elif "Saving checkpoint" in last_lines or "Model saved" in last_lines:
                                    # MMDetection/PyTorch checkpointing success
                                    log_status = "completed"
                                else:
                                    # No clear success marker - mark as incomplete (possible crash)
                                    log_status = "failed"
                                    error_msg = "Training incomplete (no completion marker found in log)"
                            else:
                                # Log file doesn't exist - mark as failed
                                log_status = "failed"
                                error_msg = "Training log file not found"
                                
                        except Exception as e:
                            # Error reading log - default to completed for safety
                            logger.warning("operations.training", f"Could not read log file for session '{session.name}': {e}", "log_read_error", {
                                "session_id": session.id,
                                "error": str(e)
                            })
                        
                        # Update session status based on log analysis
                        session.status = log_status
                        if error_msg:
                            session.error_msg = error_msg
                        session.completed_at = datetime.utcnow()
                        db.commit()
                        
                        # Log the result
                        if log_status == "completed":
                            logger.info("operations.training", f"Training process {pid} for session '{session.name}' completed successfully.", "process_completed", {
                                "session_id": session.id,
                                "pid": pid
                            })
                        else:
                            logger.error("operations.training", f"Training process {pid} for session '{session.name}' failed: {error_msg}", "process_failed", {
                                "session_id": session.id,
                                "pid": pid,
                                "error": error_msg
                            })
                        
            finally:
                db.close()
                
        except Exception as e:
            logger.error("operations.training", "Error in health checker", "health_check_error", {"error": str(e)})
            
        # Wait 1 second before next check (fast response on modern hardware)
        time.sleep(1)

def start_training_health_checker():
    """Starts the health checker in a background thread"""
    thread = threading.Thread(target=check_training_health, daemon=True)
    thread.start()
