import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, DatabaseZap, RefreshCw, WifiOff } from 'lucide-react';
import OfflineSyncHealthCard from '../../../components/admin/OfflineSyncHealthCard';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import AdminPagination from '../../../components/admin/AdminPagination';
import { useOfflineMutationTelemetry } from '../../../hooks/useOfflineMutationTelemetry';
import { useOfflineMutationDeadLetters } from '../../../hooks/useOfflineMutationDeadLetters';
import { usePendingOfflineMutations } from '../../../hooks/usePendingOfflineMutations';
import { useNetworkStatus } from '../../../contexts/NetworkStatusContext';
import { OFFLINE_ANALYTICS_WINDOWS, OFFLINE_HEALTH_THRESHOLDS, OFFLINE_MUTATION_LABELS } from '../../../constants/offline';
import {
  getOfflineWriteCoverageSummary,
  getOfflineWriteExpansionTargets,
  OFFLINE_WRITE_COVERAGE_CATALOG,
} from '../../../constants/offlineWriteCoverage';
import { HOUR_MS, MINUTE_MS } from '../../../constants/time';

type WindowKey = '1h' | '6h' | '24h' | '7d';

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string; ms: number }> = [
  { key: '1h', label: '1H', ms: OFFLINE_ANALYTICS_WINDOWS.oneHour },
  { key: '6h', label: '6H', ms: OFFLINE_ANALYTICS_WINDOWS.sixHours },
  { key: '24h', label: '24H', ms: OFFLINE_ANALYTICS_WINDOWS.oneDay },
  { key: '7d', label: '7D', ms: OFFLINE_ANALYTICS_WINDOWS.sevenDays },
];

const formatAgo = (value: number | null) => {
  if (!value) return 'N/A';
  const diff = Math.max(0, Date.now() - value);
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  return `${Math.floor(diff / HOUR_MS)}h ago`;
};

