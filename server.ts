import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const defaultAi = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ColorCategory = 'Green' | 'Blue' | 'Pink' | 'Red';
type SentenceLength = 'Short' | 'Medium' | 'Long';
type VariationMode = 'paraphrase' | 'scenario' | 'dialogue' | 'mixed';

interface Resource {
  id: string;
  name: string;
  color: ColorCategory;
  ohm: number;
  userId?: string;
  createdAt?: string;
}

interface AISettings {
  endpoint?: string;
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string;
  elevenLabsApiKey?: string;
  elevenLabsModel?: string;
  elevenLabsVoiceId?: string;
}

interface GeneratedChunkResponse {
  engSentence: string;
  vieSentence: string;
  category: string;
}

interface ReviewResult {
  pass: boolean;
  score: number;
  issues: string[];
}

interface ComboCandidate {
  resourceIds: string[];
  resources: Resource[];
  rTotal: number;
  iValue: number;
  uTotal: number;
  distanceToTarget: number;
  diversityScore: number;
  comboHash: string;
}

interface ManualGeneratedChunk extends GeneratedChunkResponse {
  resourcesUsed: Resource[];
  rTotal: number;
  iValue: number;
  uTotal: number;
  difficultyLabel: string;
  audioUrl?: string | null;
  qualityScore?: number;
  reviewIssues?: string[];
  generationAttempt?: number;
}

function sanitizeEndpoint(endpoint?: string): string {
  let finalEndpoint = endpoint || 'https://openrouter.ai/api/v1';
  if (!finalEndpoint.startsWith('http://') && !finalEndpoint.startsWith('https://')) {
    finalEndpoint = 'https://' + finalEndpoint;
  }
  if (finalEndpoint.endsWith('/')) {
    finalEndpoint = finalEndpoint.slice(0, -1);
  }
  return finalEndpoint;
}

function cleanJSON(text: string): string {
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return cleanText.trim();
}

