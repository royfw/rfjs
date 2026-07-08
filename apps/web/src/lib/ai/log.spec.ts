import { beforeEach, describe, expect, it } from 'vitest';

import { AI_LOG_LIMIT, createAiLog, type AiAssistEntry } from './log';

const KEY = 'rfjs.ai.log.test-tool';

function entry(n: number): AiAssistEntry {
  return { id: `id-${n}`, kind: 'ask', prompt: `q${n}`, answer: `a${n}`, at: `2026-07-08T00:00:${String(n % 60).padStart(2, '0')}.000Z` };
}

beforeEach(() => localStorage.clear());

describe('createAiLog', () => {
  it('list/append/clear 往返(chronological,append 回傳新列表)', () => {
    const log = createAiLog(KEY);
    expect(log.list()).toEqual([]);
    const after1 = log.append(entry(1));
    expect(after1).toHaveLength(1);
    log.append(entry(2));
    expect(log.list().map((e) => e.id)).toEqual(['id-1', 'id-2']);
    log.clear();
    expect(log.list()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it(`超過 AI_LOG_LIMIT(${AI_LOG_LIMIT})裁掉最舊`, () => {
    const log = createAiLog(KEY);
    for (let i = 0; i < AI_LOG_LIMIT + 3; i++) log.append(entry(i));
    const list = log.list();
    expect(list).toHaveLength(AI_LOG_LIMIT);
    expect(list[0]?.id).toBe('id-3'); // 0,1,2 被裁
  });

  it('損毀 JSON → 空陣列;非陣列 → 空陣列', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createAiLog(KEY).list()).toEqual([]);
    localStorage.setItem(KEY, '{"a":1}');
    expect(createAiLog(KEY).list()).toEqual([]);
  });

  it('不同 key 互不干擾', () => {
    const a = createAiLog('rfjs.ai.log.a');
    const b = createAiLog('rfjs.ai.log.b');
    a.append(entry(1));
    expect(b.list()).toEqual([]);
  });

  it('過濾形狀不合法的項目(缺 id / kind 非法)', () => {
    localStorage.setItem(KEY, JSON.stringify([entry(1), { kind: 'ask' }, { id: 'x', kind: 'nope' }]));
    expect(createAiLog(KEY).list().map((e) => e.id)).toEqual(['id-1']);
  });
});
