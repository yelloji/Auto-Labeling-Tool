#!/usr/bin/env python3
"""
Path Migration Script for Auto-Labeling-Tool
============================================
Migrates old-style file paths to new cross-platform format.
Fixes issues with relative paths, Windows-style paths, and missing files.

Usage: python migrate_paths.py
"""

import os
import sys
import sqlite3
from pathlib import Path
from typing import List, Tuple, Optional

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.path_utils import path_manager
from core.config import settings


class PathMigrator:
    """Migrates database paths to new standardized format"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(settings.DATABASE_PATH)
        self.conn = None
        self.migrated_count = 0
        self.failed_count = 0
        self.missing_files = []
        
    def connect(self):
        """Connect to database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            print(f"✅ Connected to database: {self.db_path}")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
    
    def backup_database(self):
        """Create backup of database before migration"""
        backup_path = f"{self.db_path}.backup"
        try:
            import shutil
            shutil.copy2(self.db_path, backup_path)
            print(f"✅ Database backed up to: {backup_path}")
            return True
        except Exception as e:
            print(f"❌ Failed to backup database: {e}")
            return False
    
    def get_all_images(self) -> List[sqlite3.Row]:
        """Get all images from database"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT i.*, d.name as dataset_name, p.name as project_name
            FROM images i
            JOIN datasets d ON i.dataset_id = d.id
            JOIN projects p ON d.project_id = p.id
        """)
        return cursor.fetchall()
    
    def find_actual_file(self, image_row: sqlite3.Row) -> Optional[str]:
        """Try to find the actual file location"""
        filename = image_row['filename']
        project_name = image_row['project_name']
        dataset_name = image_row['dataset_name']
        
        # Possible locations to check
        possible_paths = [
            # Current path in database
            image_row['file_path'],
            
            # Standard new format
            f"uploads/projects/{project_name}/{dataset_name}/unassigned/{filename}",
            f"uploads/projects/{project_name}/{dataset_name}/annotating/{filename}",
            f"uploads/projects/{project_name}/{dataset_name}/train/{filename}",
            f"uploads/projects/{project_name}/{dataset_name}/val/{filename}",
            f"uploads/projects/{project_name}/{dataset_name}/test/{filename}",
            
            # Legacy formats
            f"uploads/{project_name}/{dataset_name}/{filename}",
            f"uploads/projects/{project_name}/{filename}",
            f"uploads/{dataset_name}/{filename}",
            f"uploads/{filename}",
            
            # Check in test_images (sample data)
            f"test_images/{dataset_name}/{filename}",
            f"test_images/animal/{filename}",
            f"test_images/bike_dataset/{filename}",
            f"test_images/bread_dataset/{filename}",
            f"test_images/car_dataset/{filename}",
        ]
        
        for path in possible_paths:
            if not path:
                continue
                
            # Try both as relative and absolute paths
            abs_path = path_manager.get_absolute_path(path)
            if abs_path.exists():
                # Return normalized relative path
                return path_manager.normalize_path(path)
        
        return None
    
    def migrate_image_path(self, image_id: str, old_path: str, new_path: str) -> bool:
        """Update image path in database"""
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "UPDATE images SET file_path = ?, updated_at = datetime('now') WHERE id = ?",
                (new_path, image_id)
            )
            self.conn.commit()
            return True
        except Exception as e:
            print(f"❌ Failed to update path for image {image_id}: {e}")
            return False
    
    def migrate_all_paths(self):
        """Migrate all image paths"""
        print("\n🔄 Starting path migration...")
        
        images = self.get_all_images()
        total_images = len(images)
        
        if total_images == 0:
            print("ℹ️  No images found in database")
            return
        
        print(f"📊 Found {total_images} images to process")
        
        for i, image in enumerate(images, 1):
            image_id = image['id']
            old_path = image['file_path']
            filename = image['filename']
            
            print(f"\n[{i}/{total_images}] Processing: {filename}")
            print(f"   Current path: {old_path}")
            
            # Check if current path works
            if path_manager.file_exists(old_path):
                # Normalize the path but keep it working
                normalized_path = path_manager.normalize_path(old_path)
                if normalized_path != old_path:
                    print(f"   ✅ Normalizing path: {normalized_path}")
                    if self.migrate_image_path(image_id, old_path, normalized_path):
                        self.migrated_count += 1
                    else:
                        self.failed_count += 1
                else:
                    print(f"   ✅ Path already correct")
                continue
            
            # Try to find the actual file
            print(f"   🔍 File not found, searching...")
            actual_path = self.find_actual_file(image)
            
            if actual_path:
                print(f"   ✅ Found file at: {actual_path}")
                if self.migrate_image_path(image_id, old_path, actual_path):
                    self.migrated_count += 1
                else:
                    self.failed_count += 1
            else:
                print(f"   ❌ File not found anywhere")
                self.missing_files.append({
                    'id': image_id,
                    'filename': filename,
                    'old_path': old_path,
                    'project': image['project_name'],
                    'dataset': image['dataset_name']
                })
                self.failed_count += 1
    
    def organize_existing_files(self):
        """Move files to standardized directory structure"""
        print("\n📁 Organizing file structure...")
        
        # Get all unique project/dataset combinations
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT p.name as project_name, d.name as dataset_name
            FROM projects p
            JOIN datasets d ON p.id = d.project_id
        """)
        combinations = cursor.fetchall()
        
        for combo in combinations:
            project_name = combo['project_name']
            dataset_name = combo['dataset_name']
            
            # Create standardized directory structure
            for split_type in ['unassigned', 'annotating', 'train', 'val', 'test']:
                target_dir = path_manager.get_image_storage_path(project_name, dataset_name, split_type)
                path_manager.ensure_directory_exists(target_dir)
                print(f"   📂 Created: {target_dir}")
    
    def print_summary(self):
        """Print migration summary"""
        print("\n" + "="*60)
        print("MIGRATION SUMMARY")
        print("="*60)
        print(f"✅ Successfully migrated: {self.migrated_count}")
        print(f"❌ Failed migrations: {self.failed_count}")
        print(f"📁 Missing files: {len(self.missing_files)}")
        
        if self.missing_files:
            print("\n📋 MISSING FILES:")
            for missing in self.missing_files[:10]:  # Show first 10
                print(f"   - {missing['filename']} ({missing['project']}/{missing['dataset']})")
            
            if len(self.missing_files) > 10:
                print(f"   ... and {len(self.missing_files) - 10} more")
        
        print("\n💡 RECOMMENDATIONS:")
        if self.migrated_count > 0:
            print("   - Restart the application to use new paths")
        if self.missing_files:
            print("   - Re-upload missing files or remove orphaned database records")
        print("   - Test image loading in the application")
    
    def run_migration(self):
        """Run complete migration process"""
        print("🏷️  Auto-Labeling-Tool Path Migration")
        print("="*50)
        
        if not self.connect():
            return False
        
        # Create backup
        if not self.backup_database():
            print("⚠️  Continuing without backup...")
        
        try:
            # Organize directory structure
            self.organize_existing_files()
            
            # Migrate paths
            self.migrate_all_paths()
            
            # Print summary
            self.print_summary()
            
            return True
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            return False
        finally:
            self.close()


def main():
    """Main migration function"""
    migrator = PathMigrator()
    success = migrator.run_migration()
    
    if success:
        print("\n🎉 Migration completed!")
        print("You can now restart the application.")
    else:
        print("\n💥 Migration failed!")
        print("Check the error messages above.")
    
    return 0 if success else 1


def migrate_paths_if_needed():
    """
    Automatic path migration that runs on backend startup
    Only migrates if there are problematic paths detected
    """
    import sqlite3
    from pathlib import Path
    
    db_path = Path(__file__).parent.parent / "database.db"
    if not db_path.exists():
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Check if images table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='images'")
    if not cursor.fetchone():
        conn.close()
        return  # Database not initialized yet
    
    # Check for problematic paths
    cursor.execute("""
        SELECT COUNT(*) FROM images 
        WHERE file_path LIKE '..%' 
           OR file_path LIKE '%\\%'
           OR (file_path IS NOT NULL AND file_path NOT LIKE 'uploads/%')
    """)
    
    problematic_count = cursor.fetchone()[0]
    conn.close()
    
    if problematic_count > 0:
        print(f"🔧 Found {problematic_count} images with problematic paths - running auto-migration...")
        migrator = PathMigrator()
        success = migrator.run_migration()
        if success:
            print("✅ Auto-migration completed successfully")
        else:
            print("⚠️ Auto-migration had issues - check logs")
    else:
        print("✅ All image paths are properly formatted")


if __name__ == "__main__":
    sys.exit(main())