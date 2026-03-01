import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPortal from '../pages/admin/AdminPortal';
import ImpersonationAudit from '../pages/admin/ImpersonationAudit';
import ErrorLogsPage from '../pages/admin/dashboard/ErrorLogs';
import { ROUTES } from '../constants/routes';

const useAuthMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  startAfter: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

afterEach(() => {
  useAuthMock.mockReset();
});

describe('admin route access', () => {
  const createClient = () => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  it('allows superadmin to see impersonation audit page content', async () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0001' },
      isSuperAdmin: true,
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.admin.dashboard.impersonationAudit]}>
          <Routes>
            <Route path={ROUTES.portal.admin.dashboard.root} element={<AdminPortal />}>
              <Route path="impersonation-audit" element={<ImpersonationAudit />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Impersonation Audit' })).toBeInTheDocument();
  });

  it('shows restricted access for non-superadmin on impersonation audit page', async () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0002' },
      isSuperAdmin: false,
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.admin.dashboard.impersonationAudit]}>
          <Routes>
            <Route path={ROUTES.portal.admin.dashboard.root} element={<AdminPortal />}>
              <Route path="impersonation-audit" element={<ImpersonationAudit />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Restricted Access')).toBeInTheDocument();
  });

  it('allows admin to view error logs page', async () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0003' },
      isSuperAdmin: false,
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.admin.dashboard.errorLogs]}>
          <Routes>
            <Route path={ROUTES.portal.admin.dashboard.root} element={<AdminPortal />}>
              <Route path="error-logs" element={<ErrorLogsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Error Logs' })).toBeInTheDocument();
  });
});
