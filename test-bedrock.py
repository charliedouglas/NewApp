from flask import Flask, render_template, request, Response, stream_with_context
import boto3
import json
import os
from dotenv import load_dotenv
import logging
import base64
from io import BytesIO

load_dotenv()
app = Flask(__name__)

bedrock = boto3.client(
    "bedrock-runtime",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION"),
)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["GET"])
def chat():
    return render_template("chat.html")


logging.basicConfig(level=logging.DEBUG)

messages = []


@app.route("/stream", methods=["POST"])
def stream():
    global messages
    user_input = request.form.get("user_input")
    image_data = request.form.get("image_data")

    logging.debug(f"Received user input: {user_input}")

    if not user_input and not image_data:
        return (
            Response(
                json.dumps({"error": "No user input or image provided"}),
                content_type="application/json",
            ),
            400,
        )

    # Prepare the message content
    message_content = []
    if user_input:
        message_content.append({"text": user_input})

    if image_data:
        # Decode the base64 image data
        image_bytes = base64.b64decode(image_data)
        message_content.append(
            {"image": {"format": "png", "source": {"bytes": image_bytes}}}
        )

    # Add the user message to the conversation
    messages.append({"role": "user", "content": message_content})

    def generate():
        global messages
        model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
        system_prompt = """You are a helpful chat bot."""

        system_prompts = [{"text": system_prompt}]
        temperature = 0.7
        top_p = 0.9
        inference_config = {
            "temperature": temperature,
            "topP": top_p,
            "maxTokens": 1000,
        }
        additional_model_fields = {}

        try:
            response = bedrock.converse_stream(
                modelId=model_id,
                messages=messages,
                system=system_prompts,
                inferenceConfig=inference_config,
                additionalModelRequestFields=additional_model_fields,
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
                        if full_content.strip():  # Only add non-empty content
                            assistant_message["content"] = [
                                {"text": full_content.strip()}
                            ]
                            messages.append(assistant_message)
                        yield f"data: {json.dumps({'type': 'message_stop', 'reason': event['messageStop']['stopReason']})}\n\n"
                    if "metadata" in event:
                        metadata = event["metadata"]
                        if "usage" in metadata:
                            yield f"data: {json.dumps({'type': 'token_usage', 'usage': metadata['usage']})}\n\n"
                        if "metrics" in metadata:
                            yield f"data: {json.dumps({'type': 'latency', 'latencyMs': metadata['metrics']['latencyMs']})}\n\n"

            # Trim the message history to keep only the last 10 messages
            messages = messages[-10:]

        except Exception as e:
            logging.error(f"Error in stream generation: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), content_type="text/event-stream")


if __name__ == "__main__":
    app.run(debug=True)
