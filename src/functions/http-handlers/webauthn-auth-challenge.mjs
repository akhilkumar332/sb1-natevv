import admin from 'firebase-admin';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import {
  initAdmin,
  parseJsonBody,
  baseCorsHeaders,
  jsonResponse,
  createChallengeRecord,
  resolveRequestOrigin,
  resolveRpId,
} from './_webauthn.mjs';

const normalizeTransports = (value) => (
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : []
);

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
    return {
      userId: hintedUserId,
      data: credentialDoc.data() || {},
    };
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
  const resolvedUserId = credentialDoc.ref.parent.parent?.id || null;
  if (!resolvedUserId) {
    throw new Error('Unable to resolve credential owner');
  }

  return {
    userId: resolvedUserId,
    data: credentialDoc.data() || {},
  };
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

  const providedCredentialId = typeof payload.credentialId === 'string' ? payload.credentialId.trim() : '';
  const providedUserId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
  const providedTransports = normalizeTransports(payload.transports);

  try {
    initAdmin();
    const db = admin.firestore();
    const origin = resolveRequestOrigin(event.headers || {});
    const rpId = resolveRpId(origin);

    let resolvedUserId = null;
    let allowCredentials;
    let staleCredential = false;

    if (providedCredentialId) {
      const owner = await resolveCredentialOwner(db, providedCredentialId, providedUserId || null);
      if (owner) {
        resolvedUserId = owner.userId;
        allowCredentials = [{
          id: providedCredentialId,
          type: 'public-key',
          transports: providedTransports,
        }];
      } else {
        staleCredential = true;
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'required',
      ...(allowCredentials && allowCredentials.length ? { allowCredentials } : {}),
    });

    const challengeId = await createChallengeRecord({
      db,
      type: 'authentication',
      userId: resolvedUserId,
      challenge: options.challenge,
      rpId,
      origin,
      credentialId: providedCredentialId || null,
      metadata: {
        route: 'webauthn-auth-challenge',
        usernameless: !resolvedUserId,
      },
    });

    return jsonResponse(200, { challengeId, options, staleCredential });
  } catch (err) {
    console.error('webauthn-auth-challenge error:', err);
    return jsonResponse(500, { error: err?.message || 'Internal error' });
  }
};
