#!/usr/bin/env python3
"""
Database Debug Viewer
=====================
A comprehensive tool to view all database information clearly for debugging.
Shows projects, datasets, images, and their relationships in a readable format.

Usage: python debug_database.py
"""

import sqlite3
import os
from datetime import datetime
from pathlib import Path
import json

class DatabaseDebugger:
    def __init__(self, db_path="database.db"):
        self.db_path = db_path
        self.conn = None
        
    def connect(self):
        """Connect to the database"""
        if not os.path.exists(self.db_path):
            print(f"❌ Database not found: {self.db_path}")
            return False
        
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row  # Enable column access by name
            print(f"✅ Connected to database: {self.db_path}")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
    
    def print_header(self, title, char="="):
        """Print a formatted header"""
        print(f"\n{char * 80}")
        print(f"{title:^80}")
        print(f"{char * 80}")
    
    def print_subheader(self, title, char="-"):
        """Print a formatted subheader"""
        print(f"\n{char * 60}")
        print(f"{title:^60}")
        print(f"{char * 60}")
    
    def get_table_info(self):
        """Get information about all tables in the database"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        self.print_header("DATABASE SCHEMA INFORMATION")
        
        for table in tables:
            table_name = table[0]
            print(f"\n📋 Table: {table_name}")
            
            # Get table schema
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            
            print("   Columns:")
            for col in columns:
                col_info = f"   - {col[1]} ({col[2]})"
                if col[3]:  # NOT NULL
                    col_info += " NOT NULL"
                if col[4] is not None:  # Default value
                    col_info += f" DEFAULT {col[4]}"
                if col[5]:  # Primary key
                    col_info += " PRIMARY KEY"
                print(col_info)
            
            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"   📊 Total rows: {count}")
    
    def get_projects_overview(self):
        """Get overview of all projects"""
        cursor = self.conn.cursor()
        
        self.print_header("PROJECTS OVERVIEW")
        
        cursor.execute("SELECT * FROM projects ORDER BY created_at;")
        projects = cursor.fetchall()
        
        if not projects:
            print("❌ No projects found in database")
            return
        
        for project in projects:
            print(f"\n🏗️  PROJECT: {project['name']} (ID: {project['id']})")
            print(f"   📝 Description: {project['description']}")
            print(f"   📅 Created: {project['created_at']}")
            print(f"   🔄 Updated: {project['updated_at']}")
            
            # Get project statistics
            cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = ?", (project['id'],))
            dataset_count = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM images i 
                JOIN datasets d ON i.dataset_id = d.id 
                WHERE d.project_id = ?
            """, (project['id'],))
            image_count = cursor.fetchone()[0]
            
            print(f"   📊 Datasets: {dataset_count}")
            print(f"   🖼️  Total Images: {image_count}")
    
    def get_datasets_detailed(self):
        """Get detailed information about all datasets"""
        cursor = self.conn.cursor()
        
        self.print_header("DATASETS DETAILED VIEW")
        
        cursor.execute("""
            SELECT d.*, p.name as project_name 
            FROM datasets d 
            JOIN projects p ON d.project_id = p.id 
            ORDER BY p.name, d.created_at
        """)
        datasets = cursor.fetchall()
        
        if not datasets:
            print("❌ No datasets found in database")
            return
        
        current_project = None
        for dataset in datasets:
            if current_project != dataset['project_name']:
                current_project = dataset['project_name']
                self.print_subheader(f"PROJECT: {current_project}")
            
            print(f"\n📁 DATASET: {dataset['name']} (ID: {dataset['id']})")
            print(f"   📝 Description: {dataset['description']}")
            print(f"   📅 Created: {dataset['created_at']}")
            print(f"   🔄 Updated: {dataset['updated_at']}")
            
            # Get dataset statistics and split types
            cursor.execute("SELECT COUNT(*) FROM images WHERE dataset_id = ?", (dataset['id'],))
            total_images = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM images WHERE dataset_id = ? AND is_labeled = 1", (dataset['id'],))
            labeled_images = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM images WHERE dataset_id = ? AND is_labeled = 0", (dataset['id'],))
            unlabeled_images = cursor.fetchone()[0]
            
            # Get split types for this dataset
            cursor.execute("SELECT split_type, COUNT(*) FROM images WHERE dataset_id = ? GROUP BY split_type", (dataset['id'],))
            split_types = cursor.fetchall()
            
            print(f"   📊 Total Images: {total_images}")
            print(f"   ✅ Labeled: {labeled_images}")
            print(f"   ❌ Unlabeled: {unlabeled_images}")
            
            if split_types:
                print(f"   🏷️  Split Types:")
                for split_type, count in split_types:
                    print(f"      - {split_type}: {count} images")
                    
                    # Check if physical folder exists for each split type
                    expected_folder = f"uploads/projects/{dataset['project_name']}/{split_type}/{dataset['name']}"
                    folder_exists = os.path.exists(expected_folder)
                    print(f"        📂 Folder: {expected_folder} {'✅' if folder_exists else '❌'}")
            else:
                print(f"   🏷️  Split Types: None")
    
    def get_images_detailed(self):
        """Get detailed information about all images"""
        cursor = self.conn.cursor()
        
        self.print_header("IMAGES DETAILED VIEW")
        
        cursor.execute("""
            SELECT i.*, d.name as dataset_name, p.name as project_name
            FROM images i 
            JOIN datasets d ON i.dataset_id = d.id 
            JOIN projects p ON d.project_id = p.id 
            ORDER BY p.name, d.name, i.filename
        """)
        images = cursor.fetchall()
        
        if not images:
            print("❌ No images found in database")
            return
        
        current_project = None
        current_dataset = None
        
        for image in images:
            if current_project != image['project_name']:
                current_project = image['project_name']
                self.print_subheader(f"PROJECT: {current_project}")
            
            if current_dataset != image['dataset_name']:
                current_dataset = image['dataset_name']
                print(f"\n📁 Dataset: {current_dataset}")
            
            print(f"\n   🖼️  IMAGE: {image['filename']} (ID: {image['id']})")
            print(f"      📂 File Path: {image['file_path']}")
            print(f"      📏 Size: {image['width']}x{image['height']}")
            print(f"      🏷️  Split Type: {image['split_type']}")
            print(f"      ✅ Labeled: {'Yes' if image['is_labeled'] else 'No'}")
            print(f"      🤖 Auto-labeled: {'Yes' if image['is_auto_labeled'] else 'No'}")
            print(f"      ✔️  Verified: {'Yes' if image['is_verified'] else 'No'}")
            print(f"      📅 Created: {image['created_at']}")
            print(f"      🔄 Updated: {image['updated_at']}")
            
            # Check if physical file exists
            file_exists = os.path.exists(image['file_path'])
            print(f"      💾 Physical File: {'✅ Exists' if file_exists else '❌ Missing'}")
            
            # Get annotations count
            cursor.execute("SELECT COUNT(*) FROM annotations WHERE image_id = ?", (image['id'],))
            annotation_count = cursor.fetchone()[0]
            print(f"      🎯 Annotations: {annotation_count}")
    
    def get_annotations_summary(self):
        """Get summary of annotations"""
        cursor = self.conn.cursor()
        
        self.print_header("ANNOTATIONS SUMMARY")
        
        cursor.execute("""
            SELECT 
                p.name as project_name,
                d.name as dataset_name,
                i.filename,
                COUNT(a.id) as annotation_count,
                GROUP_CONCAT(DISTINCT a.class_name) as labels
            FROM annotations a
            JOIN images i ON a.image_id = i.id
            JOIN datasets d ON i.dataset_id = d.id
            JOIN projects p ON d.project_id = p.id
            GROUP BY p.name, d.name, i.filename
            ORDER BY p.name, d.name, i.filename
        """)
        annotations = cursor.fetchall()
        
        if not annotations:
            print("❌ No annotations found in database")
            return
        
        current_project = None
        current_dataset = None
        
        for ann in annotations:
            if current_project != ann['project_name']:
                current_project = ann['project_name']
                self.print_subheader(f"PROJECT: {current_project}")
            
            if current_dataset != ann['dataset_name']:
                current_dataset = ann['dataset_name']
                print(f"\n📁 Dataset: {current_dataset}")
            
            labels = ann['labels'].split(',') if ann['labels'] else []
            print(f"   🖼️  {ann['filename']}: {ann['annotation_count']} annotations")
            if labels:
                print(f"      🏷️  Labels: {', '.join(labels)}")

    def get_detailed_annotations(self):
        """Get detailed view of all annotations with coordinates"""
        cursor = self.conn.cursor()
        
        self.print_header("DETAILED ANNOTATIONS WITH COORDINATES")
        
        cursor.execute("""
            SELECT 
                a.id,
                a.class_name,
                a.class_id,
                a.confidence,
                a.x_min,
                a.y_min,
                a.x_max,
                a.y_max,
                a.segmentation,
                a.is_auto_generated,
                a.is_verified,
                a.model_id,
                a.created_at,
                a.updated_at,
                p.name as project_name,
                d.name as dataset_name,
                i.filename,
                i.width as image_width,
                i.height as image_height
            FROM annotations a
            JOIN images i ON a.image_id = i.id
            JOIN datasets d ON i.dataset_id = d.id
            JOIN projects p ON d.project_id = p.id
            ORDER BY p.name, d.name, i.filename, a.class_name, a.id
        """)
        annotations = cursor.fetchall()
        
        if not annotations:
            print("❌ No annotations found in database")
            return
        
        current_project = None
        current_dataset = None
        current_image = None
        
        for ann in annotations:
            if current_project != ann['project_name']:
                current_project = ann['project_name']
                self.print_subheader(f"PROJECT: {current_project}")
            
            if current_dataset != ann['dataset_name']:
                current_dataset = ann['dataset_name']
                print(f"\n📁 Dataset: {current_dataset}")
            
            if current_image != ann['filename']:
                current_image = ann['filename']
                print(f"\n   🖼️  IMAGE: {ann['filename']} ({ann['image_width']}x{ann['image_height']})")
            
            print(f"\n      🎯 ANNOTATION #{ann['id'][:8]}...")
            print(f"         🏷️  Label: {ann['class_name']} (Class ID: {ann['class_id']})")
            print(f"         📊 Confidence: {ann['confidence'] if ann['confidence'] else 'N/A'}")
            print(f"         🤖 Auto-generated: {'Yes' if ann['is_auto_generated'] else 'No'}")
            print(f"         ✔️  Verified: {'Yes' if ann['is_verified'] else 'No'}")
            print(f"         🔧 Model ID: {ann['model_id'] if ann['model_id'] else 'Manual'}")
            print(f"         📅 Created: {ann['created_at']}")
            print(f"         🔄 Updated: {ann['updated_at']}")
            
            # Display bounding box coordinates
            if ann['x_min'] is not None and ann['y_min'] is not None:
                width = ann['x_max'] - ann['x_min']
                height = ann['y_max'] - ann['y_min']
                print(f"         📍 Bounding Box:")
                print(f"            📦 Top-Left: ({ann['x_min']}, {ann['y_min']})")
                print(f"            📦 Bottom-Right: ({ann['x_max']}, {ann['y_max']})")
                print(f"            📏 Size: {width:.1f} x {height:.1f}")
                print(f"            📐 Area: {width * height:.1f} pixels")
                
                # Calculate relative coordinates (percentage of image)
                if ann['image_width'] and ann['image_height']:
                    rel_x_min = (ann['x_min'] / ann['image_width']) * 100
                    rel_y_min = (ann['y_min'] / ann['image_height']) * 100
                    rel_x_max = (ann['x_max'] / ann['image_width']) * 100
                    rel_y_max = (ann['y_max'] / ann['image_height']) * 100
                    print(f"            📊 Relative: ({rel_x_min:.1f}%, {rel_y_min:.1f}%) to ({rel_x_max:.1f}%, {rel_y_max:.1f}%)")
            
            # Display segmentation data if available
            if ann['segmentation']:
                try:
                    segmentation = json.loads(ann['segmentation']) if isinstance(ann['segmentation'], str) else ann['segmentation']
                    print(f"         🔺 Segmentation:")
                    
                    if isinstance(segmentation, list) and len(segmentation) > 0:
                        # Check for different segmentation formats
                        if isinstance(segmentation[0], dict) and 'x' in segmentation[0] and 'y' in segmentation[0]:
                            # Format: [{x: x1, y: y1}, {x: x2, y: y2}, ...]
                            print(f"            Polygon: {len(segmentation)} points")
                            for j, point in enumerate(segmentation[:3]):  # Show first 3 points
                                print(f"               Point {j+1}: ({point['x']}, {point['y']})")
                            if len(segmentation) > 3:
                                print(f"               ... and {len(segmentation)-3} more points")
                        elif isinstance(segmentation[0], list):
                            # Polygon format: [[x1,y1,x2,y2,...]]
                            for i, polygon in enumerate(segmentation):
                                points = [(polygon[j], polygon[j+1]) for j in range(0, len(polygon), 2)]
                                print(f"            Polygon {i+1}: {len(points)} points")
                                for j, (x, y) in enumerate(points[:3]):  # Show first 3 points
                                    print(f"               Point {j+1}: ({x}, {y})")
                                if len(points) > 3:
                                    print(f"               ... and {len(points)-3} more points")
                        elif all(isinstance(x, (int, float)) for x in segmentation):
                            # Single polygon: [x1,y1,x2,y2,...]
                            try:
                                points = [(segmentation[j], segmentation[j+1]) for j in range(0, len(segmentation), 2)]
                                print(f"            Polygon: {len(points)} points")
                                for j, (x, y) in enumerate(points[:3]):  # Show first 3 points
                                    print(f"               Point {j+1}: ({x}, {y})")
                                if len(points) > 3:
                                    print(f"               ... and {len(points)-3} more points")
                            except IndexError:
                                print(f"            ⚠️ Invalid polygon format: {segmentation}")
                        else:
                            print(f"            📋 Raw: {segmentation}")
                    else:
                        print(f"            📋 Raw: {segmentation}")
                except (json.JSONDecodeError, TypeError, ValueError, IndexError) as e:
                    print(f"            ❌ Error parsing segmentation: {e}")
                    print(f"            📋 Raw: {ann['segmentation']}")
        
        # Summary statistics
        print(f"\n📊 ANNOTATION STATISTICS:")
        cursor.execute("SELECT COUNT(*) FROM annotations")
        total_annotations = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT class_name) FROM annotations")
        unique_classes = cursor.fetchone()[0]
        
        cursor.execute("SELECT class_name, COUNT(*) as count FROM annotations GROUP BY class_name ORDER BY count DESC")
        class_counts = cursor.fetchall()
        
        print(f"   🎯 Total Annotations: {total_annotations}")
        print(f"   🏷️  Unique Classes: {unique_classes}")
        print(f"   📈 Class Distribution:")
        for class_name, count in class_counts:
            percentage = (count / total_annotations) * 100
            print(f"      {class_name}: {count} annotations ({percentage:.1f}%)")
    
    def get_file_system_vs_database(self):
        """Compare file system structure with database records"""
        self.print_header("FILE SYSTEM vs DATABASE COMPARISON")
        
        cursor = self.conn.cursor()
        
        # Get all datasets and their split types from database
        cursor.execute("""
            SELECT d.*, p.name as project_name,
                   GROUP_CONCAT(DISTINCT i.split_type) as split_types
            FROM datasets d 
            JOIN projects p ON d.project_id = p.id
            LEFT JOIN images i ON d.id = i.dataset_id
            GROUP BY d.id, p.name
        """)
        datasets = cursor.fetchall()
        
        print("\n🔍 CHECKING DATASET FOLDERS:")
        for dataset in datasets:
            project_name = dataset['project_name']
            dataset_name = dataset['name']
            split_types = dataset['split_types'].split(',') if dataset['split_types'] else []
            
            print(f"\n📁 {dataset_name}")
            
            for split_type in split_types:
                if split_type:  # Skip empty split types
                    expected_path = f"uploads/projects/{project_name}/{split_type}/{dataset_name}"
                    exists = os.path.exists(expected_path)
                    
                    print(f"   Split: {split_type}")
                    print(f"   Expected: {expected_path}")
                    print(f"   Status: {'✅ EXISTS' if exists else '❌ MISSING'}")
                    
                    if exists:
                        # Count files in folder
                        try:
                            files = list(Path(expected_path).glob("*"))
                            image_files = [f for f in files if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']]
                            print(f"   Files in folder: {len(image_files)}")
                            
                            # Count images in database for this dataset and split type
                            cursor.execute("SELECT COUNT(*) FROM images WHERE dataset_id = ? AND split_type = ?", (dataset['id'], split_type))
                            db_count = cursor.fetchone()[0]
                            print(f"   Images in DB: {db_count}")
                            
                            if len(image_files) != db_count:
                                print(f"   ⚠️  MISMATCH: Folder has {len(image_files)} files, DB has {db_count} records")
                        except Exception as e:
                            print(f"   ❌ Error reading folder: {e}")
        
        # Check for orphaned folders
        print(f"\n🔍 CHECKING FOR ORPHANED FOLDERS:")
        uploads_path = "uploads/projects"
        if os.path.exists(uploads_path):
            for project_folder in os.listdir(uploads_path):
                project_path = os.path.join(uploads_path, project_folder)
                if os.path.isdir(project_path):
                    for split_folder in os.listdir(project_path):
                        split_path = os.path.join(project_path, split_folder)
                        if os.path.isdir(split_path):
                            for dataset_folder in os.listdir(split_path):
                                dataset_path = os.path.join(split_path, dataset_folder)
                                if os.path.isdir(dataset_path):
                                    # Check if this dataset exists in database
                                    cursor.execute("""
                                        SELECT COUNT(*) FROM datasets d
                                        JOIN projects p ON d.project_id = p.id
                                        JOIN images i ON d.id = i.dataset_id
                                        WHERE p.name = ? AND d.name = ? AND i.split_type = ?
                                    """, (project_folder, dataset_folder, split_folder))
                                    
                                    exists_in_db = cursor.fetchone()[0] > 0
                                    if not exists_in_db:
                                        print(f"   ⚠️  ORPHANED FOLDER: {dataset_path} (not in database)")
    
    def get_database_statistics(self):
        """Get overall database statistics"""
        cursor = self.conn.cursor()
        
        self.print_header("DATABASE STATISTICS")
        
        # Projects
        cursor.execute("SELECT COUNT(*) FROM projects")
        project_count = cursor.fetchone()[0]
        
        # Datasets
        cursor.execute("SELECT COUNT(*) FROM datasets")
        dataset_count = cursor.fetchone()[0]
        
        # Images
        cursor.execute("SELECT COUNT(*) FROM images")
        image_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM images WHERE is_labeled = 1")
        labeled_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM images WHERE is_labeled = 0")
        unlabeled_count = cursor.fetchone()[0]
        
        # Annotations
        cursor.execute("SELECT COUNT(*) FROM annotations")
        annotation_count = cursor.fetchone()[0]
        
        # Split types (from images table)
        cursor.execute("SELECT split_type, COUNT(*) FROM images GROUP BY split_type")
        split_stats = cursor.fetchall()
        
        print(f"📊 OVERALL STATISTICS:")
        print(f"   🏗️  Projects: {project_count}")
        print(f"   📁 Datasets: {dataset_count}")
        print(f"   🖼️  Total Images: {image_count}")
        print(f"   ✅ Labeled Images: {labeled_count}")
        print(f"   ❌ Unlabeled Images: {unlabeled_count}")
        print(f"   🎯 Total Annotations: {annotation_count}")
        
        print(f"\n📈 SPLIT TYPE DISTRIBUTION:")
        for split_type, count in split_stats:
            print(f"   {split_type}: {count} images")
        
        # Database file info
        db_size = os.path.getsize(self.db_path)
        db_size_mb = db_size / (1024 * 1024)
        print(f"\n💾 DATABASE FILE:")
        print(f"   Path: {os.path.abspath(self.db_path)}")
        print(f"   Size: {db_size_mb:.2f} MB")
        print(f"   Last Modified: {datetime.fromtimestamp(os.path.getmtime(self.db_path))}")
    
    def run_full_debug(self):
        """Run complete database debug analysis"""
        if not self.connect():
            return
        
        try:
            print("🔍 Starting Database Debug Analysis...")
            print(f"📅 Analysis Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            self.get_database_statistics()
            self.get_table_info()
            self.get_projects_overview()
            self.get_datasets_detailed()
            self.get_images_detailed()
            self.get_annotations_summary()
            self.get_detailed_annotations()
            self.get_file_system_vs_database()
            
            self.print_header("DEBUG ANALYSIS COMPLETE", "🎉")
            print("✅ All database information has been displayed above.")
            print("💡 Use this information to debug any data inconsistencies.")
            
        except Exception as e:
            print(f"❌ Error during debug analysis: {e}")
        finally:
            self.close()

def main():
    """Main function to run the database debugger"""
    print("🔧 Database Debug Viewer")
    print("=" * 50)
    
    # Check for database file
    db_files = ["database.db"]
    db_path = None
    
    for db_file in db_files:
        if os.path.exists(db_file):
            db_path = db_file
            break
    
    if not db_path:
        print("❌ No database file found. Checked:")
        for db_file in db_files:
            print(f"   - {db_file}")
        return
    
    # Run the debugger
    debugger = DatabaseDebugger(db_path)
    debugger.run_full_debug()

if __name__ == "__main__":
    main()