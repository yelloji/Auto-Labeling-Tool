"""
Run database migrations for Auto-Labeling-Tool
"""

import os
import sys

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

# Import the migrations module
from database.migrations import run_migrations

if __name__ == "__main__":
    print("Running database migrations...")
    run_migrations()
    print("Database migrations completed successfully")