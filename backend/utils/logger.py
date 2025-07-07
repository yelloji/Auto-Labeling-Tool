#!/usr/bin/env python3
"""
Enhanced Logging System for SYA App Backend
==========================================
Comprehensive logging with timestamps, operation tracking, and file rotation.
"""

import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
import json
import traceback
from functools import wraps
import time

class SYALogger:
    def __init__(self, name="sya_backend", log_dir="../../logs"):
        self.name = name
        # Use absolute path to root logs folder
        self.log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), log_dir))
        self.setup_logging()
        
    def setup_logging(self):
        """Setup comprehensive logging configuration"""
        # Create logs directory if it doesn't exist
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
        
        # Create logger
        self.logger = logging.getLogger(self.name)
        self.logger.setLevel(logging.DEBUG)
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Create formatters
        detailed_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        simple_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # File handlers with rotation
        self.setup_file_handlers(detailed_formatter, simple_formatter)
        
        # Console handler
        self.setup_console_handler(simple_formatter)
        
    def setup_file_handlers(self, detailed_formatter, simple_formatter):
        """Setup rotating file handlers for different log types"""
        
        # Main application log (detailed)
        main_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'backend_main.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        main_handler.setLevel(logging.DEBUG)
        main_handler.setFormatter(detailed_formatter)
        self.logger.addHandler(main_handler)
        
        # API operations log
        api_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'backend_api.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        api_handler.setLevel(logging.INFO)
        api_handler.setFormatter(simple_formatter)
        api_handler.addFilter(self.api_filter)
        self.logger.addHandler(api_handler)
        
        # Database operations log
        db_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'backend_database.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        db_handler.setLevel(logging.INFO)
        db_handler.setFormatter(simple_formatter)
        db_handler.addFilter(self.db_filter)
        self.logger.addHandler(db_handler)
        
        # Transformation operations log
        transform_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'backend_transformations.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        transform_handler.setLevel(logging.INFO)
        transform_handler.setFormatter(simple_formatter)
        transform_handler.addFilter(self.transform_filter)
        self.logger.addHandler(transform_handler)
        
        # Error log (errors only)
        error_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'backend_errors.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(detailed_formatter)
        self.logger.addHandler(error_handler)
    
    def setup_console_handler(self, formatter):
        """Setup console handler for development"""
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
    
    def api_filter(self, record):
        """Filter for API-related logs"""
        api_keywords = ['API', 'endpoint', 'request', 'response', 'HTTP', 'GET', 'POST', 'PUT', 'DELETE']
        return any(keyword.lower() in record.getMessage().lower() for keyword in api_keywords)
    
    def db_filter(self, record):
        """Filter for database-related logs"""
        db_keywords = ['database', 'db', 'query', 'SQL', 'table', 'insert', 'update', 'delete', 'select']
        return any(keyword.lower() in record.getMessage().lower() for keyword in db_keywords)
    
    def transform_filter(self, record):
        """Filter for transformation-related logs"""
        transform_keywords = ['transformation', 'transform', 'release', 'status', 'PENDING', 'COMPLETED']
        return any(keyword.lower() in record.getMessage().lower() for keyword in transform_keywords)
    
    def log_api_request(self, method, endpoint, params=None, body=None):
        """Log API request details"""
        self.logger.info(f"API REQUEST | {method} {endpoint} | Params: {params} | Body: {self._safe_json(body)}")
    
    def log_api_response(self, method, endpoint, status_code, response_data=None, duration=None):
        """Log API response details"""
        duration_str = f" | Duration: {duration:.3f}s" if duration else ""
        self.logger.info(f"API RESPONSE | {method} {endpoint} | Status: {status_code}{duration_str} | Data: {self._safe_json(response_data)}")
    
    def log_database_operation(self, operation, table, data=None, result=None):
        """Log database operations"""
        self.logger.info(f"DATABASE | {operation} | Table: {table} | Data: {self._safe_json(data)} | Result: {self._safe_json(result)}")
    
    def log_transformation_operation(self, operation, transform_id=None, status=None, details=None):
        """Log transformation-specific operations"""
        self.logger.info(f"TRANSFORMATION | {operation} | ID: {transform_id} | Status: {status} | Details: {self._safe_json(details)}")
    
    def log_error(self, error, context=None):
        """Log errors with full traceback"""
        error_msg = f"ERROR | {str(error)}"
        if context:
            error_msg += f" | Context: {self._safe_json(context)}"
        error_msg += f" | Traceback: {traceback.format_exc()}"
        self.logger.error(error_msg)
    
    def _safe_json(self, data):
        """Safely convert data to JSON string"""
        if data is None:
            return "None"
        try:
            if isinstance(data, (dict, list)):
                return json.dumps(data, default=str)[:500]  # Limit length
            return str(data)[:500]
        except:
            return str(data)[:500]

# Global logger instance
sya_logger = SYALogger()

def log_api_call(func):
    """Decorator to automatically log API calls"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        
        # Extract request info
        request = None
        for arg in args:
            if hasattr(arg, 'method') and hasattr(arg, 'url'):
                request = arg
                break
        
        if request:
            sya_logger.log_api_request(
                request.method, 
                str(request.url.path),
                dict(request.query_params) if request.query_params else None
            )
        
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            
            if request:
                sya_logger.log_api_response(
                    request.method,
                    str(request.url.path),
                    200,  # Assume success if no exception
                    None,  # Don't log full response data for brevity
                    duration
                )
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            
            if request:
                sya_logger.log_api_response(
                    request.method,
                    str(request.url.path),
                    500,  # Error status
                    str(e),
                    duration
                )
            
            sya_logger.log_error(e, {
                'function': func.__name__,
                'args': str(args)[:200],
                'kwargs': str(kwargs)[:200]
            })
            raise
    
    return wrapper

def log_db_operation(operation, table):
    """Decorator to log database operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                sya_logger.log_database_operation(operation, table, None, "Success")
                return result
            except Exception as e:
                sya_logger.log_database_operation(operation, table, None, f"Error: {str(e)}")
                sya_logger.log_error(e, {
                    'operation': operation,
                    'table': table,
                    'function': func.__name__
                })
                raise
        return wrapper
    return decorator

# Convenience functions
def log_info(message, context=None):
    """Log info message"""
    if context:
        message += f" | Context: {sya_logger._safe_json(context)}"
    sya_logger.logger.info(message)

def log_warning(message, context=None):
    """Log warning message"""
    if context:
        message += f" | Context: {sya_logger._safe_json(context)}"
    sya_logger.logger.warning(message)

def log_error(message, error=None, context=None):
    """Log error message"""
    if error:
        sya_logger.log_error(error, context)
    else:
        if context:
            message += f" | Context: {sya_logger._safe_json(context)}"
        sya_logger.logger.error(message)

def log_debug(message, context=None):
    """Log debug message"""
    if context:
        message += f" | Context: {sya_logger._safe_json(context)}"
    sya_logger.logger.debug(message)