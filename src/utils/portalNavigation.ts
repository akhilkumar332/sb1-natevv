export type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';

const normalizePortalRole = (role?: string | null): PortalRole | null => {
  if (!role) return null;
  if (role === 'hospital') return 'bloodbank';
  if (role === 'donor' || role === 'ngo' || role === 'bloodbank' || role === 'admin') {
    return role;
  }
  return null;
};

export const resolvePortalRole = (
  role: string | null | undefined,
  fallback: PortalRole
): PortalRole => normalizePortalRole(role) || fallback;

export const roleDashboardPath = (role: PortalRole) =>
  role === 'admin' ? '/admin/dashboard' : `/${role}/dashboard`;

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
