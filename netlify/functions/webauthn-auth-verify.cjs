// netlify/functions/webauthn-auth-verify.cjs
// Verifies a WebAuthn authentication assertion and returns a Firebase custom token.
const admin = require('firebase-admin');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');

const RP_ID = 'bloodhub.in';
const EXPECTED_ORIGINS = ['https://bloodhub.in', 'https://beta.bloodhub.in', 'https://www.bloodhub.in'];

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
  const credential = payload?.credential;
  if (!userId || !credential) return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId or credential' }) };

  try {
    initAdmin();
    const db = admin.firestore();

    // Retrieve and validate challenge
    const challengeDoc = await db.collection('users').doc(userId).collection('webauthnChallenges').doc('authentication').get();
    if (!challengeDoc.exists) return { statusCode: 400, body: JSON.stringify({ error: 'No pending challenge' }) };
    const { challenge, expiresAt } = challengeDoc.data();
    if (Date.now() > expiresAt) {
      await challengeDoc.ref.delete();
      return { statusCode: 400, body: JSON.stringify({ error: 'Challenge expired' }) };
    }

    // Find the matching stored credential
    const credentialId = credential.id;
    const credDoc = await db.collection('users').doc(userId).collection('webauthnCredentials').doc(credentialId).get();
    if (!credDoc.exists) return { statusCode: 404, body: JSON.stringify({ error: 'Credential not found' }) };
    const storedCred = credDoc.data();

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: storedCred.credentialId,
        publicKey: Buffer.from(storedCred.publicKey, 'base64url'),
        counter: storedCred.counter,
        transports: storedCred.transports || [],
      },
    });

    if (!verification.verified) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authentication failed' }) };
    }

    // Update counter and lastUsedAt
    await credDoc.ref.update({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Delete challenge before minting token — prevents reuse if token mint fails
    await challengeDoc.ref.delete();

    // Mint Firebase custom token
    const customToken = await admin.auth().createCustomToken(userId, { biometric: true });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customToken }),
    };
  } catch (err) {
    console.error('webauthn-auth-verify error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
