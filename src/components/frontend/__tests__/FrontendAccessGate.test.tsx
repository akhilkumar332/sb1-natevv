import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FrontendAccessGate from '../FrontendAccessGate';
import { ROUTES } from '../../../constants/routes';

const getPublicCmsSettingsMock = vi.fn();
const getFrontendAccessStatusMock = vi.fn();
const unlockFrontendAccessMock = vi.fn();

vi.mock('../../../services/cms.service', () => ({
  getPublicCmsSettings: () => getPublicCmsSettingsMock(),
}));

vi.mock('../../../services/frontendAccess.service', () => ({
  getFrontendAccessStatus: () => getFrontendAccessStatusMock(),
  unlockFrontendAccess: (...args: unknown[]) => unlockFrontendAccessMock(...args),
}));

vi.mock('../../../services/errorLog.service', () => ({
  captureHandledError: vi.fn(),
}));

vi.mock('../../LanguageSwitcher', () => ({
  default: () => <div>Language switcher</div>,
}));

vi.mock('../../ThemeToggle', () => ({
  default: () => <button type="button">Theme toggle</button>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'frontendAccess.maintenance.seoTitle': 'Scheduled Maintenance | BloodHub India',
        'frontendAccess.maintenance.eyebrow': 'Scheduled Maintenance',
        'frontendAccess.maintenance.defaultTitle': 'BloodHub is under scheduled maintenance',
        'frontendAccess.maintenance.defaultMessage': 'We are preparing a safer, faster donor experience. Please check back shortly.',
        'frontendAccess.maintenance.supportingText': 'We will reopen the frontend as soon as the scheduled work is complete.',
        'frontendAccess.maintenance.supportingEndsAt': 'Expected to reopen by {{dateTime}}',
        'frontendAccess.maintenance.visitorInfoTitle': 'What visitors should know',
        'frontendAccess.maintenance.visitorInfoBody': 'The site is temporarily paused for scheduled improvements. We are working to restore access as quickly as possible.',
        'frontendAccess.maintenance.donorFirstTitle': 'Donor-first rollout',
        'frontendAccess.maintenance.donorFirstBody': 'We use this window to ship safer workflows, improve reliability, and protect donation journeys before reopening access.',
        'frontendAccess.maintenance.countdownTitle': 'Live countdown',
        'frontendAccess.maintenance.countdownActive': 'The countdown will keep updating until the scheduled end time.',
        'frontendAccess.maintenance.countdownExpired': 'The scheduled end time has passed. Maintenance mode will stay active until an admin reopens the site.',
        'frontendAccess.maintenance.countdownDays': 'Days',
        'frontendAccess.maintenance.countdownHours': 'Hours',
        'frontendAccess.maintenance.countdownMinutes': 'Minutes',
        'frontendAccess.maintenance.countdownSeconds': 'Seconds',
        'frontendAccess.password.seoTitle': 'Security Gate | BloodHub India',
        'frontendAccess.password.eyebrow': 'Security Gate',
        'frontendAccess.password.defaultTitle': 'Secure access required',
        'frontendAccess.password.defaultMessage': 'Enter the password to continue to BloodHub India.',
        'frontendAccess.password.statusChecking': 'Checking access availability...',
        'frontendAccess.password.statusPreparing': 'Protected access is being prepared. Please try again shortly.',
        'frontendAccess.password.inputLabel': 'Access password',
        'frontendAccess.password.inputPlaceholder': 'Enter password',
        'frontendAccess.password.submitIdle': 'Open BloodHub frontend',
        'frontendAccess.password.submitVerifying': 'Verifying access...',
        'frontendAccess.password.errorIncorrect': 'Incorrect password. Please try again.',
        'frontendAccess.password.statusError': 'We could not verify access right now. Please wait a moment and try again.',
        'frontendAccess.password.notConfigured': 'This protected page is not fully available right now. Please try again shortly.',
        'frontendAccess.password.helperText': 'Enter the access password to continue.',
        'brand.india': 'INDIA',
      };

      if (key === 'frontendAccess.password.statusReady') {
        return `Access sessions last up to ${options?.ttlMinutes as number} minutes.`;
      }
      if (key === 'frontendAccess.maintenance.expectedUpdate') {
        return `Expected update: ${options?.eta as string}`;
      }
      if (key === 'frontendAccess.maintenance.supportingEndsAt') {
        return `Expected to reopen by ${options?.dateTime as string}`;
      }
      if (key === 'frontendAccess.maintenance.countdownEndsAt') {
        return `Countdown to ${options?.dateTime as string}`;
      }
      return translations[key] || key;
    },
  }),
}));

