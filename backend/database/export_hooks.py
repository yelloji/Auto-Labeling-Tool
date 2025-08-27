#!/usr/bin/env python3
"""
Database Export Hooks
====================
Integrates automatic database export with existing database operations.
Triggers exports when database changes occur through the application.
"""

import functools
from typing import Callable, Any
from logging_system.professional_logger import get_professional_logger

# Initialize logger
logger = get_professional_logger()

# Global flag to enable/disable auto-export
_auto_export_enabled = True
_exporter = None

def set_auto_export_enabled(enabled: bool):
    """Enable or disable automatic database export"""
    global _auto_export_enabled
    _auto_export_enabled = enabled
    logger.info("app.database", f"Auto-export {'enabled' if enabled else 'disabled'}", "auto_export_toggle", {
        "enabled": enabled
    })

def get_exporter():
    """Get the database exporter instance"""
    global _exporter
    if _exporter is None:
        try:
            from .auto_export import get_auto_exporter
            _exporter = get_auto_exporter()
        except ImportError as e:
            logger.error("app.database", "Failed to import auto_export module", "import_error", {
                "error": str(e)
            })
            _exporter = None
    return _exporter

def trigger_export():
    """Trigger database export if enabled"""
    if not _auto_export_enabled:
        return
    
    exporter = get_exporter()
    if exporter:
        try:
            # Use a separate thread to avoid blocking the main operation
            import threading
            export_thread = threading.Thread(target=exporter.export_now, daemon=True)
            export_thread.start()
            
            logger.debug("app.database", "Database export triggered", "export_triggered", {})
        except Exception as e:
            logger.error("app.database", "Failed to trigger database export", "export_trigger_error", {
                "error": str(e)
            })

def with_auto_export(func: Callable) -> Callable:
    """Decorator to automatically trigger export after database operations"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            # Execute the original function
            result = func(*args, **kwargs)
            
            # Trigger export after successful operation
            trigger_export()
            
            return result
        except Exception as e:
            # Don't trigger export on errors
            logger.debug("app.database", "Skipping export due to operation error", "export_skip_error", {
                "function": func.__name__,
                "error": str(e)
            })
            raise
    
    return wrapper

def patch_database_operations():
    """Patch existing database operations to include auto-export"""
    try:
        from . import operations
        
        # Patch Project operations
        if hasattr(operations, 'ProjectOperations'):
            operations.ProjectOperations.create_project = with_auto_export(operations.ProjectOperations.create_project)
            operations.ProjectOperations.update_project = with_auto_export(operations.ProjectOperations.update_project)
            operations.ProjectOperations.delete_project = with_auto_export(operations.ProjectOperations.delete_project)
        
        # Patch Dataset operations
        if hasattr(operations, 'DatasetOperations'):
            operations.DatasetOperations.create_dataset = with_auto_export(operations.DatasetOperations.create_dataset)
            operations.DatasetOperations.update_dataset = with_auto_export(operations.DatasetOperations.update_dataset)
            operations.DatasetOperations.delete_dataset = with_auto_export(operations.DatasetOperations.delete_dataset)
        
        # Patch Image operations
        if hasattr(operations, 'ImageOperations'):
            operations.ImageOperations.create_image = with_auto_export(operations.ImageOperations.create_image)
            operations.ImageOperations.update_image = with_auto_export(operations.ImageOperations.update_image)
            operations.ImageOperations.delete_image = with_auto_export(operations.ImageOperations.delete_image)
            operations.ImageOperations.move_image = with_auto_export(operations.ImageOperations.move_image)
        
        # Patch Annotation operations
        if hasattr(operations, 'AnnotationOperations'):
            operations.AnnotationOperations.create_annotation = with_auto_export(operations.AnnotationOperations.create_annotation)
            operations.AnnotationOperations.update_annotation = with_auto_export(operations.AnnotationOperations.update_annotation)
            operations.AnnotationOperations.delete_annotation = with_auto_export(operations.AnnotationOperations.delete_annotation)
            operations.AnnotationOperations.bulk_create_annotations = with_auto_export(operations.AnnotationOperations.bulk_create_annotations)
        
        logger.info("app.database", "Database operations patched for auto-export", "operations_patched", {})
        
    except Exception as e:
        logger.error("app.database", "Failed to patch database operations", "patch_error", {
            "error": str(e)
        })

def initialize_auto_export(enable_monitoring: bool = True, check_interval: int = 5):
    """Initialize the automatic database export system"""
    logger.info("app.database", "Initializing auto-export system", "auto_export_init", {
        "enable_monitoring": enable_monitoring,
        "check_interval": check_interval
    })
    
    try:
        # Patch existing operations
        patch_database_operations()
        
        # Start file monitoring if requested
        if enable_monitoring:
            from .auto_export import start_auto_export
            start_auto_export(check_interval)
        
        # Perform initial export
        trigger_export()
        
        logger.info("app.database", "Auto-export system initialized successfully", "auto_export_init_complete", {})
        
    except Exception as e:
        logger.error("app.database", "Failed to initialize auto-export system", "auto_export_init_error", {
            "error": str(e)
        })

def cleanup_auto_export():
    """Cleanup the automatic database export system"""
    try:
        from .auto_export import stop_auto_export
        stop_auto_export()
        
        logger.info("app.database", "Auto-export system cleaned up", "auto_export_cleanup", {})
        
    except Exception as e:
        logger.error("app.database", "Failed to cleanup auto-export system", "auto_export_cleanup_error", {
            "error": str(e)
        })