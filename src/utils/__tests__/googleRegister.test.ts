import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../constants/routes';

const mockSignInWithPopup = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockGetAdditionalUserInfo = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn());
const mockEnableNetwork = vi.hoisted(() => vi.fn());
const mockGetDoc = vi.hoisted(() => vi.fn());
const mockSetDoc = vi.hoisted(() => vi.fn());
const mockServerTimestamp = vi.hoisted(() => vi.fn(() => 'ts'));
const mockApplyReferralTrackingForUser = vi.hoisted(() => vi.fn());
const mockCaptureHandledError = vi.hoisted(() => vi.fn());
const mockSetAuthToken = vi.hoisted(() => vi.fn());
const mockNotifySuccess = vi.hoisted(() => vi.fn());
const mockNotifyError = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => ({
  currentUser: null as null | { uid: string },
}));

vi.mock('firebase/auth', () => ({
  getAdditionalUserInfo: mockGetAdditionalUserInfo,
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  enableNetwork: mockEnableNetwork,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('../../firebase', () => ({
  auth: mockAuth,
  db: {},
  googleProvider: {},
}));

vi.mock('../../services/referral.service', () => ({
  applyReferralTrackingForUser: mockApplyReferralTrackingForUser,
}));

vi.mock('../../services/errorLog.service', () => ({
  captureHandledError: mockCaptureHandledError,
}));

vi.mock('../authStorage', () => ({
  authStorage: {
    setAuthToken: mockSetAuthToken,
  },
}));

vi.mock('../authInputValidation', () => ({
  authFlowMessages: {
    emailRegistered: 'email-registered',
    registrationFailed: 'registration-failed',
  },
}));

vi.mock('../../constants/firestore', () => ({
  COLLECTIONS: {
    USERS: 'users',
  },
}));

vi.mock('services/notify.service', () => ({
  notify: {
    success: mockNotifySuccess,
    error: mockNotifyError,
  },
}));

import { registerWithGoogleRole } from '../googleRegister';

describe('registerWithGoogleRole', () => {
  const navigate = vi.fn();

  const baseArgs = {
    role: 'donor' as const,
    loginPath: ROUTES.portal.donor.login,
    onboardingPath: ROUTES.portal.donor.onboarding,
    scope: 'auth' as const,
    kind: 'auth.register.google',
    navigate,
    persistToken: true,
  };

  const popupResult = {
    user: {
      uid: 'uid-1',
      email: 'donor@example.com',
      displayName: 'Donor',
      photoURL: 'photo',
      getIdToken: vi.fn().mockResolvedValue('token-123'),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    window.sessionStorage.clear();
    mockAuth.currentUser = null;
    mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: true });
    mockEnableNetwork.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
    mockDoc.mockImplementation((_db: unknown, collectionName: string, uid: string) => ({
      id: `${collectionName}/${uid}`,
    }));
  });

  it('keeps registration successful when referral tracking fails', async () => {
    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockSetDoc.mockResolvedValue(undefined);
    mockApplyReferralTrackingForUser.mockRejectedValue(new Error('permission-denied'));

    await registerWithGoogleRole(baseArgs);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockApplyReferralTrackingForUser).toHaveBeenCalledWith('uid-1');
    expect(mockSetAuthToken).toHaveBeenCalledWith('token-123');
    expect(mockNotifySuccess).toHaveBeenCalledWith('Registration successful!');
    expect(navigate).toHaveBeenCalledWith(ROUTES.portal.donor.onboarding);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('bh_registration_intent')).toBeNull();
    expect(window.sessionStorage.getItem('bh_pending_portal_role')).not.toBeNull();
  });

  it('signs out and redirects to login when user already exists', async () => {
    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: false });
    mockSignOut.mockResolvedValue(undefined);

    await registerWithGoogleRole(baseArgs);

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNotifyError).toHaveBeenCalledWith('email-registered');
    expect(navigate).toHaveBeenCalledWith(ROUTES.portal.donor.login);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('bh_registration_intent')).toBeNull();
    expect(window.sessionStorage.getItem('bh_pending_portal_role')).toBeNull();
  });

  it('signs out on critical profile creation failure', async () => {
    const fatalError = new Error('Missing or insufficient permissions');

    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockSetDoc.mockRejectedValue(fatalError);
    mockSignOut.mockResolvedValue(undefined);
    mockAuth.currentUser = { uid: 'uid-1' };

    await registerWithGoogleRole(baseArgs);

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNotifyError).toHaveBeenCalledWith('Missing or insufficient permissions');
    expect(navigate).not.toHaveBeenCalledWith('/donor/onboarding');
    expect(window.sessionStorage.getItem('bh_registration_intent')).toBeNull();
    expect(window.sessionStorage.getItem('bh_pending_portal_role')).toBeNull();
  });

  it('continues registration when enableNetwork fails', async () => {
    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockEnableNetwork.mockRejectedValue(new Error('network toggle failed'));
    mockSetDoc.mockResolvedValue(undefined);
    mockApplyReferralTrackingForUser.mockResolvedValue(null);

    await registerWithGoogleRole(baseArgs);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockNotifySuccess).toHaveBeenCalledWith('Registration successful!');
    expect(navigate).toHaveBeenCalledWith(ROUTES.portal.donor.onboarding);
  });

  it('shows offline-specific error message for network failures', async () => {
    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockSetDoc.mockRejectedValue(Object.assign(new Error('client is offline'), { code: 'unavailable' }));
    mockSignOut.mockResolvedValue(undefined);
    mockAuth.currentUser = { uid: 'uid-1' };

    await registerWithGoogleRole(baseArgs);

    expect(mockNotifyError).toHaveBeenCalledWith('Internet connection lost during Google signup. Reconnect and try again.');
  });

  it('retries bootstrap profile creation when auth has not propagated to Firestore yet', async () => {
    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockAuth.currentUser = { uid: 'uid-1' };
    mockSetDoc
      .mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }))
      .mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }))
      .mockResolvedValueOnce(undefined);
    mockApplyReferralTrackingForUser.mockResolvedValue(null);

    await registerWithGoogleRole(baseArgs);

    expect(mockSetDoc).toHaveBeenCalledTimes(3);
    expect(mockNotifySuccess).toHaveBeenCalledWith('Registration successful!');
    expect(navigate).toHaveBeenCalledWith(ROUTES.portal.donor.onboarding);
  });

  it('treats a duplicate bootstrap write as success when the donor profile already exists', async () => {
    mockSignInWithPopup.mockResolvedValue(popupResult);
    mockAuth.currentUser = { uid: 'uid-1' };
    mockSetDoc.mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }));
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'donor', onboardingCompleted: false }),
    });
    mockApplyReferralTrackingForUser.mockResolvedValue(null);

    await registerWithGoogleRole(baseArgs);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(mockNotifySuccess).toHaveBeenCalledWith('Registration successful!');
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
