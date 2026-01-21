import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

columns_to_add = [
    ('batch', 'INTEGER DEFAULT 4', 'Batch size for prediction processing'),
    ('half', 'INTEGER DEFAULT 0', 'Half-precision (FP16) mode flag')
]

for col_name, col_type, description in columns_to_add:
    try:
        # Add the column
        cursor.execute(f'ALTER TABLE model_experiments ADD COLUMN {col_name} {col_type}')
        conn.commit()
        print(f'✅ Successfully added {col_name} column! ({description})')
        
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print(f'ℹ️  Column {col_name} already exists!')
        else:
            print(f'❌ Error adding {col_name}: {e}')

# Verify both columns were added
try:
    cursor.execute('PRAGMA table_info(model_experiments)')
    columns = [row[1] for row in cursor.fetchall()]
    
    print('\n--- Verification ---')
    for col_name, _, _ in columns_to_add:
        if col_name in columns:
            print(f'✅ Verified: {col_name} is in the table')
        else:
            print(f'❌ Missing: {col_name} not found')
    
    print(f'\n✅ Total columns in model_experiments: {len(columns)}')
    
except Exception as e:
    print(f'❌ Verification error: {e}')
finally:
    conn.close()
