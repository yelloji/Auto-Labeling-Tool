#!/usr/bin/env python3
"""
Test script to simulate frontend logging
"""

import json
from pathlib import Path
from datetime import datetime

def create_frontend_logs():
    """Create frontend log file manually to test the system"""
    
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    frontend_log_file = logs_dir / "frontend.log"
    
    # Sample frontend log entries
    log_entries = [
        f"{datetime.now().isoformat()} | INFO | Frontend session started | Context: {{\"userAgent\": \"Test Browser\", \"url\": \"http://localhost:3000\"}}",
        f"{datetime.now().isoformat()} | INFO | USER ACTION | Component clicked | Context: {{\"component\": \"TransformationCard\", \"action\": \"click\"}}",
        f"{datetime.now().isoformat()} | INFO | API REQUEST | GET /api/v1/transformations | Context: {{\"method\": \"GET\", \"url\": \"/api/v1/transformations\"}}",
        f"{datetime.now().isoformat()} | INFO | API RESPONSE | GET /api/v1/transformations | Status: 200 | Context: {{\"status\": 200, \"duration\": \"245ms\"}}",
        f"{datetime.now().isoformat()} | WARNING | Slow API response detected | Context: {{\"endpoint\": \"/api/v1/models\", \"duration\": \"2.5s\"}}",
        f"{datetime.now().isoformat()} | ERROR | Failed to load component | Context: {{\"component\": \"ModelSelector\", \"error\": \"Network timeout\"}}"
    ]
    
    # Write logs to file
    with open(frontend_log_file, "w", encoding="utf-8") as f:
        for entry in log_entries:
            f.write(entry + "\n")
    
    print(f"✅ Created frontend log file: {frontend_log_file}")
    print(f"📝 Added {len(log_entries)} log entries")
    
    return frontend_log_file

if __name__ == "__main__":
    create_frontend_logs()