type CachePayload<T> = {
  savedAt: number;
  data: T;
};

const ADMIN_CACHE_PREFIX = 'admin_cache_';
const adminCacheStore = new Map<string, string>();

const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const isBrowser = () => typeof window !== 'undefined';

const toStorageKey = (key: string) => `${ADMIN_CACHE_PREFIX}${key}`;

const hydrateDateFields = (value: unknown, dateFields: string[]): unknown => {
  if (!value || dateFields.length === 0) return value;
  if (Array.isArray(value)) return value.map((item) => hydrateDateFields(item, dateFields));
  if (typeof value !== 'object') return value;

  const mutable = { ...(value as Record<string, unknown>) };
  Object.keys(mutable).forEach((field) => {
    const fieldValue = mutable[field];
    if (typeof fieldValue === 'string' && dateFields.includes(field) && isoDateRegex.test(fieldValue)) {
      mutable[field] = new Date(fieldValue);
      return;
    }
    if (fieldValue && typeof fieldValue === 'object') {
      mutable[field] = hydrateDateFields(fieldValue, dateFields);
    }
  });
  return mutable;
};

export const getAdminCacheKey = (queryKey: readonly unknown[]) => JSON.stringify(queryKey);

export const readAdminCache = <T>(
  key: string,
  ttlMs: number,
  dateFields: string[] = [],
): T | undefined => {
  if (!isBrowser()) return undefined;

  try {
    const raw = adminCacheStore.get(toStorageKey(key));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as CachePayload<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      adminCacheStore.delete(toStorageKey(key));
      return undefined;
    }

    return hydrateDateFields(parsed.data, dateFields) as T;
  } catch (error) {
    adminCacheStore.delete(toStorageKey(key));
    return undefined;
  }
};

export const writeAdminCache = <T>(key: string, data: T): void => {
  if (!isBrowser()) return;
  try {
    const payload: CachePayload<T> = {
      savedAt: Date.now(),
      data,
    };
    adminCacheStore.set(toStorageKey(key), JSON.stringify(payload));
  } catch (error) {
    // Ignore cache write failures to keep data flow resilient.
  }
};


export const clearAdminCache = (predicate?: (key: string) => boolean): void => {
  if (!isBrowser()) return;
  try {
    const keysToDelete: string[] = [];
    for (const storageKey of adminCacheStore.keys()) {
      if (!storageKey.startsWith(ADMIN_CACHE_PREFIX)) continue;
      const rawKey = storageKey.slice(ADMIN_CACHE_PREFIX.length);
      if (!predicate || predicate(rawKey)) keysToDelete.push(storageKey);
    }
    keysToDelete.forEach((storageKey) => adminCacheStore.delete(storageKey));
  } catch (error) {
    // Ignore cache clear failures to keep admin flows resilient.
  }
};

export const __setAdminCacheRawForTest = (key: string, raw: string): void => {
  adminCacheStore.set(toStorageKey(key), raw);
};
