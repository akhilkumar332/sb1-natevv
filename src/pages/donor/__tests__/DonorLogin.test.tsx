import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DonorLogin from '../DonorLogin';

const {
  useAuthMock,
  useLoginMock,
  useWebAuthnMock,
  notifySuccessMock,
  notifyFromErrorMock,
  navigateMock,
  locationMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useLoginMock: vi.fn(),
  useWebAuthnMock: vi.fn(),
  notifySuccessMock: vi.fn(),
  notifyFromErrorMock: vi.fn(),
  navigateMock: vi.fn(),
  locationMock: { search: '' },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationMock,
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../hooks/useLogin', () => ({
  useLogin: () => useLoginMock(),
}));

vi.mock('../../../hooks/useWebAuthn', () => ({
  useWebAuthn: () => useWebAuthnMock(),
}));

vi.mock('../../../hooks/useOtpResendTimer', () => ({
  useOtpResendTimer: () => ({
    otpResendTimer: 30,
    startResendTimer: vi.fn(),
  }),
}));

vi.mock('../../../services/notify.service', () => ({
  notify: {
    success: notifySuccessMock,
    error: vi.fn(),
    fromError: notifyFromErrorMock,
  },
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string | number>) => {
        if (key === 'auth.phoneLinkFinishTitle') return 'Finish linking your phone';
        if (key === 'auth.phoneLinkContinueLater') return 'Continue without linking for now';
        if (key === 'auth.phoneLinkFinishDescription') {
          return `Finish linking ${options?.phoneNumber ?? ''}`;
        }
        if (key === 'auth.weSentCode') return "We've sent a 6-digit code to your phone";
        if (key === 'auth.resendOtpIn') return `Resend OTP in ${options?.seconds} seconds`;
        if (key === 'auth.verifyOtp') return 'Verify OTP';
        if (key === 'common.verifying') return 'Verifying';
        if (key === 'common.processing') return 'Processing';
        return key;
      },
    }),
  };
});

vi.mock('../../../components/LogoMark', () => ({
  default: () => <div>Logo</div>,
}));

vi.mock('../../../components/PwaInstallCta', () => ({
  default: () => null,
}));

vi.mock('../../../components/auth/SuperAdminPortalModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/auth/AuthStatusScreen', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}));

describe('DonorLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationMock.search = '';
    useLoginMock.mockReturnValue({
      formData: { identifier: '', otp: '' },
      otpResendTimer: 0,
      confirmationResult: null,
      authLoading: false,
      googleLoading: false,
      otpLoading: false,
      handleIdentifierChange: vi.fn(),
      handleChange: vi.fn(),
      handlePhoneNumberSubmit: vi.fn(),
      handleOTPSubmit: vi.fn(),
      handleResendOTP: vi.fn(),
      handleGoogleLogin: vi.fn(),
    });
    useWebAuthnMock.mockReturnValue({
      isSupported: false,
      supportsAutofill: false,
      canAuthenticate: false,
      isReady: true,
      loading: false,
      error: null,
      needsReenroll: false,
      biometricLabel: 'Fingerprint',
      authenticate: vi.fn().mockResolvedValue(null),
    });
  });

  it('renders guided phone-link continuation and auto-sends a fresh OTP', async () => {
    const startPhoneLinkMock = vi.fn().mockResolvedValue({ verificationId: 'verification-1' });

    useAuthMock.mockReturnValue({
      user: { uid: 'donor-1', role: 'donor', onboardingCompleted: true },
      isSuperAdmin: false,
      setPortalRole: vi.fn(),
      startImpersonation: vi.fn(),
      impersonationSession: null,
      isImpersonating: false,
      impersonationTransition: null,
      effectiveRole: 'donor',
      profileResolved: true,
      startPhoneLink: startPhoneLinkMock,
      confirmPhoneLink: vi.fn(),
      pendingPhoneLinkContinuation: {
        targetUid: 'donor-1',
        phoneNumber: '+911234567890',
        createdAt: Date.now(),
      },
      clearPendingPhoneLinkContinuation: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DonorLogin />
      </MemoryRouter>
    );

    expect(screen.getByText('Finish linking your phone')).toBeInTheDocument();
    expect(screen.getByText('Finish linking +911234567890')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'auth.signInWithGoogle' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(startPhoneLinkMock).toHaveBeenCalledWith('+911234567890');
    });
  });

  it('lets the user continue later from the guided phone-link step and preserves returnTo navigation', async () => {
    const startPhoneLinkMock = vi.fn().mockResolvedValue({ verificationId: 'verification-1' });
    const clearPendingContinuationMock = vi.fn();
    locationMock.search = '?returnTo=%2Fdonor%2Fdashboard%2Frequests&pendingRequest=1';

    useAuthMock.mockReturnValue({
      user: { uid: 'donor-1', role: 'donor', onboardingCompleted: true },
      isSuperAdmin: false,
      setPortalRole: vi.fn(),
      startImpersonation: vi.fn(),
      impersonationSession: null,
      isImpersonating: false,
      impersonationTransition: null,
      effectiveRole: 'donor',
      profileResolved: true,
      startPhoneLink: startPhoneLinkMock,
      confirmPhoneLink: vi.fn(),
      pendingPhoneLinkContinuation: {
        targetUid: 'donor-1',
        phoneNumber: '+911234567890',
        createdAt: Date.now(),
      },
      clearPendingPhoneLinkContinuation: clearPendingContinuationMock,
    });

    render(
      <MemoryRouter>
        <DonorLogin />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Continue without linking for now' }));

    expect(clearPendingContinuationMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/donor/dashboard/requests?pendingRequest=1');
  });

  it('shows biometric login when capability is available without viewport gating', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isSuperAdmin: false,
      setPortalRole: vi.fn(),
      startImpersonation: vi.fn(),
      impersonationSession: null,
      isImpersonating: false,
      impersonationTransition: null,
      effectiveRole: null,
      profileResolved: true,
      startPhoneLink: vi.fn(),
      confirmPhoneLink: vi.fn(),
      pendingPhoneLinkContinuation: null,
      clearPendingPhoneLinkContinuation: vi.fn(),
      loginWithBiometric: vi.fn(),
    });
    useWebAuthnMock.mockReturnValue({
      isSupported: true,
      supportsAutofill: false,
      canAuthenticate: true,
      isReady: true,
      loading: false,
      error: null,
      needsReenroll: false,
      biometricLabel: 'Touch ID',
      authenticate: vi.fn().mockResolvedValue(null),
    });

    render(
      <MemoryRouter>
        <DonorLogin />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Login with Touch ID' })).toBeInTheDocument();
  });

  it('shows biometric login when browser autofill support exists without platform authenticator support', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isSuperAdmin: false,
      setPortalRole: vi.fn(),
      startImpersonation: vi.fn(),
      impersonationSession: null,
      isImpersonating: false,
      impersonationTransition: null,
      effectiveRole: null,
      profileResolved: true,
      startPhoneLink: vi.fn(),
      confirmPhoneLink: vi.fn(),
      pendingPhoneLinkContinuation: null,
      clearPendingPhoneLinkContinuation: vi.fn(),
      loginWithBiometric: vi.fn(),
    });
    useWebAuthnMock.mockReturnValue({
      isSupported: false,
      supportsAutofill: true,
      canAuthenticate: true,
      isReady: true,
      loading: false,
      error: null,
      needsReenroll: false,
      biometricLabel: 'Biometrics',
      authenticate: vi.fn().mockResolvedValue(null),
    });

    render(
      <MemoryRouter>
        <DonorLogin />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Login with Biometrics' })).toBeInTheDocument();
  });
});
