"""
Configuration settings for the Auto-Labeling-Tool
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Auto-Labeling-Tool"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Paths
    BASE_DIR: Path = Path(__file__).parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "datasets"
    MODELS_DIR: Path = BASE_DIR / "models"
    STATIC_FILES_DIR: Path = BASE_DIR / "static"
    TEMP_DIR: Path = BASE_DIR / "temp"
    
    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/database.db"
    
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
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    MAX_BATCH_SIZE: int = 1000
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create directories if they don't exist
        for dir_path in [self.DATA_DIR, self.MODELS_DIR, self.STATIC_FILES_DIR, self.TEMP_DIR]:
            dir_path.mkdir(parents=True, exist_ok=True)

# Global settings instance
settings = Settings()