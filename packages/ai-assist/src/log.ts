import { type AiStorage, createBrowserStorage } from './storage';

/** AI 互動紀錄的持久化接口 —— 重新套用 / 聊天歷史共用；後端可換。 */
export interface AiAssistEntry {
  id: string;
  kind: 'generate' | 'ask' | 'explain' | 'check';
  prompt?: string;
  answer?: string;
  appliedJson?: string;
  at: string;
}

export const AI_LOG_LIMIT = 50;

export interface AiLogStore {
  list(): AiAssistEntry[];
  append(entry: AiAssistEntry): AiAssistEntry[];
  clear(): void;
}

const KINDS = new Set(['generate', 'ask', 'explain', 'check']);

function isEntry(v: unknown): v is AiAssistEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Partial<AiAssistEntry>;
  return typeof e.id === 'string' && typeof e.kind === 'string' && KINDS.has(e.kind) && typeof e.at === 'string';
}

/** 只保留 string 的選填欄位——防止被竄改的紀錄（如 appliedJson 為數字）流入重新套用 / 畫面。 */
function normalize(e: AiAssistEntry): AiAssistEntry {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return { id: e.id, kind: e.kind, at: e.at, prompt: str(e.prompt), answer: str(e.answer), appliedJson: str(e.appliedJson) };
}

export function createAiLog(storageKey: string, storage: AiStorage = createBrowserStorage()): AiLogStore {
  const list = (): AiAssistEntry[] => {
    const raw = storage.get(storageKey);
    if (!raw) return [];
    try {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.filter(isEntry).map(normalize) : [];
    } catch {
      return [];
    }
  };
  return {
    list,
    append(entry) {
      const next = [...list(), entry].slice(-AI_LOG_LIMIT);
      storage.set(storageKey, JSON.stringify(next));
      return next;
    },
    clear() {
      storage.remove(storageKey);
    },
  };
}
