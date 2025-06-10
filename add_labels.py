import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Get all distinct class names from annotations
cursor.execute('SELECT DISTINCT class_name FROM annotations')
class_names = cursor.fetchall()

# Get the project ID
cursor.execute('SELECT id FROM projects')
project_id = cursor.fetchone()[0]

print(f"Found project ID: {project_id}")
print(f"Found class names: {class_names}")

# Add each class name as a label for the project
for name in class_names:
    # Generate a color based on the name
    color = '#' + hex(hash(name[0]) & 0xffffff)[2:].zfill(6)
    
    # Check if label already exists
    cursor.execute('SELECT id FROM labels WHERE name = ? AND project_id = ?', (name[0], project_id))
    existing = cursor.fetchone()
    
    if existing:
        print(f"Label '{name[0]}' already exists for project {project_id}")
    else:
        # Insert the new label
        cursor.execute(
            'INSERT INTO labels (name, color, project_id) VALUES (?, ?, ?)', 
            (name[0], color, project_id)
        )
        print(f"Added label '{name[0]}' with color {color} to project {project_id}")

# Commit changes
conn.commit()

# Verify labels were added
cursor.execute('SELECT * FROM labels')
all_labels = cursor.fetchall()
print(f"All labels in database: {all_labels}")

# Close connection
conn.close()