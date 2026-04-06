// netlify/functions/webauthn-register-challenge.cjs
// Generates a WebAuthn registration challenge for an authenticated user.
const admin = require('firebase-admin');
const { generateRegistrationOptions } = require('@simplewebauthn/server');

const RP_NAME = 'BloodHub';
const RP_ID = 'bloodhub.in';
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const idToken = getAuthToken(event.headers || {});
  if (!idToken) return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.uid !== userId) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    const userData = userDoc.data() || {};

    // Fetch existing credentials to exclude from registration
    const existingSnap = await db.collection('users').doc(userId).collection('webauthnCredentials').get();
    const excludeCredentials = existingSnap.docs.map((d) => ({
      id: d.data().credentialId,
      type: 'public-key',
      transports: d.data().transports || [],
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(userId),
      userName: userData.phoneNumber || userData.email || userId,
      userDisplayName: userData.displayName || userData.phoneNumber || userId,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials,
    });

    // Store challenge server-side with TTL
    await db.collection('users').doc(userId).collection('webauthnChallenges').doc('registration').set({
      challenge: options.challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    };
  } catch (err) {
    console.error('webauthn-register-challenge error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
