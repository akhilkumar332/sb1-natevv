import { deleteField, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { captureHandledError } from './errorLog.service';
import { COLLECTIONS } from '../constants/firestore';
import {
  OFFLINE_MUTATION_FEATURES,
  OFFLINE_HEALTH_RECORDS_CONFIG,
  OFFLINE_MUTATION_LABELS,
  OFFLINE_MUTATION_TYPES,
  OFFLINE_OUTBOX_CONFIG,
  type OfflineMutationFeature,
  type OfflineMutationType,
} from '../constants/offline';
import { validateQueueableMutation } from '../constants/offlineMutationPolicy';

type MutationType = OfflineMutationType;

type UserNotificationPreferencesMutation = {
  userId: string;
  actorUid: string;
  notificationPreferences: Record<string, unknown>;
};

type UserProfilePatchMutation = {
  userId: string;
  patch: Record<string, unknown>;
};

type AdminNotificationReadMutation = {
  notificationId: string;
  read: boolean;
};

type AdminContactSubmissionStatusMutation = {
  submissionId: string;
  status: 'read' | 'unread';
  readBy?: string | null;
};

type AdminNpsFollowUpStatusMutation = {
  responseId: string;
  status: 'open' | 'in_progress' | 'closed';
  followedUpBy?: string | null;
};

type AdminNpsFollowUpNotesMutation = {
  responseId: string;
  notes: string | null;
  followedUpBy?: string | null;
};

type AdminNpsTagsMutation = {
  responseId: string;
  tags: string[];
};

type FirestoreDocPatchMutation = {
  collection: string;
  docId: string;
  patch: Record<string, unknown>;
  deleteFields?: string[];
  serverTimestampFields?: string[];
};

type AdminCampaignStatusMutation = {
  campaignId: string;
  status: 'active' | 'completed' | 'cancelled';
};

type AdminAppointmentStatusMutation = {
  appointmentId: string;
  status: 'confirmed' | 'completed' | 'cancelled';
};

type AdminDonationStatusMutation = {
  donationId: string;
  status: 'completed' | 'rejected' | 'pending';
};

type AdminVolunteerStatusMutation = {
  volunteerId: string;
  status: 'active' | 'inactive';
};

type AdminPartnershipStatusMutation = {
  partnershipId: string;
  status: 'active' | 'pending' | 'inactive';
};

type AdminEmergencyRequestStatusMutation = {
  requestId: string;
  status: 'fulfilled' | 'cancelled';
};

type MutationPayloadMap = {
  [OFFLINE_MUTATION_TYPES.userNotificationPreferences]: UserNotificationPreferencesMutation;
  [OFFLINE_MUTATION_TYPES.userProfilePatch]: UserProfilePatchMutation;
  [OFFLINE_MUTATION_TYPES.adminNotificationRead]: AdminNotificationReadMutation;
  [OFFLINE_MUTATION_TYPES.adminContactSubmissionStatus]: AdminContactSubmissionStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminNpsFollowUpStatus]: AdminNpsFollowUpStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminNpsFollowUpNotes]: AdminNpsFollowUpNotesMutation;
  [OFFLINE_MUTATION_TYPES.adminNpsTags]: AdminNpsTagsMutation;
  [OFFLINE_MUTATION_TYPES.firestoreDocPatch]: FirestoreDocPatchMutation;
  [OFFLINE_MUTATION_TYPES.adminCampaignStatus]: AdminCampaignStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminAppointmentStatus]: AdminAppointmentStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminDonationStatus]: AdminDonationStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminVolunteerStatus]: AdminVolunteerStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminPartnershipStatus]: AdminPartnershipStatusMutation;
  [OFFLINE_MUTATION_TYPES.adminEmergencyRequestStatus]: AdminEmergencyRequestStatusMutation;
};

