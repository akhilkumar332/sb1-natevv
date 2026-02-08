#!/usr/bin/env node
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const dryRun = !commit;

const resolveServiceAccountPath = () => {
  const envPath = process.env.FIREBASE_ADMIN_SDK_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    return resolve(envPath);
  }

  const defaultPath = resolve(__dirname, '../secrets/firebase-admin-sdk.json');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
};

const loadServiceAccount = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data.private_key) {
      data.private_key = String(data.private_key).replace(/\\n/g, '\n');
    }
    return data;
  } catch (error) {
    console.warn('Failed to load service account file:', error);
    return null;
  }
};

const initAdmin = () => {
  if (admin.apps.length) return;

  const serviceAccountPath = resolveServiceAccountPath();
  const serviceAccount = loadServiceAccount(serviceAccountPath);
  const rawPrivateKey = process.env.VITE_FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey
    ? rawPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
    : undefined;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;

  const envServiceAccount = projectId && privateKey && clientEmail
    ? { projectId, privateKey, clientEmail }
    : null;

  if (serviceAccount) {
    console.log(`Using service account file: ${serviceAccountPath}`);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (envServiceAccount) {
    console.log('Using service account from environment variables.');
    admin.initializeApp({ credential: admin.credential.cert(envServiceAccount) });
  } else {
    console.log('Using default application credentials.');
    admin.initializeApp();
  }
};

const main = async () => {
  initAdmin();
  const db = admin.firestore();

  const writer = dryRun ? null : db.bulkWriter();
  const summary = {
    users: 0,
    bloodRequests: 0,
    partnerships: 0,
    verificationRequests: 0,
    notifications: 0,
    referrals: 0,
  };

  if (writer) {
    writer.onWriteError((error) => {
      console.error('Write failed:', error);
      return error.failedAttempts < 3;
    });
  }

  const queueUpdate = (ref, data, bucket) => {
    if (!data || Object.keys(data).length === 0) return;
    summary[bucket] += 1;
    if (dryRun) {
      return;
    }
    writer.update(ref, data);
  };

  const normalizeNameFields = (data) => {
    const updates = {};
    const bloodBankName = data.bloodBankName || data.hospitalName;
    const hospitalName = data.hospitalName || data.bloodBankName;
    const bloodBankType = data.bloodBankType || data.hospitalType;
    const hospitalType = data.hospitalType || data.bloodBankType;

    if (bloodBankName && data.bloodBankName !== bloodBankName) {
      updates.bloodBankName = bloodBankName;
    }
    if (hospitalName && data.hospitalName !== hospitalName) {
      updates.hospitalName = hospitalName;
    }
    if (bloodBankType && data.bloodBankType !== bloodBankType) {
      updates.bloodBankType = bloodBankType;
    }
    if (hospitalType && data.hospitalType !== hospitalType) {
      updates.hospitalType = hospitalType;
    }
    return updates;
  };

  console.log(`${dryRun ? 'DRY RUN' : 'COMMIT'}: Migrating hospital data to bloodbank...`);

  // Users
  const usersSnap = await db.collection('users').where('role', 'in', ['hospital', 'bloodbank']).get();
  usersSnap.forEach((doc) => {
    const data = doc.data();
    const updates = normalizeNameFields(data);
    if (data.role === 'hospital') {
      updates.role = 'bloodbank';
    }
    queueUpdate(doc.ref, updates, 'users');
  });

  // Blood Requests
  const requestsSnap = await db.collection('bloodRequests').where('requesterType', '==', 'hospital').get();
  requestsSnap.forEach((doc) => {
    queueUpdate(doc.ref, { requesterType: 'bloodbank' }, 'bloodRequests');
  });

  // Partnerships
  const partnershipsSnap = await db.collection('partnerships').where('partnerType', '==', 'hospital').get();
  partnershipsSnap.forEach((doc) => {
    queueUpdate(doc.ref, { partnerType: 'bloodbank' }, 'partnerships');
  });

  // Verification Requests
  const verificationSnap = await db.collection('verificationRequests').where('organizationType', '==', 'hospital').get();
  verificationSnap.forEach((doc) => {
    queueUpdate(doc.ref, { organizationType: 'bloodbank' }, 'verificationRequests');
  });

  // Notifications
  const notificationsSnap = await db.collection('notifications').where('userRole', '==', 'hospital').get();
  notificationsSnap.forEach((doc) => {
    queueUpdate(doc.ref, { userRole: 'bloodbank' }, 'notifications');
  });

  // Referral Tracking
  const referralUpdates = new Map();
  const referralReferrerSnap = await db.collection('ReferralTracking').where('referrerRole', '==', 'hospital').get();
  referralReferrerSnap.forEach((doc) => {
    const updates = referralUpdates.get(doc.ref) || {};
    updates.referrerRole = 'bloodbank';
    referralUpdates.set(doc.ref, updates);
  });
  const referralReferredSnap = await db.collection('ReferralTracking').where('referredRole', '==', 'hospital').get();
  referralReferredSnap.forEach((doc) => {
    const updates = referralUpdates.get(doc.ref) || {};
    updates.referredRole = 'bloodbank';
    referralUpdates.set(doc.ref, updates);
  });
  referralUpdates.forEach((updates, ref) => {
    queueUpdate(ref, updates, 'referrals');
  });

  if (!dryRun) {
    await writer.close();
  }

  console.log('Migration summary:');
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`  ${key}: ${value} updates`);
  });

  if (dryRun) {
    console.log('Dry run complete. Re-run with --commit to apply changes.');
  }
};

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
