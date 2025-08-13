"""
Professional Logging System Package

This package provides a comprehensive, structured logging system for the application.
It includes JSON-formatted logs, multiple categories, automatic rotation, and performance tracking.
"""

# Import directly since this directory has a hyphen and can't be a proper package
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from professional_logger import (
    get_professional_logger,
    log_info,
    log_error,
    log_warning,
    log_critical
)

__all__ = [
    'get_professional_logger',
    'log_info',
    'log_error',
    'log_warning',
    'log_critical'
]
