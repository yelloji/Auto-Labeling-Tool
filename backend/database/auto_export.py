#!/usr/bin/env python3
"""
Automatic Database Export System
===============================
Automatically exports database data to JSON and CSV files whenever the database is updated.
Provides clear, readable data without needing to run debug scripts.

Features:
- Real-time database monitoring
- JSON export for structured data
- CSV export for spreadsheet compatibility
- Automatic file updates on database changes
- Clear data organization by projects/datasets
"""

import sqlite3
import json
import csv
import os
import sys
from datetime import datetime
from pathlib import Path
import threading
import time
from typing import Dict, List, Any

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from logging_system.professional_logger import get_professional_logger
    logger = get_professional_logger()
    USE_PROFESSIONAL_LOGGER = True
except ImportError:
    # Fallback to basic logging if professional logger not available
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    USE_PROFESSIONAL_LOGGER = False

def log_info(category, message, operation, data):
    """Helper function for logging info messages"""
    if USE_PROFESSIONAL_LOGGER:
        logger.info(category, message, operation, data)
    else:
        logger.info(f"{message} - {data if data else ''}")

def log_error(category, message, operation, data):
    """Helper function for logging error messages"""
    if USE_PROFESSIONAL_LOGGER:
        logger.error(category, message, operation, data)
    else:
        logger.error(f"{message} - {data if data else ''}")

def log_warning(category, message, operation, data):
    """Helper function for logging warning messages"""
    if USE_PROFESSIONAL_LOGGER:
        logger.warning(category, message, operation, data)
    else:
        logger.warning(f"{message} - {data if data else ''}")

