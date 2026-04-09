// src/services/webauthn.service.ts
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';

const BASE = '/.netlify/functions';

const getIdToken = async (): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
};

const post = async (path: string, body: object, idToken?: string, retry = true): Promise<any> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${BASE}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    // Retry once on 500 (transient cold-start failure)
    if (res.status === 500 && retry) {
      await new Promise((r) => setTimeout(r, 600));
      return post(path, body, idToken, false);
    }
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  if (!data) throw new Error(`Empty response from ${path}`);
  return data;
};

// ── localStorage helpers ──────────────────────────────────────────────────────

const enrolledKey = (uid: string) => `bh_wauthn_enrolled_${uid}`;
const transportsKey = (uid: string) => `bh_wauthn_transports_${uid}`;
const neverKey = (uid: string) => `bh_wauthn_never_${uid}`;
const LAST_USER_KEY = 'bh_wauthn_last_uid';

export const getStoredCredentialId = (uid: string): string | null =>
  localStorage.getItem(enrolledKey(uid));

export const storeCredentialId = (uid: string, credentialId: string, transports?: string[]): void => {
  localStorage.setItem(enrolledKey(uid), credentialId);
  localStorage.setItem(LAST_USER_KEY, uid);
  if (transports?.length) localStorage.setItem(transportsKey(uid), JSON.stringify(transports));
};

export const getStoredTransports = (uid: string): string[] => {
  try { return JSON.parse(localStorage.getItem(transportsKey(uid)) || '[]'); } catch { return []; }
};

export const clearCredentialId = (uid: string): void => {
  localStorage.removeItem(enrolledKey(uid));
  localStorage.removeItem(transportsKey(uid));
  if (localStorage.getItem(LAST_USER_KEY) === uid) {
    localStorage.removeItem(LAST_USER_KEY);
  }
};

export const getLastEnrolledUserId = (): string | null =>
  localStorage.getItem(LAST_USER_KEY);

export const getNeverAsk = (uid: string): boolean =>
  localStorage.getItem(neverKey(uid)) === '1';

export const setNeverAsk = (uid: string): void =>
  localStorage.setItem(neverKey(uid), '1');

// ── Support detection ─────────────────────────────────────────────────────────

export const isWebAuthnSupported = (): boolean =>
  typeof window !== 'undefined' && browserSupportsWebAuthn();

export const isPlatformAuthenticatorAvailable = (): Promise<boolean> =>
  platformAuthenticatorIsAvailable();

// ── Platform-aware label ──────────────────────────────────────────────────────

export const getBiometricLabel = (): string => {
  if (typeof navigator === 'undefined') return 'Biometrics';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Face ID / Touch ID';
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'Touch ID';
  if (/Android/i.test(ua)) return 'Fingerprint';
  return 'Biometrics';
};

// ── Device name from userAgent ────────────────────────────────────────────────

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

// ── Credential types ──────────────────────────────────────────────────────────

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

// ── Multi-device credential list ──────────────────────────────────────────────

export const fetchCredentials = async (userId: string): Promise<StoredCredential[]> => {
  const currentCredentialId = getStoredCredentialId(userId);
  const snap = await getDocs(collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.WEBAUTHN_CREDENTIALS));
  return snap.docs.map((d) => {
    const data = d.data();
    const ua = data.userAgent || '';
    return {
      credentialId: data.credentialId,
      deviceName: getDeviceName(ua),
      deviceDetails: getDeviceDetails(ua),
      deviceType: data.deviceType || 'platform',
      backedUp: Boolean(data.backedUp),
      createdAt: data.createdAt?.toDate?.() ?? null,
      lastUsedAt: data.lastUsedAt?.toDate?.() ?? null,
      isCurrentDevice: data.credentialId === currentCredentialId,
    };
  });
};

export const removeCredentialById = async (userId: string, credentialId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.WEBAUTHN_CREDENTIALS, credentialId));
  if (getStoredCredentialId(userId) === credentialId) {
    clearCredentialId(userId);
  }
};

// ── Registration ──────────────────────────────────────────────────────────────

export const registerBiometric = async (userId: string): Promise<string> => {
  const idToken = await getIdToken();
  const options = await post('webauthn-register-challenge', { userId }, idToken);
  const credential = await startRegistration({ optionsJSON: options });
  const result = await post('webauthn-register-verify', { userId, credential }, idToken);
  const transports = credential.response?.transports ?? [];
  storeCredentialId(userId, result.credentialId, transports);
  return result.credentialId;
};

// ── Challenge prefetch cache ──────────────────────────────────────────────────

