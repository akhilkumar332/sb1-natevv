import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMORY_CACHE_LIMITS } from '../../constants/memory';
import { readCacheWithTtl, writeCache } from '../cacheLifecycle';

describe('cacheLifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('writes and reads cache envelopes with ttl', () => {
    writeCache({
      storage: 'session',
      key: 'cache:test:one',
      data: { ok: true },
      kindPrefix: 'cache.test',
    });

    const value = readCacheWithTtl<{ ok: boolean }>({
      storage: 'session',
      key: 'cache:test:one',
      ttlMs: 60_000,
      kindPrefix: 'cache.test',
    });

    expect(value).toEqual({ ok: true });
  });

  it('skips oversize cache writes safely', () => {
    const onError = vi.fn();
    const oversizeChars = Math.ceil(MEMORY_CACHE_LIMITS.maxStorageEntryBytes / 2) + 10_000;
    writeCache({
      storage: 'local',
      key: 'cache:test:oversize',
      data: { payload: 'x'.repeat(oversizeChars) },
      kindPrefix: 'cache.test',
      onError,
    });

    expect(localStorage.getItem('cache:test:oversize')).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0]?.[1] || '')).toContain('write_skipped_oversize');
  });

  it('prunes oldest envelope entries when cache envelope limit is reached', () => {
    const max = MEMORY_CACHE_LIMITS.maxStorageEnvelopeEntries;
    for (let i = 0; i < max + 1; i += 1) {
      writeCache({
        storage: 'local',
        key: `cache:test:entry:${i}`,
        data: { index: i },
        kindPrefix: 'cache.test',
      });
    }

    expect(localStorage.getItem('cache:test:entry:0')).toBeNull();
    expect(localStorage.getItem(`cache:test:entry:${max}`)).toBeTruthy();
  });

  it('never prunes unrelated envelope-like entries', () => {
    localStorage.setItem('unrelated:envelope', JSON.stringify({
      timestamp: Date.now() - 1_000_000,
      data: { external: true },
    }));

    const max = MEMORY_CACHE_LIMITS.maxStorageEnvelopeEntries;
    for (let i = 0; i < max + 1; i += 1) {
      writeCache({
        storage: 'local',
        key: `cache:test:managed:${i}`,
        data: { index: i },
        kindPrefix: 'cache.test',
      });
    }

    expect(localStorage.getItem('unrelated:envelope')).toBeTruthy();
    expect(localStorage.getItem('cache:test:managed:0')).toBeNull();
  });
});
