import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPortal from '../AdminPortal';
import { ROUTES } from '../../../constants/routes';

const useAuthMock = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('AdminPortal', () => {
  const createClient = () => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  it('shows impersonation audit menu for superadmin', () => {
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

    expect(screen.getAllByText('Impersonation Audit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Error Logs').length).toBeGreaterThan(0);
  });

  it('hides impersonation audit menu for non-superadmin', () => {
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

    expect(screen.queryByText('Impersonation Audit')).not.toBeInTheDocument();
    expect(screen.getAllByText('Error Logs').length).toBeGreaterThan(0);
  });
});
