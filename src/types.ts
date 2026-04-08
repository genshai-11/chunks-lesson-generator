export type ColorCategory = 'Green' | 'Blue' | 'Pink' | 'Red';

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
}
