import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getAdminCacheKey, readAdminCache, writeAdminCache } from '../adminCache';

describe('adminCache', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes and reads payload', () => {
    const key = getAdminCacheKey(['admin', 'users']);
    writeAdminCache(key, [{ id: 'u1' }]);

    const cached = readAdminCache<Array<{ id: string }>>(key, 60_000);
    expect(cached).toEqual([{ id: 'u1' }]);
  });

  it('expires payload by ttl', () => {
    const key = getAdminCacheKey(['admin', 'users']);
    writeAdminCache(key, [{ id: 'u1' }]);

    vi.advanceTimersByTime(61_000);
    const cached = readAdminCache<Array<{ id: string }>>(key, 60_000);
    expect(cached).toBeUndefined();
  });

  it('hydrates configured date fields', () => {
    const key = getAdminCacheKey(['admin', 'notifications']);
    writeAdminCache(key, [{ id: 'n1', createdAt: new Date('2026-02-24T12:00:00.000Z') }]);

    const cached = readAdminCache<Array<{ id: string; createdAt: Date }>>(key, 60_000, ['createdAt']);
    expect(cached?.[0]?.createdAt instanceof Date).toBe(true);
  });

  it('drops invalid json payloads safely', () => {
    const key = getAdminCacheKey(['admin', 'broken']);
    window.sessionStorage.setItem(`admin_cache_${key}`, '{bad json');

    const cached = readAdminCache(key, 60_000);
    expect(cached).toBeUndefined();
  });
});