async function callAI(prompt: string, settings?: AISettings): Promise<string> {
  if (!settings?.apiKey) {
    if (!defaultAi) {
      throw new Error('No AI API key configured. Provide a custom API key in settings or set GEMINI_API_KEY.');
    }

    const response = await defaultAi.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    if (!response.text) {
      throw new Error('No response from Gemini');
    }

    return response.text;
  }

  const endpoint = sanitizeEndpoint(settings.endpoint);
  const modelsToTry = [settings.primaryModel, settings.fallbackModel].filter(Boolean) as string[];
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://chunks-app.ai',
          'X-Title': 'CHUNKS App',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.error || errorData.message || `API Error: ${response.status}`;
        throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from AI provider');
      }
      return content;
    } catch (error) {
      console.warn(`Failed with model ${model}:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error('All models failed');
}

function calculateRTotal(resources: Resource[]): number {
  if (resources.length === 0) return 0;

  const groups: Record<string, number[]> = {};
  for (const resource of resources) {
    if (!groups[resource.color]) groups[resource.color] = [];
    groups[resource.color].push(resource.ohm);
  }

  const seriesTotals = Object.values(groups).map(group =>
    group.reduce((sum, ohm) => sum + ohm, 0)
  );

  return seriesTotals.reduce((prod, value) => prod * value, 1);
}

function deriveDifficultyLabel(uTotal: number): string {
  if (uTotal > 100) return 'Master';
  if (uTotal > 50) return 'Advanced';
  if (uTotal > 20) return 'Intermediate';
  return 'Beginner';
}

function hashCombo(resourceIds: string[]): string {
  return resourceIds.slice().sort().join('|');
}

function scoreDiversity(combo: Resource[], preferredColors: ColorCategory[] = []): number {
  const uniqueColors = new Set(combo.map(r => r.color)).size;
  const preferredHits = combo.filter(r => preferredColors.includes(r.color)).length;
  const uniqueResources = new Set(combo.map(r => r.id)).size;
  return uniqueColors * 10 + preferredHits * 3 + uniqueResources;
}

function generateCombinations(pool: Resource[], min: number, max: number, hardCap = 5000): Resource[][] {
  const results: Resource[][] = [];
  const current: Resource[] = [];

  function backtrack(start: number) {
    if (results.length >= hardCap) return;

    if (current.length >= min && current.length <= max) {
      results.push([...current]);
    }

    if (current.length === max) return;

    for (let i = start; i < pool.length; i++) {
      current.push(pool[i]);
      backtrack(i + 1);
      current.pop();
      if (results.length >= hardCap) return;
    }
  }

  backtrack(0);
  return results;
}

function pickDiverseTopN(candidates: ComboCandidate[], quantity: number): ComboCandidate[] {
  const selected: ComboCandidate[] = [];
  const usageCount = new Map<string, number>();

  for (const candidate of candidates) {
    const overused = candidate.resourceIds.some(id => (usageCount.get(id) || 0) >= 3);
    if (overused && selected.length < quantity / 2) continue;

    selected.push(candidate);
    candidate.resourceIds.forEach(id => {
      usageCount.set(id, (usageCount.get(id) || 0) + 1);
    });

    if (selected.length >= quantity) break;
  }

  if (selected.length < quantity) {
    for (const candidate of candidates) {
      if (selected.some(s => s.comboHash === candidate.comboHash)) continue;
      selected.push(candidate);
      if (selected.length >= quantity) break;
    }
  }

  return selected.slice(0, quantity);
}

function selectResourcesForTargetU(input: {
  resources: Resource[];
  targetU: number;
  iValue?: number;
  tolerance?: number;
  quantity?: number;
  minResources?: number;
  maxResources?: number;
  preferredColors?: ColorCategory[];
  excludedResourceIds?: string[];
  recentComboHashes?: string[];
}): ComboCandidate[] {
  const {
    resources,
    targetU,
    iValue = 1,
    tolerance = 2,
    quantity = 10,
    minResources = 2,
    maxResources = 4,
    preferredColors = [],
    excludedResourceIds = [],
    recentComboHashes = [],
  } = input;

  let pool = resources.filter(resource => !excludedResourceIds.includes(resource.id));

  if (preferredColors.length > 0) {
    const preferredPool = pool.filter(resource => preferredColors.includes(resource.color));
    if (preferredPool.length >= minResources) {
      pool = preferredPool;
    }
  }

  pool = pool
    .filter(resource => resource.name?.trim() && Number.isFinite(resource.ohm) && resource.ohm > 0)
    .sort((a, b) => a.ohm - b.ohm);

  const combos = generateCombinations(pool, minResources, maxResources, 5000);

  const candidates: ComboCandidate[] = combos.map(combo => {
    const rTotal = calculateRTotal(combo);
    const uTotal = iValue * rTotal;
    const resourceIds = combo.map(resource => resource.id);
    return {
      resourceIds,
      resources: combo,
      rTotal,
      iValue,
      uTotal,
      distanceToTarget: Math.abs(uTotal - targetU),
      diversityScore: scoreDiversity(combo, preferredColors),
      comboHash: hashCombo(resourceIds),
    };
  }).filter(candidate => !recentComboHashes.includes(candidate.comboHash));

  candidates.sort((a, b) => {
    if (a.distanceToTarget !== b.distanceToTarget) return a.distanceToTarget - b.distanceToTarget;
    if (a.diversityScore !== b.diversityScore) return b.diversityScore - a.diversityScore;
    return a.resources.length - b.resources.length;
  });

  let selected = candidates.filter(candidate => candidate.distanceToTarget <= tolerance);
  if (selected.length < quantity) {
    const fallback = candidates.filter(candidate => candidate.distanceToTarget > tolerance);
    selected = [...selected, ...fallback];
  }

  return pickDiverseTopN(selected, quantity);
}

function buildChunkGenerationPrompt(input: {
  resources: Resource[];
  rTotal: number;
  iValue: number;
  uTotal: number;
  sentenceLength: SentenceLength;
  theme?: string;
  variationHint?: string;
  attempt: number;
}): string {
  const { resources, rTotal, iValue, uTotal, sentenceLength, theme, variationHint, attempt } = input;
  const resourceList = resources.map(r => `- ${r.name} (${r.color}, ${r.ohm} Ohm)`).join('\n');

  return `You are an expert linguist and curriculum designer for an EdTech system called CHUNKS.

Task:
Create ONE bilingual learning chunk using the EXACT resources below.

Resources you MUST use naturally in the English sentence:
${resourceList}

Context:
- Theme: ${theme || 'General everyday usage'}
- Sentence length: ${sentenceLength}
- R_total: ${rTotal}
- I_value: ${iValue}
- U_total: ${uTotal}
- Attempt: ${attempt}
- Variation hint: ${variationHint || 'Create a distinct natural variation'}

Rules:
1. Use ALL listed resources naturally in ONE English sentence.
2. Do NOT invent extra target resources.
3. Keep the sentence semantically natural and usable for learning.
4. Write an accurate and natural Vietnamese translation.
5. Assign a concise category such as Daily Life, Travel, Business, Study.
6. Return STRICT JSON only.

Output format:
{
  "engSentence": "...",
  "vieSentence": "...",
  "category": "..."
}`;
}

function safeParseGeneratedChunk(text: string): GeneratedChunkResponse | null {
  try {
    const parsed = JSON.parse(cleanJSON(text));
    if (!parsed?.engSentence || !parsed?.vieSentence || !parsed?.category) {
      return null;
    }
    return {
      engSentence: String(parsed.engSentence).trim(),
      vieSentence: String(parsed.vieSentence).trim(),
      category: String(parsed.category).trim(),
    };
  } catch {
    return null;
  }
}

function includesAllResources(sentence: string, resources: Resource[]): boolean {
  const normalizedSentence = sentence.toLowerCase();
  return resources.every(resource => {
    const name = resource.name.toLowerCase().trim();
    if (!name) return false;
    return normalizedSentence.includes(name);
  });
}

function validateGeneratedChunk(input: {
  generated: GeneratedChunkResponse;
  resources: Resource[];
  sentenceLength: SentenceLength;
}): { ok: true } | { ok: false; reason: string } {
  const { generated, resources, sentenceLength } = input;

  if (!generated.engSentence || !generated.vieSentence || !generated.category) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  if (!includesAllResources(generated.engSentence, resources)) {
    return { ok: false, reason: 'missing_resource_usage' };
  }

  const wordCount = generated.engSentence.split(/\s+/).filter(Boolean).length;
  if (sentenceLength === 'Short' && wordCount > 16) {
    return { ok: false, reason: 'sentence_too_long_for_short_mode' };
  }
  if (sentenceLength === 'Long' && wordCount < 8) {
    return { ok: false, reason: 'sentence_too_short_for_long_mode' };
  }

  return { ok: true };
}

function buildReviewPrompt(input: {
  resources: Resource[];
  generated: GeneratedChunkResponse;
  theme?: string;
}): string {
  const resourceNames = input.resources.map(r => r.name).join(', ');

  return `You are reviewing a generated bilingual learning chunk.

Theme: ${input.theme || 'General'}
Required resources: ${resourceNames}
English sentence: ${input.generated.engSentence}
Vietnamese translation: ${input.generated.vieSentence}
Category: ${input.generated.category}

Return STRICT JSON only:
{
  "pass": true,
  "score": 0.95,
  "issues": []
}

Review rules:
1. pass=false if any required resource is missing or used unnaturally.
2. pass=false if the Vietnamese translation is clearly wrong or incomplete.
3. pass=false if the sentence feels broken or low-quality for a learning app.
4. score must be between 0 and 1.
5. issues must be short strings.`;
}

function safeParseReview(text: string): ReviewResult | null {
  try {
    const parsed = JSON.parse(cleanJSON(text));
    const pass = Boolean(parsed?.pass);
    const score = Number(parsed?.score);
    const issues = Array.isArray(parsed?.issues) ? parsed.issues.map((issue: unknown) => String(issue)) : [];

    if (!Number.isFinite(score)) return null;

    return {
      pass,
      score: Math.max(0, Math.min(1, score)),
      issues,
    };
  } catch {
    return null;
  }
}

async function reviewChunkDraft(input: {
  resources: Resource[];
  generated: GeneratedChunkResponse;
  theme?: string;
  settings?: AISettings;
}): Promise<ReviewResult> {
  if (!includesAllResources(input.generated.engSentence, input.resources)) {
    return {
      pass: false,
      score: 0.2,
      issues: ['missing_or_weak_resource_usage'],
    };
  }

  const responseText = await callAI(buildReviewPrompt(input), input.settings);
  return safeParseReview(responseText) || {
    pass: false,
    score: 0.2,
    issues: ['invalid_review_json'],
  };
}

async function generateAudioBase64(text: string, settings?: AISettings): Promise<string | null> {
  const apiKey = settings?.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
  const voiceId = settings?.elevenLabsVoiceId || 'pNInz6obpg8ndclKuztW';
  const modelId = settings?.elevenLabsModel || 'eleven_monolingual_v1';

  if (!apiKey || apiKey === 'MY_ELEVENLABS_API_KEY') {
    return null;
  }

  try {
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
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:audio/mpeg;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

async function generateChunkWithRetry(input: {
  resources: Resource[];
  iValue: number;
  sentenceLength?: SentenceLength;
  theme?: string;
  variationHint?: string;
  settings?: AISettings;
  reviewEnabled?: boolean;
  maxAttempts?: number;
  generateAudio?: boolean;
}): Promise<{ success: boolean; chunk?: ManualGeneratedChunk; attemptsUsed: number; failureReason?: string; review?: ReviewResult }> {
  const {
    resources,
    iValue,
    sentenceLength = 'Medium',
    theme,
    variationHint,
    settings,
    reviewEnabled = true,
    maxAttempts = 3,
    generateAudio = false,
  } = input;

  const rTotal = calculateRTotal(resources);
  const uTotal = iValue * rTotal;
  let lastFailureReason = 'unknown_generation_failure';
  let lastReview: ReviewResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = buildChunkGenerationPrompt({
      resources,
      rTotal,
      iValue,
      uTotal,
      sentenceLength,
      theme,
      variationHint,
      attempt,
    });

    let responseText: string;
    try {
      responseText = await callAI(prompt, settings);
    } catch (error) {
      lastFailureReason = error instanceof Error ? error.message : 'provider_call_failed';
      continue;
    }

    const parsed = safeParseGeneratedChunk(responseText);
    if (!parsed) {
      lastFailureReason = 'invalid_json';
      continue;
    }

    const structuralValidation = validateGeneratedChunk({
      generated: parsed,
      resources,
      sentenceLength,
    });

    if (!structuralValidation.ok) {
      lastFailureReason = 'reason' in structuralValidation ? structuralValidation.reason : 'validation_failed';
      continue;
    }

    let reviewResult: ReviewResult = { pass: true, score: 1, issues: [] };
    if (reviewEnabled) {
      reviewResult = await reviewChunkDraft({
        resources,
        generated: parsed,
        theme,
        settings,
      });
      lastReview = reviewResult;

      if (!reviewResult.pass) {
        lastFailureReason = `review_failed:${reviewResult.issues.join('|')}`;
        continue;
      }
    }

    const audioUrl = generateAudio ? await generateAudioBase64(parsed.engSentence, settings) : null;

    return {
      success: true,
      attemptsUsed: attempt,
      review: reviewResult,
      chunk: {
        ...parsed,
        resourcesUsed: resources,
        rTotal,
        iValue,
        uTotal,
        difficultyLabel: deriveDifficultyLabel(uTotal),
        audioUrl,
        qualityScore: reviewResult.score,
        reviewIssues: reviewResult.issues,
        generationAttempt: attempt,
      },
    };
  }

  return {
    success: false,
    attemptsUsed: maxAttempts,
    failureReason: lastFailureReason,
    review: lastReview,
  };
}

function buildVariationHints(quantity: number, mode: VariationMode): string[] {
  return Array.from({ length: quantity }, (_, index) => {
    const number = index + 1;
    switch (mode) {
      case 'paraphrase':
        return `Create a distinct paraphrased sentence variation #${number}`;
      case 'scenario':
        return `Create a sentence in a different practical scenario #${number}`;
      case 'dialogue':
        return `Create a dialogue-like sentence variation #${number}`;
      default:
        return `Create a meaningfully different natural variation #${number}`;
    }
  });
}

