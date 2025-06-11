"""
Database cleanup script to fix orphaned labels
"""

import sqlite3
import os
from pathlib import Path

def connect_db(db_path="database.db"):
    """Connect to SQLite database"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def cleanup_orphaned_labels(conn):
    """Remove labels that reference non-existent projects"""
    cursor = conn.cursor()
    
    # Get all project IDs
    cursor.execute("SELECT id FROM projects")
    project_ids = [row['id'] for row in cursor.fetchall()]
    
    print(f"Valid project IDs: {project_ids}")
    
    # Find orphaned labels (labels with project_id not in projects table)
    cursor.execute("""
        SELECT id, name, project_id 
        FROM labels 
        WHERE project_id NOT IN (SELECT id FROM projects)
    """)
    
    orphaned_labels = cursor.fetchall()
    
    if not orphaned_labels:
        print("✅ No orphaned labels found!")
        return
    
    print(f"Found {len(orphaned_labels)} orphaned labels:")
    for label in orphaned_labels:
        print(f"  - Label ID: {label['id']}, Name: {label['name']}, Invalid Project ID: {label['project_id']}")
    
    # Delete orphaned labels
    cursor.execute("""
        DELETE FROM labels 
        WHERE project_id NOT IN (SELECT id FROM projects)
    """)
    
    conn.commit()
    print(f"✅ Deleted {len(orphaned_labels)} orphaned labels")

def main():
    """Main function"""
    print("🔧 Database Cleanup Utility")
    print("==========================")
    
    # Connect to database
    db_path = "database.db"
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        return
    
    conn = connect_db(db_path)
    print(f"✅ Connected to database: {db_path}")
    
    # Clean up orphaned labels
    cleanup_orphaned_labels(conn)
    
    # Close connection
    conn.close()
    print("✅ Database cleanup complete")

if __name__ == "__main__":
    main()