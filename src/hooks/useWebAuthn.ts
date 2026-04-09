// src/hooks/useWebAuthn.ts
import { useState, useEffect, useCallback } from 'react';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  getBiometricLabel,
  getStoredCredentialId,
  getLastEnrolledUserId,
  getNeverAsk,
  setNeverAsk,
  registerBiometric,
  authenticateWithBiometric,
  removeBiometricCredential,
  removeCredentialById,
  fetchCredentials,
  clearCredentialId,
} from '../services/webauthn.service';
import type { StoredCredential } from '../services/webauthn.service';
import { captureHandledError } from '../services/errorLog.service';

export type { StoredCredential };

export const useWebAuthn = (userId?: string | null) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReenroll, setNeedsReenroll] = useState(false);

  const effectiveUserId = userId ?? getLastEnrolledUserId();
  const biometricLabel = getBiometricLabel();

  useEffect(() => {
    if (!isWebAuthnSupported()) { setIsReady(true); return; }
    isPlatformAuthenticatorAvailable()
      .then((available) => { setIsSupported(available); })
      .catch(() => { setIsSupported(false); })
      .finally(() => { setIsReady(true); });
  }, []);

  useEffect(() => {
    if (!effectiveUserId) { setIsRegistered(false); return; }
    setIsRegistered(Boolean(getStoredCredentialId(effectiveUserId)));
  }, [effectiveUserId]);

  const refreshCredentials = useCallback(async () => {
    if (!userId) return;
    setCredentialsLoading(true);
    try {
      const list = await fetchCredentials(userId);
      setCredentials(list);
      // Only sync localStorage if fetch succeeded — don't clear on network failure
      const currentId = getStoredCredentialId(userId);
      if (currentId) {
        const stillExists = list.some((c) => c.credentialId === currentId);
        if (!stillExists) {
          clearCredentialId(userId);
          setIsRegistered(false);
        }
      } else {
        setIsRegistered(list.some((c) => c.isCurrentDevice));
      }
    } catch {
      // Silently ignore — don't clear localStorage on fetch failure (could be offline)
    } finally {
      setCredentialsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refreshCredentials();
  }, [userId, refreshCredentials]);

  const register = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setLoading(true);
    setError(null);
    setNeedsReenroll(false);
    try {
      await registerBiometric(userId);
      setIsRegistered(true);
      await refreshCredentials();
      return true;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Biometric prompt was cancelled.');
        return false;
      }
      if (err?.name === 'InvalidStateError') {
        // Credential already exists on device (e.g. synced via passkey manager) — treat as enrolled
        setIsRegistered(true);
        await refreshCredentials().catch(() => {});
        return true;
      }
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.register' } });
      setError(err?.message || 'Registration failed.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, refreshCredentials]);

  const authenticate = useCallback(async (): Promise<string | null> => {
    if (!effectiveUserId) return null;
    setLoading(true);
    setError(null);
    try {
      const customToken = await authenticateWithBiometric(effectiveUserId);
      setNeedsReenroll(false);
      return customToken;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // If registered but NotAllowedError → credential likely deleted from device
        if (isRegistered) setNeedsReenroll(true);
        setError(isRegistered
          ? 'Biometric data was removed from this device. Re-enroll in Account settings.'
          : 'Biometric prompt was cancelled.');
        return null;
      }
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.authenticate' } });
      // If credential not found in Firestore (stale localStorage from old enrollment),
      // clear local state so user can re-enroll
      if (err?.message?.includes('Credential not found') || err?.message?.includes('404')) {
        if (effectiveUserId) clearCredentialId(effectiveUserId);
        setIsRegistered(false);
        setNeedsReenroll(true);
        setError('Biometric credential is outdated. Please re-enroll in Account settings or log in again.');
        return null;
      }
      setError(err?.message || 'Authentication failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, isRegistered]);

  const removeCredential = useCallback(async (): Promise<void> => {
    if (!effectiveUserId) return;
    setLoading(true);
    setError(null);
    try {
      await removeBiometricCredential(effectiveUserId);
      setIsRegistered(false);
      setNeedsReenroll(false);
      await refreshCredentials();
    } catch (err: any) {
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.remove' } });
      setError(err?.message || 'Failed to remove credential.');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, refreshCredentials]);

  const removeCredentialByIdFn = useCallback(async (credentialId: string): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      await removeCredentialById(userId, credentialId);
      await refreshCredentials();
    } catch (err: any) {
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.remove' } });
      setError(err?.message || 'Failed to remove credential.');
    } finally {
      setLoading(false);
    }
  }, [userId, refreshCredentials]);

  const dismissEnrollPrompt = useCallback((never = false) => {
    if (userId && never) setNeverAsk(userId);
  }, [userId]);

  const canShowEnrollPrompt = isReady && Boolean(userId && isSupported && !isRegistered && !getNeverAsk(userId ?? ''));

  const forceRemoveLocal = useCallback(() => {
    if (effectiveUserId) { clearCredentialId(effectiveUserId); setIsRegistered(false); }
  }, [effectiveUserId]);

  return {
    isSupported,
    isReady,
    isRegistered,
    credentials,
    credentialsLoading,
    loading,
    error,
    needsReenroll,
    biometricLabel,
    register,
    authenticate,
    removeCredential,
    removeCredentialById: removeCredentialByIdFn,
    refreshCredentials,
    dismissEnrollPrompt,
    canShowEnrollPrompt,
    forceRemoveLocal,
  };
};
