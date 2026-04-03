import { describe, expect, it } from 'vitest';
import { buildOfflineSystemSummary, getOfflineReporterLabel, type OfflineSyncHealthRecord } from '../offlineSyncHealth';

const makeRecord = (overrides: Partial<OfflineSyncHealthRecord>): OfflineSyncHealthRecord => ({
  id: 'record-1',
  uid: 'user-1',
  actor: {
    uid: 'user-1',
    displayName: 'User One',
    role: 'admin',
    status: 'active',
  },
  bucketStart: 1_000,
  updatedAt: new Date(1_000),
  lastEnqueueAt: null,
  lastFlushAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  pendingCount: 0,
  pendingByType: {},
  deadLetterCount: 0,
  deadLetterSamples: [],
  enqueued: 0,
  flushRuns: 0,
  flushedProcessed: 0,
  flushedSucceeded: 0,
  flushedFailed: 0,
  ...overrides,
});

describe('offlineSyncHealth utils', () => {
  it('aggregates the latest reporter record per uid', () => {
    const summary = buildOfflineSystemSummary([
      makeRecord({
        id: 'older',
        uid: 'user-1',
        actor: { uid: 'user-1', displayName: 'User One', role: 'admin', status: 'active' },
        bucketStart: 10_000,
        updatedAt: new Date(10_000),
        pendingCount: 5,
        pendingByType: { 'admin.notification.read': 5 },
      }),
      makeRecord({
        id: 'newer',
        uid: 'user-1',
        actor: { uid: 'user-1', displayName: 'User One', role: 'admin', status: 'active' },
        bucketStart: 20_000,
        updatedAt: new Date(20_000),
        pendingCount: 1,
        pendingByType: { 'admin.notification.read': 1 },
      }),
    ], 30_000);

    expect(summary.reporterCount).toBe(1);
    expect(summary.totalPendingCount).toBe(1);
    expect(summary.rows[0]?.pendingCount).toBe(1);
  });

  it('marks dead-letter reporters as critical and stale reporters as stale', () => {
    const summary = buildOfflineSystemSummary([
      makeRecord({
        id: 'critical',
        uid: 'user-critical',
        actor: { uid: 'user-critical', displayName: 'Critical User', role: 'ngo', status: 'active' },
        updatedAt: new Date(90_000),
        deadLetterCount: 2,
        lastFailureAt: new Date(95_000),
        deadLetterSamples: [{
          type: 'admin.notification.read',
          feature: 'notifications',
          reason: 'fatal_write_error',
          failureClass: 'permission',
          failureCode: 'denied',
          attempts: 4,
          failedAt: new Date(95_000),
        }],
      }),
      makeRecord({
        id: 'stale',
        uid: 'user-stale',
        actor: { uid: 'user-stale', displayName: 'Stale User', role: 'donor', status: 'active' },
        updatedAt: new Date(1_000),
      }),
    ], 400_000);

    expect(summary.criticalReporterCount).toBe(1);
    expect(summary.staleReporterCount).toBe(1);
    expect(summary.rows[0]?.status).toBe('critical');
    expect(summary.rows[1]?.status).toBe('stale');
    expect(summary.incident.severity).toBe('critical');
    expect(summary.incident.likelyCause).toBe('permission');
  });

  it('falls back to uid when display name is unavailable', () => {
    expect(getOfflineReporterLabel({
      uid: 'user-xyz',
      actor: null,
    })).toBe('user-xyz');
  });
});
