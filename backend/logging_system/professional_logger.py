#!/usr/bin/env python3
"""
Professional Logging System - Core Logger
========================================
Implements structured JSON logging with exactly 17 log files
in 3 categories: app, operations, errors.
SIMPLE DUAL MODE: Developer mode (17 files) OR User mode (3 files)
"""

import os
import json
import logging
import logging.handlers
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pathlib import Path
import traceback
import threading
from functools import wraps
import asyncio
import queue
import time

# Import our configuration
try:
    from .logging_config import get_config, get_log_directory
except ImportError:
    # Fallback for direct execution - create minimal config
    import os
    
    def get_config():
        return {
            "enable_stack_traces": True,
            "log_level": "INFO",
            "logging_mode": "developer",  # "developer" or "user"
            "async_logging": True,
            "log_rotation_size_mb": 100,
            "log_rotation_backup_count": 5
        }
    
    def get_log_directory():
        return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class AsyncLogHandler:
    """Asynchronous log handler for performance optimization."""
    
    def __init__(self, max_queue_size=1000):
        self.queue = queue.Queue(maxsize=max_queue_size)
        self.worker_thread = None
        self.running = False
        self._start_worker()
    
    def _start_worker(self):
        """Start the background worker thread."""
        self.running = True
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
    
    def _worker_loop(self):
        """Background worker that processes log entries."""
        while self.running:
            try:
                # Get log entry with timeout
                entry = self.queue.get(timeout=1.0)
                if entry is None:  # Shutdown signal
                    break
                
                # Process the log entry
                self._write_log_entry(entry)
                self.queue.task_done()
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Log worker error: {e}")
    
    def _write_log_entry(self, entry):
        """Write log entry to file."""
        try:
            log_file = entry.get('log_file')
            message = entry.get('message')
            
            if log_file and message:
                # Ensure directory exists
                os.makedirs(os.path.dirname(log_file), exist_ok=True)
                
                # Write to file
                with open(log_file, 'a', encoding='utf-8') as f:
                    f.write(message + '\n')
                    
        except Exception as e:
            print(f"Failed to write log entry: {e}")
    
    def enqueue(self, log_file: str, message: str):
        """Enqueue a log entry for async processing."""
        try:
            self.queue.put_nowait({
                'log_file': log_file,
                'message': message,
                'timestamp': time.time()
            })
        except queue.Full:
            # If queue is full, write synchronously as fallback
            self._write_log_entry({'log_file': log_file, 'message': message})
    
    def shutdown(self):
        """Shutdown the async handler."""
        self.running = False
        if self.worker_thread:
            self.queue.put(None)  # Shutdown signal
            self.worker_thread.join(timeout=5.0)

