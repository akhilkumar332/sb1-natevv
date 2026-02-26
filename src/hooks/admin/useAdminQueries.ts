import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { adminQueryKeys, type AdminKpiRange, type AdminUserRoleFilter } from '../../constants/adminQueryKeys';
import { getAdminCacheKey, readAdminCache, writeAdminCache } from '../../utils/adminCache';
import {
  getAllUsers,
  getEmergencyRequests,
  getInventoryAlerts,
  getPlatformStats,
  getRecentActivity,
  getVerificationRequests,
} from '../../services/admin.service';
import {
  getAdminUserDetail,
  getAdminUserKpis,
  getAdminUserReferrals,
  getAdminUserSecurity,
  getAdminUserTimeline,
  type AdminUserKpis,
  type AdminUserReferral,
  type AdminUserSecurity,
  type AdminUserTimelineItem,
} from '../../services/adminUserDetail.service';
import type { BloodInventory, BloodRequest, User, VerificationRequest } from '../../types/database.types';

type PlatformStatsResponse = Awaited<ReturnType<typeof getPlatformStats>>;
type AdminEntity = Record<string, any> & { id?: string };
type AdminRecentActivity = {
  donations: AdminEntity[];
  requests: AdminEntity[];
  campaigns: AdminEntity[];
};

export type AdminOverviewStats = {
  totalUsers: number;
  totalDonors: number;
  totalHospitals: number;
  totalNGOs: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingVerification: number;
  totalDonations: number;
  completedDonations: number;
  totalBloodUnits: number;
  activeRequests: number;
  fulfilledRequests: number;
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  pendingVerificationRequests: number;
  approvedVerificationRequests: number;
  rejectedVerificationRequests: number;
};

export type AdminSystemAlert = {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  action?: string;
};

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return undefined;
};

const useCachedAdminQuery = <T,>(
  queryKey: readonly unknown[],
  ttlMs: number,
  dateFields: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    gcTime?: number;
    refetchInterval?: number | false;
    refetchIntervalInBackground?: boolean;
    refetchOnMount?: boolean | 'always';
    refetchOnWindowFocus?: boolean;
    enabled?: boolean;
  },
) => {
  const cacheKey = getAdminCacheKey(queryKey);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      writeAdminCache(cacheKey, data);
      return data;
    },
    initialData: () => readAdminCache<T>(cacheKey, ttlMs, dateFields),
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: options?.refetchIntervalInBackground,
    refetchOnMount: options?.refetchOnMount,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    enabled: options?.enabled,
  });
};

const fetchAdminUsers = async (role: AdminUserRoleFilter = 'all', limitCount: number = 800): Promise<User[]> => {
  if (role === 'donor') return getAllUsers('donor', undefined, limitCount);
  if (role === 'ngo') return getAllUsers('ngo', undefined, limitCount);
  if (role === 'bloodbank') {
    const [bloodbanks, hospitals] = await Promise.all([
      getAllUsers('bloodbank', undefined, limitCount),
      getAllUsers('hospital', undefined, limitCount),
    ]);
    return [...bloodbanks, ...hospitals];
  }
  return getAllUsers(undefined, undefined, limitCount);
};

const fetchCampaigns = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      startDate: toDate(data.startDate),
      endDate: toDate(data.endDate),
    };
  });
};

const fetchVolunteers = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'volunteers'), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      joinDate: toDate(data.joinDate),
    };
  });
};

const fetchPartnerships = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'partnerships'), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      since: toDate(data.since),
    };
  });
};

const fetchAppointments = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'appointments'), orderBy('scheduledDate', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      scheduledDate: toDate(data.scheduledDate),
      completedAt: toDate(data.completedAt),
    };
  });
};

const fetchDonations = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'donations'), orderBy('donationDate', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      donationDate: toDate(data.donationDate),
    };
  });
};

const fetchNotifications = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
};

const fetchAuditLogs = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
};

export const useAdminUsers = (role: AdminUserRoleFilter = 'all', limitCount: number = 800) =>
  useCachedAdminQuery<User[]>(
    adminQueryKeys.users(role, limitCount),
    2 * 60 * 1000,
    ['createdAt', 'updatedAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth'],
    () => fetchAdminUsers(role, limitCount),
    { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchInterval: 3 * 60 * 1000 },
  );

