#!/usr/bin/env python3
"""
Database Auto-Export Startup Script
===================================
Starts the automatic database export system that monitors for changes
and generates JSON/CSV files whenever the database is updated.

Usage:
  python start_auto_export.py                    # One-time export
  python start_auto_export.py --monitor          # Start monitoring mode
  python start_auto_export.py --monitor --interval 10  # Custom interval
"""

import argparse
import sys
import os
import time
from pathlib import Path

# Add backend to path (we're already in backend directory)
sys.path.append(str(Path(__file__).parent))

def main():
    parser = argparse.ArgumentParser(description="Database Auto-Export System")
    parser.add_argument("--monitor", action="store_true", help="Start monitoring mode")
    parser.add_argument("--interval", type=int, default=5, help="Check interval in seconds (default: 5)")
    parser.add_argument("--disable-hooks", action="store_true", help="Disable operation hooks")
    parser.add_argument("--export-dir", type=str, default="database_exports", help="Export directory")
    
    args = parser.parse_args()
    
    try:
        from database.auto_export import DatabaseAutoExporter
        from database.export_hooks import initialize_auto_export, set_auto_export_enabled
        
        print("🚀 Starting Database Auto-Export System")
        print(f"📁 Export directory: {args.export_dir}")
        print(f"⏱️  Check interval: {args.interval} seconds")
        
        # Create exporter
        exporter = DatabaseAutoExporter(export_dir=args.export_dir)
        
        # Perform initial export
        print("📊 Performing initial database export...")
        success = exporter.export_now()
        
        if success:
            print("✅ Initial export completed successfully!")
            print(f"📄 Files created:")
            print(f"   JSON: {exporter.json_file}")
            print(f"   CSV Projects: {exporter.csv_projects_file}")
            print(f"   CSV Datasets: {exporter.csv_datasets_file}")
            print(f"   CSV Images: {exporter.csv_images_file}")
        else:
            print("❌ Initial export failed!")
            return 1
        
        if args.monitor:
            print(f"\n👀 Starting database monitoring (interval: {args.interval}s)")
            print("📝 The system will automatically update export files when database changes are detected.")
            print("🛑 Press Ctrl+C to stop monitoring\n")
            
            # Initialize hooks if not disabled
            if not args.disable_hooks:
                print("🔗 Initializing database operation hooks...")
                initialize_auto_export(enable_monitoring=True, check_interval=args.interval)
            else:
                print("⚠️  Database operation hooks disabled")
                exporter.start_monitoring(args.interval)
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n🛑 Stopping database monitoring...")
                exporter.stop_monitoring()
                print("✅ Auto-export system stopped.")
        else:
            print("\n✅ One-time export completed. Use --monitor to start continuous monitoring.")
        
        return 0
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running this from the project root directory.")
        return 1
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())