class ProfessionalLogger:
    """
    Professional logging system with structured JSON output.
    SIMPLE DUAL MODE: Developer mode (17 files) OR User mode (3 files)
    """
    
    def __init__(self, name: str = "professional_logger"):
        self.name = name
        self.config = get_config()
        self.log_dir = get_log_directory()
        
        # Thread-local storage for request context
        self._local = threading.local()
        
        # Initialize async log handler
        self.async_handler = AsyncLogHandler() if self.config.get("async_logging", True) else None
        
        # Get logging mode
        self.logging_mode = self.config.get("logging_mode", "developer")
        
        # Initialize loggers based on mode
        self.loggers = {}
        self._setup_loggers()
    
    def _setup_loggers(self):
        """Setup loggers based on logging mode."""
        
        if self.logging_mode == "developer":
            self._setup_developer_loggers()
        else:  # user mode
            self._setup_user_loggers()
    
    def _setup_developer_loggers(self):
        """Setup exactly 17 loggers for developer mode with enhanced backend/frontend structure."""
        
        # Define the exact 17 log files with enhanced structure
        log_files = {
            # BACKEND APP CATEGORY (4 files)
            "app.backend": "develop-logs/backend/app/backend.log",
            "app.api": "develop-logs/backend/app/api.log", 
            "app.startup": "develop-logs/backend/app/startup.log",
            "app.database": "develop-logs/backend/app/database.log",
            
            # BACKEND OPERATIONS CATEGORY (7 files)
            "operations.images": "develop-logs/backend/operations/images.log",
            "operations.datasets": "develop-logs/backend/operations/datasets.log",
            "operations.exports": "develop-logs/backend/operations/exports.log",
            "operations.operations": "develop-logs/backend/operations/operations.log",
            "operations.annotations": "develop-logs/backend/operations/annotations.log",
            "operations.releases": "develop-logs/backend/operations/releases.log",
            "operations.transformations": "develop-logs/backend/operations/transformations.log",
            
            # BACKEND ERRORS CATEGORY (2 files)
            "errors.system": "develop-logs/backend/errors/system.log",
            "errors.validation": "develop-logs/backend/errors/validation.log",
            
            # FRONTEND CATEGORY (4 files)
            "app.frontend.interactions": "develop-logs/frontend/interactions.log",
            "app.frontend.ui": "develop-logs/frontend/ui.log",
            "app.frontend.navigation": "develop-logs/frontend/navigation.log",
            "app.frontend.validation": "develop-logs/frontend/validation.log"
        }
        
        print(f"🎯 Setting up DEVELOPER MODE - Enhanced 17-log-file system...")
        
        for logger_name, log_file_path in log_files.items():
            self._setup_logger(logger_name, log_file_path, "developer")
        
        print(f"🎉 DEVELOPER MODE ready! 17 loggers created in enhanced develop-logs/ structure:")
        print(f"   📁 Backend: 13 files (app: 4, operations: 7, errors: 2)")
        print(f"   📁 Frontend: 4 files (interactions, ui, navigation, validation)")
    
    def _setup_user_loggers(self):
        """Setup 3 simple loggers for user mode."""
        
        # Define 3 simple log files for user mode
        log_files = {
            "user.errors": "user-logs/errors.log",
            "user.warnings": "user-logs/warnings.log", 
            "user.info": "user-logs/info.log"
        }
        
        print(f"🎯 Setting up USER MODE - 3-log-file system...")
        
        for logger_name, log_file_path in log_files.items():
            self._setup_logger(logger_name, log_file_path, "user")
        
        print(f"🎉 USER MODE ready! 3 loggers created in user-logs/")
    
    def _setup_logger(self, logger_name: str, log_file_path: str, logger_type: str):
        """Setup individual logger with rotation and formatting."""
        try:
            # Create logger
            logger = logging.getLogger(f"{self.name}.{logger_name}")
            logger.setLevel(logging.DEBUG)
            
            # Clear existing handlers
            logger.handlers.clear()
            
            # Create full path
            full_log_path = os.path.join(self.log_dir, log_file_path)
            
            # Create directory structure automatically
            os.makedirs(os.path.dirname(full_log_path), exist_ok=True)
            
            # Get rotation settings from config
            max_bytes = self.config.get("log_rotation_size_mb", 100) * 1024 * 1024
            backup_count = self.config.get("log_rotation_backup_count", 5)
            
            # Create rotating file handler
            handler = logging.handlers.RotatingFileHandler(
                full_log_path,
                maxBytes=max_bytes,
                backupCount=backup_count,
                encoding='utf-8'
            )
            
            # Set level based on type
            if logger_type == "user":
                handler.setLevel(logging.INFO)
            else:  # developer
                if logger_name.startswith("errors."):
                    handler.setLevel(logging.ERROR)
                else:
                    handler.setLevel(logging.INFO)
            
            # Create formatter based on type
            if logger_type == "user":
                # User-friendly: Simple, clean format
                formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            else:
                # Developer: JSON format
                formatter = logging.Formatter('%(message)s')
            
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
            # Store logger
            self.loggers[logger_name] = logger
            
            print(f"✅ Created {logger_type} logger: {logger_name} -> {full_log_path}")
            
        except Exception as e:
            print(f"❌ Failed to create logger {logger_name}: {e}")
    
    def _create_log_entry(self, level: str, message: str, category: str, 
                         operation: str = None, details: Dict = None) -> Dict[str, Any]:
        """Create structured JSON log entry."""
        # Use consistent timestamp format matching frontend
        current_time = datetime.now(timezone.utc)
        timestamp = current_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        
        entry = {
            "timestamp": timestamp,
            "level": level,
            "category": category,
            "operation": operation or "general",
            "message": message,
            "logger_name": self.name,
            "request_id": getattr(self._local, 'request_id', None),
            "user_id": getattr(self._local, 'user_id', None),
            "session_id": getattr(self._local, 'session_id', None),
        }
        
        if details:
            # Convert any non-serializable objects to strings
            safe_details = {}
            
            # Check if details is a dictionary-like object
            if hasattr(details, 'items') and callable(getattr(details, 'items', None)):
                try:
                    for key, value in details.items():
                        try:
                            # Test if value is JSON serializable
                            json.dumps(value)
                            safe_details[key] = value
                        except (TypeError, ValueError):
                            safe_details[key] = str(value)
                except Exception as e:
                    # If items() fails, convert the whole object to string
                    safe_details = {"error": f"Failed to process details: {str(e)}", "original": str(details)}
            else:
                # If details is not a dictionary, convert it to string
                safe_details = {"value": str(details)}
            
            entry["details"] = safe_details
            
        if self.config.get("enable_stack_traces", True) and level in ["ERROR", "CRITICAL"]:
            entry["stack_trace"] = traceback.format_exc()
            
        return entry
    
    def _create_user_message(self, level: str, message: str, operation: str = None) -> str:
        """Create user-friendly log message."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if operation:
            return f"[{timestamp}] {level}: {message} (Operation: {operation})"
        else:
            return f"[{timestamp}] {level}: {message}"
    
    def _log(self, category: str, level: str, message: str, 
             operation: str = None, details: Dict = None):
        """Log based on current mode."""
        
        if self.logging_mode == "developer":
            self._log_developer(category, level, message, operation, details)
        else:  # user mode
            self._log_user(level, message, operation)
    
    def _log_developer(self, category: str, level: str, message: str, 
                      operation: str = None, details: Dict = None):
        """Log to developer mode - specific category files."""
        
        # Check if this is a valid category from our 17-log-file plan
        if category not in self.loggers:
            print(f"❌ INVALID LOG CATEGORY: '{category}' is not in the 17-log-file plan!")
            print(f"📋 Valid categories: {list(self.loggers.keys())}")
            return
        
        # Get the logger for this category
        logger = self.loggers[category]
        
        # Create structured log entry
        log_entry = self._create_log_entry(level, message, category, operation, details)
        
        # Format JSON with proper indentation for readability
        json_message = json.dumps(log_entry, ensure_ascii=False, indent=2)
        
        # Log as JSON string
        logger.log(getattr(logging, level), json_message)
    
    def _log_user(self, level: str, message: str, operation: str = None):
        """Log to user mode - simple files based on level."""
        
        user_message = self._create_user_message(level, message, operation)
        
        # Route to appropriate user log based on level
        if level in ["ERROR", "CRITICAL"]:
            log_file = os.path.join(self.log_dir, "user-logs/errors.log")
        elif level == "WARNING":
            log_file = os.path.join(self.log_dir, "user-logs/warnings.log")
        else:  # INFO, DEBUG
            log_file = os.path.join(self.log_dir, "user-logs/info.log")
        
        # Use async logging if enabled
        if self.async_handler:
            self.async_handler.enqueue(log_file, user_message)
        else:
            # Synchronous fallback
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(user_message + '\n')
    
    def set_context(self, request_id: str = None, user_id: str = None, session_id: str = None):
        """Set context for current request/operation."""
        if request_id:
            self._local.request_id = request_id
        if user_id:
            self._local.user_id = user_id
        if session_id:
            self._local.session_id = session_id
    
    def clear_context(self):
        """Clear current context."""
        self._local.request_id = None
        self._local.user_id = None
        self._local.session_id = None
    
    # Convenience methods for common log levels
    def info(self, category: str, message: str, operation: str = None, details: Dict = None):
        """Log info level message to specified category."""
        self._log(category, "INFO", message, operation, details)
    
    def warning(self, category: str, message: str, operation: str = None, details: Dict = None):
        """Log warning level message to specified category."""
        self._log(category, "WARNING", message, operation, details)
    
    def error(self, category: str, message: str, operation: str = None, details: Dict = None):
        """Log error level message to specified category."""
        self._log(category, "ERROR", message, operation, details)
    
    def critical(self, category: str, message: str, operation: str = None, details: Dict = None):
        """Log critical level message to specified category."""
        self._log(category, "CRITICAL", message, operation, details)
    
    def debug(self, category: str, message: str, operation: str = None, details: Dict = None):
        """Log debug level message to specified category."""
        self._log(category, "DEBUG", message, operation, details)
    
    # Decorator for automatic operation tracking
    def track_operation(self, operation_name: str, category: str = "operations.operations"):
        """Decorator to track operations."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:
                    self.info(category, f"Starting operation: {operation_name}", operation_name)
                    result = func(*args, **kwargs)
                    self.info(category, f"Operation completed: {operation_name}", operation_name)
                    return result
                except Exception as e:
                    self.error(category, f"Operation failed: {operation_name}", operation_name, {"error": str(e)})
                    raise
            return wrapper
        return decorator
    
    def shutdown(self):
        """Shutdown the logger and async handler."""
        if self.async_handler:
            self.async_handler.shutdown()

