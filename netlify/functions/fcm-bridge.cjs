const admin = require('firebase-admin');
const crypto = require('crypto');
const { logNetlifyError } = require('./error-log.cjs');

const VALID_TYPES = new Set([
  'emergency_request',
  'donor_request',
  'appointment_reminder',
  'campaign_invite',
  'donation_confirmation',
  'verification_status',
  'achievement',
  'referral',
  'general',
]);

const VALID_PRIORITIES = new Set(['high', 'medium', 'low', 'urgent', 'normal']);
const VALID_ROLES = new Set(['donor', 'ngo', 'bloodbank']);
const UID_PATTERN = /^[A-Za-z0-9:_-]{6,128}$/;
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 40;
const MAX_RATE_KEYS = 1500;
const rateMap = new Map();

const normalizePriority = (value) => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase()
    : value != null
      ? String(value).toLowerCase()
      : undefined;
  if (!normalized || !VALID_PRIORITIES.has(normalized)) return 'low';
  if (normalized === 'urgent') return 'high';
  if (normalized === 'normal') return 'medium';
  return normalized;
};

const normalizeType = (value) => {
  if (!value) return 'general';
  const normalized = (typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase());
  return VALID_TYPES.has(normalized) ? normalized : 'general';
};

const resolveDefaultActionUrl = (role) => {
  switch (role) {
    case 'ngo':
      return '/ngo/dashboard?panel=notifications';
    case 'bloodbank':
      return '/bloodbank/dashboard?panel=notifications';
    case 'donor':
    default:
      return '/donor/dashboard?panel=notifications';
  }
};

const toSafeString = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
};

const sanitizeMessageId = (rawId) => {
  if (!rawId) return null;
  const normalized = String(rawId).trim();
  if (!normalized) return null;
  return normalized.replace(/[^\w.-]/g, '_').slice(0, 120) || null;
};

const sanitizeActionUrl = (value, role) => {
  if (!value) return resolveDefaultActionUrl(role);
  const raw = String(value).trim();
  if (!raw || raw.length > 320) return resolveDefaultActionUrl(role);
  if (!raw.startsWith('/') || raw.startsWith('//')) return resolveDefaultActionUrl(role);
  const lowered = raw.toLowerCase();
  if (lowered.startsWith('/javascript:') || lowered.includes('\n') || lowered.includes('\r')) {
    return resolveDefaultActionUrl(role);
  }
  return raw;
};

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
};

