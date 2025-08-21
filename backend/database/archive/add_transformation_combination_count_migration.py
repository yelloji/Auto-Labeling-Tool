"""
Database migration to add transformation_combination_count column
to image_transformations table
"""

import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def add_transformation_combination_count_column(db_path: str = "database.db"):
    """
    Add transformation_combination_count column to image_transformations table
    """
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(image_transformations)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'transformation_combination_count' not in columns:
            # Add the new column
            cursor.execute("""
                ALTER TABLE image_transformations 
                ADD COLUMN transformation_combination_count INTEGER
            """)
            
            logger.info("Added transformation_combination_count column to image_transformations table")
            
            # Calculate and update combination counts for existing records
            update_existing_combination_counts(cursor)
            
            conn.commit()
            logger.info("Migration completed successfully")
        else:
            logger.info("transformation_combination_count column already exists")
        
        conn.close()
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise e

def update_existing_combination_counts(cursor):
    """
    Calculate and update combination counts for existing transformation records
    """
    try:
        # Get all unique release versions
        cursor.execute("SELECT DISTINCT release_version FROM image_transformations")
        release_versions = [row[0] for row in cursor.fetchall()]
        
        for release_version in release_versions:
            # Count enabled transformations for this release version
            cursor.execute("""
                SELECT COUNT(*) FROM image_transformations 
                WHERE release_version = ? AND is_enabled = 1
            """, (release_version,))
            
            enabled_count = cursor.fetchone()[0]
            
            # Calculate combination count: 2^n (including original file)
            combination_count = max(1, (2 ** enabled_count)) if enabled_count > 0 else 1
            
            # Update all records for this release version
            cursor.execute("""
                UPDATE image_transformations 
                SET transformation_combination_count = ? 
                WHERE release_version = ?
            """, (combination_count, release_version))
            
            logger.info(f"Updated release_version '{release_version}': {enabled_count} transformations = {combination_count} combinations")
    
    except Exception as e:
        logger.error(f"Failed to update existing combination counts: {str(e)}")
        raise e

def run_migration():
    """Run the migration"""
    logging.basicConfig(level=logging.INFO)
    
    # Check if database exists
    db_path = Path("database.db")
    if not db_path.exists():
        logger.warning("Database file not found. Migration will run when database is created.")
        return
    
    add_transformation_combination_count_column(str(db_path))

if __name__ == "__main__":
    run_migration()
