import sqlite3


def modify_db_table():
    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()

    try:
        # Add the new 'title' column
        c.execute("ALTER TABLE conversations ADD COLUMN title TEXT;")
        print("Successfully added 'title' column to conversations table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("The 'title' column already exists in the conversations table.")
        else:
            print(f"An error occurred: {e}")

    conn.commit()
    conn.close()


# Run the function
modify_db_table()
