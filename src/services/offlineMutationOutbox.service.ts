import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { captureHandledError } from './errorLog.service';
import { COLLECTIONS } from '../constants/firestore';
import { FIFTEEN_SECONDS_MS, FIVE_MINUTES_MS, TWELVE_HUNDRED_MS } from '../constants/time';

type MutationType = 'user.notificationPreferences';

type UserNotificationPreferencesMutation = {
  userId: string;
  actorUid: string;
  notificationPreferences: Record<string, unknown>;
};

type MutationPayloadMap = {
  'user.notificationPreferences': UserNotificationPreferencesMutation;
};

type MutationRecord<T extends MutationType = MutationType> = {
  id: string;
  type: T;
  actorUid: string;
  payload: MutationPayloadMap[T];
  dedupeKey: string;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
};

type EnqueueOptions<T extends MutationType> = {
  type: T;
  actorUid: string;
  dedupeKey: string;
  payload: MutationPayloadMap[T];
};

type FlushResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

export type PendingOfflineMutationSummary = {
  id: string;
  type: MutationType;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
};

type PendingOfflineMutationsState = {
  count: number;
  items: PendingOfflineMutationSummary[];
};

export type OfflineMutationTelemetry = {
  enqueued: number;
  flushRuns: number;
  flushedProcessed: number;
  flushedSucceeded: number;
  flushedFailed: number;
  pendingCount: number;
  lastEnqueueAt: number | null;
  lastFlushAt: number | null;
  lastFailureAt: number | null;
  lastFailureMessage: string | null;
  recentEvents: Array<{
    at: number;
    kind: 'enqueue' | 'flush_start' | 'flush_complete' | 'flush_error';
    message?: string;
    processed?: number;
    succeeded?: number;
    failed?: number;
  }>;
};

const DB_NAME = 'bloodhub_offline_mutations';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;
const FLUSH_INTERVAL_MS = FIFTEEN_SECONDS_MS;
const MAX_BACKOFF_MS = FIVE_MINUTES_MS;
const MIN_FLUSH_TRIGGER_GAP_MS = TWELVE_HUNDRED_MS;
const TELEMETRY_STORAGE_KEY = 'bh_offline_mutation_telemetry_v1';

let workerStarted = false;
let workerInterval: number | null = null;
let flushing = false;
let flushRequestedWhileRunning = false;
let scheduledFlushTimer: number | null = null;
let lastFlushTriggerAt = 0;
let authUnsubscribe: (() => void) | null = null;
const handleOnlineFlush = () => {
  safeFlush();
};

const pendingCountListeners = new Set<(count: number) => void>();
const pendingStateListeners = new Set<(state: PendingOfflineMutationsState) => void>();
const telemetryListeners = new Set<(telemetry: OfflineMutationTelemetry) => void>();

const emptyTelemetry = (): OfflineMutationTelemetry => ({
  enqueued: 0,
  flushRuns: 0,
  flushedProcessed: 0,
  flushedSucceeded: 0,
  flushedFailed: 0,
  pendingCount: 0,
  lastEnqueueAt: null,
  lastFlushAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  recentEvents: [],
});

