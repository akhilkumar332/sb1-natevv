import { OFFLINE_HEALTH_RECORDS_CONFIG, OFFLINE_HEALTH_THRESHOLDS } from '../constants/offline';

export type OfflineSyncHealthActor = {
  uid: string;
  displayName: string;
  role: string | null;
  status: string | null;
};

export type OfflineSyncHealthDeadLetterSample = {
  type: string;
  feature: string | null;
  reason: string;
  failureClass: string;
  failureCode: string | null;
  attempts: number;
  failedAt: Date | null;
};

export type OfflineSyncHealthRecord = {
  id: string;
  uid: string;
  actor: OfflineSyncHealthActor | null;
  bucketStart: number;
  updatedAt: Date | null;
  lastEnqueueAt: Date | null;
  lastFlushAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureMessage: string | null;
  pendingCount: number;
  pendingByType: Record<string, number>;
  deadLetterCount: number;
  deadLetterSamples: OfflineSyncHealthDeadLetterSample[];
  enqueued: number;
  flushRuns: number;
  flushedProcessed: number;
  flushedSucceeded: number;
  flushedFailed: number;
};

export type OfflineReporterStatus = 'healthy' | 'warning' | 'critical' | 'stale';

export type OfflineReporterRow = {
  uid: string;
  actor: OfflineSyncHealthActor | null;
  status: OfflineReporterStatus;
  statusReason: string;
  lastSeenAt: number | null;
  pendingCount: number;
  deadLetterCount: number;
  lastFailureAt: number | null;
  lastFailureMessage: string | null;
  topMutationType: string | null;
  topFailureClass: string | null;
  queueRisk: boolean;
  stale: boolean;
};

export type OfflineSystemIncidentSummary = {
  severity: 'healthy' | 'warning' | 'critical';
  title: string;
  summary: string;
  likelyCause: string;
  affectedActors: number;
  sinceAt: number | null;
};

export type OfflineSystemSummary = {
  reporterCount: number;
  activeReporterCount: number;
  staleReporterCount: number;
  affectedReporterCount: number;
  criticalReporterCount: number;
  totalPendingCount: number;
  totalDeadLetterCount: number;
  successRate: number;
  lastSeenAt: number | null;
  topMutationTypes: Array<{ type: string; count: number }>;
  topFailureClasses: Array<{ failureClass: string; count: number }>;
  rows: OfflineReporterRow[];
  incident: OfflineSystemIncidentSummary;
};

const toSafeNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const getRecordLastSeenAt = (record: OfflineSyncHealthRecord): number | null => {
  const candidates = [
    record.updatedAt?.getTime() ?? null,
    record.lastFlushAt?.getTime() ?? null,
    record.lastEnqueueAt?.getTime() ?? null,
    record.bucketStart || null,
  ].filter((value): value is number => typeof value === 'number' && value > 0);
  if (!candidates.length) return null;
  return Math.max(...candidates);
};

