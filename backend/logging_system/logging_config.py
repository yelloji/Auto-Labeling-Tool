#!/usr/bin/env python3
"""
Professional Logging System Configuration
========================================
Centralized configuration for the professional logging system.
This file contains all settings for log rotation, retention, and categories.
"""

import os
from typing import Dict, Any

# Import professional logging system
from .professional_logger import get_professional_logger

# Initialize professional logger for this configuration file
logger = get_professional_logger()

# =============================================================================
# CORE LOGGING CONFIGURATION
# =============================================================================

LOGGING_CONFIG: Dict[str, Any] = {
    # ========================================================================
    # ROTATION & RETENTION SETTINGS
    # ========================================================================
    "rotation_interval": "24h",      # Log rotation interval (24h, 7d, 30d)
    "retention_days": 7,             # Keep logs for 7 days
    "max_file_size": "100MB",        # Maximum log file size before rotation
    "backup_count": 5,               # Number of backup files to keep
    "compression": True,             # Compress old log files
    
    # ========================================================================
    # LOG LEVELS
    # ========================================================================
    "log_level": "INFO",             # Global log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    "console_level": "INFO",         # Console output level
    "file_level": "DEBUG",           # File output level (more detailed)
    
    # ========================================================================
    # FEATURE TOGGLES
    # ========================================================================
    "enable_performance": True,      # Track performance metrics
    "enable_audit": True,            # Track user actions and security
    "enable_stack_traces": True,     # Include full stack traces in errors
    "enable_request_tracking": True, # Track request IDs for debugging
    "enable_json_format": True,      # Use structured JSON logging
    
    # ========================================================================
    # DUAL LOGGING SYSTEM SETTINGS
    # ========================================================================
    "logging_mode": "user",          # "developer" or "user" - controls which mode to use
    "async_logging": True,           # Use async logging for performance
    "log_rotation_size_mb": 100,     # Log rotation size in MB
    "log_rotation_backup_count": 5,  # Number of backup files to keep
    
    # ========================================================================
    # LOG CATEGORIES - DETAILED STRUCTURE (17 LOG FILES)
    # ========================================================================
    "categories": {
        # ====================================================================
        # APP CATEGORY (6 files) - Application level logs
        # ====================================================================
        "app": {
            "enabled": True,
            "level": "INFO",
            "max_size": "50MB",
            "backup_count": 3,
            "files": {
                "frontend": {"enabled": True, "level": "INFO"},
                "api": {"enabled": True, "level": "INFO"},
                "startup": {"enabled": True, "level": "INFO"},
                "app": {"enabled": True, "level": "INFO"},
                "backend": {"enabled": True, "level": "INFO"},
                "database": {"enabled": True, "level": "INFO"}
            }
        },
        
        # ====================================================================
        # OPERATIONS CATEGORY (7 files) - Business operations logs
        # ====================================================================
        "operations": {
            "enabled": True,
            "level": "INFO", 
            "max_size": "100MB",
            "backup_count": 5,
            "files": {
                "images": {"enabled": True, "level": "INFO"},
                "datasets": {"enabled": True, "level": "INFO"},
                "exports": {"enabled": True, "level": "INFO"},
                "operations": {"enabled": True, "level": "INFO"},
                "annotations": {"enabled": True, "level": "INFO"},
                "releases": {"enabled": True, "level": "INFO"},
                "transformations": {"enabled": True, "level": "INFO"}
            }
        },
        
        # ====================================================================
        # ERRORS CATEGORY (4 files) - Error and debug logs
        # ====================================================================
        "errors": {
            "enabled": True,
            "level": "ERROR",
            "max_size": "50MB", 
            "backup_count": 10,
            "files": {
                "system": {"enabled": True, "level": "ERROR"},
                "validation": {"enabled": True, "level": "ERROR"},
                "errors": {"enabled": True, "level": "ERROR"},
                "debug": {"enabled": True, "level": "DEBUG"}
            }
        }
    },
    
    # ========================================================================
    # ERROR HANDLING
    # ========================================================================
    "error_handling": {
        "include_stack_traces": True,
        "include_context": True,
        "include_request_data": True,
        "max_error_message_length": 1000,
        "error_notification": False  # Future: email/SMS notifications
    }
}

