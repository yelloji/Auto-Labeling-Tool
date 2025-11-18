import sqlite3
conn = sqlite3.connect('database.db')           
cur = conn.cursor()
cur.execute("ALTER TABLE releases DROP COLUMN classes_json;")
cur.execute("ALTER TABLE releases DROP COLUMN shapes_json;")
conn.commit()
conn.close()
print('Columns removed.')   

"""
import sqlite3
db_path = r"database.db"
con = sqlite3.connect(db_path)
con.execute("PRAGMA foreign_keys = ON;")
con.execute("DROP TABLE IF EXISTS image_variants;")
con.commit()
con.close()
print("Dropped image_variants (if it existed).") """ 