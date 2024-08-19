from flask import (
    Flask,
    render_template,
    request,
    Response,
    stream_with_context,
    jsonify,
)
import boto3
import json
import os
from dotenv import load_dotenv
import logging
import base64
from io import BytesIO
import uuid
import sqlite3
from datetime import datetime
from botocore.exceptions import ClientError
import re
import random
import string

load_dotenv()
app = Flask(__name__)


# guardrail_config = {
#     "guardrailIdentifier": os.getenv("guardrail_id"),
#     "guardrailVersion": os.getenv("guardrail_version"),
#     "trace": "enabled",
#     "streamProcessingMode": "sync",
# }


bedrock = boto3.client(
    "bedrock-runtime",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION"),
)


def sanitize_filename(filename):
    # Remove any character that's not alphanumeric, whitespace, hyphen, parenthesis, or square bracket
    sanitized = re.sub(r"[^\w\s\-\(\)\[\]]", "", filename)
    # Replace multiple consecutive whitespaces with a single space
    sanitized = re.sub(r"\s+", " ", sanitized)
    # Trim whitespace from start and end
    sanitized = sanitized.strip()
    # If the filename is empty after sanitization, use a default name
    if not sanitized:
        sanitized = "document"

    # Generate a random string of 8 characters
    random_string = "".join(random.choices(string.ascii_letters + string.digits, k=8))

    # Add the random string to the filename
    name_parts = sanitized.rsplit(".", 1)
    if len(name_parts) > 1:
        # If there's a file extension, add the random string before the extension
        return f"{name_parts[0]}_{random_string}.{name_parts[1]}"
    else:
        # If there's no file extension, just append the random string
        return f"{sanitized}_{random_string}"


def init_db():
    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()
    c.execute(
        """CREATE TABLE IF NOT EXISTS conversations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  conversation_id TEXT,
                  timestamp DATETIME,
                  sender TEXT,
                  message TEXT,
                  file_data TEXT,
                  file_type TEXT)"""
    )
    conn.commit()
    conn.close()


def save_message(conversation_id, sender, message, file_data=None, file_type=None):
    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()
    c.execute(
        "INSERT INTO conversations (conversation_id, timestamp, sender, message, file_data, file_type) VALUES (?, ?, ?, ?, ?, ?)",
        (conversation_id, datetime.now(), sender, message, file_data, file_type),
    )
    conn.commit()
    conn.close()


@app.route("/get_all_conversations", methods=["GET"])
def get_all_conversations_route():
    page = int(request.args.get("page", 1))
    per_page = 10
    offset = (page - 1) * per_page

    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()

    # Get total count of conversations
    c.execute("SELECT COUNT(DISTINCT conversation_id) FROM conversations")
    total_conversations = c.fetchone()[0]

    # Get paginated conversations
    c.execute(
        """
        SELECT conversation_id, MAX(timestamp) as last_update 
        FROM conversations 
        GROUP BY conversation_id 
        ORDER BY last_update DESC
        LIMIT ? OFFSET ?
    """,
        (per_page, offset),
    )

    conversations = c.fetchall()
    conn.close()

    formatted_conversations = [
        (
            conv_id,
            (
                last_update.isoformat()
                if isinstance(last_update, datetime)
                else last_update
            ),
        )
        for conv_id, last_update in conversations
    ]

    return jsonify(
        {
            "conversations": formatted_conversations,
            "total_pages": (total_conversations + per_page - 1) // per_page,
            "current_page": page,
        }
    )


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["GET"])
def chat():
    return render_template("chat.html")


