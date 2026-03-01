const admin = require('firebase-admin');

const initAdmin = () => {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
};

exports.handler = async () => {
  try {
    initAdmin();
    const db = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - (90 * 24 * 60 * 60 * 1000));
    const batchSize = 500;
    let deletedCount = 0;
    let lastDoc = null;

    while (true) {
      let errorLogQuery = db
        .collection('errorLogs')
        .where('createdAt', '<=', cutoff)
        .orderBy('createdAt')
        .limit(batchSize);

      if (lastDoc) {
        errorLogQuery = errorLogQuery.startAfter(lastDoc);
      }

      const snapshot = await errorLogQuery.get();
      if (snapshot.empty) break;

      const bulkWriter = db.bulkWriter();
      snapshot.docs.forEach((docSnap) => {
        bulkWriter.delete(docSnap.ref);
      });
      await bulkWriter.close();

      deletedCount += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, deletedCount }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error?.message || 'Retention cleanup failed' }),
    };
  }
};
