import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminPortal from '../AdminPortal';

const useAuthMock = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('AdminPortal', () => {
  it('shows impersonation audit menu for superadmin', () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0001' },
      isSuperAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard/overview']}>
        <Routes>
          <Route path="/admin/dashboard" element={<AdminPortal />}>
            <Route path="overview" element={<div>Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('Impersonation Audit').length).toBeGreaterThan(0);
  });

  it('hides impersonation audit menu for non-superadmin', () => {
    useAuthMock.mockReturnValue({
      user: { bhId: 'BH-0002' },
      isSuperAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard/overview']}>
        <Routes>
          <Route path="/admin/dashboard" element={<AdminPortal />}>
            <Route path="overview" element={<div>Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Impersonation Audit')).not.toBeInTheDocument();
  });
});
