import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';

const BASE = '/.netlify/functions';
const ANONYMOUS_CACHE_KEY = 'anonymous';
const CHALLENGE_CACHE_TTL_MS = 4 * 60 * 1000;
export const LAST_USER_KEY = 'bh_wauthn_last_uid';

type ChallengeResponse = {
  challengeId: string;
  options: Record<string, unknown>;
  staleCredential?: boolean;
};

type CachedChallenge = {
  challengeId: string;
  options: Record<string, unknown>;
  at: number;
  userId: string | null;
};

const getIdToken = async (): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
};

const post = async (
  path: string,
  body: object,
  idToken?: string,
  retry = true,
): Promise<any> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const response = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // ignore empty or invalid JSON bodies
  }

  if (!response.ok) {
    if (response.status === 500 && retry) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return post(path, body, idToken, false);
    }
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  if (!data) {
    throw new Error(`Empty response from ${path}`);
  }

  return data;
};

const enrolledKey = (uid: string) => `bh_wauthn_enrolled_${uid}`;
const transportsKey = (uid: string) => `bh_wauthn_transports_${uid}`;
const neverKey = (uid: string) => `bh_wauthn_never_${uid}`;
const challengeCacheKey = (uid: string | null) => `bh_wauthn_challenge_${uid || ANONYMOUS_CACHE_KEY}`;

const findAnotherEnrolledUserId = (excludedUid: string): string | null => {
  if (typeof localStorage === 'undefined') return null;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith('bh_wauthn_enrolled_')) continue;

    const uid = key.slice('bh_wauthn_enrolled_'.length);
    if (!uid || uid === excludedUid) continue;
    if (localStorage.getItem(key)) {
      return uid;
    }
  }

  return null;
};

export const getStoredCredentialId = (uid: string): string | null =>
  localStorage.getItem(enrolledKey(uid));

export const storeCredentialId = (uid: string, credentialId: string, transports?: string[]): void => {
  localStorage.setItem(enrolledKey(uid), credentialId);
  localStorage.setItem(LAST_USER_KEY, uid);
  if (transports?.length) {
    localStorage.setItem(transportsKey(uid), JSON.stringify(transports));
  }
};

export const getStoredTransports = (uid: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(transportsKey(uid)) || '[]');
  } catch {
    return [];
  }
};

export const clearCredentialId = (uid: string): void => {
  localStorage.removeItem(enrolledKey(uid));
  localStorage.removeItem(transportsKey(uid));
  if (localStorage.getItem(LAST_USER_KEY) === uid) {
    const fallbackUid = findAnotherEnrolledUserId(uid);
    if (fallbackUid) {
      localStorage.setItem(LAST_USER_KEY, fallbackUid);
    } else {
      localStorage.removeItem(LAST_USER_KEY);
    }
  }
  clearCachedChallenge(uid);
};

export const getLastEnrolledUserId = (): string | null => localStorage.getItem(LAST_USER_KEY);

export const getNeverAsk = (uid: string): boolean => localStorage.getItem(neverKey(uid)) === '1';

export const setNeverAsk = (uid: string): void => localStorage.setItem(neverKey(uid), '1');

export const isWebAuthnSupported = (): boolean =>
  typeof window !== 'undefined' && browserSupportsWebAuthn();

export const isPlatformAuthenticatorAvailable = (): Promise<boolean> =>
  platformAuthenticatorIsAvailable();

export const isWebAuthnAutofillSupported = (): Promise<boolean> =>
  typeof window === 'undefined' ? Promise.resolve(false) : browserSupportsWebAuthnAutofill();

export const getBiometricLabel = (): string => {
  if (typeof navigator === 'undefined') return 'Biometrics';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Face ID / Touch ID';
  if (/Macintosh|Mac OS X/i.test(ua)) {
    // If it's a Mac, it might be Touch ID or just generic biometrics
    return 'Touch ID';
  }
  if (/Android/i.test(ua)) return 'Fingerprint';
  if (/Windows/i.test(ua)) return 'Windows Hello';
  return 'Biometrics';
};

export const getDeviceName = (userAgent: string): string => {
  if (!userAgent) return 'Unknown Device';
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  const androidModel = userAgent.match(/;\s*([^;)]+)\s+Build\//);
  if (androidModel) return androidModel[1].trim();
  if (/Android/i.test(userAgent)) return 'Android Device';
  if (/Windows/i.test(userAgent)) return 'Windows Device';
  if (/Macintosh/i.test(userAgent)) return 'Mac';
  return 'Unknown Device';
};

export const getDeviceDetails = (userAgent: string): string => {
  if (!userAgent) return '';
  let browser = '';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/OPR\//i.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//i.test(userAgent)) browser = 'Safari';

  let os = '';
  const androidVersion = userAgent.match(/Android\s([\d.]+)/i);
  const iosVersion = userAgent.match(/OS\s([\d_]+)/i);
  const windowsVersion = userAgent.match(/Windows NT\s([\d.]+)/i);

  if (androidVersion) os = `Android ${androidVersion[1]}`;
  else if (iosVersion) os = `iOS ${iosVersion[1].replace(/_/g, '.')}`;
  else if (windowsVersion) os = `Windows ${windowsVersion[1]}`;
  else if (/Macintosh/i.test(userAgent)) os = 'macOS';

  return [os, browser].filter(Boolean).join(' · ');
};