export const useAdminOverviewUsers = (limitCount: number = 100) =>
  useCachedAdminQuery<User[]>(
    adminQueryKeys.overviewUsers(limitCount),
    2 * 60 * 1000,
    ['createdAt', 'updatedAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth'],
    () => fetchAdminUsers('all', limitCount),
    { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchInterval: 2 * 60 * 1000 },
  );

export const useAdminVerificationRequests = (limitCount: number = 500) =>
  useCachedAdminQuery<VerificationRequest[]>(
    adminQueryKeys.verificationRequests(limitCount),
    60 * 1000,
    ['submittedAt', 'updatedAt', 'reviewedAt', 'createdAt'],
    () => getVerificationRequests(undefined, limitCount),
    {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchInterval: 20 * 1000,
      refetchIntervalInBackground: true,
    },
  );

export const useAdminEmergencyRequests = () =>
  useCachedAdminQuery<BloodRequest[]>(
    adminQueryKeys.emergencyRequests(),
    60 * 1000,
    ['requestedAt', 'neededBy', 'expiresAt', 'fulfilledAt', 'createdAt', 'updatedAt'],
    () => getEmergencyRequests(),
    {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchInterval: 20 * 1000,
      refetchIntervalInBackground: true,
    },
  );

export const useAdminInventoryAlerts = () =>
  useCachedAdminQuery<BloodInventory[]>(
    adminQueryKeys.inventoryAlerts(),
    2 * 60 * 1000,
    ['lastRestocked', 'updatedAt', 'createdAt'],
    () => getInventoryAlerts(),
    {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 60 * 1000,
      refetchIntervalInBackground: true,
    },
  );

export const useAdminRecentActivity = (limitCount: number = 5) =>
  useCachedAdminQuery<AdminRecentActivity>(
    adminQueryKeys.recentActivity(limitCount),
    2 * 60 * 1000,
    ['donationDate', 'requestedAt', 'startDate', 'createdAt', 'updatedAt'],
    async () => {
      const raw = await getRecentActivity(limitCount);
      return {
        donations: (raw.donations || []).map((entry) => ({
          ...entry,
          donationDate: toDate(entry.donationDate) || toDate(entry.createdAt),
        })),
        requests: (raw.requests || []).map((entry: any) => ({
          ...entry,
          requestedAt: toDate(entry.requestedAt) || toDate(entry.createdAt),
          hospitalName: entry.hospitalName || entry.requesterName || '',
        })),
        campaigns: (raw.campaigns || []).map((entry: any) => ({
          ...entry,
          startDate: toDate(entry.startDate) || toDate(entry.createdAt),
          organizer: entry.organizer || entry.organizerName || entry.ngoName || '',
        })),
      };
    },
    { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchInterval: 2 * 60 * 1000 },
  );

export const useAdminPlatformStats = () =>
  useCachedAdminQuery<PlatformStatsResponse>(
    adminQueryKeys.platformStats(),
    10 * 60 * 1000,
    [],
    () => getPlatformStats(),
    { staleTime: 5 * 60 * 1000, gcTime: 20 * 60 * 1000, refetchInterval: 5 * 60 * 1000 },
  );

export const useAdminCampaigns = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.campaigns(limitCount),
    10 * 60 * 1000,
    ['startDate', 'endDate', 'createdAt', 'updatedAt'],
    () => fetchCampaigns(limitCount),
    { staleTime: 5 * 60 * 1000, gcTime: 20 * 60 * 1000, refetchInterval: 5 * 60 * 1000 },
  );

export const useAdminVolunteers = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.volunteers(limitCount),
    10 * 60 * 1000,
    ['joinDate', 'createdAt', 'updatedAt'],
    () => fetchVolunteers(limitCount),
    { staleTime: 5 * 60 * 1000, gcTime: 20 * 60 * 1000, refetchInterval: 5 * 60 * 1000 },
  );

export const useAdminPartnerships = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.partnerships(limitCount),
    10 * 60 * 1000,
    ['since', 'createdAt', 'updatedAt'],
    () => fetchPartnerships(limitCount),
    { staleTime: 5 * 60 * 1000, gcTime: 20 * 60 * 1000, refetchInterval: 5 * 60 * 1000 },
  );