@app.route("/new_chat", methods=["POST"])
def new_chat():
    global messages
    messages = []
    try:
        # Reset the Bedrock conversation
        bedrock_client = boto3.client("bedrock-agent-runtime")

        response = bedrock_client.converse_stream(
            memoryId=uuid.uuid4().hex, inputText="Hello"
        )

        return jsonify(
            {"status": "success", "message": "Chat history cleared successfully"}
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# logging.basicConfig(level=logging.DEBUG)

messages = []


@app.route("/stream", methods=["POST"])
def stream():
    global messages
    user_input = request.form.get("user_input")
    conversation_id = request.form.get("conversation_id")

    # Get the settings from the request
    temperature = float(request.form.get("temperature", 0.7))
    top_p = float(request.form.get("top_p", 0.9))
    top_k = int(request.form.get("top_k", 50))
    max_tokens = int(request.form.get("max_tokens", 4096))
    system_prompt = request.form.get(
        "system_prompt",
        "You are a helpful chat bot that can analyze images, documents, and answer questions about them.",
    )

    # Process multiple files
    file_data = []
    for i in range(5):  # Assuming a maximum of 5 files
        file_key = f"file_{i}"
        file_name_key = f"file_{i}_name"
        file_type_key = f"file_{i}_type"

        if file_key in request.form:
            file_content = request.form.get(file_key)
            file_name = request.form.get(file_name_key)
            file_type = request.form.get(file_type_key)

            file_data.append(
                {"content": file_content, "name": file_name, "type": file_type}
            )

    # Save user message and files
    save_message(conversation_id, "user", user_input)
    for file in file_data:
        save_message(
            conversation_id,
            "user",
            f"Attached file: {file['name']}",
            file["content"],
            file["type"],
        )

    if not user_input and not file_data:
        return (
            Response(
                json.dumps({"error": "No user input or files provided"}),
                content_type="application/json",
            ),
            400,
        )

    message_content = []
    if user_input:
        message_content.append({"text": user_input})
        # message_content.append({"guardContent": {"text": {"text": user_input}}})

    for file in file_data:
        file_bytes = base64.b64decode(file["content"])
        if file["type"] == "image":
            message_content.append(
                {"image": {"format": "png", "source": {"bytes": file_bytes}}}
            )
        elif file["type"] == "document":
            sanitized_name = sanitize_filename(file["name"])
            message_content.append(
                {
                    "document": {
                        "name": sanitized_name,
                        "format": "txt",
                        "source": {"bytes": file_bytes},
                    }
                }
            )

    messages.append({"role": "user", "content": message_content})

    def generate():
        global messages
        model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
        # system_prompt = """You are a helpful chat bot that can analyze images, documents, and answer questions about them. Use Markdown formatting for your responses."""

        system_prompts = [{"text": system_prompt}]
        inference_config = {
            "temperature": temperature,
            "topP": top_p,
            # "topK": top_k,
            "maxTokens": max_tokens,
        }
        additional_model_fields = {}

        # generate a unique seession id using UUID

        try:
            response = bedrock.converse_stream(
                modelId=model_id,
                messages=messages,
                system=system_prompts,
                inferenceConfig=inference_config,
                additionalModelRequestFields=additional_model_fields,
                # guardrailConfig=guardrail_config,
            )
            stream = response.get("stream")
            if stream:
                assistant_message = {"role": "assistant", "content": []}
                full_content = ""
                for event in stream:
                    if "messageStart" in event:
                        yield f"data: {json.dumps({'type': 'message_start', 'role': event['messageStart']['role']})}\n\n"
                    if "contentBlockDelta" in event:
                        delta = event["contentBlockDelta"]["delta"]["text"]
                        full_content += delta
                        yield f"data: {json.dumps({'type': 'content_block_delta', 'text': delta})}\n\n"
                    if "messageStop" in event:
                        if full_content.strip():
                            assistant_message["content"] = [
                                {"text": full_content.strip()}
                            ]
                            messages.append(assistant_message)
                            # Save assistant message
                            save_message(
                                conversation_id, "assistant", full_content.strip()
                            )
                        yield f"data: {json.dumps({'type': 'message_stop', 'reason': event['messageStop']['stopReason']})}\n\n"
                    if "metadata" in event:
                        metadata = event["metadata"]
                        if "usage" in metadata:
                            yield f"data: {json.dumps({'type': 'token_usage', 'usage': metadata['usage']})}\n\n"
                        if "metrics" in metadata:
                            yield f"data: {json.dumps({'type': 'latency', 'latencyMs': metadata['metrics']['latencyMs']})}\n\n"

            messages = messages[-10:]

        except Exception as e:
            logging.error(f"Error in stream generation: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), content_type="text/event-stream")


def get_conversation_history(conversation_id):
    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()
    c.execute(
        "SELECT timestamp, sender, message, file_data, file_type FROM conversations WHERE conversation_id = ? ORDER BY timestamp",
        (conversation_id,),
    )
    history = c.fetchall()
    conn.close()
    return [
        {
            "timestamp": ts,
            "sender": sender,
            "message": msg,
            "fileData": fd,
            "fileType": ft,
        }
        for ts, sender, msg, fd, ft in history
    ]


@app.route("/get_history", methods=["GET"])
def get_history():
    conversation_id = request.args.get("conversation_id")
    history = get_conversation_history(conversation_id)
    return jsonify(history)


@app.route("/delete_conversation", methods=["DELETE"])
def delete_conversation():
    conversation_id = request.args.get("conversation_id")
    if not conversation_id:
        return (
            jsonify({"status": "error", "message": "No conversation ID provided"}),
            400,
        )

    conn = sqlite3.connect("chatbot.db")
    c = conn.cursor()
    try:
        c.execute(
            "DELETE FROM conversations WHERE conversation_id = ?", (conversation_id,)
        )
        conn.commit()
        return jsonify(
            {"status": "success", "message": "Conversation deleted successfully"}
        )
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
