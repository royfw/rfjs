/** AI 互動紀錄的持久化接口 —— Wave 2 重新套用 / Wave 3 聊天歷史共用;後端可換。 */
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

export function createAiLog(storageKey: string): AiLogStore {
  const list = (): AiAssistEntry[] => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.filter(isEntry) : [];
    } catch {
      return [];
    }
  };
  return {
    list,
    append(entry) {
      const next = [...list(), entry].slice(-AI_LOG_LIMIT);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    },
    clear() {
      if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    },
  };
}
