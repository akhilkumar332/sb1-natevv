import { useState, useEffect, useCallback } from 'react';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  isWebAuthnAutofillSupported,
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

const isLikelyCancellationError = (error: any): boolean => (
  error?.name === 'NotAllowedError'
  || error?.code === 'ERROR_CEREMONY_ABORTED'
  || error?.message?.toLowerCase?.().includes('timed out')
  || error?.message?.toLowerCase?.().includes('cancel')
);

const isStaleCredentialError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('credential not found')
    || message.includes('unknown credential')
    || message.includes('no passkeys available')
    || message.includes('404');
};

export const useWebAuthn = (userId?: string | null) => {
  const [isSupported, setIsSupported] = useState(false);
  const [supportsAutofill, setSupportsAutofill] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [localEnrolledUserId, setLocalEnrolledUserId] = useState<string | null>(() => (
    userId ?? getLastEnrolledUserId()
  ));
  const [isRegistered, setIsRegistered] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReenroll, setNeedsReenroll] = useState(false);

  const effectiveUserId = userId ?? localEnrolledUserId;
  const biometricLabel = getBiometricLabel();

  useEffect(() => {
    if (userId) {
      setLocalEnrolledUserId(userId);
      return;
    }
    setLocalEnrolledUserId(getLastEnrolledUserId());
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const loadCapabilities = async () => {
      if (!isWebAuthnSupported()) {
        if (!cancelled) setIsReady(true);
        return;
      }

      const [platformAvailable, autofillAvailable] = await Promise.all([
        isPlatformAuthenticatorAvailable().catch(() => false),
        isWebAuthnAutofillSupported().catch(() => false),
      ]);

      if (cancelled) return;
      setIsSupported(platformAvailable);
      setSupportsAutofill(autofillAvailable);
      setIsReady(true);
    };

    void loadCapabilities();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!effectiveUserId) {
      setIsRegistered(false);
      return;
    }
    setIsRegistered(Boolean(getStoredCredentialId(effectiveUserId)));
  }, [effectiveUserId]);

  const refreshCredentials = useCallback(async () => {
    if (!userId) return;
    setCredentialsLoading(true);
    try {
      const list = await fetchCredentials(userId);
      setCredentials(list);

      const currentId = getStoredCredentialId(userId);
      if (currentId) {
        const stillExists = list.some((credential) => credential.credentialId === currentId);
        if (!stillExists) {
          clearCredentialId(userId);
          setIsRegistered(false);
        }
      } else {
        setIsRegistered(list.some((credential) => credential.isCurrentDevice));
      }
    } catch {
      // keep local state intact on transient failures
    } finally {
      setCredentialsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void refreshCredentials();
    }
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
      if (isLikelyCancellationError(err)) {
        setError('Biometric prompt was cancelled.');
        return false;
      }

      if (err?.name === 'InvalidStateError') {
        setIsRegistered(true);
        await refreshCredentials().catch(() => {});
        return true;
      }

      void captureHandledError(err, {
        source: 'frontend',
        scope: 'auth',
        metadata: { kind: 'webauthn.register' },
      });
      setError(err?.message || 'Registration failed.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshCredentials, userId]);

  const authenticate = useCallback(async (options?: {
    mediation?: 'conditional' | 'required' | 'optional';
  }): Promise<{ customToken: string; userId: string | null } | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await authenticateWithBiometric(effectiveUserId, options?.mediation);
      const resolvedUserId = result.userId ?? effectiveUserId;
      if (!userId) {
        setLocalEnrolledUserId(resolvedUserId ?? getLastEnrolledUserId());
      }
      if (resolvedUserId) {
        setIsRegistered(Boolean(getStoredCredentialId(resolvedUserId)));
      }
      setNeedsReenroll(false);
      return result;
    } catch (err: any) {
      if (isLikelyCancellationError(err)) {
        // Only show error for non-conditional mediation
        if (options?.mediation !== 'conditional') {
          setError('Biometric prompt was cancelled.');
        }
        return null;
      }

      if (isStaleCredentialError(err)) {
        if (effectiveUserId) {
          clearCredentialId(effectiveUserId);
        }
        if (!userId) {
          setLocalEnrolledUserId(getLastEnrolledUserId());
        }
        setIsRegistered(false);
        setNeedsReenroll(true);
        setError('Biometric credential is outdated. Please re-enroll in Account settings or log in again.');
        return null;
      }

      void captureHandledError(err, {
        source: 'frontend',
        scope: 'auth',
        metadata: {
          kind: 'webauthn.authenticate',
          mediation: options?.mediation,
        },
      });
      setError(err?.message || 'Authentication failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, userId]);

  const removeCredential = useCallback(async (): Promise<boolean> => {
    if (!effectiveUserId) return false;
    setLoading(true);
    setError(null);

    try {
      await removeBiometricCredential(effectiveUserId);
      if (!userId) {
        setLocalEnrolledUserId(getLastEnrolledUserId());
      }
      setIsRegistered(false);
      setNeedsReenroll(false);
      await refreshCredentials();
      return true;
    } catch (err: any) {
      void captureHandledError(err, {
        source: 'frontend',
        scope: 'auth',
        metadata: { kind: 'webauthn.remove' },
      });
      setError(err?.message || 'Failed to remove credential.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, refreshCredentials]);

  const removeCredentialByIdFn = useCallback(async (credentialId: string): Promise<boolean> => {
    if (!userId) return false;
    setLoading(true);
    setError(null);

    try {
      await removeCredentialById(userId, credentialId);
      await refreshCredentials();
      return true;
    } catch (err: any) {
      void captureHandledError(err, {
        source: 'frontend',
        scope: 'auth',
        metadata: { kind: 'webauthn.remove' },
      });
      setError(err?.message || 'Failed to remove credential.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshCredentials, userId]);

  const dismissEnrollPrompt = useCallback((never = false) => {
    if (userId && never) {
      setNeverAsk(userId);
    }
  }, [userId]);

  const canShowEnrollPrompt = isReady
    && Boolean(userId && isSupported && !isRegistered && !getNeverAsk(userId ?? ''));

  const canAuthenticate = isReady
    && Boolean(isSupported || supportsAutofill)
    && Boolean(isRegistered || supportsAutofill || effectiveUserId);

  const forceRemoveLocal = useCallback(() => {
    if (effectiveUserId) {
      clearCredentialId(effectiveUserId);
      if (!userId) {
        setLocalEnrolledUserId(getLastEnrolledUserId());
      }
      setIsRegistered(false);
    }
  }, [effectiveUserId, userId]);

  return {
    isSupported,
    supportsAutofill,
    isReady,
    isRegistered,
    canAuthenticate,
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
