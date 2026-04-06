import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ROUTES } from '../../constants/routes';

const mockSetAuthToken = vi.hoisted(() => vi.fn());
const mockNotifyError = vi.hoisted(() => vi.fn());
const mockNotifySuccess = vi.hoisted(() => vi.fn());
const mockCaptureHandledError = vi.hoisted(() => vi.fn());
const mockNotifyGoogleSignInFailure = vi.hoisted(() => vi.fn());
const mockCleanupAuthSession = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => ({
  currentUser: {
    getIdToken: vi.fn().mockResolvedValue('token-123'),
  },
}));

vi.mock('../../firebase', () => ({
  auth: mockAuth,
}));

vi.mock('services/notify.service', () => ({
  notify: {
    error: mockNotifyError,
    success: mockNotifySuccess,
  },
}));

vi.mock('../authStorage', () => ({
  authStorage: {
    setAuthToken: mockSetAuthToken,
  },
}));

vi.mock('../../services/errorLog.service', () => ({
  captureHandledError: mockCaptureHandledError,
}));

vi.mock('../authNotifications', () => ({
  notifyGoogleSignInFailure: mockNotifyGoogleSignInFailure,
}));

vi.mock('../authSessionCleanup', () => ({
  cleanupAuthSession: mockCleanupAuthSession,
}));

import { handleRoleGoogleLogin } from '../roleGoogleLogin';

describe('handleRoleGoogleLogin', () => {
  const navigate = vi.fn();
  const setShowPortalModal = vi.fn();
  const logout = vi.fn();
  const loginWithGoogle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    setShowPortalModal.mockReset();
    logout.mockReset();
    loginWithGoogle.mockReset();
    mockCleanupAuthSession.mockResolvedValue(undefined);
  });

  it('cleans up and redirects when role mismatch logout fails', async () => {
    loginWithGoogle.mockResolvedValue({
      user: {
        role: 'ngo',
        onboardingCompleted: true,
      },
    });
    logout.mockRejectedValue(new Error('logout failed'));

    await handleRoleGoogleLogin({
      loginWithGoogle,
      logout,
      navigate,
      setShowPortalModal,
      expectedRoles: ['donor'],
      roleMismatchMessage: 'role mismatch',
      roleMismatchId: 'role-mismatch',
      mismatchRedirectTo: ROUTES.portal.donor.login,
      successMessage: 'success',
      dashboardPath: ROUTES.portal.donor.dashboard.root,
      onboardingPath: ROUTES.portal.donor.onboarding,
    });

    expect(mockNotifyError).toHaveBeenCalledWith('role mismatch', { id: 'role-mismatch' });
    expect(mockCleanupAuthSession).toHaveBeenCalledWith({
      scope: 'auth',
      kind: 'auth.role_google_login.logout_after_mismatch_cleanup',
      metadata: {
        page: 'RoleGoogleLogin',
        mismatchRedirectTo: ROUTES.portal.donor.login,
        expectedRoles: ['donor'],
        actualRole: 'ngo',
      },
    });
    expect(navigate).toHaveBeenCalledWith(ROUTES.portal.donor.login);
  });
});
