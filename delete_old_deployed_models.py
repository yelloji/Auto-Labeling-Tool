"""Delete old deployed model records from database"""
import sqlite3
from pathlib import Path

db_path = Path("database.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# IDs of old deployed models to delete
model_ids = [
    "7173f096-4a02-40b0-9bf3-229d9b3cc4d8",  # rok_best
    "0df9ba81-0112-4b65-9fe0-686ae4a5c2de",  # vidoe_last
    "5a8e33dc-7d6b-42e0-98cf-1133b02d3331",  # new_best
    "f6bab3f2-bf75-4b0c-97c6-bd153fb023b8",  # vio2_best
    "8c1e6bd7-244c-411b-b1ee-3e3eb5f4d6bd"   # vidoe_best_rokkkk
]

print("Deleting old deployed model records from database...")
for model_id in model_ids:
    cursor.execute("SELECT name FROM ai_models WHERE id = ?", (model_id,))
    result = cursor.fetchone()
    if result:
        model_name = result[0]
        cursor.execute("DELETE FROM ai_models WHERE id = ?", (model_id,))
        print(f"✅ Deleted: {model_name} (ID: {model_id})")
    else:
        print(f"⚠️  Not found: {model_id}")

conn.commit()
conn.close()

print(f"\n✅ Deleted {len(model_ids)} old deployed model records from database!")
