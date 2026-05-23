import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  bulkCreateResources,
  bulkDeleteChunks,
  bulkDeleteResources,
  bulkUpdateResources,
  createChunk,
  createHistory,
  createResource,
  deleteChunk,
  deleteResource,
  getChunks,
  getChunksPage,
  getDashboardBootstrap,
  getHistory,
  getResources,
  getSetting,
  importFirebasePayload,
  setSetting,
  updateChunk,
  updateResource,
} from './src/services/serverSupabase';
import {
  measureCVR,
  generateChunk,
  generateAutoChunks,
} from './src/services/aiService';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global API Bypass Middleware: Prevents infrastructure-level 302 redirects 
  // by signaling that these are strictly JSON/Machine-to-Machine requests.
  app.use('/api', (req, res, next) => {
    // These headers are hints for the platform gateway to bypass cookie challenges
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    // Explicitly allow CORS and Preflight for external M2M if needed
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Requested-With, Accept');

    // Handle Preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // 1. Validation for M2M (Machine-to-Machine)
  const validateApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providedKey = req.headers['x-api-key'] || req.query.apiKey;
    const isM2M = req.headers['accept'] === 'application/json' || req.headers['x-requested-with'] === 'XMLHttpRequest';

    console.log(`[API Request] Path: ${req.path}, M2M: ${isM2M}, HasKey: ${!!providedKey}`);

    try {
      const aiSettings = await getSetting('ai').catch(() => null) as any;
      const appApiKey = aiSettings && typeof aiSettings === 'object' ? aiSettings.m2mApiKey : null;
      const fallbackKey = process.env.M2M_API_KEY || 'm2m_CHUNK_ANALYZER_SECURE_2026';

      if ((appApiKey && providedKey === appApiKey) || (providedKey && providedKey === fallbackKey)) {
        return next();
      }

      return res.status(401).json({
        status: 'error',
        error: 'Unauthorized. Valid X-API-Key is required for M2M.'
      });
    } catch (error) {
      if (providedKey && providedKey === (process.env.M2M_API_KEY || 'm2m_CHUNK_ANALYZER_SECURE_2026')) return next();
      return res.status(500).json({ status: 'error', error: 'Failed to validate API key.' });
    }
  };

  // API Route for TTS
  app.post('/api/tts', async (req, res) => {
    const { text, voiceId, apiKey: clientApiKey, modelId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = clientApiKey || process.env.ELEVENLABS_API_KEY;
    const finalVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM';
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

  // Analyze Ohm API (Can be used by 3rd party webhooks)
  app.post('/api/analyze-ohm', validateApiKey, async (req, res) => {
    const { transcript, settings, webhookUrl } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const processOhm = async () => {
      const ohms = settings?.ohmBaseValues || { Green: 3, Blue: 5, Red: 7, Pink: 9 };
      
      const defaultInstructions = `
You are an expert linguistic analyzer. Your task is to extract semantic chunks from the transcript and categorize them into 4 energy levels (Ohm):
- GREEN (${ohms.Green} Ohm) - Gap Fillers: Conversational "lubricants". Includes discourse markers, transition phrases, fillers, or openers that make speech natural but don't carry primary meaning (e.g., "actually", "in general", "so", "well").
- BLUE (${ohms.Blue} Ohm) - Sentence Frames: Reusable communication templates or the "backbone" of a sentence. These are grammatical structures or sentence starters waiting for a payload (e.g., "I wanted to tell you that...", "If... then...", "Have you ever wondered..."). DO NOT classify complete, standalone factual sentences as BLUE; only incomplete frames.
- RED (${ohms.Red} Ohm) - Idioms & Nuance: High-nuance expressions. Includes idioms, vivid colloquialisms, figurative language, or culturally specific sayings (e.g., "mật ngọt chết ruồi", "tới số rồi", "chuyện nhỏ").
- PINK (${ohms.Pink} Ohm) - Key Terms & Concepts: Critical topic units or core concepts. Includes proper nouns, technical terms, or the primary subjects being discussed (e.g., "artificial intelligence", "e-wallet", "geography").`;

      const systemInstructions = settings?.ohmPromptInstructions && settings.ohmPromptInstructions.trim() !== '' 
         ? settings.ohmPromptInstructions 
         : defaultInstructions;

      const prompt = `
${systemInstructions}

CRITICAL RULES FOR CHUNKING:
1. QUALITY OVER QUANTITY: Extract all chunks that truly fit the categories, but ignore common adjectives, basic verbs, and everyday noun phrases.
2. RED IS FOR FIGURATIVE LANGUAGE: Only extract Red if it is a true idiom, metaphor, or vivid colloquial expression. Common praise like "rất tốt", "rất đỉnh", "tuyệt vời" is NOT RED.
3. PINK IS FOR INTERMEDIATE/TECHNICAL VOCABULARY: Only extract Pink if it is a specific topic-related concept, technical term, or academic/intermediate-level vocabulary (e.g., "ứng dụng thực tế", "phát triển bền vững"). Basic nouns like "mèo", "bàn", "nước" are NOT PINK.
4. BLUE MUST BE A FRAME: It must be a reusable structure waiting for content. A complete standalone sentence is rarely BLUE.
5. NO FRAGMENTATION: Don't break phrases that should be together.
6. IGNORE FILLER: If a word adds no energy (like simple "và", "nhưng" in normal use), ignore it unless it acts as a specific discourse marker (GREEN).
7. Extract exact substrings.
8. Brief reason and confidence required.

Rules for Ohm calculation:
- GREEN = ${ohms.Green}, BLUE = ${ohms.Blue}, RED = ${ohms.Red}, PINK = ${ohms.Pink}.
- If multiple chunks have the SAME label, ADD their values.
- If chunks have DIFFERENT labels, MULTIPLY the group sums.

Transcript:
"${transcript}"

Return the result STRICTLY as a JSON object with this structure (example with 2 chunks):
{
  "transcriptRaw": "...",
  "transcriptNormalized": "...",
  "chunks": [
    {
      "text": "chunk 1",
      "label": "BLUE",
      "ohm": ${ohms.Blue},
      "confidence": 0.9,
      "reason": "..."
    },
    {
      "text": "chunk 2",
      "label": "RED",
      "ohm": ${ohms.Red},
      "confidence": 0.8,
      "reason": "..."
    }
  ],
  "formula": "string formula",
  "totalOhm": number
}
`;

      let responseText = '';

      if (settings?.apiKey && settings?.endpoint && settings?.primaryModel) {
        let endpoint = settings.endpoint.endsWith('/') ? settings.endpoint.slice(0, -1) : settings.endpoint;
        const targetUrl = `${endpoint}/chat/completions`;
        
        let authHeader = settings.apiKey;
        if (!authHeader.startsWith('Bearer ')) {
          authHeader = `Bearer ${authHeader}`;
        }

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({ model: settings.primaryModel, stream: false, messages: [{ role: 'user', content: prompt }] })
        });
        
        if (!res.ok) {
           throw new Error(`Custom model failed: ${res.statusText}`);
        }
        
        const data = await res.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          responseText = data.choices[0].message.content;
        } else if (data.response) {
          responseText = data.response;
        } else if (data.content && Array.isArray(data.content)) { responseText = data.content[0].text; } else if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) { responseText = data.candidates[0].content.parts[0].text; } else {
          throw new Error('Unexpected API format: ' + JSON.stringify(data).substring(0, 100));
        }
      } else {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        responseText = response.text || '';
        if (!responseText) throw new Error("No response from Gemini");
      }

      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
      return JSON.parse(jsonString);
    };

    if (webhookUrl) {
      res.json({ status: 'processing', message: 'Analysis started and will be sent to webhook.' });
      
      (async () => {
        try {
          const result = await processOhm();
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'success', data: result })
          });
        } catch (error: any) {
          console.error("Webhook processing error:", error);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', error: error.message })
          }).catch(console.warn);
        }
      })();
    } else {
      try {
        const result = await processOhm();
        res.json({ status: 'success', data: result });
      } catch (error: any) {
        console.error("Ohm Analysis Error", error);
        res.status(500).json({ status: 'error', error: error.message });
      }
    }
  });

  // 1. Validation for M2M (Machine-to-Machine)
  // This helps bypass cookie gates or secure the API for external server A
  // (Middleware moved to top)

  // Transcription API (Can be used by 3rd party)
  app.post('/api/transcribe', validateApiKey, async (req, res) => {
    const { audioData, mimeType } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data (base64) is required' });
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioData
              }
            },
            { text: "Please transcribe this audio. Return ONLY the transcript text in the language spoken, with no other commentary, quotes, or formatting." }
          ]
        }
      });

      const text = response.text || '';
      res.json({ status: 'success', transcript: text.trim() });
    } catch (error: any) {
      console.error("Transcription Error:", error);
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // Proxy for 9Router Voices
  app.get('/api/tts/9router/voices', async (req, res) => {
    let endpoint = req.query.endpoint as string;
    const provider = req.query.provider as string;
    const apiKey = req.headers.authorization;

    console.log('[PROXY VOICES] endpoint:', endpoint, 'provider:', provider, 'apiKey:', apiKey);

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint URL is required' });
    }

    endpoint = endpoint.trim().replace(/\/+$/, '');
    if (endpoint.endsWith('/v1')) {
      endpoint = endpoint.slice(0, -3);
    }
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = 'https://' + endpoint;
    }

    const targetUrl = `${endpoint}/v1/audio/voices${provider ? `?provider=${provider}` : ''}`;

    try {
      let response = await fetch(targetUrl, {
        method: 'GET',
        headers: apiKey ? { 'Authorization': apiKey } : {}
      });

      let usedFallback = false;

      if (!response.ok) {
        // Fallback to /v1/models/tts
        let fallbackUrl = `${endpoint}/v1/models/tts`;
        let fbResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: apiKey ? { 'Authorization': apiKey } : {}
        });
        
        if (fbResponse.ok) {
           response = fbResponse;
           usedFallback = true;
        } else {
           // Fallback to /v1/models
           fallbackUrl = `${endpoint}/v1/models`;
           fbResponse = await fetch(fallbackUrl, {
             method: 'GET',
             headers: apiKey ? { 'Authorization': apiKey } : {}
           });
           
           if (fbResponse.ok) {
             response = fbResponse;
             usedFallback = true;
           }
        }
      }

      const status = response.status;
      if (!response.ok) {
        return res.status(status).json({ error: response.statusText || await response.text() });
      }

      const data = await response.json();
      
      // Adapt the models array to our voice expected format if the fallback was used
      if (usedFallback && data.data && Array.isArray(data.data)) {
        data.data = data.data.map((m: any) => ({
          model: m.id || m.model || '',
          name: m.name || m.id || m.model || 'Default Voice',
          provider: m.provider || (m.id && m.id.includes('/') ? m.id.split('/')[0] : 'unknown')
        }));
      }

      res.json(data);
    } catch (error: any) {
      console.error(`Proxy Voices Error for URL ${targetUrl}:`, error);
      res.status(502).json({ error: error.message || 'Failed to fetch voices via proxy' });
    }
  });

  // Proxy for 9Router Speech
  app.post('/api/tts/9router/speech', async (req, res) => {
    const apiKey = req.headers.authorization;
    let { endpoint, model, input } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint URL is required' });
    }

    endpoint = endpoint.trim().replace(/\/+$/, '');
    if (endpoint.endsWith('/v1')) {
      endpoint = endpoint.slice(0, -3);
    }
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = 'https://' + endpoint;
    }

    const targetUrl = `${endpoint}/v1/audio/speech`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': apiKey } : {})
        },
        body: JSON.stringify({ model, input })
      });

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const errData = await response.text();
          if (errData) errMessage = errData;
        } catch(e) {}
        return res.status(response.status).json({ error: errMessage });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64Audio = buffer.toString('base64');
      res.json({ audioContent: base64Audio });
    } catch (error: any) {
      console.error(`Proxy Speech Error for URL ${targetUrl}:`, error);
      res.status(502).json({ error: error.message || 'Failed to generate speech via proxy' });
    }
  });

  app.get('/api/app/bootstrap', async (_req, res) => {
    try {
      res.json(await getDashboardBootstrap());
    } catch (error: any) {
      console.error('API Bootstrap Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/resources', async (req, res) => {
    try {
      const maxLimit = parseInt(req.query.limit as string) || 100;
      res.json(await getResources(maxLimit));
    } catch (error: any) {
      console.error('API Resources Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/resources/bulk-delete', async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      res.json({ count: await bulkDeleteResources(ids) });
    } catch (error: any) {
      console.error('API Bulk Delete Resources Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/resources/bulk-update', async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const patch = req.body?.patch || {};
      res.json({ count: await bulkUpdateResources(ids, patch) });
    } catch (error: any) {
      console.error('API Bulk Update Resources Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/resources/bulk-create', async (req, res) => {
    try {
      const resources = Array.isArray(req.body?.resources) ? req.body.resources : [];
      res.json({ count: await bulkCreateResources(resources) });
    } catch (error: any) {
      console.error('API Bulk Create Resources Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/resources', async (req, res) => {
    try {
      const { text, name, hint, color, tc, authorId, userId, createdAt } = req.body;
      const resourceName = name || text;
      if (!resourceName) {
        return res.status(400).json({ error: 'Resource name is required' });
      }

      const resource = await createResource({
        name: resourceName,
        hint: hint || '',
        color: color || 'Green',
        ohm: req.body.ohm ?? tc ?? 0,
        userId: userId || authorId || 'API_USER',
        createdAt: createdAt || new Date().toISOString(),
      });

      res.json(resource);
    } catch (error: any) {
      console.error('API Post Resource Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/resources/:id', async (req, res) => {
    try {
      res.json(await updateResource(req.params.id, req.body || {}));
    } catch (error: any) {
      console.error('API Patch Resource Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/resources/:id', async (req, res) => {
    try {
      await deleteResource(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Delete Resource Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/chunks', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      res.json(await getChunksPage(page, pageSize));
    } catch (error: any) {
      console.error('API Chunks Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/chunks/all', async (req, res) => {
    try {
      const maxLimit = parseInt(req.query.limit as string) || 100;
      res.json(await getChunks(maxLimit));
    } catch (error: any) {
      console.error('API Chunks All Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chunks/bulk-delete', async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      res.json({ count: await bulkDeleteChunks(ids) });
    } catch (error: any) {
      console.error('API Bulk Delete Chunks Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/chunks', async (req, res) => {
    try {
      const { engSentence, vieSentence } = req.body;
      if (!engSentence || !vieSentence) {
        return res.status(400).json({ error: 'engSentence and vieSentence are required' });
      }

      const chunk = await createChunk({
        ...req.body,
        userId: req.body.userId || req.body.authorId || 'API_USER',
        createdAt: req.body.createdAt || new Date().toISOString(),
      });

      res.json(chunk);
    } catch (error: any) {
      console.error('API Post Chunk Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/chunks/:id', async (req, res) => {
    try {
      res.json(await updateChunk(req.params.id, req.body || {}));
    } catch (error: any) {
      console.error('API Patch Chunk Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/chunks/:id', async (req, res) => {
    try {
      await deleteChunk(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Delete Chunk Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/history', async (req, res) => {
    try {
      const maxLimit = parseInt(req.query.limit as string) || 20;
      res.json(await getHistory(maxLimit));
    } catch (error: any) {
      console.error('API History Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/history', async (req, res) => {
    try {
      res.json(await createHistory(req.body || {}));
    } catch (error: any) {
      console.error('API Create History Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/settings/:key', async (req, res) => {
    try {
      res.json(await getSetting(req.params.key));
    } catch (error: any) {
      console.error('API Get Setting Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/settings/:key', async (req, res) => {
    try {
      res.json(await setSetting(req.params.key, req.body?.value ?? null));
    } catch (error: any) {
      console.error('API Save Setting Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/migrations/firebase-import', async (req, res) => {
    try {
      res.json(await importFirebasePayload(req.body || {}));
    } catch (error: any) {
      console.error('API Firebase Import Error:', error);
      res.status(500).json({ error: error.message });
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

  // Chatbot direct Gemini endpoint
  app.post('/api/chatbot', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const text = response.text || '';
      res.json({ text });
    } catch (error: any) {
      console.error('Chatbot Gemini Error:', error);
      res.status(500).json({ error: error.message });
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

  // ─── CVR Measure API ─────────────────────────────────────────────────────
  // POST /api/measure-cvr
  // Body: { transcript, resources?, tcCorrections?, settings? }
  // If resources/settings omitted, fetched from Supabase server-side.
  app.post('/api/measure-cvr', validateApiKey, async (req, res) => {
    const { transcript, resources: bodyResources, tcCorrections, settings: bodySettings } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ status: 'error', error: 'transcript (string) is required' });
    }
    try {
      const [settings, resources] = await Promise.all([
        bodySettings ? Promise.resolve(bodySettings) : getSetting('ai').catch(() => null),
        bodyResources ? Promise.resolve(bodyResources) : getResources().catch(() => []),
      ]);
      const result = await measureCVR(transcript, settings as any, undefined, resources as any, tcCorrections);
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      console.error('[/api/measure-cvr]', error);
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // ─── Chunk Generate API ───────────────────────────────────────────────────
  // POST /api/chunk-generate
  // Body: { resources, rTotal, iValue, uTotal, theme?, topicLevel?, sentenceLength?, settings? }
  app.post('/api/chunk-generate', validateApiKey, async (req, res) => {
    const { resources, rTotal, iValue, uTotal, theme, topicLevel, sentenceLength, settings: bodySettings } = req.body;
    if (!Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ status: 'error', error: 'resources (array) is required' });
    }
    try {
      const settings = bodySettings || await getSetting('ai').catch(() => null);
      const result = await generateChunk({ resources, rTotal, iValue, uTotal, theme, topicLevel, sentenceLength, settings: settings as any });
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      console.error('[/api/chunk-generate]', error);
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // ─── Batch Chunk Generate API ─────────────────────────────────────────────
  // POST /api/chunk-generate/batch
  // Body: { theme, topicLevel?, targetU, quantity, sentenceLength, colorPreferences, availableResources?, settings? }
  app.post('/api/chunk-generate/batch', validateApiKey, async (req, res) => {
    const { theme, topicLevel, targetU, quantity, sentenceLength, colorPreferences, availableResources: bodyResources, settings: bodySettings } = req.body;
    if (!quantity || !sentenceLength) {
      return res.status(400).json({ status: 'error', error: 'quantity and sentenceLength are required' });
    }
    try {
      const [settings, availableResources] = await Promise.all([
        bodySettings ? Promise.resolve(bodySettings) : getSetting('ai').catch(() => null),
        bodyResources ? Promise.resolve(bodyResources) : getResources().catch(() => []),
      ]);
      const result = await generateAutoChunks({
        theme: theme || '',
        topicLevel,
        targetU: Number(targetU) || 10,
        quantity: Number(quantity),
        sentenceLength,
        colorPreferences: colorPreferences || [],
        availableResources: availableResources as any,
        settings: settings as any,
      });
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      console.error('[/api/chunk-generate/batch]', error);
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // Public Ping Endpoint — must be before Vite middleware
  app.get('/api/ping', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'M2M API Gateway is active',
      environment: process.env.NODE_ENV || 'development',
    });
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
    console.log(`API health check available at /api/ping`);
  });
}

startServer();
