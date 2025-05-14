const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Read config from env variables or use defaults
const PORT = process.env.PORT || 3000;
const OLLAMA_API_HOST = process.env.OLLAMA_API_HOST || 'http://localhost:11434';
const REQUEST_TIMEOUT = 30000; // 30 second timeout for API requests

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes

// List available models
app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_API_HOST}/api/tags`, { timeout: REQUEST_TIMEOUT });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching models:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch models', 
      details: error.message 
    });
  }
});

// Generate completions
app.post('/api/generate', async (req, res) => {
  try {
    const { model, prompt, options = {} } = req.body;
    
    if (!model || !prompt) {
      return res.status(400).json({ error: 'Model and prompt are required' });
    }

    // Add num_predict if not already set (defaults to 128 tokens)
    const requestOptions = {
      ...options,
      num_predict: options.num_predict || 512
    };

    const response = await axios.post(`${OLLAMA_API_HOST}/api/generate`, {
      model,
      prompt,
      options: requestOptions
    }, { timeout: REQUEST_TIMEOUT });

    res.json(response.data);
  } catch (error) {
    console.error('Error generating completion:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate completion', 
      details: error.message 
    });
  }
});

// Chat completions
app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages, options = {} } = req.body;
    
    if (!model || !messages) {
      return res.status(400).json({ error: 'Model and messages are required' });
    }

    // Add num_predict if not already set (defaults to 128 tokens)
    const requestOptions = {
      ...options,
      num_predict: options.num_predict || 512
    };

    const response = await axios.post(`${OLLAMA_API_HOST}/api/chat`, {
      model,
      messages,
      options: requestOptions
    }, { timeout: REQUEST_TIMEOUT });

    res.json(response.data);
  } catch (error) {
    console.error('Error in chat completion:', error.message);
    res.status(500).json({ 
      error: 'Failed to process chat completion', 
      details: error.message 
    });
  }
});

// Stream completion (for SSE)
app.post('/api/generate/stream', async (req, res) => {
  try {
    const { model, prompt, options = {} } = req.body;
    
    if (!model || !prompt) {
      return res.status(400).json({ error: 'Model and prompt are required' });
    }
    
    // Add num_predict if not already set
    const requestOptions = {
      ...options,
      num_predict: options.num_predict || 512
    };
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Make request to Ollama API with streaming
    const response = await axios.post(`${OLLAMA_API_HOST}/api/generate`, {
      model,
      prompt,
      stream: true,
      options: requestOptions
    }, {
      responseType: 'stream',
      timeout: REQUEST_TIMEOUT
    });
    
    // Forward the streaming response
    response.data.on('data', (chunk) => {
      res.write(chunk);
    });
    
    response.data.on('end', () => {
      res.end();
    });
    
    // Handle client disconnect
    req.on('close', () => {
      response.data.destroy();
    });
  } catch (error) {
    console.error('Error in stream generation:', error.message);
    res.status(500).json({ 
      error: 'Failed to stream generation', 
      details: error.message 
    });
  }
});

// Get model info
app.get('/api/models/:model', async (req, res) => {
  try {
    const modelName = req.params.model;
    const response = await axios.get(`${OLLAMA_API_HOST}/api/show`, {
      params: { name: modelName },
      timeout: REQUEST_TIMEOUT
    });
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching info for model ${req.params.model}:`, error.message);
    res.status(500).json({ 
      error: `Failed to fetch info for model ${req.params.model}`, 
      details: error.message 
    });
  }
});

// Pull a model
app.post('/api/models/pull', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    // Start the pull process
    const response = await axios.post(`${OLLAMA_API_HOST}/api/pull`, { name }, { timeout: 60000 });
    res.json(response.data);
  } catch (error) {
    console.error('Error pulling model:', error.message);
    res.status(500).json({ 
      error: 'Failed to pull model', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main app for any other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: err.message 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Ollama Server running on port ${PORT}`);
  console.log(`Connected to Ollama API at ${OLLAMA_API_HOST}`);
  console.log(`Web interface available at http://localhost:${PORT}`);
}); 