type MutationRecord<T extends MutationType = MutationType> = {
  id: string;
  type: T;
  feature?: OfflineMutationFeature;
  traceId?: string;
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
  feature?: OfflineMutationFeature;
  traceId?: string;
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

export type OfflineMutationDeadLetterEntry = {
  id: string;
  mutationId: string;
  type: MutationType;
  feature: OfflineMutationFeature;
  actorUid: string;
  dedupeKey: string;
  attempts: number;
  failedAt: number;
  reason: string;
  message: string | null;
  traceId: string | null;
  failureClass: OfflineFailureClass;
  failureCode: string | null;
};

export type OfflineFailureClass =
  | 'network'
  | 'auth'
  | 'validation'
  | 'permission'
  | 'conflict'
  | 'rule'
  | 'internal'
  | 'unknown';

type OfflineTelemetryEventOutcome =
  | 'queued'
  | 'started'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'skipped'
  | 'succeeded';

export type OfflineMutationTelemetryEvent = {
  at: number;
  kind: 'enqueue' | 'flush_start' | 'flush_complete' | 'flush_error' | 'policy_violation';
  mutationType?: MutationType;
  feature?: OfflineMutationFeature;
  traceId?: string;
  outcome?: OfflineTelemetryEventOutcome;
  failureClass?: OfflineFailureClass;
  failureCode?: string;
  message?: string;
  processed?: number;
  succeeded?: number;
  failed?: number;
  durationMs?: number;
};

export type OfflineMutationTelemetry = {
  enqueued: number;
  flushRuns: number;
  flushedProcessed: number;
  flushedSucceeded: number;
  flushedFailed: number;
  pendingCount: number;
  pendingByType: Partial<Record<MutationType, number>>;
  deadLetterCount: number;
  policyViolationCount: number;
  lastPolicyViolation: string | null;
  storageCompactions: number;
  healthPersistRuns: number;
  healthPersistSucceeded: number;
  healthPersistFailed: number;
  healthPersistWindowRuns: number;
  healthPersistWindowSucceeded: number;
  healthPersistWindowFailed: number;
  lastHealthPersistAt: number | null;
  lastHealthPersistError: string | null;
  lastHealthPersistRecordId: string | null;
  lastEnqueueAt: number | null;
  lastFlushAt: number | null;
  lastFailureAt: number | null;
  lastFailureMessage: string | null;
  recentEvents: OfflineMutationTelemetryEvent[];
};

const DB_NAME = OFFLINE_OUTBOX_CONFIG.dbName;
const STORE_NAME = OFFLINE_OUTBOX_CONFIG.storeName;
const DB_VERSION = OFFLINE_OUTBOX_CONFIG.dbVersion;
const FLUSH_INTERVAL_MS = OFFLINE_OUTBOX_CONFIG.flushIntervalMs;
const MAX_BACKOFF_MS = OFFLINE_OUTBOX_CONFIG.maxBackoffMs;
const MIN_FLUSH_TRIGGER_GAP_MS = OFFLINE_OUTBOX_CONFIG.minFlushTriggerGapMs;
const MAX_ATTEMPTS_PER_MUTATION = OFFLINE_OUTBOX_CONFIG.maxAttemptsPerMutation;
const TELEMETRY_STORAGE_KEY = OFFLINE_OUTBOX_CONFIG.telemetryStorageKey;
const DEAD_LETTER_STORAGE_KEY = OFFLINE_OUTBOX_CONFIG.deadLetterStorageKey;
const MAX_TELEMETRY_COUNTER = 1_000_000;

let workerStarted = false;
let workerInterval: number | null = null;
let flushing = false;
let flushRequestedWhileRunning = false;
let scheduledFlushTimer: number | null = null;
let scheduledHealthPersistTimer: number | null = null;
let lastFlushTriggerAt = 0;
let lastHealthPersistAt = 0;
let lastHealthPersistSignature = '';
let healthPersistInFlight = false;
let authUnsubscribe: (() => void) | null = null;
const handleOnlineFlush = () => {
  safeFlush();
};

const pendingCountListeners = new Set<(count: number) => void>();
const pendingStateListeners = new Set<(state: PendingOfflineMutationsState) => void>();
const telemetryListeners = new Set<(telemetry: OfflineMutationTelemetry) => void>();
const deadLetterListeners = new Set<(entries: OfflineMutationDeadLetterEntry[]) => void>();

const emptyTelemetry = (): OfflineMutationTelemetry => ({
  enqueued: 0,
  flushRuns: 0,
  flushedProcessed: 0,
  flushedSucceeded: 0,
  flushedFailed: 0,
  pendingCount: 0,
  pendingByType: {},
  deadLetterCount: 0,
  policyViolationCount: 0,
  lastPolicyViolation: null,
  storageCompactions: 0,
  healthPersistRuns: 0,
  healthPersistSucceeded: 0,
  healthPersistFailed: 0,
  healthPersistWindowRuns: 0,
  healthPersistWindowSucceeded: 0,
  healthPersistWindowFailed: 0,
  lastHealthPersistAt: null,
  lastHealthPersistError: null,
  lastHealthPersistRecordId: null,
  lastEnqueueAt: null,
  lastFlushAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  recentEvents: [],
});

const safeWindow = () => (typeof window !== 'undefined' ? window : null);
const getCurrentUserUid = (): string | null => {
  try {
    return auth?.currentUser?.uid || null;
  } catch {
    return null;
  }
};
const subscribeAuthState = (listener: () => void): (() => void) => {
  try {
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      return auth.onAuthStateChanged(listener);
    }
  } catch {
    // ignore mock/runtime auth binding failures
  }
  return () => {};
};
const safeFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeCounter = (value: unknown): number => {
  const normalized = Math.max(0, Math.floor(safeFiniteNumber(value, 0)));
  return Math.min(MAX_TELEMETRY_COUNTER, normalized);
};

const safeFailureClass = (value: unknown): OfflineFailureClass => {
  const normalized = String(value || '').toLowerCase();
  if (['network', 'auth', 'validation', 'permission', 'conflict', 'rule', 'internal'].includes(normalized)) {
    return normalized as OfflineFailureClass;
  }
  return 'unknown';
};

const toShortCode = (value: unknown): string | null => {
  if (value == null) return null;
  const code = String(value).trim().slice(0, 120);
  return code ? code : null;
};

const generateTraceId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const classifyOfflineFailure = (error: unknown): { failureClass: OfflineFailureClass; failureCode: string | null } => {
  const anyErr = error as { code?: string; message?: string };
  const codeRaw = String(anyErr?.code || '');
  const code = codeRaw.toLowerCase();
  const message = String(anyErr?.message || '').toLowerCase();

  if (code.includes('permission') || code === 'unauthenticated') {
    return {
      failureClass: code === 'unauthenticated' ? 'auth' : 'permission',
      failureCode: toShortCode(codeRaw || 'permission_denied'),
    };
  }
  if (code.includes('invalid-argument') || code.includes('failed-precondition') || message.includes('invalid')) {
    return { failureClass: 'validation', failureCode: toShortCode(codeRaw || 'validation_error') };
  }
  if (code.includes('aborted') || message.includes('conflict')) {
    return { failureClass: 'conflict', failureCode: toShortCode(codeRaw || 'conflict') };
  }
  if (code.includes('resource-exhausted') || code.includes('quota')) {
    return { failureClass: 'rule', failureCode: toShortCode(codeRaw || 'resource_exhausted') };
  }
  if (isOfflineWriteError(error)) {
    return { failureClass: 'network', failureCode: toShortCode(codeRaw || 'offline') };
  }
  if (code.includes('internal')) {
    return { failureClass: 'internal', failureCode: toShortCode(codeRaw || 'internal') };
  }
  return { failureClass: 'unknown', failureCode: toShortCode(codeRaw || null) };
};

const safeFeatureFromType = (type: MutationType | undefined): OfflineMutationFeature => {
  if (!type) return 'unknown';
  return OFFLINE_MUTATION_FEATURES[type] || 'unknown';
};

const safeFeatureValue = (value: unknown, fallbackType?: MutationType): OfflineMutationFeature => {
  const raw = String(value || '') as OfflineMutationFeature;
  if (Object.values(OFFLINE_MUTATION_FEATURES).includes(raw) || raw === 'unknown') {
    return raw;
  }
  return safeFeatureFromType(fallbackType);
};