const CHALLENGE_CACHE_TTL_MS = 4 * 60 * 1000; // 4 min (server TTL is 5 min)
const challengeCacheKey = (uid: string) => `bh_wauthn_challenge_${uid}`;

const storeCachedChallenge = (uid: string, options: object): void => {
  try {
    sessionStorage.setItem(challengeCacheKey(uid), JSON.stringify({ options, at: Date.now() }));
  } catch { /* sessionStorage full or unavailable */ }
};

const getCachedChallenge = (uid: string): object | null => {
  try {
    const raw = sessionStorage.getItem(challengeCacheKey(uid));
    if (!raw) return null;
    const { options, at } = JSON.parse(raw);
    if (Date.now() - at > CHALLENGE_CACHE_TTL_MS) {
      sessionStorage.removeItem(challengeCacheKey(uid));
      return null;
    }
    return options;
  } catch { return null; }
};

export const clearCachedChallenge = (uid: string): void => {
  try { sessionStorage.removeItem(challengeCacheKey(uid)); } catch { /* ignore */ }
};

export const prefetchAuthChallenge = async (userId: string): Promise<void> => {
  try {
    const credentialId = getStoredCredentialId(userId) ?? undefined;
    const transports = credentialId ? getStoredTransports(userId) : undefined;
    const options = await post('webauthn-auth-challenge', { userId, credentialId, transports });
    if (options.staleCredential && credentialId) clearCredentialId(userId);
    storeCachedChallenge(userId, options);
  } catch { /* prefetch failure is non-critical — login will fetch fresh */ }
};

// ── Authentication ────────────────────────────────────────────────────────────

export const authenticateWithBiometric = async (userId: string): Promise<string> => {
  // Use prefetched challenge if available — eliminates one network round-trip
  let options = getCachedChallenge(userId);
  if (options) {
    clearCachedChallenge(userId); // single-use
  } else {
    const credentialId = getStoredCredentialId(userId) ?? undefined;
    const transports = credentialId ? getStoredTransports(userId) : undefined;
    options = await post('webauthn-auth-challenge', { userId, credentialId, transports });
    if ((options as any).staleCredential && credentialId) clearCredentialId(userId);
  }
  const credential = await startAuthentication({ optionsJSON: options as any });
  const result = await post('webauthn-auth-verify', { userId, credential });
  return result.customToken;
};

// ── Passkey autofill authentication ──────────────────────────────────────────

export const authenticateWithBiometricAutofill = async (
  userId: string,
  signal: AbortSignal,
): Promise<string> => {
  const credentialId = getStoredCredentialId(userId) ?? undefined;
  const transports = credentialId ? getStoredTransports(userId) : undefined;
  const options = await post('webauthn-auth-challenge', { userId, credentialId, transports });
  if (options.staleCredential && credentialId) clearCredentialId(userId);
  storeCachedChallenge(userId, options); // also cache for button tap path
  const credential = await startAuthentication({ optionsJSON: options, useBrowserAutofill: true, signal } as any);
  const result = await post('webauthn-auth-verify', { userId, credential });
  return result.customToken;
};

// ── Remove credential ─────────────────────────────────────────────────────────

export const removeBiometricCredential = async (userId: string): Promise<void> => {
  const credentialId = getStoredCredentialId(userId);
  if (credentialId) {
    await removeCredentialById(userId, credentialId);
  }
};

// ── Pre-warm Netlify functions (fire-and-forget OPTIONS ping) ─────────────────

export const warmupBiometricFunctions = (): void => {
  const ping = (path: string) => fetch(`${BASE}/${path}`, { method: 'OPTIONS' }).catch(() => {});
  void ping('webauthn-auth-challenge');
  void ping('webauthn-auth-verify');
};

// ── Device details from userAgent ─────────────────────────────────────────────

export const getDeviceDetails = (userAgent: string): string => {
  if (!userAgent) return '';
  let browser = '';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/OPR\//i.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//i.test(userAgent)) browser = 'Safari';
  let os = '';
  const androidVer = userAgent.match(/Android\s([\d.]+)/i);
  const iosVer = userAgent.match(/OS\s([\d_]+)/i);
  const winVer = userAgent.match(/Windows NT\s([\d.]+)/i);
  if (androidVer) os = `Android ${androidVer[1]}`;
  else if (iosVer) os = `iOS ${iosVer[1].replace(/_/g, '.')}`;
  else if (winVer) os = `Windows ${winVer[1]}`;
  else if (/Macintosh/i.test(userAgent)) os = 'macOS';
  return [os, browser].filter(Boolean).join(' · ');
};
