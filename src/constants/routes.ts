export type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';
export const ROUTES = {
  home: '/',
  donors: '/donors',
  requestBlood: '/request-blood',
  about: '/about',
  contact: '/contact',
  portal: {
    donor: {
      login: '/donor/login',
      register: '/donor/register',
      onboarding: '/donor/onboarding',
      dashboard: {
        root: '/donor/dashboard',
        overview: '/donor/dashboard/overview',
        readiness: '/donor/dashboard/readiness',
        requests: '/donor/dashboard/requests',
        bloodDrives: '/donor/dashboard/blood-drives',
        journey: '/donor/dashboard/journey',
        referrals: '/donor/dashboard/referrals',
        account: '/donor/dashboard/account',
      },
    },
    ngo: {
      login: '/ngo/login',
      register: '/ngo/register',
      onboarding: '/ngo/onboarding',
      dashboard: {
        root: '/ngo/dashboard',
        overview: '/ngo/dashboard/overview',
        campaigns: '/ngo/dashboard/campaigns',
        volunteers: '/ngo/dashboard/volunteers',
        partnerships: '/ngo/dashboard/partnerships',
        donors: '/ngo/dashboard/donors',
        analytics: '/ngo/dashboard/analytics',
        referrals: '/ngo/dashboard/referrals',
        account: '/ngo/dashboard/account',
      },
    },
    bloodbank: {
      login: '/bloodbank/login',
      register: '/bloodbank/register',
      onboarding: '/bloodbank/onboarding',
      dashboard: {
        root: '/bloodbank/dashboard',
        overview: '/bloodbank/dashboard/overview',
        requests: '/bloodbank/dashboard/requests',
        donors: '/bloodbank/dashboard/donors',
        appointments: '/bloodbank/dashboard/appointments',
        inventory: '/bloodbank/dashboard/inventory',
        analytics: '/bloodbank/dashboard/analytics',
        referrals: '/bloodbank/dashboard/referrals',
        account: '/bloodbank/dashboard/account',
      },
    },
    hospital: {
      login: '/hospital/login',
      register: '/hospital/register',
      onboarding: '/hospital/onboarding',
      dashboard: '/hospital/dashboard',
    },
    admin: {
      login: '/admin/login',
      onboarding: '/admin/onboarding',
      dashboard: {
        root: '/admin/dashboard',
        overview: '/admin/dashboard/overview',
        users: '/admin/dashboard/users',
        donors: '/admin/dashboard/donors',
        ngos: '/admin/dashboard/ngos',
        bloodbanks: '/admin/dashboard/bloodbanks',
        verification: '/admin/dashboard/verification',
        emergencyRequests: '/admin/dashboard/emergency-requests',
        inventoryAlerts: '/admin/dashboard/inventory-alerts',
        campaigns: '/admin/dashboard/campaigns',
        volunteersPartnerships: '/admin/dashboard/volunteers-partnerships',
        appointmentsDonations: '/admin/dashboard/appointments-donations',
        analyticsReports: '/admin/dashboard/analytics-reports',
        auditSecurity: '/admin/dashboard/audit-security',
        errorLogs: '/admin/dashboard/error-logs',
        contactSubmissions: '/admin/dashboard/contact-submissions',
        impersonationAudit: '/admin/dashboard/impersonation-audit',
        notifications: '/admin/dashboard/notifications',
        settings: '/admin/dashboard/settings',
      },
    },
  },
} as const;

export const PORTAL_PATH_PREFIXES: Record<PortalRole, string> = {
  donor: '/donor',
  ngo: '/ngo',
  bloodbank: '/bloodbank',
  admin: '/admin',
};

export const APP_ROUTE_PREFIXES = [
  PORTAL_PATH_PREFIXES.donor,
  PORTAL_PATH_PREFIXES.ngo,
  PORTAL_PATH_PREFIXES.bloodbank,
  PORTAL_PATH_PREFIXES.admin,
] as const;

export const LEGACY_ROUTE_PREFIXES = {
  hospital: '/hospital',
} as const;

export const APP_ROUTE_PREFIXES_WITH_LEGACY = [
  ...APP_ROUTE_PREFIXES,
  LEGACY_ROUTE_PREFIXES.hospital,
] as const;

export const PORTAL_LABELS: Record<PortalRole, string> = {
  donor: 'Donor',
  ngo: 'NGO',
  bloodbank: 'Blood Bank',
  admin: 'Admin',
};

export const PORTAL_OPTIONS: Array<{ role: PortalRole; label: string }> = [
  { role: 'donor', label: PORTAL_LABELS.donor },
  { role: 'ngo', label: PORTAL_LABELS.ngo },
  { role: 'bloodbank', label: PORTAL_LABELS.bloodbank },
  { role: 'admin', label: PORTAL_LABELS.admin },
];

export const SIGNIN_OPTIONS = [
  { label: 'Donor', path: ROUTES.portal.donor.login },
  { label: 'NGO', path: ROUTES.portal.ngo.login },
  { label: 'BloodBank', path: ROUTES.portal.bloodbank.login },
] as const;

export const DASHBOARD_PREFIX: Record<PortalRole, string> = {
  donor: ROUTES.portal.donor.dashboard.root,
  ngo: ROUTES.portal.ngo.dashboard.root,
  bloodbank: ROUTES.portal.bloodbank.dashboard.root,
  admin: ROUTES.portal.admin.dashboard.root,
};

