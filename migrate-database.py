import sqlite3


def remove_duplicates():
    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()

    # Create a temporary table with unique entries
    c.execute(
        """
    CREATE TEMPORARY TABLE temp_conversations AS
    SELECT MIN(id) as id, conversation_id, timestamp, sender, message, file_data, file_type
    FROM conversations
    GROUP BY conversation_id, timestamp, sender, message
    """
    )

    # Delete all rows from the original table
    c.execute("DELETE FROM conversations")

    # Insert unique entries back into the original table
    c.execute(
        """
    INSERT INTO conversations (id, conversation_id, timestamp, sender, message, file_data, file_type)
    SELECT id, conversation_id, timestamp, sender, message, file_data, file_type
    FROM temp_conversations
    """
    )

    # Drop the temporary table
    c.execute("DROP TABLE temp_conversations")

    conn.commit()
    conn.close()

    print("Duplicate messages removed from the database.")


if __name__ == "__main__":
    remove_duplicates()
