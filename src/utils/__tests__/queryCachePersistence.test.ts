import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { OFFLINE_QUERY_CACHE } from '../../constants/offlineQueryCache';
import {
  clearPersistedQueryCache,
  installQueryCachePersistence,
  restorePersistedQueryCache,
} from '../queryCachePersistence';

describe('queryCachePersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('persists only allowed public cms queries', async () => {
    const queryClient = new QueryClient();
    localStorage.setItem(OFFLINE_QUERY_CACHE.appVersionStorageKey, 'v1');
    const teardown = installQueryCachePersistence(queryClient);

    queryClient.setQueryData(['cms', 'public', 'settings'], { siteTitle: 'BloodHub' });
    queryClient.setQueryData(['users', 'list'], [{ id: 'u1' }]);
    await vi.advanceTimersByTimeAsync(OFFLINE_QUERY_CACHE.persistDebounceMs + 20);

    const raw = localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw || '{}');
    const serialized = JSON.stringify(parsed);
    expect(serialized).toContain('"cms"');
    expect(serialized).not.toContain('"users"');

    teardown();
  });

  it('restores persisted query cache when version matches', async () => {
    const writerClient = new QueryClient();
    localStorage.setItem(OFFLINE_QUERY_CACHE.appVersionStorageKey, 'v2');
    const teardown = installQueryCachePersistence(writerClient);
    writerClient.setQueryData(['cms', 'public', 'settings'], { siteTitle: 'BloodHub India' });
    await vi.advanceTimersByTimeAsync(OFFLINE_QUERY_CACHE.persistDebounceMs + 20);
    teardown();

    const readerClient = new QueryClient();
    const restored = restorePersistedQueryCache(readerClient);
    expect(restored).toBe(true);
    expect(readerClient.getQueryData(['cms', 'public', 'settings'])).toEqual({ siteTitle: 'BloodHub India' });
  });

  it('invalidates cache on app version mismatch', async () => {
    const writerClient = new QueryClient();
    localStorage.setItem(OFFLINE_QUERY_CACHE.appVersionStorageKey, 'v10');
    const teardown = installQueryCachePersistence(writerClient);
    writerClient.setQueryData(['cms', 'public', 'settings'], { siteTitle: 'BloodHub India' });
    await vi.advanceTimersByTimeAsync(OFFLINE_QUERY_CACHE.persistDebounceMs + 20);
    teardown();

    localStorage.setItem(OFFLINE_QUERY_CACHE.appVersionStorageKey, 'v11');
    const nextClient = new QueryClient();
    const restored = restorePersistedQueryCache(nextClient);
    expect(restored).toBe(false);
    expect(localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey)).toBeNull();
  });

  it('clearPersistedQueryCache removes persisted payload', () => {
    localStorage.setItem(OFFLINE_QUERY_CACHE.storageKey, '{"ok":true}');
    clearPersistedQueryCache();
    expect(localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey)).toBeNull();
  });

  it('cleans up invalid persisted payloads during restore', () => {
    localStorage.setItem(OFFLINE_QUERY_CACHE.storageKey, '{invalid-json');
    const queryClient = new QueryClient();
    const restored = restorePersistedQueryCache(queryClient);
    expect(restored).toBe(false);
    expect(localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey)).toBeNull();
  });

  it('skips oversized query payloads to avoid localStorage quota pressure', async () => {
    const queryClient = new QueryClient();
    localStorage.setItem(OFFLINE_QUERY_CACHE.appVersionStorageKey, 'v1');
    const teardown = installQueryCachePersistence(queryClient);

    queryClient.setQueryData(
      ['cms', 'public', 'blogPostBySlug', 'very-large'],
      { content: 'x'.repeat(OFFLINE_QUERY_CACHE.maxQueryDataChars + 5000) }
    );
    await vi.advanceTimersByTimeAsync(OFFLINE_QUERY_CACHE.persistDebounceMs + 20);

    const raw = localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey);
    expect(raw).toBeNull();

    teardown();
  });

  it('does not overwrite existing persisted cache with empty state on unload flush', async () => {
    const writerClient = new QueryClient();
    localStorage.setItem(OFFLINE_QUERY_CACHE.appVersionStorageKey, 'v1');
    const teardownWriter = installQueryCachePersistence(writerClient);
    writerClient.setQueryData(['cms', 'public', 'settings'], { siteTitle: 'BloodHub India' });
    await vi.advanceTimersByTimeAsync(OFFLINE_QUERY_CACHE.persistDebounceMs + 20);
    teardownWriter();

    const before = localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey);
    expect(before).toBeTruthy();

    const emptyClient = new QueryClient();
    const teardownEmpty = installQueryCachePersistence(emptyClient);
    window.dispatchEvent(new Event('beforeunload'));
    teardownEmpty();

    const after = localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey);
    expect(after).toEqual(before);
  });
});
