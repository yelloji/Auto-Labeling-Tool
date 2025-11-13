"""
Database configuration and initialization
"""

import os
from sqlalchemy import create_engine, text
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
            AutoLabelJob,
            Label, DatasetSplit, LabelAnalytics,
            Release, ImageTransformation, ImageVariant,
            AiModel
        )
        from .operations import AiModelOperations
        
        logger.info("app.database", "Database models imported successfully", "models_import_complete", {
            "models_count": 13  # Total number of models imported
        })
        
        # Create all tables
        logger.info("app.database", "Creating database tables", "tables_creation_start", {})
        
        Base.metadata.create_all(bind=engine)
        
        logger.info("app.database", "Database tables created successfully", "tables_creation_complete", {})
        print("Database initialized successfully")
        # Legacy cleanup: drop removed tables if they exist
        try:
            with engine.begin() as conn:
                for tbl in [
                    "training_iterations",
                    "uncertain_samples",
                    "model_versions",
                    "model_usage"
                ]:
                    conn.execute(text(f"DROP TABLE IF EXISTS {tbl}"))
            logger.info("app.database", "Dropped legacy tables if present", "legacy_tables_drop", {
                "dropped": [
                    "training_iterations",
                    "uncertain_samples",
                    "model_versions",
                    "model_usage"
                ]
            })
        except Exception as drop_err:
            logger.warning("errors.system", f"Legacy table drop attempt failed: {drop_err}", "legacy_tables_drop_failed", {
                "error": str(drop_err)
            })
        
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
        # Sync ai_models from models/models_config.json so defaults and custom models are recorded
        try:
            db = SessionLocal()
            summary = AiModelOperations.sync_from_config(db)
            logger.info("app.database", "AiModel sync after init_db completed", "ai_model_sync_post_init", summary)
        except Exception as sync_err:
            logger.error("errors.system", f"AiModel sync after init_db failed: {str(sync_err)}", "ai_model_sync_post_init_error", {
                "error": str(sync_err),
                "error_type": type(sync_err).__name__
            })
        finally:
            try:
                db.close()
            except Exception:
                pass
        
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
