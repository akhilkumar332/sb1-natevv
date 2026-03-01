import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Home } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import DashboardMobileDrawer from '../DashboardMobileDrawer';
import { ROUTES } from '../../../constants/routes';

describe('DashboardMobileDrawer', () => {
  it('renders menu title and items when opened', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.portal.donor.dashboard.overview]}>
        <DashboardMobileDrawer
          isOpen
          onClose={() => undefined}
          title="Donor Menu"
          items={[{ id: 'overview', label: 'Overview', to: ROUTES.portal.donor.dashboard.overview, icon: Home }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Donor Menu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
  });

  it('calls onClose from close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardMobileDrawer
          isOpen
          onClose={onClose}
          title="Admin Menu"
          items={[{ id: 'overview', label: 'Overview', to: ROUTES.portal.admin.dashboard.overview, icon: Home }]}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText('Close menu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
