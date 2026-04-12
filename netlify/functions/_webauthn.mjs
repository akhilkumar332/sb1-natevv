import { webcrypto } from 'crypto';
import admin from 'firebase-admin';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

export const RP_NAME = 'BloodHub';
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const CHALLENGE_COLLECTION = 'webauthnChallenges';

const DEFAULT_ORIGINS = [
  'https://bloodhub.in',
  'https://beta.bloodhub.in',
  'https://www.bloodhub.in',
];

const toNormalizedOrigin = (value) => {
  if (!value) return null;
  try {
    return new URL(String(value).trim()).origin;
  } catch {
    return null;
  }
};

const toHostname = (value) => {
  if (!value) return null;
  try {
    return new URL(String(value).trim()).hostname;
  } catch {
    return null;
  }
};

const deploymentOrigins = [
  process.env.URL,
  process.env.DEPLOY_PRIME_URL,
  process.env.SITE_URL,
]
  .map(toNormalizedOrigin)
  .filter(Boolean);

const endsWithHost = (hostname, suffix) => (
  hostname === suffix || hostname.endsWith(`.${suffix}`)
);

const deriveRpIdFromHostname = (hostname) => {
  if (!hostname) return null;
  if (endsWithHost(hostname, 'bloodhub.in')) return 'bloodhub.in';
  if (endsWithHost(hostname, 'bloodhubindia.com')) return 'bloodhubindia.com';
  return hostname;
};

export const resolveRequestOrigin = (headers = {}) => {
  const normalizedOrigin = toNormalizedOrigin(headers.origin || headers.Origin);
  if (normalizedOrigin) {
    return normalizedOrigin;
  }

  const proto = String(headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https').trim();
  const host = String(
    headers['x-forwarded-host']
      || headers['X-Forwarded-Host']
      || headers.host
      || headers.Host
      || '',
  ).trim();

  if (!host) {
    return deploymentOrigins[0] || null;
  }

  return toNormalizedOrigin(`${proto}://${host}`) || deploymentOrigins[0] || null;
};

export const resolveRpId = (origin) => {
  if (process.env.WEBAUTHN_RP_ID) {
    return process.env.WEBAUTHN_RP_ID.trim();
  }

  const hostname = toHostname(origin) || toHostname(process.env.URL) || toHostname(process.env.SITE_URL);
  return deriveRpIdFromHostname(hostname) || 'bloodhub.in';
};

export const getExpectedOrigins = () => {
  const raw = process.env.WEBAUTHN_ALLOWED_ORIGINS || '';
  const configured = raw
    .split(',')
    .map(toNormalizedOrigin)
    .filter(Boolean);

  const localOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:5180',
        'http://localhost:4173',
        'http://localhost:8888',
        'http://127.0.0.1:5180',
        'http://127.0.0.1:4173',
        'http://127.0.0.1:8888',
      ];

  return Array.from(new Set([
    ...DEFAULT_ORIGINS,
    ...deploymentOrigins,
    ...localOrigins,
    ...configured,
  ]));
};

export const initAdmin = () => {
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

export const parseJsonBody = (body) => {
  try {
    return JSON.parse(body || '{}');
  } catch {
    return null;
  }
};

export const getBearerToken = (headers) => {
  const header = headers?.authorization || headers?.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

export const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const getRequestUserAgent = (headers = {}) => (
  String(headers['user-agent'] || headers['User-Agent'] || '').trim().slice(0, 300)
);

export const jsonResponse = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { ...baseCorsHeaders, 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

export const createChallengeRecord = async ({
  db,
  type,
  userId = null,
  challenge,
  rpId,
  origin,
  credentialId = null,
  metadata = null,
}) => {
  const challengeId = globalThis.crypto.randomUUID();
  await db.collection(CHALLENGE_COLLECTION).doc(challengeId).set({
    type,
    userId,
    challenge,
    rpId,
    origin,
    credentialId,
    metadata,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return challengeId;
};

export const getChallengeRecord = async (db, challengeId, expectedType) => {
  const challengeRef = db.collection(CHALLENGE_COLLECTION).doc(challengeId);
  const challengeDoc = await challengeRef.get();

  if (!challengeDoc.exists) {
    return { ref: challengeRef, data: null, status: 'missing' };
  }

  const data = challengeDoc.data() || {};
  if (data.type !== expectedType) {
    return { ref: challengeRef, data, status: 'wrong_type' };
  }

  if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) {
    await challengeRef.delete().catch(() => {});
    return { ref: challengeRef, data, status: 'expired' };
  }

  return { ref: challengeRef, data, status: 'ok' };
};

export const classifyWebAuthnVerificationError = (error, fallbackMessage) => {
  const message = String(error?.message || '').toLowerCase();
  
  if (message.includes('failed_precondition') || message.includes('failed-precondition')) {
    return null;
  }

  const likelyClientError = [
    'challenge',
    'origin',
    'rp id',
    'rpid',
    'credential',
    'authenticator',
    'signature',
    'counter',
    'malformed',
    'verification',
    'user verification',
  ].some((term) => message.includes(term));

  if (likelyClientError) {
    return {
      statusCode: 400,
      body: { error: fallbackMessage },
    };
  }

  return null;
};