async function runWithConcurrencyLimit<T>(tasks: Array<() => Promise<T>>, concurrency = 4): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function manualBatchGenerate(input: {
  resources: Resource[];
  iValue: number;
  quantity: number;
  sentenceLength?: SentenceLength;
  variationMode?: VariationMode;
  theme?: string;
  settings?: AISettings;
  reviewEnabled?: boolean;
  maxAttemptsPerChunk?: number;
  generateAudio?: boolean;
}): Promise<{ totalRequested: number; totalSucceeded: number; totalFailed: number; chunks: ManualGeneratedChunk[]; failures: Array<{ index: number; reason: string }> }> {
  const {
    resources,
    iValue,
    quantity,
    sentenceLength = 'Medium',
    variationMode = 'mixed',
    theme,
    settings,
    reviewEnabled = true,
    maxAttemptsPerChunk = 3,
    generateAudio = false,
  } = input;

  const variationHints = buildVariationHints(quantity, variationMode);

  const results = await runWithConcurrencyLimit(
    variationHints.map((variationHint) => async () =>
      generateChunkWithRetry({
        resources,
        iValue,
        sentenceLength,
        theme,
        variationHint,
        settings,
        reviewEnabled,
        maxAttempts: maxAttemptsPerChunk,
        generateAudio,
      })
    ),
    4,
  );

  const chunks: ManualGeneratedChunk[] = [];
  const failures: Array<{ index: number; reason: string }> = [];

  results.forEach((result, index) => {
    if (result.success && result.chunk) {
      chunks.push(result.chunk);
    } else {
      failures.push({
        index,
        reason: result.failureReason || 'unknown_failure',
      });
    }
  });

  return {
    totalRequested: quantity,
    totalSucceeded: chunks.length,
    totalFailed: failures.length,
    chunks,
    failures,
  };
}

