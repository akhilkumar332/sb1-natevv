// src/hooks/useWebAuthn.ts
import { useState, useEffect, useCallback } from 'react';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  getStoredCredentialId,
  getLastEnrolledUserId,
  getNeverAsk,
  setNeverAsk,
  registerBiometric,
  authenticateWithBiometric,
  removeBiometricCredential,
  clearCredentialId,
} from '../services/webauthn.service';
import { captureHandledError } from '../services/errorLog.service';

export const useWebAuthn = (userId?: string | null) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false); // true once async platform check completes
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveUserId = userId ?? getLastEnrolledUserId();

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

  const register = useCallback(async (): Promise<boolean> => {
    if (!userId) return false; // registration requires authenticated userId
    setLoading(true);
    setError(null);
    try {
      await registerBiometric(userId);
      setIsRegistered(true);
      return true;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Biometric prompt was cancelled.');
        return false;
      }
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.register' } });
      setError(err?.message || 'Registration failed.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const authenticate = useCallback(async (): Promise<string | null> => {
    if (!effectiveUserId) return null;
    setLoading(true);
    setError(null);
    try {
      const customToken = await authenticateWithBiometric(effectiveUserId);
      return customToken;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Biometric prompt was cancelled.');
        return null;
      }
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.authenticate' } });
      setError(err?.message || 'Authentication failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  const removeCredential = useCallback(async (): Promise<void> => {
    if (!effectiveUserId) return;
    setLoading(true);
    setError(null);
    try {
      await removeBiometricCredential(effectiveUserId);
      setIsRegistered(false);
    } catch (err: any) {
      void captureHandledError(err, { source: 'frontend', scope: 'auth', metadata: { kind: 'webauthn.remove' } });
      setError(err?.message || 'Failed to remove credential.');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  const dismissEnrollPrompt = useCallback((never = false) => {
    if (userId && never) setNeverAsk(userId);
  }, [userId]);

  // Stable boolean — only true once async platform check has completed
  const canShowEnrollPrompt = isReady && Boolean(userId && isSupported && !isRegistered && !getNeverAsk(userId ?? ''));

  const forceRemoveLocal = useCallback(() => {
    if (effectiveUserId) { clearCredentialId(effectiveUserId); setIsRegistered(false); }
  }, [effectiveUserId]);

  return {
    isSupported,
    isReady,
    isRegistered,
    loading,
    error,
    register,
    authenticate,
    removeCredential,
    dismissEnrollPrompt,
    canShowEnrollPrompt,
    forceRemoveLocal,
  };
};
