"""
Cross-platform path utilities for Auto-Labeling-Tool
Ensures 100% compatibility across Windows, macOS, and Linux
"""

import os
from pathlib import Path
from typing import Union, Optional
from core.config import settings


class PathManager:
    """Manages file paths in a cross-platform way"""
    
    @staticmethod
    def normalize_path(path: Union[str, Path]) -> str:
        """
        Normalize path to be cross-platform compatible
        Always returns forward slashes and relative to project root
        """
        if not path:
            return ""
        
        # Convert to Path object for normalization
        path_obj = Path(path)
        
        # If it's an absolute path, make it relative to BASE_DIR
        if path_obj.is_absolute():
            try:
                path_obj = path_obj.relative_to(settings.BASE_DIR)
            except ValueError:
                # If path is not under BASE_DIR, just use the filename
                path_obj = Path(path_obj.name)
        
        # Convert to string with forward slashes (cross-platform)
        normalized = str(path_obj).replace('\\', '/')
        
        # Remove any leading ../ or ./ 
        while normalized.startswith('../') or normalized.startswith('./'):
            if normalized.startswith('../'):
                normalized = normalized[3:]
            elif normalized.startswith('./'):
                normalized = normalized[2:]
        
        return normalized
    
    @staticmethod
    def get_absolute_path(relative_path: str) -> Path:
        """
        Convert relative path to absolute path based on project root
        """
        if not relative_path:
            return settings.BASE_DIR
        
        # Normalize the path first
        normalized = PathManager.normalize_path(relative_path)
        
        # Create absolute path from BASE_DIR
        return settings.BASE_DIR / normalized
    
    @staticmethod
    def get_image_storage_path(project_name: str, dataset_name: str, split_section: str = "unassigned", split_type: str = None) -> Path:
        """
        Get the standard storage path for images
        Format: projects/{project_name}/{split_section}/{dataset_name}/
        Where split_section is one of: "unassigned", "annotating", "dataset"
        If split_section is "dataset", split_type can be one of: "train", "test", "validation"
        """
        # Sanitize names to be filesystem-safe
        safe_project = PathManager.sanitize_filename(project_name)
        safe_dataset = PathManager.sanitize_filename(dataset_name)
        safe_split_section = PathManager.sanitize_filename(split_section)
        
        if split_section == "dataset" and split_type:
            safe_split_type = PathManager.sanitize_filename(split_type)
            return settings.PROJECTS_DIR / safe_project / safe_split_section / safe_dataset / safe_split_type
        
        return settings.PROJECTS_DIR / safe_project / safe_split_section / safe_dataset
    
    @staticmethod
    def get_relative_image_path(project_name: str, dataset_name: str, filename: str, split_section: str = "unassigned", split_type: str = None) -> str:
        """
        Get relative path for storing in database
        Returns: projects/{project_name}/{split_section}/{dataset_name}/{filename}
        Where split_section is one of: "unassigned", "annotating", "dataset"
        If split_section is "dataset", split_type can be one of: "train", "test", "validation"
        """
        storage_path = PathManager.get_image_storage_path(project_name, dataset_name, split_section, split_type)
        full_path = storage_path / filename
        
        # Return path relative to BASE_DIR
        relative_path = full_path.relative_to(settings.BASE_DIR)
        return str(relative_path).replace('\\', '/')
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to be safe across all operating systems
        """
        if not filename:
            return "unnamed"
        
        # Replace problematic characters
        invalid_chars = '<>:"/\\|?*'
        sanitized = filename
        for char in invalid_chars:
            sanitized = sanitized.replace(char, '_')
        
        # Remove leading/trailing spaces and dots
        sanitized = sanitized.strip(' .')
        
        # Ensure it's not empty
        if not sanitized:
            sanitized = "unnamed"
        
        return sanitized
    
    @staticmethod
    def ensure_directory_exists(path: Union[str, Path]) -> Path:
        """
        Ensure directory exists, create if it doesn't
        Returns the Path object
        """
        path_obj = Path(path)
        path_obj.mkdir(parents=True, exist_ok=True)
        return path_obj
    
    @staticmethod
    def get_web_url(relative_path: str) -> str:
        """
        Convert relative file path to web URL for serving
        """
        if not relative_path:
            return ""
        
        # Normalize path and ensure forward slashes
        normalized = PathManager.normalize_path(relative_path)
        
        # If it starts with projects/ or uploads/, use it directly
        if normalized.startswith('projects/') or normalized.startswith('uploads/'):
            return f"/{normalized}"
        
        # Otherwise, assume it's in projects/
        return f"/projects/{normalized}"
    
    @staticmethod
    def file_exists(relative_path: str) -> bool:
        """
        Check if file exists using relative path
        """
        if not relative_path:
            return False
        
        absolute_path = PathManager.get_absolute_path(relative_path)
        return absolute_path.exists()
    
    @staticmethod
    def migrate_old_path(old_path: str) -> Optional[str]:
        """
        Migrate old-style paths to new normalized format
        Handles paths like: ..\\uploads\\projects\\today\\unassigned\\bread_dataset\\bread_dataset_347.png
        """
        if not old_path:
            return None
        
        # Convert to Path for easier manipulation
        path_obj = Path(old_path)
        
        # Extract meaningful parts from the path
        parts = path_obj.parts
        
        # Look for 'projects' or 'uploads' in the path
        start_index = -1
        for i, part in enumerate(parts):
            if part in ['projects', 'uploads']:
                start_index = i
                break
        
        if start_index >= 0:
            # If it's an old path with 'uploads', convert to new format
            if parts[start_index] == 'uploads' and len(parts) > start_index + 2:
                if parts[start_index + 1] == 'projects':
                    # Format: uploads/projects/project_name/split_section/dataset_name/filename
                    if len(parts) > start_index + 4:
                        project_name = parts[start_index + 2]
                        split_section = parts[start_index + 3]
                        dataset_name = parts[start_index + 4]
                        filename = path_obj.name
                        
                        # Check if there's a split_type (train/test/validation)
                        if split_section == "dataset" and len(parts) > start_index + 5:
                            split_type = parts[start_index + 5]
                            return f"projects/{project_name}/{split_section}/{dataset_name}/{split_type}/{filename}"
                        
                        return f"projects/{project_name}/{split_section}/{dataset_name}/{filename}"
            
            # If it's already in the new format or we can't convert, just use it as is
            relevant_parts = parts[start_index:]
            new_path = Path(*relevant_parts)
            return str(new_path).replace('\\', '/')
        
        # If no 'projects' or 'uploads' found, try to extract filename and guess structure
        filename = path_obj.name
        if filename:
            # Try to find project and dataset info from path
            project_name = "Unknown_Project"
            dataset_name = "Unknown_Dataset"
            
            # Look for common patterns
            for i, part in enumerate(parts):
                if part in ['projects', 'today', 'annotating', 'unassigned', 'dataset']:
                    if i + 1 < len(parts):
                        if part == 'projects' and i + 1 < len(parts):
                            project_name = parts[i + 1]
                        elif part in ['annotating', 'unassigned', 'dataset'] and i + 1 < len(parts):
                            dataset_name = parts[i + 1]
            
            # Create new standardized path
            return f"projects/{project_name}/unassigned/{dataset_name}/{filename}"
        
        return None


# Global instance
path_manager = PathManager()