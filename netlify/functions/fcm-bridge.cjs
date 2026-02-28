const admin = require('firebase-admin');
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

const buildDocId = (userId, payload, fallbackId) => {
  const rawId = payload?.messageId || payload?.data?.messageId || fallbackId;
  if (!rawId) return null;
  return `fcm_${userId}_${rawId}`;
};

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.VITE_FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload = null;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const fcmPayload = payload.payload || {};
  const userId = payload.userId || fcmPayload?.data?.userId;

  if (!userId) {
    return { statusCode: 400, body: 'Missing userId' };
  }

  const userRole = payload.userRole || fcmPayload?.data?.userRole || fcmPayload?.data?.role || 'donor';
  const title = fcmPayload?.notification?.title || fcmPayload?.data?.title || 'Notification';
  const message = fcmPayload?.notification?.body || fcmPayload?.data?.body || '';
  const actionUrl =
    fcmPayload?.data?.route ||
    fcmPayload?.data?.url ||
    fcmPayload?.data?.link ||
    fcmPayload?.data?.click_action ||
    resolveDefaultActionUrl(userRole);

  const docData = {
    userId,
    userRole,
    type: normalizeType(fcmPayload?.data?.type),
    title,
    message,
    read: false,
    priority: normalizePriority(fcmPayload?.data?.priority),
    actionUrl,
    createdAt: admin.firestore.Timestamp.now(),
    createdAtServer: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docId = buildDocId(userId, fcmPayload, payload.messageId);

  try {
    initAdmin();
    const db = admin.firestore();
    if (docId) {
      await db.collection('notifications').doc(docId).set(docData, { merge: true });
      return { statusCode: 200, body: JSON.stringify({ ok: true, id: docId }) };
    }
    const ref = await db.collection('notifications').add(docData);
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: ref.id }) };
  } catch (error) {
    await logNetlifyError({
      admin,
      event,
      error,
      route: '/.netlify/functions/fcm-bridge',
      scope: 'unknown',
      actorUid: userId || null,
      actorRole: userRole || null,
      metadata: {
        functionName: 'fcm-bridge',
      },
    });
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};
