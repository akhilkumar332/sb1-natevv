import admin from 'firebase-admin';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import {
  initAdmin,
  parseJsonBody,
  getExpectedOrigins,
  baseCorsHeaders,
  jsonResponse,
  getChallengeRecord,
  classifyWebAuthnVerificationError,
} from './_webauthn.mjs';

const resolveCredentialOwner = async (db, credentialId, hintedUserId = null) => {
  if (hintedUserId) {
    const credentialRef = db
      .collection('users')
      .doc(hintedUserId)
      .collection('webauthnCredentials')
      .doc(credentialId);
    const credentialDoc = await credentialRef.get();
    if (!credentialDoc.exists) {
      return null;
    }
    return { userId: hintedUserId, credentialDoc };
  }

  const matches = await db
    .collectionGroup('webauthnCredentials')
    .where('credentialId', '==', credentialId)
    .limit(2)
    .get();

  if (matches.empty) {
    return null;
  }

  if (matches.size > 1) {
    throw new Error('Duplicate credentialId detected');
  }

  const credentialDoc = matches.docs[0];
  const userId = credentialDoc.ref.parent.parent?.id || null;
  if (!userId) {
    throw new Error('Unable to resolve credential owner');
  }

  return { userId, credentialDoc };
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseCorsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const payload = parseJsonBody(event.body);
  if (!payload) {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const challengeId = typeof payload.challengeId === 'string' ? payload.challengeId.trim() : '';
  const credential = payload.credential;

  if (!challengeId || !credential) {
    return jsonResponse(400, { error: 'Missing challengeId or credential' });
  }

  let challengeRef = null;

  try {
    initAdmin();
    const db = admin.firestore();
    const challengeRecord = await getChallengeRecord(db, challengeId, 'authentication');

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
    const credentialId = typeof credential.id === 'string' ? credential.id : '';
    if (!credentialId) {
      return jsonResponse(400, { error: 'Missing credential id' });
    }

    if (challengeData.credentialId && challengeData.credentialId !== credentialId) {
      await challengeRef?.delete().catch(() => {});
      return jsonResponse(400, { error: 'Credential mismatch for challenge' });
    }

    const owner = await resolveCredentialOwner(db, credentialId, challengeData.userId || null);
    if (!owner) {
      await challengeRef?.delete().catch(() => {});
      return jsonResponse(404, { error: 'Credential not found' });
    }

    const storedCredential = owner.credentialDoc.data() || {};
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: Array.from(new Set([
        challengeData.origin,
        ...getExpectedOrigins(),
      ].filter(Boolean))),
      expectedRPID: challengeData.rpId || 'bloodhub.in',
      requireUserVerification: true,
      credential: {
        id: storedCredential.credentialId,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: storedCredential.counter,
        transports: storedCredential.transports || [],
      },
    });

    if (!verification.verified) {
      await challengeRef?.delete().catch(() => {});
      return jsonResponse(401, { error: 'Authentication failed' });
    }

    await owner.credentialDoc.ref.update({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await challengeRef?.delete().catch(() => {});

    const customToken = await admin.auth().createCustomToken(owner.userId, { biometric: true });
    return jsonResponse(200, { customToken, userId: owner.userId });
  } catch (err) {
    await challengeRef?.delete().catch(() => {});
    const classified = classifyWebAuthnVerificationError(err, 'Authentication failed');
    if (classified) {
      return jsonResponse(classified.statusCode, classified.body);
    }
    console.error('webauthn-auth-verify error:', err);
    return jsonResponse(500, { error: err?.message || 'Internal error' });
  }
};
