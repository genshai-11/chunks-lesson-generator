import { AISettings } from '../types';

export async function generateAudio(text: string, settings?: AISettings): Promise<string | null> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        apiKey: settings?.elevenLabsApiKey,
        modelId: settings?.elevenLabsModel,
        voiceId: settings?.elevenLabsVoiceId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('TTS API error:', error);
      return null;
    }

    const data = await response.json();
    // Return the base64 string prefixed with the data URI scheme
    return `data:audio/mpeg;base64,${data.audioContent}`;
  } catch (error) {
    console.error('Failed to generate audio:', error);
    return null;
  }
}
