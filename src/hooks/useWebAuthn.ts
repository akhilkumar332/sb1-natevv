import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
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

const isLikelyCancellationError = (error: any): boolean => {
  const name = String(error?.name || '');
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');

  return name === 'NotAllowedError'
    || name === 'AbortError'
    || name === 'SecurityError'
    || code === 'ERROR_CEREMONY_ABORTED'
    || message.includes('timed out')
    || message.includes('cancel')
    || message.includes('abort')
    || message.includes('not supported')
    || message.includes('autofill');
};

const isStaleCredentialError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('credential not found')
    || message.includes('unknown credential')
    || message.includes('no passkeys available')
    || message.includes('no credentials')
    || message.includes('404');
};

const isBackendInfrastructureError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return message.includes('missing firebase admin credentials')
    || message.includes('internal error')
    || message.includes('request failed: 500')
    || message.includes('empty response')
    || message.includes('failed_precondition')
    || message.includes('failed-precondition')
    || code === 'failed-precondition';
};

export const useWebAuthn = (userId?: string | null) => {
  const { isOnline } = useNetworkStatus();
  const [isSupported, setIsSupported] = useState(false);
  const [supportsAutofill, setSupportsAutofill] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [localEnrolledUserId, setLocalEnrolledUserId] = useState<string | null>(() => (
    userId ?? getLastEnrolledUserId()
  ));
  const [isRegistered, setIsRegistered] = useState(() => (
    Boolean((userId || getLastEnrolledUserId()) && getStoredCredentialId(userId || getLastEnrolledUserId() || ''))
  ));
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
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
    setCredentialsError(null);
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
      setCredentialsError('Could not load biometric devices right now. Please retry.');
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
    const isConditional = options?.mediation === 'conditional';
    if (!isConditional) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await authenticateWithBiometric(
        effectiveUserId,
        options?.mediation
      );
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
      if (err?.name === 'SecurityError') {
        setError('Security error: Please ensure you are using a secure connection (HTTPS) and matching domain.');
        return null;
      }

      if (err?.name === 'NotSupportedError') {
        // Device doesn't support the requested operation or user verification
        return null;
      }

      if (err?.name === 'AbortError' || isLikelyCancellationError(err)) {
        // Only show error for non-conditional mediation
        if (!isConditional && err?.name !== 'AbortError') {
          setError('Biometric prompt was cancelled.');
        }
        return null;
      }

      const stale = isStaleCredentialError(err);
      if (stale) {
        if (effectiveUserId) {
          clearCredentialId(effectiveUserId);
        }
        if (!userId) {
          setLocalEnrolledUserId(getLastEnrolledUserId());
        }
        setIsRegistered(false);

        // If it's conditional and we didn't hint a user, don't say "Outdated"
        // as it might just be the user tried a wrong passkey or no passkeys found.
        if (effectiveUserId || !isConditional) {
          setNeedsReenroll(true);
          setError('Biometric credential is outdated. Please re-enroll in Account settings or log in again.');
        }
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

      if (isBackendInfrastructureError(err)) {
        if (!isConditional) {
          setError('Biometric login is temporarily unavailable. Please use OTP or Google.');
        }
        return null;
      }

      setError(err?.message || 'Authentication failed.');
      return null;
    } finally {
      if (!isConditional) {
        setLoading(false);
      }
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
    && isOnline
    && Boolean(userId && isSupported && !isRegistered && !getNeverAsk(userId ?? ''));

  const canAuthenticate = isReady
    && isOnline
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
    credentialsError,
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
