#!/usr/bin/env python3
"""
Debug script for ImageVariant table
===================================
Query and display ImageVariant records with optional filtering by parent_image_id.

Usage: python debug_image_variants.py [--parent_id PARENT_ID]
"""

import sqlite3
import argparse
from datetime import datetime
import sys

def print_header(title, char="="):
    """Print a formatted header"""
    print(f"\n{char * 80}")
    print(f"{title:^80}")
    print(f"{char * 80}")

def format_row(row, columns):
    """Format a single row for display"""
    formatted = []
    for col, value in zip(columns, row):
        if col == 'created_at' and value:
            try:
                value = datetime.fromisoformat(value).strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        formatted.append(f"{col}: {value}")
    return "\n   ".join(formatted)

def main():
    parser = argparse.ArgumentParser(description="Debug ImageVariant table")
    parser.add_argument("--parent_id", type=int, help="Filter by parent_image_id")
    args = parser.parse_args()

    db_path = "database.db"
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print_header("IMAGE VARIANTS DEBUG")

        if args.parent_id:
            print(f"\nFiltering by parent_image_id: {args.parent_id}")
            cursor.execute("SELECT * FROM image_variants WHERE parent_image_id = ?", (args.parent_id,))
        else:
            print("\nShowing all ImageVariants")
            cursor.execute("SELECT * FROM image_variants")
        
        rows = cursor.fetchall()
        
        if not rows:
            print("❌ No records found")
            return
        
        columns = [desc[0] for desc in cursor.description]
        
        print(f"📊 Total records: {len(rows)}")
        
        for i, row in enumerate(rows, 1):
            print(f"\n📋 Record {i}:")
            print("   " + "-" * 76)
            print("   " + format_row(row, columns))
            print("   " + "-" * 76)
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()