// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  initializeFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // Add this to handle the COOP policy
  auth_type: 'popup',
});
const forceLongPolling = import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING === 'true';
export const db = initializeFirestore(app, {
  ...(forceLongPolling
    ? { experimentalForceLongPolling: true, useFetchStreams: false }
    : { experimentalAutoDetectLongPolling: true }),
});

type FirestorePersistenceStatus = 'idle' | 'enabling' | 'enabled' | 'disabled' | 'failed';

const isPersistenceFeatureEnabled = import.meta.env.VITE_FIRESTORE_OFFLINE_PERSISTENCE !== 'false';
let persistenceStatus: FirestorePersistenceStatus = isPersistenceFeatureEnabled ? 'idle' : 'disabled';
let persistenceInitPromise: Promise<void> | null = null;
const persistenceListeners = new Set<(status: FirestorePersistenceStatus) => void>();

const publishPersistenceStatus = (next: FirestorePersistenceStatus) => {
  persistenceStatus = next;
  persistenceListeners.forEach((listener) => {
    listener(next);
  });
};

const isPersistenceUnsupported = (error: unknown) => {
  const code = String((error as any)?.code || '');
  const message = String((error as any)?.message || '').toLowerCase();
  return (
    code === 'failed-precondition'
    || code === 'unimplemented'
    || message.includes('indexeddb')
    || message.includes('persistence')
  );
};

export const initializeFirestoreOfflinePersistence = async (): Promise<void> => {
  if (!isPersistenceFeatureEnabled) {
    publishPersistenceStatus('disabled');
    return;
  }
  if (persistenceStatus === 'enabled') return;
  if (persistenceInitPromise) return persistenceInitPromise;

  publishPersistenceStatus('enabling');
  persistenceInitPromise = enableMultiTabIndexedDbPersistence(db)
    .catch(async (error) => {
      if (!isPersistenceUnsupported(error)) throw error;
      return enableIndexedDbPersistence(db);
    })
    .then(() => {
      publishPersistenceStatus('enabled');
    })
    .catch((error) => {
      if (isPersistenceUnsupported(error)) {
        publishPersistenceStatus('disabled');
        return;
      }
      publishPersistenceStatus('failed');
    })
    .finally(() => {
      persistenceInitPromise = null;
    });

  return persistenceInitPromise;
};

export const getFirestorePersistenceStatus = () => persistenceStatus;

export const subscribeFirestorePersistenceStatus = (
  listener: (status: FirestorePersistenceStatus) => void,
): (() => void) => {
  persistenceListeners.add(listener);
  listener(persistenceStatus);
  return () => {
    persistenceListeners.delete(listener);
  };
};

export default app;