const toPercent = (value: number) => `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
const toBarHeight = (value: number, max: number) => {
  if (value <= 0 || max <= 0) return '0%';
  return `${Math.max(6, (value / max) * 100)}%`;
};
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
const getLocalStorageUsage = () => {
  if (typeof window === 'undefined') {
    return { totalBytes: 0, offlineBytes: 0 };
  }
  try {
    let totalBytes = 0;
    let offlineBytes = 0;
    const { localStorage } = window;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || '';
      const bytes = (key.length + value.length) * 2;
      totalBytes += bytes;
      if (key.startsWith('bh_offline_')) {
        offlineBytes += bytes;
      }
    }
    return { totalBytes, offlineBytes };
  } catch {
    return { totalBytes: 0, offlineBytes: 0 };
  }
};
const formatRefreshAgo = (value: number | null, now: number) => {
  if (!value) return 'never';
  const diff = Math.max(0, now - value);
  if (diff < MINUTE_MS) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  return `${Math.floor(diff / HOUR_MS)}h ago`;
};

function AdminOfflineSyncHealthPage() {
  const [windowKey, setWindowKey] = useState<WindowKey>('24h');
  const [refreshing, setRefreshing] = useState(false);
  const [deadLetterPage, setDeadLetterPage] = useState(1);
  const [deadLetterPageSize, setDeadLetterPageSize] = useState(10);
  const [enqueuePage, setEnqueuePage] = useState(1);
  const [enqueuePageSize, setEnqueuePageSize] = useState(8);
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(10);
  const [expansionPage, setExpansionPage] = useState(1);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(Date.now());
  const [refreshNowTs, setRefreshNowTs] = useState(Date.now());
  const { telemetry } = useOfflineMutationTelemetry();
  const { entries: deadLetters } = useOfflineMutationDeadLetters();
  const { pendingItems, syncing, syncNow } = usePendingOfflineMutations();
  const { isOnline, persistenceStatus } = useNetworkStatus();

  const selectedWindow = WINDOW_OPTIONS.find((option) => option.key === windowKey) || WINDOW_OPTIONS[2];
  const coverage = useMemo(() => getOfflineWriteCoverageSummary(), []);
  const expansionTargets = useMemo(
    () => getOfflineWriteExpansionTargets(OFFLINE_WRITE_COVERAGE_CATALOG.length),
    [],
  );
  const expansionPageSize = 5;
  const cutoff = Date.now() - selectedWindow.ms;
  const filteredEvents = useMemo(
    () => telemetry.recentEvents.filter((event) => event.at >= cutoff),
    [telemetry.recentEvents, cutoff],
  );

  const flushCompleteEvents = filteredEvents.filter((event) => event.kind === 'flush_complete');
  const filteredDeadLetters = deadLetters.filter((entry) => entry.failedAt >= cutoff);
  const filteredEnqueueByType = useMemo(() => {
    return filteredEvents.reduce<Record<string, number>>((acc, event) => {
      if (event.kind !== 'enqueue') return acc;
      const key = event.mutationType || event.message || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [filteredEvents]);
  const successRate = telemetry.flushedProcessed > 0
    ? (telemetry.flushedSucceeded / telemetry.flushedProcessed) * 100
    : 0;
  const failureRate = telemetry.flushedProcessed > 0
    ? (telemetry.flushedFailed / telemetry.flushedProcessed) * 100
    : 0;
  const healthPersistTotal = telemetry.healthPersistSucceeded + telemetry.healthPersistFailed;
  const healthPersistSuccessRate = healthPersistTotal > 0
    ? (telemetry.healthPersistSucceeded / healthPersistTotal) * 100
    : 0;
  const firestoreStorageHardened = persistenceStatus === 'enabled' && (healthPersistTotal === 0 || healthPersistSuccessRate >= 99);
  const localStorageUsage = useMemo(
    () => getLocalStorageUsage(),
    [telemetry.pendingCount, telemetry.recentEvents.length, telemetry.healthPersistRuns, deadLetters.length],
  );
  const avgAttempts = pendingItems.length > 0
    ? pendingItems.reduce((acc, item) => acc + item.attempts, 0) / pendingItems.length
    : 0;
  const oldestQueuedMs = pendingItems.length > 0
    ? Math.max(0, Date.now() - Math.min(...pendingItems.map((item) => item.createdAt)))
    : 0;
  const queueRisk = telemetry.pendingCount >= OFFLINE_HEALTH_THRESHOLDS.queueCountCritical
    ? 'critical'
    : telemetry.pendingCount >= OFFLINE_HEALTH_THRESHOLDS.queueCountWarning
      ? 'warning'
      : 'healthy';
  const deadLetterRisk = deadLetters.length >= OFFLINE_HEALTH_THRESHOLDS.deadLetterCritical
    ? 'critical'
    : deadLetters.length >= OFFLINE_HEALTH_THRESHOLDS.deadLetterWarning
      ? 'warning'
      : 'healthy';

  const trendBuckets = useMemo(() => {
    const bucketCount = 8;
    const bucketMs = Math.max(1, Math.floor(selectedWindow.ms / bucketCount));
    const start = Date.now() - selectedWindow.ms;
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      label: `${index + 1}`,
      enqueue: 0,
      flush: 0,
      error: 0,
    }));
    filteredEvents.forEach((event) => {
      const index = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((event.at - start) / bucketMs)),
      );
      if (event.kind === 'enqueue') buckets[index].enqueue += 1;
      if (event.kind === 'flush_complete') buckets[index].flush += 1;
      if (event.kind === 'flush_error') buckets[index].error += 1;
    });
    return buckets;
  }, [filteredEvents, selectedWindow.ms]);

  const trendMax = Math.max(
    1,
    ...trendBuckets.map((bucket) => Math.max(bucket.enqueue, bucket.flush, bucket.error)),
  );

  const handleRefresh = async () => {
    if (refreshing || syncing) return;
    setRefreshing(true);
    try {
      await syncNow();
    } finally {
      setLastRefreshedAt(Date.now());
      setRefreshing(false);
    }
  };

  const enqueueRows = useMemo(
    () => Object.entries(filteredEnqueueByType).sort((a, b) => b[1] - a[1]),
    [filteredEnqueueByType],
  );

  const pagedDeadLetters = useMemo(() => {
    const start = (deadLetterPage - 1) * deadLetterPageSize;
    return filteredDeadLetters.slice(start, start + deadLetterPageSize);
  }, [filteredDeadLetters, deadLetterPage, deadLetterPageSize]);

  const pagedEnqueueRows = useMemo(() => {
    const start = (enqueuePage - 1) * enqueuePageSize;
    return enqueueRows.slice(start, start + enqueuePageSize);
  }, [enqueueRows, enqueuePage, enqueuePageSize]);

  const pagedMatrixRows = useMemo(() => {
    const start = (matrixPage - 1) * matrixPageSize;
    return OFFLINE_WRITE_COVERAGE_CATALOG.slice(start, start + matrixPageSize);
  }, [matrixPage, matrixPageSize]);

  const pagedExpansionTargets = useMemo(() => {
    const start = (expansionPage - 1) * expansionPageSize;
    return expansionTargets.slice(start, start + expansionPageSize);
  }, [expansionTargets, expansionPage, expansionPageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredDeadLetters.length / deadLetterPageSize));
    if (deadLetterPage > maxPage) setDeadLetterPage(maxPage);
  }, [filteredDeadLetters.length, deadLetterPageSize, deadLetterPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(enqueueRows.length / enqueuePageSize));
    if (enqueuePage > maxPage) setEnqueuePage(maxPage);
  }, [enqueueRows.length, enqueuePageSize, enqueuePage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(OFFLINE_WRITE_COVERAGE_CATALOG.length / matrixPageSize));
    if (matrixPage > maxPage) setMatrixPage(maxPage);
  }, [matrixPageSize, matrixPage, OFFLINE_WRITE_COVERAGE_CATALOG.length]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(expansionTargets.length / expansionPageSize));
    if (expansionPage > maxPage) setExpansionPage(maxPage);
  }, [expansionTargets.length, expansionPage, expansionPageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const timer = window.setInterval(() => {
      if (!navigator.onLine) return;
      if (document.visibilityState !== 'visible') return;
      if (refreshing || syncing) return;
      void (async () => {
        await syncNow();
        setLastRefreshedAt(Date.now());
      })();
    }, 15000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshing, syncing, syncNow]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const tick = window.setInterval(() => {
      setRefreshNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(tick);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-red-600 dark:text-red-300">System</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">Offline Sync Health</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Full diagnostics for queue depth, flush throughput, failures, and dead-letter reliability.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setWindowKey(option.key)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  windowKey === option.key
                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-400/50 dark:bg-red-500/15 dark:text-red-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
            <AdminRefreshButton
              onClick={() => { void handleRefresh(); }}
              isRefreshing={refreshing || syncing}
              label="Refresh offline sync metrics"
            />
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Last refreshed: {formatRefreshAgo(lastRefreshedAt, refreshNowTs)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Queue Depth</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{telemetry.pendingCount}</p>
          <p className={`mt-1 text-xs font-semibold ${queueRisk === 'critical' ? 'text-rose-700' : queueRisk === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {queueRisk.toUpperCase()}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Success Rate</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{toPercent(successRate)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Failure {toPercent(failureRate)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Dead Letter</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{deadLetters.length}</p>
          <p className={`mt-1 text-xs font-semibold ${deadLetterRisk === 'critical' ? 'text-rose-700' : deadLetterRisk === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {deadLetterRisk.toUpperCase()}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Last Flush</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{formatAgo(telemetry.lastFlushAt)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {isOnline ? 'Online' : 'Offline'} • {persistenceStatus}
          </p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${
          firestoreStorageHardened
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
            : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
        }`}
        >
          <p className={`text-xs uppercase tracking-[0.15em] ${
            firestoreStorageHardened ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}
          >
            Offline Sync Health Firestore storage hardened
          </p>
          <p className={`mt-1 text-xl font-bold ${
            firestoreStorageHardened ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'
          }`}
          >
            {firestoreStorageHardened ? 'Hardened' : 'Needs Attention'}
          </p>
          <p className={`mt-1 text-xs ${
            firestoreStorageHardened ? 'text-emerald-700/90 dark:text-emerald-300/90' : 'text-amber-700/90 dark:text-amber-300/90'
          }`}
          >
            Persist success {toPercent(healthPersistSuccessRate)} • runs {telemetry.healthPersistRuns}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-sky-700 dark:text-sky-300">Local Storage Used</p>
          <p className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-200">{formatBytes(localStorageUsage.totalBytes)}</p>
          <p className="mt-1 text-xs text-sky-700/90 dark:text-sky-300/90">
            Offline share {formatBytes(localStorageUsage.offlineBytes)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-blue-700 dark:text-blue-300">Coverage</p>
          <p className="mt-1 text-2xl font-bold text-blue-800 dark:text-blue-200">{toPercent(coverage.queueCoveragePercent)}</p>
          <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/90">Queue-safe share</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Project Ops</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{coverage.total}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-indigo-700 dark:text-indigo-300">Cataloged</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700 dark:text-indigo-300">{coverage.cataloged}</p>
          <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-300/90">{toPercent(coverage.catalogedCoveragePercent)} mapped</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">Queue-safe</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{coverage.queueSafe}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">Online-only</p>
          <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{coverage.onlineOnly}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/60">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-700 dark:text-slate-300">Persistence-backed</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-200">{coverage.persistenceBacked}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Event Trend ({selectedWindow.label})</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-blue-500" /> Enqueue</span>
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Flush</span>
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-rose-500" /> Error</span>
            </div>
          </div>
          <div className="grid grid-cols-8 items-end gap-2">
            {trendBuckets.map((bucket, index) => (
              <div key={`${bucket.label}-${index}`} className="space-y-1">
                <div className="flex h-28 items-end justify-center gap-0.5">
                  <span
                    className="w-2 rounded-t bg-blue-500"
                    style={{ height: toBarHeight(bucket.enqueue, trendMax) }}
                    title={`Enqueue: ${bucket.enqueue}`}
                  />
                  <span
                    className="w-2 rounded-t bg-emerald-500"
                    style={{ height: toBarHeight(bucket.flush, trendMax) }}
                    title={`Flush: ${bucket.flush}`}
                  />
                  <span
                    className="w-2 rounded-t bg-rose-500"
                    style={{ height: toBarHeight(bucket.error, trendMax) }}
                    title={`Error: ${bucket.error}`}
                  />
                </div>
                <p className="text-center text-[11px] text-gray-500 dark:text-slate-400">{bucket.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-slate-300 sm:grid-cols-4">
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
              Events: <span className="font-semibold">{filteredEvents.length}</span>
            </p>
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
              Flush complete: <span className="font-semibold">{flushCompleteEvents.length}</span>
            </p>
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
              Avg attempts: <span className="font-semibold">{avgAttempts.toFixed(1)}</span>
            </p>
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
              Oldest queued: <span className="font-semibold">{oldestQueuedMs > 0 ? `${Math.floor(oldestQueuedMs / MINUTE_MS)}m` : '0m'}</span>
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Runtime Status</h2>
          <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2">{isOnline ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />} Network</span>
              <span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-blue-600" /> Persistence</span>
              <span className="font-semibold uppercase">{persistenceStatus}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-gray-500" /> Last enqueue</span>
              <span className="font-semibold">{formatAgo(telemetry.lastEnqueueAt)}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 text-gray-500" /> Last flush</span>
              <span className="font-semibold">{formatAgo(telemetry.lastFlushAt)}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> Last failure</span>
              <span className="font-semibold">{formatAgo(telemetry.lastFailureAt)}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-indigo-600" /> Firestore persist runs</span>
              <span className="font-semibold">{telemetry.healthPersistRuns}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-emerald-600" /> Persist success rate</span>
              <span className="font-semibold">{toPercent(healthPersistSuccessRate)}</span>
            </p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-gray-500" /> Last persisted</span>
              <span className="font-semibold">{formatAgo(telemetry.lastHealthPersistAt)}</span>
            </p>
          </div>
          {telemetry.lastHealthPersistRecordId ? (
            <p className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 break-words [overflow-wrap:anywhere] dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
              Record: {telemetry.lastHealthPersistRecordId}
            </p>
          ) : null}
          {telemetry.lastHealthPersistError ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 break-words [overflow-wrap:anywhere] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              Persist error: {telemetry.lastHealthPersistError}
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Queue By Mutation Type</h2>
          <div className="space-y-2">
            {Object.entries(telemetry.pendingByType || {}).length ? Object.entries(telemetry.pendingByType || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-slate-700">
                <span className="text-gray-700 dark:text-slate-300">{OFFLINE_MUTATION_LABELS[type as keyof typeof OFFLINE_MUTATION_LABELS] || type}</span>
                <span className="font-semibold text-gray-900 dark:text-slate-100">{count || 0}</span>
              </div>
            )) : (
              <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                No queued mutations.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
          <h2 className="mb-3 text-lg font-bold text-rose-900 dark:text-rose-200">Dead Letter Queue ({selectedWindow.label})</h2>
          <div className="space-y-2">
            {filteredDeadLetters.length ? pagedDeadLetters.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs dark:border-rose-500/30 dark:bg-slate-900/60">
                <p className="font-semibold text-rose-800 dark:text-rose-200">
                  {OFFLINE_MUTATION_LABELS[entry.type] || entry.type} • {entry.reason}
                </p>
                <p className="mt-1 text-rose-700 dark:text-rose-300">
                  attempts={entry.attempts} • {new Date(entry.failedAt).toLocaleString()}
                </p>
                {entry.message ? <p className="mt-1 text-rose-700/90 dark:text-rose-300/90">{entry.message}</p> : null}
              </div>
            )) : (
              <p className="rounded-lg border border-rose-200 bg-white px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-slate-900/60 dark:text-rose-300">
                No dead-letter entries in this window.
              </p>
            )}
          </div>
          {filteredDeadLetters.length > 0 && (
            <div className="mt-3">
              <AdminPagination
                page={deadLetterPage}
                pageSize={deadLetterPageSize}
                pageSizeOptions={[10, 25, 50]}
                itemCount={filteredDeadLetters.length}
                hasNextPage={deadLetterPage * deadLetterPageSize < filteredDeadLetters.length}
                onPageChange={setDeadLetterPage}
                onPageSizeChange={(next) => {
                  setDeadLetterPageSize(next);
                  setDeadLetterPage(1);
                }}
              />
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Enqueue Activity By Mutation ({selectedWindow.label})</h2>
          <div className="space-y-2">
            {enqueueRows.length ? pagedEnqueueRows
              .map(([type, count]) => (
                <p key={type} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-slate-700">
                  <span className="text-gray-700 dark:text-slate-300">{OFFLINE_MUTATION_LABELS[type as keyof typeof OFFLINE_MUTATION_LABELS] || type}</span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">{count}</span>
                </p>
              )) : (
                <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                  No enqueue events in this time window.
                </p>
              )}
          </div>
          {enqueueRows.length > 0 && (
            <div className="mt-3">
              <AdminPagination
                page={enqueuePage}
                pageSize={enqueuePageSize}
                pageSizeOptions={[8, 16, 32]}
                itemCount={enqueueRows.length}
                hasNextPage={enqueuePage * enqueuePageSize < enqueueRows.length}
                onPageChange={setEnqueuePage}
                onPageSizeChange={(next) => {
                  setEnqueuePageSize(next);
                  setEnqueuePage(1);
                }}
              />
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Expansion Targets</h2>
          <div className="space-y-2">
            {pagedExpansionTargets.length ? pagedExpansionTargets.map((entry) => (
              <div key={entry.id} className="min-w-0 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                <p className="font-semibold text-gray-900 break-words [overflow-wrap:anywhere] dark:text-slate-100">{entry.id}</p>
                <p className="text-xs text-gray-600 break-words [overflow-wrap:anywhere] dark:text-slate-300">{entry.module} • {entry.area}</p>
                <p className="mt-1 break-words text-[11px] uppercase tracking-[0.12em] text-amber-700 [overflow-wrap:anywhere] dark:text-amber-300">{entry.mode.replace('_', ' ')}</p>
              </div>
            )) : (
              <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                No expansion targets pending.
              </p>
            )}
          </div>
          {expansionTargets.length > 0 && (
            <div className="mt-3">
              <AdminPagination
                page={expansionPage}
                pageSize={expansionPageSize}
                pageSizeOptions={[5]}
                itemCount={expansionTargets.length}
                hasNextPage={expansionPage * expansionPageSize < expansionTargets.length}
                onPageChange={setExpansionPage}
                onPageSizeChange={(next) => { void next; }}
              />
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Project Offline Capability Matrix</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-[0.12em] text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">Mode</th>
              </tr>
            </thead>
            <tbody>
              {pagedMatrixRows.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-semibold text-gray-900 dark:text-slate-100">{entry.id}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{entry.module}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{entry.area}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      entry.mode === 'queue_safe'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : entry.mode === 'online_only'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                    >
                      {entry.mode.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {OFFLINE_WRITE_COVERAGE_CATALOG.length > 0 && (
          <div className="mt-3">
            <AdminPagination
              page={matrixPage}
              pageSize={matrixPageSize}
              pageSizeOptions={[10, 25, 50]}
              itemCount={OFFLINE_WRITE_COVERAGE_CATALOG.length}
              hasNextPage={matrixPage * matrixPageSize < OFFLINE_WRITE_COVERAGE_CATALOG.length}
              onPageChange={setMatrixPage}
              onPageSizeChange={(next) => {
                setMatrixPageSize(next);
                setMatrixPage(1);
              }}
            />
          </div>
        )}
      </section>

      <OfflineSyncHealthCard />
    </div>
  );
}

export default AdminOfflineSyncHealthPage;