# =============================================================================
# ENVIRONMENT VARIABLES OVERRIDE
# =============================================================================

def get_config() -> Dict[str, Any]:
    """
    Get configuration with environment variable overrides.
    Environment variables can override any setting.
    """
    logger.debug("app.backend", "Loading logging configuration with environment overrides", "config_loading_start", {
        "operation": "configuration_loading",
        "base_config_keys": list(LOGGING_CONFIG.keys())
    })
    
    config = LOGGING_CONFIG.copy()
    
    # Override with environment variables if present
    env_mappings = {
        "LOG_LEVEL": "log_level",
        "LOG_ROTATION_INTERVAL": "rotation_interval", 
        "LOG_RETENTION_DAYS": "retention_days",
        "LOG_MAX_FILE_SIZE": "max_file_size",
        "LOG_ENABLE_JSON": "enable_json_format"
    }
    
    logger.debug("app.backend", "Processing environment variable overrides", "env_override_start", {
        "env_mappings_count": len(env_mappings),
        "available_env_vars": list(env_mappings.keys())
    })
    
    overrides_applied = 0
    for env_var, config_key in env_mappings.items():
        env_value = os.getenv(env_var)
        if env_value is not None:
            # Convert string values to appropriate types
            if config_key in ["retention_days", "backup_count"]:
                try:
                    config[config_key] = int(env_value)
                    overrides_applied += 1
                    logger.debug("app.backend", f"Applied integer override: {config_key} = {env_value}", "env_override_applied", {
                        "env_var": env_var,
                        "config_key": config_key,
                        "value": env_value,
                        "type": "integer"
                    })
                except ValueError as e:
                    logger.warning("errors.validation", f"Invalid integer value for {config_key}: {env_value}", "env_override_validation_error", {
                        "env_var": env_var,
                        "config_key": config_key,
                        "value": env_value,
                        "error": str(e)
                    })
            elif config_key in ["enable_json_format"]:
                config[config_key] = env_value.lower() in ["true", "1", "yes"]
                overrides_applied += 1
                logger.debug("app.backend", f"Applied boolean override: {config_key} = {config[config_key]}", "env_override_applied", {
                    "env_var": env_var,
                    "config_key": config_key,
                    "value": env_value,
                    "result": config[config_key]
                })
            else:
                config[config_key] = env_value
                overrides_applied += 1
                logger.debug("app.backend", f"Applied string override: {config_key} = {env_value}", "env_override_applied", {
                    "env_var": env_var,
                    "config_key": config_key,
                    "value": env_value
                })
    
    logger.info("app.backend", "Configuration loaded successfully with environment overrides", "config_loading_complete", {
        "overrides_applied": overrides_applied,
        "total_env_vars_checked": len(env_mappings),
        "final_config_keys": list(config.keys())
    })
    
    return config

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def validate_config(config: Dict[str, Any]) -> bool:
    """
    Validate the logging configuration.
    Returns True if valid, raises ValueError if invalid.
    """
    logger.debug("app.backend", "Starting configuration validation", "config_validation_start", {
        "config_keys": list(config.keys()),
        "validation_checks": ["log_levels", "rotation_intervals", "numeric_values"]
    })
    
    # Validate log levels
    valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    if config["log_level"] not in valid_levels:
        error_msg = f"Invalid log_level: {config['log_level']}. Must be one of {valid_levels}"
        logger.error("errors.validation", error_msg, "config_validation_error", {
            "validation_type": "log_level",
            "invalid_value": config["log_level"],
            "valid_values": valid_levels
        })
        raise ValueError(error_msg)
    
    logger.debug("app.backend", "Log level validation passed", "config_validation_step", {
        "step": "log_level_validation",
        "value": config["log_level"],
        "valid_values": valid_levels
    })
    
    # Validate rotation interval
    valid_intervals = ["1h", "6h", "12h", "24h", "7d", "30d"]
    if config["rotation_interval"] not in valid_intervals:
        error_msg = f"Invalid rotation_interval: {config['rotation_interval']}. Must be one of {valid_intervals}"
        logger.error("errors.validation", error_msg, "config_validation_error", {
            "validation_type": "rotation_interval",
            "invalid_value": config["rotation_interval"],
            "valid_values": valid_intervals
        })
        raise ValueError(error_msg)
    
    logger.debug("app.backend", "Rotation interval validation passed", "config_validation_step", {
        "step": "rotation_interval_validation",
        "value": config["rotation_interval"],
        "valid_values": valid_intervals
    })
    
    # Validate numeric values
    if config["retention_days"] < 1:
        error_msg = f"retention_days must be >= 1, got {config['retention_days']}"
        logger.error("errors.validation", error_msg, "config_validation_error", {
            "validation_type": "retention_days",
            "invalid_value": config["retention_days"],
            "minimum_value": 1
        })
        raise ValueError(error_msg)
    
    if config["backup_count"] < 1:
        error_msg = f"backup_count must be >= 1, got {config['backup_count']}"
        logger.error("errors.validation", error_msg, "config_validation_error", {
            "validation_type": "backup_count",
            "invalid_value": config["backup_count"],
            "minimum_value": 1
        })
        raise ValueError(error_msg)
    
    logger.info("app.backend", "Configuration validation completed successfully", "config_validation_complete", {
        "validation_steps": ["log_levels", "rotation_intervals", "numeric_values"],
        "config_summary": {
            "log_level": config["log_level"],
            "rotation_interval": config["rotation_interval"],
            "retention_days": config["retention_days"],
            "backup_count": config["backup_count"]
        }
    })
    
    return True

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_log_directory() -> str:
    """Get the log directory path."""
    log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logs"))
    logger.debug("app.backend", "Retrieved log directory path", "log_directory_retrieved", {
        "log_directory": log_dir,
        "operation": "path_resolution"
    })
    return log_dir

