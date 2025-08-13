"""
Migration to add user_selected_images_per_original column to image_transformations table
This column stores the user's choice for images per original in Release Configuration UI
"""

import sqlite3
import logging

logger = logging.getLogger(__name__)

def add_user_selected_images_column():
    """Add user_selected_images_per_original column to image_transformations table"""
    try:
        # Connect to database
        conn = sqlite3.connect('/workspace/project/app-2/database.db')
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(image_transformations)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'user_selected_images_per_original' not in columns:
            # Add the new column
            cursor.execute("""
                ALTER TABLE image_transformations 
                ADD COLUMN user_selected_images_per_original INTEGER
            """)
            
            conn.commit()
            logger.info("✅ Successfully added user_selected_images_per_original column")
            print("✅ Successfully added user_selected_images_per_original column")
        else:
            logger.info("✅ Column user_selected_images_per_original already exists")
            print("✅ Column user_selected_images_per_original already exists")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error adding user_selected_images_per_original column: {str(e)}")
        print(f"❌ Error adding user_selected_images_per_original column: {str(e)}")
        return False

if __name__ == "__main__":
    add_user_selected_images_column()