const safeWindow = () => (typeof window !== 'undefined' ? window : null);
const safeFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadTelemetry = (): OfflineMutationTelemetry => {
  const w = safeWindow();
  if (!w) return emptyTelemetry();
  try {
    const raw = w.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) return emptyTelemetry();
    const parsed = JSON.parse(raw) as Partial<OfflineMutationTelemetry>;
    const safeEvents = Array.isArray(parsed.recentEvents)
      ? parsed.recentEvents
        .filter((entry) => entry && typeof entry === 'object')
        .slice(0, 40)
        .map((entry) => ({
          at: safeFiniteNumber((entry as any).at, Date.now()),
          kind: ['enqueue', 'flush_start', 'flush_complete', 'flush_error'].includes(String((entry as any).kind))
            ? (entry as any).kind
            : 'enqueue',
          message: typeof (entry as any).message === 'string' ? (entry as any).message : undefined,
          processed: Number.isFinite((entry as any).processed) ? Number((entry as any).processed) : undefined,
          succeeded: Number.isFinite((entry as any).succeeded) ? Number((entry as any).succeeded) : undefined,
          failed: Number.isFinite((entry as any).failed) ? Number((entry as any).failed) : undefined,
        }))
      : [];
    return {
      enqueued: Math.max(0, Math.floor(safeFiniteNumber(parsed.enqueued, 0))),
      flushRuns: Math.max(0, Math.floor(safeFiniteNumber(parsed.flushRuns, 0))),
      flushedProcessed: Math.max(0, Math.floor(safeFiniteNumber(parsed.flushedProcessed, 0))),
      flushedSucceeded: Math.max(0, Math.floor(safeFiniteNumber(parsed.flushedSucceeded, 0))),
      flushedFailed: Math.max(0, Math.floor(safeFiniteNumber(parsed.flushedFailed, 0))),
      pendingCount: Math.max(0, Math.floor(safeFiniteNumber(parsed.pendingCount, 0))),
      lastEnqueueAt: parsed.lastEnqueueAt == null ? null : safeFiniteNumber(parsed.lastEnqueueAt, Date.now()),
      lastFlushAt: parsed.lastFlushAt == null ? null : safeFiniteNumber(parsed.lastFlushAt, Date.now()),
      lastFailureAt: parsed.lastFailureAt == null ? null : safeFiniteNumber(parsed.lastFailureAt, Date.now()),
      lastFailureMessage: typeof parsed.lastFailureMessage === 'string' ? parsed.lastFailureMessage.slice(0, 240) : null,
      recentEvents: safeEvents,
    };
  } catch {
    return emptyTelemetry();
  }
};

let telemetryState: OfflineMutationTelemetry = loadTelemetry();

const saveTelemetry = () => {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(telemetryState));
  } catch {
    // ignore
  }
};

const publishTelemetry = () => {
  saveTelemetry();
  telemetryListeners.forEach((listener) => listener({
    ...telemetryState,
    recentEvents: [...telemetryState.recentEvents],
  }));
};

const patchTelemetry = (patch: Partial<OfflineMutationTelemetry>) => {
  telemetryState = {
    ...telemetryState,
    ...patch,
  };
  publishTelemetry();
};

const pushTelemetryEvent = (event: OfflineMutationTelemetry['recentEvents'][number]) => {
  const existing = telemetryState.recentEvents || [];
  telemetryState = {
    ...telemetryState,
    recentEvents: [event, ...existing].slice(0, 40),
  };
  publishTelemetry();
};

const isOfflineWriteError = (error: unknown): boolean => {
  const anyErr = error as { code?: string; message?: string };
  const code = String(anyErr?.code || '').toLowerCase();
  const message = String(anyErr?.message || '').toLowerCase();
  return (
    code === 'unavailable'
    || code === 'failed-precondition'
    || code === 'deadline-exceeded'
    || message.includes('offline')
    || message.includes('client is offline')
    || message.includes('network')
  );
};

const computeBackoffMs = (attempts: number): number => {
  const exp = Math.min(8, Math.max(1, attempts));
  return Math.min(MAX_BACKOFF_MS, 1000 * (2 ** exp));
};

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const idb = request.result;
      const store = idb.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : idb.createObjectStore(STORE_NAME, { keyPath: 'id' });

      if (!store) return;

      if (!store.indexNames.contains('dedupeKey')) {
        store.createIndex('dedupeKey', 'dedupeKey', { unique: false });
      }
      if (!store.indexNames.contains('actorUid')) {
        store.createIndex('actorUid', 'actorUid', { unique: false });
      }
      if (!store.indexNames.contains('nextAttemptAt')) {
        store.createIndex('nextAttemptAt', 'nextAttemptAt', { unique: false });
      }
      if (!store.indexNames.contains('createdAt')) {
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T>,
): Promise<T> => {
  const idb = await openDb();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    let store: IDBObjectStore;
    try {
      tx = idb.transaction(STORE_NAME, mode);
      store = tx.objectStore(STORE_NAME);
    } catch (error) {
      idb.close();
      reject(error);
      return;
    }
    let handlerResult: T;
    let settled = false;

    const finalizeResolve = () => {
      if (settled) return;
      settled = true;
      idb.close();
      resolve(handlerResult);
    };

    const finalizeReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      idb.close();
      reject(error);
    };

    tx.oncomplete = () => {
      finalizeResolve();
    };

    tx.onabort = () => {
      finalizeReject(tx.error || new Error('IndexedDB transaction aborted.'));
    };

    tx.onerror = () => {
      finalizeReject(tx.error || new Error('IndexedDB transaction failed.'));
    };

    Promise.resolve()
      .then(() => handler(store, tx))
      .then((result) => {
        handlerResult = result;
      })
      .catch((error) => {
        try {
          tx.abort();
        } catch {
          // ignore abort failures, tx may already be closed
        }
        finalizeReject(error);
      });
  });
};

