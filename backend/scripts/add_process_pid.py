#!/usr/bin/env python3
"""Add the `process_pid` column to the `training_sessions` table.
If the column already exists the script exits gracefully.
"""
import sys
import os
# Ensure the project root (two levels up) is on the import path so we can import the backend package
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
# Also add the backend package directory so imports like `from core.config` work
backend_dir = os.path.join(project_root, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import inspect, text
from backend.database.database import engine, logger

def column_exists(table: str, column: str) -> bool:
    insp = inspect(engine)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols

def add_process_pid():
    table = "training_sessions"
    column = "process_pid"
    if column_exists(table, column):
        print(f"✅ Column '{column}' already exists in '{table}'. No action needed.")
        return
    stmt = text(f"ALTER TABLE {table} ADD COLUMN {column} INTEGER")
    try:
        with engine.begin() as conn:
            conn.execute(stmt)
        print(f"🚀 Successfully added column '{column}' to '{table}'.")
    except Exception as e:
        print(f"❌ Failed to add column: {e}")
        sys.exit(1)

if __name__ == "__main__":
    add_process_pid()
