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
  storeCredentialId,
  registerBiometric,
  activateBiometricOnCurrentDevice,
  authenticateWithBiometric,
  removeBiometricCredential,
  removeCredentialById,
  fetchCredentials,
  waitForCredentialEnrollment,
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

  const reconcileCredentials = useCallback((list: StoredCredential[], currentId: string | null): StoredCredential[] => {
    if (currentId) {
      return list.map((credential) => ({
        ...credential,
        isCurrentDevice: credential.credentialId === currentId,
      }));
    }

    const matchingCurrentClient = list.filter((credential) => credential.matchesCurrentClient);
    if (matchingCurrentClient.length === 1 && userId) {
      const repairedCredentialId = matchingCurrentClient[0].credentialId;
      storeCredentialId(userId, repairedCredentialId);
      return list.map((credential) => ({
        ...credential,
        isCurrentDevice: credential.credentialId === repairedCredentialId,
      }));
    }

    return list;
  }, [userId]);

  const resolveActivatableCredentialId = useCallback((list: StoredCredential[]): string | null => {
    const syncedCredentials = list.filter((credential) => credential.backedUp);
    if (syncedCredentials.length === 1) {
      return syncedCredentials[0].credentialId;
    }

    return null;
  }, []);

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

  const refreshCredentials = useCallback(async (options?: { expectedCredentialId?: string }) => {
    if (!userId) return;
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const expectedCredentialId = options?.expectedCredentialId;
      const list = expectedCredentialId
        ? await waitForCredentialEnrollment(userId, expectedCredentialId)
        : await fetchCredentials(userId, { preferServer: true });

      const currentId = getStoredCredentialId(userId);
      const reconciled = reconcileCredentials(list, currentId);
      setCredentials(reconciled);

      const resolvedCurrentId = getStoredCredentialId(userId);
      if (resolvedCurrentId) {
        const stillExists = reconciled.some((credential) => credential.credentialId === resolvedCurrentId);
        if (!stillExists) {
          clearCredentialId(userId);
          setIsRegistered(false);
        } else {
          setIsRegistered(true);
        }
      } else {
        setIsRegistered(reconciled.some((credential) => credential.isCurrentDevice));
      }
    } catch {
      setCredentialsError('Could not load biometric devices right now. Please retry.');
    } finally {
      setCredentialsLoading(false);
    }
  }, [reconcileCredentials, userId]);

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
      const credentialId = await registerBiometric(userId);
      setIsRegistered(true);
      await refreshCredentials({ expectedCredentialId: credentialId });

      const confirmedCredentialId = getStoredCredentialId(userId);
      if (!confirmedCredentialId) {
        setIsRegistered(false);
        setError('Biometrics enrollment could not be confirmed. Please try again.');
        return false;
      }
      return true;
    } catch (err: any) {
      if (isLikelyCancellationError(err)) {
        setError('Biometric prompt was cancelled.');
        return false;
      }

      if (err?.name === 'InvalidStateError') {
        try {
          const activation = await activateBiometricOnCurrentDevice(userId);
          if (activation.credentialId) {
            await refreshCredentials({ expectedCredentialId: activation.credentialId }).catch(() => {});
            setIsRegistered(true);
            setError(null);
            return true;
          }
        } catch (activationError: any) {
          if (isLikelyCancellationError(activationError)) {
            setError('Biometric prompt was cancelled.');
            return false;
          }
        }

        try {
          const serverCredentials = await fetchCredentials(userId, { preferServer: true });
          const activatableCredentialId = resolveActivatableCredentialId(serverCredentials);
          if (activatableCredentialId) {
            storeCredentialId(userId, activatableCredentialId);
            await refreshCredentials({ expectedCredentialId: activatableCredentialId }).catch(() => {});
            setIsRegistered(true);
            setError(null);
            return true;
          }
        } catch {
          // Fall through to the final recovery message below.
        }

        await refreshCredentials().catch(() => {});
        if (getStoredCredentialId(userId)) {
          setIsRegistered(true);
          return true;
        }
        setError('A synced biometric passkey already exists for this account, but this device could not activate it. Please try again.');
        return false;
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
  }, [activateBiometricOnCurrentDevice, fetchCredentials, refreshCredentials, resolveActivatableCredentialId, userId]);

  const authenticate = useCallback(async (options?: {
    mediation?: 'conditional' | 'required' | 'optional';
  }): Promise<{ customToken: string; userId: string | null } | null> => {
    const isConditional = options?.mediation === 'conditional';
    // Use the explicitly provided userId for challenges.
    // If not provided, but we are explicitly clicking the login button (!isConditional),
    // fall back to the last locally enrolled user to ensure maximum compatibility
    // with non-discoverable credentials (e.g. older Android authenticators).
    const authChallengeUserId = userId ?? (isConditional ? null : localEnrolledUserId);
    
    if (!isConditional) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await authenticateWithBiometric(
        authChallengeUserId,
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
        const attemptedCredentialId = err.attemptedCredentialId;
        const currentCredentialId = effectiveUserId ? getStoredCredentialId(effectiveUserId) : null;

        // If the server reported a specific credential as stale, only clear local state
        // if it matches what we have stored. If it's a client-side error (no attemptedCredentialId),
        // it means the authenticator couldn't find our requested credential, so it IS stale.
        if (!attemptedCredentialId || attemptedCredentialId === currentCredentialId) {
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
        } else {
          // A different credential was used and failed. Do not clear our valid local state.
          if (!isConditional) {
            setError('The selected passkey is no longer valid. Please try again.');
          }
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
    effectiveUserId,
  };
};
