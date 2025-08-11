#!/usr/bin/env python3
"""
Debug logging configuration to help troubleshoot local PC logging issues
"""

import os
import sys
from pathlib import Path

def debug_logging_setup():
    print("🔍 DEBUGGING LOGGING CONFIGURATION")
    print("=" * 50)
    
    # Check current working directory
    print(f"📁 Current working directory: {os.getcwd()}")
    
    # Check where the logger.py file is located
    logger_path = Path(__file__).parent / "backend" / "utils" / "logger.py"
    print(f"📄 Logger file location: {logger_path}")
    print(f"📄 Logger file exists: {logger_path.exists()}")
    
    # Calculate where logs should be created
    if logger_path.exists():
        logger_dir = logger_path.parent
        expected_log_dir = logger_dir / ".." / ".." / "logs"
        resolved_log_dir = expected_log_dir.resolve()
        
        print(f"📂 Expected log directory: {expected_log_dir}")
        print(f"📂 Resolved log directory: {resolved_log_dir}")
        print(f"📂 Log directory exists: {resolved_log_dir.exists()}")
        
        # Check permissions
        parent_dir = resolved_log_dir.parent
        print(f"🔐 Parent directory writable: {os.access(parent_dir, os.W_OK)}")
        
        if resolved_log_dir.exists():
            print(f"🔐 Log directory writable: {os.access(resolved_log_dir, os.W_OK)}")
            print(f"📋 Log directory contents:")
            for item in resolved_log_dir.iterdir():
                print(f"   - {item.name} ({item.stat().st_size} bytes)")
        else:
            print("❌ Log directory does not exist - will be created on first log")
    
    # Test logger creation
    print("\n🧪 TESTING LOGGER CREATION")
    print("-" * 30)
    
    try:
        # Add the backend directory to Python path
        backend_path = Path(__file__).parent / "backend"
        sys.path.insert(0, str(backend_path))
        
        from utils.logger import sya_logger, log_info
        
        print("✅ Logger imported successfully")
        print(f"📂 Logger log_dir: {sya_logger.log_dir}")
        print(f"📂 Log directory exists: {os.path.exists(sya_logger.log_dir)}")
        
        # Test logging
        log_info("🧪 TEST LOG MESSAGE - If you see this in logs, logging is working!")
        print("✅ Test log message sent")
        
        # Check if log files were created
        if os.path.exists(sya_logger.log_dir):
            log_files = [f for f in os.listdir(sya_logger.log_dir) if f.endswith('.log')]
            print(f"📋 Log files found: {log_files}")
            
            for log_file in log_files:
                log_path = os.path.join(sya_logger.log_dir, log_file)
                size = os.path.getsize(log_path)
                print(f"   - {log_file}: {size} bytes")
        
    except Exception as e:
        print(f"❌ Error testing logger: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n💡 TROUBLESHOOTING TIPS FOR LOCAL PC:")
    print("-" * 40)
    print("1. Make sure you're running from the app-2 root directory")
    print("2. Check if the 'logs' folder exists in your app-2 directory")
    print("3. Verify you have write permissions to the app-2 directory")
    print("4. On Windows, check if antivirus is blocking file creation")
    print("5. Try running as administrator if permission issues persist")
    print("6. Check if the backend server is actually starting successfully")

if __name__ == "__main__":
    debug_logging_setup()