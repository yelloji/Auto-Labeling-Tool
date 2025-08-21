"""
Version Generator Utility
Handles generation of version identifiers for releases and transformations
"""

import datetime
import uuid
import re
from typing import Optional
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()


def generate_version_id(prefix: str = "version", include_timestamp: bool = True) -> str:
    """
    Generate a unique version identifier with optional timestamp
    
    Args:
        prefix: String prefix for the version (e.g., "version", "transform")
        include_timestamp: Whether to include timestamp in the version
        
    Returns:
        A unique version string like "version_auto_2025_07_04_15_42_uuid"
    """
    logger.info("operations.releases", f"Starting version ID generation", "generate_version_id", {
        "prefix": prefix,
        "include_timestamp": include_timestamp
    })
    
    try:
        # Generate UUID part (short version)
        uuid_part = str(uuid.uuid4())[:8]
        
        if include_timestamp:
            # Get current timestamp in format YYYY_MM_DD_HH_MM
            now = datetime.datetime.now()
            timestamp = now.strftime("%Y_%m_%d_%H_%M")
            version_id = f"{prefix}_auto_{timestamp}_{uuid_part}"
            
            logger.info("operations.releases", "Generated version ID with timestamp", "generate_version_id", {
                "prefix": prefix,
                "timestamp": timestamp,
                "uuid_part": uuid_part,
                "version_id": version_id
            })
            return version_id
        else:
            version_id = f"{prefix}_auto_{uuid_part}"
            
            logger.info("operations.releases", "Generated version ID without timestamp", "generate_version_id", {
                "prefix": prefix,
                "uuid_part": uuid_part,
                "version_id": version_id
            })
            return version_id
            
    except Exception as e:
        logger.error("errors.system", f"Error generating version ID", "generate_version_id", {
            "prefix": prefix,
            "include_timestamp": include_timestamp,
            "error": str(e)
        })
        # Fallback to simple timestamp-based version
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y_%m_%d_%H_%M")
        fallback_id = f"{prefix}_auto_{timestamp}"
        logger.warning("operations.releases", "Using fallback version ID", "generate_version_id", {
            "fallback_id": fallback_id
        })
        return fallback_id


def generate_transformation_version() -> str:
    """
    Generate a version ID specifically for image transformations
    
    Returns:
        A transformation version string
    """
    logger.info("operations.releases", "Generating transformation version", "generate_transformation_version", {})
    
    try:
        version_id = generate_version_id(prefix="transform")
        
        logger.info("operations.releases", "Transformation version generated successfully", "generate_transformation_version", {
            "version_id": version_id
        })
        return version_id
        
    except Exception as e:
        logger.error("errors.system", f"Error generating transformation version", "generate_transformation_version", {
            "error": str(e)
        })
        # Fallback
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y_%m_%d_%H_%M")
        fallback_id = f"transform_auto_{timestamp}"
        logger.warning("operations.releases", "Using fallback transformation version", "generate_transformation_version", {
            "fallback_id": fallback_id
        })
        return fallback_id


def generate_release_version() -> str:
    """
    Generate a version ID specifically for releases
    
    Returns:
        A release version string
    """
    logger.info("operations.releases", "Generating release version", "generate_release_version", {})
    
    try:
        version_id = generate_version_id(prefix="release")
        
        logger.info("operations.releases", "Release version generated successfully", "generate_release_version", {
            "version_id": version_id
        })
        return version_id
        
    except Exception as e:
        logger.error("errors.system", f"Error generating release version", "generate_release_version", {
            "error": str(e)
        })
        # Fallback
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y_%m_%d_%H_%M")
        fallback_id = f"release_auto_{timestamp}"
        logger.warning("operations.releases", "Using fallback release version", "generate_release_version", {
            "fallback_id": fallback_id
        })
        return fallback_id


def is_temporary_version(version: str) -> bool:
    """
    Check if a version ID is a temporary/draft version
    
    Args:
        version: The version string to check
        
    Returns:
        True if it's a temporary version, False otherwise
    """
    logger.info("operations.releases", f"Checking if version is temporary", "is_temporary_version", {
        "version": version
    })
    
    try:
        # Temporary versions have "transform_auto_" prefix
        is_temporary = version.startswith("transform_auto_")
        
        logger.info("operations.releases", "Temporary version check completed", "is_temporary_version", {
            "version": version,
            "is_temporary": is_temporary
        })
        return is_temporary
        
    except Exception as e:
        logger.error("errors.system", f"Error checking temporary version", "is_temporary_version", {
            "version": version,
            "error": str(e)
        })
        return False


def extract_timestamp_from_version(version: str) -> Optional[datetime.datetime]:
    """
    Extract the timestamp from a version string
    
    Args:
        version: The version string
        
    Returns:
        Datetime object or None if no timestamp found
    """
    logger.info("operations.releases", f"Extracting timestamp from version", "extract_timestamp_from_version", {
        "version": version
    })
    
    try:
        # Match pattern like "prefix_auto_2025_07_04_15_42_uuid"
        pattern = r'.*_auto_(\d{4}_\d{2}_\d{2}_\d{2}_\d{2}).*'
        match = re.match(pattern, version)
        
        if match:
            timestamp_str = match.group(1)
            try:
                timestamp = datetime.datetime.strptime(timestamp_str, "%Y_%m_%d_%H_%M")
                
                logger.info("operations.releases", "Timestamp extracted successfully", "extract_timestamp_from_version", {
                    "version": version,
                    "timestamp_str": timestamp_str,
                    "timestamp": timestamp.isoformat()
                })
                return timestamp
            except ValueError as ve:
                logger.error("errors.validation", f"Invalid timestamp format in version", "extract_timestamp_from_version", {
                    "version": version,
                    "timestamp_str": timestamp_str,
                    "error": str(ve)
                })
                return None
        else:
            logger.warning("operations.releases", "No timestamp pattern found in version", "extract_timestamp_from_version", {
                "version": version
            })
            return None
            
    except Exception as e:
        logger.error("errors.system", f"Error extracting timestamp from version", "extract_timestamp_from_version", {
            "version": version,
            "error": str(e)
        })
        return None


def get_version_age_minutes(version: str) -> Optional[int]:
    """
    Get the age of a version in minutes
    
    Args:
        version: The version string
        
    Returns:
        Age in minutes or None if timestamp can't be extracted
    """
    logger.info("operations.releases", f"Calculating version age in minutes", "get_version_age_minutes", {
        "version": version
    })
    
    try:
        timestamp = extract_timestamp_from_version(version)
        if timestamp:
            now = datetime.datetime.now()
            delta = now - timestamp
            age_minutes = int(delta.total_seconds() / 60)
            
            logger.info("operations.releases", "Version age calculated successfully", "get_version_age_minutes", {
                "version": version,
                "timestamp": timestamp.isoformat(),
                "age_minutes": age_minutes
            })
            return age_minutes
        else:
            logger.warning("operations.releases", "Could not extract timestamp for age calculation", "get_version_age_minutes", {
                "version": version
            })
            return None
            
    except Exception as e:
        logger.error("errors.system", f"Error calculating version age", "get_version_age_minutes", {
            "version": version,
            "error": str(e)
        })
        return None