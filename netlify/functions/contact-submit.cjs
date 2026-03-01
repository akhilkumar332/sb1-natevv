const admin = require('firebase-admin');
const crypto = require('crypto');
const { logNetlifyError } = require('./error-log.cjs');

const CONTACT_SUBMISSIONS_COLLECTION = 'contactSubmissions';
const CONTACT_RATE_LIMITS_COLLECTION = 'contactRateLimits';
const CONTACT_STATUS_UNREAD = 'unread';
const DEFAULT_RATE_LIMIT_MAX_PER_MINUTE = 5;

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIELD_LIMITS = {
  name: 120,
  email: 160,
  phone: 24,
  subject: 64,
  message: 2000,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const normalizeText = (value, maxLen) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.slice(0, maxLen);
};

const hashValue = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const getClientIp = (headers) => {
  const forwarded = headers?.['x-forwarded-for']
    || headers?.['x-nf-client-connection-ip']
    || headers?.['client-ip']
    || '';
  if (!forwarded) return 'unknown';
  return String(forwarded).split(',')[0].trim() || 'unknown';
};

const getRateLimitMaxPerMinute = () => {
  const value = Number(process.env.CONTACT_RATE_LIMIT_MAX_PER_MINUTE);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RATE_LIMIT_MAX_PER_MINUTE;
  return Math.floor(value);
};

const parseBody = (rawBody) => {
  try {
    const parsed = JSON.parse(rawBody || '{}');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const validatePayload = (payload) => {
  const name = normalizeText(payload?.name, FIELD_LIMITS.name);
  const email = normalizeText(payload?.email, FIELD_LIMITS.email).toLowerCase();
  const phone = normalizeText(payload?.phone, FIELD_LIMITS.phone);
  const subject = normalizeText(payload?.subject, FIELD_LIMITS.subject);
  const message = normalizeText(payload?.message, FIELD_LIMITS.message);
  if (!name) return { error: 'Name is required.' };
  if (!email || !EMAIL_REGEX.test(email)) return { error: 'Valid email is required.' };
  if (!subject) return { error: 'Subject is required.' };
  if (!message) return { error: 'Message is required.' };

  return {
    data: {
      name,
      email,
      phone: phone || null,
      subject,
      message,
    },
  };
};

const enforceRateLimit = async ({ db, clientIp, email }) => {
  const maxPerMinute = getRateLimitMaxPerMinute();
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000);
  const keyHash = hashValue(`${clientIp}:${email}`);
  const docId = `${keyHash}:${minuteBucket}`;
  const ref = db.collection(CONTACT_RATE_LIMITS_COLLECTION).doc(docId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const currentCount = snap.exists ? Number(snap.data()?.count || 0) : 0;
    if (currentCount >= maxPerMinute) {
      const error = new Error('rate_limited');
      error.code = 'rate_limited';
      throw error;
    }
    transaction.set(ref, {
      keyHash,
      count: currentCount + 1,
      minuteBucket,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis((minuteBucket + 2) * 60000),
    }, { merge: true });
  });
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: RESPONSE_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const payload = parseBody(event.body);
  if (!payload) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Invalid JSON payload.' }),
    };
  }

  const validation = validatePayload(payload);
  if (validation.error) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: validation.error }),
    };
  }

  const { name, email, phone, subject, message } = validation.data;
  const clientIp = getClientIp(event.headers || {});
  const userAgent = String(event.headers?.['user-agent'] || '');

  try {
    initAdmin();
    const db = admin.firestore();

    await enforceRateLimit({ db, clientIp, email });

    await db.collection(CONTACT_SUBMISSIONS_COLLECTION).add({
      name,
      email,
      phone,
      subject,
      message,
      status: CONTACT_STATUS_UNREAD,
      sourceIpHash: hashValue(clientIp),
      userAgentHash: hashValue(userAgent),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    if (error?.code === 'rate_limited') {
      return {
        statusCode: 429,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Too many submissions. Please wait and try again.' }),
      };
    }

    await logNetlifyError({
      admin,
      event,
      error,
      route: '/.netlify/functions/contact-submit',
      scope: 'unknown',
      metadata: {
        functionName: 'contact-submit',
      },
    });

    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Unable to submit contact form right now.' }),
    };
  }
};