export const useAdminAppointments = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.appointments(limitCount),
    5 * 60 * 1000,
    ['scheduledDate', 'completedAt', 'createdAt', 'updatedAt'],
    () => fetchAppointments(limitCount),
    { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchInterval: 2 * 60 * 1000 },
  );

export const useAdminDonations = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.donations(limitCount),
    5 * 60 * 1000,
    ['donationDate', 'createdAt', 'updatedAt'],
    () => fetchDonations(limitCount),
    { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchInterval: 2 * 60 * 1000 },
  );

export const useAdminNotifications = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.notifications(limitCount),
    2 * 60 * 1000,
    ['createdAt', 'updatedAt'],
    () => fetchNotifications(limitCount),
    {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 60 * 1000,
      refetchIntervalInBackground: true,
    },
  );

export const useAdminAuditLogs = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.auditLogs(limitCount),
    2 * 60 * 1000,
    ['createdAt', 'updatedAt'],
    () => fetchAuditLogs(limitCount),
    {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 60 * 1000,
      refetchIntervalInBackground: true,
    },
  );

export const useAdminUserDetail = (uid: string) =>
  useCachedAdminQuery<User>(
    adminQueryKeys.userDetail(uid),
    0,
    ['createdAt', 'updatedAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth'],
    () => getAdminUserDetail(uid),
    {
      staleTime: 0,
      gcTime: 15 * 60 * 1000,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      enabled: Boolean(uid),
    },
  );

export const useAdminUserSecurity = (uid: string) =>
  useCachedAdminQuery<AdminUserSecurity>(
    adminQueryKeys.userSecurity(uid),
    0,
    ['updatedAt', 'createdAt'],
    () => getAdminUserSecurity(uid),
    {
      staleTime: 0,
      gcTime: 10 * 60 * 1000,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      enabled: Boolean(uid),
    },
  );

export const useAdminUserKpis = (uid: string, roleHint?: string, range: AdminKpiRange = '90d') =>
  useCachedAdminQuery<AdminUserKpis>(
    adminQueryKeys.userKpis(uid, range),
    5 * 60 * 1000,
    [],
    () => getAdminUserKpis(uid, roleHint, range),
    {
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchInterval: 2 * 60 * 1000,
      refetchIntervalInBackground: true,
      enabled: Boolean(uid),
    },
  );

export const useAdminUserReferrals = (
  uid: string,
  filters?: { role?: string; status?: string; search?: string },
) =>
  useCachedAdminQuery<AdminUserReferral[]>(
    adminQueryKeys.userReferrals(uid, filters),
    5 * 60 * 1000,
    ['referredAt', 'createdAt'],
    () => getAdminUserReferrals(uid, filters),
    {
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchInterval: 2 * 60 * 1000,
      refetchIntervalInBackground: true,
      enabled: Boolean(uid),
    },
  );

export const useAdminUserTimeline = (
  uid: string,
  filters?: { kind?: string; search?: string },
) =>
  useCachedAdminQuery<AdminUserTimelineItem[]>(
    adminQueryKeys.userTimeline(uid, filters),
    2 * 60 * 1000,
    ['createdAt'],
    () => getAdminUserTimeline(uid, filters),
    {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 60 * 1000,
      refetchIntervalInBackground: true,
      enabled: Boolean(uid),
    },
  );

