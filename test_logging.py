#!/usr/bin/env python3
"""
Test script to verify logging system works correctly
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append('backend')

# Test the logger
from backend.utils.logger import sya_logger, log_info, log_error, log_warning

def test_logging_system():
    """Test all logging functionality"""
    
    print("🧪 Testing SYA Logging System...")
    print("=" * 50)
    
    # Test basic logging
    log_info("Testing INFO level logging")
    log_warning("Testing WARNING level logging") 
    log_error("Testing ERROR level logging")
    
    # Test API logging
    sya_logger.log_api_request("GET", "/api/test", {"param": "value"})
    sya_logger.log_api_response("GET", "/api/test", 200, {"result": "success"}, 0.123)
    
    # Test database logging
    sya_logger.log_database_operation("SELECT", "users", None, "Found 5 records")
    
    # Test transformation logging
    sya_logger.log_transformation_operation("CREATE", "trans_001", "PENDING", {"type": "resize"})
    
    # Test error logging
    try:
        raise ValueError("Test error for logging")
    except Exception as e:
        sya_logger.log_error(e, {"context": "test_error"})
    
    print("\n✅ Logging test completed!")
    print("\n📁 Checking log files...")
    
    logs_dir = Path("logs")
    if logs_dir.exists():
        print(f"✅ Logs directory exists: {logs_dir.absolute()}")
        
        log_files = list(logs_dir.glob("*.log"))
        print(f"📄 Found {len(log_files)} log files:")
        
        for log_file in log_files:
            size = log_file.stat().st_size
            print(f"  - {log_file.name}: {size} bytes")
            
            # Show last few lines
            if size > 0:
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        print(f"    Last entry: {lines[-1].strip()}")
    else:
        print("❌ Logs directory not found!")
    
    return True

if __name__ == "__main__":
    test_logging_system()