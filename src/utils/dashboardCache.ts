import { readCacheWithTtl, writeCache } from './cacheLifecycle';

type StorageType = 'session' | 'local';

type ReportFn = (error: unknown, kind: string) => void;

type ReadDashboardCacheOptions<T, R = T> = {
  storage: StorageType;
  key: string;
  ttlMs: number;
  kindPrefix: string;
  reportError: ReportFn;
  reportKind: string;
  sanitize?: (value: unknown) => T;
  hydrate?: (value: T) => R;
};

type WriteDashboardCacheOptions<T> = {
  storage: StorageType;
  key: string;
  data: T;
  kindPrefix: string;
  reportError: ReportFn;
  reportKind: string;
};

export const readDashboardCache = <T, R = T>(
  options: ReadDashboardCacheOptions<T, R>
): R | null => {
  return readCacheWithTtl<T, R>({
    storage: options.storage,
    key: options.key,
    ttlMs: options.ttlMs,
    kindPrefix: options.kindPrefix,
    sanitize: options.sanitize,
    hydrate: options.hydrate,
    onError: (error) => options.reportError(error, options.reportKind),
  });
};

export const writeDashboardCache = <T>(options: WriteDashboardCacheOptions<T>): void => {
  writeCache({
    storage: options.storage,
    key: options.key,
    data: options.data,
    kindPrefix: options.kindPrefix,
    onError: (error) => options.reportError(error, options.reportKind),
  });
};

