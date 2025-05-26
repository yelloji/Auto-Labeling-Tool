"""
File upload and processing utilities
Handles image uploads, validation, and storage
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


class FileHandler:
    """Handle file uploads and processing"""
    
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    def __init__(self):
        # Ensure upload directory exists
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
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
    
    def generate_unique_filename(self, original_filename: str) -> str:
        """Generate unique filename while preserving extension"""
        file_ext = Path(original_filename).suffix.lower()
        unique_id = str(uuid.uuid4())
        return f"{unique_id}{file_ext}"
    
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
        dataset_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Save uploaded file and return file path and metadata
        Returns: (file_path, image_info)
        """
        if not self.validate_image_file(file):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
            )
        
        # Generate unique filename
        unique_filename = self.generate_unique_filename(file.filename)
        
        # Create dataset directory
        dataset_dir = Path(settings.UPLOAD_DIR) / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file
        file_path = dataset_dir / unique_filename
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Get image metadata
            image_info = self.get_image_info(str(file_path))
            
            return str(file_path), image_info
            
        except Exception as e:
            # Clean up file if something went wrong
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    async def upload_images_to_dataset(
        self,
        files: List[UploadFile],
        dataset_id: str,
        auto_label: bool = True
    ) -> Dict[str, Any]:
        """
        Upload multiple images to a dataset
        Returns upload results and statistics
        """
        db = SessionLocal()
        
        try:
            # Verify dataset exists
            dataset = DatasetOperations.get_dataset(db, dataset_id)
            if not dataset:
                raise HTTPException(status_code=404, detail="Dataset not found")
            
            results = {
                'total_files': len(files),
                'successful_uploads': 0,
                'failed_uploads': 0,
                'uploaded_images': [],
                'errors': []
            }
            
            for file in files:
                try:
                    # Save file
                    file_path, image_info = await self.save_uploaded_file(file, dataset_id)
                    
                    # Create database record
                    image_record = ImageOperations.create_image(
                        db=db,
                        filename=Path(file_path).name,
                        original_filename=file.filename,
                        file_path=file_path,
                        dataset_id=dataset_id,
                        width=image_info['width'],
                        height=image_info['height'],
                        file_size=image_info['file_size'],
                        format=image_info['format']
                    )
                    
                    results['uploaded_images'].append({
                        'id': image_record.id,
                        'filename': image_record.filename,
                        'original_filename': image_record.original_filename,
                        'width': image_record.width,
                        'height': image_record.height,
                        'file_size': image_record.file_size
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
        """Get URL for serving an image"""
        db = SessionLocal()
        try:
            image = ImageOperations.get_image(db, image_id)
            if image and os.path.exists(image.file_path):
                # Return relative path for serving via FastAPI static files
                relative_path = os.path.relpath(image.file_path, settings.UPLOAD_DIR)
                return f"/uploads/{relative_path}"
            return None
        finally:
            db.close()
    
    def cleanup_dataset_files(self, dataset_id: str) -> bool:
        """Delete all files for a dataset"""
        try:
            dataset_dir = Path(settings.UPLOAD_DIR) / dataset_id
            if dataset_dir.exists():
                shutil.rmtree(dataset_dir)
                return True
            return False
        except Exception as e:
            print(f"Error cleaning up dataset {dataset_id}: {e}")
            return False


# Global file handler instance
file_handler = FileHandler()