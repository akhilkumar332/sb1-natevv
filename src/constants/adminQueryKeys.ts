export type AdminUserRoleFilter = 'all' | 'donor' | 'ngo' | 'bloodbank';
export type AdminKpiRange = '7d' | '30d' | '90d' | '12m';

export const adminQueryKeys = {
  root: ['admin'] as const,
  overviewRoot: ['admin', 'overview'] as const,
  overviewUsers: (limit: number = 100) => ['admin', 'overview', 'users', { limit }] as const,
  usersRoot: ['admin', 'users'] as const,
  users: (role: AdminUserRoleFilter = 'all', limit: number = 800) =>
    ['admin', 'users', { role, limit }] as const,
  userDetailRoot: ['admin', 'userDetail'] as const,
  userDetail: (uid: string) => ['admin', 'userDetail', uid] as const,
  userSecurity: (uid: string) => ['admin', 'userSecurity', uid] as const,
  userKpis: (uid: string, range: AdminKpiRange = '90d') => ['admin', 'userKpis', uid, { range }] as const,
  userReferrals: (uid: string, filters?: { role?: string; status?: string; search?: string }) =>
    ['admin', 'userReferrals', uid, filters || {}] as const,
  userTimeline: (uid: string, filters?: { kind?: string; search?: string }) =>
    ['admin', 'userTimeline', uid, filters || {}] as const,
  verificationRoot: ['admin', 'verificationRequests'] as const,
  verificationRequests: (limit: number = 500) => ['admin', 'verificationRequests', { limit }] as const,
  emergencyRoot: ['admin', 'emergencyRequests'] as const,
  emergencyRequests: () => ['admin', 'emergencyRequests'] as const,
  inventoryRoot: ['admin', 'inventoryAlerts'] as const,
  inventoryAlerts: () => ['admin', 'inventoryAlerts'] as const,
  recentActivityRoot: ['admin', 'recentActivity'] as const,
  recentActivity: (limit: number = 5) => ['admin', 'recentActivity', { limit }] as const,
  platformStatsRoot: ['admin', 'platformStats'] as const,
  platformStats: () => ['admin', 'platformStats'] as const,
  campaignsRoot: ['admin', 'campaigns'] as const,
  campaigns: (limit: number = 1000) => ['admin', 'campaigns', { limit }] as const,
  volunteersRoot: ['admin', 'volunteers'] as const,
  volunteers: (limit: number = 1000) => ['admin', 'volunteers', { limit }] as const,
  partnershipsRoot: ['admin', 'partnerships'] as const,
  partnerships: (limit: number = 1000) => ['admin', 'partnerships', { limit }] as const,
  appointmentsRoot: ['admin', 'appointments'] as const,
  appointments: (limit: number = 1000) => ['admin', 'appointments', { limit }] as const,
  donationsRoot: ['admin', 'donations'] as const,
  donations: (limit: number = 1000) => ['admin', 'donations', { limit }] as const,
  notificationsRoot: ['admin', 'notifications'] as const,
  notifications: (limit: number = 1000) => ['admin', 'notifications', { limit }] as const,
  auditRoot: ['admin', 'auditLogs'] as const,
  auditLogs: (limit: number = 1000) => ['admin', 'auditLogs', { limit }] as const,
  errorRoot: ['admin', 'errorLogs'] as const,
  errorLogs: (
    limit: number = 1000,
    filters?: { source?: string; scope?: string; level?: string; impersonating?: string }
  ) => ['admin', 'errorLogs', { limit, ...(filters || {}) }] as const,
};
