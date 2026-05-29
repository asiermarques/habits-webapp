import { describe, it, expect, vi, afterEach } from 'vitest';
import { API_CACHE_NAME, clearApiCache } from '../cache';

describe('clearApiCache', () => {
  afterEach(() => {
    // @ts-expect-error – tidy the global we stubbed
    delete globalThis.caches;
  });

  it('deletes the runtime API cache by name', async () => {
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { delete: del } as unknown as CacheStorage);

    await clearApiCache();

    expect(del).toHaveBeenCalledWith(API_CACHE_NAME);
  });

  it('is a no-op when the Cache Storage API is unavailable', async () => {
    vi.stubGlobal('caches', undefined as unknown as CacheStorage);
    await expect(clearApiCache()).resolves.toBeUndefined();
  });
});