const requestToPromise = <T = unknown>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const publishPendingState = async () => {
  if (
    pendingCountListeners.size === 0
    && pendingStateListeners.size === 0
    && telemetryListeners.size === 0
  ) {
    return;
  }
  const actorUid = auth.currentUser?.uid || null;
  if (!actorUid) {
    pendingCountListeners.forEach((listener) => listener(0));
    pendingStateListeners.forEach((listener) => listener({ count: 0, items: [] }));
    patchTelemetry({ pendingCount: 0 });
    return;
  }

  try {
    const summary = await withStore('readonly', async (store) => {
      const actorIndex = store.index('actorUid');
      const all = await requestToPromise<MutationRecord[]>(actorIndex.getAll(actorUid));
      const items = (Array.isArray(all) ? all : [])
        .sort((a, b) => safeFiniteNumber(a.createdAt, 0) - safeFiniteNumber(b.createdAt, 0))
        .slice(0, 25)
        .map((item) => ({
          id: item.id,
          type: item.type,
          createdAt: safeFiniteNumber(item.createdAt, Date.now()),
          updatedAt: safeFiniteNumber(item.updatedAt, Date.now()),
          attempts: Math.max(0, Math.floor(safeFiniteNumber(item.attempts, 0))),
          nextAttemptAt: safeFiniteNumber(item.nextAttemptAt, Date.now()),
          lastError: item.lastError,
        }));
      return {
        count: Array.isArray(all) ? all.length : 0,
        items,
      } as PendingOfflineMutationsState;
    });
    pendingCountListeners.forEach((listener) => listener(summary.count));
    pendingStateListeners.forEach((listener) => listener(summary));
    patchTelemetry({ pendingCount: summary.count });
  } catch {
    pendingCountListeners.forEach((listener) => listener(0));
    pendingStateListeners.forEach((listener) => listener({ count: 0, items: [] }));
    patchTelemetry({ pendingCount: 0 });
  }
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const upsertMutation = async <T extends MutationType>(options: EnqueueOptions<T>): Promise<void> => {
  const now = Date.now();
  await withStore('readwrite', async (store) => {
    const dedupeIndex = store.index('dedupeKey');
    const existing = await requestToPromise<MutationRecord[]>(dedupeIndex.getAll(options.dedupeKey));
    const existingForActor = (existing || []).filter((item) => item.actorUid === options.actorUid);

    if (existingForActor.length > 0) {
      const [head, ...rest] = existingForActor.sort((a, b) => a.createdAt - b.createdAt);
      const merged: MutationRecord<T> = {
        ...head,
        type: options.type,
        payload: options.payload,
        updatedAt: now,
        nextAttemptAt: now,
        lastError: null,
      };
      store.put(merged);
      rest.forEach((item) => store.delete(item.id));
      return;
    }

    const record: MutationRecord<T> = {
      id: generateId(),
      type: options.type,
      actorUid: options.actorUid,
      payload: options.payload,
      dedupeKey: options.dedupeKey,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      nextAttemptAt: now,
      lastError: null,
    };
    store.add(record);
  });
  await publishPendingState();
  patchTelemetry({
    enqueued: telemetryState.enqueued + 1,
    lastEnqueueAt: Date.now(),
  });
  pushTelemetryEvent({
    at: Date.now(),
    kind: 'enqueue',
    message: options.type,
  });
};

const applyMutation = async (mutation: MutationRecord): Promise<void> => {
  switch (mutation.type) {
    case 'user.notificationPreferences': {
      const payload = mutation.payload as UserNotificationPreferencesMutation;
      await updateDoc(doc(db, COLLECTIONS.USERS, payload.userId), {
        notificationPreferences: payload.notificationPreferences,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    default:
      return;
  }
};

const updateMutationRetry = async (mutation: MutationRecord, error: unknown): Promise<void> => {
  const nextAttempts = mutation.attempts + 1;
  const message = String((error as any)?.message || error || 'mutation_flush_failed');
  const nextAttemptAt = Date.now() + computeBackoffMs(nextAttempts);
  await withStore('readwrite', async (store) => {
    store.put({
      ...mutation,
      attempts: nextAttempts,
      updatedAt: Date.now(),
      nextAttemptAt,
      lastError: message.slice(0, 240),
    } as MutationRecord);
  });
};

const removeMutation = async (id: string): Promise<void> => {
  await withStore('readwrite', async (store) => {
    store.delete(id);
  });
};

const removeQueuedMutationsByDedupeKey = async (
  actorUid: string,
  dedupeKey: string,
): Promise<void> => {
  await withStore('readwrite', async (store) => {
    const dedupeIndex = store.index('dedupeKey');
    const all = await requestToPromise<MutationRecord[]>(dedupeIndex.getAll(dedupeKey));
    (all || [])
      .filter((item) => item.actorUid === actorUid)
      .forEach((item) => store.delete(item.id));
  });
};

export const flushOfflineMutations = async (): Promise<FlushResult> => {
  if (flushing) {
    flushRequestedWhileRunning = true;
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const actorUid = auth.currentUser?.uid || null;
  if (!actorUid || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
  }

  flushing = true;
  patchTelemetry({
    flushRuns: telemetryState.flushRuns + 1,
    lastFlushAt: Date.now(),
  });
  pushTelemetryEvent({
    at: Date.now(),
    kind: 'flush_start',
  });

  try {
    const queued = await withStore('readonly', async (store) => {
      const actorIndex = store.index('actorUid');
      const all = await requestToPromise<MutationRecord[]>(actorIndex.getAll(actorUid));
      return (all || []).sort((a, b) => a.createdAt - b.createdAt);
    });

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const now = Date.now();
    let lastFailureMessage: string | null = null;

    for (const mutation of queued) {
      if (mutation.nextAttemptAt > now) {
        skipped += 1;
        continue;
      }

      try {
        await applyMutation(mutation);
        await removeMutation(mutation.id);
        succeeded += 1;
      } catch (error) {
        if (isOfflineWriteError(error)) {
          await updateMutationRetry(mutation, error);
          failed += 1;
          lastFailureMessage = String((error as any)?.message || 'Offline mutation flush failed');
          pushTelemetryEvent({
            at: Date.now(),
            kind: 'flush_error',
            message: lastFailureMessage,
          });
          continue;
        }

        void captureHandledError(error, {
          source: 'frontend',
          scope: 'unknown',
          metadata: {
            kind: 'offline_mutation.flush',
            mutationType: mutation.type,
            dedupeKey: mutation.dedupeKey,
            attempts: mutation.attempts,
          },
        });

        await removeMutation(mutation.id);
        failed += 1;
        lastFailureMessage = String((error as any)?.message || 'Offline mutation flush failed');
        pushTelemetryEvent({
          at: Date.now(),
          kind: 'flush_error',
          message: lastFailureMessage,
        });
      }
    }

    await publishPendingState();
    patchTelemetry({
      flushedProcessed: telemetryState.flushedProcessed + queued.length,
      flushedSucceeded: telemetryState.flushedSucceeded + succeeded,
      flushedFailed: telemetryState.flushedFailed + failed,
      ...(failed > 0
        ? {
            lastFailureAt: Date.now(),
            lastFailureMessage: lastFailureMessage ? lastFailureMessage.slice(0, 240) : 'Mutation flush failed',
          }
        : {}),
    });
    pushTelemetryEvent({
      at: Date.now(),
      kind: 'flush_complete',
      processed: queued.length,
      succeeded,
      failed,
    });

    return {
      processed: queued.length,
      succeeded,
      failed,
      skipped,
    };
  } catch (error) {
    const message = String((error as any)?.message || 'Offline mutation flush failed');
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_mutation.flush.unexpected',
      },
    });
    patchTelemetry({
      lastFailureAt: Date.now(),
      lastFailureMessage: message.slice(0, 240),
    });
    pushTelemetryEvent({
      at: Date.now(),
      kind: 'flush_error',
      message,
    });
    await publishPendingState();
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
  } finally {
    flushing = false;
    if (flushRequestedWhileRunning) {
      flushRequestedWhileRunning = false;
      safeFlush({ force: true });
    }
  }
};

function safeFlush(options?: { force?: boolean }) {
  if (typeof window !== 'undefined' && !options?.force) {
    const now = Date.now();
    const elapsed = now - lastFlushTriggerAt;
    const delayMs = MIN_FLUSH_TRIGGER_GAP_MS - elapsed;

    if (delayMs > 0) {
      if (scheduledFlushTimer === null) {
        scheduledFlushTimer = window.setTimeout(() => {
          scheduledFlushTimer = null;
          safeFlush({ force: true });
        }, delayMs);
      }
      return;
    }
  }

  if (scheduledFlushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(scheduledFlushTimer);
    scheduledFlushTimer = null;
  }
  lastFlushTriggerAt = Date.now();
  void flushOfflineMutations().catch((error) => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_mutation.flush.background',
      },
    });
  });
}

