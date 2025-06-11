#!/usr/bin/env python3
"""
Database Debug Tool
Shows detailed information about images, datasets, and file paths
Similar to the debug output shown by the user
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime

def check_file_exists(file_path):
    """Check if physical file exists"""
    if not file_path:
        return False
    
    # Handle different path formats
    if file_path.startswith('..'):
        # Relative path going up directories
        abs_path = Path(__file__).parent.parent / file_path.replace('\\', '/')
    elif file_path.startswith('uploads/'):
        # Standard relative path
        abs_path = Path(__file__).parent.parent / file_path
    else:
        # Assume it's already relative to project root
        abs_path = Path(__file__).parent.parent / 'uploads' / file_path
    
    return abs_path.exists()

def format_datetime(dt_str):
    """Format datetime string"""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return dt_str

def debug_database():
    """Debug database contents with detailed file information"""
    db_path = Path(__file__).parent.parent / "database.db"
    
    if not db_path.exists():
        print("❌ Database not found!")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get all datasets with their images
    cursor.execute("""
        SELECT d.id, d.name, d.split_type, d.total_images, d.labeled_images, 
               d.created_at, d.updated_at, p.name as project_name
        FROM datasets d
        LEFT JOIN projects p ON d.project_id = p.id
        ORDER BY d.created_at DESC
    """)
    
    datasets = cursor.fetchall()
    
    print("🔍 DATABASE DEBUG REPORT")
    print("=" * 80)
    
    for dataset in datasets:
        dataset_id, name, split_type, total_images, labeled_images, created_at, updated_at, project_name = dataset
        
        print(f"\n📁 DATASET: {name} (Project: {project_name or 'None'})")
        print(f"   🔀 Split Section: {split_type}")
        print(f"   📈 Images: {total_images} total, {labeled_images} labeled")
        print(f"   📅 Created: {format_datetime(created_at)}")
        print(f"   🔄 Updated: {format_datetime(updated_at)}")
        
        # Get images for this dataset
        cursor.execute("""
            SELECT id, filename, file_path, split_type, labeled, auto_labeled, 
                   verified, created_at, updated_at
            FROM images 
            WHERE dataset_id = ?
            ORDER BY filename
        """, (dataset_id,))
        
        images = cursor.fetchall()
        
        for image in images:
            img_id, filename, file_path, img_split, labeled, auto_labeled, verified, img_created, img_updated = image
            
            # Check if physical file exists
            file_exists = check_file_exists(file_path)
            file_status = "✅ Found" if file_exists else "❌ Missing"
            
            print(f"\n   🖼️  IMAGE: {filename} (ID: {img_id[:8]}...)")
            print(f"      📁 File Path: {file_path or 'None'}")
            print(f"      🔍 Physical File: {file_status}")
            print(f"      🔀 Split Section: {img_split}")
            print(f"      🏷️  Labeled: {'Yes' if labeled else 'No'}")
            print(f"      🤖 Auto-labeled: {'Yes' if auto_labeled else 'No'}")
            print(f"      ✅ Verified: {'Yes' if verified else 'No'}")
            print(f"      📅 Created: {format_datetime(img_created)}")
            print(f"      🔄 Updated: {format_datetime(img_updated)}")
            
            # Get annotations count
            cursor.execute("SELECT COUNT(*) FROM annotations WHERE image_id = ?", (img_id,))
            annotation_count = cursor.fetchone()[0]
            print(f"      📝 Annotations: {annotation_count}")
    
    # Summary statistics
    cursor.execute("SELECT COUNT(*) FROM projects")
    project_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM datasets")
    dataset_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM images")
    image_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM images WHERE labeled = 1")
    labeled_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM annotations")
    annotation_count = cursor.fetchone()[0]
    
    print(f"\n📊 SUMMARY STATISTICS")
    print("=" * 40)
    print(f"Projects: {project_count}")
    print(f"Datasets: {dataset_count}")
    print(f"Images: {image_count}")
    print(f"Labeled Images: {labeled_count}")
    print(f"Total Annotations: {annotation_count}")
    
    # Check for path issues
    cursor.execute("SELECT COUNT(*) FROM images WHERE file_path LIKE '..%' OR file_path LIKE '%\\\\%'")
    bad_paths = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM images WHERE file_path IS NULL OR file_path = ''")
    null_paths = cursor.fetchone()[0]
    
    if bad_paths > 0 or null_paths > 0:
        print(f"\n⚠️  PATH ISSUES DETECTED")
        print("=" * 40)
        if bad_paths > 0:
            print(f"❌ Images with relative/Windows paths: {bad_paths}")
        if null_paths > 0:
            print(f"❌ Images with missing paths: {null_paths}")
    else:
        print(f"\n✅ ALL PATHS LOOK GOOD!")
    
    conn.close()

if __name__ == "__main__":
    debug_database()