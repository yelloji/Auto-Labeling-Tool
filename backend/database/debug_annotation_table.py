import sqlite3

# Path to the database file
db_path = "v:\\stage-1-labeling-app\\app-3-fix-release-system-422-error\\database.db"

# Query to fetch annotations
def fetch_annotations():
    query = "SELECT * FROM annotations LIMIT 10;"  # Adjust LIMIT as needed

    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Execute the query
        cursor.execute(query)
        rows = cursor.fetchall()

        # Fetch column names
        column_names = [description[0] for description in cursor.description]

        # Print the results
        print("\nAnnotations Table (Sample):")
        print(" | ".join(column_names))
        print("-" * 80)
        for row in rows:
            print(" | ".join(map(str, row)))

        # Close the connection
        conn.close()

    except sqlite3.Error as e:
        print(f"Error accessing database: {e}")

if __name__ == "__main__":
    fetch_annotations()