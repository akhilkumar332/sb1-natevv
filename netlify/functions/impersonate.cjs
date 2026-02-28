const admin = require('firebase-admin');
const { logNetlifyError } = require('./error-log.cjs');

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.VITE_FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
};

const getAuthToken = (headers) => {
  const authHeader = headers?.authorization || headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const getClientIp = (headers) => {
  const forwarded = headers?.['x-forwarded-for']
    || headers?.['x-nf-client-connection-ip']
    || headers?.['client-ip']
    || '';
  if (!forwarded) return null;
  return String(forwarded).split(',')[0].trim() || null;
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload = null;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const targetUid = payload?.targetUid;
  const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
  const caseId = typeof payload?.caseId === 'string' ? payload.caseId.trim() : '';
  if (!targetUid) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing targetUid' }) };
  }

  const idToken = getAuthToken(event.headers || {});
  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token' }) };
  }

  let actorUid = null;
  let actorRole = null;
  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    actorUid = decoded.uid;

    const db = admin.firestore();
    const actorDoc = await db.collection('users').doc(actorUid).get();
    actorRole = actorDoc.exists ? actorDoc.data()?.role : null;
    if (actorRole !== 'superadmin') {
      await db.collection('impersonationEvents').add({
        actorUid,
        actorRole: actorRole || 'unknown',
        action: 'impersonation_denied',
        targetUid,
        status: 'denied',
        reason: 'not_superadmin',
        metadata: {
          providedReason: reason || null,
          caseId: caseId || null,
        },
        ip: getClientIp(event.headers),
        userAgent: event.headers?.['user-agent'] || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      await db.collection('impersonationEvents').add({
        actorUid,
        actorRole: actorRole || 'superadmin',
        action: 'impersonation_denied',
        targetUid,
        status: 'denied',
        reason: 'target_not_found',
        metadata: {
          providedReason: reason || null,
          caseId: caseId || null,
        },
        ip: getClientIp(event.headers),
        userAgent: event.headers?.['user-agent'] || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { statusCode: 404, body: JSON.stringify({ error: 'Target user not found' }) };
    }

    const targetData = targetDoc.data() || {};
    if (targetData.role === 'superadmin') {
      await db.collection('impersonationEvents').add({
        actorUid,
        actorRole: actorRole || 'superadmin',
        action: 'impersonation_denied',
        targetUid,
        status: 'denied',
        reason: 'target_is_superadmin',
        metadata: {
          targetRole: targetData.role || null,
          targetEmail: targetData.email || null,
          providedReason: reason || null,
          caseId: caseId || null,
        },
        ip: getClientIp(event.headers),
        userAgent: event.headers?.['user-agent'] || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { statusCode: 403, body: JSON.stringify({ error: 'Cannot impersonate superadmin' }) };
    }
    if (targetData.status === 'deleted') {
      await db.collection('impersonationEvents').add({
        actorUid,
        actorRole: actorRole || 'superadmin',
        action: 'impersonation_denied',
        targetUid,
        status: 'denied',
        reason: 'target_deleted',
        metadata: {
          targetRole: targetData.role || null,
          targetEmail: targetData.email || null,
          providedReason: reason || null,
          caseId: caseId || null,
        },
        ip: getClientIp(event.headers),
        userAgent: event.headers?.['user-agent'] || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { statusCode: 403, body: JSON.stringify({ error: 'Cannot impersonate deleted user' }) };
    }
    if (targetData.status === 'suspended' || targetData.status === 'pending_verification') {
      await db.collection('impersonationEvents').add({
        actorUid,
        actorRole: actorRole || 'superadmin',
        action: 'impersonation_denied',
        targetUid,
        status: 'denied',
        reason: 'target_restricted_status',
        metadata: {
          targetRole: targetData.role || null,
          targetStatus: targetData.status || null,
          targetEmail: targetData.email || null,
          providedReason: reason || null,
          caseId: caseId || null,
        },
        ip: getClientIp(event.headers),
        userAgent: event.headers?.['user-agent'] || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { statusCode: 403, body: JSON.stringify({ error: 'Cannot impersonate restricted account' }) };
    }

    const targetToken = await admin.auth().createCustomToken(targetUid, {
      impersonatedBy: actorUid,
      impersonatedAt: Date.now(),
    });
    const resumeToken = await admin.auth().createCustomToken(actorUid, {
      resumeFromImpersonation: true,
    });

    const impersonationEventRef = db.collection('impersonationEvents').doc();
    const impersonationId = impersonationEventRef.id;

    await db.collection('auditLogs').add({
      actorUid,
      actorRole: actorRole || 'superadmin',
      action: 'impersonation_start',
      targetUid,
      metadata: {
        targetRole: targetData.role || null,
        targetEmail: targetData.email || null,
        impersonationId,
        reason: reason || null,
        caseId: caseId || null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await impersonationEventRef.set({
      actorUid,
      actorRole: actorRole || 'superadmin',
      action: 'impersonation_start',
      targetUid,
      status: 'started',
      reason: reason || null,
      caseId: caseId || null,
      metadata: {
        targetRole: targetData.role || null,
        targetEmail: targetData.email || null,
      },
      ip: getClientIp(event.headers),
      userAgent: event.headers?.['user-agent'] || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const response = {
      targetToken,
      resumeToken,
      impersonationId,
      targetUser: {
        uid: targetUid,
        role: targetData.role || null,
        email: targetData.email || null,
        displayName: targetData.displayName || targetData.name || null,
        status: targetData.status || null,
      },
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    try {
      if (actorUid) {
        initAdmin();
        const db = admin.firestore();
        await db.collection('impersonationEvents').add({
          actorUid,
          actorRole: actorRole || 'superadmin',
          action: 'impersonation_error',
          targetUid,
          status: 'error',
          metadata: {
            message: error?.message || 'Impersonation failed',
            providedReason: reason || null,
            caseId: caseId || null,
          },
          ip: getClientIp(event.headers),
          userAgent: event.headers?.['user-agent'] || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch {
      // ignore logging failures
    }
    await logNetlifyError({
      admin,
      event,
      error,
      route: '/.netlify/functions/impersonate',
      scope: 'admin',
      actorUid,
      actorRole: actorRole || 'superadmin',
      metadata: {
        functionName: 'impersonate',
        targetUid,
      },
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Impersonation failed' }),
    };
  }
};
