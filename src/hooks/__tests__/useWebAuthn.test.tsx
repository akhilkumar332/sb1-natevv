import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebAuthn } from '../useWebAuthn';

const {
  isWebAuthnSupportedMock,
  isPlatformAuthenticatorAvailableMock,
  isWebAuthnAutofillSupportedMock,
  getStoredCredentialIdMock,
  getLastEnrolledUserIdMock,
  getNeverAskMock,
  registerBiometricMock,
  authenticateWithBiometricMock,
  fetchCredentialsMock,
  clearCredentialIdMock,
} = vi.hoisted(() => ({
  isWebAuthnSupportedMock: vi.fn(),
  isPlatformAuthenticatorAvailableMock: vi.fn(),
  isWebAuthnAutofillSupportedMock: vi.fn(),
  getStoredCredentialIdMock: vi.fn(),
  getLastEnrolledUserIdMock: vi.fn(),
  getNeverAskMock: vi.fn(),
  registerBiometricMock: vi.fn(),
  authenticateWithBiometricMock: vi.fn(),
  fetchCredentialsMock: vi.fn(),
  clearCredentialIdMock: vi.fn(),
}));

vi.mock('../../services/webauthn.service', () => ({
  isWebAuthnSupported: isWebAuthnSupportedMock,
  isPlatformAuthenticatorAvailable: isPlatformAuthenticatorAvailableMock,
  isWebAuthnAutofillSupported: isWebAuthnAutofillSupportedMock,
  getBiometricLabel: () => 'Fingerprint',
  getStoredCredentialId: getStoredCredentialIdMock,
  getLastEnrolledUserId: getLastEnrolledUserIdMock,
  getNeverAsk: getNeverAskMock,
  setNeverAsk: vi.fn(),
  registerBiometric: registerBiometricMock,
  authenticateWithBiometric: authenticateWithBiometricMock,
  removeBiometricCredential: vi.fn(),
  removeCredentialById: vi.fn(),
  fetchCredentials: fetchCredentialsMock,
  clearCredentialId: clearCredentialIdMock,
}));

vi.mock('../../services/errorLog.service', () => ({
  captureHandledError: vi.fn(),
}));

describe('useWebAuthn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isWebAuthnSupportedMock.mockReturnValue(true);
    isPlatformAuthenticatorAvailableMock.mockResolvedValue(true);
    isWebAuthnAutofillSupportedMock.mockResolvedValue(false);
    getStoredCredentialIdMock.mockReturnValue('cred-1');
    getLastEnrolledUserIdMock.mockReturnValue('donor-1');
    getNeverAskMock.mockReturnValue(false);
    fetchCredentialsMock.mockResolvedValue([
      {
        credentialId: 'cred-1',
        deviceName: 'iPhone',
        deviceDetails: 'iOS · Safari',
        deviceType: 'platform',
        backedUp: false,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: true,
      },
    ]);
  });

  it('does not force reenroll when the user cancels authentication', async () => {
    authenticateWithBiometricMock.mockRejectedValue({
      name: 'NotAllowedError',
      message: 'The operation was cancelled by the user.',
    });

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let authResult: Awaited<ReturnType<typeof result.current.authenticate>> | null = null;
    await act(async () => {
      authResult = await result.current.authenticate();
    });

    expect(authResult).toBeNull();
    expect(result.current.needsReenroll).toBe(false);
    expect(result.current.error).toBe('Biometric prompt was cancelled.');
  });

  it('marks stale credentials for reenrollment when authentication says credential not found', async () => {
    authenticateWithBiometricMock.mockRejectedValue(new Error('Credential not found'));

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.authenticate();
    });

    expect(clearCredentialIdMock).toHaveBeenCalledWith('donor-1');
    expect(result.current.needsReenroll).toBe(true);
    expect(result.current.isRegistered).toBe(false);
  });

  it('can authenticate with autofill support even without a locally stored credential', async () => {
    getStoredCredentialIdMock.mockReturnValue(null);
    getLastEnrolledUserIdMock.mockReturnValue(null);
    isPlatformAuthenticatorAvailableMock.mockResolvedValue(false);
    isWebAuthnAutofillSupportedMock.mockResolvedValue(true);

    const { result } = renderHook(() => useWebAuthn(null));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.canAuthenticate).toBe(true);
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.supportsAutofill).toBe(true);
  });

  it('updates local enrollment state after successful usernameless biometric login', async () => {
    let storedCredentialId: string | null = null;
    getStoredCredentialIdMock.mockImplementation(() => storedCredentialId);
    getLastEnrolledUserIdMock.mockImplementation(() => (storedCredentialId ? 'donor-1' : null));
    isPlatformAuthenticatorAvailableMock.mockResolvedValue(false);
    isWebAuthnAutofillSupportedMock.mockResolvedValue(true);
    authenticateWithBiometricMock.mockImplementation(async () => {
      storedCredentialId = 'cred-1';
      return { customToken: 'token-1', userId: 'donor-1' };
    });

    const { result } = renderHook(() => useWebAuthn(null));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.isRegistered).toBe(true);
  });
});
