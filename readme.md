# Claude Chat App

This is a Flask application that allows users to chat with the Anthropic Claude AI model. Users can send text messages, images, and documents to the AI, and receive responses in real-time via Server-Sent Events (SSE).

## Features

- Chat with the Claude AI model
- Send text messages, images, and documents
- Receive real-time responses via Server-Sent Events
- Clear chat history
- Adjust AI model settings (temperature, top_p, top_k, max_tokens)
- Customize system prompt

## Prerequisites

- Python 3.6 or higher
- AWS account with appropriate permissions for Bedrock Runtime

## Installation

1. Clone the repository: git clone https://github.com/your-username/claude-chat-app.git

2. Navigate to the project directory: cd claude-chat-app

3. Create a virtual environment and activate it: python -m venv venv source venv/bin/activate # On Windows, use venv\Scripts\activate

4. Install the required dependencies: pip install -r requirements.txt

5. Set the following environment variables with your AWS credentials and desired region: 
export AWS_ACCESS_KEY_ID=your-access-key-id export AWS_SECRET_ACCESS_KEY=your-secret-access-key export AWS_REGION=your-aws-region


## Usage

1. Start the Flask development server: flask run

2. Open your web browser and navigate to `http://localhost:5000`.

3. Start chatting with the Claude AI model by sending text messages, uploading images, or uploading documents.

## Configuration

You can adjust the AI model settings by modifying the following form fields in the chat interface:

- `temperature`: Controls the randomness of the model's output (default: 0.7)
- `top_p`: Controls the nucleus sampling (default: 0.9)
- `top_k`: Controls the top-k sampling (default: 50)
- `max_tokens`: Maximum number of tokens to generate (default: 4096)
- `system_prompt`: The initial prompt for the AI model (default: "You are a helpful chat bot that can analyze images, documents, and answer questions about them.")

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).



