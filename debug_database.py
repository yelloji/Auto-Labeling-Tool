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
import hashlib

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

    def get_training_sessions_table(self):
        """Detailed info about training_sessions table"""
        cursor = self.conn.cursor()
        self.print_header("TRAINING SESSIONS TABLE")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='training_sessions'")
        if not cursor.fetchone():
            print("❌ training_sessions table does not exist!")
            return
        print("\n📐 Schema:")
        cursor.execute("PRAGMA table_info('training_sessions')")
        for col in cursor.fetchall():
            col_info = f"   - {col[1]} ({col[2]})"
            if col[3]:
                col_info += " NOT NULL"
            if col[4] is not None:
                col_info += f" DEFAULT {col[4]}"
            if col[5]:
                col_info += " PRIMARY KEY"
            print(col_info)
        print("\n🔎 Indexes:")
        cursor.execute("PRAGMA index_list('training_sessions')")
        idx_list = cursor.fetchall()
        if idx_list:
            for idx in idx_list:
                idx_name = idx[1]
                is_unique = bool(idx[2]) if len(idx) > 2 else False
                print(f"   - {idx_name} {'(UNIQUE)' if is_unique else ''}")
                try:
                    cursor.execute(f"PRAGMA index_info('{idx_name}')")
                    cols = ", ".join([r[2] for r in cursor.fetchall()])
                    print(f"     Columns: {cols}")
                except Exception as e:
                    print(f"     ⚠️  Could not read index columns: {e}")
        else:
            print("   (no indexes)")
        cursor.execute("SELECT COUNT(*) FROM training_sessions")
        count = cursor.fetchone()[0]
        print(f"\n📊 Total rows: {count}")
        if count:
            print("\n🗂️  Recent Sessions:")
            # Preserve actual column order as defined in the table
            cursor.execute("PRAGMA table_info('training_sessions')")
            _cols_info = cursor.fetchall()
            _col_names = [c[1] for c in _cols_info]
            cursor.execute("""
                SELECT *
                FROM training_sessions
                ORDER BY created_at DESC
                LIMIT 10
            """)
            for row in cursor.fetchall():
                print(f"   🧾 Full Row (table order):")
                for cn in _col_names:
                    val = row[cn]
                    if cn in ("dataset_summary_json", "resolved_config_json", "metrics_json") and val:
                        try:
                            _parsed = json.loads(val) if isinstance(val, str) else val
                            print(f"         {cn}:")
                            for _line in json.dumps(_parsed, indent=2, default=str).splitlines():
                                print(f"           {_line}")
                        except Exception:
                            print(f"         {cn}: (could not parse)")
                    else:
                        print(f"         {cn}: {val if val not in (None, '') else 'N/A'}")
    
    def get_model_experiments_table(self):
        """Detailed info about model_experiments table"""
        cursor = self.conn.cursor()
        self.print_header("MODEL EXPERIMENTS TABLE")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='model_experiments'")
        if not cursor.fetchone():
            print("❌ model_experiments table does not exist!")
            return
        
        print("\n📐 Schema:")
        cursor.execute("PRAGMA table_info('model_experiments')")
        for col in cursor.fetchall():
            col_info = f"   - {col[1]} ({col[2]})"
            if col[3]: col_info += " NOT NULL"
            if col[4] is not None: col_info += f" DEFAULT {col[4]}"
            if col[5]: col_info += " PRIMARY KEY"
            print(col_info)
            
        cursor.execute("SELECT COUNT(*) FROM model_experiments")
        count = cursor.fetchone()[0]
        print(f"\n📊 Total rows: {count}")
        
        if count:
            print("\n🧪 Recent Experiments:")
            cursor.execute("PRAGMA table_info('model_experiments')")
            _cols_info = cursor.fetchall()
            _col_names = [c[1] for c in _cols_info]
            
            cursor.execute("""
                SELECT * FROM model_experiments 
                ORDER BY created_at DESC 
                LIMIT 15
            """)
            for row in cursor.fetchall():
                print(f"\n   🔬 EXPERIMENT: {row['id']} [{row['experiment_type']}]")
                print(f"      Status: {row['status']}")
                print(f"      Created: {row['created_at']}")
                
                for cn in _col_names:
                    if cn in ('id', 'experiment_type', 'status', 'created_at'): continue
                    val = row[cn]
                    
                    json_fields = (
                        'custom_params', 'validation_metrics', 'per_class_metrics', 
                        'confusion_matrix', 'input_images', 'predictions'
                    )
                    
                    if cn in json_fields and val:
                        try:
                            _parsed = json.loads(val) if isinstance(val, str) else val
                            print(f"      {cn}:")
                            for _line in json.dumps(_parsed, indent=2, default=str).splitlines():
                                print(f"         {_line}")
                        except Exception:
                            print(f"      {cn}: (could not parse)")
                    else:
                        print(f"      {cn}: {val if val not in (None, '') else 'N/A'}")
    
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
                print(f"   🔀 Split Sections:")
                for split_type, count in split_types:
                    print(f"      - {split_type}: {count} images")
                    
                    # Check if physical folder exists for each split type
                    expected_folder = f"projects/{dataset['project_name']}/{split_type}/{dataset['name']}"
                    folder_exists = os.path.exists(expected_folder)
                    print(f"        📂 Folder: {expected_folder} {'✅' if folder_exists else '❌'}")
            else:
                print(f"   🔀 Split Sections: None")
    
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
            print(f"      🔀 Split Type: {image['split_type']}")
            
            # Check if split_section column exists in the database
            try:
                split_section = image['split_section']
                print(f"      🏷️  Split Section: {split_section}")
            except:
                print(f"      🏷️  Split Section: Column not found in database")
                
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

    def get_image_transformations_detailed(self):
        """Get detailed information about image transformations and dual-value system"""
        cursor = self.conn.cursor()
        
        self.print_header("IMAGE TRANSFORMATIONS & DUAL-VALUE SYSTEM")
        
        # Check if image_transformations table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='image_transformations';")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("❌ image_transformations table not found in database")
            return
        
        # Get all transformations
        cursor.execute("""
            SELECT * FROM image_transformations 
            ORDER BY release_version, order_index, transformation_type
        """)
        transformations = cursor.fetchall()
        
        if not transformations:
            print("❌ No image transformations found in database")
            return
        
        current_release = None
        for trans in transformations:
            if current_release != trans['release_version']:
                current_release = trans['release_version']
                self.print_subheader(f"RELEASE VERSION: {current_release}")
                
                # Get release statistics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_transformations,
                        COUNT(CASE WHEN is_dual_value = 1 THEN 1 END) as dual_value_count,
                        COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as enabled_count,
                        MAX(transformation_combination_count) as max_images,
                        MAX(user_selected_images_per_original) as user_selected
                    FROM image_transformations 
                    WHERE release_version = ?
                """, (current_release,))
                stats = cursor.fetchone()
                
                print(f"   📊 Release Statistics:")
                print(f"      Total Transformations: {stats['total_transformations']}")
                print(f"      Dual-Value Tools: {stats['dual_value_count']}")
                print(f"      Enabled Tools: {stats['enabled_count']}")
                print(f"      Max Images per Original: {stats['max_images'] if stats['max_images'] else 'Not calculated'}")
                print(f"      Images per Original (User Choice): {stats['user_selected'] if stats['user_selected'] else 'Not set'}")
            
            print(f"\n   🔧 TRANSFORMATION: {trans['transformation_type']} (ID: {trans['id'][:8]}...)")
            print(f"      📝 Category: {trans['category'] if trans['category'] else 'N/A'}")
            print(f"      🔢 Order Index: {trans['order_index']}")
            print(f"      ✅ Enabled: {'Yes' if trans['is_enabled'] else 'No'}")
            print(f"      🔄 Status: {trans['status'] if trans['status'] else 'N/A'}")
            
            # Dual-value system information
            print(f"      🎯 Dual-Value System:")
            print(f"         Is Dual-Value: {'Yes' if trans['is_dual_value'] else 'No'}")
            print(f"         Dual-Value Enabled: {'Yes' if trans['dual_value_enabled'] else 'No'}")
            
            # Parameters
            if trans['parameters']:
                try:
                    params = json.loads(trans['parameters']) if isinstance(trans['parameters'], str) else trans['parameters']
                    print(f"      ⚙️  Parameters: {json.dumps(params, indent=10)}")
                except:
                    print(f"      ⚙️  Parameters: {trans['parameters']}")
            
            # Dual-value parameters
            if trans['dual_value_parameters']:
                try:
                    dual_params = json.loads(trans['dual_value_parameters']) if isinstance(trans['dual_value_parameters'], str) else trans['dual_value_parameters']
                    print(f"      🎭 Dual-Value Parameters: {json.dumps(dual_params, indent=10)}")
                except:
                    print(f"      🎭 Dual-Value Parameters: {trans['dual_value_parameters']}")
            
            # Parameter ranges
            if trans['parameter_ranges']:
                try:
                    ranges = json.loads(trans['parameter_ranges']) if isinstance(trans['parameter_ranges'], str) else trans['parameter_ranges']
                    print(f"      📊 Parameter Ranges: {json.dumps(ranges, indent=10)}")
                except:
                    print(f"      📊 Parameter Ranges: {trans['parameter_ranges']}")
            
            # Range enabled params
            if trans['range_enabled_params']:
                try:
                    range_params = json.loads(trans['range_enabled_params']) if isinstance(trans['range_enabled_params'], str) else trans['range_enabled_params']
                    print(f"      🎛️  Range Enabled Params: {json.dumps(range_params, indent=10)}")
                except:
                    print(f"      🎛️  Range Enabled Params: {trans['range_enabled_params']}")
            
            # New columns information
            print(f"      📈 Combination Count: {trans['transformation_combination_count'] if trans['transformation_combination_count'] else 'Not calculated'}")
            print(f"      👤 Images per Original (User Choice): {trans['user_selected_images_per_original'] if trans['user_selected_images_per_original'] else 'Not set'}")
            
            print(f"      📅 Created: {trans['created_at']}")
            print(f"      🔄 Release ID: {trans['release_id'] if trans['release_id'] else 'N/A'}")
        
        # Check for auto-generated values in dual_value_parameters
        self.print_subheader("AUTO-GENERATED VALUES CHECK")
        cursor.execute("""
            SELECT transformation_type, dual_value_parameters 
            FROM image_transformations 
            WHERE dual_value_parameters IS NOT NULL 
            AND dual_value_parameters != 'null'
            AND dual_value_parameters != '{}'
        """)
        auto_gen_data = cursor.fetchall()
        
        if auto_gen_data:
            print("✅ Found transformations with dual-value parameters (auto-generated values):")
            for row in auto_gen_data:
                print(f"   🔧 {row['transformation_type']}:")
                try:
                    params = json.loads(row['dual_value_parameters']) if isinstance(row['dual_value_parameters'], str) else row['dual_value_parameters']
                    print(f"      Auto-gen data: {json.dumps(params, indent=8)}")
                except:
                    print(f"      Raw data: {row['dual_value_parameters']}")
        else:
            print("❌ No auto-generated values found in dual_value_parameters column")
            print("   This might be normal if auto-generation happens at runtime")

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
                            for j, point in enumerate(segmentation):  # Show ALL points
                                print(f"               Point {j+1}: ({point['x']:8.2f}, {point['y']:8.2f})")
                        elif isinstance(segmentation[0], list):
                            # Polygon format: [[x1,y1,x2,y2,...]]
                            for i, polygon in enumerate(segmentation):
                                points = [(polygon[j], polygon[j+1]) for j in range(0, len(polygon), 2)]
                                print(f"            Polygon {i+1}: {len(points)} points")
                                for j, (x, y) in enumerate(points):  # Show ALL points
                                    print(f"               Point {j+1}: ({x:8.2f}, {y:8.2f})")
                        elif all(isinstance(x, (int, float)) for x in segmentation):
                            # Single polygon: [x1,y1,x2,y2,...]
                            try:
                                points = [(segmentation[j], segmentation[j+1]) for j in range(0, len(segmentation), 2)]
                                print(f"            Polygon: {len(points)} points")
                                for j, (x, y) in enumerate(points):  # Show ALL points
                                    print(f"               Point {j+1}: ({x:8.2f}, {y:8.2f})")
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
                    # Use the correct path format without 'uploads/'
                    expected_path = f"projects/{project_name}/{split_type}/{dataset_name}"
                    exists = os.path.exists(expected_path)
                    
                    print(f"   Split: {split_type}")
                    print(f"   Expected: {expected_path}")
                    print(f"   Status: {'✅ EXISTS' if exists else '❌ MISSING'}")
                    
                    if exists:
                        # Count files in folder
                        try:
                            total_image_files = []
                            
                            # For dataset split type, check for train/val/test subfolders
                            if split_type == "dataset":
                                # First check the main folder for direct files
                                direct_files = list(Path(expected_path).glob("*.*"))
                                direct_image_files = [f for f in direct_files if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']]
                                total_image_files.extend(direct_image_files)
                                
                                # Check for train/val/test subfolders
                                split_sections = ['train', 'val', 'test']
                                subfolder_details = []
                                
                                for section in split_sections:
                                    section_path = os.path.join(expected_path, section)
                                    if os.path.exists(section_path):
                                        section_files = list(Path(section_path).glob("*.*"))
                                        section_image_files = [f for f in section_files if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']]
                                        if section_image_files:
                                            total_image_files.extend(section_image_files)
                                            subfolder_details.append(f"{section}: {len(section_image_files)} files")
                                
                                print(f"   Files in folder: {len(total_image_files)}")
                                
                                # Print details of subfolder distribution if any
                                if subfolder_details:
                                    print(f"   Subfolder distribution: {', '.join(subfolder_details)}")
                            else:
                                # For non-dataset split types, just check the folder directly
                                files = list(Path(expected_path).glob("*.*"))
                                total_image_files = [f for f in files if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']]
                                print(f"   Files in folder: {len(total_image_files)}")
                            
                            # Count images in database for this dataset and split type
                            cursor.execute("SELECT COUNT(*) FROM images WHERE dataset_id = ? AND split_type = ?", (dataset['id'], split_type))
                            db_count = cursor.fetchone()[0]
                            print(f"   Images in DB: {db_count}")
                            
                            if len(total_image_files) != db_count:
                                print(f"   ⚠️  MISMATCH: Folder has {len(total_image_files)} files, DB has {db_count} records")
                                if split_type == "dataset" and subfolder_details:
                                    print(f"   ℹ️  NOTE: Files are distributed across train/val/test subfolders")
                        except Exception as e:
                            print(f"   ❌ Error reading folder: {e}")
        
        # Check for orphaned folders
        print(f"\n🔍 CHECKING FOR ORPHANED FOLDERS:")
        projects_path = "projects"  # Changed from uploads/projects to projects
        if os.path.exists(projects_path):
            for project_folder in os.listdir(projects_path):
                project_path = os.path.join(projects_path, project_folder)
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
    
    def get_labels_table(self):
        """Get all labels from the labels table"""
        cursor = self.conn.cursor()
        
        self.print_header("LABELS TABLE DATA")
        
        # Check if labels table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='labels'")
        if not cursor.fetchone():
            print("❌ Labels table does not exist!")
            return
        
        # Get all labels
        cursor.execute("""
            SELECT 
                p.name AS project_name,
                l.id,
                l.name,
                l.color,
                l.project_id
            FROM labels l
            LEFT JOIN projects p ON l.project_id = p.id
            ORDER BY l.project_id
        """)
        
        labels = cursor.fetchall()
        
        if not labels:
            print("❌ No labels found in the database!")
            return
        
        print(f"📋 Found {len(labels)} labels in database\n")
        
        # Group labels by project
        projects = {}
        for label in labels:
            project_id = label['project_id']
            if project_id not in projects:
                projects[project_id] = {
                    'name': label['project_name'],
                    'labels': []
                }
            projects[project_id]['labels'].append(label)
        
        # Display labels by project
        for project_id, project_data in projects.items():
            self.print_subheader(f"Project: {project_data['name']} (ID: {project_id})")
            
            for label in project_data['labels']:
                print(f"   🏷️  ID: {label['id']}, Name: {label['name']}, Color: {label['color']}")
            
            print(f"   Total: {len(project_data['labels'])} labels\n")
        
        # Check for labels used in annotations
        print("\n🔍 CHECKING LABELS USAGE IN ANNOTATIONS:")
        for project_id, project_data in projects.items():
            print(f"\n   Project: {project_data['name']} (ID: {project_id})")
            
            for label in project_data['labels']:
                # Count annotations using this label name
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM annotations 
                    WHERE class_name = ?
                """, (label['name'],))
                
                annotation_count = cursor.fetchone()[0]
                
                # Get list of datasets where this label is used
                cursor.execute("""
                    SELECT DISTINCT d.id, d.name
                    FROM annotations a
                    JOIN images i ON a.image_id = i.id
                    JOIN datasets d ON i.dataset_id = d.id
                    WHERE a.class_name = ? AND d.project_id = ?
                """, (label['name'], project_id))
                
                datasets = cursor.fetchall()
                dataset_names = [d['name'] for d in datasets]
                
                if annotation_count > 0:
                    print(f"      ✅ Label '{label['name']}' used in {annotation_count} annotations")
                    if dataset_names:
                        print(f"         Used in datasets: {', '.join(dataset_names)}")
                else:
                    print(f"      ❌ Label '{label['name']}' not used in any annotations")

    def get_ai_models_table(self):
        """Get detailed information about AI models (ai_models table)"""
        cursor = self.conn.cursor()

        self.print_header("AI MODELS TABLE")

        # Check if ai_models table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_models'")
        if not cursor.fetchone():
            print("❌ ai_models table does not exist!")
            print("ℹ️  If you just added the model schema, start the backend or run init_database.py to create tables.")
            return

        # Print table schema
        print("\n📐 Schema:")
        cursor.execute("PRAGMA table_info(ai_models);")
        columns = cursor.fetchall()
        for col in columns:
            col_info = f"   - {col[1]} ({col[2]})"
            if col[3]:  # NOT NULL
                col_info += " NOT NULL"
            if col[4] is not None:  # Default value
                col_info += f" DEFAULT {col[4]}"
            if col[5]:  # Primary key
                col_info += " PRIMARY KEY"
            print(col_info)

        # Print indexes
        print("\n🔎 Indexes:")
        cursor.execute("PRAGMA index_list('ai_models');")
        index_list = cursor.fetchall()
        if index_list:
            for idx in index_list:
                # idx columns: seq, name, unique, origin, partial (SQLite versions may vary)
                idx_name = idx[1]
                is_unique = bool(idx[2]) if len(idx) > 2 else False
                print(f"   - {idx_name} {'(UNIQUE)' if is_unique else ''}")
                try:
                    cursor.execute(f"PRAGMA index_info('{idx_name}');")
                    idx_cols = cursor.fetchall()
                    cols = ", ".join([c[2] for c in idx_cols]) if idx_cols else "(unknown columns)"
                    print(f"     Columns: {cols}")
                except Exception as e:
                    print(f"     ⚠️  Could not read index columns: {e}")
        else:
            print("   (no indexes)")

        # Row count
        cursor.execute("SELECT COUNT(*) FROM ai_models;")
        count = cursor.fetchone()[0]
        print(f"\n📊 Total rows: {count}")

        if count == 0:
            print("ℹ️  No AI models found in the database yet.")
            return

        # Fetch and display entries
        cursor.execute("""
            SELECT id, name, type, format, file_path, project_id, project_name, nc, classes, 
                   training_input_size, input_size_default, source_type, training_session_id, 
                   description, is_best, created_at, updated_at
            FROM ai_models
            ORDER BY created_at
        """)
        rows = cursor.fetchall()

        for row in rows:
            print(f"\n🤖 MODEL: {row['name']} (ID: {row['id']})")
            print(f"   🔧 Type: {row['type']}")
            print(f"   📦 Format: {row['format']}")
            print(f"   💾 File Path: {row['file_path']} {'✅' if os.path.exists(row['file_path']) else '❌'}")
            print(f"   🏗️  Project ID: {row['project_id']}")
            print(f"   🏷️  Project Name: {row['project_name']}")
            print(f"   🎯 Class Count (nc): {row['nc']}")

            # Parse classes JSON
            classes_raw = row['classes']
            classes_list = None
            try:
                if isinstance(classes_raw, str):
                    classes_list = json.loads(classes_raw)
                else:
                    classes_list = classes_raw
            except (json.JSONDecodeError, TypeError) as e:
                print(f"   🏷️  Classes: (could not parse) {classes_raw} — {e}")

            if isinstance(classes_list, list):
                print(f"   🏷️  Classes ({len(classes_list)}): {', '.join(map(str, classes_list))}")
            else:
                print(f"   🏷️  Classes: {classes_raw}")

            # Input sizes
            tis = row['training_input_size']
            ids = row['input_size_default']
            print(f"   📏 Training Input Size: {tis if tis is not None else 'N/A'}")
            print(f"   📏 Input Size Default: {ids if ids is not None else 'N/A'}")

            # New columns
            print(f"   📌 Source Type: {row['source_type'] if row['source_type'] else 'N/A'}")
            print(f"   🔗 Training Session ID: {row['training_session_id'] if row['training_session_id'] else 'N/A'}")
            print(f"   📝 Description: {row['description'] if row['description'] else 'N/A'}")
            print(f"   🏆 Is Best: {'Yes' if row['is_best'] else 'No'}")

            # Timestamps
            print(f"   📅 Created: {row['created_at']}")
            print(f"   🔄 Updated: {row['updated_at'] if 'updated_at' in row.keys() else 'N/A'}")

    def get_dev_mode_settings_table(self):
        """Show developer mode settings table (password state)"""
        cursor = self.conn.cursor()

        self.print_header("DEV MODE SETTINGS TABLE")

        # Check table existence
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dev_mode_settings'")
        if not cursor.fetchone():
            print("❌ dev_mode_settings table does not exist!")
            return

        # Schema
        print("\n📐 Schema:")
        cursor.execute("PRAGMA table_info(dev_mode_settings)")
        for col in cursor.fetchall():
            col_info = f"   - {col[1]} ({col[2]})"
            if col[3]:
                col_info += " NOT NULL"
            if col[4] is not None:
                col_info += f" DEFAULT {col[4]}"
            if col[5]:
                col_info += " PRIMARY KEY"
            print(col_info)

        # Row count
        cursor.execute("SELECT COUNT(*) FROM dev_mode_settings")
        count = cursor.fetchone()[0]
        print(f"\n📊 Total rows: {count}")

        # Show the first record (if any)
        if count:
            cursor.execute("SELECT id, password_hash, master_password_hash, updated_at FROM dev_mode_settings ORDER BY id LIMIT 1")
            row = cursor.fetchone()
            print(f"\n🗂️  Current Setting:")
            has_pw = bool(row[1])
            is_default = has_pw and (row[1] == hashlib.sha256(b"0000").hexdigest())
            pw_state = (
                "Default (0000)" if is_default else ("Custom (hidden)" if has_pw else "Not set")
            )
            has_master = bool(row[2])
            is_master_default = has_master and (row[2] == hashlib.sha256(b"gevis").hexdigest())
            master_state = (
                "Default (gevis)" if is_master_default else ("Custom (hidden)" if has_master else "Not set")
            )
            print(f"   id: {row[0]} • updated_at: {row[3]} • password: {pw_state} • master: {master_state}")

    def get_image_transformations_table(self):
        """Get detailed information about image transformations"""
        cursor = self.conn.cursor()
        
        self.print_header("IMAGE TRANSFORMATIONS TABLE")
        
        # Check if image_transformations table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='image_transformations'")
        if not cursor.fetchone():
            print("❌ image_transformations table does not exist!")
            return
        
        # Get all transformations
        cursor.execute("""
            SELECT id, transformation_type, parameters, is_enabled, order_index, 
                   release_version, category, created_at, status, release_id
            FROM image_transformations
            ORDER BY status, category, order_index, created_at
        """)
        
        transformations = cursor.fetchall()
        
        if not transformations:
            print("❌ No image transformations found in the database!")
            return
        
        print(f"🔧 Found {len(transformations)} image transformations in database\n")
        
        # Group transformations by category
        categories = {}
        for transform in transformations:
            category = transform['category'] or 'basic'  # Default to basic if None
            if category not in categories:
                categories[category] = []
            categories[category].append(transform)
        
        # Display transformations by category
        for category, transforms in categories.items():
            self.print_subheader(f"Category: {category.upper()} ({len(transforms)} transformations)")
            
            for transform in transforms:
                print(f"\n   🔧 TRANSFORMATION: {transform['transformation_type']}")
                print(f"      🆔 ID: {transform['id']}")
                print(f"      ⚙️  Parameters: {transform['parameters']}")
                print(f"      ✅ Enabled: {'Yes' if transform['is_enabled'] else 'No'}")
                print(f"      📊 Order Index: {transform['order_index']}")
                print(f"      🏷️  Release Version: {transform['release_version']}")
                print(f"      🔄 Status: {transform['status'] or 'PENDING'}")
                print(f"      🔗 Release ID: {transform['release_id'] or 'None'}")
                print(f"      📅 Created: {transform['created_at']}")
                
                # Parse and display parameters in a readable format
                try:
                    if transform['parameters']:
                        params = json.loads(transform['parameters']) if isinstance(transform['parameters'], str) else transform['parameters']
                        if isinstance(params, dict) and params:
                            print(f"      📋 Parsed Parameters:")
                            for key, value in params.items():
                                print(f"         - {key}: {value}")
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"      ⚠️  Could not parse parameters: {e}")
        
        # Statistics
        print(f"\n📊 TRANSFORMATION STATISTICS:")
        cursor.execute("SELECT category, COUNT(*) FROM image_transformations GROUP BY category")
        category_stats = cursor.fetchall()
        
        print(f"   📋 By Category:")
        for category, count in category_stats:
            print(f"      {category or 'basic'}: {count} transformations")
        
        cursor.execute("SELECT COUNT(*) FROM image_transformations WHERE is_enabled = 1")
        enabled_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM image_transformations WHERE is_enabled = 0")
        disabled_count = cursor.fetchone()[0]
        
        print(f"   📋 By Enabled Status:")
        print(f"      ✅ Enabled: {enabled_count}")
        print(f"      ❌ Disabled: {disabled_count}")
        
        # Status statistics
        cursor.execute("SELECT status, COUNT(*) FROM image_transformations GROUP BY status")
        status_stats = cursor.fetchall()
        
        print(f"   📋 By Workflow Status:")
        for status, count in status_stats:
            status_icon = "🟡" if status == "PENDING" else "🟢" if status == "COMPLETED" else "❓"
            print(f"      {status_icon} {status or 'PENDING'}: {count} transformations")
        
        # Release linking statistics
        cursor.execute("SELECT COUNT(*) FROM image_transformations WHERE release_id IS NOT NULL")
        linked_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM image_transformations WHERE release_id IS NULL")
        unlinked_count = cursor.fetchone()[0]
        
        print(f"   📋 By Release Linking:")
        print(f"      🔗 Linked to Release: {linked_count}")
        print(f"      🔓 Not Linked: {unlinked_count}")
        
        # Check for unique transformation types
        cursor.execute("SELECT DISTINCT transformation_type FROM image_transformations ORDER BY transformation_type")
        unique_types = cursor.fetchall()
        
        print(f"   🔧 Unique Types: {', '.join([t[0] for t in unique_types])}")

    def get_releases_table(self):
        """Get detailed information about releases"""
        cursor = self.conn.cursor()
        
        self.print_header("RELEASES TABLE")
        
        # Check if releases table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='releases'")
        if not cursor.fetchone():
            print("❌ releases table does not exist!")
            return
        
        # Get all releases
        cursor.execute("""
            SELECT r.id, r.project_id, r.name, r.description, r.export_format, 
                   r.task_type, r.datasets_used, r.config, r.total_original_images,
                   r.total_augmented_images, r.final_image_count,
                   r.train_image_count, r.val_image_count, r.test_image_count,
                   r.class_count,r.model_path, r.created_at, p.name as project_name
            FROM releases r
            LEFT JOIN projects p ON r.project_id = p.id
            ORDER BY r.created_at DESC
        """)
        
        releases = cursor.fetchall()
        
        if not releases:
            print("❌ No releases found in the database!")
            print("ℹ️  This is normal if no dataset releases have been created yet.")
            return
        
        print(f"🚀 Found {len(releases)} releases in database\n")
        
        # Display releases
        for release in releases:
            print(f"\n🚀 RELEASE: {release['name']}")
            print(f"   🆔 ID: {release['id']}")
            print(f"   🏗️  Project: {release['project_name']} (ID: {release['project_id']})")
            print(f"   📝 Description: {release['description'] or 'No description'}")
            print(f"   📦 Export Format: {release['export_format'] or 'Not specified'}")
            print(f"   🎯 Task Type: {release['task_type'] or 'Not specified'}")
            print(f"   📅 Created: {release['created_at']}")
            
            # Display image counts
            print(f"   📊 Image Counts:")
            print(f"      Original: {release['total_original_images'] or 'N/A'}")
            print(f"      Augmented: {release['total_augmented_images'] or 'N/A'}")
            print(f"      Final: {release['final_image_count'] or 'N/A'}")
            print(f"      Train: {release['train_image_count'] or 'N/A'}")
            print(f"      Val: {release['val_image_count'] or 'N/A'}")
            print(f"      Test: {release['test_image_count'] or 'N/A'}")
            print(f"      Classes: {release['class_count'] or 'N/A'}")
            
            
            # Display model path
            if release['model_path']:
                model_exists = os.path.exists(release['model_path'])
                print(f"   💾 Model Path: {release['model_path']} {'✅' if model_exists else '❌'}")
            else:
                print(f"   💾 Model Path: Not specified")
            
            # Parse and display datasets used
            if release['datasets_used']:
                try:
                    datasets = json.loads(release['datasets_used']) if isinstance(release['datasets_used'], str) else release['datasets_used']
                    if isinstance(datasets, list):
                        print(f"   📁 Datasets Used: {len(datasets)} dataset(s)")
                        for i, dataset_id in enumerate(datasets[:5]):  # Show first 5
                            # Get dataset name
                            cursor.execute("SELECT name FROM datasets WHERE id = ?", (dataset_id,))
                            dataset_result = cursor.fetchone()
                            dataset_name = dataset_result[0] if dataset_result else "Unknown"
                            print(f"      {i+1}. {dataset_name} (ID: {dataset_id})")
                        if len(datasets) > 5:
                            print(f"      ... and {len(datasets)-5} more datasets")
                    else:
                        print(f"   📁 Datasets Used: {datasets}")
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"   📁 Datasets Used: Could not parse ({e})")
            else:
                print(f"   📁 Datasets Used: None specified")
            
            # Parse and display configuration
            if release['config']:
                try:
                    config = json.loads(release['config']) if isinstance(release['config'], str) else release['config']
                    if isinstance(config, dict):
                        print(f"   ⚙️  Configuration:")
                        for key, value in config.items():
                            if isinstance(value, dict):
                                print(f"      {key}: {len(value)} settings")
                            elif isinstance(value, list):
                                print(f"      {key}: {len(value)} items")
                            else:
                                print(f"      {key}: {value}")
                    else:
                        print(f"   ⚙️  Configuration: {config}")
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"   ⚙️  Configuration: Could not parse ({e})")
            else:
                print(f"   ⚙️  Configuration: None specified")
        
        # Statistics
        print(f"\n📊 RELEASE STATISTICS:")
        cursor.execute("SELECT export_format, COUNT(*) FROM releases GROUP BY export_format")
        format_stats = cursor.fetchall()
        
        if format_stats:
            print(f"   📦 Export Formats:")
            for format_type, count in format_stats:
                print(f"      {format_type or 'Unspecified'}: {count} releases")
        
        cursor.execute("SELECT task_type, COUNT(*) FROM releases GROUP BY task_type")
        task_stats = cursor.fetchall()
        
        if task_stats:
            print(f"   🎯 Task Types:")
            for task_type, count in task_stats:
                print(f"      {task_type or 'Unspecified'}: {count} releases")
        
        # Check for releases with missing files
        cursor.execute("SELECT COUNT(*) FROM releases WHERE model_path IS NOT NULL")
        releases_with_path = cursor.fetchone()[0]
        
        if releases_with_path > 0:
            cursor.execute("SELECT model_path FROM releases WHERE model_path IS NOT NULL")
            paths = cursor.fetchall()
            missing_files = 0
            for path_row in paths:
                if not os.path.exists(path_row[0]):
                    missing_files += 1
            
            print(f"   💾 File Status:")
            print(f"      With model path: {releases_with_path}")
            print(f"      Missing files: {missing_files}")

    def get_transformation_release_relationships(self):
        """Show relationships between transformations and releases"""
        cursor = self.conn.cursor()
        
        self.print_header("TRANSFORMATION-RELEASE RELATIONSHIPS")
        
        # Check if both tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('image_transformations', 'releases')")
        tables = [row[0] for row in cursor.fetchall()]
        
        if 'image_transformations' not in tables:
            print("❌ image_transformations table does not exist!")
            return
        if 'releases' not in tables:
            print("❌ releases table does not exist!")
            return
        
        # Get transformations with their linked releases
        cursor.execute("""
            SELECT 
                t.id as transform_id,
                t.transformation_type,
                t.status,
                t.release_version,
                t.release_id,
                t.created_at as transform_created,
                r.name as release_name,
                r.created_at as release_created
            FROM image_transformations t
            LEFT JOIN releases r ON t.release_id = r.id
            ORDER BY t.status, t.release_version, t.created_at
        """)
        
        relationships = cursor.fetchall()
        
        if not relationships:
            print("❌ No transformations found!")
            return
        
        # Group by status
        pending_transforms = [r for r in relationships if r['status'] == 'PENDING' or r['status'] is None]
        completed_transforms = [r for r in relationships if r['status'] == 'COMPLETED']
        
        # Show pending transformations
        if pending_transforms:
            self.print_subheader("🟡 PENDING TRANSFORMATIONS (Not yet in a release)")
            
            # Group by release_version
            version_groups = {}
            for transform in pending_transforms:
                version = transform['release_version']
                if version not in version_groups:
                    version_groups[version] = []
                version_groups[version].append(transform)
            
            for version, transforms in version_groups.items():
                print(f"\n   📦 Release Version: {version}")
                print(f"      🔄 Status: PENDING ({len(transforms)} transformations)")
                print(f"      🔗 Release ID: None (not yet created)")
                
                for transform in transforms:
                    print(f"         🔧 {transform['transformation_type']} (ID: {transform['transform_id'][:8]}...)")
                    print(f"            📅 Created: {transform['transform_created']}")
        
        # Show completed transformations
        if completed_transforms:
            self.print_subheader("🟢 COMPLETED TRANSFORMATIONS (Linked to releases)")
            
            # Group by release
            release_groups = {}
            for transform in completed_transforms:
                release_id = transform['release_id']
                if release_id not in release_groups:
                    release_groups[release_id] = []
                release_groups[release_id].append(transform)
            
            for release_id, transforms in release_groups.items():
                release_name = transforms[0]['release_name'] if transforms[0]['release_name'] else 'Unknown Release'
                release_created = transforms[0]['release_created']
                
                print(f"\n   🚀 Release: {release_name}")
                print(f"      🆔 Release ID: {release_id}")
                print(f"      🔄 Status: COMPLETED ({len(transforms)} transformations)")
                print(f"      📅 Release Created: {release_created}")
                
                for transform in transforms:
                    print(f"         🔧 {transform['transformation_type']} (ID: {transform['transform_id'][:8]}...)")
                    print(f"            📅 Transform Created: {transform['transform_created']}")
        
        # Summary statistics
        print(f"\n📊 RELATIONSHIP SUMMARY:")
        print(f"   🟡 Pending Transformations: {len(pending_transforms)}")
        print(f"   🟢 Completed Transformations: {len(completed_transforms)}")
        print(f"   📦 Unique Release Versions: {len(set(r['release_version'] for r in relationships if r['release_version']))}")
        print(f"   🚀 Linked Releases: {len(set(r['release_id'] for r in completed_transforms if r['release_id']))}")

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
        
        # Labels
        cursor.execute("SELECT COUNT(*) FROM labels")
        label_count = cursor.fetchone()[0] if cursor.rowcount != -1 else 0
        
        # Split sections (from images table)
        cursor.execute("SELECT split_section, COUNT(*) FROM images GROUP BY split_section")
        split_stats = cursor.fetchall()
        
        print(f"📊 OVERALL STATISTICS:")
        print(f"   🏗️  Projects: {project_count}")
        print(f"   📁 Datasets: {dataset_count}")
        print(f"   🖼️  Total Images: {image_count}")
        print(f"   ✅ Labeled Images: {labeled_count}")
        print(f"   ❌ Unlabeled Images: {unlabeled_count}")
        print(f"   🎯 Total Annotations: {annotation_count}")
        print(f"   🔖 Total Labels: {label_count}")
        
        print(f"\n📈 SPLIT SECTION DISTRIBUTION:")
        for split_section, count in split_stats:
            print(f"   {split_section}: {count} images")
        
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
            self.get_ai_models_table()  # Add AI models table analysis
            self.get_dev_mode_settings_table()  # Show dev-mode settings
            self.get_model_experiments_table()  # Show model experiments
            self.get_training_sessions_table()  # Training sessions table analysis
            self.get_projects_overview()
            self.get_datasets_detailed()
            self.get_labels_table()  # Add labels table analysis
            self.get_releases_table()  # Add releases table analysis
            self.get_image_transformations_table()  # Add image transformations table analysis
            self.get_image_transformations_detailed()  # Add detailed dual-value transformations analysis
            self.get_transformation_release_relationships()  # Show transformation-release relationships
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
    import argparse
    
    parser = argparse.ArgumentParser(description='Database debugging tool')
    parser.add_argument('--db', type=str, default='database.db', help='Path to database file')
    parser.add_argument('--labels', action='store_true', help='Show only labels table data')
    parser.add_argument('--ai-models', action='store_true', help='Show only ai_models table data')
    parser.add_argument('--experiments', action='store_true', help='Show model_experiments table data')
    parser.add_argument('--training-sessions', action='store_true', help='Show training_sessions table data')
    parser.add_argument('--projects', action='store_true', help='Show projects overview')
    parser.add_argument('--datasets', action='store_true', help='Show datasets detailed view')
    parser.add_argument('--images', action='store_true', help='Show images detailed view')
    parser.add_argument('--annotations-summary', action='store_true', help='Show annotations summary')
    parser.add_argument('--annotations-detailed', action='store_true', help='Show detailed annotations')
    parser.add_argument('--releases', action='store_true', help='Show releases table')
    parser.add_argument('--transformations', action='store_true', help='Show image_transformations table')
    parser.add_argument('--transformations-detailed', action='store_true', help='Show detailed image transformations')
    parser.add_argument('--relationships', action='store_true', help='Show transformation-release relationships')
    parser.add_argument('--stats', action='store_true', help='Show database statistics')
    parser.add_argument('--schema', action='store_true', help='Show database schema information')
    parser.add_argument('--filesystem', action='store_true', help='Compare file system vs database')
    args = parser.parse_args()
    
    db_path = args.db
    
    # Check if database file exists
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        return
    
    print("🔧 Database Debug Viewer")
    print("=" * 50)
    print(f"Using database file: {db_path}")
    
    debugger = DatabaseDebugger(db_path)
    targets = [
        args.labels,
        args.ai_models,
        args.experiments,
        args.training_sessions,
        args.projects,
        args.datasets,
        args.images,
        args.annotations_summary,
        args.annotations_detailed,
        args.releases,
        args.transformations,
        args.transformations_detailed,
        args.relationships,
        args.stats,
        args.schema,
        args.filesystem,
    ]
    if any(targets):
        if debugger.connect():
            if args.labels:
                debugger.get_labels_table()
            if args.ai_models:
                debugger.get_ai_models_table()
            if args.experiments:
                debugger.get_model_experiments_table()
            if args.training_sessions:
                debugger.get_training_sessions_table()
            if args.projects:
                debugger.get_projects_overview()
            if args.datasets:
                debugger.get_datasets_detailed()
            if args.images:
                debugger.get_images_detailed()
            if args.annotations_summary:
                debugger.get_annotations_summary()
            if args.annotations_detailed:
                debugger.get_detailed_annotations()
            if args.releases:
                debugger.get_releases_table()
            if args.transformations:
                debugger.get_image_transformations_table()
            if args.transformations_detailed:
                debugger.get_image_transformations_detailed()
            if args.relationships:
                debugger.get_transformation_release_relationships()
            if args.stats:
                debugger.get_database_statistics()
            if args.schema:
                debugger.get_table_info()
            if args.filesystem:
                debugger.get_file_system_vs_database()
            debugger.close()
    else:
        debugger.run_full_debug()

if __name__ == "__main__":
    main()
