import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_DEDUPE_LIMITS } from '../../constants/memory';
import {
  clearDedupedRequestCache,
  getDedupedRequestCacheStats,
  runDedupedRequest,
} from '../requestDedupe';

describe('requestDedupe', () => {
  beforeEach(() => {
    clearDedupedRequestCache();
  });

  it('returns cached values for identical keys during ttl', async () => {
    const factory = vi.fn(async () => ({ ok: true }));

    const first = await runDedupedRequest('dedupe:test:one', factory, 60_000);
    const second = await runDedupedRequest('dedupe:test:one', factory, 60_000);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('keeps recently used cache entries via LRU refresh on read', async () => {
    const max = REQUEST_DEDUPE_LIMITS.maxResultCacheEntries;
    const ttl = 60_000;

    for (let i = 1; i <= max; i += 1) {
      await runDedupedRequest(`dedupe:lru:${i}`, async () => i, ttl);
    }

    // Refresh key 1 so it should not be evicted next.
    const refreshFactory = vi.fn(async () => 999);
    const refreshed = await runDedupedRequest('dedupe:lru:1', refreshFactory, ttl);
    expect(refreshed).toBe(1);
    expect(refreshFactory).toHaveBeenCalledTimes(0);

    // Trigger one eviction.
    await runDedupedRequest('dedupe:lru:new', async () => 1000, ttl);

    const key2Factory = vi.fn(async () => 2000);
    const key1Factory = vi.fn(async () => 3000);
    const key2Value = await runDedupedRequest('dedupe:lru:2', key2Factory, ttl);
    const key1Value = await runDedupedRequest('dedupe:lru:1', key1Factory, ttl);

    expect(key2Value).toBe(2000);
    expect(key1Value).toBe(1);
    expect(key2Factory).toHaveBeenCalledTimes(1);
    expect(key1Factory).toHaveBeenCalledTimes(0);
  });

  it('exposes cache stats for diagnostics', async () => {
    await runDedupedRequest('dedupe:stats:one', async () => 1, 60_000);
    const stats = getDedupedRequestCacheStats();
    expect(stats.maxResultCacheEntries).toBe(REQUEST_DEDUPE_LIMITS.maxResultCacheEntries);
    expect(stats.resultCacheCount).toBeGreaterThanOrEqual(1);
  });
});

