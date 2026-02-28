import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

type ErrorLogSource = 'frontend' | 'functions' | 'netlify' | 'unknown';
type ErrorLogScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
type ErrorLogLevel = 'error' | 'warning';

type ErrorLogContext = {
  source?: ErrorLogSource;
  scope?: ErrorLogScope;
  level?: ErrorLogLevel;
  route?: string;
  code?: string;
  metadata?: Record<string, unknown>;
  isImpersonating?: boolean;
  impersonationActorUid?: string | null;
};

type ErrorLogPayload = {
  source: ErrorLogSource;
  scope: ErrorLogScope;
  level: ErrorLogLevel;
  message: string;
  code: string | null;
  route: string | null;
  stack: string | null;
  userUid: string | null;
  userRole: string | null;
  isImpersonating: boolean;
  impersonationActorUid: string | null;
  fingerprint: string;
  sessionId: string;
  metadata: Record<string, unknown> | null;
};

const ERROR_QUEUE_KEY = 'bh_error_log_queue';
const ERROR_SESSION_ID_KEY = 'bh_error_log_session_id';
const USER_CACHE_KEY = 'bh_user_cache';
const IMPERSONATION_STORAGE_KEY = 'bh_superadmin_impersonation';
const MAX_MESSAGE_LEN = 600;
const MAX_STACK_LEN = 4000;
const MAX_METADATA_JSON_LEN = 6000;
const MAX_ROUTE_LEN = 320;
const DEDUPE_WINDOW_MS = 30_000;
const inMemoryDedupe = new Map<string, number>();
const MAX_DEDUPE_ENTRIES = 1500;
const QUEUE_FLUSH_INTERVAL_MS = 60_000;
let lastQueueFlushAt = 0;
let queueFlushInFlight = false;
const CONSOLE_RATE_WINDOW_MS = 60_000;
const CONSOLE_RATE_LIMIT = 40;
const noisyMessagePatterns = [
  'react router future flag warning',
  'non-serializable values were found in the navigation state',
  'download the react devtools',
];
const sensitiveRouteParamPatterns = [
  'token',
  'idtoken',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'password',
  'otp',
  'pendingrequest',
  'pendingrequestkey',
];

const safeWindow = () => (typeof window !== 'undefined' ? window : null);