export const useAdminOverviewData = () => {
  const usersQuery = useAdminOverviewUsers(100);
  const verificationQuery = useAdminVerificationRequests(500);
  const emergencyQuery = useAdminEmergencyRequests();
  const inventoryQuery = useAdminInventoryAlerts();
  const recentActivityQuery = useAdminRecentActivity(5);
  const platformStatsQuery = useAdminPlatformStats();

  const users = usersQuery.data || [];
  const verificationRequests = verificationQuery.data || [];
  const emergencyRequests = emergencyQuery.data || [];
  const inventoryAlerts = inventoryQuery.data || [];
  const recentActivity = recentActivityQuery.data || { donations: [], requests: [], campaigns: [] };

  const stats = useMemo<AdminOverviewStats>(() => {
    const platform = platformStatsQuery.data;
    if (!platform) {
      return {
        totalUsers: users.length,
        totalDonors: users.filter((u) => u.role === 'donor').length,
        totalHospitals: users.filter((u) => u.role === 'bloodbank' || u.role === 'hospital').length,
        totalNGOs: users.filter((u) => u.role === 'ngo').length,
        totalAdmins: users.filter((u) => u.role === 'admin' || u.role === 'superadmin').length,
        activeUsers: users.filter((u) => u.status === 'active').length,
        inactiveUsers: users.filter((u) => u.status === 'inactive').length,
        pendingVerification: users.filter((u) => u.status === 'pending_verification').length,
        totalDonations: 0,
        completedDonations: 0,
        totalBloodUnits: 0,
        activeRequests: 0,
        fulfilledRequests: 0,
        totalCampaigns: 0,
        activeCampaigns: 0,
        completedCampaigns: 0,
        pendingVerificationRequests: verificationRequests.filter((v) => v.status === 'pending').length,
        approvedVerificationRequests: verificationRequests.filter((v) => v.status === 'approved').length,
        rejectedVerificationRequests: verificationRequests.filter((v) => v.status === 'rejected').length,
      };
    }

    return {
      totalUsers: platform.users.total,
      totalDonors: platform.users.byRole.donors,
      totalHospitals: platform.users.byRole.hospitals,
      totalNGOs: platform.users.byRole.ngos,
      totalAdmins: platform.users.byRole.admins,
      activeUsers: platform.users.byStatus.active,
      inactiveUsers: platform.users.byStatus.inactive,
      pendingVerification: platform.users.byStatus.pendingVerification,
      totalDonations: platform.donations.total,
      completedDonations: platform.donations.completed,
      totalBloodUnits: platform.donations.totalUnits,
      activeRequests: platform.requests.byStatus.active,
      fulfilledRequests: platform.requests.byStatus.fulfilled,
      totalCampaigns: platform.campaigns.total,
      activeCampaigns: platform.campaigns.byStatus.active,
      completedCampaigns: platform.campaigns.byStatus.completed,
      pendingVerificationRequests: platform.verifications.byStatus.pending,
      approvedVerificationRequests: platform.verifications.byStatus.approved,
      rejectedVerificationRequests: platform.verifications.byStatus.rejected,
    };
  }, [platformStatsQuery.data, users, verificationRequests]);

  const systemAlerts = useMemo<AdminSystemAlert[]>(() => {
    const alerts: AdminSystemAlert[] = inventoryAlerts.slice(0, 20).map((item) => {
      const isCritical = item.status === 'critical';
      return {
        id: item.id || `${item.hospitalId}-${item.bloodType}`,
        type: isCritical ? 'critical' : 'warning',
        message: `${isCritical ? 'Critical' : 'Low'} blood shortage for ${item.bloodType} - Only ${item.units || 0} units available`,
        source: `Inventory Alert - BloodBank ID: ${item.hospitalId}`,
        timestamp: toDate(item.updatedAt) || new Date(),
        resolved: false,
        action: 'View Inventory',
      };
    });

    const pendingVerificationCount = verificationRequests.filter((entry) => entry.status === 'pending').length;
    if (pendingVerificationCount > 5) {
      alerts.unshift({
        id: 'verify-alert',
        type: 'warning',
        message: `${pendingVerificationCount} verification requests pending review`,
        source: 'Verification System',
        timestamp: new Date(),
        resolved: false,
        action: 'Review Requests',
      });
    }

    return alerts;
  }, [inventoryAlerts, verificationRequests]);

  const loading = [
    usersQuery,
    verificationQuery,
    emergencyQuery,
    inventoryQuery,
    recentActivityQuery,
    platformStatsQuery,
  ].some((entry) => entry.isLoading);

  const error = usersQuery.error
    || verificationQuery.error
    || emergencyQuery.error
    || inventoryQuery.error
    || recentActivityQuery.error
    || platformStatsQuery.error;

  const refreshData = async () => {
    await Promise.all([
      usersQuery.refetch(),
      verificationQuery.refetch(),
      emergencyQuery.refetch(),
      inventoryQuery.refetch(),
      recentActivityQuery.refetch(),
      platformStatsQuery.refetch(),
    ]);
  };

  return {
    users,
    verificationRequests,
    emergencyRequests,
    systemAlerts,
    stats,
    recentActivity,
    loading,
    error: error instanceof Error ? error.message : null,
    refreshData,
  };
};