export const startOfflineMutationOutboxWorker = (): void => {
  if (workerStarted || typeof window === 'undefined') return;
  workerStarted = true;

  window.addEventListener('online', handleOnlineFlush);
  authUnsubscribe = auth.onAuthStateChanged(() => {
    void publishPendingState();
    safeFlush();
  });

  workerInterval = window.setInterval(() => {
    safeFlush();
  }, FLUSH_INTERVAL_MS);

  safeFlush();
};

export const stopOfflineMutationOutboxWorker = (): void => {
  if (!workerStarted || typeof window === 'undefined') return;
  workerStarted = false;
  window.removeEventListener('online', handleOnlineFlush);
  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }
  if (workerInterval !== null) {
    window.clearInterval(workerInterval);
    workerInterval = null;
  }
  if (scheduledFlushTimer !== null) {
    window.clearTimeout(scheduledFlushTimer);
    scheduledFlushTimer = null;
  }
};

export const subscribePendingOfflineMutations = (listener: (count: number) => void): (() => void) => {
  pendingCountListeners.add(listener);
  void publishPendingState();
  return () => {
    pendingCountListeners.delete(listener);
  };
};

export const subscribePendingOfflineMutationState = (
  listener: (state: PendingOfflineMutationsState) => void,
): (() => void) => {
  pendingStateListeners.add(listener);
  void publishPendingState();
  return () => {
    pendingStateListeners.delete(listener);
  };
};

