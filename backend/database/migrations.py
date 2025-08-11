"""
Database migration utilities for Auto-Labeling-Tool
"""

import sys
import os
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

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
            
            # Migration 4: Add category column to image_transformations table
            result = session.execute(text("PRAGMA table_info(image_transformations)"))
            transform_columns = [row[1] for row in result.fetchall()]
            
            if 'category' not in transform_columns:
                logger.info("Adding category column to image_transformations table")
                session.execute(text("ALTER TABLE image_transformations ADD COLUMN category VARCHAR(20) DEFAULT 'basic'"))
                
                # Update existing transformations with correct categories
                logger.info("Updating existing transformations with correct categories")
                
                # Advanced transformations
                advanced_transforms = ['grayscale', 'blur', 'noise', 'brightness', 'contrast', 'saturation', 'hue']
                for transform in advanced_transforms:
                    session.execute(text(f"""
                        UPDATE image_transformations 
                        SET category = 'advanced' 
                        WHERE transformation_type = '{transform}'
                    """))
                
                # Basic transformations (flip, rotate, resize, crop) will remain 'basic' due to DEFAULT
                logger.info("category column added to image_transformations table successfully")
            else:
                logger.info("category column already exists in image_transformations table, skipping")
            
            # Migration 5: Add parameter ranges support columns to image_transformations table
            result = session.execute(text("PRAGMA table_info(image_transformations)"))
            transform_columns = [row[1] for row in result.fetchall()]
            
            if 'parameter_ranges' not in transform_columns:
                logger.info("Adding parameter_ranges column to image_transformations table")
                session.execute(text("ALTER TABLE image_transformations ADD COLUMN parameter_ranges JSON"))
                logger.info("parameter_ranges column added successfully")
            else:
                logger.info("parameter_ranges column already exists, skipping")
            
            if 'range_enabled_params' not in transform_columns:
                logger.info("Adding range_enabled_params column to image_transformations table")
                session.execute(text("ALTER TABLE image_transformations ADD COLUMN range_enabled_params JSON"))
                logger.info("range_enabled_params column added successfully")
            else:
                logger.info("range_enabled_params column already exists, skipping")
            
            # Migration 6: Drop unused tables (DataAugmentation and ExportJob)
            # Check if data_augmentations table exists
            result = session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='data_augmentations'"))
            if result.fetchone():
                logger.info("Dropping unused data_augmentations table")
                session.execute(text("DROP TABLE data_augmentations"))
                logger.info("data_augmentations table dropped successfully")
            else:
                logger.info("data_augmentations table does not exist, skipping")
            
            # Check if export_jobs table exists
            result = session.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='export_jobs'"))
            if result.fetchone():
                logger.info("Dropping unused export_jobs table")
                session.execute(text("DROP TABLE export_jobs"))
                logger.info("export_jobs table dropped successfully")
            else:
                logger.info("export_jobs table does not exist, skipping")
            
            session.commit()
            logger.info("All migrations completed successfully")
                
        except Exception as e:
            session.rollback()
            logger.error(f"Migration failed: {str(e)}")
            raise

if __name__ == "__main__":
    run_migrations()