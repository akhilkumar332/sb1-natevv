// netlify/functions/webauthn-auth-challenge.cjs
// Generates a WebAuthn authentication challenge (pre-login, no auth token required).
const admin = require('firebase-admin');
const { generateAuthenticationOptions } = require('@simplewebauthn/server');

const RP_ID = 'bloodhub.in';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin credentials.');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };

  try {
    initAdmin();
    const db = admin.firestore();

    // Fetch registered credentials for this user
    const credsSnap = await db.collection('users').doc(userId).collection('webauthnCredentials').get();

    // Return empty allowCredentials if none registered — avoids user enumeration
    const allowCredentials = credsSnap.docs.map((d) => ({
      id: d.data().credentialId,
      type: 'public-key',
      transports: d.data().transports || [],
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials,
    });

    // Store challenge server-side
    await db.collection('users').doc(userId).collection('webauthnChallenges').doc('authentication').set({
      challenge: options.challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    };
  } catch (err) {
    console.error('webauthn-auth-challenge error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
