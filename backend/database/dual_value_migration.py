"""
Database migration to add dual-value system columns to ImageTransformation table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database.database import engine

def add_dual_value_columns():
    """Add dual-value system columns to image_transformations table"""
    
    migration_sql = """
    -- Add dual-value system columns to image_transformations table
    ALTER TABLE image_transformations 
    ADD COLUMN is_dual_value BOOLEAN DEFAULT FALSE;
    
    ALTER TABLE image_transformations 
    ADD COLUMN dual_value_parameters JSON;
    
    ALTER TABLE image_transformations 
    ADD COLUMN dual_value_enabled BOOLEAN DEFAULT FALSE;
    """
    
    try:
        with engine.connect() as connection:
            # Execute each statement separately for SQLite compatibility
            statements = [
                "ALTER TABLE image_transformations ADD COLUMN is_dual_value BOOLEAN DEFAULT FALSE",
                "ALTER TABLE image_transformations ADD COLUMN dual_value_parameters JSON",
                "ALTER TABLE image_transformations ADD COLUMN dual_value_enabled BOOLEAN DEFAULT FALSE"
            ]
            
            for statement in statements:
                try:
                    connection.execute(text(statement))
                    print(f"✅ Executed: {statement}")
                except Exception as e:
                    if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                        print(f"⚠️  Column already exists: {statement}")
                    else:
                        raise e
            
            connection.commit()
            print("✅ Dual-value migration completed successfully")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    add_dual_value_columns()