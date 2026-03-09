import { useEffect, useMemo, useState } from 'react';
import { MEMORY_DIAGNOSTICS } from '../../constants/memory';
import { queryClient } from '../../contexts/QueryContext';
import { usePendingOfflineMutations } from '../../hooks/usePendingOfflineMutations';
import { getDedupedRequestCacheStats } from '../../utils/requestDedupe';

type MemorySnapshot = {
  sampledAt: number;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  localStorageKb: number;
  sessionStorageKb: number;
  queryCount: number;
  dedupeCacheCount: number;
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
    localStorageKb: typeof window !== 'undefined' ? Number((estimateStorageBytes(window.localStorage) / 1024).toFixed(1)) : 0,
    sessionStorageKb: typeof window !== 'undefined' ? Number((estimateStorageBytes(window.sessionStorage) / 1024).toFixed(1)) : 0,
    queryCount,
    dedupeCacheCount: dedupeStats.resultCacheCount,
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

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-blue-900">Runtime Memory Diagnostics</h3>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">Live</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
        <div>
          <p className="text-blue-700">JS Heap</p>
          <p className="font-semibold text-blue-900">{heapLabel}</p>
        </div>
        <div>
          <p className="text-blue-700">React Queries</p>
          <p className="font-semibold text-blue-900">{snapshot.queryCount}</p>
        </div>
        <div>
          <p className="text-blue-700">Deduped Cache</p>
          <p className="font-semibold text-blue-900">{snapshot.dedupeCacheCount}</p>
        </div>
        <div>
          <p className="text-blue-700">Pending Outbox</p>
          <p className="font-semibold text-blue-900">{pendingCount}</p>
        </div>
        <div>
          <p className="text-blue-700">Local Storage</p>
          <p className="font-semibold text-blue-900">{snapshot.localStorageKb} KB</p>
        </div>
        <div>
          <p className="text-blue-700">Session Storage</p>
          <p className="font-semibold text-blue-900">{snapshot.sessionStorageKb} KB</p>
        </div>
        <div>
          <p className="text-blue-700">Updated</p>
          <p className="font-semibold text-blue-900">{new Date(snapshot.sampledAt).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};

export default MemoryDiagnosticsCard;