vi.mock('../../Loading', () => ({
  default: () => <div>Loading...</div>,
}));

const createClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

describe('FrontendAccessGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    getPublicCmsSettingsMock.mockResolvedValue({
      frontendAccess: {
        mode: 'open',
      },
    });
  });

  it('renders children for open mode', async () => {
    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FrontendAccessGate>
            <div>Public content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Public content')).toBeInTheDocument();
  });

  it('shows maintenance screen for public routes', async () => {
    getPublicCmsSettingsMock.mockResolvedValue({
      frontendAccess: {
        mode: 'maintenance',
        maintenanceTitle: 'Maintenance window',
        maintenanceMessage: 'We will be back soon.',
        maintenanceEta: 'Tonight at 8 PM',
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.donor.login]}>
          <FrontendAccessGate>
            <div>Public content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Maintenance window' })).toBeInTheDocument();
    expect(screen.queryByText('Public content')).not.toBeInTheDocument();
  });

  it('shows a live countdown when maintenance end time is configured', async () => {
    getPublicCmsSettingsMock.mockResolvedValue({
      frontendAccess: {
        mode: 'maintenance',
        maintenanceTitle: 'Maintenance window',
        maintenanceMessage: 'We will be back soon.',
        maintenanceEndsAt: new Date(Date.now() + (60 * 60 * 1000)).toISOString(),
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FrontendAccessGate>
            <div>Public content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Live countdown')).toBeInTheDocument();
    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
  });

  it('renders the cached maintenance gate immediately before the refresh completes', () => {
    window.sessionStorage.setItem('bh_frontend_access_snapshot', JSON.stringify({
      savedAt: Date.now(),
      value: {
        mode: 'maintenance',
        maintenanceTitle: 'Cached maintenance window',
        maintenanceMessage: 'Cached message',
        maintenanceEta: 'Soon',
      },
    }));
    getPublicCmsSettingsMock.mockImplementation(() => new Promise(() => {}));

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FrontendAccessGate>
            <div>Public content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: 'Cached maintenance window' })).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('ignores expired cached access snapshots', async () => {
    window.sessionStorage.setItem('bh_frontend_access_snapshot', JSON.stringify({
      savedAt: Date.now() - (6 * 60 * 1000),
      value: {
        mode: 'maintenance',
        maintenanceTitle: 'Expired maintenance window',
        maintenanceMessage: 'Expired message',
      },
    }));

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FrontendAccessGate>
            <div>Public content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Public content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Expired maintenance window' })).not.toBeInTheDocument();
  });

  it('bypasses the gate for admin routes', () => {
    getPublicCmsSettingsMock.mockResolvedValue({
      frontendAccess: {
        mode: 'maintenance',
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={[ROUTES.portal.admin.login]}>
          <FrontendAccessGate>
            <div>Admin content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('unlocks password mode after a successful password submission', async () => {
    getPublicCmsSettingsMock.mockResolvedValue({
      frontendAccess: {
        mode: 'password_protected',
        passwordPromptTitle: 'Members only',
        passwordPromptMessage: 'Enter the password to continue.',
        passwordSessionTtlMinutes: 60,
      },
    });
    getFrontendAccessStatusMock.mockResolvedValue({
      ok: true,
      mode: 'password_protected',
      unlocked: false,
      configured: true,
      ttlMinutes: 60,
    });
    unlockFrontendAccessMock.mockResolvedValue({
      ok: true,
      mode: 'password_protected',
      unlocked: true,
      configured: true,
      ttlMinutes: 60,
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FrontendAccessGate>
            <div>Unlocked content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Access password')).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText('Access password'), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open BloodHub frontend' }));

    await waitFor(() => {
      expect(screen.getByText('Unlocked content')).toBeInTheDocument();
    });
    expect(unlockFrontendAccessMock).toHaveBeenCalledWith('secret-pass');
  });

  it('disables password submission when the status probe fails', async () => {
    getPublicCmsSettingsMock.mockResolvedValue({
      frontendAccess: {
        mode: 'password_protected',
        passwordPromptTitle: 'Members only',
        passwordPromptMessage: 'Enter the password to continue.',
        passwordSessionTtlMinutes: 60,
      },
    });
    getFrontendAccessStatusMock.mockRejectedValue(new Error('network down'));

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FrontendAccessGate>
            <div>Unlocked content</div>
          </FrontendAccessGate>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open BloodHub frontend' })).toBeDisabled();
      expect(screen.getByText('We could not verify access right now. Please wait a moment and try again.')).toBeInTheDocument();
    });
  });
});
