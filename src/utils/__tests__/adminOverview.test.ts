import { describe, expect, it } from 'vitest';
import { buildAdminOverviewSynthesis } from '../adminOverview';

const routes = {
  verification: '/admin/dashboard/verification',
  emergencyRequests: '/admin/dashboard/emergency-requests',
  inventoryAlerts: '/admin/dashboard/inventory-alerts',
  offlineSyncHealth: '/admin/dashboard/offline-sync-health',
  analyticsReports: '/admin/dashboard/analytics-reports',
  users: '/admin/dashboard/users',
};

describe('buildAdminOverviewSynthesis', () => {
  it('prioritizes critical offline sync incidents first', () => {
    const result = buildAdminOverviewSynthesis({
      stats: {
        totalUsers: 100,
        totalDonors: 60,
        totalHospitals: 20,
        totalNGOs: 15,
        totalAdmins: 5,
        activeUsers: 80,
        inactiveUsers: 20,
        pendingVerification: 4,
        totalDonations: 40,
        completedDonations: 35,
        totalBloodUnits: 120,
        activeRequests: 2,
        fulfilledRequests: 10,
        totalCampaigns: 6,
        activeCampaigns: 2,
        completedCampaigns: 3,
        pendingVerificationRequests: 3,
        approvedVerificationRequests: 7,
        rejectedVerificationRequests: 1,
      },
      systemAlerts: [],
      offlinePendingCount: 4,
      offlineFailedCount: 2,
      recentActivity: { donations: [], requests: [], campaigns: [] },
      routes,
    });

    expect(result.incident.severity).toBe('critical');
    expect(result.priorityActions[0]?.id).toBe('offline');
    expect(result.actionCards.find((card) => card.id === 'sync')?.status).toBe('critical');
  });

  it('groups inventory alerts by severity and computes percentages', () => {
    const result = buildAdminOverviewSynthesis({
      stats: {
        totalUsers: 20,
        totalDonors: 10,
        totalHospitals: 4,
        totalNGOs: 4,
        totalAdmins: 2,
        activeUsers: 10,
        inactiveUsers: 10,
        pendingVerification: 1,
        totalDonations: 10,
        completedDonations: 8,
        totalBloodUnits: 32,
        activeRequests: 0,
        fulfilledRequests: 3,
        totalCampaigns: 2,
        activeCampaigns: 1,
        completedCampaigns: 1,
        pendingVerificationRequests: 1,
        approvedVerificationRequests: 0,
        rejectedVerificationRequests: 0,
      },
      systemAlerts: [
        {
          id: 'a',
          type: 'critical',
          message: 'Critical shortage',
          source: 'Inventory',
          timestamp: new Date(),
          resolved: false,
        },
        {
          id: 'b',
          type: 'warning',
          message: 'Low stock',
          source: 'Inventory',
          timestamp: new Date(),
          resolved: false,
        },
      ],
      offlinePendingCount: 0,
      offlineFailedCount: 0,
      recentActivity: { donations: [], requests: [], campaigns: [] },
      routes,
    });

    expect(result.criticalAlerts).toHaveLength(1);
    expect(result.warningAlerts).toHaveLength(1);
    expect(result.activeRate).toBe(50);
    expect(result.completionRate).toBe(80);
  });
});
