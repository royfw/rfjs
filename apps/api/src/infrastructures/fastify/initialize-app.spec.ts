import { describe, it, expect, vi } from 'vitest';
import { initializeFastifyApp } from './initialize-app';

describe('initializeFastifyApp graceful shutdown wiring', () => {
  it('runs the provided onClose callback when the app closes', async () => {
    const onClose = vi.fn().mockResolvedValue(undefined);
    const app = await initializeFastifyApp({ isApiDocEnabled: false, onClose });
    await app.ready();
    await app.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes cleanly when no onClose callback is provided', async () => {
    const app = await initializeFastifyApp({ isApiDocEnabled: false });
    await app.ready();
    await expect(app.close()).resolves.toBeUndefined();
  });
});
