// netlify/functions/webauthn-register-verify.mjs
import admin from 'firebase-admin';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

const RP_ID = 'bloodhub.in';
const EXPECTED_ORIGINS = ['https://bloodhub.in', 'https://beta.bloodhub.in', 'https://www.bloodhub.in'];

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin credentials.');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
};

const getAuthToken = (headers) => {
  const h = headers?.authorization || headers?.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const idToken = getAuthToken(event.headers || {});
  if (!idToken) return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  const credential = payload?.credential;
  if (!userId || !credential) return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId or credential' }) };

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.uid !== userId) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };

    const db = admin.firestore();

    const challengeDoc = await db.collection('users').doc(userId).collection('webauthnChallenges').doc('registration').get();
    if (!challengeDoc.exists) return { statusCode: 400, body: JSON.stringify({ error: 'No pending challenge' }) };
    const { challenge, expiresAt } = challengeDoc.data();
    if (Date.now() > expiresAt) {
      await challengeDoc.ref.delete();
      return { statusCode: 400, body: JSON.stringify({ error: 'Challenge expired' }) };
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Verification failed' }) };
    }

    const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // cred.id is already a base64url string in @simplewebauthn/server v10+
    const credentialId = cred.id;
    await db.collection('users').doc(userId).collection('webauthnCredentials').doc(credentialId).set({
      credentialId,
      publicKey: Buffer.from(cred.publicKey).toString('base64url'),
      counter: cred.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.response?.transports || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: (event.headers?.['user-agent'] || '').slice(0, 300),
    });

    await challengeDoc.ref.delete();

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, credentialId }),
    };
  } catch (err) {
    console.error('webauthn-register-verify error:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
