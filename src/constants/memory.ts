import { FIFTEEN_SECONDS_MS } from './time';

export const MEMORY_CACHE_LIMITS = {
  maxStorageEnvelopeEntries: 150,
  maxStorageEntryBytes: 120_000,
} as const;

export const REQUEST_DEDUPE_LIMITS = {
  maxResultCacheEntries: 300,
} as const;

export const MEMORY_DIAGNOSTICS = {
  refreshIntervalMs: FIFTEEN_SECONDS_MS,
} as const;

