import { AISettings, Chunk, Resource } from '../types';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const DEFAULT_WORKSPACE_ID = 'default';

function getEnv() {
  // These are injected by Vite define
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rnietcptihkyvmejtsiy.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_uuGBG_8hzgZU7dO4cUhShg_FNuhc_li';
  const SUPABASE_SERVER_RPC_TOKEN = process.env.SUPABASE_SERVER_RPC_TOKEN || '';

  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVER_RPC_TOKEN };
}

async function callRpc<T>(fn: string, payload: Record<string, unknown>): Promise<T> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVER_RPC_TOKEN } = getEnv();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ p_token: SUPABASE_SERVER_RPC_TOKEN, ...payload }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || data?.hint || response.statusText;
    throw new Error(`Supabase RPC ${fn} failed: ${message}`);
  }

  return data as T;
}

function normalizeCreatedAt(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return new Date(value).toISOString();
}

function mapResourceRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    hint: row.hint || '',
    color: row.color,
    ohm: Number(row.ohm),
    userId: row.user_id || '',
    createdAt: row.created_at,
  };
}

function mapChunkRow(row: any) {
  return {
    id: row.id,
    resourcesUsed: Array.isArray(row.resources_used) ? row.resources_used : [],
    engSentence: row.eng_sentence,
    vieSentence: row.vie_sentence,
    rTotal: row.r_total == null ? 0 : Number(row.r_total),
    iValue: row.i_value == null ? 0 : Number(row.i_value),
    tl: row.tl == null ? undefined : Number(row.tl),
    lc: row.lc == null ? undefined : Number(row.lc),
    uTotal: row.u_total == null ? 0 : Number(row.u_total),
    category: row.category || '',
    difficultyLabel: row.difficulty_label || '',
    evaluation: row.evaluation || undefined,
    audioUrl: row.audio_url || undefined,
    vieAudioUrl: row.vie_audio_url || undefined,
    userId: row.user_id || '',
    createdAt: row.created_at,
  };
}

