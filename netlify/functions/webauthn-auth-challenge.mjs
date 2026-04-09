// netlify/functions/webauthn-auth-challenge.mjs
import { webcrypto } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import admin from 'firebase-admin';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

const RP_ID = 'bloodhub.in';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin credentials.');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };

  try {
    initAdmin();
    const db = admin.firestore();

    const providedCredentialId = typeof payload?.credentialId === 'string' ? payload.credentialId.trim() : null;
    const providedTransports = Array.isArray(payload?.transports) ? payload.transports : [];

    let allowCredentials;
    if (providedCredentialId) {
      // Verify the provided credentialId actually exists in Firestore before using it
      const credDoc = await db.collection('users').doc(userId).collection('webauthnCredentials').doc(providedCredentialId).get();
      if (credDoc.exists) {
        allowCredentials = [{ id: providedCredentialId, type: 'public-key', transports: providedTransports }];
      } else {
        // Stale localStorage — fall back to reading all credentials and signal client to clear
        const credsSnap = await db.collection('users').doc(userId).collection('webauthnCredentials').get();
        allowCredentials = credsSnap.docs.map((d) => ({
          id: d.data().credentialId,
          type: 'public-key',
          transports: d.data().transports || [],
        }));
        // staleCredential flag tells client to clear its localStorage entry
        const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'required', allowCredentials });
        await db.collection('users').doc(userId).collection('webauthnChallenges').doc('authentication').set({
          challenge: options.challenge,
          expiresAt: Date.now() + CHALLENGE_TTL_MS,
        });
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...options, staleCredential: true }),
        };
      }
    } else {
      const credsSnap = await db.collection('users').doc(userId).collection('webauthnCredentials').get();
      allowCredentials = credsSnap.docs.map((d) => ({
        id: d.data().credentialId,
        type: 'public-key',
        transports: d.data().transports || [],
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials,
    });

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
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || 'Internal error' }) };
  }
};
