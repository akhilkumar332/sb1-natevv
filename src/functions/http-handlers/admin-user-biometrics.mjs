import admin from 'firebase-admin';
import { initAdmin, getBearerToken, parseJsonBody, baseCorsHeaders, jsonResponse } from './_webauthn.mjs';

const ALLOWED_ROLES = new Set(['admin', 'superadmin']);

const toTimestampMs = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  return null;
};

const sanitizeCredential = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    credentialId: typeof data.credentialId === 'string' ? data.credentialId : docSnap.id,
    deviceType: typeof data.deviceType === 'string' ? data.deviceType : 'platform',
    backedUp: Boolean(data.backedUp),
    transports: Array.isArray(data.transports)
      ? data.transports.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [],
    counter: typeof data.counter === 'number' ? data.counter : null,
    createdAtMs: toTimestampMs(data.createdAt),
    lastUsedAtMs: toTimestampMs(data.lastUsedAt),
    userAgent: typeof data.userAgent === 'string' ? data.userAgent.slice(0, 300) : '',
  };
};

const resolveActor = async (db, headers) => {
  const idToken = getBearerToken(headers || {});
  if (!idToken) {
    return { error: jsonResponse(401, { error: 'Missing auth token' }) };
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    return { error: jsonResponse(401, { error: 'Invalid auth token' }) };
  }
  const actorUid = decoded?.uid || '';
  if (!actorUid) {
    return { error: jsonResponse(401, { error: 'Invalid auth token' }) };
  }

  const actorDoc = await db.collection('users').doc(actorUid).get();
  const actorRole = actorDoc.exists ? actorDoc.data()?.role : null;
  if (!ALLOWED_ROLES.has(String(actorRole || '').trim())) {
    return { error: jsonResponse(403, { error: 'Forbidden' }) };
  }

  return { actorUid, actorRole: String(actorRole) };
};

const getCredentialCollection = (db, targetUid) => (
  db.collection('users').doc(targetUid).collection('webauthnCredentials')
);

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

  const targetUid = typeof payload.uid === 'string' ? payload.uid.trim() : '';
  const action = typeof payload.action === 'string' ? payload.action.trim() : 'list';
  const credentialId = typeof payload.credentialId === 'string' ? payload.credentialId.trim() : '';
  const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 500) : '';

  if (!targetUid) {
    return jsonResponse(400, { error: 'Missing uid' });
  }

  if (!['list', 'remove'].includes(action)) {
    return jsonResponse(400, { error: 'Unsupported action' });
  }

  if (action === 'remove' && !credentialId) {
    return jsonResponse(400, { error: 'Missing credentialId' });
  }

  try {
    initAdmin();
    const db = admin.firestore();
    const actor = await resolveActor(db, event.headers || {});
    if (actor.error) return actor.error;

    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) {
      return jsonResponse(404, { error: 'Target user not found' });
    }
    const targetRole = typeof userDoc.data()?.role === 'string' ? userDoc.data().role.trim() : '';
    if (targetRole !== 'donor') {
      return jsonResponse(400, { error: 'Biometrics are only available for donor users' });
    }

    const credentialsRef = getCredentialCollection(db, targetUid);

    if (action === 'list') {
      const credentialsSnap = await credentialsRef.get();
      const credentials = credentialsSnap.docs
        .map((docSnap) => sanitizeCredential(docSnap))
        .sort((a, b) => (b.lastUsedAtMs || b.createdAtMs || 0) - (a.lastUsedAtMs || a.createdAtMs || 0));

      return jsonResponse(200, {
        uid: targetUid,
        role: targetRole,
        credentials,
      });
    }

    const credentialRef = credentialsRef.doc(credentialId);
    const credentialDoc = await credentialRef.get();
    if (!credentialDoc.exists) {
      return jsonResponse(404, { error: 'Biometric credential not found' });
    }

    const credential = sanitizeCredential(credentialDoc);
    await credentialRef.delete();
    await db.collection('auditLogs').add({
      actorUid: actor.actorUid,
      actorRole: actor.actorRole,
      action: 'admin_remove_biometric_credential',
      targetUid,
      metadata: {
        credentialId,
        credentialIdTail: credentialId.slice(-8),
        deviceType: credential.deviceType,
        backedUp: credential.backedUp,
        transports: credential.transports,
        reason: reason || null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return jsonResponse(200, { success: true, removedCredentialId: credentialId });
  } catch (err) {
    console.error('admin-user-biometrics error:', err);
    return jsonResponse(500, { error: err?.message || 'Internal error' });
  }
};
