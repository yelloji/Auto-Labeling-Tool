import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Table → columns to add
migrations = {
    'model_experiments': [
        ('batch', 'INTEGER DEFAULT 4',  'Batch size for prediction processing'),
        ('half',  'INTEGER DEFAULT 0',  'Half-precision (FP16) mode flag'),
    ],
    'images': [
        ('image_hash_md5', 'VARCHAR(32)', 'MD5 hash of image bytes for cross-experiment matching'),
    ],
}

for table_name, columns_to_add in migrations.items():
    for col_name, col_type, description in columns_to_add:
        try:
            cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}')
            conn.commit()
            print(f'✅ [{table_name}] Added {col_name}  ({description})')
        except sqlite3.OperationalError as e:
            if 'duplicate column name' in str(e):
                print(f'ℹ️  [{table_name}] Column {col_name} already exists — skipped')
            else:
                print(f'❌ [{table_name}] Error adding {col_name}: {e}')

    # Verify
    try:
        cursor.execute(f'PRAGMA table_info({table_name})')
        columns = [row[1] for row in cursor.fetchall()]
        print(f'\n--- Verification: {table_name} ---')
        for col_name, _, _ in columns_to_add:
            status = '✅' if col_name in columns else '❌'
            print(f'  {status} {col_name}')
        print(f'  Total columns: {len(columns)}\n')
    except Exception as e:
        print(f'❌ Verification error for {table_name}: {e}')

conn.close()
