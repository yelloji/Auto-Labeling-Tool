"""
Version Generator Utility
Handles generation of version identifiers for releases and transformations
"""

import datetime
import uuid
import re
from typing import Optional


def generate_version_id(prefix: str = "version", include_timestamp: bool = True) -> str:
    """
    Generate a unique version identifier with optional timestamp
    
    Args:
        prefix: String prefix for the version (e.g., "version", "transform")
        include_timestamp: Whether to include timestamp in the version
        
    Returns:
        A unique version string like "version_auto_2025_07_04_15_42_uuid"
    """
    # Generate UUID part (short version)
    uuid_part = str(uuid.uuid4())[:8]
    
    if include_timestamp:
        # Get current timestamp in format YYYY_MM_DD_HH_MM
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y_%m_%d_%H_%M")
        return f"{prefix}_auto_{timestamp}_{uuid_part}"
    else:
        return f"{prefix}_auto_{uuid_part}"


def generate_transformation_version() -> str:
    """
    Generate a version ID specifically for image transformations
    
    Returns:
        A transformation version string
    """
    return generate_version_id(prefix="transform")


def generate_release_version() -> str:
    """
    Generate a version ID specifically for releases
    
    Returns:
        A release version string
    """
    return generate_version_id(prefix="release")


def is_temporary_version(version: str) -> bool:
    """
    Check if a version ID is a temporary/draft version
    
    Args:
        version: The version string to check
        
    Returns:
        True if it's a temporary version, False otherwise
    """
    # Temporary versions have "transform_auto_" prefix
    return version.startswith("transform_auto_")


def extract_timestamp_from_version(version: str) -> Optional[datetime.datetime]:
    """
    Extract the timestamp from a version string
    
    Args:
        version: The version string
        
    Returns:
        Datetime object or None if no timestamp found
    """
    # Match pattern like "prefix_auto_2025_07_04_15_42_uuid"
    pattern = r'.*_auto_(\d{4}_\d{2}_\d{2}_\d{2}_\d{2}).*'
    match = re.match(pattern, version)
    
    if match:
        timestamp_str = match.group(1)
        try:
            return datetime.datetime.strptime(timestamp_str, "%Y_%m_%d_%H_%M")
        except ValueError:
            return None
    
    return None


def get_version_age_minutes(version: str) -> Optional[int]:
    """
    Get the age of a version in minutes
    
    Args:
        version: The version string
        
    Returns:
        Age in minutes or None if timestamp can't be extracted
    """
    timestamp = extract_timestamp_from_version(version)
    if timestamp:
        now = datetime.datetime.now()
        delta = now - timestamp
        return int(delta.total_seconds() / 60)
    
    return None