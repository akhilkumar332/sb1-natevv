import { HOUR_MS } from './time';

export const OFFLINE_QUERY_CACHE = {
  storageKey: 'bh_query_cache_v1',
  schemaVersion: 1,
  maxAgeMs: 6 * HOUR_MS,
  persistDebounceMs: 1200,
  // Protect localStorage quota by skipping very large query payloads.
  maxQueryDataChars: 80_000,
  appVersionStorageKey: 'bh_app_version',
  // Restrict persisted query keys to public CMS reads to avoid storing sensitive/private datasets.
  allowedRootKeys: ['cms'] as const,
} as const;
