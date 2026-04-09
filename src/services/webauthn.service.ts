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

const post = async (path: string, body: object, idToken?: string) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${BASE}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
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

// ── Authentication ────────────────────────────────────────────────────────────

export const authenticateWithBiometric = async (userId: string): Promise<string> => {
  const credentialId = getStoredCredentialId(userId) ?? undefined;
  const transports = credentialId ? getStoredTransports(userId) : undefined;
  const options = await post('webauthn-auth-challenge', { userId, credentialId, transports });
  // Server detected stale localStorage entry — clear it
  if (options.staleCredential && credentialId) {
    clearCredentialId(userId);
  }
  const credential = await startAuthentication({ optionsJSON: options });
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
