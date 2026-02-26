import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MobileBottomNav from '../MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders donor dashboard bottom nav when enabled', () => {
    render(
      <MemoryRouter initialEntries={['/donor/dashboard/overview']}>
        <MobileBottomNav enabled />
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: 'Mobile dashboard navigation' })).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
  });

  it('does not render outside dashboard routes', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <MobileBottomNav enabled />
      </MemoryRouter>
    );

    expect(screen.queryByRole('navigation', { name: 'Mobile dashboard navigation' })).not.toBeInTheDocument();
  });
});
