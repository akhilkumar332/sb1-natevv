import type { AdminSystemAlert, AdminOverviewStats } from '../hooks/admin/useAdminQueries';

export type AdminOverviewActionCard = {
  id: string;
  title: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  description: string;
};

export type AdminOverviewPriorityAction = {
  id: string;
  label: string;
  description: string;
  to: string;
  status: 'healthy' | 'warning' | 'critical';
};

export type AdminOverviewActivityItem = {
  id: string;
  type: 'donation' | 'request' | 'campaign';
  title: string;
  detail: string;
  at: Date | null;
};

export type AdminOverviewIncident = {
  severity: 'healthy' | 'warning' | 'critical';
  title: string;
  summary: string;
};

export type AdminOverviewSynthesis = {
  actionCards: AdminOverviewActionCard[];
  incident: AdminOverviewIncident;
  priorityActions: AdminOverviewPriorityAction[];
  criticalAlerts: AdminSystemAlert[];
  warningAlerts: AdminSystemAlert[];
  activity: AdminOverviewActivityItem[];
  activeRate: number;
  completionRate: number;
};

type OverviewStatus = AdminOverviewPriorityAction['status'];

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

export const buildAdminOverviewSynthesis = (input: {
  stats: AdminOverviewStats;
  systemAlerts: AdminSystemAlert[];
  offlinePendingCount: number;
  offlineFailedCount: number;
  recentActivity: {
    donations: Array<Record<string, any>>;
    requests: Array<Record<string, any>>;
    campaigns: Array<Record<string, any>>;
  };
  routes: {
    verification: string;
    emergencyRequests: string;
    inventoryAlerts: string;
    offlineSyncHealth: string;
    analyticsReports: string;
    users: string;
  };
}): AdminOverviewSynthesis => {
  const {
    stats,
    systemAlerts,
    offlinePendingCount,
    offlineFailedCount,
    recentActivity,
    routes,
  } = input;

  const criticalAlerts = systemAlerts.filter((alert) => alert.type === 'critical');
  const warningAlerts = systemAlerts.filter((alert) => alert.type === 'warning');

  const actionCards: AdminOverviewActionCard[] = [
    {
      id: 'verifications',
      title: 'Verification Queue',
      value: stats.pendingVerificationRequests,
      status: stats.pendingVerificationRequests > 15 ? 'critical' : stats.pendingVerificationRequests > 5 ? 'warning' : 'healthy',
      description: `${stats.approvedVerificationRequests} approved, ${stats.rejectedVerificationRequests} rejected`,
    },
    {
      id: 'emergency',
      title: 'Emergency Requests',
      value: stats.activeRequests,
      status: stats.activeRequests > 10 ? 'critical' : stats.activeRequests > 0 ? 'warning' : 'healthy',
      description: `${stats.fulfilledRequests} fulfilled so far`,
    },
    {
      id: 'inventory',
      title: 'Inventory Alerts',
      value: systemAlerts.length,
      status: criticalAlerts.length > 0 ? 'critical' : warningAlerts.length > 0 ? 'warning' : 'healthy',
      description: criticalAlerts.length > 0 ? `${criticalAlerts.length} critical shortage alerts` : 'No critical shortage alerts',
    },
    {
      id: 'sync',
      title: 'Offline Sync',
      value: offlineFailedCount + offlinePendingCount,
      status: offlineFailedCount > 0 ? 'critical' : offlinePendingCount > 0 ? 'warning' : 'healthy',
      description: offlineFailedCount > 0 ? `${offlineFailedCount} failed items need review` : `${offlinePendingCount} queued action(s)`,
    },
  ];

  const priorityActions: AdminOverviewPriorityAction[] = [
    {
      id: 'verification',
      label: 'Review verification queue',
      description: `${stats.pendingVerificationRequests} request(s) are waiting for review.`,
      to: routes.verification,
      status: actionCards[0].status,
    },
    {
      id: 'emergency',
      label: 'Review emergency requests',
      description: `${stats.activeRequests} active emergency request(s) need tracking.`,
      to: routes.emergencyRequests,
      status: actionCards[1].status,
    },
    {
      id: 'inventory',
      label: 'Inspect inventory shortages',
      description: `${systemAlerts.length} inventory alert(s) are active.`,
      to: routes.inventoryAlerts,
      status: actionCards[2].status,
    },
    {
      id: 'offline',
      label: 'Open offline sync health',
      description: `${offlineFailedCount} failed item(s), ${offlinePendingCount} queued action(s).`,
      to: routes.offlineSyncHealth,
      status: actionCards[3].status,
    },
    {
      id: 'analytics',
      label: 'Open analytics reports',
      description: 'Check platform trends and reporting health.',
      to: routes.analyticsReports,
      status: 'healthy' as const,
    },
    {
      id: 'users',
      label: 'Manage users',
      description: `${stats.totalUsers} total users across all roles.`,
      to: routes.users,
      status: 'healthy' as const,
    },
  ].sort((a, b) => {
    const rank: Record<OverviewStatus, number> = { critical: 3, warning: 2, healthy: 1 };
    return rank[b.status] - rank[a.status];
  });

  const incident = (() => {
    if (offlineFailedCount > 0) {
      return {
        severity: 'critical' as const,
        title: 'Offline sync failures need attention',
        summary: `${offlineFailedCount} failed sync item(s) and ${offlinePendingCount} queued action(s) are visible from this admin session.`,
      };
    }
    if (criticalAlerts.length > 0) {
      return {
        severity: 'critical' as const,
        title: 'Critical shortage alerts are active',
        summary: `${criticalAlerts.length} critical inventory alert(s) need action.`,
      };
    }
    if (stats.pendingVerificationRequests > 5 || stats.activeRequests > 0 || warningAlerts.length > 0 || offlinePendingCount > 0) {
      return {
        severity: 'warning' as const,
        title: 'Operations have active queues to review',
        summary: `${stats.pendingVerificationRequests} verifications, ${stats.activeRequests} emergency request(s), and ${warningAlerts.length} warning alert(s) are active.`,
      };
    }
    return {
      severity: 'healthy' as const,
      title: 'Platform operations look stable',
      summary: 'No critical operational signals are active in the current overview data.',
    };
  })();

  const activity: AdminOverviewActivityItem[] = [
    ...recentActivity.donations.map((entry) => ({
      id: `donation:${entry.id || Math.random().toString(36).slice(2, 8)}`,
      type: 'donation' as const,
      title: entry.donorName ? `${entry.donorName} completed a donation` : 'Donation recorded',
      detail: `${entry.units || 0} unit(s) • ${entry.bloodType || 'Unknown blood type'}`,
      at: entry.donationDate instanceof Date ? entry.donationDate : entry.createdAt instanceof Date ? entry.createdAt : null,
    })),
    ...recentActivity.requests.map((entry) => ({
      id: `request:${entry.id || Math.random().toString(36).slice(2, 8)}`,
      type: 'request' as const,
      title: entry.hospitalName ? `${entry.hospitalName} opened a blood request` : 'Blood request recorded',
      detail: `${entry.units || 0} unit(s) • ${entry.bloodType || 'Unknown blood type'}`,
      at: entry.requestedAt instanceof Date ? entry.requestedAt : entry.createdAt instanceof Date ? entry.createdAt : null,
    })),
    ...recentActivity.campaigns.map((entry) => ({
      id: `campaign:${entry.id || Math.random().toString(36).slice(2, 8)}`,
      type: 'campaign' as const,
      title: entry.title ? `${entry.title} campaign updated` : 'Campaign updated',
      detail: entry.organizer ? `Organizer: ${entry.organizer}` : 'Organizer unknown',
      at: entry.startDate instanceof Date ? entry.startDate : entry.createdAt instanceof Date ? entry.createdAt : null,
    })),
  ].sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0)).slice(0, 10);

  const activeRate = clampPercent(stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0);
  const completionRate = clampPercent(stats.totalDonations > 0 ? (stats.completedDonations / stats.totalDonations) * 100 : 0);

  return {
    actionCards,
    incident,
    priorityActions,
    criticalAlerts,
    warningAlerts,
    activity,
    activeRate,
    completionRate,
  };
};