type HistoryRow = {
  id: string;
  transcript: string;
  predictedCVR?: number | null;
  estimatedTC?: number | null;
  lcValue?: number | null;
  tlValue?: number | null;
  matchedNames?: string;
  calculationString?: string;
  userId?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

function mapHistoryRow(row: any) {
  return {
    id: row.id,
    transcript: row.transcript || '',
    predictedCVR: row.predicted_cvr == null ? null : Number(row.predicted_cvr),
    estimatedTC: row.estimated_tc == null ? null : Number(row.estimated_tc),
    lcValue: row.lc_value == null ? null : Number(row.lc_value),
    tlValue: row.tl_value == null ? null : Number(row.tl_value),
    matchedNames: row.matched_names || '',
    calculationString: row.calculation_string || '',
    userId: row.user_id || '',
    createdAt: row.created_at,
    payload: row.payload || {},
  };
}

const RESOURCE_RPC_PAGE_SIZE = 1000;

export const dataClient = {
  getDashboardBootstrap: async () => {
    try {
      const [resources, aiSettings] = await Promise.all([
        dataClient.getResources(),
        dataClient.getSetting<AISettings>('ai').catch(() => null)
      ]);
      return { resources, aiSettings: aiSettings || undefined };
    } catch (e) {
      console.error('Failed to load dashboard bootstrap:', e);
      return { resources: [] };
    }
  },

  getResources: async (limit?: number) => {
    const maxRows = Number.isFinite(limit) ? Math.max(Math.floor(limit as number), 0) : undefined;
    if (maxRows === 0) return [];

    const rows: any[] = [];
    let offset = 0;

    while (maxRows === undefined || rows.length < maxRows) {
      const remaining = maxRows === undefined ? RESOURCE_RPC_PAGE_SIZE : maxRows - rows.length;
      const pageLimit = Math.min(RESOURCE_RPC_PAGE_SIZE, remaining);
      const page = await callRpc<any[]>('app_get_resources', {
        p_workspace_id: DEFAULT_WORKSPACE_ID,
        p_limit: pageLimit,
        p_offset: offset,
      });

      rows.push(...page);
      if (page.length < pageLimit) break;
      offset += page.length;
    }

    return rows.map(mapResourceRow);
  },

  countResources: async () => {
    try {
      return await callRpc<number>('app_count_resources', { p_workspace_id: DEFAULT_WORKSPACE_ID });
    } catch (e) {
      // Fallback if the RPC doesn't exist
      console.warn('app_count_resources RPC failed, falling back to paginated resource count', e);
      return (await dataClient.getResources()).length;
    }
  },

  createResource: async (payload: Partial<Resource>) => {
    const row = await callRpc<any>('app_create_resource', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_payload: {
        id: payload.id,
        name: payload.name,
        hint: payload.hint || '',
        color: payload.color,
        ohm: Number(payload.ohm),
        userId: payload.userId || '',
        createdAt: normalizeCreatedAt(payload.createdAt),
      },
    });
    return mapResourceRow(row);
  },

  updateResource: async (id: string, patch: Partial<Resource>) => {
    const row = await callRpc<any>('app_update_resource', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_id: id,
      p_payload: patch,
    });
    return mapResourceRow(row);
  },

  deleteResource: async (id: string) => {
    return callRpc<boolean>('app_delete_resource', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_id: id,
    });
  },

  bulkDeleteResources: async (ids: string[]) => {
    return callRpc<number>('app_bulk_delete_resources', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_ids: ids,
    });
  },

  bulkUpdateResources: async (ids: string[], patch: Partial<Resource>) => {
    return callRpc<number>('app_bulk_update_resources', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_ids: ids,
      p_payload: patch,
    });
  },

  bulkCreateResources: async (resources: Partial<Resource>[]) => {
    return callRpc<number>('app_bulk_create_resources', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_resources: resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        hint: resource.hint || '',
        color: resource.color,
        ohm: Number(resource.ohm),
        userId: resource.userId || '',
        createdAt: normalizeCreatedAt(resource.createdAt),
      })),
    });
  },

  getSetting: async <T = any>(key: string) => {
    return callRpc<T | null>('app_get_setting', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_key: key,
    });
  },

  setSetting: async <T = any>(key: string, value: T) => {
    return callRpc<T>('app_upsert_setting', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_key: key,
      p_value: value as any,
    });
  },

  getChunksPage: async (page = 1, pageSize = 20) => {
    const offset = Math.max(0, (page - 1) * pageSize);
    const [rows, total] = await Promise.all([
      callRpc<any[]>('app_get_chunks', {
        p_workspace_id: DEFAULT_WORKSPACE_ID,
        p_limit: pageSize,
        p_offset: offset,
      }),
      callRpc<number>('app_count_chunks', { p_workspace_id: DEFAULT_WORKSPACE_ID }),
    ]);

    return {
      data: rows.map(mapChunkRow),
      total: Number(total || 0),
    };
  },

  getChunks: async (limit = 100) => {
    const rows = await callRpc<any[]>('app_get_chunks', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_limit: limit,
      p_offset: 0,
    });
    return rows.map(mapChunkRow);
  },

  createChunk: async (payload: Partial<Chunk>) => {
    const row = await callRpc<any>('app_create_chunk', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_payload: {
        id: payload.id,
        resourcesUsed: payload.resourcesUsed || [],
        engSentence: payload.engSentence,
        vieSentence: payload.vieSentence,
        rTotal: payload.rTotal,
        iValue: payload.iValue,
        tl: payload.tl,
        lc: payload.lc,
        uTotal: payload.uTotal,
        category: payload.category,
        difficultyLabel: payload.difficultyLabel,
        evaluation: payload.evaluation || null,
        audioUrl: payload.audioUrl || null,
        vieAudioUrl: payload.vieAudioUrl || null,
        userId: payload.userId || '',
        createdAt: normalizeCreatedAt(payload.createdAt),
      },
    });
    return mapChunkRow(row);
  },

  updateChunk: async (id: string, patch: Partial<Chunk>) => {
    const row = await callRpc<any>('app_update_chunk', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_id: id,
      p_payload: patch,
    });
    return mapChunkRow(row);
  },

  deleteChunk: async (id: string) => {
    return callRpc<boolean>('app_delete_chunk', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_id: id,
    });
  },

  bulkDeleteChunks: async (ids: string[]) => {
    return callRpc<number>('app_bulk_delete_chunks', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_ids: ids,
    });
  },

  getHistory: async (limit = 20) => {
    const rows = await callRpc<any[]>('app_get_cvr_history', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_limit: limit,
      p_offset: 0,
    });
    return rows.map(mapHistoryRow);
  },

  createHistory: async (payload: Record<string, unknown>) => {
    const row = await callRpc<any>('app_create_cvr_history', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_payload: {
        ...payload,
        createdAt: normalizeCreatedAt(payload.createdAt),
      },
    });
    return mapHistoryRow(row);
  },

  importFirebasePayload: async (payload: Record<string, unknown>) => {
    return callRpc<any>('app_import_firebase_payload', {
      p_workspace_id: DEFAULT_WORKSPACE_ID,
      p_payload: payload,
    });
  },

  getTcCorrections: async (): Promise<Array<{sentence_fragment: string, resource_name: string, color: string, ohm: number, context?: string, createdAt: string}>> => {
    const data = await dataClient.getSetting<any[]>('tc_corrections').catch(() => null);
    return Array.isArray(data) ? data : [];
  },

  saveTcCorrection: async (correction: {sentence_fragment: string, resource_name: string, color: string, ohm: number, context?: string}) => {
    const existing = await dataClient.getSetting<any[]>('tc_corrections').catch(() => null);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({ ...correction, createdAt: new Date().toISOString() });
    await dataClient.setSetting('tc_corrections', list.slice(0, 100));
  },
};
