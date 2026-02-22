const admin = require('firebase-admin');

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
  if (!targetUid) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing targetUid' }) };
  }

  const idToken = getAuthToken(event.headers || {});
  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token' }) };
  }

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const actorUid = decoded.uid;

    const db = admin.firestore();
    const actorDoc = await db.collection('users').doc(actorUid).get();
    const actorRole = actorDoc.exists ? actorDoc.data()?.role : null;
    if (actorRole !== 'superadmin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Target user not found' }) };
    }

    const targetData = targetDoc.data() || {};
    if (targetData.role === 'superadmin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Cannot impersonate superadmin' }) };
    }
    if (targetData.status === 'deleted') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Cannot impersonate deleted user' }) };
    }

    const targetToken = await admin.auth().createCustomToken(targetUid, {
      impersonatedBy: actorUid,
      impersonatedAt: Date.now(),
    });
    const resumeToken = await admin.auth().createCustomToken(actorUid, {
      resumeFromImpersonation: true,
    });

    await db.collection('auditLogs').add({
      actorUid,
      actorRole: actorRole || 'superadmin',
      action: 'impersonation_start',
      targetUid,
      metadata: {
        targetRole: targetData.role || null,
        targetEmail: targetData.email || null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const response = {
      targetToken,
      resumeToken,
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Impersonation failed' }),
    };
  }
};
