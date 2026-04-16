import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for TTS
  app.post('/api/tts', async (req, res) => {
    const { text, voiceId, apiKey: clientApiKey, modelId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = clientApiKey || process.env.ELEVENLABS_API_KEY;
    const finalVoiceId = voiceId || 'pNInz6obpg8ndclKuztW';
    const finalModelId = modelId || 'eleven_monolingual_v1';

    if (!apiKey || apiKey === 'MY_ELEVENLABS_API_KEY') {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: finalModelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Audio = buffer.toString('base64');

      res.json({ audioContent: base64Audio });
    } catch (error) {
      console.error('TTS Error:', error);
      res.status(500).json({ error: 'Failed to generate audio' });
    }
  });

  // Proxy for OpenRouter Models
  app.get('/api/ai/models', async (req, res) => {
    const apiKey = req.headers.authorization;
    let endpoint = req.query.endpoint as string;
    
    if (!endpoint || endpoint.trim() === '') {
      endpoint = 'https://openrouter.ai/api/v1';
    } else {
      endpoint = endpoint.trim();
      if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        endpoint = 'https://' + endpoint;
      }
    }
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }

    const targetUrl = `${endpoint}/models`;

    try {
      new URL(targetUrl);
    } catch (e) {
      return res.status(400).json({ error: `Invalid API endpoint URL: ${targetUrl}` });
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API Key required' });
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'HTTP-Referer': 'https://chunks-app.ai',
          'X-Title': 'CHUNKS App',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: response.statusText });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error(`Proxy Models Error for URL ${targetUrl}:`, error);
      
      let errorMessage = 'Failed to fetch models via proxy';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.cause) {
          const cause = error.cause as any;
          if (cause.code === 'ECONNREFUSED') {
            errorMessage = `Connection refused. The server at ${targetUrl} is not accepting connections. Check if the server is running and the port is open.`;
          } else if (cause.message && cause.message.includes('other side closed')) {
            errorMessage = `Connection closed by the remote server at ${targetUrl}. The server might be crashing, overloaded, or blocking the request.`;
          } else if (cause.code === 'ETIMEDOUT') {
            errorMessage = `Connection timed out when trying to reach ${targetUrl}.`;
          } else {
            errorMessage = `${error.message} (Cause: ${cause.message || cause.code || 'Unknown'})`;
          }
        }
      }
      
      res.status(502).json({ error: errorMessage, target: targetUrl });
    }
  });

  // Proxy for OpenRouter Chat
  app.post('/api/ai/chat', async (req, res) => {
    const apiKey = req.headers.authorization;
    let { endpoint, ...body } = req.body;

    if (!endpoint || endpoint.trim() === '') {
      endpoint = 'https://openrouter.ai/api/v1';
    } else {
      endpoint = endpoint.trim();
      if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        endpoint = 'https://' + endpoint;
      }
    }
    
    // Remove trailing slash if present
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }

    const targetUrl = `${endpoint}/chat/completions`;

    try {
      new URL(targetUrl); // Validate URL format
    } catch (e) {
      return res.status(400).json({ error: `Invalid API endpoint URL: ${targetUrl}` });
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API Key required' });
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'HTTP-Referer': 'https://chunks-app.ai',
          'X-Title': 'CHUNKS App',
        },
        body: JSON.stringify(body),
      });

      let rawText = '';
      try {
        rawText = await response.text();
      } catch (e) {
        // Ignore text read error
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        // If it's not JSON, wrap it so the client doesn't crash on response.json()
        data = { rawResponse: rawText };
      }

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      console.error(`Proxy Chat Error for URL ${targetUrl}:`, error);
      
      let errorMessage = 'Failed to call AI via proxy';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.cause) {
          const cause = error.cause as any;
          if (cause.code === 'ECONNREFUSED') {
            errorMessage = `Connection refused. The server at ${targetUrl} is not accepting connections. Check if the server is running and the port is open.`;
          } else if (cause.message && cause.message.includes('other side closed')) {
            errorMessage = `Connection closed by the remote server at ${targetUrl}. The server might be crashing, overloaded, or blocking the request.`;
          } else if (cause.code === 'ETIMEDOUT') {
            errorMessage = `Connection timed out when trying to reach ${targetUrl}.`;
          } else {
            errorMessage = `${error.message} (Cause: ${cause.message || cause.code || 'Unknown'})`;
          }
        }
      }
      
      res.status(502).json({ error: errorMessage, target: targetUrl });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
