'use client';

import * as React from 'react';

import { createAiClient } from './client';
import { isConfigured, loadAiSettings } from './settings';
import { AiError, type CompleteRequest } from './types';

export interface UseAiAssist {
  ready: boolean;
  loading: boolean;
  error: AiError | null;
  cancel: () => void;
  run<T>(req: Omit<CompleteRequest, 'signal'>, parse: (raw: string) => T): Promise<T | null>;
}

export function useAiAssist(): UseAiAssist {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<AiError | null>(null);
  const ctlRef = React.useRef<AbortController | null>(null);
  // settings 每次呼叫時讀(設定 dialog 存檔後,下一次 run 即用新值)。
  const ready = isConfigured(typeof window === 'undefined' ? null : loadAiSettings());

  const cancel = React.useCallback(() => {
    ctlRef.current?.abort();
  }, []);

  const run = React.useCallback(async <T,>(req: Omit<CompleteRequest, 'signal'>, parse: (raw: string) => T): Promise<T | null> => {
    const settings = loadAiSettings();
    if (!isConfigured(settings)) {
      setError(new AiError('config', 'AI connection is not configured'));
      return null;
    }
    ctlRef.current?.abort(); // 新 run 取消前一個
    const ctl = new AbortController();
    ctlRef.current = ctl;
    setLoading(true);
    setError(null);
    try {
      const raw = await createAiClient(settings).complete({ ...req, signal: ctl.signal });
      try {
        return parse(raw);
      } catch (e) {
        setError(new AiError('parse', e instanceof Error ? e.message : String(e), raw));
        return null;
      }
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('http', String(e));
      if (err.kind !== 'abort') setError(err); // 使用者取消不是錯誤
      return null;
    } finally {
      if (ctlRef.current === ctl) ctlRef.current = null;
      setLoading(false);
    }
  }, []);

  return { ready, loading, error, cancel, run };
}
