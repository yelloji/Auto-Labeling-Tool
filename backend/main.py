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
from api.routes import image_transformations, logs
from api import active_learning
from core.config import settings
from database.database import init_db
from utils.logger import sya_logger, log_info, log_error
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
        
        # Log request
        sya_logger.log_api_request(
            request.method,
            str(request.url.path),
            dict(request.query_params) if request.query_params else None
        )
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Log successful response
            sya_logger.log_api_response(
                request.method,
                str(request.url.path),
                response.status_code,
                None,  # Don't log response body for performance
                duration
            )
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Log error response
            sya_logger.log_api_response(
                request.method,
                str(request.url.path),
                500,
                str(e),
                duration
            )
            
            sya_logger.log_error(e, {
                'method': request.method,
                'path': str(request.url.path),
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
        
        print(f"\n\n================ EMERGENCY LABEL CLEANUP ================")
        print(f"Valid projects: {existing_project_ids}")
        
        # Find orphaned labels (null project_id or non-existent project)
        orphaned_labels = db.query(Label).filter(
            (Label.project_id.is_(None)) | 
            (~Label.project_id.in_(existing_project_ids))
        ).all()
        
        orphaned_count = len(orphaned_labels)
        print(f"Found {orphaned_count} orphaned labels")
        
        for label in orphaned_labels:
            print(f"Deleting orphaned label: ID {label.id}, Name: {label.name}, Project ID: {label.project_id}")
            db.delete(label)
        
        # Commit all changes
        db.commit()
        
        # Verify that all orphaned labels are gone
        remaining = db.query(Label).filter(
            (Label.project_id.is_(None)) | 
            (~Label.project_id.in_(existing_project_ids))
        ).all()
        
        if remaining:
            print(f"WARNING: {len(remaining)} orphaned labels still remain!")
            return {
                "success": False,
                "message": f"Failed to delete all orphaned labels - {len(remaining)} remain"
            }
        else:
            print("SUCCESS: All orphaned labels have been removed")
            return {
                "success": True,
                "message": f"Successfully deleted {orphaned_count} orphaned labels"
            }
    except Exception as e:
        print(f"ERROR: {str(e)}")
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()
        print("================ CLEANUP COMPLETE ================\n\n")

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
        return {"error": str(e)}
    finally:
        db.close()

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
    log_info("🚀 SYA Backend starting up", {
        'version': '1.0.0',
        'environment': 'development',
        'port': 12000
    })
    await init_db()
    log_info("✅ Database initialized successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    log_info("🛑 SYA Backend shutting down")

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=12000,
        reload=True,
        log_level="info"
    )
