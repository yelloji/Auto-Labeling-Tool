#!/usr/bin/env python3
"""
SYA Application - Simple Log Viewer
Quick and easy way to view all logs
"""

import os
from pathlib import Path
from datetime import datetime

def view_logs():
    """Simple log viewer - shows all logs clearly"""
    
    logs_dir = Path("logs")
    
    if not logs_dir.exists():
        print("❌ No logs directory found. Start the app first with: python start.py")
        return
    
    print("=" * 80)
    print("🎯 SYA APPLICATION LOGS")
    print("=" * 80)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    log_files = {
        "backend_main.log": "🚀 Backend Main (Startup/Shutdown)",
        "backend_api.log": "🌐 API Requests & Responses", 
        "backend_database.log": "🗄️ Database Operations",
        "backend_transformations.log": "🔄 Image Transformations",
        "backend_errors.log": "❌ Errors & Exceptions",
        "frontend.log": "💻 Frontend Events"
    }
    
    for log_file, description in log_files.items():
        log_path = logs_dir / log_file
        
        print(f"\n{description}")
        print("-" * 60)
        
        if log_path.exists():
            try:
                with open(log_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                if lines:
                    # Show last 5 lines
                    recent_lines = lines[-5:] if len(lines) > 5 else lines
                    for line in recent_lines:
                        print(f"  {line.strip()}")
                    
                    if len(lines) > 5:
                        print(f"  ... ({len(lines) - 5} more lines)")
                else:
                    print("  (No entries yet)")
                    
            except Exception as e:
                print(f"  ❌ Error reading file: {e}")
        else:
            print("  ❌ File not found")
    
    print("\n" + "=" * 80)
    print("💡 To view full logs:")
    print("   cat logs/backend_api.log")
    print("   cat logs/backend_main.log") 
    print("   cat logs/frontend.log")
    print()
    print("🔄 To monitor in real-time:")
    print("   python monitor_logs.py")
    print("=" * 80)

if __name__ == "__main__":
    view_logs()