export const getOfflineMutationTelemetry = (): OfflineMutationTelemetry => ({
  ...telemetryState,
  recentEvents: [...telemetryState.recentEvents],
});

export const subscribeOfflineMutationTelemetry = (
  listener: (telemetry: OfflineMutationTelemetry) => void,
): (() => void) => {
  telemetryListeners.add(listener);
  // Recompute pending queue snapshot so telemetry reflects current outbox state immediately.
  void publishPendingState();
  listener({
    ...telemetryState,
    recentEvents: [...telemetryState.recentEvents],
  });
  return () => {
    telemetryListeners.delete(listener);
  };
};

export const resetOfflineMutationTelemetry = (): void => {
  telemetryState = emptyTelemetry();
  publishTelemetry();
  void publishPendingState();
};

export const updateUserNotificationPreferences = async (options: {
  userId: string;
  actorUid?: string;
  notificationPreferences: Record<string, unknown>;
}): Promise<{ queued: boolean }> => {
  const actorUid = options.actorUid || auth.currentUser?.uid || options.userId;
  const dedupeKey = `user.notificationPreferences:${options.userId}`;

  const tryDirectWrite = async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, options.userId), {
        notificationPreferences: options.notificationPreferences,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      if (isOfflineWriteError(error)) {
        return false;
      }
      throw error;
    }
  };

  try {
    const wroteDirectly = await tryDirectWrite();
    if (wroteDirectly) {
      // Prevent stale queued mutations from replaying and overwriting the fresh direct write.
      try {
        await removeQueuedMutationsByDedupeKey(actorUid, dedupeKey);
        await publishPendingState();
      } catch (cleanupError) {
        void captureHandledError(cleanupError, {
          source: 'frontend',
          scope: 'unknown',
          metadata: {
            kind: 'offline_mutation.cleanup_after_direct_write',
            mutationType: 'user.notificationPreferences',
            targetUserId: options.userId,
          },
        });
      }
      return { queued: false };
    }
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_mutation.direct_write',
        mutationType: 'user.notificationPreferences',
        targetUserId: options.userId,
      },
    });
    throw error;
  }

  try {
    await upsertMutation({
      type: 'user.notificationPreferences',
      actorUid,
      dedupeKey,
      payload: {
        userId: options.userId,
        actorUid,
        notificationPreferences: options.notificationPreferences,
      },
    });
    return { queued: true };
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_mutation.enqueue',
        mutationType: 'user.notificationPreferences',
        targetUserId: options.userId,
      },
    });
    throw error;
  }
};
