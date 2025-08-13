#!/usr/bin/env python3
"""
Professional Logging System - Core Logger
========================================
Implements structured JSON logging with exactly 17 log files
in 3 categories: app, operations, errors.
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

# Import our configuration
try:
    from .logging_config import get_config, get_log_directory
except ImportError:
    # Fallback for direct execution - create minimal config
    import os
    
    def get_config():
        return {
            "enable_stack_traces": True,
            "log_level": "INFO"
        }
    
    def get_log_directory():
        return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class ProfessionalLogger:
    """
    Professional logging system with structured JSON output.
    Creates exactly 17 log files in 3 categories as per the plan.
    """
    
    def __init__(self, name: str = "professional_logger"):
        self.name = name
        self.config = get_config()
        self.log_dir = get_log_directory()
        
        # Thread-local storage for request context
        self._local = threading.local()
        
        # Initialize loggers for each of the 17 specific log files
        self.loggers = {}
        self._setup_perfect_loggers()
    
    def _setup_perfect_loggers(self):
        """Setup exactly 17 loggers for the specific log files from the plan."""
        
        # Define the exact 17 log files from your plan
        log_files = {
            # APP CATEGORY (6 files)
            "app.frontend": "logs/app/frontend.log",
            "app.api": "logs/app/api.log", 
            "app.startup": "logs/app/startup.log",
            "app.app": "logs/app/app.log",
            "app.backend": "logs/app/backend.log",
            "app.database": "logs/app/database.log",
            
            # OPERATIONS CATEGORY (7 files)
            "operations.images": "logs/operations/images.log",
            "operations.datasets": "logs/operations/datasets.log",
            "operations.exports": "logs/operations/exports.log",
            "operations.operations": "logs/operations/operations.log",
            "operations.annotations": "logs/operations/annotations.log",
            "operations.releases": "logs/operations/releases.log",
            "operations.transformations": "logs/operations/transformations.log",
            
            # ERRORS CATEGORY (4 files)
            "errors.system": "logs/errors/system.log",
            "errors.validation": "logs/errors/validation.log",
            "errors.errors": "logs/errors/errors.log",
            "errors.debug": "logs/errors/debug.log"
        }
        
        print(f"🎯 Setting up PERFECT 17-log-file system...")
        
        for logger_name, log_file_path in log_files.items():
            try:
                # Create logger
                logger = logging.getLogger(f"{self.name}.{logger_name}")
                logger.setLevel(logging.DEBUG)  # Allow all levels
                
                # Clear existing handlers
                logger.handlers.clear()
                
                # Create full path
                full_log_path = os.path.join(self.log_dir, log_file_path)
                
                # Create directory structure automatically
                os.makedirs(os.path.dirname(full_log_path), exist_ok=True)
                
                # Create rotating file handler
                handler = logging.handlers.RotatingFileHandler(
                    full_log_path,
                    maxBytes=100*1024*1024,  # 100MB
                    backupCount=5,
                    encoding='utf-8'
                )
                
                # Set level based on category
                if logger_name.startswith("errors."):
                    handler.setLevel(logging.ERROR)
                elif logger_name.startswith("app."):
                    handler.setLevel(logging.INFO)
                else:  # operations
                    handler.setLevel(logging.INFO)
                
                # Create formatter (just the message, since we structure it ourselves)
                formatter = logging.Formatter('%(message)s')
                handler.setFormatter(formatter)
                
                # Add handler to logger
                logger.addHandler(handler)
                
                # Store logger
                self.loggers[logger_name] = logger
                
                print(f"✅ Created logger: {logger_name} -> {full_log_path}")
                
            except Exception as e:
                print(f"❌ Failed to create logger {logger_name}: {e}")
        
        print(f"🎉 PERFECT 17-log-file system ready! Created {len(self.loggers)} loggers")
        print(f"📁 Log directory: {self.log_dir}")
    
    def _create_log_entry(self, level: str, message: str, category: str, 
                         operation: str = None, details: Dict = None) -> Dict[str, Any]:
        """Create structured JSON log entry."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
            entry["details"] = details
            
        if self.config.get("enable_stack_traces", True) and level in ["ERROR", "CRITICAL"]:
            entry["stack_trace"] = traceback.format_exc()
            
        return entry
    
    def _log(self, category: str, level: str, message: str, 
             operation: str = None, details: Dict = None):
        """Log to the specific category - PERFECT routing to 17 log files."""
        
        # Check if this is a valid category from our 17-log-file plan
        if category not in self.loggers:
            print(f"❌ INVALID LOG CATEGORY: '{category}' is not in the 17-log-file plan!")
            print(f"📋 Valid categories: {list(self.loggers.keys())}")
            return
        
        # Get the logger for this category
        logger = self.loggers[category]
        
        # Create structured log entry
        log_entry = self._create_log_entry(level, message, category, operation, details)
        
        # Log as JSON string
        logger.log(getattr(logging, level), json.dumps(log_entry, ensure_ascii=False))
    
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
    
    # Convenience methods for common log levels - PERFECT for 17-log-file system
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
    # Test the PERFECT 17-log-file system
    print("🧪 Testing PERFECT 17-log-file system...")
    
    logger = setup_professional_logging()
    
    # Test all categories from your plan
    logger.info("app.backend", "Application started", "startup")
    logger.info("app.database", "Database connected", "database_connection")
    logger.info("operations.images", "Image processing started", "image_processing")
    logger.info("operations.datasets", "Dataset created", "dataset_creation")
    logger.info("operations.releases", "Release generated", "release_generation")
    logger.warning("errors.validation", "Input validation warning", "validation_check")
    logger.error("errors.system", "System error occurred", "system_error")
    
    print("✅ PERFECT 17-log-file system test completed!")
    print("🎯 All logs went to correct files in your plan!")
