import React from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthSync } from '../useAuthSync';
import { AuthContext } from '../../contexts/AuthContext';

const {
  navigateMock,
  logoutMock,
  setAuthTokenMock,
  captureHandledErrorMock,
  authContextValue,
  useAuthState,
  authCurrentUser,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutMock: vi.fn(),
  setAuthTokenMock: vi.fn(),
  captureHandledErrorMock: vi.fn(),
  authContextValue: { current: { ready: true } as Record<string, unknown> },
  useAuthState: {
    current: {
      user: { uid: 'donor-1', role: 'donor' },
      logout: vi.fn(),
      impersonationSession: null,
      authLoading: false,
      profileResolved: true,
    } as Record<string, unknown>,
  },
  authCurrentUser: {
    current: null as null | { getIdToken: ReturnType<typeof vi.fn> },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../contexts/AuthContext', () => {
  const AuthContext = React.createContext<Record<string, unknown> | null>(null);
  return {
    AuthContext,
    useAuth: () => useAuthState.current,
  };
});

vi.mock('../../firebase', () => ({
  auth: {
    get currentUser() {
      return authCurrentUser.current;
    },
  },
}));

vi.mock('../../utils/authStorage', () => ({
  authStorage: {
    setAuthToken: setAuthTokenMock,
  },
}));

vi.mock('../../services/errorLog.service', () => ({
  captureHandledError: captureHandledErrorMock,
}));

describe('useAuthSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    useAuthState.current = {
      user: { uid: 'donor-1', role: 'donor' },
      logout: logoutMock,
      impersonationSession: null,
      authLoading: false,
      profileResolved: true,
    };
    authContextValue.current = { ready: true };
    authCurrentUser.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not force logout immediately when local token is temporarily missing', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={authContextValue.current as any}>{children}</AuthContext.Provider>
    );

    renderHook(() => useAuthSync(), { wrapper });

    expect(logoutMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('recovers the auth token from Firebase without logging out when currentUser is available', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={authContextValue.current as any}>{children}</AuthContext.Provider>
    );
    authCurrentUser.current = {
      getIdToken: vi.fn().mockResolvedValue('fresh-token'),
    };

    renderHook(() => useAuthSync(), { wrapper });

    vi.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();

    expect(setAuthTokenMock).toHaveBeenCalledWith('fresh-token');
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('does not force logout when token recovery fails temporarily', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={authContextValue.current as any}>{children}</AuthContext.Provider>
    );
    authCurrentUser.current = {
      getIdToken: vi.fn().mockRejectedValue(new Error('temporary token failure')),
    };

    renderHook(() => useAuthSync(), { wrapper });

    vi.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();

    expect(logoutMock).not.toHaveBeenCalled();
  });
});
