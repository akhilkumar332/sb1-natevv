#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { initializeApp as initializeClientApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  signInAnonymously,
  signInWithCustomToken,
  signOut as signOutClient,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  disableNetwork,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  terminate,
} from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(rootDir, '.env') });
dotenv.config({ path: path.resolve(rootDir, '.env.production'), override: false });

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  console.log('Usage: node scripts/diagnose-donor-registration.mjs [--keep]');
  console.log('Runs donor-registration diagnostic scenarios against the configured Firebase project.');
  console.log('Use --keep to skip cleanup of generated diagnostic user artifacts.');
  process.exit(0);
}
const keepArtifacts = args.has('--keep');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
};

const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];
for (const key of requiredConfig) {
  if (!firebaseConfig[key]) {
    throw new Error(`Missing Firebase client config: ${key}`);
  }
}

const resolveServiceAccountPath = () => {
  const envPath = process.env.FIREBASE_ADMIN_SDK_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    return path.resolve(envPath);
  }

  const defaultPath = path.resolve(rootDir, 'secrets', 'firebase-admin-sdk.json');
  return fs.existsSync(defaultPath) ? defaultPath : null;
};

const loadServiceAccount = () => {
  const serviceAccountPath = resolveServiceAccountPath();
  if (!serviceAccountPath) return null;
  const raw = fs.readFileSync(serviceAccountPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed.private_key) {
    parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
  }
  return parsed;
};

const initAdmin = () => {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseConfig.projectId,
    });
  }

  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;

  if (rawPrivateKey && clientEmail && projectId) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        privateKey: rawPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
        clientEmail,
        projectId,
      }),
      projectId,
    });
  }

  return admin.initializeApp({ projectId: firebaseConfig.projectId });
};

const app = initAdmin();
const adminDb = admin.firestore(app);
const adminAuth = admin.auth(app);

const createClient = () => {
  const clientApp = initializeClientApp(firebaseConfig, `diag-${randomUUID()}`);
  const auth = getClientAuth(clientApp);
  const db = initializeFirestore(clientApp, {
    experimentalAutoDetectLongPolling: true,
  });

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const [host, portText] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(db, host, Number(portText));
  }

  return { clientApp, auth, db };
};