const getTopCountEntry = (counts: Record<string, number>): string | null => {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

const rankReporterStatus = (status: OfflineReporterStatus): number => {
  switch (status) {
    case 'critical':
      return 4;
    case 'stale':
      return 3;
    case 'warning':
      return 2;
    default:
      return 1;
  }
};

export const getOfflineReporterLabel = (row: Pick<OfflineReporterRow, 'actor' | 'uid'>): string => {
  const name = row.actor?.displayName?.trim();
  if (name) return name;
  return row.uid;
};

export const buildOfflineSystemSummary = (
  records: OfflineSyncHealthRecord[],
  now: number = Date.now(),
): OfflineSystemSummary => {
  const latestByUid = new Map<string, OfflineSyncHealthRecord>();
  records.forEach((record) => {
    const current = latestByUid.get(record.uid);
    if (!current) {
      latestByUid.set(record.uid, record);
      return;
    }
    const currentSeen = getRecordLastSeenAt(current) || 0;
    const nextSeen = getRecordLastSeenAt(record) || 0;
    if (nextSeen >= currentSeen) {
      latestByUid.set(record.uid, record);
    }
  });

  const staleAfterMs = Math.max(
    OFFLINE_HEALTH_THRESHOLDS.staleSyncMs,
    OFFLINE_HEALTH_RECORDS_CONFIG.persistIntervalMs * 3,
  );

  const rows = Array.from(latestByUid.values()).map<OfflineReporterRow>((record) => {
    const lastSeenAt = getRecordLastSeenAt(record);
    const stale = lastSeenAt == null ? true : (now - lastSeenAt) > staleAfterMs;
    const hasDeadLetters = toSafeNumber(record.deadLetterCount) > 0;
    const hasQueued = toSafeNumber(record.pendingCount) > 0;
    const topFailureClass = getTopCountEntry(
      record.deadLetterSamples.reduce<Record<string, number>>((acc, sample) => {
        const key = sample.failureClass || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    );
    const topMutationType = getTopCountEntry(record.pendingByType || {});
    const status: OfflineReporterStatus = stale
      ? 'stale'
      : hasDeadLetters
        ? 'critical'
        : hasQueued
          ? 'warning'
          : 'healthy';
    const statusReason = stale
      ? 'Reporter is stale'
      : hasDeadLetters
        ? 'Reporter has failed sync items'
        : hasQueued
          ? 'Reporter still has queued actions'
          : 'Reporter is healthy';

    return {
      uid: record.uid,
      actor: record.actor,
      status,
      statusReason,
      lastSeenAt,
      pendingCount: toSafeNumber(record.pendingCount),
      deadLetterCount: toSafeNumber(record.deadLetterCount),
      lastFailureAt: record.lastFailureAt?.getTime() ?? null,
      lastFailureMessage: record.lastFailureMessage || null,
      topMutationType,
      topFailureClass,
      queueRisk: hasQueued,
      stale,
    };
  }).sort((a, b) => {
    const severityDelta = rankReporterStatus(b.status) - rankReporterStatus(a.status);
    if (severityDelta !== 0) return severityDelta;
    const deadLetterDelta = b.deadLetterCount - a.deadLetterCount;
    if (deadLetterDelta !== 0) return deadLetterDelta;
    const pendingDelta = b.pendingCount - a.pendingCount;
    if (pendingDelta !== 0) return pendingDelta;
    return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
  });

  const totalPendingCount = rows.reduce((acc, row) => acc + row.pendingCount, 0);
  const totalDeadLetterCount = rows.reduce((acc, row) => acc + row.deadLetterCount, 0);
  const affectedRows = rows.filter((row) => row.deadLetterCount > 0 || row.pendingCount > 0 || row.stale);
  const criticalRows = rows.filter((row) => row.status === 'critical');
  const staleRows = rows.filter((row) => row.status === 'stale');
  const activeRows = rows.filter((row) => !row.stale);

  const totals = Array.from(latestByUid.values()).reduce((acc, record) => {
    acc.processed += toSafeNumber(record.flushedProcessed);
    acc.succeeded += toSafeNumber(record.flushedSucceeded);
    record.deadLetterSamples.forEach((sample) => {
      const failureKey = sample.failureClass || 'unknown';
      acc.failureClasses[failureKey] = (acc.failureClasses[failureKey] || 0) + 1;
    });
    Object.entries(record.pendingByType || {}).forEach(([type, count]) => {
      acc.mutationTypes[type] = (acc.mutationTypes[type] || 0) + toSafeNumber(count);
    });
    return acc;
  }, {
    processed: 0,
    succeeded: 0,
    failureClasses: {} as Record<string, number>,
    mutationTypes: {} as Record<string, number>,
  });

  const topMutationTypes = Object.entries(totals.mutationTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
  const topFailureClasses = Object.entries(totals.failureClasses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([failureClass, count]) => ({ failureClass, count }));

  const successRate = totals.processed > 0 ? (totals.succeeded / totals.processed) * 100 : 0;
  const lastSeenAt = rows.reduce<number | null>((latest, row) => {
    if (row.lastSeenAt == null) return latest;
    if (latest == null || row.lastSeenAt > latest) return row.lastSeenAt;
    return latest;
  }, null);

  const incident = (() => {
    if (criticalRows.length > 0) {
      const sinceAt = criticalRows.reduce<number | null>((earliest, row) => {
        const candidate = row.lastFailureAt || row.lastSeenAt;
        if (candidate == null) return earliest;
        if (earliest == null || candidate < earliest) return candidate;
        return earliest;
      }, null);
      return {
        severity: 'critical' as const,
        title: 'Failed sync items require intervention',
        summary: `${criticalRows.length} reporter(s) have dead letters or hard failures.`,
        likelyCause: topFailureClasses[0]?.failureClass || 'unknown',
        affectedActors: criticalRows.length,
        sinceAt,
      };
    }
    if (affectedRows.length > 0) {
      const sinceAt = affectedRows.reduce<number | null>((earliest, row) => {
        const candidate = row.lastFailureAt || row.lastSeenAt;
        if (candidate == null) return earliest;
        if (earliest == null || candidate < earliest) return candidate;
        return earliest;
      }, null);
      return {
        severity: 'warning' as const,
        title: 'Queued or stale reporters need review',
        summary: `${affectedRows.length} reporter(s) are queued, stale, or at risk.`,
        likelyCause: staleRows.length > 0
          ? 'stale_reporters'
          : topMutationTypes[0]?.type || 'queued_actions',
        affectedActors: affectedRows.length,
        sinceAt,
      };
    }
    return {
      severity: 'healthy' as const,
      title: 'System-wide sync looks healthy',
      summary: 'No active fleet-level sync incidents are visible in the selected window.',
      likelyCause: 'none',
      affectedActors: 0,
      sinceAt: null,
    };
  })();

  return {
    reporterCount: rows.length,
    activeReporterCount: activeRows.length,
    staleReporterCount: staleRows.length,
    affectedReporterCount: affectedRows.length,
    criticalReporterCount: criticalRows.length,
    totalPendingCount,
    totalDeadLetterCount,
    successRate,
    lastSeenAt,
    topMutationTypes,
    topFailureClasses,
    rows,
    incident,
  };
};
