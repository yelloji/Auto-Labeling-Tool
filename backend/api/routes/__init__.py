# API routes package
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

# Log package initialization
logger.info("app.backend", "API routes package initialized", "routes_package_init", {
    "package": "backend.api.routes",
    "status": "initialized",
    "timestamp": "package_import_time",
    "purpose": "api_routes_initialization"
})