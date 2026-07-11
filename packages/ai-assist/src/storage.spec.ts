import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrowserStorage } from './storage';

describe('createBrowserStorage', () => {
  beforeEach(() => localStorage.clear());

  it('get/set/remove round-trips through localStorage', () => {
    const s = createBrowserStorage();
    expect(s.get('k')).toBeNull();
    s.set('k', 'v');
    expect(s.get('k')).toBe('v');
    expect(localStorage.getItem('k')).toBe('v');
    s.remove('k');
    expect(s.get('k')).toBeNull();
  });

  it('subscribe fires on same-tab set/remove and stops after unsubscribe', () => {
    const s = createBrowserStorage();
    const cb = vi.fn();
    const unsub = s.subscribe!(cb);
    s.set('k', 'v');
    expect(cb).toHaveBeenCalledTimes(1);
    s.remove('k');
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    s.set('k', 'v2');
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
