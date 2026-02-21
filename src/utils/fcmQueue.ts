type QueuedFcmMessage = {
  id: string;
  payload: any;
  receivedAt: number;
};

const DB_NAME = 'bloodhub_fcm';
const STORE_NAME = 'pending_notifications';
const DB_VERSION = 1;

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getQueuedFcmMessages = async (): Promise<QueuedFcmMessage[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result || []) as QueuedFcmMessage[]);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
};

export const removeQueuedFcmMessages = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
};

export type { QueuedFcmMessage };
