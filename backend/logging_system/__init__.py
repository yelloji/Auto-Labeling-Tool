"""
Professional Logging System Package

This package provides a comprehensive, structured logging system for the application.
It includes JSON-formatted logs with exactly 17 log files in 3 categories: app, operations, errors.
"""

# Import directly since this directory has a hyphen and can't be a proper package
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Initialize the professional logger for this package
from professional_logger import get_professional_logger

# Get logger for this package initialization
logger = get_professional_logger()

# Log package initialization
logger.info("app.backend", "Professional logging system package initialized", "package_init", {
    "package": "backend.logging_system",
    "status": "initialized",
    "log_files": 17,
    "categories": ["app", "operations", "errors"],
    "timestamp": "package_import_time",
    "purpose": "logging_system_initialization"
})

# Import all public functions
from professional_logger import (
    get_professional_logger,
    log_info,
    log_error,
    log_warning,
    log_critical,
    log_debug,
    setup_professional_logging,
    ProfessionalLogger
)

__all__ = [
    'get_professional_logger',
    'log_info',
    'log_error',
    'log_warning',
    'log_critical',
    'log_debug',
    'setup_professional_logging',
    'ProfessionalLogger'
]

# Log successful import completion
logger.info("app.backend", "All logging functions imported successfully", "import_completion", {
    "imported_functions": len(__all__),
    "package": "backend.logging_system",
    "status": "ready"
})
