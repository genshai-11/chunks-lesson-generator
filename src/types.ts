export type ColorCategory = 'Green' | 'Blue' | 'Pink' | 'Red' | 'Yellow' | 'Orange' | 'Purple';

export type SentenceLength = 'Very Short' | 'Short' | 'Medium' | 'Long';

export interface SentenceConstraint {
  maxSentences: number;
  maxWords: number;
}

export interface Resource {
  id: string;
  name: string;
  color: ColorCategory;
  ohm: number;
  userId: string;
  createdAt: string;
}

export interface Chunk {
  id: string;
  resourcesUsed: Resource[];
  engSentence: string;
  vieSentence: string;
  rTotal: number;
  iValue: number;
  uTotal: number;
  category: string;
  difficultyLabel: string;
  evaluation?: string;
  audioUrl?: string | null;
  vieAudioUrl?: string | null;
  userId: string;
  createdAt: string;
}

export type FormulaType = 'sum' | 'circuit';

export type TTSProvider = 'elevenlabs' | 'deepgram';

export interface AISettings {
  endpoint: string;
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  ttsProvider?: TTSProvider;
  elevenLabsApiKey?: string;
  elevenLabsModel?: string;
  elevenLabsVoiceId?: string;
  deepgramApiKey?: string;
  deepgramModel?: string;
  ohmPromptInstructions?: string;
  formulaType?: FormulaType;
  complexityMultipliers?: Record<SentenceLength, number>;
  ohmBaseValues?: {
    Green: number;
    Blue: number;
    Red: number;
    Pink: number;
  };
  m2mApiKey?: string;
  sentenceConstraints?: Record<SentenceLength, SentenceConstraint>;
  geminiApiKey?: string;
  audioTranscriptModel?: string;
}
