import sqlite3

conn = sqlite3.connect('database.db')
cur = conn.cursor()
cur.execute("DELETE FROM image_transformations;")
cur.execute("DELETE FROM releases;")
conn.commit()
conn.close()
print("All records deleted from image_transformations and releases.")