export interface StoredCredential {
  credentialId: string;
  deviceName: string;
  deviceDetails: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  isCurrentDevice: boolean;
}

export const fetchCredentials = async (userId: string): Promise<StoredCredential[]> => {
  const currentCredentialId = getStoredCredentialId(userId);
  const snapshot = await getDocs(
    collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.WEBAUTHN_CREDENTIALS),
  );

  return snapshot.docs.map((docSnapshot) => {
    const data = docSnapshot.data();
    const userAgent = data.userAgent || '';

    return {
      credentialId: data.credentialId,
      deviceName: getDeviceName(userAgent),
      deviceDetails: getDeviceDetails(userAgent),
      deviceType: data.deviceType || 'platform',
      backedUp: Boolean(data.backedUp),
      createdAt: data.createdAt?.toDate?.() ?? null,
      lastUsedAt: data.lastUsedAt?.toDate?.() ?? null,
      isCurrentDevice: data.credentialId === currentCredentialId,
    };
  });
};

export const removeCredentialById = async (userId: string, credentialId: string): Promise<boolean> => {
  await deleteDoc(doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.WEBAUTHN_CREDENTIALS, credentialId));
  if (getStoredCredentialId(userId) === credentialId) {
    clearCredentialId(userId);
  }
  return true;
};

const storeCachedChallenge = (userId: string | null, value: ChallengeResponse): void => {
  const payload: CachedChallenge = {
    challengeId: value.challengeId,
    options: value.options,
    at: Date.now(),
    userId,
  };

  try {
    sessionStorage.setItem(challengeCacheKey(userId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const getCachedChallenge = (userId: string | null): CachedChallenge | null => {
  try {
    const raw = sessionStorage.getItem(challengeCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedChallenge;
    if (Date.now() - parsed.at > CHALLENGE_CACHE_TTL_MS) {
      sessionStorage.removeItem(challengeCacheKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearCachedChallenge = (userId: string | null): void => {
  try {
    sessionStorage.removeItem(challengeCacheKey(userId));
  } catch {
    // ignore storage errors
  }
};

const requestAuthChallenge = async (userId?: string | null): Promise<ChallengeResponse> => {
  const credentialId = userId ? getStoredCredentialId(userId) ?? undefined : undefined;
  const transports = credentialId && userId ? getStoredTransports(userId) : undefined;
  return post('webauthn-auth-challenge', {
    ...(credentialId ? { credentialId, transports } : {}),
  });
};

export const registerBiometric = async (userId: string): Promise<string> => {
  const idToken = await getIdToken();
  const challenge = await post('webauthn-register-challenge', { userId }, idToken);
  const credential = await startRegistration({ optionsJSON: challenge.options });
  const result = await post(
    'webauthn-register-verify',
    { userId, challengeId: challenge.challengeId, credential },
    idToken,
  );
  const transports = credential.response?.transports ?? [];
  storeCredentialId(userId, result.credentialId, transports);
  clearCachedChallenge(userId);
  return result.credentialId;
};

export const prefetchAuthChallenge = async (userId?: string | null): Promise<void> => {
  try {
    const response = await requestAuthChallenge(userId);
    if (response.staleCredential && userId && getStoredCredentialId(userId)) {
      clearCredentialId(userId);
    }
    storeCachedChallenge(userId ?? null, response);
  } catch {
    // ignore prefetch failures
  }
};

export const authenticateWithBiometric = async (
  userId?: string | null,
  mediation?: 'conditional' | 'required' | 'optional',
): Promise<{ customToken: string; userId: string | null }> => {
  const normalizedUserId = userId ?? null;
  let cached = getCachedChallenge(normalizedUserId);

  if (!cached || (Date.now() - cached.at > CHALLENGE_CACHE_TTL_MS)) {
    const response = await requestAuthChallenge(normalizedUserId);
    if (response.staleCredential && normalizedUserId && getStoredCredentialId(normalizedUserId)) {
      clearCredentialId(normalizedUserId);
    }
    cached = {
      challengeId: response.challengeId,
      options: response.options,
      at: Date.now(),
      userId: normalizedUserId,
    };
    storeCachedChallenge(normalizedUserId, response);
  }

  const useBrowserAutofill = mediation === 'conditional';
  const credential = await startAuthentication({
    optionsJSON: cached.options as any,
    useBrowserAutofill,
  });

  // Once the browser returns a credential, that challenge attempt is consumed.
  clearCachedChallenge(normalizedUserId);

  const result = await post('webauthn-auth-verify', {
    challengeId: cached.challengeId,
    credential,
  });

  const resolvedUserId = typeof result.userId === 'string' ? result.userId : normalizedUserId;
  if (resolvedUserId && typeof credential.id === 'string' && credential.id) {
    storeCredentialId(resolvedUserId, credential.id);
  }

  return {
    customToken: result.customToken,
    userId: resolvedUserId,
  };
};

export const removeBiometricCredential = async (userId: string): Promise<boolean> => {
  const credentialId = getStoredCredentialId(userId);
  if (credentialId) {
    return removeCredentialById(userId, credentialId);
  }
  return false;
};

export const warmupBiometricFunctions = (): void => {
  const ping = (path: string) => fetch(`${BASE}/${path}`, { method: 'OPTIONS' }).catch(() => {});
  void ping('webauthn-auth-challenge');
  void ping('webauthn-auth-verify');
};