const waitForClientUid = async (auth, expectedUid, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (auth.currentUser?.uid === expectedUid) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Client auth did not settle to uid ${expectedUid}`);
};

const isServiceUsageDeniedError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('serviceusage.services.use') || message.includes('user_project_denied');
};

const sanitizeError = (error) => ({
  name: error?.name || 'Error',
  code: error?.code || null,
  message: error?.message || String(error),
  stackTop: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 4).join('\n') : null,
});

const withTimeout = (promise, label, timeoutMs = 12000) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`${label} timed out after ${timeoutMs}ms`);
      error.code = 'timeout';
      reject(error);
    }, timeoutMs);
  }),
]);

const tryStep = async (label, operation) => {
  try {
    const result = await withTimeout(operation(), label);
    return { label, ok: true, result };
  } catch (error) {
    return { label, ok: false, error: sanitizeError(error) };
  }
};

const buildBootstrapPayload = ({ uid, email, displayName, photoURL = null, phoneNumber = null, phoneNumberNormalized = null }) => ({
  uid,
  email,
  displayName,
  photoURL,
  ...(phoneNumber ? { phoneNumber } : {}),
  ...(phoneNumberNormalized ? { phoneNumberNormalized } : {}),
  role: 'donor',
  onboardingCompleted: false,
  createdAt: serverTimestamp(),
  lastLoginAt: serverTimestamp(),
});

const buildOnboardingPatch = () => ({
  bloodType: 'O+',
  gender: 'Male',
  city: 'Bengaluru',
  state: 'Karnataka',
  address: 'Diagnostic Test Address',
  postalCode: '560001',
  isAvailable: true,
  donorLevel: 'new',
  preferredLanguage: 'en',
  interestedInVolunteering: false,
  privacyPolicyAgreed: true,
  termsOfServiceAgreed: true,
  onboardingCompleted: true,
  updatedAt: serverTimestamp(),
});

const seedPartialUserDoc = async (uid, seed) => {
  await adminDb.collection('users').doc(uid).set(seed, { merge: false });
};

const fetchAdminUserDoc = async (uid) => {
  const snap = await adminDb.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
};

const cleanupUserArtifacts = async (uid) => {
  const deletions = [
    adminDb.collection('users').doc(uid).delete().catch(() => undefined),
    adminDb.collection('publicDonors').doc(uid).delete().catch(() => undefined),
    adminDb.collection('DonationHistory').doc(uid).delete().catch(() => undefined),
    adminDb.collection('ReferralTracking').doc(uid).delete().catch(() => undefined),
    adminAuth.deleteUser(uid).catch(() => undefined),
  ];
  await Promise.allSettled(deletions);
};

const runScenario = async ({ name, seedDoc }) => {
  const uid = `diag-${name}-${randomUUID()}`;
  const email = `${uid}@example.com`;
  const { clientApp, auth, db } = createClient();
  const userRef = doc(db, 'users', uid);

  const report = {
    name,
    uid,
    seedDoc,
    projectId: firebaseConfig.projectId,
    authMode: null,
    steps: [],
    finalAdminDoc: null,
  };

  try {
    let authReadyUid = uid;
    try {
      await adminAuth.createUser({
        uid,
        email,
        emailVerified: true,
        displayName: 'Diagnostic Donor',
      });

      const customToken = await adminAuth.createCustomToken(uid);
      report.steps.push(await tryStep('client.signInWithCustomToken', async () => {
        await signInWithCustomToken(auth, customToken);
        await waitForClientUid(auth, uid);
        const tokenResult = await auth.currentUser.getIdTokenResult(true);
        return {
          clientUid: auth.currentUser?.uid || null,
          tokenIssuer: tokenResult.claims.iss || null,
          authTime: tokenResult.claims.auth_time || null,
        };
      }));
      report.authMode = 'customToken';
    } catch (authBootstrapError) {
      if (!isServiceUsageDeniedError(authBootstrapError)) {
        throw authBootstrapError;
      }
      report.steps.push({
        label: 'admin.customToken.unavailable',
        ok: false,
        error: sanitizeError(authBootstrapError),
      });
      report.steps.push(await tryStep('client.signInAnonymously', async () => {
        const credential = await signInAnonymously(auth);
        authReadyUid = credential.user.uid;
        await waitForClientUid(auth, authReadyUid);
        return {
          clientUid: auth.currentUser?.uid || null,
          isAnonymous: auth.currentUser?.isAnonymous || false,
        };
      }));
      report.authMode = 'anonymous';
    }

    if (seedDoc) {
      await seedPartialUserDoc(authReadyUid, seedDoc);
    }

    report.steps.push(await tryStep('client.getDoc.users.before', async () => {
      const activeUserRef = doc(db, 'users', authReadyUid);
      const snap = await getDoc(activeUserRef);
      return {
        exists: snap.exists(),
        keys: snap.exists() ? Object.keys(snap.data()).sort() : [],
      };
    }));

    report.steps.push(await tryStep('client.setDoc.users.bootstrap', async () => {
      const activeUserRef = doc(db, 'users', authReadyUid);
      await setDoc(activeUserRef, buildBootstrapPayload({
        uid: authReadyUid,
        email: report.authMode === 'anonymous' ? null : email,
        displayName: 'Diagnostic Donor',
      }), { merge: true });
      return { ok: true };
    }));

    report.steps.push(await tryStep('client.getDoc.users.afterBootstrap', async () => {
      const activeUserRef = doc(db, 'users', authReadyUid);
      const snap = await getDoc(activeUserRef);
      return {
        exists: snap.exists(),
        keys: snap.exists() ? Object.keys(snap.data()).sort() : [],
      };
    }));

    report.steps.push(await tryStep('client.setDoc.users.onboardingPatch', async () => {
      const activeUserRef = doc(db, 'users', authReadyUid);
      await setDoc(activeUserRef, buildOnboardingPatch(), { merge: true });
      return { ok: true };
    }));

    report.steps.push(await tryStep('client.getDoc.users.afterOnboarding', async () => {
      const activeUserRef = doc(db, 'users', authReadyUid);
      const snap = await getDoc(activeUserRef);
      return {
        exists: snap.exists(),
        keys: snap.exists() ? Object.keys(snap.data()).sort() : [],
      };
    }));

    report.uid = authReadyUid;
    report.finalAdminDoc = await fetchAdminUserDoc(authReadyUid);
  } finally {
    try {
      await signOutClient(auth);
    } catch {
      // ignore
    }
    try {
      await disableNetwork(db);
    } catch {
      // ignore
    }
    try {
      await terminate(db);
    } catch {
      // ignore
    }
    try {
      await clientApp.delete();
    } catch {
      // ignore
    }
    if (!keepArtifacts) {
      await cleanupUserArtifacts(report.uid);
    }
  }

  return report;
};

const main = async () => {
  const scenarios = [
    { name: 'clean', seedDoc: null },
    {
      name: 'partial-doc',
      seedDoc: {
        uid: 'placeholder',
        email: null,
        displayName: null,
        onboardingCompleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    {
      name: 'partial-null-status',
      seedDoc: {
        uid: 'placeholder',
        email: null,
        displayName: null,
        role: null,
        status: null,
        onboardingCompleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
  ];

  const reports = [];
  for (const scenario of scenarios) {
    reports.push(await runScenario(scenario));
  }

  const summary = {
    projectId: firebaseConfig.projectId,
    ranAt: new Date().toISOString(),
    keepArtifacts,
    reports,
  };

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({ fatal: sanitizeError(error) }, null, 2));
  process.exitCode = 1;
});
