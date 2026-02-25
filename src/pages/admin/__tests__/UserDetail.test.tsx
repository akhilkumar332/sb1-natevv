import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UserDetailPage from '../dashboard/UserDetail';

const useAuthMock = vi.fn();
const userDetailMock = vi.fn();
const securityMock = vi.fn();
const kpisMock = vi.fn();
const referralsMock = vi.fn();
const timelineMock = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../hooks/admin/useAdminQueries', () => ({
  useAdminUserDetail: (uid: string) => userDetailMock(uid),
  useAdminUserSecurity: (uid: string) => securityMock(uid),
  useAdminUserKpis: (uid: string, roleHint: string, range: string) => kpisMock(uid, roleHint, range),
  useAdminUserReferrals: (uid: string, filters: any) => referralsMock(uid, filters),
  useAdminUserTimeline: (uid: string, filters: any) => timelineMock(uid, filters),
}));

vi.mock('../../../services/admin.service', () => ({
  verifyUserAccount: vi.fn(),
  updateUserStatus: vi.fn(),
  deleteUserAccount: vi.fn(),
}));

vi.mock('../../../services/adminUserDetail.service', () => ({
  revokeUserFcmToken: vi.fn(),
  revokeAllUserFcmTokens: vi.fn(),
}));

vi.mock('../../../services/monitoring.service', () => ({
  monitoringService: {
    trackPerformance: vi.fn(),
  },
}));

afterEach(() => {
  useAuthMock.mockReset();
  userDetailMock.mockReset();
  securityMock.mockReset();
  kpisMock.mockReset();
  referralsMock.mockReset();
  timelineMock.mockReset();
});

describe('Admin UserDetail page', () => {
  const createClient = () => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const baseUser = {
    uid: 'u1',
    role: 'donor',
    status: 'active',
    verified: true,
    displayName: 'Demo User',
    email: 'demo@example.com',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    phoneNumber: null,
    city: 'Delhi',
    state: 'Delhi',
    country: 'India',
  };

  const setupMocks = () => {
    useAuthMock.mockReturnValue({ user: { uid: 'admin-1' }, isSuperAdmin: false });
    userDetailMock.mockReturnValue({ data: baseUser, isLoading: false, isFetching: false, error: null, refetch: vi.fn() });
    securityMock.mockReturnValue({
      data: {
        activeFcmTokens: [],
        activeTokenMeta: [],
        loginIps: [],
      },
      isFetching: false,
      refetch: vi.fn(),
    });
    kpisMock.mockReturnValue({ data: { cards: [], trend: [] }, isLoading: false, refetch: vi.fn() });
    referralsMock.mockReturnValue({ data: [], isLoading: false, isFetching: false, refetch: vi.fn() });
    timelineMock.mockReturnValue({ data: [], isLoading: false, isFetching: false, refetch: vi.fn() });
  };

  it('renders security tab from URL param', async () => {
    setupMocks();
    securityMock.mockReturnValue({
      data: {
        activeFcmTokens: ['tok-1'],
        activeTokenMeta: [{ token: 'tok-1', updatedAt: new Date('2026-02-01T10:00:00Z') }],
        loginIps: [],
      },
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/admin/dashboard/users/u1?tab=security']}>
          <Routes>
            <Route path="/admin/dashboard/users/:uid" element={<UserDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Logged IP Addresses' })).toBeInTheDocument();
    expect(await screen.findByText(/Last Updated:/)).toBeInTheDocument();
  });

  it('shows quick profile actions on profile tab', async () => {
    setupMocks();

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/admin/dashboard/users/u1?tab=profile']}>
          <Routes>
            <Route path="/admin/dashboard/users/:uid" element={<UserDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByText('Set Active')).not.toBeInTheDocument();
    expect(await screen.findByText('Suspend')).toBeInTheDocument();
    expect(await screen.findByText('Deactivate')).toBeInTheDocument();
  });

  it('shows Set Active when status is not active', async () => {
    setupMocks();
    userDetailMock.mockReturnValue({
      data: { ...baseUser, status: 'Suspended' },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/admin/dashboard/users/u1?tab=profile']}>
          <Routes>
            <Route path="/admin/dashboard/users/:uid" element={<UserDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Set Active')).toBeInTheDocument();
  });
});
