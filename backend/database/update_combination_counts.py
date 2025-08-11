"""
Update existing transformation_combination_count values to include original file
Changes formula from 2^n - 1 to 2^n (includes original file)
"""

import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def update_combination_counts(db_path: str = "database.db"):
    """
    Update existing combination counts to include original file
    """
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
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
            
            # Calculate NEW combination count: 2^n (including original file)
            new_combination_count = max(1, (2 ** enabled_count)) if enabled_count > 0 else 1
            
            # Update all records for this release version
            cursor.execute("""
                UPDATE image_transformations 
                SET transformation_combination_count = ? 
                WHERE release_version = ?
            """, (new_combination_count, release_version))
            
            logger.info(f"Updated release_version '{release_version}': {enabled_count} transformations = {new_combination_count} combinations (including original)")
        
        conn.commit()
        conn.close()
        logger.info("Successfully updated all combination counts to include original file")
        
    except Exception as e:
        logger.error(f"Failed to update combination counts: {str(e)}")
        raise e

def run_update():
    """Run the update"""
    logging.basicConfig(level=logging.INFO)
    
    # Check if database exists
    db_path = Path("database.db")
    if not db_path.exists():
        logger.warning("Database file not found.")
        return
    
    update_combination_counts(str(db_path))

if __name__ == "__main__":
    run_update()
