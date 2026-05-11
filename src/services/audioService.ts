import { AISettings } from '../types';

export async function generateAudio(text: string, settings?: AISettings, lang: 'eng' | 'vie' = 'eng'): Promise<string | null> {
  try {
    const provider = settings?.ttsProvider || 'elevenlabs';

    if (provider === '9router') {
      const url = settings?.nineRouterUrl;
      const apiKey = settings?.nineRouterApiKey;
      const model = lang === 'vie' ? settings?.nineRouterVieVoice : settings?.nineRouterEngVoice;

      if (!url) {
        throw new Error('9Router URL not configured');
      }
      if (!model) {
        throw new Error(`9Router ${lang === 'vie' ? 'Vietnamese' : 'English'} Voice Model not configured`);
      }

      const response = await fetch(`/api/tts/9router/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          endpoint: url,
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to generate audio with 9Router: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      if (!data.audioContent) {
        throw new Error('No audio content received from proxy');
      }

      return `data:audio/mp3;base64,${data.audioContent}`;
    }

    if (provider === 'deepgram') {
      const apiKey = settings?.deepgramApiKey;
      const model = settings?.deepgramModel || 'aura-asteria-en';

      if (!apiKey) {
        throw new Error('Deepgram API key not configured');
      }

      const response = await fetch(`https://api.deepgram.com/v1/speak?model=${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${apiKey}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Deepgram API error:', error);
        throw new Error('Failed to generate audio with Deepgram');
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Default to elevenlabs
    const apiKey = settings?.elevenLabsApiKey;
    const voiceId = settings?.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
    const modelId = settings?.elevenLabsModel || 'eleven_multilingual_v2';

    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('TTS API error:', error);
      if (error.detail && error.detail.message) {
        throw new Error(error.detail.message);
      } else if (error.error) {
        throw new Error(error.error);
      }
      throw new Error('Failed to generate audio');
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.error('Failed to generate audio:', error);
    throw error;
  }
}
