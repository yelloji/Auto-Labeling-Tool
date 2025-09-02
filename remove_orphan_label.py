import sqlite3

DB_PATH = "database.db"
ORPHAN_LABEL_ID = 13  # the label row you want to remove

with sqlite3.connect(DB_PATH) as conn:
    cur = conn.cursor()

    # 1. Delete associated annotations
    cur.execute("DELETE FROM annotations WHERE class_id = ?", (ORPHAN_LABEL_ID,))

    # 2. Delete the orphan label itself
    cur.execute("DELETE FROM labels WHERE id = ?", (ORPHAN_LABEL_ID,))

    conn.commit()
    print("Orphan label and related annotations removed.")