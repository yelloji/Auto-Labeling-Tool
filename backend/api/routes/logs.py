"""
Logging API Routes
Handles frontend log collection and file management
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
from datetime import datetime
from pathlib import Path

# Import professional logging system
from logging_system.professional_logger import get_professional_logger, log_info, log_error, log_warning

# Initialize professional logger
professional_logger = get_professional_logger()

router = APIRouter()

class FrontendLogEntry(BaseModel):
    timestamp: str
    level: str
    message: str
    context: Optional[str] = None
    error: Optional[Dict[str, Any]] = None
    url: str
    userAgent: str

class FrontendLogsRequest(BaseModel):
    logs: List[FrontendLogEntry]
    timestamp: str
    source: str

@router.post("/logs/frontend")
async def receive_frontend_logs(request: FrontendLogsRequest):
    """Receive and store frontend logs"""
    try:
        # Get logs directory (root/logs)
        logs_dir = Path(__file__).parent.parent.parent.parent / "logs"
        logs_dir.mkdir(exist_ok=True)
        
        frontend_log_file = logs_dir / "frontend.log"
        
        # Append logs to file
        with open(frontend_log_file, "a", encoding="utf-8") as f:
            for log_entry in request.logs:
                # Format log entry for file
                log_line = f"{log_entry.timestamp} | {log_entry.level} | {log_entry.message}"
                
                if log_entry.context:
                    log_line += f" | Context: {log_entry.context}"
                
                if log_entry.error:
                    log_line += f" | Error: {log_entry.error}"
                
                f.write(log_line + "\n")
        
        # Log the operation with professional logger
        professional_logger.info("operations", f"Received {len(request.logs)} frontend log entries", "frontend_logs_received", {
            'source': request.source,
            'log_count': len(request.logs),
            'timestamp': request.timestamp,
            'endpoint': '/logs/frontend'
        })
        
        return {
            "status": "success",
            "message": f"Stored {len(request.logs)} log entries",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        professional_logger.error("errors", "Failed to store frontend logs", "frontend_logs_error", {
            'error': str(e),
            'endpoint': '/logs/frontend',
            'log_count': len(request.logs) if 'request' in locals() else 0
        })
        raise HTTPException(status_code=500, detail=f"Failed to store logs: {str(e)}")

@router.get("/logs/summary")
async def get_logs_summary():
    """Get summary of all log files"""
    try:
        logs_dir = Path(__file__).parent.parent.parent.parent / "logs"
        
        if not logs_dir.exists():
            return {
                "status": "no_logs",
                "message": "No logs directory found"
            }
        
        summary = {
            "logs_directory": str(logs_dir),
            "files": [],
            "total_size": 0
        }
        
        # Scan log files
        for log_file in logs_dir.glob("*.log"):
            if log_file.is_file():
                stat = log_file.stat()
                file_info = {
                    "name": log_file.name,
                    "size": stat.st_size,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "lines": 0
                }
                
                # Count lines
                try:
                    with open(log_file, "r", encoding="utf-8") as f:
                        file_info["lines"] = sum(1 for _ in f)
                except:
                    file_info["lines"] = "unknown"
                
                summary["files"].append(file_info)
                summary["total_size"] += stat.st_size
        
        summary["total_size_mb"] = round(summary["total_size"] / (1024 * 1024), 2)
        summary["file_count"] = len(summary["files"])
        
        return summary
        
    except Exception as e:
        professional_logger.error("errors", "Failed to get logs summary", "logs_summary_error", {
            'error': str(e),
            'endpoint': '/logs/summary'
        })
        raise HTTPException(status_code=500, detail=f"Failed to get logs summary: {str(e)}")

@router.get("/logs/{log_type}")
async def get_log_content(log_type: str, lines: int = 100):
    """Get content from specific log file"""
    try:
        logs_dir = Path(__file__).parent.parent.parent.parent / "logs"
        log_file = logs_dir / f"{log_type}.log"
        
        if not log_file.exists():
            raise HTTPException(status_code=404, detail=f"Log file {log_type}.log not found")
        
        # Read last N lines
        with open(log_file, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            
        # Get last N lines
        recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        return {
            "log_type": log_type,
            "total_lines": len(all_lines),
            "returned_lines": len(recent_lines),
            "content": "".join(recent_lines)
        }
        
    except Exception as e:
        professional_logger.error("errors", f"Failed to read {log_type} log", "log_read_error", {
            'error': str(e),
            'log_type': log_type,
            'endpoint': f'/logs/{log_type}',
            'lines_requested': lines
        })
        raise HTTPException(status_code=500, detail=f"Failed to read log: {str(e)}")

@router.delete("/logs/{log_type}")
async def clear_log_file(log_type: str):
    """Clear specific log file"""
    try:
        logs_dir = Path(__file__).parent.parent.parent.parent / "logs"
        log_file = logs_dir / f"{log_type}.log"
        
        if not log_file.exists():
            raise HTTPException(status_code=404, detail=f"Log file {log_type}.log not found")
        
        # Clear the file
        with open(log_file, "w", encoding="utf-8") as f:
            f.write("")
        
        professional_logger.info("operations", f"Cleared {log_type} log file", "log_clear", {
            'log_type': log_type,
            'endpoint': f'/logs/{log_type}'
        })
        
        return {
            "status": "success",
            "message": f"Cleared {log_type}.log",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        professional_logger.error("errors", f"Failed to clear {log_type} log", "log_clear_error", {
            'error': str(e),
            'log_type': log_type,
            'endpoint': f'/logs/{log_type}'
        })
        raise HTTPException(status_code=500, detail=f"Failed to clear log: {str(e)}")

@router.post("/logs/export")
async def export_all_logs():
    """Export all logs as a single file"""
    try:
        logs_dir = Path(__file__).parent.parent.parent.parent / "logs"
        
        if not logs_dir.exists():
            raise HTTPException(status_code=404, detail="No logs directory found")
        
        export_data = {
            "export_timestamp": datetime.now().isoformat(),
            "logs": {}
        }
        
        # Read all log files
        for log_file in logs_dir.glob("*.log"):
            if log_file.is_file():
                try:
                    with open(log_file, "r", encoding="utf-8") as f:
                        export_data["logs"][log_file.name] = f.read()
                except Exception as e:
                    export_data["logs"][log_file.name] = f"Error reading file: {str(e)}"
        
        # Save export file
        export_file = logs_dir / f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(export_file, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2)
        
        professional_logger.info("operations", f"Exported all logs to {export_file.name}", "logs_export", {
            'export_file': export_file.name,
            'file_count': len(export_data["logs"]),
            'endpoint': '/logs/export'
        })
        
        return {
            "status": "success",
            "export_file": export_file.name,
            "file_count": len(export_data["logs"]),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        professional_logger.error("errors", "Failed to export logs", "logs_export_error", {
            'error': str(e),
            'endpoint': '/logs/export'
        })
        raise HTTPException(status_code=500, detail=f"Failed to export logs: {str(e)}")