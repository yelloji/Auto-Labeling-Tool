import sqlite3
conn = sqlite3.connect('database.db')
cur = conn.cursor()
cur.execute("ALTER TABLE releases DROP COLUMN classes_json;")
cur.execute("ALTER TABLE releases DROP COLUMN shapes_json;")
conn.commit()
conn.close()
print('Columns removed.')