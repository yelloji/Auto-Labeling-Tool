import sqlite3
from datetime import datetime

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# Update the training session status
cursor.execute("""
    UPDATE training_sessions 
    SET status='completed', 
        completed_at=? 
    WHERE id=8
""", (datetime.utcnow(),))

conn.commit()
print(f"✅ Updated session 8: status='completed'")

# Verify
cursor.execute("SELECT id, name, status, completed_at FROM training_sessions WHERE id=8")
row = cursor.fetchone()
print(f"   Session: {row}")

conn.close()
