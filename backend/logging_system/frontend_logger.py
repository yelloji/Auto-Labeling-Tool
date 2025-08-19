"""
Frontend Logger for SYA App
==========================
Handles frontend logging and sends logs to backend logging system.
Provides unified logging between frontend and backend.
"""

import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional, Union
from professional_logger import get_professional_logger

class FrontendLogger:
    """
    Frontend logger that sends logs to backend logging system.
    Provides unified logging between frontend and backend.
    """
    
    def __init__(self):
        """Initialize frontend logger."""
        self.backend_logger = get_professional_logger()
        self.api_base_url = "http://localhost:12000"  # Backend API URL
        self.session_id = self._generate_session_id()
        self.user_id = None
        self.request_id = None
        
    def _generate_session_id(self) -> str:
        """Generate unique session ID for frontend session."""
        import uuid
        return str(uuid.uuid4())
    
    def set_user_id(self, user_id: str):
        """Set user ID for logging context."""
        self.user_id = user_id
        
    def set_request_id(self, request_id: str):
        """Set request ID for logging context."""
        self.request_id = request_id
    
    def _send_to_backend(self, level: str, category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
        """
        Send log to backend logging system.
        
        Args:
            level: Log level (INFO, WARNING, ERROR, DEBUG)
            category: Log category (app.frontend, operations.images, etc.)
            operation: Operation name
            message: Log message
            details: Additional details
        """
        try:
            log_data = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": level,
                "category": category,
                "operation": operation,
                "message": message,
                "logger_name": "frontend_logger",
                "request_id": self.request_id,
                "user_id": self.user_id,
                "session_id": self.session_id,
                "details": details or {},
                "source": "frontend"
            }
            
            # Send to backend API
            response = requests.post(
                f"{self.api_base_url}/api/v1/logs/frontend",
                json=log_data,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            if response.status_code != 200:
                # Fallback to backend logger if API fails
                self.backend_logger._log(level, category, operation, message, details)
                
        except Exception as e:
            # Fallback to backend logger if request fails
            self.backend_logger._log(level, category, operation, message, details)
    
    def info(self, category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Log info level message."""
        self._send_to_backend("INFO", category, operation, message, details)
    
    def warning(self, category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Log warning level message."""
        self._send_to_backend("WARNING", category, operation, message, details)
    
    def error(self, category: str, operation: str, message: str, error: Optional[Exception] = None, details: Optional[Dict[str, Any]] = None):
        """Log error level message."""
        if error:
            error_details = {
                "error_type": type(error).__name__,
                "error_message": str(error),
                "traceback": self._get_traceback(error)
            }
            if details:
                error_details.update(details)
            details = error_details
        
        self._send_to_backend("ERROR", category, operation, message, details)
    
    def debug(self, category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Log debug level message."""
        self._send_to_backend("DEBUG", category, operation, message, details)
    
    def _get_traceback(self, error: Exception) -> str:
        """Get traceback string from exception."""
        import traceback
        return "".join(traceback.format_exception(type(error), error, error.__traceback__))
    
    # Frontend-specific logging methods
    def log_user_interaction(self, component: str, action: str, details: Optional[Dict[str, Any]] = None):
        """Log user interactions (clicks, form submissions, etc.)."""
        self.info("app.frontend.interactions", "user_interaction", f"User {action} in {component}", details)
    
    def log_page_navigation(self, from_page: str, to_page: str, details: Optional[Dict[str, Any]] = None):
        """Log page navigation events."""
        self.info("app.frontend.navigation", "page_navigation", f"Navigation from {from_page} to {to_page}", details)
    
    def log_api_call(self, endpoint: str, method: str, status: int, details: Optional[Dict[str, Any]] = None):
        """Log API calls from frontend."""
        level = "INFO" if status < 400 else "ERROR"
        self._send_to_backend(level, "app.api", "api_call", f"{method} {endpoint} - {status}", details)
    
    def log_component_lifecycle(self, component: str, lifecycle_event: str, details: Optional[Dict[str, Any]] = None):
        """Log component lifecycle events (mount, unmount, update)."""
        self.info("app.frontend.ui", "component_lifecycle", f"{component} {lifecycle_event}", details)
    
    def log_form_validation(self, form_name: str, validation_result: str, details: Optional[Dict[str, Any]] = None):
        """Log form validation events."""
        level = "INFO" if validation_result == "valid" else "WARNING"
        self._send_to_backend(level, "app.frontend.validation", "form_validation", f"{form_name} validation: {validation_result}", details)
    
    def log_file_operation(self, operation: str, file_name: str, details: Optional[Dict[str, Any]] = None):
        """Log file operations (upload, download, etc.)."""
        self.info("operations.images", "file_operation", f"{operation} {file_name}", details)
    
    def log_ui_event(self, event_type: str, component: str, details: Optional[Dict[str, Any]] = None):
        """Log UI events (hover, focus, blur, etc.)."""
        self.info("app.frontend.ui", "ui_event", f"{event_type} on {component}", details)

# Global frontend logger instance
frontend_logger = FrontendLogger()

def get_frontend_logger() -> FrontendLogger:
    """Get frontend logger instance."""
    return frontend_logger

# Convenience functions for easy logging
def log_frontend_info(category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
    """Log frontend info message."""
    frontend_logger.info(category, operation, message, details)

def log_frontend_warning(category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
    """Log frontend warning message."""
    frontend_logger.warning(category, operation, message, details)

def log_frontend_error(category: str, operation: str, message: str, error: Optional[Exception] = None, details: Optional[Dict[str, Any]] = None):
    """Log frontend error message."""
    frontend_logger.error(category, operation, message, error, details)

def log_frontend_debug(category: str, operation: str, message: str, details: Optional[Dict[str, Any]] = None):
    """Log frontend debug message."""
    frontend_logger.debug(category, operation, message, details)

# Frontend-specific convenience functions
def log_user_click(component: str, action: str, details: Optional[Dict[str, Any]] = None):
    """Log user click events."""
    frontend_logger.log_user_interaction(component, f"clicked {action}", details)

def log_form_submit(form_name: str, success: bool, details: Optional[Dict[str, Any]] = None):
    """Log form submission events."""
    result = "successful" if success else "failed"
    frontend_logger.log_user_interaction(form_name, f"submitted {result}", details)

def log_page_view(page_name: str, details: Optional[Dict[str, Any]] = None):
    """Log page view events."""
    frontend_logger.log_page_navigation("", page_name, details)

def log_api_request(endpoint: str, method: str, status: int, response_time: Optional[float] = None):
    """Log API request events."""
    details = {"response_time_ms": response_time} if response_time else None
    frontend_logger.log_api_call(endpoint, method, status, details)
