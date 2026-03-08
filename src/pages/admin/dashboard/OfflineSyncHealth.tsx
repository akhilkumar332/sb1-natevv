import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, DatabaseZap, RefreshCw, WifiOff } from 'lucide-react';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import AdminPagination from '../../../components/admin/AdminPagination';
import { useOfflineMutationTelemetry } from '../../../hooks/useOfflineMutationTelemetry';
import { useOfflineMutationDeadLetters } from '../../../hooks/useOfflineMutationDeadLetters';
import { usePendingOfflineMutations } from '../../../hooks/usePendingOfflineMutations';
import { useNetworkStatus } from '../../../contexts/NetworkStatusContext';
import {
  OFFLINE_ANALYTICS_WINDOWS,
  OFFLINE_FEATURE_OPERATOR_LABELS,
  OFFLINE_HEALTH_THRESHOLDS,
  OFFLINE_MUTATION_LABELS,
} from '../../../constants/offline';
import {
  getOfflineWriteCoverageSummary,
  getOfflineWriteExpansionTargets,
  OFFLINE_WRITE_COVERAGE_CATALOG,
} from '../../../constants/offlineWriteCoverage';
import { captureHandledError } from '../../../services/errorLog.service';
import { HOUR_MS, MINUTE_MS } from '../../../constants/time';

type WindowKey = '1h' | '6h' | '24h' | '7d';
type ViewMode = 'basic' | 'advanced';

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string; ms: number }> = [
  { key: '1h', label: '1H', ms: OFFLINE_ANALYTICS_WINDOWS.oneHour },
  { key: '6h', label: '6H', ms: OFFLINE_ANALYTICS_WINDOWS.sixHours },
  { key: '24h', label: '24H', ms: OFFLINE_ANALYTICS_WINDOWS.oneDay },
  { key: '7d', label: '7D', ms: OFFLINE_ANALYTICS_WINDOWS.sevenDays },
];

const VIEW_MODE_STORAGE_KEY = 'bh_offline_sync_health_view_mode_v1';
const ALERT_ACK_KEY = 'bh_offline_sync_health_alert_ack_v1';

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

const parseStoredNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const downloadBlob = (blob: Blob, filename: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
};

const isNavigatorOnline = () => (
  typeof navigator === 'undefined' ? true : navigator.onLine
);

const isDocumentVisible = () => (
  typeof document === 'undefined' ? true : document.visibilityState === 'visible'
);

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const readViewMode = (): ViewMode => {
  if (typeof window === 'undefined') return 'basic';
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return raw === 'advanced' ? 'advanced' : 'basic';
  } catch {
    return 'basic';
  }
};

