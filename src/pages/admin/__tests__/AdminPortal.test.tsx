import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPortal from '../AdminPortal';
import { ROUTES } from '../../../constants/routes';

const { useAuthMock, tMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  tMock: vi.fn((key: string) => key),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../components/shared/PendingActionsPanel', () => ({
  default: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

describe('AdminPortal', () => {
  const createClient = () => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  it('shows impersonation audit menu for superadmin', async () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0001' },
      isSuperAdmin: true,
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.admin.dashboard.overview]}>
          <Routes>
            <Route path={ROUTES.portal.admin.dashboard.root} element={<AdminPortal />}>
              <Route path="overview" element={<div>Overview</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect((await screen.findAllByText('admin.impersonationAudit')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('admin.errorLogs')).length).toBeGreaterThan(0);
  });

  it('hides impersonation audit menu for non-superadmin', async () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0002' },
      isSuperAdmin: false,
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.admin.dashboard.overview]}>
          <Routes>
            <Route path={ROUTES.portal.admin.dashboard.root} element={<AdminPortal />}>
              <Route path="overview" element={<div>Overview</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByText('admin.impersonationAudit')).not.toBeInTheDocument();
    expect((await screen.findAllByText('admin.errorLogs')).length).toBeGreaterThan(0);
  });
});
