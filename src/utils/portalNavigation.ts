import {
  type PortalRole,
  getPortalDashboardPath,
  toPortalRole,
} from '../constants/routes';

const normalizePortalRole = (role?: string | null): PortalRole | null => {
  return toPortalRole(role);
};

export const resolvePortalRole = (
  role: string | null | undefined,
  fallback: PortalRole
): PortalRole => normalizePortalRole(role) || fallback;

export const roleDashboardPath = (role: PortalRole) =>
  getPortalDashboardPath(role);

export const navigateToPortalDashboard = (
  navigate: (to: string) => void,
  role: PortalRole
) => {
  navigate(roleDashboardPath(role));
};

export const resolveImpersonationRole = (
  role: string | null | undefined
): PortalRole =>
  resolvePortalRole(role, 'donor');