const shallowEqualRecord = (
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): boolean => {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if ((a || {})[key] !== (b || {})[key]) return false;
  }
  return true;
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
        .slice(0, OFFLINE_OUTBOX_CONFIG.maxRecentEvents)
        .map((entry) => ({
          at: safeFiniteNumber((entry as any).at, Date.now()),
          kind: ['enqueue', 'flush_start', 'flush_complete', 'flush_error', 'policy_violation'].includes(String((entry as any).kind))
            ? (entry as any).kind
            : 'enqueue',
          mutationType: Object.values(OFFLINE_MUTATION_TYPES).includes((entry as any).mutationType)
            ? (entry as any).mutationType
            : undefined,
          feature: safeFeatureValue((entry as any).feature, (entry as any).mutationType),
          traceId: typeof (entry as any).traceId === 'string' ? (entry as any).traceId.slice(0, 64) : undefined,
          outcome: typeof (entry as any).outcome === 'string' ? (entry as any).outcome : undefined,
          failureClass: safeFailureClass((entry as any).failureClass),
          failureCode: toShortCode((entry as any).failureCode) ?? undefined,
          message: typeof (entry as any).message === 'string' ? (entry as any).message : undefined,
          processed: Number.isFinite((entry as any).processed) ? Number((entry as any).processed) : undefined,
          succeeded: Number.isFinite((entry as any).succeeded) ? Number((entry as any).succeeded) : undefined,
          failed: Number.isFinite((entry as any).failed) ? Number((entry as any).failed) : undefined,
          durationMs: Number.isFinite((entry as any).durationMs) ? Number((entry as any).durationMs) : undefined,
        }))
      : [];
    const parsedPendingByType = (parsed.pendingByType && typeof parsed.pendingByType === 'object')
      ? Object.entries(parsed.pendingByType).reduce<Partial<Record<MutationType, number>>>((acc, [key, value]) => {
          if (!Object.values(OFFLINE_MUTATION_TYPES).includes(key as MutationType)) return acc;
          const safeValue = Math.max(0, Math.floor(safeFiniteNumber(value, 0)));
          acc[key as MutationType] = safeValue;
          return acc;
        }, {})
      : {};
    const normalized: OfflineMutationTelemetry = {
      enqueued: toSafeCounter(parsed.enqueued),
      flushRuns: toSafeCounter(parsed.flushRuns),
      flushedProcessed: toSafeCounter(parsed.flushedProcessed),
      flushedSucceeded: toSafeCounter(parsed.flushedSucceeded),
      flushedFailed: toSafeCounter(parsed.flushedFailed),
      pendingCount: toSafeCounter(parsed.pendingCount),
      pendingByType: parsedPendingByType,
      deadLetterCount: toSafeCounter(parsed.deadLetterCount),
      policyViolationCount: toSafeCounter((parsed as any).policyViolationCount),
      lastPolicyViolation: typeof (parsed as any).lastPolicyViolation === 'string'
        ? (parsed as any).lastPolicyViolation.slice(0, 240)
        : null,
      storageCompactions: toSafeCounter((parsed as any).storageCompactions),
      healthPersistRuns: toSafeCounter((parsed as any).healthPersistRuns),
      healthPersistSucceeded: toSafeCounter((parsed as any).healthPersistSucceeded),
      healthPersistFailed: toSafeCounter((parsed as any).healthPersistFailed),
      healthPersistWindowRuns: toSafeCounter((parsed as any).healthPersistWindowRuns),
      healthPersistWindowSucceeded: toSafeCounter((parsed as any).healthPersistWindowSucceeded),
      healthPersistWindowFailed: toSafeCounter((parsed as any).healthPersistWindowFailed),
      lastHealthPersistAt: (parsed as any).lastHealthPersistAt == null
        ? null
        : safeFiniteNumber((parsed as any).lastHealthPersistAt, Date.now()),
      lastHealthPersistError: typeof (parsed as any).lastHealthPersistError === 'string'
        ? (parsed as any).lastHealthPersistError.slice(0, 240)
        : null,
      lastHealthPersistRecordId: typeof (parsed as any).lastHealthPersistRecordId === 'string'
        ? (parsed as any).lastHealthPersistRecordId.slice(0, 180)
        : null,
      lastEnqueueAt: parsed.lastEnqueueAt == null ? null : safeFiniteNumber(parsed.lastEnqueueAt, Date.now()),
      lastFlushAt: parsed.lastFlushAt == null ? null : safeFiniteNumber(parsed.lastFlushAt, Date.now()),
      lastFailureAt: parsed.lastFailureAt == null ? null : safeFiniteNumber(parsed.lastFailureAt, Date.now()),
      lastFailureMessage: typeof parsed.lastFailureMessage === 'string' ? parsed.lastFailureMessage.slice(0, 240) : null,
      recentEvents: safeEvents,
    };
    // Self-heal historical runaway counters from older scheduler loops.
    if (
      normalized.healthPersistRuns >= 100_000
      && normalized.healthPersistSucceeded === 0
      && normalized.healthPersistFailed === normalized.healthPersistRuns
    ) {
      return {
        ...normalized,
        healthPersistRuns: 0,
        healthPersistFailed: 0,
        healthPersistWindowRuns: 0,
        healthPersistWindowFailed: 0,
        healthPersistWindowSucceeded: 0,
        lastHealthPersistAt: null,
        lastHealthPersistError: null,
        lastHealthPersistRecordId: null,
      };
    }
    return normalized;
  } catch {
    return emptyTelemetry();
  }
};

let telemetryState: OfflineMutationTelemetry = loadTelemetry();

const loadDeadLetters = (): OfflineMutationDeadLetterEntry[] => {
  const w = safeWindow();
  if (!w) return [];
  try {
    const raw = w.localStorage.getItem(DEAD_LETTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === 'object')
      .slice(0, OFFLINE_OUTBOX_CONFIG.maxDeadLetterItems)
      .map((entry) => ({
        id: String((entry as any).id || ''),
        mutationId: String((entry as any).mutationId || ''),
        type: Object.values(OFFLINE_MUTATION_TYPES).includes((entry as any).type)
          ? (entry as any).type
          : OFFLINE_MUTATION_TYPES.userNotificationPreferences,
        feature: safeFeatureValue((entry as any).feature, (entry as any).type),
        actorUid: String((entry as any).actorUid || ''),
        dedupeKey: String((entry as any).dedupeKey || ''),
        attempts: Math.max(0, Math.floor(safeFiniteNumber((entry as any).attempts, 0))),
        failedAt: safeFiniteNumber((entry as any).failedAt, Date.now()),
        reason: String((entry as any).reason || 'unknown'),
        message: (entry as any).message == null ? null : String((entry as any).message).slice(0, 240),
        traceId: typeof (entry as any).traceId === 'string' ? String((entry as any).traceId).slice(0, 64) : null,
        failureClass: safeFailureClass((entry as any).failureClass),
        failureCode: toShortCode((entry as any).failureCode),
      }))
      .filter((entry) => entry.id && entry.mutationId && entry.actorUid);
  } catch {
    return [];
  }
};

let deadLetterState: OfflineMutationDeadLetterEntry[] = loadDeadLetters();
telemetryState = {
  ...telemetryState,
  deadLetterCount: deadLetterState.length,
};

let compactingStorage = false;

const compactLocalOfflineStorage = () => {
  if (compactingStorage) return;
  compactingStorage = true;
  try {
    const nextEvents = (telemetryState.recentEvents || []).slice(0, Math.max(10, Math.floor(OFFLINE_OUTBOX_CONFIG.maxRecentEvents / 2)));
    const nextDeadLetters = deadLetterState.slice(0, Math.max(20, Math.floor(OFFLINE_OUTBOX_CONFIG.maxDeadLetterItems / 2)));
    telemetryState = {
      ...telemetryState,
      recentEvents: nextEvents,
      storageCompactions: toSafeCounter((telemetryState.storageCompactions || 0) + 1),
    };
    deadLetterState = nextDeadLetters;
  } finally {
    compactingStorage = false;
  }
};

