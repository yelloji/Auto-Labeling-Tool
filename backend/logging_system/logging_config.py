#!/usr/bin/env python3
"""
Professional Logging System Configuration
========================================
Centralized configuration for the professional logging system.
This file contains all settings for log rotation, retention, and categories.
"""

import os
from typing import Dict, Any

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
    # LOG CATEGORIES
    # ========================================================================
    "categories": {
        "app": {
            "enabled": True,
            "level": "INFO",
            "max_size": "50MB",
            "backup_count": 3
        },
        "operations": {
            "enabled": True,
            "level": "INFO", 
            "max_size": "100MB",
            "backup_count": 5
        },
        "errors": {
            "enabled": True,
            "level": "ERROR",
            "max_size": "50MB", 
            "backup_count": 10
        },
        "performance": {
            "enabled": True,
            "level": "INFO",
            "max_size": "50MB",
            "backup_count": 3
        },
        "audit": {
            "enabled": True,
            "level": "INFO",
            "max_size": "100MB",
            "backup_count": 7
        }
    },
    
    # ========================================================================
    # PERFORMANCE MONITORING
    # ========================================================================
    "performance": {
        "track_api_response_times": True,
        "track_database_query_times": True,
        "track_memory_usage": True,
        "track_cpu_usage": True,
        "track_image_processing_times": True,
        "slow_query_threshold": 1.0,  # Seconds
        "slow_api_threshold": 2.0,    # Seconds
    },
    
    # ========================================================================
    # AUDIT & SECURITY
    # ========================================================================
    "audit": {
        "track_user_actions": True,
        "track_api_calls": True,
        "track_file_operations": True,
        "track_database_changes": True,
        "mask_sensitive_data": True,
        "sensitive_fields": ["password", "token", "key", "secret"]
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
    },
    
    # ========================================================================
    # FUTURE FEATURES (Auto-labeling, YOLO Training, GPU)
    # ========================================================================
    "future_features": {
        "auto_labeling": {
            "enabled": False,
            "track_model_performance": True,
            "track_labeling_accuracy": True,
            "track_processing_times": True
        },
        "yolo_training": {
            "enabled": False,
            "track_training_progress": True,
            "track_model_metrics": True,
            "track_gpu_usage": True,
            "track_memory_usage": True
        },
        "gpu_monitoring": {
            "enabled": False,
            "track_gpu_utilization": True,
            "track_gpu_memory": True,
            "track_temperature": True,
            "track_power_usage": True
        }
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
    config = LOGGING_CONFIG.copy()
    
    # Override with environment variables if present
    env_mappings = {
        "LOG_LEVEL": "log_level",
        "LOG_ROTATION_INTERVAL": "rotation_interval", 
        "LOG_RETENTION_DAYS": "retention_days",
        "LOG_MAX_FILE_SIZE": "max_file_size",
        "LOG_ENABLE_PERFORMANCE": "enable_performance",
        "LOG_ENABLE_AUDIT": "enable_audit",
        "LOG_ENABLE_JSON": "enable_json_format"
    }
    
    for env_var, config_key in env_mappings.items():
        env_value = os.getenv(env_var)
        if env_value is not None:
            # Convert string values to appropriate types
            if config_key in ["retention_days", "backup_count"]:
                config[config_key] = int(env_value)
            elif config_key in ["enable_performance", "enable_audit", "enable_json_format"]:
                config[config_key] = env_value.lower() in ["true", "1", "yes"]
            else:
                config[config_key] = env_value
    
    return config

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def validate_config(config: Dict[str, Any]) -> bool:
    """
    Validate the logging configuration.
    Returns True if valid, raises ValueError if invalid.
    """
    # Validate log levels
    valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    if config["log_level"] not in valid_levels:
        raise ValueError(f"Invalid log_level: {config['log_level']}. Must be one of {valid_levels}")
    
    # Validate rotation interval
    valid_intervals = ["1h", "6h", "12h", "24h", "7d", "30d"]
    if config["rotation_interval"] not in valid_intervals:
        raise ValueError(f"Invalid rotation_interval: {config['rotation_interval']}. Must be one of {valid_intervals}")
    
    # Validate numeric values
    if config["retention_days"] < 1:
        raise ValueError(f"retention_days must be >= 1, got {config['retention_days']}")
    
    if config["backup_count"] < 1:
        raise ValueError(f"backup_count must be >= 1, got {config['backup_count']}")
    
    return True

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_log_directory() -> str:
    """Get the log directory path."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logs"))

def get_category_config(category: str) -> Dict[str, Any]:
    """Get configuration for a specific log category."""
    config = get_config()
    return config["categories"].get(category, {})

def is_category_enabled(category: str) -> bool:
    """Check if a log category is enabled."""
    category_config = get_category_config(category)
    return category_config.get("enabled", False)

# =============================================================================
# INITIALIZATION
# =============================================================================

if __name__ == "__main__":
    # Test configuration loading
    try:
        config = get_config()
        validate_config(config)
        print("✅ Logging configuration loaded successfully!")
        print(f"📁 Log directory: {get_log_directory()}")
        print(f"📊 Log level: {config['log_level']}")
        print(f"🔄 Rotation: {config['rotation_interval']}")
        print(f"📅 Retention: {config['retention_days']} days")
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        exit(1)
