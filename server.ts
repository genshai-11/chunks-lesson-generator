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
    
    if (!endpoint) {
      endpoint = 'https://openrouter.ai/api/v1';
    } else if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = 'https://' + endpoint;
    }
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API Key required' });
    }

    try {
      const response = await fetch(`${endpoint}/models`, {
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
    } catch (error) {
      console.error('Proxy Models Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch models via proxy' });
    }
  });

  // Proxy for OpenRouter Chat
  app.post('/api/ai/chat', async (req, res) => {
    const apiKey = req.headers.authorization;
    let { endpoint, ...body } = req.body;

    if (!endpoint) {
      endpoint = 'https://openrouter.ai/api/v1';
    } else if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = 'https://' + endpoint;
    }
    // Remove trailing slash if present
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API Key required' });
    }

    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'HTTP-Referer': 'https://chunks-app.ai',
          'X-Title': 'CHUNKS App',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Proxy Chat Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to call AI via proxy' });
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
