import admin from 'firebase-admin';
import crypto from 'crypto';
import { logFunctionError } from './error-log.cjs';

const CMS_SETTINGS_COLLECTION = 'cmsSettings';
const CMS_SETTINGS_DOC_ID = 'global';
// Firebase Hosting only forwards the specially named `__session` cookie
// to rewritten Functions requests.
const COOKIE_NAME = '__session';
const DEFAULT_TTL_MINUTES = 240;
const MAX_PASSWORD_LENGTH = 200;
const MAX_COOKIE_AGE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_MAX_ATTEMPTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateMap = new Map();

const FRONTEND_ACCESS_MODE = {
  OPEN: 'open',
  MAINTENANCE: 'maintenance',
  PASSWORD_PROTECTED: 'password_protected',
};

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const initAdmin = () => {
  if (admin.apps.length) return;
  admin.initializeApp();
};

const normalizeText = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

const getConfiguredPassword = () => normalizeText(process.env.FRONTEND_GATE_PASSWORD, MAX_PASSWORD_LENGTH);
const getSessionSecret = () => normalizeText(process.env.FRONTEND_GATE_SESSION_SECRET, 512);

const isConfigured = () => Boolean(getConfiguredPassword() && getSessionSecret());

const getClientIp = (headers) => {
  const forwarded = headers?.['x-forwarded-for']
    || headers?.['x-nf-client-connection-ip']
    || headers?.['client-ip']
    || '';
  if (!forwarded) return 'unknown';
  return String(forwarded).split(',')[0].trim() || 'unknown';
};

const getMaxAttemptsPerMinute = () => {
  const value = Number(process.env.FRONTEND_GATE_MAX_ATTEMPTS_PER_MINUTE);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_ATTEMPTS_PER_MINUTE;
  return Math.floor(value);
};

const getResponseHeaders = (event) => {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  if (!origin) return RESPONSE_HEADERS;
  return {
    ...RESPONSE_HEADERS,
    'Access-Control-Allow-Origin': String(origin),
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
};

const getCookieValue = (headers, name) => {
  const rawCookie = headers?.cookie || headers?.Cookie || '';
  if (!rawCookie) return null;
  const target = String(name).trim();
  const parts = String(rawCookie).split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === target) return rest.join('=');
  }
  return null;
};

const toBase64Url = (value) => Buffer.from(value, 'utf8').toString('base64url');
const fromBase64Url = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signValue = (value, secret) => (
  crypto.createHmac('sha256', secret).update(value).digest('base64url')
);

const shouldUseSecureCookies = (event) => {
  const forwardedProto = event?.headers?.['x-forwarded-proto'] || event?.headers?.['X-Forwarded-Proto'] || '';
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  return String(forwardedProto).toLowerCase() === 'https' || String(origin).toLowerCase().startsWith('https://');
};

const buildCookieAttributes = ({ maxAgeSeconds, secure }) => [
  `Max-Age=${maxAgeSeconds}`,
  'Path=/',
  'HttpOnly',
  'SameSite=Lax',
  ...(secure ? ['Secure'] : []),
].join('; ');

const buildSessionCookie = ({ expiresAtMs, secret, maxAgeSeconds, secure }) => {
  const payload = JSON.stringify({ expiresAtMs });
  const encodedPayload = toBase64Url(payload);
  const signature = signValue(encodedPayload, secret);
  const token = `${encodedPayload}.${signature}`;
  return `${COOKIE_NAME}=${token}; ${buildCookieAttributes({ maxAgeSeconds, secure })}`;
};

const buildExpiredCookie = ({ secure }) => `${COOKIE_NAME}=; ${buildCookieAttributes({ maxAgeSeconds: 0, secure })}`;

const constantTimeEquals = (a, b) => {
  const aBuffer = Buffer.from(String(a ?? ''), 'utf8');
  const bBuffer = Buffer.from(String(b ?? ''), 'utf8');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

const cleanupRateMap = (now) => {
  rateMap.forEach((value, key) => {
    if (!value || now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateMap.delete(key);
    }
  });
};

const checkRateLimit = (headers) => {
  const now = Date.now();
  const maxAttempts = getMaxAttemptsPerMinute();
  cleanupRateMap(now);
  const key = getClientIp(headers);
  const current = rateMap.get(key);
  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(key, { windowStart: now, count: 1 });
    return false;
  }
  if (current.count >= maxAttempts) {
    return true;
  }
  current.count += 1;
  rateMap.set(key, current);
  return false;
};

const clearRateLimit = (headers) => {
  rateMap.delete(getClientIp(headers));
};

const readValidatedSession = ({ headers, secret }) => {
  const token = getCookieValue(headers, COOKIE_NAME);
  if (!token) return null;
  const [encodedPayload, providedSignature] = String(token).split('.');
  if (!encodedPayload || !providedSignature) return null;
  const expectedSignature = signValue(encodedPayload, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload));
    const expiresAtMs = Number(parsed?.expiresAtMs);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
    return { expiresAtMs };
  } catch {
    return null;
  }
};

