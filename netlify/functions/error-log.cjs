const sanitizeText = (input) => String(input || '')
  .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
  .replace(/\b\+?\d[\d\s()-]{8,}\d\b/g, '[REDACTED_PHONE]')
  .replace(/(token|idToken|accessToken|refreshToken|authorization|password)=([^&\s]+)/gi, '$1=[REDACTED]');

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

const DEDUPE_WINDOW_MS = 30 * 1000;
const THROTTLE_WINDOW_MS = 60 * 1000;
const THROTTLE_LIMIT_PER_KEY = 15;
const MAX_RATE_KEYS = 1200;
const rateMap = new Map();

const getHeader = (headers, name) => {
  if (!headers || typeof headers !== 'object' || !name) return null;
  const direct = headers[name];
  if (direct != null) return direct;
  const loweredName = String(name).toLowerCase();
  const foundKey = Object.keys(headers).find((key) => String(key).toLowerCase() === loweredName);
  return foundKey ? headers[foundKey] : null;
};

const truncate = (value, max) => {
  if (!value || value.length <= max) return value || null;
  return `${value.slice(0, max)}...[truncated]`;
};

const sanitizeRoute = (rawRoute) => {
  if (!rawRoute) return null;
  try {
    const parsed = new URL(String(rawRoute), 'https://localhost');
    const params = new URLSearchParams();
    let count = 0;
    parsed.searchParams.forEach((value, key) => {
      if (count >= 12) return;
      const keyLower = String(key).toLowerCase();
      const isSensitive = sensitiveRouteParamPatterns.some((pattern) => keyLower.includes(pattern));
      params.set(key, isSensitive ? '[REDACTED]' : truncate(sanitizeText(value), 80));
      count += 1;
    });
    const suffix = params.toString();
    return truncate(`${parsed.pathname}${suffix ? `?${suffix}` : ''}`, 320);
  } catch {
    return truncate(sanitizeText(String(rawRoute)), 320);
  }
};

const inferScope = (route) => {
  if (!route) return 'unknown';
  if (route.includes('admin')) return 'admin';
  if (route.includes('donor')) return 'donor';
  if (route.includes('ngo')) return 'ngo';
  if (route.includes('bloodbank') || route.includes('hospital')) return 'bloodbank';
  if (route.includes('login') || route.includes('register')) return 'auth';
  return 'unknown';
};

const simpleHash = (value) => {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `n${Math.abs(hash)}`;
};

const normalizeMethod = (value) => {
  if (!value) return 'UNKNOWN';
  return String(value).toUpperCase();
};

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return null;
};

const buildFingerprint = ({ route, method, code, message, stack }) => {
  const topStackLine = stack ? String(stack).split('\n')[0] : '';
  const seed = [
    route || 'unknown',
    normalizeMethod(method),
    code || 'none',
    String(message || '').slice(0, 220),
    topStackLine.slice(0, 220),
  ].join('|');
  return simpleHash(seed);
};

const cleanupRateMap = (now) => {
  if (rateMap.size <= MAX_RATE_KEYS) return;
  const staleBefore = now - THROTTLE_WINDOW_MS;
  rateMap.forEach((entry, key) => {
    if (!entry || entry.windowStart < staleBefore) {
      rateMap.delete(key);
    }
  });
  if (rateMap.size > MAX_RATE_KEYS) {
    while (rateMap.size > MAX_RATE_KEYS) {
      const oldestKey = rateMap.keys().next().value;
      if (!oldestKey) break;
      rateMap.delete(oldestKey);
    }
  }
};

