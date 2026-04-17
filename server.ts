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
  app.post('/api/analyze-ohm', async (req, res) => {
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
1. DO NOT classify every word or sentence. Most of the transcript is just normal speech and MUST BE IGNORED.
2. BLUE IS NOT A CATCH-ALL: Do not put leftover or normal sentences into BLUE. A regular statement (e.g., "Hôm nay trời mưa", "Tôi đang đi làm") is NOT BLUE. BLUE must be a specific, reusable template.
3. Common verbs (e.g., "bơi", "ăn"), common nouns (e.g., "mưa", "ngày"), or basic adjectives are NOT PINK unless they are highly specific technical jargon.
4. Do not force a classification. If a sentence only has one BLUE frame and the rest is normal speech, ONLY extract the BLUE frame and ignore the rest.
5. Extract exact substrings from the transcript.
6. Provide a brief reason for the classification.
7. Estimate a confidence score between 0.0 and 1.0.

Rules for Ohm calculation:
- GREEN = ${ohms.Green}, BLUE = ${ohms.Blue}, RED = ${ohms.Red}, PINK = ${ohms.Pink}.
- If multiple chunks have the SAME label, ADD their values.
- If chunks have DIFFERENT labels, MULTIPLY the group sums.
Example 1: 1 GREEN, 1 BLUE -> ${ohms.Green} * ${ohms.Blue} = ${ohms.Green * ohms.Blue}
Example 2: 2 GREENs, 1 RED -> (${ohms.Green} + ${ohms.Green}) * ${ohms.Red} = ${(ohms.Green + ohms.Green) * ohms.Red}
Example 3: 1 RED, 2 PINKs -> ${ohms.Red} * (${ohms.Pink} + ${ohms.Pink}) = ${ohms.Red * (ohms.Pink + ohms.Pink)}

Transcript:
"${transcript}"

Return the result STRICTLY as a JSON object with this structure:
{
  "transcriptRaw": "original transcript",
  "transcriptNormalized": "lowercase, no punctuation version of transcript",
  "chunks": [
    {
      "text": "extracted text",
      "label": "GREEN|BLUE|RED|PINK",
      "ohm": number,
      "confidence": number,
      "reason": "short reason"
    }
  ],
  "formula": "string representing the math formula (e.g., '5 x 7 x 3' or '(5 + 5) x 9')",
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
        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        if (!geminiRes.text) throw new Error("No response from Gemini");
        responseText = geminiRes.text;
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
