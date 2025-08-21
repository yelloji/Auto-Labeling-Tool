"""
Initialize the database with all tables
Run this script to create all database tables
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database.database import init_db
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

async def main():
    """Initialize the database"""
    logger.info("app.database", "Starting database initialization script", "init_script_start", {
        "script_path": str(Path(__file__)),
        "backend_dir": str(backend_dir)
    })
    
    print("Initializing database...")
    await init_db()
    print("Database initialization complete!")
    
    logger.info("app.database", "Database initialization script completed successfully", "init_script_complete", {
        "script_path": str(Path(__file__))
    })

if __name__ == "__main__":
    asyncio.run(main())