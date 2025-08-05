#!/usr/bin/env python3
"""
SYA Application Log Monitor
Real-time log monitoring with clear view
"""

import os
import time
import json
from pathlib import Path
from datetime import datetime
import subprocess

class LogMonitor:
    def __init__(self):
        self.logs_dir = Path("logs")
        self.log_files = {
            "backend_main": "🚀 Backend Main",
            "backend_api": "🌐 API Requests", 
            "backend_database": "🗄️ Database",
            "backend_transformations": "🔄 Transformations",
            "backend_errors": "❌ Errors",
            "frontend": "💻 Frontend"
        }
        self.colors = {
            "INFO": "\033[92m",      # Green
            "ERROR": "\033[91m",     # Red
            "WARNING": "\033[93m",   # Yellow
            "DEBUG": "\033[94m",     # Blue
            "CRITICAL": "\033[95m",  # Magenta
            "RESET": "\033[0m"       # Reset
        }
    
    def clear_screen(self):
        """Clear terminal screen"""
        os.system('clear' if os.name == 'posix' else 'cls')
    
    def get_log_stats(self):
        """Get statistics for all log files"""
        stats = {}
        
        for log_name, display_name in self.log_files.items():
            log_file = self.logs_dir / f"{log_name}.log"
            
            if log_file.exists():
                stat = log_file.stat()
                
                # Count lines and get last modified
                try:
                    with open(log_file, 'r', encoding='utf-8') as f:
                        lines = sum(1 for _ in f)
                except:
                    lines = 0
                
                stats[log_name] = {
                    "display_name": display_name,
                    "size": stat.st_size,
                    "lines": lines,
                    "modified": datetime.fromtimestamp(stat.st_mtime),
                    "exists": True
                }
            else:
                stats[log_name] = {
                    "display_name": display_name,
                    "size": 0,
                    "lines": 0,
                    "modified": None,
                    "exists": False
                }
        
        return stats
    
    def get_recent_logs(self, log_name, lines=5):
        """Get recent log entries from a specific log file"""
        log_file = self.logs_dir / f"{log_name}.log"
        
        if not log_file.exists():
            return []
        
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                all_lines = f.readlines()
                return all_lines[-lines:] if len(all_lines) > lines else all_lines
        except:
            return []
    
    def colorize_log_line(self, line):
        """Add color to log lines based on level"""
        line = line.strip()
        
        for level, color in self.colors.items():
            if level in line.upper() and level != "RESET":
                return f"{color}{line}{self.colors['RESET']}"
        
        return line
    
    def display_dashboard(self):
        """Display the main log monitoring dashboard"""
        self.clear_screen()
        
        print("=" * 80)
        print("🎯 SYA APPLICATION LOG MONITOR")
        print("=" * 80)
        print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Get statistics
        stats = self.get_log_stats()
        
        # Display log file statistics
        print("📊 LOG FILE STATISTICS")
        print("-" * 80)
        print(f"{'Log Type':<25} {'Status':<10} {'Lines':<8} {'Size':<10} {'Last Modified':<20}")
        print("-" * 80)
        
        total_lines = 0
        total_size = 0
        
        for log_name, stat in stats.items():
            status = "✅ Active" if stat["exists"] else "❌ Missing"
            size_str = f"{stat['size']} B" if stat['size'] < 1024 else f"{stat['size']/1024:.1f} KB"
            modified_str = stat["modified"].strftime("%H:%M:%S") if stat["modified"] else "N/A"
            
            print(f"{stat['display_name']:<25} {status:<10} {stat['lines']:<8} {size_str:<10} {modified_str:<20}")
            
            total_lines += stat['lines']
            total_size += stat['size']
        
        print("-" * 80)
        total_size_str = f"{total_size} B" if total_size < 1024 else f"{total_size/1024:.1f} KB"
        print(f"{'TOTAL':<25} {'':<10} {total_lines:<8} {total_size_str:<10}")
        print()
        
        # Display recent log entries
        print("📝 RECENT LOG ENTRIES (Last 3 per file)")
        print("-" * 80)
        
        for log_name, stat in stats.items():
            if stat["exists"] and stat["lines"] > 0:
                print(f"\n{stat['display_name']}:")
                recent_logs = self.get_recent_logs(log_name, 3)
                
                if recent_logs:
                    for log_line in recent_logs:
                        colored_line = self.colorize_log_line(log_line)
                        print(f"  {colored_line}")
                else:
                    print("  (No recent entries)")
        
        print("\n" + "=" * 80)
        print("💡 Commands: [R]efresh | [C]lear logs | [E]xport | [Q]uit")
        print("=" * 80)
    
    def clear_all_logs(self):
        """Clear all log files"""
        print("🧹 Clearing all log files...")
        
        for log_name in self.log_files.keys():
            log_file = self.logs_dir / f"{log_name}.log"
            if log_file.exists():
                try:
                    with open(log_file, 'w') as f:
                        f.write("")
                    print(f"✅ Cleared {log_name}.log")
                except Exception as e:
                    print(f"❌ Failed to clear {log_name}.log: {e}")
        
        print("✅ All logs cleared!")
        time.sleep(2)
    
    def export_logs(self):
        """Export all logs to a single file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_file = self.logs_dir / f"logs_export_{timestamp}.json"
        
        export_data = {
            "export_timestamp": datetime.now().isoformat(),
            "logs": {}
        }
        
        print("📦 Exporting logs...")
        
        for log_name in self.log_files.keys():
            log_file = self.logs_dir / f"{log_name}.log"
            if log_file.exists():
                try:
                    with open(log_file, 'r', encoding='utf-8') as f:
                        export_data["logs"][f"{log_name}.log"] = f.read()
                    print(f"✅ Exported {log_name}.log")
                except Exception as e:
                    print(f"❌ Failed to export {log_name}.log: {e}")
                    export_data["logs"][f"{log_name}.log"] = f"Error: {e}"
        
        try:
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2)
            print(f"✅ Logs exported to {export_file}")
        except Exception as e:
            print(f"❌ Failed to create export file: {e}")
        
        time.sleep(2)
    
    def run(self):
        """Run the log monitor"""
        print("🎯 Starting SYA Log Monitor...")
        time.sleep(1)
        
        while True:
            try:
                self.display_dashboard()
                
                # Get user input with timeout
                print("\nWaiting for command (auto-refresh in 10s)...")
                
                # Use select for non-blocking input (Unix only)
                import select
                import sys
                
                if select.select([sys.stdin], [], [], 10):
                    command = input().strip().lower()
                    
                    if command == 'q' or command == 'quit':
                        print("👋 Goodbye!")
                        break
                    elif command == 'c' or command == 'clear':
                        self.clear_all_logs()
                    elif command == 'e' or command == 'export':
                        self.export_logs()
                    elif command == 'r' or command == 'refresh':
                        continue
                    else:
                        print("❓ Unknown command. Use R, C, E, or Q")
                        time.sleep(1)
                
            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
                time.sleep(2)

def main():
    """Main function"""
    # Ensure logs directory exists
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Start monitor
    monitor = LogMonitor()
    monitor.run()

if __name__ == "__main__":
    main()