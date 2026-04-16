import { AISettings } from '../types';

export async function generateAudio(text: string, settings?: AISettings): Promise<string | null> {
  try {
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
