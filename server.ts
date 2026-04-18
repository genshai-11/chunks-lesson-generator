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
    // If it's a browser request (has owner cookie), allow it for the main UI
    if (req.headers.cookie && req.headers.cookie.includes('__Secure-')) return next();

    const providedKey = req.headers['x-api-key'] || req.query.apiKey;
    const isM2M = req.headers['accept'] === 'application/json' || req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    // Log for debugging (visible in server logs)
    console.log(`[API Request] Path: ${req.path}, M2M: ${isM2M}, HasKey: ${!!providedKey}`);

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('./src/firebase');
      const docRef = doc(db, `workspaces/default/settings`, 'ai');
      const docSnap = await getDoc(docRef);
      const appApiKey = docSnap.exists() ? docSnap.data().m2mApiKey : null;

      if (appApiKey && providedKey === appApiKey) {
        return next();
      }

      // Hardcoded fallback for the specific key you requested
      if (providedKey === 'm2m_CHUNK_ANALYZER_SECURE_2026') {
        return next();
      }

      return res.status(401).json({ 
        status: 'error', 
        error: 'Unauthorized. Valid X-API-Key is required for M2M.' 
      });
    } catch (error) {
      if (providedKey === 'm2m_CHUNK_ANALYZER_SECURE_2026') return next();
      next();
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
      const ohms = settings?.ohmBaseValues || { Green: 5, Blue: 7, Red: 9, Pink: 3 };
      
      const defaultInstructions = `
You are an expert linguistic analyzer. Analyze the following transcript and extract semantic chunks based on these 4 categories:
- GREEN (${ohms.Green} Ohm): Gap fillers, discourse markers, transition phrases, openers (e.g., "Từ bây giờ", "Nói cách khác", "Thành thật mà nói").
- BLUE (${ohms.Blue} Ohm): Sentence frames, reusable communication templates. These are typically INCOMPLETE sentence starters or grammatical structures waiting for a payload (e.g., "Cậu nên nhớ rằng...", "Nếu cậu mà biết nghĩ thì cậu đâu có...", "Tui không hiểu cậu lấy đâu ra... để..."). DO NOT classify complete, standalone factual sentences as BLUE.
- RED (${ohms.Red} Ohm): Idiomatic expressions, figurative language, vivid colloquial sayings (e.g., "mọi thứ đều có cái giá của nó", "chuyện nhỏ").
- PINK (${ohms.Pink} Ohm): Key terms, specific concepts, lexical topic units (e.g., "ví điện tử", "công nghệ").`;

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
          body: JSON.stringify({
            model: settings.primaryModel,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        
        if (!res.ok) {
           throw new Error(`Custom model failed: ${res.statusText}`);
        }
        
        const data = await res.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          responseText = data.choices[0].message.content;
        } else if (data.response) {
          responseText = data.response;
        } else if (data.content && Array.isArray(data.content)) {
          responseText = data.content[0].text;
        } else {
          throw new Error('Unexpected API format');
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
    console.log(`API health check available at /api/ping`);
  });

  // Public Ping Endpoint for Connectivity Debugging
  // This helps verify if the gateway bypass is working without needing an API key
  app.get('/api/ping', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'M2M API Gateway is active',
      environment: process.env.NODE_ENV || 'development',
      hint: 'If you still see an HTML 302, verify you are using the Shared App URL (-pre-).'
    });
  });
}

startServer();
