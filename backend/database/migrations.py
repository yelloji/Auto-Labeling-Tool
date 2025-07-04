"""
Database migration utilities for Auto-Labeling-Tool
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.config import settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migrations():
    """Run all pending migrations"""
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    
    with Session() as session:
        try:
            # Migration 1: Check if split_section column exists in images table
            result = session.execute(text("PRAGMA table_info(images)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'split_section' not in columns:
                logger.info("Adding split_section column to images table")
                session.execute(text("ALTER TABLE images ADD COLUMN split_section VARCHAR(10) DEFAULT 'train'"))
                
                # Update existing records: copy train/val/test values from split_type to split_section
                logger.info("Updating split_section values based on existing split_type values")
                session.execute(text("""
                    UPDATE images 
                    SET split_section = split_type 
                    WHERE split_type IN ('train', 'val', 'test')
                """))
                
                # Update split_type for records that have train/val/test to 'dataset'
                logger.info("Updating split_type values for train/val/test records")
                session.execute(text("""
                    UPDATE images 
                    SET split_type = 'dataset' 
                    WHERE split_type IN ('train', 'val', 'test')
                """))
                
                logger.info("Images table migration completed successfully")
            else:
                logger.info("split_section column already exists, skipping images migration")
            
            # Migration 2: Create image_transformations table
            result = session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='image_transformations'"))
            if not result.fetchone():
                logger.info("Creating image_transformations table")
                session.execute(text("""
                    CREATE TABLE image_transformations (
                        id VARCHAR PRIMARY KEY,
                        transformation_type VARCHAR(50) NOT NULL,
                        parameters JSON NOT NULL,
                        is_enabled BOOLEAN DEFAULT 1,
                        order_index INTEGER DEFAULT 0,
                        release_version VARCHAR(100) NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                logger.info("image_transformations table created successfully")
            else:
                logger.info("image_transformations table already exists, skipping creation")
            
            # Migration 3: Add task_type column to releases table
            result = session.execute(text("PRAGMA table_info(releases)"))
            release_columns = [row[1] for row in result.fetchall()]
            
            if 'task_type' not in release_columns:
                logger.info("Adding task_type column to releases table")
                session.execute(text("ALTER TABLE releases ADD COLUMN task_type VARCHAR(50)"))
                logger.info("task_type column added to releases table successfully")
            else:
                logger.info("task_type column already exists in releases table, skipping")
            
            session.commit()
            logger.info("All migrations completed successfully")
                
        except Exception as e:
            session.rollback()
            logger.error(f"Migration failed: {str(e)}")
            raise

if __name__ == "__main__":
    run_migrations()