function AdminOfflineSyncHealthPage() {
  const [windowKey, setWindowKey] = useState<WindowKey>('24h');
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [refreshing, setRefreshing] = useState(false);
  const [deadLetterPage, setDeadLetterPage] = useState(1);
  const [deadLetterPageSize, setDeadLetterPageSize] = useState(10);
  const [enqueuePage, setEnqueuePage] = useState(1);
  const [enqueuePageSize, setEnqueuePageSize] = useState(8);
  const [queueTypePage, setQueueTypePage] = useState(1);
  const [queueTypePageSize, setQueueTypePageSize] = useState(8);
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(10);
  const [expansionPage, setExpansionPage] = useState(1);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(Date.now());
  const [refreshNowTs, setRefreshNowTs] = useState(Date.now());
  const [storageProbeTick, setStorageProbeTick] = useState(0);
  const [actionableOnly, setActionableOnly] = useState(false);
  const [acknowledgedFailureAt, setAcknowledgedFailureAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return parseStoredNumber(window.localStorage.getItem(ALERT_ACK_KEY));
    } catch {
      return null;
    }
  });
  const mountedRef = useRef(true);
  const failedItemsRef = useRef<HTMLElement | null>(null);
  const runtimeRef = useRef<HTMLElement | null>(null);
  const { telemetry } = useOfflineMutationTelemetry();
  const { entries: deadLetters } = useOfflineMutationDeadLetters();
  const { pendingItems, syncing, syncNow } = usePendingOfflineMutations();
  const { isOnline, persistenceStatus } = useNetworkStatus();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore storage write failures (private mode / restricted browsers)
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (acknowledgedFailureAt == null) {
        window.localStorage.removeItem(ALERT_ACK_KEY);
      } else {
        window.localStorage.setItem(ALERT_ACK_KEY, String(acknowledgedFailureAt));
      }
    } catch {
      // ignore
    }
  }, [acknowledgedFailureAt]);

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
  const flushDurations = flushCompleteEvents
    .map((event) => (typeof event.durationMs === 'number' ? event.durationMs : null))
    .filter((value): value is number => value != null && value >= 0);
  const filteredDeadLetters = deadLetters.filter((entry) => entry.failedAt >= cutoff);
  const actionableDeadLetters = filteredDeadLetters.filter((entry) => (
    entry.reason === 'fatal_write_error'
    || entry.attempts >= 3
    || ['permission', 'validation', 'rule', 'internal'].includes(entry.failureClass || 'unknown')
  ));
  const visibleDeadLetters = actionableOnly ? actionableDeadLetters : filteredDeadLetters;
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
  const healthPersistWindowTotal = (telemetry.healthPersistWindowSucceeded || 0) + (telemetry.healthPersistWindowFailed || 0);
  const healthPersistTotal = telemetry.healthPersistSucceeded + telemetry.healthPersistFailed;
  const effectiveHealthPersistTotal = healthPersistWindowTotal > 0 ? healthPersistWindowTotal : healthPersistTotal;
  const effectiveHealthPersistSucceeded = healthPersistWindowTotal > 0
    ? (telemetry.healthPersistWindowSucceeded || 0)
    : telemetry.healthPersistSucceeded;
  const healthPersistSuccessRate = effectiveHealthPersistTotal > 0
    ? (effectiveHealthPersistSucceeded / effectiveHealthPersistTotal) * 100
    : 0;
  const firestoreStorageHardened = persistenceStatus === 'enabled' && (effectiveHealthPersistTotal === 0 || healthPersistSuccessRate >= 99);

  const localStorageUsage = useMemo(
    () => getLocalStorageUsage(),
    [storageProbeTick],
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

  const flushP50 = percentile(flushDurations, 50);
  const flushP95 = percentile(flushDurations, 95);
  const pendingRetryBuckets = pendingItems.reduce(
    (acc, item) => {
      if (item.attempts <= 0) acc.zero += 1;
      else if (item.attempts <= 2) acc.oneToTwo += 1;
      else if (item.attempts <= 5) acc.threeToFive += 1;
      else acc.sixPlus += 1;
      return acc;
    },
    { zero: 0, oneToTwo: 0, threeToFive: 0, sixPlus: 0 },
  );

  const deadLetterAging = filteredDeadLetters.reduce(
    (acc, entry) => {
      const ageMs = Date.now() - entry.failedAt;
      if (ageMs < HOUR_MS) acc.lt1h += 1;
      else if (ageMs < HOUR_MS * 24) acc.oneTo24h += 1;
      else acc.gt24h += 1;
      return acc;
    },
    { lt1h: 0, oneTo24h: 0, gt24h: 0 },
  );
  const topFailingMutations = filteredDeadLetters.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topFailingRows = Object.entries(topFailingMutations).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const projectedDrainMinutes = (() => {
    const completed = flushCompleteEvents
      .filter((event) => typeof event.durationMs === 'number' && event.durationMs > 0)
      .map((event) => ({
        succeeded: Math.max(0, Number(event.succeeded || 0)),
        durationMs: Number(event.durationMs || 0),
      }))
      .filter((entry) => entry.succeeded > 0);
    const totalSucceeded = completed.reduce((acc, item) => acc + item.succeeded, 0);
    const totalMinutes = completed.reduce((acc, item) => acc + (item.durationMs / MINUTE_MS), 0);
    if (totalSucceeded <= 0 || totalMinutes <= 0 || telemetry.pendingCount <= 0) return null;
    const throughputPerMinute = totalSucceeded / totalMinutes;
    if (throughputPerMinute <= 0) return null;
    return telemetry.pendingCount / throughputPerMinute;
  })();

  const queueGrowthPerHour = (() => {
    const enqueued = filteredEvents.filter((event) => event.kind === 'enqueue').length;
    const completed = flushCompleteEvents.reduce((acc, event) => acc + Math.max(0, Number(event.succeeded || 0)), 0);
    const net = enqueued - completed;
    const hours = Math.max(1 / 60, selectedWindow.ms / HOUR_MS);
    return net / hours;
  })();

  const failureBurstCount = filteredEvents.filter(
    (event) => event.kind === 'flush_error' && event.at >= Date.now() - (15 * MINUTE_MS),
  ).length;

  const retryBudgetBurn = flushCompleteEvents.reduce(
    (acc, event) => {
      acc.processed += Math.max(0, Number(event.processed || 0));
      acc.failed += Math.max(0, Number(event.failed || 0));
      return acc;
    },
    { processed: 0, failed: 0 },
  );
  const retryBudgetBurnRate = retryBudgetBurn.processed > 0
    ? (retryBudgetBurn.failed / retryBudgetBurn.processed) * 100
    : 0;

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
    let refreshSucceeded = false;
    try {
      await syncNow();
      refreshSucceeded = true;
    } catch (error) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'unknown',
        metadata: {
          kind: 'offline_sync_health.manual_refresh',
        },
      });
    } finally {
      if (mountedRef.current) {
        if (refreshSucceeded) {
          setStorageProbeTick((tick) => tick + 1);
          setLastRefreshedAt(Date.now());
        }
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const enqueueRows = useMemo(
    () => Object.entries(filteredEnqueueByType).sort((a, b) => b[1] - a[1]),
    [filteredEnqueueByType],
  );

  const queueTypeRows = useMemo(
    () => Object.entries(telemetry.pendingByType || {}).sort((a, b) => b[1] - a[1]),
    [telemetry.pendingByType],
  );

  const pagedDeadLetters = useMemo(() => {
    const start = (deadLetterPage - 1) * deadLetterPageSize;
    return visibleDeadLetters.slice(start, start + deadLetterPageSize);
  }, [visibleDeadLetters, deadLetterPage, deadLetterPageSize]);

  const pagedEnqueueRows = useMemo(() => {
    const start = (enqueuePage - 1) * enqueuePageSize;
    return enqueueRows.slice(start, start + enqueuePageSize);
  }, [enqueueRows, enqueuePage, enqueuePageSize]);

  const pagedQueueTypeRows = useMemo(() => {
    const start = (queueTypePage - 1) * queueTypePageSize;
    return queueTypeRows.slice(start, start + queueTypePageSize);
  }, [queueTypeRows, queueTypePage, queueTypePageSize]);

  const pagedMatrixRows = useMemo(() => {
    const start = (matrixPage - 1) * matrixPageSize;
    return OFFLINE_WRITE_COVERAGE_CATALOG.slice(start, start + matrixPageSize);
  }, [matrixPage, matrixPageSize]);

  const pagedExpansionTargets = useMemo(() => {
    const start = (expansionPage - 1) * expansionPageSize;
    return expansionTargets.slice(start, start + expansionPageSize);
  }, [expansionTargets, expansionPage, expansionPageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(visibleDeadLetters.length / deadLetterPageSize));
    if (deadLetterPage > maxPage) setDeadLetterPage(maxPage);
  }, [visibleDeadLetters.length, deadLetterPageSize, deadLetterPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(enqueueRows.length / enqueuePageSize));
    if (enqueuePage > maxPage) setEnqueuePage(maxPage);
  }, [enqueueRows.length, enqueuePageSize, enqueuePage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(queueTypeRows.length / queueTypePageSize));
    if (queueTypePage > maxPage) setQueueTypePage(maxPage);
  }, [queueTypeRows.length, queueTypePageSize, queueTypePage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(OFFLINE_WRITE_COVERAGE_CATALOG.length / matrixPageSize));
    if (matrixPage > maxPage) setMatrixPage(maxPage);
  }, [matrixPageSize, matrixPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(expansionTargets.length / expansionPageSize));
    if (expansionPage > maxPage) setExpansionPage(maxPage);
  }, [expansionTargets.length, expansionPage, expansionPageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (!isNavigatorOnline()) return;
      if (!isDocumentVisible()) return;
      if (refreshing || syncing) return;
      if (telemetry.pendingCount === 0) return;
      void (async () => {
        let refreshSucceeded = false;
        try {
          await syncNow();
          refreshSucceeded = true;
        } catch (error) {
          void captureHandledError(error, {
            source: 'frontend',
            scope: 'unknown',
            metadata: {
              kind: 'offline_sync_health.auto_refresh',
            },
          });
        }
        if (!cancelled) {
          if (refreshSucceeded) {
            setStorageProbeTick((tick) => tick + 1);
            setLastRefreshedAt(Date.now());
          }
        }
      })();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshing, syncing, syncNow, telemetry.pendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const tick = window.setInterval(() => {
      if (!isDocumentVisible()) return;
      setRefreshNowTs(Date.now());
    }, 5000);
    return () => {
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const tick = window.setInterval(() => {
      if (!isDocumentVisible()) return;
      setStorageProbeTick((current) => current + 1);
    }, 60000);
    return () => {
      window.clearInterval(tick);
    };
  }, []);

  const systemStatus: 'healthy' | 'warning' | 'critical' = (() => {
    if (!isOnline && telemetry.pendingCount >= OFFLINE_HEALTH_THRESHOLDS.queueCountWarning) return 'critical';
    if (deadLetterRisk === 'critical' || queueRisk === 'critical') return 'critical';
    if (persistenceStatus !== 'enabled') return 'warning';
    if (!firestoreStorageHardened) return 'critical';
    if (deadLetterRisk === 'warning' || queueRisk === 'warning' || telemetry.policyViolationCount > 0) return 'warning';
    return 'healthy';
  })();

  const systemStatusText =
    systemStatus === 'healthy'
      ? 'Healthy: sync is stable and no urgent action is needed.'
      : systemStatus === 'warning'
        ? 'At Risk: sync has warning signals. Review queued and blocked items.'
        : 'Critical: failed or blocked sync items need immediate action.';

  const scrollToSection = (section: 'failed' | 'runtime') => {
    const target = section === 'failed' ? failedItemsRef.current : runtimeRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const primaryAction = (() => {
    if (!isOnline) {
      return {
        label: 'Waiting For Connection',
        description: 'Reconnect to continue syncing queued actions automatically.',
        disabled: true,
        onClick: () => {},
      };
    }
    if (deadLetters.length > 0) {
      return {
        label: 'Review Failed Sync Items',
        description: `${deadLetters.length} item(s) failed and need review.`,
        disabled: false,
        onClick: () => scrollToSection('failed'),
      };
    }
    if (telemetry.pendingCount > 0) {
      return {
        label: 'Sync Now',
        description: `${telemetry.pendingCount} queued action(s) are ready to sync.`,
        disabled: refreshing || syncing,
        onClick: () => {
          void handleRefresh();
        },
      };
    }
    if (telemetry.policyViolationCount > 0) {
      return {
        label: 'Review Blocked Updates',
        description: 'Some updates were blocked by safety policy.',
        disabled: false,
        onClick: () => scrollToSection('runtime'),
      };
    }
    return {
      label: 'No Action Needed',
      description: 'System is stable. Continue normal operations.',
      disabled: true,
      onClick: () => {},
    };
  })();

  const criticalUnacknowledged = (
    systemStatus === 'critical'
    && telemetry.lastFailureAt != null
    && (acknowledgedFailureAt == null || telemetry.lastFailureAt > acknowledgedFailureAt)
  );

  const narrativeSignals = [
    deadLetters.length > 0 ? `${deadLetters.length} failed item(s) require review.` : null,
    telemetry.pendingCount > 0 ? `${telemetry.pendingCount} action(s) are still queued.` : null,
    telemetry.policyViolationCount > 0 ? `${telemetry.policyViolationCount} update(s) were blocked by policy.` : null,
    failureBurstCount > 0 ? `${failureBurstCount} recent error burst(s) in last 15 minutes.` : null,
    !isOnline ? 'Device is offline, so queue drain is paused.' : null,
  ].filter((value): value is string => Boolean(value)).slice(0, 3);

  const narrativeSummary = systemStatus === 'healthy'
    ? 'Sync is healthy. No high-risk indicators are currently active.'
    : systemStatus === 'warning'
      ? 'Sync has warning signals. Review queue growth and blocked/failed items.'
      : 'Sync is critical. Immediate review is needed for failed or blocked writes.';

  const acknowledgeCurrentCritical = () => {
    if (!telemetry.lastFailureAt) return;
    setAcknowledgedFailureAt(telemetry.lastFailureAt);
  };

  const exportFailedItems = (format: 'json' | 'csv') => {
    if (typeof window === 'undefined' || visibleDeadLetters.length === 0) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(visibleDeadLetters, null, 2)], { type: 'application/json;charset=utf-8' });
      downloadBlob(blob, `offline-sync-failed-items-${ts}.json`);
      return;
    }
    const lines = [
      'failedAt,type,feature,reason,failureClass,failureCode,attempts,message',
      ...visibleDeadLetters.map((entry) => [
        new Date(entry.failedAt).toISOString(),
        `"${(OFFLINE_MUTATION_LABELS[entry.type] || entry.type).replace(/"/g, '""')}"`,
        `"${(entry.feature || 'unknown').replace(/"/g, '""')}"`,
        `"${(entry.reason || '').replace(/"/g, '""')}"`,
        `"${(entry.failureClass || 'unknown').replace(/"/g, '""')}"`,
        `"${(entry.failureCode || '').replace(/"/g, '""')}"`,
        entry.attempts,
        `"${(entry.message || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `offline-sync-failed-items-${ts}.csv`);
  };

  const moduleReadinessRows = useMemo(() => {
    const grouped = OFFLINE_WRITE_COVERAGE_CATALOG.reduce<Record<string, { total: number; queueSafe: number; unresolved: number }>>((acc, entry) => {
      const key = entry.module;
      if (!acc[key]) {
        acc[key] = { total: 0, queueSafe: 0, unresolved: 0 };
      }
      acc[key].total += 1;
      if (entry.mode === 'queue_safe') acc[key].queueSafe += 1;
      if (entry.mode === 'online_only' || entry.collectionKey === 'UNKNOWN') acc[key].unresolved += 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([module, value]) => ({
        module,
        total: value.total,
        queueSafe: value.queueSafe,
        unresolved: value.unresolved,
        readiness: value.total > 0 ? (value.queueSafe / value.total) * 100 : 0,
      }))
      .sort((a, b) => b.readiness - a.readiness);
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-red-600 dark:text-red-300">System</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">Offline Sync Health</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Human-friendly sync monitoring with clear status and recommended actions.
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
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs dark:border-slate-600 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('basic')}
                className={`rounded px-2 py-1 font-semibold ${viewMode === 'basic' ? 'bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300'}`}
              >
                Basic
              </button>
              <button
                type="button"
                onClick={() => setViewMode('advanced')}
                className={`rounded px-2 py-1 font-semibold ${viewMode === 'advanced' ? 'bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300'}`}
              >
                Advanced
              </button>
            </div>
            <AdminRefreshButton
              onClick={() => { void handleRefresh(); }}
              isRefreshing={refreshing || syncing}
              label="Refresh offline sync metrics"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          Last refreshed: {formatRefreshAgo(lastRefreshedAt, refreshNowTs)}
        </p>
      </div>

      <section className={`rounded-2xl border p-4 shadow-sm ${
        systemStatus === 'healthy'
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : systemStatus === 'warning'
            ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
            : 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
      }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            System Status: {systemStatus === 'healthy' ? 'Healthy' : systemStatus === 'warning' ? 'At Risk' : 'Critical'}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-700 dark:text-slate-300">{systemStatusText}</p>
            {criticalUnacknowledged ? (
              <button
                type="button"
                onClick={acknowledgeCurrentCritical}
                className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300"
              >
                Acknowledge
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
        <h2 className="text-lg font-bold text-blue-900 dark:text-blue-200">Health Narrative</h2>
        <p className="mt-1 text-sm text-blue-800 dark:text-blue-200/90">{narrativeSummary}</p>
        <div className="mt-3 space-y-1 text-xs text-blue-800 dark:text-blue-200/90">
          {narrativeSignals.length ? narrativeSignals.map((signal) => (
            <p key={signal}>- {signal}</p>
          )) : (
            <p>- No active warning signals in the selected window.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Recommended Action</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{primaryAction.description}</p>
        <button
          type="button"
          disabled={primaryAction.disabled}
          onClick={primaryAction.onClick}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <RefreshCw className="h-4 w-4" />
          {primaryAction.label}
        </button>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Queued Actions</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{telemetry.pendingCount}</p>
          <p className={`mt-1 text-xs font-semibold ${queueRisk === 'critical' ? 'text-rose-700' : queueRisk === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {queueRisk.toUpperCase()}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Actions waiting to be synced</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Sync Success</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{toPercent(successRate)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Failed: {toPercent(failureRate)}</p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Successful sync attempts</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Failed Sync Items</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{deadLetters.length}</p>
          <p className={`mt-1 text-xs font-semibold ${deadLetterRisk === 'critical' ? 'text-rose-700' : deadLetterRisk === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {deadLetterRisk.toUpperCase()}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Items that need manual review</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Last Successful Sync</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{formatAgo(telemetry.lastFlushAt)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{isOnline ? 'Online' : 'Offline'} • {persistenceStatus}</p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Most recent flush completion</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`rounded-2xl border p-4 shadow-sm ${
          firestoreStorageHardened
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
            : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
        }`}
        >
          <p className="text-xs uppercase tracking-[0.15em] text-gray-700 dark:text-slate-300">Firestore Storage Safety</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">{firestoreStorageHardened ? 'Healthy' : 'Needs Attention'}</p>
          <p className="mt-1 text-xs text-gray-700/90 dark:text-slate-300/90">Persist success {toPercent(healthPersistSuccessRate)} • recent runs {effectiveHealthPersistTotal}</p>
          <p className="mt-1 text-[11px] text-gray-600/90 dark:text-slate-400/90">Collection: offlineSyncHealthRecords</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
          <p className="text-xs uppercase tracking-[0.15em] text-sky-700 dark:text-sky-300">Local Storage Used</p>
          <p className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-200">{formatBytes(localStorageUsage.totalBytes)}</p>
          <p className="mt-1 text-xs text-sky-700/90 dark:text-sky-300/90">Offline share {formatBytes(localStorageUsage.offlineBytes)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Sync Activity Trend ({selectedWindow.label})</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-blue-500" /> Queued</span>
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Synced</span>
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-rose-500" /> Errors</span>
            </div>
          </div>
          <div className="grid grid-cols-8 items-end gap-2">
            {trendBuckets.map((bucket, index) => (
              <div key={`${bucket.label}-${index}`} className="space-y-1">
                <div className="flex h-28 items-end justify-center gap-0.5">
                  <span className="w-2 rounded-t bg-blue-500" style={{ height: toBarHeight(bucket.enqueue, trendMax) }} title={`Queued: ${bucket.enqueue}`} />
                  <span className="w-2 rounded-t bg-emerald-500" style={{ height: toBarHeight(bucket.flush, trendMax) }} title={`Synced: ${bucket.flush}`} />
                  <span className="w-2 rounded-t bg-rose-500" style={{ height: toBarHeight(bucket.error, trendMax) }} title={`Errors: ${bucket.error}`} />
                </div>
                <p className="text-center text-[11px] text-gray-500 dark:text-slate-400">{bucket.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-slate-300 sm:grid-cols-4">
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">Events: <span className="font-semibold">{filteredEvents.length}</span></p>
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">Sync runs: <span className="font-semibold">{flushCompleteEvents.length}</span></p>
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">Average retries: <span className="font-semibold">{avgAttempts.toFixed(1)}</span></p>
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">Oldest queued: <span className="font-semibold">{oldestQueuedMs > 0 ? `${Math.floor(oldestQueuedMs / MINUTE_MS)}m` : '0m'}</span></p>
          </div>
        </section>

        <section ref={runtimeRef} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Live System Checks</h2>
          <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2">{isOnline ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />} Network</span><span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span></p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-blue-600" /> Local persistence</span><span className="font-semibold uppercase">{persistenceStatus}</span></p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-gray-500" /> Last queue event</span><span className="font-semibold">{formatAgo(telemetry.lastEnqueueAt)}</span></p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 text-gray-500" /> Last sync</span><span className="font-semibold">{formatAgo(telemetry.lastFlushAt)}</span></p>
            <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> Last failure</span><span className="font-semibold">{formatAgo(telemetry.lastFailureAt)}</span></p>
          </div>
          {telemetry.lastFailureMessage ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 break-words [overflow-wrap:anywhere] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              Last error: {telemetry.lastFailureMessage}
            </p>
          ) : null}
          {telemetry.lastPolicyViolation ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 break-words [overflow-wrap:anywhere] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              Blocked update reason: {telemetry.lastPolicyViolation}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-700 dark:text-slate-300">
            <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">Queue growth rate: <span className={`font-semibold ${queueGrowthPerHour > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{queueGrowthPerHour.toFixed(1)} items/hour</span></p>
            <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">Projected queue drain: <span className="font-semibold">{projectedDrainMinutes == null ? 'N/A' : `${Math.ceil(projectedDrainMinutes)}m`}</span></p>
            <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">Retry budget burn: <span className={`font-semibold ${retryBudgetBurnRate >= 20 ? 'text-rose-700 dark:text-rose-300' : retryBudgetBurnRate >= 10 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{toPercent(retryBudgetBurnRate)}</span></p>
            <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">Failure bursts (15m): <span className={`font-semibold ${failureBurstCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{failureBurstCount}</span></p>
          </div>
        </section>
      </div>

      <section ref={failedItemsRef} className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">Failed Sync Items ({selectedWindow.label})</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActionableOnly((prev) => !prev)}
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                actionableOnly
                  ? 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-400/50 dark:bg-rose-500/20 dark:text-rose-200'
                  : 'border-rose-200 bg-white text-rose-700 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300'
              }`}
            >
              {actionableOnly ? 'Showing actionable' : 'Show actionable only'}
            </button>
            <button
              type="button"
              onClick={() => exportFailedItems('json')}
              disabled={visibleDeadLetters.length === 0}
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => exportFailedItems('csv')}
              disabled={visibleDeadLetters.length === 0}
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {visibleDeadLetters.length ? pagedDeadLetters.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs dark:border-rose-500/30 dark:bg-slate-900/60">
              <p className="font-semibold text-rose-800 dark:text-rose-200">{OFFLINE_MUTATION_LABELS[entry.type] || entry.type} • {entry.reason}</p>
              <p className="mt-1 text-rose-700 dark:text-rose-300">Attempts={entry.attempts} • {new Date(entry.failedAt).toLocaleString()}</p>
              <p className="mt-1 text-rose-700/90 dark:text-rose-300/90">{OFFLINE_FEATURE_OPERATOR_LABELS[entry.feature || 'unknown']} • {entry.failureClass}{entry.failureCode ? ` (${entry.failureCode})` : ''}</p>
              {entry.message ? <p className="mt-1 text-rose-700/90 dark:text-rose-300/90">{entry.message}</p> : null}
            </div>
          )) : (
            <p className="rounded-lg border border-rose-200 bg-white px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-slate-900/60 dark:text-rose-300">
              {actionableOnly && filteredDeadLetters.length > 0
                ? 'No actionable failed items in this time window.'
                : 'No failed sync items in this time window.'}
            </p>
          )}
        </div>
        {visibleDeadLetters.length > 0 && (
          <div className="mt-3">
            <AdminPagination
              page={deadLetterPage}
              pageSize={deadLetterPageSize}
              pageSizeOptions={[10, 25, 50]}
              itemCount={visibleDeadLetters.length}
              hasNextPage={deadLetterPage * deadLetterPageSize < visibleDeadLetters.length}
              onPageChange={setDeadLetterPage}
              onPageSizeChange={(next) => {
                setDeadLetterPageSize(next);
                setDeadLetterPage(1);
              }}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Queued Actions By Type</h2>
        <div className="space-y-2">
          {queueTypeRows.length ? pagedQueueTypeRows.map(([type, count]) => (
            <div key={type} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-slate-700">
              <span className="text-gray-700 dark:text-slate-300">{OFFLINE_MUTATION_LABELS[type as keyof typeof OFFLINE_MUTATION_LABELS] || type}</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">{count || 0}</span>
            </div>
          )) : (
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">No queued actions.</p>
          )}
        </div>
        {queueTypeRows.length > 0 && (
          <div className="mt-3">
            <AdminPagination
              page={queueTypePage}
              pageSize={queueTypePageSize}
              pageSizeOptions={[8, 16, 32]}
              itemCount={queueTypeRows.length}
              hasNextPage={queueTypePage * queueTypePageSize < queueTypeRows.length}
              onPageChange={setQueueTypePage}
              onPageSizeChange={(next) => {
                setQueueTypePageSize(next);
                setQueueTypePage(1);
              }}
            />
          </div>
        )}
      </section>

      {viewMode === 'advanced' && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Retry Distribution</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">0 retries <span className="float-right font-semibold">{pendingRetryBuckets.zero}</span></p>
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">1-2 retries <span className="float-right font-semibold">{pendingRetryBuckets.oneToTwo}</span></p>
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">3-5 retries <span className="float-right font-semibold">{pendingRetryBuckets.threeToFive}</span></p>
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">6+ retries <span className="float-right font-semibold">{pendingRetryBuckets.sixPlus}</span></p>
              </div>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Failed Item Aging + Top Failing Types</h2>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">&lt;1h <span className="float-right font-semibold">{deadLetterAging.lt1h}</span></p>
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">1-24h <span className="float-right font-semibold">{deadLetterAging.oneTo24h}</span></p>
                <p className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">&gt;24h <span className="float-right font-semibold">{deadLetterAging.gt24h}</span></p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {topFailingRows.length ? topFailingRows.map(([type, count]) => (
                  <p key={type} className="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">{OFFLINE_MUTATION_LABELS[type as keyof typeof OFFLINE_MUTATION_LABELS] || type}<span className="float-right font-semibold">{count}</span></p>
                )) : (
                  <p className="rounded-lg border border-gray-100 px-3 py-2 text-gray-500 dark:border-slate-700 dark:text-slate-400">No failures in selected window.</p>
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Enqueue Activity By Mutation ({selectedWindow.label})</h2>
              <div className="space-y-2">
                {enqueueRows.length ? pagedEnqueueRows.map(([type, count]) => (
                  <p key={type} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-slate-700">
                    <span className="text-gray-700 dark:text-slate-300">{OFFLINE_MUTATION_LABELS[type as keyof typeof OFFLINE_MUTATION_LABELS] || type}</span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100">{count}</span>
                  </p>
                )) : (
                  <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">No enqueue events in this time window.</p>
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
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Migration Targets (Technical)</h2>
              <div className="space-y-2">
                {pagedExpansionTargets.length ? pagedExpansionTargets.map((entry) => (
                  <div key={entry.id} className="min-w-0 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                    <p className="font-semibold text-gray-900 break-words [overflow-wrap:anywhere] dark:text-slate-100">{entry.id}</p>
                    <p className="text-xs text-gray-600 break-words [overflow-wrap:anywhere] dark:text-slate-300">{entry.module} • {entry.area}</p>
                    <p className="mt-1 break-words text-[11px] uppercase tracking-[0.12em] text-amber-700 [overflow-wrap:anywhere] dark:text-amber-300">{entry.mode.replace('_', ' ')}</p>
                  </div>
                )) : (
                  <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">No migration targets pending.</p>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
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
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm dark:border-violet-500/30 dark:bg-violet-500/10">
              <p className="text-xs uppercase tracking-[0.15em] text-violet-700 dark:text-violet-300">Unknown Mapping</p>
              <p className="mt-1 text-2xl font-bold text-violet-700 dark:text-violet-300">{coverage.unknownCollection}</p>
            </div>
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

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-slate-100">Module Readiness (Governance)</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {moduleReadinessRows.slice(0, 6).map((row) => (
                <div key={row.module} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
                  <p className="font-semibold text-gray-900 dark:text-slate-100">{row.module}</p>
                  <p className="mt-1 text-gray-700 dark:text-slate-300">Readiness: <span className="font-semibold">{toPercent(row.readiness)}</span></p>
                  <p className="text-gray-700 dark:text-slate-300">Queue-safe {row.queueSafe}/{row.total} • unresolved {row.unresolved}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-slate-100">Technical Glossary</h2>
            <p className="text-xs text-gray-600 dark:text-slate-300">Blocked update = a write rejected by policy guard.</p>
            <p className="text-xs text-gray-600 dark:text-slate-300">Failed sync item = an update that exhausted retries.</p>
            <p className="text-xs text-gray-600 dark:text-slate-300">Unknown mapping = write location not yet mapped to a static collection key.</p>
            <p className="text-xs text-gray-600 dark:text-slate-300">Flush p50/p95 = median and high-percentile sync run duration.</p>
            <p className="mt-2 text-xs text-gray-700 dark:text-slate-300">Flush p50/p95: <span className="font-semibold">{Math.round(flushP50)}ms / {Math.round(flushP95)}ms</span></p>
            <p className="mt-1 text-xs text-gray-700 dark:text-slate-300">Storage compactions: <span className="font-semibold">{telemetry.storageCompactions || 0}</span> • Blocked updates: <span className="font-semibold">{telemetry.policyViolationCount || 0}</span></p>
          </section>
        </>
      )}
    </div>
  );
}

export default AdminOfflineSyncHealthPage;
