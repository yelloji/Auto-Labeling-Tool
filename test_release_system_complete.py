#!/usr/bin/env python3
"""
Complete Release System Testing - Command Line Only
Tests all 7 critical issues we fixed without using browser UI
WITH DETAILED LOGGING: Expected vs Actual Results
"""

import requests
import json
import os
import zipfile
import sqlite3
from pathlib import Path
import time
import sys
from datetime import datetime

# Configuration
API_BASE_URL = "http://localhost:12000"
DATABASE_PATH = "/workspace/project/app-2/database.db"
PROJECTS_DIR = "/workspace/project/app-2/projects"

class ReleaseSystemTester:
    def __init__(self):
        self.test_results = []
        self.release_id = None
        self.release_data = None
        
    def log_test(self, test_name, status, details=""):
        """Log test results"""
        result = {
            "test": test_name,
            "status": "✅ PASS" if status else "❌ FAIL",
            "details": details
        }
        self.test_results.append(result)
        print(f"{result['status']} {test_name}")
        if details:
            print(f"   Details: {details}")
        print()

    def check_database_state(self):
        """Test 1: Check database has proper data"""
        print("🔍 TEST 1: DATABASE STATE VERIFICATION")
        print("=" * 50)
        
        try:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # Check datasets exist
            cursor.execute("SELECT id, name FROM datasets")
            datasets = cursor.fetchall()
            self.log_test("Database has datasets", len(datasets) > 0, f"Found {len(datasets)} datasets: {[d[1] for d in datasets]}")
            
            # Check images exist
            cursor.execute("SELECT COUNT(*) FROM images")
            image_count = cursor.fetchone()[0]
            self.log_test("Database has images", image_count > 0, f"Found {image_count} images")
            
            # Check splits distribution
            cursor.execute("SELECT split, COUNT(*) FROM images GROUP BY split")
            splits = dict(cursor.fetchall())
            expected_splits = ['train', 'val', 'test']
            has_all_splits = all(split in splits for split in expected_splits)
            self.log_test("Database has proper splits", has_all_splits, f"Splits: {splits}")
            
            # Check annotations exist
            cursor.execute("SELECT COUNT(*) FROM annotations")
            annotation_count = cursor.fetchone()[0]
            self.log_test("Database has annotations", annotation_count > 0, f"Found {annotation_count} annotations")
            
            conn.close()
            return True
            
        except Exception as e:
            self.log_test("Database connection", False, f"Error: {e}")
            return False

    def test_api_create_release(self):
        """Test 2: API Create Release - Multi-dataset support"""
        print("🔍 TEST 2: API CREATE RELEASE - MULTI-DATASET")
        print("=" * 50)
        
        # Get available datasets from database
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM datasets LIMIT 4")
        dataset_ids = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        if not dataset_ids:
            self.log_test("Get dataset IDs", False, "No datasets found in database")
            return False
            
        # Prepare API payload
        payload = {
            "dataset_ids": dataset_ids,  # ✅ MULTIPLE DATASETS (Fixed Issue #1)
            "transformations": [
                {"type": "rotation", "value": -180}  # ✅ REAL TRANSFORMATION (Fixed Issue #2)
            ],
            "project_id": "test-project",
            "name": f"test_release_{int(time.time())}",
            "export_format": "yolo_detection",
            "multiplier": 4  # ✅ PROPER MULTIPLIER (Fixed Issue #2)
        }
        
        try:
            # Make API call
            response = requests.post(
                f"{API_BASE_URL}/api/v1/releases/create",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            # Check response status
            self.log_test("API returns 200 status", response.status_code == 200, f"Status: {response.status_code}")
            
            if response.status_code != 200:
                self.log_test("API response content", False, f"Error: {response.text}")
                return False
                
            # Parse response
            response_data = response.json()
            self.release_id = response_data.get("release_id")
            self.release_data = response_data.get("release", {})
            
            # Test Issue #6: Wrong Image Counts - Should show actual count, not N/A
            has_final_count = "final_image_count" in self.release_data
            final_count = self.release_data.get("final_image_count", 0)
            self.log_test("API returns final_image_count", has_final_count, f"Count: {final_count}")
            
            # Test proper count calculation (should be > 5, the old broken count)
            proper_count = final_count > 5
            self.log_test("Image count is realistic", proper_count, f"Expected >5, got {final_count}")
            
            # Test all required fields for frontend
            required_fields = ["total_original_images", "total_augmented_images", "original_image_count", "augmented_image_count"]
            for field in required_fields:
                has_field = field in self.release_data
                value = self.release_data.get(field, "MISSING")
                self.log_test(f"API returns {field}", has_field, f"Value: {value}")
            
            return True
            
        except Exception as e:
            self.log_test("API create release", False, f"Error: {e}")
            return False

    def test_database_storage(self):
        """Test 3: Database Storage - Proper counts stored"""
        print("🔍 TEST 3: DATABASE STORAGE VERIFICATION")
        print("=" * 50)
        
        if not self.release_id:
            self.log_test("Release ID available", False, "No release ID from previous test")
            return False
            
        try:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # Check release was stored
            cursor.execute("SELECT * FROM releases WHERE id = ?", (self.release_id,))
            release_record = cursor.fetchone()
            self.log_test("Release stored in database", release_record is not None, f"Release ID: {self.release_id}")
            
            if release_record:
                # Get column names
                cursor.execute("PRAGMA table_info(releases)")
                columns = [col[1] for col in cursor.fetchall()]
                release_dict = dict(zip(columns, release_record))
                
                # Test Issue #6: Image counts should not be NULL
                count_fields = ["final_image_count", "total_original_images", "total_augmented_images"]
                for field in count_fields:
                    if field in release_dict:
                        value = release_dict[field]
                        is_not_null = value is not None
                        self.log_test(f"Database {field} not NULL", is_not_null, f"Value: {value}")
            
            conn.close()
            return True
            
        except Exception as e:
            self.log_test("Database storage check", False, f"Error: {e}")
            return False

    def test_file_system_structure(self):
        """Test 4: File System - Proper YOLO structure created"""
        print("🔍 TEST 4: FILE SYSTEM STRUCTURE VERIFICATION")
        print("=" * 50)
        
        if not self.release_data:
            self.log_test("Release data available", False, "No release data from previous test")
            return False
            
        # Test Issue #7: Architecture - Files should be in correct location
        expected_base_path = Path(PROJECTS_DIR)
        
        # Look for release directory
        release_name = self.release_data.get("name", "unknown")
        possible_paths = [
            expected_base_path / "gevis" / "releases" / release_name,
            expected_base_path / "default" / "releases" / release_name,
            expected_base_path / "test-project" / "releases" / release_name
        ]
        
        release_dir = None
        for path in possible_paths:
            if path.exists():
                release_dir = path
                break
                
        if not release_dir:
            # Look for any release directory
            for root, dirs, files in os.walk(PROJECTS_DIR):
                if release_name in dirs:
                    release_dir = Path(root) / release_name
                    break
        
        self.log_test("Release directory exists", release_dir is not None, f"Path: {release_dir}")
        
        if not release_dir:
            return False
            
        # Test Issue #5: Missing data.yaml - Should exist now
        data_yaml_path = release_dir / "data.yaml"
        self.log_test("data.yaml exists", data_yaml_path.exists(), f"Path: {data_yaml_path}")
        
        # Test YOLO directory structure
        required_dirs = ["images/train", "images/val", "images/test", "labels/train", "labels/val", "labels/test"]
        for dir_path in required_dirs:
            full_path = release_dir / dir_path
            exists = full_path.exists()
            self.log_test(f"Directory {dir_path} exists", exists, f"Path: {full_path}")
        
        # Test Issue #3: Split Logic - Should have files in val and test, not just train
        train_images = list((release_dir / "images" / "train").glob("*.jpg")) if (release_dir / "images" / "train").exists() else []
        val_images = list((release_dir / "images" / "val").glob("*.jpg")) if (release_dir / "images" / "val").exists() else []
        test_images = list((release_dir / "images" / "test").glob("*.jpg")) if (release_dir / "images" / "test").exists() else []
        
        self.log_test("Train images exist", len(train_images) > 0, f"Count: {len(train_images)}")
        self.log_test("Val images exist", len(val_images) > 0, f"Count: {len(val_images)}")
        self.log_test("Test images exist", len(test_images) > 0, f"Count: {len(test_images)}")
        
        # Test Issue #3: Split distribution should be proper, not all in train
        total_images = len(train_images) + len(val_images) + len(test_images)
        proper_distribution = len(val_images) > 0 and len(test_images) > 0
        self.log_test("Proper split distribution", proper_distribution, 
                     f"Train: {len(train_images)}, Val: {len(val_images)}, Test: {len(test_images)}")
        
        return True

    def test_yolo_format_compliance(self):
        """Test 5: YOLO Format - Real annotations, not fake"""
        print("🔍 TEST 5: YOLO FORMAT COMPLIANCE")
        print("=" * 50)
        
        # Find release directory
        release_name = self.release_data.get("name", "unknown") if self.release_data else "unknown"
        release_dir = None
        
        for root, dirs, files in os.walk(PROJECTS_DIR):
            if release_name in dirs:
                release_dir = Path(root) / release_name
                break
                
        if not release_dir:
            self.log_test("Find release directory", False, "Release directory not found")
            return False
            
        # Test Issue #5: data.yaml content
        data_yaml_path = release_dir / "data.yaml"
        if data_yaml_path.exists():
            with open(data_yaml_path, 'r') as f:
                yaml_content = f.read()
                
            has_train_path = "train:" in yaml_content
            has_val_path = "val:" in yaml_content  
            has_test_path = "test:" in yaml_content
            has_nc = "nc:" in yaml_content
            has_names = "names:" in yaml_content
            
            self.log_test("data.yaml has train path", has_train_path)
            self.log_test("data.yaml has val path", has_val_path)
            self.log_test("data.yaml has test path", has_test_path)
            self.log_test("data.yaml has class count", has_nc)
            self.log_test("data.yaml has class names", has_names)
        
        # Test Issue #4: Label files should have real coordinates, not fake
        labels_dir = release_dir / "labels" / "train"
        if labels_dir.exists():
            label_files = list(labels_dir.glob("*.txt"))
            self.log_test("Label files exist", len(label_files) > 0, f"Count: {len(label_files)}")
            
            if label_files:
                # Check first label file
                with open(label_files[0], 'r') as f:
                    label_content = f.read().strip()
                
                # Test Issue #4: Should NOT be fake coordinates "0 0.5 0.5 0.3 0.3"
                is_fake = label_content == "0 0.5 0.5 0.3 0.3"
                self.log_test("Labels are NOT fake coordinates", not is_fake, f"Content: {label_content[:50]}...")
                
                # Should have proper YOLO format (class_id x_center y_center width height)
                lines = label_content.split('\n')
                valid_format = True
                for line in lines:
                    if line.strip():
                        parts = line.strip().split()
                        if len(parts) != 5:
                            valid_format = False
                            break
                        try:
                            # Should be: int float float float float
                            int(parts[0])  # class_id
                            for i in range(1, 5):
                                float(parts[i])  # coordinates
                        except ValueError:
                            valid_format = False
                            break
                
                self.log_test("Labels have valid YOLO format", valid_format, f"Sample: {lines[0] if lines else 'Empty'}")
        
        return True

    def test_image_transformations(self):
        """Test 6: Image Transformations - Real PIL processing"""
        print("🔍 TEST 6: IMAGE TRANSFORMATIONS VERIFICATION")
        print("=" * 50)
        
        # Find release directory
        release_name = self.release_data.get("name", "unknown") if self.release_data else "unknown"
        release_dir = None
        
        for root, dirs, files in os.walk(PROJECTS_DIR):
            if release_name in dirs:
                release_dir = Path(root) / release_name
                break
                
        if not release_dir:
            self.log_test("Find release directory", False, "Release directory not found")
            return False
            
        # Test Issue #2: Should have augmented images with transformation names
        train_dir = release_dir / "images" / "train"
        if train_dir.exists():
            all_images = list(train_dir.glob("*.jpg"))
            
            # Look for transformed images (should have rotation in filename)
            transformed_images = [img for img in all_images if "rot" in img.name.lower()]
            original_images = [img for img in all_images if "rot" not in img.name.lower()]
            
            self.log_test("Original images exist", len(original_images) > 0, f"Count: {len(original_images)}")
            self.log_test("Transformed images exist", len(transformed_images) > 0, f"Count: {len(transformed_images)}")
            
            # Test Issue #2: Multiplier should create proper ratio
            if len(original_images) > 0:
                expected_ratio = 4  # multiplier = 4 means 3 augmented per 1 original
                actual_ratio = (len(all_images) / len(original_images)) if len(original_images) > 0 else 0
                proper_ratio = abs(actual_ratio - expected_ratio) < 1  # Allow some tolerance
                
                self.log_test("Proper augmentation ratio", proper_ratio, 
                             f"Expected ~{expected_ratio}x, got {actual_ratio:.1f}x ({len(all_images)} total / {len(original_images)} original)")
        
        return True

    def test_zip_file_creation(self):
        """Test 7: ZIP File Creation - Proper timing and location"""
        print("🔍 TEST 7: ZIP FILE CREATION VERIFICATION")
        print("=" * 50)
        
        if not self.release_data:
            self.log_test("Release data available", False, "No release data")
            return False
            
        # Test Issue #7: ZIP should be created at creation time, not download time
        # Look for ZIP file in projects directory
        release_name = self.release_data.get("name", "unknown")
        
        zip_files = []
        for root, dirs, files in os.walk(PROJECTS_DIR):
            for file in files:
                if file.endswith('.zip') and release_name in file:
                    zip_files.append(Path(root) / file)
        
        self.log_test("ZIP file exists", len(zip_files) > 0, f"Found: {[str(z) for z in zip_files]}")
        
        if zip_files:
            zip_path = zip_files[0]
            
            # Test ZIP file size (should not be tiny like 591 bytes)
            zip_size = zip_path.stat().st_size
            reasonable_size = zip_size > 1000  # Should be > 1KB
            self.log_test("ZIP file has reasonable size", reasonable_size, f"Size: {zip_size} bytes")
            
            # Test ZIP file contents
            try:
                with zipfile.ZipFile(zip_path, 'r') as zf:
                    file_list = zf.namelist()
                    
                    # Should have YOLO structure
                    has_data_yaml = any('data.yaml' in f for f in file_list)
                    has_images = any('images/' in f for f in file_list)
                    has_labels = any('labels/' in f for f in file_list)
                    has_train = any('train/' in f for f in file_list)
                    has_val = any('val/' in f for f in file_list)
                    has_test = any('test/' in f for f in file_list)
                    
                    self.log_test("ZIP contains data.yaml", has_data_yaml)
                    self.log_test("ZIP contains images/", has_images)
                    self.log_test("ZIP contains labels/", has_labels)
                    self.log_test("ZIP contains train/", has_train)
                    self.log_test("ZIP contains val/", has_val)
                    self.log_test("ZIP contains test/", has_test)
                    
                    # Count files
                    image_files = [f for f in file_list if f.endswith(('.jpg', '.jpeg', '.png'))]
                    label_files = [f for f in file_list if f.endswith('.txt') and 'labels/' in f]
                    
                    self.log_test("ZIP contains image files", len(image_files) > 0, f"Count: {len(image_files)}")
                    self.log_test("ZIP contains label files", len(label_files) > 0, f"Count: {len(label_files)}")
                    
            except Exception as e:
                self.log_test("ZIP file inspection", False, f"Error: {e}")
        
        return True

    def test_download_api(self):
        """Test 8: Download API - Should work without errors"""
        print("🔍 TEST 8: DOWNLOAD API VERIFICATION")
        print("=" * 50)
        
        if not self.release_id:
            self.log_test("Release ID available", False, "No release ID")
            return False
            
        try:
            # Test download endpoint
            response = requests.get(
                f"{API_BASE_URL}/api/v1/releases/{self.release_id}/download",
                timeout=30
            )
            
            # Should return 200 or redirect
            success_status = response.status_code in [200, 302, 301]
            self.log_test("Download API responds", success_status, f"Status: {response.status_code}")
            
            if response.status_code == 200:
                # Should return ZIP content
                content_type = response.headers.get('content-type', '')
                is_zip = 'zip' in content_type.lower() or 'octet-stream' in content_type.lower()
                self.log_test("Download returns ZIP content", is_zip, f"Content-Type: {content_type}")
                
                # Should have reasonable size
                content_length = len(response.content)
                reasonable_size = content_length > 1000
                self.log_test("Download has reasonable size", reasonable_size, f"Size: {content_length} bytes")
            
            return True
            
        except Exception as e:
            self.log_test("Download API test", False, f"Error: {e}")
            return False

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 STARTING COMPLETE RELEASE SYSTEM TESTING")
        print("=" * 60)
        print("Testing all 7 critical issues we fixed:")
        print("1. Dataset Confusion - Multi-dataset API")
        print("2. No Augmentation - Real PIL transformations") 
        print("3. Split Logic Destruction - Proper train/val/test")
        print("4. Fake Label Coordinates - Real database annotations")
        print("5. Missing data.yaml - Complete YOLO format")
        print("6. Wrong Image Counts - Accurate calculation")
        print("7. Architecture Issue - Proper file organization")
        print("=" * 60)
        print()
        
        # Run all tests
        tests = [
            self.check_database_state,
            self.test_api_create_release,
            self.test_database_storage,
            self.test_file_system_structure,
            self.test_yolo_format_compliance,
            self.test_image_transformations,
            self.test_zip_file_creation,
            self.test_download_api
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(f"Test {test.__name__}", False, f"Exception: {e}")
            print("-" * 50)
        
        # Summary
        print("🎯 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        print()
        
        if failed > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("🎉 ALL TESTS PASSED! Release system is working perfectly!")
        
        return failed == 0

if __name__ == "__main__":
    tester = ReleaseSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)