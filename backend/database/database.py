"""
Database configuration and initialization
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings
from .base import Base
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

# Create database engine
logger.info("app.database", "Creating database engine", "database_engine_creation", {
    "database_url": settings.DATABASE_URL,
    "is_sqlite": "sqlite" in settings.DATABASE_URL
})

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

logger.info("app.database", "Database engine created successfully", "database_engine_created", {
    "database_url": settings.DATABASE_URL
})

# Create session factory
logger.info("app.database", "Creating session factory", "session_factory_creation", {})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger.info("app.database", "Session factory created successfully", "session_factory_created", {})

async def init_db():
    """Initialize database tables"""
    logger.info("app.database", "Starting database initialization", "database_init_start", {})
    
    try:
        # Import all models here to ensure they are registered
        logger.info("app.database", "Importing database models", "models_import_start", {})
        
        from .models import (
            Project, Dataset, Image, Annotation, 
            ModelUsage, AutoLabelJob,
            Label, DatasetSplit, LabelAnalytics,
            Release, ImageTransformation, ImageVariant  # Include new models
        )
        
        logger.info("app.database", "Database models imported successfully", "models_import_complete", {
            "models_count": 12  # Total number of models imported
        })
        
        # Create all tables
        logger.info("app.database", "Creating database tables", "tables_creation_start", {})
        
        Base.metadata.create_all(bind=engine)
        
        logger.info("app.database", "Database tables created successfully", "tables_creation_complete", {})
        print("Database initialized successfully")
        
        # Create directories if they don't exist
        logger.info("app.database", "Creating required directories", "directories_creation_start", {
            "database_path": settings.DATABASE_PATH,
            "projects_dir": settings.PROJECTS_DIR,
            "models_dir": settings.MODELS_DIR
        })
        
        os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
        os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
        os.makedirs(settings.MODELS_DIR, exist_ok=True)
        
        logger.info("app.database", "Required directories created successfully", "directories_creation_complete", {
            "database_dir": os.path.dirname(settings.DATABASE_PATH),
            "projects_dir": settings.PROJECTS_DIR,
            "models_dir": settings.MODELS_DIR
        })
        
        logger.info("app.database", "Database initialization completed successfully", "database_init_complete", {})
        
    except Exception as e:
        logger.error("errors.system", f"Database initialization failed: {str(e)}", "database_init_error", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise

def get_db():
    """Get database session"""
    logger.info("app.database", "Creating database session", "database_session_creation", {})
    
    db = SessionLocal()
    
    try:
        logger.info("app.database", "Database session created successfully", "database_session_created", {})
        yield db
    except Exception as e:
        logger.error("errors.system", f"Database session error: {str(e)}", "database_session_error", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise
    finally:
        logger.info("app.database", "Closing database session", "database_session_close", {})
        db.close()
        logger.info("app.database", "Database session closed successfully", "database_session_closed", {})