type CacheStorageType = 'session' | 'local';

type ReadCacheOptions<T, R = T> = {
  storage: CacheStorageType;
  key: string;
  ttlMs: number;
  onError?: (error: unknown, kind: string, metadata?: Record<string, unknown>) => void;
  kindPrefix?: string;
  sanitize?: (value: unknown) => T;
  hydrate?: (value: T) => R;
};

type WriteCacheOptions<T> = {
  storage: CacheStorageType;
  key: string;
  data: T;
  onError?: (error: unknown, kind: string, metadata?: Record<string, unknown>) => void;
  kindPrefix?: string;
};

type CacheEnvelope<T> = {
  timestamp: number;
  data: T;
};

const getStorage = (storage: CacheStorageType): Storage | null => {
  if (typeof window === 'undefined') return null;
  return storage === 'local' ? window.localStorage : window.sessionStorage;
};

const asEnvelope = <T>(value: unknown): CacheEnvelope<T> | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { timestamp?: unknown; data?: unknown };
  if (typeof candidate.timestamp !== 'number') return null;
  return {
    timestamp: candidate.timestamp,
    data: candidate.data as T,
  };
};

export const readCacheWithTtl = <T, R = T>(options: ReadCacheOptions<T, R>): R | null => {
  const storage = getStorage(options.storage);
  if (!storage) return null;

  try {
    const raw = storage.getItem(options.key);
    if (!raw) return null;

    const parsed = asEnvelope<T>(JSON.parse(raw));
    if (!parsed) {
      storage.removeItem(options.key);
      return null;
    }

    if (!parsed.timestamp || Date.now() - parsed.timestamp > options.ttlMs) {
      storage.removeItem(options.key);
      return null;
    }

    const sanitized = options.sanitize ? options.sanitize(parsed.data) : parsed.data;
    return options.hydrate ? options.hydrate(sanitized) : (sanitized as unknown as R);
  } catch (error) {
    try {
      storage.removeItem(options.key);
    } catch {
      // no-op
    }
    options.onError?.(
      error,
      `${options.kindPrefix || 'cache'}.read`,
      { key: options.key, storage: options.storage }
    );
    return null;
  }
};

export const writeCache = <T>(options: WriteCacheOptions<T>): void => {
  const storage = getStorage(options.storage);
  if (!storage) return;

  try {
    const payload: CacheEnvelope<T> = {
      timestamp: Date.now(),
      data: options.data,
    };
    storage.setItem(options.key, JSON.stringify(payload));
  } catch (error) {
    options.onError?.(
      error,
      `${options.kindPrefix || 'cache'}.write`,
      { key: options.key, storage: options.storage }
    );
  }
};

type MigrateCacheOptions<T> = {
  from: CacheStorageType;
  to: CacheStorageType;
  key: string;
  onError?: (error: unknown, kind: string, metadata?: Record<string, unknown>) => void;
  kindPrefix?: string;
  transform?: (data: T) => T;
};

export const migrateCacheIfNeeded = <T>(options: MigrateCacheOptions<T>) => {
  const fromStorage = getStorage(options.from);
  const toStorage = getStorage(options.to);
  if (!fromStorage || !toStorage) return;

  try {
    const raw = fromStorage.getItem(options.key);
    if (!raw) return;
    const parsed = asEnvelope<T>(JSON.parse(raw));
    if (!parsed) {
      fromStorage.removeItem(options.key);
      return;
    }

    let targetTimestamp = 0;
    const existingRaw = toStorage.getItem(options.key);
    if (existingRaw) {
      const existing = asEnvelope<T>(JSON.parse(existingRaw));
      targetTimestamp = existing?.timestamp || 0;
    }
    if (parsed.timestamp > targetTimestamp) {
      const transformedData = options.transform ? options.transform(parsed.data) : parsed.data;
      toStorage.setItem(
        options.key,
        JSON.stringify({
          timestamp: parsed.timestamp,
          data: transformedData,
        })
      );
    }
    fromStorage.removeItem(options.key);
  } catch (error) {
    options.onError?.(
      error,
      `${options.kindPrefix || 'cache'}.migrate`,
      { key: options.key, from: options.from, to: options.to }
    );
  }
};
