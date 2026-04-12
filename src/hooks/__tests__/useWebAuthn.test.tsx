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
  storeCredentialIdMock,
  registerBiometricMock,
  activateBiometricOnCurrentDeviceMock,
  authenticateWithBiometricMock,
  fetchCredentialsMock,
  waitForCredentialEnrollmentMock,
  clearCredentialIdMock,
} = vi.hoisted(() => ({
  isWebAuthnSupportedMock: vi.fn(),
  isPlatformAuthenticatorAvailableMock: vi.fn(),
  isWebAuthnAutofillSupportedMock: vi.fn(),
  getStoredCredentialIdMock: vi.fn(),
  getLastEnrolledUserIdMock: vi.fn(),
  getNeverAskMock: vi.fn(),
  storeCredentialIdMock: vi.fn(),
  registerBiometricMock: vi.fn(),
  activateBiometricOnCurrentDeviceMock: vi.fn(),
  authenticateWithBiometricMock: vi.fn(),
  fetchCredentialsMock: vi.fn(),
  waitForCredentialEnrollmentMock: vi.fn(),
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
  storeCredentialId: storeCredentialIdMock,
  setNeverAsk: vi.fn(),
  registerBiometric: registerBiometricMock,
  activateBiometricOnCurrentDevice: activateBiometricOnCurrentDeviceMock,
  authenticateWithBiometric: authenticateWithBiometricMock,
  removeBiometricCredential: vi.fn(),
  removeCredentialById: vi.fn(),
  fetchCredentials: fetchCredentialsMock,
  waitForCredentialEnrollment: waitForCredentialEnrollmentMock,
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
    activateBiometricOnCurrentDeviceMock.mockResolvedValue({
      credentialId: 'cred-1',
      userId: 'donor-1',
    });
    waitForCredentialEnrollmentMock.mockResolvedValue([
      {
        credentialId: 'cred-1',
        deviceName: 'iPhone',
        deviceDetails: 'iOS · Safari',
        deviceType: 'platform',
        backedUp: false,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: true,
        matchesCurrentClient: true,
      },
    ]);
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
        matchesCurrentClient: true,
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

  it('confirms registration only after the credential is visible in the account list path', async () => {
    registerBiometricMock.mockResolvedValue('cred-2');
    getStoredCredentialIdMock.mockReturnValue('cred-2');
    waitForCredentialEnrollmentMock.mockResolvedValue([
      {
        credentialId: 'cred-2',
        deviceName: 'Mac',
        deviceDetails: 'macOS · Safari',
        deviceType: 'platform',
        backedUp: true,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: true,
        matchesCurrentClient: true,
      },
    ]);

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let registered = false;
    await act(async () => {
      registered = await result.current.register();
    });

    expect(waitForCredentialEnrollmentMock).toHaveBeenCalledWith('donor-1', 'cred-2');
    expect(registered).toBe(true);
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.credentials[0]?.credentialId).toBe('cred-2');
  });

  it('repairs missing local current-device state from a unique matching server credential', async () => {
    getStoredCredentialIdMock.mockReturnValue(null);
    fetchCredentialsMock.mockResolvedValue([
      {
        credentialId: 'cred-9',
        deviceName: 'Mac',
        deviceDetails: 'macOS · Safari',
        deviceType: 'platform',
        backedUp: true,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: false,
        matchesCurrentClient: true,
      },
    ]);

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.credentialsLoading).toBe(false);
    });

    expect(storeCredentialIdMock).toHaveBeenCalledWith('donor-1', 'cred-9');
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.credentials[0]?.isCurrentDevice).toBe(true);
  });

  it('does not set loading state during conditional mediation', async () => {
    isPlatformAuthenticatorAvailableMock.mockResolvedValue(true);
    isWebAuthnAutofillSupportedMock.mockResolvedValue(true);
    authenticateWithBiometricMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { customToken: 'token-1', userId: 'donor-1' };
    });

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let authPromise: Promise<any>;
    await act(async () => {
      authPromise = result.current.authenticate({ mediation: 'conditional' });
    });

    expect(result.current.loading).toBe(false);

    await act(async () => {
      await authPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('suppresses backend infrastructure errors during conditional mediation', async () => {
    isPlatformAuthenticatorAvailableMock.mockResolvedValue(true);
    isWebAuthnAutofillSupportedMock.mockResolvedValue(true);
    authenticateWithBiometricMock.mockRejectedValue(new Error('Missing Firebase Admin credentials.'));

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.authenticate({ mediation: 'conditional' });
    });

    expect(result.current.error).toBeNull();
  });

  it('shows a generic message for backend infrastructure errors during manual login', async () => {
    authenticateWithBiometricMock.mockRejectedValue(new Error('Missing Firebase Admin credentials.'));

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.error).toBe('Biometric login is temporarily unavailable. Please use OTP or Google.');
  });

  it('shows a generic message for failed-precondition errors during manual login', async () => {
    authenticateWithBiometricMock.mockRejectedValue({
      code: 'failed-precondition',
      message: '9 FAILED_PRECONDITION: missing index',
    });

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.error).toBe('Biometric login is temporarily unavailable. Please use OTP or Google.');
  });

  it('does not treat InvalidStateError as success when enrollment cannot be verified', async () => {
    registerBiometricMock.mockRejectedValue({ name: 'InvalidStateError' });
    activateBiometricOnCurrentDeviceMock.mockRejectedValue(new Error('Activation failed'));
    getStoredCredentialIdMock.mockReturnValue(null);
    fetchCredentialsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let registered = true;
    await act(async () => {
      registered = await result.current.register();
    });

    expect(registered).toBe(false);
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.error).toContain('could not activate');
  });

  it('activates an existing synced passkey on a second device after InvalidStateError', async () => {
    registerBiometricMock.mockRejectedValue({ name: 'InvalidStateError' });
    activateBiometricOnCurrentDeviceMock.mockResolvedValue({
      credentialId: 'cred-synced',
      userId: 'donor-1',
    });
    getStoredCredentialIdMock.mockReturnValue('cred-synced');
    waitForCredentialEnrollmentMock.mockResolvedValue([
      {
        credentialId: 'cred-synced',
        deviceName: 'Android Device',
        deviceDetails: 'Android 15 · Chrome',
        deviceType: 'platform',
        backedUp: true,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: true,
        matchesCurrentClient: false,
      },
    ]);

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let registered = false;
    await act(async () => {
      registered = await result.current.register();
    });

    expect(activateBiometricOnCurrentDeviceMock).toHaveBeenCalledWith('donor-1');
    expect(waitForCredentialEnrollmentMock).toHaveBeenCalledWith('donor-1', 'cred-synced');
    expect(registered).toBe(true);
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('adopts a single existing synced credential when activation cannot complete but account state is unambiguous', async () => {
    let storedCredentialId: string | null = null;
    registerBiometricMock.mockRejectedValue({ name: 'InvalidStateError' });
    activateBiometricOnCurrentDeviceMock.mockRejectedValue(new Error('Activation failed'));
    getStoredCredentialIdMock.mockImplementation(() => storedCredentialId);
    storeCredentialIdMock.mockImplementation((_userId: string, credentialId: string) => {
      storedCredentialId = credentialId;
    });
    fetchCredentialsMock.mockResolvedValue([
      {
        credentialId: 'cred-backed-up',
        deviceName: 'Mac',
        deviceDetails: 'macOS · Chrome',
        deviceType: 'platform',
        backedUp: true,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: false,
        matchesCurrentClient: false,
      },
    ]);
    waitForCredentialEnrollmentMock.mockResolvedValue([
      {
        credentialId: 'cred-backed-up',
        deviceName: 'Mac',
        deviceDetails: 'macOS · Chrome',
        deviceType: 'platform',
        backedUp: true,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: true,
        matchesCurrentClient: false,
      },
    ]);

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let registered = false;
    await act(async () => {
      registered = await result.current.register();
    });

    expect(storeCredentialIdMock).toHaveBeenCalledWith('donor-1', 'cred-backed-up');
    expect(waitForCredentialEnrollmentMock).toHaveBeenCalledWith('donor-1', 'cred-backed-up');
    expect(registered).toBe(true);
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not auto-adopt a single non-synced credential from another device', async () => {
    registerBiometricMock.mockRejectedValue({ name: 'InvalidStateError' });
    activateBiometricOnCurrentDeviceMock.mockRejectedValue(new Error('Activation failed'));
    getStoredCredentialIdMock.mockReturnValue(null);
    fetchCredentialsMock.mockResolvedValue([
      {
        credentialId: 'cred-mac-only',
        deviceName: 'Mac',
        deviceDetails: 'macOS · Chrome',
        deviceType: 'platform',
        backedUp: false,
        createdAt: null,
        lastUsedAt: null,
        isCurrentDevice: false,
        matchesCurrentClient: false,
      },
    ]);

    const { result } = renderHook(() => useWebAuthn('donor-1'));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    let registered = true;
    await act(async () => {
      registered = await result.current.register();
    });

    expect(storeCredentialIdMock).not.toHaveBeenCalledWith('donor-1', 'cred-mac-only');
    expect(registered).toBe(false);
    expect(result.current.error).toContain('could not activate');
  });
});
