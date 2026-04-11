import admin from 'firebase-admin';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import {
  RP_NAME,
  initAdmin,
  getBearerToken,
  parseJsonBody,
  baseCorsHeaders,
  jsonResponse,
  createChallengeRecord,
  resolveRequestOrigin,
  resolveRpId,
} from './_webauthn.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseCorsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const idToken = getBearerToken(event.headers || {});
  if (!idToken) {
    return jsonResponse(401, { error: 'Missing auth token' });
  }

  const payload = parseJsonBody(event.body);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
  if (!userId) {
    return jsonResponse(400, { error: 'Missing userId' });
  }

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      return jsonResponse(403, { error: 'Forbidden' });
    }

    const db = admin.firestore();
    const origin = resolveRequestOrigin(event.headers || {});
    const rpId = resolveRpId(origin);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return jsonResponse(404, { error: 'User not found' });
    }

    const userData = userDoc.data() || {};
    const existingSnap = await db
      .collection('users')
      .doc(userId)
      .collection('webauthnCredentials')
      .get();

    const excludeCredentials = existingSnap.docs.map((docSnapshot) => ({
      id: docSnapshot.data().credentialId,
      type: 'public-key',
      transports: docSnapshot.data().transports || [],
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId,
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

    const challengeId = await createChallengeRecord({
      db,
      type: 'registration',
      userId,
      challenge: options.challenge,
      rpId,
      origin,
      metadata: {
        route: 'webauthn-register-challenge',
      },
    });

    return jsonResponse(200, { challengeId, options });
  } catch (err) {
    console.error('webauthn-register-challenge error:', err);
    return jsonResponse(500, { error: err?.message || 'Internal error' });
  }
};