const saveTelemetry = () => {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(telemetryState));
  } catch {
    compactLocalOfflineStorage();
    try {
      w.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(telemetryState));
    } catch {
      // ignore
    }
  }
};

const toBucketStart = (timestampMs: number) => {
  const bucketMs = OFFLINE_HEALTH_RECORDS_CONFIG.bucketMs;
  return Math.floor(timestampMs / bucketMs) * bucketMs;
};

const buildHealthPersistSignature = (uid: string, now: number) => {
  const bucketStart = toBucketStart(now);
  const pendingByTypeSignature = Object.entries(telemetryState.pendingByType || {})
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}:${Math.max(0, Math.floor(Number(value) || 0))}`)
    .join('|');
  return [
    uid,
    bucketStart,
    telemetryState.pendingCount,
    pendingByTypeSignature,
    telemetryState.deadLetterCount,
    telemetryState.flushedProcessed,
    telemetryState.flushedFailed,
    telemetryState.lastFailureAt || 0,
  ].join(':');
};

const withHealthPersistWindowUpdate = (kind: 'run' | 'success' | 'failed') => {
  const maxRuns = OFFLINE_OUTBOX_CONFIG.maxHealthPersistWindowRuns;
  let runs = toSafeCounter(telemetryState.healthPersistWindowRuns || 0);
  let succeeded = toSafeCounter(telemetryState.healthPersistWindowSucceeded || 0);
  let failed = toSafeCounter(telemetryState.healthPersistWindowFailed || 0);

  if (runs >= maxRuns) {
    runs = Math.floor(runs / 2);
    succeeded = Math.floor(succeeded / 2);
    failed = Math.floor(failed / 2);
  }

  if (kind === 'run') runs += 1;
  if (kind === 'success') succeeded += 1;
  if (kind === 'failed') failed += 1;

  return {
    healthPersistWindowRuns: runs,
    healthPersistWindowSucceeded: succeeded,
    healthPersistWindowFailed: failed,
  };
};

const persistOfflineSyncHealthRecordNow = async () => {
  const uid = getCurrentUserUid();
  if (!uid) {
    lastHealthPersistAt = Date.now();
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    lastHealthPersistAt = Date.now();
    return;
  }
  if (healthPersistInFlight) return;

  const now = Date.now();
  const signature = buildHealthPersistSignature(uid, now);
  if (signature === lastHealthPersistSignature) return;

  const bucketStart = toBucketStart(now);
  const recordId = `${uid}_${bucketStart}`;
  const deadLetterSamples = deadLetterState
    .slice(0, OFFLINE_HEALTH_RECORDS_CONFIG.maxDeadLetterSamples)
    .map((entry) => ({
      type: entry.type,
      feature: entry.feature,
      reason: entry.reason,
      failureClass: entry.failureClass,
      failureCode: entry.failureCode || null,
      attempts: entry.attempts,
      failedAt: entry.failedAt,
    }));

  try {
    healthPersistInFlight = true;
    // Throttle re-scheduling while this attempt is in flight.
    lastHealthPersistAt = now;
    patchTelemetry({
      healthPersistRuns: telemetryState.healthPersistRuns + 1,
      ...withHealthPersistWindowUpdate('run'),
    });
    await setDoc(
      doc(db, COLLECTIONS.OFFLINE_SYNC_HEALTH_RECORDS, recordId),
      {
        uid,
        bucketStart,
        updatedAt: serverTimestamp(),
        lastEnqueueAt: telemetryState.lastEnqueueAt || null,
        lastFlushAt: telemetryState.lastFlushAt || null,
        lastFailureAt: telemetryState.lastFailureAt || null,
        lastFailureMessage: telemetryState.lastFailureMessage || null,
        pendingCount: telemetryState.pendingCount,
        pendingByType: telemetryState.pendingByType || {},
        deadLetterCount: telemetryState.deadLetterCount,
        deadLetterSamples,
        enqueued: telemetryState.enqueued,
        flushRuns: telemetryState.flushRuns,
        flushedProcessed: telemetryState.flushedProcessed,
        flushedSucceeded: telemetryState.flushedSucceeded,
        flushedFailed: telemetryState.flushedFailed,
      },
      { merge: true },
    );
    lastHealthPersistSignature = signature;
    patchTelemetry({
      healthPersistSucceeded: telemetryState.healthPersistSucceeded + 1,
      ...withHealthPersistWindowUpdate('success'),
      lastHealthPersistAt: now,
      lastHealthPersistError: null,
      lastHealthPersistRecordId: recordId,
    });
  } catch (error) {
    patchTelemetry({
      healthPersistFailed: telemetryState.healthPersistFailed + 1,
      ...withHealthPersistWindowUpdate('failed'),
      lastHealthPersistError: String((error as any)?.message || 'persist_failed').slice(0, 240),
      lastHealthPersistRecordId: recordId,
    });
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_sync_health.persist',
        uid,
        recordId,
      },
    });
  } finally {
    healthPersistInFlight = false;
  }
};

const scheduleOfflineSyncHealthRecordPersist = () => {
  if (typeof window === 'undefined') return;
  if (healthPersistInFlight) return;
  if (!getCurrentUserUid()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const intervalMs = OFFLINE_HEALTH_RECORDS_CONFIG.persistIntervalMs;
  const elapsed = Date.now() - lastHealthPersistAt;
  const delayMs = Math.max(0, intervalMs - elapsed);

  if (delayMs <= 0) {
    void persistOfflineSyncHealthRecordNow();
    return;
  }

  if (scheduledHealthPersistTimer !== null) return;
  scheduledHealthPersistTimer = window.setTimeout(() => {
    scheduledHealthPersistTimer = null;
    void persistOfflineSyncHealthRecordNow();
  }, delayMs);
};

const publishTelemetry = () => {
  saveTelemetry();
  scheduleOfflineSyncHealthRecordPersist();
  telemetryListeners.forEach((listener) => listener({
    ...telemetryState,
    recentEvents: [...telemetryState.recentEvents],
  }));
};

const saveDeadLetters = () => {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify(deadLetterState));
  } catch {
    compactLocalOfflineStorage();
    try {
      w.localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify(deadLetterState));
    } catch {
      // ignore
    }
  }
};

const publishDeadLetters = () => {
  saveDeadLetters();
  scheduleOfflineSyncHealthRecordPersist();
  deadLetterListeners.forEach((listener) => listener([...deadLetterState]));
  patchTelemetry({
    deadLetterCount: deadLetterState.length,
  });
};

const patchTelemetry = (patch: Partial<OfflineMutationTelemetry>) => {
  const nextState: OfflineMutationTelemetry = {
    ...telemetryState,
    ...patch,
  };
  nextState.enqueued = toSafeCounter(nextState.enqueued);
  nextState.flushRuns = toSafeCounter(nextState.flushRuns);
  nextState.flushedProcessed = toSafeCounter(nextState.flushedProcessed);
  nextState.flushedSucceeded = toSafeCounter(nextState.flushedSucceeded);
  nextState.flushedFailed = toSafeCounter(nextState.flushedFailed);
  nextState.pendingCount = toSafeCounter(nextState.pendingCount);
  nextState.deadLetterCount = toSafeCounter(nextState.deadLetterCount);
  nextState.policyViolationCount = toSafeCounter(nextState.policyViolationCount);
  nextState.storageCompactions = toSafeCounter(nextState.storageCompactions);
  nextState.healthPersistRuns = toSafeCounter(nextState.healthPersistRuns);
  nextState.healthPersistSucceeded = toSafeCounter(nextState.healthPersistSucceeded);
  nextState.healthPersistFailed = toSafeCounter(nextState.healthPersistFailed);
  nextState.healthPersistWindowRuns = toSafeCounter(nextState.healthPersistWindowRuns);
  nextState.healthPersistWindowSucceeded = toSafeCounter(nextState.healthPersistWindowSucceeded);
  nextState.healthPersistWindowFailed = toSafeCounter(nextState.healthPersistWindowFailed);

  const isNoop = (
    nextState.enqueued === telemetryState.enqueued
    && nextState.flushRuns === telemetryState.flushRuns
    && nextState.flushedProcessed === telemetryState.flushedProcessed
    && nextState.flushedSucceeded === telemetryState.flushedSucceeded
    && nextState.flushedFailed === telemetryState.flushedFailed
    && nextState.pendingCount === telemetryState.pendingCount
    && shallowEqualRecord(nextState.pendingByType || {}, telemetryState.pendingByType || {})
    && nextState.deadLetterCount === telemetryState.deadLetterCount
    && nextState.policyViolationCount === telemetryState.policyViolationCount
    && nextState.lastPolicyViolation === telemetryState.lastPolicyViolation
    && nextState.storageCompactions === telemetryState.storageCompactions
    && nextState.healthPersistRuns === telemetryState.healthPersistRuns
    && nextState.healthPersistSucceeded === telemetryState.healthPersistSucceeded
    && nextState.healthPersistFailed === telemetryState.healthPersistFailed
    && nextState.healthPersistWindowRuns === telemetryState.healthPersistWindowRuns
    && nextState.healthPersistWindowSucceeded === telemetryState.healthPersistWindowSucceeded
    && nextState.healthPersistWindowFailed === telemetryState.healthPersistWindowFailed
    && nextState.lastHealthPersistAt === telemetryState.lastHealthPersistAt
    && nextState.lastHealthPersistError === telemetryState.lastHealthPersistError
    && nextState.lastHealthPersistRecordId === telemetryState.lastHealthPersistRecordId
    && nextState.lastEnqueueAt === telemetryState.lastEnqueueAt
    && nextState.lastFlushAt === telemetryState.lastFlushAt
    && nextState.lastFailureAt === telemetryState.lastFailureAt
    && nextState.lastFailureMessage === telemetryState.lastFailureMessage
  );
  if (isNoop) return;

  telemetryState = nextState;
  publishTelemetry();
};

const pushTelemetryEvent = (event: OfflineMutationTelemetry['recentEvents'][number]) => {
  const existing = telemetryState.recentEvents || [];
  const normalizedEvent: OfflineMutationTelemetryEvent = {
    ...event,
    traceId: event.traceId ? String(event.traceId).slice(0, 64) : undefined,
    feature: safeFeatureValue(event.feature, event.mutationType),
    failureClass: safeFailureClass(event.failureClass),
    failureCode: toShortCode(event.failureCode) ?? undefined,
  };

  const duplicate = existing.find((entry) => (
    entry.kind === normalizedEvent.kind
    && entry.mutationType === normalizedEvent.mutationType
    && entry.message === normalizedEvent.message
    && Math.abs((normalizedEvent.at || 0) - (entry.at || 0)) < 2000
  ));
  if (duplicate) return;

  const combined = [normalizedEvent, ...existing];
  const perKindLimit = OFFLINE_OUTBOX_CONFIG.maxRecentEventsPerKind;
  const byKindCount: Record<string, number> = {};
  const nextEvents: OfflineMutationTelemetryEvent[] = [];
  for (const item of combined) {
    const kindKey = item.kind;
    const current = byKindCount[kindKey] || 0;
    if (current >= perKindLimit) continue;
    byKindCount[kindKey] = current + 1;
    nextEvents.push(item);
    if (nextEvents.length >= OFFLINE_OUTBOX_CONFIG.maxRecentEvents) break;
  }

  telemetryState = {
    ...telemetryState,
    recentEvents: nextEvents,
  };
  publishTelemetry();
};

const addDeadLetter = (
  mutation: MutationRecord,
  reason: string,
  message?: string | null,
  diagnostics?: { failureClass?: OfflineFailureClass; failureCode?: string | null },
) => {
  const entry: OfflineMutationDeadLetterEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    mutationId: mutation.id,
    type: mutation.type,
    feature: mutation.feature || safeFeatureFromType(mutation.type),
    actorUid: mutation.actorUid,
    dedupeKey: mutation.dedupeKey,
    attempts: mutation.attempts,
    failedAt: Date.now(),
    reason,
    message: message ? String(message).slice(0, 240) : null,
    traceId: mutation.traceId || null,
    failureClass: diagnostics?.failureClass || 'unknown',
    failureCode: diagnostics?.failureCode || null,
  };
  deadLetterState = [entry, ...deadLetterState].slice(0, OFFLINE_OUTBOX_CONFIG.maxDeadLetterItems);
  publishDeadLetters();
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
    && !workerStarted
  ) {
    return;
  }
  const actorUid = getCurrentUserUid();
  if (!actorUid) {
    pendingCountListeners.forEach((listener) => listener(0));
    pendingStateListeners.forEach((listener) => listener({ count: 0, items: [] }));
    patchTelemetry({ pendingCount: 0, pendingByType: {} });
    return;
  }

  try {
    const summary = await withStore('readonly', async (store) => {
      const actorIndex = store.index('actorUid');
      const all = await requestToPromise<MutationRecord[]>(actorIndex.getAll(actorUid));
      const normalized = Array.isArray(all) ? all : [];
      const byType = normalized.reduce<Partial<Record<MutationType, number>>>((acc, item) => {
        const current = acc[item.type] || 0;
        acc[item.type] = current + 1;
        return acc;
      }, {});
      const items = normalized
        .sort((a, b) => safeFiniteNumber(a.createdAt, 0) - safeFiniteNumber(b.createdAt, 0))
        .slice(0, OFFLINE_OUTBOX_CONFIG.maxPendingItems)
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
        count: normalized.length,
        items,
        byType,
      } as PendingOfflineMutationsState & { byType: Partial<Record<MutationType, number>> };
    });
    pendingCountListeners.forEach((listener) => listener(summary.count));
    pendingStateListeners.forEach((listener) => listener(summary));
    patchTelemetry({ pendingCount: summary.count, pendingByType: summary.byType || {} });
  } catch {
    pendingCountListeners.forEach((listener) => listener(0));
    pendingStateListeners.forEach((listener) => listener({ count: 0, items: [] }));
    patchTelemetry({ pendingCount: 0, pendingByType: {} });
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
        feature: options.feature || safeFeatureFromType(options.type),
        traceId: options.traceId || head.traceId || generateTraceId(),
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
      feature: options.feature || safeFeatureFromType(options.type),
      traceId: options.traceId || generateTraceId(),
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
    mutationType: options.type,
    feature: options.feature || safeFeatureFromType(options.type),
    traceId: options.traceId,
    outcome: 'queued',
    message: OFFLINE_MUTATION_LABELS[options.type] || options.type,
  });
};

const applyMutation = async (mutation: MutationRecord): Promise<void> => {
  switch (mutation.type) {
    case OFFLINE_MUTATION_TYPES.userNotificationPreferences: {
      const payload = mutation.payload as UserNotificationPreferencesMutation;
      await updateDoc(doc(db, COLLECTIONS.USERS, payload.userId), {
        notificationPreferences: payload.notificationPreferences,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.userProfilePatch: {
      const payload = mutation.payload as UserProfilePatchMutation;
      await setDoc(doc(db, COLLECTIONS.USERS, payload.userId), {
        ...payload.patch,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminNotificationRead: {
      const payload = mutation.payload as AdminNotificationReadMutation;
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, payload.notificationId), {
        read: payload.read,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminContactSubmissionStatus: {
      const payload = mutation.payload as AdminContactSubmissionStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.CONTACT_SUBMISSIONS, payload.submissionId), {
        status: payload.status,
        readAt: payload.status === 'read' ? serverTimestamp() : deleteField(),
        readBy: payload.status === 'read' ? (payload.readBy || null) : deleteField(),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminNpsFollowUpStatus: {
      const payload = mutation.payload as AdminNpsFollowUpStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, payload.responseId), {
        followUpStatus: payload.status,
        followedUpBy: payload.followedUpBy || null,
        followedUpAt: payload.status === 'open' ? deleteField() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminNpsFollowUpNotes: {
      const payload = mutation.payload as AdminNpsFollowUpNotesMutation;
      await updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, payload.responseId), {
        followUpNotes: payload.notes ? payload.notes : deleteField(),
        followedUpBy: payload.followedUpBy || null,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminNpsTags: {
      const payload = mutation.payload as AdminNpsTagsMutation;
      await updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, payload.responseId), {
        tags: payload.tags,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.firestoreDocPatch: {
      const payload = mutation.payload as FirestoreDocPatchMutation;
      const updatePayload: Record<string, unknown> = {
        ...payload.patch,
      };
      (payload.deleteFields || []).forEach((field) => {
        updatePayload[field] = deleteField();
      });
      (payload.serverTimestampFields || []).forEach((field) => {
        updatePayload[field] = serverTimestamp();
      });
      await updateDoc(doc(db, payload.collection, payload.docId), updatePayload);
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminCampaignStatus: {
      const payload = mutation.payload as AdminCampaignStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, payload.campaignId), {
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminAppointmentStatus: {
      const payload = mutation.payload as AdminAppointmentStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, payload.appointmentId), {
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminDonationStatus: {
      const payload = mutation.payload as AdminDonationStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.DONATIONS, payload.donationId), {
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminVolunteerStatus: {
      const payload = mutation.payload as AdminVolunteerStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.VOLUNTEERS, payload.volunteerId), {
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminPartnershipStatus: {
      const payload = mutation.payload as AdminPartnershipStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.PARTNERSHIPS, payload.partnershipId), {
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    case OFFLINE_MUTATION_TYPES.adminEmergencyRequestStatus: {
      const payload = mutation.payload as AdminEmergencyRequestStatusMutation;
      await updateDoc(doc(db, COLLECTIONS.BLOOD_REQUESTS, payload.requestId), {
        status: payload.status,
        ...(payload.status === 'fulfilled' ? { fulfilledAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    default:
      return;
  }
};

const updateMutationRetry = async (mutation: MutationRecord, error: unknown): Promise<number> => {
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
  return nextAttempts;
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

  const actorUid = getCurrentUserUid();
  if (!actorUid || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
  }

  flushing = true;
  const flushStartedAt = Date.now();
  const flushTraceId = generateTraceId();
  patchTelemetry({
    flushRuns: telemetryState.flushRuns + 1,
    lastFlushAt: Date.now(),
  });
  pushTelemetryEvent({
    at: Date.now(),
    kind: 'flush_start',
    traceId: flushTraceId,
    outcome: 'started',
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
          const retryableFailure = classifyOfflineFailure(error);
          const attempts = await updateMutationRetry(mutation, error);
          if (attempts >= MAX_ATTEMPTS_PER_MUTATION) {
            await removeMutation(mutation.id);
            addDeadLetter(
              { ...mutation, attempts },
              'max_attempts_reached',
              (error as any)?.message || 'Offline mutation exceeded retry budget',
              retryableFailure,
            );
          }
          failed += 1;
          lastFailureMessage = String((error as any)?.message || 'Offline mutation flush failed');
          pushTelemetryEvent({
            at: Date.now(),
            kind: 'flush_error',
            mutationType: mutation.type,
            feature: mutation.feature || safeFeatureFromType(mutation.type),
            traceId: mutation.traceId || flushTraceId,
            outcome: 'failed',
            failureClass: retryableFailure.failureClass,
            failureCode: retryableFailure.failureCode ?? undefined,
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
        const fatalFailure = classifyOfflineFailure(error);
        addDeadLetter(
          mutation,
          'fatal_write_error',
          (error as any)?.message || 'Mutation removed after non-retryable failure',
          fatalFailure,
        );
        failed += 1;
        lastFailureMessage = String((error as any)?.message || 'Offline mutation flush failed');
        pushTelemetryEvent({
          at: Date.now(),
          kind: 'flush_error',
          mutationType: mutation.type,
          feature: mutation.feature || safeFeatureFromType(mutation.type),
          traceId: mutation.traceId || flushTraceId,
          outcome: 'failed',
          failureClass: fatalFailure.failureClass,
          failureCode: fatalFailure.failureCode ?? undefined,
          message: lastFailureMessage,
        });
      }
    }

    const attempted = succeeded + failed;
    await publishPendingState();
    patchTelemetry({
      flushedProcessed: telemetryState.flushedProcessed + attempted,
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
      traceId: flushTraceId,
      outcome: 'completed',
      processed: attempted,
      succeeded,
      failed,
      durationMs: Math.max(0, Date.now() - flushStartedAt),
    });

    return {
      processed: attempted,
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
      traceId: flushTraceId,
      outcome: 'failed',
      failureClass: classifyOfflineFailure(error).failureClass,
      failureCode: classifyOfflineFailure(error).failureCode ?? undefined,
      message,
      durationMs: Math.max(0, Date.now() - flushStartedAt),
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
  authUnsubscribe = subscribeAuthState(() => {
    void publishPendingState();
    scheduleOfflineSyncHealthRecordPersist();
    safeFlush();
  });

  workerInterval = window.setInterval(() => {
    safeFlush();
  }, FLUSH_INTERVAL_MS);

  safeFlush();
  void publishPendingState();
  scheduleOfflineSyncHealthRecordPersist();
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
  if (scheduledHealthPersistTimer !== null) {
    window.clearTimeout(scheduledHealthPersistTimer);
    scheduledHealthPersistTimer = null;
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
  pendingByType: { ...telemetryState.pendingByType },
  recentEvents: [...telemetryState.recentEvents],
});

export const getOfflineMutationDeadLetters = (): OfflineMutationDeadLetterEntry[] => [...deadLetterState];

export const subscribeOfflineMutationTelemetry = (
  listener: (telemetry: OfflineMutationTelemetry) => void,
): (() => void) => {
  telemetryListeners.add(listener);
  // Recompute pending queue snapshot so telemetry reflects current outbox state immediately.
  void publishPendingState();
  listener({
    ...telemetryState,
    pendingByType: { ...telemetryState.pendingByType },
    recentEvents: [...telemetryState.recentEvents],
  });
  return () => {
    telemetryListeners.delete(listener);
  };
};

export const subscribeOfflineMutationDeadLetters = (
  listener: (entries: OfflineMutationDeadLetterEntry[]) => void,
): (() => void) => {
  deadLetterListeners.add(listener);
  listener([...deadLetterState]);
  return () => {
    deadLetterListeners.delete(listener);
  };
};

export const resetOfflineMutationTelemetry = (): void => {
  telemetryState = {
    ...emptyTelemetry(),
    deadLetterCount: deadLetterState.length,
  };
  publishTelemetry();
  void publishPendingState();
};

export const resetOfflineMutationDeadLetters = (): void => {
  deadLetterState = [];
  publishDeadLetters();
};

export const refreshOfflineMutationHealthSnapshot = async (): Promise<void> => {
  await publishPendingState();
  // publishPendingState already emits telemetry updates via patchTelemetry/publishTelemetry.
  deadLetterListeners.forEach((listener) => listener([...deadLetterState]));
};

const runQueueableMutation = async <T extends MutationType>(options: {
  type: T;
  dedupeKey: string;
  actorUid?: string;
  payload: MutationPayloadMap[T];
  directWrite: () => Promise<void>;
  metadata?: Record<string, unknown>;
}): Promise<{ queued: boolean }> => {
  const actorUid = options.actorUid || getCurrentUserUid() || null;
  const traceId = generateTraceId();
  const feature = safeFeatureFromType(options.type);
  const policy = validateQueueableMutation(options.type, options.payload);

  if (!policy.allowed) {
    const policyMessage = policy.message || 'Offline mutation policy rejected this operation.';
    patchTelemetry({
      policyViolationCount: telemetryState.policyViolationCount + 1,
      lastPolicyViolation: policyMessage.slice(0, 240),
    });
    pushTelemetryEvent({
      at: Date.now(),
      kind: 'policy_violation',
      mutationType: options.type,
      feature,
      traceId,
      outcome: 'blocked',
      failureClass: 'rule',
      failureCode: toShortCode(policy.code) ?? undefined,
      message: policyMessage.slice(0, 240),
    });

    if (
      policy.code === 'direct_write_only'
      && typeof navigator !== 'undefined'
      && navigator.onLine
    ) {
      await options.directWrite();
      return { queued: false };
    }
    throw new Error(policyMessage);
  }

  const tryDirectWrite = async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      await options.directWrite();
      return true;
    } catch (error) {
      if (isOfflineWriteError(error)) return false;
      throw error;
    }
  };

  try {
    const wroteDirectly = await tryDirectWrite();
    if (wroteDirectly) {
      if (actorUid) {
        try {
          await removeQueuedMutationsByDedupeKey(actorUid, options.dedupeKey);
          await publishPendingState();
        } catch (cleanupError) {
          void captureHandledError(cleanupError, {
            source: 'frontend',
            scope: 'unknown',
            metadata: {
              kind: 'offline_mutation.cleanup_after_direct_write',
              mutationType: options.type,
              dedupeKey: options.dedupeKey,
              ...(options.metadata || {}),
            },
          });
        }
      }
      return { queued: false };
    }
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_mutation.direct_write',
        mutationType: options.type,
        dedupeKey: options.dedupeKey,
        ...(options.metadata || {}),
      },
    });
    throw error;
  }

  if (!actorUid) {
    throw new Error('Unable to queue offline mutation without authenticated actor.');
  }

  try {
    await upsertMutation({
      type: options.type,
      feature,
      traceId,
      actorUid,
      dedupeKey: options.dedupeKey,
      payload: options.payload,
    });
    return { queued: true };
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'offline_mutation.enqueue',
        mutationType: options.type,
        dedupeKey: options.dedupeKey,
        ...(options.metadata || {}),
      },
    });
    throw error;
  }
};

export const updateUserNotificationPreferences = async (options: {
  userId: string;
  actorUid?: string;
  notificationPreferences: Record<string, unknown>;
}): Promise<{ queued: boolean }> => {
  const actorUid = options.actorUid || getCurrentUserUid() || options.userId;
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.userNotificationPreferences,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.userNotificationPreferences}:${options.userId}`,
    actorUid,
    payload: {
      userId: options.userId,
      actorUid,
      notificationPreferences: options.notificationPreferences,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.USERS, options.userId), {
      notificationPreferences: options.notificationPreferences,
      updatedAt: serverTimestamp(),
    }),
    metadata: {
      targetUserId: options.userId,
    },
  });
};

