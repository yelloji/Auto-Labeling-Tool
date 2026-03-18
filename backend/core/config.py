"""
Configuration settings for the Auto-Labeling-Tool
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings

# Import professional logging system - CORRECT UNIFORM PATTERN
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()


def _get_base_dir() -> Path:
    """
    Determine the base data directory.

    Exe mode  (GEVIS_EXE_MODE=1, set by electron/backend_runner.js):
        → AppData\Local\Gevis AI Studio\
        → database.db and projects\ live here (writable, user-owned)

    Dev mode  (env var not set):
        → repo root folder (same as before — no change to dev workflow)
    """
    if os.environ.get('GEVIS_EXE_MODE') == '1':
        appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
        return Path(appdata) / 'Gevis AI Studio'
    return Path(__file__).parent.parent.parent


# Resolve once at import time — GEVIS_EXE_MODE must be set before backend starts
_BASE_DIR = _get_base_dir()


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Gevis AI Studio"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Paths
    # Dev mode:  all paths resolve to repo root (unchanged)
    # Exe mode:  user data paths resolve to AppData\Local\Gevis AI Studio\
    BASE_DIR: Path = _BASE_DIR
    DATA_DIR: Path = _BASE_DIR / "datasets"
    MODELS_DIR: Path = _BASE_DIR / "models"
    STATIC_FILES_DIR: Path = _BASE_DIR / "static"
    TEMP_DIR: Path = _BASE_DIR / "temp"
    #UPLOAD_DIR: Path = _BASE_DIR / "uploads"  # legacy folder; can be disabled from auto-creation
    PROJECTS_DIR: Path = _BASE_DIR / "projects"

    # Database
    DATABASE_PATH: Path = _BASE_DIR / "database.db"
    DATABASE_URL: str = f"sqlite:///{_BASE_DIR / 'database.db'}"
    
    # Model settings
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.5
    DEFAULT_IOU_THRESHOLD: float = 0.45
    MAX_IMAGE_SIZE: int = 1280
    
    # Supported formats
    SUPPORTED_IMAGE_FORMATS: list = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]
    SUPPORTED_VIDEO_FORMATS: list = [".mp4", ".avi", ".mov", ".mkv", ".webm"]
    SUPPORTED_MODEL_FORMATS: list = [".pt", ".onnx", ".engine"]
    
    # Export formats
    EXPORT_FORMATS: list = ["yolo", "coco", "pascal_voc", "cvat", "labelme"]
    
    # GPU settings
    USE_GPU: bool = True
    GPU_MEMORY_FRACTION: float = 0.8
    
    # File upload limits
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB per image
    MAX_BATCH_SIZE: int = 10000  # 10,000 images
    
    
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        logger.info("app.backend", "Initializing application settings", "settings_init_start", {
            'app_name': self.APP_NAME,
            'version': self.VERSION,
            'debug': self.DEBUG,
            'base_dir': str(self.BASE_DIR)
        })
        
        # Create directories if they don't exist
        directories_to_create = [
            self.DATA_DIR, self.MODELS_DIR, self.STATIC_FILES_DIR, 
            self.TEMP_DIR, self.PROJECTS_DIR
        ]
        
        created_dirs = []
        for dir_path in directories_to_create:
            if not dir_path.exists():
                dir_path.mkdir(parents=True, exist_ok=True)
                created_dirs.append(str(dir_path))
                logger.info("app.backend", f"Created directory: {dir_path}", "directory_created", {
                    'directory_path': str(dir_path),
                    'directory_name': dir_path.name
                })
            else:
                logger.info("app.backend", f"Directory already exists: {dir_path}", "directory_exists", {
                    'directory_path': str(dir_path),
                    'directory_name': dir_path.name
                })
        
        logger.info("app.backend", "Application settings initialization completed", "settings_init_completed", {
            'total_directories': len(directories_to_create),
            'created_directories': created_dirs,
            'database_path': str(self.DATABASE_PATH),
            'supported_image_formats': self.SUPPORTED_IMAGE_FORMATS,
            'supported_video_formats': self.SUPPORTED_VIDEO_FORMATS,
            'export_formats': self.EXPORT_FORMATS
        })

# Global settings instance
settings = Settings()

logger.info("app.backend", "Global settings instance created successfully", "global_settings_created", {
    'app_name': settings.APP_NAME,
    'version': settings.VERSION,
    'database_url': settings.DATABASE_URL,
    'use_gpu': settings.USE_GPU,
    'max_file_size_mb': settings.MAX_FILE_SIZE // (1024 * 1024)
})