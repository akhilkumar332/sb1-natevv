import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogin } from '../useLogin';

const {
  navigateMock,
  loginWithGoogleMock,
  loginWithPhoneMock,
  verifyOTPMock,
  logoutMock,
  notifySuccessMock,
  notifyErrorMock,
  setAuthTokenMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  loginWithGoogleMock: vi.fn(),
  loginWithPhoneMock: vi.fn(),
  verifyOTPMock: vi.fn(),
  logoutMock: vi.fn(),
  notifySuccessMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  setAuthTokenMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ search: '' }),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithGoogle: loginWithGoogleMock,
    loginWithPhone: loginWithPhoneMock,
    verifyOTP: verifyOTPMock,
    logout: logoutMock,
    user: null,
    authLoading: false,
  }),
}));

vi.mock('services/notify.service', () => ({
  notify: {
    success: notifySuccessMock,
    error: notifyErrorMock,
  },
}));

vi.mock('../../utils/authStorage', () => ({
  authStorage: {
    setAuthToken: setAuthTokenMock,
  },
}));

vi.mock('../../services/errorLog.service', () => ({
  captureHandledError: vi.fn(),
}));

vi.mock('../../constants/messages', () => ({
  authMessages: {
    phoneLinkRetryAfterGoogle: 'phone-link-retry-after-google',
    mobileNotRegistered: 'mobile-not-registered',
    mobileLinkedMultiple: 'mobile-linked-multiple',
    superadminGoogleOnly: 'superadmin-google-only',
    roleMismatch: {
      donor: 'role-mismatch-donor',
    },
  },
}));

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops after Google sign-in when a guided phone-link continuation is required', async () => {
    loginWithGoogleMock.mockResolvedValue({
      token: 'token-123',
      user: {
        role: 'donor',
        onboardingCompleted: true,
      },
      phoneLinkRequiresFreshOtp: true,
    });

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.handleGoogleLogin();
    });

    expect(setAuthTokenMock).toHaveBeenCalledWith('token-123');
    expect(notifySuccessMock).toHaveBeenCalledWith('phone-link-retry-after-google');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
