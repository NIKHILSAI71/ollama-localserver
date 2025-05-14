# Ollama API Server

A server that connects to locally installed [Ollama](https://ollama.ai/) models and makes them accessible via a web interface and API.

## Features

- Connects to your local Ollama instance
- Provides a clean web UI to interact with models
- Exposes a REST API for integration with other applications
- Supports all major Ollama functions:
  - List available models
  - Generate text completions
  - Chat completions with message history
  - Streaming responses
  - Pull new models from Ollama library

## Requirements

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Ollama](https://ollama.ai/) installed and running on your machine

## Installation

1. Clone this repository:
   ```
   git clone <repository-url>
   cd ollama-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Make sure Ollama is running:
   ```
   # On Windows
   ollama serve
   
   # On macOS/Linux
   ollama serve &
   ```

## Configuration

The server uses the following environment variables, which can be set in a `.env` file:

- `PORT`: The port to run the server on (default: 3000)
- `OLLAMA_API_HOST`: The URL of your Ollama API (default: http://localhost:11434)

## Usage

### Starting the server

```
npm start
```

This will start the server at http://localhost:3000 (or the configured port).

For development with auto-reload:

```
npm run dev
```

### Using the web interface

Once the server is running, open a browser and go to:

```
http://localhost:3000
```

The web interface allows you to:
- View available models
- Generate text with prompts
- Chat with models
- Pull new models from Ollama

### API Endpoints

The server exposes the following API endpoints:

- `GET /api/models` - List all available models
- `GET /api/models/:model` - Get information about a specific model
- `POST /api/generate` - Generate text from a prompt
- `POST /api/chat` - Chat with a model using messages
- `POST /api/generate/stream` - Stream a generation response
- `POST /api/models/pull` - Pull a new model
- `GET /health` - Check server health

## API Examples

### List Models

```bash
curl http://localhost:3000/api/models
```

### Generate Text

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Write a short poem about coding"
  }'
```

### Chat

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant"
      },
      {
        "role": "user",
        "content": "Hello, who are you?"
      }
    ]
  }'
```

## Deployment Options

### Local Network Access

To make the server accessible on your local network, you can bind to all interfaces:

```
PORT=3000 node server.js
```

Then access using your machine's local IP address: `http://<your-local-ip>:3000`

### Internet Access

For secure internet access, consider:

1. Using a reverse proxy like Nginx or Caddy
2. Setting up SSL/TLS for encrypted connections
3. Implementing proper authentication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 