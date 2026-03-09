import { REQUEST_DEDUPE_LIMITS } from '../constants/memory';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const inFlightRequests = new Map<string, Promise<unknown>>();
const resultCache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_ENTRIES = REQUEST_DEDUPE_LIMITS.maxResultCacheEntries;

const cleanupExpiredCache = (now: number) => {
  for (const [key, entry] of resultCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      resultCache.delete(key);
    }
  }
};

export const runDedupedRequest = async <T>(
  key: string,
  factory: () => Promise<T>,
  cacheTtlMs: number = 0,
): Promise<T> => {
  if (!key || typeof key !== 'string') {
    return factory();
  }

  const now = Date.now();
  if (cacheTtlMs > 0) {
    cleanupExpiredCache(now);
    const cached = resultCache.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      // Refresh ordering so older inactive entries are evicted first.
      resultCache.delete(key);
      resultCache.set(key, cached);
      return cached.value;
    }
  }

  const inFlight = inFlightRequests.get(key) as Promise<T> | undefined;
  if (inFlight) return inFlight;

  const request = factory()
    .then((value) => {
      if (cacheTtlMs > 0) {
        if (resultCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = resultCache.keys().next().value;
          if (oldestKey) resultCache.delete(oldestKey);
        }
        resultCache.set(key, {
          value,
          expiresAt: Date.now() + cacheTtlMs,
        });
      }
      return value;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
};

export const clearDedupedRequestCache = (prefix?: string) => {
  if (!prefix) {
    resultCache.clear();
    return;
  }
  for (const key of resultCache.keys()) {
    if (key.startsWith(prefix)) {
      resultCache.delete(key);
    }
  }
};

export const getDedupedRequestCacheStats = () => ({
  inFlightCount: inFlightRequests.size,
  resultCacheCount: resultCache.size,
  maxResultCacheEntries: MAX_CACHE_ENTRIES,
});