const sanitizeText = (input: string): string => {
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b\+?\d[\d\s()-]{8,}\d\b/g, '[REDACTED_PHONE]')
    .replace(/("?(token|idToken|accessToken|refreshToken|authorization|password)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[REDACTED]$4')
    .replace(/(token|idToken|accessToken|refreshToken|authorization|password)=([^&\s]+)/gi, '$1=[REDACTED]');
};

const truncate = (value: string, maxLen: number): string => {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...[truncated]`;
};

const inferScopeFromPath = (pathname?: string | null): ErrorLogScope => {
  if (!pathname) return 'unknown';
  if (pathname.startsWith('/donor')) return 'donor';
  if (pathname.startsWith('/ngo')) return 'ngo';
  if (pathname.startsWith('/bloodbank') || pathname.startsWith('/hospital')) return 'bloodbank';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'unknown';
};

const getRoute = (): string | null => {
  const w = safeWindow();
  if (!w) return null;
  try {
    return `${w.location.pathname}${w.location.search || ''}`;
  } catch {
    return null;
  }
};

const sanitizeRoute = (rawRoute: string | null): string | null => {
  if (!rawRoute) return null;
  const w = safeWindow();
  const base = w?.location?.origin || 'https://localhost';
  try {
    const parsed = new URL(rawRoute, base);
    const nextParams = new URLSearchParams();
    let count = 0;
    parsed.searchParams.forEach((value, key) => {
      if (count >= 12) return;
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveRouteParamPatterns.some((pattern) => keyLower.includes(pattern));
      const sanitizedValue = isSensitive
        ? '[REDACTED]'
        : truncate(sanitizeText(value), 80);
      nextParams.set(key, sanitizedValue);
      count += 1;
    });
    const suffix = nextParams.toString();
    return truncate(`${parsed.pathname}${suffix ? `?${suffix}` : ''}`, MAX_ROUTE_LEN);
  } catch {
    return truncate(sanitizeText(rawRoute), MAX_ROUTE_LEN);
  }
};

const getSessionId = (): string => {
  const w = safeWindow();
  if (!w) return 'server-session';
  try {
    const existing = w.sessionStorage.getItem(ERROR_SESSION_ID_KEY);
    if (existing) return existing;
    const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    w.sessionStorage.setItem(ERROR_SESSION_ID_KEY, next);
    return next;
  } catch {
    return `ephemeral-${Date.now()}`;
  }
};

const readUserRole = (): string | null => {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: string };
    return typeof parsed?.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
};

const readImpersonationContext = (): { isImpersonating: boolean; impersonationActorUid: string | null } => {
  const w = safeWindow();
  if (!w) return { isImpersonating: false, impersonationActorUid: null };
  try {
    const raw = w.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!raw) return { isImpersonating: false, impersonationActorUid: null };
    const parsed = JSON.parse(raw) as { actorUid?: string; targetUid?: string };
    const currentUid = auth.currentUser?.uid ?? null;
    const isImpersonating = Boolean(parsed?.targetUid && currentUid && parsed.targetUid === currentUid);
    return {
      isImpersonating,
      impersonationActorUid: isImpersonating ? parsed.actorUid || null : null,
    };
  } catch {
    return { isImpersonating: false, impersonationActorUid: null };
  }
};

const sanitizeMetadata = (value: unknown, depth: number = 0): unknown => {
  if (depth > 3) return '[MAX_DEPTH]';
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value === 'string') return truncate(sanitizeText(value), 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => {
      const sanitized = sanitizeMetadata(item, depth + 1);
      return sanitized === undefined ? null : sanitized;
    });
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).slice(0, 60).forEach(([key, val]) => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
      const sanitized = sanitizeMetadata(val, depth + 1);
      if (sanitized !== undefined) {
        out[key] = sanitized;
      }
    });
    return out;
  }
  return String(value);
};

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `e${Math.abs(hash)}`;
};

const toErrorParts = (error: unknown): { message: string; stack: string | null; code: string | null } => {
  if (error instanceof Error) {
    const coded = error as Error & { code?: string };
    return {
      message: error.message || 'Unknown error',
      stack: error.stack || null,
      code: typeof coded.code === 'string' ? coded.code : null,
    };
  }

  if (typeof error === 'string') {
    return { message: error, stack: null, code: null };
  }

  if (typeof error === 'object' && error !== null) {
    const anyErr = error as { message?: unknown; stack?: unknown; code?: unknown };
    return {
      message: typeof anyErr.message === 'string' ? anyErr.message : JSON.stringify(sanitizeMetadata(anyErr)),
      stack: typeof anyErr.stack === 'string' ? anyErr.stack : null,
      code: typeof anyErr.code === 'string' ? anyErr.code : null,
    };
  }

  return { message: String(error), stack: null, code: null };
};

const shouldIgnoreMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return noisyMessagePatterns.some((pattern) => normalized.includes(pattern));
};

const buildPayload = (error: unknown, context?: ErrorLogContext): ErrorLogPayload => {
  const route = sanitizeRoute(context?.route || getRoute());
  const inferredScope = context?.scope || inferScopeFromPath(route);
  const errorParts = toErrorParts(error);
  const impersonationContext = readImpersonationContext();
  const userUid = auth.currentUser?.uid || null;
  const userRole = readUserRole();
  const message = truncate(sanitizeText(errorParts.message), MAX_MESSAGE_LEN);
  const stack = errorParts.stack ? truncate(sanitizeText(errorParts.stack), MAX_STACK_LEN) : null;
  const sanitizedMetadata = sanitizeMetadata(context?.metadata || null);
  const metadataJson = sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null;
  let metadata: Record<string, unknown> | null = null;
  if (metadataJson) {
    if (metadataJson.length <= MAX_METADATA_JSON_LEN && sanitizedMetadata && typeof sanitizedMetadata === 'object') {
      metadata = sanitizedMetadata as Record<string, unknown>;
    } else {
      metadata = { truncated: true, preview: truncate(metadataJson, MAX_METADATA_JSON_LEN) };
    }
  }

  const fingerprintSeed = [
    context?.source || 'frontend',
    inferredScope,
    context?.level || 'error',
    context?.code || errorParts.code || 'none',
    route || 'unknown',
    message,
  ].join('|');

  return {
    source: context?.source || 'frontend',
    scope: inferredScope,
    level: context?.level || 'error',
    message,
    code: context?.code || errorParts.code || null,
    route,
    stack,
    userUid,
    userRole,
    isImpersonating: context?.isImpersonating ?? impersonationContext.isImpersonating,
    impersonationActorUid: context?.impersonationActorUid ?? impersonationContext.impersonationActorUid,
    fingerprint: simpleHash(fingerprintSeed),
    sessionId: getSessionId(),
    metadata,
  };
};

const shouldDedupe = (fingerprint: string): boolean => {
  const now = Date.now();
  if (inMemoryDedupe.size > MAX_DEDUPE_ENTRIES) {
    const staleBefore = now - DEDUPE_WINDOW_MS;
    inMemoryDedupe.forEach((at, key) => {
      if (at < staleBefore) inMemoryDedupe.delete(key);
    });
    if (inMemoryDedupe.size > MAX_DEDUPE_ENTRIES) {
      const oldestKey = inMemoryDedupe.keys().next().value;
      if (oldestKey) inMemoryDedupe.delete(oldestKey);
    }
  }
  const previous = inMemoryDedupe.get(fingerprint);
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    return true;
  }
  inMemoryDedupe.set(fingerprint, now);
  return false;
};

const shouldRateLimitConsole = (kind?: string): boolean => {
  if (kind !== 'console.error') return false;
  const w = safeWindow();
  if (!w) return false;
  const key = '__bh_console_error_rate_limit';
  try {
    const raw = w.sessionStorage.getItem(key);
    const now = Date.now();
    const parsed = raw ? (JSON.parse(raw) as { windowStart?: number; count?: number }) : {};
    const windowStart = typeof parsed.windowStart === 'number' ? parsed.windowStart : now;
    const count = typeof parsed.count === 'number' ? parsed.count : 0;

    if (now - windowStart > CONSOLE_RATE_WINDOW_MS) {
      w.sessionStorage.setItem(key, JSON.stringify({ windowStart: now, count: 1 }));
      return false;
    }
    if (count >= CONSOLE_RATE_LIMIT) return true;
    w.sessionStorage.setItem(key, JSON.stringify({ windowStart, count: count + 1 }));
    return false;
  } catch {
    return false;
  }
};

const readQueue = (): ErrorLogPayload[] => {
  const w = safeWindow();
  if (!w) return [];
  try {
    const raw = w.sessionStorage.getItem(ERROR_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ErrorLogPayload[];
  } catch {
    return [];
  }
};

const writeQueue = (queue: ErrorLogPayload[]): void => {
  const w = safeWindow();
  if (!w) return;
  try {
    w.sessionStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {
    // ignore queue storage failures
  }
};

const enqueue = (payload: ErrorLogPayload): void => {
  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
};

const writePayload = async (payload: ErrorLogPayload): Promise<void> => {
  const compactPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined)
  );
  await addDoc(collection(db, 'errorLogs'), {
    ...compactPayload,
    createdAt: serverTimestamp(),
  });
};

export const flushQueuedErrorLogs = async (): Promise<void> => {
  if (!auth.currentUser) return;
  const queue = readQueue();
  if (!queue.length) return;
  const remaining: ErrorLogPayload[] = [];

  for (const payload of queue) {
    try {
      await writePayload({
        ...payload,
        userUid: payload.userUid || auth.currentUser.uid,
      });
    } catch {
      remaining.push(payload);
    }
  }

  writeQueue(remaining);
};

export const captureError = async (error: unknown, context?: ErrorLogContext): Promise<void> => {
  try {
    const payload = buildPayload(error, context);
    if (!payload.message || shouldIgnoreMessage(payload.message)) return;
    if (shouldRateLimitConsole(typeof context?.metadata?.kind === 'string' ? context.metadata.kind : undefined)) return;
    if (shouldDedupe(payload.fingerprint)) return;

    if (!auth.currentUser) {
      enqueue(payload);
      return;
    }

    const now = Date.now();
    if (!queueFlushInFlight && now - lastQueueFlushAt > QUEUE_FLUSH_INTERVAL_MS) {
      queueFlushInFlight = true;
      try {
        await flushQueuedErrorLogs();
      } finally {
        lastQueueFlushAt = Date.now();
        queueFlushInFlight = false;
      }
    }

    await writePayload(payload);
  } catch {
    // Prevent logging failures from cascading into app failures.
  }
};

export const captureHandledError = async (
  error: unknown,
  context?: Omit<ErrorLogContext, 'level'>
): Promise<void> => {
  await captureError(error, { ...context, level: 'warning' });
};

export const captureFatalError = async (
  error: unknown,
  context?: Omit<ErrorLogContext, 'level'>
): Promise<void> => {
  await captureError(error, { ...context, level: 'error' });
};

export type { ErrorLogContext, ErrorLogLevel, ErrorLogScope, ErrorLogSource };
