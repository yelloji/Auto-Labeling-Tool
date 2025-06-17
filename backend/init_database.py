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

async def main():
    """Initialize the database"""
    print("Initializing database...")
    await init_db()
    print("Database initialization complete!")

if __name__ == "__main__":
    asyncio.run(main())