const shouldThrottleInMemory = ({ route, fingerprint }) => {
  const now = Date.now();
  cleanupRateMap(now);
  const rateKey = `${route || 'unknown'}::${fingerprint}`;
  const current = rateMap.get(rateKey);
  if (!current || now - current.windowStart > THROTTLE_WINDOW_MS) {
    rateMap.set(rateKey, { windowStart: now, count: 1, lastAt: now });
    return false;
  }
  if (now - current.lastAt < DEDUPE_WINDOW_MS) {
    current.count += 1;
    current.lastAt = now;
    rateMap.set(rateKey, current);
    return true;
  }
  if (current.count >= THROTTLE_LIMIT_PER_KEY) {
    current.lastAt = now;
    rateMap.set(rateKey, current);
    return true;
  }
  current.count += 1;
  current.lastAt = now;
  rateMap.set(rateKey, current);
  return false;
};

const safeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  const output = {};
  const seen = new WeakSet();
  const safeStringify = (value) => {
    try {
      return JSON.stringify(value, (_key, nestedValue) => {
        if (typeof nestedValue === 'object' && nestedValue !== null) {
          if (seen.has(nestedValue)) return '[Circular]';
          seen.add(nestedValue);
        }
        return nestedValue;
      });
    } catch {
      return String(value);
    }
  };
  Object.entries(metadata).slice(0, 30).forEach(([key, value]) => {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
    if (value == null) {
      output[key] = value;
      return;
    }
    if (typeof value === 'string') {
      output[key] = truncate(sanitizeText(value), 1000);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
      return;
    }
    output[key] = truncate(sanitizeText(safeStringify(value)), 1000);
  });
  return output;
};

const hasRecentDuplicateInFirestore = async (db, fingerprint) => {
  try {
    const now = Date.now();
    const orderedSnap = await db.collection('errorLogs')
      .where('fingerprint', '==', fingerprint)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    if (orderedSnap.empty) return false;
    const orderedMatch = orderedSnap.docs.some((doc) => {
      const createdAtMs = toMillis(doc.data()?.createdAt);
      return typeof createdAtMs === 'number' && now - createdAtMs < DEDUPE_WINDOW_MS;
    });
    if (orderedMatch) return true;
  } catch {
    // Fallback query without orderBy in case index is unavailable.
  }

  try {
    const snap = await db.collection('errorLogs')
      .where('fingerprint', '==', fingerprint)
      .limit(3)
      .get();
    if (snap.empty) return false;
    const now = Date.now();
    return snap.docs.some((doc) => {
      const createdAtMs = toMillis(doc.data()?.createdAt);
      return typeof createdAtMs === 'number' && now - createdAtMs < DEDUPE_WINDOW_MS;
    });
  } catch {
    return false;
  }
};

const logNetlifyError = async ({ admin, event, error, route, scope, actorUid, actorRole, metadata }) => {
  try {
    if (!admin?.apps?.length) return;
    const db = admin.firestore();
    const message = truncate(sanitizeText(error?.message || String(error || 'Netlify function error')), 600);
    const stack = truncate(sanitizeText(error?.stack || ''), 4000);
    const code = typeof error?.code === 'string' ? error.code : null;
    const resolvedRoute = sanitizeRoute(route || event?.path || null);
    const resolvedMethod = event?.httpMethod || null;
    const fingerprint = buildFingerprint({
      route: resolvedRoute,
      method: resolvedMethod,
      code,
      message,
      stack,
    });
    if (shouldThrottleInMemory({ route: resolvedRoute, fingerprint })) return;
    if (await hasRecentDuplicateInFirestore(db, fingerprint)) return;

    await db.collection('errorLogs').add({
      source: 'netlify',
      scope: scope || inferScope(resolvedRoute || ''),
      level: 'error',
      message,
      code,
      route: resolvedRoute,
      stack,
      userUid: actorUid || null,
      userRole: actorRole || null,
      isImpersonating: false,
      impersonationActorUid: null,
      fingerprint,
      sessionId: null,
      metadata: safeMetadata({
        ...metadata,
        method: resolvedMethod,
        requestId: getHeader(event?.headers, 'x-nf-request-id'),
      }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    // ignore logging failures
  }
};

module.exports = {
  logNetlifyError,
};
