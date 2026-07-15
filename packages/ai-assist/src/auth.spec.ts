import { describe, expect, it } from 'vitest';

import { apiKeyAuth, noAuth } from './auth';

describe('AuthStrategy', () => {
  it('apiKeyAuth emits a Bearer header (even for empty key, preserving byok behavior)', async () => {
    expect(await apiKeyAuth('sk-t').authHeaders()).toEqual({
      Authorization: 'Bearer sk-t',
    });
    expect(apiKeyAuth('sk-t').kind).toBe('apiKey');
    expect(await apiKeyAuth('').authHeaders()).toEqual({
      Authorization: 'Bearer ',
    });
  });

  it('noAuth emits no headers', async () => {
    expect(await noAuth().authHeaders()).toEqual({});
    expect(noAuth().kind).toBe('none');
  });
});
