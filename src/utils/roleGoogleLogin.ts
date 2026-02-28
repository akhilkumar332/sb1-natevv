import { auth } from '../firebase';
import { notify } from 'services/notify.service';
import { authStorage } from './authStorage';
import type { NavigateFunction } from 'react-router-dom';
import { captureHandledError } from '../services/errorLog.service';
import { authFlowMessages } from './authInputValidation';

type GoogleLoginResponse = {
  user: {
    role?: string | null;
    onboardingCompleted?: boolean;
  };
  token?: string;
};

export async function handleRoleGoogleLogin({
  loginWithGoogle,
  logout,
  navigate,
  setShowPortalModal,
  expectedRoles,
  roleMismatchMessage,
  roleMismatchId,
  mismatchRedirectTo,
  successMessage,
  dashboardPath,
  onboardingPath,
  persistTokenOnSuccess = false,
  scope = 'auth',
  page = 'RoleGoogleLogin',
}: {
  loginWithGoogle: () => Promise<GoogleLoginResponse>;
  logout: (
    navigate: NavigateFunction,
    opts?: { redirectTo?: string; showToast?: boolean }
  ) => Promise<void>;
  navigate: NavigateFunction;
  setShowPortalModal: (value: boolean) => void;
  expectedRoles: string[];
  roleMismatchMessage: string;
  roleMismatchId: string;
  mismatchRedirectTo: string;
  successMessage: string;
  dashboardPath: string;
  onboardingPath: string;
  persistTokenOnSuccess?: boolean;
  scope?: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  page?: string;
}) {
  try {
    const response = await loginWithGoogle();
    if (response.user.role === 'superadmin') {
      const token = response?.token ?? (await auth.currentUser?.getIdToken());
      if (token) {
        authStorage.setAuthToken(token);
      }
      setShowPortalModal(true);
      return;
    }

    if (!expectedRoles.includes(response.user.role || '')) {
      notify.error(roleMismatchMessage, { id: roleMismatchId });
      try {
        await logout(navigate, { redirectTo: mismatchRedirectTo, showToast: false });
      } catch (logoutError) {
        void captureHandledError(logoutError, {
          source: 'frontend',
          scope,
          metadata: {
            page,
            kind: 'auth.role_google_login.logout_after_mismatch',
            mismatchRedirectTo,
            expectedRoles,
            actualRole: response.user.role || 'unknown',
          },
        });
        navigate(mismatchRedirectTo);
      }
      return;
    }

    if (persistTokenOnSuccess) {
      const token = response?.token ?? (await auth.currentUser?.getIdToken());
      if (token) {
        authStorage.setAuthToken(token);
      }
    }

    notify.success(successMessage);
    navigate(response.user.onboardingCompleted === true ? dashboardPath : onboardingPath);
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope,
      metadata: {
        page,
        kind: 'auth.role_google_login',
        expectedRoles,
      },
    });
    notify.error(authFlowMessages.googleSignInFailed);
  }
}
