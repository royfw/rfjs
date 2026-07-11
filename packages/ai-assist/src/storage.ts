/** 可注入的 key-value 儲存縫線 —— 讓 settings/log 脫離 window，核心得以 isomorphic。 */
export interface AiStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** 設定響應式訂閱用（同分頁 + 跨分頁）；回傳取消訂閱。非瀏覽器可省略。 */
  subscribe?(callback: () => void): () => void;
}

/** 同分頁存/清時派送（storage 事件只跨分頁，同分頁不觸發）。 */
const AI_STORAGE_EVENT = 'rfjs:ai-storage';

/** 預設 adapter：localStorage + 同分頁自訂事件 + 跨分頁 storage 事件。SSR 安全（window 守衛）。 */
export function createBrowserStorage(): AiStorage {
  const notify = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AI_STORAGE_EVENT));
  };
  return {
    get: (key) =>
      typeof window === 'undefined' ? null : window.localStorage.getItem(key),
    set: (key, value) => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      notify();
    },
    remove: (key) => {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
      notify();
    },
    subscribe: (callback) => {
      if (typeof window === 'undefined') return () => {};
      const onStorage = () => callback();
      window.addEventListener(AI_STORAGE_EVENT, callback);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(AI_STORAGE_EVENT, callback);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
