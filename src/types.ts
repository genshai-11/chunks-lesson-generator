export type ColorCategory = 'Green' | 'Blue' | 'Pink' | 'Red' | 'Yellow' | 'Orange' | 'Purple';

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
  userId: string;
  createdAt: string;
}

export interface AISettings {
  endpoint: string;
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  elevenLabsApiKey?: string;
  elevenLabsModel?: string;
  elevenLabsVoiceId?: string;
  ohmPromptInstructions?: string;
  ohmBaseValues?: {
    Green: number;
    Blue: number;
    Red: number;
    Pink: number;
  };
  m2mApiKey?: string;
}
