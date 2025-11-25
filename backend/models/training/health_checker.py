import time
import threading
import psutil
import os
from datetime import datetime
from database.session import SessionLocal
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
                        # Process is gone!
                        logger.info("operations.training", f"Training process {pid} for session '{session.name}' is gone. Marking as completed.", "process_gone", {
                            "session_id": session.id,
                            "pid": pid
                        })
                        
                        # Mark as completed
                        # TODO: In the future, parse logs to distinguish 'failed' vs 'completed'
                        session.status = "completed"
                        session.completed_at = datetime.utcnow()
                        db.commit()
                        
            finally:
                db.close()
                
        except Exception as e:
            logger.error("operations.training", "Error in health checker", "health_check_error", {"error": str(e)})
            
        # Wait 5 seconds before next check
        time.sleep(5)

def start_training_health_checker():
    """Starts the health checker in a background thread"""
    thread = threading.Thread(target=check_training_health, daemon=True)
    thread.start()
