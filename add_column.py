import sqlite3

# Connect to the database
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

try:
    # Add the analytics_summary column
    cursor.execute('ALTER TABLE model_experiments ADD COLUMN analytics_summary TEXT')
    conn.commit()
    print('✅ Successfully added analytics_summary column!')
    
    # Verify it was added
    cursor.execute('PRAGMA table_info(model_experiments)')
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'analytics_summary' in columns:
        print(f'✅ Verified: analytics_summary is now in the table')
        print(f'✅ Total columns: {len(columns)}')
    else:
        print('❌ Error: Column was not added')
        
except sqlite3.OperationalError as e:
    if 'duplicate column name' in str(e):
        print('ℹ️  Column already exists!')
    else:
        print(f'❌ Error: {e}')
finally:
    conn.close()
