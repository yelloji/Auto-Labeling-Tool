"""
File upload and processing utilities
Handles image uploads, validation, and storage with cross-platform compatibility
"""

import os
import uuid
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image
import cv2
from fastapi import UploadFile, HTTPException

from core.config import settings
from database.operations import ImageOperations, DatasetOperations
from database.database import SessionLocal
from utils.path_utils import path_manager


class FileHandler:
    """Handle file uploads and processing"""
    
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    def __init__(self):
        # Ensure projects directory exists
        os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
    
    def validate_image_file(self, file: UploadFile) -> bool:
        """Validate uploaded image file"""
        # Check file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in self.ALLOWED_EXTENSIONS:
            return False
        
        # Check file size (if available)
        if hasattr(file, 'size') and file.size > self.MAX_FILE_SIZE:
            return False
        
        return True
    
    def extract_clean_filename(self, filename: str) -> str:
        """
        Extract clean filename without any project/dataset prefixes
        Handles cases like: 'projectname*imagename.jpg' -> 'imagename.jpg'
        """
        if not filename:
            return "unnamed.jpg"
        
        # Remove any path components first
        clean_name = Path(filename).name
        
        # Check for project prefix patterns like 'projectname*filename'
        if '*' in clean_name:
            # Split by asterisk and take the last part (the actual filename)
            parts = clean_name.split('*')
            clean_name = parts[-1]  # Take the last part after the asterisk
        
        # Check for other common separators that might indicate prefixes
        for separator in ['_', '-']:
            if separator in clean_name:
                # Only remove prefix if it looks like a project/dataset prefix
                # (contains no file extension in the first part)
                parts = clean_name.split(separator, 1)  # Split only on first occurrence
                if len(parts) == 2 and '.' not in parts[0] and '.' in parts[1]:
                    # First part has no extension, second part has extension
                    # This suggests first part might be a prefix
                    clean_name = parts[1]
                    break
        
        # Ensure we have a valid filename
        if not clean_name or clean_name == '.' or clean_name == '..':
            clean_name = "unnamed.jpg"
        
        # Ensure it has an extension
        if '.' not in clean_name:
            clean_name += '.jpg'
        
        return clean_name

    def generate_unique_filename(self, original_filename: str, dataset_dir: Path) -> str:
        """Generate unique filename while preserving original name when possible"""
        # First try to use the original filename
        if not (dataset_dir / original_filename).exists():
            return original_filename
        
        # If original filename exists, add a counter
        file_stem = Path(original_filename).stem
        file_ext = Path(original_filename).suffix.lower()
        counter = 1
        
        while True:
            new_filename = f"{file_stem}_{counter}{file_ext}"
            if not (dataset_dir / new_filename).exists():
                return new_filename
            counter += 1
    
    def get_image_info(self, file_path: str) -> Dict[str, Any]:
        """Extract image metadata"""
        try:
            # Try with PIL first
            with Image.open(file_path) as img:
                width, height = img.size
                format_name = img.format.lower() if img.format else 'unknown'
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            return {
                'width': width,
                'height': height,
                'format': format_name,
                'file_size': file_size
            }
        except Exception as e:
            print(f"Error getting image info for {file_path}: {e}")
            return {
                'width': None,
                'height': None,
                'format': 'unknown',
                'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0
            }
    
    async def save_uploaded_file(
        self, 
        file: UploadFile, 
        dataset_id: str,
        project_name: str = None,
        dataset_name: str = None,
        split_type: str = "unassigned"
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Save uploaded file and return relative file path and metadata
        Returns: (relative_file_path, image_info)
        """
        if not self.validate_image_file(file):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
            )
        
        # Use standardized path management
        if not project_name or not dataset_name:
            # Fallback: create default names
            project_name = project_name or f"Project_{dataset_id[:8]}"
            dataset_name = dataset_name or f"Dataset_{dataset_id[:8]}"
        
        # Get standardized storage directory
        storage_dir = path_manager.get_image_storage_path(project_name, dataset_name, split_type)
        path_manager.ensure_directory_exists(storage_dir)
        
        # Generate unique filename (preserving original when possible)
        # Extract clean filename without any project/dataset prefixes
        clean_filename = self.extract_clean_filename(file.filename)
        unique_filename = self.generate_unique_filename(clean_filename, storage_dir)
        
        # Save file
        file_path = storage_dir / unique_filename
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Get image metadata
            image_info = self.get_image_info(str(file_path))
            
            # Return relative path for database storage
            relative_path = path_manager.get_relative_image_path(
                project_name, dataset_name, unique_filename, split_type
            )
            
            return relative_path, image_info
            
        except Exception as e:
            # Clean up file if something went wrong
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    async def upload_images_to_dataset(
        self,
        files: List[UploadFile],
        dataset_id: str,
        auto_label: bool = True,
        project_name: str = None,
        dataset_name: str = None,
        split_type: str = "unassigned"
    ) -> Dict[str, Any]:
        """
        Upload multiple images to a dataset with standardized path management
        Returns upload results and statistics
        """
        db = SessionLocal()
        
        try:
            # Verify dataset exists
            dataset = DatasetOperations.get_dataset(db, dataset_id)
            if not dataset:
                raise HTTPException(status_code=404, detail="Dataset not found")
            
            # Get project info if not provided
            if not project_name:
                project = DatasetOperations.get_project_by_dataset(db, dataset_id)
                project_name = project.name if project else f"Project_{dataset_id[:8]}"
            
            if not dataset_name:
                dataset_name = dataset.name
            
            results = {
                'total_files': len(files),
                'successful_uploads': 0,
                'failed_uploads': 0,
                'uploaded_images': [],
                'errors': []
            }
            
            for file in files:
                try:
                    # Save file with standardized path
                    relative_path, image_info = await self.save_uploaded_file(
                        file, dataset_id, project_name, dataset_name, split_type
                    )
                    
                    # Create database record with relative path
                    # Extract clean filename without any project/dataset prefixes
                    clean_filename = self.extract_clean_filename(file.filename)
                    
                    image_record = ImageOperations.create_image(
                        db=db,
                        filename=clean_filename,  # Use clean filename without prefixes
                        original_filename=clean_filename,  # Store clean original filename
                        file_path=relative_path,  # Store relative path
                        dataset_id=dataset_id,
                        width=image_info['width'],
                        height=image_info['height'],
                        file_size=image_info['file_size'],
                        format=image_info['format'],
                        split_type=split_type
                    )
                    
                    results['uploaded_images'].append({
                        'id': image_record.id,
                        'filename': image_record.filename,
                        'original_filename': image_record.original_filename,
                        'width': image_record.width,
                        'height': image_record.height,
                        'file_size': image_record.file_size,
                        'split_type': image_record.split_type
                    })
                    
                    results['successful_uploads'] += 1
                    
                except Exception as e:
                    error_msg = f"Failed to upload {file.filename}: {str(e)}"
                    results['errors'].append(error_msg)
                    results['failed_uploads'] += 1
                    print(error_msg)
            
            # Update dataset statistics
            DatasetOperations.update_dataset_stats(db, dataset_id)
            
            return results
            
        finally:
            db.close()
    
    def delete_image_file(self, file_path: str) -> bool:
        """Delete image file from filesystem"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")
            return False
    
    def get_image_url(self, image_id: str) -> Optional[str]:
        """Get URL for serving an image with cross-platform path handling"""
        db = SessionLocal()
        try:
            image = ImageOperations.get_image(db, image_id)
            if image and image.file_path:
                # Check if file exists using path manager
                if path_manager.file_exists(image.file_path):
                    # Return web URL using path manager
                    return path_manager.get_web_url(image.file_path)
                else:
                    # Try to migrate old path format
                    migrated_path = path_manager.migrate_old_path(image.file_path)
                    if migrated_path and path_manager.file_exists(migrated_path):
                        # Update database with new path
                        ImageOperations.update_image_path(db, image_id, migrated_path)
                        return path_manager.get_web_url(migrated_path)
            return None
        finally:
            db.close()
    
    def rename_dataset_folder(self, project_name: str, old_dataset_name: str, new_dataset_name: str) -> bool:
        """Rename dataset folder when dataset name is updated"""
        try:
            old_path = Path(settings.PROJECTS_DIR) / project_name / old_dataset_name
            new_path = Path(settings.PROJECTS_DIR) / project_name / new_dataset_name
            
            # Check if old folder exists
            if not old_path.exists():
                print(f"Old dataset folder does not exist: {old_path}")
                return True  # Return True since there's nothing to rename
            
            # Check if new folder already exists
            if new_path.exists():
                print(f"New dataset folder already exists: {new_path}")
                return False
            
            # Rename the folder
            old_path.rename(new_path)
            print(f"Renamed dataset folder from {old_path} to {new_path}")
            return True
            
        except Exception as e:
            print(f"Error renaming dataset folder from {old_dataset_name} to {new_dataset_name}: {e}")
            return False
    
    def cleanup_dataset_files_by_path(self, project_name: str, dataset_name: str) -> bool:
        """Delete dataset folder using project and dataset names"""
        try:
            dataset_dir = Path(settings.PROJECTS_DIR) / project_name / dataset_name
            if dataset_dir.exists():
                shutil.rmtree(dataset_dir)
                print(f"Deleted dataset folder: {dataset_dir}")
                return True
            else:
                print(f"Dataset folder not found: {dataset_dir}")
                return True  # Return True since there's nothing to clean up
        except Exception as e:
            print(f"Error cleaning up dataset folder {project_name}/{dataset_name}: {e}")
            return False

    def cleanup_dataset_files(self, dataset_id: str) -> bool:
        """Delete all files for a dataset (legacy method for dataset_id-based folders)"""
        try:
            dataset_dir = Path(settings.PROJECTS_DIR) / dataset_id
            if dataset_dir.exists():
                shutil.rmtree(dataset_dir)
                print(f"Deleted dataset folder: {dataset_dir}")
                return True
            else:
                print(f"Dataset folder not found: {dataset_dir}")
                return True  # Return True since there's nothing to clean up
        except Exception as e:
            print(f"Error cleaning up dataset {dataset_id}: {e}")
            return False


# Global file handler instance
file_handler = FileHandler()