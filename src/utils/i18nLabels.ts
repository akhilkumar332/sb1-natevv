import type { TFunction } from 'i18next';

export const getPortalLabel = (role: 'donor' | 'ngo' | 'bloodbank' | 'admin', t: TFunction) =>
  t(`portal.${role}`);

export const getAdminGroupLabel = (groupId: string, t: TFunction) => {
  const keyById: Record<string, string> = {
    users: 'admin.users',
    operations: 'admin.operations',
    insights: 'admin.insights',
    content: 'admin.content',
    security: 'admin.security',
    system: 'admin.system',
  };
  return t(keyById[groupId] || 'common.overview');
};

export const getAdminItemLabel = (itemId: string, t: TFunction) => {
  const keyById: Record<string, string> = {
    users: 'admin.usersItem',
    donors: 'admin.donors',
    ngos: 'admin.ngos',
    bloodbanks: 'admin.bloodbanks',
    verification: 'admin.verification',
    emergency: 'admin.emergencyRequests',
    inventory: 'admin.inventoryAlerts',
    campaigns: 'admin.campaigns',
    ops: 'admin.volunteersPartners',
    appointments: 'admin.appointmentsDonations',
    analytics: 'admin.analyticsReports',
    nps: 'admin.nps',
    'cms-overview': 'admin.cmsOverview',
    'cms-pages': 'admin.cmsPages',
    'cms-blog-posts': 'admin.cmsBlogPosts',
    'cms-categories': 'admin.cmsCategories',
    'cms-menus': 'admin.cmsMenus',
    'cms-media': 'admin.cmsMedia',
    'cms-settings': 'admin.cmsSettings',
    translations: 'admin.translations',
    audit: 'admin.auditSecurity',
    errors: 'admin.errorLogs',
    impersonation: 'admin.impersonationAudit',
    'contact-submissions': 'admin.contactSubmissions',
    'offline-sync-health': 'admin.offlineSyncHealth',
    'pwa-telemetry': 'admin.pwaTelemetry',
    'pwa-diagnostics': 'admin.pwaDiagnostics',
    'pwa-fleet-overview': 'admin.pwaFleetOverview',
    'version-management': 'admin.versionManagement',
    notifications: 'admin.notifications',
    settings: 'admin.settings',
  };
  return t(keyById[itemId] || 'common.overview');
};

export const getDashboardLinkLabel = (
  role: 'donor' | 'ngo' | 'bloodbank',
  path: string,
  t: TFunction,
) => {
  const suffix = path.split('/').pop() || '';
  const normalized = suffix.toLowerCase();
  const keyByRoleAndPath: Record<string, string> = {
    'donor:overview': 'common.overview',
    'donor:readiness': 'dashboard.readiness',
    'donor:requests': 'dashboard.requests',
    'donor:blood-drives': 'dashboard.bloodDrives',
    'donor:journey': 'dashboard.journey',
    'donor:referrals': 'dashboard.referrals',
    'donor:account': 'dashboard.account',
    'ngo:overview': 'common.overview',
    'ngo:campaigns': 'dashboard.campaigns',
    'ngo:volunteers': 'dashboard.volunteers',
    'ngo:partnerships': 'dashboard.partnerships',
    'ngo:donors': 'dashboard.donors',
    'ngo:analytics': 'dashboard.analytics',
    'ngo:referrals': 'dashboard.referrals',
    'ngo:account': 'dashboard.account',
    'bloodbank:overview': 'common.overview',
    'bloodbank:requests': 'dashboard.requests',
    'bloodbank:donors': 'dashboard.donors',
    'bloodbank:appointments': 'dashboard.appointments',
    'bloodbank:inventory': 'dashboard.inventory',
    'bloodbank:analytics': 'dashboard.analytics',
    'bloodbank:referrals': 'dashboard.referrals',
    'bloodbank:account': 'dashboard.account',
  };
  return t(keyByRoleAndPath[`${role}:${normalized}`] || 'common.overview');
};
