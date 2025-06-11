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
        # Check if split_section column exists in images table
        try:
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
                
                session.commit()
                logger.info("Migration completed successfully")
            else:
                logger.info("split_section column already exists, skipping migration")
                
        except Exception as e:
            session.rollback()
            logger.error(f"Migration failed: {str(e)}")
            raise

if __name__ == "__main__":
    run_migrations()