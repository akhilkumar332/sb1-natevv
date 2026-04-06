// src/services/webauthn.service.ts
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { auth } from '../firebase';
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
const neverKey = (uid: string) => `bh_wauthn_never_${uid}`;
const LAST_USER_KEY = 'bh_wauthn_last_uid';

export const getStoredCredentialId = (uid: string): string | null =>
  localStorage.getItem(enrolledKey(uid));

export const storeCredentialId = (uid: string, credentialId: string): void => {
  localStorage.setItem(enrolledKey(uid), credentialId);
  localStorage.setItem(LAST_USER_KEY, uid);
};

export const clearCredentialId = (uid: string): void => {
  localStorage.removeItem(enrolledKey(uid));
  if (localStorage.getItem(LAST_USER_KEY) === uid) {
    localStorage.removeItem(LAST_USER_KEY);
  }
};

/** Returns the last enrolled userId — used on login page before auth */
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

// ── Registration ──────────────────────────────────────────────────────────────

export const registerBiometric = async (userId: string): Promise<string> => {
  const idToken = await getIdToken();

  // 1. Get challenge from server
  const options = await post('webauthn-register-challenge', { userId }, idToken);

  // 2. Prompt device biometric
  const credential = await startRegistration({ optionsJSON: options });

  // 3. Verify with server
  const result = await post('webauthn-register-verify', { userId, credential }, idToken);

  // 4. Persist credentialId locally
  storeCredentialId(userId, result.credentialId);

  return result.credentialId;
};

// ── Authentication ────────────────────────────────────────────────────────────

export const authenticateWithBiometric = async (userId: string): Promise<string> => {
  // 1. Get challenge from server (no auth token — pre-login)
  const options = await post('webauthn-auth-challenge', { userId });

  // 2. Prompt device biometric
  const credential = await startAuthentication({ optionsJSON: options });

  // 3. Verify with server → get custom token
  const result = await post('webauthn-auth-verify', { userId, credential });

  return result.customToken;
};

// ── Remove credential ─────────────────────────────────────────────────────────

export const removeBiometricCredential = async (userId: string): Promise<void> => {
  const { doc, deleteDoc } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  const credentialId = getStoredCredentialId(userId);
  if (credentialId) {
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.WEBAUTHN_CREDENTIALS, credentialId));
    clearCredentialId(userId);
  }
};