async function smartAIBatchGenerate(input: {
  resources: Resource[];
  targetR: number;
  quantity: number;
  sentenceLength?: SentenceLength;
  preferredColors?: ColorCategory[];
  theme?: string;
  settings?: AISettings;
  reviewEnabled?: boolean;
  maxAttemptsPerChunk?: number;
}): Promise<{ totalRequested: number; totalSucceeded: number; totalFailed: number; chunks: ManualGeneratedChunk[]; failures: Array<{ index: number; reason: string }> }> {
  const {
    resources,
    targetR,
    quantity,
    sentenceLength = 'Medium',
    preferredColors = [],
    theme,
    settings,
    reviewEnabled = true,
    maxAttemptsPerChunk = 3,
  } = input;

  const combos = selectResourcesForTargetU({
    resources,
    targetU: targetR,
    iValue: 1,
    tolerance: Math.max(2, Math.round(targetR * 0.15)),
    quantity: Math.max(quantity * 2, quantity),
    minResources: 2,
    maxResources: 4,
    preferredColors,
  });

  if (combos.length === 0) {
    return {
      totalRequested: quantity,
      totalSucceeded: 0,
      totalFailed: quantity,
      chunks: [],
      failures: Array.from({ length: quantity }, (_, index) => ({
        index,
        reason: 'no_matching_resource_combos_found',
      })),
    };
  }

  const selectedCombos = combos.slice(0, quantity);

  const results = await runWithConcurrencyLimit(
    selectedCombos.map((combo, index) => async () => {
      const generation = await generateChunkWithRetry({
        resources: combo.resources,
        iValue: 1,
        sentenceLength,
        theme,
        variationHint: `Target R around ${targetR}. Candidate #${index + 1}. Keep resource usage natural and distinct from other examples.`,
        settings,
        reviewEnabled,
        maxAttempts: maxAttemptsPerChunk,
        generateAudio: false,
      });

      if (!generation.success || !generation.chunk) {
        return generation;
      }

      return {
        ...generation,
        chunk: {
          ...generation.chunk,
          iValue: 1,
          uTotal: combo.rTotal,
          rTotal: combo.rTotal,
          difficultyLabel: deriveDifficultyLabel(combo.rTotal),
        },
      };
    }),
    4,
  );

  const chunks: ManualGeneratedChunk[] = [];
  const failures: Array<{ index: number; reason: string }> = [];

  results.forEach((result, index) => {
    if (result.success && result.chunk) {
      chunks.push(result.chunk);
    } else {
      failures.push({
        index,
        reason: result.failureReason || 'unknown_failure',
      });
    }
  });

  return {
    totalRequested: quantity,
    totalSucceeded: chunks.length,
    totalFailed: failures.length,
    chunks,
    failures,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

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

  app.post('/api/resources/combos/search', async (req, res) => {
    const {
      resources = [],
      targetU,
      iValue = 1,
      tolerance = 2,
      quantity = 10,
      minResources = 2,
      maxResources = 4,
      preferredColors = [],
      excludedResourceIds = [],
      recentComboHashes = [],
    } = req.body || {};

    if (!Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ error: 'resources array is required' });
    }
    if (!Number.isFinite(Number(targetU))) {
      return res.status(400).json({ error: 'targetU must be a number' });
    }

    try {
      const combos = selectResourcesForTargetU({
        resources,
        targetU: Number(targetU),
        iValue: Number(iValue),
        tolerance: Number(tolerance),
        quantity: Number(quantity),
        minResources: Number(minResources),
        maxResources: Number(maxResources),
        preferredColors,
        excludedResourceIds,
        recentComboHashes,
      });

      res.json({ items: combos });
    } catch (error) {
      console.error('Combo Search Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search resource combos' });
    }
  });

  app.post('/api/chunks/generate', async (req, res) => {
    const {
      resources = [],
      iValue = 1,
      sentenceLength = 'Medium',
      theme,
      settings,
      reviewEnabled = true,
      generateAudio = true,
    } = req.body || {};

    if (!Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ error: 'resources array is required' });
    }

    try {
      const result = await generateChunkWithRetry({
        resources,
        iValue: Number(iValue),
        sentenceLength,
        theme,
        settings,
        reviewEnabled,
        generateAudio,
      });

      if (!result.success) {
        return res.status(422).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Generate Chunk Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate chunk' });
    }
  });

  app.post('/api/chunks/manual-batch-generate', async (req, res) => {
    const {
      resources = [],
      iValue = 1,
      quantity = 1,
      sentenceLength = 'Medium',
      variationMode = 'mixed',
      theme,
      settings,
      reviewEnabled = true,
      maxAttemptsPerChunk = 3,
      generateAudio = false,
    } = req.body || {};

    if (!Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ error: 'resources array is required' });
    }

    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 20) {
      return res.status(400).json({ error: 'quantity must be between 1 and 20' });
    }

    try {
      const result = await manualBatchGenerate({
        resources,
        iValue: Number(iValue),
        quantity: Number(quantity),
        sentenceLength,
        variationMode,
        theme,
        settings,
        reviewEnabled,
        maxAttemptsPerChunk: Number(maxAttemptsPerChunk),
        generateAudio,
      });

      res.json(result);
    } catch (error) {
      console.error('Manual Batch Generate Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate manual batch chunks' });
    }
  });

  app.post('/api/chunks/ai-batch-generate', async (req, res) => {
    const {
      resources = [],
      targetR,
      quantity = 1,
      sentenceLength = 'Medium',
      preferredColors = [],
      theme,
      settings,
      reviewEnabled = true,
      maxAttemptsPerChunk = 3,
    } = req.body || {};

    if (!Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ error: 'resources array is required' });
    }

    if (!Number.isFinite(Number(targetR)) || Number(targetR) <= 0) {
      return res.status(400).json({ error: 'targetR must be a positive number' });
    }

    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 50) {
      return res.status(400).json({ error: 'quantity must be between 1 and 50' });
    }

    try {
      const result = await smartAIBatchGenerate({
        resources,
        targetR: Number(targetR),
        quantity: Number(quantity),
        sentenceLength,
        preferredColors,
        theme,
        settings,
        reviewEnabled,
        maxAttemptsPerChunk: Number(maxAttemptsPerChunk),
      });

      res.json(result);
    } catch (error) {
      console.error('AI Batch Generate Error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate smart AI chunks' });
    }
  });

  // Proxy for OpenRouter Models
  app.get('/api/ai/models', async (req, res) => {
    const apiKey = req.headers.authorization;
    const endpoint = sanitizeEndpoint(req.query.endpoint as string | undefined);

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
    const { endpoint, ...body } = req.body || {};
    const finalEndpoint = sanitizeEndpoint(endpoint);

    if (!apiKey) {
      return res.status(401).json({ error: 'API Key required' });
    }

    try {
      const response = await fetch(`${finalEndpoint}/chat/completions`, {
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