export const updateUserProfilePatch = async (options: {
  userId: string;
  patch: Record<string, unknown>;
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.userProfilePatch,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.userProfilePatch}:${options.userId}`,
    actorUid: options.actorUid || getCurrentUserUid() || options.userId,
    payload: {
      userId: options.userId,
      patch: options.patch,
    },
    directWrite: () => setDoc(
      doc(db, COLLECTIONS.USERS, options.userId),
      {
        ...options.patch,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    metadata: { targetUserId: options.userId },
  });
};

export const updateAdminNotificationReadStatus = async (options: {
  notificationId: string;
  read: boolean;
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminNotificationRead,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminNotificationRead}:${options.notificationId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      notificationId: options.notificationId,
      read: options.read,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, options.notificationId), {
      read: options.read,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.notificationId, read: options.read },
  });
};

export const updateAdminContactSubmissionStatus = async (options: {
  submissionId: string;
  status: 'read' | 'unread';
  readBy?: string | null;
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminContactSubmissionStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminContactSubmissionStatus}:${options.submissionId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      submissionId: options.submissionId,
      status: options.status,
      readBy: options.readBy || null,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.CONTACT_SUBMISSIONS, options.submissionId), {
      status: options.status,
      readAt: options.status === 'read' ? serverTimestamp() : deleteField(),
      readBy: options.status === 'read' ? (options.readBy || null) : deleteField(),
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.submissionId, status: options.status },
  });
};

export const updateAdminCampaignStatus = async (options: {
  campaignId: string;
  status: 'active' | 'completed' | 'cancelled';
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminCampaignStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminCampaignStatus}:${options.campaignId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      campaignId: options.campaignId,
      status: options.status,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, options.campaignId), {
      status: options.status,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.campaignId, status: options.status },
  });
};

export const updateAdminNpsFollowUpStatus = async (options: {
  responseId: string;
  status: 'open' | 'in_progress' | 'closed';
  followedUpBy?: string | null;
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminNpsFollowUpStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminNpsFollowUpStatus}:${options.responseId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      responseId: options.responseId,
      status: options.status,
      followedUpBy: options.followedUpBy || null,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, options.responseId), {
      followUpStatus: options.status,
      followedUpBy: options.followedUpBy || null,
      followedUpAt: options.status === 'open' ? deleteField() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.responseId, status: options.status },
  });
};

export const updateAdminNpsFollowUpNotes = async (options: {
  responseId: string;
  notes: string | null;
  followedUpBy?: string | null;
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminNpsFollowUpNotes,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminNpsFollowUpNotes}:${options.responseId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      responseId: options.responseId,
      notes: options.notes,
      followedUpBy: options.followedUpBy || null,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, options.responseId), {
      followUpNotes: options.notes ? options.notes : deleteField(),
      followedUpBy: options.followedUpBy || null,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.responseId },
  });
};

export const updateAdminNpsTags = async (options: {
  responseId: string;
  tags: string[];
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminNpsTags,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminNpsTags}:${options.responseId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      responseId: options.responseId,
      tags: options.tags,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, options.responseId), {
      tags: options.tags,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.responseId },
  });
};

export const updateAdminAppointmentStatus = async (options: {
  appointmentId: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminAppointmentStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminAppointmentStatus}:${options.appointmentId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      appointmentId: options.appointmentId,
      status: options.status,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, options.appointmentId), {
      status: options.status,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.appointmentId, status: options.status },
  });
};

export const updateAdminDonationStatus = async (options: {
  donationId: string;
  status: 'completed' | 'rejected' | 'pending';
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminDonationStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminDonationStatus}:${options.donationId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      donationId: options.donationId,
      status: options.status,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.DONATIONS, options.donationId), {
      status: options.status,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.donationId, status: options.status },
  });
};

export const updateAdminVolunteerStatus = async (options: {
  volunteerId: string;
  status: 'active' | 'inactive';
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminVolunteerStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminVolunteerStatus}:${options.volunteerId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      volunteerId: options.volunteerId,
      status: options.status,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.VOLUNTEERS, options.volunteerId), {
      status: options.status,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.volunteerId, status: options.status },
  });
};

export const updateAdminPartnershipStatus = async (options: {
  partnershipId: string;
  status: 'active' | 'pending' | 'inactive';
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminPartnershipStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminPartnershipStatus}:${options.partnershipId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      partnershipId: options.partnershipId,
      status: options.status,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.PARTNERSHIPS, options.partnershipId), {
      status: options.status,
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.partnershipId, status: options.status },
  });
};

export const updateAdminEmergencyRequestStatus = async (options: {
  requestId: string;
  status: 'fulfilled' | 'cancelled';
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.adminEmergencyRequestStatus,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.adminEmergencyRequestStatus}:${options.requestId}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      requestId: options.requestId,
      status: options.status,
    },
    directWrite: () => updateDoc(doc(db, COLLECTIONS.BLOOD_REQUESTS, options.requestId), {
      status: options.status,
      ...(options.status === 'fulfilled' ? { fulfilledAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    }),
    metadata: { targetId: options.requestId, status: options.status },
  });
};

export const queueFirestoreDocPatch = async (options: {
  collection: string;
  docId: string;
  patch?: Record<string, unknown>;
  deleteFields?: string[];
  serverTimestampFields?: string[];
  dedupeScope?: string;
  actorUid?: string;
}): Promise<{ queued: boolean }> => {
  const sanitizedPatch = Object.entries(options.patch || {}).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return runQueueableMutation({
    type: OFFLINE_MUTATION_TYPES.firestoreDocPatch,
    dedupeKey: `${OFFLINE_MUTATION_TYPES.firestoreDocPatch}:${options.collection}:${options.docId}:${options.dedupeScope || 'default'}`,
    actorUid: options.actorUid || getCurrentUserUid() || '',
    payload: {
      collection: options.collection,
      docId: options.docId,
      patch: sanitizedPatch,
      deleteFields: options.deleteFields || [],
      serverTimestampFields: options.serverTimestampFields || [],
    },
    directWrite: () => {
      const updatePayload: Record<string, unknown> = {
        ...sanitizedPatch,
      };
      (options.deleteFields || []).forEach((field) => {
        updatePayload[field] = deleteField();
      });
      (options.serverTimestampFields || []).forEach((field) => {
        updatePayload[field] = serverTimestamp();
      });
      return updateDoc(doc(db, options.collection, options.docId), updatePayload);
    },
    metadata: {
      collection: options.collection,
      docId: options.docId,
      dedupeScope: options.dedupeScope || 'default',
    },
  });
};