export const DASHBOARD_LINKS = {
  donor: [
    { label: 'Overview', path: ROUTES.portal.donor.dashboard.overview },
    { label: 'Readiness', path: ROUTES.portal.donor.dashboard.readiness },
    { label: 'Requests', path: ROUTES.portal.donor.dashboard.requests },
    { label: 'Blood Drives', path: ROUTES.portal.donor.dashboard.bloodDrives },
    { label: 'Journey', path: ROUTES.portal.donor.dashboard.journey },
    { label: 'Referrals', path: ROUTES.portal.donor.dashboard.referrals },
    { label: 'Account', path: ROUTES.portal.donor.dashboard.account },
  ],
  ngo: [
    { label: 'Overview', path: ROUTES.portal.ngo.dashboard.overview },
    { label: 'Campaigns', path: ROUTES.portal.ngo.dashboard.campaigns },
    { label: 'Volunteers', path: ROUTES.portal.ngo.dashboard.volunteers },
    { label: 'Partnerships', path: ROUTES.portal.ngo.dashboard.partnerships },
    { label: 'Donors', path: ROUTES.portal.ngo.dashboard.donors },
    { label: 'Analytics', path: ROUTES.portal.ngo.dashboard.analytics },
    { label: 'Referrals', path: ROUTES.portal.ngo.dashboard.referrals },
    { label: 'Account', path: ROUTES.portal.ngo.dashboard.account },
  ],
  bloodbank: [
    { label: 'Overview', path: ROUTES.portal.bloodbank.dashboard.overview },
    { label: 'Requests', path: ROUTES.portal.bloodbank.dashboard.requests },
    { label: 'Donors', path: ROUTES.portal.bloodbank.dashboard.donors },
    { label: 'Appointments', path: ROUTES.portal.bloodbank.dashboard.appointments },
    { label: 'Inventory', path: ROUTES.portal.bloodbank.dashboard.inventory },
    { label: 'Analytics', path: ROUTES.portal.bloodbank.dashboard.analytics },
    { label: 'Referrals', path: ROUTES.portal.bloodbank.dashboard.referrals },
    { label: 'Account', path: ROUTES.portal.bloodbank.dashboard.account },
  ],
  adminBase: [
    { label: 'Overview', path: ROUTES.portal.admin.dashboard.overview },
    { label: 'Users', path: ROUTES.portal.admin.dashboard.users },
    { label: 'Donors', path: ROUTES.portal.admin.dashboard.donors },
    { label: 'NGOs', path: ROUTES.portal.admin.dashboard.ngos },
    { label: 'BloodBanks', path: ROUTES.portal.admin.dashboard.bloodbanks },
    { label: 'Verification', path: ROUTES.portal.admin.dashboard.verification },
    { label: 'Emergency', path: ROUTES.portal.admin.dashboard.emergencyRequests },
    { label: 'Inventory Alerts', path: ROUTES.portal.admin.dashboard.inventoryAlerts },
    { label: 'Campaigns', path: ROUTES.portal.admin.dashboard.campaigns },
    { label: 'Volunteers & Partners', path: ROUTES.portal.admin.dashboard.volunteersPartnerships },
    { label: 'Appointments', path: ROUTES.portal.admin.dashboard.appointmentsDonations },
    { label: 'Analytics', path: ROUTES.portal.admin.dashboard.analyticsReports },
    { label: 'Audit & Security', path: ROUTES.portal.admin.dashboard.auditSecurity },
    { label: 'Error Logs', path: ROUTES.portal.admin.dashboard.errorLogs },
    { label: 'Contact Submissions', path: ROUTES.portal.admin.dashboard.contactSubmissions },
    { label: 'Notifications', path: ROUTES.portal.admin.dashboard.notifications },
    { label: 'Settings', path: ROUTES.portal.admin.dashboard.settings },
  ],
} as const;

export const getAdminDashboardLinks = (isSuperAdmin: boolean) => {
  const links = [...DASHBOARD_LINKS.adminBase] as Array<{ label: string; path: string }>;
  if (isSuperAdmin) {
    links.splice(14, 0, {
      label: 'Impersonation Audit',
      path: ROUTES.portal.admin.dashboard.impersonationAudit,
    });
  }
  return links;
};

const normalizePortalRole = (role?: string | null): PortalRole | null => {
  if (!role) return null;
  if (role === 'hospital') return 'bloodbank';
  if (role === 'superadmin') return 'admin';
  if (role === 'donor' || role === 'ngo' || role === 'bloodbank' || role === 'admin') {
    return role;
  }
  return null;
};

export const toPortalRole = (role?: string | null): PortalRole | null => normalizePortalRole(role);

export const getPortalDashboardPath = (role: PortalRole): string => DASHBOARD_PREFIX[role];

export const getPortalLoginPath = (role: PortalRole): string => ROUTES.portal[role].login;

export const getPortalOnboardingPath = (role: PortalRole): string => ROUTES.portal[role].onboarding;

export const getDashboardRouteByUserRole = (role?: string | null): string => {
  const normalized = normalizePortalRole(role);
  if (!normalized) return ROUTES.home;
  return getPortalDashboardPath(normalized);
};

export const getOnboardingRouteByUserRole = (role?: string | null): string => {
  const normalized = normalizePortalRole(role);
  if (!normalized) return ROUTES.home;
  return getPortalOnboardingPath(normalized);
};