# Global logger instance
_professional_logger = None

def get_professional_logger() -> ProfessionalLogger:
    """Get or create the global professional logger instance."""
    global _professional_logger
    if _professional_logger is None:
        _professional_logger = ProfessionalLogger()
    return _professional_logger

def setup_professional_logging():
    """Setup professional logging system."""
    return get_professional_logger()

# Convenience functions for easy access
def log_info(category: str, message: str, operation: str = None, details: Dict = None):
    """Log info message to specified category."""
    get_professional_logger().info(category, message, operation, details)

def log_warning(category: str, message: str, operation: str = None, details: Dict = None):
    """Log warning message to specified category."""
    get_professional_logger().warning(category, message, operation, details)

def log_error(category: str, message: str, operation: str = None, details: Dict = None):
    """Log error message to specified category."""
    get_professional_logger().error(category, message, operation, details)

def log_critical(category: str, message: str, operation: str = None, details: Dict = None):
    """Log critical message to specified category."""
    get_professional_logger().critical(category, message, operation, details)

def log_debug(category: str, message: str, operation: str = None, details: Dict = None):
    """Log debug message to specified category."""
    get_professional_logger().debug(category, message, operation, details)

if __name__ == "__main__":
    # Test the SIMPLE DUAL LOGGING SYSTEM
    print("🧪 Testing SIMPLE DUAL LOGGING SYSTEM...")
    
    logger = setup_professional_logging()
    
    # Test developer mode
    logger.info("app.backend", "Application started", "startup")
    logger.info("app.database", "Database connected", "database_connection")
    logger.info("operations.images", "Image processing started", "image_processing")
    logger.info("operations.datasets", "Dataset created", "dataset_creation")
    logger.info("operations.releases", "Release generated", "release_generation")
    logger.warning("errors.validation", "Input validation warning", "validation_check")
    logger.error("errors.system", "System error occurred", "system_error")
    
    print("✅ SIMPLE DUAL LOGGING SYSTEM test completed!")
    print(f"🎯 Mode: {logger.logging_mode}")
    if logger.logging_mode == "developer":
        print("📁 Developer logs created in develop-logs/")
    else:
        print("📁 User logs created in user-logs/")
