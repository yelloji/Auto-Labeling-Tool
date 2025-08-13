#!/usr/bin/env python3
"""
Professional Logging System - Core Logger
========================================
Implements structured JSON logging with multiple categories, rotation,
and performance tracking for the image labeling application.
"""

import os
import json
import logging
import logging.handlers
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Union
from pathlib import Path
import traceback
import uuid
import time
import psutil
import threading
from functools import wraps

# Import our configuration
from logging_config import get_config, get_log_directory

class ProfessionalLogger:
    """
    Professional logging system with structured JSON output,
    multiple categories, and performance tracking.
    """
    
    def __init__(self, name: str = "professional_logger"):
        self.name = name
        self.config = get_config()
        self.log_dir = get_log_directory()
        self.request_id = None
        self.user_id = None
        self.session_id = None
        
        # Initialize loggers for each category
        self.loggers = {}
        self._setup_loggers()
        
        # Performance tracking
        self.performance_enabled = self.config.get("enable_performance", True)
        self.audit_enabled = self.config.get("enable_audit", True)
        
        # Thread-local storage for request context
        self._local = threading.local()
        
        # Log system initialization (skip during setup to avoid recursion)
        # self._log("app", "INFO", "Professional logging system initialized", "system_init", {
        #     "config": {
        #         "log_level": self.config.get("log_level"),
        #         "rotation_interval": self.config.get("rotation_interval"),
        #         "retention_days": self.config.get("retention_days"),
        #         "performance_enabled": self.performance_enabled,
        #         "audit_enabled": self.audit_enabled
        #     }
        # })
    
    def _setup_loggers(self):
        """Setup individual loggers for each category - dynamic creation with detailed file structure."""
        categories = self.config.get("categories", {})
        print(f"Setting up loggers for {len(categories)} categories...")
        
        for category_name, category_config in categories.items():
            if not category_config.get("enabled", True):
                continue
            
            print(f"Setting up category: {category_name}")
            
            # Get detailed files configuration for this category
            files_config = category_config.get("files", {})
            
            # If no detailed files config, create basic category logger
            if not files_config:
                print(f"  Creating basic logger for {category_name}")
                self._create_category_logger(category_name, category_config)
                continue
            
            # Create detailed file loggers for this category
            print(f"  Creating detailed loggers for {category_name} with {len(files_config)} files")
            for file_name, file_config in files_config.items():
                if not file_config.get("enabled", True):
                    continue
                
                print(f"    Creating logger: {category_name}.{file_name}")
                
                # Create logger name with file suffix
                logger_name = f"{self.name}.{category_name}.{file_name}"
                logger = logging.getLogger(logger_name)
                logger.setLevel(getattr(logging, file_config.get("level", category_config.get("level", "INFO"))))
                
                # Clear existing handlers
                logger.handlers.clear()
                
                # Create detailed log file path
                log_file = os.path.join(self.log_dir, category_name, f"{file_name}.log")
                
                # Automatically create directory if it doesn't exist
                os.makedirs(os.path.dirname(log_file), exist_ok=True)
                
                # Get configuration for this category
                max_bytes = self._parse_size(category_config.get("max_size", "50MB"))
                backup_count = category_config.get("backup_count", 5)
                
                # Create rotating file handler
                handler = logging.handlers.RotatingFileHandler(
                    log_file,
                    maxBytes=max_bytes,
                    backupCount=backup_count,
                    encoding='utf-8'
                )
                
                # Create formatter
                formatter = logging.Formatter('%(message)s')
                handler.setFormatter(formatter)
                
                # Add handler to logger
                logger.addHandler(handler)
                
                # Store logger with detailed name
                self.loggers[f"{category_name}.{file_name}"] = logger
                print(f"      Created logger: {category_name}.{file_name} -> {log_file}")
        
        print(f"Total loggers created: {len(self.loggers)}")
        print(f"Logger names: {list(self.loggers.keys())}")
        
        # PHASE 1: Validate no duplication
        self._validate_no_duplication()
    
    def _create_category_logger(self, category_name: str, category_config: Dict):
        """Create basic category logger (fallback method)."""
        logger = logging.getLogger(f"{self.name}.{category_name}")
        logger.setLevel(getattr(logging, category_config.get("level", "INFO")))
        
        # Clear existing handlers
        logger.handlers.clear()
        
        # Dynamically create log file path
        log_file = os.path.join(self.log_dir, category_name, f"{category_name}.log")
        
        # Automatically create directory if it doesn't exist
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        
        # Get configuration for this category
        max_bytes = self._parse_size(category_config.get("max_size", "50MB"))
        backup_count = category_config.get("backup_count", 5)
        
        # Create rotating file handler
        handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        
        # Create formatter
        formatter = logging.Formatter('%(message)s')
        handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(handler)
        
        # Store logger
        self.loggers[category_name] = logger
    
    def _create_fallback_logger(self, category: str):
        """Create a fallback logger when the requested category doesn't exist."""
        try:
            # Create a basic logger for this category
            logger = logging.getLogger(f"{self.name}.{category}")
            logger.setLevel(logging.INFO)
            
            # Clear existing handlers
            logger.handlers.clear()
            
            # Create log file path
            log_file = os.path.join(self.log_dir, category, f"{category}.log")
            
            # Automatically create directory if it doesn't exist
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            
            # Create rotating file handler
            handler = logging.handlers.RotatingFileHandler(
                log_file,
                maxBytes=50*1024*1024,  # 50MB
                backupCount=5,
                encoding='utf-8'
            )
            
            # Create formatter
            formatter = logging.Formatter('%(message)s')
            handler.setFormatter(formatter)
            
            # Add handler to logger
            logger.addHandler(handler)
            
            # Store logger
            self.loggers[category] = logger
            
            print(f"PHASE 1: Created fallback logger for category: {category}")
            
        except Exception as e:
            print(f"PHASE 1 ERROR: Failed to create fallback logger for {category}: {e}")
    
    def _validate_no_duplication(self):
        """PHASE 1: Validate that no duplication exists between basic and detailed loggers."""
        basic_categories = set()
        detailed_categories = set()
        
        for logger_name in self.loggers.keys():
            if '.' in logger_name:
                detailed_categories.add(logger_name)
                base_category = logger_name.split('.')[0]
                basic_categories.add(base_category)
            else:
                basic_categories.add(logger_name)
        
        # Check for potential duplication
        for basic_cat in basic_categories:
            if basic_cat in detailed_categories:
                print(f"PHASE 1 WARNING: Potential duplication detected for '{basic_cat}'")
                print(f"  - Basic logger: {basic_cat}")
                print(f"  - Detailed loggers: {[d for d in detailed_categories if d.startswith(f'{basic_cat}.')]}")
        
        print(f"PHASE 1: Validation complete - {len(basic_categories)} basic, {len(detailed_categories)} detailed loggers")
        return len(basic_categories) + len(detailed_categories)
    
    def _parse_size(self, size_str: str) -> int:
        """Parse size string like '50MB' to bytes."""
        size_str = size_str.upper()
        if size_str.endswith('MB'):
            return int(size_str[:-2]) * 1024 * 1024
        elif size_str.endswith('KB'):
            return int(size_str[:-2]) * 1024
        elif size_str.endswith('GB'):
            return int(size_str[:-2]) * 1024 * 1024 * 1024
        else:
            return int(size_str)
    
    def _create_log_entry(self, level: str, message: str, category: str, 
                         operation: str = None, details: Dict = None) -> Dict[str, Any]:
        """Create structured log entry."""
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
        """Internal logging method - PHASE 1 FIX: Prevent duplication and route to specific files only."""
        logger = None
        
        # PHASE 1 FIX: Route to specific detailed files only, prevent duplication
        if '.' in category:
            # If category already has a dot (e.g., "app.frontend"), use it directly
            if category in self.loggers:
                logger = self.loggers[category]
            else:
                # Try to find a matching detailed logger
                for logger_name in self.loggers.keys():
                    if logger_name == category:
                        logger = self.loggers[logger_name]
                        break
        else:
            # If basic category (e.g., "app"), route to the most appropriate detailed logger
            # PHASE 1 FIX: Prefer specific detailed loggers over basic ones
            detailed_logger_found = False
            
            # First, try to find a detailed logger for this category
            for logger_name in self.loggers.keys():
                if logger_name.startswith(f"{category}."):
                    # PHASE 1 FIX: Route to the first detailed logger found
                    logger = self.loggers[logger_name]
                    detailed_logger_found = True
                    print(f"PHASE 1: Routing '{category}' to detailed logger '{logger_name}'")
                    break
            
            # If no detailed logger found, only then try basic category
            if not detailed_logger_found:
                if category in self.loggers:
                    logger = self.loggers[category]
                    print(f"PHASE 1: Using basic logger for '{category}' (no detailed logger found)")
                else:
                    # Final fallback: create a fallback logger
                    print(f"PHASE 1: Creating fallback logger for '{category}'")
                    self._create_fallback_logger(category)
                    logger = self.loggers.get(category)
        
        if logger is None:
            print(f"PHASE 1 ERROR: Could not find or create logger for category '{category}'")
            return
            
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
    
    # Category-specific logging methods
    def app(self, level: str, message: str, operation: str = None, details: Dict = None):
        """Log to app category."""
        self._log("app", level, message, operation, details)
    
    def operations(self, level: str, message: str, operation: str = None, details: Dict = None):
        """Log to operations category."""
        self._log("operations", level, message, operation, details)
    
    def errors(self, level: str, message: str, operation: str = None, details: Dict = None):
        """Log to errors category."""
        self._log("errors", level, message, operation, details)
    
    def performance(self, level: str, message: str, operation: str = None, details: Dict = None):
        """Log to performance category."""
        if self.performance_enabled:
            self._log("performance", level, message, operation, details)
    
    def audit(self, level: str, message: str, operation: str = None, details: Dict = None):
        """Log to audit category."""
        if self.audit_enabled:
            self._log("audit", level, message, operation, details)
    
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
    
    # Performance tracking methods
    def track_api_response_time(self, endpoint: str, method: str, response_time: float, 
                              status_code: int = None, details: Dict = None):
        """Track API response time."""
        if not self.performance_enabled:
            return
            
        slow_threshold = self.config.get("performance", {}).get("slow_api_threshold", 2.0)
        level = "WARNING" if response_time > slow_threshold else "INFO"
        
        self.performance(level, f"API {method} {endpoint} completed", "api_response", {
            "endpoint": endpoint,
            "method": method,
            "response_time_seconds": response_time,
            "status_code": status_code,
            "is_slow": response_time > slow_threshold,
            **(details or {})
        })
    
    def track_database_query_time(self, query: str, query_time: float, 
                                table: str = None, details: Dict = None):
        """Track database query time."""
        if not self.performance_enabled:
            return
            
        slow_threshold = self.config.get("performance", {}).get("slow_query_threshold", 1.0)
        level = "WARNING" if query_time > slow_threshold else "INFO"
        
        self.performance(level, f"Database query completed", "database_query", {
            "query": query[:200] + "..." if len(query) > 200 else query,
            "query_time_seconds": query_time,
            "table": table,
            "is_slow": query_time > slow_threshold,
            **(details or {})
        })
    
    def track_memory_usage(self, operation: str = None, details: Dict = None):
        """Track memory usage."""
        if not self.performance_enabled:
            return
            
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            
            self.performance("INFO", "Memory usage tracked", "memory_usage", {
                "rss_mb": memory_info.rss / 1024 / 1024,
                "vms_mb": memory_info.vms / 1024 / 1024,
                "percent": process.memory_percent(),
                "operation": operation,
                **(details or {})
            })
        except Exception as e:
            self.error("performance", f"Failed to track memory usage: {e}")
    
    def track_cpu_usage(self, operation: str = None, details: Dict = None):
        """Track CPU usage."""
        if not self.performance_enabled:
            return
            
        try:
            process = psutil.Process()
            cpu_percent = process.cpu_percent()
            
            self.performance("INFO", "CPU usage tracked", "cpu_usage", {
                "cpu_percent": cpu_percent,
                "operation": operation,
                **(details or {})
            })
        except Exception as e:
            self.error("performance", f"Failed to track CPU usage: {e}")
    
    # Audit tracking methods
    def track_user_action(self, user_id: str, action: str, resource: str = None, 
                         details: Dict = None):
        """Track user actions for audit."""
        if not self.audit_enabled:
            return
            
        self.audit("INFO", f"User action: {action}", "user_action", {
            "user_id": user_id,
            "action": action,
            "resource": resource,
            **(details or {})
        })
    
    def track_api_call(self, user_id: str, endpoint: str, method: str, 
                      status_code: int, details: Dict = None):
        """Track API calls for audit."""
        if not self.audit_enabled:
            return
            
        self.audit("INFO", f"API call: {method} {endpoint}", "api_call", {
            "user_id": user_id,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            **(details or {})
        })
    
    def track_file_operation(self, operation: str, file_path: str, 
                           user_id: str = None, details: Dict = None):
        """Track file operations for audit."""
        if not self.audit_enabled:
            return
            
        self.audit("INFO", f"File operation: {operation}", "file_operation", {
            "operation": operation,
            "file_path": file_path,
            "user_id": user_id,
            **(details or {})
        })
    
    # Decorators for automatic tracking
    def track_performance(self, category: str = "performance"):
        """Decorator to track function performance."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    execution_time = time.time() - start_time
                    
                    self.performance("INFO", f"Function {func.__name__} completed", 
                                   "function_execution", {
                        "function_name": func.__name__,
                        "execution_time_seconds": execution_time,
                        "success": True
                    })
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    self.performance("ERROR", f"Function {func.__name__} failed", 
                                   "function_execution", {
                        "function_name": func.__name__,
                        "execution_time_seconds": execution_time,
                        "success": False,
                        "error": str(e)
                    })
                    raise
            return wrapper
        return decorator
    
    def track_operation(self, operation_name: str, category: str = "operations"):
        """Decorator to track operations."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:
                    self.operations("INFO", f"Starting operation: {operation_name}", 
                                  operation_name)
                    result = func(*args, **kwargs)
                    self.operations("INFO", f"Operation completed: {operation_name}", 
                                  operation_name)
                    return result
                except Exception as e:
                    self.operations("ERROR", f"Operation failed: {operation_name}", 
                                  operation_name, {"error": str(e)})
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
    # Test the logger
    logger = setup_professional_logging()
    
    # Test basic logging
    logger.info("app", "Application started", "startup")
    logger.info("operations", "Image processing started", "image_processing")
    logger.warning("errors", "Minor warning occurred", "validation")
    
    # Test performance tracking
    logger.track_api_response_time("/api/images", "GET", 1.5, 200)
    logger.track_memory_usage("test_operation")
    
    # Test audit tracking
    logger.track_user_action("user123", "upload_image", "images/photo.jpg")
    
    print("✅ Professional logger test completed!")