const normalizeFrontendAccess = (raw) => {
  const data = raw && typeof raw === 'object' ? raw : {};
  const rawTtlMinutes = Number(data.passwordSessionTtlMinutes);
  return {
    mode: data.mode === FRONTEND_ACCESS_MODE.MAINTENANCE || data.mode === FRONTEND_ACCESS_MODE.PASSWORD_PROTECTED
      ? data.mode
      : FRONTEND_ACCESS_MODE.OPEN,
    passwordSessionTtlMinutes: Number.isFinite(rawTtlMinutes)
      ? Math.min(7 * 24 * 60, Math.max(5, Math.floor(rawTtlMinutes)))
      : DEFAULT_TTL_MINUTES,
  };
};

const getFrontendAccessSettings = async () => {
  initAdmin();
  const db = admin.firestore();
  const snapshot = await db.collection(CMS_SETTINGS_COLLECTION).doc(CMS_SETTINGS_DOC_ID).get();
  if (!snapshot.exists) {
    return normalizeFrontendAccess(null);
  }
  const data = snapshot.data() || {};
  return normalizeFrontendAccess(data.frontendAccess);
};

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    ...headers,
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const responseHeaders = getResponseHeaders(event);
  const secureCookies = shouldUseSecureCookies(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  try {
    const settings = await getFrontendAccessSettings();
    const configured = isConfigured();

    if (event.httpMethod === 'GET') {
      if (settings.mode !== FRONTEND_ACCESS_MODE.PASSWORD_PROTECTED) {
        return json(200, {
          ok: true,
          mode: settings.mode,
          unlocked: settings.mode === FRONTEND_ACCESS_MODE.OPEN,
          configured,
          ttlMinutes: settings.passwordSessionTtlMinutes,
        }, responseHeaders);
      }

      if (!configured) {
        return json(200, {
          ok: true,
          mode: settings.mode,
          unlocked: false,
          configured: false,
          ttlMinutes: settings.passwordSessionTtlMinutes,
        }, responseHeaders);
      }

      const session = readValidatedSession({
        headers: event.headers || {},
        secret: getSessionSecret(),
      });

      return json(200, {
        ok: true,
        mode: settings.mode,
        unlocked: Boolean(session),
        configured: true,
        ttlMinutes: settings.passwordSessionTtlMinutes,
      }, responseHeaders);
    }

    if (event.httpMethod === 'DELETE') {
      return {
        statusCode: 200,
        headers: {
          ...responseHeaders,
          'Set-Cookie': buildExpiredCookie({ secure: secureCookies }),
        },
        body: JSON.stringify({ ok: true, cleared: true }),
      };
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method Not Allowed' }, responseHeaders);
    }

    if (settings.mode !== FRONTEND_ACCESS_MODE.PASSWORD_PROTECTED) {
      return json(409, { error: 'Password protection is not enabled.' }, responseHeaders);
    }

    if (!configured) {
      return json(503, { error: 'Frontend access password is not configured.' }, responseHeaders);
    }

    if (checkRateLimit(event.headers || {})) {
      return json(429, { error: 'Too many password attempts. Please wait and try again.' }, responseHeaders);
    }

    let payload = null;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON payload.' }, responseHeaders);
    }

    const password = normalizeText(payload?.password, MAX_PASSWORD_LENGTH);
    if (!password) {
      return json(400, { error: 'Password is required.' }, responseHeaders);
    }

    if (!constantTimeEquals(password, getConfiguredPassword())) {
      return json(401, { error: 'Incorrect password.' }, responseHeaders);
    }

    const ttlMinutes = settings.passwordSessionTtlMinutes || DEFAULT_TTL_MINUTES;
    const maxAgeSeconds = Math.min(MAX_COOKIE_AGE_SECONDS, ttlMinutes * 60);
    const expiresAtMs = Date.now() + (maxAgeSeconds * 1000);
    clearRateLimit(event.headers || {});

    return {
      statusCode: 200,
      headers: {
        ...responseHeaders,
        'Set-Cookie': buildSessionCookie({
          expiresAtMs,
          secret: getSessionSecret(),
          maxAgeSeconds,
          secure: secureCookies,
        }),
      },
      body: JSON.stringify({
        ok: true,
        mode: settings.mode,
        unlocked: true,
        configured: true,
        ttlMinutes,
      }),
    };
  } catch (error) {
    try {
      await logFunctionError({
        admin,
        event,
        error,
        route: '/functions/frontend-access',
        scope: 'unknown',
        metadata: {
          functionName: 'frontend-access',
        },
      });
    } catch {
      // Do not mask the original failure if error logging also fails.
    }

    return json(500, {
      error: 'Unable to process frontend access right now.',
      ...(process.env.NODE_ENV === 'test' && error instanceof Error ? { details: error.message } : {}),
    }, responseHeaders);
  }
};
