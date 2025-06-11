#!/usr/bin/env python3
"""
Utility script to populate the labels table with existing annotation labels.

This script:
1. Scans the annotations table for all unique class_name values
2. Finds which project each annotation belongs to (via image -> dataset -> project)
3. Creates label entries in the labels table for each unique class_name in each project
"""

import sqlite3
import random
import os
import sys
from pathlib import Path

def generate_random_color():
    """Generate a random hex color"""
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    return f"#{r:02x}{g:02x}{b:02x}"

def main():
    print("📋 Labels Table Population Utility")
    print("=" * 50)
    
    # Database path
    db_path = "database.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        sys.exit(1)
    
    print(f"📂 Using database: {db_path}")
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if labels table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='labels'")
    if not cursor.fetchone():
        print("❌ Labels table does not exist!")
        conn.close()
        sys.exit(1)
    
    # Get all unique annotation labels and their projects
    cursor.execute("""
        SELECT DISTINCT a.class_name, d.project_id, p.name as project_name
        FROM annotations a
        JOIN images i ON a.image_id = i.id
        JOIN datasets d ON i.dataset_id = d.id
        JOIN projects p ON d.project_id = p.id
        WHERE a.class_name IS NOT NULL AND a.class_name != ''
        ORDER BY d.project_id, a.class_name
    """)
    
    annotation_labels = cursor.fetchall()
    
    if not annotation_labels:
        print("❌ No annotation labels found!")
        conn.close()
        sys.exit(1)
    
    print(f"✅ Found {len(annotation_labels)} unique class_name values across all projects")
    
    # Group labels by project
    project_labels = {}
    for label in annotation_labels:
        project_id = label['project_id']
        if project_id not in project_labels:
            project_labels[project_id] = {
                'name': label['project_name'],
                'labels': []
            }
        project_labels[project_id]['labels'].append(label['class_name'])
    
    # Show labels by project
    for project_id, data in project_labels.items():
        print(f"\n📊 Project: {data['name']} (ID: {project_id})")
        print(f"   Found {len(data['labels'])} unique labels:")
        for label in data['labels']:
            print(f"   - {label}")
    
    # Confirm with user
    confirm = input("\n⚠️ Do you want to add these labels to the labels table? (y/n): ")
    if confirm.lower() != 'y':
        print("❌ Operation cancelled")
        conn.close()
        sys.exit(0)
    
    # Add labels to the labels table
    labels_added = 0
    labels_skipped = 0
    
    for project_id, data in project_labels.items():
        print(f"\n📝 Processing project: {data['name']} (ID: {project_id})")
        
        for label_name in data['labels']:
            # Check if label already exists
            cursor.execute("""
                SELECT id FROM labels
                WHERE name = ? AND project_id = ?
            """, (label_name, project_id))
            
            existing = cursor.fetchone()
            
            if existing:
                print(f"   ⏩ Skipping '{label_name}' - already exists with ID {existing['id']}")
                labels_skipped += 1
                continue
            
            # Generate a random color
            color = generate_random_color()
            
            # Insert the new label
            try:
                cursor.execute("""
                    INSERT INTO labels (name, color, project_id)
                    VALUES (?, ?, ?)
                """, (label_name, color, project_id))
                
                label_id = cursor.lastrowid
                print(f"   ✅ Added '{label_name}' with color {color} and ID {label_id}")
                labels_added += 1
            except Exception as e:
                print(f"   ❌ Error adding '{label_name}': {str(e)}")
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 50)
    print(f"✅ Operation complete!")
    print(f"   Labels added: {labels_added}")
    print(f"   Labels skipped: {labels_skipped}")
    print(f"   Total labels processed: {labels_added + labels_skipped}")
    print("=" * 50)

if __name__ == "__main__":
    main()#!/usr/bin/env python3
"""
Utility script to populate the labels table with existing annotation labels.

This script:
1. Scans the annotations table for all unique class_name values
2. Finds which project each annotation belongs to (via image -> dataset -> project)
3. Creates label entries in the labels table for each unique class_name in each project
"""

import sqlite3
import random
import os
import sys
from pathlib import Path

def generate_random_color():
    """Generate a random hex color"""
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    return f"#{r:02x}{g:02x}{b:02x}"

def main():
    print("📋 Labels Table Population Utility")
    print("=" * 50)
    
    # Database path
    db_path = "database.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        sys.exit(1)
    
    print(f"📂 Using database: {db_path}")
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if labels table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='labels'")
    if not cursor.fetchone():
        print("❌ Labels table does not exist!")
        conn.close()
        sys.exit(1)
    
    # Get all unique annotation labels and their projects
    cursor.execute("""
        SELECT DISTINCT a.class_name, d.project_id, p.name as project_name
        FROM annotations a
        JOIN images i ON a.image_id = i.id
        JOIN datasets d ON i.dataset_id = d.id
        JOIN projects p ON d.project_id = p.id
        WHERE a.class_name IS NOT NULL AND a.class_name != ''
        ORDER BY d.project_id, a.class_name
    """)
    
    annotation_labels = cursor.fetchall()
    
    if not annotation_labels:
        print("❌ No annotation labels found!")
        conn.close()
        sys.exit(1)
    
    print(f"✅ Found {len(annotation_labels)} unique class_name values across all projects")
    
    # Group labels by project
    project_labels = {}
    for label in annotation_labels:
        project_id = label['project_id']
        if project_id not in project_labels:
            project_labels[project_id] = {
                'name': label['project_name'],
                'labels': []
            }
        project_labels[project_id]['labels'].append(label['class_name'])
    
    # Show labels by project
    for project_id, data in project_labels.items():
        print(f"\n📊 Project: {data['name']} (ID: {project_id})")
        print(f"   Found {len(data['labels'])} unique labels:")
        for label in data['labels']:
            print(f"   - {label}")
    
    # Confirm with user
    confirm = input("\n⚠️ Do you want to add these labels to the labels table? (y/n): ")
    if confirm.lower() != 'y':
        print("❌ Operation cancelled")
        conn.close()
        sys.exit(0)
    
    # Add labels to the labels table
    labels_added = 0
    labels_skipped = 0
    
    for project_id, data in project_labels.items():
        print(f"\n📝 Processing project: {data['name']} (ID: {project_id})")
        
        for label_name in data['labels']:
            # Check if label already exists
            cursor.execute("""
                SELECT id FROM labels
                WHERE name = ? AND project_id = ?
            """, (label_name, project_id))
            
            existing = cursor.fetchone()
            
            if existing:
                print(f"   ⏩ Skipping '{label_name}' - already exists with ID {existing['id']}")
                labels_skipped += 1
                continue
            
            # Generate a random color
            color = generate_random_color()
            
            # Insert the new label
            try:
                cursor.execute("""
                    INSERT INTO labels (name, color, project_id)
                    VALUES (?, ?, ?)
                """, (label_name, color, project_id))
                
                label_id = cursor.lastrowid
                print(f"   ✅ Added '{label_name}' with color {color} and ID {label_id}")
                labels_added += 1
            except Exception as e:
                print(f"   ❌ Error adding '{label_name}': {str(e)}")
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 50)
    print(f"✅ Operation complete!")
    print(f"   Labels added: {labels_added}")
    print(f"   Labels skipped: {labels_skipped}")
    print(f"   Total labels processed: {labels_added + labels_skipped}")
    print("=" * 50)

if __name__ == "__main__":
    main()