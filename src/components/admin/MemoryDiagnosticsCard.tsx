import { useEffect, useMemo, useState } from 'react';
import { MEMORY_DIAGNOSTICS } from '../../constants/memory';
import { queryClient } from '../../contexts/QueryContext';
import { usePendingOfflineMutations } from '../../hooks/usePendingOfflineMutations';
import { getDedupedRequestCacheStats } from '../../utils/requestDedupe';

type MemorySnapshot = {
  sampledAt: number;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  heapUsagePct: number | null;
  localStorageKb: number;
  sessionStorageKb: number;
  queryCount: number;
  dedupeCacheCount: number;
  inFlightRequests: number;
  online: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  urlPath: string;
};

const estimateStorageBytes = (storage: Storage): number => {
  let total = 0;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      const value = storage.getItem(key) || '';
      total += (key.length + value.length) * 2;
    }
  } catch {
    return 0;
  }
  return total;
};

const collectMemorySnapshot = (): MemorySnapshot => {
  const performanceMemory = (typeof performance !== 'undefined'
    ? (performance as Performance & {
        memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number };
      }).memory
    : undefined);

  const usedBytes = Number(performanceMemory?.usedJSHeapSize || 0);
  const limitBytes = Number(performanceMemory?.jsHeapSizeLimit || 0);
  const queryCount = queryClient.getQueryCache().getAll().length;
  const dedupeStats = getDedupedRequestCacheStats();

  return {
    sampledAt: Date.now(),
    heapUsedMb: usedBytes > 0 ? Number((usedBytes / (1024 * 1024)).toFixed(1)) : null,
    heapLimitMb: limitBytes > 0 ? Number((limitBytes / (1024 * 1024)).toFixed(1)) : null,
    heapUsagePct: usedBytes > 0 && limitBytes > 0 ? Number(((usedBytes / limitBytes) * 100).toFixed(1)) : null,
    localStorageKb: typeof window !== 'undefined' ? Number((estimateStorageBytes(window.localStorage) / 1024).toFixed(1)) : 0,
    sessionStorageKb: typeof window !== 'undefined' ? Number((estimateStorageBytes(window.sessionStorage) / 1024).toFixed(1)) : 0,
    queryCount,
    dedupeCacheCount: dedupeStats.resultCacheCount,
    inFlightRequests: dedupeStats.inFlightCount,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    deviceMemoryGb: typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0) || null : null,
    hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || null : null,
    urlPath: typeof window !== 'undefined' ? window.location.pathname : '/',
  };
};

const MemoryDiagnosticsCard = () => {
  const { pendingCount } = usePendingOfflineMutations();
  const [snapshot, setSnapshot] = useState<MemorySnapshot>(() => collectMemorySnapshot());

  useEffect(() => {
    const refresh = () => setSnapshot(collectMemorySnapshot());
    refresh();
    const timer = window.setInterval(refresh, MEMORY_DIAGNOSTICS.refreshIntervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const heapLabel = useMemo(() => {
    if (snapshot.heapUsedMb === null) return 'Unavailable';
    if (snapshot.heapLimitMb === null) return `${snapshot.heapUsedMb} MB`;
    return `${snapshot.heapUsedMb} / ${snapshot.heapLimitMb} MB`;
  }, [snapshot.heapLimitMb, snapshot.heapUsedMb]);

  const sampledAtLabel = useMemo(() => new Date(snapshot.sampledAt).toLocaleString(), [snapshot.sampledAt]);

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200">Runtime Memory Diagnostics</h3>
          <p className="text-xs text-blue-700 dark:text-blue-300">Live runtime, storage, request-cache, and device signals.</p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">Live</span>
          <p className="text-xs font-medium text-blue-800 dark:text-blue-200">{sampledAtLabel}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 xl:grid-cols-5">
        <div><p className="text-blue-700 dark:text-blue-300">JS Heap</p><p className="font-semibold text-blue-900 dark:text-blue-100">{heapLabel}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Heap Use</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.heapUsagePct === null ? 'Unavailable' : `${snapshot.heapUsagePct}%`}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">React Queries</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.queryCount}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Deduped Cache</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.dedupeCacheCount}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">In-flight Requests</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.inFlightRequests}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Pending Outbox</p><p className="font-semibold text-blue-900 dark:text-blue-100">{pendingCount}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Local Storage</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.localStorageKb} KB</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Session Storage</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.sessionStorageKb} KB</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Network</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.online ? 'Online' : 'Offline'}</p></div>
        <div><p className="text-blue-700 dark:text-blue-300">Device</p><p className="font-semibold text-blue-900 dark:text-blue-100">{snapshot.deviceMemoryGb ? `${snapshot.deviceMemoryGb} GB / ${snapshot.hardwareConcurrency || '-'} cores` : `${snapshot.hardwareConcurrency || '-'} cores`}</p></div>
      </div>
      <div className="mt-3 rounded-xl border border-blue-200/70 bg-white/70 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-slate-900/80 dark:text-blue-100">
        <span className="font-semibold">Route:</span> {snapshot.urlPath}
      </div>
    </div>
  );
};

export default MemoryDiagnosticsCard;
