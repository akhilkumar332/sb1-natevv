import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { OFFLINE_QUERY_CACHE } from '../constants/offlineQueryCache';

type QueryCacheEnvelope = {
  schemaVersion: number;
  savedAt: number;
  appVersion: string;
  state: DehydratedState;
};

const hasWindow = () => typeof window !== 'undefined';

const toRootKey = (queryKey: QueryKey): string => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return '';
  return typeof queryKey[0] === 'string' ? queryKey[0] : '';
};

const isPublicCmsQuery = (queryKey: QueryKey): boolean => {
  const root = toRootKey(queryKey);
  if (!OFFLINE_QUERY_CACHE.allowedRootKeys.includes(root as (typeof OFFLINE_QUERY_CACHE.allowedRootKeys)[number])) {
    return false;
  }
  if (queryKey[0] !== 'cms' || queryKey[1] !== 'public') return false;
  const leaf = typeof queryKey[2] === 'string' ? queryKey[2] : '';
  return (
    leaf === 'settings'
    || leaf === 'blogPosts'
    || leaf === 'blogPostBySlug'
    || leaf === 'blogPostsPage'
    || leaf === 'pageBySlug'
    || leaf === 'menuByLocation'
  );
};

const isPayloadWithinLimit = (query: Query): boolean => {
  try {
    const data = query.state.data;
    if (typeof data === 'undefined') return true;
    const serialized = JSON.stringify(data);
    if (typeof serialized !== 'string') return true;
    return serialized.length <= OFFLINE_QUERY_CACHE.maxQueryDataChars;
  } catch {
    return false;
  }
};

const canPersistQuery = (query: Query): boolean => (
  query.state.status === 'success'
  && !query.meta?.doNotPersist
  && isPublicCmsQuery(query.queryKey)
  && isPayloadWithinLimit(query)
);

const readEnvelope = (): QueryCacheEnvelope | null => {
  if (!hasWindow()) return null;
  const clearInvalidPayload = () => {
    try {
      window.localStorage.removeItem(OFFLINE_QUERY_CACHE.storageKey);
    } catch {
      // ignore cleanup failures
    }
  };
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUERY_CACHE.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QueryCacheEnvelope;
    if (
      !parsed
      || parsed.schemaVersion !== OFFLINE_QUERY_CACHE.schemaVersion
      || !Number.isFinite(parsed.savedAt)
      || typeof parsed.appVersion !== 'string'
      || !parsed.state
    ) {
      clearInvalidPayload();
      return null;
    }
    return parsed;
  } catch {
    clearInvalidPayload();
    return null;
  }
};

const writeEnvelope = (envelope: QueryCacheEnvelope): void => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(OFFLINE_QUERY_CACHE.storageKey, JSON.stringify(envelope));
  } catch {
    // Ignore quota/storage errors; runtime cache still works.
  }
};

const removeEnvelope = (): void => {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(OFFLINE_QUERY_CACHE.storageKey);
  } catch {
    // ignore cleanup failures
  }
};

const getCurrentAppVersion = (): string => {
  if (!hasWindow()) return 'unknown';
  try {
    return window.localStorage.getItem(OFFLINE_QUERY_CACHE.appVersionStorageKey) || 'unknown';
  } catch {
    return 'unknown';
  }
};

const isEnvelopeExpired = (savedAt: number): boolean => (
  Date.now() - savedAt > OFFLINE_QUERY_CACHE.maxAgeMs
);

export const restorePersistedQueryCache = (queryClient: QueryClient): boolean => {
  const envelope = readEnvelope();
  if (!envelope) return false;
  if (isEnvelopeExpired(envelope.savedAt)) {
    removeEnvelope();
    return false;
  }
  const currentVersion = getCurrentAppVersion();
  if (envelope.appVersion !== currentVersion) {
    removeEnvelope();
    return false;
  }
  try {
    hydrate(queryClient, envelope.state);
    return true;
  } catch {
    removeEnvelope();
    return false;
  }
};

const persistQueryCacheNow = (queryClient: QueryClient): void => {
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: canPersistQuery,
  });
  if (!Array.isArray(state.queries) || state.queries.length === 0) {
    return;
  }
  writeEnvelope({
    schemaVersion: OFFLINE_QUERY_CACHE.schemaVersion,
    savedAt: Date.now(),
    appVersion: getCurrentAppVersion(),
    state,
  });
};

export const installQueryCachePersistence = (queryClient: QueryClient): (() => void) => {
  if (!hasWindow()) return () => {};

  let timer: number | null = null;
  const schedulePersist = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      persistQueryCacheNow(queryClient);
    }, OFFLINE_QUERY_CACHE.persistDebounceMs);
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!event?.query) return;
    if (!canPersistQuery(event.query)) return;
    schedulePersist();
  });

  const flushPersist = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    persistQueryCacheNow(queryClient);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushPersist();
  };
  const onBeforeUnload = () => flushPersist();

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
};

export const clearPersistedQueryCache = (): void => {
  removeEnvelope();
};