const getAuthToken = (headers) => {
  const authHeader = headers?.authorization || headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const getClientIp = (headers) => {
  const forwarded = headers?.['x-forwarded-for']
    || headers?.['x-nf-client-connection-ip']
    || headers?.['client-ip']
    || '';
  if (!forwarded) return 'unknown';
  return String(forwarded).split(',')[0].trim() || 'unknown';
};

const isValidSignature = ({ headers, rawBody }) => {
  const secret = process.env.FCM_BRIDGE_SIGNING_SECRET;
  if (!secret) return false;

  const providedSignature = headers?.['x-bridge-signature'] || headers?.['X-Bridge-Signature'];
  const providedTimestamp = headers?.['x-bridge-timestamp'] || headers?.['X-Bridge-Timestamp'];
  if (!providedSignature || !providedTimestamp) return false;

  const ts = Number(providedTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > TIMESTAMP_WINDOW_MS) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody || ''}`)
    .digest('hex');

  const left = Buffer.from(String(providedSignature), 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const cleanupRateMap = (now) => {
  if (rateMap.size <= MAX_RATE_KEYS) return;
  const staleBefore = now - RATE_LIMIT_WINDOW_MS;
  rateMap.forEach((entry, key) => {
    if (!entry || entry.windowStart < staleBefore) {
      rateMap.delete(key);
    }
  });
};

const checkRateLimit = (key) => {
  const now = Date.now();
  cleanupRateMap(now);
  const current = rateMap.get(key);
  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(key, { windowStart: now, count: 1 });
    return false;
  }
  if (current.count >= RATE_LIMIT_PER_WINDOW) {
    return true;
  }
  current.count += 1;
  rateMap.set(key, current);
  return false;
};

const validateAndNormalize = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Invalid payload' };
  }

  const fcmPayload = payload.payload && typeof payload.payload === 'object' ? payload.payload : {};
  const rawUserId = payload.userId || fcmPayload?.data?.userId;
  const userId = toSafeString(rawUserId);
  if (!UID_PATTERN.test(userId)) {
    return { error: 'Invalid userId' };
  }

  const resolvedRole = toSafeString(payload.userRole || fcmPayload?.data?.userRole || fcmPayload?.data?.role || 'donor').toLowerCase();
  const userRole = VALID_ROLES.has(resolvedRole) ? resolvedRole : 'donor';

  const title = toSafeString(fcmPayload?.notification?.title || fcmPayload?.data?.title || 'Notification').slice(0, 120);
  const message = toSafeString(fcmPayload?.notification?.body || fcmPayload?.data?.body || '').slice(0, 1000);
  const type = normalizeType(fcmPayload?.data?.type);
  const priority = normalizePriority(fcmPayload?.data?.priority);
  const actionUrl = sanitizeActionUrl(
    fcmPayload?.data?.route
      || fcmPayload?.data?.url
      || fcmPayload?.data?.link
      || fcmPayload?.data?.click_action,
    userRole
  );
  const messageId = sanitizeMessageId(payload.messageId || fcmPayload?.messageId || fcmPayload?.data?.messageId);

  return {
    data: {
      userId,
      userRole,
      title,
      message,
      type,
      priority,
      actionUrl,
      messageId,
      fcmPayload,
    },
  };
};

const buildDocId = (userId, payload, fallbackId) => {
  const rawId = sanitizeMessageId(payload?.messageId || payload?.data?.messageId || fallbackId);
  if (!rawId) return null;
  return `fcm_${userId}_${rawId}`;
};

exports.handler = async (event) => {
  const responseHeaders = {
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: responseHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const rawBody = event.body || '{}';
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const normalized = validateAndNormalize(payload);
  if (normalized.error) {
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: normalized.error }) };
  }

  const {
    userId,
    userRole,
    title,
    message,
    type,
    priority,
    actionUrl,
    messageId,
    fcmPayload,
  } = normalized.data;

  const clientIp = getClientIp(event.headers || {});
  const idToken = getAuthToken(event.headers || {});
  const hasSignature = isValidSignature({ headers: event.headers || {}, rawBody });
  let actorUid = null;
  let authMode = hasSignature ? 'signature' : 'none';

  if (idToken) {
    try {
      initAdmin();
      const decoded = await admin.auth().verifyIdToken(idToken);
      actorUid = decoded.uid;
      authMode = 'token';
      if (decoded.uid !== userId) {
        return { statusCode: 403, headers: responseHeaders, body: JSON.stringify({ error: 'Forbidden userId mismatch' }) };
      }
    } catch {
      if (!hasSignature) {
        return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Invalid auth token' }) };
      }
    }
  }

  if (!idToken && !hasSignature) {
    return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Missing authentication' }) };
  }

  if (checkRateLimit(`${clientIp}:${actorUid || userId || 'unknown'}`)) {
    return { statusCode: 429, headers: responseHeaders, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const docData = {
    userId,
    userRole,
    type,
    title,
    message,
    read: false,
    priority,
    actionUrl,
    createdAt: admin.firestore.Timestamp.now(),
    createdAtServer: admin.firestore.FieldValue.serverTimestamp(),
    source: 'fcm_bridge',
    authMode,
  };

  const docId = buildDocId(userId, fcmPayload, messageId || payload.messageId);

  try {
    initAdmin();
    const db = admin.firestore();
    if (docId) {
      await db.collection('notifications').doc(docId).set(docData, { merge: true });
      return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, id: docId }) };
    }
    const ref = await db.collection('notifications').add(docData);
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, id: ref.id }) };
  } catch (error) {
    await logNetlifyError({
      admin,
      event,
      error,
      route: '/.netlify/functions/fcm-bridge',
      scope: 'unknown',
      actorUid: actorUid || userId || null,
      actorRole: userRole || null,
      metadata: {
        functionName: 'fcm-bridge',
        authMode,
      },
    });
    return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};
