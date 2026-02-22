const TOKEN_PREFIX = 'fcmToken:';
const META_PREFIX = 'fcmTokenMeta:';
const LEGACY_TOKEN_KEY = 'fcmToken';
const LAST_USER_KEY = 'fcmToken:lastUser';

type FcmTokenMeta = {
  token: string;
  deviceId?: string | null;
  savedAt: number;
};

const readStorage = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
};

const writeStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
};

const removeStorage = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};

export const readStoredFcmToken = (userId: string): string | null => {
  if (!userId) return null;
  const key = `${TOKEN_PREFIX}${userId}`;
  const existing = readStorage(key);
  if (existing) return existing;

  // Legacy migration
  const legacy = readStorage(LEGACY_TOKEN_KEY);
  if (!legacy) return null;
  const lastUser = readStorage(LAST_USER_KEY);
  if (!lastUser || lastUser === userId) {
    writeStorage(key, legacy);
    writeStorage(LAST_USER_KEY, userId);
    removeStorage(LEGACY_TOKEN_KEY);
    return legacy;
  }
  removeStorage(LEGACY_TOKEN_KEY);
  return null;
};

export const writeStoredFcmToken = (userId: string, token: string) => {
  if (!userId || !token) return;
  writeStorage(`${TOKEN_PREFIX}${userId}`, token);
  writeStorage(LAST_USER_KEY, userId);
  removeStorage(LEGACY_TOKEN_KEY);
};

export const clearStoredFcmToken = (userId: string) => {
  if (!userId) return;
  removeStorage(`${TOKEN_PREFIX}${userId}`);
  const lastUser = readStorage(LAST_USER_KEY);
  if (lastUser === userId) {
    removeStorage(LAST_USER_KEY);
  }
};

export const readFcmTokenMeta = (userId: string): FcmTokenMeta | null => {
  if (!userId) return null;
  const raw = readStorage(`${META_PREFIX}${userId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FcmTokenMeta;
    if (!parsed?.token || !parsed?.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeFcmTokenMeta = (userId: string, meta: FcmTokenMeta) => {
  if (!userId || !meta?.token) return;
  writeStorage(`${META_PREFIX}${userId}`, JSON.stringify(meta));
};
