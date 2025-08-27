#!/usr/bin/env python3
"""
Database Auto-Export Configuration
==================================
Dedicated configuration file for the database export system.
Separate from main config to avoid confusion and provide clear control.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings

class DatabaseExportSettings(BaseSettings):
    """Database Export System Configuration"""
    
    # Main toggle - Enable/disable entire auto-export system
    ENABLE_AUTO_EXPORT: bool = True
    
    # Development vs Production control
    # Set to False in production to disable monitoring
    ENABLE_MONITORING: bool = True
    
    # Export settings
    EXPORT_DIRECTORY: str = "database_exports"
    CHECK_INTERVAL: int = 10  # seconds
    
    # File format settings
    EXPORT_JSON: bool = True
    EXPORT_CSV: bool = True
    
    # Performance settings
    USE_BACKGROUND_THREADS: bool = True
    MAX_EXPORT_SIZE_MB: int = 50  # Maximum export file size
    
    # Environment-based overrides
    # These can be set via environment variables
    ENVIRONMENT: str = "development"  # development, production, testing
    
    class Config:
        env_file = ".env"
        env_prefix = "DB_EXPORT_"
        case_sensitive = True
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Auto-disable monitoring in production
        if self.ENVIRONMENT.lower() == "production":
            self.ENABLE_MONITORING = False
        
        # Ensure export directory exists
        export_path = Path(self.EXPORT_DIRECTORY)
        if not export_path.is_absolute():
            # Make relative to project root (go up from backend/database/export_config.py to root)
            project_root = Path(__file__).parent.parent.parent
            export_path = project_root / self.EXPORT_DIRECTORY
        
        export_path.mkdir(parents=True, exist_ok=True)
        self.EXPORT_DIRECTORY = str(export_path)
    
    @property
    def is_enabled(self) -> bool:
        """Check if auto-export system should be enabled"""
        return self.ENABLE_AUTO_EXPORT
    
    @property
    def should_monitor(self) -> bool:
        """Check if monitoring should be active"""
        return self.ENABLE_AUTO_EXPORT and self.ENABLE_MONITORING
    
    def get_export_config(self) -> dict:
        """Get configuration dictionary for export system"""
        return {
            "enabled": self.is_enabled,
            "monitoring": self.should_monitor,
            "directory": self.EXPORT_DIRECTORY,
            "interval": self.CHECK_INTERVAL,
            "formats": {
                "json": self.EXPORT_JSON,
                "csv": self.EXPORT_CSV
            },
            "performance": {
                "background_threads": self.USE_BACKGROUND_THREADS,
                "max_size_mb": self.MAX_EXPORT_SIZE_MB
            },
            "environment": self.ENVIRONMENT
        }

# Global export settings instance
export_settings = DatabaseExportSettings()

# Environment variable examples for production:
# DB_EXPORT_ENVIRONMENT=production
# DB_EXPORT_ENABLE_MONITORING=false
# DB_EXPORT_CHECK_INTERVAL=30
# DB_EXPORT_EXPORT_DIRECTORY=/var/exports/database