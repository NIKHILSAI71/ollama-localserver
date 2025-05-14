const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Read config from env variables or use defaults
const PORT = process.env.PORT || 3000;
const OLLAMA_API_HOST = process.env.OLLAMA_API_HOST || 'http://localhost:11434';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '60000'); // 60 second timeout for API requests
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '5m'; // Pass through to Ollama

const app = express();

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Configure axios with defaults to improve reliability
axios.defaults.timeout = REQUEST_TIMEOUT;
axios.defaults.maxContentLength = 50 * 1024 * 1024; // 50MB
axios.defaults.maxBodyLength = 50 * 1024 * 1024; // 50MB

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        url: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({ 
      error: 'Failed to upload file', 
      details: error.message 
    });
  }
});

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

    // Add num_predict if not already set
    const requestOptions = {
      ...options,
      num_predict: options.num_predict || 512,
      keep_alive: options.keep_alive || OLLAMA_KEEP_ALIVE
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

    // Add num_predict if not already set
    const requestOptions = {
      ...options,
      num_predict: options.num_predict || 512,
      keep_alive: options.keep_alive || OLLAMA_KEEP_ALIVE
    };

    console.log(`Chat request to ${model} with options:`, requestOptions);

    const response = await axios.post(`${OLLAMA_API_HOST}/api/chat`, {
      model,
      messages,
      options: requestOptions
    }, { timeout: REQUEST_TIMEOUT });

    if (!response.data || !response.data.message) {
      console.error('Ollama returned invalid response structure:', response.data);
      return res.status(500).json({
        error: 'Invalid response from Ollama',
        details: 'The response did not contain the expected message structure'
      });
    }

    console.log('Chat response received successfully');
    res.json(response.data);
  } catch (error) {
    console.error('Error in chat completion:', error.message);
    if (error.response) {
      console.error('Error response data:', error.response.data);
    }
    
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
      num_predict: options.num_predict || 512,
      keep_alive: options.keep_alive || OLLAMA_KEEP_ALIVE
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
    const response = await axios.post(`${OLLAMA_API_HOST}/api/pull`, { name }, { timeout: 300000 }); // 5 min timeout
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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Ollama Server running on port ${PORT}`);
  console.log(`Connected to Ollama API at ${OLLAMA_API_HOST}`);
  console.log(`Web interface available at http://localhost:${PORT}`);
}); 