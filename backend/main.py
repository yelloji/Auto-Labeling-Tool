"""
Main FastAPI application for Auto-Labeling-Tool
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn

# ✅ NEW: Import label routes
from api.routes import labels

from api.routes import projects, datasets, annotations, models, enhanced_export, releases
from api.routes import analytics, augmentation, dataset_management
from api.routes import image_transformations, logs, frontend_logs
from api import active_learning
from core.config import settings
from database.database import init_db
# Import professional logging system
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()
import time

# Initialize FastAPI app
app = FastAPI(
    title="Auto-Labeling-Tool API",
    description="A comprehensive local auto and semi-automatic labeling tool for computer vision datasets",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Cache Control Middleware
class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Prevent caching for API endpoints
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        # Prevent caching for images served by backend
        if request.url.path.startswith("/uploads/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response

# Logging Middleware
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request with professional logger
        logger.info("app.api", f"API Request: {request.method} {request.url.path}", "api_request", {
            "endpoint": str(request.url.path),
            "method": request.method,
            "query_params": dict(request.query_params) if request.query_params else None,
            "client_ip": request.client.host if request.client else None
        })
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Log successful response with professional logger
            logger.info("app.api", f"API Response: {request.method} {request.url.path} - {response.status_code}", "api_response", {
                "endpoint": str(request.url.path),
                "method": request.method,
                "response_time": duration,
                "status_code": response.status_code,
                "response_size": len(response.body) if hasattr(response, 'body') else None,
                "content_type": response.headers.get("content-type", None)
            })
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Log error response with professional logger
            logger.error("errors.system", f"API error: {str(e)}", "api_error", {
                'method': request.method,
                'path': str(request.url.path),
                'status_code': 500,
                'duration': duration,
                'error': str(e),
                'query_params': dict(request.query_params)
            })
            
            raise

# Add middlewares
app.add_middleware(LoggingMiddleware)  # Add logging first
app.add_middleware(CacheControlMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ NEW: Include labels route
app.include_router(labels.router, prefix="/api/v1/projects", tags=["labels"])

# Include API routes
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["datasets"])
app.include_router(annotations.router, prefix="/api/v1/images", tags=["image-annotations"])
app.include_router(models.router, prefix="/api/v1/models", tags=["models"])

app.include_router(enhanced_export.router, prefix="/api/v1/enhanced-export", tags=["enhanced-export"])
app.include_router(releases.router, prefix="/api/v1", tags=["releases"])

# Include new feature routes
app.include_router(analytics.router, tags=["analytics"])
app.include_router(augmentation.router, tags=["augmentation"])
app.include_router(dataset_management.router, tags=["dataset-management"])

# Include transformation preview routes
from api.routes import transformation_preview
app.include_router(transformation_preview.router, tags=["transformation"])

# Include image transformations routes
app.include_router(image_transformations.router, prefix="/api", tags=["image-transformations"])

# Include logs routes
app.include_router(logs.router, prefix="/api/v1", tags=["logs"])
app.include_router(frontend_logs.router, tags=["frontend-logs"])

# Include dataset splits feature
from api.routes import dataset_splits
app.include_router(dataset_splits.router, prefix="/api/v1", tags=["dataset-splits"])

# Include Active Learning routes
app.include_router(active_learning.router, tags=["active-learning"])

# EMERGENCY CLEANUP ENDPOINTS

@app.delete("/api/v1/fix-labels")
async def fix_orphaned_labels():
    """Emergency cleanup endpoint to fix orphaned labels"""
    from database.database import get_db
    from database.models import Label, Project
    
    db = next(get_db())
    
    try:
        # Get list of valid project IDs
        existing_projects = db.query(Project).all()
        existing_project_ids = [p.id for p in existing_projects]
        
        logger.info("app.backend", "Starting emergency label cleanup", "emergency_cleanup_start", {
            "valid_projects": existing_project_ids
        })
        
        # Find orphaned labels (null project_id or non-existent project)
        orphaned_labels = db.query(Label).filter(
            (Label.project_id.is_(None)) | 
            (~Label.project_id.in_(existing_project_ids))
        ).all()
        
        orphaned_count = len(orphaned_labels)
        logger.info("operations.operations", f"Found {orphaned_count} orphaned labels", "orphaned_labels_found", {
            "count": orphaned_count
        })
        
        for label in orphaned_labels:
            logger.info("operations.operations", f"Deleting orphaned label", "orphaned_label_deletion", {
                "label_id": label.id,
                "label_name": label.name,
                "project_id": label.project_id
            })
            db.delete(label)
        
        # Commit all changes
        db.commit()
        logger.info("app.database", "Database changes committed", "cleanup_commit", {
            "deleted_count": orphaned_count
        })
        
        # Verify that all orphaned labels are gone
        remaining = db.query(Label).filter(
            (Label.project_id.is_(None)) | 
            (~Label.project_id.in_(existing_project_ids))
        ).all()
        
        if remaining:
            logger.warning("errors.validation", f"{len(remaining)} orphaned labels still remain", "cleanup_incomplete", {
                "remaining_count": len(remaining)
            })
            return {
                "success": False,
                "message": f"Failed to delete all orphaned labels - {len(remaining)} remain"
            }
        else:
            logger.info("operations.operations", "All orphaned labels successfully removed", "cleanup_complete", {
                "deleted_count": orphaned_count
            })
            return {
                "success": True,
                "message": f"Successfully deleted {orphaned_count} orphaned labels"
            }
    except Exception as e:
        logger.error("errors.system", f"Emergency cleanup failed: {str(e)}", "cleanup_error", {
            "error": str(e)
        })
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()
        logger.info("app.backend", "Emergency cleanup completed", "cleanup_finished")

@app.get("/api/v1/list-labels")
async def list_all_labels():
    """Diagnostic endpoint to list all labels in the database"""
    from database.database import get_db
    from database.models import Label, Project
    
    db = next(get_db())
    
    try:
        # Get all labels
        all_labels = db.query(Label).all()
        projects = {p.id: p.name for p in db.query(Project).all()}
        
        # Group by project
        labels_by_project = {}
        for label in all_labels:
            project_id = label.project_id
            if project_id not in labels_by_project:
                labels_by_project[project_id] = []
            labels_by_project[project_id].append({
                "id": label.id,
                "name": label.name,
                "color": label.color,
                "project_id": label.project_id
            })
        
        # Format the response
        result = []
        for project_id, labels in labels_by_project.items():
            project_name = projects.get(project_id, "Unknown")
            result.append({
                "project_id": project_id,
                "project_name": project_name,
                "label_count": len(labels),
                "labels": labels
            })
        
        return result
    except Exception as e:
        logger.error("errors.system", f"Failed to list labels: {str(e)}", "list_labels_error", {
            "error": str(e)
        })
        return {"error": str(e)}
    finally:
        db.close()
        logger.info("app.database", "Database connection closed", "db_connection_closed")

# Include Smart Segmentation routes
from api import smart_segmentation
app.include_router(smart_segmentation.router, prefix="/api", tags=["smart-segmentation"])

# Serve static files (for uploaded images, etc.)
static_dir = Path(settings.STATIC_FILES_DIR)
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Serve project files
projects_dir = Path(settings.PROJECTS_DIR)
projects_dir.mkdir(exist_ok=True)
app.mount("/projects", StaticFiles(directory=str(projects_dir)), name="projects")

# Image serving endpoint with path migration
@app.get("/api/images/{image_id}")
async def serve_image(image_id: str):
    """Serve image with automatic path migration"""
    from fastapi.responses import FileResponse
    from core.file_handler import file_handler
    from utils.path_utils import path_manager

    # Get image URL (this handles path migration automatically)
    image_url = file_handler.get_image_url(image_id)

    if not image_url:
        raise HTTPException(status_code=404, detail="Image not found")

    # Convert URL back to file path
    relative_path = image_url.lstrip('/')
    absolute_path = path_manager.get_absolute_path(relative_path)

    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(str(absolute_path))

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Auto-Labeling-Tool API is running"}

@app.get("/")
async def root():
    """Root endpoint with basic info"""
    return {
        "message": "Welcome to Auto-Labeling-Tool API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/health"
    }

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database and create tables"""
    logger.info("app.startup", "🚀 SYA Backend starting up", "startup", {
        'version': '1.0.0',
        'environment': 'development',
        'port': 12000
    })
    await init_db()
    logger.info("app.database", "✅ Database initialized successfully", "database_initialized")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("app.startup", "🛑 SYA Backend shutting down", "shutdown")

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=12000,
        reload=True,
        log_level="info"
    )