class DatabaseAutoExporter:
    def __init__(self, db_path=None, export_dir="database_exports"):
        if db_path is None:
            # Get absolute path to database.db in project root
            current_file = Path(__file__).resolve()
            project_root = current_file.parent.parent.parent  # Go up from backend/database/ to root
            db_path = project_root / "database.db"
        self.db_path = db_path
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(exist_ok=True)
        
        # Export file paths
        self.json_file = self.export_dir / "database_export.json"
        self.csv_projects_file = self.export_dir / "projects.csv"
        self.csv_datasets_file = self.export_dir / "datasets.csv"
        self.csv_images_file = self.export_dir / "images.csv"
        self.csv_annotations_file = self.export_dir / "annotations.csv"
        
        # Monitoring state
        self.last_modified = 0
        self.monitoring = False
        self.monitor_thread = None
        
        log_info("app.database", "Database auto-exporter initialized", "auto_export_init", {
            "db_path": str(self.db_path),
            "export_dir": str(self.export_dir)
        })
    
    def get_database_data(self) -> Dict[str, Any]:
        """Extract all database data in a structured format"""
        # Debug: Print actual database path being used
        print(f"🔍 DEBUG: Database path being used: {self.db_path}")
        print(f"🔍 DEBUG: Database exists: {os.path.exists(self.db_path)}")
        
        if not os.path.exists(self.db_path):
            log_error("app.database", "Database file not found", "db_not_found", {
                "db_path": str(self.db_path)
            })
            print(f"❌ CRITICAL: Database file not found at {self.db_path}")
            return {}
        
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            data = {
                "export_timestamp": datetime.now().isoformat(),
                "database_path": str(self.db_path),
                "projects": [],
                "summary": {
                    "total_projects": 0,
                    "total_datasets": 0,
                    "total_images": 0,
                    "total_annotations": 0,
                    "labeled_images": 0,
                    "unlabeled_images": 0
                }
            }
            
            # Get projects with detailed information
            cursor.execute("""
                SELECT p.*, 
                       COUNT(DISTINCT d.id) as dataset_count,
                       COUNT(DISTINCT i.id) as image_count,
                       COUNT(DISTINCT a.id) as annotation_count,
                       COUNT(DISTINCT CASE WHEN i.is_labeled = 1 THEN i.id END) as labeled_count,
                        COUNT(DISTINCT CASE WHEN i.is_labeled = 0 THEN i.id END) as unlabeled_count
                FROM projects p
                LEFT JOIN datasets d ON p.id = d.project_id
                LEFT JOIN images i ON d.id = i.dataset_id
                LEFT JOIN annotations a ON i.id = a.image_id
                GROUP BY p.id
                ORDER BY p.created_at
            """)
            
            projects = cursor.fetchall()
            print(f"🔍 DEBUG: SQL query returned {len(projects)} projects")
            
            if not projects:
                print("⚠️ WARNING: No projects found in database!")
                # Test individual table counts for debugging
                cursor.execute("SELECT COUNT(*) FROM projects")
                project_count = cursor.fetchone()[0]
                print(f"🔍 DEBUG: Projects table has {project_count} records")
                
                cursor.execute("SELECT COUNT(*) FROM datasets")
                dataset_count = cursor.fetchone()[0]
                print(f"🔍 DEBUG: Datasets table has {dataset_count} records")
                
                cursor.execute("SELECT COUNT(*) FROM images")
                image_count = cursor.fetchone()[0]
                print(f"🔍 DEBUG: Images table has {image_count} records")
            
            for project in projects:
                project_data = {
                    "id": project["id"],
                    "name": project["name"],
                    "description": project["description"],
                    "project_type": project["project_type"],
                    "created_at": project["created_at"],
                    "updated_at": project["updated_at"],
                    "statistics": {
                        "datasets": project["dataset_count"] or 0,
                        "total_images": project["image_count"] or 0,
                        "labeled_images": project["labeled_count"] or 0,
                        "unlabeled_images": project["unlabeled_count"] or 0,
                        "annotations": project["annotation_count"] or 0
                    },
                    "datasets": []
                }
                
                # Get datasets for this project
                cursor.execute("""
                    SELECT d.*, 
                           COUNT(DISTINCT i.id) as image_count,
                           COUNT(DISTINCT a.id) as annotation_count,
                           COUNT(DISTINCT CASE WHEN i.is_labeled = 1 THEN i.id END) as labeled_count,
                            COUNT(DISTINCT CASE WHEN i.is_labeled = 0 THEN i.id END) as unlabeled_count
                    FROM datasets d
                    LEFT JOIN images i ON d.id = i.dataset_id
                    LEFT JOIN annotations a ON i.id = a.image_id
                    WHERE d.project_id = ?
                    GROUP BY d.id
                    ORDER BY d.created_at
                """, (project["id"],))
                
                datasets = cursor.fetchall()
                
                for dataset in datasets:
                    dataset_data = {
                        "id": dataset["id"],
                        "name": dataset["name"],
                        "description": dataset["description"],
                        "created_at": dataset["created_at"],
                        "updated_at": dataset["updated_at"],
                        "statistics": {
                            "total_images": dataset["image_count"] or 0,
                            "labeled_images": dataset["labeled_count"] or 0,
                            "unlabeled_images": dataset["unlabeled_count"] or 0,
                            "annotations": dataset["annotation_count"] or 0
                        },
                        "images": []
                    }
                    
                    # Get images for this dataset
                    cursor.execute("""
                        SELECT i.*, COUNT(a.id) as annotation_count
                        FROM images i
                        LEFT JOIN annotations a ON i.id = a.image_id
                        WHERE i.dataset_id = ?
                        GROUP BY i.id
                        ORDER BY i.filename
                    """, (dataset["id"],))
                    
                    images = cursor.fetchall()
                    
                    for image in images:
                        image_data = {
                            "id": image["id"],
                            "filename": image["filename"],
                            "original_filename": image["original_filename"],
                            "file_path": image["file_path"],
                            "width": image["width"],
                            "height": image["height"],
                            "format": image["format"],
                            "file_size": image["file_size"],
                            "split_type": image["split_type"],
                            "split_section": image["split_section"] if "split_section" in image.keys() else "train",
                            "is_labeled": bool(image["is_labeled"]),
                            "is_auto_labeled": bool(image["is_auto_labeled"]),
                            "is_verified": bool(image["is_verified"]),
                            "annotation_count": image["annotation_count"] or 0,
                            "created_at": image["created_at"],
                            "updated_at": image["updated_at"],
                            "file_exists": os.path.exists(image["file_path"]) if image["file_path"] else False
                        }
                        
                        dataset_data["images"].append(image_data)
                    
                    project_data["datasets"].append(dataset_data)
                
                data["projects"].append(project_data)
                
                # Update summary
                data["summary"]["total_projects"] += 1
                data["summary"]["total_datasets"] += project_data["statistics"]["datasets"]
                data["summary"]["total_images"] += project_data["statistics"]["total_images"]
                data["summary"]["total_annotations"] += project_data["statistics"]["annotations"]
                data["summary"]["labeled_images"] += project_data["statistics"]["labeled_images"]
                data["summary"]["unlabeled_images"] += project_data["statistics"]["unlabeled_images"]
            
            conn.close()
            
            log_info("app.database", "Database data extracted successfully", "data_extracted", {
                "projects": data["summary"]["total_projects"],
                "datasets": data["summary"]["total_datasets"],
                "images": data["summary"]["total_images"],
                "annotations": data["summary"]["total_annotations"]
            })
            
            return data
            
        except Exception as e:
            print(f"❌ EXCEPTION in get_database_data: {e}")
            print(f"❌ Exception type: {type(e).__name__}")
            import traceback
            print(f"❌ Full traceback:")
            traceback.print_exc()
            
            log_error("app.database", "Failed to extract database data", "data_extraction_error", {
                "error": str(e),
                "error_type": type(e).__name__,
                "db_path": str(self.db_path)
            })
            return {}
    
    def export_to_json(self, data: Dict[str, Any]) -> bool:
        """Export data to JSON file"""
        try:
            with open(self.json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            log_info("app.database", "JSON export completed", "json_export_success", {
                "file_path": str(self.json_file),
                "file_size": os.path.getsize(self.json_file)
            })
            return True
            
        except Exception as e:
            log_error("app.database", "JSON export failed", "json_export_error", {
                "error": str(e),
                "file_path": str(self.json_file)
            })
            return False
    
    def export_to_csv(self, data: Dict[str, Any]) -> bool:
        """Export data to CSV files"""
        try:
            # Export projects
            with open(self.csv_projects_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'ID', 'Name', 'Description', 'Type', 'Created', 'Updated',
                    'Datasets', 'Total Images', 'Labeled Images', 'Unlabeled Images', 'Annotations'
                ])
                
                for project in data.get('projects', []):
                    stats = project.get('statistics', {})
                    writer.writerow([
                        project.get('id', ''),
                        project.get('name', ''),
                        project.get('description', ''),
                        project.get('project_type', ''),
                        project.get('created_at', ''),
                        project.get('updated_at', ''),
                        stats.get('datasets', 0),
                        stats.get('total_images', 0),
                        stats.get('labeled_images', 0),
                        stats.get('unlabeled_images', 0),
                        stats.get('annotations', 0)
                    ])
            
            # Export datasets
            with open(self.csv_datasets_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'ID', 'Name', 'Description', 'Project ID', 'Project Name', 'Created', 'Updated',
                    'Total Images', 'Labeled Images', 'Unlabeled Images', 'Annotations'
                ])
                
                for project in data.get('projects', []):
                    for dataset in project.get('datasets', []):
                        stats = dataset.get('statistics', {})
                        writer.writerow([
                            dataset.get('id', ''),
                            dataset.get('name', ''),
                            dataset.get('description', ''),
                            project.get('id', ''),
                            project.get('name', ''),
                            dataset.get('created_at', ''),
                            dataset.get('updated_at', ''),
                            stats.get('total_images', 0),
                            stats.get('labeled_images', 0),
                            stats.get('unlabeled_images', 0),
                            stats.get('annotations', 0)
                        ])
            
            # Export images
            with open(self.csv_images_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'ID', 'Filename', 'Original Filename', 'File Path', 'Project', 'Dataset',
                    'Width', 'Height', 'Format', 'File Size', 'Split Type', 'Split Section',
                    'Is Labeled', 'Is Auto Labeled', 'Is Verified', 'Annotations', 'File Exists',
                    'Created', 'Updated'
                ])
                
                for project in data.get('projects', []):
                    for dataset in project.get('datasets', []):
                        for image in dataset.get('images', []):
                            writer.writerow([
                                image.get('id', ''),
                                image.get('filename', ''),
                                image.get('original_filename', ''),
                                image.get('file_path', ''),
                                project.get('name', ''),
                                dataset.get('name', ''),
                                image.get('width', ''),
                                image.get('height', ''),
                                image.get('format', ''),
                                image.get('file_size', ''),
                                image.get('split_type', ''),
                                image.get('split_section', ''),
                                'Yes' if image.get('is_labeled') else 'No',
                                'Yes' if image.get('is_auto_labeled') else 'No',
                                'Yes' if image.get('is_verified') else 'No',
                                image.get('annotation_count', 0),
                                'Yes' if image.get('file_exists') else 'No',
                                image.get('created_at', ''),
                                image.get('updated_at', '')
                            ])
            
            log_info("app.database", "CSV export completed", "csv_export_success", {
                "projects_file": str(self.csv_projects_file),
                "datasets_file": str(self.csv_datasets_file),
                "images_file": str(self.csv_images_file)
            })
            return True
            
        except Exception as e:
            log_error("app.database", "CSV export failed", "csv_export_error", {
                "error": str(e)
            })
            return False
    
    def export_now(self) -> bool:
        """Perform immediate export of database data"""
        log_info("app.database", "Starting database export", "export_start", {})
        
        data = self.get_database_data()
        if not data:
            return False
        
        json_success = self.export_to_json(data)
        csv_success = self.export_to_csv(data)
        
        success = json_success and csv_success
        
        if success:
            log_info("app.database", "Database export completed successfully", "export_complete", {
                "json_file": str(self.json_file),
                "csv_files": [str(self.csv_projects_file), str(self.csv_datasets_file), str(self.csv_images_file)]
            })
        
        return success
    
    def get_db_modification_time(self) -> float:
        """Get database file modification time"""
        try:
            return os.path.getmtime(self.db_path)
        except:
            return 0
    
    def monitor_database(self, check_interval: int = 5):
        """Monitor database for changes and auto-export"""
        log_info("app.database", "Starting database monitoring", "monitor_start", {
            "check_interval": check_interval
        })
        
        self.last_modified = self.get_db_modification_time()
        
        while self.monitoring:
            try:
                current_modified = self.get_db_modification_time()
                
                if current_modified > self.last_modified:
                    log_info("app.database", "Database change detected", "db_change_detected", {
                        "last_modified": self.last_modified,
                        "current_modified": current_modified
                    })
                    
                    # Wait a moment for any ongoing database operations to complete
                    time.sleep(1)
                    
                    # Export data
                    self.export_now()
                    self.last_modified = current_modified
                
                time.sleep(check_interval)
                
            except Exception as e:
                log_error("app.database", "Error in database monitoring", "monitor_error", {
                    "error": str(e)
                })
                time.sleep(check_interval)
    
    def start_monitoring(self, check_interval: int = 5):
        """Start monitoring database in background thread"""
        if self.monitoring:
            log_warning("app.database", "Database monitoring already running", "monitor_already_running", {})
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(
            target=self.monitor_database,
            args=(check_interval,),
            daemon=True
        )
        self.monitor_thread.start()
        
        log_info("app.database", "Database monitoring started", "monitor_started", {
            "check_interval": check_interval
        })
    
    def stop_monitoring(self):
        """Stop monitoring database"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=10)
        
        log_info("app.database", "Database monitoring stopped", "monitor_stopped", {})


# Global exporter instance
_exporter = None

def get_auto_exporter() -> DatabaseAutoExporter:
    """Get global auto-exporter instance"""
    global _exporter
    if _exporter is None:
        # Import export_config to get the correct export directory path
        try:
            from .export_config import export_settings
            export_dir = export_settings.EXPORT_DIRECTORY
        except ImportError:
            # Fallback to default if import fails
            export_dir = "database_exports"
        _exporter = DatabaseAutoExporter(export_dir=export_dir)
    return _exporter

def start_auto_export(check_interval: int = 5):
    """Start automatic database export monitoring"""
    exporter = get_auto_exporter()
    exporter.start_monitoring(check_interval)
    return exporter

def export_database_now():
    """Export database immediately"""
    exporter = get_auto_exporter()
    return exporter.export_now()

def stop_auto_export():
    """Stop automatic database export monitoring"""
    exporter = get_auto_exporter()
    exporter.stop_monitoring()

if __name__ == "__main__":
    # Command line usage
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "monitor":
        # Start monitoring mode
        exporter = DatabaseAutoExporter()
        exporter.export_now()  # Initial export
        exporter.start_monitoring()
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping database monitoring...")
            exporter.stop_monitoring()
    else:
        # One-time export
        exporter = DatabaseAutoExporter()
        success = exporter.export_now()
        print(f"Export {'successful' if success else 'failed'}")
        
        if success:
            print(f"Files created:")
            print(f"  JSON: {exporter.json_file}")
            print(f"  CSV Projects: {exporter.csv_projects_file}")
            print(f"  CSV Datasets: {exporter.csv_datasets_file}")
            print(f"  CSV Images: {exporter.csv_images_file}")