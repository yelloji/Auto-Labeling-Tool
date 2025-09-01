"""
Cross-platform path utilities for Auto-Labeling-Tool
Ensures 100% compatibility across Windows, macOS, and Linux
"""

import os
from pathlib import Path
from typing import Union, Optional
from core.config import settings
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()


class PathManager:
    """Manages file paths in a cross-platform way"""
    
    @staticmethod
    def normalize_path(path: Union[str, Path]) -> str:
        """
        Normalize path to be cross-platform compatible.
        If the incoming path already references the projects folder ("projects/"),
        we skip further manipulation to preserve integrity.
        Always returns forward slashes.
        """
        logger.info("operations.operations", f"Starting path normalization", "normalize_path", {"input_path": str(path)})

        # Fast-exit guard for already-relative project paths
        path_str = str(path) if path is not None else ""
        if PathManager.is_relative_project_path(path_str):
            safeguarded = path_str.replace('\\', '/')
            logger.info("operations.operations", "Path already relative to project scope; skipping conversion", "normalize_path", {"input_path": path_str, "safeguarded": safeguarded})
            return safeguarded
        
        if not path:
            logger.warning("operations.operations", "Empty path provided for normalization", "normalize_path", {"input_path": str(path)})
            return ""
        
        try:
            # Convert to Path object for normalization
            path_obj = Path(path)
            
            # If it's an absolute path, make it relative to BASE_DIR
            if path_obj.is_absolute():
                try:
                    path_obj = path_obj.relative_to(settings.BASE_DIR)
                    logger.info("operations.operations", "Converted absolute path to relative", "normalize_path", {"original_path": str(path), "relative_path": str(path_obj)})
                except ValueError:
                    # If path is not under BASE_DIR, just use the filename
                    path_obj = Path(path_obj.name)
                    logger.warning("operations.operations", "Path not under BASE_DIR, using filename only", "normalize_path", {"original_path": str(path), "filename": path_obj.name})
            
            # Convert to string with forward slashes (cross-platform)
            normalized = str(path_obj).replace('\\', '/')
            
            # Remove any leading ../ or ./ 
            while normalized.startswith('../') or normalized.startswith('./'):
                if normalized.startswith('../'):
                    normalized = normalized[3:]
                elif normalized.startswith('./'):
                    normalized = normalized[2:]
            
            logger.info("operations.operations", "Path normalization completed successfully", "normalize_path", {"input_path": str(path), "normalized_path": normalized})
            return normalized
            
        except Exception as e:
            logger.error("errors.system", f"Error during path normalization", "normalize_path", {"input_path": str(path), "error": str(e)})
            return str(path) if path else ""
    
    # ------------------------------------------------------------------
    # Helper to detect valid relative project paths
    # ------------------------------------------------------------------
    @staticmethod
    def is_relative_project_path(path: str) -> bool:
        """Return True if path already begins with 'projects/'."""
        if not path:
            return False
        normalized = path.replace('\\', '/').lstrip('/')
        return normalized.startswith('projects/')

    # ------------------------------------------------------------------
    # Ensure any input path becomes a clean projects-relative path
    # ------------------------------------------------------------------
    @staticmethod
    def get_project_relative_path(input_path: Union[str, Path]) -> str:
        """Return a normalized relative path that always begins with ``projects/``.
        If ``input_path`` is absolute, it is first trimmed relative to ``settings.BASE_DIR``.
        If it does not already start with ``projects/``, the function prepends it.
        Always returns forward-slash style paths.
        """
        if not input_path:
            return "projects/unknown"

        # Fast path: already correct
        if PathManager.is_relative_project_path(str(input_path)):
            return PathManager.normalize_path(str(input_path))

        # Work with Path object for safety
        try:
            p_obj = Path(input_path)
            if p_obj.is_absolute():
                try:
                    p_obj = p_obj.relative_to(settings.BASE_DIR)
                except ValueError:
                    # Not under BASE_DIR – just take filename
                    p_obj = Path(p_obj.name)
            # Ensure prefix
            normalized = str(p_obj).replace('\\', '/').lstrip('/')
            if not normalized.startswith('projects/'):
                normalized = f"projects/{normalized}"
            return PathManager.normalize_path(normalized)
        except Exception:
            # Fallback – at least guarantee prefix
            safe_path = str(input_path).replace('\\', '/').lstrip('/')
            if not safe_path.startswith('projects/'):
                safe_path = f"projects/{safe_path}"
            return safe_path

    @staticmethod
    def get_absolute_path(relative_path: str) -> Path:
        """
        Convert relative path to absolute path based on project root
        """
        logger.info("operations.operations", f"Converting relative path to absolute", "get_absolute_path", {"relative_path": relative_path})
        
        if not relative_path:
            logger.warning("operations.operations", "Empty relative path provided, returning BASE_DIR", "get_absolute_path", {"relative_path": relative_path})
            return settings.BASE_DIR
        
        try:
            # Normalize the path first
            normalized = PathManager.normalize_path(relative_path)
            
            # Create absolute path from BASE_DIR
            absolute_path = settings.BASE_DIR / normalized
            
            logger.info("operations.operations", "Absolute path conversion completed", "get_absolute_path", {"relative_path": relative_path, "absolute_path": str(absolute_path)})
            return absolute_path
            
        except Exception as e:
            logger.error("errors.system", f"Error converting to absolute path", "get_absolute_path", {"relative_path": relative_path, "error": str(e)})
            return settings.BASE_DIR
    
    @staticmethod
    def get_image_storage_path(project_name: str, dataset_name: str, split_section: str = "unassigned", split_type: str = None) -> Path:
        """
        Get the standard storage path for images
        Format: projects/{project_name}/{split_section}/{dataset_name}/
        Where split_section is one of: "unassigned", "annotating", "dataset"
        If split_section is "dataset", split_type can be one of: "train", "test", "validation"
        """
        logger.info("operations.operations", f"Generating image storage path", "get_image_storage_path", {
            "project_name": project_name, 
            "dataset_name": dataset_name, 
            "split_section": split_section, 
            "split_type": split_type
        })
        
        try:
            # Sanitize names to be filesystem-safe
            safe_project = PathManager.sanitize_filename(project_name)
            safe_dataset = PathManager.sanitize_filename(dataset_name)
            safe_split_section = PathManager.sanitize_filename(split_section)
            
            if split_section == "dataset" and split_type:
                safe_split_type = PathManager.sanitize_filename(split_type)
                storage_path = settings.PROJECTS_DIR / safe_project / safe_split_section / safe_dataset / safe_split_type
                logger.info("operations.operations", "Generated dataset storage path with split type", "get_image_storage_path", {
                    "storage_path": str(storage_path),
                    "sanitized_project": safe_project,
                    "sanitized_dataset": safe_dataset,
                    "sanitized_split_section": safe_split_section,
                    "sanitized_split_type": safe_split_type
                })
            else:
                storage_path = settings.PROJECTS_DIR / safe_project / safe_split_section / safe_dataset
                logger.info("operations.operations", "Generated standard storage path", "get_image_storage_path", {
                    "storage_path": str(storage_path),
                    "sanitized_project": safe_project,
                    "sanitized_dataset": safe_dataset,
                    "sanitized_split_section": safe_split_section
                })
            
            return storage_path
            
        except Exception as e:
            logger.error("errors.system", f"Error generating image storage path", "get_image_storage_path", {
                "project_name": project_name,
                "dataset_name": dataset_name,
                "split_section": split_section,
                "split_type": split_type,
                "error": str(e)
            })
            # Return a fallback path
            return settings.PROJECTS_DIR / "fallback" / "unassigned" / "fallback"
    
    @staticmethod
    def get_relative_image_path(project_name: str, dataset_name: str, filename: str, split_section: str = "unassigned", split_type: str = None) -> str:
        """
        Get relative path for storing in database
        Returns: projects/{project_name}/{split_section}/{dataset_name}/{filename}
        Where split_section is one of: "unassigned", "annotating", "dataset"
        If split_section is "dataset", split_type can be one of: "train", "test", "validation"
        """
        logger.info("operations.operations", f"Generating relative image path", "get_relative_image_path", {
            "project_name": project_name,
            "dataset_name": dataset_name,
            "filename": filename,
            "split_section": split_section,
            "split_type": split_type
        })
        
        try:
            storage_path = PathManager.get_image_storage_path(project_name, dataset_name, split_section, split_type)
            full_path = storage_path / filename
            
            # Return path relative to BASE_DIR
            relative_path = full_path.relative_to(settings.BASE_DIR)
            normalized_relative = str(relative_path).replace('\\', '/')
            
            logger.info("operations.operations", "Relative image path generated successfully", "get_relative_image_path", {
                "relative_path": normalized_relative,
                "full_path": str(full_path)
            })
            return normalized_relative
            
        except Exception as e:
            logger.error("errors.system", f"Error generating relative image path", "get_relative_image_path", {
                "project_name": project_name,
                "dataset_name": dataset_name,
                "filename": filename,
                "split_section": split_section,
                "split_type": split_type,
                "error": str(e)
            })
            return f"projects/{project_name}/{split_section}/{dataset_name}/{filename}"
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to be safe across all operating systems
        """
        logger.info("operations.operations", f"Sanitizing filename", "sanitize_filename", {"original_filename": filename})
        
        if not filename:
            logger.warning("operations.operations", "Empty filename provided, using default", "sanitize_filename", {"original_filename": filename})
            return "unnamed"
        
        try:
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
                logger.warning("operations.operations", "Filename became empty after sanitization, using default", "sanitize_filename", {"original_filename": filename})
            
            logger.info("operations.operations", "Filename sanitization completed", "sanitize_filename", {"original_filename": filename, "sanitized_filename": sanitized})
            return sanitized
            
        except Exception as e:
            logger.error("errors.system", f"Error sanitizing filename", "sanitize_filename", {"original_filename": filename, "error": str(e)})
            return "unnamed"
    
    @staticmethod
    def ensure_directory_exists(path: Union[str, Path]) -> Path:
        """
        Ensure directory exists, create if it doesn't
        Returns the Path object
        """
        logger.info("operations.operations", f"Ensuring directory exists", "ensure_directory_exists", {"path": str(path)})
        
        try:
            path_obj = Path(path)
            
            if path_obj.exists():
                logger.info("operations.operations", "Directory already exists", "ensure_directory_exists", {"path": str(path_obj)})
            else:
                path_obj.mkdir(parents=True, exist_ok=True)
                logger.info("operations.operations", "Directory created successfully", "ensure_directory_exists", {"path": str(path_obj)})
            
            return path_obj
            
        except Exception as e:
            logger.error("errors.system", f"Error ensuring directory exists", "ensure_directory_exists", {"path": str(path), "error": str(e)})
            raise
    
    @staticmethod
    def get_web_url(relative_path: str) -> str:
        """
        Convert relative file path to web URL for serving
        """
        logger.info("operations.operations", f"Converting path to web URL", "get_web_url", {"relative_path": relative_path})
        
        if not relative_path:
            logger.warning("operations.operations", "Empty relative path provided for web URL", "get_web_url", {"relative_path": relative_path})
            return ""
        
        try:
            # Normalize path and ensure forward slashes
            normalized = PathManager.get_project_relative_path(relative_path)
            
            # If it already starts with 'projects/', use it directly
            if normalized.startswith('projects/') or normalized.startswith('uploads/'):
                web_url = f"/{normalized}"
                logger.info("operations.operations", "Generated web URL with direct path", "get_web_url", {"relative_path": relative_path, "web_url": web_url})
                return web_url
            
            # Otherwise, assume it's in projects/
            web_url = f"/projects/{normalized}"
            logger.info("operations.operations", "Generated web URL with projects prefix", "get_web_url", {"relative_path": relative_path, "web_url": web_url})
            return web_url
            
        except Exception as e:
            logger.error("errors.system", f"Error converting to web URL", "get_web_url", {"relative_path": relative_path, "error": str(e)})
            return f"/{relative_path}" if relative_path else ""
    
    @staticmethod
    def file_exists(relative_path: str) -> bool:
        """
        Check if file exists using relative path
        """
        logger.info("operations.operations", f"Checking file existence", "file_exists", {"relative_path": relative_path})
        
        if not relative_path:
            logger.warning("operations.operations", "Empty relative path provided for existence check", "file_exists", {"relative_path": relative_path})
            return False
        
        try:
            project_relative = PathManager.get_project_relative_path(relative_path)
            absolute_path = PathManager.get_absolute_path(project_relative)
            exists = absolute_path.exists()
            
            logger.info("operations.operations", "File existence check completed", "file_exists", {
                "relative_path": relative_path,
                "absolute_path": str(absolute_path),
                "exists": exists
            })
            return exists
            
        except Exception as e:
            logger.error("errors.system", f"Error checking file existence", "file_exists", {"relative_path": relative_path, "error": str(e)})
            return False
    
    @staticmethod
    def migrate_old_path(old_path: str) -> Optional[str]:
        """
        Migrate old-style paths to new normalized format
        Handles paths like: ..\\uploads\\projects\\today\\unassigned\\bread_dataset\\bread_dataset_347.png
        """
        logger.info("operations.operations", f"Starting old path migration", "migrate_old_path", {"old_path": old_path})
        
        if not old_path:
            logger.warning("operations.operations", "Empty old path provided for migration", "migrate_old_path", {"old_path": old_path})
            return None
        
        try:
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
                                new_path = f"projects/{project_name}/{split_section}/{dataset_name}/{split_type}/{filename}"
                                logger.info("operations.operations", "Migrated uploads path with split type", "migrate_old_path", {
                                    "old_path": old_path,
                                    "new_path": new_path,
                                    "project_name": project_name,
                                    "split_section": split_section,
                                    "dataset_name": dataset_name,
                                    "split_type": split_type,
                                    "filename": filename
                                })
                                return new_path
                            
                            new_path = f"projects/{project_name}/{split_section}/{dataset_name}/{filename}"
                            logger.info("operations.operations", "Migrated uploads path", "migrate_old_path", {
                                "old_path": old_path,
                                "new_path": new_path,
                                "project_name": project_name,
                                "split_section": split_section,
                                "dataset_name": dataset_name,
                                "filename": filename
                            })
                            return new_path
                
                # If it's already in the new format or we can't convert, just use it as is
                relevant_parts = parts[start_index:]
                new_path = Path(*relevant_parts)
                normalized_path = str(new_path).replace('\\', '/')
                logger.info("operations.operations", "Used existing projects path format", "migrate_old_path", {
                    "old_path": old_path,
                    "new_path": normalized_path
                })
                return normalized_path
            
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
                new_path = f"projects/{project_name}/unassigned/{dataset_name}/{filename}"
                logger.info("operations.operations", "Created fallback path from filename", "migrate_old_path", {
                    "old_path": old_path,
                    "new_path": new_path,
                    "project_name": project_name,
                    "dataset_name": dataset_name,
                    "filename": filename
                })
                return new_path
            
            logger.warning("operations.operations", "Could not migrate old path, returning None", "migrate_old_path", {"old_path": old_path})
            return None
            
        except Exception as e:
            logger.error("errors.system", f"Error during old path migration", "migrate_old_path", {"old_path": old_path, "error": str(e)})
            return None


# Global instance
path_manager = PathManager()