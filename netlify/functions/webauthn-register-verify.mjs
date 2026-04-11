import admin from 'firebase-admin';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import {
  initAdmin,
  getBearerToken,
  parseJsonBody,
  getExpectedOrigins,
  baseCorsHeaders,
  jsonResponse,
  getChallengeRecord,
  classifyWebAuthnVerificationError,
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
  const challengeId = typeof payload.challengeId === 'string' ? payload.challengeId.trim() : '';
  const credential = payload.credential;

  if (!userId || !challengeId || !credential) {
    return jsonResponse(400, { error: 'Missing userId, challengeId, or credential' });
  }

  let challengeRef = null;

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      return jsonResponse(403, { error: 'Forbidden' });
    }

    const db = admin.firestore();
    const challengeRecord = await getChallengeRecord(db, challengeId, 'registration');

    if (challengeRecord.status === 'missing') {
      return jsonResponse(400, { error: 'No pending challenge' });
    }

    if (challengeRecord.status === 'expired') {
      return jsonResponse(400, { error: 'Challenge expired' });
    }

    if (challengeRecord.status === 'wrong_type') {
      return jsonResponse(400, { error: 'Challenge type mismatch' });
    }

    challengeRef = challengeRecord.ref;

    const challengeData = challengeRecord.data || {};
    if (challengeData.userId !== userId) {
      await challengeRef?.delete().catch(() => {});
      return jsonResponse(403, { error: 'Forbidden' });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: Array.from(new Set([
        challengeData.origin,
        ...getExpectedOrigins(),
      ].filter(Boolean))),
      expectedRPID: challengeData.rpId || 'bloodhub.in',
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      await challengeRef?.delete().catch(() => {});
      return jsonResponse(400, { error: 'Verification failed' });
    }

    const { credential: verifiedCredential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const credentialId = verifiedCredential.id;
    await db
      .collection('users')
      .doc(userId)
      .collection('webauthnCredentials')
      .doc(credentialId)
      .set({
        credentialId,
        publicKey: Buffer.from(verifiedCredential.publicKey).toString('base64url'),
        counter: verifiedCredential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.response?.transports || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: String(event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '').slice(0, 300),
      });

    await challengeRef?.delete().catch(() => {});

    return jsonResponse(200, { success: true, credentialId });
  } catch (err) {
    await challengeRef?.delete().catch(() => {});
    const classified = classifyWebAuthnVerificationError(err, 'Verification failed');
    if (classified) {
      return jsonResponse(classified.statusCode, classified.body);
    }
    console.error('webauthn-register-verify error:', err);
    return jsonResponse(500, { error: err?.message || 'Internal error' });
  }
};
