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

  const idToken = getAuthToken(event.headers || {});
  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token' }) };
  }

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const actorUid = decoded.impersonatedBy;

    if (!actorUid || typeof actorUid !== 'string') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Not an impersonated session' }) };
    }

    const db = admin.firestore();
    const actorDoc = await db.collection('users').doc(actorUid).get();
    const actorRole = actorDoc.exists ? actorDoc.data()?.role : null;
    if (actorRole !== 'superadmin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const resumeToken = await admin.auth().createCustomToken(actorUid, {
      resumeFromImpersonation: true,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeToken, actorUid }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Resume token refresh failed' }),
    };
  }
};
