#!/usr/bin/env python3
"""
One-time database path normalization script
Fixes all image file_path entries to use consistent forward-slash format
"""

import sqlite3
import os
from pathlib import Path

def normalize_path(path_str):
    """
    Normalize path to use forward slashes and remove any leading ../
    """
    if not path_str:
        return path_str
    
    # Convert backslashes to forward slashes
    normalized = path_str.replace('\\', '/')
    
    # Remove leading ../ or ./
    while normalized.startswith('../') or normalized.startswith('./'):
        if normalized.startswith('../'):
            normalized = normalized[3:]
        elif normalized.startswith('./'):
            normalized = normalized[2:]
    
    # Ensure it starts with uploads/projects/
    if not normalized.startswith('uploads/projects/'):
        # Try to extract the relevant part
        if 'uploads' in normalized:
            # Find uploads and take everything from there
            uploads_index = normalized.find('uploads')
            normalized = normalized[uploads_index:]
        elif normalized.startswith('projects/'):
            normalized = 'uploads/' + normalized
        else:
            # If we can't determine the path, leave it as is
            print(f"WARNING: Could not normalize path: {path_str}")
            return path_str
    
    return normalized

def fix_database_paths():
    """
    Fix all file_path entries in the database
    """
    db_path = Path(__file__).parent.parent / 'database.db'
    
    if not os.path.exists(db_path):
        print("❌ Database file not found!")
        return False
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all images with their current paths
        cursor.execute("SELECT id, filename, file_path FROM images")
        images = cursor.fetchall()
        
        print(f"📊 Found {len(images)} images in database")
        
        fixed_count = 0
        for image_id, filename, current_path in images:
            if current_path:
                normalized_path = normalize_path(current_path)
                
                if normalized_path != current_path:
                    print(f"🔧 Fixing: {current_path} → {normalized_path}")
                    cursor.execute(
                        "UPDATE images SET file_path = ?, updated_at = datetime('now') WHERE id = ?",
                        (normalized_path, image_id)
                    )
                    fixed_count += 1
                else:
                    print(f"✅ OK: {current_path}")
        
        # Commit changes
        conn.commit()
        conn.close()
        
        print(f"\n🎉 SUCCESS: Fixed {fixed_count} image paths!")
        print(f"📝 Total images processed: {len(images)}")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def verify_paths():
    """
    Verify that all paths are now in correct format
    """
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        cursor.execute("SELECT file_path FROM images WHERE file_path IS NOT NULL")
        paths = cursor.fetchall()
        
        print(f"\n🔍 VERIFICATION: Checking {len(paths)} paths...")
        
        issues = []
        for (path,) in paths:
            if path:
                # Check for issues
                if '\\' in path:
                    issues.append(f"Contains backslash: {path}")
                elif path.startswith('../'):
                    issues.append(f"Starts with ../: {path}")
                elif not path.startswith('uploads/projects/'):
                    issues.append(f"Doesn't start with uploads/projects/: {path}")
        
        if issues:
            print("❌ ISSUES FOUND:")
            for issue in issues[:10]:  # Show first 10 issues
                print(f"  - {issue}")
            if len(issues) > 10:
                print(f"  ... and {len(issues) - 10} more")
        else:
            print("✅ ALL PATHS ARE CORRECTLY FORMATTED!")
        
        conn.close()
        return len(issues) == 0
        
    except Exception as e:
        print(f"❌ VERIFICATION ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting database path normalization...")
    print("=" * 50)
    
    # Fix paths
    success = fix_database_paths()
    
    if success:
        # Verify the fix
        verify_paths()
        print("\n" + "=" * 50)
        print("✅ Database path normalization completed!")
        print("🎯 All image paths should now work correctly in the UI")
    else:
        print("\n" + "=" * 50)
        print("❌ Database path normalization failed!")
        print("🔧 Please check the error messages above")