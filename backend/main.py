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

from api.routes import projects, datasets, annotations, models, export, enhanced_export
from api.routes import analytics, augmentation, dataset_management
from api import active_learning
from core.config import settings
from database.database import init_db

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

# Add cache control middleware
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
app.include_router(export.router, prefix="/api/v1/export", tags=["export"])
app.include_router(enhanced_export.router, prefix="/api/v1/enhanced-export", tags=["enhanced-export"])

# Include new feature routes
app.include_router(analytics.router, tags=["analytics"])
app.include_router(augmentation.router, tags=["augmentation"])
app.include_router(dataset_management.router, tags=["dataset-management"])

# Include Active Learning routes
app.include_router(active_learning.router, tags=["active-learning"])

# Include Smart Segmentation routes
from api import smart_segmentation
app.include_router(smart_segmentation.router, prefix="/api", tags=["smart-segmentation"])

# Serve static files (for uploaded images, etc.)
static_dir = Path(settings.STATIC_FILES_DIR)
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Serve uploaded files
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

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
    await init_db()

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=12000,
        reload=True,
        log_level="info"
    )