def get_category_config(category: str) -> Dict[str, Any]:
    """Get configuration for a specific log category."""
    logger.debug("app.backend", f"Retrieving configuration for category: {category}", "category_config_retrieval", {
        "category": category,
        "operation": "category_config_lookup"
    })
    
    config = get_config()
    category_config = config["categories"].get(category, {})
    
    if category_config:
        logger.debug("app.backend", f"Category configuration found for: {category}", "category_config_found", {
            "category": category,
            "config_keys": list(category_config.keys()),
            "enabled": category_config.get("enabled", False)
        })
    else:
        logger.warning("errors.validation", f"Category configuration not found: {category}", "category_config_not_found", {
            "category": category,
            "available_categories": list(config["categories"].keys())
        })
    
    return category_config

def is_category_enabled(category: str) -> bool:
    """Check if a log category is enabled."""
    logger.debug("app.backend", f"Checking if category is enabled: {category}", "category_enabled_check", {
        "category": category,
        "operation": "enabled_status_check"
    })
    
    category_config = get_category_config(category)
    is_enabled = category_config.get("enabled", False)
    
    logger.debug("app.backend", f"Category enabled status: {category} = {is_enabled}", "category_enabled_status", {
        "category": category,
        "enabled": is_enabled,
        "config_available": bool(category_config)
    })
    
    return is_enabled

# =============================================================================
# INITIALIZATION
# =============================================================================

if __name__ == "__main__":
    # Test configuration loading
    logger.info("app.backend", "Starting configuration file test execution", "config_test_start", {
        "test_type": "standalone_execution",
        "file": __file__
    })
    
    try:
        config = get_config()
        logger.debug("app.backend", "Configuration loaded, starting validation", "config_test_validation_start", {
            "config_keys_count": len(config),
            "validation_phase": "pre_validation"
        })
        
        validate_config(config)
        
        log_dir = get_log_directory()
        
        logger.info("app.backend", "Configuration test completed successfully", "config_test_success", {
            "log_directory": log_dir,
            "log_level": config['log_level'],
            "rotation_interval": config['rotation_interval'],
            "retention_days": config['retention_days']
        })
        
        print("✅ Logging configuration loaded successfully!")
        print(f"📁 Log directory: {log_dir}")
        print(f"📊 Log level: {config['log_level']}")
        print(f"🔄 Rotation: {config['rotation_interval']}")
        print(f"📅 Retention: {config['retention_days']} days")
        
    except Exception as e:
        logger.error("errors.system", f"Configuration test failed: {str(e)}", "config_test_failure", {
            "error": str(e),
            "error_type": type(e).__name__,
            "test_phase": "configuration_testing"
        })
        print(f"❌ Configuration error: {e}")
        exit(1)
